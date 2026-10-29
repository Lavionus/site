/* ============================================================
   pozadi/jadro.js – výpočty pro Odstranění pozadí (bez DOM).
   Maska = Uint8Array w*h (0 = pozadí/průhledné, 255 = objekt).
   Obraz = RGBA pole (Uint8ClampedArray z ImageData) w*h*4.
   V prohlížeči window.POZADI, v node module.exports.
   ============================================================ */
(function (koren) {
'use strict';

// normalizace jako v rembg pro U-2-Net (ImageNet průměr a odchylka)
const PRUMER = [0.485, 0.456, 0.406], ODCHYLKA = [0.229, 0.224, 0.225];

/** Zmenšení/zvětšení vícekanálových dat: při zmenšení průměr plochy, při zvětšení bilineárně. */
function prevzorkuj(data, w, h, k, nw, nh) {
  const ven = new Float32Array(nw * nh * k);
  const sx = w / nw, sy = h / nh;
  if (sx <= 1 && sy <= 1) {
    for (let y = 0; y < nh; y++) {
      const fy = Math.min(h - 1, Math.max(0, (y + 0.5) * sy - 0.5));
      const y0 = Math.floor(fy), y1 = Math.min(h - 1, y0 + 1), ty = fy - y0;
      for (let x = 0; x < nw; x++) {
        const fx = Math.min(w - 1, Math.max(0, (x + 0.5) * sx - 0.5));
        const x0 = Math.floor(fx), x1 = Math.min(w - 1, x0 + 1), tx = fx - x0;
        for (let c = 0; c < k; c++) {
          const a = data[(y0 * w + x0) * k + c], b = data[(y0 * w + x1) * k + c];
          const d = data[(y1 * w + x0) * k + c], e = data[(y1 * w + x1) * k + c];
          ven[(y * nw + x) * k + c] = (a + (b - a) * tx) * (1 - ty) + (d + (e - d) * tx) * ty;
        }
      }
    }
    return ven;
  }
  // zmenšení: průměr bloku zdrojových pixelů (bez aliasingu i u fotek 6000 px)
  for (let y = 0; y < nh; y++) {
    const ya = Math.floor(y * sy), yb = Math.max(ya + 1, Math.min(h, Math.ceil((y + 1) * sy)));
    for (let x = 0; x < nw; x++) {
      const xa = Math.floor(x * sx), xb = Math.max(xa + 1, Math.min(w, Math.ceil((x + 1) * sx)));
      const n = (yb - ya) * (xb - xa), o = (y * nw + x) * k;
      for (let yy = ya; yy < yb; yy++) for (let xx = xa; xx < xb; xx++) {
        const i = (yy * w + xx) * k;
        for (let c = 0; c < k; c++) ven[o + c] += data[i + c];
      }
      for (let c = 0; c < k; c++) ven[o + c] /= n;
    }
  }
  return ven;
}

/** Vstupní tenzor modelu [1,3,S,S] (CHW): zmenšení, dělení maximem, odečtení průměru / odchylka. */
function tenzor(rgba, w, h, S = 320) {
  const m = prevzorkuj(rgba, w, h, 4, S, S);
  let max = 1e-6;
  for (let i = 0; i < S * S; i++) for (let c = 0; c < 3; c++) if (m[i * 4 + c] > max) max = m[i * 4 + c];
  const t = new Float32Array(3 * S * S);
  for (let i = 0; i < S * S; i++)
    for (let c = 0; c < 3; c++) t[c * S * S + i] = (m[i * 4 + c] / max - PRUMER[c]) / ODCHYLKA[c];
  return t;
}

/** Výstup modelu (float) → maska 0..255 roztažením min–max (jako rembg). */
function normalizujMasku(pred) {
  let mi = Infinity, ma = -Infinity;
  for (const v of pred) { if (v < mi) mi = v; if (v > ma) ma = v; }
  const r = ma - mi || 1, ven = new Uint8Array(pred.length);
  for (let i = 0; i < pred.length; i++) ven[i] = Math.round((pred[i] - mi) / r * 255);
  return ven;
}

/** Maska libovolné velikosti → jiná velikost (bilineárně / průměrem). */
function prevzorkujMasku(maska, w, h, nw, nh) {
  const f = prevzorkuj(maska, w, h, 1, nw, nh), ven = new Uint8Array(nw * nh);
  for (let i = 0; i < f.length; i++) ven[i] = Math.round(f[i]);
  return ven;
}

/** Krabicový filtr s okénkem (2r+1)², na okrajích průměr jen přes existující pixely. */
function boxFiltr(src, w, h, r) {
  const tmp = new Float32Array(w * h), ven = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const o = y * w; let s = 0;
    for (let x = 0; x <= Math.min(r, w - 1); x++) s += src[o + x];
    for (let x = 0; x < w; x++) {
      const a = Math.max(0, x - r), b = Math.min(w - 1, x + r);
      tmp[o + x] = s / (b - a + 1);
      if (x + r + 1 < w) s += src[o + x + r + 1];
      if (x - r >= 0) s -= src[o + x - r];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = 0; y <= Math.min(r, h - 1); y++) s += tmp[y * w + x];
    for (let y = 0; y < h; y++) {
      const a = Math.max(0, y - r), b = Math.min(h - 1, y + r);
      ven[y * w + x] = s / (b - a + 1);
      if (y + r + 1 < h) s += tmp[(y + r + 1) * w + x];
      if (y - r >= 0) s -= tmp[(y - r) * w + x];
    }
  }
  return ven;
}

/**
 * Přenos malé masky na plné rozlišení se zjemněním podle obrazu
 * (rychlý řízený filtr – He a kol.: koeficienty a,b na zmenšenině, aplikace na plném jasu).
 * Hrana masky se tak přimkne ke skutečné hraně v obraze (vlasy, srst lépe než prosté zvětšení).
 */
function zjemniPodleObrazu(rgba, w, h, maska, mw, mh, o = {}) {
  const prace = o.prace || 1024, eps = o.eps ?? 1e-3;
  const k = Math.min(1, prace / Math.max(w, h));
  const sw = Math.max(1, Math.round(w * k)), sh = Math.max(1, Math.round(h * k));
  const r = o.r ?? Math.max(2, Math.round(Math.max(sw, sh) / 160));
  const male = prevzorkuj(rgba, w, h, 4, sw, sh);
  const I = new Float32Array(sw * sh);
  for (let i = 0; i < I.length; i++) I[i] = (0.299 * male[i * 4] + 0.587 * male[i * 4 + 1] + 0.114 * male[i * 4 + 2]) / 255;
  const pf = prevzorkuj(maska, mw, mh, 1, sw, sh);
  const p = new Float32Array(sw * sh);
  for (let i = 0; i < p.length; i++) p[i] = pf[i] / 255;
  const II = new Float32Array(I.length), Ip = new Float32Array(I.length);
  for (let i = 0; i < I.length; i++) { II[i] = I[i] * I[i]; Ip[i] = I[i] * p[i]; }
  const mI = boxFiltr(I, sw, sh, r), mp = boxFiltr(p, sw, sh, r), mII = boxFiltr(II, sw, sh, r), mIp = boxFiltr(Ip, sw, sh, r);
  const a = new Float32Array(I.length), b = new Float32Array(I.length);
  for (let i = 0; i < I.length; i++) {
    const v = mII[i] - mI[i] * mI[i], cv = mIp[i] - mI[i] * mp[i];
    a[i] = cv / (v + eps); b[i] = mp[i] - a[i] * mI[i];
  }
  const A = boxFiltr(a, sw, sh, r), B = boxFiltr(b, sw, sh, r);
  // a,b bilineárně na plné rozlišení, q = A·I + B počítané rovnou (bez velkých float polí)
  const ven = new Uint8Array(w * h), fx = sw / w, fy = sh / h;
  for (let y = 0; y < h; y++) {
    const yy = Math.min(sh - 1, Math.max(0, (y + 0.5) * fy - 0.5));
    const y0 = Math.floor(yy), y1 = Math.min(sh - 1, y0 + 1), ty = yy - y0;
    for (let x = 0; x < w; x++) {
      const xx = Math.min(sw - 1, Math.max(0, (x + 0.5) * fx - 0.5));
      const x0 = Math.floor(xx), x1 = Math.min(sw - 1, x0 + 1), tx = xx - x0;
      const i00 = y0 * sw + x0, i01 = y0 * sw + x1, i10 = y1 * sw + x0, i11 = y1 * sw + x1;
      const Av = (A[i00] * (1 - tx) + A[i01] * tx) * (1 - ty) + (A[i10] * (1 - tx) + A[i11] * tx) * ty;
      const Bv = (B[i00] * (1 - tx) + B[i01] * tx) * (1 - ty) + (B[i10] * (1 - tx) + B[i11] * tx) * ty;
      const j = (y * w + x) * 4;
      const L = (0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2]) / 255;
      ven[y * w + x] = Math.max(0, Math.min(255, Math.round((Av * L + Bv) * 255)));
    }
  }
  return ven;
}

/** Úrovně masky: pod `nizko` → 0, nad `vysoko` → 255, mezi lineárně (zostření hrany). */
function urovne(maska, nizko, vysoko) {
  const ven = new Uint8Array(maska.length), r = Math.max(1, vysoko - nizko);
  for (let i = 0; i < maska.length; i++) ven[i] = Math.max(0, Math.min(255, Math.round((maska[i] - nizko) / r * 255)));
  return ven;
}

// ---------- barvy ----------
function ycc(r, g, b) {
  return [0.299 * r + 0.587 * g + 0.114 * b, 128 - 0.168736 * r - 0.331264 * g + 0.5 * b, 128 + 0.5 * r - 0.418688 * g - 0.081312 * b];
}
function rgbZYcc(y, cb, cr) {
  return [y + 1.402 * (cr - 128), y - 0.344136 * (cb - 128) - 0.714136 * (cr - 128), y + 1.772 * (cb - 128)]
    .map(v => Math.max(0, Math.min(255, Math.round(v))));
}
function hexNaRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
function rgbNaHex(r, g, b) { return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''); }

/**
 * Klíčování barvou (chroma key): vzdálenost od klíče hlavně v barevnosti (Cb,Cr) přepočtené
 * na jas pixelu, jas s poloviční vahou (stíny na zeleném plátně zůstanou pozadím).
 * tolerance a mekkost v 0..255; vrací masku (pozadí 0).
 */
function chromaKlic(rgba, w, h, klic, tolerance, mekkost) {
  const [ky, kb, kr] = ycc(klic[0], klic[1], klic[2]);
  const ven = new Uint8Array(w * h), m = Math.max(0.5, mekkost);
  for (let i = 0; i < w * h; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b, cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    // barevnost klíče přepočtená na jas pixelu – stín na plátně má stejný odstín, jen menší sytost
    const s = Math.min(1.5, y / Math.max(1, ky));
    const d = Math.sqrt((cb - 128 - (kb - 128) * s) ** 2 + (cr - 128 - (kr - 128) * s) ** 2 + 0.25 * (y - ky) ** 2);
    ven[i] = d <= tolerance ? 0 : d >= tolerance + m ? 255 : Math.round((d - tolerance) / m * 255);
  }
  return ven;
}

/** Potlačení přesvitu barvy klíče: odečte složku barevnosti ve směru klíče (jas zůstává). sila 0..1 */
function odstranPresvit(r, g, b, klic, sila) {
  const [, kb, kr] = ycc(klic[0], klic[1], klic[2]);
  const vx = kb - 128, vy = kr - 128, d = Math.hypot(vx, vy);
  if (d < 1 || sila <= 0) return [r, g, b];
  const ux = vx / d, uy = vy / d;
  const [y, cb, cr] = ycc(r, g, b);
  const p = (cb - 128) * ux + (cr - 128) * uy;
  if (p <= 0) return [r, g, b];
  return rgbZYcc(y, cb - ux * p * sila, cr - uy * p * sila);
}

// ---------- kouzelná hůlka ----------
/**
 * Výběr podobné barvy od bodu (x,y): souvisle = vyplnění oblasti (řádkový flood fill),
 * jinak všechny podobné pixely v obraze. tolerance 0..255 (eukleidovsky v RGB / √3).
 * Vrací Uint8Array 0/1.
 */
function hulka(rgba, w, h, x, y, tolerance, souvisle = true) {
  x = Math.floor(x); y = Math.floor(y);
  const ven = new Uint8Array(w * h);
  if (x < 0 || y < 0 || x >= w || y >= h) return ven;
  const s = (y * w + x) * 4, sr = rgba[s], sg = rgba[s + 1], sb = rgba[s + 2];
  const lim = tolerance * tolerance * 3;
  const ok = i => { const j = i * 4, dr = rgba[j] - sr, dg = rgba[j + 1] - sg, db = rgba[j + 2] - sb; return dr * dr + dg * dg + db * db <= lim; };
  if (!souvisle) { for (let i = 0; i < w * h; i++) if (ok(i)) ven[i] = 1; return ven; }
  const zas = [x, y];
  while (zas.length) {
    const yy = zas.pop(); let xx = zas.pop();
    let i = yy * w + xx;
    if (ven[i] || !ok(i)) continue;
    while (xx > 0 && !ven[i - 1] && ok(i - 1)) { xx--; i--; }
    let nahore = false, dole = false;
    for (; xx < w && !ven[i] && ok(i); xx++, i++) {
      ven[i] = 1;
      if (yy > 0) { const u = i - w, d = !ven[u] && ok(u); if (d && !nahore) zas.push(xx, yy - 1); nahore = d; }
      if (yy < h - 1) { const u = i + w, d = !ven[u] && ok(u); if (d && !dole) zas.push(xx, yy + 1); dole = d; }
    }
  }
  return ven;
}

/** Použití výběru 0/1 na masku: rezim 'odebrat' → 0, 'pridat' → 255. Vrací ohraničení změny nebo null. */
function pouzijVyber(maska, w, vyber, rezim) {
  const cil = rezim === 'pridat' ? 255 : 0;
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let i = 0; i < vyber.length; i++) if (vyber[i]) {
    maska[i] = cil;
    const x = i % w, y = (i - x) / w;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// ---------- hrany ----------
/** Vzdálenost (chamfer 1/√2) každého pixelu k nejbližšímu pixelu, kde je cil[i]=1. */
function vzdalenosti(cil, w, h) {
  const d = new Float32Array(w * h), b = Math.SQRT2;
  for (let i = 0; i < w * h; i++) d[i] = cil[i] ? 0 : 1e9;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + 1);
    if (y > 0) { v = Math.min(v, d[i - w] + 1); if (x > 0) v = Math.min(v, d[i - w - 1] + b); if (x < w - 1) v = Math.min(v, d[i - w + 1] + b); }
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; let v = d[i];
    if (x < w - 1) v = Math.min(v, d[i + 1] + 1);
    if (y < h - 1) { v = Math.min(v, d[i + w] + 1); if (x < w - 1) v = Math.min(v, d[i + w + 1] + b); if (x > 0) v = Math.min(v, d[i + w - 1] + b); }
    d[i] = v;
  }
  return d;
}

/**
 * Zúžení (px<0) nebo rozšíření (px>0) masky o px pixelů: znaménkové vzdálenostní pole od hrany
 * (práh 128), hrana se posune kruhově a dostane 1 px vyhlazení.
 */
function posunHranu(maska, w, h, px) {
  if (!px) return maska.slice();
  const uvnitr = new Uint8Array(w * h), venku = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { if (maska[i] >= 128) uvnitr[i] = 1; else venku[i] = 1; }
  const dIn = vzdalenosti(uvnitr, w, h), dOut = vzdalenosti(venku, w, h);
  const ven = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const sd = uvnitr[i] ? 0.5 - dOut[i] : dIn[i] - 0.5;   // záporné uvnitř
    ven[i] = Math.round(Math.max(0, Math.min(1, 0.5 - sd + px)) * 255);
  }
  return ven;
}

/** Rozmazání (zjemnění hrany, feather): 3× krabicový filtr ≈ Gauss se σ ≈ r. */
function rozmaz(maska, w, h, r) {
  if (r <= 0) return maska.slice();
  const rr = Math.max(1, Math.round(r * 0.8));
  let f = Float32Array.from(maska);
  for (let k = 0; k < 3; k++) f = boxFiltr(f, w, h, rr);
  const ven = new Uint8Array(w * h);
  for (let i = 0; i < f.length; i++) ven[i] = Math.round(f[i]);
  return ven;
}

/** Odstranění malých ostrůvků: oblasti (nad/pod prahem 128) menší než minPlocha převezmou okolní hodnotu. */
function vycistiOstrovy(maska, w, h, minPlocha) {
  const ven = maska.slice(), vid = new Uint8Array(w * h), zas = new Int32Array(w * h), clen = new Int32Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (vid[s]) continue;
    const strana = maska[s] >= 128;
    let n = 0, top = 0; zas[top++] = s; vid[s] = 1;
    while (top) {
      const i = zas[--top]; clen[n++] = i;
      const x = i % w;
      const sous = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < w * (h - 1) ? i + w : -1];
      for (const j of sous) if (j >= 0 && !vid[j] && (maska[j] >= 128) === strana) { vid[j] = 1; zas[top++] = j; }
    }
    if (n < minPlocha) for (let k = 0; k < n; k++) ven[clen[k]] = strana ? 0 : 255;
  }
  return ven;
}

/** Ohraničení objektu (pixely nad prahem) → {x,y,w,h} nebo null. */
function ohraniceni(maska, w, h, prah = 8) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) if (maska[o + x] > prah) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Rozměr výstupu: celý obraz, nebo ohraničení + okraj (okraj smí přesáhnout obraz). */
function vystupniObdelnik(maska, w, h, orez, okraj) {
  if (!orez) return { x: 0, y: 0, w, h };
  const b = ohraniceni(maska, w, h);
  if (!b) return { x: 0, y: 0, w, h };
  return { x: b.x - okraj, y: b.y - okraj, w: b.w + 2 * okraj, h: b.h + 2 * okraj };
}

/**
 * Štětec: měkký kruh (tvrdost 0..1 = podíl plného středu), rezim 'obnovit' zvedá masku (max),
 * 'vymazat' snižuje (min) – opakované tahy se nesčítají. Vrací ohraničení změny.
 */
function stetec(maska, w, h, cx, cy, r, tvrdost, rezim) {
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));
  if (x0 > x1 || y0 > y1) return null;
  const t = Math.min(0.999, Math.max(0, tvrdost)), obn = rezim === 'obnovit';
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
    if (d >= 1) continue;
    let f = d <= t ? 1 : (1 - d) / (1 - t);
    f = f * f * (3 - 2 * f);                       // hladký náběh
    const i = y * w + x, v = Math.round(255 * f);
    if (obn) { if (v > maska[i]) maska[i] = v; }
    else { const c = 255 - v; if (c < maska[i]) maska[i] = c; }
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Tah štětce mezi dvěma body (otisky po čtvrtině poloměru). */
function tah(maska, w, h, ax, ay, bx, by, r, tvrdost, rezim) {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / Math.max(0.5, r * 0.25)));
  let box = null;
  for (let k = 1; k <= n; k++) {
    const b = stetec(maska, w, h, ax + (bx - ax) * k / n, ay + (by - ay) * k / n, r, tvrdost, rezim);
    box = sjednot(box, b);
  }
  return box;
}
function sjednot(a, b) {
  if (!a) return b; if (!b) return a;
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** Kolik kroků zpět se vejde do rozpočtu paměti (bajty) pro masku w×h. */
function hloubkaHistorie(w, h, rozpocet = 400e6) {
  return Math.max(3, Math.min(40, Math.floor(rozpocet / Math.max(1, w * h))));
}

/** Rozumná pracovní velikost: delší strana nejvýš max (omezení plátna a paměti). */
function pracovniVelikost(w, h, max = 8192) {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)), zmenseno: k < 1 };
}

const API = {
  PRUMER, ODCHYLKA, prevzorkuj, tenzor, normalizujMasku, prevzorkujMasku, boxFiltr, zjemniPodleObrazu, urovne,
  ycc, rgbZYcc, hexNaRgb, rgbNaHex, chromaKlic, odstranPresvit, hulka, pouzijVyber, vzdalenosti, posunHranu, rozmaz,
  vycistiOstrovy, ohraniceni, vystupniObdelnik, stetec, tah, sjednot, hloubkaHistorie, pracovniVelikost,
};
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else koren.POZADI = API;
})(typeof window !== 'undefined' ? window : globalThis);

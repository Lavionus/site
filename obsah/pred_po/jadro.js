/* Porovnání před a po – jádro bez DOM (test: _test/pred_po_test.js).
   Obrázek = { sirka, vyska, data: Uint8ClampedArray RGBA }.
   Transformace = [a, b, c, d, e, f] jako canvas setTransform: x' = a·x + c·y + e, y' = b·x + d·y + f.
   Zarovnání mapuje souřadnice obrázku B do rámu obrázku A.
   Obsah: transformace z párů bodů (posun / podobnost / afinní, nejmenší čtverce), skládání
   a inverze, společná plocha (největší osový obdélník v průniku), rozdíl |A−B|, heat-mapa,
   MSE/PSNR/SSIM, odhad posunu pyramidou, poloha posuvníku v animaci, vložitelný HTML kód. */
(function () {
  'use strict';

  const JEDNOTKOVA = [1, 0, 0, 1, 0, 0];

  // ---------- transformace ----------
  function pouzij(M, x, y) { return { x: M[0] * x + M[2] * y + M[4], y: M[1] * x + M[3] * y + M[5] }; }

  /* M1 ∘ M2 – nejdřív M2, potom M1 */
  function slozit(M1, M2) {
    return [
      M1[0] * M2[0] + M1[2] * M2[1], M1[1] * M2[0] + M1[3] * M2[1],
      M1[0] * M2[2] + M1[2] * M2[3], M1[1] * M2[2] + M1[3] * M2[3],
      M1[0] * M2[4] + M1[2] * M2[5] + M1[4], M1[1] * M2[4] + M1[3] * M2[5] + M1[5]
    ];
  }

  function inverze(M) {
    const det = M[0] * M[3] - M[1] * M[2];
    if (Math.abs(det) < 1e-12) return null;
    const a = M[3] / det, b = -M[1] / det, c = -M[2] / det, d = M[0] / det;
    return [a, b, c, d, -(a * M[4] + c * M[5]), -(b * M[4] + d * M[5])];
  }

  /* Výchozí umístění B do rámu A: 'natahnout' (na celou plochu A) nebo 'vejit' (zachovat poměr, na střed). */
  function zakladni(wA, hA, wB, hB, zpusob) {
    if (zpusob === 'vejit') {
      const s = Math.min(wA / wB, hA / hB);
      return [s, 0, 0, s, (wA - wB * s) / 2, (hA - hB * s) / 2];
    }
    return [wA / wB, 0, 0, hA / hB, 0, 0];
  }

  /* Ruční doladění v rámu A kolem bodu (cx, cy): posun dx/dy, měřítko s, otočení ve stupních. */
  function doladeni(cx, cy, dx, dy, s, uhel) {
    const r = (uhel || 0) * Math.PI / 180, k = Math.cos(r) * (s || 1), n = Math.sin(r) * (s || 1);
    // T(c + d) · R·S · T(−c)
    return [k, n, -n, k, cx + (dx || 0) - (k * cx - n * cy), cy + (dy || 0) - (n * cx + k * cy)];
  }

  function teziste(body, klic) {
    let x = 0, y = 0;
    for (const p of body) { x += p[klic].x; y += p[klic].y; }
    return { x: x / body.length, y: y / body.length };
  }

  /* Páry bodů [{a:{x,y}, b:{x,y}}] → transformace B → A.
     model: 'posun' (≥1 pár), 'podobnost' (≥2: posun, měřítko, otočení), 'afinni' (≥3), 'auto'
     (podle počtu párů: 1 → posun, 2 → podobnost, 3+ → afinní). Vrací {M, model, chyby[], rms} nebo null. */
  function zBodu(pary, model) {
    const P = (pary || []).filter(p => p && p.a && p.b);
    if (!P.length) return null;
    if (!model || model === 'auto') model = P.length >= 3 ? 'afinni' : P.length === 2 ? 'podobnost' : 'posun';
    const ca = teziste(P, 'a'), cb = teziste(P, 'b');
    let M = null;
    if (model === 'posun') M = [1, 0, 0, 1, ca.x - cb.x, ca.y - cb.y];
    else if (model === 'podobnost') {
      if (P.length < 2) return null;
      let sxx = 0, sk = 0, sn = 0;
      for (const p of P) {
        const px = p.b.x - cb.x, py = p.b.y - cb.y, qx = p.a.x - ca.x, qy = p.a.y - ca.y;
        sxx += px * px + py * py; sk += px * qx + py * qy; sn += px * qy - py * qx;
      }
      if (sxx < 1e-9) return null;
      const k = sk / sxx, n = sn / sxx;
      M = [k, n, -n, k, ca.x - (k * cb.x - n * cb.y), ca.y - (n * cb.x + k * cb.y)];
    } else if (model === 'afinni') {
      if (P.length < 3) return null;
      // normální rovnice v centrovaných souřadnicích: [sxx sxy; sxy syy]·[a c] = [sxX syX]
      let sxx = 0, sxy = 0, syy = 0, sxX = 0, syX = 0, sxY = 0, syY = 0;
      for (const p of P) {
        const x = p.b.x - cb.x, y = p.b.y - cb.y, X = p.a.x - ca.x, Y = p.a.y - ca.y;
        sxx += x * x; sxy += x * y; syy += y * y; sxX += x * X; syX += y * X; sxY += x * Y; syY += y * Y;
      }
      const det = sxx * syy - sxy * sxy;
      if (Math.abs(det) < 1e-9 * Math.max(1, sxx * syy)) return null;   // body na přímce
      const a = (sxX * syy - syX * sxy) / det, c = (syX * sxx - sxX * sxy) / det;
      const b = (sxY * syy - syY * sxy) / det, d = (syY * sxx - sxY * sxy) / det;
      M = [a, b, c, d, ca.x - (a * cb.x + c * cb.y), ca.y - (b * cb.x + d * cb.y)];
    } else return null;
    const chyby = P.map(p => { const q = pouzij(M, p.b.x, p.b.y); return Math.hypot(q.x - p.a.x, q.y - p.a.y); });
    const rms = Math.sqrt(chyby.reduce((s, e) => s + e * e, 0) / chyby.length);
    return { M, model, chyby, rms };
  }

  /* Rozklad na srozumitelné hodnoty (pro podobnost přesný, u afinní průměrné měřítko). */
  function popis(M) {
    const sx = Math.hypot(M[0], M[1]), sy = Math.hypot(M[2], M[3]);
    return { posunX: M[4], posunY: M[5], meritko: Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2])), sx, sy,
      uhel: Math.atan2(M[1], M[0]) * 180 / Math.PI };
  }

  // ---------- společná plocha ----------
  /* Ořízne konvexní mnohoúhelník obdélníkem [0,w]×[0,h] (Sutherland–Hodgman). */
  function orizni(poly, w, h) {
    const hrany = [
      [p => p.x >= 0, (p, q) => ({ x: 0, y: p.y + (q.y - p.y) * (0 - p.x) / (q.x - p.x) })],
      [p => p.x <= w, (p, q) => ({ x: w, y: p.y + (q.y - p.y) * (w - p.x) / (q.x - p.x) })],
      [p => p.y >= 0, (p, q) => ({ x: p.x + (q.x - p.x) * (0 - p.y) / (q.y - p.y), y: 0 })],
      [p => p.y <= h, (p, q) => ({ x: p.x + (q.x - p.x) * (h - p.y) / (q.y - p.y), y: h })]
    ];
    let out = poly;
    for (const [uvnitr, prusecik] of hrany) {
      const vst = out; out = [];
      for (let i = 0; i < vst.length; i++) {
        const p = vst[i], q = vst[(i + 1) % vst.length];
        if (uvnitr(q)) { if (!uvnitr(p)) out.push(prusecik(p, q)); out.push(q); }
        else if (uvnitr(p)) out.push(prusecik(p, q));
      }
      if (!out.length) return [];
    }
    return out;
  }

  /* Rozsah x konvexního mnohoúhelníku na vodorovné přímce y. */
  function rozsahX(poly, y) {
    let L = Infinity, R = -Infinity;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const y0 = Math.min(p.y, q.y), y1 = Math.max(p.y, q.y);
      if (y < y0 - 1e-9 || y > y1 + 1e-9) continue;
      if (Math.abs(q.y - p.y) < 1e-12) { L = Math.min(L, p.x, q.x); R = Math.max(R, p.x, q.x); continue; }
      const x = p.x + (q.x - p.x) * (y - p.y) / (q.y - p.y);
      L = Math.min(L, x); R = Math.max(R, x);
    }
    return [L, R];
  }

  /* Největší osový obdélník v průniku rámu A (wA×hA) a obrázku B (wB×hB) převedeného přes M.
     U konvexního mnohoúhelníku stačí pro pás [y0,y1] okraje na jeho hranách. Vrací celá čísla {x,y,w,h} nebo null. */
  function spolecnaPlocha(M, wA, hA, wB, hB) {
    const roh = [[0, 0], [wB, 0], [wB, hB], [0, hB]].map(([x, y]) => pouzij(M, x, y));
    const poly = orizni(roh, wA, hA);
    if (poly.length < 3) return null;
    let ymin = Infinity, ymax = -Infinity;
    for (const p of poly) { ymin = Math.min(ymin, p.y); ymax = Math.max(ymax, p.y); }
    const plocha = (y0, y1) => {
      if (y1 <= y0) return null;
      const r0 = rozsahX(poly, y0), r1 = rozsahX(poly, y1);
      const L = Math.max(r0[0], r1[0]), R = Math.min(r0[1], r1[1]);
      return R > L ? { x: L, y: y0, w: R - L, h: y1 - y0, s: (R - L) * (y1 - y0) } : null;
    };
    const N = 80, krok = (ymax - ymin) / N;
    let nej = null;
    for (let i = 0; i <= N; i++) for (let j = i + 1; j <= N; j++) {
      const r = plocha(ymin + i * krok, ymin + j * krok);
      if (r && (!nej || r.s > nej.s)) nej = r;
    }
    if (!nej) return null;
    // zjemnění kolem nejlepšího pásu
    for (let k = krok / 2; k > 0.05; k /= 2) {
      let zlepseno = true;
      while (zlepseno) {
        zlepseno = false;
        for (const [d0, d1] of [[-k, 0], [k, 0], [0, -k], [0, k], [-k, k], [k, -k], [k, k], [-k, -k]]) {
          const y0 = Math.max(ymin, nej.y + d0), y1 = Math.min(ymax, nej.y + nej.h + d1);
          const r = plocha(y0, y1);
          if (r && r.s > nej.s + 1e-9) { nej = r; zlepseno = true; }
        }
      }
    }
    const x0 = Math.ceil(nej.x - 1e-6), y0 = Math.ceil(nej.y - 1e-6);
    const x1 = Math.floor(nej.x + nej.w + 1e-6), y1 = Math.floor(nej.y + nej.h + 1e-6);
    if (x1 - x0 < 1 || y1 - y0 < 1) return null;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  // ---------- rozdíl a metriky ----------
  function jas(data) {
    const n = data.length >> 2, l = new Float32Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) l[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
    return l;
  }

  /* Maska platných pixelů: oba obrázky neprůhledné (B po převodu nemusí pokrýt celý rám). */
  function maska(A, B) {
    const n = A.sirka * A.vyska, m = new Uint8Array(n);
    for (let i = 0; i < n; i++) m[i] = A.data[i * 4 + 3] > 250 && B.data[i * 4 + 3] > 250 ? 1 : 0;
    return m;
  }

  function mse(A, B, m) {
    let s = 0, n = 0;
    const a = A.data, b = B.data;
    for (let i = 0, j = 0; j < a.length; i++, j += 4) {
      if (m && !m[i]) continue;
      const r = a[j] - b[j], g = a[j + 1] - b[j + 1], c = a[j + 2] - b[j + 2];
      s += r * r + g * g + c * c; n += 3;
    }
    return n ? s / n : NaN;
  }

  function psnr(hodnotaMse) { return hodnotaMse > 0 ? 10 * Math.log10(255 * 255 / hodnotaMse) : Infinity; }

  /* Gaussovo rozmazání (σ = 1,5, okno 11), okraje zrcadlením. */
  const GAUSS = (() => { const k = []; let s = 0; for (let i = -5; i <= 5; i++) { const v = Math.exp(-i * i / 4.5); k.push(v); s += v; } return k.map(v => v / s); })();
  function rozmaz(src, w, h) {
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    const odraz = (i, n) => i < 0 ? -i - 1 : i >= n ? 2 * n - i - 1 : i;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0; for (let k = -5; k <= 5; k++) s += GAUSS[k + 5] * src[y * w + odraz(Math.min(Math.max(x + k, -w), 2 * w - 1), w)];
      tmp[y * w + x] = s;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0; for (let k = -5; k <= 5; k++) s += GAUSS[k + 5] * tmp[odraz(Math.min(Math.max(y + k, -h), 2 * h - 1), h) * w + x];
      out[y * w + x] = s;
    }
    return out;
  }

  /* SSIM (Wang a kol. 2004) na jasu, gaussovské okno; vrací průměr přes masku a mapu hodnot. */
  function ssim(A, B, m) {
    const w = A.sirka, h = A.vyska, x = jas(A.data), y = jas(B.data), n = w * h;
    const xx = new Float32Array(n), yy = new Float32Array(n), xy = new Float32Array(n);
    for (let i = 0; i < n; i++) { xx[i] = x[i] * x[i]; yy[i] = y[i] * y[i]; xy[i] = x[i] * y[i]; }
    const mx = rozmaz(x, w, h), my = rozmaz(y, w, h), sxx = rozmaz(xx, w, h), syy = rozmaz(yy, w, h), sxy = rozmaz(xy, w, h);
    const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2, mapa = new Float32Array(n);
    let s = 0, pocet = 0;
    for (let i = 0; i < n; i++) {
      const vx = sxx[i] - mx[i] * mx[i], vy = syy[i] - my[i] * my[i], cv = sxy[i] - mx[i] * my[i];
      const v = ((2 * mx[i] * my[i] + C1) * (2 * cv + C2)) / ((mx[i] * mx[i] + my[i] * my[i] + C1) * (vx + vy + C2));
      mapa[i] = v;
      if (!m || m[i]) { s += v; pocet++; }
    }
    return { prumer: pocet ? s / pocet : NaN, mapa };
  }

  /* Barevná škála heat-mapy (tmavá → fialová → oranžová → světle žlutá), t ∈ 0..1. */
  const SKALA = [[0, 0, 4], [87, 16, 110], [188, 55, 84], [249, 142, 9], [252, 255, 164]];
  function barvaSkaly(t) {
    t = Math.max(0, Math.min(1, t)) * (SKALA.length - 1);
    const i = Math.min(SKALA.length - 2, Math.floor(t)), f = t - i, a = SKALA[i], b = SKALA[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }

  /* Obrázek rozdílu. rezim: 'abs' (|A−B| po kanálech), 'heat' (největší rozdíl kanálu → škála),
     'zmeny' (šedé A, změny nad prahem červeně). zesileni násobí rozdíl, prah 0–255.
     Vrací {obr, zmeneno (podíl pixelů nad prahem v masce), nejvetsi}. */
  function rozdil(A, B, o) {
    o = Object.assign({ rezim: 'abs', zesileni: 1, prah: 24, maska: null }, o);
    const w = A.sirka, h = A.vyska, a = A.data, b = B.data, out = new Uint8ClampedArray(w * h * 4);
    let zmeneno = 0, platnych = 0, nejvetsi = 0;
    for (let i = 0, j = 0; i < w * h; i++, j += 4) {
      if (o.maska && !o.maska[i]) continue;   // průhledné = mimo společnou plochu
      const dr = Math.abs(a[j] - b[j]), dg = Math.abs(a[j + 1] - b[j + 1]), db = Math.abs(a[j + 2] - b[j + 2]);
      const d = Math.max(dr, dg, db);
      platnych++;
      if (d > o.prah) zmeneno++;
      if (d > nejvetsi) nejvetsi = d;
      if (o.rezim === 'heat') {
        const c = barvaSkaly(d * o.zesileni / 255);
        out[j] = c[0]; out[j + 1] = c[1]; out[j + 2] = c[2];
      } else if (o.rezim === 'zmeny') {
        const l = (0.299 * a[j] + 0.587 * a[j + 1] + 0.114 * a[j + 2]) * 0.55 + 40;
        if (d > o.prah) { out[j] = 255; out[j + 1] = l * 0.25; out[j + 2] = l * 0.25; }
        else { out[j] = l; out[j + 1] = l; out[j + 2] = l; }
      } else {
        out[j] = dr * o.zesileni; out[j + 1] = dg * o.zesileni; out[j + 2] = db * o.zesileni;
      }
      out[j + 3] = 255;
    }
    return { obr: { sirka: w, vyska: h, data: out }, zmeneno: platnych ? zmeneno / platnych : 0, nejvetsi };
  }

  /* Mapa SSIM jako obrázek: 1 = shoda (tmavá), ≤ 0 = odlišné (světlá). */
  function obrazSsim(mapa, w, h, m) {
    const out = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      if (m && !m[i]) continue;
      const c = barvaSkaly(1 - Math.max(0, mapa[i]));
      out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255;
    }
    return { sirka: w, vyska: h, data: out };
  }

  /* Všechny metriky najednou (na zmenšených obrázcích stejné velikosti). */
  function metriky(A, B, prah) {
    const m = maska(A, B);
    let platnych = 0; for (let i = 0; i < m.length; i++) platnych += m[i];
    const e = mse(A, B, m), s = ssim(A, B, m), r = rozdil(A, B, { prah: prah == null ? 24 : prah, maska: m });
    return { mse: e, psnr: psnr(e), ssim: s.prumer, ssimMapa: s.mapa, zmeneno: r.zmeneno, pokryti: platnych / m.length, maska: m };
  }

  // ---------- automatický odhad posunu ----------
  function zmensi2(l, m, w, h) {
    const W = w >> 1, H = h >> 1, o = new Float32Array(W * H), om = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = 2 * y * w + 2 * x;
      o[y * W + x] = (l[i] + l[i + 1] + l[i + w] + l[i + w + 1]) / 4;
      om[y * W + x] = m[i] & m[i + 1] & m[i + w] & m[i + w + 1];
    }
    return { l: o, m: om, w: W, h: H };
  }

  /* Velikost gradientu – citlivá na hrany, necitlivá na rozdílnou expozici starých a nových fotek. */
  function gradient(l, w, h) {
    const g = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      g[i] = Math.abs(l[i + 1] - l[i - 1]) + Math.abs(l[i + w] - l[i - w]);
    }
    return g;
  }

  function chybaPosunu(ga, gb, ma, mb, w, h, dx, dy) {
    let s = 0, n = 0;
    for (let y = 1; y < h - 1; y++) {
      const yb = y - dy; if (yb < 1 || yb >= h - 1) continue;
      for (let x = 1; x < w - 1; x++) {
        const xb = x - dx; if (xb < 1 || xb >= w - 1) continue;
        const i = y * w + x, j = yb * w + xb;
        if (!ma[i] || !mb[j]) continue;
        s += Math.abs(ga[i] - gb[j]); n++;
      }
    }
    return n > w * h * 0.3 ? s / n : Infinity;
  }

  /* Posun (dx, dy) v pixelech, o který je třeba posunout B, aby lícoval s A. la, lb = jas stejně velkých
     obrázků, ma, mb = masky platnosti (nepovinné). Pyramida: hrubé hledání ±rozsah na nejmenší úrovni,
     pak ±2 px na každé jemnější. */
  function odhadPosunu(la, lb, w, h, o) {
    o = Object.assign({ rozsah: 10, min: 48 }, o);
    const plna = new Uint8Array(w * h).fill(1);
    let urovne = [{ a: la, b: lb, ma: o.ma || plna, mb: o.mb || plna, w, h }];
    while (Math.min(urovne[0].w, urovne[0].h) >= o.min * 2) {
      const u = urovne[0], A = zmensi2(u.a, u.ma, u.w, u.h), B = zmensi2(u.b, u.mb, u.w, u.h);
      urovne.unshift({ a: A.l, b: B.l, ma: A.m, mb: B.m, w: A.w, h: A.h });
    }
    let dx = 0, dy = 0;
    urovne.forEach((u, k) => {
      const ga = gradient(u.a, u.w, u.h), gb = gradient(u.b, u.w, u.h);
      if (k > 0) { dx *= 2; dy *= 2; }
      const r = k === 0 ? o.rozsah : 2;
      let nej = Infinity, bx = dx, by = dy;
      for (let y = dy - r; y <= dy + r; y++) for (let x = dx - r; x <= dx + r; x++) {
        const c = chybaPosunu(ga, gb, u.ma, u.mb, u.w, u.h, x, y);
        if (c < nej - 1e-9 || (Math.abs(c - nej) < 1e-9 && Math.hypot(x, y) < Math.hypot(bx, by))) { nej = c; bx = x; by = y; }
      }
      dx = bx; dy = by;
    });
    return { dx, dy };
  }

  // ---------- animace a export ----------
  /* Poloha posuvníku (0..1) v čase t pro cyklus délky T: začne uprostřed, plynule ke kraji a zpět.
     rozsah 0..1 = jak daleko ke krajům (1 = až na okraj). */
  function polohaAnimace(t, T, rozsah) {
    const r = rozsah == null ? 0.9 : rozsah;
    return 0.5 + 0.5 * r * Math.sin(2 * Math.PI * t / T);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  /* Samostatný vložitelný kód posuvníku (HTML + CSS + JS bez knihoven).
     o = {id, a, b (URL nebo data URL), sirka, vyska, popisA, popisB, smer: 'svisle'|'vodorovne', start 0..1, maxSirka} */
  function htmlPosuvnik(o) {
    const id = (o.id || 'pp' + Math.random().toString(36).slice(2, 8)).replace(/[^\w-]/g, '');
    const svisle = o.smer !== 'vodorovne', start = Math.round(Math.max(0, Math.min(1, o.start == null ? 0.5 : o.start)) * 1000) / 10;
    const S = '#' + id;
    const popisek = (t, kde) => t ? `<span class="pp-popis ${kde}">${esc(t)}</span>` : '';
    return `<div id="${id}" class="pp-obal" role="slider" tabindex="0" aria-label="${esc((o.popisA || 'A') + ' / ' + (o.popisB || 'B'))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${start}" style="--p:${start}%">
<style>
${S}{position:relative;max-width:${o.maxSirka ? o.maxSirka + 'px' : '100%'};aspect-ratio:${o.sirka}/${o.vyska};overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:${svisle ? 'pan-y' : 'pan-x'};cursor:${svisle ? 'ew-resize' : 'ns-resize'};background:#000;outline-offset:2px}
${S} img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;pointer-events:none;max-width:none}
${S} .pp-b{clip-path:inset(${svisle ? '0 0 0 var(--p)' : 'var(--p) 0 0 0'})}
${S} .pp-cara{position:absolute;${svisle ? 'top:0;bottom:0;left:var(--p);width:2px;margin-left:-1px' : 'left:0;right:0;top:var(--p);height:2px;margin-top:-1px'};background:#fff;box-shadow:0 0 3px rgba(0,0,0,.7)}
${S} .pp-uchyt{position:absolute;${svisle ? 'top:50%;left:var(--p)' : 'left:50%;top:var(--p)'};width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;background:rgba(0,0,0,.45);border:2px solid #fff;color:#fff;font:bold 16px/36px sans-serif;text-align:center;box-shadow:0 0 4px rgba(0,0,0,.6)}
${S} .pp-popis{position:absolute;top:8px;padding:3px 9px;border-radius:4px;background:rgba(0,0,0,.55);color:#fff;font:600 14px/1.3 system-ui,sans-serif;pointer-events:none}
${S} .pp-popis.a{${svisle ? 'left:8px' : 'left:8px;top:8px'}}
${S} .pp-popis.b{${svisle ? 'right:8px' : 'left:8px;top:auto;bottom:8px'}}
</style>
<img class="pp-a" src="${o.a}" alt="${esc(o.popisA || 'A')}">
<img class="pp-b" src="${o.b}" alt="${esc(o.popisB || 'B')}">
<div class="pp-cara"></div><div class="pp-uchyt" aria-hidden="true">${svisle ? '&#8596;' : '&#8597;'}</div>
${popisek(o.popisA, 'a')}${popisek(o.popisB, 'b')}
<script>(function(){var r=document.getElementById(${JSON.stringify(id)}),t=0,v=${svisle ? 'true' : 'false'};
function nastav(p){p=Math.max(0,Math.min(100,p));r.style.setProperty('--p',p+'%');r.setAttribute('aria-valuenow',Math.round(p));}
function z(e){var b=r.getBoundingClientRect();nastav(v?(e.clientX-b.left)/b.width*100:(e.clientY-b.top)/b.height*100);}
r.addEventListener('pointerdown',function(e){t=1;r.setPointerCapture(e.pointerId);z(e);});
r.addEventListener('pointermove',function(e){if(t)z(e);});
r.addEventListener('pointerup',function(){t=0;});r.addEventListener('pointercancel',function(){t=0;});
r.addEventListener('keydown',function(e){var p=parseFloat(r.getAttribute('aria-valuenow')),k=e.shiftKey?10:2;
if(e.key==='ArrowLeft'||e.key==='ArrowUp'){nastav(p-k);e.preventDefault();}else if(e.key==='ArrowRight'||e.key==='ArrowDown'){nastav(p+k);e.preventDefault();}
else if(e.key==='Home'){nastav(0);e.preventDefault();}else if(e.key==='End'){nastav(100);e.preventDefault();}});})();</` + `script>
</div>`;
  }

  function htmlDokument(fragment, titulek, jazyk) {
    return `<!DOCTYPE html>
<html lang="${esc(jazyk || 'cs')}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulek || '')}</title>
<style>body{margin:0;padding:16px;background:#1b1b1b;font-family:system-ui,sans-serif}</style>
</head>
<body>
${fragment}
</body>
</html>
`;
  }

  /* Bezpečný název souboru z popisků. */
  function nazevSouboru(a, b, pripona) {
    const s = (String(a || '') + '_' + String(b || '')).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'porovnani';
    return s + '.' + pripona;
  }

  const api = {
    JEDNOTKOVA, pouzij, slozit, inverze, zakladni, doladeni, zBodu, popis,
    orizni, spolecnaPlocha,
    jas, maska, mse, psnr, ssim, rozdil, obrazSsim, barvaSkaly, metriky,
    odhadPosunu, polohaAnimace, esc, htmlPosuvnik, htmlDokument, nazevSouboru
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.PredPoJadro = api;
})();

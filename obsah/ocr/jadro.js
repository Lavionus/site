/* ============================================================
   ocr/jadro.js – jádro stránky OCR bez DOM (testuje se v node).
   Obraz = objekt ve tvaru ImageData: { data: RGBA pole, width, height }.
   Předzpracování (otočení, ořez, zvětšení, šedá, kontrast, odšumění,
   prahování Otsu/Sauvola), odhad sklonu, rozsahy stránek, pořadí oblastí,
   skládání textu ze slov Tesseractu a neviditelná textová vrstva PDF.
   ============================================================ */
(function (koren) {
  'use strict';

  const novy = (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
  const kopie = img => ({ data: new Uint8ClampedArray(img.data), width: img.width, height: img.height });
  const omez = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---------- geometrie ----------
  // otočení o násobky 90° po směru hodinových ručiček
  function otoc90(img, kroky) {
    const k = ((kroky % 4) + 4) % 4;
    if (!k) return img;
    const { width: w, height: h, data: s } = img;
    const nw = k === 2 ? w : h, nh = k === 2 ? h : w, o = novy(nw, nh), d = o.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let nx, ny;
      if (k === 1) { nx = h - 1 - y; ny = x; } else if (k === 2) { nx = w - 1 - x; ny = h - 1 - y; } else { nx = y; ny = w - 1 - x; }
      const i = (y * w + x) * 4, j = (ny * nw + nx) * 4;
      d[j] = s[i]; d[j + 1] = s[i + 1]; d[j + 2] = s[i + 2]; d[j + 3] = s[i + 3];
    }
    return o;
  }

  // bilineární vzorek (mimo obraz = bílá)
  function vzorek(s, w, h, x, y, kanal) {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const px = (xx, yy) => (xx < 0 || yy < 0 || xx >= w || yy >= h ? 255 : s[(yy * w + xx) * 4 + kanal]);
    const a = px(x0, y0), b = px(x0 + 1, y0), c = px(x0, y0 + 1), d = px(x0 + 1, y0 + 1);
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }

  // otočení o libovolný úhel ve stupních (kladný = po směru hodin na obrazovce), plátno se zvětší, rohy bílé
  function otoc(img, stupne) {
    if (!stupne || Math.abs(stupne) < 0.01) return img;
    const r = stupne * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    const { width: w, height: h, data: src } = img;
    const nw = Math.ceil(Math.abs(w * c) + Math.abs(h * s)), nh = Math.ceil(Math.abs(w * s) + Math.abs(h * c));
    const o = novy(nw, nh), d = o.data, cx = w / 2, cy = h / 2, ncx = nw / 2, ncy = nh / 2;
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      // zpětné zobrazení: bod výstupu otočit o -úhel
      const dx = x + 0.5 - ncx, dy = y + 0.5 - ncy;
      const sx = c * dx + s * dy + cx - 0.5, sy = -s * dx + c * dy + cy - 0.5;
      const j = (y * nw + x) * 4;
      for (let k = 0; k < 3; k++) d[j + k] = vzorek(src, w, h, sx, sy, k);
      d[j + 3] = 255;
    }
    return o;
  }

  // ořez podle normalizovaného obdélníku {x, y, w, h} (0–1)
  function orez(img, r) {
    if (!r) return img;
    const x0 = omez(Math.round(r.x * img.width), 0, img.width - 1), y0 = omez(Math.round(r.y * img.height), 0, img.height - 1);
    const w = omez(Math.round(r.w * img.width), 1, img.width - x0), h = omez(Math.round(r.h * img.height), 1, img.height - y0);
    const o = novy(w, h);
    for (let y = 0; y < h; y++) o.data.set(img.data.subarray(((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x0 + w) * 4), y * w * 4);
    return o;
  }

  // změna velikosti (bilineárně; při zmenšení průměr z bloku, aby se neztratily tenké tahy)
  function zmenVelikost(img, k) {
    if (Math.abs(k - 1) < 1e-3) return img;
    const { width: w, height: h, data: s } = img;
    const nw = Math.max(1, Math.round(w * k)), nh = Math.max(1, Math.round(h * k)), o = novy(nw, nh), d = o.data;
    if (k < 1) {
      for (let y = 0; y < nh; y++) {
        const ya = Math.floor(y / k), yb = Math.max(ya + 1, Math.min(h, Math.floor((y + 1) / k)));
        for (let x = 0; x < nw; x++) {
          const xa = Math.floor(x / k), xb = Math.max(xa + 1, Math.min(w, Math.floor((x + 1) / k)));
          let r = 0, g = 0, b = 0, n = 0;
          for (let yy = ya; yy < yb; yy++) for (let xx = xa; xx < xb; xx++) { const i = (yy * w + xx) * 4; r += s[i]; g += s[i + 1]; b += s[i + 2]; n++; }
          const j = (y * nw + x) * 4; d[j] = r / n; d[j + 1] = g / n; d[j + 2] = b / n; d[j + 3] = 255;
        }
      }
      return o;
    }
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const sx = (x + 0.5) / k - 0.5, sy = (y + 0.5) / k - 0.5, j = (y * nw + x) * 4;
      const cx = omez(sx, 0, w - 1), cy = omez(sy, 0, h - 1);
      for (let c = 0; c < 3; c++) d[j + c] = vzorek(s, w, h, cx, cy, c);
      d[j + 3] = 255;
    }
    return o;
  }

  // ---------- barvy a jas ----------
  function seda(img) {
    const p = img.data;
    for (let i = 0; i < p.length; i += 4) { const g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; p[i] = p[i + 1] = p[i + 2] = g; p[i + 3] = 255; }
    return img;
  }
  function histogram(img) {
    const hist = new Uint32Array(256), p = img.data;
    for (let i = 0; i < p.length; i += 4) hist[p[i]]++;
    return hist;
  }
  // automatické vyrovnání úrovní: 1. a 99. percentil → 0 a 255
  function autoKontrast(img, okraj = 0.01) {
    const hist = histogram(img), n = img.width * img.height;
    let lo = 0, hi = 255, s = 0;
    for (; lo < 255; lo++) { s += hist[lo]; if (s > n * okraj) break; }
    s = 0;
    for (; hi > 0; hi--) { s += hist[hi]; if (s > n * okraj) break; }
    if (hi - lo < 8) return img;
    const p = img.data, f = 255 / (hi - lo);
    for (let i = 0; i < p.length; i += 4) for (let c = 0; c < 3; c++) p[i + c] = (p[i + c] - lo) * f;
    return img;
  }
  // kontrast a jas v rozsahu −100…100
  function kontrast(img, k, jas) {
    if (!k && !jas) return img;
    const c = omez(k, -100, 100) * 2.55, f = (259 * (c + 255)) / (255 * (259 - c)), j = (jas || 0) * 2.55, p = img.data;
    for (let i = 0; i < p.length; i += 4) for (let q = 0; q < 3; q++) p[i + q] = (p[i + q] - 128) * f + 128 + j;
    return img;
  }
  function invertuj(img) {
    const p = img.data;
    for (let i = 0; i < p.length; i += 4) { p[i] = 255 - p[i]; p[i + 1] = 255 - p[i + 1]; p[i + 2] = 255 - p[i + 2]; }
    return img;
  }

  // ---------- odšumění ----------
  // medián 3×3 nad šedým kanálem (odstraní zrnění i osamělé tečky po prahování)
  function median3(img) {
    const { width: w, height: h, data: s } = img, o = kopie(img), d = o.data, okno = new Uint8Array(9);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = omez(y + dy, 0, h - 1);
        for (let dx = -1; dx <= 1; dx++) okno[n++] = s[(yy * w + omez(x + dx, 0, w - 1)) * 4];
      }
      okno.sort();
      const j = (y * w + x) * 4; d[j] = d[j + 1] = d[j + 2] = okno[4];
    }
    return o;
  }

  // ---------- prahování ----------
  function otsuPrah(hist) {
    let n = 0, suma = 0;
    for (let i = 0; i < 256; i++) { n += hist[i]; suma += i * hist[i]; }
    let sB = 0, wB = 0, prah = 127, nej = -1;
    for (let i = 0; i < 256; i++) {
      wB += hist[i]; if (!wB) continue;
      const wF = n - wB; if (!wF) break;
      sB += i * hist[i];
      const mB = sB / wB, mF = (suma - sB) / wF, mezi = wB * wF * (mB - mF) * (mB - mF);
      if (mezi > nej) { nej = mezi; prah = i; }
    }
    return prah;
  }
  // po prahování převládá-li černá, jde o světlý text na tmavém – otočit, Tesseract chce tmavé na světlém
  function srovnejPozadi(img) {
    const p = img.data; let cerne = 0;
    for (let i = 0; i < p.length; i += 4) if (p[i] < 128) cerne++;
    return cerne > img.width * img.height / 2 ? invertuj(img) : img;
  }
  function prahOtsu(img, prah) {
    const t = prah == null ? otsuPrah(histogram(img)) : prah, p = img.data;
    for (let i = 0; i < p.length; i += 4) { const v = p[i] > t ? 255 : 0; p[i] = p[i + 1] = p[i + 2] = v; }
    return img;
  }
  // Sauvola přes integrální obrazy: práh = m · (1 + k · (s / 128 − 1)), okno ve px (liché)
  function prahAdaptivni(img, okno, k = 0.34) {
    const { width: w, height: h, data: p } = img, W = w + 1;
    const S = new Float64Array(W * (h + 1)), Q = new Float64Array(W * (h + 1));
    for (let y = 0; y < h; y++) {
      let rs = 0, rq = 0;
      for (let x = 0; x < w; x++) {
        const v = p[(y * w + x) * 4]; rs += v; rq += v * v;
        S[(y + 1) * W + x + 1] = S[y * W + x + 1] + rs; Q[(y + 1) * W + x + 1] = Q[y * W + x + 1] + rq;
      }
    }
    const r = Math.max(1, Math.floor(okno / 2));
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), n = (x1 - x0) * (y1 - y0);
        const sum = S[y1 * W + x1] - S[y0 * W + x1] - S[y1 * W + x0] + S[y0 * W + x0];
        const sq = Q[y1 * W + x1] - Q[y0 * W + x1] - Q[y1 * W + x0] + Q[y0 * W + x0];
        const m = sum / n, sd = Math.sqrt(Math.max(0, sq / n - m * m));
        const i = (y * w + x) * 4, v = p[i] > m * (1 + k * (sd / 128 - 1)) ? 255 : 0;
        p[i] = p[i + 1] = p[i + 2] = v;
      }
    }
    return img;
  }

  // ---------- odhad sklonu ----------
  // řádky textu dávají v promítnutí podél správného úhlu nejostřejší profil (součet čtverců přihrádek)
  function skoreUhlu(bin, w, h, a) {
    const tg = Math.tan(a * Math.PI / 180), posun = Math.ceil(Math.abs(tg) * w) + 1, bins = new Float64Array(h + 2 * posun + 2);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bin[y * w + x]) bins[Math.round(y - x * tg) + posun]++;
    let s = 0; for (let i = 0; i < bins.length; i++) s += bins[i] * bins[i];
    return s;
  }
  // vrací úhel řádků ve stupních (kladný = řádky klesají doprava); narovná se otoc(img, -uhel)
  function odhadSklonu(img, rozsah = 15) {
    const k = Math.min(1, 700 / Math.max(img.width, img.height));
    const m = seda(k < 1 ? zmenVelikost(img, k) : kopie(img)), w = m.width, h = m.height;
    const t = otsuPrah(histogram(m)), bin = new Uint8Array(w * h);
    let cerne = 0;
    for (let i = 0; i < bin.length; i++) if (m.data[i * 4] <= t) { bin[i] = 1; cerne++; }
    if (cerne > bin.length / 2) for (let i = 0; i < bin.length; i++) bin[i] ^= 1;
    if (!cerne || cerne === bin.length) return 0;
    let nej = 0, nejS = -1;
    for (let a = -rozsah; a <= rozsah + 1e-9; a += 0.5) { const s = skoreUhlu(bin, w, h, a); if (s > nejS) { nejS = s; nej = a; } }
    const hrubý = nej;
    for (let a = hrubý - 0.5; a <= hrubý + 0.5 + 1e-9; a += 0.1) { const s = skoreUhlu(bin, w, h, a); if (s > nejS) { nejS = s; nej = a; } }
    return Math.round(nej * 10) / 10;
  }

  // ---------- celý řetězec ----------
  const VYCHOZI = {
    zvetseni: 'auto',   // 'auto' | číslo
    seda: true, autoKontrast: true, kontrast: 0, jas: 0,
    odsum: 0,           // počet průchodů mediánu 0–2
    prah: 'adaptivni',  // 'zadny' | 'otsu' | 'adaptivni'
    okno: 2.5,          // okno adaptivního prahu v % kratší strany
    citlivost: 0.34,    // k Sauvoly
    invertovat: false,
  };
  // automatické zvětšení: delší strana aspoň 2000 px, nejvýš 3×
  function koefZvetseni(nast, w, h) {
    if (nast.zvetseni !== 'auto') return Math.max(0.25, Number(nast.zvetseni) || 1);
    const d = Math.max(w, h);
    return d >= 2000 ? 1 : Math.min(3, 2000 / d);
  }
  // geometrie stránky: otočení o 90°, jemné otočení, ořez (bez ořezu pro režim ořezávání)
  function geometrie(img, g, bezOrezu) {
    let o = otoc(otoc90(img, g.otoceni90 || 0), g.uhel || 0);
    if (!bezOrezu && g.orez) o = orez(o, g.orez);
    return o;
  }
  // filtry pro OCR; meritko = kolikrát je obraz menší než plné rozlišení (náhled) → zvětšení se vynechá
  function filtry(img, nastaveni, nahled) {
    const n = Object.assign({}, VYCHOZI, nastaveni);
    let o = kopie(img), k = 1;
    if (!nahled) { k = koefZvetseni(n, o.width, o.height); o = zmenVelikost(o, k); }
    if (n.seda || n.prah !== 'zadny') seda(o);
    if (n.autoKontrast) autoKontrast(o);
    kontrast(o, n.kontrast, n.jas);
    for (let i = 0; i < (n.odsum | 0); i++) o = median3(o);
    if (n.prah === 'otsu') srovnejPozadi(prahOtsu(o));
    else if (n.prah === 'adaptivni') {
      const okno = Math.max(5, Math.round(Math.min(o.width, o.height) * n.okno / 100)) | 1;
      if (svetlyText(o, okno)) invertuj(o);   // Sauvola chce tmavý text na světlém
      prahAdaptivni(o, okno, n.citlivost);
    }
    if (n.invertovat) invertuj(o);
    return { obraz: o, zvetseni: k };
  }
  // polarita odolná vůči stínům: počítá body výrazně tmavší / světlejší než místní průměr okolí
  // (tahy písma jsou menšina, tedy odchylky jedním směrem); true = světlý text na tmavém
  // práh odchylky = 30 % rozpětí jasů (0,5.–99,5. percentil), aby se nepočítalo okolí tahů ani šum
  function svetlyText(img, okno) {
    const { width: w, height: h, data: p } = img, W = w + 1, S = new Float64Array(W * (h + 1));
    const hist = histogram(img), n = w * h;
    let lo = 0, hi = 255, a = 0;
    for (; lo < 255; lo++) { a += hist[lo]; if (a > n * 0.005) break; }
    a = 0;
    for (; hi > 0; hi--) { a += hist[hi]; if (a > n * 0.005) break; }
    const rozdil = Math.max(25, 0.3 * (hi - lo));
    for (let y = 0; y < h; y++) { let rs = 0; for (let x = 0; x < w; x++) { rs += p[(y * w + x) * 4]; S[(y + 1) * W + x + 1] = S[y * W + x + 1] + rs; } }
    const r = Math.max(1, Math.floor(okno / 2)), krok = Math.max(1, Math.floor(Math.sqrt(w * h / 250000)));
    let tm = 0, sv = 0;
    for (let y = 0; y < h; y += krok) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x += krok) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
        const m = (S[y1 * W + x1] - S[y0 * W + x1] - S[y1 * W + x0] + S[y0 * W + x0]) / ((x1 - x0) * (y1 - y0)), v = p[(y * w + x) * 4];
        if (v < m - rozdil) tm++; else if (v > m + rozdil) sv++;
      }
    }
    return sv > tm * 1.2;
  }

  // ---------- rozsahy stránek ----------
  // "1-3, 5, 8-" → [1,2,3,5,8,…,max]; prázdné / "vše" / "*" = všechny
  function parsujRozsah(text, max) {
    const t = String(text || '').trim().toLowerCase();
    if (!t || t === 'vše' || t === 'vse' || t === '*' || t === 'all') return Array.from({ length: max }, (_, i) => i + 1);
    const vys = [], videno = new Set();
    for (const cast of t.split(/[,;]+/)) {
      const c = cast.replace(/\s+/g, '');
      if (!c) continue;
      const m = c.match(/^(\d*)[-–](\d*)$/);
      let a, b;
      if (m) {
        a = m[1] ? +m[1] : 1; b = m[2] ? +m[2] : max;
        if (!m[1] && !m[2]) throw new Error('Neplatný úsek „' + cast.trim() + '“.');
      } else if (/^\d+$/.test(c)) a = b = +c;
      else throw new Error('Neplatný úsek „' + cast.trim() + '“ – použij např. 1-3, 5, 8-.');
      if (a < 1 || b < 1 || a > max || b > max) throw new Error('Stránka mimo rozsah 1–' + max + ' v „' + cast.trim() + '“.');
      const krok = a <= b ? 1 : -1;
      for (let i = a; krok > 0 ? i <= b : i >= b; i += krok) if (!videno.has(i)) { videno.add(i); vys.push(i); }
    }
    if (!vys.length) throw new Error('Rozsah neobsahuje žádnou stránku.');
    return vys;
  }

  // ---------- oblasti ----------
  // normalizovaný obdélník z tažení myší (libovolný směr), omezený na 0–1
  function obdelnik(x1, y1, x2, y2) {
    const a = omez(Math.min(x1, x2), 0, 1), b = omez(Math.min(y1, y2), 0, 1);
    return { x: a, y: b, w: omez(Math.max(x1, x2), 0, 1) - a, h: omez(Math.max(y1, y2), 0, 1) - b };
  }
  // pořadí čtení: 'radky' = shora dolů, v řádku zleva (oblasti se svislým překryvem tvoří řádek);
  // 'sloupce' = zleva doprava, ve sloupci shora (oblasti s vodorovným překryvem tvoří sloupec)
  function seradOblasti(oblasti, jak = 'radky') {
    const [p, q, dp, dq] = jak === 'sloupce' ? ['x', 'y', 'w', 'h'] : ['y', 'x', 'h', 'w'];
    const zbyva = oblasti.slice().sort((a, b) => a[p] - b[p]), vys = [];
    while (zbyva.length) {
      const prvni = zbyva.shift(), skup = [prvni];
      let konec = prvni[p] + prvni[dp];
      for (let i = 0; i < zbyva.length;) {
        const o = zbyva[i], prekryv = Math.min(konec, o[p] + o[dp]) - o[p];
        if (prekryv > Math.min(prvni[dp], o[dp]) * 0.5) { skup.push(o); zbyva.splice(i, 1); konec = Math.max(konec, o[p] + o[dp]); } else i++;
      }
      skup.sort((a, b) => a[q] - b[q]);
      vys.push(...skup);
    }
    return vys;
  }
  // obdélník oblasti v pixelech obrazu pro Tesseract (rectangle)
  function oblastPx(o, w, h) {
    const left = Math.round(o.x * w), top = Math.round(o.y * h);
    return { left, top, width: Math.max(1, Math.min(w - left, Math.round(o.w * w))), height: Math.max(1, Math.min(h - top, Math.round(o.h * h))) };
  }

  // ---------- text ze slov ----------
  // odstavce = [{ lines: [{ words: [{ text, confidence, bbox:{x0,y0,x1,y1} }] }] }] (struktura Tesseractu)
  // → { text, slova: [{ text, conf, bbox, od, do, radek }] }; odstavce oddělí prázdný řádek
  function slozText(odstavce, posunRadku = 0) {
    let text = '', radek = posunRadku;
    const slova = [];
    const plne = ws => (ws || []).filter(w => w && String(w.text || '').trim());
    (odstavce || []).map(od => (od.lines || []).map(ln => plne(ln.words)).filter(ws => ws.length)).filter(r => r.length).forEach((radky, io) => {
      if (io > 0) text += '\n\n';
      radky.forEach((ws, il) => {
        if (il > 0) text += '\n';
        ws.forEach((w, iw) => {
          if (iw > 0) text += ' ';
          const t = String(w.text).trim(), zac = text.length;
          text += t;
          slova.push({ text: t, conf: Math.round(w.confidence != null ? w.confidence : 100), bbox: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 }, od: zac, do: text.length, radek });
        });
        radek++;
      });
    });
    return { text, slova };
  }
  // spojí výsledky více oblastí (v pořadí čtení) do jednoho textu; posune odkazy slov
  function spojVysledky(casti) {
    let text = '', radek = 0;
    const slova = [];
    casti.forEach((c, i) => {
      if (!c || !c.text) return;
      if (text) text += '\n\n';
      const posun = text.length;
      let maxR = radek;
      c.slova.forEach(s => { slova.push(Object.assign({}, s, { od: s.od + posun, do: s.do + posun, radek: s.radek + radek })); maxR = Math.max(maxR, s.radek + radek + 1); });
      text += c.text; radek = maxR;
    });
    return { text, slova };
  }
  function statistika(slova, prah = 70) {
    if (!slova.length) return { pocet: 0, nizkych: 0, prumer: 0 };
    let s = 0, n = 0;
    for (const w of slova) { s += w.conf; if (w.conf < prah) n++; }
    return { pocet: slova.length, nizkych: n, prumer: Math.round(s / slova.length) };
  }
  // slovo pod bodem (souřadnice obrazu OCR); nejmenší zasažený obdélník
  function slovoNaBode(slova, x, y, tolerance = 0) {
    let nej = -1, plocha = Infinity;
    slova.forEach((w, i) => {
      const b = w.bbox;
      if (x >= b.x0 - tolerance && x <= b.x1 + tolerance && y >= b.y0 - tolerance && y <= b.y1 + tolerance) {
        const p = (b.x1 - b.x0) * (b.y1 - b.y0);
        if (p < plocha) { plocha = p; nej = i; }
      }
    });
    return nej;
  }
  // pozice slova v (možná upraveném) textu: nejbližší výskyt k původní pozici, jinak -1
  function najdiVTextu(text, slovo, odhad) {
    if (!slovo) return -1;
    let nej = -1, vzd = Infinity, i = text.indexOf(slovo);
    while (i >= 0) {
      const d = Math.abs(i - odhad);
      if (d < vzd) { vzd = d; nej = i; }
      if (i > odhad) break;
      i = text.indexOf(slovo, i + 1);
    }
    return nej;
  }

  // opravený text → slova s opravenými texty (pro textovou vrstvu PDF), jen když počet slov sedí; jinak null
  function prenesOpravy(text, slova) {
    const t = String(text || '').split(/\s+/).filter(Boolean);
    if (t.length !== slova.length) return null;
    return slova.map((s, i) => Object.assign({}, s, { text: t[i] }));
  }

  // ---------- textová vrstva PDF ----------
  // slova (px obrazu OCR, počátek vlevo nahoře) → položky v bodech PDF (počátek vlevo dole).
  // sirkaTextu(text, velikost) změří šířku v písmu PDF; meritkoX roztáhne slovo přesně na jeho šířku.
  // Ke slovu (kromě posledního v řádku) se připojí mezera, aby kopírovaný text měl mezery.
  function vrstvaTextu(slova, o) {
    const kx = o.sirkaStr / o.sirkaObr, ky = o.vyskaStr / o.vyskaObr, vys = [];
    slova.forEach((w, i) => {
      const b = w.bbox, vyska = (b.y1 - b.y0) * ky, sirka = (b.x1 - b.x0) * kx;
      if (vyska <= 0 || sirka <= 0) return;
      const velikost = Math.max(1, vyska), dalsi = slova[i + 1];
      const text = w.text + (dalsi && dalsi.radek === w.radek ? ' ' : '');
      const zmereno = o.sirkaTextu(w.text, velikost);
      vys.push({
        text, velikost: Math.round(velikost * 100) / 100,
        x: Math.round(b.x0 * kx * 100) / 100,
        y: Math.round((o.vyskaStr - b.y1 * ky + vyska * 0.18) * 100) / 100,   // účaří kousek nad spodním okrajem rámečku
        meritkoX: zmereno > 0 ? Math.round(sirka / zmereno * 1000) / 1000 : 1,
      });
    });
    return vys;
  }
  // rozměr stránky PDF v bodech z rozměru obrazu a DPI
  function rozmerStrany(sirkaPx, vyskaPx, dpi) {
    const k = 72 / (dpi || 300);
    return { sirka: Math.round(sirkaPx * k * 100) / 100, vyska: Math.round(vyskaPx * k * 100) / 100 };
  }
  // název výstupního souboru z názvu vstupu
  function nazevVystupu(nazev, pripona) {
    const z = String(nazev || 'ocr').replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'ocr';
    return z + pripona;
  }

  const OCR = {
    VYCHOZI, novy, kopie, otoc90, otoc, orez, zmenVelikost, seda, histogram, autoKontrast, kontrast, invertuj, median3,
    otsuPrah, prahOtsu, prahAdaptivni, srovnejPozadi, svetlyText, odhadSklonu, koefZvetseni, geometrie, filtry,
    parsujRozsah, obdelnik, seradOblasti, oblastPx, slozText, spojVysledky, statistika, slovoNaBode, najdiVTextu, prenesOpravy,
    vrstvaTextu, rozmerStrany, nazevVystupu,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = OCR;
  koren.OCR = OCR;
})(typeof window !== 'undefined' ? window : globalThis);

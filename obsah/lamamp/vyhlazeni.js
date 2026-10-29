/* Lamamp – vyhlazené zvětšení (WA_VYHLAZ): Scale2x (EPX) dopočítá šikmé hrany pixel artu, zbytek dotáhne
   kvalitní interpolace prohlížeče. Na 1× se nepoužije. Jádro (scale2x) je bez DOM – testuje se v node. */
(function () {
  'use strict';

  // Scale2x nad 32bitovými pixely (Uint32Array w×h) → 2w×2h
  function scale2x(src, w, h) {
    const out = new Uint32Array(w * h * 4), w2 = w * 2;
    for (let y = 0; y < h; y++) {
      const nad = y > 0 ? y - 1 : y, pod = y < h - 1 ? y + 1 : y;
      for (let x = 0; x < w; x++) {
        const P = src[y * w + x];
        const A = src[nad * w + x], D = src[pod * w + x];
        const C = src[y * w + (x > 0 ? x - 1 : x)], B = src[y * w + (x < w - 1 ? x + 1 : x)];
        let e0 = P, e1 = P, e2 = P, e3 = P;
        if (A !== D && C !== B) {
          if (C === A) e0 = A;
          if (A === B) e1 = B;
          if (C === D) e2 = C;
          if (D === B) e3 = D;
        }
        const o = (y * 2) * w2 + x * 2;
        out[o] = e0; out[o + 1] = e1; out[o + w2] = e2; out[o + w2 + 1] = e3;
      }
    }
    return out;
  }

  // Scale2x n-krát nad výřezem (x, y, w, h) pixelů px (šířka řádku sirka)
  function zvetsiVyrez(px, sirka, x, y, w, h, kroku) {
    let v = new Uint32Array(w * h);
    for (let j = 0; j < h; j++) v.set(px.subarray((y + j) * sirka + x, (y + j) * sirka + x + w), j * w);
    for (let i = 0; i < kroku; i++) { v = scale2x(v, w, h); w *= 2; h *= 2; }
    return v;
  }
  // Zvětšení plátna Scale2x dvakrát (4×): hrany se zaoblí víc a zmenšení na cílovou velikost je vyhladí (antialiasing);
  // od měřítka 3 třikrát (8×), aby se vždy zmenšovalo (vyhlazení hran i na displejích s vysokou hustotou). Při přehrávání se mění jen kousek okna (vizualizace, čas) → přepočítá se jen změněný
  // obdélník (s okrajem kvůli sousedům), zbytek zůstává z minula.
  const pamet = new WeakMap();
  const OKRAJ = 3;
  function zvetsi(zdroj, meritko) {
    const w = zdroj.width, h = zdroj.height, kroku = meritko >= 3 ? 3 : 2, n = 1 << kroku;
    const px = new Uint32Array(zdroj.getContext('2d').getImageData(0, 0, w, h).data.buffer);
    let p = pamet.get(zdroj);
    if (!p || p.w !== w || p.h !== h || p.n !== n) {
      p = { w, h, n, pred: null, velky: new Uint32Array(w * n * h * n), c: (p && p.c) || document.createElement('canvas') };
      p.c.width = w * n; p.c.height = h * n;
      pamet.set(zdroj, p);
    }
    // změněný obdélník proti minulému snímku
    let x0 = 0, y0 = 0, x1 = w - 1, y1 = h - 1;
    if (p.pred) {
      x0 = w; y0 = h; x1 = -1; y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0, i = y * w; x < w; x++, i++) {
        if (px[i] !== p.pred[i]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < 0) return p.c;   // nic se nezměnilo
    }
    p.pred = px;
    // výřez s okrajem pro sousedy; do velkého obrazu se zapíše jen vnitřek bez okraje
    const ox0 = Math.max(0, x0 - OKRAJ), oy0 = Math.max(0, y0 - OKRAJ), ox1 = Math.min(w - 1, x1 + OKRAJ), oy1 = Math.min(h - 1, y1 + OKRAJ);
    const vw = ox1 - ox0 + 1, vh = oy1 - oy0 + 1, v = zvetsiVyrez(px, w, ox0, oy0, vw, vh, kroku);
    const zx0 = Math.max(0, x0 - 1), zy0 = Math.max(0, y0 - 1), zx1 = Math.min(w - 1, x1 + 1), zy1 = Math.min(h - 1, y1 + 1);
    const W = w * n, vW = vw * n;
    for (let y = zy0 * n; y < (zy1 + 1) * n; y++) {
      const zdrojRadek = (y - oy0 * n) * vW + (zx0 - ox0) * n;
      p.velky.set(v.subarray(zdrojRadek, zdrojRadek + (zx1 - zx0 + 1) * n), y * W + zx0 * n);
    }
    p.c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(p.velky.buffer), W, h * n), 0, 0, zx0 * n, zy0 * n, (zx1 - zx0 + 1) * n, (zy1 - zy0 + 1) * n);
    return p.c;
  }
  // vykreslení zdroje do cíle v daném měřítku (pixely zařízení na pixel skinu); hladce = Scale2x + interpolace
  function vykresli(g, zdroj, w, h, k, hladce) {
    if (!hladce || k < 2) { g.imageSmoothingEnabled = false; g.drawImage(zdroj, 0, 0, w * k, h * k); return; }
    const z = zvetsi(zdroj, k);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'low';   // bilineární: při 4× → 2× přesně průměr 2×2 (vyhlazení), a 3× rychlejší než 'high'
    g.drawImage(z, 0, 0, w * k, h * k);
  }

  window.WA_VYHLAZ = { scale2x, zvetsiVyrez, zvetsi, vykresli };
})();

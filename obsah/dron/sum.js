// Nad krajinou — šum (2D simplex, fBm, hřebenový). Běží v prohlížeči, ve Workeru i v node.
(function (D) {
  'use strict';

  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  const GRAD = new Float32Array([1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1]);

  // vrátí funkci s(x, y) → přibližně −1..1
  function Simplex(seed) {
    const r = D.Nahoda(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    const perm = new Uint8Array(512), pm8 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm8[i] = perm[i] & 7; }

    return function (xin, yin) {
      const s = (xin + yin) * F2;
      const i = Math.floor(xin + s), j = Math.floor(yin + s);
      const t = (i + j) * G2;
      const x0 = xin - (i - t), y0 = yin - (j - t);
      const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
      const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let n = 0, tt, g;
      tt = 0.5 - x0 * x0 - y0 * y0;
      if (tt > 0) { g = pm8[ii + perm[jj]] * 2; tt *= tt; n += tt * tt * (GRAD[g] * x0 + GRAD[g + 1] * y0); }
      tt = 0.5 - x1 * x1 - y1 * y1;
      if (tt > 0) { g = pm8[ii + i1 + perm[jj + j1]] * 2; tt *= tt; n += tt * tt * (GRAD[g] * x1 + GRAD[g + 1] * y1); }
      tt = 0.5 - x2 * x2 - y2 * y2;
      if (tt > 0) { g = pm8[ii + 1 + perm[jj + 1]] * 2; tt *= tt; n += tt * tt * (GRAD[g] * x2 + GRAD[g + 1] * y2); }
      return 70 * n;
    };
  }

  // fBm: oktávy simplexu, výsledek přibližně −1..1
  function fbm(s, x, y, oktavy = 5, lak = 2.0, zisk = 0.5) {
    let a = 1, f = 1, sum = 0, norm = 0;
    for (let o = 0; o < oktavy; o++) { sum += a * s(x * f, y * f); norm += a; a *= zisk; f *= lak; }
    return sum / norm;
  }

  // hřebenový šum: 0..1, ostré hřbety
  function hrebeny(s, x, y, oktavy = 5, lak = 2.0, zisk = 0.5) {
    let a = 1, f = 1, sum = 0, norm = 0, w = 1;
    for (let o = 0; o < oktavy; o++) {
      let n = 1 - Math.abs(s(x * f, y * f));
      n *= n; n *= w; w = Math.min(1, Math.max(0, n * 2));
      sum += a * n; norm += a; a *= zisk; f *= lak;
    }
    return sum / norm;
  }

  D.Simplex = Simplex;
  D.fbm = fbm;
  D.hrebeny = hrebeny;
  D.smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  D.lerp = (a, b, t) => a + (b - a) * t;
  D.clamp = (x, a, b) => x < a ? a : x > b ? b : x;
})(globalThis.DRON = globalThis.DRON || {});

/* Skládání panoramat – jádro bez DOM (prohlížeč, Web Worker i node).
   Body: Harris + BRIEF, párování Hammingovou vzdáleností, RANSAC (posun / posun+otočení / homografie),
   válcová projekce, kostra grafu snímků (automatické pořadí), vyrovnání expozice (Brown–Lowe),
   skládání se švem nalezeným dynamickým programováním a prolnutím, ořez na největší obdélník, EXIF.
   Souřadnice: „proj“ = souřadnice snímku se středem v (0,0) (u válce úhel×f a výška na válci),
   „pano“ = proj kořenového snímku; matice T snímku převádí proj → pano. */
'use strict';
(function (koren, tovarna) {
  const P = tovarna();
  if (typeof module === 'object' && module.exports) module.exports = P; else koren.PANO = P;
})(typeof self !== 'undefined' ? self : this, function () {

/* ---------- matice 3×3 (pole 9 čísel po řádcích) ---------- */
const I3 = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
function nas(a, b) {
  const c = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return c;
}
function inv(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  if (!det || !isFinite(det)) return null;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
    C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
const posun = (x, y) => [1, 0, x, 0, 1, y, 0, 0, 1];
const rotace = a => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
function apl(m, x, y) {
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
}

/* Gaussova eliminace s výběrem hlavního prvku; A je pole řádků (přepíše se) */
function resLin(A, b) {
  const n = b.length;
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(A[i][k]) > Math.abs(A[p][k])) p = i;
    if (Math.abs(A[p][k]) < 1e-12) return null;
    [A[k], A[p]] = [A[p], A[k]]; [b[k], b[p]] = [b[p], b[k]];
    for (let i = k + 1; i < n; i++) {
      const f = A[i][k] / A[k][k];
      if (!f) continue;
      for (let j = k; j < n; j++) A[i][j] -= f * A[k][j];
      b[i] -= f * b[k];
    }
  }
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j];
    x[i] = s / A[i][i];
  }
  return x;
}

/* deterministická náhoda (mulberry32) */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- modely: páry [xa, ya, xb, yb], model převádí b → a ---------- */
function fitPosun(p) {
  let sx = 0, sy = 0;
  for (const q of p) { sx += q[0] - q[2]; sy += q[1] - q[3]; }
  return posun(sx / p.length, sy / p.length);
}
function fitEuklid(p) {
  let ax = 0, ay = 0, bx = 0, by = 0;
  for (const q of p) { ax += q[0]; ay += q[1]; bx += q[2]; by += q[3]; }
  const n = p.length; ax /= n; ay /= n; bx /= n; by /= n;
  let sc = 0, ss = 0;
  for (const q of p) {
    const u = q[2] - bx, v = q[3] - by, X = q[0] - ax, Y = q[1] - ay;
    sc += u * X + v * Y; ss += u * Y - v * X;
  }
  const a = (sc || ss) ? Math.atan2(ss, sc) : 0, c = Math.cos(a), s = Math.sin(a);
  return [c, -s, ax - (c * bx - s * by), s, c, ay - (s * bx + c * by), 0, 0, 1];
}
function normalizace(p, o) {
  let mx = 0, my = 0;
  for (const q of p) { mx += q[o]; my += q[o + 1]; }
  mx /= p.length; my /= p.length;
  let d = 0;
  for (const q of p) d += Math.hypot(q[o] - mx, q[o + 1] - my);
  const s = d ? Math.SQRT2 * p.length / d : 1;
  return [s, 0, -s * mx, 0, s, -s * my, 0, 0, 1];
}
function fitHomografie(p) {
  const Na = normalizace(p, 0), Nb = normalizace(p, 2);
  const A = Array.from({ length: 8 }, () => new Array(8).fill(0)), b = new Array(8).fill(0);
  const pridej = (r, y) => {
    for (let i = 0; i < 8; i++) { if (!r[i]) continue; b[i] += r[i] * y; for (let j = 0; j < 8; j++) A[i][j] += r[i] * r[j]; }
  };
  for (const q of p) {
    const [xa, ya] = apl(Na, q[0], q[1]), [xb, yb] = apl(Nb, q[2], q[3]);
    pridej([xb, yb, 1, 0, 0, 0, -xb * xa, -yb * xa], xa);
    pridej([0, 0, 0, xb, yb, 1, -xb * ya, -yb * ya], ya);
  }
  const h = resLin(A, b);
  if (!h || h.some(v => !isFinite(v))) return null;
  const Nai = inv(Na);
  if (!Nai) return null;
  const H = nas(nas(Nai, [...h, 1]), Nb);
  return H[8] ? H.map(v => v / H[8]) : null;
}
const MODELY = {
  posun: { min: 1, fit: fitPosun, iter: 200 },
  euklid: { min: 2, fit: fitEuklid, iter: 500 },
  homografie: { min: 4, fit: fitHomografie, iter: 1500 }
};
function chyba2(M, q) {
  const [x, y] = apl(M, q[2], q[3]);
  return (x - q[0]) ** 2 + (y - q[1]) ** 2;
}
/* RANSAC + dvě kola zpřesnění nejmenšími čtverci na inlierech */
function ransac(pary, typ, o = {}) {
  const Mo = MODELY[typ], n = pary.length;
  if (!Mo || n < Mo.min) return null;
  const prah2 = (o.prah || 3) ** 2, rnd = prng(o.seed || 7), iter = n === Mo.min ? 1 : (o.iter || Mo.iter);
  const vnitrni = M => { const r = []; for (let i = 0; i < n; i++) if (chyba2(M, pary[i]) < prah2) r.push(i); return r; };
  let best = null, bestI = [];
  for (let k = 0; k < iter; k++) {
    const idx = new Set();
    while (idx.size < Mo.min) idx.add(Math.floor(rnd() * n));
    const M = Mo.fit([...idx].map(i => pary[i]));
    if (!M) continue;
    const inl = vnitrni(M);
    if (inl.length > bestI.length) { best = M; bestI = inl; if (inl.length === n) break; }
  }
  if (!best) return null;
  for (let r = 0; r < 3 && bestI.length >= Mo.min; r++) {
    const M = Mo.fit(bestI.map(i => pary[i]));
    if (!M) break;
    const inl = vnitrni(M);
    if (inl.length < bestI.length) break;
    best = M; bestI = inl;
  }
  return { M: best, inliery: bestI };
}

/* ---------- obraz: šedotón a rozmazání ---------- */
function sedy(rgba) {
  const { w, h, d } = rgba, g = new Float32Array(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
  return { w, h, d: g };
}
function rozmazBox(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const o = y * w;
    let s = 0;
    for (let k = -r; k <= r; k++) s += src[o + Math.min(w - 1, Math.max(0, k))];
    for (let x = 0; x < w; x++) {
      tmp[o + x] = s / n;
      s += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += tmp[Math.min(h - 1, Math.max(0, k)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = s / n;
      s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}
const rozmaz = (g, r) => ({ w: g.w, h: g.h, d: rozmazBox(rozmazBox(g.d, g.w, g.h, r), g.w, g.h, r) });

/* ---------- Harrisovy rohy s rozprostřením po mřížce a subpixelovým zpřesněním ---------- */
function harris(g, o = {}) {
  const { w, h, d } = g, max = o.max || 600, okraj = o.okraj || 16, mrizka = o.mrizka || 10;
  const xx = new Float32Array(w * h), yy = new Float32Array(w * h), xy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const ix = (d[i - w + 1] + 2 * d[i + 1] + d[i + w + 1]) - (d[i - w - 1] + 2 * d[i - 1] + d[i + w - 1]);
    const iy = (d[i + w - 1] + 2 * d[i + w] + d[i + w + 1]) - (d[i - w - 1] + 2 * d[i - w] + d[i - w + 1]);
    xx[i] = ix * ix; yy[i] = iy * iy; xy[i] = ix * iy;
  }
  const r = 1;
  const A = rozmazBox(rozmazBox(xx, w, h, r), w, h, r), B = rozmazBox(rozmazBox(yy, w, h, r), w, h, r), C = rozmazBox(rozmazBox(xy, w, h, r), w, h, r);
  const R = new Float32Array(w * h);
  let maxR = 0;
  for (let i = 0; i < R.length; i++) {
    const t = A[i] + B[i];
    R[i] = A[i] * B[i] - C[i] * C[i] - 0.04 * t * t;
    if (R[i] > maxR) maxR = R[i];
  }
  const prah = maxR * 1e-5, bunka = Math.max(8, Math.ceil(Math.max(w, h) / mrizka));
  const bunky = new Map();
  for (let y = okraj; y < h - okraj; y++) for (let x = okraj; x < w - okraj; x++) {
    const i = y * w + x, v = R[i];
    if (v <= prah) continue;
    let lok = true;
    for (let dy = -2; dy <= 2 && lok; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (!dx && !dy) continue;
      const u = R[i + dy * w + dx];
      if (u > v || (u === v && (dy < 0 || (dy === 0 && dx < 0)))) { lok = false; break; }
    }
    if (!lok) continue;
    const k = Math.floor(y / bunka) * 10000 + Math.floor(x / bunka);
    if (!bunky.has(k)) bunky.set(k, []);
    bunky.get(k).push({ x, y, r: v });
  }
  const kvota = Math.max(2, Math.ceil(2 * max / Math.max(1, bunky.size)));
  let body = [];
  for (const s of bunky.values()) { s.sort((a, b) => b.r - a.r); body.push(...s.slice(0, kvota)); }
  body.sort((a, b) => b.r - a.r);
  body = body.slice(0, max);
  const sub = (a, b, c) => { const den = a - 2 * b + c; return den < 0 ? Math.max(-0.5, Math.min(0.5, (a - c) / (2 * den))) : 0; };
  for (const p of body) {
    const i = p.y * w + p.x;
    p.x += sub(R[i - 1], R[i], R[i + 1]);
    p.y += sub(R[i - w], R[i], R[i + w]);
  }
  return body;
}

/* ---------- BRIEF: 256 porovnání dvojic v rozmazaném okolí 27×27 ---------- */
const VZOR = (() => {
  const r = prng(2718), v = new Int8Array(1024);
  const g = () => { const s = Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r()) * 5.5; return Math.max(-13, Math.min(13, Math.round(s))); };
  for (let i = 0; i < 1024; i++) v[i] = g();
  return v;
})();
function deskriptory(gb, body) {
  const { w, d } = gb, D = new Uint32Array(body.length * 8);
  body.forEach((p, k) => {
    const c = Math.round(p.y) * w + Math.round(p.x);
    for (let b = 0; b < 256; b++) {
      const v = VZOR, j = b * 4;
      if (d[c + v[j + 1] * w + v[j]] < d[c + v[j + 3] * w + v[j + 2]]) D[k * 8 + (b >> 5)] |= 1 << (b & 31);
    }
  });
  return D;
}
function pop(x) { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24; }
function ham(A, i, B, j) { let s = 0; for (let k = 0; k < 8; k++) s += pop(A[i * 8 + k] ^ B[j * 8 + k]); return s; }
/* vzájemně nejlepší shody s Loweho poměrovým testem → [[i, j], …] */
function paruj(A, na, B, nb, pomer = 0.8, maxD = 80) {
  const nejA = new Int32Array(na).fill(-1), dA = new Int32Array(na), nejB = new Int32Array(nb).fill(-1), dB = new Int32Array(nb).fill(999);
  for (let i = 0; i < na; i++) {
    let b1 = 999, b2 = 999, bj = -1;
    for (let j = 0; j < nb; j++) {
      const h = ham(A, i, B, j);
      if (h < b1) { b2 = b1; b1 = h; bj = j; } else if (h < b2) b2 = h;
      if (h < dB[j]) { dB[j] = h; nejB[j] = i; }
    }
    if (b1 <= maxD && b1 < pomer * b2) { nejA[i] = bj; dA[i] = b1; }
  }
  const r = [];
  for (let i = 0; i < na; i++) if (nejA[i] >= 0 && nejB[nejA[i]] === i) r.push([i, nejA[i]]);
  return r;
}

/* ---------- projekce snímku ---------- */
function naProj(w, h, f, valec, x, y) {
  const xc = x - (w - 1) / 2, yc = y - (h - 1) / 2;
  return valec ? [f * Math.atan2(xc, f), f * yc / Math.hypot(xc, f)] : [xc, yc];
}
function zProj(w, h, f, valec, u, v) {
  let xc = u, yc = v;
  if (valec) {
    const t = u / f;
    if (!(Math.abs(t) < 1.45)) return null;
    xc = f * Math.tan(t); yc = v * Math.hypot(xc, f) / f;
  }
  return [xc + (w - 1) / 2, yc + (h - 1) / 2];
}
/* šedý snímek promítnutý na válec; pixel (X, Y) = proj (X − ox, Y − oy); mimo snímek se protáhne okraj (bez falešných hran) */
function naValec(g, f) {
  const { w, h, d } = g, cx = (w - 1) / 2;
  const W = 2 * Math.ceil(f * Math.atan(cx / f)) + 3, ox = (W - 1) / 2, oy = (h - 1) / 2;
  const out = new Float32Array(W * h), maska = new Uint8Array(W * h);
  for (let Y = 0; Y < h; Y++) for (let X = 0; X < W; X++) {
    const q = zProj(w, h, f, true, X - ox, Y - oy);
    let x = q[0], y = q[1];
    const uvnitr = x >= 0 && y >= 0 && x <= w - 1 && y <= h - 1;
    x = Math.min(Math.max(x, 0), w - 1); y = Math.min(Math.max(y, 0), h - 1);
    const xi = Math.min(Math.floor(x), w - 2), yi = Math.min(Math.floor(y), h - 2), fx = x - xi, fy = y - yi, i = yi * w + xi;
    out[Y * W + X] = (d[i] * (1 - fx) + d[i + 1] * fx) * (1 - fy) + (d[i + w] * (1 - fx) + d[i + w + 1] * fx) * fy;
    maska[Y * W + X] = uvnitr ? 1 : 0;
  }
  return { w: W, h, d: out, ox, oy, maska };
}
/* pohled = { w, h, f, valec, T, Ti } v jednotkách náhledu */
function pohled(w, h, f, valec, T) { return { w, h, f, valec, T, Ti: inv(T) }; }
function obrazNaPano(v, x, y) { const p = naProj(v.w, v.h, v.f, v.valec, x, y); return apl(v.T, p[0], p[1]); }
function panoNaObraz(v, X, Y) { const p = apl(v.Ti, X, Y); return zProj(v.w, v.h, v.f, v.valec, p[0], p[1]); }
function obrys(v, n = 16) {
  const r = [], W = v.w - 1, H = v.h - 1;
  for (let i = 0; i < n; i++) r.push(obrazNaPano(v, W * i / n, 0));
  for (let i = 0; i < n; i++) r.push(obrazNaPano(v, W, H * i / n));
  for (let i = 0; i < n; i++) r.push(obrazNaPano(v, W - W * i / n, H));
  for (let i = 0; i < n; i++) r.push(obrazNaPano(v, 0, H - H * i / n));
  return r;
}
function hranice(pohledy) {
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const v of pohledy) for (const [x, y] of obrys(v)) {
    if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
  }
  return b;
}
/* ohnisko v pixelech z EXIFu: ekvivalent 35 mm (úhlopříčka 43,27 mm) nebo skutečné ohnisko + rozlišení ohniskové roviny */
function ohniskoPx(w, h, ex) {
  const diag = Math.hypot(w, h);
  if (ex && ex.ohnisko35 > 0) return ex.ohnisko35 * diag / 43.2666;
  if (ex && ex.ohnisko > 0 && ex.rovinaPxMm > 0 && ex.sirkaPx > 0 && ex.vyskaPx > 0)
    return ex.ohnisko * diag / (Math.hypot(ex.sirkaPx, ex.vyskaPx) / ex.rovinaPxMm);
  return null;
}
const ekv35 = (w, h, fpx) => fpx * 43.2666 / Math.hypot(w, h);
const zEkv35 = (w, h, mm) => mm * Math.hypot(w, h) / 43.2666;

/* ---------- zarovnání ----------
   snimky[i] = { w, h, sedy: Float32Array (náhled), f (px náhledu) }; do snímků se ukládá body/desk (cache)
   nast = { valec, model, maxBody, rucni: [{ a, b, body: [[xa, ya, xb, yb], …] }] (px náhledu), vyrovnat }
   → { T: [matice | null], hrany: [{ a, b, shod, inl, rucne, pouzita }], koren, body: [počet] } */
function zarovnej(snimky, nast = {}, prubeh = () => {}) {
  const n = snimky.length, valec = !!nast.valec;
  const typ = nast.model && MODELY[nast.model] ? nast.model : (valec ? 'euklid' : 'homografie');
  // u válce se body hledají a popisují až na snímku promítnutém na válec – tam vypadá stejné místo
  // ve všech snímcích stejně (v rovině je okraj snímku roztažený až o desítky procent a BRIEF selže)
  snimky.forEach((s, i) => {
    const klic = (nast.maxBody || 600) + '|' + (valec ? s.f : 0);
    if (s.body && s.klic === klic) return;
    prubeh('Hledám body ve snímku ' + (i + 1), i / n * 0.3);
    let g = { w: s.w, h: s.h, d: s.sedy }, ox = (s.w - 1) / 2, oy = (s.h - 1) / 2, maska = null;
    if (valec) { const v = naValec(g, s.f); g = v; ox = v.ox; oy = v.oy; maska = v.maska; }
    let body = harris(g, { max: nast.maxBody || 600 });
    if (maska) {
      const ok = (x, y) => maska[Math.round(y) * g.w + Math.round(x)];
      body = body.filter(p => ok(p.x - 15, p.y - 15) && ok(p.x + 15, p.y - 15) && ok(p.x - 15, p.y + 15) && ok(p.x + 15, p.y + 15));
    }
    s.desk = deskriptory(rozmaz(g, 2), body);
    s.body = body; s.ox = ox; s.oy = oy; s.klic = klic;
  });
  const proj = (s, x, y) => naProj(s.w, s.h, s.f, valec, x, y);
  const projBod = (s, p) => [p.x - s.ox, p.y - s.oy];
  const hrany = [];
  let k = 0;
  const pocetDvojic = n * (n - 1) / 2;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    prubeh(`Páruji snímky ${a + 1} a ${b + 1}`, 0.3 + 0.65 * (k++ / Math.max(1, pocetDvojic)));
    const A = snimky[a], B = snimky[b];
    const shody = paruj(A.desk, A.body.length, B.desk, B.body.length);
    const pary = shody.map(([i, j]) => [...projBod(A, A.body[i]), ...projBod(B, B.body[j])]);
    const ruc = [];
    for (const r of nast.rucni || []) {
      if (r.a === a && r.b === b) for (const q of r.body) ruc.push([...proj(A, q[0], q[1]), ...proj(B, q[2], q[3])]);
      if (r.a === b && r.b === a) for (const q of r.body) ruc.push([...proj(A, q[2], q[3]), ...proj(B, q[0], q[1])]);
    }
    let M = null, inl = 0, rucne = false, kandidat = 0;
    if (ruc.length >= MODELY[typ].min) {
      M = MODELY[typ].fit(ruc); inl = ruc.length; rucne = true;
    } else {
      const vse = pary.concat(ruc);
      const r = ransac(vse, typ, { prah: nast.prah || 2.5, seed: 11 + a * 31 + b });
      kandidat = r ? r.inliery.length : 0;
      if (r && r.inliery.length >= 12 && r.inliery.length > 6 + 0.2 * vse.length) { M = r.M; inl = r.inliery.length; }
      else if (r && ruc.length && r.inliery.length >= MODELY[typ].min + 2) { M = r.M; inl = r.inliery.length; rucne = true; }
    }
    hrany.push({ a, b, shod: shody.length, inl, kandidat, rucne, M, pouzita: false });
  }
  // kostra s maximálními vahami (Kruskal) – určuje i pořadí a skupiny
  const rod = [...Array(n).keys()], najdi = x => rod[x] === x ? x : (rod[x] = najdi(rod[x]));
  const soused = Array.from({ length: n }, () => []);
  for (const e of hrany.filter(e => e.M).sort((x, y) => (y.rucne - x.rucne) || (y.inl - x.inl))) {
    const ra = najdi(e.a), rb = najdi(e.b);
    if (ra === rb) continue;
    rod[ra] = rb; e.pouzita = true;
    soused[e.a].push([e.b, e]); soused[e.b].push([e.a, e]);
  }
  // největší skupina, kořen = střed stromu (nejmenší výstřednost)
  const skup = new Map();
  for (let i = 0; i < n; i++) { const r = najdi(i); skup.set(r, (skup.get(r) || []).concat(i)); }
  const hlavni = [...skup.values()].sort((x, y) => y.length - x.length)[0] || [];
  const hloubky = s => { const d = new Map([[s, 0]]), f = [s]; while (f.length) { const u = f.shift(); for (const [v] of soused[u]) if (!d.has(v)) { d.set(v, d.get(u) + 1); f.push(v); } } return d; };
  let koren = hlavni[0], nejV = Infinity;
  for (const s of hlavni) { const m = Math.max(...hloubky(s).values()); if (m < nejV) { nejV = m; koren = s; } }
  const T = new Array(n).fill(null);
  if (koren !== undefined) {
    T[koren] = I3();
    const f = [koren];
    while (f.length) {
      const p = f.shift();
      for (const [c, e] of soused[p]) {
        if (T[c]) continue;
        T[c] = e.a === p ? nas(T[p], e.M) : nas(T[p], inv(e.M));
        f.push(c);
      }
    }
  }
  // vyrovnání horizontu: středy snímků proložit přímkou a otočit ji do vodorovna
  if (valec && nast.vyrovnat !== false && typ !== 'homografie') {
    const st = T.map(t => t && apl(t, 0, 0)).filter(Boolean);
    if (st.length >= 2) {
      const mx = st.reduce((s, p) => s + p[0], 0) / st.length, my = st.reduce((s, p) => s + p[1], 0) / st.length;
      let sxx = 0, sxy = 0;
      for (const p of st) { sxx += (p[0] - mx) ** 2; sxy += (p[0] - mx) * (p[1] - my); }
      if (sxx > 0) {
        const R = rotace(-Math.atan(sxy / sxx));
        for (let i = 0; i < n; i++) if (T[i]) T[i] = nas(R, T[i]);
      }
    }
  }
  prubeh('Hotovo', 1);
  return { T, hrany: hrany.map(({ M, ...e }) => e), koren, body: snimky.map(s => s.body.length), model: typ };
}

/* ruční úprava snímku v pano souřadnicích: posun (dx, dy) a otočení (stupně) kolem středu snímku */
function upravena(T, w, h, f, valec, u) {
  if (!u || (!u.dx && !u.dy && !u.uhel)) return T;
  const c = apl(T, 0, 0);
  const A = nas(posun(c[0] + (u.dx || 0), c[1] + (u.dy || 0)), nas(rotace((u.uhel || 0) * Math.PI / 180), posun(-c[0], -c[1])));
  return nas(A, T);
}

/* ---------- vzorkování ---------- */
function vzorek(src, x, y, out) {
  const { w, h, d } = src;
  if (x < -1e-3 || y < -1e-3 || x > w - 1 + 1e-3 || y > h - 1 + 1e-3) return false;
  x = Math.min(Math.max(x, 0), w - 1); y = Math.min(Math.max(y, 0), h - 1);
  const xi = Math.min(Math.floor(x), w - 2), yi = Math.min(Math.floor(y), h - 2), fx = x - xi, fy = y - yi;
  const i = (yi * w + xi) * 4, j = i + w * 4;
  for (let c = 0; c < 3; c++) {
    out[c] = (d[i + c] * (1 - fx) + d[i + 4 + c] * fx) * (1 - fy) + (d[j + c] * (1 - fx) + d[j + 4 + c] * fx) * fy;
  }
  return true;
}
/* bod pano → souřadnice ve zdroji (zdroj může být větší než náhled, ze kterého je pohled) */
function doZdroje(v, src, X, Y) {
  const q = panoNaObraz(v, X, Y);
  if (!q) return null;
  return [(q[0] + 0.5) * src.w / v.w - 0.5, (q[1] + 0.5) * src.h / v.h - 0.5];
}

/* ---------- vyrovnání expozice (Brown & Lowe 2007), zisky po kanálech ---------- */
function zisky(pohledy, zdroje, o = {}) {
  const n = pohledy.length, b = hranice(pohledy);
  const krok = o.krok || Math.max(2, Math.sqrt((b.x1 - b.x0) * (b.y1 - b.y0) / 40000));
  const N = new Float64Array(n * n), S = new Float64Array(n * n * 3);
  const c = [0, 0, 0], barvy = [], kdo = [];
  for (let Y = b.y0; Y <= b.y1; Y += krok) for (let X = b.x0; X <= b.x1; X += krok) {
    kdo.length = 0;
    for (let i = 0; i < n; i++) {
      const q = doZdroje(pohledy[i], zdroje[i], X, Y);
      if (q && vzorek(zdroje[i], q[0], q[1], c)) { kdo.push(i); barvy[i] = [c[0], c[1], c[2]]; }
    }
    for (const i of kdo) for (const j of kdo) {
      if (i === j) continue;
      N[i * n + j]++;
      for (let k = 0; k < 3; k++) S[(i * n + j) * 3 + k] += barvy[i][k];
    }
  }
  const sN = o.sigmaN || 10, sG = o.sigmaG || 0.1, g = Array.from({ length: n }, () => [1, 1, 1]);
  for (let k = 0; k < 3; k++) {
    const A = Array.from({ length: n }, () => new Array(n).fill(0)), r = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      A[i][i] += 1e-6; r[i] += 1e-6;
      for (let j = 0; j < n; j++) {
        const m = N[i * n + j];
        if (!m || i === j) continue;
        const aij = S[(i * n + j) * 3 + k] / m, aji = S[(j * n + i) * 3 + k] / m;
        A[i][i] += m * (2 * aij * aij / (sN * sN) + 1 / (sG * sG));
        A[i][j] -= m * 2 * aij * aji / (sN * sN);
        r[i] += m / (sG * sG);
      }
    }
    const x = resLin(A, r);
    if (x) x.forEach((v, i) => { g[i][k] = isFinite(v) && v > 0.2 && v < 5 ? v : 1; });
  }
  return g;
}

/* ---------- skládání ----------
   vystup = { W, H, x0, y0, k, d: RGBA } – pixel (X, Y) odpovídá pano bodu (x0 + X/k, y0 + Y/k) */
function novyVystup(W, H, x0, y0, k) { return { W, H, x0, y0, k, d: new Uint8ClampedArray(W * H * 4) }; }
/* pořadí skládání: podél delší osy rozmístění středů */
function poradi(pohledy) {
  const st = pohledy.map(v => obrazNaPano(v, (v.w - 1) / 2, (v.h - 1) / 2));
  const sx = Math.max(...st.map(p => p[0])) - Math.min(...st.map(p => p[0]));
  const sy = Math.max(...st.map(p => p[1])) - Math.min(...st.map(p => p[1]));
  return st.map((p, i) => i).sort((a, b) => sx >= sy ? st[a][0] - st[b][0] : st[a][1] - st[b][1]);
}
/* přidá jeden snímek; v překryvu najde šev (dynamické programování přes rozdíl barev) a prolne pásem šířky pas */
function pridej(out, v, src, zisk, pas = 0) {
  const { W, H, x0, y0, k } = out, od = out.d, g = zisk || [1, 1, 1];
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const [x, y] of obrys(v)) {
    const X = (x - x0) * k, Y = (y - y0) * k;
    if (X < bx0) bx0 = X; if (X > bx1) bx1 = X; if (Y < by0) by0 = Y; if (Y > by1) by1 = Y;
  }
  const X0 = Math.max(0, Math.floor(bx0) - 1), X1 = Math.min(W - 1, Math.ceil(bx1) + 1);
  const Y0 = Math.max(0, Math.floor(by0) - 1), Y1 = Math.min(H - 1, Math.ceil(by1) + 1);
  if (X1 < X0 || Y1 < Y0) return false;
  const tw = X1 - X0 + 1, th = Y1 - Y0 + 1, t = new Uint8ClampedArray(tw * th * 3), tv = new Uint8Array(tw * th);
  const c = [0, 0, 0];
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const q = doZdroje(v, src, x0 + (X0 + x) / k, y0 + (Y0 + y) / k);
    if (!q || !vzorek(src, q[0], q[1], c)) continue;
    const i = y * tw + x;
    tv[i] = 1; t[i * 3] = c[0] * g[0]; t[i * 3 + 1] = c[1] * g[1]; t[i * 3 + 2] = c[2] * g[2];
  }
  const oi = (x, y) => ((Y0 + y) * W + X0 + x) * 4;
  // překryv
  let ox0 = Infinity, oy0 = Infinity, ox1 = -1, oy1 = -1;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    if (tv[y * tw + x] && od[oi(x, y) + 3]) { if (x < ox0) ox0 = x; if (x > ox1) ox1 = x; if (y < oy0) oy0 = y; if (y > oy1) oy1 = y; }
  }
  let sev = null;
  if (ox1 >= 0) {
    const svisly = (oy1 - oy0) >= (ox1 - ox0);
    const np = svisly ? oy1 - oy0 + 1 : ox1 - ox0 + 1, nq = svisly ? ox1 - ox0 + 1 : oy1 - oy0 + 1;
    const xy = (p, q) => svisly ? [ox0 + q, oy0 + p] : [ox0 + p, oy0 + q];
    const C = new Float32Array(np * nq), Z = new Int8Array(np * nq), a = new Int32Array(np).fill(-1), bq = new Int32Array(np).fill(-1);
    for (let p = 0; p < np; p++) for (let q = 0; q < nq; q++) {
      const [x, y] = xy(p, q), ti = y * tw + x, o = oi(x, y);
      let cena = 1e6;
      if (tv[ti] && od[o + 3]) {
        cena = 1 + Math.abs(t[ti * 3] - od[o]) + Math.abs(t[ti * 3 + 1] - od[o + 1]) + Math.abs(t[ti * 3 + 2] - od[o + 2]);
        if (a[p] < 0) a[p] = q;
        bq[p] = q;
      }
      if (p > 0) {
        let m = C[(p - 1) * nq + q], z = 0;
        if (q > 0 && C[(p - 1) * nq + q - 1] < m) { m = C[(p - 1) * nq + q - 1]; z = -1; }
        if (q < nq - 1 && C[(p - 1) * nq + q + 1] < m) { m = C[(p - 1) * nq + q + 1]; z = 1; }
        cena += m; Z[p * nq + q] = z;
      }
      C[p * nq + q] = cena;
    }
    const s = new Int32Array(np);
    let q = 0;
    for (let j = 1; j < nq; j++) if (C[(np - 1) * nq + j] < C[(np - 1) * nq + q]) q = j;
    for (let p = np - 1; p >= 0; p--) { s[p] = q; q += Z[p * nq + q]; }
    const st = obrazNaPano(v, (v.w - 1) / 2, (v.h - 1) / 2);
    const sx = (st[0] - x0) * k - X0, sy = (st[1] - y0) * k - Y0;
    const strana = (svisly ? sx - (ox0 + ox1) / 2 : sy - (oy0 + oy1) / 2) >= 0 ? 1 : -1;
    sev = { svisly, s, a, b: bq, strana };
  }
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const ti = y * tw + x;
    if (!tv[ti]) continue;
    const o = oi(x, y);
    let wn = 1;
    if (od[o + 3] && sev) {
      const p = sev.svisly ? y - oy0 : x - ox0, q = sev.svisly ? x - ox0 : y - oy0;
      const s = sev.s[p], d = (q - s) * sev.strana, h = Math.min(pas / 2, s - sev.a[p], sev.b[p] - s);
      wn = h < 0.5 ? (d >= 0 ? 1 : 0) : Math.max(0, Math.min(1, 0.5 + d / (2 * h)));
    }
    for (let ch = 0; ch < 3; ch++) od[o + ch] = od[o + ch] + (t[ti * 3 + ch] - od[o + ch]) * wn;
    od[o + 3] = 255;
  }
  return true;
}
function sloz(out, pohledy, zdroje, zisk, pas) {
  for (const i of poradi(pohledy)) pridej(out, pohledy[i], zdroje[i], zisk && zisk[i], pas);
  return out;
}

/* největší osově rovnoběžný obdélník z platných pixelů (histogram po řádcích, zásobník) */
function nejvetsiObdelnik(platne, W, H) {
  const vys = new Int32Array(W + 1), zas = new Int32Array(W + 1);
  let best = { x: 0, y: 0, w: 0, h: 0 }, bestA = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) vys[x] = platne(x, y) ? vys[x] + 1 : 0;
    vys[W] = 0;
    let top = -1;
    for (let x = 0; x <= W; x++) {
      while (top >= 0 && vys[zas[top]] >= vys[x]) {
        const hh = vys[zas[top--]], left = top >= 0 ? zas[top] + 1 : 0, ww = x - left;
        if (hh * ww > bestA) { bestA = hh * ww; best = { x: left, y: y - hh + 1, w: ww, h: hh }; }
      }
      zas[++top] = x;
    }
  }
  return best;
}

/* ---------- EXIF z JPEGu (ohnisko, ekvivalent 35 mm, orientace, fotoaparát) ---------- */
function exif(buf) {
  const dv = new DataView(buf instanceof ArrayBuffer ? buf : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const r = {};
  if (dv.byteLength < 4 || dv.getUint16(0) !== 0xFFD8) return r;
  let o = 2;
  while (o + 4 < dv.byteLength) {
    if (dv.getUint8(o) !== 0xFF) break;
    const m = dv.getUint8(o + 1), len = dv.getUint16(o + 2);
    if (m === 0xE1 && dv.getUint32(o + 4) === 0x45786966) { cti(dv, o + 10, r); break; }
    if (m === 0xDA) break;
    o += 2 + len;
  }
  return r;
}
function cti(dv, t, r) {
  if (t + 8 > dv.byteLength) return;
  const le = dv.getUint16(t) === 0x4949;
  const u16 = p => dv.getUint16(p, le), u32 = p => dv.getUint32(p, le);
  const hodnota = (e) => {
    const typ = u16(e + 2), pocet = u32(e + 4), vel = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }[typ] || 1;
    const p = vel * pocet > 4 ? t + u32(e + 8) : e + 8;
    if (p + vel * pocet > dv.byteLength) return null;
    if (typ === 3) return u16(p);
    if (typ === 4) return u32(p);
    if (typ === 5) { const d = u32(p + 4); return d ? u32(p) / d : null; }
    if (typ === 2) { let s = ''; for (let i = 0; i < pocet - 1; i++) s += String.fromCharCode(dv.getUint8(p + i)); return s.trim(); }
    return null;
  };
  const ifd = (p, f) => {
    if (p + 2 > dv.byteLength) return;
    const n = u16(p);
    for (let i = 0; i < n; i++) { const e = p + 2 + i * 12; if (e + 12 > dv.byteLength) return; f(u16(e), e); }
  };
  let exifIfd = 0;
  ifd(t + u32(t + 4), (tag, e) => {
    if (tag === 0x0112) r.orientace = hodnota(e);
    else if (tag === 0x010F) r.vyrobce = hodnota(e);
    else if (tag === 0x0110) r.model = hodnota(e);
    else if (tag === 0x8769) exifIfd = u32(e + 8);
  });
  let jedn = 2;
  if (exifIfd) ifd(t + exifIfd, (tag, e) => {
    if (tag === 0x920A) r.ohnisko = hodnota(e);
    else if (tag === 0xA405) r.ohnisko35 = hodnota(e);
    else if (tag === 0xA20E) r.rovinaPx = hodnota(e);
    else if (tag === 0xA210) jedn = hodnota(e);
    else if (tag === 0xA002) r.sirkaPx = hodnota(e);
    else if (tag === 0xA003) r.vyskaPx = hodnota(e);
  });
  if (r.rovinaPx) { r.rovinaPxMm = r.rovinaPx / (jedn === 3 ? 10 : jedn === 4 ? 1 : 25.4); delete r.rovinaPx; }
}

/* perspektivní snímek z válcové předlohy (ukázka a testy): střed snímku míří na bod (u0, v0) předlohy */
function pohledZValce(tex, f, u0, v0, w, h, nasob = 1) {
  const d = new Uint8ClampedArray(w * h * 4), c = [0, 0, 0];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [u, v] = naProj(w, h, f, true, x, y), i = (y * w + x) * 4;
    if (vzorek(tex, u0 + u, v0 + v, c)) { d[i] = c[0] * nasob; d[i + 1] = c[1] * nasob; d[i + 2] = c[2] * nasob; }
    d[i + 3] = 255;
  }
  return { w, h, d };
}

return {
  I3, nas, inv, posun, rotace, apl, resLin, prng, MODELY, ransac, fitHomografie, fitEuklid, fitPosun,
  sedy, rozmaz, harris, naValec, deskriptory, paruj, ham, naProj, zProj, pohled, obrazNaPano, panoNaObraz, obrys, hranice,
  ohniskoPx, ekv35, zEkv35, zarovnej, upravena, vzorek, zisky, novyVystup, poradi, pridej, sloz, nejvetsiObdelnik,
  exif, pohledZValce
};
});

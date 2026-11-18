/* Skládání panoramat – jádro bez DOM (prohlížeč, Web Worker i node).
   Body: Harris + BRIEF na snímku promítnutém na kouli, párování Hammingovou vzdáleností, RANSAC homografie,
   kontrolní body (automatické + ruční), sférický model kamery (rotace + ohnisko), počáteční odhad po kostře grafu,
   globální optimalizace (bundle adjustment, Levenberg–Marquardt s Huberovou ztrátou), vyrovnání horizontu,
   výstupní projekce, EXIF. Rovinná mozaika (skeny) zůstává 2D: posun / posun+otočení / homografie po kostře.
   Kamera: x vpravo, y dolů, z dopředu; R = svět → kamera (řádky = osy kamery ve světě).
   Kontrolní body: kb = [{ a, b, body: [[xa, ya, xb, yb, rucni], …] }] v px náhledu (počátek vlevo nahoře). */
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
const tr = m => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const posun = (x, y) => [1, 0, x, 0, 1, y, 0, 0, 1];
const rotace = a => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
function apl(m, x, y) {
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
}
const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const mtv = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
const norm = v => { const d = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / d, v[1] / d, v[2] / d]; };
const krizem = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const skal = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/* Rodriguesova rotace podle vektoru w (osa × úhel v rad) */
function rod(w) {
  const t = Math.hypot(w[0], w[1], w[2]);
  if (t < 1e-12) return [1, -w[2], w[1], w[2], 1, -w[0], -w[1], w[0], 1];
  const [x, y, z] = [w[0] / t, w[1] / t, w[2] / t], c = Math.cos(t), s = Math.sin(t), C = 1 - c;
  return [c + x * x * C, x * y * C - z * s, x * z * C + y * s,
    y * x * C + z * s, c + y * y * C, y * z * C - x * s,
    z * x * C - y * s, z * y * C + x * s, c + z * z * C];
}
const rotY = a => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
const rotX = a => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
const rotZ = rotace;
const RAD = Math.PI / 180;
/* kamera natočená o yaw (vpravo +), pitch (nahoru +), roll (po směru hodin +) ve stupních → R svět→kamera */
const rotKamery = (yaw, pitch, roll = 0) => tr(nas(nas(rotY(yaw * RAD), rotX(pitch * RAD)), rotZ(roll * RAD)));
/* opak: R (svět→kamera) → { yaw, pitch, roll } ve stupních */
function yprZRotace(R) {
  const C = tr(R), F = [C[2], C[5], C[8]];
  const yaw = Math.atan2(F[0], F[2]), pitch = Math.asin(Math.max(-1, Math.min(1, -F[1])));
  const Z = nas(tr(nas(rotY(yaw), rotX(pitch))), C);
  return { yaw: yaw / RAD, pitch: pitch / RAD, roll: Math.atan2(Z[3], Z[0]) / RAD };
}
/* úhel rotace mezi dvěma maticemi (rad) */
function uhelMezi(A, B) {
  const M = nas(A, tr(B)), c = (M[0] + M[4] + M[8] - 1) / 2;
  return Math.acos(Math.max(-1, Math.min(1, c)));
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
/* vlastní čísla a vektory symetrické matice (Jacobi); A = pole řádků; vektory jsou sloupce V */
function jacobi(A0) {
  const n = A0.length, A = A0.map(r => r.slice()), V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => +(i === j)));
  for (let k = 0; k < 60; k++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-300) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let r = 0; r < n; r++) { const ap = A[r][p], aq = A[r][q]; A[r][p] = c * ap - s * aq; A[r][q] = s * ap + c * aq; }
      for (let r = 0; r < n; r++) { const ap = A[p][r], aq = A[q][r]; A[p][r] = c * ap - s * aq; A[q][r] = s * ap + c * aq; }
      for (let r = 0; r < n; r++) { const vp = V[r][p], vq = V[r][q]; V[r][p] = c * vp - s * vq; V[r][q] = s * vp + c * vq; }
    }
  }
  return { hodnoty: A.map((r, i) => r[i]), V };
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

/* ---------- 2D modely: páry [xa, ya, xb, yb], model převádí b → a ---------- */
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
/* RANSAC + tři kola zpřesnění nejmenšími čtverci na inlierech */
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
  const nejA = new Int32Array(na).fill(-1), nejB = new Int32Array(nb).fill(-1), dB = new Int32Array(nb).fill(999);
  for (let i = 0; i < na; i++) {
    let b1 = 999, b2 = 999, bj = -1;
    for (let j = 0; j < nb; j++) {
      const h = ham(A, i, B, j);
      if (h < b1) { b2 = b1; b1 = h; bj = j; } else if (h < b2) b2 = h;
      if (h < dB[j]) { dB[j] = h; nejB[j] = i; }
    }
    if (b1 <= maxD && b1 < pomer * b2) nejA[i] = bj;
  }
  const r = [];
  for (let i = 0; i < na; i++) if (nejA[i] >= 0 && nejB[nejA[i]] === i) r.push([i, nejA[i]]);
  return r;
}

/* ---------- místní sférické promítnutí snímku (jen pro hledání bodů) ----------
   (u, v) = f·(zeměpisná délka, šířka) paprsku vůči ose snímku; okraje širokoúhlých snímků se tak
   nenatahují a BRIEF najde stejná místa i u sousedů vlevo, vpravo, nahoře i dole */
function lokNaObraz(f, u, v) {
  const lo = u / f, la = v / f;
  if (!(Math.abs(lo) < 1.45 && Math.abs(la) < 1.45)) return null;
  const rx = Math.sin(lo) * Math.cos(la), ry = Math.sin(la), rz = Math.cos(lo) * Math.cos(la);
  return [f * rx / rz, f * ry / rz];
}
function obrazNaLok(f, xc, yc) { return [f * Math.atan2(xc, f), f * Math.atan2(yc, Math.hypot(xc, f))]; }
function naKouli(g, f) {
  const { w, h, d } = g, cx = (w - 1) / 2, cy = (h - 1) / 2;
  const W = 2 * Math.ceil(f * Math.atan(cx / f)) + 3, H = 2 * Math.ceil(f * Math.atan(cy / f)) + 3, ox = (W - 1) / 2, oy = (H - 1) / 2;
  const out = new Float32Array(W * H), maska = new Uint8Array(W * H);
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    const q = lokNaObraz(f, X - ox, Y - oy);
    if (!q) continue;
    let x = q[0] + cx, y = q[1] + cy;
    const uvnitr = x >= 0 && y >= 0 && x <= w - 1 && y <= h - 1;
    x = Math.min(Math.max(x, 0), w - 1); y = Math.min(Math.max(y, 0), h - 1);
    const xi = Math.min(Math.floor(x), w - 2), yi = Math.min(Math.floor(y), h - 2), fx = x - xi, fy = y - yi, i = yi * w + xi;
    out[Y * W + X] = (d[i] * (1 - fx) + d[i + 1] * fx) * (1 - fy) + (d[i + w] * (1 - fx) + d[i + w + 1] * fx) * fy;
    maska[Y * W + X] = uvnitr ? 1 : 0;
  }
  return { w: W, h: H, d: out, ox, oy, maska };
}

/* ---------- ohnisko ---------- */
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
/* ohniska z homografie čistě otočené kamery (Szeliski & Shum 1997); H převádí b → a, souřadnice od středu */
function ohniskaZHomografie(H) {
  const h = H.map(v => v / H[8]), r = [];
  const vyber = (d1, d2, v1, v2) => {
    if (v1 < v2) [v1, v2] = [v2, v1];
    if (v1 > 0 && v2 > 0) return Math.sqrt(Math.abs(d1) > Math.abs(d2) ? v1 : v2);
    return v1 > 0 ? Math.sqrt(v1) : null;
  };
  let d1 = h[6] * h[7], d2 = (h[7] - h[6]) * (h[7] + h[6]);
  r[1] = vyber(d1, d2, -(h[0] * h[1] + h[3] * h[4]) / d1, (h[0] * h[0] + h[3] * h[3] - h[1] * h[1] - h[4] * h[4]) / d2);
  d1 = h[0] * h[3] + h[1] * h[4]; d2 = h[0] * h[0] + h[1] * h[1] - h[3] * h[3] - h[4] * h[4];
  r[0] = vyber(d1, d2, -h[2] * h[5] / d1, (h[5] * h[5] - h[2] * h[2]) / d2);
  return r.every(v => v && isFinite(v)) ? r : null;
}

/* ---------- rotace z dvojic paprsků (Horn, kvaterniony): a ≈ R·b ---------- */
function rotaceZPaprsku(A, B) {
  const S = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let k = 0; k < A.length; k++) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) S[i * 3 + j] += B[k][i] * A[k][j];
  const [xx, xy, xz, yx, yy, yz, zx, zy, zz] = S;
  const N = [
    [xx + yy + zz, yz - zy, zx - xz, xy - yx],
    [yz - zy, xx - yy - zz, xy + yx, zx + xz],
    [zx - xz, xy + yx, -xx + yy - zz, yz + zy],
    [xy - yx, zx + xz, yz + zy, -xx - yy + zz]];
  const e = jacobi(N);
  let m = 0;
  for (let i = 1; i < 4; i++) if (e.hodnoty[i] > e.hodnoty[m]) m = i;
  const [w, x, y, z] = e.V.map(r => r[m]);
  return [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
}
/* paprsek kamery (jednotkový) z bodu se středem v (0,0) */
const paprsek = (x, y, f) => norm([x, y, f]);

/* ---------- hledání kontrolních bodů ----------
   snimky[i] = { w, h, sedy: Float32Array, f (px náhledu) }; do snímků se ukládá body/desk (cache)
   nast = { projekce ('rovina' = 2D mozaika), model (jen rovina), maxBody, prah, rucni: kb ručních bodů }
   → { kb (jen inliery + ruční body), statistika: [{ a, b, shod, kandidat, inl }] } */
function najdiBody(snimky, nast = {}, prubeh = () => {}) {
  const n = snimky.length, rovina = nast.projekce === 'rovina';
  const typ = rovina ? (MODELY[nast.model] ? nast.model : 'homografie') : 'homografie';
  snimky.forEach((s, i) => {
    const klic = (nast.maxBody || 600) + '|' + (rovina ? 0 : s.f);
    if (s.body && s.klic === klic) return;
    prubeh('Hledám body ve snímku ' + (i + 1), i / n * 0.3);
    const cx = (s.w - 1) / 2, cy = (s.h - 1) / 2;
    let g = { w: s.w, h: s.h, d: s.sedy }, k = null;
    if (!rovina) k = naKouli(g, s.f), g = k;
    let body = harris(g, { max: nast.maxBody || 600 });
    if (k) {
      const ok = (x, y) => k.maska[Math.round(y) * g.w + Math.round(x)];
      body = body.filter(p => ok(p.x - 15, p.y - 15) && ok(p.x + 15, p.y - 15) && ok(p.x - 15, p.y + 15) && ok(p.x + 15, p.y + 15));
    }
    s.desk = deskriptory(rozmaz(g, 2), body);
    // poloha bodu v px snímku se středem v (0,0)
    s.body = body.map(p => k ? lokNaObraz(s.f, p.x - k.ox, p.y - k.oy) : [p.x - cx, p.y - cy]);
    s.klic = klic;
  });
  const kb = [], stat = [], pocet = n * (n - 1) / 2, prijate = [];
  let poradi = 0;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    prubeh(`Páruji snímky ${a + 1} a ${b + 1}`, 0.3 + 0.6 * (poradi++ / Math.max(1, pocet)));
    const A = snimky[a], B = snimky[b], ca = [(A.w - 1) / 2, (A.h - 1) / 2], cb = [(B.w - 1) / 2, (B.h - 1) / 2];
    const shody = paruj(A.desk, A.body.length, B.desk, B.body.length);
    const pary = shody.map(([i, j]) => [...A.body[i], ...B.body[j]]);
    const ruc = [];
    for (const r of nast.rucni || []) {
      if (r.a === a && r.b === b) for (const q of r.body) ruc.push([q[0] - ca[0], q[1] - ca[1], q[2] - cb[0], q[3] - cb[1]]);
      if (r.a === b && r.b === a) for (const q of r.body) ruc.push([q[2] - ca[0], q[3] - ca[1], q[0] - cb[0], q[1] - cb[1]]);
    }
    const r = ransac(pary, typ, { prah: nast.prah || 2.5, seed: 11 + a * 31 + b });
    const kandidat = r ? r.inliery.length : 0;
    const st = { a, b, shod: shody.length, kandidat, inl: 0 };
    stat.push(st);
    const inl = r && kandidat >= 12 && kandidat > 6 + 0.2 * pary.length ? r.inliery.map(i => pary[i]) : [];
    if (inl.length || ruc.length) prijate.push({ a, b, ca, cb, inl, ruc, H: inl.length ? r.M : null, st });
  }
  // koule: homografie musí odpovídat čisté rotaci kamery (vyřadí falešné dvojice z opakujících se vzorů)
  if (!rovina) {
    let fk = snimky.map(s => s.f);
    if (nast.odhadOhniska) {
      const odh = [];
      for (const p of prijate) { const fs = p.H && ohniskaZHomografie(p.H); if (fs) odh.push(Math.sqrt(fs[0] * fs[1]) / Math.hypot(snimky[p.a].w, snimky[p.a].h)); }
      if (odh.length) { odh.sort((x, y) => x - y); const m = odh[odh.length >> 1]; if (m > 0.1 && m < 20) fk = snimky.map(s => m * Math.hypot(s.w, s.h)); }
    }
    for (const p of prijate) {
      if (!p.inl.length) continue;
      const fa = fk[p.a], fb = fk[p.b], prah = Math.max(8, 0.03 * Math.sqrt(fa * fb));
      const Rab = rotaceZPaprsku(p.inl.map(q => paprsek(q[0], q[1], fa)), p.inl.map(q => paprsek(q[2], q[3], fb)));
      const ok = p.inl.filter(q => { const u = paprsek(q[0], q[1], fa), v = mv(Rab, paprsek(q[2], q[3], fb)); return Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]) * Math.sqrt(fa * fb) < prah; });
      p.inl = ok.length >= 12 && ok.length >= 0.7 * p.inl.length ? ok : [];
    }
  }
  for (const p of prijate) {
    p.st.inl = p.inl.length;
    const body = p.inl.map(q => [q[0] + p.ca[0], q[1] + p.ca[1], q[2] + p.cb[0], q[3] + p.cb[1], 0])
      .concat(p.ruc.map(q => [q[0] + p.ca[0], q[1] + p.ca[1], q[2] + p.cb[0], q[3] + p.cb[1], 1]));
    if (body.length) kb.push({ a: p.a, b: p.b, body });
  }
  prubeh('Body nalezeny', 0.9);
  return { kb, statistika: stat };
}

/* ---------- kostra grafu (Kruskal) a kořen = střed stromu ---------- */
function kostra(n, hrany) {
  const rod = [...Array(n).keys()], najdi = x => rod[x] === x ? x : (rod[x] = najdi(rod[x]));
  const soused = Array.from({ length: n }, () => []);
  for (const e of hrany.slice().sort((x, y) => y.vaha - x.vaha)) {
    const ra = najdi(e.a), rb = najdi(e.b);
    if (ra === rb) continue;
    rod[ra] = rb; e.pouzita = true;
    soused[e.a].push([e.b, e]); soused[e.b].push([e.a, e]);
  }
  const skup = new Map();
  for (let i = 0; i < n; i++) { const r = najdi(i); skup.set(r, (skup.get(r) || []).concat(i)); }
  const hlavni = [...skup.values()].sort((x, y) => y.length - x.length)[0] || [];
  const hloubky = s => { const d = new Map([[s, 0]]), f = [s]; while (f.length) { const u = f.shift(); for (const [v] of soused[u]) if (!d.has(v)) { d.set(v, d.get(u) + 1); f.push(v); } } return d; };
  let koren = hlavni[0], nejV = Infinity;
  for (const s of hlavni) { const m = Math.max(...hloubky(s).values()); if (m < nejV) { nejV = m; koren = s; } }
  // pořadí průchodu do šířky od kořene: [rodič, dítě, hrana]
  const pruchod = [];
  if (koren !== undefined) {
    const vid = new Set([koren]), f = [koren];
    while (f.length) {
      const p = f.shift();
      for (const [c, e] of soused[p]) if (!vid.has(c)) { vid.add(c); pruchod.push([p, c, e]); f.push(c); }
    }
  }
  return { koren, pruchod, hlavni };
}

/* body dvojice se středem v (0,0) */
function stredovane(snimky, e) {
  const A = snimky[e.a], B = snimky[e.b], ax = (A.w - 1) / 2, ay = (A.h - 1) / 2, bx = (B.w - 1) / 2, by = (B.h - 1) / 2;
  return e.body.map(q => [q[0] - ax, q[1] - ay, q[2] - bx, q[3] - by, q[4] || 0]);
}

/* ---------- globální optimalizace (bundle adjustment) ----------
   Chyba bodu = rozdíl jednotkových paprsků ve světě × √(fa·fb) ≈ px. Parametry: malé rotace všech snímků
   kromě kořene, ohnisko (společný násobek / každý snímek / pevné). LM s Huberovou ztrátou. */
function chybaBodu(Ra, fa, Rb, fb, q, meritko) {
  const ra = mtv(Ra, paprsek(q[0], q[1], fa)), rb = mtv(Rb, paprsek(q[2], q[3], fb)), s = meritko || Math.sqrt(fa * fb);
  return [(ra[0] - rb[0]) * s, (ra[1] - rb[1]) * s, (ra[2] - rb[2]) * s];
}
function ba(R, f, body, koren, o = {}) {
  const n = R.length, delta = o.huber || 2, rezim = o.ohnisko || 'spolecne';
  const iR = new Array(n).fill(-1), iF = new Array(n).fill(-1);
  let p = 0;
  for (let i = 0; i < n; i++) if (R[i] && i !== koren) { iR[i] = p; p += 3; }
  if (rezim === 'spolecne') { const j = p++; for (let i = 0; i < n; i++) if (R[i]) iF[i] = j; }
  else if (rezim === 'kazdy') for (let i = 0; i < n; i++) if (R[i]) iF[i] = p++;
  const pouzite = body.filter(b => R[b.a] && R[b.b]);
  // pevné měřítko chyby z počátečních ohnisek: s měřítkem podle aktuálního f by zmenšení ohniska
  // „zmenšilo" i chyby odlehlých bodů a optimalizace by ohnisko stáhla k nesmyslu
  for (const b of pouzite) b.s = Math.sqrt(f[b.a] * f[b.b]);
  const ztrata = r2 => r2 <= delta * delta ? r2 : 2 * delta * Math.sqrt(r2) - delta * delta;
  const cena = (R, f) => { let s = 0; for (const b of pouzite) { const r = chybaBodu(R[b.a], f[b.a], R[b.b], f[b.b], b.q, b.s); s += ztrata(r[0] * r[0] + r[1] * r[1] + r[2] * r[2]); } return s; };
  R = R.map(r => r && r.slice()); f = f.slice();
  let c0 = cena(R, f), lambda = 1e-3, iter = 0;
  const eps = 1e-6, maxIter = o.iter || 60;
  if (!p || !pouzite.length) return { R, f, iter, cena: c0 };
  for (; iter < maxIter; iter++) {
    const A = Array.from({ length: p }, () => new Float64Array(p)), g = new Float64Array(p);
    const sl = new Array(8), J = Array.from({ length: 8 }, () => [0, 0, 0]);
    for (const b of pouzite) {
      const r0 = chybaBodu(R[b.a], f[b.a], R[b.b], f[b.b], b.q, b.s), d = Math.hypot(r0[0], r0[1], r0[2]);
      const w = d <= delta ? 1 : delta / d;
      let m = 0;
      for (const [i, strana] of [[b.a, 0], [b.b, 1]]) {
        if (iR[i] >= 0) for (let k = 0; k < 3; k++) {
          const ww = [0, 0, 0]; ww[k] = eps;
          const Ri = nas(rod(ww), R[i]);
          const r1 = strana ? chybaBodu(R[b.a], f[b.a], Ri, f[b.b], b.q, b.s) : chybaBodu(Ri, f[b.a], R[b.b], f[b.b], b.q, b.s);
          sl[m] = iR[i] + k; J[m][0] = (r1[0] - r0[0]) / eps; J[m][1] = (r1[1] - r0[1]) / eps; J[m][2] = (r1[2] - r0[2]) / eps; m++;
        }
        if (iF[i] >= 0) {
          const fe = f.slice(); fe[i] *= Math.exp(eps);
          const r1 = chybaBodu(R[b.a], fe[b.a], R[b.b], fe[b.b], b.q, b.s);
          sl[m] = iF[i]; J[m][0] = (r1[0] - r0[0]) / eps; J[m][1] = (r1[1] - r0[1]) / eps; J[m][2] = (r1[2] - r0[2]) / eps; m++;
        }
      }
      // společné ohnisko: obě strany mají týž parametr → dva sloupce se stejným indexem, v JᵀJ se správně sečtou
      for (let u = 0; u < m; u++) {
        const pu = sl[u];
        g[pu] += w * (J[u][0] * r0[0] + J[u][1] * r0[1] + J[u][2] * r0[2]);
        for (let v = 0; v < m; v++) A[pu][sl[v]] += w * (J[u][0] * J[v][0] + J[u][1] * J[v][1] + J[u][2] * J[v][2]);
      }
    }
    let zlepseno = false;
    for (let pokus = 0; pokus < 10; pokus++) {
      const M = A.map((r, i) => { const x = Array.from(r); x[i] += lambda * (r[i] || 1e-9) + 1e-12; return x; });
      const dx = resLin(M, Array.from(g, v => -v));
      if (!dx || dx.some(v => !isFinite(v))) { lambda *= 10; continue; }
      const R2 = R.map((r, i) => r && iR[i] >= 0 ? nas(rod([dx[iR[i]], dx[iR[i] + 1], dx[iR[i] + 2]]), r) : r);
      const f2 = f.map((v, i) => iF[i] >= 0 ? v * Math.exp(dx[iF[i]]) : v);
      const c1 = cena(R2, f2);
      if (c1 < c0) {
        const rel = (c0 - c1) / Math.max(c0, 1e-12);
        R = R2; f = f2; c0 = c1; lambda = Math.max(1e-9, lambda / 3); zlepseno = true;
        if (rel < 1e-8) iter = maxIter;
        break;
      }
      lambda *= 4;
    }
    if (!zlepseno) break;
  }
  return { R, f, iter, cena: c0 };
}

/* ---------- vyrovnání horizontu a středu (Brown & Lowe): osy x kamer leží vodorovně ----------
   → Rv (svět → pano): řádky = vpravo, dolů, dopředu */
function vyrovnani(R) {
  const akt = R.filter(Boolean);
  if (!akt.length) return I3();
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], dolu = [0, 0, 0], vpred = [0, 0, 0];
  for (const r of akt) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += r[i] * r[j];
    for (let i = 0; i < 3; i++) { dolu[i] += r[3 + i]; vpred[i] += r[6 + i]; }
  }
  const e = jacobi(C), por = [0, 1, 2].sort((a, b) => e.hodnoty[a] - e.hodnoty[b]);
  let d;
  if (e.hodnoty[por[1]] > 0.05 * akt.length) {
    d = norm(e.V.map(r => r[por[0]]));
    if (skal(d, dolu) < 0) d = d.map(v => -v);
  } else d = norm(dolu);   // jediná osa x (např. dva snímky) → svislice podle průměru kamer
  let F = vpred.map((v, i) => v - skal(vpred, d) * d[i]);
  if (Math.hypot(...F) < 0.25 * akt.length) { const z = [akt[0][6], akt[0][7], akt[0][8]]; F = z.map((v, i) => v - skal(z, d) * d[i]); }
  F = norm(F);
  const X = norm(krizem(d, F));
  return [...X, ...d, ...F];
}
/* uživatelské natočení pohledu (stupně) */
const pohledU = (yaw = 0, pitch = 0, roll = 0) => nas(nas(rotZ(roll * RAD), rotX(pitch * RAD)), rotY(yaw * RAD));

/* ---------- optimalizace nad kontrolními body ----------
   start = { R, f } (teplý start, volitelně); nast = { projekce, model, ohnisko ('spolecne'|'kazdy'|'pevne'),
   odhadOhniska, ba (false = bez BA), vyrovnat }
   → koule: { R: [9 | null], f, Rv, koren, hrany, chyby, rms }; rovina: { T, … } */
function optimalizuj(snimky, kb, nast = {}, start = null) {
  let v = optimalizujJednou(snimky, kb, nast, start);
  if (!nast.cistit || v.T) return v;
  // čištění automatických bodů: odlehlé body a celé špatné dvojice (opakující se vzory) pryč, výpočet znovu
  for (let kolo = 0; kolo < 3; kolo++) {
    const vse = v.chyby.flat().filter(x => x != null).sort((a, b) => a - b);
    if (!vse.length) break;
    const prah = Math.max(3, 6 * vse[vse.length >> 1]);
    let zmena = false;
    const nove = v.kb.map((e, i) => {
      const c = v.chyby[i], cc = c.filter(x => x != null);
      const rms = cc.length ? Math.sqrt(cc.reduce((s, x) => s + x * x, 0) / cc.length) : 0;
      const body = e.body.filter((q, j) => q[4] || !(rms > prah || (c[j] != null && c[j] > prah)));
      if (body.length !== e.body.length) zmena = true;
      return { a: e.a, b: e.b, body };
    }).filter(e => e.body.length);
    if (!zmena) break;
    v = optimalizujJednou(snimky, nove, nast, null);
  }
  return v;
}
function optimalizujJednou(snimky, kb, nast, start) {
  const n = snimky.length, rovina = nast.projekce === 'rovina';
  const typ = rovina ? (MODELY[nast.model] ? nast.model : 'homografie') : null;
  const min = rovina ? MODELY[typ].min : 2;
  kb = kb.filter(e => e.a !== e.b && snimky[e.a] && snimky[e.b] && e.body.length);
  const hrany = kb.map(e => {
    const q = stredovane(snimky, e), ruc = q.filter(x => x[4]).length;
    return { a: e.a, b: e.b, q, vaha: q.length + 10 * ruc, pouzita: false, ok: q.length >= min };
  });
  const k = kostra(n, hrany.filter(e => e.ok));
  const koren = k.koren;
  let vysl;
  if (rovina) {
    const T = new Array(n).fill(null);
    if (koren !== undefined) {
      T[koren] = I3();
      for (const [p, c, e] of k.pruchod) {
        const M = MODELY[typ].fit(e.q) || I3();     // M: b → a
        T[c] = e.a === p ? nas(T[p], M) : nas(T[p], inv(M) || I3());
      }
    }
    const chyby = hrany.map(e => e.q.map(q => {
      if (!T[e.a] || !T[e.b]) return null;
      const M = nas(inv(T[e.a]) || I3(), T[e.b]), [x, y] = apl(M, q[2], q[3]);
      return Math.hypot(x - q[0], y - q[1]);
    }));
    vysl = { T, koren, kb };
    return dokonci(vysl, hrany, chyby);
  }
  // ohnisko
  let f = snimky.map(s => s.f);
  if (nast.odhadOhniska) {
    const odh = [];
    for (const e of hrany) {
      if (e.q.length < 8) continue;
      const H = fitHomografie(e.q), fs = H && ohniskaZHomografie(H);
      if (fs) odh.push(Math.sqrt(fs[0] * fs[1]) / Math.hypot(snimky[e.a].w, snimky[e.a].h));
    }
    if (odh.length) {
      odh.sort((a, b) => a - b);
      const m = odh[odh.length >> 1];
      if (m > 0.1 && m < 20) f = snimky.map(s => m * Math.hypot(s.w, s.h));
    }
  }
  if (start && start.f) f = f.map((v, i) => start.f[i] || v);
  // počáteční rotace po kostře (nebo teplý start)
  let R = new Array(n).fill(null);
  const vKostre = new Set(koren === undefined ? [] : [koren, ...k.pruchod.map(x => x[1])]);
  if (start && start.R && [...vKostre].every(i => start.R[i])) {
    for (const i of vKostre) R[i] = start.R[i].slice();
  } else if (koren !== undefined) {
    R[koren] = I3();
    for (const [p, c, e] of k.pruchod) {
      const Rab = rotaceZPaprsku(e.q.map(q => paprsek(q[0], q[1], f[e.a])), e.q.map(q => paprsek(q[2], q[3], f[e.b])));
      R[c] = e.a === p ? nas(tr(Rab), R[p]) : nas(Rab, R[p]);
    }
  }
  let iter = 0;
  if (nast.ba !== false) {
    const body = [];
    for (const e of hrany) for (const q of e.q) body.push({ a: e.a, b: e.b, q });
    const b = ba(R, f, body, koren, { ohnisko: nast.ohnisko || 'spolecne', huber: nast.huber });
    R = b.R; f = b.f; iter = b.iter;
  }
  const chyby = hrany.map(e => e.q.map(q => {
    if (!R[e.a] || !R[e.b]) return null;
    const r = chybaBodu(R[e.a], f[e.a], R[e.b], f[e.b], q);
    return Math.hypot(r[0], r[1], r[2]);
  }));
  vysl = { R, f, koren, iter, kb, Rv: nast.vyrovnat === false ? I3() : vyrovnani(R) };
  return dokonci(vysl, hrany, chyby);
}
function dokonci(v, hrany, chyby) {
  let s = 0, m = 0, max = 0;
  v.hrany = hrany.map((e, i) => {
    const c = chyby[i].filter(x => x != null);
    const ss = c.reduce((t, x) => t + x * x, 0);
    s += ss; m += c.length;
    const mx = c.length ? Math.max(...c) : 0;
    if (mx > max) max = mx;
    return { a: e.a, b: e.b, n: e.q.length, rucne: e.q.filter(x => x[4]).length, pouzita: e.pouzita, rms: c.length ? Math.sqrt(ss / c.length) : null, max: mx };
  });
  v.chyby = chyby;
  v.rms = m ? Math.sqrt(s / m) : null;
  v.max = max;
  v.spojene = (v.R || v.T).map(Boolean);
  return v;
}

/* ---------- výstupní projekce: směr v pano (x vpravo, y dolů, z dopředu) ↔ rovina (X, Y) ---------- */
const LAT = 85 * RAD;
const PROJEKCE = {
  equi: { nazev: 'Sférická (equirectangular)', delka: true, meze: [-Math.PI, -Math.PI / 2, Math.PI, Math.PI / 2],
    tam: d => [Math.atan2(d[0], d[2]), Math.asin(Math.max(-1, Math.min(1, d[1])))],
    zpet: (X, Y) => Math.abs(Y) > Math.PI / 2 ? null : [Math.sin(X) * Math.cos(Y), Math.sin(Y), Math.cos(X) * Math.cos(Y)] },
  valec: { nazev: 'Válcová', delka: true, meze: [-Math.PI, -Math.tan(LAT), Math.PI, Math.tan(LAT)],
    tam: d => { const h = Math.hypot(d[0], d[2]); return h < 1e-9 ? null : [Math.atan2(d[0], d[2]), d[1] / h]; },
    zpet: (X, Y) => norm([Math.sin(X), Y, Math.cos(X)]) },
  mercator: { nazev: 'Mercatorova', delka: true, meze: [-Math.PI, -Math.atanh(Math.sin(LAT)), Math.PI, Math.atanh(Math.sin(LAT))],
    tam: d => Math.abs(d[1]) > 0.9999 ? null : [Math.atan2(d[0], d[2]), Math.atanh(d[1])],
    zpet: (X, Y) => { const la = Math.atan(Math.sinh(Y)); return [Math.sin(X) * Math.cos(la), Math.sin(la), Math.cos(X) * Math.cos(la)]; } },
  primo: { nazev: 'Přímočará (rectilinear)', delka: false, meze: [-3.5, -3.5, 3.5, 3.5],
    tam: d => d[2] > 0.05 ? [d[0] / d[2], d[1] / d[2]] : null,
    zpet: (X, Y) => norm([X, Y, 1]) },
  stereo: { nazev: 'Malá planeta (stereografická)', delka: false, meze: [-4.5, -4.5, 4.5, 4.5],
    tam: d => { const t = Math.acos(Math.max(-1, Math.min(1, d[1]))); if (t > 160 * RAD) return null; const r = 2 * Math.tan(t / 2), h = Math.hypot(d[0], d[2]) || 1; return [r * d[0] / h, -r * d[2] / h]; },
    zpet: (X, Y) => { const r = Math.hypot(X, Y), t = 2 * Math.atan(r / 2), s = Math.sin(t); return r < 1e-12 ? [0, 1, 0] : [s * X / r, Math.cos(t), -s * Y / r]; } }
};

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
/* bilineárně z equirect předlohy s obtočením vodorovně */
function vzorekEqui(tex, lon, lat, out) {
  const { w, h, d } = tex;
  let u = (lon / (2 * Math.PI) + 0.5) * w - 0.5, v = (lat / Math.PI + 0.5) * h - 0.5;
  v = Math.min(Math.max(v, 0), h - 1);
  u = ((u % w) + w) % w;
  const x0 = Math.floor(u), x1 = (x0 + 1) % w, fx = u - x0, y0 = Math.min(Math.floor(v), h - 2), fy = v - y0;
  for (let c = 0; c < 3; c++) {
    const a = d[(y0 * w + x0) * 4 + c], b = d[(y0 * w + x1) * 4 + c], e = d[((y0 + 1) * w + x0) * 4 + c], g = d[((y0 + 1) * w + x1) * 4 + c];
    out[c] = (a * (1 - fx) + b * fx) * (1 - fy) + (e * (1 - fx) + g * fx) * fy;
  }
}
/* perspektivní snímek z equirect předlohy (ukázka a testy): R = svět → kamera, f v px */
function pohledZKoule(tex, f, R, w, h, nasob = 1) {
  const d = new Uint8ClampedArray(w * h * 4), c = [0, 0, 0], cx = (w - 1) / 2, cy = (h - 1) / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = mtv(R, paprsek(x - cx, y - cy, f)), i = (y * w + x) * 4;
    vzorekEqui(tex, Math.atan2(r[0], r[2]), Math.asin(r[1]), c);
    d[i] = c[0] * nasob; d[i + 1] = c[1] * nasob; d[i + 2] = c[2] * nasob; d[i + 3] = 255;
  }
  return { w, h, d };
}

/* ---------- doladění ručního bodu korelací (NCC) v okolí ---------- */
function dolad(gA, xa, ya, gB, xb, yb, o = {}) {
  const r = o.okno || 7, hl = o.hledat || 8;
  const okno = (g, x, y) => {
    const v = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const X = Math.round(x) + dx, Y = Math.round(y) + dy;
      if (X < 0 || Y < 0 || X >= g.w || Y >= g.h) return null;
      v.push(g.d[Y * g.w + X]);
    }
    const m = v.reduce((s, t) => s + t, 0) / v.length;
    let s2 = 0;
    for (let i = 0; i < v.length; i++) { v[i] -= m; s2 += v[i] * v[i]; }
    return s2 > 1e-6 ? { v, s: Math.sqrt(s2) } : null;
  };
  const T = okno(gA, xa, ya);
  if (!T) return { x: xb, y: yb, ncc: 0 };
  let best = { x: xb, y: yb, ncc: -2 };
  const sk = [];
  for (let dy = -hl; dy <= hl; dy++) {
    const radek = [];
    for (let dx = -hl; dx <= hl; dx++) {
      const W = okno(gB, xb + dx, yb + dy);
      let c = -2;
      if (W) { c = 0; for (let i = 0; i < T.v.length; i++) c += T.v[i] * W.v[i]; c /= T.s * W.s; }
      radek.push(c);
      if (c > best.ncc) best = { x: Math.round(xb) + dx, y: Math.round(yb) + dy, ncc: c, i: dx + hl, j: dy + hl };
    }
    sk.push(radek);
  }
  // subpixel: parabola v x a y
  if (best.i > 0 && best.i < 2 * hl && best.j > 0 && best.j < 2 * hl) {
    const s = (a, b, c) => { const den = a - 2 * b + c; return den < 0 ? Math.max(-0.5, Math.min(0.5, (a - c) / (2 * den))) : 0; };
    best.x += s(sk[best.j][best.i - 1], sk[best.j][best.i], sk[best.j][best.i + 1]);
    best.y += s(sk[best.j - 1][best.i], sk[best.j][best.i], sk[best.j + 1][best.i]);
  }
  return { x: best.x, y: best.y, ncc: best.ncc };
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

return {
  I3, nas, inv, tr, posun, rotace, apl, mv, mtv, norm, rod, rotX, rotY, rotZ, rotKamery, yprZRotace, uhelMezi, RAD,
  resLin, jacobi, prng, MODELY, ransac, fitHomografie, fitEuklid, fitPosun,
  sedy, rozmaz, rozmazBox, harris, deskriptory, paruj, ham, naKouli, lokNaObraz, obrazNaLok,
  ohniskoPx, ekv35, zEkv35, ohniskaZHomografie, rotaceZPaprsku, paprsek,
  najdiBody, kostra, optimalizuj, ba, chybaBodu, vyrovnani, pohledU, PROJEKCE,
  vzorek, vzorekEqui, pohledZKoule, dolad, exif
};
});

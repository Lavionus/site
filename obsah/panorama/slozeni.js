/* Skládání panoramat – vykreslení výstupu (bez DOM): pohledy snímků, rozvržení výstupu včetně obtočení 360°,
   vyrovnání expozice, šev (váhy / nejmenší rozdíl), prolnutí (žádné / lineární / vícepásmové), ořez,
   XMP GPano do JPEG a PNG, čtení GPano, pohled 360° a export projektu pro Hugin (.pto).
   Rozšiřuje objekt PANO z jadro.js. Výstupní pixel (X, Y) = bod roviny projekce (x0 + X/k, y0 + Y/k). */
'use strict';
(function (koren, tovarna) {
  const P = typeof module === 'object' && module.exports ? require('./jadro.js') : koren.PANO;
  Object.assign(P, tovarna(P));
  if (typeof module === 'object' && module.exports) module.exports = P;
})(typeof self !== 'undefined' ? self : this, function (P) {
const { nas, tr, mv, mtv, apl, inv, paprsek, PROJEKCE } = P;
const PI2 = 2 * Math.PI;

/* ---------- pohledy ---------- */
/* koule: M = pano → kamera; rovina: T = snímek (od středu) → pano */
function pohledKoule(w, h, f, M, proj) { return { typ: 'koule', w, h, f, M, proj: PROJEKCE[proj], cx: (w - 1) / 2, cy: (h - 1) / 2 }; }
function pohledRovina(w, h, T) { return { typ: 'rovina', w, h, T, Ti: inv(T), cx: (w - 1) / 2, cy: (h - 1) / 2 }; }
function naPano(v, x, y) {
  if (v.typ === 'rovina') return apl(v.T, x - v.cx, y - v.cy);
  return v.proj.tam(mtv(v.M, paprsek(x - v.cx, y - v.cy, v.f)));
}
function doObrazu(v, X, Y) {
  if (v.typ === 'rovina') { const q = apl(v.Ti, X, Y); return [q[0] + v.cx, q[1] + v.cy]; }
  const d = v.proj.zpet(X, Y);
  if (!d) return null;
  const c = mv(v.M, d);
  if (c[2] <= 1e-6) return null;
  return [v.cx + v.f * c[0] / c[2], v.cy + v.f * c[1] / c[2]];
}
function obrys(v, n = 16) {
  const r = [], W = v.w - 1, H = v.h - 1;
  for (let i = 0; i < n; i++) r.push(naPano(v, W * i / n, 0));
  for (let i = 0; i < n; i++) r.push(naPano(v, W, H * i / n));
  for (let i = 0; i < n; i++) r.push(naPano(v, W - W * i / n, H));
  for (let i = 0; i < n; i++) r.push(naPano(v, 0, H - H * i / n));
  return r;
}
/* obrys v rovině výstupu s rozbalenou délkou (pro kreslení rámečků) */
function obrysRozbaleny(v, n, x0) {
  const pts = obrys(v, n).filter(Boolean);
  if (v.typ !== 'koule' || !v.proj.delka || !pts.length) return pts;
  const c = naPano(v, v.cx, v.cy) || pts[0];
  const cx = x0 + (((c[0] - x0) % PI2) + PI2) % PI2;
  return pts.map(([X, Y]) => [X + PI2 * Math.round((cx - X) / PI2), Y]);
}

/* ---------- rozvržení výstupu: obdélník každého snímku a celé hranice; u projekcí podle délky obtáčení ---------- */
function rozvrh(V) {
  const pr = V[0] && V[0].typ === 'koule' ? V[0].proj : null, delka = !!(pr && pr.delka);
  const boxy = V.map(v => {
    const pts = obrys(v, 24).filter(Boolean);
    if (!pts.length) return null;
    const c = naPano(v, v.cx, v.cy) || pts[0];
    const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, cx: c[0] };
    for (let [X, Y] of pts) {
      if (delka) X += PI2 * Math.round((c[0] - X) / PI2);
      if (X < b.x0) b.x0 = X; if (X > b.x1) b.x1 = X; if (Y < b.y0) b.y0 = Y; if (Y > b.y1) b.y1 = Y;
    }
    if (pr) {
      if (delka) for (const s of [-1, 1]) {      // pól ve snímku → celá šířka a až k mezi
        const k = mv(v.M, [0, s, 0]);
        if (k[2] <= 0) continue;
        const x = v.cx + v.f * k[0] / k[2], y = v.cy + v.f * k[1] / k[2];
        if (x >= 0 && y >= 0 && x <= v.w - 1 && y <= v.h - 1) {
          b.x0 = c[0] - Math.PI; b.x1 = c[0] + Math.PI;
          if (s < 0) b.y0 = pr.meze[1]; else b.y1 = pr.meze[3];
        }
      }
      b.y0 = Math.max(b.y0, pr.meze[1]); b.y1 = Math.min(b.y1, pr.meze[3]);
      if (!delka) { b.x0 = Math.max(b.x0, pr.meze[0]); b.x1 = Math.min(b.x1, pr.meze[2]); }
    }
    return b.x1 > b.x0 && b.y1 > b.y0 ? b : null;
  });
  const platne = boxy.filter(Boolean);
  const r = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, obtoc: false, boxy };
  if (!platne.length) return r;
  for (const b of platne) { r.y0 = Math.min(r.y0, b.y0); r.y1 = Math.max(r.y1, b.y1); }
  if (!delka) {
    for (const b of platne) { r.x0 = Math.min(r.x0, b.x0); r.x1 = Math.max(r.x1, b.x1); }
    return r;
  }
  // kruhové sjednocení intervalů délky: najít největší mezeru, začátek výstupu za ní
  const mod = x => ((x % PI2) + PI2) % PI2;
  const kryje = t => platne.some(b => b.x1 - b.x0 >= PI2 - 1e-9 || mod(t - b.x0) < b.x1 - b.x0);
  let mezera = 0, zac = 0;
  for (const b of platne) {
    const t = b.x1 + 1e-7;
    if (kryje(t)) continue;
    const dalsi = Math.min(...platne.map(c => mod(c.x0 - t)));
    if (dalsi > mezera) { mezera = dalsi; zac = t + dalsi; }
  }
  if (mezera < 1e-6) { r.obtoc = true; r.x0 = -Math.PI; r.x1 = Math.PI; }
  else { r.x0 = zac - PI2 * Math.round(zac / PI2); if (r.x0 >= Math.PI) r.x0 -= PI2; r.x1 = r.x0 + PI2 - mezera; }
  for (const b of platne) { const s = r.x0 + mod(b.x0 - r.x0) - b.x0; b.x0 += s; b.x1 += s; b.cx += s; }
  return r;
}

/* ---------- vzorkování ze zdroje (zdroj může být větší než náhled, ze kterého je pohled) ---------- */
function doZdroje(v, src, X, Y) {
  const q = doObrazu(v, X, Y);
  if (!q) return null;
  return [(q[0] + 0.5) * src.w / v.w - 0.5, (q[1] + 0.5) * src.h / v.h - 0.5];
}

/* ---------- vyrovnání expozice a barev (Brown & Lowe 2007), zisky po kanálech ---------- */
function zisky(V, zdroje, roz, o = {}) {
  const n = V.length;
  const krok = o.krok || Math.max(1e-4, Math.sqrt((roz.x1 - roz.x0) * (roz.y1 - roz.y0) / 40000));
  const N = new Float64Array(n * n), S = new Float64Array(n * n * 3);
  const c = [0, 0, 0], barvy = [], kdo = [];
  for (let Y = roz.y0; Y <= roz.y1; Y += krok) for (let X = roz.x0; X <= roz.x1; X += krok) {
    kdo.length = 0;
    for (let i = 0; i < n; i++) {
      const q = doZdroje(V[i], zdroje[i], X, Y);
      if (q && P.vzorek(zdroje[i], q[0], q[1], c)) { kdo.push(i); barvy[i] = [c[0], c[1], c[2]]; }
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
    const x = P.resLin(A, r);
    if (x) x.forEach((v, i) => { g[i][k] = isFinite(v) && v > 0.2 && v < 5 ? v : 1; });
  }
  return g;
}

/* ---------- výstup ---------- */
function novyVystup(W, H, x0, y0, k, obtoc = false) {
  return { W, H, x0, y0, k, obtoc, d: new Uint8ClampedArray(W * H * 4), vaha: new Uint8Array(W * H) };
}
/* pořadí skládání: podle středu obdélníku zleva doprava, pak shora dolů */
function poradi(roz) {
  return roz.boxy.map((b, i) => i).filter(i => roz.boxy[i])
    .sort((a, b) => { const A = roz.boxy[a], B = roz.boxy[b]; return ((A.x0 + A.x1) - (B.x0 + B.x1)) || ((A.y0 + A.y1) - (B.y0 + B.y1)); });
}

/* pyramidy (5bodové jádro dolů, bilineárně nahoru) */
function dolu(a, w, h) {
  const w2 = (w + 1) >> 1, h2 = (h + 1) >> 1, t = new Float32Array(w2 * h), o = new Float32Array(w2 * h2);
  const K = [1, 4, 6, 4, 1];
  for (let y = 0; y < h; y++) for (let x = 0; x < w2; x++) {
    let s = 0;
    for (let i = -2; i <= 2; i++) s += K[i + 2] * a[y * w + Math.min(w - 1, Math.max(0, 2 * x + i))];
    t[y * w2 + x] = s / 16;
  }
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
    let s = 0;
    for (let i = -2; i <= 2; i++) s += K[i + 2] * t[Math.min(h - 1, Math.max(0, 2 * y + i)) * w2 + x];
    o[y * w2 + x] = s / 16;
  }
  return o;
}
function nahoru(a, w2, h2, w, h) {
  const o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(y / 2, h2 - 1), y0 = Math.min(Math.floor(fy), Math.max(0, h2 - 2)), ty = h2 > 1 ? fy - y0 : 0, y1 = Math.min(y0 + 1, h2 - 1);
    for (let x = 0; x < w; x++) {
      const fx = Math.min(x / 2, w2 - 1), x0 = Math.min(Math.floor(fx), Math.max(0, w2 - 2)), tx = w2 > 1 ? fx - x0 : 0, x1 = Math.min(x0 + 1, w2 - 1);
      o[y * w + x] = (a[y0 * w2 + x0] * (1 - tx) + a[y0 * w2 + x1] * tx) * (1 - ty) + (a[y1 * w2 + x0] * (1 - tx) + a[y1 * w2 + x1] * tx) * ty;
    }
  }
  return o;
}
/* vícepásmové prolnutí (Burt & Adelson): T a O jsou celé (doplněné navzájem), M = váha T */
function prolniPasma(T, O, M, w, h, L) {
  const rozm = [[w, h]];
  for (let l = 0; l < L; l++) { const [a, b] = rozm[l]; rozm.push([(a + 1) >> 1, (b + 1) >> 1]); }
  const Gm = [M];
  for (let l = 0; l < L; l++) Gm.push(dolu(Gm[l], rozm[l][0], rozm[l][1]));
  const LB = [];
  let gt = T, go = O;
  for (let l = 0; l < L; l++) {
    const [a, b] = rozm[l], [a2, b2] = rozm[l + 1];
    const gt2 = dolu(gt, a, b), go2 = dolu(go, a, b), ut = nahoru(gt2, a2, b2, a, b), uo = nahoru(go2, a2, b2, a, b), m = Gm[l];
    const lb = new Float32Array(a * b);
    for (let i = 0; i < lb.length; i++) lb[i] = m[i] * (gt[i] - ut[i]) + (1 - m[i]) * (go[i] - uo[i]);
    LB.push(lb); gt = gt2; go = go2;
  }
  let r = new Float32Array(gt.length);
  const m = Gm[L];
  for (let i = 0; i < r.length; i++) r[i] = m[i] * gt[i] + (1 - m[i]) * go[i];
  for (let l = L - 1; l >= 0; l--) {
    const [a, b] = rozm[l], [a2, b2] = rozm[l + 1], u = nahoru(r, a2, b2, a, b), lb = LB[l];
    for (let i = 0; i < u.length; i++) u[i] += lb[i];
    r = u;
  }
  return r;
}

/* šev dynamickým programováním po nejmenším rozdílu barev (obchází pohyblivé objekty);
   vrátí masku 1 = nový snímek v překryvu, nebo null když překryv není pás */
function sevRozdil(t, tv, o, ov, tw, th, ob, v, out, X0, Y0) {
  const { ox0, oy0, ox1, oy1, pocet } = ob;
  if (pocet < 0.5 * (ox1 - ox0 + 1) * (oy1 - oy0 + 1)) return null;
  const svisly = (oy1 - oy0) >= (ox1 - ox0);
  const np = svisly ? oy1 - oy0 + 1 : ox1 - ox0 + 1, nq = svisly ? ox1 - ox0 + 1 : oy1 - oy0 + 1;
  const xy = (p, q) => svisly ? [ox0 + q, oy0 + p] : [ox0 + p, oy0 + q];
  const C = new Float32Array(np * nq), Z = new Int8Array(np * nq);
  for (let p = 0; p < np; p++) for (let q = 0; q < nq; q++) {
    const [x, y] = xy(p, q), i = y * tw + x;
    let cena = 1e6;
    if (tv[i] && ov[i]) cena = 1 + Math.abs(t[i * 3] - o[i * 3]) + Math.abs(t[i * 3 + 1] - o[i * 3 + 1]) + Math.abs(t[i * 3 + 2] - o[i * 3 + 2]);
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
  // strana nového snímku: kde leží jeho střed vůči překryvu
  const st = naPano(v, v.cx, v.cy);
  let sx = (st[0] - out.x0) * out.k - X0;
  if (out.obtoc) sx -= out.W * Math.round((sx - (ox0 + ox1) / 2) / out.W);
  const sy = (st[1] - out.y0) * out.k - Y0;
  const strana = (svisly ? sx - (ox0 + ox1) / 2 : sy - (oy0 + oy1) / 2) >= 0 ? 1 : -1;
  const M = new Uint8Array(tw * th);
  for (let y = oy0; y <= oy1; y++) for (let x = ox0; x <= ox1; x++) {
    const p = svisly ? y - oy0 : x - ox0, qq = svisly ? x - ox0 : y - oy0;
    M[y * tw + x] = (qq - s[p]) * strana >= 0 ? 1 : 0;
  }
  return M;
}

/* přidá jeden snímek do výstupu.
   o = { prolnuti: 'multi'|'linear'|'zadne', sev: 'vaha'|'rozdil', pas (px přechodu u lineárního), pasma (max. úrovní) } */
function pridej(out, v, box, src, zisk, o = {}) {
  const { W, H, x0, y0, k } = out, od = out.d, g = zisk || [1, 1, 1];
  if (!box) return false;
  let X0 = Math.floor((box.x0 - x0) * k) - 1, X1 = Math.ceil((box.x1 - x0) * k) + 1;
  const Y0 = Math.max(0, Math.floor((box.y0 - y0) * k) - 1), Y1 = Math.min(H - 1, Math.ceil((box.y1 - y0) * k) + 1);
  if (out.obtoc) { if (X1 - X0 + 1 > W) X1 = X0 + W - 1; }
  else { X0 = Math.max(0, X0); X1 = Math.min(W - 1, X1); }
  if (X1 < X0 || Y1 < Y0) return false;
  const tw = X1 - X0 + 1, th = Y1 - Y0 + 1, n = tw * th;
  const t = new Uint8ClampedArray(n * 3), tv = new Uint8Array(n), twt = new Uint8Array(n);
  const o3 = new Uint8ClampedArray(n * 3), ov = new Uint8Array(n), ow = new Uint8Array(n);
  const oi = out.obtoc ? (x, y) => (Y0 + y) * W + ((((X0 + x) % W) + W) % W) : (x, y) => (Y0 + y) * W + X0 + x;
  const c = [0, 0, 0], sx = src.w / v.w, sy = src.h / v.h;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const i = y * tw + x, j = oi(x, y);
    if (od[j * 4 + 3]) { ov[i] = 1; ow[i] = out.vaha[j]; o3[i * 3] = od[j * 4]; o3[i * 3 + 1] = od[j * 4 + 1]; o3[i * 3 + 2] = od[j * 4 + 2]; }
    const q = doObrazu(v, x0 + (X0 + x) / k, y0 + (Y0 + y) / k);
    if (!q || !P.vzorek(src, (q[0] + 0.5) * sx - 0.5, (q[1] + 0.5) * sy - 0.5, c)) continue;
    tv[i] = 1; t[i * 3] = c[0] * g[0]; t[i * 3 + 1] = c[1] * g[1]; t[i * 3 + 2] = c[2] * g[2];
    const nx = Math.abs(q[0] / (v.w - 1) * 2 - 1), ny = Math.abs(q[1] / (v.h - 1) * 2 - 1);
    twt[i] = 1 + Math.round(254 * Math.max(0, 1 - nx) * Math.max(0, 1 - ny));
  }
  // překryv
  const ob = { ox0: Infinity, oy0: Infinity, ox1: -1, oy1: -1, pocet: 0 };
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const i = y * tw + x;
    if (tv[i] && ov[i]) { ob.pocet++; if (x < ob.ox0) ob.ox0 = x; if (x > ob.ox1) ob.ox1 = x; if (y < ob.oy0) ob.oy0 = y; if (y > ob.oy1) ob.oy1 = y; }
  }
  // maska: 1 = nový snímek
  let M = null;
  if (ob.pocet && o.sev === 'rozdil') M = sevRozdil(t, tv, o3, ov, tw, th, ob, v, out, X0, Y0);
  if (!M) { M = new Uint8Array(n); for (let i = 0; i < n; i++) M[i] = tv[i] && (!ov[i] || twt[i] > ow[i]) ? 1 : 0; }
  else for (let i = 0; i < n; i++) if (!(tv[i] && ov[i])) M[i] = tv[i];
  // prolnutí
  const vys = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let ch = 0; ch < 3; ch++) vys[i * 3 + ch] = M[i] ? t[i * 3 + ch] : o3[i * 3 + ch];
  const prol = ob.pocet ? (o.prolnuti || 'multi') : 'zadne';
  if (prol === 'linear' && (o.pas || 0) >= 2) {
    const r = Math.max(1, Math.round(o.pas / 4)), Mf = new Float32Array(n);
    for (let i = 0; i < n; i++) Mf[i] = M[i];
    const a = P.rozmazBox(P.rozmazBox(Mf, tw, th, r), tw, th, r);
    for (let i = 0; i < n; i++) if (tv[i] && ov[i]) for (let ch = 0; ch < 3; ch++) vys[i * 3 + ch] = t[i * 3 + ch] * a[i] + o3[i * 3 + ch] * (1 - a[i]);
  } else if (prol === 'multi') {
    const L0 = Math.floor(Math.log2(Math.max(1, Math.min(ob.ox1 - ob.ox0 + 1, ob.oy1 - ob.oy0 + 1)))) - 1;
    const L = Math.max(0, Math.min(o.pasma || 6, L0));
    if (L > 0) {
      const m = 2 << L, rx0 = Math.max(0, ob.ox0 - m), ry0 = Math.max(0, ob.oy0 - m), rx1 = Math.min(tw - 1, ob.ox1 + m), ry1 = Math.min(th - 1, ob.oy1 + m);
      const rw = rx1 - rx0 + 1, rh = ry1 - ry0 + 1, Mf = new Float32Array(rw * rh), T = new Float32Array(rw * rh), O = new Float32Array(rw * rh);
      for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) Mf[y * rw + x] = M[(ry0 + y) * tw + rx0 + x];
      for (let ch = 0; ch < 3; ch++) {
        for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
          const i = (ry0 + y) * tw + rx0 + x, a = tv[i] ? t[i * 3 + ch] : o3[i * 3 + ch], b = ov[i] ? o3[i * 3 + ch] : t[i * 3 + ch];
          T[y * rw + x] = a; O[y * rw + x] = b;
        }
        const r = prolniPasma(T, O, Mf, rw, rh, L);
        for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
          const i = (ry0 + y) * tw + rx0 + x;
          if (tv[i] || ov[i]) vys[i * 3 + ch] = r[y * rw + x];
        }
      }
    }
  }
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const i = y * tw + x;
    if (!tv[i] && !ov[i]) continue;
    const j = oi(x, y);
    od[j * 4] = vys[i * 3]; od[j * 4 + 1] = vys[i * 3 + 1]; od[j * 4 + 2] = vys[i * 3 + 2]; od[j * 4 + 3] = 255;
    out.vaha[j] = M[i] ? twt[i] : ow[i];
  }
  return true;
}
function sloz(out, V, roz, zdroje, zisk, o) {
  for (const i of poradi(roz)) pridej(out, V[i], roz.boxy[i], zdroje[i], zisk && zisk[i], o);
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

/* ---------- XMP GPano (Photo Sphere) ---------- */
function xmpGPano(g) {
  const a = (k, v) => ` GPano:${k}="${v}"`;
  return '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/">' +
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:GPano="http://ns.google.com/photos/1.0/panorama/"' +
    a('ProjectionType', 'equirectangular') + a('UsePanoramaViewer', 'True') +
    a('CroppedAreaImageWidthPixels', g.W) + a('CroppedAreaImageHeightPixels', g.H) +
    a('FullPanoWidthPixels', g.plnaW) + a('FullPanoHeightPixels', g.plnaH) +
    a('CroppedAreaLeftPixels', g.vlevo) + a('CroppedAreaTopPixels', g.nahore) +
    a('PoseHeadingDegrees', (g.smer || 0).toFixed(1)) + a('StitchingSoftware', 'Skladani panoramat (lavionus.github.io/site)') +
    '/></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
}
/* parametry GPano z výřezu výstupu equirect: k = px na radián, x0/y0 = levý horní roh výřezu v rad */
function gpanoZVyrezu(W, H, x0, y0, k) {
  const plnaW = Math.round(PI2 * k), plnaH = Math.round(Math.PI * k);
  const vlevo = ((Math.round((x0 + Math.PI) * k) % plnaW) + plnaW) % plnaW;
  return { W, H, plnaW, plnaH, vlevo, nahore: Math.max(0, Math.round((y0 + Math.PI / 2) * k)) };
}
const utf8 = s => typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Uint8Array.from(Buffer.from(s, 'utf8'));
/* vloží XMP jako APP1 za SOI (a za JFIF APP0, je-li) */
function vlozXmpJpeg(bajty, xmp) {
  const hl = utf8('http://ns.adobe.com/xap/1.0/\0'), tel = utf8(xmp), delka = 2 + hl.length + tel.length;
  if (delka > 65535) throw new Error('XMP je příliš dlouhé');
  let p = 2;
  if (bajty[2] === 0xFF && bajty[3] === 0xE0) p = 4 + ((bajty[4] << 8) | bajty[5]);
  const r = new Uint8Array(bajty.length + 2 + delka);
  r.set(bajty.subarray(0, p), 0);
  r[p] = 0xFF; r[p + 1] = 0xE1; r[p + 2] = delka >> 8; r[p + 3] = delka & 255;
  r.set(hl, p + 4); r.set(tel, p + 4 + hl.length);
  r.set(bajty.subarray(p), p + 2 + delka);
  return r;
}
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
/* vloží XMP jako iTXt „XML:com.adobe.xmp" hned za IHDR */
function vlozXmpPng(bajty, xmp) {
  const data = new Uint8Array([...utf8('XML:com.adobe.xmp'), 0, 0, 0, 0, 0, ...utf8(xmp)]);
  const typ = utf8('iTXt'), ch = new Uint8Array(12 + data.length), dv = new DataView(ch.buffer);
  dv.setUint32(0, data.length); ch.set(typ, 4); ch.set(data, 8);
  dv.setUint32(8 + data.length, crc32(ch.subarray(4, 8 + data.length)));
  const p = 8 + 12 + new DataView(bajty.buffer, bajty.byteOffset).getUint32(8);   // podpis + IHDR
  const r = new Uint8Array(bajty.length + ch.length);
  r.set(bajty.subarray(0, p), 0); r.set(ch, p); r.set(bajty.subarray(p), p + ch.length);
  return r;
}
/* GPano z bajtů obrázku (JPEG i PNG, XMP je čitelný text) */
function ctiGPano(bajty) {
  const n = Math.min(bajty.length, 1 << 20);
  let s = '';
  for (let i = 0; i < n; i += 8192) s += String.fromCharCode.apply(null, bajty.subarray(i, Math.min(n, i + 8192)));
  if (s.indexOf('GPano') < 0) return null;
  const cti = k => { const m = s.match(new RegExp('GPano:' + k + '(?:="([^"]*)"|>([^<]*)<)')); return m ? (m[1] != null ? m[1] : m[2]) : null; };
  const num = k => { const v = cti(k); return v == null ? null : +v; };
  const g = { typ: cti('ProjectionType'), W: num('CroppedAreaImageWidthPixels'), H: num('CroppedAreaImageHeightPixels'),
    plnaW: num('FullPanoWidthPixels'), plnaH: num('FullPanoHeightPixels'), vlevo: num('CroppedAreaLeftPixels') || 0, nahore: num('CroppedAreaTopPixels') || 0 };
  return g.plnaW && g.plnaH ? g : null;
}

/* ---------- pohled 360°: přímočarý výhled z equirect obrázku ----------
   src = { w, h, d }, g = GPano (nebo null = celá koule), pohled = { yaw, pitch, fov } ve stupních */
function pohled360(src, g, pohled, out) {
  const plnaW = g ? g.plnaW : src.w, plnaH = g ? g.plnaH : src.h, vl = g ? g.vlevo : 0, na = g ? g.nahore : 0;
  const { w, h, d } = out, f = (w / 2) / Math.tan(pohled.fov * P.RAD / 2), cx = (w - 1) / 2, cy = (h - 1) / 2;
  const R = nas(P.rotY(pohled.yaw * P.RAD), P.rotX(pohled.pitch * P.RAD)), c = [0, 0, 0], cela = src.w >= plnaW;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = mv(R, paprsek(x - cx, y - cy, f)), i = (y * w + x) * 4;
    let u = (Math.atan2(r[0], r[2]) / PI2 + 0.5) * plnaW - 0.5 - vl, v = (Math.asin(r[1]) / Math.PI + 0.5) * plnaH - 0.5 - na;
    if (cela) u = ((u % src.w) + src.w) % src.w; else if (u < 0) u += plnaW;
    if (u > src.w - 1 && cela) u = src.w - 1;
    if (P.vzorek(src, u, v, c)) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; }
    else { d[i] = 24; d[i + 1] = 26; d[i + 2] = 30; }
    d[i + 3] = 255;
  }
  return out;
}

/* ---------- Hugin .pto (neověřeno v Huginu; konvence yaw/pitch/roll jako PanoTools) ----------
   obr = [{ nazev, w, h, f (px celé fotky), R (svět→kamera, už včetně natočení pohledu) }], kb v px celé fotky */
function pto(obr, kb, o) {
  const f = { equi: 2, valec: 1, mercator: 5, primo: 0, stereo: 4, rovina: 0 }[o.projekce] ?? 2;
  const r = ['# hugin project file', '# vytvořeno stránkou Skládání panoramat',
    `p f${f} w${o.W} h${o.H} v${(o.hfov || 360).toFixed(3)} n"JPEG q90"`, 'm i0', ''];
  obr.forEach(s => {
    const a = P.yprZRotace(s.R), v = 2 * Math.atan(s.w / 2 / s.f) / P.RAD;
    r.push(`i w${s.w} h${s.h} f0 v${v.toFixed(4)} r${(-a.roll).toFixed(4)} p${a.pitch.toFixed(4)} y${a.yaw.toFixed(4)} a0 b0 c0 d0 e0 g0 t0 Eev0 n"${String(s.nazev).replace(/"/g, '')}"`);
  });
  r.push('');
  for (const e of kb) for (const q of e.body) r.push(`c n${e.a} N${e.b} x${q[0].toFixed(2)} y${q[1].toFixed(2)} X${q[2].toFixed(2)} Y${q[3].toFixed(2)} t0`);
  return r.join('\n') + '\n';
}

/* ruční úprava snímku v rovinné mozaice: posun (dx, dy) a otočení (stupně) kolem středu snímku */
function upravenaRovina(T, u) {
  if (!u || (!u.dx && !u.dy && !u.uhel)) return T;
  const c = apl(T, 0, 0);
  return nas(nas(P.posun(c[0] + (u.dx || 0), c[1] + (u.dy || 0)), nas(P.rotace((u.uhel || 0) * P.RAD), P.posun(-c[0], -c[1]))), T);
}

return { upravenaRovina, pohledKoule, pohledRovina, naPano, doObrazu, obrys, obrysRozbaleny, rozvrh, doZdroje, zisky, novyVystup, poradi,
  dolu, nahoru, prolniPasma, pridej, sloz, nejvetsiObdelnik, xmpGPano, gpanoZVyrezu, vlozXmpJpeg, vlozXmpPng, ctiGPano, crc32,
  pohled360, pto };
});

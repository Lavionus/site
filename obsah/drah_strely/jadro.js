/* Dráha střely – forenzní rekonstrukce trajektorie, jádro bez DOM (test: _test/drah_strely_test.js).
   Proložení přímky průstřely (nejmenší čtverce / hlavní osa), úhly, prodloužení zpět, oblast střelce
   pro rozsah výšky ústí s kuželem nejistoty, úhel dopadu z eliptického otvoru α = arcsin(š/d),
   společný původ více drah (průnik přímek nejmenšími čtverci + Monte Carlo elipsa), pokles dráhy
   (vakuum a přibližně G1), odraz orientačně.

   Souřadnice místnosti v metrech: X doprava (v půdorysu), Y nahoru (v půdorysu, „sever plánku"), Z výška nad podlahou.
   Směr dráhy d = jednotkový vektor ve směru letu střely (od střelce k průstřelům).
   Azimut = úhel v půdorysu od +Y po směru hodinových ručiček (0° = +Y, 90° = +X).
   Vertikální úhel = úhel nad vodorovnou rovinou ve směru letu (záporný = střela klesá).
   Plocha otvoru: '+x' … '-z' = vnější normála plochy směrem ke straně, odkud střela přiletěla
   ('+z' = podlaha, '-z' = strop). γ = směr letu v rovině plochy při pohledu od střelce na plochu,
   0° = nahoru (u podlahy/stropu = +Y), 90° = doprava (po směru hodinových ručiček). */
(function () {
  'use strict';

  const VERZE = 1;
  const KLIC = 'webapp_drah_strely';
  const RAD = Math.PI / 180;
  const G = 9.80665;
  const CHI2_2D_95 = 5.991; // χ² pro 2 stupně volnosti, 95 %

  /* ---------- vektory ---------- */
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const delka = a => Math.hypot(a[0], a[1], a[2]);
  const norm = a => { const l = delka(a); return l > 0 ? mul(a, 1 / l) : [0, 0, 0]; };
  const bod = p => [Number(p.x) || 0, Number(p.y) || 0, Number(p.z) || 0];

  /* vlastní čísla a vektory symetrické 3×3 (Jacobi), seřazené sestupně */
  function vlastniSym3(m) {
    const a = m.map(r => r.slice()), v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let it = 0; it < 60; it++) {
      let p = 0, q = 1;
      if (Math.abs(a[0][2]) > Math.abs(a[p][q])) { p = 0; q = 2; }
      if (Math.abs(a[1][2]) > Math.abs(a[p][q])) { p = 1; q = 2; }
      if (Math.abs(a[p][q]) < 1e-15) break;
      const th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]), c = Math.cos(th), s = Math.sin(th);
      for (let k = 0; k < 3; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; }
      for (let k = 0; k < 3; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
      for (let k = 0; k < 3; k++) { const x = v[k][p], y = v[k][q]; v[k][p] = c * x - s * y; v[k][q] = s * x + c * y; }
    }
    return [0, 1, 2].map(i => ({ l: a[i][i], v: [v[0][i], v[1][i], v[2][i]] })).sort((x, y) => y.l - x.l);
  }
  function inv3(m) {
    const [[a, b, c], [d, e, f], [g, h, i]] = m;
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
    if (Math.abs(det) < 1e-18) return null;
    return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
  }
  const mulv3 = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];

  /* dva kolmé jednotkové vektory k d */
  function kolme(d) {
    const pom = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const u = norm(cross(d, pom));
    return [u, cross(d, u)];
  }

  /* ---------- proložení přímky průstřely ---------- */
  /* body [[x,y,z]…] v pořadí letu, sigma = nejistota polohy jednoho bodu (m, 1σ na osu) */
  function prolozPrimku(body, sigma) {
    const n = body.length;
    if (n < 2) return null;
    const c = [0, 1, 2].map(i => body.reduce((s, p) => s + p[i], 0) / n);
    let d;
    if (n === 2) d = norm(sub(body[1], body[0]));
    else {
      const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (const p of body) { const q = sub(p, c); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += q[i] * q[j]; }
      d = norm(vlastniSym3(C)[0].v);
    }
    if (delka(d) === 0) return null;
    if (dot(d, sub(body[n - 1], body[0])) < 0) d = mul(d, -1);
    const t = body.map(p => dot(sub(p, c), d));
    const rez = body.map((p, i) => delka(sub(sub(p, c), mul(d, t[i]))));
    const S = t.reduce((s, x) => s + x * x, 0);
    if (!(S > 1e-12)) return null;
    const sr = n > 2 ? Math.sqrt(rez.reduce((s, r) => s + r * r, 0) / (2 * (n - 2))) : 0; // odhad σ na osu z reziduí
    const sigmaPoz = Math.max(sigma || 0, sr);
    const dGeo95 = 1.96 * Math.atan(sigmaPoz / Math.sqrt(S)) / RAD;
    const P0 = add(c, mul(d, t[0]));
    return { c, d, P0, t, rezidua: rez, rmsRez: Math.sqrt(rez.reduce((s, r) => s + r * r, 0) / n), sigmaPoz, dGeo95, L: t[n - 1] - t[0] };
  }

  /* ---------- úhly ---------- */
  function uhly(d) {
    const vert = Math.asin(Math.max(-1, Math.min(1, d[2]))) / RAD;
    let az = Math.atan2(d[0], d[1]) / RAD; if (az < 0) az += 360;
    return { vertikalni: vert, azimut: az, azimutKeStrelci: (az + 180) % 360, vodorovne: Math.hypot(d[0], d[1]) > 1e-9 };
  }
  const OSY = { x: 0, y: 1, z: 2 };
  /* úhel mezi dráhou a rovinou plochy ('x' | '+x' | '-x' …) */
  function uhelKPlose(d, plocha) {
    if (!plocha) return null;
    const i = OSY[plocha.slice(-1)];
    return Math.asin(Math.min(1, Math.abs(d[i]))) / RAD;
  }

  /* ---------- plocha a elipsa ---------- */
  const PLOCHY = ['+x', '-x', '+y', '-y', '+z', '-z'];
  function bazePlochy(plocha) {
    const i = OSY[plocha.slice(-1)], s = plocha[0] === '-' ? -1 : 1;
    const n = [0, 0, 0]; n[i] = s;
    const ev = i === 2 ? [0, 1, 0] : [0, 0, 1];
    return { n, ev, eu: cross(ev, n) };
  }
  /* α = arcsin(š/d); interval z chyby měření šířky i délky (± mm) */
  function uhelZElipsy(sirka, delkaE, chyba) {
    if (!(sirka > 0 && delkaE > 0)) return null;
    const f = (w, l) => Math.asin(Math.max(0, Math.min(1, w / l))) / RAD;
    const e = Math.max(0, chyba || 0);
    return { alfa: f(sirka, delkaE), min: f(Math.max(0, sirka - e), delkaE + e), max: f(sirka + e, Math.max(1e-9, delkaE - e)), pomer: sirka / delkaE };
  }
  /* směr letu ze α, γ a plochy */
  function smerZElipsy(alfa, gamma, plocha) {
    const B = bazePlochy(plocha), a = alfa * RAD, g = gamma * RAD;
    const t = add(mul(B.eu, Math.sin(g)), mul(B.ev, Math.cos(g)));
    return norm(sub(mul(t, Math.cos(a)), mul(B.n, Math.sin(a))));
  }
  /* opak: α, γ ze směru letu (pro kontrolu a ukázky) */
  function elipsaZeSmeru(d, plocha) {
    const B = bazePlochy(plocha), sa = -dot(d, B.n);
    if (sa <= 0) return null; // střela by letěla od plochy
    const t = add(d, mul(B.n, sa));
    let g = Math.atan2(dot(t, B.eu), dot(t, B.ev)) / RAD; if (g < 0) g += 360;
    return { alfa: Math.asin(Math.min(1, sa)) / RAD, gamma: g };
  }

  /* ---------- kužel, výška ústí, oblast střelce ---------- */
  function kuzel(d, delta, n) {
    const [u, v] = kolme(d), a = delta * RAD, out = [];
    for (let k = 0; k < n; k++) {
      const f = 2 * Math.PI * k / n;
      out.push(norm(add(mul(d, Math.cos(a)), add(mul(u, Math.sin(a) * Math.cos(f)), mul(v, Math.sin(a) * Math.sin(f))))));
    }
    return out;
  }
  /* bod na zpětném prodloužení (P − t·d) ve výšce h; null = výška za průstřelem nedosažitelná */
  function bodVeVysce(P, d, h, dMax) {
    if (Math.abs(d[2]) < 1e-9) return Math.abs(P[2] - h) < 1e-9 ? { bod: sub(P, mul(d, dMax)), t: dMax, orez: true } : null;
    const t = (P[2] - h) / d[2];
    if (t < 0) return null;
    if (t > dMax) return { bod: sub(P, mul(d, dMax)), t: dMax, orez: true };
    return { bod: sub(P, mul(d, t)), t, orez: false };
  }
  function konvexniObal(p) {
    const b = p.slice().sort((a, c) => a[0] - c[0] || a[1] - c[1]);
    if (b.length < 3) return b;
    const kr = (o, a, c) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]);
    const dol = [], hor = [];
    for (const q of b) { while (dol.length >= 2 && kr(dol[dol.length - 2], dol[dol.length - 1], q) <= 0) dol.pop(); dol.push(q); }
    for (let i = b.length - 1; i >= 0; i--) { const q = b[i]; while (hor.length >= 2 && kr(hor[hor.length - 2], hor[hor.length - 1], q) <= 0) hor.pop(); hor.push(q); }
    return dol.slice(0, -1).concat(hor.slice(0, -1));
  }
  /* oblast střelce: průnik kuželu (vrchol v prvním průstřelu) s vrstvou výšek ústí [hMin, hMax], omezený dMax */
  function oblastStrelce(P, d, delta, hMin, hMax, dMax, nKuzel) {
    const vysky = hMin === hMax ? [hMin] : [hMin, hMax];
    const vrcholUvnitr = P[2] >= hMin && P[2] <= hMax; // průstřel sám leží ve vrstvě výšek → oblast začíná u něj
    const stred = vysky.map(h => bodVeVysce(P, d, h, dMax) || (vrcholUvnitr ? { bod: P.slice(), t: 0, orez: false } : null));
    const vse = vrcholUvnitr ? [{ bod: P.slice(), t: 0, orez: false }] : [];
    let orez = false;
    for (const s of [d].concat(delta > 0 ? kuzel(d, delta, nKuzel || 48) : [])) {
      // body na hranách vrstvy i podél paprsku uvnitř vrstvy (výšky mezi), aby se zachytil ořez dMax
      for (const h of vysky) { const r = bodVeVysce(P, s, h, dMax); if (r) { vse.push(r); orez = orez || r.orez; } }
      const vMax = P[2] - s[2] * dMax; // výška na konci dosahu
      if (vMax >= hMin && vMax <= hMax) { vse.push({ bod: sub(P, mul(s, dMax)), t: dMax, orez: true }); orez = true; }
    }
    if (!vse.length) {
      const duvod = P[2] < hMin ? (d[2] >= 0 ? 'Průstřel je pod zadanou výškou ústí a dráha stoupá – zpětné prodloužení klesá, výšky ústí nedosáhne.' : 'Výšky ústí zpětné prodloužení nedosáhne v zadaném dosahu.') : (d[2] <= 0 ? 'Průstřel je nad zadanou výškou ústí a dráha klesá – zpětné prodloužení stoupá, výšky ústí nedosáhne.' : 'Výšky ústí zpětné prodloužení nedosáhne v zadaném dosahu.');
      return { nelze: true, duvod };
    }
    const hd = vse.map(r => Math.hypot(r.bod[0] - P[0], r.bod[1] - P[1]));
    return {
      stred, orez,
      polygon: konvexniObal(vse.map(r => [r.bod[0], r.bod[1]])),
      body: vse.map(r => r.bod),
      vzdMin: Math.min(...hd), vzdMax: Math.max(...hd),
      tMin: Math.min(...vse.map(r => r.t)), tMax: Math.max(...vse.map(r => r.t))
    };
  }
  /* kde zpětné prodloužení opouští místnost [0,sx]×[0,sy]×[0,sz] */
  function vystupZMistnosti(P, d, m) {
    const hr = [m.sx, m.sy, m.sz], jm = ['x', 'y', 'z'];
    let tMin = Infinity, stena = null;
    for (let i = 0; i < 3; i++) {
      const v = -d[i];
      if (Math.abs(v) < 1e-12) continue;
      const cil = v > 0 ? hr[i] : 0, t = (cil - P[i]) / v;
      if (t >= -1e-9 && t < tMin) { tMin = t; stena = (v > 0 ? jm[i] + '=' + hr[i] : jm[i] + '=0'); }
    }
    if (!Number.isFinite(tMin)) return null;
    const uvnitr = P.every((x, i) => x >= -1e-6 && x <= hr[i] + 1e-6);
    return { t: Math.max(0, tMin), bod: sub(P, mul(d, Math.max(0, tMin))), stena, uvnitr };
  }

  /* ---------- analýza jedné dráhy ---------- */
  function analyzaDrahy(dr, nast) {
    let P, d, dGeo95, fit = null, elipsa = null;
    if (dr.typ === 'elipsa') {
      const e = dr.elipsa || {};
      elipsa = uhelZElipsy(Number(e.sirka), Number(e.delka), Number(e.chyba));
      if (!elipsa || !e.plocha) return { chyba: 'Zadejte šířku a délku otvoru a plochu.' };
      P = bod(e); d = smerZElipsy(elipsa.alfa, Number(e.gamma) || 0, e.plocha);
      const dA = Math.max(elipsa.alfa - elipsa.min, elipsa.max - elipsa.alfa);
      dGeo95 = Math.max(dA, (Number(e.chybaGamma) || 0) * Math.cos(elipsa.alfa * RAD));
    } else {
      const body = (dr.body || []).map(bod);
      if (body.length < 2) return { chyba: 'Dráha potřebuje aspoň dva průstřely.' };
      fit = prolozPrimku(body, (Number(dr.sigma) || 0) / 100);
      if (!fit) return { chyba: 'Body splývají – nelze určit směr.' };
      P = fit.P0; d = fit.d; dGeo95 = fit.dGeo95;
    }
    const delta = Math.hypot(Number(dr.delta) || 0, dGeo95);
    const U = uhly(d);
    const kPlose = dr.typ === 'elipsa' ? [elipsa.alfa] : (dr.body || []).map(b => uhelKPlose(d, b.plocha));
    const oblast = oblastStrelce(P, d, delta, Number(nast.vyskaMin), Number(nast.vyskaMax), Number(nast.dMax) || 30);
    return { P, d, dGeo95, delta, uhly: U, kPlose, fit, elipsa, oblast, vystup: vystupZMistnosti(P, d, nast.mistnost) };
  }

  /* ---------- společný původ více drah ---------- */
  function nejblizsiBod(primky) {
    if (primky.length < 2) return null;
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], B = [0, 0, 0];
    for (const p of primky) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const m = (i === j ? 1 : 0) - p.d[i] * p.d[j];
      A[i][j] += m; B[i] += m * p.P[j];
    }
    const Ai = inv3(A);
    if (!Ai) return null;
    const x = mulv3(Ai, B);
    if (!x.every(Number.isFinite)) return null;
    const lmin = vlastniSym3(A)[2].l / primky.length;
    return { x, lmin };
  }
  const vzdOdPrimky = (p, c) => { const v = sub(c, p.P), t = dot(v, p.d); return delka(sub(v, mul(p.d, t))); };
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function gauss(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
  function kvantil(s, p) { const i = (s.length - 1) * p, a = Math.floor(i), b = Math.ceil(i); return s[a] + (s[b] - s[a]) * (i - a); }
  /* elipsa (95 %) z 2D bodů */
  function elipsa2D(body, chi2) {
    const n = body.length, mx = body.reduce((s, p) => s + p[0], 0) / n, my = body.reduce((s, p) => s + p[1], 0) / n;
    let sxx = 0, syy = 0, sxy = 0;
    for (const p of body) { const a = p[0] - mx, b = p[1] - my; sxx += a * a; syy += b * b; sxy += a * b; }
    sxx /= n - 1; syy /= n - 1; sxy /= n - 1;
    const tr = (sxx + syy) / 2, D = Math.sqrt(((sxx - syy) / 2) ** 2 + sxy * sxy), l1 = tr + D, l2 = Math.max(0, tr - D);
    const uhel = Math.atan2(l1 - sxx, sxy || 1e-30); // směr hlavní osy (rad, od +X)
    const k = chi2 || CHI2_2D_95;
    return { stred: [mx, my], a: Math.sqrt(k * l1), b: Math.sqrt(k * l2), uhel: Math.abs(sxy) < 1e-30 ? (sxx >= syy ? 0 : Math.PI / 2) : uhel };
  }
  /* primky: [{P, d, delta (°, 95 %), sigma (m), id}] */
  function spolecnyPuvod(primky, opt) {
    opt = opt || {};
    const res = nejblizsiBod(primky);
    if (!res) return { chyba: primky.length < 2 ? 'Potřeba aspoň dvě dráhy.' : 'Dráhy jsou rovnoběžné – průnik nelze určit.' };
    const x = res.x;
    const vzd = primky.map(p => ({ id: p.id, vzd: vzdOdPrimky(p, x), t: dot(sub(p.P, x), p.d) }));
    const r = rng(opt.seed || 12345), N = opt.n || 1500, xy = [], zs = [];
    const baze = primky.map(p => kolme(p.d));
    for (let k = 0; k < N; k++) {
      const pp = primky.map((p, i) => {
        const s = (p.delta || 0) / 1.96 * RAD, [u, v] = baze[i];
        const d = norm(add(p.d, add(mul(u, Math.tan(gauss(r) * s)), mul(v, Math.tan(gauss(r) * s)))));
        const sg = p.sigma || 0;
        return { P: [p.P[0] + gauss(r) * sg, p.P[1] + gauss(r) * sg, p.P[2] + gauss(r) * sg], d };
      });
      const q = nejblizsiBod(pp);
      if (q) { xy.push([q.x[0], q.x[1]]); zs.push(q.x[2]); }
    }
    zs.sort((a, b) => a - b);
    return {
      bod: x, vzd, rms: Math.sqrt(vzd.reduce((s, v) => s + v.vzd * v.vzd, 0) / vzd.length),
      rovnobezne: res.lmin < 0.02, // úhel mezi drahami přibližně pod ~8°: průnik špatně podmíněný
      zaPrustrely: vzd.every(v => v.t > 0),
      elipsa: xy.length > 10 ? elipsa2D(xy) : null,
      z: zs.length > 10 ? { min: kvantil(zs, 0.025), max: kvantil(zs, 0.975) } : null,
      vzorky: xy.length
    };
  }

  /* ---------- pokles dráhy ---------- */
  /* vodorovný výstřel ve vakuu: pokles y = g·t²/2, t = x/v */
  function poklesVakuum(v, x) { const t = x / v; return { t, pokles: G * t * t / 2 }; }
  /* tabulka G1 (Mach, Cd) – přibližný výňatek, hodnoty z paměti (Ingalls/BRL, viz McCoy 1999), neověřeno */
  const G1 = [[0, .2629], [.5, .2032], [.6, .2034], [.7, .2165], [.8, .2546], [.85, .2901], [.9, .3415], [.95, .4084], [1, .4805],
    [1.05, .5427], [1.1, .5883], [1.2, .6393], [1.3, .6589], [1.4, .6625], [1.5, .6573], [1.75, .628], [2, .5934], [2.5, .5397], [3, .5133]];
  function cdG1(M) {
    if (M <= 0) return G1[0][1];
    for (let i = 1; i < G1.length; i++) if (M <= G1[i][0]) { const [a, ca] = G1[i - 1], [b, cb] = G1[i]; return ca + (cb - ca) * (M - a) / (b - a); }
    return G1[G1.length - 1][1];
  }
  /* numerická integrace vodorovného výstřelu s odporem G1: a = ρ·v²·Cd_G1(M)·π / (8·BC), BC v kg/m² */
  function poklesG1(v0, bcLbIn2, vzdalenosti, opt) {
    opt = opt || {};
    const rho = opt.rho || 1.225, c = opt.zvuk || 340.3, BC = bcLbIn2 * 703.0696, dt = opt.dt || 2e-5;
    const cile = vzdalenosti.slice().sort((a, b) => a - b), out = [];
    let x = 0, y = 0, vx = v0, vy = 0, t = 0, i = 0;
    while (i < cile.length && t < 10) {
      const krok = (vx_, vy_) => { const v = Math.hypot(vx_, vy_), k = rho * v * cdG1(v / c) * Math.PI / (8 * BC); return [-k * vx_, -k * vy_ - G]; };
      const [ax1, ay1] = krok(vx, vy), [ax2, ay2] = krok(vx + ax1 * dt, vy + ay1 * dt);
      const nx = x + (vx + (vx + ax1 * dt)) / 2 * dt, ny = y + (vy + (vy + ay1 * dt)) / 2 * dt;
      vx += (ax1 + ax2) / 2 * dt; vy += (ay1 + ay2) / 2 * dt; t += dt;
      while (i < cile.length && nx >= cile[i]) {
        const f = (cile[i] - x) / (nx - x);
        out.push({ x: cile[i], pokles: -(y + (ny - y) * f), v: Math.hypot(vx, vy), t: t - dt * (1 - f) });
        i++;
      }
      x = nx; y = ny;
    }
    return out;
  }
  /* boční odchylka od přímky na vzdálenost x pro nejistotu úhlu δ */
  const odchylkaUhlu = (x, delta) => x * Math.tan(delta * RAD);

  /* ---------- odraz (jen orientačně) ---------- */
  function odraz(alfa, kriticky) {
    if (!(alfa >= 0) || !(kriticky > 0)) return null;
    const rozdil = alfa - kriticky;
    return { stav: Math.abs(rozdil) <= 0.15 * kriticky ? 'hranice' : rozdil < 0 ? 'pod' : 'nad', rozdil };
  }
  /* zrcadlový odraz směru d od plochy (jen geometrická horní představa) */
  function zrcadlo(d, plocha) { const n = bazePlochy(plocha).n; return sub(d, mul(n, 2 * dot(d, n))); }

  /* ---------- projekt ---------- */
  const BARVY = ['#d9483b', '#2f7fd8', '#2a9d5a', '#c98a00', '#9a52c8', '#d0508a', '#13999b', '#7a6a4a'];
  function novaDraha(id, typ) {
    return typ === 'elipsa'
      ? { id, nazev: 'Otvor ' + id, typ: 'elipsa', delta: 2, sigma: 0.5, zahrnout: true, elipsa: { x: 0, y: 0, z: 1, plocha: '-y', sirka: 9, delka: 14, chyba: 0.5, gamma: 90, chybaGamma: 5 } }
      : { id, nazev: 'Dráha ' + id, typ: 'body', delta: 1, sigma: 0.5, zahrnout: true, body: [] };
  }
  function prazdny() {
    return { verze: VERZE, nazev: '', cj: '', misto: '', zpracoval: '', datum: '', poznamka: '',
      mistnost: { sx: 5, sy: 4, sz: 2.6 }, vyskaMin: 1.0, vyskaMax: 1.6, dMax: 30,
      drahy: [], odraz: { alfa: 10, kriticky: 15 }, pokles: { v: 350, bc: 0.15, x: 10, g1: true } };
  }
  function migruj(d) {
    const p = prazdny();
    if (!d || typeof d !== 'object') return p;
    const o = Object.assign(p, d);
    o.mistnost = Object.assign(prazdny().mistnost, d.mistnost || {});
    o.odraz = Object.assign(prazdny().odraz, d.odraz || {});
    o.pokles = Object.assign(prazdny().pokles, d.pokles || {});
    o.drahy = Array.isArray(d.drahy) ? d.drahy.map(x => Object.assign(novaDraha(x.id || 'D', x.typ), x)) : [];
    o.verze = VERZE;
    return o;
  }
  function dalsiId(drahy) { let i = 1; while (drahy.some(d => d.id === 'D' + i)) i++; return 'D' + i; }

  function analyza(p) {
    const vys = p.drahy.map(d => Object.assign({ id: d.id }, analyzaDrahy(d, p)));
    const primky = vys.filter((v, i) => !v.chyba && p.drahy[i].zahrnout).map((v, i) => ({ id: v.id, P: v.P, d: v.d, delta: v.delta, sigma: (Number(p.drahy.find(d => d.id === v.id).sigma) || 0) / 100 }));
    return { drahy: vys, puvod: primky.length >= 2 ? spolecnyPuvod(primky) : null };
  }

  /* ---------- export ---------- */
  function csvBunka(v) { v = String(v == null ? '' : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  const f = (x, n) => Number.isFinite(x) ? x.toFixed(n) : '';
  function csv(p, A) {
    const r = [['draha', 'typ', 'bod', 'x_m', 'y_m', 'z_m', 'plocha', 'uhel_k_plose_deg', 'azimut_deg', 'vertikalni_deg', 'nejistota_deg', 'strelec_vzd_min_m', 'strelec_vzd_max_m']];
    p.drahy.forEach((d, i) => {
      const a = A.drahy[i], ok = !a.chyba, ob = ok && !a.oblast.nelze ? a.oblast : null;
      const spol = [ok ? f(a.uhly.azimut, 1) : '', ok ? f(a.uhly.vertikalni, 1) : '', ok ? f(a.delta, 2) : '', ob ? f(ob.vzdMin, 2) : '', ob ? f(ob.vzdMax, 2) : ''];
      if (d.typ === 'elipsa') { const e = d.elipsa; r.push([d.nazev, 'elipsa', '', e.x, e.y, e.z, e.plocha, ok ? f(a.elipsa.alfa, 1) : '', ...spol]); }
      else d.body.forEach((b, j) => r.push([d.nazev, 'body', b.nazev || String.fromCharCode(65 + j), b.x, b.y, b.z, b.plocha || '', ok ? f(a.kPlose[j], 1) : '', ...spol]));
    });
    if (A.puvod && !A.puvod.chyba) r.push(['spolecny_puvod', '', '', ...A.puvod.bod.map(x => f(x, 3)), '', '', '', '', '', '', '']);
    return r.map(x => x.map(csvBunka).join(';')).join('\n');
  }

  /* ukázka: dva výstřely z jednoho místa (1,2 / 0,8 / 1,35) na stěnu y = 4 přes skříň a stůl */
  function ukazka() {
    const p = prazdny();
    Object.assign(p, { nazev: 'Ukázka – obývací pokoj', misto: 'cvičná místnost', poznamka: 'Syntetická data se známou polohou střelce [1,20; 0,80; 1,35] m.' });
    const S = [1.2, 0.8, 1.35];
    // přesné body na rovinách y = 2,2 (skříň) a y = 4 (stěna)
    const naY = (cil, y) => { const d = norm(sub(cil, S)), t = (y - S[1]) / d[1]; return add(S, mul(d, t)).map(v => Math.round(v * 1000) / 1000); };
    const A1 = naY([3.6, 4.0, 0.95], 2.2), B1 = naY([3.6, 4.0, 0.95], 4.0);
    const A2 = naY([1.0, 4.0, 1.9], 1.6), B2 = naY([1.0, 4.0, 1.9], 2.9), C2 = naY([1.0, 4.0, 1.9], 4.0);
    p.drahy = [
      Object.assign(novaDraha('D1'), { nazev: 'Výstřel 1 (skříň → stěna)', body: [{ nazev: 'A', x: A1[0], y: A1[1], z: A1[2], plocha: 'y' }, { nazev: 'B', x: B1[0], y: B1[1], z: B1[2], plocha: 'y' }] }),
      Object.assign(novaDraha('D2'), { nazev: 'Výstřel 2 (paraván, police, stěna)', body: [{ nazev: 'A', x: A2[0], y: A2[1], z: A2[2], plocha: 'y' }, { nazev: 'B', x: B2[0], y: B2[1], z: B2[2], plocha: 'y' }, { nazev: 'C', x: C2[0], y: C2[1], z: C2[2], plocha: 'y' }] })
    ];
    // třetí: jediný eliptický otvor ve stěně x = 5 (střelec na straně −x od stěny → normála '-x')
    const d3 = norm(sub([5.0, 2.6, 0.7], S)), e3 = elipsaZeSmeru(d3, '-x'), sin3 = Math.sin(e3.alfa * RAD);
    p.drahy.push(Object.assign(novaDraha('D3', 'elipsa'), { nazev: 'Otvor ve stěně x = 5', elipsa: { x: 5.0, y: 2.6, z: 0.7, plocha: '-x', sirka: Math.round(9 * 10) / 10, delka: Math.round(9 / sin3 * 10) / 10, chyba: 0.3, gamma: Math.round(e3.gamma), chybaGamma: 3 } }));
    return p;
  }

  const API = {
    VERZE, KLIC, RAD, G, PLOCHY, BARVY, sub, add, mul, dot, cross, norm, delka, kolme, vlastniSym3,
    prolozPrimku, uhly, uhelKPlose, bazePlochy, uhelZElipsy, smerZElipsy, elipsaZeSmeru,
    kuzel, bodVeVysce, konvexniObal, oblastStrelce, vystupZMistnosti, analyzaDrahy,
    nejblizsiBod, vzdOdPrimky, rng, gauss, elipsa2D, spolecnyPuvod,
    poklesVakuum, cdG1, poklesG1, odchylkaUhlu, odraz, zrcadlo,
    novaDraha, prazdny, migruj, dalsiId, analyza, csv, ukazka
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.DRAHA = API;
})();

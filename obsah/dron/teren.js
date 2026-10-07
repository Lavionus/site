// Nad krajinou — generátor krajiny (agent TERÉN): česká vrchovina 4 × 4 km ze seedu.
// Rozhraní (data i metody) je závazné, viz Dron_PLAN.md › Terén. Běží v node, ve Workeru i na stránce.
//
// Postup: osa údolí + makrotvar (dno údolí, svahy, hřbety, zkroucení domény) na mřížce 513² (8 m)
// → kapková hydraulická eroze + lehká termální → bikubicky na 1025² (4 m) + jemný detail
// → jezero (miska s břehem a prahem) → řeka po nejlevnější cestě (Dijkstra s cenou podle výšky,
// tj. po dně údolí) ze zdroje do jezera a z jezera ven z mapy, s monotónní hladinou a vyhloubeným korytem
// → vesnice, rybník s hrází, most, silnice a polní cesty (Dijkstra s cenou za sklon), srovnání terénu
// → masky (pole v lánech, les s roztřepeným okrajem, cesty, vlhkost) → vedení, stavby, stromy, kameny
// → závodní tratě (ověřené proti stavbám a terénu, stromy v cestě se vykácí) a cíle fotomisí.
//
// Upřesnění a DOPLNĚNÁ pole dat (vše ostatní přesně podle Dron_PLAN.md):
//   maska G (pole): 0 = louka/úhor; 1..255 = orná půda, hodnota rozlišuje plodinu pruhu
//          (255 obilí, 215 řepka, 175 kukuřice, 135 oranice) → vykreslení smí barvit podle hodnoty.
//   maska B (cesta): 255 silnice (asfalt), 150 polní cesta; okraj plynule klesá.
//   stavby: lokální osa z (delka) míří ve směru (sin uhel, cos uhel), osa x (sirka) do (cos uhel, −sin uhel)
//           (= rotation.y = uhel v three.js).
//     most:  y = horní plocha mostovky, konstrukce sahá 0.9 m pod ni; delka = rozpětí podél silnice,
//            sirka = šířka mostu; vyska = výška mostovky nad hladinou; navíc hladina.
//     plot / ohrada: rovný úsek plotu, delka = délka úseku, sirka = tloušťka, vyska = výška plotu.
//     seno:  válcový balík, osa válce podél lokální z (delka), průměr = sirka = vyska.
//     vez:   kostelní věž (vyska zdi, strecha = jehlan); kostel má oltář na +z (k východu).
//     stozar: stožár vedení, vyska = vyskaSloupu.  pristavani: startovní plocha (vyska ~0.15).
//   vedeni[i].pruves  [m] průvěs drátu uprostřed každého pole (pole i = mezi body i a i+1);
//          drát: y(t) = lerp(yA + v, yB + v, t) − 4·pruves·t·(1−t), v = vyskaSloupu + draty[k][1].
//   vedeni[i].draty   [[dx, dy], …] příčné a svislé odsazení vodičů od vrcholu stožáru.
//   trate[i].branky[j]: uhel = kurz průletu (0 = letí se k −Z, kladný doleva), otvor leží v rovině
//          lokálních os x (sirka) a y (vyska); y = terén, nad vodou hladina (pak naVode: true); otvor je
//          od y + D.BRANKA.dole (0.3) do y + 0.3 + vyska (rám 0.3). Start závodu 22 m před brankou 0
//          (bod branka + (sin uhel, cos uhel)·22) je s náletem volný od stromů a staveb.
//          oblouk [m]: úsek k další brance je volný po přímce mezi středy otvorů zvednuté o
//          oblouk·sin(π·t) (t = 0..1 podél úseku) — kvůli terénu; 0 = stačí přímka. okruh: true → za
//          poslední brankou se letí znovu k první.
//   vodstvo  { reky: [{ jmeno, body: [[x, hladina, z, sirka], …] }]   (po proudu)
//              jezera: [{ typ: 'jezero'|'rybnik', jmeno, x, z, r, hladina, hraz?: [[x,z],[x,z]] }] }
//   vesnice  { jmeno, x, z, r }      pastviny [{ x, z, uhel, sirka, delka }] (uvnitř ohrad)
//   info     { casMs, casy: {…}, pocty: {…} }
(function (D) {
  'use strict';

  const VELIKOST = 4096, N = 1025, KROK = 4, PUL = 2048, BEZ_VODY = -1e4, NN = N * N;
  const N2 = 513, K2 = 8;            // hrubá mřížka (makrotvar, eroze)
  const NG = 257, KG = 16;           // mřížka pro hledání cest
  const TAU = Math.PI * 2;

  // druhy stromů (když chybí spolecne.js, např. ve starém Workeru)
  const STROMY = () => D.STROMY || [
    { vyska: 28, kmenR: 0.30, korunaOd: 4, korunaR: 3.2 }, { vyska: 24, kmenR: 0.25, korunaOd: 13, korunaR: 3.5 },
    { vyska: 26, kmenR: 0.35, korunaOd: 6, korunaR: 6.0 }, { vyska: 18, kmenR: 0.18, korunaOd: 5, korunaR: 3.0 },
    { vyska: 22, kmenR: 0.50, korunaOd: 5, korunaR: 7.5 }, { vyska: 2.5, kmenR: 0, korunaOd: 0, korunaR: 1.6 }];
  const SMRK = 0, BOROVICE = 1, BUK = 2, BRIZA = 3, DUB = 4, KER = 5;

  const MAPY = {
    udoli:   { jezeroR: [175, 220], natah: 1.35, tvarSum: 0.22, jezeroT: [0.5, 0.58], hloubka: 9,
               dno: 140, rozvlek: [1000, 1400], Lf: [236, 252], zdrojNad: [80, 105], vystupPod: 60,
               Ht0: 45, Hamp: 190, wr: 0.4, lesPodil: 0.40, zdroj: 1600, varka: 1.0 },
    jezero:  { jezeroR: [390, 450], natah: 1.45, tvarSum: 0.30, jezeroT: [0.41, 0.46], hloubka: 16,
               dno: 200, rozvlek: [950, 1300], Lf: [240, 250], zdrojNad: [70, 95], vystupPod: 55,
               Ht0: 45, Hamp: 170, wr: 0.35, lesPodil: 0.42, zdroj: 1650, varka: 1.0 },
    hrebeny: { jezeroR: [150, 180], natah: 1.3, tvarSum: 0.20, jezeroT: [0.5, 0.58], hloubka: 8,
               dno: 90, rozvlek: [800, 1100], Lf: [228, 245], zdrojNad: [95, 125], vystupPod: 65,
               Ht0: 60, Hamp: 215, wr: 0.65, lesPodil: 0.56, zdroj: 1600, varka: 1.15 },
  };

  // ---------- pomůcky ----------
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const smooth = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const kurzSmeru = (dx, dz) => Math.atan2(-dx, -dz);     // kurz, kterým se letí ve směru (dx, dz)
  const uhelOsyZ = (dx, dz) => Math.atan2(dx, dz);        // natočení, při kterém lokální z míří do (dx, dz)
  const vzd = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  function bil(pole, n, k, x0, x, z) {
    let fx = (x - x0) / k, fz = (z - x0) / k;
    fx = fx < 0 ? 0 : fx > n - 1.0001 ? n - 1.0001 : fx; fz = fz < 0 ? 0 : fz > n - 1.0001 ? n - 1.0001 : fz;
    const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * n + ix;
    const a = pole[i], b = pole[i + 1], c = pole[i + n], d = pole[i + n + 1];
    return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
  }
  const vys = (G, x, z) => bil(G.V, N, KROK, -PUL, x, z);
  function hladinaBil(W, x, z) {           // stejně jako teren.hladina(): váženě z buněk s vodou, jinak −Infinity
    let fx = (x + PUL) / KROK, fz = (z + PUL) / KROK;
    if (fx < -0.5 || fz < -0.5 || fx > N - 0.5 || fz > N - 0.5) return -Infinity;
    fx = fx < 0 ? 0 : fx > N - 1.001 ? N - 1.001 : fx; fz = fz < 0 ? 0 : fz > N - 1.001 ? N - 1.001 : fz;
    const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * N + ix;
    let sw = 0, sh = 0;
    const p = (h, w) => { if (h > -9999) { sw += w; sh += w * h; } };
    p(W[i], (1 - tx) * (1 - tz)); p(W[i + 1], tx * (1 - tz)); p(W[i + N], (1 - tx) * tz); p(W[i + N + 1], tx * tz);
    return sw >= 0.5 ? sh / sw : -Infinity;
  }
  const bunka = (x, z) => clamp(Math.round((z + PUL) / KROK), 0, N - 1) * N + clamp(Math.round((x + PUL) / KROK), 0, N - 1);
  function sklonSt(G, x, z) {            // sklon ve stupních (rozdíly na 6 m)
    const e = 6, hx = vys(G, x + e, z) - vys(G, x - e, z), hz = vys(G, x, z + e) - vys(G, x, z - e);
    return Math.atan(Math.hypot(hx, hz) / (2 * e)) * 180 / Math.PI;
  }
  function spad(G, x, z, e) {            // směr dolů po svahu (normovaný)
    const hx = vys(G, x + e, z) - vys(G, x - e, z), hz = vys(G, x, z + e) - vys(G, x, z - e), l = Math.hypot(hx, hz) || 1;
    return [-hx / l, -hz / l];
  }

  // Catmull-Rom přes body, m vzorků na úsek
  function splajn(P, m) {
    const out = [], n = P.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
      for (let k = 0; k < m; k++) {
        const t = k / m, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    out.push(P[n - 1].slice());
    return out;
  }
  function chaikin(b, it) {
    for (let k = 0; k < it; k++) {
      if (b.length < 3) return b;
      const o = [b[0]];
      for (let i = 0; i < b.length - 1; i++) {
        const p = b[i], q = b[i + 1];
        o.push([0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]], [0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]);
      }
      o.push(b[b.length - 1]); b = o;
    }
    return b;
  }
  function delkaCary(b) { let s = 0; for (let i = 1; i < b.length; i++) s += vzd(b[i], b[i - 1]); return s; }
  function prevzorkuj(b, krok) {         // body po krok metrech (první i poslední zachová)
    const o = [b[0].slice()]; let zbyva = krok;
    for (let i = 1; i < b.length; i++) {
      let ax = b[i - 1][0], az = b[i - 1][1]; const bx = b[i][0], bz = b[i][1];
      let l = Math.hypot(bx - ax, bz - az);
      while (l >= zbyva) {
        const t = zbyva / l; ax += (bx - ax) * t; az += (bz - az) * t; o.push([ax, az]);
        l -= zbyva; zbyva = krok;
      }
      zbyva -= l;
    }
    const p = b[b.length - 1];
    if (vzd(o[o.length - 1], p) > krok * 0.3) o.push(p.slice()); else o[o.length - 1] = p.slice();
    return o;
  }
  function tecna(b, i, r) {
    const a = b[Math.max(0, i - r)], c = b[Math.min(b.length - 1, i + r)];
    const dx = c[0] - a[0], dz = c[1] - a[1], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l];
  }
  function vzdOdCary(b, x, z) {           // nejmenší vzdálenost bodu od lomené čáry
    let m = Infinity;
    for (let i = 0; i < b.length - 1; i++) {
      const ax = b[i][0], az = b[i][1], vx = b[i + 1][0] - ax, vz = b[i + 1][1] - az, l2 = vx * vx + vz * vz || 1e-9;
      const t = clamp(((x - ax) * vx + (z - az) * vz) / l2, 0, 1), ex = x - ax - vx * t, ez = z - az - vz * t, d = ex * ex + ez * ez;
      if (d < m) m = d;
    }
    return Math.sqrt(m);
  }

  // ---------- halda a Dijkstra na mřížce NG ----------
  function Halda() { this.k = new Float64Array(4096); this.v = new Int32Array(4096); this.n = 0; }
  Halda.prototype.vloz = function (klic, hod) {
    if (this.n === this.k.length) {
      const k2 = new Float64Array(this.n * 2); k2.set(this.k); this.k = k2;
      const v2 = new Int32Array(this.n * 2); v2.set(this.v); this.v = v2;
    }
    const K = this.k, V = this.v; let i = this.n++;
    while (i > 0) { const p = (i - 1) >> 1; if (K[p] <= klic) break; K[i] = K[p]; V[i] = V[p]; i = p; }
    K[i] = klic; V[i] = hod;
  };
  Halda.prototype.vyjmi = function () {
    const K = this.k, V = this.v, top = V[0], n = --this.n;
    if (n > 0) {
      const kk = K[n], vv = V[n]; let i = 0;
      for (;;) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && K[c + 1] < K[c]) c++;
        if (K[c] >= kk) break;
        K[i] = K[c]; V[i] = V[c]; i = c;
      }
      K[i] = kk; V[i] = vv;
    }
    return top;
  };
  const SX = [1, -1, 0, 0, 1, 1, -1, -1], SZ = [0, 0, 1, -1, 1, -1, 1, -1], SL = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];
  function hledejCestu(zdroje, jeCil, hrana) {
    const M = NG * NG, dist = new Float64Array(M).fill(Infinity), pred = new Int32Array(M).fill(-1), hot = new Uint8Array(M);
    const h = new Halda();
    for (const s of zdroje) { dist[s] = 0; h.vloz(0, s); }
    let cil = -1;
    while (h.n) {
      const i = h.vyjmi(); if (hot[i]) continue; hot[i] = 1;
      if (jeCil[i]) { cil = i; break; }
      const ix = i % NG, iz = (i / NG) | 0;
      for (let k = 0; k < 8; k++) {
        const jx = ix + SX[k], jz = iz + SZ[k];
        if (jx < 0 || jz < 0 || jx >= NG || jz >= NG) continue;
        const j = jz * NG + jx; if (hot[j]) continue;
        const c = hrana(i, j, SL[k] * KG); if (!(c < Infinity)) continue;
        const nd = dist[i] + c; if (nd < dist[j]) { dist[j] = nd; pred[j] = i; h.vloz(nd, j); }
      }
    }
    if (cil < 0) return null;
    const c = []; for (let i = cil; i >= 0; i = pred[i]) c.push(i); c.reverse();
    return c;
  }
  const gBod = i => [-PUL + (i % NG) * KG, -PUL + ((i / NG) | 0) * KG];
  const gIndex = (x, z) => clamp(Math.round((z + PUL) / KG), 0, NG - 1) * NG + clamp(Math.round((x + PUL) / KG), 0, NG - 1);

  // ---------- razítko: nejbližší úsek lomené čáry pro buňky v okolí ----------
  function Razitko() { this.d = new Float32Array(NN).fill(1e9); this.s = new Int32Array(NN); this.t = new Float32Array(NN); this.bunky = []; }
  Razitko.prototype.cara = function (body, polomer) {
    const d = this.d, S = this.s, T = this.t, B = this.bunky;
    for (let k = 0; k < body.length - 1; k++) {
      const ax = body[k][0], az = body[k][1], bx = body[k + 1][0], bz = body[k + 1][1];
      const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1e-9;
      const x0 = Math.max(0, Math.floor((Math.min(ax, bx) - polomer + PUL) / KROK)), x1 = Math.min(N - 1, Math.ceil((Math.max(ax, bx) + polomer + PUL) / KROK));
      const z0 = Math.max(0, Math.floor((Math.min(az, bz) - polomer + PUL) / KROK)), z1 = Math.min(N - 1, Math.ceil((Math.max(az, bz) + polomer + PUL) / KROK));
      for (let iz = z0; iz <= z1; iz++) {
        const z = -PUL + iz * KROK;
        for (let ix = x0; ix <= x1; ix++) {
          const x = -PUL + ix * KROK;
          let t = ((x - ax) * vx + (z - az) * vz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const dx = x - ax - vx * t, dz = z - az - vz * t, dd = Math.sqrt(dx * dx + dz * dz);
          const i = iz * N + ix;
          if (dd <= polomer && dd < d[i]) { if (d[i] === 1e9) B.push(i); d[i] = dd; S[i] = k; T[i] = t; }
        }
      }
    }
  };
  Razitko.prototype.vycisti = function () { const d = this.d; for (const i of this.bunky) d[i] = 1e9; this.bunky = []; };

  // ---------- vzdálenostní pole (šíření nejbližšího zdroje, 2 průchody) ----------
  function vzdalenosti(jeZdroj) {
    const nej = new Int32Array(NN).fill(-1), d2 = new Float32Array(NN).fill(1e20);
    for (let i = 0; i < NN; i++) if (jeZdroj[i]) { nej[i] = i; d2[i] = 0; }
    const SXo = new Int16Array(NN), SZo = new Int16Array(NN);
    for (let i = 0; i < NN; i++) { SXo[i] = i % N; SZo[i] = (i / N) | 0; }
    const DXo = [[-1, 0, -1, 1], [1, 0, 1, -1]], DZo = [[0, -1, -1, -1], [0, 1, 1, 1]];
    for (let pr = 0; pr < 2; pr++) {
      const ox = DXo[pr], oz = DZo[pr];
      for (let k = 0; k < N; k++) {
        const iz = pr ? N - 1 - k : k;
        for (let m = 0; m < N; m++) {
          const ix = pr ? N - 1 - m : m, i = iz * N + ix;
          let best = d2[i], bs = nej[i];
          for (let q = 0; q < 4; q++) {
            const jx = ix + ox[q], jz = iz + oz[q]; if (jx < 0 || jz < 0 || jx >= N || jz >= N) continue;
            const s = nej[jz * N + jx]; if (s < 0) continue;
            const dx = SXo[s] - ix, dz = SZo[s] - iz, dd = dx * dx + dz * dz;
            if (dd < best) { best = dd; bs = s; }
          }
          d2[i] = best; nej[i] = bs;
        }
      }
    }
    const d = new Float32Array(NN);
    for (let i = 0; i < NN; i++) d[i] = nej[i] < 0 ? 1e5 : Math.sqrt(d2[i]) * KROK;
    return { d, nej };
  }

  // rozmazání čtvercem (součtová tabulka), poloměr r buněk
  function rozmaz(pole, n, r) {
    const S = new Float64Array((n + 1) * (n + 1)), m = n + 1;
    for (let iz = 0; iz < n; iz++) { let rs = 0; for (let ix = 0; ix < n; ix++) { rs += pole[iz * n + ix]; S[(iz + 1) * m + ix + 1] = S[iz * m + ix + 1] + rs; } }
    const o = new Float32Array(n * n);
    for (let iz = 0; iz < n; iz++) {
      const z0 = Math.max(0, iz - r), z1 = Math.min(n, iz + r + 1);
      for (let ix = 0; ix < n; ix++) {
        const x0 = Math.max(0, ix - r), x1 = Math.min(n, ix + r + 1);
        o[iz * n + ix] = (S[z1 * m + x1] - S[z0 * m + x1] - S[z1 * m + x0] + S[z0 * m + x0]) / ((z1 - z0) * (x1 - x0));
      }
    }
    return o;
  }

  // =====================================================================
  // 1. makrotvar: osa údolí, dno, svahy, hřbety
  // =====================================================================
  function makro(G) {
    const P = G.P, r = D.Nahoda(G.seed + ':osa');
    const R = r.mezi(P.jezeroR[0], P.jezeroR[1]);
    const th = r() * TAU, cx = Math.cos(th), cz = Math.sin(th);
    const O = [cx * 2450, cz * 2450];
    const sa = th + Math.PI + r.mezi(-0.4, 0.4);
    const S = [Math.cos(sa) * P.zdroj, Math.sin(sa) * P.zdroj];
    const ox = O[0] - S[0], oz = O[1] - S[1], ol = Math.hypot(ox, oz), nx = -oz / ol, nz = ox / ol;
    const tl = r.mezi(P.jezeroT[0], P.jezeroT[1]), bo = r.mezi(-200, 200);
    const Lc = [S[0] + ox * tl + nx * bo, S[1] + oz * tl + nz * bo];
    const lim = 2048 - R * P.natah - 380;
    Lc[0] = clamp(Lc[0], -lim, lim); Lc[1] = clamp(Lc[1], -lim, lim);
    const mezi = (A, B, f, o) => [A[0] + (B[0] - A[0]) * f + nx * o, A[1] + (B[1] - A[1]) * f + nz * o];
    const sg = r() < 0.5 ? 1 : -1;
    const M1 = mezi(S, Lc, 0.33, sg * r.mezi(150, 420)), M2 = mezi(S, Lc, 0.7, -sg * r.mezi(120, 380));
    const M3 = mezi(Lc, O, 0.3, sg * r.mezi(150, 380)), M4 = mezi(Lc, O, 0.68, -sg * r.mezi(100, 350));
    const osa = splajn([S, M1, M2, Lc, M3, M4, O], 40);
    const kum = [0]; for (let i = 1; i < osa.length; i++) kum.push(kum[i - 1] + vzd(osa[i], osa[i - 1]));
    const Lt = kum[kum.length - 1], tL = kum[120] / Lt;
    const tj = tecna(osa, 120, 3);
    G.osa = osa; G.S = S; G.O = O;
    G.jezero = { x: Lc[0], z: Lc[1], R, natah: P.natah, ax: tj[0], az: tj[1] };

    // vzdálenost a parametr podél osy na hrubé mřížce 151² (32 m, s přesahem kvůli zkroucení)
    const nC = 151, c0 = -2400, kC = 32, Dd = new Float32Array(nC * nC), Dt = new Float32Array(nC * nC);
    for (let iz = 0; iz < nC; iz++) for (let ix = 0; ix < nC; ix++) {
      const x = c0 + ix * kC, z = c0 + iz * kC; let m = 1e9, mt = 0;
      for (let k = 0; k < osa.length - 1; k++) {
        const ax = osa[k][0], az = osa[k][1], vx = osa[k + 1][0] - ax, vz = osa[k + 1][1] - az, l2 = vx * vx + vz * vz || 1e-9;
        const t = clamp(((x - ax) * vx + (z - az) * vz) / l2, 0, 1), dx = x - ax - vx * t, dz = z - az - vz * t, dd = dx * dx + dz * dz;
        if (dd < m) { m = dd; mt = (kum[k] + Math.sqrt(l2) * t) / Lt; }
      }
      Dd[iz * nC + ix] = Math.sqrt(m); Dt[iz * nC + ix] = mt;
    }
    const Lf = r.mezi(P.Lf[0], P.Lf[1]), zN = r.mezi(P.zdrojNad[0], P.zdrojNad[1]);
    const a = R * P.natah * 1.05 / Lt, t1 = tL - a, t2 = tL + a;
    G.Lf = Lf; G.tL = tL;
    const dnoH = t => {
      if (t < t1) return Lf + 2 + zN * Math.pow(1 - t / t1, 1.25);
      if (t <= t2) return Lf - 1;
      return Lf - 2.5 - P.vystupPod * Math.pow(Math.min(1, (t - t2) / (1 - t2)), 0.9);
    };
    const sw = D.Simplex(G.seed + ':w'), sr = D.Simplex(G.seed + ':r'), sb = D.Simplex(G.seed + ':b'), sd = D.Simplex(G.seed + ':d'), ss = D.Simplex(G.seed + ':s');
    const H = new Float32Array(N2 * N2), rv0 = P.rozvlek[0], rv1 = P.rozvlek[1];
    // pomalu proměnné složky na mřížce 257² (16 m): zkroucení, dno, šířka, vrchy
    const nL = NG, LW = new Float32Array(nL * nL * 2), LV = new Float32Array(nL * nL), LF = new Float32Array(nL * nL), LS = new Float32Array(nL * nL);
    for (let iz = 0; iz < nL; iz++) {
      const z = -PUL + iz * KG;
      for (let ix = 0; ix < nL; ix++) {
        const x = -PUL + ix * KG, q = iz * nL + ix;
        const dl = Math.hypot(x - Lc[0], z - Lc[1]), dzr = Math.hypot(x - S[0], z - S[1]);
        const aw = 190 * smooth(R * 1.2, R * 2.8, dl) * (0.4 + 0.6 * smooth(150, 600, dzr));
        const wx = x + aw * D.fbm(sw, x / 1400, z / 1400, 3), wz = z + aw * D.fbm(sw, x / 1400 + 31.7, z / 1400 + 17.3, 3);
        LW[q * 2] = wx; LW[q * 2 + 1] = wz;
        const d = bil(Dd, nC, kC, c0, wx, wz), t = bil(Dt, nC, kC, c0, wx, wz);
        LF[q] = dnoH(t);
        const fw = P.dno * (0.35 + 0.65 * smooth(0, 0.3, t)) + R * 0.9 * Math.exp(-Math.pow((t - tL) / (a * 1.3), 2));
        const sp = lerp(rv0, rv1, D.fbm(ss, wx / 2500, wz / 2500, 2) * 0.5 + 0.5);
        LS[q] = Math.pow(smooth(fw, fw + sp, d), 1.2);
        let hr = 1 - Math.abs(D.fbm(sr, wx / 1900, wz / 1900, 4)); hr *= hr;
        const hb = D.fbm(sb, wx / 2300, wz / 2300, 4) * 0.5 + 0.5;
        LV[q] = Lf + P.Ht0 + P.Hamp * (P.wr * hr + (1 - P.wr) * hb) + 28 * D.fbm(sd, wx / 750 + 11, wz / 750, 3);
      }
    }
    for (let iz = 0; iz < N2; iz++) {
      const gz = iz >> 1, tz = (iz & 1) * 0.5;
      for (let ix = 0; ix < N2; ix++) {
        const gx = ix >> 1, tx = (ix & 1) * 0.5, q = gz * nL + gx;
        let dno, u, vrch, wx, wz;
        if (!tx && !tz) { dno = LF[q]; u = LS[q]; vrch = LV[q]; wx = LW[q * 2]; wz = LW[q * 2 + 1]; }
        else {
          const q1 = tx ? q + 1 : q, q2 = tz ? q + nL : q, q3 = tz ? q1 + nL : q1;
          const w0 = (1 - tx) * (1 - tz), w1 = tx * (1 - tz), w2 = (1 - tx) * tz, w3 = tx * tz;
          dno = LF[q] * w0 + LF[q1] * w1 + LF[q2] * w2 + LF[q3] * w3;
          u = LS[q] * w0 + LS[q1] * w1 + LS[q2] * w2 + LS[q3] * w3;
          vrch = LV[q] * w0 + LV[q1] * w1 + LV[q2] * w2 + LV[q3] * w3;
          wx = LW[q * 2] * w0 + LW[q1 * 2] * w1 + LW[q2 * 2] * w2 + LW[q3 * 2] * w3;
          wz = LW[q * 2 + 1] * w0 + LW[q1 * 2 + 1] * w1 + LW[q2 * 2 + 1] * w2 + LW[q3 * 2 + 1] * w3;
        }
        H[iz * N2 + ix] = dno + Math.max(12, vrch - dno) * u + 5 * D.fbm(sd, wx / 300, wz / 300, 4) * (0.15 + u);
      }
    }
    G.H2 = H;
  }

  // =====================================================================
  // 2. eroze (kapková hydraulická + termální) na mřížce 513²
  // =====================================================================
  function eroze(G, kapek) {
    const H = G.H2, n = N2, r = D.Nahoda(G.seed + ':eroze');
    for (let i = 0; i < H.length; i++) H[i] /= K2;            // výšky v jednotkách buňky
    const Hmez = new Float32Array(H.length), MAXE = 16 / K2;   // nejvýš 16 m vymletí, u okraje méně
    for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
      const okr = Math.min(ix, iz, n - 1 - ix, n - 1 - iz);
      Hmez[iz * n + ix] = H[iz * n + ix] - MAXE * smooth(3, 24, okr);
    }
    const BO = [], BW = []; let sw = 0;
    const RB = 2;
    for (let dz = -RB; dz <= RB; dz++) for (let dx = -RB; dx <= RB; dx++) {
      const w = RB - Math.hypot(dx, dz); if (w > 0) { BO.push(dz * n + dx); BW.push(w); sw += w; }
    }
    for (let i = 0; i < BW.length; i++) BW[i] /= sw;
    const nb = BO.length;
    const inert = 0.06, capF = 4, minCap = 0.01, dep = 0.3, ero = 0.3, evap = 0.02, grav = 4, maxK = 45;
    for (let k = 0; k < kapek; k++) {
      let px = 3 + r() * (n - 7), pz = 3 + r() * (n - 7), dx = 0, dz = 0, sp = 1, w = 1, sed = 0;
      for (let s = 0; s < maxK; s++) {
        const ix = px | 0, iz = pz | 0, fx = px - ix, fz = pz - iz, i = iz * n + ix;
        const a = H[i], b = H[i + 1], c = H[i + n], d = H[i + n + 1];
        const gx = (b - a) * (1 - fz) + (d - c) * fz, gz = (c - a) * (1 - fx) + (d - b) * fx;
        const hS = (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
        dx = dx * inert - gx * (1 - inert); dz = dz * inert - gz * (1 - inert);
        const l = Math.sqrt(dx * dx + dz * dz); if (l < 1e-9) break;
        dx /= l; dz /= l; px += dx; pz += dz;
        if (px < 3 || pz < 3 || px >= n - 4 || pz >= n - 4) break;
        const jx = px | 0, jz = pz | 0, ex = px - jx, ez = pz - jz, j = jz * n + jx;
        const hN = (H[j] + (H[j + 1] - H[j]) * ex) * (1 - ez) + (H[j + n] + (H[j + n + 1] - H[j + n]) * ex) * ez;
        const dH = hN - hS;
        const cap = Math.max(-dH * sp * w * capF, minCap);
        if (sed > cap || dH > 0) {
          const amt = dH > 0 ? Math.min(dH, sed) : (sed - cap) * dep;
          sed -= amt;
          H[i] += amt * (1 - fx) * (1 - fz); H[i + 1] += amt * fx * (1 - fz); H[i + n] += amt * (1 - fx) * fz; H[i + n + 1] += amt * fx * fz;
        } else {
          const amt = Math.min((cap - sed) * ero, -dH);
          for (let q = 0; q < nb; q++) {
            const j = i + BO[q]; let e = amt * BW[q];
            const vol = H[j] - Hmez[j]; if (e > vol) e = vol > 0 ? vol : 0;
            H[j] -= e; sed += e;
          }
        }
        sp = Math.sqrt(Math.max(0, sp * sp - dH * grav)); if (sp > 8) sp = 8;
        w *= 1 - evap;
      }
    }
    for (let i = 0; i < H.length; i++) H[i] *= K2;
    // termální: sesuv nad sklonem ~36°
    const talus = Math.tan(30 * Math.PI / 180) * K2;
    for (let it = 0; it < 10; it++) {
      for (let iz = 1; iz < n - 1; iz++) for (let ix = 1; ix < n - 1; ix++) {
        const i = iz * n + ix;
        for (const j of [i + 1, i + n]) {
          const df = H[i] - H[j];
          if (df > talus) { const m = 0.4 * (df - talus); H[i] -= m; H[j] += m; }
          else if (-df > talus) { const m = 0.4 * (-df - talus); H[i] += m; H[j] -= m; }
        }
      }
    }
  }

  // naplavené dno: na rovinách lehce vyhladit (rýhy po kapkách), svahy nechat
  function vyhladRoviny(G) {
    const H = G.H2, n = N2, o = new Float32Array(H.length);
    for (let it = 0; it < 2; it++) {
      o.set(H);
      for (let iz = 1; iz < n - 1; iz++) for (let ix = 1; ix < n - 1; ix++) {
        const i = iz * n + ix, a = o[i - 1], b = o[i + 1], c = o[i - n], d = o[i + n];
        const g = Math.sqrt((b - a) * (b - a) + (d - c) * (d - c)) / (2 * K2);
        const w = 0.6 * (1 - smooth(0.04, 0.12, g));
        if (w > 0) H[i] = o[i] + ((a + b + c + d) / 4 - o[i]) * w;
      }
    }
  }

  // akumulace odtoku (D8) na hrubé mřížce — pro vlhkost, potoky a rybník
  function tok(G) {
    const H = G.H2, n = N2, M = n * n, klic = new Float64Array(M), acc = new Float32Array(M).fill(1);
    for (let i = 0; i < M; i++) klic[i] = Math.floor((600 - H[i]) * 100) * 524288 + i;   // sestupně podle výšky
    klic.sort();
    for (let k = 0; k < M; k++) {
      const i = klic[k] % 524288, ix = i % n, iz = (i / n) | 0;
      let best = -1, bs = 0;
      for (let q = 0; q < 8; q++) {
        const jx = ix + SX[q], jz = iz + SZ[q]; if (jx < 0 || jz < 0 || jx >= n || jz >= n) continue;
        const j = jz * n + jx, s = (H[i] - H[j]) / SL[q];
        if (s > bs) { bs = s; best = j; }
      }
      if (best >= 0) acc[best] += acc[i];
    }
    G.tok2 = acc;
  }

  // =====================================================================
  // 3. převzorkování na 1025² (Catmull-Rom) + jemný detail
  // =====================================================================
  function naJemnou(G) {
    const H = G.H2, n = N2, V = new Float32Array(NN), sd = D.Simplex(G.seed + ':jemny');
    // Catmull-Rom v polovině buňky: váhy (−1, 9, 9, −1) / 16
    const hh = (x, z) => H[(z < 0 ? 0 : z > n - 1 ? n - 1 : z) * n + (x < 0 ? 0 : x > n - 1 ? n - 1 : x)];
    const radek = (cx, z, lich) => lich ? (9 * (hh(cx, z) + hh(cx + 1, z)) - hh(cx - 1, z) - hh(cx + 2, z)) / 16 : hh(cx, z);
    for (let iz = 0; iz < N; iz++) {
      const cz = iz >> 1, lz = iz & 1, z = -PUL + iz * KROK;
      for (let ix = 0; ix < N; ix++) {
        const cx = ix >> 1, lx = ix & 1, x = -PUL + ix * KROK;
        const h = lz ? (9 * (radek(cx, cz, lx) + radek(cx, cz + 1, lx)) - radek(cx, cz - 1, lx) - radek(cx, cz + 2, lx)) / 16 : radek(cx, cz, lx);
        const gx = (hh(cx + 1, cz) - hh(cx - 1, cz)) / (2 * K2), gz = (hh(cx, cz + 1) - hh(cx, cz - 1)) / (2 * K2);
        const w = 0.3 + 0.7 * smooth(0.05, 0.27, Math.sqrt(gx * gx + gz * gz));
        V[iz * N + ix] = h + 1.7 * D.fbm(sd, x / 64, z / 64, 2) * w;
      }
    }
    G.V = V;
  }

  // =====================================================================
  // 4. vodní nádrž (jezero / rybník): miska, břeh, volitelně hráz
  // =====================================================================
  function nadrz(G, o) {
    // o: { x, z, R, natah, ax, az, L, hloubka, tvarSum, typ (1 jezero / 2 rybník), seed, brehIn, brehOut,
    //      hraz?: { x, z, gx, gz (směr po proudu), pul (půldélka), koruna } }
    const s = D.Simplex(G.seed + ':nadrz' + o.typ), V = G.V, W = G.W, J = G.jez;
    const bx = -o.az, bz = o.ax;              // příčná osa
    const polomer = o.R * o.natah * (1 + o.tvarSum * 1.6) + o.brehOut + 10;
    const x0 = Math.max(0, Math.floor((o.x - polomer + PUL) / KROK)), x1 = Math.min(N - 1, Math.ceil((o.x + polomer + PUL) / KROK));
    const z0 = Math.max(0, Math.floor((o.z - polomer + PUL) / KROK)), z1 = Math.min(N - 1, Math.ceil((o.z + polomer + PUL) / KROK));
    const Rth = th => o.R * (1 + o.tvarSum * s(Math.cos(th) * 1.1 + 5.3, Math.sin(th) * 1.1 + 2.1) + o.tvarSum * 0.45 * s(Math.cos(th) * 2.7 - 3.1, Math.sin(th) * 2.7 + 7.7));
    const hz = o.hraz;
    for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
      const x = -PUL + ix * KROK, z = -PUL + iz * KROK, i = iz * N + ix;
      const dx = x - o.x, dz = z - o.z, u = (dx * o.ax + dz * o.az) / o.natah, v = dx * bx + dz * bz;
      const th = Math.atan2(v, u), rr = Rth(th), q = Math.hypot(u, v) / rr;
      let strana = true;
      if (hz) strana = (x - hz.x) * hz.gx + (z - hz.z) * hz.gz < 0;
      if (!strana) continue;
      if (q < 1) {
        const hb = o.L - (0.6 + o.hloubka * Math.pow(1 - q * q, 0.6));
        if (V[i] > hb) V[i] = hb;
        W[i] = o.L; J[i] = o.typ;
      } else {
        const e = (q - 1) * rr;
        if (e > o.brehOut) continue;
        const lo = o.L + 0.35 + e * 0.03, hi = o.L + 0.55 + e * 0.3, w = 1 - smooth(o.brehIn, o.brehOut, e);
        const h = V[i], hc = h < lo ? lo : h > hi ? hi : h;
        V[i] = h + (hc - h) * w;
        if (e < 6 && W[i] < o.L) W[i] = o.L;   // hladina pod břehem (čistá čára břehu)
      }
    }
    if (hz) {                                   // hráz: lichoběžník, koruna 5 m, svahy 1 : 2.2
      const tx = -hz.gz, tz = hz.gx, dosah = hz.pul + 40;
      for (let iz = 0; iz < N; iz++) {
        const z = -PUL + iz * KROK; if (Math.abs(z - hz.z) > dosah) continue;
        for (let ix = 0; ix < N; ix++) {
          const x = -PUL + ix * KROK; if (Math.abs(x - hz.x) > dosah) continue;
          const dx = x - hz.x, dz = z - hz.z, a = dx * tx + dz * tz, c = dx * hz.gx + dz * hz.gz;
          if (Math.abs(a) > dosah || Math.abs(c) > 20) continue;
          const i = iz * N + ix;
          let hh = hz.koruna - Math.max(0, Math.abs(c) - 2.5) / 2.2;
          hh -= Math.max(0, Math.abs(a) - hz.pul) * 0.35;
          if (V[i] < hh) V[i] = hh;
          if (c > -1 && W[i] > BEZ_VODY && J[i] === o.typ && V[i] > o.L + 1) { W[i] = BEZ_VODY; J[i] = 0; }
        }
      }
    }
  }

  // =====================================================================
  // 5. řeka
  // =====================================================================
  function vyskyNG(G) {
    const h = new Float32Array(NG * NG);
    for (let iz = 0; iz < NG; iz++) for (let ix = 0; ix < NG; ix++) h[iz * NG + ix] = G.V[(iz * 4) * N + ix * 4];
    return h;
  }
  function blokVodyNG(G, okraj) {           // 1 = buňka NG s vodou do okraj buněk jemné mřížky
    const b = new Uint8Array(NG * NG), W = G.W;
    for (let iz = 0; iz < NG; iz++) for (let ix = 0; ix < NG; ix++) {
      let m = 0;
      for (let dz = -okraj; dz <= okraj && !m; dz++) for (let dx = -okraj; dx <= okraj; dx++) {
        const jx = ix * 4 + dx, jz = iz * 4 + dz; if (jx < 0 || jz < 0 || jx >= N || jz >= N) continue;
        if (W[jz * N + jx] > BEZ_VODY) { m = 1; break; }
      }
      b[iz * NG + ix] = m;
    }
    return b;
  }
  function meandruj(body, r, s1, A, lam) {
    const Lt = delkaCary(body), ph = r() * TAU, o = []; let s = 0;
    for (let i = 0; i < body.length; i++) {
      if (i) s += vzd(body[i], body[i - 1]);
      const t = tecna(body, i, 3), fade = smooth(0, 70, s) * smooth(0, 70, Lt - s);
      const off = A * fade * Math.sin(TAU * s / lam + ph + 1.6 * s1(s / 420, 0.5)) * (0.65 + 0.35 * s1(s / 260, 3.3));
      o.push([body[i][0] - t[1] * off, body[i][1] + t[0] * off]);
    }
    return o;
  }
  function profilReky(G, body, horni) {
    const n = body.length, s = new Float32Array(n);
    const hT = body.map(p => G.jez[bunka(p[0], p[1])] === 1 ? G.L : vys(G, p[0], p[1]) - 0.7);   // v jezeře = hladina jezera
    let m = horni ? hT[0] : G.L;
    for (let i = 0; i < n; i++) { m = Math.min(m, hT[i]); s[i] = m; }
    const o = new Float32Array(n);                     // vyhlazení (zachová monotónnost)
    for (let i = 0; i < n; i++) { let a = 0; for (let k = -3; k <= 3; k++) a += s[clamp(i + k, 0, n - 1)]; o[i] = a / 7; }
    for (let i = 0; i < n; i++) o[i] = horni ? Math.max(o[i], G.L) : Math.min(o[i], G.L);
    for (let i = 1; i < n; i++) if (o[i] > o[i - 1]) o[i] = o[i - 1];
    return o;
  }
  function vyhloubReku(G, R, body, hl, sir) {
    let maxW = 0; for (const w of sir) maxW = Math.max(maxW, w);
    R.cara(body, maxW / 2 + 32);
    const V = G.V, W = G.W, J = G.jez;
    for (const i of R.bunky) {
      if (J[i] === 1 || J[i] === 2) continue;
      const k = R.s[i], t = R.t[i], d = R.d[i];
      const s = lerp(hl[k], hl[k + 1], t), w = lerp(sir[k], sir[k + 1], t), hw = w / 2, hloubka = 0.6 + 0.07 * w;
      if (d < hw) {
        V[i] = s - (0.35 + hloubka * (1 - (d / hw) * (d / hw)));
      } else {
        const e = d - hw, lo = s + 0.35 + e * 0.02, hi = s + 0.55 + e * 0.32, wg = 1 - smooth(10, 30, e);
        const h = V[i], hc = h < lo ? lo : h > hi ? hi : h;
        V[i] = h + (hc - h) * wg;
      }
      if (d < hw + 2.5 && W[i] < s) W[i] = s;
    }
    R.vycisti();
  }
  function reka(G) {
    const r = D.Nahoda(G.seed + ':reka'), j = G.jezero, hG = vyskyNG(G), s1 = D.Simplex(G.seed + ':meandr');
    // horní tok: zdroj → jezero
    const cilJ = new Uint8Array(NG * NG);
    for (let i = 0; i < NG * NG; i++) { const p = gBod(i); if (G.jez[bunka(p[0], p[1])] === 1) cilJ[i] = 1; }
    const ref = G.L;
    const cH = hledejCestu([gIndex(G.S[0], G.S[1])], cilJ, (a, b, l) => l * (0.03 + Math.exp(Math.min(30, (hG[b] - ref) / 16))));
    if (!cH) throw new Error('horní tok nenalezen');
    // dolní tok: jezero → okraj mapy (zákaz vracet se podél horního toku)
    const blok = new Uint8Array(NG * NG), okr = new Uint8Array(NG * NG), zdroje = [];
    for (const i of cH) {
      const ix = i % NG, iz = (i / NG) | 0;
      for (let dz = -9; dz <= 9; dz++) for (let dx = -9; dx <= 9; dx++) {
        const jx = ix + dx, jz = iz + dz; if (jx < 0 || jz < 0 || jx >= NG || jz >= NG) continue;
        const q = jz * NG + jx; if (!cilJ[q] && dx * dx + dz * dz <= 81) blok[q] = 1;
      }
    }
    for (let i = 0; i < NG * NG; i++) {
      const ix = i % NG, iz = (i / NG) | 0;
      if (ix === 0 || iz === 0 || ix === NG - 1 || iz === NG - 1) okr[i] = 1;
      if (cilJ[i]) { zdroje.push(i); blok[i] = 0; }
    }
    const hOut = G.Lf - G.P.vystupPod;
    const cD = hledejCestu(zdroje, okr, (a, b, l) => blok[b] ? Infinity : l * (0.03 + Math.exp(Math.min(30, (hG[b] - hOut) / 16))));
    if (!cH || !cD) throw new Error('řeka nenalezena');

    const pripravit = (cesta, horni) => {
      let b = cesta.map(gBod);
      if (horni) {                                       // useknout za prvním bodem v jezeře
        const k = b.findIndex(p => G.jez[bunka(p[0], p[1])] === 1); if (k > 0) b = b.slice(0, k + 1);
      } else {
        let k = 0; while (k < b.length - 1 && G.jez[bunka(b[k + 1][0], b[k + 1][1])] === 1) k++;
        b = b.slice(k);
        const p = b[b.length - 1], q = b[Math.max(0, b.length - 3)], dx = p[0] - q[0], dz = p[1] - q[1], l = Math.hypot(dx, dz) || 1;
        b.push([p[0] + dx / l * 14, p[1] + dz / l * 14]);   // přes okraj mapy
      }
      b = prevzorkuj(chaikin(b, 3), 4);
      b = meandruj(b, r, s1, horni ? 9 : 20, horni ? r.mezi(110, 160) : r.mezi(180, 260));
      b = prevzorkuj(chaikin(b, 1), 4);
      if (horni) {                                       // konec kousek uvnitř jezera
        const k = b.findIndex(p => G.jez[bunka(p[0], p[1])] === 1); if (k > 0) b = b.slice(0, Math.min(b.length, k + 3));
      } else {
        let k = 0; while (k < b.length - 2 && G.jez[bunka(b[k + 1][0], b[k + 1][1])] === 1) k++;
        b = b.slice(Math.max(0, k - 2));
      }
      return b;
    };
    const bH = pripravit(cH, true), bD = pripravit(cD, false);
    const hlH = profilReky(G, bH, true), hlD = profilReky(G, bD, false);
    const LH = delkaCary(bH), LD = delkaCary(bD);
    const sirH = [], sirD = []; let s = 0;
    for (let i = 0; i < bH.length; i++) { if (i) s += vzd(bH[i], bH[i - 1]); sirH.push(lerp(5, 11.5, Math.pow(s / LH, 0.7))); }
    s = 0;
    const wD = G.mapa === 'jezero' ? 17 : 15;
    for (let i = 0; i < bD.length; i++) { if (i) s += vzd(bD[i], bD[i - 1]); sirD.push(lerp(wD - 2, wD + 2, s / LD)); }
    const Rz = G.raz;
    vyhloubReku(G, Rz, bH, hlH, sirH);
    vyhloubReku(G, Rz, bD, hlD, sirD);
    G.reky = [
      { jmeno: 'horni', body: bH, hl: hlH, sir: sirH },
      { jmeno: 'dolni', body: bD, hl: hlD, sir: sirD },
    ];
  }

  // =====================================================================
  // 6. vesnice, rybník, most, silnice a polní cesty
  // =====================================================================
  function nejblizsiReka(G, x, z) {           // { d, reka, i, s (hladina), w }
    let best = { d: Infinity };
    for (const rk of G.reky) for (let i = 0; i < rk.body.length; i += 2) {
      const d = Math.hypot(rk.body[i][0] - x, rk.body[i][1] - z);
      if (d < best.d) best = { d, reka: rk, i, s: rk.hl[i], w: rk.sir[i] };
    }
    return best;
  }
  function vJezere(G, x, z, rez) {            // vzdálenost od středu jezera v násobcích jeho poloměru
    const j = G.jezero, dx = x - j.x, dz = z - j.z, u = (dx * j.ax + dz * j.az) / j.natah, v = -dx * j.az + dz * j.ax;
    return Math.hypot(u, v) / (j.R * (1 + (rez || 0)));
  }
  function vodaBlizko(G, x, z, r) {          // je v kruhu o poloměru r voda? (vzorkování)
    for (let k = 0; k <= 4; k++) {
      const rr = r * k / 4, na = k ? 8 + k * 6 : 1;
      for (let a = 0; a < na; a++) if (G.W[bunka(x + Math.cos(a / na * TAU) * rr, z + Math.sin(a / na * TAU) * rr)] > BEZ_VODY) return true;
    }
    return false;
  }
  function stredniSklon(G, x, z, r) {
    let m = 0, k = 0;
    for (let a = 0; a < 8; a++) { m += sklonSt(G, x + Math.cos(a * 0.785) * r, z + Math.sin(a * 0.785) * r); k++; }
    return (m + sklonSt(G, x, z) * 2) / (k + 2);
  }

  function vesnice(G) {
    const r = D.Nahoda(G.seed + ':ves');
    let best = null;
    for (const pruchod of [0, 1, 2]) {
      const maxSk = [5.5, 7.5, 10][pruchod];
      for (const rk of G.reky) {
        const L = rk.body.length;
        for (let i = (rk.jmeno === 'horni' ? 100 : 10); i < L - 10; i += 15) {
          const p = rk.body[i], t = tecna(rk.body, i, 3);
          for (const side of [-1, 1]) for (const off of [90, 140, 190, 250]) {
            const x = p[0] - t[1] * off * side, z = p[1] + t[0] * off * side;
            if (Math.abs(x) > 1400 || Math.abs(z) > 1400) continue;
            if (vJezere(G, x, z) < 1.25 + 220 / G.jezero.R) continue;
            const nr = nejblizsiReka(G, x, z); if (nr.d < 80) continue;
            const sk = stredniSklon(G, x, z, 150); if (sk > maxSk) continue;
            if (vodaBlizko(G, x, z, 110)) continue;
            const nad = vys(G, x, z) - nr.s; if (nad < 2.5 || nad > 30) continue;
            const dj = Math.hypot(x - G.jezero.x, z - G.jezero.z);
            const sc = -sk * 0.8 - Math.abs(nad - 9) * 0.08 - dj / 900 + r() * 1.6;
            if (!best || sc > best.sc) best = { x, z, sc, reka: rk, i };
          }
        }
      }
      if (best) break;
    }
    if (!best) throw new Error('vesnice nenalezena');
    G.ves = { x: best.x, z: best.z };
  }

  function rybnik(G) {
    const r = D.Nahoda(G.seed + ':rybnik'), V0 = G.ves; let best = null;
    for (let k = 0; k < 160; k++) {
      const a = r() * TAU, rr = r.mezi(240, 700), x = V0.x + Math.cos(a) * rr, z = V0.z + Math.sin(a) * rr;
      const R = r.mezi(60, 90);
      if (Math.abs(x) > 2048 - 320 || Math.abs(z) > 2048 - 320) continue;
      if (vJezere(G, x, z) < 1 + (R * 1.5 + 160) / G.jezero.R) continue;
      const nr = nejblizsiReka(G, x, z); if (nr.d < R * 1.6 + 70) continue;
      const sk = sklonSt(G, x, z); if (sk < 1.2 || sk > 7) continue;
      if (vodaBlizko(G, x, z, R * 1.7 + 50)) continue;
      const t = G.tok2[clamp(Math.round((z + PUL) / K2), 0, N2 - 1) * N2 + clamp(Math.round((x + PUL) / K2), 0, N2 - 1)];
      const sc = Math.log(t + 1) * 0.6 - Math.abs(sk - 3.5) * 0.3 + r() * 1.2;
      if (!best || sc > best.sc) best = { x, z, R, sc };
    }
    if (!best) { G.rybnik = null; return; }
    const g = spad(G, best.x, best.z, 30), R = best.R;
    const hz = { x: best.x + g[0] * R * 0.7, z: best.z + g[1] * R * 0.7, gx: g[0], gz: g[1], pul: R * 1.35 + 20 };
    const L = Math.round(((vys(G, best.x, best.z) + vys(G, hz.x, hz.z)) / 2 + 0.5) * 100) / 100;
    hz.koruna = L + 1.8;
    nadrz(G, { x: best.x, z: best.z, R, natah: 1, ax: 1, az: 0, L, hloubka: 2.2, tvarSum: 0.18, typ: 2, brehIn: 10, brehOut: 40, hraz: hz });
    const tx = -g[1], tz = g[0], pk = R * 1.15;
    G.rybnik = { x: best.x, z: best.z, R, L, g, hraz: [[hz.x - tx * pk, hz.z - tz * pk], [hz.x + tx * pk, hz.z + tz * pk]], hz };
  }

  function nakresliSitNG(G, body) { for (const p of body) G.sitNG[gIndex(p[0], p[1])] = 1; }
  function bodNaOkraji(x, z, dx, dz) {        // kde paprsek z (x, z) opustí čtverec ±2030
    const l = Math.hypot(dx, dz); dx /= l; dz /= l; const m = 2030;
    let t = Infinity;
    if (dx > 1e-6) t = Math.min(t, (m - x) / dx); if (dx < -1e-6) t = Math.min(t, (-m - x) / dx);
    if (dz > 1e-6) t = Math.min(t, (m - z) / dz); if (dz < -1e-6) t = Math.min(t, (-m - z) / dz);
    return [x + dx * t, z + dz * t];
  }

  function silnice(G) {
    const r = D.Nahoda(G.seed + ':silnice'), V0 = G.ves, hG = vyskyNG(G), blok = blokVodyNG(G, 3);
    const hs = new Float32Array(NG * NG); for (let i = 0; i < hs.length; i++) hs[i] = D.hash2(i % NG, (i / NG) | 0, D.seedZ(G.seed + 'cs'));
    G.hG = hG; G.blokNG = blok; G.hashNG = hs;
    const hrana = k => (a, b, l) => {
      if (blok[b]) return Infinity;
      const sk = Math.abs(hG[b] - hG[a]) / l;
      return l * (1 + 0.35 * hs[b] + 900 * k * sk * sk + (sk > 0.14 ? 40 : 0));
    };
    // most: místo na řece blízko vesnice, rovný úsek mimo jezero
    let most = null;
    for (const rk of G.reky) for (let i = 10; i < rk.body.length - 10; i++) {
      const p = rk.body[i], d = Math.hypot(p[0] - V0.x, p[1] - V0.z);
      if (d < 120 || d > 600 || Math.abs(p[0]) > 1900 || Math.abs(p[1]) > 1900) continue;
      if (vJezere(G, p[0], p[1]) < 1.6) continue;
      const t1 = tecna(rk.body, i - 6, 3), t2 = tecna(rk.body, i + 6, 3), rov = t1[0] * t2[0] + t1[1] * t2[1];
      if (rov < 0.96) continue;
      if (G.rybnik && Math.hypot(p[0] - G.rybnik.x, p[1] - G.rybnik.z) < G.rybnik.R * 2 + 60) continue;
      const sc = -d / 100 - (1 - rov) * 20 + r() * 0.5;
      if (!most || sc > most.sc) most = { x: p[0], z: p[1], reka: rk, i, sc };
    }
    if (!most) throw new Error('most nenalezen');
    const rk = most.reka, t = tecna(rk.body, most.i, 4), sB = rk.hl[most.i], hw = rk.sir[most.i] / 2;
    let nx = -t[1], nz = t[0];
    if ((V0.x - most.x) * nx + (V0.z - most.z) * nz < 0) { nx = -nx; nz = -nz; }
    const pol = hw + 6, A1 = [most.x + nx * pol, most.z + nz * pol], A2 = [most.x - nx * pol, most.z - nz * pol];
    const A1p = [most.x + nx * (pol + 40), most.z + nz * (pol + 40)], A2p = [most.x - nx * (pol + 40), most.z - nz * (pol + 40)];
    const Yd = sB + 5.6;
    G.most = { x: most.x, z: most.z, uhel: uhelOsyZ(-nx, -nz), delka: 2 * pol, sirka: 7.5, y: Yd, hladina: sB, reka: rk.jmeno, i: most.i, A1, A2 };
    for (const p of [A1p, A2p]) { const gi = gIndex(p[0], p[1]); blok[gi] = 0; }

    const cil = (x, z, rad) => {
      const c = new Uint8Array(NG * NG), gi = gIndex(x, z);
      if (!rad) { c[gi] = 1; return c; }
      for (let i = 0; i < NG * NG; i++) { const p = gBod(i); if (!blok[i] && Math.hypot(p[0] - x, p[1] - z) < rad) c[i] = 1; }
      return c;
    };
    const okrajCil = (x, z) => {
      const c = new Uint8Array(NG * NG); let n = 0;
      for (let i = 0; i < NG * NG; i++) {
        const ix = i % NG, iz = (i / NG) | 0; if (!(ix === 0 || iz === 0 || ix === NG - 1 || iz === NG - 1) || blok[i]) continue;
        const p = gBod(i); if (Math.hypot(p[0] - x, p[1] - z) < 450) { c[i] = 1; n++; }
      }
      return n ? c : null;
    };
    const rot = (dx, dz, a) => [dx * Math.cos(a) - dz * Math.sin(a), dx * Math.sin(a) + dz * Math.cos(a)];
    let d1 = rot(V0.x - most.x, V0.z - most.z, r.mezi(-0.6, 0.6)), d2 = rot(most.x - V0.x, most.z - V0.z, r.mezi(-0.5, 0.5));
    const E1 = bodNaOkraji(V0.x, V0.z, d1[0], d1[1]), E2 = bodNaOkraji(A2p[0], A2p[1], d2[0], d2[1]);
    const vI = gIndex(V0.x, V0.z); blok[vI] = 0;
    const c1 = hledejCestu([vI], okrajCil(E1[0], E1[1]) || cil(E1[0], E1[1], 0), hrana(1));
    const c2 = hledejCestu([vI], cil(A1p[0], A1p[1], 0), hrana(1));
    const c3 = hledejCestu([gIndex(A2p[0], A2p[1])], okrajCil(E2[0], E2[1]) || cil(E2[0], E2[1], 0), hrana(1));
    if (!c1 || !c2 || !c3) throw new Error('silnice nenalezena');
    let p1 = c1.map(gBod).reverse().concat(c2.slice(1).map(gBod));
    p1[p1.length - 1] = A1p.slice();
    let p3 = c3.map(gBod); p3[0] = A2p.slice();
    // na okraj mapy úplně
    const kraj = b => { const p = b[b.length - 1]; if (Math.abs(p[0]) > 2000) p[0] = Math.sign(p[0]) * 2048; if (Math.abs(p[1]) > 2000) p[1] = Math.sign(p[1]) * 2048; };
    p1.reverse(); kraj(p1); p1.reverse(); kraj(p3);
    p1 = prevzorkuj(chaikin(p1, 3), 4); p3 = prevzorkuj(chaikin(p3, 3), 4);
    const pM = prevzorkuj([A1p, A1, A2, A2p], 4);
    const body = p1.concat(pM.slice(1), p3.slice(1));
    const mostOd = p1.length - 1, mostDo = p1.length - 1 + pM.length - 1;
    // body na mostě (mezi A1 a A2)
    const naMoste = new Uint8Array(body.length);
    for (let i = mostOd; i <= mostDo; i++) {
      const p = body[i], a = (p[0] - most.x) * nx + (p[1] - most.z) * nz;
      if (Math.abs(a) <= pol + 0.01) naMoste[i] = 1;
    }
    G.cestyD = [{ typ: 'silnice', sirka: 6, body, naMoste, mostY: Yd }];
    nakresliSitNG(G, body);

    // vedlejší ulice z návsi, kolmo od řeky
    const iV = nejblizsiIndex(body, V0.x, V0.z), tv = tecna(body, iV, 4);
    let ux = -tv[1], uz = tv[0];
    if ((V0.x - most.x) * ux + (V0.z - most.z) * uz < 0) { ux = -ux; uz = -uz; }
    const T = [V0.x + ux * 230, V0.z + uz * 230];
    const c4 = hledejCestu([gIndex(body[iV][0], body[iV][1])], cil(T[0], T[1], 30), hrana(1));
    if (c4 && c4.length > 6) {
      const b4 = prevzorkuj(chaikin([body[iV]].concat(c4.slice(1).map(gBod)), 3), 4);
      G.cestyD.push({ typ: 'silnice', sirka: 5, body: b4, ulice: true });
      nakresliSitNG(G, b4);
    }
    G.silniceHlavni = G.cestyD[0];
  }
  function nejblizsiIndex(body, x, z) { let b = 0, m = Infinity; for (let i = 0; i < body.length; i++) { const d = Math.hypot(body[i][0] - x, body[i][1] - z); if (d < m) { m = d; b = i; } } return b; }

  function vrcholy(G) {                       // nejvyšší místa (rozhledna, vrchol)
    const V = G.V, ves = G.ves, cand = [];
    for (let iz = 60; iz < N - 60; iz += 4) for (let ix = 60; ix < N - 60; ix += 4) {
      const i = iz * N + ix, h = V[i]; let max = true;
      for (let dz = -24; dz <= 24 && max; dz += 4) for (let dx = -24; dx <= 24; dx += 4) {
        const j = (iz + dz) * N + ix + dx; if (V[j] > h) { max = false; break; }
      }
      if (max) cand.push({ x: -PUL + ix * KROK, z: -PUL + iz * KROK, h });
    }
    cand.sort((a, b) => b.h - a.h);
    const ok = cand.filter(c => Math.hypot(c.x - ves.x, c.z - ves.z) > 450 && G.W[bunka(c.x, c.z)] <= BEZ_VODY);
    G.vrcholy = ok;
    G.vrchRozhledna = ok[0] || cand[0];
    G.vrchDruhy = ok.find(c => Math.hypot(c.x - G.vrchRozhledna.x, c.z - G.vrchRozhledna.z) > 700) || null;
  }

  function polniCesty(G) {
    const r = D.Nahoda(G.seed + ':polni'), V0 = G.ves, hG = G.hG, blok = G.blokNG, hs = G.hashNG;
    const hrana = (a, b, l) => {
      if (blok[b]) return Infinity;
      const sk = Math.abs(hG[b] - hG[a]) / l;
      return (G.sitNG[b] ? 0.35 : 1) * l * (1 + 0.5 * hs[b] + 450 * sk * sk + (sk > 0.2 ? 30 : 0));
    };
    const cile = [];
    const T = G.vrchRozhledna, sp = spad(G, T.x, T.z, 20);
    cile.push({ x: T.x + sp[0] * 14, z: T.z + sp[1] * 14, jmeno: 'rozhledna' });
    if (G.rybnik) { const h = G.rybnik.hraz; cile.push({ x: h[1][0], z: h[1][1], jmeno: 'rybnik', pres: [h[0], h[1]] }); }
    // břeh jezera blíž vesnici
    {
      const j = G.jezero, a = Math.atan2(V0.z - j.z, V0.x - j.x); let bp = null;
      for (let k = 0; k < 13 && !bp; k++) {
        const aa = a + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.12;
        for (let rr = j.R * 0.8; rr < j.R * 3; rr += 8) {
          const x = j.x + Math.cos(aa) * rr, z = j.z + Math.sin(aa) * rr;
          if (G.W[bunka(x, z)] <= BEZ_VODY && vJezere(G, x, z) > 1) {
            const q = [x + Math.cos(aa) * 14, z + Math.sin(aa) * 14];
            if (G.W[bunka(q[0], q[1])] <= BEZ_VODY && nejblizsiReka(G, q[0], q[1]).d > 30) bp = q;
            break;
          }
        }
      }
      if (bp) cile.push({ x: bp[0], z: bp[1], jmeno: 'jezero' });
    }
    const nNah = r.cele(4, 6);
    for (let k = 0, tries = 0; k < nNah && tries < 200; tries++) {
      const a = r() * TAU, rr = r.mezi(550, 1450), x = V0.x + Math.cos(a) * rr, z = V0.z + Math.sin(a) * rr;
      if (Math.abs(x) > 1950 || Math.abs(z) > 1950 || G.W[bunka(x, z)] > BEZ_VODY || sklonSt(G, x, z) > 12) continue;
      if (cile.some(c => Math.hypot(c.x - x, c.z - z) < 400)) continue;
      cile.push({ x, z, jmeno: 'pole' }); k++;
    }
    for (const c of cile) {
      const zdroje = []; for (let i = 0; i < NG * NG; i++) if (G.sitNG[i]) zdroje.push(i);
      const ci = new Uint8Array(NG * NG), gi = gIndex(c.x, c.z); ci[gi] = 1; blok[gi] = 0;
      const cesta = hledejCestu(zdroje, ci, hrana);
      if (!cesta || cesta.length < 4) continue;
      let b = cesta.map(gBod);
      // první bod přitáhnout na existující cestu
      const nb = nejblizsiNaCestach(G, b[0][0], b[0][1]); if (nb) b[0] = nb;
      b[b.length - 1] = [c.x, c.z];
      if (c.pres) b.push(c.pres[0]);                    // přes hráz rybníka
      b = prevzorkuj(chaikin(b, 3), 4);
      if (delkaCary(b) > 2600) continue;
      G.cestyD.push({ typ: 'polni', sirka: 3, body: b, cil: c.jmeno });
      nakresliSitNG(G, b);
    }
  }
  function nejblizsiNaCestach(G, x, z) {
    let best = null, m = 40;
    for (const c of G.cestyD) for (const p of c.body) { const d = Math.hypot(p[0] - x, p[1] - z); if (d < m) { m = d; best = p.slice(); } }
    return best;
  }

  // srovnání terénu podél cest (silnice plynule, náspy k mostu) + maska B
  function srovnejCesty(G) {
    const V = G.V, W = G.W, M = G.M, Rz = G.raz;
    for (const c of G.cestyD) {
      const b = c.body, n = b.length, hp = new Float32Array(n);
      for (let i = 0; i < n; i++) hp[i] = vys(G, b[i][0], b[i][1]);
      const okno = c.typ === 'silnice' ? 6 : 3;
      for (let it = 0; it < 3; it++) {
        const o = new Float32Array(n);
        for (let i = 0; i < n; i++) { let a = 0, k = 0; for (let j = -okno; j <= okno; j++) { const q = i + j; if (q >= 0 && q < n) { a += hp[q]; k++; } } o[i] = a / k; }
        hp.set(o);
      }
      if (c.naMoste) {                                  // nájezdy na most
        const kum = [0]; for (let i = 1; i < n; i++) kum.push(kum[i - 1] + vzd(b[i], b[i - 1]));
        let s0 = Infinity, s1 = -Infinity; for (let i = 0; i < n; i++) if (c.naMoste[i]) { s0 = Math.min(s0, kum[i]); s1 = Math.max(s1, kum[i]); }
        for (let i = 0; i < n; i++) {
          const e = kum[i] < s0 ? s0 - kum[i] : kum[i] > s1 ? kum[i] - s1 : 0;
          hp[i] = lerp(c.mostY, hp[i], smooth(0, 75, e));
        }
      }
      c.profil = hp;
      const hw = c.sirka / 2;
      Rz.cara(b, hw + 14);
      const hodn = c.typ === 'silnice' ? 255 : 150;
      for (const i of Rz.bunky) {
        const k = Rz.s[i], t = Rz.t[i], d = Rz.d[i];
        if (c.naMoste && c.naMoste[k] && c.naMoste[k + 1]) continue;
        const cilH = lerp(hp[k], hp[k + 1], t);
        if (W[i] <= BEZ_VODY) {
          const e = d - hw;
          if (e <= 0.8) V[i] = cilH;
          else {
            const h = V[i], lo = cilH - (e - 0.8) * 0.55, hi = cilH + (e - 0.8) * 0.55, wg = 1 - smooth(5, 14, e);
            const hc = h < lo ? lo : h > hi ? hi : h; V[i] = h + (hc - h) * wg;
          }
          const bv = Math.round(hodn * (1 - smooth(hw - 0.6, hw + 1.0, d)));
          if (bv > M[i * 4 + 2]) M[i * 4 + 2] = bv;
        }
      }
      Rz.vycisti();
    }
  }

  // =====================================================================
  // 7. stavby (vesnice, kostel, rozhledna, kaple, start)
  // =====================================================================
  function obdBunky(cx, cz, u, sir, del, okraj, f) {     // f(i, e) pro buňky v obdélníku + okraj (e = vzdálenost ven, ≤ 0 uvnitř)
    const c = Math.cos(u), s = Math.sin(u), hx = sir / 2, hz = del / 2, R = Math.hypot(hx, hz) + okraj + 1;
    const x0 = Math.max(0, Math.floor((cx - R + PUL) / KROK)), x1 = Math.min(N - 1, Math.ceil((cx + R + PUL) / KROK));
    const z0 = Math.max(0, Math.floor((cz - R + PUL) / KROK)), z1 = Math.min(N - 1, Math.ceil((cz + R + PUL) / KROK));
    for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
      const dx = -PUL + ix * KROK - cx, dz = -PUL + iz * KROK - cz;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const e = Math.max(Math.abs(lx) - hx, Math.abs(lz) - hz);
      if (e <= okraj) f(iz * N + ix, e);
    }
  }
  function volneMisto(G, cx, cz, u, sir, del, okraj, maxSk) {
    if (Math.abs(cx) > 2048 - 60 || Math.abs(cz) > 2048 - 60) return false;
    let ok = true; const W = G.W, M = G.M, O = G.obs;
    obdBunky(cx, cz, u, sir, del, okraj, i => { if (W[i] > BEZ_VODY || M[i * 4 + 2] > 0 || O[i]) ok = false; });
    if (!ok) return false;
    if (G.dVodaHruba && G.dVodaHruba(cx, cz) < 12 + Math.max(sir, del) / 2) return false;
    if (maxSk != null) {
      const c = Math.cos(u), s = Math.sin(u), hx = sir / 2, hz = del / 2, hh = [];
      for (const [a, b] of [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz], [0, 0]]) hh.push(vys(G, cx + a * c + b * s, cz - a * s + b * c));
      const dmax = Math.max(...hh) - Math.min(...hh);
      if (Math.atan(dmax / Math.max(6, Math.min(sir, del))) * 57.3 > maxSk) return false;
    }
    return true;
  }
  function pridejStavbu(G, st, okrajObs, srovnat) {
    st.uhel = st.uhel || 0;
    if (srovnat) srovnejObd(G, st.x, st.z, st.uhel, st.sirka, st.delka, 2.5, 9);
    obdBunky(st.x, st.z, st.uhel, st.sirka, st.delka, okrajObs, i => { G.obs[i] = 1; });
    obdBunky(st.x, st.z, st.uhel, st.sirka, st.delka, okrajObs + 3, i => { G.zakaz[i] |= 1; });
    st._srovnat = !!srovnat;
    G.stavby.push(st);
    return st;
  }
  function srovnejObd(G, cx, cz, u, sir, del, okraj, prechod, h0) {
    const V = G.V, W = G.W;
    if (h0 == null) { let a = 0, k = 0; obdBunky(cx, cz, u, sir, del, 0, i => { a += V[i]; k++; }); h0 = k ? a / k : vys(G, cx, cz); }
    obdBunky(cx, cz, u, sir, del, okraj + prechod, (i, e) => {
      if (W[i] > BEZ_VODY) return;
      if (e <= okraj) V[i] = h0; else V[i] = lerp(V[i], h0, smooth(okraj + prechod, okraj, e));
    });
    return h0;
  }

  function stavbyVesnice(G) {
    const r = D.Nahoda(G.seed + ':stavby'), V0 = G.ves, hl = G.silniceHlavni;
    // hrubá vzdálenost od vody (body řek + jezer)
    { const jeV = new Uint8Array(NN); for (let i = 0; i < NN; i++) if (G.W[i] > BEZ_VODY) jeV[i] = 1; const dv = vzdalenosti(jeV); G.dVoda = dv.d; G.nejVoda = dv.nej; }
    G.dVodaHruba = (x, z) => G.dVoda[bunka(x, z)];
    // rozhledna na nejvyšším vrcholu
    const T = G.vrchRozhledna;
    pridejStavbu(G, { typ: 'rozhledna', x: T.x, z: T.z, uhel: r() * TAU, sirka: 6, delka: 6, vyska: 26, strecha: 3 }, 2, true);

    // kostel na mírném návrší u vesnice
    let kb = null;
    for (let k = 0; k < 400; k++) {
      const a = r() * TAU, rr = r.mezi(40, 300), x = V0.x + Math.cos(a) * rr, z = V0.z + Math.sin(a) * rr;
      const dc = vzdOdCestD(G, x, z); if (dc < 32 || dc > 110) continue;
      if (G.dVodaHruba(x, z) < 60) continue;
      if (sklonSt(G, x, z) > 9) continue;
      let ok = true; for (const p of [[22, 0], [-26, 0], [0, 12], [0, -12]]) if (G.M[bunka(x + p[0], z + p[1]) * 4 + 2] > 0) ok = false;
      if (!ok) continue;
      let prum = 0; for (let q = 0; q < 12; q++) prum += vys(G, x + Math.cos(q * 0.52) * 90, z + Math.sin(q * 0.52) * 90);
      const nad = vys(G, x, z) - prum / 12;
      const sc = nad - rr / 120 + r() * 0.5;
      if (!kb || sc > kb.sc) kb = { x, z, sc };
    }
    if (kb) {
      const u = Math.PI / 2 + r.mezi(-0.15, 0.15), lz = [Math.sin(u), Math.cos(u)];
      const kx = kb.x + lz[0] * 4, kz = kb.z + lz[1] * 4;
      const h0 = srovnejObd(G, kb.x, kb.z, u, 14, 38, 3, 12);
      pridejStavbu(G, { typ: 'kostel', x: kx, z: kz, uhel: u, sirka: 12, delka: 24, vyska: 10, strecha: 7 }, 2, false);
      pridejStavbu(G, { typ: 'vez', x: kx - lz[0] * 15.5, z: kz - lz[1] * 15.5, uhel: u, sirka: 7, delka: 7, vyska: 24, strecha: 12 }, 1, false);
      G.kostel = { x: kb.x, z: kb.z, uhel: u, h0 };
      // zeď hřbitova
      const ax = [Math.cos(u), -Math.sin(u)], hx = 24, hz = 31;
      for (const [cx, cz, du, dl] of [[hx, 0, 0, 2 * hz], [-hx, 0, 0, 2 * hz], [0, hz, Math.PI / 2, 2 * hx], [0, -hz, Math.PI / 2, 2 * hx]]) {
        const x = kb.x + ax[0] * cx + lz[0] * cz, z = kb.z + ax[1] * cx + lz[1] * cz;
        const w = { typ: 'plot', x, z, uhel: u + du, sirka: 0.5, delka: dl, vyska: 1.6, strecha: 0, zed: true };
        // vynechat úseky, které by šly přes silnici
        let naCeste = false; obdBunky(x, z, w.uhel, 0.5, dl, 0, i => { if (G.M[i * 4 + 2] > 0) naCeste = true; });
        if (!naCeste) pridejStavbu(G, w, 1.5, false);
      }
    }

    // domy podél silnic, štítem do návsi, za nimi stodoly a zahrady
    const cilDomu = r.cele(18, 28); let domu = 0;
    const ulice = G.cestyD.filter(c => c.typ === 'silnice');
    const mostP = [G.most.x, G.most.z];
    for (let pruchod = 0; pruchod < 3 && domu < 16; pruchod++) for (const ul of ulice) {
      const b = ul.body, iV = nejblizsiIndex(b, V0.x, V0.z);
      const kum = [0]; for (let i = 1; i < b.length; i++) kum.push(kum[i - 1] + vzd(b[i], b[i - 1]));
      const sV = kum[iV], rozsah = (ul.ulice ? 260 : 330) + pruchod * 140;
      // pozice střídavě od návsi ven (další průchody jen dál od návsi)
      const poz = [];
      for (let s = 18 + (pruchod ? rozsah - 140 : 0); s < rozsah; s += r.mezi(27, 38)) { poz.push(sV + s); if (!ul.ulice) poz.push(sV - s); }
      for (const s of poz) {
        if (domu >= cilDomu) break;
        if (s < 0 || s > kum[kum.length - 1]) continue;
        let i = 0; while (i < b.length - 1 && kum[i + 1] < s) i++;
        const p = b[i], t = tecna(b, i, 3);
        if (Math.hypot(p[0] - mostP[0], p[1] - mostP[1]) < 70) continue;
        for (const side of [1, -1]) {
          if (domu >= cilDomu || (!pruchod && r() < 0.18)) continue;
          const nx = -t[1] * side, nz = t[0] * side;
          const del = r.mezi(12, 16), sir = r.mezi(8, 10), off = ul.sirka / 2 + 5 + del / 2 + r.mezi(0, 3);
          const x = p[0] + nx * off, z = p[1] + nz * off, u = uhelOsyZ(nx, nz) + r.mezi(-0.06, 0.06);
          if (G.kostel && Math.hypot(x - G.kostel.x, z - G.kostel.z) < 100) continue;
          if (!volneMisto(G, x, z, u, sir, del, 3, 14)) continue;
          pridejStavbu(G, { typ: 'dum', x, z, uhel: u, sirka: sir, delka: del, vyska: r.mezi(3.2, 4.2), strecha: r.mezi(3.8, 5.2) }, 3, true);
          domu++;
          // stodola za domem (rovnoběžně se silnicí)
          const bs = r.mezi(9, 12), bd = r.mezi(16, 24), boff = off + del / 2 + 12 + bs / 2;
          const sx = p[0] + nx * boff, sz = p[1] + nz * boff, su = uhelOsyZ(t[0], t[1]);
          let stodola = false;
          if (r() < 0.6 && volneMisto(G, sx, sz, su, bs, bd, 3, 14)) {
            pridejStavbu(G, { typ: 'stodola', x: sx, z: sz, uhel: su, sirka: bs, delka: bd, vyska: r.mezi(4.5, 6), strecha: r.mezi(4, 5.5) }, 3, true);
            stodola = true;
          }
          // zahrada: ovocné stromky a plot
          const zh = { x, z, nx, nz, tx: t[0], tz: t[1], hl: stodola ? 8 : 16 };
          G.zahrady.push(zh);
          if (r() < 0.55) {
            const zd = off + del / 2 + (stodola ? 12 + bs + 3 : 20);
            const kx = p[0] + nx * zd, kz = p[1] + nz * zd;
            const pl = { typ: 'plot', x: kx, z: kz, uhel: su, sirka: 0.12, delka: 22, vyska: 1.2, strecha: 0 };
            if (volneMisto(G, kx, kz, su, 0.4, 22, 0.5)) pridejStavbu(G, pl, 1, false);
          }
        }
      }
    }
    G.pocetDomu = domu;

    // kaple na křižovatce polní cesty se silnicí
    let kap = null;
    for (const c of G.cestyD) {
      if (c.typ !== 'polni') continue;
      const p = c.body[0], dV = Math.hypot(p[0] - V0.x, p[1] - V0.z);
      if (dV < 200 || dV > 1200 || vzdOdCary(hl.body, p[0], p[1]) > 10) continue;
      const t = tecna(c.body, 3, 3), i = nejblizsiIndex(hl.body, p[0], p[1]), th = tecna(hl.body, i, 3);
      for (const sg of [1, -1]) {
        // do úhlu mezi cestami
        let dx = -t[0] * 0.5 + th[0] * sg * 0.5, dz = -t[1] * 0.5 + th[1] * sg * 0.5; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        const x = p[0] + dx * 11, z = p[1] + dz * 11, u = uhelOsyZ(-dx, -dz);
        if (volneMisto(G, x, z, u, 4, 6, 2, 14)) { kap = { x, z, u }; break; }
      }
      if (kap) break;
    }
    if (!kap) {
      const b = hl.body, iV = nejblizsiIndex(b, V0.x, V0.z);
      for (const ds of [110, -110, 150, -150, 200, -200, 260, -260]) {
        const i = clamp(iV + ds, 0, b.length - 1), p = b[i], t = tecna(b, i, 3), x = p[0] - t[1] * 9, z = p[1] + t[0] * 9;
        if (volneMisto(G, x, z, uhelOsyZ(t[1], -t[0]), 4, 6, 2, 14)) { kap = { x, z, u: uhelOsyZ(t[1], -t[0]) }; break; }
      }
    }
    if (kap) pridejStavbu(G, { typ: 'kaple', x: kap.x, z: kap.z, uhel: kap.u, sirka: 4, delka: 6, vyska: 4, strecha: 3 }, 2, true);

    // most
    const m = G.most;
    G.stavby.push({ typ: 'most', x: m.x, z: m.z, y: m.y, uhel: m.uhel, sirka: m.sirka, delka: m.delka, vyska: m.y - m.hladina, strecha: 0, hladina: m.hladina });
    obdBunky(m.x, m.z, m.uhel, m.sirka, m.delka, 2, i => { G.zakaz[i] |= 1; });
  }
  function vzdOdCestD(G, x, z) { let m = Infinity; for (const c of G.cestyD) m = Math.min(m, vzdOdCary(c.body, x, z)); return m; }

  // startovní plocha na louce u vesnice s výhledem
  function startovniPlocha(G) {
    const r = D.Nahoda(G.seed + ':start'), V0 = G.ves; let best = null;
    const ciluPohled = [];
    if (G.kostel) ciluPohled.push([G.kostel.x, G.kostel.z, vys(G, G.kostel.x, G.kostel.z) + 20]);
    ciluPohled.push([G.jezero.x, G.jezero.z, G.L + 1]);
    for (let k = 0; k < 500; k++) {
      const a = r() * TAU, rr = r.mezi(170, 520), x = V0.x + Math.cos(a) * rr, z = V0.z + Math.sin(a) * rr;
      if (Math.abs(x) > 1900 || Math.abs(z) > 1900) continue;
      const sk = stredniSklon(G, x, z, 28); if (sk > 4.5) continue;
      if (G.dVodaHruba(x, z) < 55) continue;
      let ok = true;
      for (const st of G.stavby) if (Math.hypot(st.x - x, st.z - z) < 60) { ok = false; break; }
      if (!ok) continue;
      const dc = vzdOdCestD(G, x, z); if (dc < 22 || dc > 160) continue;
      let vyhled = 0;
      for (const c of ciluPohled) vyhled += viditelnost(G, x, vys(G, x, z) + 3, z, c[0], c[2], c[1]);
      const sc = vyhled * 2 - sk * 0.4 - dc / 120 - rr / 600 + r() * 0.6;
      if (!best || sc > best.sc) best = { x, z, sc };
    }
    if (!best) throw new Error('start nenalezen');
    const cil = G.kostel ? [G.kostel.x, G.kostel.z] : [G.jezero.x, G.jezero.z];
    const smer = kurzSmeru(cil[0] - best.x, cil[1] - best.z);
    // srovnat kruh 30 m a zakázat stromy, pole a les do 42 m
    let h0 = 0, k = 0;
    for (let q = 0; q < 24; q++) { const rr = (q % 3 + 1) * 9, a = q * 0.79; h0 += vys(G, best.x + Math.cos(a) * rr, best.z + Math.sin(a) * rr); k++; }
    h0 /= k;
    const V = G.V, R0 = 30, R1 = 52;
    obdBunky(best.x, best.z, 0, 2 * R1, 2 * R1, 0, i => {
      const x = -PUL + (i % N) * KROK, z = -PUL + ((i / N) | 0) * KROK, d = Math.hypot(x - best.x, z - best.z);
      if (d > R1 || G.W[i] > BEZ_VODY) return;
      if (G.M[i * 4 + 2] > 0 && d > R0) return;
      V[i] = d <= R0 ? h0 : lerp(V[i], h0, smooth(R1, R0, d));
      if (d < 42) G.zakaz[i] |= 3;
    });
    G.start = { x: best.x, z: best.z, smer, h0 };
  }
  function viditelnost(G, x0, y0, z0, x1, y1, z1) {
    const n = 40;
    for (let k = 1; k < n; k++) { const t = k / n, x = lerp(x0, x1, t), z = lerp(z0, z1, t), y = lerp(y0, y1, t); if (vys(G, x, z) > y) return 0; }
    return 1;
  }

  // =====================================================================
  // 8. masky: pole, les, vlhkost
  // =====================================================================
  function odvozenaPole(G) {
    const V = G.V, sk = new Float32Array(NN);
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
      const i = iz * N + ix, a = V[iz * N + Math.max(0, ix - 1)], b = V[iz * N + Math.min(N - 1, ix + 1)];
      const c = V[Math.max(0, iz - 1) * N + ix], d = V[Math.min(N - 1, iz + 1) * N + ix];
      sk[i] = Math.atan(Math.hypot(b - a, d - c) / (2 * KROK)) * 57.2958;
    }
    G.sklon = sk;
    const bl = rozmaz(V, N, 60); for (let i = 0; i < NN; i++) bl[i] = V[i] - bl[i]; G.hRel = bl;
    // G.dVoda spočteno už ve stavbyVesnice (voda se pak nemění)
    G.dObydli = vzdalenosti(G.obs).d;
  }

  function maskaPole(G) {
    const r = D.Nahoda(G.seed + ':pole'), V0 = G.ves, M = G.M, S = 230, ns = Math.ceil(4096 / S) + 2;
    const sx = new Float32Array(ns * ns), sz = new Float32Array(ns * ns), smer = new Float32Array(ns * ns), pas = new Float32Array(ns * ns);
    const elig = new Float32Array(ns * ns), cel = new Float32Array(ns * ns), jePole = new Uint8Array(ns * ns);
    for (let gz = 0; gz < ns; gz++) for (let gx = 0; gx < ns; gx++) {
      const b = gz * ns + gx; sx[b] = -PUL - S + (gx + 0.15 + 0.7 * r()) * S; sz[b] = -PUL - S + (gz + 0.15 + 0.7 * r()) * S;
      const g = spad(G, clamp(sx[b], -2000, 2000), clamp(sz[b], -2000, 2000), 40);
      smer[b] = r() < 0.55 ? Math.atan2(g[1], g[0]) + (r() < 0.5 ? 0 : Math.PI / 2) + r.mezi(-0.25, 0.25) : r() * Math.PI;
      pas[b] = r.mezi(18, 42);
    }
    const sw = D.Simplex(G.seed + ':polew'), blok = new Int32Array(NN).fill(-1), mez = G.mez = new Uint8Array(NN);
    const dosah = 1650 * G.P.varka;
    const vhodna = i => G.sklon[i] < 8.5 && G.dVoda[i] > 35 && M[i * 4 + 2] === 0 && !(G.zakaz[i] & 2) && G.dObydli[i] > 22;
    for (let pass = 0; pass < 2; pass++) {
      for (let iz = 0; iz < N; iz++) {
        const z = -PUL + iz * KROK; if (Math.abs(z - V0.z) > dosah + 250) continue;
        for (let ix = 0; ix < N; ix++) {
          const x = -PUL + ix * KROK, ddx = x - V0.x, ddz = z - V0.z; if (ddx * ddx + ddz * ddz > (dosah + 250) * (dosah + 250)) continue;
          const i = iz * N + ix;
          let b1 = -1, d1 = 1e9, d2 = 1e9;
          if (pass === 0) {
            const wx = x + 28 * sw(x / 380, z / 380), wz = z + 28 * sw(x / 380 + 9.1, z / 380 + 3.7);
            const gx = Math.floor((wx + PUL + S) / S), gz = Math.floor((wz + PUL + S) / S);
            for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) {
              const qx = gx + c, qz = gz + a; if (qx < 0 || qz < 0 || qx >= ns || qz >= ns) continue;
              const b = qz * ns + qx, ex = wx - sx[b], ez = wz - sz[b], dd = Math.sqrt(ex * ex + ez * ez);
              if (dd < d1) { d2 = d1; d1 = dd; b1 = b; } else if (dd < d2) d2 = dd;
            }
            blok[i] = b1;
            if ((d2 - d1) / 2 < 4) mez[i] = 1;
            cel[b1]++; if (vhodna(i)) elig[b1]++;
          } else {
            const b = blok[i]; if (b < 0 || !jePole[b] || mez[i] || !vhodna(i)) continue;
            const c = Math.cos(smer[b]), s = Math.sin(smer[b]);
            const v = (x * c + z * s) / pas[b], k = Math.floor(v);
            const hh = D.hash2(b, k, 77);
            if (hh < 0.17) continue;                    // úhor / louka
            const plod = [255, 215, 175, 135][Math.floor(D.hash2(b, k, 91) * 4)];
            M[i * 4 + 1] = plod;
          }
        }
      }
      if (pass === 0) {
        for (let b = 0; b < ns * ns; b++) {
          const dV = Math.hypot(sx[b] - V0.x, sz[b] - V0.z);
          if (cel[b] > 50 && elig[b] / cel[b] > 0.6 && dV < dosah && r() < 0.82) jePole[b] = 1;
        }
      }
    }
    G.poleBloky = { sx, sz, smer, pas, jePole, ns, blok };
  }

  function maskaLes(G) {
    const M = G.M, V0 = G.ves, P = G.P;
    const sF = D.Simplex(G.seed + ':les'), sE = D.Simplex(G.seed + ':lesokraj');
    const f = new Float32Array(NN); let hmin = Infinity, hmax = -Infinity;
    for (let i = 0; i < NN; i++) { const h = G.V[i]; if (h < hmin) hmin = h; if (h > hmax) hmax = h; }
    G.hmin = hmin; G.hmax = hmax;
    const hist = new Float64Array(400); let celkem = 0;
    const FL = new Float32Array(NG * NG);
    for (let q = 0; q < NG * NG; q++) { const p = gBod(q); FL[q] = D.fbm(sF, p[0] / 1100, p[1] / 1100, 3) * 0.5 + 0.5; }
    for (let iz = 0; iz < N; iz++) {
      const z = -PUL + iz * KROK;
      for (let ix = 0; ix < N; ix++) {
        const x = -PUL + ix * KROK, i = iz * N + ix;
        if (M[i * 4 + 1] > 0 || G.W[i] > BEZ_VODY || (G.zakaz[i] & 2)) { f[i] = -9; continue; }
        const dV = Math.sqrt((x - V0.x) * (x - V0.x) + (z - V0.z) * (z - V0.z));
        let v = 0.5 * bil(FL, NG, KG, -PUL, x, z)
          + 0.30 * smooth(5, 17, G.sklon[i]) + 0.5 * smooth(-12, 30, G.hRel[i])
          + 0.25 * smooth(G.Lf + 70, G.Lf + 190, G.V[i])
          - 0.9 * (1 - smooth(220, 560, dV)) - 0.55 * (1 - smooth(14, 70, G.dVoda[i])) - 0.5 * (1 - smooth(20, 70, G.dObydli[i]));
        v += 0.10 * D.fbm(sE, x / 95, z / 95, 2) + 0.045 * sE(x / 23 + 40, z / 23);
        f[i] = v;
        const b = clamp(Math.floor((v + 1) * 100), 0, 399); hist[b]++; celkem++;
      }
    }
    // práh podle požadovaného podílu lesa z celé mapy
    const cil = P.lesPodil * NN; let a = 0, prah = 3;
    for (let b = 399; b >= 0; b--) { a += hist[b]; if (a >= cil) { prah = b / 100 - 1; break; } }
    G.prahLesa = prah;
    for (let i = 0; i < NN; i++) {
      let R = smooth(prah - 0.025, prah + 0.025, f[i]) * 255;
      R *= 1 - M[i * 4 + 2] / 255;
      M[i * 4] = Math.round(R);
    }
  }

  function maskaVlhkost(G) {
    const M = G.M, W = G.W, nej = G.nejVoda, t2 = G.tok2;
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
      const i = iz * N + ix, d = G.dVoda[i];
      let a = 255 * Math.exp(-d / 16);
      if (d < 260 && nej[i] >= 0) {
        const nad = G.V[i] - W[nej[i]];
        a = Math.max(a, 190 * (1 - smooth(0.8, 3.5, nad)) * (1 - smooth(110, 260, d)));
      }
      const tk = t2[(iz >> 1) * N2 + (ix >> 1)];
      if (tk > 120 && G.sklon[i] < 22) a = Math.max(a, 150 * smooth(Math.log(120), Math.log(2500), Math.log(tk)));
      M[i * 4 + 3] = Math.round(Math.min(255, a));
    }
  }

  // =====================================================================
  // 9. elektrické vedení
  // =====================================================================
  const VYSKA_SLOUPU = 24, DRATY = [[0, 0], [-2.6, -2.2], [2.6, -2.2]];
  function vedeni(G) {
    const r = D.Nahoda(G.seed + ':vedeni'), V0 = G.ves;
    let best = null;
    for (const vs of [VYSKA_SLOUPU, 30, 36]) {
      G.vyskaSloupu = vs;
      for (let k = 0; k < 30; k++) {
      const a = Math.atan2(G.jezero.az, G.jezero.ax) + Math.PI / 2 + r.mezi(-0.55, 0.55), dx = Math.cos(a), dz = Math.sin(a);
      const off = r.mezi(260, 650) * (r() < 0.5 ? -1 : 1);
      const Q = [V0.x - dz * off, V0.z + dx * off];
      const E1 = bodNaOkraji(Q[0], Q[1], -dx, -dz), E2 = bodNaOkraji(Q[0], Q[1], dx, dz);
      const veze = rozmistiSloupy(G, E1, E2);
      if (!veze) continue;
      let sc = -veze.length * 0.3 + r();
      const ln = [E1, E2];
      for (const st of G.stavby) { const d = vzdOdCary(ln, st.x, st.z); if (d < 60) sc -= 20; }
      if (vzdOdCary(ln, G.start.x, G.start.z) < 160) sc -= 30;
      if (G.kostel && vzdOdCary(ln, G.kostel.x, G.kostel.z) < 140) sc -= 20;
      if (!best || sc > best.sc) best = { sc, veze, E1, E2, vs };
      }
      if (best) break;
    }
    if (!best) { G.vedeni = []; return; }
    G.vyskaSloupu = best.vs;
    const v = best.veze, pruves = [];
    for (let i = 0; i < v.length - 1; i++) pruves.push(+(vzd(v[i], v[i + 1]) * 0.011).toFixed(2));
    G.vedeni = [{ vyskaSloupu: best.vs, body: v.map(p => [p[0], 0, p[1]]), pruves, draty: DRATY }];
    // průsek: bez stromů 20 m od osy, les jen jako nízký porost
    const Rz = G.raz; Rz.cara(v, 22);
    for (const i of Rz.bunky) { const d = Rz.d[i]; G.zakaz[i] |= 1; if (d < 17) G.M[i * 4] = Math.round(G.M[i * 4] * 0.2); }
    Rz.vycisti();
    for (let i = 0; i < v.length; i++) {
      const a = tecna(v, i, 1);
      pridejStavbu(G, { typ: 'stozar', x: v[i][0], z: v[i][1], uhel: uhelOsyZ(a[0], a[1]), sirka: 5, delka: 5, vyska: best.vs, strecha: 0 }, 2, false);
    }
  }
  function rozmistiSloupy(G, E1, E2) {
    const L = vzd(E1, E2), dx = (E2[0] - E1[0]) / L, dz = (E2[1] - E1[1]) / L;
    const bod = s => [E1[0] + dx * s, E1[1] + dz * s];
    const mistoOk = p => {
      if (Math.abs(p[0]) > 2040 || Math.abs(p[1]) > 2040) return false;
      if (G.dVoda[bunka(p[0], p[1])] < 10 || G.obs[bunka(p[0], p[1])]) return false;
      for (const [a, b] of [[4, 0], [-4, 0], [0, 4], [0, -4], [0, 0]]) if (G.M[bunka(p[0] + a, p[1] + b) * 4 + 2] > 0) return false;
      return sklonSt(G, p[0], p[1]) < 18;
    };
    const poleOk = (a, b) => {
      const ya = vys(G, a[0], a[1]) + G.vyskaSloupu - 2.2, yb = vys(G, b[0], b[1]) + G.vyskaSloupu - 2.2, l = vzd(a, b), pr = l * 0.011;
      const px = -(b[1] - a[1]) / l * 2.6, pz = (b[0] - a[0]) / l * 2.6;
      for (let k = 1; k < 40; k++) {
        const t = k / 40, x = lerp(a[0], b[0], t), z = lerp(a[1], b[1], t);
        const zem = Math.max(vys(G, x, z), vys(G, x + px, z + pz), vys(G, x - px, z - pz));
        if (lerp(ya, yb, t) - 4 * pr * t * (1 - t) - zem < 10.5) return false;
      }
      return true;
    };
    const out = []; let s = 4;
    while (s < L && !mistoOk(bod(s))) s += 6;
    if (s >= L) return null;
    out.push(bod(s));
    while (L - s > 4) {
      let dal = null;
      const zbyva = L - s;
      if (zbyva < 120) { const p = bod(L - 3); if (mistoOk(p) && poleOk(out[out.length - 1], p)) { out.push(p); break; } }
      for (const rozsah of [[340, 250], [249, 80]]) {
        for (let d = Math.min(rozsah[0], zbyva - 3); d >= rozsah[1]; d -= 8) {
          const p = bod(s + d); if (mistoOk(p) && poleOk(out[out.length - 1], p)) { dal = d; break; }
        }
        if (dal) break;
      }
      if (!dal) return out.length > 1 && L - s < 60 ? out : null;
      s += dal; out.push(bod(s));
    }
    return out.length >= 4 ? out : null;
  }

  // =====================================================================
  // 10. drobné stavby: posedy, seno, ohrady
  // =====================================================================
  function drobneStavby(G) {
    const r = D.Nahoda(G.seed + ':drobne'), V0 = G.ves, M = G.M;
    // posedy na okraji lesa, čelem k louce
    const posedy = [];
    for (let k = 0; k < 3000 && posedy.length < 8; k++) {
      const x = r.mezi(-1950, 1950), z = r.mezi(-1950, 1950), i = bunka(x, z);
      if (M[i * 4] > 0 || M[i * 4 + 2] > 0 || G.dVoda[i] < 25 || G.zakaz[i]) continue;
      const dV = Math.hypot(x - V0.x, z - V0.z); if (dV < 300) continue;
      if (posedy.some(p => Math.hypot(p.x - x, p.z - z) < 300)) continue;
      for (let a = 0; a < 8; a++) {
        const dx = Math.cos(a * 0.785), dz = Math.sin(a * 0.785);
        if (M[bunka(x + dx * 16, z + dz * 16) * 4] > 200 && M[bunka(x + dx * 6, z + dz * 6) * 4] < 120) {
          const px = x + dx * 4, pz = z + dz * 4;
          if (!volneMisto(G, px, pz, 0, 2.2, 2.2, 1)) break;
          posedy.push({ x: px, z: pz });
          pridejStavbu(G, { typ: 'posed', x: px, z: pz, uhel: uhelOsyZ(-dx, -dz), sirka: 2, delka: 2, vyska: 4.5, strecha: 1.2 }, 2, false);
          break;
        }
      }
    }
    // balíky sena v řadách na polích
    let skupin = 0;
    const pb = G.poleBloky;
    for (let k = 0; k < 600 && skupin < 5; k++) {
      const a = r() * TAU, rr = r.mezi(200, 1100), x = V0.x + Math.cos(a) * rr, z = V0.z + Math.sin(a) * rr, i = bunka(x, z);
      if (Math.abs(x) > 1950 || Math.abs(z) > 1950 || M[i * 4 + 1] === 0) continue;
      const b = pb.blok[i]; if (b < 0) continue;
      const sm = pb.smer[b], tx = -Math.sin(sm), tz = Math.cos(sm), n = r.cele(4, 9), krok = r.mezi(10, 15);
      let pol = 0;
      for (let q = 0; q < n; q++) {
        const bx = x + tx * krok * q + r.mezi(-1.5, 1.5), bz = z + tz * krok * q + r.mezi(-1.5, 1.5), j = bunka(bx, bz);
        if (M[j * 4 + 1] === 0 || M[j * 4 + 2] > 0 || G.zakaz[j] & 1) continue;
        pridejStavbu(G, { typ: 'seno', x: bx, z: bz, uhel: uhelOsyZ(tx, tz) + r.mezi(-0.3, 0.3), sirka: 1.5, delka: 1.25, vyska: 1.5, strecha: 0 }, 1, false);
        pol++;
      }
      if (pol) skupin++;
    }
    // ohrady (pastviny) na loukách u vesnice
    G.pastviny = [];
    for (let k = 0; k < 800 && G.pastviny.length < 3; k++) {
      const a = r() * TAU, rr = r.mezi(130, 700), x = V0.x + Math.cos(a) * rr, z = V0.z + Math.sin(a) * rr;
      const sir = r.mezi(50, 90), del = r.mezi(70, 120), u = r() * Math.PI;
      if (Math.abs(x) > 1900 || Math.abs(z) > 1900) continue;
      if (G.pastviny.some(p => Math.hypot(p.x - x, p.z - z) < 150)) continue;
      let ok = true;
      obdBunky(x, z, u, sir, del, 3, i => {
        if (!ok) return;
        if (M[i * 4] > 40 || M[i * 4 + 1] > 0 || M[i * 4 + 2] > 0 || G.dVoda[i] < 15 || G.obs[i] || (G.zakaz[i] & 3) || G.sklon[i] > 11) ok = false;
      });
      if (!ok) continue;
      G.pastviny.push({ x, z, uhel: u, sirka: sir, delka: del });
      const ax = [Math.cos(u), -Math.sin(u)], az = [Math.sin(u), Math.cos(u)];
      for (const [cx, cz, du, dl] of [[sir / 2, 0, 0, del], [-sir / 2, 0, 0, del], [0, del / 2, Math.PI / 2, sir], [0, -del / 2, Math.PI / 2, sir]]) {
        pridejStavbu(G, { typ: 'ohrada', x: x + ax[0] * cx + az[0] * cz, z: z + ax[1] * cx + az[1] * cz, uhel: u + du, sirka: 0.15, delka: dl, vyska: 1.3, strecha: 0 }, 1.5, false);
      }
    }
  }

  // =====================================================================
  // 11. stromy a kameny
  // =====================================================================
  function stromyAKameny(G) {
    const M = G.M, V = G.V, ST = STROMY(), r = D.Nahoda(G.seed + ':stromy'), seedH = D.seedZ(G.seed + ':st');
    const out = [];
    const smi = (x, z) => {
      if (Math.abs(x) > 2044 || Math.abs(z) > 2044) return false;
      const i = bunka(x, z);
      return M[i * 4 + 2] < 25 && M[i * 4 + 1] < 25 && G.dVoda[i] > 2 && !(G.zakaz[i] & 1);
    };
    const pridej = (x, z, typ, m) => { out.push(x, vys(G, x, z), z, typ, m, D.hash2(x * 7 | 0, z * 13 | 0, seedH) * TAU); };
    // vzdálenost od okraje lesa
    const nelesni = new Uint8Array(NN); for (let i = 0; i < NN; i++) if (M[i * 4] < 128) nelesni[i] = 1;
    const dOkraj = vzdalenosti(nelesni).d;
    const sSm = D.Simplex(G.seed + ':smrk'), sBu = D.Simplex(G.seed + ':buk'), sDu = D.Simplex(G.seed + ':dub'), sBo = D.Simplex(G.seed + ':bor'), sVek = D.Simplex(G.seed + ':vek');
    const rozp = G.hmax - G.hmin;
    // les: chvějící se mřížka 6.2 m
    const K = 6.2, nk = Math.floor(4096 / K);
    const w = new Float32Array(6);
    for (let gz = 0; gz < nk; gz++) for (let gx = 0; gx < nk; gx++) {
      const h1 = D.hash2(gx, gz, seedH), h2 = D.hash2(gx, gz, seedH + 1), h3 = D.hash2(gx, gz, seedH + 2);
      const x = -PUL + (gx + 0.1 + 0.8 * h1) * K, z = -PUL + (gz + 0.1 + 0.8 * h2) * K, i = bunka(x, z);
      const R = M[i * 4]; if (R < 10) continue;
      if (h3 > Math.pow(R / 255, 0.8) * 0.92) continue;
      if (!smi(x, z)) continue;
      const a = (V[i] - G.hmin) / rozp, sk = G.sklon[i], okr = 1 - smooth(0, 18, dOkraj[i]);
      w[SMRK] = (0.55 + 1.5 * smooth(0.3, 0.75, a)) * (0.35 + 1.3 * smooth(-0.25, 0.35, sSm(x / 380, z / 380)));
      w[BUK] = (1.35 - a) * (0.25 + 1.3 * smooth(-0.1, 0.45, sBu(x / 330, z / 330)));
      w[DUB] = (1 - a) * (1 - a) * 0.9 * (0.15 + smooth(0.05, 0.5, sDu(x / 300, z / 300)));
      w[BOROVICE] = (smooth(0, 30, G.hRel[i]) * 0.8 + smooth(14, 28, sk) * 0.6) * (0.2 + smooth(0, 0.5, sBo(x / 280, z / 280)));
      w[BRIZA] = 0.06 + okr * 0.9;
      w[KER] = okr * okr * 1.6;
      let sum = 0; for (let q = 0; q < 6; q++) sum += w[q];
      let v = D.hash2(gx, gz, seedH + 3) * sum, typ = 0;
      for (; typ < 5; typ++) { v -= w[typ]; if (v <= 0) break; }
      const vek = 0.82 + 0.3 * sVek(x / 160, z / 160);
      const m = typ === KER ? 0.6 + 0.7 * D.hash2(gx, gz, seedH + 4) : vek * (0.85 + 0.3 * D.hash2(gx, gz, seedH + 4)) * (1 - okr * 0.25);
      pridej(x, z, typ, +m.toFixed(3));
    }
    const lesnich = out.length / 6;
    // solitéry na loukách
    const sol = 36, ns = Math.floor(4096 / sol);
    for (let gz = 0; gz < ns; gz++) for (let gx = 0; gx < ns; gx++) {
      const x = -PUL + (gx + 0.15 + 0.7 * D.hash2(gx, gz, seedH + 10)) * sol, z = -PUL + (gz + 0.15 + 0.7 * D.hash2(gx, gz, seedH + 11)) * sol, i = bunka(x, z);
      if (M[i * 4] > 5 || M[i * 4 + 1] > 0 || !smi(x, z) || G.dObydli[i] < 15) continue;
      if (D.hash2(gx, gz, seedH + 12) > 0.045) continue;
      const h = D.hash2(gx, gz, seedH + 13), typ = h < 0.45 ? DUB : h < 0.7 ? BUK : h < 0.9 ? BRIZA : SMRK;
      pridej(x, z, typ, +(1.0 + 0.3 * D.hash2(gx, gz, seedH + 14)).toFixed(3));
    }
    // remízky a meze mezi bloky polí
    const km = 8, nm = Math.floor(4096 / km);
    for (let gz = 0; gz < nm; gz++) for (let gx = 0; gx < nm; gx++) {
      const x = -PUL + (gx + 0.5) * km + (D.hash2(gx, gz, seedH + 20) - 0.5) * 4, z = -PUL + (gz + 0.5) * km + (D.hash2(gx, gz, seedH + 21) - 0.5) * 4, i = bunka(x, z);
      if (!G.mez[i] || M[i * 4] > 5) continue;
      const blizkoPole = M[bunka(x + 8, z) * 4 + 1] || M[bunka(x - 8, z) * 4 + 1] || M[bunka(x, z + 8) * 4 + 1] || M[bunka(x, z - 8) * 4 + 1];
      if (!blizkoPole || D.hash2(gx, gz, seedH + 22) > 0.33 || !smi(x, z)) continue;
      const h = D.hash2(gx, gz, seedH + 23);
      if (h < 0.62) pridej(x, z, KER, +(0.8 + 0.6 * h).toFixed(3));
      else pridej(x, z, h < 0.8 ? DUB : h < 0.9 ? BRIZA : BUK, +(0.65 + 0.4 * (h - 0.6)).toFixed(3));
    }
    // aleje podél silnice mimo vesnici
    G.aleje = [];
    for (const c of G.cestyD) {
      if (c.typ !== 'silnice' || c.ulice) continue;
      const b = c.body, typ = r() < 0.6 ? DUB : BUK; let run = [];
      for (let i = 0; i < b.length; i += 3) {
        const p = b[i], dV = Math.hypot(p[0] - G.ves.x, p[1] - G.ves.z);
        const ok = dV > 380 && M[bunka(p[0], p[1]) * 4] < 60 && (!c.naMoste || Math.hypot(p[0] - G.most.x, p[1] - G.most.z) > 90);
        if (ok) run.push(i);
        if ((!ok || i + 3 >= b.length) && run.length) {
          if (run.length > 30 && G.aleje.length < 3) {
            for (const k of run) {
              const t = tecna(b, k, 2);
              for (const sg of [1, -1]) {
                const x = b[k][0] - t[1] * sg * 7, z = b[k][1] + t[0] * sg * 7;
                if (D.hash2(k, sg, seedH + 30) < 0.12 || !smi(x, z)) continue;
                pridej(x, z, typ, +(0.72 + 0.2 * D.hash2(k, sg, seedH + 31)).toFixed(3));
              }
            }
            const mid = b[run[run.length >> 1]];
            G.aleje.push({ x: mid[0], z: mid[1], typ });
          }
          run = [];
        }
      }
    }
    // břehové porosty (olše, vrby → buk, bříza, keř)
    for (const rk of G.reky) {
      const b = rk.body;
      for (let i = 0; i < b.length; i += 2) {
        const t = tecna(b, i, 2);
        for (const sg of [1, -1]) {
          if (D.hash2(i, sg, seedH + 40) > 0.55) continue;
          const off = rk.sir[i] / 2 + 4.5 + 7 * D.hash2(i, sg, seedH + 41);
          const x = b[i][0] - t[1] * sg * off, z = b[i][1] + t[0] * sg * off;
          if (G.most && Math.hypot(x - G.most.x, z - G.most.z) < 30) continue;
          if (!smi(x, z) || M[bunka(x, z) * 4] > 150) continue;
          const h = D.hash2(i, sg, seedH + 42);
          if (h < 0.35) pridej(x, z, KER, +(0.8 + 0.6 * h).toFixed(3));
          else pridej(x, z, h < 0.75 ? BUK : BRIZA, +(0.5 + 0.3 * h).toFixed(3));
        }
      }
    }
    // břeh jezera a duby na hrázi rybníka
    {
      const j = G.jezero;
      for (let k = 0; k < 900; k++) {
        const a = k / 900 * TAU, h = D.hash2(k, 1, seedH + 50); if (h > 0.4) continue;
        let x = 0, z = 0, nasel = false;
        for (let rr = j.R * 0.7; rr < j.R * 2.6; rr += 4) {
          x = j.x + Math.cos(a) * rr; z = j.z + Math.sin(a) * rr;
          if (G.dVoda[bunka(x, z)] > 4 + 10 * h) { nasel = true; break; }
        }
        if (nasel && smi(x, z) && M[bunka(x, z) * 4] < 150) pridej(x, z, h < 0.15 ? KER : h < 0.3 ? BUK : BRIZA, +(0.55 + h).toFixed(3));
      }
    }
    if (G.rybnik) {
      const hz = G.rybnik.hraz, L = vzd(hz[0], hz[1]);
      for (let s = 6; s < L - 6; s += 11) {
        const t = s / L, x = lerp(hz[0][0], hz[1][0], t) + G.rybnik.g[0] * 4.5, z = lerp(hz[0][1], hz[1][1], t) + G.rybnik.g[1] * 4.5;
        if (smi(x, z)) pridej(x, z, DUB, +(0.8 + 0.25 * D.hash2(s | 0, 3, seedH + 60)).toFixed(3));
      }
    }
    // ovocné stromky v zahradách
    for (const zh of G.zahrady) {                 // kolem domu, na straně od silnice
      const n = r.cele(2, 4); let k = 0;
      for (let pokus = 0; pokus < 14 && k < n; pokus++) {
        const a = r.mezi(-15, 15), b = r.mezi(4, 24), x = zh.x + zh.tx * a + zh.nx * b, z = zh.z + zh.tz * a + zh.nz * b;
        if (Math.abs(a) < 8 && b < 12) continue;
        const i = bunka(x, z);
        if (Math.abs(x) > 2040 || Math.abs(z) > 2040 || M[i * 4 + 2] > 0 || M[i * 4 + 1] > 0 || G.obs[i] || G.dVoda[i] < 4) continue;
        let blizko = false;
        for (const s of G.stavby) if (Math.abs(s.x - x) < 30 && Math.abs(s.z - z) < 30 && vPudorysu(s, x, z, 2.5)) { blizko = true; break; }
        if (blizko) continue;
        pridej(x, z, r() < 0.7 ? BUK : DUB, +r.mezi(0.3, 0.42).toFixed(3)); k++;
      }
    }
    // pojistka: nic v půdorysu stavby ani pod hladinou
    {
      const mriz = new Map(), kl = (x, z) => Math.floor(x / 64) + ':' + Math.floor(z / 64);
      for (const s of G.stavby) { const k = kl(s.x, s.z); if (!mriz.has(k)) mriz.set(k, []); mriz.get(k).push(s); }
      const o = [];
      for (let j = 0; j < out.length; j += 6) {
        const x = out[j], z = out[j + 2];
        if (hladinaBil(G.W, x, z) > vys(G, x, z) - 0.3) continue;
        let spatne = false;
        for (let a = -1; a <= 1 && !spatne; a++) for (let b = -1; b <= 1 && !spatne; b++) {
          const l = mriz.get(kl(x + a * 64, z + b * 64)); if (l) for (const s of l) if (s.typ !== 'pristavani' && vPudorysu(s, x, z, 1)) { spatne = true; break; }
        }
        if (!spatne) for (let q = 0; q < 6; q++) o.push(out[j + q]);
      }
      out.length = 0; for (const v of o) out.push(v);
    }
    G.stromy = out;
    G.pocetLesnich = lesnich;

    // kameny
    const ka = [], kk = 10, nkk = Math.floor(4096 / kk);
    for (let gz = 0; gz < nkk; gz++) for (let gx = 0; gx < nkk; gx++) {
      const x = -PUL + (gx + D.hash2(gx, gz, seedH + 70)) * kk, z = -PUL + (gz + D.hash2(gx, gz, seedH + 71)) * kk, i = bunka(x, z);
      const sk = G.sklon[i], h = D.hash2(gx, gz, seedH + 72);
      let p = 0;
      if (sk > 22) p = 0.3; else if (G.hRel[i] > 25 && sk > 11) p = 0.07;
      const tk = G.tok2[(i / N / 2 | 0) * N2 + ((i % N) >> 1)];
      if (tk > 300 && sk > 5 && G.dVoda[i] > 3) p = Math.max(p, 0.12);
      if (G.dVoda[i] < 9 && G.dVoda[i] > 2.5 && sk > 6) p = Math.max(p, 0.05);
      if (h > p || M[i * 4 + 2] > 0 || M[i * 4 + 1] > 0 || (G.zakaz[i] & 1) || G.dVoda[i] < 2.5) continue;
      ka.push(x, vys(G, x, z), z, +(0.4 + 1.6 * Math.pow(D.hash2(gx, gz, seedH + 73), 2)).toFixed(3), D.hash2(gx, gz, seedH + 74) * TAU);
    }
    G.kameny = ka;
  }

  // =====================================================================
  // 12. závodní tratě
  // =====================================================================
  function MrizkaStromu(st) {
    this.st = st; this.K = 16; this.n = Math.ceil(4096 / 16);
    const n = this.n, cnt = new Int32Array(n * n + 1), k = st.length / 6;
    const ci = j => clamp(Math.floor((st[j * 6 + 2] + PUL) / 16), 0, n - 1) * n + clamp(Math.floor((st[j * 6] + PUL) / 16), 0, n - 1);
    for (let j = 0; j < k; j++) cnt[ci(j) + 1]++;
    for (let i = 0; i < n * n; i++) cnt[i + 1] += cnt[i];
    const idx = new Int32Array(k), pos = cnt.slice(0, n * n);
    for (let j = 0; j < k; j++) idx[pos[ci(j)]++] = j;
    this.od = cnt; this.idx = idx;
  }
  MrizkaStromu.prototype.kolem = function (x, z, r, f) {
    const n = this.n, K = this.K;
    const x0 = clamp(Math.floor((x - r + PUL) / K), 0, n - 1), x1 = clamp(Math.floor((x + r + PUL) / K), 0, n - 1);
    const z0 = clamp(Math.floor((z - r + PUL) / K), 0, n - 1), z1 = clamp(Math.floor((z + r + PUL) / K), 0, n - 1);
    for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) {
      const c = gz * n + gx; for (let q = this.od[c]; q < this.od[c + 1]; q++) f(this.idx[q]);
    }
  };
  // poloměr překážky stromu ve výšce hy nad patou
  function polomerStromu(ST, typ, m, hy) {
    const s = ST[typ | 0]; if (!s) return 0;
    if (hy > s.vyska * m || hy < -0.5) return 0;
    if (hy < s.korunaOd * m) return Math.max(0.15, s.kmenR * m);
    return s.korunaR * m;
  }
  function vPudorysu(st, x, z, rez) {
    const c = Math.cos(st.uhel || 0), s = Math.sin(st.uhel || 0), dx = x - st.x, dz = z - st.z;
    return Math.abs(dx * c - dz * s) <= st.sirka / 2 + rez && Math.abs(dx * s + dz * c) <= st.delka / 2 + rez;
  }
  // překáží stavba bodu (x, y, z) s rezervou? (vrátí true)
  function stavbaVBode(st, x, y, z, rez) {
    if (st.typ === 'pristavani') return false;
    const c = Math.cos(st.uhel), s = Math.sin(st.uhel), dx = x - st.x, dz = z - st.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    if (Math.abs(lx) > st.sirka / 2 + rez || Math.abs(lz) > st.delka / 2 + rez) return false;
    let y0 = st.y, y1 = st.y + st.vyska + (st.strecha || 0);
    if (st.typ === 'most') { y0 = st.y - 0.9; y1 = st.y + 1.2; }
    return y >= y0 - rez && y <= y1 + rez;
  }

  // ověří trať: vrátí { ok, stromy: Set indexů k vykácení, duvod }
  function overTrat(G, branky, mriz, rez) {
    const ST = STROMY(), st = G.stromy, kaceni = new Set();
    const stavby = G.stavby.filter(s => s.typ !== 'pristavani');
    const bodVolny = (x, y, z, r0) => {
      for (const s of stavby) if (Math.abs(s.x - x) < 40 && Math.abs(s.z - z) < 40 && stavbaVBode(s, x, y, z, r0)) return 'stavba ' + s.typ;
      return null;
    };
    const stromyKolem = (x, y, z, r0) => {
      mriz.kolem(x, z, r0 + 9, j => {
        const tx = st[j * 6], ty = st[j * 6 + 1], tz = st[j * 6 + 2];
        const R = polomerStromu(ST, st[j * 6 + 3], st[j * 6 + 4], y - ty);
        if (R > 0 && Math.hypot(tx - x, tz - z) < R + r0) kaceni.add(j);
      });
    };
    const DOLE = (D.BRANKA && D.BRANKA.dole != null) ? D.BRANKA.dole : 0.3;   // otvor od y + DOLE do y + DOLE + vyska
    // nálet na první branku: start závodu 22 m před ní (proti směru průletu) → volno od stromů a staveb
    {
      const b = branky[0], sx = b.x + Math.sin(b.uhel) * 22, sz = b.z + Math.cos(b.uhel) * 22;
      const yc = b.y + DOLE + b.vyska / 2;
      for (let s = 0; s <= 22; s += 1) {
        const t = s / 22, x = lerp(sx, b.x, t), z = lerp(sz, b.z, t), zem = Math.max(vys(G, x, z), hladinaBil(G.W, x, z));
        for (let y = zem + 0.5; y <= Math.max(yc, zem + 0.5) + 0.01; y += 1) {
          const dv = bodVolny(x, y, z, rez); if (dv) return { ok: false, duvod: 'nálet: ' + dv };
          stromyKolem(x, y, z, rez);
        }
      }
    }
    for (let k = 0; k < branky.length; k++) {
      const b = branky[k], ax = Math.cos(b.uhel), az = -Math.sin(b.uhel);
      for (let a = -b.sirka / 2 - 0.3; a <= b.sirka / 2 + 0.31; a += 0.75) for (let h = DOLE; h <= DOLE + b.vyska + 0.01; h += b.vyska / 4) {
        const x = b.x + ax * a, z = b.z + az * a, y = b.y + h;
        const dv = bodVolny(x, y, z, rez); if (dv) return { ok: false, duvod: 'branka ' + k + ': ' + dv };
        stromyKolem(x, y, z, rez);
      }
      if (k === branky.length - 1) break;
      const c = branky[k + 1], ya = b.y + DOLE + b.vyska / 2, yb = c.y + DOLE + c.vyska / 2, L = Math.hypot(c.x - b.x, c.z - b.z);
      // přímka mezi středy branek; kde překáží terén, smí se letět obloukem nahoru (nejvýš 4 m)
      let A = 0;
      for (let s = 1; s < L; s += 1) {
        const t = s / L, x = lerp(b.x, c.x, t), z = lerp(b.z, c.z, t), y = lerp(ya, yb, t);
        const zem = Math.max(vys(G, x, z), hladinaBil(G.W, x, z)), sn = Math.sin(Math.PI * t);
        const pot = zem + 0.8 - y; if (pot > 0) A = Math.max(A, pot / Math.max(sn, 0.05));
      }
      if (A > 4) return { ok: false, duvod: 'úsek ' + k + ': terén' };
      b.oblouk = +A.toFixed(2);
      for (let s = 0; s <= L; s += 1) {
        const t = s / L, x = lerp(b.x, c.x, t), z = lerp(b.z, c.z, t), y0 = lerp(ya, yb, t), y1 = y0 + A * Math.sin(Math.PI * t);
        for (let y = y0; y <= y1 + 0.01; y += Math.max(0.8, y1 - y0 + 0.01)) {
          const dv = bodVolny(x, y, z, rez); if (dv) return { ok: false, duvod: 'úsek ' + k + ': ' + dv };
          stromyKolem(x, y, z, rez);
        }
      }
      // ostrost zatáčky
      if (k > 0) {
        const p = branky[k - 1], v1 = [b.x - p.x, b.z - p.z], v2 = [c.x - b.x, c.z - b.z];
        const cs = (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2));
        if (cs < Math.cos(100 * Math.PI / 180)) return { ok: false, duvod: 'ostrá zatáčka u ' + k };
      }
    }
    return { ok: true, stromy: kaceni };
  }
  function brankyZBodu(G, body, sirka, vyska, okruh) {
    const n = body.length;
    return body.map((p, k) => {
      let a = body[Math.max(0, k - 1)], c = body[Math.min(n - 1, k + 1)];
      if (okruh) { a = body[(k - 1 + n - 1) % (n - 1)]; c = body[(k + 1) % (n - 1)]; }
      const hTer = vys(G, p[0], p[1]), w = hladinaBil(G.W, p[0], p[1]), naVode = w > hTer;
      const b = { x: +p[0].toFixed(2), y: +(naVode ? w : hTer).toFixed(2), z: +p[1].toFixed(2), uhel: +kurzSmeru(c[0] - a[0], c[1] - a[1]).toFixed(4), sirka, vyska };
      if (naVode) b.naVode = true;
      return b;
    });
  }
  function zavodniTrate(G) {
    const r = D.Nahoda(G.seed + ':trate'), trate = [], mriz = new MrizkaStromu(G.stromy), rez = 1.5;
    const kaceni = new Set();
    const zkus = (jmeno, body, sirka, vyska, okruh) => {
      const br = brankyZBodu(G, okruh ? body.concat([body[0]]) : body, sirka, vyska, okruh);
      for (const b of br) if (Math.abs(b.x) > 2030 || Math.abs(b.z) > 2030) return false;
      const v = overTrat(G, br, mriz, rez);
      if (!v.ok) { G.ladeni[jmeno] = (G.ladeni[jmeno] || 0) + 1; G.ladeni[jmeno + ':' + v.duvod.replace(/[0-9]+/g, '#')] = (G.ladeni[jmeno + ':' + v.duvod.replace(/[0-9]+/g, '#')] || 0) + 1; return false; }
      for (const j of v.stromy) kaceni.add(j);
      if (okruh) br.pop();
      trate.push(okruh ? { jmeno, branky: br, okruh: true } : { jmeno, branky: br });
      return true;
    };
    // „Řeka“: po řece pod mostem
    if (G.most) {
      const rk = G.reky.find(q => q.jmeno === G.most.reka), b = rk.body;
      const kum = [0]; for (let i = 1; i < b.length; i++) kum.push(kum[i - 1] + vzd(b[i], b[i - 1]));
      const sB = kum[G.most.i];
      let hotovo = false;
      for (const posun of [0, 48, -48, 96, -96, 144, -144]) for (const krok of [32, 27]) {
        if (hotovo) break;
        const body = [];
        for (let k = -6; k <= 6; k++) {
          const s = sB + posun + k * krok; if (s < 30 || s > kum[kum.length - 1] - 30) { body.length = 0; break; }
          let i = 0; while (i < b.length - 1 && kum[i + 1] < s) i++;
          const t = tecna(b, i, 2), off = Math.abs(s - sB) < krok / 2 ? 0 : (k % 2 ? 2.2 : -2.2) * Math.min(1, rk.sir[i] / 13);
          body.push([b[i][0] - t[1] * off, b[i][1] + t[0] * off]);
        }
        if (body.length !== 13) continue;
        if (body.some(p => G.W[bunka(p[0], p[1])] <= BEZ_VODY || vJezere(G, p[0], p[1]) < 1.05)) continue;
        hotovo = zkus('Řeka', body, 3, 2.5);
      }
    }
    // „Les“: slalom po okraji lesa (sleduje vrstevnici rozmazané masky lesa R = 128)
    {
      const Rb = new Float32Array(NN); for (let i = 0; i < NN; i++) Rb[i] = G.M[i * 4];
      const Rm = rozmaz(Rb, N, 10), val = (x, z) => bil(Rm, N, KROK, -PUL, x, z);
      const kand = [];
      for (let iz = 40; iz < N - 40; iz += 6) for (let ix = 40; ix < N - 40; ix += 6) {
        const i = iz * N + ix, v = Rm[i]; if (v < 100 || v > 156) continue;
        const x = -PUL + ix * KROK, z = -PUL + iz * KROK, ds = Math.hypot(x - G.start.x, z - G.start.z);
        if (ds < 200 || ds > 1700 || Math.hypot(x - G.ves.x, z - G.ves.z) < 260 || G.dVoda[i] < 20 || G.sklon[i] > 16) continue;
        kand.push([x, z, ds]);
      }
      for (let i = kand.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = kand[i]; kand[i] = kand[j]; kand[j] = t; }
      const stopa = (x, z, sm) => {                  // jedním směrem podél okraje
        const out = []; let px = 0, pz = 0;
        for (let s = 0; s < 420; s += 5) {
          const e = 6, gx = (val(x + e, z) - val(x - e, z)) / (2 * e), gz = (val(x, z + e) - val(x, z - e)) / (2 * e), gl = Math.hypot(gx, gz);
          if (gl < 0.3) break;
          let tx = -gz / gl * sm, tz = gx / gl * sm; if (s && tx * px + tz * pz < 0) { tx = -tx; tz = -tz; }
          px = tx; pz = tz; x += tx * 5; z += tz * 5;
          const v = val(x, z), k2 = clamp((128 - v) / gl, -3, 3); x += gx / gl * k2; z += gz / gl * k2;
          const i = bunka(x, z);
          if (Math.abs(x) > 1950 || Math.abs(z) > 1950 || G.dVoda[i] < 15 || G.obs[i] || G.sklon[i] > 24) break;
          out.push([x, z]);
        }
        return out;
      };
      let hotovo = false;
      for (let pokus = 0; pokus < Math.min(70, kand.length) && !hotovo; pokus++) {
        const [x, z] = kand[pokus];
        const cesta = stopa(x, z, -1).reverse().concat([[x, z]], stopa(x, z, 1));
        if (cesta.length < 100) { G.ladeni.lesKratka = (G.ladeni.lesKratka || 0) + 1; continue; }
        const hl = prevzorkuj(chaikin(cesta, 3), 4), kum = [0];
        for (let i = 1; i < hl.length; i++) kum.push(kum[i - 1] + vzd(hl[i], hl[i - 1]));
        const L = kum[kum.length - 1]; if (L < 560) continue;
        for (const s0 of [(L - 528) / 2, 20, L - 548]) {
          if (hotovo) break;
          const body = [];
          for (let k = 0; k < 13; k++) {
            const s = s0 + k * 44; let i = 0; while (i < hl.length - 1 && kum[i + 1] < s) i++;
            const t = tecna(hl, i, 4), off = k % 2 ? 4 : -4;
            body.push([hl[i][0] - t[1] * off, hl[i][1] + t[0] * off]);
          }
          hotovo = zkus('Les', body, 3, 2.5);
        }
      }
    }
    // „Kostel“: okruh kolem kostela
    if (G.kostel) {
      let hotovo = false;
      for (let pokus = 0; pokus < 80 && !hotovo; pokus++) {
        const a = r.mezi(52, 82), b = r.mezi(44, 72), rot = r() * TAU, n = 12, sm = r() < 0.5 ? 1 : -1;
        const cx = G.kostel.x + r.mezi(-8, 8), cz = G.kostel.z + r.mezi(-8, 8);
        const body = [];
        for (let k = 0; k <= n; k++) {
          const t = sm * k / n * TAU, w = 1 + (k % 2 ? 0.08 : -0.08);
          const ex = Math.cos(t) * a * w, ez = Math.sin(t) * b * w;
          body.push([cx + ex * Math.cos(rot) - ez * Math.sin(rot), cz + ex * Math.sin(rot) + ez * Math.cos(rot)]);
        }
        body.pop();                                   // uzavřený okruh: 12 branek, za poslední se letí k první
        if (body.some(p => G.W[bunka(p[0], p[1])] > BEZ_VODY)) continue;
        hotovo = zkus('Kostel', body, 3, 2.5, true);
      }
    }
    // vykácet stromy v trasách
    if (kaceni.size) {
      const st = G.stromy, o = [];
      for (let j = 0; j < st.length / 6; j++) if (!kaceni.has(j)) for (let q = 0; q < 6; q++) o.push(st[j * 6 + q]);
      G.stromy = o;
    }
    G.kacenoProTrate = kaceni.size;
    // pořadí: Les, Kostel, Řeka
    const por = { 'Les': 0, 'Kostel': 1, 'Řeka': 2 };
    trate.sort((a, b) => por[a.jmeno] - por[b.jmeno]);
    G.trate = trate;
  }

  // =====================================================================
  // 13. cíle fotomisí
  // =====================================================================
  function cileMisi(G) {
    const c = [], pridej = (id, jmeno, typ, x, z, y) => c.push({ id, jmeno, typ, x: +x.toFixed(1), y: +(y != null ? y : vys(G, x, z)).toFixed(1), z: +z.toFixed(1) });
    const st = typ => G.stavby.find(s => s.typ === typ);
    const k = st('kostel'); if (k) pridej('kostel', 'Kostel', 'kostel', k.x, k.z);
    const ro = st('rozhledna'); if (ro) pridej('rozhledna', 'Rozhledna', 'rozhledna', ro.x, ro.z);
    if (G.most) pridej('most', 'Most přes řeku', 'most', G.most.x, G.most.z, G.most.y);
    pridej('jezero', 'Jezero', 'jezero', G.jezero.x, G.jezero.z, G.L);
    if (G.rybnik) {
      pridej('rybnik', 'Rybník', 'rybnik', G.rybnik.x, G.rybnik.z, G.rybnik.L);
      const h = G.rybnik.hraz; pridej('hraz', 'Hráz rybníka', 'hraz', (h[0][0] + h[1][0]) / 2, (h[0][1] + h[1][1]) / 2);
    }
    if (G.vrchDruhy) pridej('vrchol', 'Vrchol', 'vrchol', G.vrchDruhy.x, G.vrchDruhy.z);
    pridej('vesnice', 'Náves', 'vesnice', G.ves.x, G.ves.z);
    if (G.aleje && G.aleje[0]) pridej('alej', 'Alej', 'alej', G.aleje[0].x, G.aleje[0].z);
    const ka = st('kaple'); if (ka) pridej('kaple', 'Kaple', 'kaple', ka.x, ka.z);
    const h = G.reky[0]; pridej('pramen', 'Pramen řeky', 'pramen', h.body[0][0], h.body[0][1]);
    // největší stupeň na řece → peřej / jez
    let best = null;
    for (const rk of G.reky) for (let i = 0; i + 3 < rk.hl.length; i++) {
      const d = rk.hl[i] - rk.hl[i + 3]; if (d > 0.8 && (!best || d > best.d)) best = { d, x: rk.body[i][0], z: rk.body[i][1], s: rk.hl[i + 3] };
    }
    if (best) pridej('perej', 'Peřej', 'perej', best.x, best.z, best.s);
    const p = G.pastviny && G.pastviny[0]; if (p && c.length < 12) pridej('pastvina', 'Pastvina', 'pastvina', p.x, p.z);
    return c.slice(0, 12);
  }

  // =====================================================================
  // hlavní funkce
  // =====================================================================
  function generujTeren(seed, mapa, prubeh) {
    if (seed == null || seed === '') seed = 'udoli';
    if (!MAPY[mapa]) mapa = 'udoli';
    let posledni = null;
    for (let pokus = 0; pokus < 4; pokus++) {
      try { return generujJednou(seed, mapa, prubeh, pokus); }
      catch (e) { posledni = e; if (typeof console !== 'undefined') console.warn('teren: pokus ' + pokus + ' selhal: ' + e.message); }
    }
    throw posledni;
  }

  function generujJednou(seed, mapa, prubeh, pokus) {
    const t0 = Date.now(), casy = {}; let tt = t0;
    const mer = jm => { const t = Date.now(); casy[jm] = t - tt; tt = t; };
    const hl = p => { if (prubeh) try { prubeh(p); } catch (e) { /* nic */ } };
    const G = {
      seed: String(seed) + '/' + mapa + (pokus ? '#' + pokus : ''), mapa, P: MAPY[mapa],
      W: new Float32Array(NN).fill(BEZ_VODY), M: new Uint8Array(NN * 4), zakaz: new Uint8Array(NN),
      jez: new Uint8Array(NN), obs: new Uint8Array(NN), stavby: [], zahrady: [], raz: new Razitko(),
      sitNG: new Uint8Array(NG * NG), ladeni: {},
    };
    makro(G); hl(0.06); mer('makro');
    eroze(G, Math.round(N2 * N2 * 0.6)); vyhladRoviny(G); hl(0.3); mer('eroze');
    tok(G); naJemnou(G); hl(0.38); mer('jemna');

    // jezero
    const j = G.jezero;
    { let a = 0, k = 0; for (let q = 0; q < 40; q++) { const t = q * 2.4, rr = j.R * 0.35 * Math.sqrt(q / 40); a += vys(G, j.x + Math.cos(t) * rr, j.z + Math.sin(t) * rr); k++; } G.L = +(a / k + 1.0).toFixed(2); }
    nadrz(G, { x: j.x, z: j.z, R: j.R, natah: j.natah, ax: j.ax, az: j.az, L: G.L, hloubka: G.P.hloubka, tvarSum: G.P.tvarSum, typ: 1, brehIn: 25, brehOut: 120 });
    reka(G); hl(0.46); mer('voda');
    vesnice(G); rybnik(G); silnice(G); vrcholy(G); polniCesty(G); srovnejCesty(G); hl(0.55); mer('cesty');
    stavbyVesnice(G); startovniPlocha(G);
    // druhé srovnání pod stavbami (sousední přechody je mohly pokřivit)
    for (const s of G.stavby) if (s._srovnat) srovnejObd(G, s.x, s.z, s.uhel, s.sirka, s.delka, 2.5, 0);
    if (G.kostel) srovnejObd(G, G.kostel.x, G.kostel.z, G.kostel.uhel, 14, 38, 3, 0, G.kostel.h0);
    hl(0.62); mer('stavby');

    odvozenaPole(G); maskaPole(G); maskaLes(G); maskaVlhkost(G); hl(0.72); mer('masky');
    vedeni(G); drobneStavby(G); mer('vedeni');
    stromyAKameny(G); hl(0.88); mer('stromy');
    // y staveb, vedení
    for (const s of G.stavby) {
      if (s.typ !== 'most') s.y = +vys(G, s.x, s.z).toFixed(2);
      for (const k of ['x', 'z', 'sirka', 'delka', 'vyska', 'strecha']) s[k] = +(+s[k]).toFixed(2);
      s.uhel = +s.uhel.toFixed(4); delete s._srovnat;
    }
    for (const v of G.vedeni) for (const p of v.body) p[1] = +vys(G, p[0], p[2]).toFixed(2);
    zavodniTrate(G); hl(0.95); mer('trate');

    // neúplný výsledek → zkusit znovu s jinými vnitřními volbami (nejvýš 2×)
    if (pokus < 2 && (G.trate.length < 2 || !G.vedeni.length || G.pocetDomu < 15)) throw new Error('neúplná krajina (tratě ' + G.trate.length + ', vedení ' + G.vedeni.length + ', domy ' + G.pocetDomu + ')');
    const st = G.start;
    G.stavby.push({ typ: 'pristavani', x: +st.x.toFixed(2), y: +st.h0.toFixed(2), z: +st.z.toFixed(2), uhel: +st.smer.toFixed(4), sirka: 4, delka: 4, vyska: 0.15, strecha: 0 });
    const cesty = G.cestyD.map(c => ({ typ: c.typ, sirka: c.sirka, body: c.body.map(p => [+p[0].toFixed(1), +p[1].toFixed(1)]) }));
    const cile = cileMisi(G);
    const vodstvo = {
      reky: G.reky.map(rk => ({ jmeno: rk.jmeno === 'horni' ? 'Horní tok' : 'Dolní tok', body: rk.body.map((p, i) => [+p[0].toFixed(1), +rk.hl[i].toFixed(2), +p[1].toFixed(1), +rk.sir[i].toFixed(1)]) })),
      jezera: [{ typ: 'jezero', jmeno: 'Jezero', x: +j.x.toFixed(1), z: +j.z.toFixed(1), r: +(j.R * j.natah).toFixed(1), hladina: G.L }],
    };
    if (G.rybnik) vodstvo.jezera.push({ typ: 'rybnik', jmeno: 'Rybník', x: +G.rybnik.x.toFixed(1), z: +G.rybnik.z.toFixed(1), r: +G.rybnik.R.toFixed(1), hladina: +G.rybnik.L.toFixed(2), hraz: G.rybnik.hraz.map(p => [+p[0].toFixed(1), +p[1].toFixed(1)]) });
    const stromy = new Float32Array(G.stromy), kameny = new Float32Array(G.kameny);
    casy.celkem = Date.now() - t0;
    const pocty = { stromy: stromy.length / 6, lesni: G.pocetLesnich, kameny: kameny.length / 5, stavby: G.stavby.length, domy: G.pocetDomu, trate: G.trate.length, cile: cile.length, kaceno: G.kacenoProTrate, pokus };
    hl(1);
    return {
      seed, mapa, velikost: VELIKOST, n: N, krok: KROK, vysky: G.V, maska: G.M, voda: G.W,
      objekty: { stromy, kameny }, stavby: G.stavby, cesty, vedeni: G.vedeni, trate: G.trate, cile,
      start: { x: +st.x.toFixed(2), y: +st.h0.toFixed(2), z: +st.z.toFixed(2), smer: +st.smer.toFixed(4) },
      vodstvo, vesnice: { jmeno: 'Vesnice', x: +G.ves.x.toFixed(1), z: +G.ves.z.toFixed(1), r: 330 }, pastviny: G.pastviny,
      info: { casMs: casy.celkem, casy, pocty, ladeni: G.ladeni },
    };
  }

  // =====================================================================
  // Doplní k datům metody. Funguje i na datech poslaných z Workeru.
  // =====================================================================
  function terenZDat(data) {
    const n = data.n, krok = data.krok, pul = data.velikost / 2, V = data.vysky, M = data.maska, W = data.voda;
    function bl(pole, x, z) {
      let fx = (x + pul) / krok, fz = (z + pul) / krok;
      fx = fx < 0 ? 0 : fx > n - 1.001 ? n - 1.001 : fx; fz = fz < 0 ? 0 : fz > n - 1.001 ? n - 1.001 : fz;
      const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * n + ix;
      const a = pole[i], b = pole[i + 1], c = pole[i + n], d = pole[i + n + 1];
      return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
    }
    const t = Object.assign({}, data);
    t.maskaData = data.maska;                                      // surové pole (metoda maska ho zakryje)
    t.vyska = (x, z) => bl(V, x, z);
    t.normala = (x, z, out) => {
      const e = krok, hx = bl(V, x + e, z) - bl(V, x - e, z), hz = bl(V, x, z + e) - bl(V, x, z - e);
      const l = Math.hypot(hx, 2 * e, hz); out = out || [0, 0, 0];
      out[0] = -hx / l; out[1] = 2 * e / l; out[2] = -hz / l; return out;
    };
    const nTmp = [0, 0, 0];
    t.sklon = (x, z) => Math.acos(Math.min(1, t.normala(x, z, nTmp)[1]));     // radiány
    // výška hladiny (bilineárně z buněk s vodou), nebo −Infinity
    t.hladina = (x, z) => {
      let fx = (x + pul) / krok, fz = (z + pul) / krok;
      if (fx < -0.5 || fz < -0.5 || fx > n - 0.5 || fz > n - 0.5) return -Infinity;
      fx = fx < 0 ? 0 : fx > n - 1.001 ? n - 1.001 : fx; fz = fz < 0 ? 0 : fz > n - 1.001 ? n - 1.001 : fz;
      const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * n + ix;
      const h = [W[i], W[i + 1], W[i + n], W[i + n + 1]], w = [(1 - tx) * (1 - tz), tx * (1 - tz), (1 - tx) * tz, tx * tz];
      let sw = 0, sh = 0;
      for (let k = 0; k < 4; k++) if (h[k] > -9999) { sw += w[k]; sh += w[k] * h[k]; }
      return sw >= 0.5 ? sh / sw : -Infinity;
    };
    t.maska = (x, z, out) => {                                     // [les, pole, cesta, vlhkost] 0..255
      out = out || [0, 0, 0, 0];
      const fx = Math.max(0, Math.min(n - 1, Math.round((x + pul) / krok))), fz = Math.max(0, Math.min(n - 1, Math.round((z + pul) / krok)));
      const i = (fz * n + fx) * 4; out[0] = M[i]; out[1] = M[i + 1]; out[2] = M[i + 2]; out[3] = M[i + 3]; return out;
    };
    t.vMape = (x, z) => Math.abs(x) <= pul && Math.abs(z) <= pul;
    // navíc: výška povrchu (terén nebo hladina, co je výš)
    t.povrch = (x, z) => Math.max(bl(V, x, z), t.hladina(x, z));
    // navíc: stromy v okolí — f(index) pro každý strom do vzdálenosti r (index do objekty.stromy / 6)
    let mriz = null;
    t.stromyBlizko = (x, z, r, f) => {
      if (!mriz) mriz = new MrizkaStromu(data.objekty.stromy);
      const st = data.objekty.stromy;
      mriz.kolem(x, z, r, j => { if (Math.hypot(st[j * 6] - x, st[j * 6 + 2] - z) <= r) f(j); });
    };
    // navíc: poloměr překážky stromu j ve výšce y (0 = v té výšce nepřekáží)
    t.polomerStromu = (j, y) => { const st = data.objekty.stromy; return polomerStromu(STROMY(), st[j * 6 + 3], st[j * 6 + 4], y - st[j * 6 + 1]); };
    return t;
  }

  D.TEREN = { VELIKOST, N, KROK, BEZ_VODY, MAPY: Object.keys(MAPY), VYSKA_SLOUPU };
  D.TEREN._vnitrek = { makro, eroze, tok, naJemnou, MAPY };   // jen pro ladění a testy
  D.generujTeren = generujTeren;
  D.terenZDat = terenZDat;
  D.stavbaVBode = stavbaVBode;
  D.polomerStromu = (typ, m, hy) => polomerStromu(STROMY(), typ, m, hy);
})(globalThis.DRON = globalThis.DRON || {});

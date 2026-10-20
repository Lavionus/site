/* Modelář 3D – text (nebo jiný 2D obrys) nalepený na libovolnou plochu tělesa jako samolepka
   (bez DOM, jde v node). Plocha = síť tělesa ve světě (i zaoblení, koule, skupiny s dírami, importy).
   1) Mřížka na povrchu: od bodu kliknutí se po krocích h jde po povrchu podél směru textu (účaří)
      a z každého bodu účaří kolmo nahoru a dolů – vzdálenosti po povrchu se zachovají, takže se text
      kolem válce nebo zaoblení ovine bez natažení. Krok: odhad bodu po tečně → nejbližší bod sítě.
   2) Obrysy textu (2D, mm) se rozřežou na čtverečky mřížky (Clipper), dílky se triangulují (THREE.ShapeUtils)
      → jemná síť vršku sdílí vrcholy na hranách dílků (bez T-spojů).
   3) Každý vrchol (x, y) se přenese na povrch S(x, y) a posune po normále N(x, y): vršek o vyska,
      spodek o −zanoreni (do tělesa, ať se sjednocení / odečtení spolehlivě překryje); boky po obrysu.
   Výsledek: uzavřená síť {poz, idx} ve světě (normály ven). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  // ------------------------------------------------------------ nejbližší bod sítě (mřížka buněk)
  /** Index sítě pro dotaz „nejbližší bod povrchu“: {nejblizsi(x, y, z) → {bod, normala}}. Normály vyhlazené
      přes hladké hrany (oblá plocha se nezalamuje po trojúhelnících), ostré hrany zůstanou ostré. */
  M.indexPovrchu = function (sit) {
    const sv = M.svarSit(sit.poz, sit.idx && sit.idx.length !== sit.poz.length / 3 ? sit.idx : null, 1e-4);
    const p = sv.poz, t = sv.idx, nt = t.length / 3, nv = p.length / 3;
    // normály vrcholů (vážené plochou)
    const nf = new Float64Array(nt * 3);
    let delky = 0;
    for (let f = 0; f < nt; f++) {
      const a = t[f * 3] * 3, b = t[f * 3 + 1] * 3, c = t[f * 3 + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx, l = Math.hypot(x, y, z) || 1;
      nf[f * 3] = x / l; nf[f * 3 + 1] = y / l; nf[f * 3 + 2] = z / l;
      delky += Math.hypot(ux, uy, uz);
    }
    // normály rohů trojúhelníků: průměr sousedních ploch u vrcholu jen přes hladké hrany (do 40°) – ostrá hrana
    // kvádru zůstane ostrá (rovná stěna má kolmou normálu i v rozích), oblé plochy se vyhladí
    const kolemVrcholu = Array.from({ length: nv }, () => []);
    for (let f = 0; f < nt; f++) for (let s = 0; s < 3; s++) kolemVrcholu[t[f * 3 + s]].push(f);
    const cosMez = Math.cos(40 * Math.PI / 180), nroh = new Float64Array(nt * 9);
    for (let f = 0; f < nt; f++) for (let s = 0; s < 3; s++) {
      const v = t[f * 3 + s];
      let x = 0, y = 0, z = 0;
      for (const g of kolemVrcholu[v]) {
        if (nf[g * 3] * nf[f * 3] + nf[g * 3 + 1] * nf[f * 3 + 1] + nf[g * 3 + 2] * nf[f * 3 + 2] < cosMez) continue;
        const ax = p[t[g * 3 + 1] * 3] - p[t[g * 3] * 3], ay = p[t[g * 3 + 1] * 3 + 1] - p[t[g * 3] * 3 + 1], az = p[t[g * 3 + 1] * 3 + 2] - p[t[g * 3] * 3 + 2];
        const bx = p[t[g * 3 + 2] * 3] - p[t[g * 3] * 3], by = p[t[g * 3 + 2] * 3 + 1] - p[t[g * 3] * 3 + 1], bz = p[t[g * 3 + 2] * 3 + 2] - p[t[g * 3] * 3 + 2];
        const A = Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
        x += nf[g * 3] * A; y += nf[g * 3 + 1] * A; z += nf[g * 3 + 2] * A;
      }
      const l = Math.hypot(x, y, z) || 1;
      nroh[f * 9 + s * 3] = x / l; nroh[f * 9 + s * 3 + 1] = y / l; nroh[f * 9 + s * 3 + 2] = z / l;
    }
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[i + k]); max[k] = Math.max(max[k], p[i + k]); }
    const vel = M.omez(2 * delky / Math.max(1, nt), 0.3, Math.max(0.3, Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 8));
    const nb = [0, 1, 2].map(k => Math.max(1, Math.ceil((max[k] - min[k]) / vel) + 1));
    const bunky = new Map();
    const klic = (i, j, k) => (i * nb[1] + j) * nb[2] + k;
    for (let f = 0; f < nt; f++) {
      const lo = [0, 1, 2].map(k => Math.floor((Math.min(p[t[f * 3] * 3 + k], p[t[f * 3 + 1] * 3 + k], p[t[f * 3 + 2] * 3 + k]) - min[k]) / vel));
      const hi = [0, 1, 2].map(k => Math.floor((Math.max(p[t[f * 3] * 3 + k], p[t[f * 3 + 1] * 3 + k], p[t[f * 3 + 2] * 3 + k]) - min[k]) / vel));
      for (let i = lo[0]; i <= hi[0]; i++) for (let j = lo[1]; j <= hi[1]; j++) for (let k = lo[2]; k <= hi[2]; k++) {
        const q = klic(i, j, k); let l = bunky.get(q); if (!l) bunky.set(q, l = []); l.push(f);
      }
    }
    /** Nejbližší bod trojúhelníku f k bodu (x, y, z): [x, y, z, w0, w1, w2]. (Ericson, Real-Time Collision Detection) */
    function nejblizsiNaTroj(f, x, y, z) {
      const a = t[f * 3] * 3, b = t[f * 3 + 1] * 3, c = t[f * 3 + 2] * 3;
      const abx = p[b] - p[a], aby = p[b + 1] - p[a + 1], abz = p[b + 2] - p[a + 2];
      const acx = p[c] - p[a], acy = p[c + 1] - p[a + 1], acz = p[c + 2] - p[a + 2];
      const apx = x - p[a], apy = y - p[a + 1], apz = z - p[a + 2];
      const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
      if (d1 <= 0 && d2 <= 0) return [p[a], p[a + 1], p[a + 2], 1, 0, 0];
      const bpx = x - p[b], bpy = y - p[b + 1], bpz = z - p[b + 2];
      const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
      if (d3 >= 0 && d4 <= d3) return [p[b], p[b + 1], p[b + 2], 0, 1, 0];
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [p[a] + v * abx, p[a + 1] + v * aby, p[a + 2] + v * abz, 1 - v, v, 0]; }
      const cpx = x - p[c], cpy = y - p[c + 1], cpz = z - p[c + 2];
      const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
      if (d6 >= 0 && d5 <= d6) return [p[c], p[c + 1], p[c + 2], 0, 0, 1];
      const vb = d5 * d2 - d1 * d6;
      if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [p[a] + w * acx, p[a + 1] + w * acy, p[a + 2] + w * acz, 1 - w, 0, w]; }
      const va = d3 * d6 - d5 * d4;
      if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
        const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
        return [p[b] + w * (p[c] - p[b]), p[b + 1] + w * (p[c + 1] - p[b + 1]), p[b + 2] + w * (p[c + 2] - p[b + 2]), 0, 1 - w, w];
      }
      const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
      return [p[a] + abx * v + acx * w, p[a + 1] + aby * v + acy * w, p[a + 2] + abz * v + acz * w, 1 - v - w, v, w];
    }
    return {
      vel, min, max,
      /** Nejbližší bod povrchu k (x, y, z): {bod: [x,y,z], normala: [x,y,z] (vyhlazená), f, vzd}. */
      nejblizsi(x, y, z) {
        const c = [x, y, z].map((v, k) => Math.floor((v - min[k]) / vel));
        let nej = null, d0 = Infinity;
        for (let r = 0; r < Math.max(...nb) + 1; r++) {
          // vrstva r kolem buňky; po nalezení stačí ještě jedna vrstva navíc (bod může ležet v sousední buňce)
          if (nej && (r - 1) * vel > Math.sqrt(d0)) break;
          for (let i = c[0] - r; i <= c[0] + r; i++) for (let j = c[1] - r; j <= c[1] + r; j++) for (let k = c[2] - r; k <= c[2] + r; k++) {
            if (Math.max(Math.abs(i - c[0]), Math.abs(j - c[1]), Math.abs(k - c[2])) !== r) continue;
            if (i < 0 || j < 0 || k < 0 || i >= nb[0] || j >= nb[1] || k >= nb[2]) continue;
            const l = bunky.get(klic(i, j, k));
            if (!l) continue;
            for (const f of l) {
              const q = nejblizsiNaTroj(f, x, y, z), d = (q[0] - x) ** 2 + (q[1] - y) ** 2 + (q[2] - z) ** 2;
              if (d < d0) { d0 = d; nej = [f, q]; }
            }
          }
        }
        if (!nej) return null;
        const [f, q] = nej, n = [0, 0, 0];
        for (let s = 0; s < 3; s++) for (let k = 0; k < 3; k++) n[k] += q[3 + s] * nroh[f * 9 + s * 3 + k];
        const l = Math.hypot(n[0], n[1], n[2]);
        const nn = l > 1e-9 ? n.map(v => v / l) : [nf[f * 3], nf[f * 3 + 1], nf[f * 3 + 2]];
        return { bod: [q[0], q[1], q[2]], normala: nn, f, vzd: Math.sqrt(d0) };
      },
    };
  };

  // ------------------------------------------------------------ mřížka na povrchu
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : null; };
  /** Směr d promítnutý do tečné roviny s normálou n (jednotkový), nebo null. */
  const tecny = (d, n) => norm(sub(d, n.map(x => x * dot(d, n))));

  /** Krokuje po povrchu z bodu b (normála n) ve směru d: pocet kroků délky h. Vrací [{bod, normala, smer}] (bez startu). */
  function krokuj(index, b, n, d, h, pocet) {
    const out = [];
    let p = b, nn = n, s = tecny(d, n) || d;
    for (let i = 0; i < pocet; i++) {
      // dva menší kroky na jeden výsledný (přesnější na ostrém zakřivení)
      for (let k = 0; k < 2; k++) {
        const q = index.nejblizsi(...add(p, s, h / 2));
        if (!q) return out;
        s = tecny(s, q.normala) || s;
        p = q.bod; nn = q.normala;
      }
      out.push({ bod: p, normala: nn, smer: s });
    }
    return out;
  }

  /** Mřížka na povrchu: řádky po h od účaří, sloupce po h od bodu kliknutí.
      Vrací {x0, y0, h, nx, ny, S: [[bod]], N: [[normala]]} (S[i][j] pro x = x0 + i·h, y = y0 + j·h). */
  M.mrizkaNaPovrchu = function (index, bod, smer, rozsah, h) {
    const start = index.nejblizsi(...bod);
    if (!start) throw new Error('bod není na tělese');
    const n0 = start.normala;
    const t0 = tecny(smer, n0) || tecny([1, 0, 0], n0) || tecny([0, 1, 0], n0);
    const [xa, xb, ya, yb] = rozsah;
    const iL = Math.ceil(-xa / h) + 1, iR = Math.ceil(xb / h) + 1, jD = Math.ceil(-ya / h) + 1, jU = Math.ceil(yb / h) + 1;
    // účaří: vlevo i vpravo od startu
    const vlevo = krokuj(index, start.bod, n0, t0.map(x => -x), h, iL).map(q => Object.assign(q, { smer: q.smer.map(x => -x) })).reverse();
    const vpravo = krokuj(index, start.bod, n0, t0, h, iR);
    const ucari = vlevo.concat([{ bod: start.bod, normala: n0, smer: t0 }], vpravo);
    const nx = ucari.length, ny = jD + jU + 1, S = [], N = [];
    for (const u of ucari) {
      const nahoru = norm(cross(u.normala, u.smer));
      const dolu = krokuj(index, u.bod, u.normala, nahoru.map(x => -x), h, jD).reverse();
      const hore = krokuj(index, u.bod, u.normala, nahoru, h, jU);
      const sl = dolu.concat([{ bod: u.bod, normala: u.normala }], hore);
      // kraj tělesa (krokování skončilo dřív): dopočítat po tečně, ať je mřížka úplná
      while (sl.length < ny) { const l = sl[sl.length - 1]; sl.push({ bod: add(l.bod, nahoru, h), normala: l.normala }); }
      S.push(sl.map(q => q.bod)); N.push(sl.map(q => q.normala));
    }
    return { x0: -vlevo.length * h, y0: -jD * h, h, nx, ny, S, N };
  };

  /** Bod a normála mřížky v (x, y) (bilineárně). */
  function naPovrch(m, x, y) {
    const fi = M.omez((x - m.x0) / m.h, 0, m.nx - 1.000001), fj = M.omez((y - m.y0) / m.h, 0, m.ny - 1.000001);
    const i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j;
    const mix = (P, k) => (1 - a) * (1 - b) * P[i][j][k] + a * (1 - b) * P[i + 1][j][k] + (1 - a) * b * P[i][j + 1][k] + a * b * P[i + 1][j + 1][k];
    const bod = [0, 1, 2].map(k => mix(m.S, k)), n = norm([0, 1, 2].map(k => mix(m.N, k))) || [0, 0, 1];
    return { bod, n };
  }

  // ------------------------------------------------------------ jemná síť obrysů (rozřezání na čtverečky)
  /** Kontury 2D (NonZero, mm) → trojúhelníky rozřezané na čtverečky velikosti h:
      {body: [[x, y]], troj: [[a, b, c]]} (CCW = normála +z), vrcholy svařené. */
  M.jemnaSitObrysu = function (kontury, h) {
    const CL = globalThis.ClipperLib, SC = 1e4;
    const cesty = kontury.map(k => k.map(([x, y]) => ({ X: Math.round(x * SC), Y: Math.round(y * SC) })));
    // sjednocení (NonZero) – překryvy písmen a správná orientace
    const c0 = new CL.Clipper();
    c0.AddPaths(cesty, CL.PolyType.ptSubject, true);
    const oblast = new CL.Paths();
    c0.Execute(CL.ClipType.ctUnion, oblast, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
    if (!oblast.length) throw new Error('text nemá žádné obrysy');
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const k of oblast) for (const q of k) { x0 = Math.min(x0, q.X); x1 = Math.max(x1, q.X); y0 = Math.min(y0, q.Y); y1 = Math.max(y1, q.Y); }
    const H = Math.round(h * SC), body = [], mapa = new Map(), troj = [];
    const vrchol = (X, Y) => {
      const k = Math.round(X / 2) + ',' + Math.round(Y / 2);          // svaření (2 jednotky = 0,2 µm)
      let i = mapa.get(k);
      if (i === undefined) { i = body.length; body.push([X / SC, Y / SC]); mapa.set(k, i); }
      return i;
    };
    const i0 = Math.floor(x0 / H), i1 = Math.ceil(x1 / H), j0 = Math.floor(y0 / H), j1 = Math.ceil(y1 / H);
    for (let j = j0; j < j1; j++) {
      // nejdřív pás řádku, pak čtverečky v něm
      const pas = new CL.Paths(), cp = new CL.Clipper();
      cp.AddPaths(oblast, CL.PolyType.ptSubject, true);
      cp.AddPath([{ X: i0 * H - H, Y: j * H }, { X: i1 * H + H, Y: j * H }, { X: i1 * H + H, Y: (j + 1) * H }, { X: i0 * H - H, Y: (j + 1) * H }], CL.PolyType.ptClip, true);
      cp.Execute(CL.ClipType.ctIntersection, pas, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
      if (!pas.length) continue;
      for (let i = i0; i < i1; i++) {
        const c = new CL.Clipper();
        c.PreserveCollinear = true;
        c.AddPaths(pas, CL.PolyType.ptSubject, true);
        c.AddPath([{ X: i * H, Y: j * H }, { X: (i + 1) * H, Y: j * H }, { X: (i + 1) * H, Y: (j + 1) * H }, { X: i * H, Y: (j + 1) * H }], CL.PolyType.ptClip, true);
        const strom = new CL.PolyTree();
        c.Execute(CL.ClipType.ctIntersection, strom, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
        for (const vn of strom.Childs()) {
          const obr = vn.Contour(), diry = vn.Childs().map(d => d.Contour());
          if (obr.length < 3) continue;
          const kon = CL.Clipper.Orientation(obr) ? obr : obr.slice().reverse();
          const hol = diry.map(d => CL.Clipper.Orientation(d) ? d.slice().reverse() : d);
          const v2 = kon.map(q => new THREE.Vector2(q.X, q.Y)), h2 = hol.map(d => d.map(q => new THREE.Vector2(q.X, q.Y)));
          const tri = THREE.ShapeUtils.triangulateShape(v2, h2);
          const vse = kon.concat(...hol);
          for (const [a, b, cc] of tri) {
            const A = vrchol(vse[a].X, vse[a].Y), B = vrchol(vse[b].X, vse[b].Y), C = vrchol(vse[cc].X, vse[cc].Y);
            if (A === B || B === C || A === C) continue;
            // orientace CCW (ShapeUtils ji drží podle obrysu, pojistka)
            const pa = body[A], pb = body[B], pc = body[C];
            const s = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]);
            if (Math.abs(s) < 1e-14) continue;
            troj.push(s > 0 ? [A, B, C] : [A, C, B]);
          }
        }
      }
    }
    return { body, troj };
  };

  // ------------------------------------------------------------ těleso na povrchu
  /** Uzavřená síť textu na povrchu. sit = síť tělesa ve světě, kontury = 2D obrysy textu (mm, vystředěné kolem 0),
      v = {bod, smer (směr účaří ve světě), vyska (nad povrch), zanoreni (pod povrch), krok}. Vrací {poz, idx}. */
  M.textNaPovrch = function (sit, kontury, v) {
    const h = v.krok || 0.4;
    const index = v.index || M.indexPovrchu(sit);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const k of kontury) for (const [x, y] of k) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const mriz = M.mrizkaNaPovrchu(index, v.bod, v.smer, [x0 - h, x1 + h, y0 - h, y1 + h], h);
    const jemna = M.jemnaSitObrysu(kontury, h);
    if (!jemna.troj.length) throw new Error('text je příliš malý');
    const nb = jemna.body.length, poz = new Float32Array(nb * 6);
    for (let i = 0; i < nb; i++) {
      const [x, y] = jemna.body[i], q = naPovrch(mriz, x, y);
      for (let k = 0; k < 3; k++) { poz[i * 3 + k] = q.bod[k] + q.n[k] * v.vyska; poz[(nb + i) * 3 + k] = q.bod[k] - q.n[k] * v.zanoreni; }
    }
    // vršek (CCW = ven), spodek obráceně, boky po hranách, které patří jen jednomu trojúhelníku
    const idx = [], hrany = new Map();
    for (const [a, b, c] of jemna.troj) {
      idx.push(a, b, c, nb + a, nb + c, nb + b);
      for (const [p, q] of [[a, b], [b, c], [c, a]]) { const k = p < q ? p + ',' + q : q + ',' + p; hrany.set(k, (hrany.get(k) || 0) + 1); }
    }
    for (const [a, b, c] of jemna.troj) for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      if (hrany.get(p < q ? p + ',' + q : q + ',' + p) !== 1) continue;
      // hrana p→q vršku (oblast vlevo): stěna ven = vpravo
      idx.push(p, nb + p, nb + q, p, nb + q, q);
    }
    const s = { poz, idx: new Uint32Array(idx) };
    // kontrola orientace (vyska < 0 nebo zrcadlená mřížka): kladný objem
    if (M.objemSite(s) < 0) for (let i = 0; i < s.idx.length; i += 3) { const x = s.idx[i + 1]; s.idx[i + 1] = s.idx[i + 2]; s.idx[i + 2] = x; }
    return s;
  };

  /** Uzel modelu (osy desky) ze sítě ve světě: vystředí ji, zaregistruje zdroj. */
  M.uzelZeSveteSite = function (sit, { nazev = 'Text', barva, role = 'teleso', format = 'text' } = {}) {
    const b = M.obalkaSite(sit), c = [0, 1, 2].map(k => (b.min[k] + b.max[k]) / 2);
    const poz = new Float32Array(sit.poz.length);
    for (let i = 0; i < poz.length; i += 3) for (let k = 0; k < 3; k++) poz[i + k] = sit.poz[i + k] - c[k];
    const zdroj = M.pridejZdroj({ poz, idx: sit.idx }, nazev, format);
    const zaklad = [0, 1, 2].map(k => Math.max(0.01, Math.round((b.max[k] - b.min[k]) * 1e6) / 1e6));
    return M.normalizujUzel({ druh: 'sit', zdroj, zaklad, rozmer: zaklad, nazev, barva, role, poloha: c.map(x => Math.round(x * 1e6) / 1e6) });
  };

  /** Text nalepený na těleso id: nový uzel textu seskupený s tělesem (vystouplý = sjednocení, vyrytý = díra).
      v = {bod, smer, vyska, hloubka, vzor: 'vystouply' | 'vyryty', krok, nazev}. Vrací {dok, id (skupina)}. */
  M.textNaTeleso = function (dok, id, sit, kontury, v) {
    const u = M.najdiUzel(dok, id);
    if (!u) throw new Error('těleso nenalezeno');
    const vyryty = v.vzor === 'vyryty';
    const s = M.textNaPovrch(sit, kontury, { bod: v.bod, smer: v.smer, krok: v.krok, index: v.index,
      vyska: vyryty ? 0.3 : v.vyska, zanoreni: vyryty ? v.hloubka : 0.3 });
    const t = M.uzelZeSveteSite(s, { nazev: v.nazev || 'Text', barva: u.barva, role: vyryty ? 'dira' : 'teleso' });
    const d1 = M.pridejUzly(dok, [t]);
    if (u.zamceno) return { dok: d1, id: t.id };
    const r = M.seskupUzly(d1, [id, t.id], { nazev: u.nazev + (vyryty ? ' s vyrytým textem' : ' s textem') });
    return r.id ? { dok: M.upravUzly(r.dok, [r.id], { barva: u.barva }), id: r.id } : { dok: d1, id: t.id };
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);

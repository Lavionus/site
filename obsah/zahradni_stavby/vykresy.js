/* ============================================================
   Zahradní stavby – technické výkresy (bez DOM)
   Pohledy a řezy z dílů jádra (malířův algoritmus s bílou výplní, řezané díly šrafovaně),
   automatické kóty, měřítka 1:5 … 1:100, detaily, šablony 1:1 a plán řezů.
   Scéna = {x0, y0, w, h, prvky} v mm papíru, osa y dolů:
     {t:'l', b:[[x,y]…], z (uzavřená), v (vrstva), s (tloušťka), d (čárkovaně) | 'osa'}
     {t:'p', b:[[[x,y]…]], v, f (barva výplně)}
     {t:'txt', x, y, h, txt, a ('l'|'c'|'r'), u (úhel °), v}
   ============================================================ */
(function (koren) {
  'use strict';
  const J = koren.ZSJ || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const fmt = J.fmt;
  const MERITKA = [1, 2, 5, 10, 20, 25, 50, 100, 200];

  /* ---------- geometrie 2D ---------- */
  function obal(body) {
    const P = body.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (P.length < 3) return P;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = [];
    for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-9) lo.pop(); lo.push(p); }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 1e-9) hi.pop(); hi.push(p); }
    hi.pop(); lo.pop();
    return lo.concat(hi);
  }
  /** ořez mnohoúhelníku obdélníkem (Sutherland–Hodgman) */
  function orezObdelnikem(P, x0, x1, y0, y1) {
    let out = P;
    const hrany = [[(q) => q[0] >= x0, (a, b) => [x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0])]],
      [(q) => q[0] <= x1, (a, b) => [x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0])]],
      [(q) => q[1] >= y0, (a, b) => [a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0]],
      [(q) => q[1] <= y1, (a, b) => [a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1]]];
    for (const [uvnitr, prus] of hrany) {
      const vst = out; out = [];
      for (let i = 0; i < vst.length; i++) {
        const a = vst[i], b = vst[(i + 1) % vst.length];
        if (uvnitr(b)) { if (!uvnitr(a)) out.push(prus(a, b)); out.push(b); } else if (uvnitr(a)) out.push(prus(a, b));
      }
      if (!out.length) return out;
    }
    return out;
  }
  /** šrafy 45° uvnitř konvexního mnohoúhelníku (souřadnice papíru) */
  function srafy(P, rozestup, smer) {
    const out = [], k = smer < 0 ? -1 : 1;
    let mn = Infinity, mx = -Infinity;
    for (const q of P) { const c = q[0] + k * q[1]; mn = Math.min(mn, c); mx = Math.max(mx, c); }
    for (let c = Math.ceil(mn / rozestup) * rozestup; c < mx; c += rozestup) {
      const pr = [];
      for (let i = 0; i < P.length; i++) {
        const a = P[i], b = P[(i + 1) % P.length], fa = a[0] + k * a[1] - c, fb = b[0] + k * b[1] - c;
        if ((fa <= 0 && fb > 0) || (fa > 0 && fb <= 0)) { const t = fa / (fa - fb); pr.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
      }
      if (pr.length >= 2) out.push([pr[0], pr[1]]);
    }
    return out;
  }
  /** ořez úsečky obdélníkem (Liang–Barsky) */
  function orezUsecky(A, B, x0, x1, y0, y1) {
    let t0 = 0, t1 = 1; const dx = B[0] - A[0], dy = B[1] - A[1];
    for (const [p, q] of [[-dx, A[0] - x0], [dx, x1 - A[0]], [-dy, A[1] - y0], [dy, y1 - A[1]]]) {
      if (Math.abs(p) < 1e-12) { if (q < 0) return null; continue; }
      const r = q / p; if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return [[A[0] + t0 * dx, A[1] + t0 * dy], [A[0] + t1 * dx, A[1] + t1 * dy]];
  }
  function svetlejsi(hex, k) {
    const v = parseInt(String(hex || '#888888').slice(1), 16);
    const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => Math.round(x + (255 - x) * k));
    return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  /* ---------- projekce ---------- */
  // u vpravo, v nahoru, hloubka: větší = blíž k pozorovateli
  const PROJ = {
    shora: (q) => [q[0], q[1], q[2]],
    zepredu: (q) => [q[0], q[2], -q[1]],
    zboku: (q) => [q[1], q[2], q[0]],
  };
  const DRUH_PRO_OSU = { x: 'zboku', y: 'zepredu', z: 'shora' };
  const HRANY_KVADRU = (() => { const E = []; for (let i = 0; i < 8; i++) for (const bit of [1, 2, 4]) if (!(i & bit)) E.push([i, i | bit]); return E; })();

  function rezDilu(d, osa, c, proj) {
    const i = 'xyz'.indexOf(osa);
    if (d.tvar === 'hranol') {
      if (osa === 'z') return d.z0 < c && d.z1 > c ? [d.poly.map((q) => proj([q[0], q[1], c]).slice(0, 2))] : [];
      if (!(d.z0 < c || d.z1 > c)) return [];
      const j = osa === 'x' ? 1 : 0, xs = [];
      for (let k = 0; k < d.poly.length; k++) {
        const a = d.poly[k], b = d.poly[(k + 1) % d.poly.length], fa = a[i] - c, fb = b[i] - c;
        if ((fa < 0 && fb >= 0) || (fa >= 0 && fb < 0)) xs.push(a[j] + (b[j] - a[j]) * fa / (fa - fb));
      }
      xs.sort((a, b) => a - b);
      const out = [];
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const A = osa === 'x' ? [c, xs[k], 0] : [xs[k], c, 0], B = osa === 'x' ? [c, xs[k + 1], 0] : [xs[k + 1], c, 0];
        const u0 = proj(A)[0], u1 = proj(B)[0];
        out.push([[u0, d.z0], [u1, d.z0], [u1, d.z1], [u0, d.z1]]);
      }
      return out;
    }
    const R = J.rohyDilu(d), body = [];
    for (const [a, b] of HRANY_KVADRU) {
      const fa = R[a][i] - c, fb = R[b][i] - c;
      if (Math.abs(fa) < 1e-9) body.push(R[a]);
      if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) { const t = fa / (fa - fb); body.push([0, 1, 2].map((k) => R[a][k] + (R[b][k] - R[a][k]) * t)); }
    }
    if (body.length < 3) return [];
    const h = obal(body.map((q) => proj(q).slice(0, 2)));
    return h.length >= 3 ? [h] : [];
  }
  function obrysDilu(d, proj, druh) {
    if (d.tvar === 'hranol') {
      if (druh === 'shora') return d.poly.map((q) => proj([q[0], q[1], d.z1]).slice(0, 2));
      const P = []; for (const q of d.poly) for (const z of [d.z0, d.z1]) P.push(proj([q[0], q[1], z]).slice(0, 2));
      return obal(P);
    }
    return obal(J.rohyDilu(d).map((q) => proj(q).slice(0, 2)));
  }
  function hloubkaDilu(d, proj) {
    const R = d.tvar === 'hranol' ? J.rohyDilu(d) : J.rohyDilu(d);
    // nejbližší bod rozhoduje o pořadí kreslení (sloupek před prknem za ním)
    let s = 0, mx = -Infinity; for (const q of R) { const h = proj(q)[2]; s += h; mx = Math.max(mx, h); }
    return mx * 0.5 + s / R.length * 0.5;
  }

  /* ---------- definice pohledů podle typu stavby ---------- */
  function definice(S) {
    const p = S.p;
    if (S.typ === 'zahon') {
      const c = p.tvar === 'obdelnik' ? p.delka / 2 : p.sirka / 2;
      return [
        { id: 'pudorys', nazev: 'Půdorys (bez horní lišty)', druh: 'shora', bez: ['napln', 'folie', 'lista'] },
        { id: 'pohled', nazev: 'Pohled zepředu', druh: 'zepredu', bez: ['napln', 'folie', 'pletivo'] },
        { id: 'rez', nazev: 'Řez A–A (stěna, náplň, fólie)', druh: 'rez', osa: 'x', c, popisVrstev: true },
      ];
    }
    if (S.typ === 'komposter') {
      const ps = p.sloupek, x = ps + p.sirkaKomory;
      return [
        { id: 'pudorys', nazev: 'Půdorys – řez ve výšce ' + fmt(S.vyska / 2) + ' mm', druh: 'rez', osa: 'z', c: S.vyska / 2 + 1, bez: ['pletivo'] },
        { id: 'pohled', nazev: 'Pohled zepředu', druh: 'zepredu', bez: ['pletivo'] },
        { id: 'bok', nazev: 'Pohled zboku', druh: 'zboku', bez: ['pletivo'] },
        { id: 'detail', nazev: 'Detail D – drážka vyjímatelného čela (řez)', druh: 'rez', osa: 'z', c: S.vyska / 2 + 1, okno: [x - 110, x + ps + 110, -40, ps + 80], detail: true, bez: ['pletivo'],
          koty: [{ smer: 'v', a: p.listaB, b: p.listaB + p.lamelaT + p.vule, u: x + ps + p.listaH + 14, text: 'drážka ' + fmt(p.lamelaT + p.vule) }, { smer: 'h', a: x + ps, b: x + ps + p.listaH, v: -25, text: fmt(p.listaH) }, { smer: 'v', a: 0, b: ps, u: x - 95, text: fmt(ps) }, { smer: 'h', a: x, b: x + ps, v: -25, text: fmt(ps) }] },
      ];
    }
    const P = S.pole, mezi = P.xK.length > 1 ? (P.xK[0] + P.xK[1]) / 2 : 0;
    const zK1 = S.vyska;
    return [
      { id: 'pudorys', nazev: 'Půdorys', druh: 'shora', bez: ['zed'] },
      { id: 'pohled', nazev: 'Pohled zepředu', druh: 'zepredu', bez: [] },
      { id: 'bok', nazev: 'Pohled zboku', druh: 'zboku', bez: [] },
      { id: 'detail', nazev: 'Detail L – řez lamelami, paprsky Slunce v poledne', druh: 'rez', osa: 'x', c: mezi, okno: [-p.presahK - 50, -p.presahK + Math.max(700, 5 * p.roztecL), p.vyska - 150, zK1 + p.lamB + 120], detail: true, slunce: true },
    ];
  }

  /** model → seznam položek v souřadnicích (u, v) v mm modelu */
  function pripravPohled(S, def) {
    const druh = def.druh === 'rez' ? DRUH_PRO_OSU[def.osa] : def.druh, proj = PROJ[druh];
    const polozky = [];
    const i = def.osa ? 'xyz'.indexOf(def.osa) : -1;
    for (const d of S.dily) {
      if (def.bez && def.bez.includes(d.skup)) continue;
      if (def.druh === 'rez' && d.skup === 'zed' && def.osa !== 'z') continue;
      const m = d.meze || J.mezeDilu(d);
      if (def.druh === 'rez') {
        // ponechat jen díly za rovinou řezu (ve směru pohledu)
        if (def.osa === 'x' && m[0] > def.c) continue;
        if (def.osa === 'y' && m[3] < def.c) continue;
        if (def.osa === 'z' && m[4] > def.c) continue;
        if (m[2 * i] < def.c && m[2 * i + 1] > def.c) {
          for (const P of rezDilu(d, def.osa, def.c, proj)) polozky.push({ d, P, rez: true, hl: Infinity });
          continue;
        }
      }
      polozky.push({ d, P: obrysDilu(d, proj, druh), rez: false, hl: hloubkaDilu(d, proj) });
    }
    polozky.sort((a, b) => a.hl - b.hl || (a.rez && b.rez ? (a.d.mat === 'vrstva' ? 0 : 1) - (b.d.mat === 'vrstva' ? 0 : 1) : 0));
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const q of polozky) for (const b of q.P) { u0 = Math.min(u0, b[0]); u1 = Math.max(u1, b[0]); v0 = Math.min(v0, b[1]); v1 = Math.max(v1, b[1]); }
    if (def.okno) [u0, u1, v0, v1] = def.okno;
    if (!Number.isFinite(u0)) { u0 = 0; u1 = 1000; v0 = 0; v1 = 1000; }
    return { def, druh, proj, polozky, meze: [u0, u1, v0, v1] };
  }
  function zvolMeritko(sirkaModel, vyskaModel, uw, uh, min) {
    for (const M of MERITKA) if (M >= (min || 1) && sirkaModel / M <= uw && vyskaModel / M <= uh) return M;
    return MERITKA[MERITKA.length - 1];
  }

  /* ---------- kóty ---------- */
  const H_TXT = 2.5;
  function kotaH(prvky, xa, xb, y, yRef, text) {
    if (Math.abs(xb - xa) < 0.3) return;
    const sm = yRef > y ? 1 : -1;
    for (const x of [xa, xb]) prvky.push({ t: 'l', b: [[x, yRef - sm * 1], [x, y - sm * 1.5]], v: 'kota', s: 0.13 });
    prvky.push({ t: 'l', b: [[xa - 1.5, y], [xb + 1.5, y]], v: 'kota', s: 0.18 });
    for (const x of [xa, xb]) prvky.push({ t: 'l', b: [[x - 0.9, y + 0.9], [x + 0.9, y - 0.9]], v: 'kota', s: 0.35 });
    const sirka = text.length * H_TXT * 0.52;
    const x = Math.abs(xb - xa) > sirka + 2 ? (xa + xb) / 2 : xb + 2 + sirka / 2;
    prvky.push({ t: 'txt', x, y: y - 1.9, h: H_TXT, txt: text, a: 'c', v: 'kotaText' });
  }
  function kotaV(prvky, ya, yb, x, xRef, text) {
    if (Math.abs(yb - ya) < 0.3) return;
    const sm = xRef > x ? 1 : -1;
    for (const y of [ya, yb]) prvky.push({ t: 'l', b: [[xRef - sm * 1, y], [x - sm * 1.5, y]], v: 'kota', s: 0.13 });
    prvky.push({ t: 'l', b: [[x, ya - 1.5], [x, yb + 1.5]], v: 'kota', s: 0.18 });
    for (const y of [ya, yb]) prvky.push({ t: 'l', b: [[x - 0.9, y + 0.9], [x + 0.9, y - 0.9]], v: 'kota', s: 0.35 });
    const sirka = text.length * H_TXT * 0.52;
    const y = Math.abs(yb - ya) > sirka + 2 ? (ya + yb) / 2 : Math.min(ya, yb) - 2 - sirka / 2;
    prvky.push({ t: 'txt', x: x - 1.9, y, h: H_TXT, txt: text, a: 'c', u: 90, v: 'kotaText' });
  }
  const uniq = (A, tol) => { const s = A.slice().sort((a, b) => a - b), o = []; for (const x of s) if (!o.length || x - o[o.length - 1] > tol) o.push(x); return o; };

  /* ---------- vykreslení pohledu v měřítku ---------- */
  const VYPLN = { drevo: '#ffffff', beton: '#e4e4e4', ocel: '#cfd3d8', zed: '#efefef', pletivo: null, folie: null };
  function vykresliPohled(S, V, M) {
    const { def, polozky } = V, [u0, u1, v0, v1] = V.meze;
    const X = (u) => (u - u0) / M, Y = (v) => (v1 - v) / M;
    const P2 = (P) => P.map((q) => [X(q[0]), Y(q[1])]);
    const prvky = [], W = (u1 - u0) / M, Hh = (v1 - v0) / M;
    const orez = (P) => (def.okno ? orezObdelnikem(P, 0, W, 0, Hh) : P);
    const tl = M <= 5 ? 0.35 : M <= 20 ? 0.3 : 0.25;
    // terén v pohledech
    if (V.druh !== 'shora' && v0 <= 0 && v1 >= 0) {
      const y = Y(0);
      prvky.push({ t: 'l', b: [[-4, y], [W + 4, y]], v: 'obrys', s: tl * 1.4 });
      for (let x = -3; x < W + 3; x += 3) prvky.push({ t: 'l', b: [[x, y], [x - 1.6, y + 1.6]], v: 'pomoc', s: 0.13 });
    }
    for (const q of polozky) {
      const d = q.d;
      let P = orez(P2(q.P));
      if (P.length < 2) continue;
      if (d.skup === 'tahlo') { prvky.push({ t: 'l', b: P, z: true, v: 'ocel', s: 0.25 }); continue; }
      if (d.mat === 'pletivo' || d.mat === 'folie') {
        prvky.push({ t: 'l', b: P, z: true, v: 'pomoc', s: 0.18, d: true });
        continue;
      }
      const pod = d.skup === 'patka' || d.skup === 'kotva' || (d.skup === 'kovani' && d.nazev === 'Zemní vrut');
      let f = d.mat === 'vrstva' ? svetlejsi(d.barva, 0.55) : VYPLN[d.mat] || '#ffffff';
      if (q.rez && d.mat === 'drevo') f = '#ffffff';
      prvky.push({ t: 'p', b: [P], v: 'vypln', f });
      if (q.rez) {
        if (d.mat === 'drevo') for (const [a, b] of srafy(P, Math.max(0.9, Math.min(2, (d.roz ? Math.min(d.roz[1], d.roz[2]) : 100) / M / 3)), d.smerSrafy || 1)) prvky.push({ t: 'l', b: [a, b], v: 'srafa', s: 0.13 });
        else if (d.mat === 'beton' || d.mat === 'zed') for (const [a, b] of srafy(P, 1.6, -1)) prvky.push({ t: 'l', b: [a, b], v: 'srafa', s: 0.13 });
        prvky.push({ t: 'l', b: P, z: true, v: 'rez', s: tl * 1.8 });
      } else prvky.push({ t: 'l', b: P, z: true, v: pod ? 'skryte' : 'obrys', s: tl, d: pod && V.druh !== 'shora' });
    }
    // kóty
    const drevo = polozky.filter((q) => q.d.mat === 'drevo' || q.d.mat === 'zed');
    let du0 = Infinity, du1 = -Infinity, dv0 = Infinity, dv1 = -Infinity;
    for (const q of drevo) if (q.d.mat === 'drevo') for (const b of q.P) { du0 = Math.min(du0, b[0]); du1 = Math.max(du1, b[0]); dv0 = Math.min(dv0, b[1]); dv1 = Math.max(dv1, b[1]); }
    if (!def.detail && Number.isFinite(du0)) {
      const sl = polozky.filter((q) => (q.d.skup === 'sloup' || q.d.skup === 'sloupek'));
      const tol = 6 * M, stredyU = uniq(sl.map((q) => q.P.reduce((a, b) => a + b[0], 0) / q.P.length), tol);
      const yK1 = Hh + 7, yK2 = Hh + 14;
      const retez = uniq([du0, ...stredyU, du1], tol / 2);
      if (retez.length > 2) for (let k = 0; k + 1 < retez.length; k++) kotaH(prvky, X(retez[k]), X(retez[k + 1]), yK1, Math.max(...[Y(dv0)]), fmt(retez[k + 1] - retez[k]));
      kotaH(prvky, X(du0), X(du1), retez.length > 2 ? yK2 : yK1, Y(dv0), fmt(du1 - du0));
      // svislé kóty
      const vK = [dv0, dv1];
      if (V.druh === 'shora') { for (const q of sl) vK.push(q.P.reduce((a, b) => a + b[1], 0) / q.P.length); }
      else {
        if (dv0 < 0 && dv1 > 0) vK.push(0);
        for (const q of drevo) if (['sloup', 'sloupek', 'vaznice', 'krokev', 'prkno', 'lamela'].includes(q.d.skup)) { let a = -Infinity; for (const b of q.P) a = Math.max(a, b[1]); if (q.d.skup !== 'prkno' && q.d.skup !== 'lamela') vK.push(a); }
        const prk = drevo.filter((q) => q.d.skup === 'prkno' || (S.typ === 'zahon' && q.d.skup === 'lista'));
        for (const q of prk) { let a = -Infinity; for (const b of q.P) a = Math.max(a, b[1]); vK.push(a); }
      }
      const vv = uniq(vK.filter((x) => x >= dv0 - 1 && x <= dv1 + 1), tol);
      const xK1 = W + 7, xK2 = W + 14;
      if (vv.length > 2 && vv.length < 16) for (let k = 0; k + 1 < vv.length; k++) kotaV(prvky, Y(vv[k]), Y(vv[k + 1]), xK1, X(du1), fmt(vv[k + 1] - vv[k]));
      kotaV(prvky, Y(dv0), Y(dv1), vv.length > 2 && vv.length < 16 ? xK2 : xK1, X(du1), fmt(dv1 - dv0));
    }
    // popisy vrstev v řezu záhonu
    let pravyOkraj = W + 22;
    if (def.popisVrstev && S.napln) {
      const xs = W + 24; let yPosl = -Infinity;
      for (const v of S.napln.vrstvy.slice().reverse()) {
        if (!(v.tl > 0)) continue;
        const yc = Y((v.z0 + v.z1) / 2); let yt = Math.max(yc, yPosl + 4.2); yPosl = yt;
        prvky.push({ t: 'l', b: [[W - 8, yc], [xs - 2, yt]], v: 'pomoc', s: 0.15 });
        prvky.push({ t: 'txt', x: xs, y: yt, h: 2.4, txt: `${v.nazev.replace(/ \([^)]*\)/g, '')} – ${fmt(v.tl)} mm, ${fmt(v.objem, 2)} m³`, a: 'l', v: 'text' });
      }
      pravyOkraj = xs + 95;
    }
    // detail lamel: paprsky Slunce
    if (def.slunce && S.typ === 'pergola' && S.p.krytina === 'lamely') {
      const p = S.p, rok = (/^(\d{4})/.exec(p.datum || '') || [0, 2026])[1];
      const dny = [[`${rok}-06-21`, '#d9480f', '21. 6.'], [`${rok}-12-21`, '#1971c2', '21. 12.']];
      let iy = 0;
      for (const [dat, barva, nazev] of dny) {
        const dp = J.denniPrubeh(p, dat, 1 / 12); if (!dp.poledne) continue;
        const sv = J.smerSlunceLokalne(dp.poledne.vyska, dp.poledne.azimut, p.orientace);
        const sy = sv[1], sz = sv[2], L = Math.hypot(sy, sz);
        const lam = J.stinLamely({ b: p.lamB, t: p.lamT, beta: p.sklon, s: p.roztecL, sy, sz });
        const zt = v1 - 10, zb = v0 + 10;
        const prek = polozky.filter((q) => q.rez || q.d.skup === 'krokev').map((q) => q.P);
        const uvnitr = (P, q) => { let zn = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b2 = P[(i + 1) % P.length], c = (b2[0] - a[0]) * (q[1] - a[1]) - (b2[1] - a[1]) * (q[0] - a[0]); if (Math.abs(c) < 1e-9) continue; if (!zn) zn = Math.sign(c); else if (Math.sign(c) !== zn) return false; } return true; };
        const N = 16;
        for (let k = 0; k < N; k++) {
          const ya = u0 + (k + 0.5 + (iy ? 0.5 : 0)) * (u1 - u0 + (zt - zb) * Math.abs(sy / sz)) / N - (sy > 0 ? 0 : (zt - zb) * Math.abs(sy / sz));
          let zk = zb;
          for (let z = zt; z > zb; z -= 2) { const q = [ya - (zt - z) * sy / sz, z]; if (prek.some((P) => uvnitr(P, q))) { zk = z; break; } }
          const yb = ya - (zt - zk) * sy / sz;
          const A = [X(ya), Y(zt)], B = [X(yb), Y(zk)];
          const C = orezUsecky(A, B, 0, W, 0, Hh);
          if (C) prvky.push({ t: 'l', b: C, v: 'slunce', c: barva, s: 0.3, d: iy === 1 });
        }
        void L;
        prvky.push({ t: 'txt', x: 1, y: Hh + 5 + iy * 4.2, h: 2.5, txt: `${nazev} ${fmt(dp.poledne.hod, 2).replace(',', ':').replace(/:(\d)$/, ':$10')}: Slunce ${fmt(dp.poledne.vyska, 1)}° nad obzorem, úhel profilu ${fmt(lam.uhelProfilu, 1)}°, zastínění lamelami ${fmt(lam.zastineni * 100)} %`, a: 'l', v: 'text', c: barva });
        iy++;
      }
      // úhel sklonu
      prvky.push({ t: 'txt', x: W - 1, y: 3, h: 2.6, txt: `lamely ${p.lamT}×${p.lamB}, sklon ${p.sklon}°, rozteč ${fmt(p.roztecL)} mm`, a: 'r', v: 'text' });
    }
    for (const k of def.koty || []) {
      if (k.smer === 'v') kotaV(prvky, Y(k.a), Y(k.b), X(k.u), X(k.u) - 3, k.text);
      else kotaH(prvky, X(k.a), X(k.b), Y(k.v), Y(k.v) - 3, k.text);
    }
    if (def.okno) prvky.push({ t: 'l', b: [[0, 0], [W, 0], [W, Hh], [0, Hh]], z: true, v: 'pomoc', s: 0.25, d: true });
    // hodiny formát textu
    for (const e of prvky) if (e.t === 'txt' && /\d:\d\d\d/.test(e.txt)) e.txt = e.txt.replace(/(\d):(\d\d)\d+/, '$1:$2');
    const pod = (def.slunce ? 14 : 0);
    const vlevo = 3, nahore = 9;
    prvky.push({ t: 'txt', x: 0, y: -nahore + 3, h: 3.5, txt: `${def.nazev}  1:${M}`, a: 'l', v: 'nadpis' });
    return { x0: -vlevo, y0: -nahore, w: Math.max(pravyOkraj, W + 22) + vlevo, h: Hh + 22 + pod + nahore, prvky, meritko: M, nazev: def.nazev, id: def.id };
  }

  /** všechny výkresy; papir = [šířka, výška] využitelné plochy (mm) – volí měřítko */
  function vykresy(S, o) {
    o = Object.assign({ papir: [267, 165] }, o || {});
    return definice(S).map((def) => {
      const V = pripravPohled(S, def), [u0, u1, v0, v1] = V.meze;
      const rezerva = def.popisVrstev ? 125 : 30;
      const M = o.meritko && !def.detail ? o.meritko : zvolMeritko(u1 - u0, v1 - v0, o.papir[0] - rezerva, o.papir[1] - 34, def.detail ? 1 : 5);
      return vykresliPohled(S, V, M);
    });
  }

  /* ---------- šablony 1:1 ---------- */
  function sablonaSloupku(S) {
    const sl = S.dily.find((d) => d.skup === 'sloupek' || d.skup === 'sloup');
    if (!sl || S.typ === 'pergola') return null;
    const m = sl.meze, p = m[1] - m[0], z0 = m[4], z1 = m[5];
    const desky = S.dily.filter((d) => ['prkno', 'lamela'].includes(d.skup)).map((d) => [d.meze[4], d.meze[5]]);
    const rady = uniq(desky.map((r) => r[0]), 1).map((z) => desky.find((r) => Math.abs(r[0] - z) <= 1));
    const prvky = [], Y = (z) => z1 - z, L = z1 - z0;
    prvky.push({ t: 'l', b: [[0, 0], [p, 0], [p, L], [0, L]], z: true, v: 'rez', s: 0.4 });
    prvky.push({ t: 'l', b: [[p / 2, -4], [p / 2, L + 4]], v: 'osa', s: 0.18, d: 'osa' });
    rady.forEach((r, i) => {
      const ya = Y(r[1]), yb = Y(r[0]);
      prvky.push({ t: 'l', b: [[0, ya], [p, ya]], v: 'obrys', s: 0.25 });
      prvky.push({ t: 'l', b: [[0, yb], [p, yb]], v: 'obrys', s: 0.25 });
      const h = yb - ya;
      for (const [fx, fy] of [[0.3, 0.3], [0.7, 0.7]]) {
        const x = p * fx, y = ya + h * fy;
        prvky.push({ t: 'l', b: [[x - 2.5, y], [x + 2.5, y]], v: 'znacka', s: 0.25 }, { t: 'l', b: [[x, y - 2.5], [x, y + 2.5]], v: 'znacka', s: 0.25 });
      }
      prvky.push({ t: 'txt', x: p + 3, y: (ya + yb) / 2, h: 2.6, txt: `${S.typ === 'zahon' ? 'prkno' : 'lamela'} ${i + 1}: ${fmt(r[0])}–${fmt(r[1])} mm`, a: 'l', v: 'text' });
    });
    if (z0 < 0) { prvky.push({ t: 'l', b: [[-6, Y(0)], [p + 6, Y(0)]], v: 'znacka', s: 0.35 }); prvky.push({ t: 'txt', x: p + 3, y: Y(0) + 3.5, h: 2.6, txt: 'TERÉN (zapuštění níž)', a: 'l', v: 'dilText' }); }
    prvky.push({ t: 'txt', x: 0, y: -5, h: 3, txt: `Vrtací šablona sloupku ${fmt(p)} mm – HORNÍ KONEC`, a: 'l', v: 'nadpis' });
    prvky.push({ t: 'txt', x: 0, y: L + 6, h: 2.6, txt: 'Křížky = předvrtání pro vruty (2 na prkno, úhlopříčně kvůli praskání).', a: 'l', v: 'text' });
    return { x0: -8, y0: -10, w: p + 75, h: L + 20, prvky, nazev: 'Vrtací šablona sloupku' };
  }
  function sablonaKrokve(S) {
    if (S.typ !== 'pergola') return null;
    const p = S.p, h = p.krokH, Ld = Math.max(2.2 * h, 260), prvky = [];
    let obrys;
    if (p.zakonceni === 'sikme') obrys = [[0, 0], [Ld, 0], [Ld, h], [1.4 * h, h], [0, h / 3]];
    else if (p.zakonceni === 'oblouk') {
      obrys = [[0, 0], [Ld, 0], [Ld, h]];
      const r = h * 2 / 3; obrys.push([r, h]);
      for (let k = 1; k < 16; k++) { const a = PI / 2 * k / 16; obrys.push([r - r * Math.sin(a), h - r * Math.cos(a) + 0]); }
      obrys.push([0, h - r]);
    } else obrys = [[0, 0], [Ld, 0], [Ld, h], [0, h]];
    obrys = obrys.map((q) => [q[0], q[1]]);
    prvky.push({ t: 'l', b: obrys, z: true, v: 'rez', s: 0.4 });
    prvky.push({ t: 'l', b: [[Ld, -3], [Ld, h + 3]], v: 'pomoc', s: 0.2, d: true });
    prvky.push({ t: 'txt', x: Ld - 2, y: h / 2, h: 2.6, txt: 'ořízněte zde', a: 'r', u: 90, v: 'text' });
    prvky.push({ t: 'txt', x: 0, y: -4, h: 3, txt: `Zakončení krokve ${p.krokB}×${h} (${{ rovne: 'rovné', sikme: 'šikmé', oblouk: 'oblouk' }[p.zakonceni]}) – horní hrana nahoře`, a: 'l', v: 'nadpis' });
    kotaH(prvky, 0, Ld, h + 8, h, fmt(Ld));
    kotaV(prvky, 0, h, -7, 0, fmt(h));
    // úhlová šablona lamel
    const be = Math.abs(p.sklon) * PI / 180, dx = Ld + 30, A = 120;
    if (p.krytina === 'lamely' && Math.abs(p.sklon) > 0 && Math.abs(p.sklon) < 90) {
      const tri = [[dx, h], [dx + A, h], [dx + A, h - A * Math.tan(be)]];
      const sk = Math.min(1, 150 / (A * Math.tan(be)));
      const T = tri.map((q) => [q[0], h - (h - q[1]) * sk]);
      const Ap = A * sk; void Ap;
      const tri2 = [[dx, h], [dx + A * sk, h], [dx + A * sk, h - A * sk * Math.tan(be)]];
      prvky.push({ t: 'l', b: tri2, z: true, v: 'rez', s: 0.4 });
      prvky.push({ t: 'txt', x: dx + 6, y: h - 3, h: 2.8, txt: `${Math.abs(p.sklon)}°`, a: 'l', v: 'dilText' });
      prvky.push({ t: 'txt', x: dx, y: h + 6, h: 2.6, txt: 'Úhlová šablona sklonu lamel (přeponu přiložte na lamelu)', a: 'l', v: 'text' });
      void T;
    }
    return { x0: -14, y0: -9, w: dx + 140, h: h + 24, prvky, nazev: 'Zakončení krokve a úhel lamel' };
  }
  const PI = Math.PI;
  /** profil rozpěrky lamel (rovnoběžník v rovině y–z), jen pro sklon 20–90° */
  function profilRozpery(S) {
    if (S.typ !== 'pergola' || S.p.krytina !== 'lamely') return null;
    const p = S.p, be = Math.abs(p.sklon) * PI / 180;
    if (Math.abs(p.sklon) < 20) return null;
    const w0 = p.roztecL - p.lamT / Math.sin(be);
    const hj = Math.max(12, Math.min(40, p.lamB * Math.sin(be) * 0.6));
    if (w0 < 6) return null;
    const dx = hj / Math.tan(be);
    return { poly: [[0, 0], [w0, 0], [w0 + dx, hj], [dx, hj]], sirka: w0, vyska: hj, tloustka: 20 };
  }

  /* ---------- plán řezů ---------- */
  function planRezu(S, o) {
    o = Object.assign({ sirka: 180, max: 6000 }, o || {});
    const k = o.sirka / o.max, prvky = [];
    let y = 0;
    for (const r of S.rezy) {
      prvky.push({ t: 'txt', x: 0, y: y + 3, h: 3, txt: `Profil ${r.klic} mm – ${r.plan.tyce.length} ks tyčí, koupeno ${fmt(r.plan.koupeno / 1000, 1)} m, využití ${fmt(r.plan.cista / Math.max(1, r.plan.koupeno) * 100)} %`, a: 'l', v: 'nadpis' });
      y += 7;
      for (const t of r.plan.tyce) {
        const w = t.delka * k;
        prvky.push({ t: 'l', b: [[0, y], [w, y], [w, y + 6], [0, y + 6]], z: true, v: 'obrys', s: 0.25 });
        let x = S.p.orez * k;
        for (const q of t.kusy) {
          const qw = q.delka * k;
          prvky.push({ t: 'p', b: [[[x, y], [x + qw, y], [x + qw, y + 6], [x, y + 6]]], v: 'vypln', f: '#f3e3c8' });
          prvky.push({ t: 'l', b: [[x, y], [x + qw, y], [x + qw, y + 6], [x, y + 6]], z: true, v: 'obrys', s: 0.2 });
          if (qw > 9) prvky.push({ t: 'txt', x: x + qw / 2, y: y + 3, h: Math.min(2.2, qw / 6), txt: `${q.oznaceni} ${fmt(q.delka)}`, a: 'c', v: 'text' });
          x += (q.delka + S.p.prorez) * k;
        }
        if (t.zbytek > 0) for (const [a, b] of srafy([[x, y], [w, y], [w, y + 6], [x, y + 6]], 1.2, 1)) prvky.push({ t: 'l', b: [a, b], v: 'srafa', s: 0.1 });
        prvky.push({ t: 'txt', x: w + 2, y: y + 3, h: 2.4, txt: `${fmt(t.delka / 1000, 0)} m${t.nadmerna ? ' (na objednávku)' : ''} · zbytek ${fmt(t.zbytek)}`, a: 'l', v: 'text' });
        y += 8.5;
      }
      y += 5;
    }
    return { x0: -2, y0: -2, w: o.sirka + 45, h: Math.max(10, y), prvky, nazev: 'Plán řezů' };
  }

  const API = { vykresy, definice, pripravPohled, vykresliPohled, zvolMeritko, sablonaSloupku, sablonaKrokve, profilRozpery, planRezu, obal, orezObdelnikem, srafy, rezDilu, MERITKA };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.ZSV = API;
})(typeof window !== 'undefined' ? window : globalThis);

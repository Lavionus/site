/* ============================================================
   puzzle_generator/jadro.js – geometrie puzzle (jigsaw) bez DOM.
   Vystaveno jako window.PUZZLE a module.exports (node testy).

   Souřadnice v mm, osa y dolů (jako SVG). Hrana = {s:[x,y], seg:[…]},
   segment ['L', x, y] nebo ['C', x1, y1, x2, y2, x, y] (kubická Bézierova).
   Každá hrana existuje jednou a sousední dílky na ni jen odkazují
   (jeden v přímém, druhý v obráceném směru) – sdílená hrana je tedy
   totožná z principu a laser ji řeže jen jednou.

     P.mrizka(n, sirka, vyska)        → {sloupce, radky} podle poměru stran
     P.generuj(o)                     → puzzle {sirka, vyska, hrany, kusy, …}
     P.retezy(p)                      → souvislé řezy (každá hrana právě jednou)
     P.svgD(p, cesta|retez, mapuj?)   → data cesty pro SVG / Path2D
     P.svgRez(p, o), P.svgRub(p, o), P.dxf(p, o)
     P.pruseciky(p)                   → dvojice hran, které se kříží (má být [])
     P.listy(sirka, vyska, papir, o)  → rozdělení na listy papíru
     P.hraNova / P.prichyt / P.hotovo → logika hry na obrazovce
   ============================================================ */
(function (koren) {
  'use strict';
  const P = {};
  const K = 0.5523;                       // řídicí body čtvrtkruhu Bézierovou křivkou
  const c3 = x => { const r = Math.round(x * 1000) / 1000; return Object.is(r, -0) ? '0' : String(r); };
  P.c3 = c3;

  /* ---------- náhoda se semínkem (opakovatelné tvary) ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash(a, b) {
    let h = (a ^ 0x9e3779b9) >>> 0;
    h = Math.imul(h ^ (b + 0x7f4a7c15), 0x85ebca6b); h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return h >>> 0;
  }
  P.rng = (seed, k) => mulberry32(hash(seed >>> 0, k || 0));

  /* ---------- mřížka z celkového počtu ---------- */
  P.mrizka = function (n, w, h) {
    n = Math.max(1, Math.round(n));
    let nej = null;
    for (let c = 1; c <= n; c++) {
      for (const r of [Math.floor(n / c), Math.ceil(n / c)]) {
        if (r < 1) continue;
        const cena = Math.abs(c * r - n) / n + 0.35 * Math.abs(Math.log((w / c) / (h / r)));
        if (!nej || cena < nej.cena) nej = { sloupce: c, radky: r, cena };
      }
    }
    return { sloupce: nej.sloupce, radky: nej.radky };
  };

  /* ---------- tvar zámku ---------- */
  // h = výška středu hlavy, n = polovina krčku, r = zaoblení u kořene (vše × poloměr hlavy s)
  P.TVARY = {
    klasicky: { nazev: 'klasický', h: 1.25, n: 0.6, r: 0.6 },
    kulaty: { nazev: 'kulatý (krátký krček)', h: 1.0, n: 0.72, r: 0.5 },
    protahly: { nazev: 'protáhlý', h: 1.55, n: 0.5, r: 0.55 },
  };
  P.WHIMSY = { kruh: 'kruh', srdce: 'srdce', hvezda: 'hvězda' };

  P.VYCHOZI = {
    sirka: 300, vyska: 200, sloupce: 6, radky: 4, druh: 'klasicke',
    tvar: 'klasicky', velikost: 0.1, nahodnost: 0.5, polomer: 0,
    whimsy: 'srdce', whimsyVel: 0.55, seed: 1,
  };

  function parametryZamku(g, o, L0) {
    const T = P.TVARY[o.tvar] || P.TVARY.klasicky, j = o.nahodnost;
    const s = o.velikost * L0 * (1 + (g() - 0.5) * 0.3 * j);
    return {
      smer: g() < 0.5 ? 1 : -1,
      c: 0.5 + (g() - 0.5) * 0.16 * j,
      s, n: s * T.n * (1 + (g() - 0.5) * 0.2 * j), r: s * T.r, h: s * T.h * (1 + (g() - 0.5) * 0.2 * j),
      t: (g() - 0.5) * 0.3 * j * s, w1: (g() - 0.5) * 0.5 * j * s, w2: (g() - 0.5) * 0.5 * j * s, f: 1,
    };
  }

  function hranaRovna(A, B) { return { s: [A[0], A[1]], seg: [['L', B[0], B[1]]] }; }

  // hrana se zámkem z A do B; z.smer = na kterou stranu (+1 = vlevo od směru A→B v osách y dolů… prostě „ven“)
  function hranaZamek(A, B, z) {
    const dx = B[0] - A[0], dy = B[1] - A[1], d = Math.hypot(dx, dy), ex = dx / d, ey = dy / d;
    const nx = -ey * z.smer, ny = ex * z.smer, f = z.f;
    const T = (u, v) => [A[0] + u * ex + v * nx, A[1] + u * ey + v * ny];
    const c = z.c * d, s = z.s * f, n = z.n * f, r = z.r * f, h = z.h * f, t = z.t * f;
    const w1 = z.w1 * f, w2 = z.w2 * f, k = (h - 0.6 * s) * 0.55, a = c - n - r, b = c + n + r, ns = 0.6 * s;
    const q = [
      [a / 3, w1, 2 * a / 3, 0, a, 0],
      [a + K * r, 0, c - n, ns * (1 - K), c - n, ns],
      [c - n, ns + k, c - s + t, h - k, c - s + t, h],
      [c - s + t, h + K * s, c + t - K * s, h + s, c + t, h + s],
      [c + t + K * s, h + s, c + s + t, h + K * s, c + s + t, h],
      [c + s + t, h - k, c + n, ns + k, c + n, ns],
      [c + n, ns * (1 - K), b - K * r, 0, b, 0],
      [b + (d - b) / 3, 0, b + 2 * (d - b) / 3, w2, d, 0],
    ];
    const seg = q.map(v => { const p1 = T(v[0], v[1]), p2 = T(v[2], v[3]), p3 = T(v[4], v[5]); return ['C', p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]]; });
    seg[seg.length - 1][5] = B[0]; seg[seg.length - 1][6] = B[1];   // konec přesně v uzlu
    return { s: [A[0], A[1]], seg };
  }

  /* ---------- práce s cestami ---------- */
  function konec(h) { const q = h.seg[h.seg.length - 1]; return q[0] === 'L' ? [q[1], q[2]] : [q[5], q[6]]; }
  P.konec = konec;
  P.obrat = function (h) {
    const body = [h.s];
    for (const q of h.seg) body.push(q[0] === 'L' ? [q[1], q[2]] : [q[5], q[6]]);
    const seg = [];
    for (let i = h.seg.length - 1; i >= 0; i--) {
      const q = h.seg[i], z = body[i];
      seg.push(q[0] === 'L' ? ['L', z[0], z[1]] : ['C', q[3], q[4], q[1], q[2], z[0], z[1]]);
    }
    return { s: body[body.length - 1].slice(), seg };
  };
  // řetěz odkazů [[idHrany, obracene], …] → jedna cesta
  P.cesta = function (p, odkazy) {
    let s = null; const seg = [];
    for (const [id, rev] of odkazy) {
      const h = rev ? P.obrat(p.hrany[id]) : p.hrany[id];
      if (!s) s = h.s.slice();
      for (const q of h.seg) seg.push(q);
    }
    return { s, seg };
  };
  // body lomené čáry; n = počet úseků na křivku
  P.body = function (h, n) {
    n = n || 10;
    const o = [[h.s[0], h.s[1]]]; let x = h.s[0], y = h.s[1];
    for (const q of h.seg) {
      if (q[0] === 'L') { o.push([q[1], q[2]]); x = q[1]; y = q[2]; continue; }
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        o.push([u * u * u * x + 3 * u * u * t * q[1] + 3 * u * t * t * q[3] + t * t * t * q[5],
          u * u * u * y + 3 * u * u * t * q[2] + 3 * u * t * t * q[4] + t * t * t * q[6]]);
      }
      x = q[5]; y = q[6];
    }
    return o;
  };
  P.plocha = function (body) {
    let a = 0;
    for (let i = 0, n = body.length; i < n; i++) { const p = body[i], q = body[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; }
    return a / 2;
  };
  function uvnitr(pt, body) {
    let v = false;
    for (let i = 0, j = body.length - 1; i < body.length; j = i++) {
      const a = body[i], b = body[j];
      if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) v = !v;
    }
    return v;
  }
  P.uvnitr = uvnitr;
  function vzdalUsecka(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
    let t = l ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  // bod hluboko uvnitř mnohoúhelníku (na číslo dílku)
  function vnitrniBod(body) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of body) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    let nej = null, nd = -1; const N = 16;
    for (let i = 1; i < N; i++) for (let j = 1; j < N; j++) {
      const pt = [x0 + (x1 - x0) * i / N, y0 + (y1 - y0) * j / N];
      if (!uvnitr(pt, body)) continue;
      let d = Infinity;
      for (let k = 0; k < body.length; k++) d = Math.min(d, vzdalUsecka(pt, body[k], body[(k + 1) % body.length]));
      if (d > nd) { nd = d; nej = pt; }
    }
    return nej || [(x0 + x1) / 2, (y0 + y1) / 2];
  }

  /* ---------- tvar „whimsy“ (lomená čára po směru hodin na obrazovce) ---------- */
  function tvarWhimsy(druh, cx, cy, R) {
    const o = [], N = 240;
    for (let k = 0; k < N; k++) {
      const t = 2 * Math.PI * (k + 0.5) / N;
      if (druh === 'srdce') {
        const x = 16 * Math.pow(Math.sin(t), 3), y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        o.push([cx + x * R / 16, cy + (y - 2.5) * R / 16]);
      } else if (druh === 'hvezda') {
        const cipu = 5, u = t * cipu / Math.PI;                         // 2·cipů úseků po obvodu
        const i = Math.floor(u), f = u - i, r0 = i % 2 ? 0.48 : 1, r1 = i % 2 ? 1 : 0.48;
        const a0 = i * Math.PI / cipu - Math.PI / 2, a1 = (i + 1) * Math.PI / cipu - Math.PI / 2;
        const p0 = [r0 * Math.cos(a0), r0 * Math.sin(a0)], p1 = [r1 * Math.cos(a1), r1 * Math.sin(a1)];
        o.push([cx + R * (p0[0] + (p1[0] - p0[0]) * f), cy + R * (p0[1] + (p1[1] - p0[1]) * f) + R * 0.08]);
      } else o.push([cx + R * Math.cos(t), cy + R * Math.sin(t)]);
    }
    return o;
  }
  // první průsečík paprsku z P směrem k Q s uzavřenou lomenou čarou → {i, f, bod}
  function paprsek(P0, Q, body) {
    const dx = Q[0] - P0[0], dy = Q[1] - P0[1]; let nej = null;
    for (let i = 0; i < body.length; i++) {
      const a = body[i], b = body[(i + 1) % body.length];
      const ex = b[0] - a[0], ey = b[1] - a[1], den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      const t = ((a[0] - P0[0]) * ey - (a[1] - P0[1]) * ex) / den, u = ((a[0] - P0[0]) * dy - (a[1] - P0[1]) * dx) / den;
      if (t > 1e-9 && u >= 0 && u < 1 && (!nej || t < nej.t)) nej = { t, i, f: u, bod: [a[0] + u * ex, a[1] + u * ey] };
    }
    return nej;
  }

  /* ---------- generování ---------- */
  P.generuj = function (vstup) {
    const o = Object.assign({}, P.VYCHOZI, vstup || {});
    const ctverce = o.druh === 'ctverce';
    if (ctverce) { o.sloupce = Math.max(2, Math.min(4, o.sloupce)); o.radky = Math.max(2, Math.min(4, o.radky)); }
    o.sloupce = Math.max(1, Math.round(o.sloupce)); o.radky = Math.max(1, Math.round(o.radky));
    const W = +o.sirka, H = +o.vyska, C = o.sloupce, R = o.radky, cw = W / C, ch = H / R, L0 = Math.min(cw, ch);
    const j = ctverce ? 0 : Math.max(0, Math.min(1, +o.nahodnost));
    const oo = Object.assign({}, o, { nahodnost: j });
    const Rr = Math.max(0, Math.min(+o.polomer || 0, 0.45 * L0));
    const whimsy = o.druh === 'whimsy' && C >= 2 && R >= 2;
    const ci = Math.floor(C / 2), cj = Math.floor(R / 2);

    // uzly mřížky (vnitřní posunuté, okrajové jen podél okraje)
    const U = [];
    for (let y = 0; y <= R; y++) {
      const radek = [];
      for (let x = 0; x <= C; x++) {
        const g = P.rng(o.seed, 1000000 + y * (C + 1) + x);
        const jx = (g() - 0.5) * 2 * 0.07 * j * cw, jy = (g() - 0.5) * 2 * 0.07 * j * ch;
        let px = x * cw, py = y * ch;
        if (x > 0 && x < C) px += jx;
        if (y > 0 && y < R) py += jy;
        if (whimsy && x === ci && y === cj) { px = x * cw; py = y * ch; }
        radek.push([px, py]);
      }
      U.push(radek);
    }

    const hrany = [];
    const pridej = (h, druh, zam, A, B, klic) => { Object.assign(h, { id: hrany.length, druh, zam: zam || null, A, B, klic, kusy: [] }); hrany.push(h); return h.id; };
    const Hh = [], Vv = [];
    for (let y = 0; y <= R; y++) {
      Hh.push([]);
      for (let x = 0; x < C; x++) {
        let A = U[y][x], B = U[y][x + 1];
        const okraj = y === 0 || y === R;
        if (okraj && Rr > 0) { if (x === 0) A = [Rr, A[1]]; if (x === C - 1) B = [W - Rr, B[1]]; }
        if (okraj || ctverce) Hh[y].push(pridej(hranaRovna(A, B), okraj ? 'okraj' : 'vnitrni', null, A, B));
        else { const z = parametryZamku(P.rng(o.seed, y * C + x), oo, L0); Hh[y].push(pridej(hranaZamek(A, B, z), 'vnitrni', z, A, B)); }
      }
    }
    for (let y = 0; y < R; y++) {
      Vv.push([]);
      for (let x = 0; x <= C; x++) {
        let A = U[y][x], B = U[y + 1][x];
        const okraj = x === 0 || x === C;
        if (okraj && Rr > 0) { if (y === 0) A = [A[0], Rr]; if (y === R - 1) B = [B[0], H - Rr]; }
        if (okraj || ctverce) Vv[y].push(pridej(hranaRovna(A, B), okraj ? 'okraj' : 'vnitrni', null, A, B));
        else { const z = parametryZamku(P.rng(o.seed, 500000 + y * (C + 1) + x), oo, L0); Vv[y].push(pridej(hranaZamek(A, B, z), 'vnitrni', z, A, B)); }
      }
    }
    // zaoblené rohy obrysu (po směru hodin)
    const rohy = {};
    if (Rr > 0) {
      const k = Rr * (1 - K), oblouk = (A, c1, c2, B) => ({ s: A, seg: [['C', c1[0], c1[1], c2[0], c2[1], B[0], B[1]]] });
      rohy.tl = pridej(oblouk([0, Rr], [0, k], [k, 0], [Rr, 0]), 'okraj', null, [0, Rr], [Rr, 0]);
      rohy.tr = pridej(oblouk([W - Rr, 0], [W - k, 0], [W, k], [W, Rr]), 'okraj', null, [W - Rr, 0], [W, Rr]);
      rohy.br = pridej(oblouk([W, H - Rr], [W, H - k], [W - k, H], [W - Rr, H]), 'okraj', null, [W, H - Rr], [W - Rr, H]);
      rohy.bl = pridej(oblouk([Rr, H], [k, H], [0, H - k], [0, H - Rr]), 'okraj', null, [Rr, H], [0, H - Rr]);
    }

    // whimsy: 4 vnitřní hrany kolem středového uzlu nahradí rovné úsečky k tvaru
    let wh = null;
    if (whimsy) {
      const Pc = U[cj][ci], Rw = Math.max(0.2, Math.min(0.75, +o.whimsyVel)) * L0;
      const obrys = tvarWhimsy(o.whimsy, Pc[0], Pc[1], Rw);
      const Q = { U: U[cj - 1][ci], R: U[cj][ci + 1], D: U[cj + 1][ci], L: U[cj][ci - 1] };
      const X = {}; let ok = true;
      for (const k of 'URDL') { X[k] = paprsek(Pc, Q[k], obrys); if (!X[k]) ok = false; }
      const poradi = ok ? 'RDLU'.split('').sort((a, b) => (X[a].i + X[a].f) - (X[b].i + X[b].f)).join('') : '';
      if (ok && ('RDLURDLU').includes(poradi)) {
        const oblouk = (a, b) => {
          const xa = X[a], xb = X[b], body = [];
          let i = (xa.i + 1) % obrys.length;
          const stop = (xb.i + 1) % obrys.length;
          while (i !== stop) { body.push(obrys[i]); i = (i + 1) % obrys.length; }
          return { s: xa.bod.slice(), seg: body.map(p => ['L', p[0], p[1]]).concat([['L', xb.bod[0], xb.bod[1]]]) };
        };
        wh = {
          eU: pridej(hranaRovna(Q.U, X.U.bod), 'vnitrni', null, Q.U, X.U.bod),
          eR: pridej(hranaRovna(X.R.bod, Q.R), 'vnitrni', null, X.R.bod, Q.R),
          eD: pridej(hranaRovna(X.D.bod, Q.D), 'vnitrni', null, X.D.bod, Q.D),
          eL: pridej(hranaRovna(Q.L, X.L.bod), 'vnitrni', null, Q.L, X.L.bod),
          aRD: pridej(oblouk('R', 'D'), 'whimsy'), aDL: pridej(oblouk('D', 'L'), 'whimsy'),
          aLU: pridej(oblouk('L', 'U'), 'whimsy'), aUR: pridej(oblouk('U', 'R'), 'whimsy'),
          stred: Pc.slice(), tvar: o.whimsy,
        };
        // původní 4 hrany zůstanou v poli, ale přestanou se používat
        for (const id of [Vv[cj - 1][ci], Vv[cj][ci], Hh[cj][ci - 1], Hh[cj][ci]]) hrany[id].nepouzita = true;
      }
    }

    // dílky: obrys po směru hodin – nahoře, vpravo, dole, vlevo
    const kusy = [];
    const pridejKus = (obrys, bunka, stred) => { const id = kusy.length; kusy.push({ id, cislo: id + 1, obrys, bunka, stred }); for (const [h] of obrys) hrany[h].kusy.push(id); };
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
      let top = [[Hh[y][x], false]], right = [[Vv[y][x + 1], false]], bottom = [[Hh[y + 1][x], true]], left = [[Vv[y][x], true]];
      if (wh) {
        if (x === ci - 1 && y === cj - 1) { right = [[wh.eU, false], [wh.aLU, true]]; bottom = [[wh.eL, true]]; }
        if (x === ci && y === cj - 1) { bottom = [[wh.eR, true], [wh.aUR, true]]; left = [[wh.eU, true]]; }
        if (x === ci && y === cj) { top = [[wh.eR, false]]; left = [[wh.eD, true], [wh.aRD, true]]; }
        if (x === ci - 1 && y === cj) { top = [[wh.eL, false], [wh.aDL, true]]; right = [[wh.eD, false]]; }
      }
      const obrys = top.concat(right, bottom, left);
      if (Rr > 0) {   // oblouk rohu vložit mezi strany
        if (x === C - 1 && y === R - 1) obrys.splice(obrys.length - left.length - bottom.length, 0, [rohy.br, false]);
        if (x === 0 && y === R - 1) obrys.splice(obrys.length - left.length, 0, [rohy.bl, false]);
        if (x === C - 1 && y === 0) obrys.splice(top.length, 0, [rohy.tr, false]);
        if (x === 0 && y === 0) obrys.push([rohy.tl, false]);
      }
      const u = [U[y][x], U[y][x + 1], U[y + 1][x + 1], U[y + 1][x]];
      pridejKus(obrys, [x, y], [(u[0][0] + u[1][0] + u[2][0] + u[3][0]) / 4, (u[0][1] + u[1][1] + u[2][1] + u[3][1]) / 4]);
    }
    if (wh) pridejKus([[wh.aRD, false], [wh.aDL, false], [wh.aLU, false], [wh.aUR, false]], null, [wh.stred[0], wh.stred[1] + (o.whimsy === 'srdce' ? 0.1 : 0) * L0]);

    const p = { o, sirka: W, vyska: H, sloupce: C, radky: R, cw, ch, L0, polomer: Rr, uzly: U, hrany, kusy, whimsy: wh };
    opravKolize(p);
    if (wh) for (const k of kusy) if (k.bunka && Math.abs(k.bunka[0] - ci + 0.5) < 1 && Math.abs(k.bunka[1] - cj + 0.5) < 1) k.stred = vnitrniBod(P.body(P.cesta(p, k.obrys), 6));
    return p;
  };

  // hrany, které se kříží, zmenšují zámky (max. 8 kol)
  function opravKolize(p) {
    const vule = Math.max(0.3, 0.025 * p.L0);   // minimální mezera mezi řezy (mm)
    for (let kolo = 0; kolo < 8; kolo++) {
      const kol = P.pruseciky(p, 12, vule);
      p.kolize = kol.length;
      if (!kol.length) return;
      const zmen = new Set();
      for (const [a, b] of kol) {
        const ha = p.hrany[a], hb = p.hrany[b];
        const kandidat = !ha.zam ? hb : !hb.zam ? ha : (ha.zam.s * ha.zam.f >= hb.zam.s * hb.zam.f ? ha : hb);
        if (kandidat.zam) zmen.add(kandidat.id);
      }
      if (!zmen.size) return;
      for (const id of zmen) {
        const h = p.hrany[id]; h.zam.f *= 0.85;
        if (h.zam.f < 0.35) { Object.assign(h, hranaRovna(h.A, h.B)); h.zam = null; continue; }
        const n = hranaZamek(h.A, h.B, h.zam); h.s = n.s; h.seg = n.seg;
      }
    }
    p.kolize = P.pruseciky(p, 12, vule).length;
  }

  /* ---------- průsečíky hran (kontrola, že se zámky nepřekrývají) ----------
     vule > 0: za kolizi se počítá i přiblížení na méně než vule mm (kromě okolí společného uzlu) */
  function protinaji(a, b, c, d) {
    const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
    if (Math.abs(den) < 1e-12) return false;
    const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + t * r[0], a[1] + t * r[1]] : false;
  }
  const vzdalUsecek = (a, b, c, d) => protinaji(a, b, c, d) ? 0 : Math.min(vzdalUsecka(a, c, d), vzdalUsecka(b, c, d), vzdalUsecka(c, a, b), vzdalUsecka(d, a, b));
  const bbox = body => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of body) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; };
  // body hrany; rovné úseky rozdělit, aby šlo poznat okolí uzlu
  function bodyKontrola(h, n, krok) {
    const b = P.body(h, n), o = [b[0]];
    for (let i = 1; i < b.length; i++) {
      const a = b[i - 1], c = b[i], k = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) / krok));
      for (let j = 1; j <= k; j++) o.push([a[0] + (c[0] - a[0]) * j / k, a[1] + (c[1] - a[1]) * j / k]);
    }
    return o;
  }
  P.pruseciky = function (p, n, vule) {
    vule = vule || 0;
    const L0 = p.L0 || 10, krok = L0 / 10;
    const hr = p.hrany.filter(h => !h.nepouzita);
    const data = hr.map(h => { const b = bodyKontrola(h, n || 12, krok); return { h, b, bb: bbox(b), kraje: [b[0], b[b.length - 1]] }; });
    data.sort((a, b) => a.bb[0] - b.bb[0]);
    const vysl = [], eps = 1e-6 + vule, okoli = 3 * vule + 1.5 * krok;
    for (let i = 0; i < data.length; i++) {
      const A = data[i];
      for (let k = i + 1; k < data.length && data[k].bb[0] <= A.bb[2] + eps; k++) {
        const B = data[k];
        if (B.bb[1] > A.bb[3] + eps || B.bb[3] < A.bb[1] - eps) continue;
        const ox0 = Math.max(A.bb[0], B.bb[0]) - eps, oy0 = Math.max(A.bb[1], B.bb[1]) - eps, ox1 = Math.min(A.bb[2], B.bb[2]) + eps, oy1 = Math.min(A.bb[3], B.bb[3]) + eps;
        const vyber = b => { const o = []; for (let q = 0; q + 1 < b.length; q++) { const u = b[q], v = b[q + 1]; if (Math.max(u[0], v[0]) >= ox0 && Math.min(u[0], v[0]) <= ox1 && Math.max(u[1], v[1]) >= oy0 && Math.min(u[1], v[1]) <= oy1) o.push(q); } return o; };
        const sa = vyber(A.b), sb = vyber(B.b);
        const uzly = A.kraje.filter(x => B.kraje.some(y => Math.hypot(x[0] - y[0], x[1] - y[1]) < 1e-6));
        const uUzlu = (u, v) => uzly.some(K => Math.min(Math.hypot(u[0] - K[0], u[1] - K[1]), Math.hypot(v[0] - K[0], v[1] - K[1])) < okoli);
        const vUzlu = pt => uzly.some(K => Math.hypot(K[0] - pt[0], K[1] - pt[1]) < 1e-6);
        let nasel = false;
        for (const qa of sa) {
          for (const qb of sb) {
            const a1 = A.b[qa], a2 = A.b[qa + 1], b1 = B.b[qb], b2 = B.b[qb + 1];
            const x = protinaji(a1, a2, b1, b2);
            if (x && !vUzlu(x)) { nasel = true; break; }
            if (vule > 0 && vzdalUsecek(a1, a2, b1, b2) < vule && !(uUzlu(a1, a2) && uUzlu(b1, b2))) { nasel = true; break; }
          }
          if (nasel) break;
        }
        if (nasel) vysl.push([A.h.id, B.h.id]);
      }
    }
    return vysl;
  };

  /* ---------- souvislé řezy: každá hrana právě jednou ---------- */
  const klic = pt => Math.round(pt[0] * 1e4) + ',' + Math.round(pt[1] * 1e4);
  P.retezy = function (p) {
    const pouzite = p.hrany.map(h => !!h.nepouzita), uzly = new Map();
    const pripoj = (pt, id) => { const k = klic(pt); if (!uzly.has(k)) uzly.set(k, []); uzly.get(k).push(id); };
    for (const h of p.hrany) if (!h.nepouzita) { pripoj(h.s, h.id); pripoj(konec(h), h.id); }
    const smer = (h, rev) => { const a = rev ? konec(h) : h.s, b = rev ? h.s : konec(h), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
    const vysl = [];
    for (const h0 of p.hrany) {
      if (pouzite[h0.id]) continue;
      pouzite[h0.id] = true;
      const ret = [[h0.id, false]];
      // prodlužovat dopředu, nejrovnějším pokračováním
      for (;;) {
        const [id, rev] = ret[ret.length - 1], h = p.hrany[id], kon = rev ? h.s : konec(h), sm = smer(h, rev);
        let nej = null, nd = -Infinity;
        for (const kid of uzly.get(klic(kon)) || []) {
          if (pouzite[kid]) continue;
          const kh = p.hrany[kid], r2 = klic(kh.s) !== klic(kon), s2 = smer(kh, r2), dot = sm[0] * s2[0] + sm[1] * s2[1];
          if (dot > nd) { nd = dot; nej = [kid, r2]; }
        }
        if (!nej) break;
        pouzite[nej[0]] = true; ret.push(nej);
      }
      const a = P.cesta(p, ret);
      vysl.push({ odkazy: ret, uzavreny: klic(a.s) === klic(konec(a)) });
    }
    return vysl;
  };

  /* ---------- SVG ---------- */
  P.svgD = function (p, cesta, mapuj) {
    const m = mapuj || ((x, y) => [x, y]);
    const v = (x, y) => { const q = m(x, y); return c3(q[0]) + ' ' + c3(q[1]); };
    let s = 'M' + v(cesta.s[0], cesta.s[1]);
    for (const q of cesta.seg) s += q[0] === 'L' ? 'L' + v(q[1], q[2]) : 'C' + v(q[1], q[2]) + ' ' + v(q[3], q[4]) + ' ' + v(q[5], q[6]);
    return s;
  };
  P.svgDRetez = function (p, r, mapuj) { return P.svgD(p, P.cesta(p, r.odkazy), mapuj) + (r.uzavreny ? 'Z' : ''); };
  P.svgDKus = function (p, k, mapuj) { return P.svgD(p, P.cesta(p, p.kusy[k].obrys), mapuj) + 'Z'; };

  P.PRESETY_LASER = {
    vlasova: { nazev: 'Laser – vlasová čára (červená 0,01 mm)', barva: '#ff0000', tloustka: 0.01 },
    lightburn: { nazev: 'Laser LightBurn / RDWorks (červená 0,1 mm)', barva: '#ff0000', tloustka: 0.1 },
    plotter: { nazev: 'Řezací plotter / Cricut (černá 0,25 mm)', barva: '#000000', tloustka: 0.25 },
  };

  const esc = s => String(s).replace(/[<&"]/g, ch => ({ '<': '&lt;', '&': '&amp;', '"': '&quot;' }[ch]));
  function hlavicka(p, okraj, popis) {
    const w = p.sirka + 2 * okraj, h = p.vyska + 2 * okraj;
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${c3(w)}mm" height="${c3(h)}mm" viewBox="0 0 ${c3(w)} ${c3(h)}">\n<!-- ${esc(popis)} -->\n`;
  }
  // velikost písma čísel v mm
  P.vyskaCisla = p => Math.max(2, Math.min(14, p.L0 * 0.28));

  // o = {barva, tloustka, cisla: bool, barvaCisel, okraj}
  P.svgRez = function (p, o) {
    o = Object.assign({ barva: '#ff0000', tloustka: 0.01, cisla: false, barvaCisel: '#0000ff', okraj: 1 }, o || {});
    const m = (x, y) => [x + o.okraj, y + o.okraj], R = P.retezy(p);
    let s = hlavicka(p, o.okraj, `Puzzle ${p.kusy.length} dílků, ${c3(p.sirka)} × ${c3(p.vyska)} mm, 1:1 v mm; ${R.length} souvislých řezů, každá hrana jen jednou`);
    s += `<g id="rez" fill="none" stroke="${o.barva}" stroke-width="${c3(o.tloustka)}" stroke-linecap="round" stroke-linejoin="round">\n`;
    for (const r of R) s += `<path d="${P.svgDRetez(p, r, m)}"/>\n`;
    s += '</g>\n';
    if (o.cisla) s += cislaSvg(p, (x, y) => m(x, y), o.barvaCisel);
    return s + '</svg>\n';
  };
  function cislaSvg(p, m, barva) {
    const v = P.vyskaCisla(p);
    let s = `<g id="cisla" fill="${barva}" font-family="Arial, Helvetica, sans-serif" font-size="${c3(v)}" text-anchor="middle" dominant-baseline="central">\n`;
    for (const k of p.kusy) { const q = m(k.stred[0], k.stred[1]); s += `<text x="${c3(q[0])}" y="${c3(q[1])}">${k.cislo}</text>\n`; }
    return s + '</g>\n';
  }
  // rub: zrcadlené rozmístění (čísla čitelná), obrys jen pro zarovnání
  P.svgRub = function (p, o) {
    o = Object.assign({ barvaCisel: '#0000ff', barvaObrysu: '#00a000', okraj: 1 }, o || {});
    const m = (x, y) => [p.sirka - x + o.okraj, y + o.okraj];
    let s = hlavicka(p, o.okraj, 'Rub puzzle – zrcadlené rozmístění čísel dílků (gravírovat/tisknout na zadní stranu), zelený obrys = jen zarovnání, neřezat');
    const obrys = P.retezy(p).filter(r => r.odkazy.every(([id]) => p.hrany[id].druh === 'okraj'));
    s += `<g id="zarovnani" fill="none" stroke="${o.barvaObrysu}" stroke-width="0.1">\n`;
    for (const r of obrys) s += `<path d="${P.svgDRetez(p, r, m)}"/>\n`;
    s += '</g>\n' + cislaSvg(p, m, o.barvaCisel);
    return s + '</svg>\n';
  };

  /* ---------- DXF R12, mm, osa y nahoru ---------- */
  P.dxf = function (p, o) {
    o = Object.assign({ cisla: false, krivka: 16 }, o || {});
    const r = [], q = (k, v) => { r.push(String(k)); r.push(String(v)); };
    q(0, 'SECTION'); q(2, 'HEADER'); q(9, '$ACADVER'); q(1, 'AC1009'); q(9, '$INSUNITS'); q(70, 4);
    q(9, '$EXTMIN'); q(10, 0); q(20, 0); q(30, 0); q(9, '$EXTMAX'); q(10, c3(p.sirka)); q(20, c3(p.vyska)); q(30, 0);
    q(0, 'ENDSEC');
    q(0, 'SECTION'); q(2, 'TABLES'); q(0, 'TABLE'); q(2, 'LAYER'); q(70, 2);
    q(0, 'LAYER'); q(2, 'REZ'); q(70, 0); q(62, 1); q(6, 'CONTINUOUS');
    q(0, 'LAYER'); q(2, 'CISLA'); q(70, 0); q(62, 5); q(6, 'CONTINUOUS');
    q(0, 'ENDTAB'); q(0, 'ENDSEC');
    q(0, 'SECTION'); q(2, 'ENTITIES');
    for (const ret of P.retezy(p)) {
      const b = P.body(P.cesta(p, ret.odkazy), o.krivka);
      if (ret.uzavreny) b.pop();
      q(0, 'POLYLINE'); q(8, 'REZ'); q(66, 1); q(10, 0); q(20, 0); q(30, 0); q(70, ret.uzavreny ? 1 : 0);
      for (const [x, y] of b) { q(0, 'VERTEX'); q(8, 'REZ'); q(10, c3(x)); q(20, c3(p.vyska - y)); q(30, 0); }
      q(0, 'SEQEND'); q(8, 'REZ');
    }
    if (o.cisla) {
      const v = P.vyskaCisla(p);
      for (const k of p.kusy) {
        const x = c3(k.stred[0]), y = c3(p.vyska - k.stred[1]);
        q(0, 'TEXT'); q(8, 'CISLA'); q(10, x); q(20, y); q(30, 0); q(40, c3(v)); q(1, k.cislo); q(72, 1); q(11, x); q(21, y); q(31, 0); q(73, 2);
      }
    }
    q(0, 'ENDSEC'); q(0, 'EOF');
    return r.join('\n') + '\n';
  };

  /* ---------- rozdělení na listy papíru (bez překryvu – listy se oříznou podle značek a přiloží) ---------- */
  P.listy = function (sirka, vyska, papir, o) {
    o = o || {};
    const okraj = o.okraj == null ? 10 : o.okraj;
    const zkus = (pw, ph) => {
      const pole = { w: pw - 2 * okraj, h: ph - 2 * okraj };
      const sloupcu = Math.max(1, Math.ceil(sirka / pole.w - 1e-9)), radku = Math.max(1, Math.ceil(vyska / pole.h - 1e-9));
      const listy = [];
      for (let j = 0; j < radku; j++) for (let i = 0; i < sloupcu; i++) {
        const x = i * pole.w, y = j * pole.h;
        listy.push({ i, j, x, y, w: Math.min(pole.w, sirka - x), h: Math.min(pole.h, vyska - y), oznaceni: String.fromCharCode(65 + (j % 26)) + (i + 1) });
      }
      return { papir: { w: pw, h: ph }, pole, sloupcu, radku, listy, okraj };
    };
    const na = zkus(papir.w, papir.h), ps = zkus(papir.h, papir.w);
    if (o.orientace === 'na_vysku') return na;
    if (o.orientace === 'na_sirku') return ps;
    return ps.listy.length < na.listy.length ? ps : na;
  };

  /* ---------- rozlišení fotky ---------- */
  P.dpi = (px, mm) => mm > 0 ? px / (mm / 25.4) : 0;
  P.hodnotDpi = d => d >= 240 ? 'dobre' : d >= 150 ? 'pozor' : 'zle';
  // výřez obrázku iw×ih na poměr stran `pomer` (= šířka/výška), zoom ≥ 1, střed cx, cy v 0..1
  P.vyrez = function (iw, ih, pomer, zoom, cx, cy) {
    let w = iw, h = iw / pomer;
    if (h > ih) { h = ih; w = ih * pomer; }
    zoom = Math.max(1, zoom || 1); w /= zoom; h /= zoom;
    const x = Math.max(0, Math.min(iw - w, (cx == null ? 0.5 : cx) * iw - w / 2));
    const y = Math.max(0, Math.min(ih - h, (cy == null ? 0.5 : cy) * ih - h / 2));
    return { x, y, w, h };
  };

  /* ---------- hra na obrazovce ---------- */
  P.sousede = function (p) {
    const s = p.kusy.map(() => new Set());
    for (const h of p.hrany) if (h.kusy.length === 2) { s[h.kusy[0]].add(h.kusy[1]); s[h.kusy[1]].add(h.kusy[0]); }
    return s.map(x => [...x]);
  };
  // volná místa kolem desky (mřížka mimo desku, zamíchaná); n = kolik jich je potřeba
  P.rozmisteni = function (p, n, seed) {
    const g = P.rng(seed || 7, 99), W = p.sirka, H = p.vyska, krok = 1.3 * Math.max(p.cw, p.ch), m = 0.75 * Math.max(p.cw, p.ch);
    let rozsah = 0.5, mista = [];
    while (rozsah < 6) {      // okolí desky se zvětšuje, dokud se dílky nevejdou
      mista = [];
      const x0 = -rozsah * W, x1 = W + rozsah * W, y0 = -rozsah * 0.6 * H, y1 = H + rozsah * 0.6 * H;
      for (let y = y0 + krok / 2; y < y1; y += krok) for (let x = x0 + krok / 2; x < x1; x += krok)
        if (x < -m || x > W + m || y < -m || y > H + m) mista.push([x, y]);
      if (mista.length >= n) break;
      rozsah += 0.25;
    }
    for (let i = mista.length - 1; i > 0; i--) { const j = Math.floor(g() * (i + 1)); [mista[i], mista[j]] = [mista[j], mista[i]]; }
    return mista.slice(0, n).map(([x, y]) => [x + (g() - 0.5) * krok * 0.2, y + (g() - 0.5) * krok * 0.2]);
  };
  // rozházet dílky kolem desky; offset = posun proti správnému místu
  P.hraNova = function (p, seed) {
    const mista = P.rozmisteni(p, p.kusy.length, seed);
    const kusy = p.kusy.map((k, i) => ({ ox: mista[i][0] - k.stred[0], oy: mista[i][1] - k.stred[1], g: i, z: i }));
    return { kusy, cas: 0, tahu: 0, verze: 1 };
  };
  P.skupina = (hra, g) => { const o = []; hra.kusy.forEach((k, i) => { if (k.g === g) o.push(i); }); return o; };
  P.pevna = (hra, g) => { const i = hra.kusy.findIndex(k => k.g === g); return i >= 0 && hra.kusy[i].ox === 0 && hra.kusy[i].oy === 0; };
  // po puštění skupiny g: přichytit k sousedům a k desce; tol v mm
  P.prichyt = function (hra, p, sousede, g, tol) {
    let spojeni = 0, zmena = true;
    while (zmena) {
      zmena = false;
      for (const a of P.skupina(hra, g)) {
        const ka = hra.kusy[a];
        for (const b of sousede[a]) {
          const kb = hra.kusy[b];
          if (kb.g === g) continue;
          const dx = kb.ox - ka.ox, dy = kb.oy - ka.oy;
          if (Math.hypot(dx, dy) > tol) continue;
          const nova = kb.g;
          for (const k of hra.kusy) if (k.g === g) { k.ox = kb.ox; k.oy = kb.oy; k.g = nova; }
          g = nova; spojeni++; zmena = true;
          break;
        }
        if (zmena) break;
      }
    }
    const kus = hra.kusy.find(k => k.g === g);
    let deska = false;
    if (kus && Math.hypot(kus.ox, kus.oy) <= tol) {
      for (const k of hra.kusy) if (k.g === g) { k.ox = 0; k.oy = 0; }
      deska = true;
    }
    return { g, spojeni, deska };
  };
  P.hotovo = hra => hra.kusy.every(k => k.g === hra.kusy[0].g);
  P.naMiste = hra => hra.kusy.filter(k => k.ox === 0 && k.oy === 0).length;

  if (typeof module !== 'undefined' && module.exports) module.exports = P;
  else koren.PUZZLE = P;
})(typeof window !== 'undefined' ? window : globalThis);

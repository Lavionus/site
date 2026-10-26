/* ============================================================
   Barefoot vložky – porovnání levé a pravé nohy, rozvržení vložek na arch materiálu.
   Vstup: výsledek BFJ.spocitej / BFC.sestav (nohy: vlozka, noha, Wt, Lt, perf…; y nahoru).
   Výstup rozvržení: scéna jako BFV.scena (mm, y dolů) → SVG/DXF přes BFV.
   ============================================================ */
(function (koren) {
  'use strict';
  const uzel = typeof module !== 'undefined' && module.exports;
  const J = koren.BFJ || (uzel ? require('./jadro.js') : null);
  const CL = koren.ClipperLib || (uzel ? require('../lib/clipper.min.js') : null);

  /* ---------- porovnání L/P ---------- */
  /* obrys na patu: spodek y = 0, střed paty (10 % délky) x = 0 */
  function naPatu(P) {
    const o = J.obalka(P), r = J.rezNaY(P, o.y0 + 0.1 * o.h), cx = r ? (r[0] + r[1]) / 2 : (o.x0 + o.x1) / 2;
    return P.map(([x, y]) => [x - cx, y - o.y0]);
  }
  const SC = 1000;
  const doC = (P) => P.map(([x, y]) => ({ X: Math.round(x * SC), Y: Math.round(y * SC) }));
  function operace(typ, A, B) {
    const c = new CL.Clipper(), r = new CL.Paths();
    c.AddPath(doC(A), CL.PolyType.ptSubject, true); c.AddPath(doC(B), CL.PolyType.ptClip, true);
    c.Execute(typ, r, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
    return r.map((q) => q.map((p) => [p.X / SC, p.Y / SC])).filter((q) => q.length > 2);
  }
  const plochaVse = (L) => L.reduce((s, q) => s + Math.abs(J.plocha(q)), 0);
  /* největší vzdálenost bodu A ležícího mimo B od obrysu B (= o kolik A přesahuje B) */
  function presah(A, B) {
    let m = { d: 0, q: null };
    for (let i = 0; i < A.length; i += 2) { const [x, y] = A[i]; if (J.bodVPolygonu(B, x, y)) continue; const d = J.vzdalenostKObrysu(B, x, y); if (d > m.d) m = { d, q: A[i] }; }
    return m;
  }
  /* porovnání dvou obrysů přiložených patou; zrcA = zrcadlit A (levá přes pravou) */
  function porovnejNohy(nA, nB, co, zrcA) {
    const a = naPatu(zrcA ? J.zrcadli(nA[co], nA.Wt) : nA[co]), b = naPatu(nB[co]);
    const ra = J.rozmery(a), rb = J.rozmery(b);
    const aMinusB = operace(CL.ClipType.ctDifference, a, b), bMinusA = operace(CL.ClipType.ctDifference, b, a);
    const pa = presah(a, b), pb = presah(b, a), max = pa.d > pb.d ? pa : pb;
    return {
      a, b, aMinusB, bMinusA, xor: aMinusB.concat(bMinusA), ra, rb, max, presahA: pa, presahB: pb,
      plochaA: plochaVse(aMinusB), plochaB: plochaVse(bMinusA), plochaRozdilu: plochaVse(aMinusB) + plochaVse(bMinusA),
      rozdil: { delka: ra.delka - rb.delka, sirka: ra.sirka - rb.sirka, pata: ra.pata - rb.pata, plocha: ra.plocha - rb.plocha },
    };
  }
  /* levá zrcadlená přes pravou */
  function porovnej(v, co) {
    const L = v.nohy.find((n) => n.strana === 'L'), P = v.nohy.find((n) => n.strana === 'P');
    return L && P ? porovnejNohy(L, P, co, true) : null;
  }
  function svgPorovnani(r) {
    const o = J.obalka(r.a.concat(r.b)), k = 6, x0 = o.x0 - k, y1 = o.y1 + k, w = o.w + 2 * k, h = o.h + 2 * k;
    const d = (P) => 'M' + P.map(([x, y]) => (x - x0).toFixed(2) + ' ' + (y1 - y).toFixed(2)).join('L') + 'Z';
    const kr = r.max.q ? `<circle cx="${(r.max.q[0] - x0).toFixed(2)}" cy="${(y1 - r.max.q[1]).toFixed(2)}" r="3.5" fill="none" stroke="#000" stroke-width=".6"/>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}" role="img" aria-label="Porovnání obrysů přiložených patou">` +
      `<path d="${r.aMinusB.map(d).join('')}" fill="#c0392b" fill-opacity=".45"/>` +
      `<path d="${r.bMinusA.map(d).join('')}" fill="#1e9e4a" fill-opacity=".4"/>` +
      `<path d="${d(r.b)}" fill="none" stroke="#1f5fa8" stroke-width=".7"/>` +
      `<path d="${d(r.a)}" fill="none" stroke="#c0392b" stroke-width=".7" stroke-dasharray="3 2"/>${kr}</svg>`;
  }

  /* ---------- rozvržení na arch ---------- */
  /* kus v místních souřadnicích (y dolů, 0..Lt), otočení o 180°; profil levé/pravé hrany po 1 mm */
  function kus(n, otoc) {
    const tr = otoc ? ([x, y]) => [n.Wt - x, y] : ([x, y]) => [x, n.Lt - y];
    const P = n.vlozka.map(tr), H = Math.ceil(n.Lt), l = new Float64Array(H).fill(NaN), r = new Float64Array(H).fill(NaN);
    for (let i = 0; i < H; i++) { const q = J.rezNaY(P, Math.min(n.Lt - 0.01, i + 0.5)); if (q) { l[i] = q[0]; r[i] = q[1]; } }
    /* krajní 1mm pásy: rez středem pásu mine špičku/patu – vzít obálku bodů v pásu */
    for (const [x, y] of P) { const i = Math.min(H - 1, Math.max(0, Math.floor(y))); if (!(x >= l[i])) l[i] = x; if (!(x <= r[i])) r[i] = x; }
    return { n, otoc, tr, l, r, H };
  }
  /* řady kusů v obdélníku W × H od y0 (místní souřadnice); typAt(i) → [kus, kus otočený] nebo null (konec) */
  function rady(typAt, W, H, y0, o, start, rowMax) {
    const kusy = [], g = o.mezera, k = Math.ceil(g);
    let rowY = y0, R = null, vRade = 0, spodek = y0, rowH = 0;
    const novaRada = (h) => { rowH = h; R = new Float64Array(Math.ceil(h) + 1).fill(-Infinity); vRade = 0; };
    /* nejmenší X, aby kus nezasáhl do pravých hran kusů v řadě (s mezerou i ve svislém směru) */
    const posunX = (t) => {
      let X = o.okraj;
      for (let i = 0; i < t.H; i++) {
        if (Number.isNaN(t.l[i])) continue;
        let m = -Infinity; for (let j = Math.max(0, i - k); j <= Math.min(R.length - 1, i + k); j++) if (R[j] > m) m = R[j];
        if (m > -Infinity) X = Math.max(X, m + g - t.l[i]);
      }
      return X;
    };
    const nejlepsi = (T) => (o.otacet ? T : [T[0]]).map((t) => ({ t, X: posunX(t) })).sort((a, b) => a.X + a.t.n.Wt - (b.X + b.t.n.Wt))[0];
    for (let i = start; i < start + 20000; i++) {
      const T = typAt(i); if (!T) break;
      if (!R) novaRada(rowMax);
      let { t, X } = nejlepsi(T);
      if (X + t.n.Wt > W - o.okraj + 1e-6) {
        if (vRade === 0) break;
        rowY += rowH + g; novaRada(rowMax);
        ({ t, X } = nejlepsi(T));
        if (X + t.n.Wt > W - o.okraj + 1e-6) break;
      }
      if (rowY + t.n.Lt > H - o.okraj + 1e-6) break;
      for (let j = 0; j < t.H; j++) if (!Number.isNaN(t.r[j])) R[j] = Math.max(R[j], X + t.r[j]);
      kusy.push({ n: t.n, X, Y: rowY, tr: t.tr, i });
      spodek = Math.max(spodek, rowY + t.n.Lt);
      vRade++;
    }
    return { kusy, spodek };
  }
  /* o: { sirka, vyska, okraj, mezera, pary (0 = co nejvíc), otacet, smer: 'auto' | 'podel' | 'napric', vrstva: 'horni' | 'spodni',
          sady: [{ nohy, pary, nazev }] – víc projektů na jeden arch (pary 0 = doplnit, co se vejde) }
     Hlavní řady jedním směrem, zbylý pruh pod nimi se dovyplní kusy otočenými o 90°. */
  function rozvrh(v, o) {
    o = Object.assign({ sirka: 500, vyska: 500, okraj: 5, mezera: 3, pary: 0, otacet: true, smer: 'auto', vrstva: 'horni' }, o || {});
    const vrstva = (n) => (o.vrstva === 'spodni' && n.vrstva2 ? Object.assign({}, n, { vlozka: n.vrstva2, perf: [], roz: J.rozmery(n.vrstva2) }) : n);
    const sady = (o.sady || [{ nohy: v.nohy, pary: o.pary, nazev: '' }]).filter((q) => q.nohy.length).map((q) => ({ nazev: q.nazev, pary: q.pary, nohy: q.nohy.map(vrstva) }));
    if (!sady.length) return { kusy: [], pary: 0, sady: [], vyuziti: 0, o };
    const rowMax = Math.max(...sady.flatMap((q) => q.nohy.map((n) => n.Lt)));
    sady.forEach((q) => { q.typy = q.nohy.map((n) => [kus(n, false), kus(n, true)]); q.pocet = q.pary > 0 ? q.pary * q.nohy.length : Infinity; });
    /* pořadí kusů: sady za sebou, každá po celých sadách; „co nejvíc“ se opakuje do zaplnění */
    const typAt = (i) => {
      for (let s = 0; s < sady.length; s++) { const q = sady[s]; if (i < q.pocet) { const t = q.typy[i % q.nohy.length]; t.sada = s; return t; } i -= q.pocet; }
      return null;
    };
    const varianta = (napric) => {
      /* rám = arch, u „napříč“ otočený o 90°: bod rámu (x, y) → arch (šířka − y, x) */
      const W = napric ? o.vyska : o.sirka, H = napric ? o.sirka : o.vyska;
      const doArchu = napric ? ([x, y]) => [o.sirka - y, x] : (q) => q;
      const a = rady(typAt, W, H, o.okraj, o, 0, rowMax);
      const kusy = a.kusy.map((q) => ({ n: q.n, i: q.i, m: (p) => { const [x, y] = q.tr(p); return doArchu([q.X + x, q.Y + y]); } }));
      /* pruh pod řadami (od y0, výška hs): kusy napříč v podrámu hs × W; bod podrámu (gx, gy) → rám (W − gy, y0 + gx) */
      const y0 = a.kusy.length ? a.spodek + o.mezera - o.okraj : 0, hs = H - y0;
      if (hs > 40) {
        const b = rady(typAt, hs, W, o.okraj, o, kusy.length ? kusy[kusy.length - 1].i + 1 : 0, rowMax);
        for (const q of b.kusy) kusy.push({ n: q.n, i: q.i, m: (p) => { const [x, y] = q.tr(p); return doArchu([W - (q.Y + y), y0 + q.X + x]); } });
      }
      return kusy;
    };
    /* jen celé sady (páry) z každého projektu */
    const zCelych = (kusy) => {
      const sada = (q) => { let i = q.i; for (let s = 0; s < sady.length; s++) { if (i < sady[s].pocet) return s; i -= sady[s].pocet; } return -1; };
      const pocty = sady.map(() => 0); for (const q of kusy) pocty[sada(q)]++;
      const cele = pocty.map((n, s) => Math.floor(n / sady[s].nohy.length) * sady[s].nohy.length), zbyva = cele.slice();
      const out = kusy.filter((q) => { const s = sada(q); if (zbyva[s] > 0) { zbyva[s]--; return true; } return false; });
      return { kusy: out, pary: cele.map((n, s) => n / sady[s].nohy.length) };
    };
    const kandidati = (o.smer === 'podel' ? [false] : o.smer === 'napric' ? [true] : [false, true]).map((napric) => zCelych(varianta(napric)));
    const nej = kandidati.reduce((m, k) => (k.kusy.length > m.kusy.length ? k : m));
    const plocha = nej.kusy.reduce((s, q) => s + q.n.roz.plocha, 0);
    return { kusy: nej.kusy, pary: nej.pary.reduce((a, b) => a + b, 0), sady: sady.map((q, s) => ({ nazev: q.nazev, pary: nej.pary[s] })), vyuziti: plocha / (o.sirka * o.vyska), plochaKusu: plocha, o };
  }
  /* scéna pro BFV.svgPrvky / BFV.dxfSceny */
  function scenaArchu(r, popisky) {
    const { o } = r, prvky = [{ t: 'l', b: [[0, 0], [o.sirka, 0], [o.sirka, o.vyska], [0, o.vyska]], z: true, s: 0.3, c: '#1e7d3a', v: 'ARCH' }];
    const cit = {};
    for (const q of r.kusy) {
      const m = q.m;
      prvky.push({ t: 'l', b: q.n.vlozka.map(m), z: true, s: 0.3, c: '#000000', v: 'REZ_' + q.n.strana });
      for (const p of q.n.perf) { const [x, y] = m([p.x, p.y]); prvky.push({ t: 'k', x, y, r: p.r, s: 0.2, c: '#000000', v: 'REZ_' + q.n.strana }); }
      if (popisky) {
        cit[q.n.strana] = (cit[q.n.strana] || 0) + 1;
        const [x, y] = m([q.n.Wt / 2, q.n.Lt * 0.35]);
        prvky.push({ t: 'txt', x, y, h: 6, txt: q.n.strana + cit[q.n.strana], a: 'c', c: '#999999', v: 'TEXT' });
      }
    }
    return { prvky, x0: 0, y0: 0, w: o.sirka, h: o.vyska };
  }

  const API = { porovnej, porovnejNohy, svgPorovnani, naPatu, rozvrh, scenaArchu };
  if (uzel) module.exports = API;
  koren.BFA = API;
})(typeof window !== 'undefined' ? window : globalThis);

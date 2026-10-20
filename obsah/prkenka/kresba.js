/* ============================================================
   Prkénka – 2D kresba kroků a hotového prkénka (bez DOM)
   Výstup: scéna {x0, y0, w, h, prvky} v mm, osa y dolů (stejně jako SVG a PDF).
   prvky: {t:'p', b:poly, f, c, s, o, tex} výplň (tex = textura letokruhů jen pro obrazovku),
          {t:'l', b, s, c, d, z} čára, {t:'k', x, y, r, s, c, f, d} kruh, {t:'txt', x, y, h, txt, a, c, u}
   Textura: čelo = soustředné kruhy kolem dřeně, bok = rovnoběžné pruhy podle vzdálenosti od dřeně.
   ============================================================ */
(function (koren) {
  'use strict';
  const J = koren.PKJ || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const fmt = J.fmt;
  const POHLED = { z: [0, 1], y: [0, 2], x: [1, 2] };
  const NAZEV_POHLEDU = { z: 'Pohled shora', y: 'Pohled zepředu', x: 'Pohled z čela (průřez)' };

  function hash(a, b) { let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35); h ^= h >>> 13; h = Math.imul(h, 0x27d4eb2f); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  /** poloměry letokruhů pro dřeň (deterministicky podle její polohy) */
  function letokruhy(st, sp, rMax) {
    const seed = Math.round(st[0] * 7 + st[1] * 13 + st[2] * 17), out = [];
    let r = sp * (0.3 + hash(seed, 999));
    for (let i = 0; r < rMax && i < 400; i++) { out.push({ r, pozdni: hash(seed, i * 3 + 1) }); r += sp * (0.7 + 0.6 * hash(seed, i)); }
    return out;
  }
  /** textura jedné viditelné plochy: {kruhy:[{x,y,r,w}], cary:[[x0,y0,x1,y1,w]]} v souřadnicích pohledu */
  function textura(pr, maxPrvku) {
    const k = pr.kus, D = J.DREVINY[k.d] || J.DREVINY.javor, sp = D.letokruh * 1.6;
    const [ia, ib] = POHLED[pr.n], inn = J.OSA_I[pr.n];
    const v = k.v, va = v[ia], vb = v[ib], vn = v[inn];
    const xs = pr.poly.map((q) => q[0]), ys = pr.poly.map((q) => q[1]);
    const out = { kruhy: [], cary: [] };
    maxPrvku = maxPrvku || 30;
    if (Math.abs(vn) > 0.7) {
      const cx = k.st[ia], cy = k.st[ib];
      let rmin = Infinity, rmax = 0;
      for (const q of pr.poly) { const d = Math.hypot(q[0] - cx, q[1] - cy); rmin = Math.min(rmin, d); rmax = Math.max(rmax, d); }
      if (J.bodVPolygonu([cx, cy], pr.poly)) rmin = 0;
      for (const L of letokruhy(k.st, sp, rmax)) if (L.r >= rmin * 0.9) { out.kruhy.push({ x: cx, y: cy, r: L.r, w: sp * (0.18 + 0.22 * L.pozdni) }); if (out.kruhy.length >= maxPrvku) break; }
    } else {
      const n = Math.hypot(va, vb) || 1, g = [va / n, vb / n], q = [-g[1], g[0]];
      const dn = Math.abs(k.st[inn] - pr.rovina), s0 = k.st[ia] * q[0] + k.st[ib] * q[1];
      let smin = Infinity, smax = -Infinity, tmin = Infinity, tmax = -Infinity;
      for (const P of pr.poly) { const s = P[0] * q[0] + P[1] * q[1], t = P[0] * g[0] + P[1] * g[1]; smin = Math.min(smin, s); smax = Math.max(smax, s); tmin = Math.min(tmin, t); tmax = Math.max(tmax, t); }
      const rMax = Math.hypot(dn, Math.max(Math.abs(smin - s0), Math.abs(smax - s0)));
      for (const L of letokruhy(k.st, sp, rMax + sp)) {
        if (L.r <= dn) continue;
        const d = Math.sqrt(L.r * L.r - dn * dn);
        for (const s of [s0 - d, s0 + d]) {
          if (s < smin || s > smax) continue;
          const vl = Math.sin(L.r * 0.7) * 0.6; // mírné zvlnění
          out.cary.push([q[0] * s + g[0] * tmin, q[1] * s + g[1] * tmin, q[0] * (s + vl) + g[0] * tmax, q[1] * (s + vl) + g[1] * tmax, sp * (0.14 + 0.2 * L.pozdni)]);
        }
        if (out.cary.length >= maxPrvku * 2) break;
      }
    }
    void xs; void ys;
    return out;
  }

  /* ---------- rozvržení pohledů ---------- */
  function velikostTextu(roz) { return Math.max(3, Math.min(14, Math.max(roz[0], roz[1]) / 55)); }

  /**
   * scéna kroku: pohledy pod sebou (každý s popiskem), kóty a popisky z kroku.
   * o: {textury (bool), dokonceni (geometrie obrysu z jádra), hotove (jen výsledný pohled)}
   */
  function scenaKroku(v, krok, o) {
    o = o || {};
    const prvky = [], pohledy = o.pohledy || krok.pohledy || ['z'];
    const kusy = krok.kusy;
    const ob = J.obalka(kusy), th = o.th || velikostTextu(ob.roz);
    let y = 0, sirka = 0;
    for (const n of pohledy) {
      const [ia, ib] = POHLED[n], a0 = ob.min[ia], a1 = ob.max[ia], b0 = ob.min[ib], b1 = ob.max[ib];
      const vys = b1 - b0;
      // nadpis pohledu
      prvky.push({ t: 'txt', x: 0, y: y + th, h: th, txt: NAZEV_POHLEDU[n], a: 'l', c: '#555555', v: 'popis' });
      y += th * 2.6;
      const X = (a) => a - a0, Y = (b) => y + (b1 - b);
      const pr = J.pohled(kusy, n);
      for (const P of pr) {
        const k = P.kus, D = J.DREVINY[k.d] || J.DREVINY.javor;
        const poly = P.poly.map((q) => [X(q[0]), Y(q[1])]);
        const e = { t: 'p', b: poly, f: D.svetla, c: '#3a2a1c', s: Math.max(0.15, th * 0.04), o: k.odpad ? 0.35 : 1, v: k.odpad ? 'odpad' : 'drevo', tmava: D.tmava };
        if (o.textury !== false && !k.odpad) {
          const T = textura(P, o.maxPrvku);
          e.tex = { kruhy: T.kruhy.map((q) => ({ x: X(q.x), y: Y(q.y), r: q.r, w: q.w })), cary: T.cary.map((q) => [X(q[0]), Y(q[1]), X(q[2]), Y(q[3]), q[4]]) };
        }
        prvky.push(e);
        if (k.odpad) prvky.push({ t: 'l', b: poly, z: true, s: Math.max(0.15, th * 0.05), c: '#777777', d: true, v: 'odpad' });
      }
      // písmena pozic v průřezu
      if (n === 'x' && pr.length <= 60) for (const P of pr) {
        if (P.kus.odpad) continue;
        const xs = P.poly.map((q) => q[0]), ys = P.poly.map((q) => q[1]);
        const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
        if (w > th * 1.1 && h > th * 1.3) prvky.push({ t: 'txt', x: X((Math.max(...xs) + Math.min(...xs)) / 2), y: Y((Math.max(...ys) + Math.min(...ys)) / 2) + th * 0.35, h: th, txt: P.kus.slot || '', a: 'c', c: '#000000', v: 'popis', obrys: true });
      }
      // dokončení na pohledu shora
      if (n === 'z' && o.dokonceni) dokonceniDoSceny(prvky, o.dokonceni, X, Y, th, v.p);
      // kóty
      for (const K of (o.bezKot ? [] : krok.koty || [])) if (K.pohled === n) kotaDoSceny(prvky, [X(K.a[0]), Y(K.a[1])], [X(K.b[0]), Y(K.b[1])], K.odsaz * th / 3, K.text, th);
      for (const L of (o.bezKot ? [] : krok.popisky || [])) if (L.pohled === n) {
        const px = X(L.x), py = Y(L.y) - th * 0.4;
        prvky.push({ t: 'txt', x: px, y: py, h: th * 0.9, txt: L.text, a: 'c', c: '#b3261e', v: 'popis' });
        // oblouková šipka otočení
        const r = th * 0.9, b = [];
        for (let i = 0; i <= 10; i++) { const u = (200 + 280 * i / 10) * Math.PI / 180; b.push([px + r * Math.cos(u), py - th * 1.9 + r * Math.sin(u)]); }
        prvky.push({ t: 'l', b, s: th * 0.08, c: '#b3261e', v: 'popis' });
        const k2 = b[b.length - 1], k1 = b[b.length - 2], dx = k2[0] - k1[0], dy = k2[1] - k1[1], dl = Math.hypot(dx, dy) || 1;
        prvky.push({ t: 'p', b: [k2, [k2[0] - (dx / dl) * th * 0.5 + (dy / dl) * th * 0.25, k2[1] - (dy / dl) * th * 0.5 - (dx / dl) * th * 0.25], [k2[0] - (dx / dl) * th * 0.5 - (dy / dl) * th * 0.25, k2[1] - (dy / dl) * th * 0.5 + (dx / dl) * th * 0.25]], f: '#b3261e', v: 'popis' });
      }
      sirka = Math.max(sirka, a1 - a0);
      y += vys + th * 4.5;
    }
    const okraj = th * 4;
    return { x0: -okraj, y0: -th * 0.5, w: sirka + okraj + th * 10, h: y + th, prvky };
  }

  function kotaDoSceny(prvky, A, B, odsaz, text, th) {
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy);
    if (L < 1e-6) return;
    const vod = Math.abs(dx) >= Math.abs(dy);
    const n = vod ? [0, -1] : [1, 0]; // kladné odsazení = nahoru (vodorovné) / doprava (svislé)
    const a = [A[0] + n[0] * odsaz, A[1] + n[1] * odsaz], b = [B[0] + n[0] * odsaz, B[1] + n[1] * odsaz];
    const s = Math.max(0.12, th * 0.04), c = '#1f5fa8';
    const pres = Math.sign(odsaz) * th * 0.4;
    prvky.push({ t: 'l', b: [A, [a[0] + n[0] * pres, a[1] + n[1] * pres]], s, c, v: 'kota' });
    prvky.push({ t: 'l', b: [B, [b[0] + n[0] * pres, b[1] + n[1] * pres]], s, c, v: 'kota' });
    prvky.push({ t: 'l', b: [a, b], s, c, v: 'kota' });
    const u = [dx / L, dy / L], h = Math.min(th * 0.7, L / 3);
    for (const [P, sg] of [[a, 1], [b, -1]]) prvky.push({ t: 'p', b: [P, [P[0] + sg * u[0] * h - u[1] * h * 0.3, P[1] + sg * u[1] * h + u[0] * h * 0.3], [P[0] + sg * u[0] * h + u[1] * h * 0.3, P[1] + sg * u[1] * h - u[0] * h * 0.3]], f: c, v: 'kota' });
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if (vod) prvky.push({ t: 'txt', x: mx, y: my - th * 0.35, h: th * 0.85, txt: text, a: 'c', c, v: 'kota', pozadi: true });
    else prvky.push({ t: 'txt', x: mx + th * 0.4, y: my + th * 0.3, h: th * 0.85, txt: text, a: 'l', c, v: 'kota', pozadi: true });
  }

  function dokonceniDoSceny(prvky, D, X, Y, th, p) {
    const tr = (P) => P.map((q) => [X(q[0]), Y(q[1])]);
    const s = Math.max(0.2, th * 0.06);
    prvky.push({ t: 'l', b: tr(D.obrys), z: true, s: s * 1.6, c: '#000000', v: 'obrys' });
    if (p.hranaTyp !== 'zadna' && p.hrana > 0) {
      const vn = J.zaoblenyObdelnik(p.hrana, p.hrana, D.L - p.hrana, D.W - p.hrana, Math.max(0, D.rohR - p.hrana));
      prvky.push({ t: 'l', b: tr(vn), z: true, s: s * 0.6, c: '#000000', d: false, v: 'hrana', o: 0.6 });
    }
    if (D.drazka) {
      prvky.push({ t: 'p', b: tr(D.drazka.vnejsi), f: '#000000', o: 0.18, v: 'drazka', diry: [tr(D.drazka.vnitrni)] });
      prvky.push({ t: 'l', b: tr(D.drazka.vnejsi), z: true, s, c: '#000000', v: 'drazka' });
      prvky.push({ t: 'l', b: tr(D.drazka.vnitrni), z: true, s, c: '#000000', v: 'drazka' });
      prvky.push({ t: 'l', b: tr(D.drazka.osa), z: true, s: s * 0.6, c: '#b3261e', d: true, v: 'drazkaOsa' });
    }
    for (const n of D.nozicky || []) prvky.push({ t: 'k', x: X(n.x), y: Y(n.y), r: n.r, s, c: '#1f5fa8', d: true, v: 'nozicka' });
    for (const U of D.uchyty || []) prvky.push({ t: 'l', b: tr(U), z: true, s, c: '#1f5fa8', d: true, v: 'uchyt' });
    if (D.otvor) prvky.push({ t: 'k', x: X(D.otvor.x), y: Y(D.otvor.y), r: D.otvor.r, s: s * 1.4, c: '#000000', f: '#ffffff', v: 'otvor' });
  }

  /* ---------- SVG ---------- */
  const n3 = (x) => { const v = Math.round(x * 100) / 100; return Number.isFinite(v) ? String(v) : '0'; };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  let citac = 0;
  function svg(sc, o) {
    o = o || {};
    const id = 'pk' + (++citac) + '_';
    const out = [], defs = [];
    const cesta = (b, z) => b.map((q, i) => (i ? 'L' : 'M') + n3(q[0]) + ' ' + n3(q[1])).join('') + (z ? 'Z' : '');
    let ci = 0;
    for (const e of sc.prvky) {
      if (e.t === 'p') {
        const d = cesta(e.b, true) + (e.diry || []).map((D) => cesta(D, true)).join('');
        out.push(`<path d="${d}" fill="${e.f}"${e.o !== undefined && e.o < 1 ? ` fill-opacity="${e.o}"` : ''}${e.diry ? ' fill-rule="evenodd"' : ''}${e.c ? ` stroke="${e.c}" stroke-width="${n3(e.s || 0.2)}" stroke-opacity="0.55"` : ''}/>`);
        if (e.tex && (e.tex.kruhy.length || e.tex.cary.length)) {
          const cid = id + (ci++);
          defs.push(`<clipPath id="${cid}"><path d="${cesta(e.b, true)}"/></clipPath>`);
          const g = [`<g clip-path="url(#${cid})" stroke="${e.tmava}" fill="none" stroke-opacity="0.75">`];
          for (const k of e.tex.kruhy) g.push(`<circle cx="${n3(k.x)}" cy="${n3(k.y)}" r="${n3(k.r)}" stroke-width="${n3(k.w)}"/>`);
          for (const c of e.tex.cary) g.push(`<path d="M${n3(c[0])} ${n3(c[1])}L${n3(c[2])} ${n3(c[3])}" stroke-width="${n3(c[4])}"/>`);
          g.push('</g>');
          out.push(g.join(''));
          if (e.c) out.push(`<path d="${cesta(e.b, true)}" fill="none" stroke="${e.c}" stroke-width="${n3(e.s || 0.2)}" stroke-opacity="0.55"/>`);
        }
      } else if (e.t === 'l') {
        const dash = e.d ? ` stroke-dasharray="${n3((e.s || 0.25) * 6)} ${n3((e.s || 0.25) * 4)}"` : '';
        out.push(`<path d="${cesta(e.b, e.z)}" fill="none" stroke="${e.c || '#000'}" stroke-width="${n3(e.s || 0.25)}"${dash}${e.o !== undefined ? ` stroke-opacity="${e.o}"` : ''} stroke-linejoin="round"/>`);
      } else if (e.t === 'k') {
        const dash = e.d ? ` stroke-dasharray="${n3((e.s || 0.25) * 5)} ${n3((e.s || 0.25) * 3)}"` : '';
        out.push(`<circle cx="${n3(e.x)}" cy="${n3(e.y)}" r="${n3(e.r)}" fill="${e.f || 'none'}" stroke="${e.c || '#000'}" stroke-width="${n3(e.s || 0.25)}"${dash}/>`);
      } else if (e.t === 'txt') {
        const anch = e.a === 'c' ? 'middle' : e.a === 'r' ? 'end' : 'start';
        const tr = e.u ? ` transform="rotate(${n3(-e.u)} ${n3(e.x)} ${n3(e.y)})"` : '';
        const halo = e.pozadi || e.obrys ? ` stroke="#ffffff" stroke-width="${n3(e.h * 0.25)}" paint-order="stroke" stroke-linejoin="round"` : '';
        out.push(`<text x="${n3(e.x)}" y="${n3(e.y)}" font-size="${n3(e.h)}" font-family="Liberation Sans, Arial, sans-serif" text-anchor="${anch}" fill="${e.c || '#000'}"${halo}${tr}>${esc(e.txt)}</text>`);
      }
    }
    const w = sc.w, h = sc.h;
    const rozm = o.mm ? ` width="${n3(w)}mm" height="${n3(h)}mm"` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n3(sc.x0)} ${n3(sc.y0)} ${n3(w)} ${n3(h)}"${rozm}>${o.pozadi !== false ? `<rect x="${n3(sc.x0)}" y="${n3(sc.y0)}" width="${n3(w)}" height="${n3(h)}" fill="#ffffff"/>` : ''}${defs.length ? '<defs>' + defs.join('') + '</defs>' : ''}${out.join('')}</svg>`;
  }

  /** malý náhled kroku (bez kót) */
  function nahledKroku(v, krok) {
    return svg(scenaKroku(v, krok, { pohledy: [krok.pohledy[0]], maxPrvku: 8, textury: krok.kusy.length < 400, bezKot: true }));
  }
  /** hotové prkénko shora s dokončením */
  function scenaHotova(v, o) {
    const krok = v.kroky[v.kroky.length - 1];
    return scenaKroku(v, krok, Object.assign({ dokonceni: v.dokonceni }, o || {}));
  }

  /** čistá plocha jednoho pohledu (bez popisků) v mm: a doprava, b nahoru → SVG y dolů; pro textury 3D */
  function scenaPlochy(kusy, n, maxPrvku) {
    const ob = J.obalka(kusy.filter((q) => !q.odpad)), [ia, ib] = POHLED[n];
    const a0 = ob.min[ia], b1 = ob.max[ib], prvky = [];
    for (const P of J.pohled(kusy.filter((q) => !q.odpad), n)) {
      const D = J.DREVINY[P.kus.d] || J.DREVINY.javor, T = textura(P, maxPrvku || 40);
      const X = (a) => a - a0, Y = (b) => b1 - b;
      prvky.push({ t: 'p', b: P.poly.map((q) => [X(q[0]), Y(q[1])]), f: D.svetla, c: D.tmava, s: 0.25, tmava: D.tmava,
        tex: { kruhy: T.kruhy.map((q) => ({ x: X(q.x), y: Y(q.y), r: q.r, w: q.w })), cary: T.cary.map((q) => [X(q[0]), Y(q[1]), X(q[2]), Y(q[3]), q[4]]) } });
    }
    return { x0: 0, y0: 0, w: ob.max[ia] - a0, h: b1 - ob.min[ib], prvky };
  }

  const API = { scenaPlochy, textura, letokruhy, scenaKroku, scenaHotova, nahledKroku, svg, kotaDoSceny, dokonceniDoSceny, POHLED, NAZEV_POHLEDU };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.PKK = API;
})(typeof window !== 'undefined' ? window : globalThis);

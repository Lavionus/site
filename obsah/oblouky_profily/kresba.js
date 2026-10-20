/* ============================================================
   Šablony oblouků a profilů – kreslicí pomůcky (bez DOM)
   Prvky scény (mm modelu, y nahoru):
     {t:'l', b:[[x,y]..], s, c, d:'c'|'o'|null, z (uzavřít), f (vyplnit), v (vrstva)}
     {t:'k', x, y, r, s, c, d, v}
     {t:'txt', x, y, txt, h, a:'l'|'c'|'r', u (° proti směru hod.), c, v}
   ============================================================ */
(function (koren) {
  'use strict';
  const STYLY = {
    obrys: { s: 0.35, c: '#000000', v: 'obrys' },          // řezná čára šablony
    krivka: { s: 0.3, c: '#000000', v: 'krivka' },
    druha: { s: 0.3, c: '#b3261e', v: 'druha' },           // druhá křivka (zadní čára, vnitřní oblouk)
    pomocna: { s: 0.15, c: '#777777', d: 'c', v: 'pomocna' },
    tenka: { s: 0.15, c: '#555555', v: 'pomocna' },
    osa: { s: 0.18, c: '#1f5fa8', d: 'o', v: 'osa' },
    kota: { s: 0.18, c: '#1f5fa8', v: 'kota' },
    mrizka: { s: 0.08, c: '#9a9a9a', v: 'mrizka' },
    mrizka5: { s: 0.16, c: '#8a8a8a', v: 'mrizka' },
    zelena: { s: 0.25, c: '#2c8a4a', v: 'sablona' },
    provazek: { s: 0.22, c: '#b3261e', d: 'c', v: 'provazek' },
    material: { s: 0.25, c: '#8a6a3e', v: 'material' },
  };
  const cz = (x, d) => { const k = Math.pow(10, d == null ? 1 : d); return String(Math.round(x * k) / k).replace('.', ',').replace('-', '−'); };

  function nova() {
    const pr = [];
    const st = (s) => (typeof s === 'string' ? STYLY[s] || STYLY.krivka : Object.assign({}, STYLY.krivka, s || {}));
    const K = {
      prvky: pr,
      car(b, styl, o) { const S = st(styl); if (b.length >= 2) pr.push({ t: 'l', b, s: S.s, c: S.c, d: S.d || null, z: !!(o && o.z), f: !!(o && o.f), v: S.v }); return K; },
      kruh(x, y, r, styl) { const S = st(styl); pr.push({ t: 'k', x, y, r, s: S.s, c: S.c, d: S.d || null, v: S.v }); return K; },
      bod(x, y, r, styl) { const S = st(styl); pr.push({ t: 'k', x, y, r, s: 0, c: S.c, f: true, v: S.v }); return K; },
      text(x, y, txt, h, a, u, styl) { const S = st(styl || 'krivka'); pr.push({ t: 'txt', x, y, txt: String(txt), h: h || 2.5, a: a || 'l', u: u || 0, c: S.c, v: S.v === 'obrys' ? 'popis' : S.v }); return K; },
      /** kříž se středem a popisem */
      kriz(x, y, vel, popis, styl) {
        const v = vel || 5; K.car([[x - v, y], [x + v, y]], styl || 'kota'); K.car([[x, y - v], [x, y + v]], styl || 'kota');
        K.kruh(x, y, v * 0.35, styl || 'kota');
        if (popis) K.text(x + v * 0.5 + 0.8, y + v * 0.5 + 0.8, popis, 2.5, 'l', 0, styl || 'kota');
        return K;
      },
      /** plná šipka s hrotem v P směrem (ux, uy) */
      sipka(P, ux, uy, styl, del) {
        const L = Math.hypot(ux, uy) || 1, dx = ux / L, dy = uy / L, d = del || 2.4, w = d * 0.3;
        K.car([[P[0], P[1]], [P[0] - dx * d - dy * w, P[1] - dy * d + dx * w], [P[0] - dx * d + dy * w, P[1] - dy * d - dx * w]], styl || 'kota', { z: true, f: true });
        return K;
      },
      /** délková kóta mezi A a B, odsazená o off (kladně vlevo od směru A→B) */
      kota(A, B, off, txt, o) {
        o = o || {};
        const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy);
        if (L < 1e-6) return K;
        const ux = dx / L, uy = dy / L, nx = -uy, ny = ux, sg = off >= 0 ? 1 : -1;
        const A2 = [A[0] + nx * off, A[1] + ny * off], B2 = [B[0] + nx * off, B[1] + ny * off];
        if (Math.abs(off) > 0.5 && !o.bezVynasecek) {
          K.car([[A[0] + nx * sg * 1, A[1] + ny * sg * 1], [A2[0] + nx * sg * 1.5, A2[1] + ny * sg * 1.5]], 'kota');
          K.car([[B[0] + nx * sg * 1, B[1] + ny * sg * 1], [B2[0] + nx * sg * 1.5, B2[1] + ny * sg * 1.5]], 'kota');
        }
        const ven = L < 9;
        K.car(ven ? [[A2[0] - ux * 5, A2[1] - uy * 5], [B2[0] + ux * 5, B2[1] + uy * 5]] : [A2, B2], 'kota');
        if (ven) { K.sipka(A2, ux, uy); K.sipka(B2, -ux, -uy); } else { K.sipka(A2, -ux, -uy); K.sipka(B2, ux, uy); }
        let u = Math.atan2(uy, ux) * 180 / Math.PI;
        if (u > 90.01 || u <= -89.99) u += 180;
        if (u > 180) u -= 360;
        const ur = u * Math.PI / 180, up = [-Math.sin(ur), Math.cos(ur)];
        const h = o.h || 2.5, kladne = up[0] * nx * sg + up[1] * ny * sg > 0;
        const posun = kladne ? 0.9 : -(0.9 + h * 0.75);
        const M = [(A2[0] + B2[0]) / 2 + up[0] * posun, (A2[1] + B2[1]) / 2 + up[1] * posun];
        const t = txt != null ? txt : cz(L, 1);
        if (ven) K.text(B2[0] + ux * 6, B2[1] + uy * 6 + 0.9, t, h, 'l', u, 'kota');
        else K.text(M[0], M[1], t, h, 'c', u, 'kota');
        return K;
      },
      /** poloměrová kóta: čára ze středu C (nebo jen úsek délky delka před obloukem) k bodu P na oblouku */
      kotaR(C, P, txt, delka) {
        const dx = P[0] - C[0], dy = P[1] - C[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
        const Z = delka && delka < L ? [P[0] - ux * delka, P[1] - uy * delka] : C;
        K.car([Z, P], 'kota'); K.sipka(P, ux, uy);
        let u = Math.atan2(uy, ux) * 180 / Math.PI; let a = 'r';
        if (u > 90 || u < -90) { u += 180; a = 'l'; }
        const off = 0.9, ur = u * Math.PI / 180;
        const T = [P[0] - ux * 4 - Math.sin(ur) * off, P[1] - uy * 4 + Math.cos(ur) * off];
        K.text(T[0], T[1], txt, 2.6, a, u, 'kota');
        return K;
      },
      /** mřížka po g mm, každá 5. čára silněji */
      mrizka(x0, y0, x1, y1, g, popisy) {
        if (!(g > 0)) return K;
        const nx = Math.round((x1 - x0) / g), ny = Math.round((y1 - y0) / g);
        if (nx > 400 || ny > 400) return K;
        for (let i = 0; i <= nx; i++) { const x = x0 + i * g; if (x > x1 + 1e-6) break; K.car([[x, y0], [x, y1]], i % 5 ? 'mrizka' : 'mrizka5'); if (popisy && i % 2 === 0) K.text(x, y0 - 3.2, String(i), 2, 'c', 0, 'pomocna'); }
        for (let j = 0; j <= ny; j++) { const y = y0 + j * g; if (y > y1 + 1e-6) break; K.car([[x0, y], [x1, y]], j % 5 ? 'mrizka' : 'mrizka5'); if (popisy && j % 2 === 0) K.text(x0 - 1.5, y - 0.8, String(j), 2, 'r', 0, 'pomocna'); }
        return K;
      },
      /** šrafa uvnitř polygonu (čáry pod 45° po krok mm) */
      srafa(pol, krok, styl) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const q of pol) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
        const k = krok || 3;
        for (let c = x0 - (y1 - y0); c <= x1; c += k) {
          // přímka x − y = c − y0 … průsečíky s hranami
          const xs = [];
          for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
            const a = pol[j], b = pol[i], fa = a[0] - a[1] - (c - y0), fb = b[0] - b[1] - (c - y0);
            if ((fa > 0) !== (fb > 0)) { const t = fa / (fa - fb); xs.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
          }
          xs.sort((p, q) => p[0] - q[0]);
          for (let i = 0; i + 1 < xs.length; i += 2) K.car([xs[i], xs[i + 1]], styl || 'mrizka');
        }
        return K;
      },
    };
    return K;
  }

  /** meze prvků (s rezervou na text) */
  function mezePrvku(pr) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const p = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
    for (const e of pr) {
      if (e.t === 'l') for (const q of e.b) p(q[0], q[1]);
      else if (e.t === 'k') { p(e.x - e.r, e.y - e.r); p(e.x + e.r, e.y + e.r); }
      else if (e.t === 'txt') {
        const w = e.txt.length * e.h * 0.55, u = (e.u || 0) * Math.PI / 180, c = Math.cos(u), s = Math.sin(u);
        const k0 = e.a === 'r' ? -w : e.a === 'c' ? -w / 2 : 0;
        for (const [a, b] of [[k0, 0], [k0 + w, 0], [k0, e.h], [k0 + w, e.h]]) p(e.x + a * c - b * s, e.y + a * s + b * c);
      }
    }
    if (!isFinite(x0)) return { x0: 0, y0: 0, x1: 10, y1: 10 };
    return { x0, y0, x1, y1 };
  }

  const API = { STYLY, nova, mezePrvku, cz };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.OBLK = API;
})(typeof window !== 'undefined' ? window : globalThis);

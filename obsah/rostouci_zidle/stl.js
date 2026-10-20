/* ============================================================
   Rostoucí židle – STL drobností (manifold-3d z obsah/lib/manifold, modul WASM parametrem)
   Vše se tiskne bez podpor (FDM, PETG/PLA): krytka matice (dutina nahoru), klínek do drážky (naležato),
   distanční kroužek, zarážka/patka ližiny (kapsa nahoru).
   dil(w, id, N, nast, kopie) → {poz, idx, objem, rod, kusu, rozmer, popis, varovani}
   ============================================================ */
(function (koren) {
  'use strict';
  const DH = koren.DH || (typeof require !== 'undefined' ? require('../drevene_hracky/jadro.js') : null);
  const cz = DH.cz, seg = (r) => Math.max(24, Math.min(96, Math.round(r * 5)));
  function sit(v, navic) {
    if (v.status() !== 'NoError') throw new Error('manifold hlásí ' + v.status());
    const mesh = v.getMesh(), np = mesh.numProp, vp = mesh.vertProperties, poz = new Float32Array(vp.length / np * 3);
    for (let q = 0, t = 0; q < vp.length; q += np, t += 3) { poz[t] = vp[q]; poz[t + 1] = vp[q + 1]; poz[t + 2] = vp[q + 2]; }
    const bb = v.boundingBox();
    return Object.assign({ poz, idx: new Uint32Array(mesh.triVerts), objem: v.volume(), rod: v.genus(), rozmer: [0, 1, 2].map((i) => bb.max[i] - bb.min[i]) }, navic);
  }
  const TVORBA = {
    /** krytka kloboukové matice M8 (SW 13): miska Ø 24 × 12, uvnitř válcová dutina Ø 15 + vůle (nasune se na matici s podložkou) */
    krytka(w, k, P, n) {
      const M = w.Manifold, v = +n.stlVule || 0.2, ri = 15 / 2 + v, h = 12, ro = 12;
      let t = k(M.cylinder(h - 2, ro, ro, seg(ro), false));
      t = k(t.add(k(M.cylinder(2, ro, ro - 2, seg(ro), false).translate([0, 0, h - 2]))));
      t = k(t.subtract(k(M.cylinder(h - 2 + 0.01, ri, ri, seg(ri), false).translate([0, 0, -0.01]))));
      return { t: k(t.rotate([180, 0, 0]).translate([0, 0, h])), popis: `krytka Ø 24 × 12, dutina Ø ${cz(2 * ri, 2)} × 10 (tiskne se dnem dolů)` };
    },
    /** klínek do drážky: délka 100, výška = hloubka drážky − 1, tloušťka 0,4 → vůle + 0,6 */
    klinek(w, k, P, n) {
      const M = w.Manifold, L = 100, h = Math.max(3, P.hlDrazky - 1), t0 = 0.4, t1 = Math.max(0.8, P.vule + 0.6);
      const cs = new w.CrossSection([[[0, 0], [L, 0], [L, t1], [0, t0]]]);
      const t = k(cs.extrude(h)); cs.delete();
      return { t, popis: `klínek ${L} × ${cz(h, 1)} mm, tloušťka ${cz(t0, 1)} → ${cz(t1, 1)} mm (zasunout k desce v drážce)` };
    },
    /** distanční kroužek: středí trubku Ø 16 na svorníku M8 u boku */
    krouzek(w, k, P, n) {
      const M = w.Manifold, v = +n.stlVule || 0.2, ri = 8.4 / 2 + v, rt = 16 / 2 + v, ro = 13;
      let t = k(M.cylinder(4, ro, ro, seg(ro), false));
      t = k(t.add(k(M.cylinder(6, 13.0 / 2, 13.0 / 2, seg(7), false).translate([0, 0, 4 - 0.01]))));
      t = k(t.subtract(k(M.cylinder(14, ri, ri, seg(ri), false).translate([0, 0, -1]))));
      void rt;
      return { t, popis: `distanční kroužek: příruba Ø 26 × 4, čep Ø 13 × 6 do trubky Ø 16 × 1,5, otvor Ø ${cz(2 * ri, 2)}` };
    },
    /** zarážka / patka konce ližiny: čepička s kapsou na konec ližiny, dno 3 mm, stěna 2 mm */
    zarazka(w, k, P, n) {
      const M = w.Manifold, v = +n.stlVule || 0.2, a = P.tBok + 2 * v, b = P.hl + 2 * v, st = 2.4, dno = 3, h = 18;
      let t = k(M.cube([a + 2 * st, b + 2 * st, h], false));
      t = k(t.subtract(k(M.cube([a, b, h], false).translate([st, st, dno]))));
      return { t, popis: `patka ${cz(a + 2 * st, 1)} × ${cz(b + 2 * st, 1)} × ${h} mm na konec ližiny ${cz(P.tBok)} × ${cz(P.hl)} (měkké PETG/TPU)` };
    },
  };
  function dil(w, id, N, nast, kopie) {
    const smaz = [], k = (x) => { smaz.push(x); return x; };
    try {
      nast = Object.assign({ stlVule: 0.2, stlStul: 220 }, nast || {});
      const f = TVORBA[id]; if (!f) throw new Error('neznámý díl ' + id);
      const j = f(w, k, N.P, nast);
      const bb = j.t.boundingBox(), sx = bb.max[0] - bb.min[0], sy = bb.max[1] - bb.min[1];
      let t = k(j.t.translate([-bb.min[0], -bb.min[1], -bb.min[2]]));
      const n = Math.max(1, Math.round(kopie || 1)), stul = +nast.stlStul || 220, mez = 5;
      const nx = Math.max(1, Math.floor((stul + mez) / (sx + mez))), ny = Math.max(1, Math.floor((stul + mez) / (sy + mez)));
      const kus = Math.min(n, nx * ny), varovani = [];
      if (n > kus) varovani.push(`Na plochu se vejde ${kus} z ${n} kusů.`);
      if (kus > 1) { const z = t; let vse = z; for (let i = 1; i < kus; i++) vse = k(vse.add(k(z.translate([(i % nx) * (sx + mez), Math.floor(i / nx) * (sy + mez), 0])))); t = vse; }
      return sit(t, { kusu: kus, popis: j.popis, varovani });
    } finally { for (const x of smaz) { try { x.delete(); } catch (e) { /* uvolněno */ } } }
  }
  const API = { dil, TVORBA };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.RZSTL = API;
})(typeof window !== 'undefined' ? window : globalThis);

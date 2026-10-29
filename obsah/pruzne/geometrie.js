/* ============================================================
   pruzne/geometrie.js – plán z pruzne/jadro.js → uzavřené sítě přes manifold-3d.
   Díl = sjednocení hranolů minus odečtené hranoly. Hranol v rovině 'xy' se vysouvá
   v Z (z0…z1); v rovině 'xz' jsou body (x, z) a vysouvá se v Y (y = z0…z1).
   Pak natočení do zvolené tiskové polohy a rozmístění kusů na podložce (z ≥ 0).
   ============================================================ */
(function () {
  'use strict';
  const J = typeof module !== 'undefined' ? require('./jadro.js') : window.PRUZ;
  const KR = typeof module !== 'undefined' ? require('../krabicky/jadro.js') : window.KRAB;

  function postav(w, p, plan) {
    const t0 = Date.now();
    plan = plan || J.plan(p);
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const teleso = h => {
      const cs = k(h.obrysy ? new CS(h.obrysy, 'EvenOdd') : new CS([h.body], 'NonZero'));
      if (h.rovina === 'xz') {
        // body (x, z), vysunutí podél −Y; po otočení kolem X o +90° je (u, v, w) → (u, −w, v)
        return k(k(k(cs.extrude(h.z1 - h.z0)).translate([0, 0, -h.z1])).rotate([90, 0, 0]));
      }
      return k(k(cs.extrude(h.z1 - h.z0)).translate([0, 0, h.z0]));
    };
    try {
      const dily = [];
      for (const d of plan.dily) {
        let m = k(M.union(d.telesa.map(teleso)));
        if (d.odecti.length) m = k(M.difference([m, ...d.odecti.map(teleso)]));
        const st = m.status();
        if (st !== 'NoError') throw new Error(`${d.nazev}: manifold hlásí ${st}`);
        if (m.isEmpty()) throw new Error(`${d.nazev}: výsledné těleso je prázdné`);
        const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
        let poz = new Float32Array(vp.length / np * 3);
        for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
        poz = J.natocSit(poz, p.orientace);
        dily.push({ jmeno: d.jmeno, nazev: d.nazev, barva: d.barva, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), rod: m.genus() });
      }
      // kusy na podložku: každý díl n×, vše vedle sebe na z = 0
      const n = Math.max(1, Math.round(p.kusu || 1)), kusy = [];
      for (const d of dily) for (let i = 0; i < n; i++) kusy.push(Object.assign({}, d, { nazev: d.nazev + (n > 1 ? ` ${i + 1}` : '') }));
      return { dily, kusy: KR.tiskoveRozlozeni(kusy, 6), plan, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  const API = { postav };
  if (typeof module !== 'undefined') module.exports = API; else window.PRUZ_GEO = API;
})();

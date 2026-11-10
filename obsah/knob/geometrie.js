/* Knob – stavba tělesa přes manifold-3d: rotační síť hlavy a krčku (s půdorysem), odsazení,
   zapuštění zespodu, otvor jisticího šroubku (matice / vložka / závit / samořezný vrut).
   postav(w, p, o) → {poz, idx, objem, plocha, rod} v souřadnicích knobu (z = osa, 0 = spodek). */
(function () {
  'use strict';
  const K = typeof module !== 'undefined' ? require('../kliky/jadro.js') : window.KLIKY;
  const KG = typeof module !== 'undefined' ? require('../kliky/geometrie.js') : window.KLIKY_GEOM;

  function postav(w, p, o) {
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [], k = x => { smaz.push(x); return x; };
    const segKruh = r => Math.max(24, Math.min(96, Math.ceil(2 * Math.PI * r / 0.7 / 4) * 4));
    const rDiry = r => r / Math.cos(Math.PI / segKruh(r));
    const kuzelZ = (r0, r1, z0, z1) => k(k(M.cylinder(z1 - z0, r0, r1, segKruh(Math.max(r0, r1)))).translate([0, 0, z0]));
    const valecY = (r, y0, y1, x, z) => k(k(k(M.cylinder(y0 - y1, r, r, segKruh(r))).rotate([90, 0, 0])).translate([x, y0, z]));
    // kužel v ose −y: poloměr r0 v y0 (blíž ose), r1 v y1 (dál)
    const kuzelY = (r0, r1, y0, y1, x, z) => k(k(k(M.cylinder(y0 - y1, r0, r1, segKruh(Math.max(r0, r1)))).rotate([90, 0, 0])).translate([x, y0, z]));
    try {
      const q = p.knob, pr = o.prof, R = pr.R, rn = pr.rn;
      // hlava a krček: jemný profil (body po ≤ 1,5 mm), půdorys jen na hlavě
      const zb = pr.zt - q.hlava, krokZ = q.pudorys === 'spirala' || q.pudorys === 'vrubkovani' ? 0.6 : 1.5;   // šikmý vzor potřebuje hustší kroužky
      const prof = [];
      pr.body.forEach((b, i) => {
        if (i) { const a = pr.body[i - 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / krokZ)); for (let j = 1; j < n; j++) prof.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]); }
        prof.push(b);
      });
      const S = { kruh: 96, oval: 96, hrany: q.pocet * Math.ceil(96 / q.pocet) }[q.pudorys] || q.pocet * Math.max(12, Math.ceil(96 / q.pocet));
      const sit = KG.rotacniSit(prof, S, (f, r, z) => z < pr.zNapoj - 0.01 ? 1 : K.pudorysKnobu(q, f, Math.max(0, Math.min(1, (r - rn * 1.02 - 0.5) / Math.max(1, R - rn - 0.5))), (z - zb) / q.hlava));
      const mesh = new w.Mesh({ numProp: 3, vertProperties: sit.poz, triVerts: sit.idx }); mesh.merge();
      const plne = [k(new M(mesh))];
      // odsazení: válec pod krčkem, dole i nahoře sražený; přesah do krčku spojí obě tělesa
      if (o.maOdsazeni) {
        const r = o.rO, h = p.odsazeni.vyska, sr = Math.min(0.5, h / 3), sh = o.rO > o.prof.podstava + 0.6 ? Math.min(0.5, h / 3) : 0;
        plne.push(kuzelZ(r - sr, r, 0, sr), kuzelZ(r, r, sr - 0.01, h - sh + 0.01));
        if (sh) plne.push(kuzelZ(r, r - sh, h - sh, h));
        plne.push(kuzelZ(Math.min(r, rn) - 0.7, Math.min(r, rn) - 0.7, Math.max(0, h - 0.5), h + 0.5));
      }
      let tel = k(M.union(plne));
      const od = [];
      // zapuštění zespodu
      if (o.hloubkaDiry > 0) {
        od.push(k(k(k(new CS([o.otvor.obrys], 'NonZero')).extrude(o.zDiry1 + 1)).translate([0, 0, -1])));
        // sražení vstupu
        const rs = o.otvor.rOpsany;
        od.push(kuzelZ(rs + 0.6, rs - 0.3, -0.01, 0.9));
      }
      // jisticí šroubek ve směru −y
      if (p.sroub.uchyceni !== 'zadne') {
        const st = o.staveci, zs = o.zs, ven = -(o.ven + 2), kS = o.otvor.kSroubu;
        if (p.sroub.uchyceni === 'zavit') od.push(valecY(rDiry((p.sroub.predvrt > 0 ? p.sroub.predvrt : st.predvrt) / 2), 0, ven, 0, zs));
        else if (o.zahl) {
          // vrut / samořezný vrut: předvrt až k hřídeli, u povrchu zahloubení hlavy – kužel 90° (zápustná) nebo válec, hloubka podle zadání
          const z = o.zahl, rp = rDiry(z.predvrt / 2), rh = z.hlava / 2 + 0.1, y1 = -o.rSroub, h = z.hloubka;
          od.push(valecY(rp, 0, ven, 0, zs));
          if (z.tvar === 'kuzel') {
            const cd = rh - rp;
            if (h >= cd) od.push(kuzelY(rp, rh, y1 + h, y1 + h - cd, 0, zs), valecY(rh, y1 + h - cd + 0.01, ven, 0, zs));
            else od.push(kuzelY(rp, rp + h, y1 + h, y1, 0, zs), valecY(rp + h, y1 + 0.01, ven, 0, zs));
          } else od.push(valecY(rh, y1 + h, ven, 0, zs));
        } else od.push(valecY(rDiry(st.d / 2 + 0.2), 0, ven, 0, zs));
        if (p.sroub.uchyceni === 'vlozka') {
          const hl = Math.min(st.vDelka, o.stenaSroubu - 0.6);
          od.push(valecY(rDiry(st.vlozka / 2), -(o.rSroub - hl), ven, 0, zs));
        } else if (p.sroub.uchyceni === 'matice') {
          // kapsa pro matici, zasouvá se ze spodní plochy
          const sf = st.matice + 0.3, tl = st.mVyska + 0.4, yc = -(kS + o.stenaSroubu / 2);
          const hex = k(k(k(k(CS.circle(sf / Math.sqrt(3), 6)).rotate(30)).extrude(tl)).rotate([90, 0, 0]));
          od.push(k(M.hull([k(hex.translate([0, yc + tl / 2, zs])), k(hex.translate([0, yc + tl / 2, -1]))])));
        }
      }
      if (od.length) tel = k(M.difference([tel, ...od]));
      const st = tel.status();
      if (st !== 'NoError') throw new Error('manifold hlásí ' + st);
      if (tel.isEmpty()) throw new Error('výsledné těleso je prázdné');
      const kusy = tel.decompose(); kusy.forEach(x => k(x));
      if (kusy.length > 1) { const pl = kusy.filter(x => x.volume() > 1e-2); if (pl.length < kusy.length) tel = k(M.compose(pl)); }
      const mm = tel.getMesh(), np = mm.numProp, vp = mm.vertProperties, poz = new Float32Array(vp.length / np * 3);
      for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
      return { poz, idx: new Uint32Array(mm.triVerts), objem: tel.volume(), plocha: tel.surfaceArea(), rod: tel.genus() };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  const API = { postav };
  if (typeof module !== 'undefined') module.exports = API; else window.KNOB_GEOM = API;
})();

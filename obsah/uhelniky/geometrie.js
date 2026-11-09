/* Úhelníky a odsávání – stavba tělesa přes manifold-3d (sjednocení desek, odečtení dutin a otvorů = uzavřená síť).
   postav(w, p, o) → {poz, idx, objem, plocha, rod, duchove}
   w = inicializovaný manifold (po setup()), p = normalizovaný projekt, o = UHELNIKY.odvozene(p).
   Montážní souřadnice: Z nahoru, úhelník má vnitřní roh na ose Y (vodorovné rameno +X, svislé +Z);
   odsávání: zadní plocha pravítka je rovina x = 0, komora jde do +X, stůl je z = 0.
   duchove = desky / pravítko / stůl pro náhled (průhledně), ne do exportu. */
(function () {
  'use strict';

  function postav(w, p, o) {
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const segKruh = r => Math.max(24, Math.min(96, Math.ceil(2 * Math.PI * r / 0.7 / 4) * 4));
    // díra: mnohoúhelník opsaný kružnici, aby prošel vrut plného průměru
    const rDiry = r => r / Math.cos(Math.PI / segKruh(r));
    const box = (x0, x1, y0, y1, z0, z1) => k(k(M.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    const kuzel = (r0, r1, z0, z1) => k(k(M.cylinder(z1 - z0, rDiry(r0), rDiry(r1), segKruh(Math.max(r0, r1)))).translate([0, 0, z0]));
    // mnohoúhelník v rovině XZ vytažený přes y0..y1
    const vXZcs = (cs, y0, y1) => k(k(k(cs.extrude(y1 - y0)).rotate([90, 0, 0])).translate([0, y1, 0]));
    const vXZ = (body, y0, y1) => vXZcs(k(new CS([body], 'NonZero')), y0, y1);
    const duchove = [];

    /** Otvor pro vrut v desce z ∈ [0, tl], hlava na straně z = tl; ovál se protáhne podél lokální osy x (napříč = y). */
    function dira(x, y, tl, d, dolu = 0) {
      const casti = [kuzel(d.ro, d.ro, -1 - dolu, tl + 1)];
      if (d.zap && d.hz > 0) casti.push(kuzel(d.ro, d.ro + d.hz, tl - d.hz, tl + 0.001), kuzel(d.rh, d.rh, tl, tl + 1));
      return casti.map(c => {
        const v = d.napric ? [0, d.oval / 2, 0] : [d.oval / 2, 0, 0];
        const t = d.oval > 0 ? k(M.hull([k(c.translate(v.map(x => -x))), k(c.translate(v))])) : c;
        return k(t.translate([x, y, 0]));
      });
    }

    /** Průřez hliníkového profilu n1 × n2 polí (2020, 2040, 3060…): na každém vnějším poli drážka T
       (otvor šířky drážky do hloubky límce, pod ním lichoběžníková dutina k hloubce drážky), v každém poli středový otvor. */
    function prurezProfilu(n1, n2) {
      const P = o.profil, a = P.a, U = n1 * a, V = n2 * a, dr = P.drazka / 2, wi = 0.275 * a, li = P.limec, hl = P.hloubka;
      const drazka = [[-dr, -0.01], [dr, -0.01], [dr, li], [wi, li], [dr, hl], [-dr, hl], [-wi, li], [-dr, li]];   // (podél stěny, hloubka)
      const otvory = [];
      for (let i = 0; i < n1; i++) {
        const u0 = (i + 0.5) * a;
        otvory.push(drazka.map(([s, d]) => [u0 + s, d]), drazka.map(([s, d]) => [u0 + s, V - d]));
      }
      for (let j = 0; j < n2; j++) {
        const v0 = (j + 0.5) * a;
        otvory.push(drazka.map(([s, d]) => [d, v0 + s]), drazka.map(([s, d]) => [U - d, v0 + s]));
      }
      let cs = k(k(CS.square([U, V])).subtract(k(new CS(otvory, 'NonZero'))));
      const st = [];
      for (let i = 0; i < n1; i++) for (let j = 0; j < n2; j++) st.push(k(k(CS.circle(P.stred / 2, 24)).translate([(i + 0.5) * a, (j + 0.5) * a])));
      if (st.length) cs = k(cs.subtract(k(CS.union(st))));
      return cs;
    }
    /** Duch profilu v kvádru min–max: osa = nejdelší rozměr, průřez přes zbylé dva (počet polí = rozměr / a). */
    function profilovyDuch(min, max) {
      const a = o.profil.a, roz = [0, 1, 2].map(i => max[i] - min[i]), osa = roz.indexOf(Math.max(...roz));
      const [i1, i2] = [0, 1, 2].filter(i => i !== osa);
      const n1 = Math.max(1, Math.round(roz[i1] / a)), n2 = Math.max(1, Math.round(roz[i2] / a));
      const e = i => [0, 1, 2].map(j => (j === i ? 1 : 0));
      const t = [0, 1, 2].map(i => min[i] + (i === i1 ? (roz[i1] - n1 * a) / 2 : i === i2 ? (roz[i2] - n2 * a) / 2 : 0));
      const [X, Y, Z] = [e(i1), e(i2), e(osa)];
      const m = k(k(prurezProfilu(n1, n2).extrude(roz[osa])).transform([X[0], X[1], X[2], 0, Y[0], Y[1], Y[2], 0, Z[0], Z[1], Z[2], 0, t[0], t[1], t[2], 1]));
      const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties, poz = new Float32Array(vp.length / np * 3);
      for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
      return { typ: 'sit', poz, idx: new Uint32Array(mesh.triVerts) };
    }

    try {
      let telo = p.typ === 'odsavani' ? odsavani() : uhelnik();
      const st = telo.status();
      if (st !== 'NoError') throw new Error('manifold hlásí ' + st);
      if (telo.isEmpty()) throw new Error('výsledné těleso je prázdné');
      const kusy = telo.decompose();
      if (kusy.length > 1) {
        const plne = kusy.filter(x => x.volume() > 1e-3);
        if (plne.length < kusy.length) telo = k(M.compose(plne));
      }
      kusy.forEach(x => k(x));
      const mesh = telo.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
      const poz = new Float32Array(vp.length / np * 3);
      for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
      return { poz, idx: new Uint32Array(mesh.triVerts), objem: telo.volume(), plocha: telo.surfaceArea(), rod: telo.genus(), duchove, dilu: kusy.length };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }

    /* ---------- úhelník ---------- */
    function uhelnik() {
      const { t, W, A, B, r } = o;
      // obrys ramene v rovině (x podél ramene, y napříč), zaoblené jen rohy na volném konci
      function rameno(L) {
        if (r <= 0) return k(k(CS.square([L, W])).extrude(t));
        const zaobl = k(k(k(k(CS.square([L + r, W])).translate([-r, 0])).offset(-r, 'Round', 2, 32)).offset(r, 'Round', 2, 32));
        return k(k(zaobl.intersect(k(CS.square([L, W])))).extrude(t));
      }
      // svislé rameno: lokální x → světové z, lokální z (tloušťka) → světové x
      const naSvisle = m => k(k(m.rotate([0, -90, 0])).translate([t, 0, 0]));
      const plne = [rameno(A), naSvisle(rameno(B))];
      // výztuha se seříznutými špičkami (o.vyztuhaObrys = body na rameni a na přeponě), přesah 0,3 mm do ramen
      const e = 0.3, [g1, g2, g3, g4] = o.vyztuhaObrys;
      for (const [a, b] of o.pasy) plne.push(vXZ([[t - e, t - e], [g1[0], t - e], g2, g3, [t - e, g4[1]]], a, b));
      // vnitřní žlábek přes celou šířku: čtverec v rohu bez kruhu
      if (o.ri > 0.05) {
        const ctv = k(k(CS.square([o.ri + e, o.ri + e])).translate([t - e, t - e]));
        const kruh = k(k(CS.circle(o.ri, segKruh(o.ri))).translate([t + o.ri, t + o.ri]));
        plne.push(vXZcs(k(ctv.subtract(kruh)), 0, W));
      }
      // výstupky do drážek profilu pod rameny (lichoběžník se zkosenými boky – bez podpor, snadno se zasune)
      const kl = o.klic, g = 0.3, naSvisleVen = m => k(m.rotate([0, 90, 0]));   // lokální z < 0 → světové x < 0
      // podél ramene (osa x, napříč v yc) / napříč úhelníkem (osa y, poloha xc)
      const vystupek = (x0, x1, yc) => k(M.hull([box(x0, x1, yc - kl.wk, yc + kl.wk, -0.01, 0.5), box(x0, x1, yc - kl.wk + kl.c, yc + kl.wk - kl.c, -kl.h, -kl.h + 0.01)]));
      const vystupekY = xc => k(M.hull([box(xc - kl.wk, xc + kl.wk, g, W - g, -0.01, 0.5), box(xc - kl.wk + kl.c, xc + kl.wk - kl.c, g, W - g, -kl.h, -kl.h + 0.01)]));
      const RA = o.ramenoA, RB = o.ramenoB;
      if (kl) {
        if (RA.kolmo) RA.drazky.forEach(xc => plne.push(vystupekY(xc))); else RA.drazky.forEach(yc => plne.push(vystupek(g, A - g, yc)));
        if (RB.kolmo) RB.drazky.forEach(zc => plne.push(naSvisleVen(vystupekY(-zc)))); else RB.drazky.forEach(yc => plne.push(naSvisleVen(vystupek(-(B - g), -g, yc))));
      }
      const odeb = [];
      if (o.cv > 0.05) odeb.push(vXZ([[-1, -1], [o.cv + 1, -1], [-1, o.cv + 1]], -1 - (kl ? kl.h : 0), W + 1));
      const dolu = kl ? kl.h : 0;
      for (const s of RA.sloupce) for (const x of RA.x) odeb.push(...dira(x, s.y, t, o.otvor, dolu));
      // hlava na vnitřní straně svislého ramene (x = t): lokální z → světové x, lokální x → světové −z
      for (const s of RB.sloupce) for (const z of RB.x) odeb.push(...dira(-z, s.y, t, o.otvor, dolu).map(naSvisleVen));
      if (o.profil) {
        // průhledné profily: podél ramene (přes drážky v y) nebo kolmo (vede napříč, přes drážky v x / z)
        // skutečný průřez profilu (drážky T, středový otvor) vytažený po nejdelší ose kvádru
        const a = o.profil.a, prez = dr => Math.max(a, dr[dr.length - 1] + a / 2);
        const yp = dr => [dr[0] - a / 2, dr[dr.length - 1] + a / 2];
        const pd = (min, max) => duchove.push(profilovyDuch(min, max));
        if (RA.kolmo) pd([RB.kolmo ? -a : 0, -30, -a], [prez(RA.drazky), W + 30, 0]);
        else { const [y0, y1] = yp(RA.drazky); pd([-a, y0, -a], [A + 40, y1, 0]); }
        if (RB.kolmo) pd([-a, -30, 0], [0, W + 30, prez(RB.drazky)]);
        else { const [y0, y1] = yp(RB.drazky); pd([-a, y0, 0], [0, y1, B + 40]); }
      } else {
        const D = p.drevo;
        duchove.push({ typ: 'box', min: [-D, -10, -D], max: [A + 40, W + 10, 0] }, { typ: 'box', min: [-D, -10, 0], max: [0, W + 10, B + 40] });
      }
      let tel = k(M.union(plne));
      if (odeb.length) tel = k(M.difference([tel, ...odeb]));
      return tel;
    }

    /* ---------- odsávací úhelník ---------- */
    function odsavani() {
      const { W, H, D, s, tf } = o;
      const komora = vXZ([[0, 0], [D, 0], [0, H]], -W / 2, W / 2);
      const priruba = box(0, tf, -o.sirkaPriruby / 2, o.sirkaPriruby / 2, 0, H);
      // hrdlo: válec podél osy Z otočený kolem Y na o.osu, od začátku v komoře (část v dutině se odečte) ke konci
      const fi = Math.atan2(o.osa[0], o.osa[2]) * 180 / Math.PI, delka = o.a + o.e;
      const naOsu = m => k(k(m.rotate([0, fi, 0])).translate(o.hrdloZ));
      const plne = [komora, priruba];
      const odeb = [];
      if (o.platny) odeb.push(vXZ(o.vnitrek, -W / 2 + s, W / 2 - s));
      // válec od začátku v komoře k místu, kde začíná volná délka hrdla, pak kužel k ústí
      const L1 = delka - p.odsavani.hrdloDelka;
      if (o.RoZ > o.RiZ && o.RoK > o.RiK && Math.min(o.RiZ, o.RiK) > 0) {
        plne.push(naOsu(k(M.union([kuzel(o.RoZ, o.RoZ, 0, L1 + 0.01), kuzel(o.RoZ, o.RoK, L1, delka)]))));
        odeb.push(naOsu(k(M.union([kuzel(o.RiZ, o.RiZ, -0.01, L1 + 0.01), kuzel(o.RiZ, o.RiK, L1, delka + 0.001), kuzel(o.RiK, o.RiK, delka, delka + 1)]))));
      }
      if (o.oknoS > 0 && o.oknoV > 0) odeb.push(box(-1, tf + 0.3, -o.oknoS / 2, o.oknoS / 2, p.odsavani.dno ? s : -1, o.oknoV));   // s dnem začne okno nad ním (bez visící lišty)
      // otvory v uchách: deska příruby x ∈ [0, tf], hlava na straně komory; lokální x → světové −z
      for (const [y, z] of o.otvory) odeb.push(...dira(-z, y, tf, o.otvor).map(m => k(m.rotate([0, 90, 0]))));
      const Y = Math.max(160, o.sirkaPriruby / 2 + 60);
      duchove.push({ typ: 'box', min: [-p.drevo, -Y, 0], max: [0, Y, H + 30] }, { typ: 'box', min: [-p.drevo - 80, -Y, -12], max: [D + 60, Y, 0] });
      let tel = k(M.union(plne));
      if (odeb.length) tel = k(M.difference([tel, ...odeb]));
      return tel;
    }
  }

  const API = { postav };
  if (typeof module !== 'undefined') module.exports = API; else window.UHELNIKY_GEOM = API;
})();

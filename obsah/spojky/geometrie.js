/* Spojky – stavba tělesa přes manifold-3d (sjednocení ramen, odečtení dutin a otvorů = zaručeně uzavřená síť).
   postav(w, p, o) → {poz, idx, objem, rod, duchove}
   w = inicializovaný manifold (po setup()), p = normalizovaný projekt, o = SPOJKY.odvozene(p).
   Souřadnice „montážní“: spojka tak, jak sedí v rámu; tiskovou polohu dělá jádro (rozborTisku).
   duchove = trubky / profily / latě pro náhled (průhledně), ne do exportu. */
(function () {
  'use strict';
  const S = typeof module !== 'undefined' ? require('./jadro.js') : window.SPOJKY;

  function postav(w, p, o) {
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const segKruh = r => Math.max(24, Math.min(96, Math.ceil(2 * Math.PI * r / 0.7 / 4) * 4));
    const box = (x0, x1, y0, y1, z0, z1) => k(k(M.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    // díra: mnohoúhelník opsaný kružnici, aby se do něj vešel čep / šroub plného průměru
    const rDiry = r => r / Math.cos(Math.PI / segKruh(r));
    const valecZ = (r, z0, z1, x = 0, y = 0) => k(k(M.cylinder(z1 - z0, r, r, segKruh(r))).translate([x, y, z0]));
    const valecX = (r, x0, x1, y = 0, z = 0) => k(k(k(M.cylinder(x1 - x0, r, r, segKruh(r))).rotate([0, 90, 0])).translate([x0, y, z]));
    const valecY = (r, y0, y1, x = 0, z = 0) => k(k(k(M.cylinder(y1 - y0, r, r, segKruh(r))).rotate([-90, 0, 0])).translate([x, y0, z]));
    const duchove = [];
    /* výstupek do drážky se zkosenými boky 45° (tiskne se bez podpor i na boku, snáz se zasune);
       lokálně x = podél drážky, y = napříč, z = ven z desky; osy = obrazy x, y, z ve světě (pravotočivě) */
    function klic(a0, a1, wk, h, osy) {
      const c = Math.max(0, Math.min(h, wk - 0.75)), [X, Y, Z] = osy;
      const m = k(M.hull([box(a0, a1, -wk, wk, -0.5, 0.01), box(a0, a1, -(wk - c), wk - c, h - 0.01, h)]));
      return k(m.transform([X[0], X[1], X[2], 0, Y[0], Y[1], Y[2], 0, Z[0], Z[1], Z[2], 0, 0, 0, 0, 1]));
    }
    const OSY_X_DOLU = [[1, 0, 0], [0, -1, 0], [0, 0, -1]], OSY_Y_DOLU = [[0, 1, 0], [1, 0, 0], [0, 0, -1]];

    try {
      let telo;
      if (p.typ === 'profil') telo = profil();
      else telo = uzel();
      const st = telo.status();
      if (st !== 'NoError') throw new Error('manifold hlásí ' + st);
      if (telo.isEmpty()) throw new Error('výsledné těleso je prázdné');
      // splývající plochy (obal středu × rameno) umí nechat plátek s nulovým objemem – zahodit
      const kusy = telo.decompose();
      if (kusy.length > 1) {
        const plne = kusy.filter(x => x.volume() > 1e-3);
        if (plne.length < kusy.length) telo = k(M.compose(plne));
      }
      kusy.forEach(x => k(x));
      const mesh = telo.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
      const poz = new Float32Array(vp.length / np * 3);
      for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
      return { poz, idx: new Uint32Array(mesh.triVerts), objem: telo.volume(), plocha: telo.surfaceArea(), rod: telo.genus(), duchove };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }

    /* ---------- hliníkové profily ---------- */
    function profil() {
      const q = p.profil, r = o.profil, a = q.a, t = q.tloustka, h = r.vyskaKlice, wk = r.sirkaKlice / 2;
      const ro = rDiry(r.otvor / 2), rh = rDiry(r.hlava / 2), g = 0.3;
      const plne = [], odeb = [];
      if (q.druh === 'uhelnik') {
        const L = q.delka;
        plne.push(box(0, L, -a / 2, a / 2, 0, t), box(0, t, -a / 2, a / 2, 0, L));
        if (q.zebra) {
          const tri = k(new CS([[[t, t], [L, t], [t, L]]], 'Positive'));
          for (const y0 of [a / 2, -a / 2 + q.zebro]) plne.push(k(k(k(tri.extrude(q.zebro)).rotate([90, 0, 0])).translate([0, y0, 0])));
        }
        if (h > 0) plne.push(klic(g, L - g, wk, h, OSY_X_DOLU), klic(g, L - g, wk, h, [[0, 0, 1], [0, 1, 0], [-1, 0, 0]]));
        for (const x of r.otvory) {
          odeb.push(valecZ(ro, -h - 1, t + 1, x, 0), valecX(ro, -h - 1, t + 1, 0, x));
          if (q.zahloubeni) odeb.push(valecZ(rh, t - r.vyskaHlavy, t + 1, x, 0), valecX(rh, t - r.vyskaHlavy, t + 1, 0, x));
        }
        duchove.push({ typ: 'box', min: [0, -a / 2, -a], max: [L + 40, a / 2, 0] }, { typ: 'box', min: [-a, -a / 2, -a], max: [0, a / 2, L + 40] });
      } else if (q.druh === 'plocha') {
        const L = a / 2 + q.delka, sm = r.smery;
        const casti = [k(k(CS.square([a, a])).translate([-a / 2, -a / 2]))];
        for (const [dx, dy] of sm) {
          const x0 = Math.min(0, dx * L), x1 = Math.max(0, dx * L), y0 = dy ? Math.min(0, dy * L) : -a / 2, y1 = dy ? Math.max(0, dy * L) : a / 2;
          casti.push(k(k(CS.square([dx ? x1 - x0 : a, dy ? y1 - y0 : a])).translate([dx ? x0 : -a / 2, dy ? y0 : y0])));
        }
        const obrys = k(k(k(CS.union(casti)).offset(-1.5, 'Round', 2, 16)).offset(1.5, 'Round', 2, 16));
        plne.push(k(obrys.extrude(t)));
        const ma = (dx, dy) => sm.some(s => s[0] === dx && s[1] === dy);
        // průběžný profil v ose X (pokud tam je rameno), v ose Y profily dorážejí z boku
        if (h > 0) {
          if (ma(1, 0) || ma(-1, 0)) {
            const x0 = ma(-1, 0) ? -L : -a / 2, x1 = ma(1, 0) ? L : a / 2;
            plne.push(klic(x0 + g, x1 - g, wk, h, OSY_X_DOLU));
          }
          if (ma(0, 1)) plne.push(klic(a / 2 + g, L - g, wk, h, OSY_Y_DOLU));
          if (ma(0, -1)) plne.push(klic(-L + g, -a / 2 - g, wk, h, OSY_Y_DOLU));
        }
        for (const [dx, dy] of sm) for (const s of r.otvory) {
          odeb.push(valecZ(ro, -h - 1, t + 1, dx * s, dy * s));
          if (q.zahloubeni) odeb.push(valecZ(rh, t - r.vyskaHlavy, t + 1, dx * s, dy * s));
        }
        const xa = ma(-1, 0) ? -L - 30 : -a / 2, xb = ma(1, 0) ? L + 30 : a / 2;
        duchove.push({ typ: 'box', min: [xa, -a / 2, -a], max: [xb, a / 2, 0] });
        if (ma(0, 1)) duchove.push({ typ: 'box', min: [-a / 2, a / 2, -a], max: [a / 2, L + 30, 0] });
        if (ma(0, -1)) duchove.push({ typ: 'box', min: [-a / 2, -L - 30, -a], max: [a / 2, -a / 2, 0] });
      } else if (q.druh === 'krytka') {
        const obrys = k(k(k(k(CS.square([a, a])).translate([-a / 2, -a / 2])).offset(-1.5, 'Round', 2, 16)).offset(1.5, 'Round', 2, 16));
        plne.push(k(obrys.extrude(t)));
        const Lk = r.delkaKlice;
        if (h > 0) plne.push(box(a / 2 - h, a / 2, -wk, wk, -Lk, 0.5), box(-a / 2, -a / 2 + h, -wk, wk, -Lk, 0.5),
          box(-wk, wk, a / 2 - h, a / 2, -Lk, 0.5), box(-wk, wk, -a / 2, -a / 2 + h, -Lk, 0.5));
        if (q.stredOtvor) odeb.push(valecZ(ro, -1, t + 1));
        duchove.push({ typ: 'box', min: [-a / 2, -a / 2, -80], max: [a / 2, a / 2, 0] });
      } else {
        // kostka: středem prochází osy tří profilů (+X, +Y, +Z); hlavy šroubů v zahloubení z vnějších stěn
        const K = r.K, c = r.c, Lk = r.delkaKlice, P = K / 2;
        plne.push(box(-P, P, -P, P, -P, P));
        // výstupky v souřadnicích (podél osy, příčně 1, příčně 2) → přehození os
        const klice = [[a / 2 - h, a / 2, -wk, wk], [-a / 2, -a / 2 + h, -wk, wk], [-wk, wk, a / 2 - h, a / 2], [-wk, wk, -a / 2, -a / 2 + h]];
        for (const [s0, s1, t0, t1] of h > 0 ? klice : []) {
          plne.push(box(P - 0.5, P + Lk, s0, s1, t0, t1), box(t0, t1, P - 0.5, P + Lk, s0, s1), box(s0, s1, t0, t1, P - 0.5, P + Lk));
        }
        odeb.push(valecX(ro, c - 0.1, P + Lk + 1), valecY(ro, c - 0.1, P + Lk + 1), valecZ(ro, c - 0.1, P + Lk + 1));
        odeb.push(valecX(rh, -P - 1, c), valecY(rh, -P - 1, c), valecZ(rh, -P - 1, c));
        duchove.push({ typ: 'box', min: [P, -a / 2, -a / 2], max: [P + 70, a / 2, a / 2] }, { typ: 'box', min: [-a / 2, P, -a / 2], max: [a / 2, P + 70, a / 2] },
          { typ: 'box', min: [-a / 2, -a / 2, P], max: [a / 2, a / 2, P + 70] });
        let tel = k(M.union(plne));
        if (odeb.length) tel = k(M.difference([tel, ...odeb]));
        // seříznutý vnější roh = plocha na podložku při tisku rohem dolů
        const s = 0.3 * K, n = [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)];
        return k(tel.trimByPlane(n, (-3 * P + s) / Math.sqrt(3)));
      }
      let tel = k(M.union(plne));
      if (odeb.length) tel = k(M.difference([tel, ...odeb]));
      return tel;
    }

    /* ---------- uzly trubek a latí ---------- */
    function uzel() {
      const sp = p.spoj, r0 = o.odstup, L = o.L, c = o.zkoseni;
      const maxR = s => (s.typ === 'kruh' ? s.r : Math.max(s.hu, s.hv));
      const daleko = r0 + L + 2 * maxR(o.vnejsi) + 20;
      const mat = r => [r.u[0], r.u[1], r.u[2], 0, r.v[0], r.v[1], r.v[2], 0, r.d[0], r.d[1], r.d[2], 0, 0, 0, 0, 1];
      const vRame = (r, m) => k(m.transform(mat(r)));
      // hranol / válec průřezu s v ose ramene od z0 do z1; s2 = průřez na konci (zkosení)
      function hranol(s, z0, z1, dira, s2) {
        if (s.typ === 'kruh') {
          const f = dira ? rDiry : (x => x), rr = f(s.r), r2 = s2 ? f(s2.r) : rr;
          return k(k(M.cylinder(z1 - z0, rr, r2, segKruh(Math.max(s.r, s2 ? s2.r : 0)))).translate([0, 0, z0]));
        }
        if (!s2) return k(k(M.cube([2 * s.hu, 2 * s.hv, z1 - z0])).translate([-s.hu, -s.hv, z0]));
        const e = 0.01;
        return k(M.hull([hranol(s, z0, z0 + e), hranol(s2, z1 - e, z1)]));
      }
      // otvor kolmo k ose (ve směru u) v půlce zasunutí; od u0 do u1
      const otvorU = (u0, u1) => valecX(rDiry(sp.otvor / 2), u0, u1, 0, r0 + L / 2);
      const pres = s => (s.typ === 'kruh' ? s.r : s.hu) + 1;

      const pahyly = o.ramena.map(r => vRame(r, hranol(o.vnejsi, 0, r0)));
      const stred = k(M.hull(pahyly));
      let tel;
      if (o.styl === 'vnejsi') {
        const ramena = o.ramena.map(r => vRame(r, hranol(o.vnejsi, 0, r0 + L)));
        const plne = k(M.union([stred, ...ramena]));
        const odeb = [];
        for (const r of o.ramena) {
          const s1 = S.zvetsi(o.dutina, c + 0.01);
          odeb.push(vRame(r, k(M.union([hranol(o.dutina, r0, daleko, true), hranol(o.dutina, r0 + L - c, r0 + L + 0.01, true, s1)]))));
          if (sp.otvor > 0) odeb.push(vRame(r, sp.skrz ? otvorU(-pres(o.vnejsi), pres(o.vnejsi)) : otvorU(0, pres(o.vnejsi))));
        }
        tel = k(M.difference([plne, ...odeb]));
      } else {
        const trubky = o.ramena.map(r => vRame(r, hranol(o.dutina, r0, daleko, true)));
        const cepy = o.ramena.map(r => {
          let cep = k(M.union([hranol(o.cep, r0 - 0.01, r0 + L - c), hranol(o.cep, r0 + L - c - 0.01, r0 + L, false, S.zvetsi(o.cep, -c))]));
          const od = [];
          if (o.cepDutina) od.push(hranol(o.cepDutina, r0 + 1, r0 + L + 1, true));
          if (sp.otvor > 0) od.push(otvorU(-pres(o.cep), pres(o.cep)));
          if (od.length) cep = k(M.difference([cep, ...od]));
          return vRame(r, cep);
        });
        tel = k(M.union([k(M.difference([stred, ...trubky])), ...cepy]));
      }
      for (const r of o.ramena) duchove.push({ typ: 'rameno', d: r.d, u: r.u, v: r.v, od: r0, do: r0 + L + 50, sez: o.trubka });
      return tel;
    }
  }

  const API = { postav };
  if (typeof module !== 'undefined') module.exports = API; else window.SPOJKY_GEOM = API;
})();

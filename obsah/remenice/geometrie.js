/* Řemenice – stavba těles přes manifold-3d (booleany se zaručeně uzavřenou sítí).
   postav(w, p) → {dily: [{jmeno, nazev, barva, poz, idx, objem, rod}], cas, chyba?}
   w = inicializovaný manifold (po setup()), p = normalizovaný projekt (REMENICE.normalizuj).
   Všechny díly v tiskové poloze: osa Z svisle, spodek na z = 0. Objekty WASM se po výpočtu uvolní. */
(function () {
  'use strict';
  const R = typeof module !== 'undefined' ? require('./jadro.js') : window.REMENICE;

  function postav(w, p) {
    const t0 = Date.now();
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const jem = p.tisk.jemnost;
    const seg = r => Math.max(24, Math.min(360, Math.ceil(2 * Math.PI * r / jem)));
    const valec = (r, h, z, r2) => k(k(M.cylinder(h, r, r2 === undefined ? r : r2, seg(Math.max(r, r2 || 0)), false)).translate([0, 0, z]));
    const vysun = (cs, h, z) => k(k(cs.extrude(h)).translate([0, 0, z]));
    const kruh = (r, x = 0, y = 0) => k(k(CS.circle(r, seg(r))).translate([x, y]));
    const sit = (m, jmeno, nazev, barva) => {
      const st = m.status();
      if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
      if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
      const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
      // vrcholy, které po převodu na Float32 splynou, se sloučí (zkolabuje hrana kratší než přesnost Float32)
      // a trojúhelníky s opakovaným vrcholem vypadnou – jinak by v STL zůstaly nulové trojúhelníky
      const f = new Float32Array(3), mapa = new Map(), nove = new Int32Array(vp.length / np), xyz = [];
      for (let i = 0, v = 0; i < vp.length; i += np, v++) {
        f[0] = vp[i]; f[1] = vp[i + 1]; f[2] = vp[i + 2];
        const kl = f[0] + ',' + f[1] + ',' + f[2];
        let c = mapa.get(kl);
        if (c === undefined) { c = xyz.length / 3; mapa.set(kl, c); xyz.push(f[0], f[1], f[2]); }
        nove[v] = c;
      }
      const tv = mesh.triVerts, idx = [];
      for (let t = 0; t < tv.length; t += 3) {
        const a = nove[tv[t]], b = nove[tv[t + 1]], c = nove[tv[t + 2]];
        if (a !== b && b !== c && a !== c) idx.push(a, b, c);
      }
      return { jmeno, nazev, barva, poz: new Float32Array(xyz), idx: new Uint32Array(idx), objem: m.volume(), rod: m.genus() };
    };

    /** 2D profil otvoru (hladký / D / s drážkou pro pero). */
    function profilOtvoru(d) {
      const ot = R.otvor(p, d);
      if (ot.chyba) throw new Error(ot.chyba);
      let c = kruh(ot.r);
      if (ot.plochaX !== undefined) c = k(c.intersect(k(k(CS.square([2 * ot.r + 2, 2 * ot.r + 2], true)).translate([ot.plochaX - ot.r - 1, 0]))));
      if (ot.pero) c = k(c.add(k(k(CS.square([ot.pero.x, ot.pero.b], false)).translate([0, -ot.pero.b / 2]))));
      return { cs: c, ot };
    }
    /** Šroub M3 v náboji: vodorovný otvor ve tvaru kapky (špička nahoru = tiskne se bez podpor). */
    function sroubM3(delka, zs, uhel) {
      const r = p.naboj.otvorSroubu / 2;
      const kapka = k(CS.hull([kruh(r), k(k(CS.square([0.02, 0.02], true)).translate([0, r * Math.SQRT2]))]));
      // lokální (u, v, n) → (y, z, x): profil v rovině YZ, vysunutí ve směru +X
      const m = k(k(k(kapka.extrude(delka)).transform([0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1])).translate([0, 0, zs]));
      return k(m.rotate([0, 0, uhel]));
    }

    function remenice(z, d, jmeno, nazev, barva) {
      const ob = R.obrysOzubeni(p, z, jem);
      if (!ob.body) throw new Error(`${nazev}: drážky se překrývají`);
      const v = R.vrstvy(p, ob), pr = p.priruby;
      let zuby2 = k(new CS([ob.body], 'Positive'));
      // zaoblení hlav zubů (otevření: zúžit a rozšířit o rf); simplify odstraní téměř souběžné body, ze kterých by vznikly nulové trojúhelníky
      if (ob.rf > 0.02) zuby2 = k(k(k(zuby2.offset(-ob.rf, 'Round', 2, 16)).offset(ob.rf, 'Round', 2, 16)).simplify(1e-3));
      const eps = 0.05;
      const casti = [vysun(zuby2, v.Bz + (v.dolni ? eps : 0) + (v.horni ? eps : 0), v.zt0 - (v.dolni ? eps : 0))];
      if (v.Hn > 0) casti.push(valec(p.naboj.prumer / 2, v.Hn + eps, 0));
      if (v.dolni) {
        casti.push(valec(v.Rf, pr.tloustka, v.Hn));
        if (v.hk > 0) casti.push(valec(v.Rf, v.hk, v.Hn + pr.tloustka, ob.R));
      }
      if (v.horni) {
        if (v.hk > 0) casti.push(valec(ob.R, v.hk, v.zt1, v.Rf));
        casti.push(valec(v.Rf, pr.tloustka, v.zt1 + v.hk));
      }
      let t = k(M.union(casti));
      const { cs, ot } = profilOtvoru(d);
      const odeb = [vysun(cs, v.H + 2, -1)];
      if (v.Hn > 0 && p.naboj.sroubu > 0) {
        const m = R.matice(p, ot);
        for (let i = 0; i < p.naboj.sroubu; i++) {
          const uhel = 90 * i;
          odeb.push(sroubM3(p.naboj.prumer / 2 + 1, m.zs, uhel));
          if (p.naboj.matice) {
            const kap = k(k(M.cube([m.m, m.s, m.zs + m.e / 2 + 1], false)).translate([m.rn - m.m / 2, -m.s / 2, -1]));
            odeb.push(k(kap.rotate([0, 0, uhel])));
          }
        }
      }
      t = k(M.difference([t, ...odeb]));
      return sit(t, jmeno, nazev, barva);
    }

    function kladka() {
      const kl = R.kladka(p), pr = p.priruby, v = kl;
      const eps = 0.05, Rk = p.kladka.prumer / 2;
      const casti = [valec(Rk, v.Bz + (v.dolni ? eps : 0) + (v.horni ? eps : 0), v.zt0 - (v.dolni ? eps : 0))];
      if (v.dolni) { casti.push(valec(v.Rf, pr.tloustka, 0)); if (v.hk > 0) casti.push(valec(v.Rf, v.hk, pr.tloustka, Rk)); }
      if (v.horni) { if (v.hk > 0) casti.push(valec(Rk, v.hk, v.zt1, v.Rf)); casti.push(valec(v.Rf, pr.tloustka, v.zt1 + v.hk)); }
      let t = k(M.union(casti));
      const odeb = [];
      const volno = v.H - kl.delkaLozisek;
      if (p.kladka.osazeni && volno >= 0.6 && kl.rOsazeni > kl.d / 2 + 0.5) {
        // ložiska nalisovaná z obou stran (2 ks) nebo zespodu (1 ks), mezi nimi / nad ním osazení
        odeb.push(valec(kl.rOsazeni, v.H + 2, -1));
        if (p.kladka.pocet === 2) { odeb.push(valec(kl.rSedlo, kl.B + 1, -1)); odeb.push(valec(kl.rSedlo, kl.B + 1, v.H - kl.B)); }
        else odeb.push(valec(kl.rSedlo, kl.B + 1, -1));
      } else odeb.push(valec(kl.rSedlo, v.H + 2, -1));
      t = k(M.difference([t, ...odeb]));
      return sit(t, 'kladka', `Vodicí kladka ${p.kladka.lozisko}`, '#E0A63F');
    }

    function napinak() {
      const n = p.napinak, [dl, Dl] = R.LOZISKA[p.kladka.lozisko];
      const konec = n.typ === 'rameno' ? n.delka : n.delka + n.zdvih;
      const deska = k(CS.hull([kruh(n.sirka / 2), kruh(n.sirka / 2, konec)]));
      const casti = [vysun(deska, n.tloustka, 0)];
      // nálitek kolem osy: opírá se jen o vnitřní kroužek ložiska
      const rB = Math.min(n.sirka / 2, Math.max(n.osa / 2 + 1.2, (dl + 0.25 * (Dl - dl)) / 2));
      if (n.nalitek > 0) casti.push(valec(rB, n.nalitek + 0.05, n.tloustka - 0.05));
      let t = k(M.union(casti));
      const H = n.tloustka + n.nalitek;
      const odeb = [valec(n.osa / 2, H + 2, -1)];
      if (n.typ === 'rameno') odeb.push(valec(n.cep / 2, H + 2, -1).translate([n.delka, 0, 0]));
      else odeb.push(vysun(k(CS.hull([kruh(n.cep / 2, n.delka), kruh(n.cep / 2, n.delka + n.zdvih)])), H + 2, -1));
      smaz.push(odeb[odeb.length - 1]);
      t = k(M.difference([t, ...odeb]));
      return sit(t, 'napinak', n.typ === 'rameno' ? 'Napínák – rameno' : 'Napínák – posuvný', '#3FB27F');
    }

    try {
      const dily = [];
      if (p.dily.r1) dily.push(remenice(p.z1, p.otvor.prumer, 'remenice1', `Řemenice ${p.z1} z`, '#4F86D9'));
      if (p.dily.r2) dily.push(remenice(p.pohon.z2, p.pohon.otvor2, 'remenice2', `Řemenice ${p.pohon.z2} z`, '#7A5CD6'));
      if (p.dily.kladka) dily.push(kladka());
      if (p.dily.napinak) dily.push(napinak());
      return { dily, cas: Date.now() - t0 };
    } catch (e) {
      return { dily: [], chyba: e.message, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  const API = { postav };
  if (typeof module !== 'undefined') module.exports = API; else window.REMENICE_GEO = API;
})();

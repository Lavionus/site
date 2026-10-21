/* ============================================================
   odizolovac/geometrie.js – stavba tělesa stahováku přes manifold-3d
   z rozvržení (ODIZ.rozvrhni). Bez DOM, běží i v node.
   w = inicializovaný modul manifold-3d (po w.setup()).
   Kruhové drážky mají počet stěn dělitelný 4 → nejnižší bod dna
   je vrchol přesně ve výšce zDno (na tom závisí hloubka řezu).
   ============================================================ */
(function () {
  'use strict';
  const J = (typeof module !== 'undefined') ? require('./jadro.js') : window.ODIZ;

  function postav(w, roz, volby) {
    volby = volby || {};
    if (roz.kloub) return postavSesivacku(w, roz, volby).telo;
    if (roz.rezim === 'merka') return postavMerku(w, roz, volby);
    const n = Math.max(16, Math.round((volby.segmentu || 96) / 4) * 4);
    const M = w.Manifold, smaz = [];
    const sleduj = m => { smaz.push(m); return m; };
    const kvadr = (x0, y0, z0, x1, y1, z1) => sleduj(sleduj(M.cube([x1 - x0, y1 - y0, z1 - z0], false)).translate([x0, y0, z0]));
    const vrch = Math.max(...roz.zony.map(z => z.z1)) + 2;
    try {
      const telo = sleduj(M.union(roz.zony.map(z => kvadr(z.x0, z.y0, 0, z.x1, z.y1, z.z1))));
      const odeber = [];
      for (const g of roz.drazky) {
        const R = g.sirka / 2;
        if (g.profil === 'kruh') {
          const v = sleduj(M.cylinder(g.y1 - g.y0, R, R, n, false));
          const vr = sleduj(v.rotate([-90, 0, 0]));                     // osa Z → osa +Y
          odeber.push(sleduj(vr.translate([g.xc, g.y0, g.zDno + R])));
          odeber.push(kvadr(g.xc - R, g.y0, g.zDno + R, g.xc + R, g.y1, vrch));
        } else {
          odeber.push(kvadr(g.xc - R, g.y0, g.zDno, g.xc + R, g.y1, vrch));
        }
      }
      for (const s of roz.strbiny) {
        const h = s.tl / 2;
        odeber.push(s.osa === 'X' ? kvadr(s.od, s.poloha - h, s.z0, s.do, s.poloha + h, s.z1)
                                  : kvadr(s.poloha - h, s.od, s.z0, s.poloha + h, s.do, s.z1));
      }
      for (const k of roz.koliky) {
        const c = sleduj(M.cylinder(vrch + 2, k.d / 2, k.d / 2, Math.max(16, Math.round(n / 3)), false));
        odeber.push(sleduj(c.translate([k.x, k.y, -1])));
      }
      const dira = sleduj(M.union(odeber));
      const vysl = telo.subtract(dira);
      return vysl;
    } finally {
      for (const m of smaz) { try { m.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  /* ---------- sešívačka ----------
     Ramena = profily v rovině YZ vytažené přes šířku (X). Horní rameno je navržené v sevřené
     poloze a do tiskové (rozevřené) se přenese rotací o −θ kolem konce listu Tc a posunem do Tp.
     Vrací {telo (tisková poloha, jeden kus), dolni, horni (tisková poloha), list} – volající uvolní. */
  const M_PROFIL = [0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1];              // (u, v, w) → (w, u, v)
  const M_XZ = y => [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, y, 0, 1];            // (u, v, w) → (u, w + y, v)
  function doTisku(m, kl) {
    return m.translate([0, -kl.Tc[0], -kl.Tc[1]]).rotate([-kl.th / J.RAD, 0, 0]).translate([0, kl.Tp[0], kl.Tp[1]]);
  }
  /* Měrka: destička, svislé otvory pro jádra, drážky s dorazem od přední hrany, rytí číslic a pravítka. */
  function postavMerku(w, roz, volby) {
    const n = Math.max(24, (volby && volby.segmentu) || 96), M = w.Manifold, smaz = [], D = roz.deska;
    const sl = m => { smaz.push(m); return m; };
    const kv = (x0, y0, z0, x1, y1, z1) => sl(sl(M.cube([x1 - x0, y1 - y0, z1 - z0], false)).translate([x0, y0, z0]));
    try {
      const deska = kv(0, 0, 0, D.x, D.y, D.z), od = [];
      for (const o of roz.otvory) od.push(sl(sl(M.cylinder(D.z + 2, o.d / 2, o.d / 2, n, false)).translate([o.x, o.y, -1])));
      for (const c of roz.kanaly) {
        const h = c.w / 2, zD = D.z - c.hloubka;
        // drážka s půlkulatým dnem: válec podél Y + kvádr nad ním
        od.push(sl(sl(sl(M.cylinder(c.L + 1, h, h, n, false)).rotate([-90, 0, 0])).translate([c.xc, -1, zD + h])));
        od.push(kv(c.xc - h, -1, zD + h, c.xc + h, c.L, D.z + 1));
      }
      for (const r of roz.obdelniky) od.push(kv(r[0], r[1], D.z - roz.hloubkaPisma, r[2], r[3], D.z + 1));
      return deska.subtract(sl(M.union(od)));
    } finally {
      for (const m of smaz) { try { m.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  /* Obrys pružného oblouku (tisková poloha) v rovině YZ: úsek od u0 do u1 (podíl délky),
     na koncích prodloužený po tečně o `pres` mm (zapuštění do ramen). */
  function obrysOblouku(kl, u0, u1, pres) {
    const n = 64, ven = [], dov = [], h = kl.tf / 2;
    for (let i = 0; i <= n; i++) {
      const s = kl.L * (u0 + (u1 - u0) * i / n);
      const a = J.bodOblouku(kl, 0, s, h), b = J.bodOblouku(kl, 0, s, -h);
      ven.push([a[0], a[1]]); dov.push([b[0], b[1]]);
    }
    if (pres) {
      const t0 = J.bodOblouku(kl, 0, kl.L * u0)[2], t1 = J.bodOblouku(kl, 0, kl.L * u1)[2];
      const d0 = [-Math.cos(t0) * pres, -Math.sin(t0) * pres], d1 = [Math.cos(t1) * pres, Math.sin(t1) * pres];
      if (u0 === 0) { ven.unshift([ven[0][0] + d0[0], ven[0][1] + d0[1]]); dov.unshift([dov[0][0] + d0[0], dov[0][1] + d0[1]]); }
      if (u1 === 1) { ven.push([ven[n][0] + d1[0], ven[n][1] + d1[1]]); dov.push([dov[n][0] + d1[0], dov[n][1] + d1[1]]); }
    }
    return ven.concat(dov.reverse());
  }
  function postavSesivacku(w, roz, volby) {
    const n = Math.max(16, Math.round(((volby && volby.segmentu) || 96) / 4) * 4);
    const M = w.Manifold, CS = w.CrossSection, smaz = [];
    const sl = m => { smaz.push(m); return m; };
    const kl = roz.kloub, Bx = kl.Bx;
    const profil = body => { const cs = new CS([body], 'NonZero'); const e = sl(cs.extrude(Bx)); cs.delete(); return sl(e.transform(M_PROFIL)); };
    const vXZ = (polys, y, t) => { const cs = new CS(polys, 'NonZero'); const e = sl(cs.extrude(t)); cs.delete(); return sl(e.transform(M_XZ(y))); };
    try {
      let L = profil(roz.profil.dolni), U = profil(roz.profil.horni);
      const odD = [], odH = [];
      for (const g of roz.drazky) {
        if (g.profil === 'rytiZ') {                                                // rytí shora: mnohoúhelník v XY vytažený podél Z
          const cs = new CS([g.polygon], 'NonZero'), e = sl(cs.extrude(g.z1 - g.z0)); cs.delete();
          (g.dil === 'horni' ? odH : odD).push(sl(e.translate([0, 0, g.z0])));
          continue;
        }
        if (g.profil === 'prizmaY') {                                              // mnohoúhelník v XZ vytažený podél Y
          const pr = vXZ([g.polygon], g.y0, g.y1 - g.y0);
          (g.dil === 'horni' ? odH : g.dil === 'dolni' ? odD : (odD.push(pr), odH)).push(pr);
          continue;
        }
        const R = g.sirka / 2;
        const v = g.profil === 'valecX'
          ? sl(sl(sl(M.cylinder(g.x1 - g.x0, R, R, n, false)).rotate([0, 90, 0])).translate([g.x0, g.yc, g.zStred]))
          : sl(sl(sl(M.cylinder(g.y1 - g.y0, R, R, n, false)).rotate([-90, 0, 0])).translate([g.xc, g.y0, g.zStred]));
        odD.push(v); odH.push(v);
      }
      for (const s of roz.strbiny) (s.dil === 'horni' ? odH : odD).push(vXZ(s.polygony, s.poloha - s.tl / 2, s.tl));
      for (const k of roz.koliky) {
        const c = k.osa === 'Y'
          ? sl(sl(sl(M.cylinder(k.y1 - k.y0, k.d / 2, k.d / 2, Math.max(16, Math.round(n / 3)), false)).rotate([-90, 0, 0])).translate([k.x, k.y0, k.z]))
          : sl(sl(M.cylinder(k.z1 - k.z0, k.d / 2, k.d / 2, k.sest ? 6 : Math.max(16, Math.round(n / 3)), false)).translate([k.x, k.y, k.z0]));
        (k.dil === 'horni' ? odH : odD).push(c);
      }
      const Ld = L.subtract(sl(M.union(odD)));
      const Uz = U.subtract(sl(M.union(odH)));
      const Ut = doTisku(Uz, kl);
      const list = profil(obrysOblouku(kl, 0, 1, 0.5));
      const telo = M.union([Ld, list, Ut]);
      return { telo, dolni: Ld, horni: Ut, horniSevreno: Uz, list };
    } finally {
      for (const m of smaz) { try { m.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  /* Čepel jako kosodélníkový hranol (pro náhled a kontrolu): obrys v rovině čepele
     [u, z] – ostří [a, a+P] ve výšce zOstri, hřbet posunutý o presah ve výšce zOstri − W. */
  function obrysCepele(c) {
    if (c.obrys) return c.obrys;
    if (c.smer !== undefined) return J.obrysCepeleObecne(c);
    const a = c.zacatek, zO = c.zOstri, zH = zO - c.W;
    return [[a, zO], [a + c.P, zO], [a + c.P + c.presah, zH], [a + c.presah, zH]];
  }

  /* Kontrola: čepel se do štěrbiny vejde a ostří kryje každou drážku, kterou má řezat. */
  function kontrolaCepeli(roz) {
    const chyby = [];
    if (roz.kloub || roz.rezim === 'merka') return (roz.chyby || []).map(c => c.text);
    roz.cepele.forEach((c, i) => {
      const s = roz.strbiny[i], k = roz.koliky[i];
      const delka = c.P + c.presah;
      // volné místo v kapse mezi kolíkem a uzavřeným koncem
      const volno = s.osa === 'X' ? s.do - (k.x + k.d / 2) : (k.y - k.d / 2) - s.od;
      if (delka > volno + 1e-6) chyby.push('Čepel ' + (i + 1) + ' (' + J.fmt(delka) + ' mm) se nevejde do kapsy (' + J.fmt(volno) + ' mm).');
      if (c.t >= s.tl) chyby.push('Čepel ' + (i + 1) + ' je tlustší než štěrbina.');
      if (Math.abs(c.zOstri - c.W - s.z0) > 1e-9) chyby.push('Hřbet čepele ' + (i + 1) + ' neleží na dně štěrbiny.');
      if (c.zOstri >= s.z1) chyby.push('Ostří čepele ' + (i + 1) + ' se opírá o strop štěrbiny.');
    });
    return chyby;
  }

  const api = { postav, postavMerku, postavSesivacku, obrysOblouku, doTisku, obrysCepele, kontrolaCepeli };
  if (typeof module !== 'undefined') module.exports = api; else window.ODIZ_GEO = api;
})();

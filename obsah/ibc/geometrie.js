/* IBC napojení – stavba tělesa přes manifold-3d.
   postav(w, p, o) → {poz, idx, objem, plocha, rod, duchove}
   w = inicializovaný manifold (po setup()), p = normalizovaný projekt, o = IBC.odvozene(p).
   Rotačně souměrné části = CrossSection.revolve profilu r–z (z jádra), závity = zkroucený výtah příčného
   řezu (princip z obsah/modelar/jadro/dily.js: zavitovaTyc / rezZavitu / profilZavitu – převzato a upraveno
   o úhel boku a hloubku z tabulky), úchop = šestihran / žebra seříznutá kuželi.
   Pořadí: sjednotit vše plné (tělo, vnější závity, úchop), pak odečíst dutinu, vnitřní závity a otvory. */
(function () {
  'use strict';
  const IBC_SKLON = 1.15;     // = IBC.SKLON (výška kužele / rozdíl poloměrů)

  /** Poloměr profilu závitu v osové poloze u (v násobcích stoupání; střed vrcholu u = 0).
      Souměrný lichoběžník: boky s úhlem `bok` od kolmice k ose, ploška vrcholu = ploška dna. */
  function profilZavitu(u, z) {
    const t = ((u % 1) + 1) % 1, v = t > 0.5 ? 1 - t : t;
    const f = Math.min(0.48, z.h * Math.tan(z.bok * Math.PI / 180) / z.p);   // osová délka boku / stoupání
    const plos = Math.max(0.01, (1 - 2 * f) / 2), vrchol = plos / 2, dno = 0.5 - plos / 2;
    if (v <= vrchol) return z.rMaj;
    if (v >= dno) return z.rMaj - z.h;
    return z.rMaj - z.h * (v - vrchol) / (dno - vrchol);
  }
  /** Závitová tyč (pravý závit) od z = 0 do delka; srazit 'dole' | 'nahore' | null (náběh 1,2 × hloubka). */
  function zavitovaTyc(w, k, z, delka, N, srazit, ch) {
    const { CrossSection: CS } = w;
    const otacek = delka / z.p, b = [];
    for (let i = 0; i < N; i++) { const t = i / N, a = 2 * Math.PI * t, r = profilZavitu(t, z); b.push([r * Math.cos(a), r * Math.sin(a)]); }
    const rez = k(new CS([b], 'NonZero'));
    const tyc = k(rez.extrude(delka, Math.max(1, Math.ceil(otacek * N / 2)), 360 * otacek));
    if (!srazit) return tyc;
    // válec obálky o 0,3 mm větší než vrcholy závitu: skoro tečné plochy by daly nulové trojúhelníky
    const c = Math.min(ch || 1.2 * z.h, delka / 3), R = z.rMaj + 0.3, hc = 1.2 * (c + 0.3);
    const prof = srazit === 'dole'
      ? [[0, 0], [z.rMaj - c, 0], [R, hc], [R, delka], [0, delka]]
      : [[0, 0], [R, 0], [R, delka - hc], [z.rMaj - c, delka], [0, delka]];
    return k(tyc.intersect(k(k(new CS([prof], 'NonZero')).revolve(N))));
  }

  function postav(w, p, o) {
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const N = o.seg;
    const rotacni = (body, seg = N) => k(k(new CS([body], 'NonZero')).revolve(seg));
    const valec = (r, z0, z1, x = 0, y = 0) => k(k(M.cylinder(z1 - z0, r, r, Math.max(24, Math.min(96, Math.ceil(2 * Math.PI * r / 0.7 / 4) * 4)))).translate([x, y, z0]));
    /** Závitová tyč z popisu jádra (z0..z1, případně otočená o 180° kolem X a posunutá na zTop). */
    function tyc(t) {
      const n = Math.max(72, Math.min(180, Math.ceil(2 * Math.PI * t.rMaj / 1.2 / 4) * 4));
      let m = k(zavitovaTyc(w, k, t, t.z1 - t.z0, n, t.srazit, t.ch).translate([0, 0, t.z0]));
      if (t.otocit) m = k(k(m.rotate([180, 0, 0])).translate([0, 0, t.zTop]));
      return m;
    }
    /** Obálka úchopu: válec se sraženými konci (kužel od rIn sklonem jádra), od z0 do z1.
        Válec je o 0,6 mm větší než Rv – rohy šestihranu ani žebra se nedotknou hrany obálky (jinak nulové trojúhelníky). */
    function obalka(rIn, Rv, z0, z1) {
      const a = z0 + 0.3, b = z1 - 0.3, Re = Rv + 0.6, h = Math.min(IBC_SKLON * (Re - rIn), (b - a) / 2 - 0.01);
      // pootočit o půl segmentu: vrchol mnohoúhelníku obálky nesmí ležet na hraně šestihranu (splývající vrcholy)
      return k(rotacni([[0, a], [rIn, a], [Re, a + h], [Re, b - h], [rIn, b], [0, b]]).rotate([0, 0, 180 / N]));
    }
    function sestihran(Rv, z0, z1) {
      const b = [];
      for (let i = 0; i < 6; i++) b.push([Rv * Math.cos(i * Math.PI / 3 + Math.PI / 6), Rv * Math.sin(i * Math.PI / 3 + Math.PI / 6)]);
      return k(k(k(new CS([b])).extrude(z1 - z0)).translate([0, 0, z0]));
    }
    function uchop(u) {
      let tvar;
      if (u.typ === 'sestihran') tvar = sestihran(u.Rv, u.z0, u.z1);
      else {
        const zebra = [];
        for (let i = 0; i < u.n; i++) {
          const z = k(k(M.cube([u.Rv - u.Rk + 0.5, u.sirka, u.z1 - u.z0])).translate([u.Rk - 0.5, -u.sirka / 2, u.z0]));
          zebra.push(k(z.rotate([0, 0, 360 * i / u.n])));
        }
        tvar = k(M.union(zebra));
      }
      return k(tvar.intersect(obalka(u.Rk - 0.4, u.Rv, u.z0, u.z1)));
    }
    const duchove = o.duchove.slice();

    try {
      const plne = [rotacni(o.vnejsi)], odeb = [rotacni(o.vnitrni)];
      for (const t of o.tyce) (t.znam > 0 ? plne : odeb).push(tyc(t));
      if (o.uchop) plne.push(uchop(o.uchop));
      for (const e of o.extra) {
        if (e.typ === 'dira') odeb.push(valec(e.r, e.z0, e.z1, e.x, e.y));
        else if (e.typ === 'ucho') {
          plne.push(k(k(M.cube([e.x1 - e.x0, e.sirka, e.z1 - e.z0])).translate([e.x0, -e.sirka / 2, e.z0])));
          odeb.push(valec(e.dira.r, e.z0 - 1, e.z1 + 1, e.dira.x, 0));
        }
      }
      // nástavce víka: profil trnu (volný konec nahoře)
      for (const n of o.nastavce || []) {
        const b = n.konec, prof = rotacni([[0, 0], ...b.vnejsi, [0, b.L]], Math.max(48, Math.min(120, Math.ceil(2 * Math.PI * b.rMax / 1.2 / 4) * 4)));
        plne.push(k(k(prof.rotate([180, 0, 0])).translate([n.x, n.y, n.z0 + b.L])));
      }
      let telo = k(M.difference([k(M.union(plne)), ...odeb]));
      if (o.matice) {
        const m = o.matice;
        const he = m.hch + 0.6 * IBC_SKLON;
        let mt = k(sestihran(m.Rv, 0, m.H).intersect(k(rotacni([[0, 0], [m.r0, 0], [m.Rv + 0.6, he], [m.Rv + 0.6, m.H - he], [m.r0, m.H], [0, m.H]]).rotate([0, 0, 180 / N]))));
        mt = k(M.difference([mt, rotacni(m.vnitrni), tyc(m.tyc)]));
        telo = k(M.union([telo, k(mt.translate([m.x, 0, 0]))]));
      }
      // krátké hrany (vrcholy splývající po převodu na Float32) zhroutit
      telo = k(telo.simplify(1e-3));
      const st = telo.status();
      if (st !== 'NoError') throw new Error('manifold hlásí ' + st);
      if (telo.isEmpty()) throw new Error('výsledné těleso je prázdné');
      // plátky s nulovým objemem (splývající plochy) zahodit
      const kusy = telo.decompose();
      kusy.forEach(x => k(x));
      if (kusy.length > 1) {
        const pln = kusy.filter(x => x.volume() > 1e-3);
        if (pln.length < kusy.length) telo = k(M.compose(pln));
      }
      const doSite = m => {
        const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties, poz = new Float32Array(vp.length / np * 3);
        for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
        return { poz, idx: new Uint32Array(mesh.triVerts) };
      };
      const sit = doSite(telo);
      return { poz: sit.poz, idx: sit.idx, objem: telo.volume(), plocha: telo.surfaceArea(), rod: telo.genus(), teles: kusy.length, duchove,
        stoupani: o.tyce.concat(o.matice ? [o.matice.tyc] : []).map(t => t.p) };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  const API = { postav, profilZavitu };
  if (typeof module !== 'undefined') module.exports = API; else window.IBC_GEOM = API;
})();

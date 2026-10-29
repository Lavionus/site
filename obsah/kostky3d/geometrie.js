/* Herní kostky a žetony – stavba sítí přes manifold-3d podle plánu z jadro.js.
   postav(w, plan, p) → {kusy: [{nazev, barva, poz, idx, znacky}], site: [{dil, nazev, uzavrena, objem, posun}], cary}
   kusy jsou v tiskové poloze (z ≥ 0), ještě nerozmístěné; znacky = 1 u trojúhelníků z rytí/vystouplého písma (náhled).
   Všechny objekty WASM se po výpočtu uvolní, ven jdou jen obyčejná pole. */
(function () {
  'use strict';
  const K = typeof module !== 'undefined' ? require('./jadro.js') : window.KOSTKY3D;
  const KRAB = typeof module !== 'undefined' ? require('../krabicky/jadro.js') : window.KRAB;
  const PRESAH = 0.3;   // nástroj rytí vyčnívá nad povrch, aby rozdíl nenechal tenkou blánu

  /** Matice 4×4 po sloupcích: (u, v, w) → O + u·eu + v·ev + w·n */
  const matice = (R, w0) => { const O = K.zRoviny(R, 0, 0, w0); return [...R.eu, 0, ...R.ev, 0, ...R.n, 0, ...O, 1]; };

  function postav(w, pl, p) {
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const seg = p.tisk.jemnost;
    const cary = {}, kusy = [], site = [];
    try {
      /* jednotková sada bodů koule (pro obal zaoblené kostky) */
      const bodyKoule = r => {
        const m = k(M.sphere(r, seg)).getMesh(), vp = m.vertProperties, np = m.numProp, out = [];
        for (let i = 0; i < vp.length; i += np) out.push([vp[i], vp[i + 1], vp[i + 2]]);
        return out;
      };
      const textCS = z => k(new CS(z.tvar.obrysy.map(o => o.map(([x, y]) => [x * z.h + z.posun[0], y * z.h + z.posun[1]])), 'NonZero'));
      /** Nejtenčí čára písma (jednotková velikost): nejmenší 2t, kdy otevření (offset −t, +t) ubere přes 3 % plochy. */
      const nejtenci = tv => {
        if (cary[tv.klic] != null || !tv.plocha) return;
        const cs = k(new CS(tv.obrysy, 'NonZero')), A0 = cs.area();
        let a = 0.002, b = 0.5;
        for (let i = 0; i < 14; i++) {
          const t = (a + b) / 2, o1 = cs.offset(-t, 'Round', 2, 24), o2 = o1.offset(t, 'Round', 2, 24), A = o2.area();
          o1.delete(); o2.delete();
          if (A < 0.97 * A0) b = t; else a = t;
        }
        cary[tv.klic] = a + b;
      };
      const nastroj = z => {
        if (z.druh === 'text') {
          nejtenci(z.tvar);
          if (z.vystouple) return k(k(textCS(z).extrude(z.hloubka + 0.05)).transform(matice(z.ramec, -0.05)));
          return k(k(textCS(z).extrude(z.hloubka + PRESAH)).transform(matice(z.ramec, -z.hloubka)));
        }
        const d = K.dulek(z.prumer * z.meritko, z.hloubka * z.meritko);
        return z.body.map(([u, v]) => k(k(M.sphere(d.R, seg)).translate(K.zRoviny(z.ramec, u, v, d.R - z.hloubka * z.meritko))));
      };
      const sit = (m0, nazev, idTela) => {
        const m = k(m0.simplify(1e-5));   // odstraní nulové trojúhelníky z obalu a booleanů
        const st = m.status();
        if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
        if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
        const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
        const poz = new Float32Array(vp.length / np * 3);
        for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
        const idx = new Uint32Array(mesh.triVerts), znacky = new Uint8Array(idx.length / 3);
        const ri = mesh.runIndex, ro = mesh.runOriginalID;
        for (let r = 0; r < ro.length; r++) if (ro[r] !== idTela) znacky.fill(1, ri[r] / 3, ri[r + 1] / 3);
        return { poz, idx, znacky };
      };
      const telo = m => { const t = k(m.asOriginal()); return { t, id: t.originalID() }; };
      const zaznamSite = (dil, nazev, s) => {
        const ks = KRAB.kontrolaSite(s.poz, s.idx), tz = K.teziste(s.poz, s.idx);
        const zaznam = { dil, nazev, uzavrena: ks.uzavrena && ks.normalyVen && !ks.degenerovanych, objem: ks.objem, teziste: tz.c, posun: Math.hypot(...tz.c), kontrola: ks };
        site.push(zaznam);
        return zaznam;
      };

      for (const d of pl.dily) {
        if (d.druh === 'kostka') {
          let zaklad;
          if (d.typ === 'd2') {
            // profil (r, z) poloviny mince se zaoblenými rohy, rotace kolem osy
            const R = d.rozmer / 2, t = d.tloustka, r = d.r, P = [[0, -t / 2], [R - r, -t / 2]];
            const n = Math.max(2, Math.round(seg / 8));
            if (r > 0.01) {
              for (let i = 1; i <= n; i++) { const a = -Math.PI / 2 + Math.PI / 2 * i / n; P.push([R - r + r * Math.cos(a), -t / 2 + r + r * Math.sin(a)]); }
              for (let i = 0; i <= n; i++) { const a = Math.PI / 2 * i / n; P.push([R - r + r * Math.cos(a), t / 2 - r + r * Math.sin(a)]); }
            } else P.push([R, -t / 2], [R, t / 2]);
            P.push([0, t / 2]);
            zaklad = k(k(new CS([P], 'Positive')).revolve(Math.max(seg * 2, 48)));
          } else if (d.r > 0.001) {
            const pts = [], koule = bodyKoule(d.r);
            // + body dotyku ve směru normál stěn: rovné stěny přesně ve vzdálenosti ri (mnohostěnná koule by je o kousek zapustila)
            for (const V of d.T.V) {
              const c = K.vec.mul(V, d.s);
              for (const q of koule) pts.push([c[0] + q[0], c[1] + q[1], c[2] + q[2]]);
              for (const f of d.T.F) pts.push(K.vec.add(c, K.vec.mul(f.n, d.r)));
            }
            zaklad = k(M.hull(pts));
          } else zaklad = k(M.hull(d.T.V));
          const { t, id } = telo(zaklad);
          const nastroje = d.znacky.flatMap(z => [].concat(nastroj(z)));
          const vysl = nastroje.length ? k(M.difference([t, ...nastroje])) : t;
          const s = sit(vysl, d.nazev, id);
          const zs = zaznamSite(d, d.nazev, s);
          // tisková poloha: spodní stěna dolů, střed nad počátkem
          const poz = K.transformuj(s.poz, d.poza.R, [0, 0, d.poza.dz]);
          for (let i = 0; i < d.pocet; i++) kusy.push({ nazev: d.nazev + (d.pocet > 1 ? ` ${i + 1}` : ''), barva: '#F2F2EE', poz, idx: s.idx, znacky: s.znacky, objem: zs.objem });
        } else if (d.druh === 'zeton') {
          const ze = p.zeton, r = d.R, c = d.c, T = d.tloustka;   // u šestiúhelníku R = poloměr vepsané kružnice (přes plochy)
          const spod = K.obrysZetonu(ze, r, seg * 2), vrch = K.obrysZetonu(ze, r - c, seg * 2);
          const pts = [...spod.map(q => [q[0], q[1], 0]), ...spod.map(q => [q[0], q[1], T - c]), ...vrch.map(q => [q[0], q[1], T])];
          d.kusy.forEach((ks, j) => {
            const { t, id } = telo(k(M.hull(pts)));
            const nas = ks.znacky.map(nastroj);
            let vysl = t;
            if (nas.length) vysl = ks.znacky[0].vystouple ? k(M.union([t, ...nas])) : k(M.difference([t, ...nas]));
            const nazev = `Žeton ${ks.text || j + 1}`;
            const s = sit(vysl, nazev, id);
            const zs = zaznamSite(d, nazev, s);
            for (let i = 0; i < ks.pocet; i++) kusy.push({ nazev: nazev + (ks.pocet > 1 ? ` (${i + 1})` : ''), barva: ks.barva, poz: s.poz, idx: s.idx, znacky: s.znacky, objem: zs.objem });
          });
        } else {
          const tvar = d.typ === 'meeple'
            ? k(k(new CS([d.obrys], 'NonZero')).extrude(d.tloustka))
            : k(k(new CS([d.profil], 'Positive')).revolve(Math.max(seg, 24)));
          const { t, id } = telo(tvar);
          const nazev = K.FIGURKY[d.typ];
          const s = sit(t, nazev, id);
          const zs = zaznamSite(d, nazev, s);
          for (const h of d.kusy) for (let i = 0; i < h.pocet; i++) kusy.push({ nazev: `${nazev} – ${h.jmeno} ${i + 1}`, barva: h.barva, poz: s.poz, idx: s.idx, znacky: s.znacky, objem: zs.objem });
        }
      }
      return { kusy, site, cary };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  const API = { postav };
  if (typeof module !== 'undefined') module.exports = API; else window.KOSTKY3D_GEO = API;
})();

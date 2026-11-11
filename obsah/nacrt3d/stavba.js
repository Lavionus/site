/* Z náčrtu do 3D – stavba tělesa z vyřešené kresby přes manifold-3d (bez DOM, jde v node).
   N.postavTeleso(w, vykres, vyklad) → {poz, idx, objem, obalka: [x0, y0, z0, x1, y1, z1], hlaseni} nebo {chyba, hlaseni}
     w = inicializovaný manifold (po setup()), vyklad = výsledek N.zpracuj (vysledek.tvary = skutečné mm, souřadnice listu).
   Souřadnice tělesa (jako Modelář): mm, X doprava, Y dozadu, Z nahoru; díl leží na Z = 0, levý přední roh v X = 0, Y = 0.
   Plochý díl: pohled shora vytažený o tloušťku. Rotační: půlprofil otočený kolem osy (x listu − osa = poloměr).
   Tři pohledy: každý pohled vytažený skrz celý díl, průnik (díry = otvory v pohledu, skrz celý díl).
   Evropské promítání: v půdorysu i bokorysu přibývá směrem od nárysu „k předku“ (Y klesá). */
var N3D = globalThis.N3D = globalThis.N3D || {};
(function (N) {
  'use strict';
  const { abs, max, min, ceil, atan, sin, PI, hypot } = Math;
  const KROK = 0.4;                                 // mm – nejdelší úsek oblouku v síti

  /** Mnohoúhelník tvaru v souřadnicích listu (jemné oblouky a kružnice). */
  function polygon(t) {
    if (t.typ === 'kruh') {
      const n = max(24, min(192, ceil(2 * PI * t.rx / KROK)));
      return Array.from({ length: n }, (_, i) => [t.x + t.rx * Math.cos(2 * PI * i / n), t.y + t.rx * Math.sin(2 * PI * i / n)]);
    }
    const out = [], B = t.body, n = B.length;
    for (let k = 0; k < n; k++) {
      const a = B[k], c = B[(k + 1) % n];
      if (!a.b) { out.push([a.x, a.y]); continue; }
      const th = 4 * abs(atan(a.b)), tet = hypot(c.x - a.x, c.y - a.y), r = tet / (2 * sin(th / 2) || 1);
      const seg = max(3, min(128, ceil(th * r / KROK)));
      out.push(...N.bodyOblouku(a, c, a.b, seg).slice(0, -1));
    }
    return out;
  }
  N.polygonTvaru = polygon;

  const tvaryPohledu = (v, id) => v.vysledek.tvary.filter(t => t.pohled === id && !t.pomocny);
  const oblastiPohledu = (v, id) => {
    const otvor = new Map((v.pohledy[id] ? v.pohledy[id].oblasti : []).map(o => [o.tvar, o.otvor]));
    return tvaryPohledu(v, id).map(t => ({ t, otvor: !!otvor.get(t.id), body: polygon(t) }));
  };
  const rozsah = (obl, i) => {
    let a = Infinity, b = -Infinity;
    for (const o of obl) if (!o.otvor) for (const p of o.body) { if (p[i] < a) a = p[i]; if (p[i] > b) b = p[i]; }
    return [a, b];
  };

  N.postavTeleso = function (w, vykres, v) {
    const { Manifold: M, CrossSection: CS } = w;
    const hlaseni = [], smaz = [];
    const k = x => { smaz.push(x); return x; };
    const prurez = (obl, mapa) => k(new CS(obl.map(o => o.body.map(mapa)), 'EvenOdd'));
    try {
      if (!v || !v.vysledek) return { chyba: 'Kresba ještě není vyložená.', hlaseni };
      if (!v.vysledek.ok) hlaseni.push({ druh: 'varovani', text: 'Kóty si odporují – těleso je postavené z nejbližšího řešení.' });
      let tel;
      if (vykres.typ === 'plochy') {
        const obl = oblastiPohledu(v, 'pudorys');
        if (!obl.some(o => !o.otvor)) return { chyba: 'Nakreslete uzavřený obrys dílu.', hlaseni };
        const [x0] = rozsah(obl, 0), [, y1] = rozsah(obl, 1);
        let T = vykres.tloustka;
        if (!(T > 0)) { T = 5; hlaseni.push({ druh: 'info', text: 'Tloušťka není zadaná (pole „tl.“ v liště) – použito 5 mm.' }); }
        tel = k(prurez(obl, p => [p[0] - x0, y1 - p[1]]).extrude(T));
      } else if (vykres.typ === 'rotacni') {
        const obl = oblastiPohledu(v, 'profil');
        if (!obl.some(o => !o.otvor)) return { chyba: 'Nakreslete uzavřený půlprofil vpravo od osy.', hlaseni };
        const osa = v.vysledek.tvary.find(t => t.pomocny), ox = osa ? osa.body[0].x : N.rozvrh('rotacni', vykres.format).osa.x1;
        const [, y1] = rozsah(obl, 1);
        let cs = prurez(obl, p => [p[0] - ox, y1 - p[1]]);
        // co přesahuje přes osu, se při rotaci zahodí (výklad to hlásí jako chybu)
        cs = k(cs.intersect(k(CS.square([1e4, 1e4]))));
        const r = rozsah(obl, 0)[1] - ox;
        tel = k(cs.revolve(max(48, min(256, ceil(2 * PI * r / 1.2))), 360));
      } else {
        const N_ = oblastiPohledu(v, 'narys'), P = oblastiPohledu(v, 'pudorys'), B = oblastiPohledu(v, 'bokorys');
        const ma = o => o.some(x => !x.otvor);
        const pocet = [N_, P, B].filter(ma).length;
        if (pocet < 2) return { chyba: 'Pro tři pohledy nakreslete aspoň dva pohledy (třeba nárys a půdorys).', hlaseni };
        // společné osy: X z nárysu/půdorysu, výška (Z) z nárysu/bokorysu, hloubka z půdorysu (jinak z bokorysu)
        const sx = [...N_, ...P].filter(o => !o.otvor), sz = [...N_, ...B].filter(o => !o.otvor);
        const x0 = sx.length ? rozsah(sx, 0)[0] : 0, x1 = sx.length ? rozsah(sx, 0)[1] : 0;
        const zDole = sz.length ? rozsah(sz, 1)[1] : 0, zNahore = sz.length ? rozsah(sz, 1)[0] : 0;
        const H = zDole - zNahore, W = x1 - x0;
        const [py0, py1] = ma(P) ? rozsah(P, 1) : [0, 0], [bx0, bx1] = ma(B) ? rozsah(B, 0) : [0, 0];
        const Dp = py1 - py0, Db = bx1 - bx0;
        const D = ma(P) ? Dp : Db;
        let kb = 1;
        if (ma(P) && ma(B) && abs(Dp - Db) > 0.05) {
          kb = Dp / Db;
          hlaseni.push({ druh: 'varovani', text: `Hloubka v půdorysu (${fmt(Dp)} mm) a v bokorysu (${fmt(Db)} mm) nesouhlasí – použita z půdorysu, bokorys je přepočtený.` });
        }
        const casti = [];
        if (ma(N_)) {        // (X, Z) vytažené přes hloubku Y
          casti.push(k(k(k(prurez(N_, p => [p[0] - x0, zDole - p[1]]).extrude(D + 2)).rotate([90, 0, 0])).translate([0, D + 1, 0])));
        }
        if (ma(P)) {         // (X, Y) vytažené přes výšku Z; od nárysu (malé y) = zadní strana (Y = D)
          casti.push(k(k(prurez(P, p => [p[0] - x0, D - (p[1] - py0)]).extrude((H || D) + 2)).translate([0, 0, -1])));
        }
        if (ma(B)) {         // (Y, Z) vytažené přes šířku X; od nárysu (malé x) = zadní strana
          casti.push(k(k(k(prurez(B, p => [D - (p[0] - bx0) * kb, zDole - p[1]]).extrude((W || D) + 2)).rotate([90, 0, 90])).translate([-1, 0, 0])));
        }
        if (!ma(N_) && !ma(P)) return { chyba: 'Chybí pohled se šířkou dílu (nárys nebo půdorys).', hlaseni };
        if (!H && !ma(N_) && !ma(B)) return { chyba: 'Chybí pohled s výškou dílu (nárys nebo bokorys).', hlaseni };
        tel = casti.length === 1 ? casti[0] : k(M.intersection(casti));
      }
      if (!(tel.volume() > 1e-9)) return { chyba: 'Z kresby nevzniklo žádné těleso (pohledy se možná neprotínají).', hlaseni };
      // na desku: Z od nuly, levý přední roh v počátku
      const bb = tel.boundingBox();
      tel = k(tel.translate([-bb.min[0], -bb.min[1], -bb.min[2]]));
      const mesh = tel.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
      const poz = new Float32Array(vp.length / np * 3);
      for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
      const idx = new Uint32Array(mesh.triVerts);
      const b2 = tel.boundingBox();
      const slozek = tel.decompose().map(k).length;   // kusy z decompose jsou nové objekty WASM – uvolnit
      if (slozek > 1) hlaseni.push({ druh: 'varovani', text: `Těleso se rozpadá na ${slozek} samostatné kusy.` });
      return { poz, idx, objem: tel.volume(), obalka: [...b2.min, ...b2.max], slozek, hlaseni };
    } catch (e) {
      return { chyba: 'Stavba tělesa selhala: ' + (e && e.message || e), hlaseni };
    } finally {
      for (const x of smaz) try { x.delete(); } catch (e) { /* už uvolněné */ }
    }
  };
  const fmt = x => String(+(+x).toFixed(2)).replace('.', ',');

  if (typeof module !== 'undefined') module.exports = N;
})(N3D);

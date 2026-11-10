/* Věšáky – stavba těles přes manifold-3d.
   postav(w, p, o) → {hacek, uchyt, duchove}; každá síť {poz, idx, objem, plocha, rod}, souřadnice „zeď“ (viz jadro.js).
   Štítek = tvar zepředu (x, y) vytažený od zdi, čelo zkosené / zaoblené vnořenými vrstvami. Ramena a vlastní obrysy
   = profil zboku (z, y) vytažený do šířky (každá šířka zvlášť), boční hrany stejně vrstvami (krok ≈ 0,25 mm).
   Kapsa = průřez úchytu zvětšený o vůli, vytažený svisle s klínem, posunutá o y0 nad spodek a zespodu otevřená. */
(function () {
  'use strict';
  const K = typeof module !== 'undefined' ? require('./jadro.js') : window.VESAKY;

  function postav(w, p, o) {
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [], k = x => { smaz.push(x); return x; };
    const segKruh = r => Math.max(16, Math.min(72, Math.ceil(2 * Math.PI * r / 0.8 / 4) * 4));
    const kruh = (x, y, r) => k(k(CS.circle(r, segKruh(r))).translate([x, y]));
    const naSit = m => {
      const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties, poz = new Float32Array(vp.length / np * 3);
      for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
      return { poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), plocha: m.surfaceArea(), rod: m.genus() };
    };
    const over = (m, co) => {
      const st = m.status();
      if (st !== 'NoError') throw new Error(`${co}: manifold hlásí ${st}`);
      if (m.isEmpty()) throw new Error(`${co}: výsledné těleso je prázdné`);
      const kusy = m.decompose(); kusy.forEach(x => k(x));
      if (kusy.length > 1) {
        // drobné odštěpky (nulové plátky) zahodit, jinak nechat – kontrola ohlásí víc těles
        const plne = kusy.filter(x => x.volume() > 0.5);
        if (plne.length < kusy.length) return k(M.compose(plne));
      }
      return m;
    };
    /** Mnohoúhelník proti směru hodinových ručiček (CrossSection s pravidlem Positive). */
    const ccw = body => {
      let a = 0;
      for (let i = 0; i < body.length; i++) { const [x0, y0] = body[i], [x1, y1] = body[(i + 1) % body.length]; a += x0 * y1 - x1 * y0; }
      return a < 0 ? body.slice().reverse() : body;
    };
    // průřez v rovině (c, −a) vytažený podél Z a otočený tak, že Z → y a −Y → z (osa x zůstane)
    // dělení po 1,5 mm: boky zužovaného průřezu nejsou rovinné a jedna dlouhá stěna by se prohnula do kapsy
    const svisle = (cs, y0, y1, sTop) => k(k(k(cs.extrude(y1 - y0, sTop === 1 ? 0 : Math.ceil((y1 - y0) / 1.5), 0, [sTop, 1])).rotate([-90, 0, 0])).translate([0, y0, 0]));
    const prurez = body => k(new CS([ccw(body.map(([c, a]) => [c, -a]))]));

    try {
      const tl = p.telo, u = p.uchyt, uch = o.uch;

      const cs = obs => k(CS.union(obs.map(ob => k(new CS([K.obrysNaBody(ob)], 'NonZero')))));
      const hranaTyp = tl.hranaTyp;
      /** Odsazení hrany ve vzdálenosti d od líce (0 … r): zkosení 45° nebo čtvrtkruh. */
      const odsazeni = (r, d) => (hranaTyp === 'zaobleni' ? r - Math.sqrt(Math.max(0, r * r - (r - d) * (r - d))) : r - d);
      const kroku = r => (r > 0.05 ? Math.max(2, Math.min(16, Math.ceil(r / 0.25))) : 0);

      /* ---------- štítek: tvar zepředu (x, y) vytažený od zdi, čelo zkosené / zaoblené vnořenými vrstvami ---------- */
      const stPlne = o.stitek.filter(ob => !ob.dira), stDiry = o.stitek.filter(ob => ob.dira);
      let stitek = cs(stPlne);
      if (stDiry.length) stitek = k(stitek.subtract(cs(stDiry)));
      stitek = k(stitek.simplify(0.005));
      const D = tl.hloubka, rc = Math.min(tl.hrana, D - (u.hloubka + u.vule) - 0.5), nc = kroku(rc), hc = nc ? rc / nc : 0, desky = [];
      for (let i = 0; i < nc; i++) {
        const c = k(stitek.offset(-odsazeni(rc, (i + 0.5) * hc), 'Round'));
        if (!c.isEmpty()) desky.push(k(c.extrude(D - i * hc)));
      }
      desky.push(k(stitek.extrude(D - Math.max(0, rc))));

      /* ---------- profil zboku (z, y): ramena a vlastní obrysy, každá šířka zvlášť ---------- */
      const zaZdi = k(k(CS.square([2000, 4000])).translate([0, -2000]));
      const skupiny = new Map();   // „šířka|posun x“ → části profilu
      const pridej = (sir, x, c) => { const kl = sir + '|' + x; if (!skupiny.has(kl)) skupiny.set(kl, { sir, x, cc: [] }); skupiny.get(kl).cc.push(c); };
      const W = o.sirkaRamen;
      p.ramena.forEach((r, i) => {
        const sir = r.sirka > 0 ? r.sirka : W;
        if (r.druh !== 'trasa') { for (const poly of K.polygonyRamene(r, tl)) pridej(sir, r.x, k(new CS([poly], 'NonZero'))); return; }
        const b = o.ramena[i].body;
        let pred = kruh(b[0].z, b[0].y, b[0].t / 2);
        for (let j = 1; j < b.length; j++) {
          const dal = kruh(b[j].z, b[j].y, b[j].t / 2);
          pridej(sir, r.x, k(CS.hull([pred, dal])));
          pred = dal;
        }
        const tip = b[b.length - 1];
        if (r.konec === 'koule') pridej(sir, r.x, kruh(tip.z, tip.y, K.polomerKonce(r)));
      });
      const bocniDiry = [];
      for (const ob of p.obrysy || []) {
        const c = k(new CS([K.obrysNaBody(ob)], 'NonZero'));
        if (c.isEmpty()) continue;
        if (ob.dira) bocniDiry.push(c); else pridej(ob.sirka > 0 ? ob.sirka : W, ob.x || 0, c);
      }
      const vrstva = (c, hw) => k(k(c.extrude(2 * hw)).translate([0, 0, -hw]));
      const doSirky = m => k(m.rotate([0, -90, 0]));   // (z, y, c) → x = −c, y, z
      const casti = [k(M.union(desky))];
      for (const { sir, x: posunX, cc } of skupiny.values()) {
        const profil = k(k(k(CS.union(cc)).intersect(zaZdi)).simplify(0.005));
        if (profil.isEmpty()) continue;
        const r = Math.min(tl.hrana, sir / 2 - 1), n = kroku(r), h = n ? r / n : 0, vr = [];
        for (let i = 0; i < n; i++) {
          const c = k(profil.offset(-odsazeni(r, (i + 0.5) * h), 'Round'));
          if (!c.isEmpty()) vr.push(vrstva(c, sir / 2 - i * h));
        }
        vr.push(vrstva(profil, sir / 2 - Math.max(0, r)));
        casti.push(k(doSirky(k(M.union(vr))).translate([posunX, 0, 0])));
      }
      let hacek = k(M.union(casti));
      if (bocniDiry.length) hacek = k(hacek.subtract(doSirky(vrstva(k(CS.union(bocniDiry)), 1000))));

      /* ---------- kapsa pro úchyt (posunutá o y0, pod ní kanál zespodu) ---------- */
      const sk = y => 1 - (1 - uch.sNahore) * (y - uch.y0) / u.vyska;   // měřítko šířky ve výšce y
      const s0 = sk(-1), sTop = sk(uch.vrchKapsy);
      const zaklad = k(prurez(uch.pr).offset(u.vule, 'Miter', 2));
      // ústí u zdi protáhnout za zadní stěnu (z < 0), aby kapsa šla skrz
      const usti = k(k(CS.square([uch.uzky + 2 * u.vule + 0.02, 2], true)).translate([0, 0.5]));
      const pr0 = k(k(CS.union([zaklad, usti])).scale([s0, 1]));
      const kapsa = svisle(pr0, -1, uch.vrchKapsy, sTop / s0);
      hacek = over(k(hacek.subtract(kapsa)), 'věšák');

      /* ---------- úchyt na zeď ---------- */
      let uchyt = svisle(prurez(uch.pr), 0, u.vyska, uch.sNahore);
      const sr = uch.sr, rd = sr.d / 2 + 0.25, rh = sr.hlava / 2 + 0.2;
      const otvory = uch.srouby.map(y => {
        const drik = k(k(M.cylinder(u.hloubka + 2, rd, rd, segKruh(rd))).translate([0, y, -1]));
        const zk = u.hloubka - uch.zapust;     // začátek zahloubení
        const kuzel = k(k(M.cylinder(rh - rd + 0.01, rd, rh + 0.01, segKruh(rh))).translate([0, y, zk - 0.01]));
        const nad = k(k(M.cylinder(1.5, rh, rh, segKruh(rh))).translate([0, y, zk + rh - rd - 0.005]));
        return k(M.union([drik, kuzel, nad]));
      });
      uchyt = over(k(uchyt.subtract(k(M.union(otvory)))), 'úchyt');

      /* ---------- duchové: zeď a vruty ---------- */
      const duchove = [];
      let sx0 = o.obalStitku[0], sx1 = o.obalStitku[2];
      for (const { sir, x } of skupiny.values()) { sx0 = Math.min(sx0, x - sir / 2); sx1 = Math.max(sx1, x + sir / 2); }
      duchove.push({ druh: 'dvere', min: [sx0 - 40, o.yMin - 30, -14], max: [sx1 + 40, o.yMax + 40, 0] });

      return { hacek: naSit(hacek), uchyt: naSit(uchyt), duchove };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  /** Vůle zkušební sady: pět kroků kolem nastavené vůle (nejméně 0,02 mm). */
  const vuleZkousky = p => [-2, -1, 0, 1, 2].map(i => Math.max(0.02, Math.round((p.uchyt.vule + i * p.zkouska.krok) * 1000) / 1000));

  /** Zkušební sada: pět krátkých bloků s kapsou (různé vůle, bez klínu, průchozí) a krátký úchyt bez klínu.
     Počet zářezů na čele bloku = pořadí vůle (1 = nejmenší). Vrací {bloky: [{vule, sit}], uchyt: sit}. */
  function postavZkousku(w, p, o) {
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [], k = x => { smaz.push(x); return x; };
    const u = p.uchyt, uch = o.uch, stena = 3, vys = 14;
    const ccw = body => {
      let a = 0;
      for (let i = 0; i < body.length; i++) { const [x0, y0] = body[i], [x1, y1] = body[(i + 1) % body.length]; a += x0 * y1 - x1 * y0; }
      return a < 0 ? body.slice().reverse() : body;
    };
    const prurez = body => k(new CS([ccw(body.map(([c, a]) => [c, -a]))]));
    const svisle = (cs, y0, y1) => k(k(k(cs.extrude(y1 - y0)).rotate([-90, 0, 0])).translate([0, y0, 0]));
    const naSit = m => {
      const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties, poz = new Float32Array(vp.length / np * 3);
      for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
      return { poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), plocha: m.surfaceArea(), rod: m.genus() };
    };
    try {
      const bloky = vuleZkousky(p).map((v, i) => {
        const sir = u.sirka + 2 * v + 2 * stena, hl = u.hloubka + v + 2.5;
        let blok = k(k(M.cube([sir, vys, hl])).translate([-sir / 2, 0, 0]));
        const zaklad = k(prurez(uch.pr).offset(v, 'Miter', 2));
        const usti = k(k(CS.square([uch.uzky + 2 * v + 0.02, 2], true)).translate([0, 0.5]));
        blok = k(blok.subtract(svisle(k(CS.union([zaklad, usti])), -1, vys + 1)));
        // zářezy na čele: i + 1 kusů
        const zarezy = [];
        for (let j = 0; j <= i; j++) zarezy.push(k(k(M.cube([1, vys + 2, 1.6])).translate([-sir / 2 + 2 + j * 2.2, -1, hl - 0.8])));
        blok = k(blok.subtract(k(M.union(zarezy))));
        return { vule: v, sit: naSit(blok) };
      });
      const uchyt = naSit(svisle(prurez(uch.pr), 0, vys + 10));
      return { bloky, uchyt };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  const API = { postav, postavZkousku, vuleZkousky };
  if (typeof module !== 'undefined') module.exports = API; else window.VESAKY_GEOM = API;
})();

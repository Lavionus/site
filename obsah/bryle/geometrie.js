/* Brýlové obroučky – stavba dílů přes manifold-3d (2D obrysy CrossSection → vytažení → odečtení otvorů a drážky).
   postav(w, p, o, pismo) → {dily: [{jmeno, nazev, role, poz, idx, objem, plocha, rod, montaz, duch}], upozorneni}
   w = inicializovaný manifold, p = normalizovaný projekt, o = BRYLE.odvozene(p),
   pismo = {obrysy, sirka, vyska} (obrysy textu s výškou verzálky 1, např. KLIC.rozvrhniText) nebo null.
   Každý díl je ve vlastních souřadnicích (tak, jak se kreslí): přední díl x napříč, y nahoru, z dozadu (z = 0 čelo);
   stranice x podél (od osy pantu), y nahoru, z = tloušťka (z = 0 vnější strana); čočka vystředěná.
   montaz = matice 3 × 4 po řádcích do sestavy (X doprava, Y dopředu, Z nahoru). */
(function () {
  'use strict';
  const B = typeof module !== 'undefined' ? require('./jadro.js') : window.BRYLE;

  function postav(w, p, o, pismo) {
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [], upozorneni = [];
    const k = x => { smaz.push(x); return x; };
    const SEG = 48, DORAZ = 0.1;   // vůle dorazu stranice (≈ 2,5° vyklopení)
    const segKruh = r => Math.max(20, Math.min(64, Math.ceil(2 * Math.PI * r / 0.6 / 4) * 4));
    const rDiry = r => r / Math.cos(Math.PI / segKruh(r));
    const box = (x0, x1, y0, y1, z0, z1) => k(k(M.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    const ctverec = (x0, x1, y0, y1) => k(k(CS.square([x1 - x0, y1 - y0])).translate([x0, y0]));
    const kruh = (r, x, y) => k(k(CS.circle(r, segKruh(r))).translate([x, y]));
    const pol = P => k(new CS([P], 'Positive'));
    const off = (cs, d) => (Math.abs(d) < 1e-9 ? cs : k(k(cs.offset(d, 'Round', 2, SEG)).simplify(0.002)));
    const vytah = (cs, z0, z1) => k(k(cs.extrude(z1 - z0)).translate([0, 0, z0]));
    const valecY = (r, y0, y1, x, z) => k(k(k(M.cylinder(y1 - y0, r, r, segKruh(r))).rotate([-90, 0, 0])).translate([x, y0, z]));
    const st = p.stranice, T = o.T, cep = p.pant.druh === 'cep';

    try {
      const dily = [];
      const predni = predniDil();
      const sR = stranice(1), sL = stranice(-1);
      const xt = o.xh + o.tS / 2;
      const MR = [0, 0, -1, xt, -1, 0, 0, -o.zh, 0, 1, 0, o.yH], ML = [0, 0, 1, -xt, -1, 0, 0, -o.zh, 0, -1, 0, o.yH];
      const MF = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0];
      if (cep) {
        dily.push(hotovo(predni, 'predni', 'Přední díl', 'predni', MF));
        dily.push(hotovo(sR, 'stranice_P', 'Pravá stranice', 'stranice', MR));
        dily.push(hotovo(sL, 'stranice_L', 'Levá stranice', 'stranice', ML));
      } else {
        // vcelku: stranice v souřadnicích předního dílu (rotace bez zrcadlení)
        const tr = (m, a) => k(m.transform(a));
        const celek = k(M.union([predni, tr(sR, [0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, xt, o.yH, o.zh, 1]), tr(sL, [0, 0, 1, 0, 0, -1, 0, 0, 1, 0, 0, 0, -xt, o.yH, o.zh, 1])]));
        dily.push(hotovo(celek, 'celek', 'Obroučky vcelku', 'predni', MF));
      }
      // čočky (zkušební díl, nebo jen průhledně v sestavě)
      const cR = cocka(), cL = k(cR.mirror([1, 0, 0]));
      const f = o.R ? o.xc / o.R : 0, c = Math.cos(f), s = Math.sin(f), [Xc, Zc] = B.zahni(o, o.xc, o.zc);
      const duch = !p.cocky.zapnuto;
      dily.push(Object.assign(hotovo(cR, 'cocka_P', 'Pravá zkušební čočka', 'cocka', [c, 0, -s, Xc, -s, 0, -c, -Zc, 0, 1, 0, 0]), { duch }));
      dily.push(Object.assign(hotovo(cL, 'cocka_L', 'Levá zkušební čočka', 'cocka', [c, 0, s, -Xc, s, 0, -c, -Zc, 0, 1, 0, 0]), { duch }));
      return { dily, upozorneni };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }

    /** Manifold → síť dílu; zahodí plátky s nulovým objemem a sloučí splývající vrcholy. */
    function hotovo(telo, jmeno, nazev, role, montaz) {
      const stv = telo.status();
      if (stv !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${stv}`);
      if (telo.isEmpty()) throw new Error(`${nazev}: prázdné těleso`);
      const kusy = telo.decompose();
      kusy.forEach(x => k(x));
      if (kusy.length > 1) {
        const plne = kusy.filter(x => x.volume() > 1e-3);
        if (plne.length < kusy.length) telo = k(M.compose(plne));
      }
      telo = k(telo.simplify(1e-3));
      const mesh = telo.getMesh(), np = mesh.numProp, vp = mesh.vertProperties, tv = mesh.triVerts;
      // ve Float32 splynou vrcholy vzdálené pod setinu mikrometru → sloučit a zahodit nulové trojúhelníky
      const f = new Float32Array(3), mapa = new Map(), nove = new Int32Array(vp.length / np), body = [];
      for (let i = 0, v = 0; i < vp.length; i += np, v++) {
        f[0] = vp[i]; f[1] = vp[i + 1]; f[2] = vp[i + 2];
        const kl = f[0] + ',' + f[1] + ',' + f[2];
        let j = mapa.get(kl);
        if (j === undefined) { j = body.length / 3; mapa.set(kl, j); body.push(f[0], f[1], f[2]); }
        nove[v] = j;
      }
      const idx = [];
      for (let t = 0; t < tv.length; t += 3) {
        const a = nove[tv[t]], b = nove[tv[t + 1]], c = nove[tv[t + 2]];
        if (a !== b && b !== c && a !== c) idx.push(a, b, c);
      }
      return { jmeno, nazev, role, poz: new Float32Array(body), idx: new Uint32Array(idx), objem: telo.volume(), plocha: telo.surfaceArea(), rod: telo.genus(),
        teles: kusy.filter(x => x.volume() > 1e-3).length, montaz, duch: false };
    }

    /* ---------- přední díl ---------- */
    function predniDil() {
      const sklo = k(pol(o.obrys).translate([o.xc, 0]));
      const skla = k(sklo.add(k(sklo.mirror([1, 0]))));
      const obruba = off(skla, o.vnejsi);
      // sedlový most: pás mezi očnicemi v obalu obou obrub, bez prostoru nosu
      const xb = o.dbl / 2 + o.A * 0.3, dno = -o.B / 2 - o.vnejsi - 1, vrch = p.most.vyska + p.most.tloustka;
      const most = k(k(ctverec(-xb, xb, dno, vrch).intersect(k(obruba.hull()))).subtract(pol(B.obrysNosu(p.most, o.yDnoNosu))));
      // koncovky s pantem
      const xe0 = o.xc + o.A * 0.25, kon = ctverec(xe0, o.xEnd, o.yH - o.hK / 2, o.yH + o.hK / 2);
      let obrys = k(CS.union([obruba, most, kon, k(kon.mirror([1, 0]))]));
      obrys = off(off(obrys, 1.5), -1.5);     // zaoblit vnitřní rohy (most × obruba)
      obrys = off(off(obrys, -0.8), 0.8);     // a vnější rohy koncovek
      let telo = vytah(obrys, 0, T);
      const odeb = [vytah(off(skla, o.otvor), -1, T + 1)];
      for (const s of o.kroky) odeb.push(vytah(off(skla, s.off), o.zc - s.hw, o.zc + s.hw));
      if (o.profil === 'falc') odeb.push(vytah(skla, T - o.w, T + 1));
      telo = k(M.difference([telo, ...odeb]));
      if (o.R) telo = k(k(telo.refineToLength(2)).warp(v => { const [X, Z] = B.zahni(o, v[0], v[2]); v[0] = X; v[2] = Z; }));
      // patka pantu (rovná záda kolmo dozadu i u ohnutého dílu) a oka
      const pravy = [box(o.xBlok, o.xEndW, o.yH - o.H / 2, o.yH + o.H / 2, o.zStart, o.zBack)];
      if (cep) {
        const oko2 = k(CS.hull([kruh(o.rO, o.xh, -o.zh), ctverec(o.xh, o.xh + o.rO, -o.zBack, -o.zBack + 0.6)]));
        const vys = o.H / 2 - o.k / 2 - o.g;
        for (const y0 of [o.yH + o.k / 2 + o.g, o.yH - o.H / 2]) pravy.push(k(k(oko2.extrude(vys)).transform([1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, y0, 0, 1])));
      }
      let pant = k(M.union(pravy));
      if (cep) {
        pant = k(pant.intersect(box(o.xh - o.rO - 1, o.xEndW, o.yH - o.H, o.yH + o.H, o.zStart - 1, o.zh + o.rO + 1)));
        pant = k(pant.subtract(valecY(rDiry(o.rP), o.yH - o.H / 2 - 1, o.yH + o.H / 2 + 1, o.xh, o.zh)));
      }
      return k(M.union([telo, pant, k(pant.mirror([1, 0, 0]))]));
    }

    /* ---------- stranice (zn = 1 pravá, −1 levá = zrcadlená výška) ---------- */
    function stranice(zn) {
      const S = o.strednice, sStart = cep ? 0 : -(o.g + o.rO) - 0.6;
      const tahy = [ctverec(sStart, 6, -o.h0, o.h0)];
      for (let i = 0; i + 1 < S.length; i++) tahy.push(k(CS.hull([kruh(S[i].h, S[i].x, zn * S[i].y), kruh(S[i + 1].h, S[i + 1].x, zn * S[i + 1].y)])));
      const profil = k(k(CS.union(tahy)).intersect(ctverec(sStart, 1000, -500, 500)));
      let telo = vytah(profil, 0, o.tS);
      if (cep) {
        const oko = k(valecY(o.rO, -o.k / 2, o.k / 2, 0, o.tS / 2).intersect(box(-o.rO - 1, o.rO + 1, -o.k, o.k, 0, o.tS)));
        telo = k(M.union([telo, oko, box(-(o.rO + o.g) + DORAZ, 0.01, -o.k / 2, o.k / 2, 0, o.tS / 2)]));   // doraz o záda koncovky
        telo = k(M.difference([telo, box(-50, o.rO + o.g, o.k / 2, 50, -1, o.tS + 1), box(-50, o.rO + o.g, -50, -o.k / 2, -1, o.tS + 1),
          valecY(rDiry(o.rP), -o.H, o.H, 0, o.tS / 2)]));
      }
      const kde = p.text.kde;
      if (p.text.zapnuto && pismo && pismo.obrysy.length && (kde === 'obe' || (kde === 'prava') === (zn > 0))) telo = rytina(telo, zn);
      return telo;
    }
    function rytina(telo, zn) {
      const sx = o.L1 * 0.45, pt = o.strednice.reduce((a, b) => (Math.abs(b.x - sx) < Math.abs(a.x - sx) ? b : a));
      let v = Math.min(p.text.vyska, 2 * pt.h - 1.4);
      const maxSir = o.L1 * 0.62;
      if (v * pismo.sirka > maxSir) v = maxSir / pismo.sirka;
      const hlas = (uroven, text, pole) => { if (!upozorneni.some(u => u.text === text)) upozorneni.push({ uroven, text, pole }); };
      if (v < 0.8) { hlas('varovani', 'Text se na stranici nevejde – vynechán (zkraťte ho).', ['text.obsah']); return telo; }
      if (v < p.text.vyska - 0.05) hlas('info', `Text zmenšen na výšku ${B.fmt(v, 1)} mm, aby se vešel na stranici.`, ['text.vyska', 'text.obsah']);
      const cs = k(k(k(k(new CS(pismo.obrysy, 'NonZero')).scale([v, v])).rotate(-zn * st.panto)).translate([pt.x, zn * pt.y]));
      return k(telo.subtract(vytah(cs, o.tS - p.text.hloubka, o.tS + 0.5)));
    }

    /* ---------- zkušební čočka (vystředěná, z = tloušťka) ---------- */
    function cocka() {
      const sklo = pol(o.obrys), v = o.vule, tl = p.cocky.tloustka;
      if (o.profil === 'falc') { const t = Math.min(o.w, tl); return vytah(off(sklo, -v), -t / 2, t / 2); }
      const casti = [vytah(off(sklo, o.otvor - v), -tl / 2, tl / 2)];
      for (const s of o.kroky) if (s.hw - v > 0.05) casti.push(vytah(off(sklo, s.off - v), -(s.hw - v), s.hw - v));
      return k(M.union(casti));
    }
  }

  const API = { postav };
  if (typeof module !== 'undefined') module.exports = API; else window.BRYLE_GEOM = API;
})();

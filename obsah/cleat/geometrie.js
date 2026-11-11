/* French cleat – stavba tělesa přes manifold-3d (uzavřená síť).
   postav(w, p, o, font) → {poz, idx, objem, plocha, rod, dilu, duchove, pohledy, pojistkaBlokovana}
   w = inicializovaný manifold (po setup()), p = normalizovaný projekt, o = CLEAT.odvozene(p),
   font = opentype.js písmo pro vyryté popisky (nepovinné – bez něj se popisky vynechají).
   Souřadnice: x podél zdi, y od zdi (líc zdi y = 0), z nahoru (spodek lišty z = 0).
   Profil zboku je CrossSection v rovině (y, z) a vytahuje se podél x.
   Na konci se od držáku odečte lišta zvětšená o vůli a vše za lícem zdi – držák tak nikdy nezasahuje do lišty.
   duchove = zeď, lišta, tyč (průhledně v náhledu, ne do exportu); pohledy = obrysy pro výkres (projekce). */
(function () {
  'use strict';

  // zuby ve V-drážce: rozteč, hloubka do drážky a tvar
  const STYLY_ZUBU = { pilove: { krok: 3, hl: 0.7, tvar: 'hacek' }, jemne: { krok: 1.8, hl: 0.45, tvar: 'hacek' }, zebra: { krok: 2.4, hl: 0.6, tvar: 'zebro' }, vlny: { krok: 3, hl: 0.6, tvar: 'vlna' } };

  /** Text (opentype.js) → polygony v mm, výška h = výška verzálek. Jako v Držácích nářadí. */
  function textPolygony(font, text, h) {
    if (!font || !text) return null;
    const upm = font.unitsPerEm || 2048, cap = (font.tables && font.tables.os2 && font.tables.os2.sCapHeight) || upm * 0.72;
    const path = font.getPath(String(text), 0, 0, h * upm / cap), polys = [];
    let cur = null, x = 0, y = 0;
    const add = (a, b) => { x = a; y = b; cur.push([a, -b]); };
    for (const c of path.commands) {
      if (c.type === 'M') { if (cur && cur.length > 2) polys.push(cur); cur = []; add(c.x, c.y); }
      else if (c.type === 'L') add(c.x, c.y);
      else if (c.type === 'Q') { const x0 = x, y0 = y; for (let i = 1; i <= 6; i++) { const t = i / 6, u = 1 - t; add(u * u * x0 + 2 * u * t * c.x1 + t * t * c.x, u * u * y0 + 2 * u * t * c.y1 + t * t * c.y); } }
      else if (c.type === 'C') { const x0 = x, y0 = y; for (let i = 1; i <= 8; i++) { const t = i / 8, u = 1 - t; add(u * u * u * x0 + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x, u * u * u * y0 + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y); } }
      else if (c.type === 'Z') { if (cur && cur.length > 2) polys.push(cur); cur = null; }
    }
    if (cur && cur.length > 2) polys.push(cur);
    if (!polys.length) return null;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of polys) for (const [a, b] of p) { x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); }
    return { polys, x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
  }

  function postav(w, p, o, font) {
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const nSeg = r => Math.max(16, Math.min(120, Math.ceil(2 * Math.PI * r / 0.6 / 4) * 4));
    const rDiry = r => r / Math.cos(Math.PI / nSeg(r));   // mnohoúhelník opsaný kružnici
    const kruh = (y, z, r) => k(k(CS.circle(r, nSeg(r))).translate([y, z]));
    const poly = body => k(new CS([body], 'NonZero'));
    const obd = (a0, a1, b0, b1) => k(k(CS.square([a1 - a0, b1 - b0])).translate([a0, b0]));
    const sjednot = a => (a.length === 1 ? a[0] : k(CS.union(a)));
    const tlusta = (a, b) => k(CS.hull([kruh(a[0], a[1], a[2]), kruh(b[0], b[1], b[2])]));   // úsečka s kulatými konci [y, z, r]
    /** morfologické uzavření = vnitřní rohy zaoblené poloměrem r; otevření = vnější rohy */
    const zavri = (cs, r) => (r > 0.05 ? k(k(cs.offset(r, 'Round', 2, nSeg(r))).offset(-r, 'Round', 2, nSeg(r))) : cs);
    const otevri = (cs, r) => (r > 0.05 ? k(k(cs.offset(-r, 'Round', 2, nSeg(r))).offset(r, 'Round', 2, nSeg(r))) : cs);
    /** profil (y, z) vytažený podél x od x0 do x1, boky sražené schůdky po ≤ 0,2 mm (při tisku na boku = vrstvy) */
    // simplify: po booleanech zůstávají hrany kratší než přesnost Float32 → nulové trojúhelníky v exportu
    const naX = (cs, x0, x1) => k(k(k(cs.simplify(1e-3)).extrude(x1 - x0)).transform([0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, x0, 0, 0, 1]));
    /** hrany = 'zkosene' (45°) nebo 'oble' (čtvrtkruh poloměru sraz) – obojí jako schůdky po ≤ 0,2 mm */
    function vytahni(cs, x0, x1, sraz = 0, hrany = 'zkosene') {
      if (!(sraz > 0.05) || x1 - x0 < 2 * sraz + 0.6) return naX(cs, x0, x1);
      const n = Math.ceil(sraz / 0.2 - 1e-9), h = sraz / n, casti = [naX(cs, x0 + sraz, x1 - sraz)];
      for (let i = 0; i < n; i++) {
        const xm = (i + 0.5) * h, zapust = hrany === 'oble' ? sraz - Math.sqrt(Math.max(0, sraz * sraz - (sraz - xm) ** 2)) : sraz - xm;
        const vrstva = k(cs.offset(-zapust, 'Miter', 2));
        if (vrstva.isEmpty()) continue;
        casti.push(naX(vrstva, x0 + i * h, x0 + (i + 1) * h), naX(vrstva, x1 - (i + 1) * h, x1 - i * h));
      }
      return k(M.union(casti));
    }
    /** (x, z) vytažené podél y od y0 do y1 */
    const naY = (cs, y0, y1) => k(k(k(cs.simplify(1e-3)).extrude(y1 - y0)).transform([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, y1, 0, 1]));
    /** (x, y) vytažené podél z */
    const naZ = (cs, z0, z1) => k(k(k(cs.simplify(1e-3)).extrude(z1 - z0)).translate([0, 0, z0]));
    const kvadr = (x0, x1, y0, y1, z0, z1) => k(k(M.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    const valecZ = (x, y, r0, r1, z0, z1, seg) => k(k(M.cylinder(z1 - z0, seg ? r0 : rDiry(r0), seg ? r1 : rDiry(r1), seg || nSeg(Math.max(r0, r1)))).translate([x, y, z0]));
    const valecY = (x, z, r0, r1, y0, y1) => k(k(k(M.cylinder(y1 - y0, rDiry(r0), rDiry(r1), nSeg(Math.max(r0, r1)))).rotate([-90, 0, 0])).translate([x, y0, z]));
    const kuzelX = (y, z, r0, r1, x0, x1) => k(k(k(M.cylinder(x1 - x0, rDiry(r0), rDiry(r1), nSeg(Math.max(r0, r1)))).rotate([0, 90, 0])).translate([x0, y, z]));
    const valecX = (y, z, r, x0, x1) => k(k(k(M.cylinder(x1 - x0, r, r, 48)).rotate([0, 90, 0])).translate([x0, y, z]));
    /** Komponenty sítě s nulovým objemem (tenký plátek zploštěný Float32) pryč – nesou jen nulové plošky. */
    function bezPlatku(poz, idx) {
      const rodic = new Int32Array(poz.length / 3).map((_, i) => i);
      const koren = x => { while (rodic[x] !== x) { rodic[x] = rodic[rodic[x]]; x = rodic[x]; } return x; };
      for (let t = 0; t < idx.length; t += 3) { const a = koren(idx[t]); rodic[koren(idx[t + 1])] = a; rodic[koren(idx[t + 2])] = a; }
      const objem = new Map();
      for (let t = 0; t < idx.length; t += 3) {
        const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]].map(i => [poz[3 * i], poz[3 * i + 1], poz[3 * i + 2]]);
        const v = (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6, kk = koren(idx[t]);
        objem.set(kk, (objem.get(kk) || 0) + v);
      }
      if (![...objem.values()].some(v => Math.abs(v) < 1e-3)) return idx;
      const zbyle = [];
      for (let t = 0; t < idx.length; t += 3) if (Math.abs(objem.get(koren(idx[t]))) >= 1e-3) zbyle.push(idx[t], idx[t + 1], idx[t + 2]);
      return zbyle;
    }
    /** Síť z manifoldu ve Float32. Vrcholy, které Float32 slije (manifold je drží ~1e-7 mm od sebe na švech sražených boků),
       se svaří a trojúhelníky s opakovaným vrcholem vypadnou – jinak by export měl nulové plošky. */
    const sit = m => {
      const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties, tv = mesh.triVerts;
      const mapa = new Map(), novy = new Uint32Array(vp.length / np), poz = [];
      for (let i = 0; i < novy.length; i++) {
        const x = Math.fround(vp[i * np]), y = Math.fround(vp[i * np + 1]), z = Math.fround(vp[i * np + 2]), klic = x + ',' + y + ',' + z;
        let j = mapa.get(klic);
        if (j === undefined) { j = poz.length / 3; mapa.set(klic, j); poz.push(x, y, z); }
        novy[i] = j;
      }
      let idx = [];
      for (let t = 0; t < tv.length; t += 3) {
        const a = novy[tv[t]], b = novy[tv[t + 1]], c = novy[tv[t + 2]];
        if (a !== b && b !== c && a !== c) idx.push(a, b, c);
      }
      idx = bezPlatku(poz, idx);
      // svaření nesmí slepit dvě dotýkající se plochy do nevarietní hrany – pak raději síť přímo z manifoldu
      const nV = poz.length / 3, hrany = new Map();
      for (let t = 0; t < idx.length; t += 3) for (let j = 0; j < 3; j++) {
        const a = idx[t + j], b = idx[t + (j + 1) % 3], klic = a * nV + b;
        hrany.set(klic, (hrany.get(klic) || 0) + 1);
      }
      let varietni = true;
      for (const [klic, n] of hrany) if (n !== 1 || hrany.get((klic % nV) * nV + Math.floor(klic / nV)) !== 1) { varietni = false; break; }
      if (!varietni) {
        const surove = new Float32Array(novy.length * 3);
        for (let i = 0; i < novy.length; i++) { surove[3 * i] = vp[i * np]; surove[3 * i + 1] = vp[i * np + 1]; surove[3 * i + 2] = vp[i * np + 2]; }
        return { poz: surove, idx: new Uint32Array(bezPlatku(surove, Array.from(tv))), nesvareno: true };
      }
      return { poz: new Float32Array(poz), idx: new Uint32Array(idx) };
    };
    const duch = m => Object.assign({ typ: 'sit' }, sit(m));
    const duchove = [];
    let pojistkaBlokovana = false, popisku = 0, odlehcenych = 0, vzorky = null;
    const { T, H, ta, c, gw, yZ, y0, zTop, zBot } = o, zadaTop = o.zadaTop;
    const profilListy = () => poly([[0, 0], [T, 0], [T, H], [0, H - T * ta]]);

    try {
      let telo = p.typ === 'zkouska' ? (o.zkouska.druh === 'merka' ? merka() : zkouskaVule()) : p.typ === 'lista' ? lista() : drzak();
      const st = telo.status();
      if (st !== 'NoError') throw new Error('manifold hlásí ' + st);
      if (telo.isEmpty()) throw new Error('výsledné těleso je prázdné');
      const kusy = telo.decompose();
      kusy.forEach(x => k(x));
      if (kusy.length > 1) {
        const plne = kusy.filter(x => x.volume() > 1e-3);
        if (plne.length < kusy.length) telo = k(M.compose(plne));
      }
      // slité vrcholy po sjednocení dávají nulové trojúhelníky – sloučit (tolerance 1 µm, tvar se nezmění)
      telo = k(telo.simplify(1e-3));
      const s = sit(telo);
      // obrysy pro výkres: projekce zboku (y, z), zepředu (x, z) a shora (x, y)
      const obrys = m => k(m.project()).toPolygons().map(pl => pl.map(b => (Array.isArray(b) ? b : [b.x, b.y])));
      const pohledy = {
        bok: obrys(k(telo.transform([0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1]))),
        cela: obrys(k(telo.transform([1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1]))),
        shora: obrys(telo),
      };
      return Object.assign(s, { odlehcenych, nesvareno: !!s.nesvareno, objem: telo.volume(), plocha: telo.surfaceArea(), rod: telo.genus(), duchove, dilu: kusy.length, vzorky, pohledy, pojistkaBlokovana, popisku });
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }

    /* ---------- držák: záda + zámek + funkční část ---------- */
    /** Profil zad se zámkem v rovině (y, z) pro rozměry oo (= o, nebo vzorek zkoušky s jinou vůlí); lišta s vůlí je už odečtená. */
    function profilZad(oo) {
      const { c, gw, yZ, y0, zTop, zBot, zadaTop, H, ta } = oo, r = oo.r;
      const zadaObd = obd(yZ, y0, zBot, zadaTop);
      const listaC = k(profilListy().offset(c, 'Miter', 4));   // lišta zvětšená o vůli
      const casti = [zadaObd];
      if (oo.kopieUkosu) {
        // zámek kopíruje úkos: pás tloušťky „nad“ kolem lišty (líc → přes roh → po úkosu ke zdi);
        // závěs pokračuje za lištou dolů jako ocas až do zOcas (lišta na kontralatích)
        const t = p.zada.nad, spodek = oo.zaves ? oo.zOcas : H - oo.pokles - 1;
        casti.push(k(k(listaC.offset(t, 'Round', 2, nSeg(t))).intersect(obd(gw, y0, spodek, zTop + 1))));
      } else casti.push(obd(gw, yZ + 0.01, H - oo.pokles - 1, zTop));
      if (oo.patka > 0) casti.push(obd(gw, yZ + 0.01, zBot, zBot + oo.patka));
      let profil = sjednot(casti);
      // u pásu zámku zaoblit přechod do silnějších zad (výřez lišty se odečte až potom)
      if (oo.kopieUkosu) {
        // jen nad horní hranou lišty – jinak by zaoblení přemostilo ústí pod lištou (u závěsu) a vznikla by polička pod ní
        const vyplne = k(k(k(zavri(profil, Math.max(r, oo.b))).subtract(profil)).intersect(obd(yZ - 0.01, y0 + 1, H, zTop + 1)));
        profil = k(CS.union([profil, vyplne]));
      }
      if (oo.zaves) {
        // konec ocasu seříznutý 45° (stoupá ke zdi) – nastojato bez převisu; vnitřní plocha u lišty zůstane v plné délce
        const yi = -c, t = p.zada.nad, zo = oo.zOcas;
        profil = k(profil.subtract(poly([[yi + 0.5, zo - 0.5], [yi - t - 2, zo + t + 2], [yi - t - 2, zo - 10], [yi + 0.5, zo - 10]])));
      }
      if (oo.spicka > 0.05 && !oo.zaves) {
        // sražení 45° dolů ke zdi: nastojato i na boku bez převisu
        const s = oo.spicka, z0 = oo.zL(gw), u = s / (1 + ta), dole = H - oo.pokles - 5;
        profil = k(profil.subtract(poly([[gw - 1, z0 + s + 1], [gw + u, z0 + ta * u], [gw + u, dole], [gw - 1, dole]])));
      }
      // pod spodkem zad nic (u krátkých zad by tam visel kus zámku / pásu); ocas závěsu a patka jsou za zády, ty zůstanou
      profil = k(profil.subtract(obd(yZ - 0.01, y0 + 1, zBot - 500, zBot)));
      return { profil: k(profil.subtract(listaC)), zadaObd, listaC };
    }

    function drzak() {
      const W = o.W, r = o.r, hrany = p.zada.hrany;
      let { profil, zadaObd, listaC } = profilZad(o);
      const telo = [], odeber = [], predni = [];   // predni = funkční profily přes celou šířku zad
      const zakaz = [];   // obdélníky [x0, x1, z0, z1] v pohledu zepředu, kde se záda nesmí odlehčit (kořeny, otvory, …)
      const zakazPasy = (cs, x0, x1) => { for (const pl of k(cs.intersect(obd(y0 - 0.3, y0 + 0.3, zBot - 1000, zTop + 1000))).toPolygons()) { const zz = pl.map(b => (Array.isArray(b) ? b[1] : b.y)); zakaz.push([x0, x1, Math.min(...zz) - r, Math.max(...zz) + r]); } };
      /** Funkční profil před zády s koutovým zaoblením u zad; vrací jen část před zády (+ přesah 0,3 mm).
         Zaoblení se bere jen v pásu r u zad kolem míst, kde se profil zad dotýká – jinak by zalilo i úmyslné
         úzké mezery (lůžko tyče, štěrbinu jazýčku). */
      const predZady = cs => {
        const predek = obd(y0 - 0.3, y0 + 1000, zBot - 1000, zTop + 1000);
        if (!(r > 0.05)) return k(cs.intersect(predek));
        const spolu = k(CS.union([zadaObd, cs]));
        const koreny = k(cs.intersect(obd(y0 - 0.3, y0 + 0.3, zBot - 1000, zTop + 1000))).toPolygons();
        // pás koutu jen ve výšce zad (pod a nad zády není do čeho zaoblit)
        const pasy = koreny.map(pl => { const zz = pl.map(b => (Array.isArray(b) ? b[1] : b.y)); return [Math.max(zBot, Math.min(...zz) - r), Math.min(zadaTop, Math.max(...zz) + r)]; })
          .filter(([a, b]) => b > a + 0.01).map(([a, b]) => obd(y0 - 0.3, y0 + r, a, b));
        if (!pasy.length) return k(cs.intersect(predek));
        let kouty = k(k(k(zavri(spolu, r)).subtract(spolu)).intersect(sjednot(pasy)));
        const kusy = kouty.decompose().map(k).filter(x => x.area() > 1);   // drobné osamocené ostrůvky pryč
        if (!kusy.length) return k(cs.intersect(predek));
        kouty = k(sjednot(kusy).offset(0.02, 'Miter', 2));   // přesah 0,02 mm – kout dosedá na záda jen hranou, po zaokrouhlení by zbyla vlasová mezera
        return k(k(CS.union([cs, kouty])).intersect(predek));
      };
      if (p.typ === 'hak' && o.hak.tvar === 'role') {
        // tyč na roli: rameno jen z jedné strany (x 0…ta), tyč podél zad, na konci zarážka (kužel 45° + kotouč – na boku bez podpor)
        const h = o.hak, vys = Math.max(h.t0, 2 * h.rr);
        const rameno = predZady(otevri(obd(y0 - 0.5, h.yr + h.rr, h.zA, h.zA + vys), Math.min(3, h.ta / 2 - 0.5, vys / 2 - 0.5)));
        telo.push(vytahni(rameno, 0, h.ta, o.sraz, hrany));
        zakazPasy(rameno, 0, h.ta);
        const xk = W - h.kon;
        telo.push(kuzelX(h.yr, h.zr, h.rr, h.rr, h.ta - 1, xk - h.kon), kuzelX(h.yr, h.zr, h.rr, h.rr + h.kon, xk - h.kon - 0.01, xk), kuzelX(h.yr, h.zr, h.rr + h.kon, h.rr + h.kon, xk - 0.01, W));
        duchove.push(duch(kuzelX(h.yr, h.zr, h.rr + 25, h.rr + 25, h.ta + 5, xk - h.kon - 5)));   // role
      } else if (p.typ === 'hak') {
        const h = o.hak, rameno = predZady(profilHaku(h));
        if (h.celou) { predni.push(rameno); zakazPasy(rameno, 0, W); }
        else for (const [xa, xb] of h.xs) { telo.push(vytahni(rameno, xa, xb, o.sraz, hrany)); zakazPasy(rameno, xa, xb); }
        if (h.tvar === 'kolebka') duchove.push(duch(valecX(h.yc, h.zr, h.rr - p.hak.vuleTyce, -30, W + 30)));
        if (h.vDrazka && h.svisla) for (const xc of h.vDrazka.xs) {
          const v = h.vDrazka;
          odeber.push(naY(vDrazka(xc, v.zt, v.w0, v.hd, v.usti, p.hak.vZuby, v.ro, v.wd), v.y0, v.y1));
        }
      } else if (p.typ === 'police') { const cs = predZady(profilPolice(o.police)); predni.push(cs); zakazPasy(cs, 0, W); }
      else if (p.typ === 'svorka' && o.svorka.tvar === 'klip' && !o.svorka.svisle) {
        const q = o.svorka, cs = predZady(klip(q.uc, q.vc));
        predni.push(cs); zakazPasy(cs, 0, W);
        duchove.push(duch(valecX(q.uc, q.vc, p.svorka.prumer / 2, -30, W + 30)));
      }
      if (predni.length) profil = k(CS.union([profil, ...predni]));
      telo.push(vytahni(profil, 0, W, o.sraz, hrany));
      if (o.rohy > 0.3) {
        // zaoblené rohy zad v pohledu zepředu: odříznout rohy jen v rozsahu zad a zámku (y ≤ líc zad), háky a police vpředu zůstanou
        const R = o.rohy;
        for (const [xr, sx] of [[0, 1], [W, -1]]) for (const [zr, sz] of [[zBot, 1], [zTop, -1]]) {
          const ctverec = obd(Math.min(xr, xr + sx * (R + 1)), Math.max(xr, xr + sx * (R + 1)), Math.min(zr, zr + sz * (R + 1)), Math.max(zr, zr + sz * (R + 1)));
          const roh = k(k(ctverec.subtract(kruh(xr + sx * R, zr + sz * R, R))).intersect(obd(Math.min(xr, xr + sx * R) - 1e-3, Math.max(xr, xr + sx * R) + 1e-3, Math.min(zr, zr + sz * R) - 1e-3, Math.max(zr, zr + sz * R) + 1e-3)));
          odeber.push(naY(k(roh.offset(0.001, 'Miter', 2)), -10, y0 + 0.001));
        }
      }
      if (p.typ === 'stojan') stojan(telo, odeber);
      else if (p.typ === 'kapsa') kapsa(telo, odeber);
      else if (p.typ === 'deska') deska(telo, odeber, zakaz);
      else if (p.typ === 'svorka') svorka(telo, odeber);
      // zakázané oblasti odlehčení u 3D funkčních částí
      if (p.typ === 'stojan') { const q = o.stojan; zakaz.push([-1, W + 1, zBot - 1, (q.vrtaky ? q.ztMax : zBot + q.tp) + 3]); if (q.tg) zakaz.push([-1, q.tg + 2, zBot, zBot + q.hg + 2], [W - q.tg - 2, W + 1, zBot, zBot + q.hg + 2]); }
      if (p.typ === 'svorka' && o.svorka.tvar === 'klip' && o.svorka.svisle) for (const x of o.svorka.xs) zakaz.push([x - o.svorka.wa / 2 - 2, x + o.svorka.wa / 2 + 2, zBot - 1, zBot + p.svorka.vyska + 2]);
      if (o.pojistka) zakaz.push([o.pojistka.x - 6, o.pojistka.x + 6, o.pojistka.z - 6, o.pojistka.z + 6]);
      if (p.zada.odlehceni !== 'zadne' && p.typ !== 'kapsa' && !(p.typ === 'svorka' && o.svorka.tvar === 'v')) odlehceni(odeber, zakaz);
      if (o.pojistka) {
        const q = o.pojistka, d = q.d;
        odeber.push(valecY(q.x, q.z, d.ro, d.ro, yZ - 1, y0 + 1), valecY(q.x, q.z, d.ro, d.ro + d.hz, y0 - d.hz, y0 + 0.001));   // jen kužel hlavy – co je před zády, hlídá pojistkaBlokovana
      }
      // lišta s vůlí a vše za zdí pryč
      odeber.push(naX(listaC, -20, W + 20), kvadr(-20, W + 20, gw - 200, gw, zBot - 50, zTop + 400));
      let tel = k(M.union(telo));
      tel = k(M.difference([tel, ...odeber]));
      if (o.zub) {
        // zub pod zámkem proti posunu do strany – zasahuje do lišty (do ní se uřízne zářez), proto až po odečtení lišty
        const zb = o.zub;
        tel = k(M.union([tel, naX(poly(zb.body), zb.x - zb.w / 2, zb.x + zb.w / 2)]));
      }
      if (o.pojistka) {
        // šroubovák Ø 8 zepředu k pojistnému vrutu
        const cesta = valecY(o.pojistka.x, o.pojistka.z, 4, 4, y0 + 0.5, y0 + 400);
        pojistkaBlokovana = k(tel.intersect(cesta)).volume() > 0.5;
      }
      // duchové: zeď a lišta
      const zMin = Math.min(zBot, 0) - 30, zMax = Math.max(o.horni, H) + 30;
      duchove.push({ typ: 'box', min: [-60, o.yZed - 10, zMin], max: [W + 60, o.yZed, zMax] });
      // kontralatě za lištou (vedle dílu – držák se věší mezi ně)
      if (o.zaves && o.yZed < -0.5) for (const x0 of [-60, W + 25]) duchove.push({ typ: 'box', min: [x0, o.yZed, zMin], max: [x0 + 35, 0, zMax] });
      duchove.push(duch(naX(profilListy(), -40, W + 40)));
      return tel;
    }

    /** Páteř háku J (body [y, z, poloměr]) podle parametrů z CLEAT.odvozene – rovně, ohyb, svisle, případně zahnutí zpět ke zdi. */
    function paterJ(J, t0, t1) {
      const body = [[y0 - t0 / 2, J.zc0]];
      const [cy, cz] = J.Cb, Rs = J.Rs;
      body.push([cy, J.zc0]);
      let fiK = 0;
      if (J.zTip < cz) fiK = Math.asin(Math.max(-1, (J.zTip - cz) / Rs));
      const n = Math.max(4, Math.ceil((fiK + Math.PI / 2) * Rs / 1.2));
      for (let i = 1; i <= n; i++) { const f = -Math.PI / 2 + (fiK + Math.PI / 2) * i / n; body.push([cy + Rs * Math.cos(f), cz + Rs * Math.sin(f)]); }
      const konecOblouku = body.length - 1;
      if (J.svisla) {
        body.push([J.xv, J.zTip]);
        if (J.fz > 0.01) {
          // zahnutí: oblouk kolem středu ke zdi od svislé špičky
          const m = Math.max(3, Math.ceil(J.fz * J.Rz / 1.2));
          for (let i = 1; i <= m; i++) { const f = J.fz * i / m; body.push([J.xv - J.Rz + J.Rz * Math.cos(f), J.zTip + J.Rz * Math.sin(f)]); }
        }
      }
      // tloušťka se zužuje po páteři do konce oblouku, svislá část má tloušťku špičky (vnější líc svisle = dosah)
      const d = [0];
      for (let i = 1; i < body.length; i++) d.push(d[i - 1] + Math.hypot(body[i][0] - body[i - 1][0], body[i][1] - body[i - 1][1]));
      const L = d[konecOblouku] || 1;
      return body.map((b, i) => [b[0], b[1], (t0 + (t1 - t0) * Math.min(1, d[i] / L)) / 2]);
    }
    function hakZPatere(pts) {
      const seg = [];
      for (let i = 1; i < pts.length; i++) seg.push(tlusta(pts[i - 1], pts[i]));
      const kon = pts[pts.length - 1];
      if (p.hak.koule > 2 * kon[2]) seg.push(kruh(kon[0], kon[1], p.hak.koule / 2));
      return seg;
    }

    function profilHaku(h) {
      const t0 = h.t0, t1 = h.t1, seg = [];
      if (h.tvar === 'J' || h.tvar === 'dvojity') {
        seg.push(...hakZPatere(paterJ(h, t0, t1)));
        if (h.druhy) seg.push(...hakZPatere(paterJ(h.druhy, t0, t1)));
      } else if (h.tvar === 'kolik') {
        const [ky, kz] = h.konec;
        seg.push(tlusta([y0 - t0 / 2, h.zc0, t0 / 2], [ky, kz, t1 / 2]));
        if (h.rk > t1 / 2 + 0.01) seg.push(kruh(ky, kz, h.rk));
      } else {
        // kolébka: rameno + blok s lůžkem; vnější rohy bloku oblé
        const { rr, st, yc, zr, zA } = h, horni = h.horni;
        let cs = k(CS.union([obd(yc - rr - st, yc + rr + st, zA, horni), obd(y0 - 0.5, yc, zA, zA + t0)]));
        cs = otevri(cs, Math.min(st * 0.9, t0 / 2 - 0.3, 3));   // zaoblení nesmí ukousnout tenké rameno
        seg.push(k(cs.subtract(k(CS.union([kruh(yc, zr, rr), obd(yc - rr, yc + rr, zr, horni + 10)])))));
      }
      if (h.vzpera) seg.push(tlusta([...h.vzpera.P0, h.vzpera.ts / 2], [...h.vzpera.P1, h.vzpera.ts / 2]));
      return sjednot(seg);
    }

    /** C-klip v rovině (u = od zdi, v = do strany): kroužek s otvorem vpředu, krček k zádům, náběh = rozevřené konce.
       sw = prohodit osy (svislý klip se kreslí v půdorysu (x, y) = (v, u)). */
    function klip(uc, vc, sw) {
      const q = o.svorka, P = p.svorka, Ri = q.Ri, Ro = q.Ro, s = P.stena;
      const K = (u, v, r) => (sw ? kruh(v, u, r) : kruh(u, v, r));
      const B = (u0, u1, v0, v1) => (sw ? obd(v0, v1, u0, u1) : obd(u0, u1, v0, v1));
      const Pl = body => poly(sw ? body.map(([u, v]) => [v, u]) : body);
      const Tl = (a, b) => (sw ? tlusta([a[1], a[0], a[2]], [b[1], b[0], b[2]]) : tlusta(a, b));
      let cs = k(CS.union([K(uc, vc, Ro), B(y0 - 0.3, uc, vc - q.wa / 2, vc + q.wa / 2)]));
      const Rb = 3 * Ro, sb = Math.sin(q.beta), cb = Math.cos(q.beta);
      cs = k(cs.subtract(k(CS.union([K(uc, vc, Ri), Pl([[uc, vc], [uc + Rb * cb, vc - Rb * sb], [uc + Rb, vc - Rb * sb], [uc + Rb, vc + Rb * sb], [uc + Rb * cb, vc + Rb * sb]])]))));
      if (P.nabeh > 0.2) {
        const Rm = Ri + s / 2, g = q.beta + 40 * Math.PI / 180, lipy = [cs];
        for (const z of [1, -1]) {
          const E = [uc + Rm * cb, vc + z * Rm * sb];
          lipy.push(Tl([E[0], E[1], s / 2], [E[0] + P.nabeh * Math.cos(g), E[1] + z * P.nabeh * Math.sin(g), s * 0.4]));
        }
        cs = k(k(CS.union(lipy)).subtract(K(uc, vc, Ri)));
      }
      return cs;
    }

    function svorka(telo, odeber) {
      const q = o.svorka, P = p.svorka;
      if (q.tvar === 'klip') {
        if (!q.svisle) return;   // vodorovný klip je součástí profilu zad
        for (const x of q.xs) {
          // kroužek v půdorysu (x, y)
          telo.push(naZ(klip(q.uc, x, true), zBot, zBot + P.vyska));
          duchove.push(duch(valecZ(x, q.uc, P.prumer / 2, P.prumer / 2, zBot - 40, zBot + P.vyska + 40)));
        }
        return;
      }
      // V-drážky: blok před zády, drážky shora otevřené dopředu, zuby proti vytažení
      telo.push(kvadr(0, o.W, y0 - 0.3, y0 + q.D, zBot, q.zt));
      for (const xc of q.xs) odeber.push(naY(vDrazka(xc, q.zt, q.w0, q.hd, q.usti, P.zuby, q.ro, q.wd), y0, y0 + q.D + 1));
    }

    /** V-drážka v pohledu zepředu (x, z) jako CrossSection: ústí se sražením, stěny se sbíhají ke dnu,
       zuby podle stylu (hladké / pilové a jemné = háčky proti vytažení nahoru / žebra / vlnky), na dně volitelně kulatý otvor. */
    function vDrazka(xc, zt, w0, hd, usti, styl, ro, wd) {
      const lev = [], wHorni = w0 / 2, wDno = Math.max(0.05, wd / 2), zH = zt - usti, zD = zt - hd;
      const xStena = z => xc - (wDno + (wHorni - wDno) * (z - zD) / (zH - zD));   // levá stěna V (dole poloviční šířka dna)
      lev.push([xc - wHorni - usti, zt + 1], [xc - wHorni - usti, zt], [xStena(zH), zH]);
      const S = STYLY_ZUBU[styl];
      if (S) {
        const n = Math.floor((zH - zD - 2) / S.krok), konec = zD + Math.max(1.5, ro + 0.8);
        for (let i = 0; i < n; i++) {
          const zA = zH - 0.8 - i * S.krok, zB = zA - S.krok * (S.tvar === 'hacek' ? 0.67 : 1);
          if (zB < konec || xc - xStena(zB) < S.hl + 0.6) break;   // u dna je drážka úzká – zub by přerostl osu
          if (S.tvar === 'hacek') lev.push([xStena(zA), zA], [xStena(zB) + S.hl, zB], [xStena(zB), zB]);   // šikmo dolů, vodorovná plocha drží
          else if (S.tvar === 'zebro') lev.push([xStena(zA), zA], [xStena((zA + zB) / 2) + S.hl, (zA + zB) / 2], [xStena(zB), zB]);
          else for (let j = 0; j <= 6; j++) { const t = j / 6, z = zA + (zB - zA) * t; lev.push([xStena(z) + S.hl * Math.sin(Math.PI * t), z]); }
        }
      }
      lev.push([xStena(zD), zD]);
      const v = poly(lev.concat(lev.slice().reverse().map(([x, z]) => [2 * xc - x, z])));
      return ro > 0.2 ? k(CS.union([v, kruh(xc, zD, ro)])) : v;
    }

    function profilPolice(q) {
      const D = q.D, top = q.zt, deg = q.sk * 180 / Math.PI;
      const desky = [obd(y0 - 0.3, y0 + D, top - q.tp, top)];
      if (q.lem > 0) desky.push(obd(y0 + D - q.tl, y0 + D, top - 0.5, top + q.lem));
      let deska = sjednot(desky);
      if (Math.abs(deg) > 0.01) deska = k(k(k(deska.translate([-y0, -top])).rotate(deg)).translate([y0, top]));
      const casti = [deska], yk = y0 + q.kv * D;
      if (q.vzpera === 'plna') casti.push(poly([[y0 - 0.3, zBot], q.rot([yk, top - q.tp + 0.01]), q.rot([y0 - 0.3, top - q.tp + 0.01])]));
      else if (q.vzpera === 'prihradova') {
        const r = q.ts / 2, kon = q.rot([yk - r, top - r]);
        casti.push(tlusta([y0 - 0.3, zBot + r, r], [kon[0], kon[1], r]));
      }
      return sjednot(casti);
    }

    function stojan(telo, odeber) {
      const q = o.stojan, P = p.stojan, W = o.W, zb = zBot;
      if (q.vrtaky) {
        // schody: přední řada nejnižší, každá další blíž zdi o schod výš
        q.rady.forEach(rd => telo.push(kvadr(0, W, y0 - 0.3, rd.y1, zb, rd.zt)));   // každý schod od zad po svou přední hranu
        if (q.tg > 0 && q.hg > q.tp + 1) {
          const zt0 = zb + q.tp, tri = poly([[y0 - 0.3, zt0 - 0.3], [y0 + 0.9 * q.D, zt0 - 0.3], [y0 - 0.3, zb + q.hg]]);
          telo.push(naX(tri, 0, q.tg), naX(tri, W - q.tg, W));
        }
        for (const t of q.otvory) {
          const r = t.d / 2;
          odeber.push(valecZ(t.x, t.y, r, r, t.zt - t.h, t.zt + 1));
          if (q.sraz > 0.05) odeber.push(valecZ(t.x, t.y, r, r + q.sraz + 0.01, t.zt - q.sraz, t.zt + 0.01));
          if (P.popisky && font) {
            // popisek Ø před otvorem, čte se zepředu (otočený o 180°)
            let tx = textPolygony(font, t.jmeno, q.hp * 0.85);
            const maxW = Math.max(t.d + 1, 4);
            if (tx && tx.w > maxW * 1.6) tx = textPolygony(font, t.jmeno, q.hp * 0.85 * maxW * 1.6 / tx.w);
            if (tx) {
              const cs = k(k(new CS(tx.polys, 'NonZero')).rotate(180));
              const sx = tx.x0 + tx.w / 2, sy = tx.y0 + tx.h / 2;
              odeber.push(k(k(cs.extrude(P.hloubkaPisma + 1)).translate([t.x + sx, t.py + sy, t.zt - P.hloubkaPisma])));
              popisku++;
            }
          }
        }
        return;
      }
      const zt = zb + q.tp;
      telo.push(kvadr(0, W, y0 - 0.3, y0 + q.D, zb, zt));
      if (q.tg > 0 && q.hg > q.tp + 1) {
        // bočnice: trojúhelník nad deskou, šikmá hrana míří nahoru (na stojato bez podpor)
        const tri = poly([[y0 - 0.3, zt - 0.3], [y0 + 0.9 * q.D, zt - 0.3], [y0 - 0.3, zb + q.hg]]);
        telo.push(naX(tri, 0, q.tg), naX(tri, W - q.tg, W));
      }
      const zh = q.slepe ? zt - q.hloubka : zb - 1;
      for (const t of q.otvory) {
        if (P.druh === 'kruh') {
          const r = P.prumer / 2;
          odeber.push(valecZ(t.x, t.y, r, r, zh, zt + 1));
          if (q.sraz > 0.05) odeber.push(valecZ(t.x, t.y, r, r + q.sraz + 0.01, zt - q.sraz, zt + 0.01), valecZ(t.x, t.y, r + q.sraz, r + q.sraz, zt, zt + 1));
        } else if (P.druh === 'sestihran') {
          const r = P.prumer / 2 / Math.cos(Math.PI / 6);   // vrchol podél x
          odeber.push(valecZ(t.x, t.y, r, r, zh, zt + 1, 6));
          if (q.sraz > 0.05) odeber.push(valecZ(t.x, t.y, r, r + q.sraz / Math.cos(Math.PI / 6) + 0.01, zt - q.sraz, zt + 0.01, 6));
        } else {
          // drážka otevřená dopředu se zaobleným koncem, případně užším hrdlem (zacvaknutí) a náběhem
          const r = P.sirkaDrazky / 2, yf = y0 + q.D, yk = yf - q.dy + r, ln = q.hrdlo ? 2.5 + q.nabeh : 0, wn = q.hrdlo || 2 * r;   // hrdlo 2,5 mm za náběhem
          const konec = ln ? yf - ln : yf + 1.5;   // kam sahá plná šířka drážky
          // plná šířka jen po hrdlo (u krátké drážky by kulatý konec hrdlo přerostl)
          const casti = [k(k(CS.hull([k(k(CS.circle(r, nSeg(r))).translate([t.x, yk])), k(k(CS.square([2 * r, 2])).translate([t.x - r, konec - 2]))])).intersect(obd(t.x - r - 1, t.x + r + 1, y0 - 10, konec)))];
          if (ln) casti.push(k(k(CS.square([wn, ln + 1.5])).translate([t.x - wn / 2, yf - ln - 0.5])));
          if (q.nabeh > 0.1) casti.push(poly([[t.x - wn / 2, yf - q.nabeh], [t.x + wn / 2, yf - q.nabeh], [t.x + wn / 2 + q.nabeh + 1, yf + 1], [t.x - wn / 2 - q.nabeh - 1, yf + 1]]));
          odeber.push(naZ(sjednot(casti), zb - 1, zt + 1));
        }
      }
    }

    function kapsa(telo, odeber) {
      const q = o.kapsa, W = o.W, zb = zBot, zh = zb + q.Hb;
      const zDna = q.dnoTyp === 'zadne' ? zb - 1 : zb + q.sd;
      // nad zády pokračuje zadní stěna v plné tloušťce zad (yZ…y0)
      if (q.tvar === 'kulata') {
        for (const x of q.xs) {
          telo.push(valecZ(x, q.yc, q.Ro, q.Ro, zb, zh), kvadr(x - q.Ro, x + q.Ro, yZ, q.yc, zb, zh));
          odeber.push(valecZ(x, q.yc, q.Ri, q.Ri, zDna, zh + 1));
          if (q.dnoTyp === 'prstenec') odeber.push(valecZ(x, q.yc, q.Ri - q.lem, q.Ri - q.lem, zb - 1, zb + q.sd + 0.01));
        }
        if (zh > zadaTop) telo.push(kvadr(0, W, yZ, y0, zadaTop - 0.5, zh));
        return;
      }
      telo.push(kvadr(0, W, yZ, y0 + q.D, zb, zh));
      const ri = Math.min(2, q.wc / 2 - 0.1, (q.D - q.s) / 2 - 0.1);
      const dutina = (x0, x1, ya, yb, z0) => {
        let cs = k(k(CS.square([x1 - x0, yb - ya])).translate([x0, ya]));
        const rr = Math.min(ri, (x1 - x0) / 2 - 0.1, (yb - ya) / 2 - 0.1);   // úzký otvor by zaoblení zhroutilo na prázdno
        if (rr > 0.2) cs = k(k(cs.offset(-rr, 'Round', 2, 16)).offset(rr, 'Round', 2, 16));
        return naZ(cs, z0, zh + 1);
      };
      // přihrádky zvlášť (přepážky zůstanou plné)
      for (let i = 0; i < q.bunky.length; i++) {
        const xc = q.bunky[i];
        odeber.push(dutina(xc - q.wc / 2, xc + q.wc / 2, y0, y0 + q.D - q.s, zDna));
        if (q.dnoTyp === 'prstenec' && q.lem > 1) odeber.push(dutina(xc - q.wc / 2 + q.lem, xc + q.wc / 2 - q.lem, y0 + q.lem, y0 + q.D - q.s - q.lem, zb - 1));
        if (p.kapsa.odtok && q.dnoTyp === 'plne') odeber.push(valecZ(xc, y0 + (q.D - q.s) / 2, 2, 2, zb - 1, zb + q.sd + 1));
        if (q.vyrez > 0.5 && q.wv > 2) {
          // výřez v přední stěně: U s půlkruhovým dnem
          const r = q.wv / 2, z0 = q.zCelo - q.vyrez + r;
          const u = k(CS.union([k(k(CS.circle(r, nSeg(r))).translate([xc, Math.min(z0, q.zCelo)])), k(k(CS.square([2 * r, Math.max(1, zh + 5 - z0)])).translate([xc - r, Math.min(z0, q.zCelo)]))]));
          odeber.push(naY(u, y0 + q.D - q.s - 1, y0 + q.D + 1));
        }
      }
      // šikmé čelo: boky klesají od zad k nižší přední stěně (nastojato bez převisu)
      if (q.sikme) odeber.push(naX(poly([[y0, zh], [y0 + q.D + 1, q.zCelo - (zh - q.zCelo) / q.D], [y0 + q.D + 1, zh + 50], [y0, zh + 50]]), -1, W + 1));
    }

    function deska(telo, odeber, zakaz) {
      const q = o.deska, P = p.deska, d = q.d;
      for (const [x, z] of q.otvory) zakaz.push([x - d.rh - 2, x + d.rh + 2, z - d.rh - 2, z + d.rh + 2]);
      for (const t of q.pruvlaky) zakaz.push([t.x0 - 4, t.x1 + 4, t.z - q.ws / 2 - 2, t.z + q.ws / 2 + 2]);
      // magnety: kapsy otevřené dozadu – magnet drží lišta za deskou, vpředu zůstane tenká stěna
      for (const [x, z] of q.magnety) { odeber.push(valecY(x, z, q.rm, q.rm, yZ - 1, yZ + q.hm)); zakaz.push([x - q.rm - 2, x + q.rm + 2, z - q.rm - 2, z + q.rm + 2]); }
      // kolejničky na aku baterie: svisle na líci, dole doraz (nastojato bez převisu)
      for (const xc of q.kolejnice) {
        const sir = P.kolSirka, krk = Math.min(P.kolKrk, sir), v = P.kolVyska, z0 = q.kolZ0, z1 = q.kolZ0 + q.kolDelka;
        const prurez = P.kolTvar === 'rybina' ? poly([[xc - krk / 2, y0 - 0.3], [xc + krk / 2, y0 - 0.3], [xc + sir / 2, y0 + v], [xc - sir / 2, y0 + v]])
          : k(CS.union([obd(xc - krk / 2, xc + krk / 2, y0 - 0.3, y0 + v / 2 + 0.01), obd(xc - sir / 2, xc + sir / 2, y0 + v / 2, y0 + v)]));
        telo.push(naZ(prurez, z0 - 0.01, z1));
        if (P.kolDoraz > 0) telo.push(kvadr(xc - sir / 2 - 3, xc + sir / 2 + 3, y0 - 0.3, y0 + v + 3, zBot, z0));
        zakaz.push([xc - sir / 2 - 5, xc + sir / 2 + 5, zBot - 1, z1 + 2]);
      }
      for (const [x, z] of q.otvory) {
        if (P.otvory === 'zepredu') { odeber.push(valecY(x, z, q.pilot / 2, q.pilot / 2, y0 - (o.b - 1), y0 + 1)); continue; }
        odeber.push(valecY(x, z, d.ro, d.ro, yZ - 1, y0 + 1));
        if (P.otvory === 'zezadu') {
          if (d.hz > 0.05) odeber.push(valecY(x, z, d.ro + d.hz, d.ro, yZ - 0.001, yZ + d.hz));
        } else {
          // šestihranná kapsa na matici ze zadní strany (vrchol nahoru = na stojato bez převisu)
          const r = (q.mat.s + 0.3) / 2 / Math.cos(Math.PI / 6);
          const hex = k(k(k(M.cylinder(q.mat.m + 0.3 + 1, r, r, 6)).rotate([0, 0, 90])).rotate([-90, 0, 0]));
          odeber.push(k(hex.translate([x, yZ - 1, z])));
        }
      }
      // průvlaky: dvě štěrbiny skrz záda a za nimi mělká drážka, kudy vede pásek kolem věci
      for (const t of q.pruvlaky) {
        const z0 = t.z - q.ws / 2, z1 = t.z + q.ws / 2;
        odeber.push(kvadr(t.x0 - q.sirS / 2, t.x0 + q.sirS / 2, yZ - 1, y0 + 1, z0, z1), kvadr(t.x1 - q.sirS / 2, t.x1 + q.sirS / 2, yZ - 1, y0 + 1, z0, z1),
          kvadr(t.x0, t.x1, yZ - 1, yZ + q.drazka, z0, z1));
      }
    }

    /** Odlehčení zad: mřížka otvorů skrz záda mimo zakázané oblasti (kořeny háků, otvory, kolejničky…) a pod zámkem. */
    function odlehceni(odeber, zakaz) {
      const s = p.zada.velOdlehceni, wt = 2.4, m = Math.max(4, (o.sraz || 0) + 2.5), sest = p.zada.odlehceni === 'sestiuhelniky';
      const naBoku = p.typ === 'hak' || p.typ === 'police' || (p.typ === 'deska' && !p.deska.kolejnice) || (p.typ === 'svorka' && p.svorka.tvar === 'klip' && p.svorka.osa === 'vodorovne');
      // šestiúhelník vrcholem nahoru ve směru tisku (na boku = podél x, nastojato = podél z) – otvor bez převisu
      // kruh nastojato = kapka se špičkou nahoru (strop otvoru bez převisu)
      // nastojato: šestiúhelník se střechou 45° (pravidelný by měl strop jen 30° od vodorovné) a kruh jako kapka
      const hx = sest && naBoku ? s / Math.cos(Math.PI / 6) : s, hz = sest && !naBoku ? s * 1.6 : !sest && !naBoku ? s / 2 + s / 2 * Math.SQRT2 : s;
      const hore = Math.min(o.zaves ? o.zOcas : o.zL(gw), H, zadaTop) - m, dole = Math.max(zBot, o.patka > 0 ? zBot + o.patka : zBot) + m;
      const nx = Math.floor((o.W - 2 * m + wt) / (hx + wt)), nz = Math.floor((hore - dole + wt) / (hz + wt));
      if (nx < 1 || nz < 1) return;
      const x0 = (o.W - (nx * (hx + wt) - wt)) / 2 + hx / 2, z0 = dole + ((hore - dole) - (nz * (hz + wt) - wt)) / 2 + hz / 2;
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const x = x0 + i * (hx + wt), z = z0 + j * (hz + wt);
        if (zakaz.some(([a0, a1, b0, b1]) => x + hx / 2 + wt > a0 && x - hx / 2 - wt < a1 && z + hz / 2 + wt > b0 && z - hz / 2 - wt < b1)) continue;
        if (sest) {
          const r = s / 2 / Math.cos(Math.PI / 6);
          if (naBoku) odeber.push(k(k(k(M.cylinder(o.b + 2, r, r, 6)).rotate([-90, 0, 0])).translate([x, yZ - 1, z])));   // vrchol podél x (= nahoru při tisku)
          else { const h1 = s * 0.3; odeber.push(naY(poly([[x - s / 2, z - h1], [x, z - h1 - s / 2], [x + s / 2, z - h1], [x + s / 2, z + h1], [x, z + h1 + s / 2], [x - s / 2, z + h1]]), yZ - 1, y0 + 1)); }
        } else if (naBoku) odeber.push(valecY(x, z, s / 2, s / 2, yZ - 1, y0 + 1));
        else odeber.push(naY(k(CS.hull([kruh(x, z - hz / 2 + s / 2, s / 2), kruh(x, z - hz / 2 + s / 2 + s / 2 * Math.SQRT2, 0.05)])), yZ - 1, y0 + 1));
        odlehcenych++;
      }
    }

    /* ---------- zkušební zámky s různou vůlí ---------- */
    function zkouskaVule() {
      const q = o.zkouska, casti = [], odeber = [];
      q.vzorky.forEach((v, i) => {
        const oo = v.o, { profil } = profilZad(oo);
        casti.push(naX(profil, v.x0, v.x1));
        // označení: popisek vůle na líci (zrcadlově podél x – čte se zepředu), bez písma zářezy na spodní hraně (počet = pořadí)
        const tx = font && textPolygony(font, String(Math.round(v.c * 100) / 100).replace('.', ','), Math.min(4, q.w * 0.35));
        if (tx && tx.w < q.w - 1.5) {
          const cs = k(k(new CS(tx.polys, 'NonZero')).mirror([1, 0]));
          const zc = (oo.zBot + Math.min(oo.H, oo.zadaTop)) / 2 - 3;
          odeber.push(naY(k(cs.translate([(v.x0 + v.x1) / 2 + tx.x0 + tx.w / 2, zc - tx.y0 - tx.h / 2])), oo.y0 - 0.5, oo.y0 + 1));
          popisku++;
        } else for (let j = 0; j <= Math.min(i, 4); j++) odeber.push(kvadr(v.x0 + 1.2 + j * 1.6, v.x0 + 2.2 + j * 1.6, oo.y0 - 1, oo.y0 + 1, oo.zBot - 1, oo.zBot + 1.2));
      });
      // vzorky jsou samostatné kusy – pro tisk je CLEAT.tiskovaPoloha položí na bok vedle sebe
      vzorky = q.vzorky.map(v => [v.x0, v.x1]);
      duchove.push({ typ: 'box', min: [-40, -10, Math.min(zBot, 0) - 20], max: [q.W + 40, 0, zTop + 20] }, duch(naX(profilListy(), -30, q.W + 30)));
      let tel = k(M.union(casti));
      if (odeber.length) tel = k(M.difference([tel, ...odeber]));
      return tel;
    }

    /* ---------- měrka profilu lišty ---------- */
    function merka() {
      const q = o.zkouska, prof = profilListy();
      // „C“ kolem lišty (líc, úkos, spodek), otevřené ke zdi; výřez = lišta + 0,2 mm
      let cs = k(k(prof.offset(q.okraj, 'Miter', 4)).intersect(obd(0.4, T + q.okraj + 1, -q.okraj - 1, H + q.okraj * 3)));
      cs = k(cs.subtract(k(k(prof.offset(q.vule, 'Miter', 4)).add(obd(-5, 0.4 + q.vule, -1, H + 1)))));
      let tel = naX(cs, 0, q.tl);
      const tx = font && textPolygony(font, q.text, Math.min(3.5, q.okraj - 2));
      if (tx && tx.w < H - 4) {
        // popisek na líci rámečku, otočený podél výšky lišty, vyrytý shora
        const t = k(k(new CS(tx.polys, 'NonZero')).rotate(90));
        const b = t.bounds(), stredY = T + q.vule + (q.okraj - q.vule) / 2, stredZ = H / 2;
        const mn = b.min || [b[0], b[1]], mx = b.max || [b[2], b[3]];
        const posun = k(t.translate([stredY - (mn[0] + mx[0]) / 2, stredZ - (mn[1] + mx[1]) / 2]));
        tel = k(tel.subtract(naX(posun, q.tl - 0.5, q.tl + 1)));
        popisku++;
      }
      duchove.push(duch(naX(prof, q.tl + 1, q.tl + 60)));
      return tel;
    }

    /* ---------- tištěná lišta ---------- */
    function lista() {
      const L = o.lista, d = L.d, prof = profilListy();
      if (L.druh === 'koncovka') {
        // krytka konce lišty: obal o stěnu, uvnitř lišta + 0,2 mm, ke zdi otevřená
        const t = p.lista.stena, hl = p.lista.hloubkaKoncovky;
        const obal = k(k(prof.offset(t, 'Miter', 4)).intersect(obd(0, T + t + 1, -t - 1, H + t * 3)));
        let tel = naX(obal, 0, t + hl);
        tel = k(tel.subtract(naX(k(k(prof.offset(0.2, 'Miter', 4)).add(obd(-5, 0.3, -0.2, H))), t, t + hl + 1)));
        duchove.push(duch(naX(prof, t, t + 80)));
        return tel;
      }
      if (L.druh === 'podlozka') {
        const a = p.lista.velPodlozky, tp = p.lista.tlPodlozky;
        let tel = kvadr(0, a, 0, tp, 0, a);
        tel = k(tel.subtract(valecY(a / 2, a / 2, d.ro, d.ro, -1, tp + 1)));
        return tel;
      }
      const casti = [naX(prof, 0, L.L)], odeber = [];
      if (L.rybina) {
        const ryb = (x0, v) => poly([[x0 - 0.3, L.zc - L.a - v], [x0 + L.dl + v, L.zc - L.a - L.dl * L.fl - v], [x0 + L.dl + v, L.zc + L.a + L.dl * L.fl + v], [x0 - 0.3, L.zc + L.a + v]]);
        casti.push(naY(ryb(L.L, 0), 0, T));
        odeber.push(naY(k(ryb(0, 0).offset(L.vule, 'Miter', 2)), -1, T + 1));
      }
      for (const x of L.zarezy) odeber.push(naX(poly(L.zarezBody), x - L.zarezW / 2, x + L.zarezW / 2));
      for (const x of L.xs) {
        odeber.push(valecY(x, L.zs, d.ro, d.ro, -1, T + 1));
        if (d.hz > 0.05) odeber.push(valecY(x, L.zs, d.ro, d.ro + d.hz, T - d.hz, T + 0.001), valecY(x, L.zs, d.rh, d.rh, T, T + 5));
      }
      duchove.push({ typ: 'box', min: [-40, -10, -40], max: [L.L + 40, 0, H + 40] });
      let tel = k(M.union(casti));
      if (odeber.length) tel = k(M.difference([tel, ...odeber]));
      return tel;
    }
  }

  const API = { postav, textPolygony };
  if (typeof module !== 'undefined') module.exports = API; else window.CLEAT_GEOM = API;
})();

/* Klipy na sáčky a uzávěry – jádro generátoru (bez DOM a bez three.js, spustitelné v node).
   Druhy dílu:
   • klip    – zaklapávací klip: dvě ramena, na jednom konci pant (čep v objímce tištěný vcelku, nebo živý pant),
               na druhém západka; čelisti s perem a drážkou; tiskne se naplocho rozevřený, bez podpor;
   • lista   – násuvná lišta: trubička s podélnou štěrbinou + tyčka (tištěná, nebo vlastní špejle / kulatina);
   • vylevka – hrdlo s přírubou a závitem, přítlačná matice a šroubovací víčko. Závit se NEPOČÍTÁ tady:
               všechny tři díly staví DOZY.postav (dozy_zavit/jadro.js) – hrdlo = druh „hrdlo“, matice = kalibrační
               kroužek druhu „vzorek“, víčko = druh „vicko“; tady se jen skládají (víčko má kratší závit, proto se
               posune o celé kroky šroubovice a o stejný úhel pootočí) a matici se přidají vroubky;
   • cklip   – pružný C-klip / kolíček: jeden profil vytažený do délky, tiskne se na boku (profil na podložce);
   • vzorek  – krátký klip (pant + západka + kus čelistí) na ověření vůlí.

   Souřadnice stavby klipu (2D, pak výtah do z = výška klipu): x podél ramen, y = směr zavírání, rameno A dole
   (pevné, objímka pantu, drážka), rameno B nahoře (čep, pero, západka). Osa čepového pantu O = (0, g/2 + T/2) leží
   v ose ramene B; živý pant je oblouk kolem (0, 0) na zadní straně. g = mezera čelistí = tloušťka fólie × počet vrstev.
   Výsledné díly: délka podél osy y, střed délky v y = 0 (řez náhledu y = 0 ukáže průřez profilu).

   postav(wasm, p) → {dily, sestava, o, cas}
     dily    – tisková poloha: {jmeno, nazev, poz, idx, objem, teles, telesMa, barva, otocit, ks}
     sestava – složená / zavřená poloha pro náhled a měření: {jmeno, nazev, poz, idx, barva, posun?, rozpad?, cast?} */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const PRUZ = uzel ? require('../pruzne/jadro.js') : window.PRUZ;      // materiály, oblouky, výseče
  const DOZY = uzel ? require('../dozy_zavit/jadro.js') : window.DOZY;  // závit výlevky
  const fmt = G.fmt, kopie = G.kopie;
  const rad = s => s * Math.PI / 180, st = x => x * 180 / Math.PI;
  const AKTUALIZACE = '11/2026';
  const ORIENTACNI = 'orientační – ověřit měřením';

  /* ---------------- tabulky ---------------- */
  /** Tloušťka jedné stěny sáčku (mm) – orientační hodnoty z paměti (stav 11/2026), skutečné sáčky se liší. */
  const FOLIE = {
    mikroten: { nazev: 'mikroten (HDPE)', t: 0.015 },
    zip: { nazev: 'zip sáček (LDPE)', t: 0.05 },
    chipsy: { nazev: 'sáček od chipsů', t: 0.06 },
    kava: { nazev: 'sáček od kávy', t: 0.11 },
    vlastni: { nazev: 'vlastní tloušťka', t: null },
  };
  /** Šířky naplocho položeného sáčku (mm) – orientační. */
  const SIRKY = [
    { sirka: 60, nazev: 'koření, čaj' }, { sirka: 80, nazev: 'oříšky, bonbony' }, { sirka: 100, nazev: 'káva 250 g' },
    { sirka: 120, nazev: 'rýže, těstoviny' }, { sirka: 150, nazev: 'mouka, chipsy' }, { sirka: 180, nazev: 'cereálie' }, { sirka: 220, nazev: 'velký sáček' },
  ];
  /** Materiály = výběr z pružných mechanismů (E, dovolená přetvoření, tření, hustota) – typické hodnoty. */
  const MATERIALY = Object.fromEntries(['PLA', 'PETG', 'TPU'].map(k => [k, PRUZ.MATERIALY[k]]));
  const DATUM_MATERIALU = PRUZ.DATUM_DAT;

  const SOUDEK = 0.6;       // o kolik je čep uprostřed výšky nejméně tlustší (kužely 45° – drží čep v objímce osově); vždy aspoň vůle + 0,4
  const STENA_OBJIMKY = 2;  // stěna objímky kolem čepu
  const STERBINA_ZAP = 0.8; // štěrbina mezi koncem ramene B a pružným ramenem západky
  const PATKA_ZAP = 3;      // výstupek pod zubem západky na odjištění prstem
  const DELKA_VZORKU = 20;  // délka čelistí kalibračního vzorku
  const T_PRIRUBY = 2.4;    // tloušťka příruby hrdla výlevky
  const NAD_MATICI = 0.6;   // mezera mezi maticí a okrajem víčka
  const MAX_SADA = 6;

  const NAZVY = {
    druh: { klip: 'zaklapávací klip', lista: 'násuvná lišta', vylevka: 'výlevka s víčkem', cklip: 'pružný C-klip', vzorek: 'kalibrační vzorek spoje' },
    pant: { cep: 'čep v objímce (tisk vcelku)', zivy: 'živý pant (pružný pásek)' },
    tycka: { tisk: 'tištěná tyčka', vlastni: 'vlastní tyčka / špejle' },
    doplnek: { zadny: 'bez doplňku', ocko: 'očko na pověšení', magnet: 'kapsa na magnet' },
  };

  const VYCHOZI = {
    verze: 1, nazev: 'Klip na sáček', diry: 'kapka', druh: 'klip',
    sacek: { sirka: 120, presah: 10 },
    folie: { druh: 'zip', tloustka: 0.05, vrstev: 2 },
    klip: { tloustka: 5, vyska: 8, zub: 1.2, pant: 'cep', cep: 6, uhel: 30, pasek: 0.5, hacek: 0.8, rameno: 1 },
    vule: { pant: 0.3, zapadka: 0.15, zavit: 0.3 },
    lista: { tycka: 'tisk', prumer: 6, stena: 1.6, vule: 0.25, nabeh: 5 },
    vylevka: { prumer: 28, stena: 2, priruba: 8, roztec: 3, zavit: 7 },
    cklip: { pres: false, delka: 25, tloustka: 2, rameno: 18, hrbet: 8, mezera: 0.3, nabeh: 4 },
    doplnek: { druh: 'zadny', ocko: 5, magnetD: 8, magnetH: 3 },
    sada: { zapnuta: false, sirky: '80, 120, 160' },
    tisk: { material: 'PETG', vrstva: 0.2, tryska: 0.4, uhel: 45, podlozkaX: 220, podlozkaY: 220 },
  };
  const MEZE = {
    'sacek.sirka': [20, 400], 'sacek.presah': [0, 40],
    'folie.tloustka': [0.005, 0.5], 'folie.vrstev': [2, 40, 1],
    'klip.tloustka': [3, 12], 'klip.vyska': [5, 20], 'klip.zub': [0.5, 3], 'klip.cep': [4, 12], 'klip.uhel': [10, 60], 'klip.pasek': [0.3, 1.5],
    'klip.hacek': [0.4, 2.5], 'klip.rameno': [0.8, 3],
    'vule.pant': [0.1, 0.8], 'vule.zapadka': [0.05, 0.6], 'vule.zavit': [0.1, 0.8],
    'lista.prumer': [2, 16], 'lista.stena': [1, 5], 'lista.vule': [0.05, 1], 'lista.nabeh': [0, 15],
    'vylevka.prumer': [12, 80], 'vylevka.stena': [1.2, 5], 'vylevka.priruba': [3, 30], 'vylevka.roztec': [2.5, 6], 'vylevka.zavit': [4, 16],
    'cklip.delka': [8, 100], 'cklip.tloustka': [0.8, 4], 'cklip.rameno': [10, 60], 'cklip.hrbet': [3, 20], 'cklip.mezera': [0.2, 2], 'cklip.nabeh': [2, 10],
    'doplnek.ocko': [2, 12], 'doplnek.magnetD': [3, 20], 'doplnek.magnetH': [1, 8],
    'tisk.vrstva': [0.05, 0.5], 'tisk.tryska': [0.2, 1.2], 'tisk.uhel': [20, 75], 'tisk.podlozkaX': [60, 1000], 'tisk.podlozkaY': [60, 1000],
  };
  const VYCTY = {
    diry: ['kapka', 'kruh'], druh: Object.keys(NAZVY.druh), 'folie.druh': Object.keys(FOLIE), 'klip.pant': Object.keys(NAZVY.pant),
    'lista.tycka': Object.keys(NAZVY.tycka), 'doplnek.druh': Object.keys(NAZVY.doplnek), 'tisk.material': Object.keys(MATERIALY),
  };

  /** Předvolby (skupina = druh) – jen odchylky od výchozího projektu; tisk zůstává uživatelův. */
  const PREDVOLBY = [
    { id: 'klip120', skupina: 'Zaklapávací klip', nazev: 'Klip 120 mm – čepový pant', popis: 'rýže, těstoviny; tisk vcelku, PETG / PLA', p: {} },
    { id: 'klip80', skupina: 'Zaklapávací klip', nazev: 'Klip 80 mm s očkem', popis: 'oříšky, bonbony; očko Ø 5 na pověšení', p: { nazev: 'Klip 80 mm', sacek: { sirka: 80 }, doplnek: { druh: 'ocko' } } },
    { id: 'klipKava', skupina: 'Zaklapávací klip', nazev: 'Klip na kávu s magnetem', popis: 'sáček 100 mm, silná fólie, magnet Ø 8 × 3', p: { nazev: 'Klip na kávu', sacek: { sirka: 100 }, folie: { druh: 'kava' }, klip: { tloustka: 6, vyska: 9 }, doplnek: { druh: 'magnet' } } },
    { id: 'klipZivy', skupina: 'Zaklapávací klip', nazev: 'Klip 100 mm – živý pant', popis: 'jeden kus s pružným páskem; PETG nebo TPU, ne PLA', p: { nazev: 'Klip s živým pantem', sacek: { sirka: 100 }, klip: { pant: 'zivy', uhel: 20 } } },
    { id: 'klipSada', skupina: 'Zaklapávací klip', nazev: 'Sada klipů 80 / 120 / 160', popis: 'tři délky na jednu podložku', p: { nazev: 'Sada klipů', sada: { zapnuta: true, sirky: '80, 120, 160' } } },
    { id: 'lista150', skupina: 'Násuvná lišta', nazev: 'Lišta 150 mm s tyčkou Ø 6', popis: 'sáček přehnutý přes tyčku, oba díly tištěné', p: { nazev: 'Lišta 150 mm', druh: 'lista', sacek: { sirka: 150 } } },
    { id: 'listaSpejle', skupina: 'Násuvná lišta', nazev: 'Lišta na špejli Ø 3', popis: 'jen lišta 120 mm, tyčka = špejle', p: { nazev: 'Lišta na špejli', druh: 'lista', lista: { tycka: 'vlastni', prumer: 3, stena: 1.4, nabeh: 4 } } },
    { id: 'vylevka28', skupina: 'Výlevka s víčkem', nazev: 'Výlevka Ø 28 – rýže, cukr', popis: 'hrdlo s přírubou, přítlačná matice a víčko', p: { nazev: 'Výlevka 28', druh: 'vylevka', sacek: { sirka: 150 } } },
    { id: 'vylevka40', skupina: 'Výlevka s víčkem', nazev: 'Výlevka Ø 40 – mouka, vločky', popis: 'široké hrdlo, rozteč závitu 4 mm', p: { nazev: 'Výlevka 40', druh: 'vylevka', sacek: { sirka: 180 }, vylevka: { prumer: 40, priruba: 10, roztec: 4, zavit: 9 } } },
    { id: 'kolicek', skupina: 'Pružný C-klip', nazev: 'Kolíček 25 mm na srolovaný sáček', popis: 'krátký pružný profil, okraj sáčku 3× přehnutý', p: { nazev: 'Kolíček na sáček', druh: 'cklip', folie: { vrstev: 16 } } },
    { id: 'cklipMagnet', skupina: 'Pružný C-klip', nazev: 'Kolíček s magnetem na lednici', popis: 'kapsa Ø 8 × 3 zespodu ucha', p: { nazev: 'Kolíček s magnetem', druh: 'cklip', folie: { vrstev: 16 }, doplnek: { druh: 'magnet' } } },
    { id: 'cklip100', skupina: 'Pružný C-klip', nazev: 'C-profil přes sáček 100 mm', popis: 'tisk na výšku 110 mm, okraj sáčku 3× přehnutý', p: { nazev: 'C-profil 100 mm', druh: 'cklip', sacek: { sirka: 100 }, folie: { vrstev: 16 }, cklip: { pres: true } } },
    { id: 'vzorek', skupina: 'Kalibrační vzorek', nazev: 'Vzorek pantu a západky', popis: 'krátký klip ve zvolené vůli – vytisknout jako první', p: { nazev: 'Vzorek spoje', druh: 'vzorek' } },
  ];

  /* ---------------- normalizace a projekt ---------------- */
  const normalizuj = v => G.normalizuj(v, { VYCHOZI, MEZE, VYCTY });
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(G.slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }
  const TYP = 'klipy_sacky';
  const ulozProjekt = p => G.projektJson(TYP, p, 1);
  const nactiProjekt = text => G.nactiProjektJson(text, TYP, normalizuj, 'Klipy na sáčky a uzávěry');
  function popis(p) {
    const o = odvozene(p), d = o.sirky.map(x => fmt(x + p.sacek.presah, 0)).join(' / ');
    if (p.druh === 'vylevka') return `výlevka Ø ${fmt(p.vylevka.prumer, 0)} · závit Ø ${fmt(o.V.d, 1)} × ${fmt(p.vylevka.roztec, 1)}`;
    if (p.druh === 'vzorek') return `vzorek spoje · vůle pantu ${fmt(p.vule.pant, 2)}, západky ${fmt(p.vule.zapadka, 2)}`;
    if (p.druh === 'cklip') return `C-klip ${fmt(o.C.delka, 0)} mm · stěna ${fmt(p.cklip.tloustka, 1)}, rameno ${fmt(p.cklip.rameno, 0)}`;
    if (p.druh === 'lista') return `lišta ${d} mm · tyčka Ø ${fmt(p.lista.prumer, 1)}`;
    return `klip ${d} mm · ${p.klip.pant === 'zivy' ? 'živý pant' : 'čepový pant'} · fólie ${fmt(o.tf, 3)} × ${p.folie.vrstev}`;
  }

  /* ---------------- odvozené rozměry ---------------- */
  const naPodlozku = (a, b, p) => (a <= p.tisk.podlozkaX + 1e-6 && b <= p.tisk.podlozkaY + 1e-6) || (a <= p.tisk.podlozkaY + 1e-6 && b <= p.tisk.podlozkaX + 1e-6);
  /** Šířky sáčků sady z textu „80, 120; 160“ (celé mm oddělené čárkou, středníkem nebo mezerou; jen platné, bez opakování, nejvýš MAX_SADA). */
  function sirkySady(text) {
    const out = [];
    for (const t of String(text || '').split(/[;,\s]+/)) {
      const x = G.ctiCislo(t);
      if (Number.isFinite(x) && x >= MEZE['sacek.sirka'][0] && x <= MEZE['sacek.sirka'][1] && !out.includes(x)) out.push(x);
    }
    return out.slice(0, MAX_SADA);
  }
  /** Šířka krčku mezi čepem (poloměr rp) a ramenem tloušťky T. */
  const krcek = (T, rp) => Math.min(T - 1, Math.max(1.6, 0.4 * rp));
  /** Největší rozevření čepového pantu (rad): štěrbina objímky smí být jen tak široká, aby objímka čep stále držela. */
  function rozevreniPantu(rp, v, wn) {
    const rh = rp + v, fi0 = Math.asin(Math.min(1, (wn / 2 + v) / rh));
    return { fi0, max: Math.min(Math.PI / 2, 2 * Math.asin(Math.min(1, 0.8 * rp / rh)) - 2 * fi0) };
  }
  /** Rozměry klipu pro délku čelistí D (souřadnice stavby – viz hlavička). */
  function rozmeryKlipu(p, D, g) {
    const k = p.klip, q = { D, g, T: k.tloustka, H: k.vyska, hz: k.zub, zivy: k.pant === 'zivy', alfa: rad(k.uhel) };
    q.yAo = -g / 2 - q.T; q.yBt = g / 2 + q.T;
    if (q.zivy) {
      q.Oy = 0; q.Rw = (g + q.T) / 2; q.tw = k.pasek; q.xA0 = 0; q.xB0 = 0;
      q.Lw = q.Rw * (Math.PI - q.alfa);                           // volná délka pásku v tiskové poloze
      // odlehčení vnitřních rohů u pantu: v tiskové poloze musí být mezi rameny aspoň ~0,6 mm
      q.oc = Math.max(2, 0.6 / Math.sin(q.alfa)); q.od = Math.max(0.2, Math.min(1.5, q.T / 2 - q.tw / 2 - 0.5));
      q.xj0 = Math.max(3, q.oc + 0.5);
    } else {
      q.Oy = g / 2 + q.T / 2; q.v = p.vule.pant; q.rp = k.cep / 2; q.rh = q.rp + q.v;
      q.k = Math.max(SOUDEK, q.v + 0.4);                         // soudek čepu musí přesahovat vůli, jinak by čep vypadl
      q.Ro = q.rp + q.k + q.v + STENA_OBJIMKY;
      q.wn = krcek(q.T, q.rp);
      Object.assign(q, rozevreniPantu(q.rp, q.v, q.wn));
      q.xA0 = -q.Ro; q.xB0 = q.Ro + Math.max(0.6, q.v + 0.2);
      q.xj0 = q.xB0 + 1;
    }
    q.xj0 = Math.max(q.xj0, (q.hz + 0.5) / Math.sin(q.alfa));    // čelisti začínají tak daleko od pantu, aby pero při tisku vyjelo z drážky
    q.xj1 = q.xj0 + D; q.xe = q.xj1 + 1;
    // západka: pružné rameno visí z vnějšího rohu ramene B, zub zaskočí pod vnější plochu ramene A
    q.vz = p.vule.zapadka; q.u = k.hacek; q.th = k.rameno; q.tb = Math.max(1.6, q.th);
    q.xb = q.xe + STERBINA_ZAP; q.xAe = q.xb - q.vz;
    q.yq = q.yAo - q.vz; q.Lh = q.yBt - q.tb - q.yq; q.yEnd = q.yq - 0.5 - q.u - PATKA_ZAP;
    q.pruhyb = q.u - q.vz;                                        // o kolik se rameno západky při zaklapnutí ohne
    // odstup západky (patka, zub) od ramene A v rozevření a: každý roh musí být nad vnitřní plochou ramene A, nebo za jeho koncem
    q.odstupZapadky = a => Math.min(...[[q.xb, q.yEnd], [q.xb - q.u, q.yq - 0.5], [q.xb - q.u, q.yq]].map(b => Math.max(
      q.Oy + b[0] * Math.sin(a) + (b[1] - q.Oy) * Math.cos(a) + g / 2, b[0] * Math.cos(a) - (b[1] - q.Oy) * Math.sin(a) - q.xAe)));
    q.delka = q.xb + q.th - q.xA0; q.stred = (q.xj0 + q.xj1) / 2;
    return q;
  }
  function rozmeryListy(p, s) {
    const l = p.lista, L = { rr: l.prumer / 2, v: l.vule };
    L.ri = L.rr + s + L.v;                                        // světlost: tyčka + svazek fólie + vůle
    L.st = 2 * s + 2 * L.v;                                       // štěrbina: sáček jde tam i zpět + vůle
    L.kapka = p.diry !== 'kruh';
    L.Ro = Math.max(L.ri + l.stena, L.kapka ? L.ri * Math.SQRT2 + 0.8 : 0);
    L.c = Math.max(0, Math.min(l.nabeh / 2, L.Ro - L.ri - 0.6));  // kuželový náběh otvoru
    return L;
  }
  function rozmeryCklipu(p, D) {
    const c = p.cklip, C = { t: c.tloustka, La: c.rameno, gp: c.mezera, Ln: c.nabeh, delka: c.pres ? D : c.delka };
    C.Rm = c.hrbet / 2 + C.t / 2; C.yp = (C.gp + C.t) / 2;
    C.beta = Math.acos(C.yp / Math.hypot(C.Rm, C.La)) - Math.atan2(C.La, C.Rm);   // sklon ramen k ose
    C.Pt = [C.Rm * Math.sin(C.beta), C.Rm * Math.cos(C.beta)];
    C.Pp = [C.Pt[0] + C.La * Math.cos(C.beta), C.yp];
    C.gama = rad(35);
    C.Pk = [C.Pp[0] + C.Ln * Math.cos(C.gama), C.yp + C.Ln * Math.sin(C.gama)];
    return C;
  }
  /** Projekty pro DOZY.postav: hrdlo, matice (kroužek vzorku) a víčko se stejným závitem. */
  function rozmeryVylevky(p, tf) {
    const v = p.vylevka, V = { p: v.roztec, h: Math.round(0.36 * v.roztec * 100) / 100 };
    V.d = v.prumer + 2 * v.stena + 2 * V.h;
    V.nasobek = Math.max(1, 2 * p.sacek.sirka / (Math.PI * V.d));  // kolikrát je obvod sáčku delší než obvod hrdla (sklady fólie)
    V.pridavek = Math.round(tf * V.nasobek * 100) / 100;
    V.vule = Math.min(1.5, p.vule.zavit + V.pridavek);            // vůle vnitřních závitů: tisk + fólie přes závit
    V.hk = Math.max(6, 2 * V.p);                                  // výška matice (kroužek vzorku v dozy_zavit)
    V.L = v.zavit + V.hk + NAD_MATICI;
    const zavit = { rozmer: 'vlastni', d: V.d, p: V.p, chodu: 1, h: V.h, vrchol: 0, bok: 45, vyska: V.L, otvor: v.prumer, vule: V.vule, nabeh: 1 };
    const tisk = p.tisk.material === 'TPU' ? Object.assign({}, p.tisk, { material: 'PETG' }) : p.tisk;   // dózy TPU neznají; hustota se bere odsud
    const proj = (druh, navic) => DOZY.normalizuj(G.slij({ druh, zavit: kopie(zavit), tisk: kopie(tisk) }, navic)).p;
    V.pHrdlo = proj('hrdlo', { hrdlo: { priruba: v.priruba, tPriruby: T_PRIRUBY, odsazeni: 0 } });
    V.pMatice = proj('vzorek', { vzorek: { sada: false } });
    const oh = DOZY.odvozene(V.pHrdlo), Z = oh.Z;
    V.N = Z.N; V.krok = Z.lead / Z.N;
    V.dz = Math.ceil((V.hk + NAD_MATICI) / V.krok - 1e-9) * V.krok;  // posun závitu víčka = celé kroky šroubovice
    V.Lv = V.L - V.dz;                                            // závit víčka
    V.uhel = 360 * V.dz / Z.lead;                                 // pootočení víčka, které posun vyrovná
    V.pVicko = proj('vicko', { zavit: { vyska: V.Lv }, vicko: { stena: 2, dno: 2, uchop: 'vroubky', vroubku: Math.max(12, Math.round(V.d * 0.8)), tesneni: 'zadne' } });
    const ov = DOZY.odvozene(V.pVicko);
    V.Nv = ov.Z.N; V.otacek = ov.otacek; V.zaber = ov.zaber;
    V.zT = oh.zT; V.H = oh.H; V.Rp = oh.Rp; V.Rk = Z.rMaj + V.vule + 3; V.top = oh.H + ov.top - ov.zRim;
    V.zVicko = oh.zT + V.dz - ov.zT;                              // zdvih víčka do sestavy
    return V;
  }
  function odvozene(p) {
    const o = { druh: p.druh };
    o.tf = p.folie.druh === 'vlastni' ? p.folie.tloustka : FOLIE[p.folie.druh].t;
    o.s = Math.round(o.tf * p.folie.vrstev * 1000) / 1000;        // svazek fólie v sevření
    const sada = p.sada.zapnuta && (p.druh === 'klip' || p.druh === 'lista' || (p.druh === 'cklip' && p.cklip.pres));
    o.sirky = sada ? sirkySady(p.sada.sirky) : [p.sacek.sirka];
    o.sada = sada;
    o.delky = p.druh === 'vzorek' ? [DELKA_VZORKU] : o.sirky.map(x => x + p.sacek.presah);
    const D = o.delky[0] || p.sacek.sirka + p.sacek.presah;
    o.K = rozmeryKlipu(p, D, o.s);
    o.L = rozmeryListy(p, o.s);
    o.C = rozmeryCklipu(p, D);
    o.V = rozmeryVylevky(p, o.tf);
    // doplněk: ucho s očkem (průchozí díra) nebo s kapsou na magnet
    const dp = p.doplnek;
    o.doplnek = p.druh === 'vylevka' || p.druh === 'vzorek' ? 'zadny' : dp.druh;
    if (o.doplnek !== 'zadny') {
      const ocko = o.doplnek === 'ocko', rd = ocko ? dp.ocko / 2 : dp.magnetD / 2 + 0.1;
      o.ucho = { ocko, rd, rl: rd + 1.6, hloubka: ocko ? 0 : dp.magnetH + 0.2, h: ocko ? 3 : dp.magnetH + 0.2 + 1 };
    }
    return o;
  }

  /* ---------------- kontroly (bez geometrie) ---------------- */
  function kontroly(p) {
    const H = [], o = odvozene(p), k = p.klip, q = o.K;
    const chyba = (pole, text, oprava) => H.push({ uroven: 'chyba', pole, text, oprava });
    const var_ = (pole, text, oprava) => H.push({ uroven: 'varovani', pole, text, oprava });
    const info = (pole, text) => H.push({ uroven: 'info', pole, text });
    const opr = (cesta, h, des = 1) => ({ zmeny: { [cesta]: Math.round(h * 10 ** des) / 10 ** des } });
    const vuleTrysky = Math.round(0.75 * p.tisk.tryska * 20) / 20;

    if (p.sada.zapnuta && o.sada && !o.sirky.length) chyba(['sada.sirky'], 'Sada nemá žádnou platnou šířku sáčku – zadejte čísla 20–400 oddělená čárkou.', { zmeny: { 'sada.sirky': VYCHOZI.sada.sirky } });
    if (p.folie.druh !== 'vlastni') info(['folie.druh'], `Tloušťka fólie ${fmt(o.tf, 3)} mm (${FOLIE[p.folie.druh].nazev}) je ${ORIENTACNI} (stav ${AKTUALIZACE}); přesnou hodnotu zadejte jako vlastní.`);

    if (p.druh === 'klip' || p.druh === 'vzorek') {
      if (q.H < 2 * q.hz + 2) chyba(['klip.vyska', 'klip.zub'], `Klip vysoký ${fmt(q.H, 1)} mm je na pero ${fmt(q.hz, 1)} mm nízký – nad perem a pod ním má zůstat aspoň 1 mm rovné plochy.`, opr('klip.vyska', Math.ceil((2 * q.hz + 2) * 2) / 2));
      if (q.hz > q.T - 1.5) chyba(['klip.zub', 'klip.tloustka'], `Drážka hluboká ${fmt(q.hz, 1)} mm rameno tlusté ${fmt(q.T, 1)} mm příliš zeslabí.`, opr('klip.zub', Math.max(0.5, Math.floor((q.T - 1.5) * 10) / 10)));
      if (q.pruhyb < 0.3) chyba(['klip.hacek', 'vule.zapadka'], `Zub západky ${fmt(q.u, 2)} mm je při vůli ${fmt(q.vz, 2)} mm malý – západka by nedržela.`, opr('klip.hacek', q.vz + 0.6));
      if (q.odstupZapadky(q.alfa) < 0.5) {
        let uhel = Math.ceil(k.uhel) + 1;
        while (uhel < MEZE['klip.uhel'][1] && q.odstupZapadky(rad(uhel)) < 0.5) uhel++;
        chyba(['klip.uhel'], `V rozevření ${fmt(k.uhel, 0)}° západka při tisku ještě zasahuje do druhého ramene (klip je krátký) – ramena by se spekla. Zvětšete úhel rozevření.`, opr('klip.uhel', uhel, 0));
      }
      if (q.zivy) {
        if (q.tw < p.tisk.tryska - 1e-9) var_(['klip.pasek', 'tisk.tryska'], `Pásek pantu ${fmt(q.tw, 2)} mm je tenčí než dráha trysky ${fmt(p.tisk.tryska, 2)} mm – nevytiskne se spolehlivě.`, opr('klip.pasek', p.tisk.tryska, 2));
      } else {
        if (q.alfa > q.max - rad(5)) {
          // nejmenší čep, který zadané rozevření dovolí; jinak menší úhel tisku
          let cep = 0;
          for (let d = k.cep + 0.5; d <= MEZE['klip.cep'][1] + 1e-9 && !cep; d += 0.5) { if (rad(k.uhel) <= rozevreniPantu(d / 2, q.v, krcek(q.T, d / 2)).max - rad(5)) cep = d; }
          chyba(['klip.cep', 'klip.uhel'], `Čep Ø ${fmt(k.cep, 1)} mm dovolí rozevření jen ${fmt(st(q.max), 0)}° – na tisk v rozevření ${fmt(k.uhel, 0)}° je to málo (objímka musí čep držet).`,
            cep ? opr('klip.cep', cep) : opr('klip.uhel', Math.max(10, Math.floor(st(q.max) - 5)), 0));
        }
        if (q.v < 0.5 * p.tisk.tryska) var_(['vule.pant', 'tisk.tryska'], `Vůle pantu ${fmt(q.v, 2)} mm je na trysku ${fmt(p.tisk.tryska, 2)} mm malá – čep se může s objímkou spéct. Doporučeno asi ${fmt(vuleTrysky, 2)} mm; ověřte vzorkem.`, opr('vule.pant', vuleTrysky, 2));
      }
      if (o.s > 1) info(['folie.vrstev'], `Mezera čelistí ${fmt(o.s, 2)} mm počítá s ${p.folie.vrstev} vrstvami fólie – rovně zavřený sáček (2 vrstvy) by v ní byl volný.`);
      if (o.ucho && !o.ucho.ocko && q.H < o.ucho.hloubka + 0.8) chyba(['klip.vyska', 'doplnek.magnetH'], `Na magnet vysoký ${fmt(p.doplnek.magnetH, 1)} mm je klip ${fmt(q.H, 1)} mm nízký – pod kapsou má zůstat aspoň 0,8 mm.`, opr('klip.vyska', Math.ceil((o.ucho.hloubka + 0.8) * 2) / 2));
      if (p.druh === 'vzorek') info(['vule.pant', 'vule.zapadka'], `Vzorek = klip s čelistmi ${DELKA_VZORKU} mm. Pant se má po vytištění rozhýbat lehkým zatlačením a západka zaklapnout; podle toho upravte vůle a teprve pak tiskněte celý klip.`);
    }
    if (p.druh === 'lista') {
      const L = o.L;
      if (L.st > 1.6 * L.rr) chyba(['lista.prumer', 'folie.vrstev'], `Štěrbina ${fmt(L.st, 2)} mm je proti tyčce Ø ${fmt(2 * L.rr, 1)} mm široká – tyčka by lištou propadla.`, opr('lista.prumer', Math.min(MEZE['lista.prumer'][1], Math.ceil(L.st / 0.7))));
      else if (L.st < p.tisk.tryska) var_(['lista.vule', 'tisk.tryska'], `Štěrbina ${fmt(L.st, 2)} mm je užší než dráha trysky – při tisku se může zalít.`, opr('lista.vule', Math.ceil((p.tisk.tryska + 0.1 - 2 * o.s) / 2 * 20) / 20, 2));
      if (!L.kapka) info(['lista.prumer'], 'Kruhový otvor lišty má v tiskové poloze převislý strop – zvolte kapku (👁 Zobrazení → 💧 Díry jako kapka).');
      if (p.lista.tycka === 'vlastni') info(['lista.prumer'], `Lišta je na vlastní tyčku Ø ${fmt(2 * L.rr, 1)} mm (špejle, kulatina) – průměr změřte posuvkou, dřevo bývá o desetiny jiné.`);
    }
    if (p.druh === 'vylevka') {
      const V = o.V, v = p.vylevka;
      if (2 * p.sacek.sirka < Math.PI * (V.d + 1)) {
        const d = Math.floor(2 * p.sacek.sirka / Math.PI - 1 - 2 * v.stena - 2 * V.h);   // největší hrdlo, přes které sáček projde
        chyba(['vylevka.prumer', 'sacek.sirka'], `Sáček široký ${fmt(p.sacek.sirka, 0)} mm (obvod ${fmt(2 * p.sacek.sirka, 0)} mm) se přes hrdlo se závitem Ø ${fmt(V.d, 1)} mm nepřetáhne.`,
          d >= MEZE['vylevka.prumer'][0] ? opr('vylevka.prumer', d, 0) : opr('sacek.sirka', Math.ceil(Math.PI * (V.d + 1) / 2), 0));
      }
      if (V.h - V.vule < 0.4) chyba(['vylevka.roztec', 'vule.zavit'], `Závit hluboký ${fmt(V.h, 2)} mm (rozteč ${fmt(V.p, 1)} mm) je na vůli ${fmt(V.vule, 2)} mm včetně fólie mělký – zuby by nezabíraly.`,
        opr('vylevka.roztec', Math.min(MEZE['vylevka.roztec'][1], Math.ceil((V.vule + 0.45) / 0.36 * 2) / 2)));
      if (V.N !== V.Nv) chyba(['vylevka.zavit'], 'Závit víčka a hrdla vychází s jiným dělením obvodu – zkraťte závit pro víčko.', opr('vylevka.zavit', Math.max(4, v.zavit - 2)));
      // kontroly závitu přebírá z dóz (texty jsou jejich), pole ukazují na zdejší parametry
      const videt = new Set();
      for (const pd of [V.pVicko, V.pMatice]) for (const h of DOZY.kontroly(pd)) {
        if (h.uroven === 'info' || videt.has(h.text)) continue;
        videt.add(h.text); H.push({ uroven: h.uroven, pole: ['vylevka.roztec', 'vule.zavit'], text: h.text });
      }
      info(['vule.zavit'], `Fólie se ohrnuje přes závit: k vůli ${fmt(p.vule.zavit, 2)} mm se u matice a víčka přičítá ${fmt(V.pridavek, 2)} mm na fólii ve skladech (celkem ${fmt(V.vule, 2)} mm).`);
    }
    if (p.druh === 'cklip') {
      const C = o.C;
      if (C.t < 2 * p.tisk.tryska - 1e-9) var_(['cklip.tloustka', 'tisk.tryska'], `Stěna ${fmt(C.t, 2)} mm jsou méně než dvě dráhy trysky ${fmt(p.tisk.tryska, 2)} mm – pružina bude slabá a nepřesná.`, opr('cklip.tloustka', 2 * p.tisk.tryska));
      if (C.gp < 0.6 * p.tisk.tryska) var_(['cklip.mezera', 'tisk.tryska'], `Mezera čelistí ${fmt(C.gp, 2)} mm je na trysku ${fmt(p.tisk.tryska, 2)} mm malá – čelisti se mohou spéct.`, opr('cklip.mezera', vuleTrysky, 2));
      if (C.delka > 150) var_(['cklip.delka', 'sacek.sirka'], `Profil se tiskne na výšku ${fmt(C.delka, 0)} mm – úzký vysoký tisk je vratký; použijte límec (brim) nebo kratší kolíčky.`);
    }
    if (p.tisk.uhel < 45) info(['tisk.uhel'], `Díly jsou navržené na převis 45°. Při ${fmt(p.tisk.uhel)}° může tisk potřebovat podpory – ukáže je tisková poloha.`);
    return H;
  }

  /* ---------------- geometrie ---------------- */
  const BARVY = { a: '#4F86D9', b: '#E07B39', c: '#2EAD5B', pant: '#B9A23A' };
  const obd = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  /** Pás tloušťky t podél úsečky A → B. */
  const pas = (A, B, t) => PRUZ.tlustaKrivka([A, B], t);
  const segmenty = r => Math.max(24, Math.min(96, Math.ceil(2 * Math.PI * r / 0.4 / 4) * 4));
  /** Profil C-klipu: pásy ramen a náběhů, kolečka ve zlomech, hřbet jako prstencová výseč. */
  function profilCklipu(C) {
    const b = [PRUZ.vysec(0, 0, C.Rm - C.t / 2, C.Rm + C.t / 2, Math.PI / 2 - C.beta - 0.02, 3 * Math.PI / 2 + C.beta + 0.02)];
    for (const s of [1, -1]) {
      const z = P => [P[0], s * P[1]];
      b.push(pas(z(C.Pt), z(C.Pp), C.t), PRUZ.kruh(C.Pp[0], s * C.Pp[1], C.t / 2), pas(z(C.Pp), z(C.Pk), C.t), PRUZ.kruh(C.Pk[0], s * C.Pk[1], C.t / 2));
    }
    return b;
  }
  /** Střednice jedné poloviny C-klipu od místa sevření po střed hřbetu (pro výpočet tuhosti). */
  function stredniceCklipu(C) {
    return [C.Pp, ...PRUZ.oblouk(0, 0, C.Rm, Math.PI / 2 - C.beta, Math.PI, 48)];
  }

  /** Sítě z DOZY.postav podle projektu – závit se staví nejdéle a při změně jiného dílu výlevky zůstává stejný. */
  const pametDoz = new Map();
  function dozyModel(w, pd) {
    const k = JSON.stringify(pd);
    if (!pametDoz.has(k)) { if (pametDoz.size >= 9) pametDoz.delete(pametDoz.keys().next().value); pametDoz.set(k, DOZY.postav(w, pd)); }
    return pametDoz.get(k);
  }

  /** Sestaví díly přes manifold-3d → {dily, sestava, o, cas}. */
  function postav(w, p) {
    const t0 = Date.now(), o = odvozene(p);
    const { Manifold: M, CrossSection: CS, Mesh } = w;
    const smaz = [];
    const km = x => { smaz.push(x); return x; };
    const cs = (...b) => (b.length === 1 ? km(new CS([b[0]], 'NonZero')) : km(CS.union(b.map(x => km(new CS([x], 'NonZero'))))));
    const vytah = (c, z0, z1) => km(km(c.extrude(z1 - z0)).translate([0, 0, z0]));
    const otoc = (b, n) => km(km(new CS([b], 'NonZero')).revolve(n || segmenty(Math.max(...b.map(x => x[0])))));
    const valec = (x, y, r, z0, z1) => km(km(M.cylinder(z1 - z0, r, r, segmenty(r))).translate([x, y, z0]));
    const sjednot = a => (a.length === 1 ? a[0] : km(M.union(a)));
    const rozdil = (a, b) => (b.length ? km(M.difference([a, ...b])) : a);
    /** Výtah profilu (u, v) podél x: u → y, v → z. */
    const naX = (c, x0, x1) => km(km(c.extrude(x1 - x0)).transform([0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, x0, 0, 0, 1]));
    /** Výtah profilu (u, v) podél y: u → x, v → z, díl leží mezi y0 a y1. */
    const naY = (c, y0, y1) => km(km(c.extrude(y1 - y0)).transform([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, y1, 0, 1]));
    /** Rotační těleso (osa z, z ∈ ⟨0, …⟩) položené do osy y od y0 ve směru s (±1), osa ve výšce zc. */
    const osaY = (m, y0, s, zc) => km(m.transform(s > 0 ? [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, y0, zc, 1] : [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, y0, zc, 1]));
    function sit(m0, jmeno, nazev, barva, navic) {
      const m = km(m0.simplify(1e-3));
      if (m.status() !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${m.status()}`);
      if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
      const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
      const poz = new Float32Array(vp.length / np * 3);
      for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
      const teles = m.decompose().map(km).filter(x => x.volume() > 1e-3).length;
      return Object.assign({ jmeno, nazev, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), teles, telesMa: 1, barva, otocit: false, ks: 1 }, navic);
    }
    const zeSite = d => km(new M(new Mesh({ numProp: 3, vertProperties: new Float32Array(d.poz), triVerts: new Uint32Array(d.idx) })));
    /** Ucho doplňku se středem (cx, cy) a můstkem k dílu (mnohoúhelník): {telo, dira}; kapsa na magnet shora nebo zespodu. */
    function ucho(cx, cy, mustek, vyska, shora) {
      const u = o.ucho, h = vyska || u.h;
      const dira = u.ocko ? valec(cx, cy, u.rd, -1, h + 1) : shora ? valec(cx, cy, u.rd, h - u.hloubka, h + 1) : valec(cx, cy, u.rd, -1, u.hloubka);
      return { telo: vytah(cs(PRUZ.kruh(cx, cy, u.rl), mustek), 0, h), dira };
    }

    /* ---- zaklapávací klip: A (objímka, drážka), B (čep, pero, západka) pootočené o theta, pásek živého pantu ---- */
    function klip(D, doplnek) {
      const q = rozmeryKlipu(p, D, o.s), g = q.g, H = q.H, e = 0.2;
      // rameno A
      const A2 = q.zivy
        ? km(cs(obd(q.xA0, q.yAo, q.xAe, -g / 2)).subtract(cs([[-1, -g / 2 + 1], [-1, -g / 2 - q.od], [0, -g / 2 - q.od], [q.oc, -g / 2], [q.oc, -g / 2 + 1]])))   // odlehčení rohu u pantu
        : km(cs(obd(q.xA0, q.yAo, q.xAe, -g / 2), PRUZ.kruh(0, q.Oy, q.Ro), obd(-q.Ro, q.yAo, 0, q.Oy))
          .subtract(cs([[0, q.Oy], ...PRUZ.oblouk(0, q.Oy, q.Ro + 0.3, -q.fi0, q.max + q.fi0)])));                        // štěrbina pro krček čepu
      const odA = [naX(cs([[-g / 2 + 1, H / 2 - q.hz - 1], [-g / 2 - q.hz, H / 2], [-g / 2 + 1, H / 2 + q.hz + 1]]), q.xj0 - 0.5, q.xj1 + 0.5)];   // drážka
      if (!q.zivy) odA.push(km(otoc([[0, -1], [q.rh, -1], [q.rh, 0], [q.rh + q.k, q.k], [q.rh + q.k, H - q.k], [q.rh, H], [q.rh, H + 1], [0, H + 1]]).translate([0, q.Oy, 0])));
      let A = vytah(A2, 0, H);
      if (doplnek && o.ucho) {
        const u = o.ucho, cx = q.xj0 + u.rl + 3, cy = q.yAo - 0.8 - u.rd;
        const x = ucho(cx, cy, obd(cx - u.rl, cy, cx + u.rl, q.yAo + 0.5), H, true);
        A = sjednot([A, x.telo]); odA.push(x.dira);
      }
      A = rozdil(A, odA);
      // rameno B: tělo, krček, západka (můstek, pružné rameno, zub s náběhem 45°), čep, pero
      const b2 = [obd(q.xB0, g / 2, q.xe, q.yBt),
        obd(q.xe - 0.5, q.yBt - q.tb, q.xb + q.th, q.yBt), obd(q.xb, q.yEnd, q.xb + q.th, q.yBt),
        [[q.xb + e, q.yq], [q.xb - q.u, q.yq], [q.xb - q.u, q.yq - 0.5], [q.xb + e, q.yq - 0.5 - q.u - e]]];
      if (!q.zivy) b2.push(obd(0, q.Oy - q.wn / 2, q.xB0 + 0.1, q.Oy + q.wn / 2));
      let B2 = cs(...b2);
      if (q.zivy) B2 = km(B2.subtract(cs([[-1, g / 2 - 1], [q.oc, g / 2 - 1], [q.oc, g / 2], [0, g / 2 + q.od], [-1, g / 2 + q.od]])));
      const b3 = [vytah(B2, 0, H), naX(cs([[g / 2 + e, H / 2 - q.hz - e], [g / 2 - q.hz, H / 2], [g / 2 + e, H / 2 + q.hz + e]]), q.xj0, q.xj1)];
      if (!q.zivy) b3.push(km(otoc([[0, 0], [q.rp, 0], [q.rp + q.k, q.k], [q.rp + q.k, H - q.k], [q.rp, H], [0, H]]).translate([0, q.Oy, 0])));
      const B = sjednot(b3), Bt = km(km(km(B.translate([0, -q.Oy, 0])).rotate([0, 0, st(q.alfa)])).translate([0, q.Oy, 0]));
      const zaPantem = km(km(M.cube([q.delka + 100, 400, H + 2])).translate([q.zivy ? -50 : q.xj0 - 1, -200, -1]));   // čepový pant má vlastní vůli
      const d = 0.3 / (q.Rw || 1);
      const pasek = theta => vytah(cs(PRUZ.vysec(0, 0, q.Rw - q.tw / 2, q.Rw + q.tw / 2, Math.PI / 2 + theta - d, 3 * Math.PI / 2 + d)), 0, H);
      // do polohy dílu: délka podél y, střed čelistí v y = 0
      const poloz = m => km(km(m.rotate([0, 0, 90])).translate([0, -q.stred, 0]));
      return {
        q, A: poloz(A), B: poloz(B),                                                                                     // zavřeno
        Bt: poloz(Bt),                                                                                                   // rozevřeno k tisku
        pasek: q.zivy ? poloz(pasek(0)) : null, pasekT: q.zivy ? poloz(pasek(q.alfa)) : null,
        mezera: km(A.intersect(zaPantem)).minGap(km(Bt.intersect(zaPantem)), 3),                                          // nejmenší mezera ramen za pantem při tisku
      };
    }

    function lista(D) {
      const L = o.L, y0 = -D / 2, y1 = D / 2, n = Math.min(p.lista.nabeh, D / 4);
      const f = 0.4, plast = cs(PRUZ.kruh(0, L.Ro, L.Ro), [[-L.Ro + f, 0], [L.Ro - f, 0], [L.Ro, f], [L.Ro, L.Ro], [-L.Ro, L.Ro], [-L.Ro, f]]);
      const otvor = G.obrysDiry(L.ri, segmenty(L.ri), L.kapka).map(b => [b[0], b[1] + L.Ro]);
      let telo = naY(plast, y0, y1);
      const od = [naY(cs(otvor, obd(-L.st / 2, L.Ro, L.st / 2, 2 * L.Ro + 1)), y0 - 1, y1 + 1)];
      if (n > 0.2) {
        const a = Math.min(L.st / 2 + n / 2, 0.8 * L.ri);
        for (const s of [1, -1]) {
          const ye = s > 0 ? y0 : y1;   // konec lišty, náběh míří dovnitř (směr s)
          od.push(vytah(cs([[-a, ye - s * 0.1], [a, ye - s * 0.1], [L.st / 2 - 0.01, ye + s * n], [-L.st / 2 + 0.01, ye + s * n]]), L.Ro, 2 * L.Ro + 1));
          if (L.c > 0.05) od.push(osaY(otoc([[0, -1], [L.ri + L.c + 1, -1], [L.ri, L.c], [0, L.c]], segmenty(L.ri)), ye, s, L.Ro));
        }
      }
      if (o.ucho) {
        const u = o.ucho, cx = -(L.Ro + u.rl - 1), cy = y0 + u.rl;
        const x = ucho(cx, cy, obd(cx, cy - u.rl, -L.Ro + 0.5, cy + u.rl), 0, false);
        telo = sjednot([telo, x.telo]); od.push(x.dira);
      }
      const out = [{ m: rozdil(telo, od), jmeno: 'lista', nazev: 'Lišta', barva: BARVY.a }];
      if (p.lista.tycka === 'tisk') {
        const c45 = Math.SQRT1_2, r = L.rr, zc = r * c45, c = Math.min(1, r / 3);
        const prof = PRUZ.oblouk(0, zc, r, -Math.PI / 4, 5 * Math.PI / 4, segmenty(r));   // kruh se zploštěním 45° na podložku
        const m = km(naY(cs(prof), y0, y1).intersect(osaY(otoc([[0, 0], [r - c, 0], [r, c], [r, D - c], [r - c, D], [0, D]], segmenty(r)), y0, 1, zc)));
        out.push({ m, jmeno: 'tycka', nazev: 'Tyčka', barva: BARVY.b, posun: [0, 0, L.Ro - zc], rozpad: 2 * L.Ro + 6 });
      }
      return out;
    }

    function cklip(delka) {
      const C = o.C;
      let telo = vytah(cs(...profilCklipu(C)), 0, delka);
      if (o.ucho) {
        const u = o.ucho, R = C.Rm + C.t / 2, cx = -(R + u.rl - Math.min(1, C.t));
        const x = ucho(cx, 0, obd(cx, -0.8 * u.rl, -R + C.t / 2, 0.8 * u.rl), Math.min(u.h, delka), false);
        telo = rozdil(sjednot([telo, x.telo]), [x.dira]);
      }
      return telo;
    }

    /** Výlevka: tři díly z DOZY.postav; matice dostane vroubky, víčko se posune a pootočí na společnou šroubovici. */
    function vylevka() {
      const V = o.V;
      const hrdlo = dozyModel(w, V.pHrdlo).dily[0];
      const mv = dozyModel(w, V.pMatice), krouzek = mv.dily.find(d => d.jmeno === 'krouzek1');
      const vicko = dozyModel(w, V.pVicko).dily[0];
      // matice: kroužek vzorku posazený na patu závitu hrdla + svislé vroubky na obvodu
      const n = Math.max(8, Math.round(2 * Math.PI * V.Rk / 5)), vroubky = [];
      for (let i = 0; i < n; i++) vroubky.push(km(km(km(M.cylinder(V.hk + 2, 0.8, 0.8, 12)).translate([V.Rk + 0.2, 0, mv.o.zT - 1])).rotate([0, 0, 360 * i / n])));
      const matice = sit(km(rozdil(zeSite(krouzek), vroubky).translate([0, 0, V.zT - mv.o.zT])), 'matice', 'Přítlačná matice', BARVY.c, { otocit: true, rozpad: V.L + 4 });
      // víčko: posun o celé kroky šroubovice + stejné pootočení (pravý závit) – plochy závitu zůstanou proti sobě
      const c = Math.cos(rad(V.uhel)), s = Math.sin(rad(V.uhel)), P = new Float32Array(vicko.poz.length);
      for (let i = 0; i < P.length; i += 3) { const x = vicko.poz[i], y = vicko.poz[i + 1]; P[i] = c * x - s * y; P[i + 1] = s * x + c * y; P[i + 2] = vicko.poz[i + 2] + V.zVicko; }
      return [
        Object.assign({}, hrdlo, { nazev: 'Hrdlo s přírubou', barva: BARVY.a, telesMa: 1 }),
        matice,
        Object.assign({}, vicko, { nazev: 'Víčko', poz: P, barva: BARVY.b, telesMa: 1, rozpad: V.L + V.hk + 16 }),
      ];
    }

    try {
      const dily = [], sestava = [];
      if (p.druh === 'vylevka') { for (const d of vylevka()) { dily.push(d); sestava.push(d); } }
      else {
        let x = 0;   // díly sady vedle sebe podél x (jediný díl zůstává v souřadnicích stavby)
        const vedle = (kusy) => {
          let a = Infinity, b = -Infinity;
          for (const d of kusy) { const B = G.obal(d.poz); a = Math.min(a, B[0]); b = Math.max(b, B[3]); }
          for (const d of kusy) { if (o.sada) d.posun = [x - a, 0, d.posun ? d.posun[2] : 0]; sestava.push(d); }
          x += b - a + 8;
        };
        o.delky.forEach((D, i) => {
          const pri = o.sada ? ` ${fmt(o.sirky[i], 0)} mm` : '', jm = o.sada ? `_${fmt(o.sirky[i], 0)}` : '';
          if (p.druh === 'klip' || p.druh === 'vzorek') {
            const jmeno = (p.druh === 'vzorek' ? 'vzorek' : 'klip') + jm, nazev = (p.druh === 'vzorek' ? 'Vzorek spoje' : 'Klip') + pri;
            const Z = klip(D, p.druh === 'klip');
            dily.push(sit(o.K.zivy ? km(M.union([Z.A, Z.Bt, Z.pasekT])) : km(M.compose([Z.A, Z.Bt])), jmeno, nazev, BARVY.a, { telesMa: o.K.zivy ? 1 : 2, delka: D, mezeraTisku: Z.mezera }));
            const kusy = [sit(Z.A, jmeno + '_A', nazev + ' – rameno s drážkou', BARVY.a, { cast: 'A', delka: D }),
              sit(Z.B, jmeno + '_B', nazev + ' – rameno s perem', BARVY.b, { cast: 'B', delka: D, rozpad: o.K.H + 6 })];
            if (Z.pasek) kusy.push(sit(Z.pasek, jmeno + '_pant', nazev + ' – živý pant', BARVY.pant, { cast: 'pant' }));
            vedle(kusy);
          } else if (p.druh === 'lista') {
            const kusy = lista(D).map(k => sit(k.m, k.jmeno + jm, k.nazev + pri, k.barva, { posun: k.posun, rozpad: k.rozpad, delka: D }));
            for (const d of kusy) dily.push(Object.assign({}, d, { posun: undefined, rozpad: undefined }));
            vedle(kusy);
          } else {
            const delka = p.cklip.pres ? D : o.C.delka, d = sit(cklip(delka), 'cklip' + jm, (p.cklip.pres ? 'C-profil' : 'Kolíček') + pri, BARVY.a, { delka });
            dily.push(d);
            // sestava: profil postavený do roviny xz, délka podél y (řez y = 0 ukáže průřez)
            const P = new Float32Array(d.poz.length), zc = Math.max(o.C.Pk[1], o.C.Rm) + o.C.t / 2;
            for (let j = 0; j < P.length; j += 3) { P[j] = d.poz[j]; P[j + 1] = delka / 2 - d.poz[j + 2]; P[j + 2] = d.poz[j + 1] + zc; }
            vedle([Object.assign({}, d, { poz: P })]);
          }
        });
        if (o.sada) for (const d of sestava) d.posun[0] -= (x - 8) / 2;
      }
      return { dily, sestava, o, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  /* ---------------- tisk, kontroly modelu, kusovník ---------------- */
  function kontrolyModelu(p, model) {
    const H = [];
    for (const d0 of model.dily) {
      if (d0.teles !== d0.telesMa) H.push({ uroven: 'chyba', pole: d0.telesMa === 2 ? ['vule.pant', 'klip.uhel'] : null, text: d0.telesMa === 2
        ? `${d0.nazev}: ramena mají být dvě oddělená tělesa spojená jen pantem, vyšlo ${d0.teles} – čep je s objímkou srostlý, nebo se díl rozpadl.`
        : `${d0.nazev}: díl se rozpadl na ${d0.teles} tělesa – některá část není spojená.` });
      if (d0.mezeraTisku < 0.3) H.push({ uroven: 'chyba', pole: ['klip.uhel'], text: `${d0.nazev}: ramena jsou v tiskové poloze jen ${fmt(d0.mezeraTisku, 2)} mm od sebe a spekla by se – zvětšete úhel rozevření při tisku.`, oprava: { zmeny: { 'klip.uhel': Math.min(MEZE['klip.uhel'][1], p.klip.uhel + 5) } } });
      const d = DOZY.tiskove(d0), r = G.rozborTisku(d, p.tisk.uhel);
      if (r.previs > 3) H.push({ uroven: 'varovani', pole: ['tisk.uhel'], text: `${d0.nazev}: převisy nad ${fmt(p.tisk.uhel)}° od svislice ${fmt(r.previs, 0)} mm² – v tiskové poloze může potřebovat podpory.` });
      if (r.most > 2) H.push({ uroven: 'info', pole: null, text: `${d0.nazev}: tiskárna přemostí ${fmt(r.most, 0)} mm² vodorovného stropu.` });
      const b = G.obal(d.poz);
      if (!naPodlozku(b[3] - b[0], b[4] - b[1], p)) H.push({ uroven: 'chyba', pole: ['sacek.sirka', 'tisk.podlozkaX', 'tisk.podlozkaY'], text: `${d0.nazev} (${fmt(b[3] - b[0], 0)} × ${fmt(b[4] - b[1], 0)} mm) se nevejde na podložku ${fmt(p.tisk.podlozkaX)} × ${fmt(p.tisk.podlozkaY)}.` });
    }
    return H;
  }
  /** Kusovník: [{nazev, ks, pozn, druh: 'tisk'|'nakup', d?}] */
  function kusovnik(p, model) {
    const o = model ? model.o : odvozene(p), out = [], mat = MATERIALY[p.tisk.material].nazev;
    if (model) for (const d of model.dily) out.push({ nazev: d.nazev, ks: d.ks, pozn: d.otocit ? `${mat}, tiskne se otočené` : d.telesMa === 2 ? `${mat}, tisk vcelku – po vytištění rozhýbat pant` : mat, druh: 'tisk', d });
    const n = model ? Math.max(1, o.delky.length) : 1;
    if (p.druh === 'lista' && p.lista.tycka === 'vlastni') for (const D of o.delky) out.push({ nazev: `Tyčka / špejle Ø ${fmt(p.lista.prumer, 1)} × ${fmt(D, 0)} mm`, ks: 1, pozn: 'dřevo, kov nebo plast; konce zaoblit', druh: 'nakup' });
    if (o.doplnek === 'magnet') out.push({ nazev: `Magnet Ø ${fmt(p.doplnek.magnetD, 1)} × ${fmt(p.doplnek.magnetH, 1)} mm`, ks: n, pozn: 'neodymový, vlepit do kapsy', druh: 'nakup' });
    return out;
  }

  const API = {
    AKTUALIZACE, ORIENTACNI, DATUM_MATERIALU, FOLIE, SIRKY, MATERIALY, NAZVY, VYCHOZI, MEZE, VYCTY, PREDVOLBY,
    SOUDEK, STERBINA_ZAP, DELKA_VZORKU, T_PRIRUBY, NAD_MATICI, MAX_SADA,
    normalizuj, predvolba, popis, ulozProjekt, nactiProjekt, odvozene, sirkySady, rozevreniPantu, kontroly, postav, kontrolyModelu, kusovnik,
    profilCklipu, stredniceCklipu, umisti: DOZY.umisti, tiskove: DOZY.tiskove,
    kopie, vezmi: G.vezmi, poloz: G.poloz, fmt,
  };
  if (uzel) module.exports = API; else window.KLIPY = API;
})();

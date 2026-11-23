/* Organizér vrtáků a bitů s popisky – jádro generátoru (bez DOM a bez three.js, běží v node).
   Tři druhy dílu:
   – stojanek: stupňovitý stojánek – řady svislých otvorů po schodech, vrtáky stojí; sady průměrů jako předvolby
               nebo vlastní seznam; hloubka otvoru podle délky vrtáku (DIN 338, typické) nebo pevná,
   – kazeta:   plochý box – vrtáky leží v korýtkách nebo v zaklapávacích klipech, volitelně zasouvací víčko po drážce 45°,
   – bity:     držák bitů (šestihran ¼″ C/E, 5/16″, 4 mm) v mřížce n × m s volitelným magnetem pod každým bitem,
               nebo kolíky ¼″ na nástavce (ořechy).
   Pro všechny: popisky u každého otvoru (vystouplé / vyražené / vložené v rovině – vícebarevný 3MF), podstava Gridfinity
   (rozměry z drzaky_naradi/jadro.js, DN.GF), deska na zeď se šrouby nebo zámek French cleat, kalibrační vzorek vůle.
   Text: rozvrhniText z klicenky/jadro.js (opentype Font předává stránka), 3MF s barvami: KLIC.soubor3mfBarevny.

   Souřadnice: x doprava (šířka), y dozadu (hloubka; přední hrana y = 0), z nahoru; tisková poloha = montážní poloha
   (spodek na podložce, svislé otvory → bez kapky). Vodorovné jsou jen díry pro šrouby v desce na zeď (kapka / kruh, p.diry).
   postav(w, p, font, {kalibrace}) → {sestava, kusy: [{text, dily}], kalibrace: [díly], o, cas}. */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const DN = uzel ? require('../drzaky_naradi/jadro.js') : window.DN;          // Gridfinity: DN.GF
  const klic = () => (uzel ? require('../klicenky/jadro.js') : window.KLIC);  // rozvrhniText, soubor3mfBarevny
  const fmt = G.fmt, kopie = G.kopie, GF = DN.GF;
  const S3 = Math.sqrt(3), rad = s => s * Math.PI / 180;

  /* ---------------- rozměrové tabulky ---------------- */
  const DATUM = '23. 11. 2026';
  const POZNAMKA = 'typické – ověřit měřením';
  /** DIN 338 (vrtáky do kovu, krátká řada „jobber“): [Ø, celková délka] – typické hodnoty z katalogů, ověřit. */
  const DIN338 = [[0.5, 22], [1, 34], [1.5, 40], [2, 49], [2.5, 57], [3, 61], [3.5, 70], [4, 75], [4.5, 80], [5, 86], [5.5, 93], [6, 93], [6.5, 101],
    [7, 109], [7.5, 109], [8, 117], [8.5, 117], [9, 125], [9.5, 125], [10, 133], [11, 142], [12, 151], [13, 151], [14, 160], [16, 178], [20, 205], [30, 250]];
  function delkaVrtaku(d) {
    if (d <= DIN338[0][0]) return DIN338[0][1];
    for (let i = 1; i < DIN338.length; i++) {
      const [a, la] = DIN338[i - 1], [b, lb] = DIN338[i];
      if (d <= b) return Math.round(la + (lb - la) * (d - a) / (b - a));
    }
    return DIN338[DIN338.length - 1][1];
  }
  /** Položka sady: d = Ø otvoru (stopka), D = obálka nad otvorem (stupňovitý vrták), L = délka, hMax = nejvýš hloubka (délka stopky). */
  const pol = (d, popis, D, L, hMax) => ({ d, popis: popis == null ? fmt(d, 2) : popis, D: D || d, L: L || delkaVrtaku(d), hMax: hMax || 0 });
  const rada = (od, do_, krok) => { const a = []; for (let i = 0; od + i * krok <= do_ + 1e-9; i++) a.push(Math.round((od + i * krok) * 100) / 100); return a; };
  const SADY = {
    kov1_10: { nazev: 'Kov 1–10 po 0,5', pozn: '19 vrtáků DIN 338', polozky: () => rada(1, 10, 0.5).map(d => pol(d)) },
    kov1_13: { nazev: 'Kov 1–13 po 0,5', pozn: '25 vrtáků DIN 338', polozky: () => rada(1, 13, 0.5).map(d => pol(d)) },
    kov1_6: { nazev: 'Kov 1–6 po 0,1 (malé)', pozn: '51 vrtáků – popisky nastojato', polozky: () => rada(1, 6, 0.1).map(d => pol(d)) },
    drevo: { nazev: 'Dřevo a zdivo 3–12', pozn: '8 vrtáků; SDS-plus má stopku 10 mm – zadejte vlastní seznam', polozky: () => [3, 4, 5, 6, 7, 8, 10, 12].map(d => pol(d)) },
    stupnovite: { nazev: 'Stupňovité 4–12, 4–20, 4–32', pozn: 'otvor na stopku 6 / 8 / 10 mm, rozteč podle největšího stupně',
      polozky: () => [pol(6, '4–12', 12, 65, 20), pol(8, '4–20', 20, 75, 22), pol(10, '4–32', 32, 90, 25)] },
    zavitniky: { nazev: 'Závitníky M3–M12', pozn: 'otvor na stopku DIN 371 (M3–M10) a DIN 376 (M12)',
      polozky: () => [pol(3.5, 'M3', 0, 56), pol(4.5, 'M4', 0, 63), pol(6, 'M5', 0, 70), pol(6, 'M6', 0, 80), pol(8, 'M8', 0, 90), pol(10, 'M10', 0, 100), pol(9, 'M12', 0, 110)] },
    vlastni: { nazev: 'Vlastní seznam', pozn: 'průměry oddělené mezerou, popisek za dvojtečkou (6:M8)', polozky: null },
  };
  /** Bity a nástavce. af = šestihran přes plochy; kolíky = čtyřhran ¼″ na ořechy. Typické rozměry – ověřit. */
  const BITY = {
    c14: { nazev: '¼″ bity C 6,3 (25 mm)', tvar: 'hex', af: 6.35, hloubka: 12, delka: 25 },
    e14: { nazev: '¼″ dlouhé E 6,3 (50–90 mm)', tvar: 'hex', af: 6.35, hloubka: 20, delka: 50 },
    c8: { nazev: '5/16″ rázové C 8', tvar: 'hex', af: 7.94, hloubka: 14, delka: 30 },
    h4: { nazev: '4 mm precizní bity', tvar: 'hex', af: 4, hloubka: 10, delka: 28 },
    nastavce: { nazev: 'Ořechy ¼″ na kolíky', tvar: 'kolik', ctyrhran: 6.35, kolik: 7 },
  };
  /** Vnější Ø ořechu ¼″ podle velikosti klíče (typické, DIN 3124 – ověřit). */
  const prumerOrechu = s => Math.max(11.8, 1.12 * s + 3.3);
  /** Typické French cleat lišty (shodné se stránkou cleat.html). */
  const CLEATY = { pr18: { nazev: 'Překližka 18 mm, 45°', tl: 18, uhel: 45 }, pr15: { nazev: 'OSB / překližka 15 mm, 45°', tl: 15, uhel: 45 }, tisk12: { nazev: 'Tištěná lišta 12 mm, 45°', tl: 12, uhel: 45 } };

  const MATERIALY = {
    PLA: { nazev: 'PLA', hustota: 1.24 },
    PETG: { nazev: 'PETG', hustota: 1.27 },
    ASA: { nazev: 'ASA', hustota: 1.07 },
    ABS: { nazev: 'ABS', hustota: 1.04 },
  };
  const NAZVY = {
    druh: { stojanek: 'Stupňovitý stojánek', kazeta: 'Kazeta s přihrádkami', bity: 'Držák bitů a nástavců' },
    hloubka: { delka: 'podle délky vrtáku', pevna: 'pevná' },
    uchyt: { korytko: 'korýtka', klip: 'zaklapávací klipy' },
    rezim: { vystouply: 'vystouplé', vyrazeny: 'vyražené', vlozeny: 'vložené v rovině' },
    orientace: { auto: 'automaticky', vodorovne: 'vodorovně', svisle: 'nastojato' },
    upevneni: { zadne: 'volně na stůl', gridfinity: 'podstava Gridfinity', zed: 'deska na zeď (šrouby)', cleat: 'French cleat' },
  };

  /* ---------------- projekt ---------------- */
  const VYCHOZI = {
    nazev: 'Stojánek na vrtáky 1–10',
    druh: 'stojanek',
    diry: 'kapka',
    sada: { id: 'kov1_10', seznam: '2 3 3,3:M4 4 4,2:M5 5 5,5 6 6,8:M8 8 8,5:M10 10' },
    stojanek: { rad: 3, vyskaPredni: 14, krokVysky: 10, hloubka: 'delka', podil: 30, pevna: 20, dno: 2 },
    kazeta: { uchyt: 'korytko', otevreni: 0.85, delka: 0, dno: 1.6, prsty: true, vicko: true, stena: 2.4, tlVicka: 2.4, napis: '' },
    bity: { druh: 'c14', nx: 6, ny: 3, hloubka: 0, af: 0, magnet: false, magnetD: 6, magnetH: 2, dno: 3, orech: 0,
      popisky: 'PH1 PH2 PH3 PZ1 PZ2 PZ3 T10 T15 T20 T25 T30 T40 H3 H4 H5 H6 SL5 SL6', velikosti: '4 5 5,5 6 7 8 9 10 11 12 13' },
    otvory: { vule: 0.3, stena: 2, okraj: 3, zkoseni: 0.5 },
    popisky: { zap: true, rezim: 'vystouply', vyska: 4, relief: 0.6, orientace: 'auto' },
    upevneni: { typ: 'zadne', tlDesky: 4, nadDeskou: 12, sroub: 4.5, cleat: 'pr18', vuleCleat: 0.5 },
    kalibrace: { zap: false, kusu: 5, krok: 0.1, prumer: 6 },
    barvy: { telo: '#3B6EA8', text: '#F4EFE6' },
    tisk: { material: 'PLA', vrstva: 0.2, extruze: 0.45, uhel: 45, sad: 1, podlozka: 220 },
  };
  const MEZE = {
    'stojanek.rad': [1, 8, 1], 'stojanek.vyskaPredni': [4, 120], 'stojanek.krokVysky': [0, 60], 'stojanek.podil': [10, 80], 'stojanek.pevna': [3, 120], 'stojanek.dno': [0.8, 10],
    'kazeta.otevreni': [0.6, 0.95], 'kazeta.delka': [0, 400], 'kazeta.dno': [0.8, 10], 'kazeta.stena': [1.2, 8], 'kazeta.tlVicka': [1.6, 6],
    'bity.nx': [1, 20, 1], 'bity.ny': [1, 12, 1], 'bity.hloubka': [0, 60], 'bity.af': [0, 20], 'bity.magnetD': [2, 15], 'bity.magnetH': [0.8, 6], 'bity.dno': [1.2, 10], 'bity.orech': [0, 40],
    'otvory.vule': [-0.2, 1.5], 'otvory.stena': [0.4, 10], 'otvory.okraj': [0, 20], 'otvory.zkoseni': [0, 2],
    'popisky.vyska': [1.5, 12], 'popisky.relief': [0.2, 3],
    'upevneni.tlDesky': [2, 12], 'upevneni.nadDeskou': [5, 60], 'upevneni.sroub': [2, 10], 'upevneni.vuleCleat': [0, 2],
    'kalibrace.kusu': [2, 9, 1], 'kalibrace.krok': [0.02, 0.5], 'kalibrace.prumer': [1, 30],
    'tisk.vrstva': [0.05, 0.5], 'tisk.extruze': [0.2, 1.2], 'tisk.uhel': [20, 75], 'tisk.sad': [1, 10, 1], 'tisk.podlozka': [80, 600],
  };
  const VYCTY = {
    druh: Object.keys(NAZVY.druh), diry: ['kapka', 'kruh'], 'sada.id': Object.keys(SADY), 'stojanek.hloubka': Object.keys(NAZVY.hloubka),
    'kazeta.uchyt': Object.keys(NAZVY.uchyt), 'bity.druh': Object.keys(BITY), 'popisky.rezim': Object.keys(NAZVY.rezim),
    'popisky.orientace': Object.keys(NAZVY.orientace), 'upevneni.typ': Object.keys(NAZVY.upevneni), 'upevneni.cleat': Object.keys(CLEATY),
    'tisk.material': Object.keys(MATERIALY),
  };
  /** Předvolby: odchylky od výchozího projektu (tisk zůstává uživatelův). */
  const PREDVOLBY = [
    { id: 'kov10', druh: 'stojanek', nazev: 'Stojánek – kov 1–10 po 0,5', popis: '19 vrtáků ve 3 schodech, hloubka podle délky', p: {} },
    { id: 'kov13', druh: 'stojanek', nazev: 'Stojánek – kov 1–13 po 0,5', popis: '25 vrtáků ve 4 schodech', p: { nazev: 'Stojánek na vrtáky 1–13', sada: { id: 'kov1_13' }, stojanek: { rad: 4 } } },
    { id: 'male', druh: 'stojanek', nazev: 'Stojánek – malé 1–6 po 0,1', popis: '51 vrtáků v 5 schodech, popisky nastojato', p: { nazev: 'Malé vrtáky 1–6', sada: { id: 'kov1_6' }, stojanek: { rad: 5, krokVysky: 6, vyskaPredni: 10 }, popisky: { vyska: 3, orientace: 'svisle' } } },
    { id: 'drevo', druh: 'stojanek', nazev: 'Stojánek – dřevo a zdivo 3–12', popis: '8 vrtáků ve 2 schodech', p: { nazev: 'Vrtáky do dřeva', sada: { id: 'drevo' }, stojanek: { rad: 2 }, popisky: { vyska: 5 } } },
    { id: 'stupnovite', druh: 'stojanek', nazev: 'Stojánek – stupňovité vrtáky', popis: '4–12, 4–20, 4–32 v jedné řadě', p: { nazev: 'Stupňovité vrtáky', sada: { id: 'stupnovite' }, stojanek: { rad: 1, vyskaPredni: 24 }, popisky: { vyska: 5 } } },
    { id: 'zavitniky', druh: 'stojanek', nazev: 'Stojánek – závitníky M3–M12', popis: 'otvory na stopky DIN 371/376', p: { nazev: 'Závitníky', sada: { id: 'zavitniky' }, stojanek: { rad: 2, podil: 30 }, popisky: { vyska: 5 } } },
    { id: 'gridfinity', druh: 'stojanek', nazev: 'Stojánek na Gridfinity', popis: 'kov 1–10 po 0,5 na podstavě 42 mm', p: { nazev: 'Vrtáky Gridfinity', upevneni: { typ: 'gridfinity' } } },
    { id: 'zed', druh: 'stojanek', nazev: 'Stojánek na zeď', popis: 'deska se 2 šrouby za stojánkem', p: { nazev: 'Vrtáky na zeď', upevneni: { typ: 'zed' } } },
    { id: 'kazeta', druh: 'kazeta', nazev: 'Kazeta s víčkem – kov 1–10', popis: 'vrtáky leží v korýtkách, zasouvací víčko', p: { nazev: 'Kazeta vrtáků 1–10', druh: 'kazeta', popisky: { vyska: 3.5 } } },
    { id: 'kazeta_klip', druh: 'kazeta', nazev: 'Kazeta s klipy – dřevo 3–12', popis: 'vrtáky zaklapnuté v klipech, bez víčka', p: { nazev: 'Kazeta – dřevo', druh: 'kazeta', sada: { id: 'drevo' }, kazeta: { uchyt: 'klip', vicko: false } } },
    { id: 'bity', druh: 'bity', nazev: 'Bity ¼″ – 18 kusů', popis: 'mřížka 6 × 3 s popisky PH, PZ, TX…', p: { nazev: 'Bity ¼″', druh: 'bity', popisky: { vyska: 3.5 } } },
    { id: 'bity_magnet', druh: 'bity', nazev: 'Bity na French cleat s magnety', popis: 'magnet 6 × 2 pod každým bitem, zámek na lištu', p: { nazev: 'Bity na zeď', druh: 'bity', bity: { magnet: true }, upevneni: { typ: 'cleat' }, popisky: { vyska: 3.5 } } },
    { id: 'bity_e', druh: 'bity', nazev: 'Dlouhé bity E ¼″', popis: 'hlubší otvory 20 mm, 8 × 2', p: { nazev: 'Dlouhé bity', druh: 'bity', bity: { druh: 'e14', nx: 8, ny: 2, popisky: 'PH1 PH2 PH3 PZ1 PZ2 PZ3 T20 T25 T30 T40 SL5 SL6 H4 H5 H6' }, popisky: { vyska: 3.5 } } },
    { id: 'orechy', druh: 'bity', nazev: 'Ořechy ¼″ 4–13 na kolíky', popis: '11 kolíků ve 2 řadách s velikostmi', p: { nazev: 'Ořechy ¼″', druh: 'bity', bity: { druh: 'nastavce', nx: 6, ny: 2 }, popisky: { vyska: 4 } } },
  ];
  function normalizuj(v) { return G.normalizuj(v, { VYCHOZI, MEZE, VYCTY }); }
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(G.slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }
  /** Přepnutí druhu dílu s rozumným názvem (ostatní nastavení zůstává). */
  function prepniDruh(p, druh) {
    const q = kopie(p);
    q.druh = druh;
    if (Object.values(NAZVY.druh).includes(q.nazev) || /^(Stojánek|Kazeta|Bity|Vrtáky)/.test(q.nazev)) q.nazev = { stojanek: 'Stojánek na vrtáky', kazeta: 'Kazeta vrtáků', bity: 'Bity ¼″' }[druh];
    return normalizuj(q).p;
  }

  /* ---------------- seznamy ---------------- */
  /** Vlastní seznam: „2 3,3:M4 6“ → položky; chybné tokeny do chyb. */
  function parsujSeznam(text) {
    const polozky = [], chyby = [];
    for (const t of String(text || '').split(/[\s;]+/).filter(Boolean)) {
      const [c, popis] = t.split(':'), d = G.ctiCislo(c);
      if (!Number.isFinite(d) || d < 0.3 || d > 40) { chyby.push(t); continue; }
      polozky.push(pol(d, popis ? popis.slice(0, 12) : null));
      if (polozky.length >= 120) break;
    }
    return { polozky, chyby };
  }
  function polozkySady(p) {
    if (p.sada.id === 'vlastni') return parsujSeznam(p.sada.seznam);
    return { polozky: SADY[p.sada.id].polozky(), chyby: [] };
  }
  const slova = t => String(t || '').split(/[\s;]+/).filter(Boolean);

  /* ---------------- popisky ---------------- */
  /** Rozměr popisku v mm (w podél čtení, h výška verzálky); bez písma odhad 0,62 × výška na znak. */
  function zmerPopisek(font, text, cap) {
    if (!text || cap <= 0) return { text: '', w: 0, h: 0, roz: null };
    if (font) {
      const roz = klic().rozvrhniText(font, text, {});
      return { text, w: roz.sirka * cap, h: roz.vyska * cap, roz, chybi: roz.chybi };
    }
    return { text, w: 0.62 * cap * [...text].length, h: cap, roz: null };
  }

  /* ---------------- rozvržení ---------------- */
  const gfPocet = L => Math.max(1, Math.ceil((L + GF.mezera) / GF.roztec - 1e-6));
  /**
   * Rozvržení dílu (bez geometrie): otvory {x, y, r, hl, zTop, popis, lab, ...}, rozměry W × D, výšky, upevnění.
   * font = opentype Font nebo null (odhad šířky popisků).
   */
  function odvozene(p, font) {
    const o = { druh: p.druh, chyby: [], varovani: [], otvory: [], cap: p.popisky.zap ? p.popisky.vyska : 0 };
    const v = p.otvory.vule, st = p.otvory.stena, ok = p.otvory.okraj;
    const gf = p.upevneni.typ === 'gridfinity';
    o.gf = gf;
    o.zB = gf ? GF.vyskaPodstavy : 0;                      // kde začíná vlastní tělo (nad podstavou Gridfinity)
    const zmer = t => zmerPopisek(font, t, o.cap);

    if (p.druh === 'stojanek' || p.druh === 'kazeta') {
      const s = polozkySady(p);
      o.spatne = s.chyby;
      const pol = s.polozky.map(x => Object.assign({}, x, { lab: zmer(x.popis) }));
      if (!pol.length) { o.chyba = 'Seznam průměrů je prázdný – zadejte aspoň jeden průměr.'; return o; }
      if (p.druh === 'stojanek') rozvrhStojanku(p, o, pol, v, st, ok);
      else rozvrhKazety(p, o, pol, v, st, ok);
    } else rozvrhBitu(p, o, v, st, ok, zmer);

    // Gridfinity: obrys na celé buňky, obsah vystředěný
    o.W0 = o.W; o.D0 = o.D;
    if (gf) {
      o.gfN = gfPocet(o.W); o.gfM = gfPocet(o.D);
      const W = o.gfN * GF.roztec - GF.mezera, D = o.gfM * GF.roztec - GF.mezera, dx = (W - o.W) / 2, dy = (D - o.D) / 2;
      for (const h of o.otvory) { h.x += dx; h.y += dy; h.lx += dx; h.ly += dy; }
      if (o.rady) for (const r of o.rady) if (r.y0 > 0) r.y0 += dy;
      if (o.korytka) for (const k of o.korytka) { k.y += dy; k.x0 += dx; }
      if (o.prsty) o.prsty.x += dx;
      o.posun = [dx, dy];
      o.W = W; o.D = D;
    } else o.posun = [0, 0];
    o.R = gf ? GF.rKrabicky : 1.5;                         // zaoblení rohů půdorysu

    // deska na zeď / French cleat za tělem
    const u = p.upevneni;
    if (u.typ === 'zed' || u.typ === 'cleat') {
      const c = CLEATY[u.cleat];
      o.deska = { y0: o.D, y1: o.D + u.tlDesky, z1: o.H + u.nadDeskou };
      if (u.typ === 'cleat') {
        const hl = c.tl - u.vuleCleat - 0.5, pad = hl * Math.tan(rad(c.uhel)), a = 6;   // hloubka zámku, pokles úkosu, výška kořene
        o.deska.zamek = { hl, pad, a, uhel: c.uhel, tl: c.tl };
        o.deska.z1 = Math.max(o.deska.z1, pad + a + 4);
        o.deska.patka = { hl, z1: 8 };
      } else {
        const n = o.W > 70 ? 2 : 1, zs = o.H + u.nadDeskou / 2;
        o.deska.srouby = Array.from({ length: n }, (_, i) => ({ x: n === 1 ? o.W / 2 : o.W * (0.2 + 0.6 * i), z: zs }));
      }
    }
    o.Dcelk = o.deska ? o.deska.y1 + (o.deska.zamek ? o.deska.zamek.hl : 0) : o.D;
    o.Hcelk = Math.max(o.H + (o.kolik ? o.kolik.h : 0), o.deska ? o.deska.z1 : 0);
    o.steny = minStena(o);
    return o;
  }

  function hloubkaOtvoru(p, x) {
    const s = p.stojanek;
    let h = s.hloubka === 'pevna' ? s.pevna : x.L * s.podil / 100;
    if (x.hMax) h = Math.min(h, x.hMax);
    return Math.max(3, Math.round(h * 10) / 10);
  }
  function rozvrhStojanku(p, o, pol, v, st, ok) {
    const S = p.stojanek, R = Math.min(S.rad, pol.length), naRadu = Math.ceil(pol.length / R), cap = o.cap;
    const rady = [];
    for (let r = 0; r < R; r++) { const a = pol.slice(r * naRadu, (r + 1) * naRadu); if (a.length) rady.push(a); }
    const Dm = x => x.D + 2 * v;   // obálka otvoru / vrtáku
    const mezeraPop = Math.max(1.2, 0.5 * cap);   // mezera mezi sousedními popisky
    /** Rozměry pro orientaci popisků: šířky slotů a hloubky pásů. */
    function zkus(svisle) {
      let Wmax = 0, Dsum = ok;
      for (const a of rady) {
        let w = 0;
        for (const x of a) w += Math.max(Dm(x) + st, cap ? (svisle ? x.lab.h : x.lab.w) + mezeraPop : 0);
        Wmax = Math.max(Wmax, w);
        const pas = cap ? (svisle ? Math.max(...a.map(x => x.lab.w)) : Math.max(...a.map(x => x.lab.h))) + 1.4 : 0;
        Dsum += pas + Math.max(...a.map(Dm)) + st;
      }
      return { W: Wmax + 2 * ok, D: Dsum - st + ok };
    }
    let svisle = p.popisky.orientace === 'svisle';
    if (cap && p.popisky.orientace === 'auto') { const a = zkus(false), b = zkus(true); svisle = b.W * b.D < 0.92 * a.W * a.D; }
    o.svisle = !!cap && svisle;
    const roz = zkus(o.svisle);
    o.W = roz.W; o.D = roz.D;
    let y = ok, prev = -Infinity;
    o.rady = [];
    rady.forEach((a, ri) => {
      const pas = cap ? (o.svisle ? Math.max(...a.map(x => x.lab.w)) : Math.max(...a.map(x => x.lab.h))) + 1.4 : 0;
      const dmax = Math.max(...a.map(Dm)), hl = a.map(x => hloubkaOtvoru(p, x));
      let h = ri === 0 ? S.vyskaPredni : prev + S.krokVysky;
      h = Math.max(h, Math.max(...hl) + S.dno);
      if (ri > 0) h = Math.max(h, prev);
      prev = h;
      const y0 = ri === 0 ? 0 : y - st / 2;   // přední hrana schodu
      const yc = y + pas + dmax / 2;
      const sloty = a.map(x => Math.max(Dm(x) + st, cap ? (o.svisle ? x.lab.h : x.lab.w) + mezeraPop : 0));
      const sirka = sloty.reduce((s, w) => s + w, 0);
      let x0 = ok + (o.W - 2 * ok - sirka) / 2;
      a.forEach((x, i) => {
        const xc = x0 + sloty[i] / 2;
        x0 += sloty[i];
        o.otvory.push(Object.assign({}, x, { x: xc, y: yc, r: x.d / 2 + v, ro: Dm(x) / 2, hl: hl[i], zTop: o.zB + h, rada: ri, slot: sloty[i],
          lx: xc, ly: y + pas / 2 + 0.2, lz: o.zB + h }));
      });
      o.rady.push({ y0, h, pas, yc, dmax });
      y = yc + dmax / 2 + st;
    });
    o.H = o.zB + prev;
  }
  function rozvrhKazety(p, o, pol, v, st) {
    const K = p.kazeta, cap = o.cap, s = K.vicko ? K.stena : p.otvory.okraj;
    const rozm = pol.map(x => {
      const r = x.D / 2 + v;
      const a = K.uchyt === 'klip' ? K.otevreni * r : r;   // polovina otevření korýtka
      const c = K.uchyt === 'klip' ? Math.sqrt(r * r - a * a) : 0;   // střed kruhu pod horní plochou
      return { r, a, c, hloubka: c + r, nad: r - c };
    });
    const pas = cap ? Math.max(...pol.map(x => x.lab.w)) + 2.5 : 1;
    const delky = pol.map(x => (K.delka > 0 ? K.delka : x.L) + 2 * v + 1);
    const Li = pas + Math.max(...delky) + 2;
    const sloty = pol.map((x, i) => Math.max(2 * rozm[i].r + p.otvory.stena, cap ? x.lab.h + 1.2 : 0));
    o.W = 2 * s + Li; o.D = 2 * s + sloty.reduce((a, b) => a + b, 0);
    const hmax = Math.max(...rozm.map(q => q.hloubka)), nad = Math.max(...rozm.map(q => q.nad));
    o.zI = o.zB + K.dno + hmax;
    o.s = s;
    if (K.vicko) {
      const g = Math.min(1.2, s - 1, K.tlVicka - 0.8);
      o.vicko = { g, tl: K.tlVicka, v: Math.max(0.15, v) };
      o.H = o.zI + nad + 0.8 + K.tlVicka + o.vicko.v;
      o.vicko.z0 = o.H - K.tlVicka;
    } else o.H = o.zI;
    o.korytka = [];
    let y = s;
    pol.forEach((x, i) => {
      const yc = y + sloty[i] / 2, q = rozm[i];
      y += sloty[i];
      o.korytka.push({ y: yc, x0: s + pas, delka: delky[i], r: q.r, a: q.a, c: q.c, zc: o.zI - q.c });
      o.otvory.push(Object.assign({}, x, { x: s + pas + delky[i] / 2, y: yc, r: q.r, ro: q.r, hl: q.hloubka, zTop: o.zI, slot: sloty[i],
        lx: s + pas / 2 + 0.3, ly: yc, lz: o.zI }));
    });
    o.prsty = K.prsty ? { x: s + pas + 12, r: 7, z0: Math.max(o.zB + K.dno * 0.5, o.zI - hmax - 0.3) } : null;
  }
  function rozvrhBitu(p, o, v, st, ok, zmer) {
    const B = p.bity, typ = BITY[B.druh], cap = o.cap;
    o.typ = typ;
    if (typ.tvar === 'kolik') {
      const vel = slova(B.velikosti).map(t => G.ctiCislo(t)).filter(x => Number.isFinite(x) && x > 0 && x < 40);
      if (!vel.length) { o.chyba = 'Zadejte velikosti ořechů (např. 8 10 13).'; return; }
      const N = vel.length, nx = Math.min(B.nx, N), ny = Math.ceil(N / nx);
      const od = vel.map(s => (B.orech > 0 ? B.orech : prumerOrechu(s)));
      const labs = vel.map(s => zmer(fmt(s, 1)));
      const px = Math.max(Math.max(...od) + st, cap ? Math.max(...labs.map(l => l.w)) + Math.max(1.2, 0.5 * cap) : 0);
      const pas = cap ? cap + 1.4 : 0, py = Math.max(...od) + st + pas;
      o.W = nx * px + 2 * ok; o.D = ny * py - st + 2 * ok;
      o.H = o.zB + B.dno;
      o.kolik = { a: typ.ctyrhran - v, h: typ.kolik };
      vel.forEach((s, i) => {
        const ix = i % nx, iy = Math.floor(i / nx), x = ok + px * (ix + 0.5), y = ok + py * iy + pas + Math.max(...od) / 2;
        o.otvory.push({ d: typ.ctyrhran, popis: fmt(s, 1), lab: labs[i], x, y, r: o.kolik.a / 2, ro: od[i] / 2, hl: 0, zTop: o.H, L: 0,
          lx: x, ly: y - Math.max(...od) / 2 - pas / 2 + 0.2, lz: o.H, slot: px });
      });
      o.mrizka = { nx, ny, px, py };
      return;
    }
    const af = B.af > 0 ? B.af : typ.af, afo = af + 2 * v, Ro = afo / S3;   // vrchol šestihranu
    const N = B.nx * B.ny, texty = slova(B.popisky);
    const labs = Array.from({ length: N }, (_, i) => zmer(texty[i] || ''));
    const px = Math.max(2 * Ro + st, cap ? Math.max(...labs.map(l => l.w)) + Math.max(1.2, 0.5 * cap) : 0);
    const pas = cap && texty.length ? cap + 1.4 : 0, py = afo + st + pas;
    const hl = B.hloubka > 0 ? B.hloubka : typ.hloubka;
    const zDno = B.magnet ? B.magnetH + 0.2 + 0.4 : B.dno;          // magnet zespodu + 2 vrstvy nad ním
    o.W = B.nx * px + 2 * ok; o.D = B.ny * py - st + 2 * ok;
    o.H = o.zB + zDno + hl;
    o.hex = { af, afo, Ro };
    if (B.magnet) o.magnet = { d: B.magnetD + 0.2, h: B.magnetH + 0.2, z0: o.zB };
    for (let i = 0; i < N; i++) {
      const ix = i % B.nx, iy = Math.floor(i / B.nx), x = ok + px * (ix + 0.5), y = ok + py * iy + pas + afo / 2;
      o.otvory.push({ d: af, popis: texty[i] || '', lab: labs[i], x, y, r: afo / 2, ro: Ro, hl, zTop: o.H, L: typ.delka || 0,
        lx: x, ly: y - afo / 2 - pas / 2 + 0.2, lz: o.H, slot: px });
    }
    o.mrizka = { nx: B.nx, ny: B.ny, px, py };
  }
  /** Nejtenčí stěna mezi sousedními otvory (a k okraji) podle rozvržení. */
  function minStena(o) {
    let m = Infinity, kde = null;
    const H = o.otvory;
    if (o.druh === 'kazeta') {
      for (let i = 1; i < H.length; i++) { const s = (H[i].y - H[i - 1].y) - H[i].r - H[i - 1].r; if (s < m) { m = s; kde = [H[i - 1].popis, H[i].popis]; } }
    } else {
      for (let i = 0; i < H.length; i++) for (let j = i + 1; j < H.length; j++) {
        const s = Math.hypot(H[i].x - H[j].x, H[i].y - H[j].y) - H[i].ro - H[j].ro;
        if (s < m) { m = s; kde = [H[i].popis || `#${i + 1}`, H[j].popis || `#${j + 1}`]; }
      }
    }
    return { min: m, kde };
  }

  /* ---------------- kontroly ---------------- */
  function kontroly(p, font) {
    const o = odvozene(p, font), H = [];
    const add = (uroven, text, pole, oprava) => H.push(Object.assign({ uroven, text, pole: pole || null }, oprava ? { oprava } : {}));
    if (o.chyba) { add('chyba', o.chyba, p.druh === 'bity' ? 'bity.velikosti' : 'sada.seznam'); return H; }
    if (o.spatne && o.spatne.length) add('varovani', `Ve vlastním seznamu nejde přečíst: ${o.spatne.slice(0, 6).join(', ')} – zadejte čísla (desetinná čárka) oddělená mezerou, popisek za dvojtečkou.`, 'sada.seznam');
    const ex2 = 2 * p.tisk.extruze;
    if (p.otvory.stena < ex2) add('varovani', `Stěna mezi otvory ${fmt(p.otvory.stena, 2)} mm je tenčí než 2 extruze (${fmt(ex2, 2)} mm) – vytiskne se jen jedna dráha a praskne.`, 'otvory.stena', { text: `Nastavit ${fmt(ex2, 2)} mm`, pole: 'otvory.stena', hodnota: Math.ceil(ex2 * 10) / 10 });
    if (o.steny.min < ex2 - 1e-6 && Number.isFinite(o.steny.min)) add('varovani', `Mezi otvory ${o.steny.kde.join(' a ')} zbývá jen ${fmt(Math.max(0, o.steny.min), 2)} mm materiálu (méně než 2 extruze).`, 'otvory.stena');
    if (o.cap) {
      const chybi = new Set(); o.otvory.forEach(h => (h.lab.chybi || []).forEach(c => chybi.add(c)));
      if (chybi.size) add('varovani', `Písmo nemá znaky ${[...chybi].join(' ')} – v popiscích se vynechají.`, 'popisky.vyska');
      if (o.cap < 2.5) add('varovani', `Popisky vysoké ${fmt(o.cap)} mm se na FDM tiskárně špatně čtou – doporučeno aspoň 3 mm.`, 'popisky.vyska');
      if (p.popisky.rezim === 'vystouply' && p.popisky.relief < 2 * p.tisk.vrstva) add('info', `Vystouplý text ${fmt(p.popisky.relief, 2)} mm = méně než 2 vrstvy – barva textu bude bledá.`, 'popisky.relief');
      if (p.popisky.rezim !== 'vystouply' && p.popisky.relief > Math.max(0.4, (p.druh === 'bity' ? p.bity.dno : 2) - 0.4)) add('info', 'Hluboko vyražený text zeslabí materiál pod ním.', 'popisky.relief');
    }
    if (p.druh === 'stojanek') {
      for (const h of o.otvory) {
        if (h.L && h.hl < 0.2 * h.L) { add('info', `Otvor ${h.popis}: hloubka ${fmt(h.hl)} mm je méně než pětina délky vrtáku (${h.L} mm) – vrták se může vyklonit.`, ['stojanek.podil', 'stojanek.pevna']); break; }
      }
      if (p.stojanek.hloubka === 'delka') add('info', `Délky vrtáků podle DIN 338 (${POZNAMKA}, ${DATUM}) – u jiných řad (krátké, dlouhé) nastavte pevnou hloubku.`, 'stojanek.hloubka');
      if (p.sada.id === 'stupnovite' || p.sada.id === 'zavitniky') add('info', `Stopky ${SADY[p.sada.id].nazev.toLowerCase()} jsou ${POZNAMKA} (${DATUM}) – změřte posuvkou, případně použijte vlastní seznam.`, 'sada.id');
    }
    if (p.druh === 'kazeta') {
      if (p.kazeta.uchyt === 'klip') add('info', `Klipy svírají vrták otvorem ${fmt(p.kazeta.otevreni * 100, 0)} % průměru – horní hrana klipu krátce převisá (do ${fmt((1 - Math.sqrt(1 - p.kazeta.otevreni ** 2)) * 4, 1)} mm u Ø 8), tiskne se bez podpor.`, 'kazeta.otevreni');
      if (p.kazeta.vicko) add('info', 'Víčko se zasouvá zprava po drážkách 45° – tiskne se zvlášť naplocho, spodní (širší) stranou dolů.', 'kazeta.vicko');
    }
    if (p.druh === 'bity') {
      const B = p.bity, typ = BITY[B.druh];
      if (typ.tvar === 'hex') {
        const n = slova(B.popisky).length, N = B.nx * B.ny;
        if (o.cap && n < N) add('info', `Popisků je ${n} na ${N} otvorů – zbylé zůstanou bez popisku.`, 'bity.popisky');
        if (B.af > 0 && Math.abs(B.af - typ.af) > 0.5) add('info', `Vlastní šestihran ${fmt(B.af, 2)} mm místo ${fmt(typ.af, 2)} mm pro ${typ.nazev}.`, 'bity.af');
        if (B.magnet && B.magnetD > o.hex.afo * 2 / S3 + 4) add('varovani', 'Magnet je širší než otvor o víc než 2 mm na stranu – mezi sousedními magnety zbude málo materiálu.', 'bity.magnetD');
      } else add('info', `Vnější Ø ořechů je ${POZNAMKA} (${DATUM}) – u širších ořechů zadejte jejich Ø.`, 'bity.orech');
    }
    const u = p.upevneni;
    if (o.gf) add('info', `Podstava Gridfinity ${o.gfN} × ${o.gfM} (modul 42 mm, profil podle ${GF.zdroj.split(':')[0]}).`, 'upevneni.typ');
    if (u.typ === 'cleat') {
      const c = CLEATY[u.cleat];
      if (90 - c.uhel > p.tisk.uhel) add('varovani', `Spodek zámku má sklon ${c.uhel}° – převis ${90 - c.uhel}° od svislice je víc než povolených ${p.tisk.uhel}°.`, 'upevneni.cleat');
      add('info', `Zámek pro lištu ${c.nazev} (shodně se stránkou French cleat) – zapadne za úkos lišty, dole je opěrka stejné tloušťky.`, 'upevneni.cleat');
    }
    if (u.typ === 'zed') add('info', `Díry Ø ${fmt(u.sroub, 1)} mm ${p.diry === 'kapka' ? 'jako kapka (špička nahoru, tisk bez podpor)' : 'kruhové – strop díry převisá'}; šroub s podložkou nebo půlkulatou hlavou.`, 'upevneni.sroub');
    const Wt = o.W, Dt = o.Dcelk;
    if (Math.max(Wt, Dt) > p.tisk.podlozka || Math.min(Wt, Dt) > p.tisk.podlozka) add('varovani', `Díl ${fmt(Wt, 0)} × ${fmt(Dt, 0)} mm se nevejde na podložku ${fmt(p.tisk.podlozka, 0)} mm – zmenšete sadu nebo rozdělte na dva díly.`, 'tisk.podlozka');
    if (!H.some(x => x.uroven === 'chyba' || x.uroven === 'varovani')) H.unshift({ uroven: 'ok', text: 'Bez chyb a varování – díl se tiskne spodkem dolů bez podpor.', pole: null });
    return H;
  }

  /* ---------------- stavba ---------------- */
  function sit(k, m0, jmeno, nazev, role, barva) {
    const m = k(m0.simplify(1e-4));
    const st = m.status();
    if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
    if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
    const kusy = m.decompose().map(k);
    return { jmeno, nazev, role, barva, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), teles: kusy.filter(x => x.volume() > 1e-3).length, otocit: false };
  }
  const nSeg = r => Math.max(16, Math.min(96, Math.ceil(2 * Math.PI * r / 0.6 / 4) * 4));

  function postav(w, p, font, volby = {}) {
    const t0 = Date.now(), o = odvozene(p, font);
    if (o.chyba) throw new Error(o.chyba);
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const krabice = (x0, y0, z0, x1, y1, z1) => k(k(M.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    const valec = (x, y, z0, z1, r0, r1, n) => k(k(M.cylinder(z1 - z0, r0, r1, n)).translate([x, y, z0]));
    /** Svislý kruhový otvor: opsaný mnohoúhelník (nejužší místo = r) se sražením hrany nahoře. */
    const kruh = (x, y, z0, z1, r, zk = 0) => {
      const n = nSeg(r), c = 1 / Math.cos(Math.PI / n), casti = [valec(x, y, z0, z1, r * c, r * c, n)];
      if (zk > 0) casti.push(valec(x, y, z1 - 1 - zk, z1, r * c, (r + zk) * c, n));   // sražení 45° u horní plochy (z1 = horní plocha + 1)
      return casti;
    };
    /** Zaoblený obdélník jako CrossSection. */
    const zaoblenyCS = (x0, y0, x1, y1, r) => {
      r = Math.max(0.05, Math.min(r, (x1 - x0) / 2 - 0.01, (y1 - y0) / 2 - 0.01));
      return k(k(k(CS.square([x1 - x0 - 2 * r, y1 - y0 - 2 * r])).translate([x0 + r, y0 + r])).offset(r, 'Round', 2, 32));
    };
    /** Profil v rovině (u = y, v = z) vytažený podél x (stejně jako drzaky_naradi vytahniX). */
    const podelX = (cs, x0, x1) => k(k(k(cs.extrude(x1 - x0)).rotate([90, 0, 90])).translate([x0, 0, 0]));
    /** Profil v rovině (u = x, v = z) vytažený podél y od y0 do y1. */
    const podelY = (cs, y0, y1) => k(k(k(cs.extrude(y1 - y0)).rotate([90, 0, 0])).translate([0, y1, 0]));
    const cap = o.cap, P = p.popisky;
    /** Popisek jako CrossSection v mm (vystředěný), případně otočený o 90°. */
    const textCS = (lab, svisle) => {
      if (!lab || !lab.roz || !lab.roz.obrysy.length) return null;
      let cs = k(k(new CS(lab.roz.obrysy.map(ob => ob.map(([x, y]) => [x * cap, y * cap])), 'NonZero')).simplify(0.002));
      if (svisle) cs = k(cs.rotate(90));
      return cs;
    };
    const textNahoru = [], textDolu = [];   // vystouplé / vložené (díl textu) a výřezy do těla
    /** Popisek na vodorovné ploše ve výšce z: podle režimu přidá díl textu a/nebo výřez. */
    function popisek(lab, x, y, z, svisle, kam = { text: textNahoru, odeb: null }) {
      const cs = textCS(lab, svisle);
      if (!cs) return;
      const r = P.relief;
      if (P.rezim === 'vystouply') kam.text.push(k(k(cs.extrude(r)).translate([x, y, z])));
      else {
        kam.odeb.push(k(k(cs.extrude(r + 1)).translate([x, y, z - r])));
        if (P.rezim === 'vlozeny') kam.text.push(k(k(cs.extrude(r)).translate([x, y, z - r])));
      }
    }
    const sjed = a => (a.length === 1 ? a[0] : k(M.union(a)));

    try {
      const pridat = [], odeb = [];
      const z0 = o.gf ? GF.profilKrabicky[GF.profilKrabicky.length - 1][1] - 0.01 : 0;
      const pudorys = h => k(k(zaoblenyCS(0, 0, o.W, o.D, o.R).extrude(h - z0)).translate([0, 0, z0]));
      let telo;
      const kamTelo = { text: textNahoru, odeb };

      if (p.druh === 'stojanek') {
        const schody = o.rady.map(r => krabice(-1, r.y0 - (r.y0 > 0 ? 0 : 1), z0, o.W + 1, o.D + 1, r.h + o.zB));
        telo = k(sjed(schody).intersect(pudorys(o.H + 1)));
        for (const h of o.otvory) {
          odeb.push(...kruh(h.x, h.y, h.zTop - h.hl, h.zTop + 1, h.r, Math.min(p.otvory.zkoseni, h.r * 0.5)));
          if (cap) popisek(h.lab, h.lx, h.ly, h.lz, o.svisle, kamTelo);
        }
      } else if (p.druh === 'kazeta') {
        telo = pudorys(o.H);
        if (o.vicko) odeb.push(krabice(o.s, o.s, o.zI, o.W - o.s, o.D - o.s, o.H + 1));
        for (const q of o.korytka) {
          const n = nSeg(q.r), c = 1 / Math.cos(Math.PI / n);
          const kruhCS = k(k(CS.circle(q.r * c, n)).translate([q.y, q.zc]));
          const otvor = k(k(CS.square([2 * q.a, o.H + 2 - o.zI])).translate([q.y - q.a, o.zI - 0.01]));
          odeb.push(podelX(k(kruhCS.add(otvor)), q.x0, q.x0 + q.delka));
        }
        if (o.prsty) {
          const pr = o.prsty, xs = pr.x, zc = pr.z0 + pr.r;
          const profil = k(k(k(CS.circle(pr.r, 48)).translate([xs, zc])).add(k(k(CS.square([2 * pr.r, o.H + 2 - zc])).translate([xs - pr.r, zc]))));
          const y0 = o.korytka[0].y - o.korytka[0].r, y1 = o.korytka[o.korytka.length - 1].y + o.korytka[o.korytka.length - 1].r;
          odeb.push(podelY(profil, y0, y1));
        }
        if (cap) for (const h of o.otvory) popisek(h.lab, h.lx, h.ly, h.lz, false, kamTelo);
        if (o.vicko) {
          // drážka 45° v podélných stěnách + v levé čelní stěně, pravá čelní stěna snížená (víčko se zasouvá zprava)
          const V = o.vicko, s = o.s, g = V.g, vv = V.v, zd = V.z0 - vv;
          const drazka = k(new CS([[[s - g - vv, zd], [o.D - s + g + vv, zd], [o.D - s + vv, zd + g], [o.D - s + vv, o.H + 1], [s - vv, o.H + 1], [s - vv, zd + g]]], 'NonZero'));
          odeb.push(podelX(drazka, s - g - vv, o.W + 1));
        }
      } else {
        telo = pudorys(o.H);
        if (o.kolik) {
          const a = o.kolik.a, hk = o.kolik.h, sraz = 0.8;
          for (const h of o.otvory) {
            const b = [];
            for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
              b.push([h.x + sx * a / 2, h.y + sy * a / 2, o.H - 0.01], [h.x + sx * a / 2, h.y + sy * a / 2, o.H + hk - sraz], [h.x + sx * (a / 2 - sraz), h.y + sy * (a / 2 - sraz), o.H + hk]);
            }
            pridat.push(k(M.hull(b)));
          }
        } else {
          const Ro = o.hex.Ro, zk = Math.min(p.otvory.zkoseni, 1);
          for (const h of o.otvory) {
            odeb.push(valec(h.x, h.y, h.zTop - h.hl, h.zTop + 1, Ro, Ro, 6));
            if (zk > 0) odeb.push(k(valec(h.x, h.y, h.zTop - zk, h.zTop + 0.01, Ro, Ro + zk * 2 / S3, 6)));
            if (o.magnet) odeb.push(...kruh(h.x, h.y, o.magnet.z0 - 1, o.magnet.z0 + o.magnet.h, o.magnet.d / 2));
          }
        }
        if (cap) for (const h of o.otvory) popisek(h.lab, h.lx, h.ly, h.lz, false, kamTelo);
      }

      // Gridfinity: podstava každé buňky podle profilu (drzaky_naradi – GF.profilKrabicky)
      if (o.gf) {
        const pk = GF.profilKrabicky, vr = pk[pk.length - 1][0], R = GF.rKrabicky;
        for (let i = 0; i < o.gfN; i++) for (let j = 0; j < o.gfM; j++) {
          const c = [i * GF.roztec, j * GF.roztec, i * GF.roztec + GF.zakladna, j * GF.roztec + GF.zakladna];
          const patra = [];
          for (let q = 1; q < pk.length; q++) {
            const body = [];
            for (const [d, z] of [[vr - pk[q - 1][0], pk[q - 1][1]], [vr - pk[q][0], pk[q][1]]]) {
              const cs = zaoblenyCS(c[0] + d, c[1] + d, c[2] - d, c[3] - d, R - d);
              for (const pl of cs.toPolygons()) for (const [x, y] of pl) body.push([x, y, z]);
            }
            patra.push(k(M.hull(body)));
          }
          pridat.push(...patra);
        }
      }
      // deska na zeď / French cleat
      if (o.deska) {
        const d = o.deska;
        pridat.push(krabice(0, d.y0 - 0.5, 0, o.W, d.y1, d.z1));
        if (d.srouby) for (const s of d.srouby) {
          const cs = k(k(new CS([G.obrysDiry(p.upevneni.sroub / 2, 32, p.diry !== 'kruh')], 'NonZero')).translate([s.x, s.z]));
          odeb.push(podelY(cs, d.y0 - 1, d.y1 + 1));
        }
        if (d.zamek) {
          const z = d.zamek, y0 = d.y1 - 0.01, zt = d.z1;
          pridat.push(podelX(k(new CS([[[y0, zt - z.a], [y0 + z.hl, zt - z.a - z.pad], [y0 + z.hl, zt], [y0, zt]]], 'NonZero')), 0, o.W));
          pridat.push(krabice(0, y0, 0, o.W, y0 + z.hl, Math.min(d.patka.z1, zt - z.a - z.pad - 1)));
        }
      }
      if (pridat.length) telo = k(M.union([telo, ...pridat]));
      if (odeb.length) telo = k(M.difference([telo, ...odeb]));
      const dTelo = sit(k, telo, 'telo', p.nazev || NAZVY.druh[p.druh], 'podklad', p.barvy.telo);
      const sestava = [dTelo];
      const kusy = [{ text: p.nazev || NAZVY.druh[p.druh], dily: [dTelo] }];
      if (textNahoru.length) {
        const dT = sit(k, sjed(textNahoru), 'popisky', 'Popisky', 'text', p.barvy.text);
        sestava.push(dT); kusy[0].dily.push(dT);
      }
      // víčko kazety (tisk naplocho širší stranou dolů; v sestavě napůl vysunuté)
      if (o.vicko) {
        const V = o.vicko, s = o.s, g = V.g, vv = V.v;
        const prof = k(new CS([[[s - g + vv, 0], [o.D - s + g - vv, 0], [o.D - s - vv, g], [o.D - s - vv, V.tl], [s + vv, V.tl], [s + vv, g]]], 'NonZero'));
        let vicko = podelX(prof, s - g + vv, o.W);
        // úchop: tři rýhy u pravého konce
        const ryhy = [];
        for (let i = 0; i < 3; i++) ryhy.push(krabice(o.W - 6 - i * 2.2, s + 3, V.tl - 0.6, o.W - 5 - i * 2.2, o.D - s - 3, V.tl + 1));
        vicko = k(M.difference([vicko, ...ryhy]));
        const napis = (p.kazeta.napis || SADY[p.sada.id].nazev).trim(), vt = [], vo = [];
        if (cap && napis && font) {
          const lab = zmerPopisek(font, napis, 1), sir = o.W - 2 * s - 16, vys = o.D - 2 * s - 6;
          const c2 = Math.min(Math.max(cap, 5), sir / Math.max(lab.w, 1e-6), vys / Math.max(lab.h, 1e-6));
          if (c2 >= 2) {
            const cs = k(k(new CS(lab.roz.obrysy.map(ob => ob.map(([x, y]) => [x * c2, y * c2])), 'NonZero')).simplify(0.002));
            const cx = (s + o.W - 12) / 2, cy = o.D / 2;
            if (P.rezim === 'vystouply') vt.push(k(k(cs.extrude(P.relief)).translate([cx, cy, V.tl])));
            else { vo.push(k(k(cs.extrude(P.relief + 1)).translate([cx, cy, V.tl - P.relief]))); if (P.rezim === 'vlozeny') vt.push(k(k(cs.extrude(P.relief)).translate([cx, cy, V.tl - P.relief]))); }
          }
        }
        if (vo.length) vicko = k(M.difference([vicko, ...vo]));
        const dV = sit(k, vicko, 'vicko', 'Víčko', 'podklad', p.barvy.telo);
        const kus = { text: 'Víčko', dily: [dV] };
        if (vt.length) kus.dily.push(sit(k, sjed(vt), 'vicko_text', 'Nápis na víčku', 'text', p.barvy.text));
        kusy.push(kus);
        const dz = V.z0, dx = o.W * 0.85;   // víčko skoro vysunuté – je vidět obsah i drážka
        for (const d of kus.dily) sestava.push(Object.assign({}, d, posun(d, dx, 0, dz)));
      }
      const kal = volby.kalibrace || p.kalibrace.zap ? kalibrace(w, k, p, font, o) : [];
      if (p.kalibrace.zap) kusy.push({ text: 'Kalibrační vzorek', dily: kal });
      return { sestava, kusy, kalibrace: kal, o, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }
  const posun = (d, dx, dy, dz) => {
    const P = new Float32Array(d.poz.length);
    for (let i = 0; i < P.length; i += 3) { P[i] = d.poz[i] + dx; P[i + 1] = d.poz[i + 1] + dy; P[i + 2] = d.poz[i + 2] + dz; }
    return { poz: P };
  };

  /** Hodnoty vůle kalibračního vzorku (prostřední = nastavená). */
  function vuleKalibrace(p) {
    const K = p.kalibrace;
    return Array.from({ length: K.kusu }, (_, i) => Math.round((p.otvory.vule + (i - (K.kusu - 1) / 2) * K.krok) * 1000) / 1000);
  }
  /** Kalibrační vzorek: lišta s řadou průchozích otvorů (kruh / šestihran) nebo kolíků s odstupňovanou vůlí, hodnoty vyražené. */
  function kalibrace(w, k, p, font, o) {
    const { Manifold: M, CrossSection: CS } = w;
    const vule = vuleKalibrace(p), typ = p.druh === 'bity' ? BITY[p.bity.druh] : null;
    const tvar = typ ? typ.tvar : 'kruh', nom = typ ? (typ.tvar === 'hex' ? (p.bity.af > 0 ? p.bity.af : typ.af) : typ.ctyrhran) : p.kalibrace.prumer;
    const cap = Math.min(3, Math.max(2, p.popisky.vyska * 0.75));
    const labs = vule.map(v => zmerPopisek(font, fmt(v, 2), cap));
    const rozmer = tvar === 'hex' ? (nom + 0.8) * 2 / S3 : nom + 1;
    const pitch = Math.max(rozmer + 3, Math.max(...labs.map(l => l.w)) + 1.5);
    const W = vule.length * pitch + 3, D = rozmer + 4 + cap + 2, H = tvar === 'kolik' ? 3 : 6;
    let m = k(k(M.cube([W, D, H])).translate([0, 0, 0]));
    const odeb = [], prid = [];
    vule.forEach((v, i) => {
      const x = 1.5 + pitch * (i + 0.5), y = 2 + rozmer / 2;
      if (tvar === 'hex') { const R = (nom + 2 * v) / S3; odeb.push(k(k(M.cylinder(H + 2, R, R, 6)).translate([x, y, -1]))); }
      else if (tvar === 'kolik') { const a = nom - v; prid.push(k(k(M.cube([a, a, 7])).translate([x - a / 2, y - a / 2, H - 0.01]))); }
      else { const r = nom / 2 + v, n = nSeg(r), c = 1 / Math.cos(Math.PI / n); odeb.push(k(k(M.cylinder(H + 2, r * c, r * c, n)).translate([x, y, -1]))); }
      const l = labs[i];
      if (l.roz && l.roz.obrysy.length) {
        const cs = k(k(new CS(l.roz.obrysy.map(ob => ob.map(([a, b]) => [a * cap, b * cap])), 'NonZero')).simplify(0.002));
        odeb.push(k(k(cs.extrude(1.6)).translate([x, D - 1 - cap / 2 - 0.4, H - 0.6])));
      }
    });
    if (prid.length) m = k(M.union([m, ...prid]));
    if (odeb.length) m = k(M.difference([m, ...odeb]));
    const d = sit(k, m, 'kalibrace', 'Kalibrační vzorek', 'podklad', p.barvy.telo);
    d.vule = vule; d.nominal = nom; d.tvar = tvar; d.pitch = pitch; d.D = D;
    return [d];
  }

  /** Rozbor převisů dílu v tiskové poloze. */
  function kontrolyModelu(p, model) {
    const H = [];
    const vse = model.kusy.flatMap(x => x.dily).concat(p.kalibrace.zap ? [] : model.kalibrace);
    for (const d of vse) {
      if (d.role === 'podklad' && d.teles > 1) H.push({ uroven: 'chyba', pole: null, text: `${d.nazev}: díl se rozpadl na ${d.teles} tělesa – některá část není spojená.` });
      if (d.role !== 'podklad') continue;
      const r = G.rozborTisku(d, p.tisk.uhel);
      if (r.previs > 5) H.push({ uroven: 'varovani', pole: ['tisk.uhel'], text: `${d.nazev}: převisy nad ${fmt(p.tisk.uhel)}° od svislice ${fmt(r.previs, 0)} mm² – v místě převisu může potřebovat podpory.` });
      if (r.most > 2) H.push({ uroven: 'info', pole: null, text: `${d.nazev}: tiskárna přemostí ${fmt(r.most, 0)} mm² vodorovného stropu${p.bity.magnet && p.druh === 'bity' ? ' (strop nad magnety)' : ''}.` });
    }
    return H;
  }
  /** Výšky (mm), ve kterých začíná text na těle – pro výměnu filamentu (M600) u jedné trysky. */
  function vyskyTextu(p, o) {
    if (!o.cap || p.popisky.rezim === 'vyrazeny') return [];
    const z = new Set(o.otvory.filter(h => h.lab && h.lab.w > 0).map(h => Math.round((h.lz - (p.popisky.rezim === 'vlozeny' ? p.popisky.relief : 0)) * 100) / 100));
    return [...z].sort((a, b) => a - b);
  }

  /* ---------------- projekt ---------------- */
  function popis(p) {
    const druh = NAZVY.druh[p.druh];
    if (p.druh === 'bity') return `${druh} · ${BITY[p.bity.druh].nazev}${BITY[p.bity.druh].tvar === 'hex' ? ` · ${p.bity.nx} × ${p.bity.ny}` : ''}`;
    return `${druh} · ${SADY[p.sada.id].nazev}${p.upevneni.typ !== 'zadne' ? ' · ' + NAZVY.upevneni[p.upevneni.typ] : ''}`;
  }
  const TYP = 'organizer_vrtaku';
  const ulozProjekt = p => G.projektJson(TYP, p, 1);
  const nactiProjekt = text => G.nactiProjektJson(text, TYP, normalizuj, 'Organizér vrtáků');

  const API = {
    DATUM, POZNAMKA, DIN338, SADY, BITY, CLEATY, MATERIALY, NAZVY, VYCHOZI, MEZE, VYCTY, PREDVOLBY,
    delkaVrtaku, prumerOrechu, parsujSeznam, polozkySady, zmerPopisek, normalizuj, predvolba, prepniDruh, odvozene, kontroly,
    postav, kontrolyModelu, vuleKalibrace, vyskyTextu, popis, ulozProjekt, nactiProjekt, kopie, vezmi: G.vezmi, poloz: G.poloz, fmt,
  };
  if (uzel) module.exports = API; else window.ORGV = API;
})();

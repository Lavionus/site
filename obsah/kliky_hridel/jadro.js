/* Kliky a ruční kola na hřídel – jádro generátoru (bez DOM a bez three.js, spustitelné v node).
   Druhy: klika (rameno + otočné držadlo), ruční kolo (věnec s loukotěmi nebo plné, volitelně s držadlem),
   hvězdicová / křídlová rukojeť, páka s koulí (rovná nebo zalomená), sklopná klika (držadlo na pantu).
   Společný náboj: kulatý, D, šestihran, čtyřhran, drážka pro pero, závit (matice / tištěný),
   jištění stavěcím šroubem s kapsou na matici nebo upínací štěrbinou; stupnice pevná nebo nulovatelný kroužek.

   Souřadnice: osa náboje = Z. z = 0 je PŘEDNÍ čelo (k obsluze) a zároveň podložka tiskárny,
   +Z míří ke stroji. Rameno / loukotě / deska leží na podložce (z = 0 … t), náboj roste ke stroji (z = 0 … H),
   stupnice je na konci náboje u stroje (tam, kde je pevná ryska na stroji). Rameno míří do +X,
   stavěcí šroub, ploška D, pero i štěrbina míří do −X (mimo rameno, u kola mezi loukotě).
   Držadlo je samostatný díl s vlastním čepem: tiskne se nastojato (čelo k obsluze dole, čep nahoře),
   čep prochází otvorem v rameni a otáčí se v něm; jistí ho zobáček na rozříznutém čepu nebo šroub skrz.

   Tabulky (pero DIN 6885 jako v remenice/jadro.js, závitové tyče staví ibc/geometrie.js):
   stavěcí šrouby a matice ISO 4032 / 4762, matice závitu, pevnosti materiálů – typické hodnoty, ověřit měřením (11/2026). */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const fmt = G.fmt;
  const S3 = Math.sqrt(3);

  /* ---------------- tabulky ---------------- */
  /** Materiály: hustota (g/cm³), pevnost v tahu v rovině vrstvy a napříč vrstvami (MPa), přípustné přetvoření zacvaknutí (%).
      Typické hodnoty tištěných dílů (100 % výplň), ověřit – liší se podle výrobce a teploty tisku. */
  const MATERIALY = {
    PETG: { nazev: 'PETG', hustota: 1.27, sXY: 45, sZ: 28, eps: 4 },
    PLA: { nazev: 'PLA', hustota: 1.24, sXY: 55, sZ: 30, eps: 2.5 },
    ASA: { nazev: 'ASA', hustota: 1.07, sXY: 40, sZ: 22, eps: 3 },
    ABS: { nazev: 'ABS', hustota: 1.04, sXY: 38, sZ: 20, eps: 3 },
    PA: { nazev: 'PA (nylon)', hustota: 1.14, sXY: 50, sZ: 30, eps: 6 },
    PC: { nazev: 'PC', hustota: 1.2, sXY: 60, sZ: 35, eps: 4 },
  };
  /** Šrouby s válcovou hlavou ISO 4762 a matice ISO 4032: d, s = klíč matice, m = výška matice, dh / kh = hlava,
      predvrt = otvor pro závit přímo v plastu, drzeni = orientační přídržná síla stavěcího šroubu s důlkem (N, ověřit). */
  const SROUBY = {
    M3: { d: 3, s: 5.5, m: 2.4, dh: 5.5, kh: 3, predvrt: 2.5, drzeni: 350, predpeti: 500 },
    M4: { d: 4, s: 7, m: 3.2, dh: 7, kh: 4, predvrt: 3.3, drzeni: 550, predpeti: 800 },
    M5: { d: 5, s: 8, m: 4, dh: 8.5, kh: 5, predvrt: 4.2, drzeni: 800, predpeti: 1100 },
    M6: { d: 6, s: 10, m: 5, dh: 10, kh: 6, predvrt: 5, drzeni: 1100, predpeti: 1500 },
  };
  /** Závity hřídele: d, stoupání, matice (klíč s, výška m). UNC rozměry podle ASME B18.2.2 (typické, ověřit). */
  const ZAVITY = {
    M5: { nazev: 'M5', d: 5, p: 0.8, s: 8, m: 4 },
    M6: { nazev: 'M6', d: 6, p: 1, s: 10, m: 5 },
    M8: { nazev: 'M8', d: 8, p: 1.25, s: 13, m: 6.5 },
    M10: { nazev: 'M10', d: 10, p: 1.5, s: 17, m: 8 },
    M12: { nazev: 'M12', d: 12, p: 1.75, s: 19, m: 10 },
    UNC1_4: { nazev: '1/4″-20 UNC', d: 6.35, p: 1.27, s: 11.11, m: 5.56 },
    UNC5_16: { nazev: '5/16″-18 UNC', d: 7.94, p: 1.411, s: 12.7, m: 6.75 },
    UNC3_8: { nazev: '3/8″-16 UNC', d: 9.525, p: 1.5875, s: 14.29, m: 8.33 },
  };
  /** Předvolby hřídelí (typické – ověřit měřením posuvkou, 11/2026). */
  const HRIDELE = [
    { id: 'k6', nazev: 'kulatá 6 mm', tvar: 'kruh', prumer: 6 },
    { id: 'k8', nazev: 'kulatá 8 mm', tvar: 'kruh', prumer: 8 },
    { id: 'k10', nazev: 'kulatá 10 mm', tvar: 'kruh', prumer: 10 },
    { id: 'k12', nazev: 'kulatá 12 mm', tvar: 'kruh', prumer: 12 },
    { id: 'k14', nazev: 'kulatá 14 mm', tvar: 'kruh', prumer: 14 },
    { id: 'k16', nazev: 'kulatá 16 mm', tvar: 'kruh', prumer: 16 },
    { id: 'i14', nazev: 'kulatá 1/4″ (6,35 mm)', tvar: 'kruh', prumer: 6.35 },
    { id: 'i516', nazev: 'kulatá 5/16″ (7,94 mm)', tvar: 'kruh', prumer: 7.94 },
    { id: 'i38', nazev: 'kulatá 3/8″ (9,53 mm)', tvar: 'kruh', prumer: 9.525 },
    { id: 'i12', nazev: 'kulatá 1/2″ (12,7 mm)', tvar: 'kruh', prumer: 12.7 },
    { id: 'd6', nazev: 'D 6 mm, přes plošku 5,5', tvar: 'd', prumer: 6, ploska: 5.5 },
    { id: 'd8', nazev: 'D 8 mm, přes plošku 7', tvar: 'd', prumer: 8, ploska: 7 },
    { id: 'd10', nazev: 'D 10 mm, přes plošku 9', tvar: 'd', prumer: 10, ploska: 9 },
    { id: 'p10', nazev: '10 mm s perem 3 mm', tvar: 'pero', prumer: 10 },
    { id: 'p12', nazev: '12 mm s perem 4 mm', tvar: 'pero', prumer: 12 },
    { id: 'p16', nazev: '16 mm s perem 5 mm', tvar: 'pero', prumer: 16 },
    { id: 'h6', nazev: 'šestihran 1/4″ (bit 6,35)', tvar: 'sestihran', prumer: 6.35 },
    { id: 'h8', nazev: 'šestihran 8 mm', tvar: 'sestihran', prumer: 8 },
    { id: 'h10', nazev: 'šestihran 10 mm', tvar: 'sestihran', prumer: 10 },
    { id: 'c8', nazev: 'čtyřhran 8 mm', tvar: 'ctyrhran', prumer: 8 },
    { id: 'c10', nazev: 'čtyřhran 10 mm', tvar: 'ctyrhran', prumer: 10 },
    { id: 'zM8', nazev: 'závit M8', tvar: 'zavit', zavit: 'M8' },
    { id: 'zM10', nazev: 'závit M10', tvar: 'zavit', zavit: 'M10' },
    { id: 'zU38', nazev: 'závit 3/8″-16 UNC', tvar: 'zavit', zavit: 'UNC3_8' },
  ];
  const NAZVY = {
    druh: { klika: 'klika s otočným držadlem', kolo: 'ruční kolo', hvezda: 'hvězdicová / křídlová rukojeť', paka: 'páka s koulí', sklopna: 'sklopná klika' },
    tvar: { kruh: 'kulatý', d: 'D (s ploškou)', sestihran: 'šestihran', ctyrhran: 'čtyřhran', pero: 'drážka pro pero', zavit: 'závit' },
    jisteni: { zadne: 'bez jištění', stavec: 'stavěcí šroub s maticí', sterbina: 'upínací štěrbina se šroubem' },
    zavitTyp: { matice: 'zalisovaná matice', tisk: 'tištěný závit' },
    stupnice: { zadna: 'bez stupnice', pevna: 'pevná na náboji', krouzek: 'nulovatelný kroužek' },
    cisla: { vyrazena: 'vyražená', vystoupla: 'vystouplá', zadna: 'bez čísel' },
    uchyceni: { zacvak: 'zacvaknutý čep', sroub: 'šroub skrz čep' },
    tvarDrzadla: { soudek: 'soudek', valec: 'válec' },
    dilTelesa: { klika: 'Klika', kolo: 'Ruční kolo', hvezda: 'Rukojeť', paka: 'Páka', sklopna: 'Sklopná klika' },
  };

  const VYCHOZI = {
    verze: 1, nazev: 'Klika posuvu', diry: 'kapka',
    druh: 'klika',
    hridel: { tvar: 'pero', prumer: 12, ploska: 9, zavit: 'M8', zavitTyp: 'matice', vule: 0.2, pruchozi: true, celo: 2 },
    naboj: { prumer: 30, delka: 34, jisteni: 'stavec', sroub: 'M4', vuleMatice: 0.3 },
    rameno: { delka: 70, sirka: 20, sirkaKonec: 14, tloustka: 8, delka2: 0, uhel: 0 },
    drzadlo: { delka: 55, prumer: 24, tvar: 'soudek', cep: 10, vule: 0.25, uchyceni: 'sroub', sroub: 'M5', pant: 'M4' },
    kolo: { prumer: 100, venec: 14, vyska: 10, loukoti: 3, sirkaLouk: 12, tlLouk: 7, drzadlo: true },
    hvezda: { prumer: 50, ramen: 5, lalok: 14, vyska: 14 },
    paka: { koule: 26 },
    stupnice: { typ: 'krouzek', stoupani: 1.5, dilku: 50, prumerove: false, opacne: false, prumer: 40, vyska: 12, stena: 3.5, cisla: 'vyrazena', kazde: 5, vyskaCisel: 3.5, hloubka: 0.5, vule: 0.1, jisteni: true },
    tisk: { material: 'PETG', vrstva: 0.2, uhel: 45, krok: 0.1, kalibrace: false },
    mech: { moment: 1.5, sila: 40, silaMax: 100, otacky: 60 },
  };
  const MEZE = {
    'hridel.prumer': [2, 40], 'hridel.ploska': [1, 40], 'hridel.vule': [-0.3, 1], 'hridel.celo': [0.6, 10],
    'naboj.prumer': [6, 90], 'naboj.delka': [3, 120], 'naboj.vuleMatice': [0, 1],
    'rameno.delka': [10, 400], 'rameno.sirka': [4, 80], 'rameno.sirkaKonec': [4, 80], 'rameno.tloustka': [2, 40], 'rameno.delka2': [0, 300], 'rameno.uhel': [-90, 90],
    'drzadlo.delka': [15, 160], 'drzadlo.prumer': [8, 60], 'drzadlo.cep': [3, 20], 'drzadlo.vule': [0, 1],
    'kolo.prumer': [30, 400], 'kolo.venec': [4, 60], 'kolo.vyska': [3, 60], 'kolo.loukoti': [0, 8, 1], 'kolo.sirkaLouk': [3, 60], 'kolo.tlLouk': [2, 40],
    'hvezda.prumer': [16, 200], 'hvezda.ramen': [2, 10, 1], 'hvezda.lalok': [4, 80], 'hvezda.vyska': [3, 60],
    'paka.koule': [8, 80],
    'stupnice.stoupani': [0.1, 20], 'stupnice.dilku': [4, 400, 1], 'stupnice.prumer': [10, 200], 'stupnice.vyska': [4, 60], 'stupnice.stena': [1.5, 30],
    'stupnice.kazde': [1, 100, 1], 'stupnice.vyskaCisel': [2, 15], 'stupnice.hloubka': [0.2, 2], 'stupnice.vule': [-0.3, 1],
    'tisk.vrstva': [0.05, 0.5], 'tisk.uhel': [20, 75], 'tisk.krok': [0.02, 0.3],
    'mech.moment': [0, 1000], 'mech.sila': [1, 1000], 'mech.silaMax': [1, 3000], 'mech.otacky': [1, 1000],
  };
  const VYCTY = {
    diry: ['kapka', 'kruh'], druh: Object.keys(NAZVY.druh), 'hridel.tvar': Object.keys(NAZVY.tvar), 'hridel.zavit': Object.keys(ZAVITY), 'hridel.zavitTyp': Object.keys(NAZVY.zavitTyp),
    'naboj.jisteni': Object.keys(NAZVY.jisteni), 'naboj.sroub': Object.keys(SROUBY),
    'drzadlo.tvar': Object.keys(NAZVY.tvarDrzadla), 'drzadlo.uchyceni': Object.keys(NAZVY.uchyceni), 'drzadlo.sroub': Object.keys(SROUBY), 'drzadlo.pant': Object.keys(SROUBY),
    'stupnice.typ': Object.keys(NAZVY.stupnice), 'stupnice.cisla': Object.keys(NAZVY.cisla), 'tisk.material': Object.keys(MATERIALY),
  };

  /** Předvolby: druhy jako první skupina, pak typické použití (jen odchylky od výchozího projektu). */
  const PREDVOLBY = [
    { id: 'klika', skupina: 'druh', nazev: 'Klika s otočným držadlem', popis: 'rameno 70 mm, držadlo na šroubu M5, pero 12 mm, nulovatelná stupnice', p: {} },
    { id: 'kolo', skupina: 'druh', nazev: 'Ruční kolo', popis: 'Ø 100, 3 loukotě, otočné držadlo, stupnice na náboji',
      p: { nazev: 'Ruční kolo', druh: 'kolo', naboj: { prumer: 34, delka: 40 },
        stupnice: { typ: 'pevna', stoupani: 2, dilku: 100, prumer: 56, vyska: 12, kazde: 10 } } },
    { id: 'hvezda', skupina: 'druh', nazev: 'Hvězdicová rukojeť', popis: '5 ramen Ø 50 na závit M8 se zalisovanou maticí',
      p: { nazev: 'Hvězdicová rukojeť', druh: 'hvezda', hridel: { tvar: 'zavit', zavit: 'M8', zavitTyp: 'matice', pruchozi: true },
        naboj: { prumer: 22, delka: 22, jisteni: 'zadne' }, stupnice: { typ: 'zadna' }, mech: { moment: 0.8, silaMax: 60 } } },
    { id: 'paka', skupina: 'druh', nazev: 'Páka s koulí', popis: 'rovná, 90 mm, koule Ø 26, čtyřhran 10 mm',
      p: { nazev: 'Páka s koulí', druh: 'paka', hridel: { tvar: 'ctyrhran', prumer: 10 }, naboj: { prumer: 24, delka: 18, jisteni: 'zadne' },
        rameno: { delka: 90, sirka: 18, sirkaKonec: 12, tloustka: 9 }, stupnice: { typ: 'zadna' }, mech: { moment: 3 } } },
    { id: 'sklopna', skupina: 'druh', nazev: 'Sklopná klika', popis: 'držadlo se sklopí na pantu M4 – nepřekáží při strojním posuvu',
      p: { nazev: 'Sklopná klika', druh: 'sklopna', rameno: { delka: 80, sirka: 24, sirkaKonec: 18, tloustka: 10 },
        naboj: { prumer: 30, delka: 36 }, stupnice: { typ: 'zadna' } } },
    { id: 'soustruh', nazev: 'Klika příčného suportu', popis: '1,5 mm/ot → 50 dílků po 0,03 mm, nulovatelný kroužek', p: {} },
    { id: 'soustruh_prumer', nazev: 'Klika suportu – čtení na průměr', popis: '1 mm/ot, 50 dílků po 0,04 mm na průměr (2× posuv)',
      p: { nazev: 'Klika suportu (průměr)', stupnice: { stoupani: 1, dilku: 50, prumerove: true, kazde: 5 } } },
    { id: 'frezka', nazev: 'Ruční kolo stolu frézky', popis: 'Ø 100, 2 mm/ot → 100 dílků po 0,02 mm',
      p: { nazev: 'Kolo stolu', druh: 'kolo', naboj: { prumer: 34, delka: 40 },
        stupnice: { typ: 'krouzek', stoupani: 2, dilku: 100, prumer: 56, vyska: 12, stena: 4, kazde: 10 } } },
    { id: 'palcova', nazev: 'Klika s palcovou stupnicí', popis: 'hřídel 3/8″ s ploškou, 10 TPI → 100 dílků po 0,001″',
      p: { nazev: 'Klika 3/8″', hridel: { tvar: 'd', prumer: 9.525, ploska: 8.5 }, naboj: { delka: 40 }, stupnice: { stoupani: 2.54, dilku: 100, kazde: 10, prumer: 56, stena: 4 }, mech: { silaMax: 50 } } },
    { id: 'plne_kolo', nazev: 'Plné kolo s držadlem', popis: 'Ø 80 bez loukotí, D 8 mm, stavěcí šroub M3',
      p: { nazev: 'Plné kolo', druh: 'kolo', hridel: { tvar: 'd', prumer: 8, ploska: 7 }, naboj: { prumer: 22, delka: 28, sroub: 'M3' },
        kolo: { prumer: 80, venec: 14, loukoti: 0, tlLouk: 5 }, stupnice: { typ: 'zadna' }, mech: { moment: 1, silaMax: 60 } } },
    { id: 'ventil', nazev: 'Kolo ventilu (šoupátka)', popis: 'Ø 80, 5 loukotí, čtyřhran 8 mm, bez držadla',
      p: { nazev: 'Kolo ventilu', druh: 'kolo', hridel: { tvar: 'ctyrhran', prumer: 8 }, naboj: { prumer: 22, delka: 16, jisteni: 'zadne' },
        kolo: { prumer: 80, venec: 9, vyska: 10, loukoti: 5, sirkaLouk: 8, tlLouk: 6, drzadlo: false }, stupnice: { typ: 'zadna' }, mech: { moment: 1.2 } } },
    { id: 'navijak', nazev: 'Klika navijáku', popis: 'rameno 120 mm, šestihran 10 mm, držadlo na šroubu M6',
      p: { nazev: 'Klika navijáku', hridel: { tvar: 'sestihran', prumer: 10 }, naboj: { prumer: 26, delka: 30, jisteni: 'stavec' },
        rameno: { delka: 120, sirka: 22, sirkaKonec: 18, tloustka: 12 }, drzadlo: { delka: 90, prumer: 28, cep: 12, uchyceni: 'sroub', sroub: 'M6' },
        stupnice: { typ: 'zadna' }, mech: { moment: 4, silaMax: 120 } } },
    { id: 'kridlova', nazev: 'Křídlová rukojeť', popis: '2 křídla Ø 46, D 6 mm, upínací štěrbina M3',
      p: { nazev: 'Křídlová rukojeť', druh: 'hvezda', hridel: { tvar: 'd', prumer: 6, ploska: 5.5, pruchozi: false },
        naboj: { prumer: 18, delka: 32, jisteni: 'sterbina', sroub: 'M3' }, hvezda: { prumer: 46, ramen: 2, lalok: 16, vyska: 8 }, stupnice: { typ: 'zadna' }, mech: { moment: 0.6, silaMax: 40 } } },
    { id: 'paka_zalomena', nazev: 'Zalomená páka s koulí', popis: 'zalomení 30°, pero 12 mm, upínací štěrbina M4',
      p: { nazev: 'Zalomená páka', druh: 'paka', naboj: { prumer: 30, delka: 42, jisteni: 'sterbina' },
        rameno: { delka: 60, delka2: 50, uhel: 30, sirka: 20, sirkaKonec: 12, tloustka: 10 }, paka: { koule: 24 }, stupnice: { typ: 'zadna' }, mech: { moment: 3, silaMax: 80 } } },
  ];

  const kopie = G.kopie;
  const normalizuj = v => G.normalizuj(v, { VYCHOZI, MEZE, VYCTY });
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(G.slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }
  /** Přepíše hřídel podle předvolby z HRIDELE. */
  function nastavHridel(p, id) {
    const h = HRIDELE.find(x => x.id === id);
    if (!h) return p;
    p.hridel.tvar = h.tvar;
    if (h.prumer) p.hridel.prumer = h.prumer;
    if (h.ploska) p.hridel.ploska = h.ploska;
    if (h.zavit) p.hridel.zavit = h.zavit;
    return p;
  }

  /* ---------------- odvozené rozměry ---------------- */
  /** Pera DIN 6885: [hřídel nad, do, šířka pera b, hloubka drážky v náboji t2] – stejná tabulka jako remenice/jadro.js (PERA). */
  const PERA = [[6, 8, 2, 1.0], [8, 10, 3, 1.4], [10, 12, 4, 1.8], [12, 17, 5, 2.3], [17, 22, 6, 2.8], [22, 30, 8, 3.3], [30, 38, 10, 3.3]];
  const PERO = d => { const x = PERA.find(([a, b]) => d > a && d <= b); return x ? { b: x[2], t2: x[3] } : null; };
  /** Úhly loukotí / laloků (°): žádný nesmí mířit do −X (tam je šroub a štěrbina). */
  function uhlyRamen(n) {
    const off = n % 2 === 0 ? 180 / n : 0;
    return Array.from({ length: n }, (_, i) => off + 360 * i / n);
  }

  /** Všechny odvozené rozměry; o.chyba = důvod, proč nejde sestavit. */
  function odvozene(p) {
    const h = p.hridel, n = p.naboj, o = { druh: p.druh };
    const v = h.vule / 2;                              // vůle na poloměr
    o.v = v;
    // otvor
    const ot = { typ: h.tvar };
    if (h.tvar === 'zavit') {
      const z = ZAVITY[h.zavit];
      ot.z = z; ot.d = z.d;
      if (h.zavitTyp === 'matice') { ot.r = z.d / 2 + 0.25 + v; ot.matice = { s: z.s + 2 * p.naboj.vuleMatice, m: z.m + 0.3 }; ot.matice.e = ot.matice.s / Math.cos(Math.PI / 6); ot.rMax = Math.max(ot.r, ot.matice.e / 2); ot.rSteny = ot.r; }
      else { ot.rMaj = z.d / 2 + 0.15 + v; ot.r = ot.rMaj - 0.6134 * z.p; ot.rMax = ot.rMaj; ot.rSteny = ot.rMaj; }
    } else {
      ot.d = h.prumer; ot.r = h.prumer / 2 + v;
      if (h.tvar === 'kruh') ot.rMax = ot.r;
      if (h.tvar === 'd') { ot.xPlosky = -(h.ploska - h.prumer / 2) - v; ot.rMax = ot.r; ot.w = 2 * Math.sqrt(Math.max(0, ot.r * ot.r - ot.xPlosky * ot.xPlosky)); }
      if (h.tvar === 'sestihran') { ot.ap = h.prumer / 2 + v; ot.rMax = ot.ap / Math.cos(Math.PI / 6); ot.w = 2 * ot.rMax * Math.sin(Math.PI / 6); }
      if (h.tvar === 'ctyrhran') { ot.ap = h.prumer / 2 + v; ot.rMax = ot.ap * Math.SQRT2; ot.w = 2 * ot.ap; }
      if (h.tvar === 'pero') {
        const pe = PERO(h.prumer);
        if (!pe) { o.chyba = 'pero'; ot.rMax = ot.r; }
        else { ot.pero = { b: pe.b + 2 * v, t2: pe.t2, x: h.prumer / 2 + pe.t2 + v, bNom: pe.b }; ot.rMax = Math.hypot(ot.pero.x, ot.pero.b / 2); }
      }
      ot.rSteny = ot.rMax;
    }
    o.ot = ot;
    // tělo (část na podložce) – tloušťka t a jestli zakrývá náboj ve směru −X
    const ram = p.rameno;
    o.Rn = n.prumer / 2;
    if (p.druh === 'kolo') {
      const k = p.kolo;
      o.plne = k.loukoti === 0;
      o.t = o.plne ? k.tlLouk : Math.min(k.tlLouk, k.vyska);
      o.Ro = k.prumer / 2; o.Ri = o.Ro - k.venec; o.Rr = (o.Ro + o.Ri) / 2; o.hv = k.vyska;
      o.uhly = uhlyRamen(Math.max(1, k.loukoti));
      o.Ref = o.Rr; o.sDrzadlem = k.drzadlo;
    } else if (p.druh === 'hvezda') {
      const s = p.hvezda;
      o.t = s.vyska; o.rl = s.lalok / 2; o.Rk = s.prumer / 2 - o.rl; o.Rc = o.Rn + 1;
      o.uhly = uhlyRamen(s.ramen);
      o.Ref = s.prumer / 2 - o.rl * 0.5; o.sDrzadlem = false;
    } else {
      o.t = ram.tloustka; o.b0 = ram.sirka; o.b1 = ram.sirkaKonec;
      if (p.druh === 'paka') {
        const a = ram.uhel * Math.PI / 180;
        o.P1 = [ram.delka, 0]; o.P2 = ram.delka2 > 0 ? [ram.delka + ram.delka2 * Math.cos(a), ram.delka2 * Math.sin(a)] : null;
        o.konec = o.P2 || o.P1; o.rb = p.paka.koule / 2;
        o.Ref = Math.hypot(o.konec[0], o.konec[1]); o.sDrzadlem = false;
      } else { o.konec = [ram.delka, 0]; o.Ref = ram.delka; o.sDrzadlem = true; }
    }
    // spodek pro šroub: u ramene (náboj vyčnívá z ramene na −X) může šroub jít hned od podložky, jinak nad tělem
    o.volnyBok = (p.druh === 'klika' || p.druh === 'paka' || p.druh === 'sklopna') && o.b0 / 2 <= o.Rn - 0.5;
    // stupnice
    const st = p.stupnice;
    o.H = n.delka;
    o.Ht = o.H;                                       // horní konec spodní části náboje (pod stupnicí)
    if (st.typ !== 'zadna') {
      o.hs = st.vyska; o.Rd = st.prumer / 2;
      if (st.typ === 'pevna') {
        o.Rd = Math.max(o.Rd, o.Rn);
        o.Ht = o.H - o.hs; o.kuzel = o.Rd - o.Rn;     // přechod 45° z náboje na prstenec stupnice
      } else {
        o.Rsed = o.Rd - st.stena; o.hsed = o.hs + 0.4;
        o.Ht = o.H - o.hsed;
        o.Rf = Math.max(o.Rn, o.Rsed + 1.2); o.kuzel = o.Rf - o.Rn;   // osazení, o které se kroužek opře (45° z náboje)
      }
      o.dilek = st.stoupani / st.dilku * (st.prumerove ? 2 : 1);
      o.roztec = 2 * Math.PI * o.Rd / st.dilku;
      o.Lcar = [Math.min(2, o.hs * 0.2), Math.min(3, o.hs * 0.3), Math.min(4.2, o.hs * 0.4)];
      o.palce = Math.abs(25.4 / st.stoupani - Math.round(25.4 / st.stoupani)) < 0.02 || Math.abs(st.stoupani / 25.4 * 1000 - Math.round(st.stoupani / 25.4 * 1000)) < 1e-6;
    }
    o.Hspod = o.volnyBok ? 0 : o.t;                    // odkud může vést šroub z boku náboje
    // stavěcí šroub (osa −X) a kapsa matice vsunutá z boku (+Y)
    const S = SROUBY[n.sroub];
    o.S = S;
    if (n.jisteni === 'stavec') {
      const s = S.s + 2 * n.vuleMatice, m = S.m + n.vuleMatice, e = s / Math.cos(Math.PI / 6);
      const rIn = ot.typ === 'pero' && ot.pero ? ot.pero.x : ot.typ === 'd' ? -ot.xPlosky : ot.typ === 'sestihran' || ot.typ === 'ctyrhran' ? ot.ap : ot.r;
      o.stavec = { s, m, e, rIn, xn: rIn + 1.2 + m / 2, zs: (o.Hspod + o.Ht) / 2 };
      o.stavec.stenaVen = o.Rn - (o.stavec.xn + m / 2);
    }
    if (n.jisteni === 'sterbina') {
      const s = S.s + 2 * n.vuleMatice, m = S.m + n.vuleMatice, e = s / Math.cos(Math.PI / 6);
      const ws = 1.5, xs = ot.rSteny + S.d / 2 + 1.2, yHlavy = ws / 2 + 2.5, yMat = ws / 2 + 2.5;
      const yb = Math.max(yMat + m + 2.5, yHlavy + 4, o.Rn * 0.7);
      o.sterbina = { ws, xs, s, m, e, yHlavy, yMat, yb, xb: xs + Math.max(S.d / 2 + 2.5, e / 2 + 1.5), z0: Math.max(o.t, 0), zs: (o.t + o.Ht) / 2 };
    }
    // držadlo
    const d = p.drzadlo;
    if (o.sDrzadlem && p.druh !== 'sklopna') {
      const rp = d.cep / 2, tCep = p.druh === 'kolo' ? o.hv : o.t;
      o.drz = { rp, rd: rp + d.vule, rg: d.prumer / 2, L: d.delka, mezera: 0.4, tCep };
      if (d.uchyceni === 'zacvak') {
        o.drz.zobak = Math.min(0.6, rp * 0.15 + 0.15); o.drz.drazka = Math.max(1.2, Math.min(2, rp * 0.35));
        o.drz.Lcep = o.drz.mezera + tCep + 0.3;          // od čela držadla po zobáček
        o.drz.Lzob = o.drz.zobak + (rp + o.drz.zobak - Math.max(0.6, rp * 0.45));   // náběh zobáčku 45° + kužel k hrotu
      } else {
        const Sd = SROUBY[d.sroub];
        o.drz.Sd = Sd; o.drz.rs = Sd.d / 2 + 0.2; o.drz.Lcep = o.drz.mezera + tCep + 0.2;
        o.drz.matice = { s: Sd.s + 2 * p.naboj.vuleMatice, m: Sd.m + 0.3 }; o.drz.matice.e = o.drz.matice.s / Math.cos(Math.PI / 6);
      }
    }
    if (p.druh === 'sklopna') {
      const Sp = SROUBY[d.pant], rh = Sp.d / 2 + 0.2, rho = o.t / 2, oct = 1 / Math.cos(Math.PI / 8);
      const rt = rh + 2.5, tw = 3, g = 0.3, bt = o.b1;
      o.pant = { Sp, rh, rho, oct, rt, tw, g, bt, Lt: rt * oct + 1.2, e: rho * oct + 0.6, sirkaVidlice: bt + 2 * g + 2 * tw, fb: 4 };
      o.drz = { rg: d.prumer / 2, L: d.delka };
      o.Ref = ram.delka;
    }
    o.Lvylozeni = o.Ref;
    // kontrola: náboj nesmí být nižší než tělo
    o.Hmin = Math.max(o.t, p.druh === 'kolo' ? o.hv : 0);
    return o;
  }

  /* ---------------- mechanika ---------------- */
  /** Momenty, napětí a doporučení. Hrubé inženýrské odhady (pevnost tisku se liší) – bezpečnost 2 proti pevnosti materiálu. */
  function mechanika(p, o) {
    const m = MATERIALY[p.tisk.material], me = p.mech, R = Math.max(1, o.Ref);   // mm
    const T = me.moment * 1000;                       // N·mm potřebný
    const Tmax = me.silaMax * R;                      // N·mm, co ruka do kliky vloží
    const Truka = me.sila * R;
    const sXY = m.sXY / 2, sZ = m.sZ / 2;             // přípustné (bezpečnost 2)
    const r = { T, Tmax, Truka, Rdoporuc: T > 0 ? T / me.sila : 0, prvky: [] };
    const prvek = (nazev, napeti, dov, popis) => r.prvky.push({ nazev, napeti, dov, vyuziti: napeti / dov, popis });
    // náboj – krut trubky
    const D = 2 * o.Rn, dIn = 2 * o.ot.rMax;
    if (D > dIn) prvek('Náboj – krut', 16 * Tmax * D / (Math.PI * (D ** 4 - dIn ** 4)), sXY, `trubka Ø ${fmt(D)} / Ø ${fmt(dIn, 1)}`);
    // spojení s hřídelí
    const h = p.hridel, ot = o.ot, L = Math.max(1, (p.hridel.pruchozi ? o.H : o.H - p.hridel.celo));
    r.Lnaboje = L;
    if (h.tvar === 'pero' && ot.pero) {
      prvek('Drážka pro pero – otlačení', 2 * Tmax / (h.prumer * ot.pero.t2 * L), 0.6 * m.sXY, `pero ${ot.pero.bNom} mm, nosná délka ${fmt(L, 0)} mm`);
      r.strihPera = 2 * Tmax / (h.prumer * ot.pero.bNom * L);
    } else if (h.tvar === 'd' || h.tvar === 'sestihran' || h.tvar === 'ctyrhran') {
      const nP = h.tvar === 'd' ? 1 : h.tvar === 'sestihran' ? 6 : 4, w = ot.w;
      prvek('Plošky hřídele – otlačení', 8 * Tmax / (nP * L * w * w), 0.6 * m.sXY, `${nP} ${nP === 1 ? 'ploška' : 'plošek'} šířky ${fmt(w, 1)} mm`);
    }
    if (p.naboj.jisteni === 'stavec') {
      const Fs = Tmax / (h.prumer / 2), S = o.S;
      r.drzeniStavec = S.drzeni * h.prumer / 2;      // N·mm, jen třením / důlkem (kulatá hřídel)
      if (h.tvar === 'kruh') r.prvky.push({ nazev: 'Stavěcí šroub – držení', napeti: Tmax, dov: r.drzeniStavec, vyuziti: Tmax / r.drzeniStavec, popis: `${p.naboj.sroub} s důlkem, přídržná síla ≈ ${fmt(S.drzeni, 0)} N (typické, ověřit)`, moment: true });
      void Fs;
    }
    if (p.naboj.jisteni === 'sterbina') {
      const S = o.S, mu = 0.25;
      r.drzeniSterbina = mu * Math.PI * S.predpeti * h.prumer / 2;
      if (h.tvar === 'kruh' || h.tvar === 'zavit') r.prvky.push({ nazev: 'Štěrbina – držení třením', napeti: Tmax, dov: r.drzeniSterbina, vyuziti: Tmax / r.drzeniSterbina, popis: `${p.naboj.sroub}, předpětí ≈ ${fmt(S.predpeti, 0)} N do plastu, tření 0,25`, moment: true });
    }
    // rameno / loukotě / laloky – ohyb u náboje silou na rameni
    if (p.druh === 'klika' || p.druh === 'sklopna' || p.druh === 'paka') {
      const b = o.b0, t = o.t, Mo = me.silaMax * Math.max(0, R - o.Rn);
      prvek('Rameno – ohyb u náboje', 6 * Mo / (t * b * b), sXY, `průřez ${fmt(b)} × ${fmt(t)} mm, síla ${fmt(me.silaMax, 0)} N na ${fmt(R, 0)} mm`);
      if (o.drz && p.druh !== 'paka') {   // krut ramene: síla na držadle je o půl délky držadla před ramenem
        const e = o.drz.L / 2 + t / 2, Tk = me.silaMax * e, bb = Math.max(b, t), tt = Math.min(b, t);
        prvek('Rameno – krut od držadla', Tk * (3 * bb + 1.8 * tt) / (bb * bb * tt * tt), sXY * 0.6, `rameno síly ${fmt(e, 0)} mm před osou ramene`);
      }
    }
    if (p.druh === 'kolo' && !o.plne) {
      const n = p.kolo.loukoti, b = p.kolo.sirkaLouk, t = o.t, Mo = me.silaMax * Math.max(0, o.Rr - o.Rn) / n;
      prvek('Loukoť – ohyb', 6 * Mo / (t * b * b), sXY, `${n} loukotě ${fmt(b)} × ${fmt(t)} mm (zatížení rozdělené)`);
    }
    if (p.druh === 'hvezda') {
      const n = p.hvezda.ramen, b = 2 * o.rl, t = o.t, Mo = me.silaMax * Math.max(0, o.Ref - o.Rc) / Math.min(n, 2);
      prvek('Rameno rukojeti – ohyb', 6 * Mo / (t * b * b), sXY, `síla prsty na ${Math.min(n, 2)} ramena`);
    }
    // čep držadla (tištěný nastojato = ohyb napříč vrstvami) / šroub
    if (o.drz && o.drz.rp && p.druh !== 'sklopna') {
      const rameno = o.drz.L / 2 + o.drz.mezera, M = me.silaMax * rameno;
      if (p.drzadlo.uchyceni === 'zacvak') {
        const dp = 2 * o.drz.rp;
        prvek('Čep držadla – ohyb', 32 * M / (Math.PI * dp ** 3), sZ, `Ø ${fmt(dp)} mm tištěný nastojato – ohyb napříč vrstvami`);
        const Ls = o.drz.Lcep + o.drz.Lzob, c = 0.576 * o.drz.rp, del = o.drz.rp + o.drz.zobak - o.drz.rd;
        r.zacvak = { eps: 3 * del * c / (Ls * Ls) * 100, mez: m.eps, del };
      } else {
        const dp = 2 * o.drz.rp, ds = o.drz.Sd.d, I = Math.PI * (dp ** 4 - (2 * o.drz.rs) ** 4) / 64, Is = Math.PI * ds ** 4 / 64;
        const Ms = M * Is * 210000 / (Is * 210000 + I * 2000);   // podíl ocelového šroubu na ohybu (moduly 210 / 2 GPa)
        r.prvky.push({ nazev: 'Šroub držadla – ohyb', napeti: 32 * Ms / (Math.PI * ds ** 3), dov: 320, vyuziti: 32 * Ms / (Math.PI * ds ** 3) / 320, popis: `${p.drzadlo.sroub} pevnosti 8.8 (dovoleno 320 MPa)` });
      }
    }
    if (p.druh === 'sklopna') {
      // síla ruky míří podél osy pantu: jazyk ramene se kroutí momentem F × (půl držadla + vidlice), vidlice se ohýbá jako celek
      const P = o.pant, Tk = me.silaMax * (o.drz.L / 2 + P.e), bj = P.bt - 2 * P.rh, bb = Math.max(bj, o.t), tt = Math.min(bj, o.t);
      prvek('Jazyk pantu – krut', Tk * (3 * bb + 1.8 * tt) / (bb * bb * tt * tt), sXY * 0.6, `jazyk ${fmt(P.bt)} × ${fmt(o.t)} mm s otvorem Ø ${fmt(2 * P.rh, 1)}`);
      prvek('Vidlice v pantu – ohyb', 6 * Tk / (2 * P.rt * P.sirkaVidlice ** 2), sXY, `vidlice ${fmt(P.sirkaVidlice, 1)} mm, šroub ${p.drzadlo.pant} stažený`);
    }
    r.max = r.prvky.reduce((a, x) => Math.max(a, x.vyuziti), 0);
    // ergonomie
    r.posuv = p.stupnice.stoupani * me.otacky;        // mm/min
    r.obvod = 2 * Math.PI * R * me.otacky / 60000;   // m/s ruky
    return r;
  }

  /* ---------------- kontroly ---------------- */
  function kontroly(p) {
    const H = [], o = odvozene(p), h = p.hridel, n = p.naboj, st = p.stupnice, d = p.drzadlo, m = MATERIALY[p.tisk.material];
    const chyba = (pole, text, oprava) => H.push({ uroven: 'chyba', pole, text, oprava });
    const var_ = (pole, text, oprava) => H.push({ uroven: 'varovani', pole, text, oprava });
    const info = (pole, text) => H.push({ uroven: 'info', pole, text });
    const opr = (c, x) => ({ zmeny: { [c]: Math.round(x * 100) / 100 } });
    const ot = o.ot;
    if (o.chyba === 'pero') { chyba(['hridel.prumer', 'hridel.tvar'], `Pro hřídel Ø ${fmt(h.prumer)} mm nemá tabulka DIN 6885 pero (hřídel 6–38 mm) – zvolte jiný tvar otvoru.`, { zmeny: { 'hridel.tvar': 'kruh' } }); return dokonci(H); }
    // otvor a stěna náboje
    const stena = o.Rn - ot.rMax;
    if (h.tvar === 'd' && (h.ploska >= h.prumer || h.ploska < h.prumer * 0.6)) chyba(['hridel.ploska'], `Rozměr přes plošku ${fmt(h.ploska)} mm musí být menší než průměr ${fmt(h.prumer)} mm a větší než 0,6 × průměr.`, opr('hridel.ploska', Math.round(h.prumer * 0.9 * 10) / 10));
    if (stena < 1.6) chyba(['naboj.prumer'], `Stěna náboje kolem otvoru má jen ${fmt(stena, 1)} mm – zvětšete náboj.`, opr('naboj.prumer', Math.ceil(2 * (ot.rMax + 3))));
    else if (stena < 3) var_(['naboj.prumer'], `Stěna náboje ${fmt(stena, 1)} mm je tenká – doporučeno aspoň 3 mm.`, opr('naboj.prumer', Math.ceil(2 * (ot.rMax + 3))));
    if (h.tvar === 'zavit') {
      const z = ot.z;
      if (h.zavitTyp === 'tisk' && z.p < 1.2) var_(['hridel.zavitTyp'], `Stoupání ${fmt(z.p, 2)} mm je na tištěný vnitřní závit jemné – použijte zalisovanou matici.`, { zmeny: { 'hridel.zavitTyp': 'matice' } });
      if (h.zavitTyp === 'matice' && o.Rn - ot.matice.e / 2 < 1.6) chyba(['naboj.prumer'], `Matice ${z.nazev} (klíč ${fmt(z.s)} mm) se do náboje nevejde.`, opr('naboj.prumer', Math.ceil(ot.matice.e + 4)));
      if (h.zavitTyp === 'matice' && ot.matice.m + 1.5 > o.H) chyba(['naboj.delka'], `Náboj je nižší než kapsa matice ${z.nazev}.`, opr('naboj.delka', Math.ceil(ot.matice.m + 4)));
      info(['hridel.zavit'], 'Rukojeť na závitu drží jen ve směru utahování – při točení opačně se povolí. Pojistěte ji kontramaticí nebo lepidlem na závity.');
    }
    if (!h.pruchozi && h.celo >= o.H - 3) chyba(['hridel.celo', 'naboj.delka'], 'Slepý otvor je skoro nulový – zmenšete přední stěnu nebo prodlužte náboj.', opr('hridel.celo', 2));
    if (h.tvar === 'kruh' && n.jisteni === 'zadne') var_(['naboj.jisteni'], 'Kulatý otvor bez jištění se na hřídeli protočí – přidejte stavěcí šroub nebo upínací štěrbinu.', { zmeny: { 'naboj.jisteni': 'stavec' } });
    if (h.vule < 0) info(['hridel.vule'], 'Záporná vůle = nalisování. Vyzkoušejte kalibrační vzorek (Soubor → Export).');
    if (h.vule > 0.5) var_(['hridel.vule'], `Vůle ${fmt(h.vule, 2)} mm na průměr je velká – rukojeť se bude viklat.`);
    // náboj proti tělu
    if (o.H < o.Hmin) chyba(['naboj.delka'], `Náboj (${fmt(o.H)} mm) je nižší než ${p.druh === 'kolo' ? 'věnec kola' : 'tělo'} (${fmt(o.Hmin)} mm).`, opr('naboj.delka', Math.ceil(o.Hmin + 2)));
    // jištění
    if (n.jisteni === 'stavec') {
      const s = o.stavec, S = o.S;
      if (s.stenaVen < 1.2) chyba(['naboj.prumer', 'naboj.sroub'], `Kapsa na matici ${n.sroub} se mezi otvor a povrch náboje nevejde (venku zbývá ${fmt(s.stenaVen, 1)} mm) – zvětšete náboj nebo zvolte menší šroub.`, opr('naboj.prumer', Math.ceil(2 * (s.xn + s.m / 2 + 1.6))));
      const vyska = o.Ht - o.Hspod;
      if (vyska < s.s + 2.4) chyba(['naboj.delka'], `Na stavěcí šroub ${n.sroub} je náboj ${o.volnyBok ? '' : 'nad tělem '}krátký (${fmt(vyska, 1)} mm, potřeba ${fmt(s.s + 2.4, 1)} mm).`, opr('naboj.delka', Math.ceil(o.H + s.s + 2.4 - vyska)));
      if (h.tvar === 'sestihran' || h.tvar === 'ctyrhran') info(['naboj.jisteni'], 'Šestihran a čtyřhran přenesou moment tvarem – stavěcí šroub jen drží rukojeť v ose.');
    }
    if (n.jisteni === 'sterbina') {
      const s = o.sterbina, vyska = o.Ht - o.t;
      if (vyska < 2 * o.S.d + 4) chyba(['naboj.delka'], `Upínací štěrbina potřebuje nad tělem aspoň ${fmt(2 * o.S.d + 4)} mm náboje (je ${fmt(vyska, 1)} mm).`, opr('naboj.delka', Math.ceil(o.H + 2 * o.S.d + 4 - vyska)));
      if (h.tvar === 'zavit' && h.zavitTyp === 'matice') chyba(['naboj.jisteni'], 'Štěrbina nejde se zalisovanou maticí – zvolte tištěný závit nebo jiné jištění.', { zmeny: { 'naboj.jisteni': 'zadne' } });
      if (h.tvar === 'pero' || h.tvar === 'sestihran' || h.tvar === 'ctyrhran') info(['naboj.jisteni'], 'Tvarový otvor přenese moment sám – štěrbina jen odstraní vůli.');
      void s;
    }
    // stupnice
    if (st.typ !== 'zadna') {
      const L = o.Lcar[2], vys = (st.cisla !== 'zadna' ? L + 0.8 + st.vyskaCisel + 0.8 : L + 1);
      if (st.typ === 'pevna' && st.prumer / 2 < o.Rn) info(['stupnice.prumer'], `Prstenec stupnice nemůže být užší než náboj – použije se Ø ${fmt(2 * o.Rn)} mm.`);
      if (st.typ === 'pevna' && o.Ht - (o.kuzel || 0) < o.Hmin + 0.5) chyba(['naboj.delka', 'stupnice.vyska'], `Náboj je na stupnici krátký – prstenec by zasahoval do ${p.druh === 'kolo' ? 'kola' : 'těla'}.`, opr('naboj.delka', Math.ceil(o.Hmin + 0.5 + (o.kuzel || 0) + o.hs + 1)));
      if (st.typ === 'krouzek') {
        if (o.Rsed - ot.rMax < 1.6) chyba(['stupnice.stena', 'stupnice.prumer'], `Sedlo kroužku (Ø ${fmt(2 * o.Rsed, 1)}) je kolem otvoru tenké – zvětšete průměr stupnice nebo zmenšete stěnu kroužku.`, opr('stupnice.prumer', Math.ceil(2 * (ot.rMax + 1.8 + st.stena))));
        if (o.Ht - o.kuzel < o.Hmin + 0.5) chyba(['naboj.delka'], `Náboj je na sedlo kroužku stupnice krátký – osazení pod kroužkem by zasahovalo do ${p.druh === 'kolo' ? 'kola' : 'těla'}.`, opr('naboj.delka', Math.ceil(o.Hmin + 0.5 + o.kuzel + o.hsed + 1)));
        if (st.stena < st.hloubka + 1.5) chyba(['stupnice.stena'], `Stěna kroužku ${fmt(st.stena)} mm je na rysky hloubky ${fmt(st.hloubka)} mm tenká.`, opr('stupnice.stena', Math.ceil((st.hloubka + 2) * 2) / 2));
        if (st.vule < 0) info(['stupnice.vule'], 'Záporná vůle kroužku = nalisovaný – půjde nastavit nulu jen ztuha.');
        info(['stupnice.typ'], 'Kroužek drží třením na sedle náboje; nulu nastavíte otočením kroužku proti klice. Ryska (index) je na stroji.');
      }
      if (st.hloubka > 1 && st.cisla === 'vystoupla') info(['stupnice.hloubka'], 'Vysoká vystouplá čísla mají pod vodorovnými segmenty malé převisy.');
      if (o.hs < vys) chyba(['stupnice.vyska', 'stupnice.vyskaCisel'], `Na rysky a čísla je stupnice nízká – potřeba aspoň ${fmt(vys, 1)} mm.`, opr('stupnice.vyska', Math.ceil(vys + 0.5)));
      if (o.roztec < 1.2) chyba(['stupnice.dilku', 'stupnice.prumer'], `Rysky jsou od sebe jen ${fmt(o.roztec, 2)} mm – tiskárna je slije. Zvětšete průměr stupnice nebo zmenšete počet dílků.`, opr('stupnice.prumer', Math.ceil(1.4 * st.dilku / Math.PI)));
      else if (o.roztec < 1.6) var_(['stupnice.dilku', 'stupnice.prumer'], `Rysky jsou od sebe ${fmt(o.roztec, 2)} mm – na hraně možností tisku (tryska 0,4).`);
      if (st.cisla !== 'zadna') {
        const sirka = popisek(p, Math.floor((st.dilku - 1) / st.kazde) * st.kazde, o).length * st.vyskaCisel * 0.8;
        if (sirka > st.kazde * o.roztec - 0.8) var_(['stupnice.kazde', 'stupnice.vyskaCisel'], `Čísla se mezi sebe nevejdou (číslo ≈ ${fmt(sirka, 1)} mm, místo ${fmt(st.kazde * o.roztec, 1)} mm) – číslujte řidčeji nebo zmenšete písmo.`, opr('stupnice.kazde', Math.ceil(st.kazde * 2)));
      }
      if (st.dilku % st.kazde !== 0) info(['stupnice.kazde'], `Počet dílků ${st.dilku} není násobkem číslování po ${st.kazde} – poslední číslo bude u nuly blíž.`);
      if (st.vyskaCisel < 3 && st.cisla !== 'zadna') info(['stupnice.vyskaCisel'], 'Čísla menší než 3 mm vyjdou s tryskou 0,4 mm nečitelně.');
    }
    // tělo podle druhu
    if (p.druh === 'klika' || p.druh === 'sklopna') {
      const R = p.rameno.delka, rg = d.prumer / 2;
      if (R - rg - 2 < o.Rn && p.druh === 'klika') chyba(['rameno.delka', 'drzadlo.prumer'], `Držadlo Ø ${fmt(d.prumer)} by narazilo do náboje – prodlužte rameno aspoň na ${fmt(Math.ceil(o.Rn + rg + 3))} mm.`, opr('rameno.delka', Math.ceil(o.Rn + rg + 3)));
      if (p.druh === 'klika') {
        const dr = o.drz, stK = o.b1 / 2 - dr.rd;
        if (stK < 1.6) chyba(['rameno.sirkaKonec', 'drzadlo.cep'], `Konec ramene (${fmt(o.b1)} mm) je na otvor čepu Ø ${fmt(2 * dr.rd, 1)} úzký.`, opr('rameno.sirkaKonec', Math.ceil(2 * (dr.rd + 2.5))));
        if (d.uchyceni === 'zacvak' && d.cep < 5) var_(['drzadlo.cep'], `Zacvaknutý čep Ø ${fmt(d.cep)} mm je slabý – aspoň 6 mm, nebo držadlo na šroub.`, opr('drzadlo.cep', 6));
        if (d.uchyceni === 'sroub') {
          const stS = dr.rp - dr.rs;
          if (stS < 1.2) chyba(['drzadlo.cep', 'drzadlo.sroub'], `Pouzdro čepu kolem šroubu ${d.sroub} má stěnu ${fmt(stS, 1)} mm – zvětšete čep.`, opr('drzadlo.cep', Math.ceil(2 * (dr.rs + 1.6))));
          if (rg < dr.matice.e / 2 + 1.5) chyba(['drzadlo.prumer'], `Matice ${d.sroub} se do čela držadla nevejde.`, opr('drzadlo.prumer', Math.ceil(dr.matice.e + 4)));
        }
        if (rg < dr.rp + 2) chyba(['drzadlo.prumer', 'drzadlo.cep'], 'Držadlo musí být aspoň o 4 mm širší než čep.', opr('drzadlo.prumer', Math.ceil(2 * dr.rp + 6)));
      } else {
        const P = o.pant;
        if (P.rho < P.rh + 1.4) chyba(['rameno.tloustka', 'drzadlo.pant'], `Rameno ${fmt(o.t)} mm je na otvor pantu Ø ${fmt(2 * P.rh, 1)} tenké – aspoň ${fmt(Math.ceil(2 * (P.rh + 1.6)))} mm.`, opr('rameno.tloustka', Math.ceil(2 * (P.rh + 1.6))));
        if (P.bt < 2 * P.rh + 4) chyba(['rameno.sirkaKonec'], `Jazyk pantu (${fmt(P.bt)} mm) je na šroub ${d.pant} úzký.`, opr('rameno.sirkaKonec', Math.ceil(2 * P.rh + 6)));
        if (P.sirkaVidlice > o.b0 + 8) info(['rameno.sirkaKonec'], `Vidlice držadla je široká ${fmt(P.sirkaVidlice, 1)} mm – širší než rameno.`);
        if (p.rameno.delka - P.Lt < o.Rn + 2) chyba(['rameno.delka'], 'Rameno je na pant krátké.', opr('rameno.delka', Math.ceil(o.Rn + P.Lt + rg + 4)));
        info(['drzadlo.pant'], `Pant drží třením: šroub ${d.pant} s pojistnou maticí utáhněte tak, aby držadlo stálo svisle a šlo rukou sklopit ven za konec ramene.`);
      }
      if (o.b1 > o.b0) info(['rameno.sirkaKonec'], 'Konec ramene je širší než kořen – obvykle se rameno ke konci zužuje.');
    }
    if (p.druh === 'kolo') {
      const k = p.kolo;
      if (o.Ri < o.Rn + 4) chyba(['kolo.prumer', 'kolo.venec'], 'Věnec kola zasahuje do náboje – zvětšete průměr kola nebo zmenšete věnec.', opr('kolo.prumer', Math.ceil(2 * (o.Rn + 4 + k.venec))));
      if (k.loukoti > 0 && k.loukoti * k.sirkaLouk > 2 * Math.PI * (o.Rn + 1) * 0.85) chyba(['kolo.sirkaLouk', 'kolo.loukoti'], 'Loukotě se u náboje slévají – zmenšete jejich šířku nebo počet.', opr('kolo.sirkaLouk', Math.floor(2 * Math.PI * (o.Rn + 1) * 0.8 / k.loukoti)));
      if (k.tlLouk > k.vyska) info(['kolo.tlLouk'], 'Loukotě nemohou být silnější než věnec – použije se výška věnce.');
      if (k.drzadlo) {
        const dr = o.drz;
        if (k.venec < 2 * dr.rd + 3.2) chyba(['kolo.venec', 'drzadlo.cep'], `Věnec ${fmt(k.venec)} mm je na otvor čepu Ø ${fmt(2 * dr.rd, 1)} úzký.`, opr('kolo.venec', Math.ceil(2 * dr.rd + 4)));
        if (d.uchyceni === 'zacvak' && d.cep < 5) var_(['drzadlo.cep'], `Zacvaknutý čep Ø ${fmt(d.cep)} mm je slabý – aspoň 6 mm.`, opr('drzadlo.cep', 6));
        if (d.uchyceni === 'sroub' && dr.rp - dr.rs < 1.2) chyba(['drzadlo.cep'], 'Pouzdro čepu kolem šroubu je tenké – zvětšete čep.', opr('drzadlo.cep', Math.ceil(2 * (dr.rs + 1.6))));
        if (d.uchyceni === 'sroub' && d.prumer / 2 < dr.matice.e / 2 + 1.5) chyba(['drzadlo.prumer'], `Matice ${d.sroub} se do čela držadla nevejde.`, opr('drzadlo.prumer', Math.ceil(dr.matice.e + 4)));
        if (d.prumer / 2 < dr.rp + 2) chyba(['drzadlo.prumer', 'drzadlo.cep'], 'Držadlo musí být aspoň o 4 mm širší než čep.', opr('drzadlo.prumer', Math.ceil(2 * dr.rp + 6)));
      }
    }
    if (p.druh === 'hvezda') {
      const s = p.hvezda;
      if (o.Rk < o.Rc) chyba(['hvezda.prumer', 'hvezda.lalok'], 'Ramena rukojeti jsou kratší než náboj – zvětšete průměr rukojeti.', opr('hvezda.prumer', Math.ceil(2 * (o.Rc + o.rl + 4))));
      if (s.ramen >= 3 && 2 * o.rl > 2 * o.Rk * Math.sin(Math.PI / s.ramen) * 1.05) info(['hvezda.lalok'], 'Laloky se navzájem dotýkají – rukojeť bude spíš kulatá s vroubky.');
    }
    if (p.druh === 'paka') {
      if (o.rb < o.b1 / 2) var_(['paka.koule', 'rameno.sirkaKonec'], 'Koule je užší než konec páky.', opr('paka.koule', Math.ceil(o.b1 + 4)));
      if (Math.hypot(o.konec[0], o.konec[1]) - o.rb < o.Rn + 1) chyba(['rameno.delka'], 'Koule by narazila do náboje – prodlužte páku.', opr('rameno.delka', Math.ceil(o.Rn + o.rb + 4)));
    }
    if (p.druh !== 'kolo' && p.druh !== 'hvezda' && o.t < 4) var_(['rameno.tloustka'], `Rameno ${fmt(o.t)} mm je tenké.`, opr('rameno.tloustka', 6));
    // tisk
    const vodorovne = p.druh === 'sklopna' || n.jisteni !== 'zadne' || (st.typ === 'krouzek' && st.jisteni);
    if (p.diry === 'kruh' && vodorovne) info([], 'Kruhové vodorovné díry mají převislý strop – tiskněte s podporami nebo zvolte kapku (👁 Zobrazení → 💧 Díry jako kapka).');
    if (p.tisk.uhel < 45) info(['tisk.uhel'], `Díly jsou navržené na převis 45° (sražení, kapkové otvory). Při ${fmt(p.tisk.uhel)}° budou na některých místech potřebovat podpory.`);
    if (p.tisk.material === 'PLA') info(['tisk.material'], 'PLA je křehké a na slunci a u teplého stroje měkne – na kliky raději PETG, ASA nebo PA.');
    // ergonomie a pevnost
    const me = mechanika(p, o);
    const M = p.mech;
    if (me.T > 0 && me.Truka < me.T) {
      const doporuc = Math.ceil(me.Rdoporuc / 5) * 5, cesta = p.druh === 'kolo' ? 'kolo.prumer' : p.druh === 'hvezda' ? 'hvezda.prumer' : 'rameno.delka';
      const hodn = p.druh === 'kolo' ? Math.ceil((2 * me.Rdoporuc + p.kolo.venec) / 5) * 5 : p.druh === 'hvezda' ? Math.ceil((2 * me.Rdoporuc + o.rl) / 2) * 2 : doporuc;
      const v = hodn <= MEZE[cesta][1];
      var_([cesta, 'mech.moment', 'mech.sila'], `Na potřebný moment ${fmt(M.moment, 2)} N·m je ${p.druh === 'kolo' ? 'kolo malé' : 'rameno krátké'}: silou ${fmt(M.sila, 0)} N dáte jen ${fmt(me.Truka / 1000, 2)} N·m. Doporučené rameno ≈ ${fmt(me.Rdoporuc, 0)} mm.`, v ? opr(cesta, hodn) : undefined);
    }
    for (const x of me.prvky) {
      if (x.vyuziti > 1) chyba(x.moment ? ['naboj.jisteni', 'mech.silaMax'] : ['mech.silaMax', 'tisk.material'], x.moment
        ? `${x.nazev}: přenese asi ${fmt(x.dov / 1000, 2)} N·m, síla ${fmt(M.silaMax, 0)} N na rameni dá ${fmt(x.napeti / 1000, 2)} N·m – spoj prokluzuje. Použijte tvarový otvor (D, pero) nebo štěrbinu.`
        : `${x.nazev}: napětí ${fmt(x.napeti, 1)} MPa překračuje dovolených ${fmt(x.dov, 1)} MPa (${m.nazev}, bezpečnost 2) při síle ${fmt(M.silaMax, 0)} N. Zesilte díl nebo zmenšete návrhovou sílu.`);
      else if (x.vyuziti > 0.8) var_(['mech.silaMax'], `${x.nazev}: využití ${fmt(x.vyuziti * 100, 0)} % – blízko meze.`);
    }
    if (me.zacvak) {
      if (me.zacvak.eps > me.zacvak.mez) var_(['drzadlo.cep', 'drzadlo.vule', 'tisk.material'], `Zacvaknutí čepu přetvoří půlky čepu asi o ${fmt(me.zacvak.eps, 1)} % (${m.nazev} snese ≈ ${fmt(me.zacvak.mez, 1)} %) – čep může prasknout. Zvětšete vůli nebo použijte šroub.`, { zmeny: { 'drzadlo.uchyceni': 'sroub' } });
      if (me.zacvak.del < 0.1) chyba(['drzadlo.vule'], 'Zobáček čepu je menší než vůle otvoru – držadlo by vypadlo. Zmenšete vůli.', opr('drzadlo.vule', 0.2));
    }
    if (d.prumer < 18 && o.sDrzadlem && p.druh !== 'paka') info(['drzadlo.prumer'], 'Držadlo pod Ø 18 mm se drží jen prsty – pro celou dlaň 25–35 mm.');
    if (o.drz && d.delka < 40 && p.druh !== 'paka' && o.sDrzadlem) info(['drzadlo.delka'], 'Držadlo kratší než 40 mm uchopíte jen dvěma prsty – pro celou dlaň 80–100 mm.');
    return dokonci(H);
  }
  function dokonci(H) { for (const x of H) if (x.oprava && !x.oprava.text) x.oprava.text = textOpravy(x.oprava.zmeny); return H; }
  const POPISKY = {
    'naboj.prumer': h => `náboj Ø ${fmt(h, 2)} mm`, 'naboj.delka': h => `náboj ${fmt(h, 2)} mm dlouhý`, 'naboj.jisteni': h => NAZVY.jisteni[h],
    'hridel.ploska': h => `přes plošku ${fmt(h, 2)} mm`, 'hridel.celo': h => `přední stěna ${fmt(h, 2)} mm`, 'hridel.tvar': h => `otvor ${NAZVY.tvar[h]}`, 'hridel.zavitTyp': h => NAZVY.zavitTyp[h],
    'stupnice.prumer': h => `stupnice Ø ${fmt(h, 2)} mm`, 'stupnice.vyska': h => `stupnice ${fmt(h, 2)} mm vysoká`, 'stupnice.stena': h => `stěna kroužku ${fmt(h, 2)} mm`, 'stupnice.kazde': h => `číslo každý ${h}. dílek`,
    'rameno.delka': h => `rameno ${fmt(h, 2)} mm`, 'rameno.sirkaKonec': h => `konec ramene ${fmt(h, 2)} mm`, 'rameno.tloustka': h => `tloušťka ${fmt(h, 2)} mm`,
    'drzadlo.cep': h => `čep Ø ${fmt(h, 2)} mm`, 'drzadlo.prumer': h => `držadlo Ø ${fmt(h, 2)} mm`, 'drzadlo.uchyceni': h => `držadlo: ${NAZVY.uchyceni[h]}`, 'drzadlo.vule': h => `vůle čepu ${fmt(h, 2)} mm`,
    'kolo.prumer': h => `kolo Ø ${fmt(h, 2)} mm`, 'kolo.venec': h => `věnec ${fmt(h, 2)} mm`, 'kolo.sirkaLouk': h => `loukotě ${fmt(h, 2)} mm`,
    'hvezda.prumer': h => `rukojeť Ø ${fmt(h, 2)} mm`, 'paka.koule': h => `koule Ø ${fmt(h, 2)} mm`,
  };
  const textOpravy = zmeny => Object.entries(zmeny).map(([c, h]) => (POPISKY[c] ? POPISKY[c](h) : `${c} ${h}`)).join(', ');

  /** Text čísla u rysky i (dílek nebo hodnota v mm / palcích). */
  function popisek(p, i, o) {
    void o;
    return String(i);
  }

  /* ---------------- projekt ---------------- */
  function popis(p) {
    const h = p.hridel;
    const otv = h.tvar === 'zavit' ? `závit ${ZAVITY[h.zavit].nazev}` : `${NAZVY.tvar[h.tvar]} ${fmt(h.prumer, 2)}`;
    const vel = p.druh === 'kolo' ? `Ø ${fmt(p.kolo.prumer)}` : p.druh === 'hvezda' ? `Ø ${fmt(p.hvezda.prumer)}` : `${fmt(p.rameno.delka)} mm`;
    return `${NAZVY.druh[p.druh]} ${vel} · ${otv}${p.stupnice.typ !== 'zadna' ? ` · stupnice ${p.stupnice.dilku} dílků` : ''}`;
  }
  const TYP = 'kliky_hridel';
  const ulozProjekt = p => G.projektJson(TYP, p, 1);
  const nactiProjekt = text => G.nactiProjektJson(text, TYP, normalizuj, 'Kliky na hřídel');

  const API = {
    MATERIALY, SROUBY, ZAVITY, HRIDELE, NAZVY, VYCHOZI, MEZE, VYCTY, PREDVOLBY,
    normalizuj, predvolba, nastavHridel, odvozene, mechanika, kontroly, popisek, uhlyRamen, PERO,
    popis, ulozProjekt, nactiProjekt, kopie, vezmi: G.vezmi, poloz: G.poloz, fmt,
  };
  if (uzel) module.exports = API; else window.KLH = API;
})();

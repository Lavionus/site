/* Věšáky se skrytými šrouby – jádro bez DOM (běží i v node).
   Parametry a meze, předvolby, páteř ramen („želví“ trasa: rovně / oblouk / spirála / zlom),
   rozbor ramene (drží? hloubka kapsy, otvor, pevnost), úchyt na zeď (rybina / T, klín, šrouby),
   kontroly, náhodný tvar a obměna, projekt JSON. Obecné funkce tisku bere ze spojky/jadro.js.

   Souřadnice „zeď“: rovina zdi z = 0 (z ven ze zdi), y nahoru (0 = spodek těla věšáku), x do šířky (střed 0).
   Profil zboku = rovina (z, y); věšák je profil vytažený do šířky x. */
(function () {
  'use strict';
  const SP = typeof module !== 'undefined' ? require('../spojky/jadro.js') : window.SPOJKY;
  const { kopie, cislo, fmt, vezmi, poloz, V, rotaceDolu, tiskovaPoloha, previsy } = SP;
  const VERZE_FORMATU = 1;
  const RAD = Math.PI / 180;

  /* ---------- tabulky ---------- */
  // vruty se zápustnou hlavou 90° (DIN 7997 / ISO 7050, typické hlavy) – do hmoždinky obvykle 3,5–5 mm
  const SROUBY = {
    '3': { nazev: 'vrut 3 mm', d: 3, hlava: 6 },
    '3.5': { nazev: 'vrut 3,5 mm', d: 3.5, hlava: 7 },
    '4': { nazev: 'vrut 4 mm', d: 4, hlava: 8 },
    '4.5': { nazev: 'vrut 4,5 mm', d: 4.5, hlava: 9 },
    '5': { nazev: 'vrut 5 mm', d: 5, hlava: 10 },
  };
  // orientační pevnost tisku ve vrstvě a modul pružnosti E (MPa) – věšák se tiskne na boku, rameno se ohýbá v rovině vrstev
  const MATERIALY = {
    PLA: { E: 3500, nazev: 'PLA', pevnost: 50, pozn: 'tuhé, ale pod trvalou zátěží pomalu teče (creep) a v teple měkne – na těžké kabáty raději PETG nebo ASA.' },
    PETG: { E: 2000, nazev: 'PETG', pevnost: 45, pozn: 'houževnaté, při přetížení se spíš ohne než praskne – dobrá volba na věšáky.' },
    ASA: { E: 2000, nazev: 'ASA', pevnost: 40, pozn: 'odolné UV a teplu – na chodbu u okna, do garáže i ven.' },
    ABS: { E: 2000, nazev: 'ABS', pevnost: 35, pozn: 'odolné teplu, tiskne se v uzavřené tiskárně.' },
    PA: { E: 1600, nazev: 'PA (nylon)', pevnost: 55, pozn: 'nejhouževnatější, nasává vlhkost.' },
    PC: { E: 2300, nazev: 'PC', pevnost: 60, pozn: 'pevné a teplu odolné, náročný tisk.' },
  };
  const PROFILY_UCHYTU = {
    rybina: { nazev: 'Rybina', znak: '⏢', popis: 'lichoběžník širší vpředu – věšák nejde odtáhnout od zdi' },
    T: { nazev: 'T se zkosením', znak: '⊤', popis: 'krček a širší hlava; spodek hlavy zkosený 45° kvůli tisku' },
  };
  const DRUHY_SEGMENTU = {
    r: { nazev: 'rovně', znak: '│' },
    o: { nazev: 'oblouk', znak: '◜' },
    s: { nazev: 'spirála', znak: '@' },
    z: { nazev: 'zlom', znak: '∠' },
  };
  // zdi: hmoždinka, kotevní hloubka (mm) a orientační dovolený tah na jeden vrut (N) – ověřte údaje výrobce hmoždinky (stav 11/2026)
  const ZDI = {
    beton: { nazev: 'beton', hmozdinka: 'nylonová hmoždinka', kotva: 30, tah: 400 },
    cihla: { nazev: 'plná cihla', hmozdinka: 'nylonová hmoždinka', kotva: 30, tah: 300 },
    derovka: { nazev: 'děrovaná cihla (Porotherm)', hmozdinka: 'dlouhá hmoždinka do dutých cihel', kotva: 50, tah: 150 },
    porobeton: { nazev: 'pórobeton (Ytong)', hmozdinka: 'hmoždinka do pórobetonu', kotva: 50, tah: 120 },
    sadrokarton: { nazev: 'sádrokarton 12,5 mm', hmozdinka: 'kovová hmoždinka do dutin (molly)', kotva: 13, tah: 100 },
    drevo: { nazev: 'dřevo / OSB / trám', hmozdinka: 'bez hmoždinky, vrut přímo', kotva: 25, tah: 350 },
  };
  const DELKY_VRUTU = [20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100];
  const DATUM_DAT = '11/2026';
  // tvary štítku (pohled zepředu); obal = šířka × výška těla, osa x uprostřed, y od spodku
  const TVARY_STITKU = {
    obdelnik: { nazev: 'Obdélník', znak: '▢' }, elipsa: { nazev: 'Elipsa', znak: '⬭' }, stadion: { nazev: 'Stadion', znak: '⬯' },
    oblouk: { nazev: 'Oblouk', znak: '⌂' }, stit: { nazev: 'Štít', znak: '⛉' }, kapka: { nazev: 'Kapka', znak: '💧' }, list: { nazev: 'List', znak: '🍃' },
    kosoctverec: { nazev: 'Kosočtverec', znak: '◇' }, mnohouhelnik: { nazev: 'Mnohoúhelník', znak: '⬡' },
    vlastni: { nazev: 'Vlastní', znak: '✏️' }, zadny: { nazev: 'Jen závěs', znak: '▫' },
  };
  const ORIENTACE = { auto: 'automaticky – méně převisů', bok: 'na boku (vrstvy podél ramen)', zada: 'zády dolů (štítek na podložce)' };
  const KONCE = { koule: 'koule', oble: 'oblý' };
  const HRANY = { zkoseni: 'zkosení 45°', zaobleni: 'zaoblení' };

  const VYCHOZI = {
    nazev: 'Věšák',
    telo: { tvar: 'obdelnik', sirka: 30, vyska: 62, hloubka: 14, roh: 5, hrana: 1.5, hranaTyp: 'zkoseni', param: 6, sirkaRamen: 0, vlastni: [] },
    ramena: [],
    obrysy: [],
    uchyt: { profil: 'rybina', sirka: 20, hloubka: 6, vyska: 40, uhel: 15, presah: 3, klin: 3, vule: 0.2, pocet: 2, sroub: '4', posunAuto: true, posun: 0, vyskaAuto: true, okraj: 5 },
    zatez: { kg: 5 },
    tisk: { material: 'PETG', vypln: 40, ks: 1, previs: 45, orientace: 'auto' },
    montaz: { zed: 'cihla', omitka: 10, pocet: 1, rozestup: 120, vyska: 1700 },
    zkouska: { krok: 0.05 },
  };
  // druh ramene: trasa = želví trasa úseků; blok = hranol / klín / polička; hrib = kolík s hlavou (hříbek, kotva, límec)
  const DRUHY_RAMEN = {
    trasa: { nazev: 'Trasa (háček)', znak: '⌒' }, blok: { nazev: 'Blok', znak: '▬' }, hrib: { nazev: 'Kolík s hlavou', znak: '⊣' },
  };
  const VYCHOZI_RAMENO = { druh: 'trasa', y: 40, uhel: 0, x: 0, sirka: 0, tl0: 11, tl1: 8, konec: 'koule', rKonec: 6, trasa: [{ t: 'r', d: 30 }, { t: 'o', r: 12, u: 150 }],
    delka: 25, h0: 16, h1: 16, sklon: 0, zub: 0, zubTl: 4, zaobleni: 2, tl: 10, nahoru: 10, dolu: 10, hlavaTl: 6 };
  const VYCHOZI_SEGMENT = { r: { t: 'r', d: 20 }, o: { t: 'o', r: 15, u: 90 }, s: { t: 's', r: 14, r1: 5, u: 270 }, z: { t: 'z', u: 45 } };
  const ROZSAHY = {
    'telo.sirka': [10, 100], 'telo.vyska': [15, 220], 'telo.hloubka': [5, 50], 'telo.roh': [0, 30], 'telo.hrana': [0, 5], 'telo.param': [3, 12], 'telo.sirkaRamen': [0, 100],
    'uchyt.sirka': [8, 70], 'uchyt.hloubka': [3, 16], 'uchyt.vyska': [12, 180], 'uchyt.uhel': [0, 35], 'uchyt.presah': [1, 8],
    'uchyt.klin': [0, 8], 'uchyt.vule': [0, 1], 'uchyt.pocet': [1, 4], 'uchyt.posun': [0, 200], 'uchyt.okraj': [3, 40],
    'zatez.kg': [0.1, 50], 'tisk.vypln': [5, 100], 'tisk.ks': [1, 20], 'tisk.previs': [30, 70],
    'montaz.omitka': [0, 50], 'montaz.pocet': [1, 20], 'montaz.rozestup': [20, 1000], 'montaz.vyska': [0, 2500], 'zkouska.krok': [0.02, 0.2],
  };
  const ROZSAHY_RAMENE = { y: [-50, 250], uhel: [-90, 90], x: [-100, 100], sirka: [0, 200], tl0: [3, 40], tl1: [2.5, 40], rKonec: [1.5, 30],
    delka: [3, 200], h0: [3, 120], h1: [2, 120], sklon: [-45, 60], zub: [0, 60], zubTl: [1.5, 40], zaobleni: [0, 20], tl: [3, 40], nahoru: [0, 80], dolu: [0, 80], hlavaTl: [2, 40] };
  const ROZSAHY_SEGMENTU = { d: [0, 250], r: [1, 200], r1: [1, 200], u: [-720, 720] };
  const MAX_RAMEN = 4, MAX_SEGMENTU = 14, MAX_OBRYSU = 12, MAX_BODU = 300;

  /* ---------- předvolby ---------- */
  const R = (y, uhel, tl0, tl1, konec, rKonec, trasa, x = {}) => Object.assign({ druh: 'trasa', y, uhel, tl0, tl1, konec, rKonec, trasa }, x);
  const B = (y, delka, h0, h1, sklon, zub, x = {}) => Object.assign({ druh: 'blok', y, uhel: 0, delka, h0, h1, sklon, zub }, x);
  const Hr = (y, delka, tl, nahoru, dolu, hlavaTl, x = {}) => Object.assign({ druh: 'hrib', y, uhel: 0, delka, tl, nahoru, dolu, hlavaTl }, x);
  const rr = (d) => ({ t: 'r', d }), ob = (r, u) => ({ t: 'o', r, u });
  const SKUPINY_PREDVOLEB = ['Klasické', 'Minimalistické', 'Kolíky', 'Funkční', 'Dekorativní'];
  const PREDVOLBY = [
    { skupina: 'Klasické', nazev: 'Klasický háček', popis: 'rovné rameno a oblouk nahoru', p: { ramena: [R(40, 0, 11, 8, 'koule', 6, [rr(30), ob(12, 150)])] } },
    { skupina: 'Klasické', nazev: 'Dvojitý – kabát a čepice', popis: 'dlouhý háček dole, krátký kolík nahoře',
      p: { telo: { vyska: 80 }, ramena: [R(30, 0, 12, 8, 'koule', 6, [rr(45), ob(12, 140)]), R(68, 25, 10, 7, 'koule', 7, [rr(22)])] } },
    { skupina: 'Klasické', nazev: 'Velký na kabáty', popis: 'mohutný, vysoké tělo, dva oblouky',
      p: { telo: { sirka: 36, vyska: 100, hloubka: 16 }, uchyt: { sirka: 24, vyska: 60, pocet: 3 },
        ramena: [R(36, 0, 15, 10, 'koule', 8, [rr(60), ob(16, 150)]), R(86, 30, 12, 8, 'koule', 8, [rr(30)])] } },
    { skupina: 'Klasické', nazev: 'Vidlička', popis: 'tři prsty nad sebou',
      p: { telo: { vyska: 90 }, uchyt: { vyska: 60, pocet: 3 }, ramena: [R(18, 0, 10, 7, 'koule', 5.5, [rr(40), ob(10, 100)]),
        R(48, 10, 9, 7, 'koule', 5.5, [rr(32), ob(10, 80)]), R(78, 20, 8, 6, 'koule', 5.5, [rr(22)])] } },
    { skupina: 'Klasické', nazev: 'Ocásek', popis: 'rameno stočené do spirály', p: { ramena: [R(38, 0, 11, 6, 'oble', 4, [rr(30), { t: 's', r: 20, r1: 7, u: 300 }])] } },
    { skupina: 'Klasické', nazev: 'Roh', popis: 'zužující se oblouk vzhůru', p: { ramena: [R(22, -25, 15, 6, 'oble', 4, [ob(55, 105)])] } },
    { skupina: 'Klasické', nazev: 'Lomený', popis: 'ostré zlomy, technický vzhled',
      p: { telo: { roh: 0 }, ramena: [R(38, 0, 10, 10, 'oble', 4, [rr(32), { t: 'z', u: 60 }, rr(10), { t: 'z', u: 30 }, rr(8)])] } },
    { skupina: 'Klasické', nazev: 'Vlna', popis: 'esovitě zvlněné rameno', p: { ramena: [R(46, -20, 10, 7, 'koule', 6, [ob(22, 50), ob(18, -60), ob(12, 170)])] } },

    { skupina: 'Minimalistické', nazev: 'Blok', popis: 'hranol u spodku štítku, horní plocha drží poutko',
      p: { telo: { vyska: 72, roh: 1 }, ramena: [B(46, 22, 46, 46, 0, 0, { zaobleni: 1 })] } },
    { skupina: 'Minimalistické', nazev: 'Blok se sklonem', popis: 'hranol se zvednutou horní plochou', p: { telo: { roh: 1 }, ramena: [B(44, 26, 30, 22, 8, 0, { zaobleni: 1.5 })] } },
    { skupina: 'Minimalistické', nazev: 'Polička se zubem', popis: 'plochá polička, zub na konci', p: { telo: { roh: 1 }, ramena: [B(30, 34, 12, 10, 0, 6, { zubTl: 5, zaobleni: 1.5 })] } },
    { skupina: 'Minimalistické', nazev: 'Klín', popis: 'zužující se klín se sklonem', p: { telo: { roh: 1 }, ramena: [B(40, 32, 24, 8, 10, 0, { zaobleni: 2 })] } },
    { skupina: 'Minimalistické', nazev: 'Schody', popis: 'dva bloky nad sebou', p: { telo: { vyska: 72, roh: 1 }, ramena: [B(28, 34, 16, 16, 4, 0, { zaobleni: 1 }), B(62, 18, 14, 14, 4, 0, { zaobleni: 1 })] } },
    { skupina: 'Minimalistické', nazev: 'Čepel', popis: 'tenká dlouhá deska se zubem', p: { telo: { roh: 1 }, ramena: [B(38, 48, 8, 6, 4, 5, { zubTl: 4, zaobleni: 1 })] } },

    { skupina: 'Kolíky', nazev: 'Kolík s koulí', popis: 'šikmo vzhůru, koule na konci', p: { ramena: [R(40, 18, 12, 9, 'koule', 9, [rr(50)])] } },
    { skupina: 'Kolíky', nazev: 'Hříbek', popis: 'dřík a zaoblená hlava', p: { ramena: [Hr(38, 34, 10, 8, 8, 8)] } },
    { skupina: 'Kolíky', nazev: 'Kotva', popis: 'dřík a příčka nahoru i dolů', p: { telo: { vyska: 70 }, ramena: [Hr(40, 30, 7, 16, 16, 5)] } },
    { skupina: 'Kolíky', nazev: 'Kolík s límcem', popis: 'hlava jen nahoru', p: { ramena: [Hr(36, 36, 9, 10, 0, 6)] } },
    { skupina: 'Kolíky', nazev: 'Dva kolíky vedle sebe', popis: 'široký štítek, dva šikmé kolíky',
      p: { telo: { sirka: 64 }, ramena: [R(40, 15, 11, 9, 'koule', 7, [rr(42)], { x: -18, sirka: 16 }), R(40, 15, 11, 9, 'koule', 7, [rr(42)], { x: 18, sirka: 16 })] } },
    { skupina: 'Kolíky', nazev: 'Šikmý kolík', popis: 'dlouhý kolík bez koule', p: { ramena: [R(36, 25, 12, 8, 'oble', 4, [rr(48)])] } },

    { skupina: 'Funkční', nazev: 'Na ručník', popis: 'nízké široké rameno s vysokým okrajem',
      p: { telo: { sirka: 40, vyska: 56 }, uchyt: { sirka: 26 }, ramena: [R(14, 0, 9, 9, 'oble', 4, [rr(40), ob(6, 90), rr(16)])] } },
    { skupina: 'Funkční', nazev: 'Na klíče', popis: 'čtyři malé háčky vedle sebe', p: { telo: { sirka: 76, vyska: 56, roh: 4 }, zatez: { kg: 1 },
      ramena: [-27, -9, 9, 27].map(x => R(12, 0, 6, 5, 'koule', 3.5, [rr(14), ob(8, 160)], { x, sirka: 8 })) } },
    { skupina: 'Funkční', nazev: 'Na tašky', popis: 'hluboký silný háček', p: { ramena: [R(38, 0, 14, 10, 'koule', 7, [rr(30), ob(17, 160)])] } },
    { skupina: 'Funkční', nazev: 'Na kšiltovky', popis: 'dlouhá čepel se zubem', p: { telo: { roh: 1 }, ramena: [B(40, 72, 10, 7, 3, 9, { zubTl: 5, zaobleni: 1.5 })] } },
    { skupina: 'Funkční', nazev: 'Na deštník', popis: 'široký oblouk pro rukojeť', p: { ramena: [R(40, 0, 12, 9, 'oble', 4, [rr(14), ob(22, 180)])] } },
    { skupina: 'Funkční', nazev: 'Na mikinu s kapucí', popis: 'velký hříbek, kapuce se nezlomí', p: { telo: { sirka: 36, vyska: 72 }, ramena: [Hr(40, 40, 12, 16, 10, 10)] } },
    { skupina: 'Funkční', nazev: 'Na pásky a kravaty', popis: 'pět kolíků vedle sebe', p: { telo: { sirka: 100, vyska: 56, roh: 4 }, zatez: { kg: 1 },
      ramena: [-38, -19, 0, 19, 38].map(x => R(30, 12, 7, 6, 'koule', 4.5, [rr(30)], { x, sirka: 9 })) } },
    { skupina: 'Funkční', nazev: 'Na sluchátka', popis: 'široká kolébka, oblouk netlačí na pásek', p: { telo: { sirka: 44, vyska: 66 }, uchyt: { sirka: 24 },
      ramena: [R(30, -5, 14, 12, 'oble', 4, [rr(10), ob(70, 38)])] } },

    { skupina: 'Dekorativní', nazev: 'Kapka a kolík', popis: 'štítek kapka, kolík s koulí', p: { telo: { tvar: 'kapka', sirka: 42, vyska: 86 }, ramena: [R(40, 15, 11, 8, 'koule', 7, [rr(38)], { sirka: 16 })] } },
    { skupina: 'Dekorativní', nazev: 'Štít a háček', popis: 'heraldický štít s háčkem', p: { telo: { tvar: 'stit', sirka: 36, vyska: 72 }, ramena: [R(52, 0, 10, 8, 'koule', 6, [rr(28), ob(12, 150)], { sirka: 16 })] } },
    { skupina: 'Dekorativní', nazev: 'List a ocásek', popis: 'štítek list, stočené rameno', p: { telo: { tvar: 'list', sirka: 40, vyska: 80 }, ramena: [R(44, 0, 10, 5, 'oble', 3, [rr(26), { t: 's', r: 18, r1: 6, u: 300 }], { sirka: 14 })] } },
    { skupina: 'Dekorativní', nazev: 'Oblouk a hříbek', popis: 'štítek jako okno, hříbek', p: { telo: { tvar: 'oblouk', sirka: 34, vyska: 74 }, ramena: [Hr(42, 32, 10, 8, 8, 8, { sirka: 18 })] } },
    { skupina: 'Dekorativní', nazev: 'Šestiúhelník a kotva', popis: 'šestiboký štítek, kotva', p: { telo: { tvar: 'mnohouhelnik', param: 6, sirka: 40, vyska: 78 }, ramena: [Hr(42, 28, 7, 14, 14, 5, { sirka: 16 })] } },
    { skupina: 'Dekorativní', nazev: 'Elipsa a vlna', popis: 'oválný štítek, zvlněné rameno', p: { telo: { tvar: 'elipsa', sirka: 36, vyska: 76 }, ramena: [R(46, -20, 10, 7, 'koule', 6, [ob(22, 50), ob(18, -60), ob(12, 170)], { sirka: 16 })] } },
  ];

  /* ---------- drobnosti ---------- */
  const jeObj = v => v && typeof v === 'object' && !Array.isArray(v);
  // sloučení do výchozích hodnot; sekci (objekt) přepíše jen objekt – null / řetězec z poškozeného souboru se ignoruje
  const sl = (o, z) => { for (const k of Object.keys(z)) { if (jeObj(o[k])) { if (jeObj(z[k])) sl(o[k], z[k]); } else o[k] = z[k]; } return o; };
  const omez = (h, [mn, mx], d) => { const x = cislo(h, d); return Math.min(mx, Math.max(mn, x)); };

  function normalizujRameno(r, hl, i) {
    const q = Object.assign(kopie(VYCHOZI_RAMENO), r && typeof r === 'object' ? r : {});
    for (const [k, roz] of Object.entries(ROZSAHY_RAMENE)) {
      const h = cislo(q[k], VYCHOZI_RAMENO[k]), o = omez(h, roz, VYCHOZI_RAMENO[k]);
      if (o !== h && hl) hl.push(`rameno ${i + 1}: ${k} ${fmt(h, 2)} → ${fmt(o, 2)}`);
      q[k] = o;
    }
    if (!KONCE[q.konec]) q.konec = 'oble';
    if (!DRUHY_RAMEN[q.druh]) q.druh = 'trasa';
    q.trasa = (Array.isArray(q.trasa) ? q.trasa : []).filter(s => s && DRUHY_SEGMENTU[s.t]).slice(0, MAX_SEGMENTU).map(s => {
      const z = { t: s.t }, vz = VYCHOZI_SEGMENT[s.t];
      for (const k of Object.keys(vz)) if (k !== 't') z[k] = omez(s[k], ROZSAHY_SEGMENTU[k], vz[k]);
      return z;
    });
    return q;
  }
  /* ---------- vlastní obrysy (čáry a Bézierovy křivky) ----------
     obrys = {dira, body: [{x, y, a, b, hladky}]}: x = vzdálenost od zdi, y = výška; a = vstupní a b = výstupní úchyt
     (posun od bodu, null = bez úchytu). Úsek i → i+1 je úsečka, když bod i nemá b a bod i+1 nemá a, jinak kubická Bézierova křivka. */
  const souradnice = v => Math.min(1000, Math.max(-1000, Math.round(cislo(v, 0) * 1000) / 1000));
  const uchyt = h => (Array.isArray(h) && h.length === 2 && (Math.abs(cislo(h[0], 0)) > 1e-6 || Math.abs(cislo(h[1], 0)) > 1e-6) ? [souradnice(h[0]), souradnice(h[1])] : null);
  function normalizujObrysy(o) {
    return (Array.isArray(o) ? o : []).slice(0, MAX_OBRYSU).map(ob => ({
      dira: !!(ob && ob.dira),
      sirka: Math.min(200, Math.max(0, Math.round(cislo(ob && ob.sirka, 0) * 100) / 100)),   // 0 = jako ramena
      x: Math.min(100, Math.max(-100, Math.round(cislo(ob && ob.x, 0) * 100) / 100)),       // posun do strany (zboku nevidět)
      nazev: String((ob && ob.nazev) || '').slice(0, 40),
      body: (ob && Array.isArray(ob.body) ? ob.body : []).slice(0, MAX_BODU).filter(b => b && Number.isFinite(cislo(b.x, NaN)) && Number.isFinite(cislo(b.y, NaN)))
        .map(b => ({ x: souradnice(b.x), y: souradnice(b.y), a: uchyt(b.a), b: uchyt(b.b), hladky: !!b.hladky })),
    })).filter(ob => ob.body.length >= 3);
  }
  /** Kubická Bézierova křivka v bodě t. */
  const bez = (p0, p1, p2, p3, t) => { const u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]; };
  /** Kontrolní body úseku i (null = úsečka). */
  function usek(ob, i) {
    const P = ob.body[i], Q = ob.body[(i + 1) % ob.body.length];
    if (!P.b && !Q.a) return null;
    return [[P.x, P.y], [P.x + (P.b ? P.b[0] : 0), P.y + (P.b ? P.b[1] : 0)], [Q.x + (Q.a ? Q.a[0] : 0), Q.y + (Q.a ? Q.a[1] : 0)], [Q.x, Q.y]];
  }
  /** Obrys jako mnohoúhelník [[x, y]…] (křivky rozdělené po ≈ krok mm). */
  function obrysNaBody(ob, krok = 0.4) {
    const out = [];
    ob.body.forEach((P, i) => {
      const k = usek(ob, i);
      out.push([P.x, P.y]);
      if (!k) return;
      const d = Math.hypot(k[1][0] - k[0][0], k[1][1] - k[0][1]) + Math.hypot(k[2][0] - k[1][0], k[2][1] - k[1][1]) + Math.hypot(k[3][0] - k[2][0], k[3][1] - k[2][1]);
      const n = Math.max(4, Math.min(96, Math.ceil(d / krok)));
      for (let j = 1; j < n; j++) out.push(bez(k[0], k[1], k[2], k[3], j / n));
    });
    return out;
  }
  /** Douglas–Peucker pro uzavřený i otevřený seznam bodů. */
  function zjednodus(b, tol) {
    if (b.length < 3) return b.slice();
    const keep = new Uint8Array(b.length); keep[0] = keep[b.length - 1] = 1;
    const zas = [[0, b.length - 1]];
    while (zas.length) {
      const [i, j] = zas.pop(); let dmax = 0, im = -1;
      const [ax, ay] = b[i], [bx, by] = b[j], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
      for (let k = i + 1; k < j; k++) { const d = Math.abs((b[k][0] - ax) * dy - (b[k][1] - ay) * dx) / L; if (d > dmax) { dmax = d; im = k; } }
      if (dmax > tol && im > 0) { keep[im] = 1; zas.push([i, im], [im, j]); }
    }
    return b.filter((_, i) => keep[i]);
  }
  /** Douglas–Peucker pro uzavřený mnohoúhelník (bez opakovaného prvního bodu): rozdělí se v bodě nejdál od prvního. */
  function zjednodusUzavreny(b, tol) {
    if (b.length < 4) return b.slice();
    let m = 1, dmax = -1;
    for (let i = 1; i < b.length; i++) { const d = Math.hypot(b[i][0] - b[0][0], b[i][1] - b[0][1]); if (d > dmax) { dmax = d; m = i; } }
    const a1 = zjednodus(b.slice(0, m + 1), tol), a2 = zjednodus(b.slice(m).concat([b[0]]), tol);
    return a1.concat(a2.slice(1, -1));
  }
  /** Kruh jako obrys ze 4 Bézierových oblouků. */
  function kruhObrys(cx, cy, r) {
    const k = 0.5523 * r, B = (x, y, a, b) => ({ x, y, a, b, hladky: true });
    return { dira: false, body: [B(cx + r, cy, [0, -k], [0, k]), B(cx, cy + r, [k, 0], [-k, 0]), B(cx - r, cy, [0, k], [0, -k]), B(cx, cy - r, [-k, 0], [k, 0])] };
  }
  /** Rameno (želví trasa) převedené na vlastní obrys: zjednodušený obrys + koule na konci. */
  function ramenoNaObrys(r, a, telo) {
    const sp = { sirka: r.sirka || 0, x: r.x || 0, nazev: '' }, uzel = ([x, y]) => ({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, a: null, b: null, hladky: false });
    if (r.druh && r.druh !== 'trasa') return polygonyRamene(r, telo).map(poly => Object.assign({ dira: false, body: zjednodusUzavreny(poly, 0.05).map(uzel) }, sp));
    const b = a.body, L = [], P = [];
    for (const s of b) { const nx = -Math.sin(s.h), ny = Math.cos(s.h); L.push([s.z + nx * s.t / 2, s.y + ny * s.t / 2]); P.push([s.z - nx * s.t / 2, s.y - ny * s.t / 2]); }
    const pas = zjednodus(L, 0.25).concat(zjednodus(P.reverse(), 0.25));
    const out = [Object.assign({ dira: false, body: pas.map(uzel) }, sp)];
    const t = b[b.length - 1];
    if (r.konec === 'koule') out.push(Object.assign(kruhObrys(Math.round(t.z * 100) / 100, Math.round(t.y * 100) / 100, polomerKonce(r)), sp));
    return out;
  }
  /** Import cesty SVG (atribut d): M L H V C S Q T Z, relativní i absolutní; oblouky A jako úsečka.
     Vrací obrysy v mm (1 jednotka SVG = 1 mm), y obrácené (SVG kreslí dolů). */
  function importSvg(d) {
    const tok = String(d).match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
    const obrysy = []; let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, cur = null, posl = null;
    const num = () => parseFloat(tok[i++]);
    const jeCislo = () => i < tok.length && !/^[a-zA-Z]$/.test(tok[i]);
    const zavri = () => { if (cur && cur.body.length >= 3) obrysy.push(cur); cur = null; };
    const bod = (nx, ny) => { cur.body.push({ x: nx, y: ny, a: null, b: null, hladky: false }); x = nx; y = ny; };
    const krivka = (c1x, c1y, c2x, c2y, nx, ny) => {
      const P = cur.body[cur.body.length - 1]; P.b = [c1x - P.x, c1y - P.y];
      cur.body.push({ x: nx, y: ny, a: [c2x - nx, c2y - ny], b: null, hladky: false }); x = nx; y = ny; posl = [c2x, c2y];
    };
    while (i < tok.length) {
      if (/^[a-zA-Z]$/.test(tok[i])) cmd = tok[i++];
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
      let q = null;
      if (C === 'Z') { if (cur && cur.body.length > 1) { const a = cur.body[0], b = cur.body[cur.body.length - 1]; if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) { a.a = b.a; cur.body.pop(); } } x = sx; y = sy; zavri(); posl = null; continue; }
      if (!jeCislo()) { i++; continue; }
      if (C === 'M') { zavri(); cur = { dira: false, body: [] }; const nx = ox + num(), ny = oy + num(); sx = nx; sy = ny; bod(nx, ny); cmd = rel ? 'l' : 'L'; posl = null; continue; }
      if (!cur) { cur = { dira: false, body: [] }; bod(x, y); }
      if (C === 'L') { bod(ox + num(), oy + num()); posl = null; }
      else if (C === 'H') { bod(ox + num(), y); posl = null; }
      else if (C === 'V') { bod(x, oy + num()); posl = null; }
      else if (C === 'C') { const a = [ox + num(), oy + num(), ox + num(), oy + num(), ox + num(), oy + num()]; krivka(...a); }
      else if (C === 'S') { const c1 = posl ? [2 * x - posl[0], 2 * y - posl[1]] : [x, y]; const a = [ox + num(), oy + num(), ox + num(), oy + num()]; krivka(c1[0], c1[1], ...a); }
      else if (C === 'Q' || C === 'T') {
        q = C === 'Q' ? [ox + num(), oy + num()] : (posl ? [2 * x - posl[0], 2 * y - posl[1]] : [x, y]);
        const nx = ox + num(), ny = oy + num();
        krivka(x + 2 / 3 * (q[0] - x), y + 2 / 3 * (q[1] - y), nx + 2 / 3 * (q[0] - nx), ny + 2 / 3 * (q[1] - ny), nx, ny); posl = q;
      } else if (C === 'A') {
        // rx ry rotace, pak dva příznaky 0/1 – v minifikovaném SVG bývají slepené („0110“ = 0 1 10)
        num(); num(); num();
        for (let k = 0; k < 2; k++) { const t = tok[i]; if (t && t.length > 1 && /^[01]/.test(t)) tok[i] = t.slice(1); else i++; }
        bod(ox + num(), oy + num()); posl = null;
      }
      else i++;
    }
    zavri();
    // y dolů → nahoru
    for (const ob of obrysy) for (const b of ob.body) { b.y = -b.y; if (b.a) b.a = [b.a[0], -b.a[1]]; if (b.b) b.b = [b.b[0], -b.b[1]]; }
    return normalizujObrysy(obrysy);
  }
  /** Obal obrysů [xmin, ymin, xmax, ymax]. */
  function obalObrysu(obrysy) {
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const ob of obrysy) for (const [x, y] of obrysNaBody(ob, 1)) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
    return b;
  }

  /** Mnohoúhelník se zaoblenými rohy jako obrys s Bézierovými úchyty (r = poloměr pro každý vrchol nebo jedno číslo). */
  function zaoblenyMnohouhelnik(vrcholy, r) {
    const N = vrcholy.length, body = [];
    vrcholy.forEach((V, i) => {
      const P = vrcholy[(i - 1 + N) % N], Q = vrcholy[(i + 1) % N], rr = Array.isArray(r) ? r[i] : r;
      const lp = Math.hypot(P[0] - V[0], P[1] - V[1]), lq = Math.hypot(Q[0] - V[0], Q[1] - V[1]);
      if (!(rr > 0.05)) { body.push({ x: V[0], y: V[1], a: null, b: null, hladky: false }); return; }
      const rp = Math.min(rr, lp / 2), rq = Math.min(rr, lq / 2);
      const up = [(P[0] - V[0]) / lp, (P[1] - V[1]) / lp], uq = [(Q[0] - V[0]) / lq, (Q[1] - V[1]) / lq];
      body.push({ x: V[0] + up[0] * rp, y: V[1] + up[1] * rp, a: null, b: [-up[0] * rp * 0.5523, -up[1] * rp * 0.5523], hladky: false });
      body.push({ x: V[0] + uq[0] * rq, y: V[1] + uq[1] * rq, a: [-uq[0] * rq * 0.5523, -uq[1] * rq * 0.5523], b: null, hladky: false });
    });
    // splývající body (poloměr = polovina strany) sloučit do jednoho hladkého
    const out = [];
    for (const B of body) {
      const z = out[out.length - 1];
      if (z && Math.hypot(z.x - B.x, z.y - B.y) < 1e-6) { z.b = B.b; z.hladky = true; } else out.push(B);
    }
    if (out.length > 1 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) < 1e-6) { out[0].a = out.pop().a; out[0].hladky = true; }
    return { dira: false, sirka: 0, nazev: '', body: out };
  }
  /** Přepočet obrysů do obalu [x0, x1] × [y0, y1] (zachová Bézierovy úchyty). */
  function doObalu(obrysy, x0, x1, y0, y1) {
    const b = obalObrysu(obrysy), kx = (x1 - x0) / ((b[2] - b[0]) || 1), ky = (y1 - y0) / ((b[3] - b[1]) || 1);
    for (const ob of obrysy) for (const P of ob.body) {
      P.x = x0 + (P.x - b[0]) * kx; P.y = y0 + (P.y - b[1]) * ky;
      if (P.a) P.a = [P.a[0] * kx, P.a[1] * ky]; if (P.b) P.b = [P.b[0] * kx, P.b[1] * ky];
    }
    return obrysy;
  }
  /** Štítek zepředu: obrysy (x, y) – plné a díry. Jen závěs = blok kolem kapsy. */
  function stitekObrysy(p, uch) {
    const t = p.telo, W = t.sirka, H = t.vyska, w = W / 2, B = (x, y, a, b, h) => ({ x, y, a: a || null, b: b || null, hladky: !!h });
    const roh = Math.min(t.roh, W / 2, H / 2), O = body => [{ dira: false, sirka: 0, nazev: '', body }];
    switch (t.tvar) {
      case 'zadny': {
        uch = uch || uchytRozmery(p, p.uchyt.posunAuto ? 0 : p.uchyt.posun);
        const sx = p.uchyt.sirka / 2 + p.uchyt.vule + Math.max(2.6, t.hrana + 1.4), vy = uch.vrchKapsy + Math.max(3.5, p.uchyt.okraj), rr = Math.min(t.roh, sx, 4);
        return [zaoblenyMnohouhelnik([[-sx, 0], [sx, 0], [sx, vy], [-sx, vy]], [0, 0, rr, rr])];
      }
      case 'elipsa': { const k = 0.5523; return O([B(0, 0, [-k * w, 0], [k * w, 0], 1), B(w, H / 2, [0, -k * H / 2], [0, k * H / 2], 1), B(0, H, [k * w, 0], [-k * w, 0], 1), B(-w, H / 2, [0, k * H / 2], [0, -k * H / 2], 1)]); }
      case 'stadion': return [zaoblenyMnohouhelnik([[-w, 0], [w, 0], [w, H], [-w, H]], Math.min(W, H) / 2)];
      case 'oblouk': return [zaoblenyMnohouhelnik([[-w, 0], [w, 0], [w, H], [-w, H]], [roh, roh, Math.min(w, H / 2), Math.min(w, H / 2)])];
      case 'kosoctverec': return [zaoblenyMnohouhelnik([[0, 0], [w, H / 2], [0, H], [-w, H / 2]], roh)];
      case 'mnohouhelnik': {
        const n = Math.round(t.param), v = [];
        for (let i = 0; i < n; i++) { const f = -Math.PI / 2 + Math.PI / n + 2 * Math.PI * i / n; v.push([Math.cos(f), Math.sin(f)]); }
        return doObalu([zaoblenyMnohouhelnik(v, 0)], -w, w, 0, H).map(ob => { const q = zaoblenyMnohouhelnik(ob.body.map(P => [P.x, P.y]), roh); return q; });
      }
      case 'stit': return O([B(0, 0, [-0.3 * W, 0.12 * H], [0.3 * W, 0.12 * H]), B(w, 0.5 * H, [0, -0.28 * H]), B(w, H), B(-w, H), B(-w, 0.5 * H, null, [0, -0.28 * H])]);
      case 'kapka': {
        const R = Math.min(w, H / 2), k = 0.5523 * R, Hh = Math.max(H, 2 * R);
        return O([B(0, 0, [-k, 0], [k, 0], 1), B(R, R, [0, -k], [0, 0.6 * R], 1), B(0, Hh, [0.12 * R, -0.3 * (Hh - R)], [-0.12 * R, -0.3 * (Hh - R)]), B(-R, R, [0, 0.6 * R], [0, -k], 1)]);
      }
      case 'list': return O([B(0, 0, [-0.25 * W, 0.15 * H], [0.25 * W, 0.15 * H]), B(w, H / 2, [0, -0.3 * H], [0, 0.3 * H], 1), B(0, H, [0.25 * W, -0.15 * H], [-0.25 * W, -0.15 * H]), B(-w, H / 2, [0, 0.3 * H], [0, -0.3 * H], 1)]);
      case 'vlastni': if (t.vlastni.some(ob => !ob.dira)) return t.vlastni; // jinak obdélník
      // falls through
      default: return [zaoblenyMnohouhelnik([[-w, 0], [w, 0], [w, H], [-w, H]], roh)];
    }
  }
  /** Bod uvnitř mnohoúhelníku (sudý–lichý). */
  function uvnitrMn(pt, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  /** Je bod v materiálu štítku (v některém plném obrysu a v žádné díře)? */
  function veStitku(pt, mn) { return mn.plne.some(q => uvnitrMn(pt, q)) && !mn.diry.some(q => uvnitrMn(pt, q)); }
  /** Krytí kapsy štítkem: nejmenší boční stěna a stěna nad kapsou (mm, záporné = kapsa vyčnívá). */
  function krytiKapsy(p, uch, obrysy) {
    const mn = { plne: obrysy.filter(o => !o.dira).map(o => obrysNaBody(o, 1)), diry: obrysy.filter(o => o.dira).map(o => obrysNaBody(o, 1)) };
    const sV = uch.sirkaKapsy;
    const okraj = (x0, y0, dx, dy) => {   // kolik mm materiálu je od bodu směrem (dx, dy)
      if (!veStitku([x0, y0], mn)) return -1;
      let d = 0; while (d < 40 && veStitku([x0 + dx * (d + 0.25), y0 + dy * (d + 0.25)], mn)) d += 0.25;
      return d;
    };
    let bok = Infinity, vrch = Infinity;
    for (let y = uch.y0 + 1; y <= uch.vrchKapsy; y += 2) for (const s of [-1, 1]) bok = Math.min(bok, okraj(s * sV(y), y, s, 0));
    for (let x = -sV(uch.vrchKapsy); x <= sV(uch.vrchKapsy) + 1e-9; x += 1.5) vrch = Math.min(vrch, okraj(x, uch.vrchKapsy, 0, 1));
    return { bok, vrch, mn };
  }
  /** Nejmenší zvětšení štítku (krok 5 %), při kterém se do něj kapsa vejde; null = ani při 3× ne. */
  function nejmensiStitek(p) {
    for (let k = 1.05; k <= 3.001; k += 0.05) {
      const q = kopie(p); q.telo.sirka = Math.ceil(p.telo.sirka * k); q.telo.vyska = Math.ceil(p.telo.vyska * k);
      if (p.uchyt.vyskaAuto) { if (autoVyskaUchytu(q)) return { sirka: q.telo.sirka, vyska: q.telo.vyska }; continue; }
      const st = stitekObrysy(q), ob = obalObrysu(st.filter(o => !o.dira));
      const mn = { plne: st.filter(o => !o.dira).map(o => obrysNaBody(o, 1)), diry: st.filter(o => o.dira).map(o => obrysNaBody(o, 1)) };
      for (let i = Math.max(0, Math.ceil(ob[1] * 2)); i / 2 <= ob[3]; i++) if (kapsaKryta(uchytRozmery(q, i / 2), mn, Math.max(2.4, p.telo.hrana + 1.3))) return { sirka: q.telo.sirka, vyska: q.telo.vyska };
    }
    return null;
  }
  /** Rychlá zkouška krytí pro hledání polohy kapsy: stěny aspoň 2,4 mm do boku a 3 mm nad kapsou. */
  function kapsaKryta(uch, mn, stena = 2.4, okraj = 3) {
    for (let y = uch.y0 + 1; y <= uch.vrchKapsy; y += 2) for (const s of [-1, 1]) if (!veStitku([s * (uch.sirkaKapsy(y) + stena), y], mn)) return false;
    // nad kapsou okraj materiálu; u oblých tvarů i nad rohy kapsy (ne jen uprostřed)
    const sh = uch.sirkaKapsy(uch.vrchKapsy) + stena * 0.5;
    for (let x = -sh; x <= sh + 1e-9; x += 1) if (!veStitku([x, uch.vrchKapsy + okraj], mn)) return false;
    return true;
  }
  /** Nejmenší rozumná výška úchytu: vruty od okrajů a od sebe aspoň hlava + 2 mm. */
  function minVyskaUchytu(p) {
    const sr = SROUBY[p.uchyt.sroub], m = sr.hlava / 2 + 3;
    return Math.max(20, 2 * m + (p.uchyt.pocet - 1) * (sr.hlava + 2));
  }
  /** Automatická výška úchytu: kapsa co nejníž (krytá zespodu) a co nejvýš – okraj mm pod horní hranou štítku.
     Vyšší úchyt = horní vrut výš = delší páka proti vytržení. Vrací {vyska, y0} nebo null. */
  function autoVyskaUchytu(p) {
    const u = p.uchyt, okraj = u.okraj, stena = Math.max(2.4, p.telo.hrana + 1.3), sH = vyska => Object.assign({}, p, { uchyt: Object.assign({}, u, { vyska }) });
    if (p.telo.tvar === 'zadny') {
      // jen závěs: blok kolem kapsy má výšku štítku → kapsa okraj mm pod ní
      let H = Math.max(12, p.telo.vyska - okraj - 1);
      for (let i = 0; i < 4; i++) { const q = uchytRozmery(sH(H), 0); H = Math.max(12, H - (q.vrchKapsy + okraj - p.telo.vyska)); }
      return { vyska: Math.round(H * 2) / 2, y0: 0 };
    }
    const st = stitekObrysy(p), ob = obalObrysu(st.filter(o => !o.dira));
    const mn = { plne: st.filter(o => !o.dira).map(o => obrysNaBody(o, 1)), diry: st.filter(o => o.dira).map(o => obrysNaBody(o, 1)) };
    const HMIN = minVyskaUchytu(p);
    let y0 = null;
    if (!u.posunAuto) y0 = kapsaKryta(uchytRozmery(sH(HMIN), u.posun), mn, stena, okraj) ? u.posun : null;
    else for (let i = Math.max(0, Math.ceil(ob[1] * 2)); i / 2 + HMIN <= ob[3]; i++) if (kapsaKryta(uchytRozmery(sH(HMIN), i / 2), mn, stena, okraj)) { y0 = i / 2; break; }
    if (y0 == null) return null;
    // menší úchyt při stejném spodku leží celý uvnitř většího → největší výška půlením
    let lo = HMIN, hi = Math.min(180, ob[3] - y0);
    while (hi - lo > 0.25) { const m = (lo + hi) / 2; if (kapsaKryta(uchytRozmery(sH(m), y0), mn, stena, okraj)) lo = m; else hi = m; }
    return { vyska: Math.floor(lo * 2) / 2, y0 };
  }

  /** Doplní chybějící hodnoty, omezí rozsahy. Vrací {p, hlaseni: [texty o úpravách]}. */
  function normalizuj(vstup) {
    const p = kopie(VYCHOZI), hl = [];
    if (vstup && typeof vstup === 'object') { const v = kopie(vstup); const ram = v.ramena; delete v.ramena; sl(p, v); p.ramena = ram; }
    if (!PROFILY_UCHYTU[p.uchyt.profil]) p.uchyt.profil = 'rybina';
    if (!SROUBY[p.uchyt.sroub]) p.uchyt.sroub = '4';
    if (!HRANY[p.telo.hranaTyp]) p.telo.hranaTyp = 'zkoseni';
    if (!TVARY_STITKU[p.telo.tvar]) p.telo.tvar = 'obdelnik';
    if (!ORIENTACE[p.tisk.orientace]) p.tisk.orientace = 'auto';
    p.uchyt.posunAuto = p.uchyt.posunAuto !== false;
    p.telo.vlastni = normalizujObrysy(p.telo.vlastni);
    if (!MATERIALY[p.tisk.material]) p.tisk.material = 'PETG';
    if (!ZDI[p.montaz.zed]) p.montaz.zed = 'cihla';
    p.nazev = String(p.nazev == null ? '' : p.nazev).slice(0, 120);
    for (const [c, roz] of Object.entries(ROZSAHY)) {
      const h = cislo(vezmi(p, c), vezmi(VYCHOZI, c)), o = omez(h, roz, vezmi(VYCHOZI, c));
      if (o !== h) hl.push(`${c} ${fmt(h, 2)} → ${fmt(o, 2)}`);
      poloz(p, c, o);
    }
    p.uchyt.pocet = Math.round(p.uchyt.pocet); p.tisk.ks = Math.round(p.tisk.ks); p.montaz.pocet = Math.round(p.montaz.pocet);
    p.ramena = (Array.isArray(p.ramena) ? p.ramena : []).slice(0, MAX_RAMEN).map((r, i) => normalizujRameno(r, hl, i));
    p.obrysy = normalizujObrysy(p.obrysy);
    p.uchyt.vyskaAuto = p.uchyt.vyskaAuto !== false;
    if (p.uchyt.vyskaAuto) { const a = autoVyskaUchytu(p); if (a) p.uchyt.vyska = Math.min(ROZSAHY['uchyt.vyska'][1], Math.max(ROZSAHY['uchyt.vyska'][0], a.vyska)); }
    return { p, hlaseni: hl };
  }
  function zPredvolby(i) {
    const v = PREDVOLBY[i], p = normalizuj({}).p;
    const q = kopie(v.p); const ram = q.ramena; delete q.ramena;
    sl(p, q); p.ramena = ram; p.nazev = v.nazev;
    return normalizuj(p).p;
  }

  /* ---------- páteř ramene ---------- */
  const PRESAH = 2;   // rameno začíná o 2 mm uvnitř těla, aby se s ním spojilo
  /** Vzorky páteře: [{z, y, s, t (tloušťka), h (směr v rad)}], krok ≤ 1 mm a ≤ 4°. */
  function pater(r, telo) {
    let z = telo.hloubka - PRESAH, y = r.y, h = r.uhel * RAD, s = 0;
    const body = [{ z, y, s, h }];
    const krok = (ds, dh) => {
      const hm = h + dh / 2;
      z += ds * Math.cos(hm); y += ds * Math.sin(hm); h += dh; s += ds;
      body.push({ z, y, s, h });
    };
    for (const g of r.trasa) {
      if (g.t === 'r') { const n = Math.max(1, Math.ceil(g.d / 1)); for (let i = 0; i < n; i++) krok(g.d / n, 0); }
      else if (g.t === 'z') { h += g.u * RAD; body[body.length - 1].h = h; }
      else {
        const u = g.u * RAD, r0 = g.r, r1 = g.t === 's' ? g.r1 : g.r;
        const delka = Math.abs(u) * (r0 + r1) / 2;
        const n = Math.max(2, Math.ceil(Math.abs(g.u) / 4), Math.ceil(delka / 1));
        for (let i = 0; i < n; i++) {
          const rr = r0 + (r1 - r0) * (i + 0.5) / n, dh = u / n;
          krok(rr * Math.abs(dh), dh);
        }
      }
    }
    const L = s || 1;
    for (const b of body) b.t = r.tl0 + (r.tl1 - r.tl0) * b.s / L;
    if (body.length === 1) { krok(0.5, 0); body[1].t = r.tl1; }
    return body;
  }
  const polomerKonce = r => (r.druh && r.druh !== 'trasa' ? 0 : r.konec === 'koule' ? Math.max(r.rKonec, r.tl1 / 2) : r.tl1 / 2);

  /* ---------- ramena z mnohoúhelníků (blok, kolík s hlavou) a obecný rozbor profilu ---------- */
  /** Mnohoúhelníky ramene v rovině (z, y). Kořen = (hloubka štítku, r.y), natočení r.uhel kolem kořene. */
  function polygonyRamene(r, telo) {
    const D = telo.hloubka, z0 = D - PRESAH, y = r.y, c = Math.cos(r.uhel * RAD), sn = Math.sin(r.uhel * RAD);
    const otoc = pts => pts.map(([z, yy]) => { const dz = z - D, dy = yy - y; return [D + dz * c - dy * sn, y + dz * sn + dy * c]; });
    const vzorky = ob => obrysNaBody(ob, 0.5).map(q => [q[0], q[1]]);
    if (r.druh === 'blok') {
      // y = horní hrana u štítku; horní plocha se sklonem, dole klín (h0 → h1), na konci zub nahoru
      const L = r.delka, zT = D + L, yTe = y + L * Math.tan(r.sklon * RAD), zub = r.zub, zt = Math.min(r.zubTl, L - 1);
      const v = [[z0, y - r.h0], [zT, yTe - r.h1]], rad = [0, r.zaobleni];
      if (zub > 0.05) { v.push([zT, yTe + zub], [zT - zt, yTe + zub], [zT - zt, y + (L - zt) * Math.tan(r.sklon * RAD)]); rad.push(r.zaobleni, r.zaobleni, Math.min(r.zaobleni, 2)); }
      else { v.push([zT, yTe]); rad.push(r.zaobleni); }
      v.push([z0, y]); rad.push(0);
      return [otoc(vzorky(zaoblenyMnohouhelnik(v, rad)))];
    }
    if (r.druh === 'hrib') {
      // dřík tloušťky tl a délky delka, na konci hlava: nahoru / dolů od osy, tloušťka hlavaTl
      const L = r.delka, t = r.tl / 2, zT = D + L, ht = Math.min(r.hlavaTl, L - 1), rh = Math.min(ht / 2, (r.nahoru + r.dolu + 2 * t) / 4);
      const drik = [[z0, y - t], [zT - ht + 0.5, y - t], [zT - ht + 0.5, y + t], [z0, y + t]];
      const hlava = zaoblenyMnohouhelnik([[zT - ht, y - t - r.dolu], [zT, y - t - r.dolu], [zT, y + t + r.nahoru], [zT - ht, y + t + r.nahoru]], [rh * 0.6, rh, rh, rh * 0.6]);
      return [otoc(drik), otoc(vzorky(hlava))];
    }
    return null;
  }
  /** Svislé intervaly materiálu v x (sudý–lichý pro každý mnohoúhelník, pak sjednocení). */
  function intervalyY(polys, x) {
    const iv = [];
    for (const poly of polys) {
      const ys = [];
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((xi > x) !== (xj > x)) ys.push(yi + (yj - yi) * (x - xi) / (xj - xi));
      }
      ys.sort((a, b) => a - b);
      for (let k = 0; k + 1 < ys.length; k += 2) iv.push([ys[k], ys[k + 1]]);
    }
    iv.sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const q of iv) { const z = out[out.length - 1]; if (z && q[0] <= z[1]) z[1] = Math.max(z[1], q[1]); else out.push(q.slice()); }
    return out;
  }
  /** Obecný rozbor profilu (z, y) od čela štítku z0: kde visí poutko (horní plocha, bariéra ke konci), pevnost v ohybu
     z výšky řezu, průhyb. Vodorovná nebo stoupající plocha bez kapsy = drží třením. */
  /** Odečte díry od intervalů materiálu. */
  function bezDer(iv, dv) {
    let out = iv;
    for (const [d0, d1] of dv) out = out.flatMap(([a, b]) => (d1 <= a || d0 >= b ? [[a, b]] : [[a, d0], [d1, b]].filter(([u, v]) => v - u > 1e-6)));
    return out;
  }
  function rozborPolygonu(polys, z0, W, F, sigma, E, yKoren, diry = []) {
    let zMax = -Infinity, zMin = Infinity, yMin = Infinity, yMax = -Infinity;
    for (const poly of polys) for (const [x, y] of poly) { zMax = Math.max(zMax, x); zMin = Math.min(zMin, x); yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); }
    const krok = 0.5, X = [], top = [], h = [];
    for (let x = z0 + 0.25; x < zMax; x += krok) {
      const iv = diry.length ? bezDer(intervalyY(polys, x), intervalyY(diry, x)) : intervalyY(polys, x);
      if (!iv.length) { if (X.length) break; else continue; }   // mezera = konec ramene
      // spojitý kus, který je nejblíž kořeni ramene (u kořene ten, který obsahuje yKoren)
      const kus = X.length ? iv.reduce((m, q) => (Math.abs((q[0] + q[1]) / 2 - (top[top.length - 1] - h[h.length - 1] / 2)) < Math.abs((m[0] + m[1]) / 2 - (top[top.length - 1] - h[h.length - 1] / 2)) ? q : m))
        : iv.find(q => yKoren == null || (q[0] <= yKoren + 1 && q[1] >= yKoren - 1)) || iv[iv.length - 1];
      X.push(x); top.push(kus[1]); h.push(kus[1] - kus[0]);
    }
    const n = X.length;
    if (!n) return null;
    // poutko sjíždí po horní ploše; bariéra = nejvyšší místo dál ke konci
    const hl = new Float64Array(n); let bar = -Infinity, hloubka = 0;
    for (let i = n - 1; i >= 0; i--) { bar = Math.max(bar, top[i]); hl[i] = bar - top[i]; hloubka = Math.max(hloubka, hl[i]); }
    // svah horní plochy (bez posledních 3 mm – zaoblení přední hrany)
    let iK = n - 1; while (iK > 0 && X[iK] > X[n - 1] - 3) iK--;
    let pokles = 0; for (let i = 0; i <= iK; i++) pokles = Math.max(pokles, top[i] - top[iK]);
    const trenim = hloubka < 4 && pokles <= 1 && X[n - 1] - X[0] >= 6;
    let iZ = 0;
    if (hloubka >= 4) { for (let i = 0; i < n; i++) if (hl[i] >= Math.max(4, 0.5 * hloubka)) iZ = i; }
    else iZ = Math.floor((n - 1) * 0.75);
    const zx = X[iZ];
    let smax = 0, iS = 0, unese = Infinity, pruhyb = 0;
    for (let i = 0; i <= iZ; i++) {
      const ram = zx - X[i], hh = Math.max(0.5, h[i]);
      const sg = 6 * F * ram / (W * hh * hh); if (sg > smax) { smax = sg; iS = i; }
      if (ram > 0.5) unese = Math.min(unese, sigma / 2 * W * hh * hh / 6 / ram / 9.81);
      pruhyb += F * ram * ram / (E * W * hh * hh * hh / 12) * krok;
    }
    return {
      polys, hloubka, trenim, drzi: hloubka >= 4 || trenim, zat: { z: zx, y: top[iZ] - 0.5, t: 1 }, vis: { z: zx, y: top[iZ] - 0.5, t: 1 },
      otvor: Infinity, zMin, dosah: zMax, yMin, yMax, odstup: zx, pruhyb, napeti: smax, mistoNapeti: { z: X[iS], t: h[iS] },
      unese, k: smax > 1e-9 ? sigma / smax : Infinity, delka: X[n - 1] - z0,
    };
  }

  /** Rozbor ramene: kde visí poutko, hloubka kapsy, otvor, zásah do zdi, dosah, pevnost (pro F v N). */
  function rozborRamene(r, p, F, sigma, E = 2000) {
    if (r.druh !== 'trasa') {
      const polys = polygonyRamene(r, p.telo), W = Math.max(1, (r.sirka > 0 ? r.sirka : sirkaRamen(p)) - p.telo.hrana);
      const diry = p.obrysy.filter(ob => ob.dira).map(ob => obrysNaBody(ob, 0.5));
      const a = rozborPolygonu(polys, p.telo.hloubka, W, F, sigma, E, r.y - (r.druh === 'blok' ? r.h0 / 2 : 0), diry);
      const c = Math.cos(r.uhel * RAD), sn = Math.sin(r.uhel * RAD), L = r.delka;
      // osa ramene pro kreslení (kořen a konec), jako u trasy
      a.body = [{ z: p.telo.hloubka - PRESAH, y: r.y, s: 0, t: r.druh === 'blok' ? r.h0 : r.tl, h: r.uhel * RAD },
        { z: p.telo.hloubka + L * c, y: r.y + L * sn, s: L, t: r.druh === 'blok' ? r.h1 : r.tl, h: r.uhel * RAD }];
      a.iVis = 0;
      return a;
    }
    const tl = p.telo, b = pater(r, tl), n = b.length, tip = b[n - 1];
    // vzorky venku z těla (tam může poutko viset)
    const venku = i => b[i].z - b[i].t / 2 > tl.hloubka - 0.5 || b[i].y - b[i].t / 2 > tl.vyska || b[i].y + b[i].t / 2 < 0;
    let i0 = 0; while (i0 < n - 1 && !venku(i0)) i0++;
    // poutko sjíždí dolů po horní straně ramene; drží, když před ním (ke špičce) je vyšší bariéra
    const lem = r.konec === 'koule' ? Math.max(0, r.rKonec - r.tl1 / 2) : 0;
    const vrch = i => b[i].y + b[i].t / 2;
    let bariera = vrch(n - 1) + lem, hloubka = -Infinity, iVis = n - 1;
    const hl = new Float64Array(n);
    for (let i = n - 1; i >= i0; i--) {
      bariera = Math.max(bariera, vrch(i) + (i === n - 1 ? lem : 0));
      hl[i] = bariera - vrch(i);
      if (hl[i] > hloubka + 1e-9) { hloubka = hl[i]; iVis = i; }
    }
    // dno kapsy (u kolíku kořen u těla); zátěž ale může viset kdekoli v kapse – pro pevnost
    // se bere místo kapsy nejdál od kořene (aspoň polovina hloubky, nejméně 4 mm)
    const vis = b[iVis];
    let iZ = iVis;
    for (let i = i0; i < n; i++) if (hl[i] >= Math.max(4, 0.5 * hloubka) && Math.abs(b[i].z - b[i0].z) > Math.abs(b[iZ].z - b[i0].z)) iZ = i;
    const zat = b[iZ];
    // do zdi: vzorky mimo tělo, které by zasáhly za rovinu zdi
    let zMin = Infinity;
    for (let i = i0; i < n; i++) zMin = Math.min(zMin, b[i].z - b[i].t / 2);
    zMin = Math.min(zMin, tip.z - polomerKonce(r));
    // otvor: poutko se navléká přes špičku a jede po rameni až do kapsy – nejužší mezera na té cestě
    // mezi ramenem a vzdálenými částmi ramene (jiný závit, oblouk) nebo čelem těla
    const rk = polomerKonce(r), polo = i => (i === n - 1 ? rk : b[i].t / 2);
    let otvor = Infinity;
    for (let i = n - 1; i >= Math.min(iVis, n - 1); i -= 2) {
      const blizko = 3 * Math.max(b[i].t, rk) + 6;
      for (let j = 0; j < n; j += 2) {
        if (Math.abs(b[i].s - b[j].s) < blizko) continue;
        otvor = Math.min(otvor, Math.hypot(b[i].z - b[j].z, b[i].y - b[j].y) - polo(i) - polo(j));
      }
      if (b[i].s - b[i0].s > blizko && b[i].y > -5 && b[i].y < tl.vyska + 5) otvor = Math.min(otvor, b[i].z - polo(i) - tl.hloubka);
    }
    // pevnost: ohyb v řezu i od kořene k místu zátěže, rameno = vodorovná vzdálenost
    let smax = 0, iS = i0, nejslabsi = Infinity;
    const W = Math.max(1, (r.sirka > 0 ? r.sirka : sirkaRamen(p)) - p.telo.hrana);
    for (let i = i0; i <= iZ; i++) {
      const M = F * Math.abs(zat.z - b[i].z), s = 6 * M / (W * b[i].t * b[i].t);
      if (s > smax) { smax = s; iS = i; }
    }
    // průhyb v místě zátěže: ∫ F·Δz² / (E·I) ds, I = W·t³/12 (Mohrův integrál, jen ohyb)
    let pruhyb = 0;
    for (let i = Math.max(1, i0); i <= iZ; i++) {
      const dz = zat.z - (b[i].z + b[i - 1].z) / 2, tt = (b[i].t + b[i - 1].t) / 2;
      pruhyb += F * dz * dz / (E * W * tt * tt * tt / 12) * (b[i].s - b[i - 1].s);
    }
    // unese (kg) s bezpečností 2
    for (let i = i0; i <= iZ; i++) {
      const rameno = Math.abs(zat.z - b[i].z);
      if (rameno > 0.5) nejslabsi = Math.min(nejslabsi, sigma / 2 * W * b[i].t * b[i].t / 6 / rameno / 9.81);
    }
    let zMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const q of b) { zMax = Math.max(zMax, q.z + q.t / 2); yMin = Math.min(yMin, q.y - q.t / 2); yMax = Math.max(yMax, q.y + q.t / 2); }
    zMax = Math.max(zMax, tip.z + rk); yMin = Math.min(yMin, tip.y - rk); yMax = Math.max(yMax, tip.y + rk);
    return {
      body: b, delka: tip.s, hloubka, drzi: hloubka >= 4, vis, iVis, zat, otvor, zMin, dosah: zMax, yMin, yMax,
      odstup: zat.z, pruhyb, napeti: smax, mistoNapeti: b[iS], unese: nejslabsi, k: smax > 1e-9 ? sigma / smax : Infinity,
    };
  }

  /* ---------- úchyt na zeď ---------- */
  /** Průřez úchytu v rovině (c = x, a = z): body proti směru hodinových ručiček (v souřadnicích c, a). */
  function prurezUchytu(u) {
    const w = u.sirka, t = u.hloubka;
    if (u.profil === 'T') {
      const kr = w - 2 * u.presah, a1 = Math.max(0.8, t - u.presah - 1.5);
      return [[-kr / 2, 0], [kr / 2, 0], [kr / 2, a1], [w / 2, a1 + u.presah], [w / 2, t], [-w / 2, t], [-w / 2, a1 + u.presah], [-kr / 2, a1]];
    }
    const wn = w - 2 * t * Math.tan(u.uhel * RAD);
    return [[-wn / 2, 0], [wn / 2, 0], [w / 2, t], [-w / 2, t]];
  }
  /** Odvozené rozměry úchytu a kapsy. */
  function uchytRozmery(p, y0 = 0) {
    const u = p.uchyt, sr = SROUBY[u.sroub];
    const pr = prurezUchytu(u);
    const uzky = u.profil === 'T' ? u.sirka - 2 * u.presah : u.sirka - 2 * u.hloubka * Math.tan(u.uhel * RAD);
    const sNahore = Math.max(0.2, 1 - u.klin / u.sirka);           // měřítko šířky nahoře
    const sklon = u.klin / 2 / u.vyska;                               // zúžení na stranu na 1 mm výšky
    // s klínem věšák dosedne, až se boční vůle vymezí. Kapsa i úchyt se zužují úměrně (měřítko s(y) = 1 − k·y),
    // vůle ve výšce y je tedy 2·vůle·s(y); první dotyk nahoře úchytu: δ = c·sNahore / (1 + c·k), c = vůle / sklon
    const kS = (1 - sNahore) / u.vyska, c = sklon > 1e-6 ? u.vule / sklon : 0;
    const pokles = sklon > 1e-6 ? Math.min(c * sNahore / (1 + c * kS), u.vyska * 0.6) : 0;
    // y0 = spodek úchytu nad spodkem štítku (kapsa posunutá výš; pod ní zespodu otevřený kanál pro nasunutí)
    const vrchKapsy = y0 + u.vyska + (sklon > 1e-6 ? pokles + 0.6 : u.vule), dole = y0 + pokles;
    const sirkaKapsy = y => u.sirka / 2 * (1 - (1 - sNahore) * (y - y0) / u.vyska) + u.vule;   // poloviční šířka kapsy vpředu
    const zapust = (sr.hlava - sr.d) / 2 + 0.3;                        // hloubka zahloubení 90° + 0,3 mm
    const srouby = [];
    // vruty od okrajů úchytu: horní co nejvýš (páka proti vytržení roste s výškou), spodní co nejníž
    const mSr = Math.min(sr.hlava / 2 + 3, u.vyska / 2);
    for (let i = 0; i < u.pocet; i++) srouby.push(u.pocet === 1 ? u.vyska - mSr : mSr + (u.vyska - 2 * mSr) * i / (u.pocet - 1));
    const sirkaV = y => u.sirka * (1 - (1 - sNahore) * y / u.vyska);   // přední šířka ve výšce y
    return { pr, uzky, sNahore, sklon, pokles, vrchKapsy, zapust, srouby, sr, sirkaV, y0, dole, sirkaKapsy };
  }

  /* ---------- odvozené a kontroly ---------- */
  /** Šířka ramen (0 = jako štítek). */
  const sirkaRamen = p => p.telo.sirkaRamen > 0 ? p.telo.sirkaRamen : p.telo.sirka;
  /** orientace = skutečná tisková poloha věšáku ('bok' / 'zada'); zády dolů vedou vrstvy napříč ramenem (× 0,5). */
  function odvozene(p, orientace = 'bok') {
    const mat = MATERIALY[p.tisk.material];
    const sigma = mat.pevnost * (0.6 + 0.4 * p.tisk.vypln / 100) * (orientace === 'zada' ? 0.5 : 1);
    const F = p.zatez.kg * 9.81;
    let uch = uchytRozmery(p, p.uchyt.posunAuto ? 0 : p.uchyt.posun);
    const E = mat.E * (0.6 + 0.4 * p.tisk.vypln / 100);
    const ramena = p.ramena.map(r => rozborRamene(r, p, F, sigma, E));
    // vlastní plné obrysy zboku: stejný rozbor jako blok (pevnost, drží); díry se odečtou ze všech
    const diry = p.obrysy.filter(ob => ob.dira).map(ob => obrysNaBody(ob, 0.5));
    const obrysyRozbor = p.obrysy.map(ob => {
      if (ob.dira) return null;
      const W = Math.max(1, (ob.sirka > 0 ? ob.sirka : sirkaRamen(p)) - p.telo.hrana);
      const a = rozborPolygonu([obrysNaBody(ob, 0.5)], p.telo.hloubka, W, F, sigma, E, null, diry);
      return a && a.delka > 3 ? a : null;   // obrys celý ve štítku nic nenese
    });
    // rozměry celku
    const stitek = stitekObrysy(p, uch), obSt = obalObrysu(stitek.filter(ob => !ob.dira));
    // automatická poloha kapsy: nejníž, kde ji štítek celou zakryje
    if (p.uchyt.posunAuto && p.telo.tvar !== 'zadny') {
      const mn = { plne: stitek.filter(o => !o.dira).map(o => obrysNaBody(o, 1)), diry: stitek.filter(o => o.dira).map(o => obrysNaBody(o, 1)) };
      const stena = Math.max(2.4, p.telo.hrana + 1.3);
      for (let i = Math.max(0, Math.ceil(obSt[1] * 2)); i / 2 <= obSt[3]; i++) { const q = uchytRozmery(p, i / 2); if (kapsaKryta(q, mn, stena)) { uch = q; break; } }
    }
    const kryti = krytiKapsy(p, uch, stitek);
    let zMax = p.telo.hloubka, yMin = obSt[1], yMax = obSt[3];
    for (const a of ramena) { zMax = Math.max(zMax, a.dosah); yMin = Math.min(yMin, a.yMin); yMax = Math.max(yMax, a.yMax); }
    const plne = p.obrysy.filter(ob => !ob.dira);
    if (plne.length) { const b = obalObrysu(plne); zMax = Math.max(zMax, b[2]); yMin = Math.min(yMin, b[1]); yMax = Math.max(yMax, b[3]); }
    // vrut: tl. úchytu pod hlavou + omítka + kotevní hloubka, nahoru na řadu délek
    const zed = ZDI[p.montaz.zed], potreba = p.uchyt.hloubka + p.montaz.omitka + zed.kotva;
    const delkaVrutu = DELKY_VRUTU.find(d => d >= potreba) || Math.ceil(potreba / 10) * 10;
    // rozsah zepředu (štítek, ramena a obrysy i s posunem do strany)
    let xMin = obSt[0], xMax = obSt[2];
    for (const q of p.ramena.concat(p.obrysy.filter(ob => !ob.dira))) { const sw = (q.sirka > 0 ? q.sirka : sirkaRamen(p)) / 2, x = q.x || 0; xMin = Math.min(xMin, x - sw); xMax = Math.max(xMax, x + sw); }
    return { uch, ramena, obrysyRozbor, sigma, E, F, xMin, xMax, zMax, yMin, yMax, zed, delkaVrutu, stitek, obalStitku: obSt, kryti, orientace,
      sirkaRamen: sirkaRamen(p), stena: kryti.bok };
  }
  function kontroly(p, o) {
    const H = [], t = p.telo, u = p.uchyt, uch = o.uch;
    const pridej = (uroven, text, pole, oprava) => H.push({ uroven, text, pole: pole ? [].concat(pole) : [], oprava });
    // štítek musí kapsu s úchytem celý zakrýt (zepředu), boční stěna ≥ 2 mm, nad kapsou ≥ 3 mm
    const kr = o.kryti, zadny = t.tvar === 'zadny';
    const autoNelze = p.uchyt.vyskaAuto && !zadny && !autoVyskaUchytu(p);
    const vetsi = (kr.bok < 2 || kr.vrch < 3 || autoNelze) && !zadny && t.tvar !== 'vlastni' && p.uchyt.posunAuto ? nejmensiStitek(p) : null;
    if (autoNelze && kr.bok >= 2 && kr.vrch >= 3) pridej('varovani', `Do štítku se nevejde úchyt aspoň ${fmt(minVyskaUchytu(p))} mm vysoký s okrajem ${fmt(u.okraj)} mm – použita výška ${fmt(u.vyska)} mm. Zvětšete štítek nebo zmenšete okraj.`,
      ['telo.vyska', 'uchyt.okraj'], vetsi ? { pole: 'telo.sirka', hodnota: vetsi.sirka, vice: [['telo.vyska', vetsi.vyska]], text: `zvětšit štítek na ${fmt(vetsi.sirka)} × ${fmt(vetsi.vyska)} mm` } : undefined);
    const opravaVel = vetsi ? { pole: 'telo.sirka', hodnota: vetsi.sirka, vice: [['telo.vyska', vetsi.vyska]], text: `zvětšit štítek na ${fmt(vetsi.sirka)} × ${fmt(vetsi.vyska)} mm` } : undefined;
    if (kr.bok < 2) pridej('chyba', kr.bok < 0 ? `Štítek nezakryje kapsu pro úchyt – kapsa z něj vyčnívá do strany. Rozšiřte štítek nebo zvolte jiný tvar.`
      : `Štítek je u kapsy tenký: boční stěna ${fmt(kr.bok)} mm (aspoň 2 mm).`, ['telo.sirka', 'telo.tvar', 'uchyt.sirka'], opravaVel);
    else if (kr.bok < t.hrana + 1.2 && !zadny) pridej('varovani', 'Hrana čela štítku skoro sahá do kapsy – zmenšete hranu nebo rozšiřte štítek.', ['telo.hrana']);
    if (kr.vrch < 3) pridej('chyba', kr.vrch < 0 ? `Štítek nezakryje kapsu nahoře – kapsa sahá do ${fmt(uch.vrchKapsy)} mm, štítek tam už není.` : `Nad kapsou zbývá jen ${fmt(kr.vrch)} mm štítku (aspoň 3 mm).`,
      ['telo.vyska', 'uchyt.vyska'], kr.bok < 2 ? undefined : opravaVel);
    const minHl = Math.ceil((u.hloubka + u.vule + 2.5) * 2) / 2;
    if (t.hloubka < minHl) pridej('chyba', `Štítek je mělký: kapsa je hluboká ${fmt(u.hloubka + u.vule)} mm, vpředu musí zbýt aspoň 2,5 mm.`, ['telo.hloubka', 'uchyt.hloubka'],
      { pole: 'telo.hloubka', hodnota: minHl, text: `prohloubit štítek na ${fmt(minHl)} mm` });
    if (t.tvar === 'vlastni' && !t.vlastni.some(ob => !ob.dira)) pridej('info', 'Vlastní tvar štítku zatím není nakreslený – použije se obdélník. Nakreslete ho v náhledu Štítek zepředu.', ['telo.tvar']);
    if (t.sirkaRamen > t.sirka + 0.01 && !zadny) pridej('info', 'Ramena jsou širší než štítek.', ['telo.sirkaRamen']);
    // úchyt
    const sr = uch.sr;
    const uzkyNahore = uch.uzky * uch.sirkaV(uch.srouby[uch.srouby.length - 1]) / u.sirka;
    if (uch.uzky >= sr.d + 3 && uzkyNahore < sr.d + 3) pridej('chyba', `Úchyt je u zdi u horního vrutu úzký (${fmt(uzkyNahore)} mm, klín ho zúží) – pro ${sr.nazev} potřebuje aspoň ${fmt(sr.d + 3)} mm. Zmenšete klín nebo úhel rybiny.`,
      ['uchyt.klin', u.profil === 'T' ? 'uchyt.presah' : 'uchyt.uhel']);
    if (uch.uzky < sr.d + 3) pridej('chyba', `Úchyt je u zdi úzký (${fmt(uch.uzky)} mm) – pro ${sr.nazev} potřebuje aspoň ${fmt(sr.d + 3)} mm. Zmenšete úhel rybiny / přesah nebo úchyt rozšiřte.`,
      ['uchyt.sirka', u.profil === 'T' ? 'uchyt.presah' : 'uchyt.uhel']);
    const yHorni = uch.srouby[uch.srouby.length - 1];
    if (uch.sirkaV(yHorni) * (u.profil === 'T' ? 1 : 1) < sr.hlava + 1.5) pridej('chyba', `Hlava vrutu (Ø ${fmt(sr.hlava)}) se nahoře úchytu nevejde – šířka tam je ${fmt(uch.sirkaV(yHorni))} mm. Zmenšete klín nebo vrut, nebo úchyt rozšiřte.`,
      ['uchyt.klin', 'uchyt.sroub', 'uchyt.sirka']);
    if (u.hloubka < uch.zapust + 1.5) pridej('chyba', `Úchyt je tenký: zápustná hlava potřebuje ${fmt(uch.zapust, 1)} mm, pod ní aspoň 1,5 mm materiálu.`, ['uchyt.hloubka', 'uchyt.sroub'],
      { pole: 'uchyt.hloubka', hodnota: Math.ceil((uch.zapust + 1.5) * 2) / 2, text: 'zesílit úchyt' });
    if (u.pocet > 1 && (uch.srouby[1] - uch.srouby[0]) < sr.hlava + 2) pridej('chyba', 'Vruty jsou příliš blízko u sebe – snižte jejich počet nebo zvyšte úchyt.', ['uchyt.pocet', 'uchyt.vyska']);
    if (u.profil === 'T' && u.hloubka - u.presah - 1.5 < 0.8) pridej('chyba', 'Hlava T je moc tlustá vůči tloušťce úchytu – zmenšete přesah nebo zesilte úchyt.', ['uchyt.presah', 'uchyt.hloubka']);
    if (u.profil === 'rybina' && u.uhel < 5) pridej('varovani', 'Rybina se skoro svislými boky věšák u zdi nedrží – dejte úhel aspoň 10°.', ['uchyt.uhel']);
    if (u.klin === 0) pridej('info', `Bez klínu zůstane mezi věšákem a úchytem vůle ${fmt(u.vule, 2)} mm – věšák se bude mírně viklat. Klín 1,5–3 mm ho při nasazení dotáhne.`, ['uchyt.klin']);
    else if (uch.pokles > u.vyska * 0.45) pridej('varovani', `Věšák s klínem sjede o ${fmt(uch.pokles)} mm níž, než je vršek úchytu – zvětšete klín nebo zmenšete vůli.`, ['uchyt.klin', 'uchyt.vule']);
    // ramena
    if (!p.ramena.length && !p.obrysy.some(ob => !ob.dira)) pridej('varovani', 'Věšák nemá žádné rameno ani vlastní obrys – přidejte je v boxu Tvar háčku nebo v profilu.', []);
    if (p.obrysy.length) {
      o.obrysyRozbor.forEach((a, i) => {
        if (!a) return;
        const c = `Obrys ${p.obrysy[i].nazev || i + 1}`;
        if (!a.drzi) pridej('info', `${c}: poutko z něj nejspíš sklouzne (horní plocha klesá ke konci) – přidejte zub nebo ho natočte nahoru.`, []);
        else if (a.trenim) pridej('info', `${c}: vodorovná plocha – poutko drží jen třením.`, []);
        if (a.k < 1.2) pridej('varovani', `${c}: při ${fmt(p.zatez.kg)} kg praskne (bezpečnost × ${fmt(a.k, 1)}) – zesilte ho u štítku.`, ['zatez.kg']);
      });
      const b = obalObrysu(p.obrysy);
      if (b[0] < -0.01) pridej('info', 'Část vlastního obrysu leží za rovinou zdi – ořízne se.', []);
      if (b[2] - Math.min(0, b[0]) > 200 || b[3] - b[1] > 250) pridej('varovani', `Vlastní obrys měří ${fmt(b[2] - b[0])} × ${fmt(b[3] - b[1])} mm – je to opravdu v milimetrech?`, []);
    }
    o.ramena.forEach((a, i) => {
      const r = p.ramena[i], c = `Rameno ${i + 1}`;
      if (!a.drzi) pridej('varovani', `${c}: poutko z něj sklouzne – konec neleží výš než dno ramene (kapsa ${fmt(Math.max(0, a.hloubka))} mm). ${r.druh === 'blok' ? 'Dejte horní ploše sklon nahoru nebo zub na konci.' : r.druh === 'hrib' ? 'Zvětšete hlavu nahoru.' : 'Natočte ho víc nahoru nebo přidejte oblouk či kouli.'}`, [`ramena.${i}.${r.druh === 'blok' ? 'sklon' : r.druh === 'hrib' ? 'nahoru' : 'uhel'}`]);
      else if (a.trenim) pridej('info', `${c}: vodorovná horní plocha – poutko drží jen třením; sklon 3–8° nebo malý zub ho pojistí.`, [`ramena.${i}.sklon`]);
      if (a.otvor < 8 && a.otvor > -Infinity && Number.isFinite(a.otvor)) pridej('varovani', `${c}: mezi koncem a zbytkem věšáku je jen ${fmt(Math.max(0, a.otvor))} mm – poutko se tam nevejde (aspoň 8–10 mm).`, [`ramena.${i}.trasa`]);
      if (a.zMin < 1) pridej('chyba', `${c}: rameno se stáčí až do zdi (z = ${fmt(a.zMin)} mm) – co je za zdí, se ořízne a věšák nepůjde nasadit.`, [`ramena.${i}.trasa`]);
      if (!veStitku([r.x, r.y], kr.mn)) pridej('varovani', `${c}: kořen ramene (výška ${fmt(r.y)} mm) neleží na štítku – rameno by viselo ve vzduchu.`, [`ramena.${i}.y`]);
      if (a.k < 1.2) pridej('varovani', `${c}: při ${fmt(p.zatez.kg)} kg praskne (bezpečnost × ${fmt(a.k, 1)}) – zesilte rameno u těla nebo zkraťte vyložení.`, [`ramena.${i}.tl0`, 'zatez.kg']);
      if (a.dosah > 180 || a.yMax - a.yMin > 220) pridej('varovani', `${c}: věšák měří ${fmt(a.dosah)} × ${fmt(a.yMax - a.yMin)} mm – ověřte, že se vejde na podložku tiskárny.`, []);
    });
    if (p.montaz.pocet > 1 && p.montaz.rozestup < o.xMax - o.xMin + 5) pridej('chyba', `Rozestup věšáků ${fmt(p.montaz.rozestup)} mm je menší než šířka věšáku + 5 mm – narazily by do sebe.`, ['montaz.rozestup'],
      { pole: 'montaz.rozestup', hodnota: Math.ceil(o.xMax - o.xMin + 5), text: 'nejmenší rozestup' });
    const ram = o.ramena.length ? Math.max(...o.ramena.map(a => a.dosah)) : 0;
    if (p.montaz.pocet > 1 && p.montaz.rozestup < 70) pridej('info', `Při rozestupu ${fmt(p.montaz.rozestup)} mm se dvě bundy na sousedních věšácích budou dotýkat – obvykle se dává 100–150 mm.`, ['montaz.rozestup']);
    if (p.montaz.zed === 'sadrokarton' && p.zatez.kg > 8) pridej('varovani', 'Do sádrokartonu dávejte jen lehčí věci, nebo věšák přišroubujte do profilu (CW) za deskou.', ['montaz.zed']);
    if (ram > 0 && p.montaz.vyska > 0 && p.montaz.vyska < 400) pridej('info', 'Výška montáže pod 40 cm – zkontrolujte, že ji opravdu měříte k spodku věšáku od podlahy.', ['montaz.vyska']);
    const pv = pevnost(p, o), vrut = pv.radky.find(r => r.co === 'Horní vrut ve zdi'), lemy = pv.radky.find(r => r.co.startsWith('Lemy'));
    if (vrut && vrut.k < 2) pridej(vrut.k < 1 ? 'chyba' : 'varovani', `Horní vrut vytahuje ≈ ${fmt(vrut.sila, 0)} N, hmoždinka (zeď: ${o.zed.nazev}) snese orientačně ${fmt(o.zed.tah, 0)} N (bezpečnost × ${fmt(vrut.k, 1)}). Zvyšte úchyt, přidejte vrut nebo zkraťte vyložení.`,
      ['uchyt.vyska', 'uchyt.pocet', 'montaz.zed']);
    if (lemy && lemy.k < 1.5) pridej('varovani', `Lemy kapsy jsou slabé (bezpečnost × ${fmt(lemy.k, 1)}) – rozšiřte tělo nebo zúžte úchyt u zdi.`, ['telo.sirka']);
    if (p.tisk.ks < p.montaz.pocet) pridej('info', `V řadě je ${p.montaz.pocet} věšáků, export obsahuje ${p.tisk.ks} ${p.tisk.ks === 1 ? 'kus' : p.tisk.ks < 5 ? 'kusy' : 'kusů'}.`, ['tisk.ks'],
      { pole: 'tisk.ks', hodnota: p.montaz.pocet, text: `tisknout ${p.montaz.pocet} kusů` });
    if (p.tisk.material === 'PLA' && p.zatez.kg >= 3) pridej('info', 'PLA pod trvalou zátěží pomalu teče – po měsících se rameno může prohnout. Na kabáty raději PETG nebo ASA.', ['tisk.material']);
    return H;
  }

  /** Pevnost celku: řádky tabulky {co, napeti, k, unese, pozn}. */
  function pevnost(p, o) {
    const radky = [], sigma = o.sigma, F = o.F, u = p.uchyt, uch = o.uch;
    o.ramena.forEach((a, i) => {
      radky.push({ co: `Rameno ${i + 1} u kořene`, napeti: a.napeti, k: a.k, unese: a.unese, rameno: true,
        pozn: `poutko visí ${fmt(a.odstup)} mm od zdi, nejslabší řez tl. ${fmt(a.mistoNapeti.t)} mm` });
    });
    o.obrysyRozbor.forEach((a, i) => {
      if (a) radky.push({ co: `Obrys ${p.obrysy[i].nazev || i + 1} u štítku`, napeti: a.napeti, k: a.k, unese: a.unese, rameno: true,
        pozn: `zátěž ${fmt(a.odstup)} mm od zdi, nejslabší řez ${fmt(a.mistoNapeti.t)} mm` });
    });
    // páka celku (všechna ramena a nosné obrysy zatížené): věšák se opře spodkem o zeď, horní část úchytu tahá ze zdi
    const nosne = o.ramena.concat(o.obrysyRozbor.filter(Boolean));
    const odstup = nosne.length ? Math.max(...nosne.map(a => a.odstup)) : p.telo.hloubka;
    const M = F * nosne.reduce((s, a) => s + Math.max(0, a.odstup), 0);
    const tah = M / Math.max(5, uch.vrchKapsy * 0.67);
    // lemy kapsy: dvě boční lišty tloušťky (š. těla − úzká šířka) / 2, nese horní polovina
    const lem = Math.max(0.3, o.kryti.bok + (u.sirka - uch.uzky) / 2 - p.telo.hrana * 0.5);
    const plochaLemu = 2 * lem * u.vyska * 0.5, tau = tah / plochaLemu, tDov = sigma * 0.5;
    const kgNaJednotku = M > 0 ? M / F : 1;      // moment na 1 N zátěže každého ramene
    radky.push({ co: 'Lemy kapsy (rybina)', napeti: tau, k: tDov / tau, unese: tDov / 2 * plochaLemu * Math.max(5, uch.vrchKapsy * 0.67) / kgNaJednotku / 9.81,
      pozn: `tah od zdi ≈ ${fmt(tah, 0)} N, lem ${fmt(lem)} mm` });
    // vruty: otočení kolem spodku věšáku, tah úměrný vzdálenosti od něj, nejvíc nese horní
    const ys = uch.srouby.map(y => y + uch.dole), sum2 = ys.reduce((s, y) => s + y * y, 0);
    const naSroub = M * ys[ys.length - 1] / Math.max(1, sum2), dovSr = o.zed.tah;
    radky.push({ co: 'Horní vrut ve zdi', napeti: null, sila: naSroub, k: naSroub > 1e-9 ? dovSr / naSroub : Infinity,
      unese: dovSr / 2 / Math.max(1e-9, kgNaJednotku * ys[ys.length - 1] / Math.max(1, sum2)) / 9.81,
      pozn: `vytahuje ho ≈ ${fmt(naSroub, 0)} N; ${o.zed.nazev}, ${o.zed.hmozdinka} – orientačně ${fmt(dovSr, 0)} N` });
    return { radky, tah, naSroub, odstup };
  }

  /** Kusovník pro řadu věšáků: [{ks, co, pozn}]. */
  function kusovnik(p, o) {
    const n = p.montaz.pocet, sr = o.uch.sr, z = o.zed;
    const rady = [
      { ks: n, co: 'Věšák (tištěný díl)', pozn: `${MATERIALY[p.tisk.material].nazev}, tisk ${o.orientace === 'zada' ? 'zády dolů' : 'na boku'}` },
      { ks: n, co: 'Úchyt na zeď (tištěný díl)', pozn: 'tisk zadní stranou dolů' },
      { ks: n * p.uchyt.pocet, co: `Vrut se zápustnou hlavou ${fmt(sr.d)} × ${fmt(o.delkaVrutu)} mm`, pozn: `hlava Ø ${fmt(sr.hlava)}; zeď: ${z.nazev}` },
    ];
    if (p.montaz.zed !== 'drevo') rady.push({ ks: n * p.uchyt.pocet, co: `${z.hmozdinka[0].toUpperCase() + z.hmozdinka.slice(1)} pro vrut ${fmt(sr.d)} mm`, pozn: `kotevní hloubka ≥ ${fmt(z.kotva)} mm` });
    return rady;
  }
  /** Vrták pro otvor ve zdi (mm): hmoždinka 6 mm pro vruty do 4 mm, 8 mm pro silnější; dřevo = předvrt 0,6 d. */
  function vrtak(p) {
    const d = SROUBY[p.uchyt.sroub].d;
    if (p.montaz.zed === 'drevo') return Math.round(d * 0.6 * 2) / 2;
    if (p.montaz.zed === 'sadrokarton') return d <= 4 ? 8 : 10;
    return d <= 4 ? 6 : 8;
  }
  /** Polohy vrutů řady na zdi: x od osy prvního věšáku, y od spodku věšáku (po dosednutí). */
  function polohyVrutu(p, o) {
    const out = [];
    for (let i = 0; i < p.montaz.pocet; i++) for (const y of o.uch.srouby) out.push({ x: i * p.montaz.rozestup, y: y + o.uch.dole, i });
    return out;
  }

  /* ---------- náhodné tvary ---------- */
  /** Generátor náhodných čísel se semínkem (mulberry32). */
  function nahoda(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const zaokr = (x, k = 0.5) => Math.round(x / k) * k;
  /** Jedno náhodné rameno daného stylu. */
  function nahodneRameno(rnd, styl, y, maxDel) {
    const m = (a, b) => a + (b - a) * rnd(), cele = (a, b) => Math.round(m(a, b));
    const tl0 = zaokr(m(8, 14)), tl1 = zaokr(m(Math.max(4, tl0 * 0.45), tl0 * 0.9));
    const koule = rnd() < 0.55, r = { y, uhel: 0, tl0, tl1, konec: koule ? 'koule' : 'oble', rKonec: zaokr(tl1 / 2 + m(1, 5)), trasa: [] };
    const T = r.trasa;
    switch (styl) {
      case 'hacek': T.push({ t: 'r', d: cele(12, maxDel * 0.7) }, { t: 'o', r: cele(8, 22), u: cele(110, 200) });
        if (rnd() < 0.3) T.push({ t: 'r', d: cele(3, 12) }); r.uhel = cele(-10, 10); break;
      case 'kolik': r.uhel = cele(8, 40); T.push({ t: 'r', d: cele(25, maxDel) }); r.konec = 'koule'; r.rKonec = zaokr(tl1 / 2 + m(2, 6)); break;
      case 'spirala': T.push({ t: 'r', d: cele(10, maxDel * 0.6) }, { t: 's', r: cele(12, 22), r1: cele(4, 9), u: cele(200, 420) }); r.konec = 'oble'; break;
      case 'roh': r.uhel = cele(-35, -5); T.push({ t: 'o', r: cele(35, 90), u: cele(70, 120) }); r.tl0 = zaokr(m(12, 18)); r.tl1 = zaokr(m(4, 7)); break;
      case 'lomeny': {
        T.push({ t: 'r', d: cele(15, maxDel * 0.6) });
        const n = cele(1, 3);
        for (let i = 0; i < n; i++) T.push({ t: 'z', u: cele(25, 70) }, { t: 'r', d: cele(5, 18) });
        r.tl1 = r.tl0; break;
      }
      case 'vlna': r.uhel = cele(-30, 0); T.push({ t: 'o', r: cele(14, 28), u: cele(30, 60) }, { t: 'o', r: cele(12, 24), u: -cele(40, 80) }, { t: 'o', r: cele(8, 16), u: cele(120, 200) }); break;
      case 'blok': {
        const h0 = zaokr(m(8, 30)), sk = cele(-2, 14), zub = rnd() < 0.4 ? cele(3, 8) : 0;
        return { druh: 'blok', y, uhel: 0, delka: cele(16, Math.max(20, maxDel * 0.8)), h0, h1: zaokr(m(Math.max(5, h0 * 0.4), h0)), sklon: sk, zub, zubTl: cele(3, 6), zaobleni: zaokr(m(0.5, 3)) };
      }
      case 'hrib': {
        const tl = zaokr(m(7, 12)), sym = rnd() < 0.5, nah = cele(5, 15);
        return { druh: 'hrib', y, uhel: cele(0, 20), delka: cele(22, Math.max(26, maxDel * 0.8)), tl, nahoru: nah, dolu: sym ? nah : cele(0, 8), hlavaTl: cele(4, 9) };
      }
      default: {   // volný: 2–5 náhodných úseků
        r.uhel = cele(-25, 30);
        const n = cele(2, 5);
        for (let i = 0; i < n; i++) {
          const x = rnd();
          if (x < 0.35) T.push({ t: 'r', d: cele(5, 30) });
          else if (x < 0.75) T.push({ t: 'o', r: cele(6, 30), u: cele(-90, 160) });
          else if (x < 0.88) T.push({ t: 's', r: cele(10, 20), r1: cele(4, 9), u: cele(150, 360) });
          else T.push({ t: 'z', u: cele(-40, 70) });
        }
      }
    }
    return r;
  }
  const STYLY = ['hacek', 'hacek', 'kolik', 'spirala', 'roh', 'lomeny', 'vlna', 'volny', 'volny', 'blok', 'blok', 'hrib', 'hrib'];
  /** Leží kořeny všech ramen na štítku? */
  const vahaKoren = (p, o) => p.ramena.every(r => veStitku([r.x || 0, r.y], o.kryti.mn));
  /** Je náhodný tvar k něčemu? Drží, nesahá do zdi, nese aspoň 1,5× zátěž, rozumné rozměry a otvor. */
  function vyhovuje(p, o) {
    if (!o.ramena.length) return false;
    for (const a of o.ramena) {
      if (!a.drzi || a.zMin < 2 || a.k < 1.5 || a.dosah > 140 || a.dosah < p.telo.hloubka + 15) return false;
      if (!vahaKoren(p, o)) return false;
      if (Number.isFinite(a.otvor) && a.otvor < 9) return false;
      if (a.yMin < -60 || a.yMax > p.telo.vyska + 60) return false;
    }
    return true;
  }
  /** Nová ramena náhodného tvaru (tělo a úchyt zůstanou). Vrací {p, pokusu}. */
  function nahodnyTvar(p, seed) {
    const rnd = nahoda(seed), zaklad = kopie(p);
    for (let pokus = 1; pokus <= 400; pokus++) {
      const q = kopie(zaklad), x = rnd(), n = x < 0.6 ? 1 : x < 0.93 ? 2 : 3, H = q.telo.vyska;
      q.ramena = [];
      const styl = STYLY[Math.floor(rnd() * STYLY.length)];
      for (let i = 0; i < n; i++) {
        // ramena rozložená po výšce těla, horní kratší
        const y = zaokr(n === 1 ? H * (0.45 + 0.25 * rnd()) : H * (0.2 + 0.65 * i / (n - 1)) + (rnd() - 0.5) * 6);
        q.ramena.push(nahodneRameno(rnd, i === 0 || rnd() < 0.5 ? styl : STYLY[Math.floor(rnd() * STYLY.length)], Math.min(H - 5, Math.max(5, y)), i === 0 ? 60 : 40 - 8 * i));
      }
      const r = normalizuj(q).p;
      if (vyhovuje(r, odvozene(r))) return { p: r, pokusu: pokus };
    }
    return { p: kopie(zaklad), pokusu: 0 };
  }
  /** Obměna: všechna čísla ramen o ±20 %, úhly o ±15°. */
  function obmena(p, seed) {
    const rnd = nahoda(seed);
    for (let pokus = 1; pokus <= 300; pokus++) {
      const q = kopie(p), f = () => 0.8 + 0.4 * rnd(), d = () => (rnd() - 0.5) * 30;
      for (const r of q.ramena) {
        r.uhel = Math.round(r.uhel + d() * 0.6); r.tl0 = zaokr(r.tl0 * f()); r.tl1 = zaokr(Math.min(r.tl0, r.tl1 * f())); r.rKonec = zaokr(r.rKonec * f());
        for (const kl of ['delka', 'h0', 'h1', 'tl', 'nahoru', 'dolu', 'hlavaTl']) if (r[kl] != null) r[kl] = zaokr(r[kl] * f());
        if (r.sklon != null) r.sklon = Math.round(r.sklon + d() * 0.3);
        for (const g of r.trasa) {
          if (g.d != null) g.d = Math.round(g.d * f());
          if (g.r != null) g.r = Math.round(g.r * f());
          if (g.r1 != null) g.r1 = Math.round(g.r1 * f());
          if (g.u != null) g.u = Math.round(g.u + d());
        }
      }
      const r = normalizuj(q).p;
      if (vyhovuje(r, odvozene(r))) return { p: r, pokusu: pokus };
    }
    return { p: kopie(p), pokusu: 0 };
  }

  /* ---------- tisk ---------- */
  /** Převisy ve tiskové poloze; schůdky zkosené hrany u podložky (45°) se za převis nepočítají. */
  function previsyDilu(sit, R, p, hranaDole) {
    const poloha = tiskovaPoloha(sit, R), pv = previsy(poloha.poz, sit.idx, p.tisk.previs), P = poloha.poz, I = sit.idx;
    let volne = 0, most = 0;
    for (let t = 0; t < I.length / 3; t++) {
      const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
      if (pv.tridy[t] === 2 && hranaDole > 0 && Math.max(P[a + 2], P[b + 2], P[c + 2]) <= hranaDole + 0.02) { pv.tridy[t] = 0; continue; }
      const A = V.len(V.cross(V.sub([P[b], P[b + 1], P[b + 2]], [P[a], P[a + 1], P[a + 2]]), V.sub([P[c], P[c + 1], P[c + 2]], [P[a], P[a + 1], P[a + 2]]))) / 2;
      if (pv.tridy[t] === 2) volne += A; else if (pv.tridy[t] === 1) most += A;
    }
    return { poz: poloha.poz, tridy: pv.tridy, volne, most, vyska: pv.vyska };
  }

  /* ---------- projekt ---------- */
  function ulozProjekt(p) {
    return JSON.stringify({ format: 'webapp_vesaky', verze: VERZE_FORMATU, ulozeno: new Date().toISOString(), projekt: p }, null, 2);
  }
  function nactiProjekt(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
    if (!o || typeof o !== 'object') throw new Error('Soubor neobsahuje projekt.');
    if (o.format !== 'webapp_vesaky') throw new Error('Soubor není projekt věšáku (chybí "format": "webapp_vesaky").');
    if (!(o.verze >= 1) || o.verze > VERZE_FORMATU) throw new Error(`Nepodporovaná verze projektu ${o.verze}.`);
    return normalizuj(o.projekt);
  }
  function popis(p) {
    const n = p.ramena.length;
    const b = obalObrysu(stitekObrysy(p).filter(o => !o.dira));
    return `${n} ramen${n === 1 ? 'o' : n > 1 && n < 5 ? 'a' : ''}, štítek ${TVARY_STITKU[p.telo.tvar].nazev.toLowerCase()} ${fmt(b[2] - b[0])} × ${fmt(b[3] - b[1])} mm, ${PROFILY_UCHYTU[p.uchyt.profil].nazev.toLowerCase()}, ${SROUBY[p.uchyt.sroub].nazev} × ${p.uchyt.pocet}`;
  }

  const API = {
    VERZE_FORMATU, SROUBY, MATERIALY, ZDI, DRUHY_RAMEN, SKUPINY_PREDVOLEB, polygonyRamene, rozborPolygonu, intervalyY, TVARY_STITKU, ORIENTACE, stitekObrysy, nejmensiStitek, autoVyskaUchytu, minVyskaUchytu, krytiKapsy, veStitku, uvnitrMn, zaoblenyMnohouhelnik, doObalu, sirkaRamen, DELKY_VRUTU, DATUM_DAT, PROFILY_UCHYTU, DRUHY_SEGMENTU, KONCE, HRANY, VYCHOZI, VYCHOZI_RAMENO, VYCHOZI_SEGMENT, ROZSAHY, ROZSAHY_RAMENE,
    ROZSAHY_SEGMENTU, MAX_RAMEN, MAX_SEGMENTU, MAX_OBRYSU, MAX_BODU, normalizujObrysy, usek, obrysNaBody, zjednodus, zjednodusUzavreny, kruhObrys, ramenoNaObrys, importSvg, obalObrysu, PREDVOLBY, PRESAH, V, kopie, cislo, fmt, vezmi, poloz, normalizuj, zPredvolby, pater, polomerKonce,
    rozborRamene, kusovnik, polohyVrutu, vrtak, prurezUchytu, uchytRozmery, odvozene, kontroly, pevnost, nahoda, nahodnyTvar, obmena, vyhovuje, previsyDilu, rotaceDolu,
    odhadTisku: SP.odhadTisku, ulozProjekt, nactiProjekt, popis,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.VESAKY = API;
})();

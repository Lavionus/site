/* Dopravní magnát – data hry (bez logiky).
   Terén, náklady, průmysl, druhy domů, slabiky jmen měst, volby nové mapy.
   Plán: docs/plany/Magnat_PLAN.md */
(function (MAG) {
  'use strict';

  // druhy povrchu pole (MAG.mapa.typ[i])
  const T = { TRAVA: 0, VODA: 1, PISEK: 2, SKALA: 3, SNIH: 4, POLE: 5 };

  // povrch → barva dočasné grafiky (kreslí kód, než přijdou atlasy)
  const BARVY_TERENU = {
    [T.TRAVA]: [104, 160, 76],
    [T.VODA]: [52, 112, 178],
    [T.PISEK]: [214, 196, 132],
    [T.SKALA]: [138, 132, 124],
    [T.SNIH]: [236, 240, 244],
    [T.POLE]: [190, 170, 86],
  };

  /* náklady: cena = $ za 1 jednotku na 1 pole vzdálenosti při rychlém doručení;
     dny1 = kolik dní cesty náklad snese bez srážky, dny2 = jak rychle pak cena klesá (viz MAG.hra.platba) */
  const NAKLADY = [
    { id: 'lide', nazev: 'Cestující', ikona: '🧑', barva: '#5dade2', cena: 0.45, dny1: 0, dny2: 24 },
    { id: 'posta', nazev: 'Pošta', ikona: '✉️', barva: '#f4f1e8', cena: 0.62, dny1: 20, dny2: 90 },
    { id: 'uhli', nazev: 'Uhlí', ikona: '⚫', barva: '#2b2b2b', cena: 0.4, dny1: 7, dny2: 255 },
    { id: 'drevo', nazev: 'Dřevo', ikona: '🪵', barva: '#8a5a2b', cena: 0.34, dny1: 15, dny2: 255 },
    { id: 'ruda', nazev: 'Železná ruda', ikona: '🪨', barva: '#9b5d4a', cena: 0.36, dny1: 9, dny2: 255 },
    { id: 'ocel', nazev: 'Ocel', ikona: '🔩', barva: '#9aa4ad', cena: 0.48, dny1: 7, dny2: 255 },
    { id: 'obili', nazev: 'Obilí', ikona: '🌾', barva: '#e2c35a', cena: 0.38, dny1: 4, dny2: 40 },
    { id: 'dobytek', nazev: 'Dobytek', ikona: '🐄', barva: '#c9a27a', cena: 0.44, dny1: 4, dny2: 18 },
    { id: 'potraviny', nazev: 'Potraviny', ikona: '🥫', barva: '#e07a5f', cena: 0.55, dny1: 0, dny2: 30 },
    { id: 'ropa', nazev: 'Ropa', ikona: '🛢️', barva: '#3d3d46', cena: 0.37, dny1: 25, dny2: 255 },
    { id: 'palivo', nazev: 'Pohonné hmoty', ikona: '⛽', barva: '#d9a441', cena: 0.45, dny1: 25, dny2: 255 },
    { id: 'stavebniny', nazev: 'Stavebniny', ikona: '🧱', barva: '#b5651d', cena: 0.42, dny1: 15, dny2: 255 },
    { id: 'zbozi', nazev: 'Zboží', ikona: '📦', barva: '#c38d5e', cena: 0.6, dny1: 5, dny2: 28 },
    { id: 'voda', nazev: 'Voda', ikona: '💧', barva: '#4aa3df', cena: 0.42, dny1: 12, dny2: 80 },   // jen pro velká města (od 3 000 obyvatel)
  ];

  /* Průmysl. rozmer = [š, h] v polích; vyroba = co produkuje (za měsíc při 100 %), prijima = co bere.
     misto: 'kopce' (vysoko), 'les' (v lese), 'rovina', 'pobrezi' (u moře), 'mesto' (blízko města), 'kdekoli'.
     barva + vyska = dočasná grafika (krabice). */
  const PRUMYSL = [
    { id: 'dul', nazev: 'Uhelný důl', ikona: '⛏️', rozmer: [3, 3], vyroba: { uhli: 120 }, prijima: [], misto: 'kopce', barva: '#4a4a52', vyska: 14 },
    { id: 'elektrarna', nazev: 'Elektrárna', ikona: '⚡', rozmer: [3, 3], vyroba: {}, prijima: ['uhli'], misto: 'kdekoli', barva: '#8f9aa6', vyska: 26, komin: true },
    { id: 'tezba', nazev: 'Lesní těžba', ikona: '🌲', rozmer: [3, 3], vyroba: { drevo: 70 }, prijima: [], misto: 'les', barva: '#6b4a2a', vyska: 8 },
    { id: 'pila', nazev: 'Pila', ikona: '🪚', rozmer: [3, 2], vyroba: { stavebniny: 0 }, prijima: ['drevo'], misto: 'kdekoli', barva: '#a0703c', vyska: 12 },
    { id: 'rudnydul', nazev: 'Rudný důl', ikona: '🪨', rozmer: [3, 3], vyroba: { ruda: 80 }, prijima: [], misto: 'kopce', barva: '#7a4b3d', vyska: 14 },
    { id: 'ocelarna', nazev: 'Ocelárna', ikona: '🏭', rozmer: [4, 3], vyroba: { ocel: 0 }, prijima: ['ruda', 'uhli'], misto: 'kdekoli', barva: '#5c5f66', vyska: 22, komin: true },
    { id: 'tovarna', nazev: 'Továrna', ikona: '🏭', rozmer: [3, 3], vyroba: { zbozi: 0 }, prijima: ['ocel', 'stavebniny', 'dobytek'], misto: 'mesto', barva: '#9c6b4f', vyska: 18, komin: true },
    { id: 'farma', nazev: 'Farma', ikona: '🌾', rozmer: [3, 3], vyroba: { obili: 60, dobytek: 40 }, prijima: [], misto: 'rovina', barva: '#b3563b', vyska: 10, pole: true },
    { id: 'potravinarna', nazev: 'Potravinárna', ikona: '🥫', rozmer: [3, 2], vyroba: { potraviny: 0 }, prijima: ['obili', 'dobytek'], misto: 'mesto', barva: '#d08c5b', vyska: 14 },
    { id: 'vrt', nazev: 'Ropný vrt', ikona: '🛢️', rozmer: [2, 2], vyroba: { ropa: 70 }, prijima: [], misto: 'rovina', barva: '#38383f', vyska: 20 },
    { id: 'vodarna', nazev: 'Vodárna', ikona: '🚰', rozmer: [3, 3], vyroba: { voda: 90 }, prijima: [], misto: 'voda', barva: '#5d8aa8', vyska: 16 },
    { id: 'rafinerie', nazev: 'Rafinerie', ikona: '⚗️', rozmer: [4, 4], vyroba: { palivo: 0 }, prijima: ['ropa'], misto: 'pobrezi', barva: '#b8bcc2', vyska: 20, komin: true },
  ];
  const PRUMYSL_PODLE_ID = Object.fromEntries(PRUMYSL.map(p => [p.id, p]));

  // řetězce: kdo bez koho nedává smysl (generátor hlídá, že na mapě je i odběratel)
  const RETEZCE = [
    ['dul', 'elektrarna'], ['tezba', 'pila'], ['rudnydul', 'ocelarna'], ['farma', 'potravinarna'], ['vrt', 'rafinerie'],
  ];

  // domy podle velikosti (obyvatel), dočasná grafika = krabice se střechou
  const DOMY = [
    { id: 'chalupa', obyv: [6, 14], patra: 1, barvy: ['#e8dcc4', '#d9c7a3', '#f0e6d2'], strecha: ['#a8442e', '#8c3b2a', '#6e5848'] },
    { id: 'dum', obyv: [16, 30], patra: 2, barvy: ['#e3d6b8', '#cfc2a8', '#eadfca', '#d8c8b0'], strecha: ['#9c3d2a', '#5b5f66', '#7b4b36'] },
    { id: 'cinzak', obyv: [40, 80], patra: 4, barvy: ['#c9b79a', '#b8aa90', '#d6c8ad'], strecha: ['#5b5f66', '#6d6f73'] },
    { id: 'kostel', obyv: [0, 0], patra: 3, barvy: ['#ece6da'], strecha: ['#4a6b5c'], vez: true },
  ];

  // jména měst: neutrální slabiky (čtou se v češtině i angličtině)
  const SLABIKY = {
    zac: ['Al', 'Bel', 'Bran', 'Cal', 'Cor', 'Dal', 'Dor', 'El', 'Fen', 'Gal', 'Hal', 'Ister', 'Kar', 'Kel', 'Lor', 'Mar',
      'Mir', 'Nor', 'Os', 'Pel', 'Ros', 'Sal', 'Sten', 'Tal', 'Tor', 'Val', 'Ven', 'Ard', 'Bar', 'Lun', 'Mel', 'Riv', 'Sol', 'Tren', 'Ul', 'Var'],
    stred: ['', '', '', 'a', 'e', 'i', 'o', 'an', 'en', 'in', 'ar', 'or', 'il'],
    kon: ['ford', 'ton', 'burg', 'mont', 'dale', 'vik', 'heim', 'stad', 'port', 'holm', 'ville', 'brook', 'gard', 'mar', 'sund',
      'berg', 'field', 'haven', 'wick', 'rode', 'mund', 'by', 'ria', 'ona', 'ava'],
  };

  // volby nové mapy
  const VELIKOSTI = [64, 128, 256];
  const POCET_MEST = { // [málo, středně, hodně] podle velikosti
    64: [4, 6, 9], 128: [10, 16, 24], 256: [28, 44, 64],
  };
  const POCET_PRUMYSLU = { 64: [8, 11, 14], 128: [22, 32, 44], 256: [70, 100, 130] };
  const KRAJINA = { // výškový rozsah a strmost
    rovina: { max: 5, mocnina: 1.6, meritko: 0.9 },
    kopce: { max: 9, mocnina: 1.25, meritko: 1 },
    hory: { max: 14, mocnina: 1.0, meritko: 1.2 },
  };
  const VODA = { malo: 0.1, stredne: 0.24, hodne: 0.4 }; // podíl moře (kvantil výšek)
  const MAX_VYSKA = 15;

  /* Vozidla (fiktivní). druh: 'bus' = autobus (cestující, staví na zastávce autobusu),
     'nakl' = nákladní auto / poštovní vůz (staví na nákladním stanovišti).
     rychlost km/h, cena $, provoz $/rok, zivot roky, od–do = roky výroby. */
  const VOZIDLA = [];
  const rada = (zaklad, druh, naklady, ikona, gen) => gen.forEach(([nazev, od, do_, rychlost, kapacita, cena, provoz, zivot]) =>
    VOZIDLA.push({ id: (zaklad + '_' + nazev).replace(/\W+/g, '_').toLowerCase(), nazev, druh, naklady, ikona, od, do: do_, rychlost, kapacita, cena, provoz, zivot }));
  rada('bus', 'bus', ['lide'], '🚌', [
    ['Arbor 20', 1920, 1962, 44, 24, 6200, 900, 12],
    ['Merle 31', 1946, 1990, 64, 31, 8800, 1100, 15],
    ['Corvo 40', 1972, 2016, 88, 38, 12400, 1400, 15],
    ['Vela L', 1998, 9999, 112, 45, 17500, 1700, 15],
    ['Elektra E', 2024, 9999, 124, 50, 24000, 1300, 18],
  ]);
  // tramvaje: osobní silniční vozidla, jezdí jen po tramvajové koleji v silnici (m.tram), staví na zastávkách autobusu
  rada('tram', 'bus', ['lide'], '🚋', [
    ['Kolibri T1', 1920, 1965, 40, 60, 9800, 1100, 25],
    ['Strela T3', 1955, 2008, 62, 95, 15500, 1500, 25],
    ['Nova 3', 1996, 9999, 72, 160, 29000, 2100, 28],
  ]);
  for (const t of VOZIDLA) if (t.id.startsWith('tram_')) t.tram = true;
  rada('posta', 'nakl', ['posta'], '📮', [
    ['Kurýr P1', 1920, 1966, 48, 20, 5400, 800, 12],
    ['Kurýr P2', 1952, 2000, 72, 28, 8200, 1000, 15],
    ['Kurýr P3', 1986, 9999, 104, 36, 12600, 1300, 15],
  ]);
  const NAKL = [
    ['sypky', ['uhli', 'ruda', 'obili'], '🚚', 'Titan K'],
    ['les', ['drevo'], '🚛', 'Lesák'],
    ['dobytek', ['dobytek'], '🚚', 'Stádník'],
    ['cisterna', ['ropa', 'palivo', 'voda'], '🚛', 'Cisterna C'],
    ['skrin', ['zbozi', 'potraviny', 'ocel', 'stavebniny'], '🚚', 'Skříňák S'],
  ];
  for (const [id, nak, ik, jm] of NAKL) rada(id, 'nakl', nak, ik, [
    [jm + '1', 1920, 1964, 40, 20, 6800, 1000, 12],
    [jm + '2', 1950, 1994, 64, 25, 9600, 1200, 15],
    [jm + '3', 1982, 2026, 96, 30, 13800, 1500, 15],
    [jm + '4', 2012, 9999, 112, 36, 19500, 1800, 15],
  ]);
  /* Lokomotivy (druh 'vlak'): vykon kW, hmotnost t. Elektrické přijdou s elektrizací tratí. */
  for (const [nazev, trakce, od, do_, rychlost, vykon, hmotnost, cena, provoz, zivot] of [
    ['Pára P8', 'para', 1920, 1962, 90, 1100, 80, 22000, 3200, 20],
    ['Pára Atlas', 'para', 1934, 1975, 110, 1800, 110, 31000, 3800, 20],
    ['Diesel D2', 'diesel', 1955, 2002, 120, 1600, 85, 36000, 3000, 25],
    ['Diesel Taurus', 'diesel', 1984, 9999, 150, 2400, 90, 52000, 3400, 25],
    ['Rychlík R9', 'diesel', 2005, 9999, 180, 3200, 85, 78000, 4200, 25],
    // elektrické: jen po elektrizované trati (trolej); Rapid na plnou rychlost potřebuje rychlostní kolej
    ['Elektra E1', 'elektro', 1950, 1990, 130, 2200, 80, 45000, 3000, 25],
    ['Elektra E3', 'elektro', 1975, 9999, 160, 3600, 85, 62000, 3300, 25],
    ['Rapid V', 'elektro', 1990, 2025, 300, 8000, 120, 140000, 8500, 25],
    ['Rapid V2', 'elektro', 2015, 9999, 320, 9500, 115, 175000, 9000, 25],
  ]) VOZIDLA.push({ id: 'lok_' + nazev.replace(/\W+/g, '_').toLowerCase(), nazev, druh: 'vlak', trakce, naklady: [], ikona: '🚂', od, do: do_, rychlost, vykon, hmotnost, kapacita: 0, cena, provoz, zivot });
  /* Lodě (druh 'lod'): kotví u přístavu, kupují se v loděnici. Letadla (druh 'let'): cestující + pošta, kupují se na letišti. */
  const lodRada = (zaklad, naklady, ikona, gen) => gen.forEach(([nazev, od, do_, rychlost, kapacita, cena, provoz, zivot]) =>
    VOZIDLA.push({ id: 'lod_' + zaklad + '_' + (gen.indexOf(gen.find(g => g[0] === nazev)) + 1), nazev, druh: 'lod', naklady, ikona, od, do: do_, rychlost, kapacita, cena, provoz, zivot }));
  lodRada('trajekt', ['lide'], '⛴️', [['Racek', 1920, 1975, 30, 120, 16000, 2200, 25], ['Delfín', 1965, 9999, 45, 220, 30000, 3200, 25]]);
  lodRada('sypka', ['uhli', 'ruda', 'obili'], '🚢', [['Baltika', 1920, 1980, 24, 220, 18000, 2000, 30], ['Baltika II', 1970, 9999, 34, 380, 32000, 2800, 30]]);
  lodRada('tanker', ['ropa', 'palivo', 'voda'], '🛳️', [['Petrol T', 1925, 1985, 24, 260, 21000, 2300, 30], ['Petrol T2', 1975, 9999, 34, 460, 38000, 3100, 30]]);
  lodRada('kargo', ['zbozi', 'potraviny', 'stavebniny', 'ocel', 'drevo'], '🚢', [['Kargo', 1930, 1990, 26, 180, 20000, 2200, 30], ['Kargo M', 1980, 9999, 38, 320, 36000, 3000, 30]]);
  for (const [nazev, od, do_, rychlost, lide, posta, cena, provoz, zivot] of [
    ['Albatros A1', 1925, 1962, 220, 20, 6, 30000, 4200, 20],
    ['Condor C4', 1948, 1985, 380, 44, 12, 52000, 6000, 20],
    ['Jetstar J2', 1964, 2010, 820, 90, 20, 98000, 9500, 22],
    ['Skybus S3', 1992, 9999, 880, 150, 30, 150000, 12500, 25],
    ['Rotor H1', 1955, 1998, 180, 8, 3, 21000, 3600, 18],
    ['Rotor H2', 1985, 9999, 260, 14, 5, 36000, 4800, 20],
  ]) VOZIDLA.push({ id: 'let_' + nazev.replace(/\W+/g, '_').toLowerCase(), nazev, druh: 'let', naklady: ['lide', 'posta'], ikona: nazev.startsWith('Rotor') ? '🚁' : '✈️', od, do: do_, rychlost, kapacita: lide, kapacitaPosta: posta, cena, provoz, zivot,
    ...(nazev.startsWith('Rotor') ? { vrtulnik: true } : {}), ...(/Jetstar|Skybus/.test(nazev) ? { velke: true } : {}) });
  /* Barva typu: silniční vozidla jiného druhu než autobus mají vlastní barvu karoserie (na mapě se jinak pletou);
     autobusy, vlaky, lodě a letadla nesou barvu firmy. */
  const BARVY_TYPU = { tram: '#1f9e8f', posta: '#f2c12e', sypky: '#e07b22', les: '#3f8a3a', dobytek: '#8a5a2b', cisterna: '#2f6fb3', skrin: '#7b4fb0' };
  for (const v of VOZIDLA) { const r = v.id.split('_')[0]; if (BARVY_TYPU[r]) v.barvaTypu = BARVY_TYPU[r]; }
  const VOZIDLA_PODLE_ID = Object.fromEntries(VOZIDLA.map(v => [v.id, v]));

  /* Vagony: kapacita jednotek, hmotnost prázdného t, tun na jednotku nákladu. */
  const VAGONY = [
    { id: 'osobni', nazev: 'Osobní vůz', naklady: ['lide'], kapacita: 40, hmotnost: 24, naJednotku: 0.08, rychlost: 140, cena: 3200, od: 1920, barva: '#3c6e4f' },
    { id: 'osobni2', nazev: 'Osobní vůz moderní', naklady: ['lide'], kapacita: 60, hmotnost: 30, naJednotku: 0.08, rychlost: 200, cena: 5200, od: 1975, barva: '#2d5d8a' },
    { id: 'rychly', nazev: 'Rychlíkový vůz', naklady: ['lide'], kapacita: 70, hmotnost: 40, naJednotku: 0.08, rychlost: 320, cena: 9500, od: 1990, barva: '#d9dde2' },
    { id: 'posta', nazev: 'Poštovní vůz', naklady: ['posta'], kapacita: 35, hmotnost: 20, naJednotku: 0.1, rychlost: 160, cena: 3000, od: 1920, barva: '#b8a94c' },
    { id: 'vysypny', nazev: 'Výsypný vůz', naklady: ['uhli', 'ruda', 'obili'], kapacita: 30, hmotnost: 14, naJednotku: 1, rychlost: 110, cena: 2400, od: 1920, barva: '#4a4a4a' },
    { id: 'kryty', nazev: 'Krytý vůz', naklady: ['zbozi', 'potraviny', 'stavebniny', 'ocel'], kapacita: 25, hmotnost: 16, naJednotku: 1, rychlost: 120, cena: 2800, od: 1920, barva: '#8a5a3a' },
    { id: 'cisterna', nazev: 'Cisternový vůz', naklady: ['ropa', 'palivo', 'voda'], kapacita: 28, hmotnost: 15, naJednotku: 1, rychlost: 110, cena: 3000, od: 1920, barva: '#2c2c32' },
    { id: 'klanicak', nazev: 'Klanicový vůz', naklady: ['drevo'], kapacita: 28, hmotnost: 13, naJednotku: 1, rychlost: 110, cena: 2300, od: 1920, barva: '#7a5530' },
    { id: 'dobytci', nazev: 'Dobytčí vůz', naklady: ['dobytek'], kapacita: 20, hmotnost: 15, naJednotku: 1, rychlost: 110, cena: 2600, od: 1920, barva: '#a07850' },
  ];
  const VAGONY_PODLE_ID = Object.fromEntries(VAGONY.map(v => [v.id, v]));

  // ceny staveb ($)
  const CENY = {
    silnice: 220, svah: 180, kaceni: 45,          // za pole; svah = pole s nestejnými rohy; kácení za každý strom (hustota 1–3)
    zastavka: 650, stanoviste: 800, garaz: 1600,
    kolej: 320, most: 1100, nastupiste: 950, depo: 2600, MAX_MOST: 8, navest: 350,
    pristav: 2200, lodenice: 3500, letiste: 18000,
    trolej: 160, vrt: 900, tunel: 1400, tram: 140, teren: 90, MAX_VYSKA: 15, podnik: { dul: 60000, elektrarna: 150000, tezba: 30000, pila: 70000, rudnydul: 70000, ocelarna: 200000, tovarna: 160000, farma: 40000, potravinarna: 110000, vrt: 80000, rafinerie: 220000, vodarna: 90000 }, boje: 600, zdymadlo: 4500, RYCHLOST_KOLEJ: 160, RYCHLOST_VRT: 320, ROK_VRT: 1985,
    demolice: 60,
  };
  const DEN_TICKU = 74;              // ticků na herní den
  const TICKU_ZA_S = 30;             // při rychlosti 1×
  const DOSAH_ZASTAVKY = 3;          // spádová oblast (pole kolem zastávky)
  const DOSAH_NADRAZI = 4;           // spádová oblast nádraží
  const ZACATECNI_ROKY = [1920, 1950, 1980, 2010];
  const BARVY_FIRMY = ['#d8442c', '#2f6fd0', '#2e9e55', '#e0a020', '#8e44ad', '#16a2a8', '#d35f9a', '#5b6470'];

  MAG.data = {
    T, BARVY_TERENU, NAKLADY, PRUMYSL, PRUMYSL_PODLE_ID, RETEZCE, DOMY, SLABIKY,
    VELIKOSTI, POCET_MEST, POCET_PRUMYSLU, KRAJINA, VODA, MAX_VYSKA,
    VOZIDLA, VOZIDLA_PODLE_ID, CENY, DEN_TICKU, DOSAH_NADRAZI, VAGONY, VAGONY_PODLE_ID, TICKU_ZA_S, DOSAH_ZASTAVKY, ZACATECNI_ROKY, BARVY_FIRMY,
    NAKLADY_PODLE_ID: Object.fromEntries(NAKLADY.map(n => [n.id, n])),
  };
})(globalThis.MAG = globalThis.MAG || {});

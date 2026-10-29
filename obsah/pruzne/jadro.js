/* ============================================================
   pruzne/jadro.js – výpočetní jádro generátoru pružných mechanismů (bez DOM).
   Materiály, parametry a jejich normalizace, nosníková teorie (přetvoření,
   tuhost, síla), energetický model bistabilního nosníku, kontroly pro FDM
   a „plán“ geometrie: díly jako sjednocení hranolů (vysunutých 2D polygonů)
   minus odečtené hranoly. Hranoly na síť spojí pruzne/geometrie.js přes
   manifold-3d. Jednotky: mm, N, MPa, N·mm; úhly v rozhraní ve stupních.
   Souřadnice plánu: rovina mechanismu = XY, výška tisku = Z (z ≥ 0).
   ============================================================ */
(function () {
  'use strict';
  const PI = Math.PI, RAD = PI / 180;

  /* ---------- materiály (ručně stárnoucí data) ----------
     Orientační hodnoty pro výtisky FDM ve směru vláken, sestavené z technických
     listů běžných filamentů a z literatury o pružných spojích (stav 10/2026).
     E = modul pružnosti [MPa], epsKr = dovolené krátkodobé přetvoření (jednorázové
     nebo občasné ohnutí, zacvaknutí), epsOpak = mez pro opakovaný ohyb (pant, pružina),
     mu = součinitel tření plast–plast, hustota [g/cm³]. Výtisk bývá o 20–50 % slabší
     než vstřikovaný díl, mezi vrstvami výrazně méně. */
  const DATUM_DAT = '10/2026';
  const MATERIALY = {
    PLA:  { nazev: 'PLA', E: 3300, epsKr: 0.025, epsOpak: 0.005, mu: 0.35, hustota: 1.24, cykly: 'velmi špatná únava – opakovaný ohyb vydrží jednotky až desítky cyklů' },
    PETG: { nazev: 'PETG', E: 2000, epsKr: 0.040, epsOpak: 0.015, mu: 0.30, hustota: 1.27, cykly: 'střední – stovky až tisíce cyklů při malém přetvoření' },
    ABS:  { nazev: 'ABS / ASA', E: 2000, epsKr: 0.030, epsOpak: 0.010, mu: 0.30, hustota: 1.05, cykly: 'střední – stovky cyklů' },
    PA:   { nazev: 'PA (nylon)', E: 1500, epsKr: 0.060, epsOpak: 0.030, mu: 0.25, hustota: 1.14, cykly: 'dobrá – tisíce cyklů (vlastnosti závisí na vlhkosti)' },
    PP:   { nazev: 'PP', E: 1200, epsKr: 0.150, epsOpak: 0.100, mu: 0.25, hustota: 0.90, cykly: 'výborná – klasický materiál filmových pantů, desetitisíce cyklů i víc' },
    TPU:  { nazev: 'TPU 95A', E: 26, epsKr: 0.50, epsOpak: 0.30, mu: 0.60, hustota: 1.21, cykly: 'výborná, ale díl je velmi měkký (síly jsou malé)' },
  };

  const TYPY = {
    pant:     { nazev: 'Živý pant', znak: '⌒', popis: 'Tenký ohybový pás mezi dvěma deskami – zkušební kus nebo krabička s víčkem na pantu.' },
    bistabil: { nazev: 'Bistabilní přepínač', znak: '⇅', popis: 'Dvojice předtvarovaných nosníků (kosinový oblouk) s jezdcem – dvě stabilní polohy, přeskok s cvaknutím.' },
    spona:    { nazev: 'Pružná spona', znak: '⇥', popis: 'Šipková spona se dvěma konzolovými rameny a háčky (snap-fit) a zkušební protikus s oknem.' },
    pruzina:  { nazev: 'Plastová pružina', znak: '≋', popis: 'Plochá hadovitá (cik-cak) pružina s patkami, nebo plochá spirálová pružina s nábojem.' },
    kriz:     { nazev: 'Křížový kloub', znak: '✕', popis: 'Ohybový kloub ze dvou křížených pásů – volné křížení ve dvou patrech, nebo „kolo“ spojené uprostřed.' },
    paral:    { nazev: 'Paralelogram', znak: '▱', popis: 'Paralelogramové vedení: dva rovnoběžné pásy, deska se posouvá bez natáčení.' },
  };
  const ORIENTACE = {
    naplocho: 'Naplocho – rovina mechanismu na podložce',
    nabok: 'Na bok – rovina mechanismu svisle, pásy vodorovně',
    nastojato: 'Nastojato – pásy svisle (osa X nahoru)',
  };

  /* ---------- parametry ----------
     typy: u kterých mechanismů se pole ukazuje; kdy(p): další podmínka (varianta). */
  const VSE = Object.keys(TYPY);
  const volbyMat = Object.keys(MATERIALY).map(k => [k, MATERIALY[k].nazev]);
  const PARAMETRY = [
    // živý pant
    { klic: 'pVarianta', nazev: 'Varianta', typ: 'vyber', v: 'zkusebni', volby: [['zkusebni', 'Zkušební pant (dvě desky)'], ['krabicka', 'Krabička s víčkem na pantu']], skupina: 'Pant', typy: ['pant'] },
    { klic: 'pTvar', nazev: 'Tvar přechodu', typ: 'vyber', v: 'radius', volby: [['radius', 'S rádiusem (doporučeno)'], ['rovny', 'Rovný (ostré rohy)']], skupina: 'Pant', typy: ['pant'] },
    { klic: 'pT', nazev: 'Tloušťka pantu', j: 'mm', v: 0.4, min: 0.1, max: 3, skupina: 'Pant', typy: ['pant'] },
    { klic: 'pL', nazev: 'Délka ohybové části', j: 'mm', v: 8, min: 0.3, max: 40, skupina: 'Pant', typy: ['pant'], kdy: p => p.pVarianta === 'zkusebni' },
    { klic: 'pR', nazev: 'Rádius přechodu', j: 'mm', v: 1, min: 0.2, max: 6, skupina: 'Pant', typy: ['pant'], kdy: p => p.pTvar === 'radius' },
    { klic: 'pUhel', nazev: 'Úhel ohnutí', j: '°', v: 180, min: 5, max: 180, skupina: 'Pant', typy: ['pant'], kdy: p => p.pVarianta === 'zkusebni' },
    { klic: 'pW', nazev: 'Šířka pantu (podél osy)', j: 'mm', v: 30, min: 3, max: 300, skupina: 'Pant', typy: ['pant'], kdy: p => p.pVarianta === 'zkusebni' },
    { klic: 'pDeskaL', nazev: 'Délka desky', j: 'mm', v: 20, min: 3, max: 200, skupina: 'Desky', typy: ['pant'], kdy: p => p.pVarianta === 'zkusebni' },
    { klic: 'pDeskaT', nazev: 'Tloušťka desky', j: 'mm', v: 3, min: 0.6, max: 30, skupina: 'Desky', typy: ['pant'], kdy: p => p.pVarianta === 'zkusebni' },
    { klic: 'kDelka', nazev: 'Vnitřní délka (kolmo k pantu)', j: 'mm', v: 50, min: 8, max: 300, skupina: 'Krabička', typy: ['pant'], kdy: p => p.pVarianta === 'krabicka' },
    { klic: 'kSirka', nazev: 'Vnitřní šířka (podél pantu)', j: 'mm', v: 30, min: 8, max: 300, skupina: 'Krabička', typy: ['pant'], kdy: p => p.pVarianta === 'krabicka' },
    { klic: 'kHb', nazev: 'Výška spodku', j: 'mm', v: 14, min: 3, max: 150, skupina: 'Krabička', typy: ['pant'], kdy: p => p.pVarianta === 'krabicka' },
    { klic: 'kHv', nazev: 'Výška víčka', j: 'mm', v: 5, min: 1.5, max: 150, skupina: 'Krabička', typy: ['pant'], kdy: p => p.pVarianta === 'krabicka' },
    { klic: 'kStena', nazev: 'Stěna', j: 'mm', v: 1.6, min: 0.6, max: 8, skupina: 'Krabička', typy: ['pant'], kdy: p => p.pVarianta === 'krabicka' },
    { klic: 'kDno', nazev: 'Dno', j: 'mm', v: 1.6, min: 0.4, max: 8, skupina: 'Krabička', typy: ['pant'], kdy: p => p.pVarianta === 'krabicka' },
    { klic: 'kOsazeni', nazev: 'Osazení víčka (zapadne do spodku)', typ: 'bool', v: true, skupina: 'Krabička', typy: ['pant'], kdy: p => p.pVarianta === 'krabicka' },
    { klic: 'kOsH', nazev: 'Výška osazení', j: 'mm', v: 2.5, min: 0.5, max: 20, skupina: 'Krabička', typy: ['pant'], kdy: p => p.pVarianta === 'krabicka' && p.kOsazeni },
    { klic: 'kOsT', nazev: 'Tloušťka osazení', j: 'mm', v: 1.2, min: 0.4, max: 5, skupina: 'Krabička', typy: ['pant'], kdy: p => p.pVarianta === 'krabicka' && p.kOsazeni },
    // bistabilní přepínač
    { klic: 'bL', nazev: 'Délka nosníku (rozpětí)', j: 'mm', v: 60, min: 15, max: 250, skupina: 'Nosníky', typy: ['bistabil'] },
    { klic: 'bH', nazev: 'Vzepětí oblouku h', j: 'mm', v: 3, min: 0.3, max: 25, skupina: 'Nosníky', typy: ['bistabil'] },
    { klic: 'bT', nazev: 'Tloušťka nosníku t', j: 'mm', v: 0.8, min: 0.2, max: 5, skupina: 'Nosníky', typy: ['bistabil'] },
    { klic: 'bB', nazev: 'Výška tisku (šířka nosníku)', j: 'mm', v: 8, min: 1, max: 60, skupina: 'Nosníky', typy: ['bistabil'] },
    { klic: 'bRozestup', nazev: 'Rozestup dvojice nosníků', j: 'mm', v: 8, min: 1.5, max: 60, skupina: 'Nosníky', typy: ['bistabil'] },
    { klic: 'bJezdec', nazev: 'Šířka jezdce', j: 'mm', v: 3, min: 1, max: 15, skupina: 'Rám a jezdec', typy: ['bistabil'] },
    { klic: 'bStena', nazev: 'Stěna rámu', j: 'mm', v: 5, min: 2, max: 25, skupina: 'Rám a jezdec', typy: ['bistabil'] },
    // spona (snap-fit)
    { klic: 'sL', nazev: 'Délka ramene L', j: 'mm', v: 14, min: 3, max: 100, skupina: 'Rameno', typy: ['spona'] },
    { klic: 'sT', nazev: 'Tloušťka u kořene t', j: 'mm', v: 1.6, min: 0.4, max: 8, skupina: 'Rameno', typy: ['spona'] },
    { klic: 'sTk', nazev: 'Tloušťka u háčku', j: 'mm', v: 1.6, min: 0.3, max: 8, skupina: 'Rameno', typy: ['spona'] },
    { klic: 'sB', nazev: 'Výška tisku (šířka ramene)', j: 'mm', v: 8, min: 1.5, max: 60, skupina: 'Rameno', typy: ['spona'] },
    { klic: 'sR', nazev: 'Zaoblení kořene', j: 'mm', v: 0.8, min: 0, max: 6, skupina: 'Rameno', typy: ['spona'] },
    { klic: 'sMezera', nazev: 'Mezera mezi rameny', j: 'mm', v: 3, min: 0.4, max: 40, skupina: 'Rameno', typy: ['spona'] },
    { klic: 'sKotva', nazev: 'Délka hlavy spony', j: 'mm', v: 6, min: 2, max: 40, skupina: 'Rameno', typy: ['spona'] },
    { klic: 'sY', nazev: 'Výška háčku (přesah)', j: 'mm', v: 1, min: 0.2, max: 6, skupina: 'Háček', typy: ['spona'] },
    { klic: 'sAlfa', nazev: 'Náběhový úhel', j: '°', v: 30, min: 10, max: 70, skupina: 'Háček', typy: ['spona'] },
    { klic: 'sAlfa2', nazev: 'Vysouvací úhel (90 = nerozebíratelná)', j: '°', v: 90, min: 20, max: 90, skupina: 'Háček', typy: ['spona'] },
    { klic: 'sProtikus', nazev: 'Zkušební protikus (deska s oknem)', typ: 'bool', v: true, skupina: 'Protikus', typy: ['spona'] },
    { klic: 'sStena', nazev: 'Tloušťka stěny protikusu', j: 'mm', v: 2, min: 0.6, max: 60, skupina: 'Protikus', typy: ['spona'] },
    // pružina
    { klic: 'rVarianta', nazev: 'Druh pružiny', typ: 'vyber', v: 'had', volby: [['had', 'Hadovitá (cik-cak) – tah / tlak'], ['spirala', 'Plochá spirála – krut']], skupina: 'Pružina', typy: ['pruzina'] },
    { klic: 'rT', nazev: 'Tloušťka pásu t', j: 'mm', v: 0.8, min: 0.2, max: 5, skupina: 'Pružina', typy: ['pruzina'] },
    { klic: 'rB', nazev: 'Výška tisku (šířka pásu)', j: 'mm', v: 6, min: 1, max: 60, skupina: 'Pružina', typy: ['pruzina'] },
    { klic: 'hN', nazev: 'Počet ohybů', j: 'ks', typ: 'cele', v: 6, min: 1, max: 40, skupina: 'Had', typy: ['pruzina'], kdy: p => p.rVarianta === 'had' },
    { klic: 'hA', nazev: 'Délka ramene a', j: 'mm', v: 20, min: 4, max: 200, skupina: 'Had', typy: ['pruzina'], kdy: p => p.rVarianta === 'had' },
    { klic: 'hP', nazev: 'Rozteč ramen p', j: 'mm', v: 4, min: 0.8, max: 40, skupina: 'Had', typy: ['pruzina'], kdy: p => p.rVarianta === 'had' },
    { klic: 'hOtvor', nazev: 'Otvor v patce (0 = bez)', j: 'mm', v: 3.2, min: 0, max: 12, skupina: 'Had', typy: ['pruzina'], kdy: p => p.rVarianta === 'had' },
    { klic: 'hZdvih', nazev: 'Pracovní zdvih', j: 'mm', v: 5, min: 0.1, max: 200, skupina: 'Had', typy: ['pruzina'], kdy: p => p.rVarianta === 'had' },
    { klic: 'sN', nazev: 'Počet závitů', j: 'ot', v: 3, min: 0.5, max: 15, skupina: 'Spirála', typy: ['pruzina'], kdy: p => p.rVarianta === 'spirala' },
    { klic: 'sRi', nazev: 'Vnitřní poloměr spirály', j: 'mm', v: 6, min: 2, max: 100, skupina: 'Spirála', typy: ['pruzina'], kdy: p => p.rVarianta === 'spirala' },
    { klic: 'sRo', nazev: 'Vnější poloměr spirály', j: 'mm', v: 25, min: 5, max: 200, skupina: 'Spirála', typy: ['pruzina'], kdy: p => p.rVarianta === 'spirala' },
    { klic: 'sHridel', nazev: 'Průměr hřídele', j: 'mm', v: 5, min: 1, max: 40, skupina: 'Spirála', typy: ['pruzina'], kdy: p => p.rVarianta === 'spirala' },
    { klic: 'sPlocha', nazev: 'Zploštění hřídele (D, 0 = kulatá)', j: 'mm', v: 0.5, min: 0, max: 10, skupina: 'Spirála', typy: ['pruzina'], kdy: p => p.rVarianta === 'spirala' },
    { klic: 'sUhel', nazev: 'Pracovní úhel natočení', j: '°', v: 90, min: 1, max: 1080, skupina: 'Spirála', typy: ['pruzina'], kdy: p => p.rVarianta === 'spirala' },
    // křížový kloub
    { klic: 'xVarianta', nazev: 'Provedení', typ: 'vyber', v: 'volny', volby: [['volny', 'Volné křížení (pásy ve dvou patrech)'], ['kolo', 'Kolo – pásy spojené uprostřed']], skupina: 'Kloub', typy: ['kriz'] },
    { klic: 'xL', nazev: 'Délka pásu L', j: 'mm', v: 20, min: 4, max: 150, skupina: 'Kloub', typy: ['kriz'] },
    { klic: 'xT', nazev: 'Tloušťka pásu t', j: 'mm', v: 0.8, min: 0.2, max: 5, skupina: 'Kloub', typy: ['kriz'] },
    { klic: 'xB', nazev: 'Výška tisku', j: 'mm', v: 8, min: 1.5, max: 60, skupina: 'Kloub', typy: ['kriz'] },
    { klic: 'xGama', nazev: 'Úhel křížení pásů', j: '°', v: 90, min: 30, max: 150, skupina: 'Kloub', typy: ['kriz'] },
    { klic: 'xMezeraZ', nazev: 'Mezera mezi patry', j: 'mm', v: 0.4, min: 0.1, max: 3, skupina: 'Kloub', typy: ['kriz'], kdy: p => p.xVarianta === 'volny' },
    { klic: 'xBlok', nazev: 'Hloubka bloků', j: 'mm', v: 8, min: 2, max: 60, skupina: 'Kloub', typy: ['kriz'] },
    { klic: 'xUhel', nazev: 'Pracovní úhel (±)', j: '°', v: 15, min: 0.5, max: 90, skupina: 'Kloub', typy: ['kriz'] },
    // paralelogram
    { klic: 'gL', nazev: 'Délka pásů L', j: 'mm', v: 30, min: 4, max: 200, skupina: 'Vedení', typy: ['paral'] },
    { klic: 'gT', nazev: 'Tloušťka pásu t', j: 'mm', v: 0.8, min: 0.2, max: 5, skupina: 'Vedení', typy: ['paral'] },
    { klic: 'gB', nazev: 'Výška tisku', j: 'mm', v: 8, min: 1, max: 60, skupina: 'Vedení', typy: ['paral'] },
    { klic: 'gD', nazev: 'Rozteč pásů', j: 'mm', v: 20, min: 2, max: 200, skupina: 'Vedení', typy: ['paral'] },
    { klic: 'gBlok', nazev: 'Délka bloků', j: 'mm', v: 8, min: 2, max: 60, skupina: 'Vedení', typy: ['paral'] },
    { klic: 'gR', nazev: 'Zaoblení kořene', j: 'mm', v: 0.5, min: 0, max: 5, skupina: 'Vedení', typy: ['paral'] },
    { klic: 'gZdvih', nazev: 'Pracovní posun', j: 'mm', v: 2, min: 0.05, max: 60, skupina: 'Vedení', typy: ['paral'] },
    // tisk a materiál (společné)
    { klic: 'material', nazev: 'Materiál', typ: 'vyber', v: 'PETG', volby: volbyMat, skupina: 'Tisk', typy: VSE },
    { klic: 'orientace', nazev: 'Orientace tisku', typ: 'vyber', v: 'naplocho', volby: Object.entries(ORIENTACE), skupina: 'Tisk', typy: VSE },
    { klic: 'tryska', nazev: 'Průměr trysky', j: 'mm', v: 0.4, min: 0.1, max: 1.2, skupina: 'Tisk', typy: VSE },
    { klic: 'vrstva', nazev: 'Výška vrstvy', j: 'mm', v: 0.2, min: 0.04, max: 0.8, skupina: 'Tisk', typy: VSE },
    { klic: 'vule', nazev: 'Vůle pro 3D tisk', j: 'mm', v: 0.2, min: 0, max: 1.5, skupina: 'Tisk', typy: ['pant', 'bistabil', 'spona', 'pruzina'],
      kdy: p => p.typ !== 'pant' || p.pVarianta === 'krabicka' },
    { klic: 'kusu', nazev: 'Kusů na podložku', j: 'ks', typ: 'cele', v: 1, min: 1, max: 12, skupina: 'Tisk', typy: VSE },
  ];
  const PODLE_KLICE = Object.fromEntries(PARAMETRY.map(d => [d.klic, d]));
  const viditelny = (d, p) => d.typy.includes(p.typ) && (!d.kdy || d.kdy(p));

  /* ---------- pomocné ---------- */
  const kopie = o => JSON.parse(JSON.stringify(o));
  function fmt(x, des = 1) {
    if (!Number.isFinite(x)) return '–';
    let s = (Math.round(x * 10 ** des) / 10 ** des).toFixed(des);
    if (s.includes('.')) s = s.replace(/\.?0+$/, '');
    return s.replace('-', '−').replace('.', ',');
  }

  function vychozi(typ = 'pant') {
    const p = { typ, nazev: TYPY[typ] ? TYPY[typ].nazev : 'Mechanismus' };
    for (const d of PARAMETRY) p[d.klic] = d.v;
    return p;
  }
  /** Doplní chybějící, ořízne meze; vrací {p, hlaseni} (hlášení o opravách importu). */
  function normalizuj(vstup) {
    const hlaseni = [];
    const v = vstup && typeof vstup === 'object' ? vstup : {};
    const typ = TYPY[v.typ] ? v.typ : 'pant';
    const p = vychozi(typ);
    if (typeof v.nazev === 'string') p.nazev = v.nazev.slice(0, 120);
    for (const d of PARAMETRY) {
      if (!(d.klic in v)) continue;
      const h = v[d.klic];
      if (d.typ === 'vyber') { if (d.volby.some(o => o[0] === h)) p[d.klic] = h; else hlaseni.push(`${d.nazev}: neznámá volba „${h}“`); continue; }
      if (d.typ === 'bool') { p[d.klic] = !!h; continue; }
      let n = typeof h === 'string' ? parseFloat(h.replace(',', '.')) : Number(h);
      if (!Number.isFinite(n)) { hlaseni.push(`${d.nazev}: neplatná hodnota`); continue; }
      if (d.typ === 'cele') n = Math.round(n);
      if (n < d.min) { hlaseni.push(`${d.nazev}: ${fmt(n, 2)} je pod minimem ${fmt(d.min, 2)} ${d.j || ''}`); n = d.min; }
      if (n > d.max) { hlaseni.push(`${d.nazev}: ${fmt(n, 2)} je nad maximem ${fmt(d.max, 2)} ${d.j || ''}`); n = d.max; }
      p[d.klic] = n;
    }
    return { p, hlaseni };
  }

  /* ---------- nosníková teorie ---------- */
  const momentSetrvacnosti = (b, t) => b * t ** 3 / 12;
  /** Živý pant ohnutý do oblouku se stálou křivostí: ε = t·θ/(2L), M = E·I·θ/L. */
  function zivyPant(E, W, t, L, theta) {
    const I = momentSetrvacnosti(W, t);
    return { eps: t * theta / (2 * L), kTheta: E * I / L, M: E * I * theta / L, polomer: L / theta };
  }
  /** Konzolová spona se zúžením tloušťky t0 → tK (lineárně), síla na konci ramene L.
      K = y·t0/(ε0·L²) (Bayer: 0,67 pro stálý průřez, 1,09 pro zúžení na polovinu). */
  function sponaRameno(E, b, t0, tK, L, y) {
    const n = 400; let integral = 0;   // ∫ (L−x)² / I(x) dx (Simpson)
    const I = x => momentSetrvacnosti(b, t0 + (tK - t0) * x / L);
    for (let i = 0; i <= n; i++) {
      const x = L * i / n, w = i === 0 || i === n ? 1 : (i % 2 ? 4 : 2);
      integral += w * (L - x) ** 2 / I(x);
    }
    integral *= L / n / 3;
    const P = E * y / integral;       // síla potřebná k průhybu y
    // největší přetvoření podél ramene: ε(x) = M·t/(2EI)
    let eps = 0, xMax = 0;
    for (let i = 0; i <= 200; i++) {
      const x = L * i / 200, tx = t0 + (tK - t0) * x / L, e = P * (L - x) * tx / (2 * E * momentSetrvacnosti(b, tx));
      if (e > eps + 1e-15) { eps = e; xMax = x; }
    }
    const eps0 = P * L * t0 / (2 * E * momentSetrvacnosti(b, t0));
    return { P, k: P / y, eps, xMax, K: y * t0 / (eps0 * L * L) };
  }
  /** Síla zasunutí/vysunutí z ohybové síly P: W = P·(μ + tan α)/(1 − μ·tan α); ∞ = samosvorné. */
  function silaSpony(P, mu, alfa) {
    const tg = Math.tan(alfa), jm = 1 - mu * tg;
    return jm <= 1e-9 ? Infinity : P * (mu + tg) / jm;
  }
  /** Bistabilní nosník – energetický model s prvním symetrickým tvarem w = a·(1+cos 2πx/L)/2
      (Rayleigh–Ritz, oba konce vetknuté, natočení jezdce zamezí dvojice nosníků).
      U(a) = Kb/2·(a−h)² + Ka/4·(a²−h²)², Kb = 2π⁴EI/L³, Ka = EAπ⁴/(8L³); d = h − a. */
  function bistabilniNosnik(E, b, t, L, h) {
    const I = momentSetrvacnosti(b, t), A = b * t;
    const Kb = 2 * PI ** 4 * E * I / L ** 3, Ka = E * A * PI ** 4 / (8 * L ** 3);
    const U = d => { const a = h - d; return Kb / 2 * (a - h) ** 2 + Ka / 4 * (a * a - h * h) ** 2; };
    const F = d => { const a = h - d; return d * (Kb + Ka * a * (a + h)); };
    const eps = d => { const a = h - d; return PI * PI * t * Math.abs(d) / (L * L) + PI * PI * Math.abs(a * a - h * h) / (4 * L * L); };
    const D = h * h - 16 * t * t / 3;   // podmínka bistability h/t > 4/√3
    const r = { Kb, Ka, U, F, eps, Q: h / t, bistabilni: D > 0 };
    if (D > 0) {
      const a2 = (-h + Math.sqrt(D)) / 2, a3 = (-h - Math.sqrt(D)) / 2;
      r.dVrchol = h - a2;  // labilní poloha (maximum energie)
      r.d2 = h - a3;       // druhá stabilní poloha
    }
    // průběh do 1,15 × druhé polohy (u nebistabilního do 2,2 h)
    const dMax = (r.d2 || 2 * h) * 1.15, n = 240;
    let Fmax = -Infinity, dFmax = 0, Fmin = Infinity, dFmin = 0, epsMax = 0;
    for (let i = 0; i <= n; i++) {
      const d = dMax * i / n, f = F(d);
      if (f > Fmax) { Fmax = f; dFmax = d; }
      if (d <= (r.d2 || dMax) && f < Fmin) { Fmin = f; dFmin = d; }
      if (d <= (r.d2 || 2 * h)) epsMax = Math.max(epsMax, eps(d));
    }
    Object.assign(r, { dMax, Fmax, dFmax, Fmin, dFmin, epsMax, FQiu: 740 * E * I * h / L ** 3 });
    return r;
  }
  /** Hadovitá pružina, Castigliano (čistý ohyb): moment v bodě = F·x (x = vzdálenost od osy sil).
      n ohybů (oblouky poloměru p/2), n−1 celých ramen délky a, dvě poloviční ramena u patek. */
  function hadPruzina(E, b, t, n, a, pr) {
    const I = momentSetrvacnosti(b, t), r = pr / 2;
    const ramena = n * a ** 3 / 12;
    const oblouky = n * r * (PI * a * a / 4 + 2 * a * r + PI * r * r / 2);
    const poddajnost = (ramena + oblouky) / (E * I);
    const k = 1 / poddajnost;
    // největší moment ve vrcholu oblouku: F·(a/2 + r)
    const epsNaMm = k * (a / 2 + r) * t / (2 * E * I);
    return { k, poddajnost, epsNaMm, I, podilOblouku: oblouky / (ramena + oblouky) };
  }
  function delkaSpiraly(ri, ro, n) {
    const fi = 2 * PI * n, c = (ro - ri) / fi, m = 2000; let L = 0;
    for (let i = 0; i < m; i++) { const f = fi * (i + 0.5) / m, r = ri + c * f; L += Math.hypot(r, c) * fi / m; }
    return L;
  }
  /** Plochá spirála: kθ = E·I/L, ε = t·θ/(2L) (čistý moment po celé délce). */
  function spirala(E, b, t, ri, ro, n) {
    const L = delkaSpiraly(ri, ro, n), I = momentSetrvacnosti(b, t);
    return { L, kTheta: E * I / L, epsNaRad: t / (2 * L), stoupani: (ro - ri) / n };
  }
  /** Křížový kloub: volné křížení (střed pásů) K = 2EI/L, ε = tθ/(2L);
      kolo (pásy spojené uprostřed) K = 8EI/L, ε = 2tθ/L. */
  function krizovyKloub(E, bPasu, t, L, kolo) {
    const I = momentSetrvacnosti(bPasu, t);
    return kolo ? { K: 8 * E * I / L, epsNaRad: 2 * t / L } : { K: 2 * E * I / L, epsNaRad: t / (2 * L) };
  }
  /** Paralelogram: dva vedené nosníky k = 24EI/L³, ε = 3tδ/L², parazitní zkrácení ≈ 0,6·δ²/L. */
  function paralelogram(E, b, t, L, delta) {
    const I = momentSetrvacnosti(b, t), k = 24 * E * I / L ** 3;
    return { k, F: k * delta, eps: 3 * t * delta / (L * L), parazit: 0.6 * delta * delta / L };
  }

  /* ---------- 2D pomocníci pro plán geometrie ---------- */
  const obdelnik = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const segmentu = (r, uhel) => Math.max(3, Math.min(96, Math.ceil(Math.abs(uhel) * Math.max(r, 0.5) / 0.3)));
  function oblouk(cx, cy, r, a0, a1, n) {
    n = n || segmentu(r, a1 - a0);
    const b = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; b.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return b;
  }
  const kruh = (cx, cy, r) => oblouk(cx, cy, r, 0, 2 * PI, segmentu(r, 2 * PI)).slice(0, -1);
  /** Výplň koutu (zaoblení R) u vnitřního rohu (cx, cy); volný kvadrant směrem (sx, sy). */
  function koutovy(cx, cy, sx, sy, R) {
    const ox = cx + sx * R, oy = cy + sy * R;   // střed oblouku
    const a0 = Math.atan2(cy - oy, 0), a1 = Math.atan2(0, cx - ox);
    let d = a1 - a0; if (d > PI) d -= 2 * PI; if (d < -PI) d += 2 * PI;
    const b = oblouk(ox, oy, R, a0, a0 + d);
    b.push([cx - sx * 0.05, cy - sy * 0.05]);   // malé zanoření do sousedních těles
    return b;
  }
  /** Prstencová výseč (úhly v radiánech). */
  function vysec(cx, cy, r0, r1, a0, a1) {
    return oblouk(cx, cy, r1, a0, a1).concat(oblouk(cx, cy, r0, a1, a0));
  }
  /** Tlustá křivka: body středové čáry odsazené ±t/2 podél normál. */
  function tlustaKrivka(body, t) {
    const L = [], P = [], n = body.length;
    for (let i = 0; i < n; i++) {
      const a = body[Math.max(0, i - 1)], c = body[Math.min(n - 1, i + 1)];
      let tx = c[0] - a[0], ty = c[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      L.push([body[i][0] - ty * t / 2, body[i][1] + tx * t / 2]);
      P.push([body[i][0] + ty * t / 2, body[i][1] - tx * t / 2]);
    }
    return L.concat(P.reverse());
  }
  /** Obdélník podél úsečky (A → B) tloušťky t. */
  function pasUsecka(ax, ay, bx, by, t) { return tlustaKrivka([[ax, ay], [bx, by]], t); }
  const hranol = (body, z0, z1, rovina = 'xy') => ({ body, z0, z1, rovina });

  /* ---------- plány jednotlivých mechanismů ---------- */
  function planPant(p) {
    const t = p.pT, R = p.pTvar === 'radius' ? p.pR : 0;
    const telesa = [];
    const pasProfil = (G, y0, y1) => {
      const e = 0.8;
      telesa.push(hranol(obdelnik(-e, 0, G + e, t), y0, y1, 'xz'));
      if (R > 0) { telesa.push(hranol(koutovy(0, t, 1, 1, R), y0, y1, 'xz'), hranol(koutovy(G, t, -1, 1, R), y0, y1, 'xz')); }
    };
    if (p.pVarianta === 'krabicka') {
      const s = p.kStena, v = p.vule, Lo = p.kDelka + 2 * s, Wo = p.kSirka + 2 * s;
      const L = PI * (p.kHb + p.kHv - t) / 2, G = L + 2 * R;
      const spodek = { jmeno: 'krabicka', nazev: 'Krabička s živým pantem', barva: '#4F86D9', telesa, odecti: [] };
      telesa.push(hranol(obdelnik(-Lo, 0, 0, Wo), 0, p.kHb));
      spodek.odecti.push(hranol(obdelnik(-Lo + s, s, -s, Wo - s), p.kDno, p.kHb + 1));
      telesa.push(hranol(obdelnik(G, 0, G + Lo, Wo), 0, p.kHv));
      const os = p.kOsazeni ? v + p.kOsT : 0;
      spodek.odecti.push(hranol(obdelnik(G + s + os, s + os, G + Lo - s - os, Wo - s - os), p.kDno, p.kHv + p.kOsH + 1));
      if (p.kOsazeni) telesa.push(hranol(obdelnik(G + s + v, s + v, G + Lo - s - v, Wo - s - v), p.kHv - 0.01, p.kHv + p.kOsH));
      pasProfil(G, 0, Wo);
      return { dily: [spodek], ohyb: { L, G, theta: PI }, rozmery: [2 * Lo + G, Wo, Math.max(p.kHb, p.kOsazeni ? p.kHv + p.kOsH : p.kHv)] };
    }
    const G = p.pL + 2 * R, D = p.pDeskaL, T = p.pDeskaT;
    telesa.push(hranol(obdelnik(-D, 0, 0, T), 0, p.pW, 'xz'), hranol(obdelnik(G, 0, G + D, T), 0, p.pW, 'xz'));
    pasProfil(G, 0, p.pW);
    return { dily: [{ jmeno: 'pant', nazev: 'Zkušební živý pant', barva: '#4F86D9', telesa, odecti: [] }],
      ohyb: { L: p.pL, G, theta: p.pUhel * RAD }, rozmery: [2 * D + G, p.pW, T] };
  }

  /** Bistabilní přepínač – rám, dvojice kosinových nosníků, jezdec procházející štěrbinou v rámu. */
  function bistabilGeom(p) {
    const L = p.bL, h = p.bH, t = p.bT, s = p.bRozestup, c = p.bJezdec, S = p.bStena, v = p.vule;
    const X = L / 2, e = Math.min(S, 2);
    const yb = h - t / 2 - 2 * h - 1.5;            // dno vnitřku rámu: jezdec v druhé poloze nad ním
    const yt = s + h + t / 2 + 1.5;                // strop: nad horním nosníkem v první poloze
    const vystup = 2 * h + 1.5;                    // jezdec vyčnívá i v druhé poloze
    return { L, h, t, s, c, S, v, X, e, yb, yt, vystup, ox: [-X - S, X + S], oy: [yb - S, yt + S + vystup] };
  }
  function planBistabil(p) {
    const g = bistabilGeom(p), { L, h, t, s, c, S, v, X, e, yb, yt, vystup } = g;
    const telesa = [], odecti = [], B = p.bB;
    // rám jako jediný obrys „C“ se štěrbinou pro jezdce v horní stěně
    const xs = c / 2 + v, Y1 = yt + S, Y0 = yb - S, XO = X + S;
    telesa.push(hranol([[-xs, Y1], [-XO, Y1], [-XO, Y0], [XO, Y0], [XO, Y1], [xs, Y1], [xs, yt], [X, yt], [X, yb], [-X, yb], [-X, yt], [-xs, yt]], 0, B));
    const n = Math.max(40, Math.ceil(L / 0.5));
    for (const y0 of [0, s]) {
      const body = [[-X - e, y0]];
      for (let i = 0; i <= n; i++) { const x = -X + L * i / n; body.push([x, y0 + h / 2 * (1 + Math.cos(2 * PI * x / L))]); }
      body.push([X + e, y0]);
      telesa.push(hranol(tlustaKrivka(body, t), 0, B));
    }
    telesa.push(hranol(obdelnik(-c / 2, h - t / 2 + 0.05, c / 2, yt + S + vystup), 0, B));
    return { dily: [{ jmeno: 'prepinac', nazev: 'Bistabilní přepínač', barva: '#4F86D9', telesa, odecti }],
      rozmery: [L + 2 * S, yt + S + vystup - (yb - S), B], geom: g };
  }

  function sponaGeom(p) {
    const tK = Math.min(p.sTk, p.sT), yo = p.sMezera / 2 + p.sT;
    const a2 = p.sAlfa2 * RAD, a1 = p.sAlfa * RAD, land = 0.3;
    const xC = p.sL + (p.sAlfa2 >= 89.99 ? 0 : p.sY / Math.tan(a2));
    const xR = xC + land, xE = xR + p.sY / Math.tan(a1);
    const okno = { h: 2 * yo + 2 * p.vule, w: p.sB + 2 * p.vule };
    const Wa = 2 * (yo + Math.max(2, p.sY + 1.5));
    return { tK, yo, xC, xR, xE, okno, Wa, okraj: 4 };
  }
  function planSpona(p) {
    const g = sponaGeom(p), { tK, yo, xC, xR, xE, Wa } = g, B = p.sB, gi = p.sMezera / 2;
    const telesa = [hranol(obdelnik(-p.sKotva, -Wa / 2, 0, Wa / 2), 0, B)];
    const yi = gi + p.sT - tK;
    const horni = [[-0.5, gi], [p.sL, yi], [xE, yi], [xE, yo], [xR, yo + p.sY], [xC, yo + p.sY], [p.sL, yo], [-0.5, yo]];
    for (const z of [1, -1]) {
      telesa.push(hranol(horni.map(([x, y]) => [x, z * y]), 0, B));
      if (p.sR > 0) {
        telesa.push(hranol(koutovy(0, z * yo, 1, z, p.sR), 0, B));
        const Ri = Math.min(p.sR, gi * 0.9);
        if (Ri > 0.05) telesa.push(hranol(koutovy(0, z * gi, 1, -z, Ri), 0, B));
      }
    }
    const dily = [{ jmeno: 'spona', nazev: 'Spona', barva: '#4F86D9', telesa, odecti: [] }];
    if (p.sProtikus) {
      const o = g.okraj, w = g.okno.w + 2 * o, hh = g.okno.h + 2 * o;
      dily.push({ jmeno: 'protikus', nazev: 'Protikus s oknem', barva: '#E08A2C',
        telesa: [hranol(obdelnik(0, 0, w, hh), 0, p.sStena)], odecti: [hranol(obdelnik(o, o, o + g.okno.w, o + g.okno.h), -1, p.sStena + 1)] });
    }
    return { dily, rozmery: [p.sKotva + xE, Wa, B], geom: g };
  }

  function hadGeom(p) {
    const w = Math.max(6, p.hOtvor + 4), P = Math.max(5, p.hOtvor + 3.5);
    return { w, P };
  }
  function planHad(p) {
    const t = p.rT, a = p.hA, pr = p.hP, n = p.hN, B = p.rB, { w, P } = hadGeom(p), e = 0.02;
    const telesa = [], odecti = [];
    const strana = i => (i % 2 === 0 ? 1 : -1);   // oblouk i: vpravo (+) / vlevo (−)
    telesa.push(hranol(obdelnik(-w / 2, -t / 2, a / 2 + e, t / 2), 0, B));
    for (let i = 0; i < n; i++) {
      const sx = strana(i), cy = (i + 0.5) * pr;
      telesa.push(hranol(vysec(sx * a / 2, cy, pr / 2 - t / 2, pr / 2 + t / 2, sx > 0 ? -PI / 2 : PI / 2, sx > 0 ? PI / 2 : 3 * PI / 2), 0, B));
      if (i < n - 1) telesa.push(hranol(obdelnik(-a / 2 - e, (i + 1) * pr - t / 2, a / 2 + e, (i + 1) * pr + t / 2), 0, B));
    }
    const yN = n * pr, sxN = strana(n - 1);
    telesa.push(hranol(sxN > 0 ? obdelnik(-w / 2, yN - t / 2, a / 2 + e, yN + t / 2) : obdelnik(-a / 2 - e, yN - t / 2, w / 2, yN + t / 2), 0, B));
    telesa.push(hranol(obdelnik(-w / 2, -P, w / 2, t / 2), 0, B), hranol(obdelnik(-w / 2, yN - t / 2, w / 2, yN + P), 0, B));
    if (p.hOtvor > 0) {
      odecti.push(hranol(kruh(0, -P / 2 + t / 4, p.hOtvor / 2), -1, B + 1), hranol(kruh(0, yN + P / 2 - t / 4, p.hOtvor / 2), -1, B + 1));
    }
    return { dily: [{ jmeno: 'pruzina', nazev: 'Hadovitá pružina', barva: '#4F86D9', telesa, odecti }],
      rozmery: [Math.max(a + pr + t, w), yN + 2 * P, B] };
  }

  function spiralaGeom(p) {
    const t = p.rT, stoupani = (p.sRo - p.sRi) / p.sN, mezera = stoupani - t;
    const gk = Math.max(0.05, Math.min(mezera, 1.5));   // mezera u náboje a u prstenu
    const rh = p.sRi - t / 2 - gk, Rk = p.sRo + t / 2 + gk, kT = 2.5;
    const otvor = p.sHridel / 2 + p.vule;
    return { t, stoupani, mezera, rh, Rk, kT, otvor, ucho: 8, uchoOtvor: 3.2 };
  }
  function planSpirala(p) {
    const g = spiralaGeom(p), { t, rh, Rk, kT, otvor } = g, B = p.rB, n = p.sN;
    const telesa = [], odecti = [];
    const fi = 2 * PI * n, m = Math.max(80, Math.ceil(fi * p.sRo / 0.6));
    const body = [];
    for (let i = 0; i <= m; i++) { const f = fi * i / m, r = p.sRi + (p.sRo - p.sRi) * f / fi; body.push([r * Math.cos(f), r * Math.sin(f)]); }
    telesa.push(hranol(tlustaKrivka(body, t), 0, B));
    telesa.push(hranol(kruh(0, 0, rh), 0, B));
    telesa.push(hranol(pasUsecka(rh - 0.5, 0, p.sRi + 0.05, 0, t), 0, B));   // spojka náboj → spirála
    const ce = Math.cos(fi), se = Math.sin(fi);
    telesa.push(hranol(pasUsecka((p.sRo - 0.05) * ce, (p.sRo - 0.05) * se, (Rk + 0.5) * ce, (Rk + 0.5) * se, t), 0, B));
    const vnejsi = kruh(0, 0, Rk + kT), vnitrni = kruh(0, 0, Rk);
    telesa.push({ obrysy: [vnejsi, vnitrni], z0: 0, z1: B, rovina: 'xy' });   // prstenec (sudý–lichý)
    // ucho na prstenu (kolmo ke konci spirály) s montážním otvorem
    const au = fi + PI / 2, ux = Math.cos(au), uy = Math.sin(au), r0 = Rk + kT - 0.5, r1 = Rk + kT + g.ucho;
    const nx = -uy * g.ucho / 2, ny = ux * g.ucho / 2;
    telesa.push(hranol([[r0 * ux + nx, r0 * uy + ny], [r1 * ux + nx, r1 * uy + ny], [r1 * ux - nx, r1 * uy - ny], [r0 * ux - nx, r0 * uy - ny]], 0, B));
    odecti.push(hranol(kruh((Rk + kT + g.ucho / 2) * ux, (Rk + kT + g.ucho / 2) * uy, g.uchoOtvor / 2), -1, B + 1));
    // otvor pro hřídel s plochou (tvar D)
    const xf = p.sPlocha > 0 ? p.sHridel / 2 - p.sPlocha + p.vule : Infinity;
    odecti.push(hranol(kruh(0, 0, otvor).map(([x, y]) => [Math.min(x, xf), y]), -1, B + 1));
    return { dily: [{ jmeno: 'pruzina', nazev: 'Spirálová pružina', barva: '#4F86D9', telesa, odecti }],
      rozmery: [2 * (Rk + kT), 2 * (Rk + kT), B], geom: g };
  }

  function krizGeom(p) {
    const be = p.xGama * RAD / 2, c = p.xL / 2 * Math.cos(be), xs = p.xL / 2 * Math.sin(be);
    const m = Math.max(3, 2 * p.xT), X = xs + m;
    // největší úhel natočení, než roh pohyblivého bloku narazí na pevný (c·cosθ − X·sinθ = −c)
    let lo = 0, hi = PI / 2;
    for (let i = 0; i < 60; i++) { const th = (lo + hi) / 2; if (c * Math.cos(th) - X * Math.sin(th) > -c) lo = th; else hi = th; }
    const z1 = (p.xB - p.xMezeraZ) / 2;
    return { be, c, xs, m, X, uhelNaraz: lo, z1 };
  }
  function planKriz(p) {
    const g = krizGeom(p), { be, c, xs, X, z1 } = g, B = p.xB, H = p.xBlok, t = p.xT, e = 1.2;
    const telesa = [hranol(obdelnik(-X, -c - H, X, -c + 0.02), 0, B), hranol(obdelnik(-X, c - 0.02, X, c + H), 0, B)];
    const ex = e * Math.sin(be), ey = e * Math.cos(be);
    const pas1 = pasUsecka(-xs - ex, -c - ey, xs + ex, c + ey, t), pas2 = pasUsecka(xs + ex, -c - ey, -xs - ex, c + ey, t);
    if (p.xVarianta === 'kolo') telesa.push(hranol(pas1, 0, B), hranol(pas2, 0, B));
    else telesa.push(hranol(pas1, 0, z1), hranol(pas2, z1 + p.xMezeraZ, B));
    return { dily: [{ jmeno: 'kloub', nazev: 'Křížový ohybový kloub', barva: '#4F86D9', telesa, odecti: [] }],
      rozmery: [2 * X, 2 * c + 2 * H, B], geom: g };
  }

  function planParal(p) {
    const L = p.gL, t = p.gT, D = p.gD, Bk = p.gBlok, B = p.gB, m = 3, R = Math.min(p.gR, m, Math.max(0, (D - t) / 2 - 0.05));
    const y0 = -t / 2 - m, y1 = D + t / 2 + m;
    const telesa = [hranol(obdelnik(-Bk, y0, 0, y1), 0, B), hranol(obdelnik(L, y0, L + Bk, y1), 0, B)];
    for (const yc of [0, D]) {
      telesa.push(hranol(obdelnik(-0.5, yc - t / 2, L + 0.5, yc + t / 2), 0, B));
      if (R > 0) for (const [x, sx] of [[0, 1], [L, -1]]) for (const sy of [1, -1]) telesa.push(hranol(koutovy(x, yc + sy * t / 2, sx, sy, R), 0, B));
    }
    return { dily: [{ jmeno: 'vedeni', nazev: 'Paralelogramové vedení', barva: '#4F86D9', telesa, odecti: [] }],
      rozmery: [L + 2 * Bk, y1 - y0, B] };
  }

  function plan(p) {
    switch (p.typ) {
      case 'pant': return planPant(p);
      case 'bistabil': return planBistabil(p);
      case 'spona': return planSpona(p);
      case 'pruzina': return p.rVarianta === 'spirala' ? planSpirala(p) : planHad(p);
      case 'kriz': return planKriz(p);
      default: return planParal(p);
    }
  }

  /* ---------- výpočet: veličiny, graf, přetvoření ---------- */
  const deg = x => x / RAD;
  function vypocet(p) {
    const m = MATERIALY[p.material] || MATERIALY.PETG, E = m.E;
    const r = { vel: [], graf: null, eps: 0, opakovane: true, vzorce: [] };
    const v = (popis, hodnota, jedn, dalsi) => r.vel.push({ popis, hodnota, jedn, dalsi });
    const mezX = (epsNaJedn, xMax) => [['opak', m.epsOpak], ['kr', m.epsKr]].map(([k, e]) => ({ x: e / epsNaJedn, popis: k === 'opak' ? 'mez opak.' : 'mez krátk.', druh: k })).filter(z => z.x <= xMax);
    const linearni = (k, xMax, osaX, osaY, pracovni, epsNaJedn) => ({
      osaX, osaY, krivky: [{ body: [[0, 0], [xMax, k * xMax]], popis: osaY }],
      svisle: [{ x: pracovni, popis: 'pracovní bod', druh: 'prac' }, ...mezX(epsNaJedn, xMax)],
    });
    if (p.typ === 'pant') {
      const pl = planPant(p), L = pl.ohyb.L, th = pl.ohyb.theta;
      const W = p.pVarianta === 'krabicka' ? p.kSirka + 2 * p.kStena : p.pW;
      const z = zivyPant(E, W, p.pT, L, th);
      r.eps = z.eps;
      v('Přetvoření pantu ε', fmt(z.eps * 100, 2), '%', `při ohnutí o ${fmt(deg(th), 0)}°`);
      v('Délka ohybové části', fmt(L, 2), 'mm', p.pVarianta === 'krabicka' ? 'dopočteno: π·(Hspodku + Hvíčka − t)/2' : (p.pTvar === 'radius' ? `+ 2 × rádius ${fmt(p.pR, 2)} mm` : 'mezi deskami'));
      v('Poloměr ohybu', fmt(z.polomer, 2), 'mm', 'neutrální vlákno');
      v('Tuhost v ohybu', fmt(z.kTheta * RAD, 3), 'N·mm/°', `moment při ${fmt(deg(th), 0)}° = ${fmt(z.M, 1)} N·mm`);
      const thMax = Math.PI;
      r.graf = linearni(z.kTheta * RAD, deg(thMax), 'Úhel ohnutí [°]', 'Moment [N·mm]', deg(th), z.eps / deg(th));
      r.vzorce = ['ε = t·θ / (2L) – pás ohnutý do oblouku stálé křivosti', 'M = E·I·θ / L, I = W·t³/12'];
    } else if (p.typ === 'bistabil') {
      const z = bistabilniNosnik(E, p.bB, p.bT, p.bL, p.bH);
      r.bistabil = z; r.eps = z.epsMax;
      const F2 = d => 2 * z.F(d);
      v('Poměr h/t', fmt(z.Q, 2), '', z.bistabilni ? 'nad 2,31 → bistabilní' : 'pod 2,31 → NENÍ bistabilní');
      if (z.bistabilni) v('Druhá stabilní poloha', fmt(z.d2, 2), 'mm', `zdvih jezdce (≈ 2h = ${fmt(2 * p.bH, 2)} mm)`);
      v('Síla přeskoku', fmt(2 * Math.min(z.Fmax, z.FQiu), 1), 'N', `model ${fmt(2 * z.Fmax, 1)} N, odhad Qiu 740·EIh/L³ = ${fmt(2 * z.FQiu, 1)} N`);
      if (z.bistabilni) v('Síla zpětného přeskoku', fmt(-2 * z.Fmin, 1), 'N', 'tah potřebný k návratu (model)');
      v('Největší přetvoření', fmt(z.epsMax * 100, 2), '%', 'ohyb + tlak během přeskoku');
      const n = 160, body = [];
      for (let i = 0; i <= n; i++) { const d = z.dMax * i / n; body.push([d, F2(d)]); }
      r.graf = { osaX: 'Posun jezdce [mm]', osaY: 'Síla [N]', krivky: [{ body, popis: 'síla (2 nosníky)' }], nula: true,
        body: [{ x: 0, y: 0, popis: 'stabilní 1' }, ...(z.bistabilni ? [{ x: z.dVrchol, y: 0, popis: 'labilní' }, { x: z.d2, y: 0, popis: 'stabilní 2' }] : [])],
        svisle: [] };
      r.vzorce = ['w(x) = h/2·(1 + cos 2πx/L), jeden symetrický tvar (Rayleigh–Ritz)', 'U = Kb/2·(a−h)² + Ka/4·(a²−h²)², Kb = 2π⁴EI/L³, Ka = EAπ⁴/(8L³)',
        'bistabilní pro h/t > 4/√3 ≈ 2,31', 'model jedním tvarem sílu přeskoku přeceňuje → uvedeno menší z modelu a 740·EI·h/L³ (Qiu, Lang, Slocum 2004)'];
    } else if (p.typ === 'spona') {
      const g = sponaGeom(p), z = sponaRameno(E, p.sB, p.sT, g.tK, p.sL, p.sY);
      r.eps = z.eps; r.opakovane = p.sAlfa2 < 80;
      const W = 2 * silaSpony(z.P, m.mu, p.sAlfa * RAD), W2 = 2 * silaSpony(z.P, m.mu, p.sAlfa2 * RAD);
      r.spona = { ...z, W, W2, g };
      v('Přetvoření v kořeni ε', fmt(z.eps * 100, 2), '%', z.xMax > 0.01 ? `největší ve vzdálenosti ${fmt(z.xMax, 1)} mm` : 'y = K·ε·L²/t');
      v('Činitel tvaru K', fmt(z.K, 3), '', 'Bayer: 0,67 stálý průřez, 1,09 zúžení na ½');
      v('Ohybová síla ramene P', fmt(z.P, 2), 'N', `tuhost ${fmt(z.k, 2)} N/mm`);
      v('Síla zasunutí', fmt(W, 1), 'N', `obě ramena, μ = ${fmt(m.mu, 2)}`);
      v('Síla vysunutí', Number.isFinite(W2) ? fmt(W2, 1) : '∞', 'N', Number.isFinite(W2) ? 'rozebíratelná' : 'samosvorná – nerozebíratelná');
      v('Okno protikusu', `${fmt(g.okno.h, 2)} × ${fmt(g.okno.w, 2)}`, 'mm', `přesah háčku po zacvaknutí ${fmt(p.sY - p.vule, 2)} mm`);
      const tg = Math.tan(p.sAlfa * RAD), sN = p.sY / tg, body = [], n = 80, Wf = y => 2 * silaSpony(z.k * y, m.mu, p.sAlfa * RAD);
      for (let i = 0; i <= n; i++) { const s = sN * i / n; body.push([s, Wf(s * tg)]); }
      body.push([sN + 0.001, 2 * z.P * m.mu], [sN + 0.3, 2 * z.P * m.mu], [sN + 0.301, 0], [sN * 1.25 + 0.6, 0]);
      r.graf = { osaX: 'Dráha zasouvání [mm]', osaY: 'Síla zasunutí [N]', krivky: [{ body, popis: 'síla zasunutí' }], svisle: [{ x: sN, popis: 'háček přeskočí', druh: 'prac' }] };
      r.vzorce = ['y = K·ε·L²/t (K z integrace průhybu zúženého ramene)', 'P = E·b·t³·y / (4L³) pro stálý průřez', 'W = P·(μ + tan α)/(1 − μ·tan α)'];
    } else if (p.typ === 'pruzina' && p.rVarianta === 'spirala') {
      const z = spirala(E, p.rB, p.rT, p.sRi, p.sRo, p.sN), th = p.sUhel * RAD;
      r.eps = z.epsNaRad * th;
      v('Tuhost v krutu', fmt(z.kTheta * RAD, 3), 'N·mm/°', `délka spirály ${fmt(z.L, 0)} mm`);
      v('Moment při pracovním úhlu', fmt(z.kTheta * th, 1), 'N·mm', `${fmt(p.sUhel, 0)}°`);
      v('Přetvoření ε', fmt(r.eps * 100, 2), '%', 'ε = t·θ/(2L)');
      v('Mezera mezi závity', fmt(spiralaGeom(p).mezera, 2), 'mm', `stoupání ${fmt(z.stoupani, 2)} mm`);
      const xMax = Math.max(p.sUhel * 1.5, Math.min(m.epsKr / z.epsNaRad / RAD * 1.1, p.sUhel * 4));
      r.graf = linearni(z.kTheta * RAD, xMax, 'Natočení [°]', 'Moment [N·mm]', p.sUhel, z.epsNaRad * RAD);
      r.vzorce = ['k = E·I / L (L = délka spirály)', 'ε = t·θ / (2L)'];
    } else if (p.typ === 'pruzina') {
      const z = hadPruzina(E, p.rB, p.rT, p.hN, p.hA, p.hP);
      r.eps = z.epsNaMm * p.hZdvih;
      v('Tuhost', fmt(z.k, 3), 'N/mm', `oblouky dávají ${fmt(z.podilOblouku * 100, 0)} % poddajnosti`);
      v('Síla při zdvihu', fmt(z.k * p.hZdvih, 2), 'N', `${fmt(p.hZdvih, 1)} mm`);
      v('Přetvoření ε', fmt(r.eps * 100, 2), '%', 've vrcholu oblouku');
      v('Největší zdvih (mez opak.)', fmt(m.epsOpak / z.epsNaMm, 1), 'mm', `krátkodobě ${fmt(m.epsKr / z.epsNaMm, 1)} mm`);
      const xMax = Math.max(p.hZdvih * 1.5, Math.min(m.epsKr / z.epsNaMm * 1.1, p.hZdvih * 4));
      r.graf = linearni(z.k, xMax, 'Zdvih [mm]', 'Síla [N]', p.hZdvih, z.epsNaMm);
      r.vzorce = ['Castigliano: δ/F = [n·a³/12 + n·r·(πa²/4 + 2ar + πr²/2)] / (E·I), r = p/2', 'ε = F·(a/2 + r)·t / (2EI)'];
    } else if (p.typ === 'kriz') {
      const g = krizGeom(p), kolo = p.xVarianta === 'kolo';
      const z = krizovyKloub(E, kolo ? p.xB : g.z1, p.xT, p.xL, kolo), th = p.xUhel * RAD;
      r.eps = z.epsNaRad * th;
      v('Tuhost v natočení', fmt(z.K * RAD, 3), 'N·mm/°', kolo ? 'K = 8EI/L' : 'K = 2EI/L');
      v('Moment při ±' + fmt(p.xUhel, 0) + '°', fmt(z.K * th, 1), 'N·mm', '');
      v('Přetvoření ε', fmt(r.eps * 100, 2), '%', kolo ? 'ε = 2tθ/L' : 'ε = tθ/(2L)');
      v('Natočení do nárazu bloků', fmt(deg(g.uhelNaraz), 1), '°', 'mechanický doraz');
      const xMax = Math.max(p.xUhel * 1.5, Math.min(m.epsKr / z.epsNaRad / RAD * 1.1, 90));
      r.graf = linearni(z.K * RAD, xMax, 'Natočení [°]', 'Moment [N·mm]', p.xUhel, z.epsNaRad * RAD);
      r.graf.svisle.push({ x: deg(g.uhelNaraz), popis: 'doraz', druh: 'doraz' });
      r.vzorce = kolo ? ['kolo: střed pásů se natočí o θ/2, K = 8EI/L', 'ε = 2·t·θ / L'] : ['volné křížení ve středu pásů: každý pás čistý ohyb, K = 2EI/L', 'ε = t·θ / (2L)'];
    } else {
      const z = paralelogram(E, p.gB, p.gT, p.gL, p.gZdvih);
      r.eps = z.eps;
      v('Tuhost vedení', fmt(z.k, 3), 'N/mm', 'k = 24EI/L³');
      v('Síla při posunu', fmt(z.F, 2), 'N', `${fmt(p.gZdvih, 2)} mm`);
      v('Přetvoření ε', fmt(z.eps * 100, 2), '%', 'ε = 3tδ/L²');
      v('Parazitní zkrácení', fmt(z.parazit * 1000, 0), 'µm', 'deska se přiblíží k základně ≈ 0,6·δ²/L');
      const eN = 3 * p.gT / p.gL ** 2, xMax = Math.max(p.gZdvih * 1.5, Math.min(m.epsKr / eN * 1.1, p.gZdvih * 4));
      r.graf = linearni(z.k, xMax, 'Posun [mm]', 'Síla [N]', p.gZdvih, eN);
      r.vzorce = ['k = 2 × 12EI/L³ (vedené nosníky)', 'ε = 3·t·δ / L²', 'Δx ≈ (3/5)·δ²/L'];
    }
    r.vyuziti = r.eps / (r.opakovane ? m.epsOpak : m.epsKr);
    return r;
  }

  /* ---------- kontroly ----------
     {uroven: 'chyba'|'varovani'|'info'|'ok', text, pole} – pole = klíč parametru. */
  function kontroly(p, r) {
    r = r || vypocet(p);
    const m = MATERIALY[p.material] || MATERIALY.PETG, H = [];
    const h = (uroven, text, pole) => H.push({ uroven, text, pole });
    const tKlic = { pant: 'pT', bistabil: 'bT', spona: 'sT', pruzina: 'rT', kriz: 'xT', paral: 'gT' }[p.typ];
    const t = p[tKlic];
    const pct = x => fmt(x * 100, 2) + ' %';
    // přetvoření proti mezi materiálu
    if (r.eps > m.epsKr) h('chyba', `Přetvoření ${pct(r.eps)} je nad krátkodobou mezí ${m.nazev} (${pct(m.epsKr)}) – díl praskne nebo zůstane trvale ohnutý. Zvětšete délku, zmenšete tloušťku nebo zvolte pružnější materiál.`, tKlic);
    else if (r.opakovane && r.eps > m.epsOpak) h('varovani', `Přetvoření ${pct(r.eps)} je nad mezí pro opakovaný ohyb ${m.nazev} (${pct(m.epsOpak)}) – vydrží jen několik ohybů.`, tKlic);
    else h('ok', `Přetvoření ${pct(r.eps)} ≤ ${r.opakovane ? 'mez opakovaného ohybu' : 'krátkodobá mez'} ${m.nazev} (${pct(r.opakovane ? m.epsOpak : m.epsKr)}).`, tKlic);
    // životnost jen kvalitativně
    const pom = r.eps / m.epsOpak;
    const zivot = pom <= 0.5 ? 'dlouhá – přetvoření je pod polovinou meze opakovaného ohybu' : pom <= 1 ? 'střední – blízko meze opakovaného ohybu' : r.eps <= m.epsKr ? 'krátká – jen občasné ohnutí (montáž, zacvaknutí)' : 'žádná – praskne při prvním ohybu';
    h('info', `Životnost (kvalitativně): ${zivot}. ${m.nazev}: ${m.cykly}.`, 'material');
    // tloušťka vůči trysce / vrstvě a orientace
    const naplocho = p.orientace === 'naplocho';
    const tlVrstvy = p.typ === 'pant' ? naplocho : p.orientace === 'nabok';
    if (tlVrstvy) {
      const nv = t / p.vrstva;
      if (nv < 1.999) h('chyba', `Tloušťka ${fmt(t, 2)} mm je méně než 2 vrstvy (${fmt(p.vrstva, 2)} mm) – pás se nevytiskne celistvě.`, tKlic);
      else if (Math.abs(nv - Math.round(nv)) > 0.05) h('varovani', `Tloušťka ${fmt(t, 2)} mm není násobkem výšky vrstvy (${fmt(nv, 2)} vrstvy) – slicer ji zaokrouhlí.`, tKlic);
      else h('ok', `Tloušťka pásu = ${Math.round(nv)} vrstvy po ${fmt(p.vrstva, 2)} mm.`, tKlic);
    } else {
      const no = t / p.tryska;
      if (no < 1.95) h('chyba', `Tloušťka ${fmt(t, 2)} mm je méně než 2 obvody trysky ${fmt(p.tryska, 2)} mm – stěna se vytiskne děravě nebo vůbec.`, tKlic);
      else h('ok', `Tloušťka ${fmt(t, 2)} mm ≈ ${fmt(no, 1)} šířky extruze (≥ 2 obvody).`, tKlic);
    }
    if (p.orientace === 'nastojato') h('chyba', 'Orientace nastojato: ohybové pásy stojí svisle, takže se při ohybu namáhají napříč vrstvami – spoje vrstev praskají. Tiskněte naplocho.', 'orientace');
    else if (p.orientace === 'nabok') {
      if (p.typ === 'pant' && p.pVarianta === 'krabicka') h('chyba', 'Krabičku na bok nelze vytisknout bez podpor – tiskněte naplocho (pant dole na podložce).', 'orientace');
      else if (p.typ === 'pant') h('varovani', 'Na bok: pant je tenká svislá stěna – ohyb v rovině vrstev je v pořádku, ale stěna z obvodů je citlivá na kvalitu tisku. Doporučeno naplocho.', 'orientace');
      else h('varovani', 'Na bok: ohyb zůstává v rovině vrstev, ale pásy visí vodorovně ve vzduchu (mosty, podpory) a tloušťku tvoří vrstvy. Doporučeno naplocho.', 'orientace');
    } else h('ok', 'Orientace naplocho: ohyb probíhá v rovině vrstev.', 'orientace');
    if (p.typ === 'pant' && naplocho) h('info', 'Pant tiskněte se 100% výplní a směrem výplně kolmo na osu pantu (vlákna podél ohybu). Po vytištění pant hned několikrát ohněte – vlákna se srovnají.', 'pT');

    // specifické kontroly
    if (p.typ === 'pant') {
      if (p.pTvar === 'rovny') h('varovani', 'Rovný přechod má ostré rohy, kde se přetvoření koncentruje – pant praská u desky. Doporučen rádius ≥ tloušťka.', 'pTvar');
      else if (p.pR < p.pT) h('varovani', `Rádius ${fmt(p.pR, 2)} mm je menší než tloušťka pantu – doporučeno R ≥ t.`, 'pR');
      if (p.pVarianta === 'krabicka') {
        const R = p.pTvar === 'radius' ? p.pR : 0;
        if (p.pT >= p.kDno - 0.2) h('chyba', `Pant (${fmt(p.pT, 2)} mm) musí být tenčí než dno (${fmt(p.kDno, 2)} mm).`, 'kDno');
        if (p.pT + R > p.kHv) h('chyba', 'Rádius přechodu je vyšší než víčko.', 'pR');
        if (p.kOsazeni && p.kOsH >= p.kHb - p.kDno) h('chyba', 'Osazení víčka je vyšší než vnitřní hloubka spodku – krabička nedovře.', 'kOsH');
        if (p.kOsazeni && p.kOsT + p.vule > Math.min(p.kDelka, p.kSirka) / 2 - 1) h('chyba', 'Osazení zabírá celý vnitřek víčka.', 'kOsT');
        if (p.kOsazeni && p.vule < 0.1) h('varovani', 'Vůle osazení pod 0,1 mm – víčko půjde ztuha nebo vůbec.', 'vule');
        if (p.kDno < 2 * p.vrstva) h('chyba', 'Dno je tenčí než 2 vrstvy.', 'kDno');
        if (p.kStena < 2 * p.tryska) h('chyba', 'Stěna je tenčí než 2 obvody trysky.', 'kStena');
      } else {
        if (p.pDeskaT <= p.pT + (p.pTvar === 'radius' ? p.pR : 0)) h('chyba', 'Deska musí být silnější než pant včetně rádiusu.', 'pDeskaT');
      }
    } else if (p.typ === 'bistabil') {
      const z = r.bistabil;
      if (!z.bistabilni) h('chyba', `Poměr h/t = ${fmt(z.Q, 2)} je pod 2,31 – nosník nemá druhou stabilní polohu a po uvolnění se vrátí. Zvětšete vzepětí nebo ztenčete nosník.`, 'bH');
      else if (z.Q < 2.6) h('varovani', `h/t = ${fmt(z.Q, 2)} je těsně nad mezí 2,31 – druhá poloha bude slabá, tolerance tisku ji může zrušit.`, 'bH');
      else h('ok', `h/t = ${fmt(z.Q, 2)} > 2,31 – dvě stabilní polohy (0 a ${fmt(z.d2, 2)} mm).`, 'bH');
      if (p.bH > 0.15 * p.bL) h('varovani', 'Vzepětí je přes 15 % rozpětí – mělký oblouk (model) přestává platit, výsledky jsou hrubší.', 'bH');
      if (p.bRozestup < p.bT + 1) h('chyba', 'Nosníky dvojice jsou příliš blízko u sebe.', 'bRozestup');
      if (p.bJezdec > 0.25 * p.bL) h('varovani', 'Široký jezdec zkracuje pružnou délku nosníků – skutečná síla bude vyšší.', 'bJezdec');
      if (p.vule < 0.15) h('varovani', 'Vůle štěrbiny jezdce pod 0,15 mm – jezdec se může přitavit k rámu.', 'vule');
    } else if (p.typ === 'spona') {
      const g = sponaGeom(p);
      if (p.sTk > p.sT) h('varovani', 'Tloušťka u háčku je větší než u kořene – použije se stálý průřez.', 'sTk');
      if (p.sMezera < 2 * p.sY) h('chyba', `Mezera mezi rameny (${fmt(p.sMezera, 2)} mm) je menší než 2 × výška háčku – ramena se při zasouvání srazí dřív, než háčky projdou.`, 'sMezera');
      if (p.sY - p.vule < 0.3) h('chyba', 'Přesah háčku po odečtení vůle je pod 0,3 mm – spona nebude držet.', 'sY');
      if (g.tK < 2 * p.tryska && p.orientace !== 'nabok') h('chyba', `Rameno u háčku (${fmt(g.tK, 2)} mm) je tenčí než 2 obvody trysky.`, 'sTk');
      if (p.sR < 0.25 * p.sT) h('varovani', `Zaoblení kořene ${fmt(p.sR, 2)} mm je pod 0,25·t – v kořeni vzniká vrub. Doporučeno R ≈ 0,5·t.`, 'sR');
      if (p.sL < 5 * p.sT) h('varovani', 'Rameno je kratší než 5 × tloušťka – krátké tlusté rameno se blíží smyku, nosníkový vzorec přestává platit.', 'sL');
      if (p.sProtikus) {
        if (p.sStena + p.vule > p.sL) h('chyba', `Stěna protikusu (${fmt(p.sStena, 2)} mm) je delší než rameno – háček nevyjde za okno.`, 'sStena');
        else if (p.sL - p.sStena > 1) h('info', `Spona bude mít v okně axiální vůli ${fmt(p.sL - p.sStena, 2)} mm (délka ramene − stěna).`, 'sStena');
      }
      if (p.sAlfa2 >= 80) h('info', 'Vysouvací úhel ≥ 80° – spona je nerozebíratelná, počítá se s krátkodobou mezí.', 'sAlfa2');
    } else if (p.typ === 'pruzina' && p.rVarianta === 'spirala') {
      const g = spiralaGeom(p);
      if (p.sRo <= p.sRi + p.rT) h('chyba', 'Vnější poloměr musí být větší než vnitřní.', 'sRo');
      if (g.mezera < Math.max(0.5, p.tryska)) h('chyba', `Mezera mezi závity ${fmt(g.mezera, 2)} mm je příliš malá – závity se slijí. Ubrat závity nebo zvětšit poloměr.`, 'sN');
      if (g.rh - g.otvor < 1.2) h('chyba', `Náboj kolem hřídele je slabý (${fmt(g.rh - g.otvor, 2)} mm) – zvětšete vnitřní poloměr spirály.`, 'sRi');
      if (p.sPlocha >= p.sHridel / 2) h('chyba', 'Zploštění je větší než poloměr hřídele.', 'sPlocha');
      const thStyk = 2 * PI * p.sN * g.mezera / g.stoupani;
      if (p.sUhel * RAD > thStyk) h('varovani', `Při natočení přes ≈ ${fmt(deg(thStyk), 0)}° se závity začnou dotýkat (hrubý odhad) – vzorec pak neplatí.`, 'sUhel');
    } else if (p.typ === 'pruzina') {
      const mez = p.hP - p.rT;
      if (mez < Math.max(0.5, p.tryska)) h('chyba', `Mezera mezi rameny ${fmt(mez, 2)} mm je příliš malá – ramena se slijí.`, 'hP');
      const g = hadGeom(p);
      if (g.w > p.hA * 0.8) h('varovani', 'Patka je široká vůči délce ramene – krajní ramena budou tužší.', 'hA');
      if (p.hZdvih > (p.hN) * (p.hP - p.rT) * 0.9) h('varovani', `Při stlačení o ${fmt(p.hZdvih, 1)} mm se ramena dotknou (volný prostor ≈ ${fmt(p.hN * (p.hP - p.rT), 1)} mm) – pro tlak zmenšete zdvih, v tahu nevadí.`, 'hZdvih');
    } else if (p.typ === 'kriz') {
      const g = krizGeom(p);
      if (p.xUhel * RAD > g.uhelNaraz) h('chyba', `Při ±${fmt(p.xUhel, 0)}° by bloky narazily (doraz ±${fmt(deg(g.uhelNaraz), 1)}°).`, 'xUhel');
      if (p.xVarianta === 'volny') {
        if (g.z1 < 2 * p.vrstva) h('chyba', 'Patro pásu je tenčí než 2 vrstvy – zvětšete výšku tisku nebo zmenšete mezeru.', 'xB');
        if (p.xMezeraZ < p.vrstva) h('chyba', `Mezera mezi patry (${fmt(p.xMezeraZ, 2)} mm) je menší než vrstva – pásy se v křížení slijí.`, 'xMezeraZ');
        h(p.xL > 30 ? 'varovani' : 'info', `Horní pás se tiskne jako most dlouhý ${fmt(p.xL, 0)} mm nad spodním – zapněte chlazení a mosty ve sliceru${p.xL > 30 ? '; přes 30 mm může prověšovat, zvažte provedení „kolo“' : ''}.`, 'xL');
      } else h('info', 'Kolo je 4× tužší a má 4× větší přetvoření než volné křížení stejné délky, zato se tiskne bez mostů.', 'xVarianta');
    } else {
      if (p.gD < p.gT + 1) h('chyba', 'Pásy jsou příliš blízko u sebe.', 'gD');
      if (p.gZdvih > 0.2 * p.gL) h('varovani', 'Posun je přes 20 % délky pásů – lineární teorie přestává platit (pásy se zkracují a tuhnou).', 'gZdvih');
    }
    if (p.vule < 0.1 && (p.typ === 'spona' || (p.typ === 'pruzina' && p.rVarianta === 'spirala'))) h('varovani', 'Vůle pod 0,1 mm – díly do sebe nejspíš nepůjdou.', 'vule');
    return H;
  }

  /* ---------- otočení do tiskové polohy ---------- */
  /** Naplocho = beze změny; na bok = otočit kolem X (y → z); nastojato = otočit kolem Y (x → z). */
  function natocSit(poz, orientace) {
    const out = new Float32Array(poz.length);
    for (let i = 0; i < poz.length; i += 3) {
      const x = poz[i], y = poz[i + 1], z = poz[i + 2];
      if (orientace === 'nabok') { out[i] = x; out[i + 1] = -z; out[i + 2] = y; }
      else if (orientace === 'nastojato') { out[i] = -z; out[i + 1] = y; out[i + 2] = x; }
      else { out[i] = x; out[i + 1] = y; out[i + 2] = z; }
    }
    return out;
  }

  /* ---------- odhady tisku ---------- */
  function odhadTisku(objem, vyska, p) {
    const m = MATERIALY[p.material] || MATERIALY.PETG;
    const hmotnost = objem / 1000 * m.hustota;
    const filament = objem / (PI * 0.875 * 0.875) / 1000;   // m filamentu 1,75 mm
    const cas = objem / 5 + (vyska / p.vrstva) * 4 + 60;     // s: průtok 5 mm³/s + přejezdy po vrstvách (hrubě)
    return { hmotnost, filament, cas };
  }

  /* ---------- předvolby ---------- */
  const PREDVOLBY = [
    { nazev: 'Zkušební živý pant (PP)', popis: 'dvě desky, pant 0,4 × 8 mm s rádiusem', p: { typ: 'pant', pVarianta: 'zkusebni', pTvar: 'radius', pT: 0.4, pL: 8, pR: 1, material: 'PP' } },
    { nazev: 'Krabička na drobnosti s pantem', popis: '50 × 30 × 19 mm, PP, víčko s osazením', p: { typ: 'pant', pVarianta: 'krabicka', pTvar: 'radius', pT: 0.4, pR: 1, kDelka: 50, kSirka: 30, kHb: 14, kHv: 5, material: 'PP' } },
    { nazev: 'Krabička na léky (PETG)', popis: 'nízká, tenký pant 0,4 mm', p: { typ: 'pant', pVarianta: 'krabicka', pTvar: 'radius', pT: 0.4, pR: 1, kDelka: 40, kSirka: 25, kHb: 12, kHv: 12, material: 'PETG' } },
    { nazev: 'Bistabilní přepínač', popis: 'L 60, h 3, t 0,8 mm, PETG', p: { typ: 'bistabil', bL: 60, bH: 3, bT: 0.8, bB: 8, material: 'PETG' } },
    { nazev: 'Šipková spona do panelu 2 mm', popis: 'nerozebíratelná, PETG', p: { typ: 'spona', sL: 14, sT: 1.6, sTk: 1.2, sY: 1, sAlfa: 30, sAlfa2: 90, sStena: 2, material: 'PETG' } },
    { nazev: 'Rozebíratelná spona (PLA)', popis: 'vysouvací úhel 45°, dlouhé rameno', p: { typ: 'spona', sL: 20, sT: 1.6, sTk: 0.8, sY: 0.8, sAlfa: 30, sAlfa2: 45, sStena: 3, sMezera: 2.4, material: 'PLA' } },
    { nazev: 'Hadovitá pružina (PETG)', popis: '6 ohybů, rameno 20 mm', p: { typ: 'pruzina', rVarianta: 'had', rT: 0.8, rB: 6, hN: 6, hA: 20, hP: 4, hZdvih: 5, material: 'PETG' } },
    { nazev: 'Spirálová pružina (nylon)', popis: '3 závity, Ø 56 mm, hřídel 5 mm s plochou', p: { typ: 'pruzina', rVarianta: 'spirala', rT: 0.8, rB: 6, sN: 3, sRi: 6, sRo: 25, material: 'PA' } },
    { nazev: 'Křížový kloub – volné křížení', popis: 'L 20 mm, ±15°, PETG', p: { typ: 'kriz', xVarianta: 'volny', xL: 20, xT: 0.8, xB: 8, xUhel: 15, material: 'PETG' } },
    { nazev: 'Křížový kloub – kolo', popis: 'L 30 mm, ±10°, PETG, bez mostů', p: { typ: 'kriz', xVarianta: 'kolo', xL: 30, xT: 0.8, xB: 8, xUhel: 10, material: 'PETG' } },
    { nazev: 'Paralelogramové vedení', popis: 'pásy 30 mm, posun ±2 mm', p: { typ: 'paral', gL: 30, gT: 0.8, gD: 20, gZdvih: 2, material: 'PETG' } },
  ];
  function zPredvolby(i) { const v = PREDVOLBY[i]; return normalizuj(Object.assign(vychozi(v.p.typ), { nazev: v.nazev }, v.p)).p; }

  /* ---------- projekt JSON ---------- */
  const FORMAT = 'webapp_pruzne', VERZE = 1;
  const ulozProjekt = p => JSON.stringify({ format: FORMAT, verze: VERZE, ulozeno: new Date().toISOString(), projekt: p }, null, 2);
  function nactiProjekt(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
    if (!o || o.format !== FORMAT) throw new Error('Soubor není projekt pružného mechanismu (chybí "format": "webapp_pruzne").');
    if (!(o.verze >= 1) || o.verze > VERZE) throw new Error(`Nepodporovaná verze projektu ${o.verze}.`);
    return normalizuj(o.projekt);
  }

  const API = {
    DATUM_DAT, MATERIALY, TYPY, ORIENTACE, PARAMETRY, PODLE_KLICE, PREDVOLBY, viditelny,
    vychozi, normalizuj, zPredvolby, kopie, fmt,
    zivyPant, sponaRameno, silaSpony, bistabilniNosnik, hadPruzina, delkaSpiraly, spirala, krizovyKloub, paralelogram,
    koutovy, tlustaKrivka, kruh, vysec, oblouk,
    plan, sponaGeom, spiralaGeom, krizGeom, bistabilGeom, hadGeom, vypocet, kontroly, natocSit, odhadTisku, ulozProjekt, nactiProjekt,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.PRUZ = API;
})();

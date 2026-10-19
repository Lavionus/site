/* ============================================================
   Technický generátor pro tisk – ovládání stránky.
   Formuláře se staví ze schémat; každá změna přepočítá kresbu, rozvrh listů a náhled.
   Stav se ukládá do localStorage (webapp_tech_tisk) a dá se sdílet odkazem (#s=…).
   ============================================================ */
(function () {
  'use strict';
  const TT = window.TT, fmt = TT.fmt;
  const $ = (id) => document.getElementById(id);
  const KLIC = 'webapp_tech_tisk', KLIC_KAL = 'webapp_tech_tisk_pxmm';
  const kopie = (o) => JSON.parse(JSON.stringify(o));

  /* ---------- schémata formulářů ---------- */
  const F = (id, typ, popis, x) => Object.assign({ id, typ, popis }, x || {});
  const H = (nadpis) => ({ nadpis });
  const C = (id, popis, jedn, x) => F(id, 'cislo', popis, Object.assign({ jedn }, x || {}));
  const SYSTEMY = [['mm', 'metrická (mm / cm)'], ['pi', 'π-páska – průměr z obvodu'], ['in16', 'palce, dělení 1/16"'], ['in32', 'palce, dělení 1/32"'], ['in10', 'palce desetinné (1/10")'], ['zadna', '— žádná —']];
  const MERITKA = [1, 2, 2.5, 5, 10, 20, 25, 50, 75, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000].map((m) => [m, m === 1 ? '1:1 (skutečná velikost)' : '1:' + m]);
  const metr = (s) => s === 'mm' || s === 'pi';

  const SCHEMA = {
    pravitko: [
      H('Stupnice'),
      C('delka', 'Délka stupnice', 'mm', { min: 5, max: 5000, napoveda: 'Delší pravítko se samo rozdělí na díly; úzké pásy se poskládají pod sebe na jeden list.' }),
      F('horni', 'vyber', 'Horní hrana', { moznosti: SYSTEMY, pul: true }),
      F('dolni', 'vyber', 'Dolní hrana', { moznosti: SYSTEMY, pul: true }),
      F('meritko', 'vyber', 'Měřítko', { moznosti: MERITKA, cislo: true, pul: true, kdy: (o) => metr(o.horni) || metr(o.dolni) }),
      F('meritkoDolni', 'vyber', 'Měřítko dolní hrany', { moznosti: [[0, 'stejné']].concat(MERITKA), cislo: true, pul: true, kdy: (o) => metr(o.dolni) && o.horni !== 'zadna' }),
      F('jednotka', 'vyber', 'Popisky', { moznosti: [['auto', 'automaticky'], ['mm', 'v mm'], ['cm', 'v cm'], ['m', 'v m']], pul: true, kdy: (o) => metr(o.horni) || metr(o.dolni) }),
      F('smer', 'vyber', 'Nula', { moznosti: [['zleva', 'vlevo'], ['zprava', 'vpravo (leváci)']], pul: true, kdy: (o) => !o.stredNula }),
      F('stredNula', 'zaskrt', 'Nula uprostřed (měření od osy)'),
      H('Tvar'),
      C('sirka', 'Šířka pravítka', 'mm', { pul: true, min: 5 }), C('rysky', 'Nejdelší ryska', 'mm', { pul: true, min: 1 }),
      C('nabeh', 'Náběh před nulou', 'mm', { pul: true, min: 0 }), C('dobeh', 'Doběh za koncem', 'mm', { pul: true, min: 0 }),
      C('pismo', 'Výška číslic', 'mm', { pul: true, min: 0.8 }), C('tl', 'Tloušťka rysek', 'mm', { pul: true, min: 0.05 }),
      F('obrys', 'zaskrt', 'Obrys k vystřižení', { pul: true }), C('rohy', 'Zaoblení rohů', 'mm', { pul: true, min: 0, kdy: (o) => o.obrys }),
      C('otvor', 'Otvor na pověšení ⌀ (0 = bez)', 'mm', { min: 0 }),
      F('popisek', 'text', 'Popisek na pravítku'),
    ],
    uhlomer: [
      H('Stupnice'),
      F('rozsah', 'vyber', 'Rozsah', { moznosti: [[180, 'půlkruh 180°'], [360, 'plný kruh 360°']], cislo: true, pul: true }),
      F('jednotka', 'vyber', 'Jednotky', { moznosti: [['deg', 'stupně (360°)'], ['gon', 'gradiány (400 g)'], ['mil', 'dílce NATO (6400)']], pul: true }),
      C('r', 'Poloměr stupnice', 'mm', { pul: true, min: 15 }),
      F('jemne', 'vyber', 'Nejjemnější dílek', { moznosti: [['auto', 'automaticky'], ['0.5', '0,5'], ['1', '1'], ['2', '2'], ['5', '5'], ['10', '10'], ['20', '20 (dílce)']], pul: true }),
      F('dvojite', 'zaskrt', 'Druhá řada čísel (opačný směr)'),
      F('paprsky', 'zaskrt', 'Pomocné paprsky po 45°', { pul: true }), F('kriz', 'zaskrt', 'Středový kříž', { pul: true }),
      H('Tvar'),
      C('rysky', 'Nejdelší ryska', 'mm', { pul: true, min: 2 }), C('pismo', 'Výška číslic', 'mm', { pul: true, min: 1 }),
      C('tl', 'Tloušťka rysek', 'mm', { pul: true, min: 0.05 }), C('zakladna', 'Pás pod základnou', 'mm', { pul: true, min: 0, kdy: (o) => +o.rozsah !== 360 }),
      C('otvor', 'Středový otvor ⌀ (0 = bod)', 'mm', { min: 0 }),
      F('obrys', 'zaskrt', 'Obrys k vystřižení'),
      F('popisek', 'text', 'Popisek'),
    ],
    kruhova: [
      H('Dělení'),
      C('dilku', 'Počet hlavních dílků', '', { pul: true, min: 1, cele: true }), C('pod', 'Poddělení dílku', '×', { pul: true, min: 1, cele: true }),
      C('rozsah', 'Rozsah stupnice', '°', { pul: true, min: 1, max: 360 }), C('t0', 'Počátek (0° = nahoře)', '°', { pul: true }),
      F('smer', 'vyber', 'Směr', { moznosti: [['cw', 'po směru hodin'], ['ccw', 'proti směru hodin']], pul: true }),
      F('orientace', 'vyber', 'Čísla', { moznosti: [['tecna', 'po obvodu'], ['radialni', 'paprskovitě'], ['vzpriam', 'vzpřímeně']], pul: true }),
      C('od', 'První hodnota', '', { pul: true }), C('krok', 'Přírůstek na dílek', '', { pul: true }),
      C('popisKazdy', 'Číslovat každý', '. dílek', { pul: true, min: 1, cele: true }),
      F('desetin', 'vyber', 'Desetinná místa', { moznosti: [['auto', 'automaticky'], ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3']], pul: true }),
      H('Tvar'),
      C('r', 'Poloměr stupnice', 'mm', { pul: true, min: 5 }), C('rysky', 'Nejdelší ryska', 'mm', { pul: true, min: 1 }),
      C('pismo', 'Výška číslic', 'mm', { pul: true, min: 0.8 }), C('tl', 'Tloušťka rysek', 'mm', { pul: true, min: 0.05 }),
      F('ven', 'zaskrt', 'Rysky ven (stupnice na obvodu kotouče)'),
      F('kruznice', 'zaskrt', 'Základní kružnice', { pul: true }), F('ukazatel', 'zaskrt', 'Značka nuly ▲', { pul: true }),
      F('kriz', 'zaskrt', 'Středový kříž', { pul: true }),
      C('otvor', 'Středový otvor ⌀', 'mm', { pul: true, min: 0 }), C('vnejsiD', 'Vnější obrys ⌀ (0 = bez)', 'mm', { pul: true, min: 0 }),
      H('Dělicí kotouč'),
      C('indexD', 'Dělicí otvory ⌀ (0 = bez)', 'mm', { pul: true, min: 0 }), C('indexR', 'na poloměru', 'mm', { pul: true, min: 0, kdy: (o) => +o.indexD > 0 }),
      F('popisek', 'text', 'Popisek'),
    ],
    mrizka: [
      H('Druh'),
      F('typ', 'vyber', 'Mřížka', { moznosti: [['kart', 'pravoúhlá (milimetrová)'], ['tecky', 'tečkový rastr'], ['iso', 'izometrická (30°)'], ['polar', 'polární (kružnice + paprsky)']] }),
      F('vyplnit', 'zaskrt', 'Vyplnit celý list'),
      C('w', 'Šířka', 'mm', { pul: true, min: 5, kdy: (o) => !o.vyplnit }), C('h', 'Výška', 'mm', { pul: true, min: 5, kdy: (o) => !o.vyplnit }),
      C('krok', 'Krok', 'mm', { pul: true, min: 0.1, kdy: (o) => o.typ !== 'polar' }),
      C('stredni', 'Zvýraznit každou', '. čáru', { pul: true, min: 1, cele: true, kdy: (o) => o.typ !== 'polar' }),
      C('hlavni', 'Silně každou', '. čáru', { pul: true, min: 1, cele: true, kdy: (o) => o.typ !== 'polar' }),
      F('pocatek', 'vyber', 'Počátek souřadnic', { moznosti: [['vlevo-dole', 'vlevo dole (Y nahoru)'], ['stred', 'uprostřed (Y nahoru)'], ['vlevo-nahore', 'vlevo nahoře (Y dolů)']], pul: true, kdy: (o) => o.typ === 'kart' || o.typ === 'tecky' }),
      C('rKrok', 'Kružnice po', 'mm', { pul: true, min: 0.5, kdy: (o) => o.typ === 'polar' }),
      C('rHlavni', 'Silně každou', '. kružnici', { pul: true, min: 1, cele: true, kdy: (o) => o.typ === 'polar' }),
      C('uhelJemny', 'Paprsky po', '°', { pul: true, min: 0.5, kdy: (o) => o.typ === 'polar' }),
      C('uhel', 'Zvýrazněné po', '°', { pul: true, min: 1, kdy: (o) => o.typ === 'polar' }),
      H('Vzhled'),
      F('barva', 'vyber', 'Barvy', { moznosti: [['seda', 'šedá'], ['cerna', 'černá'], ['modra', 'modrá'], ['oranzova', 'oranžová (milimetrový papír)']], pul: true }),
      F('popisy', 'zaskrt', 'Popsat souřadnice', { pul: true }),
      C('popisKazdy', 'Popis u každé', '. čáry', { pul: true, min: 1, cele: true, kdy: (o) => o.popisy && (o.typ === 'kart' || o.typ === 'tecky') }),
      C('pismo', 'Výška písma', 'mm', { pul: true, min: 0.8, kdy: (o) => o.popisy }),
      C('tlJemna', 'Tenká čára', 'mm', { pul: true, min: 0.02 }), C('tlHlavni', 'Silná čára', 'mm', { pul: true, min: 0.02 }),
      F('osy', 'zaskrt', 'Zvýraznit osy', { pul: true }), F('ramec', 'zaskrt', 'Rámeček', { pul: true, kdy: (o) => o.typ !== 'polar' }),
    ],
  };

  const OBRYS_SABLONY = [
    H('Šablona'),
    F('obrys', 'vyber', 'Obrys', { moznosti: [['obd', 'obdélník (počátek vlevo dole)'], ['kruh', 'kruh (počátek uprostřed)'], ['auto', 'kolem otvorů'], ['zadny', 'bez obrysu']] }),
    C('w', 'Šířka', 'mm', { pul: true, min: 1, kdy: (o) => o.obrys === 'obd' }), C('h', 'Výška', 'mm', { pul: true, min: 1, kdy: (o) => o.obrys === 'obd' }),
    C('D', 'Průměr', 'mm', { pul: true, min: 1, kdy: (o) => o.obrys === 'kruh' }),
    C('okraj', 'Okraj kolem otvorů', 'mm', { pul: true, min: 0, kdy: (o) => o.obrys === 'auto' }),
    C('rohy', 'Zaoblení rohů', 'mm', { pul: true, min: 0, kdy: (o) => o.obrys === 'obd' || o.obrys === 'auto' }),
    F('zarazka', 'zaskrt', 'Zvýraznit vztažné hrany / počátek'),
    F('kotovani', 'vyber', 'Souřadnice', { moznosti: [['tabulka', 'tabulka vedle šablony'], ['souradnice', 'u každého otvoru'], ['obe', 'obojí'], ['zadne', 'nevypisovat']], pul: true }),
    F('cislovat', 'zaskrt', 'Číslovat otvory', { pul: true }),
    C('kriz', 'Přesah kříže za otvor', 'mm', { pul: true, min: 0 }), C('pismo', 'Výška písma', 'mm', { pul: true, min: 0.8 }),
    C('tl', 'Tloušťka čar', 'mm', { pul: true, min: 0.05 }),
    F('popisek', 'text', 'Popisek'),
  ];

  const DRUHY_VZORU = {
    kruh: 'Otvory na kružnici (PCD)', oblouk: 'Otvory na oblouku', rada: 'Řada otvorů', mrizka: 'Matice otvorů',
    body: 'Vlastní souřadnice', predvolba: 'Předvolba (VESA, NEMA, …)',
  };
  const moznostiPredvoleb = () => TT.PREDVOLBY.map((p) => [p.id, p.nazev, p.sk]);
  const SCHEMA_VZORU = {
    kruh: [C('x', 'Střed X', 'mm', { pul: true }), C('y', 'Střed Y', 'mm', { pul: true }), C('D', 'Roztečná kružnice ⌀', 'mm', { pul: true, min: 0 }),
      C('n', 'Počet otvorů', '', { pul: true, min: 1, cele: true }), C('a0', 'Úhel prvního (0° = vpravo)', '°', { pul: true }),
      F('smer', 'vyber', 'Číslovat', { moznosti: [['ccw', 'proti směru hodin'], ['cw', 'po směru hodin']], pul: true }), C('d', 'Průměr otvoru', 'mm', { pul: true, min: 0 })],
    oblouk: [C('x', 'Střed X', 'mm', { pul: true }), C('y', 'Střed Y', 'mm', { pul: true }), C('D', 'Roztečná kružnice ⌀', 'mm', { pul: true, min: 0 }),
      C('n', 'Počet otvorů', '', { pul: true, min: 1, cele: true }), C('a1', 'Od úhlu', '°', { pul: true }), C('a2', 'Do úhlu', '°', { pul: true }), C('d', 'Průměr otvoru', 'mm', { pul: true, min: 0 })],
    rada: [C('x', 'Začátek X', 'mm', { pul: true }), C('y', 'Začátek Y', 'mm', { pul: true }), C('uhel', 'Natočení řady', '°', { pul: true }),
      F('rezim', 'vyber', 'Zadat', { moznosti: [['roztec', 'rozteč'], ['rozdelit', 'rozdělit délku']], pul: true }),
      C('n', 'Počet otvorů', '', { pul: true, min: 1, cele: true }), C('roztec', 'Rozteč', 'mm', { pul: true, kdy: (o) => o.rezim !== 'rozdelit' }),
      C('L', 'Délka', 'mm', { pul: true, min: 0, kdy: (o) => o.rezim === 'rozdelit' }), C('okraj', 'Okraj ke krajním osám', 'mm', { pul: true, min: 0, kdy: (o) => o.rezim === 'rozdelit' }),
      C('d', 'Průměr otvoru', 'mm', { pul: true, min: 0 })],
    mrizka: [C('x', 'První otvor X', 'mm', { pul: true }), C('y', 'První otvor Y', 'mm', { pul: true }),
      C('nx', 'Sloupců', '', { pul: true, min: 1, cele: true }), C('ny', 'Řad', '', { pul: true, min: 1, cele: true }),
      C('px', 'Rozteč X', 'mm', { pul: true }), C('py', 'Rozteč Y', 'mm', { pul: true }),
      F('stridat', 'zaskrt', 'Sudé řady posunout o ½ rozteče', {}), F('zkratit', 'zaskrt', 'Posunuté řady o otvor kratší', { kdy: (o) => o.stridat }),
      C('uhel', 'Natočení', '°', { pul: true }), C('d', 'Průměr otvoru', 'mm', { pul: true, min: 0 })],
    body: [F('text', 'textarea', 'Otvory – řádek „X Y [průměr] [popis]“', { napoveda: 'Oddělte mezerou nebo středníkem, desetinná čárka i tečka, # komentář. Bez průměru se použije výchozí.' }),
      C('d', 'Výchozí průměr', 'mm', { pul: true, min: 0 }), C('x', 'Posun X', 'mm', { pul: true }), C('y', 'Posun Y', 'mm', { pul: true })],
    predvolba: [F('id', 'vyber', 'Předvolba', { moznosti: moznostiPredvoleb() }), C('x', 'Střed X', 'mm', { pul: true }), C('y', 'Střed Y', 'mm', { pul: true }), C('uhel', 'Natočení', '°', { pul: true })],
  };
  const VYCHOZI_VZOR = {
    kruh: { typ: 'kruh', x: 0, y: 0, D: 80, n: 6, a0: 90, smer: 'ccw', d: 6.6 },
    oblouk: { typ: 'oblouk', x: 0, y: 0, D: 80, n: 5, a1: 0, a2: 180, d: 5 },
    rada: { typ: 'rada', x: 10, y: 10, uhel: 0, rezim: 'roztec', n: 8, roztec: 32, L: 300, okraj: 37, d: 5 },
    mrizka: { typ: 'mrizka', x: 10, y: 10, nx: 4, ny: 3, px: 20, py: 20, stridat: false, zkratit: false, uhel: 0, d: 4 },
    body: { typ: 'body', text: '10 10 4\n50 10 4\n30 40 8 střed', d: 3, x: 0, y: 0 },
    predvolba: { typ: 'predvolba', id: 'vesa100', x: 0, y: 0, uhel: 0 },
  };

  const SCHEMA_TISK = [
    F('papir', 'vyber', 'Papír', { moznosti: [['A4', 'A4 (210 × 297)'], ['A3', 'A3 (297 × 420)'], ['A5', 'A5 (148 × 210)'], ['A2', 'A2 (420 × 594)'], ['Letter', 'Letter (216 × 279)'], ['Legal', 'Legal (216 × 356)'], ['vlastni', 'vlastní…']], pul: true }),
    F('orientace', 'vyber', 'Orientace', { moznosti: [['auto', 'automaticky'], ['v', 'na výšku'], ['s', 'na šířku']], pul: true }),
    C('pw', 'Šířka papíru', 'mm', { pul: true, min: 30, kdy: (o) => o.papir === 'vlastni' }), C('ph', 'Výška papíru', 'mm', { pul: true, min: 30, kdy: (o) => o.papir === 'vlastni' }),
    C('okraj', 'Okraje', 'mm', { pul: true, min: 0, max: 40, napoveda: '' }), C('prekryv', 'Překryv dílů', 'mm', { pul: true, min: 6, max: 40 }),
    F('rez', 'vyber', 'Obrys k vystřižení', { moznosti: [['sede', 'tisknout šedě'], ['cerne', 'tisknout černě'], ['skryt', 'netisknout']], pul: true }),
    F('paticka', 'zaskrt', 'Patička s kalibrací', { pul: true }),
    F('prizpusobit', 'zaskrt', 'Přizpůsobovat předlohy listu', { napoveda: 'Předloha bez pevného rozměru se po výběru i po změně papíru roztáhne přes celou tisknutelnou plochu.' }),
    C('kopie', 'Kopií (0 = plný list)', '×', { pul: true, min: 0, max: 400, cele: true }),
    C('mezeraKopii', 'Mezera mezi kopiemi', 'mm', { pul: true, min: 0, max: 50, kdy: (o) => +o.kopie !== 1 }),
  ];
  const SCHEMA_KOREKCE = [
    C('merX', 'Úsečka 100 mm měří', 'mm', { pul: true, min: 50, max: 150 }), C('merY', 'Svislých 50 mm měří', 'mm', { pul: true, min: 25, max: 75 }),
    F('korekce', 'zaskrt', 'Použít korekci'),
  ];

  /* ---------- předvolby režimů ---------- */
  const PREDVOLBY = {
    pravitko: [
      ['Pravítko na celou šíři listu', {}],
      ['Školní pravítko 15 cm', { delka: 150 }],
      ['Milimetry a palce (na list)', { dolni: 'in16', sirka: 34 }],
      ['30 cm', { delka: 300 }],
      ['1 m – pásy na jeden list', { delka: 1000, sirka: 22, rysky: 5.5, pismo: 2.4 }],
      ['Nula uprostřed (na list)', { stredNula: true, jednotka: 'mm', pismo: 2.2 }],
      ['Měřítko 1:100 a 1:50 (stavební)', { meritko: 100, dolni: 'mm', meritkoDolni: 50, sirka: 34, popisek: 'stavební měřítko' }],
      ['Měřítko 1:1000 a 1:500 (mapy)', { meritko: 1000, dolni: 'mm', meritkoDolni: 500, sirka: 34, popisek: 'mapové měřítko' }],
      ['π-páska – průměr trubek z obvodu', { delka: 600, horni: 'pi', dolni: 'mm', sirka: 30, popisek: 'oviňte kolem trubky – nahoře průměr' }],
      ['Palcové 6" (1/32")', { delka: 152.4, horni: 'in32', dolni: 'mm', sirka: 34 }],
      ['Pro leváky (nula vpravo)', { smer: 'zprava' }],
      ['Řezací – nula na hraně, bez náběhu', { nabeh: 0, rohy: 0, sirka: 30 }],
      ['Krejčovský metr 150 cm (pásy)', { delka: 1500, sirka: 18, rysky: 5, pismo: 2.2, dolni: 'zadna', rohy: 1, popisek: '' }],
      ['Měřítko 1:20 a 1:25 (strojní výkresy)', { meritko: 20, dolni: 'mm', meritkoDolni: 25, sirka: 34 }],
      ['Měřítko 1:5 a 1:10', { meritko: 5, dolni: 'mm', meritkoDolni: 10, sirka: 34 }],
      ['Měřítko 1:25 000 / 1:50 000 (turistické mapy)', { meritko: 25000, dolni: 'mm', meritkoDolni: 50000, sirka: 34, popisek: 'mapy KČT' }],
      ['Záložka do knihy 15 cm s otvorem', { delka: 150, sirka: 40, otvor: 5, dobeh: 14, rohy: 4, popisek: 'záložka' }],
      ['Palcové 12" (1/16") + cm', { delka: 304.8, horni: 'in16', dolni: 'mm', sirka: 34 }],
    ],
    uhlomer: [
      ['Úhloměr 180° na celý list', {}],
      ['Úhloměr 180°, r 80 mm', { r: 80 }],
      ['Plný kruh 360° na celý list', { rozsah: 360 }],
      ['Plný kruh 360°, r 90 mm', { rozsah: 360, r: 90 }],
      ['Velký 180°, r 120 mm, po ½°', { r: 120, jemne: '0.5', pismo: 3 }],
      ['Gradiány (400 g)', { jednotka: 'gon', rozsah: 360, r: 90 }],
      ['Dílce NATO (6400)', { jednotka: 'mil', rozsah: 360, r: 88, dvojite: false }],
      ['Malý do penálu 180°, r 50 mm', { r: 50, rysky: 4, pismo: 2, zakladna: 7 }],
      ['Úhloměr s otvorem na kružítko', { otvor: 3 }],
      ['Bez pomocných čar (čistý)', { paprsky: false, dvojite: false }],
      ['Plný kruh 360°, r 120 mm po ½°', { rozsah: 360, r: 120, jemne: '0.5', pismo: 3 }],
    ],
    kruhova: [
      ['Dělicí kotouč 36 × 10° na celý list', { indexD: 3, indexR: 33 }],
      ['Dělicí kotouč 36 × 10°, Ø 104', { indexD: 3, indexR: 33, r: 48 }],
      ['Úhlová stupnice 360° po 1°', { dilku: 36, pod: 10, r: 60, vnejsiD: 128, rysky: 6 }],
      ['Azimutová růžice', { dilku: 72, pod: 1, krok: 5, popisKazdy: 6, r: 60, vnejsiD: 128 }],
      ['Stupnice 100 dílků (mikrometr)', { dilku: 100, pod: 1, krok: 1, popisKazdy: 10, r: 50, vnejsiD: 108, rysky: 5 }],
      ['Knoflík potenciometru 0–10 / 300°', { dilku: 10, pod: 5, rozsah: 300, t0: -150, od: 0, krok: 1, r: 16, rysky: 2.5, pismo: 2.4, ven: true, kruznice: false, vnejsiD: 0, otvor: 7, ukazatel: false, kriz: false }],
      ['Stupnice 0–100 % / 270°', { dilku: 10, pod: 10, rozsah: 270, t0: -135, krok: 10, r: 40, vnejsiD: 92, otvor: 6, ukazatel: false }],
      ['Ciferník 60 minut', { dilku: 60, pod: 1, krok: 1, popisKazdy: 5, r: 50, vnejsiD: 110, rysky: 4, orientace: 'vzpriam', pismo: 3.5 }],
      ['Ciferník hodin 12 (1–12)', { dilku: 12, pod: 5, od: 0, krok: 1, r: 50, vnejsiD: 110, pismo: 5, orientace: 'vzpriam', nulaJako: 12 }],
      ['Dělicí kotouč 24 × 15°', { dilku: 24, krok: 15, indexD: 3, indexR: 33, popisKazdy: 1 }],
      ['Dělicí kotouč 60 × 6°', { dilku: 60, krok: 6, popisKazdy: 5, indexD: 2.5, indexR: 34, r: 48, rysky: 5 }],
      ['Otočný stůl 360° r 80, po ½°', { dilku: 36, pod: 20, krok: 10, r: 80, vnejsiD: 176, rysky: 6, pismo: 3, otvor: 10 }],
      ['Nonius – 10 dílků na 9°', { dilku: 10, pod: 1, rozsah: 9, t0: -4.5, krok: 1, popisKazdy: 5, r: 80, vnejsiD: 0, otvor: 0, kriz: false, ukazatel: false, rysky: 6, pismo: 2.4, ven: true, kruznice: true }],
      ['Knoflík 1–11 / 300° (zesilovač)', { dilku: 10, pod: 2, rozsah: 300, t0: -150, od: 1, krok: 1, r: 20, rysky: 3, pismo: 2.6, ven: true, kruznice: false, vnejsiD: 0, otvor: 6.5, ukazatel: false, kriz: false }],
    ],
    mrizka: [
      ['Milimetrová mřížka', {}],
      ['Čtverečky 5 mm', { krok: 5, stredni: 2, hlavni: 2, popisKazdy: 2, tlJemna: 0.1 }],
      ['Souřadnice od středu', { pocatek: 'stred' }],
      ['Milimetrový papír (oranžový)', { barva: 'oranzova', popisy: false }],
      ['Rastr 2,54 mm (DPS, tečky)', { typ: 'tecky', krok: 2.54, stredni: 4, hlavni: 10, popisKazdy: 10 }],
      ['Izometrická 5 mm', { typ: 'iso', krok: 5, stredni: 1, hlavni: 5 }],
      ['Polární mřížka', { typ: 'polar' }],
      ['Čtverečky 10 mm', { krok: 10, stredni: 5, hlavni: 5, popisKazdy: 1, tlJemna: 0.15 }],
      ['Rastr 1/4" (6,35 mm)', { krok: 6.35, stredni: 4, hlavni: 4, popisKazdy: 4 }],
      ['Tečky 5 mm (bullet journal)', { typ: 'tecky', krok: 5, stredni: 2, hlavni: 2, popisy: false, ramec: false, osy: false }],
      ['Modrá technická, souřadnice od středu', { barva: 'modra', pocatek: 'stred', popisKazdy: 20 }],
      ['Polární 360° po 10°, kružnice po 10 mm', { typ: 'polar', rKrok: 10, rHlavni: 5, uhel: 30, uhelJemny: 10 }],
      ['Izometrická 10 mm', { typ: 'iso', krok: 10, stredni: 1, hlavni: 5 }],
    ],
    sablona: [
      ['Deska 100 × 70 s motorem NEMA 17', null],
      ['Držák monitoru VESA 75 + 100', { skupiny: [{ typ: 'predvolba', id: 'vesa100', x: 0, y: 0, uhel: 0 }, { typ: 'predvolba', id: 'vesa75', x: 0, y: 0, uhel: 0 }], o: { obrys: 'kruh', D: 160 } }],
      ['Ventilátor 120 mm', { skupiny: [{ typ: 'predvolba', id: 'vent120', x: 0, y: 0, uhel: 0 }], o: { obrys: 'auto', okraj: 8, rohy: 6 } }],
      ['Raspberry Pi 4/5', { skupiny: [{ typ: 'predvolba', id: 'rpi4', x: 42.5, y: 28, uhel: 0 }], o: { obrys: 'obd', w: 85, h: 56, rohy: 3 } }],
      ['Úchytka 128 mm na dvířka', { skupiny: [{ typ: 'predvolba', id: 'uchytka128', x: 0, y: 0, uhel: 0 }], o: { obrys: 'auto', okraj: 15 } }],
      ['Systém 32 – řada kolíčků ⌀5', { skupiny: [{ typ: 'rada', x: 37, y: 9.5, uhel: 90, rezim: 'roztec', n: 9, roztec: 32, d: 5, L: 300, okraj: 0 }], o: { obrys: 'obd', w: 60, h: 275, rohy: 0, zarazka: true } }],
      ['Arduino Uno R3', { skupiny: [{ typ: 'predvolba', id: 'uno', x: 34.29, y: 26.67, uhel: 0 }], o: { obrys: 'obd', w: 68.58, h: 53.34, rohy: 1 } }],
      ['Ventilátor 80 mm + krokový motor NEMA 23', { skupiny: [{ typ: 'predvolba', id: 'vent80', x: 50, y: 50, uhel: 0 }, { typ: 'predvolba', id: 'nema23', x: 150, y: 50, uhel: 0 }], o: { obrys: 'obd', w: 200, h: 100, rohy: 3 } }],
      ['Perfboard 2,54 mm – 20 × 10 děr', { skupiny: [{ typ: 'mrizka', x: 3.81, y: 3.81, nx: 20, ny: 10, px: 2.54, py: 2.54, d: 1, uhel: 0, stridat: false, zkratit: false }], o: { obrys: 'obd', w: 55.88, h: 30.48, kotovani: 'zadne', cislovat: false, kriz: 0.6, rohy: 0 } }],
      ['Konektor DE-9 + DB-25 na panel', { skupiny: [{ typ: 'predvolba', id: 'de9', x: 30, y: 20, uhel: 0 }, { typ: 'predvolba', id: 'db25', x: 90, y: 20, uhel: 0 }], o: { obrys: 'obd', w: 130, h: 40 } }],
      ['Raspberry Pi Zero', { skupiny: [{ typ: 'predvolba', id: 'rpizero', x: 32.5, y: 15, uhel: 0 }], o: { obrys: 'obd', w: 65, h: 30, rohy: 3 } }],
      ['Příruba – 8 otvorů na ⌀120', { skupiny: [{ typ: 'kruh', x: 0, y: 0, D: 120, n: 8, a0: 22.5, smer: 'ccw', d: 13.5 }, { typ: 'body', text: '0 0 60 vnitřní', d: 0, x: 0, y: 0 }], o: { obrys: 'kruh', D: 160 } }],
    ],
    roztece: [
      ['Roztečná kružnice 6 × M6 na ⌀80', null],
      ['5 otvorů na oblouku 0–180°', { typ: 'oblouk' }],
      ['Řada – rozdělit 600 mm na 6 otvorů', { typ: 'rada', rezim: 'rozdelit', n: 6, L: 600, okraj: 30, x: 0, y: 0, d: 8 }],
      ['Matice 5 × 4 po 15 mm', { typ: 'mrizka', nx: 5, ny: 4, px: 15, py: 15, x: 0, y: 0 }],
      ['Šestiúhelníková matice (střídavá)', { typ: 'mrizka', nx: 6, ny: 5, px: 12, py: 10.392, stridat: true, x: 0, y: 0, d: 8 }],
      ['Příruba DN 50 PN 16 – 4 × M16 na Ø125', { typ: 'kruh', D: 125, n: 4, a0: 45, d: 18 }],
      ['Příruba DN 100 PN 16 – 8 × M16 na Ø180', { typ: 'kruh', D: 180, n: 8, a0: 22.5, d: 18 }],
      ['Kolo auta 5 × 112', { typ: 'kruh', D: 112, n: 5, a0: 90, d: 14 }],
      ['Kolo auta 4 × 100', { typ: 'kruh', D: 100, n: 4, a0: 45, d: 14 }],
      ['Polička – 4 otvory po 32 mm', { typ: 'rada', rezim: 'roztec', n: 4, roztec: 32, d: 5, x: 0, y: 0 }],
    ],
  };
  const VYCHOZI_SABLONA = () => ({
    skupiny: [
      { typ: 'predvolba', id: 'nema17', x: 50, y: 35, uhel: 0 },
      { typ: 'mrizka', x: 6, y: 6, nx: 2, ny: 2, px: 88, py: 58, stridat: false, zkratit: false, uhel: 0, d: 3.4 },
    ],
    o: Object.assign({}, TT.VYCHOZI.sablona, { obrys: 'obd', w: 100, h: 70 }),
  });
  const VYCHOZI_ROZTECE = () => ({ vzor: kopie(VYCHOZI_VZOR.kruh), o: Object.assign({}, TT.VYCHOZI.sablona, { obrys: 'auto', okraj: 10 }) });

  const REZIMY = [
    ['pravitko', '📏', 'Pravítko'], ['uhlomer', '📐', 'Úhloměr'], ['kruhova', '🧭', 'Kruhová stupnice'],
    ['sablona', '🔩', 'Vrtací šablona'], ['roztece', '⭕', 'Rozteče otvorů'], ['mrizka', '▦', 'Mřížka'],
  ];
  const POPISY = {
    pravitko: 'Přímá měřítka v mm, palcích, v měřítku výkresu nebo mapy a π-páska pro průměr z obvodu. Dlouhá pravítka se rozdělí na pásy.',
    uhlomer: 'Úhloměry 180° a 360° ve stupních, gradiánech nebo dílcích s dvojím číslováním.',
    kruhova: 'Číselníky, dělicí kotouče, stupnice potenciometrů a ciferníky – libovolné dělení, rozsah i číslování.',
    sablona: 'Vrtací šablony z více skupin otvorů (kružnice, řady, matice, předvolby VESA/NEMA/desky) s tabulkou souřadnic.',
    roztece: 'Výpočet roztečí otvorů s tabulkou souřadnic, tětiv a vzdáleností; vzor jde přenést do vrtací šablony.',
    mrizka: 'Technické mřížky: milimetrová, tečková, izometrická a polární s popsanými souřadnicemi.',
  };
  /* skupiny záložek */
  const SKUPINY = [['meridla', 'Měřidla'], ['sablony', 'Šablony'], ['papiry', 'Papíry a podložky']];
  const SKUPINA_REZIMU = {
    pravitko: 'meridla', uhlomer: 'meridla', kruhova: 'meridla', logpravitko: 'meridla', merky: 'meridla',
    sablona: 'sablony', roztece: 'sablony', tvary: 'sablony', rozvinuti: 'sablony',
    mrizka: 'papiry', logpapir: 'papiry', podlozka: 'papiry', kalibrace: 'papiry',
  };
  for (const r of TT.REZIMY) if (!REZIMY.some((q) => q[0] === r.id)) { REZIMY.push([r.id, r.ikona || '•', r.nazev]); PREDVOLBY[r.id] = r.predvolby || []; POPISY[r.id] = r.popis || ''; }
  const registr = (id) => TT.REZIMY.find((r) => r.id === id);

  /* ---------- stav ---------- */
  function vychoziStav() {
    const st = {
      rezim: 'pravitko',
      pravitko: Object.assign({}, TT.VYCHOZI.pravitko), uhlomer: Object.assign({}, TT.VYCHOZI.uhlomer),
      kruhova: Object.assign({}, TT.VYCHOZI.kruhova), mrizka: Object.assign({}, TT.VYCHOZI.mrizka, { vyplnit: true }),
      sablona: VYCHOZI_SABLONA(), roztece: VYCHOZI_ROZTECE(),
      tisk: Object.assign({}, TT.VYCHOZI_TISK, { merX: 100, merY: 50, korekce: false, kopie: 1, mezeraKopii: 4, prizpusobit: true }),
      fit: {},
    };
    for (const r of TT.REZIMY) st[r.id] = Object.assign({}, r.vychozi);
    return st;
  }
  let S = vychoziStav();
  function slouc(cil, zdroj) {
    for (const k of Object.keys(zdroj || {})) {
      if (!(k in cil)) continue;
      if (cil[k] && typeof cil[k] === 'object' && !Array.isArray(cil[k]) && zdroj[k] && typeof zdroj[k] === 'object') slouc(cil[k], zdroj[k]);
      else cil[k] = zdroj[k];
    }
  }
  function nactiStav() {
    try { const t = localStorage.getItem(KLIC); if (t) slouc(S, JSON.parse(t)); } catch (e) { /* bez úložiště */ }
    const m = /[#&]s=([A-Za-z0-9_-]+)/.exec(location.hash);
    if (m) {
      try {
        const b = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
        const json = decodeURIComponent(Array.from(b, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
        const d = JSON.parse(json);
        if (d.rezim && REZIMY.some((r) => r[0] === d.rezim)) { S.rezim = d.rezim; if (d.data) { const c = {}; c[d.rezim] = d.data; slouc(S, c); } }
        if (d.tisk) slouc(S.tisk, d.tisk);
      } catch (e) { /* vadný odkaz – ignorovat */ }
    }
    if (!Array.isArray(S.sablona.skupiny)) S.sablona = VYCHOZI_SABLONA();
  }
  let ulozTimer = 0;
  function uloz() {
    clearTimeout(ulozTimer);
    ulozTimer = setTimeout(() => { try { localStorage.setItem(KLIC, JSON.stringify(S)); } catch (e) { /* plné / zakázané */ } }, 300);
  }

  /* ---------- formuláře ---------- */
  function cisloText(v) { return typeof v === 'number' ? String(Math.round(v * 1e6) / 1e6).replace('.', ',') : String(v == null ? '' : v); }

  function formular(el, schema, obj, poZmene) {
    el.innerHTML = '';
    el.classList.add('formular');
    const radky = [];
    for (const f of schema) {
      if (f.nadpis) { const h = document.createElement('h3'); h.textContent = f.nadpis; el.appendChild(h); radky.push([f, h]); continue; }
      const obal = document.createElement('div');
      if (f.pul) obal.className = 'pul';
      const id = 'f_' + Math.random().toString(36).slice(2, 9);
      if (f.typ === 'zaskrt') {
        const lab = document.createElement('label'); lab.className = 'zaskrt';
        const inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = !!obj[f.id]; inp.dataset.pole = f.id;
        inp.addEventListener('change', () => { obj[f.id] = inp.checked; obnovViditelnost(); poZmene(f.id); });
        lab.append(inp, document.createTextNode(' ' + f.popis)); obal.appendChild(lab);
      } else {
        const lab = document.createElement('label'); lab.className = 'pop'; lab.htmlFor = id; lab.textContent = f.popis; obal.appendChild(lab);
        let inp;
        if (f.typ === 'vyber') {
          inp = document.createElement('select');
          let skup = null, posledni = null;
          for (const m of f.moznosti) {
            const op = document.createElement('option'); op.value = String(m[0]); op.textContent = m[1];
            if (m[2]) { if (m[2] !== posledni) { skup = document.createElement('optgroup'); skup.label = m[2]; inp.appendChild(skup); posledni = m[2]; } skup.appendChild(op); }
            else inp.appendChild(op);
          }
          inp.value = String(obj[f.id]);
          if (inp.selectedIndex < 0 && f.cislo) { const op = document.createElement('option'); op.value = String(obj[f.id]); op.textContent = '1:' + obj[f.id]; inp.appendChild(op); inp.value = String(obj[f.id]); }
          inp.addEventListener('change', () => { obj[f.id] = f.cislo ? +inp.value : inp.value; obnovViditelnost(); poZmene(f.id); });
          obal.appendChild(inp);
        } else if (f.typ === 'textarea') {
          inp = document.createElement('textarea'); inp.value = obj[f.id] || ''; inp.spellcheck = false;
          inp.addEventListener('input', () => { obj[f.id] = inp.value; poZmene(f.id); });
          obal.appendChild(inp);
        } else if (f.typ === 'text') {
          inp = document.createElement('input'); inp.type = 'text'; inp.value = obj[f.id] || ''; inp.maxLength = 80;
          inp.addEventListener('input', () => { obj[f.id] = inp.value; poZmene(f.id); });
          obal.appendChild(inp);
        } else {
          const w = document.createElement('div'); w.className = 'jedn';
          inp = document.createElement('input'); inp.type = 'text'; inp.inputMode = 'decimal'; inp.autocomplete = 'off';
          inp.value = cisloText(obj[f.id]);
          const over = () => {
            let v = TT.vyraz(inp.value);
            const spatne = !isFinite(v) || (f.min != null && v < f.min) || (f.max != null && v > f.max) || (f.cele && Math.abs(v - Math.round(v)) > 1e-9);
            inp.classList.toggle('chyba', spatne);
            inp.title = spatne ? `Zadejte číslo${f.min != null ? ' ≥ ' + fmt(f.min) : ''}${f.max != null ? ' a ≤ ' + fmt(f.max) : ''}${f.cele ? ', celé' : ''} (výraz jako 3*25,4 je povolen)` : '';
            if (!spatne) { obj[f.id] = v; obnovViditelnost(); poZmene(f.id); }
          };
          inp.addEventListener('input', over);
          inp.addEventListener('blur', () => { if (!inp.classList.contains('chyba') && /[*/+()a-z"]/i.test(inp.value.replace(/^-/, ''))) inp.value = cisloText(obj[f.id]); });
          w.appendChild(inp);
          if (f.jedn) { const sp = document.createElement('span'); sp.textContent = f.jedn; w.appendChild(sp); }
          obal.appendChild(w);
        }
        inp.id = id; inp.dataset.pole = f.id;
      }
      if (f.napoveda) { const p = document.createElement('div'); p.className = 'napoveda'; p.textContent = f.napoveda; obal.appendChild(p); }
      el.appendChild(obal);
      radky.push([f, obal]);
    }
    function obnovViditelnost() {
      for (const [f, o] of radky) if (f.kdy) o.hidden = !f.kdy(obj);
      // nadpis sekce bez viditelných polí schovat
      radky.forEach(([f, o], i) => {
        if (!f.nadpis) return;
        let vid = false;
        for (let j = i + 1; j < radky.length && !radky[j][0].nadpis; j++) if (!radky[j][1].hidden) { vid = true; break; }
        o.hidden = !vid || (f.kdy ? !f.kdy(obj) : false);
      });
    }
    obnovViditelnost();
  }

  /* ---------- sestavení kresby podle režimu ---------- */
  function otvorySablony(d) {
    const vse = [];
    for (const g of (d || S.sablona).skupiny) for (const h of TT.vzorOtvory(g)) vse.push(h);
    return vse;
  }
  function plochaListu() {
    // užitná plocha listu pro „vyplnit list“ (podle papíru a orientace)
    const t = S.tisk;
    let [w, h] = t.papir === 'vlastni' ? [+t.pw, +t.ph] : (TT.FORMATY[t.papir] || TT.FORMATY.A4);
    const a = Math.min(w, h), b = Math.max(w, h);
    [w, h] = t.orientace === 's' ? [b, a] : [a, b];
    return { w: w - 2 * t.okraj, h: h - 2 * t.okraj - (t.paticka ? 15 : 0) };
  }
  const sestav = () => sestavZ(S.rezim, S[S.rezim]);
  /* kresba z parametrů režimu (bez zásahu do stavu – i pro náhledy v galerii) */
  function sestavZ(r, d) {
    if (r === 'pravitko') return TT.pravitko(d);
    if (r === 'uhlomer') return TT.uhlomer(d);
    if (r === 'kruhova') return TT.kruhova(d);
    if (r === 'mrizka') {
      const o = Object.assign({}, d);
      if (o.vyplnit) {
        const p = plochaListu(), lab = o.popisy && o.typ !== 'iso' ? (o.typ === 'polar' ? 2 * (1.5 + 1.2 * o.pismo + TT.sirkaTextu('000°', o.pismo) / 2) : 4 + TT.sirkaTextu('−000', o.pismo)) : 2;
        const labV = o.popisy && o.typ !== 'iso' ? (o.typ === 'polar' ? lab : 4 + 2.6 * o.pismo) : 2;
        const krok = (o.typ === 'kart' || o.typ === 'tecky') ? o.krok * Math.max(1, Math.round(o.hlavni)) : (o.typ === 'iso' ? 0.001 : 0.001);
        const zaokr = (v) => (krok > 0.01 ? Math.floor(v / krok + 1e-9) * krok : Math.floor(v));
        o.w = Math.max(10, zaokr(p.w - lab)); o.h = Math.max(10, zaokr(p.h - labV));
        if (o.typ === 'polar') o.w = o.h = Math.max(10, Math.floor(Math.min(p.w, p.h) - lab));
      }
      return TT.mrizka(o);
    }
    if (r === 'sablona') {
      const k = TT.sablona(otvorySablony(d), d.o);
      for (const g of d.skupiny) if (g.typ === 'body') { const c = TT.ctiBody(g.text || ''); k.chyby.push(...c.chyby); }
      return k;
    }
    if (r === 'roztece') return TT.sablona(TT.vzorOtvory(d.vzor), d.o);
    const reg = registr(r);
    if (reg) {
      try { return reg.gen(Object.assign({}, reg.vychozi, d)); }
      catch (e) { const k = TT.kresba([TT.prvky.text(0, 0, 'Chyba generátoru: ' + e.message, 3, { zar: 'l' })], reg.nazev, []); k.chyby = ['Chyba generátoru: ' + e.message]; return k; }
    }
    return TT.pravitko({});
  }

  /* ---------- náhled ---------- */
  let K = null, K0 = null, R = null;
  let zoom = { rezim: 'fit', pxmm: 3 };
  function pxmmKalib() { try { const v = +localStorage.getItem(KLIC_KAL); if (v > 1 && v < 12) return v; } catch (e) { /* */ } return 96 / 25.4; }

  function prepocti() {
    K0 = sestav();
    K = nasobKopie(K0);
    R = TT.rozvrh(K, tiskNastaveni());
    vykresli();
    hlaseni();
    vysledkyOtvoru();
    uloz();
  }
  function tiskNastaveni() {
    const t = Object.assign({}, S.tisk);
    t.kx = t.korekce && +t.merX > 0 ? 100 / +t.merX : 1;
    t.ky = t.korekce && +t.merY > 0 ? 50 / +t.merY : 1;
    return t;
  }
  function vykresli() {
    const box = $('nahled');
    box.innerHTML = '';
    if (!R.listy.length) { box.textContent = R.chyba || 'Nic k zobrazení.'; return; }
    const sirkaBox = box.clientWidth - 30;
    let pxmm;
    if (zoom.rezim === 'fit') pxmm = Math.max(0.5, Math.min(sirkaBox / R.listy[0].pw, (window.innerHeight - 190) / R.listy[0].ph, 6));
    else if (zoom.rezim === 'real') pxmm = pxmmKalib();
    else pxmm = zoom.pxmm;
    zoom.pxmm = pxmm;
    box.classList.toggle('skutecna', R.listy[0].pw * pxmm > sirkaBox);
    for (const l of R.listy) {
      const d = document.createElement('div'); d.className = 'list';
      d.style.width = (l.pw * pxmm) + 'px'; d.style.height = (l.ph * pxmm) + 'px';
      d.innerHTML = TT.svgListu(K, R, l, { okraje: true });
      if (R.listy.length > 1) { const c = document.createElement('div'); c.className = 'cislo'; c.textContent = `List ${l.cislo}/${l.celkem}`; d.appendChild(c); d.style.marginTop = '14px'; }
      box.appendChild(d);
    }
    const l0 = R.listy[0], t = R.tisk;
    const papir = t.papir === 'vlastni' ? `${fmt(l0.pw)} × ${fmt(l0.ph)} mm` : t.papir;
    $('infoRozvrh').textContent = `objekt ${fmt(K.w, 1)} × ${fmt(K.h, 1)} mm · ${papir} ${l0.pw > l0.ph ? 'na šířku' : 'na výšku'} · ${R.listy.length} ${R.listy.length === 1 ? 'list' : R.listy.length < 5 ? 'listy' : 'listů'}${R.dlazdice ? ` (${R.dilu} dílů)` : ''} · náhled ${Math.round(pxmm / (96 / 25.4) * 100)} %`;
  }
  function hlaseni() {
    const el = $('hlaseni'); el.innerHTML = '';
    const zpr = (K.chyby || []).slice();
    if (R.dlazdice) {
      const vetsi = ['A4', 'A3', 'A2'].find((p) => { const f = TT.FORMATY[p]; const a = Math.max(f[0], f[1]) - 2 * S.tisk.okraj, b = Math.min(f[0], f[1]) - 2 * S.tisk.okraj - 15; return (K.w <= a && K.h <= b) || (K.w <= b && K.h <= a); });
      zpr.push(`Objekt se na ${S.tisk.papir === 'vlastni' ? 'zvolený papír' : S.tisk.papir} nevejde – rozdělen na ${R.dilu} dílů s překryvem ${fmt(R.prekryv)} mm${vetsi && vetsi !== S.tisk.papir ? `; celý by se vešel na ${vetsi}` : ''}.`);
    }
    for (const z of zpr) { const d = document.createElement('div'); d.textContent = z; el.appendChild(d); }
  }
  function vysledkyOtvoru() {
    const el = $('vysledkyOtvoru'); el.innerHTML = '';
    const r = S.rezim;
    $('btnCsv').hidden = !(r === 'sablona' || r === 'roztece');
    if (r !== 'sablona' && r !== 'roztece') return;
    const otv = r === 'sablona' ? otvorySablony() : TT.vzorOtvory(S.roztece.vzor);
    const tab = TT.tabulkaRozteci(otv, r === 'roztece' ? S.roztece.vzor : null);
    const h = document.createElement('h3'); h.textContent = `Souřadnice otvorů (${otv.length})`; el.appendChild(h);
    if (tab.souhrn.length) {
      const s = document.createElement('div'); s.className = 'souhrn';
      for (const [a, b] of tab.souhrn) { const x = document.createElement('span'); x.textContent = a; const y = document.createElement('b'); y.textContent = b; s.append(x, y); }
      el.appendChild(s);
    }
    const obal = document.createElement('div'); obal.className = 'tabulka-obal';
    const t = document.createElement('table'); t.className = 'otvory';
    const maUhel = tab.radky.some((q) => q.uhel != null);
    t.innerHTML = `<thead><tr><th>č.</th><th>X [mm]</th><th>Y [mm]</th><th>⌀ [mm]</th>${maUhel ? '<th>úhel</th>' : ''}<th>od předchozího</th><th>od 1.</th><th class="l">popis</th></tr></thead>`;
    const tb = document.createElement('tbody');
    for (const q of tab.radky) {
      const tr = document.createElement('tr');
      const bunky = [q.i, fmt(q.x, 3), fmt(q.y, 3), q.d > 0 ? fmt(q.d, 2) : '–'];
      if (maUhel) bunky.push(q.uhel != null ? fmt(q.uhel, 3) + '°' : '');
      bunky.push(q.odPredch != null ? fmt(q.odPredch, 3) : '', q.odPrvniho != null ? fmt(q.odPrvniho, 3) : '');
      for (const b of bunky) { const td = document.createElement('td'); td.textContent = b; tr.appendChild(td); }
      const td = document.createElement('td'); td.className = 'l'; td.textContent = q.popis; tr.appendChild(td);
      tb.appendChild(tr);
    }
    t.appendChild(tb); obal.appendChild(t); el.appendChild(obal);
    if (r === 'roztece') {
      const b = document.createElement('button'); b.textContent = '➜ Přidat do vrtací šablony'; b.style.marginTop = '8px';
      b.addEventListener('click', () => { S.sablona.skupiny.push(kopie(S.roztece.vzor)); prepniRezim('sablona'); toast('Vzor přidán do vrtací šablony jako nová skupina.'); });
      el.appendChild(b);
    }
  }

  /* ---------- panel parametrů ---------- */
  let prepocetTimer = 0;
  const naplanuj = () => { clearTimeout(prepocetTimer); prepocetTimer = setTimeout(prepocti, 90); };
  /* změna papíru/orientace/okrajů: předlohu, která byla přizpůsobená listu, přizpůsobit znovu */
  let refitTimer = 0;
  function zmenaTisku(pole) {
    const r = S.rezim;
    if (['papir', 'orientace', 'okraj', 'paticka', 'pw', 'ph', 'prizpusobit'].includes(pole) && S.tisk.prizpusobit && S.fit[r] && PRIZPUSOBENI[r] && !PRIZPUSOBENI[r].specialni) {
      clearTimeout(refitTimer);
      refitTimer = setTimeout(() => { const z = prizpusob(r, true); if (z) toast('Přizpůsobeno listu: ' + z); panelParametru(); prepocti(); }, 250);
      return;
    }
    naplanuj();
  }

  function panelParametru() {
    const r = S.rezim, nazev = REZIMY.find((q) => q[0] === r);
    $('nadpisRezimu').textContent = nazev[1] + ' ' + nazev[2];
    const sel = $('predvolba'); sel.innerHTML = '<option value="">— vyberte —</option>';
    (PREDVOLBY[r] || []).forEach((p, i) => { const o = document.createElement('option'); o.value = i; o.textContent = p[0]; sel.appendChild(o); });
    $('popisRezimu').textContent = POPISY[r] || '';
    const el = $('formular');
    el.innerHTML = '';
    $('btnNaList').hidden = !PRIZPUSOBENI[r];
    $('btnNaList').disabled = !lzePrizpusobit(r, S[r]);
    const poZmeneRezimu = (pole) => { if (parametryFitu(r, S[r]).includes(pole)) S.fit[r] = false; if (pole === 'typ') $('btnNaList').disabled = !lzePrizpusobit(r, S[r]); naplanuj(); };
    if (SCHEMA[r]) { formular(el, SCHEMA[r], S[r], poZmeneRezimu); return; }
    const reg = registr(r);
    if (reg) { formular(el, reg.schema || [], S[r], poZmeneRezimu); return; }
    if (r === 'roztece') {
      const v = S.roztece.vzor;
      const d = document.createElement('div'); el.appendChild(d);
      const typy = ['kruh', 'oblouk', 'rada', 'mrizka'];
      const sch = [F('typ', 'vyber', 'Vzor', { moznosti: typy.map((t) => [t, DRUHY_VZORU[t]]) })].concat(SCHEMA_VZORU[v.typ] || []);
      formular(d, sch, v, (pole) => {
        if (pole === 'typ') { const t = v.typ; S.roztece.vzor = Object.assign(kopie(VYCHOZI_VZOR[t]), { typ: t }); panelParametru(); }
        naplanuj();
      });
      const d2 = document.createElement('div'); el.appendChild(d2);
      formular(d2, OBRYS_SABLONY, S.roztece.o, naplanuj);
      return;
    }
    if (r === 'sablona') {
      const h = document.createElement('h3'); h.textContent = 'Skupiny otvorů'; el.appendChild(h);
      const p = document.createElement('div'); p.className = 'napoveda'; p.textContent = 'Souřadnice: X doprava, Y nahoru, od počátku obrysu. Výrazy jako 100/2 nebo 3*25,4 jsou povolené.'; el.appendChild(p);
      S.sablona.skupiny.forEach((g, i) => {
        const box = document.createElement('div'); box.className = 'skupina';
        const hl = document.createElement('div'); hl.className = 'hlava';
        const b = document.createElement('b');
        const pv = g.typ === 'predvolba' ? TT.PREDVOLBY.find((q) => q.id === g.id) : null;
        b.textContent = `${i + 1}. ${pv ? pv.nazev : DRUHY_VZORU[g.typ]}`;
        const tl = (txt, title, fn, cls) => { const x = document.createElement('button'); x.className = 'male' + (cls ? ' ' + cls : ''); x.textContent = txt; x.title = title; x.addEventListener('click', fn); return x; };
        hl.append(b,
          tl('▲', 'Posunout výš', () => { if (i > 0) { S.sablona.skupiny.splice(i - 1, 0, S.sablona.skupiny.splice(i, 1)[0]); panelParametru(); naplanuj(); } }),
          tl('⧉', 'Duplikovat', () => { S.sablona.skupiny.splice(i + 1, 0, kopie(g)); panelParametru(); naplanuj(); }),
          tl('✕', 'Odebrat skupinu', () => { S.sablona.skupiny.splice(i, 1); panelParametru(); naplanuj(); }, 'nebezpecne'));
        box.appendChild(hl);
        const f = document.createElement('div'); box.appendChild(f);
        formular(f, SCHEMA_VZORU[g.typ] || [], g, (pole) => {
          if (pole === 'id') { const q = TT.PREDVOLBY.find((x) => x.id === g.id); b.textContent = `${i + 1}. ${q ? q.nazev : ''}`; }
          naplanuj();
        });
        el.appendChild(box);
      });
      const pr = document.createElement('div'); pr.className = 'pridat';
      for (const t of Object.keys(DRUHY_VZORU)) {
        const x = document.createElement('button'); x.className = 'male'; x.textContent = '+ ' + DRUHY_VZORU[t];
        x.addEventListener('click', () => { S.sablona.skupiny.push(kopie(VYCHOZI_VZOR[t])); panelParametru(); naplanuj(); });
        pr.appendChild(x);
      }
      el.appendChild(pr);
      const d2 = document.createElement('div'); el.appendChild(d2);
      formular(d2, OBRYS_SABLONY, S.sablona.o, naplanuj);
    }
  }

  /* parametry režimu podle předvolby (nový objekt) */
  function dataPredvolby(r, i) {
    const p = (PREDVOLBY[r] || [])[i];
    if (!p) return null;
    if (r === 'sablona') {
      const v = VYCHOZI_SABLONA();
      if (p[1]) { v.skupiny = kopie(p[1].skupiny); Object.assign(v.o, p[1].o || {}); }
      return v;
    }
    if (r === 'roztece') {
      const v = VYCHOZI_ROZTECE();
      if (p[1]) v.vzor = Object.assign(kopie(VYCHOZI_VZOR[p[1].typ || 'kruh']), p[1]);
      return v;
    }
    if (registr(r)) return Object.assign({}, registr(r).vychozi, kopie(p[1] || {}));
    return Object.assign({}, TT.VYCHOZI[r], r === 'mrizka' ? { vyplnit: true } : {}, kopie(p[1] || {}));
  }
  /* ---------- přizpůsobení rozměrů listu ----------
     Pro každý režim: které parametry určují velikost (krok zaokrouhlení, minimum, úměrně škálované
     souputníky). Řešič generuje skutečnou kresbu a hledá největší hodnotu, která se vejde
     do tisknutelné plochy jednoho listu (při automatické orientaci zkusí obě). */
  const PRIZPUSOBENI = {
    pravitko: { fit: (o) => [{ par: 'delka', min: 20, krok: /^in/.test(o.horni) && (o.dolni === 'zadna' || /^in/.test(o.dolni)) ? 25.4 / 4 : 10 }], popis: 'délka' },
    uhlomer: { fit: () => [{ par: 'r', krok: 1, min: 15 }], popis: 'poloměr' },
    kruhova: { fit: () => [{ par: 'r', krok: 1, min: 8, skaluj: ['vnejsiD', 'indexR'] }], popis: 'poloměr' },
    mrizka: { specialni: (d) => { d.vyplnit = true; }, vzdy: true },
    podlozka: { fit: (o) => { const k = o.jednotka === 'in' ? 25.4 : 10; return [{ par: 'w', krok: k, min: 60 }, { par: 'h', krok: k, min: 60 }]; }, popis: 'rozměr' },
    kalibrace: { kdy: (o) => o.typ !== 'laser', fit: () => [{ par: 'w', krok: 1, min: 120 }, { par: 'h', krok: 1, min: 150 }], popis: 'plocha' },
    logpapir: { vzdy: true, fit: (o) => o.typ === 'ternar' ? [{ par: 'a', krok: 5, min: 60 }] : [{ par: 'w', krok: 5, min: 40 }, { par: 'h', krok: 5, min: 40 }], popis: 'plocha' },
    logpravitko: { fit: (o) => o.typ === 'kruh' ? [{ par: 'r', krok: 1, min: 30 }] : [{ par: 'delka', krok: 5, min: 60 }], popis: 'délka stupnice' },
    merky: { vzdy: true, fit: () => [{ par: 'sirka', krok: 5, min: 60 }], popis: 'šířka desky' },
    tvary: { vzdy: true, fit: () => [{ par: 'sirka', krok: 5, min: 60 }], popis: 'šířka desky' },
  };
  const parametryFitu = (r, d) => { const sp = PRIZPUSOBENI[r]; return sp && sp.fit ? sp.fit(d).flatMap((f) => [f.par].concat(f.skaluj || [])) : []; };
  const lzePrizpusobit = (r, d) => { const sp = PRIZPUSOBENI[r]; return !!sp && (!sp.kdy || sp.kdy(d)); };

  /* tisknutelné plochy jednoho listu podle nastavení tisku */
  function plochyListu() {
    const t = S.tisk;
    let [w, h] = t.papir === 'vlastni' ? [+t.pw, +t.ph] : (TT.FORMATY[t.papir] || TT.FORMATY.A4);
    const a = Math.min(w, h), b = Math.max(w, h);
    const rozm = t.orientace === 'v' ? [[a, b]] : t.orientace === 's' ? [[b, a]] : [[a, b], [b, a]];
    return rozm.map(([pw, ph]) => ({ w: pw - 2 * t.okraj, h: ph - 2 * t.okraj - (t.paticka ? 15 : 0), naSirku: pw > ph }));
  }
  const vejdeSe = (k, A) => k.w <= A.w + 1e-6 && k.h <= A.h + 1e-6;

  /* jeden parametr: největší hodnota (násobek kroku), při které se kresba vejde do A */
  function fitParametr(r, d, f, A) {
    const zaklad = Object.assign({}, d), b0 = +d[f.par] || f.min || 10;
    const nastav = (v) => {
      const o = Object.assign({}, zaklad); o[f.par] = v;
      for (const q of f.skaluj || []) if (+zaklad[q] > 0) o[q] = Math.round(+zaklad[q] * v / b0 * 2) / 2;
      return o;
    };
    const gen = (v) => sestavZ(r, nastav(v));
    const zaokr = (v) => Math.floor(v / f.krok + 1e-9) * f.krok;
    // lineární odhad ze dvou bodů (rozměr kresby ≈ a + b·v), pak ověření a doladění
    const v1 = Math.max(f.min, b0), v2 = v1 * 1.5 + f.krok;
    const k1 = gen(v1), k2 = gen(v2);
    // ladí se jen rozměry, které na parametru závisejí (šířka podložky nehýbe výškou – tu doladí druhý parametr)
    let odhad = Infinity;
    const dims = [];
    for (const [dim, lim] of [['w', A.w], ['h', A.h]]) {
      const sl = (k2[dim] - k1[dim]) / (v2 - v1);
      if (sl > 1e-6) { dims.push([dim, lim]); odhad = Math.min(odhad, v1 + (lim - k1[dim]) / sl); }
    }
    if (!dims.length) return { v: b0, k: k1, data: nastav(b0) };
    const vejde = (kk) => dims.every(([dim, lim]) => kk[dim] <= lim + 1e-6);
    let v = Math.max(f.min, zaokr(odhad)), k = gen(v), kroku = 0;
    if (vejde(k)) {
      // zkusit o krok víc (zaokrouhlení / nelinearita)
      while (kroku++ < 12) { const k3 = gen(v + f.krok); if (!vejde(k3)) break; v += f.krok; k = k3; }
    } else {
      // půlení mezi minimem a odhadem
      let lo = f.min, hi = v;
      const klo = gen(lo);
      if (!vejde(klo)) return { v: lo, k: klo, data: nastav(lo) };
      k = klo;
      while (hi - lo > f.krok + 1e-9 && kroku++ < 14) {
        const m = Math.max(lo + f.krok, zaokr((lo + hi) / 2)), km = gen(m);
        if (vejde(km)) { lo = m; k = km; } else hi = m;
      }
      v = lo;
    }
    return { v, k, data: nastav(v) };
  }

  /* přizpůsobí parametry režimu r listu; vrací text o výsledku nebo null */
  function prizpusob(r, tise) {
    const d = S[r], sp = PRIZPUSOBENI[r];
    if (!sp || !lzePrizpusobit(r, d)) { if (!tise) toast('Tuto předlohu nejde přizpůsobit – její rozměr je dán skutečným výrobkem.'); return null; }
    if (sp.specialni) { sp.specialni(d); S.fit[r] = true; return 'předloha vyplní celý list'; }
    let nej = null;
    for (const A of plochyListu()) {
      let o = Object.assign({}, d), k = null, nevejde = false;
      for (const f of sp.fit(o)) { const vys = fitParametr(r, o, f, A); o = vys.data || o; k = vys.k; }
      if (k) nevejde = !vejdeSe(k, A);
      const plocha = k ? k.w * k.h : 0;
      if (!nej || (!nevejde && (nej.nevejde || plocha > nej.plocha + 1e-6))) nej = { o, plocha, nevejde, A };
    }
    if (!nej) return null;
    S[r] = nej.o; S.fit[r] = true;
    const hodnoty = sp.fit(nej.o).map((f) => fmt(nej.o[f.par], 1)).join(' × ');
    const zprava = nej.nevejde ? `předloha se ani v nejmenší velikosti na list nevejde` : `${sp.popis || 'rozměr'} ${hodnoty} mm – na celý list ${S.tisk.papir === 'vlastni' ? '' : S.tisk.papir}${nej.A.naSirku ? ' na šířku' : ''}`;
    if (!tise) toast('Přizpůsobeno: ' + zprava);
    return zprava;
  }
  function prizpusobTlacitkem() {
    const z = prizpusob(S.rezim, true);
    if (z) toast('Přizpůsobeno: ' + z); else toast('Tuto předlohu nejde přizpůsobit – její rozměr je dán skutečným výrobkem.');
    panelParametru(); prepocti();
  }

  function pouzijPredvolbu(i, r) {
    r = r || S.rezim;
    const d = dataPredvolby(r, i);
    if (!d) return;
    S[r] = d; S.fit[r] = false;
    // předloha bez pevného rozměru se roztáhne na list
    const p = (PREDVOLBY[r] || [])[i], data = (p && p[1]) || {};
    const sp = PRIZPUSOBENI[r];
    let zprava = null;
    if (S.tisk.prizpusobit && sp && lzePrizpusobit(r, d) && (sp.vzdy || !(sp.fit ? sp.fit(d).map((f) => f.par) : []).some((q) => q in data))) zprava = prizpusob(r, true);
    if (zprava) setTimeout(() => toast('Přizpůsobeno listu: ' + zprava), 50);
    if (S.rezim !== r) { prepniRezim(r); return; }
    zoom.rezim = 'fit'; panelParametru(); prepocti();
  }

  function prepniRezim(r) {
    S.rezim = r; zoom.rezim = 'fit';
    for (const b of $('rezimy').querySelectorAll('button[data-rezim]')) b.setAttribute('aria-selected', String(b.dataset.rezim === r));
    panelParametru(); prepocti();
  }

  /* ---------- export ---------- */
  function nazevSouboru(pripona) {
    const d = new Date(), dd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `${S.rezim}_${dd}.${pripona}`;
  }
  function stahni(obsah, nazev, typ) {
    const blob = obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  let pismoSlib = null;
  function nactiPismo() {
    if (window.FONTY_JS && window.FONTY_JS['LiberationSans-Regular.ttf']) return Promise.resolve(window.FONTY_JS['LiberationSans-Regular.ttf']);
    if (pismoSlib) return pismoSlib;
    pismoSlib = new Promise((ok) => {
      const s = document.createElement('script'); s.src = 'stitky_panely/fonty/LiberationSans-Regular.ttf.js';
      s.onload = () => ok((window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null);
      s.onerror = () => { pismoSlib = null; ok(null); };
      document.head.appendChild(s);
    });
    return pismoSlib;
  }
  async function vytvorPdf() {
    if (!window.jspdf) throw new Error('Knihovna jsPDF se nenačetla.');
    const pismo = await nactiPismo();
    if (!pismo) toast('Písmo se nepodařilo načíst – PDF bude bez diakritiky.');
    return TT.pdf(window.jspdf.jsPDF, K, R, { pismo });
  }
  async function pdfStahnout() {
    const b = $('btnPdf'); b.disabled = true; const puv = b.textContent; b.textContent = 'Připravuji PDF…';
    try { const doc = await vytvorPdf(); stahni(doc.output('blob'), nazevSouboru('pdf')); }
    catch (e) { toast('Chyba PDF: ' + e.message); }
    finally { b.disabled = false; b.textContent = puv; }
  }
  async function pdfOtevrit() {
    const okno = window.open('', '_blank');
    try {
      const doc = await vytvorPdf();
      const url = URL.createObjectURL(doc.output('blob'));
      if (okno) okno.location.href = url; else stahni(doc.output('blob'), nazevSouboru('pdf'));
    } catch (e) { if (okno) okno.close(); toast('Chyba PDF: ' + e.message); }
  }
  function odkaz() {
    const d = { rezim: S.rezim, data: S[S.rezim], tisk: S.tisk };
    const utf = encodeURIComponent(JSON.stringify(d)).replace(/%([0-9A-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
    const b64 = btoa(utf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const url = location.href.split('#')[0] + '#s=' + b64;
    const hotovo = () => toast('Odkaz s nastavením je ve schránce.');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(hotovo, () => prompt('Zkopírujte odkaz:', url));
    else prompt('Zkopírujte odkaz:', url);
  }
  let toastTimer = 0;
  function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('vid'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('vid'), 2800); }

  /* ---------- kalibrace monitoru ---------- */
  function kalibrace() {
    const m = $('modalKalib'), k = $('kartaKal'), pos = $('kalPosuv');
    const nastav = (v) => { k.style.width = (85.6 * v) + 'px'; k.style.height = (53.98 * v) + 'px'; $('kalInfo').textContent = `${fmt(v, 3)} px/mm (${fmt(v * 25.4, 1)} dpi)`; };
    pos.value = pxmmKalib(); nastav(+pos.value);
    pos.oninput = () => nastav(+pos.value);
    $('kalReset').onclick = () => { pos.value = 96 / 25.4; nastav(+pos.value); };
    $('kalOk').onclick = () => { try { localStorage.setItem(KLIC_KAL, String(+pos.value)); } catch (e) { /* */ } m.classList.remove('otevreno'); zoom.rezim = 'real'; vykresli(); };
    m.classList.add('otevreno'); pos.focus();
  }

  /* ---------- kopie na list ---------- */
  function nasobKopie(k) {
    const t = S.tisk, chtene = Math.round(+t.kopie);
    if (chtene === 1 || !(chtene >= 0)) return k;
    const m = Math.max(0, +t.mezeraKopii || 0);
    let [w, h] = t.papir === 'vlastni' ? [+t.pw, +t.ph] : (TT.FORMATY[t.papir] || TT.FORMATY.A4);
    const a = Math.min(w, h), b = Math.max(w, h);
    const orient = t.orientace === 'v' ? [[a, b]] : t.orientace === 's' ? [[b, a]] : [[a, b], [b, a]];
    let nej = { n: 0, sl: 1 };
    for (const [pw, ph] of orient) {
      const aw = pw - 2 * t.okraj, ah = ph - 2 * t.okraj - (t.paticka ? 15 : 0);
      const sl = Math.floor((aw + m) / (k.w + m) + 1e-9), ra = Math.floor((ah + m) / (k.h + m) + 1e-9);
      if (sl * ra > nej.n) nej = { n: sl * ra, sl: Math.max(1, sl) };
    }
    const n = chtene === 0 ? Math.max(1, nej.n) : chtene;
    return TT.nasob(k, n, Math.min(n, nej.sl || 1), m);
  }

  /* ---------- galerie předloh ---------- */
  let galerieHotova = false, pozorovatel = null;
  function galerie() {
    const m = $('modalGalerie'), obsah = $('galerieObsah');
    if (!galerieHotova) {
      galerieHotova = true;
      pozorovatel = 'IntersectionObserver' in window ? new IntersectionObserver((zaznamy) => {
        for (const z of zaznamy) if (z.isIntersecting) { pozorovatel.unobserve(z.target); nahledPredlohy(z.target); }
      }, { root: obsah, rootMargin: '200px' }) : null;
      for (const [sk, nazevSk] of SKUPINY.concat([['dalsi', 'Další']])) {
        const rez = REZIMY.filter((q) => (SKUPINA_REZIMU[q[0]] || 'dalsi') === sk);
        if (!rez.length) continue;
        const h = document.createElement('h3'); h.textContent = nazevSk; obsah.appendChild(h);
        for (const [id, ik, naz] of rez) {
          const h4 = document.createElement('h4'); h4.textContent = ik + ' ' + naz; obsah.appendChild(h4);
          const mr = document.createElement('div'); mr.className = 'galerie-mrizka';
          (PREDVOLBY[id] || []).forEach((p, i) => {
            const b = document.createElement('button'); b.className = 'predloha'; b.dataset.rezim = id; b.dataset.i = i;
            const nh = document.createElement('div'); nh.className = 'nahledG';
            const t = document.createElement('span'); t.textContent = p[0];
            b.append(nh, t);
            b.addEventListener('click', () => { m.classList.remove('otevreno'); pouzijPredvolbu(i, id); toast('Načtena předloha: ' + p[0]); });
            mr.appendChild(b);
            if (pozorovatel) pozorovatel.observe(b); else nahledPredlohy(b);
          });
          obsah.appendChild(mr);
        }
      }
    }
    m.classList.add('otevreno');
    $('galerieHledat').value = ''; filtrGalerie(''); $('galerieHledat').focus();
  }
  function nahledPredlohy(b) {
    try {
      const k = sestavZ(b.dataset.rezim, dataPredvolby(b.dataset.rezim, +b.dataset.i));
      // velmi protáhlé kresby (dlouhá pravítka): ukázat jen začátek, ať jsou rysky vidět
      const vw = Math.min(k.w, k.h * 3.2), vh = Math.min(k.h, k.w * 3.2);
      const svg = TT.svgKresby(k, { rez: 'sede' }).replace(/^<\?xml[^>]*>\s*/, '')
        .replace(/ width="[^"]*mm" height="[^"]*mm" viewBox="[^"]*"/, ` width="100%" height="100%" viewBox="0 0 ${TT.n(vw)} ${TT.n(vh)}" preserveAspectRatio="xMinYMid meet"`);
      b.querySelector('.nahledG').innerHTML = svg;
      b.title = `${(k.info || []).join(' · ')}`;
    } catch (e) { b.querySelector('.nahledG').textContent = '⚠'; }
  }
  function filtrGalerie(q) {
    q = q.trim().toLowerCase();
    const obsah = $('galerieObsah');
    for (const b of obsah.querySelectorAll('.predloha')) b.hidden = !!q && !b.textContent.toLowerCase().includes(q) && !String(b.title).toLowerCase().includes(q);
    for (const mr of obsah.querySelectorAll('.galerie-mrizka')) { const viditelne = [...mr.children].some((b) => !b.hidden); mr.hidden = !viditelne; mr.previousElementSibling.hidden = !viditelne; }
  }

  /* ---------- PNG s DPI (chunk pHYs) ---------- */
  let crcTab = null;
  function crc32(bytes) {
    if (!crcTab) { crcTab = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTab[n] = c >>> 0; } }
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = crcTab[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function pngSDpi(buf, dpi) {
    const src = new Uint8Array(buf), ppm = Math.round(dpi / 0.0254);
    const ch = new Uint8Array(21), dv = new DataView(ch.buffer);
    dv.setUint32(0, 9); ch.set([0x70, 0x48, 0x59, 0x73], 4); dv.setUint32(8, ppm); dv.setUint32(12, ppm); ch[16] = 1;
    dv.setUint32(17, crc32(ch.subarray(4, 17)));
    const out = new Uint8Array(src.length + 21);
    out.set(src.subarray(0, 33)); out.set(ch, 33); out.set(src.subarray(33), 54);      // za IHDR (8 + 25 bajtů)
    return out;
  }
  TT.pngSDpi = pngSDpi;
  async function exportPng(dpi) {
    const listy = R.listy;
    let d = dpi;
    const l0 = listy[0];
    const maxPx = 16000, maxPlocha = 1.2e8;
    while ((l0.pw / 25.4 * d > maxPx || l0.ph / 25.4 * d > maxPx || (l0.pw * l0.ph) / 645.16 * d * d > maxPlocha) && d > 72) d = Math.floor(d * 0.8);
    if (d !== dpi) toast(`Formát je na ${dpi} dpi příliš velký – použito ${d} dpi.`);
    for (const l of listy) {
      const svg = TT.svgListu(K, R, l, {});
      const img = new Image();
      await new Promise((ok, chyba) => { img.onload = ok; img.onerror = () => chyba(new Error('SVG se nepodařilo vykreslit')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
      const c = document.createElement('canvas');
      c.width = Math.round(l.pw / 25.4 * d); c.height = Math.round(l.ph / 25.4 * d);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
      const data = pngSDpi(await blob.arrayBuffer(), d);
      stahni(new Blob([data], { type: 'image/png' }), nazevSouboru(`${d}dpi${listy.length > 1 ? '_list' + l.cislo : ''}.png`));
      await new Promise((ok) => setTimeout(ok, 350));
    }
  }

  /* ---------- uložené návrhy ---------- */
  const KLIC_NAVRHY = 'webapp_tech_tisk_navrhy';
  function navrhy() { try { const a = JSON.parse(localStorage.getItem(KLIC_NAVRHY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function ulozNavrhy(a) { try { localStorage.setItem(KLIC_NAVRHY, JSON.stringify(a)); return true; } catch (e) { toast('Úložiště prohlížeče je plné nebo zakázané.'); return false; } }
  function seznamNavrhu() {
    const el = $('seznamNavrhu'); el.innerHTML = '';
    const a = navrhy();
    if (!a.length) { el.innerHTML = '<div class="napoveda">Zatím žádné uložené návrhy.</div>'; return; }
    a.forEach((nv, i) => {
      const r = document.createElement('div'); r.className = 'navrh';
      const b = document.createElement('button'); b.className = 'male nacti';
      const rz = REZIMY.find((q) => q[0] === nv.rezim);
      b.textContent = `${rz ? rz[1] : ''} ${nv.nazev}`; b.title = `${rz ? rz[2] : nv.rezim} · ${new Date(nv.datum).toLocaleString('cs-CZ')}`;
      b.addEventListener('click', () => {
        if (!rz) { toast('Tento druh předlohy stránka nezná.'); return; }
        const c = {}; c[nv.rezim] = kopie(nv.data); S[nv.rezim] = Object.assign(S[nv.rezim] && !Array.isArray(S[nv.rezim]) ? kopie(S[nv.rezim]) : {}, c[nv.rezim]);
        if (nv.tisk) slouc(S.tisk, nv.tisk);
        formular($('formTisk'), SCHEMA_TISK, S.tisk, zmenaTisku);
        prepniRezim(nv.rezim); toast('Načten návrh „' + nv.nazev + '“.');
      });
      const x = document.createElement('button'); x.className = 'male nebezpecne'; x.textContent = '✕'; x.title = 'Smazat návrh';
      x.addEventListener('click', () => { const b2 = navrhy(); b2.splice(i, 1); ulozNavrhy(b2); seznamNavrhu(); });
      r.append(b, x); el.appendChild(r);
    });
  }
  function ulozNavrh() {
    const inp = $('nazevNavrhu');
    const rz = REZIMY.find((q) => q[0] === S.rezim);
    const nazev = inp.value.trim() || `${rz[2]} ${new Date().toLocaleDateString('cs-CZ')}`;
    const a = navrhy().filter((q) => q.nazev !== nazev);
    a.unshift({ nazev, rezim: S.rezim, data: kopie(S[S.rezim]), tisk: kopie(S.tisk), datum: Date.now() });
    if (ulozNavrhy(a.slice(0, 200))) { inp.value = ''; seznamNavrhu(); toast('Návrh „' + nazev + '“ uložen.'); }
  }
  function exportNavrhu() { stahni(JSON.stringify({ format: 'tech_tisk_navrhy', verze: 1, navrhy: navrhy() }, null, 1), 'technicke_predlohy.json', 'application/json'); }
  function importNavrhu(soubor) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const d = JSON.parse(fr.result), nove = Array.isArray(d) ? d : d.navrhy;
        if (!Array.isArray(nove)) throw new Error('neznámý formát');
        const platne = nove.filter((q) => q && typeof q.nazev === 'string' && typeof q.rezim === 'string' && q.data && typeof q.data === 'object');
        const a = navrhy();
        for (const q of platne) { const i = a.findIndex((x) => x.nazev === q.nazev); if (i >= 0) a[i] = q; else a.push(q); }
        ulozNavrhy(a); seznamNavrhu(); toast(`Načteno ${platne.length} návrhů.`);
      } catch (e) { toast('Soubor nejde načíst: ' + e.message); }
    };
    fr.readAsText(soubor);
  }

  /* ---------- start ---------- */
  function start() {
    nactiPismo();                          // písmo pro PDF na pozadí (SW ho pak má i offline)
    nactiStav();
    const nav = $('rezimy');
    for (const [sk, nazevSk] of SKUPINY.concat([['dalsi', 'Další']])) {
      const rez = REZIMY.filter((q) => (SKUPINA_REZIMU[q[0]] || 'dalsi') === sk);
      if (!rez.length) continue;
      const g = document.createElement('div'); g.className = 'skupina-rezimu';
      const l = document.createElement('span'); l.className = 'nazev-skupiny'; l.textContent = nazevSk; g.appendChild(l);
      for (const [id, ik, naz] of rez) {
        const b = document.createElement('button'); b.dataset.rezim = id; b.setAttribute('role', 'tab');
        b.innerHTML = `<span aria-hidden="true">${ik}</span> ${naz}`;
        b.addEventListener('click', () => prepniRezim(id));
        g.appendChild(b);
      }
      nav.appendChild(g);
    }
    const gb = document.createElement('button'); gb.id = 'btnGalerie'; gb.className = 'hlavni'; gb.textContent = '📚 Galerie předloh';
    gb.addEventListener('click', galerie); nav.appendChild(gb);
    $('galerieHledat').addEventListener('input', (e) => filtrGalerie(e.target.value));
    $('modalGalerie').addEventListener('click', (e) => { if (e.target.id === 'modalGalerie' || e.target.id === 'galerieZavrit') $('modalGalerie').classList.remove('otevreno'); });
    $('btnPng300').onclick = () => exportPng(300).catch((e) => toast('PNG: ' + e.message));
    $('btnPng600').onclick = () => exportPng(600).catch((e) => toast('PNG: ' + e.message));
    $('btnUlozNavrh').onclick = ulozNavrh;
    $('nazevNavrhu').addEventListener('keydown', (e) => { if (e.key === 'Enter') ulozNavrh(); });
    $('btnExportNavrhu').onclick = exportNavrhu;
    $('btnImportNavrhu').onclick = () => $('souborNavrhu').click();
    $('souborNavrhu').addEventListener('change', (e) => { if (e.target.files[0]) importNavrhu(e.target.files[0]); e.target.value = ''; });
    seznamNavrhu();
    formular($('formTisk'), SCHEMA_TISK, S.tisk, zmenaTisku);
    formular($('formKorekce'), SCHEMA_KOREKCE, S.tisk, naplanuj);
    $('predvolba').addEventListener('change', (e) => { if (e.target.value !== '') pouzijPredvolbu(+e.target.value); e.target.value = ''; });
    $('zPrizpusobit').onclick = () => { zoom.rezim = 'fit'; vykresli(); };
    $('zSkutecna').onclick = () => { zoom.rezim = 'real'; vykresli(); };
    $('zPlus').onclick = () => { zoom.rezim = 'ruc'; zoom.pxmm = Math.min(30, zoom.pxmm * 1.25); vykresli(); };
    $('zMinus').onclick = () => { zoom.rezim = 'ruc'; zoom.pxmm = Math.max(0.4, zoom.pxmm / 1.25); vykresli(); };
    $('zKalibrace').onclick = kalibrace;
    $('modalKalib').addEventListener('click', (e) => { if (e.target.id === 'modalKalib') e.target.classList.remove('otevreno'); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('modalKalib').classList.remove('otevreno'); $('modalGalerie').classList.remove('otevreno'); } });
    $('btnPdf').onclick = pdfStahnout;
    $('btnPdfOtevrit').onclick = pdfOtevrit;
    $('btnSvg').onclick = () => stahni(TT.svgKresby(K, { rez: S.tisk.rez === 'skryt' ? 'skryt' : S.tisk.rez }), nazevSouboru('svg'), 'image/svg+xml');
    $('btnSvgLaser').onclick = () => stahni(TT.svgKresby(K, { laser: true }), nazevSouboru('laser.svg'), 'image/svg+xml');
    $('btnDxf').onclick = () => stahni(TT.dxf(K, {}), nazevSouboru('dxf'), 'application/dxf');
    $('btnCsv').onclick = () => {
      const otv = S.rezim === 'sablona' ? otvorySablony() : TT.vzorOtvory(S.roztece.vzor);
      stahni('﻿' + TT.csvOtvory(otv), nazevSouboru('csv'), 'text/csv;charset=utf-8');
    };
    $('btnOdkaz').onclick = odkaz;
    $('btnNaList').onclick = prizpusobTlacitkem;
    let rt = 0;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (zoom.rezim === 'fit') vykresli(); }, 150); });
    if (!REZIMY.some((q) => q[0] === S.rezim)) S.rezim = 'pravitko';
    prepniRezim(S.rezim);
    if (/[#&]s=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
    // pro testy
    window.TT_UI = { prizpusob, plochyListu, stav: () => S, kresba: () => K, rozvrh: () => R, prepniRezim, pouzijPredvolbu, vytvorPdf, prepocti, rezimy: () => REZIMY, predvolby: (r) => PREDVOLBY[r] || [], sestavZ, dataPredvolby, galerie, pngSDpi };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* ============================================================
   hieroglyfy/znaky.js – data Egyptského písaře.

   KODY       – Gardinerova čísla všech 1072 základních znaků Unicode
                v pořadí kódových bodů (index = kód − U+13000).
   SKUPINY    – Gardinerovy kategorie (A muži, B ženy, … Aa nezařazené).
   POPIS      – co znak zobrazuje a jak se čte (jen běžné znaky).
   ZVUKY      – jednosouhláskové znaky podle zvuku (egyptologický přepis).
   VICEZNAKY  – dvou- a trojsouhláskové znaky s obvyklými fonetickými doplňky.
   SLOVNIK    – egyptská slova a ustálené fráze s českými tvary.

   Pravopis ve slovníku je učebnicový (Gardiner, Allen, Collier–Manley);
   Egypťané psali tatáž slova mnoha variantami, tady je vždy jedna běžná.
   ============================================================ */
(function (g) {
  'use strict';

  const KODY = 'A1 A2 A3 A4 A5 A5A A6 A6A A6B A7 A8 A9 A10 A11 A12 A13 A14 A14A A15 A16 A17 A17A A18 A19 A20 A21 A22 A23 A24 A25 A26 A27 A28 A29 A30 A31 A32 A32A A33 A34 A35 A36 A37 A38 A39 A40 A40A A41 A42 A42A A43 A43A A44 A45 A45A A46 A47 A48 A49 A50 A51 A52 A53 A54 A55 A56 A57 A58 A59 A60 A61 A62 A63 A64 A65 A66 A67 A68 A69 A70 B1 B2 B3 B4 B5 B5A B6 B7 B8 B9 C1 C2 C2A C2B C2C C3 C4 C5 C6 C7 C8 C9 C10 C10A C11 C12 C13 C14 C15 C16 C17 C18 C19 C20 C21 C22 C23 C24 D1 D2 D3 D4 D5 D6 D7 D8 D8A D9 D10 D11 D12 D13 D14 D15 D16 D17 D18 D19 D20 D21 D22 D23 D24 D25 D26 D27 D27A D28 D29 D30 D31 D31A D32 D33 D34 D34A D35 D36 D37 D38 D39 D40 D41 D42 D43 D44 D45 D46 D46A D47 D48 D48A D49 D50 D50A D50B D50C D50D D50E D50F D50G D50H D50I D51 D52 D52A D53 D54 D54A D55 D56 D57 D58 D59 D60 D61 D62 D63 D64 D65 D66 D67 D67A D67B D67C D67D D67E D67F D67G D67H E1 E2 E3 E4 E5 E6 E7 E8 E8A E9 E9A E10 E11 E12 E13 E14 E15 E16 E16A E17 E17A E18 E19 E20 E20A E21 E22 E23 E24 E25 E26 E27 E28 E28A E29 E30 E31 E32 E33 E34 E34A E36 E37 E38 F1 F1A F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12 F13 F13A F14 F15 F16 F17 F18 F19 F20 F21 F21A F22 F23 F24 F25 F26 F27 F28 F29 F30 F31 F31A F32 F33 F34 F35 F36 F37 F37A F38 F38A F39 F40 F41 F42 F43 F44 F45 F45A F46 F46A F47 F47A F48 F49 F50 F51 F51A F51B F51C F52 F53 G1 G2 G3 G4 G5 G6 G6A G7 G7A G7B G8 G9 G10 G11 G11A G12 G13 G14 G15 G16 G17 G18 G19 G20 G20A G21 G22 G23 G24 G25 G26 G26A G27 G28 G29 G30 G31 G32 G33 G34 G35 G36 G36A G37 G37A G38 G39 G40 G41 G42 G43 G43A G44 G45 G45A G46 G47 G48 G49 G50 G51 G52 G53 G54 H1 H2 H3 H4 H5 H6 H6A H7 H8 I1 I2 I3 I4 I5 I5A I6 I7 I8 I9 I9A I10 I10A I11 I11A I12 I13 I14 I15 K1 K2 K3 K4 K5 K6 K7 K8 L1 L2 L2A L3 L4 L5 L6 L6A L7 L8 M1 M1A M1B M2 M3 M3A M4 M5 M6 M7 M8 M9 M10 M10A M11 M12 M12A M12B M12C M12D M12E M12F M12G M12H M13 M14 M15 M15A M16 M16A M17 M17A M18 M19 M20 M21 M22 M22A M23 M24 M24A M25 M26 M27 M28 M28A M29 M30 M31 M31A M32 M33 M33A M33B M34 M35 M36 M37 M38 M39 M40 M40A M41 M42 M43 M44 N1 N2 N3 N4 N5 N6 N7 N8 N9 N10 N11 N12 N13 N14 N15 N16 N17 N18 N18A N18B N19 N20 N21 N22 N23 N24 N25 N25A N26 N27 N28 N29 N30 N31 N32 N33 N33A N34 N34A N35 N35A N36 N37 N37A N38 N39 N40 N41 N42 NL1 NL2 NL3 NL4 NL5 NL5A NL6 NL7 NL8 NL9 NL10 NL11 NL12 NL13 NL14 NL15 NL16 NL17 NL17A NL18 NL19 NL20 NU1 NU2 NU3 NU4 NU5 NU6 NU7 NU8 NU9 NU10 NU10A NU11 NU11A NU12 NU13 NU14 NU15 NU16 NU17 NU18 NU18A NU19 NU20 NU21 NU22 NU22A O1 O1A O2 O3 O4 O5 O5A O6 O6A O6B O6C O6D O6E O6F O7 O8 O9 O10 O10A O10B O10C O11 O12 O13 O14 O15 O16 O17 O18 O19 O19A O20 O20A O21 O22 O23 O24 O24A O25 O25A O26 O27 O28 O29 O29A O30 O30A O31 O32 O33 O33A O34 O35 O36 O36A O36B O36C O36D O37 O38 O39 O40 O41 O42 O43 O44 O45 O46 O47 O48 O49 O50 O50A O50B O51 P1 P1A P2 P3 P3A P4 P5 P6 P7 P8 P9 P10 P11 Q1 Q2 Q3 Q4 Q5 Q6 Q7 R1 R2 R2A R3 R3A R3B R4 R5 R6 R7 R8 R9 R10 R10A R11 R12 R13 R14 R15 R16 R16A R17 R18 R19 R20 R21 R22 R23 R24 R25 R26 R27 R28 R29 S1 S2 S2A S3 S4 S5 S6 S6A S7 S8 S9 S10 S11 S12 S13 S14 S14A S14B S15 S16 S17 S17A S18 S19 S20 S21 S22 S23 S24 S25 S26 S26A S26B S27 S28 S29 S30 S31 S32 S33 S34 S35 S35A S36 S37 S38 S39 S40 S41 S42 S43 S44 S45 S46 T1 T2 T3 T3A T4 T5 T6 T7 T7A T8 T8A T9 T9A T10 T11 T11A T12 T13 T14 T15 T16 T16A T17 T18 T19 T20 T21 T22 T23 T24 T25 T26 T27 T28 T29 T30 T31 T32 T32A T33 T33A T34 T35 T36 U1 U2 U3 U4 U5 U6 U6A U6B U7 U8 U9 U10 U11 U12 U13 U14 U15 U16 U17 U18 U19 U20 U21 U22 U23 U23A U24 U25 U26 U27 U28 U29 U29A U30 U31 U32 U32A U33 U34 U35 U36 U37 U38 U39 U40 U41 U42 V1 V1A V1B V1C V1D V1E V1F V1G V1H V1I V2 V2A V3 V4 V5 V6 V7 V7A V7B V8 V9 V10 V11 V11A V11B V11C V12 V12A V12B V13 V14 V15 V16 V17 V18 V19 V20 V20A V20B V20C V20D V20E V20F V20G V20H V20I V20J V20K V20L V21 V22 V23 V23A V24 V25 V26 V27 V28 V28A V29 V29A V30 V30A V31 V31A V32 V33 V33A V34 V35 V36 V37 V37A V38 V39 V40 V40A W1 W2 W3 W3A W4 W5 W6 W7 W8 W9 W9A W10 W10A W11 W12 W13 W14 W14A W15 W16 W17 W17A W18 W18A W19 W20 W21 W22 W23 W24 W24A W25 X1 X2 X3 X4 X4A X4B X5 X6 X6A X7 X8 X8A Y1 Y1A Y2 Y3 Y4 Y5 Y6 Y7 Y8 Z1 Z2 Z2A Z2B Z2C Z2D Z3 Z3A Z3B Z4 Z4A Z5 Z5A Z6 Z7 Z8 Z9 Z10 Z11 Z12 Z13 Z14 Z15 Z15A Z15B Z15C Z15D Z15E Z15F Z15G Z15H Z15I Z16 Z16A Z16B Z16C Z16D Z16E Z16F Z16G Z16H Aa1 Aa2 Aa3 Aa4 Aa5 Aa6 Aa7 Aa7A Aa7B Aa8 Aa9 Aa10 Aa11 Aa12 Aa13 Aa14 Aa15 Aa16 Aa17 Aa18 Aa19 Aa20 Aa21 Aa22 Aa23 Aa24 Aa25 Aa26 Aa27 Aa28 Aa29 Aa30 Aa31 Aa32 V11D'.split(' ');
  const ZNAK = {};
  KODY.forEach((k, i) => { ZNAK[k] = String.fromCodePoint(0x13000 + i); });

  const SKUPINY = {
    A: 'Muži a jejich činnosti', B: 'Ženy', C: 'Božstva v lidské podobě',
    D: 'Části lidského těla', E: 'Savci', F: 'Části těl savců', G: 'Ptáci',
    H: 'Části ptačích těl', I: 'Obojživelníci a plazi', K: 'Ryby',
    L: 'Hmyz a bezobratlí', M: 'Stromy a rostliny', N: 'Nebe, země, voda',
    NL: 'Nomy Dolního Egypta', NU: 'Nomy Horního Egypta', O: 'Stavby a jejich části',
    P: 'Lodě a jejich části', Q: 'Nábytek a pohřební výbava', R: 'Chrámové vybavení a posvátné symboly',
    S: 'Koruny, oděvy, hole', T: 'Válka, lov, řeznictví', U: 'Zemědělství a řemesla',
    V: 'Provazy, vlákna, koše', W: 'Nádoby z kamene a hlíny', X: 'Chléb a koláče',
    Y: 'Psaní, hry, hudba', Z: 'Tahy a geometrické tvary', Aa: 'Nezařazené',
  };
  const skupina = kod => (kod.match(/^(Aa|NL|NU|[A-Z])/) || [])[1];

  /* 'kód': 'co zobrazuje|čtení nebo užití' */
  const POPIS = {
    // jednosouhláskové („abeceda“)
    G1: 'sup egyptský|ꜣ', M17: 'kvetoucí rákos|i', M17A: 'dva rákosy|y', Z4: 'dvě šikmé čárky|y',
    D36: 'předloktí|ꜥ', G43: 'mládě křepelky|w', Z7: 'spirála (hieratické w)|w', D58: 'noha|b',
    Q3: 'stolička z rohože|p', I9: 'zmije rohatá|f', G17: 'sova|m', N35: 'vodní hladina|n',
    D21: 'ústa|r', O4: 'přístřešek na dvoře|h', V28: 'stočený knot|ḥ', Aa1: 'placenta (síto)|ḫ',
    F32: 'břicho zvířete s vemenem|ẖ', O34: 'závora dveří|z', S29: 'složená látka|s',
    N37: 'jezírko|š', N29: 'svah kopce|q', V31: 'košík s uchem|k', W11: 'stojan na džbán|g',
    X1: 'bochník chleba|t', V13: 'provaz na uvázání zvířat|ṯ', D46: 'ruka|d', I10: 'kobra|ḏ',
    E23: 'ležící lev|rw, v pozdní době l', V4: 'laso|wꜣ',
    // dvousouhláskové
    Y5: 'deska na hru senet|mn', V30: 'košík|nb, pán', O1: 'půdorys domu|pr, dům', U6: 'motyka|mr',
    G36: 'vlaštovka|wr, velký', G39: 'kachna ostralka|sꜣ, syn', D28: 'zdvižené paže|kꜣ (duše)',
    G29: 'čáp sedlatý|bꜣ (duše)', D2: 'obličej|ḥr', D1: 'hlava z profilu|tp, hlava', D4: 'oko|ir',
    U1: 'srp|mꜣ', W24: 'miska|nw', N16: 'pozemek se zrny|tꜣ, země', F31: 'tři liščí kůže|ms',
    T22: 'hrot šípu|sn', R11: 'sloup džed|ḏd, stálost', O29: 'dřevěný sloup|ꜥꜣ, velký',
    N35A: 'tři vodní hladiny|mw, voda', E34: 'zajíc|wn', M23: 'ostřice (rostlina sut)|sw, král Horního Egypta',
    G25: 'ibis chocholatý|ꜣḫ', N26: 'hora|ḏw', M16: 'trs papyru|ḥꜣ', I6: 'krokodýlí kůže|km',
    Y3: 'písařská paleta|zẖꜣ, písař', U28: 'nástroj na rozdělávání ohně|ḏꜣ', U7: 'motyka|mr',
    // trojsouhláskové
    S34: 'anch – tkanice sandálu|ꜥnḫ, život', F35: 'srdce s průdušnicí|nfr, krásný',
    R4: 'obětní rohož s chlebem|ḥtp, mír', R8: 'chrámová korouhev|nṯr, bůh', L1: 'skarabeus|ḫpr, stávat se',
    S40: 'žezlo uas|wꜣs, moc', S38: 'pastýřská berla|ḥqꜣ, vládce', M4: 'palmová ratolest|rnp, rok',
    N14: 'hvězda|sbꜣ, dwꜣ', Aa11: 'podstavec|mꜣꜥ', P8: 'veslo|ḫrw, hlas', S12: 'zlatý náhrdelník|nbw, zlato',
    S42: 'žezlo sechem|sḫm, moc', S43: 'hůl|md', N8: 'slunce s paprsky|wbn, vycházet',
    // určující znaky (determinativy) a slovní znaky
    A1: 'sedící muž|určuje muže, „já“', A2: 'muž s rukou u úst|jíst, mluvit, myslet',
    A17: 'dítě s prstem u úst|dítě', A24: 'muž bijící holí|síla, úsilí', A40: 'sedící bůh|bůh, král',
    A43: 'král s bílou korunou|král', A47: 'pastýř|pást', A50: 'urozený muž na křesle|vznešený',
    A55: 'mumie na márách|smrt', B1: 'sedící žena|určuje ženu', C10: 'bohyně Maat|mꜣꜥt, pravda',
    C11: 'bůh Heh|ḥḥ, milion', D10: 'Horovo oko (udžat)|wḏꜣt', D54: 'kráčející nohy|pohyb',
    E1: 'býk|dobytek', E13: 'kočka|kočka', E15: 'ležící šakal|Anup (Anubis)', E22: 'lev|lev',
    G5: 'sokol|Hor', G7: 'sokol na žerdi|bůh, král', G14: 'sup|mwt, matka', G21: 'perlička|nḥ',
    G26: 'ibis na podstavci|Thovt', G53: 'pták ba s lidskou hlavou|bꜣ, duše', H6: 'pštrosí pero|šw, pravda',
    I12: 'vztyčená kobra|bohyně', K1: 'ryba bolti|in, ryba', L2: 'včela|bit, Dolní Egypt',
    M1: 'strom|strom', N1: 'nebe|nebe', N2: 'nebe se žezlem|noc, tma', N5: 'slunce|rꜥ, slunce, den',
    N11: 'srpek měsíce|měsíc', N25: 'pahorkatina|cizí země, poušť', N41: 'studna s vodou|ḥm',
    O6: 'ohrazení|ḥwt, chrám', O24: 'pyramida|pyramida', O49: 'křižovatka ve městě|město',
    P5: 'plachta|ṯꜣw, vítr', Q1: 'trůn|st, ꜣs', W22: 'džbán na pivo|pivo, nádoba', X8: 'kónický bochník|di, dát',
    Y1: 'svinutý papyrus|psaní, pojmy', Z1: 'čárka|slovní znak, 1', Z2: 'tři čárky|množné číslo',
    Z3: 'tři svislé čárky|množné číslo', V9: 'kruh šen|šn', V10: 'kartuše|jméno',
    V11A: 'začátek kartuše|', V11B: 'konec kartuše|', Q7: 'kadidelnice s ohněm|oheň', S24: 'uzel|ṯs',
    // číslice
    Z15: 'čárka|1', V20: 'okov|10', V1: 'stočený provaz|100', M12: 'lotos|1 000', D50: 'prst|10 000',
    I8: 'pulec|100 000',
  };

  /* jednosouhláskové znaky podle zvuku (egyptologický přepis) */
  const ZVUKY = {
    'ꜣ': 'G1', i: 'M17', y: 'M17A', 'ꜥ': 'D36', w: 'G43', b: 'D58', p: 'Q3', f: 'I9', m: 'G17',
    n: 'N35', r: 'D21', l: 'E23', h: 'O4', 'ḥ': 'V28', 'ḫ': 'Aa1', 'ẖ': 'F32', z: 'O34', s: 'S29',
    'š': 'N37', q: 'N29', k: 'V31', g: 'W11', t: 'X1', 'ṯ': 'V13', d: 'D46', 'ḏ': 'I10',
  };

  /* víceznakové znaky: hodnota → [kód, fonetické doplňky].
     Doplňky jsou jednosouhláskové znaky, které Egypťané za takový znak
     obvykle psali, aby bylo jasné, jak se čte (mn + n, nfr + f + r …). */
  const VICEZNAKY = [
    ['ꜥnḫ', 'S34', 'N35 Aa1'], ['nfr', 'F35', 'I9 D21'], ['ḥtp', 'R4', 'X1 Q3'], ['ḫpr', 'L1', 'D21'],
    ['nṯr', 'R8', ''], ['ḥqꜣ', 'S38', ''], ['wꜣs', 'S40', ''], ['mꜣꜥ', 'Aa11', 'D36'], ['nbw', 'S12', ''],
    ['wḏꜣ', 'U28', 'G1'],
    ['mn', 'Y5', 'N35'], ['nb', 'V30', ''], ['pr', 'O1', 'D21'], ['mr', 'U6', 'D21'], ['wr', 'G36', 'D21'],
    ['sꜣ', 'G39', ''], ['kꜣ', 'D28', ''], ['bꜣ', 'G29', ''], ['ḥr', 'D2', 'D21'],
    ['ir', 'D4', 'D21'], ['mꜣ', 'U1', 'G1'], ['nw', 'W24', ''], ['ms', 'F31', 'S29'], ['sn', 'T22', 'N35'],
    ['ḏd', 'R11', 'D46'], ['ꜥꜣ', 'O29', 'G1'], ['mw', 'N35A', ''], ['wn', 'E34', 'N35'], ['sw', 'M23', 'G43'],
    ['ꜣḫ', 'G25', 'Aa1'], ['ḏw', 'N26', ''], ['ḥꜣ', 'M16', 'G1'], ['km', 'I6', 'G17'], ['ḥm', 'N41', ''],
    ['wꜣ', 'V4', 'G1'],
  ];

  /* Slovníček: cs = české tvary (bez ohledu na diakritiku a velikost),
     tr = přepis, z = kódy znaků v pořadí psaní. */
  const SLOVNIK = [
    { cs: ['život zdraví síla', 'život prosperita zdraví', 'ať žije', 'ať je živ zdráv'], tr: 'ꜥnḫ wḏꜣ snb', z: 'S34 U28 S29', pozn: 'zkratka za jménem faraona: „živ, zdráv, prospívej“' },
    { cs: ['obdařen životem', 'dán život', 'obdarován životem'], tr: 'di ꜥnḫ', z: 'X8 S34' },
    { cs: ['oběť kterou dává král', 'obětní formule'], tr: 'ḥtp di nsw', z: 'M23 X1 R4 X8', pozn: 'slovo „král“ se píše napřed z úcty' },
    { cs: ['zdravím tě', 'buď zdráv', 'ahoj', 'nazdar', 'pozdrav'], tr: 'ind ḥr=k', z: 'M17 N35 D46 A2 D2 D21 V31', pozn: '„buď zdráv“ (doslova „pozdrav tvé tváři“)' },
    { cs: ['hieroglyfy', 'hieroglyf', 'hieroglyfů', 'boží slova', 'božská slova'], tr: 'mdw nṯr', z: 'R8 S43 D46 G43', pozn: 'boží slova; slovo „bůh“ se píše napřed z úcty' },
    { cs: ['pravdomluvný', 'ospravedlněný', 'zesnulý'], tr: 'mꜣꜥ ḫrw', z: 'Aa11 P8', pozn: '„pravého hlasu“ – přídomek zesnulých' },
    { cs: ['život', 'života', 'životem', 'životy', 'žít', 'živý', 'živá', 'živ', 'anch', 'ankh'], tr: 'ꜥnḫ', z: 'S34 N35 Aa1' },
    { cs: ['zdraví', 'zdravý', 'zdravá', 'zdráv'], tr: 'snb', z: 'S29 N35 D58' },
    { cs: ['prosperita', 'blaho', 'síla'], tr: 'wḏꜣ', z: 'U28 G1' },
    { cs: ['slunce', 'slunci', 'sluncem', 'ra', 're', 'den'], tr: 'rꜥ', z: 'D21 D36 N5 Z1' },
    { cs: ['bůh', 'boha', 'bohu', 'bohem', 'božský'], tr: 'nṯr', z: 'R8 A40' },
    { cs: ['bohové', 'bohy', 'bohům'], tr: 'nṯrw', z: 'R8 R8 R8' },
    { cs: ['bohyně'], tr: 'nṯrt', z: 'R8 X1 I12' },
    { cs: ['faraon', 'faraona', 'faraonovi', 'faraonem', 'faraoni', 'faraonů'], tr: 'pr ꜥꜣ', z: 'O1 O29', pozn: 'doslova „velký dům“ (palác)' },
    { cs: ['král', 'krále', 'královi', 'králem', 'králové', 'králů'], tr: 'nsw', z: 'M23 X1 N35' },
    { cs: ['královna'], tr: 'ḥmt nsw', z: 'M23 X1 N41 X1 B1', pozn: '„královská manželka“' },
    { cs: ['dům', 'domu', 'domov', 'domě', 'domy'], tr: 'pr', z: 'O1 Z1' },
    { cs: ['krásný', 'krásná', 'krásné', 'krása', 'dobrý', 'dobrá', 'dobré', 'dobro', 'hezký', 'hezká', 'nefer'], tr: 'nfr', z: 'F35 I9 D21' },
    { cs: ['pravda', 'pravdy', 'pravdu', 'spravedlnost', 'řád', 'maat'], tr: 'mꜣꜥt', z: 'U1 D36 X1 H6' },
    { cs: ['mír', 'míru', 'klid', 'spokojenost', 'spokojený', 'hotep'], tr: 'ḥtp', z: 'R4 X1 Q3' },
    { cs: ['láska', 'lásky', 'lásce', 'lásku', 'milovat', 'miluji', 'miluju', 'milovaný', 'milovaná'], tr: 'mrwt', z: 'U6 D21 G43 X1 A2' },
    { cs: ['srdce', 'srdcem', 'srdci'], tr: 'ib', z: 'M17 D58 F34' },
    { cs: ['jméno', 'jména', 'jménem', 'jménu'], tr: 'rn', z: 'D21 N35' },
    { cs: ['pán', 'pána', 'pánem', 'vládce', 'každý'], tr: 'nb', z: 'V30' },
    { cs: ['paní', 'vládkyně'], tr: 'nbt', z: 'V30 X1 B1' },
    { cs: ['syn', 'syna', 'synem', 'synovi', 'synové'], tr: 'sꜣ', z: 'G39 Z1 A1' },
    { cs: ['dcera', 'dcery', 'dceru', 'dcerou', 'dceři'], tr: 'sꜣt', z: 'G39 X1 B1' },
    { cs: ['bratr', 'bratra', 'bratrem', 'bratrovi', 'bratři'], tr: 'sn', z: 'T22 N35 A1' },
    { cs: ['sestra', 'sestry', 'sestru', 'sestrou', 'sestře'], tr: 'snt', z: 'T22 N35 X1 B1' },
    { cs: ['otec', 'otce', 'otcem', 'otci', 'táta', 'tatínek'], tr: 'it', z: 'M17 X1 I9 A1' },
    { cs: ['matka', 'matky', 'matku', 'matkou', 'matce', 'máma', 'maminka'], tr: 'mwt', z: 'G14 X1 B1' },
    { cs: ['muž', 'muže', 'mužem', 'člověk', 'někdo'], tr: 's', z: 'S29 A1' },
    { cs: ['žena', 'ženy', 'ženu', 'ženou', 'manželka'], tr: 'ḥmt', z: 'N41 X1 B1' },
    { cs: ['dítě', 'dítěte', 'děti', 'dětí'], tr: 'ẖrd', z: 'F32 D21 D46 A17' },
    { cs: ['písař', 'písaře', 'písařem'], tr: 'zẖꜣ', z: 'Y3 A1' },
    { cs: ['egypt', 'egypta', 'egyptě', 'egyptem', 'kemet'], tr: 'kmt', z: 'I6 G17 X1 O49', pozn: '„černá (země)“ – úrodné bahno kolem Nilu' },
    { cs: ['město', 'města', 'městě', 'městem'], tr: 'niwt', z: 'O49 X1 Z1' },
    { cs: ['chrám', 'chrámu', 'chrámem', 'chrámy'], tr: 'ḥwt nṯr', z: 'R8 O6 X1', pozn: '„dům boha“; „bůh“ napřed z úcty' },
    { cs: ['pyramida', 'pyramidy', 'pyramidu', 'pyramidě'], tr: 'mr', z: 'U6 D21 O24' },
    { cs: ['nebe', 'nebi', 'nebem', 'obloha'], tr: 'pt', z: 'Q3 X1 N1' },
    { cs: ['země', 'zemi', 'zemí'], tr: 'tꜣ', z: 'N16 Z1' },
    { cs: ['voda', 'vody', 'vodu', 'vodou', 'vodě'], tr: 'mw', z: 'N35A' },
    { cs: ['řeka', 'řeky', 'řeku', 'nil', 'nilu'], tr: 'itrw', z: 'M17 X1 D21 G43 N35A' },
    { cs: ['hvězda', 'hvězdy', 'hvězdu', 'hvězdou'], tr: 'sbꜣ', z: 'S29 D58 G1 N14' },
    { cs: ['měsíc', 'měsíce', 'luna'], tr: 'iꜥḥ', z: 'M17 D36 V28 N11' },
    { cs: ['noc', 'noci', 'nocí'], tr: 'grḥ', z: 'W11 D21 V28 N2' },
    { cs: ['hora', 'hory', 'horu', 'horou'], tr: 'ḏw', z: 'N26' },
    { cs: ['strom', 'stromu', 'stromy'], tr: 'nht', z: 'N35 O4 X1 M1' },
    { cs: ['vítr', 'větru', 'dech', 'vzduch'], tr: 'ṯꜣw', z: 'V13 G1 G43 P5' },
    { cs: ['zlato', 'zlata', 'zlatem', 'zlatý', 'zlatá'], tr: 'nbw', z: 'S12' },
    { cs: ['kočka', 'kočky', 'kočku', 'kočkou', 'kocour'], tr: 'miw', z: 'G17 M17 G43 E13' },
    { cs: ['lev', 'lva', 'lvem', 'lvi'], tr: 'mꜣi', z: 'U1 G1 M17 E22' },
    { cs: ['býk', 'býka', 'býkem'], tr: 'kꜣ', z: 'D28 E1' },
    { cs: ['ryba', 'ryby', 'rybu', 'rybou'], tr: 'rm', z: 'D21 G17 K1' },
    { cs: ['duše', 'ka'], tr: 'kꜣ', z: 'D28 Z1' },
    { cs: ['ba'], tr: 'bꜣ', z: 'G53' },
    { cs: ['věčnost', 'věčně', 'navždy', 'věčný'], tr: 'ḏt', z: 'I10 X1 N16' },
    { cs: ['velký', 'velká', 'velké', 'veliký'], tr: 'ꜥꜣ', z: 'O29 D36 G1' },
    { cs: ['rok', 'roku', 'roky', 'let'], tr: 'rnpt', z: 'M4 X1 N5' },
    { cs: ['amon', 'amona', 'amun', 'amen'], tr: 'imn', z: 'M17 Y5 N35 A40' },
    { cs: ['usir', 'osiris', 'usira', 'osirida'], tr: 'wsir', z: 'Q1 D4 A40' },
    { cs: ['eset', 'isis', 'esety'], tr: 'ꜣst', z: 'Q1 X1 B1' },
    { cs: ['horus', 'hore'], tr: 'ḥr', z: 'G5', pozn: 'sokolí bůh (česky Hor – tvar „hor“ by se pletl s horou)' },
    { cs: ['anup', 'anubis', 'anupa'], tr: 'inpw', z: 'M17 N35 Q3 G43 E15' },
    { cs: ['thovt', 'thot', 'thoth', 'džehuti'], tr: 'ḏḥwty', z: 'G26' },
    { cs: ['ptah'], tr: 'ptḥ', z: 'Q3 X1 V28 A40' },
  ];

  const API = { KODY, ZNAK, SKUPINY, skupina, POPIS, ZVUKY, VICEZNAKY, SLOVNIK };
  g.HIERO_ZNAKY = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);

/* Stojany a držáky – jádro univerzálního návrháře (bez DOM a bez three.js, spustitelné v node).
   Sestava = podstava + moduly (polička, přihrádky, sedlo, háček, jazyk, kolíky, lůžko nabíječky, jamky, vodítko kabelů).
   Tady jsou tabulky, schéma modulů (výchozí hodnoty, meze, formuláře), zařízení a předvolby, normalizace
   (i převod projektů v1 se 4 pevnými druhy) a kontroly zadání. Geometrie je ve stojany/tvary.js.
   Plán: docs/plany/Stojany_PLAN.md. */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G3D = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const fmt = G3D.fmt;
  const RAD = Math.PI / 180;

  /* ---------------- tabulky ---------------- */
  /** Šrouby se zápustnou hlavou: d jmenovitý průměr, dk průměr hlavy (vruty DIN 7997, metrické ISO 10642). */
  const SROUBY = {
    vrut3: { nazev: 'vrut 3 mm', d: 3, dk: 6 },
    'vrut3.5': { nazev: 'vrut 3,5 mm', d: 3.5, dk: 7 },
    vrut4: { nazev: 'vrut 4 mm', d: 4, dk: 8 },
    'vrut4.5': { nazev: 'vrut 4,5 mm', d: 4.5, dk: 9 },
    vrut5: { nazev: 'vrut 5 mm', d: 5, dk: 10 },
    M3: { nazev: 'šroub M3', d: 3, dk: 6.7 },
    M4: { nazev: 'šroub M4', d: 4, dk: 9 },
    M5: { nazev: 'šroub M5', d: 5, dk: 11.2 },
  };
  const MATERIALY = {
    PLA: { nazev: 'PLA', hustota: 1.24 },
    PETG: { nazev: 'PETG', hustota: 1.27 },
    ABS: { nazev: 'ABS', hustota: 1.04 },
    ASA: { nazev: 'ASA', hustota: 1.07 },
  };
  /** Nabíječky do lůžka (typické rozměry 11/2026 – před tiskem změřte svůj kus). kabel = průchod pro konektor. */
  const NABIJECKY = {
    hodinky: { nazev: 'hodinky – puk Ø 27,7 × 6', prumer: 27.7, hloubka: 6, kabel: 9 },
    magsafe: { nazev: 'MagSafe Ø 56 × 5,5', prumer: 56, hloubka: 5.5, kabel: 9 },
    qi: { nazev: 'bezdrátová podložka Ø 70 × 8', prumer: 70, hloubka: 8, kabel: 12 },
    vlastni: { nazev: 'vlastní rozměr' },
  };
  const NAZVY = {
    poloha: { stoji: 'nastojato', bok: 'na boku' },
    podstava: { zadna: 'bez podstavy', obdelnik: 'obdélník', kruh: 'kruh', obal: 'obal modulů' },
    odlehceni: { zadne: 'žádné', okna: 'okna', prihradove: 'příhradové', kosoctverce: 'kosočtverce', vostina: 'voština', kruhy: 'kruhy' },
  };
  const MAX_MODULU = 12;
  const LIMIT_PODLOZKY = 250;   // běžná tiskárna (mm)

  /* ---------------- schéma modulů ---------------- */
  // pole formuláře: k klíč, n popisek, j jednotka; t 'bool' | 'vycet' | 'text' (jinak číslo), moz [[hodnota, popisek]], title, kdy(m, p)
  const P = (k, n, j, o) => Object.assign({ k, n, j }, o || {});
  const B = (k, n, o) => P(k, n, null, Object.assign({ t: 'bool' }, o));
  const V = (k, n, moz, o) => P(k, n, null, Object.assign({ t: 'vycet', moz }, o));
  const mozNabijecky = Object.entries(NABIJECKY).map(([k, v]) => [k, v.nazev]);
  const mozSrouby = Object.entries(SROUBY).map(([k, v]) => [k, v.nazev]);

  const MODULY = {
    police: {
      nazev: 'Polička s opěrou', ikona: '🎮', profil: true,
      popis: 'Drážka s lemem a skloněnou opěrou – ovladač, telefon, tablet, kniha. Stupně za sebou pro víc kusů.',
      vychozi: { sirka: 70, hloubka: 34, tloustka: 5, lem: 12, opera: 75, uhel: 12, stupne: 1, prevyseni: 40, vzpera: true, kabel: false, kabelSirka: 14, zaobleni: 2,
        nabijecka: 'zadna', nabPrumer: 56, nabHloubka: 5.5, nabKabel: 9, nabVyska: 50 },
      meze: { sirka: [20, 250], hloubka: [5, 120], tloustka: [2, 20], lem: [0, 80], opera: [10, 250], uhel: [0, 40], stupne: [1, 5, 1], prevyseni: [10, 150],
        kabelSirka: [4, 60], zaobleni: [0, 20], nabPrumer: [10, 120], nabHloubka: [1, 20], nabKabel: [3, 30], nabVyska: [10, 250] },
      vycty: { nabijecka: ['zadna', ...Object.keys(NABIJECKY)] },
      oddily: [
        ['Polička', [P('sirka', 'Šířka', 'mm'), P('hloubka', 'Drážka', 'mm', { title: 'Vnitřní šířka drážky mezi lemem a opěrou = tloušťka předmětu (s obalem) + vůle' }),
          P('tloustka', 'Tloušťka stěn', 'mm'), P('lem', 'Výška lemu', 'mm', { title: 'Přední okraj, který drží předmět před sklouznutím' }),
          P('opera', 'Výška opěry', 'mm'), P('uhel', 'Sklon dozadu', '°', { title: 'Od svislice' }), P('zaobleni', 'Zaoblení', 'mm'),
          B('vzpera', 'Vzpěra za opěrou')]],
        ['Stupně za sebou', [P('stupne', 'Počet stupňů', 'ks'), P('prevyseni', 'Převýšení stupně', 'mm', { kdy: m => m.stupne > 1 })]],
        ['Kabel a nabíječka', [B('kabel', 'Výřez na kabel v lemu'), P('kabelSirka', 'Šířka výřezu', 'mm', { kdy: m => m.kabel }),
          V('nabijecka', 'Lůžko nabíječky v opěře', [['zadna', 'žádné'], ...mozNabijecky]),
          P('nabPrumer', 'Průměr lůžka', 'mm', { kdy: m => m.nabijecka === 'vlastni' }), P('nabHloubka', 'Hloubka lůžka', 'mm', { kdy: m => m.nabijecka === 'vlastni' }),
          P('nabKabel', 'Průchod kabelu', 'mm', { kdy: m => m.nabijecka === 'vlastni' }),
          P('nabVyska', 'Střed lůžka nad dnem', 'mm', { kdy: m => m.nabijecka !== 'zadna', title: 'Měřeno podél opěry od dna drážky' })]],
      ],
    },
    sloty: {
      nazev: 'Svislé přihrádky', ikona: '💻', profil: true,
      popis: 'Hřeben svislých přihrádek – notebooky, tablety, konzole, knihy, krabičky her.',
      vychozi: { pocet: 2, sirkaSlotu: 22, sirky: '', vyska: 50, delka: 80, stena: 6, dno: 5, uhel: 0, zaobleni: 2 },
      meze: { pocet: [1, 12, 1], sirkaSlotu: [2, 150], vyska: [8, 250], delka: [10, 250], stena: [2, 30], dno: [1.5, 30], uhel: [0, 30], zaobleni: [0, 15] },
      vycty: {},
      oddily: [
        ['Přihrádky', [P('pocet', 'Počet přihrádek', 'ks'), P('sirkaSlotu', 'Šířka přihrádky', 'mm', { title: 'Tloušťka zařízení + 1–2 mm (notebook 15–25 mm)' }),
          P('sirky', 'Různé šířky', null, { t: 'text', title: 'Volitelně šířky jednotlivých přihrádek oddělené středníkem, např. 22; 18; 30 – přepíše počet a šířku' }),
          P('vyska', 'Výška přepážek', 'mm'), P('delka', 'Délka (hloubka)', 'mm'), P('stena', 'Tloušťka přepážek', 'mm'), P('dno', 'Tloušťka dna', 'mm'),
          P('uhel', 'Sklon přepážek', '°', { title: 'Od svislice – zařízení se mírně opře' }), P('zaobleni', 'Zaoblení', 'mm')]],
      ],
    },
    sedlo: {
      nazev: 'Sloup se sedlem', ikona: '🎧', profil: true, podstava: true,
      popis: 'Sloup se zakřiveným sedlem – sluchátka přes uši, VR brýle (široké sedlo pod popruh).',
      vychozi: { vyska: 230, sloupSirka: 26, hloubka: 42, sedloSirka: 100, sedloTloustka: 14, sedloPolomer: 90, vzpery: true, zaobleni: 3,
        hacek: false, hacekVyska: 100, hacekDelka: 18, deleni: 'celek', vule: 0.3 },
      meze: { vyska: [60, 400], sloupSirka: [8, 80], hloubka: [10, 120], sedloSirka: [20, 220], sedloTloustka: [4, 40], sedloPolomer: [15, 1000], zaobleni: [0, 20],
        hacekVyska: [10, 380], hacekDelka: [6, 60], vule: [0, 1.5] },
      vycty: { deleni: ['celek', 'cep'] },
      oddily: [
        ['Sloup a sedlo', [P('vyska', 'Výška nad podstavou', 'mm', { title: 'Od horní plochy podstavy po vrchol sedla' }), P('sloupSirka', 'Šířka sloupu', 'mm'),
          P('hloubka', 'Hloubka sloupu a sedla', 'mm', { title: 'Šířka plochy, na které leží hlavový most' }), P('sedloSirka', 'Šířka sedla', 'mm'),
          P('sedloTloustka', 'Tloušťka sedla', 'mm'), P('sedloPolomer', 'Poloměr oblouku', 'mm', { title: 'Zakřivení sedla jako temeno hlavy; větší = plošší' }),
          P('zaobleni', 'Zaoblení', 'mm'), B('vzpery', 'Vzpěry 45° pod sedlem')]],
        ['Háček na kabel', [B('hacek', 'Háček na boku sloupu'), P('hacekVyska', 'Výška háčku', 'mm', { kdy: m => m.hacek }), P('hacekDelka', 'Délka háčku', 'mm', { kdy: m => m.hacek })]],
        ['Dělení', [V('deleni', 'Sloup', [['celek', 'z jednoho kusu s podstavou'], ['cep', 'zvlášť, zasunutý do objímky']]),
          P('vule', 'Vůle objímky', 'mm', { kdy: m => m.deleni === 'cep' })]],
      ],
    },
    hak: {
      nazev: 'Háček', ikona: '🪝', profil: true,
      popis: 'Háček na sluchátka – na sloupku podstavy, pod desku stolu, na zeď nebo nasunutý na hranu stolu.',
      vychozi: { montaz: 'sloup', sirka: 30, tloustka: 6, vyska: 45, rameno: 50, lem: 12, deska: 55, zaobleni: 6, sroub: 'vrut4', otvoru: 2, vule: 0.4,
        sloupVyska: 150, deskaStolu: 25, celist: 45, predpeti: 0.4 },
      meze: { sirka: [10, 120], tloustka: [3, 20], vyska: [10, 150], rameno: [15, 150], lem: [0, 60], deska: [15, 200], zaobleni: [0, 30], otvoru: [1, 3, 1],
        vule: [0, 1.5], sloupVyska: [30, 400], deskaStolu: [8, 80], celist: [15, 150], predpeti: [0, 2] },
      vycty: { montaz: ['sloup', 'stul', 'zed', 'hrana'], sroub: Object.keys(SROUBY) },
      oddily: [
        ['Háček', [V('montaz', 'Montáž', [['sloup', 'na sloupku podstavy'], ['stul', 'pod desku stolu (vruty)'], ['zed', 'na zeď / bok skříně'], ['hrana', 'nasunutý na hranu stolu']]),
          P('sirka', 'Šířka háčku', 'mm'), P('tloustka', 'Tloušťka', 'mm'),
          P('sloupVyska', 'Výška sloupku', 'mm', { kdy: m => m.montaz === 'sloup', title: 'Horní plocha ramene nad podstavou' }),
          P('vyska', 'Mezera nad ramenem', 'mm', { kdy: m => m.montaz === 'stul' || m.montaz === 'hrana', title: 'Volné místo mezi ramenem a deskou stolu' }),
          P('rameno', 'Délka ramene', 'mm', { title: 'Místo pro hlavový most mezi stěnou a lemem' }), P('lem', 'Výška lemu', 'mm'),
          P('zaobleni', 'Zaoblení koutů', 'mm')]],
        ['Upevnění', [P('deska', 'Délka desky', 'mm', { kdy: m => m.montaz === 'stul' || m.montaz === 'zed', title: 'Pod stůl: deska za háčkem; na zeď: deska nad ramenem' }),
          V('sroub', 'Vrut / šroub', mozSrouby, { kdy: m => m.montaz === 'stul' || m.montaz === 'zed' }),
          P('otvoru', 'Počet otvorů', 'ks', { kdy: m => m.montaz === 'stul' || m.montaz === 'zed' }),
          P('vule', 'Vůle otvoru', 'mm', { kdy: m => m.montaz === 'stul' || m.montaz === 'zed' }),
          P('deskaStolu', 'Tloušťka desky stolu', 'mm', { kdy: m => m.montaz === 'hrana' }),
          P('celist', 'Délka čelistí', 'mm', { kdy: m => m.montaz === 'hrana' }),
          P('predpeti', 'Předpětí čelisti', 'mm', { kdy: m => m.montaz === 'hrana', title: 'O kolik se horní čelist na konci sklání k desce – drží bez šroubů' })]],
      ],
    },
    jazyk: {
      nazev: 'Jazyk na zavěšení', ikona: '🕹️', profil: true, podstava: true,
      popis: 'Sloupek s jazykem skloněným nahoru – ovladač se zavěsí zády mezi rukojeti, jen málo zabere na stole.',
      vychozi: { vyska: 100, sirka: 30, tloustka: 8, delka: 45, uhel: 20, konec: 6, vzpera: true, zaobleni: 3 },
      meze: { vyska: [20, 300], sirka: [10, 120], tloustka: [3, 30], delka: [10, 150], uhel: [0, 60], konec: [0, 25], zaobleni: [0, 15] },
      vycty: {},
      oddily: [
        ['Jazyk', [P('vyska', 'Výška jazyka', 'mm', { title: 'Kořen jazyka nad podstavou' }), P('sirka', 'Šířka', 'mm'), P('tloustka', 'Tloušťka', 'mm'),
          P('delka', 'Délka jazyka', 'mm'), P('uhel', 'Sklon nahoru', '°'), P('konec', 'Zarážka na konci', 'mm', { title: 'Poloměr zesíleného konce, který brání sklouznutí' }),
          P('zaobleni', 'Zaoblení', 'mm'), B('vzpera', 'Vzpěra 45° pod jazykem')]],
      ],
    },
    koliky: {
      nazev: 'Kolíky', ikona: '🥢', podstava: true,
      popis: 'Kolíky s kulatou hlavou – VR ovladače s prstencem, náramky, cívky, role pásky.',
      vychozi: { pocet: 2, prumer: 20, vyska: 70, roztec: 60, naklon: 10, hlava: true },
      meze: { pocet: [1, 8, 1], prumer: [4, 80], vyska: [8, 250], roztec: [6, 250], naklon: [0, 40] },
      vycty: {},
      oddily: [['Kolíky', [P('pocet', 'Počet', 'ks'), P('prumer', 'Průměr', 'mm'), P('vyska', 'Výška', 'mm'), P('roztec', 'Rozteč', 'mm', { kdy: m => m.pocet > 1 }),
        P('naklon', 'Náklon dozadu', '°'), B('hlava', 'Kulatá hlava')]]],
    },
    puk: {
      nazev: 'Lůžko nabíječky', ikona: '⌚', profil: true,
      popis: 'Skloněná deska s kapkovitým lůžkem pro magnetickou nabíječku a průchodem kabelu – hodinky, MagSafe, bezdrátová nabíječka.',
      vychozi: { nabijecka: 'hodinky', prumer: 27.7, hloubka: 6, kabel: 9, vule: 0.3, sirka: 44, deska: 52, tloustka: 10, uhel: 20, vyskaStredu: 55, patka: 10, zaobleni: 3 },
      meze: { prumer: [10, 120], hloubka: [1, 20], kabel: [3, 30], vule: [0, 1.5], sirka: [15, 200], deska: [15, 220], tloustka: [4, 40], uhel: [0, 70],
        vyskaStredu: [10, 250], patka: [0, 80], zaobleni: [0, 15] },
      vycty: { nabijecka: Object.keys(NABIJECKY) },
      oddily: [
        ['Nabíječka', [V('nabijecka', 'Nabíječka', mozNabijecky), P('prumer', 'Průměr lůžka', 'mm', { kdy: m => m.nabijecka === 'vlastni' }),
          P('hloubka', 'Hloubka lůžka', 'mm', { kdy: m => m.nabijecka === 'vlastni' }), P('kabel', 'Průchod kabelu', 'mm', { kdy: m => m.nabijecka === 'vlastni' }),
          P('vule', 'Vůle lůžka', 'mm', { title: 'Přidá se k průměru' })]],
        ['Deska', [P('sirka', 'Šířka desky', 'mm'), P('deska', 'Výška desky', 'mm'), P('tloustka', 'Tloušťka desky', 'mm'), P('uhel', 'Sklon dozadu', '°', { title: 'Od svislice; hodinky 15–45°, telefon 15–25°' }),
          P('vyskaStredu', 'Střed lůžka nad podstavou', 'mm'), P('patka', 'Patka vpředu', 'mm', { title: 'Prodloužení paty dopředu pro stabilitu' }), P('zaobleni', 'Zaoblení', 'mm')]],
      ],
    },
    kapsa: {
      nazev: 'Jamky a přihrádky', ikona: '🗃️',
      popis: 'Blok s jamkami n × m – pouzdro sluchátek, herní karty, SD karty, pera, dálkové ovladače, baterie.',
      vychozi: { tvar: 'obdelnik', a: 62, b: 24, hloubka: 16, vyska: 0, nx: 1, ny: 1, stena: 3, dno: 2, rohyKapsy: 6, zaobleni: 3, prsty: false, otvor: 0 },
      meze: { a: [2, 200], b: [1, 200], hloubka: [2, 150], vyska: [0, 200], nx: [1, 12, 1], ny: [1, 20, 1], stena: [1.2, 20], dno: [0.8, 20], rohyKapsy: [0, 50],
        zaobleni: [0, 20], otvor: [0, 40] },
      vycty: { tvar: ['obdelnik', 'kruh'] },
      oddily: [
        ['Jamky', [V('tvar', 'Tvar jamky', [['obdelnik', 'obdélník'], ['kruh', 'kruh']]), P('a', 'Šířka / průměr jamky', 'mm'),
          P('b', 'Hloubka (předozadní)', 'mm', { kdy: m => m.tvar === 'obdelnik', title: 'Rozměr jamky zepředu dozadu' }),
          P('hloubka', 'Hloubka jamky', 'mm'), P('rohyKapsy', 'Zaoblení rohů jamky', 'mm', { kdy: m => m.tvar === 'obdelnik' }),
          P('nx', 'Jamek vedle sebe', 'ks'), P('ny', 'Řad za sebou', 'ks')]],
        ['Blok', [P('stena', 'Stěna mezi jamkami', 'mm'), P('dno', 'Dno', 'mm'), P('vyska', 'Výška bloku', 'mm', { title: '0 = dno + hloubka jamky' }),
          P('zaobleni', 'Zaoblení rohů bloku', 'mm'), B('prsty', 'Výřez na prsty vpředu'),
          P('otvor', 'Otvor na kabel ve dně', 'mm', { title: 'Průměr otvoru uprostřed jamky (projde i podstavou); 0 = bez otvoru' })]],
      ],
    },
    kombi: {
      nazev: 'Kombinovaný držák', ikona: '🎮', profil: true,
      popis: 'Jeden profil pro víc zařízení: skloněná páteř s patkou, vpředu poličky na ovladače (nebo telefon), nahoře rameno na sluchátka. Tiskne se na boku bez podpor.',
      vychozi: { vyska: 230, sirka: 60, tloustka: 8, naklon: 8, patkaVzadu: 110, patkaVpredu: 20, tloustkaPatky: 8, vzpera: 70,
        pocet: 2, prvniVyska: 35, rozestup: 100, hloubka: 34, hloubky: '', policeTloustka: 6, lem: 12,
        hak: true, hakDelka: 50, hakLem: 10, hakOblouk: 35, zaobleni: 3 },
      meze: { vyska: [60, 400], sirka: [15, 200], tloustka: [3, 30], naklon: [0, 30], patkaVzadu: [0, 300], patkaVpredu: [0, 200], tloustkaPatky: [3, 30], vzpera: [0, 250],
        pocet: [0, 6, 1], prvniVyska: [5, 350], rozestup: [20, 300], hloubka: [5, 120], policeTloustka: [3, 25], lem: [0, 60],
        hakDelka: [15, 150], hakLem: [0, 60], hakOblouk: [0, 150], zaobleni: [0, 15] },
      vycty: {},
      oddily: [
        ['Páteř a patka', [P('vyska', 'Výška', 'mm', { title: 'Od stolu po horní plochu ramene / páteře' }), P('sirka', 'Šířka', 'mm', { title: 'Šířka profilu – na ní leží hlavový most sluchátek' }),
          P('tloustka', 'Tloušťka páteře', 'mm'), P('naklon', 'Sklon dozadu', '°', { title: 'Od svislice – předměty na poličkách se opřou o páteř' }),
          P('patkaVzadu', 'Patka dozadu', 'mm'), P('patkaVpredu', 'Patka dopředu', 'mm'), P('tloustkaPatky', 'Tloušťka patky', 'mm'),
          P('vzpera', 'Vzpěra páteř–patka', 'mm', { title: 'Výška trojúhelníkové vzpěry za páteří; 0 = bez vzpěry' }), P('zaobleni', 'Zaoblení', 'mm')]],
        ['Poličky vpředu', [P('pocet', 'Počet poliček', 'ks', { title: 'Ovladače, telefon, kapesní konzole…' }),
          P('prvniVyska', 'Spodní polička nad stolem', 'mm', { kdy: m => m.pocet > 0 }), P('rozestup', 'Rozestup poliček', 'mm', { kdy: m => m.pocet > 1, title: 'Svisle; ovladač je vysoký kolem 100 mm' }),
          P('hloubka', 'Hloubka poličky', 'mm', { kdy: m => m.pocet > 0, title: 'Místo pro předmět mezi páteří a lemem: ovladač 30–40 mm, telefon 12–15 mm' }),
          P('hloubky', 'Různé hloubky', null, { t: 'text', kdy: m => m.pocet > 0, title: 'Volitelně hloubky jednotlivých poliček zdola nahoru oddělené středníkem, např. 34; 34; 14 – přepíše počet' }),
          P('policeTloustka', 'Tloušťka poličky', 'mm', { kdy: m => m.pocet > 0 }), P('lem', 'Výška lemu', 'mm', { kdy: m => m.pocet > 0 })]],
        ['Rameno na sluchátka', [B('hak', 'Rameno nahoře'), P('hakDelka', 'Délka ramene', 'mm', { kdy: m => m.hak, title: 'Místo pro hlavový most (30–45 mm) + rezerva' }),
          P('hakLem', 'Lem na konci', 'mm', { kdy: m => m.hak }), P('hakOblouk', 'Oblouk pod ramenem', 'mm', { kdy: m => m.hak, title: 'Poloměr zaoblení mezi páteří a ramenem' })]],
      ],
    },
    kabely: {
      nazev: 'Vodítko kabelů', ikona: '🔌', profil: true,
      popis: 'Blok s klíčovými dírkami – kabely nabíječek drží na místě a nepadají za stůl.',
      vychozi: { pocet: 4, prumer: 6, hrdlo: 4.5, vyska: 22, delka: 20, stena: 4, zaobleni: 2 },
      meze: { pocet: [1, 12, 1], prumer: [2, 20], hrdlo: [1, 20], vyska: [6, 80], delka: [5, 120], stena: [1.5, 15], zaobleni: [0, 10] },
      vycty: {},
      oddily: [['Vodítko', [P('pocet', 'Počet kabelů', 'ks'), P('prumer', 'Průměr kabelu', 'mm'), P('hrdlo', 'Šířka hrdla', 'mm', { title: 'Užší než kabel – kabel se do dírky zacvakne' }),
        P('vyska', 'Výška', 'mm'), P('delka', 'Délka', 'mm'), P('stena', 'Stěna', 'mm'), P('zaobleni', 'Zaoblení', 'mm')]]],
    },
  };
  const SPOLECNE = { typ: 'police', x: 0, y: 0, otoceni: 0, odlehcit: true };
  const MEZE_SPOLECNE = { x: [-600, 600], y: [-600, 600], otoceni: [-360, 360] };
  const ODDIL_UMISTENI = ['Umístění', [P('x', 'Poloha X', 'mm', { kdy: (m, p) => p.podstava.tvar !== 'zadna' }), P('y', 'Poloha Y', 'mm', { kdy: (m, p) => p.podstava.tvar !== 'zadna' }),
    P('otoceni', 'Otočení', '°'), B('odlehcit', 'Odlehčit vzorem', { kdy: (m, p) => p.odlehceni.druh !== 'zadne' && MODULY[m.typ].profil })]];

  /** Modul stojí samostatně (není na podstavě) – háček pod stůl / na zeď / na hranu. */
  const samostatny = m => m.typ === 'hak' && m.montaz !== 'sloup';
  /** Potřebuje podstavu, aby stál. */
  const potrebujePodstavu = m => !!MODULY[m.typ].podstava || (m.typ === 'hak' && m.montaz === 'sloup');
  /** Tiskne se modul nastojato? (na podstavě vždy; sloup zvlášť a samostatné profily na boku, jinak podle volby tisku). */
  function tiskNastojato(m, p, naPodstave) {
    if (p.tisk.poloha !== 'auto') return p.tisk.poloha === 'stoji';
    if (m.typ === 'sedlo' && m.deleni === 'cep') return false;
    if (naPodstave) return true;
    return ['sedlo', 'jazyk', 'koliky', 'puk', 'kapsa'].includes(m.typ) || (m.typ === 'police' && m.nabijecka !== 'zadna') || (m.typ === 'hak' && m.montaz === 'sloup');
  }

  /* ---------------- projekt ---------------- */
  const PODSTAVA = {
    tvar: 'obal', auto: true, sirka: 160, hloubka: 110, prumer: 140, okraj: 10, rohy: 14, tloustka: 8, sraz: 1.5,
    nozicky: 0, nozickyPrumer: 10, nozickyHloubka: 1.2, zavazi: 0, zavaziPrumer: 27.5, zavaziHloubka: 4,
    otvory: 0, sroub: 'vrut4', odlehceni: 'zadne', vzor: 'vostina', bunka: 12, zebro: 3,
  };
  const VYCHOZI = {
    verze: 2, nazev: 'Stojan',
    podstava: PODSTAVA,
    moduly: [],
    odlehceni: { druh: 'okna', bunka: 16, zebro: 4, stena: 5 },
    tisk: { poloha: 'auto', uhel: 45, material: 'PLA', kusu: 1 },
  };
  const MEZE = {
    'podstava.sirka': [30, 400], 'podstava.hloubka': [30, 400], 'podstava.prumer': [30, 400], 'podstava.okraj': [0, 80], 'podstava.rohy': [0, 200],
    'podstava.tloustka': [2, 40], 'podstava.sraz': [0, 10], 'podstava.nozickyPrumer': [4, 30], 'podstava.nozickyHloubka': [0.4, 5],
    'podstava.zavazi': [0, 12, 1], 'podstava.zavaziPrumer': [5, 60], 'podstava.zavaziHloubka': [0.5, 30], 'podstava.bunka': [4, 60], 'podstava.zebro': [1, 20],
    'odlehceni.bunka': [5, 80], 'odlehceni.zebro': [1, 20], 'odlehceni.stena': [1.5, 20],
    'tisk.uhel': [20, 75], 'tisk.kusu': [1, 20, 1],
  };
  const VYCTY = {
    'podstava.tvar': Object.keys(NAZVY.podstava), 'podstava.nozicky': [0, 3, 4, 6], 'podstava.otvory': [0, 2, 4], 'podstava.sroub': Object.keys(SROUBY),
    'podstava.odlehceni': ['zadne', 'skrz', 'kapsy'], 'podstava.vzor': ['vostina', 'kosoctverce', 'kruhy'],
    'odlehceni.druh': Object.keys(NAZVY.odlehceni),
    'tisk.poloha': ['auto', 'stoji', 'bok'], 'tisk.material': Object.keys(MATERIALY),
  };
  const PODSTAVA_ODDILY = [
    ['Tvar podstavy', [V('tvar', 'Tvar', Object.entries(NAZVY.podstava)),
      B('auto', 'Velikost podle modulů', { kdy: q => q.tvar === 'obdelnik' || q.tvar === 'kruh' }),
      P('okraj', 'Okraj kolem modulů', 'mm', { kdy: q => q.tvar === 'obal' || (q.auto && q.tvar !== 'zadna') }),
      P('sirka', 'Šířka', 'mm', { kdy: q => q.tvar === 'obdelnik' && !q.auto }), P('hloubka', 'Hloubka', 'mm', { kdy: q => q.tvar === 'obdelnik' && !q.auto }),
      P('prumer', 'Průměr', 'mm', { kdy: q => q.tvar === 'kruh' && !q.auto }), P('rohy', 'Zaoblení rohů', 'mm', { kdy: q => q.tvar === 'obdelnik' }),
      P('tloustka', 'Tloušťka', 'mm', { kdy: q => q.tvar !== 'zadna' }), P('sraz', 'Sražení horní hrany', 'mm', { kdy: q => q.tvar !== 'zadna' })]],
    ['Nožičky a závaží', [V('nozicky', 'Vybrání na nožičky', [[0, 'žádné'], [3, '3'], [4, '4'], [6, '6']], { kdy: q => q.tvar !== 'zadna' }),
      P('nozickyPrumer', 'Průměr nožičky', 'mm', { kdy: q => q.tvar !== 'zadna' && q.nozicky > 0 }), P('nozickyHloubka', 'Hloubka vybrání', 'mm', { kdy: q => q.tvar !== 'zadna' && q.nozicky > 0 }),
      P('zavazi', 'Kapsy na mince (závaží)', 'ks', { kdy: q => q.tvar !== 'zadna', title: 'Kapsy zespodu na sloupek mincí nebo ocelové podložky – stojan se nepřevrhne' }),
      P('zavaziPrumer', 'Průměr mince', 'mm', { kdy: q => q.tvar !== 'zadna' && q.zavazi > 0, title: '50 Kč 27,5 mm · 20 Kč 26 mm · 10 Kč 24,5 mm · 1 € 23,25 mm' }),
      P('zavaziHloubka', 'Výška sloupku mincí', 'mm', { kdy: q => q.tvar !== 'zadna' && q.zavazi > 0 })]],
    ['Přišroubování', [V('otvory', 'Otvory na přišroubování', [[0, 'žádné'], [2, '2'], [4, '4']], { kdy: q => q.tvar !== 'zadna' }),
      V('sroub', 'Vrut / šroub', mozSrouby, { kdy: q => q.tvar !== 'zadna' && q.otvory > 0 })]],
    ['Odlehčení podstavy', [V('odlehceni', 'Odlehčení', [['zadne', 'žádné (těžší, stabilnější)'], ['skrz', 'průchozí vzor'], ['kapsy', 'kapsy zespodu (vrch hladký)']], { kdy: q => q.tvar !== 'zadna' }),
      V('vzor', 'Vzor', [['vostina', 'voština'], ['kosoctverce', 'kosočtverce'], ['kruhy', 'kruhy']], { kdy: q => q.tvar !== 'zadna' && q.odlehceni !== 'zadne' }),
      P('bunka', 'Velikost buňky', 'mm', { kdy: q => q.tvar !== 'zadna' && q.odlehceni !== 'zadne' }),
      P('zebro', 'Žebro', 'mm', { kdy: q => q.tvar !== 'zadna' && q.odlehceni !== 'zadne' })]],
  ];
  const ODLEHCENI_ODDILY = [
    ['Odlehčení modulů', [V('druh', 'Vzor', Object.entries(NAZVY.odlehceni), { title: 'Otvory v plných částech profilů (výplň pod stupni, sloup, vzpěry, klín lůžka)' }),
      P('bunka', 'Velikost buňky', 'mm', { kdy: o => o.druh !== 'zadne', title: 'U oken polovina rozestupu sloupků (příčky po 3 buňkách)' }), P('zebro', 'Žebro', 'mm', { kdy: o => o.druh !== 'zadne' }),
      P('stena', 'Plný okraj', 'mm', { kdy: o => o.druh !== 'zadne', title: 'Šířka plného materiálu podél obrysu' })]],
  ];

  /* ---------------- zařízení (paleta „přidat“) a předvolby ---------------- */
  /** Šablona modulu pro konkrétní zařízení. */
  const ZARIZENI = [
    { id: 'kombi', nazev: '2 ovladače + sluchátka', ikona: '🎮', modul: { typ: 'kombi' } },
    { id: 'kombi_tel', nazev: 'Ovladač + telefon + sluchátka', ikona: '📱', modul: { typ: 'kombi', hloubky: '34; 14', rozestup: 100 } },
    { id: 'kombi_3', nazev: '3 ovladače na páteři', ikona: '🕹️', modul: { typ: 'kombi', pocet: 3, hak: false, vyska: 235, prvniVyska: 30, rozestup: 78, patkaVzadu: 110 } },
    { id: 'ovladac', nazev: 'Herní ovladač', ikona: '🎮', modul: { typ: 'police' } },
    { id: 'ovladac_jazyk', nazev: 'Ovladač – zavěšený', ikona: '🕹️', modul: { typ: 'jazyk' } },
    { id: 'sluchatka', nazev: 'Sluchátka přes uši', ikona: '🎧', modul: { typ: 'sedlo' } },
    { id: 'vr', nazev: 'VR brýle', ikona: '🥽', modul: { typ: 'sedlo', vyska: 170, sloupSirka: 30, hloubka: 70, sedloSirka: 130, sedloTloustka: 16, sedloPolomer: 75 } },
    { id: 'vr_ovladace', nazev: 'VR ovladače – kolíky', ikona: '🥢', modul: { typ: 'koliky', pocet: 2, prumer: 22, vyska: 75, roztec: 65 } },
    { id: 'telefon', nazev: 'Telefon', ikona: '📱', modul: { typ: 'police', sirka: 75, hloubka: 13, tloustka: 4.5, lem: 9, opera: 95, uhel: 20, kabel: true, kabelSirka: 14 } },
    { id: 'telefon_magsafe', nazev: 'Telefon s MagSafe', ikona: '🧲', modul: { typ: 'police', sirka: 75, hloubka: 13, tloustka: 4.5, lem: 9, opera: 110, uhel: 18, nabijecka: 'magsafe', nabVyska: 62 } },
    { id: 'tablet', nazev: 'Tablet', ikona: '📲', modul: { typ: 'police', sirka: 130, hloubka: 14, tloustka: 6, lem: 12, opera: 120, uhel: 22, kabel: true, kabelSirka: 18, zaobleni: 2.5 } },
    { id: 'kniha', nazev: 'Kniha / čtečka', ikona: '📖', modul: { typ: 'police', sirka: 110, hloubka: 28, tloustka: 5, lem: 14, opera: 100, uhel: 25 } },
    { id: 'handheld', nazev: 'Kapesní konzole', ikona: '👾', modul: { typ: 'police', sirka: 90, hloubka: 24, tloustka: 5, lem: 10, opera: 60, uhel: 18, kabel: true, kabelSirka: 16 } },
    { id: 'notebook', nazev: 'Notebook svisle', ikona: '💻', modul: { typ: 'sloty', pocet: 1, sirkaSlotu: 22, vyska: 45, delka: 70, stena: 8, dno: 5 } },
    { id: 'zarizeni_sloty', nazev: 'Notebooky a tablety', ikona: '🗂️', modul: { typ: 'sloty', pocet: 3, sirky: '22; 14; 14', vyska: 55, delka: 90, stena: 6, uhel: 5 } },
    { id: 'konzole', nazev: 'Konzole svisle', ikona: '🖥️', modul: { typ: 'sloty', pocet: 1, sirkaSlotu: 66, vyska: 30, delka: 90, stena: 10, dno: 6 } },
    { id: 'hodinky', nazev: 'Hodinky – nabíječka', ikona: '⌚', modul: { typ: 'puk' } },
    { id: 'magsafe_deska', nazev: 'Nabíječka MagSafe', ikona: '🔋', modul: { typ: 'puk', nabijecka: 'magsafe', sirka: 72, deska: 95, tloustka: 9, uhel: 18, vyskaStredu: 75, patka: 15 } },
    { id: 'pouzdro', nazev: 'Pouzdro sluchátek', ikona: '🎵', modul: { typ: 'kapsa', a: 62, b: 24, hloubka: 16, prsty: true, otvor: 12 } },
    { id: 'karty', nazev: 'Herní karty', ikona: '🃏', modul: { typ: 'kapsa', a: 22.5, b: 3.9, hloubka: 18, ny: 8, stena: 2.2, rohyKapsy: 0.5, dno: 2 } },
    { id: 'sd_karty', nazev: 'SD karty', ikona: '💾', modul: { typ: 'kapsa', a: 25, b: 2.8, hloubka: 18, ny: 10, stena: 2, rohyKapsy: 0.4 } },
    { id: 'pera', nazev: 'Pera a stylusy', ikona: '✏️', modul: { typ: 'kapsa', tvar: 'kruh', a: 13, hloubka: 45, vyska: 50, nx: 4, ny: 2, stena: 3 } },
    { id: 'dalkove', nazev: 'Dálkové ovladače', ikona: '📺', modul: { typ: 'kapsa', a: 54, b: 26, hloubka: 50, vyska: 55, nx: 3, stena: 3, rohyKapsy: 8 } },
    { id: 'baterie', nazev: 'Baterie AA', ikona: '🔋', modul: { typ: 'kapsa', tvar: 'kruh', a: 14.8, hloubka: 25, nx: 6, ny: 2, stena: 1.6, dno: 1.6 } },
    { id: 'hak_sloup', nazev: 'Háček na sloupku', ikona: '🪝', modul: { typ: 'hak', montaz: 'sloup' } },
    { id: 'hak_stul', nazev: 'Háček pod stůl', ikona: '🪝', modul: { typ: 'hak', montaz: 'stul' } },
    { id: 'hak_hrana', nazev: 'Háček na hranu stolu', ikona: '🗜️', modul: { typ: 'hak', montaz: 'hrana' } },
    { id: 'hak_zed', nazev: 'Háček na zeď', ikona: '🧱', modul: { typ: 'hak', montaz: 'zed', rameno: 55, deska: 60, sroub: 'vrut4.5' } },
    { id: 'kabely', nazev: 'Vodítko kabelů', ikona: '🔌', modul: { typ: 'kabely' } },
  ];
  const zarizeni = id => ZARIZENI.find(z => z.id === id);
  const BEZ = { tvar: 'zadna' };
  const KRUH = r => ({ tvar: 'kruh', auto: false, prumer: r });
  /** Předvolby: skupina, podstava a seznam zařízení (z = id zařízení + odchylky). Polohy rozmístí rozmisti(). */
  const PREDVOLBY = [
    { id: 'kombi', skupina: 'Jeden držák – víc zařízení', nazev: '2 ovladače + sluchátka', popis: 'jeden profil: dvě poličky vpředu, rameno nahoře, tisk na boku', podstava: BEZ, moduly: [{ z: 'kombi' }] },
    { id: 'kombi_tel', skupina: 'Jeden držák – víc zařízení', nazev: 'Ovladač + telefon + sluchátka', popis: 'polička 34 mm a drážka 14 mm', podstava: BEZ, moduly: [{ z: 'kombi_tel' }] },
    { id: 'kombi_3ovl_sluch', skupina: 'Jeden držák – víc zařízení', nazev: '3 ovladače + sluchátka', popis: 'poličky po 78 mm, ovladače se mírně překrývají', podstava: BEZ, moduly: [{ z: 'kombi', pocet: 3, vyska: 238, prvniVyska: 30, rozestup: 78, hakLem: 8 }] },
    { id: 'kombi_3', skupina: 'Jeden držák – víc zařízení', nazev: '3 ovladače bez sluchátek', popis: 'páteř s třemi poličkami', podstava: BEZ, moduly: [{ z: 'kombi_3' }] },
    { id: 'kombi_tel_2', skupina: 'Jeden držák – víc zařízení', nazev: '2 ovladače + telefon + sluchátka', popis: 'tři poličky různé hloubky', podstava: BEZ, moduly: [{ z: 'kombi', hloubky: '34; 34; 14', vyska: 238, prvniVyska: 30, rozestup: 78, hakLem: 8 }] },
    { id: 'ovladac', skupina: 'Jedno zařízení', nazev: 'Ovladač – polička', popis: 'tiskne se na boku bez podpor', podstava: BEZ, moduly: [{ z: 'ovladac' }] },
    { id: 'ovladac2', skupina: 'Jedno zařízení', nazev: 'Dva ovladače za sebou', popis: '2 stupně, zadní o 45 mm výš', podstava: BEZ, moduly: [{ z: 'ovladac', stupne: 2, prevyseni: 45, opera: 70 }] },
    { id: 'ovladac3', skupina: 'Jedno zařízení', nazev: 'Tři ovladače – schody', popis: '3 stupně po 40 mm, šířka 60 mm', podstava: BEZ, moduly: [{ z: 'ovladac', sirka: 60, stupne: 3, prevyseni: 40, opera: 65 }] },
    { id: 'ovladac_jazyk', skupina: 'Jedno zařízení', nazev: 'Ovladač zavěšený na jazyku', popis: 'malá podstava, ovladač visí zády', podstava: { tvar: 'obdelnik', auto: true, okraj: 22, nozicky: 4 }, moduly: [{ z: 'ovladac_jazyk' }] },
    { id: 'sluchatka', skupina: 'Jedno zařízení', nazev: 'Sluchátka – kulatá podstava', popis: 'výška 240 mm, sedlo 100 mm', podstava: Object.assign(KRUH(130), { tloustka: 10 }), moduly: [{ z: 'sluchatka' }] },
    { id: 'sluchatka_obd', skupina: 'Jedno zařízení', nazev: 'Sluchátka – hranatá s nožičkami a závažím', popis: '4 nožičky, 4 kapsy na mince', podstava: { tvar: 'obdelnik', auto: false, sirka: 150, hloubka: 110, tloustka: 10, nozicky: 4, zavazi: 4 }, moduly: [{ z: 'sluchatka' }] },
    { id: 'sluchatka_cep', skupina: 'Jedno zařízení', nazev: 'Sluchátka – dělená', popis: 'sloup na boku, zasune se do podstavy', podstava: Object.assign(KRUH(130), { tloustka: 10 }), moduly: [{ z: 'sluchatka', deleni: 'cep', vyska: 235 }] },
    { id: 'hak_stul', skupina: 'Jedno zařízení', nazev: 'Háček pod desku stolu', popis: '2 vruty 4 mm', podstava: BEZ, moduly: [{ z: 'hak_stul' }] },
    { id: 'hak_hrana', skupina: 'Jedno zařízení', nazev: 'Háček na hranu stolu (bez šroubů)', popis: 'svěrka na desku 25 mm', podstava: BEZ, moduly: [{ z: 'hak_hrana' }] },
    { id: 'hak_zed', skupina: 'Jedno zařízení', nazev: 'Háček na zeď', popis: '2 vruty 4,5 mm do hmoždinek', podstava: BEZ, moduly: [{ z: 'hak_zed' }] },
    { id: 'telefon', skupina: 'Jedno zařízení', nazev: 'Telefon', popis: 'drážka 13 mm, výřez na kabel', podstava: BEZ, moduly: [{ z: 'telefon' }] },
    { id: 'telefon_magsafe', skupina: 'Jedno zařízení', nazev: 'Telefon s nabíječkou MagSafe', popis: 'lůžko v opěře, kabel dozadu', podstava: BEZ, moduly: [{ z: 'telefon_magsafe' }] },
    { id: 'tablet', skupina: 'Jedno zařízení', nazev: 'Tablet', popis: 'šířka 130 mm, drážka 14 mm', podstava: BEZ, moduly: [{ z: 'tablet' }] },
    { id: 'kniha', skupina: 'Jedno zařízení', nazev: 'Kniha / čtečka', popis: 'sklon 25°', podstava: BEZ, moduly: [{ z: 'kniha' }] },
    { id: 'notebook', skupina: 'Jedno zařízení', nazev: 'Notebook svisle (2 kusy)', popis: 'přihrádka 22 mm, tisknou se 2 kusy', podstava: BEZ, moduly: [{ z: 'notebook' }], tisk: { kusu: 2 } },
    { id: 'konzole', skupina: 'Jedno zařízení', nazev: 'Konzole svisle (2 kusy)', popis: 'přihrádka 66 mm', podstava: BEZ, moduly: [{ z: 'konzole' }], tisk: { kusu: 2 } },
    { id: 'hodinky', skupina: 'Jedno zařízení', nazev: 'Hodinky – stojánek s nabíječkou', popis: 'puk Ø 27,7, kabel dozadu', podstava: BEZ, moduly: [{ z: 'hodinky' }] },
    { id: 'pouzdro', skupina: 'Jedno zařízení', nazev: 'Pouzdro sluchátek', popis: 'jamka 62 × 24, otvor na kabel', podstava: BEZ, moduly: [{ z: 'pouzdro' }] },
    { id: 'karty', skupina: 'Jedno zařízení', nazev: 'Herní karty (8 ks)', popis: 'štěrbiny 22,5 × 3,9', podstava: BEZ, moduly: [{ z: 'karty' }] },
    { id: 'kabely', skupina: 'Jedno zařízení', nazev: 'Vodítko kabelů', popis: '4 kabely Ø 6', podstava: BEZ, moduly: [{ z: 'kabely' }] },
    { id: 'herni', skupina: 'Kombinace', nazev: 'Herní stanice', popis: 'sluchátka + ovladač + telefon', podstava: { tvar: 'obal', okraj: 10, nozicky: 4 },
      moduly: [{ z: 'ovladac' }, { z: 'sluchatka' }, { z: 'telefon' }] },
    { id: 'sluch_2ovl', skupina: 'Kombinace', nazev: 'Sluchátka + 2 ovladače', popis: 'ovladače na stupních vedle sloupu', podstava: { tvar: 'obdelnik', auto: true, okraj: 10, nozicky: 4 },
      moduly: [{ z: 'ovladac', stupne: 2, prevyseni: 45, opera: 70 }, { z: 'sluchatka' }] },
    { id: 'vr', skupina: 'Kombinace', nazev: 'VR stanice', popis: 'brýle na sedle + 2 kolíky na ovladače', podstava: { tvar: 'obal', okraj: 12, nozicky: 4, zavazi: 3 },
      moduly: [{ z: 'vr_ovladace', pocet: 1 }, { z: 'vr' }, { z: 'vr_ovladace', pocet: 1 }] },
    { id: 'nabijeci', skupina: 'Kombinace', nazev: 'Nabíjecí stanice', popis: 'telefon MagSafe + hodinky + pouzdro sluchátek', podstava: { tvar: 'obdelnik', auto: true, okraj: 8, nozicky: 4 },
      moduly: [{ z: 'telefon_magsafe' }, { z: 'hodinky' }, { z: 'pouzdro' }] },
    { id: 'tablety', skupina: 'Kombinace', nazev: 'Stanice tabletů a telefonů', popis: '4 přihrádky + vodítko kabelů', podstava: { tvar: 'obdelnik', auto: true, okraj: 6 },
      moduly: [{ z: 'zarizeni_sloty', pocet: 4, sirky: '', sirkaSlotu: 15, vyska: 60, delka: 80 }, { z: 'kabely', delka: 15, pocet: 4, otoceni: 90 }] },
    { id: 'pracovni', skupina: 'Kombinace', nazev: 'Organizér pracovního stolu', popis: 'telefon + pera + SD karty', podstava: { tvar: 'obal', okraj: 6, nozicky: 4 },
      moduly: [{ z: 'telefon' }, { z: 'pera' }, { z: 'sd_karty' }] },
    { id: 'herni_velka', skupina: 'Kombinace', nazev: 'Velká herní stanice', popis: 'sluchátka + 2 ovladače + kapesní konzole', podstava: { tvar: 'obdelnik', auto: true, okraj: 8, nozicky: 4, zavazi: 2, odlehceni: 'kapsy' },
      moduly: [{ z: 'ovladac', stupne: 2, prevyseni: 45, opera: 70 }, { z: 'sluchatka' }, { z: 'handheld' }] },
  ];

  /* ---------------- normalizace ---------------- */
  /** Převod projektu v1 (4 pevné druhy) na sestavu. */
  function zV1(v) {
    const t = v.tisk;
    if (v.typ === 'ovladac' || v.typ === 'telefon') return { nazev: v.nazev, podstava: BEZ, moduly: [Object.assign({}, v.police, { typ: 'police' })], tisk: t };
    if (v.typ === 'hak') return { nazev: v.nazev, podstava: BEZ, moduly: [Object.assign({}, v.hak, { typ: 'hak' })], tisk: t };
    const s = v.sluchatka || {}, tb = s.tloustkaP == null ? 10 : s.tloustkaP;
    return {
      nazev: v.nazev, tisk: t,
      podstava: { tvar: s.podstava === 'obdelnik' ? 'obdelnik' : 'kruh', auto: false, prumer: s.prumer, sirka: s.sirkaP, hloubka: s.hloubkaP, rohy: s.rohy, tloustka: tb,
        nozicky: s.nozicky, nozickyPrumer: s.nozickyPrumer, nozickyHloubka: s.nozickyHloubka },
      moduly: [{ typ: 'sedlo', vyska: (s.vyska == null ? 240 : s.vyska) - tb, sloupSirka: s.sloupSirka, hloubka: s.hloubka, sedloSirka: s.sedloSirka, sedloTloustka: s.sedloTloustka,
        sedloPolomer: s.sedloPolomer, vzpery: s.vzpery, zaobleni: s.zaobleni, deleni: s.deleni, vule: s.vule }],
    };
  }
  function normModul(v, i, hlaseni) {
    const typ = v && MODULY[v.typ] ? v.typ : null;
    if (!typ) { hlaseni.push(`modul ${i + 1}: neznámý druh „${v && v.typ}“ – vynechán`); return null; }
    const D = MODULY[typ];
    const r = G3D.normalizuj(v, { VYCHOZI: Object.assign({}, SPOLECNE, D.vychozi, { typ }), MEZE: Object.assign({}, MEZE_SPOLECNE, D.meze), VYCTY: D.vycty, fmt });
    r.p.typ = typ;
    for (const h of r.hlaseni) hlaseni.push(`modul ${i + 1}: ${h}`);
    return r.p;
  }
  /** Doplní výchozí hodnoty, ořízne meze, opraví neznámé volby; převede projekt v1. → {p, hlaseni} */
  function normalizuj(vstup) {
    let v = vstup && typeof vstup === 'object' ? vstup : {};
    if (typeof v.typ === 'string' && !Array.isArray(v.moduly)) v = zV1(v);
    const r = G3D.normalizuj(v, { VYCHOZI, MEZE, VYCTY, fmt });
    const zdroj = Array.isArray(v.moduly) ? v.moduly : [];
    if (zdroj.length > MAX_MODULU) r.hlaseni.push(`nejvýš ${MAX_MODULU} modulů – další vynechány`);
    r.p.moduly = zdroj.slice(0, MAX_MODULU).map((m, i) => normModul(m, i, r.hlaseni)).filter(Boolean);
    r.p.verze = 2;
    return r;
  }
  /** Nový modul ze zařízení (s odchylkami). */
  function novyModul(id, odchylky) {
    const z = zarizeni(id);
    return normModul(Object.assign({}, z ? z.modul : { typ: 'police' }, odchylky || {}), 0, []);
  }

  /* ---------------- profily a přibližný půdorys (bez geometrie), rozmístění ---------------- */
  const nabijeckaPolice = q => (q.nabijecka === 'vlastni' ? { prumer: q.nabPrumer, hloubka: q.nabHloubka, kabel: q.nabKabel } : NABIJECKY[q.nabijecka] || { prumer: 0, hloubka: 0, kabel: 0 });
  const nabijeckaPuk = q => (q.nabijecka === 'vlastni' ? { prumer: q.prumer, hloubka: q.hloubka, kabel: q.kabel } : NABIJECKY[q.nabijecka]);
  /** Profil poličky v rovině (x, z): polygony + poloha stupňů. Lem vpředu u x ≈ 0, opěra vzadu.
      plnaVzpera: trojúhelník opěra–vzpěra–zem vyplněný (pro tisk nastojato), jinak tenká vzpěra (tisk na boku, méně materiálu). */
  function profilPolice(q, plnaVzpera) {
    const t = q.tloustka, d = q.hloubka, L = q.lem, a = q.uhel * RAD, N = q.stupne;
    const tO = q.nabijecka && q.nabijecka !== 'zadna' ? Math.max(t, nabijeckaPolice(q).hloubka + 2) : t;   // opěra s lůžkem je tlustší
    const ca = Math.cos(a), sa = Math.sin(a);
    const rot = ([u, v]) => [u * ca + v * sa, -u * sa + v * ca];   // naklonění dozadu (dno klesá k opěře)
    const s0 = (d + t + tO) * sa;   // zvednutí: zadní spodní roh prvního stupně leží na zemi
    // další stupeň stojí na horní hraně opěry předchozího (posun podél náklonu) – jeho lem pokračuje v líci opěry
    // a drážka pod ním se nezúží ani při strmém sklonu; svisle stoupá o převýšení
    const hh = (q.prevyseni + (d + t) * sa) / ca;
    const polygony = [], stupne = [];
    let O = [0, s0], predOpera = null;
    for (let i = 0; i < N; i++) {
      const [ox, oz] = O;
      const tr = body => body.map(b => { const r = rot(b); return [r[0] + ox, r[1] + oz]; });
      const posledni = i === N - 1, tOi = posledni ? tO : t, Di = d + t + tOi;
      const hOpery = posledni ? q.opera : hh;   // mezilehlá opěra končí pod dnem dalšího stupně
      const dno = tr([[0, 0], [Di, 0], [Di, t], [0, t]]);
      const opera = tr([[d + t, 0], [Di, 0], [Di, t + hOpery], [d + t, t + hOpery]]);
      polygony.push(dno, opera);
      if (L > 0) polygony.push(tr([[0, 0], [t, 0], [t, t + L], [0, t + L]]));
      // výplň pod dnem: u prvního stupně svisle na zem; u dalších vpředu podél opěry předchozího stupně, vzadu svisle na zem
      if (!predOpera) polygony.push(obalBodu(dno.concat(dno.map(b => [b[0], 0]))));
      else polygony.push(obalBodu(dno.concat(predOpera, [[dno[1][0], 0], [predOpera[1][0], 0]])));
      stupne.push({ ox, oz, dnoPredni: tr([[t, t]])[0], lemHorni: tr([[t, t + L]])[0], bod: (u, v) => tr([[u, v]])[0] });
      if (posledni && q.vzpera && plnaVzpera) {
        // plný trojúhelník za opěrou (opěra – vzpěra – zem): bez zářezu, jehož vrchol by při tisku nastojato převisal;
        // odlehčení ho pak provrtá
        const Pt = tr([[Di, t + 0.62 * q.opera]])[0], G = [Pt[0] + 0.55 * Pt[1], 0], pata = tr([[Di, 0]])[0];
        polygony.push(obalBodu([Pt, G, [pata[0], 0], pata]));
      } else if (posledni && q.vzpera) {
        const Pt = tr([[Di - 0.3 * t, t + 0.62 * q.opera]])[0], G = [Pt[0] + 0.55 * Pt[1], -t];
        const dx = G[0] - Pt[0], dz = G[1] - Pt[1], l = Math.hypot(dx, dz), nx = -dz / l * t / 2, nz = dx / l * t / 2;
        polygony.push(obalBodu([[Pt[0] + nx, Pt[1] + nz], [Pt[0] - nx, Pt[1] - nz], [G[0] - nx, G[1] - nz], [G[0] + nx, G[1] + nz]]));
      }
      O = tr([[d + t, hh]])[0];
      predOpera = opera;
    }
    return { polygony, stupne, t, tO, d, ca, sa };
  }
  /** Konvexní obal 2D bodů (monotónní řetězec), proti směru hodin. */
  function obalBodu(body) {
    const b = body.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const x = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
    const dol = [], hor = [];
    for (const p of b) { while (dol.length >= 2 && x(dol[dol.length - 2], dol[dol.length - 1], p) <= 0) dol.pop(); dol.push(p); }
    for (let i = b.length - 1; i >= 0; i--) { const p = b[i]; while (hor.length >= 2 && x(hor[hor.length - 2], hor[hor.length - 1], p) <= 0) hor.pop(); hor.push(p); }
    return dol.slice(0, -1).concat(hor.slice(0, -1));
  }
  /** Hloubky poliček kombinovaného držáku zdola nahoru (seznam přepíše počet × hloubku). */
  function hloubkyPolic(q) {
    const s = String(q.hloubky || '').split(/[;\s]+/).filter(Boolean).map(x => G3D.ctiCislo(x)).filter(x => Number.isFinite(x) && x >= 5 && x <= 120).slice(0, 6);
    return s.length ? s : Array(q.pocet).fill(q.hloubka);
  }
  /** Šířky přihrádek (seznam „22; 18,5“ přepíše počet × šířku). */
  function sirkySlotu(q) {
    const s = String(q.sirky || '').split(/[;\s]+/).filter(Boolean).map(x => G3D.ctiCislo(x)).filter(x => Number.isFinite(x) && x >= 2 && x <= 150).slice(0, 12);
    return s.length ? s : Array(q.pocet).fill(q.sirkaSlotu);
  }
  /** Přibližný půdorys modulu [šířka X, hloubka Y] v místním rámci (před otočením). */
  function pudorys(m) {
    switch (m.typ) {
      case 'police': { const xs = profilPolice(m).polygony.flat().map(q => q[0]); return [m.sirka, Math.max(...xs) - Math.min(...xs)]; }
      case 'sloty': { const s = sirkySlotu(m); return [s.reduce((a, x) => a + x, 0) + (s.length + 1) * m.stena, m.delka]; }
      case 'sedlo': return [Math.max(m.sedloSirka, m.sloupSirka + (m.hacek ? 2 * m.hacekDelka : 0)), m.hloubka];   // sedlo přesahuje sloup – pod křídly visí mušle
      case 'hak': return m.montaz === 'sloup' ? [m.rameno + 2 * m.tloustka, m.sirka] : [m.sirka, m.rameno + 2 * m.tloustka + (m.montaz === 'zed' ? 0 : m.deska)];
      case 'jazyk': return [m.sirka, m.tloustka + 12];
      case 'koliky': return [(m.pocet - 1) * m.roztec + m.prumer, m.prumer + m.vyska * Math.sin(m.naklon * RAD)];
      case 'puk': return [m.sirka, m.patka + m.tloustka + m.deska * Math.sin(m.uhel * RAD) + 5];
      case 'kapsa': { const b = m.tvar === 'kruh' ? m.a : m.b; return [m.nx * m.a + (m.nx + 1) * m.stena, m.ny * b + (m.ny + 1) * m.stena]; }
      case 'kabely': return [m.pocet * (m.prumer + m.stena) + m.stena, m.delka];
      case 'kombi': return [m.sirka, Math.max(m.patkaVpredu, ...hloubkyPolic(m).map(h => h + m.policeTloustka), 0) + m.patkaVzadu + m.tloustka];
    }
    return [40, 40];
  }
  /** Rozměr půdorysu po otočení (obal otočeného obdélníku). */
  function otocenyPudorys(m, roz) {
    const [w, h] = roz || pudorys(m), a = m.otoceni * RAD, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    return [w * c + h * s, w * s + h * c];
  }
  /** Rozmístí moduly na podstavě: do řady zleva doprava se zadními hranami v jedné čáře; sloupy se sedlem na sluchátka
      jdou do zadní řady (mušle visí po stranách sloupu, ostatní moduly jsou před ním). rozmery[i] = [w, h] po otočení (z modelu), jinak odhad. */
  function rozmisti(p, rozmery, mezera = 8) {
    const naPodstave = p.moduly.map((m, i) => ({ m, i })).filter(({ m }) => !samostatny(m));
    const R = i => (rozmery && rozmery[i]) || otocenyPudorys(p.moduly[i]);
    const rada = (seznam, yZad) => {   // yZad = zadní hrana řady
      const sirka = seznam.reduce((a, { i }) => a + R(i)[0], 0) + mezera * Math.max(0, seznam.length - 1);
      let x = -sirka / 2;
      for (const { m, i } of seznam) { const [w, h] = R(i); m.x = Math.round((x + w / 2) * 10) / 10; m.y = Math.round((yZad - h / 2) * 10) / 10; x += w + mezera; }
      return sirka;
    };
    const zadni = naPodstave.filter(({ m }) => m.typ === 'sedlo' && m.hloubka < 60), predni = naPodstave.filter(x => !zadni.includes(x));
    let sirka;
    if (zadni.length && predni.length) {
      const hZad = Math.max(...zadni.map(({ i }) => R(i)[1]));
      sirka = Math.max(rada(predni, 0), rada(zadni, 2 * mezera + hZad));
    } else sirka = rada(naPodstave, Math.max(0, ...naPodstave.map(({ i }) => R(i)[1])) / 2);
    // samostatné díly (háčky na stůl / zeď / hranu) vedle sestavy vpravo
    const S = p.moduly.map((m, i) => (samostatny(m) ? R(i) : null));
    let xs = naPodstave.length ? sirka / 2 + 25 : -(S.reduce((a, r) => a + (r ? r[0] + 15 : 0), 0) - 15) / 2;
    p.moduly.forEach((m, i) => { if (!S[i]) return; m.x = Math.round(xs + S[i][0] / 2); m.y = 0; xs += S[i][0] + 15; });
    return p;
  }
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id) || PREDVOLBY[0];
    const q = G3D.slij(G3D.kopie(VYCHOZI), { nazev: pv.nazev, podstava: pv.podstava || {}, tisk: pv.tisk || {} });
    q.moduly = pv.moduly.map(x => { const o = Object.assign({}, x); delete o.z; return novyModul(x.z, o); });
    return rozmisti(normalizuj(q).p);
  }

  /* ---------------- kontroly zadání ---------------- */
  /** → [{uroven: 'chyba'|'varovani'|'info', text, pole: [cesta], oprava?: {text, pole, hodnota} | {text, zmeny}}] */
  function kontroly(p) {
    const H = [], pridej = (uroven, pole, text, oprava) => H.push(Object.assign({ uroven, pole: [].concat(pole), text }, oprava ? { oprava } : {}));
    const pod = p.podstava, maPodstavu = pod.tvar !== 'zadna';
    if (!p.moduly.length) pridej('info', [], 'Sestava je prázdná – přidejte modul z palety vlevo nebo zvolte předvolbu.');
    p.moduly.forEach((m, i) => {
      const c = k => `moduly.${i}.${k}`, jm = `${i + 1}. ${MODULY[m.typ].nazev}`;
      if (potrebujePodstavu(m) && !maPodstavu) pridej('chyba', 'podstava.tvar', `${jm}: potřebuje podstavu, jinak nestojí.`, { text: 'podstava podle modulů', zmeny: { 'podstava.tvar': 'obal' } });
      if (samostatny(m) && maPodstavu) pridej('info', c('montaz'), `${jm}: montáž mimo podstavu – tiskne se jako samostatný díl.`);
      kontrolyModulu(m, i, p, (uroven, k, text, oprava) => {
        let op = oprava;
        if (op && op.pole) op = Object.assign({}, op, { pole: c(op.pole) });
        if (op && op.zmeny) { const z = {}; for (const [kk, v] of Object.entries(op.zmeny)) z[kk.includes('.') ? kk : c(kk)] = v; op = Object.assign({}, op, { zmeny: z }); }
        pridej(uroven, [].concat(k).map(x => (x.includes('.') ? x : c(x))), `${jm}: ${text}`, op);
      });
    });
    if (maPodstavu) {
      if (pod.zavazi > 0 && pod.zavaziHloubka > pod.tloustka - 1.6) pridej('chyba', ['podstava.zavaziHloubka', 'podstava.tloustka'], `Kapsy na mince (${fmt(pod.zavaziHloubka)} mm) jsou hlubší, než dovolí podstava – nad nimi musí zůstat aspoň 1,6 mm.`,
        { text: `podstava ${Math.ceil(pod.zavaziHloubka + 2)} mm`, pole: 'podstava.tloustka', hodnota: Math.ceil(pod.zavaziHloubka + 2) });
      if (pod.nozicky && pod.nozickyHloubka > pod.tloustka - 1.5) pridej('chyba', 'podstava.nozickyHloubka', 'Vybrání na nožičky je hlubší než podstava.', { text: `hloubka ${fmt(Math.max(0.4, pod.tloustka - 2))} mm`, pole: 'podstava.nozickyHloubka', hodnota: Math.max(0.4, pod.tloustka - 2) });
      if (pod.odlehceni === 'kapsy' && pod.tloustka < 3.5) pridej('varovani', 'podstava.tloustka', 'Kapsy zespodu potřebují podstavu aspoň 3,5 mm (vrch 1,2 mm).');
      if (pod.odlehceni !== 'zadne' && pod.zebro < 1.6) pridej('varovani', 'podstava.zebro', 'Žebra tenčí než 1,6 mm jsou křehká.');
      if (pod.sraz > pod.tloustka / 2) pridej('info', 'podstava.sraz', 'Sražení je omezeno na polovinu tloušťky podstavy.');
      if (p.moduly.some(m => m.typ === 'sedlo' && m.deleni === 'cep') && pod.tloustka < 4) pridej('varovani', 'podstava.tloustka', 'Pro sloup v objímce zvolte podstavu aspoň 4 mm – dno objímky je 2 mm.');
    }
    const o = p.odlehceni;
    if (o.druh !== 'zadne' && o.druh !== 'okna' && o.zebro < 1.6) pridej('varovani', 'odlehceni.zebro', 'Žebra odlehčení tenčí než 1,6 mm jsou křehká.');
    return H;
  }
  /** Kontroly jednoho modulu; pridej(uroven, klíč(e), text, oprava s klíčem) – cesty modulu doplní kontroly(). */
  function kontrolyModulu(m, i, p, pridej) {
    switch (m.typ) {
      case 'police': {
        if (m.tloustka < 3) pridej('varovani', 'tloustka', `stěna ${fmt(m.tloustka)} mm je křehká – doporučeno aspoň 3–5 mm.`, { text: 'nastavit 4 mm', pole: 'tloustka', hodnota: 4 });
        if (m.lem < 4) pridej('varovani', 'lem', 'bez dostatečného lemu může předmět z poličky sklouznout.', { text: 'lem 8 mm', pole: 'lem', hodnota: 8 });
        if (m.uhel < 5) pridej('info', 'uhel', 'opěra je skoro svislá – předmět se bude snadno převracet dopředu. Obvyklé je 10–25°.');
        if (m.hloubka < 9) pridej('varovani', 'hloubka', `drážka ${fmt(m.hloubka)} mm – telefon v obalu bývá silný 9–13 mm.`, { text: 'nastavit 12 mm', pole: 'hloubka', hodnota: 12 });
        if (m.stupne > 1 && m.prevyseni < m.lem + m.tloustka + 2) pridej('chyba', 'prevyseni', 'převýšení je menší než lem – další stupeň by zasahoval do předchozího.', { text: `převýšení ${Math.ceil(m.lem + m.tloustka + 10)} mm`, pole: 'prevyseni', hodnota: Math.ceil(m.lem + m.tloustka + 10) });
        else if (m.stupne > 1 && m.prevyseni < 30) pridej('info', 'prevyseni', `převýšení ${fmt(m.prevyseni)} mm – zadní kusy budou z velké části schované za předními.`);
        if (m.opera > 60 && !m.vzpera && m.uhel > 15) pridej('info', 'vzpera', 'vysoká skloněná opěra bez vzpěry – stojan se může převážit dozadu.');
        if (m.kabel && m.kabelSirka > m.sirka - 2 * m.tloustka) pridej('chyba', 'kabelSirka', 'výřez na kabel je širší než stojan.', { text: `výřez ${Math.max(4, Math.round(m.sirka / 3))} mm`, pole: 'kabelSirka', hodnota: Math.max(4, Math.round(m.sirka / 3)) });
        if (m.nabijecka !== 'zadna') {
          const n = nabijeckaPolice(m);
          if (n.prumer + 4 > m.sirka) pridej('chyba', ['nabijecka', 'sirka'], `lůžko Ø ${fmt(n.prumer)} se nevejde do šířky ${fmt(m.sirka)} mm.`, { text: `šířka ${Math.ceil(n.prumer + 8)} mm`, pole: 'sirka', hodnota: Math.ceil(n.prumer + 8) });
          if (m.nabVyska - n.prumer / 2 < m.lem - 1) pridej('varovani', 'nabVyska', 'lůžko nabíječky zasahuje pod úroveň lemu – zařízení na něm nebude ležet celou plochou.', { text: `střed ${Math.ceil(m.lem + n.prumer / 2 + 3)} mm`, pole: 'nabVyska', hodnota: Math.ceil(m.lem + n.prumer / 2 + 3) });
          if (m.nabVyska + n.prumer / 2 > m.opera) pridej('chyba', ['nabVyska', 'opera'], 'lůžko nabíječky přesahuje nad opěru.', { text: `opěra ${Math.ceil(m.nabVyska + n.prumer / 2 + 5)} mm`, pole: 'opera', hodnota: Math.ceil(m.nabVyska + n.prumer / 2 + 5) });
        }
        break;
      }
      case 'sloty': {
        const zadano = String(m.sirky || '').split(/[;\s]+/).filter(Boolean);
        if (zadano.length && sirkySlotu(m).length !== Math.min(12, zadano.length)) pridej('varovani', 'sirky', 'některé šířky v seznamu nejsou čísla 2–150 mm – vynechány.');
        if (m.stena < 3 && m.vyska > 40) pridej('info', 'stena', 'tenké vysoké přepážky se pod notebookem mohou kývat – zvažte 5–8 mm.');
        if (m.vyska < 2 * m.dno) pridej('chyba', 'vyska', 'přepážky jsou nižší než dvojnásobek dna.', { text: `výška ${Math.ceil(3 * m.dno)} mm`, pole: 'vyska', hodnota: Math.ceil(3 * m.dno) });
        break;
      }
      case 'sedlo': {
        const o = odvozeneSedlo(m), pod = p.podstava;
        if (m.sedloPolomer <= m.sedloSirka / 2) pridej('chyba', ['sedloPolomer', 'sedloSirka'], `poloměr oblouku sedla musí být větší než polovina jeho šířky (${fmt(m.sedloSirka / 2)} mm).`, { text: `poloměr ${Math.ceil(m.sedloSirka / 2 + 10)} mm`, pole: 'sedloPolomer', hodnota: Math.ceil(m.sedloSirka / 2 + 10) });
        if (m.sedloTloustka >= m.sedloPolomer - 1) pridej('chyba', 'sedloTloustka', 'sedlo je tlustší než poloměr jeho oblouku.');
        if (m.sloupSirka >= m.sedloSirka) pridej('chyba', ['sloupSirka', 'sedloSirka'], 'sloup je širší než sedlo.');
        if (m.vyska < m.sedloTloustka + 20) pridej('chyba', 'vyska', 'sloup je nižší než sedlo.', { text: `výška ${Math.ceil(m.sedloTloustka + 60)} mm`, pole: 'vyska', hodnota: Math.ceil(m.sedloTloustka + 60) });
        if (m.hloubka < 60) {   // sluchátka (VR brýle mají hluboké sedlo a mušle neřeší)
          if (o.volno < 170) pridej('varovani', 'vyska', `hlavový most bude jen ${fmt(o.volno, 0)} mm nad podstavou – mušle velkých sluchátek visí 170–210 mm pod ním a opřou se o podstavu.`, { text: `výška ${Math.ceil(m.vyska + 200 - o.volno)} mm`, pole: 'vyska', hodnota: Math.ceil(m.vyska + 200 - o.volno) });
          else if (o.volno < 200) pridej('info', 'vyska', `hlavový most bude ${fmt(o.volno, 0)} mm nad podstavou – stačí na menší sluchátka; velká přes uši potřebují kolem 200 mm.`);
          if (m.sedloSirka > 150) pridej('info', 'sedloSirka', 'sedlo širší než 150 mm – mušle se mohou zapřít o jeho konce.');
        }
        if (m.hacek && m.hacekVyska > o.zDolni - 15) pridej('chyba', 'hacekVyska', 'háček na kabel zasahuje do sedla nebo vzpěr.', { text: `výška ${Math.round(o.zDolni / 2)} mm`, pole: 'hacekVyska', hodnota: Math.round(o.zDolni / 2) });
        if (pod.tvar === 'obdelnik' || pod.tvar === 'kruh') {
          const rozmer = pod.tvar === 'kruh' ? pod.prumer : Math.min(pod.sirka, pod.hloubka), H0 = m.vyska + pod.tloustka;
          if (!pod.auto && p.moduly.length === 1 && rozmer < 0.4 * H0) pridej('varovani', 'podstava.' + (pod.tvar === 'kruh' ? 'prumer' : 'hloubka'), `podstava je malá vůči výšce – stojan se snadno převrhne (doporučeno aspoň ${Math.ceil(0.45 * H0)} mm).`,
            { text: 'zvětšit podstavu', zmeny: pod.tvar === 'kruh' ? { 'podstava.prumer': Math.ceil(0.45 * H0) } : { 'podstava.hloubka': Math.ceil(0.45 * H0), 'podstava.sirka': Math.max(pod.sirka, Math.ceil(0.45 * H0)) } });
        }
        if (m.vyska + pod.tloustka > LIMIT_PODLOZKY && m.deleni !== 'cep') pridej('info', 'deleni', 'výška přesahuje běžnou tiskárnu – sloup zvlášť se tiskne na boku.', { text: 'sloup zvlášť', pole: 'deleni', hodnota: 'cep' });
        break;
      }
      case 'hak': {
        const o = odvozeneHak(m), sroubem = m.montaz === 'stul' || m.montaz === 'zed';
        if (sroubem && !o.otvory.length) pridej('chyba', 'deska', `deska je krátká na ${m.otvoru} ${m.otvoru === 1 ? 'otvor' : 'otvory'} pro ${o.s.nazev} – potřeba aspoň ${o.potreba} mm.`, { text: `deska ${o.potreba} mm`, pole: 'deska', hodnota: o.potreba });
        if (sroubem && o.zapusteni > m.tloustka - 1.2) pridej('varovani', 'tloustka', `zápustná hlava (${fmt(o.zapusteni, 1)} mm) skoro prořízne desku ${fmt(m.tloustka)} mm.`, { text: `tloušťka ${Math.ceil(o.zapusteni + 2)} mm`, pole: 'tloustka', hodnota: Math.ceil(o.zapusteni + 2) });
        if (m.tloustka < 4) pridej('varovani', 'tloustka', 'háček tenčí než 4 mm se pod sluchátky prohne.');
        if ((m.montaz === 'stul' || m.montaz === 'hrana') && m.vyska < 25) pridej('info', 'vyska', `mezera ${fmt(m.vyska)} mm – tlustý polstrovaný most sluchátek potřebuje kolem 30–45 mm.`);
        if (m.rameno < 30) pridej('info', 'rameno', 'krátké rameno – hlavový most bývá široký 30–45 mm.');
        if (m.lem < 5) pridej('info', 'lem', 'nízký lem – sluchátka mohou z háčku sklouznout.');
        if (m.montaz === 'stul') pridej('info', 'deska', 'vruty se zašroubují zespodu do desky stolu – nesmí být delší než tloušťka desky + háčku.');
        if (m.montaz === 'hrana') pridej('info', 'deskaStolu', `svěrka je na desku ${fmt(m.deskaStolu)} mm – změřte svůj stůl; tiskněte z PETG, PLA časem povolí.`);
        break;
      }
      case 'jazyk':
        if (m.uhel < 10) pridej('info', 'uhel', 'jazyk skoro vodorovně – ovladač může sklouznout; obvyklé je 15–30°.');
        if (m.tloustka < 5) pridej('varovani', 'tloustka', 'tenký jazyk se pod ovladačem prohne.');
        break;
      case 'koliky':
        if (m.pocet > 1 && m.roztec < m.prumer + 2) pridej('chyba', 'roztec', 'kolíky se překrývají – rozteč je menší než průměr.', { text: `rozteč ${Math.ceil(m.prumer + 10)} mm`, pole: 'roztec', hodnota: Math.ceil(m.prumer + 10) });
        if (m.vyska / m.prumer > 8) pridej('varovani', 'prumer', 'štíhlý kolík se snadno ulomí – zvětšete průměr nebo tiskněte z PETG.');
        break;
      case 'puk': {
        const n = nabijeckaPuk(m), a = m.uhel * RAD;
        if (n.prumer + 4 > m.sirka || n.prumer + 4 > m.deska) pridej('chyba', ['sirka', 'deska'], `lůžko Ø ${fmt(n.prumer)} se nevejde na desku ${fmt(m.sirka)} × ${fmt(m.deska)} mm.`, { text: 'zvětšit desku', zmeny: { sirka: Math.max(m.sirka, Math.ceil(n.prumer + 10)), deska: Math.max(m.deska, Math.ceil(n.prumer + 10)) } });
        if (n.hloubka + 1.5 > m.tloustka) pridej('chyba', 'tloustka', 'deska je tenčí než lůžko.', { text: `tloušťka ${Math.ceil(n.hloubka + 3)} mm`, pole: 'tloustka', hodnota: Math.ceil(n.hloubka + 3) });
        const spodek = m.vyskaStredu - m.deska / 2 * Math.cos(a) - m.tloustka * Math.sin(a);
        if (spodek < 0) pridej('chyba', 'vyskaStredu', 'deska by zasahovala pod podložku – zvyšte střed lůžka.', { text: `střed ${Math.ceil(m.vyskaStredu - spodek + 2)} mm`, pole: 'vyskaStredu', hodnota: Math.ceil(m.vyskaStredu - spodek + 2) });
        break;
      }
      case 'kapsa': {
        const Hb = m.vyska > 0 ? m.vyska : m.dno + m.hloubka;
        if (m.hloubka > Hb - m.dno + 1e-9) pridej('chyba', ['hloubka', 'vyska'], 'jamka je hlubší než blok bez dna.', { text: 'výška automaticky', pole: 'vyska', hodnota: 0 });
        if (m.tvar === 'obdelnik' && m.rohyKapsy > Math.min(m.a, m.b) / 2) pridej('info', 'rohyKapsy', 'zaoblení rohů jamky je omezeno na polovinu kratší strany.');
        if (m.otvor > 0 && m.otvor > Math.min(m.a, m.tvar === 'kruh' ? m.a : m.b) - 1) pridej('chyba', 'otvor', 'otvor na kabel je větší než jamka.', { text: 'bez otvoru', pole: 'otvor', hodnota: 0 });
        if (m.prsty && m.hloubka < 8) pridej('info', 'prsty', 'mělká jamka – výřez na prsty nebude potřeba.');
        break;
      }
      case 'kombi': {
        const H = hloubkyPolic(m), n = H.length, zadano = String(m.hloubky || '').split(/[;\s]+/).filter(Boolean);
        if (zadano.length && H.length !== Math.min(6, zadano.length)) pridej('varovani', 'hloubky', 'některé hloubky v seznamu nejsou čísla 5–120 mm – vynechány.');
        if (!n && !m.hak) pridej('chyba', ['pocet', 'hak'], 'držák nemá poličku ani rameno – nic neudrží.', { text: 'rameno na sluchátka', pole: 'hak', hodnota: true });
        const nejvys = n ? m.prvniVyska + (n - 1) * m.rozestup + m.lem + 25 : 0;
        if (n && nejvys > m.vyska) pridej('chyba', ['vyska', 'rozestup'], `horní polička (${fmt(m.prvniVyska + (n - 1) * m.rozestup, 0)} mm) se nevejde pod vrchol páteře.`, { text: `výška ${Math.ceil(nejvys + 10)} mm`, pole: 'vyska', hodnota: Math.ceil(nejvys + 10) });
        if (n > 1 && m.rozestup < 70) pridej('info', 'rozestup', `rozestup ${fmt(m.rozestup, 0)} mm – horní předmět bude ležet na spodním (ovladač je vysoký kolem 100 mm).`);
        if (H.some(h => h < 9)) pridej('varovani', 'hloubka', 'polička mělčí než 9 mm – telefon v obalu se nevejde.');
        if (m.patkaVzadu + m.patkaVpredu < 0.4 * m.vyska) pridej('varovani', 'patkaVzadu', `patka ${fmt(m.patkaVzadu + m.patkaVpredu, 0)} mm je krátká vůči výšce ${fmt(m.vyska, 0)} mm – držák se snadno převrhne.`, { text: `patka dozadu ${Math.ceil(0.45 * m.vyska - m.patkaVpredu)} mm`, pole: 'patkaVzadu', hodnota: Math.ceil(0.45 * m.vyska - m.patkaVpredu) });
        if (n && m.patkaVpredu < 10) pridej('info', 'patkaVpredu', 'předměty na poličkách jsou před patkou – bez sluchátek se držák může naklonit dopředu; prodlužte patku dopředu.');
        if (m.hak && m.hakOblouk > m.hakDelka) pridej('info', 'hakOblouk', 'oblouk pod ramenem je omezen na délku ramene.');
        if (m.hak && m.sirka > 90) pridej('info', 'sirka', 'mušle visí po stranách profilu – při šířce nad 90 mm se o něj opřou.');
        if (m.tloustka < 5) pridej('varovani', 'tloustka', 'páteř tenčí než 5 mm se pod sluchátky prohne.');
        break;
      }
      case 'kabely':
        if (m.hrdlo >= m.prumer) pridej('varovani', 'hrdlo', 'hrdlo je širší než kabel – kabel nebude držet.', { text: `hrdlo ${fmt(m.prumer * 0.75, 1)} mm`, pole: 'hrdlo', hodnota: Math.round(m.prumer * 7.5) / 10 });
        if (m.vyska < m.prumer + 2 * m.stena) pridej('chyba', 'vyska', 'vodítko je nižší než kabel se stěnami.', { text: `výška ${Math.ceil(m.prumer + 2 * m.stena + 2)} mm`, pole: 'vyska', hodnota: Math.ceil(m.prumer + 2 * m.stena + 2) });
        break;
    }
  }

  /* ---------------- odvozené rozměry ---------------- */
  /** Sloup se sedlem: výšky a sedlo v místním rámci (z = 0 horní plocha podstavy). */
  function odvozeneSedlo(q) {
    const hw = q.sedloSirka / 2, Rs = Math.max(q.sedloPolomer, hw + 0.5);
    const a0 = Math.asin(Math.min(0.999, hw / Rs));
    const zc = q.vyska - Rs;
    const prohnuti = Rs - Rs * Math.cos(a0);
    const konec = [hw, q.vyska - prohnuti - q.sedloTloustka];   // spodní roh svislého konce sedla
    const zDolni = q.vzpery ? konec[1] - Math.max(0, konec[0] - q.sloupSirka / 2) : konec[1];
    return { Rs, a0, zc, konec, prohnuti, zDolni, volno: q.vyska - prohnuti };
  }
  /** Háček pod stůl / na zeď: otvory. */
  function odvozeneHak(q) {
    const s = SROUBY[q.sroub], rIn = Math.min(q.zaobleni, q.vyska * 0.45, q.rameno * 0.45);
    const okraj = s.dk / 2 + 2, odSteny = rIn + s.dk / 2 + 1, roztec = s.dk + 4;
    const delka = q.deska - okraj - odSteny;
    const potreba = Math.ceil(okraj + odSteny + (q.otvoru - 1) * roztec);
    const otvory = [];
    if (delka >= (q.otvoru - 1) * roztec) for (let i = 0; i < q.otvoru; i++) otvory.push(odSteny + (q.otvoru === 1 ? 0.5 : i / (q.otvoru - 1)) * delka);
    return { s, rIn, otvory, potreba, roztec, zapusteni: (s.dk - s.d) / 2, dHole: s.d + q.vule, dkHole: s.dk + q.vule };
  }

  function popis(p) {
    const m = p.moduly.map(x => MODULY[x.typ].nazev);
    return `${m.length ? m.join(' + ') : 'prázdná sestava'} · ${NAZVY.podstava[p.podstava.tvar]}`;
  }
  const ulozProjekt = p => G3D.projektJson('stojany', p, 2);
  const nactiProjekt = text => G3D.nactiProjektJson(text, 'stojany', normalizuj, 'Stojanů a držáků');

  const API = {
    SROUBY, MATERIALY, NABIJECKY, NAZVY, MODULY, ODDIL_UMISTENI, PODSTAVA_ODDILY, ODLEHCENI_ODDILY, ZARIZENI, PREDVOLBY, VYCHOZI, MEZE, VYCTY,
    MAX_MODULU, LIMIT_PODLOZKY,
    normalizuj, normModul, novyModul, predvolba, rozmisti, pudorys, otocenyPudorys, popis, ulozProjekt, nactiProjekt,
    samostatny, potrebujePodstavu, tiskNastojato, profilPolice, hloubkyPolic, nabijeckaPolice, nabijeckaPuk, sirkySlotu, odvozeneSedlo, odvozeneHak, obalBodu, kontroly, fmt,
  };
  if (uzel) module.exports = API; else window.STOJ = API;
})();

/* Nástavce na sluchátka a špunty do uší – jádro generátoru (bez DOM a bez three.js, spustitelné v node).
   Dva režimy:
   • „sluchatka“ – ušní špička (TPU) nasazená na nátrubek pecky + pouzdro na tělo sluchátka s ozdobou vzadu,
   • „spunt“     – plný špunt do ucha (TPU) s čepem + ozdoba nasazená na čep.
   Ozdoby (prst, paprička, červ, chapadlo, roh, mrkev, …) se staví z koulí spojených obálkou (hull), z rotačních profilů
   a vysunutých obrysů přes manifold-3d. Ozdoba se tiskne buď celá nastojato, nebo rozříznutá na dvě půlky položené
   řezem na podložku (organické tvary bez podpor, slepí se přes kolíky z filamentu 1,75 mm).

   Souřadnice SESTAVY: osa Z = osa zvukovodu, ucho je na −Z. z = 0 je čelo těla sluchátka (u špuntu horní plocha špuntu).
   Špička leží v z ∈ [−délka, 0] a tiskne se ušním koncem dolů (= montážní poloha). Pouzdro / podstava ozdoby je v z ≥ 0.
   Ozdoba se staví v „kanonické“ soustavě (sestava pootočená o −natočení kolem Z): ohyb ozdoby leží v rovině XZ
   a řez na půlky je rovina y = 0. */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const fmt = G.fmt, kopie = G.kopie;
  const rad = s => s * Math.PI / 180;
  const omez = (x, a, b) => Math.min(b, Math.max(a, x));

  /* ---------------- tabulky ---------------- */
  const MATERIALY = {
    PLA: { nazev: 'PLA', hustota: 1.24 }, PETG: { nazev: 'PETG', hustota: 1.27 }, ASA: { nazev: 'ASA', hustota: 1.07 },
    TPU95: { nazev: 'TPU 95A', hustota: 1.21, pruzny: true }, TPU85: { nazev: 'TPU 85A', hustota: 1.2, pruzny: true },
  };
  /** Druhy ozdob: výchozí délka L, tloušťka T (Ø), ohyb a počet; popisky polí podle druhu (null = pole se nepoužije). */
  /** Druhy ozdob: výchozí délka L a tloušťka T (Ø), ohyb a počet; popisky polí podle druhu (null = pole se nepoužije).
      model: true = tvar z Blenderu (tools/sluchatka_blender.py → sluchatka/tvary/<druh>.js), stránka ho jen zvětší a ohne. */
  const DRUHY = {
    cerv: { nazev: 'Červ', emoji: '🪱', L: 34, T: 8, ohyb: 35, pocet: 2, ohybPopis: 'Rozkmit vlnek', pocetPopis: 'Počet vln', meze: { ohyb: [0, 60], pocet: [1, 4] }, model: true },
    prst: { nazev: 'Prst', emoji: '👉', L: 38, T: 12, ohyb: 40, pocet: 0, ohybPopis: 'Pokrčení prstu', pocetPopis: null, meze: { ohyb: [0, 110] }, model: true },
    papricka: { nazev: 'Chilli paprička', emoji: '🌶️', L: 40, T: 9, ohyb: 70, pocet: 0, ohybPopis: 'Zahnutí', pocetPopis: null, meze: { ohyb: [0, 150] }, model: true },
    chapadlo: { nazev: 'Chapadlo', emoji: '🐙', L: 42, T: 8, ohyb: 220, pocet: 0, ohybPopis: 'Stočení', pocetPopis: null, meze: { ohyb: [0, 300] }, model: true },
    roh: { nazev: 'Roh jednorožce', emoji: '🦄', L: 36, T: 10, ohyb: 540, pocet: 3, ohybPopis: 'Zkroucení', pocetPopis: 'Žebra', meze: { ohyb: [0, 1080], pocet: [2, 6] } },
    mrkev: { nazev: 'Mrkev s natí', emoji: '🥕', L: 35, T: 13.5, ohyb: 0, pocet: 0, ohybPopis: null, pocetPopis: null, meze: {}, model: true },
    kost: { nazev: 'Kost', emoji: '🦴', L: 29, T: 5, ohyb: 0, pocet: 0, ohybPopis: null, pocetPopis: null, meze: {}, model: true },
    kaktus: { nazev: 'Kaktus', emoji: '🌵', L: 32, T: 16, ohyb: 0, pocet: 0, ohybPopis: null, pocetPopis: null, meze: {}, model: true },
    ulita: { nazev: 'Šnek s ulitou', emoji: '🐌', L: 23, T: 24.5, ohyb: 0, pocet: 0, ohybPopis: null, pocetPopis: null, meze: {}, model: true },
    srdce: { nazev: 'Srdce', emoji: '❤️', L: 21, T: 5, ohyb: 0, pocet: 0, ohybPopis: null, pocetPopis: null, meze: {}, model: true },
    svicka: { nazev: 'Ušní svíčka', emoji: '🕯️', L: 36, T: 9, ohyb: 0, pocet: 0, ohybPopis: null, pocetPopis: null, meze: {}, model: true },
    had: { nazev: 'Had', emoji: '🐍', L: 43, T: 6.5, ohyb: 30, pocet: 2, ohybPopis: 'Rozkmit vlnek', pocetPopis: 'Počet vln', meze: { ohyb: [0, 50], pocet: [1, 4] }, model: true },
    banan: { nazev: 'Banán', emoji: '🍌', L: 41, T: 11, ohyb: 50, pocet: 0, ohybPopis: 'Prohnutí', pocetPopis: null, meze: { ohyb: [0, 90] }, model: true },
    ryba: { nazev: 'Rybí ocas', emoji: '🐟', L: 34, T: 9, ohyb: 15, pocet: 0, ohybPopis: 'Švih ocasem', pocetPopis: null, meze: { ohyb: [0, 40] }, model: true },
    klicek: { nazev: 'Klíček', emoji: '🌱', L: 27, T: 3.5, ohyb: 15, pocet: 0, ohybPopis: 'Ohnutí stonku', pocetPopis: null, meze: { ohyb: [0, 40] }, model: true },
    tuzka: { nazev: 'Tužka', emoji: '✏️', L: 41, T: 6.5, ohyb: 0, pocet: 0, ohybPopis: null, pocetPopis: null, meze: {}, model: true },
    houba: { nazev: 'Muchomůrka', emoji: '🍄', L: 30, T: 6.5, ohyb: 0, pocet: 0, ohybPopis: null, pocetPopis: null, meze: {}, model: true },
    lizatko: { nazev: 'Lízátko', emoji: '🍭', L: 32, T: 3.5, ohyb: 0, pocet: 0, ohybPopis: null, pocetPopis: null, meze: {}, model: true },
    mys: { nazev: 'Myš v uchu', emoji: '🐭', L: 31, T: 13, ohyb: 0, pocet: 0, ohybPopis: null, pocetPopis: null, meze: {}, model: true },
    tykadla: { nazev: 'Tykadla', emoji: '👽', L: 30, T: 5, ohyb: 40, pocet: 2, ohybPopis: 'Rozevření', pocetPopis: 'Tykadla', meze: { ohyb: [0, 80], pocet: [1, 3] } },
    zadna: { nazev: 'Bez ozdoby (jen kryt)', emoji: '⚪', L: 0, T: 0, ohyb: 0, pocet: 0, ohybPopis: null, pocetPopis: null, meze: {}, bezRozmeru: true },
  };
  /** Typické rozměry sluchátek – z paměti, ne z měření konkrétních výrobků (19. 11. 2026): typické – ověřit měřením posuvkou. */
  const SLUCHATKA = [
    { id: 'iem_maly', nazev: 'Malé pecky – nátrubek Ø 4 s lemem 4,6', trn: { prumer: 4, lem: 4.6, hloubka: 4 }, telo: { tvar: 'valec', sirka: 10, vyska: 10, delka: 12, hloubka: 8 } },
    { id: 'iem', nazev: 'Běžné pecky – nátrubek Ø 5 s lemem 5,6', trn: { prumer: 5, lem: 5.6, hloubka: 4.5 }, telo: { tvar: 'valec', sirka: 12, vyska: 12, delka: 14, hloubka: 9 } },
    { id: 'hladky', nazev: 'Hladký nátrubek Ø 5,5 bez lemu', trn: { prumer: 5.5, lem: 0, hloubka: 5 }, telo: { tvar: 'valec', sirka: 13, vyska: 13, delka: 14, hloubka: 9 } },
    { id: 'tws', nazev: 'Bezdrátová pecka – nátrubek Ø 6, oválné tělo', trn: { prumer: 6, lem: 0, hloubka: 5 }, telo: { tvar: 'oval', sirka: 20, vyska: 16, delka: 16, hloubka: 10 } },
  ];
  /** Nožičky AirPods (19. 11. 2026): průřez a délka odhadnuté z celkových rozměrů v technických údajích Apple a fotografií –
      typické, ověřit měřením (posuvkou přes nožičku v místě klipu) a kalibračním kroužkem. Pro 3: rozměry nejisté.
      sirka = předozadní rozměr, hloubka = od hlavy ven, delka = viditelná nožička pod hlavou, zuzeni = % rozměru na konci nožičky,
      hlavaY = výška středu vnější plochy hlavy nad horním koncem nožičky, hlavaVen = o kolik hlava vystupuje nad vnější stranu nožičky,
      hlava = [š, v, h] elipsoid hlavy (obrys v náhledu i tvar ramene), spicka = silikonová špička (Pro). */
  const AIRPODS = [
    { id: 'ap2', nazev: 'AirPods (1. a 2. generace)', sirka: 6.3, hloubka: 5.2, delka: 23, zuzeni: 88, tvar: 'oval', poloha: 9, hlavaY: 7, hlavaVen: 2.5, hlava: [16.5, 17, 18], spicka: false },
    { id: 'ap3', nazev: 'AirPods (3. generace)', sirka: 6.2, hloubka: 5.0, delka: 14.5, zuzeni: 90, tvar: 'oval', poloha: 7, hlavaY: 7, hlavaVen: 3, hlava: [18.3, 17, 19.2], spicka: false },
    { id: 'ap4', nazev: 'AirPods 4 (i s ANC)', sirka: 6.0, hloubka: 4.9, delka: 14, zuzeni: 90, tvar: 'oval', poloha: 7, hlavaY: 7, hlavaVen: 3, hlava: [18, 16.5, 18.3], spicka: false },
    { id: 'pro', nazev: 'AirPods Pro (1. a 2. generace)', sirka: 6.8, hloubka: 5.3, delka: 15.5, zuzeni: 92, tvar: 'plochy', poloha: 8, hlavaY: 6.5, hlavaVen: 4, hlava: [21.8, 16, 24], spicka: true },
    { id: 'pro3', nazev: 'AirPods Pro 3 (rozměry nejisté)', sirka: 6.4, hloubka: 5.1, delka: 14.5, zuzeni: 92, tvar: 'plochy', poloha: 7.5, hlavaY: 6.5, hlavaVen: 3.5, hlava: [19.2, 16, 22], spicka: true },
  ];
  const NAZVY = {
    rezim: { sluchatka: 'na sluchátka (pecky)', spunt: 'špunty do uší', airpods: 'klip na AirPods' },
    prurez: { oval: 'oválný', plochy: 'zploštělý' },
    uchyceni: { hlava: 'z hlavy – jako by lezla z ucha', nozicka: 'z nožičky' },
    spicka: { hrib: 'hříbek – 1 příruba', dvojity: 'dvojitá příruba', trojity: 'trojitá příruba', olivka: 'olivka (plná)', kuzel: 'kužel (plný)' },
    tvarTela: { valec: 'válcové', oval: 'oválné' },
    kabel: { zadny: 'bez kabelu (bezdrátová)', bokem: 'drážka pro kabel' },
    deleni: { auto: 'automaticky (méně převisů)', cela: 'celá nastojato', pulky: 'dvě půlky naplocho' },
  };
  const DRUH_KLICE = Object.keys(DRUHY);

  const VYCHOZI = {
    verze: 1, nazev: 'Červ z ucha', rezim: 'sluchatka',
    spicka: { tvar: 'hrib', prumer: 12.5, delka: 8, stena: 0.8, uhel: 42, kanal: 2.8 },
    trn: { prumer: 5, hloubka: 4.5, lem: 5.6, lemVyska: 1, presah: 0.3 },
    telo: { tvar: 'valec', sirka: 12, vyska: 12, delka: 14, hloubka: 9, stena: 1.6, kabel: 'zadny', kabelSirka: 3 },
    airpods: { model: 'pro', sirka: 6.8, hloubka: 5.3, delka: 15.5, zuzeni: 92, tvar: 'plochy', poloha: 8, klip: 9, stena: 1.4, otevreni: 74, vule: 0.15, uchyceni: 'hlava', hlavaY: 6.5, hlavaVen: 4, rameno: 4 },
    cep: { prumer: 3, delka: 4 },
    ozdoba: { druh: 'cerv', delka: 34, tloustka: 8, ohyb: 35, pocet: 2, natoceni: 0 },
    vule: { telo: 0.2, cep: 0.15, kompenzace: 0.1 },
    tisk: { deleni: 'auto', material: 'PLA', materialSpicky: 'TPU95', par: true, kolik: true, uhel: 45, vypln: 20 },
  };
  const MEZE = {
    'spicka.prumer': [7, 20], 'spicka.delka': [4, 25], 'spicka.stena': [0.4, 3], 'spicka.uhel': [20, 70], 'spicka.kanal': [0, 6],
    'trn.prumer': [2.5, 9], 'trn.hloubka': [2, 10], 'trn.lem': [0, 11], 'trn.lemVyska': [0.4, 3], 'trn.presah': [-0.3, 1],
    'telo.sirka': [5, 30], 'telo.vyska': [5, 30], 'telo.delka': [3, 40], 'telo.hloubka': [2, 40], 'telo.stena': [0.8, 4], 'telo.kabelSirka': [1.5, 6],
    'cep.prumer': [1.5, 6], 'cep.delka': [2, 10],
    'airpods.sirka': [3, 12], 'airpods.hloubka': [3, 10], 'airpods.delka': [6, 35], 'airpods.zuzeni': [60, 100], 'airpods.poloha': [2, 30],
    'airpods.klip': [4, 20], 'airpods.stena': [0.8, 3], 'airpods.otevreni': [50, 95], 'airpods.vule': [-0.3, 0.8], 'airpods.hlavaY': [2, 15], 'airpods.hlavaVen': [0, 10], 'airpods.rameno': [2.5, 8],
    'ozdoba.delka': [8, 90], 'ozdoba.tloustka': [2, 30], 'ozdoba.ohyb': [0, 1080], 'ozdoba.pocet': [0, 12, true], 'ozdoba.natoceni': [-180, 180],
    'vule.telo': [-0.4, 1.5], 'vule.cep': [-0.2, 0.6], 'vule.kompenzace': [-0.2, 0.5],
    'tisk.uhel': [20, 70], 'tisk.vypln': [0, 100],
  };
  const VYCTY = {
    'airpods.model': AIRPODS.map(a => a.id).concat('vlastni'), 'airpods.tvar': Object.keys(NAZVY.prurez), 'airpods.uchyceni': Object.keys(NAZVY.uchyceni),
    rezim: Object.keys(NAZVY.rezim), 'spicka.tvar': Object.keys(NAZVY.spicka), 'telo.tvar': Object.keys(NAZVY.tvarTela), 'telo.kabel': Object.keys(NAZVY.kabel),
    'ozdoba.druh': DRUH_KLICE, 'tisk.deleni': Object.keys(NAZVY.deleni), 'tisk.material': Object.keys(MATERIALY), 'tisk.materialSpicky': Object.keys(MATERIALY),
  };
  const oz = (druh, x = {}) => Object.assign({ druh, delka: DRUHY[druh].L, tloustka: DRUHY[druh].T, ohyb: DRUHY[druh].ohyb, pocet: DRUHY[druh].pocet, natoceni: 0 }, x);
  const PREDVOLBY = [
    { id: 'cerv', skupina: 'Na sluchátka', nazev: '🪱 Červ lezoucí z ucha', popis: 'hříbek z TPU, pouzdro Ø 12, červ 34 mm se dvěma vlnami', p: {} },
    { id: 'prst', skupina: 'Na sluchátka', nazev: '👉 Prst v uchu', popis: 'dvojitá příruba, pouzdro = konec prstu, pokrčený prst 38 mm', p: { nazev: 'Prst v uchu', spicka: { tvar: 'dvojity', delka: 10 }, ozdoba: oz('prst', { delka: 38, tloustka: 12 }) } },
    { id: 'papricka', skupina: 'Na sluchátka', nazev: '🌶️ Chilli paprička', popis: 'olivka, zahnutá paprička s kalichem', p: { nazev: 'Paprička', spicka: { tvar: 'olivka', delka: 9 }, ozdoba: oz('papricka') } },
    { id: 'roh', skupina: 'Na sluchátka', nazev: '🦄 Roh jednorožce', popis: 'kroucený roh se 3 žebry, tiskne se nastojato', p: { nazev: 'Jednorožec', ozdoba: oz('roh') } },
    { id: 'tykadla', skupina: 'Na sluchátka', nazev: '👽 Tykadla mimozemšťana', popis: 'dvě tykadla s kuličkami, bezdrátové oválné tělo', p: { nazev: 'Tykadla', trn: { prumer: 6, lem: 0, hloubka: 5 }, telo: { tvar: 'oval', sirka: 20, vyska: 16, delka: 16, hloubka: 10 }, spicka: { prumer: 13 }, ozdoba: oz('tykadla') } },
    { id: 'svicka', skupina: 'Na sluchátka', nazev: '🕯️ Ušní svíčka', popis: 'svíčka se stékajícími kapkami a plamenem', p: { nazev: 'Ušní svíčka', ozdoba: oz('svicka') } },
    { id: 'kryt', skupina: 'Na sluchátka', nazev: '⚪ Jen kryt pecky', popis: 'pouzdro s kuželem, drážka pro kabel', p: { nazev: 'Kryt pecky', telo: { kabel: 'bokem' }, ozdoba: oz('zadna') } },
    { id: 'had', skupina: 'Na sluchátka', nazev: '🐍 Had z ucha', popis: 'trojitá příruba, had se šupinami a jazykem ve dvou vlnách', p: { nazev: 'Had', spicka: { tvar: 'trojity', delka: 13 }, ozdoba: oz('had') } },
    { id: 'ryba', skupina: 'Na sluchátka', nazev: '🐟 Ryba skáče do ucha', popis: 'olivka, zadní půlka ryby s ploutví', p: { nazev: 'Ryba', spicka: { tvar: 'olivka', delka: 9 }, ozdoba: oz('ryba') } },
    { id: 'tuzka', skupina: 'Na sluchátka', nazev: '✏️ Tužka za uchem… v uchu', popis: 'tužka s objímkou a gumou, tiskne se nastojato', p: { nazev: 'Tužka', ozdoba: oz('tuzka') } },
    { id: 'mys', skupina: 'Na sluchátka', nazev: '🐭 Myš mizí v uchu', popis: 'zadeček, kopající nožky a ocas', p: { nazev: 'Myš', ozdoba: oz('mys') } },
    { id: 'ap_prst', skupina: 'Klip na AirPods', nazev: '👉 Prst z AirPods Pro', popis: 'klip na nožičku AirPods Pro, pokrčený prst', p: { nazev: 'Prst – AirPods Pro', rezim: 'airpods', ozdoba: oz('prst', { delka: 32, tloustka: 10 }), tisk: { material: 'PETG' } } },
    { id: 'ap_cerv', skupina: 'Klip na AirPods', nazev: '🪱 Červ z AirPods 4', popis: 'klip na AirPods 4, červ ve vlnkách', p: { nazev: 'Červ – AirPods 4', rezim: 'airpods', airpods: { model: 'ap4', sirka: 6, hloubka: 4.9, delka: 14, zuzeni: 90, tvar: 'oval', poloha: 7 }, ozdoba: oz('cerv', { delka: 28, tloustka: 7 }), tisk: { material: 'PETG' } } },
    { id: 'ap_roh', skupina: 'Klip na AirPods', nazev: '🦄 Roh na AirPods 2', popis: 'klip na dlouhou nožičku 1./2. generace, kroucený roh', p: { nazev: 'Jednorožec – AirPods', rezim: 'airpods', airpods: { model: 'ap2', sirka: 6.3, hloubka: 5.2, delka: 23, zuzeni: 88, tvar: 'oval', poloha: 9 }, ozdoba: oz('roh', { delka: 26, tloustka: 8 }), tisk: { material: 'PETG' } } },
    { id: 'chapadlo', skupina: 'Špunty do uší', nazev: '🐙 Chapadlo', popis: 'trojitý špunt z TPU, stočené chapadlo s přísavkami', p: { nazev: 'Chapadlo', rezim: 'spunt', spicka: { tvar: 'trojity', delka: 13, kanal: 0 }, ozdoba: oz('chapadlo') } },
    { id: 'mrkev', skupina: 'Špunty do uší', nazev: '🥕 Mrkev v uchu', popis: 'kuželový špunt = špička mrkve, nahoře nať', p: { nazev: 'Mrkev', rezim: 'spunt', spicka: { tvar: 'kuzel', delka: 12, prumer: 12, kanal: 0 }, ozdoba: oz('mrkev') } },
    { id: 'kost', skupina: 'Špunty do uší', nazev: '🦴 Kost skrz ucho', popis: 'olivkový špunt, kost tištěná na půlky', p: { nazev: 'Kost', rezim: 'spunt', spicka: { tvar: 'olivka', delka: 10, kanal: 0 }, ozdoba: oz('kost') } },
    { id: 'kaktus', skupina: 'Špunty do uší', nazev: '🌵 Kaktus', popis: 'hříbkový špunt, kaktus se dvěma rameny', p: { nazev: 'Kaktus', rezim: 'spunt', spicka: { kanal: 0 }, ozdoba: oz('kaktus') } },
    { id: 'ulita', skupina: 'Špunty do uší', nazev: '🐌 Šnek s ulitou', popis: 'dvojitý špunt, šnek s ulitou a tykadly', p: { nazev: 'Šnek', rezim: 'spunt', spicka: { tvar: 'dvojity', delka: 10, kanal: 0 }, ozdoba: oz('ulita') } },
    { id: 'banan', skupina: 'Špunty do uší', nazev: '🍌 Banán', popis: 'kuželový špunt, prohnutý banán se stopkou', p: { nazev: 'Banán', rezim: 'spunt', spicka: { tvar: 'kuzel', delka: 12, prumer: 12, kanal: 0 }, ozdoba: oz('banan') } },
    { id: 'klicek', skupina: 'Špunty do uší', nazev: '🌱 Klíček', popis: 'hříbkový špunt, ze kterého raší klíček', p: { nazev: 'Klíček', rezim: 'spunt', spicka: { kanal: 0 }, ozdoba: oz('klicek') } },
    { id: 'houba', skupina: 'Špunty do uší', nazev: '🍄 Muchomůrka', popis: 'olivkový špunt, houba s puntíky', p: { nazev: 'Muchomůrka', rezim: 'spunt', spicka: { tvar: 'olivka', delka: 10, kanal: 0 }, ozdoba: oz('houba') } },
    { id: 'lizatko', skupina: 'Špunty do uší', nazev: '🍭 Lízátko', popis: 'hříbkový špunt, lízátko se spirálou', p: { nazev: 'Lízátko', rezim: 'spunt', spicka: { kanal: 0 }, ozdoba: oz('lizatko') } },
    { id: 'srdce', skupina: 'Špunty do uší', nazev: '❤️ Srdce', popis: 'hříbkový špunt se srdíčkem', p: { nazev: 'Srdce', rezim: 'spunt', spicka: { kanal: 0 }, ozdoba: oz('srdce') } },
  ];

  /* ---------------- normalizace a projekt ---------------- */
  const normalizuj = v => G.normalizuj(v, { VYCHOZI, MEZE, VYCTY });
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(G.slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }
  /** Přepne druh ozdoby a nastaví jeho výchozí rozměry (natočení zůstane). */
  function prepniDruh(p, druh) {
    const q = kopie(p);
    q.ozdoba = oz(druh, { natoceni: p.ozdoba.natoceni });
    return normalizuj(q).p;
  }
  /** Rozměry sluchátka z tabulky (ostatní nechá). */
  function nastavSluchatko(p, id) {
    const s = SLUCHATKA.find(x => x.id === id), q = kopie(p);
    if (s) { Object.assign(q.trn, s.trn); Object.assign(q.telo, s.telo); }
    return normalizuj(q).p;
  }
  /** Rozměry nožičky podle modelu AirPods (ostatní nechá). */
  function nastavAirpods(p, id) {
    const a = AIRPODS.find(x => x.id === id), q = kopie(p);
    if (a) for (const k of ['sirka', 'hloubka', 'delka', 'zuzeni', 'tvar', 'poloha', 'hlavaY', 'hlavaVen']) q.airpods[k] = a[k];
    q.airpods.model = a ? id : 'vlastni';
    return normalizuj(q).p;
  }
  function popis(p) {
    const d = DRUHY[p.ozdoba.druh];
    if (p.rezim === 'airpods') { const a = AIRPODS.find(x => x.id === p.airpods.model); return `${d.emoji} ${d.nazev} · klip na ${a ? a.nazev.replace(/ \(.*\)$/, '') : 'vlastní nožičku'}`; }
    return `${d.emoji} ${d.nazev} · ${NAZVY.rezim[p.rezim]} · ${NAZVY.spicka[p.spicka.tvar].split(' –')[0]} Ø ${fmt(p.spicka.prumer)}`;
  }
  const TYP = 'sluchatka';
  const ulozProjekt = p => G.projektJson(TYP, p, 1);
  const nactiProjekt = text => G.nactiProjektJson(text, TYP, normalizuj, 'Nástavce na sluchátka');

  /* ---------------- odvozené rozměry ---------------- */
  const PODILY_PRIRUB = { hrib: [1], dvojity: [0.8, 1], trojity: [0.68, 0.84, 1] };
  const C_KONEC = 0.8;   // sražení ušního konce 45°
  function odvozene(p) {
    const s = p.spicka, t = p.trn, k = p.vule.kompenzace, sl = p.rezim === 'sluchatka';
    const o = { sluch: sl, R: s.prumer / 2, Lt: s.delka };
    if (sl) {
      o.rb = (t.prumer - t.presah + k) / 2;                       // otvor na nátrubek (přesah = TPU se roztáhne)
      o.rl = t.lem > 0 ? (t.lem - t.presah + k) / 2 : 0;           // drážka pro lem nátrubku
      o.kanal = Math.min(s.kanal, 2 * o.rb - 0.4) / 2;
      o.rs = Math.max(o.rb + 1, o.rl + 0.8, o.kanal + 0.8);
    } else {
      o.kanal = 0;
      o.rc = p.cep.prumer / 2;                                      // čep špuntu
      o.rs = Math.max(o.rc + 1.2, 3);
    }
    const podily = PODILY_PRIRUB[s.tvar];
    if (podily) {
      const a = rad(s.uhel), tv = s.stena / Math.sin(a);
      o.tv = tv;
      o.priruby = [];
      let z = -o.Lt + C_KONEC + 0.3;
      for (const f of podily) {
        const R = o.R * f, pokles = Math.max(0, R - o.rs) / Math.tan(a);
        o.priruby.push({ R, za: z, pokles, zr: z + pokles + tv });
        z += tv + 0.9;
      }
      const posl = o.priruby[o.priruby.length - 1];
      o.Lmin = posl.zr + o.Lt + 0.3;   // délka, při které okraj poslední příruby nepřesáhne základnu
    } else {
      const Re = s.tvar === 'olivka' ? 0.8 * o.R : 0.55 * o.R;
      o.Re = Re;
      o.Lmin = s.tvar === 'olivka' ? C_KONEC + (o.R - Re) + 1.5 : (o.R - Re) + C_KONEC + 1;
    }
    if (sl) o.Lmin = Math.max(o.Lmin, t.hloubka + 1.2);
    // pouzdro sluchátka / podstava ozdoby
    if (sl) {
      const vt = (p.vule.telo + k) / 2;
      o.a = p.telo.sirka / 2 + vt;
      o.b = (p.telo.tvar === 'oval' ? p.telo.vyska : p.telo.sirka) / 2 + vt;
      o.z0 = p.telo.delka - p.telo.hloubka;
      o.zi = p.telo.delka;
      o.zb = o.zi + p.telo.stena;
      o.Rx = o.a + p.telo.stena; o.Ry = o.b + p.telo.stena;
    } else {
      o.rd = (p.cep.prumer + p.vule.cep + k) / 2;                    // díra pro čep v ozdobě
      o.rp = Math.max(o.rd + 1.4, o.rs);
      o.z0 = 0; o.zb = p.cep.delka + 1.2;
      o.Rx = o.Ry = o.rp;
    }
    o.air = p.rezim === 'airpods';
    if (o.air) {   // klip na nožičku: osa nožičky = Y, střed klipu y = 0, horní konec nožičky (hlava) v y = +poloha
      const A = p.airpods, v = (A.vule + k) / 2;
      o.prurez = y => {   // poloosy průřezu nožičky (bez vůle) v hloubce y pod hlavou
        const f = 1 - (1 - A.zuzeni / 100) * Math.min(1, Math.max(0, y / A.delka));
        return [A.sirka / 2 * f, A.hloubka / 2 * f];
      };
      const h = o.prurez(A.poloha - A.klip / 2), d = o.prurez(A.poloha + A.klip / 2);
      o.kHor = [h[0] + v, h[1] + v]; o.kDol = [d[0] + v, d[1] + v];
      o.zc = -(o.kHor[1] + A.stena);          // osa nožičky; vršek klipu v z = 0
      o.Rx = o.kHor[0] + A.stena; o.Ry = A.klip / 2;
      o.z0 = 0; o.zb = 0;
      o.otevreni = A.otevreni / 100 * 2 * o.kHor[0];
      const ap = AIRPODS.find(x => x.id === A.model) || AIRPODS[3], [hx, hy, hz] = ap.hlava;
      o.hlava = { hx, hy, hz, yc: A.poloha + A.hlavaY, zc: o.zc + o.prurez(0)[1] + A.hlavaVen - hz / 2 };
      o.naHlave = A.uchyceni === 'hlava';
      if (o.naHlave) {   // ozdoba na čepu nad středem hlavy; podstava ozdoby jako u špuntu
        o.rc = p.cep.prumer / 2; o.rd = (p.cep.prumer + p.vule.cep + k) / 2;
        o.rp = Math.max(o.rd + 1.4, 3); o.zb = p.cep.delka + 1.2; o.Rx = o.Ry = o.rp;
        // rameno od klipu přes hlavu: spodek 0,8 mm nad elipsoidem hlavy, sklon nejvýš 45° (díl se tiskne nožičkou dolů)
        const Hd = o.hlava, tA = A.stena + 0.4, y0 = -A.klip / 2, y1 = Hd.yc + o.rp, n = Math.max(8, Math.ceil((y1 - y0) / 0.4)), dy = (y1 - y0) / n;
        const ys = [], zs = [];
        for (let i = 0; i <= n; i++) {
          const y = y0 + dy * i, u = (y - Hd.yc) / (Hd.hy / 2);
          ys.push(y); zs.push(Math.max(-0.8, Math.abs(u) < 1 ? Hd.zc + Hd.hz / 2 * Math.sqrt(1 - u * u) + 0.8 : -Infinity));
        }
        for (let i = 1; i <= n; i++) zs[i] = Math.max(zs[i], zs[i - 1] - dy);
        for (let i = n - 1; i >= 0; i--) zs[i] = Math.max(zs[i], zs[i + 1] - dy);
        const zNa = y => { const u = Math.min(n, Math.max(0, (y - y0) / dy)), i = Math.min(n - 1, Math.floor(u)); return zs[i] + (zs[i + 1] - zs[i]) * (u - i); };
        const zPad = zNa(Hd.yc);
        o.rameno = { ys, zs, tA, w: A.rameno, zNa };
        o.zPad = zPad; o.zPt = zPad + tA;
      }
    }
    return o;
  }

  /* ---------------- kontroly parametrů ---------------- */
  function kontroly(p) {
    const H = [], o = odvozene(p), s = p.spicka, sl = o.sluch, d = DRUHY[p.ozdoba.druh];
    if (o.air) kontrolyAirpods(p, o, H);
    else kontrolySpicky(p, o, s, sl, H);
    if (!d.bezRozmeru) {
      const m = d.meze || {};
      if (m.ohyb && (p.ozdoba.ohyb < m.ohyb[0] || p.ozdoba.ohyb > m.ohyb[1])) H.push({ uroven: 'info', pole: ['ozdoba.ohyb'], text: `${d.ohybPopis} ${fmt(p.ozdoba.ohyb)}° je u druhu „${d.nazev}“ mimo rozumný rozsah ${m.ohyb[0]}–${m.ohyb[1]}° – použito ${fmt(omez(p.ozdoba.ohyb, m.ohyb[0], m.ohyb[1]))}°.` });
      if (m.pocet && (p.ozdoba.pocet < m.pocet[0] || p.ozdoba.pocet > m.pocet[1])) H.push({ uroven: 'info', pole: ['ozdoba.pocet'], text: `${d.pocetPopis}: ${p.ozdoba.pocet} je mimo rozsah ${m.pocet[0]}–${m.pocet[1]} – použito ${omez(p.ozdoba.pocet, m.pocet[0], m.pocet[1])}.` });
      if (p.ozdoba.tloustka < 3 && p.ozdoba.druh !== 'srdce') H.push({ uroven: 'varovani', pole: ['ozdoba.tloustka'], text: 'Ozdoba tenčí než 3 mm se snadno ulomí.' });
    }
    return H;
  }
  function kontrolyAirpods(p, o, H) {
    const A = p.airpods, m = MATERIALY[p.tisk.material];
    if (A.klip / 2 > A.poloha - 0.5) H.push({ uroven: 'chyba', pole: ['airpods.poloha'], text: 'Klip zasahuje do hlavy sluchátka – posuňte ho níž po nožičce.', oprava: { text: `poloha ${fmt(A.klip / 2 + 0.5, 1)} mm`, pole: 'airpods.poloha', hodnota: A.klip / 2 + 0.5 } });
    const volno = A.delka - A.poloha - A.klip / 2;
    if (volno < 2.5) H.push({ uroven: volno < 0 ? 'chyba' : 'varovani', pole: ['airpods.poloha', 'airpods.klip'], text: volno < 0 ? 'Klip je delší, než kam sahá nožička.' : `Pod klipem zbývá jen ${fmt(volno, 1)} mm nožičky – kontakty a mikrofon na konci musí zůstat volné (aspoň 2,5 mm).` });
    if (A.stena < 1.2) H.push({ uroven: 'varovani', pole: ['airpods.stena'], text: `Stěna klipu ${fmt(A.stena, 1)} mm se při nasazování může zlomit – doporučeno 1,2–1,8 mm.` });
    const pole = o.naHlave ? 'tisk.materialSpicky' : 'tisk.material', mk = o.naHlave ? MATERIALY[p.tisk.materialSpicky] : m;
    if (mk.nazev === 'PLA') H.push({ uroven: 'varovani', pole: [pole], text: 'Klip z PLA při zacvaknutí praská – tiskněte z PETG, nebo z TPU 95A (drží nejlíp a nepoškrábe).', oprava: { text: 'PETG', pole, hodnota: 'PETG' } });
    if (o.naHlave && A.model.startsWith('pro')) H.push({ uroven: 'info', pole: null, text: 'Podložka ozdoby leží přes vnější mřížku hlavy (mikrofony potlačení hluku) – ANC a hovory můžou být o něco horší.' });
    if (A.model === 'pro3') H.push({ uroven: 'info', pole: ['airpods.sirka'], text: 'Rozměry nožičky AirPods Pro 3 jsou jen odhad – změřte posuvkou a vytiskněte kalibrační kroužky.' });
    H.push({ uroven: 'info', pole: null, text: 'S klipem se AirPods nevejdou do nabíjecího pouzdra – před nabíjením klip sundejte. Ovládání stiskem nožičky může klip zakrýt; pak ho posuňte níž.' });
  }
  function kontrolySpicky(p, o, s, sl, H) {
    if (o.Lmin > s.delka + 1e-6) H.push({ uroven: 'chyba', pole: ['spicka.delka'], text: `Špička je krátká: ${o.priruby ? 'okraj příruby' : 'tvar'}${sl ? ' nebo otvor pro nátrubek' : ''} by přesáhl základnu – potřeba aspoň ${fmt(o.Lmin, 1)} mm.`, oprava: { text: `délka ${fmt(Math.ceil(o.Lmin * 10) / 10, 1)} mm`, pole: 'spicka.delka', hodnota: Math.ceil(o.Lmin * 10) / 10 } });
    if (o.R < o.rs + 1) H.push({ uroven: 'chyba', pole: ['spicka.prumer'], text: `Příruba Ø ${fmt(s.prumer)} je skoro stejná jako dřík Ø ${fmt(2 * o.rs, 1)} – zvětšete průměr špičky.`, oprava: { text: `Ø ${fmt(Math.ceil(2 * o.rs + 4))} mm`, pole: 'spicka.prumer', hodnota: Math.ceil(2 * o.rs + 4) } });
    if (o.priruby && s.uhel > p.tisk.uhel + 1e-6) H.push({ uroven: 'varovani', pole: ['spicka.uhel'], text: `Příruba svírá s osou ${fmt(s.uhel)}° – víc než povolený převis ${fmt(p.tisk.uhel)}°, spodek příruby se bez podpor prověsí.`, oprava: { text: `úhel ${fmt(p.tisk.uhel)}°`, pole: 'spicka.uhel', hodnota: p.tisk.uhel } });
    if (o.priruby && s.stena < 0.6) H.push({ uroven: 'varovani', pole: ['spicka.stena'], text: `Příruba ${fmt(s.stena, 2)} mm je na tryskovou tiskárnu příliš tenká (doporučeno 0,7–1 mm, tryska 0,4).` });
    if (s.prumer < 9 || s.prumer > 16) H.push({ uroven: 'info', pole: ['spicka.prumer'], text: `Průměr ${fmt(s.prumer)} mm je mimo běžné velikosti špiček (S ≈ 11, M ≈ 12,5, L ≈ 14 mm).` });
    const mS = MATERIALY[p.tisk.materialSpicky];
    if (!mS.pruzny) H.push({ uroven: 'varovani', pole: ['tisk.materialSpicky'], text: `Špička do ucha z ${mS.nazev} bude tvrdá a netěsná – tiskněte ji z pružného TPU.`, oprava: { text: 'TPU 95A', pole: 'tisk.materialSpicky', hodnota: 'TPU95' } });
    if (sl) {
      if (p.trn.lem > 0 && p.trn.lem <= p.trn.prumer) H.push({ uroven: 'chyba', pole: ['trn.lem'], text: 'Lem nátrubku musí být větší než jeho průměr (0 = bez lemu).', oprava: { text: 'bez lemu', pole: 'trn.lem', hodnota: 0 } });
      if (p.trn.lem > 0 && p.trn.lemVyska > p.trn.hloubka - 0.8) H.push({ uroven: 'chyba', pole: ['trn.lemVyska'], text: 'Lem je vyšší než nasazení na nátrubek.' });
      if (s.kanal < 1.5) H.push({ uroven: 'varovani', pole: ['spicka.kanal'], text: `Zvukový kanál Ø ${fmt(s.kanal, 1)} mm utlumí výšky – běžně 2,5–3,5 mm.` });
      if (p.telo.hloubka > p.telo.delka) H.push({ uroven: 'chyba', pole: ['telo.hloubka'], text: 'Pouzdro je hlubší než tělo sluchátka – zasáhlo by do ucha.', oprava: { text: `hloubka ${fmt(p.telo.delka)} mm`, pole: 'telo.hloubka', hodnota: p.telo.delka } });
      if (p.telo.stena < 1.2) H.push({ uroven: 'varovani', pole: ['telo.stena'], text: `Stěna pouzdra ${fmt(p.telo.stena, 1)} mm praskne při nasazování – doporučeno aspoň 1,2 mm (3 perimetry).` });
      if (p.vule.telo < 0) H.push({ uroven: 'info', pole: ['vule.telo'], text: 'Záporná vůle = pouzdro se na tělo nalisuje; z PLA jen do −0,1 mm, jinak praskne.' });
    } else {
      if (p.cep.prumer < 2.5) H.push({ uroven: 'varovani', pole: ['cep.prumer'], text: `Čep Ø ${fmt(p.cep.prumer, 1)} mm z TPU se ohne – doporučeno 3 mm a víc.` });
      H.push({ uroven: 'info', pole: null, text: 'Špunt z tiskárny není certifikovaná ochrana sluchu – je to ozdoba. Nezasouvejte nic hlouběji, než je vstup do zvukovodu.' });
    }
  }

  /* ---------------- stavba ---------------- */
  const segmenty = r => omez(Math.round(2 * Math.PI * r / 0.55), 20, 120);
  const segKoule = r => omez(Math.round(2 * Math.PI * r / 0.8), 14, 40);

  /* ---------------- tvary z Blenderu ---------------- */
  const TVARY = uzel ? {} : (window.SLUCH_TVARY = window.SLUCH_TVARY || {});
  /** Data tvaru (v node se načte samo, v prohlížeči ho stránka přidá skriptem sluchatka/tvary/<druh>.js). */
  function tvar(druh) {
    if (!TVARY[druh] && uzel) Object.assign(TVARY, require('./tvary/' + druh + '.js'));
    return TVARY[druh] || null;
  }
  /** Druh ozdoby, jehož tvar ještě není načtený (null = vše připraveno). */
  const chybiTvar = p => (DRUHY[p.ozdoba.druh].model && !tvar(p.ozdoba.druh) ? p.ozdoba.druh : null);
  const b64 = t => (uzel ? Uint8Array.from(Buffer.from(t, 'base64')) : Uint8Array.from(atob(t), c => c.charCodeAt(0)));
  const logist = x => 1 / (1 + Math.exp(-x));
  /** Úhel osy (rad, od +z k +x) v poměrné délce s: jak se která ozdoba ohýbá. */
  function funkceOhybu(t, th, n, L, r) {
    switch (t.ohyb) {
      case 'klouby': {   // polovina ohybu v každém kloubu, šířka přechodu tak, aby poloměr ohybu ≥ 1,2× tloušťka
        const w = Math.max(0.025, (th / 2) * 1.2 * r / (4 * L));
        return s => (th / 2) * (logist((s - t.klouby[0]) / w) + logist((s - t.klouby[1]) / w));
      }
      case 'spicka': return s => th * Math.pow(s, 1.6);
      case 'spirala': return s => th * s * s;
      case 'oblouk': return s => th * s;
      case 'vlny': return s => th * Math.sin(2 * Math.PI * n * s) * Math.min(1, 3 * s);
      default: return null;
    }
  }
  /** Tvar z Blenderu: zvětšení na délku L a tloušťku T, ohnutí podél křivky v rovině XZ (délka osy se zachová). */
  function modelOzdoby(N, druh, L, T, ohyb, n) {
    const t = tvar(druh);
    if (!t) throw new Error(`tvar „${druh}“ ještě není načtený`);
    const q = new Int16Array(b64(t.v).buffer), ix = t.i32 ? new Uint32Array(b64(t.i).buffer) : new Uint16Array(b64(t.i).buffer);
    const sz = L / t.L0, sT = T / t.T0, sx = t.skalaT === 'y' ? sz : sT, sy = sT;
    const fi = funkceOhybu(t, rad(ohyb), n, L, T / 2);
    // osa ohybu: tabulka bodů C(s) a úhlů
    const K = 800, C = new Float64Array(2 * (K + 1)), A = new Float64Array(K + 1);
    if (fi) for (let i = 1; i <= K; i++) {
      const a0 = fi((i - 1) / K), a1 = fi(i / K), am = (a0 + a1) / 2, ds = L / K;
      A[i] = a1; C[2 * i] = C[2 * i - 2] + ds * Math.sin(am); C[2 * i + 1] = C[2 * i - 1] + ds * Math.cos(am);
    }
    const ohni = (x, y, z, out, o) => {
      if (!fi || z <= 0) { out[o] = x; out[o + 1] = y; out[o + 2] = z; return; }
      const u = Math.min(z / L, 1) * K, i = Math.min(K - 1, Math.floor(u)), f = u - i;
      const cx = C[2 * i] + (C[2 * i + 2] - C[2 * i]) * f, cz = C[2 * i + 1] + (C[2 * i + 3] - C[2 * i + 1]) * f, a = A[i] + (A[i + 1] - A[i]) * f;
      const nad = Math.max(0, z - L);   // nad koncem osy rovně dál
      out[o] = cx + x * Math.cos(a) + nad * Math.sin(a); out[o + 1] = y; out[o + 2] = cz - x * Math.sin(a) + nad * Math.cos(a);
    };
    const P = new Float32Array(q.length);
    for (let i = 0; i < q.length; i += 3) ohni(q[i] * t.k * sx, q[i + 1] * t.k * sy, q[i + 2] * t.k * sz, P, i);
    const m = N.k(new N.M(new N.Mesh({ numProp: 3, vertProperties: P, triVerts: new Uint32Array(ix) })));
    if (m.status() !== 'NoError') throw new Error(`tvar „${druh}“: manifold hlásí ${m.status()}`);
    const osa = t.osa.map(([x, z, r]) => { const b = [0, 0, 0]; ohni(x * sx, 0, z * sz, b, 0); return [b[0], b[2], r * Math.min(sx, sy)]; });
    return { m, rz: t.rz * Math.min(sx, sy), osa };
  }

  /** Ozdoby v kanonické soustavě: připojení v počátku, růst do +z, ohyb k +x. Vrací {m, rz (poloměr u základny), osa [[x, z, r]]}. */
  const OZDOBY = {
    roh(N, L, T, ohyb, n) {
      const R = T / 2, b = [];
      for (let i = 0; i < 96; i++) { const a = 2 * Math.PI * i / 96, q = R * (1 + 0.16 * Math.cos(n * a)); b.push([q * Math.cos(a), q * Math.sin(a)]); }
      const m = N.k(N.k(new N.CS([b], 'NonZero')).extrude(L, 64, ohyb, [0.05, 0.05]));
      const osa = [0.1, 0.3, 0.5].map(f => [0, f * L, R * (1 - 0.95 * f)]);
      return { m, rz: R * 1.16, osa };
    },
    tykadla(N, L, T, ohyb, n) {
      const rb = T / 2, rr = Math.max(0.9, T * 0.15), casti = [], osa = [[0, 1, 1.5]];
      const uhly = n === 1 ? [0] : n === 2 ? [-ohyb / 2, ohyb / 2] : [-ohyb / 2, 0, ohyb / 2];
      for (const u of uhly) {
        const a = rad(u), dl = L - rb * 2.2, kon = [Math.sin(a) * dl, 0, Math.cos(a) * dl];
        const stred = [Math.sin(a) * dl * 0.5 - Math.cos(a) * dl * 0.06, 0, Math.cos(a) * dl * 0.5];
        casti.push(N.retez([[0, 0, 0, rr * 1.4], [...stred, rr], [...kon, rr * 0.9]]));
        const kap = N.rotacni([[0, -rb * Math.SQRT2], ...[...Array(13)].map((_, j) => { const t = rad(-45 + 135 * j / 12); return [rb * Math.cos(t), rb * Math.sin(t)]; })], rb);
        casti.push(N.k(kap.translate([kon[0], 0, kon[2] + rb * Math.SQRT2 - 0.4])));
      }
      return { m: N.sjednot(casti), rz: 2.2, osa };
    },
    zadna() { return { m: null, rz: 0, osa: [] }; },
  };

  /** Stavba všech dílů. volby.kalibrace = i kalibrační vzorky. Vrací {dily (sestava), tisk (díly k tisku), deleni, kalibrace, o, cas}. */
  function postav(w, p, volby = {}) {
    const t0 = Date.now(), o = odvozene(p);
    const { Manifold: M, CrossSection: CS, Mesh } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const N = {
      M, CS, Mesh, k,
      koule: (r, c) => k(k(M.sphere(r, segKoule(r))).translate(c)),
      obal: casti => k(M.hull(casti)),
      sjednot: casti => { const c = casti.filter(Boolean); return c.length === 1 ? c[0] : k(M.union(c)); },
      /** Řetěz koulí [x, y, z, r] spojených obálkami – hladká trubka proměnného průměru. */
      retez(body) {
        const koule = body.map(b => N.koule(b[3], [b[0], b[1], b[2]]));
        if (koule.length === 1) return koule[0];
        const c = [];
        for (let i = 0; i + 1 < koule.length; i++) c.push(k(M.hull([koule[i], koule[i + 1]])));
        return k(M.union(c));
      },
      rotacni: (profil, r) => k(k(new CS([profil], 'NonZero')).revolve(segmenty(r))),
      oblouk(s, L, th) {   // bod na oblouku délky L s celkovým ohybem th (rad) v rovině XZ
        if (Math.abs(th) < 1e-4) return [0, s * L];
        const R = L / th;
        return [R * (1 - Math.cos(th * s)), R * Math.sin(th * s)];
      },
    };
    const elipsa = (a, b, n = 96) => { const q = []; for (let i = 0; i < n; i++) { const t = 2 * Math.PI * i / n; q.push([a * Math.cos(t), b * Math.sin(t)]); } return q; };
    const otoc2 = (b, uh) => { const c = Math.cos(rad(uh)), s = Math.sin(rad(uh)); return b.map(([x, y]) => [x * c - y * s, x * s + y * c]); };
    try {
      /* ----- špička / špunt (u klipu na AirPods není) ----- */
      const s = p.spicka;
      let spicka = null;
      if (o.air) { /* bez špičky */ } else if (o.priruby) {
        const c = Math.min(C_KONEC, o.rs * 0.3);
        const dr = [[0, -o.Lt], [o.rs - c, -o.Lt], [o.rs, -o.Lt + c], [o.rs, -0.3], [o.rs - 0.3, 0], [0, 0]];
        const casti = [N.rotacni(dr, o.rs)];
        for (const q of o.priruby) {
          const z1 = Math.min(q.za + q.pokles, -0.05), z2 = Math.min(q.zr, 0);
          const zv = q.za - 0.25 / Math.tan(rad(s.uhel));   // vnitřní konec zapuštěný do dříku na stejné přímce
          casti.push(N.rotacni([[o.rs - 0.25, zv], [q.R, z1], [q.R, z2], [o.rs - 0.25, zv + o.tv]], q.R));
        }
        spicka = N.sjednot(casti);
      } else if (s.tvar === 'olivka') {
        const R = o.R, Re = o.Re, Rb = Math.max(o.rs + 0.4, 0.86 * R), c = C_KONEC;
        spicka = N.rotacni([[0, -o.Lt], [Re - c, -o.Lt], [Re, -o.Lt + c], [R, -o.Lt + c + (R - Re)], [R, Math.min(-(R - Rb), -o.Lt + c + (R - Re) + 0.01)], [Rb, 0], [0, 0]], R);
      } else {
        const R = o.R, Re = o.Re, c = C_KONEC;
        spicka = N.rotacni([[0, -o.Lt], [Re - c, -o.Lt], [Re, -o.Lt + c], [R, -0.6], [R - 0.6, 0], [0, 0]], R);
      }
      if (o.air) { /* bez špičky */ } else if (o.sluch) {
        const t = p.trn, hl = t.hloubka, rb = o.rb;
        let dut = [[0, 0.5], [rb + 0.4, 0.5], [rb + 0.4, 0], [rb, -0.4]];
        if (o.rl > rb) { const zt = -hl + t.lemVyska + (o.rl - rb); dut.push([rb, zt], [o.rl, zt - (o.rl - rb)], [o.rl, -hl], [0, -hl]); }
        else dut.push([rb, -hl], [0, -hl]);
        const uber = [N.rotacni(dut, o.rl || rb)];
        if (o.kanal > 0) uber.push(k(k(M.cylinder(o.Lt + 1, o.kanal, o.kanal, segmenty(o.kanal))).translate([0, 0, -o.Lt - 0.5])));
        spicka = k(M.difference([spicka, N.sjednot(uber)]));
      } else {
        const rc = o.rc, d = p.cep.delka;
        spicka = k(M.union([spicka, N.rotacni([[0, -0.5], [rc, -0.5], [rc, d - 0.4], [rc - 0.4, d], [0, d]], rc)]));
      }

      /* ----- ozdoba v kanonické soustavě ----- */
      const druh = p.ozdoba.druh, D = DRUHY[druh], mz = D.meze || {}, oo = p.ozdoba;
      const ohyb = mz.ohyb ? omez(oo.ohyb, mz.ohyb[0], mz.ohyb[1]) : oo.ohyb;
      const pocet = mz.pocet ? omez(oo.pocet, mz.pocet[0], mz.pocet[1]) : oo.pocet;
      const orn = D.model ? modelOzdoby(N, druh, oo.delka, oo.tloustka, ohyb, pocet) : OZDOBY[druh](N, oo.delka, oo.tloustka, ohyb, pocet);
      const nat = oo.natoceni;
      const Rmax = Math.max(o.Rx, o.Ry);
      const rz = orn.m ? orn.rz : Math.min(Rmax * 0.45, 4);
      const zt = o.zb + Math.max(0.6, 1.12 * Math.abs(Rmax - rz));   // přechod strmější než 45° (mnohoúhelníky obálky)
      const prechod = (zdroj, z) => k(M.hull([zdroj, k(k(k(CS.circle(Math.max(rz, 0.5), segmenty(rz))).extrude(0.4)).translate([0, 0, z]))]));

      /** Body průřezu nožičky AirPods (ovál, nebo zploštělý = superelipsa) v rovině XZ, posunuté na osu klipu. */
      /** Kapkovitý průřez čepu: kruh r + hrot −Y (stěny 45°). */
      const kapka = (r, n = 40) => {   // oblouk od −45° proti směru hodin do 225°, pak hrot (konvexní, tečny 45°)
        const q = [];
        for (let i = 0; i <= n; i++) { const t = -Math.PI / 4 + 1.5 * Math.PI * i / n; q.push([r * Math.cos(t), r * Math.sin(t)]); }
        q.push([0, -r * Math.SQRT2]);
        return q;
      };
      const prurezAP = (a, c, y, n = 64) => {
        const e = p.airpods.tvar === 'plochy' ? 2 / 3 : 1, q = [];
        for (let i = 0; i < n; i++) {
          const t = 2 * Math.PI * i / n, cs = Math.cos(t), sn = Math.sin(t);
          q.push([a * Math.sign(cs) * Math.pow(Math.abs(cs), e), y, o.zc + c * Math.sign(sn) * Math.pow(Math.abs(sn), e)]);
        }
        return q;
      };
      /** C-klip na nožičku: vnější tvar a dutina se štěrbinou (hreben = strop dutiny pro tisk s vodorovnou osou). */
      function klipKruh(hrebenNahoru) {
        const A = p.airpods, t = A.stena, L2 = A.klip / 2;
        // vnější tvar: průřez nožičky + stěna, spodní polovina se svislými boky (tisk vcelku na rtech klipu bez převisu)
        const rohy = [];
        for (const [y, q] of [[L2, o.kHor], [-L2, o.kDol]]) for (const sx of [-1, 1]) rohy.push([sx * (q[0] + t), y, o.zc], [sx * (q[0] + t), y, o.zc - o.kHor[1] - t]);
        const vnejsi = k(M.hull([...prurezAP(o.kHor[0] + t, o.kHor[1] + t, L2), ...prurezAP(o.kDol[0] + t, o.kDol[1] + t, -L2), ...rohy]));
        // dutina podle zúžené nožičky (o kousek delší, aby prošla oběma čely)
        const sk = (L2 + 0.5) / L2, body = [...prurezAP(o.kHor[0] + (o.kHor[0] - o.kDol[0]) * (sk - 1) / 2, o.kHor[1] + (o.kHor[1] - o.kDol[1]) * (sk - 1) / 2, L2 + 0.5),
          ...prurezAP(o.kDol[0] - (o.kHor[0] - o.kDol[0]) * (sk - 1) / 2, o.kDol[1] - (o.kHor[1] - o.kDol[1]) * (sk - 1) / 2, -L2 - 0.5)];
        if (hrebenNahoru) {   // celý tisk: dutina leží vodorovně → hřeben 45° nahoru místo oblouku ve stropu (seříznutý pod stěnou)
          // boky 42° od svislice tečné ke skutečnému průřezu (opěrná přímka), vršek seříznutý pod stěnou
          const b = rad(42), cR = Math.max(...body.map(q => Math.abs(q[0]) * Math.cos(b) + (q[2] - o.zc) * Math.sin(b)));
          const yt = Math.min(cR / Math.sin(b), o.kHor[1] + t - 0.8), wt = Math.max(0, (cR - yt * Math.sin(b)) / Math.cos(b));
          for (const y of [L2 + 0.5, -L2 - 0.5]) for (const sx of [-1, 1]) body.push([sx * wt, y, o.zc + yt]);
        }
        const uber = [k(M.hull(body))];
        // otevření klipu dole (k hlavě) s nálevkou pro nacvaknutí
        const ow = o.otevreni / 2, zd = o.zc - o.kHor[1] - t - 1, zh = o.zc - o.kHor[1] * 0.35;
        const nal = [];
        for (const y of [L2 + 1, -L2 - 1]) nal.push([-ow, y, zh], [ow, y, zh], [-ow - 1.2, y, zd + 0.6], [ow + 1.2, y, zd + 0.6], [-ow - 1.2, y, zd], [ow + 1.2, y, zd]);
        uber.push(k(M.hull(nal)));
        return { vnejsi, dira: N.sjednot(uber) };
      }
      function postavOzdobu(pulky) {
        const casti = [];
        let dira = null;
        if (o.air && !o.naHlave) {
          const kk = klipKruh(!pulky);
          casti.push(kk.vnejsi, prechod(kk.vnejsi, zt));
          dira = kk.dira;
        } else if (o.sluch) {
          const vn = otoc2(elipsa(o.Rx, o.Ry), -nat);
          const plast = k(k(k(new CS([vn], 'Positive')).extrude(o.zb - o.z0)).translate([0, 0, o.z0]));
          const zadek = k(k(k(new CS([vn], 'Positive')).extrude(0.01)).translate([0, 0, o.zb - 0.01]));
          casti.push(plast, prechod(zadek, zt));
          // dutina: zkosený vstup, v půlkách navíc hřebeny 45° (strop oblouku se netiskne do vzduchu)
          const body = [], pridej = (a, b, z) => { for (const [x, y] of otoc2(elipsa(a, b, 64), -nat)) body.push([x, y, z]); };
          pridej(o.a + 0.5, o.b + 0.5, o.z0 - 1); pridej(o.a + 0.5, o.b + 0.5, o.z0); pridej(o.a, o.b, o.z0 + 0.5); pridej(o.a, o.b, o.zi);
          if (pulky) {
            const c = Math.cos(rad(nat)), sn = Math.sin(rad(nat)), ey = Math.sqrt(Math.pow(o.a * sn, 2) + Math.pow(o.b * c, 2));
            // hřeben s vrcholem 1,5× poloměru (boky ~42° od svislice), seříznutý, aby neprorazil stěnu
            const hreben = (e, z) => {
              const A = 1.5 * e, yt = Math.min(A, ey + p.telo.stena - 0.8), wt = (A - yt) * Math.tan(Math.asin(1 / 1.5));
              for (const sy of [-1, 1]) for (const sx of [-1, 1]) body.push([sx * wt, sy * yt, z]);
            };
            hreben(ey + 0.5, o.z0 - 1); hreben(ey + 0.5, o.z0); hreben(ey, o.z0 + 0.5); hreben(ey, o.zi);
          }
          const uber = [k(M.hull(body))];
          if (p.telo.kabel === 'bokem') {
            const w = p.telo.kabelSirka;
            uber.push(k(k(k(M.cube([Rmax + 2, w, o.zi - o.z0 + 1])).translate([0, -w / 2, o.z0 - 1])).rotate([0, 0, -90 - nat])));
          }
          dira = N.sjednot(uber);
        } else {
          const podst = N.rotacni([[0, 0], [o.rp - 0.4, 0], [o.rp, 0.4], [o.rp, o.zb], [0, o.zb]], o.rp);
          const zadek = k(k(k(CS.circle(o.rp, segmenty(o.rp))).extrude(0.01)).translate([0, 0, o.zb - 0.01]));
          casti.push(podst, prechod(zadek, zt));
          const rd = o.rd, h = p.cep.delka + 0.3;
          if (o.naHlave) {   // kapkovitá díra (hrot k nožičce, −Y) – sedí na kapkovitý čep ramene a nepootočí se
            const b = [], kap = (r, z) => { for (const [x, y] of kapka(r)) b.push([x, y, z]); };
            kap(rd + 0.4, -1); kap(rd + 0.4, 0); kap(rd, 0.4); kap(rd, h); b.push([0, 0, h + rd * 1.15]);
            if (pulky) for (const z of [0, h]) b.push([0, rd * Math.SQRT2, z]);
            dira = k(M.hull(b));
          } else dira = N.rotacni([[0, -1], [rd + 0.4, -1], [rd + 0.4, 0], [rd, 0.4], [rd, h], [0, h + rd * 1.15]], rd + 0.4);
          if (pulky && !o.naHlave) {   // v půlkách leží díra vodorovně – hřebeny 45° místo oblouku ve stropu
            const b = [];
            for (let i = 0; i < 32; i++) { const t = 2 * Math.PI * i / 32; b.push([rd * Math.cos(t), rd * Math.sin(t), 0], [rd * Math.cos(t), rd * Math.sin(t), h]); }
            for (const sy of [-1, 1]) b.push([0, sy * rd * Math.SQRT2, 0], [0, sy * rd * Math.SQRT2, h]);
            dira = k(M.union([dira, k(M.hull(b))]));
          }
        }
        if (orn.m) casti.push(k(k(k(o.air && !o.naHlave ? orn.m.rotate([0, 0, nat]) : orn.m).translate([0, 0, zt])).trimByPlane([0, 0, 1], zt)));
        let m = k(M.difference([N.sjednot(casti), dira]));
        let koliky = [];
        if (pulky && p.tisk.kolik && !(o.air && !o.naHlave && nat)) {
          koliky = vyberKoliky(orn.osa, zt);
          if (koliky.length) m = k(M.difference([m, N.sjednot(koliky.map(q => k(k(k(M.cylinder(2 * q.hl, 1, 1, 20)).rotate([90, 0, 0])).translate([q.x, q.hl, q.z]))))]));
        }
        return { m, koliky };
      }
      function vyberKoliky(osa, z0) {
        const kand = (osa || []).filter(q => q[2] >= 2.3 && q[1] >= 1).map(q => ({ x: q[0], z: q[1] + z0, hl: Math.min(3, q[2] - 1) }));
        if (!kand.length) return [];
        const a = kand[0];
        let b = null;
        for (const q of kand) if (Math.hypot(q.x - a.x, q.z - a.z) >= 6 && (!b || Math.hypot(q.x - a.x, q.z - a.z) > Math.hypot(b.x - a.x, b.z - a.z))) b = q;
        return b ? [a, b] : [a];
      }

      const dil = (m0, jmeno, nazev, barva, material) => sit(k, m0, jmeno, nazev, barva, material);
      const spickaDil = spicka && dil(spicka, 'spicka', o.sluch ? 'Ušní špička' : 'Špunt', '#E9A23B', 'spicka');
      const cela = postavOzdobu(false);
      let klipM = null;
      if (o.naHlave) {   // klip + rameno přes hlavu + podložka + kapkovitý čep
        const A = p.airpods, R = o.rameno, w2 = R.w / 2, kk = klipKruh(false), dilky = [kk.vnejsi];
        const deska = (y, z, sx) => k(k(M.cube([2 * sx, 0.02, R.tA])).translate([-sx, y, z]));
        const d = R.ys.map((y, i) => deska(y, R.zs[i], w2));
        for (let i = 0; i + 1 < d.length; i++) dilky.push(k(M.hull([d[i], d[i + 1]])));
        // podložka (šířka 2·rp) kopíruje rameno; rozšíření z ramene pod 45°
        const yp0 = o.hlava.yc - o.rp, ya = yp0 - Math.max(0, o.rp - w2);
        dilky.push(k(M.hull([deska(ya, R.zNa(ya), w2), deska(yp0, R.zNa(yp0), o.rp)])));
        const yp = R.ys.filter(y => y > yp0 && y < o.hlava.yc + o.rp).concat(o.hlava.yc + o.rp);
        let pred = deska(yp0, R.zNa(yp0), o.rp);
        for (const y of yp) { const d2 = deska(y, R.zNa(y), o.rp); dilky.push(k(M.hull([pred, d2]))); pred = d2; }
        const prof = r => k(new CS([kapka(r)], 'Positive'));
        const cep = k(M.hull([k(k(prof(o.rc).extrude(p.cep.delka - 0.4 + 0.5)).translate([0, 0, o.zPt - 0.5])), k(k(prof(o.rc - 0.4).extrude(0.01)).translate([0, 0, o.zPt + p.cep.delka - 0.01]))]));
        dilky.push(k(cep.translate([0, o.hlava.yc, 0])));
        klipM = k(M.difference([N.sjednot(dilky), kk.dira]));
      }
      const nazevOzd = o.naHlave ? `Ozdoba – ${D.nazev.toLowerCase()}` : o.air ? `Klip – ${D.nazev.toLowerCase()}` : o.sluch ? `Pouzdro – ${D.nazev.toLowerCase()}` : `Ozdoba – ${D.nazev.toLowerCase()}`;
      const sestavaOzd = dil(o.naHlave ? k(cela.m.translate([0, o.hlava.yc, o.zPt])) : o.air ? cela.m : k(cela.m.rotate([0, 0, nat])), 'ozdoba', nazevOzd, '#4F86D9', 'ozdoba');
      const klipDil = klipM && dil(klipM, 'klip', 'Klip s ramenem', '#E9A23B', 'spicka');
      // tisk: celá nastojato nebo dvě půlky naplocho; „auto“ vybere menší plochu převisů (měřeno na síti)
      const celaTisk = [dil(cela.m, 'ozdoba', sestavaOzd.nazev, '#4F86D9', 'ozdoba')];
      let deleni = p.tisk.deleni, pulkyTisk = null, koliky = [], zahozeno = 0;
      const previs = dily => dily.reduce((a, d) => a + G.rozborTisku(G.tiskoveRozlozeni([d], 1)[0], p.tisk.uhel).previs, 0);
      const delPulky = () => {
        const pk = postavOzdobu(true);
        // řez může od ozdoby oddělit drobné úlomky (cípy natě, lístky) – ty se zahodí, aby se netiskly volně
        const [kp, kn] = pk.m.splitByPlane([0, 1, 0], 0).map(h => {
          const kusy = k(h).decompose().map(k);
          if (kusy.length < 2) return h;
          const V = kusy.reduce((a, x) => a + x.volume(), 0), velke = kusy.filter(x => x.volume() > 0.05 * V);
          zahozeno += kusy.length - velke.length;
          return velke.length === 1 ? velke[0] : k(M.union(velke));
        });
        koliky = pk.koliky;
        return [dil(k(kp.rotate([90, 0, 0])), 'ozdoba_a', sestavaOzd.nazev + ' – půlka A', '#4F86D9', 'ozdoba'),
          dil(k(kn.rotate([-90, 0, 0])), 'ozdoba_b', sestavaOzd.nazev + ' – půlka B', '#6C9BE0', 'ozdoba')];
      };
      let prevCela = null, prevPulky = null;
      if (deleni === 'auto') {
        prevCela = previs(celaTisk);
        if (prevCela > 8 && orn.m) {
          pulkyTisk = delPulky(); prevPulky = previs(pulkyTisk);
          deleni = prevPulky < prevCela * 0.6 ? 'pulky' : 'cela';
        } else deleni = 'cela';
      } else if (deleni === 'pulky') pulkyTisk = delPulky();
      const ozdTisk = deleni === 'pulky' ? pulkyTisk : celaTisk;
      if (deleni !== 'pulky') koliky = [];

      // klip s ramenem se tiskne nožičkou dolů (+Y nahoru): dutina i rameno rostou svisle
      const klipTisk = klipM && dil(k(klipM.rotate([90, 0, 0])), 'klip', 'Klip s ramenem', '#E9A23B', 'spicka');
      const prvni = spickaDil || klipTisk;
      const tisk = (prvni ? [prvni] : []).concat(ozdTisk);
      if (p.tisk.par) {
        if (prvni) tisk.push(Object.assign({}, prvni, { jmeno: prvni.jmeno + '_2', nazev: prvni.nazev + ' (druhé ucho)' }));
        for (const d of ozdTisk) tisk.push(zrcadli(d, '_L', ' (levé ucho, zrcadlově)'));
      }
      const dily = (spickaDil ? [spickaDil] : klipDil ? [klipDil] : []).concat(sestavaOzd);
      if (o.air) {   // obrys AirPods pro představu: nožička se zúžením a hlava
        const A = p.airpods, ap = AIRPODS.find(x => x.id === A.model) || AIRPODS[3];
        const [ht, hd] = [o.prurez(0), o.prurez(A.delka)];
        const nozicka = k(M.hull([...prurezAP(ht[0], ht[1], A.poloha), ...prurezAP(hd[0], hd[1], A.poloha - A.delka)]));
        const Hd = o.hlava;
        const casti = [nozicka, k(k(k(M.sphere(1, 48)).scale([Hd.hx / 2, Hd.hy / 2, Hd.hz / 2])).translate([0, Hd.yc, Hd.zc]))];
        if (ap.spicka) casti.push(k(k(k(M.cylinder(5, 4.5, 3, 32)).rotate([180, 0, 0])).translate([0, Hd.yc, Hd.zc - Hd.hz / 2 + 1.5])));
        dily.push(Object.assign(dil(N.sjednot(casti), 'sluchatko', 'AirPods (jen náhled)', '#c3c8d0', null), { duch: true }));
      } else if (o.sluch) {
        const t = p.trn, ab = otoc2(elipsa(p.telo.sirka / 2, (p.telo.tvar === 'oval' ? p.telo.vyska : p.telo.sirka) / 2), 0);
        const casti = [k(k(new CS([ab], 'Positive')).extrude(p.telo.delka)), k(k(M.cylinder(t.hloubka + 0.4, t.prumer / 2, t.prumer / 2, 40)).translate([0, 0, -t.hloubka]))];
        if (t.lem > t.prumer) casti.push(k(k(M.cylinder(t.lemVyska, t.lem / 2, t.lem / 2, 40)).translate([0, 0, -t.hloubka])));
        dily.push(Object.assign(dil(N.sjednot(casti), 'sluchatko', 'Sluchátko (jen náhled)', '#c3c8d0', null), { duch: true }));
      }
      const vysledek = { dily, tisk, deleni, koliky, zahozeno: deleni === 'pulky' ? zahozeno : 0, previsCela: prevCela, previsPulky: prevPulky, o, cas: 0 };
      if (volby.kalibrace) vysledek.kalibrace = postavKalibraci(w, p, o, N, dil);
      vysledek.cas = Date.now() - t0;
      return vysledek;
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  /** Kalibrační vzorky: kroužky na nátrubek s přesahem −0,15…+0,3 mm vedle zadaného (TPU) a kroužky pouzdra s vůlí −0,1…+0,2 (PLA).
      Počet zoubků na okraji = pořadí (1 = nejvolnější). */
  function postavKalibraci(w, p, o, N, dil) {
    const { Manifold: M, CrossSection: CS } = w, k = N.k, out = [];
    const krouzky = (rady, vnejsi, vyska, jmeno, nazev, material, profil) => {
      const casti = [];
      let x = 0, xp = 0, Rp = 0;
      rady.forEach((r, i) => {
        const R = vnejsi(r);
        if (i) x = xp + Rp + 2 + R;
        const ymax = Math.max(...profil(R).map(q => q[1]));
        const kr = k(M.difference([k(k(k(new CS([profil(R)], 'Positive')).extrude(vyska)).translate([x, 0, 0])), k(k(k(new CS([profil(r)], 'Positive')).extrude(vyska + 2)).translate([x, 0, -1]))]));
        casti.push(kr);
        for (let j = 0; j <= i; j++) casti.push(k(k(M.cube([1, 1.2, vyska + 0.8])).translate([x - 0.5 + (j - i / 2) * 1.6, ymax - 0.6, 0])));
        if (i) casti.push(k(k(M.cube([3, 1.6, 1.2])).translate([xp + Rp - 0.5, -0.8, 0])));   // můstek jen přes mezeru
        xp = x; Rp = R;
      });
      out.push(Object.assign(dil(N.sjednot(casti), jmeno, nazev, '#7fb069', material), { kalibrace: true }));
    };
    const kruh = r => { const q = []; for (let i = 0; i < 64; i++) { const t = 2 * Math.PI * i / 64; q.push([r * Math.cos(t), r * Math.sin(t)]); } return q; };
    if (o.air) {   // kroužky průřezu nožičky v místě klipu s vůlí −0,1…+0,2 (na průměr)
      const A = p.airpods, [a, c] = o.prurez(A.poloha), e = A.tvar === 'plochy' ? 2 / 3 : 1;
      const pr = r => { const q = [], sk = r / a; for (let i = 0; i < 64; i++) { const t = 2 * Math.PI * i / 64, cs = Math.cos(t), sn = Math.sin(t); q.push([a * sk * Math.sign(cs) * Math.pow(Math.abs(cs), e), c * sk * Math.sign(sn) * Math.pow(Math.abs(sn), e)]); } return q; };
      krouzky([-0.1, 0, 0.1, 0.2].map(d => a + (A.vule + d + p.vule.kompenzace) / 2), r => r + 1.4, 4, 'kal_air', 'Kalibrace – průřez nožičky', 'ozdoba', pr);
    } else if (o.sluch) {
      const offs = [-0.15, 0, 0.15, 0.3];
      krouzky(offs.map(d => o.rb - d / 2), r => r + 1.4, Math.min(5, p.trn.hloubka), 'kal_trn', 'Kalibrace – nasazení na nátrubek', 'spicka', kruh);
      const vt = [-0.1, 0, 0.1, 0.2].map(d => d / 2);
      const el = (r) => { const s = r / o.a; const q = []; for (let i = 0; i < 64; i++) { const t = 2 * Math.PI * i / 64; q.push([o.a * s * Math.cos(t), o.b * s * Math.sin(t)]); } return q; };
      krouzky(vt.map(d => o.a - p.vule.telo / 2 + d), r => r + 1.4, 4, 'kal_telo', 'Kalibrace – pouzdro na tělo', 'ozdoba', el);
    } else {
      krouzky([-0.1, 0, 0.1, 0.2].map(d => o.rd + d / 2), r => r + 1.6, p.cep.delka + 0.3, 'kal_cep', 'Kalibrace – díra pro čep', 'ozdoba', kruh);
    }
    return out;
  }

  /** Síť dílu z manifoldu: {jmeno, nazev, poz, idx, objem, teles, barva, material}. */
  function sit(k, m0, jmeno, nazev, barva, material) {
    const m = k(m0.simplify(1e-3));
    const st = m.status();
    if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
    if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
    const kusy = m.decompose().map(k);
    return { jmeno, nazev, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), teles: kusy.filter(x => x.volume() > 1e-3).length, barva, material, otocit: false };
  }
  /** Zrcadlový díl (x → −x) s obráceným pořadím vrcholů trojúhelníků. */
  function zrcadli(d, pripona, text) {
    const poz = new Float32Array(d.poz), idx = new Uint32Array(d.idx.length);
    for (let i = 0; i < poz.length; i += 3) poz[i] = -poz[i];
    for (let t = 0; t < idx.length; t += 3) { idx[t] = d.idx[t]; idx[t + 1] = d.idx[t + 2]; idx[t + 2] = d.idx[t + 1]; }
    return Object.assign({}, d, { poz, idx, jmeno: d.jmeno + pripona, nazev: d.nazev + text });
  }

  /** Objem a těžiště sítě (součet čtyřstěnů k počátku). */
  function teziste(d) {
    const P = d.poz, I = d.idx;
    let V = 0, cx = 0, cy = 0, cz = 0;
    for (let t = 0; t < I.length; t += 3) {
      const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
      const v = (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
      V += v; cx += v * (P[a] + P[b] + P[c]) / 4; cy += v * (P[a + 1] + P[b + 1] + P[c + 1]) / 4; cz += v * (P[a + 2] + P[b + 2] + P[c + 2]) / 4;
    }
    return { V, x: cx / V, y: cy / V, z: cz / V };
  }
  /** Páka ozdoby na ucho: hmotnost (g, s výplní), těžiště od čela (mm), moment tíhy (mN·m) – hrubý odhad. */
  function paka(p, model) {
    const oz = model.dily.find(d => d.jmeno === 'ozdoba'), t = teziste(oz), mat = MATERIALY[p.tisk.material];
    const f = Math.min(1, 0.45 + 0.55 * p.tisk.vypln / 100);
    const g = t.V / 1000 * mat.hustota * f;
    const rameno = Math.hypot(t.z, 0);
    return { g, gPlny: t.V / 1000 * mat.hustota, rameno, moment: g / 1000 * 9.81 * rameno, teziste: t };
  }

  function kontrolyModelu(p, model) {
    const H = [];
    for (const d0 of model.tisk.concat(model.kalibrace || [])) {
      if (/_L$|_2$/.test(d0.jmeno)) continue;
      if (d0.teles > 1) H.push({ uroven: 'chyba', pole: ['ozdoba.delka'], text: `${d0.nazev}: díl se rozpadl na ${d0.teles} tělesa – některá část ozdoby není spojená (zkuste jinou délku, ohyb nebo tloušťku).` });
      const d = G.tiskoveRozlozeni([d0], 1)[0], r = G.rozborTisku(d, p.tisk.uhel);
      if (r.previs > 2 && r.previs <= 8) H.push({ uroven: 'info', pole: null, text: `${d0.nazev}: drobné převisy ${fmt(r.previs, 0)} mm² (drobné detaily) – vytisknou se bez podpor.` });
      if (r.previs > 8) H.push({ uroven: 'varovani', pole: ['tisk.deleni'], text: `${d0.nazev}: převisy nad ${fmt(p.tisk.uhel)}° od svislice ${fmt(r.previs, 0)} mm² – ${d0.material === 'ozdoba' && model.deleni === 'cela' ? 'zkuste tisk na dvě půlky, nebo zapněte podpory' : 'zapněte ve sliceru podpory jen u podložky'}.` });
      if (r.most > 2) H.push({ uroven: 'info', pole: null, text: `${d0.nazev}: tiskárna přemostí ${fmt(r.most, 0)} mm² vodorovného stropu.` });
    }
    if (model.deleni === 'pulky') {
      H.push({ uroven: 'info', pole: ['tisk.deleni'], text: `Ozdoba se tiskne na dvě půlky naplocho${model.koliky.length ? ` – ${model.koliky.length} ${model.koliky.length === 1 ? 'kolík' : 'kolíky'} z filamentu 1,75 mm, délka ${fmt(2 * Math.min(...model.koliky.map(q => q.hl)) - 0.4, 1)} mm` : ''}; slepte vteřinovým lepidlem.` });
      if (model.zahozeno) H.push({ uroven: 'info', pole: ['tisk.deleni'], text: `Řez na půlky oddělil ${model.zahozeno} ${model.zahozeno === 1 ? 'drobný úlomek' : model.zahozeno < 5 ? 'drobné úlomky' : 'drobných úlomků'} (méně než 5 % objemu) – v půlkách vynechány.` });
      if (p.tisk.kolik && !model.koliky.length) H.push({ uroven: 'info', pole: ['ozdoba.tloustka'], text: 'Ozdoba je na kolíky z filamentu příliš tenká – půlky jen slepte.' });
    }
    const pk = paka(p, model);
    if (pk.moment > 1.2) H.push({ uroven: 'varovani', pole: ['ozdoba.delka', 'tisk.vypln'], text: `Ozdoba páčí sluchátko z ucha momentem ≈ ${fmt(pk.moment, 1)} mN·m (${fmt(pk.g, 1)} g, těžiště ${fmt(pk.rameno, 0)} mm od ${model.o.air ? 'klipu' : 'ucha'}) – zkraťte ji, snižte výplň${model.o.air ? '' : ' nebo dejte trojitou přírubu'}.` });
    return H;
  }

  const API = {
    MATERIALY, DRUHY, SLUCHATKA, AIRPODS, NAZVY, VYCHOZI, MEZE, VYCTY, PREDVOLBY, OZDOBY,
    normalizuj, predvolba, prepniDruh, chybiTvar, tvar, nastavAirpods, nastavSluchatko, popis, ulozProjekt, nactiProjekt, odvozene, kontroly,
    postav, kontrolyModelu, teziste, paka, zrcadli, kopie, vezmi: G.vezmi, poloz: G.poloz, fmt, segmenty,
  };
  if (uzel) module.exports = API; else window.SLUCH = API;
})();

/* ============================================================
   Srdce hory – stavby.js: stavby, dílny, zóny a recepty.

   Stavba začíná jako plán. Trpaslíci na místo donesou materiál
   (skutečné věci ze skladu nebo ze země), pak ji postaví.
   Zóny: sklady (s filtrem druhu věcí) a místnosti (ložnice, jídelna).
   Čistá logika bez DOM.
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const { W, H, M, O, pevne } = T.hora;
  const C = T.cesty;
  const N = W * H;

  // kód stavby v poli hra.stavba
  const K = { NIC: 0, PODPERA: 1, DVERE: 2, LOUC: 3, DILNA: 4, POSTEL: 5, STUL: 6, ZIDLE: 7, SOCHA: 8, PUMPA: 9, PAST: 10, MRIZ: 11, STUDNA: 12 };
  // misto: 'volno' = jakékoli volné pole, 'podlaha' = volné pole s pevnou zemí pod sebou
  const STAVBY = {
    zebrik:     { nazev: 'žebřík', ikona: '🪜', mat: { drevo: 1 }, doba: 25, misto: 'volno', svisle: true,
                  popis: 'Svislá cesta nahoru i dolů – i do šachty, kterou už někdo vykopal.' },
    vytah:      { nazev: 'výtah', ikona: '🛗', mat: { drevo: 1 }, doba: 35, misto: 'volno', vyzaduje: 'tesarna', naLezu: true, svisle: true,
                  popis: 'Plošina na rumpálu ve svislé šachtě – nahoru i dolů mnohem rychleji než po schodech nebo žebříku (pole za tah místo za 6). Stav ho do šachty pole po poli (táhni svisle) – i přes schody a žebřík (nahradí je) nebo do skály (šachta se nejdřív vytesá); vystupuje se na koncích a všude, kde je vedle šachty podlaha.' },
    studna:     { nazev: 'studna', ikona: '🪣', mat: { kamen: 4, drevo: 1 }, doba: 60, misto: 'voda', sirka: 2, kod: K.STUDNA, neniDilna: true, uVody: true,
                  popis: 'Kamenná roubená studna na dvou polích s vodou vedle sebe. Vodu v nich zadrží (neodteče, nezamrzne, pumpa ji nevyčerpá) a trpaslíci se z ní napijí, kdykoli je blíž než pivo – čistá voda ze studny kazí náladu méně než voda z jezírka.' },
    podpera:    { nazev: 'podpěra', ikona: '🪵', mat: { drevo: 1 }, doba: 30, misto: 'volno', kod: K.PODPERA,
                  popis: 'Trám pod strop síně. Síň vysoká 3+ pole potřebuje podpěru aspoň každých N polí (hlína 3, vápenec 5, žula 9). Jde naplánovat i do pole označeného ke kopání.' },
    dvere:      { nazev: 'dveře', ikona: '🚪', mat: { drevo: 1 }, doba: 35, misto: 'podlaha', kod: K.DVERE,
                  popis: 'Trpaslíci projdou; voda, magma ani netvoři ne (goblini je ale umí vyrazit).' },
    mriz:       { nazev: 'padací mříž', ikona: '🚧', mat: { prut_zelezo: 2 }, doba: 50, misto: 'volno', kod: K.MRIZ,
                  popis: 'Klepni na ni a zavři ji: pak neprojde nikdo – ani trpaslíci.' },
    past:       { nazev: 'past', ikona: '🪤', mat: { kamen: 2, prut_zelezo: 1 }, doba: 40, misto: 'podlaha', kod: K.PAST,
                  popis: 'Netvor, který na ni šlápne, dostane ránu. Za půl minuty se sama napne.' },
    pumpa:      { nazev: 'ruční pumpa', ikona: '⛲', mat: { drevo: 3 }, doba: 50, misto: 'volno', kod: K.PUMPA, naLezu: true,
                  popis: 'Trpaslík u ní odčerpává vodu do 3 polí okolo – na zatopené chodby a šachty (jde postavit i na schod či žebřík; pod pumpu v šachtě jde žebřík i dodatečně).' },
    louc:       { nazev: 'louč', ikona: '🔥', mat: { drevo: 1 }, doba: 12, misto: 'volno', kod: K.LOUC,
                  popis: 'Světlo na zdi. Temné chodby budou kazit náladu.' },
    zed:        { nazev: 'kamenná zeď', ikona: '🧱', mat: { kamen: 1 }, doba: 40, misto: 'volno',
                  popis: 'Zazdí volné pole – oprava přehnaného kopání.' },
    tesarna:    { nazev: 'tesařská dílna', ikona: '🪚', mat: { drevo: 3 }, doba: 80, misto: 'podlaha', sirka: 2, kod: K.DILNA,
                  popis: 'Ze dřeva vyrábí postele, stoly a židle. Pracuje v ní tesař.' },
    kamenictvi: { nazev: 'kamenická dílna', ikona: '🪨', mat: { kamen: 3 }, doba: 80, misto: 'podlaha', sirka: 2, kod: K.DILNA,
                  popis: 'Z kamene tesá stoly, židle a sochy. Pracuje v ní kameník.' },
    kuchyne:    { nazev: 'kuchyně', ikona: '🍲', mat: { drevo: 2 }, doba: 80, misto: 'podlaha', sirka: 2, kod: K.DILNA,
                  popis: 'Z hub a ječmene vaří jídlo. Vaří farmář. Sama udržuje zásobu jídla.' },
    pivovar:    { nazev: 'pivovar', ikona: '🍺', mat: { drevo: 3 }, doba: 80, misto: 'podlaha', sirka: 2, kod: K.DILNA,
                  popis: 'Z ječmene nebo hub vaří pivo. Vaří sládek. Sám udržuje zásobu piva.' },
    milir:      { nazev: 'milíř', ikona: '♨️', mat: { drevo: 2 }, doba: 60, misto: 'podlaha', sirka: 2, kod: K.DILNA,
                  popis: 'Ze dvou polen pálí dřevěné uhlí. Obslouží ho kdokoli.' },
    tavirna:    { nazev: 'tavírna', ikona: '🔥', mat: { kamen: 3 }, doba: 90, misto: 'podlaha', sirka: 2, kod: K.DILNA,
                  popis: 'Z rudy a uhlí taví pruty kovu. Taví kovář.' },
    kovarna:    { nazev: 'kovárna', ikona: '⚒️', mat: { kamen: 3 }, doba: 90, misto: 'podlaha', sirka: 2, kod: K.DILNA,
                  popis: 'Z prutů kove krumpáče, sekery a kladiva. Kove kovář.' },
    brusirna:   { nazev: 'brusírna', ikona: '💎', mat: { kamen: 2 }, doba: 70, misto: 'podlaha', sirka: 2, kod: K.DILNA,
                  popis: 'Brousí drahokamy, dělá šperky a poháry. Brousí kameník.' },
    magmovyhen: { nazev: 'magmatická výheň', ikona: '🌋', mat: { kamen: 4 }, doba: 100, misto: 'podlaha', sirka: 2, kod: K.DILNA, uMagmatu: true,
                  popis: 'Stojí do 3 polí od magmatu a taví i kove bez uhlí. Kove kovář.' },
    zbrojnice:  { nazev: 'zbrojnice', ikona: '🛡️', mat: { kamen: 2, drevo: 2 }, doba: 80, misto: 'podlaha', sirka: 2, kod: K.DILNA,
                  popis: 'Strážci tu cvičí, když není s kým bojovat.' },
    runova_kovarna: { nazev: 'runová kovárna', ikona: '✴️', mat: { kamen: 4, prut_zlato: 2 }, doba: 120, misto: 'podlaha', sirka: 2, kod: K.DILNA, runy: true,
                  popis: 'Taví hvězdnou rudu a kove artefakty předků. Odemkne ji runová deska v ruinách. Kove kovář.' },
    postel:     { nazev: 'postel', ikona: '🛏️', mat: { postel: 1 }, doba: 20, misto: 'podlaha', kod: K.POSTEL, nabytek: true,
                  popis: 'Patří do ložnice.' },
    stul:       { nazev: 'stůl', ikona: '🍽️', mat: { stul: 1 }, doba: 20, misto: 'podlaha', kod: K.STUL, nabytek: true,
                  popis: 'Patří do jídelny.' },
    zidle:      { nazev: 'židle', ikona: '🪑', mat: { zidle: 1 }, doba: 15, misto: 'podlaha', kod: K.ZIDLE, nabytek: true,
                  popis: 'Patří do jídelny ke stolu.' },
    socha:      { nazev: 'socha', ikona: '🗿', mat: { socha: 1 }, doba: 25, misto: 'podlaha', kod: K.SOCHA, nabytek: true,
                  popis: 'Ozdoba síně. Trpaslíci mají rádi krásný kámen.' },
  };
  // skupiny v paletě stavění (pořadí = pořadí v paletě)
  const SKUPINY_STAVEB = [
    { nazev: 'Chodby a šachty', ikona: '🪜', typy: ['zebrik', 'vytah', 'podpera', 'louc', 'pumpa', 'zed'] },
    { nazev: 'Jídlo a pití', ikona: '🍲', typy: ['kuchyne', 'pivovar', 'studna'] },
    { nazev: 'Nábytek', ikona: '🛏️', typy: ['postel', 'stul', 'zidle', 'socha'] },
    { nazev: 'Řemeslné dílny', ikona: '🪚', typy: ['tesarna', 'kamenictvi', 'brusirna'] },
    { nazev: 'Kovy a oheň', ikona: '⚒️', typy: ['milir', 'tavirna', 'kovarna', 'magmovyhen', 'runova_kovarna'] },
    { nazev: 'Obrana', ikona: '🛡️', typy: ['dvere', 'mriz', 'past', 'zbrojnice'] },
  ];
  const KOD_TYP = {};
  for (const [typ, d] of Object.entries(STAVBY)) if (d.kod && (!d.sirka || d.neniDilna)) KOD_TYP[d.kod] = typ;

  // recepty dílen: výrobek, materiály (seznam kusů), doba v tazích, kolik kusů vznikne, materiál výrobku
  const RECEPTY = {
    // ječmen je vydatnější: z kusu 2 porce / 2 piva, z hub jen 1 (houbové pivo je navíc slabší – menší radost)
    kuchyne: [
      { vyrobek: 'jidlo', mat: ['houby'], doba: 30, pocet: 1, nazev: 'houbový guláš' },
      { vyrobek: 'jidlo', mat: ['jecmen'], doba: 50, pocet: 2, nazev: 'ječný chléb' },
    ],
    pivovar: [
      { vyrobek: 'pivo', mat: ['jecmen'], doba: 60, pocet: 2, vmat: 'jecmen', nazev: 'ječné pivo' },
      { vyrobek: 'pivo', mat: ['houby'], doba: 40, pocet: 1, vmat: 'houby', nazev: 'houbové pivo' },
    ],
    tesarna: [
      { vyrobek: 'postel', mat: ['drevo'], doba: 60, vmat: 'drevo' },
      { vyrobek: 'stul', mat: ['drevo'], doba: 50, vmat: 'drevo' },
      { vyrobek: 'zidle', mat: ['drevo'], doba: 40, vmat: 'drevo' },
    ],
    kamenictvi: [
      { vyrobek: 'stul', mat: ['kamen'], doba: 70, vmat: 'kamen' },
      { vyrobek: 'zidle', mat: ['kamen'], doba: 60, vmat: 'kamen' },
      { vyrobek: 'socha', mat: ['kamen'], doba: 120, vmat: 'kamen' },
    ],
    milir: [
      { vyrobek: 'uhli', mat: ['drevo', 'drevo'], doba: 90, pocet: 2, nazev: 'dřevěné uhlí' },
    ],
    tavirna: [
      { vyrobek: 'prut_zelezo', mat: ['zelezo', 'uhli'], doba: 80 },
      { vyrobek: 'prut_med', mat: ['med', 'uhli'], doba: 70 },
      { vyrobek: 'prut_stribro', mat: ['stribro', 'uhli'], doba: 80 },
      { vyrobek: 'prut_zlato', mat: ['zlato', 'uhli'], doba: 80 },
    ],
    kovarna: [
      { vyrobek: 'krumpac', mat: ['prut_zelezo', 'uhli'], doba: 90, vmat: 'zelezo', nazev: 'železný krumpáč' },
      { vyrobek: 'krumpac', mat: ['prut_med', 'uhli'], doba: 80, vmat: 'med', nazev: 'měděný krumpáč' },
      { vyrobek: 'sekera', mat: ['prut_zelezo', 'uhli'], doba: 80, vmat: 'zelezo', nazev: 'železná sekera' },
      { vyrobek: 'kladivo', mat: ['prut_zelezo', 'uhli'], doba: 80, vmat: 'zelezo', nazev: 'železné kladivo' },
      { vyrobek: 'kladivo', mat: ['prut_med', 'uhli'], doba: 70, vmat: 'med', nazev: 'měděné kladivo' },
    ],
    brusirna: [
      { vyrobek: 'brus', mat: ['drahokam'], doba: 100, nazev: 'broušený drahokam' },
      { vyrobek: 'sperk', mat: ['prut_zlato', 'drahokam'], doba: 140 },
      { vyrobek: 'pohar', mat: ['prut_stribro'], doba: 110 },
    ],
  };
  RECEPTY.zbrojnice = [];
  RECEPTY.runova_kovarna = [
    { vyrobek: 'prut_hvezdny', mat: ['hvezdna', 'uhli'], doba: 120, nazev: 'hvězdná ocel' },
    { vyrobek: 'art_kladivo', mat: ['prut_hvezdny', 'prut_hvezdny', 'prut_zelezo'], doba: 240, nazev: 'Durinovo kladivo' },
    { vyrobek: 'art_lampa', mat: ['prut_hvezdny', 'prut_hvezdny', 'brus'], doba: 240, nazev: 'Lampa předků' },
    { vyrobek: 'art_roh', mat: ['prut_hvezdny', 'prut_hvezdny', 'pohar'], doba: 240, nazev: 'Roh hory' },
    { vyrobek: 'art_klic', mat: ['prut_hvezdny', 'prut_hvezdny', 'prut_hvezdny', 'sperk'], doba: 300, nazev: 'Klíč k Srdci' },
  ];
  RECEPTY.kovarna.push(
    { vyrobek: 'valecna_sekera', mat: ['prut_zelezo', 'prut_zelezo', 'uhli'], doba: 110, vmat: 'zelezo', nazev: 'válečná sekera' },
    { vyrobek: 'zbroj', mat: ['prut_zelezo', 'prut_zelezo', 'prut_zelezo', 'uhli'], doba: 140, vmat: 'zelezo', nazev: 'železná zbroj' },
    { vyrobek: 'zbroj', mat: ['prut_med', 'prut_med', 'prut_med', 'uhli'], doba: 120, vmat: 'med', nazev: 'měděná zbroj' });
  RECEPTY.magmovyhen = [
    { vyrobek: 'prut_zelezo', mat: ['zelezo'], doba: 60 },
    { vyrobek: 'prut_med', mat: ['med'], doba: 50 },
    { vyrobek: 'prut_stribro', mat: ['stribro'], doba: 60 },
    { vyrobek: 'prut_zlato', mat: ['zlato'], doba: 60 },
    { vyrobek: 'krumpac', mat: ['prut_zelezo'], doba: 70, vmat: 'zelezo', nazev: 'železný krumpáč' },
    { vyrobek: 'sekera', mat: ['prut_zelezo'], doba: 60, vmat: 'zelezo', nazev: 'železná sekera' },
    { vyrobek: 'kladivo', mat: ['prut_zelezo'], doba: 60, vmat: 'zelezo', nazev: 'železné kladivo' },
    { vyrobek: 'valecna_sekera', mat: ['prut_zelezo', 'prut_zelezo'], doba: 90, vmat: 'zelezo', nazev: 'válečná sekera' },
    { vyrobek: 'zbroj', mat: ['prut_zelezo', 'prut_zelezo', 'prut_zelezo'], doba: 110, vmat: 'zelezo', nazev: 'železná zbroj' },
  ];
  // kolik kusů kterého materiálu recept potřebuje
  function materialReceptu(rc) { const m = {}; for (const d of rc.mat) m[d] = (m[d] || 0) + 1; return m; }
  // nástroje: co zrychlují a jak moc (podle kovu), opotřebení za jedno použití (ze 100)
  const NASTROJE = {
    krumpac: { prace: ['kopat'], zelezo: 1.6, med: 1.35 },
    sekera:  { prace: ['kacet'], zelezo: 2.0, med: 1.6 },
    kladivo: { prace: ['stavet', 'vyrobit'], zelezo: 1.4, med: 1.25 },
  };
  const OPOTREBENI = { zelezo: 1.5, med: 2.5 };
  const PREFERUJE = { hornik: 'krumpac', strazce: 'krumpac', tesar: 'sekera', farmar: 'sekera', kamenik: 'kladivo', kovar: 'kladivo', sladek: 'kladivo' };
  const PROFESE_DILNY = { tesarna: 'tesar', kamenictvi: 'kamenik', kuchyne: 'farmar', pivovar: 'sladek',
                          tavirna: 'kovar', kovarna: 'kovar', brusirna: 'kamenik', milir: null, magmovyhen: 'kovar', zbrojnice: null, runova_kovarna: 'kovar' };
  const OHNIVE_DILNY = ['kuchyne', 'tavirna', 'kovarna', 'milir', 'magmovyhen', 'runova_kovarna'];       // svítí
  // dílny, které si při postavení samy nastaví trvalé zakázky (recept, udržovat zásobu)
  const VYCHOZI_ZAKAZKY = { kuchyne: [[0, 20], [1, 20]], pivovar: [[0, 20], [1, 20]] };

  // skupiny věcí pro filtr skladu
  const SKUPINY = {
    vse:     { nazev: 'vše', ikona: '📦' },
    kamen:   { nazev: 'kámen a jíl', ikona: '🪨', druhy: ['kamen', 'jil'] },
    rudy:    { nazev: 'uhlí, rudy a drahokamy', ikona: '⛏️', druhy: ['uhli', 'zelezo', 'med', 'stribro', 'zlato', 'drahokam', 'hvezdna'] },
    drevo:   { nazev: 'dřevo', ikona: '🪵', druhy: ['drevo'] },
    vyrobky: { nazev: 'nábytek', ikona: '🪑', druhy: ['postel', 'stul', 'zidle', 'socha'] },
    jidlo:   { nazev: 'jídlo a pití', ikona: '🍖', druhy: ['jidlo', 'pivo', 'houby', 'jecmen'] },
    kov:     { nazev: 'kovy, nástroje a zbraně', ikona: '⚒️', druhy: ['prut_zelezo', 'prut_med', 'prut_stribro', 'prut_zlato', 'krumpac', 'sekera', 'kladivo', 'valecna_sekera', 'zbroj'] },
    cennosti:{ nazev: 'cennosti a kořist', ikona: '💍', druhy: ['brus', 'sperk', 'pohar', 'hedvabi', 'cepel', 'prut_hvezdny', 'klic'] },
  };
  const ZONY = {
    sklad:   { nazev: 'sklad', ikona: '📦', barva: 'rgba(214,168,42,', popis: 'Sem trpaslíci nosí věci. Filtr určí, co sklad přijímá.' },
    loznice: { nazev: 'ložnice', ikona: '🛏️', barva: 'rgba(90,140,230,', popis: 'Postele pro spánek. Spánek v posteli je rychlejší a zlepší náladu.' },
    jidelna: { nazev: 'jídelna', ikona: '🍽️', barva: 'rgba(110,190,90,', popis: 'Stoly a židle pro společné jídlo. Jídlo u stolu zlepší náladu.' },
    pole:    { nazev: 'pole ječmene', ikona: '🌾', barva: 'rgba(220,200,90,', popis: 'Venku na hlíně. Ječmen dozraje zhruba za dva dny (v zimě neroste), každé pole dá 2 snopy – snop je 2 porce jídla nebo 2 dobrá piva.' },
    houbarna:{ nazev: 'houbárna', ikona: '🍄', barva: 'rgba(170,110,210,', popis: 'Pod zemí na pevné podlaze. Houby dorostou za 2–3 dny (u vody rychleji, mělko pod povrchem v zimě pomalu), každé pole dá 1 houbu.' },
    les:     { nazev: 'lesní školka', ikona: '🌲', barva: 'rgba(60,150,80,', popis: 'Venku na hlíně. Farmáři sázejí stromky, za pár dní z nich jsou jedle; když dřevo dochází, sami je pokácí (pařez zase doroste).' },
    osetrovna:{ nazev: 'ošetřovna', ikona: '🩹', barva: 'rgba(230,90,90,', popis: 'Postele pro zraněné: v ní se hojí třikrát rychleji. Zraněný trpaslík (zdraví pod 60) si sem jde lehnout.' },
  };
  const FARMY = { pole: 'jecmen', houbarna: 'houby', les: 'drevo' };
  // Farmy pracují jen do zásoby: dokud je plodiny (všech kusů v hoře) méně než cíl zóny, sklízí se; jinak zralá úroda
  // čeká na poli (nic se nenosí). z.cil = číslo nastavené hráčem, bez něj automaticky podle velikosti klanu.
  const CIL_FARMY = { houby: n => Math.max(12, 5 * n), jecmen: n => Math.max(12, 5 * n), drevo: n => Math.max(15, 10 + n) };
  function cilFarmy(hra, z) {
    const plodina = FARMY[z.typ]; if (!plodina) return null;
    const auto = z.cil === undefined || z.cil === null;
    return { plodina, cil: auto ? CIL_FARMY[plodina](hra.trpaslici.length) : z.cil, auto };
  }
  function nastavCilFarmy(z, n) {                    // n = cílová zásoba (0 = nesklízet), null = automaticky
    if (n === null || n === undefined || !(n >= 0)) delete z.cil; else z.cil = Math.min(9999, Math.round(n));
  }
  const MAX_NA_POLI = 4;                        // věcí na jedno pole skladu

  // --- zóny -------------------------------------------------------------------------
  const zonaNa = (hra, i) => hra.zona[i] ? hra.zony.find(z => z.id === hra.zona[i]) : null;
  function jeSklad(hra, i) { const z = zonaNa(hra, i); return !!z && z.typ === 'sklad'; }
  function prijme(hra, i, druh) {
    const z = zonaNa(hra, i);
    if (!z || z.typ !== 'sklad') return false;
    return prijimaneDruhy(z).has(druh);
  }
  // Filtr skladu: vlastní seznam druhů (z.filtr), jinak skupina (z.druh, starší uložení) nebo vše.
  const DRUHY_SKLADU = Object.keys(SKUPINY).filter(k => k !== 'vse').flatMap(k => SKUPINY[k].druhy);
  // Množina se pamatuje u zóny (WeakMap – do uložení se nedostane) a platí, dokud se nezmění z.filtr ani z.druh.
  const prijimaneCache = new WeakMap();
  function prijimaneDruhy(z) {
    const c = prijimaneCache.get(z);
    if (c && c.filtr === z.filtr && c.druh === z.druh) return c.set;
    let set;
    if (Array.isArray(z.filtr)) set = new Set(z.filtr);
    else if (z.druh && z.druh !== 'vse' && SKUPINY[z.druh]) set = new Set(SKUPINY[z.druh].druhy);
    else set = new Set(DRUHY_SKLADU);
    prijimaneCache.set(z, { filtr: z.filtr, druh: z.druh, set });
    return set;
  }
  function nastavFiltr(z, druhy) {                   // druhy: pole druhů (null / všechny = vše)
    prijimaneCache.delete(z);                        // UI si vrácenou množinu upravuje – pak ji zahodit
    const set = new Set(druhy || DRUHY_SKLADU);
    if (DRUHY_SKLADU.every(d => set.has(d))) { delete z.filtr; z.druh = 'vse'; return; }
    z.filtr = DRUHY_SKLADU.filter(d => set.has(d)); z.druh = 'vlastni';
  }
  function lzeZona(hra, i, typ) {
    if (hra.hora.teren[i] !== M.VZDUCH || !hra.znamo[i]) return false;
    const venku = hra.hora.pozadi[i] === M.VZDUCH, pod = hra.hora.teren[i + W];
    if (typ === 'pole') return venku && (pod === M.HLINA || pod === M.JIL) && !hra.lez[i] && !hra.stavba[i] &&
      hra.hora.obj[i] !== O.STROM && hra.hora.obj[i] !== O.BALVAN && hra.hora.obj[i] !== O.PAREZ;
    if (typ === 'les') return venku && (pod === M.HLINA || pod === M.JIL) && !hra.lez[i] && !hra.stavba[i] && hra.hora.obj[i] !== O.BALVAN;
    if (venku && typ !== 'sklad') return false;                       // místnost a houbárna jen pod zemí
    if (typ === 'houbarna') return pevne(pod) && !hra.lez[i] && !hra.stavba[i];
    return typ !== 'sklad' || C.stojne(hra, i);
  }
  function novaZona(hra, x0, y0, x1, y1, typ, druh) {
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (y0 > y1) [y0, y1] = [y1, y0];
    const bunky = [];
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
      const i = y * W + x;
      if (!hra.zona[i] && lzeZona(hra, i, typ)) bunky.push(i);
    }
    if (!bunky.length) return null;
    let id = 1;
    const pouzite = new Set(hra.zony.map(z => z.id));
    while (pouzite.has(id)) id++;
    if (id > 250) return null;
    const z = { id, typ, druh: typ === 'sklad' ? (druh || 'vse') : null };
    hra.zony.push(z);
    for (const i of bunky) { hra.zona[i] = id; if (FARMY[typ] && hra.hora.obj[i] === O.TRAVA) hra.hora.obj[i] = 0; }
    return z;
  }
  function zrusZonu(hra, x0, y0, x1, y1) {
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (y0 > y1) [y0, y1] = [y1, y0];
    let n = 0;
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
      const i = y * W + x;
      if (hra.zona[i]) { hra.zona[i] = 0; n++; }
    }
    uklidZony(hra);
    return n;
  }
  function uklidZony(hra) {
    const ziva = new Set();
    for (let i = 0; i < N; i++) if (hra.zona[i]) ziva.add(hra.zona[i]);
    hra.zony = hra.zony.filter(z => ziva.has(z.id));
  }
  function bunkyZony(hra, id) { const b = []; for (let i = 0; i < N; i++) if (hra.zona[i] === id) b.push(i); return b; }
  // co je v místnosti za nábytek
  function vybaveni(hra, id) {
    const v = { postel: 0, stul: 0, zidle: 0, socha: 0, polí: 0 };
    for (let i = 0; i < N; i++) {
      if (hra.zona[i] !== id) continue;
      v.polí++;
      const typ = KOD_TYP[hra.stavba[i]];
      if (typ && v[typ] !== undefined) v[typ]++;
    }
    return v;
  }

  // Kvalita místnosti pro náladu: podíl otesaných stěn (pozadí zeď/zdivo/runy), sochy, kamenný nábytek.
  const OTESANE_POZADI = [M.ZED, M.CIHLA, M.RUNA];
  function kvalitaZony(hra, id) {
    const k = { polí: 0, otesano: 0, sochy: 0, kamen: 0, nabytek: 0, postele: 0, stoly: 0 };
    for (let i = 0; i < N; i++) {
      if (hra.zona[i] !== id) continue;
      k.polí++;
      if (OTESANE_POZADI.includes(hra.hora.pozadi[i])) k.otesano++;
      const typ = KOD_TYP[hra.stavba[i]];
      if (typ === 'socha') k.sochy++;
      else if (typ === 'postel') k.postele++;
      else if (typ === 'stul') k.stoly++;
      if (typ && STAVBY[typ].nabytek) { k.nabytek++; if (hra.materialNa.get(i) === 'kamen') k.kamen++; }
    }
    k.podilZdi = k.polí ? k.otesano / k.polí : 0;
    return k;
  }

  // --- plány staveb -------------------------------------------------------------------
  function bunkyPlanu(typ, i) {
    const d = STAVBY[typ], b = [i];
    for (let k = 1; k < (d.sirka || 1); k++) b.push(i + k);
    return b;
  }
  // Hotový nábytek ze skladu se sám rozmístí do své zóny (postele do ložnice, stoly a židle do jídelny):
  // na každý kus, který ještě nemá plán, se naplánuje stavba na první volné místo zóny (židle přednostně ke stolu).
  const NABYTEK_ZONY = { postel: 'loznice', stul: 'jidelna', zidle: 'jidelna' };
  // postele jdou nejdřív do ošetřovny (stačí jí pár), pak do ložnic
  const DALSI_ZONY = { postel: ['osetrovna'] };
  function rozmistiNabytek(hra) {
    for (const [druh, typZony0] of Object.entries(NABYTEK_ZONY)) for (const typZony of (DALSI_ZONY[druh] || []).concat(typZony0)) {
      let volnych = hra.veci.filter(v => v.druh === druh).length - hra.plany.filter(p => p.typ === druh).length;
      if (volnych <= 0) continue;
      if (typZony === 'osetrovna') {                 // ošetřovně stačí pár postelí (pětina klanu, aspoň 2)
        if (!hra.zony.some(z => z.typ === 'osetrovna')) continue;
        let maji = 0;
        for (let i = 0; i < N; i++) { const z = hra.zona[i] && zonaNa(hra, i); if (z && z.typ === 'osetrovna' && (hra.stavba[i] === K.POSTEL || (hra.planNa.has(i) && planPodle(hra, hra.planNa.get(i)).typ === 'postel'))) maji++; }
        volnych = Math.min(volnych, Math.max(2, Math.ceil(hra.trpaslici.length / 5)) - maji);
        if (volnych <= 0) continue;
      }
      const stulU = i => [i - 1, i + 1].some(j => hra.stavba[j] === K.STUL || (hra.planNa.has(j) && planPodle(hra, hra.planNa.get(j)).typ === 'stul'));
      for (const z of hra.zony) {
        if (z.typ !== typZony || volnych <= 0) continue;
        let bunky = bunkyZony(hra, z.id).filter(i => !hra.planNa.has(i) && !hra.stavba[i] && !prekazka(hra, druh, i));
        if (druh === 'zidle') bunky = bunky.filter(stulU).concat(bunky.filter(i => !stulU(i)));
        for (const i of bunky) {
          if (volnych <= 0) break;
          if (hra.planNa.has(i) || prekazka(hra, druh, i)) continue;
          if (naplanuj(hra, druh, i)) volnych--;
        }
      }
    }
  }

  // Proč stavbu teď nejde vůbec postavit (null = jde; chybějící materiál, který se dá vyrobit, nevadí).
  // Materiál je dostupný, když už někde leží, dá se vykopat/pokácet, nebo stojí dílna, která ho vyrábí.
  const ZAKLADNI = ['drevo', 'kamen'];
  const DILNY_S = { tesarna: 'tesařskou dílnu', kamenictvi: 'kamenickou dílnu', tavirna: 'tavírnu', kovarna: 'kovárnu',
                    brusirna: 'brusírnu', milir: 'milíř', magmovyhen: 'magmatickou výheň', runova_kovarna: 'runovou kovárnu' };
  function dostupnost(hra, typ) {
    const d = STAVBY[typ];
    if (d.runy && !(hra.odemceno && hra.odemceno.runovaKovarna)) return 'nejdřív přečti runovou desku v ruinách';
    if (d.uVody) { let v = false; for (let i = 0; i < N && !v; i++) if (hra.hora.teren[i] === M.VODA && hra.znamo[i]) v = true; if (!v) return 'nejdřív najdi vodu'; }
    if (d.vyzaduje && !hra.dilny.some(dd => dd.typ === d.vyzaduje)) return 'potřebuje ' + (DILNY_S[d.vyzaduje] || STAVBY[d.vyzaduje].nazev);
    if (d.uMagmatu) {
      let znamo = false;
      for (let i = 0; i < N && !znamo; i++) if (hra.hora.teren[i] === M.MAGMA && hra.znamo[i]) znamo = true;
      if (!znamo) return 'nejdřív najdi magma';
    }
    for (const m of Object.keys(d.mat)) {
      if (ZAKLADNI.includes(m) || hra.veci.some(v => v.druh === m)) continue;
      const vyrabi = Object.keys(RECEPTY).filter(t => RECEPTY[t].some(r => r.vyrobek === m));
      if (vyrabi.some(t => hra.dilny.some(dd => dd.typ === t))) continue;
      return 'potřebuje ' + (vyrabi.length ? vyrabi.map(t => DILNY_S[t] || STAVBY[t].nazev).join(' nebo ') : T.prace.VECI[m].nazev);
    }
    return null;
  }
  function blizkoMagmatu(hra, i) {
    const x0 = i % W, y0 = i / W | 0;
    for (let y = y0 - 3; y <= y0 + 3; y++) for (let x = x0 - 3; x <= x0 + 3; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const j = y * W + x;
      if (hra.hora.teren[j] === M.MAGMA && hra.znamo[j]) return true;
    }
    return false;
  }
  // proč se stavba na pole nedá umístit (null = dá)
  function prekazka(hra, typ, i) {
    const d = STAVBY[typ];
    const x = i % W;
    if (x + (d.sirka || 1) > W) return 'okraj mapy';
    for (const j of bunkyPlanu(typ, i)) {
      if (d.misto === 'voda') {                    // studna: obě pole musí být známá voda
        if (!hra.znamo[j] || hra.hora.teren[j] !== M.VODA) return 'patří na vodu – dvě pole s vodou vedle sebe';
        if (hra.stavba[j] || hra.planNa.has(j)) return 'už tu něco je';
        continue;
      }
      // jednopolová stavba „na volno" jde naplánovat i do nevykopané skály – pole se nejdřív vykope (viz naplanuj);
      // neprozkoumané pole se odmítne vždy (jinak by plán prozradil, co v něm je)
      if (!hra.znamo[j]) return 'neprozkoumané místo';
      const pockej = vykopatPred(hra, d, j);
      if (hra.hora.teren[j] !== M.VZDUCH && !pockej) return 'není volné místo';
      if (pockej && neseStavbu(hra, j)) return 'pod stavbou – vykopáním by se zbořila';
      // žebřík jde i pod pumpu postavenou na holém poli šachty (jinak by v šachtě zůstala mezera, kudy se nevyleze)
      const podPumpu = d === STAVBY.zebrik && hra.stavba[j] === K.PUMPA && !hra.lez[j];
      if ((hra.stavba[j] && !podPumpu) || (hra.lez[j] && !d.naLezu) || hra.planNa.has(j)) return 'už tu něco je';
      if (d === STAVBY.vytah && hra.lez[j] === 3) return 'už tu je výtah';
      if (hra.hora.obj[j] && hra.hora.obj[j] !== O.TRAVA && hra.hora.obj[j] !== O.KOSTI && hra.hora.obj[j] !== O.KRAPNIK) return 'překáží ' + T.hora.OBJEKT[hra.hora.obj[j]];   // krápník stavba odlomí
      if (d.misto === 'podlaha' && !(j + W < N && pevne(hra.hora.teren[j + W]))) return 'potřebuje pevnou podlahu';
    }
    if (d.uMagmatu && !bunkyPlanu(typ, i).some(j => blizkoMagmatu(hra, j))) return 'musí stát do 3 polí od magmatu';
    if (d.runy && !(hra.odemceno && hra.odemceno.runovaKovarna)) return 'nejdřív přečti runovou desku předků v ruinách';
    return null;
  }
  // jednopolová stavba na volno (žebřík, výtah, podpěra, louč…) do nevykopané skály: pole se označí ke kopání –
  // u svislých cest (žebřík, výtah) jako schodiště, ať jde šachta kopat dolů
  const vykopatPred = (hra, d, j) => !d.sirka && d.misto === 'volno' && d !== STAVBY.zed && pevne(hra.hora.teren[j]) && T.prace.lzeKopat(hra, j);
  // nese pole j (nevykopané) stavbu nebo plán nad sebou? (dílna, studna, stavba či plán „na podlahu") – vykopáním by se zbořily
  function neseStavbu(hra, j) {
    if (j < W) return false;
    const n = j - W, kod = hra.stavba[n];
    if (kod === K.DILNA || kod === K.STUDNA) return true;
    if (kod && KOD_TYP[kod] && STAVBY[KOD_TYP[kod]].misto === 'podlaha') return true;
    const id = hra.planNa.get(n), p = id && planPodle(hra, id);
    return !!p && STAVBY[p.typ].misto === 'podlaha';
  }
  function naplanuj(hra, typ, i) {
    if (prekazka(hra, typ, i)) return null;
    const d = STAVBY[typ];
    // značku ke kopání, kterou plán sám přidal, si pamatuje (p.vykopat) – zrušení plánu ji zase smaže
    const vykopat = [];
    for (const j of bunkyPlanu(typ, i)) if (vykopatPred(hra, d, j) && hra.oznac[j] !== T.prace.OZN.KOPAT && hra.oznac[j] !== T.prace.OZN.SCHODY) {
      hra.oznac[j] = d.svisle ? T.prace.OZN.SCHODY : T.prace.OZN.KOPAT;
      vykopat.push(j);
    }
    const p = { id: hra.dalsiId++, typ, i, doneseno: {}, vCeste: {}, rez: 0, prace: 0 };
    if (vykopat.length) p.vykopat = vykopat;
    for (const druh of Object.keys(STAVBY[typ].mat)) { p.doneseno[druh] = 0; p.vCeste[druh] = 0; }
    hra.plany.push(p);
    for (const j of bunkyPlanu(typ, i)) hra.planNa.set(j, p.id);
    return p;
  }
  // plán v obdélníku (pro jednopolové stavby celý obdélník, pro dílny jen levý horní roh)
  function naplanujObdelnik(hra, typ, x0, y0, x1, y1) {
    if (STAVBY[typ].sirka) return naplanuj(hra, typ, y0 * W + x0) ? 1 : 0;
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (y0 > y1) [y0, y1] = [y1, y0];
    let n = 0;
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++)
      if (naplanuj(hra, typ, y * W + x)) n++;
    return n;
  }
  const chybi = (p, druh) => STAVBY[p.typ].mat[druh] - p.doneseno[druh] - p.vCeste[druh];
  const pripraven = p => Object.keys(STAVBY[p.typ].mat).every(d => p.doneseno[d] >= STAVBY[p.typ].mat[d]);
  function planPodle(hra, id) { return hra.plany.find(p => p.id === id); }
  // zrušení plánu: donesený materiál zůstane ležet na nejbližším suchém stojném poli (studna stojí na vodě);
  // značka ke kopání, kterou přidal plán, se smaže, pokud pole ještě nikdo nevykopal
  function zrusPlan(hra, p, veciZpet) {
    hra.plany.splice(hra.plany.indexOf(p), 1);
    for (const j of bunkyPlanu(p.typ, p.i)) hra.planNa.delete(j);
    for (const j of p.vykopat || []) if (pevne(hra.hora.teren[j]) && (hra.oznac[j] === T.prace.OZN.KOPAT || hra.oznac[j] === T.prace.OZN.SCHODY) && !hra.rez.has(j)) { hra.oznac[j] = 0; hra.prio[j] = 0; }
    const kam = T.prace.sucheMisto(hra, p.i);
    for (const [druh, n] of Object.entries(p.doneseno))
      for (let k = 0; k < n; k++) veciZpet(druh, kam, p.mat);
    for (const t of hra.trpaslici) if (t.prace && t.prace.plan === p.id) t.prace.zrusen = true;
  }
  // plán „na podlahu", pod kterým se podlaha vykopala: trpaslíci ho pustí, materiál zůstane ležet
  function zrusPlanBezPodlahy(hra, p, veciZpet) {
    for (const t of hra.trpaslici) if (t.prace && t.prace.plan === p.id) { t.prace.vCeste = 0; T.hra.pustPraci(hra, t); }
    zrusPlan(hra, p, veciZpet);
  }
  // má plán pořád místo, jaké potřebuje? (podlaha pod všemi poli)
  // je místo plánu připravené ke stavbě? (volné pole; studna na vodě)
  const volnoProPlan = (hra, p) => STAVBY[p.typ].misto === 'voda' ? bunkyPlanu(p.typ, p.i).every(j => hra.hora.teren[j] === M.VODA) : T.cesty.volne(hra, p.i);
  function mistoPlanu(hra, p) {
    if (STAVBY[p.typ].misto !== 'podlaha') return true;
    return bunkyPlanu(p.typ, p.i).every(j => j + W < N && pevne(hra.hora.teren[j + W]));
  }
  // dosah stavění: pole kolem sebe a až dvě pole nad hlavou (jako kopání); i pole, na kterém stojí – kromě zdi
  const STAV_DOSAH = [[0, 0], [-1, 0], [1, 0], [0, 1], [0, -1], [-1, 1], [1, 1], [-1, -1], [1, -1], [0, -2], [-1, -2], [1, -2]];
  function planVDosahu(hra, a, p) {
    const x = a % W, y = a / W | 0;
    for (const j of bunkyPlanu(p.typ, p.i)) {
      const dx = j % W - x, dy = (j / W | 0) - y;
      if (Math.abs(dx) > 1 || dy > 1 || dy < -2) continue;
      if (p.typ === 'zed' && j === a) continue;
      return true;
    }
    return false;
  }

  // dokončení stavby
  function dokonci(hra, p, stavitel, zprava) {
    const d = STAVBY[p.typ];
    hra.plany.splice(hra.plany.indexOf(p), 1);
    const bunky = bunkyPlanu(p.typ, p.i);
    for (const j of bunky) { hra.planNa.delete(j); if (hra.hora.obj[j] === O.KRAPNIK) hra.hora.obj[j] = 0; }
    hra.svetloZmena++; hra.stabilitaZmena++; hra.vodaKlid = false;
    if (p.typ === 'zebrik') hra.lez[p.i] = 2;
    else if (p.typ === 'vytah') {                  // výtah nahradí schody i žebřík (dřevo ze žebříku zůstane)
      if (hra.lez[p.i] === 2) T.prace.novaVec(hra, 'drevo', p.i, 'drevo');
      hra.lez[p.i] = 3;
    }
    else if (p.typ === 'zed') {
      const i = p.i;
      hra.hora.teren[i] = M.ZED; hra.hora.ruda[i] = 0; hra.hora.obj[i] = 0;
      if (hra.tesano) hra.tesano[i] = 0;               // postavená zeď je opravdu zeď (ne otesaná hornina)
      hra.oznac[i] = 0; hra.prio[i] = 0;                // značka tesání / kácení by ze zdi udělala kopání
      if (hra.zona[i]) { hra.zona[i] = 0; uklidZony(hra); }
      for (const t of hra.trpaslici) if (t.i === i) { t.i = t.o = stavitel.i; t.t = t.dur = 0; }
      for (const v of hra.veci) if (!v.nese && v.i === i) v.i = stavitel.i;
      T.prace.usadVeci(hra);
    } else {
      for (const j of bunky) hra.stavba[j] = d.kod;
      if (d.kod === K.STUDNA) { hra.stavbaStav[bunky[0]] = 1; hra.stavbaStav[bunky[1]] = 2; zprava('stavba', `${stavitel.jmeno} dostavěl studnu.`, p.i); }
      else if (d.sirka) {
        const dil = { id: p.id, typ: p.typ, i: p.i, fronta: [], vRobe: null, rez: 0 };
        for (const [r, cil] of (VYCHOZI_ZAKAZKY[p.typ] || [])) dil.fronta.push({ id: hra.dalsiId++, r, trvala: true, cil, zbyva: 0, vCeste: 0 });
        hra.dilny.push(dil);
        zprava('stavba', `${stavitel.jmeno} dostavěl ${d.nazev}.`, p.i);
      }
      if (d.nabytek) hra.materialNa.set(p.i, p.mat || 'drevo');
    }
  }
  function dilnaNa(hra, i) {
    if (hra.stavba[i] !== K.DILNA) return null;
    return hra.dilny.find(d => i === d.i || i === d.i + 1) || null;
  }
  // zbourání stavby, které zmizela podlaha (materiál zůstane ležet)
  function zbourej(hra, i, veciZpet) {
    const kod = hra.stavba[i];
    if (!kod) return;
    hra.svetloZmena++; hra.stabilitaZmena++; hra.vodaKlid = false;
    if (kod === K.DILNA) {
      const d = dilnaNa(hra, i);
      if (d) {
        // kdo v dílně dělá nebo do ní nese materiál, práci pustí (jinak by šel do dílny, která už není)
        for (const t of hra.trpaslici) if (t.prace && t.prace.dilna === d.id) { t.prace.vCeste = 0; T.hra.pustPraci(hra, t); }
        hra.dilny.splice(hra.dilny.indexOf(d), 1);
        hra.stavba[d.i] = hra.stavba[d.i + 1] = 0;
        for (const m of [d, d.m2]) if (m && m.vRobe) for (const [druh, n] of Object.entries(m.vRobe.doneseno)) for (let k = 0; k < n; k++) veciZpet(druh, i);   // obě pracoviště
        for (const [druh, n] of Object.entries(STAVBY[d.typ].mat)) for (let k = 0; k < n; k++) veciZpet(druh, i);
      }
      return;
    }
    let kam = i;
    if (kod === K.STUDNA) {                         // studna: obě pole (levé má stavbaStav 1, pravé 2); materiál na suché místo
      const j = hra.stavbaStav[i] === 2 ? i - 1 : i + 1;
      if (hra.stavba[j] === K.STUDNA) { hra.stavba[j] = 0; hra.stavbaStav[j] = 0; }
      kam = T.prace.sucheMisto(hra, i);
    }
    hra.stavba[i] = 0;
    if (hra.zavreno) hra.zavreno[i] = 0;
    if (hra.stavbaStav) hra.stavbaStav[i] = 0;
    const typ = KOD_TYP[kod];
    if (typ) for (const druh of Object.keys(STAVBY[typ].mat)) veciZpet(druh, kam, hra.materialNa.get(i));
    hra.materialNa.delete(i);
  }

  T.stavby = { K, STAVBY, SKUPINY_STAVEB, KOD_TYP, RECEPTY, NASTROJE, OPOTREBENI, PREFERUJE, OHNIVE_DILNY, materialReceptu, PROFESE_DILNY, CIL_FARMY, cilFarmy, nastavCilFarmy, kvalitaZony, OTESANE_POZADI, DALSI_ZONY, VYCHOZI_ZAKAZKY, SKUPINY, ZONY, FARMY, MAX_NA_POLI, STAV_DOSAH,
               zonaNa, jeSklad, prijme, lzeZona, novaZona, zrusZonu, uklidZony, bunkyZony, vybaveni,
               bunkyPlanu, prekazka, naplanuj, neseStavbu, naplanujObdelnik, chybi, pripraven, planPodle, zrusPlan,
               planVDosahu, mistoPlanu, volnoProPlan, zrusPlanBezPodlahy, dokonci, dilnaNa, zbourej, dostupnost, rozmistiNabytek, NABYTEK_ZONY, prijimaneDruhy, nastavFiltr, DRUHY_SKLADU };
})(TRP);

if (typeof module !== 'undefined') module.exports = TRP;

/* ============================================================
   Síně pod horou – stavby.js: stavby, dílny, recepty, zóny skladů.

   Stavba začíná jako plán na 1 až 3 × 3 polích (dílny a postel mají
   orientaci – smer 0 jih, 1 západ, 2 sever, 3 východ). Trpaslíci na
   místo donesou materiál (skutečné věci ze země nebo ze skladu), pak
   ji postaví. Dílna má přední stranu: na vstupní pole se nosí materiál,
   na výstupní padá výrobek, pracuje se z předních polí.
   Sklady jsou zóny (filtr druhů, přednost), 4 věci na pole; truhla
   a sud v místnosti jsou malé sklady na 8 věcí.
   Účetnictví věcí: hra.vytvoreno − hra.spotrebovano = věci na zemi
   a v rukou + donesené v plánech + zásoba v dílnách (test to hlídá).
   Čistá logika bez DOM.
   ============================================================ */
var SIN = globalThis.SIN = globalThis.SIN || {};

(function (S) {
  'use strict';
  const SV = S.svet, { M, O, P } = SV, C = S.cesty, PR = S.prace;

  // misto: podlaha = volné suché průchozí pole bez předmětu, dira = díra, lavka = díra / hluboká voda / magma,
  //        u_steny = podlaha vedle skály; blokuje = přes postavenou stavbu se nechodí
  const STAVBY = {
    zebrik:   { nazev: 'žebřík do díry', ikona: '🪜', mat: { drevo: 1 }, doba: 30, misto: 'dira', obj: O.ZEBRIK, popis: 'Nouzové spojení s patrem pod dírou (10 tahů na patro).' },
    sachta:   { nazev: 'šachta s rumpálem', ikona: '🛗', mat: { drevo: 1 }, doba: 60, misto: 'dira', obj: O.SACHTA, vyzaduje: 'tesarna', popis: 'Rychlý výtah o patro níž (7 tahů). Vyžaduje tesařskou dílnu.' },
    lavka:    { nazev: 'lávka', ikona: '🌉', mat: { drevo: 2 }, doba: 40, misto: 'lavka', obj: O.MOST, popis: 'Přes díru, hlubokou vodu nebo magma (magma ji spálí).' },
    sloup:    { nazev: 'kamenný sloup', ikona: '🏛️', mat: { kamen: 2 }, doba: 50, misto: 'podlaha', obj: O.SLOUP, popis: 'Opora stropu uprostřed síně. Do pole označeného ke kopání se vytesá rovnou ze skály (bez kamene).' },
    pumpa:    { nazev: 'ruční pumpa', ikona: '⛲', mat: { drevo: 3 }, doba: 50, misto: 'podlaha', budova: true, blokuje: true, popis: 'Trpaslík u ní odčerpává vodu do 3 polí okolo (zatopené chodby).' },
    studna:   { nazev: 'studna', ikona: '🪣', mat: { kamen: 4, drevo: 1 }, doba: 60, misto: 'podlaha', budova: true, blokuje: true, uVody: true, popis: 'U vody nebo nad vodou v patře pod. Čistá voda (−2 místo −6), nezamrzá.' },
    sloup_d:  { nazev: 'dřevěný sloup', ikona: '🪵', mat: { drevo: 2 }, doba: 40, misto: 'podlaha', obj: O.SLOUP, popis: 'Opora stropu ze dřeva.' },
    louc:     { nazev: 'louč', ikona: '🔥', mat: { drevo: 1 }, doba: 12, misto: 'u_steny', budova: true, popis: 'Světlo na zdi (7 polí).' },
    svicen:   { nazev: 'svícen', ikona: '🕯️', mat: { prut_zelezo: 1 }, doba: 20, misto: 'podlaha', budova: true, popis: 'Světlo, které nezhasne (6 polí).' },
    zed:      { nazev: 'kamenná zeď', ikona: '🧱', mat: { kamen: 1 }, doba: 40, misto: 'podlaha', zed: true, popis: 'Dělí prostory a tvoří místnosti.' },
    dvere:    { nazev: 'dveře', ikona: '🚪', mat: { drevo: 1 }, doba: 35, misto: 'podlaha', budova: true, popis: 'Uzavírají místnosti. Trpaslíci projdou.' },
    p_dlazba: { nazev: 'dlažba', ikona: '⬜', mat: { dlazba: 1 }, doba: 15, misto: 'podlaha', podlaha: P.DLAZBA, popis: 'Kamenná podlaha (kvalita místnosti +1).' },
    p_sach:   { nazev: 'šachovnice', ikona: '🏁', mat: { dlazba: 1 }, doba: 18, misto: 'podlaha', podlaha: P.SACHOVNICE, popis: 'Mramorová šachovnice.' },
    p_prkna:  { nazev: 'prkna', ikona: '🟫', mat: { prkna: 1 }, doba: 15, misto: 'podlaha', podlaha: P.PRKNA, popis: 'Dřevěná podlaha (+1).' },
    p_koberec:{ nazev: 'koberec', ikona: '🟥', mat: { koberec: 1 }, doba: 15, misto: 'podlaha', podlaha: P.KOBEREC, popis: 'Koberec (+2).' },
    p_mozaika:{ nazev: 'mozaika', ikona: '💠', mat: { mozaika: 1 }, doba: 25, misto: 'podlaha', podlaha: P.MOZAIKA, popis: 'Mozaika z drahokamů (+3).' },
    kuchyne:  { nazev: 'kuchyně', ikona: '🍲', mat: { drevo: 2 }, doba: 80, rozmer: [2, 2], dilna: true, popis: 'Z hub a ječmene vaří jídlo. Vaří farmář.' },
    pivovar:  { nazev: 'pivovar', ikona: '🍺', mat: { drevo: 3 }, doba: 80, rozmer: [2, 2], dilna: true, popis: 'Z ječmene nebo hub vaří pivo. Vaří sládek.' },
    postel:   { nazev: 'postel', ikona: '🛏️', mat: { postel: 1 }, doba: 20, rozmer: [1, 2], budova: true, popis: 'Patří do ložnice.' },
    stul:     { nazev: 'stůl', ikona: '🍽️', mat: { stul: 1 }, doba: 20, budova: true, blokuje: true, popis: 'Patří do jídelny.' },
    zidle:    { nazev: 'židle', ikona: '🪑', mat: { zidle: 1 }, doba: 15, budova: true, popis: 'Ke stolu.' },
    lavice:   { nazev: 'lavice', ikona: '🪑', mat: { lavice: 1 }, doba: 15, rozmer: [2, 1], budova: true, popis: 'Sedí na ní dva.' },
    socha:    { nazev: 'socha', ikona: '🗿', mat: { socha: 1 }, doba: 25, budova: true, blokuje: true, popis: 'Ozdoba síně (kvalita +2).' },
    truhla:   { nazev: 'truhla', ikona: '🧰', mat: { truhla: 1 }, doba: 15, budova: true, sklad: 8, popis: 'Malý sklad na 8 věcí (ne jídlo).' },
    sud:      { nazev: 'sud', ikona: '🛢️', mat: { sud: 1 }, doba: 15, budova: true, sklad: 8, popis: 'Malý sklad na 8 kusů jídla a pití.' },
    tesarna:  { nazev: 'tesařská dílna', ikona: '🪚', mat: { drevo: 3 }, doba: 80, rozmer: [2, 2], dilna: true, popis: 'Nábytek, prkna, truhly a sudy ze dřeva. Pracuje tesař.' },
    kamenictvi: { nazev: 'kamenická dílna', ikona: '🪨', mat: { kamen: 3 }, doba: 80, rozmer: [2, 2], dilna: true, popis: 'Dlažba, stoly, židle a sochy z kamene. Pracuje kameník.' },
    brusirna: { nazev: 'brusírna', ikona: '💎', mat: { kamen: 2 }, doba: 70, rozmer: [2, 2], dilna: true, popis: 'Drahokamy, šperky, poháry a mozaika. Brousí kameník.' },
    tkalcovna:{ nazev: 'tkalcovna', ikona: '🧵', mat: { drevo: 2 }, doba: 70, rozmer: [2, 2], dilna: true, popis: 'Z pavoučího hedvábí koberce a plátno.' },
    milir:    { nazev: 'milíř', ikona: '♨️', mat: { drevo: 2 }, doba: 60, rozmer: [2, 2], dilna: true, popis: 'Ze dvou polen pálí dřevěné uhlí. Obslouží kdokoli.' },
    tavirna:  { nazev: 'tavírna', ikona: '🔥', mat: { kamen: 3 }, doba: 90, rozmer: [2, 2], dilna: true, popis: 'Z rudy a uhlí taví pruty. Taví kovář.' },
    kovarna:  { nazev: 'kovárna', ikona: '⚒️', mat: { kamen: 3 }, doba: 90, rozmer: [2, 2], dilna: true, popis: 'Z prutů kove nástroje, zbraně a svícny. Kove kovář.' },
    stanek: { nazev: 'stánek', ikona: '⛺', mat: { drevo: 3, platno: 1 }, doba: 60, rozmer: [2, 2], budova: true, blokuje: true, venku: true,
              popis: 'Na tržišti v rokli. Každý stánek (nejvýš 4) přidá karavaně jeden druh zboží a +5 % výkupu.' },
    most:     { nazev: 'oprava mostu', ikona: '🌉', mat: { drevo: 2 }, doba: 60, misto: 'rozbity', obj: O.MOST, popis: 'Opraví pole polorozpadlého mostu přes soutěsku.' },
    mriz:     { nazev: 'padací mříž', ikona: '⛓️', mat: { prut_zelezo: 2 }, doba: 60, misto: 'podlaha', budova: true, popis: 'Zavřená nepustí nikoho (jen troll ji vyrazí). Otevírá se ve výběru.' },
    past:     { nazev: 'past', ikona: '🪤', mat: { prut_zelezo: 1, drevo: 1 }, doba: 40, misto: 'podlaha', budova: true, popis: 'Zraní netvora, který na ni šlápne (25 ♥), pak se 30 s napíná. Trpaslíkům neublíží.' },
    vez:      { nazev: 'strážní věž', ikona: '🗼', mat: { kamen: 4, drevo: 1 }, doba: 90, misto: 'podlaha', budova: true, popis: 'Strážce na věži je pro netvory nedosažitelný a kuší dostřelí do 8 polí.' },
    zbrojnice:{ nazev: 'zbrojnice', ikona: '🛡️', mat: { drevo: 2, kamen: 1 }, doba: 70, rozmer: [2, 1], budova: true, blokuje: true, popis: 'Stojany se zbraněmi: strážci tu před ní cvičí boj, když není koho honit.' },
    runova_kovarna: { nazev: 'runová kovárna', ikona: '✴️', mat: { prut_zlato: 2 }, doba: 120, rozmer: [2, 2], dilna: true, odemknout: 'runovaKovarna',
              popis: 'Kovárna předků (odemkne ji runová deska): artefakty z hvězdné oceli a Klíč k Srdci. Kove kovář.' },
    magmovyhen: { nazev: 'magmatická výheň', ikona: '🌋', mat: { kamen: 4 }, doba: 100, rozmer: [2, 2], dilna: true, uMagmatu: true, popis: 'Do 3 polí od magmatu; taví i kove bez uhlí.' },
  };
  const SKUPINY_STAVEB = [
    { nazev: 'Chodby a patra', ikona: '🪜', typy: ['zebrik', 'sachta', 'lavka', 'sloup', 'sloup_d', 'louc', 'svicen', 'zed', 'dvere', 'pumpa'] },
    { nazev: 'Podlahy', ikona: '⬜', typy: ['p_dlazba', 'p_sach', 'p_prkna', 'p_koberec', 'p_mozaika'] },
    { nazev: 'Jídlo a pití', ikona: '🍲', typy: ['kuchyne', 'pivovar', 'studna'] },
    { nazev: 'Nábytek', ikona: '🛏️', typy: ['postel', 'stul', 'zidle', 'lavice', 'socha', 'truhla', 'sud'] },
    { nazev: 'Dílny', ikona: '🪚', typy: ['tesarna', 'kamenictvi', 'brusirna', 'tkalcovna'] },
    { nazev: 'Kovy a oheň', ikona: '⚒️', typy: ['milir', 'tavirna', 'kovarna', 'magmovyhen', 'runova_kovarna'] },
    { nazev: 'Tržiště', ikona: '⛺', typy: ['stanek'] },
    { nazev: 'Obrana', ikona: '🛡️', typy: ['dvere', 'mriz', 'past', 'vez', 'zbrojnice', 'most'] },
  ];

  // recepty dílen (ze Srdce hory + nové kvůli pohledu shora): mat = seznam kusů, pocet = kolik vznikne
  const RECEPTY = {
    kuchyne: [
      { vyrobek: 'jidlo', mat: ['houby'], doba: 30, pocet: 1, nazev: 'houbový guláš' },
      { vyrobek: 'jidlo', mat: ['jecmen'], doba: 50, pocet: 2, nazev: 'ječný chléb' },
      { vyrobek: 'jidlo', mat: ['ryba'], doba: 30, pocet: 2, nazev: 'pečená ryba' },
    ],
    pivovar: [
      { vyrobek: 'pivo', mat: ['jecmen'], doba: 60, pocet: 2, nazev: 'ječné pivo' },
      { vyrobek: 'pivo', mat: ['houby'], doba: 40, pocet: 1, nazev: 'houbové pivo' },
    ],
    tesarna: [
      { vyrobek: 'postel', mat: ['drevo'], doba: 60 }, { vyrobek: 'stul', mat: ['drevo'], doba: 50 },
      { vyrobek: 'zidle', mat: ['drevo'], doba: 40 }, { vyrobek: 'lavice', mat: ['drevo'], doba: 50 },
      { vyrobek: 'truhla', mat: ['drevo'], doba: 50 }, { vyrobek: 'sud', mat: ['drevo'], doba: 50 },
      { vyrobek: 'prkna', mat: ['drevo'], doba: 30, pocet: 2, nazev: 'prkna (2 pole)' },
    ],
    kamenictvi: [
      { vyrobek: 'dlazba', mat: ['kamen'], doba: 30, pocet: 2, nazev: 'dlažba (2 pole)' },
      { vyrobek: 'stul', mat: ['kamen'], doba: 70, nazev: 'kamenný stůl' }, { vyrobek: 'zidle', mat: ['kamen'], doba: 60, nazev: 'kamenná židle' },
      { vyrobek: 'socha', mat: ['kamen'], doba: 120 },
    ],
    brusirna: [
      { vyrobek: 'brus', mat: ['drahokam'], doba: 100, nazev: 'broušený drahokam' },
      { vyrobek: 'mozaika', mat: ['drahokam'], doba: 120, pocet: 2, nazev: 'mozaika (2 pole)' },
      { vyrobek: 'sperk', mat: ['prut_zlato', 'drahokam'], doba: 140 },
      { vyrobek: 'pohar', mat: ['prut_stribro'], doba: 110 },
    ],
    tkalcovna: [
      { vyrobek: 'koberec', mat: ['hedvabi', 'hedvabi'], doba: 80 },
      { vyrobek: 'platno', mat: ['hedvabi'], doba: 60, nazev: 'stanové plátno' },
    ],
    milir: [{ vyrobek: 'uhli', mat: ['drevo', 'drevo'], doba: 90, pocet: 2, nazev: 'dřevěné uhlí' }],
    tavirna: [
      { vyrobek: 'prut_zelezo', mat: ['zelezo', 'uhli'], doba: 80 }, { vyrobek: 'prut_med', mat: ['med', 'uhli'], doba: 70 },
      { vyrobek: 'prut_stribro', mat: ['stribro', 'uhli'], doba: 80 }, { vyrobek: 'prut_zlato', mat: ['zlato', 'uhli'], doba: 80 },
      { vyrobek: 'prut_hvezdny', mat: ['hvezdna', 'uhli'], doba: 120 },
    ],
    runova_kovarna: [
      { vyrobek: 'art_kladivo', mat: ['prut_hvezdny', 'prut_hvezdny', 'prut_zelezo'], doba: 200, nazev: '🔨 Durinovo kladivo', pribeh: true },
      { vyrobek: 'art_lampa', mat: ['prut_hvezdny', 'prut_hvezdny', 'brus'], doba: 200, nazev: '🏮 Lampa předků', pribeh: true },
      { vyrobek: 'art_roh', mat: ['prut_hvezdny', 'prut_hvezdny', 'pohar'], doba: 200, nazev: '📯 Roh hory', pribeh: true },
      { vyrobek: 'art_klic', mat: ['prut_hvezdny', 'prut_hvezdny', 'prut_hvezdny', 'sperk'], doba: 300, nazev: '🗝️ Klíč k Srdci', pribeh: true },
    ],
    kovarna: [
      { vyrobek: 'krumpac', mat: ['prut_zelezo', 'uhli'], doba: 90, vmat: 'zelezo', nazev: 'železný krumpáč' },
      { vyrobek: 'krumpac', mat: ['prut_med', 'uhli'], doba: 80, vmat: 'med', nazev: 'měděný krumpáč' },
      { vyrobek: 'sekera', mat: ['prut_zelezo', 'uhli'], doba: 80, vmat: 'zelezo', nazev: 'železná sekera' },
      { vyrobek: 'kladivo', mat: ['prut_zelezo', 'uhli'], doba: 80, vmat: 'zelezo', nazev: 'železné kladivo' },
      { vyrobek: 'kladivo', mat: ['prut_med', 'uhli'], doba: 70, vmat: 'med', nazev: 'měděné kladivo' },
      { vyrobek: 'svicen', mat: ['prut_zelezo', 'uhli'], doba: 60 },
      { vyrobek: 'prut_zelezo', mat: ['cepel', 'cepel', 'uhli'], doba: 60, nazev: 'přetavit goblinní čepele' },
      { vyrobek: 'kuse', mat: ['prut_zelezo', 'uhli'], doba: 100 },
      { vyrobek: 'sipy', mat: ['prut_zelezo', 'drevo', 'drevo', 'drevo', 'drevo'], doba: 60, pocet: 20, nazev: 'šípy (20)' },
      { vyrobek: 'valecna_sekera', mat: ['prut_zelezo', 'prut_zelezo', 'uhli'], doba: 110, vmat: 'zelezo' },
      { vyrobek: 'zbroj', mat: ['prut_zelezo', 'prut_zelezo', 'prut_zelezo', 'uhli'], doba: 140, vmat: 'zelezo', nazev: 'železná zbroj' },
      { vyrobek: 'zbroj', mat: ['prut_med', 'prut_med', 'prut_med', 'uhli'], doba: 120, vmat: 'med', nazev: 'měděná zbroj' },
      { vyrobek: 'socha', mat: ['prut_zelezo', 'prut_zelezo', 'uhli'], doba: 100, vmat: 'zelezo', nazev: 'kovaná socha' },
    ],
    magmovyhen: [
      { vyrobek: 'prut_zelezo', mat: ['zelezo'], doba: 60 }, { vyrobek: 'prut_med', mat: ['med'], doba: 50 },
      { vyrobek: 'prut_stribro', mat: ['stribro'], doba: 60 }, { vyrobek: 'prut_zlato', mat: ['zlato'], doba: 60 },
      { vyrobek: 'prut_hvezdny', mat: ['hvezdna'], doba: 90 },
      { vyrobek: 'krumpac', mat: ['prut_zelezo'], doba: 70, vmat: 'zelezo', nazev: 'železný krumpáč' },
      { vyrobek: 'sekera', mat: ['prut_zelezo'], doba: 60, vmat: 'zelezo', nazev: 'železná sekera' },
      { vyrobek: 'kladivo', mat: ['prut_zelezo'], doba: 60, vmat: 'zelezo', nazev: 'železné kladivo' },
    ],
  };
  // nástroje: co zrychlují a jak moc (podle kovu), opotřebení za jedno použití (ze 100)
  const NASTROJE = {
    krumpac: { prace: ['kopat', 'schody', 'dira'], zelezo: 1.6, med: 1.35 },
    sekera: { prace: ['kacet'], zelezo: 2.0, med: 1.6 },
    kladivo: { prace: ['stavet', 'vyrobit', 'otesat'], zelezo: 1.4, med: 1.25 },
  };
  const OPOTREBENI = { zelezo: 1.5, med: 2.5 };
  const PREFERUJE = { hornik: 'krumpac', strazce: 'krumpac', tesar: 'sekera', farmar: 'sekera', kamenik: 'kladivo', kovar: 'kladivo', sladek: 'kladivo' };
  const PROFESE_DILNY = { tesarna: 'tesar', kamenictvi: 'kamenik', kuchyne: 'farmar', pivovar: 'sladek', tavirna: 'kovar',
                          kovarna: 'kovar', brusirna: 'kamenik', milir: null, magmovyhen: 'kovar', tkalcovna: null, runova_kovarna: 'kovar' };
  const VYCHOZI_ZAKAZKY = { kuchyne: [[0, 20], [1, 20]], pivovar: [[0, 20], [1, 20]] };
  const nazevReceptu = rc => rc.nazev || (PR.VECI[rc.vyrobek] ? PR.VECI[rc.vyrobek].nazev : rc.vyrobek);
  function materialReceptu(rc) { const m = {}; for (const d of rc.mat) m[d] = (m[d] || 0) + 1; return m; }

  // skupiny věcí pro filtr skladu
  const SKUPINY_VECI = {
    kamen: { nazev: 'kámen a jíl', ikona: '🪨', druhy: ['kamen', 'jil'] },
    rudy: { nazev: 'uhlí, rudy, drahokamy', ikona: '⛏️', druhy: ['uhli', 'zelezo', 'med', 'stribro', 'zlato', 'drahokam', 'hvezdna'] },
    drevo: { nazev: 'dřevo', ikona: '🪵', druhy: ['drevo'] },
    jidlo: { nazev: 'jídlo a pití', ikona: '🍖', druhy: ['jidlo', 'pivo', 'houby', 'jecmen', 'ryba'] },
    vyrobky: { nazev: 'nábytek a podlahy', ikona: '🪑', druhy: ['postel', 'stul', 'zidle', 'lavice', 'socha', 'truhla', 'sud', 'dlazba', 'prkna', 'koberec', 'mozaika', 'platno', 'svicen'] },
    kov: { nazev: 'kovy, nástroje, zbraně', ikona: '⚒️', druhy: ['prut_zelezo', 'prut_med', 'prut_stribro', 'prut_zlato', 'prut_hvezdny', 'cepel', 'krumpac', 'sekera', 'kladivo', 'kuse', 'sipy', 'valecna_sekera', 'zbroj'] },
    cennosti: { nazev: 'cennosti', ikona: '💍', druhy: ['brus', 'sperk', 'pohar', 'hedvabi', 'klic'] },
  };
  const SKUPINA_DRUHU = {};
  for (const [k, s] of Object.entries(SKUPINY_VECI)) for (const d of s.druhy) SKUPINA_DRUHU[d] = k;
  const KAPACITA_POLE = 4;
  const DRUHY_SUDU = new Set(SKUPINY_VECI.jidlo.druhy);

  // --- geometrie stavby ---------------------------------------------------------------
  function rozmer(typ, smer) { const r = STAVBY[typ].rozmer || [1, 1]; return smer & 1 ? [r[1], r[0]] : r; }
  function bunkyStavby(sv, typ, g, smer) {
    const p = (g / sv.N) | 0, l = g - p * sv.N, x0 = l % sv.W, y0 = (l / sv.W) | 0, [w, h] = rozmer(typ, smer), r = [];
    if (x0 + w > sv.W || y0 + h > sv.H) return null;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) r.push(p * sv.N + y * sv.W + x);
    return r;
  }
  // přední pole dílny (venku před stranou smer): [vstup, …, výstup]
  function predniPole(sv, b) {
    const p = (b.g / sv.N) | 0, l = b.g - p * sv.N, x0 = l % sv.W, y0 = (l / sv.W) | 0, [w, h] = rozmer(b.typ, b.smer), r = [];
    const s = b.smer;
    if (s === 0) for (let x = x0; x < x0 + w; x++) r.push([x, y0 + h]);
    else if (s === 2) for (let x = x0 + w - 1; x >= x0; x--) r.push([x, y0 - 1]);
    else if (s === 1) for (let y = y0; y < y0 + h; y++) r.push([x0 - 1, y]);
    else for (let y = y0 + h - 1; y >= y0; y--) r.push([x0 + w, y]);
    return r.filter(([x, y]) => x >= 0 && y >= 0 && x < sv.W && y < sv.H).map(([x, y]) => p * sv.N + y * sv.W + x);
  }
  // seřazený seznam polí v zónách (mezipaměť; každý zápis do hra.zona musí zavolat zonZmena)
  const zonZmena = hra => { hra._zonVerze = (hra._zonVerze || 0) + 1; };
  function zonaBunky(hra) {
    if (hra._zonaBunky && hra._zonaBunkyVerze === hra._zonVerze) return hra._zonaBunky;
    const r = [], z = hra.zona;
    for (let g = 0; g < z.length; g++) if (z[g]) r.push(g);
    hra._zonaBunky = r; hra._zonaBunkyVerze = hra._zonVerze;
    return r;
  }
  const blokuje = typ => !!(STAVBY[typ].dilna || STAVBY[typ].blokuje || STAVBY[typ].zed || STAVBY[typ].obj === O.SLOUP);

  // --- plánování ----------------------------------------------------------------------
  function blizkoMagmatu(sv, g) {
    const p = (g / sv.N) | 0, l = g - p * sv.N, x = l % sv.W, y = (l / sv.W) | 0;
    for (let dy = -3; dy <= 4; dy++) for (let dx = -3; dx <= 4; dx++) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= sv.W || Y >= sv.H) continue;
      const h = p * sv.N + Y * sv.W + X;
      if (sv.kap[h] && sv.kapTyp[h] === SV.K.MAGMA && sv.zn[h]) return true;
    }
    return false;
  }
  // '' = jde postavit, jinak důvod
  function lzePostavit(hra, typ, g, smer, ignorujPlan) {
    const d = STAVBY[typ], sv = hra.sv;
    if (!d) return 'neznámá stavba';
    // sloup do skály označené ke kopání: vytesá se z ní (viz prace.vykopej)
    if (d.obj === O.SLOUP && sv.teren[g] !== M.VOLNO && hra.oznac[g] === PR.OZN.KOPAT && !hra.planNa.has(g)) return '';
    if (d.vyzaduje && !hra.budovy.some(b => b.typ === d.vyzaduje)) return `nejdřív ${STAVBY[d.vyzaduje].nazev}`;
    if (d.odemknout && !hra.odemceno[d.odemknout]) return 'zatím neznámá – plán leží na runové desce předků';
    const bunky = bunkyStavby(sv, typ, g, smer || 0);
    if (!bunky) return 'nevejde se do mapy';
    for (const h of bunky) {
      if (!sv.zn[h]) return 'neprozkoumané místo';
      const pl = hra.planNa.get(h);
      if (pl !== undefined && pl !== ignorujPlan) return 'tady už je plán';
      if (hra.budovaNa[h]) return 'tady už něco stojí';
      if (hra.oznac[h] && hra.oznac[h] !== PR.OZN.OTESAT) return 'na poli je naplánovaná práce';
      if (d.misto === 'dira') { if (sv.obj[h] !== O.DIRA) return 'staví se jen do díry'; continue; }
      if (d.misto === 'rozbity') { if (sv.obj[h] !== O.MOST_ROZBITY) return 'opravuje se jen rozpadlý most'; continue; }
      if (d.misto === 'lavka') {
        if (sv.obj[h] === O.DIRA || (sv.teren[h] === M.VOLNO && sv.kap[h] >= SV.HLUBOKA && sv.obj[h] === O.NIC)) continue;
        return 'lávka vede přes díru, hlubokou vodu nebo magma';
      }
      if (sv.teren[h] !== M.VOLNO) return 'stavět jde jen na volnou podlahu';
      if (sv.kap[h]) return 'na mokré podlaze stavět nejde';
      if (sv.obj[h] !== O.NIC && sv.obj[h] !== O.JECMEN) return 'pole je obsazené';
    }
    if (d.misto === 'u_steny') {
      const h = bunky[0], W = sv.W;
      if (![1, -1, W, -W].some(o => sv.teren[h + o] !== M.VOLNO)) return 'louč patří na stěnu';
    }
    if (d.uMagmatu && !bunky.some(h => blizkoMagmatu(sv, h))) return 'magma musí být do 3 polí';
    if (d.uVody && !S.priroda.studnaMa(hra, { g: bunky[0] })) return 'studna patří k vodě (vedle ní, nebo nad ní v patře pod)';
    if (d.venku && !bunky.every(h => h < sv.N && sv.oblast[h] && sv.oblasti[sv.oblast[h]].typ === 'rokle')) return 'stánek patří ven do rokle';
    return '';
  }
  function naplanuj(hra, typ, g, smer) {
    smer = smer || 0;
    const e = lzePostavit(hra, typ, g, smer);
    if (e) return e;
    const plan = { id: hra.dalsiId++, typ, g, smer, bunky: bunkyStavby(hra.sv, typ, g, smer), doneseno: {}, prichazi: {}, prio: false };
    if (STAVBY[typ].obj === O.SLOUP && hra.sv.teren[g] !== M.VOLNO) plan.zeSkaly = true;      // vytesá se při kopání
    hra.plany.push(plan);
    for (const h of plan.bunky) { hra.planNa.set(h, plan.id); PR.zmena(hra, h); }
    hra.zmenaPraci++;
    return '';
  }
  const planPodle = (hra, id) => hra.plany.find(p => p.id === id) || null;
  const chybi = (pl, druh) => (STAVBY[pl.typ].mat[druh] || 0) - (pl.doneseno[druh] || 0) - (pl.prichazi[druh] || 0);
  const kompletni = pl => Object.keys(STAVBY[pl.typ].mat).every(d => (pl.doneseno[d] || 0) >= STAVBY[pl.typ].mat[d]);
  // volné průchozí pole co nejblíž k bunkám (kam vypadnou věci)
  function poleVedle(hra, bunky) {
    const sv = hra.sv, set = new Set(bunky);
    for (const h of bunky) if (C.pruchozi(sv, h) && !hra.sv.blok[h]) return h;
    for (const h of bunky) for (const s of PR.stojiskaKolem(sv, h)) if (!set.has(s)) return s;
    const r = C.hledej(hra, [bunky[0]], g => C.pruchozi(sv, g) && !set.has(g), 2000);
    return r ? r.cil : bunky[0];
  }
  function zrusPlan(hra, plan) {
    const i = hra.plany.indexOf(plan);
    if (i < 0) return;
    hra.plany.splice(i, 1);
    for (const h of plan.bunky) { if (hra.planNa.get(h) === plan.id) hra.planNa.delete(h); PR.zmena(hra, h); }
    const kam = poleVedle(hra, plan.bunky);
    for (const [druh, n] of Object.entries(plan.doneseno)) for (let k = 0; k < n; k++) vratVec(hra, druh, kam);
    hra.zmenaPraci++;
  }
  // věc vrácená z plánu / dílny / zbouraná stavba: nevzniká nová (účetně se jen přesouvá zpět na zem)
  function vratVec(hra, druh, g) { const v = PR.novaVec(hra, druh, g); hra.vytvoreno--; hra.ulozeno--; return v; }

  // --- stavění ------------------------------------------------------------------------
  function postav(hra, plan) {
    const sv = hra.sv, d = STAVBY[plan.typ];
    zrusPlanNa(hra, plan);
    for (const [druh, n] of Object.entries(plan.doneseno)) { hra.spotrebovano += n; hra.ulozeno -= n; }
    // kdo stojí na poli blokující stavby, ustoupí; věci se odsunou vedle
    if (blokuje(plan.typ)) {
      for (const t of hra.trpaslici) if (plan.bunky.includes(t.g)) { S.hra.pustPraci(hra, t); t.g = vedle(hra, plan.bunky); t.krokDoba = 0; t.dalsi = -1; }
      for (const v of hra.veci) if (v.g >= 0 && plan.bunky.includes(v.g)) v.g = vedle(hra, plan.bunky);
    }
    if (d.obj !== undefined) for (const h of plan.bunky) sv.obj[h] = d.obj;
    if (d.zed) for (const h of plan.bunky) { sv.teren[h] = M.CIHLA; sv.otes[h] = 0; }
    if (d.podlaha !== undefined) for (const h of plan.bunky) sv.podlaha[h] = d.podlaha;
    let b = null;
    if (d.budova || d.dilna) {
      b = { id: plan.id, typ: plan.typ, g: plan.g, smer: plan.smer, bunky: plan.bunky.slice() };
      if (plan.vmat) b.mat = plan.vmat;
      if (d.dilna) {
        b.fronta = []; b.mista = [noveMisto(), noveMisto()];
        for (const [r, n] of VYCHOZI_ZAKAZKY[plan.typ] || []) pridejZakazku(hra, b, r, n, true);
      }
      hra.budovy.push(b);
      for (const h of b.bunky) { hra.budovaNa[h] = b.id; if (blokuje(b.typ)) sv.blok[h] = 1; }
    }
    for (const h of plan.bunky) PR.zmenaTerenu(hra, h);
    PR.zprava(hra, 'stavba', `Postaveno: ${d.nazev}.`, plan.g);
    return b;
  }
  function zrusPlanNa(hra, plan) {
    const i = hra.plany.indexOf(plan);
    if (i >= 0) hra.plany.splice(i, 1);
    for (const h of plan.bunky) if (hra.planNa.get(h) === plan.id) hra.planNa.delete(h);
    hra.zmenaPraci++;
  }
  // nejbližší průchozí pole mimo bunky
  function vedle(hra, bunky) {
    const set = new Set(bunky), sv = hra.sv;
    const r = C.hledej(hra, bunky.filter(h => sv.teren[h] === M.VOLNO), g => !set.has(g) && C.pruchozi(sv, g), 3000);
    if (r) return r.cil;
    for (const h of bunky) for (const s of PR.stojiskaKolem(sv, h)) if (!set.has(s)) return s;
    return bunky[0];
  }
  // padací mříž: zavřená blokuje průchod (trpaslíky i tvory)
  function prepniMriz(hra, b, zavrit) {
    b.zavreno = zavrit === undefined ? !b.zavreno : !!zavrit;
    hra.sv.blok[b.g] = b.zavreno ? 1 : 0;
    if (b.zavreno) for (const t of hra.trpaslici) if (t.g === b.g) { S.hra.pustPraci(hra, t); t.g = vedle(hra, [b.g]); t.krokDoba = 0; t.dalsi = -1; }
    PR.zmenaTerenu(hra, b.g); hra.zmenaPraci++;
  }
  const budovaPodle = (hra, id) => hra.budovy.find(b => b.id === id) || null;
  const budovaNa = (hra, g) => hra.budovaNa[g] ? budovaPodle(hra, hra.budovaNa[g]) : null;
  // zbourání: materiál stavby (a zásoba dílny) se vrátí na zem
  function zbourej(hra, b) {
    const sv = hra.sv, d = STAVBY[b.typ];
    const i = hra.budovy.indexOf(b); if (i < 0) return false;
    hra.budovy.splice(i, 1);
    for (const h of b.bunky) { hra.budovaNa[h] = 0; sv.blok[h] = 0; PR.zmenaTerenu(hra, h); S.priroda.aktivuj(hra, h); }
    const kam = poleVedle(hra, b.bunky);
    for (const [druh, n] of Object.entries(d.mat)) for (let k = 0; k < n; k++) { PR.novaVec(hra, druh, kam); hra.spotrebovano--; hra.vytvoreno--; }
    if (b.mista) for (const m of b.mista) for (const [druh, n] of Object.entries(m.zasoba)) for (let k = 0; k < n; k++) vratVec(hra, druh, kam);
    for (const t of hra.trpaslici) if (t.prace && t.prace.dilna === b.id) S.hra.pustPraci(hra, t);
    hra.zmenaPraci++;
    PR.zprava(hra, 'stavba', `Zbouráno: ${d.nazev}.`, b.g);
    return true;
  }

  // --- zóny: sklady, místnosti, farmy -------------------------------------------------
  const ZONY = {
    sklad: { nazev: 'sklad', ikona: '📦', barva: [214, 168, 42], popis: 'Sem trpaslíci nosí věci (4 na pole). Filtr určí, co sklad přijímá.' },
    loznice: { nazev: 'ložnice', ikona: '🛏️', barva: [90, 140, 230], popis: 'Postele pro spánek. Kvalita místnosti zlepší spánek; uzavřený pokoj s jedinou postelí je něčí vlastní.' },
    jidelna: { nazev: 'jídelna', ikona: '🍽️', barva: [110, 190, 90], popis: 'Stoly a židle. Jídlo u stolu zlepší náladu podle kvality místnosti.' },
    osetrovna: { nazev: 'ošetřovna', ikona: '🩹', barva: [230, 90, 90], popis: 'Postele pro zraněné: hojení je třikrát rychlejší.' },
    pole: { nazev: 'pole ječmene', ikona: '🌾', barva: [220, 200, 90], popis: 'Na louce v rokli. Ječmen dozraje zhruba za dva dny, pole dá 2 snopy.' },
    taboriste: { nazev: 'tábořiště', ikona: '⛺', barva: [200, 140, 80], popis: 'Venku v rokli. Kdo nemá postel, přespí tu pod stanem (−2 místo −6 za spánek na zemi).' },
    houbarna: { nazev: 'houbárna', ikona: '🍄', barva: [170, 110, 210], popis: 'Pod zemí na surové podlaze. Houby dorostou za 2–3 dny (u vody rychleji), pole dá 1 houbu.' },
  };
  const FARMY = { pole: 'jecmen', houbarna: 'houby' };
  const CIL_FARMY = n => Math.max(12, 5 * n);
  function lzeZona(hra, g, typ) {
    const sv = hra.sv;
    if (!(sv.teren[g] === M.VOLNO && sv.zn[g] && !sv.kap[g] && !sv.blok[g])) return false;
    if (typ === 'pole') {
      const o = sv.oblast[g];
      return g < sv.N && o && sv.oblasti[o].typ === 'rokle' && (sv.podlaha[g] === P.TRAVA || sv.podlaha[g] === P.HLINA) &&
        (sv.obj[g] === O.NIC || sv.obj[g] === O.JECMEN) && !hra.budovaNa[g];
    }
    if (typ === 'taboriste') { const o = sv.oblast[g]; return g < sv.N && o && sv.oblasti[o].typ === 'rokle' && C.pruchozi(sv, g); }
    if (typ === 'houbarna') return g >= sv.N && (sv.podlaha[g] === P.SUROVA || sv.podlaha[g] === P.MECH) && sv.obj[g] === O.NIC && !hra.budovaNa[g];
    return C.pruchozi(sv, g) || !!hra.budovaNa[g];
  }
  function novaZona(hra, p, x0, y0, x1, y1, typ) {
    const sv = hra.sv, z = { id: hra.dalsiId++, typ: typ || 'sklad', p, filtr: null, prio: false };
    let n = 0;
    for (let y = Math.max(0, y0); y <= Math.min(sv.H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(sv.W - 1, x1); x++) {
      const g = p * sv.N + y * sv.W + x;
      if (!lzeZona(hra, g, z.typ) || hra.zona[g]) continue;
      hra.zona[g] = z.id; n++; PR.zmena(hra, g); zonZmena(hra);
      if (z.typ === 'pole' && sv.obj[g] === O.JECMEN) { sv.obj[g] = O.NIC; hra.uroda[g] = 60; PR.zmenaTerenu(hra, g); }   // divoký ječmen na poli už roste
    }
    if (!n) return null;
    hra.zony.push(z); hra.zmenaPraci++;
    return z;
  }
  // zóna na zadaných polích (vyplnění místnosti)
  function zonaNaPolich(hra, bunky, typ) {
    const z = { id: hra.dalsiId++, typ: typ || 'sklad', p: (bunky[0] / hra.sv.N) | 0, filtr: null, prio: false };
    let n = 0;
    for (const g of bunky) if (lzeZona(hra, g, z.typ) && !hra.zona[g]) { hra.zona[g] = z.id; n++; PR.zmena(hra, g); zonZmena(hra); }
    if (!n) { hra.dalsiId--; return null; }
    hra.zony.push(z); hra.zmenaPraci++;
    return z;
  }
  function zrusZonu(hra, p, x0, y0, x1, y1) {
    const sv = hra.sv;
    let n = 0;
    for (let y = Math.max(0, y0); y <= Math.min(sv.H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(sv.W - 1, x1); x++) {
      const g = p * sv.N + y * sv.W + x;
      if (hra.zona[g]) { hra.zona[g] = 0; hra.uroda[g] = 0; n++; PR.zmena(hra, g); zonZmena(hra); }
    }
    if (n) uklidZony(hra);
    return n;
  }
  function uklidZony(hra) {
    const ziva = new Set();
    for (const g of zonaBunky(hra)) ziva.add(hra.zona[g]);
    hra.zony = hra.zony.filter(z => ziva.has(z.id));
    hra.zmenaPraci++;
  }
  function zrusZonuId(hra, id) {
    for (let g = 0; g < hra.zona.length; g++) if (hra.zona[g] === id) { hra.zona[g] = 0; hra.uroda[g] = 0; PR.zmena(hra, g); zonZmena(hra); }
    uklidZony(hra);
  }
  const zonaPodle = (hra, id) => hra.zony.find(z => z.id === id) || null;
  const zonaNa = (hra, g) => hra.zona[g] ? zonaPodle(hra, hra.zona[g]) : null;
  function nastavFiltr(hra, z, skupiny) { z.filtr = skupiny && skupiny.length < Object.keys(SKUPINY_VECI).length ? skupiny.slice() : null; hra.zmenaPraci++; }
  // přijme pole g věc druhu? (sklad podle filtru, truhla/sud jako malý sklad)
  function prijme(hra, g, druh) {
    const b = hra.budovaNa[g] ? budovaNa(hra, g) : null;
    if (b && STAVBY[b.typ].sklad) return b.typ === 'sud' ? DRUHY_SUDU.has(druh) : !DRUHY_SUDU.has(druh);
    const z = zonaNa(hra, g);
    if (!z || z.typ !== 'sklad') return false;
    return !z.filtr || z.filtr.includes(SKUPINA_DRUHU[druh] || 'vyrobky');
  }
  function kapacita(hra, g) {
    const b = hra.budovaNa[g] ? budovaNa(hra, g) : null;
    if (b && STAVBY[b.typ].sklad) return STAVBY[b.typ].sklad;
    return hra.zona[g] ? KAPACITA_POLE : 0;
  }

  // --- zakázky dílen ------------------------------------------------------------------
  function pridejZakazku(hra, dilna, r, pocet, trvala) {
    const rc = (RECEPTY[dilna.typ] || [])[r];
    if (!rc || !(pocet > 0)) return false;
    const z = dilna.fronta.find(z => z.r === r && !!z.trvala === !!trvala);
    if (z && trvala) z.cil = Math.max(0, z.cil + pocet);
    else if (z) z.zbyva += pocet;
    else dilna.fronta.push({ id: hra.dalsiId++, r, trvala: !!trvala, cil: trvala ? pocet : 0, zbyva: trvala ? 0 : pocet });
    hra.zmenaPraci++;
    return true;
  }
  function zrusZakazku(hra, dilna, id) {
    const i = dilna.fronta.findIndex(z => z.id === id);
    if (i < 0) return;
    dilna.fronta.splice(i, 1);
    for (const m of dilna.mista) if (m.aktivni && m.aktivni.zak === id && !maZasobu(m)) m.aktivni = null;
    hra.zmenaPraci++;
  }
  function posunZakazku(hra, dilna, id, o) {
    const k = dilna.fronta.findIndex(z => z.id === id), j = k + o;
    if (k < 0 || j < 0 || j >= dilna.fronta.length) return;
    [dilna.fronta[k], dilna.fronta[j]] = [dilna.fronta[j], dilna.fronta[k]];
    for (const m of dilna.mista) if (m.aktivni && !maZasobu(m)) m.aktivni = null;     // nerozdělaná místa si vyberou znovu
    hra.zmenaPraci++;
  }
  const maZasobu = m => Object.keys(m.zasoba).length > 0 || Object.values(m.prichazi).some(n => n > 0);
  // kolik kusů je v hoře (na zemi, v rukou) – pro „udržuj N“
  function pocty(hra) {
    const c = {};
    for (const v of hra.veci) c[v.druh] = (c[v.druh] || 0) + 1;
    return c;
  }
  // Dílna má DVĚ PRACOVIŠTĚ (d.mista[0], [1]) – dva řemeslníci vyrábějí naráz. Každé místo má aktivní zakázku,
  // zásobu materiálu a příchozí kusy. Druhé místo nebere zakázku nad její počet a ani materiál, na který čeká první.
  function noveMisto() { return { aktivni: null, zasoba: {}, prichazi: {} }; }
  function zvolZakazku(hra, d, celkem, volne) {
    const naZak = z => d.mista.filter(m => m.aktivni && m.aktivni.zak === z.id).length;
    for (const m of d.mista) {
      if (!m.aktivni) continue;
      const z = d.fronta.find(z => z.id === m.aktivni.zak);
      if (!z || !(maZasobu(m) || potreba(z, d, celkem, naZak(z) - 1))) m.aktivni = null;
      else for (const [druh, n] of Object.entries(materialReceptu(RECEPTY[d.typ][z.r])))
        volne[druh] = (volne[druh] || 0) - Math.max(0, n - (m.zasoba[druh] || 0) - (m.prichazi[druh] || 0));
    }
    for (const m of d.mista) {
      if (m.aktivni) continue;
      for (const z of d.fronta) {
        if (!potreba(z, d, celkem, naZak(z))) continue;
        if (RECEPTY[d.typ][z.r].pribeh && S.pribeh.zakazano(hra, RECEPTY[d.typ][z.r].vyrobek)) continue;
        const mat = materialReceptu(RECEPTY[d.typ][z.r]);
        if (!Object.keys(mat).every(druh => (m.zasoba[druh] || 0) + (volne[druh] || 0) >= mat[druh])) continue;
        m.aktivni = { zak: z.id, r: z.r };
        for (const [druh, n] of Object.entries(mat)) volne[druh] = (volne[druh] || 0) - Math.max(0, n - (m.zasoba[druh] || 0));
        break;
      }
    }
  }
  // je zakázka potřeba, i když už na ní pracuje `uz` jiných míst?
  function potreba(z, d, celkem, uz) {
    const rc = RECEPTY[d.typ][z.r];
    if (!z.trvala) return z.zbyva > (uz || 0);
    return (celkem[rc.vyrobek] || 0) + (uz || 0) * (rc.pocet || 1) < z.cil;
  }
  const chybiDilne = (d, k, druh) => {
    const m = d.mista[k];
    if (!m || !m.aktivni) return 0;
    const mat = materialReceptu(RECEPTY[d.typ][m.aktivni.r]);
    return (mat[druh] || 0) - (m.zasoba[druh] || 0) - (m.prichazi[druh] || 0);
  };
  const pripravena = (d, k) => { const m = d.mista[k]; return !!m && !!m.aktivni && Object.entries(materialReceptu(RECEPTY[d.typ][m.aktivni.r])).every(([druh, n]) => (m.zasoba[druh] || 0) >= n); };
  const aktivniDilny = d => d.mista.filter(m => m.aktivni).map(m => RECEPTY[d.typ][m.aktivni.r]);

  // výroba hotová: spotřebuje materiál místa, výrobek položí na výstupní pole
  function vyrob(hra, d, k, t) {
    if (!pripravena(d, k)) return false;
    const m = d.mista[k], rc = RECEPTY[d.typ][m.aktivni.r], mat = materialReceptu(rc);
    for (const [druh, n] of Object.entries(mat)) { m.zasoba[druh] -= n; if (!m.zasoba[druh]) delete m.zasoba[druh]; hra.spotrebovano += n; hra.ulozeno -= n; }
    const pp = predniPole(hra.sv, d), vystup = pp.length ? pp[pp.length - 1] : t.g;
    const kam = C.pruchozi(hra.sv, vystup) ? vystup : t.g;
    const vmat = rc.vmat || (rc.mat[0] === 'kamen' ? 'kamen' : undefined);   // kamenný nábytek, železný/měděný nástroj
    if (rc.pribeh) S.pribeh.vyroben(hra, rc.vyrobek, kam);
    else for (let n = 0; n < (rc.pocet || 1); n++) PR.novaVec(hra, rc.vyrobek, kam, vmat);
    const z = d.fronta.find(z => z.id === m.aktivni.zak);
    if (z && !z.trvala) { z.zbyva--; if (z.zbyva <= 0) d.fronta.splice(d.fronta.indexOf(z), 1); }
    m.aktivni = null;
    hra.vyrobeno = (hra.vyrobeno || 0) + 1;
    hra.zmenaPraci++;
    return true;
  }

  // --- jednotky práce staveb, dílen a nošení --------------------------------------------
  // volá prace.prestavJednotky: pridej(jednotka)
  function jednotky(hra, pridej) {
    const sv = hra.sv, nouze = hra.nouze || {};
    // volné věci na zemi podle druhu (pole, kde leží)
    const volne = {}, polaDruhu = {};
    for (const v of hra.veci) {
      if (v.g < 0 || !C.pruchozi(sv, v.g)) continue;
      volne[v.druh] = (volne[v.druh] || 0) + 1;
      (polaDruhu[v.druh] || (polaDruhu[v.druh] = new Set())).add(v.g);
    }
    // co materiál „neodnese“ ze skladu jinam: věc pro plán/dílnu se bere odkudkoli
    const sloty = (klicBase, druh, n, extra) => {
      const pol = polaDruhu[druh];
      if (!pol || n <= 0) return;
      const st = [...pol];
      for (let k = 0; k < n; k++) pridej(Object.assign({ klic: klicBase + ':' + druh + ':' + k, druh: 'donest', vecDruh: druh, stojiste: st, prio: false }, extra));
    };
    // plány staveb
    for (const pl of hra.plany.slice()) {
      if (pl.zeSkaly) { if (sv.teren[pl.g] === M.VOLNO || hra.oznac[pl.g] !== PR.OZN.KOPAT) zrusPlan(hra, pl); continue; }
      if (lzePostavit(hra, pl.typ, pl.g, pl.smer, pl.id) && !kompletni(pl)) {
        // místo už nejde (např. někdo prorazil díru): plán se zruší
        if (STAVBY[pl.typ].misto !== 'dira' || sv.obj[pl.g] !== O.DIRA) { zrusPlan(hra, pl); PR.zprava(hra, 'varovani', `Plán (${STAVBY[pl.typ].nazev}) zrušen – místo už nevyhovuje.`, pl.g); continue; }
      }
      if (kompletni(pl)) {
        const st = new Set();
        const vcetne = !blokuje(pl.typ) && STAVBY[pl.typ].misto !== 'dira' && STAVBY[pl.typ].misto !== 'lavka';
        for (const h of pl.bunky) for (const s of PR.stojiskaKolem(sv, h, vcetne)) if (vcetne || !pl.bunky.includes(s)) st.add(s);
        pridej({ klic: 'b' + pl.id, druh: 'stavet', plan: pl.id, cil: pl.g, stojiste: [...st], prio: pl.prio || (!!nouze.strop && STAVBY[pl.typ].obj === O.SLOUP) });
        continue;
      }
      for (const druh of Object.keys(STAVBY[pl.typ].mat)) sloty('p' + pl.id, druh, chybi(pl, druh), { cilTyp: 'plan', cilId: pl.id, prio: pl.prio || (!!nouze.strop && STAVBY[pl.typ].obj === O.SLOUP) });
    }
    // dílny (v nouzi hladu má kuchyně přednost a obslouží ji kdokoli)
    const celkem = pocty(hra);
    for (const d of hra.budovy) {
      if (!STAVBY[d.typ].dilna) continue;
      zvolZakazku(hra, d, celkem, volne);
      const pp = predniPole(sv, d), hlad = nouze.hlad && d.typ === 'kuchyne';
      d.mista.forEach((m, k) => {
        if (!m.aktivni) return;
        if (pripravena(d, k)) {
          // pracuje se z předního pole místa (první místo vlevo, druhé vpravo); když je zastavěné, z kteréhokoli
          const vlastni = pp[k * (pp.length - 1)];
          const st = vlastni !== undefined && C.pruchozi(sv, vlastni) ? [vlastni] : pp.filter(h => C.pruchozi(sv, h));
          pridej({ klic: 'v' + d.id + ':' + k, druh: 'vyrobit', dilna: d.id, misto: k, dilnaTyp: d.typ, cil: d.g, stojiste: st,
                   prof: hlad ? undefined : PROFESE_DILNY[d.typ] || null, prio: hlad });
          return;
        }
        for (const druh of Object.keys(materialReceptu(RECEPTY[d.typ][m.aktivni.r])))
          sloty('d' + d.id + ':' + k, druh, chybiDilne(d, k, druh), { cilTyp: 'dilna', cilId: d.id, misto: k, prio: hlad });
      });
    }
    // pumpy: čerpá se, dokud je do 3 polí voda (v nouzi „voda“ přednostně)
    for (const b of hra.budovy) {
      if (b.typ !== 'pumpa' || S.priroda.vodaUPumpy(hra, b) < 0) continue;
      pridej({ klic: 'u' + b.id, druh: 'pumpovat', pumpa: b.id, cil: b.g, stojiste: PR.stojiskaKolem(sv, b.g), prio: !!nouze.voda });
    }
    // farmy: setí (prázdné pole) a sklizeň (zralé, dokud je plodiny méně než cíl)
    if (hra.zony.some(z => FARMY[z.typ])) {
      const typy = {}; for (const z of hra.zony) typy[z.id] = z.typ;
      const cil = CIL_FARMY(hra.trpaslici.length);
      for (const g of zonaBunky(hra)) {
        const typ = hra.zona[g] && typy[hra.zona[g]];
        if (!FARMY[typ] || !C.pruchozi(sv, g)) continue;
        if (!hra.uroda[g]) pridej({ klic: 'z' + g, druh: 'zasit', cil: g, stojiste: [g], prio: false });
        else if (hra.uroda[g] > 100 && (celkem[FARMY[typ]] || 0) < cil) pridej({ klic: 'z' + g, druh: 'sklidit', cil: g, stojiste: [g], prio: !!nouze.pole });
      }
    }
    // nošení do skladu: věci mimo sklad, který je přijímá – jen druhy, pro které je někde místo
    const misto = volnaMista(hra);
    if (misto.size) for (const v of hra.veci) {
      if (v.g < 0 || prijme(hra, v.g, v.druh) || !C.pruchozi(sv, v.g) || v.neodnaset > hra.tik) continue;
      if (!misto.has(v.druh)) continue;
      pridej({ klic: 'o' + v.id, druh: 'odnest', vec: v.id, cil: v.g, stojiste: [v.g], prio: false });
    }
  }
  // růst úrody (volá hra každých 60 tahů): pole +5 (zralé za ~2 dny), houbárna +4 (~2,5 dne), u vody +5
  function rust(hra) {
    const sv = hra.sv, typy = {};
    for (const z of hra.zony) if (FARMY[z.typ]) typy[z.id] = z.typ;
    if (!Object.keys(typy).length) return;
    for (const g of zonaBunky(hra)) {
      const typ = hra.zona[g] && typy[hra.zona[g]];
      if (!typ || !hra.uroda[g] || hra.uroda[g] > 100) continue;
      const pred = hra.uroda[g];
      const rust = typ === 'pole' ? 5 * (S.obdobi ? S.obdobi.OBDOBI[S.obdobi.obdobi(hra)].rust : 1) : S.potreby.uVody(sv, g) ? 5 : 4;
      if (!rust) continue;                                                  // v zimě pole neroste
      hra.uroda[g] = Math.min(101, pred + Math.round(rust));
      if ((pred / 34 | 0) !== (hra.uroda[g] / 34 | 0)) PR.zmena(hra, g);
      if (hra.uroda[g] > 100) hra.zmenaPraci++;          // dozrálo: přibude jednotka sklizně
    }
  }
  function sklid(hra, g, t) {
    const z = zonaNa(hra, g);
    if (!z || !FARMY[z.typ] || hra.uroda[g] <= 100) return false;
    for (let k = 0; k < (z.typ === 'pole' ? 2 : 1); k++) PR.novaVec(hra, FARMY[z.typ], t.g);
    hra.uroda[g] = 0; PR.zmena(hra, g); hra.zmenaPraci++;
    return true;
  }
  function zasej(hra, g) {
    const z = zonaNa(hra, g);
    if (!z || !FARMY[z.typ] || hra.uroda[g]) return false;
    hra.uroda[g] = 1; PR.zmena(hra, g); hra.zmenaPraci++;
    return true;
  }

  // druhy, pro které je ve skladech volné místo
  function volnaMista(hra) {
    const naPoli = new Map();
    for (const v of hra.veci) if (v.g >= 0) naPoli.set(v.g, (naPoli.get(v.g) || 0) + 1);
    const r = new Set(), vsechny = Object.keys(PR.VECI);
    const zony = new Map();
    for (const g of zonaBunky(hra)) {
      const id = hra.zona[g];
      if (!id) continue;
      if ((naPoli.get(g) || 0) + (hra.prichoziNa.get(g) || 0) < KAPACITA_POLE) zony.set(id, true);
    }
    for (const z of hra.zony) if (z.typ === 'sklad' && zony.has(z.id)) for (const d of vsechny)      // jen sklady (ložnice, pole… věci nepřijímají) if (!z.filtr || z.filtr.includes(SKUPINA_DRUHU[d] || 'vyrobky')) r.add(d);
    for (const b of hra.budovy) if (STAVBY[b.typ].sklad) {
      const n = (naPoli.get(b.g) || 0) + (hra.prichoziNa.get(b.g) || 0);
      if (n < STAVBY[b.typ].sklad) for (const d of vsechny) if (prijme(hra, b.g, d)) r.add(d);
    }
    return r;
  }

  S.stavby = { NASTROJE, OPOTREBENI, PREFERUJE, STAVBY, SKUPINY_STAVEB, RECEPTY, PROFESE_DILNY, SKUPINY_VECI, SKUPINA_DRUHU, KAPACITA_POLE, nazevReceptu, materialReceptu,
               rozmer, bunkyStavby, predniPole, blokuje, lzePostavit, naplanuj, planPodle, chybi, kompletni, zrusPlan, postav,
               budovaPodle, budovaNa, zbourej, prepniMriz, zonaBunky, zonZmena, ZONY, FARMY, CIL_FARMY, rust, sklid, zasej, uklidZony, lzeZona, novaZona, zonaNaPolich, zrusZonu, zrusZonuId, zonaPodle, zonaNa, nastavFiltr, prijme, kapacita,
               pridejZakazku, zrusZakazku, posunZakazku, pocty, vyrob, chybiDilne, pripravena, aktivniDilny, jednotky, poleVedle, vratVec };
})(SIN);

if (typeof module !== 'undefined') module.exports = SIN;

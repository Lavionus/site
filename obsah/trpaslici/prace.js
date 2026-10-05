/* ============================================================
   Srdce hory – prace.js: označení prací, kopání a věci.

   Hráč označuje pole ke kopání (případně k vytesání schodiště).
   Trpaslík kope pole v dosahu: vedle sebe, nad i pod sebou,
   šikmo a až dvě pole nad hlavou (když je mezi nimi volno).
   Vykopaná hornina někdy dá kus kamene, ruda vždy kus rudy; věci
   padají na zem a trpaslíci je nosí do skladu (zatím podlaha předsíně).
   Čistá logika bez DOM.
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const { W, H, M, R, MATERIAL, RUDA, pevne } = T.hora;
  const C = T.cesty;
  const N = W * H;

  const OZN = { NIC: 0, KOPAT: 1, SCHODY: 2, KACET: 3, TESAT: 4, BOURAT: 5 };
  // otesání: zadní stěna vykopané prostory (pozadí → kamenný obklad) nebo líc nevykopané horniny – podlaha, strop,
  // boční stěna (terén → opracovaný kámen, ruda v něm se vytěží); hliněná stěna či líc spotřebuje kámen
  const OTESANE = [M.ZED, M.CIHLA, M.RUNA], ZA_KAMEN = [M.HLINA, M.JIL, M.SUT];
  const volno = (hra, j) => j >= 0 && j < N && hra.hora.teren[j] === M.VZDUCH;
  const jePodlaha = (hra, i) => i >= W && hra.hora.teren[i] !== M.VZDUCH && volno(hra, i - W);
  // líc = pevné pole, které sousedí s volnem (podlaha, strop, boční stěna místnosti či chodby)
  const jeLic = (hra, i) => hra.hora.teren[i] !== M.VZDUCH && (volno(hra, i - W) || volno(hra, i + W) || (i % W > 0 && volno(hra, i - 1)) || (i % W < W - 1 && volno(hra, i + 1)));
  const lzeTesat = (hra, i) => !hra.znamo[i] ? false
    : hra.hora.teren[i] === M.VZDUCH ? hra.hora.pozadi[i] !== M.VZDUCH && !OTESANE.includes(hra.hora.pozadi[i])
    : jeLic(hra, i) && lzeKopat(hra, i) && !OTESANE.includes(hra.hora.teren[i]) && !hra.lez[i];
  const tesatZaKamen = (hra, i) => ZA_KAMEN.includes(hra.hora.teren[i] === M.VZDUCH ? hra.hora.pozadi[i] : hra.hora.teren[i]);
  // odkud na líc dosáhne: stojné pole s, ze kterého je líc v dosahu kopání (DOSAH, včetně podmínky volného pole
  // „přes" jako u cilKopani – skrz skálu se netesá); i % W hlídá okraj mapy
  const pruchodne = (hra, s, px, py) => { if (px === undefined) return true; const x = s % W + px, k = s + py * W + px; return x >= 0 && x < W && k >= 0 && k < N && C.volne(hra, k); };
  function stojiskaLice(hra, i) {
    const x = i % W, r = [];
    for (const [dx, dy, px, py] of DOSAH) {
      const sx = x - dx, s = i - dy * W - dx;
      if (sx < 0 || sx >= W || s < 0 || s >= N) continue;
      if (C.stojne(hra, s) && pruchodne(hra, s, px, py) && !r.includes(s)) r.push(s);
    }
    return r;
  }
  // dosáhne trpaslík? Na zadní stěnu stojí na ní, pod ní nebo dvě pole pod ní (mezi nimi volno); na líc z pole v dosahu
  // kopání (jako cilTesani v hra.js)
  const kTesani = (hra, i) => hra.hora.teren[i] === M.VZDUCH
    ? C.stojne(hra, i) || (i + W < N && C.stojne(hra, i + W)) || (i + 2 * W < N && C.volne(hra, i + W) && C.stojne(hra, i + 2 * W))
    : stojiskaLice(hra, i).length > 0;
  // co z pole s (stojí tu) může otesat jako líc: pole v dosahu kopání
  function licZDosahu(hra, s, fn) {
    const x = s % W;
    for (const [dx, dy, px, py] of DOSAH) {
      const cx = x + dx, c = s + dy * W + dx;
      if (cx < 0 || cx >= W || c < 0 || c >= N || !pruchodne(hra, s, px, py)) continue;
      const r = fn(c); if (r >= 0) return r;
    }
    return -1;
  }
  // otesaný líc: terén → opracovaný kámen; ruda se vytěží a položí tam, kde tesař stojí (kam). Původní hornina se
  // pamatuje v hra.tesano (ukládá se): strop drží aspoň jako dřív (rozpetiNa) a vykopaný líc dá to, co by dala hornina
  function otesejPodlahu(hra, c, zprava, kam) {
    if (kam === undefined) kam = c - W;
    const r = hra.hora.ruda[c];
    if (hra.tesano && !hra.tesano[c]) hra.tesano[c] = hra.hora.teren[c];
    hra.hora.teren[c] = M.ZED; hra.hora.ruda[c] = 0;
    hra.svetloZmena++; hra.stabilitaZmena++;
    if (r && Z_RUDY[r]) {
      const druh = Z_RUDY[r];
      novaVec(hra, druh, kam, 0, 'kopání');
      if (!hra.nalezeno[druh]) { hra.nalezeno[druh] = 1; zprava('nalez', `Našli jsme ${VECI[druh].nazev}!`, c); }
      usadVeci(hra);
    }
  }

  // druhy věcí
  const VECI = {
    kamen:    { nazev: 'kámen', ikona: '🪨' },
    jil:      { nazev: 'jíl', ikona: '🟫' },
    uhli:     { nazev: 'uhlí', ikona: '⚫' },
    zelezo:   { nazev: 'železná ruda', ikona: '🟥' },
    med:      { nazev: 'měděná ruda', ikona: '🟧' },
    stribro:  { nazev: 'stříbro', ikona: '⚪' },
    zlato:    { nazev: 'zlato', ikona: '🟡' },
    drahokam: { nazev: 'drahokam', ikona: '💎' },
    hvezdna:  { nazev: 'hvězdná ruda', ikona: '✨' },
    drevo:    { nazev: 'dřevo', ikona: '🪵' },
    postel:   { nazev: 'postel', ikona: '🛏️' },
    stul:     { nazev: 'stůl', ikona: '🍽️' },
    zidle:    { nazev: 'židle', ikona: '🪑' },
    socha:    { nazev: 'socha', ikona: '🗿' },
    jidlo:    { nazev: 'jídlo', ikona: '🍖' },
    pivo:     { nazev: 'pivo', ikona: '🍺' },
    houby:    { nazev: 'houby', ikona: '🍄' },
    jecmen:   { nazev: 'ječmen', ikona: '🌾' },
    prut_zelezo:  { nazev: 'železný prut', ikona: '🔩' },
    prut_med:     { nazev: 'měděný prut', ikona: '🟠' },
    prut_stribro: { nazev: 'stříbrný prut', ikona: '🥈' },
    prut_zlato:   { nazev: 'zlatý prut', ikona: '🥇' },
    krumpac:  { nazev: 'krumpáč', ikona: '⛏️' },
    sekera:   { nazev: 'sekera', ikona: '🪓' },
    kladivo:  { nazev: 'kladivo', ikona: '🔨' },
    brus:     { nazev: 'broušený drahokam', ikona: '💠' },
    sperk:    { nazev: 'šperk', ikona: '💍' },
    pohar:    { nazev: 'stříbrný pohár', ikona: '🏆' },
    valecna_sekera: { nazev: 'válečná sekera', ikona: '🪓' },
    zbroj:    { nazev: 'zbroj', ikona: '🛡️' },
    hedvabi:  { nazev: 'pavoučí hedvábí', ikona: '🕸️' },
    cepel:    { nazev: 'goblinská čepel', ikona: '🗡️' },
    prut_hvezdny: { nazev: 'hvězdná ocel', ikona: '🌟' },
    klic:     { nazev: 'Klíč k Srdci', ikona: '🗝️' },
    art_kladivo: { nazev: 'Durinovo kladivo', ikona: '🔨' },
    art_lampa:   { nazev: 'Lampa předků', ikona: '🏮' },
    art_roh:     { nazev: 'Roh hory', ikona: '📯' },
    art_klic:    { nazev: 'Klíč k Srdci', ikona: '🗝️' },
  };
  const Z_RUDY = { [R.UHLI]: 'uhli', [R.ZELEZO]: 'zelezo', [R.MED]: 'med', [R.STRIBRO]: 'stribro',
                   [R.ZLATO]: 'zlato', [R.DRAHOKAM]: 'drahokam', [R.HVEZDNA]: 'hvezdna' };
  // původní hornina otesaného líce (jinak terén)
  const puvodni = (hra, i) => hra.hora.teren[i] === M.ZED && hra.tesano && hra.tesano[i] ? hra.tesano[i] : hra.hora.teren[i];
  // kolik polí stropu pole unese: otesaný líc aspoň jako původní hornina (obsidián 15 zůstane 15, hlína 3 → zeď 10)
  const rozpetiNa = (hra, i) => Math.max(MATERIAL[hra.hora.teren[i]].rozpeti || 1, MATERIAL[puvodni(hra, i)].rozpeti || 1);
  const KAMEN_Z = { [M.VAPENEC]: 0.35, [M.ZULA]: 0.35, [M.CEDIC]: 0.35, [M.HLUBINNY]: 0.35, [M.CIHLA]: 0.6, [M.RUNA]: 0.5, [M.ZED]: 1, [M.SUT]: 0.5, [M.OBSIDIAN]: 0.5 };

  // dá se pole označit? (pevné a prokopatelné; neprozkoumané pole se označit dá – co v něm je, se ukáže)
  function lzeKopat(hra, i) {
    const t = hra.hora.teren[i];
    return pevne(t) && t !== M.PODLOZI && i !== (hra.hora.srdce.y + 1) * W + hra.hora.srdce.x;   // podstavec Výhně předků drží
  }
  // co jde zbourat: postavená stavba (dílna, studna, nábytek, louč, podpěra…), žebřík nebo výtah na známém poli
  const lzeBourat = (hra, i) => !!hra.znamo[i] && (!!hra.stavba[i] || hra.lez[i] === 2 || hra.lez[i] === 3);
  function oznac(hra, x0, y0, x1, y1, druh) {
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (y0 > y1) [y0, y1] = [y1, y0];
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W - 1, x1); y1 = Math.min(H - 1, y1);
    let n = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (druh === 'zrusit') { if (hra.oznac[i]) { hra.oznac[i] = 0; hra.prio[i] = 0; n++; } continue; }
      if (druh === 'prio') { if (hra.oznac[i] === OZN.KOPAT || hra.oznac[i] === OZN.SCHODY) { hra.prio[i] ^= 1; n++; } continue; }
      if (druh === 'kacet') {                     // i pařez: až doroste, skácí se
        const o = hra.hora.obj[i];
        if ((o === T.hora.O.STROM || o === T.hora.O.HOUBA || o === T.hora.O.PAREZ) && hra.znamo[i] && hra.oznac[i] !== OZN.KACET) { hra.oznac[i] = OZN.KACET; n++; }
        continue;
      }
      if (druh === 'nekacet') { if (hra.oznac[i] === OZN.KACET) { hra.oznac[i] = 0; n++; } continue; }
      if (druh === 'bourat') { if (lzeBourat(hra, i) && hra.oznac[i] !== OZN.BOURAT) { hra.oznac[i] = OZN.BOURAT; hra.prio[i] = 0; n++; } continue; }
      if (druh === 'tesat') { if (lzeTesat(hra, i) && kTesani(hra, i) && !hra.oznac[i]) { hra.oznac[i] = OZN.TESAT; n++; } continue; }
      if (!lzeKopat(hra, i)) continue;
      const v = druh === 'schody' ? OZN.SCHODY : OZN.KOPAT;
      if (hra.oznac[i] !== v) { hra.oznac[i] = v; n++; }
    }
    return n;
  }

  // dosah kopání z pole, kde trpaslík stojí: [dx, dy, přes dx, přes dy] (přes = musí být volno)
  const DOSAH = [
    [-1, 0], [1, 0], [0, -1],
    [-1, -1, 0, -1], [1, -1, 0, -1], [-1, -1, -1, 0], [1, -1, 1, 0],
    [0, -2, 0, -1], [-1, -2, -1, -1], [1, -2, 1, -1],
    [-1, 1, -1, 0], [1, 1, 1, 0],
    [0, 1],                                    // pod sebou až nakonec – trpaslík si podkope zem
  ];
  const kopatZnacka = o => o === OZN.KOPAT || o === OZN.SCHODY;     // kácení a tesání nejsou kopání
  // co může trpaslík stojící na poli a kopat (první volné označené pole v pořadí DOSAH), jinak −1
  function cilKopani(hra, a, obsazeno, jenPrio) {
    const x = a % W, y = a / W | 0;
    for (const [dx, dy, px, py] of DOSAH) {
      const cx = x + dx, cy = y + dy;
      if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
      const c = cy * W + cx;
      if (!kopatZnacka(hra.oznac[c]) || obsazeno.has(c) || !lzeKopat(hra, c) || (jenPrio && !hra.prio[c])) continue;
      if (px !== undefined && !C.volne(hra, (y + py) * W + x + px)) continue;
      if (dx === 0 && dy === 1 && !bezpecnePodSebou(hra, c)) continue;
      return c;
    }
    return -1;
  }
  // kopat pod sebou jde jen schodiště, pod žebříkem, nebo jáma hloubky 1, ze které se dá vystoupit o krok do strany
  function bezpecnePodSebou(hra, c) {
    if (hra.oznac[c] === OZN.SCHODY || hra.lez[c - W]) return true;
    const t = hra.hora.teren;
    if (c + W >= N || !pevne(t[c + W])) return false;
    for (const s of [-1, 1]) {
      const b = c + s, nad = b - W;
      if (pevne(t[b]) && C.volne(hra, nad) && C.stojne(hra, nad)) return true;
    }
    return false;
  }
  // může trpaslík z pole a kopat pole c? (kontrola za běhu – svět se mezitím mohl změnit)
  function vDosahu(hra, a, c) {
    const x = a % W, y = a / W | 0, dx = c % W - x, dy = (c / W | 0) - y;
    for (const d of DOSAH) {
      if (d[0] !== dx || d[1] !== dy) continue;
      if (dx === 0 && dy === 1 && !bezpecnePodSebou(hra, c)) return false;
      if (d[2] === undefined || C.volne(hra, (y + d[3]) * W + x + d[2])) return true;   // šikmo jsou dvě cesty – zkusit obě (jako cilKopani)
    }
    return false;
  }

  // doba kopání v tazích (10 tahů = 1 s při rychlosti 1×); tvrdou skálu (žula, čedič, hlubinný kámen, obsidián…)
  // bez železného krumpáče jde kopat jen ztěžka – hloubka se musí zasloužit kovárnou
  const TVRDA = 4, BEZ_ZELEZA = 1.8;
  const zeleznyKrumpac = trp => !!(trp && trp.nastroj && trp.nastroj.druh === 'krumpac' && trp.nastroj.mat === 'zelezo');
  const tvrdaSkala = (hra, c) => (MATERIAL[hra.hora.teren[c]].tvrdost || 1) >= TVRDA;
  function dobaKopani(hra, c, trp) {
    const t = hra.hora.teren[c];
    const tv = MATERIAL[t].tvrdost || 1;
    const ruda = hra.hora.ruda[c] ? 1.3 : 1;
    const tvrda = tv >= TVRDA && !zeleznyKrumpac(trp) ? BEZ_ZELEZA : 1;
    return Math.max(4, Math.round(14 * tv * ruda * tvrda / (1 + 0.08 * trp.dov.kopani)));
  }

  // vykopání pole c: změna terénu, schodiště, věc, odhalení okolí, pád věcí nad ním
  function vykopej(hra, c, zprava) {
    const hora = hra.hora, t = hora.teren[c], r = hora.ruda[c];
    const schody = hra.oznac[c] === OZN.SCHODY;
    // pole jen pro plán stavby (louč, podpěra, žebřík…), které mezitím nese stavbu nad sebou: nekope se – plán se zruší
    // (kopání kvůli plánu nikdy nic nezboří; hráčova vlastní značka ke kopání ano)
    const plan = hra.planNa.has(c) && T.stavby.planPodle(hra, hra.planNa.get(c));
    if (plan && T.stavby.STAVBY[plan.typ].misto === 'volno' && T.stavby.neseStavbu(hra, c)) {
      hra.oznac[c] = 0; hra.prio[c] = 0;
      T.stavby.zrusPlanBezPodlahy(hra, plan, (druh, i, mat) => novaVec(hra, druh, i, mat !== undefined ? mat : druh === 'drevo' ? 'drevo' : 0));
      usadVeci(hra);
      zprava('varovani', `Plán (${T.stavby.STAVBY[plan.typ].nazev}) zrušen – vykopáním pole by se zbořilo, co stojí nad ním.`, c);
      return;
    }
    // otesaný líc dá to, co původní hornina; hliněný líc obložený kamenem vrátí kámen
    const puv = puvodni(hra, c), obklad = puv !== t && ZA_KAMEN.includes(puv);
    if (hra.tesano) hra.tesano[c] = 0;
    // stavba nad polem přijde o podlahu
    if (c >= W && hra.stavba[c - W]) {
      const d = T.stavby.STAVBY[T.stavby.KOD_TYP[hra.stavba[c - W]] || ''];
      if (hra.stavba[c - W] === T.stavby.K.DILNA || (d && d.misto === 'podlaha'))
        T.stavby.zbourej(hra, c - W, (druh, i, mat) => novaVec(hra, druh, i, mat));
    }
    // plán „na podlahu" nad polem se zruší (donesený materiál zůstane ležet), jinak by se postavil do vzduchu
    if (c >= W && hra.planNa.has(c - W)) {
      const p = T.stavby.planPodle(hra, hra.planNa.get(c - W));
      if (p && T.stavby.STAVBY[p.typ].misto === 'podlaha') T.stavby.zrusPlanBezPodlahy(hra, p, (druh, i, mat) => novaVec(hra, druh, i, mat !== undefined ? mat : druh === 'drevo' ? 'drevo' : 0));
    }
    hora.teren[c] = M.VZDUCH;
    hora.ruda[c] = 0;
    hra.prio[c] = 0;
    hra.svetloZmena++; hra.stabilitaZmena++; hra.vodaKlid = false;
    hra.vykopane[c] = 1;
    if (T.pribeh) T.pribeh.hlidejHloubku(hra, c);
    if (puv === M.VAPENEC) T.priroda.mozna_pramen(hra, c, zprava);
    hra.oznac[c] = 0;
    if (schody) hra.lez[c] = 1;
    // žebřík naplánovaný do skály: vytesané schodiště poslouží stejně (a nad ním se dá stát) – plán se zruší, dřevo zůstane
    if (schody && plan && plan.typ === 'zebrik')
      T.stavby.zrusPlanBezPodlahy(hra, plan, (druh, i, mat) => novaVec(hra, druh, i, mat !== undefined ? mat : druh === 'drevo' ? 'drevo' : 0));
    hra.vykopano++;
    let druh = null;
    if (r) druh = Z_RUDY[r];
    else if (obklad) druh = 'kamen';
    else if (puv === M.JIL) druh = nahoda(hra) < 0.5 ? 'jil' : null;
    else if (KAMEN_Z[puv]) druh = nahoda(hra) < KAMEN_Z[puv] ? 'kamen' : null;
    if (druh) {
      novaVec(hra, druh, c, puv, 'kopání');
      if (r && !hra.nalezeno[druh]) {
        hra.nalezeno[druh] = 1;
        zprava('nalez', `Našli jsme ${VECI[druh].nazev}!`, c);
      }
    }
    // odhalení (a zrušení označení na polích, která se ukázala volná)
    const nove = new Set();
    T.hora.odhal(hora, hra.znamo, [c], i => {
      if (!pevne(hora.teren[i])) hra.oznac[i] = 0;
      if (hora.oblast[i]) nove.add(hora.oblast[i]);
    });
    for (const cislo of nove) {
      if (hra.objeveno[cislo]) continue;
      const o = hora.oblasti.find(o => o.cislo === cislo);
      const bunky = o && o.bunky;
      // oblast se „objeví", až je vidět její vnitřek, ne jen zeď
      if (o && (!bunky || bunky.some(i => hra.znamo[i] && !pevne(hora.teren[i])))) {
        hra.objeveno[cislo] = 1;
        zprava('objev', OBJEV[o.typ] || 'Prokopali jsme se do neznámé dutiny.', c);
        if (T.hrozby) T.hrozby.probudJeskyni(hra, o, zprava);
        if (o.typ === 'srdce' && T.pribeh) T.pribeh.objevenoSrdce(hra);
        if (o.typ === 'sin') {                            // poklad předků: zlato a drahokamy u desky
          const podlaha = [];
          for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) { const i = y * W + x; if (T.cesty.stojne(hra, i)) podlaha.push(i); }
          if (podlaha.length) {
            for (let k = 0; k < 3; k++) novaVec(hra, 'zlato', podlaha[(k * 5) % podlaha.length], 0);
            for (let k = 0; k < 2; k++) novaVec(hra, 'drahokam', podlaha[(k * 7 + 3) % podlaha.length], 0);
            zprava('nalez', 'V Síni předků leží poklad – zlato a drahokamy!', podlaha[0]);
          }
        }
      }
    }
    usadVeci(hra);
  }
  const OBJEV = {
    krapnikova: 'Prokopali jsme se do krápníkové jeskyně. Kape tu voda.',
    jeskyne: 'Před námi se otevřela temná jeskyně.',
    houbova: 'Houbová jeskyně! Obří houby tu svítí do tmy.',
    jezero: 'Podzemní jezero – černá voda bez dna.',
    hlubinna: 'Hlubinná jeskyně plná krystalů.',
    tunel: 'Cizí tunel… někdo ho vyhrabal. A není to dávno.',
    magma: 'Magma! Horko je cítit na tři kroky.',
    sin: 'Síň předků! Sloupy, runová deska a prach staletí.',
    straznice: 'Stará strážnice předků. Na zemi leží kosti.',
    srdce: 'SRDCE HORY. Výheň předků je vyhaslá, ale runy na stěnách pořád svítí.',
  };

  function novaVec(hra, druh, i, mat, zdroj) {    // zdroj = odkud věc přibyla (pro bilanci výroby); bez něj jde jen o přesun/vrácení
    const v = { id: hra.dalsiId++, druh, mat: mat === undefined ? 0 : mat, i, nese: 0, rez: 0 };
    hra.veci.push(v);
    if (zdroj) tok(hra, druh, 'p', zdroj);
    return v;
  }
  // Tok zásob pro bilanci: po dnech, jen v paměti (neukládá se). smer 'p' = přibylo, 'm' = spotřebováno,
  // 'n' = nepokrytá potřeba (pili vodu místo piva, jedli syrové suroviny místo jídla).
  function tok(hra, druh, smer, zdroj, n) {
    const den = Math.floor(hra.tik / 600);
    if (!hra._tok || hra._tok[0].den !== den) { hra._tok = [{ den, d: {} }].concat((hra._tok || []).filter(z => z.den >= den - 4)); }
    const z = hra._tok[0].d, x = z[druh] || (z[druh] = { p: {}, m: {}, n: {} });
    x[smer][zdroj] = (x[smer][zdroj] || 0) + (n || 1);
  }
  // skácení stromu: pařez (doroste za 4 dny) a tři polena; obří houba: 2 houby a 2 polena třeně (doroste za 4 dny)
  // (dřív 2 polena / 1 a strom za 5 dní – dřeva bylo v 2.–6. roce trvale 0, výtah ani záchranné žebříky nebylo z čeho stavět)
  const POLEN_STROM = 3, POLEN_HOUBA = 2, DNI_STROM = 4, DNI_HOUBA = 4;
  function skacej(hra, c) {
    const houba = hra.hora.obj[c] === T.hora.O.HOUBA;
    hra.hora.obj[c] = houba ? 0 : T.hora.O.PAREZ;
    // značka „kácet" zůstává (trvalé kácení): až strom doroste, skácí se znovu – zruší ji až nástroj ✖️ zrušit
    // obří houba doroste ze spor, strom z pařezu
    hra.parezy.push({ i: c, tik: hra.tik + (houba ? DNI_HOUBA : DNI_STROM) * T.hra.TAHU_ZA_DEN, houba });
    if (houba) { novaVec(hra, 'houby', c, 0, 'obří houba'); novaVec(hra, 'houby', c, 0, 'obří houba'); for (let k = 0; k < POLEN_HOUBA; k++) novaVec(hra, 'drevo', c, 'drevo', 'houbové dřevo'); }   // třeň obří houby je dřevo
    else for (let k = 0; k < POLEN_STROM; k++) novaVec(hra, 'drevo', c, 'drevo', 'kácení');
    usadVeci(hra);
  }

  // věci padají, dokud pod nimi není pevná zem, schodiště nebo kapalina
  function podepreno(hra, i) {
    const d = i + W;
    return d >= N || hra.lez[i] || hra.hora.teren[d] !== M.VZDUCH || hra.lez[d];
  }
  // věc ve vodě nebo na hladině (kde nikdo nestojí) by nikdo nezvedl: přesune se na nejbližší suché stojné pole
  function usadVeci(hra) {
    const t = hra.hora.teren;
    for (const v of hra.veci) {
      if (v.nese) continue;
      while (!podepreno(hra, v.i)) v.i += W;
      if (t[v.i] === M.VODA || (v.i + W < N && t[v.i + W] === M.VODA && !C.stojne(hra, v.i))) v.i = sucheMisto(hra, v.i);
    }
  }
  // nejbližší suché stojné pole od i (BFS přes známé volno a vodu – neprozkoumanou jeskyní se věc neprotáhne);
  // když žádné není, i. Neúspěch se pamatuje do změny tahu nebo tvaru hory (usadVeci se volá mnohokrát za tah
  // a věc ve vodě bez suchého břehu dřív pokaždé prohledala tisíce polí); neukládá se – výsledek je stejný
  const SUCHE_LIMIT = 1500;
  const sucheMarne = new WeakMap();
  function sucheMisto(hra, i) {
    if (hra.hora.teren[i] === M.VZDUCH && C.stojne(hra, i)) return i;
    let c = sucheMarne.get(hra);
    if (!c || c.tik !== hra.tik || c.zmena !== hra.svetloZmena) sucheMarne.set(hra, c = { tik: hra.tik, zmena: hra.svetloZmena, pole: new Set() });
    if (c.pole.has(i)) return i;
    const t = hra.hora.teren, videno = new Set([i]), q = [i];
    for (let h = 0; h < q.length && h < SUCHE_LIMIT; h++) {
      const a = q[h], x = a % W;
      for (const j of [a - W, x > 0 ? a - 1 : -1, x < W - 1 ? a + 1 : -1, a + W]) {
        if (j < 0 || j >= N || videno.has(j) || pevne(t[j]) || t[j] === M.MAGMA || !hra.znamo[j]) continue;
        if (t[j] === M.VZDUCH && C.stojne(hra, j)) return j;
        videno.add(j); q.push(j);
      }
    }
    c.pole.add(i);
    return i;
  }

  // Volné věci podle pole (ne nesené, rezervované ani blokované) – mapa se staví jednou za tah a platí, dokud
  // věci nepřibudou ani neubudou; rezervace, zvednutí a přesuny během tahu musí volající ověřit sám (volnaVec).
  function volneVeci(hra) {
    const c = hra._naPoli;
    if (c && c.tik === hra.tik && c.veci === hra.veci && c.n === hra.veci.length && c.id === hra.dalsiId) return c.mapa;
    const mapa = new Map();
    for (const v of hra.veci) {
      if (v.nese || v.rez || v.blok > hra.tik) continue;
      const a = mapa.get(v.i); if (a) a.push(v); else mapa.set(v.i, [v]);
    }
    hra._naPoli = { tik: hra.tik, veci: hra.veci, n: hra.veci.length, id: hra.dalsiId, mapa };
    return mapa;
  }
  const volnaVec = (hra, v, i) => !v.nese && !v.rez && !(v.blok > hra.tik) && v.i === i;
  function veciNa(hra, i) { return hra.veci.filter(v => !v.nese && v.i === i); }
  // zásoby ve skladech po druzích
  function zasoby(hra) {
    const z = {};
    for (const v of hra.veci) if (!v.nese && (T.stavby.jeSklad(hra, v.i) || T.stavby.vJidelne(hra, v.i, v.druh))) z[v.druh] = (z[v.druh] || 0) + 1;
    return z;
  }

  // náhoda uložená ve stavu hry (aby šla hra uložit a byla deterministická)
  function nahoda(hra) {
    let a = hra.rng = (hra.rng + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  T.prace = { lzeBourat, OZN, VECI, DOSAH, oznac, lzeTesat, tesatZaKamen, kTesani, jePodlaha, jeLic, licZDosahu, otesejPodlahu, lzeKopat, cilKopani, vDosahu, dobaKopani, TVRDA, BEZ_ZELEZA, zeleznyKrumpac, tvrdaSkala, vykopej, usadVeci,
              podepreno, sucheMisto, puvodni, rozpetiNa, veciNa, volneVeci, volnaVec, zasoby, nahoda, novaVec, tok, skacej, DRUH_RUDY: Z_RUDY };
})(TRP);

if (typeof module !== 'undefined') module.exports = TRP;

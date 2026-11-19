/* Příchytky trubek, hadic a kabelů – jádro generátoru (bez DOM a bez three.js, spustitelné v node).
   Druhy: zaklapávací C-klip, omega na dva šrouby, dvoudílná objímka (distanční, na závitovou tyč), řadová lišta
   pro více trubek a navíjecí držák hadice. Uchycení: šrouby do hmoždinek, oboustranná páska, drážka hliníkového
   profilu (T-matice / zaklapnutí, rozměry drážek ze spojky/jadro.js), French cleat (zámek jako cleat/jadro.js),
   stahovací páska.

   Souřadnice „profilu“ (klip, omega, objímka, řada): průřez leží v rovině (u, v), u = podél zdi napříč trubkou,
   v = od zdi (zeď v = 0, u French cleatu je v = 0 zeď za lištou), průřez se vytáhne o šířku příchytky b
   ve směru w = osa trubky. To je zároveň TISKOVÁ POLOHA: díl leží na boku, celý profil je v rovině vrstev,
   takže se oblouk klipu při zacvaknutí ohýbá podél vláken (naležato by ohyb nesly spoje vrstev) a nic nepřevisá.
   Díry pro šrouby jsou v tisku vodorovné – mají tvar kapky se špičkou nahoru (45°), nebo kruhu (p.diry === 'kruh').
   Držák hadice se staví rovnou v montážní poloze (X podél zdi, Y nahoru, Z od zdi) a tiskne se nastojato
   (spodek sedla a desky na podložce), ohyb sedla tak leží ve vrstvách.
   Sestava (náhled): X = od zdi (zeď je svislá rovina x = 0), Y = podél trubky / zdi, Z = nahoru. */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const SP = uzel ? require('../spojky/jadro.js') : window.SPOJKY;     // PROFILY (drážky), SROUBY (M)
  const CL = uzel ? require('../cleat/jadro.js') : window.CLEAT;       // VRUTY, MATICE, SYSTEMY
  const fmt = G.fmt, kopie = G.kopie;
  const rad = s => s * Math.PI / 180, deg = r => r * 180 / Math.PI;

  /* ---------------- tabulky (typické hodnoty 10/2026 – ověřit měřením / u výrobce) ---------------- */
  /** E (MPa), mez pevnosti v tahu podél vrstev (MPa), přetvoření: dov = opakované zacvaknutí bez trvalé deformace,
      mez = jednorázově (hrozí prasknutí); napříč vrstvami ≈ polovina. mu = tření plast–trubka. */
  const MATERIALY = {
    PETG: { nazev: 'PETG', hustota: 1.27, E: 2000, sigma: 45, dov: 0.035, mez: 0.07, mu: 0.3 },
    PLA: { nazev: 'PLA', hustota: 1.24, E: 3500, sigma: 50, dov: 0.02, mez: 0.04, mu: 0.3 },
    ASA: { nazev: 'ASA', hustota: 1.07, E: 2000, sigma: 40, dov: 0.03, mez: 0.06, mu: 0.3 },
    ABS: { nazev: 'ABS', hustota: 1.04, E: 2000, sigma: 35, dov: 0.03, mez: 0.06, mu: 0.3 },
    PA: { nazev: 'PA (nylon)', hustota: 1.14, E: 1600, sigma: 55, dov: 0.05, mez: 0.1, mu: 0.25 },
    PP: { nazev: 'PP (polypropylen)', hustota: 0.9, E: 1300, sigma: 25, dov: 0.06, mez: 0.12, mu: 0.25 },
  };
  const NAPRIC_VRSTVAMI = 0.5;
  /** Doporučené zatížení hmoždinky v tahu na 1 mm jejího průměru (N/mm) – typické, ověřit u výrobce (10/2026). */
  const PODKLADY = {
    beton: { nazev: 'beton', nNaMm: 60 },
    cihla: { nazev: 'plná cihla', nNaMm: 45 },
    derovana: { nazev: 'děrovaná cihla / tvárnice', nNaMm: 15 },
    sadrokarton: { nazev: 'sádrokarton (hmoždinka do SDK)', nNaMm: 8 },
    drevo: { nazev: 'dřevo (vrut bez hmoždinky)', nNaMm: 35 },
  };
  /** Stahovací pásky: šířka × tloušťka (mm), pevnost v tahu (N) – typické katalogové hodnoty, ověřit. */
  const PASKY = [[2.5, 1.0, 80], [3.6, 1.2, 180], [4.8, 1.3, 220], [7.6, 1.5, 530]];
  /** T-matice do drážky – orientační únosnost v tahu (N), ověřit u výrobce. */
  const TMATICE = { M3: 400, M4: 700, M5: 1000, M6: 1500, M8: 2500 };

  const NAZVY = {
    druh: { klip: 'zaklapávací klip', omega: 'omega na dva šrouby', objimka: 'dvoudílná objímka', rada: 'řadová lišta', hadice: 'držák hadice' },
    uchyceni: { sroub: 'šrouby do zdi', paska: 'oboustranná páska', drazka: 'drážka hliníkového profilu', cleat: 'French cleat', stah: 'stahovací páska' },
    hlava: { zapustna: 'zápustná (kužel 90°)', cockova: 'čočková / půlkulatá' },
    smer: { podel: 'podél trubky', napric: 'napříč trubkou' },
    zpusob: { tmatice: 'šroub do T-matice', zaklapnuti: 'zaklapnutí (bez šroubu)' },
    stojna: { pevna: 'pevný sloupek na desce', tyc: 'na závitovou tyč (matice v patce)' },
    montaz: { zed: 'na zeď (trubka vodorovně)', strop: 'na strop (trubka visí)' },
  };
  /** Která uchycení dávají u druhu smysl. */
  const POVOLENA = {
    klip: ['sroub', 'paska', 'drazka', 'cleat', 'stah'],
    omega: ['sroub', 'paska', 'drazka'],
    objimka: ['sroub', 'paska', 'drazka', 'cleat', 'stah'],
    rada: ['sroub', 'paska', 'drazka', 'cleat'],
    hadice: ['sroub', 'paska', 'drazka', 'cleat'],
  };

  const VYCHOZI = {
    verze: 1, nazev: 'Příchytka trubky',
    druh: 'klip', diry: 'kapka',                          // diry: vodorovné díry kapka (tisk bez podpor) | kruh
    trubka: { D: 16, vule: 0, sirka: 12 },                 // vůle na poloměr: + volně, − sevře
    klip: { stena: 2.2, obepnuti: 230, nabeh: 35, delkaNabehu: 2.5, patky: false },
    omega: { stena: 2.4, priruba: 0 },
    objimka: { stena: 3, sroub: 'M4', ucho: 0, mezera: 1.5, stojna: 'pevna', tyc: 'M8' },
    rada: { prumery: '16; 16; 20', mezera: 4, roztec: 0, dirVMezerach: false },
    hadice: { polomer: 0, uhel: 120, zavitu: 3, lem: 10, stena: 3, nad: 26, delka: 25 },
    zakl: { uchyceni: 'sroub', tl: 4, odstup: 0, sirka: 0 },
    sroub: { vrut: 4, hlava: 'zapustna', podklad: 'beton' },
    drazka: { profil: '2020', smer: 'podel', zpusob: 'tmatice', vule: 0.2, zachyt: 0.5 },
    cleat: { tl: 18, vyska: 80, uhel: 45, vule: 0.5, nad: 8 },
    paska: { pevnost: 3 },                                  // N/cm² – návrhová únosnost pásky (typická 2–5)
    stah: { sirka: 4.8, tl: 1.3 },
    zatez: { montaz: 'zed', rozestup: 600, kgm: 0 },        // kgm 0 = odhad: trubka plná vody
    tisk: { material: 'PETG', vrstva: 0.2, uhel: 45, sad: 1, podlozka: 220, kalibrace: false, krokKalibrace: 0.15 },
  };
  const MEZE = {
    'trubka.D': [2, 160], 'trubka.vule': [-2, 3], 'trubka.sirka': [4, 150],
    'klip.stena': [0.8, 10], 'klip.obepnuti': [190, 320], 'klip.nabeh': [10, 60], 'klip.delkaNabehu': [0, 20],
    'omega.stena': [0.8, 10], 'omega.priruba': [0, 60],
    'objimka.stena': [1, 12], 'objimka.ucho': [0, 40], 'objimka.mezera': [0, 6],
    'rada.mezera': [0.5, 100], 'rada.roztec': [0, 400],
    'hadice.polomer': [0, 400], 'hadice.uhel': [60, 180], 'hadice.zavitu': [1, 12, 1], 'hadice.lem': [0, 60], 'hadice.stena': [1.2, 12], 'hadice.nad': [10, 150], 'hadice.delka': [1, 100],
    'zakl.tl': [1.5, 20], 'zakl.odstup': [0, 200], 'zakl.sirka': [0, 400],
    'drazka.vule': [0, 1], 'drazka.zachyt': [0.2, 1.5],
    'cleat.tl': [4, 40], 'cleat.vyska': [12, 200], 'cleat.uhel': [30, 60], 'cleat.vule': [0, 3], 'cleat.nad': [3, 40],
    'paska.pevnost': [0.2, 50], 'stah.sirka': [1.5, 12], 'stah.tl': [0.6, 3],
    'zatez.rozestup': [50, 5000], 'zatez.kgm': [0, 100],
    'tisk.vrstva': [0.05, 0.5], 'tisk.uhel': [20, 75], 'tisk.sad': [1, 50, 1], 'tisk.podlozka': [80, 600], 'tisk.krokKalibrace': [0.05, 1],
  };
  const VYCTY = {
    druh: Object.keys(NAZVY.druh), diry: ['kapka', 'kruh'], 'zakl.uchyceni': Object.keys(NAZVY.uchyceni),
    'sroub.vrut': Object.keys(CL.VRUTY).map(Number), 'sroub.hlava': Object.keys(NAZVY.hlava), 'sroub.podklad': Object.keys(PODKLADY),
    'drazka.profil': Object.keys(SP.PROFILY), 'drazka.smer': Object.keys(NAZVY.smer), 'drazka.zpusob': Object.keys(NAZVY.zpusob),
    'objimka.sroub': ['M3', 'M4', 'M5', 'M6'], 'objimka.stojna': Object.keys(NAZVY.stojna), 'objimka.tyc': ['M6', 'M8'],
    'zatez.montaz': Object.keys(NAZVY.montaz), 'tisk.material': Object.keys(MATERIALY),
  };

  /** Předvolby: jen odchylky od výchozího projektu (nastavení tisku zůstává uživatelovo). Skupina = druh. */
  const PREDVOLBY = [
    { id: 'klip16', skupina: 'klip', nazev: 'Klip Ø 16 – PEX, elektroinstalační trubka', popis: 'zaklapávací, vrut 4 zápustný do středu', p: { nazev: 'Klip Ø 16' } },
    { id: 'klip25', skupina: 'klip', nazev: 'Klip Ø 25 na patkách', popis: 'dva vruty vedle oblouku, PP trubka', p: { nazev: 'Klip Ø 25', trubka: { D: 25, sirka: 16 }, klip: { stena: 2.8, patky: true } } },
    { id: 'kabel8', skupina: 'klip', nazev: 'Klip na kabel Ø 8 na pásku', popis: 'oboustranná páska, široká patka', p: { nazev: 'Klip kabel Ø 8', trubka: { D: 8, sirka: 12 }, klip: { stena: 1.6, delkaNabehu: 1.5 }, zakl: { uchyceni: 'paska', tl: 2.5, sirka: 28 } } },
    { id: 'klip20prof', skupina: 'klip', nazev: 'Klip Ø 20 do drážky profilu 2020', popis: 'šroub M5 do T-matice', p: { nazev: 'Klip Ø 20 na profil', trubka: { D: 20, sirka: 14 }, klip: { stena: 2.4 }, zakl: { uchyceni: 'drazka' } } },
    { id: 'klipzacvak', skupina: 'klip', nazev: 'Klip Ø 12 zacvaknutý do drážky 2020', popis: 'bez šroubu – pružné zobáčky pod límec', p: { nazev: 'Klip Ø 12 zacvakávací', trubka: { D: 12, sirka: 12 }, klip: { stena: 2 }, zakl: { uchyceni: 'drazka', tl: 3 }, drazka: { zpusob: 'zaklapnuti', zachyt: 0.4 } } },
    { id: 'klipcleat', skupina: 'klip', nazev: 'Klip Ø 25 na French cleat', popis: 'zámek na lištu 18 × 80, 45°', p: { nazev: 'Klip Ø 25 na cleat', trubka: { D: 25, sirka: 20 }, klip: { stena: 3 }, zakl: { uchyceni: 'cleat', tl: 5 } } },
    { id: 'klipstah', skupina: 'klip', nazev: 'Klip Ø 12 na stahovací pásku', popis: 'na sloupek, zábradlí nebo trubku', p: { nazev: 'Klip na pásku', trubka: { D: 12, sirka: 10 }, klip: { stena: 2 }, zakl: { uchyceni: 'stah', tl: 4.2 } } },
    { id: 'omega32', skupina: 'omega', nazev: 'Omega Ø 32 na dva vruty', popis: 'mírný přítlak, příruby s vruty 4', p: { nazev: 'Omega Ø 32', druh: 'omega', trubka: { D: 32, vule: -0.3, sirka: 18 }, omega: { stena: 3 } } },
    { id: 'omega20dist', skupina: 'omega', nazev: 'Omega Ø 20 s distančním sedlem 10 mm', popis: 'trubka 10 mm od zdi, sedlo jako druhý díl', p: { nazev: 'Omega Ø 20 s odstupem', druh: 'omega', trubka: { D: 20, vule: -0.2, sirka: 14 }, zakl: { odstup: 10 } } },
    { id: 'objimka25', skupina: 'objimka', nazev: 'Objímka Ø 25, osa 40 mm od zdi', popis: 'dva díly, šrouby M4 s maticí, deska na 2 vruty', p: { nazev: 'Objímka Ø 25', druh: 'objimka', trubka: { D: 25, vule: -0.3, sirka: 16 }, zakl: { odstup: 15, tl: 5 } } },
    { id: 'objimkaTyc', skupina: 'objimka', nazev: 'Objímka Ø 40 na závitovou tyč M8', popis: 'odstup od zdi se nastaví tyčí', p: { nazev: 'Objímka Ø 40 na tyč', druh: 'objimka', trubka: { D: 40, vule: -0.4, sirka: 22 }, objimka: { stena: 4, sroub: 'M5', stojna: 'tyc' }, zakl: { odstup: 8 } } },
    { id: 'rada', skupina: 'rada', nazev: 'Řada 2 × Ø 16 + Ø 20', popis: 'lišta na 3 trubky, vruty na koncích', p: { nazev: 'Řada trubek', druh: 'rada', trubka: { sirka: 14 } } },
    { id: 'radaKabely', skupina: 'rada', nazev: 'Hřebínek kabelů 4 × Ø 6 + 2 × Ø 10', popis: 'na pásku, kabely těsně vedle sebe', p: { nazev: 'Hřebínek kabelů', druh: 'rada', trubka: { sirka: 10 }, klip: { stena: 1.4, obepnuti: 225, delkaNabehu: 1.5 }, rada: { prumery: '6; 6; 6; 6; 10; 10', mezera: 2 }, zakl: { uchyceni: 'paska', tl: 2.5, sirka: 0 } } },
    { id: 'hadice12', skupina: 'hadice', nazev: 'Držák zahradní hadice ½″ (25 m)', popis: 'sedlo R 95, 3 závity vedle sebe, 2 vruty 5', p: { nazev: 'Držák hadice ½″', druh: 'hadice', trubka: { D: 19 }, sroub: { vrut: 5 }, zakl: { tl: 6 } } },
    { id: 'hadiceCleat', skupina: 'hadice', nazev: 'Držák kabelu / hadice na French cleat', popis: 'navíjení prodlužovačky Ø 9, 4 závity', p: { nazev: 'Navíjení kabelu', druh: 'hadice', trubka: { D: 9 }, hadice: { zavitu: 4, uhel: 140, lem: 8, nad: 22, delka: 20 }, zakl: { uchyceni: 'cleat', tl: 6 }, zatez: { kgm: 0.12 } } },
  ];

  function normalizuj(v) {
    const r = G.normalizuj(v, { VYCHOZI, MEZE, VYCTY });
    r.p.rada.prumery = String(r.p.rada.prumery).slice(0, 200);
    return r;
  }
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(G.slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }
  /** Seznam průměrů řady „16; 20 25“ → čísla v mezích (nejvýš 12). */
  const prumeryRady = t => String(t || '').split(/[;\s]+/).filter(Boolean).map(G.ctiCislo).filter(x => Number.isFinite(x) && x >= 2 && x <= 160).slice(0, 12);

  /* ---------------- odvozené rozměry ---------------- */
  /** Šroub uchycení: {nazev, d, ro (díra), rh (hlava), hz (hloubka kuželu), hmozdinka, metricky}. */
  function sroubUchyceni(p) {
    if (p.zakl.uchyceni === 'drazka') {
      const pr = SP.PROFILY[p.drazka.profil], s = SP.SROUBY[pr.sroub];
      return { nazev: `${pr.sroub} do T-matice`, M: pr.sroub, d: s.d, ro: s.otvor / 2, rh: s.hlava / 2 + 0.3, hz: 0, plocha: true };
    }
    const v = CL.VRUTY[p.sroub.vrut], zap = p.sroub.hlava === 'zapustna';
    return { nazev: `vrut ${fmt(v.d)}`, d: v.d, ro: v.otvor / 2, rh: v.hlava / 2 + 0.25, hz: zap ? (v.hlava - v.otvor) / 2 + 0.25 : 0, plocha: !zap, hmozdinka: v.hmozdinka };
  }
  /** Zámek French cleatu v rovině (u = nahoru, v = od zdi): lišta 0 ≤ v ≤ T, vršek lišty u = H na líci, úkos ke zdi dolů. */
  function zamekCleatu(p, uTop) {
    const s = p.cleat, T = s.tl, ta = Math.tan(rad(s.uhel)), c = s.vule, ca = Math.cos(rad(s.uhel));
    const H = uTop - s.nad, gw = Math.min(1, T - 1);
    const uL = v => H - (T - v) * ta + c / ca;
    return { T, H, c, gw, vz0: T + c, uTop, uL, poly: [[uL(T + c), T + c], [uL(gw), gw], [uTop, gw], [uTop, T + c]], pokles: T * ta };
  }

  function odvozene(p) {
    const k = p.zakl, u = k.uchyceni, mat = MATERIALY[p.tisk.material];
    const o = { druh: p.druh, uchyceni: u, b: p.trubka.sirka, tb: k.tl, odstup: k.odstup, chyby: [] };
    const naTyc = p.druh === 'objimka' && p.objimka.stojna === 'tyc';   // objímka na tyč: deska ani uchycení se nepoužijí
    o.sroub = !naTyc && (u === 'sroub' || u === 'drazka') ? sroubUchyceni(p) : null;
    o.cleat = !naTyc && u === 'cleat';
    o.vz0 = 0;
    if (p.druh === 'hadice') return Object.assign(o, odvozeneHadice(p, o));
    const t = p.druh === 'omega' ? p.omega.stena : p.druh === 'objimka' ? p.objimka.stena : p.klip.stena;
    o.t = t;
    // kruhy (osy trubek)
    let prum = [p.trubka.D];
    if (p.druh === 'rada') { prum = prumeryRady(p.rada.prumery); if (!prum.length) { prum = [p.trubka.D]; o.chyby.push('prumery'); } }
    const g = rad((360 - p.klip.obepnuti) / 2);
    o.kruhy = prum.map(D => { const R = D / 2 + p.trubka.vule; return { D, R, Ro: R + t, g, w: 2 * R * Math.sin(g) }; });
    // rozteč řady
    let uc = 0;
    o.kruhy.forEach((r, i) => {
      if (i) uc += p.rada.roztec > 0 ? p.rada.roztec : o.kruhy[i - 1].Ro + r.Ro + p.rada.mezera;
      r.uc = uc;
    });
    const posun = (o.kruhy[0].uc + o.kruhy[o.kruhy.length - 1].uc) / 2;
    for (const r of o.kruhy) r.uc -= posun;
    const s = o.sroub, rh = s ? s.rh : 0;
    const Lp = s ? 2 * rh + 4 : 0;                                    // délka patky s dírou
    const Rmax = Math.max(...o.kruhy.map(r => r.Ro));
    // základna (deska u zdi) a polohy děr
    o.diry = [];
    const r0 = o.kruhy[0], rN = o.kruhy[o.kruhy.length - 1];
    let u0 = r0.uc - r0.Ro, u1 = rN.uc + rN.Ro;
    if (p.druh === 'klip' && u !== 'cleat') {
      if (p.klip.patky && s) { u0 -= Lp; u1 += Lp; }
      else if (u === 'drazka') { const dw = SP.PROFILY[p.drazka.profil].drazka; u0 = Math.min(u0, -dw / 2 - 3); u1 = Math.max(u1, dw / 2 + 3); }
    }
    if (p.druh === 'rada' && s && u !== 'cleat') { u0 -= Lp; u1 += Lp; }
    if (p.druh === 'omega') { const Lf = p.omega.priruba > 0 ? p.omega.priruba : Math.max(Lp, 6); o.Lf = Lf; u0 = r0.uc - r0.Ro - Lf; u1 = r0.uc + r0.Ro + Lf; }
    if (p.druh === 'objimka') {
      const ob = p.objimka, sm = SP.SROUBY[ob.sroub], mt = CL.MATICE[ob.sroub];
      o.ucho = { M: ob.sroub, ro: sm.otvor / 2, rh: sm.hlava / 2 + 0.3, s: mt.s, m: mt.m, Le: ob.ucho > 0 ? ob.ucho : Math.max(sm.hlava, mt.s * 1.16) + 3.2 };
      o.ucho.he = Math.max(mt.m + 3, 2 * t, 6);                          // výška ucha spodní poloviny (kapsa matice + strop)
      o.ucho.heH = Math.max(sm.vyska * 0 + 5, 2 * t);                    // výška ucha horní poloviny
      o.ucho.uS = r0.Ro + o.ucho.Le / 2 - 0.5;                          // osa šroubu ucha od osy trubky
      u0 = -(r0.Ro + o.ucho.Le); u1 = r0.Ro + o.ucho.Le;
      o.wp = Math.min(2 * r0.Ro, Math.max(12, r0.Ro));                  // šířka sloupku
      if (ob.stojna === 'tyc') { const tm = CL.MATICE[ob.tyc]; o.tyc = { M: ob.tyc, d: SP.SROUBY[ob.tyc].d, s: tm.s, m: tm.m }; o.wp = Math.max(o.wp, tm.s * 1.155 + 6); }
    }
    if (k.sirka > 0 && p.druh !== 'omega' && p.druh !== 'objimka') { const c = (u0 + u1) / 2, w = Math.max(k.sirka, u1 - u0); u0 = c - w / 2; u1 = c + w / 2; }
    if (k.sirka > 0 && p.druh === 'objimka') { u0 = Math.min(u0, -k.sirka / 2); u1 = Math.max(u1, k.sirka / 2); }
    // French cleat: deska nahoru-dolů (u = svisle), zámek nahoře za lištu
    if (o.cleat) {
      const Hp = Math.max(u1 - u0 + 4, p.cleat.nad + 22);
      const uTop = Hp / 2;
      o.zamek = zamekCleatu(p, uTop);
      o.vz0 = o.zamek.vz0;
      u0 = -Hp / 2; u1 = Hp / 2;
    }
    o.zakladna = { u0, u1, v0: o.vz0, v1: o.vz0 + o.tb };
    const tyc = p.druh === 'objimka' && o.tyc;
    if (tyc) o.zakladna = null;
    // výška os trubek
    for (const r of o.kruhy) {
      if (p.druh === 'omega') r.vc = o.vz0 + o.odstup + r.D / 2;
      else if (tyc) r.vc = o.odstup + o.tyc.m + 4 + r.Ro;
      else r.vc = o.vz0 + o.tb + o.odstup + r.R;
    }
    o.osaOdZdi = r0.vc;
    // díry: w = poloha podél trubky (0…b), u napříč
    const b = o.b, vT = o.vz0 + o.tb;
    o.wExt = 0;
    if (s) {
      const dira = (uu, ww, vTop, vBot) => o.diry.push({ u: uu, w: ww, vTop, vBot, ro: s.ro, rh: s.rh, hz: s.hz, plocha: s.plocha });
      if (p.druh === 'klip') {
        if (p.klip.patky) { dira(u0 + Lp / 2, b / 2, vT, o.vz0 - 1); dira(u1 - Lp / 2, b / 2, vT, o.vz0 - 1); }
        else dira(0, b / 2, r0.vc - r0.R, o.vz0 - 1);
      } else if (p.druh === 'rada') {
        dira(u0 + Lp / 2, b / 2, vT, o.vz0 - 1); dira(u1 - Lp / 2, b / 2, vT, o.vz0 - 1);
        if (p.rada.dirVMezerach) for (let i = 1; i < o.kruhy.length; i++) {
          const a = o.kruhy[i - 1], c = o.kruhy[i], mez = c.uc - c.Ro - (a.uc + a.Ro);
          if (mez >= 2 * s.rh + 1) dira((a.uc + a.Ro + c.uc - c.Ro) / 2, b / 2, vT, o.vz0 - 1);
        }
      } else if (p.druh === 'omega') {
        const uu = r0.Ro + o.Lf / 2;
        dira(-uu, b / 2, vT, o.vz0 - 1); dira(uu, b / 2, vT, o.vz0 - 1);
      } else if (p.druh === 'objimka' && !tyc) {
        // deska se prodlouží podél trubky (nahoru v tisku) – nad ní nepřekáží uši ani sloupek
        o.wExt = 2 * s.rh + 5;
        const ww = b + o.wExt / 2, Bh = Math.max(o.wp / 2 + s.rh + 1.5, 2 * s.rh + 3);
        if (u === 'drazka' && p.drazka.smer === 'podel') dira(0, ww, vT, o.vz0 - 1);
        else { dira(-Bh, ww, vT, o.vz0 - 1); dira(Bh, ww, vT, o.vz0 - 1); }
        o.zakladna.u0 = Math.min(o.zakladna.u0, -Bh - s.rh - 2.5); o.zakladna.u1 = Math.max(o.zakladna.u1, Bh + s.rh + 2.5);
      }
    }
    // drážka profilu
    if (u === 'drazka' && !tyc) {
      const pr = SP.PROFILY[p.drazka.profil], dw = pr.drazka - 2 * p.drazka.vule;
      o.drazka = { pr, dw, hk: Math.min(pr.limec, pr.hloubka - 0.5), smer: p.drazka.smer, zpusob: p.drazka.zpusob };
      if (p.drazka.zpusob === 'zaklapnuti') {
        const z = p.drazka.zachyt, L = pr.limec + 0.2, hh = z + 1.6, sl = Math.min(2 * z + 1.2, dw - 2.4);
        o.drazka.zobacky = { z, L, hh, sl, tl: (dw - sl) / 2, Lef: L + hh + Math.max(0, o.tb - 1.2) };   // štěrbina zasahuje do základny
        o.diry = [];
      }
    }
    // stahovací páska: tunel napříč základnou
    if (u === 'stah' && !tyc) o.tunel = { sirka: p.stah.sirka + 0.6, vyska: p.stah.tl + 0.5 };
    o.uRozsah = [o.zakladna ? o.zakladna.u0 : -o.wp / 2, o.zakladna ? o.zakladna.u1 : o.wp / 2];
    // mechanika klipu (oblouk C)
    if (p.druh === 'klip' || p.druh === 'rada') for (const r of o.kruhy) r.mech = mechKlipu(r, t, p, o, mat);
    return o;
  }

  /** Držák hadice: sedlo = kruhová úseč poloměru Rs nad tětivou y0 = 0, deska za ním, lem na konci. */
  function odvozeneHadice(p, o) {
    const h = p.hadice, D = p.trubka.D, minR = 5 * D;
    const Rs = h.polomer > 0 ? h.polomer : Math.ceil(minR);
    const fi = rad(h.uhel / 2), vys = Rs * (1 - Math.cos(fi)), polTetivy = Rs * Math.sin(fi);
    const r = { Rs, minR, fi, vys, polTetivy, yc: -Rs * Math.cos(fi) };
    r.hloubka = h.zavitu * D * 1.08 + 3;                              // vytažení sedla od desky
    r.Rl = Rs + h.lem;                                                 // lem na konci
    r.polLemu = Math.sqrt(Math.max(0, r.Rl * r.Rl - r.yc * r.yc));
    const s = o.sroub;
    r.sirkaDesky = Math.max(2 * r.polLemu, 2 * polTetivy) + 4;
    r.vyskaDesky = vys + h.nad;
    if (o.cleat) {
      r.zamek = o.zamek = zamekCleatu(p, r.vyskaDesky);
      o.vz0 = r.zamek.vz0;
    }
    r.zDesky = [o.vz0, o.vz0 + o.tb];
    r.zSedla = [o.vz0 + o.tb, o.vz0 + o.tb + r.hloubka];
    r.tl = Math.max(3, h.stena);
    o.diry = [];
    if (s) {
      const xs = Math.min(r.sirkaDesky / 2 - s.rh - 4, Math.max(polTetivy * 0.55, s.rh + 6));
      const yh = vys + h.nad / 2;
      for (const x of [-xs, xs]) o.diry.push({ x, y: yh, ro: s.ro, rh: s.rh, hz: s.hz, plocha: s.plocha });
    }
    if (p.zakl.uchyceni === 'drazka') {
      const pr = SP.PROFILY[p.drazka.profil];
      o.drazka = { pr, dw: pr.drazka - 2 * p.drazka.vule, hk: Math.min(pr.limec, pr.hloubka - 0.5), smer: 'podel', zpusob: 'tmatice', yOsa: vys + h.nad / 2 };
    }
    // průřez sedla (u desky) pro ohyb: plná úseč minus dutina se střechou 45°
    r.dutina = dutinaSedla(r);
    r.prurez = prurezSedla(r);
    o.osaOdZdi = r.zSedla[0] + r.hloubka / 2;
    o.uRozsah = [-r.sirkaDesky / 2, r.sirkaDesky / 2];
    return { hadice: r };
  }
  /** Dutina sedla (odlehčení) v rovině XY: úseč zmenšená o stěnu, shora omezená střechou 45° (tisk nastojato).
      Obrys = y(x) = min(oblouk, střecha) nad dnem y0, vzorkovaný po x se zlomy – žádná hrana není plošší než 45°. */
  function dutinaSedla(r) {
    const st = r.tl, Ri = r.Rs - st, y0 = st;
    if (Ri <= 0 || r.vys < 3 * st + 4) return null;
    const yTop = r.vys - st * 1.5;                                     // vrchol střechy
    const oblouk = x => (Math.abs(x) < Ri ? r.yc + Math.sqrt(Ri * Ri - x * x) : -Infinity);
    const y = x => Math.min(oblouk(x), yTop - Math.abs(x));
    // konec dna: kde obrys klesne na y0 (bisekce na monotónně klesající funkci)
    let lo = 0, hi = Ri;
    if (y(0) <= y0 + 1) return null;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (y(m) > y0) lo = m; else hi = m; }
    const X = lo;
    // zlom střecha/oblouk
    let xs = [];
    const n = 40;
    for (let i = 0; i <= n; i++) xs.push(X * i / n);
    let a0 = 0, a1 = X;
    if (oblouk(0) > yTop) {
      for (let i = 0; i < 60; i++) { const m = (a0 + a1) / 2; if (oblouk(m) > yTop - m) a0 = m; else a1 = m; }
      if (a0 < X) xs.push(a0);
    }
    xs = [...new Set(xs.map(x => Math.round(x * 1e6) / 1e6))].sort((p, q) => p - q);
    const prava = xs.map(x => [x, Math.max(y0, y(x))]);
    const body = [[-X, y0], ...prava.slice(1).reverse().map(([x, yy]) => [-x, yy]), ...prava, [X, y0]];
    const ok = body.filter((q, i) => i === 0 || Math.hypot(q[0] - body[i - 1][0], q[1] - body[i - 1][1]) > 1e-6);
    // poslední bod oblouku leží na dně – vypustit duplicitu
    const plocha = Math.abs(ok.reduce((s2, q, i) => { const w = ok[(i + 1) % ok.length]; return s2 + q[0] * w[1] - w[0] * q[1]; }, 0)) / 2;
    return plocha > 20 ? ok : null;
  }
  const uvnitr = (b, x, y) => {
    let v = false;
    for (let i = 0, j = b.length - 1; i < b.length; j = i++) {
      const [xi, yi] = b[i], [xj, yj] = b[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) v = !v;
    }
    return v;
  };
  /** Plocha, těžiště a kvadratický moment průřezu sedla k vodorovné ose (mřížka 0,25 mm). */
  function prurezSedla(r) {
    const h = 0.25, X = r.polTetivy + 1;
    let A = 0, Sy = 0, Iy = 0;
    for (let x = -X; x <= X; x += h) for (let y = h / 2; y < r.vys; y += h) {
      if (Math.hypot(x, y - r.yc) > r.Rs) continue;
      if (r.dutina && uvnitr(r.dutina, x, y)) continue;
      A += h * h; Sy += h * h * y; Iy += h * h * y * y;
    }
    const yt = Sy / A, I = Iy - A * yt * yt;
    return { A, yt, I, e: Math.max(yt, r.vys - yt) };
  }

  /** Mechanika C-oblouku (Castigliano, zakřivený nosník s tenkou stěnou): ohyb ramene od kořene ψ0 po ústí ψt. */
  function mechKlipu(r, t, p, o, mat) {
    const Rm = r.R + t / 2, b = o.b, I = b * t * t * t / 12;
    const hw = o.odstup > 0 ? Math.min(r.Ro * 0.75, r.Ro) : 0;
    const psi0 = o.odstup > 0 ? Math.asin(Math.min(0.99, hw / r.Ro)) : Math.acos(r.R / r.Ro);
    const psiT = Math.PI - r.g;
    const c0 = Math.cos(psi0), ct = Math.cos(psiT);
    let J = 0; const n = 200;
    for (let i = 0; i < n; i++) { const ps = psi0 + (psiT - psi0) * (i + 0.5) / n; J += Math.pow(Math.cos(ps) - ct, 2) * (psiT - psi0) / n; }
    const tuhost = mat.E * I / (Rm * Rm * Rm * J);                   // N/mm: boční síla na jedno ústí / posun
    const eps = d => d * t * (c0 - ct) / (2 * Rm * Rm * J);          // přetvoření v kořeni pro boční posun ústí d
    const dProEps = e => e * 2 * Rm * Rm * J / (t * (c0 - ct));
    return { Rm, psi0, psiT, J, tuhost, eps, dProEps, c0, ct };
  }
  /** Síly nasazení a vytažení trubky průměru Dp (N, obě ramena) a přetvoření. Infinity = samosvorné (nejde vytáhnout). */
  function silyKlipu(r, Dp, p, mat) {
    const m = r.mech, rr = Dp / 2, w2 = r.w / 2, mu = mat.mu, an = rad(p.klip.nabeh), ln = p.klip.delkaNabehu;
    if (rr <= w2 + 1e-6) return { drzi: false, Fin: 0, Fout: 0, epsMax: 0, d: 0 };
    let Fin = 0, Fout = 0;
    const sila = (P, a) => { const den = 1 - mu * Math.tan(a); return den <= 0.02 ? Infinity : 2 * P * (mu + Math.tan(a)) / den; };
    for (let i = 1; i <= 120; i++) {
      const x = w2 + (rr - w2) * i / 120, P = m.tuhost * (x - w2), aT = Math.acos(Math.min(1, x / rr));
      Fin = Math.max(Fin, sila(P, ln > 0 ? Math.min(aT, an) : aT));
      Fout = Math.max(Fout, sila(P, aT));
    }
    const d = rr - w2;
    return { drzi: true, Fin, Fout, d, epsMax: m.eps(d), epsTrvale: Dp > 2 * r.R ? m.eps(Dp / 2 - r.R) : 0 };
  }

  /* ---------------- kontroly ---------------- */
  function kontroly(p) {
    const H = [], o = odvozene(p), u = p.zakl.uchyceni, mat = MATERIALY[p.tisk.material];
    const chyba = (pole, text, oprava) => H.push({ uroven: 'chyba', pole, text, oprava });
    const var_ = (pole, text, oprava) => H.push({ uroven: 'varovani', pole, text, oprava });
    const info = (pole, text) => H.push({ uroven: 'info', pole, text });
    const opr = zm => ({ zmeny: zm });
    if (!POVOLENA[p.druh].includes(u)) chyba(['zakl.uchyceni'], `${NAZVY.uchyceni[u]} u druhu „${NAZVY.druh[p.druh]}“ nejde – zvolte jiné uchycení.`, opr({ 'zakl.uchyceni': 'sroub' }));
    if (o.chyby.includes('prumery')) chyba(['rada.prumery'], 'Seznam průměrů řady je prázdný – zadejte průměry oddělené středníkem (např. 16; 16; 20).', opr({ 'rada.prumery': '16; 16; 20' }));
    if (H.length) return dokonci(H);
    if (p.druh === 'hadice') { kontrolyHadice(p, o, H, chyba, var_, info, opr, mat); kontrolyMechaniky(p, o, chyba, var_, opr); return dokonci(H); }
    const t = o.t;
    // trubka a stěna
    if (t < 1.2) var_([p.druh + '.stena'], `Stěna ${fmt(t, 1)} mm je tenká – aspoň 3 dráhy trysky (≈ 1,2 mm).`, opr({ [p.druh + '.stena']: 1.2 }));
    if (p.trubka.vule < -0.06 * p.trubka.D - 0.2) var_(['trubka.vule'], `Sevření ${fmt(-p.trubka.vule, 2)} mm na poloměr je na trubku Ø ${fmt(p.trubka.D)} velké – oblouk zůstane trvale roztažený.`, opr({ 'trubka.vule': -Math.round(0.03 * p.trubka.D * 10) / 10 }));
    if (p.trubka.vule > 0.5) info(['trubka.vule'], `Vůle ${fmt(p.trubka.vule, 2)} mm – trubka bude v příchytce volně (vhodné pro dilataci teplé vody).`);
    // klip / řada: zacvaknutí
    if (p.druh === 'klip' || p.druh === 'rada') {
      const videno = new Set();
      for (const r of o.kruhy) {
        if (videno.has(r.D)) continue;
        videno.add(r.D);
        const jm = o.kruhy.length > 1 ? `Klip Ø ${fmt(r.D)}: ` : '';
        if (r.w >= r.D - 0.4) { chyba(['klip.obepnuti'], `${jm}ústí ${fmt(r.w, 1)} mm je skoro tak široké jako trubka – nedrží. Zvětšete obepnutí.`, opr({ 'klip.obepnuti': 240 })); continue; }
        const f = silyKlipu(r, r.D, p, mat);
        if (f.epsMax > mat.mez) {
          const g = obepnutiProEps(r, p, o, mat, 0.9 * mat.dov);
          chyba(['klip.obepnuti', 'klip.stena', 'tisk.material'], `${jm}při nasazení se oblouk ohne o ${fmt(f.epsMax * 100, 1)} % – ${mat.nazev} snese asi ${fmt(mat.mez * 100, 0)} %, klip praskne. Zmenšete obepnutí nebo stěnu, nebo zvolte pružnější materiál (PP, PA).`,
            g ? opr({ 'klip.obepnuti': g }) : undefined);
        } else if (f.epsMax > mat.dov) {
          const g = obepnutiProEps(r, p, o, mat, 0.9 * mat.dov);
          var_(['klip.obepnuti', 'klip.stena'], `${jm}přetvoření oblouku ${fmt(f.epsMax * 100, 1)} % je nad mezí opakovaného zacvaknutí (${fmt(mat.dov * 100, 1)} %) – vydrží několik nasazení, pak povolí.`, g ? opr({ 'klip.obepnuti': g }) : undefined);
        }
        if (f.epsTrvale > mat.dov * 0.6) var_(['trubka.vule'], `${jm}trubka drží oblouk trvale roztažený (přetvoření ${fmt(f.epsTrvale * 100, 1)} %) – plast časem povolí (tečení). Zmenšete sevření.`, opr({ 'trubka.vule': 0 }));
        if (p.zatez.montaz === 'strop' && Number.isFinite(f.Fout)) {
          const F = zatezNaKus(p, o).F;
          if (f.Fout < 2 * F) var_(['zatez.montaz', 'klip.obepnuti'], `${jm}trubka visí v klipu a vypadne silou ${fmt(f.Fout, 0)} N – tíha na příchytku je ${fmt(F, 0)} N. Zvětšete obepnutí nebo použijte omegu.`, opr({ 'klip.obepnuti': Math.min(300, p.klip.obepnuti + 20) }));
        }
      }
      if (p.druh === 'klip' && !p.klip.patky && o.sroub) {
        const r = o.kruhy[0];
        if (r.w < 2 * o.sroub.rh + 1) chyba(['klip.patky', 'klip.obepnuti'], `Hlava šroubu (Ø ${fmt(2 * o.sroub.rh, 1)}) neprojde ústím klipu (${fmt(r.w, 1)} mm) – šroubovák se ke středu nedostane. Dejte díry na patky vedle oblouku.`, opr({ 'klip.patky': true }));
        if (o.odstup > 0) info(['zakl.odstup'], 'Šroub do středu vede přes sloupek – je potřeba delší vrut.');
      }
      if (p.klip.delkaNabehu > 0 && p.klip.nabeh > 50) info(['klip.nabeh'], 'Náběh nad 50° od osy nasazování už sílu skoro nesníží.');
    }
    if (p.druh === 'rada') {
      for (let i = 1; i < o.kruhy.length; i++) {
        const a = o.kruhy[i - 1], c = o.kruhy[i];
        if (c.uc - a.uc < a.Ro + c.Ro + 0.4) chyba(['rada.roztec', 'rada.mezera'], `Rozteč ${fmt(c.uc - a.uc, 1)} mm je menší než šířka sousedních oblouků (${fmt(a.Ro + c.Ro + 0.4, 1)} mm) – klipy by se slily.`, opr({ 'rada.roztec': 0 }));
        else {
          // ústí se při nasazení rozevře o (D − w)/2; ústí leží níž než rovník, takže sousedovi zbývá Ro(1 − sin g)
          const roz = x => Math.max(0, (x.D - x.w) / 2 - x.Ro * (1 - Math.sin(x.g)));
          const potreba = roz(a) + roz(c) + 0.5, mez = c.uc - a.uc - a.Ro - c.Ro;
          if (mez < potreba && !H.some(h => h.pole && h.pole[0] === 'rada.mezera')) var_(['rada.mezera'], 'Mezera mezi klipy je menší než rozevření ústí při nasazení – nasazená trubka ohne i sousední klip.', opr({ 'rada.mezera': Math.ceil((potreba + p.rada.mezera - mez) * 2) / 2, 'rada.roztec': 0 }));
        }
      }
      if (o.kruhy.length > 1 && new Set(o.kruhy.map(r => r.D)).size > 1) info(['rada.prumery'], 'Různé průměry v řadě: všechny trubky leží na základně, osy proto nejsou v jedné rovině.');
    }
    if (p.druh === 'objimka') {
      const uc = o.ucho;
      if (p.objimka.mezera < 0.5 && p.trubka.vule >= 0) var_(['objimka.mezera', 'trubka.vule'], 'Bez mezery mezi polovinami a bez sevření objímka trubku nestáhne.', opr({ 'objimka.mezera': 1.5 }));
      if (uc.Le < uc.s * 1.155 + 2.4) chyba(['objimka.ucho'], `Ucho ${fmt(uc.Le, 1)} mm je na matici ${uc.M} úzké.`, opr({ 'objimka.ucho': Math.ceil(uc.s * 1.155 + 3.2) }));
      if (o.tyc && u !== 'sroub') info(['objimka.stojna'], 'Objímka na závitovou tyč se nepřipevňuje deskou – zvolené uchycení se nepoužije.');
      const Z = o.zakladna, r = o.kruhy[0], volno = r.vc - p.objimka.mezera / 2 - uc.he - (Z ? Z.v1 : 0);
      if (Z && volno < uc.m + 1) chyba(['zakl.odstup'], `Pod uchem zbývá ${fmt(volno, 1)} mm – matice ${uc.M} se do kapsy nezasune. Zvětšete odstup.`, opr({ 'zakl.odstup': Math.ceil(o.odstup + uc.m + 1.5 - volno) }));
      if (o.tyc && o.uzkaTyc) var_(['trubka.sirka'], `Objímka je na matici ${o.tyc.M} úzká.`, opr({ 'trubka.sirka': Math.ceil(o.tyc.s * 1.155 + 4) }));
      if (o.tyc) info(['objimka.stojna'], `Tyč ${o.tyc.M} se zašroubuje do hmoždinky (nebo vrut se závitem M); matice ${o.tyc.M} se zasune do kapsy v patce, druhá matice ji zespodu pojistí. Vzdálenost od zdi = kolik tyče vyčnívá.`);
    }
    if (p.druh === 'omega') {
      if (o.odstup > 0 && o.odstup < 2) var_(['zakl.odstup'], 'Odstup pod 2 mm – sedlo by bylo tenké. Zadejte 0 (trubka u zdi) nebo aspoň 2 mm.', opr({ 'zakl.odstup': 0 }));
      if (p.trubka.vule > 0.2) info(['trubka.vule'], 'Omega s vůlí trubku nepřitlačí – pro pevné uchycení zadejte zápornou vůli (přítlak).');
    }
    kontrolyUchyceni(p, o, H, chyba, var_, info, opr, mat);
    kontrolyMechaniky(p, o, chyba, var_, opr);
    // tisková poloha
    const kr = p.diry === 'kruh';
    info(null, p.druh === 'objimka'
      ? (kr ? 'Tisková poloha: obě poloviny na boku – průřez objímky leží v rovině vrstev, oblouk a uši se při stažení ohýbají podél vláken. Díry pro šrouby jsou vodorovné a kruhové, kapsa matice má plochý strop.'
        : 'Tisková poloha: obě poloviny na boku – průřez objímky leží v rovině vrstev, oblouk a uši se při stažení ohýbají podél vláken. Díry pro šrouby jsou vodorovné, proto mají tvar kapky (špička nahoru), kapsa matice stojí na hraně.')
      : (kr ? 'Tisková poloha: na boku – celý průřez příchytky leží v rovině vrstev, takže se oblouk při zacvaknutí a zatížení ohýbá podél vláken. Naležato (zády na podložce) by ohyb nesly spoje vrstev – mez přetvoření je asi poloviční a klip by praskl mezi vrstvami. Díry jsou v tisku vodorovné a kruhové.'
        : 'Tisková poloha: na boku – celý průřez příchytky leží v rovině vrstev, takže se oblouk při zacvaknutí a zatížení ohýbá podél vláken. Naležato (zády na podložce) by ohyb nesly spoje vrstev – mez přetvoření je asi poloviční a klip by praskl mezi vrstvami. Díry jsou v tisku vodorovné, proto mají tvar kapky se špičkou nahoru.'));
    if (kr && (o.diry.length || o.tyc)) info(['diry'], 'Kruhové vodorovné díry mají převislý strop – tiskněte s podporami nebo zvolte kapku.');
    if (p.tisk.material === 'PLA' && (p.druh === 'klip' || p.druh === 'rada')) info(['tisk.material'], 'PLA je na zaklapávací klip tuhé a křehké a na slunci nebo u teplé vody měkne – lepší je PETG, PP nebo nylon.');
    return dokonci(H);
  }
  function dokonci(H) {
    for (const h of H) if (h.oprava && !h.oprava.text) h.oprava.text = textOpravy(h.oprava.zmeny);
    return H;
  }
  /** Únosnost uchycení a sedla hadice proti zatížení. */
  function kontrolyMechaniky(p, o, chyba, var_, opr) {
    const m = mechanika(p, o), u = m.uchyceni;
    if (u && u.vyuziti > 1) {
      const vetsi = Object.keys(CL.VRUTY).map(Number).find(d => d > p.sroub.vrut);
      chyba(['zatez.rozestup', 'sroub.vrut', 'sroub.podklad'], `${u.coNese} nevydrží: potřeba ${fmt(u.potreba, 0)} ${u.jednotka}, únosnost ${fmt(u.kapacita, 0)} ${u.jednotka} (využití ${fmt(u.vyuziti * 100, 0)} %). Zkraťte rozestup příchytek nebo zvolte silnější uchycení.`,
        p.zakl.uchyceni === 'sroub' && vetsi ? opr({ 'sroub.vrut': vetsi }) : opr({ 'zatez.rozestup': Math.max(50, Math.floor(p.zatez.rozestup / u.vyuziti / 1.3 / 10) * 10) }));
    } else if (u && u.vyuziti > 0.7) var_(['zatez.rozestup'], `${u.coNese} je využité na ${fmt(u.vyuziti * 100, 0)} % – malá rezerva.`, opr({ 'zatez.rozestup': Math.max(50, Math.floor(p.zatez.rozestup * 0.6 / 10) * 10) }));
    if (m.sedlo && m.sedlo.vyuziti > 1) chyba(['hadice.stena', 'hadice.zavitu'], `Sedlo se pod hadicí ohne nad mez (napětí ${fmt(m.sedlo.sigma, 1)} MPa, dovoleno ${fmt(m.sedlo.dov, 1)} MPa). Zesilte stěnu nebo zkraťte sedlo.`, opr({ 'hadice.stena': Math.min(12, p.hadice.stena + 2) }));
  }

  /** Mechanika: síly klipů, zatížení a únosnost uchycení, ohyb sedla hadice. Jednotky N, mm, MPa. */
  function mechanika(p, o) {
    o = o || odvozene(p);
    const mat = MATERIALY[p.tisk.material], z = zatezNaKus(p, o), F = z.F, out = { zatez: z };
    if (p.druh === 'klip' || p.druh === 'rada') out.klipy = o.kruhy.map(r => {
      const f = silyKlipu(r, r.D, p, mat), m = r.mech;
      const dMez = m.dProEps(mat.mez), dDov = m.dProEps(mat.dov);
      return Object.assign(f, { D: r.D, w: r.w, R: r.R, tuhost: m.tuhost, Dmin: r.w + 0.6, Dmax: Math.min(r.w + 2 * dMez, 2 * r.R + 2 * dDov * 0.6), dov: mat.dov, mez: mat.mez,
        sigma: f.epsMax * mat.E, samosvorne: !Number.isFinite(f.Fout) });
    });
    // páka: osa trubky / střed sedla od zdi; klopná hrana = spodní okraj základny
    const e = o.osaOdZdi, M = p.zatez.montaz === 'zed' || p.druh === 'hadice' ? F * e : 0, u = p.zakl.uchyceni;
    out.M = M; out.e = e;
    let ramena = [];
    if (p.druh === 'hadice') ramena = o.diry.map(d => d.y);
    else if (o.zakladna && !o.tyc) { const ua = o.zakladna.u0; ramena = o.diry.map(d => d.u - ua); }
    const sumL2 = ramena.reduce((s, l) => s + l * l, 0);
    const tahy = ramena.map(l => (p.zatez.montaz === 'strop' && p.druh !== 'hadice' ? F / ramena.length : M * l / Math.max(sumL2, 1e-9)));
    const plast = d => {   // protržení hlavy plastem: střih po obvodu hlavy, napříč vrstvami ½, bezpečnost 3
      const t = Math.max(0.5, o.tb - (d.hz || 0) / 2), tau = 0.6 * mat.sigma * NAPRIC_VRSTVAMI;
      return Math.PI * 2 * d.rh * t * tau / 3;
    };
    const B = o.uRozsah[1] - o.uRozsah[0], b = p.druh === 'hadice' ? o.hadice.sirkaDesky : o.b + o.wExt, hB = p.druh === 'hadice' ? o.hadice.vyskaDesky : B;
    if ((u === 'sroub' || (u === 'drazka' && !(o.drazka && o.drazka.zobacky))) && o.diry.length && !o.tyc) {
      const Tmax = Math.max(...tahy), d = o.diry[0];
      let kotva, popisK;
      if (u === 'sroub') { const v = CL.VRUTY[p.sroub.vrut], pk = PODKLADY[p.sroub.podklad]; kotva = pk.nNaMm * (p.sroub.podklad === 'drevo' ? v.d : v.hmozdinka); popisK = p.sroub.podklad === 'drevo' ? `vrut ${fmt(v.d)} v dřevě` : `hmoždinka Ø ${fmt(v.hmozdinka)} v podkladu ${pk.nazev}`; }
      else { kotva = TMATICE[o.sroub.M] || 800; popisK = `T-matice ${o.sroub.M}`; }
      const pl = plast(d), kap = Math.min(kotva, pl);
      out.uchyceni = { coNese: o.diry.length > 1 ? 'Šrouby' : 'Šroub', potreba: Tmax, kapacita: kap, jednotka: 'N', vyuziti: Tmax / kap, kotva, popisK, plast: pl, tahy, strih: F / o.diry.length, n: o.diry.length };
    } else if (u === 'paska' && !o.tyc) {
      const A = B * b, tau = F / A, sig = p.zatez.montaz === 'strop' && p.druh !== 'hadice' ? F / A : 6 * M / (b * hB * hB);
      const dov = p.paska.pevnost / 100, potreba = Math.max(tau, sig);
      out.uchyceni = { coNese: 'Páska', potreba: potreba * 100, kapacita: p.paska.pevnost, jednotka: 'N/cm²', vyuziti: potreba / dov, A, tau, sig };
    } else if (u === 'stah' && !o.tyc) {
      const pk = PASKY.reduce((a, c) => (Math.abs(c[0] - p.stah.sirka) < Math.abs(a[0] - p.stah.sirka) ? c : a));
      const kap = pk[2] * Math.min(1, p.stah.sirka / pk[0]) / 2;
      out.uchyceni = { coNese: 'Stahovací páska', potreba: F, kapacita: kap, jednotka: 'N', vyuziti: F / kap, pevnost: pk[2] };
    } else out.uchyceni = null;
    if (p.druh === 'hadice') {
      const r = o.hadice, Ms = F * r.hloubka / 2, sig = Ms * r.prurez.e / r.prurez.I, dov = mat.sigma / 3;
      out.sedlo = { M: Ms, sigma: sig, dov, vyuziti: sig / dov, I: r.prurez.I, A: r.prurez.A };
    }
    return out;
  }
  /** Obepnutí (°), při kterém přetvoření nasazení vyjde na cíl (bisekce); null = nejde. */
  function obepnutiProEps(r, p, o, mat, cil) {
    let lo = MEZE['klip.obepnuti'][0], hi = p.klip.obepnuti;
    const eps = g => { const q = kopie(p); q.klip.obepnuti = g; const oo = odvozene(q); const rr = oo.kruhy[o.kruhy.indexOf(r)] || oo.kruhy[0]; return silyKlipu(rr, rr.D, q, mat).epsMax; };
    if (eps(lo) > cil) return null;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (eps(m) > cil) hi = m; else lo = m; }
    const g = Math.floor(lo);
    // ústí musí zůstat užší než trubka
    const q = kopie(p); q.klip.obepnuti = g;
    return odvozene(q).kruhy.every(x => x.w < x.D - 0.6) ? g : null;
  }

  function kontrolyUchyceni(p, o, H, chyba, var_, info, opr) {
    const u = p.zakl.uchyceni, s = o.sroub;
    if (o.tyc) return;
    if (s && u === 'sroub') {
      const v = CL.VRUTY[p.sroub.vrut];
      if (s.hz > 0 && o.tb < s.hz + 1) chyba(['zakl.tl', 'sroub.hlava'], `Deska ${fmt(o.tb, 1)} mm je na zápustnou hlavu vrutu ${fmt(v.d)} tenká (kužel ${fmt(s.hz, 1)} mm + 1 mm pod ním).`, opr({ 'zakl.tl': Math.ceil((s.hz + 1.2) * 2) / 2 }));
      info(['sroub.vrut'], `Vrut ${fmt(v.d)} mm → hmoždinka Ø ${fmt(v.hmozdinka)} mm (díra v plastu Ø ${fmt(v.otvor, 1)}, hlava Ø ${fmt(v.hlava)}).`);
    }
    const vyskaDiry = s ? (p.diry === 'kruh' ? 2 * s.ro : s.ro * (1 + Math.SQRT2)) : 0;
    if (s && o.b < vyskaDiry + 2.4 && p.druh !== 'objimka' && p.druh !== 'hadice') chyba(['trubka.sirka'], p.diry === 'kruh' ? `Díra pro šroub (kruh Ø ${fmt(vyskaDiry, 1)} mm) by příchytku širokou ${fmt(o.b)} mm přeřízla.` : `Díra pro šroub (kapka ${fmt(vyskaDiry, 1)} mm) by příchytku širokou ${fmt(o.b)} mm přeřízla.`, opr({ 'trubka.sirka': Math.ceil(2 * s.rh + 3) }));
    else if (s && o.b < 2 * s.rh + 2 && p.druh !== 'objimka' && p.druh !== 'hadice') var_(['trubka.sirka'], `Šířka příchytky ${fmt(o.b)} mm je menší než hlava šroubu (Ø ${fmt(2 * s.rh, 1)}) – hlava přečnívá.`, opr({ 'trubka.sirka': Math.ceil(2 * s.rh + 3) }));
    if (s && o.tb < 2) var_(['zakl.tl'], 'Základna pod šroubem je tenká – hlava ji protrhne.', opr({ 'zakl.tl': 3 }));
    if (u === 'drazka') {
      const d = o.drazka;
      const podelOK = (p.druh === 'klip' && !p.klip.patky) || p.druh === 'objimka';
      if (p.druh !== 'hadice' && d.smer === 'podel' && !podelOK) chyba(['drazka.smer'], `U druhu „${NAZVY.druh[p.druh]}“${p.druh === 'klip' ? ' s patkami' : ''} leží díry napříč trubkou – drážka musí vést napříč.`, opr({ 'drazka.smer': 'napric' }));
      if (p.druh !== 'hadice' && d.zpusob === 'zaklapnuti' && d.smer !== 'podel') chyba(['drazka.zpusob'], 'Zaklapnutí do drážky jde jen podél trubky (zobáčky leží v průřezu, tisknou se bez podpor).', podelOK ? opr({ 'drazka.smer': 'podel' }) : opr({ 'drazka.zpusob': 'tmatice' }));
      if (d.zobacky) {
        const z = d.zobacky;
        if (z.tl < 1.2) chyba(['drazka.zachyt', 'drazka.profil'], `Zobáčky by měly jen ${fmt(z.tl, 2)} mm – drážka je na zaklapnutí úzká.`, opr({ 'drazka.zpusob': 'tmatice' }));
        const eps = 1.5 * z.tl * z.z / Math.pow(z.Lef, 2);
        const m = MATERIALY[p.tisk.material];
        if (eps > m.mez) var_(['drazka.zachyt'], `Zobáčky se při zaklapnutí ohnou o ${fmt(eps * 100, 1)} % – nad mezí ${m.nazev}, ulomí se. Zmenšete záchyt.`, opr({ 'drazka.zachyt': 0.3 }));
        info(['drazka.zpusob'], 'Zaklapnutý klip drží jen třením a zobáčky pod límcem – na lehké kabely a hadičky; na těžší trubku T-matice.');
      }
      info(['drazka.profil'], `Drážka ${p.drazka.profil}: šířka ${fmt(d.pr.drazka, 1)} mm, límec ${fmt(d.pr.limec, 1)} mm – typické rozměry řady B, u konkrétního výrobce ověřte měřením.`);
    }
    if (u === 'cleat') {
      const z = o.zamek;
      if (p.cleat.vyska - z.pokles < 5) chyba(['cleat.vyska', 'cleat.uhel'], 'Lišta s tímto úkosem nemá u zdi skoro žádnou výšku – zvyšte lištu nebo zmenšete úkos.');
      info(['cleat.tl'], `Zámek pasuje na lištu ${fmt(p.cleat.tl)} × ${fmt(p.cleat.vyska)} mm s úkosem ${fmt(p.cleat.uhel)}° a vůlí ${fmt(p.cleat.vule, 1)} mm (stejná soustava jako stránka French cleat).`);
    }
    if (u === 'paska') {
      const A = (o.uRozsah[1] - o.uRozsah[0]) * (o.b + o.wExt);
      if (A < 300) var_(['zakl.sirka', 'trubka.sirka'], `Plocha pod páskou je jen ${fmt(A / 100, 1)} cm² – páska udrží málo. Rozšiřte základnu.`, opr({ 'zakl.sirka': Math.ceil(300 / o.b + 2) }));
      info(['paska.pevnost'], 'Pásku lepte na čistý odmaštěný povrch, přitlačte a nechte 24 h dotvrdnout. Na drsné omítce drží výrazně hůř.');
    }
    if (u === 'stah') {
      const tu = o.tunel;
      if (o.tb < tu.vyska + 2.4) chyba(['zakl.tl', 'stah.tl'], `Základna ${fmt(o.tb, 1)} mm je na tunel pro pásku (${fmt(tu.vyska, 1)} mm) tenká.`, opr({ 'zakl.tl': Math.ceil((tu.vyska + 2.6) * 2) / 2 }));
      if (o.b < tu.sirka + 3) chyba(['trubka.sirka', 'stah.sirka'], `Příchytka ${fmt(o.b)} mm je na pásku ${fmt(p.stah.sirka, 1)} mm úzká.`, opr({ 'trubka.sirka': Math.ceil(tu.sirka + 4) }));
    }
  }

  function kontrolyHadice(p, o, H, chyba, var_, info, opr, mat) {
    const r = o.hadice, h = p.hadice;
    if (r.Rs < r.minR - 0.5) var_(['hadice.polomer'], `Poloměr sedla ${fmt(r.Rs)} mm je menší než doporučený nejmenší poloměr ohybu hadice (≈ 5 × Ø = ${fmt(r.minR, 0)} mm) – hadice se může zalomit.`, opr({ 'hadice.polomer': 0 }));
    if (r.vys < 3 * r.tl + 6) var_(['hadice.uhel'], 'Sedlo je nízké (malý úhel oblouku) – hadice z něj sklouzne do strany.', opr({ 'hadice.uhel': 120 }));
    if (h.lem < p.trubka.D * 0.4) var_(['hadice.lem'], `Lem ${fmt(h.lem)} mm je na hadici Ø ${fmt(p.trubka.D)} nízký – hadice z držáku spadne.`, opr({ 'hadice.lem': Math.ceil(p.trubka.D * 0.5) }));
    kontrolyUchyceni(p, o, H, chyba, var_, info, opr, mat);
    if (p.zakl.uchyceni === 'drazka' && p.drazka.zpusob === 'zaklapnuti') chyba(['drazka.zpusob'], 'Držák hadice je na zaklapnutí moc těžký – použijte T-matice.', opr({ 'drazka.zpusob': 'tmatice' }));
    info(null, p.diry === 'kruh' ? 'Tisková poloha: nastojato, spodek sedla a desky na podložce. Sedlo nese hadici jako konzola od zdi – ohyb tak leží ve vrstvách. Dutina uvnitř sedla má střechu 45° a tiskne se bez podpor; díry pro vruty jsou kruhové.' : 'Tisková poloha: nastojato, spodek sedla a desky na podložce. Sedlo nese hadici jako konzola od zdi – ohyb tak leží ve vrstvách. Dutina uvnitř sedla má střechu 45° a tiskne se bez podpor; díry pro vruty jsou kapkovité.');
    if (p.diry === 'kruh' && o.diry.length) info(['diry'], 'Kruhové vodorovné díry mají převislý strop – tiskněte s podporami nebo zvolte kapku.');
  }
  const POPISKY = {
    'zakl.uchyceni': h => `uchycení: ${NAZVY.uchyceni[h]}`, 'klip.obepnuti': h => `obepnutí ${fmt(h, 0)}°`, 'klip.patky': () => 'díry na patkách',
    'klip.stena': h => `stěna ${fmt(h, 2)} mm`, 'omega.stena': h => `stěna ${fmt(h, 2)} mm`, 'objimka.stena': h => `stěna ${fmt(h, 2)} mm`,
    'trubka.vule': h => (h < 0 ? `sevření ${fmt(-h, 2)} mm` : `vůle ${fmt(h, 2)} mm`), 'trubka.sirka': h => `šířka ${fmt(h, 1)} mm`,
    'rada.roztec': () => 'rozteč automaticky', 'rada.mezera': h => `mezera ${fmt(h, 1)} mm`, 'rada.prumery': h => `průměry ${h}`,
    'objimka.mezera': h => `mezera ${fmt(h, 1)} mm`, 'objimka.ucho': h => `ucho ${fmt(h, 1)} mm`,
    'zakl.tl': h => `základna ${fmt(h, 1)} mm`, 'zakl.odstup': h => `odstup ${fmt(h, 1)} mm`, 'zakl.sirka': h => `šířka základny ${fmt(h, 0)} mm`,
    'drazka.smer': h => `drážka ${NAZVY.smer[h]}`, 'drazka.zpusob': h => NAZVY.zpusob[h], 'drazka.zachyt': h => `záchyt ${fmt(h, 1)} mm`,
    'hadice.polomer': () => 'poloměr sedla automaticky', 'hadice.uhel': h => `oblouk ${fmt(h, 0)}°`, 'hadice.lem': h => `lem ${fmt(h, 0)} mm`,
    'sroub.vrut': h => `vrut ${fmt(h, 1)}`, 'zatez.rozestup': h => `rozestup ${fmt(h, 0)} mm`, 'zatez.montaz': h => NAZVY.montaz[h],
  };
  const textOpravy = zmeny => Object.entries(zmeny).map(([c, h]) => (POPISKY[c] ? POPISKY[c](h) : `${c} ${h}`)).join(', ');

  /** Zatížení jedné příchytky: hmotnost na metr (odhad: trubka plná vody / hadice), síla F (N). */
  function zatezNaKus(p, o) {
    let kgm = p.zatez.kgm;
    const D = p.trubka.D / 1000, odhad = (Dd, rhoS) => Math.PI / 4 * Math.pow(0.75 * Dd, 2) * 1000 + Math.PI / 4 * (Dd * Dd - Math.pow(0.75 * Dd, 2)) * rhoS;
    if (p.druh === 'hadice') {
      if (!(kgm > 0)) kgm = odhad(D, 1200);
      return { kgm, kg: kgm * p.hadice.delka, F: kgm * p.hadice.delka * 9.81, odhad: !(p.zatez.kgm > 0) };
    }
    const prum = o && o.kruhy ? o.kruhy.map(r => r.D / 1000) : [D];
    if (!(kgm > 0)) kgm = prum.reduce((s, d) => s + odhad(d, 950), 0);
    else kgm *= prum.length;
    const kg = kgm * p.zatez.rozestup / 1000;
    return { kgm, kg, F: kg * 9.81, odhad: !(p.zatez.kgm > 0) };
  }

  /* ---------------- stavba těles ---------------- */
  /** Kapka (díra s 45° špičkou ve směru +b): body (a, b) kolem počátku; kruh = kruhová díra (p.diry === 'kruh'). */
  function kapka(r, n = 24, kruh = false) {
    if (kruh) return G.obrysDiry(r, 32, false);
    // oblouk 270° od 45° (vpravo nahoře) přes spodek ke 135°, špička nahoře v (0, r√2)
    const b = [];
    for (let i = 0; i <= n; i++) { const a = rad(45) - rad(270) * i / n; b.push([r * Math.cos(a), r * Math.sin(a)]); }
    b.push([0, r * Math.SQRT2]);
    return b;
  }
  /** Šestihran matice s vodorovnou osou (v tisku): plochou nahoru a nad ní střecha 45° (+b) – bez převisu (strecha = false: plochý strop). */
  const sestiuhelnik = (s, v, strecha = true) => { const R = s / Math.sqrt(3) + v, b = []; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; b.push([R * Math.cos(a), R * Math.sin(a)]); } if (strecha) b.push([0, R * Math.sqrt(3) / 2 + R / 2]); return b; };

  function postav(w, p, volby = {}) {
    const t0 = Date.now(), o = odvozene(p);
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const seg = r => Math.max(28, Math.min(160, Math.ceil(2 * Math.PI * r / 0.8 / 4) * 4));
    const poly = b => k(new CS([b], 'NonZero'));
    const obd = (a0, a1, b0, b1) => poly([[a0, b0], [a1, b0], [a1, b1], [a0, b1]]);
    const kruh = (r, a, b) => k(k(CS.circle(r, seg(r))).translate([a, b]));
    const sjednot = l => (l.length === 1 ? l[0] : k(CS.union(l)));
    /** Hranol z rovnoběžných řezů: vrstvy [[body2D, s], …] v rámu f(a, b, s) → [x, y, z]. */
    const hranol = (vrstvy, f) => k(M.hull(vrstvy.flatMap(([b, s]) => b.map(([a, c]) => f(a, c, s)))));
    try {
      const dily = [];
      let sestava = [];
      if (p.druh === 'hadice') {
        const r = postavHadici(M, CS, k, poly, kruh, obd, hranol, o, p);
        dily.push(...r.dily); sestava = r.sestava;
      } else {
        const r = postavProfil(M, CS, k, poly, kruh, obd, sjednot, hranol, seg, o, p);
        dily.push(...r.dily); sestava = r.sestava;
      }
      // kalibrační hřebínek: 5 klipů s vůlí −2…+2 kroky
      const kalibrace = [];
      if ((volby.kalibrace || p.tisk.kalibrace) && p.druh !== 'hadice') kalibrace.push(postavKalibraci(M, CS, k, poly, kruh, obd, sjednot, seg, o, p));
      const sit_ = (m, jmeno, nazev, barva, prevod) => sit(k, m, jmeno, nazev, barva, prevod);
      const out = dily.map(d => Object.assign(sit_(d.m, d.jmeno, d.nazev, d.barva, d.prevod), d.prurez ? { prurez: d.prurez } : {}));
      const kal = kalibrace.map(d => sit_(d.m, d.jmeno, d.nazev, d.barva, d.prevod));
      // okolí je popsané v pomocném rámu (X podél trubky / zdi, Y = −od zdi, Z nahoru) → sestava (X od zdi, Y podél, Z nahoru)
      for (const s of sestava) for (let i = 0; i < s.poz.length; i += 3) { const x = s.poz[i], y = s.poz[i + 1]; s.poz[i] = -y; s.poz[i + 1] = x; }
      return { o, dily: out, kalibrace: kal, sestava: sestava.concat(out.map(d => Object.assign({}, d, { poz: d.pozSestava }))), cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  /** Klip, omega, objímka, řada: průřez (u, v) vytažený o b ve směru w (= tisková poloha). */
  function postavProfil(M, CS, k, poly, kruh, obd, sjednot, hranol, seg, o, p) {
    const kruhD = p.diry === 'kruh', dira = r => kapka(r, 24, kruhD);   // vodorovné díry: kapka / kruh
    const b = o.b, t = o.t, vz0 = o.vz0, Z = o.zakladna;
    const uzavri = (cs, f) => k(k(cs.offset(f, 'Round', 2, 24)).offset(-f, 'Round', 2, 24));
    const dily = [];
    /** Rozevřený oblouk klipu s náběhy (přidá se po odečtení dutiny). */
    const nabehy = r => {
      const out = [], an = rad(p.klip.nabeh), ln = p.klip.delkaNabehu;
      if (ln <= 0) return out;
      for (const s of [1, -1]) {
        const E = [r.uc + s * r.R * Math.sin(r.g), r.vc + r.R * Math.cos(r.g)], Eo = [r.uc + s * r.Ro * Math.sin(r.g), r.vc + r.Ro * Math.cos(r.g)];
        const d = [s * Math.sin(an), Math.cos(an)];
        const gg = r.g + 0.6 / r.R, Ez = [r.uc + s * (r.R + 0.2) * Math.sin(gg), r.vc + (r.R + 0.2) * Math.cos(gg)], Eoz = [r.uc + s * r.Ro * Math.sin(gg), r.vc + r.Ro * Math.cos(gg)];   // přesah do oblouku
        out.push(k(CS.hull([poly([E, Eo, [Eo[0] + ln * d[0], Eo[1] + ln * d[1]], [E[0] + ln * d[0], E[1] + ln * d[1]]]), poly([E, Eo, Eoz, Ez])])));
      }
      return out;
    };
    const klin = r => {   // výřez ústí: vějíř od osy ±g kolem svislice
      const L = (r.Ro + 0.4) / Math.cos(r.g / 8), b2 = [[r.uc, r.vc]];   // jen přes oblouk – nesmí ukousnout souseda
      for (let i = 0; i <= 8; i++) { const a = -r.g + 2 * r.g * i / 8; b2.push([r.uc + L * Math.sin(a), r.vc + L * Math.cos(a)]); }
      return poly(b2);
    };
    const zamek = () => (o.cleat ? [poly(o.zamek.poly)] : []);
    const zakladnaCS = () => (Z ? [obd(Z.u0, Z.u1, Z.v0, Z.v1)] : []);
    const odecti = (cs, l) => (l.length ? k(cs.subtract(sjednot(l))) : cs);
    const fil = Math.min(2, t);
    const nadZdi = cs => k(cs.intersect(obd(-1e4, 1e4, vz0, 1e4)));   // nic za rovinou zdi / desky (zámek cleatu se přidá zvlášť)

    let hlavni = null, druhy = null, sedlo = null;
    if (p.druh === 'klip' || p.druh === 'rada') {
      const plne = [...zakladnaCS()];
      for (const r of o.kruhy) {
        plne.push(kruh(r.Ro, r.uc, r.vc));
        if (o.odstup > 0) plne.push(obd(r.uc - r.Ro * 0.75, r.uc + r.Ro * 0.75, Z.v1 - 0.01, r.vc));
      }
      let cs = sjednot([uzavri(nadZdi(sjednot(plne)), fil), ...zamek()]);
      cs = odecti(cs, o.kruhy.flatMap(r => [kruh(r.R, r.uc, r.vc), klin(r)]));
      const nb = o.kruhy.flatMap(nabehy);
      if (nb.length) cs = sjednot([cs, ...nb]);
      hlavni = cs;
    } else if (p.druh === 'omega') {
      const r = o.kruhy[0], uu = r.Ro + o.Lf;
      const plne = [k(kruh(r.Ro, r.uc, r.vc)), obd(-r.Ro, r.Ro, vz0, r.vc), obd(-uu, uu, vz0, vz0 + o.tb)];
      let cs = uzavri(nadZdi(sjednot(plne)), fil);
      cs = odecti(cs, [kruh(r.R, r.uc, r.vc), obd(-r.R, r.R, vz0 - 1, r.vc)]);
      hlavni = cs;
      if (o.odstup >= 2) {
        const sv = r.vc - r.D / 2 * 0.35;
        sedlo = k(obd(-r.R + 0.4, r.R - 0.4, vz0, sv).subtract(kruh(r.D / 2 + 0.1, r.uc, r.vc)));
      }
    } else if (p.druh === 'objimka') {
      const r = o.kruhy[0], uc = o.ucho, g2 = p.objimka.mezera / 2, uu = r.Ro + uc.Le;
      const dolni = [k(kruh(r.Ro, 0, r.vc).intersect(obd(-r.Ro - 1, r.Ro + 1, r.vc - r.Ro - 1, r.vc - g2)))];
      dolni.push(obd(-uu, uu, r.vc - g2 - uc.he, r.vc - g2));
      const vSl = Z ? Z.v1 - 0.01 : 0;
      dolni.push(obd(-o.wp / 2, o.wp / 2, vSl, r.vc - r.R * 0.5));
      if (Z) dolni.push(...zakladnaCS());
      let cs = sjednot([uzavri(nadZdi(sjednot(dolni)), fil), ...zamek()]);
      cs = odecti(cs, [kruh(r.R, 0, r.vc), obd(-uu - 1, uu + 1, r.vc - g2, r.vc + r.Ro + 5)]);
      hlavni = cs;
      let hor = sjednot([k(kruh(r.Ro, 0, r.vc).intersect(obd(-r.Ro - 1, r.Ro + 1, r.vc + g2, r.vc + r.Ro + 1))), obd(-uu, uu, r.vc + g2, r.vc + g2 + uc.heH)]);
      hor = uzavri(hor, fil);
      hor = odecti(hor, [kruh(r.R, 0, r.vc), obd(-uu - 1, uu + 1, r.vc - r.Ro - 5, r.vc + g2)]);
      druhy = hor;
    }
    /* ---- vytažení a 3D úpravy (rám: x = u, y = v, z = w) ---- */
    const f3 = (uu, ww) => (a, c, s) => [uu + a, s, ww + c];   // průřez díry (a napříč, c = nahoru v tisku), s = v
    const diraM = d => {
      const kp = dira(d.ro), l = [hranol([[kp, d.vBot], [kp, d.vTop + (d.hz > 0 ? 0 : 0.01)]], f3(d.u, d.w))];
      if (d.hz > 0) {
        const kh = dira(d.rh), kk = dira(d.ro);
        l.push(hranol([[kk, d.vTop - (d.rh - d.ro)], [kh, d.vTop], [dira(d.rh), d.vTop + 3]], f3(d.u, d.w)));
      } else l.push(hranol([[dira(d.rh), d.vTop], [dira(d.rh), d.vTop + 30]], f3(d.u, d.w)));
      return l;
    };
    let telo = k(hlavni.extrude(b));
    const plus = [], minus = [];
    // prodloužená deska objímky (nahoru v tisku)
    if (o.wExt > 0 && Z) plus.push(k(k(M.cube([Z.u1 - Z.u0, Z.v1 - Z.v0, o.wExt + 0.01])).translate([Z.u0, Z.v0, b - 0.01])));
    // drážka profilu: pero / zobáčky
    if (o.drazka) {
      const d = o.drazka, wDo = b + o.wExt;
      if (d.zobacky) {
        const z = d.zobacky, dw2 = d.dw / 2, s2 = z.sl / 2, L = z.L, hh = z.hh;
        for (const sg of [1, -1]) {
          const bb = [[s2, vz0 + 0.01], [dw2, vz0 + 0.01], [dw2, vz0 - L], [dw2 + z.z, vz0 - L], [Math.max(s2, dw2 + z.z - hh), vz0 - L - hh], [s2, vz0 - L - hh]].map(([a, c]) => [sg * a, c]);
          plus.push(k(poly(bb).extrude(wDo)));
        }
        minus.push(k(k(M.cube([z.sl, z.Lef + 0.5, wDo + 2])).translate([-z.sl / 2, vz0 - L - hh - 0.5, -1])));
      } else if (d.smer === 'podel') {
        plus.push(k(k(M.cube([d.dw, d.hk + 0.01, wDo])).translate([-d.dw / 2, vz0 - d.hk, 0])));
      } else {
        // napříč: pero podél u, spodní strana (v tisku) zkosená 45°
        const ww = o.diry.length ? o.diry[0].w : b / 2, a0 = Z ? Z.u0 : -10, a1 = Z ? Z.u1 : 10;
        const pr = [[ww - d.dw / 2, vz0 + 0.01], [ww + d.dw / 2, vz0 + 0.01], [ww + d.dw / 2, vz0 - d.hk], [ww - d.dw / 2 + d.hk, vz0 - d.hk]];
        plus.push(hranol([[pr.map(([c, v]) => [v, c]), a0], [pr.map(([c, v]) => [v, c]), a1]], (vv, ww2, uu) => [uu, vv, ww2]));
        // díry u napříč: pero je jen pod deskou – díry ho prorazí níže
      }
      for (const dd of o.diry) dd.vBot = vz0 - d.hk - 1;
    }
    // tunel pro stahovací pásku
    if (o.tunel && Z) {
      const tu = o.tunel, vm = (Z.v0 + Z.v1) / 2;
      minus.push(k(k(M.cube([Z.u1 - Z.u0 + 2, tu.vyska, tu.sirka])).translate([Z.u0 - 1, vm - tu.vyska / 2, b / 2 - tu.sirka / 2])));
    }
    // objímka na tyč: díra pro tyč + kapsa matice ze spodku sloupku
    if (o.tyc) {
      const r = o.kruhy[0], ty = o.tyc;
      minus.push(hranol([[dira(ty.d / 2 + 0.25), -1], [dira(ty.d / 2 + 0.25), r.vc - r.R - 1.5]], f3(0, b / 2)));
      minus.push(hranol([[sestiuhelnik(ty.s, 0.2, !kruhD), -1], [sestiuhelnik(ty.s, 0.2, !kruhD), ty.m + 0.4]], f3(0, b / 2)));
      if (b < ty.s * 1.155 + 3) o.uzkaTyc = true;
    }
    for (const d of o.diry) minus.push(...diraM(d));
    if (plus.length) telo = k(M.union([telo, ...plus]));
    if (minus.length) telo = k(M.difference([telo, ...minus]));
    // značka trubky? (ne) – díl hotový
    const nazevHl = { klip: 'Klip', rada: 'Řadová lišta', omega: 'Omega', objimka: 'Objímka – spodní díl' }[p.druh];
    dily.push({ m: telo, jmeno: 'hlavni', nazev: nazevHl, barva: '#2F5FA8', prevod: prevodProfil(b), prurez: polygony(hlavni) });
    if (druhy) {
      let hm = k(druhy.extrude(b));
      const r = o.kruhy[0], uc = o.ucho, g2 = p.objimka.mezera / 2;
      const odeb = [];
      for (const sg of [1, -1]) {
        odeb.push(hranol([[dira(uc.ro), r.vc - 1], [dira(uc.ro), r.vc + g2 + uc.heH + 1]], f3(sg * uc.uS, b / 2)));
        odeb.push(hranol([[dira(uc.rh), r.vc + g2 + uc.heH], [dira(uc.rh), r.vc + g2 + uc.heH + 30]], f3(sg * uc.uS, b / 2)));
      }
      hm = k(M.difference([hm, ...odeb]));
      dily.push({ m: hm, jmeno: 'horni', nazev: 'Objímka – horní díl', barva: '#E88A2E', prevod: prevodProfil(b), prurez: polygony(druhy) });
      // díry v uchu spodního dílu + kapsy matic zespodu ucha
      const odeb2 = [];
      for (const sg of [1, -1]) {
        odeb2.push(hranol([[dira(uc.ro), r.vc - g2 - uc.he - 1], [dira(uc.ro), r.vc + 1]], f3(sg * uc.uS, b / 2)));
        odeb2.push(hranol([[sestiuhelnik(uc.s, 0.2, !kruhD), r.vc - g2 - uc.he - 1], [sestiuhelnik(uc.s, 0.2, !kruhD), r.vc - g2 - uc.he + uc.m + 0.4]], f3(sg * uc.uS, b / 2)));
      }
      dily[0].m = k(M.difference([dily[0].m, ...odeb2]));
    }
    if (sedlo) dily.push({ m: k(sedlo.extrude(b)), jmeno: 'sedlo', nazev: 'Distanční sedlo', barva: '#E88A2E', prevod: prevodProfil(b), prurez: polygony(sedlo) });
    // okolí pro sestavu (trubky, zeď / lišta / profil) – jen náhled
    const sestava = okoliProfil(o, p);
    return { dily, sestava };
  }
  /** Obrysy průřezu (výkres): [[u, v], …] po polygonech. */
  const polygony = cs => cs.toPolygons().map(q => Array.from(q, b => [b[0], b[1]]));
  /** Rám profilu (x = u, y = v, z = w) → tisk (beze změny, posun na podložku řeší rozložení) a sestava
      (X = od zdi, Y = podél trubky se středem v 0 – řez rovinou y = 0 ukáže průřez, Z = u nahoru). */
  const prevodProfil = b => ({ sestava: (x, y, z) => [y, z - b / 2, x] });

  /** Kalibrační hřebínek: 5 úzkých klipů s vůlí −2…+2 kroky, značky (zářezy) na zadní hraně. */
  function postavKalibraci(M, CS, k, poly, kruh, obd, sjednot, seg, o, p) {
    const t = o.t, krok = p.tisk.krokKalibrace, D = p.druh === 'rada' ? o.kruhy[0].D : p.trubka.D, g = rad((360 - (p.druh === 'klip' || p.druh === 'rada' ? p.klip.obepnuti : 230)) / 2);
    const tb = 2.5, kr = [];
    let uc = 0;
    for (let i = 0; i < 5; i++) {
      const R = D / 2 + p.trubka.vule + (i - 2) * krok, Ro = R + t;
      if (i) uc += kr[i - 1].Ro + Ro + 3;
      kr.push({ R, Ro, uc, vc: tb + R, g, vule: p.trubka.vule + (i - 2) * krok });
    }
    const u0 = kr[0].uc - kr[0].Ro - 1, u1 = kr[4].uc + kr[4].Ro + 1;
    let cs = sjednot([obd(u0, u1, 0, tb), ...kr.map(r => kruh(r.Ro, r.uc, r.vc))]);
    cs = k(k(cs.offset(1.2, 'Round', 2, 24)).offset(-1.2, 'Round', 2, 24));
    const odeb = [];
    kr.forEach((r, i) => {
      odeb.push(kruh(r.R, r.uc, r.vc));
      const L = (r.Ro + 0.4) / Math.cos(r.g / 8), b2 = [[r.uc, r.vc]];   // jen přes oblouk – nesmí ukousnout souseda
      for (let j = 0; j <= 8; j++) { const a = -r.g + 2 * r.g * j / 8; b2.push([r.uc + L * Math.sin(a), r.vc + L * Math.cos(a)]); }
      odeb.push(poly(b2));
      for (let j = 0; j <= i; j++) { const x = r.uc + (j - i / 2) * 1.8; odeb.push(poly([[x - 0.6, -0.1], [x + 0.6, -0.1], [x, 0.9]])); }
    });
    cs = k(cs.subtract(sjednot(odeb)));
    const b = 8;
    return { m: k(cs.extrude(b)), jmeno: 'kalibrace', nazev: `Kalibrační hřebínek Ø ${fmt(D)} (vůle ${kr.map(r => fmt(r.vule, 2)).join(' / ')})`, barva: '#E88A2E', prevod: prevodProfil(b) };
  }

  /** Držák hadice v montážní poloze: X podél zdi, Y nahoru (sedlo od y = 0), Z od zdi. */
  function postavHadici(M, CS, k, poly, kruh, obd, hranol, o, p) {
    const dira = r => kapka(r, 24, p.diry === 'kruh');
    const r = o.hadice, h = p.hadice, z0 = r.zDesky[0], z1 = r.zDesky[1], zS = r.zSedla[1];
    const usec = R => k(kruh(R, 0, r.yc).intersect(obd(-R - 1, R + 1, 0, R + r.yc + 1)));
    const deska = k(k(M.cube([r.sirkaDesky, r.vyskaDesky, z1 - z0])).translate([-r.sirkaDesky / 2, 0, z0]));
    const plus = [deska, k(k(usec(r.Rs).extrude(zS - z1 + 0.01)).translate([0, 0, z1 - 0.01]))];
    const tlLemu = Math.max(3, r.tl);
    if (h.lem > 0) plus.push(k(k(usec(r.Rl).extrude(tlLemu + 0.02)).translate([0, 0, zS - 0.02])));
    // zámek French cleatu: profil (y nahoru, z od zdi) vytažený přes šířku desky
    if (o.cleat) {
      const zp = r.zamek.poly;   // [u (= y), v (= z)]
      plus.push(hranol([[zp, -r.sirkaDesky / 2], [zp, r.sirkaDesky / 2]], (y, z, x) => [x, y, z]));
    }
    if (o.drazka) {
      const d = o.drazka, yc = d.yOsa;
      // pero podél X na zadní straně desky, spodek (v tisku) zkosený 45°
      const pr = [[yc - d.dw / 2, z0 + 0.01], [yc + d.dw / 2, z0 + 0.01], [yc + d.dw / 2, z0 - d.hk], [yc - d.dw / 2 + d.hk, z0 - d.hk]];
      plus.push(hranol([[pr, -r.sirkaDesky / 2], [pr, r.sirkaDesky / 2]], (y, z, x) => [x, y, z]));
    }
    let telo = k(M.union(plus));
    const minus = [];
    if (r.dutina) minus.push(k(k(poly(r.dutina).extrude(Math.max(1, zS - z1 - r.tl))).translate([0, 0, z1 + 0.01])));
    const zDira0 = o.drazka ? z0 - o.drazka.hk - 1 : z0 - 1;
    for (const d of o.diry) {
      // díra podél Z, špička kapky nahoru (+Y) – v tisku je nahoru
      const f = (a, c, z) => [d.x + a, d.y + c, z];
      minus.push(hranol([[dira(d.ro), zDira0], [dira(d.ro), z1 + 0.01]], f));
      if (d.hz > 0) minus.push(hranol([[dira(d.ro), z1 - (d.rh - d.ro)], [dira(d.rh), z1], [dira(d.rh), z1 + 3]], f));
      else minus.push(hranol([[dira(d.rh), z1], [dira(d.rh), z1 + 40]], f));
    }
    if (minus.length) telo = k(M.difference([telo, ...minus]));
    const dily = [{ m: telo, jmeno: 'hlavni', nazev: 'Držák hadice', barva: '#2F5FA8', prevod: { tisk: (x, y, z) => [x, -z, y], sestava: (x, y, z) => [z, x, y] } }];
    return { dily, sestava: okoliHadice(o, p) };
  }

  /** Manifold → síť (tisk = rám profilu / převod), sestava zvlášť. */
  function sit(k, m0, jmeno, nazev, barva, prevod) {
    const m = k(m0.simplify(1e-3));
    const st = m.status();
    if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
    if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const n = vp.length / np, poz = new Float32Array(n * 3), pozS = new Float32Array(n * 3);
    const fT = prevod && prevod.tisk, fS = prevod && prevod.sestava;
    for (let i = 0, j = 0; i < vp.length; i += np, j += 3) {
      const x = vp[i], y = vp[i + 1], z = vp[i + 2];
      const a = fT ? fT(x, y, z) : [x, y, z], c = fS ? fS(x, y, z) : [x, y, z];
      poz[j] = a[0]; poz[j + 1] = a[1]; poz[j + 2] = a[2];
      pozS[j] = c[0]; pozS[j + 1] = c[1]; pozS[j + 2] = c[2];
    }
    const idx = new Uint32Array(mesh.triVerts);
    const teles = m.decompose().map(k).filter(x => x.volume() > 1e-3).length;
    // na podložku: z ≥ 0
    let zmin = Infinity; for (let i = 2; i < poz.length; i += 3) zmin = Math.min(zmin, poz[i]);
    for (let i = 2; i < poz.length; i += 3) poz[i] -= zmin;
    return { jmeno, nazev, poz, idx, pozSestava: pozS, objem: m.volume(), teles, barva, otocit: false };
  }

  /* ---------------- okolí sestavy (jen náhled) ---------------- */
  /** Kvádr jako síť (sestava). */
  function kvadr(x0, x1, y0, y1, z0, z1, nazev, barva) {
    const poz = new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]);
    const idx = new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
    return { nazev, jmeno: 'okoli', poz, idx, barva, okoli: true };
  }
  /** Válec podél X (trubka) – síť. */
  function valecX(r, x0, x1, y, z, nazev, barva, n = 40) {
    const poz = [], idx = [];
    for (const x of [x0, x1]) for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; poz.push(x, y + r * Math.cos(a), z + r * Math.sin(a)); }
    poz.push(x0, y, z, x1, y, z);
    const c0 = 2 * n, c1 = 2 * n + 1;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      idx.push(i, n + j, n + i, i, j, n + j, c0, j, i, c1, n + i, n + j);
    }
    return { nazev, jmeno: 'okoli', poz: new Float32Array(poz), idx: new Uint32Array(idx), barva, okoli: true };
  }
  /** Prstenec (závit hadice) kolem osy Y (sestava: zeď y = 0) se středem (0, yc, zc), velký poloměr Rv. */
  function prstenec(Rv, r, zc, yc, nazev, barva, n = 72, m = 16) {
    const poz = [], idx = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const a = 2 * Math.PI * i / n, b = 2 * Math.PI * j / m, R = Rv + r * Math.cos(b);
      poz.push(R * Math.cos(a), yc + r * Math.sin(b), zc + R * Math.sin(a));
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const a = i * m + j, b2 = ((i + 1) % n) * m + j, c = i * m + (j + 1) % m, d = ((i + 1) % n) * m + (j + 1) % m;
      idx.push(a, b2, c, c, b2, d);
    }
    return { nazev, jmeno: 'okoli', poz: new Float32Array(poz), idx: new Uint32Array(idx), barva, okoli: true };
  }
  const BARVA_TRUBKY = '#9AA3AD', BARVA_ZDI = '#C8C2B8', BARVA_DREVA = '#C9A66B', BARVA_HLINIKU = '#B4BCC6';
  function okoliProfil(o, p) {
    const out = [], b = o.b, L = b + 40;
    for (const r of o.kruhy) out.push(valecX(r.D / 2, -L / 2, L / 2, -r.vc, r.uc, `Trubka Ø ${fmt(r.D)}`, BARVA_TRUBKY));
    const [ua, ub] = o.uRozsah;
    if (o.cleat) {
      const z = o.zamek, sirka = b + 60;
      out.push(kvadr(-sirka / 2, sirka / 2, 0.01, 3, ua - 40, z.H + 10, 'Zeď', BARVA_ZDI));
      // lišta s úkosem: hranol – zjednodušeně kvádr pod úkosem + klín
      out.push(kvadr(-sirka / 2, sirka / 2, -z.T, 0, z.H - p.cleat.vyska, z.H - z.pokles, 'Lišta French cleat', BARVA_DREVA));
      out.push(klinCleatu(-sirka / 2, sirka / 2, z));
    } else if (o.drazka) {
      out.push(profilHlinik(o.drazka.pr, o.drazka.smer === 'napric', Math.max(o.uRozsah[1] - o.uRozsah[0] + 60, 80), o));
    } else if (p.zakl.uchyceni !== 'stah') {
      out.push(kvadr(-b / 2 - 25, b / 2 + 25, 0.01, 4, ua - 20, ub + 20, 'Zeď', BARVA_ZDI));
    } else {
      // sloupek, kolem kterého je páska
      out.push(valecX(12, -b / 2 - 30, b / 2 + 30, 12.5, 0, 'Sloupek', BARVA_HLINIKU));
    }
    void p;
    return out;
  }
  /** Klín úkosu lišty (sestava): mezi líc lišty a zeď, vršek H na líci, H − pokles u zdi. */
  function klinCleatu(x0, x1, z) {
    const yL = -z.T, poz = new Float32Array([x0, yL, z.H - z.pokles, x1, yL, z.H - z.pokles, x1, 0, z.H - z.pokles, x0, 0, z.H - z.pokles, x0, yL, z.H, x1, yL, z.H]);
    const idx = new Uint32Array([0, 2, 1, 0, 3, 2, 0, 1, 5, 0, 5, 4, 3, 4, 5, 3, 5, 2, 0, 4, 3, 1, 2, 5]);
    return { nazev: 'Úkos lišty', jmeno: 'okoli', poz, idx, barva: BARVA_DREVA, okoli: true };
  }
  /** Hliníkový profil za základnou (zjednodušeně: dva boky drážky a dno) – sestava. */
  function profilHlinik(pr, napric, dl, o) {
    const a = pr.a, dw = pr.drazka / 2, poz = [], idx = [];
    const pridej = s => { const n0 = poz.length / 3; poz.push(...s.poz); for (const i of s.idx) idx.push(i + n0); };
    if (napric) {
      const xh = (o.diry.length ? o.diry[0].w : o.b / 2) - o.b / 2;
      pridej(kvadr(xh - a / 2, xh - dw, 0.01, a, -dl / 2, dl / 2)); pridej(kvadr(xh + dw, xh + a / 2, 0.01, a, -dl / 2, dl / 2));
      pridej(kvadr(xh - dw, xh + dw, pr.hloubka, a, -dl / 2, dl / 2));
    } else {
      pridej(kvadr(-dl / 2, dl / 2, 0.01, a, -a / 2, -dw)); pridej(kvadr(-dl / 2, dl / 2, 0.01, a, dw, a / 2));
      pridej(kvadr(-dl / 2, dl / 2, pr.hloubka, a, -dw, dw));
    }
    return { nazev: 'Hliníkový profil', jmeno: 'okoli', poz: new Float32Array(poz), idx: new Uint32Array(idx), barva: BARVA_HLINIKU, okoli: true };
  }
  function okoliHadice(o, p) {
    const r = o.hadice, out = [], D = p.trubka.D, z = r.zSedla;
    for (let i = 0; i < p.hadice.zavitu; i++) out.push(prstenec(r.Rs + D / 2, D / 2 * 0.98, r.yc, -(z[0] + D * 1.08 * (i + 0.5) + 1), `Závit hadice ${i + 1}`, '#3E9B5A'));
    const W = r.sirkaDesky + 60;
    if (o.cleat) {
      const zm = r.zamek;
      out.push(kvadr(-W / 2, W / 2, 0.01, 3, -2 * r.Rs, zm.H + 30, 'Zeď', BARVA_ZDI));
      out.push(kvadr(-W / 2, W / 2, -zm.T, 0, zm.H - p.cleat.vyska, zm.H - zm.pokles, 'Lišta French cleat', BARVA_DREVA));
      out.push(klinCleatu(-W / 2, W / 2, zm));
    } else out.push(kvadr(-W / 2, W / 2, 0.01, 4, -2 * r.Rs, r.vyskaDesky + 30, 'Zeď', BARVA_ZDI));
    return out;
  }

  /* ---------------- kontroly modelu ---------------- */
  function kontrolyModelu(p, model) {
    const H = [];
    for (const d of model.dily.concat(model.kalibrace)) {
      if (d.teles > 1) H.push({ uroven: 'chyba', pole: null, text: `${d.nazev}: díl se rozpadl na ${d.teles} tělesa – některá část není spojená.` });
      const r = G.rozborTisku(d, p.tisk.uhel);
      if (r.previs > 3) H.push({ uroven: 'varovani', pole: ['tisk.uhel'], text: `${d.nazev}: převisy nad ${fmt(p.tisk.uhel)}° od svislice ${fmt(r.previs, 0)} mm² – v místě převisu může potřebovat podpory.` });
      if (r.most > 1) H.push({ uroven: 'info', pole: null, text: `${d.nazev}: tiskárna přemostí ${fmt(r.most, 0)} mm² vodorovného stropu (tunel, kapsa matice).` });
    }
    return H;
  }

  /* ---------------- projekt ---------------- */
  function popis(p) {
    const d = p.druh === 'rada' ? `řada Ø ${prumeryRady(p.rada.prumery).map(x => fmt(x)).join(' + ')}` : `${NAZVY.druh[p.druh]} Ø ${fmt(p.trubka.D)}`;
    return `${d} · ${NAZVY.uchyceni[p.zakl.uchyceni]} · ${MATERIALY[p.tisk.material].nazev}`;
  }
  const TYP = 'prichytky_trubek';
  const ulozProjekt = p => G.projektJson(TYP, p, 1);
  const nactiProjekt = text => G.nactiProjektJson(text, TYP, normalizuj, 'Příchytky trubek');

  const API = {
    MATERIALY, PODKLADY, PASKY, TMATICE, NAZVY, POVOLENA, VYCHOZI, MEZE, VYCTY, PREDVOLBY, NAPRIC_VRSTVAMI,
    normalizuj, predvolba, prumeryRady, odvozene, mechanika, sroubUchyceni, mechKlipu, silyKlipu, obepnutiProEps, zatezNaKus, kontroly, postav, kontrolyModelu,
    kapka, uvnitr, popis, ulozProjekt, nactiProjekt, kopie, vezmi: G.vezmi, poloz: G.poloz, fmt, VRUTY: CL.VRUTY, PROFILY: SP.PROFILY,
  };
  if (uzel) module.exports = API; else window.PRICH = API;
})();

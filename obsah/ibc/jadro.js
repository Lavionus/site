/* Napojení hadic na IBC kontejnery – jádro bez DOM (běží i v node).
   Tabulky závitů (IBC hrubé S60×6 / S75×6 / víko DN150, trubkové G dle ISO 228), parametry a meze,
   předvolby, odvozené rozměry (profily rotačních těles v rovině r–z, závitové tyče, úchop, otvory),
   kontroly zadání, rozbor tisku, kusovník (těsnění, spony, páska), projekt JSON.
   Obecný rozbor tisku (převisy, tisková poloha, rotace) přebírá ze spojky/jadro.js (SPOJKY).
   Geometrii skládá ibc/geometrie.js přes manifold-3d. */
(function () {
  'use strict';
  const S = typeof module !== 'undefined' ? require('../spojky/jadro.js') : window.SPOJKY;
  const { kopie, cislo, fmt, vezmi, poloz, V } = S;
  const VERZE_FORMATU = 1;
  const DATUM_DAT = '29. 10. 2026';
  const OVERIT = 'typické – ověřit posuvkou / závitovou měrkou';

  /* ---------- tabulky ---------- */
  // d = vnější (jmenovitý) průměr vnějšího závitu, p = stoupání, h = radiální hloubka, bok = úhel boku od kolmice k ose (°)
  const G = (nazev, d, tpi) => ({ nazev, d, p: 25.4 / tpi, h: 0.640327 * 25.4 / tpi, bok: 27.5, skupina: 'G', pozn: `ISO 228-1, ${tpi} chodů na palec; ${OVERIT}` });
  const ZAVITY = {
    S60: { nazev: 'S60×6 – výpust ventilu DN50 (IBC)', d: 60, p: 6, h: 2.5, bok: 30, skupina: 'IBC',
      pozn: `nejběžnější výpust IBC (vnější závit na ventilu, Ø ≈ 60, jádro ≈ 55 mm); ${OVERIT}` },
    S75: { nazev: 'S75×6 – výpust DN65/80 (IBC)', d: 75, p: 6, h: 2.5, bok: 30, skupina: 'IBC', pozn: `méně častá větší výpust; ${OVERIT}` },
    DN150: { nazev: 'DN150 – hrdlo plnicího otvoru (víko)', d: 160, p: 6, h: 3, bok: 30, skupina: 'IBC',
      pozn: `hrubý závit hrdla, u výrobců se liší (Ø 150–165, stoupání 6–8) – ${OVERIT}, nebo zvolte vlastní` },
    'G1/2': G('G 1/2″', 20.955, 14), 'G3/4': G('G 3/4″', 26.441, 14), G1: G('G 1″', 33.249, 11),
    'G5/4': G('G 1 1/4″', 41.910, 11), 'G3/2': G('G 1 1/2″', 47.803, 11), G2: G('G 2″', 59.614, 11),
    vlastni: { nazev: 'vlastní závit', skupina: 'vlastni', pozn: 'změřte vnější průměr, stoupání (měrka nebo délka 10 chodů / 10) a hloubku' },
  };
  // vnitřní průměry hadic (rychlá volba)
  const HADICE = [['1/2″', 12.7], ['5/8″', 15.9], ['3/4″', 19], ['1″', 25.4], ['5/4″ (32 mm)', 32], ['6/4″ (38 mm)', 38], ['2″ (50 mm)', 50]];
  const TRUBKY_PVC = [25, 32, 40, 50, 63];
  // šnekové hadicové spony – rozsahy v mm
  const SPONY = [[8, 12], [10, 16], [12, 22], [16, 25], [20, 32], [25, 40], [32, 50], [40, 60], [50, 70], [60, 80]];
  const MATERIALY = {
    PETG: { nazev: 'PETG', hustota: 1.27, pozn: 'doporučeno: houževnaté, vodotěsné při 100 % obvodech, snese vodu i mráz; na přímém slunci časem křehne' },
    ASA: { nazev: 'ASA', hustota: 1.07, pozn: 'nejlepší na slunce (UV); tiskne se v uzavřené tiskárně' },
    ABS: { nazev: 'ABS', hustota: 1.04, pozn: 'odolné teplu, na slunci žloutne a křehne – venku raději ASA' },
    PP: { nazev: 'PP', hustota: 0.9, pozn: 'chemicky nejodolnější (stejný materiál jako nádrž IBC), ale těžko tisknutelné – kroutí se, nedrží na podložce' },
    PA: { nazev: 'PA (nylon)', hustota: 1.14, pozn: 'houževnaté, ale nasává vodu a bobtná – závity se mohou zadřít' },
    PLA: { nazev: 'PLA', hustota: 1.24, pozn: 'nevhodné ven: na slunci měkne (≈ 55 °C) a ve vlhku degraduje' },
  };
  const DRUHY = { adapter: 'Adaptér výpusti', redukce: 'Redukce závit ↔ závit', zaslepka: 'Záslepka / víčko', pruchodka: 'Průchodka víkem / stěnou', vicko: 'Náhradní víko DN150' };
  const VYSTUPY = { trn: 'Hadicový trn', zavit: 'Závit (G / IBC)', hrdlo: 'Hrdlo na lepení PVC', gardena: 'Rychlospojka typu Gardena (samec)' };
  const KONCE_PRUCHODKY = { hladky: 'Hladký průchod (hadice / kabel skrz)', trn: 'Hadicový trn venku', zavit: 'Vnější závit G venku' };
  const UCHOPY = { sestihran: 'Šestihran na klíč', zebra: 'Žebra pro ruku', hladky: 'Hladký' };
  const TESNENI = { plocha: 'Plochá těsnicí podložka', oring: 'O-kroužek v drážce', zadne: 'Bez těsnění' };

  const VYCHOZI = {
    nazev: 'Adaptér IBC',
    druh: 'adapter',
    vstup: { zavit: 'S60', pohlavi: 'samice', zasroub: 20 },
    vystup: { typ: 'trn', zavit: 'G3/4', pohlavi: 'samec', zasroub: 14, hadice: 19, presah: 10, zubu: 4, trubka: 32, hloubkaHrdla: 0 },
    telo: { uchop: 'sestihran', vyskaUchopu: 8, stena: 3, tesneni: 'plocha', tlTesneni: 2, prutok: 0 },
    zaslepka: { odvzdusneni: 0, retizek: true, dno: 4 },
    pruchodka: { otvor: 25, tloustka: 4, pruchod: 16, priruba: 8, tlPriruby: 4, konec: 'hladky', hadice: 12.7 },
    vicko: { zavit: 'DN150', vyska: 18, dno: 4, vstupu: 2, typVstupu: 'otvor', prumer: 25, roztec: 45, prepad: 32, odvzdusneni: 3 },
    vlastni: { d: 60, p: 6, h: 2.5, bok: 30 },
    zavit: { vule: 0.4, nabeh: true },
    tisk: { material: 'PETG', vypln: 40, previs: 45, most: 25, orientace: 'auto', kusu: 1 },
  };

  // [min, max] – mimo rozsah se hodnota omezí a uživatel dostane hlášení
  const ROZSAHY = {
    'vstup.zasroub': [3, 80], 'vystup.zasroub': [3, 80], 'vystup.hadice': [4, 76], 'vystup.presah': [0, 30], 'vystup.zubu': [1, 8],
    'vystup.trubka': [10, 110], 'vystup.hloubkaHrdla': [0, 120],
    'telo.vyskaUchopu': [0, 60], 'telo.stena': [1, 12], 'telo.tlTesneni': [0.5, 6], 'telo.prutok': [0, 100],
    'zaslepka.odvzdusneni': [0, 10], 'zaslepka.dno': [1.2, 15],
    'pruchodka.otvor': [10, 110], 'pruchodka.tloustka': [0.5, 30], 'pruchodka.pruchod': [2, 90], 'pruchodka.priruba': [3, 40],
    'pruchodka.tlPriruby': [2, 15], 'pruchodka.hadice': [4, 60],
    'vicko.vyska': [6, 50], 'vicko.dno': [2, 12], 'vicko.vstupu': [0, 3], 'vicko.prumer': [3, 80], 'vicko.roztec': [0, 120],
    'vicko.prepad': [0, 80], 'vicko.odvzdusneni': [0, 10],
    'vlastni.d': [8, 250], 'vlastni.p': [0.5, 12], 'vlastni.h': [0.2, 8], 'vlastni.bok': [5, 45],
    'zavit.vule': [0, 1.5],
    'tisk.vypln': [0, 100], 'tisk.previs': [20, 70], 'tisk.most': [0, 100], 'tisk.kusu': [1, 30],
  };

  const PREDVOLBY = [
    { nazev: 'IBC S60×6 → hadice 3/4″', popis: 'trn se 4 zuby pro zahradní hadici 19 mm, šestihran',
      p: { druh: 'adapter', vstup: { zavit: 'S60', pohlavi: 'samice' }, vystup: { typ: 'trn', hadice: 19, zubu: 4, presah: 10 } } },
    { nazev: 'IBC S60×6 → hadice 1″', popis: 'trn pro hadici 25 mm, 4 zuby',
      p: { druh: 'adapter', vstup: { zavit: 'S60', pohlavi: 'samice' }, vystup: { typ: 'trn', hadice: 25.4, zubu: 4, presah: 10 } } },
    { nazev: 'IBC S60×6 → hadice 1/2″', popis: 'trn pro hadici 13 mm, žebra pro ruku',
      p: { druh: 'adapter', vstup: { zavit: 'S60', pohlavi: 'samice' }, vystup: { typ: 'trn', hadice: 12.7, zubu: 4, presah: 12 }, telo: { uchop: 'zebra' } } },
    { nazev: 'IBC S60×6 → G 3/4″ vnější (Gardena)', popis: 'na kupovanou rychlospojku s vnitřním závitem 3/4″',
      p: { druh: 'adapter', vstup: { zavit: 'S60', pohlavi: 'samice' }, vystup: { typ: 'zavit', zavit: 'G3/4', pohlavi: 'samec', zasroub: 14 } } },
    { nazev: 'Záslepka S60×6', popis: 'plné dno, ucho na řetízek, plochá podložka',
      p: { druh: 'zaslepka', vstup: { zavit: 'S60', pohlavi: 'samice', zasroub: 18 }, telo: { uchop: 'zebra' }, zaslepka: { retizek: true, odvzdusneni: 0, dno: 4 } } },
    { nazev: 'Redukce S60×6 ↔ S75×6', popis: 'ventil S75 → příslušenství S60 (samice → samec)',
      p: { druh: 'redukce', vstup: { zavit: 'S75', pohlavi: 'samice', zasroub: 20 }, vystup: { typ: 'zavit', zavit: 'S60', pohlavi: 'samec', zasroub: 20 } } },
    { nazev: 'Průchodka víkem pro hadici 16 mm', popis: 'otvor Ø 25 ve víku, hadice / PE trubka 16 mm prochází skrz, matice zvlášť',
      p: { druh: 'pruchodka', pruchodka: { otvor: 25, tloustka: 4, pruchod: 16, priruba: 8, tlPriruby: 4, konec: 'hladky' }, telo: { tesneni: 'oring' } } },
    { nazev: 'Náhradní víko DN150 s přepadem', popis: '2 otvory Ø 25 pro průchodky + přepad Ø 32, odvzdušnění',
      p: { druh: 'vicko', vicko: { zavit: 'DN150', vyska: 18, dno: 4, vstupu: 2, typVstupu: 'otvor', prumer: 25, roztec: 45, prepad: 32, odvzdusneni: 3 }, telo: { uchop: 'zebra' } } },
  ];

  /* ---------- drobnosti ---------- */
  const sl = (o, z) => { for (const k of Object.keys(z)) if (z[k] && typeof z[k] === 'object' && !Array.isArray(z[k]) && o[k] && typeof o[k] === 'object') sl(o[k], z[k]); else o[k] = z[k]; return o; };
  const vyber = (h, obj, vych) => (Object.prototype.hasOwnProperty.call(obj, h) ? h : vych);

  /** Doplní chybějící hodnoty, omezí rozsahy. Vrací {p, hlaseni: [texty o úpravách]}. */
  function normalizuj(vstup) {
    const p = kopie(VYCHOZI), hl = [];
    if (vstup && typeof vstup === 'object') sl(p, kopie(vstup));
    p.druh = vyber(p.druh, DRUHY, 'adapter');
    p.vstup.zavit = vyber(p.vstup.zavit, ZAVITY, 'S60');
    p.vystup.zavit = vyber(p.vystup.zavit, ZAVITY, 'G3/4');
    p.vicko.zavit = vyber(p.vicko.zavit, ZAVITY, 'DN150');
    for (const k of ['vstup', 'vystup']) if (!['samec', 'samice'].includes(p[k].pohlavi)) p[k].pohlavi = 'samice';
    p.vystup.typ = vyber(p.vystup.typ, VYSTUPY, 'trn');
    if (p.druh === 'redukce') p.vystup.typ = 'zavit';
    p.pruchodka.konec = vyber(p.pruchodka.konec, KONCE_PRUCHODKY, 'hladky');
    p.vicko.typVstupu = p.vicko.typVstupu === 'trn' ? 'trn' : 'otvor';
    p.telo.uchop = vyber(p.telo.uchop, UCHOPY, 'sestihran');
    p.telo.tesneni = vyber(p.telo.tesneni, TESNENI, 'plocha');
    p.tisk.material = vyber(p.tisk.material, MATERIALY, 'PETG');
    p.nazev = String(p.nazev == null ? '' : p.nazev).slice(0, 120);
    p.tisk.orientace = String(p.tisk.orientace || 'auto').slice(0, 20);
    p.zaslepka.retizek = !!p.zaslepka.retizek; p.zavit.nabeh = !!p.zavit.nabeh;
    for (const [c, [mn, mx]] of Object.entries(ROZSAHY)) {
      let h = cislo(vezmi(p, c), vezmi(VYCHOZI, c));
      if (h < mn || h > mx) { const o = Math.min(mx, Math.max(mn, h)); hl.push(`${c} ${fmt(h, 2)} → ${fmt(o, 2)}`); h = o; }
      poloz(p, c, h);
    }
    for (const c of ['vystup.zubu', 'vicko.vstupu', 'tisk.kusu']) poloz(p, c, Math.round(vezmi(p, c)));
    return { p, hlaseni: hl };
  }
  function zPredvolby(i) {
    const v = PREDVOLBY[i], p = normalizuj({}).p;
    sl(p, kopie(v.p));
    p.nazev = v.nazev;
    return normalizuj(p).p;
  }

  /** Údaje závitu podle klíče tabulky (vlastní bere p.vlastni). */
  function udajeZavitu(p, klic) {
    if (klic === 'vlastni') {
      const v = p.vlastni;
      return { klic, nazev: `vlastní Ø ${fmt(v.d)} × ${fmt(v.p)}`, d: v.d, p: v.p, h: Math.min(v.h, 0.3 * v.d), bok: v.bok, skupina: 'vlastni', pozn: ZAVITY.vlastni.pozn };
    }
    return Object.assign({ klic }, ZAVITY[klic]);
  }
  /** Tiskový závit průchodky (dřík i matice tiskneme – profil 30°, hrubé stoupání). */
  function zavitPruchodky(otvor) {
    const d = Math.round((otvor - 0.6) * 10) / 10, p = d <= 20 ? 2 : d <= 45 ? 3 : 4;
    return { klic: 'tiskovy', nazev: `tiskový závit Ø ${fmt(d)} × ${fmt(p)}`, d, p, h: 0.54 * p, bok: 30, skupina: 'tisk', pozn: 'oba díly tisknete – závit je jen pro ně' };
  }
  /** Počet segmentů kruhu závitu a rotačních těles (≈ 1,2 mm na obvodu, 72–180). */
  const segZ = r => Math.max(72, Math.min(180, Math.ceil(2 * Math.PI * r / 1.2 / 4) * 4));
  const SKLON = 1.15;     // výška kužele / rozdíl poloměrů: povrch ≈ 41° od svislice (bez podpor v obou polohách)

  // vnitřní závitové tyče začínají v −0,937 (ne −1): rovina řezu tyče nesmí padnout na čelo dílu (rovinné nulové trojúhelníky)
  /* ---------- konce (místní souřadnice: volné čelo z = 0, napojení na tělo z = L) ---------- */
  // vnejsi / vnitrni = body [r, z] vzestupně podle z; tyce = závitové tyče (+ přidat, − odebrat)
  function konecSamice(z, c, uzavreny) {
    const v = c.vule, rMaj = z.d / 2 + v / 2, rMin = rMaj - z.h, rs = rMin - 0.3;   // válec dutiny leží uvnitř jádra závitové tyče – nekříží se s boky závitu (jinak splývající vrcholy)
    const rch = c.nabeh ? rMaj + 0.4 : rs;
    const tl = c.tesneni === 'plocha' ? c.tlTesneni : 0, Lz = c.zasroub + tl;
    const ws = Math.min(6, Math.max(3, 0.12 * z.d));
    let rSeat = rs - ws, dr = null;
    if (c.tesneni === 'oring') {
      const s = z.d > 40 ? 3 : 2, w = 1.4 * s, hl = 0.75 * s, ro = rs - 0.8;
      dr = { snura: s, ro, ri: ro - w, hl };
      rSeat = Math.min(rSeat, dr.ri - 0.8);
    }
    const R = rMaj + c.stena;
    const vnitrni = [];
    if (rch > rs) vnitrni.push([rch, -1], [rch, 0], [rs, 1.2 * (rch - rs)]); else vnitrni.push([rs, -1]);
    vnitrni.push([rs, Lz]);
    if (dr) vnitrni.push([dr.ro, Lz], [dr.ro, Lz + dr.hl], [dr.ri, Lz + dr.hl], [dr.ri, Lz]);
    vnitrni.push([rSeat, Lz]);
    let L;
    if (uzavreny) {
      L = Lz + (dr ? dr.hl : 0) + c.dno;
      vnitrni.push([0, Lz]);
    } else {
      const rb = Math.min(c.rb, rSeat - 0.3), hk = SKLON * (rSeat - rb);
      L = Math.max(Lz + hk, Lz + (dr ? dr.hl : 0)) + 1.5;
      vnitrni.push([rb, Lz + hk], [rb, L]);
    }
    const tesneni = c.tesneni === 'plocha' ? { typ: 'plocha', OD: Math.floor((2 * rs - 0.4) * 2) / 2, ID: Math.ceil(2 * rSeat * 2) / 2, t: tl }
      : dr ? { typ: 'oring', ID: Math.round(2 * dr.ri * 2) / 2, snura: dr.snura, drazka: dr } : null;
    return { typ: 'samice', zavit: z, L, rJ: R, rMax: R, rbNat: rSeat - 0.5, vnejsi: [[R, 0], [R, L]], vnitrni,
      tyce: [{ znam: -1, rMaj, h: z.h, p: z.p, bok: z.bok, z0: -0.937, z1: Lz - 0.3, srazit: null }],
      rMaj, rMin, rs, rSeat, Lz, tl, tesneni, stenaZavit: R - rMaj, sirkaSedla: rs - rSeat, zasroub: c.zasroub,
      duchove: z.skupina === 'IBC' ? [{ typ: 'valec', r: z.d / 2, ri: z.d / 2 - 5, z0: -40, z1: Lz - tl, popis: 'hrdlo ventilu' }] : [] };
  }
  function konecSamec(z, c) {
    const v = c.vule, rMaj = z.d / 2 - v / 2, rCore = rMaj - z.h, Lz = c.zasroub;
    const ch = c.nabeh ? Math.min(1.2 * z.h, Lz / 3) : 0, rJ = rCore - 0.12;
    const vnejsi = [];
    if (c.nabeh) {
      const r0 = Math.max(Math.min(c.rb, rCore - 1) + 0.8, rMaj - ch - 0.1);
      vnejsi.push([r0, 0]); if (r0 < rJ) vnejsi.push([rJ, (rJ - r0) * 1.2]);
    } else vnejsi.push([rJ, 0]);
    vnejsi.push([rJ, Lz]);
    return { typ: 'samec', zavit: z, L: Lz, rJ, rMax: rMaj, rbNat: rCore - c.stena, vnejsi, vnitrni: [[c.rb, -1], [c.rb, Lz]],
      tyce: [{ znam: 1, rMaj, h: z.h, p: z.p, bok: z.bok, z0: 0, z1: Lz + 0.6, srazit: c.nabeh ? 'dole' : null, ch }],
      rMaj, rCore, Lz, stenaZavit: rCore - c.rb, zasroub: Lz, duchove: [] };
  }
  function konecTrn(c, ID, presah, zubu) {
    const rmin = ID / 2, rmax = rmin * (1 + presah / 100), Lt = Math.max(3.5, 0.3 * ID);
    const st = Math.max(2, Math.min(c.stena, 0.14 * ID + 0.4)), rbNat = rmin - st;
    const rtip = Math.max(Math.min(c.rb, rbNat) + 0.8, rmin - Math.min(1, 0.3 * st));
    const vnejsi = [[rtip, 0]];
    for (let i = 0; i < zubu; i++) {
      const z0 = i * Lt;
      if (i) vnejsi.push([rmin, z0]);
      vnejsi.push([rmax, z0 + 0.8 * Lt]);
    }
    const L = zubu * Lt + 0.6 * Lt + 1;
    vnejsi.push([rmin, zubu * Lt], [rmin, L]);
    const stenaH = Math.max(2.5, 0.18 * ID), OD = ID + 2 * stenaH;
    return { typ: 'trn', L, rJ: rmin, rMax: rmax, rbNat, vnejsi, vnitrni: [[c.rb, -1], [c.rb, L]], tyce: [], ID, rmin, rmax, Lt, delkaTrnu: L,
      presah, stenaTrnu: rmin - c.rb, hadiceOD: OD,
      duchove: [{ typ: 'valec', r: OD / 2, ri: ID / 2, z0: -40, z1: zubu * Lt * 0.95, popis: 'hadice' }] };
  }
  function konecHrdlo(c, D, hloubka) {
    const rIn = D / 2 + 0.15, Lh = hloubka > 0 ? hloubka : Math.ceil(0.5 * D + 6), R = rIn + c.stena;
    const rbNat = Math.min(D / 2 - 2.4, rIn - 2.5), rb = Math.min(c.rb, rbNat), hk = SKLON * (rIn - rb), L = Lh + hk + 1.5;
    return { typ: 'hrdlo', L, rJ: R, rMax: R, rbNat, vnejsi: [[R, 0], [R, L]],
      vnitrni: [[rIn + 0.6, -1], [rIn + 0.6, 0], [rIn, 0.6], [rIn, Lh], [rb, Lh + hk], [rb, L]], tyce: [], D, Lh, rIn, stenaHrdla: c.stena,
      duchove: [{ typ: 'valec', r: D / 2, ri: D / 2 - 2.4, z0: -40, z1: Lh, popis: 'trubka PVC' }] };
  }
  // zjednodušený samec rychlospojky typu Gardena (rozměry orientační – originál je přesnější)
  const GARDENA = { nos: 7.8, drazkaOR: 5.8, zuzeni: 6.5, limec: 9.8, oring: [11, 2.5] };
  function konecGardena(c) {
    const g = GARDENA, rb = Math.min(c.rb, 4.5), z1 = 12 + SKLON * (g.limec - g.zuzeni);
    const vnejsi = [[g.nos - 0.6, 0], [g.nos, 0.6], [g.nos, 2.5], [g.drazkaOR, 2.5], [g.drazkaOR, 4.8], [g.nos, 4.8 + SKLON * (g.nos - g.drazkaOR)],
      [g.nos, 9], [g.zuzeni, 9], [g.zuzeni, 12], [g.limec, z1], [g.limec, z1 + 4]];
    const L = z1 + 4;
    return { typ: 'gardena', L, rJ: g.limec, rMax: g.limec, rbNat: 4.5, vnejsi, vnitrni: [[rb, -1], [rb, L]], tyce: [], duchove: [] };
  }

  /** Kontext pro stavbu konců: vůle, náběh, stěna, těsnění… */
  function kontext(p, kde, rb) {
    return { vule: p.zavit.vule, nabeh: p.zavit.nabeh, stena: p.telo.stena, tesneni: p.telo.tesneni, tlTesneni: p.telo.tlTesneni,
      zasroub: kde === 'vstup' ? p.vstup.zasroub : p.vystup.zasroub, dno: p.zaslepka.dno, rb };
  }
  function postavKonec(p, kde, rb, uzavreny) {
    const c = kontext(p, kde, rb);
    if (kde === 'vstup') {
      const z = udajeZavitu(p, p.vstup.zavit);
      return p.vstup.pohlavi === 'samice' || uzavreny ? konecSamice(z, c, uzavreny) : konecSamec(z, c);
    }
    const q = p.vystup;
    if (q.typ === 'trn') return konecTrn(c, q.hadice, q.presah, q.zubu);
    if (q.typ === 'hrdlo') return konecHrdlo(c, q.trubka, q.hloubkaHrdla);
    if (q.typ === 'gardena') return konecGardena(c);
    const z = udajeZavitu(p, q.zavit);
    return q.pohlavi === 'samice' ? konecSamice(z, c, false) : konecSamec(z, c);
  }

  /* ---------- sestavy ---------- */
  const zrcadli = (body, zTop) => body.slice().reverse().map(([r, z]) => [r, zTop - z]);
  function bezDuplicit(body) {
    const out = [];
    for (const b of body) { const l = out[out.length - 1]; if (!l || Math.abs(l[0] - b[0]) > 1e-6 || Math.abs(l[1] - b[1]) > 1e-6) out.push(b); }
    // prostřední z kolineární trojice pryč (i zpětný krok po téže přímce)
    for (let i = out.length - 2; i > 0; i--) {
      const [a, b, c] = [out[i - 1], out[i], out[i + 1]];
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 1e-9) out.splice(i, 1);
    }
    return out;
  }
  /** Úchop (šestihran / žebra) kolem válce Rk v pásmu z0..z1 se sraženými konci. */
  function uchop(p, Rk, z0, z1) {
    const t = p.telo.uchop;
    if (t === 'hladky') return null;
    if (t === 'sestihran') {
      const S = Math.ceil(2 * (Rk + 0.3)), Rv = S / Math.sqrt(3);
      return { typ: 'sestihran', S, Rv, Rk, z0, z1, hch: SKLON * (Rv - Rk + 0.4) };
    }
    const hr = Math.max(1.2, Math.min(2.5, 0.05 * Rk + 0.6)), Rv = Rk + hr;
    return { typ: 'zebra', hr, Rv, Rk, z0, z1, n: Math.max(8, Math.round(2 * Math.PI * Rk / 9)), sirka: Math.max(2, Math.min(4, 0.08 * Rk + 1)), hch: SKLON * (Rv - Rk + 0.4) };
  }

  /** Adaptér, redukce, záslepka: konec A dole, límec s úchopem, konec B nahoře. */
  function sestavaOsova(p) {
    const zaslepka = p.druh === 'zaslepka';
    // 1. přirozené vnitřní průměry → nejužší průchod
    const a0 = postavKonec(p, 'vstup', 1e3, zaslepka), b0 = zaslepka ? null : postavKonec(p, 'vystup', 1e3);
    let rb = Math.min(a0.rbNat, b0 ? b0.rbNat : Infinity);
    if (p.telo.prutok > 0) rb = Math.min(rb, p.telo.prutok / 2);
    rb = Math.max(1, rb);
    const A = postavKonec(p, 'vstup', rb, zaslepka), B = zaslepka ? null : postavKonec(p, 'vystup', rb);
    // 2. límec
    const samA = A.typ === 'samice';
    let Rk = Math.max(A.typ === 'samec' ? A.rMax + 1.5 : A.rJ, rb + p.telo.stena + 1);
    if (B) Rk = Math.max(Rk, B.typ === 'samec' ? B.rMax + 1.5 : B.rJ);
    Rk = Math.round(Rk * 10) / 10;
    const vnejsiA = samA ? [[Rk, 0], [Rk, A.L]] : A.vnejsi;
    // u objímky se závitem začne kužel pláště tak, aby stěna nad vnitřním kuželem zůstala ≥ stěna (kolmo)
    const h1 = samA ? 0 : SKLON * (Rk - A.rJ);
    const zc0 = samA ? (zaslepka ? A.L : Math.max(A.Lz + (A.tesneni && A.tesneni.drazka ? A.tesneni.drazka.hl : 0) + 2,
      A.Lz + SKLON * (Rk - A.rSeat - p.telo.stena / 0.75))) : A.L + h1;
    const u0 = uchop(p, Rk, 0, 0), potreba = u0 ? 2 * u0.hch + 4.5 : 0;
    const zg0 = samA ? 0 : zc0;
    let Lc = zaslepka || samA ? 0 : p.telo.vyskaUchopu;
    if (u0 && zc0 + Lc - zg0 < potreba) Lc = potreba - (zc0 - zg0);
    const zc1 = zc0 + Lc;
    const h2 = B ? SKLON * (Rk - B.rJ) : 0;
    // konec B s proměnným vnitřkem (objímka, hrdlo) nesmí zasáhnout do vnitřního kužele A
    let zB0 = zc1 + h2;
    if (B && (B.typ === 'samice' || B.typ === 'hrdlo') && zB0 < A.L) { zc1 += A.L - zB0; zB0 = A.L; }
    const zTop = B ? zB0 + B.L : zc1;
    // 3. profily
    const vnejsi = [[0, 0], ...(samA ? [[Rk, 0]] : vnejsiA), [Rk, zc0], [Rk, zc1]];
    if (B) vnejsi.push(...zrcadli(B.vnejsi, zTop));
    vnejsi.push([0, zTop]);
    const vnitrni = [[0, -1], ...A.vnitrni];
    if (B) vnitrni.push([rb, zB0], ...zrcadli(B.vnitrni, zTop), [0, zTop + 1]);
    else if (!zaslepka) vnitrni.push([rb, zTop + 1], [0, zTop + 1]);
    const tyce = A.tyce.slice();
    if (B) for (const t of B.tyce) tyce.push(Object.assign({}, t, { otocit: true, zTop }));
    const duchove = A.duchove.slice();
    if (B) for (const d of B.duchove) duchove.push(Object.assign({}, d, { z0: zTop - d.z1, z1: zTop - d.z0 }));
    const u = u0 ? Object.assign(u0, { z0: zg0, z1: zaslepka ? zTop : zc1 }) : null;
    const extra = [];
    if (zaslepka) {
      if (p.zaslepka.odvzdusneni > 0) extra.push({ typ: 'dira', r: p.zaslepka.odvzdusneni / 2, x: 0, y: 0, z0: A.Lz - 1, z1: zTop + 1 });
      if (p.zaslepka.retizek) {
        const Rv = u ? u.Rv : Rk, x1 = Rv + 9;
        extra.push({ typ: 'ucho', x0: Rk - 2, x1, sirka: 8, z0: zTop - 4, z1: zTop, dira: { r: 2.25, x: x1 - 4.5 } });
      }
    }
    if (zaslepka) rb = p.zaslepka.odvzdusneni / 2;    // průchod jen odvzdušněním
    return { druh: p.druh, A, B, rb, Rk, uchop: u, vnejsi: bezDuplicit(vnejsi), vnitrni: bezDuplicit(vnitrni), tyce, duchove, extra,
      vyska: zTop, zc0, zc1, Lc, seg: segZ(Math.max(Rk, u ? u.Rv : 0)) };
  }

  /** Průchodka: dřík s přírubou a závitem, volitelně konec venku; matice jako druhý díl vedle. */
  function sestavaPruchodky(p) {
    const q = p.pruchodka, v = p.zavit.vule, z = zavitPruchodky(q.otvor);
    const rMaj = z.d / 2 - v / 4, rCore = rMaj - z.h, rMajF = z.d / 2 + v / 4, rMinF = rMajF - z.h;
    const tl = p.telo.tesneni === 'plocha' ? p.telo.tlTesneni : 0, tp = q.tlPriruby, Rf = q.otvor / 2 + q.priruba;
    const Hm = Math.max(8, Math.ceil(3 * z.p + 2)), Lt = q.tloustka + tl + Hm + 2;
    let B = null, rb;
    if (q.konec === 'hladky') rb = q.pruchod / 2 + 0.2;
    else {
      const c = kontext(p, 'vystup', 1e3);
      const b0 = q.konec === 'trn' ? konecTrn(c, q.hadice, p.vystup.presah, p.vystup.zubu) : konecSamec(udajeZavitu(p, p.vystup.zavit), c);
      rb = Math.min(b0.rbNat, q.pruchod / 2 + 0.2, rCore - 1.2);
      c.rb = rb;
      B = q.konec === 'trn' ? konecTrn(c, q.hadice, p.vystup.presah, p.vystup.zubu) : konecSamec(udajeZavitu(p, p.vystup.zavit), c);
    }
    let dr = null;
    if (p.telo.tesneni === 'oring') {
      const s = q.otvor > 30 ? 3 : 2, ri = rMaj + 1.2;
      dr = { snura: s, ri, ro: ri + 1.4 * s, hl: 0.75 * s };
    }
    const zt = tp + Lt, rJ = rCore - 0.12;
    const vnejsi = [[0, 0], [Rf, 0], [Rf, tp]];
    if (dr) vnejsi.push([dr.ro, tp], [dr.ro, tp - dr.hl], [dr.ri, tp - dr.hl], [dr.ri, tp]);
    vnejsi.push([rJ, tp], [rJ, zt]);
    let zTop = zt;
    const tyce = [{ znam: 1, rMaj, h: z.h, p: z.p, bok: z.bok, z0: tp - 0.5, z1: zt, srazit: 'nahore', ch: Math.min(1.2 * z.h, Lt / 3) }];
    const duchove = [{ typ: 'valec', r: Rf + 20, ri: q.otvor / 2, z0: tp + tl, z1: tp + tl + q.tloustka, popis: 'stěna / víko' }];
    if (B) {
      const h2 = SKLON * Math.abs(rJ - B.rJ), zB0 = zt + h2;
      zTop = zB0 + B.L;
      vnejsi.push(...zrcadli(B.vnejsi, zTop));
      for (const t of B.tyce) tyce.push(Object.assign({}, t, { otocit: true, zTop }));
      for (const d of B.duchove) duchove.push(Object.assign({}, d, { z0: zTop - d.z1, z1: zTop - d.z0 }));
    } else duchove.push({ typ: 'valec', r: q.pruchod / 2, ri: Math.max(0, q.pruchod / 2 - 2), z0: -30, z1: zTop + 40, popis: 'hadice / kabel' });
    vnejsi.push([0, zTop]);
    const vnitrni = [[0, -1], [rb, -1], [rb, zTop + 1], [0, zTop + 1]];
    // matice: šestihran, vnitřní závit skrz, sražené vstupy z obou stran
    const S = Math.ceil(2 * (rMajF + Math.max(3.5, p.telo.stena))), Rv = S / Math.sqrt(3), rs = rMinF - 0.3, rch = rMajF + 0.4;
    const mx = Rf + Rv + 8;
    const hchM = Math.min(SKLON * (Rv - S / 2 * 0.92), Hm / 3);
    const matice = { x: mx, S, Rv, H: Hm, rMajF, rMinF, rs, hch: hchM, r0: Rv - hchM / SKLON,
      vnitrni: [[0, -1], [rch, -1], [rch, 0], [rs, 1.2 * (rch - rs)], [rs, Hm - 1.2 * (rch - rs)], [rch, Hm], [rch, Hm + 1], [0, Hm + 1]],
      tyc: { znam: -1, rMaj: rMajF, h: z.h, p: z.p, bok: z.bok, z0: -0.937, z1: Hm + 0.963, srazit: null } };
    return { druh: 'pruchodka', zavit: z, B, rb, Rf, tp, Lt, tl, dr, rMaj, rCore, rMajF, rMinF, Hm, matice,
      vnejsi: bezDuplicit(vnejsi), vnitrni, tyce, duchove, extra: [], uchop: null, vyska: zTop, seg: segZ(Math.max(Rf, rMaj)),
      stenaZavit: rCore - rb, rMaxKonce: B ? B.rMax : rb };
  }

  /** Náhradní víko: plášť s vnitřním závitem, dno s otvory / nástavci, přepad, odvzdušnění. */
  function sestavaVicka(p) {
    const q = p.vicko, v = p.zavit.vule, z = udajeZavitu(p, q.zavit);
    const rMaj = z.d / 2 + v / 2, rMin = rMaj - z.h, rs = rMin - 0.3, rch = p.zavit.nabeh ? rMaj + 0.4 : rs;
    const tl = p.telo.tesneni === 'plocha' ? p.telo.tlTesneni : 0, H = q.vyska, T = q.dno, R = Math.round((rMaj + p.telo.stena) * 10) / 10;
    const vnejsi = [[0, 0], [R, 0], [R, H + T], [0, H + T]];
    const vnitrni = rch > rs ? [[0, -1], [rch, -1], [rch, 0], [rs, 1.2 * (rch - rs)], [rs, H], [0, H]] : [[0, -1], [rs, -1], [rs, H], [0, H]];
    const tyce = [{ znam: -1, rMaj, h: z.h, p: z.p, bok: z.bok, z0: -0.937, z1: H - tl - 0.3, srazit: null }];
    // otvory: vstupy rovnoměrně, přepad naproti
    const otvory = [], n = q.vstupu + (q.prepad > 0 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = (90 + 360 * i / Math.max(1, n)) * Math.PI / 180, prepad = i === q.vstupu;
      const D = prepad ? q.prepad : q.prumer, rr = n === 1 ? 0 : q.roztec;
      otvory.push({ x: rr * Math.cos(a), y: rr * Math.sin(a), D, prepad });
    }
    const extra = [], nastavce = [];
    for (const o of otvory) {
      if (q.typVstupu === 'trn') {
        const c = kontext(p, 'vystup', 1e3), b0 = konecTrn(c, o.D, p.vystup.presah, 3);
        c.rb = b0.rbNat;
        const b = konecTrn(c, o.D, p.vystup.presah, 3);
        nastavce.push({ x: o.x, y: o.y, konec: b, z0: H + T - 0.3 });
        extra.push({ typ: 'dira', r: b.rbNat, x: o.x, y: o.y, z0: H - 1, z1: H + T + b.L + 1 });
        o.rVnejsi = b.rMax; o.rDira = b.rbNat;
      } else {
        extra.push({ typ: 'dira', r: o.D / 2, x: o.x, y: o.y, z0: H - 1, z1: H + T + 1 });
        o.rVnejsi = o.D / 2; o.rDira = o.D / 2;
      }
    }
    let odvzd = null;
    if (q.odvzdusneni > 0) {
      // do středu, pokud tam není otvor; jinak na roztečnou kružnici mezi otvory
      const volnyStred = otvory.every(o => Math.hypot(o.x, o.y) > o.rVnejsi + q.odvzdusneni / 2 + 3);
      const a = (90 + 180 / Math.max(1, n)) * Math.PI / 180, rr = volnyStred ? 0 : q.roztec;
      odvzd = { x: rr * Math.cos(a), y: rr * Math.sin(a), D: q.odvzdusneni };
      extra.push({ typ: 'dira', r: q.odvzdusneni / 2, x: odvzd.x, y: odvzd.y, z0: H - 1, z1: H + T + 1 });
    }
    const u = uchop(p, R, 0, H + T);
    const vyska = H + T + Math.max(0, ...nastavce.map(x => x.konec.L - 0.3));
    return { druh: 'vicko', zavit: z, rMaj, rMin, rs, R, H, T, tl, otvory, odvzd, nastavce, vnejsi, vnitrni, tyce, extra, uchop: u,
      duchove: [{ typ: 'valec', r: z.d / 2, ri: z.d / 2 - 6, z0: -40, z1: H - tl, popis: 'hrdlo nádrže' }],
      vyska, seg: segZ(Math.max(R, u ? u.Rv : 0)), stenaZavit: R - rMaj, sirkaSedla: rs };
  }

  function odvozene(p) {
    if (p.druh === 'pruchodka') return sestavaPruchodky(p);
    if (p.druh === 'vicko') return sestavaVicka(p);
    return sestavaOsova(p);
  }

  /* ---------- kontroly zadání ---------- */
  function kontrolyZavitu(H, pridej, kon, kde) {
    if (!kon || !kon.zavit) return;
    const z = kon.zavit, otacek = kon.zasroub / z.p, pole = kde + '.zasroub', jm = kde === 'vstup' ? 'Vstup' : 'Výstup';
    const doporuc = Math.ceil(3 * z.p);
    if (otacek < 1.5) pridej('chyba', `${jm}: zašroubování ${fmt(kon.zasroub)} mm = jen ${fmt(otacek, 1)} chodu závitu ${z.nazev} – nutné ≥ 1,5 × stoupání, doporučeno ≥ 3 chody (${doporuc} mm).`, pole,
      { pole, hodnota: doporuc, text: `zašroubování ${doporuc} mm` });
    else if (otacek < 3) pridej('varovani', `${jm}: zašroubování ${fmt(kon.zasroub)} mm = ${fmt(otacek, 1)} chodu – pod tlakem může závit vyskočit, doporučeno ≥ 3 chody (${doporuc} mm).`, pole,
      { pole, hodnota: doporuc, text: `zašroubování ${doporuc} mm` });
    if (kon.typ === 'samice') {
      if (kon.stenaZavit < 1.2) pridej('chyba', `${jm}: stěna nad vnitřním závitem jen ${fmt(kon.stenaZavit, 2)} mm – praskne.`, 'telo.stena');
      else if (kon.stenaZavit < 2) pridej('varovani', `${jm}: stěna nad závitem ${fmt(kon.stenaZavit, 2)} mm – pro tlakovou vodu doporučeno ≥ 2 mm.`, 'telo.stena',
        { pole: 'telo.stena', hodnota: 3, text: 'stěna 3 mm' });
      if (kon.tesneni && kon.tesneni.typ === 'plocha' && kon.sirkaSedla < 3) pridej('varovani', `${jm}: dosedací plocha těsnění je úzká (${fmt(kon.sirkaSedla, 1)} mm).`, 'telo.tesneni');
    } else if (kon.typ === 'samec') {
      if (kon.stenaZavit < 1.2) pridej('chyba', `${jm}: stěna pod vnějším závitem (jádro Ø ${fmt(2 * kon.rCore, 1)} − průchod) jen ${fmt(kon.stenaZavit, 2)} mm – praskne.`, ['telo.prutok', 'telo.stena']);
      else if (kon.stenaZavit < 2) pridej('varovani', `${jm}: stěna pod závitem ${fmt(kon.stenaZavit, 2)} mm – pro tlakovou vodu doporučeno ≥ 2 mm (zmenšete průchod).`, ['telo.prutok', 'telo.stena']);
    }
  }
  function kontroly(p, o) {
    const H = [], pridej = (uroven, text, pole = [], oprava) => H.push({ uroven, text, pole: [].concat(pole), oprava });
    const v = p.zavit.vule;
    if (v < 0.2) pridej('varovani', `Vůle závitu ${fmt(v, 2)} mm na průměr je malá – tištěný závit půjde ztuha nebo vůbec (FDM ≈ 0,3–0,5 mm).`, 'zavit.vule', { pole: 'zavit.vule', hodnota: 0.4, text: 'vůle 0,4 mm' });
    else if (v > 0.8) pridej('varovani', `Vůle závitu ${fmt(v, 2)} mm je velká – závit bude volný a nesnese tah; těsní jen těsnění.`, 'zavit.vule', { pole: 'zavit.vule', hodnota: 0.4, text: 'vůle 0,4 mm' });
    if (p.druh === 'adapter' || p.druh === 'redukce' || p.druh === 'zaslepka') {
      kontrolyZavitu(H, pridej, o.A, 'vstup');
      if (o.B) kontrolyZavitu(H, pridej, o.B, 'vystup');
      if (p.druh === 'redukce' && o.A.zavit && o.B.zavit && o.A.zavit.klic === o.B.zavit.klic && p.vstup.pohlavi === p.vystup.pohlavi && o.A.zavit.klic !== 'vlastni')
        pridej('info', 'Redukce má na obou stranách stejný závit i pohlaví – jde o prodlužku / spojku.', 'vystup.zavit');
      if (o.B && o.B.typ === 'trn') {
        const B = o.B;
        if (B.presah < 5) pridej('varovani', `Přesah zubů trnu ${fmt(B.presah, 1)} % je malý – hadice sklouzne (doporučeno 5–15 % nad vnitřní průměr hadice).`, 'vystup.presah',
          { pole: 'vystup.presah', hodnota: 10, text: 'přesah 10 %' });
        else if (B.presah > 15) pridej('varovani', `Přesah zubů ${fmt(B.presah, 1)} % je velký – hadice půjde nasadit jen nahřátá a může prasknout.`, 'vystup.presah',
          { pole: 'vystup.presah', hodnota: 10, text: 'přesah 10 %' });
        if (B.stenaTrnu < 1.5) pridej('chyba', `Stěna trnu jen ${fmt(B.stenaTrnu, 2)} mm – zmenšete průchod.`, ['telo.prutok', 'vystup.hadice']);
        else if (B.stenaTrnu < 2) pridej('varovani', `Stěna trnu ${fmt(B.stenaTrnu, 2)} mm – pod sponou se může promáčknout (doporučeno ≥ 2 mm).`, ['telo.prutok', 'telo.stena']);
        if (B.ID < 2 * o.rb + 0.5) pridej('info', `Průchod je omezen trnem: hadice ${fmt(B.ID)} mm, uvnitř Ø ${fmt(2 * o.rb, 1)} mm.`, 'vystup.hadice');
      }
      if (o.B && o.B.typ === 'gardena') pridej('info', 'Profil spojky typu Gardena je zjednodušený a neověřený – originální (kovový / plastový) díl na G 3/4″ těsní spolehlivěji.', 'vystup.typ',
        { pole: 'vystup.typ', hodnota: 'zavit', text: 'raději závit G 3/4″' });
      if (o.B && o.B.typ === 'hrdlo' && o.B.Lh < 0.5 * o.B.D) pridej('varovani', `Hrdlo hloubky ${fmt(o.B.Lh)} mm je na lepení trubky Ø ${fmt(o.B.D)} krátké (doporučeno ≥ ${Math.ceil(0.5 * o.B.D + 6)} mm).`, 'vystup.hloubkaHrdla',
        { pole: 'vystup.hloubkaHrdla', hodnota: 0, text: 'hloubka automaticky' });
      if (o.B && p.telo.prutok > 0 && p.telo.prutok / 2 > o.rb + 0.05) pridej('info', `Zadaný průchod Ø ${fmt(p.telo.prutok)} se nevejde – použito Ø ${fmt(2 * o.rb, 1)} mm (omezuje ho závit / trn).`, 'telo.prutok');
      if (o.B && o.A.zavit && o.A.zavit.skupina === 'IBC' && 2 * o.rb < 0.2 * o.A.zavit.d) pridej('info', `Nejužší průchod Ø ${fmt(2 * o.rb, 1)} mm je proti výpusti malý – průtok omezí hlavně tento díl.`, 'telo.prutok');
      if (p.telo.stena < 2) pridej('varovani', `Stěna ${fmt(p.telo.stena)} mm – pro tlakovou vodu doporučeno ≥ 2 mm.`, 'telo.stena', { pole: 'telo.stena', hodnota: 3, text: 'stěna 3 mm' });
      if (p.druh === 'zaslepka' && p.zaslepka.dno < 2.5) pridej('varovani', `Dno záslepky ${fmt(p.zaslepka.dno)} mm je tenké – pod tlakem plné nádrže se prohne.`, 'zaslepka.dno',
        { pole: 'zaslepka.dno', hodnota: 4, text: 'dno 4 mm' });
      if (o.uchop && o.uchop.typ === 'sestihran') pridej('info', `Šestihran ${o.uchop.S} mm na klíč – utahujte citlivě, plastový závit nesnese velký moment.`, 'telo.uchop');
    } else if (p.druh === 'pruchodka') {
      const q = p.pruchodka;
      if (o.stenaZavit < 1.2) pridej('chyba', `Stěna dříku pod závitem jen ${fmt(o.stenaZavit, 2)} mm – zmenšete průchod nebo zvětšete otvor.`, ['pruchodka.pruchod', 'pruchodka.otvor']);
      else if (o.stenaZavit < 2) pridej('varovani', `Stěna dříku pod závitem ${fmt(o.stenaZavit, 2)} mm – doporučeno ≥ 2 mm.`, ['pruchodka.pruchod', 'pruchodka.otvor']);
      if (q.konec === 'hladky' && q.pruchod / 2 + 0.2 > o.rCore - 1.2) pridej('chyba', `Průchod Ø ${fmt(q.pruchod)} se do dříku Ø ${fmt(o.zavit.d)} nevejde – vyvrtejte větší otvor (≥ ${fmt(Math.ceil(q.pruchod + 2 * o.zavit.h + 5.5))} mm).`,
        ['pruchodka.otvor', 'pruchodka.pruchod'], { pole: 'pruchodka.otvor', hodnota: Math.ceil(q.pruchod + 2 * o.zavit.h + 5.5), text: `otvor Ø ${Math.ceil(q.pruchod + 2 * o.zavit.h + 5.5)}` });
      if (o.rMaxKonce > o.rMinF - 0.2) pridej('chyba', `Konec venku (Ø ${fmt(2 * o.rMaxKonce, 1)}) je větší než otvor matice (Ø ${fmt(2 * o.rMinF, 1)}) – matice nepůjde nasadit.`, ['pruchodka.konec', 'pruchodka.otvor', 'pruchodka.hadice']);
      if (q.priruba < 5) pridej('varovani', `Příruba přesahuje otvor jen o ${fmt(q.priruba)} mm – těsnění nebude mít kde dosednout.`, 'pruchodka.priruba');
      if (q.konec === 'hladky') pridej('info', 'Hladký průchod netěsní kolem hadice / kabelu – utěsněte silikonem nebo kabelovou vývodkou.', 'pruchodka.konec');
      pridej('info', `Otvor Ø ${fmt(q.otvor)} mm vyvrtejte stupňovitým vrtákem nebo korunkou; závit dříku Ø ${fmt(o.zavit.d)} × ${fmt(o.zavit.p)} prochází s vůlí 0,6 mm.`, 'pruchodka.otvor');
    } else if (p.druh === 'vicko') {
      const q = p.vicko;
      if (o.stenaZavit < 1.5) pridej('chyba', `Plášť víka nad závitem jen ${fmt(o.stenaZavit, 2)} mm.`, 'telo.stena');
      else if (o.stenaZavit < 2.5) pridej('varovani', `Plášť víka nad závitem ${fmt(o.stenaZavit, 2)} mm – velký průměr se snadno deformuje, doporučeno ≥ 2,5 mm.`, 'telo.stena', { pole: 'telo.stena', hodnota: 3, text: 'stěna 3 mm' });
      const otacek = (q.vyska - o.tl) / o.zavit.p;
      if (otacek < 1.5) pridej('chyba', `Plášť víka zabere jen ${fmt(otacek, 1)} chodu závitu – zvyšte plášť.`, 'vicko.vyska', { pole: 'vicko.vyska', hodnota: Math.ceil(2 * o.zavit.p + o.tl + 1), text: `plášť ${Math.ceil(2 * o.zavit.p + o.tl + 1)} mm` });
      const vse = o.otvory.concat(o.odvzd ? [Object.assign({ rVnejsi: o.odvzd.D / 2 }, o.odvzd)] : []);
      for (const [i, a] of vse.entries()) {
        if (Math.hypot(a.x, a.y) + a.rVnejsi > o.rs - 3) pridej('chyba', `${a.prepad ? 'Přepad' : a.D === q.odvzdusneni && i === vse.length - 1 && o.odvzd ? 'Odvzdušnění' : `Otvor ${i + 1}`} zasahuje do závitu – zmenšete rozteč nebo průměr.`, ['vicko.roztec', 'vicko.prumer']);
        for (let j = i + 1; j < vse.length; j++) { const b = vse[j]; if (Math.hypot(a.x - b.x, a.y - b.y) < a.rVnejsi + b.rVnejsi + 3) pridej('chyba', `Otvory ${i + 1} a ${j + 1} jsou příliš blízko – zvětšete rozteč.`, 'vicko.roztec'); }
      }
      if (q.typVstupu === 'trn') pridej('varovani', 'Nástavce trčí z vnější strany víka – víko se pak tiskne s podporami pod celým dnem. Lepší jsou otvory a tištěné průchodky.', 'vicko.typVstupu',
        { pole: 'vicko.typVstupu', hodnota: 'otvor', text: 'otvory pro průchodky' });
      if (q.zavit === 'DN150') pridej('info', `Závit hrdla DN150 se u výrobců liší – před tiskem změřte hrdlo své nádrže (Ø a stoupání) a případně zvolte vlastní závit. Data ${DATUM_DAT}.`, 'vicko.zavit');
    }
    if (p.tisk.material === 'PLA') pridej('varovani', 'PLA venku na slunci měkne a ve vlhku degraduje – pro IBC volte PETG nebo ASA.', 'tisk.material', { pole: 'tisk.material', hodnota: 'PETG', text: 'PETG' });
    if (p.tisk.material === 'PP') pridej('info', 'PP se tiskne obtížně (kroucení, přilnavost) – vyžaduje podložku z PP pásky.', 'tisk.material');
    for (const k of [o.A, o.B]) if (k && k.zavit && k.zavit.skupina === 'IBC') {
      pridej('info', `Závit ${k.zavit.nazev}: rozměry jsou ${OVERIT} (stav ${DATUM_DAT}); před tiskem série vytiskněte zkušební kroužek.`, k === o.A ? 'vstup.zavit' : 'vystup.zavit');
      break;
    }
    return H;
  }

  /* ---------- rozbor tisku ---------- */
  function kandidatiOrientace(p) {
    const n = {
      adapter: ['vstup dolů (jak je kresleno)', 'výstup dolů (převrácený)'], redukce: ['vstup dolů (jak je kresleno)', 'výstup dolů (převrácený)'],
      zaslepka: ['ústím dolů', 'dnem dolů'], pruchodka: ['přírubou a maticí dolů', 'konci dolů (převrácené)'], vicko: ['okrajem pláště dolů', 'víkem dolů'],
    }[p.druh];
    return [{ klic: '-Z', nazev: n[0], dolu: [0, 0, -1] }, { klic: '+Z', nazev: n[1], dolu: [0, 0, 1] }, { klic: 'bok', nazev: 'na boku (osa vodorovně)', dolu: [0, -1, 0] }];
  }
  function rozborTisku(sit, p) {
    const kand = kandidatiOrientace(p), lim = p.tisk.previs, vysl = [];
    // boky prvního chodu závitu těsně nad podložkou nemají pod sebou další chod – krátký převis se vytiskne
    const prah = 1.6 * Math.max(0, ...(sit.stoupani || [])) + 0.3, sinS = Math.sin(Math.min(89, lim + 15) * Math.PI / 180);
    for (const k of kand) {
      const R = S.rotaceDolu(k.dolu), poloha = S.tiskovaPoloha(sit, R), pv = S.previsy(poloha.poz, sit.idx, lim);
      pv.uPodlozky = 0;
      if (prah > 0.3 && k.klic !== 'bok') {
        const P = poloha.poz, I = sit.idx;
        for (let t = 0; t < pv.tridy.length; t++) {
          if (pv.tridy[t] !== 2) continue;
          const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
          if (Math.max(P[a + 2], P[b + 2], P[c + 2]) > prah) continue;
          const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
          const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz), A = l / 2;
          pv.volne -= A; pv.uPodlozky += A; if (-nz / l > sinS) pv.strme -= A;
        }
        pv.volne = Math.max(0, pv.volne); pv.strme = Math.max(0, pv.strme);
      }
      // vodorovná osa = závity napříč vrstvami: penalizace
      const skore = pv.volne * 5 + pv.strme * 20 + pv.most * 0.3 + pv.vyska * 0.5 - Math.min(pv.podlozka, 150) * 0.2 + (pv.podlozka < 20 ? 10000 : 0) + (k.klic === 'bok' ? 2000 : 0);
      vysl.push(Object.assign({}, k, { R, volne: pv.volne, strme: pv.strme, most: pv.most, podlozka: pv.podlozka, vyska: pv.vyska, uPodlozky: pv.uPodlozky, skore }));
    }
    vysl.sort((a, b) => a.skore - b.skore);
    const vybrana = vysl.find(v => v.klic === p.tisk.orientace) || vysl[0];
    return { kandidati: vysl, nejlepsi: vysl[0], vybrana };
  }
  function kontrolyTisku(p, o, rozbor, plocha) {
    const H = [], v = rozbor.vybrana, best = rozbor.nejlepsi;
    if (v.volne > 2 && !S.potrebujePodpory(v, plocha)) {
      H.push({ uroven: 'info', text: `V poloze „${v.nazev}“ zbývá ${fmt(v.volne, 0)} mm² mírných převisů (boky zubů a závitů) – obvykle se vytisknou bez podpor.`, pole: ['tisk.orientace'] });
    } else if (v.volne > 2) {
      const lepsi = best !== v && best.volne + 4 * best.strme < 0.5 * (v.volne + 4 * v.strme);
      H.push({ uroven: 'varovani', text: `V poloze „${v.nazev}“ visí ${fmt(v.volne, 0)} mm² povrchu nad ${fmt(p.tisk.previs, 0)}° bez opory – tiskněte s podporami.`
        + (lepsi ? ` Méně převisů má „${best.nazev}“ (${fmt(best.volne, 0)} mm²).` : ''), pole: ['tisk.orientace'],
        oprava: lepsi ? { pole: 'tisk.orientace', hodnota: best.klic, text: 'použít lepší polohu' } : undefined });
    } else H.push({ uroven: 'ok', text: `Tiskne se bez podpor – poloha „${v.nazev}“, výška ${fmt(v.vyska)} mm.`, pole: ['tisk.orientace'] });
    if (v.uPodlozky > 2) H.push({ uroven: 'info', text: `${fmt(v.uPodlozky, 0)} mm² boků prvního chodu závitu u podložky visí bez opory – krátký převis, tiskne se bez podpor (případně o 2–3 % pomaleji první vrstvy).`, pole: ['tisk.orientace'] });
    if (v.klic === 'bok') H.push({ uroven: 'varovani', text: 'Na boku leží závity napříč vrstvami – budou hrubé a netěsné. Závity tiskněte svisle (osa Z).', pole: ['tisk.orientace'],
      oprava: { pole: 'tisk.orientace', hodnota: 'auto', text: 'poloha automaticky' } });
    if (v.podlozka < 15) H.push({ uroven: 'varovani', text: `Na podložce leží jen ${fmt(v.podlozka, 0)} mm² – přidejte límec (brim).`, pole: ['tisk.orientace'] });
    H.push({ uroven: 'info', text: 'Pro vodotěsnost: 4–6 obvodových stop (perimetrů), 5 horních a spodních vrstev, výplň 40 % a víc; vrstva ≤ 0,2 mm kvůli závitu.', pole: ['tisk.vypln'] });
    return H;
  }
  /** Hmotnost a čas (stejný hrubý model jako spojky, obvod 1,6 mm = 4 stopy). */
  function odhadTisku(objem, plocha, vyska, p) {
    const mat = MATERIALY[p.tisk.material];
    const plast = Math.min(objem, plocha * 1.6), vypln = Math.max(0, objem - plast) * p.tisk.vypln / 100;
    const V3 = plast + vypln, gramy = V3 / 1000 * mat.hustota;
    return { gramy, metru: V3 / (Math.PI * 0.875 * 0.875) / 1000, minut: (V3 / 7 + vyska / 0.2 * 1.5) / 60 * 1.1, plny: objem / 1000 * mat.hustota };
  }

  /* ---------- kusovník ---------- */
  const zaokr = (x, k = 0.5) => Math.round(x / k) * k;
  function sponaPro(OD) { return SPONY.find(([a, b]) => OD >= a + 1 && OD <= b - 2) || SPONY.find(([a, b]) => OD >= a && OD <= b) || null; }
  function tesneniRadek(t, kde) {
    if (!t) return null;
    if (t.typ === 'plocha') return { ks: 1, co: `Plochá těsnicí podložka ${fmt(t.OD, 1)} × ${fmt(t.ID, 1)} × ${fmt(t.t, 1)} mm (EPDM / pryž)`, pozn: `${kde}: vložit na dno závitu; vyříznout z pryže nebo koupit nejbližší` };
    return { ks: 1, co: `O-kroužek ${fmt(zaokr(t.ID), 1)} × ${fmt(t.snura, 1)} mm (NBR / EPDM)`, pozn: `${kde}: do čelní drážky Ø ${fmt(2 * t.drazka.ri, 1)}–${fmt(2 * t.drazka.ro, 1)}, hloubka ${fmt(t.drazka.hl, 2)} mm` };
  }
  function kusovnik(p, o) {
    const out = [], pridej = x => { if (x) out.push(x); };
    const konec = (k, kde) => {
      if (!k) return;
      if (k.typ === 'samice') pridej(tesneniRadek(k.tesneni, kde));
      if (k.typ === 'samec' && k.zavit.skupina === 'G') pridej({ ks: 1, co: 'Teflonová páska (PTFE) na závit', pozn: `${kde}: G ${k.zavit.nazev.replace('G ', '')} – 3–5 ovinutí po směru závitu, nebo plochá podložka do protikusu` });
      if (k.typ === 'samec' && k.zavit.skupina !== 'G') pridej({ ks: 1, co: `Plochá těsnicí podložka do protikusu ${k.zavit.nazev.split(' –')[0]}`, pozn: `${kde}: těsní čelo vnějšího závitu` });
      if (k.typ === 'trn') {
        const s = sponaPro(k.hadiceOD);
        pridej({ ks: 1, co: `Hadicová spona (šneková) ${s ? s[0] + '–' + s[1] : '?'} mm`, pozn: `hadice ${fmt(k.ID, 1)} mm, vnější Ø ≈ ${fmt(k.hadiceOD, 0)} mm (podle stěny hadice); nerez W4 venku` });
      }
      if (k.typ === 'hrdlo') pridej({ ks: 1, co: `Lepidlo na PVC + čistič (trubka Ø ${fmt(k.D)})`, pozn: 'PETG/ASA lepidlo na PVC nedrží spolehlivě – lepší je dvousložkové epoxidové / MS polymer; nebo jen nasunout s těsnicí páskou' });
      if (k.typ === 'gardena') pridej({ ks: 1, co: `O-kroužek ${GARDENA.oring[0]} × ${GARDENA.oring[1]} mm`, pozn: 'do drážky nosu spojky (orientační rozměr – změřte originál)' });
    };
    if (p.druh === 'pruchodka') {
      const q = p.pruchodka;
      if (p.telo.tesneni === 'plocha') pridej({ ks: 1, co: `Plochá těsnicí podložka ${fmt(Math.floor(2 * o.Rf - 2))} × ${fmt(Math.ceil(q.otvor + 0.5))} × ${fmt(o.tl, 1)} mm`, pozn: 'pod přírubu, na stranu s kapalinou' });
      if (o.dr) pridej({ ks: 1, co: `O-kroužek ${fmt(zaokr(2 * o.dr.ri), 1)} × ${fmt(o.dr.snura, 1)} mm`, pozn: `do drážky v přírubě Ø ${fmt(2 * o.dr.ri, 1)}–${fmt(2 * o.dr.ro, 1)}` });
      pridej({ ks: 1, co: `Matice průchodky – tištěná (šestihran ${o.matice.S} mm, výška ${fmt(o.Hm)})`, pozn: 'součást modelu, druhý kus na podložce' });
      pridej({ ks: 1, co: `Vrták Ø ${fmt(q.otvor)} mm (stupňovitý nebo korunka)`, pozn: 'otvor ve víku / stěně' });
      if (o.B) konec(o.B, 'konec venku');
      else pridej({ ks: 1, co: 'Silikon / tmel na utěsnění kolem hadice', pozn: `průchod Ø ${fmt(q.pruchod)} mm + vůle` });
    } else if (p.druh === 'vicko') {
      if (p.telo.tesneni === 'plocha') pridej({ ks: 1, co: `Plochý těsnicí kroužek ${fmt(Math.floor(2 * o.rs - 1))} × ${fmt(Math.floor(2 * o.rs - 2 * Math.max(6, 0.06 * o.zavit.d)))} × ${fmt(o.tl, 1)} mm`, pozn: 'pod dno víka, dosedá na čelo hrdla' });
      if (p.vicko.typVstupu === 'otvor' && o.otvory.length) pridej({ ks: o.otvory.length, co: 'Průchodka (tištěná, předvolba Průchodka)', pozn: o.otvory.map(x => `Ø ${fmt(x.D)}`).join(', ') + ' – otvor ve víku' });
      if (p.vicko.typVstupu === 'trn') for (const x of o.nastavce) konec(x.konec, x.konec.ID ? `nástavec Ø ${fmt(x.konec.ID)}` : 'nástavec');
    } else {
      konec(o.A, 'vstup'); konec(o.B, 'výstup');
      if (p.druh === 'zaslepka' && p.zaslepka.retizek) pridej({ ks: 1, co: 'Řetízek s karabinkou / kroužkem', pozn: 'ucho na víčku má otvor Ø 4,5 mm' });
    }
    return out;
  }

  /* ---------- projekt ---------- */
  function ulozProjekt(p) {
    return JSON.stringify({ format: 'webapp_ibc', verze: VERZE_FORMATU, ulozeno: new Date().toISOString(), projekt: p }, null, 2);
  }
  function nactiProjekt(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
    if (!o || typeof o !== 'object') throw new Error('Soubor neobsahuje projekt.');
    if (o.format !== 'webapp_ibc') throw new Error('Soubor není projekt IBC adaptéru (chybí "format": "webapp_ibc").');
    if (!(o.verze >= 1) || o.verze > VERZE_FORMATU) throw new Error(`Nepodporovaná verze projektu ${o.verze}.`);
    return normalizuj(o.projekt);
  }
  const kratce = (p, klic) => udajeZavitu(p, klic).nazev.split(' –')[0];
  function popisVystupu(p) {
    const q = p.vystup;
    if (q.typ === 'trn') return `trn ${fmt(q.hadice, 1)} mm`;
    if (q.typ === 'hrdlo') return `hrdlo PVC Ø ${fmt(q.trubka)}`;
    if (q.typ === 'gardena') return 'Gardena samec';
    return `${kratce(p, q.zavit)} ${q.pohlavi === 'samec' ? 'vnější' : 'vnitřní'}`;
  }
  function popis(p) {
    if (p.druh === 'pruchodka') return `průchodka otvor Ø ${fmt(p.pruchodka.otvor)}, ${KONCE_PRUCHODKY[p.pruchodka.konec].toLowerCase().split(' (')[0]}`;
    if (p.druh === 'vicko') return `víko ${kratce(p, p.vicko.zavit)}, ${p.vicko.vstupu} vstup${p.vicko.vstupu === 1 ? '' : 'y'}${p.vicko.prepad > 0 ? ' + přepad' : ''}`;
    const a = `${kratce(p, p.vstup.zavit)} ${p.vstup.pohlavi === 'samec' && p.druh !== 'zaslepka' ? 'vnější' : 'vnitřní'}`;
    if (p.druh === 'zaslepka') return `záslepka ${a}`;
    return `${a} → ${popisVystupu(p)}`;
  }

  const API = {
    VERZE_FORMATU, DATUM_DAT, OVERIT, ZAVITY, HADICE, TRUBKY_PVC, SPONY, MATERIALY, DRUHY, VYSTUPY, KONCE_PRUCHODKY, UCHOPY, TESNENI, GARDENA,
    VYCHOZI, ROZSAHY, PREDVOLBY, SKLON,
    kopie, cislo, fmt, vezmi, poloz, V, normalizuj, zPredvolby, udajeZavitu, zavitPruchodky, segZ, odvozene, kontroly,
    kandidatiOrientace, rozborTisku, kontrolyTisku, odhadTisku, kusovnik, sponaPro, ulozProjekt, nactiProjekt, popis,
    rotaceDolu: S.rotaceDolu, otoc: S.otoc, tiskovaPoloha: S.tiskovaPoloha, previsy: S.previsy, potrebujePodpory: S.potrebujePodpory,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.IBC = API;
})();

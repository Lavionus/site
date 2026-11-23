/* Držák a adaptér cívky filamentu – jádro generátoru (bez DOM a bez three.js, spustitelné v node).
   Tři druhy dílu:
   • redukce – vložka do otvoru cívky (vnější průměr podle otvoru, příruba-doraz, žebra nebo pera na sevření,
     odlehčení s paprsky) na trn nebo s kapsou na ložisko z katalogu obsah/loziska; volitelně dvoudílná
     (díly A a B se sesadí otvorem cívky a sevřou ji mezi přírubami);
   • stojan – dvě (či více) bočnice s ložisky, na kterých se cívka odvaluje po obvodu, spojené lištami
     s rybinovým zámkem (dělené podle velikosti podložky) nebo závitovými tyčemi M8; bočnice se při velké šířce dělí;
   • vodítko – očko, nástavec pro PTFE trubičku (se spojkou) nebo kladka s ložiskem na desku / profil 2020.
   Vše se tiskne bez podpor: redukce na přírubě, bočnice a lišty naplocho, vodítko na boku.

   Každý díl: {jmeno, nazev, poz, idx (tisková poloha), objem, teles, barva, ks, umisteni: [f(x,y,z) → [X,Y,Z], …], zrcadlo: [bool]}.
   Sestava: X = osa cívky, Z nahoru (stůl z = 0). Kontext (cívka, ložiska, tyče, filament) jen pro náhled. */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const LJ = uzel ? require('../loziska/jadro.js') : window.LoziskaJadro;
  const ZG = uzel ? require('../ibc/geometrie.js') : window.IBC_GEOM;    // zavitovaTyc (závit průchodky a matice)
  const fmt = G.fmt, kopie = G.kopie;
  const rad = s => s * Math.PI / 180;
  const AKTUALIZACE = '11/2026';

  /* ---------------- tabulky ---------------- */
  const MATERIALY = {
    PETG: { nazev: 'PETG', hustota: 1.27 }, PLA: { nazev: 'PLA', hustota: 1.24 }, ASA: { nazev: 'ASA', hustota: 1.07 },
    ABS: { nazev: 'ABS', hustota: 1.04 }, PA: { nazev: 'PA (nylon)', hustota: 1.14 }, PC: { nazev: 'PC', hustota: 1.2 },
  };
  /** Typické cívky – NEOVĚŘENO výrobcem, rozměry se liší; ověřit posuvkou. otvor/průměr/šířka/bok v mm, hmotnost a tára v kg. */
  const CIVKY = [
    { id: 'plast1kg', nazev: 'Plastová 1 kg – otvor ~53 mm', otvor: 53, prumer: 200, sirka: 68, bok: 3, hmotnost: 1, tara: 0.25 },
    { id: 'plast1kg57', nazev: 'Plastová 1 kg – otvor 55–58 mm', otvor: 57, prumer: 200, sirka: 65, bok: 3, hmotnost: 1, tara: 0.22 },
    { id: 'otvor74', nazev: 'Cívka s otvorem 73–75 mm', otvor: 74, prumer: 200, sirka: 65, bok: 3, hmotnost: 1, tara: 0.22 },
    { id: 'karton', nazev: 'Kartonová / refill bez cívky – otvor 100+ mm', otvor: 102, prumer: 200, sirka: 65, bok: 4, hmotnost: 1, tara: 0.15 },
    { id: 'pul', nazev: 'Plastová 0,5 kg', otvor: 53, prumer: 200, sirka: 40, bok: 3, hmotnost: 0.5, tara: 0.2 },
    { id: 'mala', nazev: 'Malá 250 g – otvor ~32 mm', otvor: 32, prumer: 140, sirka: 45, bok: 2.5, hmotnost: 0.25, tara: 0.08 },
    { id: 'velka2kg', nazev: 'Plastová 2–2,5 kg', otvor: 53, prumer: 250, sirka: 90, bok: 4, hmotnost: 2.3, tara: 0.45 },
    { id: 'velka3kg', nazev: 'Velká 3 kg', otvor: 52, prumer: 300, sirka: 100, bok: 4, hmotnost: 3, tara: 0.6 },
  ];
  /** Šrouby: d, hlava ISO 4017 k, samojistná matice ISO 7040 mn, podložka ISO 7089 Dp × tp. */
  const SROUBY = {
    M3: { d: 3, k: 2, mn: 4, Dp: 7, tp: 0.5 }, M4: { d: 4, k: 2.8, mn: 5, Dp: 9, tp: 0.8 }, M5: { d: 5, k: 3.5, mn: 5, Dp: 10, tp: 1 },
    M6: { d: 6, k: 4, mn: 6, Dp: 12, tp: 1.6 }, M8: { d: 8, k: 5.3, mn: 8, Dp: 16, tp: 1.6 }, M10: { d: 10, k: 6.4, mn: 10, Dp: 20, tp: 2 },
    M12: { d: 12, k: 7.5, mn: 12, Dp: 24, tp: 2.5 },
  };
  const DELKY = [6, 8, 10, 12, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100];
  /** Spojky PTFE (pneumatické rychlospojky na trubičku 4 mm): průměr předvrtu pro závit, který si spojka vyřízne / dořízne závitníkem. */
  const SPOJKY = { zadna: { nazev: 'bez spojky' }, M6: { nazev: 'spojka se závitem M6', dira: 5, delka: 6 }, M10: { nazev: 'spojka se závitem M10 × 1', dira: 9, delka: 7 } };
  const RADY = ['mini', 'MR', '618', '619', '160', '60', '62'];
  const LOZISKA = LJ.LOZISKA.filter(l => RADY.includes(l.rada) && l.D <= 47);
  const PODLE_OZN = new Map(LOZISKA.map(l => [l.o, l]));
  const CASTA = ['608', '6000', '6001', '623', '624', '625', '626', '688', '6200'];
  /** Hustota filamentu (g/cm³) pro odhad zbytku na cívce. */
  const FILAMENTY = { PLA: 1.24, PETG: 1.27, ABS: 1.04, ASA: 1.07, TPU: 1.21, PA: 1.14, PC: 1.2 };
  /** Závit průchodky: stoupání 2 mm, boky 45° (tiskne se nastojato bez podpor), hloubka 0,9 mm. */
  const ZAVIT = { p: 2, h: 0.9, bok: 45 };
  /** Rybinový zámek lišty: délka, šířka krčku a konce jako podíl šířky lišty. */
  const ZAMEK = { delka: 4, krk: 0.45, konec: 0.68 };

  const NAZVY = {
    druh: { redukce: 'redukce otvoru cívky', stojan: 'stojan s ložisky', vodidlo: 'vodítko filamentu' },
    ulozeni: { lozisko: 'kuličkové ložisko', trn: 'kluzně na trnu (tyči)' },
    sevreni: { hladke: 'hladký válec', zebra: 'drtivá žebra', pera: 'pružná pera s výstupkem' },
    spoj: { zamek: 'lišty s rybinovým zámkem', tyc: 'závitové tyče M8' },
    vtyp: { ocko: 'očko', ptfe: 'nástavec pro PTFE trubičku', kladka: 'kladka s ložiskem', pruchodka: 'průchodka stěnou boxu' },
    uchyt: { deska: 'deska se šrouby', profil: 'na profil 2020 (drážka 6 mm)', klip: 'C-klip na plech / rám' },
    spojAB: { bajonet: 'bajonet (pootočením)', treni: 'jen tření (lepidlo)' },
    pojistka: { matice: 'tištěná matice se závitem', priruba: 'protipříruba se 3 šrouby M3' },
    tesneni: { oring: 'O-kroužek v čelní drážce', zadne: 'bez těsnění' },
    stena: { bok: 'bokem (vodorovně)', viko: 'víkem (svisle)' },
    spojka: Object.fromEntries(Object.entries(SPOJKY).map(([k, v]) => [k, v.nazev])),
  };

  const VYCHOZI = {
    verze: 1, nazev: 'Redukce cívky na 608', diry: 'kapka', druh: 'redukce',
    civka: { otvor: 53, prumer: 200, sirka: 68, bok: 3, hmotnost: 1, tara: 0.25 },
    ulozeni: { typ: 'lozisko', lozisko: '608', d: 8, D: 22, B: 7, vule: 0.1, osazeni: 0.8, trn: 8, vuleTrnu: 0.4 },
    redukce: {
      vule: 0.3, hloubka: 16, priruba: 6, tPriruby: 2.5, stena: 2.4, odlehceni: true, paprsku: 5,
      sevreni: 'zebra', zeber: 8, vyskaZebra: 0.5, per: 6, presahPer: 0.5, delkaPer: 10,
      dvoudilna: false, prekryv: 10, vuleSpoje: 0.25, kusu: 2, spojAB: 'bajonet',
    },
    stojan: { uhel: 35, vule: 5, tloustka: 10, spoj: 'zamek', civek: 1, mezera: 2, lista: 16, vyskaListy: 10, vuleZamku: 0.2 },
    vodidlo: {
      typ: 'ocko', uchyt: 'deska', filament: 1.75, ocko: 4, ptfe: 4, vulePtfe: 0.15, spojka: 'M6',
      vyska: 40, sirka: 14, tloustka: 5, der: 2, dira: 4.5, roztec: 30, kladka: 24,
      plech: 2, stenaTl: 4, pojistka: 'matice', tesneni: 'oring', oring: 2, stena: 'bok', vuleZavitu: 0.3,
    },
    tisk: { material: 'PETG', vrstva: 0.2, uhel: 45, podlozkaX: 220, podlozkaY: 220, krokKalibrace: 0.05 },
    mech: { ohyb: 30, muKluz: 0.3, zmerenyPrumer: 0, zmerenaHmotnost: 0, filMaterial: 'PLA', filPrumer: 1.75 },
  };
  const MEZE = {
    'civka.otvor': [15, 160], 'civka.prumer': [60, 420], 'civka.sirka': [15, 200], 'civka.bok': [1, 12], 'civka.hmotnost': [0, 10], 'civka.tara': [0, 3],
    'ulozeni.d': [2, 40], 'ulozeni.D': [5, 80], 'ulozeni.B': [2, 30], 'ulozeni.vule': [-0.4, 0.8], 'ulozeni.osazeni': [0.3, 4],
    'ulozeni.trn': [2, 40], 'ulozeni.vuleTrnu': [0, 2],
    'redukce.vule': [-0.6, 3], 'redukce.hloubka': [4, 120], 'redukce.priruba': [0, 60], 'redukce.tPriruby': [1, 12], 'redukce.stena': [1.2, 10],
    'redukce.paprsku': [3, 12, 1], 'redukce.zeber': [3, 36, 1], 'redukce.vyskaZebra': [0.2, 2], 'redukce.per': [3, 16, 1],
    'redukce.presahPer': [0.1, 2], 'redukce.delkaPer': [4, 60], 'redukce.prekryv': [4, 40], 'redukce.vuleSpoje': [0, 1], 'redukce.kusu': [1, 8, 1],
    'stojan.uhel': [10, 70], 'stojan.vule': [1, 60], 'stojan.tloustka': [5, 30], 'stojan.civek': [1, 4, 1], 'stojan.mezera': [0.5, 10],
    'stojan.lista': [10, 40], 'stojan.vyskaListy': [6, 25], 'stojan.vuleZamku': [0, 0.8],
    'vodidlo.filament': [1, 3.5], 'vodidlo.ocko': [1.5, 15], 'vodidlo.ptfe': [2, 10], 'vodidlo.vulePtfe': [-0.2, 0.8],
    'vodidlo.vyska': [10, 200], 'vodidlo.sirka': [5, 40], 'vodidlo.tloustka': [2, 15], 'vodidlo.der': [1, 2, 1], 'vodidlo.dira': [2, 12],
    'vodidlo.roztec': [8, 150], 'vodidlo.kladka': [8, 80],
    'tisk.vrstva': [0.05, 0.5], 'tisk.uhel': [20, 75], 'tisk.podlozkaX': [60, 1000], 'tisk.podlozkaY': [60, 1000], 'tisk.krokKalibrace': [0.02, 0.2],
    'mech.ohyb': [0, 180], 'mech.muKluz': [0.05, 0.8], 'mech.zmerenyPrumer': [0, 420], 'mech.zmerenaHmotnost': [0, 15000],
    'vodidlo.plech': [0.5, 10], 'vodidlo.stenaTl': [0.5, 30], 'vodidlo.oring': [1, 5], 'vodidlo.vuleZavitu': [0, 1],
  };
  const VYCTY = {
    diry: ['kapka', 'kruh'], druh: Object.keys(NAZVY.druh),
    'ulozeni.typ': Object.keys(NAZVY.ulozeni), 'ulozeni.lozisko': LOZISKA.map(l => l.o).concat('vlastni'),
    'redukce.sevreni': Object.keys(NAZVY.sevreni), 'stojan.spoj': Object.keys(NAZVY.spoj),
    'vodidlo.typ': Object.keys(NAZVY.vtyp), 'vodidlo.uchyt': Object.keys(NAZVY.uchyt), 'vodidlo.spojka': Object.keys(SPOJKY),
    'tisk.material': Object.keys(MATERIALY), 'redukce.spojAB': Object.keys(NAZVY.spojAB),
    'vodidlo.pojistka': Object.keys(NAZVY.pojistka), 'vodidlo.tesneni': Object.keys(NAZVY.tesneni), 'vodidlo.stena': Object.keys(NAZVY.stena),
    'mech.filMaterial': Object.keys(FILAMENTY), 'mech.filPrumer': [1.75, 2.85],
  };

  /** Předvolby (skupina = druh) – jen odchylky od výchozího projektu; tisk zůstává uživatelův. */
  const PREDVOLBY = [
    { id: 'redukce608', skupina: 'Redukce otvoru cívky', nazev: 'Cívka 1 kg (otvor 53) → ložisko 608', popis: '2 kusy, drtivá žebra, odlehčená s 5 paprsky, na tyč M8', p: {} },
    { id: 'redukceTrn', skupina: 'Redukce otvoru cívky', nazev: 'Cívka 1 kg → trn Ø 8 kluzně', popis: 'bez ložiska, otvor 8,4 – nejjednodušší, víc brzdí', p: { nazev: 'Redukce cívky na trn 8', ulozeni: { typ: 'trn', trn: 8 } } },
    { id: 'redukcePera', skupina: 'Redukce otvoru cívky', nazev: 'Pružná pera – otvor 55–58', popis: 'pera s výstupkem zacvaknou do otvoru 57 mm, ložisko 608', p: { nazev: 'Redukce s pery', civka: { otvor: 57, sirka: 65 }, redukce: { sevreni: 'pera', hloubka: 18, vule: 0.4 } } },
    { id: 'redukce74', skupina: 'Redukce otvoru cívky', nazev: 'Otvor 73–75 → ložisko 6001', popis: 'větší ložisko na trn 12 mm', p: { nazev: 'Redukce 74 na 6001', civka: { otvor: 74, sirka: 65 }, ulozeni: { lozisko: '6001' }, redukce: { paprsku: 6 } } },
    { id: 'redukceKarton', skupina: 'Redukce otvoru cívky', nazev: 'Kartonová / refill 102 – dvoudílná', popis: 'díly A + B sevřou cívku mezi přírubami, 608 v obou', p: { nazev: 'Redukce kartonové cívky', civka: { otvor: 102, sirka: 65, bok: 4, tara: 0.15 }, redukce: { dvoudilna: true, priruba: 10, paprsku: 6, kusu: 1, sevreni: 'zebra' } } },
    { id: 'redukceMala', skupina: 'Redukce otvoru cívky', nazev: 'Malá cívka 250 g (otvor 32) → trn 12', popis: 'plná redukce bez odlehčení', p: { nazev: 'Redukce malé cívky', civka: { otvor: 32, prumer: 140, sirka: 45, bok: 2.5, hmotnost: 0.25, tara: 0.08 }, ulozeni: { typ: 'trn', trn: 12 }, redukce: { hloubka: 12, odlehceni: false } } },
    { id: 'stojan1kg', skupina: 'Stojan na cívku s ložisky', nazev: 'Stojan 1 kg – lišty se zámkem', popis: 'Ø 200 × 68, 4× 608 na šroubech M8, cívka 5 mm nad stolem', p: { nazev: 'Stojan na cívku 1 kg', druh: 'stojan' } },
    { id: 'stojanTyc', skupina: 'Stojan na cívku s ložisky', nazev: 'Stojan 1 kg – závitové tyče M8', popis: 'bočnice spojené 2 tyčemi M8 s maticemi', p: { nazev: 'Stojan na tyčích M8', druh: 'stojan', stojan: { spoj: 'tyc' } } },
    { id: 'stojanBox', skupina: 'Stojan na cívku s ložisky', nazev: 'Do sušicího boxu – 2 cívky vedle sebe', popis: 'nízký stojan, 3 bočnice, 8× 608', p: { nazev: 'Stojan do sušicího boxu', druh: 'stojan', stojan: { civek: 2, uhel: 40, vule: 3, tloustka: 12 } } },
    { id: 'stojan3kg', skupina: 'Stojan na cívku s ložisky', nazev: 'Stojan 3 kg (Ø 300 × 100)', popis: 'široké bočnice, 4× 608, na podložku 220 × 220', p: { nazev: 'Stojan na cívku 3 kg', druh: 'stojan', civka: { prumer: 300, sirka: 100, bok: 4, hmotnost: 3, tara: 0.6, otvor: 52 }, stojan: { uhel: 32, lista: 18, vyskaListy: 12 } } },
    { id: 'stojanMini', skupina: 'Stojan na cívku s ložisky', nazev: 'Stojan 3 kg z malé tiskárny 120 × 120', popis: 'bočnice z půlek, lišty ze dvou dílů se zámkem', p: { nazev: 'Stojan 3 kg z malé tiskárny', druh: 'stojan', civka: { prumer: 300, sirka: 100, bok: 4, hmotnost: 3, tara: 0.6, otvor: 52 }, stojan: { uhel: 32 }, tisk: { podlozkaX: 120, podlozkaY: 120 } } },
    { id: 'ocko', skupina: 'Vodítko filamentu', nazev: 'Očko na desku – 2 vruty', popis: 'očko Ø 4 se sražením, výška 40 mm', p: { nazev: 'Vodítko – očko', druh: 'vodidlo' } },
    { id: 'ocko2020', skupina: 'Vodítko filamentu', nazev: 'Očko na profil 2020', popis: 'klíček do drážky 6 mm, šroub M5 s T-maticí', p: { nazev: 'Vodítko na profil 2020', druh: 'vodidlo', vodidlo: { uchyt: 'profil', dira: 5.5 } } },
    { id: 'ptfe', skupina: 'Vodítko filamentu', nazev: 'Nástavec PTFE 4 mm se spojkou M6', popis: 'trubička 4/2 mm do rychlospojky, filament 1,75', p: { nazev: 'Nástavec PTFE', druh: 'vodidlo', vodidlo: { typ: 'ptfe' } } },
    { id: 'kladka', skupina: 'Vodítko filamentu', nazev: 'Kladka s ložiskem 623', popis: 'kladka Ø 24 s V drážkou, šroub M3', p: { nazev: 'Vodítko – kladka', druh: 'vodidlo', vodidlo: { typ: 'kladka', vyska: 34 }, ulozeni: { typ: 'lozisko', lozisko: '623', osazeni: 0.8 } } },
    { id: 'ockoStojan', skupina: 'Vodítko filamentu', nazev: 'Očko na stojan (pod šroub M8)', popis: 'jedna díra 8,4 – nasadí se pod matici osy ložiska', p: { nazev: 'Očko na stojan', druh: 'vodidlo', vodidlo: { der: 1, dira: 8.4, vyska: 50 } } },
    { id: 'pruchodkaBok', skupina: 'Vodítko filamentu', nazev: 'Průchodka bokem sušičky – matice', popis: 'stěna 4 mm, O-kroužek, spojka M6 zvenku, tištěná matice', p: { nazev: 'Průchodka sušičky', druh: 'vodidlo', vodidlo: { typ: 'pruchodka' } } },
    { id: 'pruchodkaViko', skupina: 'Vodítko filamentu', nazev: 'Průchodka víkem boxu – protipříruba', popis: 'víko 2 mm, protipříruba se 3 šrouby M3, O-kroužek', p: { nazev: 'Průchodka víkem', druh: 'vodidlo', vodidlo: { typ: 'pruchodka', pojistka: 'priruba', stenaTl: 2, stena: 'viko' } } },
    { id: 'klip', skupina: 'Vodítko filamentu', nazev: 'Očko s C-klipem na plech 2 mm', popis: 'nasune se na hranu plechu nebo rámu, bez šroubů', p: { nazev: 'Očko na plech', druh: 'vodidlo', vodidlo: { uchyt: 'klip', plech: 2, vyska: 34 } } },
    { id: 'ptfe285', skupina: 'Vodítko filamentu', nazev: 'PTFE 6/4 mm pro filament 2,85', popis: 'trubička 6 mm bez spojky, očko pro 2,85', p: { nazev: 'Nástavec PTFE 2,85', druh: 'vodidlo', vodidlo: { typ: 'ptfe', filament: 2.85, ptfe: 6, spojka: 'zadna', sirka: 16 } } },
  ];

  /* ---------------- normalizace a projekt ---------------- */
  const normalizuj = v => G.normalizuj(v, { VYCHOZI, MEZE, VYCTY });
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(G.slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }
  function popis(p) {
    const o = odvozene(p);
    if (p.druh === 'stojan') return `stojan · cívka Ø ${fmt(p.civka.prumer)} × ${fmt(p.civka.sirka)} · ${p.stojan.civek}× · ${o.L.o} · ${NAZVY.spoj[p.stojan.spoj]}`;
    if (p.druh === 'vodidlo') return `vodítko · ${NAZVY.vtyp[p.vodidlo.typ]} · filament ${fmt(p.vodidlo.filament, 2)} · ${NAZVY.uchyt[p.vodidlo.uchyt]}`;
    return `redukce · otvor ${fmt(p.civka.otvor)} → ${o.L ? o.L.o : 'trn Ø ' + fmt(p.ulozeni.trn)}${p.redukce.dvoudilna ? ' · dvoudílná' : ''}`;
  }
  const TYP = 'civka_filamentu';
  const ulozProjekt = p => G.projektJson(TYP, p, 1);
  const nactiProjekt = text => G.nactiProjektJson(text, TYP, normalizuj, 'Držák a adaptér cívky');

  /* ---------------- pomocné ---------------- */
  function lozisko(p) {
    const u = p.ulozeni;
    if (u.lozisko !== 'vlastni' && PODLE_OZN.has(u.lozisko)) return PODLE_OZN.get(u.lozisko);
    return { o: `vlastní ${fmt(u.d)}×${fmt(u.D)}×${fmt(u.B)}`, rada: 'vlastni', d: u.d, D: u.D, B: u.B, C: null, C0: null };
  }
  const sroubNa = d => Object.keys(SROUBY).find(k => SROUBY[k].d === d) || null;
  const delkaSroubu = l => DELKY.find(x => x >= l - 0.01) || Math.ceil(l / 10) * 10;
  const segmenty = r => Math.max(32, Math.min(160, Math.ceil(2 * Math.PI * r / 0.9 / 4) * 4));
  const kruh = (r, cx = 0, cy = 0, n) => { const m = n || segmenty(r), b = []; for (let i = 0; i < m; i++) { const a = 2 * Math.PI * i / m; b.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return b; };
  const plocha = b => { let s = 0; for (let i = 0, j = b.length - 1; i < b.length; j = i++) s += b[j][0] * b[i][1] - b[i][0] * b[j][1]; return s / 2; };
  const ccw = b => (plocha(b) < 0 ? b.slice().reverse() : b);
  function obalka2(b) {
    const q = b.slice().sort((a, c) => a[0] - c[0] || a[1] - c[1]), x = (o, a, c) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]);
    const d = [], h = [];
    for (const t of q) { while (d.length >= 2 && x(d[d.length - 2], d[d.length - 1], t) <= 0) d.pop(); d.push(t); }
    for (const t of q.reverse()) { while (h.length >= 2 && x(h[h.length - 2], h[h.length - 1], t) <= 0) h.pop(); h.push(t); }
    return d.slice(0, -1).concat(h.slice(0, -1));
  }
  /** Rybina v rovině: u = vzdálenost od krčku ven, polovina šířky hw(u) lineárně z krčku (wn) na konec (we, u = l). */
  function rybina(wn, we, l, u0, u1, prid = 0) {
    const hw = u => wn / 2 + (we - wn) / 2 * u / l + prid;
    return [[u0, -hw(u0)], [u1, -hw(u1)], [u1, hw(u1)], [u0, hw(u0)]];
  }
  /** Vejde se obdélník a × b na podložku (i otočený o 90°)? */
  const naPodlozku = (a, b, p) => (a <= p.tisk.podlozkaX + 1e-6 && b <= p.tisk.podlozkaY + 1e-6) || (a <= p.tisk.podlozkaY + 1e-6 && b <= p.tisk.podlozkaX + 1e-6);

  /* ---------------- odvozené rozměry ---------------- */
  function odvozene(p) {
    const o = { druh: p.druh }, u = p.ulozeni, c = p.civka;
    o.L = (p.druh === 'stojan' || u.typ === 'lozisko') ? lozisko(p) : null;
    o.Rc = c.prumer / 2;
    o.rPlna = c.prumer / 2 - c.bok;                      // poloměr navinutí – plná cívka
    o.rPrazdna = Math.min(o.rPlna, c.otvor / 2 + 6);       // prázdná cívka (jádro)
    if (p.druh === 'redukce') redukceRozmery(p, o);
    else if (p.druh === 'stojan') stojanRozmery(p, o);
    else vodidloRozmery(p, o);
    return o;
  }
  function redukceRozmery(p, o) {
    const r = p.redukce, u = p.ulozeni, c = p.civka;
    o.R = (c.otvor - r.vule) / 2; o.Rp = c.otvor / 2 + r.priruba; o.tp = r.tPriruby;
    o.cHrana = 1; o.cPriruba = Math.min(0.8, o.tp / 3);
    if (o.L) {
      const L = o.L;
      o.rk = (L.D + u.vule) / 2;                         // kapska ložiska (otevřená k podložce)
      o.rl = Math.max(L.D / 2 - u.osazeni, L.d / 2 + 1.2); // osazení – opírá vnější kroužek
      o.rb = L.d / 2 + 1;                                // průchod tyče nad ložiskem (volně)
      o.zKap = L.B; o.zKon = L.B + (o.rl - o.rb);       // strop kapsy: osazení + kužel 45°
      o.rIn = o.rk;
    } else {
      o.rb = (u.trn + u.vuleTrnu) / 2; o.rk = o.rl = o.rb; o.zKap = 0; o.zKon = 0; o.rIn = o.rb;
    }
    o.rt = o.rIn + r.stena;                              // vnitřní trubka
    o.rc = o.R - r.stena;                                // vnější stěna zevnitř
    o.dute = (r.odlehceni || r.sevreni === 'pera' || r.dvoudilna) && o.rc - o.rt >= 2;
    o.sevreni = r.sevreni;
    if (r.dvoudilna) {
      o.LA = c.sirka / 2 + r.prekryv / 2; o.LB = c.sirka / 2 - r.prekryv / 2;
      o.HA = o.tp + o.LA; o.HB = o.tp + o.LB; o.HBs = o.HB + r.prekryv - 0.3; o.rs = o.rc - r.vuleSpoje;
      o.H = o.HA;
      // bajonet: výstupky na koncích paprsků B (spodní plocha 45°), drážky ve tvaru L v plášti A (strop 45°)
      const v = r.vuleSpoje, ro = o.R - 0.4, hl = ro - o.rs + 1.5, wl = Math.min(4, Math.max(2.4, r.stena + 1));
      const zt = o.HBs - 1, zc = zt - hl, K = c.sirka + 2 * o.tp;
      o.bajonet = { v, ro, hl, wl, zt, zc, K, ri: o.rs - 1.5, pulka: (wl / 2 + v) / o.rc * 180 / Math.PI, uhel: (wl + 2 * v + 1.5) / o.rc * 180 / Math.PI };
    } else o.H = o.tp + r.hloubka;
    o.zebraVyska = r.vyskaZebra;
    o.zPer = o.H - r.delkaPer;
  }
  function stojanRozmery(p, o) {
    const s = p.stojan, u = p.ulozeni, c = p.civka, L = o.L;
    o.rl = L.D / 2; o.d = L.d; o.M = sroubNa(L.d);
    o.rOsa = (L.d + u.vuleTrnu) / 2; o.rBoss = o.rOsa + 5.5;
    const a = rad(s.uhel);
    o.e = (o.Rc + o.rl) * Math.sin(a); o.hz = (o.Rc + o.rl) * Math.cos(a);
    o.t = s.tloustka; o.ld = ZAMEK.delka; o.wn = s.lista * ZAMEK.krk; o.we = s.lista * ZAMEK.konec;
    o.krouzek = 1.5;                                    // distanční krouzek mezi bočnicí a ložiskem
    o.rTyc = 4.2; o.zr = o.rTyc + 4.5;
    const top = s.spoj === 'zamek' ? s.vyskaListy : o.zr + 4;
    const y0 = s.spoj === 'zamek' ? o.e - s.lista / 2 : o.e - 4;
    const zlMin = s.spoj === 'zamek' ? s.vyskaListy + s.vuleZamku + 2 + o.rOsa : o.zr + o.rTyc + 2.5 + o.rOsa;
    const pod = y => (Math.abs(y) < o.Rc ? Math.sqrt(o.Rc * o.Rc - y * y) : 0);
    let zl = Math.max(zlMin, o.rl + 3, o.rBoss, s.vule + o.Rc - o.hz, 5 + o.Rc - o.hz, top + s.vule + pod(y0) - o.hz);
    o.sirkaDesky = 2 * (o.e + o.rBoss);
    o.deleni = !naPodlozku(o.sirkaDesky, zl + o.rBoss, p);
    if (o.deleni) zl = Math.max(zl, 16 + o.Rc - o.hz);
    o.zl = zl; o.zc = zl + o.hz; o.vyskaDesky = zl + o.rBoss; o.hs = o.zc - o.Rc;
    o.vuleStul = o.zc - o.Rc;                           // cívka nad stolem
    o.vuleLista = o.zc - pod(y0) - top;                 // cívka nad lištou / tyčí
    o.top = top; o.y0 = y0;
    o.P = c.sirka + 2 * s.mezera + o.t;                 // rozteč bočnic
    o.desek = s.civek + 1;
    o.X = Array.from({ length: o.desek }, (_, i) => (i - s.civek / 2) * o.P);
    o.Lb = c.sirka + 2 * s.mezera;                      // lišta mezi bočnicemi
    const Lmax = Math.max(p.tisk.podlozkaX, p.tisk.podlozkaY) - 10;
    let n = 1; while (o.Lb / n + 2 * o.ld + 1 > Lmax && n < 12) n++;
    o.segmentu = n; o.lSeg = o.Lb / n;
    o.pulDesky = o.e + o.rBoss + o.ld + 1;               // šířka poloviny bočnice při dělení
    o.loziska = 4 * s.civek;
    const S = SROUBY[o.M] || { k: 0.7 * L.d, mn: L.d, tp: 1.6, Dp: 2 * L.d };
    o.lOsaKraj = delkaSroubu(S.tp + o.t + o.krouzek + L.B + S.tp + S.mn + 1.5);
    o.lOsaStred = delkaSroubu(2 * (S.tp + L.B + o.krouzek) + o.t + S.mn + 1.5);
    o.lTyc = Math.ceil((s.civek * o.P + o.t + 2 * (1.6 + 6.5 + 2)) / 10) * 10;
  }
  function vodidloRozmery(p, o) {
    const v = p.vodidlo, u = p.ulozeni;
    o.w = v.sirka; o.tb = v.tloustka; o.tpost = v.tloustka; o.H = v.vyska; o.f = v.filament;
    if (v.typ === 'pruchodka') { pruchodkaRozmery(p, o); return; }
    if (v.typ === 'ocko') { o.rH = v.ocko / 2; o.re = o.rH + 4; }
    else if (v.typ === 'ptfe') {
      const S = SPOJKY[v.spojka];
      o.rPtfe = (v.ptfe + v.vulePtfe) / 2; o.rFil = (v.filament + 0.8) / 2;
      o.rS = S.dira ? S.dira / 2 : 0; o.lS = S.delka || 0;
      o.hPtfe = S.dira ? Math.min(4, o.w - o.lS - 2) : o.w - 2;   // hloubka kapsy pro trubičku (za spojkou)
      o.rH = Math.max(o.rS, o.rPtfe); o.re = o.rH + 3;
    } else {
      o.osa = o.L ? o.L.d : u.trn;                       // šroub osy kladky
      o.rOsa = (o.osa + 0.3) / 2; o.re = o.rOsa + 4; o.rH = o.rOsa;
      o.Rk = v.kladka / 2; o.gv = v.filament * 0.6 + 0.6;   // V drážka 90°
      o.tk = o.L ? o.L.B + 1.2 : Math.max(4, 2 * o.gv + 2.4);
      o.mezeraK = 0.5;
      if (o.L) { o.rk = (o.L.D + u.vule) / 2; o.rr = Math.max(o.L.D / 2 - u.osazeni, o.L.d / 2 + 1); }
      else { o.rk = o.rr = (u.trn + u.vuleTrnu) / 2; }
    }
    o.rD = v.dira / 2;
    o.klip = null;
    if (v.uchyt === 'klip') {
      // C-klip: horní čelist = deska, zadní stěna vlevo, spodní čelist s výstupkem; mezera o 0,2 mm užší než plech (svírá)
      o.diry = []; o.x0 = -(o.tpost / 2 + 10); o.x1 = o.tpost / 2 + 12;
      o.klip = { g: Math.max(0.3, v.plech - 0.2), tz: Math.max(2, o.tb), Lj: o.x1 - o.x0 - 3, vystupek: 0.5 };
    } else if (v.uchyt === 'deska' && v.der === 2) {
      o.diry = [-v.roztec / 2, v.roztec / 2];
      o.x0 = -v.roztec / 2 - o.rD - 4; o.x1 = v.roztec / 2 + o.rD + 4;
    } else {
      const xh = -(o.tpost / 2 + Math.max(o.rD + 3, v.dira + 2.5));
      o.diry = [xh]; o.x0 = xh - o.rD - 4; o.x1 = o.tpost / 2 + 8;
    }
    o.klic = v.uchyt === 'profil' ? { sirka: 6, hloubka: 1.8 } : null;
    // výztuhy 45° mezi deskou a sloupkem – nesmí zakrýt díry
    const volno = s => {
      let m = s > 0 ? o.x1 - o.tpost / 2 : -o.x0 - o.tpost / 2;
      for (const x of o.diry) if (Math.sign(x) === s) m = Math.min(m, Math.abs(x) - o.rD - (v.dira + 4) / 2 - o.tpost / 2);
      return m;
    };
    o.vyztuha = [-1, 1].map(s => Math.max(0, Math.min(volno(s) - 1, o.H - o.re - o.tb - 1, 15)));
  }

  /** Průchodka stěnou: trubka s přírubou (čelní drážka pro O-kroužek), PTFE skrz, spojka zvenku, matice / protipříruba zevnitř. */
  function pruchodkaRozmery(p, o) {
    const v = p.vodidlo, S = SPOJKY[v.spojka];
    o.rPtfe = (v.ptfe + v.vulePtfe) / 2; o.rFil = (v.filament + 0.8) / 2;
    o.rS = S.dira ? S.dira / 2 : 0; o.lS = S.delka || 0;
    o.rT = Math.ceil(Math.max(6, Math.max(o.rS, o.rPtfe) + ZAVIT.h + 2)) ;            // vnější poloměr trubky (vrcholy závitu)
    o.tw = v.stenaTl; o.oring = v.tesneni === 'oring' ? v.oring : 0;
    o.hg = 0.75 * o.oring; o.bg = 1.3 * o.oring;
    o.rg0 = o.rT + 1.5; o.rg1 = o.rg0 + o.bg;                                        // čelní drážka O-kroužku
    o.tf = Math.max(3, o.hg + 1.5);                                                  // tloušťka příruby
    o.hn = 6; o.sMat = 2 * Math.ceil(o.rT + 3.5);                                    // matice: výška, šestihran přes plošky
    o.rDer = (o.oring ? o.rg1 : o.rT + 1) + 3.5;                                    // kružnice děr M3 (protipříruba)
    o.rp = v.pojistka === 'priruba' ? o.rDer + 4.2 : Math.max(o.rT + 5, (o.oring ? o.rg1 : o.rT) + 3);
    o.Lt = o.tw + (v.pojistka === 'matice' ? o.hn + 1.5 : o.tf + 1);                 // trubka nad přírubou
    o.H = o.tf + o.Lt;
    o.diraSteny = 2 * o.rT + 0.6;
    o.krouzek = null;
    if (o.oring) {
      let best = null;
      for (const q of LJ.OKROUZKY) {
        if (Math.abs(q.d2 - o.oring) > 0.06) continue;
        if (q.d1 < 2 * o.rg0 - 0.3 || q.d1 > 2 * o.rg0 + 2) continue;
        if (!best || Math.abs(q.d1 - 2 * o.rg0 - 0.5) < Math.abs(best.d1 - 2 * o.rg0 - 0.5)) best = q;
      }
      o.krouzek = best;
    }
    o.diry = []; o.vyztuha = [0, 0];
  }

  /* ---------------- kontroly (bez geometrie) ---------------- */
  function kontroly(p) {
    const H = [], o = odvozene(p), u = p.ulozeni, c = p.civka;
    const chyba = (pole, text, oprava) => H.push({ uroven: 'chyba', pole, text, oprava });
    const var_ = (pole, text, oprava) => H.push({ uroven: 'varovani', pole, text, oprava });
    const info = (pole, text) => H.push({ uroven: 'info', pole, text });
    const opr = (cesta, h, d = 1) => ({ zmeny: { [cesta]: Math.round(h * 10 ** d) / 10 ** d } });
    if (o.L && u.lozisko === 'vlastni' && u.d >= u.D - 1) chyba(['ulozeni.d', 'ulozeni.D'], 'Vnitřní průměr ložiska musí být menší než vnější.', opr('ulozeni.D', u.d + 6));
    if (p.druh === 'redukce') {
      const r = p.redukce;
      if (o.rIn + 1.6 > o.R) chyba(['civka.otvor', 'ulozeni.lozisko', 'ulozeni.trn'], `Do redukce Ø ${fmt(2 * o.R, 1)} se ${o.L ? 'ložisko ' + o.L.o : 'trn'} nevejde – stěna by měla ${fmt(o.R - o.rIn, 1)} mm (aspoň 1,6). Zvolte menší ložisko nebo trn.`,
        o.L ? { zmeny: { 'ulozeni.typ': 'trn', 'ulozeni.trn': Math.min(8, Math.floor(2 * (o.R - 2.4) - 1)) } } : opr('ulozeni.trn', Math.max(2, Math.floor(2 * (o.R - 2) - u.vuleTrnu))));
      else if (o.rIn + r.stena > o.R) var_(['redukce.stena'], `Stěna kolem ${o.L ? 'kapsy ložiska' : 'otvoru'} je jen ${fmt(o.R - o.rIn, 1)} mm.`);
      if (o.L && o.zKon + 1.2 > o.H) chyba(['redukce.hloubka'], `Redukce (${fmt(o.H, 1)} mm) je nižší než kapsa ložiska s osazením (${fmt(o.zKon + 1.2, 1)} mm).`, opr('redukce.hloubka', Math.ceil(o.zKon + 1.2 - o.tp + 1)));
      if (r.priruba < 2) var_(['redukce.priruba'], 'Příruba přečnívá méně než 2 mm – redukce může zapadnout do cívky.', opr('redukce.priruba', 4));
      if (r.vule < 0) var_(['redukce.vule'], `Záporná vůle (${fmt(r.vule, 2)} mm) = nalisování; plastová cívka může prasknout. Raději žebra nebo pera.`, opr('redukce.vule', 0.3, 2));
      if (r.vule > 1.5 && r.sevreni === 'hladke') var_(['redukce.vule', 'redukce.sevreni'], `Vůle ${fmt(r.vule, 1)} mm bez žeber – redukce se bude v otvoru viklat a házet.`, { zmeny: { 'redukce.sevreni': 'zebra' } });
      if (r.sevreni === 'zebra' && r.vyskaZebra < r.vule / 2 + 0.1) var_(['redukce.vyskaZebra', 'redukce.vule'], `Žebra (${fmt(r.vyskaZebra, 2)} mm) nedosáhnou na stěnu otvoru (vůle ${fmt(r.vule / 2, 2)} na poloměr) – zvyšte je.`, opr('redukce.vyskaZebra', r.vule / 2 + 0.3, 2));
      if (r.sevreni === 'pera') {
        if (!o.dute) chyba(['redukce.sevreni', 'redukce.stena'], 'Pera potřebují dutou redukci (mezi otvorem a stěnou aspoň 2 mm) – na tento otvor zvolte žebra.', { zmeny: { 'redukce.sevreni': 'zebra' } });
        if (r.dvoudilna) chyba(['redukce.sevreni', 'redukce.dvoudilna'], 'Dvoudílná redukce se svírá přírubami – pera nemá; zvolte žebra nebo hladký válec.', { zmeny: { 'redukce.sevreni': 'zebra' } });
        if (r.delkaPer > r.hloubka - 3) chyba(['redukce.delkaPer'], `Pera (${fmt(r.delkaPer)} mm) jsou delší než redukce v otvoru – nechte aspoň 3 mm plné stěny u příruby.`, opr('redukce.delkaPer', Math.max(4, r.hloubka - 4)));
        if (r.presahPer < r.vule / 2) var_(['redukce.presahPer'], `Výstupek per (${fmt(r.presahPer, 2)}) je menší než vůle na poloměr (${fmt(r.vule / 2, 2)}) – pera nebudou svírat.`, opr('redukce.presahPer', r.vule / 2 + 0.3, 2));
        if (r.delkaPer < 2 * r.presahPer + o.cHrana + 3) chyba(['redukce.delkaPer'], 'Pera jsou na výstupek příliš krátká.', opr('redukce.delkaPer', Math.ceil(2 * r.presahPer + o.cHrana + 5)));
      }
      if (r.dvoudilna) {
        if (!o.dute) chyba(['redukce.dvoudilna', 'civka.otvor'], `Dvoudílná redukce potřebuje dutinu na zasunutí (mezi ${o.L ? 'kapsou' : 'otvorem'} a stěnou aspoň 2 mm) – otvor ${fmt(c.otvor)} je na to malý.`, { zmeny: { 'redukce.dvoudilna': false } });
        if (r.prekryv > c.sirka - 6) chyba(['redukce.prekryv', 'civka.sirka'], `Překryv dílů (${fmt(r.prekryv)}) je skoro jako šířka cívky (${fmt(c.sirka)}).`, opr('redukce.prekryv', Math.max(4, Math.floor(c.sirka / 3))));
        if (o.L && o.zKon + 1.2 > o.HB) chyba(['civka.sirka', 'redukce.prekryv'], 'Díl B je kratší než kapsa ložiska – zmenšete překryv.', opr('redukce.prekryv', 4));
        if (r.spojAB === 'bajonet' && o.dute) {
          const b = o.bajonet;
          if (r.prekryv < b.hl + 3 + r.vuleSpoje) chyba(['redukce.prekryv'], `Bajonet potřebuje překryv aspoň ${fmt(b.hl + 3 + r.vuleSpoje, 1)} mm (výstupek ${fmt(b.hl, 1)} mm).`, opr('redukce.prekryv', Math.ceil(b.hl + 3.5 + r.vuleSpoje)));
          if (b.uhel + 2 * b.pulka + 2 > 360 / r.paprsku) chyba(['redukce.paprsku'], `Bajonet s ${r.paprsku} výstupky se na obvod nevejde – ubrat paprsky.`, opr('redukce.paprsku', Math.max(3, Math.floor(360 / (b.uhel + 2 * b.pulka + 4))), 0));
          if (o.rc - b.ro > -0.8) chyba(['redukce.stena'], 'Stěna je na zámek bajonetu tenká.', opr('redukce.stena', 2.4));
          info(['redukce.spojAB'], `Bajonet: díl B se zasune výstupky do drážek dílu A a pootočí o ${fmt(b.uhel, 0)}° – zámek drží cívku sevřenou mezi přírubami.`);
        } else info(['redukce.dvoudilna'], 'Díl A a díl B se zasunou proti sobě otvorem cívky – cívku sevřou příruby, díly drží pohromadě třením paprsků (případně kapka lepidla).');
      }
      if (!r.dvoudilna && r.hloubka > c.sirka / 2) var_(['redukce.hloubka', 'civka.sirka'], `Dvě redukce po ${fmt(r.hloubka)} mm se v cívce široké ${fmt(c.sirka)} mm srazí.`, opr('redukce.hloubka', Math.floor(c.sirka / 2 - 2)));
      if (r.odlehceni && !o.dute && !r.dvoudilna && r.sevreni !== 'pera') info(['redukce.odlehceni'], 'Na odlehčení není místo – redukce je plná.');
      if (!naPodlozku(2 * o.Rp, 2 * o.Rp, p)) chyba(['redukce.priruba', 'tisk.podlozkaX'], `Příruba Ø ${fmt(2 * o.Rp)} se nevejde na podložku.`, opr('redukce.priruba', Math.max(0, Math.floor(Math.min(p.tisk.podlozkaX, p.tisk.podlozkaY) / 2 - c.otvor / 2 - 2))));
      info(['civka.otvor'], `Otvor cívky ${fmt(c.otvor)} mm – rozměry cívek jsou typické (stav ${AKTUALIZACE}), ověřte posuvkou. Vůli doladíte kalibračním vzorkem.`);
    } else if (p.druh === 'stojan') {
      const s = p.stojan;
      if (s.uhel < 20) var_(['stojan.uhel'], `Opora ${fmt(s.uhel)}° od svislice je strmá – cívka při trhnutí filamentem snadno vyskočí. Doporučeno 30–45°.`, opr('stojan.uhel', 35, 0));
      if (s.uhel > 55) var_(['stojan.uhel'], `Opora ${fmt(s.uhel)}° – ložiska nesou velkou šikmou sílu a bočnice je široká. Doporučeno 30–45°.`, opr('stojan.uhel', 40, 0));
      if (s.mezera >= o.krouzek + o.L.B || s.mezera + c.bok <= o.krouzek) chyba(['stojan.mezera', 'civka.bok'], `Bok cívky (od ${fmt(s.mezera, 1)} do ${fmt(s.mezera + c.bok, 1)} mm od bočnice) nedosedne na ložisko (${fmt(o.krouzek, 1)}–${fmt(o.krouzek + o.L.B, 1)} mm).`, opr('stojan.mezera', 2));
      else if (s.mezera < o.krouzek || s.mezera + c.bok > o.krouzek + o.L.B) var_(['stojan.mezera', 'civka.bok'], 'Bok cívky leží na ložisku jen zčásti – upravte mezeru u bočnice.', opr('stojan.mezera', Math.max(o.krouzek, Math.min(2, o.krouzek + o.L.B - c.bok))));
      if (!o.M) var_(['ulozeni.lozisko'], `Ložisko s otvorem ${fmt(o.d)} mm nemá metrický šroub – osa bude čep Ø ${fmt(o.d)}.`);
      if (s.spoj === 'zamek') {
        const tMin = (s.civek > 1 ? 2 : 1) * (o.ld + s.vuleZamku) + 2;
        if (o.t < tMin) chyba(['stojan.tloustka'], `Bočnice ${fmt(o.t)} mm je na zámky lišt tenká (aspoň ${fmt(tMin, 1)} mm${s.civek > 1 ? ' – prostřední mají zámky z obou stran' : ''}).`, opr('stojan.tloustka', Math.ceil(tMin)));
        if (o.segmentu > 1) info(['tisk.podlozkaX', 'tisk.podlozkaY'], `Lišta (${fmt(o.Lb, 0)} mm) je delší než podložka – tiskne se z ${o.segmentu} dílů spojených rybinou.`);
      }
      if (s.civek > 1 && s.spoj === 'zamek') info(['stojan.civek'], 'Prostřední bočnice mají zámky z obou stran – kapsy na spodní straně tiskárna přemostí.');
      if (o.deleni) {
        info(['tisk.podlozkaX', 'tisk.podlozkaY'], `Bočnice (${fmt(o.sirkaDesky, 0)} × ${fmt(o.vyskaDesky, 0)} mm) se nevejde na podložku – tiskne se ze dvou půlek s rybinou uprostřed.`);
        if (!naPodlozku(o.pulDesky, o.vyskaDesky, p)) chyba(['stojan.uhel', 'tisk.podlozkaX'], `Ani polovina bočnice (${fmt(o.pulDesky, 0)} × ${fmt(o.vyskaDesky, 0)} mm) se nevejde na podložku – zmenšete úhel opory.`, opr('stojan.uhel', Math.max(10, s.uhel - 8), 0));
      }
      if (s.spoj === 'zamek' && !naPodlozku(o.lSeg + 2 * o.ld, s.lista, p)) chyba(['stojan.lista'], 'Lišta se nevejde na podložku.');
      if (s.spoj === 'tyc' && o.lTyc > 1000) chyba(['stojan.civek'], 'Závitová tyč by byla delší než 1 m.', opr('stojan.civek', 1, 0));
    } else {
      const v = p.vodidlo;
      if (v.typ === 'ocko' && v.ocko < v.filament + 1) var_(['vodidlo.ocko'], `Očko Ø ${fmt(v.ocko, 1)} je na filament ${fmt(v.filament, 2)} těsné – filament bude drhnout.`, opr('vodidlo.ocko', v.filament + 2.2, 1));
      if (v.typ === 'ptfe' || v.typ === 'pruchodka') {
        if (v.ptfe < v.filament + 1) chyba(['vodidlo.ptfe', 'vodidlo.filament'], `Trubička Ø ${fmt(v.ptfe)} (vnější) je na filament ${fmt(v.filament, 2)} malá – pro 1,75 je 4/2 mm, pro 2,85 je 6/4 mm.`, opr('vodidlo.ptfe', v.filament > 2 ? 6 : 4, 0));
        if (o.rS && o.rS < o.rPtfe - 0.05) var_(['vodidlo.spojka', 'vodidlo.ptfe'], 'Trubička je širší než předvrt spojky – zvolte spojku M10 nebo nástavec bez spojky.', { zmeny: { 'vodidlo.spojka': 'M10' } });
        if (v.typ === 'ptfe' && o.hPtfe < 2) chyba(['vodidlo.sirka'], `Nástavec ${fmt(o.w)} mm je na spojku a kapsu trubičky krátký.`, opr('vodidlo.sirka', o.lS + 8, 0));
        if (v.spojka !== 'zadna') info(['vodidlo.spojka'], `Předvrt Ø ${fmt(2 * o.rS, 1)} pro ${SPOJKY[v.spojka].nazev} – spojku zašroubujte opatrně (vyřízne si závit), případně proveďte závitníkem.`);
      }
      if (v.typ === 'kladka') {
        if (o.Rk - o.gv < o.rk + 1.6) chyba(['vodidlo.kladka'], `Kladka Ø ${fmt(v.kladka)} je na ${o.L ? 'ložisko ' + o.L.o : 'osu'} s drážkou malá (stěna ${fmt(o.Rk - o.gv - o.rk, 1)} mm).`, opr('vodidlo.kladka', Math.ceil(2 * (o.rk + o.gv + 2.4))));
        if (o.tk < 2 * o.gv + 1.2) chyba(['ulozeni.lozisko'], 'Kladka je na drážku pro filament tenká – zvolte širší ložisko.');
      }
      if (v.typ === 'pruchodka') {
        info(['vodidlo.stenaTl'], `Do stěny vyvrtejte díru Ø ${fmt(o.diraSteny, 1)} mm (stupňovitý vrták), průchodka se vsune zvenku a ${v.pojistka === 'matice' ? 'zevnitř se dotáhne maticí' : 'zevnitř se přišroubuje protipřírubou'}.`);
        if (o.oring && !o.krouzek) info(['vodidlo.oring'], `O-kroužek Ø ${fmt(2 * o.rg0, 1)} × ${fmt(o.oring, 1)} v katalogu není – použijte nejbližší nebo plochým těsněním.`);
        if (v.stenaTl > 12) var_(['vodidlo.stenaTl'], `Stěna ${fmt(v.stenaTl)} mm je silná – průchodka bude dlouhá, zvažte tenčí místo (víko).`);
        if (!naPodlozku(2 * o.rp, 2 * o.rp, p)) chyba(['vodidlo.oring'], 'Příruba průchodky se nevejde na podložku.');
      } else {
      if (o.H - o.re < o.tb + 1) chyba(['vodidlo.vyska'], `Vodítko je nízké – ${v.typ === 'kladka' ? 'osa' : 'očko'} by zasáhlo do desky.`, opr('vodidlo.vyska', Math.ceil(o.re + o.tb + 3)));
      if (v.typ === 'kladka' && o.H - o.Rk < 1) chyba(['vodidlo.vyska', 'vodidlo.kladka'], `Kladka Ø ${fmt(v.kladka)} by drhla o podklad – zvyšte vodítko.`, opr('vodidlo.vyska', Math.ceil(o.Rk + 3)));
      if (v.uchyt === 'deska' && v.der === 2 && v.roztec < o.tpost + v.dira + 2 * (v.dira + 4) / 2 + 2) chyba(['vodidlo.roztec'], `Díry po ${fmt(v.roztec)} mm by zasáhly sloupek – hlava šroubu se nevejde.`, opr('vodidlo.roztec', Math.ceil(o.tpost + 2 * v.dira + 8)));
      if (v.uchyt === 'profil' && Math.abs(v.dira - 5.5) > 0.6) info(['vodidlo.dira'], 'Na profil 2020 se obvykle používá šroub M5 s T-maticí – díra 5,5 mm.');
      if (o.tb < 3) var_(['vodidlo.tloustka'], 'Deska tenčí než 3 mm se pod šroubem prohne.', opr('vodidlo.tloustka', 4, 0));
      if (p.diry === 'kruh' && o.diry.length) info([], 'Díry pro šrouby leží v tiskové poloze vodorovně – kruhové mají převislý strop; zvolte kapku (👁 Zobrazení → 💧 Díry jako kapka).');
      if (v.uchyt === 'klip') info(['vodidlo.plech'], `C-klip se nasune na plech ${fmt(v.plech, 1)} mm – mezera ${fmt(o.klip.g, 2)} mm svírá, výstupek drží proti vysunutí. Tiskněte z PETG / PA (PLA praská).`);
      }
    }
    if (p.tisk.uhel < 45) info(['tisk.uhel'], `Díly jsou navržené na převis 45°. Při ${fmt(p.tisk.uhel)}° může tisk potřebovat podpory – ukáže je tisková poloha.`);
    if (p.tisk.material === 'PLA' && p.druh !== 'vodidlo') info(['tisk.material'], 'PLA stačí do pokoje; v sušicím boxu (45–65 °C) měkne – tam PETG, ASA nebo PC.');
    return H;
  }

  /* ---------------- geometrie ---------------- */
  /** Otáčení souřadnic dílu (umístění v sestavě); zrcadlo = otočit pořadí vrcholů trojúhelníků. */
  function preved(d, f, zrcadlo) {
    const P = d.poz, out = new Float32Array(P.length);
    for (let i = 0; i < P.length; i += 3) { const q = f(P[i], P[i + 1], P[i + 2]); out[i] = q[0]; out[i + 1] = q[1]; out[i + 2] = q[2]; }
    let idx = d.idx;
    if (zrcadlo) { idx = new Uint32Array(d.idx.length); for (let i = 0; i < idx.length; i += 3) { idx[i] = d.idx[i]; idx[i + 1] = d.idx[i + 2]; idx[i + 2] = d.idx[i + 1]; } }
    return Object.assign({}, d, { poz: out, idx });
  }
  function sit(km, m0, jmeno, nazev, barva) {
    const m = km(m0.simplify(1e-3));
    const st = m.status();
    if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
    if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
    const kusy = m.decompose().map(km);
    return { jmeno, nazev, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), teles: kusy.filter(x => x.volume() > 1e-3).length, barva, otocit: false, ks: 1, umisteni: [], zrcadlo: [] };
  }
  const BARVY = { dil: '#4F86D9', dil2: '#2EAD5B', lista: '#D9A441', kontext: '#8E99A6', loz: '#5B6570', civka: '#E07B39', filament: '#E04F8A', ptfe: '#E8ECEF', kalibrace: '#2EAD5B' };

  /** Sestaví díly přes manifold-3d → {dily, kontext, sestava, kalibrace, o, obrysy, cas}. */
  function postav(w, p, volby = {}) {
    const t0 = Date.now(), o = odvozene(p);
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const km = x => { smaz.push(x); return x; };
    const otoc = (body, n) => km(km(new CS([ccw(body)], 'NonZero')).revolve(n));
    const valec = (r, z0, z1, x = 0, y = 0, n, presne) => { const m = n || segmenty(r), rr = presne ? r : r / Math.cos(Math.PI / m); return km(km(M.cylinder(z1 - z0, rr, rr, m)).translate([x, y, z0])); };
    const hranol = (polys, z0, z1) => km(km(km(new CS(polys.map(ccw), 'NonZero')).extrude(z1 - z0)).translate([0, 0, z0]));
    const kvadr = (x0, y0, z0, x1, y1, z1) => km(km(M.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    const sjednot = a => (a.length === 1 ? a[0] : km(M.union(a)));
    const rozdil = (a, b) => (b.length ? km(M.difference([a, ...b])) : a);
    const tr = (m, v) => km(m.translate(v));
    const ctx = { M, CS, km, otoc, valec, hranol, kvadr, sjednot, rozdil, tr };
    try {
      let vys;
      if (p.druh === 'redukce') vys = postavRedukci(ctx, p, o);
      else if (p.druh === 'stojan') vys = postavStojan(ctx, p, o);
      else vys = postavVodidlo(ctx, p, o);
      const kalibrace = volby.kalibrace ? postavKalibraci(ctx, p, o) : [];
      const sestava = [];
      for (const d of vys.dily) d.umisteni.forEach((f, i) => sestava.push(Object.assign(preved(d, f, d.zrcadlo[i]), { kopie: i })));
      for (const d of vys.kontext) sestava.push(d);
      return { dily: vys.dily, kontext: vys.kontext, sestava, kalibrace, o, obrysy: vys.obrysy || {}, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }
  /** Kontextový díl (jen náhled) z manifoldu v souřadnicích sestavy. */
  function kontextDil(ctx, m, jmeno, nazev, barva) {
    const d = sit(ctx.km, m, jmeno, nazev, barva);
    d.kontext = true; return d;
  }
  /** Cívka (kontext): osa X od x0 do x0 + sirka, střed v (y, z). */
  function civkaModel(ctx, p, x0, z, vyrez) {
    const c = p.civka, R = c.prumer / 2, ro = c.otvor / 2, rj = Math.min(R - 2, ro + 4), rf = Math.max(rj, R - 6), b = c.bok, W = c.sirka;
    const prof = [[ro, 0], [R, 0], [R, b], [rf, b], [rf, W - b], [R, W - b], [R, W], [ro, W]];
    let m = ctx.km(ctx.km(ctx.otoc(prof, segmenty(R)).rotate([0, 90, 0])).translate([x0, 0, z]));
    // výřez horní přední čtvrtiny – v izometrii je vidět redukce v otvoru
    if (vyrez) m = ctx.rozdil(m, [ctx.kvadr(x0 - 1, -R - 1, z, x0 + W + 1, 0, z + R + 1)]);
    return kontextDil(ctx, m, 'civka', vyrez ? 'Cívka (výřez)' : 'Cívka', BARVY.civka);
  }
  /** Ložisko (kontext) s osou X: x0…x0+B, střed (y, z). */
  function loziskoModel(ctx, L, x0, y, z) {
    const m = ctx.otoc([[L.d / 2, 0], [L.D / 2, 0], [L.D / 2, L.B], [L.d / 2, L.B]], segmenty(L.D / 2));
    return kontextDil(ctx, ctx.km(ctx.km(m.rotate([0, 90, 0])).translate([x0, y, z])), 'lozisko', 'Ložisko ' + L.o, BARVY.loz);
  }
  /** Válec s osou X (kontext). */
  function tycX(ctx, r, x0, x1, y, z, jmeno, nazev, barva) {
    const m = ctx.km(ctx.M.cylinder(x1 - x0, r, r, segmenty(r)));
    return kontextDil(ctx, ctx.km(ctx.km(m.rotate([0, 90, 0])).translate([x0, y, z])), jmeno, nazev, barva);
  }

  /* ---------- redukce ---------- */
  /** Řez redukcí (pravá polovina, [r, z]) bez dutin – pro rotaci i výkres. Htop = výška vnějšího pláště. */
  function rezRedukce(o, Htop, Hin) {
    const b = [], c0 = 0.5, cp = o.cPriruba, c = Math.min(o.cHrana, (o.R - o.rIn) / 2);
    // vnitřek: kapsa ložiska od podložky, osazení, kužel 45°, průchod tyče
    const hIn = Hin === undefined ? Htop : Hin;
    b.push([o.rk, 0]);
    if (o.Rp > o.R + 0.01) { b.push([o.Rp - c0, 0], [o.Rp, c0], [o.Rp, o.tp - cp], [o.Rp - cp, o.tp], [o.R, o.tp]); }
    else b.push([o.R - c0, 0], [o.R, c0]);
    b.push([o.R, Htop - c], [o.R - c, Htop]);
    if (hIn > Htop + 1e-6) b.push([o.rt, Htop], [o.rt, hIn]);   // díl B: trn s paprsky přečnívá (trubka zde jen v řezu)
    b.push([o.rb, hIn]);
    if (o.L) b.push([o.rb, o.zKon], [o.rl, o.zKap], [o.rk, o.zKap]);
    return b;
  }
  function postavRedukci(ctx, p, o) {
    const { M, CS, km, otoc, valec, hranol, kvadr, sjednot, rozdil, tr } = ctx;
    const r = p.redukce, c = p.civka, N = segmenty(o.Rp);
    const korekce = rr => rr / Math.cos(Math.PI / N);
    // korekce otvorů na vepsaný mnohoúhelník
    const o2 = Object.assign({}, o, { rk: korekce(o.rk), rl: korekce(o.rl), rb: korekce(o.rb) });
    const paprsky = (r0, r1, z0, z1) => {
      const a = [];
      for (let i = 0; i < r.paprsku; i++) a.push(km(kvadr(r0, -r.stena / 2, z0, r1, r.stena / 2, z1).rotate([0, 0, 360 * i / r.paprsku + 90 / r.paprsku])));
      return a;
    };
    /** Jedno tělo redukce: plášť do Htop, vnitřní trubka + paprsky do Hin (paprsky do rSp); dutina od příruby. */
    function telo(Htop, Hin, rSp, prid) {
      let m = otoc(rezRedukce(o2, Htop, Math.max(Htop, Hin)), N);
      const plus = [], minus = [];
      if (o.dute) {
        const zP = Math.min(Hin, Htop) - (prid.pera ? r.delkaPer + 1 : 0);
        // dutina = mezikruží (rt … rc) od příruby nahoru, bez paprsků
        const dut = km(M.difference([valec(o.rc, o.tp, Htop + 1, 0, 0, N, true), valec(o.rt, o.tp - 1, Htop + 2, 0, 0, N, true), ...paprsky(o.rt - 0.5, o.rc + 0.5, o.tp - 1, zP)]));
        minus.push(dut);
        if (Hin < Htop) minus.push(valec(o.rc, Hin, Htop + 1, 0, 0, N, true));   // díl A: sem zajede trn dílu B
        if (Hin > Htop) plus.push(...paprsky(o.rt - 0.5, rSp, Htop - 0.5, Hin));    // díl B: paprsky trnu přečnívají
      }
      m = rozdil(m, minus);
      if (plus.length) m = sjednot([m, ...plus]);
      if (prid.zebra) {
        const z = [], bw = 2, hz = r.vyskaZebra;
        for (let i = 0; i < r.zeber; i++) {
          const tri = hranol([[[o.R - 0.4, -bw / 2], [o.R + hz, 0], [o.R - 0.4, bw / 2]]], o.tp, Htop - o.cHrana - hz - 0.2);
          z.push(km(tri.rotate([0, 0, 360 * i / r.zeber])));
        }
        m = sjednot([m, ...z]);
      }
      if (prid.pera) {
        const b = r.presahPer, z1 = Htop - o.cHrana - 0.2, z0 = Math.max(o.zPer + 0.5, z1 - 6);
        const vystupek = otoc([[o.R - 0.3, z0], [o.R + b, z0 + b + 0.3], [o.R + b, Math.max(z0 + b + 0.3, z1 - b - 0.3)], [o.R - 0.3, z1]], N);
        m = sjednot([m, vystupek]);
        const sterbiny = [];
        for (let i = 0; i < r.per; i++) sterbiny.push(km(kvadr(o.rc - 1, -0.75, o.zPer, o.R + b + 2, 0.75, Htop + 1).rotate([0, 0, 360 * i / r.per])));
        m = rozdil(m, sterbiny);
      }
      return m;
    }
    // řez osou mezi paprsky (pro výkres): otočit, aby rovina řezu y = 0 neležela na paprsku ani na štěrbině pera
    const rezy = [];
    const rez = m => { rezy.push(km(km(km(m.rotate([0, 0, 90 / r.paprsku])).rotate([-90, 0, 0])).slice(0)).toPolygons().map(b => b.map(q => (Array.isArray(q) ? q : [q.x, q.y])))); return m; };
    const dily = [], kontext = [], S = c.sirka, zOs = o.Rc;
    const vlevo = (x, y, z) => [z - o.tp, x, y + zOs];               // příruba vlevo u x = 0 (bok cívky)
    const vpravo = (x, y, z) => [S + o.tp - z, x, -y + zOs];          // zrcadlově vpravo (otočení, ne zrcadlo)
    const zeb = o.sevreni === 'zebra', per = o.sevreni === 'pera';
    if (r.dvoudilna) {
      let mA = telo(o.HA, o.HA - r.prekryv, o.rc, { zebra: zeb }), mB = telo(o.HB, o.HBs, o.rs, { zebra: zeb });
      let natoc = 0;
      if (r.spojAB === 'bajonet' && o.dute) {
        const b = o.bajonet, v = b.v, n = r.paprsku, Nb = segmenty(o.R);
        // výstupky na koncích paprsků dílu B: řez (r, z) se spodní plochou 45°, protažený tečně o šířku wl
        const prof = [[b.ri, b.zc - (o.rs - b.ri)], [b.ro, b.zc + (b.ro - o.rs)], [b.ro, b.zt], [b.ri, b.zt]];
        const vyst = [];
        for (let i = 0; i < n; i++) {
          const a = 360 * i / n + 90 / n;
          vyst.push(km(km(km(km(km(new CS([ccw(prof)], 'NonZero')).extrude(b.wl)).rotate([90, 0, 0])).translate([0, b.wl / 2, 0])).rotate([0, 0, a])));
        }
        mB = sjednot([mB, ...vyst]);
        // drážky L v plášti dílu A (souřadnice A: z_A = K − z_B, úhel −α): svislý vstup shora + vodorovné rameno se stropem 45°
        const zb = b.K - b.zt - v, strop = rr => b.K - b.zc + v - (rr - o.rs);
        const rameno = [[o.rc - 0.5, zb], [o.R + 1, zb], [o.R + 1, strop(o.R + 1)], [o.rc - 0.5, strop(o.rc - 0.5)]];
        const sloty = [];
        for (let i = 0; i < n; i++) {
          const be = -(360 * i / n + 90 / n);
          sloty.push(km(km(kvadr(o.rc - 0.5, -(b.wl / 2 + v), zb, o.R + 1, b.wl / 2 + v, o.HA + 1)).rotate([0, 0, be])));
          sloty.push(km(km(km(new CS([ccw(rameno)], 'NonZero')).revolve(Nb, b.uhel + 2 * b.pulka)).rotate([0, 0, be - b.pulka])));
        }
        mA = rozdil(mA, sloty);
        natoc = -b.uhel;   // díl B v sestavě pootočený do zamčené polohy
      }
      const A = sit(km, rez(mA), 'redukceA', 'Redukce – díl A', BARVY.dil);
      const B = sit(km, rez(mB), 'redukceB', 'Redukce – díl B', BARVY.dil2);
      A.ks = B.ks = r.kusu;
      const cs = Math.cos(rad(natoc)), sn = Math.sin(rad(natoc));
      A.umisteni = [vlevo]; A.zrcadlo = [false]; B.umisteni = [(x, y, z) => vpravo(x * cs - y * sn, x * sn + y * cs, z)]; B.zrcadlo = [false];
      dily.push(A, B);
    } else {
      const d = sit(km, rez(telo(o.H, o.H, o.rc, { zebra: zeb, pera: per })), 'redukce', 'Redukce', BARVY.dil);
      d.ks = r.kusu;
      d.umisteni = r.kusu >= 2 ? [vlevo, vpravo] : [vlevo]; d.zrcadlo = d.umisteni.map(() => false);
      dily.push(d);
    }
    kontext.push(civkaModel(ctx, p, 0, zOs, true));
    const osa = o.L ? o.L.d : p.ulozeni.trn;
    kontext.push(tycX(ctx, osa / 2 - 0.05, -o.tp - 25, S + o.tp + 25, 0, zOs, 'trn', o.L ? 'Tyč / šroub M' + fmt(osa) : 'Trn Ø ' + fmt(osa), BARVY.kontext));
    if (o.L) {
      kontext.push(loziskoModel(ctx, o.L, -o.tp - 0.03, 0, zOs));
      if (r.dvoudilna || r.kusu >= 2) kontext.push(loziskoModel(ctx, o.L, S + o.tp - o.L.B + 0.03, 0, zOs));
    }
    return { dily, kontext, obrysy: { rezy } };
  }

  /* ---------- stojan ---------- */
  /** Obrys bočnice v rovině (u = y, v = z): obálka podstavy a ok ložisek bez kruhu cívky – pro výkres (2D). */
  function obrysBocnice(o) {
    const b = [[-o.e - o.rBoss, 0], [o.e + o.rBoss, 0]];
    for (const s of [-1, 1]) for (const q of kruh(o.rBoss, s * o.e, o.zl, 48)) b.push(q);
    return obalka2(b);
  }
  function postavStojan(ctx, p, o) {
    const { M, CS, km, valec, hranol, kvadr, sjednot, rozdil, tr } = ctx;
    const s = p.stojan, c = p.civka, L = o.L, t = o.t, vz = s.vuleZamku;
    const Nc = segmenty(o.Rc);
    // ---- bočnice v tiskové poloze: (u, v, w) = (y sestavy, z sestavy, tloušťka); w = 0 vnější strana ----
    const obrys = obrysBocnice(o);
    const telo2D = km(km(new CS([ccw(obrys)], 'NonZero')).subtract(km(new CS([ccw(kruh(o.Rc, 0, o.zc, Nc))], 'NonZero'))));
    const kapsa = (u0, smer) => {
      // kapsa zámku lišty v ploše w = 0 (smer +1, do +w) nebo w = t (smer −1); rybina v rovině (w, u), protažená ve v
      const pol = rybina(o.wn, o.we, o.ld, -1, o.ld + vz, vz).map(([q, y]) => [u0 + y, smer > 0 ? q : t - q]);
      return km(km(km(km(new CS([ccw(pol)], 'NonZero')).extrude(s.vyskaListy + vz + 1)).translate([0, 0, -(s.vyskaListy + vz)])).rotate([90, 0, 0]));
    };
    function bocnice(kapsyPlus, kapsyMinus, cast) {
      // cast: 'cela' | 'leva' | 'prava' (půlka podle u = 0 s rybinou)
      let pl = telo2D;
      if (cast !== 'cela') {
        const W2 = o.e + o.rBoss + 5, H2 = o.vyskaDesky + 5;
        const pul = km(new CS([ccw(cast === 'leva' ? [[-W2, -1], [0, -1], [0, H2], [-W2, H2]] : [[0, -1], [W2, -1], [W2, H2], [0, H2]])], 'NonZero'));
        const wn2 = o.hs * 0.42, we2 = o.hs * 0.66, l2 = 6;
        const jaz = rybina(wn2, we2, l2, -0.5, l2, 0).map(([q, y]) => [q, o.hs / 2 + y]);
        const dut = rybina(wn2, we2, l2, -1, l2 + vz, vz).map(([q, y]) => [q, o.hs / 2 + y]);
        pl = cast === 'leva' ? km(km(pl.intersect(pul)).add(km(new CS([ccw(jaz)], 'NonZero'))))
          : km(km(pl.intersect(pul)).subtract(km(new CS([ccw(dut)], 'NonZero'))));
      }
      let m = km(km(pl.extrude(t)));
      const minus = [];
      for (const sg of [-1, 1]) {
        if (cast === 'leva' && sg > 0) continue;
        if (cast === 'prava' && sg < 0) continue;
        minus.push(valec(o.rOsa, -1, t + 1, sg * o.e, o.zl));
        if (s.spoj === 'tyc') minus.push(valec(o.rTyc, -1, t + 1, sg * o.e, o.zr));
        else { if (kapsyPlus) minus.push(kapsa(sg * o.e, -1)); if (kapsyMinus) minus.push(kapsa(sg * o.e, 1)); }
      }
      return rozdil(m, minus);
    }
    const dily = [], kontext = [];
    const X = o.X, n = s.civek;
    // umístění: tisk (u, v, w) → sestava (x, y, z); levá krajní a prostřední: w = 0 vlevo; pravá krajní zrcadlem (otočením kolem z)
    const doL = Xi => (u, v, w) => [Xi - t / 2 + w, u, v];
    const doP = Xi => (u, v, w) => [Xi + t / 2 - w, -u, v];
    const casti = o.deleni ? ['leva', 'prava'] : ['cela'];
    for (const cast of casti) {
      const jmKraj = { cela: 'Bočnice krajní', leva: 'Bočnice krajní – levá půlka', prava: 'Bočnice krajní – pravá půlka' }[cast];
      const jmStred = { cela: 'Bočnice prostřední', leva: 'Bočnice prostřední – levá půlka', prava: 'Bočnice prostřední – pravá půlka' }[cast];
      const kraj = sit(km, bocnice(s.spoj === 'zamek', false, cast), 'bocnice' + (cast === 'cela' ? '' : '_' + cast), jmKraj, BARVY.dil);
      kraj.ks = 2;
      // pravá krajní je stejný díl otočený o 180° kolem svislice (u → −u): levá půlka pak leží vpravo
      kraj.umisteni = [doL(X[0])]; kraj.zrcadlo = [false];
      dily.push(kraj);
      if (n > 1) {
        const stred = sit(km, bocnice(s.spoj === 'zamek', s.spoj === 'zamek', cast), 'stredni' + (cast === 'cela' ? '' : '_' + cast), jmStred, BARVY.dil2);
        stred.ks = n - 1;
        for (let i = 1; i < n; i++) { stred.umisteni.push(doL(X[i])); stred.zrcadlo.push(false); }
        dily.push(stred);
      }
    }
    // pravá krajní bočnice: tytéž díly otočené – přidat umístění do krajních dílů
    for (const d of dily.filter(x => /^bocnice/.test(x.jmeno))) { d.umisteni.push(doP(X[n])); d.zrcadlo.push(false); }
    // ---- lišty se zámkem ----
    if (s.spoj === 'zamek') {
      const hB = s.vyskaListy, bB = s.lista, l = o.lSeg;
      const jazyk = (xe, smer) => {
        const pol = rybina(o.wn, o.we, o.ld, -0.5, o.ld, 0).map(([q, y]) => [xe + smer * q, y]);
        return hranol([pol], 0, hB);
      };
      const zasuv = x0 => hranol([rybina(o.wn, o.we, o.ld, -1, o.ld + vz, vz).map(([q, y]) => [x0 + q, y])], -1, hB + 1);
      const tyc0 = kvadr(0, -bB / 2, 0, l, bB / 2, hB);
      const prvni = sit(km, sjednot([tyc0, jazyk(0, -1), jazyk(l, 1)]), 'lista', o.segmentu > 1 ? 'Lišta – první díl' : 'Lišta', BARVY.lista);
      prvni.ks = 2 * n;
      dily.push(prvni);
      let dalsi = null;
      if (o.segmentu > 1) {
        dalsi = sit(km, rozdil(sjednot([tyc0, jazyk(l, 1)]), [zasuv(0)]), 'lista2', 'Lišta – další díl', BARVY.lista);
        dalsi.ks = 2 * n * (o.segmentu - 1);
        dily.push(dalsi);
      }
      for (let j = 0; j < n; j++) {
        const xa = X[j] + t / 2;
        for (const sg of [-1, 1]) for (let k = 0; k < o.segmentu; k++) {
          const d = k === 0 ? prvni : dalsi, x0 = xa + k * l;
          d.umisteni.push((x, y, z) => [x + x0, y + sg * o.e, z]); d.zrcadlo.push(false);
        }
      }
    } else {
      for (const sg of [-1, 1]) kontext.push(tycX(ctx, 3.95, X[0] - t / 2 - 10, X[n] + t / 2 + 10, sg * o.e, o.zr, 'tyc', 'Závitová tyč M8', BARVY.kontext));
    }
    // ---- distanční kroužky (mezi bočnicí a ložiskem, opírají vnitřní kroužek) ----
    const rkO = Math.max(L.d / 2 + (L.D - L.d) * 0.15, o.rOsa + 1.2), kr = sit(km, km(M.difference([valec(rkO, 0, o.krouzek, 0, 0, 48, true), valec(o.rOsa, -1, o.krouzek + 1)])), 'krouzek', 'Distanční kroužek', BARVY.dil2);
    kr.ks = o.loziska;
    // ---- ložiska, kroužky a cívky v sestavě ----
    for (let j = 0; j < n; j++) {
      const xa = X[j] + t / 2, xb = X[j + 1] - t / 2;
      for (const sg of [-1, 1]) {
        kontext.push(loziskoModel(ctx, L, xa + o.krouzek, sg * o.e, o.zl));
        kontext.push(loziskoModel(ctx, L, xb - o.krouzek - L.B, sg * o.e, o.zl));
        kr.umisteni.push((x, y, z) => [z + xa, x + sg * o.e, y + o.zl], (x, y, z) => [xb - z, -x + sg * o.e, y + o.zl]);
        kr.zrcadlo.push(false, false);
      }
      kontext.push(civkaModel(ctx, p, xa + s.mezera, o.zc));
    }
    dily.push(kr);
    // obrys bočnice pro výkres: z CrossSection (s kruhem cívky)
    const obrysy = { bocnice: telo2D.toPolygons().map(b => b.map(q => (Array.isArray(q) ? q : [q.x, q.y]))) };
    return { dily, kontext, obrysy };
  }

  /* ---------- vodítko ---------- */
  /** Bokorys vodítka v rovině (x, z): deska, sloupek, oko, výztuhy, klíček – pro geometrii i výkres. */
  function profilVodidla(o) {
    const b = [], t2 = o.tpost / 2;
    b.push([[o.x0, 0], [o.x1, 0], [o.x1, o.tb], [o.x0, o.tb]]);
    b.push([[-t2, 0], [t2, 0], [t2, o.H], [-t2, o.H]]);
    b.push(kruh(o.re, 0, o.H, 64));
    o.vyztuha.forEach((g, i) => { const s = i ? 1 : -1; if (g >= 2) b.push(s > 0 ? [[t2 - 0.01, o.tb - 0.01], [t2 + g, o.tb - 0.01], [t2 - 0.01, o.tb + g]] : [[-t2 - g, o.tb - 0.01], [-t2 + 0.01, o.tb - 0.01], [-t2 + 0.01, o.tb + g]]); });
    if (o.klip) {
      const k = o.klip, zb = -(k.g + k.tz), xj = o.x0 + k.Lj;
      b.push([[o.x0, zb], [o.x0 + k.tz, zb], [o.x0 + k.tz, 0.01], [o.x0, 0.01]]);          // zadní stěna
      b.push([[o.x0, zb], [xj - 1, zb], [xj, zb + 1], [xj, -k.g], [o.x0, -k.g]]);          // spodní čelist se sraženým koncem
      b.push([[xj - 2.6, -k.g - 0.01], [xj - 0.4, -k.g - 0.01], [xj - 1.5, -k.g + k.vystupek]]);   // výstupek proti vysunutí
    }
    if (o.klic) { const x = o.diry[0]; b.push([[x - o.klic.sirka / 2, -o.klic.hloubka], [x + o.klic.sirka / 2, -o.klic.hloubka], [x + o.klic.sirka / 2, 0.01], [x - o.klic.sirka / 2, 0.01]]); }
    return b;
  }
  function postavVodidlo(ctx, p, o) {
    const { M, CS, km, otoc, valec, hranol, kvadr, sjednot, rozdil, tr } = ctx;
    const v = p.vodidlo, w = o.w;
    // tisková poloha: profil v rovině (X = −x, Y = z), protažení Z = y sestavy (0 … w)
    const prof = profilVodidla(o).map(b => b.map(([x, z]) => [-x, z]));
    let m = hranol(prof, 0, w);
    const minus = [];
    // díry pro šrouby (v sestavě svislé, v tisku vodorovné podél Y) – kapka špičkou k +Z tisku
    for (const x of o.diry) {
      const obr = G.obrysDiry(o.rD, 32, p.diry !== 'kruh');
      minus.push(km(km(km(km(new ctx.CS([ccw(obr)], 'NonZero')).extrude(o.tb + 10)).translate([0, 0, -o.tb - 5])).rotate([90, 0, 0])).translate([-x, 0, w / 2]));
    }
    // otvor ve sloupku (v tisku svislý)
    const zH = o.H;
    if (v.typ === 'ocko') {
      const s = Math.min(1.2, o.re - o.rH - 1.6);
      minus.push(valec(o.rH, -1, w + 1, 0, zH));
      minus.push(tr(otoc([[0, -1], [o.rH + s + 1, -1], [o.rH, s], [o.rH, w - s], [o.rH + s + 1, w + 1], [0, w + 1]], 64), [0, zH, 0]));
    } else if (v.typ === 'ptfe') {
      minus.push(valec(o.rFil, -1, w + 1, 0, zH));
      const zS = w - o.lS;
      if (o.rS) minus.push(valec(o.rS, zS, w + 1, 0, zH));
      minus.push(valec(o.rPtfe, zS - o.hPtfe, zS + 0.01, 0, zH));
      minus.push(tr(otoc([[0, -1], [o.rFil + 1.6, -1], [o.rFil, 0.6], [0, 0.6]], 48), [0, zH, 0]));
    } else {
      minus.push(valec(o.rOsa, -1, w + 1, 0, zH));
    }
    m = rozdil(m, minus);
    const dily = [], kontext = [];
    const drz = sit(km, m, 'vodidlo', v.typ === 'kladka' ? 'Držák kladky' : v.typ === 'ptfe' ? 'Nástavec PTFE' : 'Vodítko', BARVY.dil);
    const doS = (X, Y, Z) => [-X, Z, Y];                 // tisk → sestava (x, y, z)
    drz.umisteni = [doS]; drz.zrcadlo = [false];
    dily.push(drz);
    if (v.typ === 'kladka') {
      const Rk = o.Rk, gv = o.gv, tk = o.tk, zc = tk / 2;
      const prof2 = [[o.rr, 0], [Rk - 0.4, 0], [Rk, 0.4], [Rk, zc - gv], [Rk - gv, zc], [Rk, zc + gv], [Rk, tk - 0.4], [Rk - 0.4, tk], [o.rr, tk]];
      let k = otoc(prof2, segmenty(Rk));
      if (o.L) k = rozdil(k, [valec(o.rk, 1.2, tk + 1)]);
      const kl = sit(km, k, 'kladka', 'Kladka', BARVY.dil2);
      const y0 = w + o.mezeraK;
      kl.umisteni = [(x, y, z) => [x, z + y0, -y + zH]]; kl.zrcadlo = [false];
      dily.push(kl);
      if (o.L) kontext.push(kontextDil(ctx, km(km(otoc([[o.L.d / 2, 0], [o.L.D / 2, 0], [o.L.D / 2, o.L.B], [o.L.d / 2, o.L.B]], 48).rotate([-90, 0, 0])).translate([0, y0 + tk - o.L.B, zH])), 'lozisko', 'Ložisko ' + o.L.o, BARVY.loz));
      kontext.push(kontextDil(ctx, km(km(km(M.cylinder(w + tk + 8, o.osa / 2 - 0.1, o.osa / 2 - 0.1, 24)).rotate([-90, 0, 0])).translate([0, -3, zH])), 'sroub', 'Šroub osy', BARVY.kontext));
    } else {
      const rf = v.filament / 2;
      kontext.push(kontextDil(ctx, km(km(km(M.cylinder(w + 80, rf, rf, 16)).rotate([-90, 0, 0])).translate([0, -40, zH])), 'filament', 'Filament', BARVY.filament));
      if (v.typ === 'ptfe') {
        const y0 = w - o.lS - o.hPtfe + 0.05, rt = v.ptfe / 2 - 0.02, ri = Math.max(rf + 0.1, rt - 1);
        kontext.push(kontextDil(ctx, km(km(km(M.difference([km(M.cylinder(w + 40 - y0, rt, rt, 32)), km(km(M.cylinder(w + 42 - y0, ri, ri, 32)).translate([0, 0, -1]))])).rotate([-90, 0, 0])).translate([0, y0, zH])), 'ptfe', 'PTFE trubička', BARVY.ptfe));
      }
    }
    return { dily, kontext, obrysy: { profil: profilVodidla(o) } };
  }

  /* ---------- kalibrační vzorek: 5 otvorů s vůlí −2 … +2 kroky (číslo = počet zářezů) ---------- */
  /** Co se lícuje u daného druhu: [{jmeno, nazev, jmen (jmenovitý Ø), vule, h, pole}] */
  function licovani(p, o) {
    const u = p.ulozeni, a = [];
    if (p.druh === 'redukce' || (p.druh === 'vodidlo' && p.vodidlo.typ === 'kladka')) {
      if (o.L) a.push({ jmeno: 'kal_loz', nazev: `Kalibrace – sedlo ložiska ${o.L.o}`, jmen: o.L.D, vule: u.vule, h: o.L.B, pole: 'ulozeni.vule' });
      else a.push({ jmeno: 'kal_trn', nazev: `Kalibrace – otvor na trn Ø ${fmt(u.trn)}`, jmen: u.trn, vule: u.vuleTrnu, h: 6, pole: 'ulozeni.vuleTrnu' });
    }
    if (p.druh === 'stojan') a.push({ jmeno: 'kal_osa', nazev: `Kalibrace – díra osy Ø ${fmt(o.L.d)}`, jmen: o.L.d, vule: u.vuleTrnu, h: 6, pole: 'ulozeni.vuleTrnu' });
    if (p.druh === 'vodidlo' && p.vodidlo.typ === 'ptfe') a.push({ jmeno: 'kal_ptfe', nazev: `Kalibrace – otvor PTFE Ø ${fmt(p.vodidlo.ptfe)}`, jmen: p.vodidlo.ptfe, vule: p.vodidlo.vulePtfe, h: 6, pole: 'vodidlo.vulePtfe' });
    return a;
  }
  function postavKalibraci(ctx, p, o) {
    const { M, km, otoc, hranol, kvadr, rozdil } = ctx;
    const krok = p.tisk.krokKalibrace, out = [];
    for (const q of licovani(p, o)) {
      // 5 otvorů v řadě; na malou podložku ve dvou řadách (3 + 2), zářezy vždy na vnější hraně
      const roz = q.jmen + 5, vb = q.jmen + 9, h = q.h, mx = Math.max(p.tisk.podlozkaX, p.tisk.podlozkaY) - 4;
      const sl = 5 * roz + 4 <= mx ? 5 : 3, ra = Math.ceil(5 / sl), sir = sl * roz + 4, vys = ra * vb;
      const desk = hranol([obdelnik(-sir / 2, -vys / 2, sir / 2, vys / 2, 2)], 0, h);
      const odd = [], vule = [], stredy = [];
      for (let i = 0; i < 5; i++) {
        const sx = i % sl, ry = Math.floor(i / sl), x = (sx - (sl - 1) / 2) * roz, y = ((ra - 1) / 2 - ry) * vb;
        const v = Math.round((q.vule + (i - 2) * krok) * 1000) / 1000, r = (q.jmen + v) / 2, n = segmenty(r), kor = r / Math.cos(Math.PI / n);
        vule.push(v); stredy.push([x, y]);
        odd.push(km(otoc([[0, -1], [kor + 1.2, -1], [kor, 0.2], [kor, h - 0.2], [kor + 1.2, h + 1], [0, h + 1]], n).translate([x, y, 0])));
        const ye = ry === 0 ? vys / 2 : -vys / 2, s = ry === 0 ? 1 : -1;
        for (let j = 0; j <= i; j++) odd.push(kvadr(x - 2.4 + j * 1.2, Math.min(ye - s * 1.2, ye + s), -1, x - 1.8 + j * 1.2, Math.max(ye - s * 1.2, ye + s), h + 1));
      }
      const d = Object.assign(sit(km, rozdil(desk, odd), q.jmeno, q.nazev, BARVY.kalibrace), { vule, jmen: q.jmen, pole: q.pole, roz, stredy });
      out.push(d);
    }
    return out;
  }
  function obdelnik(x0, y0, x1, y1, r) {
    r = Math.max(0, Math.min(r, (x1 - x0) / 2 - 0.01, (y1 - y0) / 2 - 0.01));
    if (r < 0.05) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const b = [], st = [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]];
    for (const [cx, cy, a0] of st) for (let j = 0; j <= 6; j++) { const a = rad(a0 + 15 * j); b.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return b;
  }

  /* ---------------- tisk, kontroly modelu, kusovník ---------------- */
  /** Všechny tištěné kusy (každý díl tolikrát, kolik je ks) – pro tiskovou polohu a export. */
  const kusyTisku = model => model.dily.flatMap(d => Array.from({ length: d.ks }, (_, i) => (d.ks > 1 ? Object.assign({}, d, { nazev: `${d.nazev} ${i + 1}` }) : d)));
  /** Rozdělí kusy na podložky: tiskoveRozlozeni po řadách, podložka = obdélník podlozkaX × podlozkaY. */
  function podlozky(kusy, p) {
    const out = [];
    let zbyva = kusy.slice();
    while (zbyva.length) {
      const deska = [];
      for (const d of zbyva.slice()) {
        const zkus = G.tiskoveRozlozeni(deska.concat([d]), 1, 6, p.tisk.podlozkaX);
        const B = zkus.reduce((A, x) => { const q = G.obal(x.poz); return [Math.min(A[0], q[0]), Math.min(A[1], q[1]), Math.max(A[2], q[3]), Math.max(A[3], q[4])]; }, [Infinity, Infinity, -Infinity, -Infinity]);
        if (!deska.length || (B[2] - B[0] <= p.tisk.podlozkaX + 0.01 && B[3] - B[1] <= p.tisk.podlozkaY + 0.01)) { deska.push(d); zbyva.splice(zbyva.indexOf(d), 1); }
      }
      out.push(deska);
    }
    return out;
  }
  function kontrolyModelu(p, model) {
    const H = [];
    for (const d0 of model.dily.concat(model.kalibrace)) {
      if (d0.teles > 1) H.push({ uroven: 'chyba', pole: null, text: `${d0.nazev}: díl se rozpadl na ${d0.teles} tělesa – některá část není spojená.` });
      const r = G.rozborTisku(d0, p.tisk.uhel);
      if (r.previs > 3) H.push({ uroven: 'varovani', pole: ['tisk.uhel'], text: `${d0.nazev}: převisy nad ${fmt(p.tisk.uhel)}° od svislice ${fmt(r.previs, 0)} mm² – v tiskové poloze může potřebovat podpory.` });
      if (r.most > 2) H.push({ uroven: 'info', pole: null, text: `${d0.nazev}: tiskárna přemostí ${fmt(r.most, 0)} mm² vodorovného stropu.` });
      const b = G.obal(d0.poz);
      if (!naPodlozku(b[3] - b[0], b[4] - b[1], p)) H.push({ uroven: 'chyba', pole: ['tisk.podlozkaX', 'tisk.podlozkaY'], text: `${d0.nazev} (${fmt(b[3] - b[0], 0)} × ${fmt(b[4] - b[1], 0)} mm) se nevejde na podložku ${fmt(p.tisk.podlozkaX)} × ${fmt(p.tisk.podlozkaY)}.` });
    }
    return H;
  }
  /** Kusovník: [{nazev, ks, pozn, druh: 'tisk'|'nakup', d?}] */
  function kusovnik(p, model) {
    const o = model ? model.o : odvozene(p), out = [];
    const mat = MATERIALY[p.tisk.material].nazev;
    if (model) for (const d of model.dily) out.push({ nazev: d.nazev, ks: d.ks, pozn: mat, druh: 'tisk', d });
    const nakup = (nazev, ks, pozn = '') => out.push({ nazev, ks, pozn, druh: 'nakup' });
    const u = p.ulozeni;
    if (p.druh === 'redukce') {
      const r = p.redukce, n = r.dvoudilna ? 2 * r.kusu : r.kusu;
      if (o.L) nakup(`Ložisko ${o.L.o}-2RS nebo ZZ (${fmt(o.L.d)} × ${fmt(o.L.D)} × ${fmt(o.L.B)})`, n, 'zalisovat ze strany příruby');
      const osa = o.L ? o.L.d : u.trn, M = sroubNa(osa);
      nakup(M ? `Tyč / závitová tyč ${M} (délka podle držáku)` : `Trn / tyč Ø ${fmt(osa)}`, 1, 'kupuje se, pokud ji držák nemá');
    } else if (p.druh === 'stojan') {
      const s = p.stojan, L = o.L, Mo = o.M;
      nakup(`Ložisko ${L.o}-2RS nebo ZZ (${fmt(L.d)} × ${fmt(L.D)} × ${fmt(L.B)})`, o.loziska);
      const kraj = 4, stred = 2 * (s.civek - 1);
      if (Mo) {
        nakup(`Šroub ${Mo} × ${o.lOsaKraj} ISO 4017 (osa ložiska v krajní bočnici)`, kraj);
        if (stred) nakup(`Šroub ${Mo} × ${o.lOsaStred} ISO 4017 (osa ložisek v prostřední bočnici)`, stred);
        nakup(`Matice samojistná ${Mo} ISO 7040`, kraj + stred);
        nakup(`Podložka ${Mo} ISO 7089`, 2 * (kraj + stred), 'pod hlavu a pod matici');
      } else nakup(`Čep Ø ${fmt(L.d)} s pojistkou`, kraj + stred);
      if (s.spoj === 'tyc') {
        nakup(`Závitová tyč M8 × ${o.lTyc} DIN 976`, 2);
        nakup('Matice M8 ISO 4032', 2 * 2 * (s.civek + 1), 'z obou stran každé bočnice');
        nakup('Podložka M8 ISO 7089', 2 * 2 * (s.civek + 1));
      }
      nakup('Protiskluzové nožičky (pryžové, samolepicí)', 4 * 2, 'volitelně pod bočnice');
    } else {
      const v = p.vodidlo;
      if (v.uchyt === 'profil') { nakup('Šroub M5 × 10 ISO 7380 + T-matice pro drážku 6 mm', 1); }
      else nakup(v.dira >= 8 ? `pod šroub / matici M${Math.round(v.dira - 0.4)} (stávající)` : `Vrut / šroub Ø ${fmt(Math.max(2, v.dira - 0.5), 1)}`, v.der);
      if (v.typ === 'ptfe') {
        if (v.spojka !== 'zadna') nakup(`Rychlospojka na trubičku ${fmt(v.ptfe)} mm, závit ${v.spojka}`, 1);
        nakup(`PTFE trubička ${fmt(v.ptfe)} / ${fmt(v.filament > 2 ? v.ptfe - 2 : 2)} mm`, 1, 'délka podle cesty k extruderu');
      }
      if (v.typ === 'kladka') {
        const Mo = sroubNa(o.osa);
        if (o.L) nakup(`Ložisko ${o.L.o}-2RS nebo ZZ (${fmt(o.L.d)} × ${fmt(o.L.D)} × ${fmt(o.L.B)})`, 1);
        nakup(Mo ? `Šroub ${Mo} × ${delkaSroubu(o.w + o.mezeraK + o.tk + (SROUBY[Mo] ? SROUBY[Mo].mn : 4) + 1)} ISO 4762` : `Čep Ø ${fmt(o.osa)}`, 1, 'osa kladky');
        if (Mo) { nakup(`Matice samojistná ${Mo} ISO 7040`, 1); nakup(`Podložka ${Mo} ISO 7089`, 2, 'jedna mezi sloupek a kladku'); }
      }
    }
    return out;
  }

  const API = {
    AKTUALIZACE, MATERIALY, CIVKY, SROUBY, SPOJKY, LOZISKA, CASTA, NAZVY, VYCHOZI, MEZE, VYCTY, PREDVOLBY, ZAMEK,
    normalizuj, predvolba, popis, ulozProjekt, nactiProjekt, lozisko, odvozene, kontroly, postav, kontrolyModelu,
    FILAMENTY, ZAVIT, kusyTisku, podlozky, kusovnik, licovani, rezRedukce, obrysBocnice, profilVodidla, preved, kruh, obalka2, rybina, naPodlozku,
    sroubNa, delkaSroubu, segmenty, kopie, vezmi: G.vezmi, poloz: G.poloz, fmt,
  };
  if (uzel) module.exports = API; else window.CIVKA = API;
})();

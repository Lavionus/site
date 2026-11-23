/* Zarážky a aretace dveří a oken – jádro generátoru (bez DOM a bez three.js, spustitelné v node).
   Druhy dílu:
   • klin – klín pod dveře: z mezery pod dveřmi (min–max) a sklonu vyjde délka; protiskluzové V-drážky na spodku
     (doporučeno TPU), nebo kapsy na pryžové nožičky; očko na zavěšení; ražený text na šikmé ploše.
   • magnet – zarážka s magnetem: sloupek s přírubou (vruty / páska) a kapsou na neodymový magnet (lisovaný s vůlí,
     nebo vložený při pauze tisku), protikus na dveře s magnetem nebo ocelovou podložkou, tlumení TPU kroužkem
     nebo O-kroužkem. Montáž na zeď (protikus = terčík na dveřích) nebo na podlahu (protikus = úhelník s jazykem
     nad sloupkem, dveře narazí deskou úhelníku do boku sloupku).
   • aretace – ventilační hřeben (rameno se zářezy na čepu na rámu + kolík na křídle) nebo doraz nábytkových
     dvířek / šuplíku (úhelník s kapsou na nárazník nebo magnet).
   Všechny díly se staví rovnou v TISKOVÉ POLOZE (z nahoru, podložka z = 0) – nic nepřevisá víc než 45°;
   vodorovné díry (úhelník protikusu, kapsa dorazu) mají tvar kapky se špičkou nahoru (p.diry = 'kapka'), nebo kruhu.
   Sestava (náhled): z nahoru, podlaha z = 0; převod tisk → sestava je u každého dílu (prevod). */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const fmt = G.fmt, kopie = G.kopie;
  const rad = s => s * Math.PI / 180, deg = r => r * 180 / Math.PI;

  /* ---------------- tabulky (typické hodnoty 11/2026 – orientačně, ověřit měřením / u výrobce) ---------------- */
  /** E (MPa), mez pevnosti v tahu podél vrstev (MPa); napříč vrstvami ≈ polovina. */
  const MATERIALY = {
    PETG: { nazev: 'PETG', hustota: 1.27, E: 2000, sigma: 45, tvrdy: true },
    PLA: { nazev: 'PLA', hustota: 1.24, E: 3500, sigma: 50, tvrdy: true },
    ASA: { nazev: 'ASA', hustota: 1.07, E: 2000, sigma: 40, tvrdy: true },
    PA: { nazev: 'PA (nylon)', hustota: 1.14, E: 1600, sigma: 55, tvrdy: true },
    TPU: { nazev: 'TPU 95A (pružné)', hustota: 1.21, E: 26, sigma: 30, tvrdy: false },
  };
  const NAPRIC_VRSTVAMI = 0.5;
  /** Statický součinitel tření spodku klínu o podlahu – typické hodnoty (11/2026), orientačně, ověřit. */
  const PODLAHY = {
    dlazba: { nazev: 'dlažba (glazovaná)', tvrdy: 0.3, tpu: 0.7, pryz: 0.8 },
    laminat: { nazev: 'laminát / lakované parkety', tvrdy: 0.3, tpu: 0.65, pryz: 0.75 },
    pvc: { nazev: 'PVC / linoleum / vinyl', tvrdy: 0.4, tpu: 0.8, pryz: 0.9 },
    drevo: { nazev: 'olejované dřevo', tvrdy: 0.35, tpu: 0.7, pryz: 0.8 },
    koberec: { nazev: 'koberec (krátký vlas)', tvrdy: 0.5, tpu: 0.6, pryz: 0.6 },
  };
  /** Vruty se zápustnou hlavou 90° (DIN 7997 / ISO 7050): d, otvor v plastu, Ø hlavy dk, vrták hmoždinky. */
  const VRUTY = {
    3: { d: 3, otvor: 3.4, hlava: 6, hmozdinka: 5 },
    3.5: { d: 3.5, otvor: 3.9, hlava: 7, hmozdinka: 6 },
    4: { d: 4, otvor: 4.5, hlava: 8, hmozdinka: 6 },
    4.5: { d: 4.5, otvor: 5, hlava: 9, hmozdinka: 6 },
    5: { d: 5, otvor: 5.5, hlava: 10, hmozdinka: 8 },
  };
  /** Únosnost vrutu ve střihu (N) podle podkladu – typické, s rezervou (ověřit u výrobce hmoždinek). */
  const PODKLADY = {
    drevo: { nazev: 'dřevo / dřevotříska (bez hmoždinky)', strih: 400 },
    beton: { nazev: 'beton, plná cihla (hmoždinka)', strih: 500 },
    derovana: { nazev: 'děrovaná cihla (hmoždinka)', strih: 200 },
    sadrokarton: { nazev: 'sádrokarton (hmoždinka do SDK)', strih: 60 },
  };
  /** Konstanta přídržné síly neodymového válečku na silné oceli při dotyku: F ≈ K · A · h/√(h² + r²) (N, mm²) –
      nafitováno na katalogové hodnoty (orientačně ±30 %). */
  const TRIDY = { N35: { nazev: 'N35', K: 0.39 }, N42: { nazev: 'N42', K: 0.46 }, N52: { nazev: 'N52', K: 0.55 } };
  /** Běžné válečkové magnety Ø × výška (mm) pro rychlou volbu. */
  const MAGNETY = [[6, 3], [8, 2], [8, 3], [10, 2], [10, 3], [10, 5], [12, 3], [12, 5], [15, 3], [15, 5], [20, 3], [20, 5]];

  const NAZVY = {
    druh: { klin: 'klín pod dveře', magnet: 'zarážka s magnetem', aretace: 'aretace okna / dveří' },
    spodek: { drazky: 'protiskluzové V-drážky', kapsy: 'kapsy na pryžové nožičky', hladky: 'hladký' },
    montaz: { stena: 'na zeď (protikus na dveře)', podlaha: 'na podlahu (úhelník na dveře)' },
    uchyceni: { srouby: 'vruty se zápustnou hlavou', paska: 'oboustranná páska' },
    vlozeni: { lisovany: 'zalisovat po tisku (otevřená kapsa)', pauza: 'vložit při pauze tisku (zakrytá kapsa)' },
    protikus: { podlozka: 'ocelová podložka', magnet: 'druhý magnet' },
    tlumeni: { tpu: 'TPU kroužek (zvláštní díl)', oring: 'O-kroužek v drážce', zadne: 'bez tlumení' },
    typ: { hreben: 'ventilační hřeben (okno, dveře)', nabytek: 'doraz dvířek / šuplíku' },
    narazy: { kapsa: 'kapsa na samolepicí nárazník', magnet: 'kapsa na magnet (západka)', zadne: 'bez kapsy' },
    hlava: { zapustna: 'zápustná 90°', cockova: 'čočková / půlkulatá' },
  };

  const VYCHOZI = {
    verze: 1, nazev: 'Klín pod dveře', druh: 'klin', diry: 'kapka',
    klin: { hMin: 6, hMax: 14, sklon: 10, spicka: 1.6, rezerva: 4, sirka: 40, podlaha: 'laminat', spodek: 'drazky', roztec: 5, hloubka: 0.8,
      nozickaD: 10, nozickaH: 1.2, oko: true, okoD: 8, text: 'STOP', vyskaTextu: 9, hloubkaTextu: 0.6 },
    magnet: { montaz: 'stena', prumer: 24, vyska: 45, priruba: 0, tlPriruby: 5, uchyceni: 'srouby', pocetSroubu: 2,
      magnetD: 10, magnetH: 3, trida: 'N35', vlozeni: 'lisovany', vule: 0.1, kryti: 0.6,
      protikus: 'podlozka', podlozkaD: 12, podlozkaT: 1.5, protikusTl: 6, sirkaUhelniku: 30, mezera: 1.5,
      tlumeni: 'tpu', tpuTl: 2.5, tpuVyska: 8, tpuPresah: 1.5, oringD: 2 },
    dvere: { hmotnost: 25, sirka: 800, vyska: 1970, rychlost: 0.3, poloha: 700, mezera: 10 },
    aretace: { typ: 'hreben', polohy: '0; 25; 50; 80', vzdalenost: 30, kolikD: 8, vule: 0.4, tlRamene: 5, vyskaRamene: 16,
      cepD: 8, distanc: 2, odsazeni: 0, nahled: 2, odZavesu: 550, kridloS: 600, kridloV: 1200, vitr: 10 },
    nabytek: { vyska: 22, delka: 26, sirka: 24, tl: 5, narazy: 'kapsa', narazD: 8, narazH: 1, hmotnost: 1, rychlost: 0.3 },
    sroub: { vrut: 4, hlava: 'zapustna', podklad: 'drevo' },
    tisk: { material: 'TPU', vrstva: 0.2, uhel: 45, sad: 1, podlozka: 220, kalibrace: false, krokKalibrace: 0.1 },
  };
  const MEZE = {
    'klin.hMin': [1, 60], 'klin.hMax': [2, 80], 'klin.sklon': [4, 35], 'klin.spicka': [0.8, 10], 'klin.rezerva': [0, 40], 'klin.sirka': [15, 150],
    'klin.roztec': [2, 30], 'klin.hloubka': [0.3, 3], 'klin.nozickaD': [5, 30], 'klin.nozickaH': [0.4, 4], 'klin.okoD': [3, 30],
    'klin.vyskaTextu': [3, 40], 'klin.hloubkaTextu': [0.2, 2],
    'magnet.prumer': [10, 80], 'magnet.vyska': [8, 200], 'magnet.priruba': [0, 140], 'magnet.tlPriruby': [2, 20], 'magnet.pocetSroubu': [2, 4, 1],
    'magnet.magnetD': [3, 40], 'magnet.magnetH': [1, 20], 'magnet.vule': [-0.3, 0.5], 'magnet.kryti': [0.2, 3],
    'magnet.podlozkaD': [5, 50], 'magnet.podlozkaT': [0.3, 6], 'magnet.protikusTl': [3, 30], 'magnet.sirkaUhelniku': [15, 80], 'magnet.mezera': [0.3, 20],
    'magnet.tpuTl': [1.2, 8], 'magnet.tpuVyska': [3, 30], 'magnet.tpuPresah': [0.3, 6], 'magnet.oringD': [1, 5],
    'dvere.hmotnost': [1, 150], 'dvere.sirka': [200, 1600], 'dvere.vyska': [500, 3000], 'dvere.rychlost': [0.05, 5], 'dvere.poloha': [50, 1600], 'dvere.mezera': [0, 60],
    'aretace.vzdalenost': [5, 400], 'aretace.kolikD': [3, 20], 'aretace.vule': [0, 2], 'aretace.tlRamene': [2.5, 15], 'aretace.vyskaRamene': [8, 50],
    'aretace.cepD': [4, 20], 'aretace.distanc': [0, 30], 'aretace.odsazeni': [-40, 40], 'aretace.nahled': [1, 12, 1], 'aretace.odZavesu': [50, 2000],
    'aretace.kridloS': [100, 2000], 'aretace.kridloV': [100, 3000], 'aretace.vitr': [0, 40],
    'nabytek.vyska': [6, 80], 'nabytek.delka': [8, 120], 'nabytek.sirka': [8, 120], 'nabytek.tl': [1.6, 15], 'nabytek.narazD': [3, 30], 'nabytek.narazH': [0.3, 5],
    'nabytek.hmotnost': [0.1, 60], 'nabytek.rychlost': [0.05, 5],
    'tisk.vrstva': [0.05, 0.5], 'tisk.uhel': [20, 75], 'tisk.sad': [1, 50, 1], 'tisk.podlozka': [80, 600], 'tisk.krokKalibrace': [0.02, 0.5],
  };
  const VYCTY = {
    druh: Object.keys(NAZVY.druh), diry: ['kapka', 'kruh'],
    'klin.podlaha': Object.keys(PODLAHY), 'klin.spodek': Object.keys(NAZVY.spodek),
    'magnet.montaz': Object.keys(NAZVY.montaz), 'magnet.uchyceni': Object.keys(NAZVY.uchyceni), 'magnet.trida': Object.keys(TRIDY),
    'magnet.vlozeni': Object.keys(NAZVY.vlozeni), 'magnet.protikus': Object.keys(NAZVY.protikus), 'magnet.tlumeni': Object.keys(NAZVY.tlumeni),
    'aretace.typ': Object.keys(NAZVY.typ), 'nabytek.narazy': Object.keys(NAZVY.narazy),
    'sroub.vrut': Object.keys(VRUTY).map(Number), 'sroub.hlava': Object.keys(NAZVY.hlava), 'sroub.podklad': Object.keys(PODKLADY),
    'tisk.material': Object.keys(MATERIALY),
  };

  /** Předvolby: odchylky od výchozího projektu; skupina = druh. Nastavení tisku (vrstva, převis, podložka) zůstává uživatelovo. */
  const PREDVOLBY = [
    { id: 'klin', skupina: 'klin', nazev: 'Klín pod dveře 6–14 mm, TPU', popis: 'sklon 10°, V-drážky, očko, text STOP', p: {} },
    { id: 'klinVysoky', skupina: 'klin', nazev: 'Klín na velkou mezeru 12–25 mm', popis: 'vchodové / garážové dveře, TPU', p: { nazev: 'Klín 12–25 mm', klin: { hMin: 12, hMax: 25, sklon: 12, sirka: 50, text: 'STOP', vyskaTextu: 12 } } },
    { id: 'klinNozicky', skupina: 'klin', nazev: 'Klín z PETG s pryžovými nožičkami', popis: 'kapsy Ø 10 × 1,2 na samolepicí nožičky', p: { nazev: 'Klín s nožičkami', klin: { spodek: 'kapsy', podlaha: 'dlazba', sklon: 9, text: '' }, tisk: { material: 'PETG' } } },
    { id: 'klinMaly', skupina: 'klin', nazev: 'Malý klín na dvířka a okno 3–8 mm', popis: 'bez očka, úzký', p: { nazev: 'Malý klín', klin: { hMin: 3, hMax: 8, sklon: 9, spicka: 1.2, rezerva: 3, sirka: 24, oko: false, text: '', roztec: 4, hloubka: 0.6 } } },
    { id: 'magnetStena', skupina: 'magnet', nazev: 'Nástěnná zarážka s magnetem Ø 10 × 3', popis: 'sloupek 45 mm, TPU kroužek, podložka na dveře', p: { nazev: 'Nástěnná zarážka', druh: 'magnet', tisk: { material: 'PETG' } } },
    { id: 'magnetPauza', skupina: 'magnet', nazev: 'Nástěnná, magnet zalitý při pauze tisku', popis: 'Ø 12 × 3 N42, magnet i na dveřích, O-kroužek', p: { nazev: 'Zarážka – magnet zalitý', druh: 'magnet', magnet: { magnetD: 12, magnetH: 3, trida: 'N42', vlozeni: 'pauza', protikus: 'magnet', tlumeni: 'oring', prumer: 26 }, tisk: { material: 'PETG' } } },
    { id: 'magnetPodlaha', skupina: 'magnet', nazev: 'Podlahová zarážka s úhelníkem na dveře', popis: 'sloupek Ø 30 × 32, jazyk nad magnetem, TPU kroužek', p: { nazev: 'Podlahová zarážka', druh: 'magnet', magnet: { montaz: 'podlaha', vyska: 32, prumer: 30, magnetD: 12, magnetH: 3, trida: 'N42' }, tisk: { material: 'PETG' } } },
    { id: 'magnetPaska', skupina: 'magnet', nazev: 'Nalepovací zarážka (bez vrtání)', popis: 'široká příruba na pásku, Ø 10 × 2', p: { nazev: 'Zarážka na pásku', druh: 'magnet', magnet: { uchyceni: 'paska', priruba: 70, vyska: 35, magnetH: 2 }, tisk: { material: 'PETG' } } },
    { id: 'hreben', skupina: 'aretace', nazev: 'Ventilační hřeben na okno, 4 polohy', popis: '0 / 25 / 50 / 80 mm, čep Ø 8, kolík Ø 8', p: { nazev: 'Ventilační hřeben', druh: 'aretace', tisk: { material: 'PETG' } } },
    { id: 'hrebenDvere', skupina: 'aretace', nazev: 'Aretace pootevřených dveří, 3 polohy', popis: 'robustní rameno 22 × 7, kolík Ø 10', p: { nazev: 'Aretace dveří', druh: 'aretace', aretace: { polohy: '40; 80; 120', vzdalenost: 40, kolikD: 10, cepD: 10, vyskaRamene: 22, tlRamene: 7, odZavesu: 750, kridloS: 800, kridloV: 1970, nahled: 1 }, sroub: { vrut: 4.5 }, tisk: { material: 'PETG' } } },
    { id: 'dvirka', skupina: 'aretace', nazev: 'Doraz dvířek s nárazníkem', popis: 'úhelník 24 × 22, kapsa na samolepicí nárazník Ø 8', p: { nazev: 'Doraz dvířek', druh: 'aretace', aretace: { typ: 'nabytek' }, sroub: { vrut: 3.5 }, tisk: { material: 'PETG' } } },
    { id: 'suplik', skupina: 'aretace', nazev: 'Magnetická západka šuplíku', popis: 'magnet Ø 10 × 3, protikus = ocelový plíšek', p: { nazev: 'Západka šuplíku', druh: 'aretace', aretace: { typ: 'nabytek' }, nabytek: { narazy: 'magnet', vyska: 24, sirka: 26, tl: 7, hmotnost: 3, rychlost: 0.2 }, sroub: { vrut: 3.5 }, tisk: { material: 'PETG' } } },
  ];

  function normalizuj(v) {
    const r = G.normalizuj(v, { VYCHOZI, MEZE, VYCTY });
    r.p.aretace.polohy = String(r.p.aretace.polohy).slice(0, 200);
    r.p.klin.text = String(r.p.klin.text).slice(0, 20);
    return r;
  }
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(G.slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }
  /** Seznam poloh hřebenu „0; 25 50“ → seřazená různá čísla 0…600 (nejvýš 12). */
  const polohyHrebenu = t => [...new Set(String(t || '').split(/[;\s]+/).filter(Boolean).map(G.ctiCislo).filter(x => Number.isFinite(x) && x >= 0 && x <= 600).map(x => Math.round(x * 10) / 10))].sort((a, b) => a - b).slice(0, 12);

  /* ---------------- odvozené rozměry ---------------- */
  /** Vrut: ro = díra, rh = poloměr hlavy (+vůle), hz = hloubka kuželu 90° (0 = čočková hlava, rovné sedlo). */
  function vrut(p) {
    const v = VRUTY[p.sroub.vrut], zap = p.sroub.hlava === 'zapustna';
    return { d: v.d, ro: v.otvor / 2, rh: v.hlava / 2 + 0.25, hz: zap ? v.hlava / 2 + 0.25 - v.otvor / 2 : 0, hmozdinka: v.hmozdinka, zap };
  }
  /** Výška kapsy zakryté při pauze: zaokrouhlená nahoru na vrstvy (magnet nesmí vyčnívat nad strop kapsy). */
  const naVrstvy = (h, vr) => Math.ceil((h + 0.1) / vr - 1e-9) * vr;

  function odvozene(p) {
    const o = { druh: p.druh, chyby: [] };
    if (p.druh === 'klin') o.klin = odvozenyKlin(p);
    else if (p.druh === 'magnet') o.mag = odvozenyMagnet(p);
    else if (p.aretace.typ === 'hreben') o.hreben = odvozenyHreben(p, o);
    else o.nabytek = odvozenyNabytek(p);
    return o;
  }

  function odvozenyKlin(p) {
    const k = p.klin, a = rad(k.sklon), ta = Math.tan(a), s = k.spicka;
    const hZad = Math.max(k.hMax + k.rezerva, s + 1), L = (hZad - s) / ta;
    const tl = x => s + x * ta;   // tloušťka klínu v místě x
    const r = { a, ta, s, hZad, L, b: k.sirka, tl, xMin: (k.hMin - s) / ta, xMax: (k.hMax - s) / ta };
    // V-drážky napříč (45° boky): jen tam, kde nad drážkou zbude ≥ 1,2 mm
    r.drazky = [];
    if (k.spodek === 'drazky') {
      const hl = k.hloubka, x0 = Math.max(hl + 1.5, (hl + 1.2 - s) / ta + hl);
      for (let x = L - Math.max(3, hl + 1.5); x >= x0; x -= k.roztec) r.drazky.push(x);
      r.drazky.reverse();
    }
    // kapsy na nožičky: 2 řady (širší klín) nebo 1 řada, vzadu a vpředu, kde je klín dost tlustý
    r.kapsy = [];
    if (k.spodek === 'kapsy') {
      const rn = k.nozickaD / 2 + 0.3, hk = k.nozickaH;
      const xZad = L - rn - 3, xPred = Math.max(rn + 3, (hk + 1.2 - s) / ta + rn);
      const ys = k.sirka >= 4 * rn + 10 ? [-(k.sirka / 2 - rn - 3), k.sirka / 2 - rn - 3] : [0];
      const xs = xZad - xPred > 2 * rn + 4 ? [xPred, xZad] : [xZad];
      for (const x of xs) for (const y of ys) r.kapsy.push({ x, y, r: rn, h: hk });
    }
    // očko na zavěšení za zadní stěnou (svislá díra = v tisku bez převisu)
    r.oko = k.oko ? { ro: k.okoD / 2, Ro: k.okoD / 2 + 3.5, x: L + k.okoD / 2 + 3, t: Math.min(hZad, 4) } : null;
    r.delkaCelkem = L + (r.oko ? r.oko.x - L + r.oko.Ro : 0);
    // text: pás na šikmé ploše (od 35 % délky po zadní hranu)
    const tx0 = Math.max(L * 0.3, (k.hloubkaTextu + 1 - s) / ta + 1);
    r.text = k.text.trim() ? { x0: tx0, x1: L - 2.5, h: Math.min(k.vyskaTextu, k.sirka - 6), hl: k.hloubkaTextu } : null;
    return r;
  }

  function odvozenyMagnet(p) {
    const m = p.magnet, v = vrut(p), srouby = m.uchyceni === 'srouby';
    const r = { montaz: m.montaz, Rs: m.prumer / 2, Ht: m.vyska, tp: m.tlPriruby, v: srouby ? v : null };
    // příruba: 0 = automaticky (hlavy vrutů vedle náběhu sloupku / plocha pro pásku)
    const ch = 2.5, auto = srouby ? r.Rs + ch + 2 * v.rh + 2.4 : r.Rs + 10;
    r.Rp = Math.max(m.priruba > 0 ? m.priruba / 2 : auto, r.Rs);
    r.c = Math.min(ch, Math.max(0, (r.Rp - r.Rs) * 0.4));
    r.auto = !(m.priruba > 0);
    // kapsa magnetu ve sloupku
    const vr = p.tisk.vrstva;
    r.rk = m.magnetD / 2 + m.vule;
    if (m.vlozeni === 'pauza') {
      r.hk = naVrstvy(m.magnetH, vr);
      r.zk1 = Math.floor((r.Ht - m.kryti) / vr + 1e-9) * vr;    // strop kapsy = hranice vrstev
      r.zk0 = r.zk1 - r.hk;
      r.pauza = r.zk1 + vr;                                     // pauza před vrstvou s horní hranou v této výšce
      r.krytiSkut = r.Ht - r.zk1;
    } else { r.hk = m.magnetH + 0.2; r.zk1 = r.Ht + 1; r.zk0 = r.Ht - r.hk; r.krytiSkut = 0; }
    // díry v přírubě
    r.diry = [];
    if (srouby) {
      const rd = Math.max(r.Rs + r.c + v.rh + 0.6, (r.Rs + r.c + r.Rp) / 2);
      r.rd = rd;
      for (let i = 0; i < m.pocetSroubu; i++) { const a = 2 * Math.PI * i / m.pocetSroubu + (m.montaz === 'stena' ? Math.PI / 2 : 0); r.diry.push({ x: rd * Math.cos(a), y: rd * Math.sin(a) }); }
    }
    // tlumení
    r.tlum = m.tlumeni;
    if (m.tlumeni === 'tpu') r.tpu = { ri: r.Rs - 0.15, Ro: r.Rs + m.tpuTl, h: m.tpuVyska, presah: m.montaz === 'stena' ? m.tpuPresah : 0 };
    if (m.tlumeni === 'oring') {
      const d = m.oringD, hl = 0.7 * d, sir = 1.35 * d;
      if (m.montaz === 'stena') { const ri = r.rk + 1.2; r.oring = { celo: true, ri, ro: ri + sir, hl, d, ID: Math.max(1, Math.floor((2 * ri + d * 0.1) * 2) / 2), vycniva: d - hl }; }
      else { const z0 = r.Ht - 1.5 - sir - hl; r.oring = { celo: false, z0, z1: z0 + sir, hl, d, ID: Math.round((2 * (r.Rs - hl)) * 2) / 2, vycniva: d - hl }; }
    }
    // o kolik je čelo protikusu dál než čelo sloupku (stěna) / radiálně (podlaha)
    r.odsazeni = r.tpu ? (m.montaz === 'stena' ? r.tpu.presah : r.tpu.Ro - r.Rs) : r.oring ? r.oring.vycniva : 0;
    // protikus
    const pm = m.protikus === 'magnet';
    const pD = pm ? m.magnetD : m.podlozkaD, pH = pm ? m.magnetH : m.podlozkaT;
    const pk = { magnet: pm, rk: pD / 2 + m.vule, D: pD, H: pH };
    if (m.vlozeni === 'pauza') pk.hk = naVrstvy(pH, vr); else pk.hk = pH + 0.2;
    r.pk = pk;
    if (m.montaz === 'stena') {
      const t = m.protikusTl;
      pk.tl = t;
      pk.diry = [];
      if (srouby) {
        const rd = pk.rk + 1.2 + v.rh;
        pk.Rk = Math.max(r.Rs, rd + v.rh + 1.5);
        pk.diry = [{ x: -rd, y: 0 }, { x: rd, y: 0 }];
      } else pk.Rk = Math.max(r.Rs, pk.rk + 3);
      if (m.vlozeni === 'pauza') { pk.z1 = Math.floor((t - m.kryti) / vr + 1e-9) * vr; pk.z0 = pk.z1 - pk.hk; pk.pauza = pk.z1 + vr; pk.kryti = t - pk.z1; }
      else { pk.z0 = t - pk.hk; pk.z1 = t + 1; pk.kryti = 0; }
    } else {
      // úhelník: deska na dveřích (x ∈ [−tpl, 0]), jazyk nad sloupkem (z ∈ [0, tj]) s kapsou zespodu
      const tpl = Math.max(4, v.hz + 1.2), cx = r.Rs + r.odsazeni;
      const tj = Math.max(4, pk.hk + (m.vlozeni === 'pauza' ? m.kryti : 0) + 1.2);
      const b = Math.max(m.sirkaUhelniku, 2 * pk.rk + 6);
      const g = 5, zs = tj + g + v.rh + 1, Hp = zs + v.rh + 4;
      const yo = b >= 4 * v.rh + 7 ? b / 2 - v.rh - 2.2 : 0;
      Object.assign(pk, { tpl, cx, tj, b, g, zs, Hp, vyl: cx + pk.rk + 3, diry: srouby ? (yo ? [{ y: -yo, z: zs }, { y: yo, z: zs }] : [{ y: 0, z: zs }, { y: 0, z: zs + 2 * v.rh + 3 }]) : [] });
      if (!yo && srouby) pk.Hp = zs + 2 * v.rh + 3 + v.rh + 4;
      if (m.vlozeni === 'pauza') { pk.z0 = Math.ceil(m.kryti / vr - 1e-9) * vr; pk.z1 = pk.z0 + pk.hk; pk.pauza = pk.z1 + vr; pk.kryti = pk.z0; }
      else { pk.z0 = -1; pk.z1 = pk.hk; pk.kryti = 0; }
      pk.zDole = r.Ht + m.mezera;   // spodek jazyka nad podlahou
    }
    // mezera mezi magnetem a protikusem (plast + tlumení + vzduch)
    r.mezera = r.krytiSkut + pk.kryti + (m.montaz === 'stena' ? r.odsazeni : m.mezera) + (m.vlozeni === 'lisovany' ? 0.2 + 0.2 : 0);
    return r;
  }

  function odvozenyHreben(p, o) {
    const a = p.aretace, v = vrut(p);
    const pol = polohyHrebenu(a.polohy);
    if (!pol.length) { o.chyby.push('polohy'); pol.push(0, 25, 50); }
    const wn = a.kolikD + 2 * a.vule, hb = a.vyskaRamene, yC = -hb / 2 + 0.6 * a.kolikD;   // střed kolíku v zářezu
    const r = { pol, wn, hb, yC, horniZarezu: yC + wn / 2, tr: a.tlRamene, v };
    r.xs = pol.map(x => a.vzdalenost + x);
    r.rc = a.cepD / 2 + 0.2;
    r.Rb = Math.max(hb / 2, r.rc + 3.5);
    r.Lr = r.xs[r.xs.length - 1] + wn / 2 + 12;
    r.zbytek = hb / 2 - r.horniZarezu;   // materiál nad zářezem
    // patky (čep na rámu, kolík na křídle): deska s dvěma vruty podél x
    const tpb = Math.max(3.5, v.hz + 1), rcol = a.cepD / 2 + 3;
    const patka = (rPin) => {
      const rr = Math.max(rPin + 3, rcol), xs = rr + v.rh + 1.2;
      return { tpb, rcol: rr, xs, L: 2 * (xs + v.rh + 2.5), W: Math.max(2 * rr + 4, 2 * v.rh + 7) };
    };
    r.pCep = patka(a.cepD / 2);
    r.pKol = patka(a.kolikD / 2);
    r.zRamene = tpb + a.distanc;                          // spodek ramene nad rámem
    r.cepVrch = r.zRamene + r.tr + 0.6;                    // vrch čepu (nad ním podložka + vrut 3)
    r.kolVrch = r.zRamene + r.tr + 2 - a.odsazeni;         // vrch kolíku v souřadnicích křídla
    r.vodici = Math.min(10, r.cepVrch - 1.5);               // hloubka díry pro pojistný vrut 3 v čepu
    r.nahled = Math.min(a.nahled, pol.length) - 1;
    return r;
  }

  function odvozenyNabytek(p) {
    const n = p.nabytek, v = vrut(p), m = p.magnet;
    const tw = n.tl, tp = Math.max(n.tl, v.hz + 1), hw = Math.max(n.vyska, tp + 4);
    const g = Math.max(0, Math.min(6, hw - tp - 2));
    const xs = tw + g + v.rh + 1.2, L = Math.max(n.delka, xs + v.rh + 2.5), b = n.sirka;
    const yo = b >= 4 * v.rh + 8 ? b / 2 - v.rh - 2.2 : 0;
    const r = { tw, tp, hw, g, L, b, v, diry: yo ? [{ x: xs, y: -yo }, { x: xs, y: yo }] : [{ x: xs, y: 0 }] };
    if (!yo && L - xs > 3 * v.rh + 6) r.diry.push({ x: xs + 2 * v.rh + 3, y: 0 });
    if (n.narazy === 'magnet') r.kapsa = { r: m.magnetD / 2 + m.vule, h: m.magnetH + 0.2, magnet: true };
    else if (n.narazy === 'kapsa') r.kapsa = { r: n.narazD / 2 + 0.3, h: n.narazH, magnet: false };
    if (r.kapsa) r.kapsa.z = Math.max(tp + r.kapsa.r + 1, Math.min(hw / 2 + tp / 2, hw - r.kapsa.r * Math.SQRT2 - 1));
    return r;
  }

  /* ---------------- mechanika (orientační) ---------------- */
  /** Přídržná síla válečku (N) přes mezeru g (mm): F0 = K·A·h/√(h²+r²); pokles ~ (B(g)/B(0))² (zrcadlový obraz v oceli),
      magnet–magnet ~ B(g)/B(0) (pomalejší pokles); tenká ocel (t < h/2) sílu úměrně sníží. */
  function silaMagnetu(D, H, trida, g, protiMagnetu, tOceli) {
    const r = D / 2, A = Math.PI * r * r, K = TRIDY[trida].K;
    const F0 = K * A * H / Math.hypot(H, r);
    const L = 2 * H, B = z => (z + L) / Math.hypot(z + L, r) - z / Math.hypot(z, r);
    const pomer = Math.max(0, B(Math.max(0, g)) / B(0));
    let F = F0 * (protiMagnetu ? pomer : pomer * pomer);
    if (!protiMagnetu && tOceli > 0 && tOceli < H / 2) F *= tOceli / (H / 2);
    return { F0, F, pomer };
  }
  /** Kinetická energie dveří (J) při rychlosti kliky v (m/s): křídlo = deska otáčející se kolem pantu, I = m·W²/3. */
  function energieDveri(d) {
    const W = d.sirka / 1000, w = d.rychlost / W, I = d.hmotnost * W * W / 3;
    return { E: 0.5 * I * w * w, I, w };
  }

  function mechanika(p, o0) {
    const o = o0 || odvozene(p), mat = MATERIALY[p.tisk.material], out = {};
    if (p.druh === 'klin') {
      const k = o.klin, pod = PODLAHY[p.klin.podlaha];
      const druhSpodku = !mat.tvrdy ? 'tpu' : p.klin.spodek === 'kapsy' ? 'pryz' : 'tvrdy';
      const mu = pod[druhSpodku];
      out.klin = { mu, druhSpodku, tg: k.ta, alfaMax: deg(Math.atan(mu)), rezerva: mu / k.ta, tabulka: Object.entries(PODLAHY).map(([id, q]) => ({ id, nazev: q.nazev, mu: q[druhSpodku], alfaMax: deg(Math.atan(q[druhSpodku])) })) };
      return out;
    }
    if (p.druh === 'magnet') {
      const r = o.mag, m = p.magnet, pk = r.pk;
      const f = silaMagnetu(m.magnetD, m.magnetH, m.trida, r.mezera, pk.magnet, pk.magnet ? 0 : m.podlozkaT);
      const d = p.dvere, e = energieDveri(d);
      const rs = Math.min(d.poloha, d.sirka) / 1000;
      const Mdrz = f.F * rs;                                   // N·m
      const Fklika = Mdrz / Math.max(0.05, (d.sirka - 60) / 1000);
      const A = d.sirka * d.vyska / 1e6;
      const pruvan = 2 * Mdrz / (A * d.sirka / 1000);          // Pa – rovnoměrný tlak na křídlo
      // náraz: kinetická energie z rychlosti kliky, zastaví ji stlačení tlumení δ (lineární pružina: F = 2E/δ)
      // stlačení při nárazu δ (tlumení + pružnost dveří a zarážky, orientačně)
      const delta = 0.5 + (r.tpu ? (m.montaz === 'stena' ? r.tpu.presah : 0.4 * m.tpuTl) : r.oring ? 0.3 * m.oringD : 0);
      const Fnaraz = 2 * e.E / (delta / 1000);
      out.magnet = Object.assign(f, { mezera: r.mezera, Mdrz, Fklika, pruvan, E: e.E, delta, Fnaraz, rs });
      // uchycení zarážky: střih vrutů / páska; u podlahy ohyb sloupku (tištěn nastojato = napříč vrstvami)
      if (m.uchyceni === 'srouby') {
        const n = r.diry.length, kap = PODKLADY[p.sroub.podklad].strih * n;
        out.uchyceni = { coNese: `Vruty (${n}×) ve střihu`, potreba: Fnaraz, kapacita: kap, vyuziti: Fnaraz / kap };
        if (m.montaz === 'stena') {
          // náraz tlačí sloupek ke zdi – vruty nesou jen odraz; kritické je vytržení při rázu do boku: bereme 30 % síly
          out.uchyceni.potreba = 0.3 * Fnaraz; out.uchyceni.vyuziti = 0.3 * Fnaraz / kap; out.uchyceni.coNese = `Vruty (${n}×) – boční složka rázu`;
        }
      } else {
        const Apl = Math.PI * r.Rp * r.Rp / 100, kap = Apl * 3;   // páska ~3 N/cm² trvale
        const potreba = m.montaz === 'stena' ? 0.3 * Fnaraz : Fnaraz;
        out.uchyceni = { coNese: 'Oboustranná páska', potreba, kapacita: kap, vyuziti: potreba / kap, A: Apl };
      }
      if (m.montaz === 'podlaha') {
        const h = r.Ht - (r.tpu ? r.tpu.h / 2 : 3);
        const Wo = Math.PI * Math.pow(2 * r.Rs, 3) / 32, sigma = Fnaraz * h / Wo, dov = mat.sigma * NAPRIC_VRSTVAMI / 2;
        out.sloupek = { sigma, dov, vyuziti: sigma / dov };
      }
      return out;
    }
    if (p.aretace.typ === 'hreben') {
      const h = o.hreben, a = p.aretace;
      const q = 0.613 * a.vitr * a.vitr, A = a.kridloS * a.kridloV / 1e6;
      const M = q * A * (a.kridloS / 1000) / 2, F = M / (a.odZavesu / 1000);
      const ramenoKolik = Math.max(1, a.distanc + h.tr / 2 - a.odsazeni);
      const sigK = F * ramenoKolik / (Math.PI * Math.pow(a.kolikD, 3) / 32), dovK = mat.sigma * NAPRIC_VRSTVAMI / 2;
      const dovR = mat.sigma / 2;
      const pol = h.pol.map(x => ({ x, uhel: deg(2 * Math.asin(Math.min(1, x / (2 * a.odZavesu)))) }));
      const kap = PODKLADY[p.sroub.podklad].strih * 2;
      out.hreben = { q, F, M, sigK, dovK, sigR: F / (h.tr * Math.max(0.5, h.zbytek)), dovR, pol, uchyceni: { coNese: 'Vruty patky (2×) ve střihu', potreba: F, kapacita: kap, vyuziti: F / kap } };
      out.uchyceni = out.hreben.uchyceni;
      return out;
    }
    const n = p.nabytek, r = o.nabytek;
    const E = 0.5 * n.hmotnost * n.rychlost * n.rychlost;
    const delta = 1 + (r.kapsa && !r.kapsa.magnet ? 0.5 * n.narazH + 0.5 : 0);   // pružnost dvířek/korpusu + nárazník
    const F = 2 * E / (delta / 1000);
    const Wo = r.b * r.tw * r.tw / 6, sigma = F * (r.kapsa ? r.kapsa.z : r.hw / 2) / Wo, dov = mat.sigma * NAPRIC_VRSTVAMI / 2;
    const kap = PODKLADY[p.sroub.podklad].strih * r.diry.length;
    out.nabytek = { E, delta, F, sigma, dov, vyuziti: sigma / dov };
    if (r.kapsa && r.kapsa.magnet) out.nabytek.magnet = silaMagnetu(p.magnet.magnetD, p.magnet.magnetH, p.magnet.trida, 0.3, false, 0.8);
    out.uchyceni = { coNese: `Vruty (${r.diry.length}×) ve střihu`, potreba: F, kapacita: kap, vyuziti: F / kap };
    return out;
  }

  /* ---------------- kontroly ---------------- */
  function kontroly(p) {
    const H = [], o = odvozene(p), mat = MATERIALY[p.tisk.material];
    const chyba = (pole, text, oprava) => H.push({ uroven: 'chyba', pole, text, oprava });
    const var_ = (pole, text, oprava) => H.push({ uroven: 'varovani', pole, text, oprava });
    const info = (pole, text) => H.push({ uroven: 'info', pole, text });
    const opr = zm => ({ zmeny: zm });
    const kr = p.diry === 'kruh';
    if (o.chyby.includes('polohy')) chyba(['aretace.polohy'], 'Seznam poloh hřebenu je prázdný – zadejte pootevření v mm oddělená středníkem (např. 0; 25; 50).', opr({ 'aretace.polohy': '0; 25; 50' }));
    if (H.length) return dokonci(H);
    const m = mechanika(p, o);
    if (p.druh === 'klin') {
      const k = o.klin, q = p.klin, mk = m.klin;
      if (q.hMax <= q.hMin) chyba(['klin.hMax', 'klin.hMin'], `Největší mezera (${fmt(q.hMax)} mm) musí být větší než nejmenší (${fmt(q.hMin)} mm).`, opr({ 'klin.hMax': q.hMin + 6 }));
      if (q.hMin < q.spicka + 0.5) chyba(['klin.spicka', 'klin.hMin'], `Špička klínu (${fmt(q.spicka, 1)} mm) se pod nejmenší mezeru ${fmt(q.hMin)} mm nevejde – ztenčete špičku.`, opr({ 'klin.spicka': Math.max(0.8, Math.floor((q.hMin - 0.6) * 10) / 10) }));
      if (q.spicka < 1.2) var_(['klin.spicka'], `Špička ${fmt(q.spicka, 1)} mm je tenká – vytiskne se jen pár vrstev a snadno se odlomí (doporučeno ≥ 1,2 mm).`, opr({ 'klin.spicka': 1.2 }));
      if (k.L > p.tisk.podlozka - 10) chyba(['klin.sklon', 'tisk.podlozka'], `Klín je dlouhý ${fmt(k.L, 0)} mm – na podložku ${fmt(p.tisk.podlozka)} mm se nevejde. Zvětšete sklon.`, opr({ 'klin.sklon': Math.ceil(deg(Math.atan((k.hZad - k.s) / (p.tisk.podlozka - 20)))) }));
      // tření: klín drží, když tg α ≤ μ (s bezpečností 1,4 → tg α ≤ 0,7 μ)
      const navrh = Math.floor(deg(Math.atan(0.7 * mk.mu)) * 2) / 2;
      if (k.ta > mk.mu) chyba(['klin.sklon', 'tisk.material', 'klin.spodek'], `Při sklonu ${fmt(q.sklon, 1)}° klín po podlaze „${PODLAHY[q.podlaha].nazev}“ ujede (tg α = ${fmt(k.ta, 2)} > μ ≈ ${fmt(mk.mu, 2)}). Zmenšete sklon na ${fmt(navrh, 1)}°, tiskněte z TPU nebo dejte pryžové nožičky.`, opr({ 'klin.sklon': Math.max(4, navrh) }));
      else if (k.ta > 0.7 * mk.mu) var_(['klin.sklon'], `Sklon ${fmt(q.sklon, 1)}° je blízko meze prokluzu (${fmt(mk.alfaMax, 1)}° pro μ ≈ ${fmt(mk.mu, 2)}) – na prašné podlaze může klín ujet.`, opr({ 'klin.sklon': Math.max(4, navrh) }));
      if (mat.tvrdy && q.spodek !== 'kapsy') info(['tisk.material'], 'Klín z tvrdého plastu na hladké podlaze klouže – nejlépe drží TPU (pružné), nebo tvrdý klín s pryžovými nožičkami.');
      if (q.spodek === 'drazky' && !k.drazky.length) var_(['klin.hloubka', 'klin.roztec'], 'Klín je na drážky příliš krátký nebo tenký – žádná se nevešla.');
      if (q.spodek === 'kapsy' && !k.kapsy.length) chyba(['klin.nozickaH', 'klin.nozickaD'], 'Kapsy na nožičky se do klínu nevejdou – zmenšete nožičky nebo prodlužte klín.', opr({ 'klin.nozickaH': 0.8 }));
      if (q.spodek === 'kapsy') info(['klin.nozickaH'], `Samolepicí pryžové nožičky Ø ${fmt(q.nozickaD)} mm vlepte do kapsek hloubky ${fmt(q.nozickaH, 1)} mm – mají z nich vyčnívat aspoň 1 mm (nožičky výšky ≥ ${fmt(q.nozickaH + 1, 1)} mm).`);
      if (k.text && k.text.h < 4) var_(['klin.sirka', 'klin.vyskaTextu'], 'Na text je klín úzký – písmena menší než 4 mm budou nečitelná.', opr({ 'klin.text': '' }));
      if (k.text && k.text.x1 - k.text.x0 < 12) var_(['klin.text', 'klin.sklon'], 'Na text zbývá na šikmé ploše málo místa – zkraťte ho nebo zmenšete sklon.', opr({ 'klin.text': '' }));
      if (!mat.tvrdy) info(['tisk.material'], 'TPU tiskněte pomalu (20–30 mm/s), bez retrakcí nebo s krátkými; výplň 20–40 % – klín se pod dveřmi trochu stlačí a drží lépe.');
      info(null, `Tisková poloha: klín leží spodkem na podložce, šikmá plocha nahoru. V-drážky na spodku mají boky 45°, takže se tisknou bez podpor${q.spodek === 'kapsy' ? '; strop kapes na nožičky tiskárna přemostí' : ''}. Očko je svislá díra.`);
    } else if (p.druh === 'magnet') {
      const r = o.mag, q = p.magnet, pk = r.pk, v = r.v;
      if (r.rk + 1.2 > r.Rs) chyba(['magnet.prumer', 'magnet.magnetD'], `Magnet Ø ${fmt(q.magnetD)} se do sloupku Ø ${fmt(q.prumer)} nevejde (stěna aspoň 1,2 mm).`, opr({ 'magnet.prumer': Math.ceil(2 * (r.rk + 2)) }));
      if (r.oring && r.oring.celo && r.oring.ro + 1.2 > r.Rs) chyba(['magnet.prumer', 'magnet.oringD'], 'Drážka O-kroužku se na čelo sloupku nevejde – zvětšete průměr sloupku nebo zvolte TPU kroužek.', opr({ 'magnet.prumer': Math.ceil(2 * (r.oring.ro + 1.6)) }));
      if (r.oring && !r.oring.celo && r.Rs - r.oring.hl < r.rk + 1.2) chyba(['magnet.prumer'], 'Boční drážka O-kroužku by se protnula s kapsou magnetu.', opr({ 'magnet.prumer': Math.ceil(2 * (r.rk + r.oring.hl + 1.6)) }));
      if (r.zk0 < r.tp + 1) chyba(['magnet.vyska', 'magnet.magnetH'], 'Sloupek je na magnet nízký – kapsa zasahuje do příruby.', opr({ 'magnet.vyska': Math.ceil(r.tp + r.hk + 3) }));
      if (r.oring && !r.oring.celo && r.oring.z0 < r.zk1 - r.hk - 0.5 && r.oring.z0 < r.tp + r.c + 1) chyba(['magnet.vyska'], 'Na boční drážku O-kroužku je sloupek nízký.', opr({ 'magnet.vyska': Math.ceil(r.Ht + 6) }));
      if (q.uchyceni === 'srouby') {
        if (r.rd + v.rh + 1.2 > r.Rp) chyba(['magnet.priruba'], `Hlavy vrutů se na přírubu Ø ${fmt(2 * r.Rp)} nevejdou – potřeba aspoň Ø ${fmt(Math.ceil(2 * (r.rd + v.rh + 1.5)))}.`, opr({ 'magnet.priruba': Math.ceil(2 * (r.rd + v.rh + 1.5)) }));
        if (v.zap && r.tp < v.hz + 1) chyba(['magnet.tlPriruby', 'sroub.hlava'], `Příruba ${fmt(r.tp, 1)} mm je na zápustnou hlavu vrutu ${fmt(v.d)} (kužel ${fmt(v.hz, 1)} mm) tenká.`, opr({ 'magnet.tlPriruby': Math.ceil((v.hz + 1.2) * 2) / 2 }));
      } else if (r.Rp < r.Rs + 6) var_(['magnet.priruba'], 'Na pásku je příruba malá – zvětšete ji kvůli ploše lepení.', opr({ 'magnet.priruba': Math.ceil(2 * r.Rs + 20) }));
      if (q.montaz === 'stena') {
        if (pk.z0 < (q.uchyceni === 'srouby' && v.zap ? 0.8 : 0.8)) chyba(['magnet.protikusTl'], `Terčík protikusu (${fmt(pk.tl, 1)} mm) je na kapsu ${fmt(pk.hk, 1)} mm tenký.`, opr({ 'magnet.protikusTl': Math.ceil(pk.hk + (q.vlozeni === 'pauza' ? q.kryti : 0) + 1.5) }));
        if (q.uchyceni === 'srouby' && v.zap && pk.tl < v.hz + 1) chyba(['magnet.protikusTl', 'sroub.hlava'], 'Terčík je na zápustnou hlavu vrutu tenký.', opr({ 'magnet.protikusTl': Math.ceil(v.hz + 1.5) }));
      } else {
        const zVrut = v ? pk.zDole + pk.zs - v.rh : Infinity;
        if (zVrut < p.dvere.mezera + 3) chyba(['magnet.vyska', 'dvere.mezera'], `Vruty úhelníku (${fmt(zVrut, 0)} mm nad podlahou) by šly pod spodní hranu dveří (${fmt(p.dvere.mezera)} mm) – zvyšte sloupek.`, opr({ 'magnet.vyska': Math.ceil(r.Ht + p.dvere.mezera + 3 - zVrut + 1) }));
        if (r.Rp > pk.cx + pk.tpl && r.tp > p.dvere.mezera - 1) chyba(['magnet.priruba', 'magnet.tlPriruby'], `Dveře (spodní hrana ${fmt(p.dvere.mezera)} mm nad podlahou) narazí do příruby sloupku – zmenšete přírubu.`, opr({ 'magnet.priruba': Math.floor(2 * (pk.cx + pk.tpl - 0.5)) }));
        if (q.mezera < 0.8) var_(['magnet.mezera'], 'Mezera pod jazykem je malá – jazyk bude o sloupek drhnout.', opr({ 'magnet.mezera': 1.5 }));
      }
      const mm = m.magnet;
      if (mm.F < 3) var_(['magnet.magnetD', 'magnet.magnetH', 'magnet.vlozeni'], `Magnet přes mezeru ${fmt(r.mezera, 1)} mm udrží jen asi ${fmt(mm.F, 1)} N – dveře se snadno utrhnou. Zvětšete magnet nebo zmenšete mezeru (zalisovat místo zakrytí).`);
      if (m.uchyceni && m.uchyceni.vyuziti > 1) var_(['dvere.rychlost', 'magnet.tlumeni', 'sroub.podklad'], `${m.uchyceni.coNese}: ráz rozražených dveří ${fmt(m.uchyceni.potreba, 0)} N je víc než únosnost ${fmt(m.uchyceni.kapacita, 0)} N – dejte měkčí tlumení nebo silnější uchycení.`, q.tlumeni !== 'tpu' ? opr({ 'magnet.tlumeni': 'tpu' }) : undefined);
      if (m.sloupek && m.sloupek.vyuziti > 1) var_(['magnet.prumer', 'magnet.tlumeni'], `Při rázu se sloupek ohne nad mez (${fmt(m.sloupek.sigma, 1)} MPa, dovoleno ${fmt(m.sloupek.dov, 1)} MPa napříč vrstvami) – zesilte ho nebo dejte TPU kroužek.`, opr({ 'magnet.prumer': Math.min(80, Math.ceil(q.prumer * 1.25)) }));
      if (q.vlozeni === 'pauza') info(['magnet.vlozeni'], `Pauza tisku: sloupek – před vrstvou ve výšce ${fmt(r.pauza, 2)} mm${pk.pauza ? `, protikus – před vrstvou ${fmt(pk.pauza, 2)} mm` : ''} (vrstva ${fmt(p.tisk.vrstva, 2)} mm). Vložte magnet${pk.magnet ? 'y (pozor na polaritu – protilehlé póly k sobě)' : ' a ocelovou podložku'} a pokračujte; magnet přidržte kapkou lepidla, ať ho tryska nestrhne.`);
      else info(['magnet.vule'], `Magnet zalisujte do kapsy (vůle ${fmt(q.vule, 2)} mm na poloměr) – nejdřív si vytiskněte kalibrační vzorek a vůli upravte. Na volnou kapsu kapka vteřinového lepidla.`);
      if (pk.magnet) info(['magnet.protikus'], 'Dva magnety: obraťte je k sobě opačnými póly – jinak se odpuzují.');
      info(['magnet.trida'], `Přídržná síla magnetu je orientační (katalogový vzorec, ±30 %) – závisí na kvalitě magnetu, tloušťce a rovinnosti protikusu.`);
      info(null, q.montaz === 'stena'
        ? 'Tisková poloha: sloupek stojí přírubou na podložce, kapsa magnetu je nahoře (bez podpor); terčík leží zadní stranou dolů. Svislé díry pro vruty mají zápustný kužel nahoře.'
        : `Tisková poloha: sloupek stojí přírubou na podložce; úhelník leží jazykem na podložce, deska stojí – díry pro vruty v desce jsou vodorovné${kr ? ' a kruhové (strop převisá)' : ' a mají tvar kapky se špičkou nahoru'}.`);
      if (kr && q.montaz === 'podlaha' && q.uchyceni === 'srouby') info(['diry'], 'Kruhové vodorovné díry mají převislý strop – tiskněte s podporami nebo zvolte kapku.');
      if (r.tpu && mat.tvrdy) info(['magnet.tlumeni'], 'TPU kroužek tiskněte zvlášť z pružného filamentu (TPU 85–95A) – v exportu je samostatný díl.');
    } else if (p.aretace.typ === 'hreben') {
      const h = o.hreben, a = p.aretace;
      for (let i = 1; i < h.xs.length; i++) if (h.xs[i] - h.xs[i - 1] < h.wn + 2.5) { chyba(['aretace.polohy'], `Polohy ${fmt(h.pol[i - 1])} a ${fmt(h.pol[i])} mm jsou moc blízko – zářezy pro kolík Ø ${fmt(a.kolikD)} se slijí (potřeba odstup ≥ ${fmt(h.wn + 2.5, 1)} mm).`); break; }
      if (h.xs[0] - h.wn / 2 < h.Rb + 2) chyba(['aretace.vzdalenost', 'aretace.polohy'], 'První zářez zasahuje do oka ramene – zvětšete vzdálenost čepu od kolíku.', opr({ 'aretace.vzdalenost': Math.ceil(h.Rb + 2 + h.wn / 2 - h.pol[0] + 1) }));
      if (h.zbytek < 0.3 * h.hb) chyba(['aretace.vyskaRamene', 'aretace.kolikD'], `Nad zářezem zbývá jen ${fmt(h.zbytek, 1)} mm materiálu – rameno se zlomí. Zvyšte rameno.`, opr({ 'aretace.vyskaRamene': Math.ceil((1.1 * a.kolikD + 2 * a.vule) / 0.65 + 1) }));
      if (a.odsazeni > a.distanc - 0.5) chyba(['aretace.odsazeni', 'aretace.distanc'], `Křídlo je o ${fmt(a.odsazeni, 1)} mm výš než rám – patka kolíku by narazila do ramene. Zvedněte rameno distančním kroužkem.`, opr({ 'aretace.distanc': Math.ceil(a.odsazeni + 1) }));
      if (h.kolVrch - h.pKol.tpb < 2) chyba(['aretace.odsazeni'], 'Kolík by byl kratší než 2 mm.');
      if (a.vule < 0.2) var_(['aretace.vule'], 'Malá vůle zářezu – rameno půjde na kolík ztuha.', opr({ 'aretace.vule': 0.4 }));
      if (h.Lr > p.tisk.podlozka - 10) chyba(['aretace.polohy', 'tisk.podlozka'], `Rameno je dlouhé ${fmt(h.Lr, 0)} mm – na podložku se nevejde.`);
      const mh = m.hreben;
      if (mh.sigK > mh.dovK) var_(['aretace.kolikD'], `Kolík při větru ${fmt(a.vitr)} m/s nese ${fmt(mh.F, 0)} N a ohne se nad mez (${fmt(mh.sigK, 1)} MPa > ${fmt(mh.dovK, 1)} MPa) – zvětšete průměr kolíku nebo dejte kovový kolík.`, opr({ 'aretace.kolikD': Math.min(20, Math.ceil(a.kolikD * Math.cbrt(mh.sigK / mh.dovK) + 0.5)) }));
      if (mh.uchyceni.vyuziti > 1) var_(['sroub.podklad', 'sroub.vrut'], `Vruty patky nesou ${fmt(mh.F, 0)} N – víc než ${fmt(mh.uchyceni.kapacita, 0)} N.`);
      info(['aretace.polohy'], `Polohy zářezů = vzdálenost čepu od kolíku při zavřeném křídle + pootevření (lineární přiblížení – rameno má vést zhruba ve směru otevírání). Úhel křídla: ${mh.pol.map(x => fmt(x.uhel, 0) + '°').join(' / ')}.`);
      info(null, 'Tisková poloha: rameno naplocho, patky deskou dolů s čepem / kolíkem nahoru – vše bez podpor. Rameno na čepu zajistěte podložkou a vrutem 3 do středu čepu.');
    } else {
      const r = o.nabytek, n = p.nabytek;
      if (r.kapsa) {
        if (r.kapsa.h > r.tw - 1) chyba(['nabytek.tl'], `Stěna dorazu ${fmt(r.tw, 1)} mm je na kapsu hloubky ${fmt(r.kapsa.h, 1)} mm tenká.`, opr({ 'nabytek.tl': Math.ceil(r.kapsa.h + 1.6) }));
        if (2 * r.kapsa.r + 2 > r.b) chyba(['nabytek.sirka'], 'Kapsa je širší než doraz.', opr({ 'nabytek.sirka': Math.ceil(2 * r.kapsa.r + 6) }));
        if (r.kapsa.z + r.kapsa.r * (kr ? 1 : Math.SQRT2) > r.hw - 0.8 || r.kapsa.z - r.kapsa.r < r.tp + 0.5) chyba(['nabytek.vyska'], 'Kapsa se do výšky dorazu nevejde – zvyšte ho.', opr({ 'nabytek.vyska': Math.ceil(r.tp + 2 * r.kapsa.r * 1.5 + 3) }));
      }
      if (r.v.zap && r.tp < r.v.hz + 1) chyba(['nabytek.tl'], 'Deska je na zápustnou hlavu tenká.', opr({ 'nabytek.tl': Math.ceil(r.v.hz + 1.5) }));
      const mn = m.nabytek;
      if (mn.vyuziti > 1) var_(['nabytek.tl', 'nabytek.narazy'], `Při nárazu ${fmt(mn.F, 0)} N se stěna dorazu ohne nad mez (${fmt(mn.sigma, 1)} MPa > ${fmt(mn.dov, 1)} MPa napříč vrstvami) – zesilte ji nebo dejte nárazník.`, opr({ 'nabytek.tl': Math.min(15, Math.ceil(n.tl * Math.sqrt(mn.vyuziti) + 0.5)) }));
      if (n.narazy === 'magnet') info(['nabytek.narazy'], 'Na dvířka / šuplík proti magnetu nalepte nebo přišroubujte ocelový plíšek (podložku). Magnet v kapsě zajistěte lepidlem – kapsa je vodorovná a má tvar kapky.');
      info(null, `Tisková poloha: deska na podložce, stěna dorazu stojí; výztuha 45°. Kapsa ve stěně je vodorovná${kr ? ' a kruhová (strop převisá)' : ' – tvar kapky se špičkou nahoru'}.`);
    }
    if (m.uchyceni && p.druh === 'aretace' && m.uchyceni.vyuziti > 1 && p.aretace.typ === 'nabytek') var_(['sroub.vrut', 'sroub.podklad'], `${m.uchyceni.coNese}: náraz ${fmt(m.uchyceni.potreba, 0)} N > ${fmt(m.uchyceni.kapacita, 0)} N.`);
    if (p.tisk.material === 'TPU' && p.druh !== 'klin') var_(['tisk.material'], 'Z TPU je zarážka / aretace měkká a díry pro vruty se roztáhnou – tiskněte z PETG nebo ASA (TPU jen na tlumicí kroužek a klín).', opr({ 'tisk.material': 'PETG' }));
    if (p.tisk.material === 'PLA') info(['tisk.material'], 'PLA na slunci (okno) a u topení měkne – lepší je PETG nebo ASA.');
    return dokonci(H);
  }
  const POPISKY = {
    'klin.hMax': h => `mezera max ${fmt(h)} mm`, 'klin.spicka': h => `špička ${fmt(h, 1)} mm`, 'klin.sklon': h => `sklon ${fmt(h, 1)}°`, 'klin.nozickaH': h => `kapsy ${fmt(h, 1)} mm`, 'klin.text': () => 'bez textu',
    'magnet.prumer': h => `sloupek Ø ${fmt(h)}`, 'magnet.vyska': h => `sloupek ${fmt(h)} mm`, 'magnet.priruba': h => (h > 0 ? `příruba Ø ${fmt(h)}` : 'příruba automaticky'), 'magnet.tlPriruby': h => `příruba ${fmt(h, 1)} mm`,
    'magnet.protikusTl': h => `terčík ${fmt(h, 1)} mm`, 'magnet.mezera': h => `mezera ${fmt(h, 1)} mm`, 'magnet.tlumeni': h => NAZVY.tlumeni[h],
    'aretace.polohy': h => `polohy ${h}`, 'aretace.vzdalenost': h => `vzdálenost ${fmt(h)} mm`, 'aretace.vyskaRamene': h => `rameno ${fmt(h)} mm`, 'aretace.distanc': h => `distanc ${fmt(h, 1)} mm`,
    'aretace.vule': h => `vůle ${fmt(h, 1)} mm`, 'aretace.kolikD': h => `kolík Ø ${fmt(h)}`,
    'nabytek.tl': h => `stěna ${fmt(h, 1)} mm`, 'nabytek.sirka': h => `šířka ${fmt(h)} mm`, 'nabytek.vyska': h => `výška ${fmt(h)} mm`,
    'tisk.material': h => MATERIALY[h].nazev,
  };
  const textOpravy = zmeny => Object.entries(zmeny).map(([c, h]) => (POPISKY[c] ? POPISKY[c](h) : `${c} ${h}`)).join(', ');
  function dokonci(H) {
    for (const h of H) if (h.oprava && !h.oprava.text) h.oprava.text = textOpravy(h.oprava.zmeny);
    return H;
  }

  /* ---------------- stavba těles ---------------- */
  /** Text (opentype.js) → polygony v mm (výška verzálek h) – jako cleat/geometrie.js. */
  function textPolygony(font, text, h) {
    if (!font || !text) return null;
    const upm = font.unitsPerEm || 2048, cap = (font.tables && font.tables.os2 && font.tables.os2.sCapHeight) || upm * 0.72;
    const path = font.getPath(String(text), 0, 0, h * upm / cap), polys = [];
    let cur = null, x = 0, y = 0;
    const add = (a, b) => { x = a; y = b; cur.push([a, -b]); };
    for (const c of path.commands) {
      if (c.type === 'M') { if (cur && cur.length > 2) polys.push(cur); cur = []; add(c.x, c.y); }
      else if (c.type === 'L') add(c.x, c.y);
      else if (c.type === 'Q') { const x0 = x, y0 = y; for (let i = 1; i <= 6; i++) { const t = i / 6, u = 1 - t; add(u * u * x0 + 2 * u * t * c.x1 + t * t * c.x, u * u * y0 + 2 * u * t * c.y1 + t * t * c.y); } }
      else if (c.type === 'C') { const x0 = x, y0 = y; for (let i = 1; i <= 8; i++) { const t = i / 8, u = 1 - t; add(u * u * u * x0 + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x, u * u * u * y0 + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y); } }
      else if (c.type === 'Z') { if (cur && cur.length > 2) polys.push(cur); cur = null; }
    }
    if (cur && cur.length > 2) polys.push(cur);
    if (!polys.length) return null;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of polys) for (const [a, b] of q) { x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); }
    return { polys, x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
  }
  /** Obrys vodorovné díry v rovině (a, c), c = nahoru v tisku: kapka (špička nahoru) nebo kruh. */
  const obrysDiry = (r, kruh) => G.obrysDiry(r, 32, !kruh);
  /** 4×4 matice (sloupce) pro Manifold.transform. */
  const MAT = {
    xz: y1 => [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, y1, 0, 1],     // průřez (x, z) vytažený přes y ∈ [y1 − b, y1]
    yz: x0 => [0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, x0, 0, 0, 1],      // průřez (y, z) vytažený podél x od x0
  };

  function postav(w, p, volby = {}) {
    const t0 = Date.now(), o = odvozene(p);
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const seg = r => Math.max(24, Math.min(128, Math.ceil(2 * Math.PI * r / 0.7 / 4) * 4));
    const kruhB = (r, cx = 0, cy = 0, n = seg(r)) => { const ro = r / Math.cos(Math.PI / n); return Array.from({ length: n }, (_, i) => { const a = 2 * Math.PI * i / n; return [cx + ro * Math.cos(a), cy + ro * Math.sin(a)]; }); };
    const nas = {
      M, CS, k, seg,
      poly: b => k(new CS([b], 'NonZero')),
      kruh: (r, cx, cy) => k(new CS([kruhB(r, cx, cy)], 'NonZero')),
      valec: (r, z0, z1, x = 0, y = 0) => k(k(k(new CS([kruhB(r)], 'NonZero')).extrude(z1 - z0)).translate([x, y, z0])),
      kuzel: (r0, r1, z0, z1, x = 0, y = 0) => { const n = seg(Math.max(r0, r1)), c = 1 / Math.cos(Math.PI / n); return k(k(M.cylinder(z1 - z0, r0 * c, r1 * c, n)).translate([x, y, z0])); },
      kvadr: (x0, x1, y0, y1, z0, z1) => k(k(M.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0])),
      xz: (cs, y0, y1) => k(k(cs.extrude(y1 - y0)).transform(MAT.xz(y1))),
      yz: (cs, x0, x1) => k(k(cs.extrude(x1 - x0)).transform(MAT.yz(x0))),
      sjed: l => (l.length === 1 ? l[0] : k(M.union(l))),
      odecti: (m, l) => (l.length ? k(m.subtract(l.length === 1 ? l[0] : k(M.union(l)))) : m),
      obal: body => k(M.hull(body)),
      otoc: body => k(k(new CS([body], 'NonZero')).revolve(seg(Math.max(...body.map(q => q[0]))))),
      /** svislá díra pro vrut s horní plochou z1 (zápustný kužel 90° nahoře) */
      diraSvisla: (x, y, z1, v, zDolu = -1) => {
        const l = [nas.valec(v.ro, zDolu, z1 + 0.01, x, y)];
        if (v.hz > 0) l.push(nas.kuzel(v.ro, v.rh, z1 - v.hz, z1 + 0.001, x, y), nas.valec(v.rh, z1, z1 + 30, x, y));
        return l;
      },
    };
    try {
      let r;
      if (p.druh === 'klin') r = postavKlin(nas, o.klin, p, volby.pismo);
      else if (p.druh === 'magnet') r = postavMagnet(nas, o.mag, p);
      else if (p.aretace.typ === 'hreben') r = postavHreben(nas, o.hreben, p);
      else r = postavNabytek(nas, o.nabytek, p);
      const kalibrace = [];
      const chceKal = volby.kalibrace || p.tisk.kalibrace;
      if (chceKal && maKalibraci(p)) kalibrace.push(postavKalibraci(nas, p));
      const out = r.dily.map(d => Object.assign(sit(k, d.m, d.jmeno, d.nazev, d.barva, d.prevod), { tpu: !!d.tpu, obrys: d.obrys || null }));
      const kal = kalibrace.map(d => sit(k, d.m, d.jmeno, d.nazev, d.barva, d.prevod));
      return { o, dily: out, kalibrace: kal, sestava: r.okoli.concat(out.map(d => Object.assign({}, d, { poz: d.pozSestava }))), text: r.text || null, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }
  /** Kalibrační vzorek kapsy magnetu dává smysl jen tam, kde se magnet lisuje. */
  const maKalibraci = p => (p.druh === 'magnet' && p.magnet.vlozeni === 'lisovany') || (p.druh === 'aretace' && p.aretace.typ === 'nabytek' && p.nabytek.narazy === 'magnet');

  /* ---- klín ---- */
  function postavKlin(n, r, p, font) {
    const q = p.klin, b = r.b;
    const profil = n.poly([[0, 0], [r.L, 0], [r.L, r.hZad], [0, r.s]]);
    let telo = n.xz(profil, -b / 2, b / 2);
    const plus = [], minus = [];
    if (r.oko) {
      const ok = r.oko;
      const tab = n.k(n.CS.hull([n.kruh(ok.Ro, ok.x, 0), n.poly([[r.L - 2, -ok.Ro], [r.L - 0.01, -ok.Ro], [r.L - 0.01, ok.Ro], [r.L - 2, ok.Ro]])]));
      plus.push(n.k(n.k(n.k(tab.subtract(n.kruh(ok.ro, ok.x, 0))).extrude(ok.t))));
    }
    if (plus.length) telo = n.sjed([telo, ...plus]);
    // V-drážky napříč (boky 45°)
    const hl = q.hloubka;
    for (const x of r.drazky) minus.push(n.xz(n.poly([[x - hl - 0.02, -0.02], [x + hl + 0.02, -0.02], [x, hl]]), -b / 2 - 1, b / 2 + 1));
    for (const kp of r.kapsy) minus.push(n.valec(kp.r, -0.5, kp.h, kp.x, kp.y));
    // ražený text na šikmé ploše
    let text = null;
    if (r.text && font) {
      const T = r.text;
      let tx = textPolygony(font, q.text, T.h);
      const delka = (T.x1 - T.x0) / Math.cos(r.a);
      if (tx && tx.w > delka) tx = textPolygony(font, q.text, T.h * delka / tx.w);
      if (tx) {
        const u0 = (T.x0 / Math.cos(r.a) + (delka - tx.w) / 2) - tx.x0, v0 = -(tx.y0 + tx.h / 2);
        const cs = n.k(new n.CS(tx.polys.map(pp => pp.map(([a, c]) => [a + u0, c + v0])), 'EvenOdd'));
        const ca = Math.cos(r.a), sa = Math.sin(r.a), d = T.hl;
        // rám šikmé plochy: u podél spádu od špičky (bod (0, s)), v = y, w = normála ven; dno písmen v hloubce d
        const A = [ca, 0, sa, 0, 0, 1, 0, 0, -sa, 0, ca, 0, d * sa, 0, r.s - d * ca, 1];
        minus.push(n.k(n.k(cs.extrude(d + 1)).transform(A)));
        text = { vyska: tx.h, sirka: tx.w };
      }
    }
    telo = n.odecti(telo, minus);
    const dily = [{ m: telo, jmeno: 'klin', nazev: 'Klín pod dveře', barva: '#E2A23B' }];
    // okolí: podlaha a dveře v místě styku (střed rozsahu mezer)
    const hD = (q.hMin + q.hMax) / 2, xc = (hD - r.s) / r.ta, W = Math.max(b * 2.5, 100);
    const okoli = [kvadr(xc - 40, xc, -W / 2, W / 2, hD, hD + 70, 'Dveře', BARVA_DVERI)];
    return { dily, okoli, text };
  }

  /* ---- zarážka s magnetem ---- */
  function postavMagnet(n, r, p) {
    const q = p.magnet, kr = p.diry === 'kruh';
    const dily = [], okoli = [];
    // sloupek: rotační profil (r, z) – příruba, náběh 45°, sloupek, sražení čela
    const c = r.c, ch = 0.8, prof = [[0, 0], [r.Rp, 0], [r.Rp, r.tp], [r.Rs + c, r.tp], [r.Rs, r.tp + c]];
    if (r.oring && !r.oring.celo) { const g = r.oring; prof.push([r.Rs, g.z0], [r.Rs - g.hl, g.z0], [r.Rs - g.hl, g.z1], [r.Rs, g.z1 + g.hl]); }
    prof.push([r.Rs, r.Ht - ch], [r.Rs - ch, r.Ht], [0, r.Ht]);
    let sl = n.otoc(prof);
    const minus = [n.valec(r.rk, r.zk0, r.zk1)];
    if (r.oring && r.oring.celo) minus.push(n.otoc([[r.oring.ri, r.Ht - r.oring.hl], [r.oring.ro, r.Ht - r.oring.hl], [r.oring.ro, r.Ht + 1], [r.oring.ri, r.Ht + 1]]));
    if (r.v) for (const d of r.diry) minus.push(...n.diraSvisla(d.x, d.y, r.tp, r.v));
    sl = n.odecti(sl, minus);
    const stena = q.montaz === 'stena', hS = 100;
    // převody tisk → sestava
    const naZed = x0 => ({ sestava: (x, y, z) => [z + x0, y, hS - x] });             // osa z → +X od zdi
    const protiZdi = x0 => ({ sestava: (x, y, z) => [x0 - z, y, hS + x] });          // vrch (z) → −X (ke zdi)
    dily.push({ m: sl, jmeno: 'zarazka', nazev: stena ? 'Nástěnná zarážka' : 'Podlahová zarážka', barva: '#4F86D9', prevod: stena ? naZed(0) : null });
    if (r.tpu) {
      const t = r.tpu;
      const m = n.otoc([[t.ri, 0], [t.Ro - 0.6, 0], [t.Ro, 0.6], [t.Ro, t.h - 0.6], [t.Ro - 0.6, t.h], [t.ri, t.h]]);
      dily.push({ m, jmeno: 'tpu', nazev: 'Tlumicí kroužek (TPU)', barva: '#3E9B5A', tpu: true, prevod: stena ? naZed(r.Ht - t.h + t.presah) : { sestava: (x, y, z) => [x, y, z + r.Ht - t.h - 0.3] } });
    }
    const pk = r.pk;
    if (stena) {
      const prof2 = [[0, 0], [pk.Rk, 0], [pk.Rk, pk.tl - 0.6], [pk.Rk - 0.6, pk.tl], [0, pk.tl]];
      let t = n.otoc(prof2);
      const mi = [n.valec(pk.rk, pk.z0, pk.z1)];
      if (r.v) for (const d of pk.diry) mi.push(...n.diraSvisla(d.x, d.y, pk.tl, r.v));
      t = n.odecti(t, mi);
      const Xf = r.Ht + r.odsazeni;
      dily.push({ m: t, jmeno: 'protikus', nazev: 'Protikus na dveře (terčík)', barva: '#E88A2E', prevod: protiZdi(Xf + pk.tl) });
      const W = 200;
      okoli.push(kvadr(-12, 0, -W / 2, W / 2, 0, hS + 100, 'Zeď', BARVA_ZDI), kvadr(Xf + pk.tl, Xf + pk.tl + 40, -W / 2 + 60, W / 2, p.dvere.mezera, hS + 100, 'Dveře', BARVA_DVERI));
    } else {
      // úhelník: průřez (x, z) – deska x ∈ [−tpl, 0], jazyk z ∈ [0, tj], výztuha 45°
      const L = n.poly([[-pk.tpl, 0], [pk.vyl, 0], [pk.vyl, pk.tj - 0.6], [pk.vyl - 0.6, pk.tj], [pk.g, pk.tj], [0, pk.tj + pk.g], [0, pk.Hp - 0.6], [-0.6, pk.Hp], [-pk.tpl, pk.Hp]]);
      let u = n.xz(L, -pk.b / 2, pk.b / 2);
      const mi = [n.valec(pk.rk, pk.z0, pk.z1, pk.cx, 0)];
      if (r.v) for (const d of pk.diry) {
        const kp = obrysDiry(r.v.ro, kr);
        mi.push(n.yz(n.poly(kp.map(([a, cc]) => [d.y + a, d.z + cc])), -pk.tpl - 1, 0.01));
        if (r.v.hz > 0) {
          const ro = obrysDiry(r.v.ro, kr), rh = obrysDiry(r.v.rh, kr), f = (b2, x) => b2.map(([a, cc]) => [x, d.y + a, d.z + cc]);
          mi.push(n.obal([...f(ro, -r.v.hz), ...f(rh, 0.001), ...f(rh, 12)]));
        } else mi.push(n.yz(n.poly(obrysDiry(r.v.rh, kr).map(([a, cc]) => [d.y + a, d.z + cc])), 0, 12));
      }
      u = n.odecti(u, mi);
      dily.push({ m: u, jmeno: 'protikus', nazev: 'Úhelník na dveře', barva: '#E88A2E', prevod: { sestava: (x, y, z) => [x - pk.cx, y, z + pk.zDole] } });
      const W = 200, xd = -pk.cx - pk.tpl;
      okoli.push(kvadr(xd - 40, xd, -W / 2, W / 2, p.dvere.mezera, pk.zDole + pk.Hp + 50, 'Dveře', BARVA_DVERI));
    }
    return { dily, okoli };
  }

  /* ---- ventilační hřeben ---- */
  function postavHreben(n, h, p) {
    const a = p.aretace;
    // rameno: obrys (x, y) vytažený o tloušťku tr
    const hb = h.hb, R = h.Rb;
    let cs = n.k(n.CS.hull([n.kruh(R, 0, 0), n.poly([[R * 0.5, -hb / 2], [R * 0.5, hb / 2], [R * 0.5 + 0.1, hb / 2], [R * 0.5 + 0.1, -hb / 2]])]));
    cs = n.k(n.CS.union([cs, n.poly([[0, -hb / 2], [h.Lr - hb / 2, -hb / 2], [h.Lr - hb / 2, hb / 2], [0, hb / 2]]), n.kruh(hb / 2, h.Lr - hb / 2, 0)]));
    const zar = [n.kruh(h.rc, 0, 0)];
    for (const x of h.xs) {
      const w2 = h.wn / 2;
      zar.push(n.poly([[x - w2, -hb / 2 - 1], [x + w2, -hb / 2 - 1], [x + w2, h.yC], [x - w2, h.yC]]), n.kruh(w2, x, h.yC));
      zar.push(n.poly([[x - w2 - 1, -hb / 2 - 0.01], [x + w2 + 1, -hb / 2 - 0.01], [x + w2, -hb / 2 + 1], [x - w2, -hb / 2 + 1]]));   // náběh ústí
    }
    cs = n.k(cs.subtract(n.k(n.CS.union(zar))));
    const rameno = n.k(cs.extrude(h.tr));
    const obrys = cs.toPolygons().map(q => Array.from(q, b2 => [b2[0], b2[1]]));
    const xk = h.xs[h.nahled];
    const dily = [{ m: rameno, jmeno: 'rameno', nazev: 'Rameno se zářezy', barva: '#4F86D9', prevod: { sestava: (x, y, z) => [x, y, z + h.zRamene] }, obrys }];
    // patka s čepem (rám) a patka s kolíkem (křídlo)
    const patka = (P, rPin, zTop, vodici, nazev, jmeno, barva, prevod) => {
      const v = h.v;
      let m = n.xz(n.poly([[-P.L / 2, 0], [P.L / 2, 0], [P.L / 2, P.tpb - 0.5], [P.L / 2 - 0.5, P.tpb], [-P.L / 2 + 0.5, P.tpb], [-P.L / 2, P.tpb - 0.5]]), -P.W / 2, P.W / 2);
      const prof = [[0, P.tpb - 0.01]];
      if (jmeno === 'cep' && a.distanc > 0.05) prof.push([P.rcol, P.tpb - 0.01], [P.rcol, h.zRamene], [rPin, h.zRamene]);
      else prof.push([rPin + 1.5, P.tpb - 0.01], [rPin, P.tpb + 1.5]);
      const sr = Math.min(0.8, rPin * 0.2), sraz = jmeno === 'kolik' ? Math.min(1, rPin * 0.3) : sr;
      prof.push([rPin, zTop - sraz], [rPin - sraz, zTop], [0, zTop]);
      m = n.sjed([m, n.otoc(prof)]);
      const mi = [];
      for (const s of [-1, 1]) mi.push(...n.diraSvisla(s * P.xs, 0, P.tpb, v));
      if (vodici > 0) mi.push(n.valec(1.25, zTop - vodici, zTop + 1));
      m = n.odecti(m, mi);
      return { m, jmeno, nazev, barva, prevod };
    };
    dily.push(patka(h.pCep, a.cepD / 2, h.cepVrch, h.vodici, 'Patka s čepem (na rám)', 'cep', '#E88A2E', null));
    dily.push(patka(h.pKol, a.kolikD / 2, h.kolVrch, 0, 'Patka s kolíkem (na křídlo)', 'kolik', '#E88A2E', { sestava: (x, y, z) => [x + xk, y + h.yC, z + a.odsazeni] }));
    // okolí: rám a křídlo (mezera mezi nimi v půli vzdálenosti)
    const xm = Math.min(a.vzdalenost / 2, xk - h.pKol.L / 2 - 2);
    const okoli = [kvadr(-60, xm - 1, -60, 60, -20, -0.01, 'Rám', BARVA_DVERI), kvadr(xm + 1, h.Lr + 60, -60, 60, -20 + a.odsazeni, a.odsazeni - 0.01, 'Křídlo', BARVA_KRIDLA)];
    return { dily, okoli };
  }

  /* ---- doraz nábytku ---- */
  function postavNabytek(n, r, p) {
    const kr = p.diry === 'kruh';
    const L = n.poly([[0, 0], [r.L, 0], [r.L, r.tp - 0.5], [r.L - 0.5, r.tp], [r.tw + r.g, r.tp], [r.tw, r.tp + r.g], [r.tw, r.hw - 0.5], [r.tw - 0.5, r.hw], [0, r.hw]]);
    let m = n.xz(L, -r.b / 2, r.b / 2);
    const mi = [];
    for (const d of r.diry) mi.push(...n.diraSvisla(d.x, d.y, r.tp, r.v));
    if (r.kapsa) mi.push(n.yz(n.poly(obrysDiry(r.kapsa.r, kr).map(([a, c]) => [a, r.kapsa.z + c])), -1, r.kapsa.h));
    m = n.odecti(m, mi);
    const dily = [{ m, jmeno: 'doraz', nazev: 'Doraz dvířek / šuplíku', barva: '#4F86D9' }];
    const okoli = [kvadr(-40, r.L + 40, -r.b - 30, r.b + 30, -16, -0.01, 'Korpus', BARVA_DVERI), kvadr(-18 - (r.kapsa && !r.kapsa.magnet ? 1.5 : 0), -(r.kapsa && !r.kapsa.magnet ? 1.5 : 0), -r.b - 30, r.b + 30, 2, r.hw + 60, 'Dvířka', BARVA_KRIDLA)];
    return { dily, okoli };
  }

  /* ---- kalibrační vzorek kapsy magnetu: 5 kapes s vůlí −2…+2 kroky, zářezy na hraně = pořadí ---- */
  function postavKalibraci(n, p) {
    const m = p.magnet, kr = p.tisk.krokKalibrace, vule = [-2, -1, 0, 1, 2].map(i => m.vule + i * kr);
    const rMax = m.magnetD / 2 + Math.max(...vule), krok = 2 * rMax + 4, Wd = 2 * rMax + 9, h = m.magnetH + 1.2;
    const Ld = 5 * krok + 2;
    let t = n.xz(n.poly([[0, 0], [Ld, 0], [Ld, h - 0.4], [Ld - 0.4, h], [0.4, h], [0, h - 0.4]]), -Wd / 2, Wd / 2);
    const mi = [];
    vule.forEach((v, i) => {
      const x = 1 + krok * (i + 0.5);
      mi.push(n.valec(m.magnetD / 2 + v, h - m.magnetH - 0.2, h + 1, x, -1.5));
      for (let j = 0; j <= i; j++) { const xx = x - i * 0.9 + j * 1.8; mi.push(n.xz(n.poly([[xx - 0.5, -0.1], [xx + 0.5, -0.1], [xx + 0.5, h + 0.1], [xx - 0.5, h + 0.1]]), Wd / 2 - 1.2, Wd / 2 + 1)); }
    });
    t = n.odecti(t, mi);
    return { m: t, jmeno: 'kalibrace', nazev: `Kalibrace kapsy Ø ${fmt(m.magnetD)} (vůle ${vule.map(v => fmt(v, 2)).join(' / ')})`, barva: '#E88A2E', vule };
  }

  /** Manifold → síť (tisk) + sestava (převod). */
  function sit(k, m0, jmeno, nazev, barva, prevod) {
    const m = k(m0.simplify(1e-3));
    const st = m.status();
    if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
    if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const nv = vp.length / np, poz = new Float32Array(nv * 3), pozS = new Float32Array(nv * 3);
    const fS = prevod && prevod.sestava;
    for (let i = 0, j = 0; i < vp.length; i += np, j += 3) {
      const x = vp[i], y = vp[i + 1], z = vp[i + 2], c = fS ? fS(x, y, z) : [x, y, z];
      poz[j] = x; poz[j + 1] = y; poz[j + 2] = z;
      pozS[j] = c[0]; pozS[j + 1] = c[1]; pozS[j + 2] = c[2];
    }
    const idx = new Uint32Array(mesh.triVerts);
    const teles = m.decompose().map(k).filter(x => x.volume() > 1e-3).length;
    let zmin = Infinity; for (let i = 2; i < poz.length; i += 3) zmin = Math.min(zmin, poz[i]);
    for (let i = 2; i < poz.length; i += 3) poz[i] -= zmin;
    return { jmeno, nazev, poz, idx, pozSestava: pozS, objem: m.volume(), teles, barva, otocit: false };
  }

  /* ---------------- okolí sestavy (jen náhled) ---------------- */
  function kvadr(x0, x1, y0, y1, z0, z1, nazev, barva) {
    const poz = new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]);
    const idx = new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
    return { nazev, jmeno: 'okoli', poz, idx, barva, okoli: true };
  }
  const BARVA_ZDI = '#C8C2B8', BARVA_DVERI = '#C9A66B', BARVA_KRIDLA = '#E4E1DA';

  /* ---------------- kontroly modelu ---------------- */
  function kontrolyModelu(p, model) {
    const H = [];
    for (const d of model.dily.concat(model.kalibrace)) {
      if (d.teles > 1) H.push({ uroven: 'chyba', pole: null, text: `${d.nazev}: díl se rozpadl na ${d.teles} tělesa – některá část není spojená.` });
      const r = G.rozborTisku(d, p.tisk.uhel);
      if (r.previs > 3) H.push({ uroven: 'varovani', pole: ['tisk.uhel'], text: `${d.nazev}: převisy nad ${fmt(p.tisk.uhel)}° od svislice ${fmt(r.previs, 0)} mm² – v místě převisu může potřebovat podpory.` });
      if (r.most > 1) H.push({ uroven: 'info', pole: null, text: `${d.nazev}: tiskárna přemostí ${fmt(r.most, 0)} mm² vodorovného stropu (kapsa).` });
    }
    if (p.druh === 'klin' && p.klin.text.trim() && !model.text) H.push({ uroven: 'info', pole: ['klin.text'], text: 'Písmo pro ražený text se ještě načítá – model je zatím bez textu.' });
    return H;
  }

  /* ---------------- projekt ---------------- */
  function popis(p) {
    if (p.druh === 'klin') return `klín ${fmt(p.klin.hMin)}–${fmt(p.klin.hMax)} mm · ${fmt(p.klin.sklon, 1)}° · ${MATERIALY[p.tisk.material].nazev}`;
    if (p.druh === 'magnet') return `zarážka ${p.magnet.montaz === 'stena' ? 'na zeď' : 'na podlahu'} · magnet Ø ${fmt(p.magnet.magnetD)} × ${fmt(p.magnet.magnetH)}`;
    return p.aretace.typ === 'hreben' ? `hřeben ${polohyHrebenu(p.aretace.polohy).map(x => fmt(x)).join(' / ')} mm` : `doraz nábytku · ${NAZVY.narazy[p.nabytek.narazy]}`;
  }
  const TYP = 'zarazky_dveri';
  const ulozProjekt = p => G.projektJson(TYP, p, 1);
  const nactiProjekt = text => G.nactiProjektJson(text, TYP, normalizuj, 'Zarážky a aretace');

  const API = {
    MATERIALY, PODLAHY, VRUTY, PODKLADY, TRIDY, MAGNETY, NAZVY, VYCHOZI, MEZE, VYCTY, PREDVOLBY, NAPRIC_VRSTVAMI,
    normalizuj, predvolba, polohyHrebenu, odvozene, vrut, mechanika, silaMagnetu, energieDveri, kontroly, postav, kontrolyModelu, maKalibraci,
    textPolygony, popis, ulozProjekt, nactiProjekt, kopie, vezmi: G.vezmi, poloz: G.poloz, fmt,
  };
  if (uzel) module.exports = API; else window.ZARAZ = API;
})();

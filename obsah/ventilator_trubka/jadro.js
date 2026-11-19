/* Ventilátor → trubka – jádro generátoru (bez DOM a bez three.js, spustitelné v node).
   Přechody z osového (PC) ventilátoru na trubku / hadici / kloubovou hadici, mřížky ventilátorů a odsávač výparů z pájení.

   Druhy:
     prechod – deska na ventilátor (4 díry v rozteči), volitelně skříň s kapsou na filtr (zásuvka z boku),
               plynulý přechod čtverec → kruh a hrdlo trubky (strana sání i výtlaku),
     mrizka  – samostatná mřížka ventilátoru (na šrouby nebo nasazovací se sukní), vzory kruhy / šestiúhelníky /
               štěrbiny / spirála / mřížka, volná plocha v %,
     odsavac – skříň s filtrem (zásuvka), ventilátor zespodu, nahoře sání: límec s nasazovací mřížkou, hrdlo hadice
               nebo jamka pro Kloubovou hadici; volitelně stojánek s náklonem na dvou čepech.

   Hrdla mají stejnou konvenci jako Šoupě a Rozbočka VZT (SOUPE.hrdlo):
     'na' = trubka se zasune DO hrdla (vnitřek = OD + vůle, průchod = ID trubky), 'do' = hrdlo se zasune do trubky / hadice
     (vnějšek = ID − vůle, volitelně kónus). 'jamka' = jamka jako článek Kloubové hadice (KHAD.odvozene) – zacvakne se
     do ní koule prvního článku. 'limec' = rovný límec, na který se nasadí víčko s mřížkou.

   Souřadnice dílu = tisková poloha: osa Z = osa proudu, deska ventilátoru leží na podložce (z = 0), ventilátor je
   pod ní (z ∈ [−tl, 0]). Přechod: obrys se popisuje polárně (zaoblený čtverec, kruh = čtverec s rohem a/2), takže
   vnitřek i vnějšek se dají lineárně / plynule (smoothstep) prolnout po stejných úhlech. Délka přechodu se volí tak,
   aby žádná plocha nepřevisala víc než tisk.uhel (vnějšek se nesmí rozšiřovat, vnitřek zužovat rychleji). */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const SOUPE = uzel ? require('../soupe/jadro.js') : window.SOUPE;          // hrdlo(), TRUBKY, kapka()
  const KHAD = uzel ? require('../kloubova_hadice/jadro.js') : window.KHAD;   // rozměry jamky kloubu
  const fmt = G.fmt, kopie = G.kopie;
  const S2 = Math.SQRT1_2;
  const rad = s => s * Math.PI / 180, deg = r => r * 180 / Math.PI;

  /* ---------------- tabulky ---------------- */
  const MATERIALY = {
    PETG: { nazev: 'PETG', hustota: 1.27 },
    ASA: { nazev: 'ASA', hustota: 1.07 },
    ABS: { nazev: 'ABS', hustota: 1.04 },
    PLA: { nazev: 'PLA', hustota: 1.24 },
  };
  /** Osové ventilátory – TYPICKÉ rozměry a katalogové hodnoty 12 V v běžných otáčkách (výrobci se liší!).
      A strana rámu, roztec děr, dira Ø díry, tl tloušťka, otvor Ø vnitřku rámu (oběžné kolo), roh poloměr rohu rámu,
      Qmax průtok naprázdno (m³/h), pmax statický tlak při nulovém průtoku (Pa). Stav 19. 11. 2026 – ověřit měřením a v katalogu. */
  const DATUM_VENT = '19. 11. 2026';
  const VENTILATORY = [
    { A: 40, roztec: 32, dira: 3.4, tl: 10, otvor: 38, roh: 2, sroub: 'M3', Qmax: 10, pmax: 15 },
    { A: 50, roztec: 40, dira: 3.4, tl: 15, otvor: 48, roh: 2.5, sroub: 'M3', Qmax: 18, pmax: 20 },
    { A: 60, roztec: 50, dira: 4.3, tl: 25, otvor: 57, roh: 3, sroub: 'M4', Qmax: 30, pmax: 30 },
    { A: 70, roztec: 60, dira: 4.3, tl: 15, otvor: 67, roh: 3, sroub: 'M4', Qmax: 40, pmax: 25 },
    { A: 80, roztec: 71.5, dira: 4.3, tl: 25, otvor: 76, roh: 3.5, sroub: 'M4', Qmax: 55, pmax: 30 },
    { A: 92, roztec: 82.5, dira: 4.3, tl: 25, otvor: 88, roh: 4, sroub: 'M4', Qmax: 75, pmax: 30 },
    { A: 120, roztec: 105, dira: 4.3, tl: 25, otvor: 115, roh: 4.5, sroub: 'M4', Qmax: 120, pmax: 30 },
    { A: 140, roztec: 124.5, dira: 4.3, tl: 25, otvor: 135, roh: 5, sroub: 'M4', Qmax: 160, pmax: 25 },
  ];
  /** Šrouby: d závit, pilot = otvor pro samořezný šroub / řezání závitu do plastu, matice na klíč s a výška m (ISO 4032). */
  const SROUBY = {
    M3: { d: 3, pilot: 2.5, s: 5.5, m: 2.4 },
    M4: { d: 4, pilot: 3.3, s: 7, m: 3.2 },
    M5: { d: 5, pilot: 4.2, s: 8, m: 4.7 },
  };
  const DELKY_SROUBU = [6, 8, 10, 12, 16, 20, 25, 30, 35, 40, 45, 50, 60];
  /** Filtry – odpor R1 = tlaková ztráta (Pa) při čelní rychlosti 1 m/s a tloušťce 10 mm (lineární model, typické – ověřit). */
  const FILTRY = {
    zadny: { nazev: 'bez filtru', R1: 0 },
    uhli: { nazev: 'pěna s aktivním uhlím', R1: 20 },
    rohoz: { nazev: 'filtrační rohož (G3–G4)', R1: 15 },
    vlastni: { nazev: 'vlastní odpor', R1: 0 },
  };
  /** Trubky a hadice: Šoupě (stejné rozměry) + menší pro odsávání výparů. Typické hodnoty – ověřit posuvkou. */
  const TRUBKY = SOUPE.TRUBKY.concat([
    { kod: 'ht32', nazev: 'HT trubka 32', spoj: 'na', od: 32, id: 28.4 },
    { kod: 'hadice38', nazev: 'Hadice vysavače 38 (navléknout)', spoj: 'do', od: 45, id: 38 },
    { kod: 'alu80', nazev: 'Alu / PVC flexo hadice 80', spoj: 'do', od: 84, id: 80 },
    { kod: 'alu100', nazev: 'Alu / PVC flexo hadice 100', spoj: 'do', od: 104, id: 100 },
    { kod: 'alu125', nazev: 'Alu / PVC flexo hadice 125', spoj: 'do', od: 129, id: 125 },
  ]);
  const NAZVY = {
    druh: { prechod: 'přechod ventilátor → trubka', mrizka: 'mřížka ventilátoru', odsavac: 'odsávač výparů z pájení' },
    strana: { vytlak: 'výtlak (ventilátor fouká do trubky)', sani: 'sání (ventilátor saje z trubky)' },
    tvar: { ctverec: 'čtverec', kruh: 'kruh' },
    profil: { plynuly: 'plynulý (S-křivka)', kuzel: 'kónus (přímý)' },
    vystup: { na: 'hrdlo – trubka se zasune dovnitř', do: 'hrdlo – zasune se do trubky / hadice', jamka: 'jamka pro kloubovou hadici', limec: 'límec pro nasazovací mřížku' },
    upevneni: { samorez: 'šroub do plastu (pilotní díra)', matice: 'šroub s maticí' },
    vzor: { sestiuhelniky: 'šestiúhelníky', kruhy: 'soustředné kruhy', sterbiny: 'štěrbiny', spirala: 'spirála', mrizka: 'čtvercová mřížka' },
    uchyceni: { srouby: 'na šrouby (4 díry)', nasazovaci: 'nasazovací se sukní' },
    krivka: { primka: 'přímka', parabola: 'parabola' },
    stojan: { zadny: 'bez stojánku', stojan: 'stojánek s náklonem' },
  };

  const VYCHOZI = {
    verze: 1, nazev: 'Ventilátor 120 → hadice 100', druh: 'prechod', diry: 'kapka',
    vent: { A: 120, roztec: 105, dira: 4.3, tl: 25, otvor: 115, roh: 4.5, strana: 'vytlak', upevneni: 'samorez', sroub: 'M4', Qmax: 120, pmax: 30, krivka: 'primka' },
    deska: { tl: 4, mrizka: false },
    prechod: { tvar: 'ctverec', profil: 'plynuly', delka: 0, stena: 2 },
    vystup: { typ: 'do', od: 108, id: 100, delka: 40, kuzel: 1, vule: 0.3, doraz: 1.5, stena: 2.4, limec: 12 },
    jamka: { koule: 38, kanal: 19, presah: 1, vule: 0.15, stena: 2.6, zkoseni: 0.8 },
    filtr: { typ: 'zadny', tl: 10, vule: 0.6, ram: 2, lem: 3, R1: 20 },
    mrizka: { vzor: 'sestiuhelniky', roztec: 9, zebro: 1.2, tl: 2, ramena: 6, uchyceni: 'srouby', sukne: 8, vule: 0.4, ochrana: false },
    stojan: { typ: 'stojan', naklon: 20, tl: 5, sroub: 'M4', cep: 12 },
    proud: { delka: 1, oblouku: 1, drsnost: 0.1 },
    tisk: { vrstva: 0.2, uhel: 45, material: 'PETG', kalibrace: false, krok: 0.15, podlozka: 250 },
  };
  const MEZE = {
    'vent.A': [20, 250], 'vent.roztec': [10, 240], 'vent.dira': [1.5, 8], 'vent.tl': [5, 60], 'vent.otvor': [10, 245], 'vent.roh': [0, 20],
    'vent.Qmax': [1, 5000], 'vent.pmax': [1, 5000],
    'deska.tl': [1.6, 12],
    'prechod.delka': [0, 400], 'prechod.stena': [1, 6],
    'vystup.od': [0, 300], 'vystup.id': [0, 300], 'vystup.delka': [5, 150], 'vystup.kuzel': [0, 8], 'vystup.vule': [-1, 2], 'vystup.doraz': [0, 10],
    'vystup.stena': [1, 8], 'vystup.limec': [4, 60],
    'jamka.koule': [8, 80], 'jamka.kanal': [0, 60], 'jamka.presah': [0, 6], 'jamka.vule': [-0.5, 1], 'jamka.stena': [0.8, 8], 'jamka.zkoseni': [0, 4],
    'filtr.tl': [1, 40], 'filtr.vule': [0, 3], 'filtr.ram': [1.2, 6], 'filtr.lem': [1.5, 10], 'filtr.R1': [0, 2000],
    'mrizka.roztec': [3, 40], 'mrizka.zebro': [0.6, 6], 'mrizka.tl': [1, 8], 'mrizka.ramena': [2, 24, 1], 'mrizka.sukne': [3, 40], 'mrizka.vule': [-0.5, 2],
    'stojan.naklon': [-80, 80], 'stojan.tl': [3, 12], 'stojan.cep': [8, 30],
    'proud.delka': [0, 50], 'proud.oblouku': [0, 20, 1], 'proud.drsnost': [0, 2],
    'tisk.vrstva': [0.05, 0.5], 'tisk.uhel': [20, 75], 'tisk.krok': [0.05, 0.5], 'tisk.podlozka': [80, 600],
  };
  const VYCTY = {
    druh: Object.keys(NAZVY.druh), diry: ['kapka', 'kruh'], 'vent.strana': Object.keys(NAZVY.strana), 'vent.upevneni': Object.keys(NAZVY.upevneni),
    'vent.sroub': Object.keys(SROUBY), 'vent.krivka': Object.keys(NAZVY.krivka),
    'prechod.tvar': Object.keys(NAZVY.tvar), 'prechod.profil': Object.keys(NAZVY.profil), 'vystup.typ': Object.keys(NAZVY.vystup),
    'filtr.typ': Object.keys(FILTRY), 'mrizka.vzor': Object.keys(NAZVY.vzor), 'mrizka.uchyceni': Object.keys(NAZVY.uchyceni),
    'stojan.typ': Object.keys(NAZVY.stojan), 'stojan.sroub': Object.keys(SROUBY), 'tisk.material': Object.keys(MATERIALY),
  };

  /** Rozměry ventilátoru z tabulky jako část projektu. */
  const vent = A => { const v = VENTILATORY.find(x => x.A === A); return { A: v.A, roztec: v.roztec, dira: v.dira, tl: v.tl, otvor: v.otvor, roh: v.roh, sroub: v.sroub, Qmax: v.Qmax, pmax: v.pmax }; };
  const trubka = kod => { const t = TRUBKY.find(x => x.kod === kod); return { typ: t.spoj, od: t.od, id: t.id }; };
  /** Předvolby: jen odchylky od výchozího projektu (tisk zůstává uživatelův). */
  const PREDVOLBY = [
    { id: 'p120h100', nazev: 'Ventilátor 120 → hadice 100', popis: 'výtlak, plynulý přechod, hrdlo do flexo hadice 100', p: {} },
    { id: 'p120ht110', nazev: 'Ventilátor 120 → HT trubka 110', popis: 'trubka se zasune do hrdla, ventilátor fouká do trubky', p: { nazev: 'Ventilátor 120 → HT 110', vystup: trubka('ht110') } },
    { id: 'p140kg125', nazev: 'Ventilátor 140 → KG trubka 125', popis: 'větrání, trubka KG 125 do hrdla', p: { nazev: 'Ventilátor 140 → KG 125', vent: vent(140), vystup: trubka('kg125') } },
    { id: 'p92ht75', nazev: 'Ventilátor 92 → HT trubka 75', popis: 'kruhový vstup (jen oběžné kolo), kónus', p: { nazev: 'Ventilátor 92 → HT 75', vent: vent(92), prechod: { tvar: 'kruh', profil: 'kuzel' }, vystup: trubka('ht75') } },
    { id: 'p80ht50', nazev: 'Ventilátor 80 → HT trubka 50', popis: 'malé odsávání, šroub M4 s maticí', p: { nazev: 'Ventilátor 80 → HT 50', vent: Object.assign(vent(80), { upevneni: 'matice' }), deska: { tl: 5 }, vystup: trubka('ht50') } },
    { id: 'p60h38', nazev: 'Ventilátor 60 → hadice 38', popis: 'sání z hadice vysavače 38, mřížka v desce', p: { nazev: 'Ventilátor 60 ← hadice 38', vent: Object.assign(vent(60), { strana: 'sani' }), deska: { mrizka: true }, mrizka: { vzor: 'kruhy', roztec: 7 }, vystup: trubka('hadice38') } },
    { id: 'p120filtr', nazev: 'Ventilátor 120 s uhlíkovým filtrem → hadice 100', popis: 'zásuvka na filtr 10 mm, sání přes filtr', p: { nazev: 'Filtr 120 → hadice 100', vent: { strana: 'sani' }, filtr: { typ: 'uhli' } } },
    { id: 'm120hex', nazev: 'Mřížka 120 – šestiúhelníky', popis: 'na šrouby, volná plocha kolem 75 %', p: { nazev: 'Mřížka 120', druh: 'mrizka' } },
    { id: 'm120kruhy', nazev: 'Mřížka 120 – soustředné kruhy', popis: 'klasická mřížka se 4 rameny', p: { nazev: 'Mřížka 120 kruhy', druh: 'mrizka', mrizka: { vzor: 'kruhy', roztec: 8, ramena: 4 } } },
    { id: 'm140spir', nazev: 'Mřížka 140 – spirála', popis: 'spirálová ramena, jeden prstenec', p: { nazev: 'Mřížka 140 spirála', druh: 'mrizka', vent: vent(140), mrizka: { vzor: 'spirala', roztec: 10 } } },
    { id: 'm80sterb', nazev: 'Mřížka 80 – štěrbiny', popis: 'rovnoběžné štěrbiny se 2 podpěrami', p: { nazev: 'Mřížka 80 štěrbiny', druh: 'mrizka', vent: vent(80), mrizka: { vzor: 'sterbiny', roztec: 6 } } },
    { id: 'm40nasaz', nazev: 'Mřížka 40 – nasazovací', popis: 'bez šroubů, sukně přes rám ventilátoru', p: { nazev: 'Mřížka 40 nasazovací', druh: 'mrizka', vent: vent(40), mrizka: { vzor: 'mrizka', roztec: 5, zebro: 1, tl: 1.6, uchyceni: 'nasazovaci', sukne: 6 } } },
    { id: 'o120', nazev: 'Odsávač na pájení 120 – uhlíkový filtr', popis: 'stojánek s náklonem, nasazovací mřížka, filtr v zásuvce', p: { nazev: 'Odsávač 120', druh: 'odsavac', vent: { strana: 'sani' }, filtr: { typ: 'uhli' }, vystup: { typ: 'limec' }, mrizka: { vzor: 'sestiuhelniky', roztec: 10, uchyceni: 'nasazovaci' } } },
    { id: 'o140', nazev: 'Odsávač na pájení 140 – rohož + uhlí', popis: 'větší filtr 15 mm, stojánek', p: { nazev: 'Odsávač 140', druh: 'odsavac', vent: Object.assign(vent(140), { strana: 'sani' }), filtr: { typ: 'uhli', tl: 15 }, vystup: { typ: 'limec' }, mrizka: { vzor: 'kruhy', roztec: 10, ramena: 4, uchyceni: 'nasazovaci' } } },
    { id: 'o80kloub', nazev: 'Odsávač 80 s kloubovou hadicí 19', popis: 'výkonný ventilátor 80 × 38, jamka pro Kloubovou hadici (odsávání 19 mm)', p: { nazev: 'Odsávač s kloubovou hadicí', druh: 'odsavac', vent: Object.assign(vent(80), { tl: 38, Qmax: 90, pmax: 400, strana: 'sani' }), filtr: { typ: 'uhli' }, vystup: { typ: 'jamka' }, proud: { delka: 0.25, oblouku: 1 } } },
    { id: 'o120hadice', nazev: 'Odsávač 120 → hadice 38 k pájecímu místu', popis: 'filtr v zásuvce, sání hadicí vysavače 38', p: { nazev: 'Odsávač 120 s hadicí', druh: 'odsavac', vent: { strana: 'sani' }, filtr: { typ: 'uhli' }, vystup: trubka('hadice38'), proud: { delka: 0.6, oblouku: 1 } } },
  ];

  function normalizuj(v) { return G.normalizuj(v, { VYCHOZI, MEZE, VYCTY }); }
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(G.slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }

  /* ---------------- obrysy (polárně) ---------------- */
  /** Obrys = zaoblený čtverec {a: půl strany, rr: poloměr rohu}; kruh = {a: R, rr: R}. Vzdálenost od středu ve směru th. */
  function rho(S, th) {
    const c = Math.abs(Math.cos(th)), s = Math.abs(Math.sin(th)), a = S.a, rr = Math.min(S.rr, a), k = a - rr;
    let t = a / Math.max(c, s, 1e-12);
    if (t * c > k + 1e-12 && t * s > k + 1e-12) { const b = (c + s) * k; t = b + Math.sqrt(Math.max(0, b * b - (2 * k * k - rr * rr))); }
    return t;
  }
  const kruhS = r => ({ a: r, rr: r });
  /** Počet úhlů obrysu (dělitelný 8, aby vrcholy padly do rohů i na osy). */
  const uhlu = S => Math.max(64, Math.min(256, Math.ceil(2 * Math.PI * S.a / 1.6 / 8) * 8));
  const polygon = (S, n = uhlu(S)) => Array.from({ length: n }, (_, j) => { const th = 2 * Math.PI * j / n, r = rho(S, th); return [r * Math.cos(th), r * Math.sin(th)]; });
  const plochaS = S => { const a = S.a, rr = Math.min(S.rr, a); return 4 * a * a - (4 - Math.PI) * rr * rr; };

  /* ---------------- vzory mřížky ---------------- */
  /** Parametry vzoru nad oblastí S (obrys otvoru): hub = plný střed, n = ramena / spirály, kroky. */
  function vzorInfo(m, S) {
    const p = m.roztec, b = m.zebro, R = S.a * (S.rr >= S.a ? 1 : Math.SQRT2);
    const i = { vzor: m.vzor, p, b, R };
    if (m.vzor === 'kruhy') { i.hub = Math.max(p / 2, 2 * b); i.n = m.ramena; }
    if (m.vzor === 'spirala') {
      i.hub = Math.max(p * 0.8, 3 * b); i.n = Math.max(m.ramena, Math.round(2 * Math.PI * 0.7 * R / (p * 1.25)));
      i.sweep = 1.1; i.rmid = (i.hub + R) / 2; i.k = i.sweep / Math.max(1, R - i.hub);
    }
    if (m.vzor === 'sterbiny') i.S = Math.max(24, 3 * p);
    return i;
  }
  const blizkyKrok = (x, p) => x - Math.round(x / p) * p;
  /** Je bod (x, y) otvor vzoru (uvnitř oblasti S)? Čistý JS – volná plocha bez manifoldu a kontrola geometrie v testu. */
  function jeOtvor(I, S, x, y) {
    const r = Math.hypot(x, y), th = Math.atan2(y, x), b2 = I.b / 2;
    if (r >= rho(S, th)) return false;
    switch (I.vzor) {
      case 'mrizka': return Math.abs(blizkyKrok(x - I.p / 2, I.p)) > b2 && Math.abs(blizkyKrok(y - I.p / 2, I.p)) > b2;
      case 'sterbiny': return Math.abs(blizkyKrok(y - I.p / 2, I.p)) > b2 && Math.abs(blizkyKrok(x - I.S / 2, I.S)) > b2;
      case 'kruhy': {
        if (r < I.hub + b2) return false;
        if (Math.abs(blizkyKrok(r, I.p)) <= b2) return false;
        const u = 2 * Math.PI / I.n;
        return Math.abs(Math.sin(blizkyKrok(th, u))) * r > b2;
      }
      case 'spirala': {
        if (r < I.hub + b2) return false;
        if (Math.abs(r - I.rmid) <= b2) return false;
        const u = 2 * Math.PI / I.n, f = th - I.k * (r - I.hub), dt = Math.abs(blizkyKrok(f, u));
        return dt * r * Math.cos(Math.atan(r * I.k)) > b2;
      }
      default: {   // šestiúhelníky: trojúhelníková mřížka středů, šestiúhelník s plochami k sousedům, plocha–plocha p − b
        const p = I.p, h = p * Math.sqrt(3) / 2, w2 = (p - I.b) / 2;
        const j0 = Math.round(y / h);
        let nej = Infinity;
        for (let j = j0 - 1; j <= j0 + 1; j++) {
          const ox = (j & 1) ? p / 2 : 0, i0 = Math.round((x - ox) / p);
          for (let i = i0 - 1; i <= i0 + 1; i++) {
            const dx = x - (i * p + ox), dy = y - j * h;
            const d = Math.max(Math.abs(dx), Math.abs(dx * 0.5 + dy * Math.sqrt(3) / 2), Math.abs(dx * 0.5 - dy * Math.sqrt(3) / 2));
            if (d < nej) nej = d;
          }
        }
        return nej < w2;
      }
    }
  }
  /** Volná plocha vzoru (vzorkováním): {otvor mm², oblast mm², podil 0–1, nejvetsi = největší světlost otvoru mm}. */
  function volnaPlocha(m, S) {
    const I = vzorInfo(m, S), R = S.a * (S.rr >= S.a ? 1 : Math.SQRT2), krok = Math.max(0.1, Math.min(0.3, m.zebro / 4, R / 300));
    let n = 0, cel = 0;
    for (let y = -R + krok / 2; y < R; y += krok) for (let x = -R + krok / 2; x < R; x += krok) {
      if (Math.hypot(x, y) >= rho(S, Math.atan2(y, x))) continue;
      cel++;
      if (jeOtvor(I, S, x, y)) n++;
    }
    const svetlost = m.vzor === 'spirala' ? 2 * Math.PI * I.rmid / I.n - m.zebro : m.roztec - m.zebro;
    return { otvor: n * krok * krok, oblast: cel * krok * krok, podil: cel ? n / cel : 0, svetlost };
  }

  /* ---------------- odvozené rozměry ---------------- */
  /** Kloub pro jamku (KHAD.odvozene nad parametry jamky). */
  function kloub(p) {
    const q = KHAD.normalizuj({ kloub: Object.assign({}, p.jamka, { roztec: 150 }) }).p;
    return KHAD.odvozene(q);
  }
  /** Rozměry a polohy všech částí. o.chyba = důvod, proč nejde sestavit. */
  function odvozene(p) {
    const v = p.vent, s = p.prechod.stena, o = { druh: p.druh };
    o.SA = { a: v.A / 2, rr: Math.min(v.roh, v.A / 2) };                       // obrys rámu ventilátoru (deska, skříň)
    o.F = { a: v.A / 2 - s, rr: Math.max(0.3, v.roh - s) };                    // vnitřek skříně / přechodu (čtverec)
    o.r2 = v.roztec / 2;
    o.Df = Math.min(v.otvor, 2 * o.F.a);
    o.tp = p.deska.tl;
    o.S = SROUBY[v.sroub];
    o.diraD = v.upevneni === 'samorez' ? o.S.pilot : o.S.d + 0.4;
    o.sts = 1.6;                                                                // stěna sukně nasazovací mřížky
    // mřížka – samostatná (oblast = otvor rámu)
    if (p.druh === 'mrizka') {
      const m = p.mrizka;
      o.oblast = kruhS(o.Df / 2);
      o.tm = m.tl;
      o.Ain = v.A + 2 * m.vule;                                                 // vnitřek sukně
      o.vzor = volnaPlocha(m, o.oblast);
      o.vyska = m.uchyceni === 'nasazovaci' ? m.tl + m.sukne : m.tl;
      return o;
    }
    const f = p.filtr, odsavac = p.druh === 'odsavac';
    o.filtr = f.typ !== 'zadny';
    o.skrin = o.filtr || odsavac;
    o.lem = f.lem;
    // kapsa filtru a vnitřek nad sražením: rohy se liší o lem, aby i sražení v rozích mělo 45°
    o.Fk = { a: o.F.a, rr: f.lem + 0.3 };
    o.Fi = { a: o.F.a - f.lem, rr: 0.3 };
    // stojánek: čepy na bocích skříně (kapka hrotem dolů, osa X)
    o.stojan = odsavac && p.stojan.typ === 'stojan';
    if (o.stojan) {
      o.Ss = SROUBY[p.stojan.sroub];
      o.Rb = p.stojan.cep / 2;
      o.Lb = 6;                                                                 // délka čepu od stěny
    }
    // skříň: kapsa filtru (zásuvka z boku +Y), sražení 45° k vnitřku přechodu
    if (o.skrin) {
      o.hk = o.filtr ? f.ram + f.tl + f.vule : 6;
      if (o.stojan) o.hk = Math.max(o.hk, o.Rb * (1 + Math.SQRT2) + 1.5 - o.tp - o.lem);
      o.zK = o.tp + o.hk;
      o.zL0 = o.zK + 1.2 * o.lem;                                              // sražení kapsy ≈ 40° (rezerva na mnohoúhelník)
      o.Si = o.Fi;
      o.otvorDesky = kruhS(Math.min(o.Df, 2 * o.F.a - 2) / 2);
    } else {
      o.zL0 = o.tp;
      o.Si = p.prechod.tvar === 'kruh' ? kruhS(o.Df / 2) : o.F;
      o.otvorDesky = kruhS(o.Df / 2);                                           // kolem děr zůstane deska (šrouby, matice)
    }
    if (o.stojan) {
      o.zc = Math.max(o.Rb * Math.SQRT2 + 0.3, Math.min(o.zL0 - o.Rb - 0.3, (o.zL0 - v.tl) / 2));
      o.vrtani = o.Lb + s - 0.8;                                                // slepá díra pro šroub stojánku
    }
    o.So = o.SA;
    // výstup
    const t = { stena: p.vystup.stena, vule: p.vystup.vule, doraz: p.vystup.doraz };
    const typ = p.vystup.typ;
    if (typ === 'na' || typ === 'do') {
      o.h = SOUPE.hrdlo({ spoj: typ, od: p.vystup.od, id: p.vystup.id, delka: p.vystup.delka, kuzel: p.vystup.kuzel }, t);
      if (o.h.chyba) { o.chyba = 'hrdlo'; return o; }
      o.ri1 = typ === 'na' ? o.h.rp : o.h.ri; o.ro1 = o.h.ro;
      o.Dkanal = o.h.trId;                                                      // vnitřek navazující trubky
    } else if (typ === 'jamka') {
      o.kh = kloub(p);
      if (o.kh.chyba || !(o.kh.rc > 0)) { o.chyba = 'jamka'; return o; }
      o.ri1 = o.kh.rc; o.ro1 = o.kh.rt;
      o.Dkanal = 2 * o.kh.rc;
    } else {
      o.ri1 = null; o.ro1 = null;
      o.Dkanal = 2 * o.Si.a;
    }
    // délka přechodu: vnějšek se nesmí rozšiřovat ani vnitřek zužovat strměji než tisk.uhel od svislice
    if (typ !== 'limec') {
      const tg = Math.tan(rad(p.tisk.uhel)), nas = p.prechod.profil === 'plynuly' ? 1.5 : 1;
      let dmax = 0;
      for (let j = 0; j < 360; j++) {
        const th = rad(j + 0.5);
        dmax = Math.max(dmax, o.ro1 - rho(o.So, th), rho(o.Si, th) - o.ri1);
      }
      o.Lmin = Math.ceil((Math.max(0, dmax) / tg * nas + 2) * 2) / 2;
      o.L = p.prechod.delka > 0 ? p.prechod.delka : o.Lmin;
      o.zL1 = o.zL0 + o.L;
      // nejtenčí stěna přechodu (ve vodorovném řezu, po úhlech)
      let st = Infinity;
      for (let j = 0; j < 72; j++) { const th = rad(j * 5 + 0.5); st = Math.min(st, rho(o.So, th) - rho(o.Si, th), o.ro1 - o.ri1); }
      o.stenaMin = st;
      // ekvivalentní polovina úhlu kužele (proudění)
      const Rf = Math.sqrt(plochaS(o.Si) / Math.PI);
      o.uhelKuzele = deg(Math.atan(Math.abs(Rf - o.ri1) / Math.max(1, o.L)));
    } else { o.L = 0; o.zL1 = o.zL0; o.Lmin = 0; o.stenaMin = rho(o.So, Math.PI / 4) - rho(o.Si, Math.PI / 4); }
    if (typ === 'na' || typ === 'do') o.zTop = o.zL1 + o.h.L;
    else if (typ === 'jamka') { o.zS = o.zL1 + o.kh.Ro * Math.SQRT2; o.zTop = o.zS + o.kh.ztop; }
    else o.zTop = o.zL0 + p.vystup.limec;
    // víčko s mřížkou na límec (odsávač i přechod s límcem)
    if (typ === 'limec') {
      o.vicko = true;
      o.tm = p.mrizka.tl; o.Ain = v.A + 2 * p.mrizka.vule;
      o.oblastVicka = o.Si;
      o.vzor = volnaPlocha(p.mrizka, o.oblastVicka);
    }
    o.ochrana = p.mrizka.ochrana;                                               // mřížka na volnou stranu ventilátoru
    if (o.ochrana) { o.tmO = p.mrizka.tl; o.vzorO = volnaPlocha(p.mrizka, kruhS(o.Df / 2)); }
    // vnitřek desky s mřížkou
    if (p.deska.mrizka) o.vzorD = volnaPlocha(p.mrizka, o.otvorDesky);
    // zásuvka filtru
    if (o.filtr) {
      o.zx = o.F.a - f.vule;                                                    // polovina šířky zásuvky
      o.zh = o.hk - f.vule;                                                     // výška čela zásuvky
      o.filtrRozmer = 2 * o.zx;                                                 // filtr přistřihnout na čtverec
      o.filtrPlocha = (2 * (o.zx - f.lem)) ** 2;                                // čelní plocha (vnitřek rámečku)
      o.mrizkaZasuvky = { roztec: 15, zebro: 1.6 };
    }
    // stojánek: výška osy čepu, aby se skříň s ventilátorem otočila dokola nad podstavou
    if (o.stojan) {
      const zdola = -v.tl - (o.ochrana ? o.tmO : 0), zhora = typ === 'limec' ? o.zTop + o.tm : o.zL0;
      o.Rsw = Math.max(Math.hypot(v.A / 2 + (typ === 'limec' ? o.sts + p.mrizka.vule : 0), o.zc - zdola), Math.hypot(v.A / 2, zhora - o.zc));
      o.Xu = v.A / 2 + o.Lb + 0.6;                                              // vnitřní líc stojny
      o.tu = 5;                                                                 // tloušťka stojny
      o.wu = 2 * o.Rb + 6;
      o.Hp = p.stojan.tl + 3 + o.Rsw;
      o.Db = Math.max(o.wu + 20, Math.round(1.1 * o.Rsw));
      o.delkaSroubuStojanu = delkaSroubu(o.tu + o.vrtani - 1);
    }
    // šrouby ventilátoru: skrz rám ventilátoru (a ochrannou mřížku) do desky
    o.delkaSroubu = delkaSroubu(v.tl + (o.ochrana && p.mrizka.uchyceni === 'srouby' ? o.tmO : 0) + (v.upevneni === 'samorez' ? o.tp - 1 : o.tp + 0.5));
    return o;
  }
  /** Nejdelší normalizovaná délka šroubu ≤ potřebná (u matice nejkratší ≥). */
  function delkaSroubu(L) { let d = DELKY_SROUBU[0]; for (const x of DELKY_SROUBU) if (x <= L + 0.01) d = x; return d; }

  /* ---------------- kontroly ---------------- */
  const POPISKY = {
    'prechod.delka': h => `přechod ${fmt(h, 1)} mm`, 'deska.tl': h => `deska ${fmt(h, 1)} mm`, 'vystup.limec': h => `límec ${fmt(h, 1)} mm`,
    'mrizka.zebro': h => `žebro ${fmt(h, 1)} mm`, 'vystup.delka': h => `hrdlo ${fmt(h, 1)} mm`, 'mrizka.roztec': h => `rozteč ${fmt(h, 1)} mm`,
    'jamka.presah': h => `přesah ${fmt(h, 2)} mm`, 'filtr.tl': h => `filtr ${fmt(h, 1)} mm`,
    diry: h => (h === 'kapka' ? 'díry jako kapka' : 'díry jako kruh'),
  };
  const textOpravy = zmeny => Object.entries(zmeny).map(([c, h]) => (POPISKY[c] ? POPISKY[c](h) : `${c} ${h}`)).join(', ');

  function kontroly(p) {
    const H = [], o = odvozene(p), v = p.vent, m = p.mrizka;
    const chyba = (pole, text, oprava) => H.push({ uroven: 'chyba', pole, text, oprava });
    const var_ = (pole, text, oprava) => H.push({ uroven: 'varovani', pole, text, oprava });
    const info = (pole, text) => H.push({ uroven: 'info', pole, text });
    const opr = (c, h) => ({ zmeny: { [c]: Math.round(h * 100) / 100 } });
    // ventilátor
    if (v.roztec + v.dira > v.A - 0.8) chyba(['vent.roztec', 'vent.dira'], `Díry v rozteči ${fmt(v.roztec)} mm se na rám ${fmt(v.A)} mm nevejdou.`);
    if (v.otvor > v.A - 1) chyba(['vent.otvor'], `Otvor rámu Ø ${fmt(v.otvor)} je větší než rám ${fmt(v.A)} mm.`, opr('vent.otvor', v.A - 4));
    if (Math.hypot(v.roztec / 2, v.roztec / 2) - v.dira / 2 < v.otvor / 2 + 0.6) chyba(['vent.roztec', 'vent.otvor'], 'Díry pro šrouby zasahují do otvoru rámu – zkontrolujte rozteč a otvor.');
    if (!VENTILATORY.some(x => x.A === v.A && x.roztec === v.roztec)) info(['vent.A', 'vent.roztec'], 'Vlastní rozměr ventilátoru – rozteč a otvor ověřte posuvkou.');
    if (Math.abs(SROUBY[v.sroub].d + 0.3 - v.dira) > 0.8) info(['vent.sroub', 'vent.dira'], `Šroub ${v.sroub} a díra rámu Ø ${fmt(v.dira, 1)} k sobě nesedí – rámem má šroub projít s malou vůlí.`);
    if (p.druh === 'mrizka') return H.concat(kontrolyMrizky(p, o.vzor));
    // deska
    if (v.upevneni === 'matice' && o.tp < o.S.m + 1.2) chyba(['deska.tl', 'vent.upevneni'], `Do desky ${fmt(o.tp, 1)} mm se matice ${v.sroub} (${fmt(o.S.m, 1)} mm) nevejde – zesilte desku.`, opr('deska.tl', Math.ceil((o.S.m + 1.4) * 2) / 2));
    if (v.upevneni === 'matice' && o.r2 * Math.SQRT2 + o.S.s / Math.sqrt(3) > rho(o.F, Math.PI / 4) + 0.01 && !o.skrin && p.prechod.tvar === 'ctverec')
      info(['vent.upevneni'], 'Kapsy matic zasahují pod stěnu přechodu – strop kapsy se přemostí.');
    if (o.tp < 3) var_(['deska.tl'], `Deska ${fmt(o.tp, 1)} mm je tenká – šrouby ji prohnou.`, opr('deska.tl', 4));
    if (o.chyba === 'hrdlo') { chyba(['vystup.od', 'vystup.id'], p.vystup.typ === 'na' ? 'Pro hrdlo „trubka dovnitř“ zadejte vnější průměr trubky (OD).' : 'Pro hrdlo „do trubky / hadice“ zadejte vnitřní průměr (ID).'); return H; }
    if (o.chyba === 'jamka') {
      const kh = o.kh || {};
      if (!(p.jamka.kanal > 0)) chyba(['jamka.kanal'], 'Kloubová hadice pro odsávání musí mít kanál – zadejte jeho průměr.', opr('jamka.kanal', 12));
      else if (kh.chyba === 'presah') chyba(['jamka.presah', 'jamka.vule'], 'Přesah hrdla jamky je při této vůli záporný – koule by vypadla.', opr('jamka.presah', Math.max(0.6, p.jamka.vule + 0.6)));
      else chyba(['jamka.koule', 'jamka.kanal', 'jamka.stena'], 'Jamka nejde sestavit – zkontrolujte kouli, kanál a stěnu (stejné hodnoty jako v Kloubové hadici).');
      return H;
    }
    // výstup
    if (p.vystup.typ === 'na' || p.vystup.typ === 'do') {
      if (p.vystup.typ === 'na' && p.vystup.id > 0 && p.vystup.id >= p.vystup.od) chyba(['vystup.id', 'vystup.od'], 'Vnitřní průměr trubky musí být menší než vnější.');
      if (p.vystup.delka < 15) var_(['vystup.delka'], `Hrdlo ${fmt(p.vystup.delka)} mm je krátké – trubka nebude držet.`, opr('vystup.delka', 25));
      if (p.vystup.vule < 0.1) info(['vystup.vule'], `Vůle hrdla ${fmt(p.vystup.vule, 2)} mm – trubka půjde ztuha. Ověřte kalibračním vzorkem (záložka Tisk).`);
      if (o.h.ro > v.A * 0.9) info(['vystup.od', 'vystup.id'], 'Trubka je skoro tak široká jako ventilátor – přechod rozšiřuje, roste i délka.');
    }
    if (p.vystup.typ === 'jamka') {
      const kh = o.kh;
      if (kh.phi > p.tisk.uhel + 0.5) var_(['jamka.presah', 'jamka.vule'], `Hrdlo jamky převisá ${fmt(kh.phi, 0)}° – víc než ${fmt(p.tisk.uhel)}°. Zmenšete přesah.`);
      if (kh.celo < 0.6) chyba(['jamka.stena', 'jamka.zkoseni'], `Čelo ústí jamky má jen ${fmt(kh.celo, 2)} mm – zesilte stěnu.`);
      if (p.jamka.presah < 0.3) var_(['jamka.presah'], `Přesah ${fmt(p.jamka.presah, 2)} mm je malý – koule bude vyskakovat.`, opr('jamka.presah', 0.6));
    }
    if (p.vystup.typ === 'limec' && p.vystup.limec < p.mrizka.sukne + 1) chyba(['vystup.limec', 'mrizka.sukne'], `Límec ${fmt(p.vystup.limec)} mm je kratší než sukně víčka (${fmt(p.mrizka.sukne)} mm).`, opr('vystup.limec', p.mrizka.sukne + 2));
    // přechod
    if (p.vystup.typ !== 'limec') {
      if (o.L < o.Lmin - 0.01) var_(['prechod.delka', 'tisk.uhel'], `Přechod ${fmt(o.L)} mm je na ${fmt(p.tisk.uhel)}° převisu krátký – bez podpor potřebuje aspoň ${fmt(o.Lmin)} mm.`, opr('prechod.delka', o.Lmin));
      if (o.stenaMin < 1) chyba(['prechod.stena', 'vystup.stena'], `Stěna přechodu klesá na ${fmt(o.stenaMin, 2)} mm.`);
      if (o.uhelKuzele > 15) info(['prechod.delka'], `Přechod se rozšiřuje / zužuje pod úhlem ${fmt(o.uhelKuzele, 0)}° (polovina kužele) – delší přechod sníží ztrátu.`);
    }
    // filtr
    if (o.filtr) {
      if (p.filtr.tl < 3) var_(['filtr.tl'], `Filtr ${fmt(p.filtr.tl)} mm je tenký – uhlí rychle nasákne.`, opr('filtr.tl', 10));
      if (p.vent.strana === 'vytlak' && p.druh === 'prechod') info(['vent.strana', 'filtr.typ'], 'Filtr je za ventilátorem (výtlak) – vzduch jde přes ventilátor ještě nefiltrovaný.');
      if (p.filtr.typ === 'vlastni' && !(p.filtr.R1 > 0)) var_(['filtr.R1'], 'Zadejte odpor vlastního filtru (Pa při 1 m/s a 10 mm).');
      if (2 * o.zx > p.tisk.podlozka) info(['tisk.podlozka'], 'Zásuvka je větší než podložka tiskárny.');
    }
    if (p.druh === 'odsavac' && !o.filtr) info(['filtr.typ'], 'Odsávač bez filtru jen odvádí kouř pryč – na pájení použijte aspoň uhlíkovou pěnu.');
    // mřížky
    if (p.deska.mrizka) H.push(...kontrolyMrizky(p, o.vzorD));
    else if (o.vicko || o.ochrana) H.push(...kontrolyMrizky(p, o.vicko ? o.vzor : o.vzorO));
    // stojánek
    if (o.stojan) {
      if (o.zc - o.Rb * Math.SQRT2 < -0.01 || o.zc + o.Rb > o.zL0 + 0.01) chyba(['stojan.cep'], 'Čep stojánku se nevejde na bok skříně.', opr('stojan.cep', 10));
      if (p.diry === 'kruh') info(['diry'], 'Kruhové vodorovné díry mají převislý strop – tiskněte s podporami nebo zvolte kapku.');
      if (Math.abs(p.stojan.naklon) > 60) info(['stojan.naklon'], 'Velký náklon – zkontrolujte v náhledu, že sání nenarazí do stojánku.');
    }
    // proudění: pracovní bod
    const r = proudeni(p, o);
    if (r) {
      if (r.Q < 0.25 * v.Qmax) (r.Q < 0.1 * v.Qmax ? var_ : info)(['proud.delka', 'vystup.id', 'vent.pmax'], `Ventilátor se dusí: pracovní bod ${fmt(r.Q, 0)} m³/h je jen ${fmt(r.Q / v.Qmax * 100, 0)} % průtoku naprázdno. Větší průměr trubky, kratší trasa nebo ventilátor s vyšším tlakem.`);
      if (r.vKanal > 20) info(['vystup.id'], `Rychlost v trubce ${fmt(r.vKanal, 1)} m/s – bude hlučné.`);
    }
    // tisková plocha
    const vel = Math.max(v.A, o.stojan ? 2 * (o.Xu + o.tu) : 0);
    if (vel > p.tisk.podlozka) info(['tisk.podlozka'], `Největší díl (${fmt(vel, 0)} mm) je větší než podložka ${fmt(p.tisk.podlozka)} mm.`);
    return H;
  }
  function kontrolyMrizky(p, vz) {
    const H = [], m = p.mrizka;
    const ch = (a, b, c) => H.push({ uroven: 'chyba', pole: a, text: b, oprava: c }), vr = (a, b, c) => H.push({ uroven: 'varovani', pole: a, text: b, oprava: c }), inf = (a, b) => H.push({ uroven: 'info', pole: a, text: b });
    if (m.zebro < 2 * 0.4) vr(['mrizka.zebro'], `Žebro ${fmt(m.zebro, 2)} mm je užší než 2 dráhy trysky 0,4 – vytiskne se děravě.`, { zmeny: { 'mrizka.zebro': 0.9 } });
    if (m.roztec < m.zebro + 1.5) ch(['mrizka.roztec', 'mrizka.zebro'], 'Rozteč vzoru je menší než žebro + 1,5 mm – otvory by zmizely.', { zmeny: { 'mrizka.roztec': Math.ceil(m.zebro + 4) } });
    else if (vz && vz.podil < 0.5) vr(['mrizka.roztec', 'mrizka.zebro'], `Volná plocha mřížky je jen ${fmt(vz.podil * 100, 0)} % – velká ztráta. Větší rozteč nebo tenčí žebra.`);
    if (vz && vz.svetlost > 12) inf(['mrizka.roztec'], `Světlost otvoru ${fmt(vz.svetlost, 1)} mm – zkušební prst (Ø 12 mm) projde, mřížka nechrání prsty.`);
    if (m.uchyceni === 'nasazovaci' && m.vule < 0.1) inf(['mrizka.vule'], 'Malá vůle sukně – ověřte kalibračním vzorkem.');
    return H;
  }

  /* ---------------- proudění ---------------- */
  const RHO = 1.2, NU = 1.5e-5;
  /** Součinitel tření – Haaland, laminárně 64/Re. */
  function lambdaTreni(v, D, eps) {
    const Re = v * D / NU;
    if (Re < 1) return 0;
    if (Re < 2300) return 64 / Re;
    return 1 / (-1.8 * Math.log10((eps / D / 3.7) ** 1.11 + 6.9 / Re)) ** 2;
  }
  /** Tenká děrovaná deska (Idelchik): ζ vztažené k rychlosti před deskou, f = volná plocha 0–1. */
  const zetaMrizky = f => (f > 0.01 ? ((0.707 * Math.sqrt(1 - f) + 1 - f) / f) ** 2 : 1e6);
  /** Ztráta pozvolného rozšíření (difuzor) podle poloviny úhlu kužele: k · (1 − A1/A2)². */
  const kDifuzoru = th => Math.min(1, Math.max(0.15, 0.15 + 0.85 * (th - 3.5) / 26.5));
  /** Ztráty soustavy při průtoku Qh (m³/h): položky a součet (Pa). */
  function ztraty(p, o, Qh) {
    const Q = Qh / 3600, pd = v => RHO * v * v / 2, polozky = [];
    const pridej = (klic, nazev, dp, pozn) => polozky.push({ klic, nazev, dp, pozn });
    const v = p.vent;
    const Af = Math.PI * (o.Df / 2) ** 2 / 1e6, vf = Q / Af;
    const sani = p.druh === 'odsavac' || v.strana === 'sani';
    const mr = (vz, A, nazev) => { if (!vz) return; const vv = Q / (A / 1e6); pridej('mr_' + nazev, nazev, zetaMrizky(vz.podil) * pd(vv), `volná plocha ${fmt(vz.podil * 100, 0)} %, ζ ${fmt(zetaMrizky(vz.podil), 2)}`); };
    if (p.druh === 'mrizka') {
      mr(o.vzor, o.vzor.oblast, 'Mřížka');
      return { polozky, celkem: polozky.reduce((a, x) => a + x.dp, 0), vf };
    }
    if (p.deska.mrizka) mr(o.vzorD, o.vzorD.oblast, 'Mřížka v desce');
    if (o.ochrana) mr(o.vzorO, o.vzorO.oblast, 'Ochranná mřížka');
    if (o.vicko) mr(o.vzor, o.vzor.oblast, 'Víčko s mřížkou');
    if (o.filtr) {
      const Afl = o.filtrPlocha / 1e6, vfl = Q / Afl, R1 = p.filtr.typ === 'vlastni' ? p.filtr.R1 : FILTRY[p.filtr.typ].R1;
      pridej('filtr', 'Filtr', R1 * (p.filtr.tl / 10) * vfl, `${FILTRY[p.filtr.typ].nazev}, ${fmt(p.filtr.tl)} mm, čelní rychlost ${fmt(vfl, 2)} m/s`);
      // mřížka zásuvky: žebra 1,6 mm po 15 mm
      const fz = 1 - o.mrizkaZasuvky.zebro / o.mrizkaZasuvky.roztec;
      pridej('zasuvka', 'Mřížka zásuvky', zetaMrizky(fz) * pd(vfl), `volná plocha ${fmt(fz * 100, 0)} %`);
    }
    if (p.vystup.typ !== 'limec') {
      const Dk = o.Dkanal / 1000, Ak = Math.PI * Dk * Dk / 4, vk = Q / Ak;
      // přechod mezi otvorem ventilátoru a trubkou
      const As = plochaS(o.Si) / 1e6, vs = Q / As;
      const rozsir = sani ? Ak < As : As < Ak;    // proud jde do většího průřezu
      if (rozsir) {
        const [vm, A1, A2] = sani ? [vk, Ak, As] : [vs, As, Ak];
        const k = kDifuzoru(o.uhelKuzele);
        pridej('prechod', 'Přechod (rozšíření)', k * (1 - A1 / A2) ** 2 * pd(vm), `polovina úhlu ${fmt(o.uhelKuzele, 0)}°, k ${fmt(k, 2)}`);
      } else pridej('prechod', 'Přechod (zúžení)', 0.05 * pd(sani ? vs : vk), 'pozvolné zúžení ζ 0,05');
      const eps = p.proud.drsnost / 1000, lam = lambdaTreni(vk, Dk, eps);
      pridej('trubka', p.vystup.typ === 'jamka' ? 'Kloubová hadice' : 'Trubka / hadice', lam * p.proud.delka / Dk * pd(vk), `${fmt(p.proud.delka, 2)} m, Ø ${fmt(o.Dkanal, 1)} mm, λ ${fmt(lam, 3)}`);
      if (p.proud.oblouku) pridej('oblouky', 'Oblouky', p.proud.oblouku * 0.3 * pd(vk), `${p.proud.oblouku} × 90°, ζ 0,3`);
      if (sani) pridej('vstup', 'Vstup do trubky', 0.5 * pd(vk), 'ostrá hrana ζ 0,5');
      else pridej('vystup', 'Výtok z trubky', pd(vk), 'dynamický tlak na konci ζ 1');
      return { polozky, celkem: polozky.reduce((a, x) => a + x.dp, 0), vf, vk };
    }
    return { polozky, celkem: polozky.reduce((a, x) => a + x.dp, 0), vf };
  }
  /** Zjednodušená křivka ventilátoru: Δp = pmax · (1 − Q/Qmax) nebo · (1 − (Q/Qmax)²). */
  function tlakVentilatoru(v, Q) { const x = Math.min(1, Math.max(0, Q / v.Qmax)); return v.pmax * (v.krivka === 'parabola' ? 1 - x * x : 1 - x); }
  /** Pracovní bod = průsečík křivky ventilátoru se ztrátami soustavy (půlení intervalu). */
  function proudeni(p, o = odvozene(p)) {
    if (o.chyba) return null;
    const v = p.vent;
    let a = 0, b = v.Qmax;
    for (let i = 0; i < 60; i++) { const c = (a + b) / 2; if (tlakVentilatoru(v, c) > ztraty(p, o, c).celkem) a = c; else b = c; }
    const Q = (a + b) / 2, z = ztraty(p, o, Q);
    const krivky = [];
    for (let i = 0; i <= 40; i++) { const q = v.Qmax * i / 40; krivky.push({ Q: q, vent: tlakVentilatoru(v, q), soustava: i ? ztraty(p, o, q).celkem : 0 }); }
    return { Q, dp: tlakVentilatoru(v, Q), polozky: z.polozky, celkem: z.celkem, vFan: z.vf, vKanal: z.vk || 0, podil: Q / v.Qmax, krivky };
  }

  /* ---------------- stavba ---------------- */
  /** Postaví díly (manifold-3d). Vrací {dily (tisková poloha), sestava (montáž vč. ventilátoru), kalibrace, o, prunik, vzor2d, cas}. */
  function postav(w, p, volby = {}) {
    const t0 = Date.now(), o = odvozene(p);
    if (o.chyba) throw new Error('rozměry nejdou sestavit (' + o.chyba + ')');
    const { Manifold: M, CrossSection: CS, Mesh } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const segmenty = r => Math.max(32, Math.min(160, Math.ceil(2 * Math.PI * r / 1.2 / 4) * 4));
    const cs = poly => k(new CS([poly], 'NonZero'));
    const hranol = (poly, z0, z1) => k(k(cs(poly).extrude(z1 - z0)).translate([0, 0, z0]));
    const hranolCS = (c, z0, z1) => k(k(c.extrude(z1 - z0)).translate([0, 0, z0]));
    const valec = (r, z0, z1, x = 0, y = 0, n) => k(k(M.cylinder(z1 - z0, r, r, n || segmenty(r))).translate([x, y, z0]));
    const kvadr = (x0, y0, z0, x1, y1, z1) => k(k(M.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    const otoc = (body, n) => k(cs(body).revolve(n || segmenty(Math.max(...body.map(q => q[0])))));
    const posun = (m, x, y, z) => k(m.translate([x, y, z]));
    const rozdil = (a, b) => (b.length ? k(M.difference([a, ...b])) : a);
    const sjednot = a => (a.length > 1 ? k(M.union(a)) : a[0]);
    const sestiuh = (s, cx, cy) => { const R = s / Math.sqrt(3), b = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; b.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); } return b; };
    /** Těleso z (y, z) obrysu vytažené podél X od x0 do x1 (cyklická záměna os zachová orientaci). */
    const podelX = (poly, x0, x1) => k(k(k(cs(poly).extrude(x1 - x0)).warp(q => { const a = q[0], b = q[1], c = q[2]; q[0] = c + x0; q[1] = a; q[2] = b; })));
    /** Prolnutí dvou polárních obrysů: řady [z, S0, S1, t] → uzavřené těleso (víka s bodem ve středu). */
    function loft(rady, n) {
      const m = rady.length, V = new Float32Array((n * m + 2) * 3), I = [];
      rady.forEach(([z, S0, S1, t], i) => {
        for (let j = 0; j < n; j++) {
          const th = 2 * Math.PI * j / n, r = rho(S0, th) + (rho(S1, th) - rho(S0, th)) * t, q = 3 * (i * n + j);
          V[q] = r * Math.cos(th); V[q + 1] = r * Math.sin(th); V[q + 2] = z;
        }
      });
      const c0 = n * m, c1 = n * m + 1;
      V[3 * c0 + 2] = rady[0][0]; V[3 * c1 + 2] = rady[m - 1][0];
      for (let i = 0; i < m - 1; i++) for (let j = 0; j < n; j++) {
        const a = i * n + j, b = i * n + (j + 1) % n, c = (i + 1) * n + (j + 1) % n, d = (i + 1) * n + j;
        I.push(a, b, c, a, c, d);
      }
      const tt = (m - 1) * n;
      for (let j = 0; j < n; j++) { I.push(c0, (j + 1) % n, j); I.push(c1, tt + j, tt + (j + 1) % n); }
      const mm = k(new M(new Mesh({ numProp: 3, vertProperties: V, triVerts: new Uint32Array(I) })));
      if (mm.status() !== 'NoError') throw new Error('přechod: ' + mm.status());
      return mm;
    }
    /** Řady prolnutí od z0 do z1 (+ přesahy e0 dolů a e1 nahoru se stejným obrysem). */
    function radyLoftu(S0, S1, z0, z1, e0, e1) {
      const L = z1 - z0, n = Math.max(12, Math.min(80, Math.ceil(L / 1.2))), r = [];
      const f = p.prechod.profil === 'plynuly' ? (t => t * t * (3 - 2 * t)) : (t => t);
      if (e0) r.push([z0 - e0, S0, S1, 0]);
      for (let i = 0; i <= n; i++) r.push([z0 + L * i / n, S0, S1, f(i / n)]);
      if (e1) r.push([z1 + e1, S0, S1, 1]);
      return r;
    }
    /** Otvory vzoru v oblasti S jako CrossSection. */
    function otvoryVzoru(m, S) {
      const I = vzorInfo(m, S), R = I.R + m.roztec, b = m.zebro, oblast = cs(polygon(S));
      const pas = (x0, y0, x1, y1) => cs([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
      let zebra = [];
      if (I.vzor === 'sestiuhelniky') {
        const hexy = [], h = I.p * Math.sqrt(3) / 2, w = I.p - b;
        for (let j = -Math.ceil(R / h); j <= Math.ceil(R / h); j++) {
          const ox = (j & 1) ? I.p / 2 : 0;
          for (let i = -Math.ceil(R / I.p) - 1; i <= Math.ceil(R / I.p) + 1; i++) {
            const x = i * I.p + ox, y = j * h;
            if (Math.hypot(x, y) - w / Math.sqrt(3) < rho(S, Math.atan2(y, x))) hexy.push(sestiuh(w, x, y));
          }
        }
        // šestiúhelník má plochy kolmo k 0°, 60°, 120° → vrcholy na 30° (otočit o 30°)
        const rot = hexy.map(hx => { const cx = hx.reduce((a, q) => a + q[0], 0) / 6, cy = hx.reduce((a, q) => a + q[1], 0) / 6; return hx.map(([x, y]) => { const dx = x - cx, dy = y - cy, c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6); return [cx + dx * c - dy * s, cy + dx * s + dy * c]; }); });
        return k(k(new CS(rot, 'NonZero')).intersect(oblast));
      }
      if (I.vzor === 'mrizka' || I.vzor === 'sterbiny') {
        const kr = I.vzor === 'mrizka' ? I.p : I.S;
        for (let x = I.p / 2 - Math.ceil(R / I.p) * I.p; x <= R; x += I.p) zebra.push(pas(-R, x - b / 2, R, x + b / 2));
        for (let x = kr / 2 - Math.ceil(R / kr) * kr; x <= R; x += kr) zebra.push(pas(x - b / 2, -R, x + b / 2, R));
      } else if (I.vzor === 'kruhy') {
        zebra.push(k(CS.circle(I.hub + b / 2, segmenty(I.hub))));
        for (let r = I.p; r < R; r += I.p) zebra.push(k(k(CS.circle(r + b / 2, segmenty(r))).subtract(k(CS.circle(r - b / 2, segmenty(r))))));
        for (let i = 0; i < I.n; i++) zebra.push(k(pas(0, -b / 2, R, b / 2).rotate(360 * i / I.n)));
      } else {   // spirála
        zebra.push(k(CS.circle(I.hub + b / 2, segmenty(I.hub))));
        zebra.push(k(k(CS.circle(I.rmid + b / 2, segmenty(I.rmid))).subtract(k(CS.circle(I.rmid - b / 2, segmenty(I.rmid))))));
        for (let i = 0; i < I.n; i++) {
          const th0 = 2 * Math.PI * i / I.n, L = [], P = [];
          const bod = r => { const th = th0 + I.k * (r - I.hub); return [r * Math.cos(th), r * Math.sin(th)]; };
          const kroku = 40, r1 = R + b;
          for (let q = 0; q <= kroku; q++) {
            const r = I.hub * 0.6 + (r1 - I.hub * 0.6) * q / kroku, a = bod(r), c = bod(r + 0.01);
            const tx = c[0] - a[0], ty = c[1] - a[1], l = Math.hypot(tx, ty), nx = -ty / l, ny = tx / l;
            L.push([a[0] + nx * b / 2, a[1] + ny * b / 2]); P.push([a[0] - nx * b / 2, a[1] - ny * b / 2]);
          }
          zebra.push(cs(L.concat(P.reverse())));
        }
      }
      return k(oblast.subtract(k(CS.union(zebra))));
    }
    const kapka = (r, nahoru, cu, cv) => SOUPE.kapka(r, nahoru, cu, cv);
    // vodorovná díra (p.diry): kapka hrotem nahoru (tisk bez podpor), nebo kruh stejného jmenovitého Ø
    const dira = (r, cu, cv) => (p.diry === 'kruh' ? G.obrysDiry(r, Math.max(24, segmenty(r)), false).map(([u, w]) => [cu + u, cv + w]) : kapka(r, true, cu, cv));
    /** Řez tělesem rovinou y = 0 → mnohoúhelníky v (x, z) pro výkres. */
    const rezY = m => k(k(m.rotate([90, 0, 0])).slice(0)).toPolygons().map(pl => pl.map(([x, y]) => [x, -y]));

    try {
      const v = p.vent, dily = [], sestava = [], kalibrace = [], vzor2d = {};
      const SA = polygon(o.SA);
      const diry = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => [a * o.r2, b * o.r2]);

      /** Mřížka (plochá deska vzorem dolů; nasazovací má sukni nahoru). oblast = obrys otvorů, Ain = vnitřek sukně. */
      function mrizka(oblast, srouby, Ain, jm) {
        const m = p.mrizka, tm = m.tl, otv = otvoryVzoru(m, oblast);
        vzor2d[jm] = otv.toPolygons();
        let deska, odeb = [hranolCS(otv, -1, tm + 1)];
        if (srouby) {
          deska = hranol(SA, 0, tm);
          for (const [x, y] of diry) odeb.push(valec(v.dira / 2 + 0.1, -1, tm + 1, x, y, 24));
          return rozdil(deska, odeb);
        }
        const Sv = { a: Ain / 2 + o.sts, rr: Math.min(v.roh, v.A / 2) + o.sts };
        deska = sjednot([hranol(polygon(Sv), 0, tm), rozdil(hranol(polygon(Sv), tm - 0.01, tm + m.sukne), [hranol(polygon({ a: Ain / 2, rr: Math.min(v.roh, v.A / 2) + m.vule }), tm, tm + m.sukne + 1)])]);
        return rozdil(deska, odeb);
      }
      const ventilator = (z0) => {
        const T = v.tl, ram = rozdil(hranol(SA, z0, z0 + T), [valec(o.Df / 2 + 0.3, z0 - 1, z0 + T + 1), ...diry.map(([x, y]) => valec(v.dira / 2, z0 - 1, z0 + T + 1, x, y, 16))]);
        const hub = valec(o.Df * 0.17, z0 + 2, z0 + T - 2);
        const lopat = [];
        for (let i = 0; i < 7; i++) lopat.push(k(k(k(kvadr(0, -o.Df * 0.09, -0.8, o.Df / 2 - 1.2, o.Df * 0.09, 0.8).rotate([28, 0, 0])).rotate([0, 0, 360 * i / 7])).translate([0, 0, z0 + T / 2])));
        return sjednot([ram, hub, ...lopat]);
      };

      if (p.druh === 'mrizka') {
        const nas = p.mrizka.uchyceni === 'nasazovaci';
        const g = mrizka(o.oblast, !nas, o.Ain, 'mrizka');
        dily.push(sit(k, g, 'mrizka', nas ? 'Nasazovací mřížka' : 'Mřížka', '#2F5FA8'));
        // sestava: ventilátor pod mřížkou, mřížka otočená plochou nahoru (sukně dolů přes rám)
        const fan = ventilator(-v.tl);
        sestava.push(sit(k, fan, 'ventilator', 'Ventilátor', '#8a9099'));
        sestava.push(sit(k, posun(k(g.rotate([180, 0, 0])), 0, 0, o.tm), 'mrizka', dily[0].nazev, '#2F5FA8'));
        if (volby.kalibrace) kalibraceVzorku();
        const prunik = { mrizkaVentilator: nas ? k(k(posun(k(g.rotate([180, 0, 0])), 0, 0, o.tm)).intersect(fan)).volume() : 0 };
        const rez = [{ jmeno: 'mrizka', polys: rezY(g) }];
        return { dily, sestava, kalibrace, o, prunik, vzor2d, rez, cas: Date.now() - t0 };
      }

      /* ---- tělo (přechod / skříň odsávače) ---- */
      const plne = [], odeb = [];
      const typ = p.vystup.typ, nU = Math.max(uhlu(o.So), 128);   // stejné úhly v přechodu, kapse i hrdle (žádné štěpiny na švech)
      const zBox = o.skrin ? o.zL0 : o.tp;
      plne.push(hranol(SA, 0, zBox));
      // otvor desky (nebo mřížka v desce)
      if (p.deska.mrizka) odeb.push(hranolCS(otvoryVzoru(p.mrizka, o.otvorDesky), -1, o.tp + 0.05));
      else odeb.push(hranol(polygon(o.otvorDesky), -1, o.tp + 0.05));
      vzor2d.deska = p.deska.mrizka ? otvoryVzoru(p.mrizka, o.otvorDesky).toPolygons() : null;
      // díry pro šrouby ventilátoru (+ kapsy matic shora)
      for (const [x, y] of diry) {
        odeb.push(valec(o.diraD / 2, -1, o.tp + 0.05, x, y, 24));
        if (v.upevneni === 'matice') odeb.push(hranol(sestiuh(o.S.s + 0.3, x, y), o.tp - o.S.m - 0.3, o.tp + 0.3));
      }
      if (o.skrin) {
        odeb.push(hranol(polygon(o.Fk, nU), o.tp, o.zK));                                     // kapsa
        // sražení kapsy k vnitřku přechodu (obálka – rohy jsou soustředné, stěny ≈ 40°)
        const pF = polygon(o.Fk, nU), pFi = polygon(o.Fi, nU);
        odeb.push(k(M.hull(pF.map(([x, y]) => [x, y, o.zK - 0.01]).concat(pFi.map(([x, y]) => [x, y, o.zL0 + 0.01])))));
        if (o.filtr) odeb.push(kvadr(-o.F.a, 0, o.tp, o.F.a, o.SA.a + 1, o.zK));               // štěrbina zásuvky (+Y)
      }
      if (typ === 'limec') {
        plne.push(hranol(SA, zBox - 0.5, o.zTop));
        odeb.push(hranol(polygon(o.Si), o.skrin ? o.zL0 - 0.5 : o.tp, o.zTop + 1));
      } else {
        const C1o = kruhS(o.ro1), C1i = kruhS(o.ri1);
        plne.push(loft(radyLoftu(o.So, C1o, o.zL0, o.zL1, 0.5, 0), nU));
        const dolu = o.skrin ? 0.5 : 0;
        odeb.push(loft(radyLoftu(o.Si, C1i, o.zL0, o.zL1, dolu, typ === 'na' ? 0.5 : 0), nU));
        if (typ === 'na' || typ === 'do') {
          const h = o.h, L = h.L;
          // pata hrdla se pod přechod zužuje 45° (leží uvnitř přechodu), vrtání „na“ začíná dorazem, „do“ navazuje na přechod
          const ven = [[0, -0.6], [h.ro - 0.3, -0.6], [h.ro, 0], ...(typ === 'na' ? [[h.ro, L - 0.5], [h.ro - 0.5, L]] : [[h.roU, L - 0.8], [h.roU - 0.8, L]]), [0, L]];
          const dut = typ === 'na' ? [[0, 0], [h.ri, 0], [h.riU, L - 0.8], [h.riU + 1.8, L + 1], [0, L + 1]] : [[0, -0.3], [h.ri, -0.3], [h.ri, L + 1], [0, L + 1]];
          plne.push(posun(otoc(ven, nU), 0, 0, o.zL1)); odeb.push(posun(otoc(dut, nU), 0, 0, o.zL1));
        } else {
          const j = jamkaProfily(o.kh, o.zS, o.zL1);
          plne.push(otoc(j.ven, nU)); odeb.push(otoc(j.dut, nU), valec(o.kh.rc, o.zL1 - 0.3, o.zS, 0, 0, nU));
        }
      }
      // čepy stojánku (kapka hrotem dolů, slepá díra kapkou nahoru / kruhem podle p.diry)
      if (o.stojan) for (const sg of [1, -1]) {
        const x0 = sg > 0 ? o.SA.a - 0.5 : -o.SA.a - o.Lb, x1 = sg > 0 ? o.SA.a + o.Lb : -o.SA.a + 0.5;
        plne.push(podelX(kapka(o.Rb, false, 0, o.zc), x0, x1));
        const h0 = sg > 0 ? o.SA.a + o.Lb - o.vrtani : -o.SA.a - o.Lb - 1, h1 = sg > 0 ? o.SA.a + o.Lb + 1 : -o.SA.a - o.Lb + o.vrtani;
        odeb.push(podelX(dira(o.Ss.pilot / 2, 0, o.zc), h0, h1));
      }
      const telo = rozdil(sjednot(plne), odeb);
      const jmTela = p.druh === 'odsavac' ? 'Skříň odsávače' : 'Přechod';
      dily.push(sit(k, telo, 'telo', jmTela, '#2F5FA8'));

      /* ---- zásuvka filtru ---- */
      let zasuvka = null;
      if (o.filtr) {
        const f = p.filtr, x = o.zx, lem = f.lem, tz = f.ram;
        const obr = sjednot([hranol(polygon({ a: x, rr: Math.max(0.3, o.Fk.rr - f.vule) }), 0, tz), kvadr(-x, 0, 0, x, o.F.a, tz)]);
        const ram = rozdil(obr, [kvadr(-x + lem, -x + lem, -1, x - lem, x - lem, tz + 1)]);
        const zebra = [];
        for (let xx = -x + lem + 15; xx < x - lem - 4; xx += 15) zebra.push(kvadr(xx - 0.8, -x + lem - 0.1, 0, xx + 0.8, x - lem + 0.1, tz));
        const celo = kvadr(-x, o.F.a - 0.01, 0, x, o.SA.a - 0.2, o.zh);
        const wU = Math.min(30, x), uchyt = kvadr(-wU / 2, o.SA.a - 0.3, 0, wU / 2, o.SA.a + 6, Math.min(o.zh, 8));
        zasuvka = sjednot([ram, ...zebra, celo, uchyt]);
        dily.push(sit(k, zasuvka, 'zasuvka', 'Zásuvka filtru', '#E88A2E'));
      }
      /* ---- víčko (nasazovací mřížka na límec) a ochranná mřížka ---- */
      let vicko = null, ochrana = null;
      if (o.vicko) { vicko = mrizka(o.oblastVicka, false, o.Ain, 'vicko'); dily.push(sit(k, vicko, 'vicko', 'Víčko s mřížkou', '#5BAF5B')); }
      if (o.ochrana) {
        const nas = p.mrizka.uchyceni === 'nasazovaci';
        ochrana = mrizka(kruhS(o.Df / 2), !nas, v.A + 2 * p.mrizka.vule, 'ochrana');
        dily.push(sit(k, ochrana, 'ochrana', 'Ochranná mřížka', '#5BAF5B'));
      }
      /* ---- stojánek ---- */
      let stojan = null;
      if (o.stojan) {
        const T = p.stojan.tl, Xo = o.Xu + o.tu, zp = o.Hp;
        const zakl = hranol([[-Xo, -o.Db / 2], [Xo, -o.Db / 2], [Xo, o.Db / 2], [-Xo, o.Db / 2]], 0, T);
        const stojna = [];
        const obrysStojny = [];
        for (let i = 0; i <= 24; i++) { const a = Math.PI * i / 24; obrysStojny.push([o.wu / 2 * Math.cos(a), zp + o.wu / 2 * Math.sin(a)]); }
        obrysStojny.push([-o.wu / 2 - 8, 0], [o.wu / 2 + 8, 0]);
        for (const sg of [1, -1]) {
          const x0 = sg > 0 ? o.Xu : -Xo;
          stojna.push(rozdil(podelX(obrysStojny, x0, x0 + o.tu), [podelX(dira(o.Ss.d / 2 + 0.25, 0, zp), x0 - 1, x0 + o.tu + 1)]));
        }
        stojan = sjednot([zakl, ...stojna]);
        dily.push(sit(k, stojan, 'stojan', 'Stojánek', '#7A5BAF'));
      }

      /* ---- sestava ---- */
      const fan = ventilator(-v.tl - 0.02);
      const vsechno = [[telo, 'telo', jmTela, '#2F5FA8'], [fan, 'ventilator', 'Ventilátor', '#8a9099']];
      if (zasuvka) {
        vsechno.push([posun(zasuvka, 0, 0, o.tp + 0.02), 'zasuvka', 'Zásuvka filtru', '#E88A2E']);
        vsechno.push([kvadr(-o.zx + 0.3, -o.zx + 0.3, o.tp + p.filtr.ram + 0.05, o.zx - 0.3, o.zx - 0.3, o.tp + p.filtr.ram + p.filtr.tl), 'filtr', 'Filtr', '#3b3b3b']);
      }
      if (vicko) vsechno.push([posun(k(vicko.rotate([180, 0, 0])), 0, 0, o.zTop + o.tm + 0.02), 'vicko', 'Víčko s mřížkou', '#5BAF5B']);
      if (ochrana) vsechno.push([posun(ochrana, 0, 0, -v.tl - o.tmO - 0.04), 'ochrana', 'Ochranná mřížka', '#5BAF5B']);
      const naklon = o.stojan ? p.stojan.naklon : 0;
      const natoc = m => (naklon ? k(k(k(m.translate([0, 0, -o.zc])).rotate([naklon, 0, 0])).translate([0, 0, o.zc])) : m);
      const montaz = vsechno.map(([m, jm, nz, b]) => [natoc(m), jm, nz, b]);
      if (stojan) montaz.push([posun(stojan, 0, 0, o.zc - o.Hp), 'stojan', 'Stojánek', '#7A5BAF']);
      for (const [m, jm, nz, b] of montaz) sestava.push(sit(k, m, jm, nz, b));

      // průniky v sestavě (měřené na tělesech, bez natočení)
      const prunik = {
        zasuvkaTelo: zasuvka ? k(k(posun(zasuvka, 0, 0, o.tp + 0.02)).intersect(telo)).volume() : 0,
        vickoTelo: vicko ? k(k(posun(k(vicko.rotate([180, 0, 0])), 0, 0, o.zTop + o.tm + 0.02)).intersect(telo)).volume() : 0,
        stojanTelo: stojan ? k(k(posun(stojan, 0, 0, o.zc - o.Hp)).intersect(sjednot([telo, fan]))).volume() : 0,
      };
      if (stojan && naklon) prunik.stojanNaklon = k(k(posun(stojan, 0, 0, o.zc - o.Hp)).intersect(sjednot([natoc(telo), natoc(fan)]))).volume();
      if (volby.kalibrace) kalibraceVzorku();
      const rez = vsechno.filter(x => x[1] !== 'ventilator').map(([m, jm]) => ({ jmeno: jm, polys: rezY(m) }));
      // převis stropu kruhových děr (horní oblouk ±45° → šířka r·√2 × délka díry, 2 strany) – Kontrola pak nabídne kapku
      const previsDiry = {};
      if (p.diry === 'kruh' && o.stojan) {
        previsDiry.telo = 2 * (o.Ss.pilot / 2) * Math.SQRT2 * o.vrtani;
        previsDiry.stojan = 2 * (o.Ss.d / 2 + 0.25) * Math.SQRT2 * o.tu;
      }
      return { dily, sestava, kalibrace, o, prunik, vzor2d, rez, previsDiry, cas: Date.now() - t0 };

      /* ---- kalibrační vzorek: tři kousky lícování s vůlí −krok, 0, +krok (počet zářezů = pořadí) ---- */
      function kalibraceVzorku() {
        const kr = p.tisk.krok, typ = p.druh === 'mrizka' || o.vicko ? 'sukne' : p.vystup.typ;
        for (let i = 0; i < 3; i++) {
          const dv = (i - 1) * kr, zar = [];
          let m, nazev;
          if (typ === 'na' || typ === 'do') {
            const h = SOUPE.hrdlo({ spoj: typ, od: p.vystup.od, id: p.vystup.id, delka: 12, kuzel: 0 }, { stena: p.vystup.stena, vule: p.vystup.vule + dv, doraz: 0 });
            const ri = typ === 'na' ? h.ri : h.ri, ro = h.ro;
            m = k(otoc([[ri, 0], [ro, 0], [ro, 12], [ri, 12]]));
            nazev = `Zkušební hrdlo ${i + 1} (vůle ${fmt(p.vystup.vule + dv, 2)})`;
            for (let j = 0; j <= i; j++) zar.push(k(k(kvadr(ro - 0.8, -0.5, 11, ro + 1, 0.5, 13).rotate([0, 0, 12 * j]))));
          } else if (typ === 'jamka') {
            const kh = KHAD.odvozene(KHAD.normalizuj({ kloub: Object.assign({}, p.jamka, { vule: p.jamka.vule + dv / 3, roztec: 150 }) }).p);
            const zS = kh.Ro * Math.SQRT2 + 2, j = jamkaProfily(kh, zS, 2);
            m = rozdil(sjednot([valec(kh.Ro + 1, 0, 2.01), otoc(j.ven)]), [otoc(j.dut), valec(Math.max(1, kh.rc), -1, zS)]);
            nazev = `Zkušební jamka ${i + 1} (vůle ${fmt(p.jamka.vule + dv / 3, 2)})`;
            for (let q = 0; q <= i; q++) zar.push(kvadr(-kh.Ro - 2, -2.5 + 2.2 * q, -1, -kh.Ro + 0.6, -1.5 + 2.2 * q, 1.2));
          } else {   // sukně mřížky přes rám (roh 30 × 30)
            const a = 15, vu = p.mrizka.vule + dv, rr = Math.min(v.roh, 10);
            const Sin = { a: a + vu, rr: rr + vu }, Sout = { a: a + vu + o.sts, rr: rr + vu + o.sts };
            m = rozdil(hranol(polygon(Sout), 0, 8), [hranol(polygon(Sin), -1, 9)]);
            nazev = `Zkušební sukně ${i + 1} (vůle ${fmt(vu, 2)})`;
            for (let q = 0; q <= i; q++) zar.push(kvadr(-6 + 3 * q, Sout.a - 0.8, 7, -5 + 3 * q, Sout.a + 1, 9));
          }
          kalibrace.push(sit(k, rozdil(m, zar), 'kal_' + (i + 1), nazev, '#E88A2E'));
        }
        if (typ === 'sukne') {   // čep 30 × 30 jako rám ventilátoru
          const S = { a: 15, rr: Math.min(v.roh, 10) };
          kalibrace.push(sit(k, hranol(polygon(S), 0, 7), 'kal_cep', 'Zkušební roh rámu 30 × 30', '#E88A2E'));
        }
      }
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }
  /** Profily jamky kloubu (r, z) se středem koule zS, kužel 45° začíná v z0 na poloměru rt. */
  function jamkaProfily(kh, zS, z0) {
    const aF = Math.atan2(kh.ztop, kh.rf), aL = Math.atan2(kh.zl, kh.rl), oblouk = KHAD.oblouk;
    const ven = [[0, z0 - 0.6], [kh.rt - 0.3, z0 - 0.6], [kh.rt, z0], ...oblouk(0, zS, kh.Ro, -Math.PI / 4, aF, 40).slice(1), [0, zS + kh.ztop]];
    const dut = [[0, zS - kh.Rs], ...oblouk(0, zS, kh.Rs, -Math.PI / 2, aL, 48).slice(1), [kh.rl + kh.c, zS + kh.ztop], [kh.rl + kh.c + 3, zS + kh.ztop + 3], [0, zS + kh.ztop + 3]];
    return { ven, dut };
  }

  /** Manifold → síť pro náhled a export. */
  function sit(k, m0, jmeno, nazev, barva) {
    const m = k(m0.simplify(1e-3));
    const st = m.status();
    if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
    if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
    const kusy = m.decompose().map(k);
    return { jmeno, nazev, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), teles: kusy.filter(x => x.volume() > 1e-3).length, barva, otocit: false };
  }

  function kontrolyModelu(p, model) {
    const H = [], pr = model.prunik;
    if (pr.zasuvkaTelo > 0.5) H.push({ uroven: 'chyba', pole: ['filtr.vule'], text: `Zásuvka filtru se v těle neposune (průnik ${fmt(pr.zasuvkaTelo, 0)} mm³).` });
    if (pr.vickoTelo > 0.5) H.push({ uroven: 'chyba', pole: ['mrizka.vule'], text: `Víčko nejde nasadit na límec (průnik ${fmt(pr.vickoTelo, 0)} mm³).` });
    if (pr.stojanTelo > 0.5) H.push({ uroven: 'chyba', pole: ['stojan.cep'], text: 'Stojánek naráží do skříně nebo ventilátoru.' });
    if (pr.stojanNaklon > 0.5) H.push({ uroven: 'varovani', pole: ['stojan.naklon'], text: `Při náklonu ${fmt(p.stojan.naklon)}° naráží skříň do stojánku.` });
    if (pr.mrizkaVentilator > 0.5) H.push({ uroven: 'chyba', pole: ['mrizka.vule'], text: 'Sukně mřížky nejde přes rám ventilátoru.' });
    for (const d of model.dily.concat(model.kalibrace)) {
      if (d.teles > 1) H.push({ uroven: 'chyba', pole: null, text: `${d.nazev}: díl se rozpadl na ${d.teles} tělesa – některá část není spojená.` });
      const r = G.rozborTisku(d, p.tisk.uhel);
      const pd = (model.previsDiry || {})[d.jmeno] || 0;
      if (r.previs > 5 && pd > 0 && r.previs <= 1.3 * pd + 5) H.push({ uroven: 'varovani', pole: ['diry'], text: `${d.nazev}: strop kruhových vodorovných děr převisá (${fmt(r.previs, 0)} mm²) – tiskněte s podporami nebo zvolte kapku.`, oprava: { text: 'díry jako kapka', zmeny: { diry: 'kapka' } } });
      else if (r.previs > 5) H.push({ uroven: 'varovani', pole: ['tisk.uhel', 'prechod.delka'], text: `${d.nazev}: převisy nad ${fmt(p.tisk.uhel)}° od svislice ${fmt(r.previs, 0)} mm² – v tom místě může potřebovat podpory.` });
      if (r.most > 1) H.push({ uroven: 'info', pole: null, text: `${d.nazev}: tiskárna přemostí ${fmt(r.most, 0)} mm² vodorovného stropu (štěrbina zásuvky, kapsy).` });
    }
    return H;
  }

  /* ---------------- kusovník ---------------- */
  /** Řádky kusovníku [název, množství, poznámka]; model (nepovinný) doplní hmotnosti tištěných dílů. */
  function kusovnik(p, o, model) {
    const mat = MATERIALY[p.tisk.material], r = [], v = p.vent;
    const g = jm => { const d = model && model.dily.find(x => x.jmeno === jm); return d ? ` · ${fmt(d.objem / 1000 * mat.hustota, 0)} g` : ''; };
    if (model) for (const d of model.dily) r.push([`${d.nazev} (tisk)`, '1 ks', `${mat.nazev}${g(d.jmeno)}`]);
    r.push([`Ventilátor ${fmt(v.A)} × ${fmt(v.A)} × ${fmt(v.tl)} mm`, '1 ks', `rozteč děr ${fmt(v.roztec)} mm · ${fmt(v.Qmax)} m³/h, ${fmt(v.pmax)} Pa`]);
    if (p.druh === 'mrizka') {
      if (p.mrizka.uchyceni === 'srouby') r.push(['Šroub do ventilátoru (samořezný, ze sady k ventilátoru)', '4 ks', `dlouhý ≈ ${fmt(p.mrizka.tl + 8)} mm`]);
      return r;
    }
    const S = v.sroub;
    r.push([v.upevneni === 'samorez' ? `Šroub ${S} × ${o.delkaSroubu} (samořezný do plastu nebo s řezaným závitem)` : `Šroub ISO 4762 ${S} × ${o.delkaSroubu}`, '4 ks', o.ochrana && p.mrizka.uchyceni === 'srouby' ? 'skrz ochrannou mřížku a rám ventilátoru do desky' : 'skrz rám ventilátoru do desky']);
    if (v.upevneni === 'matice') r.push([`Matice ISO 4032 ${S}`, '4 ks', 'do kapes v desce']);
    if (o.filtr) r.push([`Filtr – ${FILTRY[p.filtr.typ].nazev}`, '1 ks', `přistřihnout na ${fmt(o.filtrRozmer, 0)} × ${fmt(o.filtrRozmer, 0)} × ${fmt(p.filtr.tl)} mm`]);
    if (o.stojan) {
      r.push([`Šroub ${p.stojan.sroub} × ${o.delkaSroubuStojanu} (samořezný do plastu)`, '2 ks', 'čepy náklonu – utažením se nastaví tření']);
      r.push([`Podložka ${p.stojan.sroub}`, '2 ks', 'pod hlavu']);
    }
    if (p.vystup.typ === 'na' || p.vystup.typ === 'do') {
      const t = TRUBKY.find(x => x.spoj === p.vystup.typ && Math.abs((p.vystup.typ === 'na' ? x.od : x.id) - (p.vystup.typ === 'na' ? p.vystup.od : p.vystup.id)) < 0.05);
      r.push([t ? t.nazev : (p.vystup.typ === 'na' ? `Trubka OD ${fmt(p.vystup.od)}` : `Hadice / trubka ID ${fmt(p.vystup.id)}`), fmt(p.proud.delka, 2) + ' m', p.vystup.typ === 'na' ? 'zasune se do hrdla' : 'navléknout na hrdlo, případně stáhnout sponou']);
    }
    if (p.vystup.typ === 'jamka') r.push([`Kloubová hadice – koule Ø ${fmt(p.jamka.koule)}, kanál Ø ${fmt(p.jamka.kanal)}`, '1 ks', 'stránka Kloubová hadice se stejnými rozměry kloubu']);
    r.push(['Napájení ventilátoru (zdroj 12 V, vypínač)', '1 ks', 'podle ventilátoru']);
    return r;
  }

  /* ---------------- projekt ---------------- */
  function popis(p) {
    const v = p.vent;
    if (p.druh === 'mrizka') return `mřížka ${fmt(v.A)} · ${NAZVY.vzor[p.mrizka.vzor]} ${fmt(p.mrizka.roztec)} · ${NAZVY.uchyceni[p.mrizka.uchyceni]}`;
    const t = p.vystup.typ, vy = t === 'na' ? `trubka OD ${fmt(p.vystup.od)}` : t === 'do' ? `hadice ID ${fmt(p.vystup.id)}` : t === 'jamka' ? `jamka Ø ${fmt(p.jamka.koule)}` : 'límec s mřížkou';
    return `${p.druh === 'odsavac' ? 'odsávač' : 'přechod'} ${fmt(v.A)} → ${vy}${p.filtr.typ !== 'zadny' ? ' · filtr ' + fmt(p.filtr.tl) + ' mm' : ''}`;
  }
  const TYP = 'ventilator_trubka';
  const ulozProjekt = p => G.projektJson(TYP, p, 1);
  const nactiProjekt = text => G.nactiProjektJson(text, TYP, normalizuj, 'Ventilátor → trubka');

  const API = {
    MATERIALY, VENTILATORY, DATUM_VENT, SROUBY, DELKY_SROUBU, FILTRY, TRUBKY, NAZVY, VYCHOZI, MEZE, VYCTY, PREDVOLBY,
    normalizuj, predvolba, rho, kruhS, polygon, plochaS, vzorInfo, jeOtvor, volnaPlocha, kloub, odvozene, kontroly, textOpravy,
    ztraty, tlakVentilatoru, proudeni, zetaMrizky, postav, jamkaProfily, kontrolyModelu, kusovnik, delkaSroubu,
    popis, ulozProjekt, nactiProjekt, kopie, vezmi: G.vezmi, poloz: G.poloz, fmt,
  };
  if (uzel) module.exports = API; else window.VENTT = API;
})();

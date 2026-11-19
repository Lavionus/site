/* Síta a mřížky – jádro generátoru (bez DOM a bez three.js, spustitelné v node).

   Druhy:
     sito  – ploché síto s obrubou (kruh, obdélník, ovál, mnohoúhelník), ucha nebo rukojeť, výztužná žebra,
     vez   – třídicí věž: stoh sít s odstupňovaným okem, každé se spodním nákružkem zasune do horního okraje dalšího,
             víko a sběrná miska,
     vlozka – mřížka s límcem a nákružkem do otvoru (odtok dřezu, podlahová vpusť, kryt šachty, vložka do trubky),
     kuzel – do kužele: plochá vložka s kuželovým obvodem (sítko do trychtýře) nebo košík / miska se štěrbinami ve stěně.
   Oka: čtvercové, šestiúhelníkové, kruhové díry, podélné štěrbiny, radiální štěrbiny, kosočtverečné a „tkaná“ síť
   (dvě vrstvy rovnoběžných žeber křížem – horní žebra přemosťují mezery spodních, jako prodlužované vrstvy).

   Souřadnice dílu = montážní poloha, osa Z nahoru, síto leží v rovině z ∈ [0, tl] (u síta i misky na podložce).
   Díly s otocit = true (vložka, víko) se tisknou vzhůru nohama (G3D.tiskoveRozlozeni) – mřížka vždy leží na podložce.
   Všechny obrysy jsou konvexní, takže zkosení (nákružek věže) jde stavět jako konvexní obal dvou tenkých desek.
   Vzory otvorů jsou čisté mnohoúhelníky v JS (stejné body měří i test a výkres), manifold je jen ořízne a vysune. */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined' && module.exports;
  const G = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const kopie = G.kopie, fmt = G.fmt;
  const RAD = Math.PI / 180;

  /* ---------------- tabulky ---------------- */
  /** Materiál tisku: hustota g/cm³, modul pružnosti E (MPa), pevnost v ohybu (MPa) – typické hodnoty výrobců filamentu. */
  const MATERIALY = {
    PLA: { nazev: 'PLA', hustota: 1.24, E: 3500, pevnost: 60 },
    PETG: { nazev: 'PETG', hustota: 1.27, E: 2000, pevnost: 50 },
    ASA: { nazev: 'ASA', hustota: 1.07, E: 2000, pevnost: 45 },
    ABS: { nazev: 'ABS', hustota: 1.04, E: 2100, pevnost: 40 },
    PP: { nazev: 'PP', hustota: 0.9, E: 1300, pevnost: 30 },
  };
  /** Sypké materiály na sítu: objemová hmotnost kg/m³ (typické – ověřit). */
  const NASYPKY = {
    pisek: { nazev: 'písek suchý', rho: 1600 }, piskV: { nazev: 'písek vlhký', rho: 1900 }, sterk: { nazev: 'štěrk', rho: 1700 },
    zemina: { nazev: 'zemina / ornice', rho: 1300 }, kompost: { nazev: 'kompost', rho: 650 }, voda: { nazev: 'voda', rho: 1000 },
    mouka: { nazev: 'mouka', rho: 600 }, caj: { nazev: 'čaj / bylinky', rho: 350 },
  };
  /** Zrnitost (nejmenší rozměr zrna, mm). Písek a štěrk podle ČSN EN ISO 14688-1, ostatní typické – ověřit měřením. */
  const DATUM_ZRNITOSTI = '19. 11. 2026';
  const ZRNITOST = [
    { nazev: 'Mouka hladká', min: 0.02, max: 0.2, skup: 'kuchyně' },
    { nazev: 'Mouka polohrubá', min: 0.2, max: 0.4, skup: 'kuchyně' },
    { nazev: 'Mouka hrubá, krupice', min: 0.4, max: 0.8, skup: 'kuchyně' },
    { nazev: 'Cukr krystal', min: 0.3, max: 1.0, skup: 'kuchyně' },
    { nazev: 'Mletá káva – espresso', min: 0.2, max: 0.4, skup: 'kuchyně' },
    { nazev: 'Mletá káva – filtr', min: 0.5, max: 0.9, skup: 'kuchyně' },
    { nazev: 'Mák', min: 0.8, max: 1.2, skup: 'kuchyně' },
    { nazev: 'Sypaný čaj – lístky', min: 1, max: 5, skup: 'kuchyně' },
    { nazev: 'Rýže (šířka zrna)', min: 1.8, max: 2.6, skup: 'kuchyně' },
    { nazev: 'Čočka', min: 3, max: 7, skup: 'kuchyně' },
    { nazev: 'Písek jemný', min: 0.063, max: 0.2, skup: 'stavba' },
    { nazev: 'Písek střední', min: 0.2, max: 0.63, skup: 'stavba' },
    { nazev: 'Písek hrubý', min: 0.63, max: 2, skup: 'stavba' },
    { nazev: 'Štěrk jemný', min: 2, max: 6.3, skup: 'stavba' },
    { nazev: 'Štěrk střední', min: 6.3, max: 20, skup: 'stavba' },
    { nazev: 'Štěrk hrubý', min: 20, max: 63, skup: 'stavba' },
    { nazev: 'Substrát pro výsev', min: 0.2, max: 5, skup: 'zahrada' },
    { nazev: 'Kompost jemný', min: 0.5, max: 10, skup: 'zahrada' },
    { nazev: 'Kompost hrubý', min: 1, max: 40, skup: 'zahrada' },
    { nazev: 'Ornice s hrudkami', min: 0.05, max: 25, skup: 'zahrada' },
    { nazev: 'Plastové granule / pelety', min: 2.5, max: 4, skup: 'dílna' },
  ];
  const NAZVY = {
    druh: { sito: 'Síto s obrubou', vez: 'Třídicí věž', vlozka: 'Vložka do otvoru', kuzel: 'Do kužele / miska' },
    tvar: { kruh: 'kruh', obdelnik: 'obdélník', oval: 'ovál', mnohouhelnik: 'mnohoúhelník' },
    oko: { ctverec: 'čtvercové', sestiuhelnik: 'šestiúhelníkové', kruh: 'kruhové díry', sterbiny: 'podélné štěrbiny', radialni: 'radiální štěrbiny', kosoctverec: 'kosočtverečné', tkana: 'tkaná (vrstvy křížem)' },
    vyztuha: { zadna: 'bez výztuh', kriz: 'kříž', paprsky: 'paprsky', mrizka: 'mřížka' },
    uchyty: { zadne: 'bez úchytů', ucha: 'dvě ucha', rukojet: 'rukojeť' },
    kuzel: { vlozka: 'plochá vložka do kužele', miska: 'košík / miska' },
  };

  const VYCHOZI = {
    verze: 1, nazev: 'Síto', druh: 'sito',
    tvar: { typ: 'kruh', prumer: 180, sirka: 200, delka: 150, roh: 12, stran: 6 },
    lem: { vyska: 25, tl: 2.4, okraj: 3 },
    oko: { typ: 'ctverec', velikost: 3, zebro: 1.2, tl: 2, uhel: 0, delka: 12 },
    vyztuha: { typ: 'zadna', sirka: 2.4, vyska: 4, pocet: 6, roztec: 50 },
    uchyty: { typ: 'ucha', delka: 18, sirka: 30, tl: 4, otvor: 6 },
    vlozka: { presah: 8, hloubka: 12, vule: 0.4 },
    kuzel: { typ: 'vlozka', prumer: 70, uhel: 30, dno: 45 },
    vez: { pater: 3, okoHorni: 8, okoDolni: 2, nakruzek: 8, vule: 0.4, vicko: true, miska: true, miskaVyska: 30 },
    vypocet: { material: 'pisek', vrstva: 30, hladina: 20 },
    tisk: { tryska: 0.4, vrstva: 0.2, uhel: 45, material: 'PLA', kusu: 1, podlozka: 250, kompenzace: 0 },
  };
  /** Meze číselných polí [min, max, celé?]. */
  const MEZE = {
    'tvar.prumer': [20, 400], 'tvar.sirka': [20, 400], 'tvar.delka': [20, 400], 'tvar.roh': [0, 100], 'tvar.stran': [3, 12, 1],
    'lem.vyska': [2, 150], 'lem.tl': [0.8, 10], 'lem.okraj': [0, 30],
    'oko.velikost': [0.3, 60], 'oko.zebro': [0.3, 20], 'oko.tl': [0.4, 20], 'oko.uhel': [-90, 90], 'oko.delka': [2, 200],
    'vyztuha.sirka': [0.8, 20], 'vyztuha.vyska': [0.5, 40], 'vyztuha.pocet': [3, 16, 1], 'vyztuha.roztec': [10, 200],
    'uchyty.delka': [5, 120], 'uchyty.sirka': [8, 80], 'uchyty.tl': [1.5, 15], 'uchyty.otvor': [0, 30],
    'vlozka.presah': [0, 60], 'vlozka.hloubka': [2, 100], 'vlozka.vule': [-0.5, 3],
    'kuzel.prumer': [15, 300], 'kuzel.uhel': [5, 60], 'kuzel.dno': [8, 300],
    'vez.pater': [1, 6, 1], 'vez.okoHorni': [0.3, 60], 'vez.okoDolni': [0.3, 60], 'vez.nakruzek': [3, 40], 'vez.vule': [0, 2], 'vez.miskaVyska': [5, 150],
    'vypocet.vrstva': [1, 300], 'vypocet.hladina': [1, 300],
    'tisk.tryska': [0.1, 1.2], 'tisk.vrstva': [0.05, 0.6], 'tisk.uhel': [20, 75], 'tisk.kusu': [1, 20, 1], 'tisk.podlozka': [80, 600], 'tisk.kompenzace': [0, 1],
  };
  const VYCTY = {
    druh: Object.keys(NAZVY.druh), 'tvar.typ': Object.keys(NAZVY.tvar), 'oko.typ': Object.keys(NAZVY.oko),
    'vyztuha.typ': Object.keys(NAZVY.vyztuha), 'uchyty.typ': Object.keys(NAZVY.uchyty), 'kuzel.typ': Object.keys(NAZVY.kuzel),
    'vypocet.material': Object.keys(NASYPKY), 'tisk.material': Object.keys(MATERIALY),
  };

  const PREDVOLBY = [
    { id: 'pisek', nazev: '🏖️ Síto na písek Ø 180', popis: 'oko 3 mm, ucha na kbelík', p: { vypocet: { vrstva: 20 } } },
    { id: 'kompost', nazev: '🌱 Síto na kompost Ø 210', popis: 'oko 10 mm, výztužný kříž, ucha', p: { nazev: 'Síto na kompost', tvar: { prumer: 210 }, lem: { vyska: 35, tl: 3 }, oko: { velikost: 10, zebro: 2.4, tl: 3 }, vyztuha: { typ: 'kriz', sirka: 3, vyska: 6 }, uchyty: { delka: 16, sirka: 36, tl: 5 }, vypocet: { material: 'kompost', vrstva: 60 } } },
    { id: 'zemina', nazev: '🪴 Síto na substrát 200 × 150', popis: 'obdélník, šestiúhelníkové oko 5 mm', p: { nazev: 'Síto na substrát', tvar: { typ: 'obdelnik', sirka: 200, delka: 150, roh: 12 }, lem: { vyska: 30 }, oko: { typ: 'sestiuhelnik', velikost: 5, zebro: 1.2, tl: 2.4 }, vyztuha: { typ: 'kriz', vyska: 4 }, vypocet: { material: 'zemina', vrstva: 40 } } },
    { id: 'mouka', nazev: '🥣 Sítko na mouku Ø 150', popis: 'tkaná síť 1 mm, výztužný kříž, rukojeť', p: { nazev: 'Sítko na mouku', tvar: { prumer: 150 }, lem: { vyska: 40, tl: 2, okraj: 2 }, oko: { typ: 'tkana', velikost: 1, zebro: 0.8, tl: 1.6 }, vyztuha: { typ: 'kriz', sirka: 2, vyska: 3 }, uchyty: { typ: 'rukojet', delka: 80, sirka: 20, tl: 5, otvor: 8 }, vypocet: { material: 'mouka', vrstva: 20 }, tisk: { material: 'PETG' } } },
    { id: 'zelenina', nazev: '🥬 Cedník oválný 200 × 150', popis: 'kruhové díry 4 mm, ucha', p: { nazev: 'Cedník', tvar: { typ: 'oval', sirka: 200, delka: 150 }, lem: { vyska: 45 }, oko: { typ: 'kruh', velikost: 4, zebro: 1.6, tl: 2 }, vypocet: { material: 'voda', vrstva: 30 }, tisk: { material: 'PETG' } } },
    { id: 'caj', nazev: '🍵 Sítko na čaj do hrnku', popis: 'košík Ø 70 se štěrbinami, ucha na okraj', p: { nazev: 'Sítko na čaj', druh: 'kuzel', kuzel: { typ: 'miska', prumer: 70, dno: 46 }, lem: { vyska: 40, tl: 1.6, okraj: 2 }, oko: { typ: 'kruh', velikost: 1.2, zebro: 0.9, tl: 1.2 }, uchyty: { typ: 'ucha', delka: 14, sirka: 16, tl: 3, otvor: 0 }, vypocet: { material: 'voda', vrstva: 30, hladina: 30 }, tisk: { material: 'PETG' } } },
    { id: 'trychtyr', nazev: '🔻 Sítko do trychtýře Ø 60 / 60°', popis: 'plochá vložka, sedí v kuželu 60°', p: { nazev: 'Sítko do trychtýře', druh: 'kuzel', kuzel: { typ: 'vlozka', prumer: 60, uhel: 30 }, lem: { vyska: 6, tl: 1.6, okraj: 1.5 }, oko: { typ: 'ctverec', velikost: 1.5, zebro: 0.8, tl: 1.2 }, uchyty: { typ: 'zadne' }, vypocet: { material: 'voda', vrstva: 20 }, tisk: { material: 'PETG' } } },
    { id: 'drez', nazev: '🚰 Sítko do odtoku Ø 38', popis: 'límec 10 mm, radiální štěrbiny', p: { nazev: 'Sítko do odtoku', druh: 'vlozka', tvar: { prumer: 38 }, lem: { tl: 1.6, okraj: 1.5 }, oko: { typ: 'radialni', velikost: 2, zebro: 1.2, tl: 1.6, delka: 6 }, vlozka: { presah: 10, hloubka: 10, vule: 0.6 }, uchyty: { typ: 'zadne' }, vypocet: { material: 'voda', vrstva: 10 }, tisk: { material: 'PETG' } } },
    { id: 'vpust', nazev: '🔲 Mřížka podlahové vpusti 100 × 100', popis: 'štěrbiny 5 mm, žebra zespodu', p: { nazev: 'Mřížka vpusti', druh: 'vlozka', tvar: { typ: 'obdelnik', sirka: 100, delka: 100, roh: 3 }, lem: { tl: 2, okraj: 3 }, oko: { typ: 'sterbiny', velikost: 5, zebro: 2.5, tl: 4, delka: 28 }, vyztuha: { typ: 'mrizka', sirka: 2.5, vyska: 5, roztec: 34 }, vlozka: { presah: 6, hloubka: 8, vule: 0.6 }, uchyty: { typ: 'zadne' }, vypocet: { material: 'voda', vrstva: 10 }, tisk: { material: 'PETG' } } },
    { id: 'sachta', nazev: '⭕ Kryt šachty Ø 160', popis: 'šestiúhelníky 12 mm, paprsky zespodu', p: { nazev: 'Kryt šachty', druh: 'vlozka', tvar: { prumer: 160 }, lem: { tl: 3, okraj: 5 }, oko: { typ: 'sestiuhelnik', velikost: 12, zebro: 4, tl: 6 }, vyztuha: { typ: 'paprsky', pocet: 6, sirka: 4, vyska: 10 }, vlozka: { presah: 12, hloubka: 15, vule: 1 }, uchyty: { typ: 'zadne' }, vypocet: { material: 'zemina', vrstva: 50 }, tisk: { material: 'ASA' } } },
    { id: 'trubka', nazev: '🧪 Vložka do trubky DN 50', popis: 'bez límce, na tření do HT trubky', p: { nazev: 'Vložka do trubky', druh: 'vlozka', tvar: { prumer: 46.4 }, lem: { tl: 1.6, okraj: 1.5 }, oko: { typ: 'kruh', velikost: 3, zebro: 1.2, tl: 2 }, vlozka: { presah: 0, hloubka: 15, vule: 0.3 }, uchyty: { typ: 'zadne' }, vypocet: { material: 'voda', vrstva: 20 }, tisk: { material: 'PETG' } } },
    { id: 'vez', nazev: '🗼 Třídicí věž Ø 150 – 3 síta', popis: 'oka 8 → 4 → 2 mm, víko a miska', p: { nazev: 'Třídicí věž', druh: 'vez', tvar: { prumer: 150 }, lem: { vyska: 35, tl: 2.4, okraj: 2 }, oko: { typ: 'ctverec', zebro: 1.2, tl: 2 }, uchyty: { typ: 'zadne' }, vypocet: { material: 'pisek', vrstva: 25 } } },
    { id: 'sesti', nazev: '⬡ Šestiboké síto 180', popis: 'mnohoúhelník, kosočtverečné oko', p: { nazev: 'Šestiboké síto', tvar: { typ: 'mnohouhelnik', prumer: 180, stran: 6 }, lem: { vyska: 25 }, oko: { typ: 'kosoctverec', velikost: 4, zebro: 1.2, tl: 2 }, vyztuha: { typ: 'paprsky', pocet: 6, sirka: 2.4, vyska: 4 } } },
  ];

  /* ---------------- normalizace a projekt ---------------- */
  function normalizuj(v) {
    const r = G.normalizuj(v, { VYCHOZI, MEZE, VYCTY, fmt });
    return r;
  }
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(G.slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }
  const TYP = 'sita';
  const ulozProjekt = p => G.projektJson(TYP, p, 1);
  const nactiProjekt = text => G.nactiProjektJson(text, TYP, normalizuj, 'Síta a mřížky');

  /* ---------------- obrysy (analyticky) ---------------- */
  const segmenty = r => Math.max(24, Math.min(240, Math.ceil(2 * Math.PI * Math.abs(r) / 1.2)));
  /** Tvar síta: {typ, a, b (poloosy / půlstrany), r (poloměr rohu), n (stran), ap (apotéma mnohoúhelníku)}. */
  function tvar(p) {
    if (p.druh === 'kuzel') { const R = rozmeryKuzelu(p).Rb; return { typ: 'kruh', a: R, b: R, r: R, n: 0 }; }
    const t = p.tvar;
    if (t.typ === 'obdelnik') {
      const a = t.sirka / 2, b = t.delka / 2;
      // věž: zaoblení menší než zkosení nákružku by se ve zkosení měnilo na ostrý roh (převis) → ostré rohy
      const r = Math.min(t.roh, a, b);
      return { typ: 'obdelnik', a, b, r: p.druh === 'vez' && r < rohVezeMin(p) ? 0 : r, n: 4 };
    }
    if (t.typ === 'oval') return { typ: 'oval', a: t.sirka / 2, b: t.delka / 2, r: Math.min(t.sirka, t.delka) / 2, n: 0 };
    if (t.typ === 'mnohouhelnik') { const ap = t.prumer / 2, n = t.stran; const R = ap / Math.cos(Math.PI / n); return { typ: 'mnohouhelnik', a: R, b: R, ap, r: 0, n }; }
    return { typ: 'kruh', a: t.prumer / 2, b: t.prumer / 2, r: t.prumer / 2, n: 0 };
  }
  const rohVezeMin = p => 2 * p.lem.tl + p.vez.vule;
  /** Obvod a plocha obrysu posunutého o d (Steinerův vzorec pro konvexní tvar; mnohoúhelník s ostrými rohy přesně). */
  function obvod(T) {
    if (T.typ === 'kruh') return 2 * Math.PI * T.a;
    if (T.typ === 'obdelnik') return 4 * (T.a - T.r) + 4 * (T.b - T.r) + 2 * Math.PI * T.r;
    if (T.typ === 'oval') { const h = ((T.a - T.b) / (T.a + T.b)) ** 2; return Math.PI * (T.a + T.b) * (1 + 3 * h / (10 + Math.sqrt(4 - 3 * h))); }
    return 2 * T.n * T.ap * Math.tan(Math.PI / T.n);
  }
  function plocha(T, d = 0) {
    if (T.typ === 'mnohouhelnik') { const ap = Math.max(0, T.ap + d); return T.n * ap * ap * Math.tan(Math.PI / T.n); }
    if (T.typ === 'obdelnik' && T.r + d <= 0) return 4 * Math.max(0, T.a + d) * Math.max(0, T.b + d);
    const A0 = T.typ === 'kruh' ? Math.PI * T.a * T.a : T.typ === 'oval' ? Math.PI * T.a * T.b : 4 * (T.a - T.r) * (T.b - T.r) + 4 * T.r * ((T.a - T.r) + (T.b - T.r)) + Math.PI * T.r * T.r;
    if (T.typ === 'kruh') return Math.PI * Math.max(0, T.a + d) ** 2;
    return Math.max(0, A0 + obvod(T) * d + Math.PI * d * d);
  }
  /** Nejmenší „poloměr“ obrysu posunutého o d (kontrola, že pole oka ještě existuje). */
  const polomerMin = (T, d) => (T.typ === 'mnohouhelnik' ? T.ap : Math.min(T.a, T.b)) + d;
  /** Body obrysu posunutého o d (pro výkres a body bez manifoldu). */
  function bodyObrysu(T, d = 0) {
    const B = [];
    if (T.typ === 'kruh') { const R = T.a + d, n = segmenty(R); for (let i = 0; i < n; i++) B.push([R * Math.cos(2 * Math.PI * i / n), R * Math.sin(2 * Math.PI * i / n)]); return B; }
    if (T.typ === 'mnohouhelnik') { const R = (T.ap + d) / Math.cos(Math.PI / T.n); for (let i = 0; i < T.n; i++) { const f = Math.PI / T.n + 2 * Math.PI * i / T.n; B.push([R * Math.cos(f), R * Math.sin(f)]); } return B; }
    if (T.typ === 'oval') {   // posun elipsy po normále
      const n = segmenty(Math.max(T.a, T.b));
      for (let i = 0; i < n; i++) { const f = 2 * Math.PI * i / n, x = T.a * Math.cos(f), y = T.b * Math.sin(f); const nx = T.b * Math.cos(f), ny = T.a * Math.sin(f), l = Math.hypot(nx, ny); B.push([x + d * nx / l, y + d * ny / l]); }
      return B;
    }
    const r = T.r + d, ax = T.a - T.r, by = T.b - T.r;
    if (r <= 0.01) { const A = T.a + d, Bq = T.b + d; return [[A, -Bq], [A, Bq], [-A, Bq], [-A, -Bq]]; }
    const n = Math.max(4, Math.ceil(segmenty(r) / 4));
    for (const [cx, cy, f0] of [[ax, -by, -90], [ax, by, 0], [-ax, by, 90], [-ax, -by, 180]]) for (let i = 0; i <= n; i++) { const f = (f0 + 90 * i / n) * RAD; B.push([cx + r * Math.cos(f), cy + r * Math.sin(f)]); }
    return B;
  }

  /* ---------------- odvozené rozměry ---------------- */
  /** Kužel: Rt = poloměr nahoře (sedlo ve trychtýři / okraj misky), Rb = poloměr dole, h výška, alfa sklon stěny od svislice. */
  function rozmeryKuzelu(p) {
    const k = p.kuzel, h = p.lem.vyska, tm = p.oko.tl, Rt = k.prumer / 2;
    if (k.typ === 'miska') {
      const Rb = Math.min(k.dno / 2, Rt);
      return { Rt, Rb, h, alfa: Math.atan2(Rt - Rb, Math.max(0.1, h - tm)) / RAD };
    }
    const alfa = k.uhel, Rb = Rt - Math.max(0, h - tm) * Math.tan(alfa * RAD);
    return { Rt, Rb, h, alfa };
  }
  /** Oka věže: geometrická řada od horního (nejhrubšího) k dolnímu, na 0,1 mm. */
  function okaVeze(p) {
    const v = p.vez, n = v.pater;
    if (n === 1) return [v.okoHorni];
    return Array.from({ length: n }, (_, i) => Math.round(10 * v.okoHorni * (v.okoDolni / v.okoHorni) ** (i / (n - 1))) / 10);
  }
  /**
   * Odvozené rozměry bez manifoldu: T tvar, t stěna, sita = [{nazev, a, b, dPole, dVnitr, T}] – každé pole oka
   * (dPole = posun obrysu na hranici oka, dVnitr = vnitřní stěna, na kterou se síto opírá).
   */
  function odvozene(p) {
    const T = tvar(p), t = p.lem.tl, ok = p.lem.okraj, o = { T, t, druh: p.druh };
    const s = (nazev, a, dVnitr) => ({ nazev, a, b: p.oko.zebro, dVnitr, dPole: dVnitr - ok, T });
    if (p.druh === 'vez') {
      const v = p.vez;
      o.oka = okaVeze(p);
      o.sita = o.oka.map((a, i) => s(`Síto ${i + 1} – oko ${fmt(a, 1)}`, a, -(2 * t + v.vule)));
      o.zkoseni = t + v.vule;
      o.vyska = (v.miska ? v.miskaVyska : v.nakruzek + v.vule) + v.pater * (p.lem.vyska - v.nakruzek - v.vule) + (v.vicko ? 2.4 : 0);
    } else if (p.druh === 'vlozka') {
      const v = p.vlozka;
      o.sita = [s('Mřížka', p.oko.velikost, -(v.vule / 2 + t))];
      o.desku = v.presah > 0 ? v.presah : -v.vule / 2;
      o.vyska = p.oko.tl + v.hloubka;
    } else if (p.druh === 'kuzel') {
      o.k = rozmeryKuzelu(p);
      o.sita = [s(p.kuzel.typ === 'miska' ? 'Dno košíku' : 'Sítko', p.oko.velikost, -t)];
      o.vyska = p.lem.vyska;
      if (p.kuzel.typ === 'miska') {
        const k = o.k, a = p.oko.velikost, b = p.oko.zebro;
        o.sterbin = Math.min(180, Math.floor(2 * Math.PI * (k.Rb - t) / (a + b)));
        o.sterbinaZ = [p.oko.tl + Math.max(ok, 1.5), k.h - Math.max(ok, 3)];
      }
    } else {
      o.sita = [s('Síto', p.oko.velikost, -t)];
      o.vyska = p.lem.vyska;
    }
    for (const x of o.sita) {
      x.Apole = plocha(T, x.dPole);
      x.Avnitr = plocha(T, x.dVnitr);
      x.fi = podilVzoru(p.oko, x.a, x.b, Math.sqrt(x.Apole / Math.PI));
      x.otvoru = odhadOtvoru(p.oko, x.a, x.b, x.Apole);
      x.Aotvoru = x.fi * x.Apole;
    }
    return o;
  }
  /** Podíl otvorů ve vzoru (bez okraje a výztuh). R = poloměr pole (pro radiální štěrbiny). */
  function podilVzoru(oko, a, b, R) {
    const P = a + b, L = oko.delka;
    switch (oko.typ) {
      case 'kruh': return Math.PI / (2 * Math.sqrt(3)) * (a / P) ** 2;
      case 'sterbiny': return a * L / (P * (L + b));
      case 'radialni': {
        let A = 0;
        for (const [r0, r1, n] of prstenceRadialni(a, b, L, R)) A += n * a * (Math.min(r1, R) - r0);
        return R > 0 ? A / (Math.PI * R * R) : 0;
      }
      default: return (a / P) ** 2;   // čtverec, šestiúhelník, kosočtverec, tkaná
    }
  }
  function odhadOtvoru(oko, a, b, A) {
    const P = a + b;
    if (oko.typ === 'sterbiny') return A / (P * (oko.delka + b));
    if (oko.typ === 'kruh' || oko.typ === 'sestiuhelnik') return A / (P * P * Math.sqrt(3) / 2);
    if (oko.typ === 'radialni') { let n = 0; for (const x of prstenceRadialni(a, b, oko.delka, Math.sqrt(A / Math.PI))) n += x[2]; return n; }
    if (oko.typ === 'kosoctverec') return A / (P * P / Math.sin(60 * RAD));
    if (oko.typ === 'tkana') return A / (P * P);
    return A / (P * P);
  }
  /** Prstence radiálních štěrbin: [r0, r1, počet]; mezi štěrbinami u vnitřního kraje zůstane aspoň žebro b. */
  function prstenceRadialni(a, b, L, R) {
    const out = [];
    for (let r0 = Math.max(2 * b, a, 3); r0 < R - 0.5; r0 += L + b) {
      const n = Math.floor(2 * Math.PI * r0 / (a + b));
      if (n >= 3) out.push([r0, Math.min(r0 + L, R), n]);
    }
    return out;
  }

  /* ---------------- vzor otvorů (čisté mnohoúhelníky) ---------------- */
  /**
   * Otvory vzoru v místní soustavě (před natočením o oko.uhel a oříznutím polem oka), pokrývají kruh o poloměru R.
   * a = světlost oka, b = žebro. Tkaná síť vrací {vrstvy: [pásy spodní (podél X), pásy horní (podél Y)]} – mezery mezi pásy jsou oka.
   */
  function vzor(oko, a, b, R) {
    const P = a + b, polys = [];
    const kroky = (krok, R0) => { const n = Math.ceil(R0 / krok) + 1, o = []; for (let i = -n; i <= n; i++) o.push(i * krok); return o; };
    if (oko.typ === 'tkana') {
      const pasy = osa => kroky(P, R).map(c => { const y0 = c + a / 2, y1 = c + P - a / 2; return osa === 'x' ? [[-R, y0], [R, y0], [R, y1], [-R, y1]] : [[y0, -R], [y1, -R], [y1, R], [y0, R]]; });
      return { vrstvy: [pasy('x'), pasy('y')] };
    }
    if (oko.typ === 'ctverec' || oko.typ === 'kosoctverec') {
      // dvě rodiny rovnoběžných žeber s normálami n1, n2; otvor = |n1·x − s1| < a/2 a |n2·x − s2| < a/2
      const f = oko.typ === 'ctverec' ? [[0, 1], [1, 0]] : [[-Math.sin(30 * RAD), Math.cos(30 * RAD)], [Math.sin(30 * RAD), Math.cos(30 * RAD)]];
      const [[p1, q1], [p2, q2]] = f, det = p1 * q2 - q1 * p2;
      const res = (s1, s2) => [(s1 * q2 - q1 * s2) / det, (p1 * s2 - s1 * p2) / det];
      for (const s1 of kroky(P, R * 1.2)) for (const s2 of kroky(P, R * 1.2)) {
        const c = res(s1, s2);
        if (Math.hypot(c[0], c[1]) > R + P) continue;
        polys.push([res(s1 - a / 2, s2 - a / 2), res(s1 + a / 2, s2 - a / 2), res(s1 + a / 2, s2 + a / 2), res(s1 - a / 2, s2 + a / 2)]);
      }
      return { polys };
    }
    if (oko.typ === 'kruh' || oko.typ === 'sestiuhelnik') {
      const h = P * Math.sqrt(3) / 2, nj = Math.ceil(R / h) + 1, ni = Math.ceil(R / P) + 1;
      const nk = oko.typ === 'kruh' ? Math.max(8, Math.min(48, Math.ceil(Math.PI * a / 0.4))) : 6;
      // kruh: opsaný mnohoúhelník (zrno o průměru a projde); šestiúhelník: přes plochy a, plochy proti sousedům
      const rv = oko.typ === 'kruh' ? a / 2 / Math.cos(Math.PI / nk) : a / Math.sqrt(3), f0 = oko.typ === 'kruh' ? 0 : Math.PI / 6;
      for (let j = -nj; j <= nj; j++) for (let i = -ni; i <= ni; i++) {
        const x = i * P + ((j & 1) ? P / 2 : 0), y = j * h;
        if (Math.hypot(x, y) > R + P) continue;
        const pl = [];
        for (let k = 0; k < nk; k++) { const f = f0 + 2 * Math.PI * k / nk; pl.push([x + rv * Math.cos(f), y + rv * Math.sin(f)]); }
        polys.push(pl);
      }
      return { polys };
    }
    if (oko.typ === 'sterbiny') {
      const L = oko.delka, Q = L + b;
      for (let j = -Math.ceil(R / P) - 1; j <= Math.ceil(R / P) + 1; j++) for (let i = -Math.ceil(R / Q) - 1; i <= Math.ceil(R / Q) + 1; i++) {
        const x = i * Q + ((j & 1) ? Q / 2 : 0), y = j * P;
        if (Math.hypot(x, y) > R + Q) continue;
        polys.push([[x - L / 2, y - a / 2], [x + L / 2, y - a / 2], [x + L / 2, y + a / 2], [x - L / 2, y + a / 2]]);
      }
      return { polys };
    }
    // radiální štěrbiny v prstencích
    for (const [r0, r1, n] of prstenceRadialni(a, b, oko.delka, R)) {
      for (let i = 0; i < n; i++) {
        const f = 2 * Math.PI * (i + 0.5 * (Math.round(r0) % 2)) / n, c = Math.cos(f), s = Math.sin(f), w = a / 2;
        polys.push([[r0 * c + w * s, r0 * s - w * c], [r1 * c + w * s, r1 * s - w * c], [r1 * c - w * s, r1 * s + w * c], [r0 * c - w * s, r0 * s + w * c]]);
      }
    }
    return { polys };
  }

  /* ---------------- kontroly ---------------- */
  function kontroly(p) {
    const H = [], o = odvozene(p), ok = p.oko, tr = p.tisk.tryska, vr = p.tisk.vrstva;
    const chyba = (pole, text, oprava) => H.push({ uroven: 'chyba', pole, text, oprava });
    const varovani = (pole, text, oprava) => H.push({ uroven: 'varovani', pole, text, oprava });
    const info = (pole, text, oprava) => H.push({ uroven: 'info', pole, text, oprava });
    const zm = (text, zmeny) => ({ text, zmeny });
    const nahoru = (x, k = 0.1) => Math.ceil(x / k - 1e-9) * k;
    // oko a žebro vzhledem k trysce
    if (ok.zebro < 2 * tr - 1e-9) varovani(['oko.zebro'], `Žebro ${fmt(ok.zebro, 2)} mm je užší než 2 šířky extruze (tryska ${fmt(tr, 2)} mm) – vytiskne se děravé nebo vůbec.`, zm(`Žebro ${fmt(nahoru(2 * tr), 1)} mm`, { 'oko.zebro': +nahoru(2 * tr).toFixed(2) }));
    const okoMin = p.druh === 'vez' ? Math.min(p.vez.okoHorni, p.vez.okoDolni) : ok.velikost;
    const okoPole = p.druh === 'vez' ? ['vez.okoDolni'] : ['oko.velikost'];
    if (okoMin < tr - 1e-9) chyba(okoPole, `Oko ${fmt(okoMin, 2)} mm je menší než tryska ${fmt(tr, 2)} mm – zateče plastem.`, zm(`Oko ${fmt(nahoru(2 * tr), 1)} mm`, { [okoPole[0]]: +nahoru(2 * tr).toFixed(2) }));
    else if (okoMin < 2 * tr - 1e-9 && ok.typ !== 'tkana') varovani(okoPole, `Oko ${fmt(okoMin, 2)} mm je pod 2 šířky trysky – otvory se často zalijí. Pro jemné oko zvolte tkanou síť nebo vytiskněte kalibrační vzorek.`, zm('Tkaná síť', { 'oko.typ': 'tkana' }));
    if (ok.typ === 'tkana') {
      if (ok.tl / 2 < 2 * vr - 1e-9) varovani(['oko.tl'], `Každá vrstva tkané sítě má ${fmt(ok.tl / 2, 2)} mm – méně než 2 vrstvy tisku (${fmt(vr, 2)} mm). Horní žebra se nepřemostí.`, zm(`Tloušťka ${fmt(4 * vr, 2)} mm`, { 'oko.tl': +(4 * vr).toFixed(2) }));
      if (okoMin > 8) varovani(okoPole, `Horní žebra tkané sítě přemosťují mezery ${fmt(okoMin, 1)} mm – nad 8 mm se mosty prověšují.`);
    } else if (ok.tl < 2 * vr - 1e-9) varovani(['oko.tl'], `Síto ${fmt(ok.tl, 2)} mm je tenčí než 2 vrstvy tisku.`, zm(`Tloušťka ${fmt(3 * vr, 2)} mm`, { 'oko.tl': +(3 * vr).toFixed(2) }));
    const nv = ok.tl / vr;
    if (Math.abs(nv - Math.round(nv)) > 0.05) info(['oko.tl', 'tisk.vrstva'], `Tloušťka síta ${fmt(ok.tl, 2)} mm není násobek vrstvy ${fmt(vr, 2)} mm – slicer ji zaokrouhlí na ${fmt(Math.round(nv) * vr, 2)} mm.`);
    const ne = ok.zebro / (tr * 1.125);
    if (ok.zebro >= 2 * tr && Math.abs(ne - Math.round(ne)) > 0.25) info(['oko.zebro'], `Žebro ${fmt(ok.zebro, 2)} mm ≈ ${fmt(ne, 1)} šířky extruze – celistvý počet drah (${fmt(Math.round(ne) * tr * 1.125, 2)} mm) se tiskne čistěji.`);
    if (p.lem.tl < 2 * tr - 1e-9) varovani(['lem.tl'], `Stěna obruby ${fmt(p.lem.tl, 2)} mm je pod 2 šířky extruze.`, zm(`Stěna ${fmt(nahoru(2 * tr * 1.125), 1)} mm`, { 'lem.tl': +nahoru(2 * tr * 1.125).toFixed(2) }));
    if ((ok.typ === 'sterbiny' || ok.typ === 'radialni') && ok.delka < 2 * okoMin) info(['oko.delka'], 'Štěrbina je kratší než dvojnásobek šířky – chová se spíš jako čtvercové oko.');
    if (ok.typ === 'radialni' && p.druh !== 'kuzel' && p.tvar.typ !== 'kruh') info(['oko.typ'], 'Radiální štěrbiny jsou soustředné kolem středu – na nekruhovém sítu zůstanou rohy s oříznutými štěrbinami.');
    // pole oka
    for (const s of o.sita) {
      if (polomerMin(s.T, s.dPole) < s.a + s.b) { chyba(['lem.okraj', 'lem.tl'], `${s.nazev}: na oko nezbývá místo – obruba a okraj zaberou celou plochu.`, zm('Okraj 1 mm', { 'lem.okraj': 1 })); break; }
      if (s.otvoru > 60000) { chyba(okoPole, `${s.nazev}: ${fmt(s.otvoru, 0)} otvorů je na prohlížeč příliš mnoho (nejvýš 60 000). Zvětšete oko nebo použijte tkanou síť.`, zm('Tkaná síť', { 'oko.typ': 'tkana' })); break; }
    }
    const s0 = o.sita[0];
    if (s0 && s0.Aotvoru / Math.max(1, s0.Avnitr) < 0.2) info(okoPole.concat(['oko.zebro']), `Volná plocha jen ${fmt(100 * s0.Aotvoru / Math.max(1, s0.Avnitr), 0)} % – prosévání půjde pomalu.`);
    // druhy
    if (p.druh === 'sito' || p.druh === 'vez') {
      if (p.lem.vyska < ok.tl + 2) chyba(['lem.vyska'], `Obruba ${fmt(p.lem.vyska)} mm je nižší než síto + 2 mm.`, zm(`Obruba ${fmt(ok.tl + 10)} mm`, { 'lem.vyska': ok.tl + 10 }));
    }
    if (p.druh === 'vez') {
      const v = p.vez;
      if (v.okoDolni > v.okoHorni) chyba(['vez.okoDolni', 'vez.okoHorni'], 'Dolní síto věže má mít menší oko než horní (hrubé nahoře, jemné dole).', zm('Prohodit oka', { 'vez.okoHorni': v.okoDolni, 'vez.okoDolni': v.okoHorni }));
      if (v.nakruzek + o.zkoseni + 3 > p.lem.vyska) chyba(['vez.nakruzek', 'lem.vyska'], `Nákružek ${fmt(v.nakruzek)} mm + zkosení ${fmt(o.zkoseni, 1)} mm se do obruby ${fmt(p.lem.vyska)} mm nevejde.`, zm(`Obruba ${fmt(v.nakruzek + o.zkoseni + 12, 0)} mm`, { 'lem.vyska': Math.ceil(v.nakruzek + o.zkoseni + 12) }));
      if (p.tvar.typ === 'obdelnik' && p.tvar.roh > 0 && p.tvar.roh < rohVezeMin(p)) info(['tvar.roh'], `Rohy věže se zaoblením pod ${fmt(rohVezeMin(p), 1)} mm (2 stěny + vůle) se dělají ostré – jinak by zkosení nákružku v rohu převisalo.`, zm(`Zaoblení ${fmt(Math.ceil(rohVezeMin(p)), 0)} mm`, { 'tvar.roh': Math.ceil(rohVezeMin(p)) }));
      if (p.tvar.typ === 'oval' && Math.min(p.tvar.sirka, p.tvar.delka) ** 2 / Math.max(p.tvar.sirka, p.tvar.delka) / 2 < rohVezeMin(p) + 1) varovani(['tvar.sirka', 'tvar.delka'], 'Ovál věže je tak protáhlý, že se zkosení nákružku na koncích zalomí (převis).');
      if (v.vule < 0.15) info(['vez.vule'], `Vůle nákružku ${fmt(v.vule, 2)} mm – síta půjdou ztuha. Ověřte na tiskárně.`);
      if (p.vyztuha.typ !== 'zadna' && p.vyztuha.vyska > p.lem.vyska - v.nakruzek - ok.tl - 1) varovani(['vyztuha.vyska'], 'Výztužná žebra jsou tak vysoká, že narazí na nákružek síta nad ním.', zm('Nižší žebra', { 'vyztuha.vyska': Math.max(0.5, Math.floor(p.lem.vyska - v.nakruzek - ok.tl - 2)) }));
      if (v.miska && v.miskaVyska < v.nakruzek + 3) chyba(['vez.miskaVyska'], 'Miska musí být vyšší než nákružek síta + 3 mm.', zm('Vyšší miska', { 'vez.miskaVyska': v.nakruzek + 10 }));
    }
    if (p.druh === 'vlozka') {
      if (p.vlozka.vule < 0) info(['vlozka.vule'], 'Záporná vůle = nalisování do otvoru.');
      if (p.vlozka.presah === 0) info(['vlozka.presah'], 'Bez límce drží vložka jen třením – vůli dolaďte kalibrací (nebo přidejte límec).');
    }
    if (p.druh === 'kuzel') {
      const k = o.k;
      if (p.kuzel.typ === 'miska' && p.kuzel.dno > p.kuzel.prumer) chyba(['kuzel.dno'], 'Dno košíku je širší než jeho horní průměr.', zm('Dno = 2/3 průměru', { 'kuzel.dno': Math.round(p.kuzel.prumer * 2 / 3) }));
      if (k.alfa > p.tisk.uhel + 0.01) varovani(p.kuzel.typ === 'miska' ? ['kuzel.dno', 'lem.vyska'] : ['kuzel.uhel'], `Stěna kužele je skloněná ${fmt(k.alfa, 1)}° od svislice – víc než ${fmt(p.tisk.uhel)}°, převis bez podpor nevyjde.`);
      if (k.Rb - p.lem.tl - p.lem.okraj < s0.a + s0.b) chyba(['kuzel.prumer', 'lem.vyska', 'kuzel.uhel'], `Dole má kužel jen Ø ${fmt(2 * k.Rb, 1)} mm – na oko nezbývá místo. Nižší obruba nebo menší úhel.`);
      if (p.kuzel.typ === 'miska') {
        if (ok.velikost > 6) varovani(['oko.velikost'], 'Štěrbiny ve stěně košíku nad 6 mm – špička štěrbiny se hůř přemostí.');
        if (o.sterbinaZ[1] - o.sterbinaZ[0] < 3) info(['lem.vyska'], 'Košík je tak nízký, že na štěrbiny ve stěně nezbylo místo – propouští jen dno.');
      }
    }
    // úchyty
    if (p.uchyty.typ === 'rukojet' && p.druh !== 'sito') info(['uchyty.typ'], 'Rukojeť se dělá jen u plochého síta – zde se nepoužije.');
    if (p.uchyty.typ === 'ucha' && !(p.druh === 'sito' || (p.druh === 'kuzel' && p.kuzel.typ === 'miska'))) info(['uchyty.typ'], 'Ucha se dělají u síta s obrubou a košíku – zde se nepoužijí.');
    if (p.uchyty.typ !== 'zadne' && p.uchyty.otvor > 0 && p.uchyty.otvor > p.uchyty.sirka - 2 * 2) varovani(['uchyty.otvor'], 'Otvor v úchytu je skoro tak široký jako úchyt.', zm('Menší otvor', { 'uchyty.otvor': Math.max(0, Math.floor(p.uchyty.sirka / 2)) }));
    // podložka
    const r = rozmerySestavy(p, o);
    if (Math.max(r.sx, r.sy) > p.tisk.podlozka) varovani(['tisk.podlozka', 'tvar.prumer', 'tvar.sirka', 'tvar.delka'], `Díl ${fmt(r.sx, 0)} × ${fmt(r.sy, 0)} mm se nevejde na podložku ${fmt(p.tisk.podlozka, 0)} mm.`);
    // pevnost
    for (const s of o.sita) {
      const pv = pevnost(p, s);
      if (pv.napeti > pv.dovolene) { varovani(['vyztuha.typ', 'oko.tl', 'oko.zebro', 'vypocet.vrstva'], `${s.nazev}: ${fmt(pv.zatizeni, 1)} kg materiálu napne žebra na ${fmt(pv.napeti, 1)} MPa (dovoleno ${fmt(pv.dovolene, 0)}) – zesilte síto nebo přidejte výztuhy.`, p.vyztuha.typ === 'zadna' ? zm('Výztužný kříž', { 'vyztuha.typ': 'kriz' }) : undefined); break; }
      if (pv.pruhyb > pv.mezPruhybu) { info(['vyztuha.typ', 'oko.tl'], `${s.nazev}: odhadovaný průhyb ${fmt(pv.pruhyb, 1)} mm pod ${fmt(pv.zatizeni, 1)} kg – síto se znatelně prohne.`); break; }
    }
    return H;
  }

  /** Vnější rozměry sestavy (půdorys) – kontrola podložky bez manifoldu. */
  function rozmerySestavy(p, o = odvozene(p)) {
    const T = o.T;
    let ex = 0;
    if (p.druh === 'vlozka' && p.vlozka.presah > 0) ex = p.vlozka.presah;
    let sx = 2 * (T.typ === 'mnohouhelnik' ? T.a : T.a + ex), sy = 2 * (T.typ === 'mnohouhelnik' ? T.a : T.b + ex);
    if (p.druh === 'kuzel') sx = sy = 2 * o.k.Rt;
    const uch = p.uchyty;
    if (uch.typ === 'ucha' && (p.druh === 'sito' || (p.druh === 'kuzel' && p.kuzel.typ === 'miska'))) sx += 2 * uch.delka;
    if (uch.typ === 'rukojet' && p.druh === 'sito') sx += uch.delka + uch.sirka / 2;
    return { sx, sy };
  }

  /* ---------------- výpočty ---------------- */
  const G_ZEM = 9.81, SIGMA = 0.0728, CD = 0.62, NI = 0.35;
  /** Hydraulický průměr otvoru (mm) – pro kapilární práh. */
  function dh(oko, a) { return oko.typ === 'sterbiny' || oko.typ === 'radialni' ? 2 * a * oko.delka / (a + oko.delka) : a; }
  /** Průtok vody gravitací přes volnou plochu A (mm²) při hladině h (mm): výtok otvorem Q = Cd·A·√(2gh), práh povrchového napětí 4σ/d. */
  function prutok(p, s, Aotv) {
    const h = p.vypocet.hladina / 1000, d = dh(p.oko, s.a) / 1000;
    const hMin = 4 * SIGMA / (1000 * G_ZEM * d);   // m
    const Q = CD * (Aotv / 1e6) * Math.sqrt(2 * G_ZEM * h);   // m³/s
    return { lmin: Q * 60000, hMin: hMin * 1000, drzi: h < hMin, dh: d * 1000, naCm2: Aotv > 0 ? Q * 60000 / (Aotv / 100) : 0 };
  }
  /** Co projde okem: podíl zrn menších než oko (log-rovnoměrné rozdělení mezi min a max). */
  function propad(a) {
    return ZRNITOST.map(z => {
      const f = a <= z.min ? 0 : a >= z.max ? 1 : Math.log(a / z.min) / Math.log(z.max / z.min);
      return Object.assign({}, z, { podil: f, stav: f >= 0.999 ? 'projde' : f <= 0.001 ? 'zachytí' : 'částečně' });
    });
  }
  /** Tabulka prostě podepřené obdélníkové desky (Timoshenko, rovnoměrné zatížení): poměr stran → [α průhyb, β napětí]. */
  const TAB_DESKA = [[1, 0.00406, 0.2874], [1.2, 0.00564, 0.3762], [1.4, 0.00705, 0.453], [1.6, 0.0083, 0.5172], [1.8, 0.00931, 0.5688], [2, 0.01013, 0.6102], [3, 0.01223, 0.7134], [4, 0.01282, 0.741], [1e9, 0.01302, 0.75]];
  function tabDeska(pomer) {
    for (let i = 1; i < TAB_DESKA.length; i++) if (pomer <= TAB_DESKA[i][0]) { const [x0, a0, b0] = TAB_DESKA[i - 1], [x1, a1, b1] = TAB_DESKA[i], f = Math.min(1, (pomer - x0) / (x1 - x0)); return [a0 + (a1 - a0) * f, b0 + (b1 - b0) * f]; }
    return TAB_DESKA[TAB_DESKA.length - 1].slice(1);
  }
  /**
   * Pevnost síta zatíženého vrstvou sypkého materiálu (odhad): síto = prostě podepřená deska s tuhostí sníženou
   * podílem žeber η = b/(a+b) (tkaná síť ještě /8 – nese jen půlka tloušťky), výztuhy = nosníky dělící pole.
   * Vrací {zatizeni kg, tlak Pa, pruhyb mm, napeti MPa, dovolene MPa, mezPruhybu, rozpeti, eta}.
   */
  function pevnost(p, s) {
    const m = MATERIALS(p), E = m.E, tm = p.oko.tl, a = s.a, b = s.b;
    const rho = NASYPKY[p.vypocet.material].rho, q = rho * G_ZEM * p.vypocet.vrstva / 1000 / 1e6;   // N/mm²
    const A = s.Avnitr, zatizeni = rho * (A / 1e6) * p.vypocet.vrstva / 1000;
    const eta = (p.oko.typ === 'tkana' ? 1 / 8 : 1) * b / (a + b);
    const D = E * tm ** 3 / (12 * (1 - NI * NI)) * eta;
    const T = s.T, dv = s.dVnitr, vy = p.vyztuha;
    // pole desky
    const kruhovy = T.typ === 'kruh' || T.typ === 'mnohouhelnik';
    const R = Math.sqrt(A / Math.PI);
    let sa, sb, kruh = false;
    if (kruhovy) { sa = sb = 2 * R; kruh = true; } else if (T.typ === 'oval') { const k = Math.sqrt(Math.PI / 4); sa = 2 * (T.a + dv) * k; sb = 2 * (T.b + dv) * k; } else { sa = 2 * (T.a + dv); sb = 2 * (T.b + dv); }
    const vyztuhy = vy.typ !== 'zadna' && p.druh !== 'kuzel';
    if (vyztuhy) {
      if (vy.typ === 'kriz') { sa /= 2; sb /= 2; } else if (vy.typ === 'paprsky') { const r = kruh ? R : Math.max(sa, sb) / 2; sa = r; sb = Math.max(r * 0.3, 2 * r * Math.sin(Math.PI / vy.pocet)); } else { sa = Math.min(sa, vy.roztec); sb = Math.min(sb, vy.roztec); }
      kruh = false;
    }
    let w, sigma;
    if (kruh) { w = (5 + NI) * q * R ** 4 / (64 * D * (1 + NI)); sigma = 3 * (3 + NI) * q * R * R / (8 * tm * tm) / eta; }
    else { const kr = Math.min(sa, sb), dl = Math.max(sa, sb), [al, be] = tabDeska(dl / kr); w = al * q * kr ** 4 / D; sigma = be * q * kr * kr / (tm * tm) / eta; }
    // výztuhy jako prostě podepřené nosníky; polovina zatížení jde přes síto rovnou do obruby, polovina do žeber
    let wN = 0, sigmaN = 0;
    if (vyztuhy) {
      const L = kruhovy ? 2 * R : Math.max(2 * (T.a + dv), 2 * (T.b + dv));
      const delka = vy.typ === 'kriz' ? (kruhovy ? 4 * R : 2 * (T.a + dv) + 2 * (T.b + dv)) : vy.typ === 'paprsky' ? vy.pocet * (kruhovy ? R : L / 2) : A / vy.roztec * 2;
      const qL = 0.5 * q * A / delka, h = tm + vy.vyska, I = vy.sirka * h ** 3 / 12;
      wN = 5 * qL * L ** 4 / (384 * E * I);
      sigmaN = qL * L * L / 8 / (vy.sirka * h * h / 6);
    }
    const rozpeti = kruhovy ? 2 * R : Math.min(2 * (T.a + dv), 2 * (T.b + dv));
    return { zatizeni, tlak: q * 1e6, pruhyb: w + wN, pruhybDesky: w, pruhybZeber: wN, napeti: Math.max(sigma, sigmaN), napetiDesky: sigma, napetiZeber: sigmaN, dovolene: m.pevnost / 3, mezPruhybu: rozpeti / 100, rozpeti, eta };
  }
  const MATERIALS = p => MATERIALY[p.tisk.material];
  /** Souhrn výpočtů pro záložku Výpočty: na každé síto volná plocha, průtok, propad a pevnost. */
  function vypocty(p, model) {
    const o = odvozene(p);
    return o.sita.map((s, i) => {
      const mp = model && model.sita && model.sita[i];
      const Aotv = mp ? mp.otvory : s.Aotvoru, Avn = mp ? mp.vnitrni : s.Avnitr;
      return { s, Aotv, Avn, presne: !!mp, podil: Avn > 0 ? Aotv / Avn : 0, prutok: prutok(p, s, Aotv), propad: propad(s.a), pevnost: pevnost(p, s) };
    });
  }

  /* ---------------- stavba (manifold-3d) ---------------- */
  function postav(w, p, volby = {}) {
    const t0 = Date.now(), o = odvozene(p);
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const T = o.T, t = p.lem.tl, tm = p.oko.tl, komp = p.tisk.kompenzace;
    const poly = (b, pravidlo = 'NonZero') => k(new CS(Array.isArray(b[0][0]) ? b : [b], pravidlo));
    /** Obrys posunutý o d (konvexní, takže body stačí). */
    const O = d => poly(bodyObrysu(T, d));
    const vysun = (cs, za, zb) => k(k(cs.extrude(zb - za)).translate([0, 0, za]));
    /** Pás mezi z0 a z1 s obrysem rostoucím z posunu d0 na d1 (konvexní obal dvou tenkých desek). */
    const zkos = (d0, d1, z0, z1) => k(M.hull([vysun(O(d0), z0, z0 + 0.01), vysun(O(d1), z1 - 0.01, z1)]));
    const sjednot = l => k(M.union(l.filter(Boolean)));
    const R0 = Math.max(T.a, T.b) * 1.05 + 5;

    /** Stopa výztužných žeber (2D) uvnitř obrysu dVnitr. */
    function stopaVyztuh(dVnitr) {
      const v = p.vyztuha, sw = v.sirka, R = R0, pasy = [];
      if (v.typ === 'zadna' || p.druh === 'kuzel') return null;
      const pas = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
      if (v.typ === 'kriz') { pasy.push(pas(-R, -sw / 2, R, sw / 2), pas(-sw / 2, -R, sw / 2, R)); }
      else if (v.typ === 'paprsky') {
        for (let i = 0; i < v.pocet; i++) { const f = 2 * Math.PI * i / v.pocet + Math.PI / 2, c = Math.cos(f), s = Math.sin(f); pasy.push([[-sw * c + sw / 2 * s, -sw * s - sw / 2 * c], [R * c + sw / 2 * s, R * s - sw / 2 * c], [R * c - sw / 2 * s, R * s + sw / 2 * c], [-sw * c - sw / 2 * s, -sw * s + sw / 2 * c]]); }   // proti směru hodin jako kruh (NonZero)
        const n = 24; pasy.push(Array.from({ length: n }, (_, i) => [1.2 * sw * Math.cos(2 * Math.PI * i / n), 1.2 * sw * Math.sin(2 * Math.PI * i / n)]));
      } else {
        for (let c = v.roztec / 2; c < R; c += v.roztec) for (const z of [c, -c]) { pasy.push(pas(-R, z - sw / 2, R, z + sw / 2), pas(z - sw / 2, -R, z + sw / 2, R)); }
      }
      // bez drobných zbytků u okraje (pás těsně u stěny) – jen kusy s plochou aspoň čtverec žebra
      const cs = k(k(poly(pasy)).intersect(O(dVnitr + t / 2)));
      const kusy = cs.decompose().map(k).filter(x => x.area() > sw * sw);
      return kusy.length ? k(CS.union(kusy)) : null;
    }
    /** Pole oka: deska (2D bez otvorů) a otvory; vrací {deska2D | vrstvy, otvory2D, plocha}. */
    function sitoPole(s, deskaD, stopa) {
      const pole = O(s.dPole), a = s.a + komp, b = Math.max(0.2, s.b - komp), R = R0;
      const vz = vzor(p.oko, a, b, R);
      const rot = cs => (p.oko.uhel && p.oko.typ !== 'radialni' ? k(cs.rotate(p.oko.uhel)) : cs);
      const deska = O(deskaD);
      const vystupek = stopa ? k(stopa.offset(Math.min(1, s.b / 2), 'Square')) : null;
      if (vz.vrstvy) {
        const [d, h] = vz.vrstvy.map(pl => k(k(rot(poly(pl)).intersect(k(pole.offset(0.5, 'Square')))).intersect(deska)));
        let otv = k(pole.subtract(k(d.add(h))));
        if (vystupek) otv = k(otv.subtract(vystupek));
        const ram = k(deska.subtract(pole));
        return { vrstvy: [ram, d, h], otvory: otv, plocha: otv.area(), vnitrni: O(s.dVnitr).area(), pole: pole.area() };
      }
      let otv = k(rot(poly(vz.polys)).intersect(pole));
      if (vystupek) otv = k(otv.subtract(vystupek));
      return { deska2D: k(deska.subtract(otv)), otvory: otv, plocha: otv.area(), vnitrni: O(s.dVnitr).area(), pole: pole.area() };
    }
    /** Deska síta jako těleso mezi z0 a z0 + tm (tkaná: rám + dvě vrstvy pásů). */
    function deskaSita(sp, z0) {
      if (sp.vrstvy) {
        const [ram, d, h] = sp.vrstvy;
        return sjednot([vysun(ram, z0, z0 + tm), vysun(d, z0, z0 + tm / 2 + 0.02), vysun(h, z0 + tm / 2 - 0.02, z0 + tm)]);
      }
      return vysun(sp.deska2D, z0, z0 + tm);
    }
    /** Ucha na protilehlých stranách (±X): klín 45° pod uchem, nahoře plocha tl, volitelně svislý otvor. */
    function ucha(xOut, H, dutina) {
      const u = p.uchyty, L = u.delka, tu = u.tl, sw = u.sirka;
      const xIn = xOut - t - Math.min(sw / 2, 0.3 * xOut) - 1;
      const z0 = H - tu - (xOut + L - xIn);
      const pr = z0 >= 0 ? [[xIn, z0], [xOut + L, H - tu], [xOut + L, H], [xIn, H]] : [[xIn, 0], [xIn - z0, 0], [xOut + L, H - tu], [xOut + L, H], [xIn, H]];
      let jedno = k(k(k(k(poly(pr).extrude(sw)).rotate([90, 0, 0])).translate([0, sw / 2, 0])));
      // zaoblené rohy ucha v půdoryse: průnik se zaobleným obdélníkem
      const rr = Math.min(sw / 2, L) * 0.6;
      const pud = k(k(k(CS.square([xOut + L - xIn - 2 * rr, sw - 2 * rr], true)).offset(rr, 'Round', 2, 24)).translate([(xIn + xOut + L) / 2, 0]));
      jedno = k(jedno.intersect(vysun(pud, -1, H + 1)));
      if (u.otvor > 0) jedno = k(jedno.subtract(k(k(M.cylinder(H + 2, u.otvor / 2, u.otvor / 2, Math.max(16, segmenty(u.otvor / 2)))).translate([xOut + L / 2, 0, -1]))));
      const obe = sjednot([jedno, k(jedno.rotate([0, 0, 180]))]);
      return k(obe.subtract(dutina));
    }
    function rukojet(xOut, H, dutina) {
      const u = p.uchyty, L = u.delka, tu = Math.min(u.tl, H), sw = u.sirka;
      const xIn = xOut - t - 1;
      let pud = k(k(CS.square([L + xOut - xIn, sw], true)).translate([(xIn + xOut + L) / 2, 0]));
      pud = k(pud.add(k(k(CS.circle(sw / 2, 48)).translate([xOut + L, 0]))));
      if (u.otvor > 0) pud = k(pud.subtract(k(k(CS.circle(u.otvor / 2, Math.max(16, segmenty(u.otvor / 2)))).translate([xOut + L, 0]))));
      return k(vysun(pud, 0, tu).subtract(dutina));
    }
    /** Síť dílu pro náhled a export. */
    function sit(m0, jmeno, nazev, barva, otocit) {
      const m = k(m0.simplify(1e-4));
      const st = m.status();
      if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
      if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
      const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
      const poz = new Float32Array(vp.length / np * 3);
      for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
      const teles = m.decompose().map(k).filter(x => x.volume() > 1e-3).length;
      return { jmeno, nazev, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), teles, barva, otocit: !!otocit };
    }
    const xMax = d => O(d).bounds().max[0];

    try {
      const dily = [], sita = [];
      let vykres = null;
      const BARVY = ['#4F86D9', '#E88A2E', '#3FA34D', '#B85CC4', '#D9534F', '#3BB3B0'];
      const zapisSito = (sp, s) => { sita.push({ nazev: s.nazev, otvory: sp.plocha, vnitrni: sp.vnitrni, pole: sp.pole, a: s.a }); };
      const vykresSita = (sp, s) => {
        if (vykres) return;
        const otv = sp.otvory.toPolygons();
        vykres = { obrys: O(0).toPolygons(), vnitrni: O(s.dVnitr).toPolygons(), pole: O(s.dPole).toPolygons(), otvory: otv.length <= 6000 ? otv : null, pocet: otv.length };
      };

      if (p.druh === 'sito') {
        const s = o.sita[0], H = p.lem.vyska, stopa = stopaVyztuh(s.dVnitr);
        const sp = sitoPole(s, -t / 2, stopa);
        const casti = [deskaSita(sp, 0), vysun(k(O(0).subtract(O(-t))), 0, H)];
        if (stopa) casti.push(vysun(stopa, tm - 0.02, tm + p.vyztuha.vyska));
        const dutina = vysun(O(-t + 0.01), -1, H + 1);
        if (p.uchyty.typ === 'ucha') casti.push(ucha(xMax(0), H, dutina));
        if (p.uchyty.typ === 'rukojet') casti.push(rukojet(xMax(0), H, dutina));
        dily.push(sit(sjednot(casti), 'sito', 'Síto', BARVY[0]));
        zapisSito(sp, s); vykresSita(sp, s);
      } else if (p.druh === 'vlozka') {
        const s = o.sita[0], v = p.vlozka, stopa = stopaVyztuh(s.dVnitr);
        const sp = sitoPole(s, o.desku, stopa);
        const casti = [deskaSita(sp, 0), vysun(k(O(-v.vule / 2).subtract(O(-v.vule / 2 - t))), -v.hloubka, tm / 2)];
        if (stopa) casti.push(vysun(stopa, -p.vyztuha.vyska, tm / 2));
        dily.push(sit(sjednot(casti), 'mrizka', v.presah > 0 ? 'Mřížka s límcem' : 'Vložka', BARVY[0], true));
        zapisSito(sp, s); vykresSita(sp, s);
      } else if (p.druh === 'kuzel') {
        const s = o.sita[0], kz = o.k, h = kz.h, ta = Math.tan(kz.alfa * RAD), Rb = kz.Rb, Rt = kz.Rb + Math.max(0, h - tm) * ta;
        const n = segmenty(Rt);
        // stěna: svislá patka v tloušťce síta, pak kužel; vnitřek rovnoběžně (vodorovná tloušťka t)
        const prof = [[Rb - t, 0], [Rb, 0], [Rb, tm], [Rt, h], [Rt - t, h], [Rb - t, tm]];
        let stena = k(poly(prof).revolve(n));
        const dutina = k(poly([[0, -1], [Rb - t + 0.01, -1], [Rb - t + 0.01, tm], [Rt - t + 0.01, h], [Rt - t + 0.01 + ta, h + 1], [0, h + 1]]).revolve(n));
        const sp = sitoPole(s, -t / 2, null);
        if (!volby.bezSterbin && p.kuzel.typ === 'miska' && o.sterbinaZ[1] - o.sterbinaZ[0] >= 3 && o.sterbin >= 3) {
          const [z1, z2] = o.sterbinaZ, a = s.a + komp, Lg = (z2 - z1) / Math.cos(kz.alfa * RAD), hrot = a / 2 * Math.tan(60 * RAD);
          const tvarS = poly([[-a / 2, -Lg / 2], [a / 2, -Lg / 2], [a / 2, Lg / 2 - hrot], [0, Lg / 2], [-a / 2, Lg / 2 - hrot]]);
          const hl = t / Math.cos(kz.alfa * RAD) + 2;
          const zakl = k(k(k(k(tvarS.extrude(hl)).translate([0, 0, -hl / 2])).rotate([90, 0, 0])).rotate([0, 0, -90]));
          const zm = (z1 + z2) / 2, rm = Rb + (zm - tm) * ta - t / 2;
          const naklon = k(k(zakl.rotate([0, kz.alfa, 0])).translate([rm, 0, zm]));
          const sterbiny = [];
          for (let i = 0; i < o.sterbin; i++) sterbiny.push(k(naklon.rotate([0, 0, 360 * (i + 0.5) / o.sterbin])));
          stena = k(stena.subtract(sjednot(sterbiny)));
        }
        const casti = [deskaSita(sp, 0), stena];
        if (p.kuzel.typ === 'miska' && p.uchyty.typ === 'ucha') casti.push(ucha(Rt, h, dutina));
        dily.push(sit(sjednot(casti), 'sitko', p.kuzel.typ === 'miska' ? 'Košík' : 'Sítko do kužele', BARVY[0]));
        zapisSito(sp, s); vykresSita(sp, s);
      } else {   // věž
        const v = p.vez, H = p.lem.vyska, nak = v.nakruzek, zk = o.zkoseni, z1 = nak + zk;
        const sitoVeze = (s, i, zb) => {
          const stopa = stopaVyztuh(s.dVnitr);
          const sp = sitoPole(s, -(2 * t + v.vule) + t / 2, stopa);
          const vnejsi = sjednot([vysun(O(-zk), 0, nak + 0.01), zkos(-zk, 0, nak, z1), vysun(O(0), z1 - 0.01, H)]);
          const vnitrni = sjednot([vysun(O(-zk - t), -1, nak + 0.01), zkos(-zk - t, -t, nak, z1), vysun(O(-t), z1 - 0.01, H + 1)]);
          const casti = [k(vnejsi.subtract(vnitrni)), deskaSita(sp, 0)];
          if (stopa) casti.push(vysun(stopa, tm - 0.02, tm + p.vyztuha.vyska));
          const d = sit(k(sjednot(casti).translate([0, 0, zb])), 'sito' + (i + 1), s.nazev, BARVY[i % BARVY.length]);
          zapisSito(sp, s); if (i === 0) vykresSita(sp, s);
          return d;
        };
        let z = 0;
        const sitaV = [];
        if (v.miska) {
          const tb = Math.max(1.6, tm), Hm = v.miskaVyska;
          const miska = k(vysun(O(0), 0, Hm).subtract(vysun(O(-t), tb, Hm + 1)));
          dily.push(sit(miska, 'miska', 'Sběrná miska', '#8A8F98'));
          z = Hm - nak - v.vule;
        }
        for (let i = o.sita.length - 1; i >= 0; i--) { sitaV.unshift(sitoVeze(o.sita[i], i, z)); z += H - nak - v.vule; }
        // pořadí výsledků: horní síto první
        sita.reverse();
        const zTop = z + nak + v.vule;
        dily.push(...sitaV);
        if (v.vicko) {
          const tv = 2.4, hr = Math.max(2, nak - 1);
          const vicko = sjednot([vysun(O(0), zTop, zTop + tv), vysun(k(O(-zk).subtract(O(-zk - t))), zTop - hr, zTop + 0.02)]);
          dily.push(sit(vicko, 'vicko', 'Víko', '#C9A227', true));
        }
      }
      return { dily, sita, vykres, o, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  /* ---------------- kalibrační vzorek ---------------- */
  /** Hodnoty oka a žebra pro dva proužky vzorku (kolem zadaných hodnot). */
  function kalibraceHodnoty(p) {
    const a = p.druh === 'vez' ? p.vez.okoDolni : p.oko.velikost, b = p.oko.zebro, tr = p.tisk.tryska;
    const da = Math.max(0.1, Math.round(a * 2) / 10);
    const oka = [-2, -1, 0, 1, 2].map(i => Math.max(0.3, Math.round((a + i * da) * 10) / 10));
    const zebra = [1.5, 2, 2.5, 3, 4].map(f => Math.round(Math.max(0.3, f * tr) * 100) / 100);
    if (!zebra.some(x => Math.abs(x - b) < 0.01)) { zebra[2] = b; zebra.sort((x, y) => x - y); }
    return { oka, zebra, a, b };
  }
  /** Dva proužky: 5 okének s různým okem (žebro stejné) a 5 s různým žebrem (oko stejné); zářezy na spodní hraně = pořadí. */
  function postavKalibraci(w, p) {
    const { CrossSection: CS, Manifold: M } = w, smaz = [], k = x => { smaz.push(x); return x; };
    const hod = kalibraceHodnoty(p), tm = p.oko.tl, ram = 3, okno = Math.max(12, Math.min(30, 4 * (hod.a + hod.b))), dily = [];
    try {
      const prouzek = (jm, nazev, dvojice, barva) => {
        const n = dvojice.length, W = n * (okno + ram) + ram, Hh = okno + 2 * ram + 3, casti = [];
        const okna = [];
        let deska = k(CS.square([W, Hh]));
        for (let i = 0; i < n; i++) {
          const x0 = ram + i * (okno + ram), y0 = ram + 3;
          okna.push(k(k(CS.square([okno, okno])).translate([x0, y0])));
          for (let j = 0; j <= i; j++) deska = k(deska.subtract(k(k(CS.square([1, 1.6])).translate([x0 + 1 + 2 * j, -0.01]))));
        }
        casti.push(k(k(deska.subtract(k(CS.union(okna)))).extrude(tm)));
        const oko = p.oko.typ === 'radialni' ? Object.assign({}, p.oko, { typ: 'sterbiny' }) : p.oko;
        dvojice.forEach(([a, b], i) => {
          const pole = okna[i], c = [ram + i * (okno + ram) + okno / 2, ram + 3 + okno / 2];
          const vz = vzor(oko, a + p.tisk.kompenzace, Math.max(0.2, b - p.tisk.kompenzace), okno);
          const kus = pl => k(k(k(new CS(pl, 'NonZero')).translate(c)).intersect(k(pole.offset(0.3, 'Square'))));
          if (vz.vrstvy) {
            const [d, h] = vz.vrstvy.map(kus);
            casti.push(k(d.extrude(tm / 2 + 0.02)), k(k(h.extrude(tm / 2 + 0.02)).translate([0, 0, tm / 2 - 0.02])));
          } else casti.push(k(k(k(pole.offset(0.3, 'Square')).subtract(kus(vz.polys))).extrude(tm)));
        });
        const m = k(M.union(casti));
        const st = m.status(); if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
        const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties, poz = new Float32Array(vp.length / np * 3);
        for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i] - W / 2; poz[j + 1] = vp[i + 1] - Hh / 2; poz[j + 2] = vp[i + 2]; }
        dily.push({ jmeno: jm, nazev, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), teles: m.decompose().map(k).filter(x => x.volume() > 1e-3).length, barva, otocit: false, hodnoty: dvojice.map(d => [d[0], d[1]]) });
      };
      prouzek('kal_oko', 'Vzorek – oka', hod.oka.map(a => [a, hod.b]), '#E88A2E');
      prouzek('kal_zebro', 'Vzorek – žebra', hod.zebra.map(b => [hod.a, b]), '#3FA34D');
      return { dily, hod };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  /* ---------------- tisk, kusovník, popis ---------------- */
  function kontrolyModelu(p, tiskDily) {
    const H = [];
    for (const d of tiskDily) {
      const r = G.rozborTisku(d, p.tisk.uhel);
      if (r.previs > 2) H.push({ uroven: 'varovani', pole: ['tisk.uhel'], text: `${d.nazev}: převisy nad ${fmt(p.tisk.uhel)}° od svislice ${fmt(r.previs, 0)} mm² – v této poloze potřebuje podpory.` });
      if (r.most > 0.5) H.push({ uroven: 'info', pole: null, text: p.oko.typ === 'tkana' ? `${d.nazev}: vodorovné mosty ${fmt(r.most, 0)} mm² (horní vrstva tkané sítě) – tiskárna je přemostí.` : `${d.nazev}: vodorovné mosty ${fmt(r.most, 0)} mm² – tiskárna je přemostí.` });
      if (d.teles !== 1) H.push({ uroven: 'chyba', pole: null, text: `${d.nazev}: díl se rozpadá na ${d.teles} kusů.` });
    }
    return H;
  }
  function kusovnik(p, model) {
    const r = [];
    if (!model) return r;
    for (const d of model.dily) r.push([d.nazev, p.tisk.kusu, d.jmeno.startsWith('sito') && p.druh === 'vez' ? `oko ${fmt(model.sita.find(s => s.nazev === d.nazev)?.a ?? 0, 1)} mm` : '']);
    return r;
  }
  function popis(p) {
    const o = odvozene(p), ok = `${NAZVY.oko[p.oko.typ]} ${p.druh === 'vez' ? o.oka.map(a => fmt(a, 1)).join('/') : fmt(p.oko.velikost, 1)} mm`;
    const roz = p.druh === 'kuzel' ? `Ø ${fmt(p.kuzel.prumer)}` : p.tvar.typ === 'kruh' ? `Ø ${fmt(p.tvar.prumer)}` : p.tvar.typ === 'mnohouhelnik' ? `${p.tvar.stran}úhelník ${fmt(p.tvar.prumer)}` : `${fmt(p.tvar.sirka)} × ${fmt(p.tvar.delka)}`;
    return `${NAZVY.druh[p.druh]} ${roz} · ${ok}`;
  }

  const API = {
    MATERIALY, NASYPKY, ZRNITOST, DATUM_ZRNITOSTI, NAZVY, VYCHOZI, MEZE, VYCTY, PREDVOLBY,
    normalizuj, predvolba, tvar, plocha, obvod, bodyObrysu, odvozene, rozmeryKuzelu, okaVeze, podilVzoru, prstenceRadialni, vzor,
    kontroly, rozmerySestavy, prutok, propad, pevnost, vypocty, postav, kalibraceHodnoty, postavKalibraci, kontrolyModelu, kusovnik,
    popis, ulozProjekt, nactiProjekt, kopie, vezmi: G.vezmi, poloz: G.poloz, fmt, segmenty,
  };
  if (uzel) module.exports = API; else window.SITA = API;
})();

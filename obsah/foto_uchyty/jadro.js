/* Foto a kamerové úchyty – jádro generátoru (bez DOM a bez three.js, spustitelné v node).
   Uživatel skládá ŘETĚZ článků: základna (objímka, deska na přísavku, magnetická patka, klip na popruh) →
   ramena / adaptéry / klouby (kulový s upínací objímkou, otočný s aretací zuby) → koncovka (držák telefonu)
   nebo volné rozhraní, na které se připojí zařízení (kamera – netiskne se, jen hmotnost a obrys).
   Každý článek má rozhraní A (dole, k předchozímu) a B (výstup). Rozhraní:
     p2 / p3 … prsty akčních kamer 2 / 3 prsty, šroub M5 (rozměry typické, kompatibilní s GoPro – ověřit měřením)
     s14 / m14 … šroub / matice 1/4"-20 UNC (stativový závit), s38 / m38 … 3/8"-16 UNC
     pn / pz … studená patka: nožka (do sáněk kamery) / sáňky (pro příslušenství s nožkou)
   Spoj B → A musí být dvojice (p2–p3, s–m, pn–pz); kontroly to hlídají.

   Souřadnice ROZHRANÍ („rámec čela“): počátek ve středu čela, +Z ven z dílu, tělo dílu je v z < 0.
     Prsty: plátky kolmé na X, rostou do +Z, otvor M5 v ose X ve výšce h (= bod spoje, osa kloubu X).
     Závit: osa Z, šroub roste do +Z od čela, otvor matice jde do −Z. Patka: nožka roste do +Z, sáňky jsou zapuštěné.
   Spoj: rámec spoje B předchozího článku (posunutý o bod spoje) · natočení kloubu · otočení o 180° kolem X
   = rámec spoje A dalšího článku. Matice 4×4 po sloupcích (jako three.js i manifold.transform).
   Tisková poloha se volí automaticky ze 6 os (+X … −Z): nejméně převisů + pevnost (prsty mají ležet
   ve vrstvách – osa šroubu i směr prstu vodorovně, tištěný závit svisle). */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const ZG = uzel ? require('../ibc/geometrie.js') : window.IBC_GEOM;   // zavitovaTyc (šroubovice závitu)
  const fmt = G.fmt, kopie = G.kopie;
  const rad = s => s * Math.PI / 180, deg = r => r * 180 / Math.PI;

  /* ---------------- tabulky (typické hodnoty 11/2026 – ověřit měřením) ---------------- */
  /** sigma = pevnost v tahu podél vrstev (MPa), napříč vrstvami ≈ polovina; mu = tření plast–plast. */
  const MATERIALY = {
    PETG: { nazev: 'PETG', hustota: 1.27, sigma: 45, mu: 0.3 },
    ASA: { nazev: 'ASA', hustota: 1.07, sigma: 40, mu: 0.3 },
    PA: { nazev: 'PA (nylon)', hustota: 1.14, sigma: 55, mu: 0.25 },
    PLA: { nazev: 'PLA', hustota: 1.24, sigma: 50, mu: 0.3 },
    ABS: { nazev: 'ABS', hustota: 1.04, sigma: 35, mu: 0.3 },
    PC: { nazev: 'PC (polykarbonát)', hustota: 1.2, sigma: 60, mu: 0.3 },
  };
  const NAPRIC_VRSTVAMI = 0.5;
  /** Závity UNC (palcové stativové): d = jmenovitý průměr, p = stoupání; matice = otvor na klíč a výška (typické). */
  const ZAVITY = {
    '14': { nazev: '1/4″-20 UNC', d: 6.35, p: 25.4 / 20, maticeS: 11.11, maticeV: 5.56 },
    '38': { nazev: '3/8″-16 UNC', d: 9.525, p: 25.4 / 16, maticeS: 14.29, maticeV: 8.33 },
  };
  const M5 = { d: 5, otvor: 5.5, maticeS: 8, maticeV: 4, hlava: 8.5 };
  const ROZHRANI = {
    zadne: { nazev: '— nic —', kratce: 'nic' },
    p2: { nazev: '2 prsty (akční kamera)', kratce: '2 prsty' },
    p3: { nazev: '3 prsty (akční kamera)', kratce: '3 prsty' },
    s14: { nazev: 'šroub 1/4″-20', kratce: 'šroub 1/4″' },
    m14: { nazev: 'matice 1/4″-20', kratce: 'matice 1/4″' },
    s38: { nazev: 'šroub 3/8″-16', kratce: 'šroub 3/8″' },
    m38: { nazev: 'matice 3/8″-16', kratce: 'matice 3/8″' },
    pn: { nazev: 'studená patka – nožka', kratce: 'nožka patky' },
    pz: { nazev: 'studená patka – sáňky', kratce: 'sáňky patky' },
    kv: { nazev: 'kostky (kompatibilní s LEGO®) – výstupky', kratce: 'výstupky kostek' },
    kd: { nazev: 'kostky (kompatibilní s LEGO®) – spodek', kratce: 'spodek kostek' },
  };
  const PROTI = { p2: 'p3', p3: 'p2', s14: 'm14', m14: 's14', s38: 'm38', m38: 's38', pn: 'pz', pz: 'pn', kv: 'kd', kd: 'kv' };
  const VSE = ['p2', 'p3', 's14', 'm14', 's38', 'm38', 'pn', 'pz', 'kv', 'kd'];
  const OTOC = [0, 90];
  /** Druhy článků: par = {klíč: [výchozí, min, max, celé?]} (otocB = natočení výstupu 0/90°). */
  const DRUHY = {
    objimka: { nazev: 'Objímka na trubku / řídítka', zaklad: true, a: ['zadne'], b: VSE, b0: 'p3',
      par: { D: [25.4, 8, 80], sirka: [16, 8, 60], stena: [4, 2.4, 12], vlozka: [0, 0, 3], otocB: [90] } },
    prisavka: { nazev: 'Deska na přísavku', zaklad: true, a: ['zadne'], b: VSE, b0: 's14',
      par: { deska: [40, 20, 120], hlava: [10, 4, 30], krcek: [5, 2, 20], vyskaHlavy: [3, 1, 10], vyskaKrcku: [2.5, 0.8, 10], otocB: [0] } },
    magnet: { nazev: 'Magnetická patka', zaklad: true, a: ['zadne'], b: VSE, b0: 's14',
      par: { deska: [40, 15, 120], magnet: [12, 3, 50], vyska: [3, 1, 15], pocet: [3, 1, 8, 1], sila: [25, 0, 1000], otocB: [0] } },
    deska: { nazev: 'Nástěnná deska', zaklad: true, a: ['zadne'], b: VSE, b0: 'kv',
      par: { sirka: [40, 16, 200], delka: [56, 16, 200], tloustka: [4, 2.4, 12], otvoru: [2, 0, 4, 1], vrut: [4, 2.5, 6], otocB: [0] } },
    popruh: { nazev: 'Klip na popruh / batoh', zaklad: true, a: ['zadne'], b: VSE, b0: 'p3',
      par: { sirka: [25, 10, 60], tloustka: [2.5, 1, 8], otocB: [0] } },
    rameno: { nazev: 'Rameno', a: VSE, b: VSE, a0: 'p2', b0: 'p3',
      par: { delka: [40, 0, 300], ohyb: [0, 0, 135], delka2: [30, 0, 300], otocB: [0] } },
    adapter: { nazev: 'Adaptér mezi systémy', a: VSE, b: VSE, a0: 'p2', b0: 's14',
      par: { delka: [0, 0, 100], otocB: [0] } },
    koule: { nazev: 'Kulový kloub', dva: true, a: VSE, b: VSE, a0: 'm14', b0: 's14',
      par: { koule: [20, 10, 50], vule: [0.15, -0.3, 0.8], presah: [0.6, 0.2, 3], krk: [6, 2, 40], sklon: [0, -90, 90], natoceni: [0, -180, 180], otocB: [0] } },
    otocny: { nazev: 'Otočný kloub s aretací', dva: true, a: VSE, b: VSE, a0: 'm14', b0: 'p3',
      par: { prumer: [34, 22, 80], zubu: [24, 8, 72, 1], natoceni: [0, -180, 180], otocB: [0] } },
    telefon: { nazev: 'Držák telefonu', koncovka: true, a: VSE, b: ['zadne'], a0: 'p2',
      par: { sirka: [75, 40, 110], tloustka: [9, 5, 20], vyska: [50, 25, 120], vule: [0.6, 0, 3] } },
    zarizeni: { nazev: 'Zařízení (netiskne se)', koncovka: true, netisk: true, a: ['p2', 'p3', 'm14', 'm38', 'pn', 'pz', 'kd'], b: ['zadne'], a0: 'p2',
      par: { hmotnost: [120, 0, 5000], sirka: [62, 10, 300], hloubka: [33, 10, 300], vyska: [44, 10, 300] } },
  };
  for (const d of Object.values(DRUHY)) { d.a0 = d.a0 || d.a[0]; d.b0 = d.b0 || d.b[0]; d.par.uhel = [0, -180, 180]; }

  const VYCHOZI = {
    verze: 1, nazev: 'Úchyt kamery na řídítka',
    diry: 'kapka',   // vodorovné díry M5: 'kapka' = osmiboké (tisk bez podpor v každé poloze) | 'kruh'
    clanky: [],
    prsty: { tl: 3, vule: 0.3, R: 7.5, h: 9.5, dira: 5.3, matice: true },
    zavit: { vule: 0.15, kov: false, delka14: 5.5, delka38: 7 },
    patka: { sirka: 18, delka: 18, tl: 2, krk: 2, krkSirka: 12, vule: 0.2 },
    // stavebnicové kostky (kompatibilní s LEGO®): typické rozměry – ověřit měřením; vůle na průměr (+ = těsnější)
    kostky: { nx: 2, ny: 2, roztec: 8, vystupek: 4.8, vyskaVyst: 1.7, vuleVyst: 0, trubicka: 6.51, vuleTrub: 0, stena: 1.5, sila: 1.5, technic: 'ne' },
    sestava: { naklon: 0, otoc: 0 },
    mech: { utahM5: 0.6, utahZavit: 0.4, dyn: 1.5 },
    tisk: { material: 'PETG', vrstva: 0.2, uhel: 45, krokKalibrace: 0.1, kalibrace: false, sad: 1 },
  };
  const MEZE = {
    'prsty.tl': [2, 5], 'prsty.vule': [-0.3, 1.5], 'prsty.R': [5, 12], 'prsty.h': [6, 20], 'prsty.dira': [4.5, 7],
    'zavit.vule': [-0.2, 0.8], 'zavit.delka14': [3, 15], 'zavit.delka38': [4, 20],
    'patka.sirka': [12, 30], 'patka.delka': [10, 30], 'patka.tl': [1, 4], 'patka.krk': [1, 6], 'patka.krkSirka': [6, 20], 'patka.vule': [0, 1],
    'kostky.nx': [1, 8, 1], 'kostky.ny': [1, 8, 1], 'kostky.roztec': [7.5, 8.5], 'kostky.vystupek': [4, 5.6], 'kostky.vyskaVyst': [1, 2.5],
    'kostky.vuleVyst': [-0.4, 0.4], 'kostky.trubicka': [5.8, 7.2], 'kostky.vuleTrub': [-0.4, 0.4], 'kostky.stena': [0.8, 2.5], 'kostky.sila': [0, 20],
    'sestava.naklon': [-180, 180], 'sestava.otoc': [-180, 180],
    'mech.utahM5': [0, 5], 'mech.utahZavit': [0, 5], 'mech.dyn': [1, 10],
    'tisk.vrstva': [0.05, 0.5], 'tisk.uhel': [20, 75], 'tisk.krokKalibrace': [0.02, 0.3], 'tisk.sad': [1, 10, 1],
  };
  const VYCTY = { 'tisk.material': Object.keys(MATERIALY), diry: ['kapka', 'kruh'], 'kostky.technic': ['ne', 'kulaty', 'kriz'] };
  const MAX_CLANKU = 12;

  const cl = (druh, x) => Object.assign({ druh, a: DRUHY[druh].a0, b: DRUHY[druh].b0 }, x || {});
  const PREDVOLBY = [
    { id: 'kolo', nazev: 'Akční kamera na řídítka', popis: 'objímka Ø 25,4 → rameno s prsty → kamera 120 g',
      p: { nazev: 'Akční kamera na řídítka', clanky: [cl('objimka', { D: 25.4 }), cl('rameno', { delka: 30, uhel: -20 }), cl('zarizeni', { uhel: 20 })] } },
    { id: 'telefon', nazev: 'Telefon na řídítka', popis: 'objímka Ø 31,8 → prsty → držák telefonu 75 mm',
      p: { nazev: 'Telefon na řídítka', clanky: [cl('objimka', { D: 31.8 }), cl('telefon', { uhel: -15 })] } },
    { id: 'koule', nazev: 'Kulová hlava na stativ', popis: 'matice 1/4″ na stativ → koule → šroub 1/4″ do fotoaparátu 600 g',
      p: { nazev: 'Kulová hlava', clanky: [cl('koule', { a: 'm14', b: 's14', koule: 24, sklon: 30 }), cl('zarizeni', { a: 'm14', hmotnost: 600, sirka: 125, hloubka: 75, vyska: 95 })] } },
    { id: 'prisavka', nazev: 'Přísavka na sklo + akční kamera', popis: 'deska na kupovanou přísavku → otočný kloub → lomené rameno s prsty',
      p: { nazev: 'Kamera na přísavce', sestava: { naklon: 90 }, clanky: [cl('prisavka', { b: 's14' }), cl('otocny', { a: 'm14', b: 's14', natoceni: 30 }), cl('rameno', { a: 'm14', b: 'p3', delka: 14, ohyb: 90, delka2: 14, otocB: 90 }), cl('zarizeni', { uhel: 0 })] } },
    { id: 'magnet', nazev: 'Magnetická patka s otočným kloubem', popis: '3 magnety Ø 12 → otočný kloub → lomené rameno → kamera',
      p: { nazev: 'Magnetická patka', clanky: [cl('magnet', { b: 's14' }), cl('otocny', { a: 'm14', b: 's14' }), cl('rameno', { a: 'm14', b: 'p3', delka: 14, ohyb: 90, delka2: 14, otocB: 90 }), cl('zarizeni', { uhel: -30 })] } },
    { id: 'popruh', nazev: 'Kamera na popruh batohu', popis: 'tunel na popruh 25 mm → lomené rameno → kamera',
      p: { nazev: 'Kamera na popruh', sestava: { naklon: 90 }, clanky: [cl('popruh', { b: 'p3' }), cl('rameno', { delka: 18, ohyb: 60, delka2: 20 }), cl('zarizeni', { uhel: 0 })] } },
    { id: 'patka', nazev: 'Světlo do studené patky', popis: 'nožka do patky fotoaparátu → šroub 1/4″ pro světlo nebo mikrofon',
      p: { nazev: 'Adaptér patka – 1/4″', clanky: [cl('adapter', { a: 'pn', b: 's14' }), cl('zarizeni', { a: 'm14', hmotnost: 150, sirka: 70, hloubka: 25, vyska: 60 })] } },
    { id: 'adapter', nazev: 'Adaptér prsty → 1/4″', popis: 'kupovaný držák akční kamery → šroub 1/4″ pro fotoaparát nebo světlo',
      p: { nazev: 'Adaptér prsty – 1/4″', clanky: [cl('adapter', { a: 'p2', b: 's14' }), cl('zarizeni', { a: 'm14', hmotnost: 200, sirka: 70, hloubka: 40, vyska: 60 })] } },
    { id: 'kostky', nazev: 'Akční kamera na kostky', popis: 'spodek 4 × 4 nasazený na kostky (kompatibilní s LEGO®) → lomené rameno → prsty → kamera',
      p: { nazev: 'Akční kamera na kostky', kostky: { nx: 4, ny: 4 }, clanky: [cl('rameno', { a: 'kd', b: 'p3', delka: 9, ohyb: 90, delka2: 10, otocB: 90 }), cl('zarizeni', { uhel: 0 })] } },
    { id: 'kostkyStativ', nazev: 'Kostky → stativ 1/4″', popis: 'matice 1/4″ na stativ → deska s výstupky 2 × 4 pro stavbu z kostek (kompatibilní s LEGO®)',
      p: { nazev: 'Kostky na stativ', kostky: { nx: 2, ny: 4 }, clanky: [cl('adapter', { a: 'm14', b: 'kv' }), cl('zarizeni', { a: 'kd', hmotnost: 80, sirka: 40, hloubka: 56, vyska: 30 })] } },
  ];

  /* ---------------- normalizace ---------------- */
  function normalizujClanek(x, i, hl) {
    const v = x && typeof x === 'object' ? x : {};
    let druh = v.druh;
    if (!DRUHY[druh]) { if (druh !== undefined) hl.push(`clanky.${i}.druh: neznámý druh „${druh}“ → rameno`); druh = 'rameno'; }
    const D = DRUHY[druh], c = { druh };
    c.a = D.a.includes(v.a) ? v.a : D.a0;
    if (v.a !== undefined && c.a !== v.a) hl.push(`clanky.${i}.a: „${v.a}“ nejde u druhu ${D.nazev} → ${c.a}`);
    c.b = D.b.includes(v.b) ? v.b : D.b0;
    if (v.b !== undefined && c.b !== v.b) hl.push(`clanky.${i}.b: „${v.b}“ nejde u druhu ${D.nazev} → ${c.b}`);
    for (const [kl, m] of Object.entries(D.par)) {
      if (kl === 'otocB') {
        const h = G.ctiCislo(v.otocB);
        c.otocB = Number.isFinite(h) ? (OTOC.includes(h) ? h : (hl.push(`clanky.${i}.otocB: ${h} → 0/90`), Math.abs(((h % 180) + 180) % 180 - 90) < 45 ? 90 : 0)) : m[0];
        continue;
      }
      let h = v[kl] === undefined || v[kl] === null ? m[0] : G.ctiCislo(v[kl]);
      if (!Number.isFinite(h)) { hl.push(`clanky.${i}.${kl}: neplatné číslo → ${fmt(m[0], 2)}`); h = m[0]; }
      if (m[3]) h = Math.round(h);
      if (h < m[1] || h > m[2]) { const y = Math.min(m[2], Math.max(m[1], h)); hl.push(`clanky.${i}.${kl}: ${fmt(h, 2)} mimo rozsah → ${fmt(y, 2)}`); h = y; }
      c[kl] = h;
    }
    return c;
  }
  function normalizuj(v) {
    const r = G.normalizuj(v, { VYCHOZI, MEZE, VYCTY });
    const src = v && Array.isArray(v.clanky) ? v.clanky : null;
    const hl = r.hlaseni;
    if (!src || !src.length) { r.p.clanky = kopie(PREDVOLBY[0].p.clanky).map((x, i) => normalizujClanek(x, i, [])); if (src) hl.push('clanky: prázdný řetěz → výchozí'); }
    else {
      if (src.length > MAX_CLANKU) hl.push(`clanky: nejvýš ${MAX_CLANKU} článků`);
      r.p.clanky = src.slice(0, MAX_CLANKU).map((x, i) => normalizujClanek(x, i, hl));
    }
    return r;
  }
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id) || PREDVOLBY[0];
    return normalizuj(G.slij(kopie(VYCHOZI), kopie(pv.p))).p;
  }
  /** Nový článek daného druhu, napojený na výstup předchozího (rozhraní A = protikus). */
  function novyClanek(druh, pred) {
    const D = DRUHY[druh], c = normalizujClanek({ druh }, 0, []);
    if (pred && pred.b !== 'zadne' && D.a.includes(PROTI[pred.b])) c.a = PROTI[pred.b];
    return c;
  }

  /* ---------------- matice 4×4 po sloupcích ---------------- */
  const I4 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  function mul(A, B) {
    const C = new Array(16);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) C[4 * j + i] = A[i] * B[4 * j] + A[4 + i] * B[4 * j + 1] + A[8 + i] * B[4 * j + 2] + A[12 + i] * B[4 * j + 3];
    return C;
  }
  const M = (...a) => a.reduce((x, y) => mul(x, y));
  const Tr = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
  const RX = u => { const c = Math.cos(rad(u)), s = Math.sin(rad(u)); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; };
  const RY = u => { const c = Math.cos(rad(u)), s = Math.sin(rad(u)); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; };
  const RZ = u => { const c = Math.cos(rad(u)), s = Math.sin(rad(u)); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; };
  /** Inverze tuhé transformace. */
  function inv(A) {
    const R = [A[0], A[4], A[8], 0, A[1], A[5], A[9], 0, A[2], A[6], A[10], 0, 0, 0, 0, 1];
    const t = [A[12], A[13], A[14]];
    R[12] = -(R[0] * t[0] + R[4] * t[1] + R[8] * t[2]); R[13] = -(R[1] * t[0] + R[5] * t[1] + R[9] * t[2]); R[14] = -(R[2] * t[0] + R[6] * t[1] + R[10] * t[2]);
    return R;
  }
  const bod = (A, p) => [A[0] * p[0] + A[4] * p[1] + A[8] * p[2] + A[12], A[1] * p[0] + A[5] * p[1] + A[9] * p[2] + A[13], A[2] * p[0] + A[6] * p[1] + A[10] * p[2] + A[14]];
  const smer = (A, v) => [A[0] * v[0] + A[4] * v[1] + A[8] * v[2], A[1] * v[0] + A[5] * v[1] + A[9] * v[2], A[2] * v[0] + A[6] * v[1] + A[10] * v[2]];
  function presunPoz(poz, A) {
    const out = new Float32Array(poz.length);
    for (let i = 0; i < poz.length; i += 3) {
      const x = poz[i], y = poz[i + 1], z = poz[i + 2];
      out[i] = A[0] * x + A[4] * y + A[8] * z + A[12]; out[i + 1] = A[1] * x + A[5] * y + A[9] * z + A[13]; out[i + 2] = A[2] * x + A[6] * y + A[10] * z + A[14];
    }
    return out;
  }
  const PREKLOP = RX(180);

  /* ---------------- odvozené rozměry rozhraní (bez manifoldu) ---------------- */
  const jeKostka = t => t === 'kv' || t === 'kd';
  /** Natočení spoje kostek zapadne po 90° (čtvercová mřížka) nebo po 180°. */
  const uhelKostek = (p, u) => { const k = p.kostky.nx === p.kostky.ny ? 90 : 180; return ((Math.round(u / k) * k) % 360 + 360) % 360; };
  const zavitTyp = t => (t === 's14' || t === 'm14' ? '14' : t === 's38' || t === 'm38' ? '38' : null);
  /** Rozměry rozhraní: stopa (obdélník x0..y1 v rámci čela), hloubka do těla, bod spoje (z), osa kloubu. */
  function rozmeryRozhrani(typ, p) {
    const q = p.prsty, t = q.tl, g = t + q.vule;
    if (typ === 'p2' || typ === 'p3') {
      const st = typ === 'p3' ? [-(t + g), 0, t + g] : [-(t + g) / 2, (t + g) / 2];
      const x1 = st[st.length - 1] + t / 2 + (typ === 'p3' && q.matice ? 3.5 : 0);
      return { typ, stredy: st, x0: st[0] - t / 2, x1, y0: -q.R, y1: q.R, hloubka: 0.6, mate: q.h, osa: 'x', vyska: q.h + q.R, prsty: true };
    }
    const zt = zavitTyp(typ);
    if (zt) {
      const z = ZAVITY[zt], muz = typ[0] === 's', kov = p.zavit.kov, L = zt === '14' ? p.zavit.delka14 : p.zavit.delka38;
      const rb = kov ? z.maticeS / Math.sqrt(3) + 2.2 : z.d / 2 + 3.2;
      const hl = kov ? (muz ? z.maticeV + 4.5 : Math.max(L + 1, z.maticeV + 1.5) + 0.8) : (muz ? 0.6 : L + 2.6);
      return { typ, zavit: z, zt, muz, kov, L, x0: -rb, x1: rb, y0: -rb, y1: rb, kruh: rb, hloubka: hl, mate: 0, osa: 'z', vyska: muz ? L : 0 };
    }
    if (typ === 'pn' || typ === 'pz') {
      const a = p.patka;
      if (typ === 'pn') return { typ, x0: -a.sirka / 2 - 1, x1: a.sirka / 2 + 1, y0: -a.delka / 2, y1: a.delka / 2, hloubka: 0.6, mate: 0, osa: null, vyska: a.krk + a.tl };
      const s = a.sirka / 2 + a.vule + 2.5, hl = a.krk + a.tl + a.vule + 2;
      return { typ, x0: -s, x1: s, y0: -a.delka / 2 - a.vule - 2.5, y1: a.delka / 2, hloubka: hl, mate: 0, osa: null, vyska: 0 };
    }
    if (typ === 'kv' || typ === 'kd') {
      const m = mrizkaKostek(p);
      return { typ, kostky: m, x0: -m.W / 2, x1: m.W / 2, y0: -m.L / 2, y1: m.L / 2, hloubka: typ === 'kv' ? m.Hd : m.H, mate: 0, osa: 'z', vyska: typ === 'kv' ? m.hv : 0 };
    }
    return { typ: 'zadne', x0: 0, x1: 0, y0: 0, y1: 0, hloubka: 0, mate: 0, osa: null, vyska: 0 };
  }
  /** Rozměry kostek (kompatibilní s LEGO®): výstupky na mřížce nx × ny, pod nimi dutina s trubičkami (2 × N a víc)
      nebo kolíky (1 × N), volitelně otvory Technic napříč (osa Y) mezi výstupky. Vůle na průměr: + = těsnější. */
  function mrizkaKostek(p) {
    const k = p.kostky, r = k.roztec, nx = k.nx, ny = k.ny;
    const os = n => Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * r);
    const vyst = [];
    for (const x of os(nx)) for (const y of os(ny)) vyst.push([x, y]);
    const dvojrada = nx >= 2 && ny >= 2, trub = [];
    if (dvojrada) { for (const x of os(nx - 1)) for (const y of os(ny - 1)) trub.push([x, y]); }
    else if (nx * ny > 1) { const n = Math.max(nx, ny); for (const t of os(n - 1)) trub.push(nx >= ny ? [t, 0] : [0, t]); }
    const hc = k.vyskaVyst + 0.3;
    const technic = k.technic !== 'ne';
    return {
      nx, ny, r, W: nx * r - 0.2, L: ny * r - 0.2, vyst, trub, dvojrada, hc, hv: k.vyskaVyst,
      dV: k.vystupek + k.vuleVyst, dT: (dvojrada ? k.trubicka : 3.2) + k.vuleTrub, dTi: dvojrada ? k.vystupek : 0,
      H: technic ? 9.6 : Math.max(3.2, hc + 1.2), Hd: 2, technic: k.technic, zT: 5.8, dTech: 4.8 + 0.2,
      technicX: nx >= 2 ? os(nx - 1) : [0],
    };
  }
  /** Mezní natočení kloubu prstů (°): prsty se otáčejí kolem šroubu, dokud konec jednoho nenarazí do čela druhého.
      Konec prstu sahá od osy nejvýš Rmax = 1,082 R (sražení 45° pro tisk), stopka má půlšířku R a délku h. */
  function mezPrstu(p) {
    const R = p.prsty.R, h = p.prsty.h, Rmax = 1.0824 * R;
    for (let u = 0; u <= 180; u += 0.5) {
      const psi = rad(180 - u);
      const dosah = Math.max(Rmax, h * Math.cos(psi) + R * Math.sin(psi));
      if (dosah > h - 0.3) return Math.max(0, u - 0.5);
    }
    return 180;
  }

  /* ---------------- rozměry článků (bez manifoldu) ---------------- */
  /** Odvozené rozměry článku i rámce čel A a B (v rámci článku) – sdílí je stavba, kontroly i mechanika. */
  function odvozClanek(c, p) {
    const A = rozmeryRozhrani(c.a, p), B = rozmeryRozhrani(c.b, p), o = { A, B, druh: c.druh };
    o.FaCelo = c.a === 'zadne' ? null : PREKLOP;
    const otB = RZ(c.otocB || 0);
    if (c.druh === 'rameno' || c.druh === 'adapter') {
      o.Lmin = Math.max(2, A.hloubka + B.hloubka + 1.5);
      o.L1 = c.delka > 0 ? c.delka : o.Lmin;
      o.auto = !(c.delka > 0);
      o.ohyb = c.druh === 'rameno' ? c.ohyb : 0;
      o.L2 = o.ohyb > 0 ? c.delka2 : 0;
      o.FbCelo = M(Tr(0, 0, o.L1), RY(o.ohyb), Tr(0, 0, o.L2), otB);
      o.delkaCelkem = o.L1 + o.L2;
    } else if (c.druh === 'objimka') {
      o.Rt = c.D / 2 + c.vlozka; o.Ro = o.Rt + c.stena;
      o.ucho = { tl: 5.5, v: 2 * (M5.otvor / 2 + 2.6), sterbina: 2 };
      o.FbCelo = M(Tr(0, 0, o.Ro + 1), otB);
    } else if (c.druh === 'prisavka') {
      o.kh = c.vyskaKrcku + 0.2; o.hh = c.vyskaHlavy + 0.4; o.T = o.kh + o.hh + 1.6;
      o.rh = c.hlava / 2 + 0.3; o.e = c.hlava; o.Rp = c.deska / 2;
      o.FbCelo = M(Tr(0, 0, o.T + 0.6), otB);
    } else if (c.druh === 'magnet') {
      o.Rp = c.deska / 2; o.mh = c.vyska + 0.2; o.T = o.mh + 1.2; o.mr = c.magnet / 2 + 0.1;
      o.rKruh = c.pocet === 1 ? 0 : Math.max(0, o.Rp - o.mr - 2);
      o.FbCelo = M(Tr(0, 0, o.T + 0.6), otB);
    } else if (c.druh === 'deska') {
      o.T = c.tloustka;
      o.FbCelo = M(Tr(0, 0, o.T), otB);
      // díry pro vruty se zápustnou hlavou: podél delší strany, mimo stopu rozhraní B
      const kraj = Math.max(4, c.vrut * 1.3), x2 = c.sirka / 2 - kraj, y2 = c.delka / 2 - kraj;
      o.diry = c.otvoru === 0 ? [] : c.otvoru === 1 ? [[0, y2]] : c.otvoru === 2 ? (c.delka >= c.sirka ? [[0, -y2], [0, y2]] : [[-x2, 0], [x2, 0]])
        : c.otvoru === 3 ? [[-x2, -y2], [x2, -y2], [0, y2]] : [[-x2, -y2], [x2, -y2], [-x2, y2], [x2, y2]];
      o.hlavaVrutu = 2 * c.vrut;
    } else if (c.druh === 'popruh') {
      o.tun = { w: c.sirka + 1, h: c.tloustka + 0.6 }; o.st = 2.2;
      o.W = o.tun.w + 2 * 3; o.Lp = Math.max(24, B.y1 - B.y0 + 4, B.x1 - B.x0 + 4); o.T = o.st + o.tun.h + 2.6;
      o.FbCelo = M(Tr(0, 0, o.T), otB);
    } else if (c.druh === 'koule') {
      o.Rk = c.koule / 2; o.Rs = o.Rk + c.vule; o.stena = Math.max(2.6, c.koule * 0.14); o.Ro = o.Rs + o.stena;
      o.rl = o.Rk - c.presah; o.zl = o.rl < o.Rs ? Math.sqrt(o.Rs * o.Rs - o.rl * o.rl) : 0;
      o.rn = Math.max(2.5, Math.min(o.Rk * 0.5, o.rl - 1.6));
      o.zS = A.hloubka + o.Rs + 1.8;
      o.alfa = deg(Math.atan2(o.rl, o.zl)) - deg(Math.asin(Math.min(1, (o.rn + 0.2) / o.Rs)));
      const rho = Math.hypot(Math.max(-B.x0, B.x1), Math.max(-B.y0, B.y1));
      const a = rad(Math.max(0, o.alfa));
      o.Lk = Math.max(c.krk + o.zl + 0.6, (o.zl + 1.6 + rho * Math.sin(a)) / Math.max(0.2, Math.cos(a)));
      o.ucho = { tl: 4.5, w: 2 * (M5.otvor / 2 + 2.4) + 1, sterbina: 1.2 };
      o.a45 = o.Rk * Math.SQRT1_2;
      o.Jk = M(Tr(0, 0, o.zS), RZ(c.natoceni), RX(c.sklon));      // koule v rámci článku
      o.FbCelo = M(o.Jk, Tr(0, 0, o.Lk), otB);
    } else if (c.druh === 'otocny') {
      o.Rd = c.prumer / 2; o.n = c.zubu; o.krok = 360 / c.zubu;
      o.hz = 1.06 * Math.PI * o.Rd / c.zubu; o.vz = 0.15;   // boky zubů ≥ 45° i na vnějším okraji (vršek se tiskne zuby dolů)
      o.ri = M5.otvor / 2 + 2.5;
      o.nat = Math.round(c.natoceni / o.krok) * o.krok;            // aretace po zubech
      o.zN = 5;                                                     // matice M5 (boční kapsa) pod horní plochou spodku
      o.HA = Math.max(A.hloubka + 1.6 + o.zN + M5.maticeV + 0.4 + 4, 10);
      o.HB = 6; o.rHlava = M5.hlava / 2 + 0.6;
      const rho = Math.hypot(Math.max(-B.x0, B.x1), Math.max(-B.y0, B.y1));
      o.e = Math.max(o.Rd * 0.6, o.rHlava + 1.2 + rho);
      o.zB0 = o.hz + o.vz; o.zTop = o.zB0 + o.HB;
      o.Jb = M(Tr(0, 0, o.HA), RZ(o.nat));
      o.FbCelo = M(o.Jb, Tr(0, o.e, o.zTop), otB);
    } else if (c.druh === 'telefon') {
      o.s = 3; o.ret = 2.6; o.W = c.sirka + 2 * c.vule; o.Tp = c.tloustka + c.vule;
      o.FbCelo = null;
    } else if (c.druh === 'zarizeni') {
      o.FbCelo = null;
    }
    // rámce spojů (posunuté o bod spoje)
    o.Fa = o.FaCelo ? M(o.FaCelo, Tr(0, 0, A.mate)) : null;
    o.Fb = o.FbCelo ? M(o.FbCelo, Tr(0, 0, B.mate)) : null;
    return o;
  }
  /** Rámce článků ve světě (bez manifoldu): W[i] = poloha článku, spoje = body a osy spojů. */
  function retez(p) {
    const W = [], O = [], spoje = [];
    let Wp = M(RZ(p.sestava.otoc), RX(p.sestava.naklon));
    p.clanky.forEach((c, i) => {
      const o = odvozClanek(c, p);
      O.push(o);
      if (i === 0 || !O[i - 1].Fb || !o.Fa) { W.push(i === 0 ? Wp : M(W[i - 1], O[i - 1].Fb || I4(), o.Fa ? inv(o.Fa) : I4())); return; }
      const pr = O[i - 1], typ = c.a;
      const J = typ === 'p2' || typ === 'p3' ? RX(c.uhel) : zavitTyp(typ) ? RZ(c.uhel) : jeKostka(typ) ? RZ(uhelKostek(p, c.uhel)) : RZ(Math.abs(c.uhel) >= 90 ? 180 : 0);
      const Fs = M(W[i - 1], pr.Fb);                  // rámec spoje ve světě (rámec B předchozího)
      W.push(M(Fs, J, PREKLOP, inv(o.Fa)));
      const osaL = typ === 'p2' || typ === 'p3' ? [1, 0, 0] : [0, 0, 1];
      spoje.push({ i, typ: typ === 'p2' || typ === 'p3' ? 'prsty' : zavitTyp(typ) ? 'zavit' : jeKostka(typ) ? 'kostky' : 'patka', P: bod(Fs, [0, 0, 0]), osa: smer(Fs, osaL), osaZ: smer(Fs, [0, 0, 1]), osaX: smer(Fs, [1, 0, 0]), osaY: smer(Fs, [0, 1, 0]), uhel: c.uhel, kv: p.clanky[i - 1].b === 'kv' });
    });
    // vnitřní klouby (koule, otočný)
    const vnitrni = [];
    p.clanky.forEach((c, i) => {
      const o = O[i];
      if (c.druh === 'koule') vnitrni.push({ i, typ: 'koule', P: bod(W[i], [0, 0, o.zS]), osa: null });
      if (c.druh === 'otocny') vnitrni.push({ i, typ: 'otocny', P: bod(W[i], [0, 0, o.HA]), osa: smer(W[i], [0, 0, 1]) });
    });
    return { W, O, spoje, vnitrni };
  }

  /* ---------------- kontroly ---------------- */
  const nazevClanku = (p, i) => `${i + 1}. ${DRUHY[p.clanky[i].druh].nazev.toLowerCase()}`;
  function kontroly(p) {
    const H = [], N = p.clanky.length, q = p.prsty;
    const chyba = (pole, text, oprava) => H.push({ uroven: 'chyba', pole, text, oprava });
    const var_ = (pole, text, oprava) => H.push({ uroven: 'varovani', pole, text, oprava });
    const info = (pole, text) => H.push({ uroven: 'info', pole, text });
    const zm = (c, h, text) => ({ zmeny: { [c]: h }, text });
    // řetěz
    p.clanky.forEach((c, i) => {
      const D = DRUHY[c.druh], o = odvozClanek(c, p);
      if (D.zaklad && i > 0) chyba([`clanky.${i}.druh`], `${nazevClanku(p, i)}: základna patří na začátek řetězu.`);
      if (D.koncovka && i < N - 1) chyba([`clanky.${i}.druh`], `${nazevClanku(p, i)}: koncovka musí být poslední – za ní už nic nepřipojíte.`);
      if (i > 0) {
        const pr = p.clanky[i - 1];
        if (pr.b === 'zadne') chyba([`clanky.${i - 1}.b`], `${nazevClanku(p, i - 1)} nemá výstup – další článek není kam připojit.`);
        else if (PROTI[pr.b] !== c.a) {
          const t = `Spoj ${i}–${i + 1}: ${ROZHRANI[pr.b].kratce} nepasuje na ${ROZHRANI[c.a].kratce}.`;
          if (D.a.includes(PROTI[pr.b])) chyba([`clanky.${i}.a`], t + ` Článek ${i + 1} potřebuje ${ROZHRANI[PROTI[pr.b]].kratce}, nebo mezi ně vložte adaptér.`, zm(`clanky.${i}.a`, PROTI[pr.b], `článek ${i + 1}: ${ROZHRANI[PROTI[pr.b]].kratce}`));
          else if (DRUHY[pr.druh].b.includes(PROTI[c.a])) chyba([`clanky.${i - 1}.b`], t + ` Výstup článku ${i} změňte na ${ROZHRANI[PROTI[c.a]].kratce}, nebo vložte adaptér.`, zm(`clanky.${i - 1}.b`, PROTI[c.a], `článek ${i}: ${ROZHRANI[PROTI[c.a]].kratce}`));
          else chyba([`clanky.${i}.a`], t + ' Vložte mezi ně adaptér.');
        } else if (jeKostka(c.a)) {
          const u = uhelKostek(p, c.uhel), u0 = ((c.uhel % 360) + 360) % 360;
          if (Math.abs(u - u0) > 1e-6) info([`clanky.${i}.uhel`], `Spoj ${i}–${i + 1}: kostky jdou natočit jen po ${p.kostky.nx === p.kostky.ny ? 90 : 180}° – natočení ${fmt(c.uhel, 0)}° zapadne do ${fmt(u, 0)}°.`);
        } else if (c.a === 'p2' || c.a === 'p3') {
          const mez = mezPrstu(p);
          if (Math.abs(c.uhel) > mez + 1e-9) var_([`clanky.${i}.uhel`], `Spoj ${i}–${i + 1}: prsty natočené o ${fmt(c.uhel, 0)}° narazí do čela – mez je ±${fmt(mez, 0)}°.`, zm(`clanky.${i}.uhel`, Math.sign(c.uhel) * Math.floor(mez), `úhel ±${fmt(Math.floor(mez), 0)}°`));
        }
      } else if (c.a !== 'zadne') info([`clanky.0.a`], `Začátek řetězu je ${ROZHRANI[c.a].kratce} – připojí se ke kupovanému dílu (stativ, držák, patka fotoaparátu).`);
      if (i === N - 1 && c.b !== 'zadne') info([`clanky.${i}.b`], `Volný konec: ${ROZHRANI[c.b].kratce} – sem připojíte zařízení. Pro výpočet momentů přidejte na konec článek „Zařízení“.`);
      // článek
      if ((c.druh === 'rameno' || c.druh === 'adapter') && !o.auto && c.delka < o.Lmin - 1e-9) chyba([`clanky.${i}.delka`], `${nazevClanku(p, i)}: délka ${fmt(c.delka)} mm nestačí na rozhraní na obou koncích – nejméně ${fmt(Math.ceil(o.Lmin))} mm.`, zm(`clanky.${i}.delka`, Math.ceil(o.Lmin), `délka ${fmt(Math.ceil(o.Lmin))} mm`));
      if (c.druh === 'rameno' && c.ohyb > 0 && c.delka2 < o.B.hloubka + 1) chyba([`clanky.${i}.delka2`], `${nazevClanku(p, i)}: délka za ohybem je kratší než rozhraní výstupu.`, zm(`clanky.${i}.delka2`, Math.ceil(o.B.hloubka + 4), `délka za ohybem ${fmt(Math.ceil(o.B.hloubka + 4))} mm`));
      if (c.druh === 'objimka') {
        if (c.vlozka > 0) info([`clanky.${i}.vlozka`], `Objímka počítá s gumovou vložkou ${fmt(c.vlozka, 1)} mm (duše, páska) – drží lépe a nepoškrábe řídítka.`);
        if (c.D < 15) info([`clanky.${i}.D`], 'Tenká tyč – objímka s jedním šroubem se po ní může točit; přidejte gumovou vložku.');
      }
      if (c.druh === 'prisavka') {
        if (c.krcek >= c.hlava - 1) chyba([`clanky.${i}.krcek`, `clanky.${i}.hlava`], `${nazevClanku(p, i)}: krček přísavky musí být užší než hlavička (jinak klíčová dírka nedrží).`);
        if (o.e + o.rh + 3 > o.Rp) chyba([`clanky.${i}.deska`], `${nazevClanku(p, i)}: klíčová dírka se do desky Ø ${fmt(c.deska)} nevejde.`, zm(`clanky.${i}.deska`, Math.ceil(2 * (o.e + o.rh + 4)), `deska Ø ${fmt(Math.ceil(2 * (o.e + o.rh + 4)))} mm`));
        info([`clanky.${i}.hlava`], 'Rozměry hřibu přísavky změřte posuvkou (typicky hlavička Ø 8–12, krček Ø 4–6 mm). Přísavku nasaďte velkým otvorem a posuňte ke středu.');
      }
      if (c.druh === 'magnet') {
        const mr = o.mr;
        if (c.pocet === 1 ? mr + 2 > o.Rp : o.rKruh < mr + 1 || 2 * Math.PI * o.rKruh / c.pocet < 2 * mr + 1.5) chyba([`clanky.${i}.pocet`, `clanky.${i}.deska`], `${nazevClanku(p, i)}: ${c.pocet} magnetů Ø ${fmt(c.magnet)} se do desky Ø ${fmt(c.deska)} nevejde.`);
        info([`clanky.${i}.magnet`], `Magnety ${c.pocet} × Ø ${fmt(c.magnet)} × ${fmt(c.vyska)} mm se zalepí zespodu do kapes; strop kapsy (1,2 mm plastu) tiskárna přemostí. Plast mezi magnetem a ocelí sníží sílu přibližně na polovinu.`);
      }
      if (c.druh === 'koule') {
        if (o.rl >= o.Rs) chyba([`clanky.${i}.presah`, `clanky.${i}.vule`], `${nazevClanku(p, i)}: hrdlo jamky není užší než koule – koule vypadne. Zvětšete přesah.`, zm(`clanky.${i}.presah`, Math.max(0.4, Math.ceil((c.vule + 0.4) * 10) / 10), 'větší přesah'));
        else if (deg(Math.asin(Math.min(1, o.zl / o.Rs))) > p.tisk.uhel + 0.5) var_([`clanky.${i}.presah`], `${nazevClanku(p, i)}: hrdlo jamky převisá víc než ${fmt(p.tisk.uhel)}° – zmenšete přesah.`);
        if (o.alfa < 15) var_([`clanky.${i}.presah`, `clanky.${i}.koule`], `${nazevClanku(p, i)}: koule se vykloní jen o ${fmt(o.alfa, 0)}° – zmenšete přesah nebo zvětšete kouli.`);
        if (Math.abs(c.sklon) > o.alfa + 1e-9) {
          if (Math.abs(c.sklon) <= o.alfa + 25) info([`clanky.${i}.sklon`], `${nazevClanku(p, i)}: sklon ${fmt(Math.abs(c.sklon), 0)}° je za mezí ${fmt(o.alfa, 0)}° – jde jen do štěrbiny objímky (natočení ke štěrbině).`);
          else var_([`clanky.${i}.sklon`], `${nazevClanku(p, i)}: sklon ${fmt(Math.abs(c.sklon), 0)}° – krček koule narazí do hrdla (mez ${fmt(o.alfa, 0)}°).`, zm(`clanky.${i}.sklon`, Math.sign(c.sklon) * Math.floor(o.alfa), `sklon ${fmt(Math.floor(o.alfa), 0)}°`));
        }
        if (c.vule < 0) info([`clanky.${i}.vule`], 'Záporná vůle = koule v jamce sevřená už bez šroubu (kloub jde ztuha).');
      }
      if (c.druh === 'otocny') {
        if (Math.abs(o.nat - c.natoceni) > 1e-6) info([`clanky.${i}.natoceni`], `${nazevClanku(p, i)}: aretace má krok ${fmt(o.krok, 1)}° – natočení ${fmt(c.natoceni, 0)}° zapadne do ${fmt(o.nat, 1)}°.`);
        if (o.ri + 3 > o.Rd) chyba([`clanky.${i}.prumer`], `${nazevClanku(p, i)}: na zuby nezbývá místo – zvětšete průměr.`, zm(`clanky.${i}.prumer`, 30, 'průměr 30 mm'));
        if (o.hz < 1) info([`clanky.${i}.zubu`], `${nazevClanku(p, i)}: zuby jsou nízké (${fmt(o.hz, 2)} mm) – aretace bude méně jistá. Méně zubů = vyšší zuby.`);
      }
      if (c.druh === 'deska') {
        const ry = Math.max(o.B.y1, -o.B.y0), rx = Math.max(o.B.x1, -o.B.x0);
        const koliduje = o.diry.some(([x, y]) => Math.abs(x) < rx + o.hlavaVrutu / 2 + 0.5 && Math.abs(y) < ry + o.hlavaVrutu / 2 + 0.5);
        if (koliduje) chyba([`clanky.${i}.delka`, `clanky.${i}.sirka`], `${nazevClanku(p, i)}: díry pro vruty leží pod rozhraním výstupu – desku prodlužte.`, zm(`clanky.${i}.delka`, Math.ceil(2 * (ry + o.hlavaVrutu + Math.max(4, c.vrut * 1.3) + 1)), `délka ${fmt(Math.ceil(2 * (ry + o.hlavaVrutu + Math.max(4, c.vrut * 1.3) + 1)))} mm`));
        if (o.B.x1 - o.B.x0 > c.sirka + 0.01 || o.B.y1 - o.B.y0 > c.delka + 0.01) var_([`clanky.${i}.sirka`], `${nazevClanku(p, i)}: rozhraní výstupu je větší než deska.`);
        if (c.otvoru === 0) info([`clanky.${i}.otvoru`], 'Deska bez děr – přilepte ji oboustrannou páskou.');
      }
      if (c.druh === 'telefon') {
        info([`clanky.${i}.sirka`], `Telefon (i s obalem) ${fmt(c.sirka)} × ${fmt(c.tloustka)} mm se zasune shora, dole ho drží doraz a po stranách lemy. Na kolo pojistěte gumičkou.`);
        if (c.vyska < 35) info([`clanky.${i}.vyska`], 'Nízký držák – telefon se může vyklápět; doporučeno aspoň 40 mm.');
      }
      if (c.druh === 'zarizeni' && c.hmotnost > 800 && (c.a === 'p2' || c.a === 'p3')) var_([`clanky.${i}.hmotnost`], `Zařízení ${fmt(c.hmotnost, 0)} g na prstech akční kamery – prsty jsou na lehké kamery; těžší fotoaparát patří na závit 1/4″ nebo 3/8″.`);
      // rozhraní: hlášení k závitům a patce (jednou na typ)
    });
    const typy = new Set(p.clanky.flatMap(c => [c.a, c.b]));
    // prsty
    if (typy.has('p2') || typy.has('p3')) {
      const Rmax = 1.0824 * q.R;
      if (q.h < Rmax + 0.5) chyba(['prsty.h', 'prsty.R'], `Otvor prstů je jen ${fmt(q.h, 1)} mm nad čelem – konec protikusu (Ø ${fmt(2 * Rmax, 1)}) by drhnul o čelo. Nejméně ${fmt(Math.ceil((Rmax + 0.6) * 10) / 10, 1)} mm.`, zm('prsty.h', Math.ceil((Rmax + 0.6) * 10) / 10, `výška otvoru ${fmt(Math.ceil((Rmax + 0.6) * 10) / 10, 1)} mm`));
      if (q.dira / 2 > q.R - 2) chyba(['prsty.dira', 'prsty.R'], 'Otvor pro šroub je na prst moc velký – kolem musí zůstat aspoň 2 mm.');
      if (q.vule < 0.1) var_(['prsty.vule'], `Vůle mezi prsty ${fmt(q.vule, 2)} mm – prsty kupované kamery do mezer nevlezou. Vytiskněte kalibrační hřeben.`, zm('prsty.vule', 0.25, 'vůle 0,25 mm'));
      if (q.vule > 0.8) info(['prsty.vule'], 'Velká vůle mezi prsty – kloub drží jen díky utažení šroubu (víc se prohnou).');
      if (q.tl < 2.5) var_(['prsty.tl'], `Prst ${fmt(q.tl, 1)} mm je tenký – standard akčních kamer je 3 mm.`, zm('prsty.tl', 3, 'prst 3 mm'));
      info(['prsty.tl'], `Prsty: tloušťka ${fmt(q.tl, 1)} mm, mezera ${fmt(q.tl + q.vule, 2)} mm, otvor Ø ${fmt(q.dira, 1)} mm na šroub M5 – typické rozměry kompatibilní s akčními kamerami GoPro (ověřit měřením, vylaďte kalibračním hřebenem).`);
    }
    // vodorovné díry M5 (prsty, šroub objímky a upínací objímky koule)
    if (typy.has('p2') || typy.has('p3') || p.clanky.some(c => c.druh === 'objimka' || c.druh === 'koule')) {
      if (p.diry === 'kruh') info([], 'Kruhové vodorovné díry mají převislý strop – tiskněte s podporami nebo zvolte kapku (👁 Zobrazení → 💧 Díry jako kapka, klávesa K).');
      else info([], 'Díry pro šrouby M5 jsou osmiboké (tvar kapky do všech stran) – vytisknou se bez podpor v každé tiskové poloze.');
    }
    if (['s14', 'm14', 's38', 'm38'].some(t => typy.has(t))) {
      if (!p.zavit.kov) info(['zavit.kov'], 'Tištěný závit vydrží lehkou kameru; na fotoaparát, stativ a časté šroubování vložte kovovou matici nebo šroub (Rozhraní → Kovová matice).');
      if (p.zavit.vule < 0) var_(['zavit.vule'], 'Záporná vůle závitu – šroub půjde jen násilím. Vytiskněte kalibrační vzorek závitu.', zm('zavit.vule', 0.15, 'vůle 0,15 mm'));
      if (p.zavit.delka14 > 6.5 && (typy.has('s14'))) info(['zavit.delka14'], `Šroub 1/4″ ${fmt(p.zavit.delka14, 1)} mm – fotoaparáty mívají závit hluboký 4,5–6 mm, delší šroub by dosedl na dno.`);
    }
    if (typy.has('kv') || typy.has('kd')) {
      const k = p.kostky, m = mrizkaKostek(p);
      info(['kostky.vystupek'], `Kostky (kompatibilní s LEGO®): rozteč ${fmt(k.roztec, 1)} mm, výstupek Ø ${fmt(k.vystupek, 2)} × ${fmt(k.vyskaVyst, 1)} mm, trubička Ø ${fmt(k.trubicka, 2)}, stěna ${fmt(k.stena, 1)} mm – typické rozměry, ověřit měřením. Tiskárny drží různě: vůli výstupku a trubičky vylaďte kalibračním vzorkem.`);
      if (k.stena < 1.4) info(['kostky.stena'], `Stěna spodku ${fmt(k.stena, 1)} mm – mezi stěnou a krajním výstupkem zůstane ${fmt(k.roztec / 2 - 0.1 - k.stena - k.vystupek / 2, 2)} mm, drží jen trubičky.`);
      if (m.dvojrada && Math.abs(m.dT / 2 + m.dV / 2 - k.roztec * Math.SQRT1_2) > 0.25) var_(['kostky.vuleTrub', 'kostky.vuleVyst'], `Trubička a výstupky se míjejí o ${fmt(m.dT / 2 + m.dV / 2 - k.roztec * Math.SQRT1_2, 2)} mm – spoj bude buď volný, nebo nepůjde nasadit.`);
      if (k.vyskaVyst + 0.3 > m.H - 0.8) var_(['kostky.vyskaVyst'], 'Dutina spodku je na vysoké výstupky mělká.');
      if (k.technic === 'kriz') info(['kostky.technic'], 'Křížové otvory Technic pro osu (4,8 × 1,8 mm) napříč spodkem ve výšce 5,8 mm – spodek má výšku kostky 9,6 mm.');
      if (k.technic === 'kulaty') info(['kostky.technic'], 'Kulaté otvory Technic pro čep (Ø 4,8 mm) napříč spodkem ve výšce 5,8 mm – spodek má výšku kostky 9,6 mm. Tvar otvoru se řídí volbou 💧 Díry jako kapka.');
      if (k.sila > 4) info(['kostky.sila'], `Přídržná síla ${fmt(k.sila, 1)} N na výstupek je víc, než typicky dají originální kostky (≈ 1–3 N).`);
    }
    if (typy.has('pn') || typy.has('pz')) info(['patka.sirka'], `Studená patka: nožka ${fmt(p.patka.sirka)} × ${fmt(p.patka.delka)} × ${fmt(p.patka.tl, 1)} mm (typické podle ISO 518 – ověřit měřením). Patka nic nearetuje – proti vysunutí pomůže kupovaná sáňka se šroubem.`);
    if (p.tisk.material === 'PLA') info(['tisk.material'], 'PLA na slunci (auto, kolo) měkne už kolem 55 °C – na venkovní úchyty raději PETG nebo ASA.');
    return H;
  }

  /* ---------------- stavba těles ---------------- */
  const segmenty = r => Math.max(24, Math.min(96, Math.ceil(2 * Math.PI * r / 0.8 / 4) * 4));
  /** Body oblouku (u, v). */
  const oblouk = (cu, cv, R, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cu + R * Math.cos(a), cv + R * Math.sin(a)]; });
  /** Otvor s osou kolmou na rovinu (u, v): osmiúhelník opsaný kružnici – tiskne se bez podpor, ať je nahoře u i v
      (tisková poloha se volí až po stavbě, proto ne kapka s jedním hrotem). kruh = true (p.diry === 'kruh') → kruh Ø 2r. */
  function osmiuhelnik(r, kruh) {
    if (kruh) return G.obrysDiry(r, segmenty(r), false);
    const c = 1.12 * r, d = r * Math.SQRT2 - c;
    return [[c, -d], [c, d], [d, c], [-d, c], [-c, d], [-c, -d], [-d, -c], [d, -c]];
  }
  /** Šestihran na klíč s (plošky kolmé na u). */
  const sestihran = (s, cu = 0, cv = 0) => Array.from({ length: 6 }, (_, i) => { const a = rad(30 + 60 * i), R = s / 2 / Math.cos(rad(30)); return [cu + R * Math.cos(a), cv + R * Math.sin(a)]; });
  /** Zaoblený obdélník (u, v). */
  function obdelnik(x0, x1, y0, y1, r) {
    r = Math.max(0.05, Math.min(r, (x1 - x0) / 2 - 0.01, (y1 - y0) / 2 - 0.01));
    const out = [], st = [[x1 - r, y1 - r], [x0 + r, y1 - r], [x0 + r, y0 + r], [x1 - r, y0 + r]];
    // rohy sražené 45° (zaoblení by u podložky dalo plošky skoro vodorovné = falešné převisy)
    st.forEach(([cx, cy], i) => { for (let j = 0; j <= 1; j++) { const u = Math.PI / 2 * (i + j); out.push([cx + r * Math.cos(u), cy + r * Math.sin(u)]); } });
    return out;
  }
  // (u, v, w) → (x = w, y = u, z = v): průřez v rovině YZ vytažený podél X
  const DO_YZ = (x = 0) => [0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, x, 0, 0, 1];
  // (u, v, w) → (x = u, y = w, z = v): průřez v rovině XZ vytažený podél Y
  const DO_XZ = (y = 0) => [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, y, 0, 1];

  /** Stavebnice nad manifoldem (k = zapamatovat k uvolnění). */
  function nastroje(w, k) {
    const { Manifold: Mf, CrossSection: CS } = w;
    const vytah = (body, h) => k(k(new CS([body], 'NonZero')).extrude(h));
    const valec = (r, z0, z1, x = 0, y = 0, n) => k(k(Mf.cylinder(z1 - z0, r, r, n || segmenty(r))).translate([x, y, z0]));
    const kvadr = (x0, x1, y0, y1, z0, z1) => k(k(Mf.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    const otoc = (body, n = 72) => k(k(new CS([body], 'NonZero')).revolve(n));
    const tf = (m, A) => k(m.transform(A));
    /** Osmiboký „válec“ s ploškami kolmo na X a Y (vepsaný poloměr r) – tiskne se bez převisů naležato i na boku. */
    const osmiValec = (r, z0, z1) => k(k(k(Mf.cylinder(z1 - z0, r / Math.cos(Math.PI / 8), r / Math.cos(Math.PI / 8), 8)).rotate([0, 0, 22.5])).translate([0, 0, z0]));
    const obal = list => k(Mf.hull(list));
    const sjed = list => (list.length === 1 ? list[0] : k(Mf.union(list)));
    return { Mf, CS, vytah, valec, kvadr, otoc, tf, obal, sjed, osmiValec };
  }

  /** Rozhraní v rámci čela → {plne, odeb, podlozka, tah: [{osaSroubu, smerPrstu}|{osaZavitu}]}. */
  function stavRozhrani(N, typ, p) {
    const R = rozmeryRozhrani(typ, p), plne = [], odeb = [], tah = [];
    const { vytah, valec, kvadr, tf, otoc, osmiValec } = N;
    if (typ === 'zadne') return { R, plne, odeb, podlozka: null, tah };
    let podlozka;
    if (R.prsty) {
      const q = p.prsty, t = q.tl, Rr = q.R, h = q.h;
      const profil = [[-Rr, -0.6], [Rr, -0.6], [Rr, h + 0.4142 * Rr], ...oblouk(0, h, Rr, Math.PI / 4, 3 * Math.PI / 4, 16), [-Rr, h + 0.4142 * Rr]];
      for (const c of R.stredy) plne.push(tf(vytah(profil, t), DO_YZ(c - t / 2)));
      if (typ === 'p3' && q.matice) {   // zesílený vnější prst s kapsou na matici M5 (zvenku)
        const x0 = R.stredy[2] + t / 2 - 0.01;
        plne.push(tf(vytah(profil, 3.51), DO_YZ(x0)));
        odeb.push(tf(vytah(sestihran(M5.maticeS + 0.3, 0, h), M5.maticeV / 2 + 1.2), DO_YZ(R.x1 - (M5.maticeV / 2 + 1.2) + 0.01)));
      }
      odeb.push(tf(vytah(osmiuhelnik(q.dira / 2, p.diry === 'kruh').map(([u, v]) => [u, v + h]), R.x1 - R.x0 + 2), DO_YZ(R.x0 - 1)));
      podlozka = tf(vytah(obdelnik(R.x0, R.x1, R.y0, R.y1, 1.2), 0.6), Tr(0, 0, -0.6));
      tah.push({ prsty: true, osaSroubu: [1, 0, 0], smerPrstu: [0, 0, 1] });
    } else if (R.zavit) {
      const z = R.zavit, L = R.L, v = p.zavit.vule, hz = 0.6134 * z.p;
      const nSeg = Math.max(48, Math.min(96, Math.ceil(2 * Math.PI * z.d / 2 / 0.6 / 4) * 4));
      podlozka = osmiValec(R.kruh, -0.6, 0);
      if (R.muz) {
        if (!R.kov) {
          plne.push(N.k(ZG.zavitovaTyc(N.w, N.k, { p: z.p, h: hz, bok: 30, rMaj: z.d / 2 - v / 2 }, L + 0.3, nSeg, 'nahore').translate([0, 0, -0.3])));
          tah.push({ zavit: true, osaZavitu: [0, 0, 1], muz: true, stred: [0, 0, 0], z0: -0.5, z1: L + 0.5, r: z.d / 2 + 0.5 });
        } else {
          plne.push(osmiValec(R.kruh, -R.hloubka - 1.2, 0));
          odeb.push(tf(vytah(sestihran(z.maticeS + 0.3), z.maticeV + 0.3), Tr(0, 0, -(z.maticeV + 0.3))));
          odeb.push(valec(z.d / 2 + 0.3, -R.hloubka, 0.1));
          tah.push({ kov: true, osaZavitu: [0, 0, 1] });
        }
      } else {
        plne.push(osmiValec(R.kruh, -R.hloubka, 0));
        if (!R.kov) {
          const rM = z.d / 2 + v;
          odeb.push(N.k(ZG.zavitovaTyc(N.w, N.k, { p: z.p, h: hz, bok: 30, rMaj: rM }, L + 0.8, nSeg, null).translate([0, 0, -(L + 0.5)])));
          // náběh 45° v čele a kuželový konec (strop otvoru bez mostu)
          odeb.push(otoc([[0, 0.5], [rM + 0.5, 0.5], [rM - hz - 0.05, -(hz + 0.55)], [0, -(hz + 0.55)]], nSeg));
          odeb.push(otoc([[0, -(L + 0.5) - (rM - hz)], [rM - hz, -(L + 0.5)], [rM - hz, -(L - 0.5)], [0, -(L - 0.5)]], nSeg));
          tah.push({ zavit: true, osaZavitu: [0, 0, 1], muz: false, stred: [0, 0, 0], z0: -(L + 0.5) - z.d / 2 - 0.5, z1: 0.6, r: z.d / 2 + 0.7 });
        } else {
          odeb.push(tf(vytah(sestihran(z.maticeS + 0.3), z.maticeV + 0.31), Tr(0, 0, -(z.maticeV + 0.3))));
          const hl = Math.max(L + 1, z.maticeV + 1.5);
          odeb.push(valec(z.d / 2 + 0.3, -hl, 0.1));
          odeb.push(otoc([[0, -hl - z.d / 2 - 0.3], [z.d / 2 + 0.3, -hl], [0, -hl + 0.1]], nSeg));
          tah.push({ kov: true, osaZavitu: [0, 0, 1] });
        }
      }
    } else if (typ === 'pn') {
      const a = p.patka;
      plne.push(kvadr(-a.krkSirka / 2, a.krkSirka / 2, -a.delka / 2, a.delka / 2, -0.6, a.krk + 0.01));
      // nožka se sraženými hranami (tisk na boku i naležato)
      const ch = Math.min(0.5, a.tl / 3);
      const prof = [[-a.sirka / 2 + ch, a.krk], [a.sirka / 2 - ch, a.krk], [a.sirka / 2, a.krk + ch], [a.sirka / 2, a.krk + a.tl - ch], [a.sirka / 2 - ch, a.krk + a.tl], [-a.sirka / 2 + ch, a.krk + a.tl], [-a.sirka / 2, a.krk + a.tl - ch], [-a.sirka / 2, a.krk + ch]];
      plne.push(tf(vytah(prof, a.delka), DO_XZ(-a.delka / 2)));
      podlozka = tf(vytah(obdelnik(R.x0, R.x1, R.y0, R.y1, 1), 0.6), Tr(0, 0, -0.6));
    } else if (typ === 'pz') {
      const a = p.patka, v = a.vule;
      plne.push(kvadr(R.x0, R.x1, R.y0, R.y1, -R.hloubka, 0));
      const y0 = -a.delka / 2 - v, y1 = R.y1 + 1;
      odeb.push(kvadr(-(a.sirka / 2 + v), a.sirka / 2 + v, y0, y1, -(a.krk + a.tl + v), -a.krk + v));   // kanál nožky
      odeb.push(kvadr(-(a.krkSirka / 2 + v), a.krkSirka / 2 + v, y0, y1, -a.krk, 1));             // štěrbina pro krk
      // náběh v ústí (+Y) – nožka se snáz nasune
      podlozka = tf(vytah(obdelnik(R.x0, R.x1, R.y0, R.y1, 1), 0.6), Tr(0, 0, -0.6));
    }
    else if (typ === 'kv' || typ === 'kd') {
      const m = R.kostky;
      podlozka = tf(vytah(obdelnik(R.x0, R.x1, R.y0, R.y1, 0.4), 0.6), Tr(0, 0, -0.6));
      if (typ === 'kv') {
        // deska s výstupky: výstupky nahoru (+Z čela), horní hrana sražená 0,3 mm pro snadné nasazení
        plne.push(kvadr(R.x0, R.x1, R.y0, R.y1, -m.Hd, 0.001));
        const rv = m.dV / 2, ch = Math.min(0.3, m.hv / 3);
        for (const [x, y] of m.vyst) plne.push(N.k(otoc([[0, -0.2], [rv, -0.2], [rv, m.hv - ch], [rv - ch, m.hv], [0, m.hv]], segmenty(rv)).translate([x, y, 0])));
        tah.push({ vystupky: true, osaVyst: [0, 0, 1] });
      } else {
        // spodek: blok s dutinou hloubky hc, trubičky (2 × N) nebo kolíky (1 × N), stěny tloušťky stena
        const st = p.kostky.stena, H = m.H;
        plne.push(kvadr(R.x0, R.x1, R.y0, R.y1, -H, 0));
        // dutina = kvádr bez trubiček (+ dutý střed trubiček); odečte se až od celého článku, aby ji tělo článku nezaplnilo
        const dutina = [kvadr(R.x0 + st, R.x1 - st, R.y0 + st, R.y1 - st, -m.hc, 0.5)];
        const trubky = m.trub.map(([x, y]) => valec(m.dT / 2, -m.hc - 0.02, 0.6, x, y));
        let D = trubky.length ? N.k(N.Mf.difference([dutina[0], ...trubky])) : dutina[0];
        if (m.dvojrada) D = N.k(N.Mf.union([D, ...m.trub.map(([x, y]) => valec(m.dTi / 2, -m.hc + 0.6, 0.5, x, y))]));   // dutá trubička, zaslepená 0,6 mm pod stropem
        odeb.push(D);
        podlozka = tf(vytah(obdelnik(R.x0, R.x1, R.y0, R.y1, 0.4), 0.6), Tr(0, 0, -H));
        if (m.technic !== 'ne') {
          const rT = m.dTech / 2, kriz = m.technic === 'kriz';
          const obrys = kriz
            ? [[rT, -1], [rT, 1], [1, 1], [1, rT], [-1, rT], [-1, 1], [-rT, 1], [-rT, -1], [-1, -1], [-1, -rT], [1, -rT], [1, -1]]
            : osmiuhelnik(rT, p.diry === 'kruh');
          for (const x of m.technicX) odeb.push(tf(vytah(obrys.map(([u, v]) => [u + x, v - m.zT]), m.L + 2), DO_XZ(R.y0 - 1)));
        }
        tah.push({ dutina: true, osaVyst: [0, 0, 1] });
      }
    }
    return { R, plne, odeb, podlozka, tah };
  }

  /** Postaví díly jednoho článku v rámci článku → [{nazev, jmeno, m, L (umístění v článku), tah}]. */
  function stavClanek(N, c, i, p, o) {
    const { valec, kvadr, tf, obal, sjed, vytah, otoc, Mf } = N;
    const D = DRUHY[c.druh];
    if (D.netisk) return [];
    const A = c.a !== 'zadne' ? stavRozhrani(N, c.a, p) : null, B = c.b !== 'zadne' ? stavRozhrani(N, c.b, p) : null;
    const umisti = (X, F) => ({ plne: X ? X.plne.map(m => tf(m, F)) : [], odeb: X ? X.odeb.map(m => tf(m, F)) : [], pod: X && X.podlozka ? tf(X.podlozka, F) : null, tah: X ? X.tah.map(t => ({ ...t, osaSroubu: t.osaSroubu && smer(F, t.osaSroubu), smerPrstu: t.smerPrstu && smer(F, t.smerPrstu), osaZavitu: t.osaZavitu && smer(F, t.osaZavitu), osaVyst: t.osaVyst && smer(F, t.osaVyst), stred: t.stred && bod(F, t.stred) })) : [] });
    const a = A ? umisti(A, o.FaCelo) : umisti(null), b = B ? umisti(B, o.FbCelo) : umisti(null);
    const hotovo = (telo, roz, odeb, tah) => {
      const m = Mf.difference([sjed([...telo, ...roz.flatMap(x => x.plne)]), ...roz.flatMap(x => x.odeb), ...odeb]);
      N.k(m);
      return { m, tah: [...tah, ...roz.flatMap(x => x.tah)] };
    };
    const nazev = D.nazev, jm = `c${i + 1}_${c.druh}`;
    if (c.druh === 'rameno' || c.druh === 'adapter') {
      const telo = [];
      const padA = a.pod || valec(3, 0, 0.6), padB = b.pod || tf(valec(3, -0.6, 0), o.FbCelo);
      if (o.ohyb > 0) {
        const padAhore = tf(A ? A.podlozka : valec(3, -0.6, 0), M(Tr(0, 0, o.L1), RZ(0)));
        const padBdole = tf(B ? B.podlozka : valec(3, -0.6, 0), M(Tr(0, 0, o.L1), RY(o.ohyb), RZ(c.otocB), PREKLOP));
        telo.push(obal([padA, padAhore]), obal([padAhore, padBdole]), obal([padBdole, padB]));
      } else telo.push(obal([padA, padB]));
      const r = hotovo(telo, [a, b], [], []);
      return [{ nazev, jmeno: jm, m: r.m, L: I4(), tah: r.tah }];
    }
    if (c.druh === 'objimka') {
      const w2 = c.sirka / 2, u = o.ucho, ys = u.sterbina / 2, zU = -(o.Ro + u.v), zS = -(o.Ro + u.v / 2) + 0.4;
      const telo = [tf(valec(o.Ro, -w2, w2), RY(90))];
      telo.push(kvadr(-w2, w2, -(ys + u.tl), ys + u.tl, zU, -o.Rt));
      telo.push(obal([b.pod, tf(B.podlozka, M(Tr(0, 0, o.Rt), RZ(c.otocB)))]));
      const odeb = [tf(valec(o.Rt, -w2 - 1, w2 + 1), RY(90)), kvadr(-w2 - 1, w2 + 1, -ys, ys, zU - 1, -o.Rt + 0.5)];
      // šroub M5 napříč uchy (osa Y), kapsa na matici zvenku na +Y
      odeb.push(tf(vytah(osmiuhelnik(M5.otvor / 2, p.diry === 'kruh'), 2 * (ys + u.tl) + 2), M(Tr(0, 0, zS), DO_XZ(-(ys + u.tl) - 1))));
      odeb.push(tf(vytah(sestihran(M5.maticeS + 0.3), M5.maticeV + 0.4), M(Tr(0, 0, zS), DO_XZ(ys + u.tl - M5.maticeV - 0.4 + 0.01))));
      const r = hotovo(telo, [b], odeb, [{ osaKruhu: [1, 0, 0] }]);
      return [{ nazev, jmeno: jm, m: r.m, L: I4(), tah: r.tah }];
    }
    if (c.druh === 'prisavka') {
      const ch = 0.6;
      const telo = [otoc([[0, 0], [o.Rp - ch, 0], [o.Rp, ch], [o.Rp, o.T - ch], [o.Rp - ch, o.T], [0, o.T]], segmenty(o.Rp))];
      telo.push(obal([b.pod, tf(B.podlozka, M(Tr(0, 0, o.T - 0.5), RZ(c.otocB)))]));
      const wn = c.krcek / 2 + 0.2, e = o.e;
      const odeb = [
        valec(o.rh, -1, o.kh + o.hh, -e, 0),                                                   // vstupní otvor (hlavička projde)
        obal([valec(wn, -1, o.kh + 0.01, -e, 0), valec(wn, -1, o.kh + 0.01, 0, 0)]),           // drážka pro krček
        obal([valec(o.rh, o.kh, o.kh + o.hh, -e, 0), valec(o.rh, o.kh, o.kh + o.hh, 0, 0)]),   // kanál pro hlavičku
      ];
      const r = hotovo(telo, [b], odeb, [{ deska: [0, 0, 1] }]);
      return [{ nazev, jmeno: jm, m: r.m, L: I4(), tah: r.tah }];
    }
    if (c.druh === 'magnet') {
      const ch = 0.6;
      const telo = [otoc([[0, 0], [o.Rp - ch, 0], [o.Rp, ch], [o.Rp, o.T - ch], [o.Rp - ch, o.T], [0, o.T]], segmenty(o.Rp))];
      telo.push(obal([b.pod, tf(B.podlozka, M(Tr(0, 0, o.T - 0.5), RZ(c.otocB)))]));
      const odeb = [];
      for (let j = 0; j < c.pocet; j++) {
        const f = 2 * Math.PI * j / c.pocet + Math.PI / 2;
        odeb.push(valec(o.mr, -1, o.mh, o.rKruh * Math.cos(f), o.rKruh * Math.sin(f)));
      }
      const r = hotovo(telo, [b], odeb, [{ deska: [0, 0, 1] }]);
      return [{ nazev, jmeno: jm, m: r.m, L: I4(), tah: r.tah }];
    }
    if (c.druh === 'deska') {
      const ch = 0.6, W2 = c.sirka / 2, L2 = c.delka / 2;
      const telo = [N.k(N.Mf.hull([kvadr(-W2 + ch, W2 - ch, -L2 + ch, L2 - ch, 0, c.tloustka), kvadr(-W2, W2, -L2, L2, ch, c.tloustka - ch)]))];
      if (b.pod) telo.push(obal([b.pod, tf(B.podlozka, M(Tr(0, 0, c.tloustka - 0.5), RZ(c.otocB)))]));
      const odeb = [];
      for (const [x, y] of o.diry) {
        odeb.push(valec(c.vrut / 2 + 0.25, -1, c.tloustka + 1, x, y));
        const rh = o.hlavaVrutu / 2 + 0.2, hk = Math.min(c.tloustka - 0.8, rh - c.vrut / 2);
        odeb.push(N.k(otoc([[0, c.tloustka - hk], [c.vrut / 2 + 0.25, c.tloustka - hk], [rh, c.tloustka + 0.01], [rh, c.tloustka + 1], [0, c.tloustka + 1]], segmenty(rh)).translate([x, y, 0])));
      }
      const r = hotovo(telo, [b], odeb, [{ deska: [0, 0, 1] }]);
      return [{ nazev, jmeno: jm, m: r.m, L: I4(), tah: r.tah }];
    }
    if (c.druh === 'popruh') {
      const W2 = o.W / 2, L2 = o.Lp / 2;
      const prof = obdelnik(-W2, W2, 0, o.T, 1.2);
      const telo = [tf(vytah(prof, o.Lp), DO_XZ(-L2))];
      telo.push(obal([b.pod, tf(B.podlozka, M(Tr(0, 0, o.T - 0.5), RZ(c.otocB)))]));
      const odeb = [tf(vytah(obdelnik(-o.tun.w / 2, o.tun.w / 2, o.st, o.st + o.tun.h, 0.4), o.Lp + 2), DO_XZ(-L2 - 1))];
      const r = hotovo(telo, [b], odeb, [{ tunel: [0, 1, 0] }]);
      return [{ nazev, jmeno: jm, m: r.m, L: I4(), tah: r.tah }];
    }
    if (c.druh === 'koule') {
      // jamka s upínací objímkou (rozříznutá na +Y, uši se šroubem M5 v ose X)
      const zS = o.zS, u = o.ucho, rCyl = o.Ro;
      const vrch = zS + o.zl + 0.6;
      const telo = [otoc([[0, 0], [rCyl, 0], [rCyl, zS], ...oblouk(0, zS, o.Ro, 0, Math.asin(Math.min(1, (vrch - zS) / o.Ro)), 10).slice(1), [0, vrch]], segmenty(o.Ro))];
      if (a.pod) telo.push(obal([a.pod, valec(rCyl, 0, 0.6)]));
      const yU0 = o.Rs + 0.5, yU1 = o.Ro + u.w;
      telo.push(kvadr(-(u.sterbina / 2 + u.tl), u.sterbina / 2 + u.tl, 0, yU1, zS - u.w / 2, zS + u.w / 2));
      const odeb = [
        otoc([[0, zS - o.Rs], ...oblouk(0, zS, o.Rs, -Math.PI / 2, Math.atan2(o.zl, o.rl), 24).slice(1), [o.rl + 1.5, vrch + 0.9], [0, vrch + 0.9]], segmenty(o.Rs)),
        kvadr(-u.sterbina / 2, u.sterbina / 2, 0, yU1 + 1, zS - o.Rs * 0.35, vrch + 1),
      ];
      const yS = (yU0 + yU1) / 2 + 0.6;
      odeb.push(tf(vytah(osmiuhelnik(M5.otvor / 2, p.diry === 'kruh'), 2 * (u.sterbina / 2 + u.tl) + 2), M(Tr(0, yS, zS), DO_YZ(-(u.sterbina / 2 + u.tl) - 1))));
      odeb.push(tf(vytah(sestihran(M5.maticeS + 0.3).map(([u, v]) => [v, u]), M5.maticeV + 0.4), M(Tr(0, yS, zS), DO_YZ(u.sterbina / 2 + u.tl - M5.maticeV - 0.4 + 0.01))));
      const rJ = hotovo(telo, [a], odeb, []);
      // koule se stopkou (střed koule v počátku, spodek seříznutý 45° pro tisk)
      const zn0 = Math.sqrt(Math.max(0, o.Rk * o.Rk - o.rn * o.rn));
      const telK = [otoc([[0, -o.a45], [o.a45, -o.a45], ...oblouk(0, 0, o.Rk, -Math.PI / 4, Math.atan2(zn0, o.rn), 28).slice(1), [o.rn, o.Lk - 0.3], [0, o.Lk - 0.3]], segmenty(o.Rk))];
      const bK = B ? umisti(B, M(Tr(0, 0, o.Lk), RZ(c.otocB))) : umisti(null);
      if (bK.pod) telK.push(obal([bK.pod, valec(o.rn, o.Lk - 2.5, o.Lk - 2)]));
      const rK = hotovo(telK, [bK], [], []);
      return [{ nazev: nazev + ' – jamka', jmeno: jm + '_jamka', m: rJ.m, L: I4(), tah: rJ.tah },
        { nazev: nazev + ' – koule', jmeno: jm + '_koule', m: rK.m, L: o.Jk, tah: rK.tah }];
    }
    if (c.druh === 'otocny') {
      // spodek: válec s rozhraním A dole, zuby nahoře, boční kapsa na matici M5
      const Rd = o.Rd, n = o.n, ri = o.ri;
      const telA = [valec(Rd, 0, o.HA)];
      if (a.pod) telA.push(obal([a.pod, valec(Math.min(Rd, 6), 0, 0.6)]));
      const zub = (f, dole) => {   // hřbet zubu v úhlu f; dole = zuby vršku (hrot dolů)
        // pata zubu zasahuje 0,3 mm do kotouče (jen dotyk v rovině by manifold mohl nechat jako samostatné těleso)
        const z0 = dole ? o.vz + o.hz + 0.3 : o.HA - 0.3, z1 = dole ? o.vz : o.HA + o.hz, d = Math.PI / n * (o.hz + 0.3) / o.hz;
        const P = [];
        for (const r of [ri, Rd]) {
          P.push([r * Math.cos(f - d), r * Math.sin(f - d), z0], [r * Math.cos(f + d), r * Math.sin(f + d), z0], [r * Math.cos(f), r * Math.sin(f), z1]);
        }
        return obal(P);
      };
      for (let j = 0; j < n; j++) telA.push(zub(2 * Math.PI * j / n, false));
      const odA = [valec(M5.otvor / 2, o.HA - o.zN - M5.maticeV - 4.5, o.HA + o.hz + 1)];
      const zN0 = o.HA - o.zN - M5.maticeV - 0.4;
      odA.push(tf(vytah(sestihran(M5.maticeS + 0.3), M5.maticeV + 0.4), Tr(0, 0, zN0)));
      odA.push(kvadr(-(M5.maticeS + 0.3) / 2, (M5.maticeS + 0.3) / 2, 0, Rd + 1, zN0, zN0 + M5.maticeV + 0.4));
      const rA = hotovo(telA, [a], odA, []);
      // vršek (rámec: počátek = horní plocha spodku), zuby dole, hlava šroubu nahoře uprostřed, výstup B vyosený o e
      const bB = B ? umisti(B, M(Tr(0, o.e, o.zTop), RZ(c.otocB))) : umisti(null);
      const telB = [valec(Rd, o.zB0, o.zTop)];
      for (let j = 0; j < n; j++) telB.push(zub(2 * Math.PI * (j + 0.5) / n, true));
      telB.push(valec(ri - 0.2, o.vz + o.hz * 0.3, o.zB0 + 0.1));
      if (bB.pod) telB.push(obal([valec(Rd, o.zB0, o.zTop), bB.pod]));   // celý kotouč – spodek obálky stoupá strmě (bez převisu)
      const odB = [valec(M5.otvor / 2, -1, o.zTop + 1), valec(o.rHlava, o.zTop - 3.2, o.zTop + 1)];
      odB.push(valec(ri + 0.3, -1, o.vz + 0.01));   // středová zahloubená plocha (nic nedrhne o náboj spodku)
      const rB = hotovo(telB, [bB], odB, []);
      return [{ nazev: nazev + ' – spodek', jmeno: jm + '_spodek', m: rA.m, L: I4(), tah: rA.tah },
        { nazev: nazev + ' – vršek', jmeno: jm + '_vrsek', m: rB.m, L: o.Jb, tah: rB.tah }];
    }
    if (c.druh === 'telefon') {
      const W2 = o.W / 2, s = o.s, Tp = o.Tp, H = c.vyska, y0 = -H / 2, ret = o.ret;
      const zL = s + Tp;
      const prof = [[-W2 - s, 0], [W2 + s, 0], [W2 + s, zL + 2], [W2 - ret, zL + 2], [W2 - ret, zL + 0.6], [W2 - ret + 0.6, zL], [W2, zL], [W2, s], [-W2, s], [-W2, zL], [-W2 + ret - 0.6, zL], [-W2 + ret, zL + 0.6], [-W2 + ret, zL + 2], [-W2 - s, zL + 2]];
      const telo = [tf(vytah(prof, H), DO_XZ(y0))];
      telo.push(kvadr(-W2 - s, W2 + s, y0, y0 + 2.4, 0, zL));   // doraz dole
      if (a.pod) telo.push(obal([a.pod, kvadr(-Math.min(W2, 12), Math.min(W2, 12), -Math.min(H / 2, 12), Math.min(H / 2, 12), 0, 0.6)]));
      const odeb = [kvadr(-W2 * 0.45, W2 * 0.45, y0 - 1, y0 + 3.4, s + Tp * 0.15, zL + 3)];   // výřez dorazu na kabel
      const r = hotovo(telo, [a], odeb, []);
      return [{ nazev, jmeno: jm, m: r.m, L: I4(), tah: r.tah }];
    }
    return [];
  }

  /** Manifold → síť pro náhled a export (+ těžiště). */
  function sit(N, m0, jmeno, nazev, barva) {
    const m = N.k(m0.simplify(1e-3));
    const st = m.status();
    if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
    if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
    const kusy = m.decompose().map(N.k), idx = new Uint32Array(mesh.triVerts);
    return { jmeno, nazev, poz, idx, objem: m.volume(), teles: kusy.filter(x => x.volume() > 1e-3).length, barva, otocit: false, tez: teziste(poz, idx) };
  }
  function teziste(P, I) {
    let V = 0, x = 0, y = 0, z = 0;
    for (let t = 0; t < I.length; t += 3) {
      const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
      const v = (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
      V += v; x += v * (P[a] + P[b] + P[c]) / 4; y += v * (P[a + 1] + P[b + 1] + P[c + 1]) / 4; z += v * (P[a + 2] + P[b + 2] + P[c + 2]) / 4;
    }
    return V > 1e-9 ? [x / V, y / V, z / V] : [0, 0, 0];
  }

  /* ---------------- tisková poloha ---------------- */
  // rotace, které otočí osu „nahoru“ (v rámci dílu) do +Z
  const POLOHY = [
    { id: '+Z', u: [0, 0, 1], R: I4() }, { id: '−Z', u: [0, 0, -1], R: RX(180) },
    { id: '+Y', u: [0, 1, 0], R: RX(90) }, { id: '−Y', u: [0, -1, 0], R: RX(-90) },
    { id: '+X', u: [1, 0, 0], R: RY(-90) }, { id: '−X', u: [-1, 0, 0], R: RY(90) },
  ];
  /** Trojúhelníky mimo válce závitů (těžiště dál od osy než r nebo mimo délku závitu). */
  function bezZavitu(d, zav) {
    const P = d.poz, X = d.idx, out = [];
    for (let t = 0; t < X.length; t += 3) {
      const c = [0, 1, 2].map(j => (P[3 * X[t] + j] + P[3 * X[t + 1] + j] + P[3 * X[t + 2] + j]) / 3);
      const v = zav.some(z => {
        const q = [c[0] - z.stred[0], c[1] - z.stred[1], c[2] - z.stred[2]], a = dot(q, z.osaZavitu);
        return a >= z.z0 && a <= z.z1 && Math.hypot(q[0] - a * z.osaZavitu[0], q[1] - a * z.osaZavitu[1], q[2] - a * z.osaZavitu[2]) <= z.r;
      });
      if (!v) out.push(X[t], X[t + 1], X[t + 2]);
    }
    return new Uint32Array(out);
  }
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  /** Vybere tiskovou polohu: převisy (mm²) + tresty za pevnost; vrátí {poloha, poz, previs, most, slabe: [důvody]}. */
  function tiskovaPoloha(d, tah, uhel) {
    let nej = null;
    // boky tištěného závitu (≈ 60° od svislice) se v ose svisle tisknou běžně – do rozboru převisů nepatří
    const zav = tah.filter(t => t.stred), idx = zav.length ? bezZavitu(d, zav) : d.idx;
    for (const P of POLOHY) {
      const poz = presunPoz(d.poz, P.R), r = G.rozborTisku({ poz, idx }, uhel);
      let trest = 0; const slabe = [];
      for (const t of tah) {
        if (t.prsty) {
          if (Math.abs(dot(P.u, t.smerPrstu)) > 0.9) { trest += 180; slabe.push('prsty'); }
          else if (Math.abs(dot(P.u, t.osaSroubu)) > 0.9) trest += 120;
        }
        if (t.zavit) { const c = dot(P.u, t.osaZavitu); if (t.muz ? c < 0.9 : Math.abs(c) < 0.9) { trest += 150; slabe.push('zavit'); } }
        if (t.osaKruhu && Math.abs(dot(P.u, t.osaKruhu)) < 0.9) { trest += 150; slabe.push('objimka'); }
        if (t.deska && dot(P.u, t.deska) < 0.9) trest += 400;
        if (t.tunel && Math.abs(dot(P.u, t.tunel)) < 0.9) trest += 60;
        if (t.vystupky && dot(P.u, t.osaVyst) < 0.9) { trest += 300; slabe.push('vystupky'); }
        if (t.dutina && Math.abs(dot(P.u, t.osaVyst)) < 0.9) { trest += 120; slabe.push('dutina'); }
      }
      const b = G.obal(poz), skore = r.previs + trest + 0.05 * r.most + 0.02 * (b[5] - b[2]);
      if (!nej || skore < nej.skore - 1e-6) nej = { poloha: P.id, R: P.R, poz, previs: r.previs, most: r.most, slabe, skore };
    }
    return nej;
  }

  /* ---------------- kalibrace ---------------- */
  function stavKalibraci(N, p) {
    const { tf, vytah, kvadr, valec, Mf } = N, out = [], q = p.prsty, t = q.tl, kr = p.tisk.krokKalibrace;
    // hřeben: 6 prstů, 5 mezer s vůlí −2 … +2 kroky; značky = počet zářezů pod mezerou
    {
      const Rr = q.R, h = q.h, prof = [[-Rr, -3], [Rr, -3], [Rr, h + 0.4142 * Rr], ...oblouk(0, h, Rr, Math.PI / 4, 3 * Math.PI / 4, 16), [-Rr, h + 0.4142 * Rr]];
      const casti = [], odeb = [], mezery = [];
      let x = 0;
      for (let i = 0; i < 6; i++) {
        casti.push(tf(vytah(prof, t), DO_YZ(x)));
        x += t;
        if (i < 5) { const g = Math.max(0.05, t + q.vule + (i - 2) * kr); mezery.push({ x0: x, g, vule: Math.round((q.vule + (i - 2) * kr) * 1000) / 1000 }); x += g; }
      }
      casti.push(kvadr(0, x, -Rr, Rr, -6, -2.9));
      mezery.forEach((m, i) => { for (let j = 0; j <= i; j++) odeb.push(kvadr(m.x0 + m.g / 2 - 0.4, m.x0 + m.g / 2 + 0.4, -Rr - 1, -Rr + 1, -6 + 1.2 * j - 0.01 + 0.3, -6 + 1.2 * j + 0.6 + 0.3)); });
      odeb.push(tf(vytah(osmiuhelnik(q.dira / 2, p.diry === 'kruh').map(([u, v]) => [u, v + h]), x + 2), DO_YZ(-1)));
      const m = N.k(Mf.difference([N.sjed(casti), ...odeb]));
      out.push({ m, nazev: 'Kalibrační hřeben prstů', jmeno: 'kal_hreben', tah: [{ prsty: true, osaSroubu: [1, 0, 0], smerPrstu: [0, 0, 1] }], popis: mezery.map((g, i) => `${i + 1}: mezera ${fmt(g.g, 2)} (vůle ${fmt(g.vule, 2)})`).join(' · ') });
    }
    // závit 1/4″: lišta s 5 maticemi a lišta s 5 šrouby, vůle −2 … +2 kroky
    {
      const z = ZAVITY['14'], hz = 0.6134 * z.p, L = 6, roz = 13, plm = [], odm = [], pls = [];
      for (let i = 0; i < 5; i++) {
        const v = Math.round((p.zavit.vule + (i - 2) * kr) * 1000) / 1000, x = roz * i;
        const rM = z.d / 2 + Math.max(-0.2, v);
        odm.push(N.k(ZG.zavitovaTyc(N.w, N.k, { p: z.p, h: hz, bok: 30, rMaj: rM }, L + 2, 64, null).translate([x, 0, -1])));
        odm.push(N.otoc([[0, L - 0.5], [rM + 0.5, L + 0.01 + 0.5], [rM + 0.5, L + 1], [0, L + 1]], 64).translate([x, 0, 0]));
        N.k(odm[odm.length - 1]);
        for (let j = 0; j <= i; j++) odm.push(kvadr(x - 0.4 + (j - i / 2) * 1.6, x + 0.4 + (j - i / 2) * 1.6, -6.5 - 1, -6.5 + 0.8, L - 0.6, L + 1));
        pls.push(N.k(ZG.zavitovaTyc(N.w, N.k, { p: z.p, h: hz, bok: 30, rMaj: z.d / 2 - Math.max(-0.2, v) / 2 }, 6.3, 64, 'nahore').translate([x, 0, 2.7])));
        for (let j = 0; j <= i; j++) pls.push(kvadr(x - 0.4 + (j - i / 2) * 1.6, x + 0.4 + (j - i / 2) * 1.6, -6.5, -5.2, 3 - 0.01, 3.6));
      }
      plm.push(kvadr(-6.5, roz * 4 + 6.5, -6.5, 6.5, 0, L));
      out.push({ m: N.k(Mf.difference([N.sjed(plm), ...odm])), nazev: 'Kalibrační matice 1/4″', jmeno: 'kal_matice', tah: [0, 1, 2, 3, 4].map(i => ({ zavit: true, osaZavitu: [0, 0, 1], muz: false, stred: [roz * i, 0, 0], z0: -1, z1: L + 1.5, r: z.d / 2 + 1.1 })), popis: 'matice 1–5: vůle −2 … +2 kroky' });
      pls.push(kvadr(-6.5, roz * 4 + 6.5, -6.5, 6.5, 0, 3));
      out.push({ m: N.sjed(pls), nazev: 'Kalibrační šrouby 1/4″', jmeno: 'kal_srouby', tah: [0, 1, 2, 3, 4].map(i => ({ zavit: true, osaZavitu: [0, 0, 1], muz: true, stred: [roz * i, 0, 0], z0: 2.5, z1: 9.5, r: z.d / 2 + 0.5 })), popis: 'šrouby 1–5: vůle −2 … +2 kroky' });
    }
    // kostky (kompatibilní s LEGO®): proužek 5 výstupků a proužek 5 spodků 2 × 2, vůle −2 … +2 kroky; jen když je řetěz používá
    if (p.clanky.some(c => jeKostka(c.a) || jeKostka(c.b))) {
      const k = p.kostky, r = k.roztec, m = mrizkaKostek(Object.assign({}, p, { kostky: Object.assign({}, k, { nx: 2, ny: 2, technic: 'ne' }) }));
      const vul = i => Math.round((i - 2) * kr * 1000) / 1000;
      // výstupky
      const plv = [kvadr(-r / 2 + 0.1, 4 * r + r / 2 - 0.1, -r / 2 + 0.1, r / 2 - 0.1, 0, 2)], odv = [];
      for (let i = 0; i < 5; i++) {
        const rv = (k.vystupek + k.vuleVyst + vul(i)) / 2, ch = Math.min(0.3, k.vyskaVyst / 3);
        plv.push(N.k(N.otoc([[0, 1.8], [rv, 1.8], [rv, 2 + k.vyskaVyst - ch], [rv - ch, 2 + k.vyskaVyst], [0, 2 + k.vyskaVyst]], segmenty(rv)).translate([i * r, 0, 0])));
        for (let j = 0; j <= i; j++) odv.push(kvadr(i * r - 0.3 + (j - i / 2) * 1.2, i * r + 0.3 + (j - i / 2) * 1.2, -r / 2 - 1, -r / 2 + 0.7, -1, 3));
      }
      out.push({ m: N.k(Mf.difference([N.sjed(plv), ...odv])), nazev: 'Kalibrační výstupky kostek', jmeno: 'kal_vystupky', tah: [{ vystupky: true, osaVyst: [0, 0, 1] }],
        popis: [0, 1, 2, 3, 4].map(i => `${i + 1}: Ø ${fmt(k.vystupek + k.vuleVyst + vul(i), 2)}`).join(' · ') });
      // spodky 2 × 2 vedle sebe (rozteč 2 r), trubička s odstupňovanou vůlí, značky na vrchu
      const W2 = r - 0.1, H = m.H, st = k.stena, x1 = 4 * 2 * r;
      const ods = [];
      for (let i = 0; i < 5; i++) {
        const x = i * 2 * r, dT = k.trubicka + k.vuleTrub + vul(i);
        ods.push(N.k(Mf.difference([kvadr(x - W2 + st, x + W2 - st, -W2 + st, W2 - st, -0.5, m.hc), valec(dT / 2, -1, m.hc + 0.02, x, 0)])));
        ods.push(valec(k.vystupek / 2, -1, m.hc - 0.6, x, 0));
        for (let j = 0; j <= i; j++) ods.push(kvadr(x - 0.3 + (j - i / 2) * 1.2, x + 0.3 + (j - i / 2) * 1.2, W2 - 2.5, W2 + 1, H - 0.5, H + 1));
      }
      out.push({ m: N.k(Mf.difference([kvadr(-W2, x1 + W2, -W2, W2, 0, H), ...ods])), nazev: 'Kalibrační spodky kostek', jmeno: 'kal_spodky', tah: [{ dutina: true, osaVyst: [0, 0, -1] }],
        popis: [0, 1, 2, 3, 4].map(i => `${i + 1}: trubička Ø ${fmt(k.trubicka + k.vuleTrub + vul(i), 2)}`).join(' · ') });
    }
    return out;
  }

  /* ---------------- celá stavba ---------------- */
  const BARVY = ['#2F5FA8', '#E88A2E', '#3E9A62', '#8E5BB5', '#C6503F', '#2E8FA3', '#A88A2F', '#5F6FA8'];
  /** Sestaví všechny díly: {clanky: [{casti}], dily (k tisku), sestava (náhled ve světě), zarizeni, spoje, vnitrni, cas}. */
  function postav(w, p, volby = {}) {
    const t0 = Date.now(), smaz = [];
    const k = x => { smaz.push(x); return x; };
    const N = Object.assign(nastroje(w, k), { w, k });
    const RT = retez(p);
    try {
      const clanky = [], dily = [], sestava = [];
      let zarizeni = null;
      p.clanky.forEach((c, i) => {
        const o = RT.O[i], casti = stavClanek(N, c, i, p, o).map((x, j) => {
          const d = sit(N, x.m, x.jmeno, `${i + 1}. ${x.nazev}`, BARVY[i % BARVY.length]);
          const tp = tiskovaPoloha(d, x.tah, p.tisk.uhel);
          return Object.assign(d, { clanek: i, cast: j, L: x.L, tah: x.tah, tisk: tp, tez: d.tez });
        });
        for (const d of casti) {
          const Wd = mul(RT.W[i], d.L);
          d.W = Wd; d.tezSvet = bod(Wd, d.tez);
          sestava.push({ nazev: d.nazev, jmeno: d.jmeno, poz: presunPoz(d.poz, Wd), idx: d.idx, barva: d.barva, clanek: i });
          dily.push({ nazev: d.nazev, jmeno: d.jmeno, poz: d.tisk.poz, idx: d.idx, objem: d.objem, barva: d.barva, teles: d.teles, otocit: false, clanek: i });
        }
        if (c.druh === 'zarizeni') {
          const z0 = 0;   // tělo zařízení začíná v čele A (prsty / závit / patka zařízení jsou pod ním)
          const box = [-c.sirka / 2, -c.hloubka / 2, z0, c.sirka / 2, c.hloubka / 2, z0 + c.vyska];
          const poz = [], idx = [];
          const v = [[0, 1, 2], [3, 1, 2], [0, 4, 2], [3, 4, 2], [0, 1, 5], [3, 1, 5], [0, 4, 5], [3, 4, 5]].map(([a, b, cc]) => [box[a], box[b], box[cc]]);
          for (const q of v) poz.push(...bod(RT.W[i], q));
          idx.push(0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5);
          zarizeni = { clanek: i, hmotnost: c.hmotnost, tezSvet: bod(RT.W[i], [0, 0, z0 + c.vyska / 2]), box, W: RT.W[i] };
          sestava.push({ nazev: `${i + 1}. Zařízení (netiskne se)`, jmeno: 'zarizeni', poz: new Float32Array(poz), idx: new Uint32Array(idx), barva: '#8A9099', clanek: i, netisk: true });
        }
        clanky.push({ druh: c.druh, casti, o });
      });
      const kalibrace = [];
      if (volby.kalibrace || p.tisk.kalibrace) {
        for (const x of stavKalibraci(N, p)) {
          const d = sit(N, x.m, x.jmeno, x.nazev, '#E88A2E');
          const tp = tiskovaPoloha(d, x.tah, p.tisk.uhel);
          kalibrace.push(Object.assign({}, d, { poz: tp.poz, popis: x.popis, tisk: tp }));
        }
      }
      return { clanky, dily, sestava, zarizeni, kalibrace, spoje: RT.spoje, vnitrni: RT.vnitrni, W: RT.W, O: RT.O, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  /** Kontroly hotového modelu: rozpad dílu, převisy v tiskové poloze, slabá tisková poloha. */
  function kontrolyModelu(p, model) {
    const H = [];
    for (const c of model.clanky) for (const d of c.casti) {
      const pole = [`clanky.${d.clanek}.druh`];
      if (d.teles > 1) H.push({ uroven: 'chyba', pole, text: `${d.nazev}: díl se rozpadl na ${d.teles} tělesa – některá část není spojená.` });
      const t = d.tisk;
      if (t.previs > 4) H.push({ uroven: 'varovani', pole: ['tisk.uhel', ...pole], text: `${d.nazev}: v tiskové poloze ${t.poloha} zbývá převis ${fmt(t.previs, 0)} mm² – v tom místě zapněte podpory nebo změňte rozhraní.` });
      if (t.slabe.includes('prsty')) H.push({ uroven: 'varovani', pole, text: `${d.nazev}: prsty se tisknou nastojato – ohyb prstu jde napříč vrstvami a může prasknout. Lepší je dát prsty na samostatný adaptér (tiskne se na boku) nebo použít závit 1/4″.` });
      if (t.slabe.includes('zavit')) H.push({ uroven: 'info', pole: ['zavit.kov', ...pole], text: `${d.nazev}: závit se tiskne vodorovně – bude méně přesný. Zvažte kovovou matici nebo jiné natočení výstupu.` });
      if (t.slabe.includes('objimka')) H.push({ uroven: 'info', pole, text: `${d.nazev}: objímka se netiskne naležato – kroužek namáhaný sevřením jde napříč vrstvami.` });
      const dut = d.tah && d.tah.find(x => x.dutina);
      if (dut) {
        const u = POLOHY.find(x => x.id === t.poloha).u, c = dot(u, dut.osaVyst);
        if (c < -0.9) H.push({ uroven: 'info', pole, text: `${d.nazev}: spodek kostek se tiskne dutinou dolů na podložku – strop dutiny tiskárna přemostí (mosty jen mezi trubičkami, nejvýš 8 mm) a spodní hrana sedí rovně.` });
        else if (c > 0.9) H.push({ uroven: 'info', pole, text: `${d.nazev}: spodek kostek se tiskne vzhůru nohama (dutinou nahoru) – dutina i trubičky bez mostů, rozměry trubiček nejpřesnější.` });
        else H.push({ uroven: 'varovani', pole, text: `${d.nazev}: spodek kostek se tiskne na boku – trubičky a strop dutiny převisají. Lepší je lomené rameno, aby dutina mířila dolů nebo nahoru.` });
      }
      if (t.slabe.includes('vystupky')) H.push({ uroven: 'varovani', pole, text: `${d.nazev}: výstupky kostek nemíří při tisku nahoru – budou nepřesné a slabé. Natočte výstup nebo použijte samostatný adaptér.` });
      if (t.most > 2) H.push({ uroven: 'info', pole: null, text: `${d.nazev}: tiskárna přemostí ${fmt(t.most, 0)} mm² vodorovného stropu.` });
    }
    return H;
  }

  /** Text tiskové polohy pro lidi. */
  function popisPolohy(d) {
    const t = d.tisk; if (!t) return '';
    const s = { '+Z': 'čelem A dolů (jak stojí)', '−Z': 'vzhůru nohama', '+Y': 'na boku', '−Y': 'na boku', '+X': 'na boku (napříč)', '−X': 'na boku (napříč)' }[t.poloha];
    return s;
  }

  /* ---------------- projekt ---------------- */
  function popis(p) {
    return p.clanky.map(c => DRUHY[c.druh].nazev.toLowerCase()).join(' → ');
  }
  const TYP = 'foto_uchyty';
  const ulozProjekt = p => G.projektJson(TYP, p, 1);
  const nactiProjekt = text => G.nactiProjektJson(text, TYP, normalizuj, 'Foto úchyty');

  const API = {
    MATERIALY, NAPRIC_VRSTVAMI, ZAVITY, M5, ROZHRANI, PROTI, DRUHY, VYCHOZI, MEZE, VYCTY, PREDVOLBY, MAX_CLANKU, POLOHY,
    normalizuj, normalizujClanek, predvolba, novyClanek, rozmeryRozhrani, mezPrstu, odvozClanek, retez, kontroly, kontrolyModelu,
    postav, tiskovaPoloha, bezZavitu, popisPolohy, sit, teziste, presunPoz, mat: { I4, mul, M, Tr, RX, RY, RZ, inv, bod, smer },
    popis, ulozProjekt, nactiProjekt, kopie, vezmi: G.vezmi, poloz: G.poloz, fmt, nazevClanku,
  };
  if (uzel) module.exports = API; else window.FOTU = API;
})();

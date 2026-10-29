/* Spojky profilů, trubek a latí – jádro bez DOM (běží i v node).
   Parametry a jejich meze, předvolby, odvozené rozměry (směry ramen, odstup dorazu proti kolizi,
   polohy otvorů), kontroly zadání, rozbor tisku (převisy bez opory, mosty, doporučená orientace),
   odhad hmotnosti a času, kusovník šroubů, projekt JSON.
   Geometrii skládá spojky/geometrie.js přes manifold-3d. */
(function () {
  'use strict';
  const VERZE_FORMATU = 1;

  /* ---------- tabulky ---------- */
  // typické hodnoty profilů s drážkou typu B – u konkrétního výrobce změřte (drážka, límec, hloubka)
  const PROFILY = {
    '2020': { a: 20, drazka: 6.2, limec: 1.8, hloubka: 6.1, stred: 4.2, sroub: 'M5' },
    '3030': { a: 30, drazka: 8.2, limec: 2.2, hloubka: 9.0, stred: 6.8, sroub: 'M6' },
    '4040': { a: 40, drazka: 8.2, limec: 4.3, hloubka: 12.2, stred: 6.8, sroub: 'M8' },
  };
  // otvor = průchozí střední řada (ISO 273), hlava = válcová s vnitřním šestihranem (ISO 4762)
  const SROUBY = {
    M3: { d: 3, otvor: 3.4, hlava: 5.5, vyska: 3 },
    M4: { d: 4, otvor: 4.5, hlava: 7, vyska: 4 },
    M5: { d: 5, otvor: 5.5, hlava: 8.5, vyska: 5 },
    M6: { d: 6, otvor: 6.6, hlava: 10, vyska: 6 },
    M8: { d: 8, otvor: 9, hlava: 13, vyska: 8 },
  };
  const DELKY_SROUBU = [6, 8, 10, 12, 14, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100];
  const MATERIALY = {
    PLA: { nazev: 'PLA', hustota: 1.24, pozn: 'tuhé, do interiéru; na slunci měkne (≈ 55 °C)' },
    PETG: { nazev: 'PETG', hustota: 1.27, pozn: 'houževnaté, venku snese vlhko – dobrá volba pro spojky' },
    ASA: { nazev: 'ASA', hustota: 1.07, pozn: 'odolné UV a teplu – stany, kopule a pergoly venku' },
    ABS: { nazev: 'ABS', hustota: 1.04, pozn: 'odolné teplu, tiskne se v uzavřené tiskárně' },
    PA: { nazev: 'PA (nylon)', hustota: 1.14, pozn: 'nejhouževnatější, nasává vlhkost' },
    PC: { nazev: 'PC', hustota: 1.2, pozn: 'pevné a teplu odolné, náročný tisk' },
  };
  const TYPY = { profil: 'Hliníkový profil', trubka: 'Trubky', lat: 'Dřevěné latě' };
  const DRUHY = { uhelnik: 'Rohový úhelník', plocha: 'Plochá spojka', krytka: 'Krytka konce', kostka: 'Rohová kostka 3 profilů' };
  const TVARY_PLOCHY = { I: 'I – rovná (nastavení)', L: 'L – roh', T: 'T – odbočka', X: 'X – kříž' };
  const TVARY_RAMEN = {
    I: { nazev: 'I – rovná (2 ramena)', smery: [[0, 0], [180, 0]] },
    L: { nazev: 'L – roh 90°', smery: [[0, 0], [90, 0]] },
    T: { nazev: 'T – odbočka', smery: [[0, 0], [180, 0], [90, 0]] },
    X: { nazev: 'X – kříž', smery: [[0, 0], [90, 0], [180, 0], [270, 0]] },
    roh3: { nazev: '3cestný roh (prostorový)', smery: [[0, 0], [90, 0], [0, 90]] },
    uzel4: { nazev: '4cestný uzel (T + nahoru)', smery: [[0, 0], [180, 0], [90, 0], [0, 90]] },
    uzel5: { nazev: '5cestný uzel (kříž + nahoru)', smery: [[0, 0], [90, 0], [180, 0], [270, 0], [0, 90]] },
    uzel6: { nazev: '6cestný uzel (všechny osy)', smery: [[0, 0], [90, 0], [180, 0], [270, 0], [0, 90], [0, -90]] },
    rovinny: { nazev: 'Hvězda – N ramen se sklonem (kopule)', smery: null },
    vlastni: { nazev: 'Vlastní úhly ramen', smery: null },
  };

  const VYCHOZI = {
    nazev: 'Spojka',
    typ: 'profil',
    profil: {
      rada: '2020', a: 20, drazka: 6.2, limec: 1.8, hloubka: 6.1, stred: 4.2,
      druh: 'uhelnik', tvar: 'L', sroub: 'M5', delka: 25, tloustka: 4, otvoru: 1, zahloubeni: false,
      vystupek: 1.6, delkaVystupku: 8, zebra: true, zebro: 2.5, stredOtvor: true, kostka: 0,
    },
    trubka: { prurez: 'ctverec', rozmer: 25, stenaTrubky: 1.5, styl: 'vnejsi' },
    lat: { sirka: 45, vyska: 20 },
    ramena: { tvar: 'L', pocet: 5, sklon: 0, seznam: '0 0\n120 0\n240 0' },
    spoj: { vule: 0.2, zasunuti: 30, stena: 3, odstup: 0, otvor: 4.5, skrz: false },
    tisk: { material: 'PETG', vypln: 30, previs: 45, most: 25, orientace: 'auto', kusu: 1 },
  };

  // [min, max] – mimo rozsah se hodnota omezí a uživatel dostane hlášení
  const ROZSAHY = {
    'profil.a': [10, 100], 'profil.drazka': [2, 20], 'profil.limec': [0.8, 10], 'profil.hloubka': [2, 30], 'profil.stred': [0, 20],
    'profil.delka': [8, 200], 'profil.tloustka': [1, 20], 'profil.otvoru': [0, 6], 'profil.vystupek': [0, 10],
    'profil.delkaVystupku': [2, 40], 'profil.zebro': [1, 10], 'profil.kostka': [0, 120],
    'trubka.rozmer': [4, 120], 'trubka.stenaTrubky': [0.3, 20],
    'lat.sirka': [8, 150], 'lat.vyska': [8, 150],
    'ramena.pocet': [2, 12], 'ramena.sklon': [-80, 80],
    'spoj.vule': [-0.3, 2], 'spoj.zasunuti': [5, 200], 'spoj.stena': [0.6, 20], 'spoj.odstup': [0, 300],
    'spoj.otvor': [0, 20],
    'tisk.vypln': [0, 100], 'tisk.previs': [20, 70], 'tisk.most': [0, 100], 'tisk.kusu': [1, 30],
  };

  const PREDVOLBY = [
    { nazev: '2020 – rohový úhelník', popis: 'L s bočními žebry, 1 otvor M5 na rameni, výstupky do drážek',
      p: { typ: 'profil', profil: { rada: '2020', druh: 'uhelnik', sroub: 'M5', delka: 25, tloustka: 4, otvoru: 1, zebra: true } } },
    { nazev: '3030 – rohový úhelník, 2 otvory', popis: 'delší ramena 45 mm, M6 do T-matic',
      p: { typ: 'profil', profil: { rada: '3030', druh: 'uhelnik', sroub: 'M6', delka: 45, tloustka: 5, otvoru: 2, zebra: true, vystupek: 2 } } },
    { nazev: '2020 – plochá spojka T', popis: 'deska 4 mm, 2 otvory M5 na rameni',
      p: { typ: 'profil', profil: { rada: '2020', druh: 'plocha', tvar: 'T', sroub: 'M5', delka: 30, tloustka: 4, otvoru: 2 } } },
    { nazev: '4040 – plochá spojka X', popis: 'kříž, M8, deska 6 mm',
      p: { typ: 'profil', profil: { rada: '4040', druh: 'plocha', tvar: 'X', sroub: 'M8', delka: 45, tloustka: 6, otvoru: 2, vystupek: 3.5 } } },
    { nazev: '2020 – krytka konce', popis: 'zaklapne se do 4 drážek, středový otvor M5',
      p: { typ: 'profil', profil: { rada: '2020', druh: 'krytka', sroub: 'M5', tloustka: 3, vystupek: 1.6, delkaVystupku: 8, stredOtvor: true } } },
    { nazev: '2020 – rohová kostka', popis: '3 profily, šrouby M5 do závitu ve středovém otvoru',
      p: { typ: 'profil', profil: { rada: '2020', druh: 'kostka', sroub: 'M5', tloustka: 4, vystupek: 1.6, delkaVystupku: 8, kostka: 0 } } },
    { nazev: 'Jäkl 25×25 – 3cestný roh (objímka)', popis: 'rám regálu nebo stolu, objímka přes trubku',
      p: { typ: 'trubka', trubka: { prurez: 'ctverec', rozmer: 25, stenaTrubky: 1.5, styl: 'vnejsi' }, ramena: { tvar: 'roh3' },
        spoj: { vule: 0.2, zasunuti: 30, stena: 3, odstup: 0, otvor: 3.5, skrz: false } } },
    { nazev: 'Jäkl 20×20 – T zasouvací', popis: 'vnitřní čep do trubky se stěnou 1,5 mm',
      p: { typ: 'trubka', trubka: { prurez: 'ctverec', rozmer: 20, stenaTrubky: 1.5, styl: 'vnitrni' }, ramena: { tvar: 'T' },
        spoj: { vule: 0.15, zasunuti: 25, stena: 2, odstup: 0, otvor: 3.5, skrz: true } } },
    { nazev: 'Trubka Ø 16 – 6cestný uzel', popis: 'prostorová mřížka, objímky',
      p: { typ: 'trubka', trubka: { prurez: 'kruh', rozmer: 16, stenaTrubky: 1, styl: 'vnejsi' }, ramena: { tvar: 'uzel6' },
        spoj: { vule: 0.2, zasunuti: 22, stena: 2.5, odstup: 0, otvor: 0, skrz: false } } },
    { nazev: 'Stan – štít Ø 19', popis: 'hřebenová tyč a dvě nohy rozevřené o 2 × 35°',
      p: { typ: 'trubka', trubka: { prurez: 'kruh', rozmer: 19, stenaTrubky: 1.2, styl: 'vnejsi' },
        ramena: { tvar: 'vlastni', seznam: '0 0\n90 -55\n270 -55' }, spoj: { vule: 0.3, zasunuti: 35, stena: 3, odstup: 0, otvor: 4.5, skrz: false } } },
    { nazev: 'Kopule 2V – vrchol s 5 rameny Ø 20', popis: 'hvězda 5 ramen, sklon −16°',
      p: { typ: 'trubka', trubka: { prurez: 'kruh', rozmer: 20, stenaTrubky: 1.5, styl: 'vnejsi' }, ramena: { tvar: 'rovinny', pocet: 5, sklon: -16 },
        spoj: { vule: 0.3, zasunuti: 30, stena: 3, odstup: 0, otvor: 4.5, skrz: false } } },
    { nazev: 'Latě 45×20 – hub kopule, 6 ramen', popis: 'sklon −10°, šroub M6 skrz lať',
      p: { typ: 'lat', lat: { sirka: 45, vyska: 20 }, ramena: { tvar: 'rovinny', pocet: 6, sklon: -10 },
        spoj: { vule: 0.5, zasunuti: 40, stena: 3, odstup: 0, otvor: 6.6, skrz: true } } },
    { nazev: 'Latě 40×40 – roh pergoly', popis: '2 vodorovné latě a sloupek, šrouby M8 skrz',
      p: { typ: 'lat', lat: { sirka: 40, vyska: 40 }, ramena: { tvar: 'roh3' },
        spoj: { vule: 0.5, zasunuti: 50, stena: 4, odstup: 0, otvor: 9, skrz: true } } },
  ];

  /* ---------- drobnosti ---------- */
  const kopie = o => JSON.parse(JSON.stringify(o));
  const cislo = (x, d) => { const n = typeof x === 'string' ? parseFloat(x.replace(/\s/g, '').replace(',', '.').replace('−', '-')) : Number(x); return Number.isFinite(n) ? n : d; };
  function fmt(x, des = 1) {
    if (!Number.isFinite(x)) return '–';
    let s = (Math.round(x * 10 ** des) / 10 ** des).toFixed(des);
    if (des > 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s.replace('-', '−').replace('.', ',');
  }
  const vezmi = (o, cesta) => cesta.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function poloz(o, cesta, h) { const k = cesta.split('.'); const l = k.pop(); k.reduce((a, x) => a[x], o)[l] = h; }
  const sl = (o, z) => { for (const k of Object.keys(z)) if (z[k] && typeof z[k] === 'object' && !Array.isArray(z[k]) && o[k] && typeof o[k] === 'object') sl(o[k], z[k]); else o[k] = z[k]; return o; };

  /** Doplní chybějící hodnoty, omezí rozsahy. Vrací {p, hlaseni: [texty o úpravách]}. */
  function normalizuj(vstup) {
    const p = kopie(VYCHOZI), hl = [];
    if (vstup && typeof vstup === 'object') sl(p, kopie(vstup));
    if (!TYPY[p.typ]) p.typ = 'profil';
    if (!PROFILY[p.profil.rada] && p.profil.rada !== 'vlastni') p.profil.rada = 'vlastni';
    if (!DRUHY[p.profil.druh]) p.profil.druh = 'uhelnik';
    if (!TVARY_PLOCHY[p.profil.tvar]) p.profil.tvar = 'L';
    if (!SROUBY[p.profil.sroub]) p.profil.sroub = 'M5';
    if (!['ctverec', 'kruh'].includes(p.trubka.prurez)) p.trubka.prurez = 'ctverec';
    if (!['vnejsi', 'vnitrni'].includes(p.trubka.styl)) p.trubka.styl = 'vnejsi';
    if (!TVARY_RAMEN[p.ramena.tvar]) p.ramena.tvar = 'L';
    if (!MATERIALY[p.tisk.material]) p.tisk.material = 'PETG';
    p.nazev = String(p.nazev == null ? '' : p.nazev).slice(0, 120);
    p.ramena.seznam = String(p.ramena.seznam || '').slice(0, 2000);
    p.tisk.orientace = String(p.tisk.orientace || 'auto').slice(0, 20);
    for (const k of ['zahloubeni', 'zebra', 'stredOtvor']) p.profil[k] = !!p.profil[k];
    p.spoj.skrz = !!p.spoj.skrz;
    for (const [c, [mn, mx]] of Object.entries(ROZSAHY)) {
      let h = cislo(vezmi(p, c), vezmi(VYCHOZI, c));
      if (h < mn || h > mx) { const o = Math.min(mx, Math.max(mn, h)); hl.push(`${c} ${fmt(h, 2)} → ${fmt(o, 2)}`); h = o; }
      poloz(p, c, h);
    }
    p.profil.otvoru = Math.round(p.profil.otvoru); p.ramena.pocet = Math.round(p.ramena.pocet); p.tisk.kusu = Math.round(p.tisk.kusu);
    return { p, hlaseni: hl };
  }
  /** Projekt z předvolby i (výchozí hodnoty + řada profilu + hodnoty předvolby). */
  function zPredvolby(i) {
    const v = PREDVOLBY[i], p = normalizuj({}).p;
    if (v.p.profil && v.p.profil.rada) nastavRadu(p, v.p.profil.rada);
    sl(p, kopie(v.p));
    p.nazev = v.nazev;
    return normalizuj(p).p;
  }
  /** Výběr řady profilu přepíše rozměry drážky. */
  function nastavRadu(p, rada) {
    p.profil.rada = rada;
    const r = PROFILY[rada]; if (!r) return;
    Object.assign(p.profil, { a: r.a, drazka: r.drazka, limec: r.limec, hloubka: r.hloubka, stred: r.stred, sroub: r.sroub });
    p.profil.vystupek = Math.round(Math.max(1, r.limec - 0.2) * 10) / 10;
  }

  /* ---------- vektory ---------- */
  const V = {
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: a => Math.hypot(a[0], a[1], a[2]),
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  };
  const RAD = Math.PI / 180;
  const smerZUhlu = (az, el) => [Math.cos(el * RAD) * Math.cos(az * RAD), Math.cos(el * RAD) * Math.sin(az * RAD), Math.sin(el * RAD)];
  /** Rám ramene: d = osa, u = „nahoru“ v průřezu (svislá rovina ramene), v = d × u. */
  function ramRamene(d) {
    let u = Math.abs(d[2]) < 0.999 ? V.sub([0, 0, 1], V.mul(d, d[2])) : V.sub([1, 0, 0], V.mul(d, d[0]));
    u = V.norm(u);
    return { d, u, v: V.cross(d, u) };
  }

  /** Úhly ramen [[azimut, sklon], …] ve stupních; chyby zápisu vlastního seznamu jdou do `chyby`. */
  function uhlyRamen(r, chyby = []) {
    const t = TVARY_RAMEN[r.tvar];
    if (t.smery) return t.smery.map(x => x.slice());
    if (r.tvar === 'rovinny') return Array.from({ length: r.pocet }, (_, i) => [360 * i / r.pocet, r.sklon]);
    const out = [];
    String(r.seznam).split(/\n/).forEach((radek, i) => {
      const s = radek.replace(/[;#].*$/, '').trim();
      if (!s) return;
      const c = s.split(/[\s,;]+/).filter(Boolean).map(x => cislo(x, NaN));
      if (c.length < 1 || c.length > 2 || c.some(x => !Number.isFinite(x))) { chyby.push(`řádek ${i + 1}: „${radek.trim()}“ – čekám „azimut sklon“`); return; }
      if (Math.abs(c[1] || 0) > 90) { chyby.push(`řádek ${i + 1}: sklon musí být −90 až 90°`); return; }
      out.push([c[0], c[1] || 0]);
    });
    return out;
  }

  /* ---------- průřezy a odvozené rozměry ---------- */
  // průřez: {typ: 'kruh', r} | {typ: 'obd', hu, hv} (poloviční rozměry ve směru u a v)
  const zvetsi = (s, k) => (s.typ === 'kruh' ? { typ: 'kruh', r: s.r + k } : { typ: 'obd', hu: s.hu + k, hv: s.hv + k });
  /** Opěrná funkce průřezu ramene ve směru m (jak daleko sahá kolmo k ose). */
  function oper(s, ram, m) {
    if (s.typ === 'kruh') { const a = V.dot(m, ram.d); return s.r * Math.sqrt(Math.max(0, 1 - a * a)); }
    return s.hu * Math.abs(V.dot(m, ram.u)) + s.hv * Math.abs(V.dot(m, ram.v));
  }
  const sirkaPr = s => (s.typ === 'kruh' ? 2 * s.r : 2 * Math.min(s.hu, s.hv));

  /** Odvozené rozměry uzlu z trubek nebo latí. */
  function odvozUzel(p, chyby) {
    const sp = p.spoj, uhly = uhlyRamen(p.ramena, chyby.zapis = []);
    let trubka, dutina, vnejsi, cep = null, cepDutina = null, styl;
    if (p.typ === 'lat') {
      styl = 'vnejsi';
      trubka = { typ: 'obd', hu: p.lat.vyska / 2, hv: p.lat.sirka / 2 };
    } else {
      styl = p.trubka.styl;
      const R = p.trubka.rozmer / 2;
      trubka = p.trubka.prurez === 'kruh' ? { typ: 'kruh', r: R } : { typ: 'obd', hu: R, hv: R };
    }
    if (styl === 'vnejsi') {
      dutina = zvetsi(trubka, sp.vule);
      vnejsi = zvetsi(dutina, sp.stena);
    } else {
      // čep do trubky: vnitřek trubky − vůle; rameno u středu má vnější rozměr trubky (lícuje s ní)
      cep = zvetsi(trubka, -p.trubka.stenaTrubky - sp.vule);
      const vn = zvetsi(cep, -sp.stena);
      cepDutina = sirkaPr(vn) >= 2 ? vn : null;
      dutina = zvetsi(trubka, Math.max(0, sp.vule));   // prostor, kam se nasune trubka (od dorazu ven)
      vnejsi = trubka;
    }
    const ramena = uhly.map(([az, el]) => Object.assign(ramRamene(smerZUhlu(az, el)), { az, el }));
    // odstup dorazu od středu: trubky dvou ramen se nesmí srazit (oddělí je rovina půlící úhel)
    const mezera = styl === 'vnejsi' ? sp.stena : 0.5;
    let potreba = sp.stena, kritickePary = [], minUhel = 180;
    for (let i = 0; i < ramena.length; i++) for (let j = i + 1; j < ramena.length; j++) {
      const a = ramena[i], b = ramena[j], c = Math.max(-1, Math.min(1, V.dot(a.d, b.d)));
      const uhel = Math.acos(c) / RAD;
      minUhel = Math.min(minUhel, uhel);
      const sinH = Math.sin(uhel / 2 * RAD);
      if (sinH < 1e-3) { kritickePary.push({ i, j, uhel, r: Infinity }); continue; }
      const m = V.norm(V.sub(b.d, a.d));
      const r = Math.max(oper(dutina, a, m), oper(dutina, b, V.mul(m, -1))) / sinH + mezera / 2 / sinH;
      if (r > potreba - 1e-9) kritickePary.push({ i, j, uhel, r });
      potreba = Math.max(potreba, r);
    }
    potreba = Math.ceil(potreba * 10 - 1e-6) / 10;
    const odstup = sp.odstup > 0 ? sp.odstup : potreba;
    kritickePary = kritickePary.filter(k => k.r >= potreba - 0.11).sort((a, b) => b.r - a.r);
    return { styl, trubka, dutina, vnejsi, cep, cepDutina, ramena, uhly, odstup, potreba, kritickePary, minUhel, mezera,
      L: sp.zasunuti, zkoseni: Math.min(0.8, sp.stena / 3) };
  }

  /** Polohy otvorů na rameni od x0 do x1 (n kusů rovnoměrně, jeden uprostřed). */
  function rozloz(n, x0, x1) {
    if (n <= 0) return [];
    if (n === 1) return [(x0 + x1) / 2];
    return Array.from({ length: n }, (_, i) => x0 + (x1 - x0) * i / (n - 1));
  }
  function odvozProfil(p) {
    const q = p.profil, s = SROUBY[q.sroub], a = q.a, t = q.tloustka, v = p.spoj.vule;
    const o = { a, t, sroub: s, otvor: s.otvor, hlava: s.hlava + 0.6, vyskaHlavy: s.vyska + 0.2, sirkaKlice: q.drazka - 2 * v,
      vyskaKlice: q.vystupek, delkaKlice: q.delkaVystupku, vule: v };
    if (q.druh === 'uhelnik') {
      o.x0 = t + o.hlava / 2 + 0.5;       // hlava šroubu nesmí narazit do druhého ramene
      o.x1 = q.delka - o.otvor / 2 - 2;
      o.otvory = rozloz(q.otvoru, o.x0, o.x1);
    } else if (q.druh === 'plocha') {
      o.x0 = a / 2 + o.hlava / 2 + 0.5;
      o.x1 = a / 2 + q.delka - o.otvor / 2 - 2;
      o.otvory = rozloz(q.otvoru, o.x0, o.x1);
      o.smery = { I: [[1, 0], [-1, 0]], L: [[1, 0], [0, 1]], T: [[1, 0], [-1, 0], [0, 1]], X: [[1, 0], [-1, 0], [0, 1], [0, -1]] }[q.tvar];
    } else if (q.druh === 'kostka') {
      // hlavy tří šroubů ve středu kostky: hlava osy X a díra osy Y se nesmí potkat → K/2 − stěna − hlava > poloměr díry
      o.minKostka = Math.ceil(2 * (t + o.vyskaHlavy + o.hlava / 2) + 0.5);
      o.K = q.kostka > 0 ? q.kostka : Math.max(a, o.minKostka);
      o.c = o.K / 2 - t;     // dno zahloubení (opěra hlavy)
    }
    return o;
  }
  function odvozene(p) {
    const chyby = {};
    if (p.typ === 'profil') return { profil: odvozProfil(p), druh: p.profil.druh };
    const u = odvozUzel(p, chyby);
    u.chybyZapisu = chyby.zapis;
    return u;
  }

  /* ---------- kontroly zadání ---------- */
  function kontroly(p, o) {
    const H = [], pridej = (uroven, text, pole = [], oprava) => H.push({ uroven, text, pole: [].concat(pole), oprava });
    const sp = p.spoj;
    if (p.typ === 'profil') {
      const q = p.profil, r = o.profil, s = r.sroub;
      if (r.sirkaKlice < 1) pridej('chyba', `Výstupek do drážky by měl šířku ${fmt(r.sirkaKlice, 2)} mm – drážka je na vůli úzká.`, ['profil.drazka', 'spoj.vule']);
      if (q.vystupek > 0 && (q.druh === 'uhelnik' || q.druh === 'plocha') && q.vystupek > q.limec + 0.05)
        pridej('varovani', `Výstupek ${fmt(q.vystupek, 2)} mm je vyšší než límec drážky ${fmt(q.limec, 2)} mm – zasáhne pod límec, kde sedí T-matice.`, 'profil.vystupek',
          { pole: 'profil.vystupek', hodnota: Math.round((q.limec - 0.2) * 10) / 10, text: `výstupek ${fmt(q.limec - 0.2)} mm` });
      if (q.vystupek > q.hloubka) pridej('chyba', `Výstupek ${fmt(q.vystupek)} mm je hlubší než drážka (${fmt(q.hloubka)} mm).`, 'profil.vystupek');
      if (q.druh !== 'kostka' && q.druh !== 'krytka' && s.d >= q.drazka)
        pridej('chyba', `Šroub ${q.sroub} neprojde drážkou širokou ${fmt(q.drazka)} mm – zvolte menší šroub.`, 'profil.sroub');
      if (q.tloustka < 2.4) pridej('varovani', `Tloušťka ${fmt(q.tloustka)} mm je tenká – spojka se bude prohýbat (doporučeno ≥ 3 mm).`, 'profil.tloustka');
      if (r.otvory && r.otvory.length && r.x1 < r.x0 - 1e-9) {
        const d = Math.ceil((q.delka + r.x0 - r.x1) * 2) / 2;
        pridej('chyba', `Na rameni délky ${fmt(q.delka)} mm se otvor nevejde (hlava šroubu potřebuje odstup od rohu) – prodlužte rameno na ≥ ${fmt(d)} mm.`, 'profil.delka',
          { pole: 'profil.delka', hodnota: d, text: `délka ${fmt(d)} mm` });
      }
      if (r.otvory && r.otvory.length > 1 && (r.x1 - r.x0) / (r.otvory.length - 1) < r.hlava + 1)
        pridej('chyba', `Otvory na rameni jsou příliš blízko (rozteč ${fmt((r.x1 - r.x0) / (r.otvory.length - 1))} mm) – hlavy šroubů ${fmt(s.hlava)} mm se nevejdou vedle sebe.`, ['profil.otvoru', 'profil.delka']);
      if (q.druh === 'uhelnik' && q.zebra && q.otvoru > 0 && r.hlava > q.a - 2 * q.zebro)
        pridej('chyba', `Hlava šroubu (${fmt(s.hlava)} mm) se mezi boční žebra nevejde – zeslabte žebra nebo vypněte.`, ['profil.zebro', 'profil.zebra']);
      if (q.zahloubeni && (q.druh === 'uhelnik' || q.druh === 'plocha') && q.otvoru > 0 && q.tloustka - r.vyskaHlavy < 2) {
        const t = Math.ceil(r.vyskaHlavy + 2);
        pridej('chyba', `Na zahloubení hlavy (${fmt(r.vyskaHlavy)} mm) nestačí tloušťka ${fmt(q.tloustka)} mm – pod hlavou musí zůstat aspoň 2 mm.`, ['profil.tloustka', 'profil.zahloubeni'],
          { pole: 'profil.tloustka', hodnota: t, text: `tloušťka ${t} mm` });
      }
      if (q.druh === 'kostka') {
        if (r.K < r.minKostka) pridej('chyba', `Hlavy tří šroubů ${q.sroub} se uprostřed kostky ${fmt(r.K)} mm srazí – kostka musí mít hranu ≥ ${r.minKostka} mm (nebo zeslabte stěnu pod hlavou).`,
          ['profil.kostka', 'profil.tloustka'], { pole: 'profil.kostka', hodnota: r.minKostka, text: `hrana ${r.minKostka} mm` });
        if (r.K < q.a) pridej('chyba', `Kostka ${fmt(r.K)} mm je menší než profil ${fmt(q.a)} mm.`, 'profil.kostka');
        if (q.tloustka < 3) pridej('varovani', `Stěna pod hlavou šroubu ${fmt(q.tloustka)} mm – při dotažení se může protlačit (doporučeno ≥ 3 mm).`, 'profil.tloustka');
        if (r.K > q.a + 0.01) pridej('info', `Kostka má hranu ${fmt(r.K)} mm – přesahuje profil ${fmt(q.a)} mm o ${fmt((r.K - q.a) / 2)} mm na každou stranu (místo pro hlavy šroubů).`, 'profil.kostka');
        if (q.stred > 0 && s.d * 0.85 > q.stred + 0.5) pridej('varovani', `Šroub ${q.sroub} je na středový otvor profilu Ø ${fmt(q.stred)} mm velký – závit se do něj nevyřízne.`, ['profil.sroub', 'profil.stred']);
      }
      if (q.druh === 'krytka' && q.stredOtvor && q.stred > 0 && s.d * 0.85 > q.stred + 0.5)
        pridej('varovani', `Šroub ${q.sroub} je na středový otvor profilu Ø ${fmt(q.stred)} mm velký.`, ['profil.sroub', 'profil.stred']);
      if (sp.vule < 0) pridej('varovani', 'Záporná vůle = přesah: výstupky půjdou do drážky ztuha, nejspíš je bude třeba zatlouct.', 'spoj.vule');
      return H;
    }
    // trubky a latě
    for (const z of o.chybyZapisu || []) pridej('chyba', 'Vlastní úhly ramen – ' + z, 'ramena.seznam');
    const n = o.ramena.length;
    if (n < 1) { pridej('chyba', 'Spojka nemá žádné rameno – zadejte úhly ramen.', 'ramena.seznam'); return H; }
    if (n > 12) pridej('chyba', `Ramen je ${n} – víc než 12 se do uzlu rozumně nevejde.`, 'ramena.seznam');
    const roz = sirkaPr(o.styl === 'vnejsi' ? zvetsi(o.dutina, -sp.vule) : o.trubka);
    const rozMax = o.trubka.typ === 'kruh' ? 2 * o.trubka.r : 2 * Math.max(o.trubka.hu, o.trubka.hv);
    if (o.minUhel < 1) pridej('chyba', 'Dvě ramena míří stejným směrem – zkontrolujte úhly.', ['ramena.seznam', 'ramena.pocet']);
    else if (o.minUhel < 12) pridej('chyba', `Ramena svírají jen ${fmt(o.minUhel)}° – trubky by se srazily daleko od středu, spojka nedává smysl.`, ['ramena.seznam', 'ramena.sklon']);
    if (sp.odstup > 0 && sp.odstup < o.potreba - 0.05) {
      const k = o.kritickePary[0];
      pridej('chyba', `Odstup dorazu ${fmt(sp.odstup)} mm je malý: ${k ? `ramena ${k.i + 1} a ${k.j + 1} (úhel ${fmt(k.uhel)}°)` : 'ramena'} by se srazila – potřeba ≥ ${fmt(o.potreba)} mm.`, 'spoj.odstup',
        { pole: 'spoj.odstup', hodnota: 0, text: 'odstup automaticky' });
    } else if (o.minUhel >= 12 && o.minUhel < 60 && o.potreba > 1.5 * rozMax && o.kritickePary.length) {
      const k = o.kritickePary[0];
      pridej('varovani', `Ramena ${k.i + 1} a ${k.j + 1} svírají ${fmt(k.uhel)}° – aby se trubky nesrazily, začínají objímky ${fmt(o.potreba)} mm od středu (uzel je velký).`, ['ramena.seznam', 'ramena.sklon', 'ramena.pocet']);
    }
    if (o.styl === 'vnejsi') {
      if (sp.stena < 0.8) pridej('chyba', `Stěna ${fmt(sp.stena, 2)} mm se nevytiskne (minimum ≈ 2 obvodové stopy, 0,8 mm).`, 'spoj.stena');
      else if (sp.stena < 1.6) pridej('varovani', `Stěna objímky ${fmt(sp.stena, 2)} mm je tenká – praskne při dotažení šroubu (doporučeno ≥ 2 mm).`, 'spoj.stena');
    } else {
      if (sirkaPr(o.cep) < 2) pridej('chyba', 'Čep do trubky by měl nulovou tloušťku – stěna trubky nebo vůle jsou na její rozměr příliš velké.', ['trubka.stenaTrubky', 'spoj.vule']);
      if (p.trubka.stenaTrubky * 2 >= p.trubka.rozmer) pridej('chyba', 'Stěna trubky je silnější než polovina rozměru.', 'trubka.stenaTrubky');
      if (sp.stena < 0.8 && o.cepDutina) pridej('chyba', `Stěna čepu ${fmt(sp.stena, 2)} mm se nevytiskne.`, 'spoj.stena');
      if (!o.cepDutina && o.cep && sirkaPr(o.cep) > 2) pridej('info', 'Čep je plný (na dutinu by nezbyla stěna).', 'spoj.stena');
    }
    if (sp.zasunuti < 0.8 * roz) pridej('varovani', `Zasunutí ${fmt(sp.zasunuti)} mm je na průřez ${fmt(roz)} mm krátké – spoj se bude viklat (doporučeno ≥ 1× rozměr).`, 'spoj.zasunuti',
      { pole: 'spoj.zasunuti', hodnota: Math.ceil(roz), text: `zasunutí ${Math.ceil(roz)} mm` });
    if (sp.otvor > 0) {
      const sir = sirkaPr(o.styl === 'vnejsi' ? o.dutina : o.cep);
      if (sp.otvor > sp.zasunuti - 4) pridej('chyba', `Otvor Ø ${fmt(sp.otvor)} mm je na zasunutí ${fmt(sp.zasunuti)} mm velký.`, ['spoj.otvor', 'spoj.zasunuti']);
      if (sp.otvor > sir * 0.6) pridej('chyba', `Otvor Ø ${fmt(sp.otvor)} mm je na průřez ${fmt(sir)} mm příliš velký.`, 'spoj.otvor');
    }
    if (o.styl === 'vnejsi' && sp.vule > 0.8) pridej('varovani', `Vůle ${fmt(sp.vule, 2)} mm na straně je velká – spoj bude volný, drží jen šroub.`, 'spoj.vule');
    if (o.styl === 'vnitrni' && sp.vule < 0) pridej('varovani', 'Záporná vůle = lisovaný spoj: čep půjde do trubky ztuha, může prasknout.', 'spoj.vule');
    return H;
  }

  /* ---------- rozbor tisku na síti ---------- */
  /** Rotace, která převede směr `a` na −Z (díl leží na podložce tou stranou, kam míří a). */
  function rotaceDolu(a) {
    a = V.norm(a);
    const b = [0, 0, -1], c = V.dot(a, b);
    if (c > 1 - 1e-9) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    if (c < -1 + 1e-9) return [1, 0, 0, 0, -1, 0, 0, 0, -1];
    const k = V.norm(V.cross(a, b)), s = Math.sqrt(1 - c * c), t = 1 - c;
    // Rodriguesův vzorec, řádky matice
    return [
      t * k[0] * k[0] + c, t * k[0] * k[1] - s * k[2], t * k[0] * k[2] + s * k[1],
      t * k[0] * k[1] + s * k[2], t * k[1] * k[1] + c, t * k[1] * k[2] - s * k[0],
      t * k[0] * k[2] - s * k[1], t * k[1] * k[2] + s * k[0], t * k[2] * k[2] + c,
    ];
  }
  function otoc(poz, R) {
    const out = new Float32Array(poz.length);
    for (let i = 0; i < poz.length; i += 3) {
      const x = poz[i], y = poz[i + 1], z = poz[i + 2];
      out[i] = R[0] * x + R[1] * y + R[2] * z; out[i + 1] = R[3] * x + R[4] * y + R[5] * z; out[i + 2] = R[6] * x + R[7] * y + R[8] * z;
    }
    return out;
  }
  /** Postaví tiskovou polohu: otočení R a posun tak, aby díl stál na z = 0 a byl vystředěný v XY. */
  function tiskovaPoloha(sit, R) {
    const poz = otoc(sit.poz, R);
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < poz.length; i += 3) for (let k = 0; k < 3; k++) { const v = poz[i + k]; if (v < b[k]) b[k] = v; if (v > b[k + 3]) b[k + 3] = v; }
    const posun = [-(b[0] + b[3]) / 2, -(b[1] + b[4]) / 2, -b[2]];
    for (let i = 0; i < poz.length; i += 3) { poz[i] += posun[0]; poz[i + 1] += posun[1]; poz[i + 2] += posun[2]; }
    return { poz, idx: sit.idx, R, posun };
  }

  /** Převisy v dané poloze: trojúhelník mířící dolů víc než `limit` od svislice je
     – „na podložce“ (leží do 0,25 mm nad ní),
     – „most“ (pod ním je materiál dílu – strop dutiny, otvor; tiskárna ho přemostí),
     – „volný“ (pod ním nic až na podložku – bez podpor se nevytiskne).
     Vrací plochy v mm² a třídu každého trojúhelníku (0 nic, 1 most, 2 volný, 3 podložka). */
  function previsy(poz, idx, limit = 45) {
    const nT = idx.length / 3, tr = new Uint8Array(nT), sinL = Math.sin(limit * RAD), sinS = Math.sin(Math.min(89, limit + 15) * RAD);
    let zmin = Infinity, zmax = -Infinity, xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (let i = 0; i < poz.length; i += 3) {
      if (poz[i + 2] < zmin) zmin = poz[i + 2]; if (poz[i + 2] > zmax) zmax = poz[i + 2];
      if (poz[i] < xmin) xmin = poz[i]; if (poz[i] > xmax) xmax = poz[i];
      if (poz[i + 1] < ymin) ymin = poz[i + 1]; if (poz[i + 1] > ymax) ymax = poz[i + 1];
    }
    // mřížka XY pro paprsky dolů
    const N = Math.max(8, Math.min(96, Math.ceil(Math.sqrt(nT / 4)))), sx = (xmax - xmin) / N || 1, sy = (ymax - ymin) / N || 1;
    const bunky = Array.from({ length: N * N }, () => []);
    const bx = i => Math.max(0, Math.min(N - 1, Math.floor((i - xmin) / sx))), by = i => Math.max(0, Math.min(N - 1, Math.floor((i - ymin) / sy)));
    for (let t = 0; t < nT; t++) {
      const a = 3 * idx[3 * t], b = 3 * idx[3 * t + 1], c = 3 * idx[3 * t + 2];
      const x0 = bx(Math.min(poz[a], poz[b], poz[c])), x1 = bx(Math.max(poz[a], poz[b], poz[c]));
      const y0 = by(Math.min(poz[a + 1], poz[b + 1], poz[c + 1])), y1 = by(Math.max(poz[a + 1], poz[b + 1], poz[c + 1]));
      for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) bunky[i * N + j].push(t);
    }
    function podNim(px, py, pz, ja) {
      for (const t of bunky[bx(px) * N + by(py)]) {
        if (t === ja) continue;
        const a = 3 * idx[3 * t], b = 3 * idx[3 * t + 1], c = 3 * idx[3 * t + 2];
        const ax = poz[a], ay = poz[a + 1], bx_ = poz[b] - ax, by_ = poz[b + 1] - ay, cx = poz[c] - ax, cy = poz[c + 1] - ay;
        const det = bx_ * cy - by_ * cx;
        if (Math.abs(det) < 1e-12) continue;
        const qx = px - ax, qy = py - ay, u = (qx * cy - qy * cx) / det, v = (bx_ * qy - by_ * qx) / det;
        if (u < -1e-7 || v < -1e-7 || u + v > 1 + 1e-7) continue;
        const z = poz[a + 2] + u * (poz[b + 2] - poz[a + 2]) + v * (poz[c + 2] - poz[a + 2]);
        if (z < pz - 0.02) return true;
      }
      return false;
    }
    let volne = 0, strme = 0, most = 0, podlozka = 0;
    for (let t = 0; t < nT; t++) {
      const a = 3 * idx[3 * t], b = 3 * idx[3 * t + 1], c = 3 * idx[3 * t + 2];
      const ux = poz[b] - poz[a], uy = poz[b + 1] - poz[a + 1], uz = poz[b + 2] - poz[a + 2];
      const vx = poz[c] - poz[a], vy = poz[c + 1] - poz[a + 1], vz = poz[c + 2] - poz[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
      if (l < 1e-12) continue;
      const A = l / 2, zc = -nz / l;
      if (zc <= sinL) continue;
      if (Math.max(poz[a + 2], poz[b + 2], poz[c + 2]) < zmin + 0.25) { tr[t] = 3; podlozka += zc > 0.999 ? A : 0; continue; }
      const px = (poz[a] + poz[b] + poz[c]) / 3, py = (poz[a + 1] + poz[b + 1] + poz[c + 1]) / 3, pz = (poz[a + 2] + poz[b + 2] + poz[c + 2]) / 3;
      if (podNim(px, py, pz, t)) { tr[t] = 1; most += A; } else { tr[t] = 2; volne += A; if (zc > sinS) strme += A; }
    }
    return { volne, strme, most, podlozka, vyska: zmax - zmin, tridy: tr };
  }

  /** Kandidáti orientace: osy, směry ramen (rameno dolů / nahoru), u kostky roh dolů. */
  function kandidatiOrientace(p, o) {
    const k = [
      { klic: '-Z', nazev: 'dolní strana dolů (jak je kreslena)', dolu: [0, 0, -1] },
      { klic: '+Z', nazev: 'horní strana dolů (převrátit)', dolu: [0, 0, 1] },
      { klic: '-Y', nazev: 'bokem −Y dolů', dolu: [0, -1, 0] }, { klic: '+Y', nazev: 'bokem +Y dolů', dolu: [0, 1, 0] },
      { klic: '-X', nazev: 'bokem −X dolů', dolu: [-1, 0, 0] }, { klic: '+X', nazev: 'bokem +X dolů', dolu: [1, 0, 0] },
    ];
    if (p.typ === 'profil' && p.profil.druh === 'kostka') k.push({ klic: 'roh', nazev: 'na seříznutém rohu (osy ramen šikmo nahoru)', dolu: V.norm([-1, -1, -1]) });
    if (o.ramena && o.ramena.some(r => Math.abs(r.d[2]) > 0.5)) for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1])
      k.push({ klic: `u${sx < 0 ? '-' : '+'}${sy < 0 ? '-' : '+'}${sz < 0 ? '-' : '+'}`, nazev: `na rohu (${sx < 0 ? '−' : '+'}X ${sy < 0 ? '−' : '+'}Y ${sz < 0 ? '−' : '+'}Z dolů)`, dolu: V.norm([sx, sy, sz]) });
    if (o.ramena) o.ramena.forEach((r, i) => {
      if (Math.abs(r.d[2]) > 0.999 || Math.abs(r.d[0]) > 0.999 || Math.abs(r.d[1]) > 0.999) return;   // shodné s osou
      k.push({ klic: 'r' + (i + 1) + 'n', nazev: `rameno ${i + 1} svisle nahoru`, dolu: V.mul(r.d, -1) });
      k.push({ klic: 'r' + (i + 1) + 'd', nazev: `rameno ${i + 1} svisle dolů`, dolu: r.d });
    });
    if (o.ramena && o.ramena.length >= 3) {
      // spojnice konců ramen: díl na „trojnožce“ – osa kolmá na rovinu prvních tří ramen
      const nn = V.cross(V.sub(o.ramena[1].d, o.ramena[0].d), V.sub(o.ramena[2].d, o.ramena[0].d));
      if (V.len(nn) > 1e-6) {
        const n1 = V.norm(nn), s = o.ramena.reduce((a, r) => a + V.dot(r.d, n1), 0) >= 0 ? 1 : -1;
        k.push({ klic: 'stred', nazev: 'ramena šikmo nahoru (osa uzlu svisle)', dolu: V.mul(n1, -s) });
      }
    }
    return k;
  }
  /** Ohodnotí orientace, vrátí seřazené (nejlepší první) i vybranou podle p.tisk.orientace. */
  function rozborTisku(sit, p, o) {
    const kand = kandidatiOrientace(p, o), lim = p.tisk.previs, vysl = [];
    for (const k of kand) {
      const R = rotaceDolu(k.dolu), poloha = tiskovaPoloha(sit, R), pv = previsy(poloha.poz, sit.idx, lim);
      const skore = pv.volne * 5 + pv.strme * 20 + pv.most * 0.3 + pv.vyska * 0.5 - Math.min(pv.podlozka, 150) * 0.2 + (pv.podlozka < 20 ? 10000 : 0);
      vysl.push(Object.assign({}, k, { R, volne: pv.volne, strme: pv.strme, most: pv.most, podlozka: pv.podlozka, vyska: pv.vyska, skore }));
    }
    vysl.sort((a, b) => a.skore - b.skore);
    const vybrana = vysl.find(v => v.klic === p.tisk.orientace) || vysl[0];
    return { kandidati: vysl, nejlepsi: vysl[0], vybrana };
  }

  /** Potřebuje orientace podpory? Drobné převisy do limitu + 15° (okraje otvorů) se tolerují. */
  const potrebujePodpory = (v, plocha) => v.volne > 2 && !(v.strme < 2 && v.volne < 0.04 * plocha);
  /** Kontroly tisku pro vybranou orientaci (doplní hlášení). */
  function kontrolyTisku(p, o, rozbor, plocha) {
    const H = [], v = rozbor.vybrana, best = rozbor.nejlepsi;
    if (v.volne > 2 && !potrebujePodpory(v, plocha)) {
      H.push({ uroven: 'info', text: `V orientaci „${v.nazev}“ zbývá ${fmt(v.volne, 0)} mm² mírných převisů (do ${fmt(p.tisk.previs + 15, 0)}°, okraje otvorů a výstupků) – obvykle se vytisknou bez podpor.`, pole: ['tisk.orientace'] });
    } else if (v.volne > 2) {
      const lepsi = best !== v && best.volne + 4 * best.strme < 0.5 * (v.volne + 4 * v.strme);
      H.push({ uroven: 'varovani', text: `V orientaci „${v.nazev}“ visí ${fmt(v.volne, 0)} mm² povrchu nad ${fmt(p.tisk.previs, 0)}° bez opory – tiskněte s podporami od podložky.`
        + (lepsi ? ` Méně převisů má „${best.nazev}“ (${fmt(best.volne, 0)} mm²).` : ''), pole: ['tisk.orientace'],
        oprava: lepsi ? { pole: 'tisk.orientace', hodnota: best.klic, text: 'použít lepší orientaci' } : undefined });
    } else H.push({ uroven: 'ok', text: `Tiskne se bez podpor – orientace „${v.nazev}“, výška ${fmt(v.vyska)} mm.`, pole: ['tisk.orientace'] });
    if (v.podlozka < 15) H.push({ uroven: 'varovani', text: `Na podložce leží jen ${fmt(v.podlozka, 0)} mm² – přidejte límec (brim), jinak se díl utrhne.`, pole: ['tisk.orientace'] });
    // mosty: stropy vodorovných dutin
    if (o.ramena && o.styl === 'vnejsi') {
      const R = v.R, nahoru = [R[6], R[7], R[8]];   // osa Z tiskové polohy v souřadnicích dílu
      o.ramena.forEach((r, i) => {
        const dz = V.dot(r.d, nahoru);
        if (Math.abs(dz) > 0.26) return;
        const h = V.norm(V.cross(nahoru, r.d));
        const rozpeti = o.dutina.typ === 'kruh' ? o.dutina.r * Math.SQRT2 : 2 * oper(o.dutina, r, h);
        if (p.tisk.most > 0 && rozpeti > p.tisk.most)
          H.push({ uroven: 'varovani', text: `Strop objímky ramene ${i + 1} je most ${fmt(rozpeti)} mm – víc než zvládnete (${fmt(p.tisk.most)} mm); zkuste jinou orientaci nebo podpory uvnitř.`, pole: ['tisk.most', 'tisk.orientace'] });
      });
    }
    return H;
  }

  /* ---------- odhady ---------- */
  /** Hmotnost a čas: obvod 1,2 mm + výplň, průtok ~ 7 mm³/s a 1,5 s na vrstvu 0,2 mm. Hrubý odhad. */
  function odhadTisku(objem, plocha, vyska, p) {
    const mat = MATERIALY[p.tisk.material];
    const plast = Math.min(objem, plocha * 1.2), vypln = Math.max(0, objem - plast) * p.tisk.vypln / 100;
    const V3 = plast + vypln, gramy = V3 / 1000 * mat.hustota;
    const metru = V3 / (Math.PI * 0.875 * 0.875) / 1000;
    const minut = (V3 / 7 + vyska / 0.2 * 1.5) / 60 * 1.1;
    return { gramy, metru, minut, plny: objem / 1000 * mat.hustota };
  }
  const delkaSroubu = (min, max) => DELKY_SROUBU.find(d => d >= min && d <= max) || null;
  /** Kusovník šroubů a matic na jednu spojku. */
  function kusovnik(p, o) {
    const out = [];
    if (p.typ === 'profil') {
      const q = p.profil, r = o.profil, s = q.sroub;
      if (q.druh === 'uhelnik' || q.druh === 'plocha') {
        const ramen = q.druh === 'uhelnik' ? 2 : r.smery.length, n = ramen * r.otvory.length;
        if (n) {
          const sev = q.tloustka - (q.zahloubeni ? r.vyskaHlavy : 0);
          const d = delkaSroubu(sev + q.limec + 2.5, sev + q.hloubka);
          out.push({ ks: n, co: `Šroub ${s}${d ? '×' + d : ''} s válcovou hlavou (ISO 4762) nebo půlkulatou (ISO 7380)`,
            pozn: d ? `sevřeno ${fmt(sev)} mm, do drážky ${fmt(d - sev)} mm` : `délku nelze vybrat: ${fmt(sev + q.limec + 2.5)}–${fmt(sev + q.hloubka)} mm`, chyba: !d });
          out.push({ ks: n, co: `T-matice ${s} do drážky ${fmt(q.drazka)} mm`, pozn: 'vsuvná nebo otočná (vkládá se i do hotového rámu)' });
        }
      } else if (q.druh === 'krytka') {
        if (q.stredOtvor) out.push({ ks: 1, co: `Šroub ${s}×${delkaSroubu(q.tloustka + 6, 999) || 10} do závitu ve středovém otvoru`, pozn: `závit vyříznout do Ø ${fmt(q.stred)} mm` });
      } else if (q.druh === 'kostka') {
        const d = delkaSroubu(q.tloustka + 10, q.tloustka + 30);
        out.push({ ks: 3, co: `Šroub ${s}×${d || '?'} s válcovou hlavou (ISO 4762)`, pozn: `stěna ${fmt(q.tloustka)} mm + ≈ 10 mm v závitu středového otvoru Ø ${fmt(q.stred)}` });
      }
      return out;
    }
    const sp = p.spoj, n = o.ramena.length;
    if (sp.otvor > 0) {
      const m = Object.entries(SROUBY).filter(([, s]) => s.otvor <= sp.otvor + 0.15).pop();
      if (sp.skrz && o.styl === 'vnejsi') {
        const tl = 2 * (o.dutina.typ === 'kruh' ? o.dutina.r : o.dutina.hu) + 2 * sp.stena;
        const d = delkaSroubu(tl + (m ? m[1].d : 5) + 3, 999);
        out.push({ ks: n, co: m ? `Šroub ${m[0]}×${d || '?'} skrz ${p.typ === 'lat' ? 'lať' : 'trubku'} + podložky + matice (samojistná)` : `Šroub Ø < ${fmt(sp.otvor)} mm skrz + matice`,
          pozn: `přes spojku ${fmt(tl)} mm; otvor do ${p.typ === 'lat' ? 'latě vyvrtejte' : 'trubky vyvrtejte'} skrz oba otvory spojky` });
      } else {
        const zavit = Math.round(sp.otvor / 0.8 * 2) / 2;
        out.push({ ks: n, co: `Pojistný šroub ≈ Ø ${fmt(zavit)} mm (samořezný do plastu) nebo ${m ? m[0] : 'M?'} s maticí`,
          pozn: o.styl === 'vnejsi' ? 'přes objímku do vyvrtané trubky / jako zajišťovací' : `skrz stěnu trubky do čepu (otvor v čepu Ø ${fmt(sp.otvor)} = předvrtání)` });
      }
    }
    return out;
  }

  /* ---------- projekt ---------- */
  function ulozProjekt(p) {
    return JSON.stringify({ format: 'webapp_spojky', verze: VERZE_FORMATU, ulozeno: new Date().toISOString(), projekt: p }, null, 2);
  }
  function nactiProjekt(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
    if (!o || typeof o !== 'object') throw new Error('Soubor neobsahuje projekt.');
    if (o.format !== 'webapp_spojky') throw new Error('Soubor není projekt spojky (chybí "format": "webapp_spojky").');
    if (!(o.verze >= 1) || o.verze > VERZE_FORMATU) throw new Error(`Nepodporovaná verze projektu ${o.verze}.`);
    return normalizuj(o.projekt);
  }
  /** Krátký popis pro seznam uložených nastavení a souhrny. */
  function popis(p) {
    if (p.typ === 'profil') {
      const q = p.profil;
      return `${q.rada === 'vlastni' ? fmt(q.a) + ' mm' : q.rada} – ${DRUHY[q.druh].toLowerCase()}${q.druh === 'plocha' ? ' ' + q.tvar : ''}, ${q.sroub}`;
    }
    const ch = [], n = uhlyRamen(p.ramena, ch).length;
    const pr = p.typ === 'lat' ? `lať ${fmt(p.lat.sirka)}×${fmt(p.lat.vyska)}` : (p.trubka.prurez === 'kruh' ? `Ø ${fmt(p.trubka.rozmer)}` : `□ ${fmt(p.trubka.rozmer)}`);
    return `${pr} – ${n} ramen${n === 1 ? 'o' : n < 5 ? 'a' : ''} (${TVARY_RAMEN[p.ramena.tvar].nazev.split(' – ')[0]})${p.typ === 'trubka' ? ', ' + (p.trubka.styl === 'vnejsi' ? 'objímka' : 'čep') : ''}`;
  }

  const API = {
    VERZE_FORMATU, PROFILY, SROUBY, MATERIALY, TYPY, DRUHY, TVARY_PLOCHY, TVARY_RAMEN, VYCHOZI, ROZSAHY, PREDVOLBY, DELKY_SROUBU,
    kopie, cislo, fmt, vezmi, poloz, normalizuj, nastavRadu, zPredvolby, V, smerZUhlu, ramRamene, uhlyRamen, zvetsi, oper, sirkaPr,
    odvozene, kontroly, rotaceDolu, otoc, tiskovaPoloha, previsy, kandidatiOrientace, rozborTisku, kontrolyTisku, potrebujePodpory,
    odhadTisku, kusovnik, ulozProjekt, nactiProjekt, popis,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.SPOJKY = API;
})();

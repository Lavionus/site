/* Kabelové průchodky a organizéry – jádro bez DOM (běží i v node).
   Parametry, předvolby, normalizace, odvozené rozměry, pružné části (protažení při zacvaknutí),
   kontroly, odhad tisku, rozložení na podložku a projekt JSON. Geometrie je v geometrie.js (manifold-3d).
   Délky v mm, úhly ve stupních. */
(function () {
  'use strict';
  const VERZE_FORMATU = 1;

  const TYPY = {
    pruchodka: { nazev: 'Průchodka do stolu', kratce: 'Do stolu', znak: '⭕' },
    klip: { nazev: 'Klip na hranu desky', kratce: 'Klip', znak: '📎' },
    hreben: { nazev: 'Hřebínek kabelů', kratce: 'Hřebínek', znak: '🪮' },
    drzak: { nazev: 'Držák pod stůl', kratce: 'Pod stůl', znak: '🪝' },
    zed: { nazev: 'Průchodka do zdi / krabice', kratce: 'Do zdi', znak: '🔘' },
  };

  /* Protažení: dov = opakované zacvaknutí bez trvalé deformace, mez = hrozí prasknutí (tištěný díl podél vrstev).
     Napříč vrstvami se počítá s polovinou. Hrubé hodnoty z tabulek výrobců a zkušeností s tiskem (10/2026). */
  const MATERIALY = {
    pla: { nazev: 'PLA', hustota: 1.24, E: 3500, dov: 0.02, mez: 0.04 },
    petg: { nazev: 'PETG', hustota: 1.27, E: 2100, dov: 0.035, mez: 0.07 },
    asa: { nazev: 'ASA / ABS', hustota: 1.07, E: 2000, dov: 0.03, mez: 0.06 },
    tpu: { nazev: 'TPU 95A (pružný)', hustota: 1.21, E: 30, dov: 0.3, mez: 1.5 },
  };
  const NAPRIC_VRSTVAMI = 0.5;
  const SPARA = 1.0;          // šířka prořezu mezi pružnými prsty
  const STERBINA = 0.5;       // šířka štěrbiny mezi plátky membrány

  const VYCHOZI = {
    nazev: 'Průchodka',
    typ: 'pruchodka',
    material: 'petg',
    tisk: { tryska: 0.4, vrstva: 0.2, kusu: 1, poloha: 'bok' },
    kabely: { seznam: [6, 6, 8], vule: 0.3, pomer: 0.9, stena: 1.4 },
    sroub: { prumer: 3.5, hlava: 7 },
    pruchodka: {
      otvor: 60, vuleOtvor: 0.4, hloubka: 16, stena: 2, limec: 7, limecTl: 2.4,
      viko: { zpusob: 'otocne', tl: 2.4, lem: 6, lemTl: 1.6, vule: 0.3, vybraniSirka: 22, vybraniHloubka: 16, vybrani: 1, prstu: 6, zobacek: 0.6 },
    },
    klip: { deska: 18, vule: 0.4, hloubka: 22, celist: 3, sevreni: 0.8, sirka: 12 },
    hreben: { zakladna: 3, sirka: 12, uchyceni: 'sroub' },
    drzak: { tvar: 'hacek', svazek: 24, vyska: 20, stena: 3, deska: 4, delka: 20, vstup: 7, sroubu: 1 },
    zed: { uchyceni: 'zasunuti', otvor: 16, vuleOtvor: 0.3, panel: 2, delka: 20, stena: 1.6, limec: 3, limecTl: 2, membrana: 0.6, platku: 6, prstu: 4, zobacek: 0.6 },
  };

  const PREDVOLBY = [
    { nazev: 'Průchodka ⌀ 60 – otočné víčko', popis: 'běžný vrták 60 mm, deska stolu', p: { typ: 'pruchodka', nazev: 'Průchodka 60', material: 'petg',
      pruchodka: { otvor: 60, hloubka: 16, limec: 7, viko: { zpusob: 'otocne', vybraniSirka: 22, vybraniHloubka: 16, vybrani: 1 } } } },
    { nazev: 'Průchodka ⌀ 80 – zacvakávací víčko', popis: 'dvě vybrání, víčko drží v drážce', p: { typ: 'pruchodka', nazev: 'Průchodka 80', material: 'petg',
      pruchodka: { otvor: 80, hloubka: 18, limec: 8, viko: { zpusob: 'zasouvaci', vybraniSirka: 26, vybraniHloubka: 18, vybrani: 2, prstu: 8, lem: 8, zobacek: 0.6 } } } },
    { nazev: 'Průchodka ⌀ 35 – malá', popis: 'jeden napájecí kabel, PLA', p: { typ: 'pruchodka', nazev: 'Průchodka 35', material: 'pla',
      pruchodka: { otvor: 35, hloubka: 14, limec: 5, stena: 1.8, viko: { zpusob: 'otocne', vybraniSirka: 12, vybraniHloubka: 10, vybrani: 1 } } } },
    { nazev: 'Klip na desku 18 mm – 2 kabely', popis: 'napájení monitoru a USB pod hranou stolu', p: { typ: 'klip', nazev: 'Klip 18', material: 'petg',
      kabely: { seznam: [7, 5], pomer: 0.9, stena: 1.4 }, klip: { deska: 18, hloubka: 22, sirka: 12 } } },
    { nazev: 'Klip na desku 25 mm – 3 kabely', popis: 'silnější pracovní deska', p: { typ: 'klip', nazev: 'Klip 25', material: 'petg',
      kabely: { seznam: [8, 6, 6], pomer: 0.9, stena: 1.6 }, klip: { deska: 25, hloubka: 25, sirka: 14, celist: 3.5 } } },
    { nazev: 'Hřebínek USB – 5 × ⌀ 4', popis: 'nabíjecí kabely na stole, nalepit', p: { typ: 'hreben', nazev: 'Hřebínek USB', material: 'petg',
      kabely: { seznam: [4, 4, 4, 4, 4], pomer: 0.9, stena: 1.2 }, hreben: { zakladna: 2.4, sirka: 10, uchyceni: 'lepeni' }, tisk: { poloha: 'bok' } } },
    { nazev: 'Hřebínek mix – 3 × ⌀ 6 + 2 × ⌀ 8 na šrouby', popis: 'za skříň nebo na zeď, zápustné šrouby 3,5 mm', p: { typ: 'hreben', nazev: 'Hřebínek mix', material: 'petg',
      kabely: { seznam: [6, 6, 6, 8, 8], pomer: 0.9, stena: 1.4 }, hreben: { zakladna: 3.5, sirka: 12, uchyceni: 'sroub' }, sroub: { prumer: 3.5, hlava: 7 } } },
    { nazev: 'Háček pod stůl – svazek ⌀ 24', popis: 'otevřený háček, jeden šroub', p: { typ: 'drzak', nazev: 'Háček pod stůl', material: 'petg',
      drzak: { tvar: 'hacek', svazek: 24, stena: 3, delka: 16, vstup: 7, sroubu: 1 }, kabely: { seznam: [6] } } },
    { nazev: 'Kanálek pod stůl 40 × 20', popis: 'žlábek na prodlužovačku a kabely, dva šrouby', p: { typ: 'drzak', nazev: 'Kanálek pod stůl', material: 'petg',
      drzak: { tvar: 'kanal', svazek: 40, vyska: 20, stena: 2.4, delka: 40, vstup: 9, sroubu: 2 }, kabely: { seznam: [8] } } },
    { nazev: 'Průchodka do krabice ⌀ 16 – TPU', popis: 'zacvakne se do stěny 2 mm, membrána těsní kabel ⌀ 6', p: { typ: 'zed', nazev: 'Průchodka krabice', material: 'tpu',
      kabely: { seznam: [6], pomer: 0.6 }, zed: { uchyceni: 'zacvak', otvor: 16, panel: 2, stena: 1.8 } } },
    { nazev: 'Průchodka do zdi ⌀ 25', popis: 'zasunout do vývrtu, kabel ⌀ 10, PETG', p: { typ: 'zed', nazev: 'Průchodka zeď', material: 'petg',
      kabely: { seznam: [10], pomer: 0.8 }, zed: { uchyceni: 'zasunuti', otvor: 25, vuleOtvor: 0, delka: 30, stena: 2, limec: 4, membrana: 0.6, platku: 8 } } },
  ];

  const kopie = o => JSON.parse(JSON.stringify(o));
  const cislo = (x, d) => { const n = typeof x === 'string' ? parseFloat(x.replace(',', '.').replace('−', '-')) : Number(x); return Number.isFinite(n) ? n : d; };
  function fmt(x, des = 1) {
    if (!Number.isFinite(x)) return '–';
    const r = Math.round(x * 10 ** des) / 10 ** des;
    return String(Object.is(r, -0) ? 0 : r).replace('.', ',').replace('-', '−');
  }
  const vezmi = (o, cesta) => cesta.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function poloz(o, cesta, h) { const k = cesta.split('.'); const p = k.pop(); k.reduce((a, x) => a[x], o)[p] = h; }
  function sloucit(cil, z) {
    for (const [k, v] of Object.entries(z || {})) {
      if (v && typeof v === 'object' && !Array.isArray(v) && cil[k] && typeof cil[k] === 'object' && !Array.isArray(cil[k])) sloucit(cil[k], v);
      else cil[k] = kopie(v);
    }
    return cil;
  }
  function vychoziProjekt(i) {
    const p = kopie(VYCHOZI);
    if (PREDVOLBY[i]) sloucit(p, PREDVOLBY[i].p);
    return p;
  }

  /** Seznam kabelů z textu: „6; 6; 8,5“ nebo „3×6; 2×8“ (oddělovač středník nebo mezera). */
  function ctiKabely(text) {
    const out = [];
    for (const t of String(text).split(/[;\s]+/).filter(Boolean)) {
      const m = t.match(/^(\d+)\s*[x×*]\s*(.+)$/i);
      const n = m ? Math.min(30, parseInt(m[1], 10)) : 1, d = cislo(m ? m[2] : t, NaN);
      if (!Number.isFinite(d) || n < 1) return null;
      for (let i = 0; i < n; i++) out.push(d);
    }
    return out.length ? out : null;
  }
  function textKabely(s) {
    const casti = [];
    for (let i = 0; i < s.length;) {
      let j = i; while (j < s.length && s[j] === s[i]) j++;
      casti.push((j - i > 1 ? (j - i) + '×' : '') + fmt(s[i], 2));
      i = j;
    }
    return casti.join('; ');
  }

  /* [min, max, celé číslo] */
  const ROZSAHY = {
    'tisk.tryska': [0.2, 1], 'tisk.vrstva': [0.05, 0.6], 'tisk.kusu': [1, 30, 1],
    'kabely.vule': [-0.5, 2], 'kabely.pomer': [0.4, 1], 'kabely.stena': [0.6, 6],
    'sroub.prumer': [2, 8], 'sroub.hlava': [3, 16],
    'pruchodka.otvor': [20, 150], 'pruchodka.vuleOtvor': [-1, 2], 'pruchodka.hloubka': [3, 60], 'pruchodka.stena': [0.8, 8],
    'pruchodka.limec': [2, 30], 'pruchodka.limecTl': [0.8, 8],
    'pruchodka.viko.tl': [0.8, 8], 'pruchodka.viko.lem': [2, 30], 'pruchodka.viko.lemTl': [0.6, 5], 'pruchodka.viko.vule': [0, 2],
    'pruchodka.viko.vybraniSirka': [3, 100], 'pruchodka.viko.vybraniHloubka': [3, 80], 'pruchodka.viko.vybrani': [1, 4, 1],
    'pruchodka.viko.prstu': [3, 16, 1], 'pruchodka.viko.zobacek': [0, 2],
    'klip.deska': [3, 60], 'klip.vule': [0, 2], 'klip.hloubka': [6, 80], 'klip.celist': [1, 10], 'klip.sevreni': [0, 3], 'klip.sirka': [4, 60],
    'hreben.zakladna': [1, 10], 'hreben.sirka': [4, 60],
    'drzak.svazek': [5, 150], 'drzak.vyska': [5, 100], 'drzak.stena': [1, 10], 'drzak.deska': [1.5, 10], 'drzak.delka': [6, 200],
    'drzak.vstup': [1, 60], 'drzak.sroubu': [1, 2, 1],
    'zed.otvor': [6, 80], 'zed.vuleOtvor': [-1, 2], 'zed.panel': [0.5, 12], 'zed.delka': [3, 80], 'zed.stena': [0.8, 6],
    'zed.limec': [1, 20], 'zed.limecTl': [0.8, 6], 'zed.membrana': [0.2, 3], 'zed.platku': [0, 16, 1], 'zed.prstu': [3, 12, 1], 'zed.zobacek': [0.1, 2],
  };
  const VYCTY = {
    typ: Object.keys(TYPY), material: Object.keys(MATERIALY), 'tisk.poloha': ['bok', 'zakladna'],
    'pruchodka.viko.zpusob': ['otocne', 'zasouvaci'], 'hreben.uchyceni': ['sroub', 'lepeni'],
    'drzak.tvar': ['hacek', 'kanal'], 'zed.uchyceni': ['zacvak', 'zasunuti'],
  };

  /** Vstup (i poškozený) → úplný projekt v mezích. Vrací {p, hlaseni: [text]} – co se muselo opravit. */
  function normalizuj(vstup) {
    const p = kopie(VYCHOZI), hlaseni = [];
    if (!vstup || typeof vstup !== 'object') return { p, hlaseni };
    if (typeof vstup.nazev === 'string') p.nazev = vstup.nazev.slice(0, 120);
    for (const [c, mozne] of Object.entries(VYCTY)) {
      const h = vezmi(vstup, c);
      if (h === undefined) continue;
      if (mozne.includes(h)) poloz(p, c, h); else hlaseni.push(`${c}: neznámá volba „${h}“`);
    }
    for (const [c, [mn, mx, cele]] of Object.entries(ROZSAHY)) {
      const h0 = vezmi(vstup, c);
      if (h0 === undefined) continue;
      let h = cislo(h0, NaN);
      if (!Number.isFinite(h)) { hlaseni.push(`${c}: neplatné číslo → výchozí`); continue; }
      if (cele) h = Math.round(h);
      const o = Math.min(mx, Math.max(mn, h));
      if (o !== h) hlaseni.push(`${c}: omezeno na ${fmt(o, 2)}`);
      poloz(p, c, o);
    }
    const s = vstup.kabely && vstup.kabely.seznam;
    if (s !== undefined) {
      const pole = Array.isArray(s) ? s.map(x => cislo(x, NaN)) : ctiKabely(s);
      const ok = pole && pole.length && pole.every(Number.isFinite);
      if (!ok) hlaseni.push('kabely: neplatný seznam → výchozí');
      else {
        const om = pole.slice(0, 30).map(d => Math.min(60, Math.max(1, d)));
        if (pole.length > 30 || om.some((d, i) => d !== pole[i])) hlaseni.push('kabely: omezeno na 1–30 kabelů ⌀ 1–60 mm');
        p.kabely.seznam = om;
      }
    }
    return { p, hlaseni };
  }

  /* ---------- pružný oblouk / nosník ----------
     Zakřivený vetknutý nosník (kruhový oblouk o poloměru Rm od úhlu a0 do a1, úhly v radiánech, střed v počátku),
     na konci síla ve směru f. Konec se má posunout o delta. Ohybový moment M(s) na jednotkovou sílu,
     posun konce = F/EI ∫M² ds (Castigliano), největší protažení ε = Mmax · t/2 · F/EI.
     → ε = delta · t · Mmax / (2 ∫M² ds) – nezávisí na materiálu ani šířce, jen na tvaru.
     Rovný nosník délky L: ε = 1,5 · t · delta / L². */
  function protazeniOblouku(Rm, a0, a1, f, t, delta) {
    const n = 200, T = [Rm * Math.cos(a1), Rm * Math.sin(a1)];
    let int = 0, Mmax = 0;
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n, P = [Rm * Math.cos(a), Rm * Math.sin(a)];
      const M = Math.abs((T[0] - P[0]) * f[1] - (T[1] - P[1]) * f[0]);
      int += (i === 0 || i === n ? 0.5 : 1) * M * M;
      if (M > Mmax) Mmax = M;
    }
    int *= Math.abs(a1 - a0) * Rm / n;
    return int > 0 ? delta * t * Mmax / (2 * int) : 0;
  }
  const protazeniNosniku = (L, t, delta) => (L > 0 ? 1.5 * t * delta / (L * L) : Infinity);

  /** Řada sedel pro kabely (hřebínek, klip): základna je přímka y = 0, sedla nad ní, levý okraj x = 0.
      Vnitřní kružnice sedla se dotýká základny, hrdlo míří nahoru. */
  function radaSedel(k) {
    const sedla = []; let x = 0;
    k.seznam.forEach((d, i) => {
      const D = d + k.vule, R = D / 2, Ro = R + k.stena, h = Math.min(k.pomer * d, D);
      x += i === 0 ? Ro : sedla[i - 1].R + k.stena + R;
      const thetaM = Math.asin(Math.min(1, h / D));           // okraj hrdla od vrcholu kružnice
      const phiR = Math.acos(R / Ro);                           // kořen ramene: vnější kružnice protíná základnu
      const delta = Math.max(0, (d - h) / 2);                    // každé rameno se rozevře o polovinu
      const Rm = R + k.stena / 2;
      const eps = delta > 0 ? protazeniOblouku(Rm, -Math.PI / 2 + phiR, Math.PI / 2 - thetaM, [1, 0], k.stena, delta) : 0;
      sedla.push({ d, D, R, Ro, h, x, y: R, thetaM, delta, eps, previs: 90 - thetaM * 180 / Math.PI });
    });
    const posl = sedla[sedla.length - 1];
    return { sedla, sirka: posl.x + posl.Ro, vyska: Math.max(...sedla.map(s => 2 * s.R + k.stena)) };
  }

  /** Odvozené rozměry podle typu – sdílí geometrie, kontroly i výsledky. */
  function odvozene(p) {
    const k = p.kabely, dmax = Math.max(...k.seznam), o = { dmax, pruzne: [] };
    const pr = (nazev, pole, eps, napric) => o.pruzne.push({ nazev, pole, eps, napric: !!napric });
    if (p.typ === 'pruchodka') {
      const q = p.pruchodka, v = q.viko;
      o.OD = q.otvor - q.vuleOtvor; o.ID = o.OD - 2 * q.stena; o.Rf = q.otvor / 2 + q.limec;
      o.ro = o.ID / 2 - v.vule; o.ri = o.ro - v.lemTl;
      o.zas = v.zpusob === 'zasouvaci';
      o.zb = q.limecTl - v.lem + v.zobacek;                  // výška středu zobáčku (montáž, deska = 0)
      o.delta = v.zobacek - v.vule;                          // o kolik se prsty prohnou dovnitř
      o.g = Math.max(0, o.delta) + 0.2;                      // hloubka drážky za vnitřní stěnou kroužku
      o.vybraniDosah = v.vybraniHloubka - (o.Rf - o.ro);     // jak daleko vybrání zasahuje dovnitř lemu
      if (o.zas) {
        const sirkaPrstu = 2 * Math.PI * o.ro / v.prstu - SPARA;
        o.sirkaPrstu = sirkaPrstu;
        pr('Prsty víčka (zobáček do drážky)', 'pruchodka.viko.zobacek', o.delta > 0 ? protazeniNosniku(v.lem, v.lemTl, o.delta) : 0, true);
      }
      o.vyska = [q.hloubka + q.limecTl, v.tl + v.lem];
    } else if (p.typ === 'klip') {
      const q = p.klip;
      o.rada = radaSedel(k);
      o.mezera = q.deska + q.vule;
      o.svira = q.sevreni - q.vule;
      o.delkaSpodni = Math.max(q.hloubka, o.rada.sirka - q.vule - q.celist);
      pr('Čelist klipu (svírání desky)', 'klip.sevreni', o.svira > 0 ? protazeniNosniku(q.hloubka, q.celist, o.svira) : 0, false);
      o.rada.sedla.forEach((s, i) => pr(`Sedlo ${i + 1} ⌀ ${fmt(s.d, 1)} – ramena hrdla`, 'kabely.pomer', s.eps, false));
    } else if (p.typ === 'hreben') {
      const q = p.hreben, s = p.sroub;
      o.rada = radaSedel(k);
      o.sroub = q.uchyceni === 'sroub';
      o.ucho = o.sroub ? s.hlava + 3 : 1.5;
      o.zahloubeni = (s.hlava - s.prumer) / 2;
      o.rada.sedla.forEach((x, i) => pr(`Sedlo ${i + 1} ⌀ ${fmt(x.d, 1)} – ramena hrdla`, 'kabely.pomer', x.eps, p.tisk.poloha === 'zakladna'));
    } else if (p.typ === 'drzak') {
      const q = p.drzak, napric = p.tisk.poloha === 'zakladna';
      o.ucho = p.sroub.hlava + 3;
      o.zahloubeni = (p.sroub.hlava - p.sroub.prumer) / 2;
      const t = q.stena;
      if (q.tvar === 'hacek') {
        o.R = q.svazek / 2; o.Rm = o.R + t / 2; o.aK = Math.PI / 6;     // konec háčku 30° nad vodorovnou
        o.yc = Math.min(-q.deska, -q.vstup - o.Rm * Math.sin(o.aK) - t / 2);   // střed oblouku pod deskou
        o.vstupSkut = -o.yc - o.Rm * Math.sin(o.aK) - t / 2;
        o.delta = Math.max(0, dmax - o.vstupSkut);
        pr('Háček (vstup užší než kabel)', 'drzak.vstup', o.delta > 0 ? protazeniOblouku(o.Rm, Math.PI, 2 * Math.PI + o.aK, [0, -1], t, o.delta) : 0, napric);
      } else {
        o.vstupSkut = Math.min(q.vstup, q.vyska);
        o.vyskaPredni = q.vyska + t - o.vstupSkut;
        o.delta = Math.max(0, dmax - o.vstupSkut);
        pr('Přední stěna kanálku (vstup užší než kabel)', 'drzak.vstup', o.delta > 0 ? protazeniNosniku(o.vyskaPredni, t, o.delta) : 0, napric);
      }
    } else if (p.typ === 'zed') {
      const q = p.zed, d = k.seznam[0];
      o.d = d; o.OD = q.otvor - q.vuleOtvor; o.ID = o.OD - 2 * q.stena; o.Rf = q.otvor / 2 + q.limec;
      o.dh = Math.min(k.pomer * d, o.ID);                    // otvor v membráně
      o.zac = q.uchyceni === 'zacvak';
      o.z1 = q.limecTl + q.panel;                                       // zadní líc panelu = začátek zobáčku
      o.ztop = o.zac ? o.z1 + q.zobacek * (1 + 1.8) + 0.4 : q.delka;
      o.delta = q.zobacek - q.vuleOtvor / 2;
      o.prst = o.ztop - q.limecTl - 0.3;                                 // prořezy začínají 0,3 mm nad límcem
      if (o.zac) pr('Pružné prsty (zobáček za panel)', 'zed.zobacek', o.delta > 0 ? protazeniNosniku(o.prst, q.stena, o.delta) : 0, true);
      o.platek = (o.ID - o.dh) / 2;
      if (q.platku >= 2 && o.platek > 0.3) {
        // plátek se ohne, aby se otvor rozevřel z dh na d: úhel α z L(1 − cos α) = (d − dh)/2, ε = α·t/(2L)
        const r = Math.max(0, (d - o.dh) / 2), a = Math.acos(Math.max(-1, 1 - r / o.platek));
        pr('Plátky membrány (průchod kabelu)', 'zed.membrana', r > 0 ? a * q.membrana / (2 * o.platek) : 0, false);
      }
    }
    return o;
  }

  /* ---------- kontroly ---------- */
  function kontroly(p, o = odvozene(p)) {
    const h = [], t = p.tisk, m = MATERIALY[p.material], k = p.kabely;
    const add = (uroven, text, pole) => h.push({ uroven, text, pole });
    const stena = (hodnota, co, pole) => {
      if (hodnota < 2 * t.tryska - 1e-9) add('chyba', `${co} ${fmt(hodnota, 2)} mm je méně než 2 šířky trysky (${fmt(2 * t.tryska, 2)} mm) – slicer ji nevytiskne.`, pole);
      else if (hodnota < 3 * t.tryska - 1e-9) add('varovani', `${co} ${fmt(hodnota, 2)} mm je tenká (méně než 3 šířky trysky) – bude křehká.`, pole);
    };
    for (const x of o.pruzne) {
      const f = x.napric ? NAPRIC_VRSTVAMI : 1, dov = m.dov * f, mez = m.mez * f;
      const txt = `${x.nazev}: protažení ${fmt(100 * x.eps, 1)} % (${m.nazev}${x.napric ? ' napříč vrstvami' : ''} doporučeno ≤ ${fmt(100 * dov, 1)} %, mez ${fmt(100 * mez, 1)} %)`;
      if (x.eps > mez) add('chyba', txt + ' – praskne. Zmenšete přesah / tloušťku, prodlužte pružnou část nebo zvolte pružnější materiál.', x.pole);
      else if (x.eps > dov) add('varovani', txt + ' – na hraně, opakované zacvaknutí ho může unavit.', x.pole);
      else if (x.eps > 0) add('ok', txt + '.', x.pole);
    }
    if (p.typ === 'klip' || p.typ === 'hreben') {
      stena(k.stena, 'Stěna sedla', 'kabely.stena');
      for (const s of o.rada.sedla) {
        if (s.delta === 0) add('info', `Sedlo ⌀ ${fmt(s.d, 1)}: hrdlo ${fmt(s.h, 1)} mm není užší než kabel – kabel se jen vloží, nezacvakne.`, 'kabely.pomer');
        if (k.pomer < 0.6) add('varovani', 'Hrdlo užší než 0,6 × ⌀ kabelu – kabel půjde zatlačit jen velkou silou a může se poškodit izolace.', 'kabely.pomer');
      }
      if (k.vule < 0) add('info', 'Záporná vůle sedla – kabel bude v sedle sevřený (nepůjde posouvat).', 'kabely.vule');
    }
    if (p.typ === 'pruchodka') {
      const q = p.pruchodka, v = q.viko;
      stena(q.stena, 'Stěna kroužku', 'pruchodka.stena'); stena(q.limecTl, 'Límec', 'pruchodka.limecTl');
      stena(v.lemTl, 'Lem víčka', 'pruchodka.viko.lemTl'); stena(v.tl, 'Víčko', 'pruchodka.viko.tl');
      if (o.ri < 3) add('chyba', 'Kroužek je pro zadané stěny a vůle příliš malý – lem víčka se nevejde.', 'pruchodka.otvor');
      if (o.vybraniDosah < 1) add('chyba', `Vybrání ve víčku nedosáhne dovnitř kroužku (chybí ${fmt(1 - o.vybraniDosah, 1)} mm) – kabel neprojde. Prodlužte hloubku vybrání nad ${fmt(o.Rf - o.ro + 1, 1)} mm.`, 'pruchodka.viko.vybraniHloubka');
      if (v.vybraniSirka < o.dmax + 1) add('varovani', `Vybrání ${fmt(v.vybraniSirka, 1)} mm je užší než nejsilnější kabel + 1 mm (${fmt(o.dmax + 1, 1)} mm).`, 'pruchodka.viko.vybraniSirka');
      if (v.vybraniSirka > o.ID * 0.8) add('chyba', 'Vybrání je skoro tak široké jako kroužek – víčko by se rozpadlo.', 'pruchodka.viko.vybraniSirka');
      if (v.vybraniHloubka > o.Rf * 0.95) add('chyba', 'Vybrání sahá přes střed víčka.', 'pruchodka.viko.vybraniHloubka');
      if (q.vuleOtvor < 0) add('info', `Záporná vůle v otvoru = nalisování o ${fmt(-q.vuleOtvor, 2)} mm na průměru (do dřevotřísky max. 0,3 mm).`, 'pruchodka.vuleOtvor');
      if (o.zas) {
        if (o.delta <= 0) add('varovani', 'Zobáček není větší než vůle – víčko v drážce nedrží (zvětšete zobáček nebo zmenšete vůli).', 'pruchodka.viko.zobacek');
        if (o.g > q.stena - 2 * t.tryska) add('chyba', `Drážka pro zobáček (${fmt(o.g, 2)} mm) by v kroužku nechala stěnu tenčí než 2 šířky trysky.`, 'pruchodka.viko.zobacek');
        if (v.lem < 2 * v.zobacek + 1.5) add('chyba', 'Lem víčka je na zobáček krátký (potřeba aspoň 2 × zobáček + 1,5 mm).', 'pruchodka.viko.lem');
        if (o.zb - v.zobacek - o.g < -q.hloubka + 1) add('chyba', 'Drážka pro zobáček vychází pod spodní okraj kroužku – zkraťte lem.', 'pruchodka.viko.lem');
        if (o.sirkaPrstu < 3) add('varovani', `Prsty víčka jsou úzké (${fmt(o.sirkaPrstu, 1)} mm) – snižte jejich počet.`, 'pruchodka.viko.prstu');
      } else if (v.vule < 0.15) add('varovani', 'Otočné víčko s vůlí pod 0,15 mm se nejspíš nebude otáčet.', 'pruchodka.viko.vule');
      if (v.lem > q.hloubka + q.limecTl) add('chyba', 'Lem víčka je delší než kroužek.', 'pruchodka.viko.lem');
    }
    if (p.typ === 'klip') {
      const q = p.klip;
      stena(q.celist, 'Čelist', 'klip.celist');
      if (o.svira <= 0) add('varovani', 'Hrbolek čelisti není větší než vůle – klip na desce nesvírá a bude klouzat.', 'klip.sevreni');
      if (q.hloubka < 3 * q.celist) add('varovani', 'Krátká čelist – klip bude tuhý a snadno sklouzne.', 'klip.hloubka');
      if (q.sirka < 6) add('varovani', 'Úzký klip (pod 6 mm) se snadno zlomí.', 'klip.sirka');
      add('info', 'Tiskne se naležato (profil na podložce) – čelisti i ramena sedel se ohýbají podél vrstev.', 'tisk.poloha');
    }
    if (p.typ === 'hreben') {
      const q = p.hreben, s = p.sroub;
      stena(q.zakladna, 'Základna', 'hreben.zakladna');
      if (o.sroub) {
        if (q.sirka < s.hlava + 2) add('chyba', `Šířka hřebínku ${fmt(q.sirka, 1)} mm je menší než hlava šroubu + 2 mm.`, 'hreben.sirka');
        if (o.zahloubeni > q.zakladna - 0.8) add('chyba', `Zahloubení hlavy (${fmt(o.zahloubeni, 1)} mm) by prošlo základnou – zesilte ji aspoň na ${fmt(o.zahloubeni + 0.8, 1)} mm.`, 'hreben.zakladna');
        if (s.hlava <= s.prumer + 0.5) add('chyba', 'Hlava šroubu musí být větší než jeho průměr.', 'sroub.hlava');
      } else add('info', 'Lepení: přilnavost zlepší oboustranná páska přes celou základnu nebo lepidlo na ABS/PETG.', 'hreben.uchyceni');
      if (t.poloha === 'zakladna') {
        const max = Math.max(...o.rada.sedla.map(x => x.previs));
        if (max > 50) add('varovani', `Ve tisku na základně visí horní okraje sedel pod úhlem ${fmt(max, 0)}° – zvětšete poměr hrdla nebo tiskněte na boku.`, 'tisk.poloha');
      } else if (o.sroub) add('info', 'Na boku se otvory pro šrouby tisknou vodorovně – malé převisy ve stropě otvoru jsou v pořádku.', 'tisk.poloha');
    }
    if (p.typ === 'drzak') {
      const q = p.drzak, s = p.sroub;
      stena(q.stena, 'Stěna držáku', 'drzak.stena'); stena(q.deska, 'Deska držáku', 'drzak.deska');
      if (o.zahloubeni > q.deska - 0.8) add('chyba', `Zahloubení hlavy (${fmt(o.zahloubeni, 1)} mm) by prošlo deskou držáku – zesilte ji aspoň na ${fmt(o.zahloubeni + 0.8, 1)} mm.`, 'drzak.deska');
      if (q.delka < s.hlava + 2) add('chyba', `Délka držáku ${fmt(q.delka, 1)} mm je menší než hlava šroubu + 2 mm.`, 'drzak.delka');
      if (q.sroubu === 2 && q.delka < 2 * (s.hlava + 2)) add('chyba', 'Na dva šrouby je držák krátký (potřeba aspoň 2 × (hlava + 2 mm)).', 'drzak.sroubu');
      if (s.hlava <= s.prumer + 0.5) add('chyba', 'Hlava šroubu musí být větší než jeho průměr.', 'sroub.hlava');
      if (q.tvar === 'hacek' && o.vstupSkut > q.vstup + 0.05) add('info', `Vstup vychází ${fmt(o.vstupSkut, 1)} mm – menší by háček zarazil do desky.`, 'drzak.vstup');
      if (q.tvar === 'kanal' && q.vstup > q.vyska) add('info', 'Vstup je větší než výška kanálku – přední stěna odpadá, kanálek je otevřená police.', 'drzak.vstup');
      if (o.delta === 0) add('info', `Vstup ${fmt(o.vstupSkut, 1)} mm je širší než nejsilnější kabel (⌀ ${fmt(o.dmax, 1)}) – kabely se vkládají volně.`, 'drzak.vstup');
      if (t.poloha === 'zakladna') add('varovani', 'Na desce se ohyb háčku / stěny namáhá napříč vrstvami – pevnější je tisk na boku.', 'tisk.poloha');
    }
    if (p.typ === 'zed') {
      const q = p.zed;
      stena(q.stena, 'Stěna průchodky', 'zed.stena'); stena(q.limecTl, 'Límec', 'zed.limecTl');
      if (q.membrana < 2 * t.vrstva - 1e-9) add('chyba', `Membrána ${fmt(q.membrana, 2)} mm je tenčí než 2 vrstvy.`, 'zed.membrana');
      if (o.ID < o.d + 0.2) add('chyba', `Vnitřní průměr ${fmt(o.ID, 1)} mm je menší než kabel ⌀ ${fmt(o.d, 1)} + 0,2 mm – kabel neprojde. Zvětšete otvor nebo ztenčete stěnu.`, 'zed.stena');
      if (k.seznam.length > 1) add('info', `Průchodka je na jeden kabel – použije se první ze seznamu (⌀ ${fmt(o.d, 1)}).`, 'kabely.seznam');
      if (o.zac) {
        if (o.delta <= 0) add('varovani', 'Zobáček není větší než vůle v otvoru – průchodka za panelem nedrží.', 'zed.zobacek');
        if (q.panel > 6) add('varovani', 'Na panel silnější než 6 mm je lepší způsob „zasunutí“.', 'zed.panel');
        const sirka = Math.PI * o.OD / q.prstu - SPARA;
        if (sirka < 2.5) add('varovani', `Prsty jsou úzké (${fmt(sirka, 1)} mm) – snižte jejich počet.`, 'zed.prstu');
      } else if (q.vuleOtvor > 0) add('info', 'Zasunutí s kladnou vůlí – průchodku přilepte nebo utěsněte silikonem.', 'zed.vuleOtvor');
      if (o.dh >= o.ID - 0.2 || q.platku < 2) add('info', 'Membrána bez plátků – otvor je jen kruhový, netěsní.', 'zed.platku');
      if (q.platku >= 2) add('info', `Štěrbiny mezi plátky jsou ${fmt(STERBINA, 1)} mm – když je slicer zalije, prořízněte je nožem.`, 'zed.platku');
      if (p.material !== 'tpu') add('info', 'Těsní nejlépe z TPU; z tvrdého materiálu plátky membrány při prvním průchodu kabelu prasknou.', 'material');
    }
    if (p.typ === 'hreben' || p.typ === 'drzak') if (p.sroub.prumer + 0.3 < 2 * t.tryska) add('chyba', 'Otvor pro šroub je menší než tryska.', 'sroub.prumer');
    return h;
  }

  /* ---------- odhad tisku ---------- */
  /** Hmotnost plného dílu, délka filamentu 1,75 mm a hrubá doba (průtok ~ tryska·vrstva·30 mm/s + 3 s na vrstvu). */
  function odhadTisku(objem, vyska, p) {
    const m = MATERIALY[p.material], t = p.tisk;
    const hmotnost = objem / 1000 * m.hustota;
    const filament = objem / (Math.PI * 0.875 * 0.875) / 1000;          // m
    const prutok = t.tryska * t.vrstva * 30;                             // mm³/s
    const cas = (objem / prutok + Math.ceil(vyska / t.vrstva) * 3) / 60;  // min
    return { hmotnost, filament, cas };
  }

  /* ---------- sítě: transformace a rozložení ---------- */
  function obal(poz) {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < poz.length; i += 3) for (let k = 0; k < 3; k++) { const v = poz[i + k]; if (v < b[k]) b[k] = v; if (v > b[k + 3]) b[k + 3] = v; }
    return b;
  }
  /** Přemapování os sítě (zachová orientaci – jen rotace): f(x, y, z) → [x', y', z']. */
  function mapuj(sit, f) {
    const poz = new Float32Array(sit.poz.length);
    for (let i = 0; i < poz.length; i += 3) { const q = f(sit.poz[i], sit.poz[i + 1], sit.poz[i + 2]); poz[i] = q[0]; poz[i + 1] = q[1]; poz[i + 2] = q[2]; }
    return { poz, idx: sit.idx };
  }
  const OTOCENI = {
    zadne: (x, y, z) => [x, y, z],
    prevrat: (x, y, z) => [x, -y, -z],          // 180° kolem X
    yNahoru: (x, y, z) => [x, -z, y],           // +90° kolem X: profilová osa y → z
    yDolu: (x, y, z) => [x, z, -y],             // −90° kolem X
  };
  /** Díly (v tiskové orientaci) na podložku: z ≥ 0, mřížka po kusech s mezerou, střed v počátku. */
  function rozlozeni(dily, kusu = 1, mezera = 8) {
    const polozky = [];
    for (let c = 0; c < kusu; c++) for (const d of dily) polozky.push(d);
    const b = polozky.map(d => obal(d.poz));
    const sloupcu = Math.ceil(Math.sqrt(polozky.length));
    const out = []; let y = 0, maxX = 0;
    for (let r = 0; r * sloupcu < polozky.length; r++) {
      let x = 0, vys = 0;
      for (let c = 0; c < sloupcu && r * sloupcu + c < polozky.length; c++) {
        const i = r * sloupcu + c, bb = b[i];
        out.push(Object.assign({}, polozky[i], posun(polozky[i], x - bb[0], y - bb[1], -bb[2]), { nazev: polozky[i].nazev + (kusu > 1 ? ` ${Math.floor(i / dily.length) + 1}` : '') }));
        x += bb[3] - bb[0] + mezera; vys = Math.max(vys, bb[4] - bb[1]);
      }
      maxX = Math.max(maxX, x - mezera); y += vys + mezera;
    }
    const dx = -maxX / 2, dy = -(y - mezera) / 2;
    return out.map(d => Object.assign({}, d, posun(d, dx, dy, 0)));
  }
  function posun(sit, dx, dy, dz) {
    const poz = new Float32Array(sit.poz.length);
    for (let i = 0; i < poz.length; i += 3) { poz[i] = sit.poz[i] + dx; poz[i + 1] = sit.poz[i + 1] + dy; poz[i + 2] = sit.poz[i + 2] + dz; }
    return { poz, idx: sit.idx };
  }

  /* ---------- projekt JSON ---------- */
  function ulozProjekt(p) {
    return JSON.stringify({ format: 'webapp_kabely3d', verze: VERZE_FORMATU, ulozeno: new Date().toISOString(), projekt: p }, null, 2);
  }
  function nactiProjekt(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
    if (!o || o.format !== 'webapp_kabely3d') throw new Error('Soubor není projekt kabelových průchodek (chybí "format": "webapp_kabely3d").');
    if (!(o.verze >= 1) || o.verze > VERZE_FORMATU) throw new Error(`Nepodporovaná verze projektu ${o.verze}.`);
    return normalizuj(o.projekt);
  }

  /** Krátký popis nastavení (seznam uložených, název souborů). */
  function popis(p) {
    const k = textKabely(p.kabely.seznam);
    switch (p.typ) {
      case 'pruchodka': return `průchodka ⌀ ${fmt(p.pruchodka.otvor)} – ${p.pruchodka.viko.zpusob === 'otocne' ? 'otočné' : 'zacvakávací'} víčko`;
      case 'klip': return `klip na desku ${fmt(p.klip.deska)} mm – kabely ${k}`;
      case 'hreben': return `hřebínek ${k}`;
      case 'drzak': return `${p.drzak.tvar === 'hacek' ? 'háček' : 'kanálek'} pod stůl ${fmt(p.drzak.svazek)} mm`;
      default: return `průchodka do ${p.zed.uchyceni === 'zacvak' ? 'panelu' : 'zdi'} ⌀ ${fmt(p.zed.otvor)} – kabel ⌀ ${fmt(p.kabely.seznam[0])}`;
    }
  }

  const API = {
    VERZE_FORMATU, TYPY, MATERIALY, NAPRIC_VRSTVAMI, SPARA, STERBINA, VYCHOZI, PREDVOLBY, ROZSAHY, VYCTY,
    kopie, cislo, fmt, vezmi, poloz, sloucit, vychoziProjekt, ctiKabely, textKabely, normalizuj,
    protazeniOblouku, protazeniNosniku, radaSedel, odvozene, kontroly, odhadTisku,
    obal, mapuj, OTOCENI, rozlozeni, posun, ulozProjekt, nactiProjekt, popis,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.KAB = API;
})();

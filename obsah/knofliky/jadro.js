/* Knoflíky a hlavice – jádro generátoru (bez DOM a bez three.js, spustitelné v node).
   Parametry a jejich meze, předvolby, kontroly, stavba těles přes manifold-3d, rozbor převisů, tisková poloha.
   Souřadnice „montážní“: osa Z = osa knoflíku, z = 0 je spodek (strana k panelu / k dílu), nahoře úchop.
   Ukazatel a stupnice míří k +Y, stavěcí šroub k +X, rukojeť kolečka leží na +Y. */
(function () {
  'use strict';
  const KRAB = typeof module !== 'undefined' ? require('../krabicky/jadro.js') : window.KRAB;
  // KRAB.fmt odřízne koncové nuly i u celých čísel (10 → „1“ při des = 0), proto celá čísla zvlášť
  const fmt = (x, des = 1) => (des === 0 ? KRAB.fmt(Math.round(x), 1) : KRAB.fmt(x, des));

  /* ---------------- tabulky ---------------- */
  /** Šrouby a matice: d závit, s otvor klíče (ISO 4032 / ISO 4017), m výška matice, k výška hlavy; DIN 934/933 odchylky. */
  const SROUBY = {
    M3: { d: 3, s: 5.5, m: 2.4, k: 2 },
    M4: { d: 4, s: 7, m: 3.2, k: 2.8 },
    M5: { d: 5, s: 8, m: 4.7, k: 3.5, mDin: 4 },
    M6: { d: 6, s: 10, m: 5.2, k: 4, mDin: 5 },
    M8: { d: 8, s: 13, m: 6.8, k: 5.3, mDin: 6.5 },
    M10: { d: 10, s: 16, m: 8.4, k: 6.4, sDin: 17, mDin: 8 },
    M12: { d: 12, s: 18, m: 10.8, k: 7.5, sDin: 19, mDin: 10 },
  };
  const MATERIALY = {
    PLA: { nazev: 'PLA', hustota: 1.24 },
    PETG: { nazev: 'PETG', hustota: 1.27 },
    ABS: { nazev: 'ABS', hustota: 1.04 },
    ASA: { nazev: 'ASA', hustota: 1.07 },
  };
  const NAZVY = {
    typ: { potenciometr: 'Knoflík na potenciometr', sroub: 'Hlavice na šroub', knopka: 'Knopka na šuplík', kolecko: 'Kolečko s rukojetí' },
    uchop: { hladky: 'hladký', vroubky: 'vroubkování', drazky: 'drážky', hvezdice: 'hvězdice', kridlo: 'křídlo', t: 'T-rukojeť' },
    upevneni: { D: 'hřídel D', vroubek: 'vroubkovaná hřídel', hladka: 'hladká hřídel + stavěcí šroub', matice: 'vložená matice', hlava: 'hlava šroubu', vrut: 'vrut / vložka' },
  };
  /** Co který typ dovoluje (první = výchozí). */
  const TYPY = {
    potenciometr: { uchopy: ['vroubky', 'drazky', 'hladky'], upevneni: ['D', 'vroubek', 'hladka'] },
    sroub: { uchopy: ['hvezdice', 'kridlo', 't', 'vroubky', 'drazky', 'hladky'], upevneni: ['matice', 'hlava'] },
    knopka: { uchopy: ['hladky', 'drazky'], upevneni: ['matice', 'vrut'] },
    kolecko: { uchopy: ['vroubky', 'drazky', 'hladky'], upevneni: ['matice', 'D', 'hladka'] },
  };

  const VYCHOZI = {
    verze: 1, nazev: 'Knoflík', typ: 'potenciometr',
    telo: { prumer: 20, vyska: 16, hrana: 1, hranaTyp: 'zaobleni' },
    knopka: { tvar: 'hrib', krk: 14, lem: 4 },
    uchop: { typ: 'vroubky', pocet: 30, hloubka: 0.6, zaobleni: 1.5, sirka: 14 },
    naboj: { prumer: 16, vyska: 0 },
    ukazatel: { typ: 'ryska', hloubka: 0.8, sirka: 1.2 },
    sukne: { pouzit: false, prumer: 30, vyska: 3, dilku: 11, rozsah: 300, dlouhe: 5 },
    rukojet: { typ: 'zadna', prumer: 12, vyska: 28, poloha: 20, sroub: 'M4' },
    upevneni: {
      typ: 'D', hridel: 6, plocha: 4.5, zuby: 18, vyskaZubu: 0.5, hloubka: 11, stavaci: 'M3',
      sroub: 'M6', norma: 'ISO', vlozeni: 'shora', zapusteni: 0, pruchozi: true, pilot: 3.2, vybrani: 0, vybraniHloubka: 2,
    },
    vule: { hridel: 0.15, sroub: 0.4, matice: 0.2, kompenzace: 0.1 },
    tisk: { poloha: 'auto', mostek: 'mustkova', vrstva: 0.2, uhel: 45, material: 'PLA', kusu: 1 },
  };
  /** Meze číselných polí [min, max, celé?]. */
  const MEZE = {
    'telo.prumer': [8, 150], 'telo.vyska': [3, 100], 'telo.hrana': [0, 20],
    'knopka.krk': [4, 120], 'knopka.lem': [0.5, 60],
    'uchop.pocet': [3, 120, 1], 'uchop.hloubka': [0, 20], 'uchop.zaobleni': [0, 20], 'uchop.sirka': [2, 60],
    'naboj.prumer': [4, 120], 'naboj.vyska': [0, 80],
    'ukazatel.hloubka': [0.2, 4], 'ukazatel.sirka': [0.4, 6],
    'sukne.prumer': [10, 180], 'sukne.vyska': [1, 30], 'sukne.dilku': [0, 72, 1], 'sukne.rozsah': [30, 360], 'sukne.dlouhe': [1, 24, 1],
    'rukojet.prumer': [5, 50], 'rukojet.vyska': [5, 150], 'rukojet.poloha': [4, 120],
    'upevneni.hridel': [1.5, 30], 'upevneni.plocha': [0.5, 30], 'upevneni.vyskaZubu': [0.1, 2], 'upevneni.hloubka': [1, 120],
    'upevneni.zapusteni': [0, 30], 'upevneni.pilot': [1, 16], 'upevneni.vybrani': [0, 120], 'upevneni.vybraniHloubka': [0.2, 40],
    'vule.hridel': [-0.3, 1.5], 'vule.sroub': [-0.3, 2], 'vule.matice': [-0.3, 1.5], 'vule.kompenzace': [0, 1],
    'tisk.vrstva': [0.05, 0.5], 'tisk.uhel': [20, 75], 'tisk.kusu': [1, 30, 1],
  };
  const VYCTY = {
    typ: Object.keys(TYPY),
    'telo.hranaTyp': ['zaobleni', 'srazeni'],
    'knopka.tvar': ['hrib', 'valec', 'cocka'],
    'uchop.typ': Object.keys(NAZVY.uchop),
    'ukazatel.typ': ['zadny', 'ryska', 'sipka'],
    'rukojet.typ': ['zadna', 'pevna', 'otocna'], 'rukojet.sroub': ['M3', 'M4', 'M5', 'M6'],
    'upevneni.typ': Object.keys(NAZVY.upevneni), 'upevneni.zuby': [18, 20, 24],
    'upevneni.stavaci': ['M3', 'M4', 'M5'], 'upevneni.sroub': Object.keys(SROUBY), 'upevneni.norma': ['ISO', 'DIN'],
    'upevneni.vlozeni': ['shora', 'zespodu'],
    'tisk.poloha': ['auto', 'spodek', 'vrch'], 'tisk.mostek': ['zadny', 'obetovana', 'mustkova'], 'tisk.material': Object.keys(MATERIALY),
  };

  /** Předvolby: jen odchylky od výchozího projektu. */
  const PREDVOLBY = [
    { id: 'pot_d', nazev: 'Potenciometr – hřídel D 6 mm', popis: 'Ø 20, vroubkování, ryska',
      p: { nazev: 'Knoflík D6', typ: 'potenciometr' } },
    { id: 'pot_sukne', nazev: 'Potenciometr se sukní a stupnicí', popis: 'vroubkovaná hřídel 18 zubů, Ø 24 / sukně Ø 34, 11 dílků na 300°',
      p: { nazev: 'Knoflík se stupnicí', typ: 'potenciometr', telo: { prumer: 24, vyska: 17, hrana: 1.5 },
        uchop: { typ: 'drazky', pocet: 16, hloubka: 0.9 }, sukne: { pouzit: true, prumer: 34, vyska: 3 },
        upevneni: { typ: 'vroubek', zuby: 18, hloubka: 10 } } },
    { id: 'pot_hladka', nazev: 'Hladká hřídel ¼″ se stavěcím šroubem', popis: 'Ø 6,35, červík M3 + vložená matice, šipka',
      p: { nazev: 'Knoflík 6,35', typ: 'potenciometr', telo: { prumer: 26, vyska: 18, hrana: 2 }, uchop: { typ: 'drazky', pocet: 20, hloubka: 1 },
        ukazatel: { typ: 'sipka', hloubka: 1 }, upevneni: { typ: 'hladka', hridel: 6.35, hloubka: 13, stavaci: 'M3' } } },
    { id: 'hvezda_m8', nazev: 'Hvězdicová hlavice M8 – matice', popis: '5 ramen Ø 40, náboj Ø 20, matice zespodu, tisk lícem dolů',
      p: { nazev: 'Hvězdice M8', typ: 'sroub', telo: { prumer: 40, vyska: 12, hrana: 1, hranaTyp: 'srazeni' },
        uchop: { typ: 'hvezdice', pocet: 5, hloubka: 6, zaobleni: 2 }, naboj: { prumer: 20, vyska: 8 },
        upevneni: { typ: 'matice', sroub: 'M8', vlozeni: 'zespodu', pruchozi: true } } },
    { id: 'vroubek_m6', nazev: 'Vroubkovaná hlavice na šroub M6', popis: 'Ø 28, hlava šroubu vložená shora, tisk spodkem dolů',
      p: { nazev: 'Hlavice M6', typ: 'sroub', telo: { prumer: 28, vyska: 10, hrana: 1.2 }, uchop: { typ: 'vroubky', pocet: 28, hloubka: 0.8 },
        naboj: { prumer: 16, vyska: 0 }, upevneni: { typ: 'hlava', sroub: 'M6', vlozeni: 'shora' } } },
    { id: 'kridlo_m6', nazev: 'Křídlová hlavice M6', popis: 'rozpětí 50 mm, matice zespodu, tisk vrchem dolů bez podpor',
      p: { nazev: 'Křídlo M6', typ: 'sroub', telo: { prumer: 50, vyska: 22, hrana: 0 }, uchop: { typ: 'kridlo', sirka: 6, zaobleni: 7 },
        naboj: { prumer: 16, vyska: 0 }, upevneni: { typ: 'matice', sroub: 'M6', vlozeni: 'zespodu', pruchozi: true } } },
    { id: 't_m8', nazev: 'T-rukojeť M8', popis: 'příčka 70 × 16 mm, náboj Ø 20 × 14, matice zespodu',
      p: { nazev: 'T-rukojeť M8', typ: 'sroub', telo: { prumer: 70, vyska: 12, hrana: 1, hranaTyp: 'srazeni' }, uchop: { typ: 't', sirka: 16 },
        naboj: { prumer: 20, vyska: 14 }, upevneni: { typ: 'matice', sroub: 'M8', vlozeni: 'zespodu', pruchozi: true } } },
    { id: 'knopka_hrib', nazev: 'Knopka na šuplík – hřib (M4)', popis: 'Ø 30, krk 14, šroub M4 zezadu do vložené matice',
      p: { nazev: 'Knopka hřib', typ: 'knopka', telo: { prumer: 30, vyska: 26, hrana: 3 }, knopka: { tvar: 'hrib', krk: 14 },
        uchop: { typ: 'hladky' }, upevneni: { typ: 'matice', sroub: 'M4', hloubka: 16 } } },
    { id: 'knopka_valec', nazev: 'Knopka válec – samořezný vrut', popis: 'Ø 22 × 22, drážky, předvrtání 3,2 mm pro vrut 4 mm',
      p: { nazev: 'Knopka válec', typ: 'knopka', telo: { prumer: 22, vyska: 22, hrana: 3 }, knopka: { tvar: 'valec' },
        uchop: { typ: 'drazky', pocet: 12, hloubka: 0.8 }, upevneni: { typ: 'vrut', pilot: 3.2, hloubka: 15 } } },
    { id: 'knopka_cocka', nazev: 'Knopka čočka (M4)', popis: 'nízká Ø 36 × 16, matice M4 zezadu',
      p: { nazev: 'Knopka čočka', typ: 'knopka', telo: { prumer: 36, vyska: 16, hrana: 0 }, knopka: { tvar: 'cocka', lem: 5 },
        uchop: { typ: 'hladky' }, upevneni: { typ: 'matice', sroub: 'M4', hloubka: 12 } } },
    { id: 'kolo_m8', nazev: 'Kolečko Ø 60 s otočnou rukojetí (M8)', popis: 'na závitovou tyč M8, rukojeť na šroubu M4',
      p: { nazev: 'Kolečko M8', typ: 'kolecko', telo: { prumer: 60, vyska: 10, hrana: 1.5 }, uchop: { typ: 'vroubky', pocet: 48, hloubka: 0.8 },
        naboj: { prumer: 22, vyska: 8 }, rukojet: { typ: 'otocna', prumer: 14, vyska: 30, poloha: 22, sroub: 'M4' },
        upevneni: { typ: 'matice', sroub: 'M8', vlozeni: 'shora' } } },
    { id: 'kolo_hridel', nazev: 'Kolečko Ø 40 na hřídel 5 mm', popis: 'stavěcí šroub M3, pevná rukojeť',
      p: { nazev: 'Kolečko 5 mm', typ: 'kolecko', telo: { prumer: 40, vyska: 9, hrana: 1 }, uchop: { typ: 'drazky', pocet: 24, hloubka: 0.8 },
        naboj: { prumer: 14, vyska: 6 }, rukojet: { typ: 'pevna', prumer: 10, vyska: 22, poloha: 14 },
        upevneni: { typ: 'hladka', hridel: 5, hloubka: 15, stavaci: 'M3' } } },
  ];

  /* ---------------- pomocné ---------------- */
  const kopie = o => JSON.parse(JSON.stringify(o));
  const vezmi = (o, c) => c.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function poloz(o, c, h) { const k = c.split('.'); const l = k.pop(); k.reduce((a, x) => a[x], o)[l] = h; }
  const ctiCislo = s => (typeof s === 'number' ? s : Number(String(s).trim().replace(/\s/g, '').replace(',', '.').replace('−', '-')));
  function slij(cil, zdroj) {
    for (const k of Object.keys(zdroj || {})) {
      if (zdroj[k] && typeof zdroj[k] === 'object' && !Array.isArray(zdroj[k]) && cil[k] && typeof cil[k] === 'object') slij(cil[k], zdroj[k]);
      else cil[k] = zdroj[k];
    }
    return cil;
  }

  /** Doplní výchozí hodnoty, ořízne meze, opraví neznámé volby. → {p, hlaseni: [text]} */
  function normalizuj(vstup) {
    const p = kopie(VYCHOZI), hlaseni = [];
    const v = vstup && typeof vstup === 'object' ? vstup : {};
    if (typeof v.nazev === 'string') p.nazev = v.nazev.slice(0, 120);
    const listy = [];
    (function projdi(o, cesta) {
      for (const k of Object.keys(o)) {
        const c = cesta ? cesta + '.' + k : k;
        if (o[k] && typeof o[k] === 'object') projdi(o[k], c); else listy.push(c);
      }
    })(VYCHOZI, '');
    for (const c of listy) {
      if (c === 'nazev' || c === 'verze') continue;
      const h = vezmi(v, c), vych = vezmi(VYCHOZI, c);
      if (h === undefined || h === null) continue;
      if (typeof vych === 'boolean') { poloz(p, c, !!h); continue; }
      if (VYCTY[c]) {
        const moz = VYCTY[c], hh = typeof moz[0] === 'number' ? ctiCislo(h) : h;
        if (moz.includes(hh)) poloz(p, c, hh); else hlaseni.push(`${c}: neznámá volba „${h}“ → ${vych}`);
        continue;
      }
      if (typeof vych === 'number') {
        let x = ctiCislo(h);
        if (!Number.isFinite(x)) { hlaseni.push(`${c}: neplatné číslo → ${fmt(vych, 2)}`); continue; }
        const m = MEZE[c];
        if (m) {
          if (m[2]) x = Math.round(x);
          if (x < m[0] || x > m[1]) { const y = Math.min(m[1], Math.max(m[0], x)); hlaseni.push(`${c}: ${fmt(x, 2)} mimo rozsah → ${fmt(y, 2)}`); x = y; }
        }
        poloz(p, c, x);
      }
    }
    const T = TYPY[p.typ];
    if (!T.uchopy.includes(p.uchop.typ)) { hlaseni.push(`úchop „${p.uchop.typ}“ u tohoto typu není → ${T.uchopy[0]}`); p.uchop.typ = T.uchopy[0]; }
    if (!T.upevneni.includes(p.upevneni.typ)) { hlaseni.push(`upevnění „${p.upevneni.typ}“ u tohoto typu není → ${T.upevneni[0]}`); p.upevneni.typ = T.upevneni[0]; }
    return { p, hlaseni };
  }

  /** Přepnutí typu: rozumné výchozí hodnoty nového typu (nebo první předvolby toho typu). */
  function prepniTyp(p, typ) {
    const pv = PREDVOLBY.find(x => x.p.typ === typ);
    const q = slij(kopie(VYCHOZI), pv.p);
    q.nazev = p.nazev; q.vule = kopie(p.vule); q.tisk = kopie(p.tisk);
    return normalizuj(q).p;
  }
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }

  /* ---------------- odvozené rozměry ---------------- */
  function maticeRozmery(p, jmeno, hlava) {
    const t = SROUBY[jmeno], din = p.upevneni.norma === 'DIN';
    const s = din && t.sDin ? t.sDin : t.s;
    const h = hlava ? t.k : (din && t.mDin ? t.mDin : t.m);
    const S = s + p.vule.matice + p.vule.kompenzace;
    return { d: t.d, s, h, S, H: h + p.vule.matice, E: S * 2 / Math.sqrt(3) };
  }
  function polohaTisku(p) {
    if (p.tisk.poloha !== 'auto') return p.tisk.poloha;
    if (p.typ !== 'sroub') return 'spodek';
    if (p.naboj.vyska > 0 || p.uchop.typ === 'kridlo' || p.uchop.typ === 't') return 'vrch';
    return p.upevneni.typ === 'hlava' || p.upevneni.vlozeni === 'shora' ? 'spodek' : 'vrch';
  }

  function odvozene(p) {
    const R = p.telo.prumer / 2, H = p.telo.vyska, u = p.upevneni, V = p.vule;
    const hn = p.typ === 'sroub' || p.typ === 'kolecko' ? p.naboj.vyska : 0;
    const rn = p.naboj.prumer / 2;
    let Ztop = H;
    if (p.typ === 'kolecko') Ztop = H + hn;
    else if (p.typ === 'sroub' && p.uchop.typ !== 'kridlo') Ztop = hn + H;
    // vrstva úchopu (kde leží obrys s hranou nahoře)
    const z0 = p.typ === 'sroub' && p.uchop.typ !== 'kridlo' ? hn : 0, z1 = p.typ === 'kolecko' ? H : Ztop;
    const c = Math.max(0, Math.min(p.telo.hrana, R * 0.45, (z1 - z0) * 0.45));
    const poloha = polohaTisku(p);
    const o = { R, H, hn, rn, Ztop, z0, z1, c, poloha, podlozka: poloha === 'spodek' ? 'dole' : 'nahore' };
    o.hloubkaUchopu = ['vroubky', 'drazky', 'hvezdice'].includes(p.uchop.typ) ? p.uchop.hloubka : 0;
    o.vlozeni = p.typ === 'knopka' ? 'zespodu' : u.vlozeni;
    o.pruchozi = p.typ === 'kolecko' ? true : p.typ === 'knopka' ? false : u.pruchozi;
    if (['D', 'vroubek', 'hladka'].includes(u.typ)) {
      o.hridel = { D: u.hridel + V.hridel + V.kompenzace, hloubka: Math.min(u.hloubka, Ztop + 1) };
      o.hridel.pruchozi = u.hloubka >= Ztop - 1e-6;
    }
    if (u.typ === 'hladka') {
      const m = maticeRozmery(p, u.stavaci, false);
      const ds = m.d + V.sroub + V.kompenzace, rH = o.hridel.D / 2;
      const vyb = u.vybrani > 0 ? u.vybraniHloubka : 0;
      const zs = Math.max(p.typ === 'kolecko' ? H / 2 : Math.min(u.hloubka, Ztop) / 2, vyb + ds / 2 + 0.8);
      const xn = rH + 1 + m.H / 2;
      o.stavaci = { m, ds, zs, xn, horni: zs + m.S / Math.sqrt(3) };
    }
    if (u.typ === 'matice' || u.typ === 'hlava') {
      const m = maticeRozmery(p, u.sroub, u.typ === 'hlava');
      const hl = m.H + u.zapusteni;
      const kapsa = o.vlozeni === 'shora'
        ? { z0: Ztop - hl, z1: Ztop + 1, strop: Ztop - hl, smer: -1, otvira: 'nahore' }
        : { z0: -1, z1: hl, strop: hl, smer: 1, otvira: 'dole' };
      const dS = m.d + V.sroub + V.kompenzace;
      // otvor za stropem kapsy (smer = kam pokračuje od stropu)
      let pokracuje = true, konec;
      if (kapsa.otvira === 'nahore') konec = -1;
      else if (o.pruchozi) konec = Ztop + 1;
      else { konec = Math.min(u.hloubka, Ztop - 0.6); pokracuje = konec > hl + 0.05; }
      o.kapsa = Object.assign(kapsa, { m, dS, pokracuje, konec, hloubka: hl });
      o.kapsa.mostek = pokracuje && kapsa.otvira === o.podlozka ? p.tisk.mostek : 'zadny';
    }
    if (u.typ === 'vrut') o.vrut = { D: u.pilot + V.kompenzace, hloubka: Math.min(u.hloubka, Ztop - 0.6) };
    if (p.typ === 'kolecko' && p.rukojet.typ !== 'zadna') {
      const r = p.rukojet;
      o.rukojet = { r: r.prumer / 2, y: r.poloha, h: r.vyska };
      if (r.typ === 'otocna') {
        const m = maticeRozmery(p, r.sroub, false);
        o.rukojet.m = m; o.rukojet.dS = m.d + V.sroub + V.kompenzace;
        o.rukojet.mostek = o.podlozka === 'dole' ? p.tisk.mostek : 'zadny';
        o.rukojet.delkaSroubu = r.vyska + H;   // šroub prochází objímkou i kolem do matice
      }
    }
    if (p.typ === 'knopka') o.knopka = profilKnopky(p, R, H, c);
    // celková výška dílu (pevná rukojeť kolečka čouhá nad náboj)
    o.celkem = o.rukojet && p.rukojet.typ === 'pevna' ? Math.max(Ztop, H + o.rukojet.h) : Ztop;
    return o;
  }

  /* ---------------- obrysové profily (r, z) ---------------- */
  /** Body horní hrany od (R, H − c) do (R − c, H), zaoblení nebo sražení 45°. */
  function hranaBody(R, H, c, typ) {
    if (c < 0.01) return [[R, H]];
    if (typ === 'srazeni') return [[R, H - c], [R - c, H]];
    const n = Math.max(4, Math.ceil(c * 4)), b = [];
    for (let i = 0; i <= n; i++) { const a = Math.PI / 2 * i / n; b.push([R - c + c * Math.cos(a), H - c + c * Math.sin(a)]); }
    return b;
  }
  function profilKnopky(p, R, H, c) {
    const k = p.knopka, ht = p.telo.hranaTyp;
    if (k.tvar === 'valec') return { body: [[0, 0], [R, 0], ...hranaBody(R, H, c, ht), [0, H]] };
    if (k.tvar === 'cocka') {
      const e = Math.min(k.lem, H - 0.5), h = H - e;
      const Rs = (R * R + h * h) / (2 * h), zc = H - Rs, a0 = Math.atan2(e - zc, R), n = Math.max(8, Math.ceil(R * 0.8)), b = [[0, 0], [R, 0]];
      for (let i = 0; i <= n; i++) { const a = a0 + (Math.PI / 2 - a0) * i / n; b.push([Rs * Math.cos(a), zc + Rs * Math.sin(a)]); }
      b[b.length - 1] = [0, H];
      return { body: b, lem: e };
    }
    // hřib: pata, zúžený krk, kužel 45° pod hlavou (tiskne se bez podpor), svislý okraj, horní hrana
    const rk = Math.min(k.krk / 2, R - 0.5), rb = Math.min(R, rk * 1.3), zw = 0.3 * H, zKuzel = zw + (R - rk);
    // hlava se nevejde (hlásí kontroly) – kužel se usekne pod vrchem, obrys zůstane platný
    const Rc = Math.min(R, rk + Math.max(0, H - 0.5 - zw)), zc = zw + (Rc - rk);
    return { body: [[0, 0], [rb, 0], [rk, zw], [Rc, zc], ...hranaBody(Rc, H, Math.min(c, Math.max(0, H - zc - 0.3)), ht), [0, H]], zKuzel, rk };
  }
  /** Poloměr obrysu v profilu (r, z) ve výšce z – lineárně mezi body obrysu. */
  function polomerProfilu(body, z) {
    let r = 0;
    for (let i = 1; i < body.length; i++) {
      const [r0, z0] = body[i - 1], [r1, z1] = body[i];
      if ((z >= Math.min(z0, z1) - 1e-9) && (z <= Math.max(z0, z1) + 1e-9)) {
        const t = Math.abs(z1 - z0) < 1e-9 ? 1 : (z - z0) / (z1 - z0);
        r = Math.max(r, r0 + (r1 - r0) * t);
      }
    }
    return r;
  }
  /** Poloměr obálky s horní hranou ve výšce z. */
  function obalkaR(R, Ht, c, typ, z) {
    if (z <= Ht - c) return R;
    if (z > Ht) return 0;
    const d = z - (Ht - c);
    return typ === 'srazeni' ? R - d : R - c + Math.sqrt(Math.max(0, c * c - d * d));
  }
  /** Nejmenší vzdálenost vnějšího obrysu od osy ve výšce z (nejhorší směr – dno drážek). */
  function obrysR(p, o, z) {
    const R = o.R, dU = o.hloubkaUchopu, ht = p.telo.hranaTyp;
    if (p.typ === 'knopka') return Math.max(0, polomerProfilu(o.knopka.body, z) - dU);
    if (p.typ === 'potenciometr') return Math.min(obalkaR(R, o.H, o.c, ht, z), R - dU);
    if (p.typ === 'kolecko') return z <= o.H ? Math.min(obalkaR(R, o.H, o.c, ht, z), R - dU) : o.rn;
    // šroub
    if (p.uchop.typ === 'kridlo') return o.rn;
    if (z < o.hn) return o.rn;
    const zak = p.uchop.typ === 't' ? Math.max(o.rn, p.uchop.sirka / 2) : Math.max(o.hn > 0 ? o.rn : 0, R - dU);
    return Math.min(obalkaR(R, o.Ztop, o.c, ht, z), zak);
  }
  function obrysRmin(p, o, za, zb) {
    let r = Infinity;
    const a = Math.max(0, za), b = Math.min(o.Ztop, zb);
    for (let i = 0; i <= 16; i++) r = Math.min(r, obrysR(p, o, a + (b - a) * i / 16));
    return r;
  }

  /* ---------------- kontroly zadání ---------------- */
  /** → [{uroven: 'chyba'|'varovani'|'info', text, pole: [cesta], oprava?: {text, pole, hodnota}}] */
  function kontroly(p) {
    const H = [], o = odvozene(p), u = p.upevneni;
    const hl = (uroven, text, pole, oprava) => H.push({ uroven, text, pole: pole ? [].concat(pole) : [], oprava });
    const R = o.R;
    if (p.telo.hrana > o.c + 0.01) hl('info', `Hrana omezena na ${fmt(o.c, 2)} mm (nejvýš 45 % poloměru a výšky).`, 'telo.hrana');

    // úchop
    const n = p.uchop.pocet, rozt = 2 * Math.PI * R / n;
    if (p.uchop.typ === 'vroubky' && 2 * p.uchop.hloubka > 0.9 * rozt)
      hl('varovani', `Vroubky splývají: šířka drážky ${fmt(2 * p.uchop.hloubka, 2)} mm, rozteč ${fmt(rozt, 2)} mm – uberte počet nebo hloubku.`, ['uchop.pocet', 'uchop.hloubka']);
    if (p.uchop.typ === 'vroubky' && rozt < 1.2)
      hl('varovani', `Rozteč vroubků ${fmt(rozt, 2)} mm je pod možnostmi trysky 0,4 mm – vroubky se slijí.`, 'uchop.pocet');
    if ((p.uchop.typ === 'drazky' || p.uchop.typ === 'vroubky') && p.uchop.hloubka === 0) hl('info', 'Hloubka úchopu 0 – povrch zůstane hladký.', 'uchop.hloubka');
    if (p.uchop.typ === 'hvezdice') {
      if (p.uchop.hloubka > 0.6 * R) hl('chyba', `Hloubka mezi rameny ${fmt(p.uchop.hloubka)} mm je víc než 60 % poloměru – ramena se odtrhnou.`, 'uchop.hloubka',
        { text: `hloubka ${fmt(0.35 * R)} mm`, pole: 'uchop.hloubka', hodnota: Math.round(3.5 * R) / 10 });
      // sousední výřezy se nesmí slít, jinak se ramena oddělí od středu
      const rs = R * Math.sin(Math.PI / n) * 0.8, dc = R + rs - p.uchop.hloubka, krk = 2 * dc * Math.sin(Math.PI / n) - 2 * rs;
      if (krk < 1.5 && p.uchop.hloubka <= 0.6 * R) {
        const hmax = Math.floor((R + rs - (rs + 0.75) / Math.sin(Math.PI / n)) * 10) / 10;
        hl('chyba', `Výřezy mezi rameny se u středu slévají (spojka ${fmt(krk, 2)} mm) – ramena by se oddělila.`, ['uchop.hloubka', 'uchop.pocet'],
          hmax > 0.5 ? { text: `hloubka ${fmt(hmax)} mm`, pole: 'uchop.hloubka', hodnota: hmax } : undefined);
      }
      if (n > 12) hl('varovani', 'Hvězdice s víc než 12 rameny – úchop se blíží vroubkování.', 'uchop.pocet');
    }
    if (p.uchop.typ === 't' || p.uchop.typ === 'kridlo') {
      if (p.uchop.sirka >= p.telo.prumer * 0.8) hl('chyba', 'Šířka příčky/křídla je skoro jako celý průměr.', 'uchop.sirka');
      if (p.uchop.sirka < 3) hl('varovani', 'Křídlo/příčka tenčí než 3 mm se snadno ulomí.', 'uchop.sirka');
    }
    if ((p.typ === 'sroub' && (p.naboj.vyska > 0 || p.uchop.typ === 't' || p.uchop.typ === 'kridlo')) || p.typ === 'kolecko') {
      if (o.rn > R - 1) hl('chyba', `Náboj Ø ${fmt(p.naboj.prumer)} je skoro stejně velký jako úchop Ø ${fmt(p.telo.prumer)}.`, 'naboj.prumer');
    }
    if (p.typ === 'sroub' && p.uchop.typ === 't' && p.naboj.vyska < 4) hl('varovani', 'T-rukojeť bez náboje (výška < 4 mm) – matice drží jen v příčce.', 'naboj.vyska');

    // knopka
    if (p.typ === 'knopka') {
      const k = o.knopka;
      if (p.knopka.tvar === 'hrib') {
        if (p.knopka.krk >= p.telo.prumer - 1) hl('chyba', 'Krk hřibu musí být užší než hlava.', 'knopka.krk');
        else if (k.zKuzel > p.telo.vyska - 1) hl('chyba', `Hlava hřibu se nevejde: kužel 45° pod hlavou končí ve výšce ${fmt(k.zKuzel)} mm – zvyšte knopku nebo rozšiřte krk.`, ['telo.vyska', 'knopka.krk'],
          { text: `výška ${fmt(Math.ceil(k.zKuzel + 3))} mm`, pole: 'telo.vyska', hodnota: Math.ceil(k.zKuzel + 3) });
      }
      if (p.knopka.tvar === 'cocka' && p.knopka.lem > p.telo.vyska - 0.5) hl('chyba', 'Lem čočky musí být nižší než celá výška.', 'knopka.lem');
    }

    // ukazatel a sukně
    if (p.typ === 'potenciometr') {
      if (p.ukazatel.typ !== 'zadny' && p.ukazatel.hloubka > o.H - (o.hridel ? o.hridel.hloubka : 0) - 0.6 && !o.hridel.pruchozi)
        hl('chyba', 'Ukazatel je hlubší než strop nad hřídelí – prořízne se skrz.', 'ukazatel.hloubka');
      if (p.sukne.pouzit) {
        const s = p.sukne, Rs = s.prumer / 2;
        if (Rs < R + 2) hl('chyba', `Sukně Ø ${fmt(s.prumer)} musí být aspoň o 4 mm větší než knoflík Ø ${fmt(p.telo.prumer)}.`, 'sukne.prumer',
          { text: `sukně Ø ${fmt(p.telo.prumer + 10)}`, pole: 'sukne.prumer', hodnota: p.telo.prumer + 10 });
        if (s.vyska >= o.H - 1) hl('chyba', 'Sukně je vysoká jako celý knoflík.', 'sukne.vyska');
        if (s.dilku > 1) {
          const krok = (s.rozsah >= 360 ? s.rozsah / s.dilku : s.rozsah / (s.dilku - 1)) * Math.PI / 180 * Rs;
          if (krok < 1.6) hl('varovani', `Dílky stupnice jsou na obvodu jen ${fmt(krok, 2)} mm od sebe – splynou.`, 'sukne.dilku');
          if (s.vyska < 1.4) hl('varovani', 'Sukně nižší než 1,4 mm – dílky (hloubka 0,6 mm) ji skoro proříznou.', 'sukne.vyska');
        }
      }
    }

    // hřídel
    if (o.hridel) {
      const rH = o.hridel.D / 2;
      if (u.typ === 'D') {
        if (u.plocha >= u.hridel) hl('chyba', 'Rozměr přes plošku musí být menší než průměr hřídele.', 'upevneni.plocha');
        else if (u.plocha < 0.55 * u.hridel) hl('chyba', 'Ploška zabírá skoro půl hřídele – takový rozměr přes plošku nedává smysl.', 'upevneni.plocha');
      }
      if (u.typ === 'vroubek' && 2 * Math.PI * rH / u.zuby < 0.8)
        hl('info', `Zuby po ${fmt(2 * Math.PI * rH / u.zuby, 2)} mm tryska 0,4 mm nevykreslí přesně – drážky drží spíš sevřením. Pomůže malá vůle (0–0,1).`, 'upevneni.zuby');
      const zDo = o.hridel.pruchozi ? o.Ztop : o.hridel.hloubka;
      const stena = obrysRmin(p, o, 0, zDo) - rH;
      if (stena < 0.8) hl('chyba', `Stěna kolem hřídele jen ${fmt(stena, 2)} mm.`, ['telo.prumer', 'upevneni.hridel']);
      else if (stena < 1.6) hl('varovani', `Stěna kolem hřídele ${fmt(stena, 2)} mm – doporučeno aspoň 1,6 mm (4 perimetry).`, 'telo.prumer');
      if (!o.hridel.pruchozi) {
        const strop = o.Ztop - u.hloubka;
        if (strop < 1) hl('chyba', `Nad hřídelí zbývá jen ${fmt(strop, 2)} mm – zkraťte hloubku, nebo ji nastavte ≥ výšce (průchozí).`, 'upevneni.hloubka',
          { text: `hloubka ${fmt(o.Ztop - 1.6)} mm`, pole: 'upevneni.hloubka', hodnota: Math.round((o.Ztop - 1.6) * 10) / 10 });
      } else if (p.typ === 'potenciometr') hl('info', 'Otvor pro hřídel je průchozí (hloubka ≥ výška knoflíku).', 'upevneni.hloubka');
      if (p.typ === 'potenciometr' && u.hloubka < 6) hl('varovani', `Hřídel zasahuje jen ${fmt(u.hloubka)} mm – knoflík se bude viklat (doporučeno 8–12 mm).`, 'upevneni.hloubka');
      if (u.vybrani > 0) {
        if (u.vybrani / 2 > obrysRmin(p, o, 0, u.vybraniHloubka) - 1.2) hl('chyba', 'Vybrání ve spodku je širší než knoflík.', 'upevneni.vybrani');
        if (u.vybrani <= o.hridel.D) hl('varovani', 'Vybrání je užší než otvor hřídele – nemá účinek.', 'upevneni.vybrani');
        if (u.vybraniHloubka >= u.hloubka - 2) hl('chyba', 'Vybrání je skoro hluboké jako otvor hřídele – hřídel nebude kde držet.', 'upevneni.vybraniHloubka');
      }
    }
    if (o.stavaci) {
      const s = o.stavaci, rH = o.hridel.D / 2;
      const rohX = s.xn + s.m.H / 2, rohY = s.m.S / 2;
      const stena = obrysRmin(p, o, 0, s.horni) - Math.hypot(rohX, rohY);
      if (stena < 0.6) hl('chyba', `Matice stavěcího šroubu se nevejde do stěny (zbývá ${fmt(stena, 2)} mm) – zvětšete průměr knoflíku.`, 'telo.prumer',
        { text: `Ø ${fmt(Math.ceil(2 * (Math.hypot(rohX, rohY) + o.hloubkaUchopu + 1.8)))}`, pole: 'telo.prumer', hodnota: Math.ceil(2 * (Math.hypot(rohX, rohY) + o.hloubkaUchopu + 1.8)) });
      else if (stena < 1.2) hl('varovani', `Stěna za maticí stavěcího šroubu jen ${fmt(stena, 2)} mm.`, 'telo.prumer');
      if (s.zs + s.ds / 2 > Math.min(u.hloubka, o.Ztop) - 0.3) hl('chyba', 'Stavěcí šroub leží nad koncem hřídele – prodlužte hloubku hřídele.', 'upevneni.hloubka');
      if (s.horni > o.Ztop - 0.8) hl('chyba', 'Drážka pro matici stavěcího šroubu je vyšší než knoflík.', ['telo.vyska', 'upevneni.hloubka']);
      hl('info', `Stavěcí šroub ${u.stavaci} (červík) délky ≥ ${fmt(Math.ceil(s.xn + s.m.H / 2 - rH + 2))} mm, otvor je kapkovitý (tiskne se bez podpor), matici zasuňte zespodu.`, 'upevneni.stavaci');
      if (rohX - s.m.H - rH < 0.5) hl('varovani', 'Matice stavěcího šroubu je velmi blízko otvoru hřídele.', 'upevneni.hridel');
    }

    // kapsa matice / hlavy
    if (o.kapsa) {
      const k = o.kapsa, m = k.m;
      if (u.typ === 'hlava' && o.vlozeni === 'zespodu')
        hl('chyba', 'Hlava šroubu vložená zespodu by se při utahování vytrhla – vložte ji shora.', 'upevneni.vlozeni', { text: 'vložit shora', pole: 'upevneni.vlozeni', hodnota: 'shora' });
      const zA = Math.max(0, k.z0), zB = Math.min(o.Ztop, k.z1);
      const stena = obrysRmin(p, o, zA, zB) - m.E / 2;
      const kde = (p.typ === 'sroub' && (o.hn > 0 && zA < o.hn)) || p.uchop.typ === 'kridlo' ? 'naboj.prumer' : 'telo.prumer';
      const nav = Math.ceil(2 * (m.E / 2 + 2 + (kde === 'telo.prumer' ? o.hloubkaUchopu : 0)));
      if (stena < 0.8) hl('chyba', `Stěna kolem ${u.typ === 'hlava' ? 'hlavy šroubu' : 'matice'} jen ${fmt(stena, 2)} mm (rohy šestihranu ${fmt(m.E, 2)} mm).`, kde,
        { text: `Ø ${fmt(nav)}`, pole: kde, hodnota: nav });
      else if (stena < 1.6) hl('varovani', `Stěna kolem ${u.typ === 'hlava' ? 'hlavy' : 'matice'} ${fmt(stena, 2)} mm – doporučeno aspoň 1,6 mm.`, kde, { text: `Ø ${fmt(nav)}`, pole: kde, hodnota: nav });
      if (k.otvira === 'nahore' && k.z0 < 0.8) hl('chyba', `Kapsa (${fmt(k.hloubka)} mm) je hlubší než celý díl – pod ní nezbývá materiál.`, ['upevneni.zapusteni', 'telo.vyska']);
      if (k.otvira === 'dole' && k.strop > o.Ztop - 0.8) hl('chyba', `Kapsa (${fmt(k.hloubka)} mm) je vyšší než díl – nad ní nezbývá materiál.`, ['upevneni.zapusteni', 'telo.vyska']);
      if (p.typ === 'sroub' && o.hn > 0 && o.vlozeni === 'zespodu' && k.strop > o.hn + 0.01 && p.uchop.typ !== 'kridlo')
        hl('info', 'Kapsa sahá nad náboj do úchopu.', 'naboj.vyska');
      if (k.pokracuje && k.otvira === 'dole' && !o.pruchozi) {
        const st2 = obrysRmin(p, o, k.strop, k.konec) - k.dS / 2;
        if (st2 < 0.8) hl('chyba', `Otvor pro šroub nad kapsou prorazí obrys (stěna ${fmt(st2, 2)} mm) – zkraťte hloubku.`, 'upevneni.hloubka');
      }
      if (p.typ === 'knopka' && u.hloubka <= k.strop + 1) hl('info', 'Šroub skončí v matici – otvor nad maticí se nevytvoří.', 'upevneni.hloubka');
      if (k.mostek === 'zadny' && k.pokracuje && k.otvira === o.podlozka)
        hl('varovani', 'Strop kapsy s otvorem pro šroub visí ve vzduchu – vrstvy kolem otvoru nemají o co se opřít. Zapněte můstkovou vrstvu nebo obětovanou vrstvu.', 'tisk.mostek',
          { text: 'můstková vrstva', pole: 'tisk.mostek', hodnota: 'mustkova' });
      if (k.mostek === 'obetovana') hl('info', `Obětovaná vrstva ${fmt(p.tisk.vrstva, 2)} mm zakryje otvor nad kapsou – po tisku ji propíchněte šroubem nebo vrtákem Ø ${fmt(m.d)}.`, 'tisk.mostek');
      if (k.mostek === 'mustkova') hl('info', `Můstková vrstva: 2 × ${fmt(p.tisk.vrstva, 2)} mm nad kapsou (štěrbina a čtverec) – strop se tiskne bez podpor; výšku vrstvy nastavte jako ve sliceru.`, 'tisk.vrstva');
      if (u.typ === 'matice' && p.typ !== 'kolecko' && o.vlozeni === 'zespodu' && !o.pruchozi && p.typ === 'sroub')
        hl('info', 'Neprůchozí: závitová tyč skončí v hlavici (uzavřený vrch).', 'upevneni.pruchozi');
    }
    if (o.vrut) {
      const stena = obrysRmin(p, o, 0, o.vrut.hloubka) - o.vrut.D / 2;
      if (stena < 1.2) hl('chyba', `Stěna kolem otvoru pro vrut jen ${fmt(stena, 2)} mm.`, 'upevneni.pilot');
      if (u.hloubka > o.Ztop - 0.6) hl('varovani', 'Otvor pro vrut je skoro hluboký jako knopka – omezen tak, aby vrch zůstal celý.', 'upevneni.hloubka');
    }

    // rukojeť kolečka
    if (o.rukojet) {
      const r = o.rukojet;
      if (r.y + r.r > R - 0.5) hl('varovani', 'Rukojeť přesahuje okraj kolečka.', ['rukojet.poloha', 'rukojet.prumer']);
      if (r.y - r.r < o.rn + 0.5 && p.naboj.vyska > 0) hl('chyba', 'Rukojeť zasahuje do náboje – posuňte ji dál od středu.', 'rukojet.poloha',
        { text: `poloha ${fmt(Math.ceil(o.rn + r.r + 1.5))} mm`, pole: 'rukojet.poloha', hodnota: Math.ceil(o.rn + r.r + 1.5) });
      if (r.m) {
        if (r.m.H > p.telo.vyska - 1.2) hl('chyba', `Matice rukojeti (${fmt(r.m.H, 2)} mm) se nevejde do kolečka tloušťky ${fmt(p.telo.vyska)} mm.`, 'telo.vyska');
        const okraj = R - o.hloubkaUchopu - (r.y + r.m.E / 2);
        if (okraj < 1.2) hl('varovani', `Matice rukojeti je jen ${fmt(okraj, 2)} mm od okraje kolečka.`, 'rukojet.poloha');
        if (r.r - r.dS / 2 < 1.6) hl('chyba', `Stěna otočné objímky jen ${fmt(r.r - r.dS / 2, 2)} mm – zvětšete průměr rukojeti.`, 'rukojet.prumer');
        if (r.mostek === 'zadny') hl('varovani', 'Strop kapsy matice rukojeti s otvorem visí ve vzduchu – zapněte můstkovou vrstvu.', 'tisk.mostek',
          { text: 'můstková vrstva', pole: 'tisk.mostek', hodnota: 'mustkova' });
        hl('info', `Rukojeť: šroub ${p.rukojet.sroub} × ${fmt(Math.ceil(r.delkaSroubu))} mm (válcová hlava) přes objímku do matice zespodu kolečka; objímka se volně otáčí (vůle ${fmt(p.vule.sroub, 2)} mm).`, 'rukojet.sroub');
      }
    }

    // tisková poloha a hrana
    if (o.c > 1.2 && p.telo.hranaTyp === 'zaobleni' && o.poloha === 'vrch' && p.uchop.typ !== 'kridlo')
      hl('varovani', `Zaoblená hrana ${fmt(o.c)} mm leží na podložce – první vrstvy pod ní visí. Sražení 45° se tiskne čistě.`, 'telo.hranaTyp',
        { text: 'sražení 45°', pole: 'telo.hranaTyp', hodnota: 'srazeni' });
    if (p.vule.kompenzace === 0) hl('info', 'Kompenzace děr je 0 – malé díry z FDM tiskárny obvykle vycházejí o 0,1–0,2 mm menší.', 'vule.kompenzace');
    return H;
  }

  /* ---------------- stavba přes manifold ---------------- */
  const segmenty = r => Math.max(24, Math.min(160, Math.ceil(2 * Math.PI * r / 0.35 / 4) * 4));

  /** Postaví díly. w = inicializovaný manifold. → {dily: [{jmeno, nazev, poz, idx, objem, barva, otocit}], cas} */
  function postav(w, p) {
    const t0 = Date.now();
    const o = odvozene(p);
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const kruh = (r, x = 0, y = 0) => k(k(CS.circle(r, segmenty(r))).translate([x, y]));
    /** Díra: opsaný mnohoúhelník, aby i ploché strany ležely na jmenovitém poloměru. */
    const kruhDira = (r, x = 0, y = 0) => { const n = segmenty(r); return k(k(CS.circle(r / Math.cos(Math.PI / n), n)).translate([x, y])); };
    const obdelnik = (x0, y0, x1, y1) => k(k(CS.square([x1 - x0, y1 - y0])).translate([x0, y0]));
    const poly = body => k(new CS([body], 'NonZero'));
    const vysun = (cs, za, zb) => k(k(cs.extrude(Math.abs(zb - za))).translate([0, 0, Math.min(za, zb)]));
    const rotace = (n, f) => { const c = []; for (let i = 0; i < n; i++) c.push(k(f(i).rotate(360 * i / n))); return c; };
    const otoc = (profil, r) => k(poly(profil).revolve(segmenty(r)));
    const R = o.R, ht = p.telo.hranaTyp, uc = p.uchop;

    /** 2D obrys úchopu (vroubky, drážky, hvězdice); null = hladký. */
    function profilUchopu(Rz) {
      const n = uc.pocet, h = uc.hloubka, rozt = 2 * Math.PI * Rz / n;
      if (uc.typ === 'vroubky' && h > 0) {
        const z = poly([[Rz - h, 0], [Rz + 2, h + 2], [Rz + 2, -(h + 2)]]);
        return k(k(CS.circle(Rz + 1, segmenty(Rz))).subtract(k(CS.union(rotace(n, () => z)))));
      }
      if (uc.typ === 'drazky' && h > 0) {
        const rf = Math.max(h, 0.3 * rozt), d = kruh(rf, Rz + rf - h, 0);
        return k(k(CS.circle(Rz + 1, segmenty(Rz))).subtract(k(CS.union(rotace(n, () => d)))));
      }
      if (uc.typ === 'hvezdice') {
        const rs = Rz * Math.sin(Math.PI / n) * 0.8, d = kruh(rs, Rz + rs - h, 0);
        // výřezy mezi rameny natočené tak, že rameno míří k +Y
        let cs = k(kruh(Rz).subtract(k(k(CS.union(rotace(n, () => d))).rotate(90 + 180 / n))));
        const z = Math.min(uc.zaobleni, rs * 0.9);
        if (z > 0.05) cs = k(k(cs.offset(-z, 'Round', 2, segmenty(z))).offset(z, 'Round', 2, segmenty(z)));
        if (o.hn > 0) cs = k(cs.add(kruh(o.rn)));
        return cs;
      }
      return null;
    }
    /** Těleso úchopu mezi za a zb s horní hranou: obálka (rotace profilu) ∩ vysunutý obrys. */
    function uchopTeleso(za, zb, Rz) {
      const prof = profilUchopu(Rz);
      const Rob = prof && uc.typ === 'hvezdice' ? Rz + 0.05 : Rz;
      const obal = otoc([[0, za], [Rob, za], ...hranaBody(Rob, zb, o.c, ht), [0, zb]], Rz);
      return prof ? k(obal.intersect(vysun(prof, za - 0.01, zb + 0.01))) : obal;
    }

    try {
      const plne = [], odebrat = [];
      /* ---- tělo podle typu ---- */
      if (p.typ === 'potenciometr') {
        plne.push(uchopTeleso(0, o.H, R));
        if (p.sukne.pouzit) {
          const s = p.sukne, Rs = s.prumer / 2;
          plne.push(otoc([[0, 0], [Rs, 0], ...hranaBody(Rs, s.vyska, Math.min(0.4, s.vyska / 3), 'srazeni'), [0, s.vyska]], Rs));
          // dílky stupnice: vybrání v horní ploše sukně, každý „dlouhe“-tý přes celou šířku
          if (s.dilku > 0) {
            const hd = Math.min(0.6, s.vyska - 0.6), wd = 0.8, kroky = s.rozsah >= 360 ? s.dilku : Math.max(1, s.dilku - 1);
            for (let i = 0; i < s.dilku; i++) {
              const dl = i % s.dlouhe === 0, r0 = dl ? R + 0.6 : Rs - (Rs - R) * 0.5;
              const a = s.dilku === 1 ? 0 : -s.rozsah / 2 + s.rozsah * i / kroky;
              odebrat.push(k(vysun(obdelnik(-wd / 2, r0, wd / 2, Rs + 1), s.vyska - hd, s.vyska + 1).rotate([0, 0, -a])));
            }
          }
        }
        if (p.ukazatel.typ !== 'zadny') {
          const hu = p.ukazatel.hloubka, wu = p.ukazatel.sirka;
          if (p.ukazatel.typ === 'ryska') odebrat.push(vysun(obdelnik(-wu / 2, R * 0.3, wu / 2, R + 1), o.H - hu, o.H + 1));
          else {
            const yt = R - o.c - 0.8, hl2 = Math.min(R * 0.35, 3 * wu + 1), hw = Math.max(wu * 1.8, 1.5), sw = wu / 2, y0 = Math.max(0, yt - R * 0.75);
            odebrat.push(vysun(poly([[0, yt], [-hw, yt - hl2], [-sw, yt - hl2], [-sw, y0], [sw, y0], [sw, yt - hl2], [hw, yt - hl2]]), o.H - hu, o.H + 1));
          }
        }
      } else if (p.typ === 'kolecko') {
        plne.push(uchopTeleso(0, o.H, R));
        if (o.hn > 0) plne.push(otoc([[0, o.H - 0.01], [o.rn, o.H - 0.01], ...hranaBody(o.rn, o.Ztop, Math.min(0.6, o.hn / 2), 'srazeni'), [0, o.Ztop]], o.rn));
        if (o.rukojet && p.rukojet.typ === 'pevna') {
          const r = o.rukojet;
          plne.push(k(otoc([[0, o.H - 0.01], [r.r, o.H - 0.01], ...hranaBody(r.r, o.H + r.h, Math.min(r.r * 0.6, 2.5), 'zaobleni'), [0, o.H + r.h]], r.r).translate([0, r.y, 0])));
        }
        if (o.rukojet && o.rukojet.m) {
          const r = o.rukojet, m = r.m;
          odebrat.push(vysun(k(k(CS.circle(m.E / 2, 6)).translate([0, r.y])), -1, m.H));
          dirySeStropem(odebrat, { x: 0, y: r.y, strop: m.H, smer: 1, konec: o.H + 1, d: r.dS, S: m.S, E: m.E, mostek: r.mostek });
        }
      } else if (p.typ === 'sroub') {
        if (uc.typ === 'kridlo') {
          // křídlo: konvexní obal paty u náboje, horní hrany a zaobleného rohu, deska tloušťky „sirka“ v rovině XZ.
          // Roh je sražený 45° od horní plochy a zaoblený – vrchem na podložce se tiskne bez převisů.
          const wk = uc.sirka, rk = Math.max(0.5, Math.min(uc.zaobleni, o.Ztop / 3, R / 3));
          const xb = Math.sqrt(Math.max(0.01, o.rn * o.rn - wk * wk / 4)) * 0.98, zc = o.Ztop - rk * Math.SQRT2;
          const body = [[-xb, 0], [xb, 0], [R - rk, o.Ztop], [-(R - rk), o.Ztop]];
          for (const sx of [-1, 1]) for (let i = 0; i < 24; i++) { const a = 2 * Math.PI * i / 24; body.push([sx * (R - rk) + rk * Math.cos(a), zc + rk * Math.sin(a)]); }
          const kr = k(k(k(CS.hull([poly(body)])).extrude(wk)).translate([0, 0, -wk / 2]));
          plne.push(k(kr.transform([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1])));
          plne.push(otoc([[0, 0], [o.rn, 0], ...hranaBody(o.rn, o.Ztop, Math.min(o.c, o.rn / 3), ht), [0, o.Ztop]], o.rn));
        } else {
          if (o.hn > 0) plne.push(otoc([[0, 0], [o.rn, 0], [o.rn, o.hn], [0, o.hn]], o.rn));   // dotýká se úchopu přesně v z = hn
          if (uc.typ === 't') {
            const wk = uc.sirka / 2;
            let bar = k(CS.hull([kruh(wk, -(R - wk), 0), kruh(wk, R - wk, 0)]));
            bar = k(bar.add(kruh(Math.max(o.rn, wk))));
            const obal = otoc([[0, o.hn], [R + 0.05, o.hn], ...hranaBody(R + 0.05, o.Ztop, o.c, ht), [0, o.Ztop]], R);
            plne.push(k(obal.intersect(vysun(bar, o.hn - 0.01, o.Ztop + 0.01))));
          } else plne.push(uchopTeleso(o.hn, o.Ztop, R));
        }
      } else if (p.typ === 'knopka') {
        const obal = otoc(o.knopka.body, R), prof = profilUchopu(R);
        plne.push(prof ? k(obal.intersect(vysun(prof, -0.01, o.H + 0.01))) : obal);
      }

      /* ---- upevnění v ose ---- */
      if (o.hridel) {
        const u = p.upevneni, rH = o.hridel.D / 2, zb = o.hridel.pruchozi ? o.Ztop + 1 : u.hloubka;
        let dira;
        if (u.typ === 'D') {
          const dD = u.plocha + p.vule.hridel + p.vule.kompenzace;   // rozměr přes plošku s vůlí
          dira = k(kruhDira(rH).intersect(obdelnik(-rH - 1, -rH - 1, rH + 1, dD - rH)));
        } else if (u.typ === 'vroubek') {
          const n = u.zuby, ri = rH - u.vyskaZubu, b = [];
          for (let i = 0; i < 2 * n; i++) { const a = Math.PI * i / n + Math.PI / 2, r = i % 2 ? ri : rH; b.push([r * Math.cos(a), r * Math.sin(a)]); }
          dira = poly(b);
        } else dira = kruhDira(rH);
        odebrat.push(vysun(dira, -1, zb));
        if (u.vybrani > 0) odebrat.push(vysun(kruhDira(u.vybrani / 2 + p.vule.kompenzace / 2), -1, u.vybraniHloubka));
        if (o.stavaci) {
          const s = o.stavaci, rs = s.ds / 2;
          // kapkovitý otvor (špička nahoru 45°) – vodorovná díra bez podpor; v rovině (y, z), vysunutý podél +X
          const kapka = k(CS.hull([kruhDira(rs), poly([[-0.01, rs * Math.SQRT2], [0.01, rs * Math.SQRT2], [0, rs * Math.SQRT2 - 0.02]])]));
          const delka = Math.max(R, p.sukne.pouzit && p.typ === 'potenciometr' ? p.sukne.prumer / 2 : 0) + 2;
          odebrat.push(k(k(kapka.extrude(delka)).transform([0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, s.zs, 1])));
          // drážka pro matici: otevřená dole, ploché strany matice ke stěnám ±Y
          odebrat.push(vysun(obdelnik(s.xn - s.m.H / 2, -s.m.S / 2, s.xn + s.m.H / 2, s.m.S / 2), -1, s.horni));
        }
      }
      if (o.kapsa) {
        const kp = o.kapsa;
        odebrat.push(vysun(k(CS.circle(kp.m.E / 2, 6)), kp.z0, kp.z1));
        if (kp.pokracuje) dirySeStropem(odebrat, { x: 0, y: 0, strop: kp.strop, smer: kp.smer, konec: kp.konec, d: kp.dS, S: kp.m.S, E: kp.m.E, mostek: kp.mostek });
      }
      if (o.vrut) odebrat.push(vysun(kruhDira(o.vrut.D / 2), -1, o.vrut.hloubka));

      /** Otvor navazující na strop kapsy, s volitelnou úpravou stropu pro tisk (obětovaná / můstková vrstva). */
      function dirySeStropem(cil, d) {
        const t = p.tisk.vrstva, s = d.smer, z = d.strop, r = d.d / 2;
        const sest = k(k(CS.circle(d.E / 2, 6)).translate([d.x, d.y]));
        let zDira = z - s * 0.01;
        if (d.mostek === 'obetovana') zDira = z + s * t;
        else if (d.mostek === 'mustkova') {
          // 1. vrstva: štěrbina šířky otvoru přes celý šestihran (mosty se opřou o stěny kapsy),
          // 2. vrstva: čtverec o straně otvoru (mosty se opřou o 1. vrstvu), pak kulatý otvor
          const sterbina = k(sest.intersect(obdelnik(d.x - d.E, d.y - r, d.x + d.E, d.y + r)));
          cil.push(vysun(sterbina, z - s * 0.01, z + s * t));
          cil.push(vysun(obdelnik(d.x - r, d.y - r, d.x + r, d.y + r), z + s * (t - 0.01), z + s * 2 * t));
          zDira = z + s * (2 * t - 0.01);
        }
        if ((d.konec - zDira) * s > 0.01) cil.push(vysun(kruhDira(r, d.x, d.y), zDira, d.konec));
      }

      let telo = k(M.union(plne));
      if (odebrat.length) telo = k(M.difference([telo, ...odebrat]));

      const sit = (m0, jmeno, nazev, barva, otocit) => {
        // sloučit téměř shodné vrcholy z booleanů (jinak by se v float32 slily do degenerovaných trojúhelníků)
        const m = k(m0.simplify(1e-3));
        const st = m.status();
        if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
        if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
        const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties, tv = mesh.triVerts;
        // svařit vrcholy shodné ve float32 a vypustit trojúhelníky, které se tím zúží na úsečku
        const f32 = new Float32Array(3), mapa = new Map(), novy = new Int32Array(vp.length / np), poz0 = [];
        for (let i = 0, v = 0; i < vp.length; i += np, v++) {
          f32[0] = vp[i]; f32[1] = vp[i + 1]; f32[2] = vp[i + 2];
          const kl = f32[0] + ',' + f32[1] + ',' + f32[2];
          let j = mapa.get(kl);
          if (j === undefined) { j = poz0.length / 3; mapa.set(kl, j); poz0.push(f32[0], f32[1], f32[2]); }
          novy[v] = j;
        }
        const idx = [];
        for (let t = 0; t < tv.length; t += 3) {
          const a = novy[tv[t]], b = novy[tv[t + 1]], c = novy[tv[t + 2]];
          if (a !== b && b !== c && a !== c) idx.push(a, b, c);
        }
        let poz = new Float32Array(poz0), ix = new Uint32Array(idx);
        if (!KRAB.kontrolaSite(poz, ix).uzavrena) {
          // svaření by porušilo těsnost (tenký výběžek) – raději síť přesně z manifoldu
          poz = new Float32Array(vp.length / np * 3);
          for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
          ix = new Uint32Array(tv);
        }
        return { jmeno, nazev, poz, idx: ix, objem: m.volume(), barva, otocit };
      };
      const nazevHl = (p.nazev || NAZVY.typ[p.typ]).trim() || 'Knoflík';
      const dily = [sit(telo, 'knoflik', nazevHl, '#4F86D9', o.poloha === 'vrch')];
      if (o.rukojet && o.rukojet.m) {
        const r = o.rukojet, ri = r.dS / 2 + 0.1;
        const obj = k(otoc([[ri, 0], [r.r, 0], ...hranaBody(r.r, r.h, Math.min(1.2, (r.r - ri) / 2), 'zaobleni'), [ri, r.h]], r.r).translate([0, r.y, o.H]));
        dily.push(sit(obj, 'objimka', 'Otočná objímka rukojeti', '#E0A040', false));
      }
      return { dily, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  /* ---------------- tisková poloha a rozbor převisů ---------------- */
  /** Díly v tiskové poloze: otočené (vrch na podložku), z ≥ 0, rozmístěné do řad bez překryvu; kusu = počet sad. */
  function tiskoveRozlozeni(dily, kusu = 1, mezera = 6, sirkaPodlozky = 200) {
    const polozky = [];
    for (let i = 0; i < kusu; i++) for (const d of dily) polozky.push(Object.assign({}, d, { nazev: d.nazev + (kusu > 1 ? ` ${i + 1}` : '') }));
    let x = 0, y = 0, radek = 0;
    const out = polozky.map(d => {
      const P = new Float32Array(d.poz.length);
      for (let i = 0; i < P.length; i += 3) {
        P[i] = d.poz[i];
        P[i + 1] = d.otocit ? -d.poz[i + 1] : d.poz[i + 1];
        P[i + 2] = d.otocit ? -d.poz[i + 2] : d.poz[i + 2];
      }
      const b = obal(P), sx = b[3] - b[0], sy = b[4] - b[1];
      if (x > 0 && x + sx > sirkaPodlozky) { x = 0; y += radek + mezera; radek = 0; }
      for (let i = 0; i < P.length; i += 3) { P[i] += x - b[0]; P[i + 1] += y - b[1]; P[i + 2] -= b[2]; }
      x += sx + mezera; radek = Math.max(radek, sy);
      return Object.assign({}, d, { poz: P });
    });
    // vycentrovat kolem počátku
    const B = obal(out.reduce((a, d) => { a.push(...obal(d.poz).slice(0, 3), ...obal(d.poz).slice(3)); return a; }, []));
    const cx = (B[0] + B[3]) / 2, cy = (B[1] + B[4]) / 2;
    for (const d of out) for (let i = 0; i < d.poz.length; i += 3) { d.poz[i] -= cx; d.poz[i + 1] -= cy; }
    return out;
  }
  function obal(poz) {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < poz.length; i += 3) for (let j = 0; j < 3; j++) { const v = poz[i + j]; if (v < b[j]) b[j] = v; if (v > b[j + 3]) b[j + 3] = v; }
    return b;
  }
  /** Plochy směřující dolů v tiskové poloze (bez plochy na podložce): převisy nad „uhel“ od svislice a vodorovné stropy (mosty). */
  function rozborTisku(dil, uhel) {
    const P = dil.poz, I = dil.idx, mez = -Math.sin(uhel * Math.PI / 180) - 0.02;
    let zmin = Infinity;
    for (let i = 2; i < P.length; i += 3) zmin = Math.min(zmin, P[i]);
    let previs = 0, most = 0;
    for (let t = 0; t < I.length; t += 3) {
      const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
      if (Math.max(P[a + 2], P[b + 2], P[c + 2]) < zmin + 0.01) continue;   // leží na podložce
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
      if (l < 1e-12) continue;
      const cz = nz / l, A = l / 2;
      if (cz < -0.985) most += A; else if (cz < mez) previs += A;
    }
    return { previs, most };
  }
  function kontrolyModelu(p, tiskDily) {
    const H = [];
    for (const d of tiskDily) {
      const r = rozborTisku(d, p.tisk.uhel);
      if (r.previs > 2) H.push({ uroven: 'varovani', pole: ['tisk.poloha'], text: `${d.nazev}: převisy nad ${fmt(p.tisk.uhel)}° od svislice ${fmt(r.previs, 0)} mm² – v této poloze potřebuje podpory.` });
      if (r.most > 0.5) H.push({ uroven: 'info', pole: ['tisk.mostek'], text: `${d.nazev}: vodorovné stropy (mosty) ${fmt(r.most, 0)} mm² – tiskárna je přemostí.` });
    }
    return H;
  }

  /* ---------------- projekt ---------------- */
  function popis(p) {
    const u = p.upevneni, n = NAZVY;
    const upev = u.typ === 'matice' || u.typ === 'hlava' ? `${n.upevneni[u.typ]} ${u.sroub}` : u.typ === 'vrut' ? `vrut Ø ${fmt(u.pilot, 1)}` : `${n.upevneni[u.typ]} Ø ${fmt(u.hridel, 2)}`;
    return `${n.typ[p.typ]} Ø ${fmt(p.telo.prumer)} × ${fmt(p.telo.vyska)} mm · ${n.uchop[p.uchop.typ]} · ${upev}`;
  }
  const ulozProjekt = p => JSON.stringify({ typ: 'knofliky', verze: 1, projekt: p }, null, 1);
  function nactiProjekt(text) {
    let j;
    try { j = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON.'); }
    if (!j || j.typ !== 'knofliky' || !j.projekt) throw new Error('Soubor není projekt Knoflíků a hlavic.');
    return normalizuj(j.projekt);
  }

  const API = {
    SROUBY, MATERIALY, NAZVY, TYPY, VYCHOZI, MEZE, VYCTY, PREDVOLBY,
    normalizuj, prepniTyp, predvolba, odvozene, kontroly, postav, tiskoveRozlozeni, rozborTisku, kontrolyModelu,
    maticeRozmery, polohaTisku, obrysR, hranaBody, popis, ulozProjekt, nactiProjekt, kopie, vezmi, poloz, fmt, obal, segmenty,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.KNOF = API;
})();

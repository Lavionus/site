/* Lustrová stínítka – jádro generátoru (bez DOM a bez three.js, spustitelné v node).
   Těleso = „rotace s proměnným profilem“: pro každý úhel θ uzavřená smyčka v rovině (r, z)
   (úchyt → vnější stěna se vzorem → okraj ústí → vnitřní stěna → zpět k úchytu). Sousední smyčky
   se sešijí čtyřúhelníky, takže síť je uzavřená z konstrukce – bez booleovských operací.
   Body smyčky s r = 0 (osa) jsou společné všem sloupcům (plné těleso pro režim váza).
   Souřadnice: osa Z = osa stínítka, z = 0 je hrdlo (strana objímky), ústí je nahoře. */
(function () {
  'use strict';
  const KRAB = typeof module !== 'undefined' ? require('../krabicky/jadro.js') : window.KRAB;
  const fmt = (x, des = 1) => (des === 0 ? KRAB.fmt(Math.round(x), 1) : KRAB.fmt(x, des));
  const TAU = Math.PI * 2;
  const atobX = typeof atob === 'function' ? atob : s => Buffer.from(s, 'base64').toString('binary');

  /* ---------------- tabulky ---------------- */
  /** Průběh poloměru od hrdla (t = 0) k ústí (t = 1): f = podíl rozevření, b = tvar vyboulení. */
  const PROFILY = {
    kuzel: { nazev: 'Kužel', f: t => t, b: t => Math.sin(Math.PI * t) },
    zvon: { nazev: 'Zvon', f: t => t * t, b: t => Math.sin(Math.PI * t) },
    tulipan: { nazev: 'Tulipán', f: t => t * t * (3 - 2 * t), b: t => Math.sin(Math.PI * t) },
    lilie: { nazev: 'Lilie', f: t => t * t * t, b: t => Math.sin(Math.PI * t) },
    miska: { nazev: 'Miska', f: t => Math.sin(t * Math.PI / 2), b: t => Math.sin(Math.PI * t) },
    koule: { nazev: 'Koule', f: t => t, b: t => Math.sin(Math.PI * t) * (1 - 0.25 * Math.cos(Math.PI * t)) },
    vlastni: { nazev: 'Vlastní', f: t => t, b: t => Math.sin(Math.PI * t) },
  };
  const VZORY = {
    hladky: 'hladký', zebra: 'žebra', plise: 'plisé', fazety: 'fazety (mnohoúhelník)', dyne: 'dýně (laloky)',
    vlny: 'vodorovné vlny', kosoctverce: 'kosočtverce', bubliny: 'bubliny', vlnita: 'vlnitá žebra',
  };
  const PRUBEHY = { rovne: 'rovnoměrně', usti: 'sílí k ústí', hrdlo: 'sílí k hrdlu', stred: 'nejhlubší uprostřed' };
  const OKRAJE = { rovny: 'rovný', vlnka: 'vlnka', zuby: 'zuby', obloucky: 'obloučky' };
  const UCHYTY = { deska: 'deska s otvorem na objímku', fitter: 'krček do držáku lustru', zadny: 'bez úchytu (otevřené)' };
  /** Otvor pro objímku se závitem a převlečným kroužkem – typické hodnoty, ověřte posuvkou. */
  const OBJIMKY = { E14: 29, E27: 40.5 };
  /** Žárovky: d = největší průměr skla, l = délka skla (typické rozměry). */
  const ZAROVKY = {
    zadna: { nazev: 'nekontrolovat', d: 0, l: 0 },
    svicka: { nazev: 'E14 svíčka C35', d: 35, l: 75 },
    kapka: { nazev: 'E14 kapka P45', d: 45, l: 60 },
    e14koule: { nazev: 'E14 koule G45', d: 45, l: 55 },
    a60: { nazev: 'E27 A60', d: 60, l: 80 },
    g95: { nazev: 'E27 globe G95', d: 95, l: 110 },
  };
  const MATERIALY = {
    PLA: { nazev: 'PLA', hustota: 1.24, teplota: 55 },
    PETG: { nazev: 'PETG', hustota: 1.27, teplota: 70 },
    ASA: { nazev: 'ASA', hustota: 1.07, teplota: 95 },
  };
  /** Barva filamentu → délka útlumu λ (mm) pro T = e^(−tloušťka/λ); hrubý orientační model. */
  const BARVY = {
    natural: { nazev: 'natural (průsvitná)', lambda: 3 },
    bila: { nazev: 'bílá', lambda: 1 },
    barevna: { nazev: 'barevná (sytá)', lambda: 0.6 },
  };
  const KVALITY = { hruba: 0.6, normalni: 1, jemna: 1.8 };

  const VYCHOZI = {
    verze: 2, nazev: 'Stínítko',
    tvar: { profil: 'tulipan', hrdlo: 50, usti: 110, vyska: 100, vybouleni: 8, stena: 1.2, body: [] },
    vzor: { typ: 'zebra', pocet: 24, hloubka: 2.5, zkrut: 0, vlny: 6, nabeh: 6, prubeh: 'rovne' },
    vzor2: { typ: 'hladky', pocet: 8, hloubka: 1.5, zkrut: 0, vlny: 4, prubeh: 'rovne' },
    okraj: { typ: 'rovny', pocet: 12, hloubka: 6 },
    lito: { pouzit: false, data: '', sirka: 0, vyska: 0, tMin: 0.8, tMax: 3, opakovani: 1, okrajDole: 6, okrajNahore: 6, invert: false, rozliseni: 0.5 },
    uchyt: { typ: 'deska', objimka: 'E14', otvor: 29, deska: 2.4, fitter: 57.2, krk: 14, lem: 2.5 },
    zarovka: { typ: 'svicka', odsazeni: 5 },
    montaz: 'nahoru', kvalita: 'normalni',
    tisk: { poloha: 'auto', uhel: 50, material: 'PLA', barva: 'bila', kusu: 1, tryska: 0.4, podlozka: 220 },
  };
  /** Meze číselných polí [min, max, celé?]. */
  const MEZE = {
    'tvar.hrdlo': [10, 300], 'tvar.usti': [10, 400], 'tvar.vyska': [15, 400], 'tvar.vybouleni': [-60, 120], 'tvar.stena': [0.4, 6],
    'vzor.pocet': [2, 120, 1], 'vzor.hloubka': [0, 30], 'vzor.zkrut': [-720, 720], 'vzor.vlny': [1, 40, 1], 'vzor.nabeh': [0, 200],
    'vzor2.pocet': [2, 120, 1], 'vzor2.hloubka': [0, 30], 'vzor2.zkrut': [-720, 720], 'vzor2.vlny': [1, 40, 1],
    'okraj.pocet': [2, 72, 1], 'okraj.hloubka': [0, 80],
    'lito.sirka': [0, 2000, 1], 'lito.vyska': [0, 2000, 1], 'lito.tMin': [0.4, 6], 'lito.tMax': [0.6, 8], 'lito.opakovani': [1, 12, 1],
    'lito.okrajDole': [0, 200], 'lito.okrajNahore': [0, 200], 'lito.rozliseni': [0.25, 1.5],
    'uchyt.otvor': [8, 120], 'uchyt.deska': [0.8, 10], 'uchyt.krk': [4, 60], 'uchyt.lem': [1, 10],
    'zarovka.odsazeni': [-40, 60],
    'tisk.uhel': [20, 75], 'tisk.kusu': [1, 12, 1], 'tisk.tryska': [0.2, 1.2], 'tisk.podlozka': [100, 600],
  };
  const VZORY2 = Object.keys(VZORY).filter(k => k !== 'fazety');
  const VYCTY = {
    'tvar.profil': Object.keys(PROFILY), 'vzor.typ': Object.keys(VZORY), 'vzor2.typ': VZORY2,
    'vzor.prubeh': Object.keys(PRUBEHY), 'vzor2.prubeh': Object.keys(PRUBEHY), 'okraj.typ': Object.keys(OKRAJE),
    'uchyt.typ': Object.keys(UCHYTY), 'uchyt.objimka': ['E14', 'E27', 'vlastni'],
    'uchyt.fitter': [41.3, 57.2, 82.6, 101.6, 152.4],
    'zarovka.typ': Object.keys(ZAROVKY), montaz: ['nahoru', 'dolu'], kvalita: Object.keys(KVALITY),
    'tisk.poloha': ['auto', 'hrdlo', 'usti'], 'tisk.material': Object.keys(MATERIALY), 'tisk.barva': Object.keys(BARVY),
  };
  const MAX_BODU = 12, MAX_OBRAZEK = 400000;

  const PREDVOLBY = [
    { id: 'tulipan', nazev: '🌷 Tulipán se žebry', popis: 'E14, na rameno lustru', p: {} },
    { id: 'zvon', nazev: '🔔 Zvon plisé', popis: 'E14, závěsný', p: { nazev: 'Zvon', montaz: 'dolu', tvar: { profil: 'zvon', hrdlo: 55, usti: 130, vyska: 105, vybouleni: 0 }, vzor: { typ: 'plise', pocet: 32, hloubka: 3, nabeh: 4 } } },
    { id: 'lilie', nazev: '🌸 Lilie s obloučky', popis: 'E14, okraj zvlněný', p: { nazev: 'Lilie', tvar: { profil: 'lilie', hrdlo: 55, usti: 125, vyska: 95, vybouleni: 6 }, vzor: { typ: 'vlnita', pocet: 10, hloubka: 2.5, vlny: 2 }, okraj: { typ: 'obloucky', pocet: 10, hloubka: 10 } } },
    { id: 'koule', nazev: '🔮 Koule s vlnami', popis: 'krček 2¼″ do držáku', p: { nazev: 'Koule', montaz: 'dolu', tvar: { profil: 'koule', hrdlo: 52, usti: 90, vyska: 120, vybouleni: 30 }, vzor: { typ: 'vlny', hloubka: 1.6, vlny: 9, nabeh: 10 }, uchyt: { typ: 'fitter', fitter: 57.2 }, zarovka: { typ: 'kapka', odsazeni: 25 } } },
    { id: 'fazety', nazev: '💎 Kroucené fazety', popis: 'kužel, šestiúhelník', p: { nazev: 'Fazety', tvar: { profil: 'kuzel', hrdlo: 60, usti: 120, vyska: 100, vybouleni: 0 }, vzor: { typ: 'fazety', pocet: 6, zkrut: 60, nabeh: 0 } } },
    { id: 'dyne', nazev: '🎃 Dýně', popis: 'miska, laloky', p: { nazev: 'Dýně', montaz: 'dolu', tvar: { profil: 'miska', hrdlo: 50, usti: 140, vyska: 80, vybouleni: 4 }, vzor: { typ: 'dyne', pocet: 12, hloubka: 5, nabeh: 30 } } },
    { id: 'kosoctverce', nazev: '🔶 Kosočtverce', popis: 'válec, E27', p: { nazev: 'Válec', tvar: { profil: 'kuzel', hrdlo: 120, usti: 120, vyska: 130, vybouleni: 0 }, vzor: { typ: 'kosoctverce', pocet: 16, hloubka: 2.5, vlny: 5, nabeh: 0 }, uchyt: { objimka: 'E27' }, zarovka: { typ: 'a60' } } },
    { id: 'spirala', nazev: '🌀 Spirála', popis: 'zvon, kroucená žebra', p: { nazev: 'Spirála', montaz: 'dolu', tvar: { profil: 'zvon', hrdlo: 50, usti: 120, vyska: 95, vybouleni: 10 }, vzor: { typ: 'zebra', pocet: 18, hloubka: 2.5, zkrut: 150 }, okraj: { typ: 'vlnka', pocet: 18, hloubka: 3 } } },
    { id: 'vaza', nazev: '🏺 Baňka (vlastní křivka)', popis: 'žebra + vlny, sílí k ústí', p: { nazev: 'Baňka', tvar: { profil: 'vlastni', hrdlo: 50, usti: 80, vyska: 110, vybouleni: 0, body: [[0.3, 52], [0.65, 56]] }, vzor: { typ: 'zebra', pocet: 20, hloubka: 2.5, prubeh: 'usti', nabeh: 10 }, vzor2: { typ: 'vlny', hloubka: 1, vlny: 7 }, zarovka: { typ: 'kapka' } } },
    { id: 'lucerna', nazev: '🏮 Lucerna pro litofanii', popis: 'válec E27 – vložte obrázek', p: { nazev: 'Lucerna', tvar: { profil: 'kuzel', hrdlo: 110, usti: 110, vyska: 120, vybouleni: 0 }, vzor: { typ: 'hladky' }, lito: { pouzit: true }, uchyt: { objimka: 'E27' }, zarovka: { typ: 'a60' }, tisk: { barva: 'bila' } } },
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
  const frac = x => x - Math.floor(x);
  const tri = x => 1 - Math.abs(2 * frac(x) - 1);          // trojúhelník 0..1, vrchol v x = 0,5
  const hladce = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const omez = (x, a, b) => Math.min(b, Math.max(a, x));

  /** Body vlastní křivky: [[z 0..1, r mm]], seřazené, oříznuté, nejvýš MAX_BODU. */
  function normalizujBody(v) {
    if (!Array.isArray(v)) return [];
    return v.filter(b => Array.isArray(b) && Number.isFinite(ctiCislo(b[0])) && Number.isFinite(ctiCislo(b[1])))
      .map(b => [Math.round(omez(ctiCislo(b[0]), 0.02, 0.98) * 1e4) / 1e4, Math.round(omez(ctiCislo(b[1]), 2, 250) * 100) / 100])
      .sort((a, b) => a[0] - b[0]).slice(0, MAX_BODU);
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
        if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) projdi(o[k], c); else listy.push(c);
      }
    })(VYCHOZI, '');
    for (const c of listy) {
      if (c === 'nazev' || c === 'verze') continue;
      const h = vezmi(v, c), vych = vezmi(VYCHOZI, c);
      if (h === undefined || h === null) continue;
      if (c === 'tvar.body') { poloz(p, c, normalizujBody(h)); continue; }
      if (typeof vych === 'boolean') { poloz(p, c, !!h); continue; }
      if (typeof vych === 'string' && !VYCTY[c]) {
        if (typeof h === 'string' && h.length <= MAX_OBRAZEK) poloz(p, c, h); else hlaseni.push(`${c}: neplatná data`);
        continue;
      }
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
    if (p.lito.data && p.lito.data.length * 3 / 4 < p.lito.sirka * p.lito.vyska - 3) { hlaseni.push('lito: obrázek je poškozený → vypnuto'); p.lito.data = ''; }
    return { p, hlaseni };
  }
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }

  /* ---------------- odvozené rozměry ---------------- */
  function odvozene(p) {
    const u = p.uchyt, o = { uchyt: u.typ };
    o.otvor = u.objimka === 'vlastni' ? u.otvor : OBJIMKY[u.objimka];
    o.rHrdlo = p.tvar.hrdlo / 2;
    o.z0 = 0;                                   // kde začíná tělo stínítka
    if (u.typ === 'fitter') {
      o.rLem = u.fitter / 2;                    // vnější poloměr lemu krčku
      o.rKrk = o.rLem - u.lem;                  // vnější poloměr trubky krčku = hrdlo těla
      o.rHrdlo = o.rKrk;
      o.z0 = u.krk;
      o.vyskaLemu = Math.max(2, u.lem * 1.2);
    }
    o.H = p.tvar.vyska;                          // výška těla (bez krčku)
    o.celkem = o.z0 + o.H;
    o.lito = litoAktivni(p);
    return o;
  }
  function polohaTisku(p, rozbor) {
    if (p.tisk.poloha !== 'auto') return p.tisk.poloha;
    if (rozbor) return rozbor.usti.skore < rozbor.hrdlo.skore * 0.7 ? 'usti' : 'hrdlo';
    return 'hrdlo';
  }

  /* ---------------- litofanie ---------------- */
  const litoAktivni = p => !!(p.lito.pouzit && p.lito.data && p.lito.sirka > 1 && p.lito.vyska > 1);
  let litoCache = { data: null, px: null };
  /** Odstíny šedi (0 = černá … 255 = bílá) z base64. */
  function litoPixely(p) {
    if (litoCache.data !== p.lito.data) {
      const s = atobX(p.lito.data), px = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) px[i] = s.charCodeAt(i);
      litoCache = { data: p.lito.data, px };
    }
    return litoCache.px;
  }
  /** Kódování pixelů šedi do base64 (pro UI a testy). */
  function litoZakoduj(px) {
    let s = '';
    for (let i = 0; i < px.length; i += 8192) s += String.fromCharCode.apply(null, px.subarray(i, i + 8192));
    return typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
  }

  /* ---------------- povrch ---------------- */
  /** Hermitova křivka přes body [[z, r]] s tečnami z konečných diferencí. */
  function krivka(B) {
    return s => {
      let i = 0;
      while (i < B.length - 2 && s > B[i + 1][0]) i++;
      const [z0, r0] = B[i], [z1, r1] = B[i + 1], h = z1 - z0 || 1e-6;
      const tecna = k => (k <= 0 ? (B[1][1] - B[0][1]) / (B[1][0] - B[0][0] || 1e-6)
        : k >= B.length - 1 ? (B[k][1] - B[k - 1][1]) / (B[k][0] - B[k - 1][0] || 1e-6)
          : (B[k + 1][1] - B[k - 1][1]) / (B[k + 1][0] - B[k - 1][0] || 1e-6));
      const t = omez((s - z0) / h, -0.5, 1.5), t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * r0 + (t3 - 2 * t2 + t) * h * tecna(i) + (-2 * t3 + 3 * t2) * r1 + (t3 - t2) * h * tecna(i + 1);
    };
  }
  /** Funkce vzoru d(θ, s) (mm, ven) pro jedno nastavení vzoru V. */
  function vzorFce(V, nabeh) {
    const n = V.pocet, A = V.hloubka, zk = V.zkrut * Math.PI / 180, m = V.vlny;
    const obalka = { rovne: () => 1, usti: s => 0.15 + 0.85 * s, hrdlo: s => 1 - 0.85 * s, stred: s => Math.sin(Math.PI * omez(s, 0, 1)) }[V.prubeh] || (() => 1);
    return (th, s) => {
      if (V.typ === 'hladky' || V.typ === 'fazety' || A <= 0) return 0;
      const u = n * (th + zk * s), sl = nabeh > 0 ? hladce(s / nabeh) : 1;
      let d;
      switch (V.typ) {
        case 'zebra': d = 0.5 + 0.5 * Math.cos(u); break;
        case 'plise': d = tri(u / TAU + 0.5); break;
        case 'dyne': d = Math.pow(Math.abs(Math.sin(u / 2)), 0.5); break;
        case 'vlny': d = 0.5 - 0.5 * Math.cos(TAU * m * s); break;
        case 'kosoctverce': d = Math.min(tri(u / TAU + m * s), tri(u / TAU - m * s)) * 2; break;
        case 'bubliny': d = Math.max(0, Math.cos(u) * Math.cos(TAU * m * s)); break;
        case 'vlnita': d = 0.5 + 0.5 * Math.cos(u + 1.6 * Math.sin(TAU * m * s)); break;
        default: d = 0;
      }
      return A * Math.min(1, d) * sl * obalka(s);
    };
  }
  /** Tvarová funkce stínítka: vnější poloměr r(θ, s), s = výška těla / H; tloušťka stěny tl(θ, s); výška okraje. */
  function povrch(p) {
    const o = odvozene(p), T = p.tvar, V = p.vzor, P = PROFILY[T.profil];
    const rn = o.rHrdlo, ru = T.usti / 2, n = V.pocet, zk = V.zkrut * Math.PI / 180;
    const nabeh = V.nabeh / o.H;
    const zakladProfil = T.profil === 'vlastni' ? krivka([[0, rn]].concat(T.body, [[1, ru]])) : s => rn + (ru - rn) * P.f(s);
    const zaklad = s => zakladProfil(s) + T.vybouleni * P.b(omez(s, 0, 1));
    const v1 = vzorFce(V, nabeh), v2 = vzorFce(p.vzor2, nabeh);
    function r(th, s) {
      let z = zaklad(s);
      if (V.typ === 'fazety') {
        // mnohoúhelník s rohy na základním poloměru, plošky uvnitř; náběh plynule z kruhu
        const a = frac((th + zk * s) * n / TAU) * TAU / n - Math.PI / n;
        const k = Math.cos(Math.PI / n) / Math.cos(a), sl = nabeh > 0 ? hladce(s / nabeh) : 1;
        z *= 1 + (k - 1) * sl;
      }
      return z + v1(th, s) + v2(th, s);
    }
    /** Výška okraje ústí v úhlu θ (H minus výřez). */
    function vyskaOkraje(th) {
      const O = p.okraj; if (O.typ === 'rovny' || O.hloubka <= 0) return o.H;
      const x = frac(th * O.pocet / TAU);
      let e;
      if (O.typ === 'vlnka') e = 0.5 - 0.5 * Math.cos(TAU * x);
      else if (O.typ === 'zuby') e = tri(x);
      else e = Math.sqrt(Math.max(0, 1 - (2 * x - 1) * (2 * x - 1)));   // obloučky: hroty mezi oblouky
      return o.H - Math.min(O.hloubka, o.H * 0.6) * e;
    }
    // tloušťka: konstantní, nebo litofanie (tmavé = tlustší)
    let tl = () => T.stena;
    if (o.lito) {
      const L = p.lito, px = litoPixely(p), W = L.sirka, Hh = L.vyska;
      const sa = L.okrajDole / o.H, sb = 1 - L.okrajNahore / o.H, dolu = p.montaz === 'dolu';
      const jas = (u, v) => {   // bilineárně, u se opakuje dokola
        const x = frac(u) * W - 0.5, y = omez(v * Hh - 0.5, 0, Hh - 1);
        const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, y1 = Math.min(Hh - 1, y0 + 1);
        const X0 = (x0 + W) % W, X1 = (x0 + 1 + W) % W;
        const a = px[y0 * W + X0] * (1 - fx) + px[y0 * W + X1] * fx, b = px[y1 * W + X0] * (1 - fx) + px[y1 * W + X1] * fx;
        return (a * (1 - fy) + b * fy) / 255;
      };
      const nabehL = 3 / o.H;                               // plynulý přechod z rámu do obrazu (bez schodu uvnitř)
      tl = (th, s) => {
        if (s < sa || s > sb || sb <= sa) return T.stena;
        const k = hladce(Math.min(s - sa, sb - s) / nabehL);
        let u = frac(th * L.opakovani / TAU);
        if (dolu) u = 1 - u;                               // zavěšené: obraz se otočí, aby nebyl zrcadlově
        const v = dolu ? (s - sa) / (sb - sa) : (sb - s) / (sb - sa);
        const j = L.invert ? 1 - jas(u, v) : jas(u, v);
        return T.stena + (L.tMin + (1 - j) * (L.tMax - L.tMin) - T.stena) * k;
      };
    }
    return { r, tl, vyskaOkraje, zaklad, o };
  }

  function rozliseni(p) {
    const k = KVALITY[p.kvalita], V = p.vzor, V2 = p.vzor2;
    let N = 160;
    if (V.typ !== 'hladky' && V.typ !== 'vlny') N = Math.max(N, V.pocet * (V.typ === 'fazety' ? 1 : 16));
    if (V2.typ !== 'hladky' && V2.typ !== 'vlny' && V2.hloubka > 0) N = Math.max(N, V2.pocet * 16);
    if (p.okraj.typ !== 'rovny') N = Math.max(N, p.okraj.pocet * 16);
    N = Math.min(1440, Math.round(N * k));
    let K = 80;
    if (['vlny', 'kosoctverce', 'bubliny', 'vlnita'].includes(V.typ)) K = Math.max(K, V.vlny * 14);
    if (['vlny', 'kosoctverce', 'bubliny', 'vlnita'].includes(V2.typ) && V2.hloubka > 0) K = Math.max(K, V2.vlny * 14);
    if (V.zkrut || V2.zkrut) K = Math.max(K, 120);
    if (p.tvar.profil === 'vlastni') K = Math.max(K, 100);
    K = Math.min(600, Math.round(K * k));
    if (litoAktivni(p)) {                       // litofanie: vzorek po „rozlišení“ mm
      const rMax = Math.max(p.tvar.hrdlo, p.tvar.usti) / 2 + Math.max(0, p.tvar.vybouleni);
      N = Math.max(N, Math.min(1600, Math.ceil(TAU * rMax / p.lito.rozliseni)));
      K = Math.max(K, Math.min(600, Math.ceil(p.tvar.vyska / p.lito.rozliseni)));
    }
    if (V.typ === 'fazety' && !V.zkrut) N = Math.max(V.pocet, Math.round(N / V.pocet)) * V.pocet;   // rohy přesně ve vzorcích
    return { N, K };
  }

  /* ---------------- stavba sítě ---------------- */
  /** Sešije smyčky (pole N smyček po M bodech [r, z]) kolem osy Z do uzavřené sítě. Body s r = 0 sdílí všechny sloupce. */
  function rotuj(smycky, uhly) {
    const N = smycky.length, M = smycky[0].length / 2;
    const osa = [], idOsy = new Int32Array(M).fill(-1);
    for (let i = 0; i < M; i++) if (smycky[0][2 * i] === 0) { idOsy[i] = N * M + osa.length; osa.push(smycky[0][2 * i + 1]); }
    const poz = new Float32Array((N * M + osa.length) * 3);
    for (let j = 0; j < N; j++) {
      const c = Math.cos(uhly[j]), s = Math.sin(uhly[j]), L = smycky[j];
      for (let i = 0; i < M; i++) { const v = 3 * (j * M + i); poz[v] = L[2 * i] * c; poz[v + 1] = L[2 * i] * s; poz[v + 2] = L[2 * i + 1]; }
    }
    osa.forEach((z, k) => { poz[3 * (N * M + k) + 2] = z; });
    const id = (j, i) => (idOsy[i] >= 0 ? idOsy[i] : j * M + i);
    const idx = new Uint32Array(N * M * 6);
    let t = 0;
    const troj = (a, b, c) => { if (a !== b && b !== c && a !== c) { idx[t++] = a; idx[t++] = b; idx[t++] = c; } };
    for (let j = 0; j < N; j++) {
      const j2 = (j + 1) % N;
      for (let i = 0; i < M; i++) {
        const i2 = (i + 1) % M, a = id(j, i), b = id(j2, i), c = id(j2, i2), d = id(j, i2);
        troj(a, b, c); troj(a, c, d);
      }
    }
    return { poz, idx: idx.slice(0, t) };
  }

  /** Stínítko → { dily: [{poz, idx, …}], kontrola, stena: {min, max}, rInMin, rInDeska, N, K, M, druh, tlV, cas }.
      volby.vaza = plné těleso pro režim váza (jen vnější povrch, uvnitř plno). */
  function postav(p, volby = {}) {
    const t0 = Date.now();
    const { r, tl, vyskaOkraje, o } = povrch(p);
    const { N, K } = rozliseni(p);
    const H = o.H, z0 = o.z0, u = p.uchyt, vaza = !!volby.vaza;
    const ds = 1e-4, dth = 1e-4;
    let stenaMin = Infinity, stenaMax = 0, rInMin = Infinity, rInDeska = Infinity;
    const smycky = [], uhly = [];
    // vnitřní stěna = vnější posunutá vodorovně tak, aby kolmá tloušťka byla tl(θ, s)
    const rVnitrni = (th, s, w) => {
      const R = r(th, s);
      const rz = (r(th, s + ds) - r(th, s - ds)) / (2 * ds * H);
      const rt = (r(th + dth, s) - r(th - dth, s)) / (2 * dth);
      const k = Math.min(3, Math.sqrt(1 + rz * rz + (rt / R) * (rt / R)));
      return R - w * k;
    };
    const sDeska = u.typ === 'deska' ? u.deska / H : 0;
    let Hcap = Infinity;
    if (vaza) for (let j = 0; j < N; j++) Hcap = Math.min(Hcap, vyskaOkraje(TAU * j / N));
    let druh = null, tlV = new Float32Array(0);
    const dr = [], tv = [];
    for (let j = 0; j < N; j++) {
      const th = TAU * j / N, Ht = vyskaOkraje(th), L = [], D = [], Tv = [];
      const pridej = (rr, zz, d, w) => { L.push(rr, zz); D.push(d); Tv.push(w); };
      uhly.push(th);
      if (u.typ === 'deska') pridej(o.otvor / 2, 0, 0, u.deska);
      if (u.typ === 'fitter') {
        if (vaza) pridej(0, 0, 0, 0);
        else pridej(o.rKrk - p.tvar.stena, 0, 0, p.tvar.stena);
        pridej(o.rLem, 0, 0, p.tvar.stena); pridej(o.rLem, o.vyskaLemu, 0, p.tvar.stena); pridej(o.rKrk, o.vyskaLemu + u.lem, 0, p.tvar.stena);   // lem se sražením 45°
      }
      if (u.typ === 'zadny' && vaza) pridej(0, 0, 0, 0);
      // vnější stěna od hrdla k ústí; nad deskou ve stejných výškách jako vnitřní (řez pak nemůže protínat sám sebe)
      const sKonec = u.typ === 'deska' && !vaza ? sDeska : 0;
      if (sKonec > 0) pridej(r(th, 0), z0, 1, tl(th, 0));
      for (let k = 0; k <= K; k++) {
        const s = sKonec + (k / K) * (Ht / H - sKonec);
        pridej(r(th, s), z0 + s * H, 1, tl(th, s));
      }
      if (vaza) {
        pridej(0, z0 + Hcap, 0, 0);
        if (u.typ === 'deska') { pridej(0, u.deska, 0, 0); pridej(o.otvor / 2, u.deska, 0, u.deska); }
      } else {
        // vnitřní stěna od ústí dolů
        for (let k = K; k >= 0; k--) {
          const s = sKonec + (k / K) * (Ht / H - sKonec);
          const w = tl(th, s), ri = rVnitrni(th, s, w), R = r(th, s);
          rInMin = Math.min(rInMin, ri);
          const st = R - ri; stenaMin = Math.min(stenaMin, st); stenaMax = Math.max(stenaMax, st);
          pridej(ri, z0 + s * H, 2, w);
        }
        if (u.typ === 'deska') { rInDeska = Math.min(rInDeska, L[L.length - 2]); pridej(o.otvor / 2, u.deska, 0, u.deska); }
      }
      if (!druh) druh = Uint8Array.from(D);
      tv.push(Tv); dr.push(D);
      smycky.push(L);
    }
    const M = smycky[0].length / 2;
    tlV = new Float32Array(N * M);
    for (let j = 0; j < N; j++) tlV.set(tv[j], j * M);
    const sit = rotuj(smycky, uhly);
    const k = volby.uplnaKontrola || sit.idx.length / 3 <= 250000 ? KRAB.kontrolaSite(sit.poz, sit.idx) : rychlaKontrola(sit.poz, sit.idx);
    const dil = Object.assign(sit, { nazev: vaza ? 'Stínítko (váza)' : 'Stínítko', jmeno: vaza ? 'stinitko_vaza' : 'stinitko', barva: '#F2E3C6', objem: k.objem, plocha: k.plocha });
    return { dily: [dil], kontrola: k, stena: { min: stenaMin, max: stenaMax }, rInMin, rInDeska, N, K, M, druh, tlV, vaza, cas: Date.now() - t0 };
  }

  /** Velká síť (litofanie): uzavřenost plyne z konstrukce, spočítá se jen objem, plocha a obal (plná kontrola je pomalá). */
  function rychlaKontrola(P, I) {
    let objem = 0, plocha = 0, degenerovanych = 0;
    for (let t = 0; t < I.length; t += 3) {
      const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
      const ax = P[a], ay = P[a + 1], az = P[a + 2], bx = P[b], by = P[b + 1], bz = P[b + 2], cx = P[c], cy = P[c + 1], cz = P[c + 2];
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      const A = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
      if (A < 1e-12) degenerovanych++;
      plocha += A;
      objem += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    }
    return { trojuhelniku: I.length / 3, objem, plocha, bbox: obal(P), degenerovanych, uzavrena: true, teles: 1, hranOkrajovych: 0, hranNevarietnich: 0, hranStejneOrientace: 0, zKonstrukce: true };
  }

  /** Žárovka jako rotační těleso (jen pro náhled a kontrolu), z od začátku skla. */
  function zarovka(p) {
    const Z = ZAROVKY[p.zarovka.typ]; if (!Z.d) return null;
    const o = odvozene(p), R = Z.d / 2, L = Z.l, z0 = (p.uchyt.typ === 'deska' ? p.uchyt.deska : o.z0) + p.zarovka.odsazeni;
    // smyčka proti směru hodin jako u stínítka: osa → krk → baňka → vrchol na ose
    const krk = Math.min(R * 0.55, 13), dk = Math.min(L * 0.2, 15), zc = z0 + Math.max(dk + 1, L - R);
    const pro = [0, z0, krk, z0];
    for (let i = 1; i < 16; i++) {
      const a = -Math.PI / 2 + Math.PI * i / 16, sa = Math.sin(a);
      pro.push(Math.max(krk * (1 - i / 16), R * Math.cos(a)), sa < 0 ? zc + (zc - z0 - dk) * sa : zc + (z0 + L - zc) * sa);
    }
    pro.push(0, z0 + L);
    const smycky = [], uhly = [];
    for (let j = 0; j < 48; j++) { uhly.push(TAU * j / 48); smycky.push(pro); }
    const s = rotuj(smycky, uhly);
    return Object.assign(s, { nazev: 'Žárovka', jmeno: 'zarovka', barva: '#FFD866', z0, z1: z0 + L, R });
  }

  /* ---------------- světlo ---------------- */
  /** Body zdroje světla na ose (střed baňky, nebo kousek nad úchytem). */
  function zdrojeSvetla(p) {
    const z = zarovka(p), o = odvozene(p);
    if (z) return [0.35, 0.55, 0.75].map(f => z.z0 + f * (z.z1 - z.z0));
    return [(p.uchyt.typ === 'deska' ? p.uchyt.deska : o.z0) + 0.35 * o.H];
  }
  /** Simulace rozsvíceného stínítka: barva každého vrcholu (vnější povrch prosvítá podle tloušťky,
      vzdálenosti a úhlu dopadu) a průměrná propustnost stěny. Model je orientační (e^(−t/λ), 1/d²). */
  function svetlo(p, model) {
    const d = model.dily[0], P = d.poz, I = d.idx, nV = P.length / 3, M = model.M, NM = model.N * M;
    const Nn = new Float32Array(nV * 3);
    for (let t = 0; t < I.length; t += 3) {
      const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const v of [a, b, c]) { Nn[v] += nx; Nn[v + 1] += ny; Nn[v + 2] += nz; }
    }
    const zdroje = zdrojeSvetla(p), lam = BARVY[p.tisk.barva].lambda;
    const Iv = new Float32Array(nV), druhV = new Uint8Array(nV);
    let sumT = 0, nT = 0;
    const vzorek = [];
    for (let v = 0; v < Math.min(nV, NM); v++) {
      const dr = model.druh[v % M], w = model.tlV[v];
      druhV[v] = dr;
      const x = P[3 * v], y = P[3 * v + 1], z = P[3 * v + 2];
      const l = Math.hypot(Nn[3 * v], Nn[3 * v + 1], Nn[3 * v + 2]) || 1;
      const nx = Nn[3 * v] / l, ny = Nn[3 * v + 1] / l, nz = Nn[3 * v + 2] / l;
      let s = 0;
      for (const zl of zdroje) {
        const dx = x, dy = y, dz = z - zl, dd = dx * dx + dy * dy + dz * dz, dl = Math.sqrt(dd) || 1;
        const c = (nx * dx + ny * dy + nz * dz) / dl * (dr === 2 ? -1 : 1);
        if (c > 0) s += c / dd;
      }
      if (dr !== 2) { const T = Math.exp(-w / lam); s *= T; if (dr === 1) { sumT += T; nT++; vzorek.push(s); } }
      Iv[v] = s;
    }
    vzorek.sort((a, b) => a - b);
    const q = vzorek[Math.floor(vzorek.length * 0.9)] || 1;
    const barvy = new Float32Array(nV * 3);
    for (let v = 0; v < nV; v++) {
      const b = 0.04 + 0.96 * (1 - Math.exp(-1.6 * Iv[v] / q));
      barvy[3 * v] = b; barvy[3 * v + 1] = b * 0.82; barvy[3 * v + 2] = b * 0.55;
    }
    return { barvy, propustnost: nT ? sumT / nT : 0 };
  }
  /** Clonicí úhel: pod tímto úhlem od roviny ústí není holá žárovka vidět (90° = vidět jen zespodu přímo do ústí). */
  function cloneni(p) {
    const z = zarovka(p), o = odvozene(p); if (!z) return null;
    const { r, vyskaOkraje } = povrch(p);
    let Hm = Infinity, Rm = Infinity;
    for (let j = 0; j < 72; j++) { const th = TAU * j / 72, Ht = vyskaOkraje(th); Hm = Math.min(Hm, Ht); Rm = Math.min(Rm, r(th, Ht / o.H) - p.tvar.stena); }
    const zU = o.z0 + Hm;
    if (z.z1 >= zU) return { uhel: 0, vycniva: true };
    return { uhel: Math.atan2(zU - z.z1, Rm + z.R) * 180 / Math.PI, vycniva: false };
  }

  /* ---------------- tisková poloha a převisy ---------------- */
  function prevrat(d) {
    const P = new Float32Array(d.poz.length);
    for (let i = 0; i < P.length; i += 3) { P[i] = d.poz[i]; P[i + 1] = -d.poz[i + 1]; P[i + 2] = -d.poz[i + 2]; }
    return Object.assign({}, d, { poz: P });
  }
  function obal(poz) {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < poz.length; i += 3) for (let j = 0; j < 3; j++) { const v = poz[i + j]; if (v < b[j]) b[j] = v; if (v > b[j + 3]) b[j + 3] = v; }
    return b;
  }
  /** Převisy nad „uhel“ od svislice a vodorovné stropy v dané poloze (bez plochy na podložce). */
  function rozborPolohy(d, uhel) {
    const P = d.poz, I = d.idx, mez = -Math.sin(uhel * Math.PI / 180) - 0.02;
    let zmin = Infinity;
    for (let i = 2; i < P.length; i += 3) zmin = Math.min(zmin, P[i]);
    let previs = 0, most = 0, podlozka = 0;
    for (let t = 0; t < I.length; t += 3) {
      const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
      if (l < 1e-12) continue;
      const cz = nz / l, A = l / 2;
      if (Math.max(P[a + 2], P[b + 2], P[c + 2]) < zmin + 0.01) { if (cz < -0.98) podlozka += A; continue; }
      if (cz < -0.985) most += A; else if (cz < mez) previs += A;
    }
    return { previs, most, podlozka, skore: previs + 3 * most - Math.min(podlozka, 400) * 0.05 };
  }
  function rozborTisku(d, uhel) {
    return { hrdlo: rozborPolohy(d, uhel), usti: rozborPolohy(prevrat(d), uhel) };
  }
  /** Kusy v tiskové poloze vedle sebe na podložce (z ≥ 0, vycentrováno). */
  function tiskoveRozlozeni(dily, poloha, kusu = 1, mezera = 5, sirkaPodlozky = 220) {
    let x = 0, y = 0, radek = 0;
    const out = [];
    for (let i = 0; i < kusu; i++) for (const d0 of dily) {
      const d = poloha === 'usti' ? prevrat(d0) : d0;
      const P = new Float32Array(d.poz), b = obal(P), sx = b[3] - b[0], sy = b[4] - b[1];
      if (x > 0 && x + sx > sirkaPodlozky) { x = 0; y += radek + mezera; radek = 0; }
      for (let k = 0; k < P.length; k += 3) { P[k] += x - b[0]; P[k + 1] += y - b[1]; P[k + 2] -= b[2]; }
      x += sx + mezera; radek = Math.max(radek, sy);
      out.push(Object.assign({}, d, { poz: P, nazev: d.nazev + (kusu > 1 ? ` ${i + 1}` : '') }));
    }
    const B = out.reduce((a, d) => { const b = obal(d.poz); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[3]), Math.max(a[3], b[4])]; }, [Infinity, Infinity, -Infinity, -Infinity]);
    const cx = (B[0] + B[2]) / 2, cy = (B[1] + B[3]) / 2;
    for (const d of out) for (let k = 0; k < d.poz.length; k += 3) { d.poz[k] -= cx; d.poz[k + 1] -= cy; }
    return out;
  }

  /* ---------------- kontroly ---------------- */
  /** Kontroly zadání (bez sítě). → [{uroven, text, pole, oprava?}] */
  function kontroly(p) {
    const H = [], o = odvozene(p), T = p.tvar, u = p.uchyt, M = MATERIALY[p.tisk.material], L = p.lito;
    const ch = (text, pole, oprava) => H.push({ uroven: 'chyba', text, pole, oprava });
    const va = (text, pole, oprava) => H.push({ uroven: 'varovani', text, pole, oprava });
    const inf = (text, pole) => H.push({ uroven: 'info', text, pole: pole || [] });
    if (u.typ === 'deska' && o.otvor + 2 * T.stena + 4 > T.hrdlo)
      ch(`Hrdlo Ø ${fmt(T.hrdlo)} je na otvor objímky Ø ${fmt(o.otvor)} malé – deska potřebuje kolem otvoru aspoň 2 mm.`, ['tvar.hrdlo'], { text: `hrdlo Ø ${fmt(Math.ceil(o.otvor + 2 * T.stena + 12))}`, pole: 'tvar.hrdlo', hodnota: Math.ceil(o.otvor + 2 * T.stena + 12) });
    if (u.typ === 'fitter') inf(`Hrdlo těla určuje krček: Ø ${fmt(2 * o.rKrk)} mm (lem Ø ${fmt(u.fitter)}).`, ['uchyt.fitter']);
    if (T.stena < p.tisk.tryska * 1.5) va(`Stěna ${fmt(T.stena, 2)} mm je tenčí než 1,5× tryska – slicer ji může vynechat nebo tisknout děravě.`, ['tvar.stena'], { text: `stěna ${fmt(p.tisk.tryska * 2, 2)}`, pole: 'tvar.stena', hodnota: p.tisk.tryska * 2 });
    if (T.stena > 2.5) inf('Stěna nad 2,5 mm propustí málo světla – stínítko bude tmavé.', ['tvar.stena']);
    if (p.vzor.typ !== 'hladky' && p.vzor.typ !== 'fazety' && p.vzor.hloubka > 0 && p.vzor.hloubka < T.stena * 0.5)
      inf('Vzor mělčí než polovina stěny bude při svícení skoro neviditelný.', ['vzor.hloubka']);
    if (p.vzor.typ === 'fazety' && p.vzor.pocet < 3) ch('Fazety potřebují aspoň 3 strany.', ['vzor.pocet'], { text: '6 stran', pole: 'vzor.pocet', hodnota: 6 });
    if (p.okraj.typ !== 'rovny' && p.okraj.hloubka > T.vyska * 0.6) va('Výřez okraje je hlubší než 60 % výšky – ořízne se.', ['okraj.hloubka']);
    if (u.typ === 'deska' && u.deska < 1.6) va('Deska tenčí než 1,6 mm může pod kroužkem objímky prasknout.', ['uchyt.deska'], { text: 'deska 2,4 mm', pole: 'uchyt.deska', hodnota: 2.4 });
    if (u.typ === 'deska' && u.objimka === 'vlastni') inf('Otvor změřte na závitu objímky a přidejte asi 0,5 mm vůle.', ['uchyt.otvor']);
    else if (u.typ === 'deska') inf(`Otvor Ø ${fmt(o.otvor)} mm je typický pro ${u.objimka} s převlečným kroužkem – ověřte posuvkou.`, ['uchyt.objimka']);
    if (u.typ === 'zadny') inf('Bez úchytu: stínítko se nasazuje na hotový držák, nebo lepí. Hrdlo je otevřené.', ['uchyt.typ']);
    if (L.pouzit && !o.lito) va('Litofanie je zapnutá, ale chybí obrázek – vložte ho v oddílu Litofanie.', ['lito.pouzit']);
    if (o.lito) {
      if (L.tMax <= L.tMin + 0.4) ch('Litofanie: nejtlustší místo musí být aspoň o 0,4 mm tlustší než nejtenčí.', ['lito.tMax'], { text: `max ${fmt(L.tMin + 2, 1)} mm`, pole: 'lito.tMax', hodnota: L.tMin + 2 });
      if (L.tMin < p.tisk.tryska * 1.5) va(`Litofanie: nejtenčí místo ${fmt(L.tMin, 2)} mm je pod 1,5× tryskou – světlá místa se vytisknou děravě.`, ['lito.tMin'], { text: `min ${fmt(p.tisk.tryska * 2, 2)}`, pole: 'lito.tMin', hodnota: p.tisk.tryska * 2 });
      if (L.okrajDole + L.okrajNahore > T.vyska - 10) ch('Litofanie: okraje bez obrázku zabírají skoro celou výšku.', ['lito.okrajDole']);
      if (p.vzor.typ !== 'hladky' || p.vzor2.typ !== 'hladky') inf('Litofanie vypadá nejlépe na hladkém povrchu – vzor obraz deformuje.', ['vzor.typ']);
      if (L.rozliseni > p.tisk.tryska * 1.5) inf(`Rozlišení litofanie ${fmt(L.rozliseni, 2)} mm je hrubší než tryska – detaily obrázku se ztratí.`, ['lito.rozliseni']);
      inf('Litofanie: tiskněte se 100% výplní, svisle (hrdlem dolů), výškou vrstvy 0,12–0,16 mm a pomalu.', ['lito.pouzit']);
    }
    const prumer = Math.max(T.hrdlo, T.usti) + 2 * Math.max(0, T.vybouleni) + 2 * Math.max(p.vzor.hloubka, 0);
    if (prumer > p.tisk.podlozka) ch(`Stínítko (asi Ø ${fmt(prumer, 0)} mm) se nevejde na podložku ${fmt(p.tisk.podlozka, 0)} mm.`, ['tisk.podlozka', 'tvar.usti']);
    inf(`Jen LED žárovky. ${M.nazev} měkne kolem ${M.teplota} °C – klasická žárovka nebo halogen stínítko zdeformuje.`, ['tisk.material']);
    return H;
  }
  /** Kontroly nad hotovou sítí: těsnost, průnik vnitřní stěny, převisy, žárovka, podložka. */
  function kontrolyModelu(p, model) {
    const H = [], o = odvozene(p), d = model.dily[0], k = model.kontrola;
    if (!k.uzavrena || k.teles !== 1) H.push({ uroven: 'chyba', pole: [], text: `Síť není těsná (${k.hranOkrajovych} okrajových, ${k.hranNevarietnich} nevarietních hran).` });
    if (model.rInMin < 1) H.push({ uroven: 'chyba', pole: ['tvar.stena', 'vzor.hloubka'], text: 'Vnitřní stěna se na některém místě sbíhá k ose – zmenšete stěnu nebo hloubku vzoru, zvětšete hrdlo.' });
    if (p.uchyt.typ === 'deska' && model.rInDeska < o.otvor / 2 + 1.5)
      H.push({ uroven: 'chyba', pole: ['tvar.hrdlo'], text: 'Vnitřní stěna u desky zasahuje k otvoru objímky – deska kolem otvoru by byla užší než 1,5 mm.' });
    const r = model.rozbor || rozborTisku(d, p.tisk.uhel), pol = polohaTisku(p, r), R = r[pol];
    if (R.previs > 20) H.push({ uroven: 'varovani', pole: ['tisk.poloha', 'tisk.uhel'], text: `V poloze ${pol === 'hrdlo' ? 'hrdlem' : 'ústím'} dolů má stínítko převisy nad ${fmt(p.tisk.uhel)}° (${fmt(R.previs / 100, 1)} cm²) – potřebuje podpory, nebo méně rozevřený tvar.` });
    if (R.most > 30) H.push({ uroven: 'varovani', pole: ['tisk.poloha'], text: `V poloze ${pol === 'hrdlo' ? 'hrdlem' : 'ústím'} dolů jsou vodorovné stropy ${fmt(R.most / 100, 1)} cm² – ${pol === 'usti' && p.okraj.typ !== 'rovny' ? 'tvarovaný okraj neleží na podložce celý' : 'tiskárna je musí přemostit'}.` });
    const b = k.bbox;
    if (Math.max(b[3] - b[0], b[4] - b[1]) > p.tisk.podlozka || (p.tisk.kusu > 1 && (b[3] - b[0] + 5) * p.tisk.kusu > p.tisk.podlozka && (b[4] - b[1] + 5) * Math.ceil(p.tisk.kusu / Math.max(1, Math.floor((p.tisk.podlozka + 5) / (b[3] - b[0] + 5)))) > p.tisk.podlozka))
      H.push({ uroven: 'varovani', pole: ['tisk.kusu', 'tisk.podlozka'], text: `Všechny kusy se na podložku ${fmt(p.tisk.podlozka, 0)} mm najednou nevejdou – exportujte je po částech.` });
    // žárovka: odstup skla od vnitřní stěny
    const z = zarovka(p);
    if (z) {
      const { r: rv, tl } = povrch(p);
      let odstup = Infinity;
      for (let zz = Math.max(z.z0, o.z0); zz <= Math.min(z.z1, o.z0 + o.H); zz += 2) {
        const s = (zz - o.z0) / o.H;
        for (let j = 0; j < 36; j++) odstup = Math.min(odstup, rv(TAU * j / 36, s) - tl(TAU * j / 36, s) - z.R);
      }
      const Zd = ZAROVKY[p.zarovka.typ];
      if (odstup < 0) H.push({ uroven: 'chyba', pole: ['zarovka.typ', 'tvar.hrdlo'], text: `Žárovka ${Zd.nazev} se do stínítka nevejde (chybí ${fmt(-odstup)} mm).` });
      else if (odstup < 8) H.push({ uroven: 'varovani', pole: ['zarovka.typ', 'tvar.hrdlo'], text: `Sklo žárovky je jen ${fmt(odstup)} mm od stěny – stínítko se bude nerovnoměrně svítit a hřát. Doporučeno aspoň 8 mm.` });
      const c = cloneni(p);
      if (c && c.vycniva) H.push({ uroven: 'info', pole: ['tvar.vyska', 'zarovka.odsazeni'], text: 'Žárovka vyčnívá z ústí – bude vidět holé sklo.' });
      else if (c && c.uhel < 15) H.push({ uroven: 'info', pole: ['tvar.vyska'], text: `Clonicí úhel jen ${fmt(c.uhel, 0)}° – holou žárovku bude vidět skoro ze strany. Prodlužte stínítko nebo posuňte žárovku.` });
    }
    return H;
  }

  /* ---------------- výkres ---------------- */
  /** Řez sloupcem j jako polygon [[r, z]] (vrcholy sloupce jdou v síti za sebou, osa sdílená). */
  function rezSloupce(model, j) {
    const d = model.dily[0], M = model.M, out = [];
    for (let i = 0; i < M; i++) {
      const v = 3 * (j * M + i);
      out.push([Math.hypot(d.poz[v], d.poz[v + 1]), d.poz[v + 2]]);
    }
    return out;
  }
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  /** Technický výkres řezu v měřítku 1:1 (jednotky SVG = mm). */
  function vykres(p, model, datum = new Date()) {
    const o = odvozene(p), N = model.N, dolu = p.montaz === 'dolu', C = o.celkem;
    const zz = z => (dolu ? z : C - z);                         // y v SVG (dolů roste); závěsné = hrdlo nahoře
    const prava = rezSloupce(model, 0), leva = rezSloupce(model, Math.round(N / 2) % N);
    const rMax = Math.max(...prava.map(b => b[0]), ...leva.map(b => b[0]));
    const okraj = 28, sir = 2 * rMax + 2 * okraj + 20, vys = C + 2 * okraj + 34, cx = sir / 2, oy = okraj;
    const X = r => cx + r, Y = z => oy + zz(z);
    const poly = (B, zn) => B.map(b => `${(X(zn * b[0])).toFixed(2)},${Y(b[1]).toFixed(2)}`).join(' ');
    const sip = (x, y, ux, uy) => `<path d="M${x},${y} l${(-ux * 2.2 + uy * 0.7).toFixed(2)},${(-uy * 2.2 - ux * 0.7).toFixed(2)} l${(-uy * 1.4).toFixed(2)},${(ux * 1.4).toFixed(2)} z" class="k"/>`;
    const kotaH = (x1, x2, y, yRef1, yRef2, text) => {
      const l1 = `<line x1="${x1}" y1="${yRef1}" x2="${x1}" y2="${y + (y > yRef1 ? 2 : -2)}" class="p"/>`, l2 = `<line x1="${x2}" y1="${yRef2}" x2="${x2}" y2="${y + (y > yRef2 ? 2 : -2)}" class="p"/>`;
      return `${l1}${l2}<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="t"/>${sip(x1, y, -1, 0)}${sip(x2, y, 1, 0)}<text x="${(x1 + x2) / 2}" y="${y - 1.2}" class="c">${esc(text)}</text>`;
    };
    const kotaV = (y1, y2, x, xRef, text) => `<line x1="${xRef}" y1="${y1}" x2="${x + 2}" y2="${y1}" class="p"/><line x1="${xRef}" y1="${y2}" x2="${x + 2}" y2="${y2}" class="p"/>`
      + `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" class="t"/>${sip(x, Math.min(y1, y2), 0, -1)}${sip(x, Math.max(y1, y2), 0, 1)}`
      + `<text x="${x - 1.2}" y="${(y1 + y2) / 2}" class="c" transform="rotate(-90 ${x - 1.2} ${(y1 + y2) / 2})">${esc(text)}</text>`;
    // rozměry
    const { r, vyskaOkraje } = povrch(p);
    const rU = r(0, vyskaOkraje(0) / o.H), rN = r(0, 0);
    const yU = Y(o.z0 + vyskaOkraje(0)), yN = Y(o.z0);
    const venU = dolu ? 12 : -12, venN = dolu ? -12 : 12;
    let k = '';
    k += kotaH(X(-rU), X(rU), yU + venU, yU, yU, `Ø ${fmt(2 * rU)}`);
    if (p.uchyt.typ === 'fitter') {
      const yL = Y(0);
      k += kotaH(X(-o.rLem), X(o.rLem), yL - venU, yL, yL, `Ø ${fmt(2 * o.rLem)}`);
      k += kotaH(X(-o.rKrk), X(o.rKrk), Y(o.z0) + venU * 0.6, Y(o.z0), Y(o.z0), `Ø ${fmt(2 * o.rKrk)}`);
    } else {
      k += kotaH(X(-rN), X(rN), yN + venN, yN, yN, `Ø ${fmt(2 * rN)}`);
      if (p.uchyt.typ === 'deska') k += kotaH(X(-o.otvor / 2), X(o.otvor / 2), yN + venN * 1.9, Y(0), Y(0), `Ø ${fmt(o.otvor)}`);
    }
    k += kotaV(Y(0), Y(C), X(rMax) + 12, X(rMax) + 1, fmt(C));
    const popisy = [
      `${p.nazev || 'Stínítko'} – řez osou, měřítko 1:1 (mm)`,
      `${PROFILY[p.tvar.profil].nazev} · ${VZORY[p.vzor.typ]}${p.vzor2.typ !== 'hladky' && p.vzor2.hloubka > 0 ? ' + ' + VZORY[p.vzor2.typ] : ''} · stěna ${fmt(p.tvar.stena, 2)} mm`
        + (o.lito ? ` · litofanie ${fmt(p.lito.tMin, 1)}–${fmt(p.lito.tMax, 1)} mm` : ''),
      `${p.uchyt.typ === 'deska' ? `deska ${fmt(p.uchyt.deska, 1)} mm, otvor Ø ${fmt(o.otvor)}` : p.uchyt.typ === 'fitter' ? `krček ${fmt(p.uchyt.krk)} mm, lem Ø ${fmt(p.uchyt.fitter)}` : 'bez úchytu'} · ${p.montaz === 'dolu' ? 'závěsné' : 'na rameni'} · ${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}-${String(datum.getDate()).padStart(2, '0')}`,
    ];
    const ty = vys - 26;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${sir.toFixed(1)}mm" height="${vys.toFixed(1)}mm" viewBox="0 0 ${sir.toFixed(2)} ${vys.toFixed(2)}" data-i18n="ne">
<defs><pattern id="srafa" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2" stroke="#555" stroke-width="0.25"/></pattern></defs>
<style>.o{fill:url(#srafa);stroke:#111;stroke-width:0.35;stroke-linejoin:round}.t{stroke:#1a4fa0;stroke-width:0.18}.p{stroke:#1a4fa0;stroke-width:0.12}.k{fill:#1a4fa0}.c{font:3.2px sans-serif;fill:#1a4fa0;text-anchor:middle}.n{font:3.4px sans-serif;fill:#111}.n b{font-weight:700}.osa{stroke:#c33;stroke-width:0.18;stroke-dasharray:6 1.2 1 1.2}</style>
<rect width="100%" height="100%" fill="#fff"/>
<polygon class="o" points="${poly(prava, 1)}"/><polygon class="o" points="${poly(leva, -1)}"/>
<line class="osa" x1="${cx}" y1="${Y(0) + (dolu ? -6 : 6)}" x2="${cx}" y2="${Y(C) + (dolu ? 6 : -6)}"/>
${k}
<rect x="4" y="${ty - 4}" width="${sir - 8}" height="${vys - ty}" fill="none" stroke="#111" stroke-width="0.25"/>
${popisy.map((t, i) => `<text x="7" y="${ty + 1 + i * 5}" class="n">${esc(t)}</text>`).join('')}
</svg>`;
  }

  /* ---------------- projekt ---------------- */
  function popis(p) {
    const u = p.uchyt;
    const uch = u.typ === 'deska' ? (u.objimka === 'vlastni' ? `otvor Ø ${fmt(u.otvor)}` : u.objimka) : u.typ === 'fitter' ? `krček Ø ${fmt(u.fitter)}` : 'bez úchytu';
    return `${PROFILY[p.tvar.profil].nazev} Ø ${fmt(p.tvar.hrdlo)}/${fmt(p.tvar.usti)} × ${fmt(p.tvar.vyska)} mm · ${VZORY[p.vzor.typ]}${litoAktivni(p) ? ' · litofanie' : ''} · ${uch}`;
  }
  /** Body vlastní křivky odvozené z aktuálního profilu (při přechodu na „vlastní“). */
  function bodyZProfilu(p, pocet = 3) {
    const { zaklad } = povrch(p), B = [];
    for (let i = 1; i <= pocet; i++) { const s = i / (pocet + 1); B.push([Math.round(s * 1e4) / 1e4, Math.round(zaklad(s) * 100) / 100]); }
    return B;
  }
  const ulozProjekt = p => JSON.stringify({ typ: 'stinitka', verze: 2, projekt: p }, null, 1);
  function nactiProjekt(text) {
    let j;
    try { j = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON.'); }
    if (!j || j.typ !== 'stinitka' || !j.projekt) throw new Error('Soubor není projekt Lustrových stínítek.');
    return normalizuj(j.projekt);
  }

  const API = {
    PROFILY, VZORY, VZORY2, PRUBEHY, OKRAJE, UCHYTY, OBJIMKY, ZAROVKY, MATERIALY, BARVY, KVALITY, VYCHOZI, MEZE, VYCTY, PREDVOLBY, MAX_BODU,
    normalizuj, predvolba, odvozene, povrch, rozliseni, postav, zarovka, rotuj, prevrat, obal, svetlo, cloneni, vykres, rezSloupce,
    rozborTisku, polohaTisku, tiskoveRozlozeni, kontroly, kontrolyModelu, popis, bodyZProfilu, litoZakoduj, litoAktivni,
    ulozProjekt, nactiProjekt, kopie, vezmi, poloz, fmt,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.STIN = API;
})();

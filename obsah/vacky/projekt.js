/* Návrhář vaček – projekt pro gen3d (bez DOM, běží i v node):
   výchozí projekt, normalizace (G3D.normalizuj), převod starého stavu (webapp_vacky_stav a odkazy #p={JSON}),
   předvolby, materiály tisku, 3D síť disku (indexovaná, uzavřená) a převod kontrol na hlášení gen3d.
   VPROJ.normalizuj(q) → {p, hlaseni} · VPROJ.prevedStary(text|objekt) → {p, hlaseni} · VPROJ.staryOdkaz(hash) → objekt | null
   VPROJ.disk(v, M) → díl {nazev, jmeno, poz, idx, objem, barva} · VPROJ.hlaseni(r) → [{uroven, text, pole, oprava}] */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined' && module.exports;
  const G3D = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const V = uzel ? require('./jadro.js') : window.Vacky;
  const X = uzel ? require('./export.js') : window.VackyExport;
  const TAU = 2 * Math.PI;

  const MATERIALY = {
    pla: { nazev: 'PLA', hustota: 1.24 }, petg: { nazev: 'PETG', hustota: 1.27 }, asa: { nazev: 'ASA', hustota: 1.07 },
    abs: { nazev: 'ABS', hustota: 1.04 }, pa: { nazev: 'PA (nylon)', hustota: 1.14 }, pom: { nazev: 'POM (frézovaný)', hustota: 1.41 },
  };
  const VYCHOZI = Object.assign({ nazev: '' }, V.VYCHOZI, { tisk: { material: 'pla', uhel: 45 } });
  const SCHEMA = {
    VYCHOZI,
    MEZE: {
      h: [0.01, 2000], Rb: [0.01, 5000], beta1: [0.01, 360], delta1: [0, 360], beta2: [0.01, 360], n: [0, 1e6],
      Rr: [0.01, 2000], eps: [-5000, 5000], tloustka: [0.01, 1000], otvor: [0, 5000], m: [0, 1e4], k: [0, 1e6], F0: [-1e7, 1e7],
      'tisk.uhel': [20, 80],
    },
    VYCTY: { zakonNabeh: Object.keys(V.ZAKONY), zakonNavrat: Object.keys(V.ZAKONY), typ: ['hrot', 'kladka', 'plochy'], smer: ['cw', 'ccw'], 'tisk.material': Object.keys(MATERIALY) },
  };
  const normalizuj = q => G3D.normalizuj(q, SCHEMA);

  /** Starý stav stránky (do 11/2026): plochý objekt parametrů V.VYCHOZI v localStorage „webapp_vacky_stav“ nebo v odkazu. */
  function prevedStary(vstup) {
    const o = typeof vstup === 'string' ? JSON.parse(vstup) : vstup;
    if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('není objekt');
    const q = Object.assign({}, V.VYCHOZI, o);
    for (const k of Object.keys(q)) if (typeof q[k] === 'number' && !isFinite(q[k])) delete q[k];   // NaN z prázdného pole → výchozí
    delete q.delta2;
    return normalizuj(q);
  }
  /** Starý odkaz „#p=“ + encodeURIComponent(JSON) – rozpozná ho podle „{“ (nový formát začíná z/j). */
  function staryOdkaz(hash) {
    const m = /[#&]p=(%7B|\{)([^&]*)/i.exec(hash || '');
    if (!m) return null;
    try { return JSON.parse(decodeURIComponent(m[1] + m[2])); } catch (e) { return null; }
  }

  const P = (nazev, popis, h) => ({ nazev, popis, p: Object.assign({}, V.VYCHOZI, h) });
  const PREDVOLBY = {
    zaklad: P('Výchozí – kladka, cykloidní', 'Rb 40, zdvih 20 mm', {}),
    rychla: P('Rychloběžná – 4-5-6-7, 3000 ot/min', 'kladka Rr 8', { zakonNabeh: 'p4567', zakonNavrat: 'p4567', n: 3000, Rb: 35, h: 10, beta1: 100, delta1: 20, beta2: 100, m: 0.15, k: 25, F0: 250, typ: 'kladka', Rr: 8 }),
    ventil: P('Plochý talíř (rozvod motoru)', '3-4-5, 2500 ot/min', { zakonNabeh: 'p345', zakonNavrat: 'p345', typ: 'plochy', Rb: 18, h: 9, beta1: 120, delta1: 0, beta2: 120, n: 2500, m: 0.12, k: 30, F0: 200, eps: 2, otvor: 14, tloustka: 14 }),
    podrez: P('Ukázka podřezání', 'malé Rb, velká kladka', { typ: 'kladka', Rb: 10, Rr: 15, h: 30, beta1: 50, delta1: 20, beta2: 60, otvor: 8, k: 5, F0: 60 }),
    harm: P('Harmonický bez výdrže', 'hrotové zdvihátko', { zakonNabeh: 'harmonicky', zakonNavrat: 'harmonicky', beta1: 180, delta1: 0, beta2: 180, typ: 'hrot', Rb: 45 }),
  };

  /** Indexovaná síť disku – stejné trojúhelníky jako VackyExport.sit (profil převzorkovaný na M paprsků), normály ven. */
  function disk(v, M) {
    M = M || 720;
    const p = v.p, t = p.tloustka, r = p.otvor / 2;
    const o = X.polarne(v.profil, M);
    const nV = r > 0 ? 4 * M : 2 * M + 2;
    const poz = new Float32Array(3 * nV), idx = [];
    const bod = (i, x, y, z) => { poz[3 * i] = x; poz[3 * i + 1] = y; poz[3 * i + 2] = z; };
    for (let i = 0; i < M; i++) { bod(i, o[i][0], o[i][1], 0); bod(M + i, o[i][0], o[i][1], t); }
    const T = (a, b, c) => idx.push(a, b, c);
    for (let i = 0; i < M; i++) { const j = (i + 1) % M; T(i, j, M + j); T(i, M + j, M + i); }
    if (r > 0) {
      for (let i = 0; i < M; i++) { const a = TAU * i / M; bod(2 * M + i, r * Math.cos(a), r * Math.sin(a), 0); bod(3 * M + i, r * Math.cos(a), r * Math.sin(a), t); }
      const ib = i => 2 * M + i, it = i => 3 * M + i, ot = i => M + i;
      for (let i = 0; i < M; i++) {
        const j = (i + 1) % M;
        T(ib(j), ib(i), it(i)); T(ib(j), it(i), it(j));
        T(it(i), ot(i), ot(j)); T(it(i), ot(j), it(j));
        T(ib(i), j, i); T(ib(i), ib(j), j);
      }
    } else {
      const cb = 2 * M, ct = 2 * M + 1;
      bod(cb, 0, 0, 0); bod(ct, 0, 0, t);
      for (let i = 0; i < M; i++) { const j = (i + 1) % M; T(ct, M + i, M + j); T(cb, j, i); }
    }
    const I = new Uint32Array(idx);
    let objem = 0;
    for (let k = 0; k < I.length; k += 3) {
      const a = 3 * I[k], b = 3 * I[k + 1], c = 3 * I[k + 2];
      objem += poz[a] * (poz[b + 1] * poz[c + 2] - poz[b + 2] * poz[c + 1]) - poz[a + 1] * (poz[b] * poz[c + 2] - poz[b + 2] * poz[c]) + poz[a + 2] * (poz[b] * poz[c + 1] - poz[b + 1] * poz[c]);
    }
    return { nazev: 'Vačka', jmeno: 'vacka', poz, idx: I, objem: objem / 6, barva: '#4F86D9' };
  }
  /** Montážní poloha: osa vačky vodorovně (y), profil ve svislé rovině x–z jako ve 2D náhledu („Zepředu“). */
  function montazni(d, t) {
    const P2 = new Float32Array(d.poz.length);
    for (let i = 0; i < P2.length; i += 3) { P2[i] = d.poz[i]; P2[i + 1] = t / 2 - d.poz[i + 2]; P2[i + 2] = d.poz[i + 1]; }
    return Object.assign({}, d, { poz: P2 });
  }

  // kód kontroly jádra → pole formuláře (pro „→ upravit“)
  const POLE_KODU = { tlak: ['Rb', 'eps'], podrez: ['Rb', 'Rr'], konvex: ['Rb'], hrot: ['Rb'], skokv: ['zakonNabeh'], skoka: ['zakonNabeh'], otvor: ['otvor'], odskok: ['F0'], kladka: ['Rr'], polar: ['Rb'], talir: [], vyduta: [] };
  /** Výsledek V.vypocet → hlášení gen3d. */
  function hlaseni(r) {
    if (!r.ok) return r.chyby.map(c => ({ uroven: 'chyba', text: c.text, pole: c.pole && c.pole !== 'typ' ? [c.pole] : [] }));
    return r.kontroly.map(k => {
      const h = { uroven: k.uroven, text: k.text, pole: POLE_KODU[k.kod] || [] };
      if (k.kod === 'odskok' && k.uroven === 'chyba') h.oprava = { text: `předpětí F₀ = ${Math.ceil(r.silyEx.F0potreba * 1.3 + 1)} N`, pole: 'F0', hodnota: Math.ceil(r.silyEx.F0potreba * 1.3 + 1) };
      return h;
    });
  }
  const popis = p => `${V.ZAKONY[p.zakonNabeh].kratce} / ${V.ZAKONY[p.zakonNavrat].kratce} · h ${V.fmt(p.h)} · Rb ${V.fmt(p.Rb)} · ${{ hrot: 'hrot', kladka: 'kladka Rr ' + V.fmt(p.Rr), plochy: 'talíř' }[p.typ]}`;

  const API = { VYCHOZI, SCHEMA, MATERIALY, PREDVOLBY, normalizuj, prevedStary, staryOdkaz, disk, montazni, hlaseni, popis };
  if (uzel) module.exports = API; else window.VPROJ = API;
})();

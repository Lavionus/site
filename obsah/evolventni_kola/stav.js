/* Evolventní kola – projekt stránky bez DOM (běží i v node):
   VYCHOZI, normalizuj (G3D.normalizuj), převod starého stavu webapp_evolventni_kola_stav,
   parametry pro jádro EvolKola, předvolby a materiály. */
(function () {
  'use strict';
  const G = typeof module !== 'undefined' && module.exports ? require('../gen3d/zaklad.js') : window.G3D;

  const VYCHOZI = {
    verze: 1, nazev: '',
    rezim: 'jedno', modul: 2, alfa: 20,
    z1: 20, x1: 0, d1: 8, z2: 40, x2: 0, d2: 8, b: 10,
    jn: 0, ct: 0, ko: 0, tol: 0.005, zkratit: true, dosed: true, pomocne: false,
    exp: false, eModul: 1, eAlfa: 20, eHa: 1, eC: 0.25, eRho: 0.38,
    tisk: { material: 'pla', uhel: 45 },
  };
  const MATERIALY = {
    pla: { nazev: 'PLA', hustota: 1.24 }, petg: { nazev: 'PETG', hustota: 1.27 }, asa: { nazev: 'ASA', hustota: 1.07 },
    abs: { nazev: 'ABS', hustota: 1.04 }, pa: { nazev: 'PA (nylon)', hustota: 1.14 }, pom: { nazev: 'POM', hustota: 1.41 },
  };
  // meze jen tam, kde jádro samo nehlásí chybu (ostatní nesmyslná čísla ohlásí kontroly jádra)
  const SCHEMA = {
    VYCHOZI,
    MEZE: { 'tisk.uhel': [10, 80] },
    VYCTY: { rezim: ['jedno', 'dvojice'], tol: [0.1, 0.02, 0.005, 0.001, 0.0002], alfa: [20], 'tisk.material': Object.keys(MATERIALY) },
  };
  const normalizuj = q => G.normalizuj(q, SCHEMA);

  /** Starý stav (S z ui.js do 11/2026: čísla jako řetězce „0,5“, vrstvy, vyukaTab) → {p, hlaseni, zobrazeni, vyuka}. */
  function prevedStary(S) {
    const s = S && typeof S === 'object' ? S : {};
    const q = {};
    for (const k of Object.keys(VYCHOZI)) if (k !== 'tisk' && k !== 'verze' && s[k] !== undefined) q[k] = s[k];
    const r = normalizuj(q);
    const zobrazeni = {};
    if (s.vrstvy && typeof s.vrstvy === 'object') for (const k of Object.keys(VRSTVY)) if (k in s.vrstvy) zobrazeni['tV_' + k] = !!s.vrstvy[k];
    return { p: r.p, hlaseni: r.hlaseni, zobrazeni, vyuka: ['Ev', 'Vyr', 'Zab'].includes(s.vyukaTab) ? s.vyukaTab : null };
  }
  // vrstvy 2D profilu a výchozí viditelnost
  const VRSTVY = { ra: true, r: true, rb: true, rf: true, rForm: false, rw: true };

  /** Vstup jádra EvolKola (stejně jako dřívější parametry() v ui.js). */
  function parametry(p) {
    const exp = p.exp;
    const spol = {
      m: exp ? p.eModul : p.modul, alfa: exp ? p.eAlfa : p.alfa,
      haS: exp ? p.eHa : 1, cS: exp ? p.eC : 0.25, rhoS: exp ? p.eRho : 0.38,
      b: p.b, cTisk: p.ct, korOtvor: p.ko, tol: p.tol, jn: p.jn, zkratitHlavy: !!p.zkratit,
    };
    return { spol, k1: { z: p.z1, x: p.x1, dOtvor: p.d1 }, k2: { z: p.z2, x: p.x2, dOtvor: p.d2 } };
  }

  const PREDVOLBY = [
    { id: 'kolo20', nazev: 'Kolo m 2, 20 zubů', popis: 'jedno kolo', h: { rezim: 'jedno', modul: 2, z1: 20, x1: 0, d1: 8, b: 10 } },
    { id: 'p20_40', nazev: 'Soukolí 20 : 40, m 2', popis: 'převod 1 : 2', h: { rezim: 'dvojice', modul: 2, z1: 20, x1: 0, d1: 8, z2: 40, x2: 0, d2: 8, b: 10 } },
    { id: 'pastorek10', nazev: 'Pastorek z = 10 s korekcí', popis: 'bez podřezání', h: { rezim: 'dvojice', modul: 1.5, z1: 10, x1: 0.42, d1: 5, z2: 30, x2: 0, d2: 8, b: 8 } },
    { id: 'tisk1', nazev: 'Soukolí pro 3D tisk 15 : 45, m 1', popis: 'vůle 0,15 mm', h: { rezim: 'dvojice', modul: 1, z1: 15, x1: 0.15, d1: 5, z2: 45, x2: 0, d2: 8, b: 6, jn: 0.15, tol: 0.02 } },
    { id: 'jemne', nazev: 'Jemné kolo m 0,5, 60 zubů', popis: 'modelářské', h: { rezim: 'jedno', modul: 0.5, z1: 60, x1: 0, d1: 3, b: 3 } },
  ];
  /** Předvolba přepíše ozubení a geometrii; vůle, tisk a kvalita zůstanou. */
  function predvolba(id, p) {
    const v = PREDVOLBY.find(x => x.id === id);
    const q = G.kopie(p || VYCHOZI);
    Object.assign(q, { exp: false, alfa: 20 }, v ? v.h : {});
    return normalizuj(q).p;
  }

  const API = { VYCHOZI, MATERIALY, VRSTVY, PREDVOLBY, normalizuj, prevedStary, parametry, predvolba };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else window.EVOL_STAV = API;
})();

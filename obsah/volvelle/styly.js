/* ============================================================
   Volvelle – styly kotoučů (bez DOM)
   Styl = písma (OFL z obsah/fonty, Liberation pro černobílý), barvy rolí a výplní, ozdoby.
   Prvky šablon nesou jen role barev (c: 'cara' | 'text' | 'akcent' | 'akcent2' | 'jemna' | 'papir' | 'v0'…'v7');
   konkrétní barvu dosadí výstup podle stylu. Barvy patří papírovému předmětu, ne tématu stránky.
   ============================================================ */
(function (koren) {
  'use strict';
  // písma: soubor (obsah/fonty nebo stitky_panely/fonty pro Liberation), rodina pro @font-face stránky, sirka = průměrná šířka znaku v em
  const PISMA = {
    fell: { soubor: 'IMFellEnglish-Regular.ttf', rodina: 'VV IM Fell', sirka: 0.513, chybi: '−●○' },
    cinzel: { soubor: 'CinzelDecorative-Bold.ttf', rodina: 'VV Cinzel Decorative', sirka: 0.687 },
    marcellus: { soubor: 'Marcellus-Regular.ttf', rodina: 'VV Marcellus', sirka: 0.522 },
    fjalla: { soubor: 'FjallaOne-Regular.ttf', rodina: 'VV Fjalla One', sirka: 0.47 },
    righteous: { soubor: 'Righteous-Regular.ttf', rodina: 'VV Righteous', sirka: 0.56 },
    patrick: { soubor: 'PatrickHand-Regular.ttf', rodina: 'VV Patrick Hand', sirka: 0.43 },
    titan: { soubor: 'TitanOne-Regular.ttf', rodina: 'VV Titan One', sirka: 0.62 },
    liberation: { soubor: 'LiberationSans-Regular.ttf', rodina: 'Liberation Sans', sirka: 0.55, liberation: true },
  };
  const S = (o) => Object.assign({ ozdoba: 'zadna', silaCar: 1, vyplne: true }, o);
  const STYLY = {
    historicky: S({
      nazev: 'Historický rukopis', popis: 'pergamen, hnědý inkoust, rumělka', pismo: 'fell', nadpis: 'cinzel', ozdoba: 'rukopis', silaCar: 1.1,
      barvy: { papir: '#f3e6c4', cara: '#3b2412', text: '#3b2412', akcent: '#9b2416', akcent2: '#24456e', jemna: '#8a6a45', okraj: '#3b2412', tma: '#5a4128', svetlo: '#fbf3dc', nebe: '#eadbb2', hvezda: '#2a1a0c', souhv: '#9b2416', popisNebe: '#5a3a1e' },
      vypl: ['#f6ecd3', '#ead8ad', '#f0e0bb', '#e3cd9c', '#f6ecd3', '#ead8ad', '#f0e0bb', '#e3cd9c'],
    }),
    apianus: S({
      nazev: 'Apianus (renesance)', popis: 'kolorovaný dřevoryt, zlato a modř', pismo: 'marcellus', nadpis: 'cinzel', ozdoba: 'apianus', silaCar: 1.2,
      barvy: { papir: '#f7efd9', cara: '#2a1d10', text: '#2a1d10', akcent: '#a3271b', akcent2: '#2c5d8a', jemna: '#7d6a4f', okraj: '#2a1d10', tma: '#24456e', svetlo: '#f3d36b', nebe: '#24456e', hvezda: '#f6dc7a', souhv: '#e9c9b6', popisNebe: '#f7efd9' },
      vypl: ['#efd98f', '#cfe0ea', '#f3e3b6', '#e9c9b6', '#efd98f', '#cfe0ea', '#f3e3b6', '#e9c9b6'],
    }),
    moderni: S({
      nazev: 'Moderní', popis: 'čisté linky, tyrkys a korál', pismo: 'fjalla', nadpis: 'righteous', ozdoba: 'zadna', silaCar: 0.9,
      barvy: { papir: '#ffffff', cara: '#1d2733', text: '#1d2733', akcent: '#0b7a75', akcent2: '#e2603a', jemna: '#8796a5', okraj: '#1d2733', tma: '#22313f', svetlo: '#fff8e1', nebe: '#13233f', hvezda: '#ffffff', souhv: '#6f9bd1', popisNebe: '#cfe0f5' },
      vypl: ['#eef6f6', '#dcecea', '#fdf0ea', '#f4f6f8', '#eef6f6', '#dcecea', '#fdf0ea', '#f4f6f8'],
    }),
    detsky: S({
      nazev: 'Dětský', popis: 'duhové výseče, velká písmena', pismo: 'patrick', nadpis: 'titan', ozdoba: 'detska', silaCar: 1.3,
      barvy: { papir: '#fffdf3', cara: '#2b3a55', text: '#2b3a55', akcent: '#e4572e', akcent2: '#2e86de', jemna: '#7c8aa5', okraj: '#2b3a55', tma: '#3d3b8e', svetlo: '#ffe66d', nebe: '#1d2b64', hvezda: '#ffe66d', souhv: '#9bf6ff', popisNebe: '#ffffff' },
      vypl: ['#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff', '#ffadad'],
    }),
    cernobily: S({
      nazev: 'Černobílý pro tisk', popis: 'jen černá, bez výplní – šetří toner, hodí se pro laser', pismo: 'liberation', nadpis: 'liberation', ozdoba: 'zadna', silaCar: 1, vyplne: false, cb: true,
      barvy: { papir: null, cara: '#000000', text: '#000000', akcent: '#000000', akcent2: '#000000', jemna: '#555555', okraj: '#000000', tma: '#000000', svetlo: '#ffffff', nebe: '#ffffff', hvezda: '#000000', souhv: '#000000', popisNebe: '#000000' },
      vypl: ['#ffffff', '#ebebeb', '#ffffff', '#ebebeb', '#ffffff', '#ebebeb', '#ffffff', '#ebebeb'],
    }),
  };
  /** styl podle id; o.bezVyplni potlačí výplně (úspora barvy) */
  function styl(id, o) {
    const s = STYLY[id] || STYLY.moderni;
    const v = Object.assign({}, s, { id: STYLY[id] ? id : 'moderni', pismoInfo: PISMA[s.pismo], nadpisInfo: PISMA[s.nadpis] });
    if (o && o.bezVyplni) v.vyplne = false;
    return v;
  }
  /** barva role: 'v3' = výplň č. 3, jinak barvy[role]; hex projde beze změny */
  function barva(st, role) {
    if (!role) return st.barvy.cara;
    if (role[0] === '#') return st.cb && role !== '#ffffff' ? (role === '#000000' ? role : '#000000') : role;
    if (role[0] === 'v' && /^v\d$/.test(role)) return st.vypl[+role[1] % st.vypl.length];
    if (role === 'papir') return st.barvy.papir || '#ffffff';
    return st.barvy[role] || st.barvy.cara;
  }
  /** odhad šířky textu v mm (pro rozvržení bez měření v prohlížeči) */
  const sirkaTextu = (st, txt, h, nadpis) => String(txt).length * h * ((nadpis ? st.nadpisInfo : st.pismoInfo) || PISMA.liberation).sirka;
  const API = { PISMA, STYLY, styl, barva, sirkaTextu };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.VOLV_STYLY = API;
})(typeof window !== 'undefined' ? window : globalThis);

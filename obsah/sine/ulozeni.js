/* ============================================================
   Síně pod horou – ulozeni.js: uložení a obnova hry.

   Uložená hra = seed a velikost hory (generátor ji postaví znovu)
   + všechno, co se od té doby změnilo: pole hory (po bězích, RLE),
   značky prací, zóny, trpaslíci, věci, plány, stavby, deník…
   Odvozené věci (komponenty chůze, jednotky práce, mapy budov
   a plánů) se po načtení přepočítají. Před uložením se jednotky
   práce přestaví, aby obě kopie (hraná a načtená) pokračovaly
   stejně – test to ověřuje porovnáním po dalších tazích.
   Čistá logika bez DOM (localStorage a soubory řeší ui.js).
   ============================================================ */
var SIN = globalThis.SIN = globalThis.SIN || {};

(function (S) {
  'use strict';
  const VERZE = 1;
  // pole hory, která se mění hrou (zaklad, oblast a ostatní drží generátor)
  const POLE_SV = ['teren', 'podlaha', 'obj', 'ruda', 'kap', 'kapTyp', 'otes', 'zn', 'blok'];
  const POLE_HRA = ['oznac', 'prio', 'zachrana', 'zona', 'uroda', 'vykopane'];
  // klíče stavu hry: buď se ukládají, nebo jsou v seznamu přechodných (test hlídá, že žádný nechybí)
  const KLICE = ['seed', 'velikost', 'tik', 'rng', 'dalsiId', 'trpaslici', 'veci', 'plany', 'parezy', 'denik', 'nalezeno', 'objeveno',
    'vykopano', 'padlo', 'budovy', 'zony', 'vytvoreno', 'spotrebovano', 'ulozeno', 'vyrobeno', 'zakladna', 'konec', 'nouze',
    'slava', 'slavaBonus', 'odemceno', 'karavana', 'udalost', 'nejhloubeji', 'posledniDar', 'praskani', 'prameny', 'kapAktivni', 'odcerpano',
    'tvorove', 'dalsiNajezd', 'dalsiNajezdTyp', 'najezdu', 'zabito', 'oblehani', 'poplach', 'strely', 'bezTvoru',
    'rezim', 'prectene', 'deskyPrectene', 'artefakty', 'zazehnuti', 'vyhenHori', 'spac', 'maxTrp', 'dohrano'];
  const PRECHODNE = ['sv', 'oznac', 'prio', 'zachrana', 'zona', 'rez', 'prichoziNa', 'budovaNa', 'planNa', 'zmenaPraci', 'verzeTerenu',
    'zmeny', 'zmenyVse', 'uroda', 'vykopane'];

  // běhy hodnot: [hodnota, počet, hodnota, počet…]
  function rle(a) {
    const r = [];
    for (let i = 0; i < a.length;) {
      const v = a[i]; let j = i + 1;
      while (j < a.length && a[j] === v) j++;
      r.push(v, j - i); i = j;
    }
    return r;
  }
  function zRle(r, a) {
    let i = 0;
    for (let k = 0; k < r.length; k += 2) { a.fill(r[k], i, i + r[k + 1]); i += r[k + 1]; }
    if (i !== a.length) throw new Error('poškozené pole v uložené hře');
    return a;
  }

  function uloz(hra) {
    S.prace.prestavJednotky(hra);                  // viz hlavička: obě kopie pak pokračují stejně
    hra.kapAktivni = S.priroda.aktivni(hra);
    const d = { verze: VERZE, hra: 'sine', ulozeno: Date.now() };
    for (const k of KLICE) d[k] = hra[k];
    d.sv = {}; for (const k of POLE_SV) d.sv[k] = rle(hra.sv[k]);
    d.pole = {}; for (const k of POLE_HRA) d.pole[k] = rle(hra[k]);
    d.schody = hra.sv.schody;
    d.rez = [...hra.rez];
    d.prichoziNa = [...hra.prichoziNa];
    return JSON.parse(JSON.stringify(d));          // hluboká kopie: uložený stav se dál nemění s hrou
  }

  function nacti(d) {
    if (!d || d.hra !== 'sine') throw new Error('to není uložená hra Síní pod horou');
    if (d.verze !== VERZE) throw new Error(`uložená hra má verzi ${d.verze}, hra umí ${VERZE}`);
    const hra = S.hra.zalozHru(d.seed, d.velikost), sv = hra.sv;
    const kopie = JSON.parse(JSON.stringify(d));
    for (const k of KLICE) if (kopie[k] !== undefined) hra[k] = kopie[k];
    for (const k of POLE_SV) zRle(kopie.sv[k], sv[k]);
    for (const k of POLE_HRA) zRle(kopie.pole[k], hra[k]);
    sv.schody = kopie.schody;
    hra.rez = new Map(kopie.rez);
    hra.prichoziNa = new Map(kopie.prichoziNa);
    // odvozené mapy
    hra.budovaNa.fill(0);
    for (const b of hra.budovy) for (const g of b.bunky) hra.budovaNa[g] = b.id;
    hra.planNa = new Map();
    for (const pl of hra.plany) for (const g of pl.bunky) hra.planNa.set(g, pl.id);
    hra.zmeny = []; hra.zmenyVse = true; hra.zmenaPraci = 1; hra.verzeTerenu = 1;
    if (hra.tik > 0) sv.obdobi = S.obdobi.obdobi(hra);     // období na začátku dne už platilo (led, sníh)
    return hra;
  }

  S.ulozeni = { VERZE, KLICE, PRECHODNE, uloz, nacti, rle, zRle };
})(SIN);

if (typeof module !== 'undefined') module.exports = SIN;

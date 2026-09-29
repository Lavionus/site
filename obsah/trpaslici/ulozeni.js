/* ============================================================
   Srdce hory – ulozeni.js: uložení a obnova hry.

   Hora se po načtení vygeneruje znovu ze seedu a přepíšou se jen
   pole, která se hrou mění (terén, rudy, objekty, znalost, stavby…).
   Pole se ukládají jako RLE (hodnota, délka běhu) v base64 – většina
   hory jsou dlouhé běhy stejných hodnot, uložená hra má desítky kB.
   Čistá logika bez DOM (base64 přes btoa/atob, v node přes Buffer).
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const VERZE = 9;
  const POLE = ['teren', 'ruda', 'obj'];                        // v hra.hora
  const POLE_HRY = ['znamo', 'lez', 'oznac', 'stavba', 'zona', 'uroda', 'vykopane', 'zavreno', 'stavbaStav', 'prio'];  // v hra

  const naB64 = u8 => typeof btoa === 'function'
    ? btoa(Array.from(u8, c => String.fromCharCode(c)).join('')) : Buffer.from(u8).toString('base64');
  const zB64 = s => typeof atob === 'function'
    ? Uint8Array.from(atob(s), c => c.charCodeAt(0)) : new Uint8Array(Buffer.from(s, 'base64'));

  function rle(a) {
    const out = [];
    for (let i = 0; i < a.length;) {
      const v = a[i]; let n = 1;
      while (i + n < a.length && a[i + n] === v && n < 255) n++;
      out.push(v, n); i += n;
    }
    return naB64(Uint8Array.from(out));
  }
  function zRle(s, delka) {
    const b = zB64(s), a = new Uint8Array(delka);
    let k = 0;
    for (let j = 0; j < b.length; j += 2) { a.fill(b[j], k, k + b[j + 1]); k += b[j + 1]; }
    if (k !== delka) throw new Error('poškozená data pole');
    return a;
  }

  function serializuj(hra) {
    const d = { hra: 'srdce-hory', verze: VERZE, seed: hra.seed, pole: {} };
    for (const k of POLE) d.pole[k] = rle(hra.hora[k]);
    for (const k of POLE_HRY) d.pole[k] = rle(hra[k]);
    for (const k of ['tik', 'dalsiId', 'rng', 'vykopano', 'nejhloubeji', 'nalezeno', 'objeveno', 'denik', 'svetloZmena',
                     'zony', 'plany', 'dilny', 'parezy', 'trpaslici', 'veci', 'slava', 'slavaBonus', 'karavana', 'udalost', 'posledniDar',
                     'praskani', 'prameny', 'stabilitaZmena', 'stabilitaKlid', 'vodaKlid', 'klidKroku', 'odteklo', 'odcerpano', 'varovaniStrop', 'cyklus', 'tvorove', 'dalsiNajezd', 'pastiNapnout', 'zabito', 'najezdu',
                     'rezim', 'prectene', 'deskyPrectene', 'odemceno', 'artefakty', 'spac', 'zazehnuti', 'vyhenHori', 'konec', 'maxTrp', 'padlo']) d[k] = hra[k];
    d.rez = [...hra.rez];
    d.materialNa = [...hra.materialNa];
    return JSON.stringify(d);
  }
  function obnov(text) {
    const d = typeof text === 'string' ? JSON.parse(text) : text;
    if (!d || d.hra !== 'srdce-hory') throw new Error('to není uložená hra Srdce hory');
    if (d.verze !== VERZE) throw new Error(`uložená hra je ze starší verze (${d.verze}), nedá se načíst`);
    const hra = T.hra.novaHra(d.seed);
    const N = hra.hora.teren.length;
    for (const k of POLE) hra.hora[k] = zRle(d.pole[k], N);
    for (const k of POLE_HRY) hra[k] = zRle(d.pole[k], N);
    for (const k of ['tik', 'dalsiId', 'rng', 'vykopano', 'nejhloubeji', 'nalezeno', 'objeveno', 'denik', 'svetloZmena',
                     'zony', 'plany', 'dilny', 'parezy', 'trpaslici', 'veci', 'slava', 'slavaBonus', 'karavana', 'udalost', 'posledniDar',
                     'praskani', 'prameny', 'stabilitaZmena', 'stabilitaKlid', 'vodaKlid', 'klidKroku', 'odteklo', 'odcerpano', 'varovaniStrop', 'cyklus', 'tvorove', 'dalsiNajezd', 'pastiNapnout', 'zabito', 'najezdu',
                     'rezim', 'prectene', 'deskyPrectene', 'odemceno', 'artefakty', 'spac', 'zazehnuti', 'vyhenHori', 'konec', 'maxTrp', 'padlo']) hra[k] = d[k];
    hra.rez = new Map(d.rez);
    hra.materialNa = new Map(d.materialNa);
    hra.planNa = new Map();
    for (const p of hra.plany) for (const j of T.stavby.bunkyPlanu(p.typ, p.i)) hra.planNa.set(j, p.id);
    return hra;
  }

  T.ulozeni = { VERZE, serializuj, obnov };
})(TRP);

if (typeof module !== 'undefined') module.exports = TRP;

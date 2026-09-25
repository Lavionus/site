/* ============================================================
   Trosečníci – nahoda.js: seedovaná náhoda a šum.

   Čistá logika bez DOM. Všechny soubory hry sdílejí jmenný prostor
   TROS (globalThis.TROS), takže jdou načíst v prohlížeči obyčejným
   <script> (i přes file://) a v node přes require.
   ============================================================ */
var TROS = globalThis.TROS = globalThis.TROS || {};

(function (T) {
  'use strict';

  // mulberry32 – rychlý 32bitový generátor, stejný jako v Nekonečném podzemí
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // hash dvou/tří celých čísel → 32 bitů (pro šum a odvozené seedy)
  function smichej(a, b, c) {
    let h = (a | 0) ^ Math.imul((b | 0) + 0x9E3779B9 | 0, 0x85EBCA6B);
    h ^= Math.imul((c | 0) + 0x7F4A7C15 | 0, 0xC2B2AE35);
    h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35); h ^= h >>> 16;
    h = Math.imul(h, 0x27D4EB2F); h ^= h >>> 15;
    return h >>> 0;
  }

  // text → seed (FNV-1a); číslo zůstane číslem
  function seedZTextu(s) {
    s = String(s).trim();
    if (/^\d+$/.test(s)) return Number(s) >>> 0;
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // Generátor s pomocnými metodami
  function Nahoda(seed) {
    const r = mulberry32(seed >>> 0);
    return {
      dalsi: r,
      cele(a, b) { return a + Math.floor(r() * (b - a + 1)); },   // a..b včetně
      sance(p) { return r() < p; },
      vyber(pole) { return pole[Math.floor(r() * pole.length)]; },
      zamichej(pole) {
        for (let i = pole.length - 1; i > 0; i--) {
          const j = Math.floor(r() * (i + 1)); const t = pole[i]; pole[i] = pole[j]; pole[j] = t;
        }
        return pole;
      },
    };
  }

  // Hodnotový šum 2D s hladkou interpolací, 0..1
  function sum2D(seed) {
    function mriz(x, y) { return smichej(seed, x, y) / 4294967296; }
    function hladka(t) { return t * t * (3 - 2 * t); }
    return function (x, y) {
      const x0 = Math.floor(x), y0 = Math.floor(y);
      const fx = hladka(x - x0), fy = hladka(y - y0);
      const a = mriz(x0, y0), b = mriz(x0 + 1, y0), c = mriz(x0, y0 + 1), d = mriz(x0 + 1, y0 + 1);
      return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
    };
  }

  // Fraktálový šum (několik oktáv), výsledek zhruba 0..1
  function fbm(seed, oktavy) {
    const vrstvy = [];
    for (let i = 0; i < oktavy; i++) vrstvy.push(sum2D(smichej(seed, i, 99)));
    return function (x, y) {
      let s = 0, amp = 1, frek = 1, norma = 0;
      for (let i = 0; i < oktavy; i++) {
        s += vrstvy[i](x * frek, y * frek) * amp;
        norma += amp; amp *= 0.5; frek *= 2;
      }
      return s / norma;
    };
  }

  // Seed „Ostrova dne" – pro všechny hráče stejný
  function seedDne(datum) {
    const d = datum || new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  T.nahoda = { mulberry32, smichej, seedZTextu, Nahoda, sum2D, fbm, seedDne };
})(TROS);

if (typeof module !== 'undefined') module.exports = TROS;

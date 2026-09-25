/* ============================================================
   Trosečníci – pocasi.js: počasí a předpověď.

   Čistá logika bez DOM. Počasí se plánuje dopředu (plán drží stav hry),
   takže předpověď na zítřek a pozítří vždy vyjde. Každých 9–16 dní
   přijde tropická bouře; den před ní sílí vítr a ohlásí se 2 dny předem.

   Účinky:
     ☀️ slunce, ⛅ polojasno – nic zvláštního
     🌧️ déšť   – sběrače +3 💧 každý, +2 💧 do nádob; bez úkrytu −3 ❤️
     🔥 vedro  – každý vypije 3 💧 místo 2, výprava −1 AB, sběrače nic
     🌬️ vítr   – předzvěst bouře
     ⛈️ bouře  – výprava −4 AB, všechny nádoby se naplní, bez úkrytu −10 ❤️,
                 v noci může poškodit stavby, zničit úrodu a polámat stromy
   ============================================================ */
var TROS = globalThis.TROS = globalThis.TROS || {};

(function (T) {
  'use strict';
  const { Nahoda, smichej } = T.nahoda;

  const TYPY = {
    slunce:    { ikona: '☀️', nazev: 'Slunečno', teplota: [29, 32] },
    polojasno: { ikona: '⛅', nazev: 'Polojasno', teplota: [27, 29] },
    dest:      { ikona: '🌧️', nazev: 'Déšť', teplota: [24, 26] },
    vedro:     { ikona: '🔥', nazev: 'Vedro', teplota: [35, 38] },
    vitr:      { ikona: '🌬️', nazev: 'Sílící vítr', teplota: [26, 28] },
    boure:     { ikona: '⛈️', nazev: 'Tropická bouře', teplota: [23, 25] },
  };
  const AB_POSTIH = { vedro: 1, boure: 4 };
  const PRVNI_BOURE = [8, 12], ROZESTUP_BOURI = [9, 16];

  function r(s, den, sul) { return Nahoda(smichej(s.seed, den * 31 + sul, 555)); }

  function nove(s) {
    const n = r(s, 0, 1);
    const p = { plan: {}, teploty: {}, dalsiBoure: s.den + n.cele(PRVNI_BOURE[0], PRVNI_BOURE[1]) };
    s.pocasi = p;
    p.plan[s.den] = 'slunce'; p.teploty[s.den] = 31;
    doplnPlan(s);
    return p;
  }
  // plán aspoň na 3 dny dopředu
  function doplnPlan(s) {
    const p = s.pocasi;
    for (let d = s.den; d <= s.den + 3; d++) {
      if (p.plan[d]) continue;
      const n = r(s, d, 2), pred = p.plan[d - 1] || 'slunce';
      let t;
      if (d === p.dalsiBoure) t = 'boure';
      else if (d === p.dalsiBoure - 1) t = 'vitr';
      else if (pred === 'boure') t = 'dest';
      else {
        const x = n.dalsi();
        const vedroZaSebou = pred === 'vedro' && p.plan[d - 2] === 'vedro' && p.plan[d - 3] === 'vedro';
        if (pred === 'dest') t = x < 0.4 ? 'dest' : x < 0.75 ? 'polojasno' : 'slunce';
        else if (pred === 'vedro') t = vedroZaSebou ? 'slunce' : x < 0.5 ? 'vedro' : x < 0.85 ? 'slunce' : 'polojasno';
        else t = x < 0.52 ? 'slunce' : x < 0.76 ? 'polojasno' : x < 0.9 ? 'dest' : 'vedro';
      }
      p.plan[d] = t;
      const [a, b] = TYPY[t].teplota;
      p.teploty[d] = n.cele(a, b);
      if (t === 'boure') p.dalsiBoure = d + n.cele(ROZESTUP_BOURI[0], ROZESTUP_BOURI[1]);
    }
    // starý plán netřeba držet
    for (const k of Object.keys(p.plan)) if (+k < s.den - 1) { delete p.plan[k]; delete p.teploty[k]; }
  }
  const dnes = s => s.pocasi.plan[s.den];
  const zitra = s => s.pocasi.plan[s.den + 1];
  function predpoved(s, dni) {
    const v = [];
    for (let d = s.den + 1; d <= s.den + (dni || 2); d++) v.push({ den: d, typ: s.pocasi.plan[d], teplota: s.pocasi.teploty[d], ...TYPY[s.pocasi.plan[d]] });
    return v;
  }
  // za kolik dní přijde bouře (v dosahu předpovědi), jinak -1
  function bourePredpoved(s) {
    for (let k = 0; k <= 2; k++) if (s.pocasi.plan[s.den + k] === 'boure') return k;
    return -1;
  }
  function abPostih(s) { return AB_POSTIH[dnes(s)] || 0; }
  function vodaNaOsobu(s) { return dnes(s) === 'vedro' ? 3 : 2; }

  T.pocasi = { TYPY, AB_POSTIH, nove, doplnPlan, dnes, zitra, predpoved, bourePredpoved, abPostih, vodaNaOsobu };
})(TROS);

if (typeof module !== 'undefined') module.exports = TROS;

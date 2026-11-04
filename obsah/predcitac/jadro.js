/* Předčítač – čisté funkce (bez DOM): Markdown → odstavce → věty, kusy pro syntézu, WAV.
   window.PREDC_JADRO v prohlížeči, module.exports v node (_test/predcitac_test.js). */
(function (koren) {
  'use strict';

  // Markdown (nebo prostý text) → pole odstavců prostého textu; nadpisy jsou samostatné odstavce
  function mdNaOdstavce(md) {
    const radky = String(md || '').replace(/\r\n?/g, '\n')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/^(```|~~~)[\s\S]*?^\1.*$/gm, '')          // bloky kódu se nečtou
      .split('\n');
    const odst = [];
    let kus = [];
    const uzavri = () => { const t = kus.join(' ').replace(/\s+/g, ' ').trim(); if (t) odst.push(t); kus = []; };
    for (let r of radky) {
      if (!r.trim() || /^\s*([-*_])(\s*\1){2,}\s*$/.test(r)) { uzavri(); continue; }   // prázdný řádek, předěl
      if (/^\s*\|?\s*:?-{3,}/.test(r) && r.includes('-') && /^[\s|:-]+$/.test(r)) continue; // oddělovač tabulky
      const nadpis = /^\s{0,3}#{1,6}\s+/.test(r);
      const odrazka = /^\s*([-*+]|\d+[.)])\s+/.test(r);
      r = r.replace(/^\s{0,3}#{1,6}\s+/, '').replace(/\s+#+\s*$/, '')
        .replace(/^\s*>+\s?/, '')                          // citace
        .replace(/^\s*([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/, '') // odrážky, úkoly
        .replace(/^\s*\|/, '').replace(/\|\s*$/, '').replace(/\s*\|\s*/g, ', ');
      if (nadpis || odrazka) uzavri();
      kus.push(inline(r));
      if (nadpis) uzavri();
    }
    uzavri();
    return odst.filter(t => /[\p{L}\p{N}]/u.test(t));
  }

  function inline(t) {
    return t
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')                 // obrázky
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')              // odkazy → text
      .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/(\*\*|__)(.+?)\1/g, '$2')
      .replace(/(^|[^\p{L}\p{N}])[*_](?=\S)(.+?)(?<=\S)[*_](?=[^\p{L}\p{N}]|$)/gu, '$1$2')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/\\([\\`*_{}[\]()#+\-.!>|])/g, '$1')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  }

  // zkratky, po kterých tečka nekončí větu (malými písmeny, bez tečky)
  const ZKRATKY = new Set(('např tj tzv atd apod resp popř mj tzn cca str č čís odst písm sv p pí sl ing mgr bc phdr mudr judr rndr doc prof dr st n l př kr t r min max ul nám tel mr mrs ms dr vs etc e g i e no vol fig').split(' '));

  // odstavec → věty (dlouhé věty se dělí u čárek, aby syntéza nedostala obří kus)
  function vety(odstavec, max = 300) {
    const t = odstavec.trim();
    const out = [];
    const re = /[.!?…]+[“"»’)\]]*(?=\s+|$)/g;
    let od = 0, m;
    while ((m = re.exec(t))) {
      const konec = m.index + m[0].length;
      const pred = t.slice(od, m.index);
      const slovo = (pred.match(/([\p{L}]+)$/u) || [])[1] || '';
      const dalsi = t.slice(konec).trimStart();
      if (m[0] === '.' && dalsi) {
        const zkratka = ZKRATKY.has(slovo.toLowerCase()) || /\d$/.test(pred);
        if (zkratka && !/^\p{Lu}/u.test(dalsi)) continue;   // „např. když“, „1. ledna“
        if (/^\p{Lu}$/u.test(slovo)) continue;               // iniciála: „T. G. Masaryk“
      }
      out.push(t.slice(od, konec).trim());
      od = konec;
    }
    if (od < t.length && t.slice(od).trim()) out.push(t.slice(od).trim());
    return out.flatMap(v => rozdelDlouhou(v, max)).filter(v => /[\p{L}\p{N}]/u.test(v));
  }

  function rozdelDlouhou(v, max) {
    if (v.length <= max) return [v];
    const casti = v.split(/(?<=[,;:–—])\s+/);
    const out = [];
    let kus = '';
    for (const c of casti) {
      if (kus && (kus + ' ' + c).length > max) { out.push(kus); kus = c; } else kus = kus ? kus + ' ' + c : c;
    }
    if (kus) out.push(kus);
    // pořád dlouhé (bez čárek) → po slovech
    return out.flatMap(k => {
      if (k.length <= max) return [k];
      const r = [];
      let s = '';
      for (const w of k.split(/\s+/)) { if (s && (s + ' ' + w).length > max) { r.push(s); s = w; } else s = s ? s + ' ' + w : w; }
      if (s) r.push(s);
      return r;
    });
  }

  // dokument → plochý seznam vět {text, odst, konecOdst}
  function rozeber(md) {
    const seznam = [];
    mdNaOdstavce(md).forEach((o, oi) => {
      const v = vety(o);
      v.forEach((text, i) => seznam.push({ text, odst: oi, konecOdst: i === v.length - 1 }));
    });
    return seznam;
  }

  // kus = věty do ~znaku znaků (aspoň jedna); celyNajednou = vše do jednoho kusu
  function dalsiKus(vetySeznam, od, { celyNajednou = false, znaku = 700 } = {}) {
    if (od >= vetySeznam.length) return null;
    if (celyNajednou) return { od, do: vetySeznam.length };
    const limit = znaku;
    let n = 0, i = od;
    while (i < vetySeznam.length && (i === od || n + vetySeznam[i].text.length <= limit)) { n += vetySeznam[i].text.length; i++; }
    return { od, do: i };
  }

  // pauza za větou v sekundách (konec odstavce delší)
  const pauza = veta => veta.konecOdst ? 0.65 : 0.3;

  // Float32 PCM → Int16 (ořez do rozsahu)
  function naInt16(f32) {
    const out = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      const v = f32[i];
      out[i] = v >= 1 ? 32767 : v <= -1 ? -32768 : (v * 32767) | 0;
    }
    return out;
  }

  // hlavička WAV (PCM 16 bit mono) pro daný počet vzorků
  function wavHlavicka(vzorku, frekvence) {
    const h = new DataView(new ArrayBuffer(44));
    const zapis = (o, s) => { for (let i = 0; i < 4; i++) h.setUint8(o + i, s.charCodeAt(i)); };
    zapis(0, 'RIFF'); h.setUint32(4, 36 + vzorku * 2, true); zapis(8, 'WAVE');
    zapis(12, 'fmt '); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true);
    h.setUint32(24, frekvence, true); h.setUint32(28, frekvence * 2, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true);
    zapis(36, 'data'); h.setUint32(40, vzorku * 2, true);
    return h.buffer;
  }

  // index věty v kusu podle času přehrávání (casy = začátky vět v sekundách, vzestupně)
  function vetaVCase(casy, t) {
    let lo = 0, hi = casy.length - 1, r = 0;
    while (lo <= hi) { const s = (lo + hi) >> 1; if (casy[s] <= t + 0.05) { r = s; lo = s + 1; } else hi = s - 1; }
    return r;
  }

  const formatCas = s => {
    s = Math.max(0, Math.round(s));
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
  };

  const API = { mdNaOdstavce, inline, vety, rozeber, dalsiKus, pauza, naInt16, wavHlavicka, vetaVCase, formatCas };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else koren.PREDC_JADRO = API;
})(typeof window !== 'undefined' ? window : globalThis);

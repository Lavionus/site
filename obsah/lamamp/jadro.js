/* Lamamp – jádro přehrávače (WA_JADRO): playlist, výběr, pořadí (shuffle/repeat), seznamy M3U/PLS,
   předvolby ekvalizéru a soubory .eqf. Bez DOM – testuje se v node. */
(function () {
  'use strict';

  let posledniId = 0;
  const noveId = () => Date.now().toString(36) + '-' + (++posledniId).toString(36);

  const PRIPONY = /\.(mp3|m4a|m4b|aac|mp4|flac|ogg|oga|opus|wav|wave|webm|weba|alac|aif|aiff|caf)$/i;
  const jeZvuk = (nazev, typ = '') => PRIPONY.test(nazev) || /^audio\//.test(typ);
  const jeSeznam = nazev => /\.(m3u8?|pls)$/i.test(nazev);
  const jeSkin = nazev => /\.(wsz|zip)$/i.test(nazev);

  // ---------- položka a její titulek ----------
  function novaPolozka(o) {
    return Object.assign({ id: noveId(), soubor: '', cesta: '', titul: '', interpret: '', album: '', rok: '', stopa: '', zanr: '',
      delka: null, kbps: null, khz: null, kanaly: null, format: '', url: '', vybrana: false }, o);
  }
  const bezPripony = n => String(n).replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
  // titulek jako ve Winampu: „Interpret - Název“, jinak jméno souboru (podtržítka → mezery)
  function titulek(p) {
    if (p.titul && p.interpret) return `${p.interpret} - ${p.titul}`;
    if (p.titul) return p.titul;
    if (p.url && !p.soubor) return p.url;
    return bezPripony(p.soubor).replace(/_/g, ' ');
  }
  const mmss = s => {
    if (s === null || s === undefined || !isFinite(s)) return '';
    s = Math.max(0, Math.round(s));
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sek = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${sek}` : `${m}:${sek}`;
  };

  // ---------- playlist ----------
  function novyPlaylist() { return { polozky: [], aktualni: -1, poradi: [], kotva: -1 }; }

  function pridej(pl, nove, kam = pl.polozky.length) {
    pl.polozky.splice(kam, 0, ...nove);
    if (pl.aktualni >= kam) pl.aktualni += nove.length;
    pl.poradi = [];
    return nove;
  }
  function odeberIndexy(pl, indexy) {
    const pryc = new Set(indexy);
    const akt = pl.polozky[pl.aktualni];
    pl.polozky = pl.polozky.filter((_, i) => !pryc.has(i));
    pl.aktualni = akt ? pl.polozky.indexOf(akt) : -1;
    pl.poradi = [];
  }
  const odeberVybrane = pl => odeberIndexy(pl, pl.polozky.map((p, i) => p.vybrana ? i : -1).filter(i => i >= 0));
  const orez = pl => odeberIndexy(pl, pl.polozky.map((p, i) => p.vybrana ? -1 : i).filter(i => i >= 0));
  const odeberVse = pl => odeberIndexy(pl, pl.polozky.map((_, i) => i));

  // výběr: klik / Ctrl / Shift jako v Průzkumníku
  function vyber(pl, i, { ctrl = false, shift = false } = {}) {
    if (shift && pl.kotva >= 0) {
      const [a, b] = [Math.min(pl.kotva, i), Math.max(pl.kotva, i)];
      pl.polozky.forEach((p, j) => { p.vybrana = (ctrl && p.vybrana) || (j >= a && j <= b); });
      return;
    }
    if (ctrl) pl.polozky[i].vybrana = !pl.polozky[i].vybrana;
    else pl.polozky.forEach((p, j) => { p.vybrana = j === i; });
    pl.kotva = i;
  }
  const vyberVse = (pl, ano = true) => pl.polozky.forEach(p => { p.vybrana = ano; });
  const obratVyber = pl => pl.polozky.forEach(p => { p.vybrana = !p.vybrana; });

  // posun vybraných o `o` řádků (tažení myší); vybrané drží pohromadě v původním pořadí
  function posunVybrane(pl, o) {
    const n = pl.polozky.length, idx = pl.polozky.map((p, i) => p.vybrana ? i : -1).filter(i => i >= 0);
    if (!idx.length || !o) return 0;
    o = Math.max(-idx[0], Math.min(n - 1 - idx[idx.length - 1], o));
    if (!o) return 0;
    const akt = pl.polozky[pl.aktualni], nove = new Array(n), vybrane = new Set(idx);
    idx.forEach(i => { nove[i + o] = pl.polozky[i]; });
    const ostatni = pl.polozky.filter((_, i) => !vybrane.has(i));
    for (let i = 0, j = 0; i < n; i++) if (!nove[i]) nove[i] = ostatni[j++];
    pl.polozky = nove;
    pl.aktualni = akt ? nove.indexOf(akt) : -1;
    pl.kotva = pl.kotva >= 0 ? Math.max(0, Math.min(n - 1, pl.kotva + o)) : -1;
    return o;
  }

  const POROVNANI = {
    titulek: (a, b) => titulek(a).localeCompare(titulek(b), 'cs', { sensitivity: 'base' }),
    soubor: (a, b) => (a.soubor || a.url).localeCompare(b.soubor || b.url, 'cs', { numeric: true }),
    cesta: (a, b) => ((a.cesta || '') + a.soubor).localeCompare((b.cesta || '') + b.soubor, 'cs', { numeric: true })
  };
  function serad(pl, podle) {
    const akt = pl.polozky[pl.aktualni];
    if (podle === 'obratit') pl.polozky.reverse();
    else if (podle === 'nahodne') zamichejPole(pl.polozky);
    else pl.polozky.sort(POROVNANI[podle]);
    pl.aktualni = akt ? pl.polozky.indexOf(akt) : -1;
    pl.poradi = [];
  }
  function zamichejPole(a, nahoda = Math.random) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(nahoda() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // ---------- pořadí přehrávání ----------
  // při shuffle se drží zamíchané pořadí; aktuální skladba je v něm první, aby se neopakovala
  function poradiShuffle(pl, nahoda) {
    if (pl.poradi.length !== pl.polozky.length) {
      const ostatni = zamichejPole(pl.polozky.map((_, i) => i).filter(i => i !== pl.aktualni), nahoda);
      pl.poradi = pl.aktualni >= 0 ? [pl.aktualni, ...ostatni] : ostatni;
    }
    return pl.poradi;
  }
  function dalsi(pl, { shuffle = false, repeat = false, nahoda } = {}) {
    const n = pl.polozky.length;
    if (!n) return -1;
    if (!shuffle) {
      if (pl.aktualni + 1 < n) return pl.aktualni + 1;
      return repeat ? 0 : -1;
    }
    const p = poradiShuffle(pl, nahoda), i = p.indexOf(pl.aktualni);
    if (i + 1 < p.length) return p[i + 1];
    if (!repeat) return -1;
    pl.poradi = [];
    const nove = zamichejPole(pl.polozky.map((_, j) => j), nahoda);
    if (n > 1 && nove[0] === pl.aktualni) nove.push(nove.shift());   // stejná skladba hned znovu ne
    pl.poradi = nove;
    return nove[0];
  }
  function predchozi(pl, { shuffle = false, repeat = false, nahoda } = {}) {
    const n = pl.polozky.length;
    if (!n) return -1;
    if (!shuffle) {
      if (pl.aktualni > 0) return pl.aktualni - 1;
      return repeat ? n - 1 : 0;
    }
    const p = poradiShuffle(pl, nahoda), i = p.indexOf(pl.aktualni);
    return i > 0 ? p[i - 1] : (repeat ? p[p.length - 1] : p[0]);
  }

  function casy(pl) {
    let vybrane = 0, celkem = 0, neznamy = false;
    for (const p of pl.polozky) {
      if (p.delka) { celkem += p.delka; if (p.vybrana) vybrane += p.delka; } else neznamy = true;
    }
    return { vybrane, celkem, neznamy };
  }
  // „J“ – skok na skladbu: všechna slova musí být v titulku (bez diakritiky a velikosti písmen)
  const bezDiakritiky = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function hledej(pl, dotaz) {
    const slova = bezDiakritiky(dotaz).split(/\s+/).filter(Boolean);
    return pl.polozky.map((p, i) => ({ p, i }))
      .filter(({ p }) => { const t = bezDiakritiky(titulek(p) + ' ' + p.album + ' ' + p.soubor); return slova.every(s => t.includes(s)); })
      .map(({ i }) => i);
  }

  // ---------- M3U / PLS ----------
  function exportM3u(pl) {
    return '#EXTM3U\n' + pl.polozky.map(p =>
      `#EXTINF:${p.delka ? Math.round(p.delka) : -1},${titulek(p)}\n${p.url || (p.cesta ? p.cesta + '/' : '') + p.soubor}`).join('\n') + '\n';
  }
  function exportPls(pl) {
    const r = ['[playlist]'];
    pl.polozky.forEach((p, i) => {
      r.push(`File${i + 1}=${p.url || (p.cesta ? p.cesta + '/' : '') + p.soubor}`, `Title${i + 1}=${titulek(p)}`, `Length${i + 1}=${p.delka ? Math.round(p.delka) : -1}`);
    });
    r.push(`NumberOfEntries=${pl.polozky.length}`, 'Version=2');
    return r.join('\n') + '\n';
  }
  // → [{ cesta, titul, delka }] v pořadí seznamu
  function nactiSeznam(text, nazev = '') {
    const radky = String(text).replace(/^﻿/, '').split(/\r?\n/).map(r => r.trim());
    if (/\.pls$/i.test(nazev) || /^\[playlist\]/i.test(radky[0] || '')) {
      const z = {};
      for (const r of radky) {
        const m = r.match(/^(File|Title|Length)(\d+)=(.*)$/i);
        if (m) { (z[m[2]] = z[m[2]] || {})[m[1].toLowerCase()] = m[3]; }
      }
      return Object.keys(z).sort((a, b) => a - b).filter(k => z[k].file)
        .map(k => ({ cesta: z[k].file, titul: z[k].title || '', delka: Number(z[k].length) > 0 ? Number(z[k].length) : null }));
    }
    const vysl = []; let info = null;
    for (const r of radky) {
      if (!r) continue;
      const m = r.match(/^#EXTINF:\s*(-?\d+)[^,]*,(.*)$/i);
      if (m) { info = { delka: Number(m[1]) > 0 ? Number(m[1]) : null, titul: m[2].trim() }; continue; }
      if (r.startsWith('#')) continue;
      vysl.push({ cesta: r, titul: info ? info.titul : '', delka: info ? info.delka : null });
      info = null;
    }
    return vysl;
  }
  // seřadí nové položky podle seznamu (shoda jména souboru bez ohledu na složku a velikost písmen)
  function seradPodleSeznamu(polozky, seznam) {
    const dekoduj = t => { try { return decodeURIComponent(t); } catch (e) { return t; } };   // „100% hit.mp3“
    const klic = c => dekoduj(String(c).replace(/^.*[\\/]/, '')).toLowerCase();
    const poradi = new Map(seznam.map((z, i) => [klic(z.cesta), i]));
    const v = polozky.filter(p => poradi.has(klic(p.soubor))).sort((a, b) => poradi.get(klic(a.soubor)) - poradi.get(klic(b.soubor)));
    return v.concat(polozky.filter(p => !poradi.has(klic(p.soubor))));
  }

  // ---------- ekvalizér ----------
  const PASMA = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
  const NAZVY_PASEM = ['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K'];
  // předvolby v dB (−12 … +12), pořadí pásem jako PASMA; preamp zvlášť
  const PREDVOLBY = [
    ['Classical', 0, [0, 0, 0, 0, 0, 0, -7, -7, -7, -9]],
    ['Club', 0, [0, 0, 8, 5, 5, 5, 3, 0, 0, 0]],
    ['Dance', 0, [9, 7, 2, 0, 0, -5, -7, -7, 0, 0]],
    ['Flat', 0, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    ['Full Bass', -3, [-8, 9, 9, 5, 1, -4, -8, -10, -11, -11]],
    ['Full Bass & Treble', -2, [7, 5, 0, -7, -5, 1, 8, 11, 12, 12]],
    ['Full Treble', -4, [-9, -9, -9, -4, 2, 11, 12, 12, 12, 12]],
    ['Laptop Speakers/Headphones', -1, [4, 11, 5, -3, -2, 1, 4, 9, 12, 12]],
    ['Large Hall', 0, [10, 10, 5, 5, 0, -4, -4, -4, 0, 0]],
    ['Live', 0, [-4, 0, 4, 5, 5, 5, 4, 2, 2, 2]],
    ['Party', 0, [7, 7, 0, 0, 0, 0, 0, 0, 7, 7]],
    ['Pop', 0, [-1, 4, 7, 8, 5, 0, -2, -2, -1, -1]],
    ['Reggae', 0, [0, 0, 0, -5, 0, 6, 6, 0, 0, 0]],
    ['Rock', 0, [8, 4, -5, -8, -3, 4, 8, 11, 11, 11]],
    ['Ska', 0, [-2, -4, -4, 0, 4, 5, 8, 9, 11, 9]],
    ['Soft', 0, [4, 1, 0, -2, 0, 4, 8, 9, 11, 12]],
    ['Soft Rock', 0, [4, 4, 2, 0, -4, -5, -3, 0, 2, 8]],
    ['Techno', 0, [8, 5, 0, -5, -4, 0, 8, 9, 9, 8]]
  ].map(([nazev, preamp, pasma]) => ({ nazev, preamp, pasma }));

  // .eqf: hlavička „Winamp EQ library file v1.1“ 0x1A „!--“, pak záznamy: jméno 257 B + 11 B hodnot
  // (10 pásem a preamp, 0 = +12 dB, 63 = −12 dB)
  const HLAVICKA_EQF = 'Winamp EQ library file v1.1\x1a!--';
  const dbNaEqf = db => Math.max(0, Math.min(63, Math.round(31.5 - db * 31.5 / 12)));
  // 0 dB leží v .eqf mezi 31 a 32 → hodnoty u středu přichytit na 0 (jinak „Flat“ = −0,2 dB)
  const eqfNaDb = v => { const db = Math.round((31.5 - v) * 12 / 31.5 * 10) / 10; return Math.abs(db) < 0.25 ? 0 : db; };
  function nactiEqf(bajty) {
    const b = bajty instanceof Uint8Array ? bajty : new Uint8Array(bajty);
    let hl = ''; for (let i = 0; i < 27; i++) hl += String.fromCharCode(b[i]);
    if (hl !== 'Winamp EQ library file v1.1') throw new Error('Není to soubor předvoleb ekvalizéru (.eqf).');
    const vysl = [];
    for (let i = 31; i + 268 <= b.length; i += 268) {
      let nazev = ''; for (let j = i; j < i + 257 && b[j]; j++) nazev += String.fromCharCode(b[j]);
      const h = Array.from(b.subarray(i + 257, i + 268), eqfNaDb);
      vysl.push({ nazev: nazev || 'Bez názvu', pasma: h.slice(0, 10), preamp: h[10] });
    }
    return vysl;
  }
  function exportEqf(predvolby) {
    const b = new Uint8Array(31 + predvolby.length * 268);
    for (let i = 0; i < 31; i++) b[i] = HLAVICKA_EQF.charCodeAt(i);
    predvolby.forEach((p, k) => {
      const o = 31 + k * 268;
      const jmeno = String(p.nazev).normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 256);
      for (let i = 0; i < jmeno.length; i++) b[o + i] = jmeno.charCodeAt(i) & 0xFF;
      [...p.pasma, p.preamp].forEach((db, i) => { b[o + 257 + i] = dbNaEqf(db); });
    });
    return b;
  }

  window.WA_JADRO = {
    noveId, jeZvuk, jeSeznam, jeSkin, novaPolozka, titulek, bezPripony, mmss,
    novyPlaylist, pridej, odeberIndexy, odeberVybrane, orez, odeberVse, vyber, vyberVse, obratVyber, posunVybrane, serad,
    dalsi, predchozi, casy, hledej, bezDiakritiky,
    exportM3u, exportPls, nactiSeznam, seradPodleSeznamu,
    PASMA, NAZVY_PASEM, PREDVOLBY, nactiEqf, exportEqf, dbNaEqf, eqfNaDb
  };
})();

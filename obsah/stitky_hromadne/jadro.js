/* ============================================================
   Hromadný tisk štítků – jádro bez DOM
   Geometrie archů, rozdělení záznamů na archy, CSV, číslování,
   dosazování polí, EAN-13/EAN-8/Code128 a rozvržení štítku do
   kreslicích primitiv v milimetrech (kreslí je vykres.js).
   Vystaveno jako window.STITKY a module.exports (testy v node).
   ============================================================ */
(function (koren) {
'use strict';

const PT = 25.4 / 72;            // 1 pt v mm
const ASC = 0.905, DESC = 0.212; // metriky Liberation Sans (podíl em)

const PAPIRY = {
  a4: { nazev: 'A4', w: 210, h: 297 },
  a5: { nazev: 'A5', w: 148, h: 210 },
  letter: { nazev: 'Letter', w: 215.9, h: 279.4 },
};

/* ---------- databáze archů ----------
   Rozměry podle katalogových listů výrobců (Avery Zweckform, Avery L-řada);
   okraje, kde nejsou uvedeny, se dopočítají souměrně. Před velkým tiskem
   ručně ověřit podle údajů na balení – výrobci rozměry občas mění. */
const ZDROJ_ARCHU = 'Katalogové listy Avery Zweckform / Avery (L-řada), stav 10/2026 – rozměry ručně ověřit podle balení.';
function a(vyrobce, kody, w, h, sl, ra, mezX, mezY, pozn) {
  return { id: (vyrobce === 'Avery' ? '' : 'z') + kody.split(/[ /,]/)[0], vyrobce, kody, w, h, sl, ra,
    mezX: mezX || 0, mezY: mezY || 0, papir: 'a4', overit: true, pozn: pozn || '' };
}
const ARCHY = [
  a('Avery Zweckform', '3474', 70, 37, 3, 8),
  a('Avery Zweckform', '3475', 70, 36, 3, 8),
  a('Avery Zweckform', '3489', 70, 29.7, 3, 10),
  a('Avery Zweckform', '3481', 70, 41, 3, 7),
  a('Avery Zweckform', '3652', 70, 42.3, 3, 7),
  a('Avery Zweckform', '3669', 70, 50.8, 3, 5),
  a('Avery Zweckform', '3484', 105, 37, 2, 8),
  a('Avery Zweckform', '3653', 105, 42.3, 2, 7),
  a('Avery Zweckform', '3424', 105, 48, 2, 6),
  a('Avery Zweckform', '3425', 105, 57, 2, 5),
  a('Avery Zweckform', '3427', 105, 74, 2, 4),
  a('Avery Zweckform', '3483', 105, 148, 2, 2),
  a('Avery Zweckform', '3651', 52.5, 29.7, 4, 10),
  a('Avery Zweckform', '3657', 48.5, 25.4, 4, 10),
  a('Avery Zweckform', '3667', 48.5, 16.9, 4, 16),
  a('Avery Zweckform', '3666', 38, 21.2, 5, 13),
  a('Avery Zweckform', '3655', 210, 148, 1, 2),
  a('Avery Zweckform', '3478', 210, 297, 1, 1, 0, 0, 'celý arch A4'),
  a('Avery', 'L7160 / J8160', 63.5, 38.1, 3, 7, 2.54),
  a('Avery', 'L7159 / J8159', 63.5, 33.9, 3, 8, 2.54),
  a('Avery', 'L7161 / J8161', 63.5, 46.6, 3, 6, 2.54),
  a('Avery', 'L7164', 63.5, 72, 3, 4, 2.54),
  a('Avery', 'L7163 / J8163', 99.1, 38.1, 2, 7, 2.5),
  a('Avery', 'L7162 / J8162', 99.1, 33.9, 2, 8, 2.5),
  a('Avery', 'L7173 / J8173', 99.1, 57, 2, 5, 2.5),
  a('Avery', 'L7165 / J8165', 99.1, 67.7, 2, 4, 2.5),
  a('Avery', 'L7651 / J8651', 38.1, 21.2, 5, 13, 2.5),
  a('Avery', 'L7654', 45.7, 21.2, 4, 12, 2.6),
].map(dopocitejOkraje);

function zaokr(x, d = 2) { return Math.round(x * 10 ** d) / 10 ** d; }
function papirArchu(ar) { return ar.papir === 'vlastni' ? { nazev: 'vlastní', w: +ar.papirW, h: +ar.papirH } : (PAPIRY[ar.papir] || PAPIRY.a4); }

// Doplní chybějící okraje tak, aby mřížka stála uprostřed papíru.
function dopocitejOkraje(ar) {
  const p = papirArchu(ar), o = { ...ar };
  if (o.okL == null || o.okL === '') o.okL = zaokr((p.w - o.sl * o.w - (o.sl - 1) * o.mezX) / 2);
  if (o.okH == null || o.okH === '') o.okH = zaokr((p.h - o.ra * o.h - (o.ra - 1) * o.mezY) / 2);
  return o;
}

function nazevArchu(ar) {
  const f = x => String(x).replace('.', ',');
  return `${f(ar.w)} × ${f(ar.h)} mm · ${ar.sl}×${ar.ra} (${ar.sl * ar.ra} ks)` + (ar.kody ? ` · ${ar.vyrobce} ${ar.kody}` : '');
}

const naArch = ar => ar.sl * ar.ra;

// Poloha štítku (index 0…n-1 po řádcích) na archu v mm od levého horního rohu papíru.
function poziceStitku(ar, i) {
  const s = i % ar.sl, r = Math.floor(i / ar.sl);
  return { x: ar.okL + s * (ar.w + ar.mezX), y: ar.okH + r * (ar.h + ar.mezY), w: ar.w, h: ar.h, sloupec: s, radek: r };
}

// Kontrola rozměrů: vrací { chyby: [], varovani: [] }.
function zkontrolujArch(ar) {
  const chyby = [], varovani = [], p = papirArchu(ar);
  const cisla = { w: 'šířka štítku', h: 'výška štítku', okL: 'levý okraj', okH: 'horní okraj', mezX: 'mezera mezi sloupci', mezY: 'mezera mezi řádky' };
  for (const [k, n] of Object.entries(cisla)) if (!isFinite(+ar[k])) chyby.push(`Chybí ${n}.`);
  if (!(p.w > 0 && p.h > 0)) chyby.push('Neplatný rozměr papíru.');
  if (!(ar.w > 0 && ar.h > 0)) chyby.push('Štítek musí mít kladné rozměry.');
  if (!(Number.isInteger(+ar.sl) && ar.sl >= 1 && Number.isInteger(+ar.ra) && ar.ra >= 1)) chyby.push('Počet sloupců a řádků musí být celé číslo od 1.');
  if (chyby.length) return { chyby, varovani };
  if (ar.mezX < 0 || ar.mezY < 0) chyby.push('Mezery nesmí být záporné.');
  if (ar.okL < -0.05 || ar.okH < -0.05) chyby.push('Okraje nesmí být záporné.');
  const prave = ar.okL + ar.sl * ar.w + (ar.sl - 1) * ar.mezX, dolni = ar.okH + ar.ra * ar.h + (ar.ra - 1) * ar.mezY;
  if (prave > p.w + 0.05) chyby.push(`Štítky přesahují papír vpravo o ${zaokr(prave - p.w)} mm.`);
  if (dolni > p.h + 0.05) chyby.push(`Štítky přesahují papír dole o ${zaokr(dolni - p.h)} mm.`);
  if (!chyby.length && (ar.okL < 3 || ar.okH < 3 || p.w - prave < 3 || p.h - dolni < 3))
    varovani.push('Štítky sahají blíž než 3 mm k okraji papíru – většina tiskáren tam netiskne, nechte v návrhu vnitřní odsazení.');
  return { chyby, varovani };
}

// Archy se shodným rozměrem štítku (tolerance v mm), nejlepší shoda první.
function najdiArch(w, h, tol = 0.6) {
  return ARCHY.map(ar => ({ ar, d: Math.abs(ar.w - w) + Math.abs(ar.h - h) }))
    .filter(x => Math.abs(x.ar.w - w) <= tol && Math.abs(x.ar.h - h) <= tol)
    .sort((x, y) => x.d - y.d).map(x => x.ar);
}

/* ---------- rozdělení záznamů na archy ----------
   pocet záznamů, kopie každého, start = pořadí prvního volného štítku na
   prvním archu (1 = celý arch). Vrací pole archů, každý pole { slot, zaznam, kopie }. */
function rozdelNaArchy(pocet, kopie, start, naArchu, vyber) {
  kopie = Math.max(1, Math.floor(kopie) || 1);
  start = Math.min(Math.max(1, Math.floor(start) || 1), naArchu);
  const poradi = vyber || Array.from({ length: pocet }, (_, i) => i);
  const archy = [];
  let slot = start - 1, arch = [];
  for (const z of poradi) for (let k = 0; k < kopie; k++) {
    if (slot >= naArchu) { archy.push(arch); arch = []; slot = 0; }
    arch.push({ slot, zaznam: z, kopie: k });
    slot++;
  }
  if (arch.length) archy.push(arch);
  return archy;
}

// „1-5, 8, 12-“ → seznam indexů 0…n-1 (prázdné = vše). Neplatné části vrací v chyby.
function vyberZaznamu(text, n) {
  const t = String(text || '').trim();
  if (!t) return { indexy: null, chyby: [] };
  const mn = new Set(), chyby = [];
  for (const cast of t.split(/[,;\s]+/).filter(Boolean)) {
    const m = cast.match(/^(\d*)\s*[-–]\s*(\d*)$/) || cast.match(/^(\d+)()$/);
    if (!m) { chyby.push(cast); continue; }
    let od = m[1] === '' ? 1 : +m[1], doo = cast.includes('-') || cast.includes('–') ? (m[2] === '' ? n : +m[2]) : od;
    if (od > doo) [od, doo] = [doo, od];
    for (let i = Math.max(1, od); i <= Math.min(n, doo); i++) mn.add(i - 1);
  }
  return { indexy: [...mn].sort((x, y) => x - y), chyby };
}

/* ---------- CSV / TSV ---------- */
function detekujOddelovac(text) {
  const radky = String(text).replace(/^﻿/, '').split(/\r?\n/).filter(r => r.trim()).slice(0, 20);
  let nej = ',', skore = -1;
  for (const o of ['\t', ';', ',', '|']) {
    const pocty = radky.map(r => parseCSV(r, o)[0]?.length || 1);
    if (!pocty.length || pocty[0] < 2) continue;
    const shodnych = pocty.filter(p => p === pocty[0]).length;
    const s = shodnych * 100 + pocty[0];
    if (s > skore) { skore = s; nej = o; }
  }
  return nej;
}

// RFC 4180: uvozovky, zdvojené uvozovky, nové řádky v poli, CRLF, BOM.
function parseCSV(text, odd) {
  const s = String(text).replace(/^﻿/, '');
  if (odd == null) odd = detekujOddelovac(s);
  const radky = []; let radek = [], pole = '', uvoz = false, i = 0;
  while (i < s.length) {
    const c = s[i];
    if (uvoz) {
      if (c === '"') { if (s[i + 1] === '"') { pole += '"'; i += 2; continue; } uvoz = false; i++; continue; }
      pole += c; i++; continue;
    }
    if (c === '"' && pole === '') { uvoz = true; i++; continue; }
    if (c === odd) { radek.push(pole); pole = ''; i++; continue; }
    if (c === '\r' || c === '\n') {
      radek.push(pole); radky.push(radek); radek = []; pole = '';
      i += c === '\r' && s[i + 1] === '\n' ? 2 : 1; continue;
    }
    pole += c; i++;
  }
  if (pole !== '' || radek.length) { radek.push(pole); radky.push(radek); }
  return radky.filter(r => r.some(p => p.trim() !== ''));
}

function doCSV(radky, odd = ';') {
  const esc = v => { v = v == null ? '' : String(v); return /["\r\n]/.test(v) || v.includes(odd) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return radky.map(r => r.map(esc).join(odd)).join('\r\n');
}

// Je první řádek hlavička? Samé neprázdné, nečíselné a navzájem různé buňky.
function odhadniHlavicku(radky) {
  if (radky.length < 2) return false;
  const h = radky[0];
  if (h.some(c => !String(c).trim() || /^[\d\s.,+\-/:]+$/.test(c))) return false;
  return new Set(h.map(klic)).size === h.length;
}

// Sjednotí tabulku na obdélník a vytvoří hlavičku (sloupec1… když chybí).
function pripravTabulku(radky, sHlavickou) {
  const sirka = Math.max(1, ...radky.map(r => r.length));
  const dopln = r => Array.from({ length: sirka }, (_, i) => r[i] == null ? '' : String(r[i]));
  let hlavicka = sHlavickou && radky.length ? dopln(radky[0]).map((h, i) => h.trim() || 'sloupec' + (i + 1)) : Array.from({ length: sirka }, (_, i) => 'sloupec' + (i + 1));
  const data = (sHlavickou ? radky.slice(1) : radky).map(dopln);
  // duplicitní názvy odliš číslem
  const videno = {};
  hlavicka = hlavicka.map(h => { const k = klic(h); videno[k] = (videno[k] || 0) + 1; return videno[k] > 1 ? h + '_' + videno[k] : h; });
  return { hlavicka, radky: data };
}

/* ---------- pole {nazev} ---------- */
function klic(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, '_');
}
// Záznam jako mapa klíč → hodnota včetně vestavěných polí.
function zaznamMapa(hlavicka, radek, extra) {
  const m = {};
  hlavicka.forEach((h, i) => { m[klic(h)] = radek[i] == null ? '' : String(radek[i]); });
  return Object.assign(m, extra || {});
}
// Dosadí {pole}; neznámá pole vrátí v chybi (a nechá je v textu, ať je chyba vidět).
function dosad(sablona, mapa, chybi) {
  return String(sablona || '').replace(/\{([^{}\n]+)\}/g, (cele, jm) => {
    const k = klic(jm);
    if (Object.prototype.hasOwnProperty.call(mapa, k)) return mapa[k];
    if (chybi) chybi.add(jm.trim());
    return cele;
  });
}
function polaVSablone(text) { return [...String(text || '').matchAll(/\{([^{}\n]+)\}/g)].map(m => m[1].trim()); }

function datumCs(d) { return d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear(); }

/* ---------- číslování ---------- */
function cislovani(o) {
  const od = Number(o.od) || 0, krok = Number(o.krok) || 1, pocet = Math.min(Math.max(0, Math.floor(o.pocet) || 0), 100000);
  const nuly = Math.max(0, Math.min(30, Math.floor(o.nuly) || 0));
  const vys = [];
  for (let i = 0; i < pocet; i++) {
    const c = od + i * krok, neg = c < 0;
    let t = String(Math.abs(Math.round(c))).padStart(nuly, '0');
    vys.push((o.predpona || '') + (neg ? '-' : '') + t + (o.pripona || ''));
  }
  return vys;
}

/* ---------- čárové kódy (logika převzatá z obsah/barcode_gen.html) ---------- */
const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_R = EAN_L.map(s => s.replace(/./g, c => c === '0' ? '1' : '0'));
const EAN_G = EAN_R.map(s => s.split('').reverse().join(''));
const PARITA = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

function kontrolniEan(cislice) {
  let s = 0;
  for (let i = 0; i < cislice.length; i++) s += +cislice[cislice.length - 1 - i] * (i % 2 === 0 ? 3 : 1);
  return String((10 - s % 10) % 10);
}
function pripravEan(text, delka, nazev) {
  const t = String(text).replace(/[\s-]/g, '');
  if (!t) return { chyba: 'prázdný ' + nazev };
  if (!/^\d+$/.test(t)) return { chyba: nazev + ' smí obsahovat jen číslice' };
  if (t.length === delka - 1) return { cislo: t + kontrolniEan(t) };
  if (t.length === delka) {
    const k = kontrolniEan(t.slice(0, -1));
    return k === t[delka - 1] ? { cislo: t } : { chyba: `${nazev}: chybná kontrolní číslice (má být ${k})` };
  }
  return { chyba: `${nazev} potřebuje ${delka - 1} nebo ${delka} číslic` };
}
function ean13(text) {
  const p = pripravEan(text, 13, 'EAN-13');
  if (p.chyba) return p;
  const c = p.cislo, par = PARITA[+c[0]];
  let m = '101';
  for (let i = 1; i <= 6; i++) m += (par[i - 1] === 'L' ? EAN_L : EAN_G)[+c[i]];
  m += '01010';
  for (let i = 7; i <= 12; i++) m += EAN_R[+c[i]];
  m += '101';
  return { cislo: c, moduly: m, typ: 'ean13', text: [[c[0], -8, -1], [c.slice(1, 7), 3, 45], [c.slice(7), 50, 92]],
    ochranne: [0, 1, 2, 45, 46, 47, 48, 49, 92, 93, 94], tichaL: 11, tichaP: 7 };
}
function ean8(text) {
  const p = pripravEan(text, 8, 'EAN-8');
  if (p.chyba) return p;
  const c = p.cislo;
  let m = '101';
  for (let i = 0; i < 4; i++) m += EAN_L[+c[i]];
  m += '01010';
  for (let i = 4; i < 8; i++) m += EAN_R[+c[i]];
  m += '101';
  return { cislo: c, moduly: m, typ: 'ean8', text: [[c.slice(0, 4), 3, 31], [c.slice(4), 36, 64]],
    ochranne: [0, 1, 2, 31, 32, 33, 34, 35, 64, 65, 66], tichaL: 7, tichaP: 7 };
}

const C128 = ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 ' +
  '221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 ' +
  '221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 ' +
  '212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 ' +
  '231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 ' +
  '231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 ' +
  '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 ' +
  '112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 ' +
  '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 ' +
  '214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 ' +
  '114131 311141 411131 211412 211214 211232 2331112').split(' ');
const C128_START = { A: 103, B: 104, C: 105 };
const C128_PREPNI = { A: 101, B: 100, C: 99 };
function delkaCislic(s, i) { let n = 0; while (i + n < s.length && s.charCodeAt(i + n) >= 48 && s.charCodeAt(i + n) <= 57) n++; return n; }
const ridici = ch => ch.charCodeAt(0) < 32;
const male = ch => ch.charCodeAt(0) >= 96;

function code128(text) {
  const s = String(text);
  if (!s.length) return { chyba: 'prázdný Code 128' };
  for (const ch of s) {
    const k = ch.charCodeAt(0);
    if (k > 126) return { chyba: `Code 128 neumí znak „${ch}“ (jen ASCII bez diakritiky)` };
  }
  const hodnoty = [];
  let sada;
  const n0 = delkaCislic(s, 0);
  if (n0 >= 4 || (n0 === s.length && n0 % 2 === 0)) sada = 'C';
  else { sada = 'B'; for (const ch of s) { if (male(ch)) break; if (ridici(ch)) { sada = 'A'; break; } } }
  hodnoty.push(C128_START[sada]);
  let i = 0;
  while (i < s.length) {
    if (sada === 'C') {
      if (delkaCislic(s, i) >= 2) { hodnoty.push(+s.substr(i, 2)); i += 2; continue; }
      sada = ridici(s[i]) ? 'A' : 'B'; hodnoty.push(C128_PREPNI[sada]); continue;
    }
    const n = delkaCislic(s, i);
    if (n >= 6 || (n >= 4 && i + n === s.length)) {
      if (n % 2 === 1) { hodnoty.push(s.charCodeAt(i) - 32); i++; }
      sada = 'C'; hodnoty.push(C128_PREPNI.C); continue;
    }
    const ch = s[i], k = s.charCodeAt(i);
    if (sada === 'B' && ridici(ch)) { sada = 'A'; hodnoty.push(C128_PREPNI.A); continue; }
    if (sada === 'A' && male(ch)) { sada = 'B'; hodnoty.push(C128_PREPNI.B); continue; }
    hodnoty.push(sada === 'A' && k < 32 ? k + 64 : k - 32);
    i++;
  }
  let soucet = hodnoty[0];
  for (let j = 1; j < hodnoty.length; j++) soucet += hodnoty[j] * j;
  hodnoty.push(soucet % 103, 106);
  let m = '';
  for (const h of hodnoty) { const w = C128[h]; for (let j = 0; j < w.length; j++) m += (j % 2 === 0 ? '1' : '0').repeat(+w[j]); }
  return { cislo: s, moduly: m, typ: 'code128', hodnoty, text: [[s.replace(/[\x00-\x1f]/g, '·'), 0, m.length]], ochranne: [], tichaL: 10, tichaP: 10 };
}
const KODERY = { ean13, ean8, code128 };

/* ---------- rozvržení textu ----------
   mer(text, velikostMm, tucne) → šířka v mm. Písmo se zmenšuje po 0,25 pt,
   dokud se text nevejde do rámečku (s případným zalamováním po slovech). */
function zalom(odstavec, sirka, s, tucne, mer) {
  const slova = odstavec.split(/ +/);
  const radky = []; let r = '';
  for (const sl of slova) {
    const zkus = r ? r + ' ' + sl : sl;
    if (!r || mer(zkus, s, tucne) <= sirka) r = zkus;
    else { radky.push(r); r = sl; }
  }
  radky.push(r);
  return radky;
}
function rozvrhniText(text, boxW, boxH, o, mer) {
  const odstavce = String(text).split('\n');
  const max = Math.max(1, +o.velikost || 10), min = Math.min(max, Math.max(1, +o.min || 4)), rad = +o.radkovani || 1.15;
  const tucnyOdst = i => !!o.tucne || (!!o.prvniTucne && i === 0);
  const sestav = pt => {
    const s = pt * PT, radky = [];
    odstavce.forEach((od, i) => {
      const t = tucnyOdst(i);
      (o.zalamovat ? zalom(od, boxW, s, t, mer) : [od]).forEach(r => radky.push({ text: r, tucne: t, sirka: mer(r, s, t) }));
    });
    const vyska = (radky.length - 1) * s * rad + (ASC + DESC) * s;
    const ok = vyska <= boxH + 1e-6 && radky.every(r => r.sirka <= boxW + 1e-6);
    return { pt, s, radky, vyska, ok };
  };
  let v;
  for (let pt = max; pt >= min - 1e-9; pt -= 0.25) { v = sestav(pt); if (v.ok) return { ...v, preteka: false }; }
  v = sestav(min);
  // nevejde se ani nejmenší písmo: uřízni řádky a příliš dlouhé zkrať trojtečkou
  const maxRad = Math.max(1, Math.floor((boxH - (ASC + DESC) * v.s) / (v.s * rad) + 1e-6) + 1);
  if (v.radky.length > maxRad) { v.radky = v.radky.slice(0, maxRad); v.radky[maxRad - 1].text += '…'; }
  for (const r of v.radky) {
    if (mer(r.text, v.s, r.tucne) <= boxW) { r.sirka = mer(r.text, v.s, r.tucne); continue; }
    let t = r.text.replace(/…$/, '');
    while (t.length > 1 && mer(t + '…', v.s, r.tucne) > boxW) t = t.slice(0, -1);
    r.text = t + '…'; r.sirka = mer(r.text, v.s, r.tucne);
  }
  v.vyska = (v.radky.length - 1) * v.s * rad + (ASC + DESC) * v.s;
  return { ...v, preteka: true };
}

/* ---------- štítek → primitiva ----------
   navrh = { odsazeni (mm), ramecek: {tl, zaobleni, barva}, prvky: [...] }
   prvek: x, y, w, h v % vnitřní plochy (po odsazení), typ text|qr|kod|obr.
   nastroje = { mer, qr(text, ec) → { n, tmavy(r, c) } | null }
   Vrací { prim: [...], varovani: [...] }; souřadnice v mm od rohu štítku. */
function sestavStitek(navrh, mapa, w, h, nastroje) {
  const prim = [], varovani = [], chybi = new Set();
  const od = Math.max(0, +navrh.odsazeni || 0), iw = Math.max(0.1, w - 2 * od), ih = Math.max(0.1, h - 2 * od);
  const ram = navrh.ramecek || {};
  const ro = Math.max(0, +ram.odsazeni || 0);
  if (ram.tl > 0) prim.push({ t: 'ram', x: ro + ram.tl / 2, y: ro + ram.tl / 2, w: w - 2 * ro - ram.tl, h: h - 2 * ro - ram.tl, r: Math.max(0, +ram.zaobleni || 0), tl: +ram.tl, barva: ram.barva || '#000000' });
  for (const p of navrh.prvky || []) {
    if (p.skryty) continue;
    const bx = od + iw * p.x / 100, by = od + ih * p.y / 100, bw = iw * p.w / 100, bh = ih * p.h / 100;
    if (!(bw > 0 && bh > 0)) continue;
    const barva = p.barva || '#000000';
    if (p.typ === 'text') {
      const t = dosad(p.text, mapa, chybi);
      if (!t.trim()) continue;
      const v = rozvrhniText(t, bw, bh, p, nastroje.mer);
      if (v.preteka) varovani.push('text se nevejde');
      const lh = v.s * (+p.radkovani || 1.15);
      const sv = p.svisle || 'M';
      const y0 = sv === 'T' ? by : sv === 'B' ? by + bh - v.vyska : by + (bh - v.vyska) / 2;
      const zar = p.zar === 'C' ? 'middle' : p.zar === 'R' ? 'end' : 'start';
      const x = zar === 'middle' ? bx + bw / 2 : zar === 'end' ? bx + bw : bx;
      v.radky.forEach((r, i) => { if (r.text) prim.push({ t: 'text', x, y: y0 + i * lh + ASC * v.s, s: v.s, text: r.text, zar, tucne: r.tucne, barva }); });
    } else if (p.typ === 'kod') {
      const obsah = dosad(p.text, mapa, chybi).trim();
      const k = (KODERY[p.format] || code128)(obsah);
      if (k.chyba) { varovani.push(k.chyba); prim.push(...chybovyRamecek(bx, by, bw, bh, k.chyba, nastroje.mer)); continue; }
      prim.push(...kodPrimitiva(k, bx, by, bw, bh, p.cisla !== false, barva, nastroje.mer));
    } else if (p.typ === 'qr') {
      const obsah = dosad(p.text, mapa, chybi);
      if (!obsah) continue;
      const q = nastroje.qr && nastroje.qr(obsah, p.ec || 'M');
      if (!q) { varovani.push('QR: text je příliš dlouhý'); prim.push(...chybovyRamecek(bx, by, bw, bh, 'QR nelze', nastroje.mer)); continue; }
      const tiche = p.tiche == null ? 1 : +p.tiche, n = q.n + 2 * tiche;
      const strana = Math.min(bw, bh), m = strana / n;
      const qx = p.zar === 'L' ? bx : p.zar === 'R' ? bx + bw - strana : bx + (bw - strana) / 2;
      const qy = by + (bh - strana) / 2;
      const obd = [];
      for (let r = 0; r < q.n; r++) for (let c = 0; c < q.n;) {
        if (!q.tmavy(r, c)) { c++; continue; }
        let e = c; while (e < q.n && q.tmavy(r, e)) e++;
        obd.push([qx + (c + tiche) * m, qy + (r + tiche) * m, (e - c) * m, m]);
        c = e;
      }
      prim.push({ t: 'obd', obd, barva });
      if (m < 0.25) varovani.push('QR je hustý (modul pod 0,25 mm) – nemusí jít přečíst');
    } else if (p.typ === 'obr') {
      if (!p.data || !(p.pw > 0 && p.ph > 0)) continue;
      const k = Math.min(bw / p.pw, bh / p.ph), ow = p.pw * k, oh = p.ph * k;
      const ox = p.zar === 'L' ? bx : p.zar === 'R' ? bx + bw - ow : bx + (bw - ow) / 2;
      prim.push({ t: 'obr', x: ox, y: by + (bh - oh) / 2, w: ow, h: oh, data: p.data });
    }
  }
  if (chybi.size) varovani.push('neznámé pole: ' + [...chybi].map(x => '{' + x + '}').join(', '));
  return { prim, varovani };
}

function chybovyRamecek(x, y, w, h, text, mer) {
  const s = Math.min(h * 0.4, 2.2);
  let t = '⚠ ' + text;
  while (t.length > 3 && mer(t, s, false) > w) t = t.slice(0, -2) + '…';
  return [{ t: 'ram', x, y, w, h, r: 0, tl: 0.2, barva: '#c62828', carkovane: true },
    { t: 'text', x: x + w / 2, y: y + h / 2 + s * 0.35, s, text: t, zar: 'middle', tucne: false, barva: '#c62828' }];
}

// Čárový kód vyplní rámeček na šířku (včetně tichých zón), čísla pod ním.
function kodPrimitiva(k, x, y, w, h, cisla, barva, mer) {
  const nMod = k.tichaL + k.moduly.length + k.tichaP;
  const mw = w / nMod, ean = k.typ !== 'code128';
  let s = 0;
  if (cisla) {
    s = ean ? Math.min(mw * 8, h * 0.28) : Math.min(h * 0.24, mw * 9);
    if (!ean) { // Code128: text se musí vejít na šířku kódu
      const sir = mer(k.text[0][0], s, false);
      if (sir > w * 0.98) s *= w * 0.98 / sir;
    }
  }
  const ochr = new Set(k.ochranne);
  const vyskaCar = cisla ? (ean ? h - s * 0.6 : h - s * 1.15) : h;
  const obd = [];
  for (let i = 0; i < k.moduly.length;) {
    if (k.moduly[i] !== '1') { i++; continue; }
    let j = i; while (j < k.moduly.length && k.moduly[j] === '1' && ochr.has(j) === ochr.has(i)) j++;
    const vc = cisla && ean && !ochr.has(i) ? vyskaCar - s * 0.55 : vyskaCar;
    obd.push([x + (k.tichaL + i) * mw, y, (j - i) * mw, vc]);
    i = j;
  }
  const prim = [{ t: 'obd', obd, barva }];
  if (cisla) for (const [txt, od, doo] of k.text) {
    const cx = x + (k.tichaL + (od + doo) / 2) * mw;
    prim.push({ t: 'text', x: cx, y: ean ? y + h - s * 0.12 : y + h - s * 0.2, s, text: txt, zar: 'middle', tucne: false, barva, mono: ean });
  }
  return prim;
}

/* ---------- předlohy ---------- */
const PREDLOHY = {
  adresa: {
    nazev: '✉️ Adresní štítek', arch: 'z3474',
    navrh: { odsazeni: 4, ramecek: { tl: 0 }, prvky: [
      { typ: 'text', x: 0, y: 0, w: 100, h: 100, text: '{jmeno}\n{ulice}\n{psc} {mesto}', velikost: 11, min: 6, zar: 'L', svisle: 'M', prvniTucne: true, radkovani: 1.2 },
    ] },
    data: { rezim: 'tabulka', hlavicka: ['jmeno', 'ulice', 'psc', 'mesto'], radky: [
      ['Jana Nováková', 'Lipová 12', '602 00', 'Brno'],
      ['Ing. Petr Svoboda', 'Náměstí Míru 1574/8', '120 00', 'Praha 2'],
      ['Restaurace U Zlatého kohouta s. r. o.', 'Dlouhá 45', '370 01', 'České Budějovice'],
      ['Marie Dvořáková', 'Školní 3', '779 00', 'Olomouc'],
      ['Tomáš Černý', 'K Rybníku 211', '530 02', 'Pardubice'],
    ] },
  },
  cenovka: {
    nazev: '🏷️ Cenovka s EAN', arch: 'z3651',
    navrh: { odsazeni: 1.5, ramecek: { tl: 0 }, prvky: [
      { typ: 'text', x: 0, y: 0, w: 100, h: 30, text: '{nazev}', velikost: 9, min: 5, zar: 'L', svisle: 'T', tucne: true, zalamovat: true, radkovani: 1.05 },
      { typ: 'text', x: 52, y: 32, w: 48, h: 30, text: '{cena} Kč', velikost: 16, min: 7, zar: 'R', svisle: 'M', tucne: true },
      { typ: 'text', x: 0, y: 34, w: 50, h: 26, text: '{jednotka}', velikost: 6, min: 4, zar: 'L', svisle: 'M' },
      { typ: 'kod', x: 0, y: 64, w: 100, h: 36, format: 'ean13', text: '{ean}', cisla: true },
    ] },
    data: { rezim: 'tabulka', hlavicka: ['nazev', 'cena', 'jednotka', 'ean'], radky: [
      ['Med květový 500 g', '189', '378 Kč / kg', '859123456789'],
      ['Jablečný mošt 1 l', '59', '59 Kč / l', '8591234567893'],
      ['Sýr eidam 30 % 250 g', '74,90', '299,60 Kč / kg', '859400000001'],
      ['Chléb kváskový 1 kg', '79', '79 Kč / kg', '859400000002'],
    ] },
  },
  jmenovka: {
    nazev: '🪪 Jmenovka', arch: 'z3425',
    navrh: { odsazeni: 5, ramecek: { tl: 0.6, zaobleni: 3, barva: '#2862bb' }, prvky: [
      { typ: 'text', x: 0, y: 8, w: 100, h: 50, text: '{jmeno}', velikost: 26, min: 10, zar: 'C', svisle: 'M', tucne: true },
      { typ: 'text', x: 0, y: 60, w: 100, h: 18, text: '{funkce}', velikost: 13, min: 7, zar: 'C', svisle: 'M' },
      { typ: 'text', x: 0, y: 80, w: 100, h: 20, text: '{firma}', velikost: 10, min: 6, zar: 'C', svisle: 'M', barva: '#2862bb' },
    ] },
    data: { rezim: 'tabulka', hlavicka: ['jmeno', 'funkce', 'firma'], radky: [
      ['Kateřina Horáková', 'přednášející', 'Konference Sdílíme znalosti 2026'],
      ['Jiří Procházka', 'organizátor', 'Konference Sdílíme znalosti 2026'],
      ['Alžběta Kučerová', 'host', 'Konference Sdílíme znalosti 2026'],
      ['Václav Veselý', 'účastník', 'Konference Sdílíme znalosti 2026'],
    ] },
  },
  inventar: {
    nazev: '📦 Inventární štítek s QR', arch: 'z3657',
    navrh: { odsazeni: 1.5, ramecek: { tl: 0 }, prvky: [
      { typ: 'qr', x: 0, y: 0, w: 40, h: 100, text: '{cislo}', ec: 'M', zar: 'L', tiche: 1 },
      { typ: 'text', x: 42, y: 0, w: 58, h: 30, text: 'MAJETEK FIRMY', velikost: 6, min: 4, zar: 'L', svisle: 'T' },
      { typ: 'text', x: 42, y: 30, w: 58, h: 40, text: '{cislo}', velikost: 11, min: 5, zar: 'L', svisle: 'M', tucne: true },
      { typ: 'text', x: 42, y: 72, w: 58, h: 28, text: 'Neodstraňovat', velikost: 5.5, min: 4, zar: 'L', svisle: 'B' },
    ] },
    data: { rezim: 'cislovani', hlavicka: ['popis'], radky: [['']], cislovani: { od: 1, krok: 1, pocet: 40, nuly: 5, predpona: 'INV-', pripona: '' } },
  },
  zavarenina: {
    nazev: '🫙 Štítek na zavařeninu', arch: 'L7160',
    navrh: { odsazeni: 3, ramecek: { tl: 0.5, zaobleni: 4, barva: '#8a3b12', odsazeni: 1.5 }, prvky: [
      { typ: 'text', x: 0, y: 4, w: 100, h: 52, text: '{nazev}', velikost: 18, min: 8, zar: 'C', svisle: 'M', tucne: true, zalamovat: true, radkovani: 1.05, barva: '#8a3b12' },
      { typ: 'text', x: 0, y: 58, w: 100, h: 18, text: '{pozn}', velikost: 9, min: 5, zar: 'C', svisle: 'M' },
      { typ: 'text', x: 0, y: 78, w: 100, h: 18, text: 'zavařeno {datum}', velikost: 8, min: 5, zar: 'C', svisle: 'M', barva: '#555555' },
    ] },
    data: { rezim: 'tabulka', kopie: 3, hlavicka: ['nazev', 'pozn'], radky: [
      ['Jahodová marmeláda', 'bez pektinu'],
      ['Meruňkový džem', 'z vlastní zahrady'],
      ['Pikantní čatní z rajčat', 'chilli ★★☆'],
    ] },
  },
};

const api = { PT, ASC, DESC, PAPIRY, ARCHY, ZDROJ_ARCHU, PREDLOHY, papirArchu, dopocitejOkraje, nazevArchu, naArch, poziceStitku,
  zkontrolujArch, najdiArch, rozdelNaArchy, vyberZaznamu, detekujOddelovac, parseCSV, doCSV, odhadniHlavicku, pripravTabulku,
  klic, zaznamMapa, dosad, polaVSablone, datumCs, cislovani, kontrolniEan, ean13, ean8, code128, rozvrhniText, sestavStitek };
if (typeof module === 'object' && module.exports) module.exports = api;
koren.STITKY = api;
})(typeof window !== 'undefined' ? window : globalThis);

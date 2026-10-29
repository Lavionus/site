/* ============================================================
   obrazky_davka/jadro.js – Hromadné úpravy obrázků, výpočty bez DOM.

   Rozměry kroků (zmenšení, ořez, otočení, okraj), šablona nových jmen,
   čtení hlaviček a EXIF (JPEG, PNG, WebP, GIF, BMP), úpravy pixelů,
   binární hledání kvality pro cílovou velikost a ZIP (metoda „uloženo“).
   V prohlížeči i ve workeru jako self.OBRAZKY_DAVKA, v node module.exports.
   ============================================================ */
(function (koren) {
'use strict';

/* ---------- kroky řetězu ---------- */
const TYPY_KROKU = {
  otoc:     { ikona: '🔄', nazev: 'Otočení / zrcadlení' },
  orez:     { ikona: '✂️', nazev: 'Ořez na poměr stran' },
  zmensi:   { ikona: '📐', nazev: 'Změna velikosti' },
  upravy:   { ikona: '🎚️', nazev: 'Jas / kontrast / sytost' },
  seda:     { ikona: '⚫', nazev: 'Stupně šedi' },
  okraj:    { ikona: '🖼️', nazev: 'Okraj / rámeček' },
  vodoznak: { ikona: '💧', nazev: 'Vodoznak' },
};

function vychoziKrok(typ) {
  const k = { otoc:     { uhel: 90, zrcadlo: 'ne' },
              orez:     { pomer: '1:1', podleOrientace: true },
              zmensi:   { rezim: 'dlouha', hodnota: 1920, hodnota2: 1080, jenZmensovat: true },
              upravy:   { jas: 0, kontrast: 0, sytost: 0 },
              seda:     {},
              okraj:    { sirka: 2, jednotka: 'procenta', barva: '#ffffff' },
              vodoznak: { druh: 'text', text: '© ' + new Date().getFullYear(), velikost: 4, barva: '#ffffff',
                          stin: true, pozice: 8, pruhlednost: 60, odsazeni: 2, sirkaObr: 20 } }[typ];
  if (!k) throw new Error('Neznámý krok: ' + typ);
  return Object.assign({ typ, zap: true }, k);
}

const VYCHOZI_VYSTUP = { format: 'jpeg', kvalita: 85, cilKB: 0, pozadi: '#ffffff' };
const VYCHOZI_JMENA = { vzor: '{nazev}.{ext}', start: 1, podslozky: true };

/** Doplní chybějící hodnoty a zahodí neznámé kroky (načtená předvolba může být stará nebo ručně upravená). */
function normalizujNastaveni(n) {
  n = n || {};
  const kroky = (Array.isArray(n.kroky) ? n.kroky : [])
    .filter(k => k && TYPY_KROKU[k.typ])
    .map(k => Object.assign(vychoziKrok(k.typ), k));
  return {
    kroky,
    vystup: Object.assign({}, VYCHOZI_VYSTUP, n.vystup),
    jmena: Object.assign({}, VYCHOZI_JMENA, n.jmena),
  };
}

const VESTAVENE_PREDVOLBY = [
  { nazev: 'Web – delší strana 1920, WebP', kroky: [{ typ: 'zmensi', rezim: 'dlouha', hodnota: 1920 }],
    vystup: { format: 'webp', kvalita: 82 } },
  { nazev: 'E-mail – 1600 px, JPEG do 400 kB', kroky: [{ typ: 'zmensi', rezim: 'dlouha', hodnota: 1600 }],
    vystup: { format: 'jpeg', kvalita: 85, cilKB: 400 } },
  { nazev: 'Sociální sítě – čtverec 1080', kroky: [{ typ: 'orez', pomer: '1:1' }, { typ: 'zmensi', rezim: 'sirka', hodnota: 1080 }],
    vystup: { format: 'jpeg', kvalita: 88 } },
  { nazev: 'Náhledy – 400 px s rámečkem', kroky: [{ typ: 'zmensi', rezim: 'dlouha', hodnota: 400 }, { typ: 'okraj', sirka: 8, jednotka: 'px', barva: '#ffffff' }],
    vystup: { format: 'jpeg', kvalita: 80 }, jmena: { vzor: 'nahled_{n:3}.{ext}' } },
  { nazev: 'Fotky s vodoznakem – 2048 px', kroky: [{ typ: 'zmensi', rezim: 'dlouha', hodnota: 2048 }, { typ: 'vodoznak' }],
    vystup: { format: 'jpeg', kvalita: 86 }, jmena: { vzor: '{datum:YYYY-MM-DD}_{n:3}.{ext}' } },
];

/* ---------- geometrie ---------- */
function cilovyRozmer(w, h, n) {
  const v = Number(n.hodnota), v2 = Number(n.hodnota2);
  let k;
  switch (n.rezim) {
    case 'sirka': k = v / w; break;
    case 'vyska': k = v / h; break;
    case 'procenta': k = v / 100; break;
    case 'ramec': k = Math.min(v / w, v2 / h); break;   // vejít se do rámečku š × v
    default: k = v / Math.max(w, h);                     // delší strana
  }
  if (!(k > 0) || !isFinite(k)) k = 1;
  if (n.jenZmensovat && k > 1) k = 1;
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** „16:9“, „4:3“, „1.5“ → číslo (šířka / výška), nebo null. */
function parsujPomer(t) {
  const m = String(t || '').trim().replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(?:[:x×/]\s*(\d+(?:\.\d+)?))?$/);
  if (!m) return null;
  const r = m[2] === undefined ? Number(m[1]) : Number(m[1]) / Number(m[2]);
  return r > 0 && isFinite(r) ? r : null;
}

/** Výřez ze středu na poměr; podleOrientace = u obrázku na výšku poměr prohodí (3:2 → 2:3). */
function orezStred(w, h, pomer, podleOrientace) {
  let r = parsujPomer(pomer);
  if (!r) return { x: 0, y: 0, w, h };
  if (podleOrientace && h > w && r > 1) r = 1 / r;
  if (podleOrientace && w > h && r < 1) r = 1 / r;
  if (w / h > r) {
    const nw = Math.max(1, Math.round(h * r));
    return { x: Math.floor((w - nw) / 2), y: 0, w: nw, h };
  }
  const nh = Math.max(1, Math.round(w / r));
  return { x: 0, y: Math.floor((h - nh) / 2), w, h: nh };
}

function sirkaOkraje(w, h, k) {
  const s = Number(k.sirka) || 0;
  return Math.max(0, Math.round(k.jednotka === 'procenta' ? Math.min(w, h) * s / 100 : s));
}

/** Rozměr po jednom kroku (bez kreslení) – pro náhled jmen se {sirka}x{vyska} a pro kreslení samotné. */
function rozmerPoKroku(w, h, k) {
  if (!k.zap) return { w, h };
  switch (k.typ) {
    case 'otoc': return (Number(k.uhel) % 180) ? { w: h, h: w } : { w, h };
    case 'orez': { const o = orezStred(w, h, k.pomer, k.podleOrientace); return { w: o.w, h: o.h }; }
    case 'zmensi': return cilovyRozmer(w, h, k);
    case 'okraj': { const b = sirkaOkraje(w, h, k); return { w: w + 2 * b, h: h + 2 * b }; }
    default: return { w, h };
  }
}

function vyslednyRozmer(w, h, kroky) {
  let r = { w, h };
  for (const k of kroky || []) r = rozmerPoKroku(r.w, r.h, k);
  return r;
}

/** Levý horní roh vodoznaku w×h v obrázku W×H; pozice 0–8 = mřížka 3×3 po řádcích. */
function poziceVodoznaku(W, H, w, h, pozice, odsazeni) {
  const sl = pozice % 3, ra = Math.floor(pozice / 3);
  const x = sl === 0 ? odsazeni : sl === 1 ? (W - w) / 2 : W - w - odsazeni;
  const y = ra === 0 ? odsazeni : ra === 1 ? (H - h) / 2 : H - h - odsazeni;
  return { x: Math.round(x), y: Math.round(y) };
}

/* ---------- pixely ---------- */
/** Jas, kontrast, sytost (−100…100) a stupně šedi přímo v poli RGBA. */
function upravPixely(data, n) {
  const jas = (Number(n.jas) || 0) * 2.55;
  const c = Math.max(-254, Math.min(254, (Number(n.kontrast) || 0) * 2.55));
  const f = (259 * (c + 255)) / (255 * (259 - c));
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) lut[i] = f * (i + jas - 128) + 128;
  const s = n.seda ? 0 : 1 + (Number(n.sytost) || 0) / 100;
  for (let i = 0; i < data.length; i += 4) {
    let r = lut[data[i]], g = lut[data[i + 1]], b = lut[data[i + 2]];
    if (s !== 1) {
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = y + (r - y) * s; g = y + (g - y) * s; b = y + (b - y) * s;
    }
    data[i] = r; data[i + 1] = g; data[i + 2] = b;   // Uint8ClampedArray ořízne a zaokrouhlí
  }
  return data;
}

/* ---------- formáty ---------- */
const FORMATY = {
  jpeg: { mime: 'image/jpeg', pripona: 'jpg', kvalita: true },
  png:  { mime: 'image/png',  pripona: 'png', kvalita: false },
  webp: { mime: 'image/webp', pripona: 'webp', kvalita: true },
  avif: { mime: 'image/avif', pripona: 'avif', kvalita: true },
};
/** „puvodni“ zachová JPEG/PNG/WebP/AVIF, ostatní (GIF, BMP…) → PNG. */
function vystupniFormat(format, typVstupu) {
  if (format !== 'puvodni') return FORMATY[format] ? format : 'jpeg';
  return FORMATY[typVstupu] ? typVstupu : 'png';
}

/* ---------- čtení hlaviček a EXIF ---------- */
const OBRAZKOVE_PRIPONY = /\.(jpe?g|jfif|png|webp|gif|bmp|avif|heic|heif|tiff?|ico|svg)$/i;
function jeObrazek(jmeno, mime) {
  return /^image\//.test(mime || '') || OBRAZKOVE_PRIPONY.test(jmeno || '');
}

function ascii(u8, od, delka) {
  let s = '';
  for (let i = od; i < od + delka && i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return s;
}

/** TIFF/EXIF blok (začíná „II*\0“ nebo „MM\0*“) → { orientace, datum, model, gps }. */
function parsujTiff(u8, start, vysl) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const le = ascii(u8, start, 2) === 'II';
  if (!le && ascii(u8, start, 2) !== 'MM') return;
  const u16 = o => dv.getUint16(start + o, le), u32 = o => dv.getUint32(start + o, le);
  const textTagu = (typ, pocet, hodnotaOff) => {
    if (typ !== 2) return null;
    const o = pocet <= 4 ? hodnotaOff : u32(hodnotaOff);
    return ascii(u8, start + o, pocet).replace(/\0[\s\S]*$/, '').trim();
  };
  const ctiIfd = (off, fn) => {
    if (!off || start + off + 2 > u8.length) return;
    const n = u16(off);
    for (let i = 0; i < n; i++) {
      const e = off + 2 + i * 12;
      if (start + e + 12 > u8.length) break;
      fn(u16(e), u16(e + 2), u32(e + 4), e + 8);
    }
  };
  let exifIfd = 0, gpsIfd = 0;
  ctiIfd(u32(4), (tag, typ, pocet, hOff) => {
    if (tag === 0x0112) vysl.orientace = u16(hOff);
    else if (tag === 0x0132 && !vysl.datum) vysl.datum = textTagu(typ, pocet, hOff);
    else if (tag === 0x0110) vysl.model = textTagu(typ, pocet, hOff);
    else if (tag === 0x8769) exifIfd = u32(hOff);
    else if (tag === 0x8825) gpsIfd = u32(hOff);
  });
  ctiIfd(exifIfd, (tag, typ, pocet, hOff) => {
    if (tag === 0x9003) vysl.datum = textTagu(typ, pocet, hOff) || vysl.datum;   // DateTimeOriginal má přednost
  });
  ctiIfd(gpsIfd, tag => { if (tag === 2 || tag === 4) vysl.gps = true; });       // zeměpisná šířka / délka
  vysl.exif = true;
}

/**
 * Přečte typ, rozměry v souboru (před otočením podle EXIF) a metadata.
 * Stačí začátek souboru (u JPEG obvykle prvních pár set kB).
 * → { typ, sirka, vyska, orientace, datum, model, gps, exif }
 */
function ctiMetadata(vstup) {
  const u8 = vstup instanceof Uint8Array ? vstup : new Uint8Array(vstup);
  const v = { typ: null, sirka: 0, vyska: 0, orientace: 1, datum: null, model: null, gps: false, exif: false };
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  try {
    if (u8[0] === 0xFF && u8[1] === 0xD8) {
      v.typ = 'jpeg';
      let o = 2;
      while (o + 4 <= u8.length) {
        if (u8[o] !== 0xFF) { o++; continue; }
        const m = u8[o + 1];
        if (m === 0xFF) { o++; continue; }                     // výplňový bajt
        if (m === 0xD9 || m === 0xDA) break;                   // konec / začátek dat
        if (m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { o += 2; continue; }
        const delka = dv.getUint16(o + 2);
        if (m === 0xE1 && ascii(u8, o + 4, 6) === 'Exif\0\0') parsujTiff(u8, o + 10, v);
        if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC && !v.sirka) {
          v.vyska = dv.getUint16(o + 5); v.sirka = dv.getUint16(o + 7);
        }
        o += 2 + delka;
      }
    } else if (ascii(u8, 0, 8) === '\x89PNG\r\n\x1a\n') {
      v.typ = 'png';
      v.sirka = dv.getUint32(16); v.vyska = dv.getUint32(20);
      let o = 8;
      while (o + 12 <= u8.length) {
        const delka = dv.getUint32(o), typ = ascii(u8, o + 4, 4);
        if (typ === 'eXIf') parsujTiff(u8, o + 8, v);
        if (typ === 'IDAT' || typ === 'IEND') break;
        o += 12 + delka;
      }
    } else if (ascii(u8, 0, 4) === 'RIFF' && ascii(u8, 8, 4) === 'WEBP') {
      v.typ = 'webp';
      let o = 12;
      while (o + 8 <= u8.length) {
        const typ = ascii(u8, o, 4), delka = dv.getUint32(o + 4, true), d = o + 8;
        if (typ === 'VP8X') {
          v.sirka = 1 + (u8[d + 4] | u8[d + 5] << 8 | u8[d + 6] << 16);
          v.vyska = 1 + (u8[d + 7] | u8[d + 8] << 8 | u8[d + 9] << 16);
        } else if (typ === 'VP8 ' && !v.sirka) {
          v.sirka = dv.getUint16(d + 6, true) & 0x3FFF; v.vyska = dv.getUint16(d + 8, true) & 0x3FFF;
        } else if (typ === 'VP8L' && !v.sirka) {
          const b = dv.getUint32(d + 1, true);
          v.sirka = (b & 0x3FFF) + 1; v.vyska = ((b >>> 14) & 0x3FFF) + 1;
        } else if (typ === 'EXIF') {
          parsujTiff(u8, ascii(u8, d, 6) === 'Exif\0\0' ? d + 6 : d, v);
        }
        o = d + delka + (delka & 1);
      }
    } else if (ascii(u8, 0, 4) === 'GIF8') {
      v.typ = 'gif'; v.sirka = dv.getUint16(6, true); v.vyska = dv.getUint16(8, true);
    } else if (ascii(u8, 0, 2) === 'BM') {
      v.typ = 'bmp'; v.sirka = Math.abs(dv.getInt32(18, true)); v.vyska = Math.abs(dv.getInt32(22, true));
    } else if (ascii(u8, 4, 4) === 'ftyp') {
      const znacka = ascii(u8, 8, 4);
      v.typ = /avi[fs]/.test(znacka) ? 'avif' : /hei|mif1|msf1/.test(znacka) ? 'heic' : null;
    }
  } catch (e) { /* poškozená nebo useknutá hlavička – vrátíme, co se stihlo přečíst */ }
  if (!(v.orientace >= 1 && v.orientace <= 8)) v.orientace = 1;
  return v;
}

/** Rozměr tak, jak ho uvidí uživatel (orientace 5–8 prohazuje šířku a výšku). */
function zobrazenyRozmer(meta) {
  return meta.orientace >= 5 ? { w: meta.vyska, h: meta.sirka } : { w: meta.sirka, h: meta.vyska };
}

/* ---------- datum ---------- */
/** „2024:07:15 18:30:05“ → { Y, M, D, h, m, s } nebo null. */
function parsujExifDatum(t) {
  const m = String(t || '').match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m || m[1] === '0000') return null;
  return { Y: +m[1], M: +m[2], D: +m[3], h: +m[4], m: +m[5], s: +m[6] };
}
function datumZDate(d) {
  return { Y: d.getFullYear(), M: d.getMonth() + 1, D: d.getDate(), h: d.getHours(), m: d.getMinutes(), s: d.getSeconds() };
}
const dva = n => String(n).padStart(2, '0');
function formatujDatum(d, vzor) {
  return String(vzor || 'YYYY-MM-DD').replace(/YYYY|YY|MM|DD|HH|mm|ss/g, t => ({
    YYYY: String(d.Y), YY: dva(d.Y % 100), MM: dva(d.M), DD: dva(d.D), HH: dva(d.h), mm: dva(d.m), ss: dva(d.s),
  })[t]);
}

/* ---------- šablona jmen ---------- */
const ZAKAZANE_ZNAKY = /[\\/:*?"<>|\x00-\x1f]/g;

/** Název bez přípony. */
function bezPripony(jmeno) {
  const i = jmeno.lastIndexOf('.');
  return i > 0 ? jmeno.slice(0, i) : jmeno;
}

/**
 * Vzor jména → nové jméno souboru.
 * d = { nazev (původní, s příponou nebo bez), n, datum ({Y,M,D,h,m,s} | null), sirka, vyska, ext }
 * Tokeny: {nazev} {n} {n:3} {datum} {datum:YYYYMMDD_HHmmss} {sirka} {vyska} {ext}.
 * Přípona se doplní, pokud ji vzor nemá na konci.
 */
function noveJmeno(vzor, d) {
  const nazev = bezPripony(d.nazev || '');
  let s = String(vzor || '{nazev}').replace(/\{(\w+)(?::([^}]*))?\}/g, (cele, t, par) => {
    switch (t) {
      case 'nazev': return nazev;
      case 'n': return String(d.n).padStart(Math.min(10, Number(par) || 0), '0');
      case 'datum': return d.datum ? formatujDatum(d.datum, par) : 'bez-data';
      case 'sirka': return String(d.sirka);
      case 'vyska': return String(d.vyska);
      case 'ext': return d.ext;
      default: return cele;
    }
  });
  s = s.replace(ZAKAZANE_ZNAKY, '_').replace(/\s+/g, ' ').trim().replace(/^\.+/, '');
  if (!new RegExp('\\.' + d.ext + '$', 'i').test(s)) s = s.replace(/\.+$/, '') + '.' + d.ext;
  if (s === '.' + d.ext) s = 'obrazek.' + d.ext;
  return s;
}

/**
 * Vyřeší stejná jména (bez ohledu na velikost písmen – Windows/macOS je nerozliší).
 * Druhý a další výskyt dostane „_2“, „_3“… před příponou.
 * → { jmena: [...], kolize: [indexy přejmenovaných] }
 */
function vyresKolize(jmena) {
  const obsazeno = new Set(jmena.map(j => j.toLowerCase()));
  const pouzito = new Set(), vysl = [], kolize = [];
  jmena.forEach((j, i) => {
    let k = j.toLowerCase();
    if (!pouzito.has(k)) { pouzito.add(k); vysl.push(j); return; }
    const t = j.lastIndexOf('.'), zaklad = t > 0 ? j.slice(0, t) : j, pr = t > 0 ? j.slice(t) : '';
    let c = 2, nove;
    do { nove = zaklad + '_' + c + pr; k = nove.toLowerCase(); c++; } while (pouzito.has(k) || obsazeno.has(k));
    pouzito.add(k); vysl.push(nove); kolize.push(i);
  });
  return { jmena: vysl, kolize };
}

/* ---------- cílová velikost ---------- */
/**
 * Binární hledání nejvyšší kvality, při které je výsledek ≤ cílBajtu.
 * koduj(q) → Promise<{ size }> (Blob), q v rozsahu 0–1.
 * → { kvalita, vysledek, splneno, pokusu }
 */
async function hledejKvalitu(koduj, cilBajtu, moznosti) {
  const o = Object.assign({ min: 0.05, max: 0.95, iteraci: 7 }, moznosti);
  let pokusu = 1;
  const nejvyssi = await koduj(o.max);
  if (nejvyssi.size <= cilBajtu) return { kvalita: o.max, vysledek: nejvyssi, splneno: true, pokusu };
  let lo = o.min, hi = o.max, nejlepsi = null, nejlepsiQ = null;
  for (let i = 0; i < o.iteraci; i++) {
    const q = (lo + hi) / 2;
    const r = await koduj(q); pokusu++;
    if (r.size <= cilBajtu) { nejlepsi = r; nejlepsiQ = q; lo = q; } else hi = q;
  }
  if (nejlepsi) return { kvalita: nejlepsiQ, vysledek: nejlepsi, splneno: true, pokusu };
  const nejnizsi = await koduj(o.min); pokusu++;
  return { kvalita: o.min, vysledek: nejnizsi, splneno: nejnizsi.size <= cilBajtu, pokusu };
}

/* ---------- ZIP (metoda „uloženo“) ---------- */
const CRC_TAB = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();
function crc32(u8) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = CRC_TAB[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function dosCas(d) {
  return {
    cas: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    datum: (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * polozky = [{ jmeno ('slozka/a.jpg'), data: Uint8Array, datum?: Date }]
 * → pole částí (Uint8Array) pro new Blob(casti). Jména v UTF-8 (příznak 0x0800).
 * Obrázky jsou už komprimované, proto „uloženo“ – deflate by nic neušetřil.
 */
function zip(polozky) {
  if (polozky.length > 0xFFFF) throw new Error('ZIP bez ZIP64 pojme nejvýš 65 535 souborů.');
  const enc = new TextEncoder();
  const casti = [], centralni = [];
  let offset = 0;
  for (const p of polozky) {
    const data = typeof p.data === 'string' ? enc.encode(p.data) : p.data;
    const jmeno = enc.encode(p.jmeno.replace(/\\/g, '/'));
    const crc = crc32(data), t = dosCas(p.datum || new Date());
    if (offset + data.length > 0xFFFFFFFE) throw new Error('ZIP bez ZIP64 pojme nejvýš 4 GB – stáhněte po částech nebo uložte do složky.');
    const lok = new Uint8Array(30 + jmeno.length), dv = new DataView(lok.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0x0800, true);
    dv.setUint16(8, 0, true);
    dv.setUint16(10, t.cas, true);
    dv.setUint16(12, t.datum, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, data.length, true);
    dv.setUint32(22, data.length, true);
    dv.setUint16(26, jmeno.length, true);
    lok.set(jmeno, 30);
    casti.push(lok, data);

    const cen = new Uint8Array(46 + jmeno.length), cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(12, t.cas, true);
    cv.setUint16(14, t.datum, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, jmeno.length, true);
    cv.setUint32(42, offset, true);
    cen.set(jmeno, 46);
    centralni.push(cen);
    offset += lok.length + data.length;
  }
  const cdVelikost = centralni.reduce((s, c) => s + c.length, 0);
  const konec = new Uint8Array(22), kv = new DataView(konec.buffer);
  kv.setUint32(0, 0x06054b50, true);
  kv.setUint16(8, polozky.length, true);
  kv.setUint16(10, polozky.length, true);
  kv.setUint32(12, cdVelikost, true);
  kv.setUint32(16, offset, true);
  return [...casti, ...centralni, konec];
}

/* ---------- drobnosti pro UI ---------- */
function formatVelikost(b) {
  if (!(b >= 0)) return '–';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(b < 10240 ? 1 : 0).replace('.', ',') + ' kB';
  return (b / 1048576).toFixed(b < 10485760 ? 2 : 1).replace('.', ',') + ' MB';
}

function popisKroku(k) {
  switch (k.typ) {
    case 'otoc': return (k.uhel ? k.uhel + '°' : '') + (k.zrcadlo === 'h' ? ' ↔' : k.zrcadlo === 'v' ? ' ↕' : '') || 'beze změny';
    case 'orez': return k.pomer + (k.podleOrientace ? ' (podle orientace)' : '');
    case 'zmensi': {
      const z = { dlouha: 'delší strana ', sirka: 'šířka ', vyska: 'výška ', procenta: '', ramec: 'do ' }[k.rezim] || '';
      const h = k.rezim === 'procenta' ? k.hodnota + ' %' : k.rezim === 'ramec' ? k.hodnota + '×' + k.hodnota2 + ' px' : k.hodnota + ' px';
      return z + h + (k.jenZmensovat ? ', jen zmenšit' : '');
    }
    case 'upravy': return ['jas', 'kontrast', 'sytost'].filter(x => +k[x]).map(x => x + ' ' + (k[x] > 0 ? '+' : '') + k[x]).join(', ') || 'beze změny';
    case 'seda': return '';
    case 'okraj': return k.sirka + (k.jednotka === 'procenta' ? ' %' : ' px') + ' ' + k.barva;
    case 'vodoznak': return k.druh === 'text' ? '„' + k.text + '“' : 'obrázek';
  }
  return '';
}

const API = {
  TYPY_KROKU, VYCHOZI_VYSTUP, VYCHOZI_JMENA, VESTAVENE_PREDVOLBY, FORMATY,
  vychoziKrok, normalizujNastaveni,
  cilovyRozmer, parsujPomer, orezStred, sirkaOkraje, rozmerPoKroku, vyslednyRozmer, poziceVodoznaku,
  upravPixely, vystupniFormat, jeObrazek,
  ctiMetadata, zobrazenyRozmer, parsujExifDatum, datumZDate, formatujDatum,
  bezPripony, noveJmeno, vyresKolize, hledejKvalitu,
  crc32, zip, formatVelikost, popisKroku,
};
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else koren.OBRAZKY_DAVKA = API;
})(typeof self !== 'undefined' ? self : this);

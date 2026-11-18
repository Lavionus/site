/* Ověření pravosti fotografie – jádro (PRAVOST) bez DOM: prohlížeč, Web Worker i node.
   - rozbor souboru: markery JPEG, kvantizační tabulky (DQT) + odhad kvality IJG, SOF a podvzorkování,
     EXIF (IFD0, Exif, GPS, IFD1 s náhledem), XMP, komentáře, PNG bloky (IHDR, tEXt, eXIf),
   - indicie z metadat (software editoru, data, rozměry, chybějící pole…),
   - analýzy nad poli pixelů RGBA: ELA (vlastní simulace ztrátové části JPEG → shodná v prohlížeči i v node),
     šumový reziduál a mapa šumu (Immerkær), copy-move (bloková shoda se společným posunem),
     dvojitá kvantizace (histogramy DCT koeficientů), porovnání náhledu EXIF s obrázkem,
   - minimalistický kodér baseline JPEG (4:4:4, Huffman bez optimalizace) a zápis EXIF – jen pro syntetické ukázky,
   - ukázky se známou pravdou (procedurální scéna, deterministický seed).
   Test: node _test/pravost_fotky_test.js, validace: node tools/vysetrovani_validace.mjs */
(function (koren) {
  'use strict';

  /* ======================= konstanty JPEG ======================= */
  // pořadí zig-zag → přirozený index (řádek*8 + sloupec)
  const ZIG = [0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28,
    35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63];
  // standardní tabulky IJG (ITU-T T.81, příloha K) v přirozeném pořadí
  const IJG_Y = [16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62,
    18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99];
  const IJG_C = [17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99, 99, 99, 99, 47, 66, 99, 99, 99, 99, 99, 99]
    .concat(new Array(32).fill(99));

  /** Tabulka IJG pro kvalitu 1–100 (jpeg_quality_scaling + force_baseline), přirozené pořadí. */
  function tabulkaIJG(zakl, q) {
    q = Math.max(1, Math.min(100, Math.round(q)));
    const s = q < 50 ? Math.floor(5000 / q) : 200 - 2 * q;
    return zakl.map(b => Math.max(1, Math.min(255, Math.floor((b * s + 50) / 100))));
  }

  /** Odhad kvality: nejbližší kvalita IJG; přesná shoda = standardní tabulka knihovny libjpeg. */
  function odhadKvality(tabulky) {
    const ty = (tabulky.find(t => t.id === 0) || tabulky[0] || {}).hodnoty;
    const tc = (tabulky.find(t => t.id === 1) || {}).hodnoty;
    if (!ty) return null;
    let nej = null;
    for (let q = 1; q <= 100; q++) {
      const sy = tabulkaIJG(IJG_Y, q), sc = tabulkaIJG(IJG_C, q);
      let chyba = 0, n = 0, presne = true;
      for (let i = 0; i < 64; i++) { chyba += Math.abs(Math.log(ty[i] / sy[i])); n++; if (ty[i] !== sy[i]) presne = false; }
      if (tc) for (let i = 0; i < 64; i++) { chyba += Math.abs(Math.log(tc[i] / sc[i])); n++; if (tc[i] !== sc[i]) presne = false; }
      chyba /= n;
      if (!nej || chyba < nej.chyba - 1e-12) nej = { q, chyba, presne };
    }
    const lin = Math.round(ty.reduce((a, v, i) => a + Math.abs(v - tabulkaIJG(IJG_Y, nej.q)[i]), 0) / 64 * 100) / 100;
    return { kvalita: nej.q, standardni: nej.presne, odchylka: lin, prumerKrok: Math.round(ty.reduce((a, v) => a + v, 0) / 64 * 10) / 10 };
  }

  /* ======================= čtení bajtů ======================= */
  const latin1 = (b, od, do_) => { let s = ''; for (let i = od; i < do_ && i < b.length; i++) s += String.fromCharCode(b[i]); return s; };
  const utf8 = b => { try { return new TextDecoder('utf-8').decode(b); } catch (e) { return latin1(b, 0, b.length); } };
  const zacina = (b, od, s) => { for (let i = 0; i < s.length; i++) if (b[od + i] !== s.charCodeAt(i)) return false; return true; };

  const NAZVY_MARKERU = {
    0xD8: 'SOI – začátek obrázku', 0xD9: 'EOI – konec obrázku', 0xC0: 'SOF0 – baseline DCT', 0xC1: 'SOF1 – rozšířený DCT',
    0xC2: 'SOF2 – progresivní DCT', 0xC3: 'SOF3 – bezeztrátový', 0xC4: 'DHT – Huffmanovy tabulky', 0xDB: 'DQT – kvantizační tabulky',
    0xDD: 'DRI – interval restartu', 0xDA: 'SOS – začátek skenu', 0xFE: 'COM – komentář', 0xCC: 'DAC – aritmetické kódování'
  };
  const ID_APP = [
    ['JFIF\0', 'JFIF'], ['JFXX\0', 'JFIF rozšíření (náhled)'], ['Exif\0\0', 'EXIF'], ['Exif\0\xFF', 'EXIF'],
    ['http://ns.adobe.com/xap/1.0/\0', 'XMP'], ['http://ns.adobe.com/xmp/extension/\0', 'XMP rozšíření'],
    ['ICC_PROFILE\0', 'ICC barevný profil'], ['Photoshop 3.0\0', 'Photoshop IRB (IPTC)'], ['Adobe', 'Adobe (transformace barev)'],
    ['Ducky', 'Ducky (Uložit pro web)'], ['MPF\0', 'MPF – více obrázků v souboru'], ['AROT', 'Android rotace'], ['HDR', 'HDR mapa']
  ];

  /** Rozbor souboru – podle signatury JPEG / PNG / HEIC / WebP. */
  function rozborSouboru(b) {
    if (!(b instanceof Uint8Array)) b = new Uint8Array(b);
    if (b[0] === 0xFF && b[1] === 0xD8) return rozborJpeg(b);
    if (zacina(b, 0, '\x89PNG\r\n\x1a\n')) return rozborPng(b);
    if (zacina(b, 4, 'ftyp')) {
      const znacka = latin1(b, 8, 12);
      return { typ: /hei|hev|mif|msf/.test(znacka) ? 'heic' : 'iso', znacka, markery: [], dqt: [], varovani: [
        'HEIC/HEIF prohlížeč (Chromium) neumí dekódovat – obrazové analýzy nejdou. Otisk SHA-256 je spočten; pro analýzu převeďte originál bezztrátově (např. do PNG) a uveďte to v protokolu – převod sám mění soubor.'] };
    }
    if (zacina(b, 0, 'RIFF') && zacina(b, 8, 'WEBP')) return { typ: 'webp', markery: [], dqt: [], varovani: [
      'WebP: struktura JPEG chybí, ELA a dvojitá komprese se nedají použít (jiná transformace než JPEG). Šum a klonování fungují.'] };
    return { typ: 'neznamy', markery: [], dqt: [], varovani: ['Neznámý formát souboru.'] };
  }

  const MAX_MARKERU = 5000; // skutečné soubory mají desítky; víc = poškozený/zlomyslný soubor (tabulka v UI by zamrzla)
  function rozborJpeg(b) {
    const r = { typ: 'jpeg', markery: [], dqt: [], sof: null, app: [], komentare: [], exif: null, xmp: null, skenu: 0, varovani: [], zaEOI: 0, restart: 0 };
    let i = 2;
    r.markery.push({ m: 0xD8, kod: 'FFD8', nazev: NAZVY_MARKERU[0xD8], offset: 0, delka: 0 });
    while (i < b.length - 1) {
      if (r.markery.length >= MAX_MARKERU) { r.varovani.push(`Přes ${MAX_MARKERU} markerů – soubor je poškozený nebo záměrně upravený, další se nečtou.`); break; }
      if (b[i] !== 0xFF) { r.varovani.push(`Neočekávaný bajt na pozici ${i} – struktura je poškozená nebo neúplná.`); break; }
      const m = b[i + 1];
      if (m === 0xFF) { i++; continue; }
      const kod = 'FF' + m.toString(16).toUpperCase().padStart(2, '0');
      if (m === 0xD9) { r.markery.push({ m, kod, nazev: NAZVY_MARKERU[m], offset: i, delka: 0 }); i += 2; r.zaEOI = b.length - i; break; }
      if ((m >= 0xD0 && m <= 0xD7) || m === 0x01) { i += 2; continue; }
      if (i + 3 >= b.length) break;
      const len = (b[i + 2] << 8) | b[i + 3];
      const data = b.subarray(i + 4, Math.min(b.length, i + 2 + len));
      const zaznam = { m, kod, nazev: NAZVY_MARKERU[m] || '', offset: i, delka: len };
      if (m >= 0xE0 && m <= 0xEF) {
        const id = ID_APP.find(([s]) => zacina(data, 0, s));
        zaznam.nazev = `APP${m - 0xE0}` + (id ? ' – ' + id[1] : '');
        r.app.push({ n: m - 0xE0, id: id ? id[1] : latin1(data, 0, 12).replace(/[^\x20-\x7e]/g, '·'), delka: len });
        if (id && id[1] === 'EXIF' && !r.exif) {
          try { r.exif = ctiTiff(data, 6); } catch (e) { r.varovani.push('EXIF nelze přečíst: ' + e.message); }
        } else if (id && id[1] === 'XMP' && !r.xmp) {
          r.xmp = rozborXmp(utf8(data.subarray(29)));
        } else if (id && id[1] === 'JFIF') {
          r.jfif = { verze: data[5] + '.' + String(data[6]).padStart(2, '0'), jednotky: data[7], hustotaX: (data[8] << 8) | data[9], hustotaY: (data[10] << 8) | data[11] };
        }
      } else if (m === 0xDB) {
        let p = 0;
        while (p < data.length) {
          const pq = data[p] >> 4, tq = data[p] & 15; p++;
          const hod = new Array(64);
          for (let k = 0; k < 64; k++) { hod[ZIG[k]] = pq ? (data[p] << 8) | data[p + 1] : data[p]; p += pq ? 2 : 1; }
          r.dqt.push({ id: tq, presnost: pq ? 16 : 8, hodnoty: hod });
        }
      } else if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        const slozky = [];
        for (let k = 0; k < data[5]; k++) slozky.push({ id: data[6 + k * 3], h: data[7 + k * 3] >> 4, v: data[7 + k * 3] & 15, tq: data[8 + k * 3] });
        r.sof = { typ: m, presnost: data[0], vyska: (data[1] << 8) | data[2], sirka: (data[3] << 8) | data[4], slozky, progresivni: m === 0xC2 || m === 0xC6 || m === 0xCA };
      } else if (m === 0xFE) {
        if (r.komentare.length < 20) r.komentare.push(utf8(data.subarray(0, MAX_TEXT)).replace(/\0+$/, ''));
      } else if (m === 0xDD) {
        r.restart = (data[0] << 8) | data[1];
      }
      r.markery.push(zaznam);
      i += 2 + len;
      if (m === 0xDA) {
        r.skenu++;
        const od = i;
        while (i < b.length - 1 && !(b[i] === 0xFF && b[i + 1] !== 0 && !(b[i + 1] >= 0xD0 && b[i + 1] <= 0xD7))) i++;
        zaznam.data = i - od;
      }
    }
    if (r.sof) r.podvzorkovani = podvzorkovani(r.sof.slozky);
    if (r.dqt.length) r.kvalita = odhadKvality(r.dqt);
    if (r.exif && r.exif.nahled) {
      const n = r.exif.nahled;
      if (n.offset + n.delka <= r.exif._delka) r.nahledBajty = r.exif._b.slice(n.offset, n.offset + n.delka);
    }
    if (r.exif) { delete r.exif._b; delete r.exif._delka; }
    return r;
  }

  function podvzorkovani(sl) {
    if (sl.length === 1) return 'odstíny šedi (1 složka)';
    const y = sl[0], c = sl[1];
    const h = y.h / c.h, v = y.v / c.v;
    const jm = { '1x1': '4:4:4', '2x1': '4:2:2', '2x2': '4:2:0', '1x2': '4:4:0', '4x1': '4:1:1' }[h + 'x' + v];
    return (jm || `${h}×${v}`) + ` (Y ${y.h}×${y.v}, chroma ${c.h}×${c.v})`;
  }

  function rozborPng(b) {
    const r = { typ: 'png', markery: [], dqt: [], texty: {}, exif: null, varovani: [
      'PNG je bezztrátový: ELA a dvojitá komprese JPEG nemají význam. Pokud PNG vzniklo z JPEG (snímek obrazovky, export), stopy po JPEG už nejsou v souboru vidět.'] };
    let i = 8;
    while (i + 8 <= b.length) {
      if (r.markery.length >= MAX_MARKERU) { r.varovani.push(`Přes ${MAX_MARKERU} bloků PNG – další se nečtou.`); break; }
      const len = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0, typ = latin1(b, i + 4, i + 8);
      const data = b.subarray(i + 8, i + 8 + len);
      r.markery.push({ kod: typ, nazev: 'blok ' + typ, offset: i, delka: len });
      if (typ === 'IHDR') r.sof = { sirka: ((data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3]) >>> 0, vyska: ((data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7]) >>> 0, slozky: [] };
      else if (typ === 'tEXt' || typ === 'iTXt') {
        const nul = data.indexOf(0); const klic = latin1(data, 0, nul);
        let txt = typ === 'tEXt' ? latin1(data, nul + 1, data.length) : utf8(data.subarray(nul + 1)).replace(/^[\s\S]*?\0[\s\S]*?\0[\s\S]*?\0/, '');
        if (klic === 'XML:com.adobe.xmp') r.xmp = rozborXmp(txt); else r.texty[klic] = txt.slice(0, 500);
      } else if (typ === 'eXIf') { try { r.exif = ctiTiff(data, 0); delete r.exif._b; delete r.exif._delka; } catch (e) { r.varovani.push('eXIf nelze přečíst'); } }
      if (typ === 'IEND') break;
      i += 12 + len;
    }
    return r;
  }

  /* ======================= EXIF (TIFF) ======================= */
  const TAGY = {
    ifd0: { 0x010E: 'ImageDescription', 0x010F: 'Make', 0x0110: 'Model', 0x0112: 'Orientation', 0x011A: 'XResolution', 0x011B: 'YResolution',
      0x0128: 'ResolutionUnit', 0x0131: 'Software', 0x0132: 'DateTime', 0x013B: 'Artist', 0x8298: 'Copyright', 0x0100: 'ImageWidth', 0x0101: 'ImageLength',
      0x0213: 'YCbCrPositioning', 0x8769: 'ExifIFDPointer', 0x8825: 'GPSInfoIFDPointer', 0xC4A5: 'PrintIM' },
    exif: { 0x829A: 'ExposureTime', 0x829D: 'FNumber', 0x8822: 'ExposureProgram', 0x8827: 'ISOSpeedRatings', 0x9000: 'ExifVersion',
      0x9003: 'DateTimeOriginal', 0x9004: 'DateTimeDigitized', 0x9010: 'OffsetTime', 0x9011: 'OffsetTimeOriginal', 0x9012: 'OffsetTimeDigitized',
      0x9201: 'ShutterSpeedValue', 0x9202: 'ApertureValue', 0x9204: 'ExposureBiasValue', 0x9207: 'MeteringMode', 0x9209: 'Flash', 0x920A: 'FocalLength',
      0x927C: 'MakerNote', 0x9286: 'UserComment', 0x9290: 'SubSecTime', 0x9291: 'SubSecTimeOriginal', 0xA001: 'ColorSpace',
      0xA002: 'PixelXDimension', 0xA003: 'PixelYDimension', 0xA405: 'FocalLengthIn35mmFilm', 0xA420: 'ImageUniqueID', 0xA431: 'BodySerialNumber',
      0xA433: 'LensMake', 0xA434: 'LensModel', 0xA402: 'ExposureMode', 0xA403: 'WhiteBalance', 0xA406: 'SceneCaptureType', 0xA005: 'InteropIFDPointer' },
    gps: { 0x0000: 'GPSVersionID', 0x0001: 'GPSLatitudeRef', 0x0002: 'GPSLatitude', 0x0003: 'GPSLongitudeRef', 0x0004: 'GPSLongitude',
      0x0005: 'GPSAltitudeRef', 0x0006: 'GPSAltitude', 0x0007: 'GPSTimeStamp', 0x0012: 'GPSMapDatum', 0x001D: 'GPSDateStamp' },
    ifd1: { 0x0100: 'ImageWidth', 0x0101: 'ImageLength', 0x0103: 'Compression', 0x011A: 'XResolution', 0x011B: 'YResolution', 0x0128: 'ResolutionUnit',
      0x0201: 'JPEGInterchangeFormat', 0x0202: 'JPEGInterchangeFormatLength' }
  };
  const VELIKOST_TYPU = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };
  const MAX_HODNOT = 256, MAX_TEXT = 4096; // víc se z jedné položky nečte (ochrana paměti a času)

  /** TIFF struktura uvnitř APP1 (od `start`): vrací {ifd0, exif, gps, ifd1, nahled:{offset, delka}, poradi} – offsety v rámci TIFF. */
  function ctiTiff(data, start) {
    const b = data.subarray(start);
    const le = b[0] === 0x49 && b[1] === 0x49;
    if (!le && !(b[0] === 0x4D && b[1] === 0x4D)) throw new Error('chybí hlavička TIFF');
    const u16 = o => le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1];
    const u32 = o => (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3])) >>> 0;
    const i32 = o => u32(o) | 0;
    if (u16(2) !== 42) throw new Error('chybná značka TIFF');
    const vysl = { poradi: le ? 'Intel (II)' : 'Motorola (MM)', ifd0: {}, exif: {}, gps: {}, ifd1: {}, _b: b, _delka: b.length };
    const navstiveno = new Set();
    function ifd(off, kam, mapa) {
      if (!off || off + 2 > b.length || navstiveno.has(off)) return 0;
      navstiveno.add(off);
      const n = u16(off);
      if (n > 1000) throw new Error('nesmyslný počet položek IFD');
      for (let k = 0; k < n; k++) {
        const e = off + 2 + k * 12;
        if (e + 12 > b.length) break;
        const tag = u16(e), typ = u16(e + 2), cnt = u32(e + 4);
        const vel = (VELIKOST_TYPU[typ] || 1) * cnt;
        const ho = vel > 4 ? u32(e + 8) : e + 8;
        if (ho + vel > b.length) continue;
        // položky se mohou překrývat (zlomyslný soubor: 1000 × tytéž bajty) → číst jen začátek hodnoty
        const nh = Math.min(cnt, MAX_HODNOT);
        let h;
        if (typ === 2) h = latin1(b, ho, ho + Math.min(cnt, MAX_TEXT)).replace(/\0[\s\S]*$/, '').trim();
        else if (typ === 3 || typ === 8) h = Array.from({ length: nh }, (_, j) => typ === 8 ? (u16(ho + 2 * j) << 16) >> 16 : u16(ho + 2 * j));
        else if (typ === 4 || typ === 9) h = Array.from({ length: nh }, (_, j) => typ === 9 ? i32(ho + 4 * j) : u32(ho + 4 * j));
        else if (typ === 5 || typ === 10) h = Array.from({ length: nh }, (_, j) => { const a = typ === 10 ? i32(ho + 8 * j) : u32(ho + 8 * j), d = typ === 10 ? i32(ho + 8 * j + 4) : u32(ho + 8 * j + 4); return d ? a / d : 0; });
        else h = b.slice(ho, ho + Math.min(cnt, 64)); // UNDEFINED/BYTE – jen začátek
        if (Array.isArray(h) && h.length === 1) h = h[0];
        if (tag === 0x9000 && h instanceof Uint8Array) h = latin1(h, 0, h.length);
        kam[mapa[tag] || ('0x' + tag.toString(16).toUpperCase().padStart(4, '0'))] = h;
      }
      return u32(off + 2 + n * 12);
    }
    const dalsi = ifd(u32(4), vysl.ifd0, TAGY.ifd0);
    if (vysl.ifd0.ExifIFDPointer) ifd(vysl.ifd0.ExifIFDPointer, vysl.exif, TAGY.exif);
    if (vysl.ifd0.GPSInfoIFDPointer) ifd(vysl.ifd0.GPSInfoIFDPointer, vysl.gps, TAGY.gps);
    if (dalsi) ifd(dalsi, vysl.ifd1, TAGY.ifd1);
    if (vysl.ifd1.JPEGInterchangeFormat && vysl.ifd1.JPEGInterchangeFormatLength)
      vysl.nahled = { offset: vysl.ifd1.JPEGInterchangeFormat, delka: vysl.ifd1.JPEGInterchangeFormatLength };
    const g = vysl.gps;
    if (Array.isArray(g.GPSLatitude) && Array.isArray(g.GPSLongitude)) {
      const dms = a => a[0] + a[1] / 60 + a[2] / 3600;
      vysl.poloha = { lat: +(dms(g.GPSLatitude) * (g.GPSLatitudeRef === 'S' ? -1 : 1)).toFixed(6), lon: +(dms(g.GPSLongitude) * (g.GPSLongitudeRef === 'W' ? -1 : 1)).toFixed(6) };
    }
    return vysl;
  }

  function rozborXmp(t) {
    const pole = n => { const m = t.match(new RegExp(n + '="([^"]*)"')) || t.match(new RegExp('<' + n + '>([^<]*)</' + n + '>')); return m ? m[1] : null; };
    const agenti = [...new Set((t.match(/softwareAgent(?:="|>)([^"<]*)/g) || []).map(s => s.replace(/^softwareAgent(?:="|>)/, '')))];
    const akce = (t.match(/stEvt:action(?:="|>)([^"<]*)/g) || []).map(s => s.replace(/^stEvt:action(?:="|>)/, ''));
    return { creatorTool: pole('xmp:CreatorTool'), createDate: pole('xmp:CreateDate'), modifyDate: pole('xmp:ModifyDate'), metadataDate: pole('xmp:MetadataDate'),
      documentId: pole('xmpMM:DocumentID'), originalDocumentId: pole('xmpMM:OriginalDocumentID'), agenti, akce, delka: t.length };
  }

  /* ======================= indicie z metadat ======================= */
  const EDITORY = /photoshop|lightroom|gimp|affinity|paint\.net|pixelmator|snapseed|picsart|canva|facetune|photopea|krita|luminar|capture one|darktable|rawtherapee|acdsee|faststone|irfanview|xnview|paintshop|corel|befunky|fotor|meitu|vsco|photodirector|photoscape|inpaint|remini|airbrush|fotoworks|movavi|imagemagick|graphicsmagick|gd-jpeg|photos? editor|editor/i;
  const datumExif = s => { const m = /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(s || ''); return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null; };
  const datumXmp = s => { const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d))?/.exec(s || ''); return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : null; };

  /** Indicie z metadat a struktury. vaha: 3 silná, 2 střední, 1 slabá, 0 jen informace. */
  function indicieMetadat(r, dekodovano) {
    const ind = [], pridej = (vaha, oblast, text, vysvetleni) => ind.push({ vaha, oblast, text, vysvetleni });
    const e = r.exif, ifd0 = e ? e.ifd0 : {}, ex = e ? e.exif : {};
    if (r.typ !== 'jpeg' && r.typ !== 'png') return ind;
    if (!e) pridej(0, 'metadata', 'Soubor nemá EXIF.', 'Typické pro fotky ze sociálních sítí a messengerů, snímky obrazovky a exporty „pro web“. Samo o sobě úpravu nedokazuje – jen ubírá možnost kontroly.');
    else {
      if (!ifd0.Make && !ifd0.Model) pridej(0, 'metadata', 'EXIF neuvádí výrobce ani model fotoaparátu.', 'Fotoaparáty a telefony je zapisují téměř vždy; chybí po exportu z části editorů a aplikací.');
      if ((ifd0.Make || ifd0.Model) && !ex.DateTimeOriginal) pridej(1, 'metadata', 'Je uveden fotoaparát, ale chybí datum pořízení (DateTimeOriginal).', 'Fotoaparát toto pole zapisuje; chybí-li, metadata nejspíš prošla úpravou.');
    }
    const sw = [ifd0.Software, r.xmp && r.xmp.creatorTool, ...(r.xmp ? r.xmp.agenti : []), ...(r.komentare || []), r.texty && r.texty.Software].filter(Boolean);
    const editory = [...new Set(sw.filter(s => EDITORY.test(s)))].join('; ');
    if (editory) pridej(2, 'metadata', `Software v metadatech je editor: ${editory}`, 'Soubor prošel editorem. Může jít jen o zmenšení, ořez nebo převod – nedokazuje to změnu obsahu, ale soubor není originál z fotoaparátu.');
    else if (ifd0.Software) pridej(0, 'metadata', 'Software: ' + ifd0.Software, 'Obvykle firmware fotoaparátu nebo verze systému telefonu.');
    const dto = datumExif(ex.DateTimeOriginal), dm = datumExif(ifd0.DateTime);
    if (dto != null && dm != null) {
      const d = (dm - dto) / 1000;
      if (d < -2) pridej(2, 'metadata', `Datum změny (${ifd0.DateTime}) je dřív než datum pořízení (${ex.DateTimeOriginal}).`, 'Nelogické pořadí – nastavené hodiny, ruční přepis metadat nebo jejich kopie z jiného souboru.');
      else if (d > 2) pridej(2, 'metadata', `Datum změny ${ifd0.DateTime} se liší od data pořízení ${ex.DateTimeOriginal} (o ${trvani(d)}).`, 'Fotoaparát zapisuje obě data stejně; pozdější datum změny zapisuje editor při uložení.');
    }
    if (r.xmp) {
      const xc = datumXmp(r.xmp.createDate), xm = datumXmp(r.xmp.modifyDate);
      if (xc != null && xm != null && xm - xc > 2000) pridej(1, 'metadata', `XMP: datum úpravy ${r.xmp.modifyDate} je pozdější než vznik ${r.xmp.createDate}.`, 'XMP zapisují editory a správci fotek.');
      if (r.xmp.originalDocumentId && r.xmp.documentId && r.xmp.originalDocumentId !== r.xmp.documentId) pridej(1, 'metadata', 'XMP: dokument je odvozený z jiného (DocumentID ≠ OriginalDocumentID).', 'Editor zaznamenal, že soubor vznikl z jiného dokumentu (uložit jako, export).');
      const akce = r.xmp.akce.slice(0, 6).join(', ');
      if (akce) pridej(1, 'metadata', `XMP historie úprav: ${akce}`, 'Záznamy stEvt v historii XMP.');
    }
    const px = ex.PixelXDimension, py = ex.PixelYDimension, sof = r.sof;
    if (sof && px && py && sof.sirka && sof.vyska) {
      if (!(px === sof.sirka && py === sof.vyska)) {
        if (px === sof.vyska && py === sof.sirka) pridej(1, 'metadata', `Rozměry v EXIF ${px} × ${py} jsou prohozené proti obrázku ${sof.sirka} × ${sof.vyska}.`, 'Otočení bez přepisu EXIF (zápis orientace se liší podle programu).');
        else pridej(3, 'metadata', `Rozměry v EXIF ${px} × ${py} neodpovídají obrázku ${sof.sirka} × ${sof.vyska}.`, 'Obrázek byl zmenšen nebo ořezán a metadata zůstala z originálu.');
      }
    }
    if (dekodovano && sof && sof.sirka && (dekodovano.w !== sof.sirka || dekodovano.h !== sof.vyska) && !(dekodovano.w === sof.vyska && dekodovano.h === sof.sirka))
      pridej(1, 'struktura', 'Dekódovaný obrázek má jiné rozměry než hlavička souboru.', 'Neobvyklé – zkontrolujte soubor jiným programem.');
    if (r.typ === 'jpeg') {
      const q = r.kvalita;
      if (q && q.standardni && (ifd0.Make || ifd0.Model)) pridej(1, 'struktura', `Kvantizační tabulky jsou standardní IJG (kvalita ${q.kvalita}), ale EXIF uvádí fotoaparát.`, 'Fotoaparáty obvykle mají vlastní tabulky; standardní IJG tabulky zapisuje knihovna libjpeg (editory, prohlížeče, část telefonů). Naznačuje přeuložení – není to důkaz.');
      if (r.app.some(a => /Photoshop|Adobe|Ducky/.test(a.id))) pridej(1, 'struktura', 'Segmenty Adobe (Photoshop IRB / Adobe / Ducky).', 'Zapisují je programy Adobe při uložení – soubor jimi prošel.');
      if (r.jfif && e && (ifd0.Make || ifd0.Model)) pridej(0, 'struktura', 'Soubor má JFIF i EXIF s fotoaparátem.', 'Fotoaparáty obvykle JFIF nezapisují (jen EXIF); kombinace bývá po přeuložení. Slabé vodítko.');
      if (r.zaEOI > 16) pridej(r.app.some(a => /MPF/.test(a.id)) ? 0 : 1, 'struktura', `Za koncem obrázku (EOI) je ještě ${r.zaEOI} B dat.`, 'Bývá to druhý obrázek MPF (telefony – hloubková mapa, náhled), ale také připojená data.');
      if (r.sof && r.sof.progresivni) pridej(0, 'struktura', 'Progresivní JPEG.', 'Fotoaparáty ukládají baseline; progresivní zápis je typický pro web a editory.');
    }
    return ind;
  }
  const trvani = s => { s = Math.abs(s); return s < 120 ? Math.round(s) + ' s' : s < 7200 ? Math.round(s / 60) + ' min' : s < 172800 ? Math.round(s / 360) / 10 + ' h' : Math.round(s / 8640) / 10 + ' dne'; };

  /* ======================= DCT a ztrátová část JPEG ======================= */
  const COS = (() => { const c = new Float64Array(64); for (let u = 0; u < 8; u++) for (let x = 0; x < 8; x++) c[u * 8 + x] = (u === 0 ? Math.SQRT1_2 : 1) * Math.cos((2 * x + 1) * u * Math.PI / 16) / 2; return c; })();
  function fdct(vst, vys, t) {
    for (let y = 0; y < 8; y++) for (let u = 0; u < 8; u++) { let s = 0; for (let x = 0; x < 8; x++) s += COS[u * 8 + x] * vst[y * 8 + x]; t[y * 8 + u] = s; }
    for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) { let s = 0; for (let y = 0; y < 8; y++) s += COS[v * 8 + y] * t[y * 8 + u]; vys[v * 8 + u] = s; }
  }
  function idct(vst, vys, t) {
    for (let v = 0; v < 8; v++) for (let x = 0; x < 8; x++) { let s = 0; for (let u = 0; u < 8; u++) s += COS[u * 8 + x] * vst[v * 8 + u]; t[v * 8 + x] = s; }
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { let s = 0; for (let v = 0; v < 8; v++) s += COS[v * 8 + y] * t[v * 8 + x]; vys[y * 8 + x] = s; }
  }
  const c255 = v => v < 0 ? 0 : v > 255 ? 255 : v;

  /** Ztrátová část JPEG (4:4:4): RGB → YCbCr (celá čísla) → DCT → kvantizace → zpět. Vrací rekonstrukci RGBA
      a volitelně kvantované koeficienty (pro kodér). Stejný výsledek jako dekodér až na ±1 (zaokrouhlení IDCT/barev). */
  function jpegSimulace(rgba, w, h, tabY, tabC, sKoef, prubeh) {
    const bw = Math.ceil(w / 8), bh = Math.ceil(h / 8);
    const ven = new Uint8ClampedArray(w * h * 4);
    const koef = sKoef ? [new Int16Array(bw * bh * 64), new Int16Array(bw * bh * 64), new Int16Array(bw * bh * 64)] : null;
    const blok = [new Float64Array(64), new Float64Array(64), new Float64Array(64)], F = new Float64Array(64), t = new Float64Array(64), R = [new Float64Array(64), new Float64Array(64), new Float64Array(64)];
    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) {
          const x = Math.min(w - 1, bx * 8 + xx), y = Math.min(h - 1, by * 8 + yy), p = (y * w + x) * 4;
          const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2], k = yy * 8 + xx;
          blok[0][k] = c255(Math.round(0.299 * r + 0.587 * g + 0.114 * b)) - 128;
          blok[1][k] = c255(Math.round(-0.168736 * r - 0.331264 * g + 0.5 * b + 128)) - 128;
          blok[2][k] = c255(Math.round(0.5 * r - 0.418688 * g - 0.081312 * b + 128)) - 128;
        }
        for (let c = 0; c < 3; c++) {
          const Q = c ? tabC : tabY;
          fdct(blok[c], F, t);
          for (let k = 0; k < 64; k++) { const qv = Math.round(F[k] / Q[k]); if (koef) koef[c][(by * bw + bx) * 64 + k] = qv; F[k] = qv * Q[k]; }
          idct(F, R[c], t);
        }
        for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) {
          const x = bx * 8 + xx, y = by * 8 + yy;
          if (x >= w || y >= h) continue;
          const k = yy * 8 + xx, p = (y * w + x) * 4;
          const Y = c255(Math.round(R[0][k] + 128)), Cb = c255(Math.round(R[1][k] + 128)) - 128, Cr = c255(Math.round(R[2][k] + 128)) - 128;
          ven[p] = Math.round(Y + 1.402 * Cr); ven[p + 1] = Math.round(Y - 0.344136 * Cb - 0.714136 * Cr); ven[p + 2] = Math.round(Y + 1.772 * Cb); ven[p + 3] = 255;
        }
      }
      if (prubeh && (by & 15) === 0) prubeh(by / bh);
    }
    return { rgba: ven, koef, bw, bh };
  }

  /* ======================= kodér baseline JPEG (jen pro ukázky) ======================= */
  // Huffmanovy tabulky z ITU-T T.81 přílohy K.3 (DC a AC jasové) – použité pro všechny složky.
  const DC_BITS = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0], DC_HOD = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const AC_BITS = [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d];
  const AC_HOD = [0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
    0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
    0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
    0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
    0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa];
  function kanonicke(bits, hod) {
    const kody = {}; let kod = 0, k = 0;
    for (let d = 1; d <= 16; d++) { for (let i = 0; i < bits[d - 1]; i++) kody[hod[k++]] = [kod++, d]; kod <<= 1; }
    return kody;
  }
  const HUF_DC = kanonicke(DC_BITS, DC_HOD), HUF_AC = kanonicke(AC_BITS, AC_HOD);

  function Bajty() { this.a = []; }
  Bajty.prototype.u8 = function (v) { this.a.push(v & 255); return this; };
  Bajty.prototype.u16 = function (v) { this.a.push((v >> 8) & 255, v & 255); return this; };
  Bajty.prototype.pole = function (p) { for (const v of p) this.a.push(v & 255); return this; };
  Bajty.prototype.text = function (s) { for (let i = 0; i < s.length; i++) this.a.push(s.charCodeAt(i) & 255); return this; };
  Bajty.prototype.segment = function (m, data) { this.u8(0xFF).u8(m).u16(data.length + 2).pole(data); return this; };

  /** Zakóduje RGBA do baseline JPEG 4:4:4. o = {kvalita | tabY+tabC, jfif, exif (bajty APP1 vč. „Exif\0\0“), xmp (text), komentar}.
      Vrací {bajty: Uint8Array, rgba: rekonstrukce (= co ukáže dekodér, ±1)}. */
  function kodujJpeg(rgba, w, h, o) {
    o = o || {};
    const tY = o.tabY || tabulkaIJG(IJG_Y, o.kvalita || 85), tC = o.tabC || tabulkaIJG(IJG_C, o.kvalita || 85);
    const sim = jpegSimulace(rgba, w, h, tY, tC, true);
    const B = new Bajty(); B.u8(0xFF).u8(0xD8);
    if (o.jfif !== false && !o.exif) B.segment(0xE0, [0x4A, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
    else if (o.jfif === true) B.segment(0xE0, [0x4A, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
    if (o.exif) B.segment(0xE1, o.exif);
    if (o.xmp) { const x = new Bajty().text('http://ns.adobe.com/xap/1.0/\0'); for (const c of unescape(encodeURIComponent(o.xmp))) x.u8(c.charCodeAt(0)); B.segment(0xE1, x.a); }
    if (o.komentar) B.segment(0xFE, new Bajty().text(o.komentar).a);
    B.segment(0xDB, [0x00, ...ZIG.map(i => tY[i]), 0x01, ...ZIG.map(i => tC[i])]);
    B.segment(0xC0, [8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1]);
    const dht = [0x00, ...DC_BITS, ...DC_HOD, 0x10, ...AC_BITS, ...AC_HOD];
    B.segment(0xC4, dht);
    B.segment(0xDA, [3, 1, 0x00, 2, 0x00, 3, 0x00, 0, 63, 0]);
    // entropické kódování
    let akum = 0, nb = 0;
    const out = B.a;
    const zapis = (kod, delka) => {
      akum = (akum << delka) | (kod & ((1 << delka) - 1)); nb += delka;
      while (nb >= 8) { const v = (akum >> (nb - 8)) & 255; out.push(v); if (v === 0xFF) out.push(0); nb -= 8; }
      akum &= (1 << nb) - 1;
    };
    const kat = v => { let a = Math.abs(v), n = 0; while (a) { n++; a >>= 1; } return n; };
    const bity = (v, n) => v < 0 ? v + (1 << n) - 1 : v;
    const pred = [0, 0, 0];
    const nbl = sim.bw * sim.bh;
    for (let i = 0; i < nbl; i++) {
      for (let c = 0; c < 3; c++) {
        const K = sim.koef[c], z = i * 64;
        const dc = K[z] - pred[c]; pred[c] = K[z];
        const s = kat(dc); zapis(HUF_DC[s][0], HUF_DC[s][1]); if (s) zapis(bity(dc, s), s);
        let beh = 0;
        for (let k = 1; k < 64; k++) {
          const v = K[z + ZIG[k]];
          if (v === 0) { beh++; continue; }
          while (beh > 15) { zapis(HUF_AC[0xF0][0], HUF_AC[0xF0][1]); beh -= 16; }
          const s2 = kat(v), sym = (beh << 4) | s2;
          zapis(HUF_AC[sym][0], HUF_AC[sym][1]); zapis(bity(v, s2), s2); beh = 0;
        }
        if (beh) zapis(HUF_AC[0][0], HUF_AC[0][1]);
      }
    }
    if (nb) zapis((1 << (8 - nb)) - 1, 8 - nb);
    out.push(0xFF, 0xD9);
    return { bajty: Uint8Array.from(out), rgba: sim.rgba };
  }

  /** Sestaví obsah APP1 „Exif\0\0“ + TIFF (Intel). Sekce = pole [tag, typ, hodnota]; typ 2 ASCII, 3 SHORT, 4 LONG, 5 RATIONAL ([čitatel, jmenovatel]…), 7 UNDEFINED. */
  function sestavExif(o) {
    const sekce = [['ifd0', o.ifd0 || []], ['exif', o.exif || []], ['gps', o.gps || []], ['ifd1', o.nahled ? (o.ifd1 || []) : []]];
    const hodnotaBajty = (typ, h) => {
      const B = new Bajty(); const le16 = v => { B.u8(v).u8(v >> 8); }, le32 = v => { le16(v & 0xFFFF); le16((v >>> 16) & 0xFFFF); };
      if (typ === 2) { B.text(h + '\0'); }
      else if (typ === 3) [].concat(h).forEach(le16);
      else if (typ === 4) [].concat(h).forEach(v => le32(v));
      else if (typ === 5) { const p = Array.isArray(h[0]) ? h : [h]; p.forEach(([a, d]) => { le32(a); le32(d); }); }
      else B.pole(h);
      return B.a;
    };
    const pocet = (typ, h) => typ === 2 ? h.length + 1 : typ === 5 ? (Array.isArray(h[0]) ? h.length : 1) : typ === 7 ? h.length : [].concat(h).length;
    // doplnit ukazatele do IFD0 a IFD1 (náhled)
    const ifd0 = sekce[0][1].filter(e => e[0] !== 0x8769 && e[0] !== 0x8825);
    if (sekce[1][1].length) ifd0.push([0x8769, 4, 0]);
    if (sekce[2][1].length) ifd0.push([0x8825, 4, 0]);
    sekce[0][1] = ifd0;
    if (o.nahled) sekce[3][1] = sekce[3][1].concat([[0x0103, 3, 6], [0x0201, 4, 0], [0x0202, 4, o.nahled.length]]);
    // rozvržení
    let pozice = 8; const umisteni = {};
    for (const [jm, e] of sekce) {
      if (!e.length) continue;
      e.sort((a, b) => a[0] - b[0]);
      umisteni[jm] = pozice;
      let data = 0; for (const [, typ, h] of e) { const n = hodnotaBajty(typ, h).length; if (n > 4) data += n + (n & 1); }
      pozice += 2 + e.length * 12 + 4 + data;
    }
    const nahledPozice = pozice;
    const T = new Bajty(); T.text('Exif\0\0').text('II').u8(42).u8(0).u8(8).u8(0).u8(0).u8(0);
    const le16 = v => T.u8(v).u8(v >> 8), le32 = v => { le16(v & 0xFFFF); le16((v >>> 16) & 0xFFFF); };
    const poradi = ['ifd0', 'exif', 'gps', 'ifd1'].filter(j => umisteni[j] != null);
    for (const jm of poradi) {
      const e = sekce.find(s => s[0] === jm)[1];
      for (const z of e) {
        if (jm === 'ifd0' && z[0] === 0x8769) z[2] = umisteni.exif;
        if (jm === 'ifd0' && z[0] === 0x8825) z[2] = umisteni.gps;
        if (jm === 'ifd1' && z[0] === 0x0201) z[2] = nahledPozice;
      }
      let datOff = umisteni[jm] + 2 + e.length * 12 + 4;
      const extra = [];
      le16(e.length);
      for (const [tag, typ, h] of e) {
        const hb = hodnotaBajty(typ, h);
        le16(tag); le16(typ); le32(pocet(typ, h));
        if (hb.length <= 4) { T.pole(hb); for (let k = hb.length; k < 4; k++) T.u8(0); }
        else { le32(datOff); extra.push(...hb); if (hb.length & 1) extra.push(0); datOff += hb.length + (hb.length & 1); }
      }
      const dalsi = jm === 'ifd0' && umisteni.ifd1 != null ? umisteni.ifd1 : 0;
      le32(dalsi);
      T.pole(extra);
    }
    if (o.nahled) T.pole(o.nahled);
    return T.a;
  }

  /* ======================= pomocné obrazové funkce ======================= */
  function jas(rgba, w, h) { const L = new Float32Array(w * h); for (let i = 0, p = 0; i < L.length; i++, p += 4) L[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]; return L; }

  /** Změna velikosti průměrem plochy (pro zmenšení; separabilně s částečnými váhami). */
  function zmenRozmer(rgba, w, h, nw, nh) {
    const osa = (n, nn) => { const sx = n / nn, v = []; for (let i = 0; i < nn; i++) { const a = i * sx, b = a + sx, p = []; for (let j = Math.floor(a); j < Math.ceil(b) && j < n; j++) p.push([j, Math.min(b, j + 1) - Math.max(a, j)]); v.push(p); } return v; };
    const ox = osa(w, nw), oy = osa(h, nh);
    const tmp = new Float32Array(nw * h * 4), ven = new Uint8ClampedArray(nw * nh * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < nw; x++) { let s = 0; const a = [0, 0, 0, 0]; for (const [j, v] of ox[x]) { const p = (y * w + j) * 4; for (let c = 0; c < 4; c++) a[c] += rgba[p + c] * v; s += v; } for (let c = 0; c < 4; c++) tmp[(y * nw + x) * 4 + c] = a[c] / s; }
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) { let s = 0; const a = [0, 0, 0, 0]; for (const [j, v] of oy[y]) { const p = (j * nw + x) * 4; for (let c = 0; c < 4; c++) a[c] += tmp[p + c] * v; s += v; } for (let c = 0; c < 4; c++) ven[(y * nw + x) * 4 + c] = Math.round(a[c] / s); }
    return ven;
  }

  /** Otočení pixelů podle EXIF orientace zpět do uloženého stavu (prohlížeč při dekódování orientaci použije). */
  function zrusOrientaci(rgba, w, h, o) {
    if (!o || o === 1) return { rgba, w, h };
    const prohod = o >= 5;
    const W = prohod ? h : w, H = prohod ? w : h; // rozměry uloženého obrázku
    const ven = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      // kam se bod (x, y) uloženého obrázku dostal po aplikaci orientace
      let X, Y;
      switch (o) {
        case 2: X = W - 1 - x; Y = y; break; case 3: X = W - 1 - x; Y = H - 1 - y; break; case 4: X = x; Y = H - 1 - y; break;
        case 5: X = y; Y = x; break; case 6: X = H - 1 - y; Y = x; break; case 7: X = H - 1 - y; Y = W - 1 - x; break; case 8: X = y; Y = W - 1 - x; break;
        default: X = x; Y = y;
      }
      const s = (Y * w + X) * 4, d = (y * W + x) * 4;
      ven[d] = rgba[s]; ven[d + 1] = rgba[s + 1]; ven[d + 2] = rgba[s + 2]; ven[d + 3] = 255;
    }
    return { rgba: ven, w: W, h: H };
  }

  /** Spojité oblasti označených bloků (4-okolí) → [{bloky, x0,y0,x1,y1 (v blocích)}]. */
  function oblastiBloku(oznac, bw, bh, minBloku) {
    const vid = new Uint8Array(bw * bh), ven = [];
    for (let i = 0; i < bw * bh; i++) {
      if (!oznac[i] || vid[i]) continue;
      const fronta = [i]; vid[i] = 1; let n = 0, x0 = bw, y0 = bh, x1 = -1, y1 = -1; const seznam = [];
      while (fronta.length) {
        const j = fronta.pop(), x = j % bw, y = (j / bw) | 0; n++; seznam.push(j);
        if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= bw || Y >= bh) continue;
          const k = Y * bw + X; if (oznac[k] && !vid[k]) { vid[k] = 1; fronta.push(k); }
        }
      }
      if (n >= minBloku) ven.push({ bloku: n, x0, y0, x1, y1, seznam });
    }
    return ven.sort((a, b) => b.bloku - a.bloku);
  }
  const median = a => { const s = Float64Array.from(a).sort(); const n = s.length; return n ? (n & 1 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
  /** Robustní z-skóre (medián, MAD). */
  function robustZ(hod) { const m = median(hod), mad = median(hod.map(v => Math.abs(v - m))) * 1.4826 || 1e-9; return { m, mad, z: hod.map(v => (v - m) / mad) }; }

  /** Míra textury bloku: průměr |L − rozmazané L| (3×3). */
  function texturaBloku(L, w, h, B) {
    const bw = Math.floor(w / B), bh = Math.floor(h / B), T = new Float64Array(bw * bh);
    for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
      let s = 0, n = 0;
      for (let y = Math.max(1, by * B); y < Math.min(h - 1, by * B + B); y++) for (let x = Math.max(1, bx * B); x < Math.min(w - 1, bx * B + B); x++) {
        const i = y * w + x;
        const m = (L[i - w - 1] + L[i - w] + L[i - w + 1] + L[i - 1] + L[i] + L[i + 1] + L[i + w - 1] + L[i + w] + L[i + w + 1]) / 9;
        s += Math.abs(L[i] - m); n++;
      }
      T[by * bw + bx] = n ? s / n : 0;
    }
    return { T, bw, bh };
  }

  /* ======================= ELA ======================= */
  const ELA_B = 16, ELA_KVALITY = [60, 70, 75, 80, 85, 90, 95], ELA_POMER = 2.8, ELA_MIN = 1;
  /** Error level analysis: rozdíl obrázku a jeho přeuložení v kvalitě q (simulace JPEG se standardními tabulkami IJG).
      Mapa = průměr |Δ| přes R, G, B na pixel; bloky 16×16 = průměrná chyba E a poměr E / (textura + 1). */
  function ela(rgba, w, h, q, prubeh, textura) {
    const sim = jpegSimulace(rgba, w, h, tabulkaIJG(IJG_Y, q), tabulkaIJG(IJG_C, q), false, prubeh);
    const mapa = new Float32Array(w * h);
    let soucet = 0;
    for (let i = 0, p = 0; i < mapa.length; i++, p += 4) { const v = (Math.abs(rgba[p] - sim.rgba[p]) + Math.abs(rgba[p + 1] - sim.rgba[p + 1]) + Math.abs(rgba[p + 2] - sim.rgba[p + 2])) / 3; mapa[i] = v; soucet += v; }
    const { T, bw, bh } = textura || texturaBloku(jas(rgba, w, h), w, h, ELA_B);
    const E = new Float64Array(bw * bh);
    for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) { let s = 0; for (let y = by * ELA_B; y < by * ELA_B + ELA_B; y++) for (let x = bx * ELA_B; x < bx * ELA_B + ELA_B; x++) s += mapa[y * w + x]; E[by * bw + bx] = s / (ELA_B * ELA_B); }
    return { mapa, prumer: soucet / mapa.length, kvalita: q, bloky: { E, pomer: Array.from(E, (e, i) => e / (T[i] + 1)), bw, bh, B: ELA_B } };
  }
  const median3x3 = (a, bw, bh) => a.map((_, i) => { const bx = i % bw, by = (i / bw) | 0, v = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = bx + dx, Y = by + dy; if (X >= 0 && Y >= 0 && X < bw && Y < bh) v.push(a[Y * bw + X]); } return median(v); });
  /** Automatické hledání oblasti s odlišnou historií komprese: ELA v kvalitách 60–95 (princip „JPEG ghost“ – oblast
      dříve uložená v kvalitě q má po přeuložení v q malou chybu, cizí oblast ne). Pro každou kvalitu: poměr chyby
      k textuře bloku, medián 3×3 bloků (potlačí osamělé hrany), označeno = poměr ≥ 2,8× medián obrázku a chyba ≥ 1 úroveň
      jasu; oblast = aspoň 2 sousední bloky. Prahy byly nastaveny na galerii ukázek (viz validace – ověřeno i na jiných scénách). */
  function elaHledani(rgba, w, h, prubeh) {
    const tex = texturaBloku(jas(rgba, w, h), w, h, ELA_B), { bw, bh } = tex, oblasti = [], profil = [];
    ELA_KVALITY.forEach((q, j) => {
      const { bloky, prumer } = ela(rgba, w, h, q, prubeh && (p => prubeh((j + p) / ELA_KVALITY.length)), tex);
      const sm = median3x3(bloky.pomer, bw, bh), Esm = median3x3(Array.from(bloky.E), bw, bh), m = median(sm) || 1e-9;
      const oznac = sm.map((v, i) => v >= ELA_POMER * m && Esm[i] >= ELA_MIN ? 1 : 0);
      profil.push({ q, prumer });
      for (const o of oblastiBloku(oznac, bw, bh, 2)) {
        const pomer = Math.max(...o.seznam.map(i => sm[i])) / m;
        oblasti.push({ x: o.x0 * ELA_B, y: o.y0 * ELA_B, w: (o.x1 - o.x0 + 1) * ELA_B, h: (o.y1 - o.y0 + 1) * ELA_B, bloku: o.bloku, seznam: o.seznam, q, pomer });
      }
    });
    // stejná oblast z více kvalit → ponechat tu s největším poměrem
    oblasti.sort((a, b) => b.pomer - a.pomer);
    const ven = [];
    for (const o of oblasti) if (!ven.some(p => o.x < p.x + p.w && p.x < o.x + o.w && o.y < p.y + p.h && p.y < o.y + o.h)) ven.push(o);
    return { oblasti: ven, kvality: ELA_KVALITY, profil, bw, bh, B: ELA_B };
  }

  /* ======================= šum ======================= */
  const SUM_B = 32;
  /** Šumový reziduál (jas − medián 3×3) a lokální odhad šumu σ v blocích 32×32 (Immerkær 1996: maska Laplaceova typu,
      zde medián |odezvy| místo průměru kvůli hranám). Podezřelý blok má σ pod SUM_K × medián σ v okolí 5×5 bloků
      (bez sebe) – hledá se jen „příliš hladké“ místo uprostřed zašuměného okolí (výplň, rozmazání, cizí objekt bez šumu);
      vyšší šum bývá textura. Oblast = aspoň 3 sousední bloky. Velká jednolitá plocha (obloha) se srovnává sama se sebou. */
  const SUM_K = 0.5, SUM_R = 2;
  function sum(rgba, w, h, prubeh) {
    const L = jas(rgba, w, h), rez = new Float32Array(w * h), od = new Float32Array(w * h);
    const s9 = new Float32Array(9);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        let k = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s9[k++] = L[i + dy * w + dx];
        s9.sort(); rez[i] = L[i] - s9[4];
        od[i] = Math.abs(L[i - w - 1] - 2 * L[i - w] + L[i - w + 1] - 2 * L[i - 1] + 4 * L[i] - 2 * L[i + 1] + L[i + w - 1] - 2 * L[i + w] + L[i + w + 1]);
      }
      if (prubeh && (y & 63) === 0) prubeh(y / h);
    }
    const bw = Math.floor(w / SUM_B), bh = Math.floor(h / SUM_B), sigma = new Float64Array(bw * bh);
    const buf = new Float64Array(SUM_B * SUM_B);
    for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
      let n = 0;
      for (let y = Math.max(1, by * SUM_B); y < Math.min(h - 1, by * SUM_B + SUM_B); y++) for (let x = Math.max(1, bx * SUM_B); x < Math.min(w - 1, bx * SUM_B + SUM_B); x++) buf[n++] = od[y * w + x];
      // medián poloviny normálního rozdělení = 0,6745·σ_odezvy, σ_odezvy = 6σ (součet čtverců masky = 36)
      sigma[by * bw + bx] = median(buf.subarray(0, n)) / (0.6745 * 6);
    }
    const okoli = new Float64Array(bw * bh), oznac = new Uint8Array(bw * bh);
    for (let i = 0; i < bw * bh; i++) {
      const bx = i % bw, by = (i / bw) | 0, v = [];
      for (let dy = -SUM_R; dy <= SUM_R; dy++) for (let dx = -SUM_R; dx <= SUM_R; dx++) { const X = bx + dx, Y = by + dy; if ((dx || dy) && X >= 0 && Y >= 0 && X < bw && Y < bh) v.push(sigma[Y * bw + X]); }
      okoli[i] = median(v);
      oznac[i] = sigma[i] < SUM_K * okoli[i] && okoli[i] > 0.3 ? 1 : 0;
    }
    const obl = oblastiBloku(oznac, bw, bh, 3).map(o => ({ x: o.x0 * SUM_B, y: o.y0 * SUM_B, w: (o.x1 - o.x0 + 1) * SUM_B, h: (o.y1 - o.y0 + 1) * SUM_B, bloku: o.bloku, seznam: o.seznam,
      pomer: Math.min(...o.seznam.map(i => sigma[i] / okoli[i])) }));
    return { rezidual: rez, sigma, okoli, bw, bh, B: SUM_B, median: median(Array.from(sigma)), oblasti: obl };
  }

  /* ======================= copy-move ======================= */
  /** Hledání zkopírovaných oblastí ve stejném obrázku (bloková shoda podle Fridrich a kol. 2003, zjednodušeně):
      bloky 16×16 s krokem 1 px (obrázek nad 800 px se zmenší), příznak = 16 průměrů podbloků 4×4 minus průměr bloku, lexikografické řazení,
      porovnání se sousedy v pořadí, shody se seskupí podle posunu. Oblast = posun s aspoň minPar shodami
      a souvislou skupinou bloků. Ploché bloky (malý rozptyl) se vynechávají – v obloze by se „shodovalo“ vše. */
  function klon(rgba, w0, h0, o, prubeh) {
    o = Object.assign({ max: 800, B: 16, krok: 1, minStd: 5, minF: 6, tol: 2.2, okno: 8, minPosun: 32, minPar: 300 }, o || {});
    let w = w0, h = h0, data = rgba, meritko = 1;
    if (Math.max(w, h) > o.max) { meritko = o.max / Math.max(w, h); w = Math.round(w0 * meritko); h = Math.round(h0 * meritko); data = zmenRozmer(rgba, w0, h0, w, h); }
    const L = jas(data, w, h);
    // integrální obraz
    const W1 = w + 1, I = new Float64Array(W1 * (h + 1)), I2 = new Float64Array(W1 * (h + 1));
    for (let y = 0; y < h; y++) { let s = 0, s2 = 0; for (let x = 0; x < w; x++) { const v = L[y * w + x]; s += v; s2 += v * v; I[(y + 1) * W1 + x + 1] = I[y * W1 + x + 1] + s; I2[(y + 1) * W1 + x + 1] = I2[y * W1 + x + 1] + s2; } }
    const souc = (A, x, y, bw, bh) => A[(y + bh) * W1 + x + bw] - A[y * W1 + x + bw] - A[(y + bh) * W1 + x] + A[y * W1 + x];
    const B = o.B, P = B / 4, maxN = Math.ceil((w - B + 1) / o.krok) * Math.ceil((h - B + 1) / o.krok);
    const poz = new Int32Array(2 * maxN), F = new Float32Array(16 * maxN), KV = new Int8Array(16 * maxN);
    let n = 0;
    for (let y = 0; y + B <= h; y += o.krok) for (let x = 0; x + B <= w; x += o.krok) {
      const m = souc(I, x, y, B, B) / (B * B), v = souc(I2, x, y, B, B) / (B * B) - m * m;
      if (v < o.minStd * o.minStd) continue;
      let e2 = 0;
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const f = souc(I, x + i * P, y + j * P, P, P) / (P * P) - m; e2 += f * f; F[n * 16 + j * 4 + i] = f; KV[n * 16 + j * 4 + i] = Math.max(-127, Math.min(127, Math.round(f / 4))); }
      // blok bez struktury podbloků (jednolitá plocha se šumem) by se „shodoval“ náhodně – příznaky v toleranci → vynechat
      if (Math.sqrt(e2 / 16) < o.minF) continue;
      poz[2 * n] = x; poz[2 * n + 1] = y; n++;
    }
    if (prubeh) prubeh(0.3);
    const idx = new Int32Array(n); for (let i = 0; i < n; i++) idx[i] = i;
    idx.sort((a, b) => { for (let k = 0; k < 16; k++) { const d = KV[a * 16 + k] - KV[b * 16 + k]; if (d) return d; } return 0; });
    if (prubeh) prubeh(0.6);
    const posuny = new Map();
    for (let s = 0; s < n; s++) {
      const a = idx[s];
      for (let t = s + 1; t < Math.min(n, s + 1 + o.okno); t++) {
        const b = idx[t];
        let d = 0; for (let k = 0; k < 16 && d <= o.tol; k++) d = Math.max(d, Math.abs(F[a * 16 + k] - F[b * 16 + k]));
        if (d > o.tol) continue;
        let dx = poz[2 * b] - poz[2 * a], dy = poz[2 * b + 1] - poz[2 * a + 1], ax = poz[2 * a], ay = poz[2 * a + 1];
        if (dx < 0 || (dx === 0 && dy < 0)) { dx = -dx; dy = -dy; ax = poz[2 * b]; ay = poz[2 * b + 1]; }
        if (Math.hypot(dx, dy) < o.minPosun) continue;
        const kl = dx + ',' + dy;
        if (!posuny.has(kl)) posuny.set(kl, []);
        posuny.get(kl).push(ax, ay);
      }
    }
    if (prubeh) prubeh(0.85);
    // shluk posunů ±2 px (zmenšení a zaokrouhlení) – posun s největší podporou bere sousední
    const seznam = [...posuny.entries()].map(([k, p]) => { const [dx, dy] = k.split(',').map(Number); return { dx, dy, body: p }; }).sort((a, b) => b.body.length - a.body.length);
    const pouzito = new Set(), shluky = [];
    for (const s of seznam) {
      if (pouzito.has(s.dx + ',' + s.dy)) continue;
      const cl = { dx: s.dx, dy: s.dy, body: [] };
      // sousední posuny hledat v mapě (ne přes celý seznam – posunů bývá desítky tisíc)
      for (let ddy = -2; ddy <= 2; ddy++) for (let ddx = -2; ddx <= 2; ddx++) {
        const kl = (s.dx + ddx) + ',' + (s.dy + ddy), p = posuny.get(kl);
        if (p && !pouzito.has(kl)) { pouzito.add(kl); for (const v of p) cl.body.push(v); }
      }
      if (cl.body.length / 2 >= o.minPar) shluky.push(cl);
    }
    // souvislost: bloky (zdroj) na mřížce B/2, největší komponenta musí mít aspoň minPar/2 bloků a pokrýt ≥ 1 blok B×B
    const G = B / 2, gw = Math.ceil(w / G), gh = Math.ceil(h / G), nalezy = [];
    for (const cl of shluky.slice(0, 6)) {
      const oznac = new Uint8Array(gw * gh);
      for (let k = 0; k < cl.body.length; k += 2) oznac[Math.floor(cl.body[k + 1] / G) * gw + Math.floor(cl.body[k] / G)] = 1;
      const kom = oblastiBloku(oznac, gw, gh, 1)[0];
      if (!kom || kom.bloku < 6) continue;
      const k = 1 / meritko, x0 = kom.x0 * G, y0 = kom.y0 * G, x1 = (kom.x1 + 1) * G + B - G, y1 = (kom.y1 + 1) * G + B - G;
      nalezy.push({ dx: Math.round(cl.dx * k), dy: Math.round(cl.dy * k), par: cl.body.length / 2,
        zdroj: { x: Math.round(x0 * k), y: Math.round(y0 * k), w: Math.round((x1 - x0) * k), h: Math.round((y1 - y0) * k) },
        cil: { x: Math.round((x0 + cl.dx) * k), y: Math.round((y0 + cl.dy) * k), w: Math.round((x1 - x0) * k), h: Math.round((y1 - y0) * k) },
        body: cl.body.slice(0, 4000).map(v => Math.round(v * k)) });
    }
    return { nalezy, bloku: n, meritko, w, h, B, parametry: o };
  }

  /* ======================= dvojitá kvantizace ======================= */
  /** Histogramy DCT koeficientů jasu na mřížce 8×8 dělené krokem z poslední kvantizační tabulky souboru.
      Po jedné kompresi je histogram hladký (≈ Laplaceův); po dvojí s hrubším prvním krokem (q1 > q2) vzniknou
      periodicky prázdné nebo zesílené přihrádky. Míra = podíl „propadů“ (h[n] < 0,5·min sousedů, sousedé ≥ 30 bloků)
      mezi posuzovanými přihrádkami prvních 9 AC pozic s krokem ≥ 2. Nalezeno, když propadů ≥ 3 a tvoří ≥ 20 % posuzovaných přihrádek. */
  function dvojita(rgba, w, h, tabY) {
    const bw = Math.floor(w / 8), bh = Math.floor(h / 8);
    const L = new Float64Array(64), F = new Float64Array(64), t = new Float64Array(64);
    const POZ = ZIG.slice(1, 10), N = 40, hist = POZ.map(() => new Int32Array(2 * N + 1));
    for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
      for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) { const p = ((by * 8 + yy) * w + bx * 8 + xx) * 4; L[yy * 8 + xx] = Math.round(0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]) - 128; }
      fdct(L, F, t);
      POZ.forEach((k, j) => { const v = Math.round(F[k] / tabY[k]); if (v >= -N && v <= N) hist[j][v + N]++; });
    }
    let posuz = 0, propady = 0; const detail = [];
    POZ.forEach((k, j) => {
      if (tabY[k] < 2) { detail.push({ pozice: k, krok: tabY[k], vynechano: true }); return; }
      const hh = hist[j]; let p = 0, s = 0;
      for (let n = 2; n < N; n++) for (const zn of [-1, 1]) {
        const i = N + zn * n, a = hh[i - 1], b = hh[i + 1], m = Math.min(a, b);
        if (m < 30) continue;
        s++; if (hh[i] < 0.5 * m) p++;
      }
      posuz += s; propady += p;
      detail.push({ pozice: k, krok: tabY[k], posuzovano: s, propadu: p });
    });
    const podil = posuz ? propady / posuz : 0;
    return { hist: hist.map(a => Array.from(a)), pozice: POZ, N, posuzovano: posuz, propadu: propady, podil, nalezena: propady >= 3 && podil >= 0.2, detail, bloku: bw * bh };
  }

  /* ======================= náhled EXIF ======================= */
  /** Porovná náhled s hlavním obrázkem: oříznutí černých pruhů náhledu, zmenšení obrázku na velikost náhledu,
      průměrná a lokální (okno 6×6 px náhledu) odchylka RGB a poměr stran. */
  function porovnejNahled(hl, nh) {
    // černé pruhy (letterbox) – řádky/sloupce s průměrem < 10
    const radekJas = (y) => { let s = 0; for (let x = 0; x < nh.w; x++) { const p = (y * nh.w + x) * 4; s += nh.rgba[p] + nh.rgba[p + 1] + nh.rgba[p + 2]; } return s / (3 * nh.w); };
    const sloupecJas = (x, y0, y1) => { let s = 0; for (let y = y0; y < y1; y++) { const p = (y * nh.w + x) * 4; s += nh.rgba[p] + nh.rgba[p + 1] + nh.rgba[p + 2]; } return s / (3 * (y1 - y0)); };
    let y0 = 0, y1 = nh.h, x0 = 0, x1 = nh.w;
    while (y0 < y1 - 4 && radekJas(y0) < 10) y0++; while (y1 > y0 + 4 && radekJas(y1 - 1) < 10) y1--;
    while (x0 < x1 - 4 && sloupecJas(x0, y0, y1) < 10) x0++; while (x1 > x0 + 4 && sloupecJas(x1 - 1, y0, y1) < 10) x1--;
    const cw = x1 - x0, ch = y1 - y0;
    const pomerN = cw / ch, pomerH = hl.w / hl.h, rozdilPomeru = Math.abs(pomerN / pomerH - 1);
    const zm = zmenRozmer(hl.rgba, hl.w, hl.h, cw, ch);
    const rozdil = new Float32Array(cw * ch);
    let s = 0;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const p = ((y + y0) * nh.w + x + x0) * 4, q = (y * cw + x) * 4;
      const d = (Math.abs(nh.rgba[p] - zm[q]) + Math.abs(nh.rgba[p + 1] - zm[q + 1]) + Math.abs(nh.rgba[p + 2] - zm[q + 2])) / 3;
      rozdil[y * cw + x] = d; s += d;
    }
    const O = 6; let lok = 0, lx = 0, ly = 0;
    for (let y = 0; y + O <= ch; y += 2) for (let x = 0; x + O <= cw; x += 2) { let a = 0; for (let j = 0; j < O; j++) for (let i = 0; i < O; i++) a += rozdil[(y + j) * cw + x + i]; a /= O * O; if (a > lok) { lok = a; lx = x; ly = y; } }
    const prumer = s / (cw * ch);
    const nalezena = rozdilPomeru > 0.03 || prumer > 12 || lok > 30;
    return { prumer, lokalniMax: lok, misto: { x: (lx + O / 2) / cw, y: (ly + O / 2) / ch }, rozdilPomeru, rozdil, w: cw, h: ch, orez: { x0, y0, x1, y1 }, zmenseny: zm, nalezena };
  }

  /* ======================= souhrnné verdikty ======================= */
  /** Verdikty jednotlivých analýz (text pro tabulku validace i shrnutí). */
  function verdikty(v) {
    const ven = {};
    if (v.ela) ven.ela = v.ela.oblasti.length ? 'nalezena' : 'nenalezena';
    if (v.sum) ven.sum = v.sum.oblasti.length ? 'nalezena' : 'nenalezena';
    if (v.klon) ven.klon = v.klon.nalezy.length ? 'nalezena' : 'nenalezena';
    if (v.metadata) ven.metadata = v.metadata.some(i => i.oblast === 'metadata' && i.vaha >= 2) ? 'nalezena' : 'nenalezena';
    if ('nahled' in v) ven.nahled = v.nahled ? (v.nahled.nalezena ? 'nalezena' : 'nenalezena') : 'nelze';
    if (v.dvojita) ven.dvojita = v.dvojita.nalezena ? 'nalezena' : 'nenalezena';
    return ven;
  }

  /** Indicie z obrazových analýz (stejný formát jako indicieMetadat). */
  function indicieObrazu(v) {
    const ind = [], pridej = (vaha, oblast, text, vysvetleni) => ind.push({ vaha, oblast, text, vysvetleni });
    const pr = x => Math.round(x * 10) / 10;
    if (v.nahled) {
      const n = v.nahled;
      if (n.rozdilPomeru > 0.03) pridej(2, 'náhled', `Poměr stran náhledu v EXIF se liší od obrázku o ${Math.round(n.rozdilPomeru * 100)} %.`, 'Obrázek byl po pořízení nejspíš ořezán a náhled zůstal z originálu.');
      if (n.prumer > 12 || n.lokalniMax > 30) pridej(3, 'náhled', `Náhled v EXIF neodpovídá obsahu obrázku (průměrná odchylka ${pr(n.prumer)}, místně až ${pr(n.lokalniMax)} z 255).`, 'Program změnil obrázek, ale náhled nepřepsal – náhled ukazuje dřívější stav. Silná indicie úpravy obsahu (nebo náhledu).');
    }
    if (v.ela && v.ela.oblasti.length) {
      const o = v.ela.oblasti[0];
      pridej(2, 'ELA', `ELA: oblastí s odlišnou chybou po přeuložení: ${v.ela.oblasti.length} (nejvýrazněji v kvalitě ${o.q}, ${pr(o.pomer)}× medián obrázku).`, 'Může jít o vloženou nebo jinak komprimovanou oblast. Stejně se ale chovají ostré kontrastní detaily – posuďte vrstvu ELA okem.');
    }
    if (v.sum && v.sum.oblasti.length) {
      const o = v.sum.oblasti[0];
      pridej(2, 'šum', `Šum: oblastí výrazně hladších než okolí: ${v.sum.oblasti.length} (nejhladší má ${Math.round(o.pomer * 100)} % šumu okolí).`, 'Výplň, rozmazání (retuš) nebo vložený objekt bez šumu senzoru. Stejně působí rozostřené pozadí nebo hladký předmět.');
    }
    if (v.klon && v.klon.nalezy.length) {
      const k = v.klon.nalezy[0];
      pridej(3, 'klonování', `Klonování: shodné oblasti posunuté o ${k.dx}, ${k.dy} px (${k.par} shodných bloků; různých posunů: ${v.klon.nalezy.length}).`, 'Část obrázku je kopií jiné části (zakrytí nebo zdvojení předmětu). Falešně u opakujících se vzorů (okna, dlaždice).');
    }
    if (v.dvojita && v.dvojita.nalezena) pridej(1, 'struktura', `Známky dvojité komprese JPEG (${v.dvojita.propadu} propadů v histogramech DCT).`, 'Soubor byl uložen jako JPEG nejméně dvakrát, napoprvé v nižší kvalitě. Znamená přeuložení (editor, aplikace), ne nutně změnu obsahu.');
    return ind;
  }

  /* ======================= syntetické ukázky ======================= */
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hash2(x, y, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  function sum2(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
  function fbm(x, y, s, okt) { let a = 0, amp = 0.5, f = 1; for (let i = 0; i < okt; i++) { a += amp * sum2(x * f, y * f, s + i * 101); f *= 2; amp *= 0.5; } return a / (1 - Math.pow(0.5, okt)); }

  /** Procedurální „fotka“ krajiny s domem, stromem a (volitelně) červeným autem. Souřadnice scény 640×480. */
  function scena(w, h, seed, o) {
    o = Object.assign({ auto: true, sum: 2.2 }, o || {});
    const rgba = new Uint8ClampedArray(w * h * 4), R = rng(seed * 7919 + 1), sx = 640 / w, sy = 480 / h;
    const gauss = () => { const u = R() || 1e-9, v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const S = seed * 31;
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const x = (px + 0.5) * sx, y = (py + 0.5) * sy;
      let c;
      const kopec = 228 + 22 * Math.sin(x / 90 + seed) + 18 * fbm(x / 70, 0.5, S + 1, 3);
      if (y < kopec) { // obloha s mraky
        const t = y / kopec; c = [70 + 95 * t, 125 + 75 * t, 200 + 35 * t];
        const m = fbm(x / 140, y / 55, S + 2, 5); if (m > 0.52) { const a = Math.min(1, (m - 0.52) * 3.2); c = c.map(v => v + (245 - v) * a); }
      } else if (y < 300) { const f = 0.75 + 0.45 * fbm(x / 14, y / 14, S + 3, 4); c = [55 * f, 95 * f, 58 * f]; }
      else { // tráva s cestou
        const f = 0.7 + 0.5 * fbm(x / 5, y / 2.5, S + 4, 4), g = 0.85 + 0.3 * fbm(x / 40, y / 30, S + 5, 3);
        c = [88 * f * g, 138 * f * g, 58 * f * g];
        const cesta = Math.abs(x - (320 + (y - 300) * 1.4 + 20 * Math.sin(y / 30))) < 14 + (y - 300) * 0.25;
        if (cesta) { const d = 0.8 + 0.35 * fbm(x / 4, y / 4, S + 6, 3); c = [150 * d, 128 * d, 96 * d]; }
      }
      // dům
      if (x >= 360 && x < 520 && y >= 190 && y < 320) {
        const rada = Math.floor(y / 9), off = (rada & 1) * 9, f = 0.8 + 0.35 * fbm(x / 6, y / 6, S + 7, 3);
        c = ((y % 9) < 1.4 || ((x + off) % 18) < 1.4) ? [196 * f, 192 * f, 180 * f] : [172 * f, 92 * f, 70 * f];
        for (const wx of [378, 428, 478]) if (x >= wx && x < wx + 28 && y >= 214 && y < 246) {
          const ram = x < wx + 3 || x >= wx + 25 || y < 217 || y >= 243 || Math.abs(x - wx - 14) < 1.2;
          c = ram ? [235, 232, 225] : [50 + 40 * (y - 214) / 32 + 30 * fbm(x / 9, y / 9, S + 8 + wx, 3), 70 + 40 * fbm(x / 7, y / 11, S + 9 + wx, 3), 105 + 30 * (y - 214) / 32];
        }
        if (x >= 440 && x < 468 && y >= 268 && y < 320) { const d = 0.75 + 0.4 * fbm(x / 3, y / 20, S + 10, 3); c = [110 * d, 70 * d, 40 * d]; }
      }
      if (y < 190 && y >= 128 && Math.abs(x - 440) < (y - 128) * 1.45 + 2) { const t = 0.8 + 0.3 * fbm(x / 5, y / 5, S + 11, 3); c = ((y - 128) % 8 < 1.3) ? [90 * t, 40 * t, 35 * t] : [150 * t, 55 * t, 42 * t]; }
      // strom
      if (x >= 102 && x < 122 && y >= 255 && y < 335) { const t = 0.7 + 0.5 * fbm(x / 3, y / 12, S + 12, 3); c = [95 * t, 66 * t, 42 * t]; }
      const dk = Math.hypot(x - 112, y - 230) / (52 + 8 * fbm(x / 20, y / 20, S + 13, 3));
      if (dk < 1) { const t = (0.55 + 0.6 * fbm(x / 6, y / 6, S + 14, 4)) * (1.05 - 0.4 * dk); c = [50 * t, 105 * t, 45 * t]; }
      // auto
      if (o.auto) {
        const v = (x >= 200 && x < 290 && y >= 340 && y < 368) || (x >= 220 && x < 268 && y >= 322 && y < 342);
        if (v) {
          const sklo = x >= 226 && x < 262 && y >= 326 && y < 340;
          const t = 0.85 + 0.25 * (1 - (y - 322) / 46) + 0.1 * fbm(x / 10, y / 10, S + 15, 2);
          c = sklo ? [70 + 40 * fbm(x / 6, y / 6, S + 16, 2), 90, 120] : [195 * t, 30 * t, 35 * t];
        }
        for (const kx of [218, 272]) if (Math.hypot(x - kx, y - 368) < 11) c = Math.hypot(x - kx, y - 368) < 5 ? [150, 150, 155] : [25, 25, 28];
      }
      const p = (py * w + px) * 4;
      rgba[p] = c[0] + o.sum * gauss(); rgba[p + 1] = c[1] + o.sum * gauss(); rgba[p + 2] = c[2] + o.sum * gauss(); rgba[p + 3] = 255;
    }
    return rgba;
  }

  /** Vložený objekt: modrá dodávka s hladkým lakem (jiný zdroj, téměř bez šumu). Vrací {rgba, maska} velikosti w×h. */
  function objektDodavka(w, h) {
    const rgba = new Uint8ClampedArray(w * h * 4), maska = new Uint8Array(w * h), R = rng(99);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h; let c = null;
      if (v > 0.25 && v < 0.82) c = [40 + 60 * (1 - v), 80 + 70 * (1 - v), 170 + 50 * (1 - v)];
      if (v > 0.05 && v <= 0.25 && u > 0.08 && u < 0.62) c = [45, 85, 175];
      if (v > 0.1 && v < 0.27 && u > 0.14 && u < 0.56) c = [175 + 50 * u, 205, 230];
      if (v > 0.45 && v < 0.5) c = [235, 235, 240];
      [[0.22, 0.17, 0.07], [0.78, 0.15, 0.1]].forEach(([kx, r1, r2], j) => { const d = Math.hypot((u - kx) * w, (v - 0.82) * h); if (d < h * r1) c = d < h * r2 ? [180 - 40 * j, 175, 185] : [20 + 15 * j, 20, 22 + 10 * j]; });
      if (!c) continue;
      const p = (y * w + x) * 4;
      rgba[p] = c[0] + 0.4 * (R() - 0.5); rgba[p + 1] = c[1] + 0.4 * (R() - 0.5); rgba[p + 2] = c[2] + 0.4 * (R() - 0.5); rgba[p + 3] = 255; maska[y * w + x] = 1;
    }
    return { rgba, maska };
  }

  // tabulka „fotoaparátu“: odvozená z IJG, ale nestandardní (jako u výrobců)
  const kameraTab = (zakl, q) => tabulkaIJG(zakl, q).map((v, i) => Math.max(1, v + ((i * 7) % 3) - 1));
  const kameraKoduj = (rgba, w, h, q, exif) => kodujJpeg(rgba, w, h, { tabY: kameraTab(IJG_Y, q), tabC: kameraTab(IJG_C, q), exif, jfif: false });

  const DNY = { vznik: '2026:06:14 10:21:33' };
  function exifKamery(w, h, o) {
    o = o || {};
    const ifd0 = [[0x010F, 2, 'Aurora Optics'], [0x0110, 2, 'AX-20'], [0x0112, 3, o.orientace || 1], [0x011A, 5, [72, 1]], [0x011B, 5, [72, 1]], [0x0128, 3, 2],
      [0x0131, 2, o.software || 'AX-20 Firmware 1.02'], [0x0132, 2, o.zmena || DNY.vznik]];
    const exif = [[0x829A, 5, [1, 250]], [0x829D, 5, [56, 10]], [0x8827, 3, 100], [0x9000, 7, [0x30, 0x32, 0x33, 0x32]], [0x9003, 2, DNY.vznik], [0x9004, 2, DNY.vznik],
      [0x9011, 2, '+02:00'], [0x920A, 5, [240, 10]], [0xA001, 3, 1], [0xA002, 4, o.px || w], [0xA003, 4, o.py || h]];
    const gps = [[0x0000, 1, [2, 3, 0, 0]], [0x0001, 2, 'N'], [0x0002, 5, [[50, 1], [5, 1], [2310, 100]]], [0x0003, 2, 'E'], [0x0004, 5, [[14, 1], [25, 1], [4420, 100]]]];
    return { ifd0, exif, gps };
  }
  function sNahledem(m, rgba, w, h, nahledRgba) {
    const tw = 160, th = Math.round(160 * h / w);
    const n = kodujJpeg(nahledRgba || zmenRozmer(rgba, w, h, tw, th), tw, th, { kvalita: 80, jfif: false });
    return { exif: sestavExif(Object.assign({}, m, { nahled: n.bajty, ifd1: [[0x0100, 4, tw], [0x0101, 4, th]] })), nahled: { rgba: n.rgba, w: tw, h: th } };
  }
  const prazdnaMaska = (w, h) => new Uint8Array(w * h);
  const obdelnik = (w, h, x, y, ow, oh) => { const m = prazdnaMaska(w, h); for (let j = y; j < y + oh; j++) for (let i = x; i < x + ow; i++) m[j * w + i] = 1; return m; };

  const UKAZKY = [
    { klic: 'cista', nazev: 'Neupravená fotka z fotoaparátu', popis: 'Jedna komprese s vlastními tabulkami fotoaparátu, úplné EXIF s GPS a náhledem, který odpovídá obsahu.',
      co: 'Kontrola falešného poplachu: žádná analýza by neměla najít indicii.', pravda: { ela: 'nenalezena', sum: 'nenalezena', klon: 'nenalezena', metadata: 'nenalezena', nahled: 'nenalezena', dvojita: 'nenalezena' } },
    { klic: 'vlozeny', nazev: 'Vložený objekt z jiného JPEG', popis: 'Fotka (kvalita ≈ 75, tabulky fotoaparátu) + modrá dodávka z jiného zdroje (JPEG kvalita 97, téměř bez šumu), vložená mimo mřížku 8×8, uloženo editorem v kvalitě 88 bez EXIF.',
      co: 'ELA a mapa šumu mají ukázat dodávku; dvojitá komprese podkladu (75 → 88).', pravda: { ela: 'nalezena', sum: 'nalezena', klon: 'nenalezena', metadata: 'nenalezena', nahled: 'nelze', dvojita: 'nalezena' } },
    { klic: 'klon', nazev: 'Zklonovaná oblast (zakryté auto)', popis: 'Červené auto zakryto kusem trávy zkopírovaným z jiného místa téže fotky (posun 164, −73 px – mimo mřížku 8×8), uloženo v kvalitě 92 bez EXIF.',
      co: 'Copy-move má najít dvojici oblastí se stejným posunem. ELA kopii z téže fotky nevidí – má stejnou historii komprese.', pravda: { ela: 'nalezena', sum: 'nenalezena', klon: 'nalezena', metadata: 'nenalezena', nahled: 'nelze', dvojita: 'nalezena' } },
    { klic: 'software', nazev: 'Metadata: software editoru', popis: 'Celková úprava jasu a kontrastu, uloženo editorem (Software = Adobe Photoshop, pozdější datum změny, XMP s historií); náhled přegenerován.',
      co: 'Indicie v metadatech (software, rozdíl dat); obsah upraven jen globálně.', pravda: { ela: 'nenalezena', sum: 'nenalezena', klon: 'nenalezena', metadata: 'nalezena', nahled: 'nenalezena', dvojita: 'nalezena' } },
    { klic: 'rozmery', nazev: 'Zmenšeno bez úpravy EXIF', popis: 'Originál 800 × 600 zmenšen na 640 × 480 a uložen; EXIF (PixelXDimension 800 × 600) i náhled zůstaly z originálu.',
      co: 'Rozpor rozměrů v EXIF a skutečných. Převzorkování smaže stopu první komprese.', pravda: { ela: 'nenalezena', sum: 'nenalezena', klon: 'nenalezena', metadata: 'nalezena', nahled: 'nenalezena', dvojita: 'nenalezena' } },
    { klic: 'nahled', nazev: 'Náhled EXIF neodpovídá obsahu', popis: 'Auto z fotky odstraněno rozmazanou výplní bez šumu; nástroj zachoval původní EXIF i s náhledem, kde auto stále je. Uloženo v kvalitě 95.',
      co: 'Porovnání náhledu ukáže místo, kde se obsah liší; mapa šumu hladkou výplň. ELA hladkou výplň nevidí.', pravda: { ela: 'nalezena', sum: 'nalezena', klon: 'nenalezena', metadata: 'nenalezena', nahled: 'nalezena', dvojita: 'nalezena' } },
    { klic: 'dvojita', nazev: 'Dvojitá komprese (60 → 85)', popis: 'Obrázek z webu v kvalitě 60 znovu uložen v kvalitě 85, bez jiné změny a bez EXIF.',
      co: 'Histogramy DCT koeficientů mají periodické propady; jinak nic.', pravda: { ela: 'nenalezena', sum: 'nenalezena', klon: 'nenalezena', metadata: 'nenalezena', nahled: 'nelze', dvojita: 'nalezena' } }
  ];

  /** Vytvoří ukázku (varianta > 0 = jiná scéna, tytéž úpravy – pro nezávislé ověření prahů): {bajty (JPEG), rgba (dekódováno), w, h, nahled {rgba,w,h}|null, maska, posun?, pravda}. */
  function vytvorUkazku(klic, varianta) {
    const V = 10 * (varianta || 0);
    const w = 640, h = 480, u = UKAZKY.find(x => x.klic === klic);
    if (!u) throw new Error('neznámá ukázka ' + klic);
    let vysl;
    if (klic === 'cista') {
      const s = scena(w, h, 1 + V);
      const { exif, nahled } = sNahledem(exifKamery(w, h), s, w, h);
      const j = kameraKoduj(s, w, h, 92, exif);
      vysl = { ...j, nahled, maska: prazdnaMaska(w, h) };
    } else if (klic === 'vlozeny') {
      const s = kameraKoduj(scena(w, h, 2 + V, { auto: false }), w, h, 75).rgba;
      const ow = 132, oh = 70, ox = 243, oy = 371, d = objektDodavka(ow, oh);
      const dj = kodujJpeg(d.rgba, ow, oh, { kvalita: 97 }).rgba, maska = prazdnaMaska(w, h);
      for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) if (d.maska[y * ow + x]) { const p = ((oy + y) * w + ox + x) * 4, q = (y * ow + x) * 4; s[p] = dj[q]; s[p + 1] = dj[q + 1]; s[p + 2] = dj[q + 2]; maska[(oy + y) * w + ox + x] = 1; }
      vysl = { ...kodujJpeg(s, w, h, { kvalita: 88 }), nahled: null, maska };
    } else if (klic === 'klon') {
      const s = kameraKoduj(scena(w, h, 3 + V), w, h, 80).rgba;
      const sx = 30, sy = 395, dx = 194, dy = 322, cw = 106, ch = 60;
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const p = ((dy + y) * w + dx + x) * 4, q = ((sy + y) * w + sx + x) * 4; s[p] = s[q]; s[p + 1] = s[q + 1]; s[p + 2] = s[q + 2]; }
      vysl = { ...kodujJpeg(s, w, h, { kvalita: 92 }), nahled: null, maska: obdelnik(w, h, dx, dy, cw, ch), posun: { dx: sx - dx, dy: sy - dy }, zdroj: { x: sx, y: sy, w: cw, h: ch } };
    } else if (klic === 'software') {
      const orig = kameraKoduj(scena(w, h, 4 + V), w, h, 85).rgba;
      const s = new Uint8ClampedArray(orig.length);
      for (let i = 0; i < s.length; i++) s[i] = (i & 3) === 3 ? 255 : (orig[i] - 128) * 1.08 + 128 + 8;
      const m = exifKamery(w, h, { software: 'Adobe Photoshop 25.0 (Windows)', zmena: '2026:06:20 18:02:11' });
      const { exif, nahled } = sNahledem(m, s, w, h);
      const xmp = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/" xmlns:stEvt="http://ns.adobe.com/xap/1.0/sType/ResourceEvent#"'
        + ' xmp:CreatorTool="Adobe Photoshop 25.0 (Windows)" xmp:CreateDate="2026-06-14T10:21:33" xmp:ModifyDate="2026-06-20T18:02:11" xmpMM:DocumentID="xmp.did:b7" xmpMM:OriginalDocumentID="xmp.did:a1">'
        + '<xmpMM:History><rdf:Seq><rdf:li stEvt:action="saved" stEvt:softwareAgent="Adobe Photoshop 25.0 (Windows)"/></rdf:Seq></xmpMM:History></rdf:Description></rdf:RDF></x:xmpmeta>';
      vysl = { ...kodujJpeg(s, w, h, { kvalita: 90, exif, xmp }), nahled, maska: prazdnaMaska(w, h) };
    } else if (klic === 'rozmery') {
      const W = 800, H = 600, s0 = scena(W, H, 5 + V);
      const { exif, nahled } = sNahledem(exifKamery(W, H), s0, W, H);
      const j0 = kameraKoduj(s0, W, H, 90);
      const s = zmenRozmer(j0.rgba, W, H, w, h);
      vysl = { ...kodujJpeg(s, w, h, { kvalita: 90, exif }), nahled, maska: prazdnaMaska(w, h) };
    } else if (klic === 'nahled') {
      const s0 = scena(w, h, 6 + V);
      const { exif, nahled } = sNahledem(exifKamery(w, h), s0, w, h);
      const s = kameraKoduj(s0, w, h, 85).rgba, maska = prazdnaMaska(w, h);
      // výplň: silně rozmazaný pruh trávy pod autem, bez šumu
      const x0 = 190, y0 = 314, x1 = 300, y1 = 382, ref = [0, 0, 0]; let n = 0;
      for (let y = 386; y < 410; y++) for (let x = x0; x < x1; x++) { const p = (y * w + x) * 4; ref[0] += s[p]; ref[1] += s[p + 1]; ref[2] += s[p + 2]; n++; }
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const p = (y * w + x) * 4, t = 0.95 + 0.08 * fbm(x / 30, y / 30, 77, 2);
        s[p] = ref[0] / n * t; s[p + 1] = ref[1] / n * t; s[p + 2] = ref[2] / n * t; maska[y * w + x] = 1;
      }
      vysl = { ...kodujJpeg(s, w, h, { kvalita: 95, exif }), nahled, maska };
    } else if (klic === 'dvojita') {
      const s = kodujJpeg(scena(w, h, 7 + V), w, h, { kvalita: 60 }).rgba;
      vysl = { ...kodujJpeg(s, w, h, { kvalita: 85 }), nahled: null, maska: prazdnaMaska(w, h) };
    }
    return Object.assign(vysl, { w, h, klic, nazev: u.nazev, pravda: u.pravda });
  }

  /** Všechny analýzy nad dekódovaným obrázkem (rgba v uloženém stavu, bez orientace). */
  function analyzujVse(vstup, o, prubeh) {
    o = Object.assign({ kvalitaEla: 90 }, o || {});
    const { rgba, w, h, rozbor } = vstup, v = {};
    const krok = (jm, od, do_) => p => prubeh && prubeh(jm, od + (do_ - od) * p);
    const jpeg = rozbor && rozbor.typ === 'jpeg';
    if (jpeg) { v.ela = elaHledani(rgba, w, h, krok('ela', 0, 0.45)); v.elaMapa = ela(rgba, w, h, o.kvalitaEla); }
    v.sum = sum(rgba, w, h, krok('sum', 0.45, 0.55));
    v.klon = klon(rgba, w, h, null, krok('klon', 0.55, 0.9));
    if (jpeg && rozbor.dqt.length) { const t = (rozbor.dqt.find(d => d.id === (rozbor.sof && rozbor.sof.slozky[0] ? rozbor.sof.slozky[0].tq : 0)) || rozbor.dqt[0]).hodnoty; v.dvojita = dvojita(rgba, w, h, t); }
    if (prubeh) prubeh('hotovo', 1);
    return v;
  }

  const api = {
    ZIG, IJG_Y, IJG_C, tabulkaIJG, odhadKvality, rozborSouboru, ctiTiff, rozborXmp, indicieMetadat, EDITORY,
    jpegSimulace, kodujJpeg, sestavExif, jas, zmenRozmer, zrusOrientaci, oblastiBloku, robustZ, median,
    ela, elaHledani, ELA_KVALITY, sum, klon, dvojita, porovnejNahled, verdikty, analyzujVse, indicieObrazu,
    scena, UKAZKY, vytvorUkazku, kameraTab, rng, fdct, idct
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else koren.PRAVOST = api;
})(typeof self !== 'undefined' ? self : this);

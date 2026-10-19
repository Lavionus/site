/* ============================================================
   zaplavy/rastry.js – čtení výškových rastrů bez knihoven.
   Čistý modul bez DOM (testuje se v node).

   • GeoTIFF / BigTIFF: pruhy i dlaždice, little/big endian, komprese
     žádná / LZW / Deflate (zlib, přes DecompressionStream) / PackBits,
     prediktor 2 (vodorovný) i 3 (plovoucí čárka), int8–int32, uint8–uint32,
     float32/64; čte jen první pásmo. Řídké dlaždice (délka 0) = bez dat.
     Georeference: ModelPixelScale + ModelTiepoint, nebo ModelTransformation;
     systém z GeoKeyDirectory (ProjectedCSType / GeographicType / citace).
   • ESRI ASCII grid (.asc): xll/yllcorner i center, cellsize i dx/dy, NODATA.
   • Zápis GeoTIFF float32 (bez komprese) pro export hloubek.

   Výstup čtení: { sirka, vyska, data: Float32Array (řádky shora, NaN = bez dat),
     afinni: [x0, dx, rx, y0, ry, dy] (GDAL: X = x0 + sl·dx + ř·rx, Y = y0 + sl·ry + ř·dy,
     roh levého horního pixelu), epsg, popisCrs, vertikal, nodata, info }
   ============================================================ */
(function () {
  'use strict';

  // ---------- dekomprese ----------
  function lzwDekoduj(vstup, ocekavano) {
    const out = new Uint8Array(ocekavano || vstup.length * 4);
    let op = 0, bit = 0, sirka = 9;
    const delkaBitu = vstup.length * 8;
    // slovník: pro každý kód předchůdce + poslední bajt + délka
    const MAX = 4096;
    const pred = new Int32Array(MAX), last = new Uint8Array(MAX), delka = new Int32Array(MAX), prvni = new Uint8Array(MAX);
    for (let i = 0; i < 256; i++) { pred[i] = -1; last[i] = i; delka[i] = 1; prvni[i] = i; }
    let dalsi = 258, stary = -1;
    let buf = out;
    function zajisti(n) {
      if (op + n <= buf.length) return;
      const nb = new Uint8Array(Math.max(buf.length * 2, op + n)); nb.set(buf); buf = nb;
    }
    function zapis(kod) {
      const d = delka[kod]; zajisti(d);
      let k = kod;
      for (let i = d - 1; i >= 0; i--) { buf[op + i] = last[k]; k = pred[k]; }
      op += d;
    }
    function cti() {
      if (bit + sirka > delkaBitu) return 257;
      let v = 0;
      for (let i = 0; i < sirka; i++) {
        const b = bit + i;
        v = (v << 1) | ((vstup[b >> 3] >> (7 - (b & 7))) & 1);
      }
      bit += sirka; return v;
    }
    for (;;) {
      let kod = cti();
      if (kod === 257) break;
      if (kod === 256) {
        sirka = 9; dalsi = 258;
        kod = cti();
        if (kod === 257) break;
        if (kod > 255) throw new Error('LZW: poškozená data');
        zapis(kod); stary = kod; continue;
      }
      if (stary < 0) throw new Error('LZW: chybí úvodní kód');
      if (kod < dalsi) {
        zapis(kod);
        if (dalsi < MAX) { pred[dalsi] = stary; last[dalsi] = prvni[kod]; delka[dalsi] = delka[stary] + 1; prvni[dalsi] = prvni[stary]; dalsi++; }
      } else if (kod === dalsi) {
        if (dalsi < MAX) { pred[dalsi] = stary; last[dalsi] = prvni[stary]; delka[dalsi] = delka[stary] + 1; prvni[dalsi] = prvni[stary]; dalsi++; }
        zapis(kod);
      } else throw new Error('LZW: neplatný kód ' + kod);
      stary = kod;
      if (dalsi + 1 >= (1 << sirka) && sirka < 12) sirka++;
    }
    return buf.subarray(0, op);
  }
  function packbits(vstup, ocekavano) {
    const out = new Uint8Array(ocekavano); let i = 0, o = 0;
    while (i < vstup.length && o < ocekavano) {
      const n = (vstup[i] << 24) >> 24; i++;
      if (n >= 0) { for (let k = 0; k <= n; k++) out[o++] = vstup[i++]; }
      else if (n !== -128) { const v = vstup[i++]; for (let k = 0; k < 1 - n; k++) out[o++] = v; }
    }
    return out;
  }
  async function inflate(vstup) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Prohlížeč neumí Deflate (DecompressionStream) – převeďte soubor na LZW nebo bez komprese.');
    const ds = new DecompressionStream('deflate');
    const w = ds.writable.getWriter(); w.write(vstup); w.close();
    const r = ds.readable.getReader(), casti = []; let n = 0;
    for (;;) { const { done, value } = await r.read(); if (done) break; casti.push(value); n += value.length; }
    const out = new Uint8Array(n); let o = 0; for (const c of casti) { out.set(c, o); o += c.length; }
    return out;
  }

  // ---------- TIFF ----------
  const TYPY = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8, 17: 8, 18: 8 };
  function ctiHodnoty(dv, le, typ, pocet, off) {
    const v = [];
    for (let i = 0; i < pocet; i++) {
      const p = off + i * TYPY[typ];
      switch (typ) {
        case 1: case 7: v.push(dv.getUint8(p)); break;
        case 6: v.push(dv.getInt8(p)); break;
        case 3: v.push(dv.getUint16(p, le)); break;
        case 8: v.push(dv.getInt16(p, le)); break;
        case 4: v.push(dv.getUint32(p, le)); break;
        case 9: v.push(dv.getInt32(p, le)); break;
        case 5: v.push(dv.getUint32(p, le) / dv.getUint32(p + 4, le)); break;
        case 10: v.push(dv.getInt32(p, le) / dv.getInt32(p + 4, le)); break;
        case 11: v.push(dv.getFloat32(p, le)); break;
        case 12: v.push(dv.getFloat64(p, le)); break;
        case 16: case 18: v.push(Number(dv.getBigUint64(p, le))); break;
        case 17: v.push(Number(dv.getBigInt64(p, le))); break;
        default: v.push(0);
      }
    }
    return v;
  }
  function ctiIfd(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (u8.length < 16) throw new Error('Soubor je příliš krátký na TIFF.');
    const bom = dv.getUint16(0, false);
    if (bom !== 0x4949 && bom !== 0x4D4D) throw new Error('Není to soubor TIFF (chybí hlavička II/MM).');
    const le = bom === 0x4949, verze = dv.getUint16(2, le);
    if (verze !== 42 && verze !== 43) throw new Error('Neznámá verze TIFF ' + verze + '.');
    const big = verze === 43;
    const ifdOff = big ? Number(dv.getBigUint64(8, le)) : dv.getUint32(4, le);
    if (ifdOff <= 0 || ifdOff >= u8.length) throw new Error('Poškozený TIFF: neplatná pozice IFD.');
    const n = big ? Number(dv.getBigUint64(ifdOff, le)) : dv.getUint16(ifdOff, le);
    const tagy = {};
    for (let i = 0; i < n; i++) {
      const p = ifdOff + (big ? 8 + i * 20 : 2 + i * 12);
      const tag = dv.getUint16(p, le), typ = dv.getUint16(p + 2, le);
      const pocet = big ? Number(dv.getBigUint64(p + 4, le)) : dv.getUint32(p + 4, le);
      if (!TYPY[typ]) continue;
      const vel = TYPY[typ] * pocet, misto = big ? 8 : 4;
      const off = vel <= misto ? p + (big ? 12 : 8) : (big ? Number(dv.getBigUint64(p + 12, le)) : dv.getUint32(p + 8, le));
      if (off + vel > u8.length) throw new Error('Poškozený TIFF: tag ' + tag + ' mimo soubor.');
      if (typ === 2) {
        let s = ''; for (let k = 0; k < pocet; k++) { const c = u8[off + k]; if (c) s += String.fromCharCode(c); }
        tagy[tag] = s;
      } else tagy[tag] = ctiHodnoty(dv, le, typ, pocet, off);
    }
    return { u8, dv, le, tagy };
  }
  const t1 = (tagy, k, def) => tagy[k] !== undefined ? (Array.isArray(tagy[k]) ? tagy[k][0] : tagy[k]) : def;

  function geoKlice(tagy) {
    const d = tagy[34735]; if (!d || d.length < 4) return {};
    const dbl = tagy[34736] || [], asc = tagy[34737] || '';
    const k = {};
    for (let i = 0; i < d[3]; i++) {
      const id = d[4 + i * 4], loc = d[5 + i * 4], cnt = d[6 + i * 4], val = d[7 + i * 4];
      if (loc === 0) k[id] = val;
      else if (loc === 34736) k[id] = dbl.slice(val, val + cnt);
      else if (loc === 34737) k[id] = String(asc).substr(val, cnt).replace(/\|$/, '');
    }
    return k;
  }

  async function ctiTiff(buf, P) {
    const { u8, dv, le, tagy } = ctiIfd(buf);
    const W = t1(tagy, 256), H = t1(tagy, 257);
    if (!W || !H) throw new Error('TIFF nemá rozměry obrazu.');
    const bps = t1(tagy, 258, 1), spp = t1(tagy, 277, 1), komp = t1(tagy, 259, 1);
    const fmt = t1(tagy, 339, 1), pred = t1(tagy, 317, 1), planar = t1(tagy, 284, 1);
    if (![8, 16, 32, 64].includes(bps)) throw new Error('Nepodporovaná bitová hloubka ' + bps + ' (umím 8/16/32/64 bitů).');
    if (![1, 2, 3].includes(fmt)) throw new Error('Nepodporovaný formát vzorku ' + fmt + '.');
    if (![1, 5, 8, 32946, 32773].includes(komp)) {
      const jm = { 7: 'JPEG', 34887: 'LERC', 50000: 'ZSTD', 34925: 'LZMA', 50001: 'WebP' }[komp] || ('kód ' + komp);
      throw new Error('Nepodporovaná komprese ' + jm + '. Převeďte např.: gdal_translate -co COMPRESS=DEFLATE vstup.tif vystup.tif');
    }
    const B = bps / 8;
    const dlazdice = tagy[322] !== undefined;
    const bw = dlazdice ? t1(tagy, 322) : W;
    const bh = dlazdice ? t1(tagy, 323) : Math.min(t1(tagy, 278, H), H);
    const offs = dlazdice ? tagy[324] : tagy[273], lens = dlazdice ? tagy[325] : tagy[279];
    if (!offs || !lens) throw new Error('TIFF nemá pozice dat (StripOffsets/TileOffsets).');
    const sppBlok = planar === 2 ? 1 : spp; // u planar=2 čteme jen bloky prvního pásma
    const nx = Math.ceil(W / bw), ny = Math.ceil(H / bh);
    const data = new Float32Array(W * H).fill(NaN);
    const blokB = bw * bh * sppBlok * B;
    for (let by = 0; by < ny; by++) for (let bx = 0; bx < nx; bx++) {
      const idx = by * nx + bx;
      const off = offs[idx], len = lens[idx];
      if (!len || !off) continue; // řídký soubor – blok bez dat
      if (off + len > u8.length) throw new Error('Poškozený TIFF: blok dat mimo soubor.');
      let raw = u8.subarray(off, off + len);
      const radkuBloku = dlazdice ? bh : Math.min(bh, H - by * bh);
      const ocek = bw * radkuBloku * sppBlok * B;
      if (komp === 5) raw = lzwDekoduj(raw, ocek);
      else if (komp === 8 || komp === 32946) raw = await inflate(raw);
      else if (komp === 32773) raw = packbits(raw, ocek);
      if (raw.length < ocek) { const r2 = new Uint8Array(ocek); r2.set(raw); raw = r2; }
      let bdv, ble = le;
      const radek = bw * sppBlok; // vzorků na řádek
      if (pred === 2) {
        const c = new Uint8Array(raw); bdv = new DataView(c.buffer);
        for (let r = 0; r < radkuBloku; r++) for (let i = sppBlok; i < radek; i++) {
          const p = (r * radek + i) * B, q = p - sppBlok * B;
          if (B === 1) c[p] = (c[p] + c[q]) & 255;
          else if (B === 2) bdv.setUint16(p, (bdv.getUint16(p, le) + bdv.getUint16(q, le)) & 0xffff, le);
          else if (B === 4) bdv.setUint32(p, (bdv.getUint32(p, le) + bdv.getUint32(q, le)) >>> 0, le);
        }
      } else if (pred === 3) {
        if (fmt !== 3) throw new Error('Prediktor 3 je jen pro data s plovoucí čárkou.');
        const c = new Uint8Array(ocek), rB = radek * B;
        for (let r = 0; r < radkuBloku; r++) {
          const tmp = raw.slice(r * rB, (r + 1) * rB);
          for (let i = 1; i < rB; i++) tmp[i] = (tmp[i] + tmp[i - 1]) & 255;
          for (let i = 0; i < radek; i++) for (let b = 0; b < B; b++) c[r * rB + i * B + b] = tmp[(B - b - 1) * radek + i];
        }
        bdv = new DataView(c.buffer); ble = true;
      } else bdv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const x0 = bx * bw, y0 = by * bh;
      for (let r = 0; r < radkuBloku; r++) {
        const y = y0 + r; if (y >= H) break;
        for (let i = 0; i < bw; i++) {
          const x = x0 + i; if (x >= W) break;
          const p = (r * radek + i * sppBlok) * B;
          let v;
          if (fmt === 3) v = B === 4 ? bdv.getFloat32(p, ble) : bdv.getFloat64(p, ble);
          else if (fmt === 2) v = B === 1 ? bdv.getInt8(p) : B === 2 ? bdv.getInt16(p, ble) : bdv.getInt32(p, ble);
          else v = B === 1 ? bdv.getUint8(p) : B === 2 ? bdv.getUint16(p, ble) : bdv.getUint32(p, ble);
          data[y * W + x] = v;
        }
      }
    }
    // nodata
    let nodata = null;
    if (tagy[42113] !== undefined) { const n = parseFloat(String(tagy[42113]).trim()); if (isFinite(n)) nodata = n; }
    if (P && isFinite(P.nodata)) nodata = P.nodata;
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      if (!isFinite(v) || (nodata !== null && (v === nodata || Math.abs(v - nodata) <= Math.abs(nodata) * 1e-6)) || v < -1e5 || v > 1e5) data[i] = NaN;
    }
    // georeference
    const gk = geoKlice(tagy);
    let afinni = null;
    const bod = gk[1025] === 2; // PixelIsPoint
    if (tagy[34264]) {
      const m = tagy[34264];
      afinni = [m[3], m[0], m[1], m[7], m[4], m[5]];
    } else if (tagy[33550] && tagy[33922]) {
      const s = tagy[33550], t = tagy[33922];
      afinni = [t[3] - t[0] * s[0], s[0], 0, t[4] + t[1] * s[1], 0, -s[1]];
    }
    if (afinni && bod) { afinni[0] -= 0.5 * afinni[1] + 0.5 * afinni[2]; afinni[3] -= 0.5 * afinni[4] + 0.5 * afinni[5]; }
    let epsg = 0, popisCrs = '';
    const citace = [gk[1026], gk[3073], gk[2049]].filter(Boolean).join(' | ');
    if (gk[3072] && gk[3072] !== 32767) epsg = gk[3072];
    else if (gk[1024] === 2 && gk[2048] && gk[2048] !== 32767) epsg = gk[2048];
    popisCrs = citace;
    const vertikal = gk[4096] ? ('EPSG:' + gk[4096]) + (gk[4097] ? ' ' + gk[4097] : '') : (gk[4097] || '');
    return { sirka: W, vyska: H, data, afinni, epsg, popisCrs, vertikal, nodata, modelTyp: gk[1024] || 0,
      info: { komprese: komp, bitu: bps, format: fmt, prediktor: pred, dlazdice, pasem: spp } };
  }

  // ---------- ESRI ASCII grid ----------
  function ctiAsc(text) {
    if (typeof text !== 'string') text = new TextDecoder().decode(text);
    const hl = {}; let pos = 0;
    const re = /^\s*([A-Za-z_]+)\s+([-+0-9.eE]+)\s*$/;
    for (let i = 0; i < 10; i++) {
      const konec = text.indexOf('\n', pos); if (konec < 0) break;
      const m = text.slice(pos, konec).match(re);
      if (!m) break;
      hl[m[1].toLowerCase()] = parseFloat(m[2]); pos = konec + 1;
    }
    const W = hl.ncols, H = hl.nrows;
    if (!(W > 0 && H > 0)) throw new Error('ASCII grid: chybí ncols/nrows v hlavičce.');
    const dx = hl.cellsize || hl.dx, dy = hl.cellsize || hl.dy;
    if (!(dx > 0 && dy > 0)) throw new Error('ASCII grid: chybí cellsize.');
    let xll, yll;
    if (hl.xllcorner !== undefined) xll = hl.xllcorner; else if (hl.xllcenter !== undefined) xll = hl.xllcenter - dx / 2; else throw new Error('ASCII grid: chybí xllcorner.');
    if (hl.yllcorner !== undefined) yll = hl.yllcorner; else if (hl.yllcenter !== undefined) yll = hl.yllcenter - dy / 2; else throw new Error('ASCII grid: chybí yllcorner.');
    const nod = hl.nodata_value;
    const data = new Float32Array(W * H);
    // rychlé čtení čísel bez split
    let n = 0; const L = text.length; let i = pos;
    while (n < W * H && i < L) {
      if (text.charCodeAt(i) <= 32) { i++; continue; }
      const z = i;
      while (i < L && text.charCodeAt(i) > 32) i++;
      const v = +text.slice(z, i);
      if (Number.isNaN(v)) throw new Error('ASCII grid: neplatné číslo „' + text.slice(z, Math.min(i, z + 20)) + '“ na pozici ' + n + '.');
      data[n++] = (nod !== undefined && v === nod) ? NaN : v;
    }
    if (n < W * H) throw new Error('ASCII grid: očekáváno ' + (W * H) + ' hodnot, nalezeno ' + n + '.');
    return { sirka: W, vyska: H, data, afinni: [xll, dx, 0, yll + H * dy, 0, -dy], epsg: 0, popisCrs: '', vertikal: '',
      nodata: nod === undefined ? null : nod, info: { format: 'ASCII grid' } };
  }

  // ---------- zápis GeoTIFF (float32, jeden pruh na řádek, little endian) ----------
  function zapisGeoTiff(sirka, vyska, data, afinni, epsg, nodata) {
    const geo = epsg === 4326 ? [1, 1, 0, 3, 1024, 0, 1, 2, 1025, 0, 1, 1, 2048, 0, 1, 4326]
                              : [1, 1, 0, 3, 1024, 0, 1, 1, 1025, 0, 1, 1, 3072, 0, 1, epsg];
    const nodStr = String(nodata) + '\0';
    const tagy = [
      [256, 4, 1, [sirka]], [257, 4, 1, [vyska]], [258, 3, 1, [32]], [259, 3, 1, [1]], [262, 3, 1, [1]],
      [273, 4, vyska, null], [277, 3, 1, [1]], [278, 4, 1, [1]], [279, 4, vyska, null], [284, 3, 1, [1]], [339, 3, 1, [3]],
      [33550, 12, 3, [afinni[1], -afinni[5], 0]], [33922, 12, 6, [0, 0, 0, afinni[0], afinni[3], 0]],
      [34735, 3, geo.length, geo], [42113, 2, nodStr.length, nodStr]
    ];
    const vel = { 2: 1, 3: 2, 4: 4, 12: 8 };
    const ifdOff = 8, ifdLen = 2 + tagy.length * 12 + 4;
    let extra = ifdOff + ifdLen;
    const umisteni = tagy.map(t => { const v = vel[t[1]] * t[2]; if (v <= 4) return -1; const o = extra; extra += v + (v & 1); return o; });
    const dataOff = extra, radekB = sirka * 4;
    const celkem = dataOff + radekB * vyska;
    const ab = new ArrayBuffer(celkem), dv = new DataView(ab), u8 = new Uint8Array(ab);
    dv.setUint16(0, 0x4949); dv.setUint16(2, 42, true); dv.setUint32(4, ifdOff, true);
    dv.setUint16(ifdOff, tagy.length, true);
    tagy.forEach((t, i) => {
      let [tag, typ, pocet, hod] = t;
      if (tag === 273) hod = Array.from({ length: vyska }, (_, r) => dataOff + r * radekB);
      if (tag === 279) hod = new Array(vyska).fill(radekB);
      const p = ifdOff + 2 + i * 12;
      dv.setUint16(p, tag, true); dv.setUint16(p + 2, typ, true); dv.setUint32(p + 4, pocet, true);
      const kam = umisteni[i] < 0 ? p + 8 : umisteni[i];
      if (umisteni[i] >= 0) dv.setUint32(p + 8, umisteni[i], true);
      for (let k = 0; k < pocet; k++) {
        if (typ === 2) u8[kam + k] = hod.charCodeAt(k);
        else if (typ === 3) dv.setUint16(kam + k * 2, hod[k], true);
        else if (typ === 4) dv.setUint32(kam + k * 4, hod[k], true);
        else if (typ === 12) dv.setFloat64(kam + k * 8, hod[k], true);
      }
    });
    dv.setUint32(ifdOff + 2 + tagy.length * 12, 0, true);
    for (let i = 0; i < sirka * vyska; i++) dv.setFloat32(dataOff + i * 4, isFinite(data[i]) ? data[i] : nodata, true);
    return u8;
  }

  /** Rozpozná formát podle prvních bajtů. */
  function rozpoznej(u8) {
    if (u8.length >= 4 && ((u8[0] === 0x49 && u8[1] === 0x49) || (u8[0] === 0x4D && u8[1] === 0x4D))) return 'tiff';
    const s = new TextDecoder().decode(u8.subarray(0, 200)).toLowerCase();
    if (/^\s*ncols/.test(s) || /^\s*nrows/.test(s)) return 'asc';
    return '';
  }

  const API = { ctiTiff, ctiAsc, ctiIfd, geoKlice, lzwDekoduj, packbits, inflate, zapisGeoTiff, rozpoznej };
  if (typeof module !== 'undefined') module.exports = API; else window.ZaplavyRastry = API;
})();

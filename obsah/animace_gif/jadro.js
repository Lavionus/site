/* ============================================================
   animace_gif/jadro.js – jádro stránky „GIF, animace a sprite sheety“ (bez DOM).
   Obrázek = { sirka, vyska, data: Uint8ClampedArray RGBA }.
   Obsah: GIF dekodér a kodér (LZW, disposal, průhlednost, kvantizace
   median-cut / oktanový strom, Floyd–Steinberg, optimalizace změněného
   obdélníku), zápis APNG (CRC, zlib), ZIP „uloženo“, úpravy obrázků,
   řezání a balení sprite sheetů včetně JSON pro TexturePacker/Phaser.
   V prohlížeči window.ANIMACE_GIF, v node module.exports.
   ============================================================ */
(function (koren) {
  'use strict';

  // ---------- obrázky ----------
  function novyObr(sirka, vyska, data) {
    return { sirka, vyska, data: data || new Uint8ClampedArray(sirka * vyska * 4) };
  }

  function orez(obr, x, y, w, h) {
    x = Math.round(x); y = Math.round(y); w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    const v = novyObr(w, h);
    for (let r = 0; r < h; r++) {
      const sy = y + r;
      if (sy < 0 || sy >= obr.vyska) continue;
      const od = Math.max(0, -x), do_ = Math.min(w, obr.sirka - x);
      if (do_ <= od) continue;
      v.data.set(obr.data.subarray((sy * obr.sirka + x + od) * 4, (sy * obr.sirka + x + do_) * 4), (r * w + od) * 4);
    }
    return v;
  }

  /* Položí obrázek na plátno dané velikosti (bez změny měřítka). zarovnani: 'stred' | 'dole' | 'vlevo-nahore'. */
  function umisti(obr, w, h, zarovnani) {
    let x = 0, y = 0;
    if (zarovnani === 'stred') { x = Math.floor((w - obr.sirka) / 2); y = Math.floor((h - obr.vyska) / 2); }
    else if (zarovnani === 'dole') { x = Math.floor((w - obr.sirka) / 2); y = h - obr.vyska; }
    return orez(obr, -x, -y, w, h);
  }

  /* Změna velikosti. 'nejblizsi' = pixel art beze změny barev; 'plynule' = lineární
     filtr roztažený podle zmenšení (plošný průměr), v předem vynásobené alfě. */
  function zmenVelikost(obr, w, h, metoda) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    if (metoda === 'nejblizsi') {
      const v = novyObr(w, h), s = new Uint32Array(obr.data.buffer, obr.data.byteOffset, obr.sirka * obr.vyska), d = new Uint32Array(v.data.buffer);
      const mx = new Int32Array(w);
      for (let x = 0; x < w; x++) mx[x] = Math.min(obr.sirka - 1, Math.floor((x + 0.5) * obr.sirka / w));
      for (let y = 0; y < h; y++) {
        const sy = Math.min(obr.vyska - 1, Math.floor((y + 0.5) * obr.vyska / h)) * obr.sirka;
        for (let x = 0; x < w; x++) d[y * w + x] = s[sy + mx[x]];
      }
      return v;
    }
    // předem vynásobená alfa ve float
    const n = obr.sirka * obr.vyska, f = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const a = obr.data[i * 4 + 3] / 255;
      f[i * 4] = obr.data[i * 4] * a; f[i * 4 + 1] = obr.data[i * 4 + 1] * a; f[i * 4 + 2] = obr.data[i * 4 + 2] * a; f[i * 4 + 3] = obr.data[i * 4 + 3];
    }
    const t = prevzorkuj(f, obr.sirka, obr.vyska, w, true);
    const u = prevzorkuj(t, w, obr.vyska, h, false);
    const v = novyObr(w, h);
    for (let i = 0; i < w * h; i++) {
      const a = u[i * 4 + 3];
      if (a <= 0.5) continue;
      const k = 255 / a;
      v.data[i * 4] = u[i * 4] * k; v.data[i * 4 + 1] = u[i * 4 + 1] * k; v.data[i * 4 + 2] = u[i * 4 + 2] * k; v.data[i * 4 + 3] = a;
    }
    return v;
  }
  // jeden směr převzorkování (vodorovně: sw → nw, vyska zůstává; svisle obráceně)
  function prevzorkuj(src, sw, sh, nove, vodorovne) {
    const delkaZ = vodorovne ? sw : sh, druha = vodorovne ? sh : sw;
    const meritko = delkaZ / nove, sirkaF = Math.max(1, meritko);
    const out = new Float32Array((vodorovne ? nove * sh : sw * nove) * 4);
    for (let i = 0; i < nove; i++) {
      const stred = (i + 0.5) * meritko - 0.5;
      const od = Math.max(0, Math.floor(stred - sirkaF)), do_ = Math.min(delkaZ - 1, Math.ceil(stred + sirkaF));
      const vahy = [];
      let suma = 0;
      for (let j = od; j <= do_; j++) { const w = Math.max(0, 1 - Math.abs(j - stred) / sirkaF); vahy.push(w); suma += w; }
      if (suma === 0) { vahy.length = 0; vahy.push(1); suma = 1; }
      for (let k = 0; k < druha; k++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let q = 0; q < vahy.length; q++) {
          const w = vahy[q];
          if (!w) continue;
          const j = od + q, si = (vodorovne ? k * sw + j : j * sw + k) * 4;
          r += src[si] * w; g += src[si + 1] * w; b += src[si + 2] * w; a += src[si + 3] * w;
        }
        const oi = (vodorovne ? k * nove + i : i * sw + k) * 4;
        out[oi] = r / suma; out[oi + 1] = g / suma; out[oi + 2] = b / suma; out[oi + 3] = a / suma;
      }
    }
    return out;
  }

  function zrcadli(obr, svisle) {
    const v = novyObr(obr.sirka, obr.vyska), s = new Uint32Array(obr.data.buffer, obr.data.byteOffset, obr.sirka * obr.vyska), d = new Uint32Array(v.data.buffer);
    const W = obr.sirka, H = obr.vyska;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      d[y * W + x] = svisle ? s[(H - 1 - y) * W + x] : s[y * W + (W - 1 - x)];
    return v;
  }

  /* Otočení o 90° (doprava = po směru hodin). */
  function otoc90(obr, doprava) {
    const W = obr.sirka, H = obr.vyska, v = novyObr(H, W);
    const s = new Uint32Array(obr.data.buffer, obr.data.byteOffset, W * H), d = new Uint32Array(v.data.buffer);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const nx = doprava ? H - 1 - y : y, ny = doprava ? x : W - 1 - x;
      d[ny * H + nx] = s[y * W + x];
    }
    return v;
  }

  // ---------- časová osa ----------
  const obrat = pole => pole.slice().reverse();
  const pingPong = pole => pole.length < 3 ? pole.concat(pole.slice(0, -1).reverse()) : pole.concat(pole.slice(1, -1).reverse());

  /* Přesune prvky na indexech `vybrane` tak, aby začínaly před prvkem, který byl na indexu `cil`. */
  function presun(pole, vybrane, cil) {
    const mn = new Set(vybrane), presouvane = pole.filter((_, i) => mn.has(i));
    let c = 0;
    for (let i = 0; i < cil; i++) if (!mn.has(i)) c++;
    const zbytek = pole.filter((_, i) => !mn.has(i));
    zbytek.splice(c, 0, ...presouvane);
    return { pole: zbytek, od: c, pocet: presouvane.length };
  }

  // ---------- CRC32, Adler32, zlib ----------
  const CRC_TAB = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8, start, konec, c0) {
    let c = c0 === undefined ? 0xFFFFFFFF : (c0 ^ 0xFFFFFFFF) >>> 0;
    for (let i = start || 0, n = konec === undefined ? u8.length : konec; i < n; i++) c = CRC_TAB[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function adler32(u8) {
    let a = 1, b = 0;
    for (let i = 0; i < u8.length;) {
      const n = Math.min(u8.length, i + 5552);
      for (; i < n; i++) { a += u8[i]; b += a; }
      a %= 65521; b %= 65521;
    }
    return ((b << 16) | a) >>> 0;
  }
  /* zlib bez komprese (záloha, když chybí CompressionStream). */
  function zlibUlozeno(data) {
    const bloky = Math.max(1, Math.ceil(data.length / 65535));
    const out = new Uint8Array(2 + data.length + bloky * 5 + 4);
    out[0] = 0x78; out[1] = 0x01;
    let p = 2;
    for (let b = 0; b < bloky; b++) {
      const od = b * 65535, n = Math.min(65535, data.length - od);
      out[p++] = b === bloky - 1 ? 1 : 0;
      out[p++] = n & 255; out[p++] = n >> 8; out[p++] = ~n & 255; out[p++] = (~n >> 8) & 255;
      out.set(data.subarray(od, od + n), p); p += n;
    }
    const ad = adler32(data);
    out[p++] = ad >>> 24; out[p++] = (ad >>> 16) & 255; out[p++] = (ad >>> 8) & 255; out[p++] = ad & 255;
    return out;
  }
  async function zlib(data) {
    if (typeof CompressionStream === 'undefined') return zlibUlozeno(data);
    const cs = new CompressionStream('deflate');
    const buf = await new Response(new Blob([data]).stream().pipeThrough(cs)).arrayBuffer();
    return new Uint8Array(buf);
  }

  // ---------- ZIP (metoda „uloženo“) ----------
  function zip(polozky, datum) {
    const enc = new TextEncoder(), d = datum || new Date();
    const dosCas = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDatum = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const casti = [], centralni = [];
    let offset = 0;
    for (const p of polozky) {
      const data = typeof p.data === 'string' ? enc.encode(p.data) : p.data;
      const jmeno = enc.encode(p.name), crc = crc32(data);
      const lok = new Uint8Array(30 + jmeno.length), dv = new DataView(lok.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true);
      dv.setUint16(10, dosCas, true); dv.setUint16(12, dosDatum, true);
      dv.setUint32(14, crc, true); dv.setUint32(18, data.length, true); dv.setUint32(22, data.length, true);
      dv.setUint16(26, jmeno.length, true); lok.set(jmeno, 30);
      casti.push(lok, data);
      const cen = new Uint8Array(46 + jmeno.length), cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
      cv.setUint16(12, dosCas, true); cv.setUint16(14, dosDatum, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
      cv.setUint16(28, jmeno.length, true); cv.setUint32(42, offset, true); cen.set(jmeno, 46);
      centralni.push(cen);
      offset += lok.length + data.length;
    }
    const cdVel = centralni.reduce((s, c) => s + c.length, 0);
    const konec = new Uint8Array(22), kv = new DataView(konec.buffer);
    kv.setUint32(0, 0x06054b50, true); kv.setUint16(8, polozky.length, true); kv.setUint16(10, polozky.length, true);
    kv.setUint32(12, cdVel, true); kv.setUint32(16, offset, true);
    return spoj([...casti, ...centralni, konec]);
  }
  function spoj(casti) {
    const out = new Uint8Array(casti.reduce((s, c) => s + c.length, 0));
    let p = 0;
    for (const c of casti) { out.set(c, p); p += c.length; }
    return out;
  }

  // ---------- kvantizace ----------
  /* Barvy ze sady obrázků (jen pixely s alfou ≥ prah). obdelniky: volitelně jen výřez každého snímku. */
  function sberPixelu(obrazky, prah, obdelniky) {
    let celkem = 0;
    obrazky.forEach((o, k) => { const r = obdelniky && obdelniky[k]; celkem += r ? r.w * r.h : o.sirka * o.vyska; });
    const krok = Math.max(1, Math.floor(celkem / 600000));   // vzorek pro oktanový strom
    return { obrazky, prah, obdelniky, krok };
  }
  function prochazej(sber, fn, vse) {
    const { obrazky, prah, obdelniky } = sber, krok = vse ? 1 : sber.krok;
    let pocitadlo = 0;
    obrazky.forEach((o, k) => {
      const r = (obdelniky && obdelniky[k]) || { x: 0, y: 0, w: o.sirka, h: o.vyska }, d = o.data;
      for (let y = r.y; y < r.y + r.h; y++) {
        let i = (y * o.sirka + r.x) * 4;
        for (let x = 0; x < r.w; x++, i += 4) {
          if (d[i + 3] < prah) continue;
          if (krok > 1 && (pocitadlo++ % krok)) continue;
          fn(d[i], d[i + 1], d[i + 2]);
        }
      }
    });
  }
  /* Přesná paleta, má-li obraz nejvýš `max` barev (pixel art), jinak null. */
  function presnaPaleta(sber, max) {
    const mn = new Set();
    let pres = false;
    try {
      prochazej(sber, (r, g, b) => { mn.add((r << 16) | (g << 8) | b); if (mn.size > max) { pres = true; throw 0; } }, true);
    } catch (e) { if (e !== 0) throw e; }
    if (pres) return null;
    return [...mn].sort((a, b) => a - b).map(c => [c >> 16, (c >> 8) & 255, c & 255]);
  }

  function medianCut(sber, k) {
    const N = 32768, pocet = new Float64Array(N), sr = new Float64Array(N), sg = new Float64Array(N), sb = new Float64Array(N);
    prochazej(sber, (r, g, b) => {
      const i = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      pocet[i]++; sr[i] += r; sg[i] += g; sb[i] += b;
    }, true);
    const box = (r0, r1, g0, g1, b0, b1) => {
      // zmenšit na obsazené buňky a spočítat populaci
      let n = 0, R0 = 32, R1 = -1, G0 = 32, G1 = -1, B0 = 32, B1 = -1;
      for (let r = r0; r <= r1; r++) for (let g = g0; g <= g1; g++) for (let b = b0; b <= b1; b++) {
        const c = pocet[(r << 10) | (g << 5) | b];
        if (!c) continue;
        n += c;
        if (r < R0) R0 = r; if (r > R1) R1 = r; if (g < G0) G0 = g; if (g > G1) G1 = g; if (b < B0) B0 = b; if (b > B1) B1 = b;
      }
      return n ? { r0: R0, r1: R1, g0: G0, g1: G1, b0: B0, b1: B1, n } : null;
    };
    const prvni = box(0, 31, 0, 31, 0, 31);
    if (!prvni) return [[0, 0, 0]];
    const boxy = [prvni];
    while (boxy.length < k) {
      let nej = -1, skore = 0;
      boxy.forEach((b, i) => {
        const strana = Math.max(b.r1 - b.r0, (b.g1 - b.g0) * 1.2, b.b1 - b.b0);   // zelené oko vnímá citlivěji
        const s = strana > 0 ? b.n * strana : 0;
        if (s > skore) { skore = s; nej = i; }
      });
      if (nej < 0) break;
      const b = boxy[nej];
      const dr = b.r1 - b.r0, dg = (b.g1 - b.g0) * 1.2, db = b.b1 - b.b0;
      const osa = dr >= dg && dr >= db ? 0 : dg >= db ? 1 : 2;
      const lo = [b.r0, b.g0, b.b0][osa], hi = [b.r1, b.g1, b.b1][osa];
      const vrstvy = new Float64Array(hi - lo + 1);
      for (let r = b.r0; r <= b.r1; r++) for (let g = b.g0; g <= b.g1; g++) for (let bb = b.b0; bb <= b.b1; bb++) {
        const c = pocet[(r << 10) | (g << 5) | bb];
        if (c) vrstvy[(osa === 0 ? r : osa === 1 ? g : bb) - lo] += c;
      }
      let kum = 0, rez = lo;
      for (let i = 0; i < vrstvy.length - 1; i++) { kum += vrstvy[i]; rez = lo + i; if (kum >= b.n / 2) break; }
      const a = osa === 0 ? box(b.r0, rez, b.g0, b.g1, b.b0, b.b1) : osa === 1 ? box(b.r0, b.r1, b.g0, rez, b.b0, b.b1) : box(b.r0, b.r1, b.g0, b.g1, b.b0, rez);
      const c = osa === 0 ? box(rez + 1, b.r1, b.g0, b.g1, b.b0, b.b1) : osa === 1 ? box(b.r0, b.r1, rez + 1, b.g1, b.b0, b.b1) : box(b.r0, b.r1, b.g0, b.g1, rez + 1, b.b1);
      boxy.splice(nej, 1, ...[a, c].filter(Boolean));
    }
    return boxy.map(b => {
      let n = 0, r = 0, g = 0, bl = 0;
      for (let x = b.r0; x <= b.r1; x++) for (let y = b.g0; y <= b.g1; y++) for (let z = b.b0; z <= b.b1; z++) {
        const i = (x << 10) | (y << 5) | z;
        if (!pocet[i]) continue;
        n += pocet[i]; r += sr[i]; g += sg[i]; bl += sb[i];
      }
      return [Math.round(r / n), Math.round(g / n), Math.round(bl / n)];
    });
  }

  function oktanovyStrom(sber, k) {
    const urovne = Array.from({ length: 8 }, () => []);
    const novy = (uroven) => { const u = { r: 0, g: 0, b: 0, n: 0, deti: null, list: uroven === 8 }; if (!u.list) urovne[uroven].push(u); return u; };
    const koren = novy(0);
    let listu = 0;
    const redukuj = () => {
      let u = 7;
      while (u > 0 && !urovne[u].length) u--;
      // uzel s nejmenším počtem pixelů na nejhlubší úrovni
      const pole = urovne[u];
      let mi = 0;
      for (let i = 1; i < pole.length; i++) if (pole[i].n < pole[mi].n) mi = i;
      const uzel = pole[mi];
      pole[mi] = pole[pole.length - 1]; pole.pop();
      let odebrano = 0;
      for (const d of uzel.deti) if (d) {
        uzel.r += d.r; uzel.g += d.g; uzel.b += d.b;
        odebrano++;
      }
      uzel.deti = null; uzel.list = true;
      listu -= odebrano - 1;
    };
    const vloz = (r, g, b) => {
      let u = koren;
      for (let lv = 0; lv < 8 && !u.list; lv++) {
        u.n++;
        const s = 7 - lv, i = (((r >> s) & 1) << 2) | (((g >> s) & 1) << 1) | ((b >> s) & 1);
        if (!u.deti) u.deti = new Array(8).fill(null);
        if (!u.deti[i]) { u.deti[i] = novy(lv + 1); if (u.deti[i].list) listu++; }
        u = u.deti[i];
      }
      u.r += r; u.g += g; u.b += b;
      if (u.list && !u.deti) u.n++;
      while (listu > k) redukuj();
    };
    // n listu = počet pixelů; u vnitřních uzlů n slouží k výběru redukce
    prochazej(sber, vloz);
    const out = [];
    const sesbirej = u => {
      if (u.list) { if (u.n) out.push([Math.round(u.r / u.n), Math.round(u.g / u.n), Math.round(u.b / u.n)]); return; }
      if (u.deti) u.deti.forEach(d => d && sesbirej(d));
    };
    sesbirej(koren);
    return out.length ? out : [[0, 0, 0]];
  }

  /* Paleta pro sadu obrázků: nejdřív přesná, jinak median-cut nebo oktanový strom. */
  function paleta(obrazky, k, metoda, prah, obdelniky) {
    const sber = sberPixelu(obrazky, prah === undefined ? 128 : prah, obdelniky);
    const presna = presnaPaleta(sber, k);
    if (presna) return presna.length ? presna : [[0, 0, 0]];
    return metoda === 'oktan' ? oktanovyStrom(sber, k) : medianCut(sber, k);
  }

  /* Hledání nejbližší barvy s mezipamětí na 6 bitech na kanál. */
  function hledac(pal) {
    const n = pal.length, R = new Int32Array(n), G = new Int32Array(n), B = new Int32Array(n);
    pal.forEach((c, i) => { R[i] = c[0]; G[i] = c[1]; B[i] = c[2]; });
    const presne = new Map();
    pal.forEach((c, i) => { const kl = (c[0] << 16) | (c[1] << 8) | c[2]; if (!presne.has(kl)) presne.set(kl, i); });
    const cache = new Int16Array(262144).fill(-1);
    return (r, g, b) => {
      const kl = (r << 16) | (g << 8) | b, p = presne.get(kl);
      if (p !== undefined) return p;
      const ci = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
      if (cache[ci] >= 0) return cache[ci];
      let nej = 0, nd = Infinity;
      for (let i = 0; i < n; i++) {
        const dr = r - R[i], dg = g - G[i], db = b - B[i];
        const d = 3 * dr * dr + 4 * dg * dg + 2 * db * db;
        if (d < nd) { nd = d; nej = i; }
      }
      cache[ci] = nej;
      return nej;
    };
  }

  /* Převod výřezu obrázku na indexy palety. Pixely průhledné (alfa < prah) nebo označené
     maskou `stejne` (nezměněné oproti minulému snímku) dostanou index `ti`. */
  function namapuj(obr, r, pal, najdi, ti, prah, dither, stejne) {
    const out = new Uint8Array(r.w * r.h), d = obr.data;
    let chR, chG, chB, dalR, dalG, dalB;
    if (dither) {
      chR = new Float32Array(r.w + 2); chG = new Float32Array(r.w + 2); chB = new Float32Array(r.w + 2);
      dalR = new Float32Array(r.w + 2); dalG = new Float32Array(r.w + 2); dalB = new Float32Array(r.w + 2);
    }
    for (let y = 0; y < r.h; y++) {
      let i = ((r.y + y) * obr.sirka + r.x) * 4;
      for (let x = 0; x < r.w; x++, i += 4) {
        const o = y * r.w + x;
        if (d[i + 3] < prah || (stejne && stejne[o])) { out[o] = ti; continue; }
        if (!dither) { out[o] = najdi(d[i], d[i + 1], d[i + 2]); continue; }
        const cr = Math.max(0, Math.min(255, Math.round(d[i] + chR[x + 1])));
        const cg = Math.max(0, Math.min(255, Math.round(d[i + 1] + chG[x + 1])));
        const cb = Math.max(0, Math.min(255, Math.round(d[i + 2] + chB[x + 1])));
        const p = najdi(cr, cg, cb);
        out[o] = p;
        const er = cr - pal[p][0], eg = cg - pal[p][1], eb = cb - pal[p][2];
        // Floyd–Steinberg: 7/16 vpravo, 3/16 vlevo dole, 5/16 dole, 1/16 vpravo dole
        chR[x + 2] += er * 7 / 16; chG[x + 2] += eg * 7 / 16; chB[x + 2] += eb * 7 / 16;
        dalR[x] += er * 3 / 16; dalG[x] += eg * 3 / 16; dalB[x] += eb * 3 / 16;
        dalR[x + 1] += er * 5 / 16; dalG[x + 1] += eg * 5 / 16; dalB[x + 1] += eb * 5 / 16;
        dalR[x + 2] += er / 16; dalG[x + 2] += eg / 16; dalB[x + 2] += eb / 16;
      }
      if (dither) {
        [chR, dalR] = [dalR, chR]; [chG, dalG] = [dalG, chG]; [chB, dalB] = [dalB, chB];
        dalR.fill(0); dalG.fill(0); dalB.fill(0);
      }
    }
    return out;
  }

  // ---------- LZW ----------
  let lzwRazitko = null, lzwKody = null, lzwGen = 0;
  function lzwKoduj(indexy, minKod) {
    if (!lzwRazitko) { lzwRazitko = new Int32Array(4096 * 256); lzwKody = new Int16Array(4096 * 256); }
    const clear = 1 << minKod, eoi = clear + 1;
    const bajty = [];
    let akum = 0, bitu = 0, velikost = minKod + 1, dalsi = eoi + 1;
    const zapis = kod => {
      akum |= kod << bitu; bitu += velikost;
      while (bitu >= 8) { bajty.push(akum & 255); akum >>>= 8; bitu -= 8; }
    };
    lzwGen++;
    zapis(clear);
    let pref = indexy[0];
    for (let i = 1; i < indexy.length; i++) {
      const k = indexy[i], kl = (pref << 8) | k;
      if (lzwRazitko[kl] === lzwGen) { pref = lzwKody[kl]; continue; }
      zapis(pref);
      if (dalsi < 4096) {
        lzwRazitko[kl] = lzwGen; lzwKody[kl] = dalsi;
        if (dalsi === (1 << velikost) && velikost < 12) velikost++;
        dalsi++;
      } else {
        zapis(clear);
        lzwGen++; velikost = minKod + 1; dalsi = eoi + 1;
      }
      pref = k;
    }
    zapis(pref);
    zapis(eoi);
    if (bitu > 0) bajty.push(akum & 255);
    return bajty;
  }
  // POZOR na pořadí: kód `dalsi` se přidá až po zápisu, a pokud je roven 2^velikost,
  // dekodér (o krok pozadu) zvětší šířku ve stejné chvíli – viz test kulatou cestou.

  function lzwDekoduj(data, minKod, pocet) {
    const out = new Uint8Array(pocet);
    const clear = 1 << minKod, eoi = clear + 1;
    const pref = new Int16Array(4096), suf = new Uint8Array(4096), prvni = new Uint8Array(4096), delka = new Uint16Array(4096);
    for (let i = 0; i < clear; i++) { suf[i] = i; prvni[i] = i; delka[i] = 1; }
    let velikost = minKod + 1, maska = (1 << velikost) - 1, dalsi = eoi + 1, pred = -1, p = 0;
    let akum = 0, bitu = 0, di = 0;
    const zapis = kod => {
      const L = delka[kod];
      let c = kod;
      for (let j = L - 1; j >= 0; j--) { if (p + j < pocet) out[p + j] = suf[c]; c = pref[c]; }
      p += L;
    };
    while (p < pocet) {
      while (bitu < velikost && di < data.length) { akum |= data[di++] << bitu; bitu += 8; }
      if (bitu < velikost) break;
      const kod = akum & maska;
      akum >>>= velikost; bitu -= velikost;
      if (kod === clear) { velikost = minKod + 1; maska = (1 << velikost) - 1; dalsi = eoi + 1; pred = -1; continue; }
      if (kod === eoi) break;
      if (pred < 0) {
        if (kod >= clear) break;   // poškozená data
        zapis(kod); pred = kod; continue;
      }
      if (kod < dalsi) {
        zapis(kod);
        if (dalsi < 4096) { pref[dalsi] = pred; suf[dalsi] = prvni[kod]; prvni[dalsi] = prvni[pred]; delka[dalsi] = delka[pred] + 1; dalsi++; }
      } else if (kod === dalsi && dalsi < 4096) {
        pref[dalsi] = pred; suf[dalsi] = prvni[pred]; prvni[dalsi] = prvni[pred]; delka[dalsi] = delka[pred] + 1; dalsi++;
        zapis(kod);
      } else break;
      if (dalsi === (1 << velikost) && velikost < 12) { velikost++; maska = (1 << velikost) - 1; }
      pred = kod;
    }
    return out;
  }

  // ---------- GIF dekodér ----------
  /* Vrátí { sirka, vyska, prehrani (0 = stále), snimky: [{ obr, delka (ms) }] } – snímky už složené. */
  function dekodujGif(u8) {
    const t = String.fromCharCode(...u8.subarray(0, 6));
    if (t !== 'GIF87a' && t !== 'GIF89a') throw new Error('Soubor není GIF.');
    const W = u8[6] | (u8[7] << 8), H = u8[8] | (u8[9] << 8);
    if (!W || !H) throw new Error('GIF má nulový rozměr.');
    const pk = u8[10];
    let p = 13, globalni = null;
    if (pk & 0x80) { const n = 1 << ((pk & 7) + 1); globalni = u8.subarray(p, p + n * 3); p += n * 3; }
    let prehrani = 1, gce = null;
    const platno = new Uint8ClampedArray(W * H * 4);
    let predchozi = null;   // { disposal, rect, zaloha }
    const snimky = [];
    const bloky = () => {
      const casti = [];
      let n = 0;
      while (p < u8.length) {
        const len = u8[p++];
        if (!len) break;
        casti.push(u8.subarray(p, p + len)); n += len; p += len;
      }
      const out = new Uint8Array(n);
      let q = 0;
      for (const c of casti) { out.set(c, q); q += c.length; }
      return out;
    };
    while (p < u8.length) {
      const b = u8[p++];
      if (b === 0x3B) break;
      if (b === 0x21) {
        const lab = u8[p++];
        if (lab === 0xF9) {
          const d = bloky();
          gce = { disposal: (d[0] >> 2) & 7, pruhledna: (d[0] & 1) ? d[3] : -1, delka: d[1] | (d[2] << 8) };
        } else if (lab === 0xFF) {
          const len = u8[p];
          const id = String.fromCharCode(...u8.subarray(p + 1, p + 1 + len));
          p += 1 + len;
          const d = bloky();
          if ((id === 'NETSCAPE2.0' || id === 'ANIMEXTS1.0') && d[0] === 1) { const v = d[1] | (d[2] << 8); prehrani = v === 0 ? 0 : v + 1; }
        } else bloky();
        continue;
      }
      if (b !== 0x2C) break;   // neznámý blok – konec
      const x = u8[p] | (u8[p + 1] << 8), y = u8[p + 2] | (u8[p + 3] << 8), w = u8[p + 4] | (u8[p + 5] << 8), h = u8[p + 6] | (u8[p + 7] << 8);
      const ip = u8[p + 8];
      p += 9;
      let tab = globalni;
      if (ip & 0x80) { const n = 1 << ((ip & 7) + 1); tab = u8.subarray(p, p + n * 3); p += n * 3; }
      const minKod = u8[p++];
      const idx = lzwDekoduj(bloky(), minKod, w * h);
      // úklid po minulém snímku
      if (predchozi) {
        if (predchozi.disposal === 2) {
          const r = predchozi.rect;
          for (let yy = Math.max(0, r.y); yy < Math.min(H, r.y + r.h); yy++)
            platno.fill(0, (yy * W + Math.max(0, r.x)) * 4, (yy * W + Math.min(W, r.x + r.w)) * 4);
        } else if (predchozi.disposal === 3 && predchozi.zaloha) platno.set(predchozi.zaloha);
      }
      const g = gce || { disposal: 0, pruhledna: -1, delka: 0 };
      const zaloha = g.disposal === 3 ? platno.slice() : null;
      // prokládání: řádky v pořadí 0/8, 4/8, 2/4, 1/2
      const radky = new Int32Array(h);
      if (ip & 0x40) {
        let q = 0;
        for (const [od, krok] of [[0, 8], [4, 8], [2, 4], [1, 2]]) for (let r = od; r < h; r += krok) radky[q++] = r;
      } else for (let r = 0; r < h; r++) radky[r] = r;
      if (tab) for (let q = 0; q < h; q++) {
        const yy = y + radky[q];
        if (yy >= H) continue;
        for (let xx = 0; xx < w; xx++) {
          const c = idx[q * w + xx], X = x + xx;
          if (c === g.pruhledna || X >= W || c * 3 + 2 >= tab.length) continue;
          const o = (yy * W + X) * 4;
          platno[o] = tab[c * 3]; platno[o + 1] = tab[c * 3 + 1]; platno[o + 2] = tab[c * 3 + 2]; platno[o + 3] = 255;
        }
      }
      // jako prohlížeče: zpoždění 0–1 setiny se přehrává jako 100 ms
      snimky.push({ obr: novyObr(W, H, platno.slice()), delka: g.delka < 2 ? 100 : g.delka * 10 });
      predchozi = { disposal: g.disposal, rect: { x, y, w, h }, zaloha };
      gce = null;
    }
    if (!snimky.length) throw new Error('GIF neobsahuje žádný snímek.');
    return { sirka: W, vyska: H, prehrani, snimky };
  }

  // ---------- GIF kodér ----------
  const bitu = n => { let b = 1; while ((1 << b) < n) b++; return b; };

  /* Obdélník, kde se snímek liší od předchozího (null = beze změny). */
  function zmenenyObdelnik(a, b, W, H) {
    const A = new Uint32Array(a.buffer, a.byteOffset, W * H), B = new Uint32Array(b.buffer, b.byteOffset, W * H);
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) {
      const r = y * W;
      for (let x = 0; x < W; x++) if (A[r + x] !== B[r + x]) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  /* snimky: [{ obr, delka (ms) }], všechny stejně velké.
     volby: { barev 2–256, metoda 'mediancut'|'oktan', paleta 'globalni'|'lokalni', dither,
              prehrani (0 = stále, 1 = jednou, n), prah (alfa pod prahem = průhledné), optimalizace, priPrubehu(0–1) } */
  function kodujGif(snimky, volby) {
    const v = Object.assign({ barev: 256, metoda: 'mediancut', paleta: 'globalni', dither: false, prehrani: 0, prah: 128, optimalizace: true }, volby);
    const W = snimky[0].obr.sirka, H = snimky[0].obr.vyska, N = snimky.length;
    const obrazky = snimky.map(s => s.obr);
    let maPruhl = false;
    for (const o of obrazky) { for (let i = 3; i < o.data.length; i += 4) if (o.data[i] < v.prah) { maPruhl = true; break; } if (maPruhl) break; }
    const opt = v.optimalizace && !maPruhl && N > 1;
    // obdélníky snímků a masky nezměněných pixelů
    const obdelniky = [], masky = [];
    for (let k = 0; k < N; k++) {
      if (!opt || k === 0) { obdelniky.push({ x: 0, y: 0, w: W, h: H }); masky.push(null); continue; }
      const a = obrazky[k - 1].data, b = obrazky[k].data;
      const r = zmenenyObdelnik(a, b, W, H) || { x: 0, y: 0, w: 1, h: 1 };
      const m = new Uint8Array(r.w * r.h);
      for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
        const i = ((r.y + y) * W + r.x + x) * 4;
        m[y * r.w + x] = a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2] && a[i + 3] === b[i + 3] ? 1 : 0;
      }
      obdelniky.push(r); masky.push(m);
    }
    const potrebaTi = maPruhl || opt;
    const kBarev = Math.max(2, Math.min(256, v.barev)) - (potrebaTi ? 1 : 0);
    const out = [];
    const bajty = arr => { for (let i = 0; i < arr.length; i++) out.push(arr[i]); };
    const u16 = n => { out.push(n & 255, (n >> 8) & 255); };
    const tabulka = (pal, b) => { const n = 1 << b; for (let i = 0; i < n; i++) { const c = pal[i] || [0, 0, 0]; out.push(c[0], c[1], c[2]); } };
    bajty([71, 73, 70, 56, 57, 97]);   // GIF89a
    u16(W); u16(H);
    let globPal = null, globBity = 0;
    if (v.paleta !== 'lokalni') {
      globPal = paleta(obrazky, kBarev, v.metoda, v.prah, opt ? obdelniky : null);
      globBity = bitu(globPal.length + (potrebaTi ? 1 : 0));
      out.push(0x80 | (7 << 4) | (globBity - 1), 0, 0);
      tabulka(globPal, globBity);
    } else out.push(0x70, 0, 0);
    if (v.prehrani !== 1) {
      bajty([0x21, 0xFF, 0x0B, 78, 69, 84, 83, 67, 65, 80, 69, 50, 46, 48, 3, 1]);
      u16(v.prehrani > 1 ? Math.min(65535, v.prehrani - 1) : 0); out.push(0);
    }
    const najdiGlob = globPal ? hledac(globPal) : null;
    for (let k = 0; k < N; k++) {
      const r = obdelniky[k];
      let pal = globPal, najdi = najdiGlob, bity = globBity;
      if (!pal) {
        pal = paleta([obrazky[k]], kBarev, v.metoda, v.prah, [r]);
        najdi = hledac(pal);
        bity = bitu(pal.length + (potrebaTi ? 1 : 0));
      }
      const ti = potrebaTi ? pal.length : 0;
      const idx = namapuj(obrazky[k], r, pal, najdi, ti, v.prah, v.dither, masky[k]);
      // GCE: disposal 2 (vymazat) u průhledných animací, jinak 1 (ponechat)
      const disposal = maPruhl ? 2 : 1;
      const cs = Math.max(0, Math.min(65535, Math.round(snimky[k].delka / 10)));
      out.push(0x21, 0xF9, 4, (disposal << 2) | (potrebaTi ? 1 : 0), cs & 255, cs >> 8, ti, 0);
      out.push(0x2C); u16(r.x); u16(r.y); u16(r.w); u16(r.h);
      if (v.paleta === 'lokalni') { out.push(0x80 | (bity - 1)); tabulka(pal, bity); } else out.push(0);
      const minKod = Math.max(2, bity);
      out.push(minKod);
      const data = lzwKoduj(idx, minKod);
      for (let i = 0; i < data.length; i += 255) {
        const n = Math.min(255, data.length - i);
        out.push(n);
        for (let j = 0; j < n; j++) out.push(data[i + j]);
      }
      out.push(0);
      if (v.priPrubehu) v.priPrubehu((k + 1) / N);
    }
    out.push(0x3B);
    return Uint8Array.from(out);
  }

  // ---------- APNG ----------
  function filtrujRadky(obr, r) {
    const bpp = 4, radek = r.w * 4, out = new Uint8Array((radek + 1) * r.h);
    const kandidat = new Uint8Array(radek);
    let predchozi = new Uint8Array(radek), aktualni = new Uint8Array(radek);
    for (let y = 0; y < r.h; y++) {
      aktualni.set(obr.data.subarray(((r.y + y) * obr.sirka + r.x) * 4, ((r.y + y) * obr.sirka + r.x + r.w) * 4));
      let nejF = 0, nejS = Infinity;
      for (let f = 0; f < 5; f++) {
        let s = 0;
        for (let i = 0; i < radek; i++) {
          const a = i >= bpp ? aktualni[i - bpp] : 0, b = predchozi[i], c = i >= bpp ? predchozi[i - bpp] : 0;
          let pr;
          if (f === 0) pr = 0; else if (f === 1) pr = a; else if (f === 2) pr = b; else if (f === 3) pr = (a + b) >> 1;
          else { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
          const hodn = (aktualni[i] - pr) & 255;
          kandidat[i] = hodn;
          s += hodn < 128 ? hodn : 256 - hodn;
          if (s >= nejS) break;
        }
        if (s < nejS) { nejS = s; nejF = f; out[y * (radek + 1)] = f; out.set(kandidat, y * (radek + 1) + 1); }
      }
      out[y * (radek + 1)] = nejF;
      [predchozi, aktualni] = [aktualni, predchozi];
    }
    return out;
  }
  function blok(typ, data) {
    const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = typ.charCodeAt(i);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out, 4, 8 + data.length));
    return out;
  }
  /* Animovaný PNG. volby: { prehrani (0 = stále), optimalizace, priPrubehu }. Vrací Promise<Uint8Array>. */
  async function zapisApng(snimky, volby) {
    const v = Object.assign({ prehrani: 0, optimalizace: true }, volby);
    const W = snimky[0].obr.sirka, H = snimky[0].obr.vyska, N = snimky.length;
    const casti = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])];
    const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
    dv.setUint32(0, W); dv.setUint32(4, H); ihdr[8] = 8; ihdr[9] = 6;
    casti.push(blok('IHDR', ihdr));
    const actl = new Uint8Array(8), av = new DataView(actl.buffer);
    av.setUint32(0, N); av.setUint32(4, v.prehrani);
    casti.push(blok('acTL', actl));
    let seq = 0;
    for (let k = 0; k < N; k++) {
      let r = { x: 0, y: 0, w: W, h: H };
      if (v.optimalizace && k > 0) r = zmenenyObdelnik(snimky[k - 1].obr.data, snimky[k].obr.data, W, H) || { x: 0, y: 0, w: 1, h: 1 };
      const fc = new Uint8Array(26), fv = new DataView(fc.buffer);
      fv.setUint32(0, seq++); fv.setUint32(4, r.w); fv.setUint32(8, r.h); fv.setUint32(12, r.x); fv.setUint32(16, r.y);
      fv.setUint16(20, Math.max(0, Math.min(65535, Math.round(snimky[k].delka)))); fv.setUint16(22, 1000);
      fc[24] = 0; fc[25] = 0;   // dispose NONE, blend SOURCE (výřez se přepíše celý i s alfou)
      casti.push(blok('fcTL', fc));
      const z = await zlib(filtrujRadky(snimky[k].obr, r));
      if (k === 0) casti.push(blok('IDAT', z));
      else {
        const d = new Uint8Array(4 + z.length);
        new DataView(d.buffer).setUint32(0, seq++);
        d.set(z, 4);
        casti.push(blok('fdAT', d));
      }
      if (v.priPrubehu) v.priPrubehu((k + 1) / N);
    }
    casti.push(blok('IEND', new Uint8Array(0)));
    return spoj(casti);
  }
  /* Bloky PNG souboru (pro test a kontrolu): [{ typ, data, crcOk }] */
  function blokyPng(u8) {
    const out = [], dv = new DataView(u8.buffer, u8.byteOffset, u8.length);
    let p = 8;
    while (p + 12 <= u8.length) {
      const n = dv.getUint32(p), typ = String.fromCharCode(...u8.subarray(p + 4, p + 8));
      out.push({ typ, data: u8.subarray(p + 8, p + 8 + n), crcOk: crc32(u8, p + 4, p + 8 + n) === dv.getUint32(p + 8 + n) });
      p += 12 + n;
    }
    return out;
  }

  // ---------- sprite sheety: řezání ----------
  /* Pravidelná mřížka: bunkaW/H, okraj (odsazení od kraje), mezera mezi buňkami. */
  function rezMrizka(sirka, vyska, o) {
    const bw = Math.max(1, o.bunkaW | 0), bh = Math.max(1, o.bunkaH | 0);
    const ox = o.okrajX | 0, oy = o.okrajY | 0, mx = o.mezeraX | 0, my = o.mezeraY | 0;
    const out = [];
    for (let y = oy; y + bh <= vyska; y += bh + my)
      for (let x = ox; x + bw <= sirka; x += bw + mx) out.push({ x, y, w: bw, h: bh });
    return out;
  }
  /* Velikost buňky z počtu sloupců a řádků. */
  function bunkaZPoctu(sirka, vyska, sloupcu, radku, o) {
    o = o || {};
    return {
      bunkaW: Math.floor((sirka - 2 * (o.okrajX | 0) - (sloupcu - 1) * (o.mezeraX | 0)) / sloupcu),
      bunkaH: Math.floor((vyska - 2 * (o.okrajY | 0) - (radku - 1) * (o.mezeraY | 0)) / radku),
    };
  }
  function jePrazdny(obr, r, pozadi, tol) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++)
      if (!jePozadi(obr.data, (y * obr.sirka + x) * 4, pozadi, tol)) return false;
    return true;
  }
  function jePozadi(d, i, pozadi, tol) {
    if (!pozadi) return d[i + 3] <= tol;
    if (d[i + 3] <= tol) return true;
    return Math.abs(d[i] - pozadi[0]) <= tol && Math.abs(d[i + 1] - pozadi[1]) <= tol && Math.abs(d[i + 2] - pozadi[2]) <= tol;
  }
  /* Automatické nalezení spritů: souvislé oblasti nepozadí (8-okolí), obdélníky blíž než `spoj` px se sloučí.
     pozadi: null = průhlednost, jinak [r,g,b] (např. barva rohu). Seřazeno po řádcích zleva doprava. */
  function rezAuto(obr, o) {
    o = Object.assign({ pozadi: null, tolerance: 8, spoj: 1, minPlocha: 4 }, o);
    const W = obr.sirka, H = obr.vyska, stav = new Uint8Array(W * H);   // 0 neznámý, 1 pozadí, 2 navštívený
    for (let i = 0; i < W * H; i++) if (jePozadi(obr.data, i * 4, o.pozadi, o.tolerance)) stav[i] = 1;
    let boxy = [];
    const zasobnik = new Int32Array(W * H);
    for (let s = 0; s < W * H; s++) {
      if (stav[s]) continue;
      let vrch = 0, x0 = W, y0 = H, x1 = -1, y1 = -1, n = 0;
      zasobnik[vrch++] = s; stav[s] = 2;
      while (vrch) {
        const i = zasobnik[--vrch], x = i % W, y = (i - x) / W;
        n++;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (!stav[j]) { stav[j] = 2; zasobnik[vrch++] = j; }
        }
      }
      boxy.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, n });
    }
    // slučování blízkých obdélníků (odtržené části postavy)
    let zmena = true;
    while (zmena) {
      zmena = false;
      for (let i = 0; i < boxy.length && !zmena; i++) for (let j = i + 1; j < boxy.length; j++) {
        const a = boxy[i], b = boxy[j];
        if (a.x - o.spoj <= b.x + b.w - 1 && b.x - o.spoj <= a.x + a.w - 1 && a.y - o.spoj <= b.y + b.h - 1 && b.y - o.spoj <= a.y + a.h - 1) {
          const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
          boxy[i] = { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y, n: a.n + b.n };
          boxy.splice(j, 1); zmena = true; break;
        }
      }
    }
    boxy = boxy.filter(b => b.n >= o.minPlocha);
    return seradPoRadcich(boxy).map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
  }
  function seradPoRadcich(boxy) {
    const zbyva = boxy.slice().sort((a, b) => a.y - b.y), out = [];
    while (zbyva.length) {
      const prvni = zbyva[0];
      let dno = prvni.y + prvni.h;
      const radek = [];
      for (let i = 0; i < zbyva.length;) {
        const b = zbyva[i];
        if (b.y + b.h / 2 < dno) { radek.push(b); zbyva.splice(i, 1); dno = Math.max(dno, Math.min(b.y + b.h, prvni.y + prvni.h * 1.5)); }
        else i++;
      }
      out.push(...radek.sort((a, b) => a.x - b.x));
    }
    return out;
  }

  // ---------- sprite sheety: balení ----------
  /* Nejmenší obdélník s alfou > 0 (prázdný obrázek → 1×1 v rohu). */
  function orezPruhledne(obr) {
    const W = obr.sirka, H = obr.vyska, d = obr.data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3]) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return x1 < 0 ? { x: 0, y: 0, w: 1, h: 1 } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  const mocnina2 = n => { let p = 1; while (p < n) p *= 2; return p; };
  /* Rozmístění obdélníků [{w,h}] do listu.
     volby: { rezim 'mrizka'|'baleni', sloupcu (mřížka, 0 = auto), mezera, okraj, mocninaDvou } */
  function zabal(rozmery, volby) {
    const o = Object.assign({ rezim: 'mrizka', sloupcu: 0, mezera: 0, okraj: 0, mocninaDvou: false }, volby);
    const n = rozmery.length, m = o.mezera, ok = o.okraj;
    const pozice = new Array(n);
    let sirka = 0, vyska = 0;
    if (o.rezim === 'mrizka') {
      const bw = Math.max(...rozmery.map(r => r.w)), bh = Math.max(...rozmery.map(r => r.h));
      const sl = o.sloupcu > 0 ? Math.min(n, o.sloupcu) : Math.ceil(Math.sqrt(n));
      const ra = Math.ceil(n / sl);
      for (let i = 0; i < n; i++) pozice[i] = { x: ok + (i % sl) * (bw + m), y: ok + Math.floor(i / sl) * (bh + m) };
      sirka = 2 * ok + sl * bw + (sl - 1) * m; vyska = 2 * ok + ra * bh + (ra - 1) * m;
    } else {
      // police: seřadit podle výšky, šířka listu ≈ odmocnina z plochy
      const plocha = rozmery.reduce((s, r) => s + (r.w + m) * (r.h + m), 0);
      const maxW = Math.max(...rozmery.map(r => r.w));
      let cil = Math.max(maxW, Math.ceil(Math.sqrt(plocha * 1.08)));
      if (o.mocninaDvou) cil = Math.max(mocnina2(maxW + 2 * ok), mocnina2(cil));
      const poradi = rozmery.map((r, i) => i).sort((a, b) => rozmery[b].h - rozmery[a].h || rozmery[b].w - rozmery[a].w);
      let x = ok, y = ok, vyskaRadku = 0;
      for (const i of poradi) {
        const r = rozmery[i];
        if (x > ok && x + r.w + ok > cil) { x = ok; y += vyskaRadku + m; vyskaRadku = 0; }
        pozice[i] = { x, y };
        x += r.w + m; vyskaRadku = Math.max(vyskaRadku, r.h);
        sirka = Math.max(sirka, x - m + ok);
      }
      vyska = y + vyskaRadku + ok;
    }
    if (o.mocninaDvou) { sirka = mocnina2(sirka); vyska = mocnina2(vyska); }
    return { sirka, vyska, pozice };
  }
  /* Celý sprite sheet: snimky [{ obr, delka }], volby jako zabal + orez (trim), format 'hash'|'array',
     predpona (název snímku), cislic, obrazek (název PNG). Vrací { obr, json }. */
  function spriteSheet(snimky, volby) {
    const o = Object.assign({ orez: false, format: 'hash', predpona: 'snimek_', cislic: 3, obrazek: 'sprite.png', priponaPng: false }, volby);
    const W = snimky[0].obr.sirka, H = snimky[0].obr.vyska;
    const vyrezy = snimky.map(s => o.orez ? orezPruhledne(s.obr) : { x: 0, y: 0, w: W, h: H });
    const bal = zabal(vyrezy.map(r => ({ w: r.w, h: r.h })), o);
    const list = novyObr(bal.sirka, bal.vyska), L = new Uint32Array(list.data.buffer);
    snimky.forEach((s, k) => {
      const r = vyrezy[k], p = bal.pozice[k], S = new Uint32Array(s.obr.data.buffer, s.obr.data.byteOffset, W * H);
      for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) L[(p.y + y) * bal.sirka + p.x + x] = S[(r.y + y) * W + r.x + x];
    });
    const snimkyJson = snimky.map((s, k) => {
      const r = vyrezy[k], p = bal.pozice[k];
      return {
        nazev: o.predpona + String(k).padStart(o.cislic, '0') + (o.priponaPng ? '.png' : ''),
        data: {
          frame: { x: p.x, y: p.y, w: r.w, h: r.h }, rotated: false,
          trimmed: r.w !== W || r.h !== H,
          spriteSourceSize: { x: r.x, y: r.y, w: r.w, h: r.h },
          sourceSize: { w: W, h: H },
          duration: Math.round(s.delka),
        },
      };
    });
    const meta = {
      app: 'GIF, animace a sprite sheety (lavionus.github.io/site)', version: '1.0',
      image: o.obrazek, format: 'RGBA8888', size: { w: bal.sirka, h: bal.vyska }, scale: '1',
      frameTags: [{ name: o.predpona.replace(/[_\-. ]+$/, '') || 'animace', from: 0, to: snimky.length - 1, direction: 'forward' }],
    };
    const json = o.format === 'array'
      ? { frames: snimkyJson.map(s => Object.assign({ filename: s.nazev }, s.data)), meta }
      : { frames: Object.fromEntries(snimkyJson.map(s => [s.nazev, s.data])), meta };
    return { obr: list, json };
  }

  // ---------- odhad velikosti ----------
  /* Zakóduje nanejvýš `vzorek` po sobě jdoucích snímků a přepočítá na celek. */
  /* snimky mohou být už jen vzorek – pak `celkem` udává skutečný počet snímků. */
  async function odhadVelikosti(snimky, format, volby, vzorek, celkem) {
    const n = Math.max(celkem || 0, snimky.length), k = Math.min(snimky.length, vzorek || 6);
    if (!n) return 0;
    // vzorek ze středu animace (začátek bývá statický)
    const od = Math.max(0, Math.floor((snimky.length - k) / 2)), vyber = snimky.slice(od, od + k);
    const koduj = v => format === 'apng' ? zapisApng(v, volby) : kodujGif(v, volby);
    const data = await koduj(vyber);
    if (k === n) return data.length;
    // přírůstek na snímek = (k snímků − první snímek) / (k − 1); hlavička a 1. snímek se počítají jednou
    const jeden = (await koduj(vyber.slice(0, 1))).length;
    return Math.round(data.length + (data.length - jeden) / Math.max(1, k - 1) * (n - k));
  }

  const API = {
    novyObr, orez, umisti, zmenVelikost, zrcadli, otoc90,
    obrat, pingPong, presun,
    crc32, adler32, zlib, zlibUlozeno, zip,
    paleta, medianCut: (o, k, p) => medianCut(sberPixelu(o, p === undefined ? 128 : p), k),
    oktanovyStrom: (o, k, p) => oktanovyStrom(sberPixelu(o, p === undefined ? 128 : p), k),
    hledac, lzwKoduj, lzwDekoduj,
    dekodujGif, kodujGif, zmenenyObdelnik,
    zapisApng, blokyPng,
    rezMrizka, bunkaZPoctu, rezAuto, jePrazdny, orezPruhledne, zabal, spriteSheet,
    odhadVelikosti,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else koren.ANIMACE_GIF = API;
})(typeof self !== 'undefined' ? self : this);

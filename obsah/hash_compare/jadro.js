/* Jádro Porovnání otisků souborů (HASHJADRO) – bez DOM, běží v prohlížeči, ve workeru i v node.
   - postupné (blokové) MD5, SHA-1 a SHA-256 pro soubory, které se nevejdou do jednoho bufferu
     (crypto.subtle umí jen celý buffer najednou); MD5 v crypto.subtle vůbec není,
   - čtení manifestů: sha256sum/md5sum (i s * pro binární režim a GNU escapováním „\“), BSD tag
     „SHA256 (cesta) = otisk“, CSV (oddělovač , ; nebo tab) a JSON,
   - tvorba manifestů (sha*sum, CSV, JSON) a porovnání manifestu se složkou vč. přejmenování.
   Test: node _test/hash_compare_test.js */
(function (koren) {
  'use strict';

  // Algoritmy v pořadí od nejsilnějšího; slabé jen pro shodu se staršími manifesty.
  const ALGORITMY = ['SHA-512', 'SHA-384', 'SHA-256', 'SHA-1', 'MD5'];
  const SLABE = { 'SHA-1': true, 'MD5': true };
  const DELKA = { 32: 'MD5', 40: 'SHA-1', 64: 'SHA-256', 96: 'SHA-384', 128: 'SHA-512' }; // počet hex znaků

  function normAlg(s) {
    const t = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const m = { MD5: 'MD5', SHA1: 'SHA-1', SHA256: 'SHA-256', SHA384: 'SHA-384', SHA512: 'SHA-512' };
    return m[t] || m[t.replace(/SUM$/, '')] || null;
  }

  function hex(b) {
    let s = '';
    for (let i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16);
    return s;
  }

  // ---------- postupné hashe (Merkle–Damgård, bloky 64 B) ----------
  function rotl(x, n) { return (x << n) | (x >>> (32 - n)); }

  // blok(h, slova) zpracuje 16 slov bloku; velke = big-endian (SHA), jinak little-endian (MD5)
  function vyrobaHashe(init, blok, velke) {
    return function () {
      const h = Int32Array.from(init), buf = new Uint8Array(64), m = new Int32Array(16);
      let n = 0, delka = 0;
      function zpracuj(d, o) {
        for (let i = 0; i < 16; i++, o += 4) {
          m[i] = velke ? (d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]
                       : d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24);
        }
        blok(h, m);
      }
      return {
        update(data) {
          const d = data instanceof Uint8Array ? data : new Uint8Array(data);
          let i = 0;
          delka += d.length;
          if (n) {
            while (n < 64 && i < d.length) buf[n++] = d[i++];
            if (n < 64) return this;
            zpracuj(buf, 0); n = 0;
          }
          for (; i + 64 <= d.length; i += 64) zpracuj(d, i);
          while (i < d.length) buf[n++] = d[i++];
          return this;
        },
        digest() {
          const bity = [Math.floor(delka / 0x20000000) >>> 0, ((delka % 0x20000000) * 8) >>> 0]; // [horní, dolní]
          buf[n++] = 0x80;
          if (n > 56) { buf.fill(0, n); zpracuj(buf, 0); n = 0; }
          buf.fill(0, n);
          for (let i = 0; i < 4; i++) {
            if (velke) { buf[56 + i] = bity[0] >>> (24 - 8 * i); buf[60 + i] = bity[1] >>> (24 - 8 * i); }
            else { buf[56 + i] = bity[1] >>> (8 * i); buf[60 + i] = bity[0] >>> (8 * i); }
          }
          zpracuj(buf, 0);
          const out = new Uint8Array(h.length * 4);
          for (let i = 0; i < h.length; i++) for (let j = 0; j < 4; j++) {
            out[i * 4 + j] = velke ? h[i] >>> (24 - 8 * j) : h[i] >>> (8 * j);
          }
          return hex(out);
        },
      };
    };
  }

  const MD5_K = new Int32Array(64), MD5_S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  for (let i = 0; i < 64; i++) MD5_K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
  const md5 = vyrobaHashe([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476], (h, m) => {
    let a = h[0], b = h[1], c = h[2], d = h[3];
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) & 15; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) & 15; }
      else { f = c ^ (b | ~d); g = (7 * i) & 15; }
      f = (f + a + MD5_K[i] + m[g]) | 0;
      a = d; d = c; c = b;
      b = (b + rotl(f, MD5_S[(i >> 4) * 4 + (i & 3)])) | 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d;
  }, false);

  const W80 = new Int32Array(80);
  const sha1 = vyrobaHashe([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0], (h, m) => {
    const w = W80;
    for (let i = 0; i < 16; i++) w[i] = m[i];
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4];
    for (let i = 0; i < 80; i++) {
      let f, k;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const t = (rotl(a, 5) + f + e + k + w[i]) | 0;
      e = d; d = c; c = rotl(b, 30); b = a; a = t;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e;
  }, true);

  const K256 = Int32Array.from([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const W64 = new Int32Array(64);
  const sha256 = vyrobaHashe([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], (h, m) => {
    const w = W64;
    for (let i = 0; i < 16; i++) w[i] = m[i];
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2];
      const s0 = (x >>> 7 | x << 25) ^ (x >>> 18 | x << 14) ^ (x >>> 3);
      const s1 = (y >>> 17 | y << 15) ^ (y >>> 19 | y << 13) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (let i = 0; i < 64; i++) {
      const S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
      const t1 = (hh + S1 + ((e & f) ^ (~e & g)) + K256[i] + w[i]) | 0;
      const S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
      const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }, true);

  // Postupné algoritmy (SHA-384/512 jen přes crypto.subtle – celým bufferem).
  const POSTUPNE = { 'MD5': md5, 'SHA-1': sha1, 'SHA-256': sha256 };

  // ---------- pomocné ----------
  // „\“ jako oddělovač bere jen z manifestů (Windows nástroje); vlastní cesty prohlížeče ho nemají
  function winCesta(c) { return normCesta(String(c || '').replace(/\\/g, '/')); }
  function normCesta(c) {
    c = String(c || '').replace(/^(\.\/)+/, '').replace(/^\/+/, '');
    return c.replace(/\/{2,}/g, '/');
  }
  function bezBom(t) { return String(t || '').replace(/^\uFEFF/, ''); }

  // GNU coreutils: název s „\“ nebo novým řádkem → řádek začíná „\“ a znaky jsou escapované
  function gnuEscape(c) { return c.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r'); }
  function gnuUnescape(c) { return c.replace(/\\(.)/g, (_, z) => (z === 'n' ? '\n' : z === 'r' ? '\r' : z)); }

  function csvRadky(text, odd) {
    const radky = []; let r = [], pole = '', uvoz = false;
    for (let i = 0; i < text.length; i++) {
      const z = text[i];
      if (uvoz) {
        if (z === '"') { if (text[i + 1] === '"') { pole += '"'; i++; } else uvoz = false; }
        else pole += z;
      } else if (z === '"') uvoz = true;
      else if (z === odd) { r.push(pole); pole = ''; }
      else if (z === '\n' || z === '\r') {
        if (z === '\r' && text[i + 1] === '\n') i++;
        r.push(pole); radky.push(r); r = []; pole = '';
      } else pole += z;
    }
    if (pole !== '' || r.length) { r.push(pole); radky.push(r); }
    return radky.filter(x => x.some(p => p.trim() !== ''));
  }
  // CSV injection (OWASP): buňku začínající = + - @ tab CR (i za apostrofy) prefixovat apostrofem, čísla ne
  const bezVzorce = s => (/^'*[=+\-@\t\r]/.test(s) && !/^[+-]?\d+([.,]\d+)?$/.test(s) ? "'" + s : s);
  // import: apostrof přidaný při exportu zase odebrat (round-trip i pro názvy jako „=SUM(A1).txt“)
  const sVzorcem = s => (/^'+[=+\-@\t\r]/.test(s) ? s.slice(1) : s);
  function csvPole(v) {
    const s = bezVzorce(v == null ? '' : String(v));
    return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  const SLOUPEC_CESTA = /^(cesta|path|soubor|file|filename|name|nazev|název|relativepath)$/i;
  const SLOUPEC_VEL = /^(velikost|size|bytes|bajty)$/i;

  // ---------- čtení manifestu ----------
  // → { format, polozky: [{cesta, otisky:{ALG:hex}, velikost?}], algoritmy:[…], chyby:[{radek, text}] }
  function parsujManifest(text) {
    text = bezBom(text);
    const t = text.trim();
    let v;
    if (t[0] === '{' || t[0] === '[') v = parsujJson(t);
    else {
      const prvni = (t.split(/\r?\n/)[0] || '');
      const odd = [';', '\t', ','].find(o => prvni.split(o).some(p => SLOUPEC_CESTA.test(p.trim().replace(/^"|"$/g, ''))));
      v = odd ? parsujCsv(text, odd) : parsujSum(text);
    }
    const alg = new Set();
    v.polozky.forEach(p => Object.keys(p.otisky).forEach(a => alg.add(a)));
    v.algoritmy = ALGORITMY.filter(a => alg.has(a));
    return v;
  }

  function pridejOtisk(otisky, alg, h, chyby, radek) {
    h = String(h || '').trim().toLowerCase();
    if (!h) return;
    if (!/^[0-9a-f]+$/.test(h) || (alg && DELKA[h.length] !== alg) || (!alg && !DELKA[h.length])) {
      chyby.push({ radek, text: 'neplatný otisk ' + h.slice(0, 20) });
      return;
    }
    otisky[alg || DELKA[h.length]] = h;
  }

  function parsujSum(text) {
    const polozky = [], chyby = [];
    text.split(/\r?\n/).forEach((r, i) => {
      if (!r.trim() || /^\s*[#;]/.test(r)) return;
      let m = /^\\?([A-Za-z0-9-]+) \((.*)\) = ([0-9a-fA-F]+)\s*$/.exec(r); // BSD: SHA256 (cesta) = otisk
      if (m && normAlg(m[1])) {
        const otisky = {}; const n = chyby.length;
        pridejOtisk(otisky, normAlg(m[1]), m[3], chyby, i + 1);
        if (chyby.length === n) polozky.push({ cesta: r[0] === '\\' ? normCesta(gnuUnescape(m[2])) : winCesta(m[2]), otisky });
        return;
      }
      m = /^(\\?)([0-9a-fA-F]+) [ *](.+)$/.exec(r); // GNU: otisk, mezera, mezera nebo * (binární), cesta
      if (!m) { chyby.push({ radek: i + 1, text: 'nerozpoznaný řádek' }); return; }
      const otisky = {}; const n = chyby.length;
      pridejOtisk(otisky, null, m[2], chyby, i + 1);
      if (chyby.length > n) return;
      polozky.push({ cesta: m[1] ? normCesta(gnuUnescape(m[3])) : winCesta(m[3]), otisky });
    });
    return { format: 'sum', polozky, chyby };
  }

  function parsujCsv(text, odd) {
    const radky = csvRadky(text, odd), polozky = [], chyby = [];
    const hlav = radky.shift().map(s => s.trim());
    const iCesta = hlav.findIndex(s => SLOUPEC_CESTA.test(s));
    const iVel = hlav.findIndex(s => SLOUPEC_VEL.test(s));
    const alg = hlav.map(normAlg);
    radky.forEach((r, i) => {
      const cesta = winCesta(sVzorcem(r[iCesta] || ''));
      if (!cesta) { chyby.push({ radek: i + 2, text: 'chybí cesta' }); return; }
      const otisky = {};
      alg.forEach((a, j) => { if (a) pridejOtisk(otisky, a, r[j], chyby, i + 2); });
      if (!Object.keys(otisky).length) { chyby.push({ radek: i + 2, text: 'řádek bez otisku' }); return; }
      const p = { cesta, otisky };
      if (iVel >= 0 && r[iVel] !== undefined && r[iVel].trim() !== '' && isFinite(+r[iVel])) p.velikost = +r[iVel];
      polozky.push(p);
    });
    return { format: 'csv', polozky, chyby };
  }

  function parsujJson(t) {
    const chyby = [], polozky = [];
    let d;
    try { d = JSON.parse(t); } catch (e) { return { format: 'json', polozky, chyby: [{ radek: 0, text: 'neplatný JSON' }] }; }
    let seznam = Array.isArray(d) ? d : (d.soubory || d.files);
    if (!Array.isArray(seznam) && d && typeof d === 'object') { // mapa { "cesta": "otisk" }
      seznam = Object.keys(d).filter(k => typeof d[k] === 'string').map(k => ({ cesta: k, otisk: d[k] }));
    }
    (seznam || []).forEach((s, i) => {
      if (!s || typeof s !== 'object') return;
      const cesta = winCesta(s.cesta || s.path || s.soubor || s.file || s.name);
      if (!cesta) { chyby.push({ radek: i + 1, text: 'chybí cesta' }); return; }
      const otisky = {};
      const zdroj = Object.assign({}, s, s.otisky || s.hashes || {});
      Object.keys(zdroj).forEach(k => { const a = normAlg(k); if (a) pridejOtisk(otisky, a, zdroj[k], chyby, i + 1); });
      if (s.otisk || s.hash) pridejOtisk(otisky, null, s.otisk || s.hash, chyby, i + 1);
      if (!Object.keys(otisky).length) { chyby.push({ radek: i + 1, text: 'položka bez otisku' }); return; }
      const p = { cesta, otisky };
      const vel = s.velikost != null ? s.velikost : s.size;
      if (vel != null && isFinite(+vel)) p.velikost = +vel;
      polozky.push(p);
    });
    return { format: 'json', polozky, chyby };
  }

  // ---------- tvorba manifestu ----------
  // soubory: [{cesta, velikost, zmeneno (ms), otisky:{ALG:hex}}]
  function manifestSum(soubory, alg) {
    return soubory.filter(s => s.otisky && s.otisky[alg]).map(s => {
      const c = normCesta(s.cesta), esc = /[\\\n\r]/.test(c);
      return (esc ? '\\' : '') + s.otisky[alg] + '  ' + (esc ? gnuEscape(c) : c);
    }).join('\n') + '\n';
  }
  function manifestCsv(soubory, algoritmy) {
    const r = [['cesta', 'velikost', 'zmeneno'].concat(algoritmy).join(',')];
    soubory.forEach(s => r.push([s.cesta, s.velikost, s.zmeneno ? new Date(s.zmeneno).toISOString() : '']
      .concat(algoritmy.map(a => (s.otisky && s.otisky[a]) || '')).map(csvPole).join(',')));
    return r.join('\r\n') + '\r\n';
  }
  function manifestJson(soubory, algoritmy, info) {
    return JSON.stringify(Object.assign({ nastroj: 'Porovnání otisků souborů', vytvoreno: new Date().toISOString(), algoritmy }, info || {}, {
      soubory: soubory.map(s => ({
        cesta: s.cesta, velikost: s.velikost,
        zmeneno: s.zmeneno ? new Date(s.zmeneno).toISOString() : null,
        otisky: algoritmy.reduce((o, a) => { if (s.otisky && s.otisky[a]) o[a] = s.otisky[a]; return o; }, {}),
      })),
    }), null, 2) + '\n';
  }

  // ---------- porovnání manifestu se složkou ----------
  // Algoritmus: nejsilnější, který má manifest i složka. Cesty se zkusí i bez první složky
  // (vybraná složka „dukazy/a.txt“ vs. manifest vytvořený uvnitř ní „a.txt“).
  function bezPrvni(c) { const i = c.indexOf('/'); return i < 0 ? c : c.slice(i + 1); }

  function porovnej(manifest, soubory) {
    const mPol = manifest.polozky || manifest;
    const mAlg = new Set(); mPol.forEach(p => Object.keys(p.otisky).forEach(a => mAlg.add(a)));
    const sAlg = new Set(); soubory.forEach(s => Object.keys(s.otisky || {}).forEach(a => sAlg.add(a)));
    const alg = ALGORITMY.find(a => mAlg.has(a) && sAlg.has(a)) || null;

    const varianty = [[c => c, c => c], [c => c, bezPrvni], [bezPrvni, c => c]];
    let nej = varianty[0], nejN = -1;
    varianty.forEach(v => {
      const s = new Set(soubory.map(x => v[1](normCesta(x.cesta))));
      const n = mPol.filter(p => s.has(v[0](p.cesta))).length;
      if (n > nejN) { nej = v; nejN = n; }
    });
    const klicM = p => nej[0](normCesta(p.cesta)), klicS = s => nej[1](normCesta(s.cesta));

    const podleCesty = new Map(); soubory.forEach(s => { if (!podleCesty.has(klicS(s))) podleCesty.set(klicS(s), s); });
    const vManifestu = new Set(mPol.map(klicM));
    const pouzite = new Set();
    const vysledky = [];
    const chybejici = [];
    mPol.forEach(p => {
      const s = podleCesty.get(klicM(p));
      if (!s) { chybejici.push(p); return; }
      pouzite.add(s);
      const hm = alg && p.otisky[alg], hs = alg && s.otisky && s.otisky[alg];
      vysledky.push({ stav: !hm || !hs ? 'neovereno' : hm === hs ? 'shoda' : 'zmeneno', cesta: s.cesta, manifest: p, soubor: s });
    });
    // přejmenované: chybí podle cesty, ale stejný otisk má soubor, který v manifestu není
    const volne = new Map();
    soubory.forEach(s => {
      const h = alg && s.otisky && s.otisky[alg];
      if (h && !pouzite.has(s) && !vManifestu.has(klicS(s))) { if (!volne.has(h)) volne.set(h, []); volne.get(h).push(s); }
    });
    chybejici.forEach(p => {
      const kand = alg && p.otisky[alg] && volne.get(p.otisky[alg]);
      if (kand && kand.length) {
        const s = kand.shift(); pouzite.add(s);
        vysledky.push({ stav: 'prejmenovano', cesta: s.cesta, puvodni: p.cesta, manifest: p, soubor: s });
      } else vysledky.push({ stav: 'chybi', cesta: p.cesta, manifest: p, soubor: null });
    });
    soubory.forEach(s => { if (!pouzite.has(s)) vysledky.push({ stav: 'navic', cesta: s.cesta, manifest: null, soubor: s }); });

    const souhrn = { shoda: 0, zmeneno: 0, chybi: 0, navic: 0, prejmenovano: 0, neovereno: 0 };
    vysledky.forEach(v => { souhrn[v.stav]++; });
    vysledky.sort((a, b) => (a.cesta < b.cesta ? -1 : a.cesta > b.cesta ? 1 : 0));
    return { algoritmus: alg, vysledky, souhrn, celkem: vysledky.length };
  }

  // výsledek celého ověření: 'nepotvrzena' (změněno/chybí), 'neuplne' (něco neověřeno nebo nic ke shodě),
  // 'potvrzena' (vše z manifestu se shoduje; přejmenované soubory mají shodný obsah)
  function verdikt(souhrn) {
    if (!souhrn) return 'neuplne';
    if (souhrn.zmeneno || souhrn.chybi) return 'nepotvrzena';
    if (souhrn.neovereno || !(souhrn.shoda + souhrn.prejmenovano)) return 'neuplne';
    return 'potvrzena';
  }

  const api = {
    ALGORITMY, SLABE, DELKA, POSTUPNE, normAlg, hex, normCesta,
    md5, sha1, sha256, parsujManifest, manifestSum, manifestCsv, manifestJson, porovnej, verdikt, csvRadky, bezVzorce,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else koren.HASHJADRO = api;
})(typeof self !== 'undefined' ? self : this);

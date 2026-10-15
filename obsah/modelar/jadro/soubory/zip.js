/* Modelář 3D – minimální ZIP (pro 3MF) bez knihoven (bez DOM, jde v node).
   Zápis: soubory uložené (store) nebo zkomprimované deflate-raw přes nativní
   CompressionStream, když ho prohlížeč má. Čtení: store a deflate přes
   DecompressionStream. Bez ZIP64, šifrování a vícesvazkových archivů
   (3MF je nepotřebují); rozbalení je omezené velikostí kvůli zip bombám. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  const CRC = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    CRC[n] = c >>> 0;
  }
  function crc32(d) {
    let c = 0xffffffff;
    for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  async function proudem(data, proud) {
    const r = new Blob([data]).stream().pipeThrough(proud);
    return new Uint8Array(await new Response(r).arrayBuffer());
  }
  /** Rozbalí proud a přitom počítá skutečné bajty: nad limit přeruší (zip bomba
      s falešnou velikostí v hlavičce se tak nerozbalí celá do paměti). */
  async function rozbalOmezene(data, proud, limit) {
    const reader = new Blob([data]).stream().pipeThrough(proud).getReader();
    const kusy = [];
    let n = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      n += value.length;
      if (n > limit) { try { await reader.cancel(); } catch (e) { /* už zavřený */ } throw new Error('archiv je po rozbalení příliš velký'); }
      kusy.push(value);
    }
    const out = new Uint8Array(n);
    let o = 0;
    for (const k of kusy) { out.set(k, o); o += k.length; }
    return out;
  }
  const umiKomprimovat = () => typeof CompressionStream !== 'undefined' && (() => {
    try { new CompressionStream('deflate-raw'); return true; } catch (e) { return false; }
  })();

  M.zip = {
    crc32,
    rozbalOmezene,
    /** soubory: [{nazev, data: Uint8Array | string}] → Uint8Array s archivem ZIP. */
    async zapis(soubory, volby = {}) {
      const kompr = volby.komprimovat !== false && umiKomprimovat();
      const enc = new TextEncoder();
      const casti = [], centralni = [];
      let pos = 0;
      for (const s of soubory) {
        const data = typeof s.data === 'string' ? enc.encode(s.data) : s.data;
        const jmeno = enc.encode(s.nazev);
        let ulozena = data, metoda = 0;
        if (kompr && data.length > 64) {
          const z = await proudem(data, new CompressionStream('deflate-raw'));
          if (z.length < data.length) { ulozena = z; metoda = 8; }
        }
        const crc = crc32(data);
        const h = new DataView(new ArrayBuffer(30));
        h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);   // UTF-8 jména
        h.setUint16(8, metoda, true); h.setUint16(10, 0, true); h.setUint16(12, 0x21, true);         // čas/datum 1980-01-01
        h.setUint32(14, crc, true); h.setUint32(18, ulozena.length, true); h.setUint32(22, data.length, true);
        h.setUint16(26, jmeno.length, true); h.setUint16(28, 0, true);
        casti.push(new Uint8Array(h.buffer), jmeno, ulozena);
        const c = new DataView(new ArrayBuffer(46));
        c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
        c.setUint16(10, metoda, true); c.setUint16(12, 0, true); c.setUint16(14, 0x21, true);
        c.setUint32(16, crc, true); c.setUint32(20, ulozena.length, true); c.setUint32(24, data.length, true);
        c.setUint16(28, jmeno.length, true); c.setUint32(42, pos, true);
        centralni.push(new Uint8Array(c.buffer), jmeno);
        pos += 30 + jmeno.length + ulozena.length;
      }
      const velCentralni = centralni.reduce((s, x) => s + x.length, 0);
      const k = new DataView(new ArrayBuffer(22));
      k.setUint32(0, 0x06054b50, true); k.setUint16(8, soubory.length, true); k.setUint16(10, soubory.length, true);
      k.setUint32(12, velCentralni, true); k.setUint32(16, pos, true);
      const vse = casti.concat(centralni, [new Uint8Array(k.buffer)]);
      const out = new Uint8Array(vse.reduce((s, x) => s + x.length, 0));
      let o = 0;
      for (const x of vse) { out.set(x, o); o += x.length; }
      return out;
    },

    /** Uint8Array s archivem → Map(název → Uint8Array). limit = max. rozbalená velikost. */
    async cti(buf, limit = 512 * 1024 * 1024) {
      const d = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      let e = -1;
      for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (d.getUint32(i, true) === 0x06054b50) { e = i; break; }
      if (e < 0) throw new Error('není to archiv ZIP');
      const pocet = d.getUint16(e + 10, true);
      let p = d.getUint32(e + 16, true);
      const utf8 = new TextDecoder(), utf8Prisne = new TextDecoder('utf-8', { fatal: true });
      // jména bez příznaku UTF-8 (0x800): macOS a Info-ZIP píšou UTF-8 bez příznaku, Windows kódovou stránku
      // (CP437/1250) – nejdřív zkusit platné UTF-8, jinak windows-1250 (latin1 aspoň nerozbije ASCII)
      let jine;
      try { jine = new TextDecoder('windows-1250'); } catch (x) { jine = new TextDecoder('latin1'); }
      const jmenoZ = (b, flag) => { if (flag) return utf8.decode(b); try { return utf8Prisne.decode(b); } catch (x) { return jine.decode(b); } };
      const out = new Map();
      let celkem = 0;
      const poskozeny = () => new Error('poškozený archiv ZIP');
      for (let i = 0; i < pocet; i++) {
        if (p + 46 > buf.length || d.getUint32(p, true) !== 0x02014b50) throw poskozeny();
        const flagy = d.getUint16(p + 8, true), metoda = d.getUint16(p + 10, true);
        const velZ = d.getUint32(p + 20, true), vel = d.getUint32(p + 24, true);
        const nj = d.getUint16(p + 28, true), ne = d.getUint16(p + 30, true), nk = d.getUint16(p + 32, true);
        const lok = d.getUint32(p + 42, true);
        const crc = d.getUint32(p + 16, true);
        if (velZ === 0xffffffff || vel === 0xffffffff || lok === 0xffffffff) throw new Error('archiv ZIP64 (nad 4 GB) není podporovaný');
        const jmeno = jmenoZ(buf.subarray(p + 46, p + 46 + nj), flagy & 0x800);
        p += 46 + nj + ne + nk;
        if (flagy & 1) throw new Error('šifrovaný ZIP není podporovaný');
        if (jmeno.endsWith('/')) continue;
        celkem += vel;
        if (celkem > limit) throw new Error('archiv je po rozbalení příliš velký');
        if (lok + 30 > buf.length || d.getUint32(lok, true) !== 0x04034b50) throw poskozeny();
        const zac = lok + 30 + d.getUint16(lok + 26, true) + d.getUint16(lok + 28, true);
        if (zac + velZ > buf.length) throw poskozeny();
        const surova = buf.subarray(zac, zac + velZ);
        let data;
        if (metoda === 0) data = surova.slice();
        else if (metoda === 8) {
          if (typeof DecompressionStream === 'undefined') throw new Error('prohlížeč neumí rozbalit ZIP (deflate)');
          // skutečná velikost se hlídá při rozbalování (hlavička může lhát)
          data = await rozbalOmezene(surova, new DecompressionStream('deflate-raw'), Math.min(vel, limit - (celkem - vel)));
        } else throw new Error('nepodporovaná komprese ZIP (' + metoda + ')');
        if (data.length !== vel || crc32(data) !== crc) throw new Error('poškozený archiv ZIP (soubor ' + jmeno + ' nesedí s kontrolním součtem)');
        out.set(jmeno, data);
      }
      return out;
    },
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);

/* Kroniky vyhnanství – jádro čtečky bez DOM (rozbor kapitol, hledání, časy, EPUB).
   V prohlížeči window.KRONIKY_JADRO, v node require(). */
(function (koren) {
  'use strict';

  // Kapitoly používají jen: „# nadpis“, odstavce, *kurzívu* a samotnou „*“ jako předěl scén.
  function rozeber(md) {
    return md.replace(/\r/g, '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).map(s => {
      if (/^\*+$/.test(s) || /^(\* ?){3,}$/.test(s)) return { typ: 'hr', md: '', text: '' };
      const h = s.match(/^#\s+(.*)$/s);
      const md1 = (h ? h[1] : s).replace(/\s*\n\s*/g, ' ');
      return { typ: h ? 'h' : 'p', md: md1, text: prosty(md1) };
    });
  }

  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const inline = md => esc(md).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
  const prosty = md => md.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
  const slov = s => (s.match(/\S+/g) || []).length;

  // bez diakritiky a velkých písmen, se zachovanou délkou (pozice shody platí i v originálu)
  const normalizuj = s => Array.from(s, z => (z.normalize('NFD')[0] || z).toLowerCase()).join('');

  /* kapitoly: [{kniha, kap, nazev, bloky}] → [{kniha, kap, blok, pred, shoda, po}] */
  function hledej(kapitoly, dotaz, max = 300) {
    const q = normalizuj(dotaz.trim());
    if (q.length < 2) return [];
    const vysledky = [];
    for (const k of kapitoly) {
      k.bloky.forEach((b, i) => {
        if (!b.text) return;
        const t = normalizuj(b.text);
        for (let p = t.indexOf(q); p >= 0 && vysledky.length < max; p = t.indexOf(q, p + q.length)) {
          vysledky.push({
            kniha: k.kniha, kap: k.kap, blok: i, pozice: p,
            pred: (p > 50 ? '…' : '') + b.text.slice(Math.max(0, p - 50), p),
            shoda: b.text.slice(p, p + q.length),
            po: b.text.slice(p + q.length, p + q.length + 70) + (p + q.length + 70 < b.text.length ? '…' : ''),
          });
        }
      });
    }
    return vysledky;
  }

  function formatCas(minuty) {
    const m = Math.max(1, Math.round(minuty));
    if (m < 60) return m + ' min';
    return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min';
  }

  /* ---------- ZIP bez komprese (stejný princip jako ve Skriptoriu) ---------- */
  let CRC;
  function crc32(u8) {
    if (!CRC) {
      CRC = new Int32Array(256);
      for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c; }
    }
    let c = -1;
    for (let i = 0; i < u8.length; i++) c = (c >>> 8) ^ CRC[(c ^ u8[i]) & 255];
    return (c ^ -1) >>> 0;
  }
  const enc = s => new TextEncoder().encode(s);
  function zip(soubory) {
    const u16 = n => [n & 255, n >> 8 & 255], u32 = n => [n & 255, n >> 8 & 255, n >> 16 & 255, n >>> 24 & 255];
    const casti = [], adresar = [];
    let off = 0;
    for (const f of soubory) {
      const jm = enc(f.name), d = typeof f.data === 'string' ? enc(f.data) : f.data, crc = crc32(d);
      // příznak 0x0800 = jména v UTF-8
      const lh = new Uint8Array([80, 75, 3, 4, 20, 0, 0, 8, 0, 0, 0, 0, 0, 0, ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(jm.length), 0, 0]);
      casti.push(lh, jm, d);
      adresar.push(new Uint8Array([80, 75, 1, 2, 20, 0, 20, 0, 0, 8, 0, 0, 0, 0, 0, 0, ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(jm.length),
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(off)]), jm);
      off += lh.length + jm.length + d.length;
    }
    const velAdr = adresar.reduce((s, a) => s + a.length, 0);
    const konec = new Uint8Array([80, 75, 5, 6, 0, 0, 0, 0, ...u16(soubory.length), ...u16(soubory.length), ...u32(velAdr), ...u32(off), 0, 0]);
    const vse = [...casti, ...adresar, konec];
    const out = new Uint8Array(vse.reduce((s, a) => s + a.length, 0));
    let p = 0;
    for (const a of vse) { out.set(a, p); p += a.length; }
    return out;
  }

  /* kniha: {id, nazev, podtitul}, kapitoly: [{nazev, bloky}] → Uint8Array (EPUB 3) */
  function epub(kniha, kapitoly, autor = 'Kroniky vyhnanství') {
    const titul = 'Kroniky vyhnanství – ' + kniha.nazev;
    const xhtml = (nazev, telo) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="cs" xml:lang="cs">
<head><meta charset="UTF-8"/><title>${esc(nazev)}</title><link rel="stylesheet" href="styl.css"/></head><body>${telo}</body></html>`;
    const telo = bloky => bloky.map(b => b.typ === 'hr' ? '<p class="predel">⁂</p>'
      : b.typ === 'h' ? `<h1>${inline(b.md)}</h1>` : `<p>${inline(b.md)}</p>`).join('\n');
    const kap = kapitoly.map((k, i) => ({ id: 'k' + String(i + 1).padStart(2, '0'), nazev: k.nazev, html: xhtml(k.nazev, telo(k.bloky)) }));
    const id = 'urn:kroniky-vyhnanstvi:' + kniha.id;
    const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="cs">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="uid">${id}</dc:identifier><dc:title>${esc(titul)}</dc:title><dc:creator>${esc(autor)}</dc:creator>
<dc:language>cs</dc:language><meta property="dcterms:modified">${new Date().toISOString().slice(0, 19)}Z</meta>
</metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="titul" href="titul.xhtml" media-type="application/xhtml+xml"/><item id="styl" href="styl.css" media-type="text/css"/>
${kap.map(k => `<item id="${k.id}" href="${k.id}.xhtml" media-type="application/xhtml+xml"/>`).join('\n')}
</manifest>
<spine><itemref idref="titul"/>${kap.map(k => `<itemref idref="${k.id}"/>`).join('')}</spine>
</package>`;
    const nav = xhtml('Obsah', `<nav epub:type="toc"><h1>Obsah</h1><ol>${kap.map(k => `<li><a href="${k.id}.xhtml">${esc(k.nazev)}</a></li>`).join('')}</ol></nav>`);
    const titulStr = xhtml(titul, `<div class="titul"><p class="sága">Kroniky vyhnanství</p><h1>${esc(kniha.nazev)}</h1><p>${esc(kniha.podtitul)}</p></div>`);
    const styl = 'body{font-family:serif;line-height:1.5}h1{text-align:center;margin:1em 0 1.5em}p{margin:0;text-indent:1.3em;text-align:justify}h1+p,.predel+p{text-indent:0}.predel{text-align:center;text-indent:0;margin:1em 0}.titul{text-align:center;margin-top:30%}.titul p{text-indent:0;text-align:center}';
    return zip([
      { name: 'mimetype', data: 'application/epub+zip' },
      { name: 'META-INF/container.xml', data: '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>' },
      { name: 'OEBPS/content.opf', data: opf },
      { name: 'OEBPS/nav.xhtml', data: nav },
      { name: 'OEBPS/titul.xhtml', data: titulStr },
      { name: 'OEBPS/styl.css', data: styl },
      ...kap.map(k => ({ name: `OEBPS/${k.id}.xhtml`, data: k.html })),
    ]);
  }

  // věty pro předčítání (dlouhé promluvy prohlížeče se někde utnou, proto po kouscích)
  function vety(text, max = 220) {
    const kusy = text.match(/[^.!?…]+[.!?…]+[“"»]?\s*|[^.!?…]+$/g) || [text];
    const out = [];
    for (const k of kusy) {
      if (out.length && (out[out.length - 1] + k).length <= max) out[out.length - 1] += k;
      else out.push(k);
    }
    return out.map(s => s.trim()).filter(Boolean);
  }

  const API = { rozeber, inline, prosty, slov, normalizuj, hledej, formatCas, zip, epub, vety, esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else koren.KRONIKY_JADRO = API;
})(this);

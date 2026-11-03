/* Kroniky vyhnanství – jádro čtečky bez DOM (rozbor kapitol, hledání, časy, EPUB).
   V prohlížeči window.KRONIKY_JADRO, v node require(). */
(function (koren) {
  'use strict';

  // Kapitoly používají jen: „# nadpis“, odstavce, *kurzívu*, samotnou „*“ jako předěl scén
  // a ilustraci jako samostatný odstavec ![popis](obrazky/soubor.webp) – cesta je vůči složce knihy.
  function rozeber(md) {
    return md.replace(/\r/g, '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).map(s => {
      if (/^\*+$/.test(s) || /^(\* ?){3,}$/.test(s)) return { typ: 'hr', md: '', text: '' };
      const obr = s.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
      if (obr) return { typ: 'img', md: '', text: '', popis: obr[1], src: obr[2] };
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

  // jméno souboru ilustrace v e-knize: obrazky/01_kost.webp → 01_kost.jpg
  const jmenoObr = src => src.split('/').pop().replace(/\.[a-z0-9]+$/i, '') + '.jpg';

  /* kniha: {id, nazev, podtitul, obalka?}, kapitoly: [{nazev, bloky}],
     obrazky: {src: Uint8Array JPEG} (včetně obálky) → Uint8Array (EPUB 3) */
  function epub(kniha, kapitoly, obrazky = {}, autor = 'Kroniky vyhnanství') {
    const titul = 'Kroniky vyhnanství – ' + kniha.nazev;
    const xhtml = (nazev, telo) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="cs" xml:lang="cs">
<head><meta charset="UTF-8"/><title>${esc(nazev)}</title><link rel="stylesheet" href="styl.css"/></head><body>${telo}</body></html>`;
    const telo = bloky => bloky.map(b => b.typ === 'hr' ? '<p class="predel">⁂</p>'
      : b.typ === 'img' ? (obrazky[b.src] ? `<figure><img src="img/${jmenoObr(b.src)}" alt="${esc(b.popis)}"/>${b.popis ? `<figcaption>${esc(b.popis)}</figcaption>` : ''}</figure>` : '')
      : b.typ === 'h' ? `<h1>${inline(b.md)}</h1>` : `<p>${inline(b.md)}</p>`).join('\n');
    const kap = kapitoly.map((k, i) => ({ id: 'k' + String(i + 1).padStart(2, '0'), nazev: k.nazev, html: xhtml(k.nazev, telo(k.bloky)) }));
    const obr = Object.keys(obrazky).map(src => ({ src, jmeno: jmenoObr(src), data: obrazky[src], obalka: src === kniha.obalka }));
    const id = 'urn:kroniky-vyhnanstvi:' + kniha.id;
    const obalka = obr.find(o => o.obalka);
    const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="cs">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="uid">${id}</dc:identifier><dc:title>${esc(titul)}</dc:title><dc:creator>${esc(autor)}</dc:creator>
<dc:language>cs</dc:language><meta property="dcterms:modified">${new Date().toISOString().slice(0, 19)}Z</meta>${obalka ? '<meta name="cover" content="obalka"/>' : ''}
</metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="titul" href="titul.xhtml" media-type="application/xhtml+xml"/><item id="styl" href="styl.css" media-type="text/css"/>
${kap.map(k => `<item id="${k.id}" href="${k.id}.xhtml" media-type="application/xhtml+xml"/>`).join('\n')}
${obr.map((o, i) => `<item id="${o.obalka ? 'obalka' : 'o' + i}" href="img/${o.jmeno}" media-type="image/jpeg"${o.obalka ? ' properties="cover-image"' : ''}/>`).join('\n')}
</manifest>
<spine><itemref idref="titul"/>${kap.map(k => `<itemref idref="${k.id}"/>`).join('')}</spine>
</package>`;
    const nav = xhtml('Obsah', `<nav epub:type="toc"><h1>Obsah</h1><ol>${kap.map(k => `<li><a href="${k.id}.xhtml">${esc(k.nazev)}</a></li>`).join('')}</ol></nav>`);
    const titulStr = xhtml(titul, (obalka ? `<div class="obalka"><img src="img/${obalka.jmeno}" alt="Obálka"/></div>` : '') +
      `<div class="titul"><p class="saga">Kroniky vyhnanství</p><h1>${esc(kniha.nazev)}</h1><p>${esc(kniha.podtitul)}</p></div>`);
    const styl = 'body{font-family:serif;line-height:1.5}h1{text-align:center;margin:1em 0 1.5em}p{margin:0;text-indent:1.3em;text-align:justify}h1+p,.predel+p,figure+p{text-indent:0}.predel{text-align:center;text-indent:0;margin:1em 0}figure{margin:1em 0;text-align:center;page-break-inside:avoid}figure img{max-width:100%;max-height:90vh}figcaption{font-size:.85em;font-style:italic}.obalka{text-align:center;page-break-after:always}.obalka img{max-width:100%;max-height:100vh}.titul{text-align:center;margin-top:30%}.titul p{text-indent:0;text-align:center}';
    return zip([
      { name: 'mimetype', data: 'application/epub+zip' },
      { name: 'META-INF/container.xml', data: '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>' },
      { name: 'OEBPS/content.opf', data: opf },
      { name: 'OEBPS/nav.xhtml', data: nav },
      { name: 'OEBPS/titul.xhtml', data: titulStr },
      { name: 'OEBPS/styl.css', data: styl },
      ...kap.map(k => ({ name: `OEBPS/${k.id}.xhtml`, data: k.html })),
      ...obr.map(o => ({ name: `OEBPS/img/${o.jmeno}`, data: o.data })),
    ]);
  }

  /* MOBI 6 (PalmDB, nekomprimovaný text v UTF-8) pro starší Kindle.
     Stejné vstupy jako epub(); obrázky musí být JPEG do ~127 kB (limit záznamu). */
  function mobi(kniha, kapitoly, obrazky = {}, autor = 'Kroniky vyhnanství') {
    const titul = 'Kroniky vyhnanství – ' + kniha.nazev;
    // obálka jako první obrázek (EXTH 201 = 0), ostatní v pořadí výskytu
    const poradi = [];
    if (kniha.obalka && obrazky[kniha.obalka]) poradi.push(kniha.obalka);
    kapitoly.forEach(k => k.bloky.forEach(b => { if (b.typ === 'img' && obrazky[b.src] && !poradi.includes(b.src)) poradi.push(b.src); }));
    const recindex = src => String(poradi.indexOf(src) + 1).padStart(5, '0');
    const it = md => esc(md).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
    const POZ = '0000000000';   // místo pro filepos – 10 číslic, doplní se po změření
    const kusy = [];            // [html, kotva?]
    kusy.push([`<html><head><guide><reference type="toc" title="Obsah" filepos=${POZ} /></guide></head><body>`, 'guide']);
    if (kniha.obalka && obrazky[kniha.obalka]) kusy.push([`<p align="center"><img recindex="${recindex(kniha.obalka)}" /></p><mbp:pagebreak/>`]);
    kusy.push([`<h2 align="center">Kroniky vyhnanství</h2><h1 align="center">${esc(kniha.nazev)}</h1><p align="center">${esc(kniha.podtitul)}</p><mbp:pagebreak/>`]);
    kusy.push(['', 'toc'], ['<h2>Obsah</h2>']);
    kapitoly.forEach((k, i) => kusy.push([`<p><a filepos=${POZ}>${esc(k.nazev)}</a></p>`, 'odkaz' + i]));
    kusy.push(['<mbp:pagebreak/>']);
    kapitoly.forEach((k, i) => {
      kusy.push(['', 'kap' + i]);
      kusy.push([k.bloky.map(b => b.typ === 'hr' ? '<p align="center">* * *</p>'
        : b.typ === 'img' ? (obrazky[b.src] ? `<p align="center"><img recindex="${recindex(b.src)}" /></p>${b.popis ? `<p align="center"><i>${esc(b.popis)}</i></p>` : ''}` : '')
        : b.typ === 'h' ? `<h1>${it(b.md)}</h1>` : `<p>${it(b.md)}</p>`).join('') + '<mbp:pagebreak/>']);
    });
    kusy.push(['</body></html>']);
    // změřit bajtové pozice kotev a doplnit filepos
    const pozice = {};
    let bajt = 0;
    for (const [html, kotva] of kusy) { if (kotva === 'toc' || (kotva || '').startsWith('kap')) pozice[kotva] = bajt; bajt += enc(html).length; }
    const cislo = n => String(n).padStart(10, '0');
    const html = kusy.map(([h, kotva]) => kotva === 'guide' ? h.replace(POZ, cislo(pozice.toc))
      : (kotva || '').startsWith('odkaz') ? h.replace(POZ, cislo(pozice['kap' + kotva.slice(5)])) : h).join('');
    const text = enc(html);

    const VEL = 4096, textZaznamu = Math.ceil(text.length / VEL);
    const zaznamy = [null];
    for (let i = 0; i < textZaznamu; i++) zaznamy.push(text.slice(i * VEL, (i + 1) * VEL));
    const prvniObr = zaznamy.length;
    poradi.forEach(src => zaznamy.push(obrazky[src]));
    const u16 = n => [n >> 8 & 255, n & 255], u32 = n => [n >>> 24 & 255, n >> 16 & 255, n >> 8 & 255, n & 255];   // big-endian
    const flis = zaznamy.length;
    zaznamy.push(new Uint8Array([70, 76, 73, 83, 0, 0, 0, 8, 0, 65, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 0, 1, 0, 3, 0, 0, 0, 3, 0, 0, 0, 1, 255, 255, 255, 255]));
    const fcis = zaznamy.length;
    zaznamy.push(new Uint8Array([70, 67, 73, 83, 0, 0, 0, 20, 0, 0, 0, 16, 0, 0, 0, 1, 0, 0, 0, 0, ...u32(text.length), 0, 0, 0, 0, 0, 0, 0, 32, 0, 0, 0, 8, 0, 1, 0, 1, 0, 0, 0, 0]));
    zaznamy.push(new Uint8Array([233, 142, 13, 10]));   // EOF

    // EXTH: autor, jazyk, název, obálka
    const exthZaz = [[100, enc(autor)], [503, enc(titul)], [524, enc('cs')]];
    if (poradi[0] === kniha.obalka && kniha.obalka) exthZaz.push([201, new Uint8Array(u32(0))], [203, new Uint8Array(u32(0))]);
    const exthTelo = exthZaz.flatMap(([typ, data]) => [...u32(typ), ...u32(data.length + 8), ...data]);
    const exthDelka = 12 + exthTelo.length;
    const exth = [69, 88, 84, 72, ...u32(exthDelka), ...u32(exthZaz.length), ...exthTelo, ...new Array((4 - exthDelka % 4) % 4).fill(0)];
    const jmeno = enc(titul);
    const MOBI_DELKA = 232, FF = 0xFFFFFFFF;
    const mh = [
      77, 79, 66, 73, ...u32(MOBI_DELKA), ...u32(2), ...u32(65001), ...u32(Math.random() * 0xFFFFFFFF >>> 0), ...u32(6),
      ...Array(10).fill(FF).flatMap(u32),                       // ortografický … extra index 5
      ...u32(prvniObr),                                         // první záznam mimo text
      ...u32(16 + MOBI_DELKA + exth.length), ...u32(jmeno.length),
      ...u32(5), ...u32(0), ...u32(0), ...u32(6),               // jazyk čeština, min. verze
      ...u32(poradi.length ? prvniObr : FF),
      ...u32(0), ...u32(0), ...u32(0), ...u32(0),               // Huffman nepoužit
      ...u32(0x40), ...Array(32).fill(0),                       // je EXTH
      ...u32(FF), ...u32(FF), ...u32(0), ...u32(0), ...u32(0), ...Array(8).fill(0),   // bez DRM
      ...u16(1), ...u16(poradi.length ? prvniObr + poradi.length - 1 : textZaznamu),
      ...u32(1), ...u32(fcis), ...u32(1), ...u32(flis), ...u32(1),
      ...Array(8).fill(0), ...u32(FF), ...u32(0), ...u32(FF), ...u32(FF),
      ...u32(0),                                                // žádné koncové bajty záznamů
      ...u32(FF),                                               // bez INDX
    ];
    const palmdoc = [...u16(1), 0, 0, ...u32(text.length), ...u16(textZaznamu), ...u16(VEL), 0, 0, 0, 0];
    const rec0 = [...palmdoc, ...mh, ...exth, ...jmeno, 0, 0];
    while (rec0.length % 4) rec0.push(0);
    zaznamy[0] = new Uint8Array(rec0);

    // PalmDB hlavička + seznam záznamů
    const n = zaznamy.length, cas = Math.floor(Date.now() / 1000);
    const nazevDb = enc(titul.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 31));
    const hlav = new Uint8Array(78 + n * 8 + 2);
    hlav.set(nazevDb, 0);
    hlav.set([...u16(0), ...u16(0), ...u32(cas), ...u32(cas), ...u32(0), ...u32(0), ...u32(0), ...u32(0)], 32);
    hlav.set([66, 79, 79, 75, 77, 79, 66, 73, ...u32(2 * n - 1), ...u32(0), ...u16(n)], 60);
    let off = hlav.length;
    zaznamy.forEach((z, i) => { hlav.set([...u32(off), 0, ...[i * 2 >> 16 & 255, i * 2 >> 8 & 255, i * 2 & 255]], 78 + i * 8); off += z.length; });
    const out = new Uint8Array(off);
    out.set(hlav, 0);
    let p = hlav.length;
    zaznamy.forEach(z => { out.set(z, p); p += z.length; });
    return out;
  }

  // hranice slova kolem pozice / výběru (výběr se rozšíří na celá slova); null = žádné slovo
  const PISMENO = /[\p{L}\p{N}'’-]/u;
  function slovoKolem(text, od, do_ = od) {
    let a = Math.max(0, Math.min(od, text.length)), b = Math.max(a, Math.min(do_, text.length));
    while (a < b && !PISMENO.test(text[a])) a++;
    while (b > a && !PISMENO.test(text[b - 1])) b--;
    if (a === b) { while (a < text.length && !PISMENO.test(text[a])) a++; b = a; }
    while (a > 0 && PISMENO.test(text[a - 1])) a--;
    while (b < text.length && PISMENO.test(text[b])) b++;
    return a < b ? { od: a, do: b } : null;
  }

  // věta, ve které leží pozice: od konce předchozí věty (. ! ? … + uvozovky + mezera) po konec této
  function vetaKolem(text, pos) {
    const konce = /[.!?…]+[“"»)]*\s+/g;
    let od = 0, m;
    while ((m = konce.exec(text)) && m.index + m[0].length <= pos) od = m.index + m[0].length;
    konce.lastIndex = pos;
    m = konce.exec(text);
    return { od, do: m ? m.index + m[0].trimEnd().length : text.length };
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

  /* ---------- poznámky pro betačtení: balík {format, verze, jmeno, cas, zalozky, zvyrazneni} ---------- */
  const FORMAT_P = 'kroniky-poznamky';
  const ZNACKA_P = '<!-- kroniky-poznamky ';
  const balikPoznamek = (jmeno, data, cas = Date.now()) =>
    ({ format: FORMAT_P, verze: 1, jmeno: jmeno || '', cas, zalozky: data.zalozky || [], zvyrazneni: data.zvyrazneni || [] });

  // Markdown pro člověka; na konci v komentáři celý balík, aby šel soubor zase načíst
  function poznamkyMd(balik, knihy) {
    const poradi = x => { const k = knihy.findIndex(b => b.id === x.kniha), c = k < 0 ? -1 : knihy[k].kapitoly.findIndex(c => c.soubor === x.soubor); return [k, c, x.blok, x.od || 0]; };
    const srovnej = (a, b) => { const pa = poradi(a), pb = poradi(b); for (let i = 0; i < 4; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]; return 0; };
    let md = '# Kroniky vyhnanství – poznámky' + (balik.jmeno ? ` čtenáře ${balik.jmeno}` : '') + '\n\n'
      + `_${new Date(balik.cas).toLocaleString('cs-CZ')} · ${balik.zvyrazneni.length} zvýraznění, ${balik.zalozky.length} záložek_\n`;
    knihy.forEach(k => {
      const z = balik.zalozky.filter(x => x.kniha === k.id), v = balik.zvyrazneni.filter(x => x.kniha === k.id);
      if (!z.length && !v.length) return;
      md += `\n## ${k.nazev}\n`;
      k.kapitoly.forEach(c => {
        const zz = z.filter(x => x.soubor === c.soubor).sort(srovnej), vv = v.filter(x => x.soubor === c.soubor).sort(srovnej);
        if (!zz.length && !vv.length) return;
        md += `\n### ${c.nazev}\n\n`;
        zz.forEach(x => { md += `- 🔖 ${x.veta ? x.veta.slice(0, x.vOd) + `**${x.slovo}**` + x.veta.slice(x.vOd + x.slovo.length) : x.slovo || ''}\n`; });
        if (zz.length) md += '\n';
        vv.forEach(x => { md += `> ${x.text}\n\n` + (x.poznamka ? `${x.poznamka}\n\n` : ''); });
      });
    });
    // „-->“ by komentář ukončil – v JSON stačí zapsat > jako >
    return md + '\n' + ZNACKA_P + JSON.stringify(balik).replace(/>/g, '\\u003e') + ' -->\n';
  }

  // balík z textu souboru (JSON balíku, záloha čtečky, nebo Markdown s komentářem); null = neznámý formát
  function prectiPoznamky(txt) {
    let o = null;
    try {
      const t = txt.trim(), i = t.lastIndexOf(ZNACKA_P);
      if (t[0] === '{') o = JSON.parse(t);
      else if (i >= 0) o = JSON.parse(t.slice(i + ZNACKA_P.length, t.indexOf('-->', i)));
    } catch (e) { return null; }
    if (o && o.format === 'kroniky-zaloha' && o.data) o = balikPoznamek(o.stav && o.stav.nast && o.stav.nast.jmeno, o.data, o.cas || Date.now());
    if (!o || o.format !== FORMAT_P || !Array.isArray(o.zvyrazneni) || !Array.isArray(o.zalozky)) return null;
    const textova = x => x && typeof x.kniha === 'string' && typeof x.soubor === 'string' && Number.isInteger(x.blok);
    return { ...o, zvyrazneni: o.zvyrazneni.filter(x => textova(x) && typeof x.text === 'string' && x.text),
      zalozky: o.zalozky.filter(x => textova(x) && typeof x.slovo === 'string') };
  }

  const API = { slovoKolem, vetaKolem, rozeber, inline, prosty, slov, normalizuj, hledej, formatCas, zip, epub, mobi, vety, esc, balikPoznamek, poznamkyMd, prectiPoznamky };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else koren.KRONIKY_JADRO = API;
})(this);

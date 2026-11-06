/* Čtečka knih – převod nahraných souborů (Markdown, TXT, EPUB, MOBI) do formátu čtečky.
   Výsledek: {nazev, autor, kapitoly: [{nazev, md}], obrazky: {jmeno: Blob}, obalka: jmeno|null}.
   md kapitoly = podmnožina, které rozumí KRONIKY_JADRO.rozeber: „# nadpis“, odstavce, *kurzíva*, **tučně**,
   samotná „*“ = předěl, ilustrace ![popis](jmeno) jako samostatný odstavec.
   EPUB a MOBI potřebují prohlížeč (DOMParser, DecompressionStream); MD, TXT a PalmDOC jdou i v node. */
(function (koren) {
  'use strict';

  const prosty = s => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
  const slov = s => (s.match(/\S+/g) || []).length;
  const bezPripony = jm => jm.replace(/^.*[\\/]/, '').replace(/\.[a-z0-9]+$/i, '');
  const MAX_SLOV_BEZ_NADPISU = 4000;

  /* ---------- md s nadpisy „# “ → kapitoly ---------- */
  // Nová kapitola začíná nadpisem, pokud ta předchozí už má text; nadpisy hned za sebou
  // („Část první“ + „Kapitola 1“) zůstanou v jedné kapitole. Bez nadpisů se dlouhý text dělí na části.
  // vychozi = název kapitoly bez nadpisu (jen ta první může nadpis nemít); delit = dlouhý text bez nadpisů rozdělit na části
  function naKapitoly(md, { vychozi = 'Úvod', delit = true } = {}) {
    const bloky = md.replace(/\r/g, '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    const kapitoly = [];
    let akt = null;
    for (const b of bloky) {
      const h = /^#\s+/.test(b);
      if (!akt || (h && akt.text)) { akt = { nadpisy: [], bloky: [], text: false }; kapitoly.push(akt); }
      if (h && !akt.text) akt.nadpisy.push(prosty(b.replace(/^#\s+/, '').replace(/\s*\n\s*/g, ' ')));
      else if (!h) akt.text = true;
      akt.bloky.push(b);
    }
    let vysl = kapitoly.filter(k => k.text || k.bloky.length).map(k => ({ nazev: k.nadpisy.join(' · '), bloky: k.bloky }));
    if (delit && vysl.length === 1 && !vysl[0].nazev) vysl = rozdelDlouhy(vysl[0].bloky);
    return vysl.map(k => ({ nazev: k.nazev || vychozi, md: k.bloky.join('\n\n') }));
  }
  function rozdelDlouhy(bloky) {
    const casti = [];
    let akt = [], n = 0;
    for (const b of bloky) {
      akt.push(b); n += slov(b);
      if (n >= MAX_SLOV_BEZ_NADPISU) { casti.push(akt); akt = []; n = 0; }
    }
    if (akt.length) casti.push(akt);
    return casti.map((b, i) => ({ nazev: casti.length > 1 ? 'Část ' + (i + 1) : 'Text', bloky: b }));
  }

  /* ---------- text v neznámém kódování ---------- */
  function dekoduj(u8) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(u8).replace(/^﻿/, ''); }
    catch (e) { return new TextDecoder('windows-1250').decode(u8); }   // starší české TXT
  }

  /* ---------- Markdown ---------- */
  function zMarkdownu(md, jmenoSouboru = 'kniha.md', obrazky = {}) {
    md = md.replace(/\r\n?/g, '\n');
    let nazev = '', autor = '';
    // YAML hlavička (title / author)
    md = md.replace(/^---\n([\s\S]*?)\n---\n/, (_, y) => {
      const t = y.match(/^title:\s*["']?(.+?)["']?\s*$/m), a = y.match(/^author:\s*["']?(.+?)["']?\s*$/m);
      if (t) nazev = t[1]; if (a) autor = a[1];
      return '';
    });
    md = md.replace(/^```.*$/gm, '')                                    // bloky kódu jen jako text
      .replace(/^(.+)\n=+\s*$/gm, '# $1').replace(/^(.+)\n-+\s*$/gm, '## $1')   // nadpisy podtržením
      .replace(/^\s*([-*_])(\s*\1){2,}\s*$/gm, '\n*\n')                  // vodorovná čára = předěl
      .replace(/^\s*>\s?/gm, '')                                         // citace
      .replace(/^[ \t]*[-+*][ \t]+(?=\S)/gm, '\n• ')                      // odrážky = vlastní odstavce
      .replace(/^[ \t]*!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)[ \t]*$/gm, '\n![$1]($2)\n')
      .replace(/(^|[^!])\[([^\]]+)\]\([^)]*\)/g, '$1$2')                 // odkazy → text
      .replace(/<[^>]+>/g, '')                                           // HTML značky
      .replace(/(^|\W)__(.+?)__(?=\W|$)/g, '$1**$2**').replace(/(^|\W)_(.+?)_(?=\W|$)/g, '$1*$2*')
      .replace(/`([^`]+)`/g, '$1');
    // úroveň kapitol: jediný nejvyšší nadpis = název knihy, kapitoly jsou o úroveň níž
    const urovne = [...md.matchAll(/^(#{1,6})\s+\S/gm)].map(m => m[1].length);
    let kapitolova = urovne.length ? Math.min(...urovne) : 1;
    if (urovne.filter(u => u === kapitolova).length === 1 && urovne.some(u => u === kapitolova + 1)) {
      const t = md.match(new RegExp(`^#{${kapitolova}}\\s+(.+)$`, 'm'));
      if (!nazev) nazev = prosty(t[1].replace(/\s*#+\s*$/, ''));
      md = md.replace(t[0], '');
      kapitolova++;
    }
    md = md.replace(/^(#{1,6})\s+(.+?)\s*#*\s*$/gm, (_, h, t) => h.length <= kapitolova ? '\n# ' + t + '\n' : '\n**' + t + '**\n');
    // ilustrace jen ty, které uživatel přiložil (podle jména souboru)
    const pouzite = {};
    md = md.replace(/^!\[([^\]]*)\]\(([^)]+)\)$/gm, (cely, popis, src) => {
      const jm = decodeURIComponent(src).split('/').pop();
      if (!obrazky[jm]) return popis ? popis : '';
      pouzite[jm] = obrazky[jm];
      return `![${popis}](${jm})`;
    });
    return { nazev: nazev || bezPripony(jmenoSouboru), autor, kapitoly: naKapitoly(md), obrazky: pouzite, obalka: null };
  }

  /* ---------- nadpisy v prostém textu (TXT, MOBI a EPUB převedené z TXT) ---------- */
  // cisla = i samotné „12“ (v TXT bývá číslo kapitoly, v HTML z PDF číslo stránky)
  const jeNadpis = (s, cisla = true) => s.length <= 80 && (
    /^(kapitola|chapter|část|díl|kniha|book|part)\s+(\d+|[IVXLC]+|[a-zà-ž]+(á|í|ý|é))(?=[\s.,:–-]|$)/i.test(s)   // Kapitola 3, KNIHA PRVNÍ
    || /^(prolog|epilog|předmluva|doslov|úvod|závěr|prologue|epilogue|preface)\b.{0,40}$/i.test(s)
    || /^[IVXLC]{1,7}\.?$/.test(s) || (cisla && /^\d{1,3}\.?$/.test(s))
    || (s === s.toUpperCase() && /\p{Lu}{3}/u.test(s) && !/\d/.test(s) && slov(s) >= 2 && slov(s) <= 10 && !/[.!?…,;:]$/.test(s)));
  const sNadpisy = (bloky, cisla) => bloky.some(b => /^# /.test(b)) ? bloky : bloky.map(b => jeNadpis(prosty(b), cisla) ? '# ' + b : b);
  // zástupné hodnoty z převodníků (Calibre: „Unknown“, název = hash) nahradit jménem souboru
  const skutecny = (s, nahrada = '') => !s || /^[0-9a-f]{16,}$/i.test(s.trim()) || /^(unknown|neznámý|windows user|user|administrator|microsoft word\b.*)$/i.test(s.trim()) ? nahrada : s.trim();

  /* ---------- prostý text ---------- */  function zTextu(txt, jmenoSouboru = 'kniha.txt') {
    txt = txt.replace(/\r\n?/g, '\n');
    const odstavce = /\n\s*\n/.test(txt) ? txt.split(/\n\s*\n/) : txt.split('\n');
    const md = sNadpisy(odstavce.map(s => s.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean).map(s => s.replace(/\*/g, '∗'))).join('\n\n');
    return { nazev: bezPripony(jmenoSouboru), autor: '', kapitoly: naKapitoly(md), obrazky: {}, obalka: null };
  }

  /* ---------- HTML (EPUB, MOBI) → bloky md ---------- */
  const BLOKOVE = new Set('p div section article blockquote li ul ol dd dt dl pre table tr td th figure figcaption header footer aside nav body main center address'.split(' '));
  const PRESKOCIT = new Set(['script', 'style', 'head', 'title', 'noscript']);
  // obrazek(src) → jméno uloženého obrázku nebo null
  function htmlNaMd(koren, obrazek) {
    const bloky = [];
    let buf = '';
    const vyprazdni = () => { const t = buf.replace(/\s+/g, ' ').trim(); if (t && t !== '**' && t !== '*') bloky.push(t); buf = ''; };
    const obal = (n, znacka) => { const pred = buf.length; buf += znacka; projdi(n); if (!buf.slice(pred + znacka.length).trim()) buf = buf.slice(0, pred); else buf += znacka; };
    function projdi(n) {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) { buf += c.nodeValue.replace(/\*/g, '∗'); continue; }
        if (c.nodeType !== 1) continue;
        const tag = c.localName.toLowerCase().replace(/^.*:/, '');
        if (PRESKOCIT.has(tag)) continue;
        if (/^h[1-6]$/.test(tag)) {
          vyprazdni(); projdi(c);
          const t = buf.replace(/\s+/g, ' ').trim(); buf = '';
          if (t) bloky.push('# ' + t);
        } else if (tag === 'img' || tag === 'image') {
          const src = c.getAttribute('src') || c.getAttribute('recindex') || c.getAttribute('href') || c.getAttribute('xlink:href') || c.getAttributeNS && c.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
          const jm = src && obrazek(src);
          if (jm) { vyprazdni(); bloky.push(`![${(c.getAttribute('alt') || '').replace(/[\]\n]/g, ' ').trim()}](${jm})`); }
        } else if (tag === 'hr' || tag === 'pagebreak') { vyprazdni(); bloky.push('*'); }
        else if (tag === 'br') buf += ' ';
        else if (tag === 'em' || tag === 'i' || tag === 'cite') obal(c, '*');
        else if (tag === 'strong' || tag === 'b') obal(c, '**');
        else if (BLOKOVE.has(tag) || tag === 'svg') { vyprazdni(); projdi(c); vyprazdni(); }
        else projdi(c);
      }
    }
    projdi(koren);
    vyprazdni();
    // předěl na začátku/konci a zdvojené předěly nic neříkají
    return bloky.filter((b, i) => b !== '*' || (i > 0 && i < bloky.length - 1 && bloky[i - 1] !== '*'));
  }
  function parsujXhtml(text) {
    const P = new DOMParser();
    let d = P.parseFromString(text, 'application/xhtml+xml');
    if (d.getElementsByTagName('parsererror').length) d = P.parseFromString(text, 'text/html');
    return d;
  }

  /* ---------- ZIP (čtení, deflate přes DecompressionStream) ---------- */
  function ctiZip(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let e = u8.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('Soubor není platný ZIP/EPUB.');
    const pocet = dv.getUint16(e + 10, true), soubory = new Map();
    let p = dv.getUint32(e + 16, true);
    for (let i = 0; i < pocet && dv.getUint32(p, true) === 0x02014b50; i++) {
      const metoda = dv.getUint16(p + 10, true), velikost = dv.getUint32(p + 20, true);
      const lj = dv.getUint16(p + 28, true), lx = dv.getUint16(p + 30, true), lk = dv.getUint16(p + 32, true);
      const lh = dv.getUint32(p + 42, true), jmeno = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + lj));
      p += 46 + lj + lx + lk;
      soubory.set(jmeno, async () => {
        const od = lh + 30 + dv.getUint16(lh + 26, true) + dv.getUint16(lh + 28, true), data = u8.subarray(od, od + velikost);
        if (metoda === 0) return data;
        if (metoda !== 8) throw new Error('Nepodporovaná komprese v ZIP.');
        return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      });
    }
    return soubory;
  }
  const relativne = (zaklad, href) => {
    const cesta = zaklad.split('/').slice(0, -1);
    for (const c of decodeURIComponent(href.split('#')[0]).split('/')) {
      if (c === '..') cesta.pop(); else if (c && c !== '.') cesta.push(c);
    }
    return cesta.join('/');
  };
  const TYP_OBR = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp' };
  const typObrazku = jm => TYP_OBR[(jm.split('.').pop() || '').toLowerCase()];

  /* ---------- EPUB ---------- */
  // „Page 12“, „page-1“, „title_page“ (e-knihy převedené z PDF a Wordu) nejsou názvy kapitol
  const nesmyslnyNazev = t => /^(page|strana|str\.?)\s*-?\d+$/i.test(t) || /^[a-z0-9]+([_-][a-z0-9]+)+$/.test(t);
  async function zEpubu(buf, jmenoSouboru = 'kniha.epub') {
    const zip = ctiZip(buf);
    const text = async jm => { const f = zip.get(jm); if (!f) throw new Error('V EPUB chybí ' + jm); return new TextDecoder().decode(await f()); };
    const kontejner = parsujXhtml(await text('META-INF/container.xml'));
    const opfCesta = kontejner.getElementsByTagName('rootfile')[0].getAttribute('full-path');
    const opf = parsujXhtml(await text(opfCesta));
    const meta = jm => { const el = opf.getElementsByTagNameNS('*', jm)[0]; return el ? el.textContent.trim() : ''; };
    const manifest = new Map();
    for (const it of opf.getElementsByTagName('item'))
      manifest.set(it.getAttribute('id'), { href: relativne(opfCesta, it.getAttribute('href')), typ: it.getAttribute('media-type') || '', vlastnosti: it.getAttribute('properties') || '' });
    // názvy kapitol z obsahu (EPUB 3 nav, jinak EPUB 2 NCX)
    const nazvy = new Map();
    const navItem = [...manifest.values()].find(m => /\bnav\b/.test(m.vlastnosti));
    const ncxId = opf.getElementsByTagName('spine')[0].getAttribute('toc');
    const ncxItem = (ncxId && manifest.get(ncxId)) || [...manifest.values()].find(m => m.typ === 'application/x-dtbncx+xml');
    const pridejNazev = (cil, t) => {
      t = t.replace(/\s+/g, ' ').trim();
      if (t && !nazvy.has(cil) && !nesmyslnyNazev(t)) nazvy.set(cil, t);
    };
    try {
      const nav = navItem && parsujXhtml(await text(navItem.href));
      const toc = nav && [...nav.getElementsByTagName('nav')].find(n => /toc/.test(n.getAttribute('epub:type') || n.getAttributeNS('http://www.idpf.org/2007/ops', 'type') || ''));
      if (toc) {
        for (const a of toc.getElementsByTagName('a')) pridejNazev(relativne(navItem.href, a.getAttribute('href') || ''), a.textContent);
      } else if (ncxItem) {
        const ncx = parsujXhtml(await text(ncxItem.href));
        for (const np of ncx.getElementsByTagName('navPoint')) {
          const cil = relativne(ncxItem.href, np.getElementsByTagName('content')[0].getAttribute('src'));
          const t = np.getElementsByTagName('text')[0];
          if (t) pridejNazev(cil, t.textContent);
        }
      }
    } catch (e) { /* obsah je jen pro názvy – bez něj se vezmou nadpisy z textu */ }
    // obálka
    let obalkaHref = null;
    const obalkaMeta = [...opf.getElementsByTagName('meta')].find(m => m.getAttribute('name') === 'cover');
    const obalkaItem = [...manifest.values()].find(m => /cover-image/.test(m.vlastnosti)) || (obalkaMeta && manifest.get(obalkaMeta.getAttribute('content')));
    if (obalkaItem && /^image\//.test(obalkaItem.typ)) obalkaHref = obalkaItem.href;

    const obrazky = {}, jmenaObr = new Map();
    const pridejObrazek = async href => {
      if (jmenaObr.has(href)) return jmenaObr.get(href);
      const f = zip.get(href), typ = typObrazku(href);
      if (!f || !typ) return null;
      let jm = href.split('/').pop().replace(/[^\w.-]+/g, '_');
      while (obrazky[jm]) jm = '_' + jm;
      obrazky[jm] = new Blob([await f()], { type: typ });
      jmenaObr.set(href, jm);
      return jm;
    };
    const kapitoly = [];
    for (const ref of opf.getElementsByTagName('itemref')) {
      const it = manifest.get(ref.getAttribute('idref'));
      if (!it || !/html|xml/.test(it.typ) || !zip.get(it.href) || it === navItem) continue;   // obsah e-knihy má čtečka vlastní
      const dok = parsujXhtml(await text(it.href));
      // obrázky se načtou dopředu (htmlNaMd je synchronní)
      for (const el of dok.querySelectorAll('img, image')) {
        const src = el.getAttribute('src') || el.getAttribute('href') || el.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        if (src && !/^data:/.test(src)) await pridejObrazek(relativne(it.href, src));
      }
      const bloky = sNadpisy(htmlNaMd(dok.body || dok.documentElement, src => jmenaObr.get(relativne(it.href, src)) || null), false);
      const textove = bloky.filter(b => !/^!\[/.test(b) && b !== '*');
      // stránka jen s obálkou nebo prázdná stránka do čtení nepatří
      if (!textove.length && (!bloky.length || bloky.every(b => b.includes(`](${jmenaObr.get(obalkaHref)})`)) || kapitoly.length === 0)) continue;
      // Jeden soubor může nést víc kapitol (dělí se podle nadpisů). Text bez nadpisu i bez položky v obsahu
      // je pokračování předchozí kapitoly (e-knihy dělené po stránkách), jinak dostane název z obsahu.
      const kratky = textove[0] && !/^# /.test(textove[0]) && slov(textove[0]) <= 8 && textove[0].length <= 60 ? prosty(textove[0]) : '';
      const zObsahu = nazvy.get(it.href);
      for (const c of naKapitoly(bloky.join('\n\n'), { vychozi: '', delit: false })) {
        if (!c.nazev && !zObsahu && kapitoly.length) { kapitoly[kapitoly.length - 1].md += '\n\n' + c.md; continue; }
        let nazev = c.nazev || zObsahu || kratky;
        const vlastni = !nazev || nesmyslnyNazev(nazev);
        if (vlastni) nazev = 'Kapitola ' + (kapitoly.length + 1);
        kapitoly.push({ nazev, md: /^# /.test(c.md) || (nazev === kratky && !vlastni) ? c.md : '# ' + nazev + '\n\n' + c.md });
      }
    }
    if (!kapitoly.length) throw new Error('V EPUB jsem nenašel žádný text.');
    const obalka = obalkaHref ? await pridejObrazek(obalkaHref) : null;
    // série: Calibre (meta calibre:series) nebo EPUB 3 (belongs-to-collection + group-position)
    const metaJm = jm => { const el = [...opf.getElementsByTagName('meta')].find(m => m.getAttribute('name') === jm); return el ? el.getAttribute('content') : ''; };
    const kolekce = [...opf.getElementsByTagName('meta')].find(m => m.getAttribute('property') === 'belongs-to-collection');
    const pozice = kolekce && kolekce.getAttribute('id') && [...opf.getElementsByTagName('meta')].find(m => m.getAttribute('property') === 'group-position' && m.getAttribute('refines') === '#' + kolekce.getAttribute('id'));
    const serie = (metaJm('calibre:series') || (kolekce ? kolekce.textContent : '')).trim();
    const dil = parseFloat(metaJm('calibre:series_index') || (pozice ? pozice.textContent : '')) || null;
    return { nazev: skutecny(meta('title'), bezPripony(jmenoSouboru)), autor: skutecny(meta('creator')), kapitoly, obrazky, obalka, serie, dil: serie ? dil : null };
  }

  /* ---------- MOBI (PalmDOC / bez komprese) ---------- */
  function palmdoc(src) {
    const out = new Uint8Array(src.length * 8);
    let o = 0;
    for (let i = 0; i < src.length;) {
      const c = src[i++];
      if (c >= 1 && c <= 8) { for (let k = 0; k < c && i < src.length; k++) out[o++] = src[i++]; }
      else if (c < 0x80) out[o++] = c;
      else if (c >= 0xC0) { out[o++] = 32; out[o++] = c ^ 0x80; }
      else {
        const x = (c << 8) | src[i++], vzd = (x >> 3) & 0x7FF, del = (x & 7) + 3;
        for (let k = 0; k < del; k++) { out[o] = out[o - vzd]; o++; }
      }
    }
    return out.subarray(0, o);
  }
  // konec textového záznamu nese doplňková data (podle příznaků v hlavičce) – odříznout
  function delkaPrivesku(z, priznaky) {
    let n = 0;
    for (let f = priznaky >> 1; f; f >>= 1) {
      if (!(f & 1)) continue;
      let vysl = 0, bit = 0, p = z.length - n;
      while (p > 0) {
        const v = z[--p];
        vysl |= (v & 0x7F) << bit; bit += 7;
        if ((v & 0x80) || bit >= 28) break;
      }
      n += vysl;
    }
    if (priznaky & 1) n += (z[z.length - n - 1] & 3) + 1;
    return n;
  }
  function typBajtu(d) {
    if (d[0] === 0xFF && d[1] === 0xD8) return 'image/jpeg';
    if (d[0] === 0x89 && d[1] === 0x50) return 'image/png';
    if (d[0] === 0x47 && d[1] === 0x49 && d[2] === 0x46) return 'image/gif';
    if (d[0] === 0x42 && d[1] === 0x4D) return 'image/bmp';
    return null;
  }
  function mobiText(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const typ = new TextDecoder('latin1').decode(u8.subarray(60, 68));
    if (!/^(BOOKMOBI|TEXtREAd)$/.test(typ)) throw new Error('Soubor není kniha MOBI.');
    const pocet = dv.getUint16(76), zaz = i => dv.getUint32(78 + i * 8);
    const zaznam = i => u8.subarray(zaz(i), i + 1 < pocet ? zaz(i + 1) : u8.length);
    const r0 = zaznam(0), d0 = new DataView(r0.buffer, r0.byteOffset, r0.byteLength);
    const komprese = d0.getUint16(0), textZaz = d0.getUint16(8), sifra = d0.getUint16(12);
    if (sifra) throw new Error('Kniha je chráněná DRM – takovou čtečka otevřít nemůže.');
    if (komprese !== 1 && komprese !== 2) throw new Error('Tento MOBI používá kompresi HUFF/CDIC, kterou čtečka neumí. Převeďte ho na EPUB (např. v Calibre).');
    const jeMobi = r0.length > 20 && new TextDecoder('latin1').decode(r0.subarray(16, 20)) === 'MOBI';
    let kodovani = 1252, nazev = '', autor = '', prvniObr = 0, obalkaIdx = -1, priznaky = 0;
    if (jeMobi) {
      const hl = d0.getUint32(20);
      kodovani = d0.getUint32(28);
      const no = d0.getUint32(84), nd = d0.getUint32(88);
      nazev = new TextDecoder(kodovani === 65001 ? 'utf-8' : 'windows-1252').decode(r0.subarray(no, no + nd));
      prvniObr = d0.getUint32(108);
      if (hl >= 0xE4) priznaky = d0.getUint16(16 + 0xE2);
      if (d0.getUint32(128) & 0x40) {
        let p = 16 + hl;
        const exth = new TextDecoder('latin1').decode(r0.subarray(p, p + 4)) === 'EXTH';
        const n = exth ? d0.getUint32(p + 8) : 0;
        p += 12;
        const dek = new TextDecoder(kodovani === 65001 ? 'utf-8' : 'windows-1252');
        for (let i = 0; i < n; i++) {
          const t = d0.getUint32(p), l = d0.getUint32(p + 4), data = r0.subarray(p + 8, p + l);
          if (t === 100) autor = autor ? autor + ', ' + dek.decode(data) : dek.decode(data);
          if (t === 503) nazev = dek.decode(data);
          if (t === 201) obalkaIdx = new DataView(data.buffer, data.byteOffset, 4).getUint32(0);
          p += l;
        }
      }
    } else nazev = new TextDecoder('latin1').decode(u8.subarray(0, 32)).replace(/\0.*$/s, '');
    const casti = [];
    for (let i = 1; i <= textZaz && i < pocet; i++) {
      let z = zaznam(i);
      z = z.subarray(0, z.length - delkaPrivesku(z, priznaky));
      casti.push(komprese === 2 ? palmdoc(z) : z);
    }
    const vse = new Uint8Array(casti.reduce((s, c) => s + c.length, 0));
    let o = 0; for (const c of casti) { vse.set(c, o); o += c.length; }
    const text = new TextDecoder(kodovani === 65001 ? 'utf-8' : 'windows-1252').decode(vse);
    // obrázky: záznamy od prvniObr, v HTML <img recindex="00001"> (číslováno od 1)
    const obrazky = {};
    if (prvniObr && prvniObr < pocet) {
      for (let i = prvniObr, n = 1; i < pocet; i++, n++) {
        const d = zaznam(i), t = typBajtu(d);
        if (!t) continue;   // FLIS, FCIS, RESC… – pořadí čísel ale počítají
        obrazky[n] = { data: d, typ: t };
      }
    }
    return { text, nazev, autor, obrazky, obalka: obalkaIdx >= 0 ? obalkaIdx + 1 : null, html: jeMobi || /<(p|html|body)\b/i.test(text) };
  }
  function zMobi(buf, jmenoSouboru = 'kniha.mobi') {
    const m = mobiText(buf);
    const obrazky = {}, jmeno = n => {
      const o = m.obrazky[+n];
      if (!o) return null;
      const jm = 'obr' + String(n).padStart(4, '0') + '.' + o.typ.split('/')[1];
      if (!obrazky[jm]) obrazky[jm] = new Blob([o.data], { type: o.typ });
      return jm;
    };
    const nazev = skutecny(m.nazev, bezPripony(jmenoSouboru)), autor = skutecny(m.autor);
    if (!m.html) return { ...zTextu(m.text, jmenoSouboru), nazev, autor };
    const P = new DOMParser();
    const bloky = [];
    for (const kus of m.text.split(/<mbp:pagebreak[^>]*>/i)) {
      const d = P.parseFromString(kus, 'text/html');
      const b = htmlNaMd(d.body, src => {
        if (/^\d+$/.test(src)) return jmeno(src);
        const kf8 = src.match(/kindle:embed:([0-9A-V]{4})/i);   // AZW3/KF8: číslo v base32
        return kf8 ? jmeno(parseInt(kf8[1], 32)) : null;
      });
      bloky.push(...b);
    }
    // stránkové zlomy MOBI často padnou doprostřed kapitoly – kapitoly se dělí jen podle nadpisů
    const obalka = m.obalka ? jmeno(m.obalka) : null;
    const text = sNadpisy(bloky.filter(b => !obalka || b !== `![](${obalka})`), false);
    return { nazev, autor, kapitoly: naKapitoly(text.join('\n\n')), obrazky, obalka };
  }

  /* ---------- série z názvu: „Hříšní lidé - 11 Pečeť smrti“, „Vampýra 02 Moloch“, „Ulldart 3 - Znamení…“ ---------- */
  function serieZNazvu(nazev) {
    const t = String(nazev || '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
    const vzory = [
      /^(.{3,}?)\s*[-–]\s*0?(\d{1,2})\.?\s*[-–:.]?\s+(\S.*)$/u,     // Série - 11 Název
      /^(.{3,}?)\s+0?(\d{1,2})\.?\s*[-–:]\s*(\S.*)$/u,              // Série 3 - Název
      /^(.{3,}?)\s+0?(\d{1,2})\.?\s+(\p{Lu}.*)$/u,                   // Série 02 Název / Série 5. Název
    ];
    for (const v of vzory) {
      const m = t.match(v);
      if (m && !/\d$/.test(m[1]) && /\p{L}{3}/u.test(m[1])) return { serie: m[1].replace(/[\s,.:–-]+$/, ''), dil: +m[2], nazev: m[3] };
    }
    return null;
  }

  /* ---------- vstup: soubory z <input type=file> nebo přetažení ---------- */
  const PRIPONY = /\.(md|markdown|txt|text|epub|mobi|prc|azw|azw3)$/i;
  // jeden soubor knihy → kniha; obr = {jméno: File} obrázky přiložené k Markdownu (použijí se jako ilustrace)
  async function nactiSoubor(f, obr = {}) {
    const pr = f.name.split('.').pop().toLowerCase();
    let k;
    if (pr === 'epub') k = await zEpubu(await f.arrayBuffer(), f.name);
    else if (/^(mobi|prc|azw|azw3)$/.test(pr)) k = zMobi(await f.arrayBuffer(), f.name);
    else {
      const t = dekoduj(new Uint8Array(await f.arrayBuffer()));
      k = /^(md|markdown)$/.test(pr) ? zMarkdownu(t, f.name, obr) : zTextu(t, f.name);
    }
    if (!k.kapitoly.length) throw new Error('Soubor neobsahuje žádný text.');
    return { ...k, format: pr === 'markdown' ? 'md' : pr === 'text' ? 'txt' : pr, soubor: f.name, velikost: f.size };
  }
  const obrazkyZeSouboru = soubory => { const obr = {}; for (const f of soubory) if (typObrazku(f.name)) obr[f.name] = f; return obr; };
  async function nactiSoubory(soubory) {
    const obr = obrazkyZeSouboru(soubory), vysl = [];
    for (const f of soubory) {
      if (!PRIPONY.test(f.name)) continue;
      try { vysl.push(await nactiSoubor(f, obr)); } catch (e) { vysl.push({ chyba: e.message || String(e), soubor: f.name }); }
    }
    return vysl;
  }

  const API = { serieZNazvu, nactiSoubor, obrazkyZeSouboru, typObrazku, naKapitoly, jeNadpis, zMarkdownu, zTextu, zEpubu, zMobi, mobiText, palmdoc, delkaPrivesku, ctiZip, htmlNaMd, nactiSoubory, dekoduj, PRIPONY, slov, prosty };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else koren.CTECKA_PREVOD = API;
})(this);

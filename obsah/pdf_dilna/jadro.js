/* ============================================================
   PDF dílna – jádro bez DOM (pdf-lib).
   V prohlížeči window.PDFDILNA, v node module.exports.
   Knihovna pdf-lib se bere z globálu PDFLib (v node ji test
   nastaví přes globalThis.PDFLib = require(...)).

   Souřadnice „vizuální“ = jak stránku vidí čtenář (po otočení /Rotate),
   počátek vlevo dole, jednotka bod (1/72 palce). Funkce naUzivatel()
   je převádí do souřadnic obsahu stránky, takže vodoznak, čísla
   i podpis sedí i na otočených stránkách.
   ============================================================ */
(function (koren) {
  'use strict';
  const L = () => koren.PDFLib;
  const MM = 72 / 25.4;                 // bodů na milimetr
  const A4 = [595.28, 841.89];

  /* ---------- rozsahy stránek ---------- */

  // „1-3,5,8-“ → [[0,1,2],[4],[7,…,celkem-1]] (indexy od 0); každá skupina = jeden výstup
  function rozsahy(text, celkem) {
    const skupiny = [];
    const casti = String(text || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
    if (!casti.length) throw new Error('Zadej rozsah, např. 1-3,5,8-');
    for (const c of casti) {
      const m = c.match(/^(\d*)\s*[-–]\s*(\d*)$/) || c.match(/^(\d+)()$/);
      if (!m) throw new Error(`Nerozumím rozsahu „${c}“`);
      const jedna = !/[-–]/.test(c);
      let od = m[1] === '' ? 1 : +m[1];
      let po = jedna ? od : (m[2] === '' ? celkem : +m[2]);
      if (od < 1 || po < 1) throw new Error(`Stránky se číslují od 1 („${c}“)`);
      if (od > celkem) throw new Error(`Stránka ${od} neexistuje (dokument má ${celkem})`);
      po = Math.min(po, celkem);
      const sk = [];
      if (od <= po) for (let i = od; i <= po; i++) sk.push(i - 1);
      else for (let i = od; i >= po; i--) sk.push(i - 1);   // „5-3“ = pozpátku
      skupiny.push(sk);
    }
    return skupiny;
  }

  function poN(celkem, n) {
    n = Math.max(1, Math.floor(n) || 1);
    const sk = [];
    for (let i = 0; i < celkem; i += n) sk.push(Array.from({ length: Math.min(n, celkem - i) }, (_, k) => i + k));
    return sk;
  }

  const jednotlive = celkem => Array.from({ length: celkem }, (_, i) => [i]);

  // přesune stránky s id ve `vybrane` (Set) před stránku predId (null = na konec), pořadí přesouvaných zůstane
  function presun(seznam, vybrane, predId) {
    const pres = seznam.filter(s => vybrane.has(s.id)), zbytek = seznam.filter(s => !vybrane.has(s.id));
    let i = predId == null ? zbytek.length : zbytek.findIndex(s => s.id === predId);
    if (i < 0) {   // cíl je sám mezi přesouvanými → před nejbližší nepřesouvanou za ním
      const dalsi = seznam.slice(seznam.findIndex(s => s.id === predId)).find(s => !vybrane.has(s.id));
      i = dalsi ? zbytek.indexOf(dalsi) : zbytek.length;
    }
    zbytek.splice(i, 0, ...pres);
    return zbytek;
  }

  // orientace z EXIF JPEGu (1 = normální, 3 = 180°, 6 = 90° doprava, 8 = 90° doleva…), jinak 1
  function exifOrientace(u8) {
    if (u8[0] !== 0xFF || u8[1] !== 0xD8) return 1;
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let o = 2;
    while (o + 4 < u8.length) {
      if (u8[o] !== 0xFF) return 1;
      const znacka = u8[o + 1], delka = dv.getUint16(o + 2);
      if (znacka === 0xE1 && dv.getUint32(o + 4) === 0x45786966) {   // „Exif“
        const t = o + 10, le = dv.getUint16(t) === 0x4949;
        const ifd = t + dv.getUint32(t + 4, le), n = dv.getUint16(ifd, le);
        for (let i = 0; i < n; i++) {
          const e = ifd + 2 + i * 12;
          if (dv.getUint16(e, le) === 0x0112) return dv.getUint16(e + 8, le);
        }
        return 1;
      }
      if (znacka === 0xDA) return 1;
      o += 2 + delka;
    }
    return 1;
  }

  /* ---------- ZIP (metoda „uloženo“) + CRC32 ---------- */
  const CRC = (() => {
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
    for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  // polozky [{name, data: Uint8Array}] → Uint8Array; jména v UTF-8 (příznak bit 11)
  function zip(polozky) {
    const enc = new TextEncoder();
    const casti = [], centralni = [];
    let offset = 0;
    for (const p of polozky) {
      const data = typeof p.data === 'string' ? enc.encode(p.data) : p.data;
      const jmeno = enc.encode(p.name), crc = crc32(data);
      const lok = new Uint8Array(30 + jmeno.length), dv = new DataView(lok.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true);
      dv.setUint16(12, 0x21, true); dv.setUint32(14, crc, true);
      dv.setUint32(18, data.length, true); dv.setUint32(22, data.length, true); dv.setUint16(26, jmeno.length, true);
      lok.set(jmeno, 30);
      const cen = new Uint8Array(46 + jmeno.length), cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
      cv.setUint16(14, 0x21, true); cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, jmeno.length, true);
      cv.setUint32(42, offset, true); cen.set(jmeno, 46);
      casti.push(lok, data); centralni.push(cen);
      offset += lok.length + data.length;
    }
    const cdVel = centralni.reduce((s, c) => s + c.length, 0);
    const konec = new Uint8Array(22), kv = new DataView(konec.buffer);
    kv.setUint32(0, 0x06054b50, true); kv.setUint16(8, polozky.length, true); kv.setUint16(10, polozky.length, true);
    kv.setUint32(12, cdVel, true); kv.setUint32(16, offset, true);
    return spoj([...casti, ...centralni, konec]);
  }
  function spoj(pole) {
    const out = new Uint8Array(pole.reduce((s, a) => s + a.length, 0));
    let o = 0; for (const a of pole) { out.set(a, o); o += a.length; }
    return out;
  }

  /* ---------- načtení ---------- */

  // rozpozná typ souboru podle prvních bajtů
  function typSouboru(u8) {
    const h = s => s.split('').every((ch, i) => u8[i] === ch.charCodeAt(0));
    if (u8.length > 4 && hledej(u8.subarray(0, 1024), '%PDF-') >= 0) return 'pdf';
    if (u8[0] === 0xFF && u8[1] === 0xD8) return 'jpg';
    if (u8[0] === 0x89 && h('\x89PNG')) return 'png';
    if (h('RIFF') && String.fromCharCode(...u8.subarray(8, 12)) === 'WEBP') return 'webp';
    return null;
  }
  function hledej(u8, txt) {
    const k = Array.from(txt, c => c.charCodeAt(0));
    outer: for (let i = 0; i <= u8.length - k.length; i++) {
      for (let j = 0; j < k.length; j++) if (u8[i + j] !== k[j]) continue outer;
      return i;
    }
    return -1;
  }

  class ChybaPdf extends Error {
    constructor(zprava, druh) { super(zprava); this.druh = druh; }
  }

  async function nacti(bytes) {
    let doc;
    try {
      doc = await L().PDFDocument.load(bytes, { updateMetadata: false });
    } catch (e) {
      if (e && (e.name === 'EncryptedPDFError' || /encrypt/i.test(e.message)))
        throw new ChybaPdf('Soubor je šifrovaný (heslem nebo ochranou proti úpravám). pdf-lib neumí šifrovaná PDF otevřít – odemkni ho jinde (např. „Tisk do PDF“ v prohlížeči) a nahraj znovu.', 'sifra');
      throw new ChybaPdf('Soubor se nepodařilo přečíst jako PDF (je poškozený nebo to není PDF): ' + (e && e.message || e), 'vadne');
    }
    // pdf-lib je benevolentní – z rozbitého souboru udělá dokument bez stránek
    let pocet = 0;
    try { pocet = doc.getPageCount(); } catch (e) { /* chybí strom stránek */ }
    if (!pocet) throw new ChybaPdf('V souboru nejsou žádné čitelné stránky (PDF je poškozené).', 'vadne');
    return doc;
  }

  /* ---------- geometrie stránky ---------- */

  const rotace = page => ((page.getRotation().angle % 360) + 360) % 360;
  const box = page => page.getCropBox();

  // rozměr, jak ho vidí čtenář
  function vizualni(page) {
    const b = box(page), r = rotace(page);
    return (r === 90 || r === 270) ? { w: b.height, h: b.width } : { w: b.width, h: b.height };
  }

  // vizuální bod (vx, vy) → souřadnice obsahu + úhel, o který natočit text/obrázek, aby byl pro čtenáře vodorovně
  function naUzivatel(page, vx, vy) {
    const b = box(page), r = rotace(page);
    if (r === 90) return { x: b.x + b.width - vy, y: b.y + vx, rot: 90 };
    if (r === 180) return { x: b.x + b.width - vx, y: b.y + b.height - vy, rot: 180 };
    if (r === 270) return { x: b.x + vy, y: b.y + b.height - vx, rot: 270 };
    return { x: b.x + vx, y: b.y + vy, rot: 0 };
  }

  // otočení vektoru o úhel ve stupních (proti směru hodin)
  function otoc(dx, dy, uhel) {
    const a = uhel * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return [dx * c - dy * s, dx * s + dy * c];
  }

  function barva(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    const n = m ? parseInt(m[1], 16) : 0;
    return L().rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  }

  // text s vizuálním počátkem (vx, vy) a vizuálním úhlem
  function kresliText(page, text, vx, vy, o) {
    const p = naUzivatel(page, vx, vy);
    page.drawText(text, { x: p.x, y: p.y, size: o.velikost, font: o.font, color: barva(o.barva),
      opacity: o.pruhlednost ?? 1, rotate: L().degrees(p.rot + (o.uhel || 0)) });
  }

  /* ---------- sestavení dokumentu ze seznamu stránek ---------- */

  // zdroje: Map id → PDFDocument; stranky: [{zdroj, index, otoceni}]
  async function sestav(zdroje, stranky) {
    const doc = await L().PDFDocument.create({ updateMetadata: false });
    const podle = new Map();
    stranky.forEach((s, i) => {
      if (!podle.has(s.zdroj)) podle.set(s.zdroj, []);
      podle.get(s.zdroj).push(i);
    });
    const kopie = new Array(stranky.length);
    for (const [zid, poradi] of podle) {
      const src = zdroje.get(zid);
      if (!src) throw new Error('Chybí zdroj stránky: ' + zid);
      const strany = await doc.copyPages(src, poradi.map(i => stranky[i].index));
      poradi.forEach((i, k) => { kopie[i] = strany[k]; });
    }
    kopie.forEach((p, i) => {
      const ot = stranky[i].otoceni || 0;
      if (ot) p.setRotation(L().degrees((rotace(p) + ot + 360) % 360));
      doc.addPage(p);
    });
    return doc;
  }

  /* ---------- metadata ---------- */

  function cteniMeta(doc) {
    const kw = doc.getKeywords();
    return { nazev: doc.getTitle() || '', autor: doc.getAuthor() || '', predmet: doc.getSubject() || '',
      klicova: kw || '', tvurce: doc.getCreator() || '' };
  }

  // meta: {nazev, autor, predmet, klicova, smazat}
  function nastavMeta(doc, meta) {
    meta = meta || {};
    const { PDFName } = L();
    if (meta.smazat) {
      const info = doc.getInfoDict();
      for (const k of info.keys()) info.delete(k);
      doc.catalog.delete(PDFName.of('Metadata'));      // XMP
    }
    if (meta.nazev) doc.setTitle(meta.nazev);
    if (meta.autor) doc.setAuthor(meta.autor);
    if (meta.predmet) doc.setSubject(meta.predmet);
    if (meta.klicova) doc.setKeywords(String(meta.klicova).split(/[,;]/).map(s => s.trim()).filter(Boolean));
    if (!meta.smazat) { doc.setProducer('PDF dílna (pdf-lib)'); doc.setModificationDate(new Date()); }
  }

  async function uloz(doc, meta) {
    nastavMeta(doc, meta);
    return doc.save({ useObjectStreams: true });
  }

  /* ---------- nové stránky ---------- */

  async function prazdna(w, h) {
    const doc = await L().PDFDocument.create();
    doc.addPage([w || A4[0], h || A4[1]]);
    return doc.save();
  }

  // obrázek (jpg/png) → jednostránkové PDF; rezim 'a4' = vejít na A4 s okrajem, jinak velikost podle DPI
  async function obrazekNaPdf(bytes, typ, o) {
    o = o || {};
    const doc = await L().PDFDocument.create();
    const img = typ === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    let pw, ph, w, h;
    if (o.rezim === 'a4') {
      const nalezato = img.width > img.height;
      [pw, ph] = nalezato ? [A4[1], A4[0]] : A4;
      const okraj = (o.okrajMm ?? 10) * MM;
      const s = Math.min((pw - 2 * okraj) / img.width, (ph - 2 * okraj) / img.height);
      w = img.width * s; h = img.height * s;
    } else {
      const dpi = o.dpi || 96;
      w = pw = img.width * 72 / dpi; h = ph = img.height * 72 / dpi;
    }
    doc.addPage([pw, ph]).drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    return doc.save();
  }

  // rastrované stránky [{data: jpeg bajty, w, h (body)}] → PDF
  async function pdfZJpegu(strany) {
    const doc = await L().PDFDocument.create();
    for (const s of strany) {
      const img = await doc.embedJpg(s.data);
      doc.addPage([s.w, s.h]).drawImage(img, { x: 0, y: 0, width: s.w, height: s.h });
    }
    return doc;
  }

  /* ---------- úpravy obsahu (pracují nad celým dokumentem doc) ---------- */

  function nahradZnacky(text, z) {
    return String(text).replace(/\{(n|celkem|datum|nazev|soubor)\}/g, (_, k) => z[k] ?? '');
  }

  function datumCesky(d) {
    d = d || new Date();
    return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
  }

  // o: {text, velikost, barva, pruhlednost, uhel, pozice:'stred'|'nahore'|'dole', dlazdice:bool}
  function vodoznak(doc, font, o) {
    const vel = o.velikost || 60;
    const radky = String(o.text || '').split('\n');
    for (const page of doc.getPages()) {
      const { w, h } = vizualni(page);
      const kresliBlok = (cx, cy) => {
        radky.forEach((radek, i) => {
          const tw = font.widthOfTextAtSize(radek, vel);
          // svislý posun řádků kolem středu bloku
          const dy = ((radky.length - 1) / 2 - i) * vel * 1.15 - vel * 0.35;
          const [ox, oy] = otoc(-tw / 2, dy, o.uhel || 0);
          kresliText(page, radek, cx + ox, cy + oy, { ...o, font, velikost: vel });
        });
      };
      if (o.dlazdice) {
        const krok = Math.max(vel * 4, 120);
        for (let y = krok / 2; y < h + krok; y += krok * 0.75)
          for (let x = ((y / krok) % 2 ? krok / 2 : 0); x < w + krok; x += krok) kresliBlok(x, y);
      } else {
        const cy = o.pozice === 'nahore' ? h - vel * 1.5 : o.pozice === 'dole' ? vel * 1.5 : h / 2;
        kresliBlok(w / 2, cy);
      }
    }
  }

  // obrázkový vodoznak; o: {velikost: podíl šířky stránky 0–1, pruhlednost, uhel}
  async function vodoznakObrazek(doc, bytes, typ, o) {
    const img = typ === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    for (const page of doc.getPages()) {
      const { w, h } = vizualni(page);
      const iw = w * (o.velikost || 0.5), ih = iw * img.height / img.width;
      const [ox, oy] = otoc(-iw / 2, -ih / 2, o.uhel || 0);
      const p = naUzivatel(page, w / 2 + ox, h / 2 + oy);
      page.drawImage(img, { x: p.x, y: p.y, width: iw, height: ih, opacity: o.pruhlednost ?? 0.3,
        rotate: L().degrees(p.rot + (o.uhel || 0)) });
    }
  }

  // texty u okrajů (číslování, záhlaví, zápatí)
  // polozky: [{text, pozice: 'nahore-vlevo'|'nahore-stred'|'nahore-vpravo'|'dole-…'}]
  // o: {velikost, barva, okrajMm, cisla: [{n, celkem}] pro každou stránku doc (null = přeskočit), datum, nazev}
  function textyNaOkraj(doc, font, polozky, o) {
    const vel = o.velikost || 10, okraj = (o.okrajMm ?? 12) * MM;
    doc.getPages().forEach((page, i) => {
      const c = o.cisla ? o.cisla[i] : { n: i + 1, celkem: doc.getPageCount() };
      if (!c) return;
      const { w, h } = vizualni(page);
      for (const p of polozky) {
        if (!p.text) continue;
        const text = nahradZnacky(p.text, { ...c, datum: o.datum || datumCesky(), nazev: o.nazev || '', soubor: o.soubor || '' });
        const tw = font.widthOfTextAtSize(text, vel);
        const [svis, vodor] = p.pozice.split('-');
        const x = vodor === 'vlevo' ? okraj : vodor === 'vpravo' ? w - okraj - tw : (w - tw) / 2;
        const y = svis === 'nahore' ? h - okraj - vel * 0.75 : okraj;
        kresliText(page, text, x, y, { font, velikost: vel, barva: o.barva });
      }
    });
  }

  // vizuální obdélník zadaný podílem stránky od levého HORNÍHO rohu {fx, fy, fw, fh} → body vlevo dole
  function boxNaBody(page, b) {
    const { w, h } = vizualni(page);
    return { x: b.fx * w, y: h - (b.fy + b.fh) * h, w: b.fw * w, h: b.fh * h };
  }

  async function vlozObrazek(doc, indexy, bytes, typ, b) {
    const img = typ === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    for (const i of indexy) {
      const page = doc.getPage(i), r = boxNaBody(page, b), p = naUzivatel(page, r.x, r.y);
      page.drawImage(img, { x: p.x, y: p.y, width: r.w, height: r.h, rotate: L().degrees(p.rot) });
    }
  }

  // razítko: rámeček + řádky textu zarovnané na střed, písmo se přizpůsobí obdélníku
  function razitko(doc, font, indexy, b, o) {
    const radky = nahradZnacky(o.text || '', { datum: o.datum || datumCesky() }).split('\n');
    for (const i of indexy) {
      const page = doc.getPage(i), r = boxNaBody(page, b);
      const pad = Math.min(r.w, r.h) * 0.08;
      const nejsirsi = Math.max(...radky.map(t => font.widthOfTextAtSize(t, 1)), 0.01);
      const vel = Math.max(4, Math.min((r.w - 2 * pad) / nejsirsi, (r.h - 2 * pad) / (radky.length * 1.2)));
      if (o.ramecek !== false) {
        const p = naUzivatel(page, r.x, r.y);
        page.drawRectangle({ x: p.x, y: p.y, width: r.w, height: r.h, borderColor: barva(o.barva),
          borderWidth: Math.max(1, vel / 10), rotate: L().degrees(p.rot), opacity: 0, borderOpacity: 1 });
      }
      const vyskaBloku = radky.length * vel * 1.2;
      radky.forEach((t, k) => {
        const tw = font.widthOfTextAtSize(t, vel);
        const y = r.y + r.h / 2 + vyskaBloku / 2 - (k + 1) * vel * 1.2 + vel * 0.28;
        kresliText(page, t, r.x + (r.w - tw) / 2, y, { font, velikost: vel, barva: o.barva });
      });
    }
  }

  // ořez okrajů ve vizuálních mm {horni, pravy, dolni, levy}; nastaví CropBox i MediaBox
  function orez(doc, m) {
    for (const page of doc.getPages()) {
      const { w, h } = vizualni(page);
      const l = (m.levy || 0) * MM, p = (m.pravy || 0) * MM, d = (m.dolni || 0) * MM, n = (m.horni || 0) * MM;
      if (l + p >= w - 10 || d + n >= h - 10) throw new Error('Ořez je větší než stránka');
      const a = naUzivatel(page, l, d), b = naUzivatel(page, w - p, h - n);
      const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
      const sw = Math.abs(a.x - b.x), sh = Math.abs(a.y - b.y);
      page.setMediaBox(x, y, sw, sh);
      page.setCropBox(x, y, sw, sh);
    }
  }

  // každou stránku vloží zmenšenou/zvětšenou na A4 (orientace podle stránky), výsledek bez /Rotate
  async function naA4(doc, o) {
    o = o || {};
    const novy = await L().PDFDocument.create({ updateMetadata: false });
    const okraj = (o.okrajMm || 0) * MM;
    for (const page of doc.getPages()) {
      const b = box(page), r = rotace(page), { w, h } = vizualni(page);
      const [pw, ph] = w > h ? [A4[1], A4[0]] : A4;
      const emb = await novy.embedPage(page, { left: b.x, bottom: b.y, right: b.x + b.width, top: b.y + b.height });
      const s = Math.min((pw - 2 * okraj) / w, (ph - 2 * okraj) / h);
      const ox = (pw - w * s) / 2, oy = (ph - h * s) / 2;
      const bw = b.width * s, bh = b.height * s;
      // umístění počátku vloženého obsahu, aby po otočení o -r vyplnil vizuální obdélník
      const pocatek = { 0: [ox, oy], 90: [ox, oy + bw], 180: [ox + bw, oy + bh], 270: [ox + bh, oy] }[r];
      novy.addPage([pw, ph]).drawPage(emb, { x: pocatek[0], y: pocatek[1], xScale: s, yScale: s, rotate: L().degrees(-r) });
    }
    return novy;
  }

  const api = { MM, A4, rozsahy, poN, jednotlive, presun, exifOrientace, crc32, zip, typSouboru, nacti, ChybaPdf, rotace, vizualni,
    naUzivatel, sestav, cteniMeta, nastavMeta, uloz, prazdna, obrazekNaPdf, pdfZJpegu, nahradZnacky, datumCesky,
    vodoznak, vodoznakObrazek, textyNaOkraj, vlozObrazek, razitko, orez, naA4, boxNaBody };
  koren.PDFDILNA = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

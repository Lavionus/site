/* ============================================================
   GENERÁTOR KARET – výstupy: PDF (pdf-lib), tisk přes prohlížeč,
   ZIP s PNG (metoda „uloženo“ + CRC32 jako md_dokument.html).
   Karty kreslí volající: karta(strana, radek) → Promise<canvas>
   (rozměr buňky včetně spadávky, případně už otočený).
   Vystavené jako window.KARTY_VYSTUP.
   ============================================================ */
(function () {
'use strict';
const K = window.KARTY;
const MM_PT = 72 / 25.4;

function nactiSkript(url, globalni) {
  if (window[globalni]) return Promise.resolve(window[globalni]);
  return new Promise((ok, chyba) => {
    const s = document.createElement('script');
    s.src = url; s.onload = () => ok(window[globalni]); s.onerror = () => chyba(new Error('Nepodařilo se načíst ' + url));
    document.head.appendChild(s);
  });
}
function stahni(blob, jmeno) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = jmeno;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const doBlobu = (c, typ) => new Promise(ok => c.toBlob(ok, typ, 0.92));

/* ---------- ZIP ---------- */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[i] = c >>> 0; }
  return t;
})();
function crc32(u8) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function zip(polozky) {
  const enc = new TextEncoder(), casti = [], centralni = [];
  let offset = 0;
  polozky.forEach(p => {
    const data = typeof p.data === 'string' ? enc.encode(p.data) : p.data, jmeno = enc.encode(p.name), crc = crc32(data);
    const lok = new Uint8Array(30 + jmeno.length), dv = new DataView(lok.buffer);
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true);   // bit 11 = jména v UTF-8
    dv.setUint16(12, 0x21, true); dv.setUint32(14, crc, true); dv.setUint32(18, data.length, true); dv.setUint32(22, data.length, true);
    dv.setUint16(26, jmeno.length, true); lok.set(jmeno, 30);
    casti.push(lok, data);
    const cen = new Uint8Array(46 + jmeno.length), cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
    cv.setUint16(14, 0x21, true); cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
    cv.setUint16(28, jmeno.length, true); cv.setUint32(42, offset, true); cen.set(jmeno, 46);
    centralni.push(cen);
    offset += lok.length + data.length;
  });
  const vel = centralni.reduce((s, c) => s + c.length, 0), konec = new Uint8Array(22), kv = new DataView(konec.buffer);
  kv.setUint32(0, 0x06054b50, true); kv.setUint16(8, polozky.length, true); kv.setUint16(10, polozky.length, true);
  kv.setUint32(12, vel, true); kv.setUint32(16, offset, true);
  return new Blob([...casti, ...centralni, konec], { type: 'application/zip' });
}

/* klíč jedinečné karty: společný rub se kreslí jen jednou */
const klic = (P, strana, radek) => strana === 'rub' && P.rubRezim === 'spolecny' ? 'rub:*' : strana + ':' + radek;
function cestaZaobleni(x, y, w, h, r) {   // SVG cesta v pt, osa y dolů
  r = Math.min(r, w / 2, h / 2);
  if (r <= 0) return `M${x},${y} H${x + w} V${y + h} H${x} Z`;
  return `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h - r} A${r},${r} 0 0 1 ${x + w - r},${y + h} ` +
    `H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
}

/* o = { P, L, listy, karta(strana, radek) → canvas, prubeh(0..1) } */
async function pdf(o) {
  const PDFLib = await nactiSkript('lib/pdflib/pdf-lib.min.js', 'PDFLib');
  const { PDFDocument, rgb } = PDFLib;
  const doc = await PDFDocument.create();
  doc.setTitle(o.P.nazev || 'Karty'); doc.setCreator('Generátor karet');
  const { P, L } = o, cache = new Map();
  const pruhledne = !L.b && +P.karta.zaobleni > 0;
  const obraz = async (strana, radek) => {
    const k = klic(P, strana, radek);
    if (!cache.has(k)) {
      const c = await o.karta(strana, radek);
      const b = await doBlobu(c, pruhledne ? 'image/png' : 'image/jpeg');
      const bajty = new Uint8Array(await b.arrayBuffer());
      cache.set(k, pruhledne ? await doc.embedPng(bajty) : await doc.embedJpg(bajty));
    }
    return cache.get(k);
  };
  const cerna = rgb(0, 0, 0), ph = L.ph * MM_PT;
  const znacky = (page, dx, dy) => {
    if (!P.arch.znacky) return;
    K.orezoveZnacky(L).forEach(z => page.drawLine({
      start: { x: (z.x1 + dx) * MM_PT, y: ph - (z.y1 + dy) * MM_PT }, end: { x: (z.x2 + dx) * MM_PT, y: ph - (z.y2 + dy) * MM_PT },
      thickness: 0.25, color: cerna }));
  };
  const strany = P.rubRezim === 'ne' ? ['lic'] : ['lic', 'rub'];
  const celkem = o.listy.length * strany.length;
  let hotovo = 0;
  for (const list of o.listy) {
    for (const strana of strany) {
      const page = doc.addPage([L.pw * MM_PT, ph]);
      for (const p of list[strana]) {
        const img = await obraz(strana, p.karta.radek);
        page.drawImage(img, { x: p.x * MM_PT, y: ph - (p.y + L.ch) * MM_PT, width: L.cw * MM_PT, height: L.ch * MM_PT });
        if (P.arch.obrysRezu && strana === 'lic') {
          page.drawSvgPath(cestaZaobleni((p.x + L.b) * MM_PT, (p.y + L.b) * MM_PT, L.w * MM_PT, L.h * MM_PT, (+P.karta.zaobleni || 0) * MM_PT),
            { x: 0, y: ph, borderColor: rgb(0.55, 0.55, 0.55), borderWidth: 0.3 });
        }
      }
      if (strana === 'lic') znacky(page, 0, 0); else znacky(page, +P.arch.posunX || 0, +P.arch.posunY || 0);
      o.prubeh && o.prubeh(++hotovo / celkem);
    }
  }
  return new Blob([await doc.save()], { type: 'application/pdf' });
}

/* tisk přes prohlížeč: listy jako bloky v mm s obrázky karet */
async function tisk(o) {
  const { P, L } = o, obal = document.getElementById('tiskArchy'), url = new Map();
  obal.innerHTML = '';
  const strany = P.rubRezim === 'ne' ? ['lic'] : ['lic', 'rub'];
  const celkem = o.listy.length * strany.length;
  let hotovo = 0;
  const f = n => (Math.round(n * 1000) / 1000) + 'mm';
  for (const list of o.listy) {
    for (const strana of strany) {
      const div = document.createElement('div');
      div.className = 'tisk-list'; div.style.width = f(L.pw); div.style.height = f(L.ph - 0.4);
      for (const p of list[strana]) {
        const k = klic(P, strana, p.karta.radek);
        if (!url.has(k)) url.set(k, URL.createObjectURL(await doBlobu(await o.karta(strana, p.karta.radek), 'image/png')));
        const img = new Image(); img.src = url.get(k);
        img.style.cssText = `left:${f(p.x)};top:${f(p.y)};width:${f(L.cw)};height:${f(L.ch)}`;
        div.appendChild(img);
      }
      if (P.arch.znacky) {
        const dx = strana === 'rub' ? +P.arch.posunX || 0 : 0, dy = strana === 'rub' ? +P.arch.posunY || 0 : 0;
        K.orezoveZnacky(L).forEach(z => {
          const e = document.createElement('div'); e.className = 'zn';
          const svisla = z.x1 === z.x2;
          e.style.cssText = svisla ? `left:${f(z.x1 + dx - 0.1)};top:${f(Math.min(z.y1, z.y2) + dy)};width:0.2mm;height:${f(Math.abs(z.y2 - z.y1))}`
            : `top:${f(z.y1 + dy - 0.1)};left:${f(Math.min(z.x1, z.x2) + dx)};height:0.2mm;width:${f(Math.abs(z.x2 - z.x1))}`;
          div.appendChild(e);
        });
      }
      obal.appendChild(div);
      o.prubeh && o.prubeh(++hotovo / celkem);
    }
  }
  let st = document.getElementById('tiskStranka');
  if (!st) { st = document.createElement('style'); st.id = 'tiskStranka'; document.head.appendChild(st); }
  st.textContent = `@page{size:${L.pw}mm ${L.ph}mm;margin:0}`;
  await Promise.all([...obal.querySelectorAll('img')].map(i => i.decode().catch(() => {})));
  const uklid = () => { url.forEach(u => URL.revokeObjectURL(u)); obal.innerHTML = ''; removeEventListener('afterprint', uklid); };
  addEventListener('afterprint', uklid);
  window.print();
}

/* PNG každé jedinečné karty (kopie jen jednou) do ZIPu */
async function pngZip(o) {
  const { P } = o, polozky = [], hotove = new Set();
  const radky = P.data.radky.length ? P.data.radky.map((_, i) => i) : [-1];
  const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').slice(0, 40).toLowerCase();
  let hotovo = 0;
  for (const i of radky) {
    const cislo = String(i + 2).padStart(3, '0');    // číslo řádku jako v tabulce (1 = hlavička)
    const jm = slug(i >= 0 ? P.data.radky[i][0] : 'karta') || 'karta';
    const c = await o.karta('lic', i);
    polozky.push({ name: `${i >= 0 ? cislo + '_' : ''}${jm}.png`, data: new Uint8Array(await (await doBlobu(c, 'image/png')).arrayBuffer()) });
    if (P.rubRezim !== 'ne') {
      const k = klic(P, 'rub', i);
      if (!hotove.has(k)) {
        hotove.add(k);
        const r = await o.karta('rub', i);
        polozky.push({ name: P.rubRezim === 'spolecny' ? 'rub.png' : `${cislo}_${jm}_rub.png`, data: new Uint8Array(await (await doBlobu(r, 'image/png')).arrayBuffer()) });
      }
    }
    o.prubeh && o.prubeh(++hotovo / radky.length);
  }
  return zip(polozky);
}

window.KARTY_VYSTUP = { nactiSkript, stahni, zip, crc32, pdf, tisk, pngZip, doBlobu };
})();

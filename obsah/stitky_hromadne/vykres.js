/* ============================================================
   Hromadný tisk štítků – kreslení primitiv z jadro.js
   do SVG (náhled i tisk v přesných mm) a do jsPDF.
   ============================================================ */
(function (koren) {
'use strict';
const PISMO = 'StitkyLS';      // Liberation Sans načtená přes FontFace (stejné metriky jako v PDF)
const PT = 25.4 / 72;
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = x => Math.round(x * 1000) / 1000;

function svgPrimitiva(prim) {
  let s = '';
  for (const p of prim) {
    if (p.t === 'obd') {
      let d = '';
      for (const [x, y, w, h] of p.obd) d += `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}z`;
      s += `<path d="${d}" fill="${esc(p.barva)}"/>`;
    } else if (p.t === 'text') {
      s += `<text x="${n(p.x)}" y="${n(p.y)}" font-size="${n(p.s)}" text-anchor="${p.zar}"${p.tucne ? ' font-weight="bold"' : ''} fill="${esc(p.barva)}" xml:space="preserve">${esc(p.text)}</text>`;
    } else if (p.t === 'ram') {
      s += `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}" rx="${n(p.r)}" fill="none" stroke="${esc(p.barva)}" stroke-width="${n(p.tl)}"${p.carkovane ? ' stroke-dasharray="0.8 0.6"' : ''}/>`;
    } else if (p.t === 'obr') {
      s += `<image href="${esc(p.data)}" x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}" preserveAspectRatio="none"/>`;
    }
  }
  return s;
}

// Jeden štítek samostatně (editor návrhu). o.obrys = šedý obrys štítku.
function svgStitku(prim, w, h, o = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(w)} ${n(h)}" font-family="${PISMO}, 'Liberation Sans', Arial, sans-serif">` +
    `<rect width="${n(w)}" height="${n(h)}" rx="${n(o.zaobleni || 0)}" fill="#fff"${o.obrys ? ' stroke="#b0b6bd" stroke-width="0.2"' : ''}/>` +
    `<g>${svgPrimitiva(prim)}</g></svg>`;
}

/* Celý arch. polozky = [{ slot, prim }], o = { papir, kalibrace:{dx,dy}, obrysy, naznacit (šedé plochy štítků v náhledu),
   idPredpona, mm (rozměr v mm pro tisk), zvyraznit: slot }. */
function svgArchu(ar, polozky, o) {
  const S = koren.STITKY, p = o.papir, dx = (o.kalibrace && +o.kalibrace.dx) || 0, dy = (o.kalibrace && +o.kalibrace.dy) || 0;
  const pre = o.idPredpona || 'a', rozmer = o.mm ? ` width="${p.w}mm" height="${p.h}mm"` : '';
  let s = `<svg xmlns="http://www.w3.org/2000/svg"${rozmer} viewBox="0 0 ${p.w} ${p.h}" font-family="${PISMO}, 'Liberation Sans', Arial, sans-serif">`;
  s += `<rect width="${p.w}" height="${p.h}" fill="#fff"/><g transform="translate(${n(dx)} ${n(dy)})">`;
  const N = S.naArch(ar), r = Math.min(ar.zaobleni || 0, ar.w / 2, ar.h / 2);
  if (o.naznacit || o.obrysy) for (let i = 0; i < N; i++) {
    const q = S.poziceStitku(ar, i);
    s += `<rect x="${n(q.x)}" y="${n(q.y)}" width="${n(q.w)}" height="${n(q.h)}" rx="${n(r)}" fill="${o.naznacit ? (i === o.zvyraznit ? '#dbe8fb' : i < o.zvyraznit ? '#d5d8dc' : '#f4f5f7') : 'none'}" stroke="${o.obrysy ? '#888' : '#d5d9de'}" stroke-width="${o.obrysy ? 0.15 : 0.2}"${o.naznacit ? ` data-slot="${i}"` : ''}/>`;
  }
  for (const it of polozky) {
    const q = S.poziceStitku(ar, it.slot), id = `${pre}k${it.slot}`;
    s += `<clipPath id="${id}"><rect width="${n(q.w)}" height="${n(q.h)}"/></clipPath>` +
      `<g transform="translate(${n(q.x)} ${n(q.y)})" clip-path="url(#${id})">${svgPrimitiva(it.prim)}</g>`;
  }
  if (o.krize) { // značky pro kalibraci: kříž v rozích papíru 10 mm od kraje
    for (const [x, y] of [[10, 10], [p.w - 10, 10], [10, p.h - 10], [p.w - 10, p.h - 10]])
      s += `<path d="M${x - 4} ${y}h8M${x} ${y - 4}v8" stroke="#000" stroke-width="0.2"/>`;
  }
  return s + '</g></svg>';
}

/* ---------- PDF (jsPDF v mm) ---------- */
function rgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const v = m ? parseInt(m[1], 16) : 0;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function formatObrazku(data) { return /^data:image\/jpe?g/i.test(data) ? 'JPEG' : 'PNG'; }

function pdfArch(doc, ar, polozky, o) {
  const S = koren.STITKY, dx = (o.kalibrace && +o.kalibrace.dx) || 0, dy = (o.kalibrace && +o.kalibrace.dy) || 0;
  const aliasy = o.aliasy || (o.aliasy = new Map());
  if (o.obrysy) {
    doc.setDrawColor(136, 136, 136); doc.setLineWidth(0.15); doc.setLineDashPattern([], 0);
    for (let i = 0; i < S.naArch(ar); i++) { const q = S.poziceStitku(ar, i); doc.rect(q.x + dx, q.y + dy, q.w, q.h, 'S'); }
  }
  for (const it of polozky) {
    const q = S.poziceStitku(ar, it.slot), ox = q.x + dx, oy = q.y + dy;
    for (const p of it.prim) {
      if (p.t === 'obd') {
        doc.setFillColor(...rgb(p.barva));
        for (const [x, y, w, h] of p.obd) doc.rect(ox + x, oy + y, w, h, 'F');
      } else if (p.t === 'text') {
        doc.setFont(o.pismo ? (p.tucne ? 'LSB' : 'LS') : 'helvetica', p.tucne ? (o.pismo ? 'normal' : 'bold') : 'normal');
        doc.setFontSize(p.s / PT); doc.setTextColor(...rgb(p.barva));
        doc.text(p.text, ox + p.x, oy + p.y, { align: p.zar === 'middle' ? 'center' : p.zar === 'end' ? 'right' : 'left', baseline: 'alphabetic' });
      } else if (p.t === 'ram') {
        doc.setDrawColor(...rgb(p.barva)); doc.setLineWidth(p.tl);
        doc.setLineDashPattern(p.carkovane ? [0.8, 0.6] : [], 0);
        if (p.r > 0) doc.roundedRect(ox + p.x, oy + p.y, p.w, p.h, p.r, p.r, 'S'); else doc.rect(ox + p.x, oy + p.y, p.w, p.h, 'S');
        doc.setLineDashPattern([], 0);
      } else if (p.t === 'obr') {
        if (!aliasy.has(p.data)) aliasy.set(p.data, 'obr' + aliasy.size);
        doc.addImage(p.data, formatObrazku(p.data), ox + p.x, oy + p.y, p.w, p.h, aliasy.get(p.data));
      }
    }
  }
}

const api = { PISMO, svgPrimitiva, svgStitku, svgArchu, pdfArch, rgb };
if (typeof module === 'object' && module.exports) module.exports = api;
koren.STITKY_VYKRES = api;
})(typeof window !== 'undefined' ? window : globalThis);

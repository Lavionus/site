/* ============================================================
   GENERÁTOR KARET – kreslení jedné strany karty na plátno 2D
   Stejná funkce slouží náhledu, PNG, PDF i tisku (liší se jen
   měřítko a vodítka). Souřadnice vrstev v mm od levého horního
   rohu ořezu. Vystavené jako window.KARTY_KRESBA.
   ============================================================ */
(function () {
'use strict';
const K = window.KARTY;
const GENERICKA = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui']);

function rodina(p) {
  p = String(p || 'sans-serif').trim();
  return GENERICKA.has(p) ? p : `"${p.replace(/"/g, '')}", sans-serif`;
}
function pismo(v, px) {
  return `${v.kurziva ? 'italic ' : ''}${v.tucne ? 'bold ' : ''}${px.toFixed(2)}px ${rodina(v.pismo)}`;
}
function cesta(ctx, druh, x, y, w, h, r) {
  ctx.beginPath();
  if (druh === 'elipsa') { ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2); return; }
  if (druh === 'kosoctverec') { ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x, y + h / 2); ctx.closePath(); return; }
  if (druh === 'sestiuhelnik' || druh === 'hvezda') {
    const n = druh === 'hvezda' ? 10 : 6, cx = x + w / 2, cy = y + h / 2;
    for (let i = 0; i < n; i++) {
      const u = -Math.PI / 2 + i * 2 * Math.PI / n, k = druh === 'hvezda' && i % 2 ? 0.45 : 1;
      const px = cx + Math.cos(u) * w / 2 * k, py = cy + Math.sin(u) * h / 2 * k;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); return;
  }
  r = Math.max(0, Math.min(r || 0, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}
const barva = (ctx, c, vych) => { ctx.fillStyle = vych; ctx.strokeStyle = vych; if (c) { ctx.fillStyle = c; ctx.strokeStyle = c; } };

/* text: vrací { preteka } */
function kresliText(ctx, v, mm) {
  const mer = (t, s) => { ctx.font = pismo(v, s * mm); return ctx.measureText(t).width / mm; };
  const max = (+v.velikost || 12) * K.PT_MM, min = (+v.minVelikost || 4) * K.PT_MM, lh = +v.radkovani || 1.15;
  const r = K.prizpusob(v.text, v.w, v.h, { max, min, radkovani: lh, prizpusobit: v.prizpusobit !== false }, mer);
  ctx.font = pismo(v, r.velikost * mm);
  ctx.textBaseline = 'middle';
  const zar = v.zarovnani === 'vlevo' ? 'left' : v.zarovnani === 'vpravo' ? 'right' : 'center';
  ctx.textAlign = zar;
  const x = zar === 'left' ? v.x : zar === 'right' ? v.x + v.w : v.x + v.w / 2;
  const vyska = r.radky.length * r.velikost * lh;
  let y0 = v.svisle === 'nahore' ? v.y : v.svisle === 'dole' ? v.y + v.h - vyska : v.y + (v.h - vyska) / 2;
  barva(ctx, v.barva, '#000');
  const obrys = v.obrys && +v.obrysSila > 0;
  if (obrys) { ctx.strokeStyle = v.obrys; ctx.lineWidth = +v.obrysSila * 2 * mm; ctx.lineJoin = 'round'; }
  r.radky.forEach((t, i) => {
    const y = (y0 + (i + 0.5) * r.velikost * lh) * mm;
    if (obrys) ctx.strokeText(t, x * mm, y);
    ctx.fillText(t, x * mm, y);
  });
  return { preteka: r.preteka };
}
function kresliIkonu(ctx, v, mm) {
  const t = String(v.text || '');
  if (!t) return;
  ctx.font = `100px ${rodina(v.pismo)}`;
  const m = ctx.measureText(t);
  const sirka = m.width || 1, vyska = (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) || 100;
  const s = 100 * Math.min(v.w * mm / sirka, v.h * mm / vyska);
  ctx.font = `${s.toFixed(2)}px ${rodina(v.pismo)}`;
  const m2 = ctx.measureText(t);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  barva(ctx, v.barva, '#000');
  ctx.fillText(t, (v.x + v.w / 2) * mm, (v.y + v.h / 2) * mm + (m2.actualBoundingBoxAscent - m2.actualBoundingBoxDescent) / 2);
}
function kresliObrazek(ctx, v, mm, o) {
  const img = o.obrazek ? o.obrazek(v.src) : null;
  const x = v.x * mm, y = v.y * mm, w = v.w * mm, h = v.h * mm;
  if (!img) {
    if (o.voditka && v.src) {
      ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = '#c0392b'; ctx.font = `${Math.max(9, 2.6 * mm).toFixed(1)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🖼 chybí: ' + v.src, x + w / 2, y + h / 2, w - 4);
      ctx.restore();
    }
    return { chybi: v.src || '' };
  }
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, v.pruhlednost == null ? 1 : +v.pruhlednost));
  cesta(ctx, 'obdelnik', x, y, w, h, (+v.zaobleni || 0) * mm); ctx.clip();
  const iw = img.width, ih = img.height;
  if (v.prizpusobeni === 'roztahnout') ctx.drawImage(img, x, y, w, h);
  else {
    const k = v.prizpusobeni === 'cely' ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih);
    ctx.drawImage(img, x + (w - iw * k) / 2, y + (h - ih * k) / 2, iw * k, ih * k);
  }
  ctx.restore();
}
function kresliTvar(ctx, v, mm) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, v.pruhlednost == null ? 1 : +v.pruhlednost));
  cesta(ctx, v.druh, v.x * mm, v.y * mm, v.w * mm, v.h * mm, (+v.zaobleni || 0) * mm);
  if (v.vypln) { barva(ctx, v.vypln, '#000'); ctx.fill(); }
  if (v.obrys && +v.obrysSila > 0) { ctx.strokeStyle = '#000'; ctx.strokeStyle = v.obrys; ctx.lineWidth = +v.obrysSila * mm; ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.restore();
}
function kresliRamecek(ctx, v, karta, mm) {
  const s = Math.max(0, +v.sila || 0), o = +v.odsazeni || 0;
  if (!s) return;
  const kresli = (od, sila) => {
    const r = Math.max(0, (v.zaobleni == null ? (+karta.zaobleni || 0) - od : +v.zaobleni));
    cesta(ctx, 'obdelnik', (od + sila / 2) * mm, (od + sila / 2) * mm, (karta.w - 2 * od - sila) * mm, (karta.h - 2 * od - sila) * mm, r * mm);
    ctx.lineWidth = sila * mm; ctx.stroke();
  };
  ctx.strokeStyle = '#000'; if (v.barva) ctx.strokeStyle = v.barva;
  kresli(o, s);
  if (v.dvojity) kresli(o + s * 1.8, Math.max(0.15, s * 0.35));
}

/* Hlavní funkce. strana = výsledek KARTY.vyhodnotStranu, karta = projekt.karta.
   o = { mm: px na mm, spadavka: kreslit i spadávku, rohy: oříznout zaoblené rohy
         (průhledné), voditka: náhled s ořezem/bezpečnou zónou, vybrana: id,
         obrazek: jméno → ImageBitmap | null }
   Plátno musí mít rozměr (w + 2b) × (h + 2b) mm při spadávce, jinak w × h.
   Vrací { pretekaji: [id], chybi: [jména] }. */
function kresli(ctx, strana, karta, o) {
  const mm = o.mm, b = o.spadavka ? (+karta.spadavka || 0) : 0;
  const W = (karta.w + 2 * b) * mm, H = (karta.h + 2 * b) * mm;
  const vysl = { pretekaji: [], chybi: [] };
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  if (o.rohy && !b && +karta.zaobleni > 0) { cesta(ctx, 'obdelnik', 0, 0, W, H, karta.zaobleni * mm); ctx.clip(); }
  barva(ctx, strana.pozadi, '#ffffff'); ctx.fillRect(0, 0, W, H);
  ctx.translate(b * mm, b * mm);
  for (const v of strana.vrstvy) {
    ctx.save();
    if (+v.otoceni && v.typ !== 'ramecek') {
      const cx = (v.x + v.w / 2) * mm, cy = (v.y + v.h / 2) * mm;
      ctx.translate(cx, cy); ctx.rotate(+v.otoceni * Math.PI / 180); ctx.translate(-cx, -cy);
    }
    if (v.typ === 'text') { if (kresliText(ctx, v, mm).preteka) vysl.pretekaji.push(v.id); }
    else if (v.typ === 'ikona') kresliIkonu(ctx, v, mm);
    else if (v.typ === 'obrazek') { const r = kresliObrazek(ctx, v, mm, o); if (r && r.chybi) vysl.chybi.push(r.chybi); }
    else if (v.typ === 'tvar') kresliTvar(ctx, v, mm);
    else if (v.typ === 'ramecek') kresliRamecek(ctx, v, karta, mm);
    if (o.voditka && vysl.pretekaji.includes(v.id)) {
      ctx.setLineDash([4, 3]); ctx.strokeStyle = '#e02020'; ctx.lineWidth = 1.5; ctx.strokeRect(v.x * mm, v.y * mm, v.w * mm, v.h * mm);
    }
    ctx.restore();
  }
  ctx.restore();
  if (o.voditka) voditka(ctx, karta, mm, b, o.vybrana ? strana.vrstvy.find(v => v.id === o.vybrana) : null);
  return vysl;
}
function voditka(ctx, karta, mm, b, vybrana) {
  ctx.save();
  const W = (karta.w + 2 * b) * mm, H = (karta.h + 2 * b) * mm;
  if (b) {   // spadávka ztmavená, mimo zaoblený ořez
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    const r = Math.min(+karta.zaobleni || 0, karta.w / 2, karta.h / 2) * mm;
    ctx.beginPath(); ctx.rect(0, 0, W, H);
    ctx.roundRect(b * mm, b * mm, karta.w * mm, karta.h * mm, r);
    ctx.fill('evenodd');
  }
  ctx.translate(b * mm, b * mm);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(220,40,40,.9)';
  cesta(ctx, 'obdelnik', 0, 0, karta.w * mm, karta.h * mm, (+karta.zaobleni || 0) * mm); ctx.stroke();
  const s = +karta.bezpecna || 0;
  if (s > 0) {
    ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(30,120,220,.85)';
    ctx.strokeRect(s * mm, s * mm, (karta.w - 2 * s) * mm, (karta.h - 2 * s) * mm);
  }
  if (vybrana && vybrana.typ !== 'ramecek') {
    ctx.setLineDash([]);
    const x = vybrana.x * mm, y = vybrana.y * mm, w = vybrana.w * mm, h = vybrana.h * mm;
    const cx = x + w / 2, cy = y + h / 2;
    ctx.translate(cx, cy); ctx.rotate((+vybrana.otoceni || 0) * Math.PI / 180); ctx.translate(-cx, -cy);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = '#1e78dc'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#1e78dc'; ctx.fillRect(x + w - 5, y + h - 5, 10, 10);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.strokeRect(x + w - 5, y + h - 5, 10, 10);
  }
  ctx.restore();
}
/* plátno → otočené o 90° (karta položená na arch napříč) */
function otoc(c) {
  const o = document.createElement('canvas');
  o.width = c.height; o.height = c.width;
  const x = o.getContext('2d');
  x.translate(o.width, 0); x.rotate(Math.PI / 2); x.drawImage(c, 0, 0);
  return o;
}

function otoc180(c) {
  const o = document.createElement('canvas');
  o.width = c.width; o.height = c.height;
  const x = o.getContext('2d');
  x.translate(o.width, o.height); x.rotate(Math.PI); x.drawImage(c, 0, 0);
  return o;
}

window.KARTY_KRESBA = { kresli, otoc, otoc180, rodina };
})();

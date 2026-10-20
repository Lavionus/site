/* Plakát s útržky – vykreslení primitiv z jádra: SVG (náhled a tisk), plátno (PNG), jsPDF (vektorové PDF).
   Všechny tři kreslí text bez kerningu a ligatur na souřadnice spočtené jádrem → náhled = PDF.
   Export: window.PUV i module.exports. */
(function (koren) {
  'use strict';
  const PUV = {};
  const PT = 72 / 25.4;
  const n = (v) => (Math.round(v * 1000) / 1000).toString();
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  PUV.rodina = (klic) => 'PU_' + klic;
  const FAUX = 0.045;   // tloušťka obrysu umělého ztučnění (násobek velikosti písma)

  /* ---------------- SVG ---------------- */
  PUV.svg = function (list, o) {
    o = o || {};
    const ob = o.obrazky || {};
    let s = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${n(list.w)}mm" height="${n(list.h)}mm" viewBox="0 0 ${n(list.w)} ${n(list.h)}" style="font-kerning:none;font-variant-ligatures:none;text-rendering:optimizeSpeed;white-space:pre">`;
    for (const p of list.prim) {
      switch (p.t) {
        case 'obd': {
          const r = p.r ? ` rx="${n(p.r)}" ry="${n(p.r)}"` : '';
          const f = p.vypln ? `fill="${p.vypln}"` : 'fill="none"';
          const st = p.obrys ? ` stroke="${p.obrys}" stroke-width="${n(p.s || 0.3)}"` : '';
          s += `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}"${r} ${f}${st}/>`;
          break;
        }
        case 'cara': {
          const d = p.carky ? ` stroke-dasharray="${p.carky.map(n).join(' ')}"` : '';
          s += `<line x1="${n(p.x1)}" y1="${n(p.y1)}" x2="${n(p.x2)}" y2="${n(p.y2)}" stroke="${p.barva}" stroke-width="${n(p.s || 0.3)}"${d}/>`;
          break;
        }
        case 'kruh':
          s += `<circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.r)}" fill="${p.vypln || 'none'}"${p.obrys ? ` stroke="${p.obrys}" stroke-width="${n(p.s || 0.3)}"` : ''}/>`;
          break;
        case 'mnoho':
          s += `<polygon points="${p.body.map(b => n(b[0]) + ',' + n(b[1])).join(' ')}" fill="${p.vypln}"/>`;
          break;
        case 'qr': {
          let d = '';
          for (const [r, c, l] of p.behy) d += `M${n(p.x + c * p.m)} ${n(p.y + r * p.m)}h${n(l * p.m)}v${n(p.m)}h${n(-l * p.m)}z`;
          s += `<path d="${d}" fill="${p.barva}" shape-rendering="crispEdges"/>`;
          break;
        }
        case 'obraz':
          if (ob[p.id]) s += `<image x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}" preserveAspectRatio="none" href="${ob[p.id].data}" xlink:href="${ob[p.id].data}"/>`;
          else s += `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}" fill="#cfd6de"/>`;
          break;
        case 'text': {
          const tr = p.uhel ? ` transform="rotate(${-p.uhel} ${n(p.x)} ${n(p.y)})"` : '';
          const fx = p.faux ? ` stroke="${p.barva}" stroke-width="${n(p.vel * FAUX)}" stroke-linejoin="round"` : '';
          s += `<text x="${n(p.x)}" y="${n(p.y)}" font-family="${PUV.rodina(p.pismo)}" font-size="${n(p.vel)}" fill="${p.barva}"${fx}${tr}>${esc(p.text)}</text>`;
          break;
        }
      }
    }
    return s + '</svg>';
  };

  /* ---------------- plátno ---------------- */
  /* ctx: 2D kontext, mer = px na mm; obrazky = { id: CanvasImageSource } */
  PUV.platno = function (ctx, list, mer, o) {
    o = o || {};
    const ob = o.obrazky || {};
    ctx.save();
    ctx.setTransform(mer, 0, 0, mer, 0, 0);
    try { ctx.fontKerning = 'none'; } catch (e) { /* starší prohlížeč */ }
    try { ctx.textRendering = 'optimizeSpeed'; } catch (e) { /* */ }
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const zaobl = (p) => {
      ctx.beginPath();
      if (p.r && ctx.roundRect) ctx.roundRect(p.x, p.y, p.w, p.h, p.r); else ctx.rect(p.x, p.y, p.w, p.h);
    };
    for (const p of list.prim) {
      ctx.setLineDash([]);
      switch (p.t) {
        case 'obd':
          zaobl(p);
          if (p.vypln) { ctx.fillStyle = p.vypln; ctx.fill(); }
          if (p.obrys) { ctx.strokeStyle = p.obrys; ctx.lineWidth = p.s || 0.3; ctx.stroke(); }
          break;
        case 'cara':
          ctx.beginPath(); ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2);
          if (p.carky) ctx.setLineDash(p.carky);
          ctx.strokeStyle = p.barva; ctx.lineWidth = p.s || 0.3; ctx.stroke();
          break;
        case 'kruh':
          ctx.beginPath(); ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
          if (p.vypln) { ctx.fillStyle = p.vypln; ctx.fill(); }
          if (p.obrys) { ctx.strokeStyle = p.obrys; ctx.lineWidth = p.s || 0.3; ctx.stroke(); }
          break;
        case 'mnoho':
          ctx.beginPath(); p.body.forEach((b, i) => (i ? ctx.lineTo(b[0], b[1]) : ctx.moveTo(b[0], b[1]))); ctx.closePath();
          ctx.fillStyle = p.vypln; ctx.fill();
          break;
        case 'qr':
          ctx.fillStyle = p.barva;
          for (const [r, c, l] of p.behy) ctx.fillRect(p.x + c * p.m, p.y + r * p.m, l * p.m + 0.01, p.m + 0.01);
          break;
        case 'obraz':
          if (ob[p.id]) ctx.drawImage(ob[p.id], p.x, p.y, p.w, p.h);
          else { ctx.fillStyle = '#cfd6de'; ctx.fillRect(p.x, p.y, p.w, p.h); }
          break;
        case 'text':
          ctx.save();
          ctx.translate(p.x, p.y);
          if (p.uhel) ctx.rotate(-p.uhel * Math.PI / 180);
          ctx.font = `${p.vel}px "${PUV.rodina(p.pismo)}"`;
          ctx.fillStyle = p.barva;
          ctx.fillText(p.text, 0, 0);
          if (p.faux) { ctx.strokeStyle = p.barva; ctx.lineWidth = p.vel * FAUX; ctx.lineJoin = 'round'; ctx.strokeText(p.text, 0, 0); }
          ctx.restore();
          break;
      }
    }
    ctx.restore();
  };

  /* ---------------- PDF ---------------- */
  function rgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return [0, 0, 0];
    const v = parseInt(m[1], 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  /* listy = [{w,h,prim}], o.pisma = { klic: {soubor, base64} }, o.obrazky = { id: {data: dataURL, format: 'JPEG'|'PNG'} } */
  PUV.pdf = function (jsPDF, listy, o) {
    o = o || {};
    const prvni = listy[0];
    const or = (l) => (l.w > l.h ? 'l' : 'p');
    const doc = new jsPDF({ unit: 'mm', format: [prvni.w, prvni.h], orientation: or(prvni), compress: true });
    doc.setProperties({ title: o.nazev || 'Plakát s útržky', creator: 'Plakát s útržky' });
    const pouzita = new Set();
    for (const l of listy) for (const p of l.prim) if (p.t === 'text') pouzita.add(p.pismo);
    const maPismo = {};
    for (const k of pouzita) {
      const f = (o.pisma || {})[k];
      if (!f || !f.base64) continue;
      try { doc.addFileToVFS(f.soubor, f.base64); doc.addFont(f.soubor, PUV.rodina(k), 'normal'); maPismo[k] = true; } catch (e) { /* zůstane Helvetica */ }
    }
    const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '?');
    listy.forEach((l, i) => {
      if (i) doc.addPage([l.w, l.h], or(l));
      doc.setLineCap('butt'); doc.setLineJoin('miter');
      for (const p of l.prim) {
        doc.setLineDashPattern([], 0);
        switch (p.t) {
          case 'obd': {
            const f = p.vypln ? rgb(p.vypln) : null, st = p.obrys ? rgb(p.obrys) : null;
            if (f) doc.setFillColor(f[0], f[1], f[2]);
            if (st) { doc.setDrawColor(st[0], st[1], st[2]); doc.setLineWidth(p.s || 0.3); }
            const styl = f && st ? 'FD' : f ? 'F' : 'S';
            if (!f && !st) break;
            if (p.r) doc.roundedRect(p.x, p.y, p.w, p.h, p.r, p.r, styl); else doc.rect(p.x, p.y, p.w, p.h, styl);
            break;
          }
          case 'cara': {
            const c = rgb(p.barva); doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(p.s || 0.3);
            if (p.carky) doc.setLineDashPattern(p.carky, 0);
            doc.line(p.x1, p.y1, p.x2, p.y2, 'S');
            break;
          }
          case 'kruh': {
            const f = p.vypln ? rgb(p.vypln) : null, st = p.obrys ? rgb(p.obrys) : null;
            if (f) doc.setFillColor(f[0], f[1], f[2]);
            if (st) { doc.setDrawColor(st[0], st[1], st[2]); doc.setLineWidth(p.s || 0.3); }
            doc.circle(p.cx, p.cy, p.r, f && st ? 'FD' : f ? 'F' : 'S');
            break;
          }
          case 'mnoho': {
            const c = rgb(p.vypln); doc.setFillColor(c[0], c[1], c[2]);
            const d = []; for (let j = 1; j < p.body.length; j++) d.push([p.body[j][0] - p.body[j - 1][0], p.body[j][1] - p.body[j - 1][1]]);
            doc.lines(d, p.body[0][0], p.body[0][1], [1, 1], 'F', true);
            break;
          }
          case 'qr': {
            const c = rgb(p.barva); doc.setFillColor(c[0], c[1], c[2]);
            for (const [r, cc, len] of p.behy) doc.rect(p.x + cc * p.m, p.y + r * p.m, len * p.m, p.m + 0.005, 'F');
            break;
          }
          case 'obraz': {
            const im = (o.obrazky || {})[p.id];
            if (im) doc.addImage(im.data, im.format || 'JPEG', p.x, p.y, p.w, p.h, 'img_' + p.id + '_' + (im.verze || 0), 'NONE');
            else { doc.setFillColor(207, 214, 222); doc.rect(p.x, p.y, p.w, p.h, 'F'); }
            break;
          }
          case 'text': {
            const c = rgb(p.barva);
            const ma = maPismo[p.pismo];
            doc.setFont(ma ? PUV.rodina(p.pismo) : 'helvetica', 'normal');
            doc.setFontSize(p.vel * PT);
            doc.setTextColor(c[0], c[1], c[2]);
            const volby = { baseline: 'alphabetic', renderingMode: 'fill' };
            if (p.uhel) volby.angle = p.uhel;
            if (p.faux) { doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(p.vel * FAUX); doc.setLineJoin('round'); volby.renderingMode = 'fillThenStroke'; }
            doc.text(ma ? p.text : bezDiakritiky(p.text), p.x, p.y, volby);
            if (p.faux) doc.setLineJoin('miter');
            break;
          }
        }
      }
    });
    doc.setLineDashPattern([], 0);
    return doc;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PUV;
  koren.PUV = PUV;
})(typeof window !== 'undefined' ? window : globalThis);

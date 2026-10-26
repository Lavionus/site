/* ============================================================
   krajky/vystup.js – kreslení modelu z krajky/jadro.js.
   Model se nejdřív převede na seznam primitiv a ta umí vykreslit
   plátno, SVG i PDF stejně:

     V.primitiva(model, {styl:'nahled'|'tisk'|'rez', barva, klin, nakres})
        → [{t:'plocha', cesty, vypln, cara?, w?}, {t:'cary', cesty, barva, w, otevrene?, carky?},
           {t:'tecky', body:[[x,y]], r, barva}, {t:'kruhy', kruhy:[{x,y,r}], barva, w}, {t:'orez', cesta}]
     V.canvas(ctx, prim, minW)     – ctx už má měřítko v mm
     V.svg(model, prim)            → text SVG v mm (1:1)
     V.dxf(model)                  → DXF R12, obrys a otvory (řez); model s `cesty`/`otevrene` (halloween/) taky
     V.pdf(jsPDF, model, prim, o)  → jsPDF, 1:1, velké výkresy na víc listů
   Dělení na listy bere ze stencil/vystup.js (STENCIL_VYSTUP.listy).
   ============================================================ */
(function (koren) {
  'use strict';
  const V = {};
  const SV = typeof module !== 'undefined' && module.exports ? require('../stencil/vystup.js') : koren.STENCIL_VYSTUP;
  const c = x => { const r = Math.round(x * 1000) / 1000; return Object.is(r, -0) ? '0' : String(r); };

  const BARVY_PODVINKU = {
    pudice: ['#000000', 0.2], kraj: ['#000000', 0.5], vejirKraj: ['#000000', 0.4],
    platno: ['#7b3fa0', 0.35], pulhod: ['#2e8b3a', 0.35], pavouk: ['#c0392b', 0.35],
  };
  V.BARVY_PODVINKU = BARVY_PODVINKU;

  V.primitiva = function (m, o) {
    o = o || {};
    const p = [];
    if (o.klin && o.klin.ok) p.push({ t: 'orez', cesta: o.klin.cesta });
    if (m.druh === 'podvinek') {
      const skup = {};
      for (const cr of m.cary) {
        if (!o.nakres && !(cr.druh === 'kraj' || cr.druh === 'vejirKraj')) continue;
        if (cr.kruh) { (skup['@' + cr.druh] = skup['@' + cr.druh] || []).push(cr.kruh); continue; }
        (skup[cr.druh] = skup[cr.druh] || []).push(cr.body);
      }
      for (const d of Object.keys(skup)) {
        const [barva, w] = BARVY_PODVINKU[d.replace(/^@/, '')] || ['#000', 0.3];
        if (d[0] === '@') p.push({ t: 'kruhy', kruhy: skup[d], barva, w });
        else p.push({ t: 'cary', cesty: skup[d], otevrene: true, barva: o.nakres ? barva : '#888888', w: o.nakres ? w : 0.25 });
      }
      p.push({ t: 'tecky', body: m.spendliky.map(s => [s.x, s.y]), r: 0.45, barva: '#000000' });
      return p;
    }
    const cesty = [m.obrys].concat(m.diry);
    if (o.styl === 'rez') p.push({ t: 'cary', cesty, barva: '#ff0000', w: 0.1 });
    else if (o.styl === 'tisk') p.push({ t: 'plocha', cesty, vypln: '#d2d2d2', cara: '#000000', w: 0.25 });
    else p.push({ t: 'plocha', cesty, vypln: o.barva || '#f4efe3' });
    if (o.klin && o.klin.ok) {
      p.push({ t: 'konec-orezu' });
      p.push({ t: 'cary', cesty: o.klin.ohyby, otevrene: true, barva: '#1f6fd1', w: 0.35, carky: [3, 2] });
      p.push({ t: 'cary', cesty: [o.klin.cesta], barva: '#1f6fd1', w: 0.2, carky: [1, 1.5] });
    }
    return p;
  };

  /* Posun primitiv tak, aby výkres začínal v rohu obdélníku [x0, y0, x1, y1]
     (výseč vystřihovánky se pak tiskne na menší plochu). → {model, prim} */
  V.vyrez = function (m, prim, x0, y0, x1, y1) {
    const pb = ([x, y]) => [x - x0, y - y0], pc = b => b.map(pb);
    const nove = prim.map(q => {
      const n = Object.assign({}, q);
      if (q.cesty) n.cesty = q.cesty.map(pc);
      if (q.cesta) n.cesta = pc(q.cesta);
      if (q.body) n.body = q.body.map(pb);
      if (q.kruhy) n.kruhy = q.kruhy.map(k => ({ x: k.x - x0, y: k.y - y0, r: k.r }));
      return n;
    });
    return { model: Object.assign({}, m, { sirka: x1 - x0, vyska: y1 - y0 }), prim: nove };
  };

  /* ---------- plátno ---------- */
  V.canvas = function (ctx, prim, minW) {
    minW = minW || 0;
    const cesta = (body, otevrena) => {
      if (body.length < 2) return;
      ctx.moveTo(body[0][0], body[0][1]);
      for (let i = 1; i < body.length; i++) ctx.lineTo(body[i][0], body[i][1]);
      if (!otevrena) ctx.closePath();
    };
    let orez = 0;
    for (const q of prim) {
      if (q.t === 'orez') { ctx.save(); orez++; ctx.beginPath(); cesta(q.cesta); ctx.clip(); continue; }
      if (q.t === 'konec-orezu') { if (orez) { ctx.restore(); orez--; } continue; }
      ctx.setLineDash(q.carky || []);
      if (q.t === 'plocha') {
        ctx.beginPath(); for (const b of q.cesty) cesta(b);
        ctx.fillStyle = q.vypln; ctx.fill('evenodd');
        if (q.cara) { ctx.strokeStyle = q.cara; ctx.lineWidth = Math.max(minW, q.w); ctx.stroke(); }
      } else if (q.t === 'cary') {
        ctx.beginPath(); for (const b of q.cesty) cesta(b, q.otevrene);
        ctx.strokeStyle = q.barva; ctx.lineWidth = Math.max(minW, q.w); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
      } else if (q.t === 'tecky') {
        ctx.beginPath(); const r = Math.max(minW * 1.2, q.r);
        for (const [x, y] of q.body) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }
        ctx.fillStyle = q.barva; ctx.fill();
      } else if (q.t === 'kruhy') {
        ctx.beginPath(); for (const k of q.kruhy) { ctx.moveTo(k.x + k.r, k.y); ctx.arc(k.x, k.y, k.r, 0, Math.PI * 2); }
        ctx.strokeStyle = q.barva; ctx.lineWidth = Math.max(minW, q.w); ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    while (orez--) ctx.restore();
  };

  /* ---------- SVG ---------- */
  const dCesty = (cesty, otevrene) => cesty.filter(b => b.length > 1).map(b => 'M' + b.map(([x, y]) => c(x) + ' ' + c(y)).join('L') + (otevrene ? '' : 'Z')).join('');
  V.svg = function (m, prim, popis) {
    let s = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${c(m.sirka)}mm" height="${c(m.vyska)}mm" viewBox="0 0 ${c(m.sirka)} ${c(m.vyska)}">\n`;
    s += `<!-- ${(popis || 'Krajka').replace(/--/g, '–')}, ${c(m.sirka)} × ${c(m.vyska)} mm, jednotky mm (1:1) -->\n`;
    let g = 0;
    for (const q of prim) {
      const carky = q.carky ? ` stroke-dasharray="${q.carky.join(' ')}"` : '';
      if (q.t === 'orez') { s += `<clipPath id="orez${g}"><path d="${dCesty([q.cesta])}"/></clipPath>\n<g clip-path="url(#orez${g})">\n`; g++; }
      else if (q.t === 'konec-orezu') { if (g) { s += '</g>\n'; g--; } }
      else if (q.t === 'plocha') s += `<path d="${dCesty(q.cesty)}" fill="${q.vypln}" fill-rule="evenodd"${q.cara ? ` stroke="${q.cara}" stroke-width="${q.w}"` : ''}/>\n`;
      else if (q.t === 'cary') s += `<path d="${dCesty(q.cesty, q.otevrene)}" fill="none" stroke="${q.barva}" stroke-width="${q.w}" stroke-linecap="round" stroke-linejoin="round"${carky}/>\n`;
      else if (q.t === 'tecky') s += `<g fill="${q.barva}">` + q.body.map(([x, y]) => `<circle cx="${c(x)}" cy="${c(y)}" r="${q.r}"/>`).join('') + '</g>\n';
      else if (q.t === 'kruhy') s += `<g fill="none" stroke="${q.barva}" stroke-width="${q.w}">` + q.kruhy.map(k => `<circle cx="${c(k.x)}" cy="${c(k.y)}" r="${c(k.r)}"/>`).join('') + '</g>\n';
    }
    while (g--) s += '</g>\n';
    return s + '</svg>\n';
  };

  /* ---------- DXF R12 (mm, osa y nahoru) ---------- */
  V.dxf = function (m) {
    const r = [], p = (k, v) => { r.push(String(k)); r.push(String(v)); };
    p(0, 'SECTION'); p(2, 'HEADER'); p(9, '$ACADVER'); p(1, 'AC1009'); p(9, '$INSUNITS'); p(70, 4);
    p(9, '$EXTMIN'); p(10, 0); p(20, 0); p(30, 0); p(9, '$EXTMAX'); p(10, c(m.sirka)); p(20, c(m.vyska)); p(30, 0); p(0, 'ENDSEC');
    p(0, 'SECTION'); p(2, 'TABLES'); p(0, 'TABLE'); p(2, 'LAYER'); p(70, 2);
    for (const [j, b] of [['OBRYS', 7], ['OTVORY', 1]]) { p(0, 'LAYER'); p(2, j); p(70, 0); p(62, b); p(6, 'CONTINUOUS'); }
    p(0, 'ENDTAB'); p(0, 'ENDSEC'); p(0, 'SECTION'); p(2, 'ENTITIES');
    const poly = (body, vrstva, otevrena) => {
      p(0, 'POLYLINE'); p(8, vrstva); p(66, 1); p(10, 0); p(20, 0); p(30, 0); p(70, otevrena ? 0 : 1);
      for (const [x, y] of body) { p(0, 'VERTEX'); p(8, vrstva); p(10, c(x)); p(20, c(m.vyska - y)); p(30, 0); }
      p(0, 'SEQEND'); p(8, vrstva);
    };
    if (m.cesty) for (const d of m.cesty) poly(d, 'OBRYS');   // obecný model (halloween/): jen seznam obrysů
    else { poly(m.obrys, 'OBRYS'); for (const d of m.diry) poly(d, 'OTVORY'); }
    for (const d of (m.otevrene || [])) poly(d, 'OBRYS', true);
    p(0, 'ENDSEC'); p(0, 'EOF');
    return r.join('\n') + '\n';
  };

  /* ---------- PDF 1:1 ---------- */
  const bezDiakritiky = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[×]/g, 'x').replace(/[–—]/g, '-').replace(/[„“”]/g, '"').replace(/[·]/g, '-').replace(/[…]/g, '...').replace(/[^\x20-\x7e]/g, '');
  V.pdf = function (jsPDF, m, prim, o) {
    o = o || {};
    const papir = o.papir || { w: 210, h: 297 };
    const L = SV.listy(m.sirka, m.vyska, papir, { okraj: o.okraj == null ? 10 : o.okraj, preklad: o.preklad == null ? 10 : o.preklad });
    const PW = L.papir.w, PH = L.papir.h, orient = PW > PH ? 'landscape' : 'portrait';
    const doc = new jsPDF({ unit: 'mm', format: [PW, PH], orientation: orient, compress: true });
    let unicode = false;
    if (o.pismo) {
      try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); unicode = true; }
      catch (e) { doc.setFont('helvetica', 'normal'); }
    } else doc.setFont('helvetica', 'normal');
    const text = (s, x, y, vel, zar) => { doc.setFontSize(vel || 9); doc.text(unicode ? String(s) : bezDiakritiky(s), x, y, zar ? { align: zar } : undefined); };
    const rgb = h => SV.hexRgb(h);

    /* úvodní list */
    text(o.nazev || 'Krajka', 15, 20, 16);
    let y = 30;
    for (const r of (o.radky || [])) { text(r, 15, y, 10); y += 6; }
    text(`Výkres ${c(m.sirka)} × ${c(m.vyska)} mm, měřítko 1:1 · papír ${c(papir.w)} × ${c(papir.h)} mm · listů: ${L.listy.length} (${L.sloupcu} × ${L.radku})`, 15, y, 10); y += 6;
    if (L.listy.length > 1) { text(`Sousední listy se překrývají o ${c(L.preklad)} mm – slepte je podle křížků.`, 15, y, 9); y += 6; }
    for (const r of (o.postup || [])) { text(r, 15, y, 9); y += 5; }
    const ky = Math.min(PH - 65, y + 6);
    doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(15, ky, 50, 50);
    doc.line(37, ky + 25, 43, ky + 25); doc.line(40, ky + 22, 40, ky + 28);
    text('Kontrolní čtverec 50 × 50 mm', 70, ky + 24, 9);
    text('tiskněte bez přizpůsobení (100 %) a změřte', 70, ky + 29, 8);

    const cesta = (body, ox, oy, otevrena) => {
      doc.moveTo(body[0][0] + ox, body[0][1] + oy);
      for (let i = 1; i < body.length; i++) doc.lineTo(body[i][0] + ox, body[i][1] + oy);
      if (!otevrena) doc.close();
    };
    for (const l of L.listy) {
      doc.addPage([PW, PH], orient);
      const ox = L.okraj - l.x, oy = L.okraj - l.y;
      doc.saveGraphicsState();
      doc.rect(L.okraj, L.okraj, l.w, l.h, null); doc.clip(); doc.discardPath();
      let orez = 0;
      for (const q of prim) {
        if (q.t === 'orez') { doc.saveGraphicsState(); orez++; cesta(q.cesta, ox, oy); doc.clip(); doc.discardPath(); continue; }
        if (q.t === 'konec-orezu') { if (orez) { doc.restoreGraphicsState(); orez--; } continue; }
        doc.setLineDashPattern(q.carky || [], 0);
        if (q.t === 'plocha') {
          const f = rgb(q.vypln); doc.setFillColor(f[0], f[1], f[2]);
          for (const b of q.cesty) cesta(b, ox, oy);
          if (q.cara) { const s = rgb(q.cara); doc.setDrawColor(s[0], s[1], s[2]); doc.setLineWidth(q.w); doc.fillStrokeEvenOdd(); }
          else doc.fillEvenOdd();
        } else if (q.t === 'cary') {
          const s = rgb(q.barva); doc.setDrawColor(s[0], s[1], s[2]); doc.setLineWidth(q.w);
          for (const b of q.cesty) cesta(b, ox, oy, q.otevrene);
          doc.stroke();
        } else if (q.t === 'tecky') {
          const f = rgb(q.barva); doc.setFillColor(f[0], f[1], f[2]);
          for (const [x, yy] of q.body) if (x + ox > 0 && x + ox < PW && yy + oy > 0 && yy + oy < PH) doc.circle(x + ox, yy + oy, q.r, 'F');
        } else if (q.t === 'kruhy') {
          const s = rgb(q.barva); doc.setDrawColor(s[0], s[1], s[2]); doc.setLineWidth(q.w);
          for (const k of q.kruhy) doc.circle(k.x + ox, k.y + oy, k.r, 'S');
        }
      }
      while (orez--) doc.restoreGraphicsState();
      // křížky v pásmu překryvu (na obou sousedních listech stejně)
      doc.setLineDashPattern([], 0); doc.setDrawColor(0); doc.setLineWidth(0.2);
      const kriz = (x, yy) => { doc.line(x - 3, yy, x + 3, yy); doc.line(x, yy - 3, x, yy + 3); };
      for (let a = 1; a < L.sloupcu; a++) for (let b = 0; b < L.radku; b++) for (const fy of [0.25, 0.75]) kriz(a * L.krok.w + L.preklad / 2 + ox, (b + fy) * L.krok.h + oy);
      for (let b = 1; b < L.radku; b++) for (let a = 0; a < L.sloupcu; a++) for (const fx of [0.25, 0.75]) kriz((a + fx) * L.krok.w + ox, b * L.krok.h + L.preklad / 2 + oy);
      doc.restoreGraphicsState();
      doc.setTextColor(80);
      text(`${o.nazev || 'Krajka'} · list ${l.oznaceni} (${l.i + 1}/${L.sloupcu}, ${l.j + 1}/${L.radku}) · 1:1`, L.okraj, Math.max(4, L.okraj - 3), 7);
      doc.setTextColor(0);
    }
    return doc;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = V;
  else koren.KRAJKY_VYSTUP = V;
})(typeof window !== 'undefined' ? window : globalThis);

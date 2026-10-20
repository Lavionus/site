/* ============================================================
   stencil/vystup.js – výstupy šablony: SVG, DXF, PDF 1:1 s dělením
   na listy. Bez DOM; jsPDF se předává parametrem (běží i v node).

     V.data(vysledek, {sirkaMm, vyskaMm, registrace, nazvy, barvy})
        → {sirka, vyska, okraj, vrstvy:[{obrysy (mm), nazev, barva}], znacky}
     V.svg(data, {vrstvy:[i…], styl:'vypln'|'linky', mezera})
     V.dxf(data, {vrstvy:[i…], mezera})
     V.listy(sirka, vyska, papir{w,h}, {okraj, preklad, orientace})
     V.pdf(jsPDF, data, {papir, okraj, preklad, vrstvy, nazev, pismo})
   ============================================================ */
(function (koren) {
  'use strict';
  const V = {};
  const c = x => { const r = Math.round(x * 1000) / 1000; return Object.is(r, -0) ? '0' : String(r); };
  V.c = c;

  // kruh jako mnohoúhelník (pro výřezy registračních značek)
  function kruhPoly(cx, cy, r, n) {
    const o = []; n = n || 36;
    for (let i = 0; i < n; i++) { const a = -2 * Math.PI * i / n; o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return o;
  }
  V.kruhPoly = kruhPoly;

  V.data = function (r, o) {
    o = o || {};
    const kx = o.sirkaMm / r.w, ky = o.vyskaMm / r.h;
    const sirka = r.W * kx, vyska = r.H * ky, okraj = r.pad * (kx + ky) / 2;
    const znacky = [];
    if (o.registrace && okraj >= 4) {
      const rr = Math.min(2.5, okraj / 4), s = okraj / 2;
      for (const [x, y] of [[s, s], [sirka - s, s], [sirka - s, vyska - s], [s, vyska - s]]) znacky.push({ x, y, r: rr });
    }
    const vrstvy = r.vrstvy.map((v, i) => ({
      nazev: (o.nazvy && o.nazvy[i]) || 'Vrstva ' + (i + 1),
      barva: (o.barvy && o.barvy[i]) || '#000000',
      obrysy: v.obrysy.map(p => p.map(([x, y]) => [x * kx, y * ky])),
      nepodlozene: v.nepodlozene.length,
    }));
    return { sirka, vyska, okraj, vrstvy, znacky, kx, ky };
  };

  // všechny obrysy jedné vrstvy včetně značek (pro řezání)
  function obrysyVrstvy(d, i) {
    const a = d.vrstvy[i].obrysy.slice();
    for (const z of d.znacky) a.push(kruhPoly(z.x, z.y, z.r));
    return a;
  }
  V.obrysyVrstvy = obrysyVrstvy;

  function cestaSvg(polys, dx) {
    let s = '';
    for (const p of polys) {
      if (p.length < 3) continue;
      s += 'M' + c(p[0][0] + dx) + ' ' + c(p[0][1]);
      for (let i = 1; i < p.length; i++) s += 'L' + c(p[i][0] + dx) + ' ' + c(p[i][1]);
      s += 'Z';
    }
    return s;
  }

  V.svg = function (d, o) {
    o = o || {};
    const vr = o.vrstvy || d.vrstvy.map((_, i) => i), mezera = o.mezera == null ? 10 : o.mezera;
    const sir = vr.length * d.sirka + (vr.length - 1) * mezera;
    let s = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    s += `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${c(sir)}mm" height="${c(d.vyska)}mm" viewBox="0 0 ${c(sir)} ${c(d.vyska)}">\n`;
    s += `<!-- Šablona na sprej: ${vr.length} vrstv${vr.length === 1 ? 'a' : vr.length < 5 ? 'y' : 'ev'}, list ${c(d.sirka)} × ${c(d.vyska)} mm, jednotky mm (1:1) -->\n`;
    vr.forEach((i, k) => {
      const dx = k * (d.sirka + mezera), v = d.vrstvy[i];
      const ram = `M${c(dx)} 0H${c(dx + d.sirka)}V${c(d.vyska)}H${c(dx)}Z`;
      const vnitr = cestaSvg(obrysyVrstvy(d, i), dx);
      s += `<g id="vrstva-${i + 1}" inkscape:groupmode="layer" inkscape:label="${v.nazev.replace(/[<&"]/g, '')}">\n`;
      if (o.styl === 'linky') {
        s += `<path d="${ram}" fill="none" stroke="#ff0000" stroke-width="0.1"/>\n`;
        s += `<path d="${vnitr}" fill="none" stroke="#ff0000" stroke-width="0.1"/>\n`;
      } else {
        s += `<path d="${ram}${vnitr}" fill="${o.barva || '#000000'}" fill-rule="evenodd"/>\n`;
      }
      s += '</g>\n';
    });
    return s + '</svg>\n';
  };

  // DXF R12 (ASCII), mm, osa y nahoru; každá vrstva šablony = vrstva DXF
  V.dxf = function (d, o) {
    o = o || {};
    const vr = o.vrstvy || d.vrstvy.map((_, i) => i), mezera = o.mezera == null ? 10 : o.mezera;
    const r = [];
    const p = (k, v) => { r.push(String(k)); r.push(String(v)); };
    const sir = vr.length * d.sirka + (vr.length - 1) * mezera;
    p(0, 'SECTION'); p(2, 'HEADER');
    p(9, '$ACADVER'); p(1, 'AC1009');
    p(9, '$INSUNITS'); p(70, 4);
    p(9, '$EXTMIN'); p(10, 0); p(20, 0); p(30, 0);
    p(9, '$EXTMAX'); p(10, c(sir)); p(20, c(d.vyska)); p(30, 0);
    p(0, 'ENDSEC');
    p(0, 'SECTION'); p(2, 'TABLES');
    p(0, 'TABLE'); p(2, 'LAYER'); p(70, vr.length);
    vr.forEach(i => { p(0, 'LAYER'); p(2, 'SABLONA_' + (i + 1)); p(70, 0); p(62, 1 + (i % 6)); p(6, 'CONTINUOUS'); });
    p(0, 'ENDTAB'); p(0, 'ENDSEC');
    p(0, 'SECTION'); p(2, 'ENTITIES');
    const poly = (body, vrstva) => {
      p(0, 'POLYLINE'); p(8, vrstva); p(66, 1); p(10, 0); p(20, 0); p(30, 0); p(70, 1);
      for (const [x, y] of body) { p(0, 'VERTEX'); p(8, vrstva); p(10, c(x)); p(20, c(d.vyska - y)); p(30, 0); }
      p(0, 'SEQEND'); p(8, vrstva);
    };
    vr.forEach((i, k) => {
      const dx = k * (d.sirka + mezera), jm = 'SABLONA_' + (i + 1);
      poly([[dx, 0], [dx + d.sirka, 0], [dx + d.sirka, d.vyska], [dx, d.vyska]], jm);
      for (const b of obrysyVrstvy(d, i)) poly(b.map(([x, y]) => [x + dx, y]), jm);
    });
    p(0, 'ENDSEC'); p(0, 'EOF');
    return r.join('\n') + '\n';
  };

  /* Dělení na listy. Tisknutelné pole = papír − 2·okraj; sousední listy se
     překrývají o `preklad` mm (pásmo lepení). Orientace 'auto' vybere tu
     s menším počtem listů. */
  V.listy = function (sirka, vyska, papir, o) {
    o = o || {};
    const okraj = o.okraj == null ? 8 : o.okraj, preklad = o.preklad == null ? 10 : o.preklad;
    const zkus = (pw, ph) => {
      const pole = { w: pw - 2 * okraj, h: ph - 2 * okraj };
      const krok = { w: Math.max(1, pole.w - preklad), h: Math.max(1, pole.h - preklad) };
      const sloupcu = sirka <= pole.w + 1e-9 ? 1 : Math.ceil((sirka - preklad) / krok.w - 1e-9);
      const radku = vyska <= pole.h + 1e-9 ? 1 : Math.ceil((vyska - preklad) / krok.h - 1e-9);
      const listy = [];
      for (let j = 0; j < radku; j++) for (let i = 0; i < sloupcu; i++) {
        const x = i * krok.w, y = j * krok.h;
        listy.push({ i, j, x, y, w: Math.min(pole.w, sirka - x), h: Math.min(pole.h, vyska - y),
          oznaceni: String.fromCharCode(65 + (j % 26)) + (i + 1) });
      }
      return { papir: { w: pw, h: ph }, pole, krok, sloupcu, radku, listy, okraj, preklad };
    };
    const na = zkus(papir.w, papir.h), ps = zkus(papir.h, papir.w);
    if (o.orientace === 'na_vysku') return na;
    if (o.orientace === 'na_sirku') return ps;
    return ps.listy.length < na.listy.length ? ps : na;
  };

  /* ---------- PDF ---------- */
  const bezDiakritiky = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[×]/g, 'x').replace(/[–—]/g, '-').replace(/[„“”]/g, '"').replace(/[·]/g, '-').replace(/[…]/g, '...');

  V.pdf = function (jsPDF, d, o) {
    o = o || {};
    const papir = o.papir || { w: 210, h: 297 };
    const L = V.listy(d.sirka, d.vyska, papir, { okraj: o.okraj, preklad: o.preklad, orientace: o.orientace });
    const vr = o.vrstvy || d.vrstvy.map((_, i) => i);
    const PW = L.papir.w, PH = L.papir.h;
    const doc = new jsPDF({ unit: 'mm', format: [PW, PH], orientation: PW > PH ? 'landscape' : 'portrait', compress: true });
    let unicode = false;
    if (o.pismo) {
      try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); unicode = true; }
      catch (e) { doc.setFont('helvetica', 'normal'); }
    } else doc.setFont('helvetica', 'normal');
    const T = s => unicode ? String(s) : bezDiakritiky(s);
    const text = (s, x, y, vel, zarovnani) => { doc.setFontSize(vel || 9); doc.text(T(s), x, y, zarovnani ? { align: zarovnani } : undefined); };
    const kriz = (x, y, r) => { doc.line(x - r, y, x + r, y); doc.line(x, y - r, x, y + r); };

    /* úvodní list: přehled, mapa listů, kontrolní čtverec 50 mm */
    text(o.nazev || 'Šablona na sprej', 15, 20, 16);
    text(`Velikost šablony: ${c(d.sirka)} × ${c(d.vyska)} mm (rám ${c(d.okraj)} mm), měřítko 1:1`, 15, 30, 10);
    text(`Papír ${c(papir.w)} × ${c(papir.h)} mm, okraj tisku ${c(L.okraj)} mm, překryv listů ${c(L.preklad)} mm`, 15, 36, 10);
    text(`Vrstev: ${vr.length} · listů na vrstvu: ${L.listy.length} (${L.sloupcu} × ${L.radku}) · celkem stran: ${1 + vr.length * L.listy.length}`, 15, 42, 10);
    let y = 50;
    vr.forEach((i, k) => {
      const v = d.vrstvy[i];
      const rgb = hexRgb(v.barva);
      doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.setDrawColor(0); doc.setLineWidth(0.2);
      doc.rect(15, y - 3.5, 5, 5, 'FD');
      text(`${k + 1}. nástřik: ${v.nazev}${v.nepodlozene ? ` – POZOR: ${v.nepodlozene} nepodložených ostrůvků!` : ''}`, 23, y, 10);
      y += 7;
    });
    y += 3;
    text('Postup: vytiskněte bez přizpůsobení velikosti (100 %), ověřte čtverec 50 mm, listy slepte podle', 15, y, 9);
    text('křížků v pásmu překryvu, šedý materiál ponechte a bílé plochy vyřízněte podél černé čáry.', 15, y + 5, 9);
    y += 14;
    // mapa listů
    const mapaW = Math.min(PW - 30, 120), mer = Math.min(mapaW / d.sirka, (PH - y - 85) / d.vyska);
    if (mer > 0) {
      doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(15, y, d.sirka * mer, d.vyska * mer);
      doc.setLineWidth(0.15);
      for (const l of L.listy) {
        doc.setDrawColor(90); doc.rect(15 + l.x * mer, y + l.y * mer, l.w * mer, l.h * mer);
        text(l.oznaceni, 15 + (l.x + l.w / 2) * mer, y + (l.y + l.h / 2) * mer + 1.5, Math.max(5, Math.min(10, l.w * mer / 3)), 'center');
      }
      y += d.vyska * mer + 8;
    }
    // kontrolní čtverec 50 mm
    const ky = Math.min(PH - 15 - 50, Math.max(y, 0));
    doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(15, ky, 50, 50);
    kriz(40, ky + 25, 3);
    text('Kontrolní čtverec 50 × 50 mm', 70, ky + 24, 9);
    text('změřte pravítkem – musí mít přesně 50 mm', 70, ky + 29, 8);

    /* listy šablony */
    vr.forEach((i, k) => {
      const v = d.vrstvy[i], polys = obrysyVrstvy(d, i);
      for (const l of L.listy) {
        doc.addPage([PW, PH], PW > PH ? 'landscape' : 'portrait');
        const ox = L.okraj - l.x, oy = L.okraj - l.y;   // posun ze souřadnic šablony na stránku
        doc.saveGraphicsState();
        doc.rect(L.okraj, L.okraj, l.w, l.h, null); doc.clip(); doc.discardPath();
        // materiál šedě, výřezy bílé (evenodd), řezné čáry černě
        doc.setFillColor(205, 205, 205); doc.setDrawColor(0); doc.setLineWidth(0.25);
        doc.moveTo(ox, oy); doc.lineTo(ox + d.sirka, oy); doc.lineTo(ox + d.sirka, oy + d.vyska); doc.lineTo(ox, oy + d.vyska); doc.close();
        for (const p of polys) {
          if (p.length < 3) continue;
          doc.moveTo(p[0][0] + ox, p[0][1] + oy);
          for (let q = 1; q < p.length; q++) doc.lineTo(p[q][0] + ox, p[q][1] + oy);
          doc.close();
        }
        doc.fillStrokeEvenOdd();
        // registrační kříže přes značky (tisk, ne řez)
        doc.setLineWidth(0.15);
        for (const z of d.znacky) kriz(z.x + ox, z.y + oy, z.r * 1.8);
        // křížky v pásmech překryvu – na obou sousedních listech na stejném místě
        doc.setDrawColor(0); doc.setLineWidth(0.2);
        for (let a = 1; a < L.sloupcu; a++) {
          const sx = a * L.krok.w + L.preklad / 2;
          for (let b = 0; b <= L.radku; b++) for (const fy of [0.25, 0.75]) {
            const sy = (b + fy) * L.krok.h;
            if (sy < d.vyska) kriz(sx + ox, sy + oy, 3);
          }
        }
        for (let b = 1; b < L.radku; b++) {
          const sy = b * L.krok.h + L.preklad / 2;
          for (let a = 0; a <= L.sloupcu; a++) for (const fx of [0.25, 0.75]) {
            const sx = (a + fx) * L.krok.w;
            if (sx < d.sirka) kriz(sx + ox, sy + oy, 3);
          }
        }
        doc.restoreGraphicsState();
        // pásmo překryvu: čárkovaná hrana, kam přijde sousední list
        doc.setLineDashPattern([2, 1.5], 0); doc.setDrawColor(120); doc.setLineWidth(0.2);
        if (l.i < L.sloupcu - 1) { const xx = L.okraj + l.w - L.preklad; doc.line(xx, L.okraj, xx, L.okraj + l.h); }
        if (l.j < L.radku - 1) { const yy = L.okraj + l.h - L.preklad; doc.line(L.okraj, yy, L.okraj + l.w, yy); }
        doc.setLineDashPattern([], 0);
        // ořezové rohy výřezu listu
        doc.setDrawColor(0); doc.setLineWidth(0.2);
        for (const [x, y2, sx, sy] of [[L.okraj, L.okraj, -1, -1], [L.okraj + l.w, L.okraj, 1, -1], [L.okraj + l.w, L.okraj + l.h, 1, 1], [L.okraj, L.okraj + l.h, -1, 1]]) {
          doc.line(x + sx * 1, y2, x + sx * 5, y2); doc.line(x, y2 + sy * 1, x, y2 + sy * 5);
        }
        doc.setTextColor(60);
        text(`${o.nazev || 'Šablona'} · ${v.nazev} (${k + 1}/${vr.length}) · list ${l.oznaceni} (sloupec ${l.i + 1}/${L.sloupcu}, řádek ${l.j + 1}/${L.radku}) · 1:1`, L.okraj, Math.max(4, L.okraj - 2.5), 7);
        if (L.listy.length > 1) text('čárkovaně = sem přijde sousední list (lepit)', PW - L.okraj, PH - Math.max(2, L.okraj - 4), 6, 'right');
        doc.setTextColor(0);
      }
    });
    return doc;
  };

  function hexRgb(h) {
    const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
    if (!m) return [0, 0, 0];
    const v = parseInt(m[1], 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  V.hexRgb = hexRgb;

  if (typeof module !== 'undefined' && module.exports) module.exports = V;
  else koren.STENCIL_VYSTUP = V;
})(typeof window !== 'undefined' ? window : globalThis);

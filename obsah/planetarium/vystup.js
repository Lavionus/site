/* ============================================================
   Planetárium – 2D výstupy pro laser/CNC a tisk 1:1 (bez DOM; jsPDF se předává)
   - plochyDilu(mech): seznam 2D dílů (kola s evolventním obrysem, deska ramene, kotouč uzlů)
   - svg(mech, o) / dxf(mech, o): všechny díly rozložené na desce dané šířky
   - pdf(mech, jsPDF, o): kusovník, šablony 1:1 (kola + rameno), kontrolní čtverec, montážní návod
   ============================================================ */
(function (koren) {
  'use strict';
  const TAU = 2 * Math.PI;
  const P = koren.PLAN || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const EK = koren.EvolKola || (typeof require !== 'undefined' ? require('../evolventni_kola/jadro.js') : null);
  const SIT = koren.PLANSit || (typeof require !== 'undefined' ? require('./site.js') : null);
  const fmt = P.fmt;
  const cf = (v) => { const s = (Math.abs(v) < 5e-10 ? 0 : v).toFixed(4); return s.replace(/\.?0+$/, '') || '0'; };

  /** 2D díly: {id, nazev, popis, w, h, cx, cy (střed obrysu v místních souř.), kolo?: g (EvolKola), obrys?: [[x,y]], otvory: [{x,y,r}], znacky: [{x,y}]} */
  function plochyDilu(mech, jenKola) {
    const p = mech.p, out = [];
    const pridejKolo = (poz, z, otvor, popis, m) => {
      const g = SIT.geometrieKola(mech, { z, otvor, m }, false);
      out.push({ id: poz, nazev: poz + ' z' + z, popis, w: 2 * g.ra, h: 2 * g.ra, cx: 0, cy: 0, kolo: g, otvory: otvor > 0 ? [{ x: 0, y: 0, r: g.rOtvor }] : [], r: g.ra });
    };
    for (const k of mech.kusovnik) {
      if (k.druh === 'kolo') pridejKolo(k.poz, k.z, k.otvor, `m${fmt(k.m || p.m, 2)} · Ø${fmt(k.d, 1)} · otvor ${fmt(k.otvor, 2)}`, k.m);
      else if (k.druh === 'řemenice') {
        const R = k.d / 2 + 1.5;
        out.push({ id: k.poz, nazev: k.poz + ' řemenice', popis: `Ø${fmt(k.d, 1)} drážka · otvor ${fmt(k.otvor, 2)}`, w: 2 * R, h: 2 * R, cx: 0, cy: 0, kruh: R, otvory: [{ x: 0, y: 0, r: k.otvor / 2 }], r: R });
      }
    }
    if (jenKola) return out;
    const R = mech.rameno;
    out.push({ id: 'R', nazev: 'Rameno', popis: `${fmt(R.delka, 0)} × ${fmt(R.sirka, 0)} × ${fmt(R.tl, 1)} mm`, w: R.delka, h: R.sirka, cx: (R.x0 + R.x1) / 2, cy: (R.y0 + R.y1) / 2,
      obrys: R.obrys, otvory: R.otvory.map((o) => ({ x: o.x, y: o.y, r: o.otvor, id: o.id })), rameno: true, r: Math.hypot(R.delka, R.sirka) / 2 });
    if (mech.mustek) out.push(Object.assign({}, out[out.length - 1], { id: 'M', nazev: 'Horní můstek', popis: 'stejný obrys a otvory jako rameno' }));
    if (p.mesic && p.naklon) {
      const k = SIT.kotoucUzlu(mech);
      out.push({ id: 'U', nazev: 'Kotouč uzlů (půdorys)', popis: `Ø${fmt(2 * k.r2, 0)} · šikmá horní plocha ${fmt(p.sklonMesice, 2)}° – frézovat/tisknout`, w: 2 * k.r2, h: 2 * k.r2, cx: 0, cy: 0, kruh: k.r2, otvory: [{ x: 0, y: 0, r: k.r1 }], r: k.r2 });
    }
    return out;
  }

  /** Řádkové rozložení dílů na pás šířky W (mm). Vrací [{d, x, y}] (x,y = levý horní roh rámečku), celková výška. */
  function rozlozDily(dily, W, mezera, popisek) {
    const g = mezera == null ? 4 : mezera, ph = popisek ? 7 : 0;
    const ser = dily.slice().sort((a, b) => b.h - a.h || b.w - a.w);
    const out = []; let x = 0, y = 0, radek = 0, maxW = 0;
    for (const d of ser) {
      if (x > 0 && x + d.w > W) { x = 0; y += radek + g + ph; radek = 0; }
      out.push({ d, x, y }); x += d.w + g; radek = Math.max(radek, d.h); maxW = Math.max(maxW, x - g);
    }
    return { pozice: out, W: maxW, H: y + radek + ph };
  }

  /** Polyline obrysu kola (body) v místních souřadnicích. */
  function bodyKola(g, tol) { return EK.rozvin(g.obrys, tol || 0.02); }

  /* ---------- SVG ---------- */
  function svg(mech, o) {
    o = o || {};
    const W = o.sirka || 300, roz = rozlozDily(plochyDilu(mech), W, 5, o.popisky !== false), okraj = 3;
    const H = roz.H + 2 * okraj, Wc = Math.max(roz.W, 10) + 2 * okraj;
    let s = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${cf(Wc)}mm" height="${cf(H)}mm" viewBox="0 0 ${cf(Wc)} ${cf(H)}">\n`;
    s += `<!-- Planetárium Slunce–Země–Měsíc: profily pro laser/CNC, 1 jednotka = 1 mm. Červeně řez (obrysy, otvory), modře gravírování (popisky, středy). Modul ${fmt(mech.p.m, 2)} mm, tlakový úhel 20°. -->\n`;
    s += '<g id="rez" fill="none" stroke="#ff0000" stroke-width="0.1">\n';
    let gr = '<g id="gravir" fill="none" stroke="#0000ff" stroke-width="0.15">\n', txt = '<g id="popisky" fill="#0000ff" font-family="sans-serif">\n';
    for (const { d, x, y } of roz.pozice) {
      const X = (u) => okraj + x + d.w / 2 + (u - d.cx), Y = (v) => okraj + y + d.h / 2 - (v - d.cy);
      let cesta = '';
      if (d.kolo) {
        const V = EK.transformujObrys(d.kolo.obrys, 0, 0, 0).map((v) => ({ x: X(v.x), y: -Y(v.y), b: v.b }));
        cesta = EK.svgCesta(V, -1);
      } else if (d.obrys) cesta = 'M' + d.obrys.map((q) => cf(X(q[0])) + ' ' + cf(Y(q[1]))).join('L') + 'Z';
      else if (d.kruh) cesta = EK.kruhCesta(X(0), -Y(0), d.kruh, -1);
      for (const h of d.otvory) cesta += EK.kruhCesta(X(h.x), -Y(h.y), h.r, -1);
      s += `<path id="${d.id}" d="${cesta}" fill-rule="evenodd"/>\n`;
      for (const h of d.otvory) { const r = Math.min(2.5, h.r * 0.6); gr += `<path d="M${cf(X(h.x) - r)} ${cf(Y(h.y))}h${cf(2 * r)}M${cf(X(h.x))} ${cf(Y(h.y) - r)}v${cf(2 * r)}"/>\n`; }
      if (o.popisky !== false) txt += `<text x="${cf(okraj + x + d.w / 2)}" y="${cf(okraj + y + d.h + 4.5)}" font-size="3.2" text-anchor="middle">${esc(d.nazev)}</text>\n`;
    }
    return s + '</g>\n' + gr + '</g>\n' + txt + '</g>\n</svg>\n';
  }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ---------- DXF R12 ---------- */
  function dxf(mech, o) {
    o = o || {};
    const W = o.sirka || 300, roz = rozlozDily(plochyDilu(mech), W, 5, true);
    const L = [], pis = (k, v) => { L.push(String(k)); L.push(String(v)); };
    pis(0, 'SECTION'); pis(2, 'HEADER'); pis(9, '$ACADVER'); pis(1, 'AC1009'); pis(9, '$INSUNITS'); pis(70, 4); pis(0, 'ENDSEC');
    pis(0, 'SECTION'); pis(2, 'TABLES'); pis(0, 'TABLE'); pis(2, 'LAYER'); pis(70, 3);
    for (const [n, b] of [['REZ', 1], ['GRAVIR', 5], ['POPIS', 3]]) { pis(0, 'LAYER'); pis(2, n); pis(70, 0); pis(62, b); pis(6, 'CONTINUOUS'); }
    pis(0, 'ENDTAB'); pis(0, 'ENDSEC'); pis(0, 'SECTION'); pis(2, 'ENTITIES');
    const H = roz.H;
    for (const { d, x, y } of roz.pozice) {
      // DXF má y nahoru: střed dílu v (x + w/2, H − y − h/2)
      const ox = x + d.w / 2 - d.cx, oy = H - y - d.h / 2 - d.cy;
      if (d.kolo) {
        pis(0, 'POLYLINE'); pis(8, 'REZ'); pis(66, 1); pis(10, 0); pis(20, 0); pis(30, 0); pis(70, 1);
        for (const v of d.kolo.obrys) { pis(0, 'VERTEX'); pis(8, 'REZ'); pis(10, cf(v.x + ox + d.cx)); pis(20, cf(v.y + oy + d.cy)); pis(30, 0); if (v.b) pis(42, cf(v.b)); }
        pis(0, 'SEQEND'); pis(8, 'REZ');
      } else if (d.obrys) {
        pis(0, 'POLYLINE'); pis(8, 'REZ'); pis(66, 1); pis(10, 0); pis(20, 0); pis(30, 0); pis(70, 1);
        for (const q of d.obrys) { pis(0, 'VERTEX'); pis(8, 'REZ'); pis(10, cf(q[0] + ox)); pis(20, cf(q[1] + oy)); pis(30, 0); }
        pis(0, 'SEQEND'); pis(8, 'REZ');
      } else if (d.kruh) { pis(0, 'CIRCLE'); pis(8, 'REZ'); pis(10, cf(ox + d.cx)); pis(20, cf(oy + d.cy)); pis(30, 0); pis(40, cf(d.kruh)); }
      for (const h of d.otvory) { pis(0, 'CIRCLE'); pis(8, 'REZ'); pis(10, cf(h.x + ox)); pis(20, cf(h.y + oy)); pis(30, 0); pis(40, cf(h.r)); }
      pis(0, 'TEXT'); pis(8, 'POPIS'); pis(10, cf(x + d.w / 2 - d.nazev.length * 0.9)); pis(20, cf(H - y - d.h - 4.5)); pis(30, 0); pis(40, 3); pis(1, bezDiakritiky(d.nazev));
    }
    pis(0, 'ENDSEC'); pis(0, 'EOF');
    return L.join('\n') + '\n';
  }
  function bezDiakritiky(t) { return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '?'); }

  /* ---------- PDF ---------- */
  const PAPIRY = { a4: [210, 297], a3: [297, 420], letter: [215.9, 279.4] };
  /**
   * o: {papir: 'a4'|'a3'|'letter'|'vlastni', papirW, papirH, okraj, pismo (base64 TTF), navod: [řádky], datum}
   */
  function pdf(mech, jsPDF, o) {
    o = o || {};
    const [pw, ph] = o.papir === 'vlastni' ? [+o.papirW || 210, +o.papirH || 297] : (PAPIRY[o.papir] || PAPIRY.a4);
    const ok = Math.max(5, +o.okraj || 10), uw = pw - 2 * ok, uh = ph - 2 * ok;
    const doc = new jsPDF({ unit: 'mm', format: [pw, ph], orientation: pw > ph ? 'l' : 'p', compress: true });
    let uni = false;
    if (o.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { uni = false; } }
    if (!uni) doc.setFont('helvetica', 'normal');
    doc.setProperties({ title: 'Planetárium Slunce–Země–Měsíc', creator: 'Planetárium – návrh mechanismu' });
    const T = (t) => (uni ? String(t).replace(/[⌀∅]/g, 'Ø').replace(/[−]/g, '-') : bezDiakritiky(String(t).replace(/[⌀∅]/g, 'O')));
    const text = (t, x, y, h, zarovnani, barva) => {
      doc.setFontSize(h / 0.3528); doc.setTextColor(...(barva || [0, 0, 0]));
      const s = T(t), w = doc.getTextWidth(s);
      doc.text(s, zarovnani === 'c' ? x - w / 2 : zarovnani === 'r' ? x - w : x, y);
    };
    const meritko = (x, y) => {
      doc.setDrawColor(0); doc.setLineWidth(0.25); doc.line(x, y, x + 50, y);
      for (let i = 0; i <= 5; i++) doc.line(x + i * 10, y - (i % 5 ? 1 : 2), x + i * 10, y);
      text('50 mm – kontrola měřítka', x + 52, y - 0.5, 2.4);
    };
    const ctverec = (x, y) => { doc.setDrawColor(0); doc.setLineWidth(0.25); doc.rect(x, y, 50, 50, 'S'); text('50 × 50 mm', x + 25, y + 26, 4, 'c'); text('po tisku změřte – musí mít přesně 50 mm', x + 25, y + 31, 2.4, 'c'); };
    const pata = (t) => { text(t + ' · tiskněte 1:1 (bez přizpůsobení stránce)', ok, ph - ok + 5, 2.5); meritko(pw - ok - 85, ph - ok + 5); };
    let prvni = true;
    const strana = () => { if (!prvni) doc.addPage([pw, ph], pw > ph ? 'l' : 'p'); prvni = false; };

    /* 1) titul + parametry + kusovník */
    strana();
    let y = ok + 6;
    text('Planetárium Slunce–Země–Měsíc (tellurium)', ok, y, 6); y += 8;
    const v = mech.vystupy;
    const radky = [
      `Modul m = ${fmt(mech.p.m, 2)} mm, šířka kol b = ${fmt(mech.p.b, 1)} mm, mezera mezi vrstvami ${fmt(mech.p.mezera, 1)} mm, rameno (Slunce–Země) D = ${fmt(mech.D, 1)} mm.`,
      `Převod ramene: klika z${mech.p.zK} → kolo ramene z${mech.p.zA}; 1 otáčka kliky = ${fmt(mech.pohon.dnuNaOtacku, 3)} dne.`,
      v.mesic ? `Měsíc: ${fmt(v.mesic.abs, 6)} oběhu/rok (cíl ${fmt(P.CILE.mesicAbs, 6)}), synodicky ${fmt(-v.mesic.i0, 6)} – fáze se rozejde o 1 den za ${fmt(v.mesic.denZaRoku, 0)} let.` : 'Měsíc: vypnut.',
      v.uzly ? `Uzly: ${fmt(v.uzly.abs, 6)} ot./rok (cíl ${fmt(P.CILE.uzly, 6)}), chyba ${fmt(v.uzly.stupnuZaRok, 3)}° za rok.` : '',
      v.den ? `Rotace Země: ${fmt(v.den.abs, 4)} ot./rok (cíl ${fmt(P.CILE.den, 4)}).` : '',
      `Datum seřízení modelu: ${o.datum || ''}.`
    ].filter(Boolean);
    for (const r of radky) { doc.setFontSize(3 / 0.3528); for (const rr of doc.splitTextToSize(T(r), uw)) { text(rr, ok, y, 3); y += 4.3; } }
    y += 3; text('Kusovník', ok, y, 4.5); y += 6;
    const sl = [['Poz.', 0], ['Název', 12], ['z', uw * 0.52], ['Ø rozteč.', uw * 0.58], ['Ø hlav.', uw * 0.68], ['otvor', uw * 0.77], ['vrstva / osa', uw * 0.85]];
    const hlav = () => { doc.setDrawColor(0); doc.setLineWidth(0.2); for (const [t, x] of sl) text(t, ok + x, y, 2.6); y += 1.5; doc.line(ok, y, ok + uw, y); y += 3.6; };
    hlav();
    for (const k of mech.kusovnik) {
      const nazev = k.nazev + (k.rozmer ? ' – ' + k.rozmer : '') + (k.ks > 1 ? ` (${k.ks} ks)` : '');
      doc.setFontSize(2.6 / 0.3528);
      const r = doc.splitTextToSize(T(nazev), uw * (k.z ? 0.5 : 0.86) - 12);
      if (y + r.length * 3.4 > ph - ok - 4) { pata('Kusovník'); strana(); y = ok + 6; hlav(); }
      text(k.poz, ok, y, 2.6);
      r.forEach((rr, i) => text(rr, ok + 12, y + i * 3.4, 2.6));
      if (k.z) { text(String(k.z), ok + sl[2][1], y, 2.6); text(fmt(k.d, 1), ok + sl[3][1], y, 2.6); text(fmt(k.da, 1), ok + sl[4][1], y, 2.6); text(fmt(k.otvor, 2), ok + sl[5][1], y, 2.6); text((k.vrstva ? k.vrstva + ' / ' : '') + (k.osa || ''), ok + sl[6][1], y, 2.6); }
      y += r.length * 3.4 + 0.9;
    }
    pata('Kusovník');

    /* 2) šablony: díly rozložené na stránky 1:1 */
    const dily = plochyDilu(mech);
    const velke = dily.filter((d) => d.w > uw - 2 || d.h + 8 > uh - 60);
    const male = dily.filter((d) => !velke.includes(d));
    const naStranu = [];
    {
      // plnění stránek po řádcích (první stránka nechá místo na kontrolní čtverec)
      let zbyva = male.slice().sort((a, b) => b.h - a.h), cislo = 0;
      while (zbyva.length) {
        const rezerva = cislo === 0 ? 62 : 0, H = uh - 8 - rezerva;
        const roz = rozlozDily(zbyva, uw, 4, true), list = roz.pozice.filter((q) => q.y + q.d.h + 7 <= H);
        if (!list.length) { velke.push(zbyva.shift()); continue; }
        naStranu.push({ list, rezerva }); zbyva = zbyva.filter((d) => !list.some((q) => q.d === d)); cislo++;
      }
    }
    const kresliDil = (d, X, Y) => {
      doc.setDrawColor(0); doc.setLineWidth(0.18);
      const poly = (b) => { const seg = []; for (let i = 1; i < b.length; i++) seg.push([b[i][0] - b[i - 1][0], b[i][1] - b[i - 1][1]]); seg.push([b[0][0] - b[b.length - 1][0], b[0][1] - b[b.length - 1][1]]); doc.lines(seg, b[0][0], b[0][1], [1, 1], 'S', true); };
      if (d.kolo) {
        poly(bodyKola(d.kolo, 0.03).map((q) => [X(q[0]), Y(q[1])]));
        doc.setDrawColor(150); doc.setLineWidth(0.1); doc.setLineDashPattern([1.2, 0.8], 0); doc.circle(X(0), Y(0), d.kolo.r, 'S'); doc.setLineDashPattern([], 0);
      } else if (d.obrys) poly(d.obrys.map((q) => [X(q[0]), Y(q[1])]));
      else if (d.kruh) doc.circle(X(0), Y(0), d.kruh, 'S');
      doc.setDrawColor(0); doc.setLineWidth(0.18);
      for (const h of d.otvory) {
        doc.circle(X(h.x), Y(h.y), h.r, 'S');
        const r = h.r + 2.5; doc.setLineWidth(0.1); doc.line(X(h.x) - r, Y(h.y), X(h.x) + r, Y(h.y)); doc.line(X(h.x), Y(h.y) - r, X(h.x), Y(h.y) + r); doc.setLineWidth(0.18);
        if (d.rameno) text(`${h.id === 'O' ? 'O (sloup)' : h.id === 'E' ? 'E (Země)' : h.id}  Ø${fmt(2 * h.r, 2)}  [${fmt(h.x, 1)}; ${fmt(h.y, 1)}]`, X(h.x) + h.r + 1.2, Y(h.y) - h.r - 0.8, 2.2, 'l', [60, 60, 60]);
      }
    };
    naStranu.forEach((st, i) => {
      strana();
      text(`Šablony dílů 1:1 – list ${i + 1}`, ok, ok + 4, 4);
      for (const { d, x, y: yy } of st.list) {
        const cx = ok + x + d.w / 2, cy = ok + 8 + yy + d.h / 2;
        kresliDil(d, (u) => cx + (u - d.cx), (w) => cy - (w - d.cy));
        text(d.nazev, cx, ok + 8 + yy + d.h + 3.2, 2.7, 'c');
        text(d.popis, cx, ok + 8 + yy + d.h + 6.2, 2.1, 'c', [80, 80, 80]);
      }
      if (st.rezerva) ctverec(ok, ph - ok - 58);
      pata('Šablony dílů');
    });
    // velké díly – dělení na listy s pásmem lepení
    const prekryv = Math.max(0, o.prekryv == null ? 10 : +o.prekryv);
    for (const d of velke) {
      const W = d.w + 10, H = d.h + 16, krokX = uw - prekryv, krokY = uh - 10 - prekryv;
      const nx = Math.max(1, Math.ceil((W - prekryv) / krokX)), ny = Math.max(1, Math.ceil((H - prekryv) / krokY));
      for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
        strana();
        const sx = c * krokX, sy = r * krokY;
        doc.saveGraphicsState(); doc.rect(ok, ok, uw, uh - 10, null); doc.clip(); doc.discardPath();
        const cx = ok - sx + 5 + d.w / 2, cy = ok - sy + 5 + d.h / 2;
        kresliDil(d, (u) => cx + (u - d.cx), (w) => cy - (w - d.cy));
        text(d.nazev + ' – ' + d.popis, ok - sx + 5, ok - sy + 5 + d.h + 6, 3);
        doc.restoreGraphicsState();
        doc.setDrawColor(120); doc.setLineWidth(0.2); doc.setLineDashPattern([2, 1.5], 0);
        if (c < nx - 1) doc.line(ok + uw - prekryv, ok, ok + uw - prekryv, ok + uh - 10);
        if (r < ny - 1) doc.line(ok, ok + uh - 10 - prekryv, ok + uw, ok + uh - 10 - prekryv);
        doc.setLineDashPattern([], 0); doc.setDrawColor(0);
        for (const [x, yy] of [[ok, ok], [ok + uw, ok], [ok, ok + uh - 10], [ok + uw, ok + uh - 10]]) { doc.line(x - 3, yy, x + 3, yy); doc.line(x, yy - 3, x, yy + 3); }
        pata(`${d.nazev}${nx * ny > 1 ? ` · list ${r * nx + c + 1}/${nx * ny} (řádek ${r + 1}, sloupec ${c + 1}) – přesah ${prekryv} mm po čárkovanou čáru` : ''}`);
      }
    }

    /* 3) montážní návod */
    strana(); y = ok + 6;
    text('Montážní návod', ok, y, 5); y += 8;
    for (const r of o.navod || []) {
      const tucne = r.startsWith('# '), t = tucne ? r.slice(2) : r, vel = tucne ? 3.6 : 2.9;
      doc.setFontSize(vel / 0.3528);
      for (const rr of doc.splitTextToSize(T(t), uw)) {
        if (y > ph - ok - 6) { pata('Montážní návod'); strana(); y = ok + 6; }
        text(rr, ok, y, vel); y += vel * 1.45;
      }
      y += tucne ? 0.8 : 0.6;
    }
    pata('Montážní návod');
    return doc;
  }

  const API = { plochyDilu, rozlozDily, bodyKola, svg, dxf, pdf, bezDiakritiky, PAPIRY };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.PLANVystup = API;
})(typeof window !== 'undefined' ? window : globalThis);

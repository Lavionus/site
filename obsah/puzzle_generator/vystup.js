/* ============================================================
   puzzle_generator/vystup.js – tisk na papír (PDF přes jsPDF) a kreslení
   na plátno (náhled, PNG). jsPDF se předává parametrem.

     V.pdf(jsPDF, p, o) → doc
       o = {papir{w,h}, okraj, orientace, foto (dataURL JPEG | null), lic, rub, uvod,
            cara{rgb, tl}, pismo (base64 TTF | null), nazev}
     V.kresli(ctx, p, o) – fotka + řezné čáry (+ čísla) na plátno v px
       o = {mer (px/mm), foto (CanvasImageSource | null), cara, tl (px), cisla, rub}
   ============================================================ */
(function (koren) {
  'use strict';
  const P = koren.PUZZLE || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const V = {};
  const c = P.c3;
  const bezDiakritiky = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/×/g, 'x').replace(/[–—]/g, '-').replace(/[„“”]/g, '"').replace(/…/g, '...').replace(/→/g, '->');

  // cesta do jsPDF přes mapovací funkci (posun, zrcadlení)
  function cestaPdf(doc, cesta, m) {
    const a = m(cesta.s[0], cesta.s[1]); doc.moveTo(a[0], a[1]);
    for (const q of cesta.seg) {
      if (q[0] === 'L') { const b = m(q[1], q[2]); doc.lineTo(b[0], b[1]); }
      else { const b1 = m(q[1], q[2]), b2 = m(q[3], q[4]), b3 = m(q[5], q[6]); doc.curveTo(b1[0], b1[1], b2[0], b2[1], b3[0], b3[1]); }
    }
  }

  V.pdf = function (jsPDF, p, o) {
    o = Object.assign({ okraj: 10, lic: true, rub: false, uvod: true, cara: { rgb: [0, 0, 0], tl: 0.3 } }, o || {});
    const L = P.listy(p.sirka, p.vyska, o.papir || { w: 210, h: 297 }, { okraj: o.okraj, orientace: o.orientace });
    const PW = L.papir.w, PH = L.papir.h, orient = PW > PH ? 'landscape' : 'portrait';
    const doc = new jsPDF({ unit: 'mm', format: [PW, PH], orientation: orient, compress: true });
    let unicode = false;
    if (o.pismo) {
      try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); unicode = true; }
      catch (e) { doc.setFont('helvetica', 'normal'); }
    } else doc.setFont('helvetica', 'normal');
    const T = s => unicode ? String(s) : bezDiakritiky(s);
    const text = (s, x, y, vel, zar) => { doc.setFontSize(vel || 9); doc.text(T(s), x, y, zar ? { align: zar } : undefined); };
    const retezy = P.retezy(p).map(r => ({ r, cesta: P.cesta(p, r.odkazy) }));
    const nazev = o.nazev || 'Puzzle';
    let prvni = true;
    const novaStrana = () => { if (prvni) prvni = false; else doc.addPage([PW, PH], orient); };

    /* úvodní list s návodem a mapou listů */
    if (o.uvod) {
      novaStrana();
      text(nazev, 15, 20, 16);
      text(`${p.kusy.length} dílků (${p.sloupce} × ${p.radky}${p.whimsy ? ' + whimsy' : ''}), velikost ${c(p.sirka / 10)} × ${c(p.vyska / 10)} cm, měřítko 1:1`, 15, 30, 10);
      text(`Papír ${c(L.papir.w)} × ${c(L.papir.h)} mm, okraj ${c(L.okraj)} mm · listů: ${L.listy.length} (${L.sloupcu} × ${L.radku})${o.rub ? ' · za každým lícem následuje rub' : ''}`, 15, 36, 10);
      const radky = [
        'Postup:',
        '1. Tiskněte ve skutečné velikosti (100 %, bez „přizpůsobit stránce“), ověřte čtverec 50 mm.',
        o.rub ? '2. Oboustranně: list na výšku otáčet podle dlouhé hrany, na šířku podle krátké (rub je zrcadlený).' : '2. Jednostranně.',
        '3. Listy ořízněte podle ořezových značek a přiložte k sobě podle označení (A1, A2 …).',
        '4. Nalepte na tvrdý karton (lepidlo ve spreji / lepicí fólie), nechte zatížené vyschnout.',
        '5. Rozřežte po čarách – nejdřív dlouhé řady, pak jednotlivé dílky (řezák, nůžky, lupenková pila).',
      ];
      let y = 46;
      for (const r of radky) { text(r, 15, y, 9); y += 5.5; }
      y += 4;
      const mer = Math.min((PW - 30) / p.sirka, (PH - y - 75) / p.vyska);
      if (mer > 0) {
        doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(15, y, p.sirka * mer, p.vyska * mer);
        doc.setLineWidth(0.1); doc.setDrawColor(150);
        for (const { cesta } of retezy) cestaPdf(doc, cesta, (x, yy) => [15 + x * mer, y + yy * mer]);
        doc.stroke();
        doc.setDrawColor(0); doc.setLineWidth(0.25);
        for (const l of L.listy) {
          doc.rect(15 + l.x * mer, y + l.y * mer, l.w * mer, l.h * mer);
          text(l.oznaceni, 15 + (l.x + l.w / 2) * mer, y + (l.y + l.h / 2) * mer + 2, Math.max(6, Math.min(16, l.w * mer / 3)), 'center');
        }
        y += p.vyska * mer + 8;
      }
      const ky = Math.min(PH - 15 - 50, y);
      doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(15, ky, 50, 50);
      text('Kontrolní čtverec 50 × 50 mm', 70, ky + 24, 9);
      text('změřte pravítkem – musí mít přesně 50 mm', 70, ky + 29, 8);
    }

    const rgb = o.cara.rgb;
    for (const l of L.listy) {
      const ox = L.okraj - l.x, oy = L.okraj - l.y;
      const znacky = (x0) => {   // ořezové značky v rozích výřezu listu
        doc.setDrawColor(0); doc.setLineWidth(0.2);
        for (const [x, y, sx, sy] of [[x0, L.okraj, -1, -1], [x0 + l.w, L.okraj, 1, -1], [x0 + l.w, L.okraj + l.h, 1, 1], [x0, L.okraj + l.h, -1, 1]]) {
          doc.line(x + sx * 1.5, y, x + sx * 6, y); doc.line(x, y + sy * 1.5, x, y + sy * 6);
        }
      };
      const sousede = [l.i > 0 ? `vlevo ${String.fromCharCode(65 + l.j)}${l.i}` : '', l.i < L.sloupcu - 1 ? `vpravo ${String.fromCharCode(65 + l.j)}${l.i + 2}` : '',
        l.j > 0 ? `nahoře ${String.fromCharCode(64 + l.j)}${l.i + 1}` : '', l.j < L.radku - 1 ? `dole ${String.fromCharCode(66 + l.j)}${l.i + 1}` : ''].filter(Boolean).join(', ');
      if (o.lic) {
        novaStrana();
        doc.saveGraphicsState();
        doc.rect(L.okraj, L.okraj, l.w, l.h, null); doc.clip(); doc.discardPath();
        if (o.foto) doc.addImage(o.foto, 'JPEG', ox, oy, p.sirka, p.vyska, 'foto', 'FAST');
        doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(o.cara.tl);
        doc.setLineCap('round'); doc.setLineJoin('round');
        for (const { cesta } of retezy) cestaPdf(doc, cesta, (x, y) => [x + ox, y + oy]);
        doc.stroke();
        doc.restoreGraphicsState();
        znacky(L.okraj);
        doc.setTextColor(70);
        text(`${nazev} · líc · list ${l.oznaceni} (${L.listy.indexOf(l) + 1}/${L.listy.length})${sousede ? ' · sousedé: ' + sousede : ''} · 1:1`, L.okraj, Math.max(4, L.okraj - 3), 7);
        doc.setTextColor(0);
      }
      if (o.rub) {
        novaStrana();
        const m = (x, y) => [PW - (x + ox), y + oy], x0 = PW - L.okraj - l.w;
        doc.saveGraphicsState();
        doc.rect(x0, L.okraj, l.w, l.h, null); doc.clip(); doc.discardPath();
        doc.setDrawColor(185); doc.setLineWidth(0.15);
        for (const { cesta } of retezy) cestaPdf(doc, cesta, m);
        doc.stroke();
        const v = P.vyskaCisla(p) * 1.15;
        doc.setTextColor(0); doc.setFontSize(v / 0.3528);
        for (const k of p.kusy) {
          const q = m(k.stred[0], k.stred[1]);
          if (q[0] < x0 - v || q[0] > x0 + l.w + v || q[1] < L.okraj - v || q[1] > L.okraj + l.h + v) continue;
          doc.text(String(k.cislo), q[0], q[1], { align: 'center', baseline: 'middle' });
        }
        doc.restoreGraphicsState();
        znacky(x0);
        doc.setTextColor(70);
        text(`${nazev} · rub (zrcadlený) · list ${l.oznaceni}`, x0, Math.max(4, L.okraj - 3), 7);
        doc.setTextColor(0);
      }
    }
    return doc;
  };

  /* ---------- plátno ---------- */
  V.kresli = function (ctx, p, o) {
    o = Object.assign({ mer: 1, cara: '#000000', tl: 1, cisla: false, rub: false, barvaCisel: '#000000', pozadi: '#ffffff' }, o || {});
    const s = o.mer, W = p.sirka * s, H = p.vyska * s;
    ctx.save();
    if (o.rub) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    if (o.foto && !o.rub) ctx.drawImage(o.foto, 0, 0, W, H);
    else { ctx.fillStyle = o.pozadi; ctx.fillRect(0, 0, W, H); }
    ctx.scale(s, s);
    ctx.strokeStyle = o.cara; ctx.lineWidth = o.tl / s; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const r of P.retezy(p)) ctx.stroke(new Path2D(P.svgDRetez(p, r)));
    ctx.restore();
    if (o.cisla) {
      const v = P.vyskaCisla(p) * s * (o.rub ? 1.15 : 0.8);
      ctx.save(); ctx.fillStyle = o.barvaCisel; ctx.font = `600 ${v}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const k of p.kusy) { const x = (o.rub ? p.sirka - k.stred[0] : k.stred[0]) * s; ctx.fillText(String(k.cislo), x, k.stred[1] * s); }
      ctx.restore();
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = V;
  else koren.PUZZLE_VYSTUP = V;
})(typeof window !== 'undefined' ? window : globalThis);

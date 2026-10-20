/* ============================================================
   Dřevo – pohyb, průhyb, povrchy · PDF report (jsPDF předán parametrem)
   Vstup = pole oddílů { nadpis, text, udaje:[[popis, hodnota]], tabulka:{ hlavicka:[], radky:[[]] , sirky:[] }, obrazky:[{data,w,h,sirkaMm}] }.
   A4 na výšku, okraje 15 mm, automatické stránkování, v patičce kontrolní úsečky 50 mm (X i Y).
   ============================================================ */
(function (koren) {
  'use strict';
  const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/[…]/g, '...').replace(/[„“]/g, '"').replace(/[·×]/g, (c) => (c === '×' ? 'x' : '-')).replace(/[²]/g, '2').replace(/[³]/g, '3').replace(/[⁴]/g, '4').replace(/[δ]/g, 'd').replace(/[≈]/g, '~').replace(/[≥]/g, '>=').replace(/[≤]/g, '<=').replace(/[→]/g, '->').replace(/[^\x00-\xff]/g, '?');
  // znaky, které Liberation Sans nemá nebo jsou riskantní
  const bezpecne = (s) => String(s).replace(/[⌀]/g, 'pr.').replace(/[✓]/g, 'OK').replace(/[✗]/g, 'X').replace(/[⚠]/g, '!').replace(/[\u{1F000}-\u{1FFFF}☀-➿️]/gu, '').replace(/[ⁿ]/g, 'n').replace(/⁴/g, '^4').replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080));

  function report(jsPDF, oddily, o) {
    o = o || {};
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'p' });
    let uni = false;
    if (o.pismo) {
      try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; }
      catch (e) { doc.setFont('helvetica', 'normal'); }
    } else doc.setFont('helvetica', 'normal');
    const T = (s) => (uni ? bezpecne(s) : bezDiakritiky(bezpecne(s)));
    const PW = 210, PH = 297, M = 15, SW = PW - 2 * M, DOLE = PH - 22;
    let y = M, strana = 1;
    doc.setProperties({ title: T(o.nazev || 'Dřevo – výpočty'), creator: 'Dřevo – pohyb, průhyb, povrchy' });

    function paticka() {
      doc.setDrawColor(0); doc.setLineWidth(0.3);
      // kontrolní úsečky 50 mm
      const x0 = M, yy = PH - 10;
      doc.line(x0, yy, x0 + 50, yy); doc.line(x0, yy - 1.5, x0, yy + 1.5); doc.line(x0 + 50, yy - 1.5, x0 + 50, yy + 1.5);
      doc.line(x0 - 6, yy, x0 - 6, yy - 50); doc.line(x0 - 7.5, yy, x0 - 4.5, yy); doc.line(x0 - 7.5, yy - 50, x0 - 4.5, yy - 50);
      doc.setFontSize(7); doc.setTextColor(90);
      doc.text(T('kontrolní úsečky 50 mm (tisk 100 %)'), x0 + 53, yy + 1);
      doc.text(T(`${o.nazev || ''} · ${o.datum || ''} · strana ${strana}`), PW - M, yy + 1, { align: 'right' });
      doc.setTextColor(0);
    }
    function nova() { paticka(); doc.addPage(); strana++; y = M; }
    function misto(h) { if (y + h > DOLE) nova(); }
    function odstavec(text, vel, barva) {
      doc.setFontSize(vel || 9.5); if (barva) doc.setTextColor(barva);
      const radky = doc.splitTextToSize(T(text), SW);
      const lh = (vel || 9.5) * 0.42;
      for (const r of radky) { misto(lh); doc.text(r, M, y + lh * 0.8); y += lh; }
      doc.setTextColor(0); y += 1.5;
    }

    doc.setFontSize(16); doc.text(T(o.nazev || 'Dřevo – výpočty'), M, y + 6); y += 10;
    if (o.podtitul) odstavec(o.podtitul, 9, 90);

    for (const od of oddily) {
      misto(16);
      y += 2;
      doc.setFillColor(235, 238, 241); doc.rect(M, y, SW, 7, 'F');
      doc.setFontSize(11.5); doc.text(T(od.nadpis), M + 2, y + 5); y += 10;
      if (od.text) odstavec(od.text);
      if (od.udaje && od.udaje.length) {
        doc.setFontSize(9);
        const sl = 2, sw = SW / sl;
        for (let i = 0; i < od.udaje.length; i += sl) {
          misto(5);
          for (let k = 0; k < sl && i + k < od.udaje.length; k++) {
            const [a, b] = od.udaje[i + k], x = M + k * sw;
            doc.setTextColor(90); doc.text(T(a), x, y + 3.5); doc.setTextColor(0);
            doc.text(T(b), x + sw - 3, y + 3.5, { align: 'right' });
            doc.setDrawColor(220); doc.line(x, y + 4.6, x + sw - 3, y + 4.6);
          }
          y += 5;
        }
        y += 2;
      }
      if (od.tabulka) {
        const t = od.tabulka, sir = t.sirky || t.hlavicka.map(() => SW / t.hlavicka.length);
        const suma = sir.reduce((a, b) => a + b, 0), ks = SW / suma;
        const radek = (bunky, tucne) => {
          doc.setFontSize(8.5);
          const zal = bunky.map((c, i) => doc.splitTextToSize(T(c == null ? '' : c), sir[i] * ks - 2));
          const h = Math.max(...zal.map((z) => z.length)) * 3.6 + 1.6;
          misto(h);
          if (tucne) { doc.setFillColor(245, 246, 248); doc.rect(M, y, SW, h, 'F'); }
          let x = M;
          zal.forEach((z, i) => { z.forEach((r, j) => doc.text(r, x + 1, y + 3.4 + j * 3.6)); x += sir[i] * ks; });
          doc.setDrawColor(215); doc.line(M, y + h, M + SW, y + h);
          y += h;
        };
        radek(t.hlavicka, true);
        for (const r of t.radky) radek(r, false);
        y += 3;
      }
      for (const im of od.obrazky || []) {
        const w = Math.min(SW, im.sirkaMm || SW), h = w * im.h / im.w;
        misto(h + 2);
        try { doc.addImage(im.data, 'PNG', M, y, w, h); } catch (e) { /* obrázek vynechán */ }
        y += h + 3;
      }
    }
    if (o.poznamka) { y += 2; odstavec(o.poznamka, 8, 90); }
    paticka();
    return doc;
  }
  koren.DVV = { report, bezDiakritiky };
  if (typeof module !== 'undefined' && module.exports) module.exports = koren.DVV;
})(typeof window !== 'undefined' ? window : globalThis);

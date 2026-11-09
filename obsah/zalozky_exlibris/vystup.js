/* Záložky a ex libris – výstupy v prohlížeči: rastr SVG → plátno, PNG, náhled archu a PDF (jsPDF).
   Text je ve všech SVG už převedený na křivky, takže rastr ani PDF nepotřebují písma.
   PDF: každý návrh (líc, rub) se vloží jednou jako obrázek a na archu se jen opakuje (alias jsPDF). */
(function () {
  'use strict';
  const ZE = window.ZE;
  const V = {};
  const n = ZE.n;

  /* SVG (řetězec, rozměr w × h mm) → plátno v daném DPI; otoceni 0 | 90 | -90 */
  V.rastr = function (svg, wmm, hmm, dpi, otoceni, pozadi) {
    return new Promise((ok, chyba) => {
      const img = new Image();
      img.onload = () => {
        dpi = ZE.dpiProPlatno(wmm, hmm, dpi);   // limit plátna Safari / iPadu
        const pw = Math.max(1, Math.round(wmm / 25.4 * dpi)), ph = Math.max(1, Math.round(hmm / 25.4 * dpi));
        const c = document.createElement('canvas');
        const rot = otoceni === 90 || otoceni === -90;
        c.width = rot ? ph : pw; c.height = rot ? pw : ph;
        const x = c.getContext('2d');
        if (pozadi) { x.fillStyle = pozadi; x.fillRect(0, 0, c.width, c.height); }
        if (otoceni === 90) { x.translate(c.width, 0); x.rotate(Math.PI / 2); }
        else if (otoceni === -90) { x.translate(0, c.height); x.rotate(-Math.PI / 2); }
        x.drawImage(img, 0, 0, pw, ph);
        ok(c);
      };
      img.onerror = () => chyba(new Error('SVG se nepodařilo vykreslit'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  };

  V.stahni = function (data, jmeno, typ) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: typ || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = jmeno;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  V.jmenoSouboru = s => (String(s || 'navrh').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'navrh');

  /* Náhled archu jako SVG: kusy jako vnořená SVG, ořezové značky, okraje tiskárny. */
  V.archSvg = function (R, svgKusu, o) {
    o = o || {};
    const P = R.papir, b = R.spadavka, kus = R.kus;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(P.w)} ${n(P.h)}" width="${n(P.w)}mm" height="${n(P.h)}mm">`;
    s += `<rect width="${n(P.w)}" height="${n(P.h)}" fill="#ffffff"/>`;
    s += `<rect x="${n(R.okraj)}" y="${n(R.okraj)}" width="${n(P.w - 2 * R.okraj)}" height="${n(P.h - 2 * R.okraj)}" fill="none" stroke="#9db7d9" stroke-width="0.25" stroke-dasharray="2 1.5"/>`;
    const sada = (Array.isArray(svgKusu) ? svgKusu : [svgKusu]).map(x => x.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''));
    const vb = `${n(-b)} ${n(-b)} ${n(kus.w + 2 * b)} ${n(kus.h + 2 * b)}`;
    const zrc = o.rub ? ZE.rubPozice : null;
    R.kusy.forEach((k0, i) => {
      const k = zrc ? zrc(k0, P, o.posun) : k0;
      const vnor = `<svg x="${n(-b)}" y="${n(-b)}" width="${n(kus.w + 2 * b)}" height="${n(kus.h + 2 * b)}" viewBox="${vb}">${sada[i % sada.length]}</svg>`;
      let tf = `translate(${n(k.x)} ${n(k.y)})`;
      if (k.otoceni === 90) tf += ` translate(${n(kus.h)} 0) rotate(90)`;
      else if (k.otoceni === -90) tf += ` translate(0 ${n(kus.w)}) rotate(-90)`;
      s += `<g transform="${tf}">${vnor}</g>`;
      if (o.rezy) s += `<rect x="${n(k.x)}" y="${n(k.y)}" width="${n(k.w)}" height="${n(k.h)}" fill="none" stroke="#d0342c" stroke-width="0.2" stroke-dasharray="1 0.8"/>`;
    });
    if (!o.rub) for (const z of R.znacky) s += `<line x1="${n(z[0])}" y1="${n(z[1])}" x2="${n(z[2])}" y2="${n(z[3])}" stroke="#000" stroke-width="0.2"/>`;
    return s + '</svg>';
  };

  let pismoPdf = null;
  async function nactiPismoPdf() {
    if (pismoPdf !== null) return pismoPdf;
    try {
      const r = await fetch('stitky_panely/fonty/LiberationSans-Regular.ttf');
      if (!r.ok) throw new Error();
      const u = new Uint8Array(await r.arrayBuffer());
      let bin = '';
      for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      pismoPdf = btoa(bin);
    } catch (e) { pismoPdf = ''; }
    return pismoPdf;
  }

  /* PDF: listy = [{svg: SVG kusu se spadávkou, rub: SVG rubu | null}], R = rozvrh, o = {dpi, format 'PNG'|'JPEG', popis, posun, obrys, pozadiRastru} */
  V.pdf = async function (lic, rub, R, o) {
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) throw new Error('Knihovna jsPDF se nenačetla.');
    const P = R.papir, b = R.spadavka, kus = R.kus, dpi = o.dpi || 600, fmt = o.format === 'JPEG' ? 'JPEG' : 'PNG';
    const doc = new jsPDF({ unit: 'mm', format: [P.w, P.h], orientation: P.w > P.h ? 'landscape' : 'portrait', compress: true });
    const pismo = await nactiPismoPdf();
    if (pismo) { doc.addFileToVFS('LiberationSans-Regular.ttf', pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); }
    const T = s => pismo ? s : String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
    const bw = kus.w + 2 * b, bh = kus.h + 2 * b;
    const obrazky = {};
    const obrazek = async (svg, ot, klic) => {
      if (!obrazky[klic]) {
        const c = await V.rastr(svg, bw, bh, dpi, ot, fmt === 'JPEG' || o.pozadiRastru ? (o.pozadiRastru || '#ffffff') : null);
        obrazky[klic] = fmt === 'JPEG' ? c.toDataURL('image/jpeg', 0.93) : c.toDataURL('image/png');
        c.width = c.height = 0;   // Safari drží paměť plátna, dokud ho nezmenšíme
      }
      return obrazky[klic];
    };
    /* svg = řetězec, nebo pole (série: kus i dostane svg[i mod délka]) */
    const strana = async (svg, rubova) => {
      const sada = Array.isArray(svg) ? svg : [svg];
      for (let i = 0; i < R.kusy.length; i++) {
        const k0 = R.kusy[i], k = rubova ? ZE.rubPozice(k0, P, o.posun) : k0;
        const j = i % sada.length, ot = k.otoceni || 0, klic = (rubova ? 'r' : 'l') + j + '_' + ot;
        const data = await obrazek(sada[j], ot, klic);
        const w = ot ? bh : bw, h = ot ? bw : bh;
        doc.addImage(data, fmt, k.x - b, k.y - b, w, h, klic, 'FAST');
        if (o.obrys) { doc.setDrawColor(150); doc.setLineWidth(0.1); doc.rect(k.x, k.y, k.w, k.h); }
      }
    };
    await strana(lic, false);
    doc.setDrawColor(0); doc.setLineWidth(0.2);
    for (const z of R.znacky) doc.line(z[0], z[1], z[2], z[3]);
    doc.setFontSize(7); doc.setTextColor(110);
    if (o.popis) doc.text(T(o.popis), P.w / 2, P.h - Math.max(3, R.okraj * 0.55), { align: 'center' });
    if (rub) {
      doc.addPage([P.w, P.h], P.w > P.h ? 'landscape' : 'portrait');
      await strana(rub, true);
      doc.setFontSize(7); doc.setTextColor(110);
      doc.text(T('Rub – tiskněte oboustranně s otočením přes dlouhou hranu'), P.w / 2, P.h - Math.max(3, R.okraj * 0.55), { align: 'center' });
    }
    return doc;
  };

  /* Zkušební arch pro seřízení oboustranného tisku: na líci křížky, na rubu (na zrcadlových místech)
     stupnice −5 … +5 mm. Proti světlu se odečte číslo pod křížkem = posun rubu, který se zadá do nastavení. */
  V.kalibrace = async function (papir) {
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) throw new Error('Knihovna jsPDF se nenačetla.');
    const P = papir, doc = new jsPDF({ unit: 'mm', format: [P.w, P.h], orientation: P.w > P.h ? 'landscape' : 'portrait' });
    const pismo = await nactiPismoPdf();
    if (pismo) { doc.addFileToVFS('LiberationSans-Regular.ttf', pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); }
    const T = s => pismo ? s : String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
    const body = [[P.w * 0.3, P.h * 0.25], [P.w * 0.7, P.h * 0.5], [P.w * 0.3, P.h * 0.75]];
    doc.setLineWidth(0.15); doc.setDrawColor(0);
    for (const [x, y] of body) { doc.line(x - 12, y, x + 12, y); doc.line(x, y - 12, x, y + 12); doc.circle(x, y, 2); }
    doc.setFontSize(11); doc.text(T('Zkušební arch – líc'), P.w / 2, 15, { align: 'center' });
    doc.setFontSize(8);
    [ 'Vytiskněte oboustranně (otáčení přes dlouhou hranu), v měřítku 100 %.',
      'Podívejte se proti světlu: svislá čára křížku ukazuje na vodorovné stupnici číslo = posun rubu →,',
      'vodorovná čára na svislé stupnici číslo = posun rubu ↓. Čísla zadejte v Tisk na arch.' ].forEach((t, i) => doc.text(T(t), P.w / 2, 22 + i * 4.5, { align: 'center' }));
    doc.addPage([P.w, P.h], P.w > P.h ? 'landscape' : 'portrait');
    doc.setFontSize(5);
    for (const [x0, y] of body) {
      const x = P.w - x0;
      doc.setLineWidth(0.12);
      doc.line(x - 6, y + 9, x + 6, y + 9); doc.line(x + 9, y - 6, x + 9, y + 6);
      for (let t = -5; t <= 5.001; t += 0.5) {
        const dl = Number.isInteger(t) ? 2.2 : 1.1;
        doc.line(x + t, y + 9, x + t, y + 9 - dl);           // vodorovná stupnice (posun →)
        doc.line(x + 9, y + t, x + 9 - dl, y + t);           // svislá stupnice (posun ↓)
        if (Number.isInteger(t)) { doc.text(String(t), x + t, y + 11.5, { align: 'center' }); doc.text(String(t), x + 10, y + t + 0.7); }
      }
    }
    doc.setFontSize(9); doc.text(T('Zkušební arch – rub'), P.w / 2, P.h - 10, { align: 'center' });
    return doc;
  };

  window.ZE_VYSTUP = V;
})();

/* ============================================================
   Štítky a čelní panely – tisk do PDF v měřítku 1:1 (jsPDF, jednotky mm).
   Bez DOM: jsPDF se předává parametrem, takže jde testovat v node.
   Texty se kreslí jako obrysy glyfů (opentype.js přes SP.textNaPrikazy),
   proto čeština funguje bez vkládání fontu a tisk odpovídá náhledu.
   ============================================================ */
(function () {
  'use strict';
  const SP = typeof module !== 'undefined' ? require('./jadro.js') : window.SP;
  const fmt = SP.fmt;

  const FORMATY = { A4: [210, 297], A3: [297, 420], A5: [148, 210], Letter: [215.9, 279.4] };
  const OKRAJ = { l: 10, t: 10, r: 15, b: 25 }; // pravý okraj = svislé pravítko, spodní = vodorovné pravítko + pokyny

  /* Převod souřadnic: návrh (mm) → stránka (mm) s korekcí tiskárny. */
  function tfNovy(o) {
    // o: {ox, oy, W, zrcadlit, kx, ky, x0, y0}  (x0,y0 = počátek výřezu v návrhu – dlaždice)
    return {
      kx: o.kx || 1, ky: o.ky || 1,
      x: (x) => (o.ox + ((o.zrcadlit ? (o.W - x) : x) - (o.x0 || 0))) * (o.kx || 1),
      y: (y) => (o.oy + (y - (o.y0 || 0))) * (o.ky || 1),
      zrc: !!o.zrcadlit,
    };
  }
  const tfStrana = (kx = 1, ky = 1) => ({ kx, ky, x: (x) => x * kx, y: (y) => y * ky, zrc: false });

  function barvaRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return [0, 0, 0];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* Kreslení cesty (M/L/A/C/Q/Z v mm návrhu) přes doc.path(). */
  function cestaOps(p, tf) {
    const ops = []; let x = 0, y = 0;
    for (const c of SP.cestaBezOblouku(p)) {
      if (c[0] === 'M') { ops.push({ op: 'm', c: [tf.x(c[1]), tf.y(c[2])] }); x = c[1]; y = c[2]; }
      else if (c[0] === 'L') { ops.push({ op: 'l', c: [tf.x(c[1]), tf.y(c[2])] }); x = c[1]; y = c[2]; }
      else if (c[0] === 'C') { ops.push({ op: 'c', c: [tf.x(c[1]), tf.y(c[2]), tf.x(c[3]), tf.y(c[4]), tf.x(c[5]), tf.y(c[6])] }); x = c[5]; y = c[6]; }
      else if (c[0] === 'Q') { // kvadratická → kubická
        const c1x = x + 2 / 3 * (c[1] - x), c1y = y + 2 / 3 * (c[2] - y), c2x = c[3] + 2 / 3 * (c[1] - c[3]), c2y = c[4] + 2 / 3 * (c[2] - c[4]);
        ops.push({ op: 'c', c: [tf.x(c1x), tf.y(c1y), tf.x(c2x), tf.y(c2y), tf.x(c[3]), tf.y(c[4])] }); x = c[3]; y = c[4];
      } else if (c[0] === 'Z') ops.push({ op: 'h', c: [] });
    }
    return ops;
  }
  function kresliCestu(doc, p, tf, vypln) {
    const ops = cestaOps(p, tf);
    if (!ops.length) return;
    doc.path(ops);
    if (vypln) doc.fill(); else doc.stroke();
  }
  function bezDiakritiky(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/[×]/g, 'x').replace(/[Ø]/g, 'O'); }

  /* Text pro pokyny na stránce (souřadnice stránky v mm; vel = výška verzálek). */
  function napis(doc, text, x, y, vel, tf, m = {}) {
    const prim = { t: 'text', x, y, text, vel, zarov: m.zarov || 'start', tucne: !!m.tucne, rot: m.rot || 0 };
    const pr = SP.textNaPrikazy(prim);
    if (pr) { kresliCestu(doc, pr, tf, true); return; }
    doc.setFontSize(vel / SP.vyskaVerzalekEm(null) * 72 / 25.4);
    doc.text(bezDiakritiky(text), tf.x(x), tf.y(y + vel / 2), { align: m.zarov === 'middle' ? 'center' : m.zarov === 'end' ? 'right' : 'left', angle: -(m.rot || 0) });
  }

  /* Primitivum návrhu do PDF. styl: {barva, tah (pro řez), krizky} */
  function kresliPrim(doc, q, tf, styl) {
    const [r, g, b] = barvaRgb(styl.barva);
    doc.setDrawColor(r, g, b); doc.setFillColor(r, g, b);
    const k = (tf.kx + tf.ky) / 2;
    const tah = q.role === 'cut' ? styl.tah : (q.tah || 0.1);
    doc.setLineWidth(Math.max(0.01, tah) * k);
    if (q.t === 'kruh') {
      const vypln = q.vypln && q.role !== 'cut';
      if (Math.abs(tf.kx - tf.ky) < 1e-9) doc.circle(tf.x(q.cx), tf.y(q.cy), q.r * tf.kx, vypln ? 'F' : 'S');
      else doc.ellipse(tf.x(q.cx), tf.y(q.cy), q.r * tf.kx, q.r * tf.ky, vypln ? 'F' : 'S');
      if (q.role === 'cut' && styl.krizky) {
        const d = q.r + 1.5;
        doc.setLineWidth(0.08 * k);
        doc.line(tf.x(q.cx - d), tf.y(q.cy), tf.x(q.cx + d), tf.y(q.cy));
        doc.line(tf.x(q.cx), tf.y(q.cy - d), tf.x(q.cx), tf.y(q.cy + d));
      }
    } else if (q.t === 'cesta') {
      kresliCestu(doc, q.p, tf, q.vypln && q.role !== 'cut');
      if (q.role === 'cut' && styl.krizky && !q.obrys) {
        const bb = SP.ohraniceniPrimitiv([q]);
        doc.setLineWidth(0.08 * k);
        doc.line(tf.x(bb.cx - 1.5), tf.y(bb.cy), tf.x(bb.cx + 1.5), tf.y(bb.cy));
        doc.line(tf.x(bb.cx), tf.y(bb.cy - 1.5), tf.x(bb.cx), tf.y(bb.cy + 1.5));
      }
    } else if (q.t === 'text') {
      const pr = SP.textNaPrikazy(q);
      if (pr) {
        kresliCestu(doc, pr, tf, true);
      } else {
        doc.setFontSize(SP.emProVel(q.vel, null) * 72 / 25.4 * tf.ky);
        doc.text(bezDiakritiky(q.text), tf.x(q.x), tf.y(q.y + q.vel / 2), { align: q.zarov === 'middle' ? 'center' : q.zarov === 'end' ? 'right' : 'left', angle: -(q.rot || 0) });
      }
    }
  }

  /* Vykreslí obsah návrhu (vybrané role) v transformaci tf. */
  function kresliNavrh(doc, proj, tf, m) {
    const prims = SP.vsechnaPrimitiva(proj, { n: m.n, datum: m.datum });
    doc.setLineCap('round'); doc.setLineJoin('round');
    for (const q of prims) {
      if (q.role === 'graf' && m.potisk) kresliPrim(doc, q, tf, { barva: m.barvaPotisku || '#000000' });
      else if (q.role === 'pom' && m.koty) kresliPrim(doc, q, tf, { barva: '#1f4fbf' });
      else if (q.role === 'cut' && m.rez && !(q.obrys && m.obrys === false)) kresliPrim(doc, q, tf, { barva: m.barvaRezu || '#d00000', tah: m.tahRezu || 0.15, krizky: m.krizky });
      else if (q.role === 'cut' && q.obrys && m.obrys) kresliPrim(doc, q, tf, { barva: '#888888', tah: 0.1 });
    }
  }

  /* Ořezové značky v rozích obdélníku (souřadnice stránky). */
  function orezZnacky(doc, x, y, w, h, tf) {
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.12);
    const d = 2, L = 5;
    for (const [cx, sx] of [[x, -1], [x + w, 1]]) for (const [cy, sy] of [[y, -1], [y + h, 1]]) {
      doc.line(tf.x(cx + sx * d), tf.y(cy), tf.x(cx + sx * (d + L)), tf.y(cy));
      doc.line(tf.x(cx), tf.y(cy + sy * d), tf.x(cx), tf.y(cy + sy * (d + L)));
    }
  }

  /* Kalibrační pravítko: vodorovné délky L (mm) od (x,y) nebo svislé. Popisky každých 10 mm. */
  function pravitko(doc, x, y, L, svisle, tf) {
    doc.setDrawColor(0, 0, 0); doc.setFillColor(0, 0, 0); doc.setLineCap('butt');
    doc.setLineWidth(0.15 * tf.kx);
    const P = (a, b) => svisle ? [x - b, y + a] : [x + a, y - b]; // a = podél, b = kolmo (od čáry ven)
    let p = P(0, 0), q = P(L, 0);
    doc.line(tf.x(p[0]), tf.y(p[1]), tf.x(q[0]), tf.y(q[1]));
    for (let i = 0; i <= L + 1e-9; i++) {
      const dl = i % 10 === 0 ? 3 : i % 5 === 0 ? 2 : 1.1;
      doc.setLineWidth((i % 10 === 0 ? 0.15 : 0.08) * tf.kx);
      p = P(i, 0); q = P(i, dl);
      doc.line(tf.x(p[0]), tf.y(p[1]), tf.x(q[0]), tf.y(q[1]));
      if (i % 10 === 0) {
        const t = P(i, 4.6);
        napis(doc, String(i), t[0], t[1], 1.6, tf, { zarov: 'middle', rot: svisle ? -90 : 0 });
      }
    }
  }

  function kalibracniPas(doc, sw, sh, tf, m = {}) {
    const Lh = Math.min(100, Math.floor((sw - OKRAJ.l - OKRAJ.r - 4) / 10) * 10);
    const Lv = Math.min(100, Math.floor((sh - OKRAJ.t - OKRAJ.b - 4) / 10) * 10);
    const yP = sh - OKRAJ.b + 9;
    pravitko(doc, OKRAJ.l, yP, Lh, false, tf);
    const xV = sw - OKRAJ.r + 9;
    pravitko(doc, xV, OKRAJ.t, Lv, true, tf);
    doc.setFillColor(0, 0, 0);
    napis(doc, `KONTROLA MĚŘÍTKA: vodorovná úsečka musí měřit přesně ${Lh} mm, svislá ${Lv} mm.`, OKRAJ.l, yP + 4, 2, tf, { tucne: true });
    napis(doc, 'Tiskněte se „Skutečnou velikostí / 100 %“ – volba „Přizpůsobit stránce“ návrh zmenší (typicky na 94–97 %).', OKRAJ.l, yP + 8, 1.7, tf);
    const kor = (Math.abs(tf.kx - 1) > 1e-9 || Math.abs(tf.ky - 1) > 1e-9) ? `Použita korekce tiskárny: X ${fmt(tf.kx * 100, 2)} %, Y ${fmt(tf.ky * 100, 2)} %.` : 'Korekce tiskárny: žádná.';
    napis(doc, kor + (m.poznamka ? '  ' + m.poznamka : ''), OKRAJ.l, yP + 11.6, 1.7, tf);
    return { Lh, Lv };
  }

  /* Výběr formátu stránky. Vrací {sw, sh, nazev}. */
  function zvolStranu(format, W, H, kalibrace) {
    const okr = kalibrace ? OKRAJ : { l: 10, t: 10, r: 10, b: 10 };
    const vejde = (sw, sh) => W <= sw - okr.l - okr.r + 1e-9 && H <= sh - okr.t - okr.b + 1e-9;
    if (format === 'panel') return { sw: W + 20, sh: H + 20, nazev: 'na míru', okr: { l: 10, t: 10, r: 10, b: 10 }, bezPravitka: true };
    const kand = format === 'auto' ? ['A4', 'A3'] : [format];
    for (const f of kand) {
      const [a, b] = FORMATY[f] || FORMATY.A4;
      if (vejde(a, b)) return { sw: a, sh: b, nazev: f, okr };
      if (vejde(b, a)) return { sw: b, sh: a, nazev: f + ' na šířku', okr };
    }
    // nevejde se – dlaždice na první formát, orientace s menším počtem stran
    const [a, b] = FORMATY[kand[0]] || FORMATY.A4;
    const nP = SP.dlazdice(W, H, a - okr.l - okr.r, b - okr.t - okr.b).dily.length;
    const nL = SP.dlazdice(W, H, b - okr.l - okr.r, a - okr.t - okr.b).dily.length;
    return nL < nP ? { sw: b, sh: a, nazev: kand[0] + ' na šířku', okr, dlazdice: true } : { sw: a, sh: b, nazev: kand[0], okr, dlazdice: true };
  }

  function novyDoc(jsPDF, sw, sh, m) {
    const doc = new jsPDF({ unit: 'mm', format: [sw, sh], orientation: sw > sh ? 'l' : 'p', compress: m.compress !== false });
    try { doc.viewerPreferences({ PrintScaling: 'None' }); } catch (e) { /* starší jsPDF */ }
    try { doc.setProperties({ title: m.titul || 'Panel 1:1', creator: 'Štítky a čelní panely', subject: 'Tisk v měřítku 1:1 – tiskněte se skutečnou velikostí (100 %)' }); } catch (e) { }
    return doc;
  }

  /* PDF panelu 1:1. m: {format:'A4'|'A3'|'A5'|'Letter'|'auto'|'panel', potisk, rez, krizky, koty, obrys, orez, kalibrace, zrcadlit, kx, ky, tabulka, prekryv, n, barvaPotisku, compress} */
  function pdfPanel(jsPDF, proj, m0 = {}) {
    const m = Object.assign({ format: 'auto', potisk: true, rez: true, krizky: true, koty: false, obrys: true, orez: true, kalibrace: true, zrcadlit: false, kx: 1, ky: 1, tabulka: true, prekryv: 10, n: 1, pocatek: 'lh' }, m0);
    const W = proj.panel.sirka, H = proj.panel.vyska;
    const st = zvolStranu(m.format, W, H, m.kalibrace);
    const okr = st.okr, uw = st.sw - okr.l - okr.r, uh = st.sh - okr.t - okr.b;
    const dl = st.dlazdice ? SP.dlazdice(W, H, uw, uh, m.prekryv) : { nx: 1, ny: 1, dily: [{ s: 0, r: 0, x0: 0, y0: 0, w: W, h: H }] };
    const doc = novyDoc(jsPDF, st.sw, st.sh, { compress: m.compress, titul: (proj.panel.nazev || 'Panel') + ' – 1:1' });
    const ts = tfStrana(m.kx, m.ky);
    dl.dily.forEach((d, i) => {
      if (i > 0) doc.addPage([st.sw, st.sh], st.sw > st.sh ? 'l' : 'p');
      // umístění: jedna strana → panel na střed užitné plochy; dlaždice → od levého horního rohu
      const ox = st.dlazdice ? okr.l : okr.l + (uw - W) / 2, oy = st.dlazdice ? okr.t : okr.t + (uh - H) / 2;
      const tf = tfNovy({ ox, oy, W, zrcadlit: m.zrcadlit, kx: m.kx, ky: m.ky, x0: d.x0, y0: d.y0 });
      doc.saveGraphicsState();
      if (st.dlazdice) { doc.rect(ts.x(ox), ts.y(oy), d.w * m.kx, d.h * m.ky, null); doc.clip(); doc.discardPath(); }
      kresliNavrh(doc, proj, tf, m);
      doc.restoreGraphicsState();
      if (m.orez && !st.dlazdice) orezZnacky(doc, ox, oy, W, H, ts);
      if (st.dlazdice) {
        // hranice překryvu (čárkovaně) a značky pro slícování
        doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.1); doc.setLineDashPattern([1.5, 1.5], 0);
        if (d.s < dl.nx - 1) doc.line(ts.x(ox + d.w - m.prekryv), ts.y(oy), ts.x(ox + d.w - m.prekryv), ts.y(oy + d.h));
        if (d.r < dl.ny - 1) doc.line(ts.x(ox), ts.y(oy + d.h - m.prekryv), ts.x(ox + d.w), ts.y(oy + d.h - m.prekryv));
        doc.setLineDashPattern([], 0);
        doc.setDrawColor(0, 0, 0); doc.rect(ts.x(ox), ts.y(oy), d.w * m.kx, d.h * m.ky, 'S');
        doc.setFillColor(0, 0, 0);
        napis(doc, `Díl ${i + 1}/${dl.dily.length} – sloupec ${d.s + 1}, řádek ${d.r + 1}; výřez x ${fmt(d.x0)}–${fmt(d.x0 + d.w)} mm, y ${fmt(d.y0)}–${fmt(d.y0 + d.h)} mm; překryv ${fmt(m.prekryv)} mm (čárkovaně).`, okr.l, okr.t - 4, 1.8, ts);
      } else {
        doc.setFillColor(0, 0, 0);
        napis(doc, `${proj.panel.nazev || 'Panel'} – ${fmt(W)} × ${fmt(H)} mm, měřítko 1:1${m.zrcadlit ? ', ZRCADLENĚ' : ''}`, okr.l, okr.t - 4.5, 2, ts, { tucne: true });
      }
      if (m.kalibrace && !st.bezPravitka) kalibracniPas(doc, st.sw, st.sh, ts);
    });
    if (m.tabulka) {
      const rady = SP.tabulkaOtvoru(proj, m.pocatek);
      if (rady.length) tabulkaStrany(doc, rady, proj, m);
    }
    return { doc, info: { format: st.nazev, sw: st.sw, sh: st.sh, stran: doc.getNumberOfPages(), dlazdic: dl.dily.length, nx: dl.nx, ny: dl.ny } };
  }

  function tabulkaStrany(doc, rady, proj, m) {
    const sw = 210, sh = 297, ts = tfStrana(1, 1), rv = 5.2;
    const sloupce = [{ t: 'č.', x: 12, w: 10 }, { t: 'Prvek', x: 22, w: 92 }, { t: 'X (mm)', x: 128, z: 'end' }, { t: 'Y (mm)', x: 152, z: 'end' }, { t: 'Rozměr', x: 158 }];
    const pocNazev = { lh: 'levý horní roh, y dolů', ld: 'levý dolní roh, y nahoru', stred: 'střed panelu, y nahoru' }[m.pocatek || 'lh'];
    let y = 0, str = 0;
    const hlavicka = () => {
      doc.addPage([sw, sh], 'p'); str++;
      doc.setFillColor(0, 0, 0);
      napis(doc, `Tabulka otvorů – ${proj.panel.nazev || 'panel'} ${fmt(proj.panel.sirka)} × ${fmt(proj.panel.vyska)} mm` + (str > 1 ? ` (pokračování ${str})` : ''), 12, 14, 3, ts, { tucne: true });
      napis(doc, `Souřadnice středů, počátek: ${pocNazev}. Rozměry v mm.`, 12, 20, 2, ts);
      y = 30;
      for (const s of sloupce) napis(doc, s.t, s.z === 'end' ? s.x : s.x, y, 2, ts, { tucne: true, zarov: s.z || 'start' });
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2); doc.line(12, y + 2.4, 198, y + 2.4);
      y += rv + 1;
    };
    hlavicka();
    for (const r of rady) {
      if (y > sh - 15) hlavicka();
      const nazev = r.nazev.length > 52 ? r.nazev.slice(0, 50) + '…' : r.nazev;
      const hod = [String(r.c), nazev, fmt(r.x, 2, false), fmt(r.y, 2, false), r.rozmer];
      sloupce.forEach((s, i) => napis(doc, hod[i], s.x, y, 1.9, ts, { zarov: s.z || 'start' }));
      doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.1); doc.line(12, y + 2.4, 198, y + 2.4);
      y += rv;
    }
  }

  /* Arch samolepek: návrh se opakuje do pozic archu (1:1, na střed štítku), s pořadovým číslem {n}. */
  function pdfArch(jsPDF, proj, arch, m0 = {}) {
    const m = Object.assign({ start: 0, pocet: Infinity, nOd: 1, obrysStitku: false, orezat: true, kx: 1, ky: 1, potisk: true, rez: false, obrys: false, compress: true, sw: 210, sh: 297 }, m0);
    const doc = novyDoc(jsPDF, m.sw, m.sh, { compress: m.compress, titul: 'Arch samolepek – ' + arch.nazev });
    const ts = tfStrana(m.kx, m.ky);
    const W = proj.panel.sirka, H = proj.panel.vyska;
    const poz = SP.archPozice(arch, m.start, m.pocet);
    poz.forEach((p, i) => {
      const ox = p.x + (p.w - W) / 2, oy = p.y + (p.h - H) / 2;
      const tf = tfNovy({ ox, oy, W, kx: m.kx, ky: m.ky });
      doc.saveGraphicsState();
      if (m.orezat) { doc.rect(ts.x(p.x), ts.y(p.y), p.w * m.kx, p.h * m.ky, null); doc.clip(); doc.discardPath(); }
      kresliNavrh(doc, proj, tf, Object.assign({}, m, { n: m.nOd + i, krizky: false }));
      doc.restoreGraphicsState();
      if (m.obrysStitku) {
        doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.1); doc.setLineDashPattern([1, 1], 0);
        doc.rect(ts.x(p.x), ts.y(p.y), p.w * m.kx, p.h * m.ky, 'S');
        doc.setLineDashPattern([], 0);
      }
    });
    const varovani = [];
    if (W > arch.w + 1e-6 || H > arch.h + 1e-6) varovani.push(`Návrh (${fmt(W)} × ${fmt(H)} mm) je větší než štítek (${fmt(arch.w)} × ${fmt(arch.h)} mm) – okraje se oříznou.`);
    return { doc, info: { stitku: poz.length, stran: 1, varovani } };
  }

  /* Samostatný kalibrační list A4. */
  function pdfKalibrace(jsPDF, m0 = {}) {
    const m = Object.assign({ kx: 1, ky: 1, compress: true }, m0);
    const doc = novyDoc(jsPDF, 210, 297, { compress: m.compress, titul: 'Kalibrační list 1:1' });
    const ts = tfStrana(m.kx, m.ky);
    doc.setFillColor(0, 0, 0);
    napis(doc, 'Kalibrační list – kontrola měřítka tisku', 12, 16, 4, ts, { tucne: true });
    const radky = [
      '1. Vytiskněte s volbou „Skutečná velikost“ / „Měřítko 100 %“ (ne „Přizpůsobit stránce“).',
      '2. Pravítkem nebo posuvkou změřte úsečky 150 mm (vodorovně) a 250 mm (svisle).',
      '3. Naměřené hodnoty zadejte v editoru v části Kontrola měřítka – spočítá korekci tiskárny.',
      '4. Čtverec 50 × 50 mm ověřuje, že tiskárna netiskne každou osu jinak.',
    ];
    radky.forEach((t, i) => napis(doc, t, 12, 26 + i * 6, 2.2, ts));
    // dlouhé úsečky pro přesnější měření
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2);
    pravitko(doc, 30, 70, 150, false, ts);
    pravitko(doc, 195, 25, 250, true, ts);
    doc.setLineWidth(0.25); doc.rect(ts.x(40), ts.y(100), 50 * m.kx, 50 * m.ky, 'S');
    napis(doc, 'čtverec 50 × 50 mm', 65, 155, 2, ts, { zarov: 'middle' });
    // kružnice Ø 50 – kontrola kruhovitosti
    doc.circle(ts.x(140), ts.y(125), 25 * m.kx, 'S');
    napis(doc, 'kružnice Ø 50 mm', 140, 155, 2, ts, { zarov: 'middle' });
    const kor = (Math.abs(m.kx - 1) > 1e-9 || Math.abs(m.ky - 1) > 1e-9) ? `Použita korekce: X ${fmt(m.kx * 100, 2)} %, Y ${fmt(m.ky * 100, 2)} %.` : 'Bez korekce tiskárny.';
    napis(doc, kor, 12, 170, 2.2, ts);
    return { doc };
  }

  const API = { FORMATY, OKRAJ, tfNovy, tfStrana, cestaOps, kresliPrim, kresliNavrh, pravitko, zvolStranu, pdfPanel, pdfArch, pdfKalibrace, bezDiakritiky };
  if (typeof module !== 'undefined') module.exports = API; else window.SP_PDF = API;
})();

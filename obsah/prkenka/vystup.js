/* ============================================================
   Prkénka – výstupy: šablona obrysu (SVG 1:1, DXF R12 po vrstvách), PDF postupu (jsPDF předaný parametrem)
   Šablona: souřadnice prkénka x → vpravo, y → nahoru (DXF), v SVG/PDF osa y dolů.
   ============================================================ */
(function (koren) {
  'use strict';
  const J = koren.PKJ || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const K = koren.PKK || (typeof require !== 'undefined' ? require('./kresba.js') : null);
  const fmt = J.fmt;
  const n3 = (x) => { const v = Math.round(x * 1000) / 1000; return Number.isFinite(v) ? String(v) : '0'; };

  /* ---------- scéna šablony 1:1 ---------- */
  function scenaSablony(v, o) {
    o = o || {};
    const D = v.dokonceni, p = v.p, L = D.L, W = D.W, prvky = [];
    const X = (x) => x, Y = (y) => W - y, tr = (P) => P.map((q) => [X(q[0]), Y(q[1])]);
    prvky.push({ t: 'l', b: tr(D.obrys), z: true, s: 0.35, c: '#000000', v: 'obrys' });
    if (p.hranaTyp !== 'zadna' && p.hrana > 0) prvky.push({ t: 'l', b: tr(J.zaoblenyObdelnik(p.hrana, p.hrana, L - p.hrana, W - p.hrana, Math.max(0, D.rohR - p.hrana))), z: true, s: 0.15, c: '#777777', d: true, v: 'hrana' });
    if (D.drazka) {
      prvky.push({ t: 'l', b: tr(D.drazka.vnejsi), z: true, s: 0.25, c: '#000000', v: 'drazka' });
      prvky.push({ t: 'l', b: tr(D.drazka.vnitrni), z: true, s: 0.25, c: '#000000', v: 'drazka' });
      prvky.push({ t: 'l', b: tr(D.drazka.osa), z: true, s: 0.2, c: '#b3261e', d: true, v: 'drazkaOsa' });
      const e = D.drazka.odstupOsy;
      prvky.push({ t: 'txt', x: X(L / 2), y: Y(e) - 1.5 - p.drazkaSirka / 2, h: 3, txt: `šťávová drážka ${fmt(p.drazkaSirka)} × ${fmt(p.drazkaHloubka)} mm, osa ${fmt(e)} mm od hrany (červeně = dráha středu frézy)`, a: 'c', c: '#000000', v: 'text' });
    }
    for (const n of D.nozicky) {
      prvky.push({ t: 'k', x: X(n.x), y: Y(n.y), r: n.r, s: 0.2, c: '#1f5fa8', d: true, v: 'nozicka' });
      prvky.push({ t: 'l', b: [[X(n.x) - 3, Y(n.y)], [X(n.x) + 3, Y(n.y)]], s: 0.2, c: '#1f5fa8', v: 'nozicka' });
      prvky.push({ t: 'l', b: [[X(n.x), Y(n.y) - 3], [X(n.x), Y(n.y) + 3]], s: 0.2, c: '#1f5fa8', v: 'nozicka' });
    }
    if (D.nozicky.length) prvky.push({ t: 'txt', x: X(D.nozicky[0].x) + D.nozicky[0].r + 2, y: Y(D.nozicky[0].y) + 1, h: 2.6, txt: `nožička Ø ${fmt(p.nozickyPrumer)} (zespodu)`, a: 'l', c: '#1f5fa8', v: 'text' });
    for (const U of D.uchyty || []) prvky.push({ t: 'l', b: tr(U), z: true, s: 0.25, c: '#1f5fa8', d: true, v: 'uchyt' });
    if (D.uchyty) prvky.push({ t: 'txt', x: X(p.uchytHloubka + 2), y: Y(W / 2) + 1, h: 2.6, txt: `úchyt zespodu ${fmt(p.uchytDelka)} × ${fmt(p.uchytHloubka)}, výška ${fmt(p.uchytVyska)}`, a: 'l', c: '#1f5fa8', v: 'text' });
    if (D.otvor) {
      prvky.push({ t: 'k', x: X(D.otvor.x), y: Y(D.otvor.y), r: D.otvor.r, s: 0.3, c: '#000000', v: 'otvor' });
      prvky.push({ t: 'l', b: [[X(D.otvor.x) - 4, Y(D.otvor.y)], [X(D.otvor.x) + 4, Y(D.otvor.y)]], s: 0.2, c: '#000000', v: 'otvor' });
      prvky.push({ t: 'l', b: [[X(D.otvor.x), Y(D.otvor.y) - 4], [X(D.otvor.x), Y(D.otvor.y) + 4]], s: 0.2, c: '#000000', v: 'otvor' });
    }
    // osy
    prvky.push({ t: 'l', b: [[X(L / 2), Y(-4)], [X(L / 2), Y(W + 4)]], s: 0.13, c: '#888888', d: true, v: 'osa' });
    prvky.push({ t: 'l', b: [[X(-4), Y(W / 2)], [X(L + 4), Y(W / 2)]], s: 0.13, c: '#888888', d: true, v: 'osa' });
    prvky.push({ t: 'txt', x: X(4), y: Y(W) + 6 + (D.drazka ? 0 : 0), h: 3, txt: o.nadpis || v.nazev, a: 'l', c: '#000000', v: 'text' });
    K.kotaDoSceny(prvky, [X(0), Y(0)], [X(L), Y(0)], -10, fmt(L), 3);
    K.kotaDoSceny(prvky, [X(L), Y(0)], [X(L), Y(W)], 10, fmt(W), 3);
    if (D.rohR > 0) prvky.push({ t: 'txt', x: X(L - D.rohR), y: Y(W) - 2, h: 2.6, txt: 'R ' + fmt(D.rohR), a: 'c', c: '#1f5fa8', v: 'kota' });
    return { x0: -8, y0: -6, w: L + 30, h: W + 22, prvky };
  }

  /* ---------- SVG / DXF obrysu ---------- */
  function svgSablony(v) {
    const sc = scenaSablony(v);
    // svg z kresby, ale v mm (1:1) a s vrstvami podle e.v
    const s = K.svg(sc, { mm: true });
    return s.replace('<svg ', '<svg data-meritko="1:1" ');
  }
  /** jen obrysy pro frézku / laser: obrys, osa drážky, otvory – y nahoru převedeno do SVG (y dolů) */
  function svgCnc(v) {
    const D = v.dokonceni, W = D.W, L = D.L;
    const cesta = (P) => P.map((q, i) => (i ? 'L' : 'M') + n3(q[0]) + ' ' + n3(W - q[1])).join('') + 'Z';
    const g = [];
    g.push(`<g id="OBRYS" fill="none" stroke="#000000" stroke-width="0.2"><path d="${cesta(D.obrys)}"/></g>`);
    if (D.drazka) g.push(`<g id="DRAZKA_OSA" fill="none" stroke="#ff0000" stroke-width="0.2"><path d="${cesta(D.drazka.osa)}"/></g><g id="DRAZKA_HRANY" fill="none" stroke="#0000ff" stroke-width="0.2"><path d="${cesta(D.drazka.vnejsi)}"/><path d="${cesta(D.drazka.vnitrni)}"/></g>`);
    if (D.nozicky.length) g.push(`<g id="NOZICKY" fill="none" stroke="#00a000" stroke-width="0.2">${D.nozicky.map((n) => `<circle cx="${n3(n.x)}" cy="${n3(W - n.y)}" r="${n3(n.r)}"/><circle cx="${n3(n.x)}" cy="${n3(W - n.y)}" r="1.5"/>`).join('')}</g>`);
    if (D.uchyty) g.push(`<g id="UCHYTY" fill="none" stroke="#00a0a0" stroke-width="0.2">${D.uchyty.map((U) => `<path d="${cesta(U)}"/>`).join('')}</g>`);
    if (D.otvor) g.push(`<g id="OTVOR" fill="none" stroke="#000000" stroke-width="0.2"><circle cx="${n3(D.otvor.x)}" cy="${n3(W - D.otvor.y)}" r="${n3(D.otvor.r)}"/></g>`);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${n3(L)}mm" height="${n3(W)}mm" viewBox="0 0 ${n3(L)} ${n3(W)}">${g.join('')}</svg>`;
  }
  function dxf(v) {
    const D = v.dokonceni, L = [], g = (k, h) => { L.push(String(k)); L.push(String(h)); };
    const VRSTVY = [['OBRYS', 7], ['DRAZKA_OSA', 1], ['DRAZKA_HRANY', 5], ['ZKOSENI', 8], ['NOZICKY', 3], ['UCHYTY', 4], ['OTVOR', 7], ['TEXT', 7]];
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, VRSTVY.length);
    for (const [n, c] of VRSTVY) { g(0, 'LAYER'); g(2, n); g(70, 0); g(62, c); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    const poly = (P, vr) => { g(0, 'POLYLINE'); g(8, vr); g(66, 1); g(70, 1); for (const q of P) { g(0, 'VERTEX'); g(8, vr); g(10, n3(q[0])); g(20, n3(q[1])); g(30, 0); } g(0, 'SEQEND'); g(8, vr); };
    const kruh = (x, y, r, vr) => { g(0, 'CIRCLE'); g(8, vr); g(10, n3(x)); g(20, n3(y)); g(30, 0); g(40, n3(r)); };
    const text = (x, y, h, t, vr) => { g(0, 'TEXT'); g(8, vr); g(10, n3(x)); g(20, n3(y)); g(30, 0); g(40, n3(h)); g(1, J.bezDiakritiky ? t : String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '')); };
    poly(D.obrys, 'OBRYS');
    const p = v.p;
    if (p.hranaTyp !== 'zadna' && p.hrana > 0) poly(J.zaoblenyObdelnik(p.hrana, p.hrana, D.L - p.hrana, D.W - p.hrana, Math.max(0, D.rohR - p.hrana)), 'ZKOSENI');
    if (D.drazka) { poly(D.drazka.osa, 'DRAZKA_OSA'); poly(D.drazka.vnejsi, 'DRAZKA_HRANY'); poly(D.drazka.vnitrni, 'DRAZKA_HRANY'); }
    for (const n of D.nozicky) { kruh(n.x, n.y, n.r, 'NOZICKY'); kruh(n.x, n.y, 1.5, 'NOZICKY'); }
    for (const U of D.uchyty || []) poly(U, 'UCHYTY');
    if (D.otvor) kruh(D.otvor.x, D.otvor.y, D.otvor.r, 'OTVOR');
    text(0, D.W + 6, 4, v.nazev, 'TEXT');
    g(0, 'ENDSEC'); g(0, 'EOF');
    return L.join('\r\n') + '\r\n';
  }

  /* ---------- dělení na listy ---------- */
  const PATA = 13, PRAVY = 9;
  function rozvrhListu(sc, pw, ph, okraj, prekryv) {
    const varianta = (W, H) => {
      const uw = W - 2 * okraj - PRAVY, uh = H - 2 * okraj - PATA;
      if (sc.w <= uw + 1e-6 && sc.h <= uh + 1e-6) return { W, H, uw, uh, nx: 1, ny: 1, jeden: true };
      const g = Math.min(prekryv, uw / 3, uh / 3);
      const nx = Math.max(1, Math.ceil((sc.w - g) / (uw - g) - 1e-9)), ny = Math.max(1, Math.ceil((sc.h - g) / (uh - g) - 1e-9));
      return { W, H, uw, uh, nx, ny, g, jeden: false };
    };
    const a = varianta(pw, ph), b = varianta(ph, pw);
    const v = b.nx * b.ny < a.nx * a.ny ? b : a;
    const listy = [];
    if (v.jeden) listy.push({ sx: sc.x0 - (v.uw - sc.w) / 2, sy: sc.y0 - (v.uh - sc.h) / 2, r: 0, c: 0 });
    else {
      const cw = v.nx * (v.uw - v.g) + v.g, chh = v.ny * (v.uh - v.g) + v.g;
      const ox = sc.x0 - (cw - sc.w) / 2, oy = sc.y0 - (chh - sc.h) / 2;
      for (let r = 0; r < v.ny; r++) for (let c = 0; c < v.nx; c++) listy.push({ sx: ox + c * (v.uw - v.g), sy: oy + r * (v.uh - v.g), r, c });
    }
    return Object.assign(v, { listy });
  }

  /* ---------- PDF ---------- */
  const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/·/g, '-').replace(/[„“]/g, '"').replace(/°/g, ' st.').replace(/×/g, 'x').replace(/[◇Ø]/g, 'o').replace(/[^\x20-\x7e]/g, '');
  const bezchyb = (s) => String(s).replace(/◇/g, '').replace(/[⌀]/g, 'Ø').replace(/✂/g, '');
  function rgb(hex) { const v = parseInt(String(hex || '#000000').slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }

  /**
   * v = výsledek J.spocitej, o: {papir:[w,h], okraj, prekryv, pismo (TTF base64), texty (princip: [řádky])}
   * Vrací jsPDF dokument.
   */
  function pdf(jsPDF, v, o) {
    o = Object.assign({ papir: [210, 297], okraj: 10, prekryv: 12 }, o || {});
    const [pw, ph] = o.papir, ok = o.okraj;
    let doc = null, uni = false;
    const T = (s) => (uni ? bezchyb(s) : bezDiakritiky(s));
    const nova = (W, H) => {
      if (doc) { doc.addPage([W, H], W > H ? 'l' : 'p'); return; }
      doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: W > H ? 'l' : 'p', compress: o.compress !== false });
      if (o.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
      doc.setProperties({ title: v.nazev, creator: 'Prkénka a lepené vzory' });
    };
    const text = (t, x, y, h, a, c, u) => {
      doc.setFont(uni ? 'LS' : 'helvetica', 'normal'); doc.setFontSize(h / 0.3528); doc.setTextColor(...rgb(c));
      const s = T(t), w = doc.getTextWidth(s), k = a === 'r' ? w : a === 'c' ? w / 2 : 0;
      if (u) doc.text(s, x, y, { angle: u }); else doc.text(s, x - k, y);
    };
    const gs = (op) => { try { doc.setGState(new doc.GState({ opacity: op })); } catch (e) { /* bez průhlednosti */ } };
    const kresli = (sc, X, Y, k) => {
      for (const e of sc.prvky) {
        if (e.t === 'p') {
          const b = e.b.map((q) => [X(q[0]), Y(q[1])]);
          const seg = []; for (let i = 1; i < b.length; i++) seg.push([b[i][0] - b[i - 1][0], b[i][1] - b[i - 1][1]]);
          if (!seg.length) continue;
          doc.setFillColor(...rgb(e.f)); doc.setDrawColor(...rgb(e.c || e.f)); doc.setLineWidth(Math.max(0.05, (e.s || 0.1) * Math.min(1, k)));
          if (e.o !== undefined && e.o < 1) gs(e.o);
          doc.lines(seg, b[0][0], b[0][1], [1, 1], e.c ? 'FD' : 'F', true);
          if (e.o !== undefined && e.o < 1) gs(1);
          // pruhy vláken (jen bok, zjednodušeně) – nevykreslují se kvůli velikosti PDF
        } else if (e.t === 'l') {
          const b = e.b.map((q) => [X(q[0]), Y(q[1])]);
          const seg = []; for (let i = 1; i < b.length; i++) seg.push([b[i][0] - b[i - 1][0], b[i][1] - b[i - 1][1]]);
          if (!seg.length) continue;
          doc.setDrawColor(...rgb(e.c)); doc.setLineWidth(Math.max(0.05, (e.s || 0.25) * Math.min(1, Math.max(k, 0.5))));
          if (e.d) doc.setLineDashPattern([1.6, 1.1], 0);
          doc.lines(seg, b[0][0], b[0][1], [1, 1], 'S', !!e.z);
          if (e.d) doc.setLineDashPattern([], 0);
        } else if (e.t === 'k') {
          doc.setDrawColor(...rgb(e.c)); doc.setLineWidth(Math.max(0.05, (e.s || 0.25) * Math.min(1, Math.max(k, 0.5))));
          if (e.d) doc.setLineDashPattern([1.4, 1], 0);
          if (e.f) { doc.setFillColor(...rgb(e.f)); doc.circle(X(e.x), Y(e.y), e.r * k, 'FD'); } else doc.circle(X(e.x), Y(e.y), e.r * k, 'S');
          if (e.d) doc.setLineDashPattern([], 0);
        } else if (e.t === 'txt') text(e.txt, X(e.x), Y(e.y), Math.max(1.6, e.h * k), e.a, e.c, e.u);
      }
    };
    const meritka = (W, H) => {
      // vodorovně 100 mm (dílky po 10, výrazně 50) v patě, svisle 100 mm v pravém pásu
      const y = H - ok - 3, x0 = ok;
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25);
      doc.line(x0, y, x0 + 100, y);
      for (let i = 0; i <= 10; i++) doc.line(x0 + i * 10, y, x0 + i * 10, y - (i % 5 ? 1.5 : 3));
      text('0', x0, y - 3.6, 2, 'c'); text('50', x0 + 50, y - 3.6, 2, 'c'); text('100 mm', x0 + 100, y - 3.6, 2, 'c');
      text('Kontrola: úsečky 50 a 100 mm vodorovně i svisle; tisk 100 %.', x0 + 107, y - 1.2, 2.2, 'l');
      const xs = W - ok - 2, ys = ok;
      doc.line(xs, ys, xs, ys + 100);
      for (let i = 0; i <= 10; i++) doc.line(xs, ys + i * 10, xs - (i % 5 ? 1.5 : 3), ys + i * 10);
      text('0', xs - 3.6, ys + 0.8, 2, 'r'); text('50', xs - 3.6, ys + 50.7, 2, 'r'); text('100', xs - 3.6, ys + 100.7, 2, 'r');
    };
    const odstavce = (radky, y, sirka, x) => {
      x = x === undefined ? ok : x;
      for (const r of radky) {
        const tucne = r.startsWith('# '), t = tucne ? r.slice(2) : r, vel = tucne ? 3.8 : 3;
        doc.setFont(uni ? 'LS' : 'helvetica', 'normal'); doc.setFontSize(vel / 0.3528);
        for (const rr of doc.splitTextToSize(T(t), sirka)) {
          if (y > ph - ok - 8) { nova(pw, ph); y = ok + 6; }
          doc.setFontSize(vel / 0.3528); doc.setTextColor(0, 0, 0); doc.text(rr, x, y); y += vel * 1.45;
        }
        y += tucne ? 0.8 : 1;
      }
      return y;
    };
    const tabulka = (tb, y) => {
      const vel = 2.8;
      const radek = (bunky, tuc) => {
        if (y > ph - ok - 10) { nova(pw, ph); y = ok + 6; }
        let x = ok;
        bunky.forEach((b, i) => { text(String(b), x + (tb.sloupce[i] === 'r' ? tb.sirky[i] - 1 : 0), y, vel, tb.sloupce[i] === 'r' ? 'r' : 'l', tuc ? '#000000' : '#222222'); x += tb.sirky[i]; });
        doc.setDrawColor(190, 190, 190); doc.setLineWidth(0.15); doc.line(ok, y + 1.6, ok + tb.sirky.reduce((a, b) => a + b, 0), y + 1.6);
        y += vel * 1.75;
      };
      radek(tb.hlavicka, true); for (const r of tb.radky) radek(r, false);
      return y + 4;
    };
    const zmensene = (sc, y, maxH) => {
      const k = Math.min(1, (pw - 2 * ok) / sc.w, maxH / sc.h);
      const X = (x) => ok + (x - sc.x0) * k, Y = (yy) => y + (yy - sc.y0) * k;
      kresli(sc, X, Y, k);
      return y + sc.h * k + 3;
    };

    /* 1) titulní list */
    nova(pw, ph);
    let y = ok + 6;
    const p = v.p, D = J.DREVINY;
    text(v.nazev, ok, y, 5.2, 'l'); y += 8;
    y = odstavce([
      `Dřeviny: A ${D[p.drevA].nazev}, B ${D[p.drevB].nazev}, C ${D[p.drevC].nazev}. Hotový rozměr ${fmt(v.rozmer.L)} × ${fmt(v.rozmer.W)} × ${fmt(v.rozmer.T)} mm, hmotnost asi ${fmt(v.hmotnost.kg, 2)} kg (průměrná hustota ${fmt(v.hmotnost.hustota, 0)} kg/m³ – typické hodnoty).`,
      `Řez kotoučem ${fmt(p.kerf, 1)} mm · hoblování panelu ${fmt(p.uberPanel)} mm · závěrečné broušení ${fmt(p.uberFinal)} mm · zarovnání konců ${fmt(p.orezKonce)} mm · kusů: ${p.pocetKusu}.`,
      ...Object.entries(v.info).map(([a, b]) => `${a}: ${b}`),
    ], y, pw - 2 * ok);
    y += 2; text('Řezný seznam (hrubé rozměry)', ok, y, 3.8, 'l'); y += 6;
    y = tabulka({ hlavicka: ['Poz.', 'Díl', 'Dřevina', 'Ks', 'Tl. × šířka × délka', 'dm³'], sloupce: ['l', 'l', 'l', 'r', 'l', 'r'], sirky: [10, 52, 38, 10, 52, 18],
      radky: v.rezny.map((r, i) => [i + 1, r.nazev, `${r.slot}: ${D[r.drevina].nazev}`, r.ks, `${fmt(r.tl, 1)} × ${fmt(r.sir, 1)} × ${fmt(r.del, 0)}`, fmt(r.objem * 1000, 2)]) }, y);
    text('Materiál podle dřevin', ok, y, 3.8, 'l'); y += 6;
    y = tabulka({ hlavicka: ['Poz.', 'Dřevina', 'Délka lišt m', 'Objem dm³', 's prořezem', 'kg'], sloupce: ['l', 'l', 'r', 'r', 'r', 'r'], sirky: [12, 60, 26, 24, 26, 20],
      radky: Object.values(v.material).map((m) => [m.slot, D[m.drevina].nazev, fmt(m.delka, 2), fmt(m.objem * 1000, 2), fmt(m.nakup * 1000, 2), fmt(m.hmotnost, 2)]) }, y);
    if (v.varovani.length) { y = odstavce(['# Kontrola návrhu', ...v.varovani.map((q) => (q.uroven === 'chyba' ? '!! ' : q.uroven === 'varovani' ? '! ' : '') + q.text)], y, pw - 2 * ok); }
    if (y + 62 > ph - ok) { nova(pw, ph); y = ok + 6; }
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25); doc.rect(ok, y + 2, 50, 50, 'S');
    text('50 × 50 mm', ok + 25, y + 28, 4, 'c');
    text('Kontrolní čtverec: po tisku musí mít přesně 50 mm.', ok + 55, y + 28, 3, 'l');

    /* 2) hotové prkénko */
    nova(pw, ph); y = ok + 6;
    text('Hotové prkénko', ok, y, 5, 'l'); y += 6;
    y = zmensene(K.scenaHotova(v, { textury: false }), y, ph - y - ok - 20);
    text('Zmenšeno – jen pro orientaci; šablona obrysu 1:1 je na dalších listech.', ok, y + 2, 2.6, 'l', '#555555');

    /* 3) kroky */
    for (const kr of v.kroky) {
      nova(pw, ph); y = ok + 6;
      text(`Krok ${kr.n}: ${kr.nazev}`, ok, y, 5, 'l'); y += 6;
      const sc = K.scenaKroku(v, kr, { textury: false, dokonceni: kr.dokonceni ? v.dokonceni : null });
      y = zmensene(sc, y, (ph - 2 * ok) * 0.58);
      y = odstavce(kr.text, y + 2, pw - 2 * ok);
      if (kr.bezpecnost) y = odstavce(['Bezpečnost: krátké kusy řezat na přířezných saních s upnutým dorazem před kotoučem, používat posunovač a přítlak; ruce nikdy v ose kotouče, ochranný kryt a rozvírací klín na místě.'], y, pw - 2 * ok);
    }

    /* 4) šablona 1:1 */
    const sc = scenaSablony(v), rv = rozvrhListu(sc, pw, ph, ok, o.prekryv), N = rv.listy.length;
    for (const l of rv.listy) {
      nova(rv.W, rv.H);
      const X = (x) => ok + (x - l.sx), Y = (yy) => ok + (yy - l.sy);
      doc.saveGraphicsState(); doc.rect(ok, ok, rv.uw, rv.uh, null); doc.clip(); doc.discardPath();
      kresli(sc, X, Y, 1);
      doc.restoreGraphicsState();
      if (!rv.jeden) {
        doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.2); doc.setLineDashPattern([2, 1.5], 0);
        if (l.c < rv.nx - 1) doc.line(ok + rv.uw - rv.g, ok, ok + rv.uw - rv.g, ok + rv.uh);
        if (l.r < rv.ny - 1) doc.line(ok, ok + rv.uh - rv.g, ok + rv.uw, ok + rv.uh - rv.g);
        doc.setLineDashPattern([], 0);
        doc.setDrawColor(0, 0, 0);
        for (const [x, yy] of [[ok, ok], [ok + rv.uw, ok], [ok, ok + rv.uh], [ok + rv.uw, ok + rv.uh]]) { doc.line(x - 3, yy, x + 3, yy); doc.line(x, yy - 3, x, yy + 3); }
        if (l.c > 0 || l.r > 0) text('ořízněte ' + (l.c > 0 ? 'levý' : '') + (l.c > 0 && l.r > 0 ? ' a ' : '') + (l.r > 0 ? 'horní' : '') + ' okraj a přiložte na čárkovanou čáru sousedního listu', ok + 2, ok - 2.4, 2.4, 'l', '#555555');
      }
      text(`Šablona obrysu 1:1 · ${v.nazev}${N > 1 ? ` · list ${l.r * rv.nx + l.c + 1}/${N} (řádek ${l.r + 1}, sloupec ${l.c + 1})` : ''}`, ok, rv.H - ok - 8.5, 2.6, 'l');
      meritka(rv.W, rv.H);
      if (N > 1) {
        const mx = rv.W - ok - PRAVY - 3 * rv.nx - 2, my = rv.H - ok - 12;
        doc.setLineWidth(0.15);
        for (let r = 0; r < rv.ny; r++) for (let c = 0; c < rv.nx; c++) { if (r === l.r && c === l.c) { doc.setFillColor(80, 80, 80); doc.rect(mx + c * 3, my + r * 3, 2.6, 2.6, 'FD'); } else doc.rect(mx + c * 3, my + r * 3, 2.6, 2.6, 'S'); }
      }
    }

    /* 5) jak to funguje */
    if (o.texty && o.texty.length) { nova(pw, ph); y = ok + 6; text('Jak to funguje', ok, y, 5, 'l'); y += 8; odstavce(o.texty, y, pw - 2 * ok); }
    return doc;
  }

  const API = { scenaSablony, svgSablony, svgCnc, dxf, pdf, rozvrhListu, bezDiakritiky };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.PKV = API;
})(typeof window !== 'undefined' ? window : globalThis);

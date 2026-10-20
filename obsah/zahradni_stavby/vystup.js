/* ============================================================
   Zahradní stavby – výstupy: SVG, DXF (R12, mm ve skutečné velikosti), PDF (výkresy v měřítku
   s rámečkem a razítkem, šablony 1:1 s dělením na listy, texty a tabulky), STL rozpěrky.
   Bez DOM; jsPDF se předává parametrem.
   ============================================================ */
(function (koren) {
  'use strict';
  const J = koren.ZSJ || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const fmt = J.fmt;
  const STYL = {
    vypln: { f: '#ffffff' }, srafa: { c: '#555555' }, pomoc: { c: '#8a8a8a' }, skryte: { c: '#666666' }, obrys: { c: '#000000' }, ocel: { c: '#444444' },
    rez: { c: '#000000' }, osa: { c: '#b3261e' }, znacka: { c: '#b3261e' }, kota: { c: '#1f5fa8' }, kotaText: { c: '#1f5fa8' }, slunce: { c: '#d9480f' },
    text: { c: '#000000' }, dilText: { c: '#b3261e' }, nadpis: { c: '#000000' },
  };
  const PORADI = ['vypln', 'srafa', 'pomoc', 'skryte', 'obrys', 'ocel', 'rez', 'osa', 'znacka', 'slunce', 'kota', 'kotaText', 'text', 'dilText', 'nadpis'];
  const DXF_BARVA = { srafa: 8, pomoc: 8, skryte: 8, obrys: 7, ocel: 8, rez: 7, osa: 1, znacka: 1, slunce: 30, kota: 5, kotaText: 5, text: 7, dilText: 1, nadpis: 7 };
  const n = (x) => { const v = Math.round(x * 1000) / 1000; return Number.isFinite(v) ? String(v) : '0'; };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const barva = (e, typ, cb) => (cb && typ === 'c' ? '#000000' : (typ === 'f' ? (e.f || (STYL[e.v] || {}).f || '#ffffff') : (e.c || (STYL[e.v] || {}).c || '#000000')));
  const carky = (e) => (e.d === 'osa' ? [Math.max(4, (e.s || 0.25) * 16), 1.2, 0.6, 1.2] : [Math.max(1.6, (e.s || 0.25) * 7), Math.max(1, (e.s || 0.25) * 4)]);

  /* ---------------- SVG ---------------- */
  function svgPrvek(e, o) {
    if (e.t === 'l') {
      const d = e.b.map((q, i) => (i ? 'L' : 'M') + n(q[0]) + ' ' + n(q[1])).join('') + (e.z ? 'Z' : '');
      return `<path d="${d}" fill="none" stroke="${barva(e, 'c', o.cernobile)}" stroke-width="${n(e.s || 0.25)}" stroke-linecap="round" stroke-linejoin="round"${e.d ? ` stroke-dasharray="${carky(e).map(n).join(' ')}"` : ''}/>`;
    }
    if (e.t === 'p') {
      const d = e.b.map((R) => R.map((q, i) => (i ? 'L' : 'M') + n(q[0]) + ' ' + n(q[1])).join('') + 'Z').join('');
      return `<path d="${d}" fill="${o.cernobile ? '#ffffff' : barva(e, 'f')}" fill-rule="evenodd"/>`;
    }
    if (e.t === 'txt') {
      const an = e.a === 'l' ? 'start' : e.a === 'r' ? 'end' : 'middle';
      const rot = e.u ? ` transform="rotate(${n(-e.u)} ${n(e.x)} ${n(e.y)})"` : '';
      return `<text x="${n(e.x)}" y="${n(e.y + 0.35 * e.h)}" font-size="${n(e.h)}" text-anchor="${an}" fill="${barva(e, 'c', o.cernobile)}"${e.v === 'nadpis' || e.v === 'dilText' ? ' font-weight="bold"' : ''}${rot}>${esc(e.txt)}</text>`;
    }
    return '';
  }
  /** o: {okraj, sirkaPx, cernobile, meritko (úsečka 50 mm)} */
  function svg(sc, o) {
    o = Object.assign({ okraj: 3 }, o || {});
    const m = o.okraj, x = sc.x0 - m, y = sc.y0 - m, w = sc.w + 2 * m, h = sc.h + 2 * m + (o.meritko ? 10 : 0);
    const rozm = o.sirkaPx ? 'width="100%"' : `width="${n(w)}mm" height="${n(h)}mm"`;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" ${rozm} viewBox="${n(x)} ${n(y)} ${n(w)} ${n(h)}" font-family="Liberation Sans, Arial, Helvetica, sans-serif">`;
    s += `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="#ffffff"/>`;
    // výplně a obrysy se musí střídat v pořadí kreslení (malířův algoritmus) – vrstvy vypln/obrys/rez/srafa/skryte/pomoc/ocel dohromady
    const SPOLU = new Set(['vypln', 'srafa', 'obrys', 'rez', 'skryte', 'pomoc', 'ocel']);
    s += '<g id="kresba">' + sc.prvky.filter((e) => SPOLU.has(e.v)).map((e) => svgPrvek(e, o)).join('') + '</g>';
    for (const v of PORADI) {
      if (SPOLU.has(v)) continue;
      const el = sc.prvky.filter((e) => e.v === v);
      if (el.length) s += `<g id="vrstva-${v}">` + el.map((e) => svgPrvek(e, o)).join('') + '</g>';
    }
    if (o.meritko) {
      const yy = sc.y0 + sc.h + m + 6, xx = sc.x0;
      s += `<g id="meritko"><path d="M${n(xx)} ${n(yy)}h50" stroke="#000" stroke-width="0.3" fill="none"/>`;
      for (let i = 0; i <= 5; i++) s += `<path d="M${n(xx + i * 10)} ${n(yy)}v${i % 5 ? -1.2 : -2.4}" stroke="#000" stroke-width="0.25"/>`;
      s += `<text x="${n(xx + 52)}" y="${n(yy)}" font-size="2.6" fill="#000">50 mm – kontrola měřítka tisku</text></g>`;
    }
    return s + '</svg>';
  }
  /** víc scén vedle sebe / pod sebe do jedné */
  function poskladej(sceny, mezera, vedle) {
    mezera = mezera == null ? 12 : mezera;
    const prvky = []; let y = 0, x = 0, w = 0, h = 0;
    for (const sc of sceny) {
      const dx = (vedle ? x : 0) - sc.x0, dy = (vedle ? 0 : y) - sc.y0;
      for (const e of sc.prvky) {
        if (e.t === 'txt') prvky.push(Object.assign({}, e, { x: e.x + dx, y: e.y + dy }));
        else if (e.t === 'p') prvky.push(Object.assign({}, e, { b: e.b.map((R) => R.map((q) => [q[0] + dx, q[1] + dy])) }));
        else prvky.push(Object.assign({}, e, { b: e.b.map((q) => [q[0] + dx, q[1] + dy]) }));
      }
      if (vedle) { x += sc.w + mezera; h = Math.max(h, sc.h); } else { y += sc.h + mezera; w = Math.max(w, sc.w); }
    }
    return vedle ? { x0: 0, y0: 0, w: Math.max(0, x - mezera), h, prvky } : { x0: 0, y0: 0, w, h: Math.max(0, y - mezera), prvky };
  }

  /* ---------------- DXF (R12) – souřadnice × měřítko = skutečné mm ---------------- */
  function dxf(sceny) {
    const L = [], g = (k, v) => { L.push(String(k)); L.push(String(v)); };
    const vrstvy = Object.keys(DXF_BARVA);
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, vrstvy.length);
    for (const v of vrstvy) { g(0, 'LAYER'); g(2, v.toUpperCase()); g(70, 0); g(62, DXF_BARVA[v]); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    let posun = 0;
    for (const sc of [].concat(sceny)) {
      const M = sc.meritko || 1, ox = posun - sc.x0 * M;
      const X = (x) => ox + x * M, Y = (y) => -y * M;
      const poly = (b, z, ly) => {
        g(0, 'POLYLINE'); g(8, ly); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, z ? 1 : 0);
        for (const q of b) { g(0, 'VERTEX'); g(8, ly); g(10, n(X(q[0]))); g(20, n(Y(q[1]))); g(30, 0); }
        g(0, 'SEQEND'); g(8, ly);
      };
      for (const e of sc.prvky) {
        if (e.v === 'vypln') continue;
        const ly = (DXF_BARVA[e.v] ? e.v : 'obrys').toUpperCase();
        if (e.t === 'l') poly(e.b, e.z, ly);
        else if (e.t === 'txt') {
          const al = e.a === 'l' ? 0 : e.a === 'r' ? 2 : 1, by = e.y + 0.35 * e.h;
          g(0, 'TEXT'); g(8, ly); g(10, n(X(e.x))); g(20, n(Y(by))); g(30, 0); g(40, n(e.h * 0.72 * M)); g(1, String(e.txt));
          if (e.u) g(50, n(e.u));
          if (al) { g(72, al); g(11, n(X(e.x))); g(21, n(Y(by))); g(31, 0); }
        }
      }
      posun += (sc.w + 40) * M;
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return L.join('\r\n') + '\r\n';
  }

  /* ---------------- dělení 1:1 na listy ---------------- */
  function rozvrhListu(sc, pw, ph, okraj, prekryv) {
    const varianta = (W, H) => {
      const uw = W - 2 * okraj, uh = H - 2 * okraj - 9;
      if (sc.w <= uw + 1e-6 && sc.h <= uh + 1e-6) return { W, H, uw, uh, nx: 1, ny: 1, jeden: true };
      const gg = Math.min(prekryv, uw / 3, uh / 3);
      const nx = Math.max(1, Math.ceil((sc.w - gg) / (uw - gg) - 1e-9)), ny = Math.max(1, Math.ceil((sc.h - gg) / (uh - gg) - 1e-9));
      return { W, H, uw, uh, nx, ny, g: gg, jeden: false };
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

  /* ---------------- PDF ---------------- */
  const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/·/g, '-').replace(/[„“]/g, '"').replace(/°/g, ' st.').replace(/×/g, 'x').replace(/[⌀]/g, 'D').replace(/[≤]/g, '<=').replace(/[≥]/g, '>=').replace(/[≈]/g, '~').replace(/[φγ]/g, (c) => ({ φ: 'phi', γ: 'gama' }[c]));
  const proUni = (s) => String(s).replace(/⌀/g, 'Ø').replace(/✓/g, 'OK').replace(/✕/g, 'x');
  function rgb(hex) { const v = parseInt(String(hex).slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  /**
   * stranky: {vykres: scéna v měřítku, nadpis} | {scena, nadpis, deleni:true} (1:1) | {scena, nadpis, zmensit:true} | {nadpis, text:[…], tabulka, ctverec}
   * o: {papir:[w,h], okraj, prekryv, pismo (TTF base64), cernobile, nazev, datum, stavba}
   */
  function pdf(jsPDF, stranky, o) {
    o = Object.assign({ papir: [210, 297], okraj: 10, prekryv: 12 }, o || {});
    const [pw, ph] = o.papir;
    let doc = null, uni = false;
    const T = (s) => (uni ? proUni(s) : bezDiakritiky(s));
    const novaStrana = (W, H) => {
      if (doc) { doc.addPage([W, H], W > H ? 'l' : 'p'); return; }
      doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: W > H ? 'l' : 'p', compress: o.compress !== false });
      if (o.pismo) {
        try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); }
      }
      doc.setProperties({ title: o.nazev || 'Zahradní stavby ze dřeva', creator: 'Zahradní stavby ze dřeva' });
    };
    const text = (txt, x, y, h, a, u, c) => {
      doc.setFont(uni ? 'LS' : 'helvetica', 'normal'); doc.setFontSize(h / 0.3528); doc.setTextColor(...rgb(c || '#000000'));
      const t = T(txt), w = doc.getTextWidth(t), uu = (u || 0) * Math.PI / 180;
      const bx = x + Math.sin(uu) * 0.35 * h, by = y + Math.cos(uu) * 0.35 * h, k = a === 'r' ? w : a === 'c' ? w / 2 : 0;
      doc.text(t, bx - Math.cos(uu) * k, by + Math.sin(uu) * k, u ? { angle: u } : undefined);
    };
    const cesta = (b, z, styl) => {
      const seg = []; for (let i = 1; i < b.length; i++) seg.push([b[i][0] - b[i - 1][0], b[i][1] - b[i - 1][1]]);
      if (seg.length) doc.lines(seg, b[0][0], b[0][1], [1, 1], styl, !!z);
    };
    const kresli = (e, X, Y, k) => {
      if (e.t === 'l') {
        doc.setDrawColor(...rgb(barva(e, 'c', o.cernobile))); doc.setLineWidth(Math.max(0.05, (e.s || 0.25) * (k < 1 ? Math.max(0.6, k) : 1)));
        if (e.d) doc.setLineDashPattern(carky(e), 0);
        cesta(e.b.map((q) => [X(q[0]), Y(q[1])]), e.z, 'S');
        if (e.d) doc.setLineDashPattern([], 0);
      } else if (e.t === 'p') {
        doc.setFillColor(...rgb(o.cernobile ? '#ffffff' : barva(e, 'f')));
        for (const R of e.b) cesta(R.map((q) => [X(q[0]), Y(q[1])]), true, 'F');
      } else if (e.t === 'txt') text(e.txt, X(e.x), Y(e.y), e.h * k, e.a, e.u, barva(e, 'c', o.cernobile));
    };
    const SPOLU = new Set(['vypln', 'srafa', 'obrys', 'rez', 'skryte', 'pomoc', 'ocel']);
    const vse = (sc, X, Y, k) => {
      for (const e of sc.prvky) if (SPOLU.has(e.v)) kresli(e, X, Y, k);
      for (const v of PORADI) if (!SPOLU.has(v)) for (const e of sc.prvky) if (e.v === v) kresli(e, X, Y, k);
    };
    const meritko50 = (x, y) => {
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25); doc.line(x, y, x + 50, y);
      for (let i = 0; i <= 5; i++) doc.line(x + i * 10, y - (i % 5 ? 1 : 2), x + i * 10, y);
      text('50 mm – kontrola tisku', x + 52, y - 0.6, 2.4, 'l', 0);
    };
    const grafMeritko = (x, y, M) => {
      // úsečka odpovídající 1 m (nebo 0,5 / 0,1 m) ve skutečnosti
      let m = 1000; while (m / M > 80 && m > 10) m /= 2; while (m / M < 20) m *= 2;
      const L = m / M; doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25);
      for (let i = 0; i < 4; i++) { if (i % 2 === 0) { doc.setFillColor(0, 0, 0); doc.rect(x + i * L / 4, y - 1.2, L / 4, 1.2, 'FD'); } else doc.rect(x + i * L / 4, y - 1.2, L / 4, 1.2, 'S'); }
      text(`0`, x, y + 2.4, 2.2, 'c', 0); text(`${fmt(m)} mm ve skutečnosti (1:${M})`, x + L, y + 2.4, 2.2, 'l', 0);
    };
    const ctverec = (x, y) => {
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25); doc.rect(x, y, 50, 50, 'S');
      text('50 × 50 mm', x + 25, y + 25, 4, 'c', 0);
      text('Po tisku změřte: čtverec musí mít přesně 50 mm (tisk „skutečná velikost“, ne „přizpůsobit“).', x, y + 54, 2.8, 'l', 0);
    };
    let cisloListu = 0;
    for (const st of stranky) {
      if (st.vykres) {
        const sc = st.vykres, W0 = Math.max(pw, ph), H0 = Math.min(pw, ph);
        // orientace: na šířku, pokud se vejde líp
        const nasirku = sc.w / sc.h > 1 || sc.w > Math.min(pw, ph) - 2 * o.okraj;
        const W = nasirku ? W0 : H0, H = nasirku ? H0 : W0;
        novaStrana(W, H); cisloListu++;
        const ram = o.okraj, razV = 22, uw = W - 2 * ram - 4, uh = H - 2 * ram - razV - 4;
        doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5); doc.rect(ram, ram, W - 2 * ram, H - 2 * ram, 'S');
        const k = Math.min(1, uw / sc.w, uh / sc.h);
        const ox = ram + 2 + (uw - sc.w * k) / 2, oy = ram + 2 + (uh - sc.h * k) / 2;
        vse(sc, (x) => ox + (x - sc.x0) * k, (y) => oy + (y - sc.y0) * k, k);
        // razítko
        const rx = W - ram - 140, ry = H - ram - razV;
        doc.setLineWidth(0.35); doc.rect(rx, ry, 140, razV, 'S'); doc.line(rx, ry + 8, rx + 140, ry + 8); doc.line(rx + 95, ry, rx + 95, ry + razV);
        text(o.stavba || o.nazev || 'Zahradní stavba', rx + 2, ry + 4, 3.4, 'l', 0);
        text(st.nadpis || sc.nazev || '', rx + 2, ry + 12, 2.8, 'l', 0);
        text(k < 0.999 ? `zmenšeno ${fmt(k * 100)} % – měřítko neplatí` : `měřítko 1:${sc.meritko || 1}`, rx + 97, ry + 4, 2.6, 'l', 0);
        text(`list ${cisloListu}`, rx + 97, ry + 12, 2.6, 'l', 0);
        text(o.datum || '', rx + 97, ry + 18, 2.4, 'l', 0);
        text('Rozměry v mm. Zjednodušený výpočet – nejde o statický posudek.', rx + 2, ry + 18, 2.3, 'l', 0, '#444444');
        if (k > 0.999 && sc.meritko) grafMeritko(ram + 6, H - ram - 12, sc.meritko);
        meritko50(ram + 6, H - ram - 4);
      } else if (st.scena && st.deleni) {
        const rv = rozvrhListu(st.scena, pw, ph, o.okraj, o.prekryv), N = rv.listy.length;
        for (const l of rv.listy) {
          novaStrana(rv.W, rv.H); cisloListu++;
          const X = (x) => o.okraj + (x - l.sx), Y = (y) => o.okraj + (y - l.sy);
          doc.saveGraphicsState(); doc.rect(o.okraj, o.okraj, rv.uw, rv.uh, null); doc.clip(); doc.discardPath();
          vse(st.scena, X, Y, 1);
          doc.restoreGraphicsState();
          if (!rv.jeden) {
            doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.2); doc.setLineDashPattern([2, 1.5], 0);
            if (l.c < rv.nx - 1) doc.line(o.okraj + rv.uw - rv.g, o.okraj, o.okraj + rv.uw - rv.g, o.okraj + rv.uh);
            if (l.r < rv.ny - 1) doc.line(o.okraj, o.okraj + rv.uh - rv.g, o.okraj + rv.uw, o.okraj + rv.uh - rv.g);
            doc.setLineDashPattern([], 0); doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2);
            for (const [x, y] of [[o.okraj, o.okraj], [o.okraj + rv.uw, o.okraj], [o.okraj, o.okraj + rv.uh], [o.okraj + rv.uw, o.okraj + rv.uh]]) { doc.line(x - 3, y, x + 3, y); doc.line(x, y - 3, x, y + 3); }
            if (l.c > 0 || l.r > 0) text('ořízněte ' + (l.c > 0 ? 'levý' : '') + (l.c > 0 && l.r > 0 ? ' a ' : '') + (l.r > 0 ? 'horní' : '') + ' okraj a přiložte na čárkovanou čáru sousedního listu', o.okraj + 2, o.okraj - 2.4, 2.4, 'l', 0, '#555555');
          }
          const pata = rv.H - o.okraj - 2;
          text([st.nadpis, N > 1 ? `list ${l.r * rv.nx + l.c + 1}/${N} (řádek ${l.r + 1}, sloupec ${l.c + 1})` : '', 'tiskněte 1:1'].filter(Boolean).join(' · '), o.okraj, pata, 2.6, 'l', 0);
          meritko50(rv.W - o.okraj - 80, pata);
          // kontrolní úsečka 100 mm ve svislém směru
          doc.setLineWidth(0.25); doc.setDrawColor(0, 0, 0); const sx = rv.W - o.okraj + 3;
          if (rv.uh >= 100 && o.okraj >= 5) { doc.line(sx, o.okraj, sx, o.okraj + 100); doc.line(sx - 1.5, o.okraj, sx + 1.5, o.okraj); doc.line(sx - 1.5, o.okraj + 100, sx + 1.5, o.okraj + 100); text('100 mm', sx - 1.2, o.okraj + 50, 2.2, 'c', 90); }
        }
      } else {
        novaStrana(pw, ph); cisloListu++;
        let y = o.okraj + 6;
        if (st.nadpis) { text(st.nadpis, o.okraj, y, 5.2, 'l', 0); y += 8; }
        if (st.scena) {
          const sc = st.scena, k = Math.min(1, (pw - 2 * o.okraj) / sc.w, (ph - y - o.okraj - 12) / sc.h);
          vse(sc, (x) => o.okraj + (x - sc.x0) * k, (yy) => y + (yy - sc.y0) * k, k);
          y += sc.h * k + 6;
        }
        if (st.tabulka) {
          const tb = st.tabulka, sl = tb.sloupce, sirky = tb.sirky, vel = 2.7;
          const radek = (bunky, tucne) => {
            if (y > ph - o.okraj - 10) { novaStrana(pw, ph); cisloListu++; y = o.okraj + 6; }
            let x = o.okraj;
            bunky.forEach((b, i) => {
              doc.setFont(uni ? 'LS' : 'helvetica', 'normal'); doc.setFontSize(vel / 0.3528);
              let t = String(b); while (t.length > 3 && doc.getTextWidth(T(t)) > sirky[i] - 1.5) t = t.slice(0, -2) + '…';
              text(t, x + (sl[i] === 'r' ? sirky[i] - 1 : 0), y, vel, sl[i] === 'r' ? 'r' : 'l', 0, tucne ? '#000000' : '#222222'); x += sirky[i];
            });
            doc.setDrawColor(190, 190, 190); doc.setLineWidth(0.15); doc.line(o.okraj, y + 1.6, o.okraj + sirky.reduce((a, b) => a + b, 0), y + 1.6);
            y += vel * 1.7;
          };
          radek(tb.hlavicka, true);
          for (const r of tb.radky) radek(r, false);
          y += 4;
        }
        for (const r of st.text || []) {
          const tucne = r.startsWith('# '), t = tucne ? r.slice(2) : r, vel = tucne ? 3.8 : 3;
          doc.setFont(uni ? 'LS' : 'helvetica', 'normal'); doc.setFontSize(vel / 0.3528);
          for (const rr of doc.splitTextToSize(T(t), pw - 2 * o.okraj)) {
            if (y > ph - o.okraj - 8) { novaStrana(pw, ph); cisloListu++; y = o.okraj + 6; doc.setFontSize(vel / 0.3528); }
            doc.setTextColor(0, 0, 0); doc.text(rr, o.okraj, y); y += vel * 1.45;
          }
          y += tucne ? 0.6 : 0.8;
        }
        if (st.ctverec) { if (y + 60 > ph - o.okraj) { novaStrana(pw, ph); cisloListu++; y = o.okraj + 6; } ctverec(o.okraj, y + 2); }
      }
    }
    if (!doc) novaStrana(pw, ph);
    return doc;
  }

  /* ---------------- STL hranolu z konvexního profilu ---------------- */
  /** profil [[x,y]…] (CCW) vytažený o h ve směru z → binární STL (ArrayBuffer), objem */
  function stlHranol(poly, h, nazev) {
    const P = J.plocha(poly) < 0 ? poly.slice().reverse() : poly.slice();
    const T = [], n0 = P.length;
    const A = (q, z) => [q[0], q[1], z];
    for (let i = 1; i < n0 - 1; i++) { T.push([A(P[0], 0), A(P[i + 1], 0), A(P[i], 0)]); T.push([A(P[0], h), A(P[i], h), A(P[i + 1], h)]); }
    for (let i = 0; i < n0; i++) { const a = P[i], b = P[(i + 1) % n0]; T.push([A(a, 0), A(b, 0), A(b, h)]); T.push([A(a, 0), A(b, h), A(a, h)]); }
    const buf = new ArrayBuffer(84 + T.length * 50), dv = new DataView(buf);
    const hl = String(nazev || 'zahradni stavby').slice(0, 79);
    for (let i = 0; i < hl.length; i++) dv.setUint8(i, hl.charCodeAt(i) & 127);
    dv.setUint32(80, T.length, true);
    let off = 84, obj = 0;
    for (const [a, b, c] of T) {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...nn) || 1; nn = nn.map((x) => x / l);
      for (const x of nn) { dv.setFloat32(off, x, true); off += 4; }
      for (const q of [a, b, c]) for (const x of q) { dv.setFloat32(off, x, true); off += 4; }
      dv.setUint16(off, 0, true); off += 2;
      obj += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    }
    return { buf, trojuhelniku: T.length, objem: obj, troj: T };
  }

  const API = { svg, svgPrvek, poskladej, dxf, rozvrhListu, pdf, stlHranol, bezDiakritiky, STYL };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.ZSO = API;
})(typeof window !== 'undefined' ? window : globalThis);

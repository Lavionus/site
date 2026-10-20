/* ============================================================
   Volvelle – výstupy: SVG (náhled i export), DXF R12 pro plotr/laser, PDF 1:1 (jsPDF předaný parametrem)
   Model a vrstvy viz sablony.js / kresba.js (mm, y dolů, střed 0, 0). Bez DOM.
   ============================================================ */
(function (koren) {
  'use strict';
  const req = (n) => (typeof require !== 'undefined' ? require(n) : null);
  const V = koren.VOLV || req('./jadro.js');
  const ST = koren.VOLV_STYLY || req('./styly.js');
  const K = koren.VOLV_KRESBA || req('./kresba.js');
  const RAD = Math.PI / 180;
  const n = (x) => { const v = Math.round(x * 1000) / 1000; return (Object.is(v, -0) ? 0 : v).toString(); };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cesta = (b, z) => b.map((q, i) => (i ? 'L' : 'M') + n(q[0]) + ' ' + n(q[1])).join('') + (z ? 'Z' : '');
  const kruhCesta = (cx, cy, r) => `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0Z`;
  const tvarCesta = (t) => (t.typ === 'kruh' ? kruhCesta(0, 0, t.r) : cesta(t.b, true));
  const oknoCesta = (o) => (o.kruh ? kruhCesta(o.kruh[0], o.kruh[1], o.kruh[2]) : cesta(o.b, true));
  /** bod účaří a směr textu (u ° po směru ručiček, y dolů) */
  function ucari(e) {
    const u = (e.u || 0) * RAD, d = 0.35 * e.h;
    return [e.x - Math.sin(u) * d, e.y + Math.cos(u) * d];
  }
  const vynechat = (e, st) => e.vypl && !st.vyplne;

  /* ---------------- SVG ---------------- */
  function rodina(st, nadpis) {
    const p = (nadpis ? st.nadpisInfo : st.pismoInfo) || ST.PISMA.liberation;
    return `'${p.rodina}', 'Liberation Sans', Arial, sans-serif`;
  }
  function svgPrvek(e, st) {
    if (vynechat(e, st)) return '';
    const c = ST.barva(st, e.c), f = e.f ? ST.barva(st, e.f) : null;
    if (e.t === 'l') {
      const d = cesta(e.b, e.z);
      const tah = e.s > 0 ? ` stroke="${c}" stroke-width="${n(e.s * (st.silaCar || 1))}" stroke-linejoin="round" stroke-linecap="round"${e.d ? ` stroke-dasharray="${n(e.s * 5)} ${n(e.s * 4)}"` : ''}` : '';
      return `<path d="${d}" fill="${f || 'none'}"${tah}/>`;
    }
    if (e.t === 'k') {
      const tah = e.s > 0 ? ` stroke="${c}" stroke-width="${n(e.s * (st.silaCar || 1))}"` : '';
      return `<circle cx="${n(e.x)}" cy="${n(e.y)}" r="${n(e.r)}" fill="${f || 'none'}"${tah}/>`;
    }
    if (e.t === 'txt') {
      if (!e.txt) return '';
      const [bx, by] = ucari(e), an = e.a === 'l' ? 'start' : e.a === 'r' ? 'end' : 'middle';
      const rot = e.u ? ` transform="rotate(${n(e.u)} ${n(bx)} ${n(by)})"` : '';
      return `<text x="${n(bx)}" y="${n(by)}" font-size="${n(e.h)}" text-anchor="${an}" fill="${c}"${e.n ? ` font-family="${esc(rodina(st, true))}"` : ''}${rot}>${esc(e.txt)}</text>`;
    }
    return '';
  }
  /** šrafy okna (pro tisk – „vyříznout“) */
  function srafyOkna(o, id) {
    return `<path d="${oknoCesta(o)}" fill="url(#${id})" stroke="#000" stroke-width="0.3"/>`;
  }
  /**
   * SVG jedné vrstvy (bez obalu <svg>): o.nahled = pro interaktivní náhled (průhledná okna, ořez, stín),
   * o.tisk = značky pro tisk (střih, okna šrafovaná, střed), o.id = jedinečné id, o.jenRez = pouze řezné čáry
   */
  function svgVrstva(v, st, o) {
    o = o || {};
    const id = o.id || v.id, papir = st.barvy.papir || '#ffffff', okna = v.okna || [];
    const obrys = tvarCesta(v.tvar) + okna.map(oknoCesta).join('');
    let s = '';
    if (o.jenRez) {
      s += `<g id="rez-${id}" fill="none" stroke="#ff0000" stroke-width="0.1"><path d="${tvarCesta(v.tvar)}"/>${okna.map((q) => `<path d="${oknoCesta(q)}"/>`).join('')}<circle cx="0" cy="0" r="${n((v.dira || 3) / 2)}"/></g>`;
      return s;
    }
    if (o.nahled) s += `<clipPath id="ořez-${id}"><path d="${obrys}" clip-rule="evenodd"/></clipPath>`;
    s += `<g${o.nahled ? ` clip-path="url(#ořez-${id})"` : ''}${v.pruhledna && o.nahled ? ` opacity="${1 - v.pruhledna}"` : ''}>`;
    s += `<path d="${obrys}" fill="${v.pruhledna && o.nahled ? '#e8f1f8' : papir}" fill-rule="evenodd"/>`;
    s += v.prvky.map((e) => svgPrvek(e, st)).join('');
    s += '</g>';
    if (o.nahled) {
      s += `<path d="${obrys}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="0.35" fill-rule="evenodd"/>`;
    }
    if (o.tisk) {
      for (const q of okna) s += srafyOkna(q, o.srafy || 'srafy');
      s += `<path d="${tvarCesta(v.tvar)}" fill="none" stroke="#000" stroke-width="0.3"/>`;
      s += stredSvg(v);
    }
    return s;
  }
  function stredSvg(v) {
    const r = (v.dira || 3) / 2;
    return `<g stroke="#000" stroke-width="0.2" fill="none"><circle cx="0" cy="0" r="${n(r)}" stroke-dasharray="0.6 0.5"/><path d="M-4 0H-${n(r + 0.6)}M${n(r + 0.6)} 0H4M0 -4V-${n(r + 0.6)}M0 ${n(r + 0.6)}V4"/></g>`;
  }
  const definice = (id) => `<defs><pattern id="${id || 'srafy'}" width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.2" height="2.2" fill="#ffffff"/><path d="M0 0V2.2" stroke="#9a9a9a" stroke-width="0.35"/></pattern></defs>`;
  /** @font-face s vloženými písmy stylu (pro samostatné SVG) */
  function fontFace(st) {
    let s = '';
    for (const p of [st.pismoInfo, st.nadpisInfo]) {
      const b64 = p && koren.FONTY_JS && koren.FONTY_JS[p.soubor];
      if (b64) s += `@font-face{font-family:'${p.rodina}';src:url(data:font/ttf;base64,${b64}) format('truetype');}`;
    }
    return s ? `<style>${s}</style>` : '';
  }
  /** rozložení vrstev vedle sebe (pro export SVG/DXF) */
  function rozlozeni(vrstvy, mezera) {
    const out = []; let x = 0;
    for (const v of vrstvy) { const R = v.R || K.obalR(v); out.push({ v, x: x + R, y: R }); x += 2 * R + (mezera || 10); }
    return { pozice: out, w: Math.max(1, x - (mezera || 10)), h: Math.max(...vrstvy.map((v) => 2 * (v.R || K.obalR(v)))) };
  }
  /**
   * export SVG všech vrstev vedle sebe; o.rezim: 'tisk' (barevný tisk se značkami), 'plotr' (tisk + červené řezy), 'rez' (jen řezy)
   */
  function svgExport(model, o) {
    o = Object.assign({ rezim: 'tisk' }, o || {});
    const st = model.styl, L = rozlozeni(model.vrstvy, 12), m = 8, popisH = o.rezim === 'rez' ? 0 : 8;
    const w = L.w + 2 * m, h = L.h + 2 * m + popisH;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${n(w)}mm" height="${n(h)}mm" viewBox="${n(-m)} ${n(-m)} ${n(w)} ${n(h)}" font-family="${esc(rodina(st, false))}">`;
    s += definice('srafy') + (o.vlozitPisma ? fontFace(st) : '');
    L.pozice.forEach((q, i) => {
      s += `<g inkscape:groupmode="layer" inkscape:label="${esc((i + 1) + ' ' + q.v.nazev)}" transform="translate(${n(q.x)} ${n(q.y)})">`;
      if (o.rezim !== 'rez') {
        s += `<g inkscape:groupmode="layer" inkscape:label="tisk">${svgVrstva(q.v, st, { tisk: o.rezim === 'tisk', id: 'v' + i, srafy: 'srafy' })}</g>`;
        s += `<text x="0" y="${n(q.v.R + 5)}" font-size="2.6" text-anchor="middle" fill="#000">${esc(`${i + 1}/${model.vrstvy.length} · ${q.v.nazev}`)}</text>`;
      }
      if (o.rezim !== 'tisk') s += `<g inkscape:groupmode="layer" inkscape:label="řez">${svgVrstva(q.v, st, { jenRez: true, id: 'v' + i })}</g>`;
      s += '</g>';
    });
    return s + '</svg>';
  }

  /* ---------------- DXF (R12, mm, y nahoru) ---------------- */
  function dxf(model, o) {
    o = Object.assign({ tisk: true }, o || {});
    const L = rozlozeni(model.vrstvy, 12), out = [], g = (k, v) => { out.push(String(k)); out.push(String(v)); };
    const VR = [['REZ', 1], ['OKNA', 1], ['STRED', 5], ['TISK', 7], ['TEXT', 7]];
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, VR.length);
    for (const [jm, c] of VR) { g(0, 'LAYER'); g(2, jm); g(70, 0); g(62, c); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    const poly = (b, z, ly, X, Y) => { g(0, 'POLYLINE'); g(8, ly); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, z ? 1 : 0); for (const q of b) { g(0, 'VERTEX'); g(8, ly); g(10, n(X(q[0]))); g(20, n(Y(q[1]))); g(30, 0); } g(0, 'SEQEND'); g(8, ly); };
    const kr = (x, y, r, ly) => { g(0, 'CIRCLE'); g(8, ly); g(10, n(x)); g(20, n(y)); g(30, 0); g(40, n(r)); };
    for (const q of L.pozice) {
      const v = q.v, X = (x) => x + q.x, Y = (y) => -(y + q.y);
      if (v.tvar.typ === 'kruh') kr(X(0), Y(0), v.tvar.r, 'REZ'); else poly(v.tvar.b, true, 'REZ', X, Y);
      for (const w of v.okna || []) { if (w.kruh) kr(X(w.kruh[0]), Y(w.kruh[1]), w.kruh[2], 'OKNA'); else poly(w.b, true, 'OKNA', X, Y); }
      kr(X(0), Y(0), (v.dira || 3) / 2, 'STRED');
      if (!o.tisk) continue;
      for (const e of v.prvky) {
        if (e.f && !e.s) continue;       // výplně do DXF nepatří
        if (e.t === 'l') poly(e.b, e.z, 'TISK', X, Y);
        else if (e.t === 'k') kr(X(e.x), Y(e.y), e.r, 'TISK');
        else if (e.t === 'txt' && e.txt) {
          const [bx, by] = ucari(e), al = e.a === 'l' ? 0 : e.a === 'r' ? 2 : 1;
          g(0, 'TEXT'); g(8, 'TEXT'); g(10, n(X(bx))); g(20, n(Y(by))); g(30, 0); g(40, n(e.h * 0.7)); g(1, String(e.txt));
          if (e.u) g(50, n(-e.u));
          if (al) { g(72, al); g(11, n(X(bx))); g(21, n(Y(by))); g(31, 0); }
        }
      }
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return out.join('\r\n') + '\r\n';
  }

  /* ---------------- PDF ---------------- */
  function rgb(hex) { const v = parseInt(String(hex || '#000000').slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/·/g, '-').replace(/[„“]/g, '"').replace(/°/g, ' st.').replace(/×/g, 'x');
  /** rozvrh dílu (obdélník w×h) na listy papíru W×H s okrajem a přesahem lepení */
  function rozvrhListu(w, h, W, H, okraj, prekryv) {
    const varianta = (W, H) => {
      const uw = W - 2 * okraj, uh = H - 2 * okraj - 9;
      if (w <= uw + 1e-6 && h <= uh + 1e-6) return { W, H, uw, uh, nx: 1, ny: 1, jeden: true };
      const g = Math.min(prekryv, uw / 3, uh / 3);
      return { W, H, uw, uh, g, nx: Math.max(1, Math.ceil((w - g) / (uw - g) - 1e-9)), ny: Math.max(1, Math.ceil((h - g) / (uh - g) - 1e-9)), jeden: false };
    };
    const a = varianta(W, H), b = varianta(H, W), v = b.nx * b.ny < a.nx * a.ny ? b : a, listy = [];
    if (v.jeden) listy.push({ sx: -(v.uw - w) / 2, sy: -(v.uh - h) / 2, r: 0, c: 0 });
    else {
      const cw = v.nx * (v.uw - v.g) + v.g, ch = v.ny * (v.uh - v.g) + v.g;
      for (let r = 0; r < v.ny; r++) for (let c = 0; c < v.nx; c++) listy.push({ sx: -(cw - w) / 2 + c * (v.uw - v.g), sy: -(ch - h) / 2 + r * (v.uh - v.g), r, c });
    }
    return Object.assign(v, { listy });
  }
  /**
   * PDF; o: {papir:[W,H], okraj, prekryv, pisma:{soubor: base64}, liberation (base64), zadni (zadní strany), navod, nazev}
   * Každá vrstva na vlastní list (vystředěná – zadní strana pak sedí při otáčení po kterékoli hraně), větší vrstvy se dělí.
   */
  function pdf(jsPDF, model, o) {
    o = Object.assign({ papir: [210, 297], okraj: 8, prekryv: 12 }, o || {});
    const st = model.styl, [PW, PH] = o.papir;
    let doc = null, uni = false;
    const fontJm = {};
    const novaStrana = (W, H) => {
      if (doc) { doc.addPage([W, H], W > H ? 'l' : 'p'); return; }
      doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: W > H ? 'l' : 'p', compress: true });
      if (o.liberation) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.liberation); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); uni = true; } catch (e) { uni = false; } }
      for (const p of [st.pismoInfo, st.nadpisInfo]) {
        if (!p || p.liberation || fontJm[p.soubor]) continue;
        const b64 = o.pisma && o.pisma[p.soubor];
        if (b64) { try { doc.addFileToVFS(p.soubor, b64); doc.addFont(p.soubor, 'VV_' + p.soubor, 'normal'); fontJm[p.soubor] = 'VV_' + p.soubor; } catch (e) { /* písmo nejde vložit – zůstane Liberation */ } }
      }
      doc.setProperties({ title: o.nazev || model.nazev, creator: 'Volvelle – otočné kotouče' });
    };
    const T = (s) => (uni ? String(s) : bezDiakritiky(s));
    const pismo = (t, nadpis) => {
      const p = nadpis ? st.nadpisInfo : st.pismoInfo;
      if (p && fontJm[p.soubor] && ![...String(t)].some((ch) => (p.chybi || '●○').includes(ch))) doc.setFont(fontJm[p.soubor], 'normal');
      else if (uni) doc.setFont('LS', 'normal'); else doc.setFont('helvetica', 'normal');
    };
    const text = (t, x, y, h, a, u, c, nadpis) => {
      pismo(t, nadpis); doc.setFontSize(h / 0.3528); doc.setTextColor(...rgb(c));
      const s = T(t), w = doc.getTextWidth(s), uu = (u || 0) * RAD;
      const bx = x - Math.sin(uu) * 0.35 * h, by = y + Math.cos(uu) * 0.35 * h, k = a === 'r' ? w : a === 'c' ? w / 2 : 0;
      doc.text(s, bx - Math.cos(uu) * k, by - Math.sin(uu) * k, u ? { angle: -u } : undefined);
    };
    const polyline = (b, z, rezim) => {
      if (b.length < 2) return;
      const seg = []; for (let i = 1; i < b.length; i++) seg.push([b[i][0] - b[i - 1][0], b[i][1] - b[i - 1][1]]);
      doc.lines(seg, b[0][0], b[0][1], [1, 1], rezim, !!z);
    };
    const kresliPrvek = (e, X, Y) => {
      if (vynechat(e, st)) return;
      const c = ST.barva(st, e.c), f = e.f ? ST.barva(st, e.f) : null, sila = (e.s || 0) * (st.silaCar || 1);
      if (e.t === 'txt') { if (e.txt) text(e.txt, X(e.x), Y(e.y), e.h, e.a, e.u, c, e.n); return; }
      doc.setDrawColor(...rgb(c)); if (f) doc.setFillColor(...rgb(f)); doc.setLineWidth(Math.max(0.05, sila));
      const rezim = f && sila > 0 ? 'FD' : f ? 'F' : 'S';
      if (!f && !(sila > 0)) return;
      if (e.t === 'l') {
        if (e.d) doc.setLineDashPattern([sila * 5, sila * 4], 0);
        polyline(e.b.map((q) => [X(q[0]), Y(q[1])]), e.z || !!f, rezim);
        if (e.d) doc.setLineDashPattern([], 0);
      } else if (e.t === 'k') doc.circle(X(e.x), Y(e.y), e.r, rezim);
    };
    const meritko = (x, y) => {
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25); doc.line(x, y, x + 50, y);
      for (let i = 0; i <= 5; i++) doc.line(x + i * 10, y - (i % 5 ? 1 : 2), x + i * 10, y);
      text('50 mm – kontrola měřítka 1:1', x + 52, y - 0.6, 2.5, 'l', 0, '#000000');
    };
    const srafuj = (b, X, Y) => {
      // okno: bílá výplň, šrafy po 2,5 mm (ořez na okno) a obrys – „vyříznout“
      doc.setFillColor(255, 255, 255); doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
      const bb = b.map((q) => [X(q[0]), Y(q[1])]);
      polyline(bb, true, 'F');
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const q of bb) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
      doc.saveGraphicsState();
      polyline(bb, true, null); doc.clip(); doc.discardPath();
      doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.25);
      for (let t = x0 - (y1 - y0); t < x1; t += 2.5) doc.line(t, y1, t + (y1 - y0), y0);
      doc.restoreGraphicsState();
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3); polyline(bb, true, 'S');
      const w = x1 - x0, h = y1 - y0;
      if (w > 14 && h > 5) text('vyříznout', (x0 + x1) / 2, (y0 + y1) / 2, Math.min(2.4, h * 0.3), 'c', 0, '#555555');
    };
    const vrstvaNaList = (v, X, Y) => {
      const papir = st.barvy.papir;
      if (papir && st.vyplne !== false) {
        doc.setFillColor(...rgb(papir));
        if (v.tvar.typ === 'kruh') doc.circle(X(0), Y(0), v.tvar.r, 'F'); else polyline(v.tvar.b.map((q) => [X(q[0]), Y(q[1])]), true, 'F');
      }
      // ořez kresby na obrys vrstvy
      doc.saveGraphicsState();
      if (v.tvar.typ === 'kruh') { doc.circle(X(0), Y(0), v.tvar.r + 0.05, null); } else polyline(v.tvar.b.map((q) => [X(q[0]), Y(q[1])]), true, null);
      doc.clip(); doc.discardPath();
      for (const e of v.prvky) kresliPrvek(e, X, Y);
      doc.restoreGraphicsState();
      for (const w of v.okna || []) srafuj(K.oknoBody(w), X, Y);
      // střih a střed
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
      if (v.tvar.typ === 'kruh') doc.circle(X(0), Y(0), v.tvar.r, 'S'); else polyline(v.tvar.b.map((q) => [X(q[0]), Y(q[1])]), true, 'S');
      const r = (v.dira || 3) / 2;
      doc.setLineWidth(0.2); doc.setLineDashPattern([0.6, 0.5], 0); doc.circle(X(0), Y(0), r, 'S'); doc.setLineDashPattern([], 0);
      doc.line(X(-4), Y(0), X(-r - 0.6), Y(0)); doc.line(X(r + 0.6), Y(0), X(4), Y(0)); doc.line(X(0), Y(-4), X(0), Y(-r - 0.6)); doc.line(X(0), Y(r + 0.6), X(0), Y(4));
    };
    // střed vrstvy na listu: přesně uprostřed (zadní strana sedí při otáčení po kterékoli hraně), jinak nad patičkou
    const stredY = (rv, R) => (rv.H / 2 + R <= rv.H - o.okraj - 9 ? rv.H / 2 : o.okraj + (rv.uh) / 2);
    const N = model.vrstvy.length;
    model.vrstvy.forEach((v, i) => {
      const R = v.R || K.obalR(v), bb = { x0: -R, y0: -R, w: 2 * R, h: 2 * R };
      const rv = rozvrhListu(bb.w, bb.h, PW, PH, o.okraj, o.prekryv), nL = rv.listy.length;
      for (const l of rv.listy) {
        novaStrana(rv.W, rv.H);
        const X = (x) => o.okraj + (x - bb.x0) - l.sx, Y = (y) => o.okraj + (y - bb.y0) - l.sy;
        if (rv.jeden) {
          // vystředit na listu (zadní strana pak sedí při otočení po kterékoli hraně)
          const dx = rv.W / 2 - X(0), dy = stredY(rv, R) - Y(0);
          const X2 = (x) => X(x) + dx, Y2 = (y) => Y(y) + dy;
          vrstvaNaList(v, X2, Y2);
        } else {
          doc.saveGraphicsState(); doc.rect(o.okraj, o.okraj, rv.uw, rv.uh, null); doc.clip(); doc.discardPath();
          vrstvaNaList(v, X, Y);
          doc.restoreGraphicsState();
          doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.2); doc.setLineDashPattern([2, 1.5], 0);
          if (l.c < rv.nx - 1) doc.line(o.okraj + rv.uw - rv.g, o.okraj, o.okraj + rv.uw - rv.g, o.okraj + rv.uh);
          if (l.r < rv.ny - 1) doc.line(o.okraj, o.okraj + rv.uh - rv.g, o.okraj + rv.uw, o.okraj + rv.uh - rv.g);
          doc.setLineDashPattern([], 0);
          if (l.c > 0 || l.r > 0) text('ořízněte ' + (l.c > 0 ? 'levý' : '') + (l.c > 0 && l.r > 0 ? ' a ' : '') + (l.r > 0 ? 'horní' : '') + ' okraj a přiložte na čárkovanou čáru sousedního listu', o.okraj + 2, o.okraj - 2.4, 2.4, 'l', 0, '#555555');
        }
        const pata = rv.H - o.okraj - 2;
        text(`${model.nazev} · vrstva ${i + 1}/${N}: ${v.nazev}${nL > 1 ? ` · list ${l.r * rv.nx + l.c + 1}/${nL}` : ''} · tiskněte 1:1 (bez přizpůsobení)`, o.okraj, pata - 4.2, 2.5, 'l', 0, '#000000');
        text(`Vystřihněte po plné čáře${(v.okna || []).length ? ', šrafovaná okénka vyřízněte nožem' : ''}, střed propíchněte (nýtek, patentka, špendlík).`, o.okraj, pata, 2.3, 'l', 0, '#444444');
        meritko(rv.W - o.okraj - 92, rv.jeden ? o.okraj + 4 : Math.max(5.5, o.okraj - 1.5));
      }
      if (o.zadni && rv.jeden) {
        novaStrana(rv.W, rv.H);
        const cx = rv.W / 2, cy = stredY(rv, R);
        doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.15); doc.setLineDashPattern([1, 1.5], 0);
        if (v.tvar.typ === 'kruh') doc.circle(cx, cy, v.tvar.r, 'S'); else polyline(v.tvar.b.map((q) => [cx - q[0], cy + q[1]]), true, 'S');
        doc.setLineDashPattern([], 0);
        const Rr = v.tvar.typ === 'kruh' ? v.tvar.r : R * 0.5;
        const sir = Rr * 1.45, radky = i === 0 ? (model.navod || []) : [];
        let y = cy - Rr * (i === 0 ? 0.55 : 0.12);
        text(model.nazev, cx, y, Math.min(6, Rr * 0.09), 'c', 0, ST.barva(st, 'text'), true); y += Math.min(6, Rr * 0.09) * 1.6;
        text(`vrstva ${i + 1}/${N} – ${v.nazev}`, cx, y, Math.min(3, Rr * 0.05), 'c', 0, '#555555'); y += 6;
        pismo('', false); doc.setFontSize(Math.min(3, Rr * 0.045) / 0.3528);
        for (const r of radky) {
          const sp = doc.splitTextToSize(T(r), sir);
          for (const rr of sp) { text(rr, cx, y, Math.min(3, Rr * 0.045), 'c', 0, '#222222'); y += Math.min(3, Rr * 0.045) * 1.4; }
          y += 1;
        }
        text('zadní strana – tiskněte oboustranně', cx, rv.H - o.okraj - 2, 2.3, 'c', 0, '#888888');
      }
    });
    // zvláštní listy šablony (např. měsíční kalendář)
    for (const s of model.stranky || []) {
      const W = s.naSirku ? Math.max(PW, PH) : Math.min(PW, PH), H = s.naSirku ? Math.min(PW, PH) : Math.max(PW, PH);
      novaStrana(W, H);
      const k = Math.min(1, (W - 2 * o.okraj) / s.w, (H - 2 * o.okraj - 8) / s.h);
      const X = (x) => o.okraj + x * k, Y = (y) => o.okraj + y * k;
      for (const e of s.prvky) {
        const f = Object.assign({}, e); if (k < 1) { if (f.h) f.h *= k; if (f.r) f.r *= k; if (f.s) f.s *= k; }
        kresliPrvek(f, X, Y);
      }
      meritko(W - o.okraj - 92, H - o.okraj - 2);
    }
    // návod + kontrolní čtverec
    novaStrana(Math.min(PW, PH), Math.max(PW, PH));
    const W = Math.min(PW, PH);
    let y = o.okraj + 8;
    text(model.nazev + ' – sestavení', o.okraj, y, 5.5, 'l', 0, '#000000', true); y += 10;
    const radky = (model.navod || []).concat([
      '', 'Postup: 1) vytiskněte v měřítku 100 % (bez „přizpůsobit stránce“) a změřte kontrolní čtverec; 2) vrstvy vystřihněte po plné čáře, šrafovaná okénka vyřízněte ostrým nožem na podložce; 3) papír je lepší silnější (160–250 g/m²) nebo podlepený kartonem; 4) vrstvy seřaďte podle čísla odspodu nahoru, středy propíchněte a spojte nýtkem, patentkou nebo špendlíkem s korkem.',
      'Volvelle (z lat. volvere = otáčet) je papírový „počítač“ z otočných kotoučů – Ramon Llull (13. stol.), Petrus Apianus: Astronomicum Caesareum (1540).',
    ]);
    for (const r of radky) {
      if (!r) { y += 3; continue; }
      pismo(r, false); doc.setFontSize(3.2 / 0.3528);
      for (const rr of doc.splitTextToSize(T(r), W - 2 * o.okraj)) { text(rr, o.okraj, y, 3.2, 'l', 0, '#000000'); y += 4.6; }
      y += 1.2;
    }
    y += 4;
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25); doc.rect(o.okraj, y, 50, 50, 'S');
    text('50 × 50 mm', o.okraj + 25, y + 25, 4, 'c', 0, '#000000');
    text('Změřte pravítkem: po tisku musí mít čtverec přesně 50 mm.', o.okraj, y + 55, 2.8, 'l', 0, '#000000');
    return doc;
  }

  const API = { svgPrvek, svgVrstva, svgExport, definice, fontFace, stredSvg, dxf, pdf, rozvrhListu, rozlozeni, bezDiakritiky, tvarCesta, oknoCesta, rodina };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.VOLV_VYSTUP = API;
})(typeof window !== 'undefined' ? window : globalThis);

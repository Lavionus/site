/* Krabice z kartonu (FEFCO) – výstupy: scéna (čáry podle vrstev), SVG, DXF (R12), PDF 1:1 s dělením na listy.
   Bez DOM; PDF dostane konstruktor jsPDF zvenku. */
(function (koren) {
  'use strict';
  const K = (typeof module !== 'undefined' && module.exports) ? require('./jadro.js') : koren.KrabiceFefco;
  const fmt = K.fmt;

  const VRSTVY = {
    CUT: { nazev: 'Řez', barva: '#d40000', dxf: 1, styl: 'plna' },
    CREASE: { nazev: 'Big / ohyb', barva: '#0057d8', dxf: 5, styl: 'carkovana' },
    PERF: { nazev: 'Perforace', barva: '#008a2e', dxf: 3, styl: 'tecky' },
    GLUE: { nazev: 'Lepení', barva: '#c27c00', dxf: 30, styl: 'srafa' },
    STITCH: { nazev: 'Šití (sponky)', barva: '#7a3db8', dxf: 6, styl: 'plna' },
    DIM: { nazev: 'Kóty', barva: '#555555', dxf: 8, styl: 'plna' },
    TEXT: { nazev: 'Popis', barva: '#222222', dxf: 7, styl: 'plna' },
    FLUTE: { nazev: 'Směr vlny', barva: '#8a8a8a', dxf: 9, styl: 'plna' }
  };

  // spojí úseky do lomených čar (navazující konce)
  function retezy(useky) {
    const k = (p) => Math.round(p[0] * 1e3) + ',' + Math.round(p[1] * 1e3);
    const mapa = new Map();
    useky.forEach((u, i) => { for (const p of [u[0], u[1]]) { const kk = k(p); if (!mapa.has(kk)) mapa.set(kk, []); mapa.get(kk).push(i); } });
    const pouz = new Set(), out = [];
    const dalsi = (kk) => { const l = (mapa.get(kk) || []).filter(i => !pouz.has(i)); return l.length === 1 && mapa.get(kk).length === 2 ? l[0] : -1; };
    for (let i = 0; i < useky.length; i++) {
      if (pouz.has(i)) continue;
      pouz.add(i); let cara = [useky[i][0], useky[i][1]];
      for (const smer of [1, -1]) {
        for (;;) {
          const konec = smer > 0 ? cara[cara.length - 1] : cara[0];
          const j = dalsi(k(konec)); if (j < 0) break;
          pouz.add(j);
          const u = useky[j], nov = k(u[0]) === k(konec) ? u[1] : u[0];
          if (smer > 0) cara.push(nov); else cara.unshift(nov);
        }
      }
      out.push(cara);
    }
    return out;
  }

  // šrafování mnohoúhelníku čarami 45° s roztečí r
  function srafa(poly, r) {
    const out = [];
    const proj = poly.map(p => p[0] + p[1]);
    const mn = Math.min(...proj), mx = Math.max(...proj);
    for (let c = Math.ceil(mn / r) * r; c < mx; c += r) {
      const xs = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length], fa = a[0] + a[1] - c, fb = b[0] + b[1] - c;
        if ((fa < 0) !== (fb < 0)) { const u = fa / (fa - fb); xs.push([a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])]); }
      }
      xs.sort((p, q) => p[0] - q[0]);
      for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
    }
    return out;
  }

  function velikostPisma(v) { return Math.max(3.5, Math.min(9, Math.max(v.sirka, v.vyska) / 140)); }

  /* scéna: čáry {vrstva, body, uzavrena}, texty {x,y,text,vel,uhel,zarovnani,vrstva}, box */
  function scena(v, o) {
    o = Object.assign({ koty: v.P.koty, popis: v.P.popis, vlna: v.P.vlna }, o || {});
    const cary = [], texty = [], vel = velikostPisma(v) * (o.zvetseniPisma || 1);
    for (const d of v.dily) {
      for (const s of d.smycky) cary.push({ vrstva: 'CUT', body: s, uzavrena: true });
      for (const c of retezy(d.bigy)) cary.push({ vrstva: 'CREASE', body: c });
      for (const p of d.dil.perf) cary.push({ vrstva: 'PERF', body: p });
      for (const g of d.dil.lepidlo) { cary.push({ vrstva: 'GLUE', body: g, uzavrena: true }); for (const u of srafa(g, 4)) cary.push({ vrstva: 'GLUE', body: u }); }
      for (const s of d.dil.seti) cary.push({ vrstva: 'STITCH', body: s });
      if (o.koty) for (const k of d.dil.kot) kota(k, cary, texty, vel * 0.8);
    }
    if (o.vlna) {
      // šipka směru vlny/vlákna uprostřed prvního (kořenového) panelu prvního dílu
      const d = v.dily[0], p0 = d.dil.panely[0].poly;
      const xs = p0.map(p => p[0]), ys = p0.map(p => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const svis = v.typ.vlnaSvisle, dl = Math.min(svis ? (Math.max(...ys) - Math.min(...ys)) : (Math.max(...xs) - Math.min(...xs)), 160) * 0.6 / 2;
      const a = svis ? [cx, cy - dl] : [cx - dl, cy], b = svis ? [cx, cy + dl] : [cx + dl, cy];
      cary.push({ vrstva: 'FLUTE', body: [a, b] });
      const h = Math.min(6, dl * 0.3);
      for (const [p, s] of [[a, 1], [b, -1]]) {
        if (svis) cary.push({ vrstva: 'FLUTE', body: [[p[0] - h * 0.6, p[1] + s * h], p, [p[0] + h * 0.6, p[1] + s * h]] });
        else cary.push({ vrstva: 'FLUTE', body: [[p[0] + s * h, p[1] - h * 0.6], p, [p[0] + s * h, p[1] + h * 0.6]] });
      }
      texty.push({ x: svis ? cx + vel * 0.6 : cx, y: svis ? cy : cy + vel * 0.6, text: v.P.t >= 1 ? 'směr vlny' : 'směr vlákna', vel: vel * 0.8, uhel: svis ? 90 : 0, zarovnani: 'stred', vrstva: 'FLUTE' });
    }
    let box = Object.assign({}, v.box);
    for (const c of cary) for (const p of c.body) { box.minx = Math.min(box.minx, p[0]); box.maxx = Math.max(box.maxx, p[0]); box.miny = Math.min(box.miny, p[1]); box.maxy = Math.max(box.maxy, p[1]); }
    for (const t of texty) { box.minx = Math.min(box.minx, t.x - t.vel * 2); box.maxx = Math.max(box.maxx, t.x + t.vel * 2); box.miny = Math.min(box.miny, t.y - t.vel); box.maxy = Math.max(box.maxy, t.y + t.vel); }
    if (o.popis) {
      const radky = popisRadky(v), y0 = box.miny - vel * 1.6;
      radky.forEach((r, i) => texty.push({ x: box.minx, y: y0 - i * vel * 1.45, text: r, vel: i ? vel * 0.85 : vel, uhel: 0, zarovnani: 'vlevo', vrstva: 'TEXT' }));
      box.miny = y0 - (radky.length - 1) * vel * 1.45 - vel * 0.5;
      box.maxx = Math.max(box.maxx, box.minx + Math.max(...radky.map(r => r.length)) * vel * 0.55);
    }
    return { cary, texty, box, vel };
  }

  function popisRadky(v) {
    const P = v.P, m = K.MATERIALY.find(x => x.id === P.material);
    const r = [v.typ.nazev,
      'Vnitřní rozměr D × Š × V: ' + fmt(P.D) + ' × ' + fmt(P.S) + (v.typ.bezV ? '' : ' × ' + fmt(P.V)) + ' mm' +
        (v.vyrobni ? '   výrobní (mezi bigy): ' + fmt(v.vyrobni.D) + ' × ' + fmt(v.vyrobni.S) + (v.vyrobni.V ? ' × ' + fmt(v.vyrobni.V) : '') + ' mm' : ''),
      'Materiál: ' + (m ? m.nazev : 'vlastní') + ', tl. ' + fmt(P.t) + ' mm, ' + fmt(P.g) + ' g/m²   Přířez: ' +
        v.prirezy.map(p => fmt(p.sirka) + ' × ' + fmt(p.vyska)).join(' + ') + ' mm, plocha ' + (Math.round(v.plochaM2 * 1000) / 1000).toString().replace('.', ',') + ' m², ≈ ' + fmt(v.hmotnostG) + ' g',
      'Čáry: řez = plná červená, big = čárkovaná modrá, perforace = tečkovaná zelená'];
    return r;
  }

  function kota(k, cary, texty, vel) {
    const a = k.a, b = k.b, dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    if (l < 1) return;
    const ux = dx / l, uy = dy / l, nx = -uy, ny = ux, o = k.odsaz || 0;
    const A = [a[0] + nx * o, a[1] + ny * o], B = [b[0] + nx * o, b[1] + ny * o];
    if (Math.abs(o) > 0.1) {
      const s = Math.sign(o) * 2;
      cary.push({ vrstva: 'DIM', body: [[a[0] + nx * Math.sign(o) * 1.5, a[1] + ny * Math.sign(o) * 1.5], [A[0] + nx * s, A[1] + ny * s]] });
      cary.push({ vrstva: 'DIM', body: [[b[0] + nx * Math.sign(o) * 1.5, b[1] + ny * Math.sign(o) * 1.5], [B[0] + nx * s, B[1] + ny * s]] });
    }
    cary.push({ vrstva: 'DIM', body: [A, B] });
    const tk = 1.8;
    for (const p of [A, B]) cary.push({ vrstva: 'DIM', body: [[p[0] - (ux + nx) * tk, p[1] - (uy + ny) * tk], [p[0] + (ux + nx) * tk, p[1] + (uy + ny) * tk]] });
    let uhel = Math.atan2(uy, ux) * 180 / Math.PI; if (uhel > 90.01) uhel -= 180; if (uhel <= -90) uhel += 180;
    const zn = (uhel === 90) ? -1 : 1;
    texty.push({ x: (A[0] + B[0]) / 2 + nx * 0.4 * vel * zn * (o < 0 ? -1 : 1), y: (A[1] + B[1]) / 2 + ny * 0.4 * vel * (o < 0 ? -1 : 1), text: k.text, vel, uhel, zarovnani: 'stred', vrstva: 'DIM', nadCarou: true });
  }

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* ---------- SVG ---------- */
  function svg(v, o) {
    o = Object.assign({ okraj: 5, tloustka: 0.25, vrstvy: null, nahled: false }, o || {});
    if (o.nahled && !o.zvetseniPisma) o.zvetseniPisma = 1.8;
    const sc = scena(v, o), b = sc.box, m = o.okraj;
    const W = b.maxx - b.minx + 2 * m, H = b.maxy - b.miny + 2 * m;
    const X = (x) => (x - b.minx + m).toFixed(3), Y = (y) => (b.maxy - y + m).toFixed(3);
    const povol = (vr) => !o.vrstvy || o.vrstvy.includes(vr);
    const out = [];
    out.push('<?xml version="1.0" encoding="UTF-8"?>');
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${W.toFixed(2)}mm" height="${H.toFixed(2)}mm" viewBox="0 0 ${W.toFixed(3)} ${H.toFixed(3)}">`);
    out.push(`<title>${esc(v.typ.nazev)} ${fmt(v.P.D)}×${fmt(v.P.S)}×${fmt(v.P.V)} mm</title>`);
    const dash = { carkovana: '4 2', tecky: '1 1.2' };
    for (const vr of Object.keys(VRSTVY)) {
      if (!povol(vr)) continue;
      const cs = sc.cary.filter(c => c.vrstva === vr), ts = sc.texty.filter(t => t.vrstva === vr);
      if (!cs.length && !ts.length) continue;
      const V = VRSTVY[vr], tl = vr === 'DIM' || vr === 'GLUE' || vr === 'FLUTE' ? o.tloustka * 0.6 : o.tloustka;
      out.push(`<g id="${vr}" inkscape:groupmode="layer" inkscape:label="${vr}" fill="none" stroke="${V.barva}" stroke-width="${tl}" stroke-linecap="round" stroke-linejoin="round"${dash[V.styl] ? ` stroke-dasharray="${dash[V.styl]}"` : ''}>`);
      for (const c of cs) {
        const d = c.body.map((p, i) => (i ? 'L' : 'M') + X(p[0]) + ' ' + Y(p[1])).join('') + (c.uzavrena ? 'Z' : '');
        out.push(`<path d="${d}"/>`);
      }
      for (const t of ts) {
        const anchor = t.zarovnani === 'stred' ? 'middle' : 'start';
        out.push(`<text x="${X(t.x)}" y="${Y(t.y)}" font-family="Liberation Sans, Arial, sans-serif" font-size="${t.vel.toFixed(2)}" fill="${V.barva}" stroke="none" text-anchor="${anchor}"${t.nadCarou ? '' : ' dominant-baseline="middle"'}${t.uhel ? ` transform="rotate(${(-t.uhel).toFixed(2)} ${X(t.x)} ${Y(t.y)})"` : ''}>${esc(t.text)}</text>`);
      }
      out.push('</g>');
    }
    out.push('</svg>');
    return out.join('\n');
  }

  /* ---------- DXF R12 (mm) ---------- */
  function dxf(v, o) {
    o = Object.assign({ vrstvy: null, texty: true }, o || {});
    const sc = scena(v, o), L = [];
    const povol = (vr) => !o.vrstvy || o.vrstvy.includes(vr);
    const g = (kod, hod) => { L.push(String(kod)); L.push(String(hod)); };
    const n = (x) => (Math.round(x * 1e4) / 1e4).toString();
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(9, '$MEASUREMENT'); g(70, 1);
    g(9, '$EXTMIN'); g(10, n(sc.box.minx)); g(20, n(sc.box.miny)); g(9, '$EXTMAX'); g(10, n(sc.box.maxx)); g(20, n(sc.box.maxy)); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES');
    g(0, 'TABLE'); g(2, 'LTYPE'); g(70, 3);
    const lt = (jm, popis, vz) => { g(0, 'LTYPE'); g(2, jm); g(70, 0); g(3, popis); g(72, 65); g(73, vz.length); g(40, n(vz.reduce((s, x) => s + Math.abs(x), 0))); for (const x of vz) g(49, n(x)); };
    lt('CONTINUOUS', 'Solid line', []); lt('DASHED', '__ __ __', [4, -2]); lt('DOT', '. . . .', [1, -1.2]);
    g(0, 'ENDTAB');
    const vrs = Object.keys(VRSTVY).filter(povol);
    g(0, 'TABLE'); g(2, 'LAYER'); g(70, vrs.length);
    for (const vr of vrs) { const V = VRSTVY[vr]; g(0, 'LAYER'); g(2, vr); g(70, 0); g(62, V.dxf); g(6, V.styl === 'carkovana' ? 'DASHED' : V.styl === 'tecky' ? 'DOT' : 'CONTINUOUS'); }
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    for (const c of sc.cary) {
      if (!povol(c.vrstva)) continue;
      if (c.body.length === 2 && !c.uzavrena) {
        g(0, 'LINE'); g(8, c.vrstva); g(10, n(c.body[0][0])); g(20, n(c.body[0][1])); g(30, 0); g(11, n(c.body[1][0])); g(21, n(c.body[1][1])); g(31, 0);
      } else {
        g(0, 'POLYLINE'); g(8, c.vrstva); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, c.uzavrena ? 1 : 0);
        for (const p of c.body) { g(0, 'VERTEX'); g(8, c.vrstva); g(10, n(p[0])); g(20, n(p[1])); g(30, 0); }
        g(0, 'SEQEND'); g(8, c.vrstva);
      }
    }
    if (o.texty) for (const t of sc.texty) {
      if (!povol(t.vrstva)) continue;
      g(0, 'TEXT'); g(8, t.vrstva); g(10, n(t.x)); g(20, n(t.y)); g(30, 0); g(40, n(t.vel)); g(1, prepisDxf(t.text)); if (t.uhel) g(50, n(t.uhel));
      if (t.zarovnani === 'stred') { g(72, 1); g(11, n(t.x)); g(21, n(t.y)); g(31, 0); }
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return L.join('\r\n') + '\r\n';
  }
  // R12 nemá Unicode: diakritiku převedeme na \U+XXXX (AutoCAD / LibreCAD / QCAD to umí)
  function prepisDxf(s) { return String(s).replace(/[^\x20-\x7e]/g, (c) => c === '×' ? 'x' : '\\U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')); }

  /* ---------- PDF 1:1 (jsPDF) s dělením na listy ---------- */
  const FORMATY = { A4: [210, 297], A3: [297, 420], A2: [420, 594], Letter: [215.9, 279.4] };
  function rozvrhListu(sc, o) {
    const f = o.format === 'vlastni' ? [o.sirkaListu || 210, o.vyskaListu || 297] : (FORMATY[o.format] || FORMATY.A4);
    const okraj = o.okraj == null ? 10 : o.okraj, prek = o.prekryv == null ? 10 : o.prekryv;
    const bw = sc.box.maxx - sc.box.minx, bh = sc.box.maxy - sc.box.miny;
    const varianty = [[f[0], f[1], 'p'], [f[1], f[0], 'l']].map(([pw, ph, or]) => {
      const uw = pw - 2 * okraj, uh = ph - 2 * okraj;
      const nx = bw <= uw ? 1 : Math.ceil((bw - prek) / (uw - prek)), ny = bh <= uh ? 1 : Math.ceil((bh - prek) / (uh - prek));
      return { pw, ph, or, uw, uh, nx, ny, n: nx * ny };
    });
    let vyb = o.orientace === 'p' ? varianty[0] : o.orientace === 'l' ? varianty[1] : (varianty[0].n <= varianty[1].n ? varianty[0] : varianty[1]);
    return Object.assign({ okraj, prek, bw, bh }, vyb);
  }
  function pdf(JsPDF, v, o) {
    o = Object.assign({ format: 'A4', orientace: 'auto', okraj: 10, prekryv: 10, pismo: null, info: true }, o || {});
    const sc = scena(v, o), r = rozvrhListu(sc, o);
    const doc = new JsPDF({ unit: 'mm', format: [r.pw, r.ph], orientation: r.pw > r.ph ? 'landscape' : 'portrait', compress: true });
    let pis = 'helvetica';
    if (o.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); pis = 'LS'; } catch (e) { pis = 'helvetica'; } }
    doc.setFont(pis, 'normal');
    const txt = (s) => pis === 'LS' ? s : String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/×/g, 'x').replace(/≈/g, '~').replace(/²/g, '2');
    const barva = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    const dash = { carkovana: [4, 2], tecky: [0.6, 1.2] };
    const ctverec = (x, y) => {
      doc.setDrawColor(0); doc.setLineWidth(0.3); doc.setLineDashPattern([], 0); doc.rect(x, y, 50, 50);
      doc.setFontSize(7); doc.setTextColor(0); doc.text(txt('kontrolní čtverec 50 × 50 mm'), x + 25, y + 26, { align: 'center' });
    };
    if (o.info) {
      // úvodní list: popis, legenda, mapa listů, kontrolní čtverec
      const m = r.okraj; let y = m + 6;
      doc.setFontSize(13); doc.setTextColor(0); doc.text(txt(v.typ.nazev), m, y); y += 7;
      doc.setFontSize(9);
      for (const rad of popisRadky(v).slice(1)) { const l = doc.splitTextToSize(txt(rad), r.pw - 2 * m); doc.text(l, m, y); y += 4.6 * l.length; }
      if (v.poznamka) { const l = doc.splitTextToSize(txt(v.poznamka), r.pw - 2 * m); doc.text(l, m, y); y += 4.6 * l.length; }
      y += 3;
      for (const vr of ['CUT', 'CREASE', 'PERF', 'GLUE']) {
        const V = VRSTVY[vr]; doc.setDrawColor(...barva(V.barva)); doc.setLineWidth(0.4); doc.setLineDashPattern(dash[V.styl] || [], 0);
        doc.line(m, y - 1, m + 18, y - 1); doc.setTextColor(0); doc.text(txt(V.nazev + ' (' + vr + ')'), m + 22, y); y += 5;
      }
      doc.setLineDashPattern([], 0);
      y += 2;
      doc.text(txt(`Tisk 1:1 (měřítko „skutečná velikost“, bez přizpůsobení). Listů: ${r.nx} × ${r.ny} = ${r.n} (${r.pw > r.ph ? 'na šířku' : 'na výšku'}), překryv ${fmt(r.prek)} mm.`), m, y, { maxWidth: r.pw - 2 * m }); y += 9;
      // mapa listů
      const mw = Math.min(r.pw - 2 * m - 60, 120), sk = mw / Math.max(r.bw, 1), mh = r.bh * sk;
      if (y + mh + 60 > r.ph - m) { /* málo místa – mapa zmenšená */ }
      const mapH = Math.min(mh, r.ph - m - y - 58), sk2 = Math.min(sk, mapH / Math.max(r.bh, 1));
      doc.setDrawColor(150); doc.setLineWidth(0.2);
      for (const c of sc.cary) if (c.vrstva === 'CUT') {
        const pts = c.body.map(p => [m + (p[0] - sc.box.minx) * sk2, y + (sc.box.maxy - p[1]) * sk2]);
        for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; doc.line(a[0], a[1], b[0], b[1]); }
      }
      doc.setDrawColor(0, 120, 220); doc.setFontSize(7);
      for (let iy = 0; iy < r.ny; iy++) for (let ix = 0; ix < r.nx; ix++) {
        const x0 = ix * (r.uw - r.prek), y0 = iy * (r.uh - r.prek);
        doc.rect(m + x0 * sk2, y + y0 * sk2, Math.min(r.uw, r.bw - x0) * sk2, Math.min(r.uh, r.bh - y0) * sk2);
        doc.setTextColor(0, 120, 220); doc.text(`${iy + 1}/${ix + 1}`, m + x0 * sk2 + 1.5, y + y0 * sk2 + 3.5);
      }
      ctverec(r.pw - m - 50, r.ph - m - 50);
    }
    // listy s výřezem
    let prvni = !o.info;
    for (let iy = 0; iy < r.ny; iy++) for (let ix = 0; ix < r.nx; ix++) {
      if (!prvni) doc.addPage([r.pw, r.ph], r.pw > r.ph ? 'landscape' : 'portrait'); prvni = false;
      const x0 = sc.box.minx + ix * (r.uw - r.prek), yTop = sc.box.maxy - iy * (r.uh - r.prek);
      const PX = (x) => r.okraj + (x - x0), PY = (y) => r.okraj + (yTop - y);
      // ořez na užitnou plochu
      doc.saveGraphicsState();
      doc.rect(r.okraj, r.okraj, r.uw, r.uh, null); doc.clip(); doc.discardPath();
      for (const c of sc.cary) {
        const V = VRSTVY[c.vrstva];
        doc.setDrawColor(...barva(V.barva)); doc.setLineWidth(c.vrstva === 'CUT' || c.vrstva === 'CREASE' ? 0.3 : 0.18);
        doc.setLineDashPattern(dash[V.styl] || [], 0);
        const pts = c.body;
        const segs = [];
        for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
        if (c.uzavrena) segs.push([pts[pts.length - 1], pts[0]]);
        if (dash[V.styl]) {
          // čárkované čáry kreslíme jako jednu lomenou čáru, aby vzor navazoval
          const cesta = pts.map(p => [PX(p[0]), PY(p[1])]); if (c.uzavrena) cesta.push(cesta[0]);
          const rel = []; for (let i = 1; i < cesta.length; i++) rel.push([cesta[i][0] - cesta[i - 1][0], cesta[i][1] - cesta[i - 1][1]]);
          doc.lines(rel, cesta[0][0], cesta[0][1], [1, 1], 'S', false);
        } else for (const [a, b] of segs) doc.line(PX(a[0]), PY(a[1]), PX(b[0]), PY(b[1]));
      }
      doc.setLineDashPattern([], 0);
      for (const t of sc.texty) {
        const V = VRSTVY[t.vrstva]; doc.setTextColor(...barva(V.barva)); doc.setFontSize(t.vel / 0.3528);
        doc.text(txt(t.text), PX(t.x), PY(t.y), { angle: t.uhel || 0, align: t.zarovnani === 'stred' ? 'center' : 'left', baseline: t.nadCarou ? 'bottom' : 'middle' });
      }
      doc.restoreGraphicsState();
      // značky a popis listu
      doc.setDrawColor(0); doc.setLineWidth(0.15); doc.setLineDashPattern([], 0);
      const m = r.okraj, Wl = r.uw, Hl = r.uh;
      for (const [x, y] of [[m, m], [m + Wl, m], [m, m + Hl], [m + Wl, m + Hl]]) { doc.line(x - 4, y, x + 4, y); doc.line(x, y - 4, x, y + 4); }
      doc.setDrawColor(120); doc.setLineDashPattern([1, 1], 0);
      if (ix > 0) doc.line(m + r.prek, m, m + r.prek, m + Hl);
      if (iy > 0) doc.line(m, m + r.prek, m + Wl, m + r.prek);
      doc.setLineDashPattern([], 0);
      doc.setFontSize(7); doc.setTextColor(80);
      doc.text(txt(`${v.typ.kod} ${fmt(v.P.D)}×${fmt(v.P.S)}×${fmt(v.P.V)} – list řádek ${iy + 1}/${r.ny}, sloupec ${ix + 1}/${r.nx}` + (r.n > 1 ? ` (překryv ${fmt(r.prek)} mm vlevo/nahoře, zarovnat podle tečkované čáry)` : '')), m, r.ph - m / 2 + 1);
      // měřítko 50 mm v dolním okraji
      doc.setDrawColor(0); doc.setLineWidth(0.3);
      const sx = r.pw - m - 50, sy = r.ph - m / 2 - 1;
      doc.line(sx, sy, sx + 50, sy); for (let i = 0; i <= 5; i++) doc.line(sx + i * 10, sy - (i % 5 ? 1 : 2), sx + i * 10, sy);
      doc.text('50 mm', sx + 51, sy + 0.8);
    }
    return doc;
  }

  const API = { VRSTVY, scena, svg, dxf, pdf, retezy, srafa, rozvrhListu, FORMATY, popisRadky, prepisDxf };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.KrabiceVystup = API;
})(typeof window !== 'undefined' ? window : globalThis);

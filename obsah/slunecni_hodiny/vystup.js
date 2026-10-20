/* ============================================================
   Sluneční hodiny – výstupy: SVG, DXF (R12), PDF 1:1 s dělením na listy
   Scéna viz jadro.js (mm, osa y dolů). Bez DOM – jsPDF se předává parametrem.
   ============================================================ */
(function (koren) {
  'use strict';
  const BARVY = {
    obrys: '#000000', ram: '#000000', hodiny: '#000000', pul: '#222222', ctvrt: '#222222', datum: '#1f5fa8',
    cisla: '#000000', dst: '#b3261e', text: '#000000', pomoc: '#7a7a7a', stin: '#3a3a3a', stinbod: '#d04a00',
  };
  const PORADI = ['pomoc', 'ram', 'datum', 'ctvrt', 'pul', 'hodiny', 'cisla', 'dst', 'text', 'obrys'];
  const DXF_BARVA = { obrys: 1, ram: 7, hodiny: 7, pul: 8, ctvrt: 8, datum: 5, cisla: 7, dst: 3, text: 7, pomoc: 9 };
  const n = (x) => (Math.round(x * 1000) / 1000).toString();
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const R = Math.PI / 180;
  const barva = (v, o) => (o && o.cernobile && v !== 'stin' && v !== 'stinbod' ? '#000000' : BARVY[v] || '#000000');

  /** bod účaří textu: střed (x, y) posunutý o 0,35 h „dolů“ vzhledem k otočení */
  function ucari(e) {
    const u = (e.u || 0) * R;
    return [e.x + Math.sin(u) * 0.35 * e.h, e.y + Math.cos(u) * 0.35 * e.h];
  }

  /* ---------------- SVG ---------------- */
  function svgPrvek(e, o) {
    const c = barva(e.v, o);
    if (e.t === 'l' || e.t === 'p') {
      const d = e.b.map((q, i) => (i ? 'L' : 'M') + n(q[0]) + ' ' + n(q[1])).join('') + (e.z || e.t === 'p' ? 'Z' : '');
      if (e.f || e.t === 'p') return `<path d="${d}" fill="${c}"${e.v === 'stin' ? ' fill-opacity="0.55"' : ''}/>`;
      return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${n(e.s || 0.2)}" stroke-linejoin="round" stroke-linecap="round"${e.d ? ` stroke-dasharray="${n((e.s || 0.2) * 6)} ${n((e.s || 0.2) * 4)}"` : ''}${e.v === 'stin' ? ' stroke-opacity="0.6"' : ''}/>`;
    }
    if (e.t === 'k') return e.f ? `<circle cx="${n(e.x)}" cy="${n(e.y)}" r="${n(e.r)}" fill="${c}"/>` : `<circle cx="${n(e.x)}" cy="${n(e.y)}" r="${n(e.r)}" fill="none" stroke="${c}" stroke-width="${n(e.s || 0.2)}"/>`;
    if (e.t === 'txt') {
      const [bx, by] = ucari(e), an = e.a === 'l' ? 'start' : e.a === 'r' ? 'end' : 'middle';
      const rot = e.u ? ` transform="rotate(${n(-e.u)} ${n(bx)} ${n(by)})"` : '';
      return `<text x="${n(bx)}" y="${n(by)}" font-size="${n(e.h)}" text-anchor="${an}" fill="${c}"${rot}>${esc(e.txt)}</text>`;
    }
    return '';
  }
  /** SVG scény; o: {okraj, pozadi, cernobile, pomoc (false = skrýt pomocné), simulace (vloží <g id="simStin">), sirkaPx} */
  function svg(sc, o) {
    o = Object.assign({ okraj: 4, pozadi: '#ffffff', pomoc: true }, o || {});
    const m = o.okraj, x = sc.x0 - m, y = sc.y0 - m, w = sc.w + 2 * m, h = sc.h + 2 * m;
    const rozm = o.sirkaPx ? `width="100%"` : `width="${n(w)}mm" height="${n(h)}mm"`;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" ${rozm} viewBox="${n(x)} ${n(y)} ${n(w)} ${n(h)}" font-family="Liberation Sans, Arial, Helvetica, sans-serif">`;
    if (o.pozadi) s += `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${o.pozadi}"/>`;
    for (const v of PORADI) {
      if (v === 'pomoc' && !o.pomoc) continue;
      const el = sc.prvky.filter((e) => e.v === v);
      if (!el.length) continue;
      s += `<g id="vrstva-${v}" inkscape:label="${v}" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" inkscape:groupmode="layer">`;
      for (const e of el) s += svgPrvek(e, o);
      s += '</g>';
    }
    if (o.simulace) s += '<g id="simStin"></g>';
    return s + '</svg>';
  }
  const svgPrvky = (prvky, o) => prvky.map((e) => svgPrvek(e, o)).join('');

  /* ---------------- DXF (R12, mm, osa y nahoru) ---------------- */
  function dxf(sc, o) {
    o = Object.assign({ pomoc: false }, o || {});
    const L = [], g = (k, v) => { L.push(String(k)); L.push(String(v)); };
    const vrstvy = Object.keys(DXF_BARVA).filter((v) => o.pomoc || v !== 'pomoc');
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, vrstvy.length);
    for (const v of vrstvy) { g(0, 'LAYER'); g(2, v.toUpperCase()); g(70, 0); g(62, DXF_BARVA[v]); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    const Y = (y) => -y;
    for (const e of sc.prvky) {
      if (!vrstvy.includes(e.v)) continue;
      const ly = e.v.toUpperCase();
      if (e.t === 'l' || e.t === 'p') {
        g(0, 'POLYLINE'); g(8, ly); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, e.z || e.t === 'p' ? 1 : 0);
        for (const q of e.b) { g(0, 'VERTEX'); g(8, ly); g(10, n(q[0])); g(20, n(Y(q[1]))); g(30, 0); }
        g(0, 'SEQEND'); g(8, ly);
      } else if (e.t === 'k') {
        g(0, 'CIRCLE'); g(8, ly); g(10, n(e.x)); g(20, n(Y(e.y))); g(30, 0); g(40, n(e.r));
      } else if (e.t === 'txt') {
        const [bx, by] = ucari(e), al = e.a === 'l' ? 0 : e.a === 'r' ? 2 : 1;
        g(0, 'TEXT'); g(8, ly); g(10, n(bx)); g(20, n(Y(by))); g(30, 0); g(40, n(e.h * 0.72)); g(1, String(e.txt));
        if (e.u) g(50, n(e.u));
        if (al) { g(72, al); g(11, n(bx)); g(21, n(Y(by))); g(31, 0); }
      }
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return L.join('\r\n') + '\r\n';
  }

  /* ---------------- dělení na listy ---------------- */
  /** rozvrh listů pro scénu na papír pw×ph; volí orientaci s menším počtem listů */
  function rozvrhListu(sc, pw, ph, okraj, prekryv) {
    const varianta = (W, H) => {
      const uw = W - 2 * okraj, uh = H - 2 * okraj - 8;
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
      // celkovou plochu vystředit, aby přesah byl rovnoměrný
      const cw = v.nx * (v.uw - v.g) + v.g, chh = v.ny * (v.uh - v.g) + v.g;
      const ox = sc.x0 - (cw - sc.w) / 2, oy = sc.y0 - (chh - sc.h) / 2;
      for (let r = 0; r < v.ny; r++) for (let c = 0; c < v.nx; c++) listy.push({ sx: ox + c * (v.uw - v.g), sy: oy + r * (v.uh - v.g), r, c });
    }
    return Object.assign(v, { listy });
  }

  /* ---------------- PDF ---------------- */
  const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/·/g, '-').replace(/[„“]/g, '"').replace(/°/g, ' st.');
  function rgb(hex) { const v = parseInt(hex.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }

  /**
   * PDF; stranky = [{scena, nadpis, deleni (true = smí se dělit na listy)} | {text:[řádky], scena?, nadpis, ctverec}]
   * o: {papir:[w,h], okraj, prekryv, pismo (TTF base64), cernobile, nazev}
   */
  function pdf(jsPDF, stranky, o) {
    o = Object.assign({ papir: [210, 297], okraj: 8, prekryv: 12 }, o || {});
    const [pw, ph] = o.papir;
    let doc = null, uni = false;
    const T = (s) => (uni ? String(s) : bezDiakritiky(s));
    const novaStrana = (W, H) => {
      if (doc) { doc.addPage([W, H], W > H ? 'l' : 'p'); return; }
      doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: W > H ? 'l' : 'p', compress: true });
      if (o.pismo) {
        try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; }
        catch (e) { doc.setFont('helvetica', 'normal'); }
      }
      doc.setProperties({ title: o.nazev || 'Sluneční hodiny', creator: 'Sluneční hodiny – návrh a tisk' });
    };
    const text = (txt, x, y, h, a, u, c) => {
      doc.setFontSize(h / 0.3528);
      if (c) doc.setTextColor(...rgb(c));
      const t = T(txt), w = doc.getTextWidth(t), uu = (u || 0) * R;
      const bx = x + Math.sin(uu) * 0.35 * h, by = y + Math.cos(uu) * 0.35 * h;
      const k = a === 'r' ? w : a === 'c' ? w / 2 : 0;
      const sx = bx - Math.cos(uu) * k, sy = by + Math.sin(uu) * k;
      doc.text(t, sx, sy, u ? { angle: u } : undefined);
    };
    const kresli = (e, X, Y) => {
      const c = rgb(barva(e.v, o));
      doc.setDrawColor(...c); doc.setFillColor(...c);
      if (e.t === 'l' || e.t === 'p') {
        doc.setLineWidth(Math.max(0.05, e.s || 0.2));
        if (e.d) doc.setLineDashPattern([(e.s || 0.2) * 6, (e.s || 0.2) * 4], 0);
        const b = e.b.map((q) => [X(q[0]), Y(q[1])]);
        const seg = []; for (let i = 1; i < b.length; i++) seg.push([b[i][0] - b[i - 1][0], b[i][1] - b[i - 1][1]]);
        doc.lines(seg, b[0][0], b[0][1], [1, 1], e.t === 'p' || e.f ? 'F' : 'S', !!(e.z || e.t === 'p'));
        if (e.d) doc.setLineDashPattern([], 0);
      } else if (e.t === 'k') {
        doc.setLineWidth(Math.max(0.05, e.s || 0.2));
        doc.circle(X(e.x), Y(e.y), e.r, e.f ? 'F' : 'S');
      } else if (e.t === 'txt') text(e.txt, X(e.x), Y(e.y), e.h, e.a, e.u, barva(e.v, o));
    };
    const vse = (sc, X, Y) => { for (const v of PORADI) for (const e of sc.prvky) if (e.v === v && (o.pomoc !== false || v !== 'pomoc')) kresli(e, X, Y); };
    const meritko = (x, y) => {
      // úsečka 50 mm s dílky po 10 mm
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25);
      doc.line(x, y, x + 50, y);
      for (let i = 0; i <= 5; i++) doc.line(x + i * 10, y - (i % 5 ? 1 : 2), x + i * 10, y);
      text('50 mm – kontrola měřítka 1:1', x + 52, y - 0.6, 2.6, 'l', 0, '#000000');
    };
    const ctverec = (x, y) => {
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25); doc.rect(x, y, 50, 50, 'S');
      text('50 × 50 mm', x + 25, y + 25, 4, 'c', 0, '#000000');
      text('Změřte pravítkem: po tisku musí mít čtverec přesně 50 mm.', x, y + 54, 2.8, 'l', 0, '#000000');
    };
    let cisloStrany = 0;
    for (const st of stranky) {
      if (st.scena && st.deleni !== false) {
        const rv = rozvrhListu(st.scena, pw, ph, o.okraj, o.prekryv), N = rv.listy.length;
        for (const l of rv.listy) {
          novaStrana(rv.W, rv.H); cisloStrany++;
          const X = (x) => o.okraj + (x - l.sx), Y = (y) => o.okraj + (y - l.sy);
          doc.saveGraphicsState();
          doc.rect(o.okraj, o.okraj, rv.uw, rv.uh, null); doc.clip(); doc.discardPath();
          vse(st.scena, X, Y);
          doc.restoreGraphicsState();
          if (!rv.jeden) {
            // pásmo lepení: čárkovaná čára, kam přijde levý/horní okraj dalšího listu
            doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.2); doc.setLineDashPattern([2, 1.5], 0);
            if (l.c < rv.nx - 1) doc.line(o.okraj + rv.uw - rv.g, o.okraj, o.okraj + rv.uw - rv.g, o.okraj + rv.uh);
            if (l.r < rv.ny - 1) doc.line(o.okraj, o.okraj + rv.uh - rv.g, o.okraj + rv.uw, o.okraj + rv.uh - rv.g);
            doc.setLineDashPattern([], 0);
            // rohové značky výřezu
            doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2);
            for (const [x, y] of [[o.okraj, o.okraj], [o.okraj + rv.uw, o.okraj], [o.okraj, o.okraj + rv.uh], [o.okraj + rv.uw, o.okraj + rv.uh]]) {
              doc.line(x - 3, y, x + 3, y); doc.line(x, y - 3, x, y + 3);
            }
            if (l.c > 0 || l.r > 0) text('ořízněte ' + (l.c > 0 ? 'levý' : '') + (l.c > 0 && l.r > 0 ? ' a ' : '') + (l.r > 0 ? 'horní' : '') + ' okraj a přiložte na čárkovanou čáru sousedního listu', o.okraj + 2, o.okraj - 2.2, 2.4, 'l', 0, '#555555');
          }
          const pata = rv.H - o.okraj - 2;
          text((st.nadpis || '') + (N > 1 ? ` · list ${l.r * rv.nx + l.c + 1}/${N} (řádek ${l.r + 1}, sloupec ${l.c + 1})` : '') + ' · tiskněte 1:1 (bez přizpůsobení)', o.okraj, pata, 2.6, 'l', 0, '#000000');
          meritko(rv.W - o.okraj - 92, pata);
          if (N > 1) {
            // náhled rozložení listů
            const mx = rv.W - o.okraj - 3 * rv.nx - 98, my = pata - 3 * rv.ny + 0.5;
            doc.setLineWidth(0.15);
            for (let r = 0; r < rv.ny; r++) for (let c = 0; c < rv.nx; c++) {
              if (r === l.r && c === l.c) { doc.setFillColor(80, 80, 80); doc.rect(mx + c * 3, my + r * 3, 2.6, 2.6, 'FD'); }
              else doc.rect(mx + c * 3, my + r * 3, 2.6, 2.6, 'S');
            }
          }
        }
      } else {
        novaStrana(pw, ph); cisloStrany++;
        let y = o.okraj + 6;
        if (st.nadpis) { text(st.nadpis, o.okraj, y, 5.2, 'l', 0, '#000000'); y += 8; }
        if (st.scena) {
          const sc = st.scena, k = Math.min(1, (pw - 2 * o.okraj) / sc.w);
          if (k < 1) {
            // graf zmenšit (není to měřená šablona)
            const X = (x) => o.okraj + (x - sc.x0) * k, Y = (yy) => y + (yy - sc.y0) * k;
            for (const v of PORADI) for (const e of sc.prvky) if (e.v === v) {
              const f = Object.assign({}, e);
              if (f.h) f.h *= k; if (f.r) f.r *= k; if (f.s) f.s *= k;
              kresli(f, X, Y);
            }
          } else vse(sc, (x) => o.okraj + (x - sc.x0), (yy) => y + (yy - sc.y0));
          y += sc.h * k + 6;
        }
        for (const r of st.text || []) {
          const tucne = r.startsWith('# '), t = tucne ? r.slice(2) : r, vel = tucne ? 3.8 : 3;
          doc.setFontSize(vel / 0.3528);
          const radky = doc.splitTextToSize(T(t), pw - 2 * o.okraj);
          for (const rr of radky) {
            if (y > ph - o.okraj - 8) { novaStrana(pw, ph); y = o.okraj + 6; }
            doc.setFontSize(vel / 0.3528); doc.setTextColor(0, 0, 0);
            doc.text(rr, o.okraj, y); y += vel * 1.45;
          }
          y += tucne ? 0.6 : 0.8;
        }
        if (st.ctverec) {
          if (y + 60 > ph - o.okraj) { novaStrana(pw, ph); y = o.okraj + 6; }
          ctverec(o.okraj, y + 2);
        }
      }
    }
    void cisloStrany;
    if (!doc) novaStrana(pw, ph);
    return doc;
  }

  const API = { svg, svgPrvky, dxf, pdf, rozvrhListu, BARVY, bezDiakritiky };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.SHV = API;
})(typeof window !== 'undefined' ? window : globalThis);

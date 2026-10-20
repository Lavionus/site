/* ============================================================
   Šablony truhlářských spojů – výstupy: SVG, DXF (R12), PDF 1:1 s dělením na listy (bez DOM)
   Scéna: {x0, y0, w, h, prvky} v mm, osa y dolů (viz sablony.js). jsPDF se předává parametrem.
   ============================================================ */
(function (koren) {
  'use strict';
  const J = koren.TSJ || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const fmt = J.fmt;
  const STYL = {
    odpadVypln: { f: '#eeeeee' }, pila: { f: '#a8a8a8' }, odpad: { c: '#6a6a6a' }, obrys: { c: '#000000' }, rez: { c: '#000000' },
    ohyb: { c: '#000000' }, pomoc: { c: '#8a8a8a' }, znacka: { c: '#b3261e' }, text: { c: '#000000' }, nadpis: { c: '#000000' },
    odpadText: { c: '#333333' }, hrana: { c: '#000000' }, skryte: { c: '#666666' }, kota: { c: '#1f5fa8', f: '#1f5fa8' }, kotaText: { c: '#1f5fa8' },
    dilText: { c: '#b3261e' }, profil: { c: '#000000' },
  };
  const PORADI = ['odpadVypln', 'pila', 'odpad', 'pomoc', 'skryte', 'obrys', 'hrana', 'profil', 'rez', 'ohyb', 'znacka', 'kota', 'odpadText', 'kotaText', 'dilText', 'text', 'nadpis'];
  const DXF_BARVA = { obrys: 7, rez: 1, ohyb: 5, znacka: 3, pomoc: 8, text: 7, nadpis: 7, hrana: 7, skryte: 8, kota: 5, kotaText: 5, dilText: 1, profil: 7 };
  const n = (x) => { const v = Math.round(x * 1000) / 1000; return Number.isFinite(v) ? String(v) : '0'; };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const barva = (e, cb, typ) => (cb && typ !== 'f' && e.v !== 'odpadVypln' && e.v !== 'pila') ? '#000000' : ((STYL[e.v] || {})[typ] || (typ === 'f' ? '#000000' : '#000000'));

  /* ---------------- SVG ---------------- */
  function svgPrvek(e, o) {
    if (e.t === 'l') {
      const d = e.b.map((q, i) => (i ? 'L' : 'M') + n(q[0]) + ' ' + n(q[1])).join('') + (e.z ? 'Z' : '');
      const s = e.s || 0.25;
      return `<path d="${d}" fill="none" stroke="${barva(e, o.cernobile, 'c')}" stroke-width="${n(s)}" stroke-linecap="round" stroke-linejoin="round"${e.d ? ` stroke-dasharray="${n(Math.max(1.2, s * 6))} ${n(Math.max(0.8, s * 4))}"` : ''}/>`;
    }
    if (e.t === 'p') {
      const d = e.b.map((R) => R.map((q, i) => (i ? 'L' : 'M') + n(q[0]) + ' ' + n(q[1])).join('') + 'Z').join('');
      return `<path d="${d}" fill="${barva(e, o.cernobile, 'f')}" fill-rule="evenodd"${e.v === 'pila' ? ' fill-opacity="0.75"' : ''}/>`;
    }
    if (e.t === 'txt') {
      const an = e.a === 'l' ? 'start' : e.a === 'r' ? 'end' : 'middle';
      const by = e.y + 0.35 * e.h;
      const rot = e.u ? ` transform="rotate(${n(-e.u)} ${n(e.x)} ${n(e.y)})"` : '';
      return `<text x="${n(e.x)}" y="${n(by)}" font-size="${n(e.h)}" text-anchor="${an}" fill="${barva(e, o.cernobile, 'c')}"${e.v === 'nadpis' || e.v === 'dilText' ? ' font-weight="bold"' : ''}${rot}>${esc(e.txt)}</text>`;
    }
    return '';
  }
  /** SVG scény; o: {okraj, sirkaPx (true = width 100 %), cernobile, meritko (true = přidat úsečku 50 mm)} */
  function svg(sc, o) {
    o = Object.assign({ okraj: 4 }, o || {});
    const m = o.okraj, x = sc.x0 - m, y = sc.y0 - m - (o.meritko ? 0 : 0), w = sc.w + 2 * m, h = sc.h + 2 * m + (o.meritko ? 10 : 0);
    const rozm = o.sirkaPx ? 'width="100%"' : `width="${n(w)}mm" height="${n(h)}mm"`;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" ${rozm} viewBox="${n(x)} ${n(y)} ${n(w)} ${n(h)}" font-family="Liberation Sans, Arial, Helvetica, sans-serif">`;
    s += `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="#ffffff"/>`;
    for (const v of PORADI) {
      const el = sc.prvky.filter((e) => e.v === v);
      if (!el.length) continue;
      s += `<g id="vrstva-${v}">` + el.map((e) => svgPrvek(e, o)).join('') + '</g>';
    }
    if (o.meritko) {
      const yy = sc.y0 + sc.h + m + 6, xx = sc.x0;
      s += `<g id="meritko"><path d="M${n(xx)} ${n(yy)}h50" stroke="#000" stroke-width="0.3" fill="none"/>`;
      for (let i = 0; i <= 5; i++) s += `<path d="M${n(xx + i * 10)} ${n(yy)}v${i % 5 ? -1.2 : -2.4}" stroke="#000" stroke-width="0.25"/>`;
      s += `<text x="${n(xx + 52)}" y="${n(yy)}" font-size="2.6" fill="#000">50 mm – kontrola měřítka 1:1</text></g>`;
    }
    return s + '</svg>';
  }
  /** víc scén pod sebe do jedné scény (pro jeden SVG soubor) */
  function poskladej(sceny, mezera) {
    mezera = mezera == null ? 12 : mezera;
    const prvky = []; let y = 0, w = 0;
    for (const sc of sceny) {
      const dx = -sc.x0, dy = y - sc.y0;
      for (const e of sc.prvky) {
        if (e.t === 'txt') prvky.push(Object.assign({}, e, { x: e.x + dx, y: e.y + dy }));
        else if (e.t === 'p') prvky.push(Object.assign({}, e, { b: e.b.map((R) => R.map((q) => [q[0] + dx, q[1] + dy])) }));
        else prvky.push(Object.assign({}, e, { b: e.b.map((q) => [q[0] + dx, q[1] + dy]) }));
      }
      y += sc.h + mezera; w = Math.max(w, sc.w);
    }
    return { x0: 0, y0: 0, w, h: Math.max(0, y - mezera), prvky };
  }

  /* ---------------- DXF (R12, mm, osa y nahoru) ---------------- */
  function dxf(sc, o) {
    o = Object.assign({ srafy: false }, o || {});
    const L = [], g = (k, v) => { L.push(String(k)); L.push(String(v)); };
    const vrstvy = Object.keys(DXF_BARVA);
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, vrstvy.length + 1);
    for (const v of vrstvy.concat(['odpad'])) { g(0, 'LAYER'); g(2, v.toUpperCase()); g(70, 0); g(62, DXF_BARVA[v] || 8); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    const Y = (y) => -y;
    const poly = (b, z, ly) => {
      g(0, 'POLYLINE'); g(8, ly); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, z ? 1 : 0);
      for (const q of b) { g(0, 'VERTEX'); g(8, ly); g(10, n(q[0])); g(20, n(Y(q[1]))); g(30, 0); }
      g(0, 'SEQEND'); g(8, ly);
    };
    for (const e of sc.prvky) {
      if (e.v === 'odpadVypln' || e.v === 'pila' || (e.v === 'odpad' && !o.srafy) || e.v === 'odpadText') continue;
      const ly = e.v.toUpperCase();
      if (e.t === 'l') poly(e.b, e.z, ly);
      else if (e.t === 'p') { if (e.v === 'kota') continue; for (const R of e.b) poly(R, true, ly); }
      else if (e.t === 'txt') {
        const al = e.a === 'l' ? 0 : e.a === 'r' ? 2 : 1, by = e.y + 0.35 * e.h;
        g(0, 'TEXT'); g(8, ly); g(10, n(e.x)); g(20, n(Y(by))); g(30, 0); g(40, n(e.h * 0.72)); g(1, String(e.txt));
        if (e.u) g(50, n(e.u));
        if (al) { g(72, al); g(11, n(e.x)); g(21, n(Y(by))); g(31, 0); }
      }
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return L.join('\r\n') + '\r\n';
  }

  /** profily těles pro CNC / laser: každé těleso jako obrys v rovině (u, v), vedle sebe, s popiskem */
  function profily(S) {
    const prvky = [];
    let x = 0, vyska = 0;
    const OSY_N = { x: ['y', 'z'], y: ['z', 'x'], z: ['x', 'y'] };
    for (const d of S.dily) {
      const telesa = d.kolik || d.lamela ? d.telesa.slice(0, 1) : d.telesa;
      for (const T of telesa) {
        let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
        for (const q of T.poly) { u0 = Math.min(u0, q[0]); u1 = Math.max(u1, q[0]); v0 = Math.min(v0, q[1]); v1 = Math.max(v1, q[1]); }
        const W = u1 - u0, H = v1 - v0;
        if (W > 1500 || H > 1500) continue;
        const tr = (q) => [x + q[0] - u0, -(q[1] - v0)];
        prvky.push({ t: 'l', b: T.poly.map(tr), z: true, v: 'profil', s: 0.25 });
        for (const D of T.diry || []) prvky.push({ t: 'l', b: D.map(tr), z: true, v: 'profil', s: 0.25 });
        const os = OSY_N[T.osa];
        prvky.push({ t: 'txt', x: x, y: 5, h: 2.6, txt: `${d.id}${d.pocet > 1 ? ' ×' + d.pocet : ''}: ${os[0]}–${os[1]}, tl. ${fmt(T.w1 - T.w0, 2)} mm (${T.osa} ${fmt(T.w0, 1)}…${fmt(T.w1, 1)})`, a: 'l', v: 'text' });
        x += Math.max(W, 60) + 10; vyska = Math.max(vyska, H);
      }
    }
    return { x0: -2, y0: -vyska - 2, w: x, h: vyska + 10, prvky };
  }

  /* ---------------- dělení na listy ---------------- */
  function rozvrhListu(sc, pw, ph, okraj, prekryv) {
    const varianta = (W, H) => {
      const uw = W - 2 * okraj, uh = H - 2 * okraj - 9;
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

  /* ---------------- PDF ---------------- */
  const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/·/g, '-').replace(/[„“]/g, '"').replace(/°/g, ' st.').replace(/×/g, 'x');
  function rgb(hex) { const v = parseInt(hex.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  /**
   * stranky = [{scena, nadpis, deleni:true (1:1, smí se dělit)} | {scena, nadpis, zmensit:true} | {text:[řádky], nadpis, ctverec, tabulka}]
   * o: {papir:[w,h], okraj, prekryv, pismo (TTF base64), cernobile, nazev}
   */
  function pdf(jsPDF, stranky, o) {
    o = Object.assign({ papir: [210, 297], okraj: 8, prekryv: 12 }, o || {});
    const [pw, ph] = o.papir;
    let doc = null, uni = false;
    const T = (s) => (uni ? String(s) : bezDiakritiky(s));
    const novaStrana = (W, H) => {
      if (doc) { doc.addPage([W, H], W > H ? 'l' : 'p'); return; }
      doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: W > H ? 'l' : 'p', compress: o.compress !== false });
      if (o.pismo) {
        try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; }
        catch (e) { doc.setFont('helvetica', 'normal'); }
      }
      doc.setProperties({ title: o.nazev || 'Šablony truhlářských spojů', creator: 'Šablony truhlářských spojů' });
    };
    const text = (txt, x, y, h, a, u, c) => {
      doc.setFont(uni ? 'LS' : 'helvetica', 'normal');
      doc.setFontSize(h / 0.3528);
      doc.setTextColor(...rgb(c || '#000000'));
      const t = T(txt), w = doc.getTextWidth(t), uu = (u || 0) * Math.PI / 180;
      const bx = x + Math.sin(uu) * 0.35 * h, by = y + Math.cos(uu) * 0.35 * h;
      const k = a === 'r' ? w : a === 'c' ? w / 2 : 0;
      doc.text(t, bx - Math.cos(uu) * k, by + Math.sin(uu) * k, u ? { angle: u } : undefined);
    };
    const kresli = (e, X, Y, k) => {
      k = k || 1;
      if (e.t === 'l') {
        const c = rgb(barva(e, o.cernobile, 'c'));
        doc.setDrawColor(...c); doc.setLineWidth(Math.max(0.05, (e.s || 0.25) * (k < 1 ? Math.max(0.6, k) : 1)));
        if (e.d) { const s = e.s || 0.25; doc.setLineDashPattern([Math.max(1.2, s * 6), Math.max(0.8, s * 4)], 0); }
        const b = e.b.map((q) => [X(q[0]), Y(q[1])]);
        const seg = []; for (let i = 1; i < b.length; i++) seg.push([b[i][0] - b[i - 1][0], b[i][1] - b[i - 1][1]]);
        if (seg.length) doc.lines(seg, b[0][0], b[0][1], [1, 1], 'S', !!e.z);
        if (e.d) doc.setLineDashPattern([], 0);
      } else if (e.t === 'p') {
        const c = rgb(barva(e, o.cernobile, 'f'));
        doc.setFillColor(...c);
        // každý kruh zvlášť; díry (záporná orientace) přebarvit bíle by bylo špatně → kreslit sudo-liché přes path
        for (const R of e.b) {
          const b = R.map((q) => [X(q[0]), Y(q[1])]);
          const seg = []; for (let i = 1; i < b.length; i++) seg.push([b[i][0] - b[i - 1][0], b[i][1] - b[i - 1][1]]);
          if (seg.length) doc.lines(seg, b[0][0], b[0][1], [1, 1], J.plocha(R) < 0 && e.b.length > 1 ? null : 'F', true);
        }
      } else if (e.t === 'txt') text(e.txt, X(e.x), Y(e.y), e.h * k, e.a, e.u, barva(e, o.cernobile, 'c'));
    };
    const vse = (sc, X, Y, k) => {
      // výplně odpadu kreslit sudo-liché: díry (např. kolem čepu) se vynechají
      for (const v of PORADI) for (const e of sc.prvky) if (e.v === v) {
        if (e.t === 'p' && e.b.length > 1) {
          const c = rgb(barva(e, o.cernobile, 'f')); doc.setFillColor(...c);
          const cesta = [];
          for (const R of e.b) { cesta.push({ op: 'm', c: [X(R[0][0]), Y(R[0][1])] }); for (let i = 1; i < R.length; i++) cesta.push({ op: 'l', c: [X(R[i][0]), Y(R[i][1])] }); cesta.push({ op: 'h', c: [] }); }
          try { doc.path(cesta); doc.fillEvenOdd(); } catch (er) { kresli(e, X, Y, k); }
        } else kresli(e, X, Y, k);
      }
    };
    const meritko = (x, y) => {
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25);
      doc.line(x, y, x + 50, y);
      for (let i = 0; i <= 5; i++) doc.line(x + i * 10, y - (i % 5 ? 1 : 2), x + i * 10, y);
      text('50 mm – kontrola měřítka 1:1', x + 52, y - 0.6, 2.6, 'l', 0, '#000000');
    };
    const ctverec = (x, y) => {
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25); doc.rect(x, y, 50, 50, 'S');
      text('50 × 50 mm', x + 25, y + 25, 4, 'c', 0, '#000000');
      text('Po tisku změřte: čtverec musí mít přesně 50 mm (tisk „skutečná velikost“, ne „přizpůsobit“).', x, y + 54, 2.8, 'l', 0, '#000000');
    };
    for (const st of stranky) {
      if (st.scena && st.deleni) {
        const rv = rozvrhListu(st.scena, pw, ph, o.okraj, o.prekryv), N = rv.listy.length;
        for (const l of rv.listy) {
          novaStrana(rv.W, rv.H);
          const X = (x) => o.okraj + (x - l.sx), Y = (y) => o.okraj + (y - l.sy);
          doc.saveGraphicsState();
          doc.rect(o.okraj, o.okraj, rv.uw, rv.uh, null); doc.clip(); doc.discardPath();
          vse(st.scena, X, Y);
          doc.restoreGraphicsState();
          if (!rv.jeden) {
            doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.2); doc.setLineDashPattern([2, 1.5], 0);
            if (l.c < rv.nx - 1) doc.line(o.okraj + rv.uw - rv.g, o.okraj, o.okraj + rv.uw - rv.g, o.okraj + rv.uh);
            if (l.r < rv.ny - 1) doc.line(o.okraj, o.okraj + rv.uh - rv.g, o.okraj + rv.uw, o.okraj + rv.uh - rv.g);
            doc.setLineDashPattern([], 0);
            doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2);
            for (const [x, y] of [[o.okraj, o.okraj], [o.okraj + rv.uw, o.okraj], [o.okraj, o.okraj + rv.uh], [o.okraj + rv.uw, o.okraj + rv.uh]]) { doc.line(x - 3, y, x + 3, y); doc.line(x, y - 3, x, y + 3); }
            if (l.c > 0 || l.r > 0) text('ořízněte ' + (l.c > 0 ? 'levý' : '') + (l.c > 0 && l.r > 0 ? ' a ' : '') + (l.r > 0 ? 'horní' : '') + ' okraj a přiložte na čárkovanou čáru sousedního listu', o.okraj + 2, o.okraj - 2.4, 2.4, 'l', 0, '#555555');
          }
          const pata = rv.H - o.okraj - 2;
          text([st.nadpis, N > 1 ? `list ${l.r * rv.nx + l.c + 1}/${N} (řádek ${l.r + 1}, sloupec ${l.c + 1})` : '', 'tiskněte 1:1'].filter(Boolean).join(' · '), o.okraj, pata, 2.6, 'l', 0, '#000000');
          meritko(rv.W - o.okraj - 92, pata);
          if (N > 1) {
            const mx = rv.W - o.okraj - 3 * rv.nx - 98, my = pata - 3 * rv.ny + 0.5;
            doc.setLineWidth(0.15); doc.setDrawColor(0, 0, 0);
            for (let r = 0; r < rv.ny; r++) for (let c = 0; c < rv.nx; c++) {
              if (r === l.r && c === l.c) { doc.setFillColor(80, 80, 80); doc.rect(mx + c * 3, my + r * 3, 2.6, 2.6, 'FD'); } else doc.rect(mx + c * 3, my + r * 3, 2.6, 2.6, 'S');
            }
          }
        }
      } else {
        novaStrana(pw, ph);
        let y = o.okraj + 6;
        if (st.nadpis) { text(st.nadpis, o.okraj, y, 5.2, 'l', 0, '#000000'); y += 8; }
        if (st.scena) {
          const sc = st.scena, k = Math.min(1, (pw - 2 * o.okraj) / sc.w, (ph - y - o.okraj - 12) / sc.h);
          const X = (x) => o.okraj + (x - sc.x0) * k, Y = (yy) => y + (yy - sc.y0) * k;
          vse(sc, X, Y, k);
          y += sc.h * k + 4;
          text(k < 0.999 ? `Zmenšeno v měřítku 1:${fmt(1 / k, 2)} – jen pro orientaci, neměřit.` : 'Měřítko 1:1.', o.okraj, y, 2.6, 'l', 0, '#555555');
          y += 6;
        }
        if (st.tabulka) {
          const tb = st.tabulka, sl = tb.sloupce, sirky = tb.sirky, vel = 2.8;
          const radek = (bunky, tucne) => {
            if (y > ph - o.okraj - 10) { novaStrana(pw, ph); y = o.okraj + 6; }
            let x = o.okraj;
            bunky.forEach((b, i) => { text(String(b), x + (sl[i] === 'r' ? sirky[i] - 1 : 0), y, vel, sl[i] === 'r' ? 'r' : 'l', 0, tucne ? '#000000' : '#222222'); x += sirky[i]; });
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
    if (!doc) novaStrana(pw, ph);
    return doc;
  }

  const API = { svg, svgPrvek, poskladej, dxf, profily, pdf, rozvrhListu, STYL, bezDiakritiky };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.TSV = API;
})(typeof window !== 'undefined' ? window : globalThis);

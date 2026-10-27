/* ============================================================
   Barefoot vložky – výstupy: scéna šablony v mm (osa y dolů), SVG 1:1,
   DXF R12 po vrstvách, PDF (souhrn + šablony 1:1, dlouhé vložky na více listů).
   ============================================================ */
(function (koren) {
  'use strict';
  const J = koren.BFJ || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const fmt = J.fmt;
  const MEZERA = 18, OKRAJ_SC = 6;
  const BARVY = { vrstva: '#7b3fa0', podpora: '#a0522d', obrys: '#000000', noha: '#1f5fa8', orez: '#c0392b', perf: '#000000', znacka: '#1e7d3a', text: '#000000', kota: '#555555', prst: '#1f5fa8' };

  /* ---------- scéna ---------- */
  /* o: { nohy: [indexy] (výchozí všechny), koty, nahled (prsty), popisky } */
  function scena(v, o) {
    o = o || {};
    const p = v.p, nohy = (o.nohy || v.nohy.map((_, i) => i)).map((i) => v.nohy[i]);
    /* obálka každé nohy: vložka (i s jazýčkem) a obrys chodidla – při záporném offsetu je chodidlo větší než vložka */
    const obalky = nohy.map((n) => J.obalka((n.tab ? n.tab.obrys : n.vlozka).concat(p.noha ? n.noha : [])));
    const top = Math.max(...obalky.map((q) => q.y1)), spodek = Math.min(...obalky.map((q) => q.y0)), prvky = [];
    const levyOkraj = o.koty ? 16 : 0;
    let ox = OKRAJ_SC + levyOkraj;
    const xPrvni = ox - obalky[0].x0;
    nohy.forEach((n, ni) => {
      const ob = obalky[ni], x0 = ox - ob.x0;
      const X = (x) => x0 + x, Y = (y) => OKRAJ_SC + top - y, tr = (P) => P.map(([x, y]) => [X(x), Y(y)]);
      const vrstva = (s) => s + '_' + n.strana;
      prvky.push({ t: 'l', b: tr(n.tab ? n.tab.obrys : n.vlozka), z: true, s: 0.4, c: BARVY.obrys, v: vrstva('OBRYS') });
      if (p.noha) prvky.push({ t: 'l', b: tr(n.noha), z: true, s: 0.2, c: BARVY.noha, d: true, v: vrstva('NOHA') });
      if (o.nahled && p.noha) for (const q of n.prsty) prvky.push({ t: 'k', x: X(q.x), y: Y(q.y), r: q.r, s: 0.15, c: BARVY.prst, d: true, v: 'NAHLED' });
      for (const r of n.orez) {
        if (r.body.length < 2) continue;
        prvky.push({ t: 'l', b: tr(r.body), s: r.bota ? 0.4 : 0.2, c: BARVY.orez, d: !r.bota, v: vrstva('OREZ') });
        const sp = r.body.reduce((a, q) => (q[1] > a[1] ? q : a), r.body[0]);
        prvky.push({ t: 'txt', x: X(sp[0]), y: Y(sp[1]) + 3.4, h: 2.3, txt: r.bota ? `bota ${fmt(p.delkaBoty)} mm` : `−${fmt(r.d)}`, a: 'c', c: BARVY.orez, v: vrstva('OREZ') });
      }
      if (n.vrstva2) {
        prvky.push({ t: 'l', b: tr(n.vrstva2), z: true, s: 0.3, c: BARVY.vrstva, d: true, v: vrstva('VRSTVA2') });
        prvky.push({ t: 'txt', x: X(n.Wt / 2), y: Y(0.06 * n.Lt) + 1, h: 2.2, txt: `spodní vrstva (−${fmt(p.vrstvaOds)} mm)`, a: 'c', c: BARVY.vrstva, v: vrstva('VRSTVA2') });
      }
      for (const q of n.podpory || []) {
        prvky.push({ t: 'l', b: tr(q.body), z: true, s: 0.3, c: BARVY.podpora, d: true, v: vrstva('PODPORY') });
        const o2 = J.obalka(q.body);
        prvky.push({ t: 'txt', x: X((o2.x0 + o2.x1) / 2), y: Y((o2.y0 + o2.y1) / 2) + 1, h: 2.2, txt: q.nazev, a: 'c', c: BARVY.podpora, v: vrstva('PODPORY') });
      }
      for (const q of n.perf) prvky.push({ t: 'k', x: X(q.x), y: Y(q.y), r: q.r, s: 0.2, c: BARVY.perf, v: vrstva('PERFORACE') });
      if (n.tab) prvky.push({ t: 'k', x: X(n.tab.otvor.x), y: Y(n.tab.otvor.y), r: n.tab.otvor.r, s: 0.3, c: BARVY.obrys, v: vrstva('OBRYS') });
      for (const z of n.znacky) {
        prvky.push({ t: 'l', b: [[X(z.x0 + 2), Y(z.y)], [X(z.x1 - 2), Y(z.y)]], s: z.d ? 0.2 : 0.35, c: BARVY.znacka, v: vrstva('ZNACKY') });
        prvky.push({ t: 'txt', x: X((z.x0 + z.x1) / 2), y: Y(z.y) - 0.9, h: 2.2, txt: z.d ? `+${fmt(z.d)} mm` : 'špička nohy', a: 'c', c: BARVY.znacka, v: vrstva('ZNACKY') });
      }
      if (p.popisky) {
        const cx = X(n.Wt / 2), ty = (y) => Y(y * n.Lt);
        prvky.push({ t: 'txt', x: cx, y: ty(0.36), h: 16, txt: n.strana, a: 'c', c: '#999999', v: vrstva('TEXT') });
        const radky = [];
        if (p.jmeno) radky.push(p.jmeno);
        radky.push(`${n.nazev} · vnitřní délka ${fmt(n.vel.vnitrni)} mm`);
        radky.push(`EU ~${fmt(n.vel.eu, n.vel.eu % 1 ? 1 : 0)} · noha ${fmt(n.m.delka)} × ${fmt(n.m.sirka)} mm`);
        if (p.rezim === 'vlozka') radky.push(`${J.MATERIALY[p.material].nazev.toLowerCase()} ${fmt(p.tloustka, 1)} mm`);
        else radky.push('vložte do boty, nesmí se ohýbat');
        if (n.orez.length) radky.push(`ořez ${n.orez.map((r) => '−' + fmt(r.d)).join('/')} = EU ~${n.orez.map((r) => fmt(r.velikost.eu, r.velikost.eu % 1 ? 1 : 0)).join('/')}`);
        radky.forEach((s, i) => prvky.push({ t: 'txt', x: cx, y: ty(0.27) + i * 3.6, h: 2.5, txt: s, a: 'c', c: BARVY.text, v: vrstva('TEXT') }));
        prvky.push({ t: 'txt', x: cx, y: Y(0) - 4, h: 2.2, txt: 'pata', a: 'c', c: '#777777', v: vrstva('TEXT') });
      }
      if (o.koty) {
        const rz = n.roz, xl = X(Math.min(...n.vlozka.map((q) => q[0]))) - 6;
        kota(prvky, [xl, Y(0)], [xl, Y(n.Lt)], `${fmt(rz.delka)}`, 'svisle');
        const ob = J.obalka(n.vlozka); kota(prvky, [X(ob.x0), Y(rz.ySirka)], [X(ob.x1), Y(rz.ySirka)], `${fmt(rz.sirka)}`);
        const pb = J.rezNaY(n.vlozka, rz.yPata); if (pb) kota(prvky, [X(pb[0]), Y(rz.yPata)], [X(pb[1]), Y(rz.yPata)], `${fmt(rz.pata)}`);
      }
      ox += ob.w + MEZERA + levyOkraj;
    });
    const w = ox - MEZERA - levyOkraj + OKRAJ_SC, h = top - spodek + 2 * OKRAJ_SC + (p.popisky && spodek >= 0 ? 4 : 0);
    /* zrcadlení pro řez z rubu: geometrie se překlopí, texty zůstanou čitelné (jen se přesunou) */
    if (o.zrcadlit) for (const e of prvky) {
      if (e.t === 'l') e.b = e.b.map(([x, y]) => [w - x, y]);
      else e.x = w - e.x;
    }
    return { prvky, x0: 0, y0: 0, w, h, yPata: OKRAJ_SC + top, xPrvni };
  }
  function kota(prvky, a, b, txt, smer) {
    prvky.push({ t: 'l', b: [a, b], s: 0.18, c: BARVY.kota, v: 'KOTY' });
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * 1.6, ny = dx / l * 1.6;
    for (const q of [a, b]) prvky.push({ t: 'l', b: [[q[0] - nx, q[1] - ny], [q[0] + nx, q[1] + ny]], s: 0.18, c: BARVY.kota, v: 'KOTY' });
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if (smer === 'svisle') prvky.push({ t: 'txt', x: mx - 1.4, y: my, h: 3, txt: txt, a: 'c', c: BARVY.kota, u: 90, v: 'KOTY' });
    else prvky.push({ t: 'txt', x: mx, y: my - 1.3, h: 3, txt: txt, a: 'c', c: BARVY.kota, v: 'KOTY' });
  }

  /* ---------- SVG ---------- */
  const n3 = (x) => { const r = Math.round(x * 1000) / 1000; return Number.isFinite(r) ? String(r) : '0'; };
  const escX = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function svgPrvky(sc, k) {
    k = k || 1;
    return sc.prvky.map((e) => {
      const dash = e.d ? ` stroke-dasharray="${n3(1.6 * k)} ${n3(1.1 * k)}"` : '';
      if (e.t === 'l') return `<path d="M${e.b.map((q) => n3(q[0]) + ' ' + n3(q[1])).join('L')}${e.z ? 'Z' : ''}" fill="none" stroke="${e.c}" stroke-width="${n3(e.s * k)}"${dash} stroke-linejoin="round"/>`;
      if (e.t === 'k') return `<circle cx="${n3(e.x)}" cy="${n3(e.y)}" r="${n3(e.r)}" fill="none" stroke="${e.c}" stroke-width="${n3(e.s * k)}"${dash}/>`;
      if (e.t === 'txt') {
        const anchor = e.a === 'c' ? 'middle' : e.a === 'r' ? 'end' : 'start', rot = e.u ? ` transform="rotate(${-e.u} ${n3(e.x)} ${n3(e.y)})"` : '';
        return `<text x="${n3(e.x)}" y="${n3(e.y)}" font-size="${n3(e.h)}" font-family="Liberation Sans, Arial, sans-serif" text-anchor="${anchor}" fill="${e.c}"${rot}>${escX(e.txt)}</text>`;
      }
      return '';
    }).join('\n');
  }
  function svg(v, o) {   // o: { zrcadlit, koty, nahled }
    const sc = scena(v, o);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${n3(sc.w)}mm" height="${n3(sc.h)}mm" viewBox="0 0 ${n3(sc.w)} ${n3(sc.h)}">\n<title>${escX(v.nazev)}</title>\n${svgPrvky(sc)}\n</svg>\n`;
  }

  /* ---------- DXF R12 (mm, osa y nahoru) ---------- */
  const dxf = (v, o) => dxfSceny(scena(v, { zrcadlit: !!(o && o.zrcadlit) }));
  function dxfSceny(sc) {
    const H = sc.h, L = [];
    const g = (c, x) => L.push(String(c), String(x));
    const vrstvy = [...new Set(sc.prvky.map((e) => e.v))];
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(0, 'ENDSEC');   // R12, jednotky mm
    g(0, 'SECTION'); g(2, 'TABLES');
    g(0, 'TABLE'); g(2, 'LTYPE'); g(70, 1); g(0, 'LTYPE'); g(2, 'CONTINUOUS'); g(70, 0); g(3, 'Solid line'); g(72, 65); g(73, 0); g(40, 0); g(0, 'ENDTAB');
    g(0, 'TABLE'); g(2, 'LAYER'); g(70, vrstvy.length);
    for (const s of vrstvy) { g(0, 'LAYER'); g(2, s); g(70, 0); g(62, /OREZ|^REZ/.test(s) ? 1 : /NOHA|BIGOVANI/.test(s) ? 5 : /ZNACKY|ARCH/.test(s) ? 3 : 7); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    for (const e of sc.prvky) {
      if (e.t === 'l') {
        g(0, 'POLYLINE'); g(8, e.v); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, e.z ? 1 : 0);
        for (const [x, y] of e.b) { g(0, 'VERTEX'); g(8, e.v); g(10, n3(x)); g(20, n3(H - y)); }
        g(0, 'SEQEND'); g(8, e.v);
      } else if (e.t === 'k') { g(0, 'CIRCLE'); g(8, e.v); g(10, n3(e.x)); g(20, n3(H - e.y)); g(40, n3(e.r)); }
      else if (e.t === 'txt') {
        const t = String(e.txt).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/·/g, '-').replace(/×/g, 'x').replace(/[^\x20-\x7e]/g, '');
        g(0, 'TEXT'); g(8, e.v); g(10, n3(e.x)); g(20, n3(H - e.y)); g(40, n3(e.h)); g(1, t);
        if (e.u) g(50, e.u);
        if (e.a === 'c') { g(72, 1); g(11, n3(e.x)); g(21, n3(H - e.y)); }
      }
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return L.join('\r\n') + '\r\n';
  }

  /* ---------- dělení na listy ---------- */
  const PATA = 13, PRAVY = 9;
  /* orient: 'v' = jen na výšku, 's' = jen na šířku, jinak ta s menším počtem listů */
  function rozvrhListu(sc, pw, ph, okraj, prekryv, orient) {
    const varianta = (W, H) => {
      const uw = W - 2 * okraj - PRAVY, uh = H - 2 * okraj - PATA;
      if (sc.w <= uw + 1e-6 && sc.h <= uh + 1e-6) return { W, H, uw, uh, nx: 1, ny: 1, g: 0, jeden: true };
      const g = Math.min(prekryv, uw / 3, uh / 3);
      const nx = Math.max(1, Math.ceil((sc.w - g) / (uw - g) - 1e-9)), ny = Math.max(1, Math.ceil((sc.h - g) / (uh - g) - 1e-9));
      return { W, H, uw, uh, nx, ny, g, jeden: false };
    };
    const a = varianta(pw, ph), b = varianta(ph, pw);
    const r = orient === 'v' ? a : orient === 's' ? b : b.nx * b.ny < a.nx * a.ny ? b : a, listy = [];
    if (r.jeden) listy.push({ sx: sc.x0 - (r.uw - sc.w) / 2, sy: sc.y0 - (r.uh - sc.h) / 2, r: 0, c: 0 });
    else {
      const cw = r.nx * (r.uw - r.g) + r.g, chh = r.ny * (r.uh - r.g) + r.g;
      const ox = sc.x0 - (cw - sc.w) / 2, oy = sc.y0 - (chh - sc.h) / 2;
      for (let i = 0; i < r.ny; i++) for (let j = 0; j < r.nx; j++) listy.push({ sx: ox + j * (r.uw - r.g), sy: oy + i * (r.uh - r.g), r: i, c: j });
    }
    return Object.assign(r, { listy });
  }
  /* které scény jdou na šablonové listy: obě vložky na jeden list, jinak každá zvlášť */
  /* scéna zvětšená o korekci tiskárny a rozvržená na listy; kx/ky platí pro list na výšku – u listu na šířku
     tiskárna papír otočí, takže se osy korekce prohodí */
  function naListy(sc, pw, ph, okraj, prekryv, kx, ky) {
    kx = kx || 1; ky = ky || 1;
    if (kx === ky) { const s1 = skaluj(sc, kx, ky); return { sc: s1, rv: rozvrhListu(s1, pw, ph, okraj, prekryv) }; }
    /* každá orientace se svou korekcí, vítězí menší počet listů (při shodě na výšku) */
    const sv = skaluj(sc, kx, ky), rv = rozvrhListu(sv, pw, ph, okraj, prekryv, 'v');
    const ss = skaluj(sc, ky, kx), rs = rozvrhListu(ss, pw, ph, okraj, prekryv, 's');
    return rs.listy.length < rv.listy.length ? { sc: ss, rv: rs } : { sc: sv, rv };
  }
  function planSablon(v, pw, ph, okraj, prekryv, zrcadlit, kx, ky) {
    const spolu = naListy(scena(v, { zrcadlit }), pw, ph, okraj, prekryv, kx, ky);
    if (spolu.rv.jeden || v.nohy.length === 1) return [Object.assign(spolu, { nazev: v.nohy.length === 1 ? v.nohy[0].nazev : 'obě' })];
    return v.nohy.map((n, i) => Object.assign(naListy(scena(v, { nohy: [i], zrcadlit }), pw, ph, okraj, prekryv, kx, ky), { nazev: n.nazev }));
  }

  /* ---------- PDF ---------- */
  const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/·/g, '-').replace(/[„“]/g, '"').replace(/×/g, 'x').replace(/~/g, '~').replace(/[^\x20-\x7e]/g, '');
  const rgb = (hex) => { const x = parseInt(String(hex || '#000000').slice(1), 16); return [(x >> 16) & 255, (x >> 8) & 255, x & 255]; };

  /* PDF „plátno“: dokument, text s diakritikou (Liberation) nebo bez ní, kreslení scény, měřítka na okraji listu */
  function platno(jsPDF, W0, H0, o, titul) {
    const T = (s) => (uni ? String(s) : bezDiakritiky(s));
    /* první stránka vzniká rovnou; první volání nova() ji jen „převezme“ */
    const doc = new jsPDF({ unit: 'mm', format: [W0, H0], orientation: W0 > H0 ? 'l' : 'p', compress: o.compress !== false });
    let uni = false, prvni = true;
    if (o.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
    doc.setProperties({ title: titul, creator: 'Barefoot vložky – generátor šablon' });
    const nova = (W, H) => {
      if (prvni) { prvni = false; if (W === W0 && H === H0) return; doc.addPage([W, H], W > H ? 'l' : 'p'); doc.deletePage(1); return; }
      doc.addPage([W, H], W > H ? 'l' : 'p');
    };
    const text = (t, x, y, h, a, c, u) => {
      doc.setFont(uni ? 'LS' : 'helvetica', 'normal'); doc.setFontSize(h / 0.3528); doc.setTextColor(...rgb(c));
      const s = T(t), w = doc.getTextWidth(s);
      if (u) { const k = a === 'c' ? w / 2 : a === 'r' ? w : 0, r = u * Math.PI / 180; doc.text(s, x - k * Math.cos(r), y + k * Math.sin(r), { angle: u }); }
      else doc.text(s, x - (a === 'r' ? w : a === 'c' ? w / 2 : 0), y);
    };
    const kresli = (sc, X, Y, k) => {
      for (const e of sc.prvky) {
        if (e.t === 'l') {
          const b = e.b.map((q) => [X(q[0]), Y(q[1])]), seg = [];
          for (let i = 1; i < b.length; i++) seg.push([b[i][0] - b[i - 1][0], b[i][1] - b[i - 1][1]]);
          if (!seg.length) continue;
          doc.setDrawColor(...rgb(e.c)); doc.setLineWidth(Math.max(0.08, e.s * Math.max(k, 0.5)));
          if (e.d) doc.setLineDashPattern([1.6, 1.1], 0);
          doc.lines(seg, b[0][0], b[0][1], [1, 1], 'S', !!e.z);
          if (e.d) doc.setLineDashPattern([], 0);
        } else if (e.t === 'k') {
          doc.setDrawColor(...rgb(e.c)); doc.setLineWidth(Math.max(0.08, e.s * Math.max(k, 0.5)));
          if (e.d) doc.setLineDashPattern([1.2, 0.9], 0);
          doc.circle(X(e.x), Y(e.y), e.r * k, 'S');
          if (e.d) doc.setLineDashPattern([], 0);
        } else if (e.t === 'txt') text(e.txt, X(e.x), Y(e.y), Math.max(1.5, e.h * k), e.a, e.c, e.u);
      }
    };
    /* korekce tiskárny: co tiskárna zmenší/zvětší, se předem vyrovná (kx, ky = poměr skutečné / vytištěné délky) */
    const kx = (o.tiskarna && o.tiskarna.kx) || 1, ky = (o.tiskarna && o.tiskarna.ky) || 1, kx0 = kx, ky0 = ky;
    const meritka = (W, H) => {
      const ok = o.okraj, y = H - ok - 3, x0 = ok, [kx, ky] = W > H ? [ky0, kx0] : [kx0, ky0];   // list na šířku: osy korekce prohozené
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25);
      doc.line(x0, y, x0 + 100 * kx, y);
      for (let i = 0; i <= 10; i++) doc.line(x0 + i * 10 * kx, y, x0 + i * 10 * kx, y - (i % 5 ? 1.5 : 3));
      text('0', x0, y - 3.6, 2, 'c'); text('50', x0 + 50 * kx, y - 3.6, 2, 'c'); text('100 mm', x0 + 100 * kx, y - 3.6, 2, 'c');
      text('Kontrola: úsečky 100 mm vodorovně i svisle; tiskněte ve skutečné velikosti (100 %).' + (kx !== 1 || ky !== 1 ? ' Korekce tiskárny zapnutá.' : ''), x0 + 100 * kx + 7, y - 1.2, 2.2, 'l');
      const xs = W - ok - 2, ys = ok;
      doc.line(xs, ys, xs, ys + 100 * ky);
      for (let i = 0; i <= 10; i++) doc.line(xs, ys + i * 10 * ky, xs - (i % 5 ? 1.5 : 3), ys + i * 10 * ky);
      text('0', xs - 3.6, ys + 0.8, 2, 'r'); text('50', xs - 3.6, ys + 50 * ky + 0.7, 2, 'r'); text('100', xs - 3.6, ys + 100 * ky + 0.7, 2, 'r');
    };
    return { doc, uni, T, nova, text, kresli, meritka, kx, ky };
  }
  /* scéna zvětšená o korekci tiskárny */
  function skaluj(sc, kx, ky) {
    if (kx === 1 && ky === 1) return sc;
    const k = (kx + ky) / 2;
    return Object.assign({}, sc, { w: sc.w * kx, h: sc.h * ky, x0: sc.x0 * kx, y0: sc.y0 * ky, prvky: sc.prvky.map((e) => (e.t === 'l' ? Object.assign({}, e, { b: e.b.map(([x, y]) => [x * kx, y * ky]) }) : e.t === 'k' ? Object.assign({}, e, { x: e.x * kx, y: e.y * ky, r: e.r * k }) : Object.assign({}, e, { x: e.x * kx, y: e.y * ky }))) });
  }

  /* scéna 1:1 na listy (rv = rozvrhListu): ořez na rámeček, přesahy s čárkovanou čarou, křížky, měřítka */
  function listy(c, sc, rv, ok, popis) {
    const { doc, nova, text, kresli, meritka } = c, N = rv.listy.length;
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
        doc.setLineDashPattern([], 0); doc.setDrawColor(0, 0, 0);
        for (const [x, yy] of [[ok, ok], [ok + rv.uw, ok], [ok, ok + rv.uh], [ok + rv.uw, ok + rv.uh]]) { doc.line(x - 3, yy, x + 3, yy); doc.line(x, yy - 3, x, yy + 3); }
        if (l.c > 0 || l.r > 0) text('odstřihněte ' + (l.c > 0 ? 'levý' : '') + (l.c > 0 && l.r > 0 ? ' a ' : '') + (l.r > 0 ? 'horní' : '') + ' okraj po rámeček a přiložte na čárkovanou čáru předchozího listu', ok + 2, ok - 2.4, 2.4, 'l', '#555555');
      }
      text(popis(l.r * rv.nx + l.c + 1, N), ok, rv.H - ok - 8.5, 2.6, 'l');
      meritka(rv.W, rv.H);
    }
  }
  /* libovolná scéna (např. rozvržení archu) jako PDF 1:1 po listech */
  function pdfSceny(jsPDF, sc, o) {
    o = Object.assign({ papir: [210, 297], okraj: 8, prekryv: 15, nazev: 'Arch' }, o || {});
    const kx = (o.tiskarna && o.tiskarna.kx) || 1, ky = (o.tiskarna && o.tiskarna.ky) || 1;
    const q = naListy(sc, o.papir[0], o.papir[1], o.okraj, o.prekryv, kx, ky), rv = q.rv, c = platno(jsPDF, rv.W, rv.H, o, o.nazev);
    sc = q.sc;
    listy(c, sc, rv, o.okraj, (n, N) => `${o.nazev} · 1:1${N > 1 ? ` · list ${n}/${N}` : ''}`);
    return c.doc;
  }
  /* kalibrační karta A4: čtyři plné čtverce (středy 15 mm od okrajů), kontrolní čtverec, pravítka, místo pro chodidlo */
  function pdfKarty(jsPDF, o) {
    o = Object.assign({ okraj: 8 }, o || {});
    const K = { w: 210, h: 297, inset: 15, strana: 10 }, c = platno(jsPDF, K.w, K.h, o, 'Kalibrační karta'), { doc, text, kx, ky } = c;
    doc.setFillColor(0, 0, 0);
    /* čtverce s korekcí tiskárny (kolem středu listu), aby jejich vzdálenosti po tisku přesně seděly */
    const kX = (x) => K.w / 2 + (x - K.w / 2) * kx, kY = (y) => K.h / 2 + (y - K.h / 2) * ky;
    for (const [x, y] of [[K.inset, K.inset], [K.w - K.inset, K.inset], [K.w - K.inset, K.h - K.inset], [K.inset, K.h - K.inset]]) doc.rect(kX(x) - K.strana * kx / 2, kY(y) - K.strana * ky / 2, K.strana * kx, K.strana * ky, 'F');
    /* texty mezi horními čtverci, místo pro chodidlo co největší (dospělá noha), pravítka mezi dolními čtverci */
    text('Kalibrační karta pro vložky na míru', K.w / 2, 15, 4, 'c');
    text('Tiskněte ve skutečné velikosti (100 %). Postavte se na kartu, obkreslete chodidlo tužkou drženou svisle', K.w / 2, 21, 2.4, 'c', '#333333');
    text('a kartu vyfoťte kolmo shora – všechny čtyři černé čtverce musí být vidět a nezakryté.', K.w / 2, 25, 2.4, 'c', '#333333');
    doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.3); doc.setLineDashPattern([3, 2], 0);
    doc.roundedRect(24, 30, K.w - 48, K.h - 58, 6, 6, 'S'); doc.setLineDashPattern([], 0);
    text('místo pro chodidlo (pata dole) – noha delší než 24 cm se vejde šikmo po úhlopříčce', K.w / 2, K.h - 31, 2.4, 'c', '#888888');
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25);
    doc.line(K.w - 72, K.h - 17, K.w - 72 + 50 * kx, K.h - 17);
    for (let i = 0; i <= 5; i++) doc.line(K.w - 72 + i * 10 * kx, K.h - 17, K.w - 72 + i * 10 * kx, K.h - 19.5);
    text('50 mm', K.w - 72 + 25 * kx, K.h - 13, 2.4, 'c');
    doc.line(28, K.h - 17, 28 + 100 * kx, K.h - 17);
    for (let i = 0; i <= 10; i++) doc.line(28 + i * 10 * kx, K.h - 17, 28 + i * 10 * kx, K.h - (i % 5 ? 18.5 : 19.5));
    text('kontrola tisku: 100 mm', 28 + 50 * kx, K.h - 13, 2.4, 'c');
    return doc;
  }
  /* zkušební list pro kalibraci tiskárny: tiskne se BEZ korekce, změří se úsečky 150 a 200 mm */
  function pdfTiskarna(jsPDF, o) {
    const c = platno(jsPDF, 210, 297, Object.assign({ okraj: 8 }, o, { tiskarna: null }), 'Kalibrace tiskárny'), { doc, text } = c;
    text('Kalibrace tiskárny', 105, 22, 5, 'c');
    text('Vytiskněte ve skutečné velikosti (100 %, ne „přizpůsobit stránce“). Pravítkem změřte obě úsečky od rysky 0 po rysku na konci', 105, 30, 2.7, 'c', '#333333');
    text('a délky zapište do stránky (Kalibrace → Tiskárna). Šablony se pak tisknou s vyrovnáním.', 105, 35, 2.7, 'c', '#333333');
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
    const x0 = 30, y0 = 60;
    doc.line(x0, y0, x0 + 150, y0);
    for (let i = 0; i <= 150; i += 5) doc.line(x0 + i, y0, x0 + i, y0 - (i % 50 ? (i % 10 ? 2 : 3.5) : 6));
    text('0', x0, y0 + 5, 3, 'c'); text('vodorovně 150 mm', x0 + 75, y0 + 5, 3, 'c'); text('150', x0 + 150, y0 + 5, 3, 'c');
    const xs = 30, ys = 80;
    doc.line(xs, ys, xs, ys + 200);
    for (let i = 0; i <= 200; i += 5) doc.line(xs, ys + i, xs + (i % 50 ? (i % 10 ? 2 : 3.5) : 6), ys + i);
    text('0', xs - 4, ys + 1, 3, 'r'); text('200', xs - 4, ys + 201, 3, 'r');
    text('svisle 200 mm', xs + 10, ys + 100, 3, 'l');
    doc.rect(80, 120, 100, 100, 'S'); text('čtverec 100 × 100 mm', 130, 172, 3.2, 'c');
    return doc;
  }

  /* ---------- výstup pro řezací stroje ---------- */
  const PROFILY = {
    laser: { nazev: 'Laser (LightBurn, Glowforge, xTool)', rez: '#ff0000', big: '#0000ff', grav: '#000000', s: 0.01 },
    cricut: { nazev: 'Cricut', rez: '#000000', big: '#0000ff', grav: '#000000', s: 0.25 },
    silhouette: { nazev: 'Silhouette', rez: '#ff0000', big: '#0000ff', grav: '#000000', s: 0.1 },
    noz: { nazev: 'CNC nůž / plotr', rez: '#000000', big: '#0000ff', grav: '#000000', s: 0.1 },
  };
  /* ze scény jen to, co stroj dělá: řez (obrysy, otvory; s kompenzací šířky řezu), bigování (ořezové čáry), gravírování (popisky).
     o: { profil, kerf (mm), bigovat, gravirovat } */
  function scenaRez(sc, o) {
    /* o.dil: 'horni' = vložka (svrchní vrstva) s otvory, 'spodni' = spodní vrstva, 'podpory' = pelota a podpatěnka –
       každý díl se řeže z jiného materiálu, proto zvlášť */
    o = Object.assign({ profil: 'laser', kerf: 0, bigovat: false, gravirovat: false, dil: 'horni' }, o);
    const P = PROFILY[o.profil] || PROFILY.laser, kr = Math.max(0, o.kerf) / 2, prvky = [];
    const ven = (B) => {   // posun obrysu ven o polovinu řezu (orientace ve scéně je y dolů – vezme se větší z obou směrů)
      if (!kr) return B;
      const a = J.odsadClip(B, kr);   // Clipper zvětšuje kladným posunem bez ohledu na orientaci, bez smyček v zářezech
      return a.length > 8 ? a : B;
    };
    for (const e of sc.prvky) {
      const L = String(e.v || '');
      if (o.dil !== 'horni') {
        if (e.t === 'l' && e.z && (o.dil === 'spodni' ? /^VRSTVA2/ : /^PODPORY/).test(L)) prvky.push({ t: 'l', b: ven(e.b), z: true, s: P.s, c: P.rez, v: 'REZ' });
        else if (e.t === 'txt' && o.gravirovat && /^TEXT/.test(L) && e.h > 10) prvky.push(Object.assign({}, e, { c: P.grav, v: 'GRAVIROVANI' }));   // jen velké P/L
        continue;
      }
      if (/^(OBRYS|REZ)/.test(L) || /^PERFORACE/.test(L)) {
        if (e.t === 'l' && e.z) prvky.push({ t: 'l', b: ven(e.b), z: true, s: P.s, c: P.rez, v: 'REZ' });
        else if (e.t === 'k') prvky.push({ t: 'k', x: e.x, y: e.y, r: Math.max(0.2, e.r - kr), s: P.s, c: P.rez, v: 'REZ' });
      } else if (/^OREZ/.test(L) && o.bigovat && e.t === 'l') prvky.push({ t: 'l', b: e.b, s: P.s, c: P.big, v: 'BIGOVANI' });
      else if (/^TEXT/.test(L) && o.gravirovat && e.t === 'txt') prvky.push(Object.assign({}, e, { c: P.grav, v: 'GRAVIROVANI' }));
    }
    return Object.assign({}, sc, { prvky });
  }
  function svgRez(sc, o) {
    const r = scenaRez(sc, o);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${n3(r.w)}mm" height="${n3(r.h)}mm" viewBox="0 0 ${n3(r.w)} ${n3(r.h)}">\n${svgPrvky(r, 1)}\n</svg>\n`;
  }
  const dxfRez = (sc, o) => dxfSceny(scenaRez(sc, o));

  /* štítek zakázky 100 × 62 mm: údaje a QR (data URL obrázku) */
  function pdfStitek(jsPDF, d, qr, o) {
    const c = platno(jsPDF, 100, 62, Object.assign({ okraj: 4 }, o, { tiskarna: null }), 'Štítek zakázky'), { doc, text } = c;
    doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.2); doc.roundedRect(2, 2, 96, 58, 3, 3, 'S');
    /* písmo se zmenší, aby řádek nezasáhl pod QR kód */
    const vejde = (t, h, sirka) => { let v = h; doc.setFontSize(v / 0.3528); while (v > 1.8 && doc.getTextWidth(c.T(t)) > sirka) { v -= 0.1; doc.setFontSize(v / 0.3528); } return v; };
    const volno = qr ? 52 : 88;
    text(d.titul, 6, 11, vejde(d.titul, 5, 88), 'l');
    let y = 18;
    for (const r of d.radky) { text(r, 6, y, vejde(r, 2.9, volno), 'l', '#222222'); y += 5; }
    if (qr) doc.addImage(qr, 'PNG', 60, 20, 36, 36);
    return doc;
  }

  /* o: { papir: [w, h], okraj, prekryv, pismo (TTF base64), texty: [řádky „Jak to funguje“] } */
  function pdf(jsPDF, v, o) {
    o = Object.assign({ papir: [210, 297], okraj: 8, prekryv: 15 }, o || {});
    const [pw, ph] = o.papir, ok = o.okraj;
    const c = platno(jsPDF, pw, ph, o, v.nazev), { doc, uni, T, nova, text, kresli, meritka } = c;
    let y = 0;
    const odstavce = (radky, sirka) => {
      for (const r of radky) {
        const nadpis = r.startsWith('# '), t = nadpis ? r.slice(2) : r, vel = nadpis ? 3.8 : 3;
        doc.setFont(uni ? 'LS' : 'helvetica', 'normal'); doc.setFontSize(vel / 0.3528);
        for (const rr of doc.splitTextToSize(T(t), sirka)) {
          if (y > ph - ok - 8) { nova(pw, ph); y = ok + 6; }
          doc.setFontSize(vel / 0.3528); doc.setTextColor(0, 0, 0); doc.text(rr, ok, y); y += vel * 1.45;
        }
        y += nadpis ? 0.8 : 1;
      }
    };
    const tabulka = (hlavicka, radky, sirky) => {
      const vel = 2.9, radek = (b, tuc) => {
        let x = ok;
        b.forEach((s, i) => { text(String(s), i ? x + sirky[i] - 1 : x, y, vel, i ? 'r' : 'l', tuc ? '#000000' : '#222222'); x += sirky[i]; });
        doc.setDrawColor(190, 190, 190); doc.setLineWidth(0.15); doc.line(ok, y + 1.6, ok + sirky.reduce((a, b2) => a + b2, 0), y + 1.6);
        y += vel * 1.75;
      };
      radek(hlavicka, true); for (const r of radky) radek(r, false); y += 4;
    };

    /* 1) souhrn (lze vypnout) */
    if (o.souhrn !== false) {
      const p = v.p;
      nova(pw, ph); y = ok + 6;
      text(v.nazev, ok, y, 5, 'l'); y += 8;
      const sl = v.nohy.map((n) => n.nazev);
      const R = (f) => v.nohy.map(f);
      tabulka(['', ...sl], [
        [v.vlastni ? 'Délka obrysu mm' : 'Délka chodidla (Mondopoint) mm', ...R((n) => fmt(n.m.delka))],
        [v.vlastni ? 'Šířka obrysu mm' : 'Šířka přes klouby mm', ...R((n) => fmt(n.m.sirka))],
        [v.vlastni ? 'Šířka paty obrysu mm' : 'Šířka paty mm', ...R((n) => fmt(n.m.pata))],
        ['Šířka chodidla', ...R((n) => `${n.sirka.nazev} (${fmt(n.sirka.r * 100)} %)`)],
        [p.rezim === 'kontrolni' ? 'Šablona: délka × šířka mm' : 'Vložka: délka × šířka mm', ...R((n) => `${fmt(n.roz.delka)} × ${fmt(n.roz.sirka)}`)],
        ['Pata vložky mm', ...R((n) => fmt(n.roz.pata))],
        ['Hledaná vnitřní délka boty mm', ...R((n) => fmt(n.vel.vnitrni))],
        ['EU (orientačně)', ...R((n) => fmt(n.vel.eu, n.vel.eu % 1 ? 1 : 0))],
        ['UK / US M / US W (orientačně)', ...R((n) => n.vel.detske ? `UK dětská ${fmt(n.vel.uk, 1)}` : `${fmt(n.vel.uk, 1)} / ${fmt(n.vel.usM, 1)} / ${fmt(n.vel.usW, 1)}`)],
      ], [70, ...sl.map(() => Math.min(45, (pw - 2 * ok - 70) / sl.length))]);
      odstavce([
        ...(v.popis || [`Rezerva ve špičce ${fmt(p.rezPrsty)} mm, na každé straně ${fmt(p.rezBok)} mm, za patou ${fmt(p.rezPata)} mm · tvar prstů ${J.TVARY[p.tvar].nazev.toLowerCase()}` + (p.rezim === 'vlozka' ? ` · ${J.MATERIALY[p.material].nazev.toLowerCase()} ${fmt(p.tloustka, 1)} mm.` : '.')]),
        ...(p.rezim === 'vlozka' && p.vrstvy ? [`Dvě vrstvy: svrchní ${J.MATERIALY[p.material].nazev.toLowerCase()} ${fmt(p.tloustka, 1)} mm (plná čára), spodní ${J.MATERIALY[p.material2].nazev.toLowerCase()} ${fmt(p.tloustka2, 1)} mm o ${fmt(p.vrstvaOds)} mm menší (fialová čárkovaná čára) – spodní vrstvu přilepte doprostřed, hrana se pak nedrolí.`] : []),
        ...(p.rezim === 'vlozka' && (p.pelota || p.podpatenka) ? ['Hnědě: ' + [p.pelota ? `pelota ${fmt(p.pelotaDelka)} × ${fmt(p.pelotaSirka)} mm` : '', p.podpatenka ? `podpatěnka šířka ${fmt(p.podpatenkaPrumer)} mm` : ''].filter(Boolean).join(', ') + ' – vystřihněte zvlášť a přilepte na spodní stranu vložky na vyznačené místo.'] : []),
        ...(p.rezim === 'vlozka' && p.delkaBoty > 0 ? [`Plná červená čára = ořez na vnitřní délku boty ${fmt(p.delkaBoty)} mm.`] : []),
        `Vygenerováno ${new Date().toLocaleDateString('cs-CZ')}.`,
        'Velikosti EU/UK/US jsou jen orientační – výrobci se liší i o jedno číslo. Porovnávejte vnitřní délku a šířku boty, ne číslo.',
        ...(p.rezim === 'vlozka'
          ? ['# Jak vyrobit', '1. Šablonu vystřihněte po plné černé čáře a přiložte k původní vložce nebo vložte do boty – nesmí se nikde ohýbat ani mít vůli přes 3 mm.', '2. Je-li bota kratší, odstřihněte špičku po červené ořezové čáře (každá ubírá uvedenou délku).', '3. Šablonu položte potiskem nahoru na líc materiálu, obkreslete a vystřihněte o 0,5 mm vně čáry; hrany plsti a korku zabruste. Kreslíte-li na rub (kůže, korek s potiskem), vytiskněte šablony zrcadlené (Tisk → Další → Zrcadlit šablony).', '4. Modrá čárkovaná čára je obrys chodidla – pomůže zkontrolovat, že prsty nikde nepřesahují.']
          : ['# Jak zkoušet', '1. Šablonu vystřihněte z tvrdšího papíru nebo tenkého kartonu i s jazýčkem.', '2. Zasuňte ji do boty až k patě. Šablona musí ležet rovně – když se ve špičce ohýbá nebo krabatí, bota je krátká nebo úzká.', '3. Zelené značky ukazují, kde končí noha (+0) a kolik místa zbývá; za jazýček šablonu vytáhněte a podívejte se, o kolik je bota delší.']),
      ], pw - 2 * ok);
      if (v.varovani.length) odstavce(['# Kontrola', ...v.varovani.map((q) => (q.uroven === 'chyba' ? '!! ' : q.uroven === 'varovani' ? '! ' : '') + q.text)], pw - 2 * ok);
      const nahled = scena(v, { koty: true }), zbyva = ph - ok - 8 - y - 4;
      if (zbyva < 80) { nova(pw, ph); y = ok + 6; }
      const maxH = ph - ok - 10 - y, k = Math.min(0.6, (pw - 2 * ok - 60) / nahled.w, maxH / nahled.h);
      kresli(nahled, (x) => ok + x * k, (yy) => y + yy * k, k);
      const xc = ok + nahled.w * k + 8;
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25); doc.rect(xc, y + 2, 50 * c.kx, 50 * c.ky, 'S');
      text('50 × 50 mm', xc + 25, y + 28, 4, 'c');
      text('Po tisku musí mít čtverec přesně 50 mm.', xc, y + 57, 2.6, 'l');
      text('Zmenšený náhled – šablony 1:1 jsou na dalších listech.', ok, y + nahled.h * k + 4, 2.6, 'l', '#555555');
    }

    /* 2) šablony 1:1 */
    for (const q of planSablon(v, pw, ph, ok, o.prekryv, o.zrcadlit, c.kx, c.ky)) listy(c, q.sc, q.rv, ok, (n, N) => `Šablona 1:1${o.zrcadlit ? ' (zrcadlená – rub)' : ''} · ${q.nazev} · ${v.nazev}${N > 1 ? ` · list ${n}/${N}` : ''}`);

    /* 3) jak to funguje */
    if (o.texty && o.texty.length) { nova(pw, ph); y = ok + 6; text('Jak to funguje', ok, y, 5, 'l'); y += 8; odstavce(o.texty, pw - 2 * ok); }
    return doc;
  }

  const API = { scena, svg, svgPrvky, dxf, dxfSceny, pdfSceny, pdfKarty, pdfTiskarna, pdfStitek, platno, skaluj, PROFILY, scenaRez, svgRez, dxfRez, pdf, rozvrhListu, planSablon, bezDiakritiky, BARVY };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.BFV = API;
})(typeof window !== 'undefined' ? window : globalThis);

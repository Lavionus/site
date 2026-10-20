/* ============================================================
   Dřevěné hračky – výstupy (bez DOM): scény dílů, rozložení na desku / listy, SVG, DXF, PDF 1:1, CSV,
   technické pohledy s kótami, řezný plán.
   Scéna je v mm (y nahoru). prvek: {t:'l', b, s, c, d:'c'|'o', z (uzavřená), v (vrstva)} | {t:'k', x, y, r, s, c, f, v} |
   {t:'txt', x, y, txt, h, a:'l'|'c'|'r', c, v}. Vrstvy: rez, otvor, gravir, osa, pomocna, popis.
   ============================================================ */
(function (koren) {
  'use strict';
  const DH = koren.DH || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const cz = DH.cz;
  const n3 = (x) => (Math.round(x * 1000) / 1000).toString();
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const BARVY = { rez: '#d62828', otvor: '#1f5fa8', gravir: '#333333', osa: '#2c8a4a', pomocna: '#888888', popis: '#000000', drazka: '#8e44ad' };
  const SIRKY = { rez: 0.25, otvor: 0.25, gravir: 0.2, osa: 0.18, pomocna: 0.18, popis: 0, drazka: 0.25 };

  /* ---------------- scéna jednoho dílu ---------------- */
  /** o: {popisy (true), barvy (true)} → {prvky, x0, y0, x1, y1, dil} */
  function scenaDilu(d, o) {
    o = Object.assign({ popisy: true }, o || {});
    const pr = [];
    for (const q of d.obrysy || []) {
      const v = q.typ === 'rez' ? 'rez' : q.typ === 'otvor' ? 'otvor' : q.typ === 'gravir' ? 'gravir' : q.typ === 'osa' ? 'osa' : q.typ === 'drazka' ? 'drazka' : 'pomocna';
      pr.push({ t: 'l', b: q.b, s: SIRKY[v], c: BARVY[v], z: !q.otevrena, v, d: v === 'pomocna' ? 'c' : v === 'osa' ? 'o' : null });
    }
    for (const c of d.cary || []) pr.push({ t: 'l', b: c, s: 0.18, c: BARVY.pomocna, z: false, v: 'pomocna', d: 'c' });
    for (const k of d.kruhy || []) {
      const v = k.typ === 'otvor' ? 'otvor' : k.typ === 'gravir' ? 'gravir' : 'pomocna';
      if (k.r > 0.8) pr.push({ t: 'k', x: k.x, y: k.y, r: k.r, s: SIRKY[v] || 0.2, c: BARVY[v], v, d: k.typ === 'gravir' ? 'c' : null });
      const kr = Math.max(2.5, Math.min(6, k.r * 0.6));
      pr.push({ t: 'l', b: [[k.x - kr, k.y], [k.x + kr, k.y]], s: 0.15, c: '#000000', v: 'pomocna' });
      pr.push({ t: 'l', b: [[k.x, k.y - kr], [k.x, k.y + kr]], s: 0.15, c: '#000000', v: 'pomocna' });
    }
    for (const t of d.texty || []) pr.push({ t: 'txt', x: t.x, y: t.y, txt: t.txt, h: t.h || 2.6, a: 'l', c: '#000000', v: 'popis' });
    const bb = DH.bbox((d.obrysy || []).map((q) => q.b).concat((d.kruhy || []).map((k) => [[k.x - k.r, k.y - k.r], [k.x + k.r, k.y + k.r]])));
    let y1 = bb.y1;
    if (o.popisy) {
      const h = 3;
      const radky = [`${d.id} – ${d.nazev}`, `${d.ks} ks${d.tl ? ` · tl. ${cz(d.tl)} mm` : ''}${d.sablona ? ' · ŠABLONA' : ''} · ${cz(bb.w)} × ${cz(bb.h)} mm`];
      if (d.poznamka) radky.push(d.poznamka);
      radky.forEach((r, i) => pr.push({ t: 'txt', x: bb.x0, y: bb.y1 + 3 + (radky.length - i - 1) * (h * 1.35) + 1, txt: r, h: i ? h * 0.8 : h, a: 'l', c: i ? '#444444' : '#000000', v: 'popis' }));
      y1 = bb.y1 + 4 + radky.length * h * 1.35;
    }
    const sirkaTextu = o.popisy ? Math.max(...pr.filter((e) => e.t === 'txt' && e.y > bb.y1).map((e) => e.txt.length * e.h * 0.52), 0) : 0;
    return { prvky: pr, x0: bb.x0, y0: bb.y0, x1: Math.max(bb.x1, bb.x0 + sirkaTextu), y1, dil: d, bbDil: bb };
  }

  /** posun a otočení prvků scény */
  const posunPrvky = (pr, dx, dy) => pr.map((e) => (e.t === 'l' ? Object.assign({}, e, { b: e.b.map((p) => [p[0] + dx, p[1] + dy]) }) : Object.assign({}, e, { x: e.x + dx, y: e.y + dy })));

  /**
   * Rozložení scén na plochy W × H (police / shelf packing, větší napřed). Díly s ks > 1 se opakují, pokud o.opakovat.
   * → {plochy:[{prvky, sceny:[{i, x, y}]}], velke:[indexy scén, které se nevejdou]}
   */
  function rozloz(sceny, W, H, mezera, o) {
    o = o || {};
    const polozky = [];
    sceny.forEach((s, i) => { const n = o.opakovat ? Math.max(1, s.dil.ks || 1) : 1; for (let k = 0; k < n; k++) polozky.push({ i, w: s.x1 - s.x0, h: s.y1 - s.y0, kopie: k }); });
    const velke = [], plochy = [];
    const vejde = polozky.filter((q) => { if (q.w > W + 1e-6 || q.h > H + 1e-6) { if (!q.kopie) velke.push(q.i); return false; } return true; });
    vejde.sort((a, b) => b.h - a.h || b.w - a.w);
    for (const q of vejde) {
      let umisteno = false;
      for (const P of plochy) {
        for (const r of P.rady) if (q.h <= r.h + 1e-6 && r.x + q.w <= W + 1e-6) { P.sceny.push({ i: q.i, x: r.x, y: r.y, kopie: q.kopie }); r.x += q.w + mezera; umisteno = true; break; }
        if (umisteno) break;
        if (P.y + q.h <= H + 1e-6) { const r = { x: q.w + mezera, y: P.y, h: q.h }; P.rady.push(r); P.sceny.push({ i: q.i, x: 0, y: P.y, kopie: q.kopie }); P.y += q.h + mezera; umisteno = true; break; }
      }
      if (!umisteno) { const P = { rady: [{ x: q.w + mezera, y: 0, h: q.h }], sceny: [{ i: q.i, x: 0, y: 0, kopie: q.kopie }], y: q.h + mezera }; plochy.push(P); }
    }
    // prvky ploch: y od horního okraje dolů → převést (y nahoru, horní řada nahoře)
    for (const P of plochy) {
      P.prvky = [];
      for (const s of P.sceny) {
        const sc = sceny[s.i], h = sc.y1 - sc.y0;
        P.prvky.push(...posunPrvky(sc.prvky, s.x - sc.x0, H - s.y - h - sc.y0));
        s.ox = s.x - sc.x0; s.oy = H - s.y - h - sc.y0;
      }
    }
    return { plochy, velke };
  }

  /* ---------------- SVG ---------------- */
  function svgPrvek(e, o) {
    const c = o && o.laser ? (e.v === 'rez' ? '#ff0000' : e.v === 'otvor' ? '#ff0000' : e.v === 'gravir' ? '#0000ff' : e.v === 'drazka' ? '#ff00ff' : e.v === 'popis' ? '#000000' : '#00aa00') : e.c;
    const s = o && o.laser ? 0.1 : Math.max(0.05, e.s || 0.2);
    const dash = e.d === 'c' ? ` stroke-dasharray="${n3(s * 12)} ${n3(s * 8)}"` : e.d === 'o' ? ` stroke-dasharray="${n3(s * 30)} ${n3(s * 8)} ${n3(s * 4)} ${n3(s * 8)}"` : '';
    if (e.t === 'l') return `<path d="${e.b.map((q, i) => (i ? 'L' : 'M') + n3(q[0]) + ' ' + n3(-q[1])).join('')}${e.z ? 'Z' : ''}" fill="none" stroke="${c}" stroke-width="${n3(s)}" stroke-linejoin="round" stroke-linecap="round"${dash}/>`;
    if (e.t === 'k') return e.f ? `<circle cx="${n3(e.x)}" cy="${n3(-e.y)}" r="${n3(e.r)}" fill="${c}"/>` : `<circle cx="${n3(e.x)}" cy="${n3(-e.y)}" r="${n3(e.r)}" fill="none" stroke="${c}" stroke-width="${n3(s)}"${dash}/>`;
    if (e.t === 'txt') return `<text x="${n3(e.x)}" y="${n3(-e.y)}" font-size="${n3(e.h)}" text-anchor="${e.a === 'r' ? 'end' : e.a === 'c' ? 'middle' : 'start'}" fill="${c}">${esc(e.txt)}</text>`;
    return '';
  }
  /** prvky v rámci [x0,y0,x1,y1] → SVG v mm; o: {laser, popisy, pozadi, sirka100, pod (SVG pod prvky v souřadnicích s převráceným y)} */
  function svg(prvky, ram, o) {
    o = Object.assign({ okraj: 2 }, o || {});
    const m = o.okraj, x = ram.x0 - m, y = -ram.y1 - m, w = ram.x1 - ram.x0 + 2 * m, h = ram.y1 - ram.y0 + 2 * m;
    const rozm = o.sirka100 ? 'width="100%"' : `width="${n3(w)}mm" height="${n3(h)}mm"`;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ${rozm} viewBox="${n3(x)} ${n3(y)} ${n3(w)} ${n3(h)}" font-family="Liberation Sans, Arial, sans-serif">`;
    if (o.pozadi) s += `<rect x="${n3(x)}" y="${n3(y)}" width="${n3(w)}" height="${n3(h)}" fill="${o.pozadi}"/>`;
    if (o.pod) s += o.pod;
    if (o.laser) {
      for (const v of ['gravir', 'drazka', 'osa', 'pomocna', 'otvor', 'rez', 'popis']) {
        const q = prvky.filter((e) => e.v === v && (o.popisy !== false || (v !== 'popis' && v !== 'pomocna' && v !== 'osa')));
        if (q.length) s += `<g id="${v}" inkscape:groupmode="layer" inkscape:label="${v}" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape">${q.map((e) => svgPrvek(e, o)).join('')}</g>`;
      }
    } else for (const e of prvky) s += svgPrvek(e, o);
    return s + '</svg>';
  }

  /* ---------------- DXF R12 ---------------- */
  const DXF_VRSTVY = { rez: 1, otvor: 5, gravir: 3, osa: 2, pomocna: 8, popis: 7, drazka: 6 };
  function dxf(prvky, o) {
    o = o || {};
    const L = [], g = (k, v) => { L.push(String(k)); L.push(String(v)); };
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, Object.keys(DXF_VRSTVY).length);
    for (const [v, c] of Object.entries(DXF_VRSTVY)) { g(0, 'LAYER'); g(2, v.toUpperCase()); g(70, 0); g(62, c); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB'); g(0, 'ENDSEC'); g(0, 'SECTION'); g(2, 'ENTITIES');
    const ascii = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/Ø/g, '%%c').replace(/[−–]/g, '-').replace(/×/g, 'x').replace(/[^\x20-\x7e]/g, '');
    for (const e of prvky) {
      if (o.popisy === false && (e.v === 'popis' || e.v === 'pomocna')) continue;
      const ly = String(e.v || 'rez').toUpperCase();
      if (e.t === 'l') {
        if (e.b.length === 2 && !e.z) { g(0, 'LINE'); g(8, ly); g(10, n3(e.b[0][0])); g(20, n3(e.b[0][1])); g(30, 0); g(11, n3(e.b[1][0])); g(21, n3(e.b[1][1])); g(31, 0); continue; }
        g(0, 'POLYLINE'); g(8, ly); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, e.z ? 1 : 0);
        for (const q of e.b) { g(0, 'VERTEX'); g(8, ly); g(10, n3(q[0])); g(20, n3(q[1])); g(30, 0); }
        g(0, 'SEQEND'); g(8, ly);
      } else if (e.t === 'k') { g(0, 'CIRCLE'); g(8, ly); g(10, n3(e.x)); g(20, n3(e.y)); g(30, 0); g(40, n3(e.r)); }
      else if (e.t === 'txt') { g(0, 'TEXT'); g(8, ly); g(10, n3(e.x)); g(20, n3(e.y)); g(30, 0); g(40, n3(e.h * 0.72)); g(1, ascii(e.txt)); }
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return L.join('\r\n') + '\r\n';
  }

  /* ---------------- CSV kusovníku ---------------- */
  function csv(N) {
    const q = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const out = ['poz;nazev;ks;rozmer_mm;material;poznamka'];
    for (const k of N.kusovnik) out.push([k.poz, q(k.nazev), k.ks, q(k.rozmer), q(k.mat), q(k.pozn)].join(';'));
    return out.join('\r\n') + '\r\n';
  }

  /* ---------------- papír a listy PDF ---------------- */
  const PAPIRY = { a4: [210, 297], a3: [297, 420], letter: [215.9, 279.4] };
  const rozmerPapiru = (S) => (S.papir === 'vlastni' ? [Math.max(80, +S.papirW || 210), Math.max(80, +S.papirH || 297)] : PAPIRY[S.papir] || PAPIRY.a4);
  const korekce = (kx, ky) => { const a = +kx || 100, b = +ky || 100, ok = a >= 80 && a <= 120 && b >= 80 && b <= 120; return { kx: ok ? 100 / a : 1, ky: ok ? 100 / b : 1, platne: ok }; };
  const PATA = 15, PAS = 11;

  /**
   * Strany PDF (mm papíru, y dolů). N = návrh, S = nastavení tisku, o: {nazev, obrazek: {data, w, h}, jenDil}
   * → [{W, H, obsah:[prvky], navrch:[prvky], clip, obrazky:[{x,y,w,h,data}], typ}]
   */
  function strany(N, S, o) {
    o = o || {};
    S = Object.assign({}, DH.NASTAVENI, S || {});
    const [p0, p1] = rozmerPapiru(S), ok = +S.okraj, K = korekce(S.kalibX, S.kalibY), g = Math.max(0, +S.prekryv);
    const out = [];
    const Tp = (arr, x, y, txt, h, a, c) => arr.push({ t: 'txt', x, y, txt: String(txt), h, a: a || 'l', c: c || '#000000' });
    const Lp = (arr, b, s, c, d) => arr.push({ t: 'l', b, s: s || 0.2, c: c || '#000000', d });
    const meritka = (st) => {
      const y = st.H - ok - 3.5, x0 = ok;
      st.navrch.push({ t: 'm', x0, y, x1: x0 + 100 * K.kx, osa: 'x' });
      for (let i = 0; i <= 10; i++) Lp(st.navrch, [[x0 + i * 10 * K.kx, y], [x0 + i * 10 * K.kx, y - (i % 5 ? 1.5 : 3)]], 0.2);
      Tp(st.navrch, x0, y - 3.6, '0', 2, 'c'); Tp(st.navrch, x0 + 50 * K.kx, y - 3.6, '50', 2, 'c'); Tp(st.navrch, x0 + 100 * K.kx, y - 3.6, '100 mm', 2, 'c');
      Tp(st.navrch, x0 + 100 * K.kx + 8, y - 4.4, 'Kontrola měřítka: úsečky musí mít přesně 50 a 100 mm vodorovně i svisle.', 2.2);
      Tp(st.navrch, x0 + 100 * K.kx + 8, y - 1.2, K.kx !== 1 || K.ky !== 1 ? `Kalibrace: X ×${K.kx.toFixed(4).replace('.', ',')}, Y ×${K.ky.toFixed(4).replace('.', ',')}` : 'Tiskněte ve skutečné velikosti (100 %), ne „přizpůsobit stránce“.', 2.2);
      const xs = st.W - ok - 2.5, ys = ok;
      st.navrch.push({ t: 'm', x0: xs, y: ys, y1: ys + 100 * K.ky, osa: 'y' });
      for (let i = 0; i <= 10; i++) Lp(st.navrch, [[xs, ys + i * 10 * K.ky], [xs - (i % 5 ? 1.5 : 3), ys + i * 10 * K.ky]], 0.2);
      Tp(st.navrch, xs - 3.6, ys + 0.8, '0', 2, 'r'); Tp(st.navrch, xs - 3.6, ys + 50 * K.ky + 0.7, '50', 2, 'r'); Tp(st.navrch, xs - 3.6, ys + 100 * K.ky + 0.7, '100', 2, 'r');
    };
    const pt = (W, H, typ) => ({ W, H, obsah: [], navrch: [], clip: null, obrazky: [], typ });
    // převod prvků modelu (y nahoru) na papír
    const naPapir = (pr, X, Y, arr) => {
      for (const e of pr) {
        if (e.t === 'l') arr.push(Object.assign({}, e, { b: e.b.map((q) => [X(q[0]), Y(q[1])]), s: (e.s || 0.2) * Math.min(1, K.ky) }));
        else if (e.t === 'k') arr.push({ t: 'e', x: X(e.x), y: Y(e.y), rx: e.r * K.kx, ry: e.r * K.ky, s: e.s, c: e.c, f: e.f, d: e.d });
        else if (e.t === 'txt') arr.push(Object.assign({}, e, { x: X(e.x), y: Y(e.y) }));
      }
    };

    // úvodní strana: kusovník a bezpečnost
    if (!o.jenDil) {
      const W = p0, H = p1, sir = W - 2 * ok;
      let st = null, y = 0;
      const nova = () => { st = pt(W, H, 'text'); out.push(st); y = ok + 6; meritka(st); };
      const radek = (txt, h, c) => { if (!st || y > H - ok - PATA - 4) nova(); Tp(st.navrch, ok, y, txt, h || 3, 'l', c); y += (h || 3) * 1.5; };
      const odst = (txt, h) => { const max = Math.floor(sir / ((h || 3) * 0.5)); let r = ''; for (const s of String(txt).split(' ')) { if ((r + ' ' + s).length > max) { radek(r, h); r = s; } else r = r ? r + ' ' + s : s; } if (r) radek(r, h); };
      nova();
      radek(o.nazev || 'Dřevěné hračky', 5.5); y += 1;
      for (const t of N.info) odst(t, 2.8);
      for (const t of N.varovani) odst('Pozor: ' + t, 2.8);
      y += 2; radek('Kusovník', 4.2);
      const sl = [0, 10, 78, 92, 140, 168];
      for (let i = 0; i < 6; i++) Tp(st.navrch, ok + sl[i], y, ['poz', 'název', 'ks', 'rozměr (mm)', 'materiál', 'poznámka'][i], 2.4, 'l', '#555555');
      y += 1.2; Lp(st.navrch, [[ok, y], [ok + sir, y]], 0.15, '#999999'); y += 3.4;
      for (const k of N.kusovnik) {
        if (y > H - ok - PATA - 6) { nova(); }
        const v = [String(k.poz), k.nazev.slice(0, 44), String(k.ks), String(k.rozmer).slice(0, 32), String(k.mat || '').slice(0, 18), String(k.pozn || '')];
        for (let i = 0; i < 5; i++) Tp(st.navrch, ok + sl[i], y, v[i], 2.5);
        // poznámka zalomená
        const max = Math.floor((sir - sl[5]) / 1.25); let r = '', prvni = true;
        for (const s of v[5].split(' ')) { if ((r + ' ' + s).length > max) { Tp(st.navrch, ok + sl[5], y, r, 2.4, 'l', '#333333'); y += 3.4; r = s; prvni = false; } else r = r ? r + ' ' + s : s; }
        if (r) Tp(st.navrch, ok + sl[5], y, r, 2.4, 'l', '#333333');
        y += 4; void prvni;
      }
      y += 3; radek('Bezpečnost (orientační kontrola, není to certifikace podle EN 71)', 4.2);
      for (const b of N.bezpecnost) odst(`${b.u === 'ok' ? '✓' : b.u === 'pozor' ? '!' : '✗'} ${b.t}`, 2.6);
      if (y > H - ok - PATA - 62) nova();
      y += 3; radek('Kontrolní čtverec 50 × 50 mm', 3);
      st.navrch.push({ t: 'r', x: ok, y, w: 50 * K.kx, h: 50 * K.ky, s: 0.25, c: '#000000' });
      Tp(st.navrch, ok + 25 * K.kx, y + 25 * K.ky + 1, '50 × 50 mm', 3.4, 'c');
    }

    // šablony dílů
    const dily = N.dily.filter((d) => !o.jenDil || d.id === o.jenDil);
    const sceny = dily.map((d) => scenaDilu(d, { popisy: S.popisy !== false }));
    const [W, H] = [p0, p1];
    const uw = (W - 2 * ok - PAS) / K.kx, uh = (H - 2 * ok - PATA) / K.ky;     // užitná plocha v mm modelu
    const R = rozloz(sceny, uw, uh, 6);
    const obrazekDilu = (sc, ox, oy) => {
      if (!o.obrazek || !sc.dil.obrazek) return null;
      const b = sc.bbDil;
      return { x: b.x0 + ox, y: b.y0 + oy, w: b.w, h: b.h };
    };
    R.plochy.forEach((P, i) => {
      const st = pt(W, H, 'sablona');
      const X = (x) => ok + x * K.kx, Y = (y) => ok + (uh - y) * K.ky;
      naPapir(P.prvky, X, Y, st.obsah);
      for (const s of P.sceny) { const ob = obrazekDilu(sceny[s.i], s.ox, s.oy); if (ob) st.obrazky.push({ x: X(ob.x), y: Y(ob.y + ob.h), w: ob.w * K.kx, h: ob.h * K.ky, data: o.obrazek.data, format: o.obrazek.format }); }
      Tp(st.navrch, ok, H - ok - PATA + 5, `${o.nazev || 'Dřevěné hračky'} · šablony 1:1 · list ${i + 1}`, 2.6);
      meritka(st);
      out.push(st);
    });
    // velké díly – dělení na listy s přesahem
    for (const i of R.velke) {
      const sc = sceny[i], w = sc.x1 - sc.x0, h = sc.y1 - sc.y0;
      const nx = Math.max(1, Math.ceil((w - g) / (uw - g))), ny = Math.max(1, Math.ceil((h - g) / (uh - g)));
      for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
        const st = pt(W, H, 'sablona');
        const lx0 = sc.x0 + c * (uw - g), ly1 = sc.y1 - r * (uh - g);
        const X = (x) => ok + (x - lx0) * K.kx, Y = (y) => ok + (ly1 - y) * K.ky;
        st.clip = { x: ok, y: ok, w: uw * K.kx, h: uh * K.ky };
        naPapir(sc.prvky, X, Y, st.obsah);
        const ob = obrazekDilu(sc, 0, 0); if (ob) st.obrazky.push({ x: X(ob.x), y: Y(ob.y + ob.h), w: ob.w * K.kx, h: ob.h * K.ky, data: o.obrazek.data, format: o.obrazek.format });
        if (c < nx - 1) Lp(st.navrch, [[ok + (uw - g) * K.kx, ok], [ok + (uw - g) * K.kx, ok + uh * K.ky]], 0.2, '#888888', 'c');
        if (r < ny - 1) Lp(st.navrch, [[ok, ok + (uh - g) * K.ky], [ok + uw * K.kx, ok + (uh - g) * K.ky]], 0.2, '#888888', 'c');
        for (const [x, y] of [[ok, ok], [ok + uw * K.kx, ok], [ok, ok + uh * K.ky], [ok + uw * K.kx, ok + uh * K.ky]]) { Lp(st.navrch, [[x - 3, y], [x + 3, y]], 0.2); Lp(st.navrch, [[x, y - 3], [x, y + 3]], 0.2); }
        if (c > 0 || r > 0) Tp(st.navrch, ok + 4, ok - 2.2, `oříznout ${c > 0 ? 'levý' : ''}${c > 0 && r > 0 ? ' a ' : ''}${r > 0 ? 'horní' : ''} okraj a přiložit na čárkovanou čáru sousedního listu (přesah ${cz(g, 0)} mm)`, 2.3, 'l', '#555555');
        Tp(st.navrch, ok, H - ok - PATA + 5, `${sc.dil.id} – ${sc.dil.nazev} · list ${r * nx + c + 1}/${nx * ny} (řádek ${r + 1}, sloupec ${c + 1}) · tisk 100 %`, 2.6);
        // mapka listů
        for (let a = 0; a < ny; a++) for (let b = 0; b < nx; b++) st.navrch.push({ t: 'r', x: W - ok - PAS - 3.2 * (nx - b), y: H - ok - PATA + 1 + a * 3.2, w: 2.8, h: 2.8, s: 0.15, c: '#000000', f: a === r && b === c });
        meritka(st);
        out.push(st);
      }
    }
    return out;
  }

  /* ---------------- PDF (jsPDF parametrem) ---------------- */
  const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/[„“]/g, '"').replace(/°/g, ' st.').replace(/Ø/g, 'O').replace(/×/g, 'x').replace(/[✓]/g, '+').replace(/[✗]/g, 'x').replace(/[^\x20-\x7e]/g, '');
  function rgb(hex) { const v = parseInt(String(hex || '#000000').slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function pdf(jsPDF, str, o) {
    o = Object.assign({ compress: true }, o || {});
    let doc = null, uni = false;
    // Liberation Sans nemá ✓ ✗ – nahradit písmeny
    const T = (s) => (uni ? String(s).replace(/✓/g, '+').replace(/✗/g, '×').replace(/⌀/g, 'Ø') : bezDiakritiky(s));
    for (const st of str) {
      const orient = st.W > st.H ? 'l' : 'p';
      if (!doc) {
        doc = new jsPDF({ unit: 'mm', format: [st.W, st.H], orientation: orient, compress: o.compress });
        if (o.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
        doc.setProperties({ title: o.nazev || 'Dřevěné hračky', creator: 'Dřevěné hračky a dětský nábytek – šablony 1:1' });
      } else doc.addPage([st.W, st.H], orient);
      const kresli = (e) => {
        const c = rgb(e.c); doc.setDrawColor(...c); doc.setFillColor(...c);
        if (e.t === 'l') {
          doc.setLineWidth(Math.max(0.05, e.s || 0.2));
          const s = Math.max(0.12, e.s || 0.2);
          if (e.d === 'c') doc.setLineDashPattern([s * 12, s * 8], 0); else if (e.d === 'o') doc.setLineDashPattern([s * 30, s * 8, s * 4, s * 8], 0);
          if (e.b.length === 2 && !e.z) doc.line(e.b[0][0], e.b[0][1], e.b[1][0], e.b[1][1]);
          else { const seg = []; for (let i = 1; i < e.b.length; i++) seg.push([e.b[i][0] - e.b[i - 1][0], e.b[i][1] - e.b[i - 1][1]]); doc.lines(seg, e.b[0][0], e.b[0][1], [1, 1], 'S', !!e.z); }
          if (e.d) doc.setLineDashPattern([], 0);
        } else if (e.t === 'e') {
          doc.setLineWidth(Math.max(0.05, e.s || 0.2));
          if (e.d === 'c') doc.setLineDashPattern([2, 1.5], 0);
          doc.ellipse(e.x, e.y, e.rx, e.ry, e.f ? 'F' : 'S');
          if (e.d) doc.setLineDashPattern([], 0);
        } else if (e.t === 'r') { doc.setLineWidth(Math.max(0.05, e.s || 0.2)); doc.rect(e.x, e.y, e.w, e.h, e.f ? 'FD' : 'S'); }
        else if (e.t === 'm') { doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3); if (e.osa === 'x') doc.line(e.x0, e.y, e.x1, e.y); else doc.line(e.x0, e.y, e.x0, e.y1); }
        else if (e.t === 'txt') {
          if (uni) doc.setFont('LS', 'normal'); else doc.setFont('helvetica', 'normal');
          doc.setFontSize(e.h / 0.3528); doc.setTextColor(...c);
          const t = T(e.txt), w = doc.getTextWidth(t), kk = e.a === 'r' ? w : e.a === 'c' ? w / 2 : 0;
          doc.text(t, e.x - kk, e.y);
        }
      };
      if (st.clip) { doc.saveGraphicsState(); doc.rect(st.clip.x, st.clip.y, st.clip.w, st.clip.h, null); doc.clip(); doc.discardPath(); }
      for (const im of st.obrazky || []) { try { doc.addImage(im.data, im.format || 'JPEG', im.x, im.y, im.w, im.h); } catch (e) { /* obrázek nejde vložit */ } }
      for (const e of st.obsah) kresli(e);
      if (st.clip) doc.restoreGraphicsState();
      for (const e of st.navrch) kresli(e);
    }
    if (!doc) doc = new jsPDF({ unit: 'mm', format: 'a4' });
    return doc;
  }

  /* ---------------- technické pohledy ---------------- */
  /** průmět tělesa do pohledu → {b (polygon v souřadnicích pohledu u, v), hloubka} */
  function prumet(t, pohled) {
    // pohled: 'predni' (u = x, v = z, hloubka y), 'bok' (u = y, v = z, hloubka −x … zleva), 'pudorys' (u = x, v = y, hloubka −z)
    const P = (x, y, z) => (pohled === 'predni' ? [x, z, y] : pohled === 'bok' ? [y, z, x] : [x, -y, -z]);
    if (t.typ === 'box' || t.typ === 'modul') {
      const r = [P(t.x, t.y, t.z), P(t.x + t.sx, t.y + t.sy, t.z + t.sz)];
      return [{ b: DH.obdelnik(Math.min(r[0][0], r[1][0]), Math.min(r[0][1], r[1][1]), Math.max(r[0][0], r[1][0]), Math.max(r[0][1], r[1][1])), h: Math.min(r[0][2], r[1][2]) }];
    }
    if (t.typ === 'valec') {
      const osaVPohledu = (pohled === 'predni' && t.osa === 'y') || (pohled === 'bok' && t.osa === 'x') || (pohled === 'pudorys' && t.osa === 'z');
      const c = P(t.x, t.y, t.z);
      if (osaVPohledu) { const k = DH.stredTelesa(t); const q = P(k[0], k[1], k[2]); const h0 = t.osa === 'y' ? t.y : t.osa === 'x' ? t.x : -(t.z + t.h); return [{ b: DH.kruh(q[0], q[1], t.r, 48), h: h0 }]; }
      const k1 = t.osa === 'x' ? P(t.x + t.h, t.y, t.z) : t.osa === 'y' ? P(t.x, t.y + t.h, t.z) : P(t.x, t.y, t.z + t.h);
      const du = Math.abs(k1[0] - c[0]) > 1e-6 ? 0 : t.r, dv = Math.abs(k1[1] - c[1]) > 1e-6 ? 0 : t.r;
      return [{ b: DH.obdelnik(Math.min(c[0], k1[0]) - du, Math.min(c[1], k1[1]) - dv, Math.max(c[0], k1[0]) + du, Math.max(c[1], k1[1]) + dv), h: Math.min(c[2], k1[2]) - t.r }];
    }
    if (t.typ === 'koule') { const c = P(t.x, t.y, t.z); return [{ b: DH.kruh(c[0], c[1], t.r, 32), h: c[2] - t.r }]; }
    if (t.typ === 'extr') {
      const r = t.rovina || 'xy';
      const vRovine = (r === 'xz' && pohled === 'predni') || (r === 'yz' && pohled === 'bok') || (r === 'xy' && pohled === 'pudorys');
      const body = t.b.map((p) => P(...DH.extrNaSvet(t, p[0], p[1], 0)));
      if (vRovine) { const b = body.map((q) => [q[0], q[1]]); return [{ b, h: Math.min(...body.map((q) => q[2]), ...t.b.map((p) => P(...DH.extrNaSvet(t, p[0], p[1], t.tl))[2])), diry: (t.diry || []).map((d) => d.map((p) => { const q = P(...DH.extrNaSvet(t, p[0], p[1], 0)); return [q[0], q[1]]; })) }]; }
      const vse = body.concat(t.b.map((p) => P(...DH.extrNaSvet(t, p[0], p[1], t.tl))));
      // obrys průmětu = obálka bodů v pohledu (pro boční průmět extruze je to obdélník ze siluety)
      const bb = DH.bbox([vse.map((q) => [q[0], q[1]])]);
      if (r === 'xy' && pohled !== 'pudorys') return [{ b: DH.obdelnik(bb.x0, bb.y0, bb.x1, bb.y1), h: Math.min(...vse.map((q) => q[2])) }];
      // výška profilu v pohledu závisí na poloze – přibližně silueta: pro každý u max/min v
      const u0 = bb.x0, u1 = bb.x1, n = 40, horni = [], dolni = [];
      for (let i = 0; i <= n; i++) {
        const u = u0 + (u1 - u0) * i / n;
        let lo = Infinity, hi = -Infinity;
        for (let j = 0; j < vse.length; j++) {
          const a = vse[j], b = vse[(j + 1) % vse.length];
          if ((a[0] - u) * (b[0] - u) <= 0 && Math.abs(a[0] - b[0]) > 1e-9) { const f = (u - a[0]) / (b[0] - a[0]), v = a[1] + (b[1] - a[1]) * f; lo = Math.min(lo, v); hi = Math.max(hi, v); }
          if (Math.abs(a[0] - u) < 1e-6) { lo = Math.min(lo, a[1]); hi = Math.max(hi, a[1]); }
        }
        if (isFinite(lo)) { horni.push([u, hi]); dolni.push([u, lo]); }
      }
      return [{ b: horni.concat(dolni.reverse()), h: Math.min(...vse.map((q) => q[2])) }];
    }
    return [];
  }
  /** SVG tří pohledů s kótami (na bílém pozadí). → {svg, sirka, vyska} */
  function pohledy(N, o) {
    o = o || {};
    const T = N.telesa.filter((t) => !t.skryt);
    if (!T.length) return { svg: '' };
    const vys = {};
    for (const p of ['predni', 'bok', 'pudorys']) {
      const pr = T.flatMap((t) => prumet(t, p).map((q) => Object.assign(q, { barva: t.barva })));
      pr.sort((a, b) => b.h - a.h);
      vys[p] = { pr, bb: DH.bbox(pr.map((q) => q.b)) };
    }
    const mez = Math.max(40, 0.12 * Math.max(vys.predni.bb.w, vys.bok.bb.w, vys.predni.bb.h));
    const A = vys.predni.bb, B = vys.bok.bb, C = vys.pudorys.bb;
    // rozvržení: přední vlevo nahoře, bok vpravo, půdorys pod předním (evropské promítání zjednodušeně)
    const offs = { predni: [-A.x0, -A.y0 + C.h + mez], bok: [-B.x0 + A.w + mez, -B.y0 + C.h + mez], pudorys: [-C.x0, -C.y0] };
    const sirka = A.w + mez + B.w, vyska = C.h + mez + Math.max(A.h, B.h);
    const k = Math.max(sirka, vyska) / 300;        // měřítko čar a písma
    let s = '';
    const Y = (v) => -v;
    const kota = (a, b, txt, ofs, vodor) => {
      const [ax, ay] = a, [bx, by] = b, h = 3.2 * k, c = '#1f5fa8';
      if (vodor) {
        const y = ofs; s += `<path d="M${n3(ax)} ${n3(Y(ay))}V${n3(Y(y))}M${n3(bx)} ${n3(Y(by))}V${n3(Y(y))}M${n3(ax)} ${n3(Y(y))}H${n3(bx)}" stroke="${c}" stroke-width="${n3(0.25 * k)}" fill="none"/>`;
        for (const x of [ax, bx]) s += `<path d="M${n3(x - 1.2 * k)} ${n3(Y(y) + 1.2 * k)}L${n3(x + 1.2 * k)} ${n3(Y(y) - 1.2 * k)}" stroke="${c}" stroke-width="${n3(0.35 * k)}"/>`;
        s += `<text x="${n3((ax + bx) / 2)}" y="${n3(Y(y) - 1.2 * k)}" font-size="${n3(h)}" text-anchor="middle" fill="${c}">${esc(txt)}</text>`;
      } else {
        const x = ofs; s += `<path d="M${n3(ax)} ${n3(Y(ay))}H${n3(x)}M${n3(bx)} ${n3(Y(by))}H${n3(x)}M${n3(x)} ${n3(Y(ay))}V${n3(Y(by))}" stroke="${c}" stroke-width="${n3(0.25 * k)}" fill="none"/>`;
        for (const y of [ay, by]) s += `<path d="M${n3(x - 1.2 * k)} ${n3(Y(y) + 1.2 * k)}L${n3(x + 1.2 * k)} ${n3(Y(y) - 1.2 * k)}" stroke="${c}" stroke-width="${n3(0.35 * k)}"/>`;
        s += `<text x="${n3(x - 1.2 * k)}" y="${n3(Y((ay + by) / 2))}" font-size="${n3(h)}" text-anchor="middle" fill="${c}" transform="rotate(-90 ${n3(x - 1.2 * k)} ${n3(Y((ay + by) / 2))})">${esc(txt)}</text>`;
      }
    };
    const NAZ = { predni: 'Pohled zepředu', bok: 'Pohled z boku', pudorys: 'Půdorys' };
    for (const p of ['predni', 'bok', 'pudorys']) {
      const [dx, dy] = offs[p], V = vys[p];
      s += `<g>`;
      for (const q of V.pr) {
        const d = (b) => b.map((t, i) => (i ? 'L' : 'M') + n3(t[0] + dx) + ' ' + n3(Y(t[1] + dy))).join('') + 'Z';
        s += `<path d="${d(q.b)}${(q.diry || []).map(d).join('')}" fill="${q.barva || '#d9b98a'}" fill-rule="evenodd" stroke="#3a2a1a" stroke-width="${n3(0.3 * k)}" stroke-linejoin="round"/>`;
      }
      s += `</g>`;
      const bb = V.bb;
      s += `<text x="${n3(bb.x0 + dx)}" y="${n3(Y(bb.y1 + dy) - 3 * k)}" font-size="${n3(3.6 * k)}" fill="#333">${NAZ[p]}</text>`;
      // celkové kóty
      kota([bb.x0 + dx, bb.y0 + dy], [bb.x1 + dx, bb.y0 + dy], cz(bb.w, 0), bb.y0 + dy - 7 * k, true);
      if (p !== 'pudorys' || true) kota([bb.x1 + dx, bb.y0 + dy], [bb.x1 + dx, bb.y1 + dy], cz(bb.h, 0), bb.x1 + dx + 7 * k, false);
      for (const q of N.koty.filter((q) => q.pohled === p && q.a)) {
        const sv = q.a[0] === q.b[0];
        if (sv) kota([q.a[0] + dx, q.a[1] + dy], [q.b[0] + dx, q.b[1] + dy], q.txt, q.a[0] + dx + (q.o || 0) * k, false);
        else kota([q.a[0] + dx, q.a[1] + dy], [q.b[0] + dx, q.b[1] + dy], q.txt, q.a[1] + dy + (q.o || 0) * k, true);
      }
    }
    const m = 14 * k;
    const svgTxt = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="${n3(-m - 6 * k)} ${n3(-vyska - m)} ${n3(sirka + 2 * m + 12 * k)} ${n3(vyska + 2 * m)}" font-family="Liberation Sans, Arial, sans-serif"><rect x="${n3(-m - 6 * k)}" y="${n3(-vyska - m)}" width="${n3(sirka + 2 * m + 12 * k)}" height="${n3(vyska + 2 * m)}" fill="#fff"/>${s}</svg>`;
    return { svg: svgTxt, sirka, vyska };
  }

  /** řezný plán (kostky) → SVG */
  function rezPlanSvg(N) {
    if (!N.rezPlan || !N.rezPlan.length) return '';
    const L = Math.max(...N.rezPlan.flatMap((g) => g.hranoly.map((h) => h.delka))), radek = 16, w = 640, k = (w - 20) / L;
    let y = 4, s = '';
    for (const g of N.rezPlan) {
      s += `<text x="10" y="${y + 9}" font-size="9" fill="#333">Hranol ${cz(g.prurez[0])} × ${cz(g.prurez[1])} mm – ${g.hranoly.length} ks, využití ${cz(100 * g.vyuziti, 0)} %</text>`;
      y += 13;
      g.hranoly.forEach((h, i) => {
        s += `<rect x="10" y="${y}" width="${h.delka * k}" height="${radek - 4}" fill="#f3e7d0" stroke="#8a6a3e" stroke-width="0.6"/>`;
        for (const q of h.kusy) {
          s += `<rect x="${10 + q.x0 * k}" y="${y}" width="${Math.max(0.5, q.delka * k)}" height="${radek - 4}" fill="#d9b98a" stroke="#3a2a1a" stroke-width="0.5"/>`;
          if (q.delka * k > 22) s += `<text x="${10 + (q.x0 + q.delka / 2) * k}" y="${y + 8.6}" font-size="6.5" text-anchor="middle" fill="#222">${cz(q.delka, 0)}</text>`;
        }
        s += `<text x="${10 + h.delka * k - 2}" y="${y + 8.6}" font-size="6.5" text-anchor="end" fill="#8a3a1e">${h.zbytek > 30 ? 'zbytek ' + cz(h.zbytek, 0) : ''}</text>`;
        y += radek;
        void i;
      });
      y += 6;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${y}" width="100%" font-family="Liberation Sans, Arial, sans-serif"><rect width="${w}" height="${y}" fill="#fff"/>${s}</svg>`;
  }

  /** rozložení na desku (laser / CNC) – pro SVG/DXF; o: {W, H, mezera, popisy} → {plochy, velke, sceny} */
  function deska(N, o) {
    o = Object.assign({ W: 600, H: 400, mezera: 4, popisy: true }, o || {});
    const dily = N.dily.filter((d) => !d.sablona || o.sablony);
    const sceny = dily.map((d) => scenaDilu(d, { popisy: o.popisy }));
    const R = rozloz(sceny, o.W, o.H, o.mezera, { opakovat: true });
    R.sceny = sceny;
    return R;
  }

  const API = { scenaDilu, rozloz, svg, svgPrvek, dxf, csv, strany, pdf, pohledy, prumet, rezPlanSvg, deska, rozmerPapiru, korekce, bezDiakritiky, BARVY };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.DHV = API;
})(typeof window !== 'undefined' ? window : globalThis);

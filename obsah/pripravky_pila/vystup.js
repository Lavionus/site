/* ============================================================
   Přípravky pro pilu a vrtačku – výstupy (bez DOM): výkresy s kótami, SVG, DXF, strany PDF, PDF (jsPDF parametrem)
   Prvky výkresu jsou v mm modelu (y nahoru); popisy, kóty a tloušťky čar jsou v mm papíru a násobí se
   měřítkem k (výkres 1 : k), aby byly na papíře stejně velké.
   ============================================================ */
(function (koren) {
  'use strict';
  const PP = koren.PP || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const r2 = (x) => Math.round(x * 100) / 100;
  const n3 = (x) => (Math.round(x * 1000) / 1000).toString();
  const cz = PP.cz;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const MERITKA = [0.2, 0.5, 1, 2, 2.5, 5, 10, 15, 20, 25, 50, 100];

  /* ---------- rozbalení kót na čáry a text ---------- */
  function rozbal(prvky, k) {
    const out = [];
    for (const e of prvky) {
      if (e.t === 'l') out.push(Object.assign({}, e, { s: e.s * k }));
      else if (e.t === 'k') out.push(Object.assign({}, e, { s: e.s * k }));
      else if (e.t === 'txt') out.push(Object.assign({}, e, { h: e.h * k }));
      else if (e.t === 'kota') {
        const [ax, ay] = e.a, [bx, by] = e.b, dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
        if (L < 1e-6) continue;
        const ux = dx / L, uy = dy / L, nx = -uy, ny = ux, off = e.off * k, sg = off >= 0 ? 1 : -1, c = e.c;
        const pa = [ax + nx * off, ay + ny * off], pb = [bx + nx * off, by + ny * off];
        const pres = 1.5 * k * sg, mez = 1 * k * sg;
        if (Math.abs(off) > 0.01) {
          out.push({ t: 'l', b: [[ax + nx * mez, ay + ny * mez], [pa[0] + nx * pres, pa[1] + ny * pres]], s: 0.13 * k, c, v: 'koty' });
          out.push({ t: 'l', b: [[bx + nx * mez, by + ny * mez], [pb[0] + nx * pres, pb[1] + ny * pres]], s: 0.13 * k, c, v: 'koty' });
        }
        out.push({ t: 'l', b: [pa, pb], s: 0.18 * k, c, v: 'koty' });
        const sp = Math.min(2.6 * k, L * 0.3), sw = 0.8 * k;
        for (const [p, s] of [[pa, 1], [pb, -1]]) out.push({ t: 'l', b: [[p[0] + ux * sp * s + nx * sw, p[1] + uy * sp * s + ny * sw], p, [p[0] + ux * sp * s - nx * sw, p[1] + uy * sp * s - ny * sw]], s: 0.18 * k, c, v: 'koty', z: true, f: true });
        let u = Math.atan2(uy, ux) * 180 / Math.PI;
        let tn = [nx, ny];
        if (u > 90.01 || u <= -90) { u += u > 0 ? -180 : 180; }
        // text vždy nad kótovací čárou (ve směru „nahoru“ čteného textu)
        const ur = u * Math.PI / 180, up = [-Math.sin(ur), Math.cos(ur)];
        const h = e.h * k, mx = (pa[0] + pb[0]) / 2 + up[0] * 0.9 * k, my = (pa[1] + pb[1]) / 2 + up[1] * 0.9 * k;
        void tn;
        out.push({ t: 'txt', x: mx, y: my, txt: e.txt, h, a: 'c', u, c, v: 'koty' });
      }
    }
    return out;
  }
  function bboxPrvku(pr) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const p = (x, y) => { if (!isFinite(x) || !isFinite(y)) return; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    for (const e of pr) {
      if (e.t === 'l') e.b.forEach((q) => p(q[0], q[1]));
      else if (e.t === 'k') { p(e.x - e.r, e.y - e.r); p(e.x + e.r, e.y + e.r); }
      else if (e.t === 'txt') {
        const w = e.txt.length * e.h * 0.52, u = (e.u || 0) * Math.PI / 180, c = Math.cos(u), s = Math.sin(u);
        const k0 = e.a === 'r' ? -w : e.a === 'c' ? -w / 2 : 0;
        for (const [a, b] of [[k0, -0.25 * e.h], [k0 + w, -0.25 * e.h], [k0, e.h], [k0 + w, e.h]]) p(e.x + a * c - b * s, e.y + a * s + b * c);
      }
    }
    if (!isFinite(x0)) return { x0: 0, y0: 0, x1: 10, y1: 10 };
    return { x0, y0, x1, y1 };
  }
  /** nejmenší normalizované měřítko, při kterém se výkres vejde na plochu uw × uh (mm papíru) */
  function meritkoVykresu(V, uw, uh) {
    for (const M of MERITKA) { const b = bboxPrvku(rozbal(V.prvky, M)); if ((b.x1 - b.x0) / M <= uw && (b.y1 - b.y0) / M <= uh) return M; }
    return MERITKA[MERITKA.length - 1];
  }
  const popisMeritka = (M) => (M < 1 ? Math.round(1 / M) + ' : 1' : '1 : ' + String(M).replace('.', ','));

  /* ---------- automatický výkres deskového dílu ---------- */
  function vykresDilu(d) {
    const V = new PP.Vykres('dil_' + d.id, `${d.id} – ${d.nazev}`, `${d.material}, tl. ${cz(d.tl, 1)} mm, ${d.ks} ks`);
    PP.kresliDesku(V, d, 0, 0);
    const b = PP.bbox(d.obrys);
    V.kota([b.x0, b.y0], [b.x1, b.y0], -7).kota([b.x1, b.y0], [b.x1, b.y1], -7);
    const ot = (d.otvory || []).slice(0, 14);
    const xs = [...new Set(ot.map((q) => r2(q.x)))].sort((a, c) => a - c).slice(0, 10), ys = [...new Set(ot.map((q) => r2(q.y)))].sort((a, c) => a - c).slice(0, 8);
    xs.forEach((x, i) => V.kota([b.x0, b.y1], [x, b.y1], 6 + (i % 4) * 5, cz(x - b.x0, 1)));
    ys.forEach((y, i) => V.kota([b.x0, b.y0], [b.x0, y], 6 + (i % 4) * 5, cz(y - b.y0, 1)));
    const prum = [...new Set(ot.map((q) => q.d))];
    prum.forEach((dd) => { const q = ot.find((x) => x.d === dd); V.t(q.x + dd / 2 + 1, q.y - dd / 2 - 1, '⌀'.replace('⌀', 'Ø') + cz(dd, 1) + (q.zap ? ' zahl.' : ''), { h: 2.6, c: '#1f5fa8' }); });
    return V;
  }
  /** všechny výkresy návrhu: pohledy režimu + díly (deskové automaticky, tištěné z pohledů) */
  function vsechnyVykresy(N) {
    const out = N.vykresy.map((V) => ({ V, skupina: 'sestava' }));
    for (const d of N.dily) {
      if (d.jenNahled) continue;
      if (d.druh === 'deska') out.push({ V: vykresDilu(d), skupina: 'dil', dil: d.id });
      else if (d.pohledy && d.pohledy.length && !N.vykresy.includes(d.pohledy[0]) && !/díl [2-9]\d*\//.test(d.nazev)) { const V = d.pohledy[0]; V.nazev = V.nazev.includes(d.id) ? V.nazev : `${d.id} – ${V.nazev}`; out.push({ V, skupina: 'tisk', dil: d.id }); }
    }
    return out;
  }

  /* ---------- SVG ---------- */
  function svgPrvek(e) {
    const Y = (y) => -y;
    if (e.t === 'l') {
      const d = e.b.map((q, i) => (i ? 'L' : 'M') + n3(q[0]) + ' ' + n3(Y(q[1]))).join('') + (e.z ? 'Z' : '');
      const s = Math.max(0.05, e.s), da = e.d === 'c' ? ` stroke-dasharray="${n3(s * 12)} ${n3(s * 8)}"` : e.d === 'o' ? ` stroke-dasharray="${n3(s * 30)} ${n3(s * 8)} ${n3(s * 4)} ${n3(s * 8)}"` : '';
      return `<path d="${d}" fill="${e.f ? e.c : 'none'}" stroke="${e.c}" stroke-width="${n3(s)}" stroke-linecap="round" stroke-linejoin="round"${da}/>`;
    }
    if (e.t === 'k') { const s = Math.max(0.05, e.s), da = e.d === 'c' ? ` stroke-dasharray="${n3(s * 12)} ${n3(s * 8)}"` : ''; return `<circle cx="${n3(e.x)}" cy="${n3(Y(e.y))}" r="${n3(e.r)}" fill="${e.f ? e.c : 'none'}" stroke="${e.c}" stroke-width="${n3(s)}"${da}/>`; }
    if (e.t === 'txt') {
      const an = e.a === 'r' ? 'end' : e.a === 'c' ? 'middle' : 'start', rot = e.u ? ` transform="rotate(${n3(-e.u)} ${n3(e.x)} ${n3(Y(e.y))})"` : '';
      return `<text x="${n3(e.x)}" y="${n3(Y(e.y))}" font-size="${n3(e.h)}" text-anchor="${an}" fill="${e.c}"${rot}>${esc(e.txt)}</text>`;
    }
    return '';
  }
  /** SVG výkresu; o: {k (měřítko popisů), mm (true = skutečné rozměry 1:1), okraj, pozadi} */
  function svgVykres(V, o) {
    o = Object.assign({ okraj: 4, pozadi: '#ffffff' }, o || {});
    const k = o.k || meritkoVykresu(V, 260, 170), pr = rozbal(V.prvky, k), b = bboxPrvku(pr), m = o.okraj * k;
    const x = b.x0 - m, y = -b.y1 - m, w = b.x1 - b.x0 + 2 * m, h = b.y1 - b.y0 + 2 * m;
    const rozm = o.mm ? `width="${n3(w)}mm" height="${n3(h)}mm"` : 'width="100%"';
    let s = `<svg xmlns="http://www.w3.org/2000/svg" ${rozm} viewBox="${n3(x)} ${n3(y)} ${n3(w)} ${n3(h)}" font-family="Liberation Sans, Arial, Helvetica, sans-serif">`;
    if (o.pozadi) s += `<rect x="${n3(x)}" y="${n3(y)}" width="${n3(w)}" height="${n3(h)}" fill="${o.pozadi}"/>`;
    for (const e of pr) s += svgPrvek(e);
    return s + '</svg>';
  }

  /* ---------- rozložení deskových dílů vedle sebe (DXF / SVG pro výřez) ---------- */
  function rozlozDesky(dily, mezera) {
    mezera = mezera == null ? 20 : mezera;
    const V = new PP.Vykres('desky', 'Deskové díly 1:1'); let x = 0;
    for (const d of dily) {
      if (d.druh !== 'deska' || d.jenNahled) continue;
      const b = PP.bbox(d.obrys);
      PP.kresliDesku(V, d, x - b.x0, -b.y0);
      V.t(x + 3, b.h + 4, `${d.id} – ${d.nazev} · tl. ${cz(d.tl, 1)} · ${d.ks} ks`, { h: 4, v: 'popis' });
      x += b.w + mezera;
    }
    return V;
  }
  const DXF_VRSTVY = { obrys: 7, vyrezy: 3, otvory: 1, znacky: 8, popis: 2, koty: 5 };
  function dxf(prvky) {
    const L = [], g = (k, v) => { L.push(String(k)); L.push(String(v)); };
    const vr = Object.keys(DXF_VRSTVY);
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, vr.length);
    for (const v of vr) { g(0, 'LAYER'); g(2, v.toUpperCase()); g(70, 0); g(62, DXF_VRSTVY[v]); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB'); g(0, 'ENDSEC'); g(0, 'SECTION'); g(2, 'ENTITIES');
    const ascii = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/Ø/g, '%%c').replace(/°/g, '%%d').replace(/[−–]/g, '-').replace(/×/g, 'x').replace(/[^\x20-\x7e]/g, '');
    for (const e of prvky) {
      const ly = String(e.v || 'obrys').toUpperCase();
      if (e.t === 'l') {
        if (e.b.length === 2 && !e.z) { g(0, 'LINE'); g(8, ly); g(10, n3(e.b[0][0])); g(20, n3(e.b[0][1])); g(30, 0); g(11, n3(e.b[1][0])); g(21, n3(e.b[1][1])); g(31, 0); continue; }
        g(0, 'POLYLINE'); g(8, ly); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, e.z ? 1 : 0);
        for (const q of e.b) { g(0, 'VERTEX'); g(8, ly); g(10, n3(q[0])); g(20, n3(q[1])); g(30, 0); }
        g(0, 'SEQEND'); g(8, ly);
      } else if (e.t === 'k') { g(0, 'CIRCLE'); g(8, ly); g(10, n3(e.x)); g(20, n3(e.y)); g(30, 0); g(40, n3(e.r)); }
      else if (e.t === 'txt') {
        const al = e.a === 'l' ? 0 : e.a === 'r' ? 2 : 1;
        g(0, 'TEXT'); g(8, ly); g(10, n3(e.x)); g(20, n3(e.y)); g(30, 0); g(40, n3(e.h * 0.72)); g(1, ascii(e.txt));
        if (e.u) g(50, n3(e.u));
        if (al) { g(72, al); g(11, n3(e.x)); g(21, n3(e.y)); g(31, 0); }
      }
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return L.join('\r\n') + '\r\n';
  }
  const dxfDesek = (dily) => dxf(rozbal(rozlozDesky(dily).prvky, 1));
  const svgDesek = (dily) => svgVykres(rozlozDesky(dily), { k: 1, mm: true, okraj: 5 });

  /* ---------- řezný plán ---------- */
  function vykresPlanu(skup) {
    const V = new PP.Vykres('plan', `Řezný plán – ${skup.material} ${cz(skup.tl, 1)} mm`, `formát ${cz(skup.L)} × ${cz(skup.S)} mm`);
    skup.listy.forEach((l, i) => {
      const oy = -i * (skup.S + 80);
      V.obd(0, oy, skup.L, oy + skup.S, { s: 0.5 });
      V.t(0, oy + skup.S + 12, `List ${i + 1}/${skup.listy.length}`, { h: 4 });
      for (const q of l.kusy) { V.obd(q.x, oy + q.y, q.x + q.w, oy + q.y + q.h, { s: 0.35, c: '#1f5fa8' }); V.t(q.x + q.w / 2, oy + q.y + q.h / 2 - 1.5, q.w < 160 ? q.id : `${q.id} ${cz(q.w, 0)}×${cz(q.h, 0)}${q.otoceno ? ' ↻' : ''}`, { h: q.w < 160 ? 2.4 : 3, a: 'c' }); }
    });
    return V;
  }

  /* ---------- tisk 1:1: rozvrh listů ---------- */
  function korekceMeritka(nx, ny) {
    const k = (m) => { m = PP.cislo(m, 100); return m > 80 && m < 120 ? 100 / m : 1; };
    return { kx: k(nx), ky: k(ny) };
  }
  const PAPIRY = { a4: [210, 297], a3: [297, 420], letter: [215.9, 279.4] };
  const rozmerPapiru = (n) => (n.papir === 'vlastni' ? [Math.max(80, PP.cislo(n.papirW, 210)), Math.max(80, PP.cislo(n.papirH, 297))] : PAPIRY[n.papir] || PAPIRY.a4);
  const PATA = 16, PRAVY = 12;
  function rozvrhListu(b, pw, ph, n) {
    const K = korekceMeritka(n.kalibX, n.kalibY), ok = PP.cislo(n.okraj, 8), sw = b.x1 - b.x0, sh = b.y1 - b.y0;
    const varianta = (W, H) => {
      const uw = W - 2 * ok - PRAVY, uh = H - 2 * ok - PATA, uwM = uw / K.kx, uhM = uh / K.ky;
      if (sw <= uwM && sh <= uhM) return { W, H, uw, uh, uwM, uhM, nx: 1, ny: 1, g: 0, jeden: true };
      const g = Math.min(Math.max(PP.cislo(n.prekryv, 12), 6), uwM * 0.4, uhM * 0.4);
      return { W, H, uw, uh, uwM, uhM, g, jeden: false, nx: sw <= uwM ? 1 : Math.ceil((sw - g) / (uwM - g) - 1e-9), ny: sh <= uhM ? 1 : Math.ceil((sh - g) / (uhM - g) - 1e-9) };
    };
    const a = varianta(pw, ph), c = varianta(ph, pw), v = c.nx * c.ny < a.nx * a.ny ? c : a;
    const cw = v.nx === 1 ? v.uwM : v.nx * (v.uwM - v.g) + v.g, ch = v.ny === 1 ? v.uhM : v.ny * (v.uhM - v.g) + v.g;
    const ox = b.x0 - (cw - sw) / 2, top = b.y1 + (ch - sh) / 2, listy = [];
    for (let r = 0; r < v.ny; r++) for (let cc = 0; cc < v.nx; cc++) { const x0 = ox + cc * (v.uwM - v.g), y1 = top - r * (v.uhM - v.g); listy.push({ x0, x1: x0 + v.uwM, y0: y1 - v.uhM, y1, r, c: cc }); }
    return Object.assign(v, { listy, kx: K.kx, ky: K.ky, ok });
  }
  /** šablona dílu 1:1 – obrys, otvory s křížem, rysky, popis */
  function sablona1(d) {
    const V = new PP.Vykres('s_' + d.id, d.nazev);
    if (d.druh === 'deska') {
      PP.kresliDesku(V, d, 0, 0);
      for (const q of d.otvory || []) { const kr = q.d / 2 + 3; V.l([[q.x - kr, q.y], [q.x + kr, q.y]], { s: 0.15 }); V.l([[q.x, q.y - kr], [q.x, q.y + kr]], { s: 0.15 }); V.t(q.x + q.d / 2 + 1, q.y + 1, 'Ø' + cz(q.d, 1), { h: 2.2 }); }
      const b = PP.bbox(d.obrys);
      V.t(b.x0 + 4, b.y0 + Math.min(b.h - 6, 6), `${d.id} – ${d.nazev} · tl. ${cz(d.tl, 1)} mm · ${d.ks} ks`, { h: 3 });
    } else if (d.pohledy && d.pohledy[0]) {
      for (const e of d.pohledy[0].prvky) if (e.t !== 'kota') V.prvky.push(e);
    }
    return V;
  }

  /* ---------- strany PDF ---------- */
  /**
   * strany(N, nast, o) → [{W, H, obsah:[prvky papíru], clip, navrch:[...]}]
   * o: {nazev, jen: 'vse'|'sablony'|'vykresy'}
   */
  function strany(N, nast, o) {
    o = Object.assign({ jen: 'vse' }, o || {});
    const S = Object.assign({}, PP.NASTAVENI, nast || {}), [pw, ph] = rozmerPapiru(S), ok = PP.cislo(S.okraj, 8), out = [];
    const K = korekceMeritka(S.kalibX, S.kalibY);
    const pt = (W, H, typ) => ({ W, H, obsah: [], navrch: [], clip: null, typ });
    const Lp = (a, b, s, c, d) => a.push({ t: 'l', b, s, c: c || '#000000', d });
    const Tp = (a, x, y, txt, h, al, u, c) => a.push({ t: 'txt', x, y, txt: String(txt), h, a: al || 'l', u: u || 0, c: c || '#000000' });
    const preved = (pr, X, Y, kx, ky, arr) => {
      for (const e of pr) {
        if (e.t === 'l') arr.push({ t: 'l', b: e.b.map((q) => [X(q[0]), Y(q[1])]), s: e.s, c: e.c, d: e.d, z: e.z, f: e.f });
        else if (e.t === 'k') arr.push({ t: 'e', x: X(e.x), y: Y(e.y), rx: e.r * kx, ry: e.r * ky, s: e.s, c: e.c, f: e.f, d: e.d });
        else if (e.t === 'txt') arr.push({ t: 'txt', x: X(e.x), y: Y(e.y), txt: e.txt, h: e.h, a: e.a, u: e.u, c: e.c });
      }
    };
    const meritka = (st, W, H, kx, ky) => {
      const y = H - ok - 3, x0 = ok;
      st.navrch.push({ t: 'm', x0, y, x1: x0 + 100 * kx, osa: 'x' });
      for (let i = 0; i <= 10; i++) Lp(st.navrch, [[x0 + i * 10 * kx, y], [x0 + i * 10 * kx, y - (i % 5 ? 1.5 : 3)]], 0.2);
      Tp(st.navrch, x0, y - 3.6, '0', 2, 'c'); Tp(st.navrch, x0 + 50 * kx, y - 3.6, '50', 2, 'c'); Tp(st.navrch, x0 + 100 * kx, y - 3.6, '100 mm', 2, 'c');
      Tp(st.navrch, x0 + 100 * kx + 7, y - 4, 'Kontrola: úsečky musí mít přesně 50 a 100 mm vodorovně i svisle.', 2.1);
      Tp(st.navrch, x0 + 100 * kx + 7, y - 0.8, K.kx !== 1 || K.ky !== 1 ? `Korekce tisku X ×${K.kx.toFixed(4).replace('.', ',')}, Y ×${K.ky.toFixed(4).replace('.', ',')}.` : 'Při odchylce zadejte naměřené délky do Kalibrace.', 2.1);
      const xs = W - ok - 2.5, ys = ok;
      st.navrch.push({ t: 'm', x0: xs, y: ys, y1: ys + 100 * ky, osa: 'y' });
      for (let i = 0; i <= 10; i++) Lp(st.navrch, [[xs, ys + i * 10 * ky], [xs - (i % 5 ? 1.5 : 3), ys + i * 10 * ky]], 0.2);
      Tp(st.navrch, xs - 3.6, ys + 0.8, '0', 2, 'r'); Tp(st.navrch, xs - 3.6, ys + 50 * ky + 0.7, '50', 2, 'r'); Tp(st.navrch, xs - 3.6, ys + 100 * ky + 0.7, '100', 2, 'r');
    };
    const nazev = o.nazev || 'Přípravek';

    // 1) textové strany: výsledky, bezpečnost, kusovník, řezný seznam
    if (o.jen === 'vse') {
      const W = pw, H = ph, sir = W - 2 * ok;
      let st = null, y = 0;
      const nova = () => { st = pt(W, H, 'text'); out.push(st); y = ok + 6; };
      const radek = (txt, h, c) => { if (!st || y > H - ok - 8) nova(); Tp(st.navrch, ok, y, txt, h || 3, 'l', 0, c); y += (h || 3) * 1.5; };
      const odst = (txt, h, c) => { const max = Math.floor(sir / ((h || 3) * 0.5)); let r = ''; for (const s of String(txt).split(' ')) { if ((r + ' ' + s).length > max) { radek(r, h, c); r = '   ' + s; } else r = r ? r + ' ' + s : s; } if (r) radek(r, h, c); };
      nova();
      radek(nazev, 5.5); radek(PP.REZIMY[N.rezim].popis, 2.6, '#444444'); y += 2;
      radek('Výsledky výpočtu', 4);
      for (const v of N.vysledky) odst(`${v.n}: ${v.v}`, 2.9);
      if (N.varovani.length) { y += 2; radek('Upozornění', 4, '#b3261e'); for (const v of N.varovani) odst('• ' + v, 2.8, '#b3261e'); }
      y += 2; radek('Bezpečnost', 4, '#b3261e');
      for (const v of N.bezpecnost) odst('• ' + v, 2.8);
      y += 2; radek('Kusovník – spojovací materiál a kování (typické položky, ověřte)', 4);
      for (const q of N.kusovnik) odst(`${q.ks} ×  ${q.p}${q.pozn ? ' – ' + q.pozn : ''}`, 2.8);
      const desky = N.dily.filter((d) => d.druh === 'deska' && !d.jenNahled), tisky = N.dily.filter((d) => d.druh === 'tisk');
      if (desky.length) { y += 2; radek('Řezný seznam – deskové díly', 4); for (const d of desky) odst(`${d.id}  ${d.ks} ×  ${cz(d.w, 1)} × ${cz(d.h, 1)} × ${cz(d.tl, 1)} mm  – ${d.nazev}, ${d.material}${d.pozn ? '; ' + d.pozn : ''}`, 2.8); }
      if (tisky.length) { y += 2; radek('Tištěné díly (STL)', 4); for (const d of tisky) odst(`${d.id}  ${d.ks} ×  ${cz(d.rozmer[0], 1)} × ${cz(d.rozmer[1], 1)} × ${cz(d.rozmer[2], 1)} mm  – ${d.nazev}, ${d.material}${d.pozn ? '; ' + d.pozn : ''}${d.tiskPozn ? '; ' + d.tiskPozn : ''}`, 2.8); }
      y += 4; if (y > H - ok - 66) nova();
      radek('Kontrolní čtverec 50 × 50 mm', 3);
      st.navrch.push({ t: 'r', x: ok, y, w: 50 * K.kx, h: 50 * K.ky, s: 0.25, c: '#000000' });
      Tp(st.navrch, ok + 25 * K.kx, y + 25 * K.ky + 1, '50 × 50 mm', 3.4, 'c');
    }
    // 2) výkresy v měřítku (A4/A3 naležato)
    if (o.jen !== 'sablony') {
      const W = Math.max(pw, ph), H = Math.min(pw, ph), uw = W - 2 * ok, uh = H - 2 * ok - 14;
      const vyk = vsechnyVykresy(N).map((q) => q.V);
      for (const sk of N.rezny || []) if (sk.listy.length) vyk.push(vykresPlanu(sk));
      for (const V of vyk) {
        const M = meritkoVykresu(V, uw, uh), pr = rozbal(V.prvky, M), b = bboxPrvku(pr), st = pt(W, H, 'vykres');
        const ox = ok + (uw - (b.x1 - b.x0) / M) / 2, oy = ok + 10 + (uh - (b.y1 - b.y0) / M) / 2;
        const X = (x) => ox + (x - b.x0) / M, Y = (y) => oy + (b.y1 - y) / M;
        preved(pr.map((e) => Object.assign({}, e, e.s ? { s: e.s / M } : {}, e.h ? { h: e.h / M } : {})), X, Y, 1 / M, 1 / M, st.obsah);
        Tp(st.navrch, ok, ok + 4, `${nazev} · ${V.nazev}`, 4);
        Tp(st.navrch, ok, ok + 9, `${V.popis ? V.popis + ' · ' : ''}měřítko ${popisMeritka(M)} · rozměry v mm`, 2.6, 'l', 0, '#444444');
        Lp(st.navrch, [[ok, H - ok - 2], [W - ok, H - ok - 2]], 0.15, '#999999');
        Tp(st.navrch, ok, H - ok + 1.5, 'Přípravky pro pilu a vrtačku – hodnoty stroje jsou typické, před výrobou je ověřte měřením.', 2.2, 'l', 0, '#666666');
        out.push(st);
      }
    }
    // 3) šablony 1:1 (deskové díly do velikosti limitu, profily tištěných dílů)
    if (o.jen !== 'vykresy') {
      const lim = S.velke11 ? Infinity : 450;
      for (const d of N.dily) {
        if (d.jenNahled && d.druh === 'deska' && !/[Šš]ablona/.test(d.nazev)) continue;
        if (d.druh === 'deska' && Math.max(d.w, d.h) > lim) continue;
        if (d.druh === 'tisk' && !(d.pohledy && d.pohledy[0])) continue;
        if (d.druh === 'tisk' && /díl [2-9]\d*\//.test(d.nazev)) continue;
        const V = sablona1(d), pr = rozbal(V.prvky, 1), b = bboxPrvku(pr), bb = { x0: b.x0 - 3, y0: b.y0 - 3, x1: b.x1 + 3, y1: b.y1 + 3 };
        const rv = rozvrhListu(bb, pw, ph, S), Nl = rv.listy.length;
        for (const l of rv.listy) {
          const st = pt(rv.W, rv.H, 'sablona');
          const X = (x) => ok + (x - l.x0) * rv.kx, Y = (y) => ok + (l.y1 - y) * rv.ky;
          st.clip = { x: ok, y: ok, w: rv.uw, h: rv.uh };
          preved(pr, X, Y, rv.kx, rv.ky, st.obsah);
          if (!rv.jeden) {
            const gx = rv.g * rv.kx, gy = rv.g * rv.ky;
            if (l.c < rv.nx - 1) Lp(st.navrch, [[ok + rv.uw - gx, ok], [ok + rv.uw - gx, ok + rv.uh]], 0.2, '#888888', 'c');
            if (l.r < rv.ny - 1) Lp(st.navrch, [[ok, ok + rv.uh - gy], [ok + rv.uw, ok + rv.uh - gy]], 0.2, '#888888', 'c');
            for (const [x, y] of [[ok, ok], [ok + rv.uw, ok], [ok, ok + rv.uh], [ok + rv.uw, ok + rv.uh]]) { Lp(st.navrch, [[x - 3, y], [x + 3, y]], 0.2); Lp(st.navrch, [[x, y - 3], [x, y + 3]], 0.2); }
            if (l.c > 0 || l.r > 0) Tp(st.navrch, ok + 4, ok - 2.2, 'ořízněte ' + (l.c > 0 ? 'levý' : '') + (l.c > 0 && l.r > 0 ? ' a ' : '') + (l.r > 0 ? 'horní' : '') + ' okraj a přiložte na čárkovanou čáru sousedního listu', 2.3, 'l', 0, '#555555');
          }
          Tp(st.navrch, ok, rv.H - ok - PATA + 5, `${nazev} · ${d.id} – ${d.nazev} · ŠABLONA 1:1${d.druh === 'tisk' ? ' (profil tištěného dílu – kontrola)' : ''}${Nl > 1 ? ` · list ${l.r * rv.nx + l.c + 1}/${Nl}` : ''} · tiskněte 100 %`, 2.5);
          meritka(st, rv.W, rv.H, rv.kx, rv.ky);
          out.push(st);
        }
      }
    }
    return out;
  }

  /* ---------- PDF ---------- */
  const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/[„“]/g, '"').replace(/°/g, ' st.').replace(/Ø/g, 'O').replace(/×/g, 'x').replace(/[→↻≈≥≤•]/g, (c) => ({ '→': '->', '↻': '(r)', '≈': '~', '≥': '>=', '≤': '<=', '•': '-' })[c]);
  const proPismo = (s) => String(s).replace(/↻/g, '(otoč.)').replace(/⌀/g, 'Ø');
  function rgb(hex) { const v = parseInt(String(hex || '#000000').slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function pdf(jsPDF, str, o) {
    o = Object.assign({ compress: true }, o || {});
    let doc = null, uni = false;
    const T = (s) => (uni ? proPismo(s) : bezDiakritiky(s));
    for (const st of str) {
      const orient = st.W > st.H ? 'l' : 'p';
      if (!doc) {
        doc = new jsPDF({ unit: 'mm', format: [st.W, st.H], orientation: orient, compress: o.compress });
        if (o.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
        doc.setProperties({ title: o.nazev || 'Přípravek', creator: 'Přípravky pro pilu a vrtačku' });
      } else doc.addPage([st.W, st.H], orient);
      const kresli = (e) => {
        const c = rgb(e.c); doc.setDrawColor(...c); doc.setFillColor(...c);
        if (e.t === 'l') {
          const s = Math.max(0.05, e.s || 0.2); doc.setLineWidth(s);
          const q = Math.max(0.12, s);
          if (e.d === 'c') doc.setLineDashPattern([q * 12, q * 8], 0); else if (e.d === 'o') doc.setLineDashPattern([q * 30, q * 8, q * 4, q * 8], 0);
          if (e.b.length === 2 && !e.z) doc.line(e.b[0][0], e.b[0][1], e.b[1][0], e.b[1][1]);
          else { const seg = []; for (let i = 1; i < e.b.length; i++) seg.push([e.b[i][0] - e.b[i - 1][0], e.b[i][1] - e.b[i - 1][1]]); doc.lines(seg, e.b[0][0], e.b[0][1], [1, 1], e.f ? 'FD' : 'S', !!e.z); }
          if (e.d) doc.setLineDashPattern([], 0);
        } else if (e.t === 'e') {
          doc.setLineWidth(Math.max(0.05, e.s || 0.2));
          if (e.d === 'c') doc.setLineDashPattern([2, 1.4], 0);
          doc.ellipse(e.x, e.y, e.rx, e.ry, e.f ? 'F' : 'S');
          if (e.d) doc.setLineDashPattern([], 0);
        } else if (e.t === 'r') { doc.setLineWidth(Math.max(0.05, e.s || 0.2)); doc.rect(e.x, e.y, e.w, e.h, 'S'); }
        else if (e.t === 'm') { doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3); if (e.osa === 'x') doc.line(e.x0, e.y, e.x1, e.y); else doc.line(e.x0, e.y, e.x0, e.y1); }
        else if (e.t === 'txt') {
          if (uni) doc.setFont('LS', 'normal'); else doc.setFont('helvetica', 'normal');
          doc.setFontSize(Math.max(1, e.h / 0.3528)); doc.setTextColor(...c);
          const t = T(e.txt), w = doc.getTextWidth(t), u = (e.u || 0) * Math.PI / 180, kk = e.a === 'r' ? w : e.a === 'c' ? w / 2 : 0;
          doc.text(t, e.x - Math.cos(u) * kk, e.y + Math.sin(u) * kk, e.u ? { angle: e.u } : undefined);
        }
      };
      if (st.clip) { doc.saveGraphicsState(); doc.rect(st.clip.x, st.clip.y, st.clip.w, st.clip.h, null); doc.clip(); doc.discardPath(); }
      for (const e of st.obsah) kresli(e);
      if (st.clip) doc.restoreGraphicsState();
      for (const e of st.navrch) kresli(e);
    }
    if (!doc) doc = new jsPDF({ unit: 'mm', format: 'a4' });
    return doc;
  }

  const API = { rozbal, bboxPrvku, meritkoVykresu, popisMeritka, vykresDilu, vsechnyVykresy, svgVykres, svgPrvek, rozlozDesky, dxf, dxfDesek, svgDesek, vykresPlanu, rozvrhListu, rozmerPapiru, korekceMeritka, sablona1, strany, pdf, bezDiakritiky };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.PPV = API;
})(typeof window !== 'undefined' ? window : globalThis);

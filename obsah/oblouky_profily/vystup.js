/* ============================================================
   Šablony oblouků a profilů – výstupy (bez DOM): SVG, DXF R12, strany PDF s dělením na listy, PDF (jsPDF parametrem)
   Scéna je v mm modelu (y nahoru); strany PDF v mm papíru (y dolů) s korekcí měřítka X/Y.
   ============================================================ */
(function (koren) {
  'use strict';
  const O = koren.OBL || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const KR = koren.OBLK || (typeof require !== 'undefined' ? require('./kresba.js') : null);
  const n3 = (x) => (Math.round(x * 1000) / 1000).toString();
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cz = KR.cz;

  /** prvky dílu (bez kót a popisů, je-li nast.popisy === false) */
  function prvkyDilu(dil, nast) {
    if (nast && nast.popisy === false) return dil.prvky.filter((e) => e.v !== 'kota' && e.t !== 'txt');
    return dil.prvky;
  }
  function meze(dil, nast, okraj) {
    const m = KR.mezePrvku(prvkyDilu(dil, nast)), o = okraj == null ? 3 : okraj;
    return { x0: m.x0 - o, y0: m.y0 - o, x1: m.x1 + o, y1: m.y1 + o };
  }

  /* ---------------- SVG ---------------- */
  function svgPrvek(e) {
    const Y = (y) => -y, c = e.c;
    const dash = (d, s) => (d === 'c' ? ` stroke-dasharray="${n3(s * 10)} ${n3(s * 7)}"` : d === 'o' ? ` stroke-dasharray="${n3(s * 30)} ${n3(s * 8)} ${n3(s * 4)} ${n3(s * 8)}"` : '');
    if (e.t === 'l') {
      const d = e.b.map((q, i) => (i ? 'L' : 'M') + n3(q[0]) + ' ' + n3(Y(q[1]))).join('') + (e.z ? 'Z' : '');
      if (e.f) return `<path d="${d}" fill="${c}" stroke="none"/>`;
      return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${n3(Math.max(0.05, e.s))}" stroke-linecap="round" stroke-linejoin="round"${dash(e.d, Math.max(0.12, e.s))}/>`;
    }
    if (e.t === 'k') return e.f ? `<circle cx="${n3(e.x)}" cy="${n3(Y(e.y))}" r="${n3(e.r)}" fill="${c}"/>`
      : `<circle cx="${n3(e.x)}" cy="${n3(Y(e.y))}" r="${n3(e.r)}" fill="none" stroke="${c}" stroke-width="${n3(Math.max(0.05, e.s))}"${dash(e.d, Math.max(0.12, e.s))}/>`;
    if (e.t === 'txt') {
      const an = e.a === 'r' ? 'end' : e.a === 'c' ? 'middle' : 'start', rot = e.u ? ` transform="rotate(${n3(-e.u)} ${n3(e.x)} ${n3(Y(e.y))})"` : '';
      return `<text x="${n3(e.x)}" y="${n3(Y(e.y))}" font-size="${n3(e.h)}" text-anchor="${an}" fill="${c}"${rot}>${esc(e.txt)}</text>`;
    }
    return '';
  }
  /** o: {okraj, pozadi, sirkaPx, navic (SVG v souřadnicích modelu s převráceným y)} */
  function svg(dil, nast, o) {
    o = Object.assign({ okraj: 3, pozadi: '#ffffff' }, o || {});
    const M = meze(dil, nast, o.okraj), x = M.x0, y = -M.y1, w = M.x1 - M.x0, h = M.y1 - M.y0;
    const rozm = o.sirkaPx ? 'width="100%"' : `width="${n3(w)}mm" height="${n3(h)}mm"`;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" ${rozm} viewBox="${n3(x)} ${n3(y)} ${n3(w)} ${n3(h)}" font-family="Liberation Sans, Arial, Helvetica, sans-serif">`;
    if (o.pozadi) s += `<rect x="${n3(x)}" y="${n3(y)}" width="${n3(w)}" height="${n3(h)}" fill="${o.pozadi}"/>`;
    for (const e of prvkyDilu(dil, nast)) s += svgPrvek(e);
    if (o.navic) s += o.navic;
    return s + '</svg>';
  }

  /* ---------------- DXF R12 ---------------- */
  const DXF_VRSTVY = { obrys: 7, krivka: 7, druha: 1, pomocna: 8, osa: 5, kota: 5, mrizka: 9, sablona: 3, provazek: 1, material: 8, popis: 7 };
  function dxf(dil, nast) {
    const L = [], g = (k, v) => { L.push(String(k)); L.push(String(v)); };
    const vrstvy = Object.keys(DXF_VRSTVY);
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, vrstvy.length);
    for (const v of vrstvy) { g(0, 'LAYER'); g(2, v.toUpperCase()); g(70, 0); g(62, DXF_VRSTVY[v]); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    const ascii = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/Ø/g, '%%c').replace(/°/g, '%%d').replace(/[−–]/g, '-').replace(/[^\x20-\x7e]/g, '');
    for (const e of prvkyDilu(dil, nast)) {
      const ly = String(e.v || 'obrys').toUpperCase();
      if (e.t === 'l') {
        if (e.f) continue;                 // výplně (šipky) se do DXF nepíší
        if (e.b.length === 2 && !e.z) { g(0, 'LINE'); g(8, ly); g(10, n3(e.b[0][0])); g(20, n3(e.b[0][1])); g(30, 0); g(11, n3(e.b[1][0])); g(21, n3(e.b[1][1])); g(31, 0); continue; }
        g(0, 'POLYLINE'); g(8, ly); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, e.z ? 1 : 0);
        for (const q of e.b) { g(0, 'VERTEX'); g(8, ly); g(10, n3(q[0])); g(20, n3(q[1])); g(30, 0); }
        g(0, 'SEQEND'); g(8, ly);
      } else if (e.t === 'k') {
        if (e.f) { g(0, 'POINT'); g(8, ly); g(10, n3(e.x)); g(20, n3(e.y)); g(30, 0); }
        else { g(0, 'CIRCLE'); g(8, ly); g(10, n3(e.x)); g(20, n3(e.y)); g(30, 0); g(40, n3(e.r)); }
      } else if (e.t === 'txt') {
        const al = e.a === 'l' ? 0 : e.a === 'r' ? 2 : 1;
        g(0, 'TEXT'); g(8, ly); g(10, n3(e.x)); g(20, n3(e.y)); g(30, 0); g(40, n3(e.h * 0.72)); g(1, ascii(e.txt));
        if (e.u) g(50, n3(e.u));
        if (al) { g(72, al); g(11, n3(e.x)); g(21, n3(e.y)); g(31, 0); }
      }
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return L.join('\r\n') + '\r\n';
  }

  /* ---------------- strany PDF ---------------- */
  /**
   * strany(V, nast, o) → [{W, H, obsah, navrch, clip, typ, dil, list, rozvrh}]
   * o: {nazev, jenDil (index), text (true = strany s hodnotami), postup: [řádky]}
   */
  function strany(V, nast, o) {
    o = Object.assign({ text: true }, o || {});
    const S = Object.assign({ papir: 'a4', okraj: 8, prekryv: 15 }, nast || {});
    const [pw, ph] = O.rozmerPapiru(S), ok = O.cislo(S.okraj, 8), out = [], K = O.korekceMeritka(S.kalibX, S.kalibY);
    const pt = (W, H) => ({ W, H, obsah: [], navrch: [], clip: null });
    const Lp = (arr, b, s, c, d) => arr.push({ t: 'l', b, s, c: c || '#000000', d });
    const Tp = (arr, x, y, txt, h, a, u, c) => arr.push({ t: 'txt', x, y, txt: String(txt), h, a: a || 'l', u: u || 0, c: c || '#000000' });
    const meritka = (st, W, H, kx, ky, mapka) => {
      const y = H - ok - 3.2, x0 = ok;
      st.navrch.push({ t: 'm', x0, y, x1: x0 + 100 * kx, osa: 'x' });
      for (let i = 0; i <= 10; i++) Lp(st.navrch, [[x0 + i * 10 * kx, y], [x0 + i * 10 * kx, y - (i % 5 ? 1.5 : 3)]], 0.2);
      Tp(st.navrch, x0, y - 3.6, '0', 2, 'c'); Tp(st.navrch, x0 + 50 * kx, y - 3.6, '50', 2, 'c'); Tp(st.navrch, x0 + 100 * kx, y - 3.6, '100 mm', 2, 'c');
      Tp(st.navrch, x0 + 100 * kx + 7, y - 4.2, 'Kontrola: úsečky musí mít přesně 50 a 100 mm vodorovně i svisle.', 2.2);
      Tp(st.navrch, x0 + 100 * kx + 7, y - 1, (K.kx !== 1 || K.ky !== 1) ? `Korekce tisku X ×${K.kx.toFixed(4).replace('.', ',')}, Y ×${K.ky.toFixed(4).replace('.', ',')}.` : 'Jinak změřte a zadejte do Kalibrace.', 2.2);
      const xs = W - ok - 2.5, ys = ok;
      st.navrch.push({ t: 'm', x0: xs, y: ys, y1: ys + 100 * ky, osa: 'y' });
      for (let i = 0; i <= 10; i++) Lp(st.navrch, [[xs, ys + i * 10 * ky], [xs - (i % 5 ? 1.5 : 3), ys + i * 10 * ky]], 0.2);
      Tp(st.navrch, xs - 3.6, ys + 0.8, '0', 2, 'r'); Tp(st.navrch, xs - 3.6, ys + 50 * ky + 0.7, '50', 2, 'r'); Tp(st.navrch, xs - 3.6, ys + 100 * ky + 0.7, '100', 2, 'r');
      Tp(st.navrch, xs - 1, ys + 100 * ky + 6, 'svisle 100 mm', 2.2, 'r', 90);
      if (mapka) {
        const { nx, ny, r, c } = mapka, mx = W - ok - O.PRAVY_PAS - 3.2 * nx, my = H - ok - 14.5;
        for (let i = 0; i < ny; i++) for (let j = 0; j < nx; j++) st.navrch.push({ t: 'r', x: mx + j * 3.2, y: my + i * 3.2, w: 2.8, h: 2.8, s: 0.15, c: '#000000', f: i === r && j === c });
      }
    };
    const dily = V.dily.filter((_, i) => o.jenDil == null || i === o.jenDil);
    for (const d of dily) {
      const obl = meze(d, S, 2), rv = O.rozvrhListu(obl, pw, ph, S), Nl = rv.listy.length, pr = prvkyDilu(d, S);
      for (const l of rv.listy) {
        const st = pt(rv.W, rv.H); st.typ = 'sablona'; st.dil = d.id; st.list = l; st.rozvrh = rv;
        const X = (x) => ok + (x - l.x0) * rv.kx, Y = (y) => ok + (l.y1 - y) * rv.ky;
        st.clip = { x: ok, y: ok, w: rv.uw, h: rv.uh };
        for (const e of pr) {
          if (e.t === 'l') st.obsah.push({ t: 'l', b: e.b.map((q) => [X(q[0]), Y(q[1])]), s: e.s, c: e.c, d: e.d, z: e.z, f: e.f, v: e.v });
          else if (e.t === 'k') st.obsah.push({ t: 'e', x: X(e.x), y: Y(e.y), rx: e.r * rv.kx, ry: e.r * rv.ky, s: e.s, c: e.c, f: e.f, d: e.d, v: e.v });
          else if (e.t === 'txt') st.obsah.push({ t: 'txt', x: X(e.x), y: Y(e.y), txt: e.txt, h: e.h, a: e.a, u: e.u, c: e.c, v: e.v });
        }
        if (!rv.jeden) {
          const gx = rv.g * rv.kx, gy = rv.g * rv.ky;
          if (l.c < rv.nx - 1) Lp(st.navrch, [[ok + rv.uw - gx, ok], [ok + rv.uw - gx, ok + rv.uh]], 0.2, '#888888', 'c');
          if (l.r < rv.ny - 1) Lp(st.navrch, [[ok, ok + rv.uh - gy], [ok + rv.uw, ok + rv.uh - gy]], 0.2, '#888888', 'c');
          for (const [x, y] of [[ok, ok], [ok + rv.uw, ok], [ok, ok + rv.uh], [ok + rv.uw, ok + rv.uh]]) { Lp(st.navrch, [[x - 3, y], [x + 3, y]], 0.2); Lp(st.navrch, [[x, y - 3], [x, y + 3]], 0.2); }
          if (l.c > 0 || l.r > 0) Tp(st.navrch, ok + 4, ok - 2.2, 'ořízněte ' + (l.c > 0 ? 'levý' : '') + (l.c > 0 && l.r > 0 ? ' a ' : '') + (l.r > 0 ? 'horní' : '') + ' okraj a přiložte na čárkovanou čáru sousedního listu', 2.4, 'l', 0, '#555555');
        }
        Tp(st.navrch, ok, rv.H - ok - O.PATA + 4.5, `${o.nazev ? o.nazev + ' · ' : ''}${d.id} – ${d.nazev}${Nl > 1 ? ` · list ${l.r * rv.nx + l.c + 1}/${Nl} (řádek ${l.r + 1}, sloupec ${l.c + 1})` : ''} · tiskněte ve skutečné velikosti (100 %)`, 2.6);
        meritka(st, rv.W, rv.H, rv.kx, rv.ky, Nl > 1 ? { nx: rv.nx, ny: rv.ny, r: l.r, c: l.c } : null);
        out.push(st);
      }
    }
    if (o.text) {
      const W = pw, H = ph, sir = W - 2 * ok;
      let st = null, y = 0;
      const nova = () => { st = pt(W, H); st.typ = 'text'; out.push(st); y = ok + 6; };
      const radek = (txt, h, c) => { if (!st || y > H - ok - 8) nova(); Tp(st.navrch, ok, y, txt, h || 3, 'l', 0, c); y += (h || 3) * 1.5; };
      const odstavec = (txt, h) => { const max = Math.floor(sir / ((h || 3) * 0.5)); let r = ''; for (const s of String(txt).split(' ')) { if ((r + ' ' + s).length > max) { radek(r, h); r = s; } else r = r ? r + ' ' + s : s; } if (r) radek(r, h); };
      const tabulka = (hl, rows) => {
        const n = hl.length, sl = [], wcol = sir / n;
        for (let i = 0; i < n; i++) sl.push(i * wcol);
        const hlav = () => { for (let i = 0; i < n; i++) Tp(st.navrch, ok + sl[i], y, String(hl[i]).slice(0, Math.floor(wcol / 1.3)), 2.4, 'l', 0, '#555555'); y += 1.2; Lp(st.navrch, [[ok, y], [ok + sir, y]], 0.15, '#999999'); y += 3.4; };
        if (y > H - ok - 20) nova();
        hlav();
        for (const rw of rows) {
          if (y > H - ok - 8) { nova(); hlav(); }
          for (let i = 0; i < rw.length && i < n; i++) Tp(st.navrch, ok + sl[i], y, String(rw[i]).slice(0, Math.floor(wcol / (i === n - 1 ? 1.1 : 1.35))), 2.6);
          y += 3.9;
        }
        y += 3;
      };
      nova();
      radek(`${o.nazev || 'Šablona'} – hodnoty`, 5); y += 1;
      if (V.info) odstavec(V.info, 3);
      for (const v of V.varovani || []) odstavec('Pozor: ' + v, 2.8);
      y += 2;
      tabulka(['veličina', 'hodnota'], V.hodnoty);
      for (const t of V.tabulky || []) { if (y > H - ok - 30) nova(); radek(t.nazev, 3.6); tabulka(t.hlavicka, t.radky); }
      if ((V.kusovnik || []).length) { if (y > H - ok - 30) nova(); radek('Kusovník', 3.6); tabulka(['položka', 'ks', 'rozměr (mm)', 'materiál', 'poznámka'], V.kusovnik.map((q) => q.map(String))); }
      if (o.postup && o.postup.length) { if (y > H - ok - 40) nova(); radek('Postup', 3.6); for (const t of o.postup) odstavec(t, 2.8); y += 3; }
      if (y > H - ok - 62) nova();
      radek('Kontrolní čtverec 50 × 50 mm', 3);
      st.navrch.push({ t: 'r', x: ok, y, w: 50 * K.kx, h: 50 * K.ky, s: 0.25, c: '#000000' });
      Tp(st.navrch, ok + 25 * K.kx, y + 25 * K.ky + 1, '50 × 50 mm', 3.4, 'c');
    }
    return out;
  }

  /* ---------------- PDF ---------------- */
  const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/[„“]/g, '"').replace(/°/g, ' st.').replace(/Ø/g, 'O').replace(/×/g, 'x').replace(/[^\x20-\x7e]/g, '?');
  // znaky, které Liberation Sans nemá, nahradit
  const proPismo = (s) => String(s).replace(/⌀/g, 'Ø').replace(/[□]/g, '[]').replace(/[∫]/g, 'int').replace(/[κ]/g, 'k').replace(/[⁻]/g, '-').replace(/[″]/g, '"');
  function rgb(hex) { const v = parseInt(String(hex || '#000000').slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  /** o: {pismo (TTF base64), nazev, compress} */
  function pdf(jsPDF, str, o) {
    o = Object.assign({ compress: true }, o || {});
    let doc = null, uni = false;
    const T = (s) => (uni ? proPismo(s) : bezDiakritiky(proPismo(s)));
    for (const st of str) {
      const orient = st.W > st.H ? 'l' : 'p';
      if (!doc) {
        doc = new jsPDF({ unit: 'mm', format: [st.W, st.H], orientation: orient, compress: o.compress });
        if (o.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
        doc.setProperties({ title: o.nazev || 'Šablona', creator: 'Šablony oblouků a profilů – tisk 1:1' });
      } else doc.addPage([st.W, st.H], orient);
      const kresli = (e) => {
        const c = rgb(e.c); doc.setDrawColor(...c); doc.setFillColor(...c);
        if (e.t === 'l') {
          doc.setLineWidth(Math.max(0.05, e.s || 0.2));
          const s = Math.max(0.12, e.s || 0.2);
          if (e.d === 'c') doc.setLineDashPattern([s * 10, s * 7], 0); else if (e.d === 'o') doc.setLineDashPattern([s * 30, s * 8, s * 4, s * 8], 0);
          if (e.b.length === 2 && !e.z) doc.line(e.b[0][0], e.b[0][1], e.b[1][0], e.b[1][1]);
          else { const seg = []; for (let i = 1; i < e.b.length; i++) seg.push([e.b[i][0] - e.b[i - 1][0], e.b[i][1] - e.b[i - 1][1]]); doc.lines(seg, e.b[0][0], e.b[0][1], [1, 1], e.f ? 'F' : 'S', !!e.z); }
          if (e.d) doc.setLineDashPattern([], 0);
        } else if (e.t === 'e') {
          doc.setLineWidth(Math.max(0.05, e.s || 0.2));
          if (e.d === 'c') doc.setLineDashPattern([2, 1.5], 0); else if (e.d === 'o') doc.setLineDashPattern([5, 1.2, 0.6, 1.2], 0);
          doc.ellipse(e.x, e.y, e.rx, e.ry, e.f ? 'F' : 'S');
          if (e.d) doc.setLineDashPattern([], 0);
        } else if (e.t === 'r') { doc.setLineWidth(Math.max(0.05, e.s || 0.2)); doc.rect(e.x, e.y, e.w, e.h, e.f ? 'FD' : 'S'); }
        else if (e.t === 'm') {
          doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
          if (e.osa === 'x') doc.line(e.x0, e.y, e.x1, e.y); else doc.line(e.x0, e.y, e.x0, e.y1);
        } else if (e.t === 'txt') {
          if (uni) doc.setFont('LS', 'normal'); else doc.setFont('helvetica', 'normal');
          doc.setFontSize(e.h / 0.3528); doc.setTextColor(...c);
          const t = T(e.txt), w = doc.getTextWidth(t), u = (e.u || 0) * Math.PI / 180;
          const kk = e.a === 'r' ? w : e.a === 'c' ? w / 2 : 0;
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

  /* ---------------- CSV hodnot ---------------- */
  function csv(V) {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"', out = ['veličina;hodnota'];
    for (const [a, b] of V.hodnoty) out.push(q(a) + ';' + q(b));
    for (const t of V.tabulky) { out.push(''); out.push(q(t.nazev)); out.push(t.hlavicka.map(q).join(';')); for (const r of t.radky) out.push(r.map(q).join(';')); }
    return out.join('\r\n') + '\r\n';
  }

  const API = { svg, svgPrvek, dxf, strany, pdf, csv, meze, prvkyDilu, bezDiakritiky };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.OBLV = API;
})(typeof window !== 'undefined' ? window : globalThis);

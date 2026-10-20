/* ============================================================
   Vrtací šablony – výstupy (bez DOM): scéna šablony, SVG, DXF, CSV, strany PDF, PDF (jsPDF parametrem)
   Scéna je v mm dílu (y nahoru). Strany PDF jsou v mm papíru (y dolů) už s korekcí měřítka X/Y.
   prvek: {t:'l', b:[[x,y]..], s, c, d:'c'|'o', z} | {t:'k', x, y, r, s, c, f} | {t:'txt', x, y, h, txt, a:'l'|'c'|'r', u (° proti směru hod.), c}
   ============================================================ */
(function (koren) {
  'use strict';
  const VS = koren.VS || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const r2 = (x) => Math.round(x * 100) / 100;
  const n3 = (x) => (Math.round(x * 1000) / 1000).toString();
  const cz = (x) => String(r2(x)).replace('.', ',').replace('-', '−');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const SEDA = '#777777', MODRA = '#1f5fa8', CERV = '#b3261e';
  const popisDiry = (q) => `Ø${cz(q.d)}${q.hl ? ' hl.' + cz(q.hl) : ' skrz'}`;

  /* ---------------- scéna šablony ---------------- */
  /** o: {meritkoTextu (přehled), bezPapiru} */
  function scena(dil, nast, o) {
    o = o || {};
    const N = Object.assign({}, VS.NASTAVENI, nast || {}), obl = dil.oblast || VS.oblastSablony(dil, N), P = obl.papir;
    const k = o.meritkoTextu || 1, pr = [];
    const L = (b, s, c, d, z, v) => pr.push({ t: 'l', b, s: s * k, c: c || '#000000', d, z, v });
    const T = (x, y, txt, h, a, u, c, v) => pr.push({ t: 'txt', x, y, txt: String(txt), h: h * k, a: a || 'l', u: u || 0, c: c || '#000000', v });
    const K = (x, y, r, s, c, f, v, d) => pr.push({ t: 'k', x, y, r, s: s * k, c: c || '#000000', f, v, d });
    const inX = (x) => x > obl.x0 + 0.01 && x < obl.x1 - 0.01, inY = (y) => y > obl.y0 + 0.01 && y < obl.y1 - 0.01;

    // obrys papíru (střih) / kruhový díl
    if (obl.kruh) {
      K(dil.w / 2, dil.h / 2, dil.w / 2, 0.35, '#000000', false, 'obrys');
      L([[P.x0, P.y0], [P.x1, P.y0], [P.x1, P.y1], [P.x0, P.y1]], 0.15, SEDA, 'c', true, 'obrys');
    } else L([[P.x0, P.y0], [P.x1, P.y0], [P.x1, P.y1], [P.x0, P.y1]], 0.25, '#000000', null, true, 'obrys');

    // obrys desky, kde leží uvnitř šablony (ne na referenční hraně)
    if (!obl.kruh && !dil.sablonaCela) {
      const sx = (y) => [[Math.max(obl.x0, 0), y], [Math.min(obl.x1, dil.w), y]], sy = (x) => [[x, Math.max(obl.y0, 0)], [x, Math.min(obl.y1, dil.h)]];
      if (inY(0)) L(sx(0), 0.3, SEDA, null, false, 'deska');
      if (inY(dil.h)) L(sx(dil.h), 0.3, SEDA, null, false, 'deska');
      if (inX(0)) L(sy(0), 0.3, SEDA, null, false, 'deska');
      if (inX(dil.w)) L(sy(dil.w), 0.3, SEDA, null, false, 'deska');
    }

    // referenční hrany: tlustá čára, chlopeň se šrafou a popisem
    const nazevHrany = (h) => {
      if (dil.celo) return h === 'D' || h === 'H' ? (h === 'D' ? (dil.ref.ny || 'líc') : 'rub') : (dil.ref.nx || VS.NAZEV_HRANY[h]);
      return (h === 'L' || h === 'P') ? (dil.ref.nx || VS.NAZEV_HRANY[h]) : (dil.ref.ny || VS.NAZEV_HRANY[h]);
    };
    for (const h of obl.hrany) {
      const c = +N.chlopen;
      let a, b, sraf = [], tx, ty, u;
      if (h === 'L') { a = [obl.x0, obl.y0]; b = [obl.x0, obl.y1]; tx = obl.x0 - c / 2 + 0.9; ty = (obl.y0 + obl.y1) / 2; u = 90; }
      if (h === 'P') { a = [obl.x1, obl.y0]; b = [obl.x1, obl.y1]; tx = obl.x1 + c / 2 - 0.9; ty = (obl.y0 + obl.y1) / 2; u = -90; }
      if (h === 'D') { a = [obl.x0, obl.y0]; b = [obl.x1, obl.y0]; tx = (obl.x0 + obl.x1) / 2; ty = obl.y0 - c / 2 - 0.9; u = 0; }
      if (h === 'H') { a = [obl.x0, obl.y1]; b = [obl.x1, obl.y1]; tx = (obl.x0 + obl.x1) / 2; ty = obl.y1 + c / 2 - 0.9; u = 0; }
      L([a, b], 0.7, '#000000', null, false, 'hrana');
      if (c > 0) {
        // šrafa chlopně po 6 mm
        const svisla = h === 'L' || h === 'P', s0 = svisla ? obl.y0 : obl.x0, s1 = svisla ? obl.y1 : obl.x1, smer = h === 'L' || h === 'D' ? -1 : 1;
        for (let s = s0 + 3; s < s1 - 1; s += 6) sraf.push(svisla ? [[a[0], s], [a[0] + smer * c, s + 3]] : [[s, a[1]], [s + 3, a[1] + smer * c]]);
        for (const q of sraf) L(q, 0.12, '#aaaaaa', null, false, 'chlopen');
        const delka = (svisla ? obl.y1 - obl.y0 : obl.x1 - obl.x0);
        const txt = delka > 120 ? `PŘILOŽIT K HRANĚ: ${nazevHrany(h).toUpperCase()} – chlopeň ohnout přes hranu` : delka > 50 ? `PŘILOŽIT: ${nazevHrany(h).toUpperCase()}` : nazevHrany(h).toUpperCase();
        // popis opakovat po ~180 mm, aby byl na každém listu
        const kusu = Math.max(1, Math.round(delka / 180));
        for (let i = 0; i < kusu; i++) {
          const f = (i + 0.5) / kusu, px = svisla ? tx : s0 + (s1 - s0) * f, py = svisla ? s0 + (s1 - s0) * f : ty;
          T(px, py, txt, Math.min(2.6, c * 0.32), 'c', u, '#000000', 'hrana');
        }
      }
    }
    if (obl.hrany.length >= 2 && !dil.celo) {
      const xR = obl.hrany.includes('L') ? obl.x0 : obl.hrany.includes('P') ? obl.x1 : null, yR = obl.hrany.includes('D') ? obl.y0 : obl.hrany.includes('H') ? obl.y1 : null;
      if (xR != null && yR != null) K(xR, yR, 2, 0.4, '#000000', false, 'hrana');
    }

    // osy, vodováha, obrysy, značky
    for (const q of dil.osy || []) {
      if (q.osa === 'x' && (inX(q.hodnota) || dil.sablonaCela || obl.kruh)) { L([[q.hodnota, Math.max(obl.y0, P.y0)], [q.hodnota, Math.min(obl.y1, P.y1)]], 0.18, MODRA, 'o', false, 'osa'); if (q.popis) T(q.hodnota + 1.2 * k, obl.y1 - 4 * k, q.popis, 2.2, 'l', 0, MODRA, 'osa'); }
      if (q.osa === 'y' && (inY(q.hodnota) || dil.sablonaCela || obl.kruh)) { L([[Math.max(obl.x0, P.x0), q.hodnota], [Math.min(obl.x1, P.x1), q.hodnota]], 0.18, MODRA, 'o', false, 'osa'); if (q.popis) T(obl.x1 - 2 * k, q.hodnota + 1.2 * k, q.popis, 2.2, 'r', 0, MODRA, 'osa'); }
    }
    if (dil.vodovaha != null && dil.vodovaha >= obl.y0 && dil.vodovaha <= obl.y1) {
      L([[obl.x0, dil.vodovaha], [obl.x1, dil.vodovaha]], 0.3, CERV, 'c', false, 'vodovaha');
      T(obl.x0 + 3 * k, dil.vodovaha + 1.6 * k, 'VODOROVNĚ – vyrovnat vodováhou', 2.6, 'l', 0, CERV, 'vodovaha');
    }
    for (const q of dil.obrysy || []) {
      L([[q.x0, q.y0], [q.x1, q.y0], [q.x1, q.y1], [q.x0, q.y1]], 0.25, q.carkovane ? SEDA : '#444444', q.carkovane ? 'c' : null, true, 'obrysy');
      if (q.popis) T(q.x0 + 1.5 * k, q.y1 - 3.5 * k, q.popis, 2.2, 'l', 0, SEDA, 'obrysy');
    }
    for (const q of dil.znacky || []) {
      if (q.typ === 'stred') { L([[q.x - 10, q.y], [q.x + 10, q.y]], 0.3, MODRA, null, false, 'znacka'); L([[q.x, q.y - 10], [q.x, q.y + 10]], 0.3, MODRA, null, false, 'znacka'); K(q.x, q.y, 3, 0.25, MODRA, false, 'znacka'); T(q.x + 4, q.y - 4.5, q.popis, 2.4, 'l', 0, MODRA, 'znacka'); }
      else { K(q.x, q.y, 2.5, 0.2, SEDA, false, 'znacka', 'c'); }
    }
    if (dil.pcd) {
      K(dil.pcd.cx, dil.pcd.cy, dil.pcd.D / 2, 0.18, MODRA, false, 'osa', 'o');
      const a = (dil.pcd.uhel || 0) * Math.PI / 180, R = dil.w / 2;
      L([[dil.pcd.cx, dil.pcd.cy], [dil.pcd.cx + R * 0.97 * Math.sin(a), dil.pcd.cy + R * 0.97 * Math.cos(a)]], 0.2, MODRA, 'c', false, 'osa');
      T(dil.pcd.cx + 2, dil.pcd.cy + 2, 'STŘED', 2.2, 'l', 0, MODRA, 'osa');
      T(dil.pcd.cx, dil.pcd.cy - dil.pcd.D / 2 - 4.5, `roztečná kružnice Ø${cz(dil.pcd.D)}`, 2.4, 'c', 0, MODRA, 'osa');
    }

    // díry
    const pop = N.popisy || 'vse';
    dil.diry.forEach((q, i) => {
      const r = q.d / 2, kr = (r + (q.d >= 20 ? 3 : Math.min(6, Math.max(3, r * 0.4)))) * (o.meritkoTextu ? Math.max(1, k * 0.6) : 1);
      K(q.x, q.y, r, 0.3, '#000000', false, 'dira');
      L([[q.x - kr, q.y], [q.x + kr, q.y]], 0.18, '#000000', null, false, 'kriz');
      L([[q.x, q.y - kr], [q.x, q.y + kr]], 0.18, '#000000', null, false, 'kriz');
      K(q.x, q.y, 0.45 * k, 0, '#000000', true, 'kriz');
      if (q.d >= 20 && !o.meritkoTextu) K(q.x, q.y, 1.6, 0.15, '#000000', false, 'kriz');
      if (pop === 'zadne') return;
      const a = Math.max(r * 0.72, 1.2 * k) + 0.6 * k;
      let t = String(i + 1);
      if (pop === 'vse') t += '  ' + popisDiry(q);
      if (dil.prehled) { const z = VS.odRef(dil, q); t = `${i + 1}: ${cz(z.dx)} / ${cz(z.dy)}`; }
      T(q.x + a, q.y + a, t, 2.3, 'l', 0, '#000000', 'popis');
    });

    // kóty od referenčních hran (pořadnice)
    if (N.koty !== false && !dil.prehled && dil.diry.length) {
      const hx = obl.hrany.find((h) => h === 'L' || h === 'P'), hy = obl.hrany.find((h) => h === 'D' || h === 'H');
      const uniq = (pole) => [...new Set(pole.map((x) => r2(x)))].sort((a, b) => a - b);
      if (hx && !dil.celo) {
        const xe = hx === 'L' ? obl.x0 : obl.x1, sm = hx === 'L' ? 1 : -1;
        const ys = uniq(dil.diry.map((q) => q.y));
        if (ys.length <= 60) for (const y of ys) {
          L([[xe, y], [xe + sm * 3, y]], 0.2, MODRA, null, false, 'kota');
          const dy = hy === 'H' ? dil.h - y : y;
          T(xe + sm * 3.8, y + 0.7, cz(dy), 2.1, hx === 'L' ? 'l' : 'r', 0, MODRA, 'kota');
        }
      }
      if (hy) {
        const ye = hy === 'D' ? obl.y0 : obl.y1, sm = hy === 'D' ? 1 : -1;
        const xs = uniq(dil.diry.map((q) => q.x));
        if (xs.length <= 60) for (const x of xs) {
          L([[x, ye], [x, ye + sm * 3]], 0.2, MODRA, null, false, 'kota');
          const dx = hx === 'P' ? dil.w - x : x;
          T(x - 0.7, ye + sm * 3.8, cz(dx), 2.1, hy === 'D' ? 'l' : 'r', 90, MODRA, 'kota');
        }
      }
    }

    // nadpis a údaje uvnitř šablony
    const vys = obl.y1 - obl.y0, sir = obl.x1 - obl.x0;
    if (!o.bezNadpisu && vys > 45 && sir > 50 && !obl.kruh) {
      const x = obl.x0 + (obl.hrany.includes('L') ? 14 : 4), y = obl.y1 - (obl.hrany.includes('H') ? 12 : 5);
      T(x, y, `${dil.id} – ${dil.nazev}`, 3, 'l', 0, '#000000', 'nadpis');
      T(x, y - 4, dil.pohled || '', 2.2, 'l', 0, SEDA, 'nadpis');
      if (dil.zed && dil.podlaha != null && !dil.prehled) {
        T(x, y - 8, `spodní hrana šablony ${cz(dil.podlaha + obl.y0)} mm nad podlahou${dil.odRohu != null && dil.ref.x !== 'L' ? `, levá hrana ${cz(dil.odRohu + obl.x0)} mm od rohu` : ''}`, 2.2, 'l', 0, '#000000', 'nadpis');
      }
    } else if (obl.kruh && !o.bezNadpisu) T(dil.w / 2, -3, `${dil.id} – ${dil.nazev}`, 2.6, 'c', 0, '#000000', 'nadpis');

    return { prvky: pr, x0: P.x0, y0: P.y0, x1: P.x1, y1: P.y1, oblast: obl };
  }

  /* ---------------- SVG (mm, y převrácené) ---------------- */
  function svgPrvek(e, o) {
    const Y = (y) => -y, c = o && o.barvy === false ? '#000' : e.c;
    const dash = (d, s) => (d === 'c' ? ` stroke-dasharray="${n3(s * 10)} ${n3(s * 7)}"` : d === 'o' ? ` stroke-dasharray="${n3(s * 30)} ${n3(s * 8)} ${n3(s * 4)} ${n3(s * 8)}"` : '');
    if (e.t === 'l') {
      const d = e.b.map((q, i) => (i ? 'L' : 'M') + n3(q[0]) + ' ' + n3(Y(q[1]))).join('') + (e.z ? 'Z' : '');
      return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${n3(Math.max(0.05, e.s))}" stroke-linecap="round"${dash(e.d, Math.max(0.12, e.s))}/>`;
    }
    if (e.t === 'k') return e.f ? `<circle cx="${n3(e.x)}" cy="${n3(Y(e.y))}" r="${n3(e.r)}" fill="${c}"/>`
      : `<circle cx="${n3(e.x)}" cy="${n3(Y(e.y))}" r="${n3(e.r)}" fill="none" stroke="${c}" stroke-width="${n3(Math.max(0.05, e.s))}"${dash(e.d, Math.max(0.12, e.s))}/>`;
    if (e.t === 'txt') {
      const an = e.a === 'r' ? 'end' : e.a === 'c' ? 'middle' : 'start', rot = e.u ? ` transform="rotate(${n3(-e.u)} ${n3(e.x)} ${n3(Y(e.y))})"` : '';
      return `<text x="${n3(e.x)}" y="${n3(Y(e.y))}" font-size="${n3(e.h)}" text-anchor="${an}" fill="${c}"${rot}>${esc(e.txt)}</text>`;
    }
    return '';
  }
  /** o: {okraj, pozadi, sirkaPx (true = width 100 %), navic (SVG vložené do souřadnic modelu, y převrácené), id} */
  function svg(sc, o) {
    o = Object.assign({ okraj: 3, pozadi: '#ffffff' }, o || {});
    const m = o.okraj, x = sc.x0 - m, y = -sc.y1 - m, w = sc.x1 - sc.x0 + 2 * m, h = sc.y1 - sc.y0 + 2 * m;
    const rozm = o.sirkaPx ? 'width="100%"' : `width="${n3(w)}mm" height="${n3(h)}mm"`;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" ${rozm} viewBox="${n3(x)} ${n3(y)} ${n3(w)} ${n3(h)}" font-family="Liberation Sans, Arial, Helvetica, sans-serif"${o.id ? ` id="${o.id}"` : ''}>`;
    if (o.pozadi) s += `<rect x="${n3(x)}" y="${n3(y)}" width="${n3(w)}" height="${n3(h)}" fill="${o.pozadi}"/>`;
    if (o.pod) s += o.pod;
    for (const e of sc.prvky) s += svgPrvek(e, o);
    if (o.navic) s += o.navic;
    return s + '</svg>';
  }

  /* ---------------- DXF R12 (mm, y nahoru) ---------------- */
  const DXF_VRSTVY = { obrys: 7, deska: 8, hrana: 1, chlopen: 9, osa: 5, vodovaha: 1, obrysy: 8, znacka: 5, dira: 3, kriz: 7, popis: 7, kota: 5, nadpis: 7 };
  function dxf(sc) {
    const L = [], g = (k, v) => { L.push(String(k)); L.push(String(v)); };
    const vrstvy = Object.keys(DXF_VRSTVY);
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, vrstvy.length);
    for (const v of vrstvy) { g(0, 'LAYER'); g(2, v.toUpperCase()); g(70, 0); g(62, DXF_VRSTVY[v]); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    const ascii = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/Ø/g, '%%c').replace(/[−–]/g, '-').replace(/[^\x20-\x7e]/g, '');
    for (const e of sc.prvky) {
      const ly = String(e.v || 'obrys').toUpperCase();
      if (e.t === 'l') {
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

  /* ---------------- CSV souřadnic ---------------- */
  function csv(dily) {
    const out = ['dil;cislo;x_od_ref;y_od_ref;x_model;y_model;prumer;hloubka;od_podlahy;od_rohu;popis'];
    for (const d of dily) d.diry.forEach((q, i) => {
      const z = VS.odRef(d, q), f = (x) => (x == null ? '' : String(r2(x)).replace('.', ','));
      out.push([d.id, i + 1, f(z.dx), f(z.dy), f(q.x), f(q.y), f(q.d), q.hl ? f(q.hl) : 'skrz', f(z.podlaha), f(z.roh), '"' + String(q.popis || '').replace(/"/g, '""') + '"'].join(';'));
    });
    return out.join('\r\n') + '\r\n';
  }

  /* ---------------- strany PDF (mm papíru, y dolů) ---------------- */
  function hlavickyTabulky(d) {
    if (d.zed && !d.prehled && d.podlaha != null) return ['#', 'od rohu', 'od podlahy', 'x v šabloně', 'y v šabloně', 'Ø', 'hloubka', 'popis'];
    if (d.ref && d.ref.stred) return ['#', 'x od středu', 'y od středu', 'úhel', 'Ø', 'hloubka', 'popis'];
    return ['#', 'od: ' + (d.ref.nx || VS.NAZEV_HRANY[d.ref.x] || 'levá hrana'), 'od: ' + (d.ref.ny || VS.NAZEV_HRANY[d.ref.y] || 'spodní hrana'), 'Ø', 'hloubka', 'kroužek', 'popis'];
  }
  function radkyTabulky(d, nast, papirove) {
    return d.diry.map((q, i) => {
      const z = VS.odRef(d, q), hl = q.hl ? cz(q.hl) : 'skrz';
      if (d.zed && !d.prehled && d.podlaha != null) return [String(i + 1), cz(z.roh), cz(z.podlaha), cz(q.x), cz(q.y), cz(q.d), hl, q.popis || ''];
      if (d.ref && d.ref.stred) { let u = Math.atan2(z.dx, z.dy) * 180 / Math.PI; if (u < 0) u += 360; return [String(i + 1), cz(z.dx), cz(z.dy), cz(u) + '°', cz(q.d), hl, q.popis || '']; }
      const kr = VS.nastaveniKrouzku(q, nast, papirove);
      return [String(i + 1), cz(z.dx), cz(z.dy), cz(q.d), hl, kr == null ? '–' : cz(kr), q.popis || ''];
    });
  }

  /**
   * strany(navrhVysledek, nast, o) → [{W, H, obsah:[prvky papíru], clip:{x,y,w,h}|null, navrch:[...], typ}]
   * o: {nazev, jenDil (id), tabulka (true), datum}
   */
  function strany(N, nast, o) {
    o = Object.assign({ tabulka: true }, o || {});
    const S = Object.assign({}, VS.NASTAVENI, nast || {});
    const [pw, ph] = VS.rozmerPapiru(S), ok = +S.okraj, out = [];
    const K = VS.korekceMeritka(S.kalibX, S.kalibY);
    const dily = N.dily.filter((d) => !o.jenDil || d.id === o.jenDil);
    const pt = (W, H) => ({ W, H, obsah: [], navrch: [], clip: null });
    const Lp = (arr, b, s, c, d) => arr.push({ t: 'l', b, s, c: c || '#000000', d });
    const Tp = (arr, x, y, txt, h, a, u, c) => arr.push({ t: 'txt', x, y, txt: String(txt), h, a: a || 'l', u: u || 0, c: c || '#000000' });
    const prevedPrvky = (sc, X, Y, kx, ky, arr) => {
      for (const e of sc.prvky) {
        if (e.t === 'l') arr.push({ t: 'l', b: e.b.map((q) => [X(q[0]), Y(q[1])]), s: e.s * Math.min(1, ky), c: e.c, d: e.d, z: e.z, v: e.v });
        else if (e.t === 'k') arr.push({ t: 'e', x: X(e.x), y: Y(e.y), rx: e.r * kx, ry: e.r * ky, s: e.s * Math.min(1, ky), c: e.c, f: e.f, d: e.d, v: e.v });
        else if (e.t === 'txt') arr.push({ t: 'txt', x: X(e.x), y: Y(e.y), txt: e.txt, h: e.h * Math.min(1, ky), a: e.a, u: e.u, c: e.c, v: e.v });
      }
    };
    const meritka = (st, W, H, kx, ky, mapka) => {
      // vodorovné kontrolní měřítko 100 mm (dílky po 10, výrazně 50) v patě listu
      const y = H - ok - 3.2, x0 = ok;
      st.navrch.push({ t: 'm', x0, y, x1: x0 + 100 * kx, osa: 'x' });
      for (let i = 0; i <= 10; i++) Lp(st.navrch, [[x0 + i * 10 * kx, y], [x0 + i * 10 * kx, y - (i % 5 ? 1.5 : 3)]], 0.2);
      Tp(st.navrch, x0, y - 3.6, '0', 2, 'c'); Tp(st.navrch, x0 + 50 * kx, y - 3.6, '50', 2, 'c'); Tp(st.navrch, x0 + 100 * kx, y - 3.6, '100 mm', 2, 'c');
      Tp(st.navrch, x0 + 100 * kx + 7, y - 4.2, 'Kontrola: úsečky musí mít přesně 50 a 100 mm vodorovně i svisle.', 2.2);
      Tp(st.navrch, x0 + 100 * kx + 7, y - 1, (K.kx !== 1 || K.ky !== 1) ? `Korekce tisku X ×${String(K.kx.toFixed(4)).replace('.', ',')}, Y ×${String(K.ky.toFixed(4)).replace('.', ',')}.` : 'Jinak změřte a zadejte do Kalibrace.', 2.2);
      // svislé měřítko 100 mm v pravém pásu
      const xs = W - ok - 2.5, ys = ok;
      st.navrch.push({ t: 'm', x0: xs, y: ys, y1: ys + 100 * ky, osa: 'y' });
      for (let i = 0; i <= 10; i++) Lp(st.navrch, [[xs, ys + i * 10 * ky], [xs - (i % 5 ? 1.5 : 3), ys + i * 10 * ky]], 0.2);
      Tp(st.navrch, xs - 3.6, ys + 0.8, '0', 2, 'r'); Tp(st.navrch, xs - 3.6, ys + 50 * ky + 0.7, '50', 2, 'r'); Tp(st.navrch, xs - 3.6, ys + 100 * ky + 0.7, '100', 2, 'r');
      Tp(st.navrch, xs - 1, ys + 100 * ky + 6, 'svisle 100 mm', 2.2, 'r', 90);
      if (mapka) {
        const { nx, ny, r, c } = mapka, mx = W - ok - VS.PRAVY_PAS - 3.2 * nx, my = H - ok - 14.5;
        for (let i = 0; i < ny; i++) for (let j = 0; j < nx; j++) st.navrch.push({ t: 'r', x: mx + j * 3.2, y: my + i * 3.2, w: 2.8, h: 2.8, s: 0.15, c: '#000000', f: i === r && j === c });
      }
    };
    for (const d of dily) {
      const obl = d.oblast;
      if (d.prehled) {
        // přehled v měřítku 1 : M (není to šablona)
        const W = pw > ph ? pw : ph, H = pw > ph ? ph : pw, uw = W - 2 * ok, uh = H - 2 * ok - VS.PATA - 8;
        const kand = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 200], M = kand.find((m) => d.w / m <= uw && d.h / m <= uh) || 500;
        const sc = scena(d, S, { meritkoTextu: M / 1.6, bezNadpisu: true });
        const st = pt(W, H); st.typ = 'prehled'; st.meritko = M;
        const X = (x) => ok + (x - 0) / M + (uw - d.w / M) / 2, Y = (y) => ok + 8 + (d.h - y) / M;
        prevedPrvky(sc, X, Y, 1 / M, 1 / M, st.obsah);
        st.obsah.push({ t: 'r', x: X(0), y: Y(d.h), w: d.w / M, h: d.h / M, s: 0.35, c: '#000000' });
        Tp(st.navrch, ok, ok + 4, `${o.nazev || 'Vrtací šablona'} · ${d.id} – ${d.nazev} · PŘEHLED V MĚŘÍTKU 1:${M} – nepoužívat jako šablonu`, 3.2);
        Tp(st.navrch, ok, H - ok - 8, `Souřadnice děr: první číslo = od ${d.ref.nx || 'levé hrany'}, druhé = od ${d.ref.ny || 'spodní hrany'} (mm). Šablony 1:1 jednotlivých rámů následují.`, 2.4);
        out.push(st);
        continue;
      }
      const maxD = Math.max(0, ...d.diry.map((q) => q.d));
      const rv = VS.rozvrhListu(obl.papir, pw, ph, S, maxD), Nl = rv.listy.length;
      const sc = scena(d, S);
      for (const l of rv.listy) {
        const st = pt(rv.W, rv.H); st.typ = 'sablona'; st.dil = d.id; st.list = l; st.rozvrh = rv;
        const X = (x) => ok + (x - l.x0) * rv.kx, Y = (y) => ok + (l.y1 - y) * rv.ky;
        st.X = X; st.Y = Y;
        st.clip = { x: ok, y: ok, w: rv.uw, h: rv.uh };
        prevedPrvky(sc, X, Y, rv.kx, rv.ky, st.obsah);
        if (!rv.jeden) {
          const gx = rv.g * rv.kx, gy = rv.g * rv.ky;
          if (l.c < rv.nx - 1) Lp(st.navrch, [[ok + rv.uw - gx, ok], [ok + rv.uw - gx, ok + rv.uh]], 0.2, '#888888', 'c');
          if (l.r < rv.ny - 1) Lp(st.navrch, [[ok, ok + rv.uh - gy], [ok + rv.uw, ok + rv.uh - gy]], 0.2, '#888888', 'c');
          for (const [x, y] of [[ok, ok], [ok + rv.uw, ok], [ok, ok + rv.uh], [ok + rv.uw, ok + rv.uh]]) { Lp(st.navrch, [[x - 3, y], [x + 3, y]], 0.2); Lp(st.navrch, [[x, y - 3], [x, y + 3]], 0.2); }
          if (l.c > 0 || l.r > 0) Tp(st.navrch, ok + 4, ok - 2.2, 'ořízněte ' + (l.c > 0 ? 'levý' : '') + (l.c > 0 && l.r > 0 ? ' a ' : '') + (l.r > 0 ? 'horní' : '') + ' okraj a přiložte na čárkovanou čáru sousedního listu', 2.4, 'l', 0, '#555555');
        }
        const pata = rv.H - ok - VS.PATA + 4.5;
        Tp(st.navrch, ok, pata, `${o.nazev ? o.nazev + ' · ' : ''}${d.id} – ${d.nazev}${Nl > 1 ? ` · list ${l.r * rv.nx + l.c + 1}/${Nl} (řádek ${l.r + 1}, sloupec ${l.c + 1})` : ''} · tiskněte ve skutečné velikosti (100 %)`, 2.6);
        meritka(st, rv.W, rv.H, rv.kx, rv.ky, Nl > 1 ? { nx: rv.nx, ny: rv.ny, r: l.r, c: l.c } : null);
        out.push(st);
      }
    }
    if (o.tabulka) {
      // strany s parametry a tabulkou souřadnic
      const W = pw, H = ph, sir = W - 2 * ok;
      let st = null, y = 0;
      const nova = () => { st = pt(W, H); st.typ = 'text'; out.push(st); y = ok + 6; };
      const radek = (txt, h, c) => { if (!st || y > H - ok - 8) nova(); Tp(st.navrch, ok, y, txt, h || 3, 'l', 0, c); y += (h || 3) * 1.5; };
      const odstavec = (txt, h) => { const max = Math.floor(sir / ((h || 3) * 0.5)); let r = ''; for (const s of String(txt).split(' ')) { if ((r + ' ' + s).length > max) { radek(r, h); r = s; } else r = r ? r + ' ' + s : s; } if (r) radek(r, h); };
      nova();
      radek(`${o.nazev || 'Vrtací šablona'} – souřadnice děr`, 5); y += 1;
      if (N.info) odstavec(N.info, 3);
      for (const v of N.varovani || []) odstavec('Pozor: ' + v, 2.8);
      y += 2;
      for (const d of dily) {
        if (y > H - ok - 40) nova();
        radek(`${d.id} – ${d.nazev}`, 4); radek(`${d.pohled || ''}; deska ${cz(d.w)} × ${cz(d.h)} mm${d.t && !d.zed ? ', tl. ' + cz(d.t) + ' mm' : ''}`, 2.6, '#444444');
        if (d.oblast.hrany.length) radek('Referenční hrany šablony: ' + d.oblast.hrany.map((h) => (h === 'L' || h === 'P' ? d.ref.nx : d.ref.ny) || VS.NAZEV_HRANY[h]).filter((x, i, a) => a.indexOf(x) === i).join(', ') + '.', 2.6, '#444444');
        if (d.zed && d.podlaha != null && !d.prehled) radek(`Spodní hrana šablony ${cz(d.podlaha)} mm nad podlahou, levá hrana ${cz(d.odRohu || 0)} mm od rohu.`, 2.6, '#444444');
        const hl = hlavickyTabulky(d), rows = radkyTabulky(d, S, true);
        const sl = hl.length === 8 ? [0, 9, 32, 55, 78, 101, 116, 136] : [0, 9, 52, 95, 113, 133, 153];
        const tabHlav = () => { for (let i = 0; i < hl.length; i++) Tp(st.navrch, ok + sl[i], y, hl[i], 2.4, 'l', 0, '#555555'); y += 1.2; Lp(st.navrch, [[ok, y], [ok + sir, y]], 0.15, '#999999'); y += 3.4; };
        if (y > H - ok - 20) nova();
        tabHlav();
        for (const rw of rows) {
          if (y > H - ok - 8) { nova(); radek(`${d.id} – ${d.nazev} (pokračování)`, 3); tabHlav(); }
          for (let i = 0; i < rw.length; i++) Tp(st.navrch, ok + sl[i], y, rw[i].slice(0, i === rw.length - 1 ? 40 : 18), 2.6);
          y += 3.9;
        }
        y += 4;
      }
      if (y > H - ok - 60) nova();
      radek('Postup', 4);
      for (const t of [
        '1. Vytiskněte ve skutečné velikosti (100 %, bez „přizpůsobit stránce“). Změřte kontrolní úsečky 100 mm vodorovně i svisle; při odchylce zadejte naměřené délky do Kalibrace a tiskněte znovu.',
        '2. Šablonu ořízněte podle obrysu, chlopně ohněte přes referenční hrany a přilepte papírovou páskou. U zdi vyrovnejte červenou čáru vodováhou.',
        '3. Středy děr propíchněte důlčíkem nebo šídlem přes kříž. Šablonu sejměte a vrtejte nejdřív malým vrtákem, pak na plný průměr.',
        '4. Hloubku hlídejte dorazem: sloupec „kroužek“ = vzdálenost od špičky vrtáku ke spodní ploše hloubkového kroužku (u papírové šablony = hloubka díry).',
        '5. Vrtejte kolmo – stojanová vrtačka, vodicí přípravek nebo úhelník vedle vrtáku. Ve zdi ověřte detektorem, že nevrtáte do vedení.',
      ]) odstavec(t, 2.8);
      y += 4;
      if (y > H - ok - 62) nova();
      radek('Kontrolní čtverec 50 × 50 mm', 3);
      st.navrch.push({ t: 'r', x: ok, y: y, w: 50 * K.kx, h: 50 * K.ky, s: 0.25, c: '#000000' });
      Tp(st.navrch, ok + 25 * K.kx, y + 25 * K.ky + 1, '50 × 50 mm', 3.4, 'c');
      y += 50 * K.ky + 6;
    }
    return out;
  }

  /* ---------------- PDF ---------------- */
  const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/[„“]/g, '"').replace(/°/g, ' st.').replace(/Ø/g, 'O').replace(/×/g, 'x');
  function rgb(hex) { const v = parseInt(String(hex || '#000000').slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  /** o: {pismo (TTF base64), nazev, compress} */
  function pdf(jsPDF, str, o) {
    o = Object.assign({ compress: true }, o || {});
    let doc = null, uni = false;
    const T = (s) => (uni ? String(s) : bezDiakritiky(s));
    for (const st of str) {
      const orient = st.W > st.H ? 'l' : 'p';
      if (!doc) {
        doc = new jsPDF({ unit: 'mm', format: [st.W, st.H], orientation: orient, compress: o.compress });
        if (o.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
        doc.setProperties({ title: o.nazev || 'Vrtací šablona', creator: 'Vrtací šablony – tisk 1:1' });
      } else doc.addPage([st.W, st.H], orient);
      const kresli = (e) => {
        const c = rgb(e.c); doc.setDrawColor(...c); doc.setFillColor(...c);
        if (e.t === 'l') {
          doc.setLineWidth(Math.max(0.05, e.s || 0.2));
          const s = Math.max(0.12, e.s || 0.2);
          if (e.d === 'c') doc.setLineDashPattern([s * 10, s * 7], 0); else if (e.d === 'o') doc.setLineDashPattern([s * 30, s * 8, s * 4, s * 8], 0);
          if (e.b.length === 2 && !e.z) doc.line(e.b[0][0], e.b[0][1], e.b[1][0], e.b[1][1]);
          else { const seg = []; for (let i = 1; i < e.b.length; i++) seg.push([e.b[i][0] - e.b[i - 1][0], e.b[i][1] - e.b[i - 1][1]]); doc.lines(seg, e.b[0][0], e.b[0][1], [1, 1], 'S', !!e.z); }
          if (e.d) doc.setLineDashPattern([], 0);
        } else if (e.t === 'e') {
          doc.setLineWidth(Math.max(0.05, e.s || 0.2));
          if (e.d === 'c') doc.setLineDashPattern([2, 1.5], 0); else if (e.d === 'o') doc.setLineDashPattern([5, 1.2, 0.6, 1.2], 0);
          doc.ellipse(e.x, e.y, e.rx, e.ry, e.f ? 'F' : 'S');
          if (e.d) doc.setLineDashPattern([], 0);
        } else if (e.t === 'r') { doc.setLineWidth(Math.max(0.05, e.s || 0.2)); doc.rect(e.x, e.y, e.w, e.h, e.f ? 'FD' : 'S'); }
        else if (e.t === 'm') {
          // hlavní čára kontrolního měřítka – jedním příkazem line (kvůli kontrole v testu)
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

  const API = { scena, svg, svgPrvek, dxf, csv, strany, pdf, hlavickyTabulky, radkyTabulky, popisDiry, bezDiakritiky, cz };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.VSV = API;
})(typeof window !== 'undefined' ? window : globalThis);

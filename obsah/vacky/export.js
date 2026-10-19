/* Návrhář vaček – exporty (SVG, DXF R12, binární STL, CSV). Čistý modul bez DOM.
   Vstupem je výsledek Vacky.vypocet(). Souřadnice profilu jsou ve vlastním rámu vačky v mm (y nahoru). */
(function () {
  'use strict';
  const TAU = 2 * Math.PI;
  const c4 = x => (Math.abs(x) < 5e-5 ? 0 : x).toFixed(4);

  function kruh(r, n) { const o = []; for (let i = 0; i < n; i++) { const a = TAU * i / n; o.push([r * Math.cos(a), r * Math.sin(a)]); } return o; }

  function popisNavrhu(v) {
    const p = v.p, Z = { harmonicky: 'harmonicky', cykloidni: 'cykloidni', p345: '3-4-5', p4567: '4-5-6-7' };
    const typ = { hrot: 'hrotove', kladka: 'kladkove Rr=' + p.Rr, plochy: 'ploche' }[p.typ];
    return `Rb=${p.Rb} h=${p.h} nabeh ${p.beta1}deg (${Z[p.zakonNabeh]}) vydrz ${p.delta1}deg navrat ${p.beta2}deg (${Z[p.zakonNavrat]}) ` +
      `vydrz ${+p.delta2.toFixed(4)}deg; zdvihatko ${typ}, e=${p.eps}; otaceni ${p.smer === 'cw' ? 'po smeru hod. rucicek' : 'proti smeru hod. rucicek'}`;
  }

  /** SVG v milimetrech (1 jednotka = 1 mm), y je překlopené, aby výkres odpovídal pohledu shora */
  function svg(v, volby) {
    volby = Object.assign({ roztecna: true, zakladni: true, znacka: true }, volby);
    const p = v.p, R = v.ex.rMax + 6;
    const bodyStr = pts => pts.map(q => `${c4(q[0])},${c4(-q[1])}`).join(' ');
    const W = 2 * R;
    const sm = p.smer === 'ccw' ? -1 : 1;
    // značka 0°: směr, ve kterém leží bod dotyku při θ = 0 (začátek náběhu)
    const b0 = v.body[0].vacka, z0 = [sm * b0[0], b0[1]];
    const d0 = Math.hypot(z0[0], z0[1]);
    let s = `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${c4(W)}mm" height="${c4(W)}mm" viewBox="${c4(-R)} ${c4(-R)} ${c4(W)} ${c4(W)}">\n` +
      `<title>Disková vačka</title>\n<desc>${popisNavrhu(v)}</desc>\n` +
      `<g fill="none" stroke-linejoin="round">\n` +
      `<polygon id="profil" points="${bodyStr(v.profil)}" stroke="#000" stroke-width="0.35"/>\n`;
    if (p.otvor > 0) s += `<circle id="otvor" cx="0" cy="0" r="${c4(p.otvor / 2)}" stroke="#000" stroke-width="0.35"/>\n`;
    if (volby.zakladni) s += `<circle id="zakladni" cx="0" cy="0" r="${c4(p.Rb)}" stroke="#777" stroke-width="0.18" stroke-dasharray="3 1 0.5 1"/>\n`;
    if (volby.roztecna && v.roztecna && p.typ === 'kladka') s += `<polygon id="roztecna" points="${bodyStr(v.roztecna)}" stroke="#777" stroke-width="0.18" stroke-dasharray="2 1"/>\n`;
    s += `<path id="osy" d="M ${c4(-R + 2)} 0 H ${c4(R - 2)} M 0 ${c4(-R + 2)} V ${c4(R - 2)}" stroke="#777" stroke-width="0.18" stroke-dasharray="6 1 1 1"/>\n`;
    if (volby.znacka && d0 > 0) s += `<line id="znacka0" x1="0" y1="0" x2="${c4(z0[0] / d0 * (p.otvor / 2 + 3))}" y2="${c4(-z0[1] / d0 * (p.otvor / 2 + 3))}" stroke="#c00" stroke-width="0.25"/>\n`;
    s += `</g>\n</svg>\n`;
    return s;
  }

  /** DXF R12 (AC1009): profil a roztečná křivka jako uzavřené POLYLINE, otvor a základní kružnice jako CIRCLE */
  function dxf(v) {
    const p = v.p, L = [];
    const g = (k, h) => { L.push(String(k)); L.push(String(h)); };
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES');
    g(0, 'TABLE'); g(2, 'LAYER'); g(70, 4);
    for (const [jm, barva] of [['PROFIL', 7], ['OTVOR', 7], ['KONSTRUKCE', 8], ['ROZTECNA', 8]]) { g(0, 'LAYER'); g(2, jm); g(70, 0); g(62, barva); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    const poly = (pts, vrstva) => {
      g(0, 'POLYLINE'); g(8, vrstva); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, 1);
      for (const q of pts) { g(0, 'VERTEX'); g(8, vrstva); g(10, c4(q[0])); g(20, c4(q[1])); g(30, 0); }
      g(0, 'SEQEND'); g(8, vrstva);
    };
    poly(v.profil, 'PROFIL');
    if (p.typ === 'kladka' && v.roztecna) poly(v.roztecna, 'ROZTECNA');
    if (p.otvor > 0) { g(0, 'CIRCLE'); g(8, 'OTVOR'); g(10, 0); g(20, 0); g(30, 0); g(40, c4(p.otvor / 2)); }
    g(0, 'CIRCLE'); g(8, 'KONSTRUKCE'); g(10, 0); g(20, 0); g(30, 0); g(40, c4(p.Rb));
    g(0, 'ENDSEC'); g(0, 'EOF');
    return L.join('\r\n') + '\r\n';
  }

  /** Převzorkuje polárně monotónní uzavřený polygon na M paprsků s úhly 2πk/M (průsečík paprsku s hranou). */
  function polarne(pts, M) {
    const n = pts.length;
    // směr oběhu (kladná plocha = CCW); pro CW obrátit
    let A2 = 0;
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; A2 += a[0] * b[1] - b[0] * a[1]; }
    const P = A2 >= 0 ? pts.slice() : pts.slice().reverse();
    // začít bodem s nejmenším úhlem v [0, 2π)
    const ang = q => { let a = Math.atan2(q[1], q[0]); return a < 0 ? a + TAU : a; };
    let start = 0; for (let i = 1; i < n; i++) if (ang(P[i]) < ang(P[start])) start = i;
    const Q = []; for (let i = 0; i < n; i++) Q.push(P[(start + i) % n]);
    const U = [ang(Q[0])];
    for (let i = 1; i <= n; i++) {
      const q = Q[i % n]; let a = ang(q);
      while (a < U[i - 1] - 1e-12) a += TAU;
      U.push(a);
    }
    for (let i = 1; i <= n; i++) if (U[i] < U[i - 1]) throw new Error('Profil není polárně monotónní.');
    const out = [];
    for (let k = 0; k < M; k++) {
      let t = TAU * k / M; while (t < U[0]) t += TAU; while (t >= U[0] + TAU) t -= TAU;
      let lo = 0, hi = n;                 // hledáme j: U[j] ≤ t < U[j+1]
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (U[m] <= t) lo = m; else hi = m; }
      const j = lo;
      const a = Q[j], b = Q[(j + 1) % n];
      const d = [Math.cos(t), Math.sin(t)];
      // a + u(b−a) = λ d
      const ex = b[0] - a[0], ey = b[1] - a[1];
      const den = ex * d[1] - ey * d[0];
      const u = Math.abs(den) < 1e-15 ? 0 : (a[1] * d[0] - a[0] * d[1]) / den;
      const x = a[0] + u * ex, y = a[1] + u * ey;
      out.push([x, y]);
    }
    return out;
  }

  /** Trojúhelníková síť disku: [{a,b,c}] s vrcholy [x,y,z]; normály ven (pravidlo pravé ruky). */
  function sit(v, M) {
    M = M || 720;
    const p = v.p, t = p.tloustka;
    const o = polarne(v.profil, M);
    const r = p.otvor / 2;
    const tri = [];
    const T = (a, b, c) => tri.push([a, b, c]);
    const z0 = q => [q[0], q[1], 0], z1 = q => [q[0], q[1], t];
    for (let i = 0; i < M; i++) {
      const j = (i + 1) % M;
      // vnější stěna
      T(z0(o[i]), z0(o[j]), z1(o[j])); T(z0(o[i]), z1(o[j]), z1(o[i]));
    }
    if (r > 0) {
      const inn = [];
      for (let i = 0; i < M; i++) { const a = TAU * i / M; inn.push([r * Math.cos(a), r * Math.sin(a)]); }
      for (let i = 0; i < M; i++) {
        const j = (i + 1) % M;
        T(z0(inn[j]), z0(inn[i]), z1(inn[i])); T(z0(inn[j]), z1(inn[i]), z1(inn[j]));   // otvor – normála dovnitř otvoru
        T(z1(inn[i]), z1(o[i]), z1(o[j])); T(z1(inn[i]), z1(o[j]), z1(inn[j]));         // horní mezikruží
        T(z0(inn[i]), z0(o[j]), z0(o[i])); T(z0(inn[i]), z0(inn[j]), z0(o[j]));         // spodní
      }
    } else {
      const c0 = [0, 0, 0], c1 = [0, 0, t];
      for (let i = 0; i < M; i++) { const j = (i + 1) % M; T(c1, z1(o[i]), z1(o[j])); T(c0, z0(o[j]), z0(o[i])); }
    }
    return { tri, obrys: o };
  }

  function stlBinarni(tri, hlavicka) {
    const buf = new ArrayBuffer(84 + 50 * tri.length), dv = new DataView(buf);
    const h = (hlavicka || 'vacka').slice(0, 79);
    for (let i = 0; i < h.length; i++) dv.setUint8(i, h.charCodeAt(i) & 0x7f);
    dv.setUint32(80, tri.length, true);
    let o = 84;
    for (const [a, b, c] of tri) {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      const l = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map(x => x / l);
      for (const x of n) { dv.setFloat32(o, x, true); o += 4; }
      for (const q of [a, b, c]) for (const x of q) { dv.setFloat32(o, x, true); o += 4; }
      dv.setUint16(o, 0, true); o += 2;
    }
    return buf;
  }

  function stl(v, M) {
    if (!v.profilPolarni) throw new Error('Profil není polárně jednoznačný (podřezání) – STL nelze vytvořit.');
    if (v.p.otvor / 2 >= v.ex.rMin) throw new Error('Otvor pro hřídel je větší než profil vačky.');
    return stlBinarni(sit(v, M).tri, 'Diskova vacka - ' + popisNavrhu(v));
  }

  function csv(v, krokDeg) {
    krokDeg = krokDeg || 1;
    const w = v.cas.w, k = Math.max(1, Math.round(krokDeg / v.krok));
    const r = ['uhel_deg;s_mm;ds_dth_mm_rad;d2s_mm_rad2;d3s_mm_rad3;v_m_s;a_m_s2;j_m_s3;tlakovy_uhel_deg;rho_profil_mm;x_profil_mm;y_profil_mm;F_osa_N'];
    const f = x => (isFinite(x) ? (+x.toFixed(6)).toString().replace('.', ',') : '');
    for (let i = 0; i < v.body.length - 1; i += k) {
      const b = v.body[i], q = v.profil[i];
      r.push([f(b.th), f(b.s), f(b.s1), f(b.s2), f(b.s3), f(b.s1 * w / 1000), f(b.s2 * w * w / 1000), f(b.s3 * w * w * w / 1000),
        f(b.phi * 180 / Math.PI), f(b.rho), f(q[0]), f(q[1]), f(v.sily[i].Fy)].join(';'));
    }
    return '﻿' + r.join('\r\n') + '\r\n';
  }

  const API = { svg, dxf, stl, stlBinarni, sit, polarne, csv, popisNavrhu };
  if (typeof module !== 'undefined') module.exports = API; else window.VackyExport = API;
})();

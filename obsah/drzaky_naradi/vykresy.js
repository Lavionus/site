/* ============================================================
   Držáky nářadí a Gridfinity – výkresy (bez DOM): 2D scény s kótami, SVG, DXF, strany PDF, PDF (jsPDF parametrem)
   Scéna: {prvky, x0, y0, x1, y1, nazev} v mm, y nahoru.
   prvek: {t:'l', b:[[x,y]..], s, c, d:'c'|'o', z (uzavřít), f (výplň)} | {t:'k', x, y, r, s, c, f, d} |
          {t:'txt', x, y, h, txt, a:'l'|'c'|'r', u (° proti směru hod.), c}
   ============================================================ */
(function (koren) {
  'use strict';
  const DN = koren.DN || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const GF = DN.GF, cz = DN.cz, r2 = DN.r2;
  const MODRA = '#1f5fa8', SEDA = '#777777', CERV = '#b3261e', ZEL = '#2c8a4a', ORAN = '#d04a00', DREVO = '#c8a26b';
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function nova(nazev) {
    const pr = [];
    const S = {
      prvky: pr, nazev,
      L: (b, s, c, d, z, f) => pr.push({ t: 'l', b, s: s || 0.25, c: c || '#000000', d, z, f }),
      K: (x, y, r, s, c, f, d) => pr.push({ t: 'k', x, y, r, s: s || 0.25, c: c || '#000000', f, d }),
      T: (x, y, txt, h, a, u, c) => pr.push({ t: 'txt', x, y, txt: String(txt), h: h || 3, a: a || 'l', u: u || 0, c: c || '#000000' }),
      R: (x0, y0, x1, y1, s, c, d, f) => pr.push({ t: 'l', b: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], s: s || 0.25, c: c || '#000000', d, z: true, f }),
      RR: (x0, y0, x1, y1, r, s, c, d, f) => pr.push({ t: 'l', b: rr(x0, y0, x1, y1, r), s: s || 0.25, c: c || '#000000', d, z: true, f }),
      /** kóta mezi body a, b; off = odsazení kolmo (kladné vlevo od směru a→b) */
      kota(a, b, off, txt, h, c) {
        h = h || 3; c = c || MODRA;
        const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, ux = dx / l, uy = dy / l;
        const A = [a[0] + nx * off, a[1] + ny * off], B = [b[0] + nx * off, b[1] + ny * off], pre = Math.sign(off || 1) * h * 0.35;
        S.L([[a[0] + nx * Math.sign(off) * 0.8, a[1] + ny * Math.sign(off) * 0.8], [A[0] + nx * pre, A[1] + ny * pre]], h * 0.05, c);
        S.L([[b[0] + nx * Math.sign(off) * 0.8, b[1] + ny * Math.sign(off) * 0.8], [B[0] + nx * pre, B[1] + ny * pre]], h * 0.05, c);
        S.L([A, B], h * 0.06, c);
        const sip = (P, sm) => { const s = h * 0.55, w = h * 0.18; S.L([P, [P[0] + sm * ux * s + nx * w, P[1] + sm * uy * s + ny * w], [P[0] + sm * ux * s - nx * w, P[1] + sm * uy * s - ny * w]], 0.01, c, null, true, c); };
        if (l > h * 1.4) { sip(A, 1); sip(B, -1); } else { sip(A, -1); sip(B, 1); }
        let u = Math.atan2(dy, dx) * 180 / Math.PI; if (u > 90.01) u -= 180; if (u < -89.99) u += 180;
        const ur = u * Math.PI / 180, tnx = -Math.sin(ur), tny = Math.cos(ur);
        S.T((A[0] + B[0]) / 2 + tnx * h * 0.3, (A[1] + B[1]) / 2 + tny * h * 0.3, txt == null ? cz(l) : txt, h, 'c', u, c);
      },
      /** odkazová čárka s popisem */
      odkaz(p, q, txt, h, c) { c = c || MODRA; S.L([p, q], 0.15, c); S.K(p[0], p[1], 0.5, 0.1, c, c); S.T(q[0] + (q[0] >= p[0] ? 1 : -1), q[1] + 0.6, txt, h || 2.8, q[0] >= p[0] ? 'l' : 'r', 0, c); },
    };
    return S;
  }
  function rr(x0, y0, x1, y1, r) {
    r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
    if (r < 0.01) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const out = [];
    for (const [cx, cy, a0] of [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]]) for (let i = 0; i <= 6; i++) { const a = (a0 + i * 15) * Math.PI / 180; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return out;
  }
  /** meze scény z prvků + okraj */
  function uzavri(S, okraj) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const p = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
    for (const e of S.prvky) {
      if (e.t === 'l') for (const q of e.b) p(q[0], q[1]);
      else if (e.t === 'k') { p(e.x - e.r, e.y - e.r); p(e.x + e.r, e.y + e.r); }
      else if (e.t === 'txt') { const w = e.h * 0.56 * e.txt.length, ur = e.u * Math.PI / 180, kk = e.a === 'c' ? 0.5 : e.a === 'r' ? 1 : 0; const sx = e.x - Math.cos(ur) * w * kk, sy = e.y - Math.sin(ur) * w * kk; p(sx, sy); p(sx + Math.cos(ur) * w - Math.sin(ur) * e.h, sy + Math.sin(ur) * w + Math.cos(ur) * e.h); }
    }
    const o = okraj == null ? 4 : okraj;
    if (!Number.isFinite(x0)) { x0 = y0 = 0; x1 = y1 = 10; }
    S.x0 = x0 - o; S.y0 = y0 - o; S.x1 = x1 + o; S.y1 = y1 + o;
    return S;
  }

  /* ---------------- Gridfinity ---------------- */
  function scenaPodlozka(P0, krabicky, vybrana) {
    const P = P0.deleni ? P0 : DN.podlozka(P0), S = nova('Podložka ' + P.nx + ' × ' + P.ny), g = GF.roztec;
    S.RR(P.x0, P.y0, P.x1, P.y1, GF.rPodlozky, 0.4, '#000000', null, '#f1ede4');
    for (let i = 0; i < P.nx; i++) for (let j = 0; j < P.ny; j++) S.RR(i * g + 2.85, j * g + 2.85, (i + 1) * g - 2.85, (j + 1) * g - 2.85, 1.15, 0.15, SEDA);
    for (const q of P.otvory) S.K(q.x, q.y, GF.otvorMagnetu / 2, 0.15, SEDA);
    for (const q of P.vrutyPoz) { S.K(q.x, q.y, DN.cislo(P.vrutD, 4) / 2, 0.15, SEDA); S.K(q.x, q.y, DN.cislo(P.vrutHlava, 8) / 2, 0.1, SEDA, null, 'c'); }
    (krabicky || []).forEach((k0, q) => {
      const K = DN.krabicka(k0), vyb = q === vybrana;
      S.RR(K.x0, K.y0, K.x1, K.y1, GF.rKrabicky, vyb ? 0.7 : 0.4, vyb ? ORAN : ZEL, null, vyb ? '#fbe3d3' : '#dcefe1');
      const h = Math.min(6, K.hloubka / 4);
      S.T((K.x0 + K.x1) / 2, (K.y0 + K.y1) / 2 + h * 0.15, `${q + 1}: ${K.n}×${K.m}×${K.u}`, h, 'c', 0, vyb ? ORAN : ZEL);
      if (K.vlozka) S.T((K.x0 + K.x1) / 2, (K.y0 + K.y1) / 2 - h * 1.1, 'kapsy', h * 0.7, 'c', 0, SEDA);
    });
    // dělení na díly
    const D = P.deleni;
    for (const d of D.dily) {
      if (d.i > 0) S.L([[d.x0, d.y0], [d.x0, d.y1]], 0.6, CERV, 'c');
      if (d.j > 0) S.L([[d.x0, d.y0], [d.x1, d.y0]], 0.6, CERV, 'c');
      if (D.dily.length > 1) S.T(d.x0 + 3, d.y1 - 7, d.id + ' ' + cz(d.w, 0) + '×' + cz(d.h, 0), 4, 'l', 0, CERV);
    }
    S.kota([P.x0, P.y0], [P.x1, P.y0], -10, cz(P.sirka) + ' mm', 4.5);
    S.kota([P.x1, P.y0], [P.x1, P.y1], -10, cz(P.hloubka) + ' mm', 4.5);
    S.kota([0, P.y1], [g, P.y1], 6, '42', 3.5);
    if (P.okraje.l > 0) S.kota([P.x0, P.y1], [0, P.y1], 6, cz(P.okraje.l), 3);
    return uzavri(S, 3);
  }

  /** obrys řezu krabičky rovinou y = střed (x vodorovně, z svisle) – vnější a vnitřní polyline */
  function rezKrabicky(K) {
    const g = GF.roztec, pk = GF.profilKrabicky, vr = pk[3][0], H = K.vyska;
    // vnější: zleva po podstavách, vpravo nahoru, hrana lemu, lem dovnitř a dolů, dno, druhá strana
    const out = [];
    const x0 = K.x0, x1 = K.x1, top = K.vyskaCelkem;
    out.push([x0, pk[3][1]]);
    for (let i = 0; i < K.n; i++) {
      const a = (K.gx + i) * g + GF.mezera / 2, b = (K.gx + i + 1) * g - GF.mezera / 2;
      for (let q = 3; q >= 0; q--) out.push([a + vr - pk[q][0], pk[q][1]]);
      for (let q = 0; q <= 3; q++) out.push([b - vr + pk[q][0], pk[q][1]]);
    }
    out.push([x1, top]);
    const lip = K.lem ? [[0.4, H + 4.0], [1.9, H + 2.5], [1.9, H + 0.7], [2.6, H], [2.6, H - 1.2], [GF.stena, H - 1.2 - (2.6 - GF.stena)], [GF.stena, K.zDno]] : [[GF.stena, H], [GF.stena, K.zDno]];
    for (const [d, z] of lip) out.push([x1 - d, z]);
    for (const [d, z] of lip.slice().reverse()) out.push([x0 + d, z]);
    out.push([x0, top]);
    return out;
  }

  function scenaKrabicka(K0, o) {
    o = o || {};
    const K = K0.komory ? K0 : DN.krabicka(K0), S = nova('Krabička ' + K.n + '×' + K.m + '×' + K.u);
    // půdorys
    S.RR(K.x0, K.y0, K.x1, K.y1, GF.rKrabicky, 0.45, '#000000', null, '#eef3f7');
    S.RR(K.x0 + 2.6, K.y0 + 2.6, K.x1 - 2.6, K.y1 - 2.6, GF.rKrabicky - 2.6, 0.15, SEDA);
    let V = null;
    if (K.vlozka) {
      V = DN.vlozka(K, K.vlozka);
      const A = V.plocha;
      S.R(A.x0, A.y0, A.x0 + A.W, A.y0 + A.H, 0.12, SEDA, 'c');
      for (const p of V.kapsy) kreslitKapsu(S, p, V);
    } else {
      for (const q of K.komory) {
        S.R(q.x0, q.y0, q.x1, q.y1, 0.3, '#000000');
        if (K.stitekH > 0) { S.R(q.x0, q.y1 - K.stitekH, q.x1, q.y1, 0.15, MODRA, null, '#dbe7f5'); }
        if (K.lopatkaR > 0) S.L([[q.x0, q.y0 + K.lopatkaR], [q.x1, q.y0 + K.lopatkaR]], 0.15, SEDA, 'c');
      }
    }
    for (const q of K.otvory) if (K.magnety || K.srouby) S.K(q.x, q.y, (K.magnety ? GF.otvorMagnetu : GF.otvorSroubu) / 2, 0.12, SEDA, null, 'c');
    S.kota([K.x0, K.y0], [K.x1, K.y0], -8, cz(K.sirka), 3.5);
    S.kota([K.x1, K.y0], [K.x1, K.y1], -8, cz(K.hloubka), 3.5);
    if (!K.vlozka && K.delX > 1) { const q = K.komory[0]; S.kota([q.x0, K.y1], [q.x1, K.y1], 5, cz(K.kw), 2.8); }
    if (!K.vlozka && K.delY > 1) { const q = K.komory[0]; S.kota([K.x0, q.y0], [K.x0, q.y1], 5, cz(K.kh), 2.8); }
    // řez A–A pod půdorysem
    if (o.rez !== false) {
      const dz = K.y0 - 22 - K.vyskaCelkem;
      const b = rezKrabicky(K).map((q) => [q[0], q[1] + dz]);
      S.L(b, 0.35, '#000000', null, true, '#d7e3ee');
      if (!K.vlozka) for (const q of K.komory) if (q.j === 0 && q.i < K.delX - 1) S.R(q.x1, K.zDno + dz, q.x1 + GF.prepazka, K.zKomor + dz, 0.25, '#000000', null, '#d7e3ee');
      if (K.vlozka) S.R(K.x0 + GF.stena, K.zDno + dz, K.x1 - GF.stena, K.zKomor + dz, 0.15, SEDA, 'c');
      S.T(K.x0, dz + K.vyskaCelkem + 3, 'Řez A–A', 3.2, 'l', 0, '#000000');
      S.kota([K.x1, dz], [K.x1, dz + K.vyska], -7, '7 × ' + K.u + ' = ' + cz(K.vyska), 3);
      if (K.lem) S.kota([K.x1, dz + K.vyska], [K.x1, dz + K.vyska + GF.vyskaLemu], -7, '4,4', 2.6);
      S.kota([K.x0, dz], [K.x0, dz + K.zDno], 7, cz(K.zDno), 2.6);
      const a = K.gx * GF.roztec + GF.mezera / 2;
      S.kota([a, dz], [a + GF.zakladna, dz], -6, '41,5', 3);
      if (K.n > 1) S.kota([K.gx * GF.roztec, dz - 12], [(K.gx + 1) * GF.roztec, dz - 12], 0, '42', 3);
    }
    return uzavri(S, 3);
  }
  function kreslitKapsu(S, p, V, dx, dy) {
    dx = dx || 0; dy = dy || 0;
    const t = p.t, x = p.gx + dx, y = p.gy + dy;
    if (t.tvar === 'valec') S.K(x, y, p.pkw / 2, 0.3, '#000000');
    else if (t.tvar === 'sestihran') { const R = p.pkw / 2, b = []; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; b.push([x + R * Math.cos(a), y + R * Math.sin(a)]); } S.L(b, 0.3, '#000000', null, true); }
    else if (t.tvar === 'obrys' && t.body) {
      const xs = t.body.map((q) => q[0]), ys = t.body.map((q) => q[1]), mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2;
      S.L(t.body.map((q) => (p.rot ? [x - (q[1] - my), y + (q[0] - mx)] : [x + q[0] - mx, y + q[1] - my])), 0.3, '#000000', null, true);
    } else S.RR(x - p.pkw / 2, y - p.pkh / 2, x + p.pkw / 2, y + p.pkh / 2, t.tvar === 'lezici' ? Math.min(p.pkw, p.pkh) / 2 : 1.5, 0.3, '#000000');
    if (p.prst) { if (p.rot) S.R(x - p.kw / 2, y - DN.PRST_R * 0.6, x + p.kw / 2, y + DN.PRST_R * 0.6, 0.15, SEDA, 'c'); else S.R(x - DN.PRST_R * 0.6, y - p.kh / 2, x + DN.PRST_R * 0.6, y + p.kh / 2, 0.15, SEDA, 'c'); }
    if (t.popis && V.V.popisky && p.px != null) S.T(p.px + dx, p.py + dy - DN.cislo(V.V.vyskaPisma, 3.5) * 0.36, t.popis, DN.cislo(V.V.vyskaPisma, 3.5) * 0.85, 'c', 0, MODRA);
  }
  /** 1:1 zkušební list kapes – obrysy kapes a popisky (vložka bez krabičky) */
  function scenaKapsy11(K0) {
    const K = K0.komory ? K0 : DN.krabicka(K0), S = nova('Kapsy 1:1 – krabička ' + K.n + '×' + K.m), V = DN.vlozka(K, K.vlozka || {});
    S.RR(K.x0, K.y0, K.x1, K.y1, GF.rKrabicky, 0.3, SEDA);
    S.R(V.plocha.x0, V.plocha.y0, V.plocha.x0 + V.plocha.W, V.plocha.y0 + V.plocha.H, 0.15, SEDA, 'c');
    for (const p of V.kapsy) kreslitKapsu(S, p, V);
    S.kota([K.x0, K.y0], [K.x1, K.y0], -6, cz(K.sirka), 3);
    return uzavri(S, 2);
  }
  /** detail lícování podstavy krabičky v lůžku podložky (zvětšeno) */
  function scenaLicovani(M) {
    M = M || 8;
    const S = nova('Detail lícování ' + M + ':1'), L = DN.licovani(), cl = GF.vyskaPodlozky - GF.profilPodlozky[3][1];
    // jen pravá polovina okraje: x = vzdálenost od osy buňky (od 15 do 22 mm), z od spodku podložky
    const X = (x) => (x - 15) * M, Z = (z) => z * M;
    // podložka (tenká) – materiál vpravo od lůžka
    const pl = [[GF.roztec / 2 - 2.85, 0], [GF.roztec / 2 - 2.85, cl]];
    for (let q = 1; q < 4; q++) pl.push([GF.roztec / 2 - 2.85 + GF.profilPodlozky[q][0], cl + GF.profilPodlozky[q][1]]);
    const plb = pl.map((q) => [X(q[0]), Z(q[1])]).concat([[X(GF.roztec / 2), 0]]);
    S.L(plb, 0.35, '#000000', null, true, '#e8dcc6');
    // krabička usazená: spodek v z = cl + L.sedi
    const z0 = cl + L.sedi, kb = [[X(15), Z(z0)]];
    for (const q of GF.profilKrabicky) kb.push([X(GF.zakladna / 2 - GF.profilKrabicky[3][0] + q[0]), Z(z0 + q[1])]);
    kb.push([X(GF.zakladna / 2), Z(z0 + 7)], [X(15), Z(z0 + 7)]);
    S.L(kb, 0.35, ZEL, null, true, 'rgba(44,138,74,0.18)');
    S.T(X(15.4), Z(z0 + 6), 'krabička', 3.2, 'l', 0, ZEL); S.T(X(21.2), Z(0.6), 'podložka', 3.2, 'l', 0, '#6b5434');
    S.kota([X(GF.zakladna / 2), Z(z0 + 7.3)], [X(GF.roztec / 2), Z(z0 + 7.3)], 4, '0,25', 3);
    S.kota([X(18.6), Z(z0 + 1.7)], [X(18.85), Z(z0 + 1.7)], 0, '', 2);
    S.odkaz([X(18.72), Z(z0 + 1.7)], [X(16.2), Z(z0 + 3.2)], 'vůle 0,25 na svislé části', 3);
    S.odkaz([X(20), Z(cl + 3.65)], [X(16.2), Z(cl + 4.9)], 'dosedá na zkosení 45°', 3);
    S.kota([X(GF.roztec / 2), 0], [X(GF.roztec / 2), Z(GF.vyskaPodlozky)], -6, '5,0', 3);
    S.T(X(GF.roztec / 2) + 2, Z(GF.vyskaPodlozky) + 3, 'hrana buňky (42 / 2)', 2.6, 'l', 0, '#6b5434');
    S.kota([X(GF.roztec / 2 - 2.85), Z(cl)], [X(GF.roztec / 2 - 2.15), Z(cl)], -5, '0,7', 2.6);
    S.kota([X(GF.zakladna / 2 - 2.95), Z(z0)], [X(GF.zakladna / 2 - 2.15), Z(z0)], 5, '0,8', 2.6);
    S.T(0, -10, `Profil podstavy 0,8 / 1,8 / 2,15 (×45°), lůžko 0,7 / 1,8 / 2,15, vůle pod krabičkou ${cz(cl)} mm. Měřítko ${M}:1.`, 3, 'l', 0, '#444444');
    return uzavri(S, 3);
  }

  /* ---------------- stěna ---------------- */
  function scenaProfilListy(L0, G) {
    const L = DN.lista(L0), S = nova('Profil lišty a háku');
    // stěna
    S.R(-12, -L.h - 30, 0, 50, 0.2, SEDA, null, '#e4e4e4');
    S.T(-6, 44, 'stěna', 3, 'c', 90, '#555555');
    // nástěnná lišta (z = 0 horní hrana)
    S.L(L.profil.map((q) => [q[0], q[1] - L.h]), 0.4, '#000000', null, true, DREVO);
    S.kota([L.t, -L.h], [L.t, 0], -8, cz(L.h), 3.2);
    S.kota([0, -L.h], [L.t, -L.h], -6, cz(L.t), 3.2);
    S.kota([0, -L.h], [0, L.kratka - L.h], 18, cz(L.kratka), 2.8);
    S.T(L.t * 0.35, -L.pokles * 0.2 - 6, cz(L.uhel) + '°', 3.2, 'c', 0, MODRA);
    if (G) {
      S.L(G.profil, 0.4, ZEL, null, true, 'rgba(44,138,74,0.2)');
      for (const q of G.vyrezy.slice(0, 1)) {
        const z1 = q.z0 != null ? q.z0 : G.zHorni, z0 = q.skrz ? G.zSpodni : z1 - q.hloubka, h = q.tvar === 'kruh' ? q.d : q.hl;
        S.R(q.y - h / 2, z0, q.y + h / 2, z1, 0.2, ZEL, 'c');
      }
      S.kota([G.yP, G.zHorni], [G.yP + G.hloubka, G.zHorni], 6, cz(G.hloubka), 3);
      S.kota([G.yP + G.hloubka, G.zSpodni], [G.yP + G.hloubka, G.zHorni], -6, cz(G.zHorni - G.zSpodni), 3);
      S.odkaz([G.c + 1, -L.pokles + G.c + 2], [-30, -L.pokles - 12], 'vůle ' + cz(G.c), 3, ZEL);
    }
    return uzavri(S, 3);
  }
  function scenaDrzak(G) {
    const S = nova(G.nazev);
    // pohled shora tak, jak ho vidíte před stěnou: stěna nahoře, x od pravého konce (otočeno o 180°)
    const P = (x, y) => [G.sirka - x, -y], Rr = (x0, y0, x1, y1, s, c, d, f) => { const a = P(x0, y0), b = P(x1, y1); S.R(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), s, c, d, f); };
    const yF = G.yP + G.hloubka;
    Rr(0, G.yZ, G.sirka, G.yP, 0.2, SEDA, null, '#e8efe9');
    Rr(0, G.yP, G.sirka, yF, 0.4, '#000000', null, '#dcefe1');
    Rr(0, G.c, G.sirka, G.yZ, 0.2, SEDA, 'c');
    for (const q of G.vyrezy) {
      if (q.tvar === 'kruh') { const c = P(q.x, q.y); S.K(c[0], c[1], q.d / 2, 0.3, '#000000', '#ffffff'); }
      else if (q.tvar === 'otevreny') {
        const r = q.w / 2, yz = q.y - q.hl / 2 + r, b = [P(q.x - r, yF), P(q.x - r, yz)];
        for (let i = 0; i <= 8; i++) { const a = Math.PI + i * Math.PI / 8; b.push(P(q.x + r * Math.cos(a), yz + r * Math.sin(a))); }
        b.push(P(q.x + r, yF)); S.L(b, 0.3, '#000000', null, false, '#ffffff');
      } else Rr(q.x - q.w / 2, q.y - q.hl / 2, q.x + q.w / 2, q.y + q.hl / 2, 0.3, '#000000', null, '#ffffff');
    }
    for (const p of G.popisky) { const c = P(p.x, p.y); S.T(c[0], c[1] - p.h * 0.36, p.text, p.h * 0.85, 'c', 0, MODRA); }
    for (const [a] of G.casti.slice(1)) S.L([P(a, G.c - 3), P(a, yF + 3)], 0.5, CERV, 'c');
    S.kota(P(G.sirka, yF), P(0, yF), -7, cz(G.sirka), 3.2);
    S.kota(P(0, yF), P(0, G.yP), -7, cz(G.hloubka), 3);
    const kr = G.vyrezy;
    if (kr.length > 1 && Math.abs(kr[1].y - kr[0].y) < 1e-6) S.kota(P(kr[0].x, G.c), P(kr[1].x, G.c), -5, cz(kr[1].x - kr[0].x), 2.6);
    if (kr[0]) { const w = kr[0].tvar === 'kruh' ? kr[0].d : kr[0].w, yk = G.c - (kr.length > 1 ? 10 : 5); S.kota(P(kr[0].x - w / 2, yk), P(kr[0].x + w / 2, yk), 0, (kr[0].tvar === 'kruh' ? 'Ø' : '') + cz(w), 2.6); }
    S.T(0, -yF - 16, 'Pohled shora – stojíte před stěnou (stěna nahoře)', 3, 'l', 0, '#444444');
    S.L([P(0, 0), P(G.sirka, 0)], 0.6, SEDA);
    // boční pohled vpravo (y vodorovně, z svisle), posunutý
    const ox = G.sirka + 30 - Math.min(...G.profil.map((q) => q[0])), oy = -(G.yP + G.hloubka) / 2 - (G.zHorni + G.zSpodni) / 2;
    S.L(G.profil.map((q) => [ox + q[0], oy + q[1]]), 0.4, '#000000', null, true, '#dcefe1');
    S.L([[ox, oy + G.zSpodni - 6], [ox, oy + G.zHorni + 6]], 0.3, SEDA, 'o');
    for (const q of G.vyrezy) {
      const z1 = q.z0 != null ? q.z0 : G.zHorni, z0 = q.skrz ? G.zSpodni : z1 - q.hloubka, h = q.tvar === 'kruh' ? q.d : q.hl;
      S.R(ox + q.y - h / 2, oy + Math.max(z0, G.zSpodni), ox + q.y + h / 2, oy + z1, 0.15, SEDA, 'c');
    }
    S.kota([ox + G.yP + G.hloubka, oy + G.zSpodni], [ox + G.yP + G.hloubka, oy + G.zHorni], -6, cz(G.zHorni - G.zSpodni), 3);
    S.T(ox, oy + G.zHorni + 10, 'Bok (líc stěny vlevo)', 3, 'l', 0, '#444444');
    return uzavri(S, 3);
  }
  function scenaStena(S0) {
    const R = S0, L = R.L, S = nova('Rozvržení stěny');
    const zMax = Math.max(...R.rady.map((r) => r.zHorni)) + 100, zMin = Math.min(...R.rady.map((r) => r.zSpodni)) - 90;
    S.R(0, zMin, L.delka, zMax, 0.2, SEDA, 'c');
    for (const r of R.rady) {
      S.R(0, r.zSpodni, L.delka, r.zHorni, 0.6, '#000000', null, DREVO);
      S.T(-12, (r.zHorni + r.zSpodni) / 2 - 8, 'řada ' + (r.r + 1), 20, 'r', 0, '#000000');
      S.T(L.delka + 14, r.zHorni - 20, 'horní hrana ' + cz(r.zHorni, 0) + ' nad podlahou', 20, 'l', 0, MODRA);
    }
    const n = Math.ceil(L.delka / Math.max(200, DN.cislo(L.desW, 2500) - 2 * DN.cislo(L.orez, 10)));
    if (n > 1) for (const r of R.rady) for (let i = 1; i < n; i++) S.L([[L.delka * i / n, r.zSpodni - 15], [L.delka * i / n, r.zHorni + 15]], 1, CERV, 'c');
    for (const v of R.vruty) { S.L([[v.x - 8, v.z], [v.x + 8, v.z]], 1.2, '#333333'); S.L([[v.x, v.z - 8], [v.x, v.z + 8]], 1.2, '#333333'); }
    for (const u of R.umisteni) {
      S.R(u.x0, u.zD, u.x1, u.zH, 1, ZEL, null, 'rgba(44,138,74,0.35)');
      S.T((u.x0 + u.x1) / 2, u.zH + 8, (u.q + 1) + '. ' + u.G.nazev, 18, 'c', 0, '#1e5e33');
    }
    S.kota([0, zMin], [L.delka, zMin], -30, cz(L.delka, 0) + ' mm', 24);
    if (R.rady.length > 1) S.kota([0, R.rady[1].zHorni], [0, R.rady[0].zHorni], 40, 'rozteč ' + cz(L.roztec, 0), 20);
    if (R.vruty.length > 1 && R.vruty[1].r === 0) S.kota([R.vruty[0].x, R.rady[0].zHorni], [R.vruty[1].x, R.rady[0].zHorni], 25, cz(R.vruty[1].x - R.vruty[0].x, 0), 18);
    return uzavri(S, 20);
  }
  function scenaRezPlan(RP, iDesky) {
    const L = RP.L, D = RP.desky[iDesky || 0], S = nova('Řezný plán – deska ' + ((iDesky || 0) + 1) + '/' + RP.desky.length);
    const W = DN.cislo(L.desW, 2500), H = DN.cislo(L.desH, 1250);
    S.R(0, 0, W, H, 1, '#000000', null, '#f3e7d2');
    if (D) D.pasy.forEach((p, i) => {
      const y0 = H - p.y - L.sirkaPasu, y1 = H - p.y, ym = (y0 + y1) / 2;
      S.R(L.orez, y0, L.orez + p.delka, y1, 0.8, '#000000', null, DREVO);
      S.L([[L.orez, ym], [W - L.orez, ym]], 1.2, CERV, 'c');
      for (const [dr, z0, z1] of [[p.A, ym, y1], [p.B, y0, ym]]) {
        if (!dr) { S.T(L.orez + 20, (z0 + z1) / 2 - 10, 'zbytek (volná lišta)', 22, 'l', 0, SEDA); continue; }
        for (const k of dr.kusy) {
          const x = L.orez + k.x;
          S.R(x, z0 + 3, x + k.delka, z1 - 3, 0.5, '#5a4321');
          S.T(x + k.delka / 2, (z0 + z1) / 2 - 8, `${k.popis} · ${cz(k.delka, 0)}`, 20, 'c', 0, '#000000');
        }
      }
      S.T(W - L.orez - 10, ym + 8, `pás ${i + 1}: ${cz(L.sirkaPasu, 1)} mm, šikmý řez ${cz(L.uhel)}°`, 18, 'r', 0, CERV);
    });
    S.kota([0, 0], [W, 0], -40, cz(W, 0), 30);
    S.kota([W, 0], [W, H], -40, cz(H, 0), 30);
    if (D && D.pasy[0]) { const p = D.pasy[0]; S.kota([0, H - p.y - L.sirkaPasu], [0, H - p.y], 40, cz(L.sirkaPasu, 1), 22); }
    return uzavri(S, 20);
  }
  function scenaHak(H0) {
    const H = H0.telo ? H0 : DN.hak(H0), S = nova('Pegboard háček');
    const tb = H.deska, R = H.roztec;
    S.R(-tb, -R - 40, 0, 30, 0.3, '#000000', null, '#e7dcc8');
    for (const z of [0, -R]) S.R(-tb - 0.01, z - H.dira / 2, 0.01, z + H.dira / 2, 0.15, SEDA, null, '#ffffff');
    S.L(H.telo, 0.4, '#000000', null, true, 'rgba(44,138,74,0.25)');
    for (const b of H.koliky) S.L(b, 0.35, ZEL, null, true, 'rgba(44,138,74,0.4)');
    S.kota([-tb, 0], [-tb, -R], 14, cz(R), 3);
    S.kota([-tb, 22], [0, 22], 4, cz(tb), 2.6);
    S.odkaz([-tb / 2, H.dira / 2], [-tb - 18, 12], 'díra Ø' + cz(H.dira) + ', kolík ' + cz(H.s) + '×' + cz(H.s), 3);
    const xm = Math.max(...H.telo.map((q) => q[0]));
    S.kota([H.pb, H.z0 - 6], [xm, H.z0 - 6], 0, cz(xm - H.pb, 1), 3);
    return uzavri(S, 3);
  }

  /* ---------------- SVG ---------------- */
  function svgPrvek(e, X, Y, k) {
    k = k || 1;
    if (e.t === 'l') {
      const d = e.b.map((q, i) => (i ? 'L' : 'M') + r2(X(q[0])) + ' ' + r2(Y(q[1]))).join('') + (e.z ? 'Z' : '');
      const sw = Math.max(0.05, e.s) * k, das = e.d === 'c' ? ` stroke-dasharray="${r2(sw * 8)} ${r2(sw * 5)}"` : e.d === 'o' ? ` stroke-dasharray="${r2(sw * 20)} ${r2(sw * 5)} ${r2(sw * 3)} ${r2(sw * 5)}"` : '';
      return `<path d="${d}" fill="${e.f || 'none'}" stroke="${e.c}" stroke-width="${r2(sw)}"${das} stroke-linejoin="round"/>`;
    }
    if (e.t === 'k') { const sw = Math.max(0.05, e.s) * k; return `<circle cx="${r2(X(e.x))}" cy="${r2(Y(e.y))}" r="${r2(e.r * k)}" fill="${e.f || 'none'}" stroke="${e.c}" stroke-width="${r2(sw)}"${e.d === 'c' ? ` stroke-dasharray="${r2(sw * 6)} ${r2(sw * 4)}"` : ''}/>`; }
    if (e.t === 'txt') {
      const an = e.a === 'c' ? 'middle' : e.a === 'r' ? 'end' : 'start';
      return `<text x="${r2(X(e.x))}" y="${r2(Y(e.y))}" font-size="${r2(e.h * k)}" text-anchor="${an}" fill="${e.c}" font-family="Liberation Sans, Arial, sans-serif"${e.u ? ` transform="rotate(${r2(-e.u)} ${r2(X(e.x))} ${r2(Y(e.y))})"` : ''}>${esc(e.txt)}</text>`;
    }
    return '';
  }
  /** SVG v mm (viewBox = mm scény × měřítko); o: {meritko, pozadi} */
  function svg(S, o) {
    o = o || {};
    const m = o.meritko || 1, w = (S.x1 - S.x0) * m, h = (S.y1 - S.y0) * m;
    const X = (x) => (x - S.x0) * m, Y = (y) => (S.y1 - y) * m;
    const telo = S.prvky.map((e) => svgPrvek(e, X, Y, m)).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(w)}mm" height="${r2(h)}mm" viewBox="0 0 ${r2(w)} ${r2(h)}">${o.pozadi ? `<rect width="100%" height="100%" fill="${o.pozadi}"/>` : ''}<title>${esc(S.nazev || '')}</title>${telo}</svg>`;
  }

  /* ---------------- DXF (R12, mm) ---------------- */
  const ascii = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '?');
  function dxf(S) {
    const L = [], g = (c, v) => L.push(String(c), String(v));
    const n3 = (x) => (Math.round(x * 1000) / 1000).toString();
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    for (const e of S.prvky) {
      const ly = e.c === MODRA ? 'KOTY' : e.c === CERV ? 'REZY' : e.d ? 'POMOCNE' : 'OBRYS';
      if (e.t === 'l') {
        g(0, 'POLYLINE'); g(8, ly); g(66, 1); g(70, e.z ? 1 : 0);
        for (const q of e.b) { g(0, 'VERTEX'); g(8, ly); g(10, n3(q[0])); g(20, n3(q[1])); g(30, 0); }
        g(0, 'SEQEND'); g(8, ly);
      } else if (e.t === 'k') { g(0, 'CIRCLE'); g(8, ly); g(10, n3(e.x)); g(20, n3(e.y)); g(30, 0); g(40, n3(e.r)); }
      else if (e.t === 'txt') {
        const al = e.a === 'l' ? 0 : e.a === 'r' ? 2 : 1;
        g(0, 'TEXT'); g(8, 'TEXT'); g(10, n3(e.x)); g(20, n3(e.y)); g(30, 0); g(40, n3(e.h * 0.72)); g(1, ascii(e.txt));
        if (e.u) g(50, n3(e.u));
        if (al) { g(72, al); g(11, n3(e.x)); g(21, n3(e.y)); g(31, 0); }
      }
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return L.join('\r\n') + '\r\n';
  }

  /* ---------------- strany PDF ---------------- */
  const MERITKA = [1, 2, 2.5, 5, 10, 15, 20, 25, 50, 100];
  /**
   * strany(vykresy, papir, o) → [{W, H, obsah:[prvky papíru, y dolů], clip, navrch}]
   * vykres: {scena, meritko: 1 (1:1 s dělením na listy) | 'fit' | číslo (1:M), nazev, zvetseni (M:1)}
   * o: {nazev, kusovnik: [{...}], okraj, prekryv}
   */
  function strany(vykresy, papir, o) {
    o = o || {};
    const pw = papir[0], ph = papir[1], ok = DN.cislo(o.okraj, 8), prek = DN.cislo(o.prekryv, 12), PATA = 14, PAS = 9, out = [];
    const Lp = (arr, b, s, c, d) => arr.push({ t: 'l', b, s: s || 0.2, c: c || '#000000', d });
    const Tp = (arr, x, y, txt, h, a, u, c) => arr.push({ t: 'txt', x, y, txt: String(txt), h: h || 3, a: a || 'l', u: u || 0, c: c || '#000000' });
    const meritka = (st, W, H) => {
      const y = H - ok - 3, x0 = ok;
      st.navrch.push({ t: 'm', x0, y, x1: x0 + 100, osa: 'x' });
      for (let i = 0; i <= 10; i++) Lp(st.navrch, [[x0 + i * 10, y], [x0 + i * 10, y - (i % 5 ? 1.5 : 3)]], 0.2);
      Tp(st.navrch, x0, y - 3.6, '0', 2, 'c'); Tp(st.navrch, x0 + 50, y - 3.6, '50', 2, 'c'); Tp(st.navrch, x0 + 100, y - 3.6, '100 mm', 2, 'c');
      Tp(st.navrch, x0 + 106, y - 3.4, 'Kontrola tisku: úsečky musí mít přesně 50 a 100 mm', 2.2); Tp(st.navrch, x0 + 106, y - 0.6, 'vodorovně i svisle (tisk 100 %, bez přizpůsobení).', 2.2);
      const xs = W - ok - 2, ys = ok + 6;
      st.navrch.push({ t: 'm', x0: xs, y: ys, y1: ys + 100, osa: 'y' });
      for (let i = 0; i <= 10; i++) Lp(st.navrch, [[xs, ys + i * 10], [xs - (i % 5 ? 1.5 : 3), ys + i * 10]], 0.2);
      Tp(st.navrch, xs - 3.6, ys + 0.8, '0', 2, 'r'); Tp(st.navrch, xs - 3.6, ys + 50.7, '50', 2, 'r'); Tp(st.navrch, xs - 3.6, ys + 100.7, '100', 2, 'r');
    };
    const prevod = (sc, X, Y, k, arr) => {
      for (const e of sc.prvky) {
        if (e.t === 'l') arr.push({ t: 'l', b: e.b.map((q) => [X(q[0]), Y(q[1])]), s: Math.min(0.6, e.s * Math.max(k, 0.25)), c: e.c, d: e.d, z: e.z, f: e.f });
        else if (e.t === 'k') arr.push({ t: 'e', x: X(e.x), y: Y(e.y), rx: e.r * k, ry: e.r * k, s: Math.min(0.6, e.s * Math.max(k, 0.25)), c: e.c, f: e.f, d: e.d });
        else if (e.t === 'txt') arr.push({ t: 'txt', x: X(e.x), y: Y(e.y), txt: e.txt, h: Math.max(1.6, e.h * k), a: e.a, u: e.u, c: e.c });
      }
    };
    const pt = (W, H) => ({ W, H, obsah: [], navrch: [], clip: null });
    for (const v of vykresy) {
      const sc = v.scena, sw = sc.x1 - sc.x0, sh = sc.y1 - sc.y0;
      if (v.meritko === 1) {
        // 1:1 – dělení na listy s přesahem
        const orient = sw > sh ? [Math.max(pw, ph), Math.min(pw, ph)] : [Math.min(pw, ph), Math.max(pw, ph)];
        const W = orient[0], H = orient[1], uw = W - 2 * ok - PAS, uh = H - 2 * ok - PATA;
        const nx = sw <= uw ? 1 : Math.ceil((sw - prek) / (uw - prek)), ny = sh <= uh ? 1 : Math.ceil((sh - prek) / (uh - prek));
        for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
          const st = pt(W, H); st.typ = '1:1'; st.list = { r, c, nx, ny };
          const lx0 = sc.x0 + c * (uw - prek), ly1 = sc.y1 - r * (uh - prek);
          const X = (x) => ok + (x - lx0), Y = (y) => ok + (ly1 - y);
          st.clip = { x: ok, y: ok, w: uw, h: uh };
          prevod(sc, X, Y, 1, st.obsah);
          if (nx * ny > 1) {
            if (c < nx - 1) Lp(st.navrch, [[ok + uw - prek, ok], [ok + uw - prek, ok + uh]], 0.2, '#888888', 'c');
            if (r < ny - 1) Lp(st.navrch, [[ok, ok + uh - prek], [ok + uw, ok + uh - prek]], 0.2, '#888888', 'c');
            for (const [x, y] of [[ok, ok], [ok + uw, ok], [ok, ok + uh], [ok + uw, ok + uh]]) { Lp(st.navrch, [[x - 3, y], [x + 3, y]], 0.2); Lp(st.navrch, [[x, y - 3], [x, y + 3]], 0.2); }
            if (c > 0 || r > 0) Tp(st.navrch, ok + 4, ok - 2.4, 'ořízněte ' + (c > 0 ? 'levý' : '') + (c > 0 && r > 0 ? ' a ' : '') + (r > 0 ? 'horní' : '') + ' okraj a přiložte na čárkovanou čáru sousedního listu (přesah ' + prek + ' mm)', 2.3, 'l', 0, '#555555');
          }
          Tp(st.navrch, ok, H - ok - PATA + 4.5, `${o.nazev ? o.nazev + ' · ' : ''}${v.nazev || sc.nazev} · MĚŘÍTKO 1:1${nx * ny > 1 ? ` · list ${r * nx + c + 1}/${nx * ny} (řádek ${r + 1}, sloupec ${c + 1})` : ''}`, 2.6);
          meritka(st, W, H);
          out.push(st);
        }
      } else {
        const zv = v.zvetseni || 0;
        const vol = (W, H) => { const uw = W - 2 * ok - PAS, uh = H - 2 * ok - PATA - 6; if (zv) return { M: 1, k: 1, uw, uh }; const M = typeof v.meritko === 'number' ? v.meritko : MERITKA.find((m) => sw / m <= uw && sh / m <= uh) || Math.ceil(Math.max(sw / uw, sh / uh)); return { M, k: 1 / M, uw, uh }; };
        const a = vol(Math.min(pw, ph), Math.max(pw, ph)), b = vol(Math.max(pw, ph), Math.min(pw, ph));
        const [W, H, V] = a.M <= b.M && (a.M < b.M || sh >= sw) ? [Math.min(pw, ph), Math.max(pw, ph), a] : [Math.max(pw, ph), Math.min(pw, ph), b];
        const st = pt(W, H); st.typ = 'meritko'; st.meritko = V.M;
        const k = V.k, X = (x) => ok + (V.uw - sw * k) / 2 + (x - sc.x0) * k, Y = (y) => ok + 7 + (sc.y1 - y) * k;
        prevod(sc, X, Y, k, st.obsah);
        Tp(st.navrch, ok, ok + 4, `${v.nazev || sc.nazev}${zv ? ` · MĚŘÍTKO ${zv}:1 (detail)` : V.M === 1 ? ' · MĚŘÍTKO 1:1' : ` · MĚŘÍTKO 1:${V.M} – kóty v mm`}`, 3.4);
        if (o.nazev) Tp(st.navrch, ok, H - ok - PATA + 4.5, o.nazev, 2.6);
        meritka(st, W, H);
        out.push(st);
      }
    }
    if (o.kusovnik && o.kusovnik.length) {
      const W = Math.min(pw, ph), H = Math.max(pw, ph);
      let st = null, y = 0;
      const novaS = () => { st = pt(W, H); st.typ = 'text'; out.push(st); y = ok + 6; meritka(st, W, H); };
      const radek = (txt, h, c, x) => { if (!st || y > H - ok - PATA - 6) novaS(); Tp(st.navrch, ok + (x || 0), y, txt, h || 3, 'l', 0, c); y += (h || 3) * 1.5; };
      const odst = (txt, h, x) => { const max = Math.floor((W - 2 * ok - PAS - (x || 0)) / ((h || 3) * 0.5)); let r = ''; for (const s of String(txt).split(' ')) { if ((r + ' ' + s).length > max) { radek(r, h, null, x); r = s; } else r = r ? r + ' ' + s : s; } if (r) radek(r, h, null, x); };
      novaS();
      radek((o.nazev || 'Držáky nářadí') + ' – kusovník', 5); y += 2;
      let sk = '';
      for (const q of o.kusovnik) {
        if (q.skupina !== sk) { y += 1.5; radek(q.skupina, 3.6, '#1f5fa8'); sk = q.skupina; }
        radek(`${q.mnozstvi} ${q.jednotka}  ·  ${q.polozka}`, 2.9);
        if (q.pozn) odst(q.pozn, 2.4, 6);
        y += 1.2;
      }
      y += 4;
      if (y > H - ok - PATA - 64) novaS();
      radek('Kontrolní čtverec 50 × 50 mm', 3);
      st.navrch.push({ t: 'r', x: ok, y, w: 50, h: 50, s: 0.25, c: '#000000' });
      Tp(st.navrch, ok + 25, y + 26, '50 × 50 mm', 3.4, 'c');
      y += 56;
      if (o.poznamky) for (const p of o.poznamky) odst(p, 2.6);
    }
    return out;
  }

  /* ---------------- PDF ---------------- */
  const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/[„“]/g, '"').replace(/°/g, ' st.').replace(/Ø/g, 'O').replace(/×/g, 'x').replace(/[^\x20-\x7e]/g, '?');
  const zLiberation = (s) => String(s).replace(/[⌀]/g, 'Ø').replace(/[✂]/g, '').replace(/[″]/g, '"');
  function rgb(c) {
    const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || '');
    if (m) return [+m[1], +m[2], +m[3]];
    const v = parseInt(String(c || '#000000').slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  /** výplň s průhledností → světlejší plná barva (jsPDF bez GState) */
  function vypln(c) {
    const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(c || '');
    if (!m) return rgb(c);
    const a = +m[4]; return [+m[1], +m[2], +m[3]].map((x) => Math.round(255 - (255 - x) * a));
  }
  function pdf(jsPDF, str, o) {
    o = Object.assign({ compress: true }, o || {});
    let doc = null, uni = false;
    const T = (s) => (uni ? zLiberation(s) : bezDiakritiky(s));
    for (const st of str) {
      const orient = st.W > st.H ? 'l' : 'p';
      if (!doc) {
        doc = new jsPDF({ unit: 'mm', format: [st.W, st.H], orientation: orient, compress: o.compress });
        if (o.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
        doc.setProperties({ title: o.nazev || 'Držáky nářadí', creator: 'Držáky nářadí a Gridfinity' });
      } else doc.addPage([st.W, st.H], orient);
      const kresli = (e) => {
        const c = rgb(e.c); doc.setDrawColor(...c);
        if (e.t === 'l') {
          doc.setLineWidth(Math.max(0.05, e.s || 0.2));
          const s = Math.max(0.12, e.s || 0.2);
          if (e.d === 'c') doc.setLineDashPattern([s * 8, s * 5], 0); else if (e.d === 'o') doc.setLineDashPattern([s * 20, s * 5, s * 3, s * 5], 0);
          const styl = e.f ? (e.s <= 0.02 ? 'F' : 'FD') : 'S';
          if (e.f) doc.setFillColor(...vypln(e.f));
          if (e.b.length === 2 && !e.z && !e.f) doc.line(e.b[0][0], e.b[0][1], e.b[1][0], e.b[1][1]);
          else { const seg = []; for (let i = 1; i < e.b.length; i++) seg.push([e.b[i][0] - e.b[i - 1][0], e.b[i][1] - e.b[i - 1][1]]); doc.lines(seg, e.b[0][0], e.b[0][1], [1, 1], styl, !!e.z); }
          if (e.d) doc.setLineDashPattern([], 0);
        } else if (e.t === 'e') {
          doc.setLineWidth(Math.max(0.05, e.s || 0.2));
          if (e.d === 'c') doc.setLineDashPattern([1.5, 1], 0);
          if (e.f) doc.setFillColor(...vypln(e.f));
          doc.ellipse(e.x, e.y, e.rx, e.ry, e.f ? 'FD' : 'S');
          if (e.d) doc.setLineDashPattern([], 0);
        } else if (e.t === 'r') { doc.setLineWidth(Math.max(0.05, e.s || 0.2)); doc.rect(e.x, e.y, e.w, e.h, 'S'); }
        else if (e.t === 'm') { doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3); if (e.osa === 'x') doc.line(e.x0, e.y, e.x1, e.y); else doc.line(e.x0, e.y, e.x0, e.y1); }
        else if (e.t === 'txt') {
          if (uni) doc.setFont('LS', 'normal'); else doc.setFont('helvetica', 'normal');
          doc.setFontSize(e.h / 0.3528); doc.setTextColor(...c);
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

  /** CSV kusovníku (středník, UTF-8) */
  function csv(rows) {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    return ['skupina;polozka;mnozstvi;jednotka;poznamka'].concat(rows.map((r) => [q(r.skupina), q(r.polozka), r.mnozstvi, q(r.jednotka), q(r.pozn)].join(';'))).join('\r\n') + '\r\n';
  }

  const API = { nova, uzavri, scenaPodlozka, scenaKrabicka, scenaKapsy11, scenaLicovani, rezKrabicky, scenaProfilListy, scenaDrzak, scenaStena, scenaRezPlan, scenaHak,
    svg, svgPrvek, dxf, strany, pdf, csv, bezDiakritiky, MERITKA };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.DNV = API;
})(typeof window !== 'undefined' ? window : globalThis);

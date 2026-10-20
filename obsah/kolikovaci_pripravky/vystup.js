/* ============================================================
   Kolíkovací a kapsové přípravky – výstupy bez DOM: technické pohledy s kótami, papírové šablony 1:1,
   SVG, DXF, strany PDF a PDF (jsPDF parametrem).
   Scéna: {prvky, x0, y0, x1, y1, nazev} v mm, y nahoru.
   prvek: {t:'l', b:[[x,y]..], s, c, d:'c'|'o', z, f (výplň)} | {t:'k', x, y, r, s, c, f, d} | {t:'txt', x, y, h, txt, a, u, c}
   ============================================================ */
(function (koren) {
  'use strict';
  const KP = koren.KP || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const cz = KP.cz, r2 = KP.r2;
  const n3 = (x) => (Math.round(x * 1000) / 1000).toString();
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const B = { drevoA: '#ecd3a4', drevoB: '#d6b27c', pripravek: '#a9d8b8', kov: '#b9c0c8', kolik: '#c7965a', kota: '#1f5fa8', cerv: '#b3261e', seda: '#777777', dira: '#ffffff', kapsa: '#fff7e6' };
  const RAD = Math.PI / 180;

  /* ---------------- stavebnice scény ---------------- */
  function Scena(nazev) {
    const pr = [];
    const s = {
      pr, nazev,
      L: (b, w, c, d, z, f, v) => pr.push({ t: 'l', b, s: w == null ? 0.25 : w, c: c || '#000000', d, z, f, v }),
      P: (b, f, w, c, v) => pr.push({ t: 'l', b, s: w == null ? 0.3 : w, c: c || '#000000', z: true, f, v }),
      R: (x0, y0, x1, y1, f, w, c, d, v) => pr.push({ t: 'l', b: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], s: w == null ? 0.3 : w, c: c || '#000000', z: true, f, d, v }),
      K: (x, y, r, w, c, f, d, v) => pr.push({ t: 'k', x, y, r, s: w == null ? 0.25 : w, c: c || '#000000', f, d, v }),
      T: (x, y, txt, h, a, u, c, v) => pr.push({ t: 'txt', x, y, txt: String(txt), h: h || 2.5, a: a || 'l', u: u || 0, c: c || '#000000', v }),
      /** kóta mezi body a, b; off = odsazení kolmo (kladné vlevo od směru a→b) */
      kota(a, b, off, txt, o) {
        o = o || {};
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
        const A = [a[0] + nx * off, a[1] + ny * off], Bb = [b[0] + nx * off, b[1] + ny * off], c = o.c || B.kota, h = o.h || 2.4;
        const pres = Math.sign(off || 1) * 1.5;
        if (!o.bezVynasecek) { s.L([a, [A[0] + nx * pres, A[1] + ny * pres]], 0.13, c, null, false, null, 'kota'); s.L([b, [Bb[0] + nx * pres, Bb[1] + ny * pres]], 0.13, c, null, false, null, 'kota'); }
        s.L([A, Bb], 0.18, c, null, false, null, 'kota');
        const sip = (p, sm) => s.P([p, [p[0] + sm * ux * 2.2 + nx * 0.7, p[1] + sm * uy * 2.2 + ny * 0.7], [p[0] + sm * ux * 2.2 - nx * 0.7, p[1] + sm * uy * 2.2 - ny * 0.7]], c, 0.05, c, 'kota');
        if (L > 5) { sip(A, 1); sip(Bb, -1); } else { sip(A, -1); sip(Bb, 1); }
        let u = Math.atan2(uy, ux) / RAD;
        if (u > 90.01) u -= 180; if (u < -89.99) u += 180;
        const m = [(A[0] + Bb[0]) / 2 + nx * (h * 0.35) * Math.sign(off || 1), (A[1] + Bb[1]) / 2 + ny * (h * 0.35) * Math.sign(off || 1)];
        const tt = txt == null ? cz(L) : txt;
        if (L < tt.length * h * 0.55 + 3 && !o.uvnitr) {
          // text vedle kóty
          s.T(Bb[0] + ux * 2 + nx * (Math.sign(off || 1) * h * 0.3), Bb[1] + uy * 2 + ny * (Math.sign(off || 1) * h * 0.3) - (Math.abs(uy) < 0.5 ? h * 0.35 : 0), tt, h, Math.abs(uy) < 0.5 ? 'l' : 'c', Math.abs(uy) < 0.5 ? 0 : u, c, 'kota');
        } else s.T(m[0] + (Math.abs(ny) > 0.5 ? 0 : 0), m[1] - (off < 0 && Math.abs(uy) < 0.5 ? h * 0.7 : 0), tt, h, 'c', u, c, 'kota');
      },
      hotovo(okraj) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        const pt = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
        for (const e of pr) {
          if (e.t === 'l') for (const q of e.b) pt(q[0], q[1]);
          else if (e.t === 'k') { pt(e.x - e.r, e.y - e.r); pt(e.x + e.r, e.y + e.r); }
          else if (e.t === 'txt' && Math.abs(e.u) > 45) { const w = e.txt.length * e.h * 0.55, f = e.a === 'c' ? 0.5 : 1; pt(e.x - e.h, e.y - w * f); pt(e.x + e.h * 0.4, e.y + w * f); }
          else if (e.t === 'txt') { const w = e.txt.length * e.h * 0.55; pt(e.x - (e.a === 'r' ? w : e.a === 'c' ? w / 2 : 0), e.y - e.h * 0.4); pt(e.x + (e.a === 'l' ? w : e.a === 'c' ? w / 2 : 0), e.y + e.h); }
        }
        const m = okraj == null ? 3 : okraj;
        if (!isFinite(x0)) { x0 = y0 = 0; x1 = y1 = 10; }
        return { prvky: pr, x0: x0 - m, y0: y0 - m, x1: x1 + m, y1: y1 + m, nazev };
      },
    };
    return s;
  }
  /** ořez konvexního polygonu obdélníkem (Sutherland–Hodgman) */
  function orez(poly, x0, y0, x1, y1) {
    let out = poly;
    const hrany = [[(p) => p[0] >= x0, (a, b) => [x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0])]], [(p) => p[0] <= x1, (a, b) => [x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0])]],
      [(p) => p[1] >= y0, (a, b) => [a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0]], [(p) => p[1] <= y1, (a, b) => [a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1]]];
    for (const [uvnitr, prusek] of hrany) {
      const vst = out; out = [];
      for (let i = 0; i < vst.length; i++) {
        const a = vst[i], b = vst[(i + 1) % vst.length];
        if (uvnitr(b)) { if (!uvnitr(a)) out.push(prusek(a, b)); out.push(b); } else if (uvnitr(a)) out.push(prusek(a, b));
      }
      if (!out.length) break;
    }
    return out;
  }
  /** obdélník podél osy: od bodu a ve směru d délky L, šířky w */
  function pas(a, d, L, w) { const n = [-d[1], d[0]], h = w / 2; return [[a[0] + n[0] * h, a[1] + n[1] * h], [a[0] + d[0] * L + n[0] * h, a[1] + d[1] * L + n[1] * h], [a[0] + d[0] * L - n[0] * h, a[1] + d[1] * L - n[1] * h], [a[0] - n[0] * h, a[1] - n[1] * h]]; }
  /** vrták: hrot v bodě a, tělo proti směru d (d míří do materiálu) */
  function vrtak(s, a, d, Ld, w, krouzek) {
    const b = [-d[0], -d[1]];
    const spic = [[a[0] + b[0] * w * 0.35 - d[1] * w / 2, a[1] + b[1] * w * 0.35 + d[0] * w / 2], a, [a[0] + b[0] * w * 0.35 + d[1] * w / 2, a[1] + b[1] * w * 0.35 - d[0] * w / 2]];
    s.P([spic[0], spic[1], spic[2], [spic[2][0] + b[0] * (Ld - w * 0.35), spic[2][1] + b[1] * (Ld - w * 0.35)], [spic[0][0] + b[0] * (Ld - w * 0.35), spic[0][1] + b[1] * (Ld - w * 0.35)]], B.kov, 0.25, '#333333', 'vrtak');
    if (krouzek) s.P(pas([a[0] + b[0] * krouzek.od, a[1] + b[1] * krouzek.od], b, krouzek.v, krouzek.D), '#4f7fbf', 0.25, '#1a3a66', 'krouzek');
  }

  /* ---------------- řez spojem (kolík / konfirmát / excentr) ---------------- */
  function rezSpoje(R, P) {
    const s = Scena('Řez spojem');
    const J = Object.assign({}, KP.vychoziProjekt().pripravek, P.pripravek || {});
    const pA = R.pripravky[0], tA = R.spoj.tA, vA = R.vA, hA = R.hA, Hv = pA.Hv, dA = R.dA;
    // --- levý panel: vrtání A (vodorovně z dílu, svisle −y) ---
    const ox = 0, hl = Math.min(80, Math.max(hA + 25, (R.prvek.odHrany || 0) + 25));
    s.R(ox, -hl, ox + tA, 0, B.drevoA, 0.35, '#000000', null, 'dil');
    s.T(ox + tA / 2, -hl - 4, 'díl A (řez)', 2.6, 'c');
    // díra
    s.R(ox + vA - dA / 2, -hA, ox + vA + dA / 2, 0, B.dira, 0.25);
    if (R.rezim === 'excentr') {
      const k = R.prvek, y = -k.odHrany;
      s.R(ox + tA - k.hloubka, y - k.d / 2, ox + tA, y + k.d / 2, B.dira, 0.25);
      s.kota([ox + tA, 0], [ox + tA, y], -(tA + 10), 'excentr ' + cz(k.odHrany));
      s.kota([ox + tA - k.hloubka, y - k.d / 2 - 3], [ox + tA, y - k.d / 2 - 3], -3, cz(k.hloubka));
    }
    // přípravek (řez profilem)
    const U = pA.profil === 'U', zL = U ? -pA.sevreni / 2 : 0, zR = U ? tA + pA.sevreni / 2 : Math.max(vA + pA.otvor.d / 2 + pA.stena, Math.min(tA, vA + pA.otvor.d / 2 + pA.stena + 4));
    const zOut = zR + (U || pA.kridlo ? (pA.kridlo ? Math.max(pA.stena, pA.kridlo.tl) : pA.stena) : 0), ro = pA.otvor.d / 2;
    const yK = pA.kridlo ? pA.kridlo.y + pA.kridlo.d / 2 + 8 : pA.hc;
    // levá část desky + líc
    s.P([[zL - pA.stena, -pA.hc], [zL, -pA.hc], [zL, 0], [vA - ro, 0], [vA - ro, Hv], [zL - pA.stena, Hv]].map((q) => [ox + q[0], q[1]]), B.pripravek, 0.3, '#1d5c33', 'pripravek');
    const pravy = [[vA + ro, 0], [U ? zR : zOut, 0]];
    if (U) pravy.push([zR, -Math.max(pA.hc, yK)], [zOut, -Math.max(pA.hc, yK)]);
    pravy.push([zOut, Hv], [vA + ro, Hv]);
    s.P(pravy.map((q) => [ox + q[0], q[1]]), B.pripravek, 0.3, '#1d5c33', 'pripravek');
    if (pA.otvor.pouzdro) { const D = pA.otvor.pouzdro.vnejsi / 2; s.R(ox + vA - D, 0, ox + vA - ro, Hv, B.kov, 0.2); s.R(ox + vA + ro, 0, ox + vA + D, Hv, B.kov, 0.2); }
    if (pA.kridlo) { const k = R.prvek; s.R(ox + zR, -k.odHrany - pA.kridlo.d / 2 - 0.2, ox + zOut, -k.odHrany + pA.kridlo.d / 2 + 0.2, '#ffffff', 0.2, '#1d5c33'); }
    // vrták s kroužkem
    const k = R.krouzky[0], Dk = Math.max(k.sedlo + 8, (k.opora || 0) + 5, 14);
    vrtak(s, [ox + vA, -hA], [0, -1], hA + Hv + 40, dA, { od: hA + Hv, v: +J.krouzekV || 10, D: Dk });
    s.L([[ox + vA, -hA - 6], [ox + vA, Hv + 46]], 0.15, B.cerv, 'o');
    // kóty
    s.kota([ox, -hl], [ox + vA, -hl], -7, cz(vA) + (U ? ' (střed)' : ' od líce'));
    s.kota([ox, -hl], [ox + tA, -hl], -13, 'tl. ' + cz(tA));
    s.kota([ox + vA + dA / 2, 0], [ox + vA + dA / 2, -hA], -(tA - vA + 10), 'hl. ' + cz(hA));
    s.kota([ox + zL - pA.stena, 0], [ox + zL - pA.stena, Hv], 6, cz(Hv));
    s.kota([ox + vA - dA / 2, -hA], [ox + vA - dA / 2, Hv], (vA + 14), 'kroužek ' + cz(hA + Hv));
    s.T(ox + zOut + 2, Hv + 3, 'přípravek ' + pA.id + (U ? ' (samostředicí U)' : ' (doraz od líce)'), 2.4, 'l', 0, '#1d5c33');
    s.T(ox + vA + 3, Hv + 30, 'vrták Ø ' + cz(dA), 2.4);
    s.T(ox + vA - Dk / 2 - 2, hA + Hv - hA + (+J.krouzekV || 10) / 2, 'kroužek', 2.4, 'r', 0, '#1a3a66');
    // --- pravý panel: spoj po složení (rám sestavy: vodorovně y, svisle z) ---
    const px = tA + 70;
    const q0 = R.diryA[0], r0 = R.diryB.find((q) => q.i === q0.i);
    const pw = KP.pouzij(R.sestava.A, q0.p), na = KP.smer(R.sestava.A, q0.n), nb = KP.smer(R.sestava.B, r0.n);
    const rozm = R.rozmery;
    const box = (T, D) => { const c = [[0, 0, 0], [D[0], D[1], D[2]]].map((p) => KP.pouzij(T, p)); return [Math.min(c[0][1], c[1][1]), Math.min(c[0][2], c[1][2]), Math.max(c[0][1], c[1][1]), Math.max(c[0][2], c[1][2])]; };
    const lim = (b, c) => { // omezit délku dílů na okolí spoje
      const L = 70; return [Math.max(b[0], c[0] - L), Math.max(b[1], c[1] - L), Math.min(b[2], c[0] + L), Math.min(b[3], c[1] + L)];
    };
    const Y0 = pw[1], Z0 = pw[2];
    const bA = lim(box(R.sestava.A, rozm.A), [Y0, Z0]), bB = lim(box(R.sestava.B, rozm.B), [Y0, Z0]);
    const X = (y) => px + (y - bB[0] + 5), Yv = (z) => z;
    s.R(X(bB[0]), Yv(bB[1]), X(bB[2]), Yv(bB[3]), B.drevoB, 0.35, '#000000', null, 'dil');
    s.R(X(bA[0]), Yv(bA[1]), X(bA[2]), Yv(bA[3]), B.drevoA, 0.35, '#000000', null, 'dil');
    const dira = (p, n, d, h) => { const a = [X(p[1]), Yv(p[2])], dd = [n[1], n[2]]; s.P(pas(a, dd, h, d), B.dira, 0.2); };
    dira(pw, na, R.dA, R.hA);
    const pb = KP.pouzij(R.sestava.B, r0.p);
    dira(pb, nb, R.dB, R.hB);
    const Pr = Object.assign({}, KP.PRAVIDLA, P.pravidla || {});
    if (R.rezim === 'kolik') {
      const L = R.delka, inA = Math.min(R.hA - Pr.vuleDno, L - 1), a0 = [X(pw[1]) + na[1] * inA, Yv(pw[2]) + na[2] * inA];
      s.P(pas(a0, [-na[1], -na[2]], L, R.dA - 0.4), B.kolik, 0.25, '#5a3a14', 'kolik');
      s.kota([X(pw[1]) + na[1] * inA + nb[2] * 0, Yv(pw[2]) + na[2] * inA], [X(pw[1]) + na[1] * (inA - L), Yv(pw[2]) + na[2] * (inA - L)], R.dA / 2 + 16, 'kolík ' + R.dA + '×' + L);
      s.kota([X(pw[1]), Yv(pw[2])], [X(pw[1]) + na[1] * R.hA, Yv(pw[2]) + na[2] * R.hA], R.dA / 2 + 6, cz(R.hA));
      s.kota([X(pb[1]), Yv(pb[2])], [X(pb[1]) + nb[1] * R.hB, Yv(pb[2]) + nb[2] * R.hB], -(R.dB / 2 + 6), cz(R.hB));
    } else if (R.rezim === 'konfirmat') {
      // šroub z vnější strany B
      const vnejsi = [X(pb[1]) + nb[1] * R.hB, Yv(pb[2]) + nb[2] * R.hB], d = [-nb[1], -nb[2]];
      s.P(pas(vnejsi, d, R.hB + R.hA - 2, R.dA), B.kov, 0.25, '#333333', 'sroub');
      s.P(pas([vnejsi[0] - d[0] * 0.01, vnejsi[1] - d[1] * 0.01], d, 4, R.prvek.hlava), B.kov, 0.25, '#333333', 'sroub');
      s.kota(vnejsi, [vnejsi[0] + d[0] * R.delka, vnejsi[1] + d[1] * R.delka], R.prvek.hlava / 2 + 6, 'konfirmát ' + R.prvek.d + '×' + R.delka);
    } else if (R.rezim === 'excentr') {
      const c = R.diryAplocha[0], cw = KP.pouzij(R.sestava.A, c.p), cn = KP.smer(R.sestava.A, c.n);
      s.P(pas([X(cw[1]), Yv(cw[2])], [cn[1], cn[2]], c.hl, c.d), B.kov, 0.25, '#333333', 'excentr');
      const a0 = [X(pb[1]) + nb[1] * R.hB, Yv(pb[2]) + nb[2] * R.hB];
      s.P(pas(a0, [-nb[1], -nb[2]], R.hB + R.prvek.odHrany, R.dB), '#9aa3ad', 0.25, '#333333', 'cep');
      s.T(X(cw[1]) + 10, Yv(cw[2]), 'excentr Ø ' + R.prvek.d, 2.4);
    }
    s.T(X(bA[0]) + 2, Yv(bA[3]) + 3, 'A', 3.4);
    s.T(X(bB[2]) - 4, Yv(bB[1]) - 5, 'B', 3.4);
    s.T(px + 5, Math.min(bA[1], bB[1]) - 12, 'spoj po složení (řez osou ' + (R.diryA.length > 1 ? 'prvního ' : '') + 'prvku)', 2.6);
    return s.hotovo();
  }

  /* ---------------- pohled na přípravek (shora) s kótami ---------------- */
  function pohledPripravku(p) {
    const s = Scena(p.nazev);
    let oy = 0;
    p.casti.forEach((c, i) => {
      if (p.druh === 'hrana') {
        const U = p.profil === 'U', t = p.t, zL = U ? -p.sevreni / 2 : 0;
        const rMax = Math.max(...c.otvory.map((o) => o.otvor / 2));
        const zR = U ? t + p.sevreni / 2 : Math.max(p.v + rMax + p.stena, Math.min(t, p.v + rMax + p.stena + 4));
        const zOut = zR + (U || p.kridlo ? (p.kridlo ? Math.max(p.stena, p.kridlo.tl) : p.stena) : 0);
        const Y = (z) => oy + z;   // pohled z vnější strany desky: líc dole
        s.R(c.x0, Y(zOut), c.x1, Y(zL - p.stena), B.pripravek, 0.35, '#1d5c33', null, 'obrys');
        s.L([[c.x0, Y(zL)], [c.x1, Y(zL)]], 0.18, '#1d5c33', 'c');
        if (U) s.L([[c.x0, Y(zR)], [c.x1, Y(zR)]], 0.18, '#1d5c33', 'c');
        if (c.doraz) {
          const xa = p.smerX > 0 ? c.x0 - p.s : c.x1, xb = p.smerX > 0 ? c.x0 : c.x1 + p.s;
          s.R(xa, Y(zOut), xb, Y(zL - p.stena), '#7fbf95', 0.35, '#1d5c33');
          s.T((xa + xb) / 2 + 0.8, Y((zL + zOut) / 2), 'DORAZ', 2, 'c', 90, '#1d5c33');
        }
        for (const o of c.otvory) {
          const idx = c.index.some((x) => Math.abs(x - o.x) < 1e-6);
          s.K(o.x, Y(o.z), o.otvor / 2, 0.3, idx ? B.cerv : '#000000', false);
          s.L([[o.x - o.otvor / 2 - 2, Y(o.z)], [o.x + o.otvor / 2 + 2, Y(o.z)]], 0.13); s.L([[o.x, Y(o.z) - o.otvor / 2 - 2], [o.x, Y(o.z) + o.otvor / 2 + 2]], 0.13);
          if (idx) s.T(o.x, Y(zOut) + 2.2, 'INDEX', 2, 'c', 0, B.cerv);
        }
        // kóty od dorazu (pořadnice) a rozteče
        const ref = p.smerX > 0 ? (c.doraz ? c.x0 : null) : (c.doraz ? c.x1 : null);
        const xs = c.otvory.map((o) => o.x).sort((a, b) => a - b);
        const yk = Y(zL - p.stena);
        const sg = (a, b) => (b >= a ? -1 : 1);
        if (ref != null) xs.forEach((x, j) => s.kota([ref, yk], [x, yk], sg(ref, x) * (5 + j * 5), cz(Math.abs(x - ref))));
        else if (c.index.length) xs.forEach((x, j) => { if (Math.abs(x - c.index[0]) > 1e-6) s.kota([c.index[0], yk], [x, yk], sg(c.index[0], x) * (5 + j * 5), cz(Math.abs(x - c.index[0]))); });
        for (let j = 1; j < xs.length; j++) s.kota([xs[j - 1], Y(zOut)], [xs[j], Y(zOut)], 5, cz(xs[j] - xs[j - 1]));
        const xo = Math.max(...xs);
        s.kota([c.x1 + (p.smerX < 0 && c.doraz ? p.s : 0) + 3, Y(0)], [c.x1 + (p.smerX < 0 && c.doraz ? p.s : 0) + 3, Y(c.otvory[0].z)], -4, cz(c.otvory[0].z) + (U ? ' = ½ tl.' : ' od líce'));
        void xo;
        s.T(c.x0, Y(zOut) + (xs.length > 1 ? 12 : 5), `${p.id}${p.casti.length > 1 ? '-' + (i + 1) : ''}  ${U ? 'U pro tl. ' + cz(t) + ' (+' + cz(p.sevreni, 2) + ')' : 'L – doraz od líce'} · otvory ${cz(c.otvory[0].otvor, 2)}${p.otvor.pouzdro ? ' pro pouzdro' : ''} · vedení ${cz(p.Hv)}`, 2.5);
        s.T(c.x0 + 1, Y(zL) + 1, 'líc dílu', 2, 'l', 0, B.seda);
        oy -= (zOut - zL + p.stena) + 30 + xs.length * 5;
      } else {
        const Y = (y) => oy - y;
        if (p.yPas > 0) { s.R(c.x0, Y(p.y1), c.x1, Y(p.yPas), B.pripravek, 0.35, '#1d5c33'); for (const [a, b] of zebra(p, c)) s.R(a, Y(p.yPas), b, Y(0), B.pripravek, 0.35, '#1d5c33'); }
        else s.R(c.x0, Y(p.y1), c.x1, Y(0), B.pripravek, 0.35, '#1d5c33');
        s.R(c.x0 - (c.doraz ? p.s : 0), Y(0), c.x1, Y(-p.s), '#7fbf95', 0.3, '#1d5c33');
        if (c.doraz) s.R(c.x0 - p.s, Y(p.y1), c.x0, Y(0), '#7fbf95', 0.3, '#1d5c33');
        s.T((c.x0 + c.x1) / 2, Y(-p.s) - 3.5, 'DORAZ – čelo dílu B', 2.2, 'c', 0, '#1d5c33');
        for (const o of c.otvory) {
          const idx = c.index.some((x) => Math.abs(x - o.x) < 1e-6);
          s.K(o.x, Y(o.y), o.otvor / 2, 0.3, idx ? B.cerv : '#000000');
          s.L([[o.x - o.otvor / 2 - 2, Y(o.y)], [o.x + o.otvor / 2 + 2, Y(o.y)]], 0.13); s.L([[o.x, Y(o.y) - o.otvor / 2 - 2], [o.x, Y(o.y) + o.otvor / 2 + 2]], 0.13);
        }
        const xs = [...new Set(c.otvory.map((o) => o.x))].sort((a, b) => a - b);
        if (c.doraz) xs.forEach((x, j) => s.kota([c.x0, Y(p.y1)], [x, Y(p.y1)], -(5 + j * 5), cz(x)));
        for (let j = 1; j < xs.length; j++) s.kota([xs[j - 1], Y(-p.s)], [xs[j], Y(-p.s)], 4, cz(xs[j] - xs[j - 1]));
        s.kota([c.x1 + 3, Y(0)], [c.x1 + 3, Y(c.otvory[0].y)], -4, cz(c.otvory[0].y) + ' od čela');
        s.T(c.x0, Y(-p.s) + (xs.length > 1 ? 11 : 4), `${p.id}${p.casti.length > 1 ? '-' + (i + 1) : ''}  deska ${cz(p.Hv)} mm · otvory ${cz(c.otvory[0].otvor, 2)}${p.pruchozi ? ' (průchozí – podložit)' : ''}`, 2.5);
        oy -= p.y1 + p.s + 26 + xs.length * 5;
      }
    });
    return s.hotovo();
  }

  /** ramena desky mezi dorazem a pásem s otvory (u T-spoje daleko od čela) */
  function zebra(p, c) { const w = Math.min(16, (c.x1 - c.x0) / 3); return [[c.x0, c.x0 + w], [c.x1 - w, c.x1]]; }

  /* ---------------- kapsa: řez vrtáním a spojem ---------------- */
  function rezKapsy(K, P) {
    const s = Scena('Řez kapsou');
    const J = Object.assign({}, KP.vychoziProjekt().pripravek, P.pripravek || {});
    const tA = K.tA, tB = K.tB, a = K.sin, c = K.cos, Dk = K.Dk;
    const xA0 = Math.min(K.pripravek.xBack - 10, -90);
    const panel = (ox, spoj) => {
      const X = (x) => x + ox;
      s.R(X(xA0), 0, X(0), tA, B.drevoA, 0.35, '#000000');
      // kapsa a pilot (ořez dílem A)
      const S0 = K.sedlo, kap = orez(pas(S0, K.b, 80, Dk), xA0, 0, 0, tA);
      if (kap.length) s.P(kap.map((q) => [X(q[0]), q[1]]), B.kapsa, 0.25, '#7a5a20');
      const pil = orez(pas(S0, K.u, spoj ? K.p + K.sS : K.Ls, K.dp), xA0, 0, 0, tA);
      if (pil.length) s.P(pil.map((q) => [X(q[0]), q[1]]), B.kapsa, 0.2, '#7a5a20');
      if (spoj) {
        if (K.typ === 'rovina') s.R(X(0), 0, X(80), tB, B.drevoB, 0.35); else s.R(X(0), -25, X(tB), tA + 25, B.drevoB, 0.35);
        // vrut
        s.P(pas(S0, K.u, K.Lv, 4).map((q) => [X(q[0]), q[1]]), B.kov, 0.25, '#333333');
        s.P(pas([S0[0] - K.u[0] * 2.5, S0[1] - K.u[1] * 2.5], K.u, 2.5, Dk - 1).map((q) => [X(q[0]), q[1]]), B.kov, 0.25, '#333333');
        const hr = K.hrot;
        s.K(X(hr[0]), hr[1], 0.6, 0, B.cerv, true);
        if (K.typ === 'rovina') s.kota([X(hr[0]), hr[1]], [X(hr[0]), 0], -6, 'rezerva ' + cz(K.rezervaHrotu));
        else s.kota([X(hr[0]), hr[1]], [X(tB), hr[1]], -4, 'rezerva ' + cz(K.rezervaHrotu));
        s.kota([X(0), K.E[1]], [X(0), 0], K.typ === 'T' ? tB + 8 : 86, 'výstup ' + cz(K.E[1]) + (K.typ === 'rovina' ? ' = ½ tl. B' : ' = ½ tl. A'));
        s.kota([X(S0[0]), S0[1]], [X(hr[0]), hr[1]], 7, 'vrut ' + cz(K.Lv));
        s.T(X(xA0) + 2, tA + 3, 'spoj: A + B, vrut', 2.6);
        if (K.typ === 'rovina') s.T(X(40), tB + 3, 'protikus B (tl. ' + cz(tB) + ')', 2.4, 'c'); else s.T(X(tB) + 2, tA + 22, 'protikus B', 2.4);
      } else {
        // přípravek
        s.P(K.pripravek.profil.map((q) => [X(q[0]), q[1]]), B.pripravek, 0.3, '#1d5c33');
        const vb = orez(pas([K.G[0] + K.b[0] * 1, K.G[1] + K.b[1] * 1], K.u, K.Lg + 1, K.Rb * 2), -500, tA, 500, 500);
        if (vb.length) s.P(vb.map((q) => [X(q[0]), q[1]]), '#ffffff', 0.2, '#1d5c33');
        if (K.otvor.pouzdro) s.T(X(K.G[0]) - 4, K.G[1] + 9, 'pouzdro', 2.2, 'r', 0, '#1d5c33');
        // vrták: hrot pilotu, kroužek na horní ploše vedení
        const hp = K.hrotPilotu, kr = K.krouzky[0];
        const Dkr = Math.max(kr.sedlo + 8, (kr.opora || 0) + 5, 14);
        s.P(pas(hp, K.b, K.Ls, K.dp).map((q) => [X(q[0]), q[1]]), B.kov, 0.25, '#333333');
        s.P(pas(S0, K.b, kr.vzdalenost + 18, Dk - 0.1).map((q) => [X(q[0]), q[1]]), B.kov, 0.25, '#333333');
        s.P(pas(K.G, K.b, +J.krouzekV || 10, Dkr).map((q) => [X(q[0]), q[1]]), '#4f7fbf', 0.25, '#1a3a66');
        s.L([[X(K.E[0] + K.u[0] * 20), K.E[1] + K.u[1] * 20], [X(K.G[0] + K.b[0] * 25), K.G[1] + K.b[1] * 25]], 0.15, B.cerv, 'o');
        // kóty
        s.kota([X(0), 0], [X(0), K.E[1]], -6, cz(K.E[1]));
        s.kota([X(K.I[0]), tA], [X(0), tA], -(tA + 6), 'ústí osy ' + cz(-K.I[0]) + ' od čela');
        s.kota([X(S0[0]), S0[1]], [X(K.G[0]), K.G[1]], -(Dkr / 2 + 6), 'kroužek od stupně ' + cz(kr.vzdalenost));
        s.kota([X(K.E[0]), K.E[1]], [X(S0[0]), S0[1]], Dk / 2 + 4, cz(K.sS));
        // úhel
        const ar = [];
        for (let i = 0; i <= 12; i++) { const u = (180 - K.uhel * i / 12) * RAD; ar.push([X(K.I[0]) + 22 * Math.cos(u), tA + 22 * Math.sin(u)]); }
        s.L(ar, 0.18, B.kota); s.L([[X(K.I[0]), tA], [X(K.I[0]) - 25, tA]], 0.13, B.kota);
        s.T(X(K.I[0]) - 27, tA + 3.2, cz(K.uhel, 0) + '°', 2.6, 'r', 0, B.kota);
        s.T(X(xA0) + 2, -5, 'vrtání: díl A (tl. ' + cz(tA) + ') rubem nahoru, přípravek, stupňovitý vrták', 2.6);
      }
    };
    panel(0, false);
    const n0 = s.pr.length;
    panel(0, true);
    // spoj pod vrtáním
    const dy = -(Math.max(tA, tB) + 50);
    for (const e of s.pr.slice(n0)) { if (e.t === 'l') e.b = e.b.map((q) => [q[0], q[1] + dy]); else e.y += dy; }
    return s.hotovo();
  }
  /** kapsa: profil přípravku s rozměry (pro výkres a papírovou předlohu) */
  function profilKapsy(K, s0) {
    const s = s0 || Scena('Profil přípravku na kapsy');
    const Pj = K.pripravek, tA = K.tA;
    s.P(Pj.profil, null, 0.4, '#000000', 'obrys');
    s.L([[K.G[0] + K.b[0] * 6, K.G[1] + K.b[1] * 6], [K.E[0], K.E[1]]], 0.2, B.cerv, 'o', false, null, 'osa');
    for (const sg of [1, -1]) s.L([[K.G[0] + sg * K.Rb * K.n[0], K.G[1] + sg * K.Rb * K.n[1]], [K.I[0] + sg * K.Rb * K.n[0] + K.u[0] * 2, K.I[1] + sg * K.Rb * K.n[1] + K.u[1] * 2]], 0.2, '#333333', 'c', false, null, 'otvor');
    s.L([[Pj.xBack - 8, tA], [Pj.s + 8, tA]], 0.15, B.seda, 'c');
    s.T(Pj.xBack, tA - 4, 'rub dílu A (ploška přípravku)', 2.2, 'l', 0, B.seda);
    s.kota([Pj.xBack, tA - Pj.hd], [Pj.s, tA - Pj.hd], -8, 'délka ' + cz(Pj.delka));
    s.kota([0, tA - Pj.hd], [0, tA], 5, cz(Pj.hd));
    s.kota([Pj.Ft[0], Pj.Ft[1]], [Pj.Fb[0], Pj.Fb[1]], 5, cz(2 * K.Rw));
    s.kota([K.G[0], K.G[1]], [K.I[0], K.I[1]], K.Rw + 6, 'vedení ' + cz(K.Lg));
    s.kota([0, tA - Pj.hd], [Pj.s, tA - Pj.hd], 3.5, cz(Pj.s));
    s.T(K.G[0] - 3, K.G[1] + K.Rw + 10, `otvor Ø ${cz(K.otvor.d, 2)}${K.otvor.pouzdro ? ' (pouzdro)' : ''} pod ${cz(K.uhel, 0)}°; horní plocha ⟂ osa = opěra kroužku`, 2.4, 'l');
    s.T(Pj.xBack, Math.max(...Pj.profil.map((q) => q[1])) + 16, `šířka přípravku ${cz(Pj.sirka)} mm, vedení ve vzdálenosti ${Pj.vedeni.map((v) => cz(v)).join(' a ')} mm od boku`, 2.4);
    return s.hotovo();
  }
  /** kapsa: pohled na rub dílu A – polohy kapes */
  function rubKapsy(K) {
    const s = Scena('Rub dílu A – kapsy');
    const L = Math.max(80, -K.usti.zadni + 30), W = K.sirka;
    s.R(-L, 0, 0, W, B.drevoA, 0.35);
    for (const y of K.ys) {
      const a = K.usti.zadni, b = K.usti.predni, r = K.Dk / 2;
      s.P([[a + r * 0.3, y - r], [b, y - r], [b, y + r], [a + r * 0.3, y + r], [a, y]], B.kapsa, 0.25, '#7a5a20');
      s.L([[a - 6, y], [6, y]], 0.13, B.cerv, 'o');
    }
    s.kota([K.usti.zadni, W], [0, W], 5, 'ústí kapsy ' + cz(-K.usti.zadni));
    K.ys.forEach((y, i) => s.kota([0, 0], [0, y], -(6 + 5 * i), cz(y)));
    s.T(-L, -6, `čelo dílu A vpravo · šířka ${cz(W)} · kapes ${K.ys.length}`, 2.4);
    return s.hotovo();
  }

  /* ---------------- centrovací měrka ---------------- */
  function pohledCentru(C) {
    const s = Scena('Centrovací měrky');
    let x = 0;
    for (const q of C.kusy) {
      const zl = q.delkaCepu + q.prechod, zt = zl + q.tlLimec, hh = Math.max(q.hrot, q.rHrot);
      s.P([[x - q.rCep, 0], [x + q.rCep, 0], [x + q.rCep, q.delkaCepu], [x + q.rLimec, zl], [x + q.rLimec, zt], [x + q.rHrot, zt], [x, zt + hh], [x - q.rHrot, zt], [x - q.rLimec, zt], [x - q.rLimec, zl], [x - q.rCep, q.delkaCepu]], B.pripravek, 0.3, '#1d5c33');
      s.L([[x, -3], [x, zt + hh + 3]], 0.13, B.cerv, 'o');
      s.kota([x - q.rCep, 0], [x + q.rCep, 0], -5, 'Ø ' + cz(q.rCep * 2, 2));
      s.kota([x + q.rLimec, zl], [x + q.rLimec, 0], 4, cz(zl));
      s.T(x, zt + hh + 6, 'Ø ' + q.d, 3, 'c');
      x += Math.max(2 * q.rLimec + 22, 30);
    }
    s.T(-8, -15, 'čep do vyvrtané díry, límec dosedne na plochu, hrot (nebo špendlík) označí střed na protikusu', 2.4);
    return s.hotovo();
  }

  /* ---------------- papírové šablony 1:1 ---------------- */
  /** šablona na čelo/hranu: pás šířky tl. dílu s chlopněmi přes líc, rub a konec */
  function sablonaHrana(R, P, dil) {
    const T_ = Object.assign({}, KP.vychoziProjekt().tisk, P.tisk || {}), ch = Math.max(0, +T_.chlopen || 14);
    const s = Scena('Papírová šablona ' + dil);
    const W = R.spoj.sirka, t = dil === 'A' ? R.spoj.tA : R.spoj.tB, diry = dil === 'A' ? R.diryA : R.diryB, ref = 0;
    s.R(0, 0, W, t, null, 0.3, '#000000', null, 'obrys');
    s.L([[0, -ch], [W, -ch], [W, t + ch], [0, t + ch]], 0.25, '#000000', null, false, null, 'obrys');
    s.L([[0, -ch], [-ch, -ch], [-ch, t + ch], [0, t + ch]], 0.25, '#000000', null, false, null, 'obrys');
    s.L([[0, 0], [W, 0]], 0.25, B.seda, 'c', false, null, 'ohyb'); s.L([[0, t], [W, t]], 0.25, B.seda, 'c', false, null, 'ohyb');
    s.L([[ref, -ch], [ref, t + ch]], 0.7, '#000000', null, false, null, 'hrana');
    s.T(-ch / 2, t / 2, 'KONEC DÍLU ' + dil, Math.min(2.4, ch * 0.3), 'c', 90, '#000000');
    s.T(4, -ch + 3.2, `LÍC – ohnout přes hranu · díl ${dil}, tl. ${cz(t)} mm`, 2.4);
    s.T(4, t + 3, 'RUB – ohnout přes hranu', 2.4);
    for (const q of diry) {
      const x = q.p[0], z = q.p[2];
      s.K(x, z, q.d / 2, 0.3); s.L([[x - q.d / 2 - 3, z], [x + q.d / 2 + 3, z]], 0.18); s.L([[x, z - q.d / 2 - 3], [x, z + q.d / 2 + 3]], 0.18); s.K(x, z, 0.4, 0, '#000000', true);
      s.T(x + 1, -ch + 7, cz(x), 2.2, 'l', 0, B.kota);
      s.L([[x, -ch + 5.5], [x, -2]], 0.13, B.kota);
    }
    if (dil === 'B' && R.spoj.typ === 'hrana') s.T(W / 2, t + ch - 4, 'protikus: díry jsou zrcadlově – konec B s nápisem přiložte k referenčnímu konci B', 2.2, 'c', 0, B.cerv);
    return s.hotovo(1);
  }
  /** šablona na plochu B: obdélník s chlopní přes čelo (y = 0) a boční hranu (x = 0) */
  function sablonaPlocha(R, P) {
    const T_ = Object.assign({}, KP.vychoziProjekt().tisk, P.tisk || {}), ch = Math.max(0, +T_.chlopen || 14);
    const s = Scena('Papírová šablona B');
    const W = R.spoj.sirka, ys = R.diryB.map((q) => q.p[1]), H = Math.max(...ys) + 25;
    s.R(0, 0, W, H, null, 0.3, '#000000', null, 'obrys');
    s.L([[0, 0], [0, -ch], [W, -ch], [W, 0]], 0.25, '#000000', null, false, null, 'obrys');
    s.L([[0, 0], [-ch, 0], [-ch, H], [0, H]], 0.25, '#000000', null, false, null, 'obrys');
    s.L([[0, 0], [W, 0]], 0.7, '#000000', null, false, null, 'hrana'); s.L([[0, 0], [0, H]], 0.7, '#000000', null, false, null, 'hrana');
    s.T(W / 2, -ch / 2 - 1, 'ČELO DÍLU B – chlopeň ohnout přes hranu', 2.4, 'c');
    s.T(-ch / 2 + 0.8, H / 2, 'BOČNÍ HRANA (x = 0)', 2.2, 'c', 90);
    for (const q of R.diryB) {
      const x = q.p[0], y = q.p[1];
      s.K(x, y, q.d / 2, 0.3); s.L([[x - q.d / 2 - 3, y], [x + q.d / 2 + 3, y]], 0.18); s.L([[x, y - q.d / 2 - 3], [x, y + q.d / 2 + 3]], 0.18); s.K(x, y, 0.4, 0, '#000000', true);
      s.T(x + 1.5, y + q.d / 2 + 2, `${cz(x)} / ${cz(y)}  Ø${cz(q.d)} ${q.pruchozi ? 'skrz' : 'hl. ' + cz(q.hl)}`, 2.2, 'l', 0, B.kota);
    }
    s.T(3, H - 5, `díl B – vnitřní plocha (tl. ${cz(R.spoj.tB)}), x od boční hrany, y od čela`, 2.4);
    return s.hotovo(1);
  }
  /** kapsa 1:1: profil přípravku (předloha pro dřevěný přípravek) + klín 15° */
  function sablonaKapsa(K) {
    const s = Scena('Předloha přípravku na kapsy 1:1');
    profilKapsy(K, s);
    const y0 = -40, L = 120, h = L * Math.tan(K.uhel * RAD);
    s.P([[Math.min(K.pripravek.xBack, -100), y0], [Math.min(K.pripravek.xBack, -100) + L, y0], [Math.min(K.pripravek.xBack, -100) + L, y0 + h]], null, 0.35);
    s.T(Math.min(K.pripravek.xBack, -100) + 4, y0 + 2.5, `klín ${cz(K.uhel, 0)}° (podložka pod díl na stojanové vrtačce – vrták svisle)`, 2.4);
    return s.hotovo(2);
  }

  /* ---------------- SVG / DXF ---------------- */
  function svgPrvek(e) {
    const Y = (y) => -y;
    const dash = (d, s) => (d === 'c' ? ` stroke-dasharray="${n3(s * 10)} ${n3(s * 7)}"` : d === 'o' ? ` stroke-dasharray="${n3(s * 30)} ${n3(s * 8)} ${n3(s * 4)} ${n3(s * 8)}"` : '');
    if (e.t === 'l') {
      const d = e.b.map((q, i) => (i ? 'L' : 'M') + n3(q[0]) + ' ' + n3(Y(q[1]))).join('') + (e.z ? 'Z' : '');
      return `<path d="${d}" fill="${e.f || 'none'}" stroke="${e.c}" stroke-width="${n3(Math.max(0.05, e.s))}" stroke-linejoin="round" stroke-linecap="round"${dash(e.d, Math.max(0.12, e.s))}/>`;
    }
    if (e.t === 'k') return `<circle cx="${n3(e.x)}" cy="${n3(Y(e.y))}" r="${n3(e.r)}" fill="${e.f ? e.c : 'none'}" stroke="${e.f ? 'none' : e.c}" stroke-width="${n3(Math.max(0.05, e.s))}"${dash(e.d, Math.max(0.12, e.s))}/>`;
    if (e.t === 'txt') {
      const an = e.a === 'r' ? 'end' : e.a === 'c' ? 'middle' : 'start', rot = e.u ? ` transform="rotate(${n3(-e.u)} ${n3(e.x)} ${n3(Y(e.y))})"` : '';
      return `<text x="${n3(e.x)}" y="${n3(Y(e.y))}" font-size="${n3(e.h)}" text-anchor="${an}" fill="${e.c}"${rot}>${esc(e.txt)}</text>`;
    }
    return '';
  }
  function svg(sc, o) {
    o = Object.assign({ pozadi: '#ffffff' }, o || {});
    const x = sc.x0, y = -sc.y1, w = sc.x1 - sc.x0, h = sc.y1 - sc.y0;
    const rozm = o.sirkaPx ? 'width="100%"' : `width="${n3(w)}mm" height="${n3(h)}mm"`;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" ${rozm} viewBox="${n3(x)} ${n3(y)} ${n3(w)} ${n3(h)}" font-family="Liberation Sans, Arial, Helvetica, sans-serif">`;
    if (o.pozadi) s += `<rect x="${n3(x)}" y="${n3(y)}" width="${n3(w)}" height="${n3(h)}" fill="${o.pozadi}"/>`;
    for (const e of sc.prvky) s += svgPrvek(e);
    return s + '</svg>';
  }
  function dxf(sc) {
    const L = [], g = (k, v) => { L.push(String(k)); L.push(String(v)); };
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    const ascii = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/Ø/g, '%%c').replace(/[−–]/g, '-').replace(/[^\x20-\x7e]/g, '');
    for (const e of sc.prvky) {
      const ly = String(e.v || 'OBRYS').toUpperCase();
      if (e.t === 'l') {
        if (e.b.length === 2 && !e.z) { g(0, 'LINE'); g(8, ly); g(10, n3(e.b[0][0])); g(20, n3(e.b[0][1])); g(30, 0); g(11, n3(e.b[1][0])); g(21, n3(e.b[1][1])); g(31, 0); continue; }
        g(0, 'POLYLINE'); g(8, ly); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, e.z ? 1 : 0);
        for (const q of e.b) { g(0, 'VERTEX'); g(8, ly); g(10, n3(q[0])); g(20, n3(q[1])); g(30, 0); }
        g(0, 'SEQEND'); g(8, ly);
      } else if (e.t === 'k') {
        if (e.f) { g(0, 'POINT'); g(8, ly); g(10, n3(e.x)); g(20, n3(e.y)); g(30, 0); } else { g(0, 'CIRCLE'); g(8, ly); g(10, n3(e.x)); g(20, n3(e.y)); g(30, 0); g(40, n3(e.r)); }
      } else if (e.t === 'txt') {
        g(0, 'TEXT'); g(8, ly); g(10, n3(e.x)); g(20, n3(e.y)); g(30, 0); g(40, n3(e.h * 0.72)); g(1, ascii(e.txt)); if (e.u) g(50, n3(e.u));
        const al = e.a === 'l' ? 0 : e.a === 'r' ? 2 : 1; if (al) { g(72, al); g(11, n3(e.x)); g(21, n3(e.y)); g(31, 0); }
      }
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return L.join('\r\n') + '\r\n';
  }

  /* ---------------- přehled scén pro výsledek ---------------- */
  function pohledy(R, P) {
    if (R.rezim === 'kapsa') return [{ id: 'rez', nazev: 'Řez: vrtání a spoj', sc: rezKapsy(R, P) }, { id: 'profil', nazev: 'Profil přípravku', sc: profilKapsy(R) }, { id: 'rub', nazev: 'Rub dílu – polohy kapes', sc: rubKapsy(R) }];
    if (R.rezim === 'centr') return [{ id: 'centr', nazev: 'Centrovací měrky', sc: pohledCentru(R) }];
    return [{ id: 'rez', nazev: 'Řez: vrtání a spoj', sc: rezSpoje(R, P) }, ...R.pripravky.map((p) => ({ id: 'p' + p.id, nazev: p.nazev, sc: pohledPripravku(p) }))];
  }
  function sablony(R, P) {
    if (R.rezim === 'kapsa') return [{ id: 'kapsa', nazev: 'Předloha přípravku 1:1', sc: sablonaKapsa(R) }];
    if (R.rezim === 'centr') return [];
    const out = [{ id: 'A', nazev: 'Šablona A – čelo', sc: sablonaHrana(R, P, 'A') }];
    out.push(R.spoj.typ === 'hrana' ? { id: 'B', nazev: 'Šablona B – hrana', sc: sablonaHrana(R, P, 'B') } : { id: 'B', nazev: 'Šablona B – plocha', sc: sablonaPlocha(R, P) });
    return out;
  }

  /* ---------------- strany PDF ---------------- */
  const PATA = 12, PRAVY = 9;
  /** rozvržení scény 1:1 na listy (s přesahem); vybere orientaci s menším počtem listů */
  function rozvrh(sc, pw, ph, T_) {
    const ok = +T_.okraj || 8, g = Math.max(0, +T_.prekryv || 0), K = KP.korekceMeritka(T_.kalibX, T_.kalibY);
    const varianta = (W, H) => {
      const uw = W - 2 * ok - PRAVY, uh = H - 2 * ok - PATA, uwM = uw / K.kx, uhM = uh / K.ky;
      const bw = sc.x1 - sc.x0, bh = sc.y1 - sc.y0;
      const nx = bw <= uwM ? 1 : Math.ceil((bw - g) / (uwM - g)), ny = bh <= uhM ? 1 : Math.ceil((bh - g) / (uhM - g));
      return { W, H, uw, uh, uwM, uhM, nx, ny, n: nx * ny, kx: K.kx, ky: K.ky, ok, g };
    };
    const a = varianta(pw, ph), b = varianta(ph, pw);
    const v = b.n < a.n ? b : a, listy = [];
    for (let r = 0; r < v.ny; r++) for (let c = 0; c < v.nx; c++) {
      const x0 = sc.x0 + c * (v.uwM - v.g), y1 = sc.y1 - r * (v.uhM - v.g);
      listy.push({ r, c, x0, y1, x1: x0 + v.uwM, y0: y1 - v.uhM });
    }
    return Object.assign(v, { listy });
  }
  function strany(R, P, o) {
    o = o || {};
    const T_ = Object.assign({}, KP.vychoziProjekt().tisk, P.tisk || {}), [pw, ph] = KP.rozmerPapiru(T_), ok = +T_.okraj || 8, out = [];
    const K = KP.korekceMeritka(T_.kalibX, T_.kalibY);
    const Lp = (arr, b, s, c, d) => arr.push({ t: 'l', b, s, c: c || '#000000', d });
    const Tp = (arr, x, y, txt, h, a, u, c) => arr.push({ t: 'txt', x, y, txt: String(txt), h, a: a || 'l', u: u || 0, c: c || '#000000' });
    const prevod = (sc, X, Y, kx, ky, arr) => {
      for (const e of sc.prvky) {
        if (e.t === 'l') arr.push({ t: 'l', b: e.b.map((q) => [X(q[0]), Y(q[1])]), s: e.s * Math.min(1, Math.max(ky, 0.5)), c: e.c, d: e.d, z: e.z, f: e.f });
        else if (e.t === 'k') arr.push({ t: 'e', x: X(e.x), y: Y(e.y), rx: e.r * kx, ry: e.r * ky, s: e.s, c: e.c, f: e.f, d: e.d });
        else arr.push({ t: 'txt', x: X(e.x), y: Y(e.y), txt: e.txt, h: e.h * Math.min(1, Math.max(ky, 0.6)), a: e.a, u: e.u, c: e.c });
      }
    };
    const meritka = (st, W, H, kx, ky) => {
      const y = H - ok - 3, x0 = ok;
      st.navrch.push({ t: 'm', x0, y, x1: x0 + 100 * kx, osa: 'x' });
      for (let i = 0; i <= 10; i++) Lp(st.navrch, [[x0 + i * 10 * kx, y], [x0 + i * 10 * kx, y - (i % 5 ? 1.5 : 3)]], 0.2);
      Tp(st.navrch, x0, y - 3.6, '0', 2, 'c'); Tp(st.navrch, x0 + 50 * kx, y - 3.6, '50', 2, 'c'); Tp(st.navrch, x0 + 100 * kx, y - 3.6, '100 mm', 2, 'c');
      Tp(st.navrch, x0 + 100 * kx + 8, y - 1.2, (K.kx !== 1 || K.ky !== 1) ? `Korekce tisku X ×${K.kx.toFixed(4).replace('.', ',')}, Y ×${K.ky.toFixed(4).replace('.', ',')}` : 'Kontrola: úsečky 50 a 100 mm vodorovně i svisle musí sedět.', 2.2);
      const xs = W - ok - 2, ys = ok;
      st.navrch.push({ t: 'm', x0: xs, y: ys, y1: ys + 100 * ky, osa: 'y' });
      for (let i = 0; i <= 10; i++) Lp(st.navrch, [[xs, ys + i * 10 * ky], [xs - (i % 5 ? 1.5 : 3), ys + i * 10 * ky]], 0.2);
      Tp(st.navrch, xs - 3.6, ys + 50 * ky + 0.7, '50', 2, 'r'); Tp(st.navrch, xs - 3.6, ys + 100 * ky + 0.7, '100', 2, 'r');
    };
    const nazev = o.nazev || 'Kolíkovací přípravek';
    // 1) šablony 1:1
    for (const sb of sablony(R, P)) {
      const rv = rozvrh(sb.sc, pw, ph, T_), N = rv.listy.length;
      for (const l of rv.listy) {
        const st = { W: rv.W, H: rv.H, obsah: [], navrch: [], clip: { x: ok, y: ok, w: rv.uw, h: rv.uh }, typ: 'sablona' };
        const X = (x) => ok + (x - l.x0) * rv.kx, Y = (y) => ok + (l.y1 - y) * rv.ky;
        prevod(sb.sc, X, Y, rv.kx, rv.ky, st.obsah);
        if (N > 1) {
          const gx = rv.g * rv.kx, gy = rv.g * rv.ky;
          if (l.c < rv.nx - 1) Lp(st.navrch, [[ok + rv.uw - gx, ok], [ok + rv.uw - gx, ok + rv.uh]], 0.2, '#888888', 'c');
          if (l.r < rv.ny - 1) Lp(st.navrch, [[ok, ok + rv.uh - gy], [ok + rv.uw, ok + rv.uh - gy]], 0.2, '#888888', 'c');
          for (const [x, y] of [[ok, ok], [ok + rv.uw, ok], [ok, ok + rv.uh], [ok + rv.uw, ok + rv.uh]]) { Lp(st.navrch, [[x - 3, y], [x + 3, y]], 0.2); Lp(st.navrch, [[x, y - 3], [x, y + 3]], 0.2); }
          if (l.c > 0 || l.r > 0) Tp(st.navrch, ok + 4, ok - 2.4, 'ořízněte ' + (l.c > 0 ? 'levý' : '') + (l.c > 0 && l.r > 0 ? ' a ' : '') + (l.r > 0 ? 'horní' : '') + ' okraj a přiložte na čárkovanou čáru sousedního listu', 2.3, 'l', 0, '#555555');
        }
        Tp(st.navrch, ok, rv.H - ok - PATA + 4, `${nazev} · ${sb.nazev}${N > 1 ? ` · list ${l.r * rv.nx + l.c + 1}/${N} (řádek ${l.r + 1}, sloupec ${l.c + 1})` : ''} · 1:1 – tiskněte ve skutečné velikosti (100 %)`, 2.5);
        meritka(st, rv.W, rv.H, rv.kx, rv.ky);
        out.push(st);
      }
    }
    // 2) výkresy (v měřítku, které se vejde; 1:1 když to jde)
    const W = Math.max(pw, ph), H = Math.min(pw, ph);
    for (const v of pohledy(R, P)) {
      const sc = v.sc, bw = sc.x1 - sc.x0, bh = sc.y1 - sc.y0, uw = W - 2 * ok - PRAVY, uh = H - 2 * ok - PATA - 8;
      const kand = [1, 1.5, 2, 2.5, 3, 4, 5, 10], M = kand.find((m) => bw / m <= uw && bh / m <= uh) || 20;
      const st = { W, H, obsah: [], navrch: [], clip: null, typ: 'vykres', meritko: M };
      const kk = 1 / M;
      const X = (x) => ok + (x - sc.x0) * kk * K.kx + (uw - bw * kk) / 2, Y = (y) => ok + 8 + (sc.y1 - y) * kk * K.ky;
      prevod(sc, X, Y, kk * K.kx, kk * K.ky, st.obsah);
      Tp(st.navrch, ok, ok + 4, `${nazev} · ${v.nazev} · měřítko ${M === 1 ? '1:1' : '1:' + String(M).replace('.', ',')}${M === 1 ? '' : ' (rozměry čtěte z kót)'}`, 3.2);
      Tp(st.navrch, ok, H - ok - PATA + 4, 'kóty v mm', 2.4, 'l', 0, '#555555');
      if (M === 1) meritka(st, W, H, K.kx, K.ky);
      out.push(st);
    }
    // 3) parametry, kusovník, kroužky, postup
    {
      const Wt = pw, Ht = ph, sir = Wt - 2 * ok;
      let st = null, y = 0;
      const nova = () => { st = { W: Wt, H: Ht, obsah: [], navrch: [], clip: null, typ: 'text' }; out.push(st); y = ok + 6; };
      const radek = (txt, h, c) => { if (!st || y > Ht - ok - 8) nova(); Tp(st.navrch, ok, y, txt, h || 3, 'l', 0, c); y += (h || 3) * 1.5; };
      const odst = (txt, h) => { const max = Math.floor(sir / ((h || 3) * 0.5)); let r = ''; for (const s of String(txt).split(' ')) { if ((r + ' ' + s).length > max) { radek(r, h); r = s; } else r = r ? r + ' ' + s : s; } if (r) radek(r, h); };
      nova();
      radek(nazev + ' – parametry a kusovník', 5); y += 1;
      for (const t of shrnuti(R)) odst(t, 2.8);
      for (const v of R.varovani || []) odst('Pozor: ' + v, 2.8);
      for (const v of R.info || []) odst(v, 2.6);
      y += 2; radek('Kusovník', 4);
      for (const k of R.kusovnik || []) odst(`• ${k.polozka} – ${k.mnozstvi}${k.pozn ? ' (' + k.pozn + ')' : ''}`, 2.7);
      if ((R.krouzky || []).length) {
        y += 2; radek('Hloubkové kroužky', 4);
        for (const k of R.krouzky) odst(`${k.id}: ${k.nazev}. Vzdálenost od ${k.ref} ke spodní ploše kroužku ${cz(k.vzdalenost)} mm${k.odHrotu ? ' (od špičky ' + cz(k.odHrotu) + ' mm)' : ''} = hloubka ${cz(k.hloubka)} + vedení ${cz(k.vedeni)}. Nastavení měrkou: vrták zasunout do měrky na doraz, kroužek dosunout na horní plochu, utáhnout.`, 2.7);
      }
      y += 2; radek('Postup', 4);
      for (const t of postupText(R)) odst(t, 2.7);
      y += 3; if (y > Ht - ok - 62) nova();
      radek('Kontrolní čtverec 50 × 50 mm', 3);
      st.navrch.push({ t: 'r', x: ok, y, w: 50 * K.kx, h: 50 * K.ky, s: 0.25, c: '#000000' });
      Tp(st.navrch, ok + 25 * K.kx, y + 25 * K.ky + 1, '50 × 50 mm', 3.4, 'c');
    }
    return out;
  }

  function shrnuti(R) {
    if (R.rezim === 'kapsa') return [
      `Kapsa ${cz(R.uhel, 0)}° v dílu A tl. ${cz(R.tA)} mm, protikus tl. ${cz(R.tB)} mm (${R.typ === 'rovina' ? 'v rovině – rám / hrana na hranu' : 'T – čelo na plochu'}).`,
      `Výstup osy na čele ${cz(R.E[1])} mm od líce, osa vstupuje na rub ${cz(-R.I[0])} mm od čela, ústí kapsy ${cz(-R.usti.zadni)} až ${cz(-R.usti.predni)} mm od čela.`,
      `Vrut ${cz(R.Lv)} mm: v dílu A ${cz(R.sS)} mm, v protikusu ${cz(R.p)} mm, hrot ${cz(R.rezervaHrotu)} mm od protější plochy. Orientační únosnost na vytažení ~${R.Fax} N na vrut (${R.ys.length} ks ≈ ${R.FaxCelkem} N).`,
      `Kroužek na stupňovitém vrtáku: ${cz(R.kroužekOdStupne)} mm od stupně (${cz(R.kroužekOdHrotu)} mm od špičky při délce pilotu ${cz(R.Ls)} mm).`,
    ];
    if (R.rezim === 'centr') return [`Centrovací měrky Ø ${R.kusy.map((q) => q.d).join(', ')} mm, po ${R.kusu} ks.`];
    const S = R.spoj, typ = { hrana: 'hrana na hranu (spárovka)', roh: 'rohový spoj (čelo A na kraj plochy B)', T: `T-spoj (čelo A na plochu B ${cz(S.poloha)} mm od čela B)` }[S.typ];
    const t = [`${KP.REZIMY[R.rezim].nazev}: ${typ}, šířka spoje ${cz(S.sirka)} mm, díl A tl. ${cz(S.tA)}, díl B tl. ${cz(S.tB)}.`,
      `Polohy podél spoje (od referenčního konce A): ${R.diryA.map((q) => cz(q.p[0])).join('; ')} mm. V dílu A ${cz(R.vA)} mm od líce, Ø ${cz(R.dA)}, hloubka ${cz(R.hA)}.`,
      `Díl B: ${R.diryB.map((q) => cz(q.p[0]) + (S.typ === 'hrana' ? '' : '/' + cz(q.p[1]))).join('; ')} mm, Ø ${cz(R.dB)}, ${R.rezim === 'konfirmat' ? 'průchozí' : 'hloubka ' + cz(R.hB)}.`];
    if (R.rezim === 'kolik') t.push(`Kolík Ø ${R.dA} × ${R.delka} (${Math.round(R.prvek.podilCelo * 100)} % v čele). Orientační únosnost ve střihu ~${R.pevnost.naKolik} N na kolík (rozhoduje ${R.pevnost.rozhoduje}), spoj ~${R.pevnost.celkem} N ≈ ${R.pevnost.kg} kg – bez součinitele bezpečnosti, ne statický výpočet.`);
    if (R.rezim === 'excentr') t.push(`Excentr Ø ${R.prvek.d} v ploše A ${cz(R.prvek.odHrany)} mm od čela, hloubka ${cz(R.prvek.hloubka)}.`);
    return t;
  }
  function postupText(R) {
    if (R.rezim === 'kapsa') return [
      '1. Kroužek nastavte měrkou K1 (stupeň vrtáku na dno měrky, kroužek na horní plochu).',
      '2. Díl A položte rubem nahoru, přípravek přiložte dorazem k čelu a upněte svěrkou k dílu i ke stolu.',
      '3. Vrtejte vysokými otáčkami, vrták zasuňte do vedení před spuštěním, vyjíždějte pro odvod třísek, dokud kroužek nedosedne.',
      '4. Díly sevřete (u rámu rovinnou svěrkou přes spoj), lepidlo podle potřeby, vrut zašroubujte bez přetažení.',
    ];
    if (R.rezim === 'centr') return ['Měrky vložte do vyvrtaných děr dílu A, díl B přiložte ve správné poloze a přitlačte – hroty označí středy. Vrtejte do důlků.'];
    return [
      '1. Díly označte (A, B, líc, referenční konec). Přípravky a kroužky vytiskněte, otvory zkontrolujte vrtákem (má jít volně bez vůle do stran).',
      '2. Kroužky nastavte měrkami. Přípravek A nasaďte na čelo dílu A, doraz opřete o referenční konec, upněte svěrkou.',
      '3. Vrtejte kolmo, vyjíždějte pro odvod třísek, dokud kroužek nedosedne na vedení. U děleného přípravku zasuňte do poslední díry indexový kolík a nasaďte další díl.',
      `4. Protikus B vrtejte přípravkem B (${R.spoj.typ === 'hrana' ? 'zrcadlový – doraz na opačném konci' : 'deska s dorazem na čele a boční hraně'}). Průchozí díry podložte prkénkem.`,
      '5. Zkusmo složte bez lepidla, pak lepte (kolíky) nebo šroubujte (konfirmát, excentr).',
    ];
  }

  /* ---------------- PDF ---------------- */
  const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/[„“]/g, '"').replace(/°/g, ' st.').replace(/Ø/g, 'O').replace(/×/g, 'x').replace(/[⟂↓•]/g, '-');
  function rgb(hex) { const v = parseInt(String(hex || '#000000').slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function pdf(jsPDF, str, o) {
    o = Object.assign({ compress: true }, o || {});
    let doc = null, uni = false;
    const Tx = (s) => (uni ? String(s).replace(/[⟂]/g, '⊥').replace(/[↓]/g, 'v').replace(/Ø/g, 'Ø') : bezDiakritiky(s));
    for (const st of str) {
      const orient = st.W > st.H ? 'l' : 'p';
      if (!doc) {
        doc = new jsPDF({ unit: 'mm', format: [st.W, st.H], orientation: orient, compress: o.compress });
        if (o.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
        doc.setProperties({ title: o.nazev || 'Kolíkovací přípravek', creator: 'Kolíkovací a kapsové přípravky' });
      } else doc.addPage([st.W, st.H], orient);
      const kresli = (e) => {
        const c = rgb(e.c); doc.setDrawColor(...c);
        if (e.t === 'l') {
          doc.setLineWidth(Math.max(0.05, e.s || 0.2));
          const s = Math.max(0.12, e.s || 0.2);
          if (e.d === 'c') doc.setLineDashPattern([s * 10, s * 7], 0); else if (e.d === 'o') doc.setLineDashPattern([s * 30, s * 8, s * 4, s * 8], 0);
          if (e.f) doc.setFillColor(...rgb(e.f));
          if (e.b.length === 2 && !e.z) doc.line(e.b[0][0], e.b[0][1], e.b[1][0], e.b[1][1]);
          else { const seg = []; for (let i = 1; i < e.b.length; i++) seg.push([e.b[i][0] - e.b[i - 1][0], e.b[i][1] - e.b[i - 1][1]]); doc.lines(seg, e.b[0][0], e.b[0][1], [1, 1], e.f ? 'FD' : 'S', !!e.z); }
          if (e.d) doc.setLineDashPattern([], 0);
        } else if (e.t === 'e') {
          doc.setLineWidth(Math.max(0.05, e.s || 0.2)); doc.setFillColor(...c);
          if (e.d === 'c') doc.setLineDashPattern([2, 1.5], 0);
          doc.ellipse(e.x, e.y, Math.max(0.05, e.rx), Math.max(0.05, e.ry), e.f ? 'F' : 'S');
          if (e.d) doc.setLineDashPattern([], 0);
        } else if (e.t === 'r') { doc.setLineWidth(Math.max(0.05, e.s || 0.2)); doc.rect(e.x, e.y, e.w, e.h, 'S'); }
        else if (e.t === 'm') { doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3); if (e.osa === 'x') doc.line(e.x0, e.y, e.x1, e.y); else doc.line(e.x0, e.y, e.x0, e.y1); }
        else if (e.t === 'txt') {
          if (uni) doc.setFont('LS', 'normal'); else doc.setFont('helvetica', 'normal');
          doc.setFontSize(e.h / 0.3528); doc.setTextColor(...c);
          const t = Tx(e.txt), w = doc.getTextWidth(t), u = (e.u || 0) * Math.PI / 180, kk = e.a === 'r' ? w : e.a === 'c' ? w / 2 : 0;
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

  const API = { zebra, Scena, orez, pas, rezSpoje, pohledPripravku, rezKapsy, profilKapsy, rubKapsy, pohledCentru, sablonaHrana, sablonaPlocha, sablonaKapsa, pohledy, sablony, svg, dxf, strany, pdf, rozvrh, shrnuti, postupText, bezDiakritiky, BARVY: B };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.KPV = API;
})(typeof window !== 'undefined' ? window : globalThis);

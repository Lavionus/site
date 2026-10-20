/* ============================================================
   Ostření – výstupy (bez DOM): 2D scény (mm, y nahoru), technické pohledy dílů s kótami,
   SVG, DXF, strany PDF 1:1 (jsPDF parametrem).
   prvek: {t:'l', b:[[x,y]..], s, c, d:'c'|'o', z (uzavřená), f (výplň), v (vrstva)}
          {t:'k', x, y, r, s, c, f, d, v} | {t:'txt', x, y, h, txt, a:'l'|'c'|'r', u (° proti směru hod.), c, v}
   ============================================================ */
(function (koren) {
  'use strict';
  const O = koren.OSTR || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const RAD = Math.PI / 180, DEG = 180 / Math.PI;
  const n3 = (x) => (Math.round(x * 1000) / 1000).toString();
  const cz = (x, d) => (x == null || !isFinite(x) ? '–' : String(Math.round(x * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d)).replace('.', ',').replace('-', '−'));
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const MODRA = '#1f5fa8', CERV = '#b3261e', SEDA = '#666666', OCEL = '#9aa4ad', DREVO = '#d9b98a', PLAST = '#7fb08a', KAMEN = '#8c8f96';

  /* ---------------- pomocníci scény ---------------- */
  function Scena() {
    const pr = [];
    return {
      pr,
      L(b, s, c, o) { pr.push(Object.assign({ t: 'l', b, s: s || 0.25, c: c || '#000000' }, o || {})); },
      P(b, f, s, c, o) { pr.push(Object.assign({ t: 'l', b, z: true, f, s: s == null ? 0.25 : s, c: c || '#000000' }, o || {})); },
      K(x, y, r, s, c, o) { pr.push(Object.assign({ t: 'k', x, y, r, s: s || 0.25, c: c || '#000000' }, o || {})); },
      T(x, y, txt, h, a, u, c, o) { pr.push(Object.assign({ t: 'txt', x, y, txt: String(txt), h: h || 2.5, a: a || 'l', u: u || 0, c: c || '#000000' }, o || {})); },
    };
  }
  /** šipka kóty (vyplněný trojúhelník) v bodě p směrem d (jednotkový) */
  function sipka(S, p, d, c, vel) {
    const l = vel || 2, w = l * 0.32, n = [-d[1], d[0]];
    S.P([p, [p[0] - d[0] * l + n[0] * w, p[1] - d[1] * l + n[1] * w], [p[0] - d[0] * l - n[0] * w, p[1] - d[1] * l - n[1] * w]], c, 0.05, c, { v: 'kota' });
  }
  /** zarovnaná kóta mezi a, b, odsazená o 'o' kolmo (kladně doleva od a→b) */
  function kota(S, a, b, txt, o, h, c) {
    c = c || MODRA; h = h || 2.5;
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, d = [dx / l, dy / l], n = [-d[1], d[0]];
    const A = [a[0] + n[0] * o, a[1] + n[1] * o], B = [b[0] + n[0] * o, b[1] + n[1] * o], sg = Math.sign(o) || 1;
    S.L([[a[0] + n[0] * sg * 1, a[1] + n[1] * sg * 1], [A[0] + n[0] * sg * 1.5, A[1] + n[1] * sg * 1.5]], 0.13, c, { v: 'kota' });
    S.L([[b[0] + n[0] * sg * 1, b[1] + n[1] * sg * 1], [B[0] + n[0] * sg * 1.5, B[1] + n[1] * sg * 1.5]], 0.13, c, { v: 'kota' });
    S.L([A, B], 0.18, c, { v: 'kota' });
    sipka(S, A, [-d[0], -d[1]], c); sipka(S, B, d, c);
    let u = Math.atan2(d[1], d[0]) * DEG; if (u > 90.01) u -= 180; if (u < -89.99) u += 180;
    const ur = u * RAD, nt = [-Math.sin(ur), Math.cos(ur)];
    S.T((A[0] + B[0]) / 2 + nt[0] * 0.8, (A[1] + B[1]) / 2 + nt[1] * 0.8, txt, h, 'c', u, c, { v: 'kota' });
  }
  /** oblouk úhlu se středem c od úhlu a0 do a1 (°) */
  function oblouk(S, c, r, a0, a1, txt, h, barva) {
    const b = [], n = Math.max(6, Math.round(Math.abs(a1 - a0) / 3));
    for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * RAD; b.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
    S.L(b, 0.25, barva || CERV, { v: 'kota' });
    if (txt) { const am = (a0 + a1) / 2 * RAD; S.T(c[0] + (r + 2.5) * Math.cos(am), c[1] + (r + 2.5) * Math.sin(am) - h * 0.35, txt, h || 3, 'c', 0, barva || CERV, { v: 'kota' }); }
  }
  const obalka = (pr) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const p = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
    for (const e of pr) {
      if (e.t === 'l') for (const q of e.b) p(q[0], q[1]);
      else if (e.t === 'k') { p(e.x - e.r, e.y - e.r); p(e.x + e.r, e.y + e.r); }
      else if (e.t === 'txt') { const w = e.txt.length * e.h * 0.55, u = (e.u || 0) * RAD, k = e.a === 'c' ? 0.5 : e.a === 'r' ? 1 : 0; const cx = Math.cos(u), sx = Math.sin(u); p(e.x - cx * w * k, e.y - sx * w * k); p(e.x + cx * w * (1 - k) - sx * e.h, e.y + sx * w * (1 - k) + cx * e.h); }
    }
    return { x0, y0, x1, y1 };
  };
  const posun = (pr, dx, dy) => pr.map((e) => (e.t === 'l' ? Object.assign({}, e, { b: e.b.map((q) => [q[0] + dx, q[1] + dy]) }) : Object.assign({}, e, { x: e.x + dx, y: e.y + dy })));

  /* ---------------- simulace vozíku na kameni (bok) ---------------- */
  function scenaVoziku(P, v, L, o) {
    o = o || {};
    const S = Scena(), q = O.poloha(P, v, L), g = q.g, s = v.s, th = q.theta, E = q.E;
    if (!isFinite(th)) { S.T(0, 0, 'Vyložení mimo rozsah', 4, 'c', 0, CERV); return { prvky: S.pr, theta: th }; }
    const kamenH = O.cislo(P.kamen.vyska, 25);
    // kámen a podklad
    const x0 = Math.min(-v.r - 35, ...q.nuz.map((p) => p[0])) - 5, x1 = E[0] + 45;
    if (s > 0) {
      S.P([[x0, -6], [x1, -6], [x1, 0], [x0, 0]], '#e9dcc5', 0.2, SEDA, { v: 'podklad' });
      const xk = Math.max(E[0] - 90, v.r + 4);
      S.P([[xk, Math.max(0, s - kamenH)], [x1, Math.max(0, s - kamenH)], [x1, s], [xk, s]], KAMEN, 0.25, '#333333', { v: 'kamen' });
    } else S.P([[x0, -kamenH], [x1, -kamenH], [x1, 0], [x0, 0]], KAMEN, 0.25, '#333333', { v: 'kamen' });
    S.T(x1 - 2, (s > 0 ? s : 0) - kamenH / 2 - 1, P.kamen.rezim === 'sklo' ? 'sklo + papír' : 'kámen', 3, 'r', 0, '#ffffff', { v: 'popis' });
    // nůž, tělo, svěrka, váleček
    S.P(q.nuz, OCEL, 0.3, '#222222', { v: 'nuz' });
    S.P(q.telo, PLAST, 0.3, '#1f4f2c', { v: 'telo' });
    S.P(q.sverka, PLAST, 0.3, '#1f4f2c', { v: 'telo' });
    const sv = q.T(v.xs, v.H + g.t + v.tc), sp = q.T(v.xs, v.zTop);
    S.L([sp, [sv[0] + Math.sin(th * RAD) * 8, sv[1] + Math.cos(th * RAD) * 8]], 0.6, '#444444', { v: 'sroub' });
    S.K(0, v.r, v.r, 0.3, '#222222', { f: '#c9ced4', v: 'valec' });
    S.K(0, v.r, 4, 0.25, '#222222', { f: '#888888', v: 'valec' });
    // osa válečku a kolmice
    S.L([[0, v.r], q.T(0, v.H)], 0.15, SEDA, { d: 'o', v: 'osa' });
    // úhel ostří
    oblouk(S, E, 22, 180 - th, 180, cz(th, 1) + '°', 3.4, CERV);
    S.L([E, [E[0] - 26, E[1]]], 0.2, CERV, { v: 'kota' });
    // kóta vyložení (podél hřbetu nože)
    const F = q.T(v.a, v.H + g.t);
    kota(S, F, E, 'L = ' + cz(L, 1), 9, 2.8);
    kota(S, [0, E[1]], [E[0], E[1]], cz(E[0], 1), -(kamenH * 0 + (s > 0 ? 8 : 8)) - (s > 0 ? 0 : 0), 2.4, SEDA);
    if (o.popisy !== false) {
      const A = q.T(0, 0);
      S.T(A[0] - v.r - 4, v.r + 1, 'Ø' + cz(v.D, 1), 2.6, 'r', 0, SEDA);
    }
    return { prvky: S.pr, theta: th, E };
  }

  /* ---------------- bruska: dutý výbrus ---------------- */
  function scenaBrusky(R, q, t, o) {
    o = o || {};
    const S = Scena();
    S.K(0, 0, R, 0.35, '#333333', { f: '#b8bcc4', v: 'kotouc' });
    S.K(0, 0, R * 0.35, 0.2, '#555555', { f: '#d4d7dc', v: 'kotouc' });
    S.L([[-5, 0], [5, 0]], 0.2, SEDA, { v: 'osa' }); S.L([[0, -5], [0, 5]], 0.2, SEDA, { v: 'osa' });
    if (!q || !q.platne) { S.T(0, R + 6, 'Nastavení mimo rozsah', 4, 'c', 0, CERV); return { prvky: S.pr }; }
    const { e, fe, tp, Lp } = O.OPERA, b = -q.beta * RAD, cb = Math.cos(b), sb = Math.sin(b), H = [q.hx, q.F[1] - (-fe * sb + e * cb)];
    const rot = (x, z) => [H[0] + x * cb - z * sb, H[1] + x * sb + z * cb];
    S.P([rot(-fe, e), rot(Lp - fe, e), rot(Lp - fe, e - tp), rot(-fe, e - tp)], PLAST, 0.3, '#1f4f2c', { v: 'opera' });
    S.P([rot(-fe + 3, e - tp), rot(Lp - fe, e - tp), rot(Lp - fe, -8), rot(-fe + 3, -8)], PLAST, 0.2, '#1f4f2c', { v: 'opera' });
    S.K(H[0], H[1], 3.25, 0.25, '#222222', { f: '#ffffff', v: 'opera' });
    // nůž na opěrce: od ostří E podél v
    const v = q.v, nU = q.nU, E = q.E, delka = 110;
    const lam0 = q.lam, hrb = [E, [E[0] + v[0] * delka, E[1] + v[1] * delka]];
    const sp = (p) => [p[0] - nU[0] * t, p[1] - nU[1] * t];
    // spodní plocha končí tam, kde ji protne kotouč (menší parametr než E na spodní přímce)
    const Pd = sp(q.P0), bb = Pd[0] * v[0] + Pd[1] * v[1], cc = Pd[0] * Pd[0] + Pd[1] * Pd[1] - R * R, ds = bb * bb - cc;
    const ld = ds > 0 ? -bb + Math.sqrt(ds) : lam0;
    const Ed = [Pd[0] + v[0] * ld, Pd[1] + v[1] * ld];
    const dut = []; const a0 = Math.atan2(E[1], E[0]), a1 = Math.atan2(Ed[1], Ed[0]);
    for (let i = 0; i <= 12; i++) { const a = a0 + (a1 - a0) * i / 12; dut.push([R * Math.cos(a), R * Math.sin(a)]); }
    S.P([hrb[1], ...dut, Ed, sp(hrb[1])].concat([]), OCEL, 0.3, '#222222', { v: 'nuz' });
    // úhel: mezi hřbetem a tečnou v E
    const tg = [-E[1] / R, E[0] / R], uh = Math.atan2(v[1], v[0]) * DEG, ut = Math.atan2(tg[1], tg[0]) * DEG;
    let ut2 = ut; while (ut2 - uh > 180) ut2 -= 360; while (uh - ut2 > 180) ut2 += 360;
    if (Math.abs(ut2 - uh) > 90) ut2 += ut2 > uh ? -180 : 180;
    S.L([[E[0] - tg[0] * 16, E[1] - tg[1] * 16], [E[0] + tg[0] * 16, E[1] + tg[1] * 16]], 0.2, CERV, { d: 'c', v: 'kota' });
    oblouk(S, E, Math.max(13, R / 5), Math.min(uh, ut2), Math.max(uh, ut2), cz(q.theta, 1) + '°', Math.max(3.2, R / 14), CERV);
    S.L([[0, 0], E], 0.15, SEDA, { d: 'o', v: 'osa' });
    if (o.popisy !== false) {
      const hp = Math.max(3, R / 16);
      S.T(H[0] + 6, H[1] - 9 - hp, 'čep, sklon β ' + cz(q.beta, 1) + '°', hp, 'l', 0, '#1f4f2c');
      S.T(0, -R - hp * 1.6, 'Ø' + cz(2 * R, 0) + ' mm', hp, 'c', 0, '#333333');
    }
    return { prvky: S.pr };
  }

  /* ---------------- hoblík: lože, fazeta, úhel řezu ---------------- */
  function scenaHobliku(loze, fazeta, orientace, zadni) {
    const S = Scena(), h = O.hoblik(loze, fazeta, orientace, zadni), b = loze * RAD, t = 3, Ldel = 60;
    S.P([[-55, -10], [40, -10], [40, 0], [-55, 0]], DREVO, 0.2, '#6b4e2a', { v: 'drevo' });
    // podrážka a lože
    S.L([[-50, 0.4], [-4, 0.4]], 0.6, '#333333', { v: 'hoblik' }); S.L([[3, 0.4], [40, 0.4]], 0.6, '#333333', { v: 'hoblik' });
    const d = [-Math.cos(b), Math.sin(b)], n = [Math.sin(b), Math.cos(b)];      // nahoru-dozadu podél lože, normála k přední (čelní) straně
    const A = (s, k) => [d[0] * s + n[0] * k, d[1] * s + n[1] * k], f = fazeta * RAD;
    if (orientace === 'nahoru') {
      // fazeta nahoru: spodní plocha nože na loži prochází ostřím, fazeta je na horní (čelní) straně
      S.L([A(4, -1.2), A(Ldel, -1.2)], 0.8, '#555555', { v: 'hoblik' });
      S.P([[0, 0], A(Ldel, 0), A(Ldel, t), A(t / Math.tan(f), t)], OCEL, 0.3, '#222222', { v: 'nuz' });
    } else {
      // fazeta dolů: hřbet (čelní plocha) prochází ostřím, fazeta směřuje k obrobené ploše
      S.L([A(4, -t - 1.2), A(Ldel, -t - 1.2)], 0.8, '#555555', { v: 'hoblik' });
      S.P([[0, 0], A(Ldel, 0), A(Ldel, -t), A(t / Math.tan(f), -t)], OCEL, 0.3, '#222222', { v: 'nuz' });
    }
    S.L([[0, 0], [-30, 0]], 0.2, CERV, { v: 'kota' });
    oblouk(S, [0, 0], 26, 180 - h.rez, 180, '', 3, CERV);
    S.T(-26 * Math.cos(h.rez / 2 * RAD) - 4, 26 * Math.sin(h.rez / 2 * RAD) + 2, 'řez ' + cz(h.rez, 1) + '°', 3, 'r', 0, CERV);
    oblouk(S, [0, 0], 14, 180 - h.vule, 180, '', 2.6, MODRA);
    S.T(-16, -4.2 + 0, 'vůle ' + cz(h.vule, 1) + '°', 2.6, 'r', 0, MODRA);
    S.T(-50, -6.5, 'dřevo · hoblík jede vpřed →', 2.6, 'l', 0, '#3a2a15');
    return { prvky: S.pr, h };
  }

  /* ---------------- technické pohledy dílu ---------------- */
  const POHLEDY = { bok: { u: 'x', v: 'z', nazev: 'Bokorys' }, shora: { u: 'x', v: 'y', nazev: 'Půdorys' }, zepredu: { u: 'y', v: 'z', nazev: 'Nárys zepředu' } };
  /** obrys primitiva v pohledu: [{b:[[u,v]..]} | {k:[u,v,r]}] */
  function obrysPrim(q, p) {
    const W = POHLEDY[p], ob = O.obalkaPrim(q);
    const rect = () => { const u0 = ob[W.u + '0'] != null ? ob[W.u + '0'] : ob.x0; const g = (os, k) => ob[os + k]; return [{ b: [[g(W.u, 0), g(W.v, 0)], [g(W.u, 1), g(W.v, 0)], [g(W.u, 1), g(W.v, 1)], [g(W.u, 0), g(W.v, 1)]] }]; };
    const osaPohledu = { bok: 'y', shora: 'z', zepredu: 'x' }[p];
    if (q.t === 'prof' && (q.osa || 'y') === osaPohledu) return [{ b: q.osa === 'x' ? q.pts : q.pts }];
    if (q.t === 'deska' && osaPohledu === 'z') return [{ b: q.pts }];
    if ((q.t === 'val' || q.t === 'kuzel') && (q.osa || 'z') === osaPohledu) {
      const [x, y, z] = q.c, c = p === 'bok' ? [x, z] : p === 'shora' ? [x, y] : [y, z];
      return [{ k: [c[0], c[1], q.r || Math.max(q.r0, q.r1)] }];
    }
    if (q.t === 'hex' && (q.osa || 'z') === osaPohledu) {
      const [x, y, z] = q.c, c = p === 'bok' ? [x, z] : p === 'shora' ? [x, y] : [y, z], R = q.af / Math.sqrt(3);
      const ux = { bok: { x: [1, 0], y: [0, 0], z: [0, 1] }, shora: { x: [1, 0], y: [0, 1], z: [0, 0] }, zepredu: { x: [0, 0], y: [1, 0], z: [0, 1] } }[p][q.vrcholy || 'x'];
      const f0 = Math.atan2(ux[1], ux[0]);
      return [{ b: [0, 1, 2, 3, 4, 5].map((i) => [c[0] + R * Math.cos(f0 + i * Math.PI / 3), c[1] + R * Math.sin(f0 + i * Math.PI / 3)]) }];
    }
    return rect();
  }
  /** jeden pohled dílu: obrysy (plné tělo vyplněné, otvory čárkovaně) + kóty dílu pro tento pohled */
  function pohledDilu(dil, p, o) {
    o = o || {};
    const S = Scena(), sirka = 0.35;
    const plus = dil.plus.flatMap((q) => obrysPrim(q, p));
    // trik s obrysem: nejdřív tlustý obrys všech částí, pak výplně přes něj → zůstane jen vnější hrana
    for (const q of plus) if (q.b) S.P(q.b, null, sirka * 2, '#000000', { v: 'obrys' }); else S.K(q.k[0], q.k[1], q.k[2], sirka * 2, '#000000', { v: 'obrys' });
    for (const q of plus) if (q.b) S.P(q.b, o.vypln || '#eef1ee', 0, o.vypln || '#eef1ee', { v: 'vypln' }); else S.K(q.k[0], q.k[1], q.k[2], 0.01, '#eef1ee', { f: o.vypln || '#eef1ee', v: 'vypln' });
    const ob = obalka(S.pr), sv = (q) => [Math.min(ob.x1 - 0.35, Math.max(ob.x0 + 0.35, q[0])), Math.min(ob.y1 - 0.35, Math.max(ob.y0 + 0.35, q[1]))];
    for (const q of (dil.minus || []).filter((m) => !m.text && !m.ryska)) {
      for (const r of obrysPrim(q, p)) if (r.b) S.P(r.b.map(sv), null, 0.2, '#555555', { d: 'c', v: 'skryte' }); else S.K(r.k[0], r.k[1], r.k[2], 0.22, '#333333', { v: 'otvor' });
    }
    for (const k of dil.koty || []) {
      if (k.p !== p) continue;
      if (k.str === 'h' || k.str === 'd') kota(S, [k.a[0], k.o], [k.b[0], k.o], k.txt, 0, 2.6), S.L([k.a, [k.a[0], k.o]], 0.1, MODRA, { v: 'kota' }), S.L([k.b, [k.b[0], k.o]], 0.1, MODRA, { v: 'kota' });
      else kota(S, [k.o, k.a[1]], [k.o, k.b[1]], k.txt, 0, 2.6), S.L([k.a, [k.o, k.a[1]]], 0.1, MODRA, { v: 'kota' }), S.L([k.b, [k.o, k.b[1]]], 0.1, MODRA, { v: 'kota' });
    }
    return S.pr;
  }
  /** výkres dílu: tři pohledy uspořádané (bokorys vlevo nahoře, půdorys pod ním, nárys vpravo) */
  function vykresDilu(dil, o) {
    o = o || {};
    const mez = 16, out = [];
    const bok = pohledDilu(dil, 'bok'), shora = pohledDilu(dil, 'shora'), zep = pohledDilu(dil, 'zepredu');
    const ob = obalka(bok), os = obalka(shora), oz = obalka(zep);
    // půdorys pod bokorysem: x zarovnané, y dílu → svisle
    const dyS = ob.y0 - mez - os.y1, dxZ = ob.x1 + mez - oz.x0;
    out.push(...bok, ...posun(shora, 0, dyS), ...posun(zep, dxZ, 0));
    const S = Scena(), h = 3;
    S.T(ob.x0, ob.y1 + 5, 'Bokorys', h, 'l', 0, SEDA, { v: 'popis' });
    S.T(os.x0, os.y1 + dyS + 3, 'Půdorys', h, 'l', 0, SEDA, { v: 'popis' });
    S.T(oz.x0 + dxZ, oz.y1 + 5, 'Nárys', h, 'l', 0, SEDA, { v: 'popis' });
    out.push(...S.pr);
    return { prvky: out, ...obalka(out) };
  }

  /* ---------------- šablony úhlů k tisku (1:1) ---------------- */
  function scenaSablonUhlu(uhly, o) {
    o = o || {};
    const S = Scena(), delka = 70, out = [];
    let y = 0;
    const vyber = uhly.slice(0, 10);
    vyber.forEach((u, i) => {
      const col = i % 2, row = Math.floor(i / 2), x0 = col * 92, y0 = -row * 30;
      const v = Math.min(26, delka * Math.tan(u * RAD)), dl = v / Math.tan(u * RAD);
      S.P(dl < delka - 0.01 ? [[x0, y0], [x0 + delka, y0], [x0 + delka, y0 + v], [x0 + dl, y0 + v]] : [[x0, y0], [x0 + delka, y0], [x0 + delka, y0 + v]], '#f2f2f2', 0.3, '#000000', { v: 'sablona' });
      oblouk(S, [x0, y0], 14, 0, u, '', 3, CERV);
      S.T(x0 + 17, y0 + 2.2, cz(u, 1) + '°', 4, 'l', 0, '#000000', { v: 'popis' });
      S.T(x0 + delka, y0 - 3.6, 'vystřihnout · přiložit na hřbet a fazetu', 1.9, 'r', 0, SEDA, { v: 'popis' });
      y = Math.min(y, y0 - 6);
    });
    // vějíř úhlů pro odečet
    const vx = 0, vy = y - 72, R = 80;
    S.L([[vx, vy], [vx + R + 6, vy]], 0.35, '#000000', { v: 'vejir' });
    for (let u = 5; u <= 60; u += 1) {
      const r0 = u % 5 ? R - 4 : 6, c = Math.cos(u * RAD), s = Math.sin(u * RAD);
      S.L([[vx + r0 * c, vy + r0 * s], [vx + R * c, vy + R * s]], u % 5 ? 0.12 : 0.22, u % 5 ? SEDA : '#000000', { v: 'vejir' });
      if (u % 5 === 0) S.T(vx + (R + 3) * c, vy + (R + 3) * s - 1, u + '°', 2.6, 'l', 0, '#000000', { v: 'popis' });
    }
    S.T(vx + 4, vy - 5, 'Vějíř úhlů: hřbet nože položte na vodorovnou čáru, ostří do počátku; fazeta ukáže úhel.', 2.4, 'l', 0, '#000000', { v: 'popis' });
    return { prvky: S.pr, ...obalka(S.pr) };
  }
  /** šablona zakulacení 1:1 (oblouk pro kontrolu proti světlu) */
  function scenaCamberu(C) {
    const S = Scena();
    S.P(C.polygon, '#f2f2f2', 0.3, '#000000', { v: 'sablona' });
    S.T(0, 6, `zakulacení ${cz(C.c, 2)} mm na šířce ${cz(C.W, 0)} mm · R = ${cz(C.Rc, 0)} mm`, 2.6, 'c', 0, '#000000', { v: 'popis' });
    return { prvky: S.pr, ...obalka(S.pr) };
  }

  /* ---------------- SVG ---------------- */
  function svgPrvek(e) {
    const Y = (y) => -y;
    const dash = (d, s) => (d === 'c' ? ` stroke-dasharray="${n3(Math.max(0.6, s * 8))} ${n3(Math.max(0.5, s * 5))}"` : d === 'o' ? ` stroke-dasharray="${n3(s * 30)} ${n3(s * 8)} ${n3(s * 4)} ${n3(s * 8)}"` : '');
    if (e.t === 'l') {
      const d = e.b.map((q, i) => (i ? 'L' : 'M') + n3(q[0]) + ' ' + n3(Y(q[1]))).join('') + (e.z ? 'Z' : '');
      const st = e.s > 0 ? ` stroke="${e.c}" stroke-width="${n3(Math.max(0.05, e.s))}" stroke-linejoin="round" stroke-linecap="round"${dash(e.d, Math.max(0.12, e.s))}` : ' stroke="none"';
      return `<path d="${d}" fill="${e.f || 'none'}"${st}/>`;
    }
    if (e.t === 'k') return `<circle cx="${n3(e.x)}" cy="${n3(Y(e.y))}" r="${n3(e.r)}" fill="${e.f || 'none'}" stroke="${e.c}" stroke-width="${n3(Math.max(0.05, e.s))}"${dash(e.d, Math.max(0.12, e.s))}/>`;
    if (e.t === 'txt') {
      const an = e.a === 'r' ? 'end' : e.a === 'c' ? 'middle' : 'start', rot = e.u ? ` transform="rotate(${n3(-e.u)} ${n3(e.x)} ${n3(Y(e.y))})"` : '';
      return `<text x="${n3(e.x)}" y="${n3(Y(e.y))}" font-size="${n3(e.h)}" text-anchor="${an}" fill="${e.c}"${rot}>${esc(e.txt)}</text>`;
    }
    return '';
  }
  /** o: {okraj, pozadi, sirkaPx, id} */
  function svg(prvky, o) {
    o = Object.assign({ okraj: 4, pozadi: '#ffffff' }, o || {});
    const b = obalka(prvky), m = o.okraj, x = b.x0 - m, y = -b.y1 - m, w = b.x1 - b.x0 + 2 * m, h = b.y1 - b.y0 + 2 * m;
    const rozm = o.sirkaPx ? 'width="100%"' : `width="${n3(w)}mm" height="${n3(h)}mm"`;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" ${rozm} viewBox="${n3(x)} ${n3(y)} ${n3(w)} ${n3(h)}" font-family="Liberation Sans, Arial, Helvetica, sans-serif"${o.id ? ` id="${o.id}"` : ''}>`;
    if (o.pozadi) s += `<rect x="${n3(x)}" y="${n3(y)}" width="${n3(w)}" height="${n3(h)}" fill="${o.pozadi}"/>`;
    for (const e of prvky) s += svgPrvek(e);
    return s + '</svg>';
  }

  /* ---------------- DXF R12 ---------------- */
  function dxf(prvky) {
    const L = [], g = (k, v) => { L.push(String(k)); L.push(String(v)); };
    const vrstvy = [...new Set(prvky.map((e) => String(e.v || 'obrys').toUpperCase()))];
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, vrstvy.length);
    vrstvy.forEach((v, i) => { g(0, 'LAYER'); g(2, v); g(70, 0); g(62, [7, 5, 1, 3, 8, 4, 6, 2][i % 8]); g(6, 'CONTINUOUS'); });
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    const ascii = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/Ø/g, '%%c').replace(/°/g, '%%d').replace(/[−–]/g, '-').replace(/[^\x20-\x7e]/g, '');
    for (const e of prvky) {
      const ly = String(e.v || 'obrys').toUpperCase();
      if (e.v === 'vypln') continue;
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

  /* ---------------- strany PDF (mm papíru, y dolů) ---------------- */
  function rozmerPapiru(T) {
    const t = T.papir || 'a4';
    if (t === 'a3') return [297, 420];
    if (t === 'letter') return [215.9, 279.4];
    if (t === 'vlastni') return [Math.max(100, O.cislo(T.papirW, 210)), Math.max(100, O.cislo(T.papirH, 297))];
    return [210, 297];
  }
  const korekce = (T) => ({ kx: 100 / Math.min(120, Math.max(80, O.cislo(T.kalibX, 100))), ky: 100 / Math.min(120, Math.max(80, O.cislo(T.kalibY, 100))) });

  /**
   * strany(P, data) → [{W, H, prvky (y dolů), typ}]
   * data: {v (vozík), tabulka, dily: [{dil, nazev}], sablony: [úhly], camber, bruska: opera(P), nazev}
   */
  function strany(P, data) {
    const T = P.tisk, [pw, ph] = rozmerPapiru(T), ok = Math.max(5, O.cislo(T.okraj, 8)), K = korekce(T), out = [];
    const nova = (typ, W, H) => { const st = { W: W || pw, H: H || ph, prvky: [], typ }; out.push(st); return st; };
    const Tp = (st, x, y, txt, h, a, u, c) => st.prvky.push({ t: 'txt', x, y, txt: String(txt), h: h || 3, a: a || 'l', u: u || 0, c: c || '#000000' });
    const Lp = (st, b, s, c, d) => st.prvky.push({ t: 'l', b, s: s || 0.2, c: c || '#000000', d });
    const meritka = (st) => {
      const y = st.H - ok - 3, x0 = ok;
      st.prvky.push({ t: 'm', x0, y, x1: x0 + 100 * K.kx, osa: 'x' });
      for (let i = 0; i <= 10; i++) Lp(st, [[x0 + i * 10 * K.kx, y], [x0 + i * 10 * K.kx, y - (i % 5 ? 1.5 : 3)]], 0.2);
      Tp(st, x0, y - 3.6, '0', 2, 'c'); Tp(st, x0 + 50 * K.kx, y - 3.6, '50', 2, 'c'); Tp(st, x0 + 100 * K.kx, y - 3.6, '100 mm', 2, 'c');
      Tp(st, x0 + 100 * K.kx + 8, y - 1, (K.kx !== 1 || K.ky !== 1) ? `Korekce tisku X ×${K.kx.toFixed(4).replace('.', ',')}, Y ×${K.ky.toFixed(4).replace('.', ',')}` : 'Kontrola: úsečky musí mít přesně 50 a 100 mm.', 2.2);
      const xs = st.W - ok - 1.5, ys = ok + 12;
      st.prvky.push({ t: 'm', x0: xs, y: ys, y1: ys + 100 * K.ky, osa: 'y' });
      for (let i = 0; i <= 10; i++) Lp(st, [[xs, ys + i * 10 * K.ky], [xs - (i % 5 ? 1.5 : 3), ys + i * 10 * K.ky]], 0.2);
      Tp(st, xs - 3.6, ys + 0.8, '0', 2, 'r'); Tp(st, xs - 3.6, ys + 50 * K.ky + 0.7, '50', 2, 'r'); Tp(st, xs - 3.6, ys + 100 * K.ky + 0.7, '100', 2, 'r');
    };
    const ctverec = (st, x, y) => { st.prvky.push({ t: 'r', x, y, w: 50 * K.kx, h: 50 * K.ky, s: 0.25, c: '#000000' }); Tp(st, x + 25 * K.kx, y + 25 * K.ky + 1, '50 × 50 mm', 3, 'c'); };
    const hlavicka = (st, txt, pod) => { Tp(st, ok, ok + 5, txt, 4.6); if (pod) Tp(st, ok, ok + 10.5, pod, 2.6, 'l', 0, '#444444'); };
    const vlozScenu = (st, sc, x, y, m, kx, ky) => {
      // scéna (mm, y nahoru, obálka sc.x0..) do listu: levý horní roh (x, y), měřítko 1 : m, s korekcí kx, ky
      const b = obalka(sc.prvky), X = (u) => x + (u - b.x0) / m * kx, Y = (v) => y + (b.y1 - v) / m * ky;
      for (const e of sc.prvky) {
        if (e.t === 'l') st.prvky.push({ t: 'l', b: e.b.map((q) => [X(q[0]), Y(q[1])]), s: e.s / Math.max(1, m * 0.7), c: e.c, d: e.d, z: e.z, f: e.f });
        else if (e.t === 'k') st.prvky.push({ t: 'e', x: X(e.x), y: Y(e.y), rx: e.r / m * kx, ry: e.r / m * ky, s: e.s / Math.max(1, m * 0.7), c: e.c, f: e.f, d: e.d });
        else if (e.t === 'txt') st.prvky.push({ t: 'txt', x: X(e.x), y: Y(e.y), txt: e.txt, h: e.h / Math.max(1, m * 0.6), a: e.a, u: e.u, c: e.c });
      }
      return { w: (b.x1 - b.x0) / m * kx, h: (b.y1 - b.y0) / m * ky };
    };
    const nazev = data.nazev || 'Ostření – přípravky';
    const g = data.g;

    // 1) šablony úhlů 1:1
    if (data.sablony && data.sablony.length) {
      const st = nova('sablony');
      hlavicka(st, `${nazev} – šablony úhlů 1:1`, 'Tiskněte ve skutečné velikosti (100 %). Šablony nalepte na tvrdý karton nebo plech a vystřihněte.');
      const sc = scenaSablonUhlu(data.sablony);
      const r = vlozScenu(st, sc, ok + 2, ok + 18, 1, K.kx, K.ky);
      ctverec(st, ok + 2, Math.min(st.H - ok - 70, ok + 22 + r.h));
      meritka(st);
    }
    // 2) tabulka vyložení
    if (data.tabulka && g) {
      const st = nova('tabulka');
      hlavicka(st, `${nazev} – tabulka vyložení`, `váleček Ø${cz(2 * g.r, 1)} mm · výška lože H = ${cz(g.H, 2)} mm · čelo a = ${cz(g.a, 1)} mm · nůž tl. ${cz(g.t, 1)} mm · kámen nad dráhou s = ${cz(g.s, 1)} mm`);
      const sl = [0, 22, 52, 82, 112, 140], hl = ['úhel', 'vyložení L', 'od mikro', 'ostří od dotyku', 'délka fazety', '° na 1 mm'];
      let y = ok + 22;
      hl.forEach((t, i) => Tp(st, ok + sl[i], y, t, 2.8, 'l', 0, '#444444')); y += 1.5; Lp(st, [[ok, y], [st.W - ok - 8, y]], 0.15, '#999999'); y += 4.6;
      for (const q of data.tabulka) {
        if (y > st.H - ok - 30) break;
        const row = [cz(q.uhel, 1) + '°', cz(q.L, 1) + ' mm', (q.delta > 0 ? '+' : '') + cz(q.delta, 1), cz(q.Ex, 1) + ' mm', cz(q.fazeta, 1) + ' mm', cz(q.citl, 2)];
        row.forEach((t, i) => Tp(st, ok + sl[i], y, t, 3.1, 'l', 0, Math.abs(q.uhel - O.cislo(P.uhly.primarni, 25)) < 1e-6 || Math.abs(q.uhel - O.cislo(P.uhly.mikro, 30)) < 1e-6 ? CERV : '#000000'));
        y += 4.9;
      }
      y += 4;
      for (const t of ['Vyložení L se měří podél hřbetu nože od čela vozíku (přední plocha těla a svěrky) k ostří.',
        '„od mikro“ = o kolik se liší od vyložení primární fazety (záporné = nůž zasunout).',
        'Ověřte jednou digitálním úhloměrem a případně zadejte kalibraci (skutečná výška lože se dopočítá).']) { Tp(st, ok, y, t, 2.6); y += 4.2; }
      meritka(st);
    }
    // 3) výkresy dílů
    for (const d of data.dily || []) {
      const st = nova('vykres');
      const vk = vykresDilu(d.dil);
      const uw = st.W - 2 * ok - 10, uh = st.H - 2 * ok - 50, w = vk.x1 - vk.x0, h = vk.y1 - vk.y0;
      const m = [1, 1.5, 2, 2.5, 3, 4, 5].find((q) => w / q <= uw && h / q <= uh) || 6;
      hlavicka(st, `${nazev} – ${d.dil.nazev}`, `${m === 1 ? 'měřítko 1:1 (lze přiložit)' : 'měřítko 1:' + String(m).replace('.', ',') + ' – kóty v mm platí'} · materiál: ${d.dil.material}`);
      Tp(st, ok, ok + 15, 'Tisk: ' + d.dil.tisk, 2.6, 'l', 0, '#444444');
      vlozScenu(st, vk, ok + 2, ok + 22, m, m === 1 ? K.kx : 1, m === 1 ? K.ky : 1);
      let y = st.H - ok - 22;
      for (const q of (d.kusovnik || []).slice(0, 3)) { Tp(st, ok, y, `${q.ks ? q.ks + '× ' : ''}${q.pol}${q.pozn ? ' – ' + q.pozn : ''}`, 2.3, 'l', 0, '#333333'); y += 3.4; }
      meritka(st);
    }
    // 4) šablona zakulacení 1:1
    if (data.camber) {
      const st = nova('camber');
      hlavicka(st, `${nazev} – šablona zakulacení ostří 1:1`, 'Vystřihnout z kartonu nebo plechu; hranu přiložit k ostří proti světlu.');
      const r = vlozScenu(st, scenaCamberu(data.camber), ok + 2, ok + 22, 1, K.kx, K.ky);
      ctverec(st, ok + 2, ok + 34 + r.h);
      meritka(st);
    }
    // 5) bruska
    if (data.bruska) {
      const B = data.bruska, st = nova('bruska');
      hlavicka(st, `${nazev} – nastavení opěrky brusky`, `kotouč Ø${cz(B.D, 0)} mm · čep ${cz(B.hz, 0)} mm nad osou kotouče · mezera ${cz(B.g, 1)} mm · nůž tl. ${cz(B.t, 1)} mm`);
      let y = ok + 22;
      Tp(st, ok, y, 'Úhel ostří → sklon opěrky β (na stupnici) a vzdálenost čepu od osy kotouče:', 3); y += 6;
      for (const q of B.uhlyTab) { Tp(st, ok + 4, y, `${q.uhel}° → β = ${cz(q.beta, 1)}°, čep ${cz(q.hx, 1)} mm od osy`, 3); y += 5; }
      y += 3; Tp(st, ok, y, `Opotřebení kotouče při úhlu ${cz(B.theta, 1)}°:`, 3); y += 6;
      for (const q of B.tabulka) { Tp(st, ok + 4, y, `Ø${cz(q.D, 0)}: β = ${cz(q.beta, 1)}° · beze změny β by vyšlo ${cz(q.pevneTheta, 1)}° · hloubka výbrusu ${cz(q.hloubka, 2)} mm`, 2.8); y += 4.6; }
      if (B.nast) { const sc = scenaBrusky(B.D / 2, B.nast, B.t); vlozScenu(st, sc, ok + 10, y + 6, Math.max(1, (B.D + 120) / (st.W - 2 * ok - 20)), 1, 1); }
      meritka(st);
    }
    return out;
  }

  /* ---------------- PDF ---------------- */
  const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/[„“]/g, '"').replace(/°/g, ' st.').replace(/Ø/g, 'O').replace(/×/g, 'x').replace(/[^\x20-\x7e]/g, '');
  function rgb(hex) { const v = parseInt(String(hex || '#000000').slice(1, 7), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function pdf(jsPDF, str, o) {
    o = Object.assign({ compress: true }, o || {});
    let doc = null, uni = false;
    const T = (s) => (uni ? String(s) : bezDiakritiky(s));
    for (const st of str) {
      const orient = st.W > st.H ? 'l' : 'p';
      if (!doc) {
        doc = new jsPDF({ unit: 'mm', format: [st.W, st.H], orientation: orient, compress: o.compress });
        if (o.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
        doc.setProperties({ title: o.nazev || 'Ostření – přípravky', creator: 'Ostření dlát a hoblíků' });
      } else doc.addPage([st.W, st.H], orient);
      for (const e of st.prvky) {
        const c = rgb(e.c); doc.setDrawColor(...c);
        if (e.f) doc.setFillColor(...rgb(e.f)); else doc.setFillColor(...c);
        if (e.t === 'l') {
          doc.setLineWidth(Math.max(0.05, e.s || 0.05));
          if (e.d === 'c') doc.setLineDashPattern([1.5, 1], 0); else if (e.d === 'o') doc.setLineDashPattern([5, 1.2, 0.6, 1.2], 0);
          const styl = e.f && e.s > 0 ? 'FD' : e.f ? 'F' : 'S';
          if (e.b.length === 2 && !e.z) doc.line(e.b[0][0], e.b[0][1], e.b[1][0], e.b[1][1]);
          else if (e.s > 0 || e.f) { const seg = []; for (let i = 1; i < e.b.length; i++) seg.push([e.b[i][0] - e.b[i - 1][0], e.b[i][1] - e.b[i - 1][1]]); doc.lines(seg, e.b[0][0], e.b[0][1], [1, 1], styl, !!e.z); }
          if (e.d) doc.setLineDashPattern([], 0);
        } else if (e.t === 'e') {
          doc.setLineWidth(Math.max(0.05, e.s || 0.2));
          if (e.d === 'c') doc.setLineDashPattern([1.5, 1], 0);
          doc.ellipse(e.x, e.y, e.rx, e.ry, e.f ? 'FD' : 'S');
          if (e.d) doc.setLineDashPattern([], 0);
        } else if (e.t === 'r') { doc.setLineWidth(Math.max(0.05, e.s || 0.2)); doc.rect(e.x, e.y, e.w, e.h, 'S'); }
        else if (e.t === 'm') { doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3); if (e.osa === 'x') doc.line(e.x0, e.y, e.x1, e.y); else doc.line(e.x0, e.y, e.x0, e.y1); }
        else if (e.t === 'txt') {
          if (uni) doc.setFont('LS', 'normal'); else doc.setFont('helvetica', 'normal');
          doc.setFontSize(e.h / 0.3528); doc.setTextColor(...c);
          const t = T(e.txt), w = doc.getTextWidth(t), u = (e.u || 0) * RAD, kk = e.a === 'r' ? w : e.a === 'c' ? w / 2 : 0;
          doc.text(t, e.x - Math.cos(u) * kk, e.y + Math.sin(u) * kk, e.u ? { angle: e.u } : undefined);
        }
      }
    }
    if (!doc) doc = new jsPDF({ unit: 'mm', format: 'a4' });
    return doc;
  }

  const API = { scenaVoziku, scenaBrusky, scenaHobliku, pohledDilu, vykresDilu, scenaSablonUhlu, scenaCamberu, obalka, svg, svgPrvek, dxf, strany, pdf, rozmerPapiru, korekce, bezDiakritiky, cz, kota };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.OSTRV = API;
})(typeof window !== 'undefined' ? window : globalThis);

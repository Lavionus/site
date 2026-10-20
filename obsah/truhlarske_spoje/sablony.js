/* ============================================================
   Šablony truhlářských spojů – orýsovací šablony 1:1 a technické pohledy (bez DOM)
   Šablona dílu = rozvin ploch kolem konce prkna (nebo kolem plochy uprostřed), který se
   ohne kolem dřeva. Každá plocha je řez dílu rovinou těsně pod povrchem:
     dřevo, které zůstane = řez dílu; odpad = řez polotovaru − řez dílu (šrafováno, „X“);
     čára řezu = hranice dílu proti odpadu; šedý pruh = šířka řezu pilou na odpadní straně.
   Technické pohledy = pravoúhlé průměty sestavy se skrytými hranami (čárkovaně) a kótami.
   Výstupní „scéna“: {x0, y0, w, h, prvky:[…]} v mm, osa y dolů:
     {t:'l', b:[[x,y]…], z (uzavřená), v:vrstva, s:tloušťka, d:čárkovaná}
     {t:'p', b:[kruhy…], v} – plocha (sudo-liché pravidlo)
     {t:'txt', x, y, h, txt, a:'l'|'c'|'r', u:úhel°, v}
   Polygonové operace: ClipperLib (obsah/lib/clipper.min.js, Boost licence).
   ============================================================ */
(function (koren) {
  'use strict';
  const J = koren.TSJ || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  let CL = koren.ClipperLib || null;
  function clipper() {
    if (!CL && typeof require !== 'undefined') { try { CL = require('../lib/clipper.min.js'); } catch (e) { CL = null; } }
    if (!CL) throw new Error('chybí ClipperLib');
    return CL;
  }
  const fmt = J.fmt;
  const K = 1000;   // Clipper počítá v celých číslech (µm)
  const doC = (ring) => ring.map((q) => ({ X: Math.round(q[0] * K), Y: Math.round(q[1] * K) }));
  const zC = (path) => path.map((q) => [q.X / K, q.Y / K]);
  function operace(typ, a, b, pfA, pfB) {
    const C = clipper(), c = new C.Clipper();
    c.AddPaths(a.map(doC), C.PolyType.ptSubject, true);
    if (b && b.length) c.AddPaths(b.map(doC), C.PolyType.ptClip, true);
    const out = new C.Paths();
    const T = { u: C.ClipType.ctUnion, r: C.ClipType.ctDifference, p: C.ClipType.ctIntersection, x: C.ClipType.ctXor }[typ];
    c.Execute(T, out, pfA == null ? C.PolyFillType.pftNonZero : pfA, pfB == null ? C.PolyFillType.pftNonZero : pfB);
    return out.map(zC).filter((r) => r.length >= 3);
  }
  const sjednot = (a) => operace('u', a, null);
  const rozdil = (a, b) => operace('r', a, b);
  const prunik = (a, b) => operace('p', a, b);
  function eo(a) { return operace('u', a, null, clipper().PolyFillType.pftEvenOdd); }
  function odsad(a, d) {
    const C = clipper(), co = new C.ClipperOffset(2, 0.05 * K);
    co.AddPaths(a.map(doC), C.JoinType.jtMiter, C.EndType.etClosedPolygon);
    const out = new C.Paths(); co.Execute(out, d * K);
    return out.map(zC).filter((r) => r.length >= 3);
  }
  const uvnitr = (x, y, kruhy) => J.uvnitr(x, y, kruhy);
  function plochaKruhu(r) { return Math.abs(J.plocha(r)); }

  /* ---------------- řez tělesa rovinou ---------------- */
  /** řez tělesa rovinou (osa a ∈ 0..2, hodnota c) → seznam kruhů ve 3D (body na rovině) */
  function rezTelesa(T, a, c) {
    const ix = J.osyTelesa(T.osa), kruhy = [T.poly].concat(T.diry || []), out = [];
    if (ix[2] === a) {
      if (c <= T.w0 || c >= T.w1) return out;
      for (const R of kruhy) out.push(R.map((q) => J.do3D(T.osa, q[0], q[1], c)));
      return out;
    }
    if (c <= T.w0 - 1e-9 || c >= T.w1 + 1e-9) {
      // rovina ‖ ose vytažení, ale mimo rozsah w → hledáme jen pokud leží v u/v
    }
    const k = ix[0] === a ? 0 : 1, o = 1 - k;
    const xs = J.pruseciky(kruhy, k, c);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const s0 = xs[i], s1 = xs[i + 1];
      if (s1 - s0 < 1e-9) continue;
      const bod = (s, w) => { const q = [0, 0]; q[k] = c; q[o] = s; return J.do3D(T.osa, q[0], q[1], w); };
      out.push([bod(s0, T.w0), bod(s1, T.w0), bod(s1, T.w1), bod(s0, T.w1)]);
    }
    return out;
  }

  /* ---------------- plochy šablony ---------------- */
  const OS = { x: 0, y: 1, z: 2 };
  const jedn = (i, s) => { const v = [0, 0, 0]; v[i] = s; return v; };
  /** plocha: rovina osa n = c, mapa P → [h, v] = [oh + (P−O)·hD, ov + (P−O)·vD], okno [h0, h1, v0, v1], dovnitř = směr do dřeva */
  function plochaSablony(nazev, n, c, O, hD, vD, oh, ov, okno, dovnitr) {
    return { nazev, n, c, O, hD, vD, oh, ov, okno, dovnitr };
  }
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const mapa = (F, P) => { const d = [P[0] - F.O[0], P[1] - F.O[1], P[2] - F.O[2]]; return [F.oh + dot(d, F.hD), F.ov + dot(d, F.vD)]; };
  const zpet = (F, h, v) => [0, 1, 2].map((i) => F.O[i] + (h - F.oh) * F.hD[i] + (v - F.ov) * F.vD[i]);

  /** sestaví plochy rozvinu podle předpisu šablony z jádra */
  function plochyRozvinu(sp) {
    const E = 0.02, F = [];
    if (sp.typ === 'konec') {
      const a = OS[sp.konecOsa], t = OS[sp.tlOsa], s = OS[sp.sOsa], e = -sp.konecZnam, L = sp.delka, T = sp.t1 - sp.t0, W = sp.s1 - sp.s0;
      const Oend = [0, 0, 0]; Oend[a] = sp.konec; Oend[t] = sp.t0; Oend[s] = sp.s0;
      const nm = sp.nazevPloch || ['plocha', 'čelo', 'plocha'];
      // plocha 1 (t = t0): h = L − e·(P_a − konec)
      F.push(plochaSablony(nm[0], t, sp.t0 + E, Oend, jedn(a, -e), jedn(s, 1), L, 0, [0, L, 0, W], jedn(t, 1)));
      F.push(plochaSablony(nm[1], a, sp.konec + e * E, Oend, jedn(t, 1), jedn(s, 1), L, 0, [L, L + T, 0, W], jedn(a, e)));
      const O2 = Oend.slice(); O2[t] = sp.t1;
      F.push(plochaSablony(nm[2], t, sp.t1 - E, O2, jedn(a, e), jedn(s, 1), L + T, 0, [L + T, 2 * L + T, 0, W], jedn(t, -1)));
      if (sp.hrany) {
        const Hs = Math.min(L, 60);
        const Ot = Oend.slice(); Ot[s] = sp.s1;
        F.push(plochaSablony('hrana', s, sp.s1 - E, Ot, jedn(t, 1), jedn(a, e), L, W, [L, L + T, W, W + Hs], jedn(s, -1)));
        F.push(plochaSablony('hrana', s, sp.s0 + E, Oend, jedn(t, 1), jedn(a, -e), L, 0, [L, L + T, -Hs, 0], jedn(s, 1)));
      }
    } else if (sp.typ === 'stred') {
      const n = OS[sp.normOsa], d = OS[sp.dOsa], t = OS[sp.tlOsa], z = sp.normZnam, T = sp.t1 - sp.t0, D = sp.d1 - sp.d0;
      const Hs = Math.min(sp.hloubka, sp.boky || 30), nm = sp.nazevPloch || ['bok', 'plocha', 'bok', 'protější plocha'];
      const O = [0, 0, 0]; O[n] = sp.plocha; O[t] = sp.t0; O[d] = sp.d0;
      F.push(plochaSablony(nm[1], n, sp.plocha - z * E, O, jedn(t, 1), jedn(d, 1), Hs, 0, [Hs, Hs + T, 0, D], jedn(n, -z)));
      if (!sp.jenPlocha) {
        F.push(plochaSablony(nm[0], t, sp.t0 + E, O, jedn(n, z), jedn(d, 1), Hs, 0, [0, Hs, 0, D], jedn(t, 1)));
        const O1 = O.slice(); O1[t] = sp.t1;
        F.push(plochaSablony(nm[2], t, sp.t1 - E, O1, jedn(n, -z), jedn(d, 1), Hs + T, 0, [Hs + T, 2 * Hs + T, 0, D], jedn(t, -1)));
        if (sp.druha) {
          const O3 = O.slice(); O3[n] = sp.plocha - z * sp.hloubka; O3[t] = sp.t1;
          F.push(plochaSablony(nm[3] || 'protější plocha', n, sp.plocha - z * (sp.hloubka - E), O3, jedn(t, -1), jedn(d, 1), 2 * Hs + T, 0, [2 * Hs + T, 2 * Hs + 2 * T, 0, D], jedn(n, z)));
        }
      }
    } else if (sp.typ === 'plocha') {
      const n = OS[sp.normOsa], u = OS[sp.u], v = OS[sp.v], ok = sp.okno;
      const O = [0, 0, 0]; O[n] = sp.plocha; O[u] = ok[0]; O[v] = ok[2];
      F.push(plochaSablony(sp.nazev, n, sp.plocha - sp.normZnam * E, O, jedn(u, 1), jedn(v, 1), 0, 0, [0, ok[1] - ok[0], 0, ok[3] - ok[2]], jedn(n, -sp.normZnam)));
    }
    return F;
  }

  function obdelnik(o) { return [[o[0], o[2]], [o[1], o[2]], [o[1], o[3]], [o[0], o[3]]]; }
  /** řez seznamu těles rovinou plochy → kruhy v souřadnicích šablony (sjednocené) */
  function rezVPloše(telesa, F) {
    const kruhy = [];
    for (const T of telesa) {
      const R = rezTelesa(T, F.n, F.c);
      if (!R.length) continue;
      const loc = R.map((r) => r.map((P) => mapa(F, P)));
      // díry tělesa (stejná osa) → sudo-liché sjednocení jen v rámci tělesa
      for (const r of eo(loc)) kruhy.push(r);
    }
    return kruhy.length ? sjednot(kruhy) : [];
  }
  function hloubkaOdpadu(dil, polotovar, F, h, v, max) {
    const P0 = zpet(F, h, v);
    for (let d = 0.25; d <= max + 0.3; d += 0.25) {
      const P = [P0[0] + F.dovnitr[0] * d, P0[1] + F.dovnitr[1] * d, P0[2] + F.dovnitr[2] * d];
      if (polotovar && !J.bodVTelese(polotovar, P)) return { skrz: true, d };
      if (J.bodVDilu(dil, P)) return { skrz: false, d };
    }
    return { skrz: true, d: max };
  }
  /** vnitřní bod mnohoúhelníku (s ohledem na díry) – nejdelší vodorovná úsečka v několika výškách */
  function vnitrniBod(outer, vse) {
    let y0 = Infinity, y1 = -Infinity;
    for (const q of outer) { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    const kand = [];
    for (let i = 1; i < 16; i++) {
      const y = y0 + (y1 - y0) * i / 16, xs = J.pruseciky(vse, 1, y);
      for (let j = 0; j + 1 < xs.length; j += 2) kand.push({ x: (xs[j] + xs[j + 1]) / 2, y, w: xs[j + 1] - xs[j], vys: y1 - y0 });
    }
    if (!kand.length) return null;
    const maxW = Math.max(...kand.map((q) => q.w)), ym = (y0 + y1) / 2;
    return kand.filter((q) => q.w >= 0.7 * maxW).sort((a, b) => Math.abs(a.y - ym) - Math.abs(b.y - ym))[0];
  }
  /** šrafování kruhů úhlopříčkami ±45° s roztečí r */
  function srafy(kruhy, r) {
    const out = [];
    for (const zn of [1, -1]) {
      // otočení o 45°: u = (x + zn·y)/√2, w = (−zn·x + y)/√2
      const s2 = Math.SQRT1_2, rot = kruhy.map((K_) => K_.map((q) => [(q[0] + zn * q[1]) * s2, (-zn * q[0] + q[1]) * s2]));
      let w0 = Infinity, w1 = -Infinity;
      for (const K_ of rot) for (const q of K_) { w0 = Math.min(w0, q[1]); w1 = Math.max(w1, q[1]); }
      for (let w = Math.ceil(w0 / r) * r + r * 0.5; w < w1; w += r) {
        const xs = J.pruseciky(rot, 1, w);
        for (let j = 0; j + 1 < xs.length; j += 2) {
          const a = [xs[j], w], b = [xs[j + 1], w];
          const zp = (q) => [(q[0] - zn * q[1]) * s2, (zn * q[0] + q[1]) * s2];
          out.push([zp(a), zp(b)]);
        }
      }
    }
    return out;
  }
  /** rozdělí hranice kruhů A na úseky podle toho, co leží na druhé straně (fce strana(bod) → true = řez) */
  function hranyPodle(kruhy, test) {
    const out = [];
    for (const R of kruhy) for (let i = 0; i < R.length; i++) {
      const a = R[i], b = R[(i + 1) % R.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 1e-6) continue;
      const nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L, n = Math.max(1, Math.min(40, Math.ceil(L / 2)));
      let start = null;
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n, m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        const ok = test(m, nx, ny);
        const p0 = [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n];
        if (ok && start === null) start = p0;
        if (!ok && start !== null) { out.push([start, p0]); start = null; }
      }
      if (start !== null) out.push([start, b]);
    }
    return out;
  }

  /**
   * šablona jednoho dílu: S = sestava z jádra, sp = předpis (S.sablony[i])
   * vrací scénu {x0,y0,w,h,prvky, listy?, nazev}
   */
  function sablona(S, sp, o) {
    o = Object.assign({ kerf: S.p.kerf, srafy: 2.5 }, o || {});
    const dil = S.dily.find((d) => d.id === sp.dil);
    const plochy = plochyRozvinu(sp);
    const prvky = [];
    let H0 = Infinity, H1 = -Infinity, V0 = Infinity, V1 = -Infinity;
    const statistika = { odpady: [], rezy: 0 };
    for (const F of plochy) {
      const ok = F.okno, okR = [obdelnik(ok)];
      H0 = Math.min(H0, ok[0]); H1 = Math.max(H1, ok[1]); V0 = Math.min(V0, ok[2]); V1 = Math.max(V1, ok[3]);
      const sec = prunik(rezVPloše(dil.telesa, F), okR);
      const blank = dil.polotovar ? prunik(rezVPloše([dil.polotovar], F), okR) : sec;
      const odpad = rozdil(blank, sec);
      const odpadM = odpad.filter((r) => plochaKruhu(r) > 0.05);
      // výplň a šrafy odpadu
      if (odpadM.length) {
        prvky.push({ t: 'p', b: odpadM, v: 'odpadVypln' });
        for (const s of srafy(odpadM, o.srafy)) prvky.push({ t: 'l', b: s, v: 'odpad', s: 0.18 });
        // pruh řezu pilou na odpadní straně
        if (o.kerf > 0 && sec.length) {
          const pruh = prunik(odsad(sec, o.kerf), odpadM);
          if (pruh.length) prvky.push({ t: 'p', b: pruh, v: 'pila' });
        }
      }
      // hranice: řez (dřevo | odpad), obrys polotovaru, přerušení oknem
      const vOdpadu = (x, y) => uvnitr(x, y, odpad) && !uvnitr(x, y, sec);
      const rez = hranyPodle(sec, (m, nx, ny) => { const e = 0.06; return vOdpadu(m[0] + nx * e, m[1] + ny * e) || vOdpadu(m[0] - nx * e, m[1] - ny * e); });
      statistika.rezy += rez.length;
      for (const s of rez) prvky.push({ t: 'l', b: s, v: 'rez', s: 0.35 });
      // hrana na okraji okna: pokračuje-li za ní polotovar, je to jen přerušení (čárkovaně)
      const pokracuje = (m, nx, ny) => {
        const na = Math.abs(m[0] - ok[0]) < 0.03 || Math.abs(m[0] - ok[1]) < 0.03 || Math.abs(m[1] - ok[2]) < 0.03 || Math.abs(m[1] - ok[3]) < 0.03;
        if (!na || !dil.polotovar) return false;
        for (const sg of [1, -1]) {
          const hx = m[0] + sg * nx * 0.2, hy = m[1] + sg * ny * 0.2;
          if (hx > ok[0] && hx < ok[1] && hy > ok[2] && hy < ok[3]) continue;
          const P = zpet(F, hx, hy), Q = [P[0] + F.dovnitr[0] * 0.01, P[1] + F.dovnitr[1] * 0.01, P[2] + F.dovnitr[2] * 0.01];
          return J.bodVTelese(dil.polotovar, Q);
        }
        return false;
      };
      const obr = hranyPodle(blank, (m, nx, ny) => !pokracuje(m, nx, ny));
      for (const s of obr) prvky.push({ t: 'l', b: s, v: 'obrys', s: 0.25 });
      const prer = hranyPodle(blank, (m, nx, ny) => pokracuje(m, nx, ny));
      for (const s of prer) prvky.push({ t: 'l', b: s, v: 'pomoc', s: 0.15, d: true });
      // popisky odpadu (hloubka)
      for (const R of odpadM) {
        if (J.plocha(R) < 0 && odpadM.length > 1) {
          // díra v odpadu (Clipper vrací díry s opačnou orientací) – přeskočit
          const vnejsi = odpadM.some((Q) => Q !== R && J.plocha(Q) > 0 && uvnitr(R[0][0], R[0][1], [Q]));
          if (vnejsi) continue;
        }
        const b = vnitrniBod(R, odpadM.filter((Q) => Q === R || J.plocha(Q) < 0));
        if (!b) continue;
        const max = Math.max(...[0, 1, 2].map((i) => Math.abs(dil.polotovar ? (J.mezeTelesa(dil.polotovar)[2 * i + 1] - J.mezeTelesa(dil.polotovar)[2 * i]) * Math.abs(F.dovnitr[i]) : 0)));
        const hl = hloubkaOdpadu(dil, dil.polotovar, F, b.x, b.y, max || 100);
        statistika.odpady.push({ plocha: F.nazev, skrz: hl.skrz, hloubka: hl.d, plochaMm2: Math.abs(J.plocha(R)) });
        const vel = Math.min(3.2, b.w * 0.42, b.vys * 0.5);
        if (vel >= 1.2) {
          prvky.push({ t: 'txt', x: b.x, y: b.y + vel * 0.6, h: vel * 1.5, txt: 'X', a: 'c', v: 'odpadText' });
          if (vel >= 1.8 && b.vys > vel * 4.2) prvky.push({ t: 'txt', x: b.x, y: b.y - vel * 1.1, h: vel * 0.75, txt: hl.skrz ? 'skrz' : 'hl. ' + fmt(hl.d, 1), a: 'c', v: 'odpadText' });
        }
      }
      // značky (kolíky, lamely)
      for (const Z of sp.znacky || []) {
        if (Math.abs(Z[F.n] - F.c) > 0.6) continue;
        const m = mapa(F, Z);
        if (m[0] < ok[0] - 0.01 || m[0] > ok[1] + 0.01 || m[1] < ok[2] - 0.01 || m[1] > ok[3] + 0.01) continue;
        prvky.push({ t: 'l', b: [[m[0] - 4, m[1]], [m[0] + 4, m[1]]], v: 'znacka', s: 0.25 });
        prvky.push({ t: 'l', b: [[m[0], m[1] - 4], [m[0], m[1] + 4]], v: 'znacka', s: 0.25 });
        if (sp.znackaCara) prvky.push({ t: 'l', b: [[ok[0], m[1]], [ok[1], m[1]]], v: 'znacka', s: 0.2 });
      }
      // název plochy
      const sh = Math.min(2.6, (ok[1] - ok[0]) / 6, 2.6);
      if (F.nazev && sh >= 1.4) prvky.push({ t: 'txt', x: (ok[0] + ok[1]) / 2, y: ok[3] + 1.6, h: sh, txt: F.nazev, a: 'c', v: 'text' });
    }
    // ohyby mezi plochami
    for (let i = 0; i < plochy.length; i++) for (let j = i + 1; j < plochy.length; j++) {
      const a = plochy[i].okno, b = plochy[j].okno;
      if (Math.abs(a[1] - b[0]) < 1e-6 || Math.abs(b[1] - a[0]) < 1e-6) {
        const x = Math.abs(a[1] - b[0]) < 1e-6 ? a[1] : a[0], y0 = Math.max(a[2], b[2]), y1 = Math.min(a[3], b[3]);
        if (y1 > y0) prvky.push({ t: 'l', b: [[x, y0], [x, y1]], v: 'ohyb', s: 0.2, d: true });
      }
      if (Math.abs(a[3] - b[2]) < 1e-6 || Math.abs(b[3] - a[2]) < 1e-6) {
        const y = Math.abs(a[3] - b[2]) < 1e-6 ? a[3] : a[2], x0 = Math.max(a[0], b[0]), x1 = Math.min(a[1], b[1]);
        if (x1 > x0) prvky.push({ t: 'l', b: [[x0, y], [x1, y]], v: 'ohyb', s: 0.2, d: true });
      }
    }
    // hlavička
    const W = H1 - H0, top = V1 + 5;
    prvky.push({ t: 'txt', x: H0, y: top + 6.5, h: 6, txt: sp.dil, a: 'l', v: 'nadpis' });
    prvky.push({ t: 'txt', x: H0 + 6, y: top + 6.5, h: 3.4, txt: sp.nazev.replace(/^[A-C] – /, '') + ' · ' + S.nazev, a: 'l', v: 'text' });
    prvky.push({ t: 'txt', x: H0 + 6, y: top + 2.2, h: 2.2, txt: `${dil.nazev} · ${fmt(dil.rozmer.L)} × ${fmt(dil.rozmer.W)} × ${fmt(dil.rozmer.t)} mm · pila ${fmt(o.kerf, 2)} mm · čárkovaně = ohyb`, a: 'l', v: 'text' });
    const V1b = top + 9;
    // převod na osu y dolů
    const prevedB = (q) => [q[0], V1b - q[1]];
    const prv = prvky.map((e) => {
      if (e.t === 'txt') return Object.assign({}, e, { x: e.x, y: V1b - e.y });
      if (e.t === 'p') return Object.assign({}, e, { b: e.b.map((r) => r.map(prevedB)) });
      return Object.assign({}, e, { b: e.b.map(prevedB) });
    });
    return { x0: H0, y0: 0, w: W, h: V1b - V0, prvky: prv, nazev: sp.nazev, dil: sp.dil, statistika, plochy: plochy.map((F) => F.nazev) };
  }

  function vsechnySablony(S, o) { return S.sablony.map((sp) => sablona(S, sp, o)); }

  /* ================================================================
     TECHNICKÉ POHLEDY (průměty se skrytými hranami)
     ================================================================ */
  const POHLEDY = {
    y: { nazev: 'Pohled zepředu', k: [0, 2], z: [1, 1], k_osa: 1, kDivakovi: -1 },   // (x, z), divák v −y
    z: { nazev: 'Pohled shora', k: [0, 1], z: [1, 1], k_osa: 2, kDivakovi: 1 },      // (x, y), divák v +z
    x: { nazev: 'Pohled zleva', k: [1, 2], z: [-1, 1], k_osa: 0, kDivakovi: -1 },    // (−y, z), divák v −x
  };
  function priprav(S) {
    return S.dily.map((d, i) => ({ d, i, T: d.telesa.map((T) => ({ T, m: J.mezeTelesa(T), kr: [T.poly].concat(T.diry || []), ix: J.osyTelesa(T.osa) })) }));
  }
  function stitek(D, P) {
    for (const x of D) for (const q of x.T) {
      const m = q.m;
      if (P[0] <= m[0] || P[0] >= m[1] || P[1] <= m[2] || P[1] >= m[3] || P[2] <= m[4] || P[2] >= m[5]) continue;
      if (J.bodVTelese(q.T, P)) return x.i;
    }
    return -1;
  }
  function zakryto(D, S0, osa, zn) {
    for (const x of D) for (const q of x.T) {
      const m = q.m, o1 = (osa + 1) % 3, o2 = (osa + 2) % 3;
      if (S0[o1] <= m[2 * o1] || S0[o1] >= m[2 * o1 + 1] || S0[o2] <= m[2 * o2] || S0[o2] >= m[2 * o2 + 1]) continue;
      if (zn > 0 ? m[2 * osa + 1] <= S0[osa] : m[2 * osa] >= S0[osa]) continue;
      const T = q.T, ix = q.ix, uvw = J.z3D(T.osa, S0);
      if (ix[2] === osa) {
        if (zn > 0 ? T.w1 <= uvw[2] : T.w0 >= uvw[2]) continue;
        if (J.uvnitr(uvw[0], uvw[1], q.kr)) return true;
      } else {
        if (uvw[2] <= T.w0 || uvw[2] >= T.w1) continue;
        const k = ix[0] === osa ? 0 : 1, o = 1 - k;
        const xs = J.pruseciky(q.kr, o, uvw[o]);
        for (let i = 0; i + 1 < xs.length; i += 2) {
          if (zn > 0 ? xs[i + 1] > uvw[k] : xs[i] < uvw[k]) return true;
        }
      }
    }
    return false;
  }
  /** hrany sestavy v pohledu → {viditelne:[[a,b]], skryte:[[a,b]]} ve 3D */
  function hranyPohledu(S, klic, zona) {
    const PV = POHLEDY[klic], D = priprav(S), osa = PV.k_osa, zn = PV.kDivakovi;
    const vid = [], skr = [], E = 0.03, E2 = 0.05;
    const vZone = (P) => !zona || (P[0] >= zona[0] - 0.5 && P[0] <= zona[1] + 0.5 && P[1] >= zona[2] - 0.5 && P[1] <= zona[3] + 0.5 && P[2] >= zona[4] - 0.5 && P[2] <= zona[5] + 0.5);
    const zpracuj = (A, B, e1, e2) => {
      const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], L = Math.hypot(d[0], d[1], d[2]);
      if (L < 1e-4) return;
      const dn = d.map((x) => x / L);
      if (Math.abs(dn[osa]) > 0.999) return;   // hrana míří k divákovi
      // boční směr v rovině průmětu
      const lat = [0, 0, 0]; const vp = [0, 0, 0]; vp[osa] = 1;
      lat[0] = dn[1] * vp[2] - dn[2] * vp[1]; lat[1] = dn[2] * vp[0] - dn[0] * vp[2]; lat[2] = dn[0] * vp[1] - dn[1] * vp[0];
      const ll = Math.hypot(lat[0], lat[1], lat[2]) || 1; for (let i = 0; i < 3; i++) lat[i] /= ll;
      const n = Math.max(2, Math.min(48, Math.ceil(L / 1.2)));
      let stav = 0, od = 0;
      const zapis = (s, t0, t1) => {
        if (!s) return;
        const a = [A[0] + d[0] * t0, A[1] + d[1] * t0, A[2] + d[2] * t0], b = [A[0] + d[0] * t1, A[1] + d[1] * t1, A[2] + d[2] * t1];
        (s === 1 ? vid : skr).push([a, b]);
      };
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n, P = [A[0] + d[0] * t, A[1] + d[1] * t, A[2] + d[2] * t];
        let s = 0;
        if (vZone(P)) {
          const q = (a, b) => stitek(D, [P[0] + e1[0] * a + e2[0] * b, P[1] + e1[1] * a + e2[1] * b, P[2] + e1[2] * a + e2[2] * b]);
          const pp = q(E, E), pm = q(E, -E), mp = q(-E, E), mm = q(-E, -E);
          const rovina = (pp === pm && mp === mm) || (pp === mp && pm === mm);
          if (!rovina) {
            const S0 = [P[0], P[1], P[2]]; S0[osa] += zn * E;
            const v1 = [S0[0] + lat[0] * E2, S0[1] + lat[1] * E2, S0[2] + lat[2] * E2], v2 = [S0[0] - lat[0] * E2, S0[1] - lat[1] * E2, S0[2] - lat[2] * E2];
            s = (!zakryto(D, v1, osa, zn) || !zakryto(D, v2, osa, zn)) ? 1 : 2;
          }
        }
        if (s !== stav) { zapis(stav, od, k / n); stav = s; od = k / n; }
      }
      zapis(stav, od, 1);
    };
    const smer = (ix, i, s) => { const v = [0, 0, 0]; v[ix[i]] = s; return v; };
    for (const x of D) for (const q of x.T) {
      const T = q.T, ix = q.ix;
      for (const R of q.kr) {
        const n = R.length;
        for (let i = 0; i < n; i++) {
          const a = R[i], b = R[(i + 1) % n], du = b[0] - a[0], dv = b[1] - a[1], L = Math.hypot(du, dv);
          if (L < 1e-6) continue;
          const nu = -dv / L, nv = du / L;
          const e1 = smer(ix, 2, 1), e2 = [0, 0, 0]; e2[ix[0]] = nu; e2[ix[1]] = nv;
          for (const w of [T.w0, T.w1]) zpracuj(J.do3D(T.osa, a[0], a[1], w), J.do3D(T.osa, b[0], b[1], w), e1, e2);
          // svislá hrana ve vrcholu a (hladké vrcholy válců jen jako obrys)
          const p = R[(i + n - 1) % n], d1 = [a[0] - p[0], a[1] - p[1]], d2 = [du, dv];
          const l1 = Math.hypot(d1[0], d1[1]) || 1, cos = (d1[0] * d2[0] + d1[1] * d2[1]) / (l1 * L);
          if (cos > 0.9) {
            // obrys: normály sousedních hran mají vůči směru pohledu opačné znaménko
            const vp = [0, 0, 0]; vp[osa] = 1; const vu = vp[ix[0]], vv = vp[ix[1]];
            const n1 = -d1[1] * vu + d1[0] * vv, n2 = -d2[1] * vu + d2[0] * vv;
            if (n1 * n2 > 0) continue;
          }
          zpracuj(J.do3D(T.osa, a[0], a[1], T.w0), J.do3D(T.osa, a[0], a[1], T.w1), smer(ix, 0, 1), smer(ix, 1, 1));
        }
      }
    }
    return { viditelne: vid, skryte: skr };
  }
  function prumet(klic, P) { const PV = POHLEDY[klic]; return [PV.z[0] * P[PV.k[0]], PV.z[1] * P[PV.k[1]]]; }
  /** ořez úsečky obdélníkem (Liang–Barsky) */
  function orez(a, b, r) {
    let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
    const pq = [[-dx, a[0] - r[0]], [dx, r[1] - a[0]], [-dy, a[1] - r[2]], [dy, r[3] - a[1]]];
    for (const [p, q] of pq) {
      if (Math.abs(p) < 1e-12) { if (q < 0) return null; continue; }
      const t = q / p;
      if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
    }
    return [[a[0] + dx * t0, a[1] + dy * t0], [a[0] + dx * t1, a[1] + dy * t1]];
  }
  /** kóta (osa y nahoru): a, b v rovině pohledu, odsaz kolmo */
  function kota(a, b, odsaz, txt, vel) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (L < 0.2) return [];
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux, out = [];
    const A = [a[0] + nx * odsaz, a[1] + ny * odsaz], B = [b[0] + nx * odsaz, b[1] + ny * odsaz];
    const pres = odsaz >= 0 ? 1.5 : -1.5;
    if (Math.abs(odsaz) > 0.3) { out.push({ t: 'l', b: [a, [A[0] + nx * pres, A[1] + ny * pres]], v: 'kota', s: 0.13 }); out.push({ t: 'l', b: [b, [B[0] + nx * pres, B[1] + ny * pres]], v: 'kota', s: 0.13 }); }
    out.push({ t: 'l', b: [A, B], v: 'kota', s: 0.15 });
    const s = Math.min(1.8, L / 3), w = s * 0.32;
    out.push({ t: 'p', b: [[A, [A[0] + ux * s + nx * w, A[1] + uy * s + ny * w], [A[0] + ux * s - nx * w, A[1] + uy * s - ny * w]]], v: 'kota' });
    out.push({ t: 'p', b: [[B, [B[0] - ux * s + nx * w, B[1] - uy * s + ny * w], [B[0] - ux * s - nx * w, B[1] - uy * s - ny * w]]], v: 'kota' });
    let u = Math.atan2(uy, ux) * 180 / Math.PI;
    if (u > 90.01 || u < -89.99) u += 180;
    const sgn = 1;
    const ur = u * Math.PI / 180, tnx = -Math.sin(ur), tny = Math.cos(ur);
    out.push({ t: 'txt', x: (A[0] + B[0]) / 2 + tnx * 1.1 * sgn, y: (A[1] + B[1]) / 2 + tny * 1.1 * sgn, h: vel || 2.5, txt: txt || fmt(L, 1), a: 'c', u, v: 'kotaText' });
    return out;
  }
  /** jeden technický pohled jako scéna (osa y dolů) */
  function pohled(S, klic, o) {
    o = o || {};
    const z = S.zona, H = hranyPohledu(S, klic, z);
    const rohy = [];
    for (const x of [z[0], z[1]]) for (const y of [z[2], z[3]]) for (const w of [z[4], z[5]]) rohy.push(prumet(klic, [x, y, w]));
    const r = [Math.min(...rohy.map((q) => q[0])), Math.max(...rohy.map((q) => q[0])), Math.min(...rohy.map((q) => q[1])), Math.max(...rohy.map((q) => q[1]))];
    const prvky = [];
    for (const [a, b] of H.skryte) { const c = orez(prumet(klic, a), prumet(klic, b), r); if (c) prvky.push({ t: 'l', b: c, v: 'skryte', s: 0.18, d: true }); }
    for (const [a, b] of H.viditelne) { const c = orez(prumet(klic, a), prumet(klic, b), r); if (c) prvky.push({ t: 'l', b: c, v: 'hrana', s: 0.35 }); }
    // popisky dílů
    for (const d of S.dily) {
      const m = J.mezeDilu(d), c = [Math.max(z[0], Math.min(z[1], (Math.max(m[0], z[0]) + Math.min(m[1], z[1])) / 2)), (Math.max(m[2], z[2]) + Math.min(m[3], z[3])) / 2, (Math.max(m[4], z[4]) + Math.min(m[5], z[5])) / 2];
      if (d.kolik || d.lamela || d.id === 'C') continue;
      const q = prumet(klic, c);
      if (q[0] > r[0] && q[0] < r[1] && q[1] > r[2] && q[1] < r[3]) prvky.push({ t: 'txt', x: q[0], y: q[1] - 1.5, h: 4, txt: d.id, a: 'c', v: 'dilText' });
    }
    // kóty
    for (const k of S.koty || []) {
      if (k.pohled !== klic) continue;
      const a = prumet(klic, k.a), b = prumet(klic, k.b);
      for (const e of kota(a, b, k.odsaz || 0, k.popis ? fmt(Math.hypot(b[0] - a[0], b[1] - a[1]), 1) + ' ' + k.popis : null, 2.4)) prvky.push(e);
    }
    // převod na osu y dolů s rezervou na kóty
    let x0 = r[0], x1 = r[1], y0 = r[2], y1 = r[3];
    for (const e of prvky) {
      const body = e.t === 'txt' ? [[e.x, e.y]] : e.t === 'p' ? e.b.flat() : e.b;
      for (const q of body) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    }
    x0 -= 4; x1 += 4; y0 -= 4; y1 += 8;
    const fl = (q) => [q[0], -q[1]];
    const prv = prvky.map((e) => e.t === 'txt' ? Object.assign({}, e, { y: -e.y, u: e.u ? e.u : 0 }) : e.t === 'p' ? Object.assign({}, e, { b: e.b.map((R) => R.map(fl)) }) : Object.assign({}, e, { b: e.b.map(fl) }));
    prv.push({ t: 'txt', x: x0 + 1, y: -y1 + 4, h: 3, txt: POHLEDY[klic].nazev, a: 'l', v: 'text' });
    return { x0, y0: -y1, w: x1 - x0, h: y1 - y0, prvky: prv, nazev: POHLEDY[klic].nazev, pocty: { viditelne: H.viditelne.length, skryte: H.skryte.length } };
  }

  const API = { sablona, vsechnySablony, plochyRozvinu, rezTelesa, rezVPloše, pohled, hranyPohledu, POHLEDY, prumet, operace, sjednot, rozdil, prunik, odsad, srafy, kota, mapa, zpet };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.TSS = API;
})(typeof window !== 'undefined' ? window : globalThis);

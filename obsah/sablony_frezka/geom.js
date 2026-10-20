/* ============================================================
   Šablony pro horní frézku – geometrie (bez DOM)
   - oblast = pole mnohoúhelníků [[x, y], …] v mm, y nahoru; vnější obrys proti směru hodin (kladná plocha),
     díry po směru hodin; vyplnění nenulové (nonzero).
   - kontura = přesný obrys z úseček a oblouků: [{t:'u', a:[x,y], b:[x,y]} | {t:'o', c:[x,y], r, u0, u1}]
     (oblouk z úhlu u0 do u1 v radiánech; u1 > u0 = proti směru hodin).
   - primitiva s přesným ofsetem: zaoblený mnohoúhelník (zm), kruh, oblouková drážka, elipsa (rovnoběžná křivka).
   - ostatní (text, SVG) přes Clipper (clipper.min.js, Angus Johnson, Boost licence) s kulatým spojem.
   Export: window.SFG i module.exports.
   ============================================================ */
(function (koren) {
  'use strict';
  const CL = koren.ClipperLib || (typeof require !== 'undefined' ? require('../lib/clipper.min.js') : null);
  const SK = 1e4;                  // Clipper počítá v celých číslech: 1 jednotka = 0,1 µm
  const TOL = 0.002;               // tolerance vzorkování oblouků (průhyb tětivy) v mm
  const PI = Math.PI, DVA_PI = 2 * Math.PI;

  /* ---------------- základní vektory ---------------- */
  const pricti = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const odecti = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const nasob = (a, k) => [a[0] * k, a[1] * k];
  const delka = (a) => Math.hypot(a[0], a[1]);
  const jednot = (a) => { const l = delka(a) || 1; return [a[0] / l, a[1] / l]; };
  const skal = (a, b) => a[0] * b[0] + a[1] * b[1];
  const vekt = (a, b) => a[0] * b[1] - a[1] * b[0];
  const vzd = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const smer = (u) => [Math.cos(u), Math.sin(u)];

  /* ---------------- mnohoúhelníky ---------------- */
  function plocha(p) {
    let s = 0;
    for (let i = 0, n = p.length; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; }
    return s / 2;
  }
  const plochaOblasti = (polys) => polys.reduce((s, p) => s + plocha(p), 0);
  function obal(polys) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of polys) for (const q of p) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }
  const posun = (polys, dx, dy) => polys.map((p) => p.map((q) => [q[0] + dx, q[1] + dy]));
  const transformuj = (polys, f) => polys.map((p) => p.map(f));
  /** bod uvnitř oblasti (nenulové vyplnění) */
  function uvnitr(bod, polys) {
    let w = 0;
    const [x, y] = bod;
    for (const p of polys) for (let i = 0, n = p.length; i < n; i++) {
      const a = p[i], b = p[(i + 1) % n];
      if (a[1] <= y) { if (b[1] > y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) > 0) w++; }
      else if (b[1] <= y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) < 0) w--;
    }
    return w !== 0;
  }

  /* ---------------- Clipper ---------------- */
  const doC = (polys) => polys.filter((p) => p.length >= 3).map((p) => p.map((q) => ({ X: Math.round(q[0] * SK), Y: Math.round(q[1] * SK) })));
  const zC = (paths) => paths.map((p) => p.map((q) => [q.X / SK, q.Y / SK])).filter((p) => p.length >= 3 && Math.abs(plocha(p)) > 1e-7);
  const vypln = (ev) => (ev ? CL.PolyFillType.pftEvenOdd : CL.PolyFillType.pftNonZero);
  function sjednot(polys, sudyLichy) {
    const c = new CL.Clipper(); c.AddPaths(doC(polys), CL.PolyType.ptSubject, true);
    const s = new CL.Paths(); c.Execute(CL.ClipType.ctUnion, s, vypln(sudyLichy), vypln(sudyLichy));
    return zC(s);
  }
  function operace(a, b, typ) {
    const c = new CL.Clipper(); c.AddPaths(doC(a), CL.PolyType.ptSubject, true); c.AddPaths(doC(b), CL.PolyType.ptClip, true);
    const s = new CL.Paths(), t = { sjednoceni: CL.ClipType.ctUnion, rozdil: CL.ClipType.ctDifference, prunik: CL.ClipType.ctIntersection, xor: CL.ClipType.ctXor }[typ];
    c.Execute(t, s, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
    return zC(s);
  }
  const rozdil = (a, b) => operace(a, b, 'rozdil');
  const prunik = (a, b) => operace(a, b, 'prunik');
  const sjednoceni = (a, b) => operace(a, b, 'sjednoceni');
  /** ofset oblasti o d (kladné = zvětšení, záporné = zmenšení), kulatý spoj s tolerancí tol */
  function ofset(polys, d, tol) {
    const z = sjednot(polys);
    if (Math.abs(d) < 1e-9) return z;
    const co = new CL.ClipperOffset(2, Math.max(1, (tol || TOL) * SK));
    co.AddPaths(doC(z), CL.JoinType.jtRound, CL.EndType.etClosedPolygon);
    const s = new CL.Paths(); co.Execute(s, d * SK);
    return sjednot(zC(s));
  }
  /** části oblasti, které přežijí zmenšení o eps (odstraní tenké „třísky“ ze zaokrouhlení), vráceno v původní velikosti */
  function podstatne(polys, eps) {
    const e = eps || 0.015, j = ofset(polys, -e);
    if (!j.length) return [];
    return prunik(ofset(j, e + 0.002), polys);
  }
  /** rozdělení oblasti na souvislé části (vnější obrys + jeho díry) */
  function komponenty(polys) {
    const vnejsi = polys.filter((p) => plocha(p) > 0), diry = polys.filter((p) => plocha(p) < 0);
    const out = vnejsi.map((p) => [p]);
    for (const d of diry) {
      let best = null, bp = Infinity;
      for (const c of out) { const a = plocha(c[0]); if (a < bp && uvnitr(d[0], [c[0]])) { best = c; bp = a; } }
      if (best) best.push(d);
    }
    return out;
  }

  /* ---------------- kontury (přesné obrysy) ---------------- */
  /** počet úseků oblouku poloměru r a úhlu du, aby průhyb tětivy ≤ tol */
  function useku(r, du, tol) {
    if (r <= 1e-9) return 1;
    const t = Math.min(tol || TOL, r * 0.5), krok = 2 * Math.acos(1 - t / r);
    return Math.max(2, Math.ceil(Math.abs(du) / krok));
  }
  /** kontura → body uzavřeného mnohoúhelníku (koncový bod každého úseku = začátek dalšího) */
  function konturaNaBody(k, tol) {
    const out = [];
    for (const s of k) {
      if (s.t === 'u') out.push([s.a[0], s.a[1]]);
      else {
        const n = useku(s.r, s.u1 - s.u0, tol);
        for (let i = 0; i < n; i++) { const u = s.u0 + (s.u1 - s.u0) * i / n; out.push([s.c[0] + s.r * Math.cos(u), s.c[1] + s.r * Math.sin(u)]); }
      }
    }
    // odstranit duplicitní sousedy
    return out.filter((q, i) => vzd(q, out[(i + 1) % out.length]) > 1e-9);
  }
  const zacatek = (s) => (s.t === 'u' ? s.a : [s.c[0] + s.r * Math.cos(s.u0), s.c[1] + s.r * Math.sin(s.u0)]);
  const konec = (s) => (s.t === 'u' ? s.b : [s.c[0] + s.r * Math.cos(s.u1), s.c[1] + s.r * Math.sin(s.u1)]);
  /** délka kontury */
  const delkaKontury = (k) => k.reduce((s, q) => s + (q.t === 'u' ? vzd(q.a, q.b) : Math.abs(q.u1 - q.u0) * q.r), 0);
  /** obrácení směru kontury (vnější ↔ díra) */
  const obratKonturu = (k) => k.slice().reverse().map((s) => (s.t === 'u' ? { t: 'u', a: s.b, b: s.a } : { t: 'o', c: s.c, r: s.r, u0: s.u1, u1: s.u0 }));
  /** kontura → polyline s vydutím (bulge) pro DXF: [{x, y, b}] */
  function konturaNaVyduti(k) {
    return k.map((s) => { const a = zacatek(s); return { x: a[0], y: a[1], b: s.t === 'o' ? Math.tan((s.u1 - s.u0) / 4) : 0 }; });
  }
  /** kontura → SVG cesta (y převrácené); oblouky jako A */
  function konturaNaSvg(k, f) {
    const F = f || ((x) => (Math.round(x * 1000) / 1000).toString());
    let d = '';
    k.forEach((s, i) => {
      const a = zacatek(s), b = konec(s);
      if (!i) d += `M${F(a[0])} ${F(-a[1])}`;
      if (s.t === 'u') d += `L${F(b[0])} ${F(-b[1])}`;
      else {
        const du = s.u1 - s.u0;
        if (Math.abs(du) >= DVA_PI - 1e-9) {          // celý kruh = dva půloblouky
          const m = [s.c[0] + s.r * Math.cos(s.u0 + du / 2), s.c[1] + s.r * Math.sin(s.u0 + du / 2)], sw = du > 0 ? 0 : 1;
          d += `A${F(s.r)} ${F(s.r)} 0 0 ${sw} ${F(m[0])} ${F(-m[1])}A${F(s.r)} ${F(s.r)} 0 0 ${sw} ${F(b[0])} ${F(-b[1])}`;
        } else d += `A${F(s.r)} ${F(s.r)} 0 ${Math.abs(du) > PI ? 1 : 0} ${du > 0 ? 0 : 1} ${F(b[0])} ${F(-b[1])}`;
      }
    });
    return d + 'Z';
  }

  /* ---------------- zaoblený mnohoúhelník ---------------- */
  /** orientace proti směru hodin (body i poloměry se otočí spolu) */
  function zmCCW(body, r) {
    if (plocha(body) >= 0) return { body: body.slice(), r: r.slice() };
    return { body: body.slice().reverse(), r: r.slice().reverse() };
  }
  /**
   * zaoblený mnohoúhelník → kontura; null, když se zaoblení nevejdou na hrany.
   * body proti směru hodin, r[i] = poloměr zaoblení ve vrcholu i (0 = ostrý).
   */
  function zmKontura(body, r) {
    const n = body.length, info = [];
    for (let i = 0; i < n; i++) {
      const P = body[i], A = body[(i + n - 1) % n], B = body[(i + 1) % n];
      const e1 = jednot(odecti(P, A)), e2 = jednot(odecti(B, P));
      const delta = Math.atan2(vekt(e1, e2), skal(e1, e2)), ri = Math.max(0, +r[i] || 0);
      if (ri < 1e-9 || Math.abs(delta) < 1e-9) { info.push({ P, t: 0 }); continue; }
      const t = ri * Math.tan(Math.abs(delta) / 2), T1 = odecti(P, nasob(e1, t)), T2 = pricti(P, nasob(e2, t));
      const nrm = delta > 0 ? [-e1[1], e1[0]] : [e1[1], -e1[0]], C = pricti(T1, nasob(nrm, ri));
      const u0 = Math.atan2(T1[1] - C[1], T1[0] - C[0]);
      info.push({ P, t, T1, T2, C, r: ri, u0, u1: u0 + delta });
    }
    for (let i = 0; i < n; i++) {
      const a = info[i], b = info[(i + 1) % n];
      if (a.t + b.t > vzd(a.P, b.P) + 1e-7) return null;
    }
    const k = [];
    for (let i = 0; i < n; i++) {
      const a = info[i], b = info[(i + 1) % n];
      if (a.t > 0) k.push({ t: 'o', c: a.C, r: a.r, u0: a.u0, u1: a.u1 });
      const s = a.t > 0 ? a.T2 : a.P, e = b.t > 0 ? b.T1 : b.P;
      if (vzd(s, e) > 1e-9) k.push({ t: 'u', a: s, b: e });
    }
    return k;
  }
  /**
   * přesný ofset zaobleného mnohoúhelníku o d: hrany se posunou po vnější normále, v konvexním vrcholu
   * poloměr r + d, v nekonvexním r − d (záporný → ostrý roh). Null, když se hrana obrátí nebo zanikne.
   */
  function zmOfset(body, r, d) {
    const n = body.length, nb = [], nr = [];
    const nrm = (a, b) => { const e = jednot(odecti(b, a)); return [e[1], -e[0]]; };
    for (let i = 0; i < n; i++) {
      const A = body[(i + n - 1) % n], P = body[i], B = body[(i + 1) % n];
      const n1 = nrm(A, P), n2 = nrm(P, B), k = 1 + skal(n1, n2);
      if (k < 1e-6) return null;
      nb.push(pricti(P, nasob(pricti(n1, n2), d / k)));
      const e1 = jednot(odecti(P, A)), e2 = jednot(odecti(B, P)), konv = vekt(e1, e2) > 0;
      nr.push(Math.max(0, (+r[i] || 0) + (konv ? d : -d)));
    }
    for (let i = 0; i < n; i++) {
      const s0 = odecti(body[(i + 1) % n], body[i]), s1 = odecti(nb[(i + 1) % n], nb[i]);
      if (skal(s0, s1) <= 1e-9) return null;
    }
    return zmKontura(nb, nr) ? { body: nb, r: nr } : null;
  }

  /* ---------------- primitiva ---------------- */
  /** kontura kruhu (proti směru hodin) */
  const kruhKontura = (c, r) => [{ t: 'o', c: c.slice(), r, u0: 0, u1: DVA_PI }];
  /** oblouková drážka: střed c, poloměr osy R, šířka w, od úhlu u0 do u1 (u1 > u0), kulaté konce */
  function drazkaKontura(c, R, w, u0, u1) {
    const ro = R + w / 2, ri = R - w / 2, h = w / 2, k = [];
    const kon = (u) => [c[0] + R * Math.cos(u), c[1] + R * Math.sin(u)];
    k.push({ t: 'o', c: c.slice(), r: ro, u0, u1 });
    k.push({ t: 'o', c: kon(u1), r: h, u0: u1, u1: u1 + PI });
    if (ri > 1e-9) k.push({ t: 'o', c: c.slice(), r: ri, u0: u1, u1: u0 });
    k.push({ t: 'o', c: kon(u0), r: h, u0: u0 + PI, u1: u0 + DVA_PI });
    return k;
  }
  /** rovnoběžná křivka elipsy (poloosy a ≥ b) ve vzdálenosti d (d0 = už provedený ofset); body proti směru hodin */
  function elipsaBody(c, a, b, d, n) {
    const N = n || Math.max(360, Math.min(4000, Math.round(PI * (a + b) / 0.4))), out = [];
    for (let i = 0; i < N; i++) {
      const t = DVA_PI * i / N, ct = Math.cos(t), st = Math.sin(t), nx = b * ct, ny = a * st, l = Math.hypot(nx, ny);
      out.push([c[0] + a * ct + d * nx / l, c[1] + b * st + d * ny / l]);
    }
    return out;
  }

  /**
   * prim: {typ:'zm', body, r} | {typ:'kruh', c, r} | {typ:'drazka', c, R, w, u0, u1} | {typ:'elipsa', c, a, b, d}
   * primOfset(p, d) → nové primitivum nebo null (přesný ofset neexistuje → Clipper)
   */
  function primOfset(p, d) {
    if (p.typ === 'kruh') return p.r + d > 1e-6 ? { typ: 'kruh', c: p.c, r: p.r + d } : null;
    if (p.typ === 'zm') { const z = zmOfset(p.body, p.r, d); return z ? { typ: 'zm', body: z.body, r: z.r } : null; }
    if (p.typ === 'drazka') {
      // vnitřní poloměr kladný a konce se v mezeře oblouku nedotknou (tětiva mezi středy konců > šířka)
      const w = p.w + 2 * d, mezera = DVA_PI - (p.u1 - p.u0);
      const ok = w > 1e-6 && p.R - w / 2 > 1e-6 && (mezera >= PI || 2 * p.R * Math.sin(mezera / 2) > w + 1e-6);
      return ok ? Object.assign({}, p, { w }) : null;
    }
    if (p.typ === 'elipsa') { const dd = (p.d || 0) + d, a = Math.max(p.a, p.b), b = Math.min(p.a, p.b); return dd > -b * b / a + 1e-3 ? Object.assign({}, p, { d: dd }) : null; }
    return null;
  }
  function primKontura(p) {
    if (p.typ === 'kruh') return kruhKontura(p.c, p.r);
    if (p.typ === 'zm') { const z = zmCCW(p.body, p.r); return zmKontura(z.body, z.r); }
    if (p.typ === 'drazka') return drazkaKontura(p.c, p.R, p.w, p.u0, p.u1);
    if (p.typ === 'elipsa') {
      const b = elipsaBody(p.c, p.a, p.b, p.d || 0);
      return b.map((q, i) => ({ t: 'u', a: q, b: b[(i + 1) % b.length] }));
    }
    return null;
  }

  /**
   * tvar = {polys (oblast), kontury: [kontura]|null, prim: [primitiva]|null}
   * tvarZPrimitiv(prim) – sjednocení primitiv; přesné kontury jen když se primitiva nepřekrývají
   */
  function tvarZPrimitiv(prim) {
    const kont = prim.map(primKontura);
    if (kont.some((k) => !k)) return null;
    const casti = kont.map((k) => { const b = konturaNaBody(k); return plocha(b) < 0 ? b.reverse() : b; });
    const polys = sjednot(casti), soucet = casti.reduce((s, p) => s + Math.abs(plocha(p)), 0), a = plochaOblasti(polys);
    const disjunktni = Math.abs(a - soucet) <= 1e-4 * soucet + 0.05;
    return { polys, kontury: disjunktni ? kont.map((k) => (plocha(konturaNaBody(k)) < 0 ? obratKonturu(k) : k)) : null, prim: disjunktni ? prim : null };
  }
  const tvarZOblasti = (polys) => ({ polys: sjednot(polys), kontury: null, prim: null });
  /** ofset tvaru o d: přesně přes primitiva, jinak Clipper; kontrola plochou proti Clipperu */
  function ofsetTvaru(tv, d) {
    if (Math.abs(d) < 1e-9) return tv;
    const cl = ofset(tv.polys, d);
    if (tv.prim) {
      const np = tv.prim.map((p) => primOfset(p, d));
      if (np.every(Boolean)) {
        const t = tvarZPrimitiv(np);
        if (t && t.kontury) {
          const a = plochaOblasti(t.polys), b = plochaOblasti(cl), obvod = t.kontury.reduce((s, k) => s + delkaKontury(k), 0);
          if (Math.abs(a - b) <= obvod * 0.01 + 0.05) return t;
        }
      }
    }
    return { polys: cl, kontury: null, prim: null };
  }

  /* ---------------- vzdálenosti a Hausdorff ---------------- */
  function useckyHranice(polys) {
    const s = [];
    for (const p of polys) for (let i = 0, n = p.length; i < n; i++) s.push([p[i], p[(i + 1) % n]]);
    return s;
  }
  function vzdBodUsecka(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  /** mřížka úseček pro rychlé hledání nejbližší hranice */
  function mrizka(polys, bunka) {
    const s = useckyHranice(polys), o = obal(polys), c = bunka || Math.max(0.5, Math.sqrt((o.w * o.h) / Math.max(1, s.length)) * 2);
    const nx = Math.max(1, Math.ceil(o.w / c) + 1), ny = Math.max(1, Math.ceil(o.h / c) + 1), b = new Map();
    s.forEach((u, i) => {
      const ix0 = Math.floor((Math.min(u[0][0], u[1][0]) - o.x0) / c), ix1 = Math.floor((Math.max(u[0][0], u[1][0]) - o.x0) / c);
      const iy0 = Math.floor((Math.min(u[0][1], u[1][1]) - o.y0) / c), iy1 = Math.floor((Math.max(u[0][1], u[1][1]) - o.y0) / c);
      for (let x = ix0; x <= ix1; x++) for (let y = iy0; y <= iy1; y++) { const k = x * 100003 + y; if (!b.has(k)) b.set(k, []); b.get(k).push(i); }
    });
    return {
      vzdalenost(p) {
        if (!s.length) return Infinity;
        const ix = Math.floor((p[0] - o.x0) / c), iy = Math.floor((p[1] - o.y0) / c);
        let best = Infinity;
        const maxK = Math.max(nx, ny) + Math.ceil(Math.max(Math.abs(ix), Math.abs(iy), Math.abs(ix - nx), Math.abs(iy - ny)));
        for (let k = 0; k <= maxK; k++) {
          for (let x = ix - k; x <= ix + k; x++) for (let y = iy - k; y <= iy + k; y++) {
            if (Math.abs(x - ix) !== k && Math.abs(y - iy) !== k) continue;
            const L = b.get(x * 100003 + y); if (!L) continue;
            for (const i of L) { const d = vzdBodUsecka(p, s[i][0], s[i][1]); if (d < best) best = d; }
          }
          if (best <= k * c) break;
        }
        return best;
      },
    };
  }
  /** body na hranici po krocích ≤ krok */
  function vzorkujHranici(polys, krok) {
    const out = [], k = krok || 0.25;
    for (const p of polys) for (let i = 0, n = p.length; i < n; i++) {
      const a = p[i], b = p[(i + 1) % n], m = Math.max(1, Math.ceil(vzd(a, b) / k));
      for (let j = 0; j < m; j++) out.push([a[0] + (b[0] - a[0]) * j / m, a[1] + (b[1] - a[1]) * j / m]);
    }
    return out;
  }
  /** Hausdorffova vzdálenost hranic dvou oblastí → {max, ab (A od B), ba, bodAB, bodBA} */
  function hausdorff(A, B, krok) {
    if (!A.length || !B.length) return { max: Infinity, ab: Infinity, ba: Infinity };
    const mA = mrizka(A), mB = mrizka(B);
    let ab = 0, ba = 0, pa = null, pb = null;
    for (const p of vzorkujHranici(A, krok)) { const d = mB.vzdalenost(p); if (d > ab) { ab = d; pa = p; } }
    for (const p of vzorkujHranici(B, krok)) { const d = mA.vzdalenost(p); if (d > ba) { ba = d; pb = p; } }
    return { max: Math.max(ab, ba), ab, ba, bodAB: pa, bodBA: pb };
  }

  /* ---------------- SVG cesty ---------------- */
  /** afinní matice [a, b, c, d, e, f] (SVG: x' = a x + c y + e, y' = b x + d y + f) */
  const MAT_I = [1, 0, 0, 1, 0, 0];
  const matNasob = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const matBod = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
  function rozeberTransform(s) {
    let m = MAT_I.slice();
    const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
    let x;
    while ((x = re.exec(String(s || '')))) {
      const v = x[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
      let n = MAT_I;
      if (x[1] === 'matrix' && v.length === 6) n = v;
      else if (x[1] === 'translate') n = [1, 0, 0, 1, v[0] || 0, v[1] || 0];
      else if (x[1] === 'scale') n = [v[0], 0, 0, v.length > 1 ? v[1] : v[0], 0, 0];
      else if (x[1] === 'rotate') {
        const u = (v[0] || 0) * PI / 180, c = Math.cos(u), si = Math.sin(u), r = [c, si, -si, c, 0, 0];
        n = v.length >= 3 ? matNasob(matNasob([1, 0, 0, 1, v[1], v[2]], r), [1, 0, 0, 1, -v[1], -v[2]]) : r;
      } else if (x[1] === 'skewX') n = [1, 0, Math.tan((v[0] || 0) * PI / 180), 1, 0, 0];
      else if (x[1] === 'skewY') n = [1, Math.tan((v[0] || 0) * PI / 180), 0, 1, 0, 0];
      m = matNasob(m, n);
    }
    return m;
  }
  /** oblouk SVG (koncový tvar) → kubické Bézierovy úseky [[p0, c1, c2, p1], …] */
  function obloukNaBezier(p0, rx, ry, phi, fa, fs, p1) {
    if (vzd(p0, p1) < 1e-12) return [];
    rx = Math.abs(rx); ry = Math.abs(ry);
    if (rx < 1e-12 || ry < 1e-12) return [[p0, p0, p1, p1]];
    const cf = Math.cos(phi), sf = Math.sin(phi);
    const dx = (p0[0] - p1[0]) / 2, dy = (p0[1] - p1[1]) / 2, x1 = cf * dx + sf * dy, y1 = -sf * dx + cf * dy;
    const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
    if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }
    const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1, den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
    let co = Math.sqrt(Math.max(0, num / den)); if (fa === fs) co = -co;
    const cx1 = co * rx * y1 / ry, cy1 = -co * ry * x1 / rx;
    const cx = cf * cx1 - sf * cy1 + (p0[0] + p1[0]) / 2, cy = sf * cx1 + cf * cy1 + (p0[1] + p1[1]) / 2;
    const ug = (ux, uy, vx, vy) => { const d = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return d; };
    const t1 = ug(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
    let dt = ug((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
    if (!fs && dt > 0) dt -= DVA_PI; else if (fs && dt < 0) dt += DVA_PI;
    const n = Math.ceil(Math.abs(dt) / (PI / 2) - 1e-9), h = dt / n, k = 4 / 3 * Math.tan(h / 4), out = [];
    const bod = (t) => [cx + rx * Math.cos(t) * cf - ry * Math.sin(t) * sf, cy + rx * Math.cos(t) * sf + ry * Math.sin(t) * cf];
    const der = (t) => [-rx * Math.sin(t) * cf - ry * Math.cos(t) * sf, -rx * Math.sin(t) * sf + ry * Math.cos(t) * cf];
    for (let i = 0; i < n; i++) {
      const a = t1 + i * h, b = a + h, A = bod(a), B = bod(b), dA = der(a), dB = der(b);
      out.push([i ? A : p0, [A[0] + k * dA[0], A[1] + k * dA[1]], [B[0] - k * dB[0], B[1] - k * dB[1]], i === n - 1 ? p1 : B]);
    }
    return out;
  }
  /** SVG atribut d → podcesty: [{body: úseky [{t:'u',p0,p1}|{t:'c',p0,c1,c2,p1}], uzavrena}] */
  function rozeberCestu(d) {
    const tok = String(d || '').match(/[a-df-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || [];
    const out = [];
    let i = 0, cmd = '', cur = [0, 0], start = [0, 0], sub = null, lastC = null, lastQ = null;
    const cislo = () => parseFloat(tok[i++]);
    const jeCislo = () => i < tok.length && !/^[a-df-z]$/i.test(tok[i]);
    const nova = () => { sub = { useky: [], uzavrena: false }; out.push(sub); };
    const L = (p) => { if (!sub) nova(); sub.useky.push({ t: 'u', p0: cur, p1: p }); cur = p; };
    const C = (c1, c2, p) => { if (!sub) nova(); sub.useky.push({ t: 'c', p0: cur, c1, c2, p1: p }); cur = p; };
    while (i < tok.length) {
      if (/^[a-df-z]$/i.test(tok[i])) cmd = tok[i++];
      else if (!cmd) { i++; continue; }
      const rel = cmd === cmd.toLowerCase(), C0 = cmd.toUpperCase(), o = rel ? cur : [0, 0];
      if (C0 === 'Z') { if (sub) { if (vzd(cur, start) > 1e-12) L(start); sub.uzavrena = true; } cur = start; sub = null; lastC = lastQ = null; continue; }
      if (!jeCislo()) { continue; }
      if (C0 === 'M') {
        const p = [o[0] + cislo(), o[1] + cislo()]; cur = p; start = p; nova(); cmd = rel ? 'l' : 'L'; lastC = lastQ = null; continue;
      }
      if (C0 === 'L') { L([o[0] + cislo(), o[1] + cislo()]); lastC = lastQ = null; }
      else if (C0 === 'H') { L([(rel ? cur[0] : 0) + cislo(), cur[1]]); lastC = lastQ = null; }
      else if (C0 === 'V') { L([cur[0], (rel ? cur[1] : 0) + cislo()]); lastC = lastQ = null; }
      else if (C0 === 'C') { const c1 = [o[0] + cislo(), o[1] + cislo()], c2 = [o[0] + cislo(), o[1] + cislo()], p = [o[0] + cislo(), o[1] + cislo()]; C(c1, c2, p); lastC = c2; lastQ = null; }
      else if (C0 === 'S') { const c1 = lastC ? [2 * cur[0] - lastC[0], 2 * cur[1] - lastC[1]] : cur, c2 = [o[0] + cislo(), o[1] + cislo()], p = [o[0] + cislo(), o[1] + cislo()]; C(c1, c2, p); lastC = c2; lastQ = null; }
      else if (C0 === 'Q' || C0 === 'T') {
        const q = C0 === 'Q' ? [o[0] + cislo(), o[1] + cislo()] : (lastQ ? [2 * cur[0] - lastQ[0], 2 * cur[1] - lastQ[1]] : cur), p = [o[0] + cislo(), o[1] + cislo()];
        C([cur[0] + 2 / 3 * (q[0] - cur[0]), cur[1] + 2 / 3 * (q[1] - cur[1])], [p[0] + 2 / 3 * (q[0] - p[0]), p[1] + 2 / 3 * (q[1] - p[1])], p); lastQ = q; lastC = null;
      } else if (C0 === 'A') {
        const rx = cislo(), ry = cislo(), phi = cislo() * PI / 180, fa = !!cislo(), fs = !!cislo(), p = [o[0] + cislo(), o[1] + cislo()];
        for (const b of obloukNaBezier(cur, rx, ry, phi, fa, fs, p)) C(b[1], b[2], b[3]);
        cur = p; lastC = lastQ = null;
      } else i++;
    }
    return out.filter((s) => s.useky.length);
  }
  /** zploštění podcest s maticí m a tolerancí tol (v jednotkách po transformaci) → mnohoúhelníky */
  function zplostiCesty(podcesty, m, tol) {
    const M = m || MAT_I, t = tol || 0.01, out = [];
    for (const s of podcesty) {
      const b = [matBod(M, s.useky[0].p0)];
      for (const u of s.useky) {
        if (u.t === 'u') { b.push(matBod(M, u.p1)); continue; }
        const P = [u.p0, u.c1, u.c2, u.p1].map((q) => matBod(M, q));
        const dl = vzd(P[0], P[1]) + vzd(P[1], P[2]) + vzd(P[2], P[3]);
        const n = Math.max(2, Math.min(400, Math.ceil(Math.sqrt(dl / (8 * t)) * 1.5)));
        for (let j = 1; j <= n; j++) {
          const q = j / n, r = 1 - q;
          b.push([r * r * r * P[0][0] + 3 * r * r * q * P[1][0] + 3 * r * q * q * P[2][0] + q * q * q * P[3][0], r * r * r * P[0][1] + 3 * r * r * q * P[1][1] + 3 * r * q * q * P[2][1] + q * q * q * P[3][1]]);
        }
      }
      const c = b.filter((q, i) => i === 0 || vzd(q, b[i - 1]) > 1e-9);
      if (c.length > 2 && vzd(c[0], c[c.length - 1]) < 1e-9) c.pop();
      if (c.length >= 3) out.push({ body: c, uzavrena: s.uzavrena || vzd(c[0], c[c.length - 1]) < 1e-6 });
    }
    return out;
  }
  /** jednoduché prvky SVG → atribut d */
  function prvekNaCestu(tag, a) {
    const n = (k, v) => (a[k] != null && a[k] !== '' ? parseFloat(a[k]) : (v || 0));
    if (tag === 'path') return a.d || '';
    if (tag === 'rect') {
      const x = n('x'), y = n('y'), w = n('width'), h = n('height');
      let rx = a.rx != null ? n('rx') : a.ry != null ? n('ry') : 0, ry = a.ry != null ? n('ry') : rx;
      rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
      if (!(w > 0 && h > 0)) return '';
      if (!rx || !ry) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
      return `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`;
    }
    if (tag === 'circle' || tag === 'ellipse') {
      const cx = n('cx'), cy = n('cy'), rx = tag === 'circle' ? n('r') : n('rx'), ry = tag === 'circle' ? n('r') : n('ry');
      if (!(rx > 0 && ry > 0)) return '';
      return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
    }
    if (tag === 'polygon' || tag === 'polyline') {
      const v = String(a.points || '').trim().split(/[\s,]+/).map(Number);
      if (v.length < 6) return '';
      let d = `M${v[0]} ${v[1]}`; for (let i = 2; i + 1 < v.length; i += 2) d += `L${v[i]} ${v[i + 1]}`;
      return d + 'Z';
    }
    return '';
  }

  /* ---------------- písmo (příkazy opentype.js) ---------------- */
  /** příkazy cesty opentype (M L C Q Z; y dolů) → podcesty jako u SVG */
  function prikazyNaPodcesty(cmds) {
    let d = '';
    for (const c of cmds) {
      if (c.type === 'M') d += `M${c.x} ${c.y}`;
      else if (c.type === 'L') d += `L${c.x} ${c.y}`;
      else if (c.type === 'C') d += `C${c.x1} ${c.y1} ${c.x2} ${c.y2} ${c.x} ${c.y}`;
      else if (c.type === 'Q') d += `Q${c.x1} ${c.y1} ${c.x} ${c.y}`;
      else if (c.type === 'Z') d += 'Z';
    }
    return rozeberCestu(d);
  }

  const API = {
    SK, TOL, pricti, odecti, nasob, delka, jednot, skal, vekt, vzd, smer,
    plocha, plochaOblasti, obal, posun, transformuj, uvnitr,
    sjednot, operace, rozdil, prunik, sjednoceni, ofset, podstatne, komponenty,
    useku, konturaNaBody, delkaKontury, obratKonturu, konturaNaVyduti, konturaNaSvg, zacatek, konec,
    zmCCW, zmKontura, zmOfset, kruhKontura, drazkaKontura, elipsaBody, primOfset, primKontura, tvarZPrimitiv, tvarZOblasti, ofsetTvaru,
    vzdBodUsecka, mrizka, vzorkujHranici, hausdorff,
    MAT_I, matNasob, matBod, rozeberTransform, obloukNaBezier, rozeberCestu, zplostiCesty, prvekNaCestu, prikazyNaPodcesty,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.SFG = API;
})(typeof window !== 'undefined' ? window : globalThis);

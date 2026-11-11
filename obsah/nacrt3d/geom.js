/* Z náčrtu do 3D – rovinná geometrie prvků (bez DOM, jde v node).
   Prvek se rozloží na primitiva s parametrem t:
     {typ: 'u', a, b}            úsečka, bod = a + t·(b − a), t ∈ [0, 1]
     {typ: 'o', c, r, u0, sw}    oblouk, bod = c + r·(cos(u0 + t·sw), sin(u0 + t·sw)), t ∈ [0, 1]
     {typ: 'k', c, r}            kružnice, t = úhel / 2π (bez mezí)
     {typ: 'p', a, d}            přímka (vodicí linka) bodem a se směrem d (jednotkový), t ∈ ℝ
   Každé primitivum nese {prvek (id), i (index úseku)}. Průsečíky vrací body s parametry obou primitiv. */
var N3D = globalThis.N3D = globalThis.N3D || {};
(function (N) {
  'use strict';
  const { hypot, atan2, atan, cos, sin, abs, sqrt, PI, max, min } = Math;
  const EPS = 1e-9;

  /** Oblouk z vyboulení: {c, r, u0, sw} (stejná orientace jako N.bodyOblouku). */
  function oblouk(a, c, bb) {
    const dx = c.x - a.x, dy = c.y - a.y, tet = hypot(dx, dy), th = 4 * atan(bb);
    const r = tet / (2 * sin(abs(th) / 2));
    const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2, h = r * cos(abs(th) / 2) * (bb > 0 ? -1 : 1);
    const sx = mx - dy / tet * h, sy = my + dx / tet * h;
    return { c: [sx, sy], r, u0: atan2(a.y - sy, a.x - sx), sw: -th };
  }
  N.obloukZVybouleni = oblouk;

  /** Primitiva prvku (kóty nemají). */
  N.primitivaPrvku = function (p) {
    if (p.druh === 'kruh') return [{ typ: 'k', c: [p.x, p.y], r: p.r, prvek: p.id, i: 0 }];
    if (p.druh !== 'cara') return [];
    const B = p.body, n = B.length, out = [];
    for (let i = 0; i < (p.zavrena ? n : n - 1); i++) {
      const a = B[i], c = B[(i + 1) % n];
      if (hypot(c.x - a.x, c.y - a.y) < EPS) continue;
      if (a.b) out.push(Object.assign(oblouk(a, c, a.b), { typ: 'o', prvek: p.id, i }));
      else out.push({ typ: 'u', a: [a.x, a.y], b: [c.x, c.y], prvek: p.id, i });
    }
    return out;
  };
  /** Vodicí linka {id, a: [x, y], u: úhel} → přímka. */
  N.primitivumVoditka = v => ({ typ: 'p', a: v.a, d: [cos(v.u), sin(v.u)], prvek: v.id, i: 0, voditko: true });

  /** Bod primitiva v parametru t. */
  N.bodPrimitiva = function (q, t) {
    if (q.typ === 'u') return [q.a[0] + t * (q.b[0] - q.a[0]), q.a[1] + t * (q.b[1] - q.a[1])];
    if (q.typ === 'p') return [q.a[0] + t * q.d[0], q.a[1] + t * q.d[1]];
    const u = q.typ === 'o' ? q.u0 + t * q.sw : 2 * PI * t;
    return [q.c[0] + q.r * cos(u), q.c[1] + q.r * sin(u)];
  };
  /** Parametr bodu ležícího na primitivu (u oblouku mimo rozsah může vyjít < 0 nebo > 1). */
  function parametr(q, x, y) {
    if (q.typ === 'u') { const dx = q.b[0] - q.a[0], dy = q.b[1] - q.a[1]; return ((x - q.a[0]) * dx + (y - q.a[1]) * dy) / (dx * dx + dy * dy); }
    if (q.typ === 'p') return (x - q.a[0]) * q.d[0] + (y - q.a[1]) * q.d[1];
    const u = atan2(y - q.c[1], x - q.c[0]);
    if (q.typ === 'k') { let t = u / (2 * PI); if (t < 0) t += 1; return t; }
    let d = u - q.u0;
    if (q.sw > 0) { while (d < -1e-12) d += 2 * PI; while (d >= 2 * PI) d -= 2 * PI; }
    else { while (d > 1e-12) d -= 2 * PI; while (d <= -2 * PI) d += 2 * PI; }
    let t = d / q.sw;
    // bod těsně před začátkem oblouku (d ≈ 2π) ber jako začátek
    if (t > 1 && abs(d) > 2 * PI - 1e-9) t = 0;
    return t;
  }
  N.parametr = parametr;
  const vRozsahu = (q, t) => q.typ === 'k' || q.typ === 'p' || (t >= -1e-9 && t <= 1 + 1e-9);
  N.vRozsahu = vRozsahu;

  // průsečíky nosných útvarů (přímka / kružnice), pak filtr rozsahu
  function primka(q) { return q.typ === 'u' ? { a: q.a, d: [q.b[0] - q.a[0], q.b[1] - q.a[1]] } : { a: q.a, d: q.d }; }
  function prusPrimek(p, q) {
    const den = p.d[0] * q.d[1] - p.d[1] * q.d[0];
    if (abs(den) < EPS * hypot(...p.d) * hypot(...q.d)) return [];
    const t = ((q.a[0] - p.a[0]) * q.d[1] - (q.a[1] - p.a[1]) * q.d[0]) / den;
    return [[p.a[0] + t * p.d[0], p.a[1] + t * p.d[1]]];
  }
  function prusPrimkyKruhu(p, c, r) {
    const fx = p.a[0] - c[0], fy = p.a[1] - c[1], A = p.d[0] * p.d[0] + p.d[1] * p.d[1];
    const B = 2 * (fx * p.d[0] + fy * p.d[1]), C = fx * fx + fy * fy - r * r, D = B * B - 4 * A * C;
    if (D < -EPS) return [];
    const s = sqrt(max(0, D)), out = [];
    for (const t of D < EPS ? [-B / (2 * A)] : [(-B - s) / (2 * A), (-B + s) / (2 * A)]) out.push([p.a[0] + t * p.d[0], p.a[1] + t * p.d[1]]);
    return out;
  }
  function prusKruhu(c1, r1, c2, r2) {
    const dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = hypot(dx, dy);
    if (d < EPS || d > r1 + r2 + EPS || d < abs(r1 - r2) - EPS) return [];
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = sqrt(max(0, r1 * r1 - a * a));
    const mx = c1[0] + a * dx / d, my = c1[1] + a * dy / d;
    if (h < EPS) return [[mx, my]];
    return [[mx + h * dy / d, my - h * dx / d], [mx - h * dy / d, my + h * dx / d]];
  }
  /** Průsečíky dvou primitiv: [{x, y, t1, t2}] (jen v rozsazích). */
  N.pruseciky = function (p, q) {
    const kr = o => o.typ === 'o' || o.typ === 'k';
    let body;
    if (!kr(p) && !kr(q)) body = prusPrimek(primka(p), primka(q));
    else if (kr(p) && kr(q)) body = prusKruhu(p.c, p.r, q.c, q.r);
    else { const [l, k] = kr(p) ? [q, p] : [p, q]; body = prusPrimkyKruhu(primka(l), k.c, k.r); }
    const out = [];
    for (const [x, y] of body) {
      const t1 = parametr(p, x, y), t2 = parametr(q, x, y);
      if (vRozsahu(p, t1) && vRozsahu(q, t2)) out.push({ x, y, t1, t2 });
    }
    return out;
  };

  /** Nejbližší bod primitiva k bodu (x, y): {x, y, t, d}. */
  N.nejblizsiNaPrimitivu = function (q, x, y) {
    let t;
    if (q.typ === 'u') t = max(0, min(1, parametr(q, x, y)));
    else if (q.typ === 'p') t = parametr(q, x, y);
    else if (q.typ === 'k') t = parametr(q, x, y);
    else {
      t = parametr(q, x, y);
      if (t < 0 || t > 1) {                          // mimo oblouk → bližší konec
        const p0 = N.bodPrimitiva(q, 0), p1 = N.bodPrimitiva(q, 1);
        t = hypot(p0[0] - x, p0[1] - y) <= hypot(p1[0] - x, p1[1] - y) ? 0 : 1;
      }
    }
    const [bx, by] = N.bodPrimitiva(q, t);
    return { x: bx, y: by, t, d: hypot(bx - x, by - y) };
  };

  if (typeof module !== 'undefined') module.exports = N;
})(N3D);

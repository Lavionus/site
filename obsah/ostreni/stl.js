/* ============================================================
   Ostření – STL přípravků (manifold-3d z obsah/lib/manifold, Apache-2.0; modul WASM parametrem)
   Díly z jádra jsou popsané primitivy v FUNKČNÍCH souřadnicích (plus / minus):
     box {a, b} · prof {osa 'y'|'x', pts (polygon v rovině kolmé na osu), od, do}
     deska {pts v xy, od, do (z)} · val {osa, c (začátek osy), r, h, slza (směr špičky kapky)}
     hex {osa, c, af, h, vrcholy (osa, kam míří vrcholy)} · kuzel {c, r0, r1, h} (osa z)
   teleso(w, dil)          → Manifold ve funkční poloze (volající maže)
   sitDilu(w, dil, tisk)   → {poz, idx, objem, rod, rozmer} – tisk = true: otočeno do tiskové polohy, z ≥ 0
   stlBinarni(poz, idx, nazev)
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180;
  const segmentu = (r) => Math.max(24, Math.min(96, Math.round(r * 6)));

  /** kružnice nebo kapka (špička ve směru úhlu fi, rad) jako polygon CCW */
  function kruh(r, fi) {
    const n = segmentu(r), out = [];
    if (fi == null) { for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; out.push([r * Math.cos(a), r * Math.sin(a)]); } return out; }
    const m = Math.max(12, Math.round(n * 0.75));
    for (let i = 0; i <= m; i++) { const a = fi + Math.PI / 4 + (1.5 * Math.PI) * i / m; out.push([r * Math.cos(a), r * Math.sin(a)]); }
    out.push([r * Math.SQRT2 * Math.cos(fi), r * Math.SQRT2 * Math.sin(fi)]);
    return out;
  }
  const sestiuhelnik = (af, fi) => { const R = af / Math.sqrt(3), out = []; for (let i = 0; i < 6; i++) { const a = fi + i * Math.PI / 3; out.push([R * Math.cos(a), R * Math.sin(a)]); } return out; };
  const ccw = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s < 0 ? p.slice().reverse() : p; };

  function teleso(w, dil) {
    const M = w.Manifold, smaz = [], k = (x) => { smaz.push(x); return x; };
    /** hranol z polygonu v lokální rovině (X, Y) podél lokální Z délky h, umístěný podél osy */
    const hranol = (pts, h, osa, c) => {
      let m = k(M.extrude([ccw(pts)], h));
      if (osa === 'x') { m = k(k(m.rotate([90, 0, 0])).rotate([0, 0, 90])); }     // (X,Y,Z) → (Z, X, Y)
      else if (osa === 'y') { m = k(m.rotate([90, 0, 0])); m = k(m.translate([0, h, 0])); }   // (X,Y,Z) → (X, h − Z, Y)
      return k(m.translate(c));
    };
    // lokální 2D souřadnice směru (pro kapku / vrcholy šestiúhelníku) podle osy
    const lok = (osa, d) => (osa === 'x' ? [d[1], d[2]] : osa === 'y' ? [d[0], d[2]] : [d[0], d[1]]);
    const prevod = (q) => {
      if (q.t === 'box') return k(k(M.cube([q.b[0] - q.a[0], q.b[1] - q.a[1], q.b[2] - q.a[2]], false)).translate(q.a));
      if (q.t === 'prof') {
        const h = q.do - q.od;
        if (q.osa === 'x') return hranol(q.pts, h, 'x', [q.od, 0, 0]);
        return hranol(q.pts, h, 'y', [0, q.od, 0]);
      }
      if (q.t === 'deska') return k(k(M.extrude([ccw(q.pts)], q.do - q.od)).translate([0, 0, q.od]));
      if (q.t === 'val' || q.t === 'hex') {
        const osa = q.osa || 'z';
        let pts;
        if (q.t === 'val') { const d = q.slza ? lok(osa, q.slza) : null; pts = kruh(q.r, d ? Math.atan2(d[1], d[0]) : null); }
        else { const d = lok(osa, { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[q.vrcholy || 'x']); pts = sestiuhelnik(q.af, Math.atan2(d[1], d[0])); }
        return hranol(pts, q.h, osa, q.c);
      }
      if (q.t === 'kuzel') return k(k(M.cylinder(q.h, q.r0, q.r1, segmentu(Math.max(q.r0, q.r1)), false)).translate(q.c));
      throw new Error('neznámé primitivum ' + q.t);
    };
    try {
      const plus = dil.plus.map(prevod), minus = (dil.minus || []).map(prevod);
      let t = plus.length > 1 ? k(M.union(plus)) : plus[0];
      if (minus.length) t = k(t.subtract(minus.length > 1 ? k(M.union(minus)) : minus[0]));
      const vysl = t.translate([0, 0, 0]);       // kopie mimo seznam mazání
      return vysl;
    } finally { for (const x of smaz) { try { x.delete(); } catch (e) { /* uvolněno */ } } }
  }

  function sit(m, navic) {
    const st = m.status();
    if (st !== 'NoError') throw new Error('manifold hlásí ' + st);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let q = 0, t = 0; q < vp.length; q += np, t += 3) { poz[t] = vp[q]; poz[t + 1] = vp[q + 1]; poz[t + 2] = vp[q + 2]; }
    const bb = m.boundingBox();
    return Object.assign({ poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), rod: m.genus(), min: bb.min, max: bb.max,
      rozmer: [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]] }, navic || {});
  }

  /** síť dílu; tisk = true → otočení do tiskové polohy, vystředění na podložce a z ≥ 0 */
  function sitDilu(w, dil, tisk) {
    const smaz = [], k = (x) => { smaz.push(x); return x; };
    try {
      let m = k(teleso(w, dil));
      if (tisk) {
        const r = dil.rotTisk || [0, 0, 0];
        if (r[0] || r[1] || r[2]) m = k(m.rotate(r));
        const bb = m.boundingBox();
        m = k(m.translate([-(bb.min[0] + bb.max[0]) / 2, -(bb.min[1] + bb.max[1]) / 2, -bb.min[2]]));
      }
      return sit(m, { id: dil.id, nazev: dil.nazev });
    } finally { for (const x of smaz) { try { x.delete(); } catch (e) { /* uvolněno */ } } }
  }

  /** binární STL z indexované sítě */
  function stlBinarni(poz, idx, nazev) {
    const nt = idx.length / 3, buf = new ArrayBuffer(84 + nt * 50), dv = new DataView(buf);
    const hl = String(nazev || 'pripravek').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '').slice(0, 79);
    for (let i = 0; i < hl.length; i++) dv.setUint8(i, hl.charCodeAt(i) & 0x7f);
    dv.setUint32(80, nt, true);
    let o = 84;
    for (let t = 0; t < nt; t++) {
      const A = idx[t * 3] * 3, B = idx[t * 3 + 1] * 3, C = idx[t * 3 + 2] * 3;
      const ux = poz[B] - poz[A], uy = poz[B + 1] - poz[A + 1], uz = poz[B + 2] - poz[A + 2];
      const vx = poz[C] - poz[A], vy = poz[C + 1] - poz[A + 1], vz = poz[C + 2] - poz[A + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      for (const v of [nx, ny, nz]) { dv.setFloat32(o, v, true); o += 4; }
      for (const q of [A, B, C]) for (let s = 0; s < 3; s++) { dv.setFloat32(o, poz[q + s], true); o += 4; }
      dv.setUint16(o, 0, true); o += 2;
    }
    return buf;
  }

  const API = { teleso, sitDilu, sit, stlBinarni, kruh, sestiuhelnik, RAD };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.OSTRSTL = API;
})(typeof window !== 'undefined' ? window : globalThis);

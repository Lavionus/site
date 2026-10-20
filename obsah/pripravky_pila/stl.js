/* ============================================================
   Přípravky pro pilu a vrtačku – STL (manifold-3d z obsah/lib/manifold, Apache-2.0; modul WASM parametrem)
   - teleso(w, dil)  → {poz, idx, objem, rod, bbox}   síť tištěného dílu v tiskové poloze (z = 0 na podložce)
   - spoj(site, mezera) → jedna síť s díly vedle sebe v ose x
   - stlBinarni(poz, idx, nazev)
   ============================================================ */
(function (koren) {
  'use strict';
  const PP = koren.PP || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const seg = (r) => Math.max(20, Math.min(96, Math.round(r * 6)));

  /* 7segmentové znaky pro vyrytí označení */
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
    A: 'abcefg', B: 'cdefg', C: 'adef', D: 'bcdeg', E: 'adefg', F: 'aefg', H: 'bcefg', L: 'def', P: 'abefg', S: 'afgcd', T: 'defg', U: 'bcdef', V: 'bcdef', '-': 'g' };
  function segmentyTextu(text, h) {
    const wc = 0.58 * h, s = Math.max(0.8, 0.14 * h), mez = 0.38 * h, out = [];
    let x = 0;
    for (const ch of String(text).toUpperCase()) {
      const sg = SEG[ch];
      if (sg) for (const q of sg) {
        const R = { a: [0, h - s, wc, h], d: [0, 0, wc, s], g: [0, h / 2 - s / 2, wc, h / 2 + s / 2], f: [0, h / 2, s, h], b: [wc - s, h / 2, wc, h], e: [0, 0, s, h / 2], c: [wc - s, 0, wc, h / 2] }[q];
        out.push([x + R[0], R[1], x + R[2], R[3]]);
      }
      x += (sg || ch === ' ' ? wc : 0) + mez;
    }
    return { obd: out, sirka: Math.max(0, x - mez), vyska: h };
  }

  function postav(w, n, k) {
    const M = w.Manifold;
    if (n.op) {
      const deti = n.a.map((q) => postav(w, q, k));
      if (n.op === 'add') return k(M.union(deti));
      let t = deti[0];
      if (deti.length > 1) t = k(t.subtract(k(M.union(deti.slice(1)))));
      return t;
    }
    if (n.p === 'box') return k(k(M.cube([n.b[0] - n.a[0], n.b[1] - n.a[1], n.b[2] - n.a[2]], false)).translate(n.a));
    if (n.p === 'prism') return k(k(M.extrude([PP.ccw(n.b)], n.z1 - n.z0)).translate([0, 0, n.z0]));
    let t;
    const h = n.z1 - n.z0;
    if (n.p === 'cyl') t = k(M.cylinder(h, n.r, n.r2, seg(Math.max(n.r, n.r2)), false));
    else { const R = n.s / Math.sqrt(3); t = k(M.cylinder(h, R, R, 6, false)); t = k(t.rotate([0, 0, 30])); }   // šestihran: plošky rovnoběžné s osou x
    if (n.osa === 'z') return k(t.translate([n.c[0], n.c[1], n.z0]));
    if (n.osa === 'x') return k(k(t.rotate([0, 90, 0])).translate([n.z0, n.c[0], n.c[1]]));        // c = [y, z]
    return k(k(t.rotate([-90, 0, 0])).translate([n.c[0], n.z0, n.c[1]]));                            // osa y, c = [x, z]
  }
  function sit(t, navic) {
    const st = t.status();
    if (st !== 'NoError') throw new Error('manifold hlásí ' + st);
    const mesh = t.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let q = 0, i = 0; q < vp.length; q += np, i += 3) { poz[i] = vp[q]; poz[i + 1] = vp[q + 1]; poz[i + 2] = vp[q + 2]; }
    const bb = t.boundingBox();
    return Object.assign({ poz, idx: new Uint32Array(mesh.triVerts), objem: t.volume(), rod: t.genus(), bbox: { min: Array.from(bb.min), max: Array.from(bb.max) } }, navic || {});
  }
  /** síť tištěného dílu (s vyrytým označením, je-li zadané) */
  function teleso(w, dil) {
    const smaz = [], k = (x) => { smaz.push(x); return x; };
    try {
      let t = postav(w, dil.csg, k);
      const n = dil.napis;
      if (n && n.txt) {
        const g = segmentyTextu(n.txt, n.h), hl = 0.6, M = w.Manifold;
        const boxy = g.obd.map(([a, b, c, d]) => n.plocha === 'y+'
          ? k(k(M.cube([c - a, hl + 1, d - b], false)).translate([n.x + a, n.f - hl, n.y + b]))
          : k(k(M.cube([c - a, d - b, hl + 1], false)).translate([n.x + a, n.y + b, n.f - hl])));
        if (boxy.length) t = k(t.subtract(k(M.union(boxy))));
      }
      return sit(t, { id: dil.id });
    } finally { for (const x of smaz) { try { x.delete(); } catch (e) { /* uvolněno */ } } }
  }
  /** více sítí vedle sebe v ose x (mezera mm), každá posunutá na z = 0 a y = 0 */
  function spoj(site, mezera) {
    mezera = mezera == null ? 8 : mezera;
    let n = 0, m = 0;
    for (const s of site) { n += s.poz.length; m += s.idx.length; }
    const poz = new Float32Array(n), idx = new Uint32Array(m);
    let x = 0, op = 0, oi = 0;
    for (const s of site) {
      const b = s.bbox, dx = x - b.min[0], dy = -b.min[1], dz = -b.min[2], base = op / 3;
      for (let i = 0; i < s.poz.length; i += 3) { poz[op + i] = s.poz[i] + dx; poz[op + i + 1] = s.poz[i + 1] + dy; poz[op + i + 2] = s.poz[i + 2] + dz; }
      for (let i = 0; i < s.idx.length; i++) idx[oi + i] = s.idx[i] + base;
      op += s.poz.length; oi += s.idx.length; x += b.max[0] - b.min[0] + mezera;
    }
    return { poz, idx };
  }
  function stlBinarni(poz, idx, nazev) {
    const nt = idx.length / 3, buf = new ArrayBuffer(84 + nt * 50), dv = new DataView(buf);
    const hl = String(nazev || 'pripravek').normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 79);
    for (let i = 0; i < hl.length; i++) dv.setUint8(i, hl.charCodeAt(i) & 0x7f);
    dv.setUint32(80, nt, true);
    let o = 84;
    for (let t = 0; t < nt; t++) {
      const A = idx[t * 3] * 3, B = idx[t * 3 + 1] * 3, Cc = idx[t * 3 + 2] * 3;
      const ux = poz[B] - poz[A], uy = poz[B + 1] - poz[A + 1], uz = poz[B + 2] - poz[A + 2];
      const vx = poz[Cc] - poz[A], vy = poz[Cc + 1] - poz[A + 1], vz = poz[Cc + 2] - poz[A + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
      for (const v of [nx / l, ny / l, nz / l]) { dv.setFloat32(o, v, true); o += 4; }
      for (const q of [A, B, Cc]) for (let s = 0; s < 3; s++) { dv.setFloat32(o, poz[q + s], true); o += 4; }
      dv.setUint16(o, 0, true); o += 2;
    }
    return buf;
  }

  const API = { teleso, spoj, stlBinarni, segmentyTextu };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.PPSTL = API;
})(typeof window !== 'undefined' ? window : globalThis);

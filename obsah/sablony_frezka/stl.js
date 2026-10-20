/* ============================================================
   Šablony pro horní frézku – STL (manifold-3d z obsah/lib/manifold, Apache-2.0; modul WASM parametrem w)
   Díl = vytažená deska (z ∈ [0, T]) + dorazy pod ní (z ∈ [−V, 0]) + vyryté rysky a štítek.
   Díly větší než tisková plocha se rozdělí rybinovým (puzzle) spojem (SF.rozdelProTisk).
   Orientace pro tisk: díl s dorazy se otočí horní plochou na podložku (dorazy nahoru, bez převisů).
   - model(w, dil, nast) → {poz, idx, objem, rod, kusu, varovani, rozmery}
   - stlBinarni(poz, idx, nazev)
   ============================================================ */
(function (koren) {
  'use strict';
  const SF = koren.SF || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const G = koren.SFG || (typeof require !== 'undefined' ? require('./geom.js') : null);
  const r2 = (x) => Math.round(x * 100) / 100;

  /* 7segmentové znaky pro vyrytý štítek */
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
    A: 'abcefg', B: 'cdefg', C: 'adef', D: 'bcdeg', E: 'adefg', F: 'aefg', H: 'bcefg', L: 'def', P: 'abefg', U: 'bcdef', '-': 'g' };
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
  const obdP = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  /** obdélník textu volně uvnitř oblasti (s odstupem 2 mm) */
  function mistoTextu(polys, w, h) {
    const o = G.obal(polys);
    for (let y = o.y1 - h - 3; y >= o.y0 + 2; y -= 2) for (let x = o.x0 + 3; x + w <= o.x1 - 2; x += 2) {
      const r = [obdP(x - 2, y - 2, x + w + 2, y + h + 2)];
      if (G.plochaOblasti(G.rozdil(r, polys)) < 1e-4) return [x, y];
    }
    return null;
  }
  /** rysky (úsečky) → tenké obdélníky pro vyrytí */
  function ryskyNaObd(znacky, sirka) {
    const out = [];
    for (const z of znacky || []) {
      if (z.v !== 'gravura') continue;
      for (let i = 0; i + 1 < z.b.length; i++) {
        const a = z.b[i], b = z.b[i + 1], d = G.jednot(G.odecti(b, a)), n = [-d[1] * sirka / 2, d[0] * sirka / 2];
        out.push([[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]]);
      }
    }
    return out;
  }

  function sit(m, navic) {
    const st = m.status();
    if (st !== 'NoError' && st !== 0 && !(st && st.value === 0)) throw new Error('manifold hlásí ' + st);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let q = 0, t = 0; q < vp.length; q += np, t += 3) { poz[t] = vp[q]; poz[t + 1] = vp[q + 1]; poz[t + 2] = vp[q + 2]; }
    return Object.assign({ poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), rod: m.genus() }, navic || {});
  }

  /** STL dílu (jeden soubor, kusy vedle sebe v orientaci pro tisk) */
  function model(w, dil, nast) {
    const N = SF.normNast(nast), smaz = [], k = (x) => { smaz.push(x); return x; };
    try {
      const M = w.Manifold, T = Math.max(2, N.tlSablony), varovani = [];
      const vrstvy = [{ polys: dil.deska.polys, z0: 0, z1: T, hlavni: true }].concat((dil.dorazy || []).map((d) => ({ polys: d.polys, z0: -Math.max(2, +d.v || 15), z1: 0.4 })));
      const R = SF.rozdelProTisk(vrstvy, N.stul, N.vulePuzzle);
      for (const v of R.pres) varovani.push(v);
      const otoc = R.otoceno ? (q) => [q[1], -q[0]] : (q) => q;
      const rysky = ryskyNaObd(dil.znacky, 0.8).map((p) => p.map(otoc));
      // zahloubení šroubů (kruhové rameno): kužel 90° od spodní plochy
      const kuzely = (dil.srouby || []).filter((s) => s.zahl > s.d).map((s) => ({ c: otoc(s.c), r1: s.zahl / 2, r0: s.d / 2 }));
      const kusy = [];
      let x = 0;
      const rozmery = [];
      R.kusy.forEach((kus, i) => {
        let telo = null;
        for (const l of kus.vrstvy) {
          const cs = k(new w.CrossSection(l.polys.map((p) => p.map((q) => [q[0], q[1]])), 'NonZero'));
          const m = k(k(cs.extrude(l.z1 - l.z0)).translate([0, 0, l.z0]));
          telo = telo ? k(telo.add(m)) : m;
        }
        const hl = Math.min(0.6, T * 0.2), deska = (kus.vrstvy.find((l) => l.hlavni) || kus.vrstvy[0]).polys;
        if (N.oznaceni !== false) {
          for (const r of rysky) {
            const pr = G.prunik([r], G.ofset(deska, -0.8));
            if (!pr.length) continue;
            telo = k(telo.subtract(k(k(k(new w.CrossSection(pr, 'NonZero')).extrude(hl + 1)).translate([0, 0, T - hl]))));
          }
          // čísla stupnice (jen číslice – 7segmentově)
          for (const t of dil.texty || []) {
            if (t.v !== 'gravura' || !/^[0-9-]+$/.test(t.txt) || t.u) continue;
            const g = segmentyTextu(t.txt, Math.min(4, t.h || 4)), c = otoc([t.x, t.y]), x0 = c[0] - (t.a === 'c' ? g.sirka / 2 : 0), y0 = c[1] - g.vyska / 2;
            if (R.otoceno) continue;
            if (G.plochaOblasti(G.rozdil([obdP(x0 - 1, y0 - 1, x0 + g.sirka + 1, y0 + g.vyska + 1)], deska)) > 1e-4) continue;
            for (const [a, b, cc, d] of g.obd) telo = k(telo.subtract(k(M.cube([cc - a, d - b, hl + 1], false).translate([x0 + a, y0 + b, T - hl]))));
          }
          const txt = String(dil.stitek || dil.id || 'A').split(' ')[0] + (R.kusy.length > 1 ? String(i + 1) : '') + (String(dil.stitek || '').split(' ')[1] ? ' ' + String(dil.stitek).split(' ')[1] : '');
          for (const h of [7, 5, 4]) {
            const g = segmentyTextu(txt, h), m = mistoTextu(deska, g.sirka, g.vyska);
            if (!m) continue;
            for (const [a, b, c, d] of g.obd) telo = k(telo.subtract(k(M.cube([c - a, d - b, hl + 1], false).translate([m[0] + a, m[1] + b, T - hl]))));
            break;
          }
        }
        for (const q of kuzely) {
          const vys = q.r1 - q.r0;
          telo = k(telo.subtract(k(k(M.cylinder(vys + 0.01, q.r1, q.r0, 48, false)).translate([q.c[0], q.c[1], -0.01]))));
        }
        // orientace pro tisk: s dorazy horní plochou dolů
        if (kus.vrstvy.some((l) => !l.hlavni)) telo = k(k(telo.rotate([180, 0, 0])).translate([0, 0, T]));
        const bb = telo.boundingBox();
        telo = k(telo.translate([x - bb.min[0], -bb.min[1], -bb.min[2]]));
        rozmery.push([r2(bb.max[0] - bb.min[0]), r2(bb.max[1] - bb.min[1]), r2(bb.max[2] - bb.min[2])]);
        x += bb.max[0] - bb.min[0] + 8;
        kusy.push(telo);
      });
      const vse = kusy.length === 1 ? kusy[0] : k(M.union(kusy));
      if (R.kusy.length > 1) varovani.push(`Díl je větší než tisková plocha ${N.stul} mm – rozdělen na ${R.kusy.length} kusy s rybinovým spojem (vůle ${String(N.vulePuzzle).replace('.', ',')} mm). Slepte na rovné podložce (CA / epoxid) a spoj zabruste.`);
      return sit(vse, { kusu: R.kusy.length, varovani, rozmery });
    } finally { for (const x of smaz) { try { x.delete(); } catch (e) { /* uvolněno */ } } }
  }

  /** binární STL z indexované sítě */
  function stlBinarni(poz, idx, nazev) {
    const nt = idx.length / 3, buf = new ArrayBuffer(84 + nt * 50), dv = new DataView(buf);
    const hl = String(nazev || 'sablona frezka').normalize('NFD').replace(/[^\x20-\x7e]/g, '').slice(0, 79);
    for (let i = 0; i < hl.length; i++) dv.setUint8(i, hl.charCodeAt(i));
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

  const API = { model, stlBinarni, segmentyTextu };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.SFSTL = API;
})(typeof window !== 'undefined' ? window : globalThis);

/* ============================================================
   Šablony oblouků a profilů – STL kontrolních šablon (manifold-3d z obsah/lib/manifold, Apache-2.0; modul WASM parametrem w)
   Obrys dílu (mm, y nahoru) se vytáhne na tloušťku T. Šablona větší než tisková plocha se rozdělí mřížkou řezů;
   na každém řezu dostane levý/spodní kus rybinový zámek (dovetail) a sousední kus kapsu s vůlí. Do horní plochy
   se vyryje označení kusu (7segmentové znaky), pokud se vejde.
   - sablona(w, dil, nast) → {poz, idx, objem, rod, kusu, rozmery, varovani, oznaceni}
   - stlBinarni(poz, idx, nazev)
   ============================================================ */
(function (koren) {
  'use strict';
  const O = koren.OBL || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const r1 = (x) => Math.round(x * 10) / 10;

  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', A: 'abcefg', B: 'cdefg', C: 'adef', D: 'bcdeg', E: 'adefg', F: 'aefg', '-': 'g' };
  /** obdélníky [x0, y0, x1, y1] textu výšky h (vlevo dole v 0,0) */
  function segmentyTextu(text, h) {
    const wc = 0.58 * h, s = Math.max(0.9, 0.15 * h), mez = 0.38 * h, out = [];
    let x = 0;
    for (const ch of String(text).toUpperCase()) {
      const sg = SEG[ch];
      if (sg) for (const q of sg) {
        const R = { a: [0, h - s, wc, h], d: [0, 0, wc, s], g: [0, h / 2 - s / 2, wc, h / 2 + s / 2], f: [0, h / 2, s, h], b: [wc - s, h / 2, wc, h], e: [0, 0, s, h / 2], c: [wc - s, 0, wc, h / 2] }[q];
        out.push([x + R[0], R[1], x + R[2], R[3]]);
      }
      x += wc + mez;
    }
    return { obd: out, sirka: Math.max(0, x - mez), vyska: h };
  }
  /** sudo-liché testování bodu v množině prstenců */
  function uvnitr(p, kruhy) { let v = false; for (const k of kruhy) if (O.vPolygonu(p, k)) v = !v; return v; }
  function plochaKruhu(kruhy) { return Math.abs(kruhy.reduce((s, k) => s + O.plocha(k), 0)); }
  /** místo pro obdélník sirka × vyska uvnitř kusu (odstup od hran ≥ 1,5 mm) */
  function mistoProText(kruhy, sirka, vyska) {
    const bb = O.meze([].concat(...kruhy)), kr = Math.max(1, Math.min(4, (bb.x1 - bb.x0) / 40));
    const vrcholy = [].concat(...kruhy);
    for (let y = bb.y0 + 2; y + vyska <= bb.y1 - 2; y += kr) for (let x = bb.x0 + 2; x + sirka <= bb.x1 - 2; x += kr) {
      const a = x - 1.5, b = y - 1.5, c = x + sirka + 1.5, d = y + vyska + 1.5;
      const test = [[a, b], [c, b], [c, d], [a, d], [(a + c) / 2, b], [(a + c) / 2, d], [a, (b + d) / 2], [c, (b + d) / 2], [(a + c) / 2, (b + d) / 2]];
      if (!test.every((q) => uvnitr(q, kruhy))) continue;
      if (vrcholy.some((q) => q[0] > a && q[0] < c && q[1] > b && q[1] < d)) continue;
      return [x, y];
    }
    return null;
  }

  function sablona(w, dil, nast) {
    const smaz = [], k = (x) => { smaz.push(x); return x; };
    try {
      const N = Object.assign({ stlTl: 4, stlStul: 220, stlVule: 0.15, stlCislo: true }, nast || {});
      const T = Math.max(dil.tlStl ? 0.4 : 2, O.cislo(dil.tlStl || N.stlTl, 4)), stul = Math.max(60, O.cislo(N.stlStul, 220)), vule = Math.max(0, O.cislo(N.stlVule, 0.15));
      const varovani = [];
      if (!dil.obrys || !dil.obrys.length) throw new Error('Tento díl nemá obrys pro STL.');
      if (dil.tlStl && dil.tlStl < 2) varovani.push(`Podložka má tloušťku ${r1(dil.tlStl)} mm – tiskněte s výškou vrstvy ≤ 0,2 mm, nebo ji vyřízněte z plechu / dýhy.`);
      let kruhy = dil.obrys.map((r) => r.map((q) => [q[0], q[1]]));
      let bb = O.meze([].concat(...kruhy));
      // delší rozměr do osy x
      if (bb.y1 - bb.y0 > bb.x1 - bb.x0) { kruhy = kruhy.map((r) => r.map((q) => [q[1], -q[0]])); bb = O.meze([].concat(...kruhy)); }
      const CS = w.CrossSection;
      const obd = (x0, y0, x1, y1) => k(new CS([[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]], 'Positive'));
      const pol = (body) => { const p = O.plocha(body) < 0 ? body.slice().reverse() : body; return k(new CS([p], 'Positive')); };
      const vse = k(new CS(kruhy, 'EvenOdd'));
      const W = bb.x1 - bb.x0, H = bb.y1 - bb.y0, uz = stul - 6;
      const nx = W <= uz ? 1 : Math.ceil(W / (uz - 14)), ny = H <= uz ? 1 : Math.ceil(H / (uz - 14));
      const xs = [], ys = [];
      for (let i = 1; i < nx; i++) xs.push(bb.x0 + W * i / nx);
      for (let j = 1; j < ny; j++) ys.push(bb.y0 + H * j / ny);
      const X = [bb.x0 - 1].concat(xs, [bb.x1 + 1]), Y = [bb.y0 - 1].concat(ys, [bb.y1 + 1]);
      // buňky
      const bunky = [];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) bunky.push({ i, j, cs: k(vse.intersect(obd(X[i], Y[j], X[i + 1], Y[j + 1]))) });
      const B = (i, j) => bunky.find((q) => q.i === i && q.j === j);
      // průsečíky přímky s obrysem v pásu → intervaly materiálu
      const intervaly = (svisla, c0, a0, a1) => {
        const pts = [];
        for (const r of kruhy) for (let m = 0, n = r.length - 1; m < r.length; n = m++) {
          const p = r[n], q = r[m], u = svisla ? 0 : 1, v = 1 - u;
          if ((p[u] - c0) * (q[u] - c0) < 0) pts.push(p[v] + (q[v] - p[v]) * (c0 - p[u]) / (q[u] - p[u]));
        }
        pts.sort((a, b) => a - b);
        const out = [];
        for (let m = 0; m + 1 < pts.length; m += 2) { const a = Math.max(a0, pts[m]), b = Math.min(a1, pts[m + 1]); if (b - a > 0) out.push([a, b]); }
        return out;
      };
      let zamku = 0, bezZamku = 0;
      const zamek = (svisla, c0, a, b, dolni, horni) => {
        const s = Math.min(22, (b - a) * 0.6);
        if (s < 9) { bezZamku++; return; }
        const m = (a + b) / 2, n = s * 0.3, h = s * 0.48, d = Math.min(s * 0.55, 10);
        const tvar = svisla ? [[c0 - 1, m - n], [c0 + d, m - h], [c0 + d, m + h], [c0 - 1, m + n]] : [[m - n, c0 - 1], [m + n, c0 - 1], [m + h, c0 + d], [m - h, c0 + d]];
        const z = pol(tvar), zv = k(z.intersect(vse));
        dolni.cs = k(dolni.cs.add(zv));
        horni.cs = k(horni.cs.subtract(k(zv.offset(vule, 'Miter'))));
        zamku++;
      };
      for (let j = 0; j < ny; j++) xs.forEach((x, i) => { for (const [a, b] of intervaly(true, x, Y[j], Y[j + 1])) zamek(true, x, a, b, B(i, j), B(i + 1, j)); });
      for (let i = 0; i < nx; i++) ys.forEach((y, j) => { for (const [a, b] of intervaly(false, y, X[i], X[i + 1])) zamek(false, y, a, b, B(i, j), B(i, j + 1)); });
      // vytažení, označení, rozložení vedle sebe
      const M = w.Manifold, kusy = [], rozmery = [], oznaceni = [];
      let posX = 0, cislo = 0;
      for (const bu of bunky) {
        for (const kus of bu.cs.decompose()) {
          k(kus);
          const pp = kus.toPolygons();
          if (plochaKruhu(pp) < 4) continue;
          cislo++;
          const b = kus.bounds(), bw = b.max[0] - b.min[0], bh = b.max[1] - b.min[1];
          let m3 = k(kus.extrude(T));
          const popis = (dil.id || 'S') + (nx * ny > 1 || cislo > 1 ? '-' + cislo : '');
          if (N.stlCislo !== false && T >= 2.5) {
            let hotovo = false;
            for (const hT of [8, 6, 5, 4]) {
              const g = segmentyTextu(popis, hT), misto = mistoProText(pp, g.sirka, g.vyska);
              if (!misto) continue;
              const hl = Math.min(0.8, T * 0.25);
              for (const [a, bb2, c, d] of g.obd) m3 = k(m3.subtract(k(M.cube([c - a, d - bb2, hl + 1], false).translate([misto[0] + a, misto[1] + bb2, T - hl]))));
              oznaceni.push(popis); hotovo = true; break;
            }
            if (!hotovo) varovani.push(`Kus ${popis}: na označení není místo – nevyryto.`);
          }
          m3 = k(m3.translate([posX - b.min[0], -b.min[1], 0]));
          posX += bw + 8;
          kusy.push(m3); rozmery.push([r1(bw), r1(bh)]);
        }
      }
      if (!kusy.length) throw new Error('Obrys je prázdný.');
      if (nx * ny > 1) varovani.push(`Šablona ${r1(W)} × ${r1(H)} mm je větší než tisková plocha ${stul} mm – rozdělena na ${kusy.length} kusů se ${zamku} rybinovými zámky (vůle ${vule} mm). Slepte je na rovné podložce (vteřinové lepidlo / epoxid).`);
      if (bezZamku) varovani.push(`${bezZamku} řez(ů) je příliš úzkých na zámek – kusy tam jen slepte, nejlépe přes podložku.`);
      if (T < 3) varovani.push('Tenká šablona – tiskněte PETG, 100 % výplň; PLA je křehčí.');
      const telo = kusy.length === 1 ? kusy[0] : k(M.union(kusy));
      const st = telo.status();
      if (st !== 'NoError' && st !== 0 && !(st && st.value === 0)) throw new Error('manifold hlásí ' + st);
      const mesh = telo.getMesh(), np = mesh.numProp, vp = mesh.vertProperties, poz = new Float32Array(vp.length / np * 3);
      for (let q = 0, t = 0; q < vp.length; q += np, t += 3) { poz[t] = vp[q]; poz[t + 1] = vp[q + 1]; poz[t + 2] = vp[q + 2]; }
      return { poz, idx: new Uint32Array(mesh.triVerts), objem: telo.volume(), rod: telo.genus(), kusu: kusy.length, rozmery, varovani, oznaceni, tloustka: T, zamku };
    } finally { for (const x of smaz) { try { x.delete(); } catch (e) { /* uvolněno */ } } }
  }

  function stlBinarni(poz, idx, nazev) {
    const nt = idx.length / 3, buf = new ArrayBuffer(84 + nt * 50), dv = new DataView(buf);
    const hl = String(nazev || 'sablona').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '_').slice(0, 79);
    for (let i = 0; i < hl.length; i++) dv.setUint8(i, hl.charCodeAt(i));
    dv.setUint32(80, nt, true);
    let o = 84;
    for (let t = 0; t < nt; t++) {
      const A = idx[t * 3] * 3, B = idx[t * 3 + 1] * 3, C = idx[t * 3 + 2] * 3;
      const ux = poz[B] - poz[A], uy = poz[B + 1] - poz[A + 1], uz = poz[B + 2] - poz[A + 2], vx = poz[C] - poz[A], vy = poz[C + 1] - poz[A + 1], vz = poz[C + 2] - poz[A + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
      for (const v of [nx / l, ny / l, nz / l]) { dv.setFloat32(o, v, true); o += 4; }
      for (const q of [A, B, C]) for (let s = 0; s < 3; s++) { dv.setFloat32(o, poz[q + s], true); o += 4; }
      dv.setUint16(o, 0, true); o += 2;
    }
    return buf;
  }

  const API = { sablona, stlBinarni, segmentyTextu, mistoProText };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.OBLSTL = API;
})(typeof window !== 'undefined' ? window : globalThis);

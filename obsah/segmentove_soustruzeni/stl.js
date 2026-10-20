/* ============================================================
   Segmentové soustružení – přípravky k pokosové pile (STL přes manifold-3d z obsah/lib/manifold, Apache-2.0)
   1) Klín (miter wedge): pravoúhlý trojúhelník s úhlem α = 180°/n; přiložený k pravítku pily natočí lištu o α,
      takže se řeže při 0° – a zároveň slouží jako měrka pro nastavení pily na α. Hrot je seříznutý (≥ 3 mm).
   2) Doraz se šikmou dosedací plochou pod úhlem α: zkosené čelo lišty dosedne celou plochou, ne ostrým hrotem.
   Oba díly jsou hranoly tištěné naležato (bez převisů), otvory svislé se zahloubením nahoře (45°),
   označení vyryté 0,6 mm sedmisegmentovým písmem na horní ploše. Souřadnice v mm, z nahoru.
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180;
  const cislo = (v, d) => { const x = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(x) ? x : d; };
  const r2 = (x) => Math.round(x * 100) / 100;

  /* 7segmentové znaky (a–g) + tečka */
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
    A: 'abcefg', C: 'adef', E: 'adefg', G: 'acdef', N: 'abcef', O: 'abcdef', P: 'abefg', S: 'afgcd', T: 'defg', '-': 'g' };
  /** obdélníky [x0, y0, x1, y1] textu výšky h od (0, 0) vlevo dole */
  function segmentyTextu(text, h) {
    const wc = 0.58 * h, s = Math.max(0.8, 0.14 * h), mez = 0.36 * h, out = [];
    let x = 0;
    for (const ch of String(text).toUpperCase()) {
      if (ch === '.' || ch === ',') { out.push([x - mez * 0.6, 0, x - mez * 0.6 + s * 1.1, s * 1.1]); x += s * 0.6; continue; }
      const sg = SEG[ch];
      if (sg) for (const q of sg) {
        const R = { a: [0, h - s, wc, h], d: [0, 0, wc, s], g: [0, h / 2 - s / 2, wc, h / 2 + s / 2], f: [0, h / 2, s, h], b: [wc - s, h / 2, wc, h], e: [0, 0, s, h / 2], c: [wc - s, 0, wc, h / 2] }[q];
        out.push([x + R[0], R[1], x + R[2], R[3]]);
      }
      x += (sg || ch === ' ' ? wc : 0) + mez;
    }
    return { obd: out, sirka: Math.max(0, x - mez), vyska: h };
  }
  const uhelTxt = (a) => a.toFixed(a * 100 % 100 === 0 ? 1 : 2);

  /** geometrie přípravků (2D obrysy, otvory, výšky) – použije ji STL i DXF/PDF */
  function geometrie(n, sirkaLisy, nast) {
    const N = Object.assign({ klinDelka: 120, klinVyska: 20, klinHrot: 3, klinDiry: true, dorazDelka: 70, dorazVyska: 30, stlText: true }, nast || {});
    n = Math.max(3, Math.round(cislo(n, 12)));
    const uhel = 180 / n, t = Math.tan(uhel * RAD), varovani = [];
    // klín
    let L = Math.max(40, cislo(N.klinDelka, 120));
    if (L * t > 180) { L = 180 / t; varovani.push(`Klín zkrácen na ${Math.round(L)} mm, aby se vešel na tiskovou plochu.`); }
    const hrot = Math.max(3, cislo(N.klinHrot, 3)), x0 = hrot / t, Hk = Math.max(6, cislo(N.klinVyska, 20));
    const klinObrys = [[x0, 0], [L, 0], [L, L * t], [x0, x0 * t]];
    const wKl = (x) => x * t;
    const textKl = N.stlText !== false ? `${n}-${uhelTxt(uhel)}` : '';
    let textKlin = null;
    if (textKl) for (const h of [7, 5, 4]) {
      const g = segmentyTextu(textKl, h), xs = Math.max(x0 + 3, (h + 5) / t);
      if (xs + g.sirka <= L - 3) { textKlin = { x: L - 3 - g.sirka, y: 2, h, g }; break; }
    }
    const diryKl = [];
    if (N.klinDiry !== false) {
      const r = 2.25, rz = 4.6;
      for (const x of [L - 14, L * 0.55]) {
        const w = wKl(x), y = textKlin ? (textKlin.y + textKlin.h + w) / 2 + 0.5 : w / 2;
        if (y - rz < (textKlin ? textKlin.y + textKlin.h + 1.5 : 2.5) || y + rz > w - 2.5) continue;
        if (diryKl.some((d) => Math.abs(d.x - x) < 2 * rz + 4)) continue;
        diryKl.push({ x: r2(x), y: r2(y), r, rz });
      }
    }
    if (!textKlin && textKl) varovani.push('Klín je na vyrytý nápis příliš úzký – nápis vynechán (popište fixem).');
    // doraz
    const Wd = Math.min(200, Math.max(25, cislo(sirkaLisy, 40) + 8));
    let Ld = Math.max(40, cislo(N.dorazDelka, 70));
    if (Wd * t > Ld - 20) Ld = Wd * t + 25;
    const Hd = Math.max(8, cislo(N.dorazVyska, 30));
    const dorazObrys = [[0, 0], [Ld, 0], [Ld, Wd], [Wd * t, Wd]];
    const diryD = [];
    for (const f of [1 / 3, 2 / 3]) { const y = Wd * f, x = Ld - 12; if (x - 4.6 > y * t + 4) diryD.push({ x: r2(x), y: r2(y), r: 2.25, rz: 4.6 }); }
    let textDoraz = null;
    if (N.stlText !== false) for (const h of [7, 5, 4]) {
      const g = segmentyTextu('STOP ' + uhelTxt(uhel), h), xs = Wd * t + 4, xe = diryD.length ? Ld - 12 - 4.6 - 2 : Ld - 3;
      if (Wd >= h + 4 && xs + g.sirka <= xe) { textDoraz = { x: xs, y: (Wd - h) / 2, h, g }; break; }
    }
    const stul = Math.max(60, cislo(N.stul, 220));
    if (Math.max(L, L * t) > stul || Math.max(Ld, Wd) > stul) varovani.push(`Některý díl je větší než tisková plocha ${stul} mm.`);
    return { n, uhel, varovani, klin: { obrys: klinObrys, diry: diryKl, vyska: Hk, text: textKlin }, doraz: { obrys: dorazObrys, diry: diryD, vyska: Hd, text: textDoraz } };
  }

  function sit(vysl, navic) {
    const st = vysl.status();
    if (st !== 'NoError') throw new Error('manifold hlásí ' + st);
    const mesh = vysl.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let q = 0, t = 0; q < vp.length; q += np, t += 3) { poz[t] = vp[q]; poz[t + 1] = vp[q + 1]; poz[t + 2] = vp[q + 2]; }
    return Object.assign({ poz, idx: new Uint32Array(mesh.triVerts), objem: vysl.volume(), rod: vysl.genus() }, navic || {});
  }
  function dil(w, d, k) {
    const M = w.Manifold;
    let pts = d.obrys.slice(), a = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
    if (a < 0) pts = pts.reverse();
    const cs = k(new w.CrossSection([pts], 'NonZero'));
    let t = k(cs.extrude(d.vyska));
    for (const h of d.diry) {
      t = k(t.subtract(k(k(M.cylinder(d.vyska + 2, h.r, h.r, 32, false)).translate([h.x, h.y, -1]))));
      const hl = h.rz - h.r;   // zahloubení 90° (45° stěna – tiskne se bez podpěr)
      t = k(t.subtract(k(k(M.cylinder(hl + 0.01, h.r, h.rz, 32, false)).translate([h.x, h.y, d.vyska - hl]))));
      t = k(t.subtract(k(k(M.cylinder(1, h.rz, h.rz, 32, false)).translate([h.x, h.y, d.vyska - 0.001]))));
    }
    if (d.text) {
      const hl = 0.6;
      for (const [a0, b0, a1, b1] of d.text.g.obd) t = k(t.subtract(k(k(M.cube([a1 - a0, b1 - b0, hl + 1], false)).translate([d.text.x + a0, d.text.y + b0, d.vyska - hl]))));
    }
    return t;
  }
  /** STL přípravků: kus = 'klin' | 'doraz' | 'oba' (vedle sebe s mezerou 10 mm) */
  function pripravky(w, geo, kus) {
    const smaz = [], k = (x) => { smaz.push(x); return x; };
    try {
      let t = null, otvoru = 0, kusu = 0;
      if (kus !== 'doraz') { t = dil(w, geo.klin, k); otvoru += geo.klin.diry.length; kusu++; }
      if (kus !== 'klin') {
        const ox = t ? t.boundingBox().max[0] + 10 : 0;
        const d = k(k(dil(w, geo.doraz, k)).translate([ox, 0, 0]));
        t = t ? k(t.add(d)) : d; otvoru += geo.doraz.diry.length; kusu++;
      }
      return sit(t, { otvoru, kusu });
    } finally { for (const x of smaz) { try { x.delete(); } catch (e) { /* uvolněno */ } } }
  }

  function stlBinarni(poz, idx, nazev) {
    const nt = idx.length / 3, buf = new ArrayBuffer(84 + nt * 50), dv = new DataView(buf);
    const hl = String(nazev || 'segmentove soustruzeni').normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 79);
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

  const API = { geometrie, pripravky, segmentyTextu, stlBinarni };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.SEGSTL = API;
})(typeof window !== 'undefined' ? window : globalThis);

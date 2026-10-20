/* ============================================================
   Ohýbání dřeva – STL malých forem pro 3D tisk (manifold-3d z obsah/lib/manifold, Apache-2.0; modul WASM parametrem).
   Profil dílu formy (obrys + otvory) se vytáhne do výšky = šířka formy; tiskne se naplocho (profil na podložce),
   takže líc formy je svislá stěna bez převisů. Díl delší než tisková plocha se rozřízne svislými řezy na části;
   v řezu jsou vodorovné otvory tvaru kapky (bez převisu) pro ocelové kolíky.
   - forma(w, dil, nast) → {poz, idx, objem, rod, casti, kolikuOtvoru, varovani, rozmery}
   - stlBinarni(poz, idx, nazev)
   ============================================================ */
(function (koren) {
  'use strict';
  const OHD = koren.OHD || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const r2 = (x) => Math.round(x * 100) / 100;

  /* 7segmentové znaky pro vyrytí označení */
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
    A: 'abcefg', N: 'abcef', P: 'abefg', K: 'befg', '-': 'g' };
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
  function sit(vysl, navic) {
    const st = vysl.status();
    if (st !== 'NoError') throw new Error('manifold hlásí ' + st);
    const mesh = vysl.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let q = 0, t = 0; q < vp.length; q += np, t += 3) { poz[t] = vp[q]; poz[t + 1] = vp[q + 1]; poz[t + 2] = vp[q + 2]; }
    return Object.assign({ poz, idx: new Uint32Array(mesh.triVerts), objem: vysl.volume(), rod: vysl.genus() }, navic || {});
  }
  const kruh = (x, y, r, n) => { const out = []; for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; out.push([x + r * Math.cos(a), y + r * Math.sin(a)]); } return out; };

  /** svislé řezy dílu (x) tak, aby každá část byla ≤ stul; vrací hranice */
  function rezy(o, stul) {
    const n = Math.max(1, Math.ceil(o.w / (stul - 4) - 1e-9)), out = [];
    for (let i = 1; i < n; i++) out.push(o.x0 + o.w * i / n);
    return out;
  }
  /** úseky y na svislé přímce x uvnitř dílu s odstupem ≥ m od okraje */
  function useky(dil, x, m) {
    const o = dil.ohr || OHD.ohraniceni(dil.obrys), out = [];
    let a = null;
    for (let y = o.y0; y <= o.y1 + 0.5; y += 0.5) {
      const ok = y <= o.y1 && OHD.vzdOdOkraje([x, y], dil) >= m;
      if (ok && a == null) a = y;
      if (!ok && a != null) { out.push([a, y - 0.5]); a = null; }
    }
    return out;
  }

  function forma(w, dil, nast) {
    const smaz = [], k = (x) => { smaz.push(x); return x; };
    try {
      const N = Object.assign({ stul: 220, kolikD: 4, vuleKoliku: 0.25, oznaceni: true }, nast || {});
      const M = w.Manifold, CS = w.CrossSection, varovani = [];
      const H = Math.max(3, +N.vyska || 30), stul = Math.max(60, +N.stul || 220);
      const o = dil.ohr || OHD.ohraniceni(dil.obrys);
      const kolem = [dil.obrys.map((p) => [p[0], p[1]])];
      for (const d of dil.diry) if (d.typ === 'okno') kolem.push(kruh(d.x, d.y, d.r, Math.max(24, Math.round(d.r * 3))));
      const profil = k(new CS(kolem, 'EvenOdd'));
      let telo = k(profil.extrude(H));
      if (Math.min(o.w, o.h) > stul) varovani.push(`Díl ${dil.id} je ${Math.round(o.w)} × ${Math.round(o.h)} mm – větší než tisková plocha i po rozdělení; zmenšete hloubku formy nebo frézujte z MDF.`);
      else if (o.h > stul) varovani.push(`Díl ${dil.id} je vysoký ${Math.round(o.h)} mm (víc než ${stul} mm) – otočte díl na podložce úhlopříčně nebo zmenšete hloubku formy.`);
      // rozdělení na části
      const xr = o.w > stul ? rezy(o, stul) : [], hr = [o.x0 - 1].concat(xr, [o.x1 + 1]);
      const rKol = (+N.kolikD || 4) / 2 + (+N.vuleKoliku || 0), Lk = 12;
      // kolíkové otvory v řezech (kapka, špička nahoru = +z při tisku)
      const kapka = [];
      for (let i = 0; i < 28; i++) { const a = 2 * Math.PI * i / 28; kapka.push([rKol * Math.cos(a), rKol * Math.sin(a)]); }
      // tečny ke špičce ve výšce r·√2 (45°)
      const spicka = (y, z) => { const b = kapka.filter((p) => !(p[1] > rKol * 0.70710678)); return b.concat([[0, rKol * 1.41421356]]).map((p) => [p[0] + y, p[1] + z]); };
      let kolikuOtvoru = 0;
      for (const x of xr) {
        const us = useky(dil, x, rKol + 3).filter((u) => u[1] - u[0] >= 0);
        const ys = [];
        for (const u of us) { if (u[1] - u[0] > 4 * rKol + 12) ys.push(u[0] + (u[1] - u[0]) * 0.25, u[0] + (u[1] - u[0]) * 0.75); else ys.push((u[0] + u[1]) / 2); }
        if (!ys.length) { varovani.push(`V řezu x = ${Math.round(x)} mm není místo pro kolíky – části slepte na tupo.`); continue; }
        for (const y of ys.slice(0, 3)) {
          // průřez v rovině (y, z), vytažení podél x: CrossSection v (u, v) → extrude podél w, pak otočit tak, aby u→y, v→z, w→x
          const cs = k(new CS([spicka(0, 0)], 'Positive'));
          let v = k(cs.extrude(2 * Lk));
          // (u, v, w) → (x = w, y = u, z = v): otočení o −90° kolem z a pak o −90° kolem y… zapsáno přímo maticí přes warp
          v = k(v.warp((p) => { const u = p[0], vv = p[1], ww = p[2]; p[0] = ww - Lk + x; p[1] = u + y; p[2] = vv + H / 2; }));
          telo = k(telo.subtract(v)); kolikuOtvoru++;
        }
      }
      // vyrytí označení na horní ploše (z = H)
      const casti = [];
      for (let i = 0; i < hr.length - 1; i++) {
        const box = k(M.cube([hr[i + 1] - hr[i], o.h + 4, H + 4], false).translate([hr[i], o.y0 - 2, -2]));
        let c = k(telo.intersect(box));
        if (N.oznaceni !== false) {
          const txt = dil.id + (hr.length > 2 ? '-' + (i + 1) : '');
          const sub = Object.assign({}, dil, { obrys: dil.obrys });
          for (const h of [8, 6, 4]) {
            const g = segmentyTextu(txt, h);
            let misto = null;
            const x0 = Math.max(o.x0, hr[i]) + 2, x1 = Math.min(o.x1, hr[i + 1]) - 2;
            for (let y = o.y0 + 2; y + g.vyska < o.y1 && !misto; y += 1) for (let x = x0; x + g.sirka <= x1; x += 1) {
              const roh = [[x, y], [x + g.sirka, y], [x, y + g.vyska], [x + g.sirka, y + g.vyska], [x + g.sirka / 2, y + g.vyska / 2]];
              if (roh.every((p) => OHD.vzdOdOkraje(p, sub) >= 2)) { misto = [x, y]; break; }
            }
            if (!misto) continue;
            for (const [a, b, cx, d] of g.obd) c = k(c.subtract(k(M.cube([cx - a, d - b, 1.6], false).translate([misto[0] + a, misto[1] + b, H - 0.6]))));
            break;
          }
        }
        casti.push(c);
      }
      // části vedle sebe v ose y (mezera 8 mm)
      let vse = null, posun = 0;
      const rozmery = [];
      for (const c of casti) {
        const bb = c.boundingBox();
        const t = posun ? k(c.translate([0, posun, 0])) : c;
        vse = vse ? k(vse.add(t)) : t;
        rozmery.push([r2(bb.max[0] - bb.min[0]), r2(bb.max[1] - bb.min[1]), r2(H)]);
        posun += (bb.max[1] - bb.min[1]) + 8;
      }
      if (casti.length > 1) varovani.push(`Díl ${dil.id} je delší než tisková plocha ${stul} mm – rozdělen na ${casti.length} části, spoje s ${kolikuOtvoru} otvory pro ocelové kolíky Ø${+N.kolikD || 4} × ${2 * Lk} mm.`);
      return sit(vse, { casti: casti.length, kolikuOtvoru, varovani, rozmery });
    } finally { for (const x of smaz) { try { x.delete(); } catch (e) { /* uvolněno */ } } }
  }

  function stlBinarni(poz, idx, nazev) {
    const nt = idx.length / 3, buf = new ArrayBuffer(84 + nt * 50), dv = new DataView(buf);
    const hl = String(nazev || 'forma').normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 79);
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

  const API = { forma, stlBinarni, segmentyTextu };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.OHDSTL = API;
})(typeof window !== 'undefined' ? window : globalThis);

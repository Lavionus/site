/* ============================================================
   Vrtací šablony – STL přípravku (manifold-3d z obsah/lib/manifold, Apache-2.0; modul WASM parametrem)
   Souřadnice: x, y = souřadnice dílu (mm), z = 0 je plocha, která leží na vrtané desce, deska přípravku
   je z ∈ [0, T], dorazy visí dolů z ∈ [−V, T] a těsně obepínají referenční hrany.
   - pripravek(w, dil, nast)  → {poz, idx, objem, rod, otvory:[{x,y,d}], casti, varovani, rozmer}
   - krouzky(w, dily, nast)   → hloubkové kroužky pro všechny průměry s hloubkou
   - stlBinarni(poz, idx, nazev)
   ============================================================ */
(function (koren) {
  'use strict';
  const VS = koren.VS || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const r2 = (x) => Math.round(x * 100) / 100;

  /* 7segmentové znaky pro vyrytí označení (segmenty a–g) */
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
    A: 'abcefg', B: 'cdefg', C: 'adef', D: 'bcdeg', E: 'adefg', F: 'aefg', H: 'bcefg', L: 'def', P: 'abefg', U: 'bcdef', '-': 'g' };
  /** obdélníky [x0, y0, x1, y1] textu výšky h od bodu (0, 0) vlevo dole */
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
  const segmentu = (r) => Math.max(24, Math.min(96, Math.round(r * 6)));

  /**
   * Rozdělení dlouhého přípravku na části do tiskové plochy: podél delší osy, sousední části
   * sdílejí jednu díru (do ní se při přesunu zasune kolík nebo vrták – index).
   * Vrací [{x0, y0, x1, y1, hrany, diry, index: [díry sdílené s předchozí částí]}].
   */
  function casti(dil, obl, nast) {
    const N = Object.assign({}, VS.NASTAVENI, nast || {}), stul = Math.max(60, +N.stul || 220), S = +N.dorazS || 0;
    const sw = obl.x1 - obl.x0 + 2 * S, sh = obl.y1 - obl.y0 + 2 * S;
    if (obl.kruh || (sw <= stul && sh <= stul) || dil.diry.length < 2) return [{ x0: obl.x0, y0: obl.y0, x1: obl.x1, y1: obl.y1, hrany: obl.hrany.slice(), diry: dil.diry.slice(), index: [] }];
    const osaY = sh > stul && sh >= sw, k = osaY ? 'y' : 'x';
    const lo = osaY ? obl.y0 : obl.x0, hi = osaY ? obl.y1 : obl.x1;
    const hLo = osaY ? 'D' : 'L', hHi = osaY ? 'H' : 'P';
    const souradnice = [...new Set(dil.diry.map((q) => q[k]))].sort((a, b) => a - b);
    const okr = (q) => q.d / 2 + 6 + (+N.okrajSablony || 0) * 0.5;
    const maxR = Math.max(...dil.diry.map(okr));
    const out = [], n = souradnice.length, konec = (j) => (j === n - 1 ? hi : souradnice[j] + maxR);
    let i = 0;
    for (let bezpecnost = 0; bezpecnost < 200; bezpecnost++) {
      const a = out.length ? Math.max(lo, souradnice[i] - maxR) : lo;
      let j = i;
      while (j + 1 < n && konec(j + 1) - a + 2 * S <= stul) j++;
      if (j === i && j < n - 1) j = i + 1;           // vynutit postup (část bude větší než stůl → varování)
      const posl = j === n - 1;
      let b = konec(j), aa = a;
      let diry = dil.diry.filter((q) => q[k] >= souradnice[i] - 1e-6 && q[k] <= souradnice[j] + 1e-6);
      // přibrat díry, které do části zasahují, a hranice posunout, aby žádnou neřízly
      for (let it = 0; it < 4; it++) {
        diry = dil.diry.filter((q) => q[k] + q.d / 2 + 1 > aa && q[k] - q.d / 2 - 1 < b);
        aa = Math.max(lo, Math.min(aa, ...diry.map((q) => q[k] - okr(q))));
        b = Math.min(hi, Math.max(b, ...diry.map((q) => q[k] + okr(q))));
      }
      const hrany = obl.hrany.filter((h) => (h !== hLo || !out.length) && (h !== hHi || posl));
      const index = out.length ? diry.filter((q) => Math.abs(q[k] - souradnice[i]) < 1e-6) : [];
      out.push(osaY ? { x0: obl.x0, x1: obl.x1, y0: aa, y1: b, hrany, diry, index } : { x0: aa, x1: b, y0: obl.y0, y1: obl.y1, hrany, diry, index });
      if (posl) break;
      i = j;           // další část začíná sdílenou dírou
    }
    return out;
  }

  /** jedna část přípravku (manifold) v souřadnicích dílu */
  function teloCasti(w, dil, c, N, k, kruh) {
    const M = w.Manifold, T = Math.max(1.5, +N.stlTl || 6), V = Math.max(0, +N.dorazV || 0), S = Math.max(1, +N.dorazS || 5);
    const box = (x0, y0, z0, x1, y1, z1) => k(M.cube([x1 - x0, y1 - y0, z1 - z0], false).translate([x0, y0, z0]));
    let telo;
    const otvory = [];
    if (kruh) {
      const R = dil.w / 2, cx = dil.w / 2, cy = dil.h / 2;
      telo = k(k(M.cylinder(T, R, R, segmentu(R), false)).translate([cx, cy, 0]));
      const stred = dil.diry.find((q) => q.typ === 'stred');
      if (V > 0 && stred && stred.d >= 6) {
        // středicí čep do středového otvoru
        const rc = stred.d / 2 - 0.15;
        telo = k(telo.add(k(k(M.cylinder(V + 0.01, rc, rc, segmentu(rc), false)).translate([cx, cy, -V]))));
      } else if (V > 0) {
        // límec kolem vnějšího průměru dílu
        const l = k(k(k(M.cylinder(V + T, R + S, R + S, segmentu(R + S), false)).subtract(k(M.cylinder(V + T + 2, R + 0.15, R + 0.15, segmentu(R), false).translate([0, 0, -1])))).translate([cx, cy, -V]));
        telo = k(telo.add(l));
      }
    } else {
      telo = box(c.x0, c.y0, 0, c.x1, c.y1, T);
      if (V > 0) {
        const H = c.hrany, ey0 = c.y0 - (H.includes('D') ? S : 0), ey1 = c.y1 + (H.includes('H') ? S : 0), ex0 = c.x0 - (H.includes('L') ? S : 0), ex1 = c.x1 + (H.includes('P') ? S : 0);
        if (H.includes('L')) telo = k(telo.add(box(c.x0 - S, ey0, -V, c.x0, ey1, T)));
        if (H.includes('P')) telo = k(telo.add(box(c.x1, ey0, -V, c.x1 + S, ey1, T)));
        if (H.includes('D')) telo = k(telo.add(box(ex0, c.y0 - S, -V, ex1, c.y0, T)));
        if (H.includes('H')) telo = k(telo.add(box(ex0, c.y1, -V, ex1, c.y1 + S, T)));
      }
    }
    const vedeni = Math.max(0, +N.vedeni || 0), stena = Math.max(1, +N.vedeniStena || 3);
    const diry = c.diry.filter((q) => !(kruh && q.typ === 'stred' && V > 0 && q.d >= 6));
    // nálitky vedení nahoře
    if (vedeni > 0) for (const q of diry) {
      const o = VS.otvorPripravku(q.d, N), r = o.d / 2 + stena;
      telo = k(telo.add(k(k(M.cylinder(vedeni + 0.01, r, r, segmentu(r), false)).translate([q.x, q.y, T - 0.005]))));
    }
    // otvory skrz desku i nálitky
    for (const q of diry) {
      const o = VS.otvorPripravku(q.d, N), r = o.d / 2, h = T + vedeni + V + 4;
      telo = k(telo.subtract(k(k(M.cylinder(h, r, r, segmentu(r), false)).translate([q.x, q.y, -V - 2]))));
      otvory.push({ x: q.x, y: q.y, d: o.d, pouzdro: o.pouzdro, vrtak: q.d });
    }
    return { telo, otvory, T, V, S };
  }

  /** místo pro vyrytý nápis: první volný obdélník na desce (bez kolize s otvory a nálitky) */
  function mistoNapisu(c, otvory, sirka, vyska, N, kruh, dil) {
    const st = Math.max(1, +N.vedeniStena || 3), ved = +N.vedeni > 0;
    const volne = (x, y) => {
      if (kruh) { const R = dil.w / 2 - 2; for (const [px, py] of [[x, y], [x + sirka, y], [x, y + vyska], [x + sirka, y + vyska]]) if (Math.hypot(px - dil.w / 2, py - dil.h / 2) > R) return false; }
      else if (x < c.x0 + 2 || y < c.y0 + 2 || x + sirka > c.x1 - 2 || y + vyska > c.y1 - 2) return false;
      for (const o of otvory) {
        const r = o.d / 2 + (ved ? st : 0) + 1.5, nx = Math.max(x, Math.min(o.x, x + sirka)), ny = Math.max(y, Math.min(o.y, y + vyska));
        if (Math.hypot(nx - o.x, ny - o.y) < r) return false;
      }
      return true;
    };
    const x0 = kruh ? 0 : c.x0, y0 = kruh ? 0 : c.y0, x1 = kruh ? dil.w : c.x1, y1 = kruh ? dil.h : c.y1;
    for (let y = y1 - vyska - 2; y >= y0; y -= 1) for (let x = x0 + 2; x + sirka <= x1; x += 1) if (volne(x, y)) return [x, y];
    return null;
  }

  function pripravekDilu(w, dil, nast, k, vysunX) {
    const N = Object.assign({}, VS.NASTAVENI, nast || {}), obl = dil.oblast || VS.oblastSablony(dil, N);
    const varovani = [];
    const cc = casti(dil, obl, N);
    let vse = null, pravy = null, otvoryVse = [];
    const rozmery = [];
    cc.forEach((c, i) => {
      const { telo, otvory, T, S } = teloCasti(w, dil, c, N, k, obl.kruh);
      let t = telo;
      if (N.oznaceni !== false) {
        const txt = dil.id + (cc.length > 1 ? '-' + (i + 1) : '');
        for (const h of [7, 5, 4]) {
          const g = segmentyTextu(txt, h), m = mistoNapisu(c, otvory, g.sirka, g.vyska, N, obl.kruh, dil);
          if (!m) continue;
          const hl = Math.min(0.8, T * 0.25);
          for (const [a, b, cx, d] of g.obd) t = k(t.subtract(k(w.Manifold.cube([cx - a, d - b, hl + 1], false).translate([m[0] + a, m[1] + b, T - hl]))));
          break;
        }
      }
      // části vedle sebe v ose x (první zůstává v souřadnicích dílu)
      const xl = obl.kruh ? -S : c.x0 - S, xp = obl.kruh ? dil.w + S : c.x1 + S;
      const dx = pravy == null || N.naMiste ? 0 : pravy + 8 - xl;
      if (dx) t = k(t.translate([dx, 0, 0]));
      pravy = xp + dx;
      vse = vse ? k(vse.add(t)) : t;
      for (const o of otvory) otvoryVse.push(Object.assign({}, o, { x: r2(o.x + dx), cast: i + 1 }));
      rozmery.push([r2(xp - xl), r2((obl.kruh ? dil.h : c.y1 - c.y0) + 2 * S)]);
    });
    if (cc.length > 1) varovani.push(`Přípravek je delší než tisková plocha ${N.stul} mm – rozdělen na ${cc.length} části. Sousední části sdílejí jednu díru: po přesunu do ní zasuňte kolík nebo stopku vrtáku (index).`);
    const st = Math.max(...rozmery.map((q) => Math.max(q[0], q[1])));
    if (st > (+N.stul || 220)) varovani.push(`Část přípravku (${Math.round(st)} mm) je větší než tisková plocha ${N.stul} mm.`);
    if (vysunX) vse = k(vse.translate([vysunX, 0, 0]));
    return { telo: vse, otvory: otvoryVse.map((o) => Object.assign(o, { x: o.x + (vysunX || 0) })), casti: cc, varovani, rozmery };
  }

  /** přípravek pro díl; nast.par → navíc zrcadlový kus (pro protikus) vedle */
  function pripravek(w, dil, nast) {
    const smaz = [], k = (x) => { smaz.push(x); return x; };
    try {
      const N = Object.assign({}, VS.NASTAVENI, nast || {});
      const a = pripravekDilu(w, dil, N, k, 0);
      let telo = a.telo, otvory = a.otvory, varovani = a.varovani.slice(), pocet = a.casti.length;
      if (N.par) {
        const z = VS.zrcadliDil(dil, 'x', { id: dil.id + 'Z' });
        z.oblast = VS.oblastSablony(z, N);
        const bb = telo.boundingBox(), posunX = bb.max[0] + 10 - (z.oblast.x0 - (+N.dorazS || 0));
        const b = pripravekDilu(w, z, N, k, posunX);
        telo = k(telo.add(b.telo)); otvory = otvory.concat(b.otvory.map((o) => Object.assign(o, { zrcadlo: true })));
        pocet += b.casti.length;
      }
      return sit(telo, { otvory, varovani, kusu: pocet, casti: a.casti });
    } finally { for (const x of smaz) { try { x.delete(); } catch (e) { /* uvolněno */ } } }
  }

  /** hloubkové kroužky (stavěcí kroužek na vrták) pro každý průměr s hloubkou; s radiálním otvorem pro šroub */
  function krouzky(w, dily, nast) {
    const smaz = [], k = (x) => { smaz.push(x); return x; };
    try {
      const N = Object.assign({}, VS.NASTAVENI, nast || {}), M = w.Manifold;
      const prumery = [...new Set(dily.flatMap((d) => d.diry.filter((q) => q.hl > 0 && q.d <= 40).map((q) => q.d)))].sort((a, b) => a - b);
      if (!prumery.length) throw new Error('Žádná díra nemá zadanou hloubku – kroužek není potřeba.');
      let vse = null, x = 0;
      const info = [];
      for (const d of prumery) {
        const ri = d / 2 + 0.1, ro = Math.max(ri + (+N.krouzekStena || 4), ri + 3.5, 7), H = Math.max(5, +N.krouzekV || 10), rs = Math.max(0.8, (+N.srouubek || 3) / 2 * 0.85);
        let t = k(k(M.cylinder(H, ro, ro, segmentu(ro), false)).subtract(k(k(M.cylinder(H + 2, ri, ri, segmentu(ri), false)).translate([0, 0, -1]))));
        const sr = k(k(k(M.cylinder(ro + 2, rs, rs, 16, false)).rotate([0, 90, 0])).translate([0, 0, H / 2]));
        t = k(t.subtract(sr));
        x += ro;
        t = k(t.translate([x, 0, 0]));
        vse = vse ? k(vse.add(t)) : t;
        info.push({ vrtak: d, vnitrni: r2(ri * 2), vnejsi: r2(ro * 2), vyska: H, x });
        x += ro + 5;
      }
      return sit(vse, { krouzky: info });
    } finally { for (const x of smaz) { try { x.delete(); } catch (e) { /* uvolněno */ } } }
  }

  /** binární STL z indexované sítě */
  function stlBinarni(poz, idx, nazev) {
    const nt = idx.length / 3, buf = new ArrayBuffer(84 + nt * 50), dv = new DataView(buf);
    const hl = String(nazev || 'vrtaci sablona').normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 79);
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

  const API = { pripravek, krouzky, casti, segmentyTextu, stlBinarni };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.VSSTL = API;
})(typeof window !== 'undefined' ? window : globalThis);

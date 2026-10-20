/* ============================================================
   Sluneční hodiny – STL kapesních výškových hodin
   Tělesa skládá manifold-3d (obsah/lib/manifold, Apache-2.0); modul WASM se předává parametrem.
   - postavKapesni(w, R)  → hranol s otvory, rýhami značek a (volitelně) očkem na zavěšení
   - postavKolik(w, R)    → kolík(y): dřík o průměru otvoru − vůle, zarážka / hlavička
   - postavVse(w, R)      → hranol a kolíky vedle sebe v jednom souboru
   každá vrací {poz: Float32Array, idx: Uint32Array, objem, rod, ...}; mm, osa z nahoru.
   Nápisy (měsíce) se nerývají – jen otvory, vodorovné rýhy značek a svislé rýhy mezi sloupci.
   Dva kolíky u destičky (2 stěny) = jako originál: otvory skrz, jeden kolík s hlavičkou ve dvou
   polohách (zimní sloupce: vyčnívá i s hlavičkou, letní: prostrčený skrz až po hlavičku).
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180;

  /** společné rozměry hranolu a otvorů */
  function parametry(R) {
    const p = R.p, I = R.info, n = I.rozvin.steny, per = I.rozvin.sloupcuNaStenu;
    const W = +p.sirkaMm, H = +p.vyskaMm, T = Math.max(1, +p.tloustkaMm || 6), dk = Math.max(0.5, +p.prumerTyce || 2);
    const vule = Math.max(0, Math.min(dk * 0.45, p.kapVule == null ? 0.2 : +p.kapVule));
    const a = n === 2 ? T / 2 : W / (2 * Math.tan(Math.PI / n));            // vzdálenost stěny od osy
    const colW = W / per;
    const pruchozi = n === 2 && !!p.kapDvaKoliky;
    const uhelSteny = (i) => (n === 2 ? (i === 0 ? -90 : 90) : (i + 0.5) * 360 / n);
    const poloha = (c) => { const j = I.sloupce.filter((q) => q.stena === c.stena).indexOf(c); return { j, u: -W / 2 + (j + 0.5) * colW }; };
    // hloubka slepých otvorů: zmenšovat, dokud se otvory uvnitř nepotkají
    const osy = I.sloupce.map((c) => {
      const u = poloha(c).u, th = uhelSteny(c.stena) * RAD, nx = Math.cos(th), ny = Math.sin(th);
      return { x: a * nx - u * ny, y: a * ny + u * nx, nx, ny };
    });
    const vzd = (A, B, d) => {
      let m = Infinity;
      for (let i = 0; i <= 20; i++) for (let j = 0; j <= 20; j++) {
        const ax = A.x - A.nx * d * i / 20, ay = A.y - A.ny * d * i / 20, bx = B.x - B.nx * d * j / 20, by = B.y - B.ny * d * j / 20;
        m = Math.min(m, Math.hypot(ax - bx, ay - by));
      }
      return m;
    };
    let hloubka = n === 2 ? Math.max(1, T * 0.42) : a * 0.7;
    if (pruchozi) hloubka = T;
    else {
      const potkaji = (d) => osy.some((A, i) => osy.some((B, j) => j > i && vzd(A, B, d) < dk + 0.6));
      while (hloubka > 1 && potkaji(hloubka)) hloubka *= 0.92;
    }
    return { p, I, n, per, W, H, T, dk, vule, a, colW, pruchozi, uhelSteny, poloha, hloubka };
  }

  function sit(vysl, navic) {
    const st = vysl.status();
    if (st !== 'NoError') throw new Error('manifold hlásí ' + st);
    const mesh = vysl.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let q = 0, t = 0; q < vp.length; q += np, t += 3) { poz[t] = vp[q]; poz[t + 1] = vp[q + 1]; poz[t + 2] = vp[q + 2]; }
    return Object.assign({ poz, idx: new Uint32Array(mesh.triVerts), objem: vysl.volume(), rod: vysl.genus() }, navic || {});
  }

  function teloHranolu(w, R, k) {
    const M = w.Manifold, P = parametry(R), { n, W, H, T, dk, a, colW, I, uhelSteny, poloha } = P;
    const hlRyhy = Math.min(0.6, a * 0.2), sRyhy = Math.max(0.35, Math.min(0.8, H * 0.006));
    let telo;
    if (n === 2) telo = k(M.cube([W, T, H], false).translate([-W / 2, -T / 2, 0]));
    else { const Rc = W / (2 * Math.sin(Math.PI / n)); telo = k(M.cylinder(H, Rc, Rc, n, false)); }
    const odeber = [];
    // těleso v místní soustavě (x = ven ze stěny, y = doprava po stěně, z = výška) → na stěnu i
    const naStenu = (m, i, u, z) => {
      const th = uhelSteny(i), c = Math.cos(th * RAD), s = Math.sin(th * RAD), pravo = [-s, c];
      return k(k(m.rotate([0, 0, th])).translate([a * c + u * pravo[0], a * s + u * pravo[1], z]));
    };
    const rOtv = dk / 2 + 0.1;
    for (const c of I.sloupce) {
      const { j, u } = poloha(c), i = c.stena;
      const hl = P.pruchozi ? 2 * a + 1 : P.hloubka;
      const valec = k(k(k(M.cylinder(hl + 1, rOtv, rOtv, 24, false)).rotate([0, 90, 0])).translate([-hl, 0, 0]));
      odeber.push(naStenu(valec, i, u, H - I.otvor));
      for (const z of c.znacky) {
        if (z.mimo) continue;
        const delka = colW * (z.hlavni ? 0.55 : 0.4);
        const ryha = k(M.cube([hlRyhy + 0.5, delka, sRyhy], true).translate([(0.5 - hlRyhy) / 2, 0, 0]));
        odeber.push(naStenu(ryha, i, u - colW * 0.08, H - I.otvor - z.pad));
      }
      if (j > 0) {
        const L = H - I.otvor * 0.4 - 1.5;
        const sv = k(M.cube([hlRyhy * 0.7 + 0.5, 0.35, L], true).translate([(0.5 - hlRyhy * 0.7) / 2, 0, 0]));
        odeber.push(naStenu(sv, i, -W / 2 + j * colW, 1.5 + L / 2));
      }
    }
    let vysl = telo;
    for (const o of odeber) vysl = k(vysl.subtract(o));
    // očko na zavěšení (prstenec v rovině širokých stěn), spodkem zapuštěné do horní podstavy
    if (R.p.kapOcko !== false) {
      const ro = Math.max(2.5, Math.min(8, W * 0.16)), ri = ro * 0.55, t = Math.max(1.2, Math.min(n === 2 ? T : W * 0.3, 3));
      const kruh = (r) => k(k(M.cylinder(t, r, r, 32, true)).rotate([90, 0, 0]));
      const prsten = k(kruh(ro).subtract(kruh(ri)));
      vysl = k(vysl.add(k(prsten.translate([0, 0, H + ro - 0.8]))));
    }
    return { telo: vysl, P };
  }

  function postavKapesni(w, R) {
    const smaz = [], k = (x) => { smaz.push(x); return x; };
    try { const { telo, P } = teloHranolu(w, R, k); return sit(telo, { pruchozi: P.pruchozi, hloubkaOtvoru: P.hloubka }); }
    finally { for (const x of smaz) { try { x.delete(); } catch (e) { /* uvolněno */ } } }
  }

  /** kolíky jako tělesa stojící na podložce (osa z); vrací [{teleso, popis, prumer, delka}] */
  function koliky(w, R, k) {
    const M = w.Manifold, P = parametry(R), I = R.info, d = P.dk - P.vule, rd = d / 2;
    const hlav = Math.max(P.dk * 1.8, P.dk + 1.5) / 2;
    const Lletni = I.vyskaNodu, Lzimni = I.kolikZima || Lletni;
    const out = [];
    if (P.pruchozi) {
      // jako originál: dřík = letní délka + tloušťka destičky, hlavička = rozdíl délek
      const drik = Lletni + P.T, hl = Math.max(1.5, Lzimni - Lletni);
      const t = k(k(M.cylinder(drik, rd, rd, 32, false)).add(k(k(M.cylinder(hl, hlav, hlav * 0.8, 32, false)).translate([0, 0, drik]))));
      out.push({ teleso: t, popis: `kolík s hlavičkou: dřík ${drik.toFixed(1)} mm, hlavička ${hl.toFixed(1)} mm`, prumer: d, delka: drik + hl, rHlav: hlav });
    } else {
      const delky = Lzimni !== Lletni ? [Lzimni, Lletni] : [Lletni];
      for (const L of delky) {
        // zasunutá část (otvor − 0,3 mm), zarážka 1 mm na stěně, vyčnívající zbytek: celkem L od stěny
        const zas = Math.max(0.8, P.hloubka - 0.3), zar = 1;
        const t = k(k(k(M.cylinder(zas + zar + L - zar, rd, rd, 32, false)).add(k(k(M.cylinder(zar, hlav, hlav, 32, false)).translate([0, 0, zas])))));
        out.push({ teleso: t, popis: `kolík ${L.toFixed(1)} mm: zasunout ${zas.toFixed(1)} mm, zarážka 1 mm`, prumer: d, delka: zas + L, rHlav: hlav });
      }
    }
    return { out, P };
  }

  function postavKolik(w, R) {
    const smaz = [], k = (x) => { smaz.push(x); return x; };
    try {
      const { out, P } = koliky(w, R, k);
      let vse = null, x = 0;
      for (const q of out) { const t = k(q.teleso.translate([x, 0, 0])); vse = vse ? k(vse.add(t)) : t; x += q.rHlav * 2 + 4; }
      return sit(vse, { koliky: out.map((q) => ({ popis: q.popis, prumer: q.prumer, delka: q.delka })), otvor: P.dk + 0.2, vule: P.vule });
    } finally { for (const x of smaz) { try { x.delete(); } catch (e) { /* uvolněno */ } } }
  }

  function postavVse(w, R) {
    const smaz = [], k = (x) => { smaz.push(x); return x; };
    try {
      const { telo, P } = teloHranolu(w, R, k);
      const { out } = koliky(w, R, k);
      const sirka = P.n === 2 ? P.W : 2 * P.W / (2 * Math.sin(Math.PI / P.n));
      let vse = telo, x = sirka / 2 + 6;
      for (const q of out) { vse = k(vse.add(k(q.teleso.translate([x + q.rHlav, 0, 0])))); x += q.rHlav * 2 + 4; }
      return sit(vse, { dilu: 1 + out.length });
    } finally { for (const x of smaz) { try { x.delete(); } catch (e) { /* uvolněno */ } } }
  }

  /** binární STL z indexované sítě */
  function stlBinarni(poz, idx, nazev) {
    const nt = idx.length / 3, buf = new ArrayBuffer(84 + nt * 50), dv = new DataView(buf);
    const hl = String(nazev || 'slunecni hodiny').slice(0, 79);
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

  const API = { postavKapesni, postavKolik, postavVse, stlBinarni, parametry };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.SHSTL = API;
})(typeof window !== 'undefined' ? window : globalThis);

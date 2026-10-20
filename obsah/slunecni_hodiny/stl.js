/* ============================================================
   Sluneční hodiny – STL kapesních výškových hodin (hranol s otvory a vyrytými značkami)
   Tělesa skládá manifold-3d (obsah/lib/manifold, Apache-2.0); modul WASM se předává parametrem.
   postavKapesni(w, r) → {poz: Float32Array, idx: Uint32Array, objem, rod}
   r = výsledek SH.navrh({typ:'kapesni', …}); souřadnice mm, osa z nahoru (horní podstava z = H).
   Nápisy (měsíce) se nerývají – jen otvory, vodorovné rýhy značek a svislé rýhy mezi sloupci.
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180;

  function postavKapesni(w, r) {
    const M = w.Manifold, smaz = [];
    const k = (x) => { smaz.push(x); return x; };
    try {
      const p = r.p, I = r.info, n = I.rozvin.steny, per = I.rozvin.sloupcuNaStenu;
      const W = +p.sirkaMm, H = +p.vyskaMm, T = Math.max(1, +p.tloustkaMm || 6), dk = Math.max(0.5, +p.prumerTyce || 2);
      const a = n === 2 ? T / 2 : W / (2 * Math.tan(Math.PI / n));            // vzdálenost stěny od osy
      const colW = W / per, hlRyhy = Math.min(0.6, a * 0.2), sRyhy = Math.max(0.35, Math.min(0.8, H * 0.006));
      let telo;
      if (n === 2) telo = k(M.cube([W, T, H], false).translate([-W / 2, -T / 2, 0]));
      else {
        const Rc = W / (2 * Math.sin(Math.PI / n));
        // pravidelný n-boký hranol: vrcholy natočené tak, aby normála stěny i ležela pod úhlem (i + ½)·360/n
        telo = k(k(M.cylinder(H, Rc, Rc, n, false)).rotate([0, 0, 0]));
      }
      const uhelSteny = (i) => (n === 2 ? (i === 0 ? -90 : 90) : (i + 0.5) * 360 / n);
      const uhelSteny0 = (i) => (n === 2 ? (i === 0 ? -90 : 90) : (i + 0.5) * 360 / n);
      // osy otvorů (všechny ve stejné výšce): hloubku zmenšovat, dokud se otvory uvnitř nepotkají
      const osy = I.sloupce.map((c) => {
        const j = I.sloupce.filter((q) => q.stena === c.stena).indexOf(c), u = -W / 2 + (j + 0.5) * colW;
        const th = uhelSteny0(c.stena) * RAD, nx = Math.cos(th), ny = Math.sin(th);
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
      let hloubkaOtvoru = n === 2 ? Math.max(1, T * 0.42) : a * 0.7;
      const potkaji = (d) => osy.some((A, i) => osy.some((B, j) => j > i && vzd(A, B, d) < dk + 0.6));
      while (hloubkaOtvoru > 1 && potkaji(hloubkaOtvoru)) hloubkaOtvoru *= 0.92;
      const odeber = [];
      // umístí těleso postavené v místní soustavě (x = ven ze stěny, y = doprava po stěně, z = výška)
      const naStenu = (m, i, u, z) => {
        const th = uhelSteny(i), c = Math.cos(th * RAD), s = Math.sin(th * RAD);
        const pravo = [-s, c];
        return k(k(m.rotate([0, 0, th])).translate([a * c + u * pravo[0], a * s + u * pravo[1], z]));
      };
      for (const c of I.sloupce) {
        const i = c.stena, j = I.sloupce.filter((q) => q.stena === i).indexOf(c);
        const u = -W / 2 + (j + 0.5) * colW;
        // otvor pro kolík (válec podél místní osy x, dovnitř hranolu)
        const valec = k(k(k(M.cylinder(hloubkaOtvoru + 1, dk / 2 + 0.1, dk / 2 + 0.1, 24, false)).rotate([0, 90, 0])).translate([-hloubkaOtvoru, 0, 0]));
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
      const st = vysl.status();
      if (st !== 'NoError') throw new Error('manifold hlásí ' + st);
      const mesh = vysl.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
      const poz = new Float32Array(vp.length / np * 3);
      for (let q = 0, t = 0; q < vp.length; q += np, t += 3) { poz[t] = vp[q]; poz[t + 1] = vp[q + 1]; poz[t + 2] = vp[q + 2]; }
      return { poz, idx: new Uint32Array(mesh.triVerts), objem: vysl.volume(), rod: vysl.genus() };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* uvolněno */ } }
    }
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

  const API = { postavKapesni, stlBinarni };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.SHSTL = API;
})(typeof window !== 'undefined' ? window : globalThis);

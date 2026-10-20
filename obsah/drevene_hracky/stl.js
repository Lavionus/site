/* ============================================================
   Dřevěné hračky – STL dílů pro 3D tisk (manifold-3d z obsah/lib/manifold, Apache-2.0; modul WASM parametrem)
   Všechny díly se tisknou bez podpor (FDM): kola naplocho se sražením 45°, kolíky hlavou dolů,
   úchyty hlavou dolů, moduly dráhy drážkou nahoru.
   - dil(w, id, N, nast) → {poz, idx, objem, rod, kusu, rozmer:[x,y,z], varovani, popis}
   - stlBinarni(poz, idx, nazev)
   ============================================================ */
(function (koren) {
  'use strict';
  const DH = koren.DH || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const cz = DH.cz;
  const seg = (r, q) => Math.max(24, Math.min(q || 96, Math.round(r * 5)));

  function sit(vysl, navic) {
    const st = vysl.status();
    if (st !== 'NoError') throw new Error('manifold hlásí ' + st);
    const mesh = vysl.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let q = 0, t = 0; q < vp.length; q += np, t += 3) { poz[t] = vp[q]; poz[t + 1] = vp[q + 1]; poz[t + 2] = vp[q + 2]; }
    const bb = vysl.boundingBox();
    return Object.assign({ poz, idx: new Uint32Array(mesh.triVerts), objem: vysl.volume(), rod: vysl.genus(), rozmer: [0, 1, 2].map((i) => bb.max[i] - bb.min[i]) }, navic || {});
  }

  /** válec se sražením hran (spodní a horní) – pro FDM sražení 45° bez podpor */
  function valecSrazeny(M, k, r, h, c0, c1, q) {
    const n = seg(r, q);
    c0 = Math.min(c0 || 0, h / 2 - 0.01, r - 0.5); c1 = Math.min(c1 || 0, h / 2 - 0.01, r - 0.5);
    let t = k(M.cylinder(h - c0 - c1, r, r, n, false).translate([0, 0, c0]));
    if (c0 > 0) t = k(t.add(k(M.cylinder(c0 + 0.001, r - c0, r, n, false))));
    if (c1 > 0) t = k(t.add(k(M.cylinder(c1, r, r - c1, n, false).translate([0, 0, h - c1]))));
    return t;
  }

  const TVORBA = {
    /** kolo: naplocho, sražené hrany, náboj (= podložka) nahoře na vnitřní straně – tiskne se bez podpor */
    kolo(w, k, P, nast) {
      const M = w.Manifold, R = P.D / 2, h = P.tk, c = Math.min(2, h / 5), q = +nast.stlKvalita || 96;
      let t = valecSrazeny(M, k, R, h, c, c, q);
      // vybrání v boku (vzhled pneumatiky) – mělké, jen když je kolo dost široké
      if (h >= 10 && R > 18) { const z = Math.min(1.2, h * 0.1); t = k(t.subtract(k(M.cylinder(z + 1, R * 0.62, R * 0.62, seg(R, q), false).translate([0, 0, h - z])))); }
      const zr = h >= 10 && R > 18 ? Math.min(1.2, h * 0.1) : 0;
      if (P.podlozka > 0) { const rb = P.osa / 2 + 4; t = k(t.add(k(M.cylinder(P.podlozka + zr + 0.01, rb, rb, seg(rb, q), false).translate([0, 0, h - zr - 0.01])))); }
      const ro = (P.otvor + (+nast.stlVule || 0)) / 2;
      t = k(t.subtract(k(M.cylinder(h + P.podlozka + 4, ro, ro, seg(ro, q), false).translate([0, 0, -2]))));
      return { t, popis: `kolo Ø ${cz(P.D)} × ${cz(h)}${P.podlozka > 0 ? ` s nábojem ${cz(P.podlozka)} mm (nahrazuje podložku)` : ''}, otvor Ø ${cz(2 * ro, 2)}`, ks: P.ks };
    },
    /** kolík s hlavou: hlava na podložce, dřík nahoru, středový otvor pro ocelový drát Ø 3 */
    kolik(w, k, P, nast) {
      const M = w.Manifold, rd = (P.osa - (+nast.stlVule || 0)) / 2, L = P.tk + P.podlozka + 16 + 0.5, rh = P.osa / 2 + 3, hh = 3;
      let t = valecSrazeny(M, k, rh, hh, 0, 0.6);
      t = k(t.add(valecSrazeny(M, k, rd, L, 0, 0.6).translate([0, 0, hh - 0.01])));
      if (P.osa >= 6) t = k(t.subtract(k(M.cylinder(L + hh + 2, 1.6, 1.6, 24, false).translate([0, 0, -1]))));
      return { t, popis: `kolík Ø ${cz(2 * rd, 2)} × ${cz(L)} s hlavou Ø ${cz(2 * rh)} × ${hh}${P.osa >= 6 ? ', otvor Ø 3,2 pro ocelový drát Ø 3 (vlepit – tištěný dřík by se ve smyku zlomil)' : ''}`, ks: P.ks };
    },
    podlozka(w, k, P, nast) {
      const M = w.Manifold, ri = (P.osa + 0.6) / 2, ro = P.osa / 2 + 4, h = Math.max(0.8, P.podlozka);
      const t = k(k(M.cylinder(h, ro, ro, seg(ro), false)).subtract(k(M.cylinder(h + 2, ri, ri, seg(ri), false).translate([0, 0, -1]))));
      return { t, popis: `podložka ${cz(2 * ro)} / ${cz(2 * ri, 1)} × ${cz(h)}`, ks: P.ks };
    },
    /** spojovací kolík stavebnice */
    cep(w, k, P, nast) {
      const M = w.Manifold, r = (P.d - (+nast.stlVule || 0)) / 2, h = P.h;
      const t = valecSrazeny(M, k, r, h, 0.8, 0.8);
      return { t, popis: `spojovací kolík Ø ${cz(2 * r, 2)} × ${cz(h)} (sražení 0,8 mm na koncích)`, ks: P.ks || 24 };
    },
    /** úchyt vkládačky: hlava dolů (sražená plocha leží na podložce), dřík nahoru */
    uchyt(w, k, P, nast) {
      const M = w.Manifold, rh = Math.max(P.d * 0.9, 7), hh = Math.max(6, P.d * 0.7), rd = (P.d - (+nast.stlVule || 0)) / 2, L = P.h - hh + P.zasun;
      let t = valecSrazeny(M, k, rh, hh, Math.min(3, rh / 3), 0);
      t = k(t.add(valecSrazeny(M, k, rd, L, 0, 0.6).translate([0, 0, hh - 0.01])));
      return { t, popis: `úchyt: hlava Ø ${cz(2 * rh)} × ${cz(hh)}, dřík Ø ${cz(2 * rd, 2)} × ${cz(L)} (${cz(P.zasun)} mm do dílku)`, ks: P.ks };
    },
    /** modul kuličkové dráhy: krychle − drážka (obálka koulí podél osy) − propadový otvor */
    modul(w, k, P, nast) {
      const M = w.Manifold, c = P.bunka, m = P.M, rw = P.w / 2, n = 12;
      let t = k(M.cube([m, m, m], false));
      const zDna = (s) => m - (c.eIn + (c.eOut - c.eIn) * s / (c.delka || 1));
      const kul = (x, y, z) => k(M.sphere(rw, 24).translate([x, y, z]));
      const pts = c.pts;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const za = zDna(a[2]) + rw, zb = zDna(b[2]) + rw;
        // na vstupu a výstupu prodloužit drážku za stěnu modulu
        const ext = (p, q) => { const dx = p[0] - q[0], dy = p[1] - q[1], l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * 2, p[1] + dy / l * 2]; };
        let A = [a[0], a[1]], B = [b[0], b[1]];
        if (i === 1 && !(c.vstup === 'shora' || c.vstup === 'start')) A = ext(A, B);
        if (i === pts.length - 1 && c.vystup !== 'dolu') B = ext(B, A);
        const h = k(M.hull([kul(A[0], A[1], za), kul(B[0], B[1], zb), kul(A[0], A[1], m + rw + 1), kul(B[0], B[1], m + rw + 1)]));
        t = k(t.subtract(h));
      }
      void n;
      if (c.vystup === 'dolu') { const r = P.otvor / 2; t = k(t.subtract(k(M.cylinder(m + 2, r, r, seg(r), false).translate([m / 2, m / 2, -1])))); }
      if (c.vstup === 'shora' || c.vstup === 'start') {
        const r = (c.start ? Math.max(P.otvor, P.w * 1.6) : P.otvor) / 2, h = c.eIn + 0.01;
        t = k(t.subtract(k(M.cylinder(h + 1, r, r, seg(r), false).translate([m / 2, m / 2, m - h]))));
        if (c.start) t = k(t.subtract(k(M.cylinder(Math.min(8, m * 0.2) + 0.01, r, r + Math.min(8, m * 0.2), seg(r + 8), false).translate([m / 2, m / 2, m - Math.min(8, m * 0.2)]))));
      }
      return { t, popis: `modul ${P.id}: ${cz(m)} mm, drážka ${cz(P.w)} hl. ${cz(c.eIn)} → ${cz(c.eOut)}`, ks: P.ks };
    },
  };

  /** parametry STL dílu z návrhu */
  function parametry(id, N) {
    const S = N.parametryStl || {}, q = (N.stl || []).find((x) => x.id === id) || {};
    if (id.startsWith('modul:')) {
      const d = N.dily.find((x) => x.id === id.slice(6));
      return { typ: 'modul', bunka: d.modul, M: N.draha.M, w: N.draha.sirka, otvor: N.telesa.find((t) => t.typ === 'modul').otvor, id: d.id, ks: d.ks };
    }
    if (id === 'kolo' || id === 'kolik' || id === 'podlozka') return Object.assign({ typ: id, ks: q.ks || 4 }, S);
    if (id === 'cep') return { typ: 'cep', d: q.d, h: q.h, ks: 24 };
    if (id === 'uchyt') return { typ: 'uchyt', d: q.d, h: q.h, zasun: q.zasun, ks: N.dily.filter((d) => /^V\d/.test(d.id)).length || 1 };
    throw new Error('neznámý díl ' + id);
  }

  /**
   * STL dílu; kopie = počet kusů rozmístěných na tiskové ploše (nast.stlStul), co se nevejde → varování
   */
  function dil(w, id, N, nast, kopie) {
    const smaz = [], k = (x) => { smaz.push(x); return x; };
    try {
      nast = Object.assign({}, DH.NASTAVENI, nast || {});
      const P = parametry(id, N), f = TVORBA[P.typ], j = f(w, k, P, nast);
      const bb = j.t.boundingBox(), sx = bb.max[0] - bb.min[0], sy = bb.max[1] - bb.min[1];
      let t = k(j.t.translate([-bb.min[0], -bb.min[1], -bb.min[2]]));
      const n = Math.max(1, Math.round(kopie == null ? 1 : kopie)), stul = +nast.stlStul || 220, mez = 5;
      const nx = Math.max(1, Math.floor((stul + mez) / (sx + mez))), ny = Math.max(1, Math.floor((stul + mez) / (sy + mez)));
      const naStul = Math.min(n, nx * ny), varovani = [];
      if (sx > stul || sy > stul) varovani.push(`Díl ${cz(sx)} × ${cz(sy)} mm je větší než tisková plocha ${stul} mm.`);
      if (n > naStul) varovani.push(`Na plochu ${stul} × ${stul} mm se vejde ${naStul} z ${n} kusů – vytiskněte víckrát.`);
      if (naStul > 1) {
        const kus = t; let vse = kus;
        for (let i = 1; i < naStul; i++) vse = k(vse.add(k(kus.translate([(i % nx) * (sx + mez), Math.floor(i / nx) * (sy + mez), 0]))));
        t = vse;
      }
      return sit(t, { kusu: naStul, popis: j.popis, varovani, ksPotreba: P.ks });
    } finally { for (const x of smaz) { try { x.delete(); } catch (e) { /* uvolněno */ } } }
  }

  function stlBinarni(poz, idx, nazev) {
    const nt = idx.length / 3, buf = new ArrayBuffer(84 + nt * 50), dv = new DataView(buf);
    const hl = String(nazev || 'drevene hracky').normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 79);
    for (let i = 0; i < hl.length; i++) dv.setUint8(i, hl.charCodeAt(i) & 0x7f);
    dv.setUint32(80, nt, true);
    let o = 84;
    for (let t = 0; t < nt; t++) {
      const A = idx[t * 3] * 3, B = idx[t * 3 + 1] * 3, C = idx[t * 3 + 2] * 3;
      const ux = poz[B] - poz[A], uy = poz[B + 1] - poz[A + 1], uz = poz[B + 2] - poz[A + 2];
      const vx = poz[C] - poz[A], vy = poz[C + 1] - poz[A + 1], vz = poz[C + 2] - poz[A + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
      for (const v of [nx / l, ny / l, nz / l]) { dv.setFloat32(o, v, true); o += 4; }
      for (const q of [A, B, C]) for (let s = 0; s < 3; s++) { dv.setFloat32(o, poz[q + s], true); o += 4; }
      dv.setUint16(o, 0, true); o += 2;
    }
    return buf;
  }

  const API = { dil, stlBinarni, parametry, TVORBA };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.DHSTL = API;
})(typeof window !== 'undefined' ? window : globalThis);

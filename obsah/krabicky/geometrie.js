/* Krabičky – stavba těles přes manifold-3d (booleovské operace s ověřenou těsností).
   postav(w, p) → {dily: [{jmeno, nazev, poz, idx, objem, rod, stav}], cas}
   w = inicializovaný modul manifold (po setup()), p = normalizovaný projekt (KRAB.normalizuj).
   Všechny objekty WASM se po výpočtu uvolní, ven jdou jen obyčejná pole. */
(function () {
  'use strict';
  const KRAB = typeof module !== 'undefined' ? require('./jadro.js') : window.KRAB;

  /** Zaoblený obdélník se středem v počátku jako pole bodů proti směru hodinových ručiček. */
  function zaoblenyObdelnik(L, W, r, seg) {
    r = Math.max(0, Math.min(r, L / 2, W / 2));
    if (r < 1e-3) return [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]];
    const n = Math.max(2, Math.ceil(seg / 4)), pts = [];
    const rohy = [[L / 2 - r, -W / 2 + r, -90], [L / 2 - r, W / 2 - r, 0], [-L / 2 + r, W / 2 - r, 90], [-L / 2 + r, -W / 2 + r, 180]];
    for (const [cx, cy, a0] of rohy) {
      for (let i = 0; i <= n; i++) {
        const a = (a0 + 90 * i / n) * Math.PI / 180;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
    }
    // spojit body, které splynou (r = polovina rozměru)
    return pts.filter((q, i) => { const p = pts[(i + pts.length - 1) % pts.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-6; });
  }

  function postav(w, vstup) {
    const t0 = Date.now();
    const p = vstup;
    const o = KRAB.odvozene(p);
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const seg = p.segmenty, tol = p.tolerance;
    const segKruh = r => Math.max(12, Math.min(seg, Math.ceil(2 * Math.PI * r / 0.3)));
    const rr = (L, W, r) => k(new CS([zaoblenyObdelnik(L, W, r, seg)], 'Positive'));
    const valec = (r, h, x, y, z, r2) => k(k(M.cylinder(h, r, r2 === undefined ? r : r2, segKruh(Math.max(r, r2 || 0)), false)).translate([x, y, z]));
    const vysunout = (cs, h, z) => k(k(cs.extrude(h)).translate([0, 0, z]));

    try {
      const { Li, Wi, Hi, Lo, Wo, Hb, R, Ri, t } = o;
      const vnejsi2 = rr(Lo, Wo, R), vnitrni2 = rr(Li, Wi, Ri);

      // šroubové sloupky v rozích: obálka kružnice a čtverce v rohu, oříznutá vnějším obrysem
      let sloupky2 = null;
      if (o.sroub) {
        const D = p.viko.sroub.sloupek, casti = [];
        for (const [cx, cy] of o.sroubyXY) {
          const sx = Math.sign(cx), sy = Math.sign(cy);
          const kruh = k(k(CS.circle(D / 2, segKruh(D / 2))).translate([cx, cy]));
          const x0 = Math.min(cx, sx * (Li / 2 + t / 2)), y0 = Math.min(cy, sy * (Wi / 2 + t / 2));
          const ctv = k(k(CS.square([Math.abs(sx * (Li / 2 + t / 2) - cx), Math.abs(sy * (Wi / 2 + t / 2) - cy)])).translate([x0, y0]));
          casti.push(k(CS.hull([kruh, ctv])));
        }
        sloupky2 = k(k(CS.union(casti)).intersect(vnejsi2));
      }
      const dutina2 = sloupky2 ? k(vnitrni2.subtract(sloupky2)) : vnitrni2;

      /* ---- krabička ---- */
      const plne = [vysunout(vnejsi2, Hb, 0)];
      // sloupky desky
      if (p.deska.pouzit) {
        const sl = p.deska.sloupky;
        for (const [hx, hy] of p.deska.otvory) {
          plne.push(valec(sl.prumer / 2, sl.vyska + 0.5, o.pcb0[0] + hx, o.pcb0[1] + hy, p.dno - 0.5));
        }
      }
      // montážní uši na koncích v ose X
      if (p.montaz.typ === 'usi') {
        const m = p.montaz, e = m.delkaUcha, b = m.sirkaUcha;
        // pás u čela krabičky mimo vnější obrys (zaoblené rohy) – tam ucho nesmí vyčnívat
        for (const s of [-1, 1]) {
          const x0 = s * (Lo / 2 - t / 2), x1 = s * (Lo / 2 + e);
          let ucho;
          if (e >= b / 2) {
            const xk = s * (Lo / 2 + e - b / 2);
            const kon = k(k(CS.circle(b / 2, segKruh(b / 2))).translate([xk, 0]));
            const zak = k(k(CS.square([Math.abs(xk - x0), b], true)).translate([(xk + x0) / 2, 0]));
            ucho = k(CS.hull([kon, zak]));
          } else ucho = k(k(CS.square([Math.abs(x1 - x0), b], true)).translate([(x1 + x0) / 2, 0]));
          // ucho jen v obrysu krabičky nebo za jejím čelem (u zaoblených rohů nesmí vyčnívat)
          const za = k(k(CS.square([e + 2, b + 2], true)).translate([s * (Lo / 2 + e / 2 + 1), 0]));
          ucho = k(ucho.intersect(k(vnejsi2.add(za))));
          plne.push(vysunout(ucho, m.tloustkaUcha, 0));
        }
      }
      let krab = k(M.union(plne));
      const odebrat = [vysunout(dutina2, Hi + 1, p.dno)];
      // otvory ve sloupcích desky
      if (p.deska.pouzit && p.deska.sloupky.dira > 0) {
        const sl = p.deska.sloupky, r = (sl.dira + tol) / 2;
        for (const [hx, hy] of p.deska.otvory) {
          if (sl.pruchozi) odebrat.push(valec(r, p.dno + sl.vyska + 2, o.pcb0[0] + hx, o.pcb0[1] + hy, -1));
          else odebrat.push(valec(r, sl.vyska + 1, o.pcb0[0] + hx, o.pcb0[1] + hy, p.dno));
        }
      }
      // otvory pro šrouby víka
      if (o.sroub) {
        const s = p.viko.sroub, h = Math.min(s.hloubka, Hb - 0.6);
        for (const [cx, cy] of o.sroubyXY) odebrat.push(valec((s.pilot + tol) / 2, h + 1, cx, cy, Hb - h));
      }
      // montážní otvory
      if (p.montaz.typ === 'usi') {
        const m = p.montaz;
        for (const s of [-1, 1]) odebrat.push(valec((m.prumer + tol) / 2, m.tloustkaUcha + 2, s * (Lo / 2 + m.delkaUcha / 2), 0, -1));
      }
      if (p.montaz.typ === 'dno') {
        for (const [x, y] of p.montaz.otvory) odebrat.push(valec((p.montaz.prumer + tol) / 2, p.dno + 2, x, y, -1));
      }
      // drážky pro západky víka
      const zapadky = o.maViko && p.viko.typ === 'nasazovaci' && p.viko.zapadky && o.osazeni;
      const zz = Hb - p.viko.vyskaOsazeni / 2, rz = p.viko.presahZapadky;
      const delkaZap = (L) => Math.max(4, Math.min(20, L / 3));
      if (zapadky) {
        // osa drážky 0,05 mm za vnitřní plochou stěny – vrcholy válce tak neleží přesně v rovině stěny
        const rd = rz + tol / 2 + 0.05;
        for (const s of [-1, 1]) {
          const dl = delkaZap(Li) + 1;
          odebrat.push(k(k(k(M.cylinder(dl, rd, rd, segKruh(rd), true)).rotate([0, 90, 0])).translate([0, s * (Wi / 2 + 0.05), zz])));
          const dw = delkaZap(Wi) + 1;
          odebrat.push(k(k(k(M.cylinder(dw, rd, rd, segKruh(rd), true)).rotate([90, 0, 0])).translate([s * (Li / 2 + 0.05), 0, zz])));
        }
      }
      // výřezy stěn a dna
      const vyrezy = KRAB.vyrezy(p);
      const profil = z => z.tvar === 'kruh'
        ? k(k(CS.circle(z.w / 2, segKruh(z.w / 2))).translate([z.u, z.v]))
        : k(k(new CS([zaoblenyObdelnik(z.w, z.h, z.r, seg)], 'Positive')).translate([z.u, z.v]));
      /* Hranol výřezu přes stěnu; hloubka = jak daleko dovnitř od vnitřní plochy stěny řeže. */
      const rezStenou = (z, hloubka) => {
        // profil v rovině (a, b) = (podél stěny, výška nad spodkem krabičky), vysunutí přes stěnu
        const a = (z.plocha === 'x-' || z.plocha === 'y+') ? -z.u : z.u;
        const zz2 = Object.assign({}, z, { u: a, v: z.v + p.dno });
        const pol = (z.plocha[0] === 'x' ? Li : Wi) / 2;
        const n0 = pol - hloubka, n1 = (z.plocha[0] === 'x' ? Lo : Wo) / 2 + 1;
        const vys = k(k(profil(zz2).extrude(n1 - n0)).translate([0, 0, n0]));
        // lokální (a, b, n) → svět; matice 4×4 po sloupcích, determinant +1
        const mat = {
          'x+': [0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1],
          'x-': [0, -1, 0, 0, 0, 0, 1, 0, -1, 0, 0, 0, 0, 0, 0, 1],
          'y+': [-1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1],
          'y-': [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1],
        }[z.plocha];
        return k(vys.transform(mat));
      };
      for (const z of vyrezy) {
        if (z.plocha === 'viko') continue;
        if (z.plocha === 'dno') { odebrat.push(vysunout(profil(z), p.dno + 0.6, -0.3)); continue; }
        odebrat.push(rezStenou(z, 0.5));
      }
      krab = k(M.difference([krab, ...odebrat]));

      /* ---- víko ---- */
      let viko = null;
      if (o.maViko) {
        const v = p.viko;
        const casti = [vysunout(vnejsi2, v.tloustka, Hb)];
        if (o.osazeni) {
          const vn = rr(Li - 2 * v.vule, Wi - 2 * v.vule, Math.max(0, Ri - v.vule));
          const vi = rr(Li - 2 * v.vule - 2 * v.stenaOsazeni, Wi - 2 * v.vule - 2 * v.stenaOsazeni, Math.max(0, Ri - v.vule - v.stenaOsazeni));
          let prstenec = k(vn.subtract(vi));
          if (sloupky2) prstenec = k(prstenec.subtract(k(sloupky2.offset(v.vule + 0.1, 'Round', 2, segKruh(1)))));
          casti.push(vysunout(prstenec, v.vyskaOsazeni + v.tloustka / 2, Hb - v.vyskaOsazeni));
          if (zapadky) {
            for (const s of [-1, 1]) {
              const rb = rz + 0.05;   // osa výstupku 0,05 mm uvnitř osazení
              casti.push(k(k(k(M.cylinder(delkaZap(Li), rb, rb, segKruh(rb), true)).rotate([0, 90, 0])).translate([0, s * (Wi / 2 - v.vule - 0.05), zz])));
              casti.push(k(k(k(M.cylinder(delkaZap(Wi), rb, rb, segKruh(rb), true)).rotate([90, 0, 0])).translate([s * (Li / 2 - v.vule - 0.05), 0, zz])));
            }
          }
        }
        viko = k(M.union(casti));
        const odeb = [];
        if (o.sroub) {
          const s = v.sroub, ztop = Hb + v.tloustka;
          for (const [cx, cy] of o.sroubyXY) {
            odeb.push(valec((s.prumer + tol) / 2, v.tloustka + 2, cx, cy, Hb - 1));
            if (s.zahloubeni === 'kuzelove') {
              const hl = (s.hlava - s.prumer) / 2;   // kužel 90°
              odeb.push(valec((s.prumer + tol) / 2, hl + 0.5, cx, cy, ztop - hl, (s.hlava + tol) / 2 + 0.5));
            } else if (s.zahloubeni === 'valcove') {
              odeb.push(valec((s.hlava + tol) / 2, s.hloubkaHlavy + 1, cx, cy, ztop - s.hloubkaHlavy));
            }
          }
        }
        for (const z of vyrezy) if (z.plocha === 'viko') odeb.push(vysunout(profil(z), v.tloustka + 0.6, Hb - 0.3));
        // osazení víka se v místě výřezů ve stěnách vybere (jinak by výřez zevnitř zakrylo)
        if (o.osazeni) {
          const pod = k(k(M.cube([Lo + 50, Wo + 50, Hb + 1], false)).translate([-(Lo + 50) / 2, -(Wo + 50) / 2, -1]));
          for (const z of vyrezy) {
            if (z.plocha === 'viko' || z.plocha === 'dno') continue;
            if (z.v + z.h / 2 <= Hi - v.vyskaOsazeni) continue;
            odeb.push(k(rezStenou(z, v.vule + v.stenaOsazeni + 0.5).intersect(pod)));
          }
        }
        if (odeb.length) viko = k(M.difference([viko, ...odeb]));
      }

      const sit = (m, jmeno, nazev) => {
        const st = m.status();
        if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
        if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
        const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
        const poz = new Float32Array(vp.length / np * 3);
        for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
        return { jmeno, nazev, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), rod: m.genus(), stav: st };
      };
      const dily = [sit(krab, 'krabicka', 'Krabička')];
      if (viko) dily.push(sit(viko, 'viko', 'Víko'));
      return { dily, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  const API = { postav, zaoblenyObdelnik };
  if (typeof module !== 'undefined') module.exports = API; else window.KRAB_GEO = API;
})();

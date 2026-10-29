/* Bludiště – stavba dílů přes manifold-3d (booleovské operace se zaručeně uzavřenou sítí).
   postav(w, m) → {dily: [{jmeno, nazev, poz, idx, objem, plocha, barva, sestava: {rotZ, dz}, prevratit, tisk}], cas}
   w = inicializovaný manifold (po setup()), m = BLUD.model(p) bez chyby.
   Díly jsou v místních souřadnicích; `sestava` je posun/otočení do složené polohy, `prevratit` = tisknout vzhůru nohama.
   Všechny objekty WASM se po výpočtu uvolní, ven jdou jen obyčejná pole. */
(function () {
  'use strict';

  function postav(w, m) {
    const t0 = Date.now(), smaz = [], pomocne = {};
    const k = x => { smaz.push(x); return x; };
    const { Manifold: M, CrossSection: CS } = w;
    const obdelnik = (x, y, a, b) => [[x, y], [x + a, y], [x + a, y + b], [x, y + b]];
    const kruh = (cx, cy, r, n = 32) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(2 * Math.PI * i / n), cy + r * Math.sin(2 * Math.PI * i / n)]);
    const plocha2 = polys => k(new CS(polys, 'Positive'));
    const vysun = (cs, h, z) => k(k(cs.extrude(h)).translate([0, 0, z]));
    const valec = (cx, cy, r, z, h) => vysun(plocha2([kruh(cx, cy, r, 28)]), h, z);
    const sit = (mf, jmeno, nazev, barva, dalsi) => {
      const st = mf.status();
      if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
      if (mf.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
      const mesh = mf.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
      const poz = new Float32Array(vp.length / np * 3);
      for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
      return Object.assign({ jmeno, nazev, barva, poz, idx: new Uint32Array(mesh.triVerts), objem: mf.volume(), plocha: mf.surfaceArea(), rod: mf.genus(),
        sestava: { rotZ: 0, dz: 0 }, prevratit: false, tisk: true }, dalsi || {});
    };
    try {
      const dily = m.p.rezim === 'valec' ? valcove(m) : m.p.rezim === 'kostka' ? kostka(m) : deska(m);
      return { dily, pomocne, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }

    /* ---------- válcová krabička ---------- */
    function valcove(m) {
      const p = m.p, q = p.valec, K = m.K, D = 2 * Math.PI / K, zb = m.patka, top = zb + m.H;
      const kgon = r => Array.from({ length: K }, (_, i) => [r * Math.cos(i * D), r * Math.sin(i * D)]);
      // bod obvodového K-úhelníku poloměru r ve směru phi (na tětivě) – díly sdílejí stejné rovinné stěny
      const naKgonu = (r, phi) => { const i = Math.floor(phi / D), l = phi - (i + 0.5) * D, rr = r * Math.cos(D / 2) / Math.cos(l); return [rr * Math.cos(phi), rr * Math.sin(phi)]; };
      const oblouk = (r, a, b) => {
        const out = [naKgonu(r, a)];
        for (let i = Math.floor(a / D) + 1; i * D < b - 1e-9; i++) if (i * D > a + 1e-9) out.push([r * Math.cos(i * D), r * Math.sin(i * D)]);
        out.push(naKgonu(r, b));
        return out;
      };
      const sektor = (a, b, r0, r1, z0, z1) => vysun(plocha2([oblouk(r1, a, b).concat(oblouk(r0, a, b).reverse())]), z1 - z0, z0);
      const aw = (m.w / 2) / m.Rv, e = 0.02, ea = e / m.Rv, r0 = m.r0, r1 = m.Rv + 1, nC = m.nC, nR = m.nR;
      const zc = r => zb + (r + 0.5) * m.pz;
      const ma = new Set(m.b.hrany.map(([a, b]) => Math.min(a, b) + ',' + Math.max(a, b)));
      const spoj = (a, b) => ma.has(Math.min(a, b) + ',' + Math.max(a, b));
      const drazky = [];
      // vodorovné úseky = nepřerušené běhy hran v řadě (bez společných rovin překrývajících se kusů)
      for (let r = 0; r < nR; r++) {
        const vpravo = c => spoj(r * nC + c, r * nC + (c + 1) % nC);
        for (let c = 0; c < nC; c++) {
          if (!vpravo(c) || vpravo((c + nC - 1) % nC)) continue;
          let n = 0; while (vpravo((c + n) % nC)) n++;
          drazky.push(sektor(c * m.alfa - aw - ea, (c + n) * m.alfa + aw + ea, r0, r1, zc(r) - m.w / 2, zc(r) + m.w / 2));
        }
      }
      // svislé úseky; nad horní řadou ve sloupci startu vede vstup až nad okraj
      for (let c = 0; c < nC; c++) {
        const nahoru = r => r === nR - 1 ? c === m.b.start % nC : spoj(r * nC + c, (r + 1) * nC + c);
        for (let r = 0; r < nR; r++) {
          if (!nahoru(r) || (r > 0 && nahoru(r - 1))) continue;
          let n = 0; while (r + n < nR && nahoru(r + n)) n++;
          const z1 = r + n >= nR ? top + 1 : zc(r + n) + m.w / 2 + e;
          drazky.push(sektor(c * m.alfa - aw, c * m.alfa + aw, r0, r1, zc(r) - m.w / 2 - e, z1));
        }
      }
      const telo = k(M.union([vysun(plocha2([kgon(m.Ro)]), zb, 0), vysun(plocha2([kgon(m.Rv)]), top - zb / 2, zb / 2)]));
      const dutina = vysun(plocha2([kgon(m.Ri)]), top - q.dno + 1, q.dno);
      const nadoba = k(M.difference([telo, dutina, ...drazky]));

      // pouzdro: trubka s víkem, čep u okraje (místně ve směru 0°, střed pz/2 nad okrajem)
      const vyskaP = m.H + p.vule + q.strop;
      let pouzdro = k(vysun(plocha2([kgon(m.Ro)]), vyskaP, 0).subtract(vysun(plocha2([kgon(m.Rs)]), m.H + p.vule + 1, -1)));
      const d = p.kulicka, rSp = r0 + p.vule, delka = m.Rs + Math.min(0.6, q.stenaPouzdra / 2) - rSp;
      const prurez = q.cep === 'valec' ? kruh(0, 0, d / 2, 24) : [[d / 2, 0], [0, d / 2], [-d / 2, 0], [0, -d / 2]];
      // čep v rovině (obvod u, výška v) vysunutý radiálně a ohnutý na válec – zužuje se k ose stejně jako drážka
      const cep = k(k(plocha2([prurez]).extrude(delka)).warp(v => {
        const r = rSp + v[2], f = v[0] / m.Rv, z = m.pz / 2 + v[1];
        v[0] = r * Math.cos(f); v[1] = r * Math.sin(f); v[2] = z;
      }));
      pouzdro = k(pouzdro.add(cep));
      const cilC = m.b.cil % nC;
      pomocne.cep = sit(cep, 'cep', 'Čep');
      return [
        sit(nadoba, 'nadoba', 'Nádoba s bludištěm', '#4F86D9'),
        sit(pouzdro, 'pouzdro', 'Pouzdro s víkem a čepem', '#B4BCC8', { sestava: { rotZ: cilC * m.alfa, dz: zb }, prevratit: true }),
      ];
    }

    /* ---------- společné pro kuličková bludiště: chodby v rovině ---------- */
    function chodby2D(o, filtr) {
      // buňky a spojky mezi sousedy v jedné rovině (vrstvě), každá spojka jako obdélník přes obě buňky
      const P = [], wv = m.w, pz = m.pz;
      const bunka = (x, y) => [o + x * pz, o + y * pz];
      for (const i of filtr.bunky) { const [x, y] = bunka(...filtr.xy(i)); P.push(obdelnik(x, y, wv, wv)); }
      for (const [a, b] of filtr.hrany) {
        const [xa, ya] = filtr.xy(a), [xb, yb] = filtr.xy(b);
        const [x0, y0] = bunka(Math.min(xa, xb), Math.min(ya, yb));
        P.push(obdelnik(x0, y0, wv + Math.abs(xa - xb) * pz, wv + Math.abs(ya - yb) * pz));
      }
      return k(CS.union(P.map(x => plocha2([x]))));
    }

    /* ---------- kostka po vrstvách ---------- */
    function kostka(m) {
      const p = m.p, q = p.kostka, n = m.n, n2 = n * n, L = m.L, tf = q.podlaha, o = q.okraj, hk = m.hk;
      const xy = i => [i % n, Math.floor(i / n) % n], vr = i => Math.floor(i / n2);
      const rk = q.kolik / 2, rd = rk + p.vule;
      const rohy = [[o / 2, o / 2], [L - o / 2, o / 2], [L - o / 2, L - o / 2]];   // tři rohy = vrstvu nejde vložit pootočenou
      const ctverec = plocha2([obdelnik(0, 0, L, L)]);
      const okenko = (i, r) => { const c = BLUD_stred(i); return plocha2([kruh(c[0], c[1], r, 32)]); };
      const dily = [];
      for (let z = 0; z < n; z++) {
        const bunky = [], hrany = [], diry = [];
        for (let i = z * n2; i < (z + 1) * n2; i++) bunky.push(i);
        for (const [a, b] of m.b.hrany) {
          if (vr(a) === z && vr(b) === z) hrany.push([a, b]);
          else if (Math.min(vr(a), vr(b)) === z - 1 && Math.max(vr(a), vr(b)) === z) diry.push(vr(a) === z ? a : b);
        }
        const steny = k(ctverec.subtract(chodby2D(o, { bunky, hrany, xy })));
        let podlaha = ctverec;
        const odeber = diry.map(i => { const [x, y] = xy(i); return plocha2([obdelnik(o + x * m.pz, o + y * m.pz, m.w, m.w)]); });
        if (z === 0) odeber.push(okenko(m.b.cil, 0.3 * p.kulicka));
        if (odeber.length) podlaha = k(podlaha.subtract(k(CS.union(odeber))));
        let vrstva = k(M.union([vysun(podlaha, tf, 0), vysun(steny, m.w, tf), ...rohy.map(([x, y]) => valec(x, y, rk, tf + m.w - 0.5, hk + 0.5))]));
        if (z > 0) vrstva = k(M.difference([vrstva, ...rohy.map(([x, y]) => valec(x, y, rd, -1, hk + p.vule + 1))]));
        dily.push(sit(vrstva, 'vrstva' + (z + 1), `Vrstva ${z + 1}${z === 0 ? ' (dno)' : ''}`, z % 2 ? '#4FB07A' : '#4F86D9', { sestava: { rotZ: 0, dz: z * m.krok } }));
      }
      let viko = k(vysun(k(ctverec.subtract(okenko(m.b.start, 0.3 * p.kulicka))), m.tv, 0));
      viko = k(M.difference([viko, ...rohy.map(([x, y]) => valec(x, y, rd, -1, hk + p.vule + 1))]));
      dily.push(sit(viko, 'viko', 'Víko (průhledné)', '#9FC7E8', { sestava: { rotZ: 0, dz: n * m.krok } }));
      return dily;
    }

    /* ---------- deska s víkem ---------- */
    function deska(m) {
      const p = m.p, q = p.deska, Lx = m.Lx, Ly = m.Ly, o = q.okraj, nx = q.x, hk = m.hk;
      const xy = i => [i % nx, Math.floor(i / nx)];
      const plexi = q.viko === 'plexi';
      const pas = plexi ? o - m.prekryv - p.vule : o, c = pas / 2;
      const rohy = [[c, c], [Lx - c, c], [Lx - c, Ly - c]];
      const rk = q.kolik / 2, rd = rk + p.vule;
      const obd = plocha2([obdelnik(0, 0, Lx, Ly)]);
      const bunky = Array.from({ length: m.g.N }, (_, i) => i);
      const steny = k(obd.subtract(chodby2D(o, { bunky, hrany: m.b.hrany, xy })));
      const cc = BLUD_stred(m.b.cil);
      const dno = k(obd.subtract(plocha2([kruh(cc[0], cc[1], 0.3 * p.kulicka, 32)])));
      const casti = [vysun(dno, q.dno, 0), vysun(steny, m.hs, q.dno)];
      const rp = m.prekryv + p.vule;   // polodrážka pro plexi
      if (plexi) casti.push(vysun(k(obd.subtract(plocha2([obdelnik(o - rp, o - rp, Lx - 2 * o + 2 * rp, Ly - 2 * o + 2 * rp)]))), q.plexi, q.dno + m.hs));
      let zaklad = k(M.union(casti));
      zaklad = k(M.difference([zaklad, ...rohy.map(([x, y]) => valec(x, y, rd, m.Hz - hk - p.vule, hk + p.vule + 1))]));
      const vnitrek = plocha2([obdelnik(o, o, Lx - 2 * o, Ly - 2 * o)]);
      let viko = vysun(plexi ? k(obd.subtract(vnitrek)) : obd, q.ramecek, 0);
      viko = k(M.union([viko, ...rohy.map(([x, y]) => valec(x, y, rk, -hk, hk + 0.5))]));
      const dily = [
        sit(zaklad, 'zaklad', 'Deska s bludištěm', '#4F86D9'),
        sit(viko, 'viko', plexi ? 'Rámeček na plexi' : 'Víko (průhledné)', plexi ? '#D98A4F' : '#9FC7E8', { sestava: { rotZ: 0, dz: m.Hz }, prevratit: true }),
      ];
      if (plexi) {
        const a = m.prekryv;
        const deska = vysun(plocha2([obdelnik(o - a, o - a, Lx - 2 * o + 2 * a, Ly - 2 * o + 2 * a)]), q.plexi - 0.05, q.dno + m.hs);
        dily.push(sit(deska, 'plexi', 'Plexi (netiskne se)', '#BFE3F5', { tisk: false }));
      }
      return dily;
    }
    function BLUD_stred(i) { return (typeof module !== 'undefined' ? require('./jadro.js') : window.BLUD).stredBunky(m, i); }
  }

  const API = { postav };
  if (typeof module !== 'undefined') module.exports = API; else window.BLUD_GEO = API;
})();

/* Kliky a knoby – stavba těles přes manifold-3d.
   postav(w, p, o) → {dily: [{dil, nazev, poz, idx, objem, plocha, rod}], duchove: [{min, max, druh}]}
   Vše v dveřních souřadnicích (viz kliky/jadro.js). Rameno kliky = vlastní síť tažená po páteři,
   knob = vlastní rotační síť s půdorysem (fasety, rýhy); obojí se převede do manifoldu a dál jen booleany. */
(function () {
  'use strict';
  const K = typeof module !== 'undefined' ? require('./jadro.js') : window.KLIKY;
  const V = K.V;

  /** Uzavřená síť taženého průřezu po páteři: plochý začátek, kopule na konci. */
  function tazenaSit(vz, h2, t2, n, M, e) {
    const poz = [], idx = [];
    const kruh = (v, f = 1) => {
      const i0 = poz.length / 3;
      for (const P of K.kruhPateru(v, h2, t2, n, M, f)) poz.push(P[0], P[1], P[2]);
      return i0;
    };
    const kruhy = vz.map(x => kruh(x));
    const posl = vz[vz.length - 1], Kp = 8;
    for (let j = 1; j < Kp; j++) {
      const f = Math.PI / 2 * j / Kp;
      kruhy.push(kruh(Object.assign({}, posl, { c: V.add(posl.c, V.mul(posl.t, e * Math.sin(f))) }), Math.cos(f)));
    }
    const pol = poz.length / 3, P = V.add(posl.c, V.mul(posl.t, e)); poz.push(P[0], P[1], P[2]);
    const stred = poz.length / 3; poz.push(vz[0].c[0], vz[0].c[1], vz[0].c[2]);
    for (let r = 0; r + 1 < kruhy.length; r++) for (let k = 0; k < M; k++) {
      const a = kruhy[r] + k, b = kruhy[r] + (k + 1) % M, c = kruhy[r + 1] + k, d = kruhy[r + 1] + (k + 1) % M;
      idx.push(a, b, d, a, d, c);
    }
    const kp = kruhy[kruhy.length - 1];
    for (let k = 0; k < M; k++) { idx.push(kp + k, kp + (k + 1) % M, pol); idx.push(stred, kruhy[0] + (k + 1) % M, kruhy[0] + k); }
    return orientuj({ poz: new Float32Array(poz), idx: new Uint32Array(idx) });
  }
  /** Rotační síť kolem osy z z profilu [(r, z)] (první bod r > 0 = podstava, poslední r = 0 = vrchol); cinitel(úhel, r, z) mění poloměr. */
  function rotacniSit(profil, S, cinitel) {
    const poz = [], idx = [], kruhy = [];
    poz.push(0, 0, profil[0][1]);
    let vrchol = -1;
    for (const [r, z] of profil) {
      if (r < 1e-9) { vrchol = poz.length / 3; poz.push(0, 0, z); break; }
      kruhy.push(poz.length / 3);
      for (let k = 0; k < S; k++) { const f = 2 * Math.PI * k / S, rr = r * cinitel(f, r, z); poz.push(rr * Math.cos(f), rr * Math.sin(f), z); }
    }
    for (let r = 0; r + 1 < kruhy.length; r++) for (let k = 0; k < S; k++) {
      const a = kruhy[r] + k, b = kruhy[r] + (k + 1) % S, c = kruhy[r + 1] + k, d = kruhy[r + 1] + (k + 1) % S;
      idx.push(a, b, d, a, d, c);
    }
    const kp = kruhy[kruhy.length - 1];
    for (let k = 0; k < S; k++) { idx.push(0, kruhy[0] + (k + 1) % S, kruhy[0] + k); idx.push(kp + k, kp + (k + 1) % S, vrchol); }
    return orientuj({ poz: new Float32Array(poz), idx: new Uint32Array(idx) });
  }
  /** Normály ven: záporný objem → otočit pořadí vrcholů. */
  function orientuj(sit) {
    const P = sit.poz, I = sit.idx; let obj = 0;
    for (let t = 0; t < I.length; t += 3) {
      const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
      obj += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
    }
    if (obj < 0) for (let t = 0; t < I.length; t += 3) { const x = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = x; }
    return sit;
  }
  /** Zrcadlení sítě podle roviny x = 0 (klika pro druhou stranu dveří). */
  function zrcadli(sit) {
    const poz = Float32Array.from(sit.poz), idx = Uint32Array.from(sit.idx);
    for (let i = 0; i < poz.length; i += 3) poz[i] = -poz[i];
    for (let t = 0; t < idx.length; t += 3) { const x = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = x; }
    return Object.assign({}, sit, { poz, idx });
  }

  function postav(w, p, o) {
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [], k = x => { smaz.push(x); return x; };
    const segKruh = r => Math.max(24, Math.min(96, Math.ceil(2 * Math.PI * r / 0.7 / 4) * 4));
    const rDiry = r => r / Math.cos(Math.PI / segKruh(r));
    const box = (x0, x1, y0, y1, z0, z1) => k(k(M.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    const valecZ = (r, z0, z1, x = 0, y = 0) => k(k(M.cylinder(z1 - z0, r, r, segKruh(r))).translate([x, y, z0]));
    const kuzelZ = (r0, r1, z0, z1, x = 0, y = 0) => k(k(M.cylinder(z1 - z0, r0, r1, segKruh(Math.max(r0, r1)))).translate([x, y, z0]));
    // válec v ose −y: od y0 (blíž ose) k y1 (dál), y0 > y1
    const valecY = (r, y0, y1, x, z) => k(k(k(M.cylinder(y0 - y1, r, r, segKruh(r))).rotate([90, 0, 0])).translate([x, y0, z]));
    // kužel v ose −y: poloměr r0 v y0 (blíž ose), r1 v y1 (dál)
    const kuzelY = (r0, r1, y0, y1, x, z) => k(k(k(M.cylinder(y0 - y1, r0, r1, segKruh(Math.max(r0, r1)))).rotate([90, 0, 0])).translate([x, y0, z]));
    const zeSite = sit => {
      const m = new w.Mesh({ numProp: 3, vertProperties: sit.poz, triVerts: sit.idx });
      m.merge();
      return k(new M(m));
    };
    const naSit = m => {
      const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties, poz = new Float32Array(vp.length / np * 3);
      for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
      return { poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), plocha: m.surfaceArea(), rod: m.genus() };
    };
    const over = (m, co) => {
      const st = m.status();
      if (st !== 'NoError') throw new Error(`${co}: manifold hlásí ${st}`);
      if (m.isEmpty()) throw new Error(`${co}: výsledné těleso je prázdné`);
      // splývající plochy mohou nechat plátek s nulovým objemem
      const kusy = m.decompose(); kusy.forEach(x => k(x));
      if (kusy.length > 1) { const plne = kusy.filter(x => x.volume() > 1e-2); if (plne.length < kusy.length) return k(M.compose(plne)); }
      return m;
    };

    try {
      const dily = [], duchove = [];
      const hlavni = p.typ === 'klika' ? klika() : knob();
      const strana = p.dvere.strana === 'leva' ? k(hlavni.mirror([1, 0, 0])) : hlavni;
      if (p.typ === 'klika' && p.tisk.rozpulit) {
        const horni = over(k(strana.trimByPlane([0, 1, 0], 0)), 'horní polovina'), dolni = over(k(strana.trimByPlane([0, -1, 0], 0)), 'dolní polovina');
        dily.push(Object.assign({ dil: 'klika', nazev: 'Klika', cela: true }, naSit(strana)));
        dily.push(Object.assign({ dil: 'pul+', nazev: 'Klika – horní polovina', polovina: true }, naSit(horni)));
        dily.push(Object.assign({ dil: 'pul-', nazev: 'Klika – dolní polovina', polovina: true }, naSit(dolni)));
      } else dily.push(Object.assign({ dil: p.typ, nazev: K.KOLIK_DILU[p.typ] }, naSit(strana)));
      for (const d of o.desky || []) dily.push(Object.assign({ dil: d.dil, nazev: K.KOLIK_DILU[d.dil] }, naSit(over(deska(d), K.KOLIK_DILU[d.dil]))));
      dvere(duchove);
      return { dily, duchove };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }

    /* ---------- otvor čtyřhranu a stavěcí šroub (společné pro kliku i knob) ---------- */
    function uchyceni(rVnejsi) {
      const od = [], d = o.dira, z0 = o.z0;
      od.push(box(-d / 2, d / 2, -d / 2, d / 2, z0 - 1, o.zDiry1));
      // sražení vstupu otvoru – snáz se nasadí na čtyřhran
      od.push(k(k(k(M.cylinder(1.2, d / 2 * Math.SQRT2 + 0.8, d / 2 * Math.SQRT2 - 0.4, 4)).rotate([0, 0, 45])).translate([0, 0, z0 - 0.01])));
      if (p.sroub.uchyceni === 'zadne') return od;
      const st = o.staveci, zs = o.zs, ven = -(rVnejsi + 2);
      if (p.sroub.uchyceni === 'zavit') od.push(valecY(rDiry((p.sroub.predvrt > 0 ? p.sroub.predvrt : st.predvrt) / 2), 0, ven, 0, zs));
      else if (o.zahl) {
        // vrut / samořezný vrut: předvrt až k hřídeli, u povrchu zahloubení hlavy – kužel 90° (zápustná) nebo válec, hloubka podle zadání
        const z = o.zahl, rp = rDiry(z.predvrt / 2), rh = z.hlava / 2 + 0.1, y1 = -o.rSroub, h = z.hloubka;
        od.push(valecY(rp, 0, ven, 0, zs));
        if (z.tvar === 'kuzel') {
          const cd = rh - rp;
          if (h >= cd) od.push(kuzelY(rp, rh, y1 + h, y1 + h - cd, 0, zs), valecY(rh, y1 + h - cd + 0.01, ven, 0, zs));
          else od.push(kuzelY(rp, rp + h, y1 + h, y1, 0, zs), valecY(rp + h, y1 + 0.01, ven, 0, zs));
        } else od.push(valecY(rh, y1 + h, ven, 0, zs));
      }
      else od.push(valecY(rDiry(st.d / 2 + 0.2), 0, ven, 0, zs));
      if (p.sroub.uchyceni === 'vlozka') {
        const hl = Math.min(st.vDelka, o.stenaSroubu - 0.6);
        od.push(valecY(rDiry(st.vlozka / 2), -(o.rSroub - hl), ven, 0, zs));
      } else if (p.sroub.uchyceni === 'matice') {
        // kapsa pro matici: šestihran (plochy k ±x), zasunutí ze spodní strany krčku
        const sf = st.matice + 0.3, tl = st.mVyska + 0.4, yc = -(d / 2 + o.stenaSroubu / 2);
        const hex = k(k(k(k(CS.circle(sf / Math.sqrt(3), 6)).rotate(30)).extrude(tl)).rotate([90, 0, 0]));
        const nahore = k(hex.translate([0, yc + tl / 2, zs])), dole = k(hex.translate([0, yc + tl / 2, z0 - 1]));
        od.push(k(M.hull([nahore, dole])));
      }
      return od;
    }

    /** Odsazení na konci krčku: válec v otvoru rozety / štítu – užší čep (dovnitř) nebo širší límec (ven), dole i nahoře sražený. */
    function osazeni() {
      const r = o.rOs, z0 = o.z0, zR = o.zR, sr = Math.min(0.5, (zR - z0) / 3);
      const casti = [kuzelZ(r - sr, r, z0, z0 + sr)];
      if (o.osazeniVen) {
        // límec končí v líci rozety; výplň uvnitř spojí límec s krčkem přes společnou rovinu
        const sh = Math.min(0.5, r - o.rVnejsi - 0.1, (zR - z0) / 3);
        if (sh > 0.05) casti.push(kuzelZ(r, r, z0 + sr - 0.01, zR - sh + 0.01), kuzelZ(r, r - sh, zR - sh, zR));
        else casti.push(kuzelZ(r, r, z0 + sr - 0.01, zR));
        const rv = (p.typ === 'knob' ? o.prof.rn : o.rKrcku) - 0.7;
        casti.push(kuzelZ(rv, rv, zR - 0.5, zR + 0.5));
      } else casti.push(kuzelZ(r, r, z0 + sr - 0.01, zR + 0.4));
      return k(M.union(casti));
    }

    /* ---------- klika ---------- */
    function klika() {
      const q = p.klika, pat = o.pat, Mseg = 64;
      const rameno = zeSite(tazenaSit(pat.vz, q.vyska / 2, q.tloustka / 2, o.n, Mseg, pat.e));
      const plne = [rameno];
      if (q.tvar === 'trubka') {
        if (o.rLimec) plne.push(kuzelZ(o.rLimec, o.rLimec, o.zR, o.vrchLimce));
      } else {
        // krček se zaobleným vrchem v rovině líce ramene, dole sražený; tvar (kužel, prstence…) a hrany podle p.krcek
        const R = o.rKrcku, z0 = o.zR, zt = o.vrchKrcku, rf = Math.min(R * 0.5, 3), sr = 0.6;
        const body = [[o.rKrckuV(z0) - sr, z0]];
        const M = Math.max(4, Math.ceil((zt - rf - z0 - sr) / 0.4));
        for (let i = 0; i <= M; i++) { const z = z0 + sr + (zt - rf - z0 - sr) * i / M; body.push([o.rKrckuV(z), z]); }
        for (let i = 1; i <= 8; i++) { const f = Math.PI / 2 * i / 8; body.push([R - rf + rf * Math.cos(f), zt - rf + rf * Math.sin(f)]); }
        body[body.length - 1][0] = 0;
        const N = o.hrany, S = N ? N * 16 : segKruh(R * 1.5);
        // hranatý krček: plošky na poloměru profilu, jedna ploška míří dolů (−y) ke stavěcímu šroubu
        const cinitel = N ? (fi => { const w = 2 * Math.PI / N, d = ((fi + Math.PI / 2 + w / 2) % w + w) % w - w / 2; return 1 / Math.cos(d); }) : () => 1;
        plne.push(zeSite(rotacniSit(body, S, cinitel)));
      }
      if (o.rOs) plne.push(osazeni());
      let tel = k(M.union(plne));
      const od = uchyceni(Math.max(o.rVnejsi, o.rKrckuMax || 0, q.vyska / 2, q.tloustka / 2));
      if (p.tisk.rozpulit && q.tvar !== 'dolu' && (!['generator', 'vlastni'].includes(q.tvar) || o.pat.soumerna)) {
        // otvory pro kolíky z filamentu kolmo na rovinu řezu y = 0, na páteři ramene
        for (const b of kolikyPolohy()) od.push(valecY(1.0, 5, -5, b[0], b[2]));
      }
      tel = k(M.difference([tel, ...od]));
      return over(tel, 'klika');
    }
    /** Polohy kolíků pro rozpůlenou kliku: 3 body na páteři, kde je průřez dost velký a mimo krček. */
    function kolikyPolohy() {
      const q = p.klika, vz = o.pat.vz, ok = vz.filter(v => v.c[0] > o.rVnejsi + 6 && Math.min(q.vyska, q.tloustka) * v.s / 2 > 3.2);
      if (!ok.length) return [];
      const vyb = [ok[0], ok[Math.floor(ok.length / 2)], ok[ok.length - 1]];
      return vyb.filter((v, i) => vyb.findIndex(x => x === v) === i).map(v => v.c);
    }

    /* ---------- knob ---------- */
    function knob() {
      const q = p.knob, pr = o.prof, R = pr.R, rn = pr.rn;
      const S = { kruh: 96, oval: 96, hrany: q.pocet * Math.ceil(96 / q.pocet) }[q.pudorys] || q.pocet * Math.max(12, Math.ceil(96 / q.pocet));
      const zb = pr.zt - q.hlava, krokZ = q.pudorys === 'spirala' || q.pudorys === 'vrubkovani' ? 0.6 : 1.5;   // šikmý vzor potřebuje hustší kroužky
      // jemnější profil kvůli fasetám a rýhám (body po ≤ 1,5 mm)
      const prof = [];
      pr.body.forEach((b, i) => {
        if (i) {
          const a = pr.body[i - 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / krokZ));
          for (let j = 1; j < n; j++) prof.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
        }
        prof.push(b);
      });
      const sit = rotacniSit(prof, S, (f, r, z) => z < pr.zNapoj - 0.01 ? 1 : K.pudorysKnobu(q, f, Math.max(0, Math.min(1, (r - rn - 0.5) / Math.max(1, R - rn - 0.5))), (z - zb) / q.hlava));
      let tel = zeSite(sit);
      if (o.rOs) tel = k(M.union([tel, osazeni()]));
      // otvor šroubu musí projít i podřezem, který může začínat už u podstavy
      tel = k(M.difference([tel, ...uchyceni(R)]));
      return over(tel, 'knob');
    }

    /* ---------- rozeta, štít ---------- */
    function deska(d) {
      const pd = p.podlozeni, tr = pd.tloustka, sr = o.sr;
      let rz = Math.min(pd.zaobleni, tr - 0.6); if (rz <= 0.05) rz = 0;
      const obrys = k(new CS([d.obrys], 'NonZero'));
      const plat = [];
      plat.push(k(k(obrys.extrude(Math.max(0.01, tr - rz)))));
      for (let i = 1; i <= (rz ? 6 : 0); i++) {
        const f = Math.PI / 2 * i / 6, z = tr - rz + rz * Math.sin(f), ins = rz * (1 - Math.cos(f));
        plat.push(k(k(k(k(obrys.offset(-ins, 'Round', 2, 24)).extrude(0.01)).translate([0, 0, z - 0.01]))));
      }
      let tel = k(M.hull(plat));
      const od = [];
      if (d.diraR) od.push(valecZ(rDiry(d.diraR), -1, tr + 1));
      for (const [x, y] of d.srouby) {
        od.push(valecZ(rDiry(sr.otvor / 2), -1, tr + 1, x, y));
        const hl = sr.hlava / 2 + 0.2, hloubka = hl - sr.otvor / 2;
        od.push(kuzelZ(sr.otvor / 2, hl, tr - hloubka, tr + 0.01, x, y), valecZ(hl, tr, tr + 1, x, y));
      }
      if (d.otvorKlice) {
        const ob = K.obrysKlice(d.otvorKlice.druh).map(([x, y]) => [x, y + d.otvorKlice.y]);
        od.push(k(k(k(new CS([ob], 'NonZero')).extrude(tr + 2)).translate([0, 0, -1])));
      }
      if (od.length) tel = k(M.difference([tel, ...od]));
      return tel;
    }

    /* ---------- průhledné dveře, zámek a čtyřhran pro náhled ---------- */
    function dvere(out) {
      const td = p.dvere.tloustka, trn = p.dvere.trn, s = p.vreteno.s, smer = p.dvere.strana === 'leva' ? -1 : 1;
      const dosah = p.typ === 'klika' ? o.dosah : p.knob.prumer / 2;
      const yDol = o.klic ? o.klic.y - 45 : -90, yHor = 70;
      const xx = (a, b) => (smer > 0 ? [a, b] : [-b, -a]);
      const [x0, x1] = xx(-trn, Math.max(dosah + 40, 120));
      out.push({ druh: 'dvere', min: [x0, yDol, -td], max: [x1, yHor, 0] });
      const [l0, l1] = xx(-trn, 25);
      out.push({ druh: 'zamek', min: [l0, (o.klic ? o.klic.y : -20) - 28, -td / 2 - 8], max: [l1, 40, -td / 2 + 8] });
      out.push({ druh: 'vreteno', min: [-s / 2, -s / 2, -td - o.zDiry1 + 4], max: [s / 2, s / 2, o.zDiry1 - 2] });
      if (o.klic && KLICE_VLOZKA[o.klic.druh]) {
        const pul = td / 2 + o.tr + 2;
        out.push({ druh: 'vlozka', min: [-5, o.klic.y - 24, -td / 2 - pul], max: [5, o.klic.y + 8.5, pul] });
      }
    }
  }
  const KLICE_VLOZKA = { PZ: true };

  const API = { postav, tazenaSit, rotacniSit, zrcadli, orientuj };
  if (typeof module !== 'undefined') module.exports = API; else window.KLIKY_GEOM = API;
})();

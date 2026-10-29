/* Formy na odlévání – stavba těles přes manifold-3d (booleany se zaručeně uzavřenou sítí).
   ukazka(w, typ, rozmer) → síť vestavěného tvaru,
   postav(w, p, dutina, h) → {dily, info}; dutina = model už natočený a zvětšený o smrštění (FORMY.umisti + zvetsi),
   h = výška roviny (dělicí / hladina). w = modul manifold po setup(). Objekty WASM se po výpočtu uvolní. */
(function () {
  'use strict';
  const FORMY = typeof module !== 'undefined' ? require('./jadro.js') : window.FORMY;

  const doSite = m => {
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
    return { poz, idx: new Uint32Array(mesh.triVerts) };
  };

  /** Manifold ze sítě; když síť není varieta, vyhodí srozumitelnou chybu. */
  function zeSite(w, sit) {
    const mesh = new w.Mesh({ numProp: 3, vertProperties: Float32Array.from(sit.poz), triVerts: Uint32Array.from(sit.idx) });
    mesh.merge();
    try { return new w.Manifold(mesh); } catch (e) {
      const t = FORMY.tesnost(sit);
      throw new Error(`Model není uzavřené těleso (manifold: ${e.code || e.message}; okrajových hran ${t.okraj}, nevarietních ${t.nevar}). ` +
        'Opravte ho třeba v PrusaSliceru (Opravit model) nebo Meshmixeru a nahrajte znovu.');
    }
  }

  /* ---------- vestavěné ukázky ---------- */
  function ukazka(w, typ, a) {
    const { Manifold: M } = w, smaz = [], k = x => { smaz.push(x); return x; };
    try {
      let m;
      if (typ === 'koule') m = k(M.sphere(a / 2, 72));
      else if (typ === 'kostka') {
        const r = a * 0.15, d = a / 2 - r, koule = [];
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) koule.push(k(k(M.sphere(r, 32)).translate([sx * d, sy * d, sz * d])));
        m = k(M.hull(koule));
      } else {
        // šachový pěšec z primitiv: podstava, sokl, tělo, límec, hlava
        const H = a, valec = (h, r1, r2, z) => k(k(M.cylinder(h, r1, r2, 64, false)).translate([0, 0, z]));
        // díly se překrývají o 0,01 H, aby sjednocení dalo jedno těleso
        m = k(M.union([valec(0.08 * H, 0.32 * H, 0.32 * H, 0), valec(0.08 * H, 0.3 * H, 0.21 * H, 0.07 * H),
          valec(0.56 * H, 0.21 * H, 0.1 * H, 0.14 * H), valec(0.05 * H, 0.18 * H, 0.18 * H, 0.6 * H),
          k(k(M.sphere(0.16 * H, 64)).translate([0, 0, 0.8 * H]))]));
      }
      return doSite(m);
    } finally { for (const x of smaz) { try { x.delete(); } catch (e) { /* uvolněno */ } } }
  }

  /** Zaoblený obdélník se středem (cx, cy) jako CrossSection. */
  function obdelnik(w, L, W, r, cx = 0, cy = 0, k) {
    r = Math.max(0, Math.min(r, L / 2 - 0.01, W / 2 - 0.01));
    const ctv = k(w.CrossSection.square([L - 2 * r, W - 2 * r], true));
    const cs = r > 0.01 ? k(ctv.offset(r, 'Round', 2, 48)) : ctv;
    return k(cs.translate([cx, cy]));
  }
  const polygony = cs => cs.toPolygons().map(pol => pol.map(b => (Array.isArray(b) ? b : [b.x, b.y])));

  /** Kandidátní body uvnitř oblasti (mřížka) – pro rozmístění zámků a šroubů. */
  function body(cs) {
    if (cs.isEmpty()) return [];
    const b = cs.bounds(), pol = polygony(cs);
    const krok = Math.max(0.5, Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1]) / 60), out = [];
    for (let x = b.min[0] + krok / 2; x < b.max[0]; x += krok) for (let y = b.min[1] + krok / 2; y < b.max[1]; y += krok) {
      if (FORMY.vMnohouhelniku([x, y], pol)) out.push([x, y]);
    }
    return out;
  }

  function postav(w, p, dutina, hVstup) {
    const t0 = Date.now(), { Manifold: M, CrossSection: CS } = w, smaz = [];
    const k = x => { smaz.push(x); return x; };
    const valec = (h, r1, r2, x, y, z) => k(k(M.cylinder(h, r1, r2, Math.max(16, Math.min(64, Math.ceil(2 * Math.PI * Math.max(r1, r2) / 0.4))), false)).translate([x, y, z]));
    const ven = (m, jmeno, nazev, barva, otocit) => {
      const st = m.status();
      if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
      if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
      const s = doSite(m), oa = FORMY.objemAPlocha(s);
      return Object.assign(s, { jmeno, nazev, barva, otocit: !!otocit, objem: m.volume(), plocha: oa.plocha, rod: m.genus(), bbox: FORMY.obal(s.poz) });
    };
    try {
      const Mcav = k(zeSite(w, dutina));
      const B = FORMY.obal(dutina.poz), H = B[5] - B[2];
      const info = { zamky: [], srouby: [], vzduch: [], vtok: null, rozmery: [B[3] - B[0], B[4] - B[1], H], objemDutiny: Mcav.volume(), kopie: [[0, 0, 0]] };
      let h = hVstup;
      if (!(h > B[2] + 1e-3 && h < B[5] - 1e-3) && !(p.rezim === 'otevrena' && Math.abs(h - B[5]) < 1e-6)) {
        if (p.rezim !== 'box') info.rovinaMimo = true;
        h = Math.max(B[2] + 0.01 * H, Math.min(B[5] - (p.rezim === 'otevrena' ? 0 : 0.01 * H), h));
      }
      info.h = h;
      const dily = [];

      if (p.rezim === 'dvoudilna') {
        const f = p.forma, s = f.stena, ms = p.minStena;
        const obrys = f.tvar === 'obrys'
          ? k(k(k(Mcav.project()).offset(s, 'Round', 2, 48)).simplify(0.02))
          : obdelnik(w, B[3] - B[0] + 2 * s, B[4] - B[1] + 2 * s, f.zaobleni, (B[0] + B[3]) / 2, (B[1] + B[4]) / 2, k);
        const z0 = B[2] - s, z1 = B[5] + s;
        info.blok = [z0, z1]; info.vyskaHorni = z1 - h;
        const blok = k(k(obrys.extrude(z1 - z0)).translate([0, 0, z0]));
        info.objemBloku = blok.volume();
        const dolni = k(blok.trimByPlane([0, 0, -1], -h)), horni = k(blok.trimByPlane([0, 0, 1], h));
        const odeberD = [Mcav], odeberH = [Mcav], pridejD = [];

        // zámky: kuželové čepy na dolním dílu, jamky s vůlí v horním
        const zm = FORMY.zamek(p.zamky), Rj = zm.jamka.r1;
        if (p.zamky.pocet > 0 && zm.jamka.r2 > 0.3) {
          let pas = k(Mcav.trimByPlane([0, 0, 1], h));
          pas = k(pas.trimByPlane([0, 0, -1], -(h + zm.jamka.h)));
          const stopa = pas.isEmpty() ? k(Mcav.slice(h)) : k(CS.union([k(pas.project()), k(Mcav.slice(h))]));
          const oblast = k(k(obrys.offset(-(Rj + ms), 'Round')).subtract(k(stopa.offset(Rj + ms, 'Round'))));
          info.zamky = FORMY.vyberRozlozene(body(oblast), p.zamky.pocet, [], 2 * Rj + ms, [(B[0] + B[3]) / 2, (B[1] + B[4]) / 2]);
          const tg = Math.tan(p.zamky.uhel * Math.PI / 180);
          for (const [x, y] of info.zamky) {
            pridejD.push(valec(zm.cep.h + 0.5, zm.cep.r1 + 0.5 * tg, zm.cep.r2, x, y, h - 0.5));
            odeberH.push(valec(zm.jamka.h + 0.01, zm.jamka.r1 + 0.01 * tg, zm.jamka.r2, x, y, h - 0.01));
          }
        }
        // otvory na šrouby skrz oba díly
        if (p.srouby.pocet > 0) {
          const rs = (p.srouby.prumer + p.srouby.vule) / 2;
          const oblast = k(k(obrys.offset(-(rs + ms), 'Round')).subtract(k(k(Mcav.project()).offset(rs + ms, 'Round'))));
          const kand = body(oblast).filter(b => info.zamky.every(z => Math.hypot(z[0] - b[0], z[1] - b[1]) >= Rj + rs + ms));
          info.srouby = FORMY.vyberRozlozene(kand, p.srouby.pocet, info.zamky, 2 * rs + ms, [(B[0] + B[3]) / 2, (B[1] + B[4]) / 2]);
          info.prumerSroubu = 2 * rs;
          for (const [x, y] of info.srouby) { const c = valec(z1 - z0 + 2, rs, rs, x, y, z0 - 1); odeberD.push(c); odeberH.push(c); }
        }
        // vtok nad nejvyšším místem dutiny (střed nejvyšší plošky), s nálevkou
        const dz = Math.min(1, 0.02 * H), rez = k(Mcav.slice(B[5] - dz)), pol = polygony(rez);
        const nej = []; for (let i = 0; i < dutina.poz.length; i += 3) if (dutina.poz[i + 2] >= B[5] - dz) nej.push([dutina.poz[i], dutina.poz[i + 1]]);
        let vt = [nej.reduce((a, b) => a + b[0], 0) / nej.length, nej.reduce((a, b) => a + b[1], 0) / nej.length];
        if (!FORMY.vMnohouhelniku(vt, pol)) { let iz = 0; for (let i = 2; i < dutina.poz.length; i += 3) if (dutina.poz[i] > dutina.poz[iz + 2]) iz = i - 2; vt = [dutina.poz[iz], dutina.poz[iz + 1]]; }
        const rv = p.vtok.prumer / 2, kanaly = [];
        kanaly.push(valec(z1 - (B[5] - dz) + 1, rv, rv, vt[0], vt[1], B[5] - dz));
        if (p.vtok.lijavka) {
          const hl = Math.max(0, Math.min(p.vtok.prumer, z1 - B[5] - 1));
          if (hl > 0.5) kanaly.push(valec(hl + 1, rv, rv + rv * (hl + 1) / hl, vt[0], vt[1], z1 - hl));
        }
        info.vtok = [vt[0], vt[1], B[5] - dz];
        // odvzdušnění z místních vrcholů dutiny mimo plošku vtoku
        const strecha = pol.filter(q => FORMY.vMnohouhelniku(vt, [q]));
        const rozestup = Math.max(3 * p.vzduch.prumer, 0.08 * Math.hypot(B[3] - B[0], B[4] - B[1]));
        const kand = [];
        for (const m of FORMY.mistniMaxima(dutina)) {
          if (m[2] >= B[5] - dz && FORMY.vMnohouhelniku(m, strecha)) continue;
          if (Math.hypot(m[0] - vt[0], m[1] - vt[1]) < rv + p.vzduch.prumer + 2) continue;
          if (kand.some(q => Math.hypot(q[0] - m[0], q[1] - m[1]) < rozestup)) continue;
          kand.push(m);
        }
        info.vzduch = kand.slice(0, p.vzduch.pocet);
        info.vzduchZbyva = Math.max(0, kand.length - info.vzduch.length);
        for (const [x, y, z] of info.vzduch) kanaly.push(valec(z1 - z + 1.3, p.vzduch.prumer / 2, p.vzduch.prumer / 2, x, y, z - 0.3));
        const kan = k(M.union(kanaly));
        odeberH.push(kan); odeberD.push(kan);
        info.objemKanalu = k(k(kan.intersect(blok)).subtract(Mcav)).volume();
        info.objemOdlitku = info.objemDutiny + info.objemKanalu;

        const D = k(k(pridejD.length ? M.union([dolni, ...pridejD]) : dolni).subtract(k(M.union(odeberD))));
        const Hd = k(horni.subtract(k(M.union(odeberH))));
        dily.push(ven(D, 'dolni', 'Dolní díl', '#4F86D9', false), ven(Hd, 'horni', 'Horní díl', '#E08A3C', true));
      } else if (p.rezim === 'box') {
        const b = p.box, o = b.odstup, ri = 2, st = b.stena, v = b.vule, tp = b.podstavec;
        const L = B[3] - B[0] + 2 * o, W = B[4] - B[1] + 2 * o, cx = (B[0] + B[3]) / 2, cy = (B[1] + B[4]) / 2;
        const zPl = tp + b.osazeni, zb = zPl + b.cepVyska, fill = zb + H + o, zTop = fill + 2;
        const model = k(Mcav.translate([0, 0, zb - B[2]]));
        // čep pod těžištěm největší stopy modelu kousek nad spodkem (jinak pod nejnižším bodem)
        const ponor = Math.min(2, 0.3 * H), rc = b.cepPrumer / 2, zs = 0.4 * tp;
        let iz = 2; for (let i = 2; i < dutina.poz.length; i += 3) if (dutina.poz[i] < dutina.poz[iz]) iz = i;
        let px = dutina.poz[iz - 2], py = dutina.poz[iz - 1];
        const stopy = polygony(k(Mcav.slice(B[2] + ponor)));
        if (stopy.length) {
          const plo = q => { let A = 0, X = 0, Y = 0; for (let i = 0, j = q.length - 1; i < q.length; j = i++) { const c = q[j][0] * q[i][1] - q[i][0] * q[j][1]; A += c; X += (q[j][0] + q[i][0]) * c; Y += (q[j][1] + q[i][1]) * c; } return [A / 2, X / (3 * A), Y / (3 * A)]; };
          const nej = stopy.map(plo).reduce((m, q) => (Math.abs(q[0]) > Math.abs(m[0]) ? q : m));
          if (FORMY.vMnohouhelniku([nej[1], nej[2]], stopy)) { px = nej[1]; py = nej[2]; }
        }
        const cep = valec(zb + ponor - (zs + v), rc, rc, px, py, zs + v);
        const master = k(M.union([model, cep]));
        const deska = k(k(obdelnik(w, L + 2 * st + 4, W + 2 * st + 4, ri + st + 2, cx, cy, k).extrude(tp)));
        const plato = k(k(obdelnik(w, L - 2 * v, W - 2 * v, ri - v, cx, cy, k).extrude(b.osazeni + 0.01)).translate([0, 0, tp - 0.01]));
        const objimka = valec(zPl + 1 - zs, rc + v, rc + v, px, py, zs);
        const podstavec = k(k(M.union([deska, plato])).subtract(objimka));
        const vnitrek = obdelnik(w, L, W, ri, cx, cy, k);
        const ramecek = k(k(k(obdelnik(w, L + 2 * st, W + 2 * st, ri + st, cx, cy, k).subtract(vnitrek)).extrude(zTop - tp)).translate([0, 0, tp]));
        const lazen = k(k(vnitrek.extrude(fill - zPl)).translate([0, 0, zPl]));
        info.objemSilikonu = lazen.volume() - k(master.intersect(lazen)).volume();
        info.objemOdlitku = info.objemDutiny;
        info.box = { L, W, zPl, zb, fill, zTop, cep: [px, py] };
        info.kopie = [[0, 0, zb - B[2]]];
        dily.push(ven(podstavec, 'podstavec', 'Podstavec', '#4F86D9', false), ven(ramecek, 'ramecek', 'Rámeček', '#E08A3C', false),
          ven(master, 'model', 'Model na čepu', '#C9A227', false));
      } else {
        const o = p.otevrena;
        const C = k(Mcav.trimByPlane([0, 0, -1], -h));
        const hrdlo = Math.abs(h - B[5]) < 1e-6 ? null : k(k(k(Mcav.slice(h)).extrude(1.01)).translate([0, 0, h - 0.01]));
        const Cx = hrdlo ? k(M.union([C, hrdlo])) : C;
        const lx = B[3] - B[0], ly = B[4] - B[1], cx = (B[0] + B[3]) / 2, cy = (B[1] + B[4]) / 2;
        const kopie = [], dut = [];
        for (let i = 0; i < o.nx; i++) for (let j = 0; j < o.ny; j++) {
          const dx = (i - (o.nx - 1) / 2) * (lx + o.mezera), dy = (j - (o.ny - 1) / 2) * (ly + o.mezera);
          kopie.push([dx, dy, 0]); dut.push(k(Cx.translate([dx, dy, 0])));
        }
        const L = o.nx * lx + (o.nx - 1) * o.mezera + 2 * o.stena, W = o.ny * ly + (o.ny - 1) * o.mezera + 2 * o.stena;
        const zd = B[2] - o.dno;
        const blok = k(k(obdelnik(w, L, W, p.forma.zaobleni, cx, cy, k).extrude(h - zd)).translate([0, 0, zd]));
        info.objemBloku = blok.volume(); info.blok = [zd, h];
        info.objemOdlitku = C.volume() * kopie.length; info.objemKusu = C.volume();
        info.kopie = kopie;
        dily.push(ven(k(blok.subtract(k(M.union(dut)))), 'forma', 'Forma', '#4F86D9', false));
      }
      info.dily = dily.map(d => ({ jmeno: d.jmeno, nazev: d.nazev, bbox: d.bbox }));
      info.cas = Date.now() - t0;
      return { dily, info };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  /** Tisková poloha: díly s příznakem otocit převrátit (dělicí plochou dolů), vše na z = 0 vedle sebe v ose X. */
  function tiskoveRozlozeni(dily, mezera = 8) {
    const out = []; let x = 0;
    for (const d of dily) {
      const poz = Float32Array.from(d.poz);
      if (d.otocit) for (let i = 0; i < poz.length; i += 3) { poz[i + 1] = -poz[i + 1]; poz[i + 2] = -poz[i + 2]; }
      const b = FORMY.obal(poz);
      for (let i = 0; i < poz.length; i += 3) { poz[i] += x - b[0]; poz[i + 1] -= (b[1] + b[4]) / 2; poz[i + 2] -= b[2]; }
      out.push(Object.assign({}, d, { poz }));
      x += b[3] - b[0] + mezera;
    }
    const sir = x - mezera;
    for (const d of out) for (let i = 0; i < d.poz.length; i += 3) d.poz[i] -= sir / 2;
    return out;
  }

  const API = { ukazka, postav, zeSite, tiskoveRozlozeni, doSite };
  if (typeof module !== 'undefined') module.exports = API; else window.FORMY_GEO = API;
})();

/* Krabička s víčkem na pantu – stavba dílů přes manifold-3d a kontrola pohybu.
   postav(w, p, volby) → {dily: [{jmeno, nazev, poz, idx, objem, rod, tisk, kusu, xs | umisteni}], cas}
   pohyb(w, p)         → průniky dílů při otevírání víka a chlopní (numericky po úhlech).
   merka(w, p)         → zkušební měrka vůlí čepu (+ kousek čepu, je-li tištěný).
   volby.text = obrysy textu na víko (KPANT.textNaObrysy).
   Profily článků se kreslí v rovině (y, z) a vysouvají podél osy X. Zapínání se staví v místní
   soustavě přední stěny a na boky se otočí kolem Z o phi. Chlopeň a čep zapínání jsou postavené
   s osou kloubu v y = 0 a středem v x = 0 – do sestavy jdou podle umisteni [{x, y, phi}].
   Všechny objekty WASM se po výpočtu uvolní, ven jdou jen obyčejná pole. */
(function () {
  'use strict';
  const KP = typeof module !== 'undefined' ? require('./jadro.js') : window.KPANT;
  const KRAB_GEO = typeof module !== 'undefined' ? require('../krabicky/geometrie.js') : window.KRAB_GEO;
  // (u, v, w) → (x = w, y = u, z = v); matice 4×4 po sloupcích, determinant +1
  const PROFIL_X = [0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1];
  // (u, v, w) → (x = u, y = −w, z = v); determinant +1
  const PROFIL_Y = [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1];
  const VELKE = 1e4;

  function nastroje(w, p, k) {
    const { Manifold: M, CrossSection: CS } = w;
    const seg = p.segmenty;
    const segKruh = r => Math.max(12, Math.min(seg, Math.ceil(2 * Math.PI * r / 0.3)));
    const kruh = (u, v, r) => k(k(CS.circle(r, segKruh(r))).translate([u, v]));
    const obd = (u0, v0, u1, v1) => k(k(CS.square([u1 - u0, v1 - v0], false)).translate([u0, v0]));
    const mnoho = body => k(new CS([body], 'NonZero'));
    /* slzičkový otvor: kružnice se špičkou 45° ve směru uhel (rad) – tiskne se bez podpěr */
    const slza = (u, v, r, uhel) => {
      if (!p.cep.slza) return kruh(u, v, r);
      const n = segKruh(r), body = [[u + r * Math.SQRT2 * Math.cos(uhel), v + r * Math.SQRT2 * Math.sin(uhel)]];
      for (let i = 0; i <= n; i++) {
        const a = uhel + Math.PI / 4 + (3 * Math.PI / 2) * i / n;
        body.push([u + r * Math.cos(a), v + r * Math.sin(a)]);
      }
      return mnoho(body);
    };
    const pod = v => obd(-VELKE, -VELKE, VELKE, v);
    const nad = v => obd(-VELKE, v, VELKE, VELKE);
    const vytlacX = (cs, x0, x1) => k(k(k(cs.extrude(x1 - x0)).transform(PROFIL_X)).translate([x0, 0, 0]));
    const rr = (L, W, r) => k(new CS([KRAB_GEO.zaoblenyObdelnik(L, W, Math.max(0, r), seg)], 'Positive'));
    const vysunout = (cs, h, z) => k(k(cs.extrude(h)).translate([0, 0, z]));
    const valecX = (r, x0, x1) => k(k(k(M.cylinder(x1 - x0, r, r, segKruh(r), false)).rotate([0, 90, 0])).translate([x0, 0, 0]));
    const valecZ = (r, z0, z1, x, y) => k(k(M.cylinder(z1 - z0, r, r, segKruh(r), false)).translate([x, y, z0]));
    const kvadr = (x0, y0, z0, x1, y1, z1) => k(k(M.cube([x1 - x0, y1 - y0, z1 - z0], false)).translate([x0, y0, z0]));
    return { M, CS, segKruh, kruh, obd, mnoho, slza, pod, nad, vytlacX, rr, vysunout, valecX, valecZ, kvadr };
  }

  /* čep: kovový jen pro náhled a kontrolu, tištěný s hlavou na −X a zploštěním dole */
  function stavCep(N, p, c, L, y, z) {
    const { M, valecX, kvadr } = N;
    const casti = [valecX(c.r, -L / 2, L / 2)];
    if (p.cep.druh === 'plast') casti.push(valecX(p.cep.hlavaD / 2, -L / 2 - p.cep.hlavaH, -L / 2));
    let m = N.k(M.union(casti));
    if (p.cep.druh === 'plast' && p.cep.zplosteni > 0) {
      const hd = p.cep.hlavaD / 2;
      m = N.k(m.intersect(kvadr(-L / 2 - p.cep.hlavaH - 1, -hd - 1, -c.r + p.cep.zplosteni, L / 2 + 1, hd + 1, hd + 1)));
    }
    return N.k(m.translate([0, y, z]));
  }

  /* chlopeň: osa kloubu v y = 0, z = zF, střed v x = 0. vuleOkna = vůle okénka nad i pod výstupkem,
     dolad = posun vnitřní plochy desky ke stěně (víc záběru), zarezu = počet značek v jazýčku (sada zkušebních chlopní). */
  function stavChlopen(N, o, p, vuleOkna, dolad, zarezu) {
    const { M, CS, kruh, obd, slza, pod, vytlacX, kvadr } = N, k = N.k;
    const z = o.zap, c = o.cep, Rk = o.pant.Rk, B = z.sirka, kl = z.clanky[1], zF = z.zF, v = z.vystupek;
    const okno = { z0: v.z0 - vuleOkna, z1: v.z0 + v.plato + v.presah + vuleOkna, sirka: z.okno.sirka };
    const zSpod = okno.z0 - p.zapinani.pricka;
    const yi = Rk + dolad, yo = Rk - z.tf;                 // bez doladění je vnitřní plocha desky tečnou kloubu
    const deska = obd(yo, zSpod, yi, zF - Rk - o.MEZERA_PLOCHY);
    const kloub = k(k(k(CS.hull([kruh(0, zF, Rk), obd(yo, z.zWeb, yi, zF)])).intersect(pod(zF))).add(kruh(0, zF, Rk)));
    const jazycek = obd(yo - 2, zSpod, yo, zSpod + z.tf);
    const telo = k(M.union([vytlacX(deska, -B / 2, B / 2), vytlacX(kloub, kl.x0, kl.x1), vytlacX(jazycek, -B / 2, B / 2)]));
    // s třením má chlopeň na čepu jen 0,05 mm vůle – drží polohu, otáčí se ztuha
    const rOtvor = p.zapinani.treni ? c.r + Math.min(p.cep.vule, 0.05) : c.rd;
    const odeb = [kvadr(-okno.sirka / 2, yo - 2, okno.z0, okno.sirka / 2, yi + 2, okno.z1), vytlacX(slza(0, zF, rOtvor, Math.PI), -B / 2 - 1, B / 2 + 1)];
    for (let j = 0; j < zarezu; j++) {
      const x = (j - (zarezu - 1) / 2) * 2.2;
      odeb.push(kvadr(x - 0.45, yo - 2.1, zSpod - 1, x + 0.45, yo - 1.1, zSpod + z.tf + 1));
    }
    return k(M.difference([telo, ...odeb]));
  }

  function telesa(w, p, k, volby = {}) {
    const o = KP.odvozene(p);
    const N = nastroje(w, p, k); N.k = k;
    const { M, CS, kruh, obd, mnoho, slza, pod, nad, vytlacX, rr, vysunout, valecZ, kvadr } = N;
    const { t, Li, Wi, Lo, Wo, Hb, tv, R, Ri } = o;
    const { yA, zA, Rk } = o.pant, z = o.zap, c = o.cep, S = o.SRAZENI;
    const naStranu = (m, phi) => (phi ? k(m.rotate([0, 0, phi])) : m);

    /* ---- profily článků pantu ---- */
    // článek krabičky: kružnice + žebro do zadní stěny se spodkem 45° (krabička se tiskne dnem dolů)
    const yS = Wo / 2 - t, zt = Math.min(zA, Hb);
    const zLow = Math.max(0, zA - Math.SQRT2 * Rk - (yA - yS));
    const profKrab = k(k(k(CS.hull([kruh(yA, zA, Rk), obd(yS, zLow, Wo / 2, zt)])).intersect(pod(zt))).add(kruh(yA, zA, Rk)));
    // článek víka: kružnice + žebro do víka, horní plocha v rovině víka se srážením 45° (víko se tiskne převrácené)
    const zb = Math.max(zA, Hb), zTop = Hb + tv;
    const clanekViko = (yOsa, yHrana, smer, presah = S * Rk) => {
      const yy = [yHrana, yHrana - smer * t].sort((a, b) => a - b);
      const ys = yOsa + smer * presah;
      const hrot = obd(Math.min(ys, ys - smer * 0.01), zTop - 0.01, Math.max(ys, ys - smer * 0.01), zTop);
      const zebro = k(k(CS.hull([kruh(yOsa, zA, Rk), obd(yy[0], zb, yy[1], zTop), hrot])).intersect(nad(zb)));
      return k(zebro.add(kruh(yOsa, zA, Rk)));
    };
    const zar = o.pant.zarazka;
    // se zarážkou má článek víka výstupek až k bodu yHrot (horní plocha stále v rovině víka)
    const profVikoZad = clanekViko(yA, Wo / 2, 1, zar ? Math.max(S * Rk, zar.yHrot) : S * Rk);

    /* ---- otvory pro čepy pantů: hlava na −X, těsný konec v posledním článku (+X, patří krabičce) ---- */
    const clP = o.pant.clanky, xT = clP[clP.length - 1].x0 - p.pant.mezera / 2, Lp = o.pant.L;
    const otvorPant = (uhel, tesny) => o.pant.xs.flatMap(xc => tesny
      ? [vytlacX(slza(yA, zA, c.rd, uhel), xc - Lp / 2 - 1, xc + xT), vytlacX(slza(yA, zA, c.rt, uhel), xc + xT, xc + Lp / 2 + 1)]
      : [vytlacX(slza(yA, zA, c.rd, uhel), xc - Lp / 2 - 1, xc + Lp / 2 + 1)]);

    /* ---- zapínání: články víka, otvory a výstupky pro jednu stranu (místní soustava, pak otočení) ---- */
    const v = z.vystupek;
    const zapStrana = s => {
      const yW = -s.W2;
      const profVikoPred = clanekViko(s.yF, yW, -1);
      // výstupek: rovný spodek (záchyt), plató, náběh 45°; 0,3 mm zapuštěn do stěny
      const profVyst = mnoho([[yW + 0.3, v.z0], [yW + 0.3, v.z0 + v.plato + v.presah + 0.3], [yW - v.presah, v.z0 + v.plato], [yW - v.presah, v.z0]]);
      const viko = [], otvory = [], vystupky = [];
      for (const xc of s.xs) {
        for (const cl of z.clanky) if (cl.dil === 'viko') viko.push(vytlacX(profVikoPred, xc + cl.x0, xc + cl.x1));
        // hlava čepu na −X, těsný konec v pravém článku víka
        const xTz = xc + z.clanky[2].x0 - p.pant.mezera / 2;
        otvory.push(vytlacX(slza(s.yF, z.zF, c.rd, -Math.PI / 2), xc - z.sirka / 2 - 1, xTz));
        otvory.push(vytlacX(slza(s.yF, z.zF, c.rt, -Math.PI / 2), xTz, xc + z.sirka / 2 + 1));
        vystupky.push(vytlacX(profVyst, xc - v.sirka / 2, xc + v.sirka / 2));
      }
      const otoc = pole => pole.map(m => naStranu(m, s.phi));
      return { viko: otoc(viko), otvory: otoc(otvory), vystupky: otoc(vystupky) };
    };
    const zapStrany = z.strany.map(zapStrana);

    /* ---- krabička ---- */
    const vnejsi = rr(Lo, Wo, R);
    const obrys = vysunout(vnejsi, Hb, 0);
    const plne = [obrys];
    for (const xc of o.pant.xs) for (const cl of clP) if (cl.dil === 'krabicka') plne.push(vytlacX(profKrab, xc + cl.x0, xc + cl.x1));
    for (const s of zapStrany) plne.push(...s.vystupky);
    // police zarážky pod články víka: horní plocha MEZERA pod kružnicí článku, spodek 45° ke stěně
    if (zar) {
      const yE = yA + zar.yDotyk + 1.5, zT = zA + zar.zPolice;
      const police = k(mnoho([[yS, zT], [yS, zT - 1.6 - (yE - yS)], [yE, zT - 1.6], [yE, zT]]).intersect(nad(0)));
      for (const xc of o.pant.xs) for (const cl of clP) if (cl.dil === 'viko') plne.push(vytlacX(police, xc + cl.x0, xc + cl.x1));
    }
    const odebrat = [vysunout(rr(Li, Wi, Ri), o.Hi + 1, p.dno), ...otvorPant(Math.PI / 2, true)];
    // magnety na zavírání: sloupek v předním vnitřním rohu se šikmým spodkem ke stěně, kapsa shora
    const mg = o.magnety;
    let sloupky2 = null;
    const sloupky = [], kapsy = [];                    // přidají se až po vybrání dutiny
    if (mg.zavirani) {
      const zVrch = mg.zavirani.zVrchKrab, z1 = zVrch - mg.hk - o.STENA_KAPSY, zSp = Math.max(p.dno, z1 - 2.5 * mg.rb);
      const casti2 = [];
      for (const [cx, cy] of mg.zavirani.rohy) {
        const sx = Math.sign(cx);
        const roh = [sx * (Li / 2 + t / 2), -(Wi / 2 + t / 2)];
        const s2 = k(k(CS.hull([kruh(cx, cy, mg.rb), obd(Math.min(cx, roh[0]), roh[1], Math.max(cx, roh[0]), cy)])).intersect(vnejsi));
        casti2.push(s2);
        const hranol = vysunout(s2, zVrch - z1, z1);
        const bodRohu = k(k(M.cube([0.2, 0.2, 0.2], true)).translate([sx * (Li / 2 + 0.1), -(Wi / 2 + 0.1), zSp + 0.1]));
        sloupky.push(k(k(M.hull([hranol, bodRohu])).intersect(obrys)));
        kapsy.push(valecZ(mg.rm, zVrch - mg.hk, zVrch + 1, cx, cy));
      }
      sloupky2 = k(CS.union(casti2));
    }
    // magnety na stohování: kapsy zespodu ve dně
    if (mg.stohovani) for (const [x, y] of mg.stohovani.rohy) odebrat.push(valecZ(mg.rm, -1, mg.hk, x, y));
    let krabicka = k(M.difference([k(M.union(plne)), ...odebrat]));
    if (sloupky.length) krabicka = k(M.difference([k(M.union([krabicka, ...sloupky])), ...kapsy]));

    // přihrádky: pevné přepážky od dna, nebo vyjímatelná vložka (rámeček + přepážky, bez dna)
    const pr = o.prihradky;
    const prepazky = (L, W, h, z0) => {
      const m = [];
      for (const x of pr.xs) m.push(kvadr(x - pr.td / 2, -W / 2, z0, x + pr.td / 2, W / 2, z0 + h));
      for (const y of pr.ys) m.push(kvadr(-L / 2, y - pr.td / 2, z0, L / 2, y + pr.td / 2, z0 + h));
      return m;
    };
    let vlozka = null;
    if (pr.typ === 'vlozka') {
      const [Lv, Wv] = pr.vnejsi, obr = rr(Lv, Wv, pr.rVnejsi);
      const ram = k(obr.subtract(rr(Lv - 2 * pr.td, Wv - 2 * pr.td, pr.rVnejsi - pr.td)));
      const casti = [vysunout(ram, pr.vyska, p.dno), ...prepazky(Lv, Wv, pr.vyska, p.dno)];
      vlozka = k(k(M.union(casti)).intersect(vysunout(obr, pr.vyska, p.dno)));
    } else if (pr.ma) {
      krabicka = k(M.union([krabicka, k(k(M.union(prepazky(Lo, Wo, pr.vyska + 0.01, p.dno - 0.01))).intersect(obrys))]));
    }

    /* ---- víko ---- */
    const vikoCasti = [vysunout(vnejsi, tv, Hb)];
    if (p.viko.osazeni) {
      const vv = p.viko.vule, so = p.viko.stenaOsazeni, ho = p.viko.vyskaOsazeni;
      let prstenec = k(rr(Li - 2 * vv, Wi - 2 * vv, Ri - vv).subtract(rr(Li - 2 * vv - 2 * so, Wi - 2 * vv - 2 * so, Ri - vv - so)));
      // u pantu osazení chybí – při otevírání by se zadní částí opřelo o stěnu
      prstenec = k(prstenec.intersect(obd(-VELKE / 2, Wi / 2 - vv - so - VELKE, VELKE / 2, Wi / 2 - vv - so)));
      // u sloupků s magnety se osazení vybere
      if (sloupky2) prstenec = k(prstenec.subtract(k(sloupky2.offset(vv + 0.05, 'Round', 2, N.segKruh(1)))));
      vikoCasti.push(vysunout(prstenec, ho + tv / 2, Hb - ho));
    }
    for (const xc of o.pant.xs) for (const cl of clP) if (cl.dil === 'viko') vikoCasti.push(vytlacX(profVikoZad, xc + cl.x0, xc + cl.x1));
    for (const s of zapStrany) vikoCasti.push(...s.viko);
    const otvoryViko = [...otvorPant(-Math.PI / 2, false)];
    for (const s of zapStrany) otvoryViko.push(...s.otvory);
    if (mg.zavirani) {
      // kapsa zespodu ve víku; když je víko tenké, vystoupí pod něj jako sloupek (s vůlí od stěn)
      const rs = Math.max(mg.rm + 0.8, mg.rb - p.viko.vule - 0.1);
      for (const [cx, cy] of mg.zavirani.rohy) {
        if (mg.e > 0) vikoCasti.push(valecZ(rs, Hb - mg.e, Hb + 0.01, cx, cy));
        otvoryViko.push(valecZ(mg.rm, Hb - mg.e - 1, Hb - mg.e + mg.hk, cx, cy));
      }
    }
    if (mg.stohovani) for (const [x, y] of mg.stohovani.rohy) otvoryViko.push(valecZ(mg.rm, zTop - mg.hk, zTop + 1, x, y));
    if (volby.text && volby.text.length && p.text.obsah.trim()) {
      const cs = k(new CS(volby.text, 'NonZero'));
      otvoryViko.push(vysunout(cs, p.text.hloubka + 1, zTop - p.text.hloubka));
    }
    const viko = k(M.difference([k(M.union(vikoCasti)), ...otvoryViko]));

    const chlopen = stavChlopen(N, o, p, p.zapinani.vule, p.zapinani.dolad, 0);
    const B = z.sirka, zF = z.zF;

    const cepPant = stavCep(N, p, c, Lp, yA, zA);       // střed v x = 0, do sestavy se posune o pant.xs[i]
    const cepZap = stavCep(N, p, c, B, 0, zF);
    const umisteni = [];
    for (const s of z.strany) for (const x of s.xs) umisteni.push({ x, y: s.yF, phi: s.phi });
    return { o, krabicka, viko, vlozka, chlopen, cepPant, cepZap, umisteni };
  }

  function sit(m, jmeno, nazev) {
    const st = m.status();
    if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
    if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
    return { jmeno, nazev, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), rod: m.genus() };
  }

  function sUklidem(fn) {
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    try { return fn(k); } finally { for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } } }
  }

  function postav(w, p, volby = {}) {
    const t0 = Date.now();
    return sUklidem(k => {
      const T = telesa(w, p, k, volby), xp = T.o.pant.xs, kov = p.cep.druh === 'kov', n = T.umisteni.length;
      const dily = [
        Object.assign(sit(T.krabicka, 'krabicka', 'Krabička'), { tisk: true, kusu: 1 }),
        Object.assign(sit(T.viko, 'viko', 'Víko'), { tisk: true, kusu: 1 }),
        Object.assign(sit(T.cepPant, 'cepPant', kov ? 'Kovový čep pantu' : 'Čep pantu'), { tisk: !kov, kusu: xp.length, xs: xp }),
      ];
      if (T.vlozka) dily.push(Object.assign(sit(T.vlozka, 'vlozka', 'Vložka s přihrádkami'), { tisk: true, kusu: 1 }));
      if (n) dily.push(
        Object.assign(sit(T.chlopen, 'chlopen', 'Chlopeň zapínání'), { tisk: true, kusu: n, umisteni: T.umisteni }),
        Object.assign(sit(T.cepZap, 'cepZap', kov ? 'Kovový čep zapínání' : 'Čep zapínání'), { tisk: !kov, kusu: n, umisteni: T.umisteni }),
      );
      return { dily, cas: Date.now() - t0 };
    });
  }

  /* ---------- kontrola pohybu ----------
     Víko se otáčí kolem osy pantů, chlopně kolem os svých kloubů (záporný úhel = otevírání).
     Průnik s objemem nad tol je kolize. Bez chlopní vrací chlopen = null. */
  function pohyb(w, p, volby = {}) {
    const t0 = Date.now(), tol = volby.tol || 0.01;
    return sUklidem(k => {
      const T = telesa(w, p, k), o = T.o, M = w.Manifold;
      const { yA, zA } = o.pant, zF = o.zap.zF;
      const otoc = (m, uhel, y0, z0) => k(k(k(m.translate([0, -y0, -z0])).rotate([-uhel, 0, 0])).translate([0, y0, z0]));
      const prunik = (a, b) => { const r = k(a.intersect(b)); return r.isEmpty() ? 0 : r.volume(); };
      const sjednot = pole => k(M.union(pole.filter(Boolean)));
      const cepyPant = sjednot(o.pant.xs.map(x => k(T.cepPant.translate([x, 0, 0]))));
      // díl zapínání na místo: posun v místní soustavě, otočení kloubu o u, otočení na stranu
      const naMisto = (m, u) => sjednot(T.umisteni.map(um => {
        let d = k(m.translate([um.x, um.y, 0]));
        if (u) d = otoc(d, u, um.y, zF);
        return um.phi ? k(d.rotate([0, 0, um.phi])) : d;
      }));
      const sZap = T.umisteni.length > 0;
      const chlopne = u => naMisto(T.chlopen, u);
      const cepyZap = sZap ? naMisto(T.cepZap, 0) : null;
      const pevne = sjednot([T.krabicka, T.vlozka, cepyPant]);

      // víko (s čepy zapínání, bez chlopní) vůči krabičce, vložce a čepům pantů;
      // se zarážkou jemněji, aby šlo poznat, kde víko dosedne
      const vikoSCepy = sjednot([T.viko, cepyZap]);
      const krokV = volby.krokViko || (o.pant.zarazka ? 5 : 15), maxV = volby.maxViko || 180;
      const viko = { vzorky: [], max: null, zarazka: o.pant.zarazka ? o.pant.zarazka.uhel : null };
      for (let u = 0; u <= maxV + 1e-9; u += krokV) {
        const V = prunik(pevne, otoc(vikoSCepy, u, yA, zA));
        viko.vzorky.push([u, V]);
        if (V > tol) break;
        viko.max = u;
      }
      const vysledek = { viko, chlopen: null, cepVChlopni: 0, drzi: null, drziObjem: 0, zdvih: 0, uvolneni: null };
      if (sZap) {
        // chlopně při zavřeném víku vůči krabičce, víku a čepům
        const prekazky = sjednot([T.krabicka, T.viko, T.vlozka, cepyPant]);
        const krokC = volby.krokChlopen || 15, maxC = volby.maxChlopen || 120;
        const chlopen = { vzorky: [], max: null };
        for (let u = 0; u <= maxC + 1e-9; u += krokC) {
          const V = prunik(prekazky, chlopne(u));
          chlopen.vzorky.push([u, V]);
          if (V > tol) break;
          chlopen.max = u;
        }
        vysledek.chlopen = chlopen;
        const zavrene = chlopne(0);
        vysledek.cepVChlopni = prunik(cepyZap, zavrene);
        // zajištění: pootevření víka, které zvedne příčku nejbližší chlopně (nejkratší rameno) o vůli + 0,5 mm
        const zdvih = Math.atan((p.zapinani.vule + 0.5) / o.zap.rameno) * 180 / Math.PI;
        const drziObjem = prunik(T.krabicka, otoc(sjednot([T.viko, zavrene, cepyZap]), zdvih, yA, zA));
        // úhel vyklopení chlopní, při kterém se víko uvolní
        for (let u = 1; u <= 45; u += 1) {
          if (prunik(T.krabicka, otoc(sjednot([T.viko, chlopne(u), cepyZap]), zdvih, yA, zA)) <= tol) { vysledek.uvolneni = u; break; }
        }
        Object.assign(vysledek, { drzi: drziObjem > tol, drziObjem, zdvih });
      }
      vysledek.cas = Date.now() - t0;
      return vysledek;
    });
  }

  /* ---------- měrka vůlí ----------
     Hranol s vodorovnými slzičkovými otvory pro čep s různou radiální vůlí (KPANT.VULE_MERKY),
     tiskne se jako krabička (otvory naležato, špička nahoru). Nad otvorem i rýh = pořadí vůle.
     U tištěného čepu přibude krátký zkušební čep s hlavou (před hranolem, zploštěním na z = 0).
     Vrací {dily, otvory: [{x, y, z, vule, rez}], rozmer: [L, hl, H]} – vše už v tiskové poloze. */
  function merka(w, p) {
    return sUklidem(k => {
      const N = nastroje(w, p, k); N.k = k;
      const { M, slza, kvadr } = N, c = KP.odvozene(p).cep, vs = KP.VULE_MERKY;
      const rMax = c.r + Math.max(...vs), bunka = 2 * rMax + 3.2, L = vs.length * bunka + 2;
      const zc = rMax + 1.6, H = zc + rMax * Math.SQRT2 + 1.4, hl = 8;
      const odebrat = [], otvory = [];
      vs.forEach((vule, i) => {
        const x = -L / 2 + 1 + bunka * (i + 0.5);
        otvory.push({ x, y: -hl / 2, z: zc, vule, rez: i + 1 });
        odebrat.push(k(k(k(slza(x, zc, c.r + vule, Math.PI / 2).extrude(hl + 2)).transform(PROFIL_Y)).translate([0, hl / 2 + 1, 0])));
        for (let j = 0; j <= i; j++) {
          const xr = x + (j - i / 2) * 1.6;
          odebrat.push(kvadr(xr - 0.4, -hl / 2 - 1, H - 0.6, xr + 0.4, -hl / 2 + 2.5, H + 1));
        }
      });
      const dily = [Object.assign(sit(k(M.difference([kvadr(-L / 2, -hl / 2, 0, L / 2, hl / 2, H), ...odebrat])), 'merka', 'Měrka vůlí'), { tisk: true, kusu: 1 })];
      if (p.cep.druh === 'plast') {
        const zdola = p.cep.zplosteni > 0 ? c.r - p.cep.zplosteni : p.cep.hlavaD / 2;
        dily.push(Object.assign(sit(stavCep(N, p, c, 12, -hl / 2 - 4 - p.cep.hlavaD / 2, zdola), 'cepVzorek', 'Zkušební čep'), { tisk: true, kusu: 1 }));
      }
      return { dily, otvory, rozmer: [L, hl, H] };
    });
  }

  /* ---------- sada zkušebních chlopní ----------
     5 chlopní od nejtužší po nejvolnější (KPANT.variantyChlopni), v jazýčku tolik zářezů, kolikátá je.
     Každá je plnohodnotná – vybraná může rovnou zůstat na krabičce. */
  function sadaChlopni(w, p) {
    return sUklidem(k => {
      const N = nastroje(w, p, k); N.k = k;
      const o = KP.odvozene(p), varianty = KP.variantyChlopni(p);
      const dily = varianty.map(va => Object.assign(sit(stavChlopen(N, o, p, va.vule, va.dolad, va.i), 'chlopen', `Zkušební chlopeň ${va.i}`), { tisk: true, kusu: 1 }));
      return { dily, varianty };
    });
  }

  const API = { postav, pohyb, merka, sadaChlopni };
  if (typeof module !== 'undefined') module.exports = API; else window.KPANT_GEO = API;
})();

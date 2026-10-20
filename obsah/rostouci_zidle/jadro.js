/* ============================================================
   Rostoucí židle – jádro (bez DOM). Vlastní konstrukce podle obecného principu „židle roste s dítětem“:
   dva šikmé boky s vodorovnými průběžnými drážkami, sedák a podnožka se zasouvají do drážek a sevřou je
   dva svorníky; boky stojí na ližinách prodloužených dozadu (proti převržení).
   Využívá jádro obsah/drevene_hracky/jadro.js (DH: ergonomie EN 1729-1, mediány WHO, stabilita, geometrie).
   Souřadnice: x napříč (0 = vnější líc levého boku), y hloubka (0 = přední hrana boku dole, stůl je v −y), z nahoru.
   ============================================================ */
(function (koren) {
  'use strict';
  const DH = koren.DH || (typeof require !== 'undefined' ? require('../drevene_hracky/jadro.js') : null);
  const cz = DH.cz, r1 = DH.r1, RAD = Math.PI / 180, GRAV = DH.G;
  const RZ = {};

  /* ---------------- antropometrie ---------------- */
  /** výška postavy podle věku: WHO medián do 16 let, pak lineárně k 1750 mm v 18 letech (dospělý) */
  RZ.vyska = (vek) => (vek <= 16 ? DH.vyskaZVeku(vek) : Math.min(1750, 1690 + (vek - 16) * 30));
  /** hmotnost: BMI 16 (děti), 18 (dospívající), 22 (dospělí) – orientačně */
  RZ.hmotnost = (S) => { const m = S / 1000, bmi = S < 1300 ? 16 : S < 1600 ? 16 + (S - 1300) / 300 * 2 : 18 + Math.min(1, (S - 1600) / 150) * 4; return r1(bmi * m * m); };
  /** rozdíl stůl − sed podle EN 1729-1 (lineárně mezi středy velikostních pásem) */
  RZ.rozdil = (S) => {
    const T = DH.EN1729.map((q) => [(q.od + q.do) / 2, q.stul - q.sed]);
    if (S <= T[0][0]) return T[0][1];
    for (let i = 1; i < T.length; i++) if (S <= T[i][0]) { const [a, b] = T[i - 1], [c, d] = T[i]; return b + (d - b) * (S - a) / (c - a); }
    return T[T.length - 1][1];
  };
  /** rozměry těla (mm) – podíly výšky postavy (Drillis–Contini, zjednodušeně; u malých dětí větší hlava) */
  RZ.telo = (S) => {
    const hlava = S * (S < 1000 ? 0.19 : S < 1400 ? 0.16 : 0.13);
    return {
      S, m: RZ.hmotnost(S),
      podkoleni: 0.25 * S,            // výška podkolení (chodidlo → spodek stehna u kolena) ≈ potřebná výška sedu nad podnožkou
      stehno: 0.275 * S,              // hýždě → podkolení (délka stehna vsedě)
      hloubkaSedu: 0.8 * 0.275 * S,   // doporučená užitná hloubka sedu
      bedra: 0.11 * S,                // bederní opora nad sedákem
      ramena: 0.34 * S,               // ramena vsedě nad sedákem
      tlStehna: 0.085 * S, trup: 0.11 * S, chodidlo: 0.152 * S, hlava,
      paze: 0.186 * S, predlokti: 0.146 * S, sirkaRamen: 0.24 * S, sirkaBoku: 0.19 * S,
    };
  };

  /* ---------------- výchozí parametry ---------------- */
  RZ.VYCHOZI = {
    stul: 740, podStolem: 650, vekOd: 1, vekDo: 18, deti: [{ jmeno: 'Anička', vek: 2, vyska: 0 }, { jmeno: 'Matěj', vek: 7, vyska: 0 }],
    material: 'buk', tBok: 27, tDeska: 15, tOpera: 20, B: 220, sklon: 15, sirka: 400, hlDrazky: 8, vule: 0.5,
    roztec: 0, prvni: 0, Ds: 380, Dp: 260, hl: 40, vpred: 0, vzad: 0, opery: 2, madlo: true, popruh: true,
    tolSed: 15, kolenoMax: 115, sila: 25, bezpecnost: 1.5,
  };
  RZ.PREDVOLBY = [
    { id: 'zakladni', nazev: 'Buk 27/15 mm, stůl 74 cm, 1–18 let', p: {} },
    { id: 'briza', nazev: 'Bříza – překližka 24/15 mm, stůl 76 cm', p: { material: 'briza', tBok: 24, stul: 760, podStolem: 680 } },
    { id: 'sourozenci', nazev: 'Tři sourozenci (2, 5, 9 let)', p: { deti: [{ jmeno: 'Ema', vek: 2, vyska: 0 }, { jmeno: 'Jakub', vek: 5, vyska: 0 }, { jmeno: 'Tereza', vek: 9, vyska: 0 }] } },
    { id: 'strmy', nazev: 'Strmější boky 20°, užší 360 mm', p: { sklon: 20, sirka: 360 } },
  ];

  /* ---------------- geometrie boku ---------------- */
  /** přední / zadní hrana boku ve výšce z (y), vodorovná šířka boku */
  RZ.bok = (P) => {
    const t = Math.tan(P.sklon * RAD), Bh = P.B / Math.cos(P.sklon * RAD);
    return { tan: t, Bh, yF: (z) => (z - P.hl) * t, yB: (z) => (z - P.hl) * t + Bh };
  };

  /** cílové polohy pro postavu S (bez drážek) */
  RZ.cil = (P, S) => {
    const T = RZ.telo(S), sedTop = P.stul - RZ.rozdil(S);
    return { T, sedTop, podTop: sedTop - T.podkoleni, oknoD: [T.podkoleni * Math.cos((P.kolenoMax - 90) * RAD), T.podkoleni + 12] };
  };

  /** vzorky věku v rozsahu (po 0,5 roku) + zadané děti */
  RZ.vzorky = (P) => {
    const out = [];
    const od = Math.max(1, +P.vekOd || 1), dd = Math.min(18, Math.max(od, +P.vekDo || 18));
    for (let v = od; v <= dd + 1e-9; v += 0.5) out.push({ vek: v, S: Math.round(RZ.vyska(v)), dite: null });
    for (const d of P.deti || []) { const S = d.vyska > 0 ? d.vyska : Math.round(RZ.vyska(+d.vek || 3)); out.push({ vek: +d.vek || null, S, dite: d.jmeno || 'dítě' }); }
    return out;
  };

  /**
   * Přiřazení drážek pro postavu S: sedák = nejbližší drážka k cíli, podnožka = drážka (nebo podlaha) s poklesem
   * d v okně [podkolení · cos(koleno − 90°), podkolení + 8] co nejblíž podkolení.
   * G = pole výšek spodních hran drážek (z). → {ks, sedTop, chybaSed, kp (-1 = podlaha), podTop, d, koleno, dosah, ok}
   */
  RZ.prirad = (P, G, S) => {
    const C = RZ.cil(P, S), tb = P.tDeska;
    let ks = 0, nej = Infinity;
    G.forEach((g, i) => { const e = Math.abs(g + tb - C.sedTop); if (e < nej) { nej = e; ks = i; } });
    const sedTop = G[ks] + tb, L = C.T.podkoleni;
    const kand = [{ kp: -1, top: 0 }].concat(G.slice(0, ks).map((g, i) => ({ kp: i, top: g + tb }))).filter((q) => sedTop - q.top > tb + 20);
    let vyb = null;
    for (const q of kand) {
      const d = sedTop - q.top, v = d >= C.oknoD[0] - 1e-9 && d <= C.oknoD[1] + 1e-9, sk = Math.abs(d - L) + (d > L ? 0.5 : 0);
      if (!vyb || (v && !vyb.v) || (v === vyb.v && sk < vyb.sk)) vyb = { kp: q.kp, top: q.top, d, v, sk };
    }
    const d = vyb.d, koleno = d <= L ? 90 + Math.acos(Math.max(-1, Math.min(1, d / L))) / RAD : 90;
    return { S, ks, sedTop, cilSed: C.sedTop, chybaSed: sedTop - C.sedTop, kp: vyb.kp, podTop: vyb.top, d, koleno, nedosah: Math.max(0, d - L), okPod: vyb.v, okSed: Math.abs(sedTop - C.sedTop) <= P.tolSed + 1e-9, T: C.T, okno: C.oknoD };
  };

  /** rovnoměrná řada drážek g0 + k·p v rozsahu [zMin, zMax] */
  const rada = (g0, p, zMin, zMax) => { const o = []; let g = g0; while (g < zMin - 1e-9) g += p; for (; g <= zMax + 1e-9; g += p) o.push(Math.round(g * 10) / 10); return o; };
  RZ.mezeDrazek = (P) => {
    const zMin = P.hl + 12, zMaxSed = Math.max(...RZ.vzorky(P).map((v) => RZ.cil(P, v.S).sedTop)) - P.tDeska + P.tolSed;
    return { zMin, zMax: zMaxSed, pMin: P.tDeska + P.vule + 8 };
  };
  /**
   * Optimalizace roztečí: hledá největší rozteč p (nejméně drážek) a posun g0, při kterých má každý vzorek
   * sedák v toleranci a podnožku v okně úhlu kolene. Když to nejde, vrátí nejlepší kompromis.
   * → {G, p, g0, chyb, maxChybaSed, auto}
   */
  RZ.optimalizuj = (P) => {
    const M = RZ.mezeDrazek(P), V = RZ.vzorky(P);
    const hodnot = (G) => {
      let chyb = 0, maxE = 0, sk = 0;
      for (const v of V) { const a = RZ.prirad(P, G, v.S); if (!a.okSed) chyb++; if (!a.okPod) chyb++; maxE = Math.max(maxE, Math.abs(a.chybaSed)); sk += Math.abs(a.chybaSed) + Math.abs(a.d - a.T.podkoleni) * 0.3; }
      return { chyb, maxE, sk };
    };
    const zMinNeed = Math.min(...V.map((v) => RZ.cil(P, v.S).podTop)) - P.tDeska - P.tolSed;
    const zMin = Math.max(M.zMin, zMinNeed), zMax = M.zMax;
    const pevnaP = +P.roztec > 0 ? Math.max(M.pMin, +P.roztec) : null;
    let nej = null;
    const pole = pevnaP ? [pevnaP] : Array.from({ length: 41 }, (_, i) => 50 - i).filter((p) => p >= M.pMin);
    for (const p of pole) {
      const posuny = +P.prvni > 0 ? [+P.prvni] : Array.from({ length: Math.ceil(p) }, (_, i) => zMin + i);
      for (const g0 of posuny) {
        const G = rada(g0, p, Math.min(zMin, g0), zMax);
        if (G.length < 2) continue;
        const h = hodnot(G);
        const k = { G, p, g0: G[0], chyb: h.chyb, maxE: h.maxE, sk: h.sk };
        if (!nej || k.chyb < nej.chyb || (k.chyb === nej.chyb && (k.chyb === 0 ? (p > nej.p || (p === nej.p && k.sk < nej.sk)) : k.sk < nej.sk))) nej = k;
      }
      if (!pevnaP && nej && nej.chyb === 0 && nej.p > p) break;   // větší rozteč už vyhověla
    }
    return { G: nej.G, p: nej.p, g0: nej.g0, chyb: nej.chyb, maxChybaSed: nej.maxE, auto: !pevnaP };
  };

  /* ---------------- sestavení pro jednu polohu ---------------- */
  /**
   * Konstrukce (pevné díly) z parametrů a drážek: boky, ližiny, opěradlo, svorníky.
   * → {W, Hs, opery:[{z0, z1}], svorniky:[{y, z}], y0, y1 (ližina), bok}
   */
  RZ.konstrukce = (P, G, ext) => {
    const B = RZ.bok(P), W = P.sirka + 2 * P.tBok, V = RZ.vzorky(P);
    const maxSedTop = Math.max(...G) + P.tDeska;
    const bedra = V.map((v) => { const a = RZ.prirad(P, G, v.S); return a.sedTop + a.T.bedra; });
    const bedraStr = bedra.slice().sort((a, b) => a - b)[Math.floor(bedra.length / 2)];
    const vyskaOp = 70, vyskaOp2 = 60;
    const zHorni = Math.max(...V.map((v) => { const a = RZ.prirad(P, G, v.S); return a.sedTop + Math.min(a.T.ramena * 0.75, 330); }));
    const Hs = Math.max(zHorni, maxSedTop + 200, bedraStr + 120);
    const opery = [{ z0: Hs - vyskaOp, z1: Hs, nazev: 'opěradlo horní' }];
    if (+P.opery >= 2) { let z0 = Math.max(bedraStr - vyskaOp2 / 2, maxSedTop + 45); z0 = Math.min(z0, Hs - vyskaOp - 45); opery.push({ z0, z1: z0 + vyskaOp2, nazev: 'opěradlo bederní' }); }
    // svorníky: dole vpředu (pod nejnižší drážkou), nahoře vzadu (nad nejvyšším sedákem, v rovině opěradla)
    const zS1 = P.hl / 2, zS2 = maxSedTop + 22;
    // dolní svorník vede ližinami (pod všemi drážkami), horní nad nejvyšším sedákem v rovině opěradla
    const svorniky = [{ y: (B.yF(P.hl) + B.yB(P.hl)) / 2, z: zS1, nazev: 'svorník dolní' }, { y: B.yB(zS2) - 12, z: zS2, nazev: 'svorník horní' }];
    const e = ext || { vpred: 60, vzad: 120 };
    const y0 = B.yF(P.hl) - e.vpred, y1 = B.yB(P.hl) + e.vzad;
    return { W, Hs, opery, svorniky, y0, y1, bok: B, bedraStr, ext: e };
  };
  /** rovina opěradla (přední líc příček) ve výšce z */
  RZ.rovinaOpery = (P, K, z) => K.bok.yB(z) - P.tOpera;

  /** poloha sedáku a podnožky pro postavu S (vč. předozadního posunu v drážce) */
  RZ.poloha = (P, G, K, S) => {
    const a = RZ.prirad(P, G, S), T = a.T, B = K.bok, tb = P.tDeska;
    const gs = G[a.ks], gp = a.kp >= 0 ? G[a.kp] : null;
    const zB = a.sedTop + T.bedra, yOp = RZ.rovinaOpery(P, K, Math.min(zB, K.Hs - 10));
    const ysf = yOp - T.hloubkaSedu;                 // přední hrana sedáku
    const zabS = Math.min(B.yB(gs), ysf + P.Ds) - Math.max(B.yF(gs), ysf);
    const presahZa = Math.max(0, ysf + P.Ds - B.yB(gs));
    // podnožka: přední hrana před kolenem o 10 % výšky (prsty), aspoň pod chodidlem
    let ypf = null, zabP = null;
    if (gp != null) {
      const koleno = ysf - 0.03 * S;
      ypf = Math.min(koleno - 0.10 * S, B.yB(gp) - P.Dp);
      ypf = Math.max(ypf, B.yF(gp) - P.Dp + Math.min(120, 0.6 * B.Bh));   // musí zůstat zasunutá v drážce
      zabP = Math.min(B.yB(gp), ypf + P.Dp) - Math.max(B.yF(gp), ypf);
    }
    const chodidlo = { y0: ysf - 0.03 * S - 0.12 * S, y1: ysf - 0.03 * S + 0.03 * S };
    const podChodidlem = gp == null ? true : ypf <= chodidlo.y0 + 0.04 * S && ypf + P.Dp >= chodidlo.y1;
    return Object.assign(a, { gs, gp, ysf, ypf, zabS, zabP, presahZa, yOp, zB, podChodidlem, hloubka: yOp - ysf });
  };

  /** přední hrana stolu pro polohu Q: břicho ~5 cm od hrany */
  RZ.okrajStolu = (P, K, Q) => Q.yOp - Q.T.trup - 50;

  /** tělesa židle (a volitelně stůl) pro polohu Q */
  RZ.telesa = (P, G, K, Q, o) => {
    o = o || {};
    const T = [], B = K.bok, ro = DH.hustota(P.material), tb = P.tDeska, hd = P.hlDrazky, W = K.W;
    const bokB = [[B.yF(P.hl), P.hl], [B.yB(P.hl), P.hl], [B.yB(K.Hs), K.Hs], [B.yF(K.Hs), K.Hs]];
    const bokZ = DH.zaobli([bokB], 12, 0)[0] || bokB;
    for (const [x, n] of [[0, 'bok levý'], [W - P.tBok, 'bok pravý']]) T.push({ typ: 'extr', rovina: 'yz', b: bokZ, tl: P.tBok, x, y: 0, z: 0, barva: '#d9b98a', nazev: n, dil: 'bok', sklad: 1, rozlet: [x ? 160 : -160, 0, 0] });
    // ližiny se zkosenými konci
    const liz = [[K.y0 + 20, 0], [K.y1 - 30, 0], [K.y1, P.hl * 0.6], [K.y1, P.hl], [K.y0, P.hl], [K.y0, P.hl * 0.5]];
    for (const [x, n] of [[0, 'ližina levá'], [W - P.tBok, 'ližina pravá']]) T.push({ typ: 'extr', rovina: 'yz', b: liz, tl: P.tBok, x, y: 0, z: 0, barva: '#b98552', nazev: n, dil: 'lizina', sklad: 0, rozlet: [x ? 160 : -160, 0, -60] });
    // opěradlo
    for (const q of K.opery) { const zc = (q.z0 + q.z1) / 2, yb = B.yB(zc); T.push({ typ: 'box', x: P.tBok, y: yb - P.tOpera, z: q.z0, sx: P.sirka, sy: P.tOpera, sz: q.z1 - q.z0, barva: '#e6c896', nazev: q.nazev, dil: 'opera', sklad: 2, rozlet: [0, 140, 60] }); }
    // svorníky a distanční trubky
    for (const s of K.svorniky) {
      T.push({ typ: 'valec', osa: 'x', x: -6, y: s.y, z: s.z, r: 4, h: W + 12, barva: '#9aa3ab', nazev: s.nazev, dil: 'svornik', sklad: 3, rozlet: [0, 0, 0], hustota: 7850 });
      T.push({ typ: 'valec', osa: 'x', x: P.tBok, y: s.y, z: s.z, r: 8, h: P.sirka, barva: '#c8ced4', nazev: 'distanční trubka', dil: 'trubka', sklad: 2, rozlet: [0, 0, 0], hustota: 2700 * 0.35 });
    }
    // sedák a podnožka
    if (Q) {
      T.push({ typ: 'box', x: P.tBok - hd + 0.5, y: Q.ysf, z: Q.gs, sx: P.sirka + 2 * hd - 1, sy: P.Ds, sz: tb, barva: '#e8c48c', nazev: 'sedák', dil: 'sedak', sklad: 4, rozlet: [0, -200, 120] });
      if (Q.gp != null) T.push({ typ: 'box', x: P.tBok - hd + 0.5, y: Q.ypf, z: Q.gp, sx: P.sirka + 2 * hd - 1, sy: P.Dp, sz: tb, barva: '#e8c48c', nazev: 'podnožka', dil: 'podnozka', sklad: 4, rozlet: [0, -220, 40] });
      if (P.madlo && o.madlo !== false && Q.S < 1000) {
        const zm = Q.sedTop + 0.17 * Q.S, ym = Q.ysf - 15;
        T.push({ typ: 'valec', osa: 'x', x: P.tBok, y: ym, z: zm, r: 14, h: P.sirka, barva: '#f1e0bd', nazev: 'bezpečnostní madlo', dil: 'madlo', sklad: 5, rozlet: [0, -160, 100] });
        for (const x of [P.tBok, W - P.tBok - 15]) T.push({ typ: 'box', x, y: ym, z: zm - 14, sx: 15, sy: Math.max(10, B.yF(zm) - ym + 20), sz: 28, barva: '#f1e0bd', nazev: 'rameno madla', dil: 'madlo', sklad: 5, rozlet: [0, -160, 100] });
      }
    }
    for (const t of T) if (!t.hustota) t.hustota = ro;
    return T;
  };

  /** kolize mezi pohyblivými a pevnými díly (obálky; boky a ližiny vynechány – do drážek se zasouvá záměrně) */
  RZ.kolize = (T) => {
    const bb = (t) => DH.bboxTeles([t]), out = [];
    const kontrol = T.filter((t) => ['sedak', 'podnozka', 'opera', 'trubka', 'madlo'].includes(t.dil) && t.nazev !== 'rameno madla');
    for (let i = 0; i < kontrol.length; i++) for (let j = i + 1; j < kontrol.length; j++) {
      const a = bb(kontrol[i]), b = bb(kontrol[j]), e = 0.5;
      if (a.x0 < b.x1 - e && b.x0 < a.x1 - e && a.y0 < b.y1 - e && b.y0 < a.y1 - e && a.z0 < b.z1 - e && b.z0 < a.z1 - e) out.push(`${kontrol[i].nazev} × ${kontrol[j].nazev}`);
    }
    return out;
  };

  /** stabilita v poloze Q: případy opření dozadu, dopředu, do boku a postavení na podnožku */
  RZ.stabilita = (P, G, K, Q) => {
    const T = RZ.telesa(P, G, K, Q, { madlo: false }), hm = DH.hmotyTeles(T), m = Q.T.m, S = Q.S, F = (k) => k * m * GRAV * P.sila / 25;
    const op = [[0, K.y0], [K.W, K.y0], [K.W, K.y1], [0, K.y1]];
    const sedi = { m, x: K.W / 2, y: Q.yOp - 0.12 * S, z: Q.sedTop + 0.2 * S };
    const pripady = [
      { k: 'dozadu', nazev: 'odstrčí se od stolu (dozadu)', hmoty: hm.concat([sedi]), sila: { F: F(0.25), z: Q.sedTop + Q.T.ramena, smer: [0, 1] } },
      { k: 'dopredu', nazev: 'nakloní se ke stolu (dopředu)', hmoty: hm.concat([Object.assign({}, sedi, { y: Q.ysf + 0.05 * S })]), sila: { F: F(0.2), z: Q.sedTop + 0.25 * S, smer: [0, -1] } },
      { k: 'bok', nazev: 'nakloní se do boku', hmoty: hm.concat([sedi]), sila: { F: F(0.2), z: Q.sedTop + 0.25 * S, smer: [1, 0] } },
    ];
    if (Q.gp != null) pripady.push({ k: 'podnozka', nazev: 'stoupne si na podnožku', hmoty: hm.concat([{ m, x: K.W / 2, y: Q.ypf + 0.06 * S, z: Q.podTop + 0.55 * S }]), sila: { F: F(0.12), z: Q.podTop + 0.75 * S, smer: [0, -1] } });
    else pripady.push({ k: 'sedak', nazev: 'stoupne si na sedák', hmoty: hm.concat([{ m, x: K.W / 2, y: Q.ysf + 0.06 * S, z: Q.sedTop + 0.55 * S }]), sila: { F: F(0.12), z: Q.sedTop + 0.75 * S, smer: [0, -1] } });
    for (const c of pripady) c.v = DH.stabilita(c.hmoty, op, c.sila);
    return pripady;
  };

  /** nejmenší prodloužení ližin vpřed a vzad (po 10 mm), aby všechny polohy měly bezpečnost ≥ cíl */
  RZ.navrhLizin = (P, G) => {
    const V = RZ.vzorky(P);
    const nejhorsi = (e) => {
      const K = RZ.konstrukce(P, G, e); let min = { b: Infinity, k: '' };
      for (const v of V) { const Q = RZ.poloha(P, G, K, v.S); for (const c of RZ.stabilita(P, G, K, Q)) { const b = c.v.vPolygonu ? c.v.bezpecnost : 0; if (b < min.b) min = { b, k: c.k }; } }
      return min;
    };
    let e = { vpred: +P.vpred > 0 ? +P.vpred : 20, vzad: +P.vzad > 0 ? +P.vzad : 40 };
    for (let i = 0; i < 80; i++) {
      const n = nejhorsi(e);
      if (n.b >= P.bezpecnost) return { ext: e, min: n.b };
      if ((n.k === 'dozadu') && !(+P.vzad > 0)) e = { vpred: e.vpred, vzad: e.vzad + 10 };
      else if ((n.k === 'dopredu' || n.k === 'podnozka' || n.k === 'sedak') && !(+P.vpred > 0)) e = { vpred: e.vpred + 10, vzad: e.vzad };
      else if (n.k === 'bok') return { ext: e, min: n.b, bok: true };
      else return { ext: e, min: n.b, pevne: true };
      if (e.vpred > 500 || e.vzad > 600) return { ext: e, min: nejhorsi(e).b, limit: true };
    }
    return { ext: e, min: nejhorsi(e).b };
  };

  /* ============================================================
     HLAVNÍ VÝPOČET
     ============================================================ */
  RZ.normalizuj = (p) => {
    const P = Object.assign({}, RZ.VYCHOZI, p || {});
    for (const k of Object.keys(RZ.VYCHOZI)) if (typeof RZ.VYCHOZI[k] === 'number') { const v = +P[k]; P[k] = isFinite(v) ? v : RZ.VYCHOZI[k]; }
    P.sklon = Math.max(0, Math.min(35, P.sklon)); P.tDeska = Math.max(9, P.tDeska); P.tBok = Math.max(15, P.tBok);
    P.hlDrazky = Math.max(4, Math.min(P.tBok - 10, P.hlDrazky)); P.B = Math.max(120, P.B); P.sirka = Math.max(250, P.sirka);
    P.vekOd = Math.max(1, Math.min(18, P.vekOd)); P.vekDo = Math.max(P.vekOd, Math.min(18, P.vekDo));
    P.deti = (Array.isArray(P.deti) ? P.deti : []).filter((d) => d && (+d.vek > 0 || +d.vyska > 0)).slice(0, 6).map((d) => ({ jmeno: String(d.jmeno || 'dítě').slice(0, 30), vek: +d.vek || 0, vyska: +d.vyska || 0 }));
    return P;
  };

  RZ.vypocet = (p0) => {
    const P = RZ.normalizuj(p0);
    const N = { P, dily: [], telesa: [], kusovnik: [], bezpecnost: [], info: [], varovani: [], koty: [], tabulky: [], stl: [], male: [] };
    const O = RZ.optimalizuj(P), G = O.G;
    const L = RZ.navrhLizin(P, G), K = RZ.konstrukce(P, G, L.ext);
    N.G = G; N.opt = O; N.K = K; N.lizinyNavrh = L;
    const V = RZ.vzorky(P);
    N.polohy = V.map((v) => Object.assign({ vek: v.vek, dite: v.dite }, RZ.poloha(P, G, K, v.S)));
    // --- ergonomie a tabulka drážek ---
    let chybSed = 0, chybPod = 0, kol = 0, zab = 0, pod = 0;
    for (const q of N.polohy) {
      if (!q.okSed) chybSed++; if (!q.okPod) chybPod++;
      if (q.zabS < Math.min(120, 0.6 * K.bok.Bh) - 0.5 || (q.zabP != null && q.zabP < Math.min(120, 0.6 * K.bok.Bh) - 0.5)) zab++;
      if (!q.podChodidlem) pod++;
    }
    const cisloD = (i) => (i < 0 ? 'podlaha' : 'D' + (i + 1));
    N.tabulky.push({
      nadpis: 'Věk → drážka sedáku / podnožky (počítáno odspodu, D1 = nejnižší)',
      hlavicka: ['věk / dítě', 'výška', 'sedák', 'výška sedu', 'cíl', 'podnožka', 'koleno', 'hloubka sedu', 'sedák před boku', 'stav'],
      radky: N.polohy.map((q) => [q.dite ? `${q.dite}${q.vek ? ' (' + cz(q.vek, 1) + ' r.)' : ''}` : (q.vek >= 18 ? 'dospělý' : cz(q.vek, 1) + ' r.'), `${cz(q.S / 10, 0)} cm`, cisloD(q.ks), `${cz(q.sedTop, 0)} mm`, `${cz(q.cilSed, 0)} mm`, cisloD(q.kp), `${cz(q.koleno, 0)}°${q.nedosah > 0 ? ' (nedosáhne ' + cz(q.nedosah, 0) + ' mm)' : ''}`, `${cz(q.hloubka, 0)} mm`, `${cz(K.bok.yF(q.gs) - q.ysf, 0)} mm`, q.okSed && q.okPod ? 'ok' : 'pozor']),
    });
    N.info.push(`Drážek ${G.length} po ${cz(O.p, 0)} mm (${O.auto ? 'optimalizovaná rozteč' : 'zadaná rozteč'}), D1 ve výšce ${cz(G[0], 0)} mm, D${G.length} ve ${cz(G[G.length - 1], 0)} mm. Největší odchylka výšky sedu ${cz(O.maxChybaSed, 1)} mm (tolerance ±${cz(P.tolSed, 0)} mm).`);
    N.info.push(`Stůl ${cz(P.stul, 0)} mm: sed pro ${cz(V[0].vek, 1)} roku ${cz(N.polohy[0].sedTop, 0)} mm, pro dospělého ${cz(N.polohy.find((q) => !q.dite && q.vek === Math.max(...V.filter((x) => !x.dite).map((x) => x.vek))).sedTop, 0)} mm. Výška sedu = stůl − rozdíl stůl/sed podle EN 1729-1 (lineárně mezi velikostmi).`);
    if (chybSed) N.varovani.push(`${chybSed} poloh nemá drážku pro sedák v toleranci ±${cz(P.tolSed)} mm – zmenšete rozteč nebo zvětšete toleranci.`);
    if (chybPod) N.varovani.push(`${chybPod} poloh nemá podnožku v rozsahu kolene 90–${cz(P.kolenoMax, 0)}° – zmenšete rozteč drážek nebo zvyšte povolený úhel kolene.`);
    if (zab) N.varovani.push(`U ${zab} poloh je sedák nebo podnožka zasunutá v drážce méně než ${cz(Math.min(120, 0.6 * K.bok.Bh), 0)} mm – rozšiřte boky (B) nebo změňte hloubku desek.`);
    const kratky = N.polohy.filter((q) => q.ysf + P.Ds < RZ.rovinaOpery(P, K, q.sedTop + 5) - 15);
    if (kratky.length) N.varovani.push(`Sedák ${cz(P.Ds, 0)} mm nedosahuje k opěradlu u ${kratky.length} poloh (nejstarší) – prodlužte sedák aspoň na ${cz(Math.max(...kratky.map((q) => RZ.rovinaOpery(P, K, q.sedTop + 5) - q.ysf)), 0)} mm.`);
    N.kratkySedak = kratky.length;
    if (pod) N.info.push(`U ${pod} poloh přesahují prsty přes přední hranu podnožky – je to jen orientační kontrola, chodidlo stačí podepřít pod nártem.`);
    const presah = Math.max(...N.polohy.map((q) => q.presahZa));
    if (presah > 40) N.info.push(`Pro nejmenší přečnívá sedák za zadní hranu boků až o ${cz(presah, 0)} mm (sedák se posouvá dopředu/dozadu podle délky stehen) – nevadí, jen nenarážejte do zdi.`);
    // --- stabilita ve všech polohách ---
    const radky = [];
    let minB = Infinity, minC = null;
    for (const q of N.polohy) {
      const st = RZ.stabilita(P, G, K, q);
      q.stabilita = st;
      for (const c of st) { const b = c.v.vPolygonu ? c.v.bezpecnost : 0; if (b < minB) { minB = b; minC = { q, c }; } }
      const b = (k) => { const c = st.find((x) => x.k === k || (k === 'podnozka' && x.k === 'sedak')); return c ? (c.v.vPolygonu ? cz(c.v.bezpecnost, 2) : 'PŘEVRHNE') : '–'; };
      radky.push([q.dite || (q.vek >= 18 ? 'dospělý' : cz(q.vek, 1) + ' r.'), `${cz(q.T.m, 1)} kg`, b('dozadu'), b('dopredu'), b('bok'), b('podnozka')]);
    }
    N.tabulky.push({ nadpis: `Stabilita – bezpečnost proti převržení (síla opření ${cz(P.sila, 0)} % váhy; ≥ ${cz(P.bezpecnost, 1)} = vyhovuje)`, hlavicka: ['věk', 'hmotnost', 'dozadu', 'dopředu', 'do boku', 'na podnožce'], radky });
    N.minStabilita = minB;
    if (minB < 1) N.bezpecnost.push({ u: 'chyba', t: `Převržení: ${minC.q.dite || cz(minC.q.vek, 1) + ' r.'} – ${minC.c.nazev}: bezpečnost ${cz(minB, 2)}. ${minC.c.k === 'bok' ? 'Rozšiřte židli (šířka sedáku).' : 'Prodlužte ližiny.'}` });
    else if (minB < P.bezpecnost) N.bezpecnost.push({ u: 'pozor', t: `Nejmenší bezpečnost proti převržení ${cz(minB, 2)} (${minC.c.nazev}, ${minC.q.dite || cz(minC.q.vek, 1) + ' r.'}) – pod cílem ${cz(P.bezpecnost, 1)}.` });
    else N.bezpecnost.push({ u: 'ok', t: `Stabilita ve všech ${N.polohy.length} polohách: nejmenší bezpečnost ${cz(minB, 2)} (${minC.c.nazev}, ${minC.q.dite || cz(minC.q.vek, 1) + ' r.'}).` });
    N.info.push(`Ližiny: ${cz(K.y1 - K.y0, 0)} mm, vpředu ${cz(K.ext.vpred, 0)} mm před bokem, vzadu ${cz(K.ext.vzad, 0)} mm za bokem${!(+P.vzad > 0) || !(+P.vpred > 0) ? ' (spočteno na bezpečnost ' + cz(P.bezpecnost, 1) + ')' : ''}.`);
    // --- stehna pod stolem ---
    const tesno = N.polohy.filter((q) => q.sedTop + q.T.tlStehna > P.podStolem - 10);
    if (tesno.length) N.bezpecnost.push({ u: 'pozor', t: `Stehna pod deskou stolu: u ${tesno.length} poloh (${tesno.slice(0, 3).map((q) => q.dite || cz(q.vek, 1) + ' r.').join(', ')}…) je horní hrana stehen výš než ${cz(P.podStolem - 10, 0)} mm (spodek lubu − 1 cm) – dítě se nepřisune ke stolu.` });
    else N.bezpecnost.push({ u: 'ok', t: `Stehna se ve všech polohách vejdou pod stůl (spodek lubu ${cz(P.podStolem, 0)} mm).` });
    // --- kolize ---
    const kol0 = [];
    for (const q of N.polohy) { const k = RZ.kolize(RZ.telesa(P, G, K, q)); if (k.length) kol0.push(`${q.dite || cz(q.vek, 1) + ' r.'}: ${k.join(', ')}`); }
    N.kolize = kol0;
    if (kol0.length) N.varovani.push('Kolize dílů: ' + kol0.slice(0, 4).join('; '));
    // --- mezery ---
    const mez = [];
    for (const q of N.polohy) {
      const sp = K.opery[K.opery.length - 1];
      const g1 = sp.z0 - q.sedTop;
      mez.push([q.dite || (q.vek >= 18 ? 'dospělý' : cz(q.vek, 1) + ' r.'), 'sedák – spodní příčka opěradla', g1, q.S]);
      if (q.gp != null) mez.push([q.dite || cz(q.vek, 1) + ' r.', 'podnožka – sedák (svisle)', q.gs - q.podTop, q.S]);
    }
    if (K.opery.length > 1) mez.push(['všichni', 'mezi příčkami opěradla', K.opery[0].z0 - K.opery[1].z1]);
    const mezRiz = mez.map(([a, b, g, S]) => { const q = DH.mezera(g, { jenPrsty: !(S && S < 1000) || b.startsWith('podnožka') }); return [a, b, `${cz(g, 0)} mm`, q.u === 'ok' ? 'v pořádku' : q.t, q.u]; });
    const prsty = mezRiz.filter((r) => r[4] === 'chyba');
    if (prsty.length) N.bezpecnost.push({ u: 'chyba', t: `Mezery v pásmu prstů (5–12 mm): ${prsty.slice(0, 3).map((r) => r[0] + ' – ' + r[1] + ' ' + r[2]).join('; ')}.` });
    else N.bezpecnost.push({ u: 'ok', t: 'Žádná mezera mezi sedákem, podnožkou a opěradlem neleží v pásmu prstů 5–12 mm.' });
    const hlava = mezRiz.filter((r) => r[4] === 'pozor' && r[1].startsWith('sedák'));
    const male = N.polohy.filter((q) => q.S < 1000);
    if (male.length) N.bezpecnost.push({ u: P.popruh || P.madlo ? 'pozor' : 'chyba', t: `Batolata (do ~3 let): mezi sedákem a opěradlem / pod madlem může dítě vyklouznout (mezera ${hlava.length ? hlava[0][2] : '> 65 mm'}). ${P.popruh ? 'Použijte pětibodový nebo aspoň bederní popruh s pásem mezi nohama' : 'DOPORUČENO: popruh s pásem mezi nohama'}${P.madlo ? ' a bezpečnostní madlo před bříškem' : ''}. Dětské vysoké židle řeší ČSN EN 14988 (Dětské vysoké židle) – konstrukci vůči ní ověřte, tato stránka zkoušky nenahrazuje.` });
    // --- kotvení a materiál ---
    N.bezpecnost.push({ u: 'ok', t: 'Sedák a podnožka drží v drážkách sevřením boků dvěma svorníky M8 (typicky závitová tyč M8 + kloboukové matice s podložkami). Po každém přestavení dotáhnout a zkusit zatížit; drážku s vůlí doplnit klínkem (STL).' });
    if (P.vule > 1.5) N.varovani.push(`Vůle v drážce ${cz(P.vule, 1)} mm je velká – deska se bude viklat.`);
    N.bezpecnost.push({ u: 'ok', t: `Hrany zaoblit R ≥ 3 mm (rohy sedáku a podnožky R ≥ 10), povrch: olej/vosk nebo vodou ředitelný lak se shodou s EN 71-3. ${(DH.MATERIALY[P.material] || {}).pozn || ''}` });
    if (P.sklon < 8) N.bezpecnost.push({ u: 'pozor', t: `Sklon boků ${cz(P.sklon, 0)}° je malý – podnožka se pro malé děti neposune dost dopředu a ližiny musí být delší.` });
    // --- díly, kusovník, tělesa ---
    dilyAKusovnik(N, P, G, K);
    const vychozi = N.polohy.find((q) => q.dite) || N.polohy[0];
    N.vybrana = vychozi;
    N.telesa = RZ.telesa(P, G, K, vychozi);
    N.hmotnost = DH.hmotyTeles(N.telesa.filter((t) => !['svornik', 'trubka'].includes(t.dil))).reduce((s, q) => s + q.m, 0);
    N.koty.push({ pohled: 'bok', a: [K.y1 + 30, vychozi.sedTop], b: [K.y1 + 30, 0], txt: `sed ${cz(vychozi.sedTop, 0)}`, o: 0 });
    if (vychozi.gp != null) N.koty.push({ pohled: 'bok', a: [K.y0 - 30, vychozi.podTop], b: [K.y0 - 30, 0], txt: `podnožka ${cz(vychozi.podTop, 0)}`, o: 0 });
    return N;
  };

  /* ---------------- díly k řezání a kusovník ---------------- */
  function dilyAKusovnik(N, P, G, K) {
    const B = K.bok, mat = (DH.MATERIALY[P.material] || {}).nazev, tb = P.tDeska, hd = P.hlDrazky;
    const bokB = [[B.yF(P.hl), P.hl], [B.yB(P.hl), P.hl], [B.yB(K.Hs), K.Hs], [B.yF(K.Hs), K.Hs]];
    const bok = DH.zaobli([bokB], 12, 0)[0] || bokB;
    const drazky = G.map((g, i) => ({ b: DH.obdelnik(B.yF(g + tb / 2) - 2, g, B.yB(g + tb / 2) + 2, g + tb + P.vule), typ: 'drazka', i }));
    const texty = G.map((g, i) => ({ x: B.yF(g) + 6, y: g + 3, txt: `D${i + 1} · ${cz(g, 0)}`, h: 3.2 }));
    texty.push({ x: B.yF(K.Hs) + 8, y: K.Hs - 12, txt: 'VNITŘNÍ LÍC – drážky hl. ' + cz(hd, 0) + ' mm', h: 3.2 });
    const kruhy = K.svorniky.map((s) => ({ x: s.y, y: s.z, r: 4.25, typ: 'otvor' })).concat(K.svorniky.map((s) => ({ x: s.y, y: s.z, r: 8.25, typ: 'gravir' })));
    // kolíky ližina–bok (2 ks Ø 10) a příčky opěradla (2 kolíky Ø 8 na stranu)
    const zk = P.hl + 15, kol = [B.yF(zk) + 0.3 * B.Bh, B.yF(zk) + 0.7 * B.Bh];
    for (const y of kol) kruhy.push({ x: y, y: P.hl + 0.01, r: 5, typ: 'pomocna' });
    for (const q of K.opery) { const zc = (q.z0 + q.z1) / 2; for (const dz of [-(q.z1 - q.z0) / 4, (q.z1 - q.z0) / 4]) kruhy.push({ x: B.yB(zc) - P.tOpera / 2, y: zc + dz, r: 4, typ: 'otvor' }); }
    N.dily.push({ id: 'A', nazev: 'bok (2 ks zrcadlově)', ks: 2, tl: P.tBok, mat: P.material, obrysy: [{ b: bok, typ: 'rez' }].concat(drazky), kruhy, texty, poznamka: `drážky š. ${cz(tb + P.vule, 1)} hl. ${cz(hd, 0)} (horní frézka + vodicí lišta), otvory Ø 8,5 skrz pro svorníky, Ø 8 hl. 12 pro kolíky opěradla` });
    const liz = [[K.y0 + 20, 0], [K.y1 - 30, 0], [K.y1, P.hl * 0.6], [K.y1, P.hl], [K.y0, P.hl], [K.y0, P.hl * 0.5]];
    N.dily.push({ id: 'B', nazev: 'ližina', ks: 2, tl: P.tBok, mat: P.material, obrysy: [{ b: liz, typ: 'rez' }], kruhy: kol.map((y) => ({ x: y, y: P.hl - 0.01, r: 5, typ: 'pomocna' })), texty: [{ x: K.y0 + 4, y: P.hl + 3, txt: `přední konec · bok začíná ${cz(-K.y0, 0)} mm od něj`, h: 3 }], poznamka: 'kolíky Ø 10 × 40 + lepidlo D3 a vrut 5 × 60 zespodu' });
    const sed = DH.zaoblenyObd(0, 0, P.sirka + 2 * hd - 1, P.Ds, [3, 3, 12, 12]);
    N.dily.push({ id: 'C', nazev: 'sedák', ks: 1, tl: tb, mat: P.material, obrysy: [{ b: sed, typ: 'rez' }], kruhy: [], texty: [{ x: 6, y: 8, txt: 'přední hrana nahoře v obrázku', h: 3 }], poznamka: `zasunuté ${cz(hd, 0)} mm do drážek na každé straně` });
    const pod = DH.zaoblenyObd(0, 0, P.sirka + 2 * hd - 1, P.Dp, [3, 3, 10, 10]);
    N.dily.push({ id: 'D', nazev: 'podnožka', ks: 1, tl: tb, mat: P.material, obrysy: [{ b: pod, typ: 'rez' }], kruhy: [], texty: [] });
    for (const q of K.opery) N.dily.push({ id: q.nazev === 'opěradlo horní' ? 'E' : 'F', nazev: q.nazev, ks: 1, tl: P.tOpera, mat: P.material, obrysy: [{ b: DH.zaoblenyObd(0, 0, P.sirka, q.z1 - q.z0, 6), typ: 'rez' }], kruhy: [-1, 1].flatMap((s) => [0.25, 0.75].map((f) => ({ x: s < 0 ? 0.01 : P.sirka - 0.01, y: (q.z1 - q.z0) * f, r: 4, typ: 'pomocna' }))), texty: [], poznamka: 'kolíky Ø 8 × 30 do boků (2 na stranu)' });
    // štítek „věk → drážka“ k nalepení na zadní stranu boku
    const rad = N.polohy, h = 4.2, Wt = 120, Ht = 14 + rad.length * h * 1.3;
    const tx = [{ x: 4, y: Ht - 7, txt: 'Rostoucí židle – nastavení', h: 4 }];
    rad.forEach((q, i) => tx.push({ x: 4, y: Ht - 13 - i * h * 1.3, txt: `${q.dite ? q.dite : q.vek >= 18 ? 'dospělý' : cz(q.vek, 1) + ' r.'} (${cz(q.S / 10, 0)} cm): sedák D${q.ks + 1}, podnožka ${q.kp < 0 ? 'dole/vyjmout' : 'D' + (q.kp + 1)}, sedák ${cz(B.yF(q.gs) - q.ysf, 0)} mm před bokem`, h: h * 0.72 }));
    N.dily.push({ id: 'S', nazev: 'štítek nastavení (nalepit)', ks: 1, tl: 0, sablona: true, obrysy: [{ b: DH.obdelnik(0, 0, Wt, Ht), typ: 'pomocna' }], kruhy: [], texty: tx });
    // kusovník
    const Ls = (K.Hs - P.hl) / Math.cos(P.sklon * RAD) + P.B * Math.tan(P.sklon * RAD);
    let poz = 1;
    const kp = (n, ks, r, m, poz2) => N.kusovnik.push(DH.polozka(poz++, n, ks, r, m, poz2));
    kp('bok (přířez, řezat šikmo podle šablony)', 2, DH.rozmerTxt(Ls + 20, P.B, P.tBok), mat, `sklon ${cz(P.sklon, 0)}°, ${G.length} drážek po ${cz(N.opt.p, 0)} mm`);
    kp('ližina', 2, DH.rozmerTxt(K.y1 - K.y0, P.hl, P.tBok), mat, `${cz(K.ext.vzad, 0)} mm za bok (proti převržení)`);
    kp('sedák', 1, DH.rozmerTxt(P.sirka + 2 * hd - 1, P.Ds, tb), mat, 'rohy vpředu R 12');
    kp('podnožka', 1, DH.rozmerTxt(P.sirka + 2 * hd - 1, P.Dp, tb), mat, 'protiskluzová úprava nebo drážkování');
    for (const q of K.opery) kp(q.nazev, 1, DH.rozmerTxt(P.sirka, q.z1 - q.z0, P.tOpera), mat, 'kolíky do boků');
    kp('závitová tyč M8 (svorník)', 2, `M8 × ${cz(K.W + 12, 0)}`, 'ocel pozink. (typicky)', 'kloboukové matice M8 + podložky 8,4 na obou koncích');
    kp('distanční trubka', 2, `Ø 16 × 1,5 × ${cz(P.sirka, 0)}`, 'hliník (typicky) nebo dřevěný kolík vrtaný', 'drží rozteč boků, aby šlo svorníky dotáhnout');
    kp('kloboukové matice M8 + podložky', 4, 'M8 / 8,4 × 24', 'ocel', 'pod krytky (STL)');
    kp('kolík Ø 10 × 40', 4, 'Ø 10 × 40', 'buk', 'ližina – bok');
    kp('kolík Ø 8 × 30', 4 * K.opery.length, 'Ø 8 × 30', 'buk', 'příčky opěradla');
    kp('vrut do dřeva', 4, 'typicky 5 × 60', 'ocel', 'ližina zespodu');
    if (P.madlo) kp('bezpečnostní madlo (kulatina) + 2 ramena', 1, `Ø 28 × ${cz(P.sirka, 0)} / 2 × 15 × 28 × 120`, 'buk', 'jen pro batolata; ramena sevřená v drážce nad sedákem');
    if (P.popruh) kp('bezpečnostní popruh s pásem mezi nohama', 1, 'typicky', 'textil + přezka', 'kotvit do sedáku (vrut s podložkou) – pro děti do ~3 let');
    kp('filcové / gumové patky', 4, 'Ø 20', 'filc', 'pod ližiny');
    N.stl.push({ id: 'krytka', nazev: 'Krytka kloboukové matice M8', ks: 4 }, { id: 'klinek', nazev: 'Klínek do drážky (vymezí vůli)', ks: 4 }, { id: 'krouzek', nazev: 'Distanční kroužek k trubce', ks: 4 }, { id: 'zarazka', nazev: 'Zarážka / patka konce ližiny', ks: 4 });
    N.Ls = Ls;
  }

  /* ---------------- export kusovníku pro Řezný plán ---------------- */
  RZ.exportReznyPlan = (N, o) => {
    o = o || {};
    const P = N.P, K = N.K, matN = (DH.MATERIALY[P.material] || {}).nazev || P.material, hd = P.hlDrazky;
    const m = (t) => `${matN} ${t}`;
    const dilce = [
      { nazev: 'Bok (šikmý)', delka: Math.round(N.Ls + 20), sirka: P.B, ks: 2, material: m(P.tBok), tloustka: P.tBok, vlakna: true, pozn: 'vlákna podél délky boku' },
      { nazev: 'Sedák', delka: P.sirka + 2 * hd - 1, sirka: P.Ds, ks: 1, material: m(P.tDeska), tloustka: P.tDeska, vlakna: true },
      { nazev: 'Podnožka', delka: P.sirka + 2 * hd - 1, sirka: P.Dp, ks: 1, material: m(P.tDeska), tloustka: P.tDeska, vlakna: true },
    ].concat(K.opery.map((q) => ({ nazev: q.nazev.replace(/^o/, 'O'), delka: P.sirka, sirka: Math.round(q.z1 - q.z0), ks: 1, material: m(P.tOpera), tloustka: P.tOpera, vlakna: true })));
    const tyce = [{ nazev: 'Ližina', delka: Math.round(K.y1 - K.y0), ks: 2, profil: `${matN} ${P.hl}×${P.tBok}` }];
    if (P.madlo) tyce.push({ nazev: 'Madlo', delka: P.sirka, ks: 1, profil: 'buk Ø28' });
    return { format: 'kusovnik-v1', zdroj: 'Rostoucí židle', projekt: o.projekt || 'Rostoucí židle', dilce, tyce };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = RZ;
  koren.RZ = RZ;
})(typeof window !== 'undefined' ? window : globalThis);

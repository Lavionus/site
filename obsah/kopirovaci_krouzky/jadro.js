/* Kopírovací kroužky a podložky pro horní frézku – jádro generátoru (bez DOM a bez three.js, spustitelné v node).
   Díly: KROUŽEK (vodicí límec + příruba; rozhraní do patky „šrouby“ = zápustné šrouby v přírubě, nebo „matice“ = krk
   se závitem a tištěná matice), PODLOŽKA (sub-base) do patky frézky (kruh / D / obdélník / obvod z bodů, zápustné šrouby
   patky, středový otvor nebo uložení kroužku, volitelně prodloužení s madlem, kružítko s dírami pro čep a odsávací vývod
   s drážkou ve spodní ploše), CENTROVACÍ TRN (stopka do kleštiny + kužel do otvoru) a ČEP kružítka.
   Výpočet odsazení šablony je stejný jako v Šablonách pro horní frézku (sablony_frezka/jadro.js): o = (Ø kroužku − Ø frézy) / 2.

   Souřadnice sestavy: osa Z = osa frézy, z = 0 = spodní (kluzná) plocha podložky; podložka z ∈ [0, t], frézka nad ní.
   Příruba kroužku leží v zahloubení zespodu, její spodek lícuje se z = 0, vodicí límec trčí dolů do šablony (z < 0).
   Tisk bez podpor: kroužek obráceně (horní plocha příruby / konec krku na podložce, límec nahoru – přechod krku do příruby
   je kužel 45°), podložka kluznou plochou na podložce tiskárny (zahloubení = most), trn stopkou dolů (osazení 45°). */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const ZG = uzel ? require('../ibc/geometrie.js') : window.IBC_GEOM;            // zavitovaTyc (šroubovice závitu)
  const BOT = uzel ? require('../odsavaci_botka/jadro.js') : window.BOTKA;        // hrdlo / profilHrdla / HADICE (vývod na hadici)
  const fmt = G.fmt;
  const rad = s => s * Math.PI / 180;

  /* ---------------- tabulky ---------------- */
  /** tg = orientační teplota měknutí (°C) – kroužek se o šablonu tře a hřeje. */
  const MATERIALY = {
    PETG: { nazev: 'PETG', hustota: 1.27, tg: 80 }, ASA: { nazev: 'ASA', hustota: 1.07, tg: 100 }, ABS: { nazev: 'ABS', hustota: 1.04, tg: 100 },
    PC: { nazev: 'PC (polykarbonát)', hustota: 1.2, tg: 115 }, PA: { nazev: 'PA (nylon)', hustota: 1.14, tg: 90 }, PLA: { nazev: 'PLA', hustota: 1.24, tg: 58 },
  };
  /** Zápustné šrouby 90° (ISO 10642 / DIN 7991; palcové #8-32 a #10-24 mají 82° – zahloubení 90° je pro tisk dost blízko):
      d, otvor (průchozí), hlava Ø, jadro = otvor pro řezání závitu / samořezný šroub do tištěného dílu. */
  const SROUBY = {
    M3: { nazev: 'M3', d: 3, otvor: 3.4, hlava: 6.7, jadro: 2.6 }, M4: { nazev: 'M4', d: 4, otvor: 4.5, hlava: 9, jadro: 3.4 },
    M5: { nazev: 'M5', d: 5, otvor: 5.5, hlava: 11.2, jadro: 4.3 }, M6: { nazev: 'M6', d: 6, otvor: 6.6, hlava: 13.4, jadro: 5.1 },
    '8-32': { nazev: '#8-32 UNC', d: 4.17, otvor: 4.6, hlava: 8.4, jadro: 3.5 }, '10-24': { nazev: '#10-24 UNC', d: 4.83, otvor: 5.3, hlava: 9.8, jadro: 4 },
  };
  /** Rozhraní kroužek ↔ patka – TYPICKÉ, OVĚŘIT MĚŘENÍM (stav 19. 11. 2026, z paměti, ne z výkresů výrobců).
      Rozměry se liší i mezi modely téže značky – před tiskem přeměřte posuvkou otvor a zahloubení v patce. */
  const SYSTEMY = [
    { id: 'vlastni', nazev: 'Pro podložku z tohoto generátoru (dopočítá se z kroužku)', auto: true,
      pozn: 'příruba na 2 zápustné šrouby M3 do zahloubení podložky – rozměry se dopočítají podle Ø kroužku' },
    { id: 'pc', nazev: 'Porter-Cable (US) – příruba 1-3/8″, krk s maticí', typ: 'matice', priruba: 34.9, tlPriruby: 2.4, krk: 30.2,
      pozn: 'příruba v zahloubení patky zespodu, krk ~1-3/16″ prochází otvorem, matice shora; kovová matice PC na tištěný závit nepasuje – tiskne se vlastní. Typické, ověřit.' },
    { id: 'eu2m4', nazev: 'Příruba na 2 šrouby M4 (evropský typ)', typ: 'srouby', priruba: 54, tlPriruby: 3.5, pocet: 2, roztec: 42, sroub: 'M4',
      pozn: 'tento způsob mají např. některé frézky Bosch, Makita nebo Metabo – rozteč a Ø příruby se liší podle modelu, změřte. Typické, ověřit.' },
    { id: 'eu3m4', nazev: 'Příruba na 3 šrouby M4', typ: 'srouby', priruba: 58, tlPriruby: 3.5, pocet: 3, roztec: 46, sroub: 'M4',
      pozn: 'obecná příruba na 3 šrouby – rozteč změřte na původním kroužku. Typické, ověřit.' },
    { id: 'm30', nazev: 'Závitový krk Ø 30 s maticí (vlastní podložka)', typ: 'matice', priruba: 36, tlPriruby: 3, krk: 30,
      pozn: 'kroužek i matice se tisknou – pasují jen k sobě; krk prochází otvorem podložky.' },
  ];
  /** Běžné vnější Ø kroužků (mm) – stejné jako v Šablonách pro horní frézku; palcové 5/16″…1″. */
  const KROUZKY = [10, 12, 15.88, 17, 24, 27, 30];
  /** Stopky fréz do kleštiny (mm): 6, 1/4″, 8, 12, 1/2″. */
  const STOPKY = [6, 6.35, 8, 12, 12.7];
  const NAZVY = {
    typ: { srouby: 'příruba na zápustné šrouby', matice: 'krk se závitem a matice' },
    tvar: { kruh: 'kruh', D: 'D (kruh s rovnou hranou)', obdelnik: 'obdélník', body: 'obvod z bodů' },
    otvor: { krouzky: 'uložení kroužku', prosty: 'jen otvor' },
  };

  const VYCHOZI = {
    verze: 1, nazev: 'Kopírovací kroužek',
    dily: { krouzek: true, podlozka: true, trn: false },
    krouzek: { vnejsi: 17, vnitrni: 13, limec: 5, korekce: 0, srazeni: 0.5 },
    rozhrani: { typ: 'srouby', priruba: 36, tlPriruby: 3, pocet: 2, roztec: 26, sroub: 'M3', natoceni: 0, vule: 0.15,
      krk: 30, stoupani: 1.5, vuleZavitu: 0.25, vyskaMatice: 6, stenaMatice: 4, tisknoutZavit: true },
    podlozka: { tvar: 'kruh', prumer: 150, delka: 200, sirka: 150, polomer: 15, posun: 0, rovna: 60, body: '-75 -60; 75 -60; 90 0; 75 60; -75 60',
      tloustka: 6, patka: 140, otvor: 'krouzky', prumerOtvoru: 32, pocet: 3, roztec: 110, sroub: 'M5', natoceni: 90 },
    madlo: { zapnuto: false, delka: 180, sirka: 70, prumer: 32, vyska: 45, natoceni: 0 },
    kruzitko: { zapnuto: false, od: 60, do: 250, krok: 10, sirka: 40, cep: 6, vule: 0.2, natoceni: 180 },
    vyvod: { zapnuto: false, prumer: 35, usazeni: 'zasun', delka: 30, stena: 2.4, vule: 0.3, kuzel: 1, doraz: 2, sklon: 60, natoceni: 0, drazka: 14, hloubka: 3 },
    trn: { stopka: 8, vule: 0.05, delkaStopky: 20, dMin: 6, dMax: 36, uhel: 30 },
    vypocty: { freza: 8, sablona: 8, sadaOd: 10, sadaDo: 30, sadaKrok: 2 },
    tisk: { material: 'PETG', vrstva: 0.2, uhel: 45, podlozkaX: 220, podlozkaY: 220, kalibrace: false, krokKalibrace: 0.1 },
  };
  /** Meze číselných polí [min, max, celé?]. */
  const MEZE = {
    'krouzek.vnejsi': [5, 80], 'krouzek.vnitrni': [2, 76], 'krouzek.limec': [1, 30], 'krouzek.korekce': [-1, 1], 'krouzek.srazeni': [0, 2],
    'rozhrani.priruba': [10, 120], 'rozhrani.tlPriruby': [1.5, 10], 'rozhrani.pocet': [2, 6, 1], 'rozhrani.roztec': [6, 110], 'rozhrani.natoceni': [-360, 360],
    'rozhrani.vule': [-0.2, 1], 'rozhrani.krk': [8, 100], 'rozhrani.stoupani': [0.8, 3], 'rozhrani.vuleZavitu': [0, 0.8],
    'rozhrani.vyskaMatice': [3, 20], 'rozhrani.stenaMatice': [1.6, 15],
    'podlozka.prumer': [40, 400], 'podlozka.delka': [40, 500], 'podlozka.sirka': [40, 400], 'podlozka.polomer': [0, 200], 'podlozka.posun': [-200, 200],
    'podlozka.rovna': [10, 200], 'podlozka.tloustka': [3, 20], 'podlozka.patka': [0, 400], 'podlozka.prumerOtvoru': [5, 120],
    'podlozka.pocet': [0, 8, 1], 'podlozka.roztec': [10, 400], 'podlozka.natoceni': [-360, 360],
    'madlo.delka': [30, 400], 'madlo.sirka': [20, 200], 'madlo.prumer': [10, 60], 'madlo.vyska': [0, 120], 'madlo.natoceni': [-360, 360],
    'kruzitko.od': [10, 1000], 'kruzitko.do': [10, 1000], 'kruzitko.krok': [1, 200], 'kruzitko.sirka': [15, 120], 'kruzitko.cep': [2, 16],
    'kruzitko.vule': [-0.2, 1], 'kruzitko.natoceni': [-360, 360],
    'vyvod.prumer': [10, 100], 'vyvod.delka': [8, 120], 'vyvod.stena': [1.2, 8], 'vyvod.vule': [-0.5, 2], 'vyvod.kuzel': [0, 5], 'vyvod.doraz': [0, 8],
    'vyvod.sklon': [30, 90], 'vyvod.natoceni': [-360, 360], 'vyvod.drazka': [4, 60], 'vyvod.hloubka': [1, 10],
    'trn.stopka': [3, 20], 'trn.vule': [-0.3, 0.5], 'trn.delkaStopky': [8, 60], 'trn.dMin': [1, 100], 'trn.dMax': [4, 120], 'trn.uhel': [10, 60],
    'vypocty.freza': [1, 76], 'vypocty.sablona': [2, 40], 'vypocty.sadaOd': [5, 80], 'vypocty.sadaDo': [5, 80], 'vypocty.sadaKrok': [0.5, 20],
    'tisk.vrstva': [0.05, 0.5], 'tisk.uhel': [20, 75], 'tisk.podlozkaX': [80, 1000], 'tisk.podlozkaY': [80, 1000], 'tisk.krokKalibrace': [0.02, 0.3],
  };
  const VYCTY = {
    'rozhrani.typ': Object.keys(NAZVY.typ), 'rozhrani.sroub': Object.keys(SROUBY), 'podlozka.tvar': Object.keys(NAZVY.tvar),
    'podlozka.otvor': Object.keys(NAZVY.otvor), 'podlozka.sroub': Object.keys(SROUBY), 'vyvod.usazeni': ['zasun', 'nasun'],
    'tisk.material': Object.keys(MATERIALY),
  };

  /** Předvolby: jen odchylky od výchozího projektu (výpočty a tisk zůstávají uživatelovy). */
  const PREDVOLBY = [
    { id: 'k17', nazev: 'Kroužek Ø 17 + kruhová podložka Ø 150', popis: 'fréza do 12 mm, límec 5 mm, příruba Ø 36 na 2 × M3, patka 3 × M5', p: {} },
    { id: 'k30', nazev: 'Kroužek Ø 30 – příruba na 2 × M4', popis: 'průchod 24 mm pro frézy do 23 mm, límec 6 mm',
      p: { nazev: 'Kroužek 30', krouzek: { vnejsi: 30, vnitrni: 24, limec: 6 }, rozhrani: { typ: 'srouby', priruba: 54, tlPriruby: 3.5, pocet: 2, roztec: 42, sroub: 'M4' },
        podlozka: { prumer: 160, roztec: 120 } } },
    { id: 'pc58', nazev: 'Porter-Cable styl – kroužek 5/8″ s maticí', popis: 'Ø 15,88, příruba 1-3/8″, podložka 6″ na 4 × #10-24 (ověřit)',
      p: { nazev: 'Kroužek 5/8 PC', krouzek: { vnejsi: 15.88, vnitrni: 11.5, limec: 4.8 },
        rozhrani: { typ: 'matice', priruba: 34.9, tlPriruby: 2.4, krk: 30.2, vyskaMatice: 6 },
        podlozka: { prumer: 152.4, tloustka: 6.35, pocet: 4, roztec: 127, sroub: '10-24', natoceni: 45, patka: 150 } } },
    { id: 'dbase', nazev: 'D-podložka s rovnou hranou pro vodítko', popis: 'rovná hrana 65 mm od osy – frézka jede podél pravítka',
      p: { nazev: 'D-podložka', podlozka: { tvar: 'D', prumer: 170, rovna: 65, otvor: 'prosty', prumerOtvoru: 36 }, dily: { krouzek: false, trn: true }, trn: { dMax: 42 } } },
    { id: 'madlo', nazev: 'Prodloužená deska s madlem a odsáváním', popis: 'pro frézování hran: deska přesahuje obrobek, madlo drží frézku, vývod Ø 35',
      p: { nazev: 'Prodloužená deska', podlozka: { otvor: 'prosty', prumerOtvoru: 36 }, dily: { krouzek: false },
        madlo: { zapnuto: true }, vyvod: { zapnuto: true, natoceni: 0 } } },
    { id: 'kruzitko', nazev: 'Kružítko na kruhy R 60–250 mm', popis: 'rameno s dírami po 10 mm a čep Ø 6',
      p: { nazev: 'Kružítko', podlozka: { otvor: 'prosty', prumerOtvoru: 30 }, dily: { krouzek: false }, kruzitko: { zapnuto: true } } },
    { id: 'trn', nazev: 'Jen centrovací trn – stopka 8 mm', popis: 'vystředí podložku nebo kroužek na ose kleštiny',
      p: { nazev: 'Centrovací trn', dily: { krouzek: false, podlozka: false, trn: true } } },
  ];

  const kopie = G.kopie;
  const normalizuj = v => G.normalizuj(v, { VYCHOZI, MEZE, VYCTY });
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(G.slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }

  /* ---------------- 2D pomůcky ---------------- */
  const kruh = (cx, cy, r, n = 64) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(2 * Math.PI * i / n), cy + r * Math.sin(2 * Math.PI * i / n)]);
  const plocha = P => { let A = 0; for (let i = 0; i < P.length; i++) { const q = P[(i + 1) % P.length]; A += P[i][0] * q[1] - q[0] * P[i][1]; } return A / 2; };
  /** Bod uvnitř (paprsek, i nekonvexní). */
  function uvnitr(P, [x, y]) {
    let v = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i], [xj, yj] = P[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) v = !v;
    }
    return v;
  }
  function vzdalenost(P, [x, y]) {
    let m = Infinity;
    for (let i = 0; i < P.length; i++) {
      const A = P[i], B = P[(i + 1) % P.length], ex = B[0] - A[0], ey = B[1] - A[1];
      const t = Math.max(0, Math.min(1, ((x - A[0]) * ex + (y - A[1]) * ey) / (ex * ex + ey * ey || 1)));
      m = Math.min(m, Math.hypot(A[0] + t * ex - x, A[1] + t * ey - y));
    }
    return m;
  }
  /** Kolik místa má kruh (bod, r) uvnitř obrysu: záporné = vyčnívá nebo leží venku. */
  const rezerva = (P, b, r) => (uvnitr(P, b) ? vzdalenost(P, b) - r : -1e9);
  /** Paprsek z počátku ve směru u: nejvzdálenější průsečík s obrysem (−1 když žádný). */
  function paprsek(P, u) {
    let t = -1;
    for (let i = 0; i < P.length; i++) {
      const A = P[i], B = P[(i + 1) % P.length], ex = B[0] - A[0], ey = B[1] - A[1], den = u[0] * ey - u[1] * ex;
      if (Math.abs(den) < 1e-12) continue;
      const tt = (A[0] * ey - A[1] * ex) / den, s = (A[0] * u[1] - A[1] * u[0]) / den;
      if (s >= -1e-9 && s <= 1 + 1e-9 && tt > t) t = tt;
    }
    return t;
  }
  /** Konvexní obal (monotónní řetězec), CCW. */
  function obalBodu(B) {
    const b = B.slice().sort((a, c) => a[0] - c[0] || a[1] - c[1]);
    const x = (o, a, c) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]);
    const d = [], h = [];
    for (const q of b) { while (d.length >= 2 && x(d[d.length - 2], d[d.length - 1], q) <= 0) d.pop(); d.push(q); }
    for (let i = b.length - 1; i >= 0; i--) { const q = b[i]; while (h.length >= 2 && x(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); }
    return d.slice(0, -1).concat(h.slice(0, -1));
  }
  const otoc2 = (P, st) => { const c = Math.cos(rad(st)), s = Math.sin(rad(st)); return P.map(([x, y]) => [x * c - y * s, x * s + y * c]); };
  function zaoblenyObdelnik(cx, L, W, r, K = 10) {
    r = Math.max(0, Math.min(r, L / 2 - 0.01, W / 2 - 0.01));
    if (r < 0.05) return [[cx - L / 2, -W / 2], [cx + L / 2, -W / 2], [cx + L / 2, W / 2], [cx - L / 2, W / 2]];
    const out = [];
    [[1, -1, -90], [1, 1, 0], [-1, 1, 90], [-1, -1, 180]].forEach(([sx, sy, a0]) => {
      const x0 = cx + sx * (L / 2 - r), y0 = sy * (W / 2 - r);
      for (let j = 0; j <= K; j++) { const a = rad(a0 + 90 * j / K); out.push([x0 + r * Math.cos(a), y0 + r * Math.sin(a)]); }
    });
    return out;
  }
  /** „x y; x y; …“ (desetinná tečka; čárka nebo mezera mezi x a y) → body CCW, nebo {chyba}. */
  function ctiBody(text) {
    const B = [];
    for (const kus of String(text || '').split(/[;\n]+/)) {
      const t = kus.trim(); if (!t) continue;
      const c = t.split(/[\s,]+/).filter(Boolean).map(Number);
      if (c.length !== 2 || !c.every(Number.isFinite)) return { chyba: `bod „${t}“ nejde přečíst (zápis „x y“ nebo „x, y“, desetinná tečka)` };
      B.push(c);
    }
    if (B.length < 3) return { chyba: 'obvod potřebuje aspoň 3 body' };
    const A = plocha(B);
    if (Math.abs(A) < 100) return { chyba: 'body neuzavírají žádnou plochu' };
    return { body: A < 0 ? B.reverse() : B };
  }

  /* ---------------- odvozené rozměry ---------------- */
  /** Rozhraní pro podložku z tohoto generátoru: příruba na 2 × M3 mimo hlavy šroubů u límce. */
  function autoRozhrani(D) {
    const s = SROUBY.M3, roztec = Math.ceil(D + s.hlava + 2), priruba = Math.ceil(roztec + s.hlava + 3);
    return { typ: 'srouby', priruba, tlPriruby: 3, pocet: 2, roztec, sroub: 'M3' };
  }
  /** Profil závitu krku (lichoběžník, boky 40° od svislice – tiskne se bez podpor). */
  const zavit = (r, stoupani) => ({ p: stoupani, h: 0.38 * stoupani, bok: 50, rMaj: r });

  /** Rozměry kroužku pro zadané Ø (sada používá stejné rozhraní). */
  function rozmeryKrouzku(p, D, d) {
    const k = p.krouzek, r = p.rozhrani;
    const o = { D, d, Dv: D + k.korekce, rb: d / 2, L: k.limec, tp: r.tlPriruby, Rp: r.priruba / 2 };
    o.R = o.Dv / 2;
    o.c = Math.max(0, Math.min(k.srazeni, o.L / 2, (o.R - o.rb) / 2));
    o.stena = o.R - o.rb;
    return o;
  }

  /** Všechny odvozené rozměry; o.chyby = důvody, proč díl nejde sestavit. */
  function odvozene(p) {
    const k = p.krouzek, r = p.rozhrani, pd = p.podlozka, o = { chyby: [] };
    o.kr = rozmeryKrouzku(p, k.vnejsi, k.vnitrni);
    o.t = pd.tloustka;
    o.Rp = r.priruba / 2; o.tp = r.tlPriruby;
    o.sroubK = SROUBY[r.sroub];
    o.matice = r.typ === 'matice';
    if (o.matice) {
      o.Rk = r.krk / 2;
      o.w = Math.max(0, o.Rp - o.Rk);                          // výška kužele 45° mezi krkem a přírubou
      o.z = zavit(o.Rk, r.stoupani);
      o.Hn = Math.max(o.w + 2, o.t - o.tp + r.vyskaMatice + 1.5); // krk nad přírubou: zbytek podložky + matice + přesah
      o.Rm = o.Rk + r.stenaMatice;                              // vnější poloměr matice
      o.Rmv = o.Rk + r.vuleZavitu;                              // vrcholy vnitřního závitu matice
    }
    // středový otvor podložky
    o.Rc = o.Rp + r.vule;                                       // zahloubení pro přírubu
    if (pd.otvor === 'prosty') o.Rotvor = pd.prumerOtvoru / 2;
    else if (o.matice) o.Rotvor = o.Rk + r.vule;
    else o.Rotvor = Math.max(o.kr.rb + 0.5, r.roztec / 2 - o.sroubK.jadro / 2 - 1.6);
    o.Rstred = pd.otvor === 'krouzky' ? o.Rc : o.Rotvor;       // co je kolem osy vybráno ze spodní plochy
    // šrouby kroužku (rozhraní srouby)
    o.sroubyK = r.typ === 'srouby' ? Array.from({ length: r.pocet }, (_, i) => { const a = rad(r.natoceni + 360 * i / r.pocet); return [r.roztec / 2 * Math.cos(a), r.roztec / 2 * Math.sin(a)]; }) : [];
    o.zahloubeniK = (o.sroubK.hlava - o.sroubK.otvor) / 2;
    // obrys podložky
    o.sroubP = SROUBY[pd.sroub];
    let zakl;
    if (pd.tvar === 'kruh') zakl = kruh(0, 0, pd.prumer / 2, 128);
    else if (pd.tvar === 'D') {
      // oblouk nad rovnou hranou y = −rovna (CCW), tětiva uzavře obrys
      const R = pd.prumer / 2, a0 = Math.asin(-Math.min(pd.rovna, R - 1) / R), n = 128;
      zakl = Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (Math.PI - 2 * a0) * i / n; return [R * Math.cos(a), R * Math.sin(a)]; });
    } else if (pd.tvar === 'obdelnik') zakl = zaoblenyObdelnik(pd.posun, pd.delka, pd.sirka, pd.polomer);
    else {
      const b = ctiBody(pd.body);
      if (b.chyba) { o.chyby.push({ druh: 'body', text: b.chyba }); zakl = kruh(0, 0, pd.prumer / 2, 128); } else zakl = b.body;
    }
    o.zaklad = zakl;
    o.obrysy = [zakl];
    // prodloužení s madlem: obal kruhu u osy a kruhu na konci
    if (pd.tvar !== 'body' || !o.chyby.length) {
      if (p.madlo.zapnuto) {
        const m = p.madlo, rz = Math.max(m.sirka / 2, Math.min(pd.patka / 2, 60));
        const c = Math.cos(rad(m.natoceni)), s = Math.sin(rad(m.natoceni));
        o.madloBod = [m.delka * c, m.delka * s];
        o.madloObrys = obalBodu(kruh(0, 0, rz, 72).concat(kruh(o.madloBod[0], o.madloBod[1], m.sirka / 2, 72)));
        o.obrysy.push(o.madloObrys);
      }
      if (p.kruzitko.zapnuto) {
        const kz = p.kruzitko, delka = Math.max(kz.od, kz.do) + kz.cep / 2 + 10;
        o.ramenoObrys = otoc2(zaoblenyObdelnik(delka / 2, delka, kz.sirka, kz.sirka / 2), kz.natoceni);
        o.obrysy.push(o.ramenoObrys);
      }
    }
    // šrouby patky
    o.sroubyP = Array.from({ length: pd.pocet }, (_, i) => { const a = rad(pd.natoceni + 360 * i / pd.pocet); return [pd.roztec / 2 * Math.cos(a), pd.roztec / 2 * Math.sin(a)]; });
    o.zahloubeniP = (o.sroubP.hlava - o.sroubP.otvor) / 2;
    // díry kružítka (vynechá ty, které padnou do středového otvoru nebo ke šroubům)
    o.dirKruzitka = []; o.vynechanoDir = 0;
    if (p.kruzitko.zapnuto) {
      const kz = p.kruzitko, rd = (kz.cep + kz.vule) / 2, c = Math.cos(rad(kz.natoceni)), s = Math.sin(rad(kz.natoceni));
      const a = Math.min(kz.od, kz.do), b = Math.max(kz.od, kz.do);
      for (let i = 0; a + i * kz.krok <= b + 1e-6 && i < 400; i++) {
        const R = a + i * kz.krok, B = [R * c, R * s];
        const kolize = R - rd < o.Rstred + 2.5 || o.sroubyP.some(q => Math.hypot(q[0] - B[0], q[1] - B[1]) < rd + o.sroubP.hlava / 2 + 2)
          || o.sroubyK.some(q => Math.hypot(q[0] - B[0], q[1] - B[1]) < rd + o.sroubK.hlava / 2 + 2);
        if (kolize) o.vynechanoDir++; else o.dirKruzitka.push({ R, x: B[0], y: B[1] });
      }
      o.rd = rd;
    }
    // vývod na hadici: pata za obrysem patky frézky, drážka ve spodní ploše od středu k patě
    if (p.vyvod.zapnuto) {
      const v = p.vyvod, h = BOT.hrdlo(v), a = rad(v.sklon), sa = Math.sin(a), ca = Math.cos(a), cot = ca / Math.max(sa, 1e-6);
      o.h = h; o.alfa = a; o.u = [Math.cos(rad(v.natoceni)), Math.sin(rad(v.natoceni))];
      const dosah = Math.max(...o.obrysy.map(P => paprsek(P, o.u)));
      const minOd = Math.max(o.Rstred + 2 + h.rb / sa, pd.patka / 2 + 1 + h.roMax / sa - o.t * cot);
      const maxDo = dosah - 3 - h.rb / sa;
      o.vyvodMeze = [minOd, maxDo];
      if (minOd > maxDo) o.chyby.push({ druh: 'vyvod', chybi: minOd - maxDo });
      o.rp = minOd;
      o.base = [o.u[0] * o.rp, o.u[1] * o.rp, 0];
      o.sO = -(h.roMax * ca + 0.3) / Math.max(sa, 0.05); o.sB = o.sO - 1;
      o.sN = (o.t + 2 + (h.roMax + 2) * ca) / Math.max(sa, 0.05);
      o.sE = o.sN + v.delka;
      o.usti = [o.base[0] + o.u[0] * ca * o.sE, o.base[1] + o.u[1] * ca * o.sE, sa * o.sE];
    }
    // trn
    const tr = p.trn;
    o.trn = { r0: tr.dMin / 2, r1: tr.dMax / 2, rs: (tr.stopka - tr.vule) / 2 };
    o.trn.Lk = (o.trn.r1 - o.trn.r0) / Math.tan(rad(tr.uhel));
    o.trn.zs = o.trn.Lk + Math.max(0, o.trn.r1 - o.trn.rs);    // začátek stopky
    o.trn.ztop = o.trn.zs + tr.delkaStopky;
    o.trnCil = p.dily.krouzek ? o.kr.d : pd.otvor === 'prosty' ? pd.prumerOtvoru : 2 * o.Rotvor;
    return o;
  }

  /* ---------------- výpočty pro frézování podle šablony ---------------- */
  /** Odsazení šablony a max. fréza pro kroužek Ø D s průchodem d; Df = fréza. Shodné se Šablonami pro horní frézku. */
  function odsazeni(D, d, Df) {
    const o = (D - Df) / 2;
    return { o, maxFreza: Math.floor((d - 1) * 2) / 2, otvorSablony: 2 * o, projde: Df <= d - 1 };
  }
  /** Sada kroužků od–do s krokem; průchod drží stejnou stěnu jako zadaný kroužek. */
  function sada(p) {
    const v = p.vypocty, stena = (p.krouzek.vnejsi - p.krouzek.vnitrni) / 2, out = [];
    const a = Math.min(v.sadaOd, v.sadaDo), b = Math.max(v.sadaOd, v.sadaDo);
    for (let i = 0; a + i * v.sadaKrok <= b + 1e-6 && i < 40; i++) {
      const D = Math.round((a + i * v.sadaKrok) * 100) / 100, d = Math.max(2, Math.round((D - 2 * stena) * 100) / 100);
      out.push(Object.assign({ D, d }, odsazeni(D, d, v.freza), { kolize: kolizeKrouzku(p, D, d) }));
    }
    return out;
  }
  /** Proč kroužek Ø D nejde do zadaného rozhraní (null = jde). */
  function kolizeKrouzku(p, D, d) {
    const r = p.rozhrani, s = SROUBY[r.sroub], R = (D + p.krouzek.korekce) / 2;
    if (d / 2 > R - 1.2) return 'tenká stěna';
    if (R > r.priruba / 2 - 1.5) return 'větší než příruba';
    if (r.typ === 'srouby' && r.roztec / 2 - s.hlava / 2 < R + 0.8) return 'zakryje hlavy šroubů';
    if (r.typ === 'matice' && d / 2 > r.krk / 2 - 0.45 * r.stoupani - 1.2) return 'průchod širší než krk';
    return null;
  }
  /** Kružítko: poloměr kruhu pro díru R a frézu Df – kotouč (zůstane vnitřek) a otvor (zůstane okolí). */
  const kruzitkoKruh = (R, Df) => ({ kotouc: R - Df / 2, otvor: R + Df / 2 });

  /* ---------------- kontroly ---------------- */
  function kontroly(p) {
    const H = [], o = odvozene(p), k = p.krouzek, r = p.rozhrani, pd = p.podlozka, v = p.vypocty, D = p.dily;
    const chyba = (pole, text, oprava) => H.push({ uroven: 'chyba', pole, text, oprava });
    const var_ = (pole, text, oprava) => H.push({ uroven: 'varovani', pole, text, oprava });
    const info = (pole, text) => H.push({ uroven: 'info', pole, text });
    const opr = (c, h, des = 1) => ({ zmeny: { [c]: Math.round(h * 10 ** des) / 10 ** des } });
    const mat = MATERIALY[p.tisk.material];
    if (!D.krouzek && !D.podlozka && !D.trn) chyba(['dily.krouzek'], 'Není vybraný žádný díl k tisku.', { zmeny: { 'dily.krouzek': true } });
    for (const ch of o.chyby) {
      if (ch.druh === 'body') chyba(['podlozka.body'], `Obvod podložky: ${ch.text}.`);
      if (ch.druh === 'vyvod') chyba(['vyvod.prumer', 'podlozka.prumer', 'madlo.zapnuto'], `Vývod Ø ${fmt(p.vyvod.prumer)} se nevejde mezi patku frézky a okraj podložky – chybí ${fmt(ch.chybi, 1)} mm. Zapněte prodloužení s madlem ve směru vývodu, zvětšete podložku nebo zmenšete hadici.`,
        p.madlo.zapnuto ? opr('madlo.delka', p.madlo.delka + Math.ceil(ch.chybi + 5), 0) : { zmeny: { 'madlo.zapnuto': true, 'madlo.natoceni': p.vyvod.natoceni } });
    }
    // kroužek
    if (D.krouzek) {
      const kr = o.kr, ods = odsazeni(kr.Dv, kr.d, v.freza);
      if (kr.stena < 1.2) chyba(['krouzek.vnitrni', 'krouzek.vnejsi'], `Stěna límce ${fmt(kr.stena, 2)} mm je na tisk moc tenká (aspoň 1,2 mm, lépe 2).`, opr('krouzek.vnitrni', kr.Dv - 4));
      else if (kr.stena < 1.8) var_(['krouzek.vnitrni'], `Stěna límce ${fmt(kr.stena, 2)} mm je tenká – límec se o šablonu obrousí nebo praskne. Doporučeno aspoň 2 mm.`, opr('krouzek.vnitrni', kr.Dv - 4));
      if (!ods.projde) chyba(['vypocty.freza', 'krouzek.vnitrni'], `Fréza Ø ${fmt(v.freza, 2)} neprojde průchodem Ø ${fmt(kr.d, 2)} – potřebuje aspoň 0,5 mm vůle na stranu (průchod ≥ ${fmt(v.freza + 1, 1)} mm).`,
        kr.Dv - v.freza - 1 >= 2.4 ? opr('krouzek.vnitrni', v.freza + 1) : opr('krouzek.vnejsi', v.freza + 5));
      else if (kr.d - v.freza < 2) info(['krouzek.vnitrni'], `Mezi frézou a průchodem zbývá ${fmt((kr.d - v.freza) / 2, 2)} mm na stranu – kroužek musí být přesně vystředěný (centrovací trn).`);
      if (k.limec > v.sablona - 0.5) chyba(['krouzek.limec', 'vypocty.sablona'], `Límec ${fmt(k.limec, 1)} mm je delší než šablona ${fmt(v.sablona, 1)} mm – kroužek by drhl o obrobek. Nechte aspoň 0,5 mm rezervu.`, opr('krouzek.limec', Math.max(1, v.sablona - 1)));
      else if (k.limec < Math.min(3, v.sablona * 0.4)) var_(['krouzek.limec'], `Límec ${fmt(k.limec, 1)} mm je krátký – v šabloně ${fmt(v.sablona, 1)} mm se může svézt přes hranu.`, opr('krouzek.limec', Math.min(v.sablona - 1, Math.max(3, v.sablona * 0.6))));
      if (kr.R > o.Rp - 1.5) chyba(['krouzek.vnejsi', 'rozhrani.priruba'], `Límec Ø ${fmt(kr.Dv, 2)} je stejně velký jako příruba Ø ${fmt(r.priruba, 1)} – zvětšete přírubu.`, opr('rozhrani.priruba', Math.ceil(kr.Dv + 6), 0));
      if (r.typ === 'srouby') {
        const s = o.sroubK;
        if (r.roztec / 2 - s.hlava / 2 < kr.R + 0.8) { const a = autoRozhrani(kr.Dv); chyba(['rozhrani.roztec', 'krouzek.vnejsi'], `Hlavy šroubů ${s.nazev} na rozteči Ø ${fmt(r.roztec, 1)} zasahují do límce Ø ${fmt(kr.Dv, 1)} – kroužek je pro toto rozhraní velký (zvolte větší rozteč nebo jiný systém).`, { text: 'rozhraní pro vlastní podložku', zmeny: { 'rozhrani.priruba': a.priruba, 'rozhrani.roztec': a.roztec, 'rozhrani.sroub': 'M3', 'rozhrani.typ': 'srouby' } }); }
        if (r.roztec / 2 + s.hlava / 2 > o.Rp - 0.8) chyba(['rozhrani.roztec', 'rozhrani.priruba'], `Hlavy šroubů přesahují přírubu Ø ${fmt(r.priruba, 1)} – zvětšete ji.`, opr('rozhrani.priruba', Math.ceil(r.roztec + s.hlava + 2), 0));
        if (o.tp < o.zahloubeniK + 0.8) chyba(['rozhrani.tlPriruby', 'rozhrani.sroub'], `Příruba ${fmt(o.tp, 1)} mm je na zápustnou hlavu ${s.nazev} tenká (zahloubení ${fmt(o.zahloubeniK, 1)} mm + 0,8).`, opr('rozhrani.tlPriruby', Math.ceil((o.zahloubeniK + 0.8) * 10) / 10));
      } else {
        const stenaKrku = o.Rk - o.z.h - kr.rb;
        if (stenaKrku < 1.2) chyba(['rozhrani.krk', 'krouzek.vnitrni'], `Stěna krku pod závitem je ${fmt(stenaKrku, 2)} mm – zvětšete krk nebo zmenšete průchod.`, opr('rozhrani.krk', Math.ceil(2 * (kr.rb + 1.6 + o.z.h))));
        if (o.Rk > o.Rp - 0.5) chyba(['rozhrani.krk', 'rozhrani.priruba'], 'Krk je širší než příruba – příruba nemá o co dosednout.', opr('rozhrani.priruba', Math.ceil(r.krk + 4), 0));
        if (o.w > o.t - o.tp - 1) chyba(['podlozka.tloustka', 'rozhrani.krk'], `Kužel mezi krkem a přírubou (${fmt(o.w, 1)} mm) se nevejde do podložky ${fmt(o.t, 1)} mm nad zahloubením.`, opr('podlozka.tloustka', Math.ceil(o.tp + o.w + 1.5)));
        if (r.stenaMatice < 2.4) var_(['rozhrani.stenaMatice'], `Stěna matice ${fmt(r.stenaMatice, 1)} mm je tenká – při utažení praskne.`, opr('rozhrani.stenaMatice', 3));
        if (r.vyskaMatice < 3 * r.stoupani) var_(['rozhrani.vyskaMatice'], `Matice má jen ${fmt(r.vyskaMatice / r.stoupani, 1)} závitu – aspoň 3 (výška ≥ ${fmt(3 * r.stoupani, 1)} mm).`, opr('rozhrani.vyskaMatice', 3 * r.stoupani));
        info(['rozhrani.krk'], `Přechod krku do příruby je kužel 45° (${fmt(o.w, 1)} mm) – tiskne se bez podpor. Do cizí patky srazte hranu otvoru 45° × ${fmt(o.w, 1)} mm záhlubníkem.`);
      }
      if (Math.abs(k.korekce) > 0.4) var_(['krouzek.korekce'], `Korekce ${fmt(k.korekce, 2)} mm je velká – zkontrolujte tiskárnu (průtok, smrštění) kalibračními měrkami.`);
      if (mat.tg < 70) var_(['tisk.material'], `${mat.nazev} měkne už kolem ${mat.tg} °C – límec se o šablonu tře a hřeje, kroužek se zdeformuje. Použijte PETG, ASA nebo PC.`, { zmeny: { 'tisk.material': 'PETG' } });
      info(['krouzek.vnejsi'], 'Tištěný kroužek je na kusovou práci. Na sériové frézování, velké frézky nad 1,5 kW a šablony z MDF/hliníku je trvanlivější kovový kroužek (mosaz, hliník) – rozměry z výkresu platí i pro něj.');
    }
    // podložka
    if (D.podlozka) {
      const zk = o.zaklad, Rs = o.Rstred;
      if (o.t < 5) var_(['podlozka.tloustka'], `Podložka ${fmt(o.t, 1)} mm se pod váhou frézky prohne – doporučeno 6–8 mm.`, opr('podlozka.tloustka', 6));
      if (pd.otvor === 'krouzky' && o.t < o.tp + 1.6) chyba(['podlozka.tloustka', 'rozhrani.tlPriruby'], `Nad zahloubením pro přírubu (${fmt(o.tp, 1)} mm) zbývá jen ${fmt(o.t - o.tp, 1)} mm podložky.`, opr('podlozka.tloustka', Math.ceil(o.tp + 3)));
      if (pd.otvor === 'krouzky' && !o.matice && o.Rotvor < o.kr.rb + 0.5) chyba(['rozhrani.roztec'], 'Otvor v podložce nad přírubou je užší než průchod kroužku – šrouby příruby jsou moc blízko osy.');
      if (rezerva(zk, [0, 0], Rs) < 8) chyba(['podlozka.prumer', 'podlozka.tvar'], `Středový otvor Ø ${fmt(2 * Rs, 1)} se nevejde do podložky (od okraje zbývá ${fmt(Math.max(0, rezerva(zk, [0, 0], Rs)), 1)} mm, potřeba aspoň 8).`);
      if (pd.otvor === 'prosty' && D.krouzek) info(['podlozka.otvor'], 'Podložka má jen otvor – kroužek se do ní neuloží (rozhraní platí pro cizí patku).');
      if (pd.pocet > 0) {
        const s = o.sroubP;
        if (o.t < o.zahloubeniP + 1) chyba(['podlozka.tloustka', 'podlozka.sroub'], `Zápustná hlava ${s.nazev} (${fmt(o.zahloubeniP, 1)} mm) se nevejde do podložky ${fmt(o.t, 1)} mm.`, opr('podlozka.tloustka', Math.ceil(o.zahloubeniP + 1.5)));
        if (pd.roztec / 2 - s.hlava / 2 < Rs + 1.5) chyba(['podlozka.roztec'], `Šrouby patky na rozteči Ø ${fmt(pd.roztec, 1)} zasahují do středového otvoru.`, opr('podlozka.roztec', Math.ceil(2 * (Rs + 2) + s.hlava)));
        const spatne = o.sroubyP.filter(b => rezerva(zk, b, s.hlava / 2) < 2).length;
        if (spatne) chyba(['podlozka.roztec', 'podlozka.prumer'], `${spatne} z ${pd.pocet} šroubů patky vychází mimo podložku nebo k okraji (méně než 2 mm).`);
        if (pd.patka && pd.roztec + s.hlava > pd.patka + 0.5) var_(['podlozka.patka', 'podlozka.roztec'], `Rozteč šroubů Ø ${fmt(pd.roztec, 1)} je větší než patka frézky Ø ${fmt(pd.patka, 1)} – šrouby nemají kam zašroubovat.`);
        if (D.krouzek && r.typ === 'srouby' && pd.otvor === 'krouzky') for (const b of o.sroubyK) for (const q of o.sroubyP) if (Math.hypot(b[0] - q[0], b[1] - q[1]) < (o.sroubK.hlava + s.hlava) / 2 + 1) { chyba(['podlozka.natoceni'], 'Šroub kroužku se kříží se šroubem patky – pootočte šrouby patky.', opr('podlozka.natoceni', pd.natoceni + 180 / pd.pocet)); break; }
      } else info(['podlozka.pocet'], 'Podložka bez šroubů patky – otvory si vyvrtáte podle původní podložky (výkres 1:1 ukáže střed).');
      if (pd.tvar === 'D' && pd.rovna >= pd.prumer / 2 - 1) info(['podlozka.rovna'], 'Rovná hrana je dál než okraj kruhu – podložka je celý kruh.');
      if (pd.tvar === 'D' && pd.rovna < Rs + 10) var_(['podlozka.rovna'], `Rovná hrana je jen ${fmt(pd.rovna - Rs, 1)} mm od středového otvoru.`);
      if (p.madlo.zapnuto) {
        if (p.madlo.delka > 180) info(['madlo.delka'], `Prodloužení ${fmt(p.madlo.delka)} mm: tištěná deska se pod tlakem na madlo prohýbá – u delší desky ji podložte hliníkovým profilem nebo vyřízněte z překližky / plexi podle výkresu 1:1.`);
        if (p.madlo.delka < pd.patka / 2 + p.madlo.prumer / 2 + 5 && p.madlo.vyska > 0) var_(['madlo.delka'], 'Madlo leží pod patkou frézky – prodlužte desku.', opr('madlo.delka', Math.ceil(pd.patka / 2 + p.madlo.prumer / 2 + 15), 0));
      }
      if (p.kruzitko.zapnuto) {
        const kz = p.kruzitko;
        if (!o.dirKruzitka.length) chyba(['kruzitko.od'], 'Kružítko nemá žádnou použitelnou díru (všechny padly do otvoru nebo ke šroubům).', opr('kruzitko.od', Math.ceil(o.Rstred + 10), 0));
        else if (o.vynechanoDir) info(['kruzitko.od'], `${o.vynechanoDir} děr kružítka vynecháno (střed nebo šrouby) – nejmenší poloměr ${fmt(o.dirKruzitka[0].R)} mm.`);
        if (o.dirKruzitka.length > 80) var_(['kruzitko.krok'], `${o.dirKruzitka.length} děr kružítka – zvětšete krok.`);
        if (kz.sirka < kz.cep + 10) var_(['kruzitko.sirka'], 'Rameno kružítka je kolem děr úzké.', opr('kruzitko.sirka', kz.cep + 16, 0));
        if (Math.max(kz.od, kz.do) > 200) info(['kruzitko.do'], 'Dlouhé tištěné rameno pruží – poloměr kruhu kontrolujte na odřezku; na velké kruhy je tužší rameno z překližky (vrtat podle výkresu 1:1).');
      }
      if (p.vyvod.zapnuto && !o.chyby.some(c => c.druh === 'vyvod')) {
        const vv = p.vyvod;
        if (vv.sklon < 90 - p.tisk.uhel - 0.5) var_(['vyvod.sklon'], `Vývod se sklonem ${fmt(vv.sklon)}° od vodorovné převisá víc než ${fmt(p.tisk.uhel)}° – sklon aspoň ${fmt(90 - p.tisk.uhel)}°.`, opr('vyvod.sklon', 90 - p.tisk.uhel, 0));
        if (vv.hloubka > o.t - 2) chyba(['vyvod.hloubka', 'podlozka.tloustka'], `Drážka ${fmt(vv.hloubka, 1)} mm je na podložku ${fmt(o.t, 1)} mm hluboká.`, opr('vyvod.hloubka', Math.max(1, o.t - 2.5)));
        if (vv.drazka > 2 * o.h.rb) info(['vyvod.drazka'], 'Drážka je širší než otvor vývodu.');
        if (p.madlo.zapnuto && p.madlo.vyska > 0 && o.madloBod) {
          // půdorys hrdla = úsečka pata → ústí, polovina šířky roMax; madlo nesmí zasahovat
          const A = o.base, B = o.usti, ex = B[0] - A[0], ey = B[1] - A[1], M = o.madloBod;
          const tt = Math.max(0, Math.min(1, ((M[0] - A[0]) * ex + (M[1] - A[1]) * ey) / (ex * ex + ey * ey || 1)));
          const dist = Math.hypot(A[0] + tt * ex - M[0], A[1] + tt * ey - M[1]), treba = p.madlo.prumer / 2 + o.h.roMax + 2;
          if (dist < treba) {
            const konec = Math.hypot(B[0], B[1]) + o.h.roMax * Math.sin(o.alfa) + p.madlo.prumer / 2 + 3;
            chyba(['madlo.delka', 'madlo.natoceni', 'vyvod.natoceni'], `Madlo překáží hrdlu vývodu (mezera ${fmt(Math.max(0, dist - p.madlo.prumer / 2 - o.h.roMax), 1)} mm) – posuňte madlo dál nebo vývod pootočte.`, opr('madlo.delka', Math.ceil(konec), 0));
          }
        }
        if (vv.delka < 15) var_(['vyvod.delka'], `Hrdlo ${fmt(vv.delka)} mm je krátké – hadice nebude držet.`, opr('vyvod.delka', 20, 0));
        const prekryti = o.sroubyP.some(q => { const t = q[0] * o.u[0] + q[1] * o.u[1], n = Math.abs(-q[0] * o.u[1] + q[1] * o.u[0]); return t > o.Rstred && t < o.rp + o.h.rb && n < vv.drazka / 2 + o.sroubP.hlava / 2 + 1; });
        if (prekryti) chyba(['vyvod.natoceni', 'podlozka.natoceni'], 'Odsávací drážka vede přes šroub patky – pootočte vývod nebo šrouby.', opr('vyvod.natoceni', p.vyvod.natoceni + 180 / Math.max(1, pd.pocet), 0));
      }
      if (mat.tg < 70 && !D.krouzek) var_(['tisk.material'], `${mat.nazev} měkne kolem ${mat.tg} °C – u motoru frézky se podložka zdeformuje. Použijte PETG nebo ASA.`, { zmeny: { 'tisk.material': 'PETG' } });
    }
    // trn
    if (D.trn) {
      const tr = p.trn, t = o.trn;
      if (tr.dMin >= tr.dMax - 2) chyba(['trn.dMin', 'trn.dMax'], 'Kužel trnu musí mít dole menší průměr než nahoře (aspoň o 2 mm).', opr('trn.dMax', tr.dMin + 10));
      else if (o.trnCil <= tr.dMin || o.trnCil >= tr.dMax) chyba(['trn.dMin', 'trn.dMax'], `Kužel Ø ${fmt(tr.dMin, 1)}–${fmt(tr.dMax, 1)} nevystředí otvor Ø ${fmt(o.trnCil, 1)} – musí ležet mezi nimi.`,
        { zmeny: { 'trn.dMin': Math.max(1, Math.floor(o.trnCil - 6)), 'trn.dMax': Math.ceil(o.trnCil + 6) } });
      if (t.rs - 0 < 1.2) chyba(['trn.stopka'], 'Stopka trnu je moc tenká.');
      if (tr.vule < 0) var_(['trn.vule'], 'Stopka je větší než jmenovitý průměr – do kleštiny půjde ztuha.');
      info(['trn.stopka'], 'Trn je jen na vystředění: upněte ho do kleštiny lehce, frézku spusťte dolů, kuželem vystřeďte otvor, utáhněte šrouby a trn vyndejte. Motor s trnem NIKDY nezapínejte.');
      if (!STOPKY.some(s => Math.abs(s - tr.stopka) < 0.01)) info(['trn.stopka'], `Stopka Ø ${fmt(tr.stopka, 2)} není běžná kleština (6, 1/4″, 8, 12, 1/2″).`);
    }
    if (p.tisk.uhel > 60) info(['tisk.uhel'], 'Převis nad 60° od svislice zvládne jen málokterá tiskárna.');
    return H.filter(h => h.text);
  }

  /* ---------------- stavba těles ---------------- */
  /** Sestaví díly přes manifold-3d → {dily, vizual, kalibrace, sada, o, obrysPodlozky, cas}. volby: {kalibrace, sada, vizual}. */
  function postav(w, p, volby = {}) {
    const t0 = Date.now(), o = odvozene(p);
    if (o.chyby.length) throw new Error('rozměry nejdou sestavit (' + o.chyby.map(c => c.druh).join(', ') + ')');
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const segmenty = r => Math.max(32, Math.min(160, Math.ceil(2 * Math.PI * r / 1.0 / 4) * 4));
    const valec = (r, z0, z1, x = 0, y = 0, n) => k(k(M.cylinder(z1 - z0, r, r, n || segmenty(r))).translate([x, y, z0]));
    const kuzel = (r0, r1, z0, z1, x = 0, y = 0) => k(k(M.cylinder(z1 - z0, r0, r1, segmenty(Math.max(r0, r1)))).translate([x, y, z0]));
    const kvadr = (x0, y0, z0, x1, y1, z1) => k(k(M.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    const otoc = body => k(k(new CS([body], 'Positive')).revolve(segmenty(Math.max(...body.map(q => q[0])))));
    const rozdil = (a, b) => (b.length ? k(M.difference([a, ...b])) : a);
    const sjednot = a => (a.length > 1 ? k(M.union(a)) : a[0]);
    const r = p.rozhrani;

    /** Kroužek Ø D / d se zvoleným rozhraním (souřadnice sestavy). */
    function krouzek(kr) {
      const { R, rb, L, c, tp } = kr, Rp = o.Rp;
      const plne = [], odeb = [];
      const dole = [[rb, -L], [R - c, -L], [R, -L + c], [R, 0], [Rp, 0], [Rp, tp]];
      if (!o.matice) plne.push(otoc(dole.concat([[rb, tp]])));
      else {
        const zc = tp + o.w, zt = tp + o.Hn;
        if (r.tisknoutZavit) {
          plne.push(otoc(dole.concat([[o.Rk, zc], [rb, zc]])));
          const n = Math.max(48, Math.min(144, Math.ceil(2 * Math.PI * o.Rk / 0.9 / 4) * 4));
          plne.push(k(k(ZG.zavitovaTyc(w, k, o.z, zt - zc + 0.02, n, 'nahore')).translate([0, 0, zc - 0.02])));
        } else plne.push(otoc(dole.concat([[o.Rk, zc], [o.Rk, zt - 0.6], [o.Rk - 0.6, zt], [rb, zt]])));
      }
      for (const [x, y] of o.sroubyK) {
        const s = o.sroubK;
        odeb.push(valec(s.otvor / 2, -1, tp + 1, x, y, 24));
        odeb.push(kuzel(s.hlava / 2 + 0.2, s.otvor / 2, -0.2, o.zahloubeniK, x, y));
      }
      odeb.push(valec(rb, -L - 1, tp + (o.matice ? o.Hn : 0) + 1));
      return rozdil(sjednot(plne), odeb);
    }

    try {
      const dily = [], vizual = [], kalibrace = [], sadaDily = [];
      let obrysPodlozky = null;
      /* ---- kroužek a matice ---- */
      if (p.dily.krouzek) {
        dily.push(Object.assign(sit(k, krouzek(o.kr), 'krouzek', `Kroužek Ø ${fmt(o.kr.Dv, 2)}`, '#E88A2E'), { otocit: true },
          o.matice && r.tisknoutZavit ? { pasZavitu: [o.Rk - o.z.h - 0.05, o.Rk + 0.35] } : {}));
        if (o.matice && r.tisknoutZavit) {   // hladký krk = závit čelistí a kovová matice
          const hm = r.vyskaMatice, z0 = o.t;
          let mat = valec(o.Rm, 0, hm);
          const odeb = [];
          const zv = Object.assign({}, o.z, { rMaj: o.Rmv });
          const n = Math.max(48, Math.min(144, Math.ceil(2 * Math.PI * o.Rmv / 0.9 / 4) * 4));
          odeb.push(k(k(ZG.zavitovaTyc(w, k, zv, hm + 2, n, null)).translate([0, 0, -1])));
          odeb.push(kuzel(o.Rmv + 0.4, o.Rmv - zv.h, -0.01, zv.h + 0.4), kuzel(o.Rmv - zv.h, o.Rmv + 0.4, hm - zv.h - 0.4, hm + 0.01));
          const nz = Math.max(6, Math.round(2 * Math.PI * o.Rm / 6));
          for (let i = 0; i < nz; i++) { const a = 2 * Math.PI * i / nz; odeb.push(valec(1.2, -1, hm + 1, o.Rm * Math.cos(a), o.Rm * Math.sin(a), 16)); }
          mat = rozdil(mat, odeb);
          dily.push(Object.assign(sit(k, k(mat.translate([0, 0, z0])), 'matice', 'Matice kroužku', '#C0612B'), { pasZavitu: [o.Rmv - zv.h - 0.05, o.Rmv + 0.45] }));
        }
      }
      /* ---- podložka ---- */
      if (p.dily.podlozka) {
        const pd = p.podlozka, t = o.t;
        const cs = k(CS.union(o.obrysy.map(P => k(new CS([P], 'Positive')))));
        obrysPodlozky = cs.toPolygons();
        const plne = [k(k(cs.extrude(t)))];
        const odeb = [];
        if (p.madlo.zapnuto && p.madlo.vyska > 0) {
          const m = p.madlo, rm = m.prumer / 2, c = Math.min(2, rm / 3);
          const [x, y] = o.madloBod;
          plne.push(k(otoc([[0, t - 0.01], [rm, t - 0.01], [rm, t + m.vyska - c], [rm - c, t + m.vyska], [0, t + m.vyska]]).translate([x, y, 0])));
        }
        let hrdloVrt = null;
        if (p.vyvod.zapnuto) {
          const v = p.vyvod, prof = BOT.profilHrdla(o.h, o.sO, o.sB, o.sN, o.sE);
          const hrdlo = pr => k(k(k(otoc(pr).rotate([0, 90 - v.sklon, 0])).rotate([0, 0, v.natoceni])).translate(o.base));
          plne.push(k(hrdlo(prof.ven).intersect(kvadr(-4000, -4000, 0, 4000, 4000, 4000))));
          hrdloVrt = hrdlo(prof.vrt);
          odeb.push(hrdloVrt);
          // drážka ve spodní ploše od osy k patě vývodu
          odeb.push(k(kvadr(0, -v.drazka / 2, -1, o.rp, v.drazka / 2, v.hloubka).rotate([0, 0, v.natoceni])));
        }
        let telo = sjednot(plne);
        // středový otvor / uložení kroužku
        if (pd.otvor === 'krouzky') {
          odeb.push(valec(o.Rc, -1, o.tp));
          if (o.matice) { odeb.push(kuzel(o.Rc, o.Rotvor, o.tp - 0.01, o.tp + (o.Rc - o.Rotvor))); odeb.push(valec(o.Rotvor, -1, t + 1)); }
          else {
            odeb.push(valec(o.Rotvor, -1, t + 1));
            for (const [x, y] of o.sroubyK) odeb.push(valec(o.sroubK.jadro / 2, o.tp - 0.5, t + 1, x, y, 20));
          }
        } else odeb.push(valec(o.Rotvor, -1, t + 1));
        for (const [x, y] of o.sroubyP) {
          const s = o.sroubP;
          odeb.push(valec(s.otvor / 2, -1, t + 1, x, y, 24));
          odeb.push(kuzel(s.hlava / 2 + 0.2, s.otvor / 2, -0.2, o.zahloubeniP, x, y));
        }
        for (const d of o.dirKruzitka) odeb.push(valec(o.rd, -1, t + 1, d.x, d.y, 24));
        telo = rozdil(telo, odeb);
        dily.push(sit(k, telo, 'podlozka', 'Podložka', '#2F5FA8'));
        if (p.kruzitko.zapnuto) {
          const kz = p.kruzitko, rc = kz.cep / 2, h = t + 8, c = Math.min(0.6, rc / 3);
          const cep = otoc([[0, 0], [rc - c, 0], [rc, c], [rc, h - c], [rc - c, h], [0, h]]);
          const d0 = o.dirKruzitka[0];
          dily.push(sit(k, k(cep.translate([d0 ? d0.x : 0, d0 ? d0.y : 0, -8])), 'cep', 'Čep kružítka', '#5BAF5B'));
        }
      }
      /* ---- centrovací trn (v sestavě zvednutý nad podložkou, špička dolů) ---- */
      if (p.dily.trn) {
        const T = o.trn, c = Math.min(0.5, T.rs / 3), body = [[0, 0], [T.r0, 0], [T.r1, T.Lk]];
        if (T.r1 > T.rs) body.push([T.rs, T.zs]); else body.push([T.rs, T.Lk]);
        body.push([T.rs, T.ztop - c], [T.rs - c, T.ztop], [0, T.ztop]);
        const zdvih = (p.dily.podlozka ? o.t : 0) + 25;
        dily.push(Object.assign(sit(k, k(otoc(body).translate([0, 0, zdvih])), 'trn', 'Centrovací trn', '#8E5BB5'), { otocit: true }));
      }
      /* ---- vizualizace: fréza ---- */
      if (volby.vizual !== false && (p.dily.krouzek || p.dily.podlozka)) {
        const Df = p.vypocty.freza, zd = p.dily.krouzek ? -o.kr.L - 4 : -6;
        vizual.push(sit(k, valec(Df / 2, zd, o.t + 30, 0, 0, 32), 'freza', `Fréza Ø ${fmt(Df, 1)}`, '#8a9099'));
      }
      /* ---- kalibrační měrky: 5 nízkých kroužků s Ø −2 až +2 kroky (počet zářezů = číslo měrky) ---- */
      if (volby.kalibrace) {
        const krok = p.tisk.krokKalibrace, h = 4;
        for (let i = 0; i < 5; i++) {
          const R = (o.kr.Dv + (i - 2) * krok) / 2, rb = Math.min(o.kr.rb, R - 1.6);
          let m = otoc([[rb, 0], [R, 0], [R, h], [rb, h]]);
          const zar = [];
          for (let j = 0; j <= i; j++) zar.push(k(kvadr(rb - 1, -0.45, h - 0.8, R + 1, 0.45, h + 1).rotate([0, 0, 90 + j * 14])));
          m = rozdil(m, zar);
          kalibrace.push(sit(k, m, 'kal' + (i + 1), `Měrka ${i + 1} – Ø ${fmt(2 * R, 2)}`, '#E8B22E'));
        }
      }
      /* ---- sada kroužků ---- */
      if (volby.sada) {
        for (const s of sada(p)) {
          if (s.kolize) continue;
          sadaDily.push(Object.assign(sit(k, krouzek(rozmeryKrouzku(p, s.D, s.d)), 'sada_' + String(s.D).replace('.', '_'), `Kroužek Ø ${fmt(s.D + p.krouzek.korekce, 2)}`, '#E88A2E'), { otocit: true },
            o.matice && r.tisknoutZavit ? { pasZavitu: [o.Rk - o.z.h - 0.05, o.Rk + 0.35] } : {}));
        }
      }
      // průniky v sestavě (kroužek × podložka, matice × podložka) – měřeno na tělesech
      const prunik = {};
      const najdi = jm => dily.find(d => d.jmeno === jm);
      if (najdi('krouzek') && najdi('podlozka') && p.podlozka.otvor === 'krouzky') {
        const mk = k(meshNaManifold(w, najdi('krouzek'))), mp = k(meshNaManifold(w, najdi('podlozka')));
        prunik.krouzekPodlozka = k(mk.intersect(mp)).volume();
        if (najdi('matice')) prunik.maticePodlozka = k(k(meshNaManifold(w, najdi('matice'))).intersect(mp)).volume();
      }
      return { dily, vizual, kalibrace, sada: sadaDily, o, obrysPodlozky, prunik, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }
  const meshNaManifold = (w, d) => new w.Manifold(new w.Mesh({ numProp: 3, vertProperties: new Float32Array(d.poz), triVerts: new Uint32Array(d.idx) }));

  /** Manifold → síť pro náhled a export. */
  function sit(k, m0, jmeno, nazev, barva) {
    const m = k(m0.simplify(1e-3));
    const st = m.status();
    if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
    if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
    const kusy = m.decompose().map(k);
    return { jmeno, nazev, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), teles: kusy.filter(x => x.volume() > 1e-3).length, barva, otocit: false };
  }

  /** Převisy a mosty dílu v tiskové poloze (mm²); boky šroubovice závitu (pás poloměrů d.pasZavitu kolem osy dílu) se nepočítají –
      tisknou se běžně, jen fazety šroubovice vycházejí v rozboru strmější. */
  function previsy(d, uhel) {
    const tl = G.tiskoveRozlozeni([d])[0], P = tl.poz, I = tl.idx, T = G.tridyPrevisu(P, I, uhel), pas = d.pasZavitu;
    let previs = 0, most = 0, zavit = 0;
    for (let t = 0; t < T.length; t++) {
      if (T[t] !== 1 && T[t] !== 2) continue;
      const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const A = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
      if (pas && [a, b, c].every(q => { const rr = Math.hypot(d.poz[q], d.poz[q + 1]); return rr >= pas[0] && rr <= pas[1]; })) { zavit += A; continue; }
      if (T[t] === 1) most += A; else previs += A;
    }
    return { previs, most, zavit };
  }

  function kontrolyModelu(p, model) {
    const H = [], pr = model.prunik;
    if (pr.krouzekPodlozka > 1) H.push({ uroven: 'chyba', pole: ['rozhrani.vule', 'rozhrani.priruba'], text: `Kroužek a podložka se v sestavě prolínají (${fmt(pr.krouzekPodlozka, 0)} mm³) – zkontrolujte rozhraní.` });
    if (pr.maticePodlozka > 1) H.push({ uroven: 'chyba', pole: ['podlozka.tloustka'], text: 'Matice se prolíná s podložkou.' });
    const X = p.tisk.podlozkaX, Y = p.tisk.podlozkaY;
    for (const d of model.dily.concat(model.kalibrace)) {
      if (d.teles > 1) H.push({ uroven: 'chyba', pole: null, text: `${d.nazev}: díl se rozpadl na ${d.teles} tělesa – některá část není spojená.` });
      const b = G.obal(G.tiskoveRozlozeni([d])[0].poz);
      const r = previsy(d, p.tisk.uhel);
      if (r.previs > 3) H.push({ uroven: 'varovani', pole: ['tisk.uhel'], text: `${d.nazev}: převisy nad ${fmt(p.tisk.uhel)}° od svislice ${fmt(r.previs, 0)} mm² – v tom místě může potřebovat podpory.` });
      if (r.most > 1) H.push({ uroven: 'info', pole: null, text: `${d.nazev}: tiskárna přemostí ${fmt(r.most, 0)} mm² vodorovného stropu (zahloubení, drážka).` });
      const sx = b[3] - b[0], sy = b[4] - b[1];
      if (Math.min(Math.max(sx, sy) - Math.max(X, Y), Math.min(sx, sy) - Math.min(X, Y)) > 0) H.push({ uroven: 'varovani', pole: ['tisk.podlozkaX', 'tisk.podlozkaY'], text: `${d.nazev} (${fmt(sx, 0)} × ${fmt(sy, 0)} mm) se nevejde na podložku tiskárny ${fmt(X, 0)} × ${fmt(Y, 0)} mm – zmenšete díl, nebo ho vyřízněte z desky podle výkresu 1:1.` });
    }
    return H;
  }

  /* ---------------- kusovník ---------------- */
  function kusovnik(p, o, model) {
    const mat = MATERIALY[p.tisk.material], r = [];
    const g = jm => { const d = model && model.dily.find(x => x.jmeno === jm); return d ? ` · ${fmt(d.objem / 1000 * mat.hustota, 0)} g` : ''; };
    if (p.dily.krouzek) {
      r.push([`Kopírovací kroužek Ø ${fmt(o.kr.Dv, 2)} / průchod Ø ${fmt(o.kr.d, 2)} (tisk)`, '1 ks', `${mat.nazev}${g('krouzek')}`]);
      if (o.matice && p.rozhrani.tisknoutZavit) r.push([`Matice kroužku závit ${fmt(p.rozhrani.krk, 1)} × ${fmt(p.rozhrani.stoupani, 2)} (tisk)`, '1 ks', `${mat.nazev}${g('matice')}`]);
      else if (o.matice) r.push([`Matice ${fmt(p.rozhrani.krk, 1)} × ${fmt(p.rozhrani.stoupani, 2)} (kovová)`, '1 ks', 'závit na hladký krk vyřízněte závitovou čelistí']);
      else if (p.podlozka.otvor === 'krouzky' || !p.dily.podlozka) r.push([`Šroub zápustný ${o.sroubK.nazev} × ${o.sroubK.d < 4 ? 8 : 10}`, `${p.rozhrani.pocet} ks`, p.dily.podlozka ? `do podložky – předvrtáno Ø ${fmt(o.sroubK.jadro, 1)}, závit vyřízněte nebo samořezný` : 'do patky frézky']);
    }
    if (p.dily.podlozka) {
      r.push([`Podložka ${NAZVY.tvar[p.podlozka.tvar]}, tl. ${fmt(o.t, 1)} mm (tisk)`, '1 ks', `${mat.nazev}${g('podlozka')}`]);
      if (p.podlozka.pocet) r.push([`Šroub zápustný ${o.sroubP.nazev}`, `${p.podlozka.pocet} ks`, `do patky frézky – délka = ${fmt(o.t, 1)} mm + závit v patce (použijte původní)`]);
      if (p.kruzitko.zapnuto) r.push([`Čep kružítka Ø ${fmt(p.kruzitko.cep, 1)} (tisk) nebo hřeb / šroub Ø ${fmt(p.kruzitko.cep, 0)}`, '1 ks', `${o.dirKruzitka.length} děr R ${fmt(o.dirKruzitka.length ? o.dirKruzitka[0].R : 0)}–${fmt(o.dirKruzitka.length ? o.dirKruzitka[o.dirKruzitka.length - 1].R : 0)} mm`]);
      if (p.vyvod.zapnuto) r.push([p.vyvod.usazeni === 'zasun' ? `Hadice vysavače s koncovkou Ø ${fmt(p.vyvod.prumer)}` : `Hadice vnitřní Ø ${fmt(p.vyvod.prumer)}`, '–', 'nasadit na hrdlo vývodu']);
    }
    if (p.dily.trn) r.push([`Centrovací trn – stopka Ø ${fmt(p.trn.stopka, 2)}, kužel Ø ${fmt(p.trn.dMin, 1)}–${fmt(p.trn.dMax, 1)} (tisk)`, '1 ks', `${mat.nazev}${g('trn')}`]);
    return r;
  }

  /* ---------------- projekt ---------------- */
  function popis(p) {
    const c = [];
    if (p.dily.krouzek) c.push(`kroužek Ø ${fmt(p.krouzek.vnejsi, 2)}/${fmt(p.krouzek.vnitrni, 2)}`);
    if (p.dily.podlozka) c.push(`podložka ${p.podlozka.tvar === 'kruh' || p.podlozka.tvar === 'D' ? NAZVY.tvar[p.podlozka.tvar].split(' ')[0] + ' Ø ' + fmt(p.podlozka.prumer) : NAZVY.tvar[p.podlozka.tvar]}`);
    if (p.dily.trn) c.push(`trn – stopka Ø ${fmt(p.trn.stopka, 2)}`);
    return c.join(' · ') || '—';
  }
  const TYP = 'kopirovaci_krouzky';
  const ulozProjekt = p => G.projektJson(TYP, p, 1);
  const nactiProjekt = text => G.nactiProjektJson(text, TYP, normalizuj, 'Kopírovacích kroužků');

  const API = {
    MATERIALY, SROUBY, SYSTEMY, KROUZKY, STOPKY, NAZVY, VYCHOZI, MEZE, VYCTY, PREDVOLBY, HADICE: BOT.HADICE,
    normalizuj, predvolba, autoRozhrani, rozmeryKrouzku, odvozene, odsazeni, sada, kolizeKrouzku, kruzitkoKruh, kontroly,
    postav, previsy, kontrolyModelu, kusovnik, ctiBody, uvnitr, vzdalenost, paprsek, obalBodu, plocha,
    popis, ulozProjekt, nactiProjekt, kopie, vezmi: G.vezmi, poloz: G.poloz, fmt,
  };
  if (uzel) module.exports = API; else window.KROUZKY = API;
})();

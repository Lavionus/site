/* Návrh bateriového packu – výpočetní jádro bez DOM (test: _test/baterie_pack_test.js).
   Katalog článků, výpočet konfigurace SxP, návrh variant k cíli, doporučení (BMS, pojistka, vodiče, pásky),
   rozložení článků (mřížka / plástev) a držák článků pro 3D tisk přes manifold-3d (w = inicializovaný modul).
   Hodnoty článků a tabulky proudů jsou orientační (typické katalogové údaje), stav k 11/2026. */
(function () {
  'use strict';

  const VERZE = 1;
  const KLIC = 'webapp_baterie_pack';

  /* Ručně stárnoucí údaje: letecká přeprava (IATA DGR – lithium-iontové baterie u cestujících),
     orientační proudové tabulky. */
  const PARAMETRY = {
    rok: 2026,
    letadloBezSouhlasu: 100,      // Wh – v kabině bez souhlasu dopravce
    letadloSeSouhlasem: 160,      // Wh – se souhlasem dopravce (max. 2 náhradní), nad = zakázáno
    proudNikl: 5,                 // A/mm² – čistý nikl, krátký pásek, orientačně
    proudNiklOcel: 2.5,           // A/mm² – poniklovaná ocel
    rezervaBms: 1.25,             // BMS a pojistka ≥ 1,25 × trvalý proud
    tepelnaKapacita: 1000         // J/(kg·K) – článek Li-ion/LFP, orientačně
  };

  const CHEMIE = {
    nmc: { nazev: 'Li-ion NMC/NCA', lithium: true, bms: 'Li-ion (4,2 V/čl.)' },
    lfp: { nazev: 'LiFePO4 (LFP)', lithium: true, bms: 'LiFePO4 (3,65 V/čl.)' },
    lto: { nazev: 'LTO (titaničitan)', lithium: true, bms: 'LTO (2,8 V/čl.)' },
    nimh: { nazev: 'NiMH', lithium: false, bms: '' }
  };

  /* tvar: valec (d × h) | prizma (s × t × v, t = tloušťka) | pouch (s × t × v)
     U = jmenovité, Umax, Umin [V]; Ah; I = max. trvalý proud [A]; Ri [mΩ]; g [g]. */
  const PREDVOLBY = [
    { id: 'p18650-3000', nazev: '18650 NMC 3000 mAh (výkonový, např. 30Q)', chemie: 'nmc', tvar: 'valec', d: 18.4, h: 65, U: 3.6, Umax: 4.2, Umin: 2.5, Ah: 3.0, I: 15, Ri: 20, g: 48 },
    { id: 'p18650-3500', nazev: '18650 NMC 3500 mAh (kapacitní, např. MJ1)', chemie: 'nmc', tvar: 'valec', d: 18.4, h: 65, U: 3.6, Umax: 4.2, Umin: 2.5, Ah: 3.5, I: 10, Ri: 35, g: 49 },
    { id: 'p18650-lfp', nazev: '18650 LiFePO4 1500 mAh', chemie: 'lfp', tvar: 'valec', d: 18.3, h: 65, U: 3.2, Umax: 3.65, Umin: 2.5, Ah: 1.5, I: 4.5, Ri: 30, g: 41 },
    { id: 'p21700-5000', nazev: '21700 NMC 5000 mAh (kapacitní, např. 50E)', chemie: 'nmc', tvar: 'valec', d: 21.2, h: 70, U: 3.6, Umax: 4.2, Umin: 2.5, Ah: 4.9, I: 9.8, Ri: 25, g: 69 },
    { id: 'p21700-4000', nazev: '21700 NMC 4000 mAh (výkonový, např. 40T)', chemie: 'nmc', tvar: 'valec', d: 21.2, h: 70, U: 3.6, Umax: 4.2, Umin: 2.5, Ah: 4.0, I: 35, Ri: 12, g: 67 },
    { id: 'p26650-lfp', nazev: '26650 LiFePO4 3300 mAh', chemie: 'lfp', tvar: 'valec', d: 26.2, h: 65.4, U: 3.2, Umax: 3.65, Umin: 2.5, Ah: 3.3, I: 10, Ri: 15, g: 85 },
    { id: 'p26650-nmc', nazev: '26650 NMC 5000 mAh', chemie: 'nmc', tvar: 'valec', d: 26.2, h: 65.4, U: 3.6, Umax: 4.2, Umin: 2.75, Ah: 5.0, I: 10, Ri: 25, g: 93 },
    { id: 'p14500', nazev: '14500 Li-ion 800 mAh (velikost AA)', chemie: 'nmc', tvar: 'valec', d: 14.2, h: 50, U: 3.7, Umax: 4.2, Umin: 2.75, Ah: 0.8, I: 1.6, Ri: 80, g: 20 },
    { id: 'p32700-lfp', nazev: '32700 LiFePO4 6000 mAh', chemie: 'lfp', tvar: 'valec', d: 32.4, h: 70.5, U: 3.2, Umax: 3.65, Umin: 2.5, Ah: 6.0, I: 18, Ri: 8, g: 145 },
    { id: 'p66160-lto', nazev: 'LTO 66160 40 Ah', chemie: 'lto', tvar: 'valec', d: 66, h: 160, U: 2.3, Umax: 2.8, Umin: 1.5, Ah: 40, I: 160, Ri: 0.6, g: 1250 },
    { id: 'lfp105', nazev: 'Prizmatický LFP 105 Ah (EVE LF105)', chemie: 'lfp', tvar: 'prizma', s: 130.3, t: 36.7, v: 200.5, U: 3.2, Umax: 3.65, Umin: 2.5, Ah: 105, I: 105, Ri: 0.25, g: 1980 },
    { id: 'lfp280', nazev: 'Prizmatický LFP 280 Ah (EVE LF280K)', chemie: 'lfp', tvar: 'prizma', s: 173.7, t: 71.7, v: 207.2, U: 3.2, Umax: 3.65, Umin: 2.5, Ah: 280, I: 140, Ri: 0.2, g: 5490 },
    { id: 'nimh-aa', nazev: 'NiMH AA 2000 mAh (LSD, např. Eneloop)', chemie: 'nimh', tvar: 'valec', d: 14.5, h: 50.5, U: 1.2, Umax: 1.45, Umin: 1.0, Ah: 2.0, I: 2, Ri: 30, g: 27 },
    { id: 'pouch', nazev: 'Li-pol pouch 5000 mAh (zadejte rozměr)', chemie: 'nmc', tvar: 'pouch', s: 60, t: 8, v: 100, U: 3.7, Umax: 4.2, Umin: 3.0, Ah: 5.0, I: 5, Ri: 10, g: 95 }
  ];

  /* Orientační zatížitelnost měděných lanek (silikon / PVC, krátké vedení v packu, volně) [mm², A]. */
  const VODICE = [[0.25, 4], [0.5, 8], [0.75, 11], [1, 14], [1.5, 18], [2.5, 25], [4, 34], [6, 44], [10, 60], [16, 80], [25, 105], [35, 130], [50, 160], [70, 200], [95, 245], [120, 285]];
  const AWG = { 0.25: 24, 0.5: 20, 0.75: 18, 1: 18, 1.5: 16, 2.5: 14, 4: 12, 6: 10, 10: 8, 16: 6, 25: 4, 35: 2, 50: 1, 70: '2/0', 95: '3/0', 120: '4/0' };
  /* Běžné nikl pásky [tloušťka, šířka] mm. */
  const PASKY = [[0.1, 5], [0.1, 7], [0.12, 7], [0.15, 7], [0.15, 8], [0.2, 7], [0.2, 8], [0.2, 10], [0.3, 8], [0.3, 10], [0.3, 12]];
  const POJISTKY = [1, 2, 3, 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 125, 150, 200, 250, 300, 400, 500];
  const BMS_PROUDY = [5, 10, 15, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500];

  const cislo = (v, d, min = -Infinity, max = Infinity) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
  const cele = (v, d, min, max) => Math.round(cislo(v, d, min, max));

  /** Doplní a omezí údaje článku (vlastní články z formuláře/zálohy). */
  function normalizujClanek(c) {
    c = c || {};
    const z = PREDVOLBY[0];
    const tvar = ['valec', 'prizma', 'pouch'].includes(c.tvar) ? c.tvar : 'valec';
    const o = {
      id: String(c.id || 'v' + Date.now().toString(36)), nazev: String(c.nazev || 'Vlastní článek').slice(0, 120),
      chemie: CHEMIE[c.chemie] ? c.chemie : 'nmc', tvar,
      U: cislo(c.U, z.U, 0.5, 60), Umax: cislo(c.Umax, z.Umax, 0.5, 60), Umin: cislo(c.Umin, z.Umin, 0.1, 60),
      Ah: cislo(c.Ah, z.Ah, 0.01, 2000), I: cislo(c.I, z.I, 0.01, 5000), Ri: cislo(c.Ri, z.Ri, 0, 10000), g: cislo(c.g, z.g, 0.1, 100000)
    };
    if (tvar === 'valec') { o.d = cislo(c.d, 18.4, 3, 300); o.h = cislo(c.h, 65, 3, 600); }
    else { o.s = cislo(c.s, 60, 1, 1000); o.t = cislo(c.t, 8, 0.5, 500); o.v = cislo(c.v, 100, 1, 1000); }
    if (o.Umax < o.U) o.Umax = o.U;
    if (o.Umin > o.U) o.Umin = o.U;
    if (c.vlastni) o.vlastni = true;
    return o;
  }
  const vsechnyClanky = vlastni => PREDVOLBY.concat((vlastni || []).map(c => Object.assign(normalizujClanek(c), { vlastni: true })));
  const najdiClanek = (id, vlastni) => vsechnyClanky(vlastni).find(c => c.id === id) || PREDVOLBY[0];
  const rozmerClanku = c => c.tvar === 'valec' ? `Ø ${c.d} × ${c.h} mm` : `${c.s} × ${c.t} × ${c.v} mm`;

  function vychoziProjekt() {
    return {
      clanek: 'p18650-3000', rezim: 'sp', S: 4, P: 3,
      cil: { U: 14.4, typ: 'Wh', hodnota: 150, I: 10 },
      odber: { typ: 'W', hodnota: 60, ucinnost: 90, vyuziti: 90 },
      rozlozeni: { typ: 'mrizka', rady: 0, mezera: 1 },
      drzak: { vule: 0.4, stena: 1.2, vyska: 10, lem: 1, lemSirka: 1.5, drazky: false, pasek: 8 }
    };
  }
  /** Projekt s doplněnými a omezenými hodnotami. */
  function normalizuj(p) {
    const v = vychoziProjekt(); p = p || {};
    const c = Object.assign({}, v.cil, p.cil), o = Object.assign({}, v.odber, p.odber), r = Object.assign({}, v.rozlozeni, p.rozlozeni), d = Object.assign({}, v.drzak, p.drzak);
    return {
      clanek: String(p.clanek || v.clanek), rezim: p.rezim === 'cil' ? 'cil' : 'sp',
      S: cele(p.S, v.S, 1, 200), P: cele(p.P, v.P, 1, 200),
      cil: { U: cislo(c.U, v.cil.U, 0.5, 2000), typ: ['Ah', 'Wh'].includes(c.typ) ? c.typ : 'Wh', hodnota: cislo(c.hodnota, v.cil.hodnota, 0.01, 1e6), I: cislo(c.I, v.cil.I, 0, 1e5) },
      odber: { typ: o.typ === 'A' ? 'A' : 'W', hodnota: cislo(o.hodnota, v.odber.hodnota, 0, 1e7), ucinnost: cislo(o.ucinnost, 90, 10, 100), vyuziti: cislo(o.vyuziti, 90, 10, 100) },
      rozlozeni: { typ: r.typ === 'plastev' ? 'plastev' : 'mrizka', rady: cele(r.rady, 0, 0, 200), mezera: cislo(r.mezera, 1, 0, 50) },
      drzak: {
        vule: cislo(d.vule, 0.4, 0, 3), stena: cislo(d.stena, 1.2, 0.4, 10), vyska: cislo(d.vyska, 10, 1, 200),
        lem: cislo(d.lem, 1, 0, 10), lemSirka: cislo(d.lemSirka, 1.5, 0.3, 20), drazky: !!d.drazky, pasek: cislo(d.pasek, 8, 2, 30)
      }
    };
  }

  const nahoru = (tab, x) => tab.find(v => v >= x - 1e-9);

  /** Výpočet packu: článek c, S sérií, P paralelně, odber {typ W|A, hodnota, ucinnost %, vyuziti %}. */
  function spocitej(c, S, P, odber) {
    odber = odber || {};
    const n = S * P, ch = CHEMIE[c.chemie] || CHEMIE.nmc;
    const U = S * c.U, Umax = S * c.Umax, Umin = S * c.Umin, Ah = P * c.Ah, Wh = U * Ah;
    const Imax = P * c.I, Pmax = U * Imax, R = S * c.Ri / 1000 / P;        // Ω
    const hmotnost = n * c.g;                                               // g
    const ucinnost = (odber.ucinnost || 100) / 100, vyuziti = (odber.vyuziti || 100) / 100;
    const hodnota = Math.max(0, Number(odber.hodnota) || 0);
    // proud z packu: výkon spotřebiče přes měnič při jmenovitém napětí, nebo přímo zadaný proud
    const I = odber.typ === 'A' ? hodnota : hodnota / (ucinnost * U);
    const vysledek = {
      n, S, P, U, Umax, Umin, Ah, Wh, Imax, Pmax, R, hmotnost, I,
      C: Ah ? I / Ah : 0, Cmax: c.I / c.Ah,
      doba: I > 0 ? Ah * vyuziti / I : Infinity,                              // h
      ztrata: I * I * R,                                                      // W
      pokles: I * R                                                           // V
    };
    vysledek.ztrataClanek = vysledek.ztrata / n;
    // ohřev bez chlazení během celého vybití (horní mez): ΔT = I²R·t / (m·c)
    vysledek.ohrev = I > 0 ? vysledek.ztrata * vysledek.doba * 3600 / (hmotnost / 1000 * PARAMETRY.tepelnaKapacita) : 0;
    vysledek.doporuceni = doporuceni(c, ch, vysledek);
    vysledek.upozorneni = upozorneni(c, ch, vysledek);
    return vysledek;
  }

  function prurezPro(I) {
    const r = VODICE.find(([, a]) => a >= I);
    return r ? { mm2: r[0], awg: AWG[r[0]], A: r[1] } : { mm2: null, A: VODICE[VODICE.length - 1][1] };
  }
  /** Nejmenší pásek (čistý nikl) pro proud I; když nestačí 0,3 × 12, počet vrstev. */
  function pasekPro(I) {
    const kap = ([t, s]) => t * s * PARAMETRY.proudNikl;
    const p = PASKY.find(x => kap(x) >= I);
    if (p) return { t: p[0], s: p[1], A: kap(p), vrstev: 1 };
    const nej = PASKY[PASKY.length - 1], vrstev = Math.ceil(I / kap(nej));
    return { t: nej[0], s: nej[1], A: kap(nej) * vrstev, vrstev };
  }

  function doporuceni(c, ch, v) {
    const Iz = Math.max(v.I, 0.01), Ip = Iz * PARAMETRY.rezervaBms;
    const d = {};
    d.bms = ch.lithium ? {
      serii: v.S, typ: ch.bms, proud: nahoru(BMS_PROUDY, Ip) || Math.ceil(Ip / 50) * 50,
      balancovani: c.Ah * v.P >= 50 ? 'aktivní balancér (velké články – pasivní 30–60 mA nestačí)' : 'pasivní balancování stačí (~50 mA), u větších rozdílů aktivní',
      vypnuti: `přepěťová ochrana ≈ ${c.Umax.toFixed(2)} V/čl., podpěťová ≈ ${c.Umin.toFixed(2)} V/čl.`
    } : null;
    d.pojistka = nahoru(POJISTKY, Ip) || Math.ceil(Ip / 100) * 100;
    d.pojistkaU = Math.ceil(v.Umax * 1.2);
    d.vodic = prurezPro(Ip);
    // pásek nese proud jednoho spoje mezi skupinami; u prizmat přípojnice
    d.pasek = c.tvar === 'valec' ? pasekPro(Iz) : null;
    d.prurezPripojnice = c.tvar !== 'valec' ? Math.ceil(Iz / 2) : null;   // mm² Cu, ~2 A/mm² pro přípojnice
    return d;
  }

  function upozorneni(c, ch, v) {
    const u = [];
    if (v.I > v.Imax) u.push({ uroven: 'chyba', text: `Odběr ${v.I.toFixed(1)} A překračuje max. trvalý proud packu ${v.Imax.toFixed(1)} A – přidejte paralelní články nebo zvolte výkonový článek.` });
    else if (v.I > 0.8 * v.Imax) u.push({ uroven: 'varovani', text: `Odběr je ${Math.round(v.I / v.Imax * 100)} % maximálního proudu – články se budou výrazně hřát, počítejte s chlazením.` });
    if (v.ohrev > 25) u.push({ uroven: 'varovani', text: `Bez chlazení by se články za celé vybití ohřály až o ${Math.round(v.ohrev)} °C – nechte mezery a odvod tepla, nebo snižte proud.` });
    if (ch.lithium && v.Wh > PARAMETRY.letadloSeSouhlasem) u.push({ uroven: 'varovani', text: `${Math.round(v.Wh)} Wh: nad ${PARAMETRY.letadloSeSouhlasem} Wh nesmí do letadla v zavazadle cestujícího vůbec (jen jako nebezpečné zboží UN3480).` });
    else if (ch.lithium && v.Wh > PARAMETRY.letadloBezSouhlasu) u.push({ uroven: 'varovani', text: `${Math.round(v.Wh)} Wh: nad ${PARAMETRY.letadloBezSouhlasu} Wh smí do letadla jen v kabině se souhlasem dopravce (max. 2 náhradní kusy do ${PARAMETRY.letadloSeSouhlasem} Wh).` });
    else if (ch.lithium) u.push({ uroven: 'info', text: `${Math.round(v.Wh * 10) / 10} Wh ≤ ${PARAMETRY.letadloBezSouhlasu} Wh: do letadla v příručním zavazadle (náhradní baterie jen v kabině, póly chráněné proti zkratu).` });
    if (v.Umax > 60) u.push({ uroven: 'varovani', text: `Max. napětí ${v.Umax.toFixed(1)} V je nad 60 V DC – nebezpečné dotykové napětí, nutná izolace a kryt.` });
    if (!ch.lithium && v.S > 1) u.push({ uroven: 'info', text: 'NiMH nemá BMS – nabíjejte nabíječkou s ukončením −ΔV / teplotou, články stejného stáří a kapacity.' });
    return u;
  }

  const BEZPECNOST = [
    'Před spojením srovnejte napětí všech článků na ±0,05 V (paralelně přes rezistor nebo nabíječkou) – jinak tečou velké vyrovnávací proudy.',
    'Používejte jen články stejného typu, výrobce, šarže a stáří; změřte kapacitu a vnitřní odpor a skupiny P sestavte vyrovnané.',
    'Nepájejte přímo na články – teplo poškodí separátor a těsnění. Bodové svařování, nebo hotové pájecí očka.',
    'Nikdy nevytvořte zkrat: izolované nářadí, pracujte po jedné skupině, na kladný pól izolační kroužky (fishpaper).',
    'Hlavní pojistka co nejblíž kladnému pólu packu, dimenzovaná na stejnosměrné napětí.',
    'BMS na každou sérii (balanční vodiče ve správném pořadí, nejdřív GND/B−), test před zapojením nabíjení.',
    'Pack mechanicky upevněte, chraňte proti vibracím a odření izolace; mezi články a kovem izolace.',
    'Nabíjejte pod dohledem na nehořlavé podložce; poškozené, nafouklé nebo přehřáté články vyřaďte.'
  ];

  /** Návrh variant: cil {U, typ Ah|Wh, hodnota, I}; vrátí varianty přes všechny články seřazené podle hmotnosti. */
  function navrhniVarianty(clanky, cil, volby) {
    volby = Object.assign({ tolerance: 0.12, max: 15, razeni: 'hmotnost' }, volby);
    const out = [];
    for (const c of clanky) {
      const s0 = cil.U / c.U, kandidati = new Set([Math.floor(s0), Math.round(s0), Math.ceil(s0)]);
      for (const S of kandidati) {
        if (S < 1 || S > 200) continue;
        const U = S * c.U;
        if (Math.abs(U - cil.U) > volby.tolerance * cil.U + 1e-9) continue;
        const Ah = cil.typ === 'Ah' ? cil.hodnota : cil.hodnota / U;
        const P = Math.max(1, Math.ceil(Ah / c.Ah - 1e-9), Math.ceil((cil.I || 0) / c.I - 1e-9));
        if (P > 200) continue;
        const v = spocitej(c, S, P, { typ: 'A', hodnota: cil.I || 0 });
        out.push({ clanek: c.id, nazev: c.nazev, S, P, n: v.n, U: v.U, Ah: v.Ah, Wh: v.Wh, Imax: v.Imax, hmotnost: v.hmotnost, C: v.C });
      }
    }
    const kl = volby.razeni === 'pocet' ? (a, b) => a.n - b.n || a.hmotnost - b.hmotnost : (a, b) => a.hmotnost - b.hmotnost || a.n - b.n;
    return out.sort(kl).slice(0, volby.max);
  }

  /* ---------- rozložení ---------- */
  /** Rozteč otvorů držáku a průměr otvoru pro válcový článek. */
  function rozmeryDrzaku(c, dr) {
    const otvor = c.d + dr.vule;
    return { otvor, roztec: otvor + dr.stena, okraj: otvor / 2 + dr.stena };
  }
  /** Rozložení S·P článků po sloupcích hadovitě (skupiny P za sebou souvisle).
      Vrací buňky {x, y, sk, i}, rozteče a rozměry bloku článků i držáku [mm]. */
  function rozloz(c, S, P, rozl, dr) {
    const n = S * P, valec = c.tvar === 'valec', plastev = valec && rozl.typ === 'plastev';
    const rady = Math.max(1, Math.min(n, rozl.rady || P));
    let px, py, sirkaCl, hloubkaCl;
    if (valec) {
      const r = rozmeryDrzaku(c, dr);
      py = r.roztec; px = plastev ? r.roztec * Math.sqrt(3) / 2 : r.roztec; sirkaCl = hloubkaCl = c.d;
    } else {
      // prizma/pouch stojí čelem k sobě: tloušťka podél x
      px = c.t + rozl.mezera; py = c.s + rozl.mezera; sirkaCl = c.t; hloubkaCl = c.s;
    }
    const bunky = [];
    for (let i = 0; i < n; i++) {
      const sl = Math.floor(i / rady), k = i % rady, ra = sl % 2 ? rady - 1 - k : k;
      bunky.push({ i, sk: Math.floor(i / P), sl, ra, x: sl * px, y: ra * py + (plastev && sl % 2 ? py / 2 : 0) });
    }
    const xs = bunky.map(b => b.x), ys = bunky.map(b => b.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const o = {
      bunky, rady, sloupcu: Math.ceil(n / rady), px, py, plastev, valec,
      blok: [maxX - minX + sirkaCl, maxY - minY + hloubkaCl, valec ? c.h : c.v]
    };
    if (valec) {
      const r = rozmeryDrzaku(c, dr);
      o.otvor = r.otvor; o.okraj = r.okraj;
      o.drzak = [maxX - minX + 2 * r.okraj, maxY - minY + 2 * r.okraj, dr.vyska];
    }
    return o;
  }
  /** Sousední dvojice článků (vzdálenost středů ≈ rozteč). */
  function sousede(rozl) {
    const B = rozl.bunky, out = [], lim = Math.max(rozl.px, rozl.py) * 1.02;
    for (let a = 0; a < B.length; a++) for (let b = a + 1; b < B.length; b++) {
      const d = Math.hypot(B[a].x - B[b].x, B[a].y - B[b].y);
      if (d <= lim) out.push([a, b]);
    }
    return out;
  }

  /* ---------- geometrie držáku ---------- */
  const kruh = (x, y, r, n) => { const p = []; for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; p.push([x + r * Math.cos(a), y + r * Math.sin(a)]); } return p; };
  /** Konvexní obal (monotone chain), proti směru hodinových ručiček. */
  function obal(body) {
    const p = body.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const kriz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const dol = [], hor = [];
    for (const b of p) { while (dol.length >= 2 && kriz(dol[dol.length - 2], dol[dol.length - 1], b) <= 0) dol.pop(); dol.push(b); }
    for (let i = p.length - 1; i >= 0; i--) { const b = p[i]; while (hor.length >= 2 && kriz(hor[hor.length - 2], hor[hor.length - 1], b) <= 0) hor.pop(); hor.push(b); }
    return dol.slice(0, -1).concat(hor.slice(0, -1));
  }
  const SEG = 48;
  /** Obrys držáku = konvexní obal kružnic (otvor/2 + stěna) kolem všech článků. */
  const obrysDrzaku = rozl => obal([].concat(...rozl.bunky.map(b => kruh(b.x, b.y, rozl.okraj, SEG))));

  /** Držák článků přes manifold: deska s otvory, nahoře lem (doraz článku) s menším otvorem, volitelně drážky pro pásky.
      Vrací {poz Float32Array, idx Uint32Array, objem}. */
  function postavDrzak(w, rozl, dr) {
    if (!rozl.valec) throw new Error('Držák jde jen pro válcové články.');
    const { Manifold: M, CrossSection: CS } = w, smaz = [];
    const k = x => { smaz.push(x); return x; };
    try {
      const H = dr.vyska, lem = Math.min(dr.lem, H - 0.4), rO = rozl.otvor / 2, rL = Math.max(0.5, rO - dr.lemSirka);
      const vysun = (cs, z0, z1) => k(k(cs.extrude(z1 - z0)).translate([0, 0, z0]));
      let telo = vysun(k(new CS([obrysDrzaku(rozl)], 'Positive')), 0, H);
      const naraz = [];
      if (lem > 0) {
        naraz.push(vysun(k(new CS(rozl.bunky.map(b => kruh(b.x, b.y, rO, SEG)), 'Positive')), -1, H - lem));
        naraz.push(vysun(k(new CS(rozl.bunky.map(b => kruh(b.x, b.y, rL, SEG)), 'Positive')), -1, H + 1));
        if (dr.drazky) {
          // drážky v lemu mezi sousedy, které spojuje pásek (stejná skupina nebo sousední skupiny)
          const sir = Math.min(dr.pasek + 1, 2 * rL), B = rozl.bunky, obd = [];
          for (const [a, b] of sousede(rozl)) {
            if (Math.abs(B[a].sk - B[b].sk) > 1) continue;
            const dx = B[b].x - B[a].x, dy = B[b].y - B[a].y, l = Math.hypot(dx, dy), nx = -dy / l * sir / 2, ny = dx / l * sir / 2;
            obd.push([[B[a].x + nx, B[a].y + ny], [B[a].x - nx, B[a].y - ny], [B[b].x - nx, B[b].y - ny], [B[b].x + nx, B[b].y + ny]]);
          }
          // orientace proti směru hodinových ručiček
          for (const q of obd) { const s = (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]); if (s < 0) q.reverse(); }
          if (obd.length) naraz.push(vysun(k(new CS(obd, 'Positive')), H - lem, H + 1));
        }
      } else naraz.push(vysun(k(new CS(rozl.bunky.map(b => kruh(b.x, b.y, rO, SEG)), 'Positive')), -1, H + 1));
      telo = k(M.difference([telo, ...naraz]));
      const st = telo.status();
      if (st !== 'NoError') throw new Error('manifold hlásí ' + st);
      if (telo.isEmpty()) throw new Error('výsledný držák je prázdný');
      const mesh = telo.getMesh(), np = mesh.numProp, vp = mesh.vertProperties, poz = new Float32Array(vp.length / np * 3);
      for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
      return { poz, idx: new Uint32Array(mesh.triVerts), objem: telo.volume() };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  /** Binární STL ze sítě {poz, idx}. */
  function stlBinarni(sit, hlavicka = 'baterie_pack - drzak clanku') {
    const P = sit.poz, I = sit.idx, nT = I.length / 3;
    const buf = new ArrayBuffer(84 + 50 * nT), dv = new DataView(buf), u8 = new Uint8Array(buf);
    for (let i = 0; i < Math.min(80, hlavicka.length); i++) u8[i] = hlavicka.charCodeAt(i) & 0x7f;
    dv.setUint32(80, nT, true);
    for (let t = 0, o = 84; t < I.length; t += 3, o += 50) {
      const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true);
      [a, b, c].forEach((v, j) => { for (let q = 0; q < 3; q++) dv.setFloat32(o + 12 + 12 * j + 4 * q, P[v + q], true); });
    }
    return u8;
  }

  /* ---------- uložená data ---------- */
  const vychoziData = () => ({ verze: VERZE, projekt: vychoziProjekt(), navrhy: [], clanky: [] });
  function migruj(d) {
    if (!d || typeof d !== 'object') return vychoziData();
    return {
      verze: VERZE, projekt: normalizuj(d.projekt),
      navrhy: (Array.isArray(d.navrhy) ? d.navrhy : []).filter(n => n && n.nazev).map(n => ({ id: String(n.id || Math.random().toString(36).slice(2)), nazev: String(n.nazev).slice(0, 120), datum: String(n.datum || ''), projekt: normalizuj(n.projekt) })),
      clanky: (Array.isArray(d.clanky) ? d.clanky : []).map(c => Object.assign(normalizujClanek(c), { vlastni: true }))
    };
  }

  const API = {
    VERZE, KLIC, PARAMETRY, CHEMIE, PREDVOLBY, VODICE, PASKY, POJISTKY, BMS_PROUDY, BEZPECNOST,
    normalizujClanek, vsechnyClanky, najdiClanek, rozmerClanku, vychoziProjekt, normalizuj,
    spocitej, prurezPro, pasekPro, navrhniVarianty, rozmeryDrzaku, rozloz, sousede, obal, obrysDrzaku,
    postavDrzak, stlBinarni, vychoziData, migruj
  };
  if (typeof module !== 'undefined') module.exports = API; else window.BateriePackJadro = API;
})();

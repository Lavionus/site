/* Pevnost FDM výtisků – výpočetní jádro (bez DOM, testovatelné v node).
 *
 * Jednotky uvnitř: délky mm, síly N, napětí a moduly MPa (= N/mm²), momenty N·mm, spojité zatížení N/mm.
 * Znaménka: síly a spojité zatížení kladné směrem dolů; průhyb kladný dolů; ohybový moment kladný,
 * když táhne spodní vlákna (prostý nosník), záporný u konzoly (táhne horní vlákna).
 *
 * Modely:
 *  - Euler–Bernoulliho nosník, staticky určitý (prostý nosník, konzola), superpozice osamělých sil
 *    a rovnoměrného spojitého zatížení po celé délce (vzorce Roark, Gere & Goodno).
 *  - Smykový průhyb (Timošenko, odhad): w_s(x) = (M(x) − M(0)) / (κ·ΣG·A).
 *  - Složený průřez výtisku: obvodová skořepina (perimetry), plné vrchní/spodní vrstvy a výplň jako
 *    oblasti s vlastním modulem. Ohybová tuhost EI = Σ E_i·I_i, napětí σ_i = M·y_i·E_i / EI
 *    (metoda transformovaného průřezu; průřez je souměrný, neutrální osa ve středu).
 *  - Nejistota: každá vstupní veličina je interval; výsledky jsou monotónní v každé veličině zvlášť,
 *    proto se meze hledají výčtem všech rohů intervalového kvádru (přesná obálka, ne Monte Carlo).
 */
(function () {
  'use strict';

  const G_ZEME = 9.81; // m/s²

  /* ------------------------------------------------------------------ materiály */
  // Pravidlo intervalů: horní mez = nejvyšší hodnota z technických listů (zkušební tělesa tištěná za
  // ideálních podmínek, 100 % výplň), dolní mez = 0,85 × nejnižší hodnota z listů (typické odchylky
  // reálného tisku). Faktory směru Z: horní mez = poměr Z/XY z listu Polymaker, dolní mez = konzervativní
  // odhad z literatury (viz ZDROJE). Vše je na stránce editovatelné.
  const ZDROJE = {
    pm_pla: { text: 'Polymaker PolyLite™ PLA – Technical Data Sheet (wiki.polymaker.com, ISO 527 / ISO 178, 100 % výplň, X-Y i Z)', url: 'https://wiki.polymaker.com/polymaker-products/more-about-our-products/documents/technical-data-sheets/pla/polylite-tm-pla' },
    pm_petg: { text: 'Polymaker PolyLite™ PETG – Technical Data Sheet (ISO 527 / ISO 178, X-Y i Z)', url: 'https://wiki.polymaker.com/polymaker-products/more-about-our-products/documents/technical-data-sheets/petg-pet/polylite-tm-petg' },
    pm_abs: { text: 'Polymaker PolyLite™ ABS – Technical Data Sheet (ISO 527 / ISO 178, X-Y i Z)', url: 'https://wiki.polymaker.com/polymaker-products/more-about-our-products/documents/technical-data-sheets/abs-asa/polylite-tm-abs' },
    pm_asa: { text: 'Polymaker™ ASA – Technical Data Sheet (ISO 527 / ISO 178, X-Y i Z)', url: 'https://wiki.polymaker.com/polymaker-products/more-about-our-products/documents/technical-data-sheets/abs-asa/polymaker-tm-asa' },
    pm_pc: { text: 'Polymaker PolyLite™ PC – Technical Data Sheet (ISO 527 / ISO 178, X-Y i Z)', url: 'https://wiki.polymaker.com/polymaker-products/more-about-our-products/documents/technical-data-sheets/polycarbonate/polylite-tm-pc' },
    pm_pcmax: { text: 'Polymaker PolyMax™ PC – Technical Data Sheet (ISO 527, X-Y i Z)', url: 'https://wiki.polymaker.com/polymaker-products/more-about-our-products/documents/technical-data-sheets/polycarbonate/polymax-tm-pc' },
    pm_copa: { text: 'Polymaker PolyMide™ CoPA – Technical Data Sheet (suchý stav i po navlhnutí 6,16 %, X-Y i Z)', url: 'https://wiki.polymaker.com/polymaker-products/more-about-our-products/documents/technical-data-sheets/nylon/polymide-tm-copa' },
    pm_tpu: { text: 'Polymaker PolyFlex™ TPU95 – Technical Data Sheet (ISO 37, jen X-Y)', url: 'https://wiki.polymaker.com/polymaker-products/more-about-our-products/documents/technical-data-sheets/tpu/polyflex-tm-tpu95' },
    pr_pla: { text: 'Prusa Polymers: Prusament PLA – Technical Data Sheet, verze 1.1 (27. 7. 2022), tištěná tělesa ISO 527-1 / ISO 178', url: 'https://prusament.com/materials/pla/' },
    pr_petg: { text: 'Prusa Polymers: Prusament PETG – Technical Data Sheet, verze 1.1 (16. 2. 2022), tištěná tělesa ISO 527-1', url: 'https://prusament.com/materials/prusament-petg/' },
    cnck_pc: { text: 'S. Laub (CNC Kitchen): Prusament PC Blend Review – naměřeno naplocho 68–71 MPa, soudržnost vrstev 25–35 MPa', url: 'https://www.cnckitchen.com/blog/prusament-pc-blend-review' },
    ahn: { text: 'S.-H. Ahn, M. Montero, D. Odell, S. Roundy, P. K. Wright: Anisotropic material properties of fused deposition modeling ABS. Rapid Prototyping Journal 8(4), 2002, 248–257', url: 'https://doi.org/10.1108/13552540210441166' },
    rodriguez: { text: 'J. F. Rodríguez, J. P. Thomas, J. E. Renaud: Mechanical behavior of acrylonitrile butadiene styrene (ABS) fused deposition materials. Experimental investigation. Rapid Prototyping Journal 7(3), 2001, 148–158', url: 'https://doi.org/10.1108/13552540110395547' },
    chacon: { text: 'J. M. Chacón, M. A. Caminero, E. García-Plaza, P. J. Núñez: Additive manufacturing of PLA structures using fused deposition modelling: Effect of process parameters on mechanical properties and their optimal selection. Materials & Design 124, 2017, 143–157', url: 'https://doi.org/10.1016/j.matdes.2017.03.065' },
    gibson: { text: 'L. J. Gibson, M. F. Ashby: Cellular Solids – Structure and Properties, 2. vyd. Cambridge University Press, 1997 (kap. 5: E*/E_s ≈ C₁·ρ̄², σ*/σ_ys ≈ 0,3·ρ̄^1,5 pro ohybově namáhané buňky)', url: 'https://doi.org/10.1017/CBO9781139878326' },
    roark: { text: 'W. C. Young, R. G. Budynas, A. M. Sadegh: Roark\'s Formulas for Stress and Strain, 8. vyd. McGraw-Hill, 2012 (tab. 8.1 – nosníky)', url: '' },
    gere: { text: 'J. M. Gere, B. J. Goodno: Mechanics of Materials, 8. vyd. Cengage, 2013 (kap. 5, 6, 9 – ohyb, složené nosníky, průhyby; příl. H)', url: '' },
  };

  function interval(lo, hi) { return [lo, hi]; }
  const MATERIALY = {
    PLA: {
      nazev: 'PLA', E: interval(1950, 3430), sigma: interval(43, 59), kEZ: interval(0.75, 0.89), kSZ: interval(0.35, 0.77),
      hustota: 1.24, nu: 0.35, sigmaOhyb: 87, Tg: 61, zdroje: ['pm_pla', 'pr_pla', 'chacon'],
      doklad: 'PolyLite PLA: E 3 427 / 3 065 MPa (XY/Z), σ_t 52,3 / 40,5 MPa, ohyb 86,9 MPa; Prusament PLA: E 2,3–2,4 GPa, σ_y 51–59 MPa (ležící i stojící „xz“ těleso – obě v rovině vrstev).',
      pozn: 'Měkne nad ~55–60 °C (Tg 61 °C dle PolyLite) – nepoužívat v autě, u topení ani na slunci. Výrazně creepuje pod trvalým zatížením.'
    },
    PETG: {
      nazev: 'PETG', E: interval(1280, 2120), sigma: interval(40, 51), kEZ: interval(0.75, 0.90), kSZ: interval(0.35, 0.84),
      hustota: 1.27, nu: 0.38, sigmaOhyb: 70, Tg: 81, zdroje: ['pm_petg', 'pr_petg'],
      doklad: 'PolyLite PETG: E 2 117 / 1 899 MPa (XY/Z), σ_t 50,8 / 42,8 MPa, ohyb 69,6 MPa; Prusament PETG: E 1,5–1,6 GPa, σ_y 47–50 MPa.',
      pozn: 'Houževnatější než PLA, poddajnější. Pevnost ve směru Z silně závisí na teplotě tisku a chlazení (Polymaker tiskl tělesa bez ventilátoru).'
    },
    ABS: {
      nazev: 'ABS', E: interval(1910, 2250), sigma: interval(28, 33.4), kEZ: interval(0.75, 0.93), kSZ: interval(0.35, 0.89),
      hustota: 1.12, nu: 0.35, sigmaOhyb: 56, Tg: 101, zdroje: ['pm_abs', 'ahn', 'rodriguez'],
      doklad: 'PolyLite ABS: E 2 247 / 2 081 MPa (XY/Z), σ_t 33,4 / 29,7 MPa, ohyb 56,2 MPa. Jediný list s údaji XY i Z → interval jen z jednoho zdroje.',
      pozn: 'Soudržnost vrstev citlivě závisí na uzavřené komoře a průvanu (Ahn 2002 – příčný směr jen zlomek podélné pevnosti).'
    },
    ASA: {
      nazev: 'ASA', E: interval(2020, 2380), sigma: interval(37, 43.8), kEZ: interval(0.75, 0.83), kSZ: interval(0.35, 0.73),
      hustota: 1.13, nu: 0.35, sigmaOhyb: 73, Tg: 98, zdroje: ['pm_asa'],
      doklad: 'Polymaker ASA: E 2 379 / 1 965 MPa (XY/Z), σ_t 43,8 / 32 MPa, ohyb 73,4 MPa. Jediný ověřený zdroj.',
      pozn: 'Vlastnosti blízké ABS, lepší odolnost UV. Interval je z jediného listu – zvažte vlastní zkoušku.'
    },
    PC: {
      nazev: 'PC', E: interval(2070, 2500), sigma: interval(45, 69), kEZ: interval(0.75, 0.95), kSZ: interval(0.35, 0.78),
      hustota: 1.19, nu: 0.37, sigmaOhyb: 106, Tg: 113, zdroje: ['pm_pc', 'pm_pcmax', 'cnck_pc'],
      doklad: 'PolyLite PC: E 2 497 / 2 371 MPa, σ_t 69,1 / 52,8 MPa; PolyMax PC: E 2 435 / 2 149 MPa, σ_t 53,4 / 41,4 MPa; CNC Kitchen (Prusament PC Blend): naplocho 68–71 MPa, mezi vrstvami jen 25–35 MPa (poměr 0,35–0,5).',
      pozn: 'Pevný a teplotně odolný, ale náročný na tisk; reálná soudržnost vrstev může být výrazně pod listem výrobce (viz CNC Kitchen).'
    },
    PA_SUCHY: {
      nazev: 'PA (CoPA) – suchý', E: interval(2300, 2700), sigma: interval(66, 78), kEZ: interval(0.75, 0.82), kSZ: interval(0.35, 0.59),
      hustota: 1.12, nu: 0.39, sigmaOhyb: 110, Tg: 66, zdroje: ['pm_copa'],
      doklad: 'PolyMide CoPA, suchý stav (žíhán 80 °C/6 h, sušen 48 h): E 2 703 / 2 209 MPa, σ_t 78,0 / 45,8 MPa, ohyb 109,8 MPa.',
      pozn: 'Polyamid nasává vlhkost – suchý stav je na vzduchu jen přechodný. Pro trvalé použití počítejte s variantou „navlhlý“.'
    },
    PA_VLHKY: {
      nazev: 'PA (CoPA) – navlhlý', E: interval(620, 724), sigma: interval(29, 34.3), kEZ: interval(0.75, 0.91), kSZ: interval(0.24, 0.40),
      hustota: 1.12, nu: 0.40, sigmaOhyb: null, Tg: null, zdroje: ['pm_copa'],
      doklad: 'PolyMide CoPA po 48 h ve vodě 60 °C (vlhkost 6,16 %): E 724 / 660 MPa, σ_t 34,3 / 13,7 MPa.',
      pozn: 'Ukázka, jak zásadně vlhkost mění polyamid: modul klesne asi 3,7×.'
    },
    TPU: {
      nazev: 'TPU 95A', E: interval(29, 34), sigma: interval(9, 11.1), kEZ: interval(0.75, 1), kSZ: interval(0.35, 1),
      hustota: 1.22, nu: 0.45, sigmaOhyb: null, Tg: null, zdroje: ['pm_tpu'], nelinearni: true,
      doklad: 'PolyFlex TPU95: Youngův modul 33,6 MPa, napětí při 100 % protažení 11,1 MPa (ISO 37). „Pevnost“ zde = napětí při 100 % deformaci, nikoli mez pevnosti.',
      pozn: 'Pryžovitý materiál: lineární teorie nosníku platí jen pro velmi malé průhyby. Výsledky ber jen jako hrubou představu o tuhosti.'
    },
    VLASTNI: {
      nazev: 'Vlastní materiál', E: interval(2000, 3000), sigma: interval(35, 50), kEZ: interval(0.75, 0.9), kSZ: interval(0.35, 0.8),
      hustota: 1.2, nu: 0.35, sigmaOhyb: null, Tg: null, zdroje: [],
      doklad: 'Zadejte vlastní intervaly – ideálně z vlastní tahové zkoušky tělesa tištěného stejnými parametry.',
      pozn: ''
    },
  };

  // Faktory pro plné vrchní/spodní vrstvy (rastr ±45° vůči ose nosníku) – odhad, viz Rodríguez 2001, Es-Said 2000.
  const VYCHOZI_SKIN = { kEs: interval(0.85, 1.0), kSs: interval(0.70, 1.0) };

  const ORIENTACE = {
    A: { nazev: 'Naplocho', popis: 'Nosník leží na podložce, výška průřezu h je ve směru Z tiskárny. Krajní vlákna (horní a spodní plocha) tvoří plné vrchní/spodní vrstvy s rastrem ±45°, boky tvoří perimetry. Smyk na neutrální ose působí v rovině mezi vrstvami.', smykMeziVrstvami: true },
    B: { nazev: 'Na boku', popis: 'Nosník leží na boku, šířka průřezu b je ve směru Z tiskárny. Krajní vlákna tvoří souvislé perimetry podél osy nosníku – pro ohyb obvykle nejvýhodnější. Smyk z ohybu nepůsobí mezi vrstvami.', smykMeziVrstvami: false },
    C: { nazev: 'Nastojato', popis: 'Osa nosníku je ve směru Z tiskárny. Ohybové i tahové napětí působí přes spoje vrstev – rozhoduje soudržnost vrstev (faktory k_Z). Vrchní/spodní plné vrstvy leží jen na koncích dílu, v průřezu nejsou.', smykMeziVrstvami: true },
  };

  const ULOHY = {
    prosty: 'Prostý nosník na dvou podporách',
    konzola: 'Konzola (vetknutý nosník)',
    tah: 'Prostý tah',
  };

  /* ------------------------------------------------------------------ pomocné */
  function cislo(x) { return typeof x === 'number' && isFinite(x); }
  function stred(iv) { return (iv[0] + iv[1]) / 2; }
  function kopie(o) { return JSON.parse(JSON.stringify(o)); }

  /** Formát čísla s desetinnou čárkou; platne = počet platných číslic (výchozí 4). */
  function fmt(x, platne, pevne) {
    if (!cislo(x)) return '—';
    if (x === 0) return '0';
    let s;
    if (pevne != null) s = x.toFixed(pevne);
    else {
      const p = platne || 4;
      const r = Math.abs(x);
      if (r >= 1e6 || r < 1e-4) {
        const [man, ex] = x.toExponential(p - 1).split('e');
        const sup = String(Math.abs(+ex)).replace(/\d/g, c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]);
        return man.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '').replace('-', '−').replace('.', ',') + ' × 10' + (+ex < 0 ? '⁻' : '') + sup;
      }
      const des = Math.max(0, p - 1 - Math.floor(Math.log10(r)));
      s = x.toFixed(Math.min(des, 8));
      if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    }
    const [cela, des] = s.replace('-', '').split('.');
    const skup = cela.length > 4 ? cela.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : cela;
    return (x < 0 ? '−' : '') + skup + (des ? ',' + des : '');
  }

  /* ------------------------------------------------------------------ průřez */
  /**
   * Geometrie složeného průřezu. Vrací seznam oblastí (souměrně k neutrální ose):
   * { id, nazev, typ: 'perimetr'|'skin'|'vypln'|'plny', A, I, yMax, Q (statický moment části nad NO), sirka }
   * vstup.prurez: { tvar: 'obdelnik', b, h } | { tvar: 'kruh', d }
   * vstup.tisk: { model: 'tisk'|'homogenni', nPerim, stopa, nPlne, vrstva, vypln (0–1) }
   * vstup.orientace: 'A'|'B'|'C'
   */
  function geometrie(vstup) {
    const p = vstup.prurez, t = vstup.tisk || {}, o = vstup.orientace || 'B';
    const obl = [];
    const homog = t.model === 'homogenni';
    function obdel(id, nazev, typ, w, tl, zc, par) {
      // par = true: dvojice souměrných obdélníků v ±zc; zc = 0 a par=false: jeden obdélník na ose
      if (!(w > 1e-12 && tl > 1e-12)) return;
      const n = par ? 2 : 1;
      const A = n * w * tl;
      const I = n * (w * tl * tl * tl / 12 + w * tl * zc * zc);
      const yMax = Math.abs(zc) + tl / 2;
      const Q = par ? w * tl * Math.abs(zc) : w * (tl / 2) * (tl / 4);
      const nalez = obl.find(x => x.id === id);
      if (nalez) { nalez.A += A; nalez.I += I; nalez.Q += Q; nalez.yMax = Math.max(nalez.yMax, yMax); nalez.sirka += par ? 0 : w; }
      else obl.push({ id, nazev, typ, A, I, yMax, Q, sirka: par ? 0 : w });
    }
    if (p.tvar === 'kruh') {
      const d = p.d;
      if (homog) {
        obl.push({ id: 'plny', nazev: 'Plný průřez', typ: 'plny', A: Math.PI * d * d / 4, I: Math.PI * Math.pow(d, 4) / 64, yMax: d / 2, Q: d * d * d / 12, sirka: d });
      } else {
        const tp = Math.min(t.nPerim * t.stopa, d / 2);
        const di = Math.max(0, d - 2 * tp);
        obl.push({ id: 'perimetr', nazev: 'Obvodové perimetry (mezikruží)', typ: 'perimetr', A: Math.PI * (d * d - di * di) / 4, I: Math.PI * (Math.pow(d, 4) - Math.pow(di, 4)) / 64, yMax: d / 2, Q: (d * d * d - di * di * di) / 12, sirka: d - di });
        if (di > 1e-12) obl.push({ id: 'vypln', nazev: 'Výplň (jádro)', typ: 'vypln', A: Math.PI * di * di / 4, I: Math.PI * Math.pow(di, 4) / 64, yMax: di / 2, Q: di * di * di / 12, sirka: di });
      }
      return { oblasti: obl, sirkaNO: d, vyska: d, sirka: d };
    }
    const b = p.b, h = p.h;
    if (homog) {
      obdel('plny', 'Plný průřez', 'plny', b, h, 0, false);
      return { oblasti: obl, sirkaNO: b, vyska: h, sirka: b };
    }
    const tStopa = t.nPerim * t.stopa, tPlne = t.nPlne * t.vrstva;
    if (o === 'A') {
      const tp = Math.min(tStopa, b / 2), ts = Math.min(tPlne, h / 2);
      obdel('perimetr', 'Perimetry (boční stěny)', 'perimetr', tp, h, 0, false);
      obdel('perimetr', 'Perimetry (boční stěny)', 'perimetr', tp, h, 0, false);
      obdel('skin', 'Plné vrstvy nahoře a dole', 'skin', b - 2 * tp, ts, h / 2 - ts / 2, true);
      obdel('vypln', 'Výplň (jádro)', 'vypln', b - 2 * tp, h - 2 * ts, 0, false);
    } else if (o === 'B') {
      const tp = Math.min(tStopa, h / 2), ts = Math.min(tPlne, b / 2);
      obdel('skin', 'Plné vrstvy po stranách', 'skin', ts, h, 0, false);
      obdel('skin', 'Plné vrstvy po stranách', 'skin', ts, h, 0, false);
      obdel('perimetr', 'Perimetry (horní a spodní pás)', 'perimetr', b - 2 * ts, tp, h / 2 - tp / 2, true);
      obdel('vypln', 'Výplň (jádro)', 'vypln', b - 2 * ts, h - 2 * tp, 0, false);
    } else {
      const tp = Math.min(tStopa, b / 2, h / 2);
      obdel('perimetr', 'Perimetry (obvodový rám)', 'perimetr', b, tp, h / 2 - tp / 2, true);
      obdel('perimetr', 'Perimetry (obvodový rám)', 'perimetr', tp, h - 2 * tp, 0, false);
      obdel('perimetr', 'Perimetry (obvodový rám)', 'perimetr', tp, h - 2 * tp, 0, false);
      obdel('vypln', 'Výplň (jádro)', 'vypln', b - 2 * tp, h - 2 * tp, 0, false);
    }
    return { oblasti: obl, sirkaNO: b, vyska: h, sirka: b };
  }

  /**
   * Materiálové vlastnosti oblastí pro jednu konkrétní sadu hodnot (scénář).
   * s = { E, sigma, kEs, kSs, kEZ, kSZ, phiE, phiS, nu }
   */
  function vlastnostiOblasti(typ, orientace, s) {
    const Z = orientace === 'C';
    let kE = 1, kS = 1;
    if (typ === 'skin') { kE = s.kEs; kS = s.kSs; }
    if (typ === 'vypln') { kE = s.phiE; kS = s.phiS; }
    if (Z) { kE *= s.kEZ; kS *= s.kSZ; }
    return { E: s.E * kE, sigmaDov: s.sigma * kS };
  }

  /** Tuhosti průřezu pro scénář s. */
  function prurezScenar(geo, orientace, s) {
    let EI = 0, EA = 0, GA = 0, ESNO = 0;
    const obl = geo.oblasti.map(g => {
      const v = vlastnostiOblasti(g.typ, orientace, s);
      EI += v.E * g.I; EA += v.E * g.A; GA += v.E / (2 * (1 + s.nu)) * g.A; ESNO += v.E * g.Q;
      return Object.assign({}, g, v);
    });
    return { oblasti: obl, EI, EA, GA, ESNO };
  }

  /* ------------------------------------------------------------------ nosník */
  /**
   * Staticky určitý nosník délky L. typ 'prosty' (podpory v x=0 a x=L) nebo 'konzola' (vetknutí v x=0).
   * sily: [{F, a}] (a = vzdálenost od levé podpory / vetknutí), q = rovnoměrné zatížení po celé délce.
   * Vrací funkce V(x), M(x), wEI(x) (= EI·průhyb ohybem) a reakce.
   */
  function nosnik(typ, L, sily, q) {
    q = q || 0;
    const F = sily.filter(s => s.F !== 0);
    let RA, RB = 0, MA = 0, M0;
    if (typ === 'prosty') {
      RA = F.reduce((s, f) => s + f.F * (L - f.a) / L, 0) + q * L / 2;
      RB = F.reduce((s, f) => s + f.F * f.a / L, 0) + q * L / 2;
      M0 = 0;
    } else if (typ === 'konzola') {
      RA = F.reduce((s, f) => s + f.F, 0) + q * L;
      MA = F.reduce((s, f) => s + f.F * f.a, 0) + q * L * L / 2; // velikost reakčního momentu ve vetknutí
      M0 = -MA;
    } else throw new Error('Neznámý typ nosníku: ' + typ);

    // V(x) = součet sil vlevo od řezu (nahoru kladně); strana: 'L' = těsně vlevo od x, jinak těsně vpravo
    function V(x, strana) {
      let v = RA - q * x;
      for (const f of F) if (x > f.a || (x === f.a && strana !== 'L')) v -= f.F;
      if (typ === 'prosty' && x >= L && strana !== 'L') v += RB;
      return v;
    }
    function M(x) {
      let m = M0 + RA * x - q * x * x / 2;
      for (const f of F) if (x > f.a) m -= f.F * (x - f.a);
      return m;
    }
    // EI·w(x), w kladně dolů – uzavřené vzorce a superpozice
    function wEI(x) {
      let w = 0;
      if (typ === 'prosty') {
        for (const f of F) {
          const a = f.a, b = L - a;
          if (x <= a) w += f.F * b * x * (L * L - b * b - x * x) / (6 * L);
          else { const xx = L - x; w += f.F * a * xx * (L * L - a * a - xx * xx) / (6 * L); }
        }
        w += q * x * (L * L * L - 2 * L * x * x + x * x * x) / 24;
      } else {
        for (const f of F) {
          const a = f.a;
          if (x <= a) w += f.F * x * x * (3 * a - x) / 6;
          else w += f.F * a * a * (3 * x - a) / 6;
        }
        w += q * x * x * (6 * L * L - 4 * L * x + x * x) / 24;
      }
      return w;
    }
    // Extrémy momentu: koncové body, polohy sil, nulové body posouvající síly
    const body = [0, L].concat(F.map(f => f.a));
    if (q > 0) {
      const hrany = Array.from(new Set([0, L].concat(F.map(f => f.a)))).sort((a, b) => a - b);
      for (let i = 0; i < hrany.length - 1; i++) {
        const x0 = hrany[i], x1 = hrany[i + 1];
        const v0 = V(x0, 'P');
        const xz = x0 + v0 / q;
        if (xz > x0 && xz < x1) body.push(xz);
      }
    }
    let Mmax = 0, xM = 0;
    for (const x of body) { const m = M(x); if (Math.abs(m) > Math.abs(Mmax) + 1e-12) { Mmax = m; xM = x; } }
    let Vmax = 0, xV = 0;
    for (const x of body) for (const st of ['L', 'P']) {
      if ((x === 0 && st === 'L') || (x === L && st === 'P')) continue;
      const v = V(x, st); if (Math.abs(v) > Math.abs(Vmax) + 1e-12) { Vmax = v; xV = x; }
    }
    return { typ, L, sily: F, q, RA, RB, MA, M0, V, M, wEI, Mmax, xM, Vmax, xV };
  }

  /** Najde maximum průhybu w(x) = wEI/EI + ws na [0, L]: vzorkování + zlatý řez. */
  function maxPruhyb(fn, L, n) {
    n = n || 400;
    let best = 0, xb = 0;
    for (let i = 0; i <= n; i++) { const x = L * i / n, w = fn(x); if (Math.abs(w) > Math.abs(best)) { best = w; xb = x; } }
    let a = Math.max(0, xb - L / n), b = Math.min(L, xb + L / n);
    const g = (Math.sqrt(5) - 1) / 2;
    let c = b - g * (b - a), d = a + g * (b - a);
    for (let k = 0; k < 60; k++) {
      if (Math.abs(fn(c)) > Math.abs(fn(d))) b = d; else a = c;
      c = b - g * (b - a); d = a + g * (b - a);
    }
    const xm = (a + b) / 2, wm = fn(xm);
    if (Math.abs(wm) > Math.abs(best)) { best = wm; xb = xm; }
    return { w: best, x: xb };
  }

  /* ------------------------------------------------------------------ validace */
  function validuj(v) {
    const ch = [];
    const kladne = (x, co) => { if (!(cislo(x) && x > 0)) ch.push(co + ' musí být kladné číslo.'); };
    if (!ULOHY[v.uloha]) ch.push('Neznámý typ úlohy.');
    kladne(v.L, 'Délka L');
    if (!v.prurez) ch.push('Chybí průřez.');
    else if (v.prurez.tvar === 'kruh') kladne(v.prurez.d, 'Průměr d');
    else if (v.prurez.tvar === 'obdelnik') { kladne(v.prurez.b, 'Šířka b'); kladne(v.prurez.h, 'Výška h'); }
    else ch.push('Neznámý tvar průřezu.');
    if (!ORIENTACE[v.orientace]) ch.push('Neznámá orientace tisku.');
    const t = v.tisk || {};
    if (t.model !== 'homogenni') {
      if (!(Number.isInteger(t.nPerim) && t.nPerim >= 1 && t.nPerim <= 50)) ch.push('Počet perimetrů musí být celé číslo 1–50.');
      if (!(Number.isInteger(t.nPlne) && t.nPlne >= 0 && t.nPlne <= 100)) ch.push('Počet plných vrstev musí být celé číslo 0–100.');
      kladne(t.stopa, 'Šířka stopy');
      kladne(t.vrstva, 'Výška vrstvy');
      if (!(cislo(t.vypln) && t.vypln >= 0 && t.vypln <= 1)) ch.push('Výplň musí být 0–100 %.');
    }
    const m = v.material || {};
    for (const [k, co] of [['E', 'Modul E'], ['sigma', 'Pevnost σ'], ['kEZ', 'Faktor k_E,Z'], ['kSZ', 'Faktor k_σ,Z'], ['kEs', 'Faktor k_E,plné vrstvy'], ['kSs', 'Faktor k_σ,plné vrstvy']]) {
      const iv = m[k];
      if (!(Array.isArray(iv) && cislo(iv[0]) && cislo(iv[1]) && iv[0] > 0 && iv[1] >= iv[0])) ch.push(co + ': interval musí mít 0 < min ≤ max.');
      else if (k[0] === 'k' && iv[1] > 1.5) ch.push(co + ': faktor nad 1,5 nedává smysl.');
    }
    if (!(cislo(m.nu) && m.nu >= 0 && m.nu < 0.5)) ch.push('Poissonovo číslo musí být v intervalu 0 až 0,5.');
    if (!(cislo(m.hustota) && m.hustota > 0)) ch.push('Hustota musí být kladná.');
    const sily = v.sily || [];
    if (v.uloha === 'tah') {
      if (!sily.length || !cislo(sily[0].F)) ch.push('Zadejte tahovou sílu.');
      else if (sily[0].F < 0) ch.push('Tlak a vzpěr stránka neposuzuje – zadejte kladnou (tahovou) sílu.');
    } else {
      for (const s of sily) {
        if (!cislo(s.F)) ch.push('Síla musí být číslo.');
        if (!(cislo(s.a) && s.a >= 0 && s.a <= v.L + 1e-9)) ch.push('Poloha síly musí ležet na nosníku (0 až L).');
      }
      if (!cislo(v.q || 0)) ch.push('Spojité zatížení musí být číslo.');
      const nenulove = sily.some(s => s.F !== 0) || (v.q || 0) !== 0 || v.vlastniTiha;
      if (!nenulove) ch.push('Nosník není zatížen.');
    }
    const vm = v.vyplnModel || {};
    if (!(cislo(vm.nDol) && cislo(vm.nHor) && vm.nHor >= 0.5 && vm.nDol >= vm.nHor && vm.nDol <= 4)) ch.push('Exponenty modelu výplně: musí platit 0,5 ≤ n_horní ≤ n_dolní ≤ 4.');
    if (!(cislo(v.pozadovanaBezpecnost) && v.pozadovanaBezpecnost >= 1)) ch.push('Požadovaná bezpečnost musí být alespoň 1.');
    return ch;
  }

  /* ------------------------------------------------------------------ scénáře nejistoty */
  /** Intervaly nejistých veličin pro daný vstup. Vrací [{klic, nazev, iv}] – jen relevantní a nenulové šíře. */
  function nejiste(v) {
    const m = v.material, t = v.tisk, o = v.orientace, homog = t.model === 'homogenni';
    const rho = homog ? 1 : t.vypln;
    const vm = v.vyplnModel;
    const phiE = homog ? [1, 1] : [vm.zanedbat ? 0 : Math.pow(rho, vm.nDol), Math.pow(rho, vm.nHor)];
    // pevnost výplně: Gibson–Ashby 0,3·ρ^1,5 (ohyb buněk) až ρ (Voigt)
    const phiS = homog ? [1, 1] : [vm.zanedbat ? 0 : 0.3 * Math.pow(rho, 1.5), rho];
    if (!homog && rho >= 1) { phiE[0] = phiE[1] = 1; phiS[0] = phiS[1] = 1; }
    const vse = [
      { klic: 'E', nazev: 'Modul pružnosti E (XY)', iv: m.E },
      { klic: 'sigma', nazev: 'Pevnost σ (XY)', iv: m.sigma },
      { klic: 'kEs', nazev: 'Plné vrstvy ±45°: faktor modulu', iv: m.kEs, jen: !homog && o !== 'C' },
      { klic: 'kSs', nazev: 'Plné vrstvy ±45°: faktor pevnosti', iv: m.kSs, jen: !homog && o !== 'C' },
      { klic: 'kEZ', nazev: 'Směr Z: faktor modulu', iv: m.kEZ, jen: o === 'C' },
      { klic: 'kSZ', nazev: 'Směr Z: faktor pevnosti (soudržnost vrstev)', iv: m.kSZ, jen: o === 'C' || (ORIENTACE[o].smykMeziVrstvami && v.uloha !== 'tah') },
      { klic: 'phiE', nazev: 'Výplň: poměr modulů E_výpl/E', iv: phiE, jen: !homog },
      { klic: 'phiS', nazev: 'Výplň: poměr pevností', iv: phiS, jen: !homog },
    ];
    return vse;
  }

  function scenarZ(nej, volba, nu) {
    // volba: funkce (polozka) -> hodnota
    const s = { nu };
    for (const p of nej) s[p.klic] = volba(p);
    return s;
  }

  /** Výpočet pro jednu konkrétní sadu hodnot s. */
  function vypocetScenare(v, geo, s, zakl) {
    const pr = prurezScenar(geo, v.orientace, s);
    const o = ORIENTACE[v.orientace];
    const vys = { s, EI: pr.EI, EA: pr.EA, GA: pr.GA, oblasti: [] };
    if (v.uloha === 'tah') {
      const F = v.sily[0].F;
      vys.dL = F * v.L / pr.EA;
      vys.oblasti = pr.oblasti.map(g => ({ id: g.id, nazev: g.nazev, typ: g.typ, E: g.E, sigmaDov: g.sigmaDov, sigma: F * g.E / pr.EA }));
      vys.wMax = vys.dL;
    } else {
      const n = zakl.nos;
      const kappa = v.prurez.tvar === 'kruh' ? 0.9 : 5 / 6;
      const GAk = kappa * pr.GA;
      const smyk = v.smyk !== false;
      const fn = x => n.wEI(x) / pr.EI + (smyk ? (n.M(x) - n.M0) / GAk : 0);
      const mx = maxPruhyb(fn, v.L);
      vys.wMax = mx.w; vys.xw = mx.x;
      vys.wOhyb = maxPruhyb(x => n.wEI(x) / pr.EI, v.L).w;
      vys.wSmyk = smyk ? maxPruhyb(x => (n.M(x) - n.M0) / GAk, v.L).w : 0;
      vys.GAk = GAk; vys.kappa = kappa;
      vys.fnW = fn;
      vys.oblasti = pr.oblasti.map(g => ({ id: g.id, nazev: g.nazev, typ: g.typ, E: g.E, sigmaDov: g.sigmaDov, yMax: g.yMax, sigma: n.Mmax * g.yMax * g.E / pr.EI }));
      // smyk mezi vrstvami (střední smykové napětí na neutrální ose, průměr přes šířku)
      vys.tau = Math.abs(n.Vmax) * pr.ESNO / (pr.EI * geo.sirkaNO);
      if (o.smykMeziVrstvami) vys.tauDov = s.sigma * s.kSZ / Math.sqrt(3);
    }
    // využití: skořepina (perimetry + plné vrstvy, nebo plný průřez) a zvlášť výplň
    let nosne = null, vypl = null;
    for (const ob of vys.oblasti) {
      ob.vyuziti = ob.sigmaDov > 0 ? Math.abs(ob.sigma) / ob.sigmaDov : (Math.abs(ob.sigma) > 0 ? Infinity : 0);
      if (ob.typ === 'vypln') vypl = ob;
      else if (!nosne || ob.vyuziti > nosne.vyuziti) nosne = ob;
    }
    vys.rozhodujici = nosne;
    vys.bezpecnost = nosne ? (nosne.vyuziti > 0 ? 1 / nosne.vyuziti : Infinity) : Infinity;
    vys.vyuzitiVypln = vypl ? vypl.vyuziti : null;
    vys.bezpecnostSmyk = vys.tauDov ? (vys.tau > 0 ? vys.tauDov / vys.tau : Infinity) : null;
    vys.bezpecnostCelk = Math.min(vys.bezpecnost, vys.bezpecnostSmyk == null ? Infinity : vys.bezpecnostSmyk);
    return vys;
  }

  /**
   * Hlavní výpočet. Vrací { chyby } nebo kompletní výsledek se scénáři a obálkou.
   */
  function vypocet(vstup) {
    const v = kopie(vstup);
    v.sily = (v.sily || []).map(s => ({ F: +s.F, a: s.a == null ? 0 : +s.a }));
    const chyby = validuj(v);
    if (chyby.length) return { chyby };
    const geo = geometrie(v);
    const nej = nejiste(v);
    const homog = v.tisk.model === 'homogenni';
    const rho = homog ? 1 : v.tisk.vypln;
    // hmotnost na délku (nominální), g/mm³ = hustota/1000
    const Ahmot = geo.oblasti.reduce((s, g) => s + g.A * (g.typ === 'vypln' ? rho : 1), 0);
    const Acelk = geo.oblasti.reduce((s, g) => s + g.A, 0);
    const hmotnost = Ahmot * v.L * v.material.hustota / 1000; // g
    let qG = 0;
    if (v.vlastniTiha && v.uloha !== 'tah') qG = Ahmot * v.material.hustota * 1e-6 * G_ZEME; // N/mm
    const qCelk = (v.uloha === 'tah' ? 0 : (v.q || 0)) + qG;
    const zakl = { geo };
    if (v.uloha !== 'tah') zakl.nos = nosnik(v.uloha, v.L, v.sily, qCelk);

    const nom = vypocetScenare(v, geo, scenarZ(nej, p => stred(p.iv), v.material.nu), zakl);
    // obálka přes všechny rohy relevantních intervalů
    const rel = nej.filter(p => p.jen !== false && p.iv[1] > p.iv[0]);
    const pevne = nej.filter(p => !(p.jen !== false && p.iv[1] > p.iv[0]));
    let min = null, max = null, pocet = 0, pesPev = null, optPev = null;
    const obalka = { wMax: [Infinity, -Infinity], bezpecnost: [Infinity, -Infinity], bezpecnostCelk: [Infinity, -Infinity], EI: [Infinity, -Infinity], EA: [Infinity, -Infinity], sigmaRozh: [Infinity, -Infinity], tau: [Infinity, -Infinity], vyuzitiVypln: [Infinity, -Infinity], wOhyb: [Infinity, -Infinity], wSmyk: [Infinity, -Infinity] };
    const nRoh = 1 << rel.length;
    for (let k = 0; k < nRoh; k++) {
      const s = { nu: v.material.nu };
      for (const p of pevne) s[p.klic] = stred(p.iv);
      rel.forEach((p, i) => { s[p.klic] = (k >> i) & 1 ? p.iv[1] : p.iv[0]; });
      const r = vypocetScenare(v, geo, s, zakl);
      pocet++;
      const upd = (kl, x) => { if (x == null || !isFinite(x) && kl !== 'bezpecnost' && kl !== 'bezpecnostCelk') return; obalka[kl][0] = Math.min(obalka[kl][0], x); obalka[kl][1] = Math.max(obalka[kl][1], x); };
      upd('wMax', Math.abs(r.wMax)); upd('bezpecnost', r.bezpecnost); upd('bezpecnostCelk', r.bezpecnostCelk);
      upd('EI', r.EI); upd('EA', r.EA); upd('sigmaRozh', r.rozhodujici ? Math.abs(r.rozhodujici.sigma) : 0);
      if (r.tau != null) upd('tau', r.tau);
      if (r.vyuzitiVypln != null) upd('vyuzitiVypln', r.vyuzitiVypln);
      if (r.wOhyb != null) { upd('wOhyb', Math.abs(r.wOhyb)); upd('wSmyk', Math.abs(r.wSmyk)); }
      if (!min || Math.abs(r.wMax) > Math.abs(min.wMax)) min = r;           // nejpoddajnější kombinace
      if (!max || Math.abs(r.wMax) < Math.abs(max.wMax)) max = r;           // nejtužší kombinace
      if (!pesPev || r.bezpecnostCelk < pesPev.bezpecnostCelk) pesPev = r;  // nejnižší bezpečnost
      if (!optPev || r.bezpecnostCelk > optPev.bezpecnostCelk) optPev = r;
    }
    for (const kl of Object.keys(obalka)) if (obalka[kl][0] === Infinity && obalka[kl][1] === -Infinity) obalka[kl] = null;

    // citlivost: každá veličina zvlášť na mez, ostatní ve středu
    const citlivost = rel.map(p => {
      const r = [p.iv[0], p.iv[1]].map(h => {
        const s = scenarZ(nej, q => q.klic === p.klic ? h : stred(q.iv), v.material.nu);
        return vypocetScenare(v, geo, s, zakl);
      });
      return { klic: p.klic, nazev: p.nazev, iv: p.iv, w: [Math.abs(r[0].wMax), Math.abs(r[1].wMax)], bezp: [r[0].bezpecnostCelk, r[1].bezpecnostCelk] };
    }).sort((a, b) => Math.abs(b.w[1] - b.w[0]) - Math.abs(a.w[1] - a.w[0]));

    const vys = {
      vstup: v, geo, nejiste: nej, relevantni: rel.map(p => p.klic), pocetRohu: pocet,
      Acelk, Ahmot, hmotnost, qG, qCelk, nos: zakl.nos || null,
      nominal: nom, poddajny: min, tuhy: max, pesPev, optPev, obalka, citlivost,
    };
    vys.varovani = varovani(vys);
    vys.verdikt = verdikt(vys);
    return vys;
  }

  function verdikt(r) {
    const cil = r.vstup.pozadovanaBezpecnost;
    const ob = r.obalka.bezpecnostCelk;
    if (!ob) return { stav: 'nejasne', text: 'Bez výsledku' };
    if (ob[0] >= cil) return { stav: 'ok', text: 'Vyhovuje i v nejméně příznivé kombinaci (bezpečnost ≥ ' + fmt(cil) + ').' };
    if (ob[0] < 1) {
      if (ob[1] < 1) return { stav: 'chyba', text: 'Nevyhovuje: napětí překročí pevnost ve všech kombinacích – díl se pravděpodobně poruší.' };
      return { stav: 'chyba', text: 'Nespolehlivé: v nepříznivé kombinaci napětí překročí pevnost (bezpečnost < 1).' };
    }
    if (ob[1] < cil) return { stav: 'mez', text: 'Nevyhovuje požadované bezpečnosti ' + fmt(cil) + ' v žádné kombinaci, i když pevnost nepřekročí.' };
    return { stav: 'mez', text: 'Nejisté: požadovanou bezpečnost ' + fmt(cil) + ' splní jen příznivější kombinace vstupů.' };
  }

  function varovani(r) {
    const v = r.vstup, w = [];
    const m = MATERIALY[v.material.klic];
    if (m && m.nelinearni) w.push({ uroven: 'chyba', text: 'TPU je pryžovitý materiál – lineární model nosníku je pro něj jen hrubým odhadem tuhosti při malých průhybech, pevnost se tímto způsobem posoudit nedá.' });
    const wmax = r.obalka.wMax ? r.obalka.wMax[1] : 0;
    if (v.uloha !== 'tah' && wmax > 0.05 * v.L) w.push({ uroven: 'chyba', text: 'Průhyb přesahuje 5 % rozpětí (' + fmt(wmax) + ' mm) – předpoklad malých deformací neplatí, skutečný průběh je nelineární.' });
    else if (v.uloha !== 'tah' && wmax > 0.02 * v.L) w.push({ uroven: 'mez', text: 'Průhyb nad 2 % rozpětí – lineární teorie se blíží hranici použitelnosti.' });
    const h = v.prurez.tvar === 'kruh' ? v.prurez.d : v.prurez.h;
    if (v.uloha !== 'tah' && v.L / h < 10) w.push({ uroven: 'mez', text: 'Krátký nosník (L/h = ' + fmt(v.L / h, 3) + ' < 10): roste vliv smyku a místních napětí pod silou a v podporách; Euler–Bernoulli je zde nepřesný.' });
    if (v.uloha !== 'tah' && r.nos) {
      const kraj = r.nos.sily.some(s => s.a < 1e-9 || Math.abs(s.a - v.L) < 1e-9);
      if (kraj && v.uloha === 'prosty') w.push({ uroven: 'info', text: 'Síla leží přímo nad podporou – přejde do reakce a nosník neohýbá.' });
    }
    if (v.tisk.model !== 'homogenni') {
      const vypl = r.geo.oblasti.find(g => g.typ === 'vypln');
      if (!vypl) w.push({ uroven: 'info', text: 'Perimetry a plné vrstvy vyplní celý průřez – výplň se neuplatní (díl je prakticky plný).' });
      if (r.obalka.vyuzitiVypln && r.obalka.vyuzitiVypln[1] > 1) w.push({ uroven: 'mez', text: 'Výplň může být v nepříznivém případě přetížená (využití až ' + fmt(r.obalka.vyuzitiVypln[1] * 100, 3) + ' %). Porucha výplně nemusí znamenat zlom, ale snižuje tuhost a stabilitu stěn.' });
    }
    if (v.orientace === 'C' && v.uloha !== 'tah') w.push({ uroven: 'mez', text: 'Nastojato vede napětí přes spoje vrstev – křehký lom bez varování je typický. Pokud to tvar dovolí, tiskněte na boku.' });
    if (v.orientace === 'C' && v.uloha === 'tah') w.push({ uroven: 'mez', text: 'Tah ve směru Z namáhá spoje vrstev – rozhoduje soudržnost vrstev, která silně závisí na teplotě tisku a chlazení.' });
    if (r.nominal.bezpecnostSmyk != null && r.obalka.bezpecnostCelk && r.pesPev && r.pesPev.bezpecnostSmyk != null && r.pesPev.bezpecnostSmyk <= r.pesPev.bezpecnost) w.push({ uroven: 'mez', text: 'V nepříznivé kombinaci rozhoduje smyk mezi vrstvami (odhad τ_dov = σ·k_σ,Z/√3).' });
    if (m && m.Tg && m.Tg < 70) w.push({ uroven: 'info', text: 'Teplota skelného přechodu jen ~' + m.Tg + ' °C – pevnost a tuhost rychle klesají už nad ~45–50 °C.' });
    w.push({ uroven: 'info', text: 'Posuzuje se krátkodobé statické zatížení. Trvalé zatížení vede u termoplastů ke creepu (průhyb roste v čase), cyklické k únavě – obojí stránka nepočítá; volte vyšší bezpečnost.' });
    return w;
  }

  /* ------------------------------------------------------------------ diagramy */
  /** Vzorky průběhů pro graf: {x[], V[], M[], wNom[], wMin[], wMax[]} (V v N, M v N·mm, w v mm). */
  function prubehy(r, n) {
    n = n || 240;
    const v = r.vstup, L = v.L, nos = r.nos;
    const xs = [];
    for (let i = 0; i <= n; i++) xs.push(L * i / n);
    if (nos) for (const f of nos.sily) xs.push(f.a);
    xs.sort((a, b) => a - b);
    const out = { x: [], V: [], M: [], wNom: [], wPod: [], wTuh: [] };
    if (v.uloha === 'tah') {
      for (const x of xs) {
        out.x.push(x); out.V.push(0); out.M.push(0);
        out.wNom.push(v.sily[0].F * x / r.nominal.EA); out.wPod.push(v.sily[0].F * x / r.poddajny.EA); out.wTuh.push(v.sily[0].F * x / r.tuhy.EA);
      }
      return out;
    }
    let prev = null;
    for (const x of xs) {
      if (prev !== null && x === prev) continue;
      const skok = nos.sily.some(f => f.a === x) && x > 0 && x < L;
      if (skok) { // dvojice bodů pro skok posouvající síly
        out.x.push(x); out.V.push(nos.V(x, 'L')); out.M.push(nos.M(x));
        out.wNom.push(r.nominal.fnW(x)); out.wPod.push(r.poddajny.fnW(x)); out.wTuh.push(r.tuhy.fnW(x));
      }
      out.x.push(x); out.V.push(x === L ? nos.V(x, 'L') : nos.V(x, 'P')); out.M.push(nos.M(x));
      out.wNom.push(r.nominal.fnW(x)); out.wPod.push(r.poddajny.fnW(x)); out.wTuh.push(r.tuhy.fnW(x));
      prev = x;
    }
    if (v.uloha === 'prosty') { out.V[0] = nos.V(0, 'P'); }
    return out;
  }

  /* ------------------------------------------------------------------ protokol */
  function protokol(r, datum) {
    const v = r.vstup, m = v.material, n = r.nominal, rad = [];
    const P = s => rad.push(s);
    const iv = a => fmt(a[0]) + ' až ' + fmt(a[1]);
    P('VÝPOČTOVÝ PROTOKOL – ORIENTAČNÍ POSOUZENÍ FDM VÝTISKU');
    P('Vytvořeno: ' + (datum || new Date().toISOString().slice(0, 10)) + ' · nástroj „Pevnost výtisků“ (orientační, nenahrazuje zkoušku ani statika)');
    P('');
    P('1. ZADÁNÍ');
    P('   Úloha: ' + ULOHY[v.uloha] + ', délka L = ' + fmt(v.L) + ' mm');
    if (v.prurez.tvar === 'kruh') P('   Průřez: kruh d = ' + fmt(v.prurez.d) + ' mm');
    else P('   Průřez: obdélník b = ' + fmt(v.prurez.b) + ' mm (šířka), h = ' + fmt(v.prurez.h) + ' mm (výška ve směru zatížení)');
    if (v.uloha === 'tah') P('   Zatížení: osová tahová síla F = ' + fmt(v.sily[0].F) + ' N');
    else {
      r.nos.sily.forEach((s, i) => P('   Osamělá síla F' + (i + 1) + ' = ' + fmt(s.F) + ' N ve vzdálenosti a = ' + fmt(s.a) + ' mm od ' + (v.uloha === 'prosty' ? 'levé podpory' : 'vetknutí')));
      if (v.q) P('   Spojité zatížení q = ' + fmt(v.q) + ' N/mm po celé délce');
      if (r.qG) P('   Vlastní tíha q_g = ' + fmt(r.qG) + ' N/mm (A_hmot = ' + fmt(r.Ahmot) + ' mm², ρ = ' + fmt(m.hustota) + ' g/cm³)');
    }
    P('   Materiál: ' + (MATERIALY[m.klic] ? MATERIALY[m.klic].nazev : m.klic) + '; E = ' + iv(m.E) + ' MPa, σ = ' + iv(m.sigma) + ' MPa, ν = ' + fmt(m.nu));
    if (v.tisk.model === 'homogenni') P('   Model průřezu: homogenní plný průřez (bez vlivu tisku)');
    else {
      P('   Tisk: orientace ' + ORIENTACE[v.orientace].nazev.toLowerCase() + ', perimetry ' + v.tisk.nPerim + ' × ' + fmt(v.tisk.stopa) + ' mm, plné vrstvy ' + v.tisk.nPlne + ' × ' + fmt(v.tisk.vrstva) + ' mm, výplň ' + fmt(v.tisk.vypln * 100) + ' %');
      P('   Faktory: plné vrstvy k_E = ' + iv(m.kEs) + ', k_σ = ' + iv(m.kSs) + '; směr Z k_E = ' + iv(m.kEZ) + ', k_σ = ' + iv(m.kSZ));
      P('   Výplň: E_výpl/E = ρ^n, n = ' + fmt(v.vyplnModel.nHor) + ' (horní mez) až ' + fmt(v.vyplnModel.nDol) + (v.vyplnModel.zanedbat ? ' (dolní mez: výplň zanedbána)' : ' (dolní mez)') + '; pevnost výplně 0,3·ρ^1,5 až ρ násobek σ');
    }
    P('');
    P('2. PRŮŘEZ (geometrie oblastí, souměrný průřez – neutrální osa ve středu)');
    for (const g of r.geo.oblasti) P('   ' + g.nazev + ': A = ' + fmt(g.A) + ' mm², I = ' + fmt(g.I) + ' mm⁴, y_max = ' + fmt(g.yMax) + ' mm');
    P('   Celkem A = ' + fmt(r.Acelk) + ' mm², A_hmot = ' + fmt(r.Ahmot) + ' mm², hmotnost dílu ≈ ' + fmt(r.hmotnost, 3) + ' g');
    P('   Tuhost (střední hodnoty): ' + (v.uloha === 'tah' ? 'EA = Σ E_i·A_i = ' + fmt(n.EA) + ' N' : 'EI = Σ E_i·I_i = ' + fmt(n.EI) + ' N·mm²'));
    for (const o of n.oblasti) P('     ' + o.nazev + ': E_i = ' + fmt(o.E) + ' MPa, σ_dov,i = ' + fmt(o.sigmaDov) + ' MPa');
    P('');
    if (v.uloha !== 'tah') {
      const nos = r.nos;
      P('3. STATIKA');
      if (v.uloha === 'prosty') {
        P('   R_A = Σ F_i·(L − a_i)/L + q·L/2 = ' + fmt(nos.RA) + ' N');
        P('   R_B = Σ F_i·a_i/L + q·L/2 = ' + fmt(nos.RB) + ' N');
      } else {
        P('   R_A = Σ F_i + q·L = ' + fmt(nos.RA) + ' N');
        P('   M_A = Σ F_i·a_i + q·L²/2 = ' + fmt(nos.MA) + ' N·mm');
      }
      P('   |V|max = ' + fmt(Math.abs(nos.Vmax)) + ' N (x = ' + fmt(nos.xV) + ' mm)');
      P('   M_max = ' + fmt(nos.Mmax) + ' N·mm = ' + fmt(nos.Mmax / 1000) + ' N·m (x = ' + fmt(nos.xM) + ' mm)');
      P('');
      P('4. NAPĚTÍ (σ_i = M·y_max,i·E_i/EI; střední hodnoty)');
    } else {
      P('3. NAPĚTÍ V TAHU (σ_i = F·E_i/EA; střední hodnoty)');
    }
    for (const o of n.oblasti) P('   ' + o.nazev + ': σ = ' + fmt(Math.abs(o.sigma)) + ' MPa, využití ' + fmt(o.vyuziti * 100, 3) + ' %');
    if (n.tau != null) P('   Smyk na neutrální ose (průměr přes šířku): τ = V·Σ(E_i·S_i)/(EI·b) = ' + fmt(n.tau) + ' MPa' + (n.tauDov ? ', odhad pevnosti spoje vrstev τ_dov = σ·k_σ,Z/√3 = ' + fmt(n.tauDov) + ' MPa' : ' (nepůsobí mezi vrstvami)'));
    P('');
    P((v.uloha === 'tah' ? '4' : '5') + '. DEFORMACE');
    if (v.uloha === 'tah') P('   ΔL = F·L/EA = ' + fmt(n.dL) + ' mm (střední hodnoty)');
    else {
      P('   Ohyb (Euler–Bernoulli, uzavřené vzorce + superpozice): w_ohyb,max = ' + fmt(n.wOhyb) + ' mm');
      if (v.smyk !== false) P('   Smyk (Timošenko, κ = ' + fmt(n.kappa, 3) + ', κ·ΣG·A = ' + fmt(n.GAk) + ' N): w_smyk,max = ' + fmt(n.wSmyk) + ' mm');
      P('   Celkem w_max = ' + fmt(n.wMax) + ' mm v x = ' + fmt(n.xw) + ' mm (střední hodnoty)');
    }
    P('');
    P((v.uloha === 'tah' ? '5' : '6') + '. NEJISTOTA (obálka přes ' + r.pocetRohu + ' kombinací mezí: ' + (r.relevantni.length ? r.relevantni.join(', ') : 'žádná nejistá veličina') + ')');
    const ob = r.obalka;
    P('   ' + (v.uloha === 'tah' ? 'Prodloužení' : 'Max. průhyb') + ': ' + fmt(ob.wMax[0]) + ' až ' + fmt(ob.wMax[1]) + ' mm (střed ' + fmt(Math.abs(n.wMax)) + ' mm)');
    P('   Napětí v rozhodující oblasti: ' + fmt(ob.sigmaRozh[0]) + ' až ' + fmt(ob.sigmaRozh[1]) + ' MPa');
    P('   Bezpečnost (pevnost / napětí, vč. smyku mezi vrstvami): ' + fmtB(ob.bezpecnostCelk[0]) + ' až ' + fmtB(ob.bezpecnostCelk[1]) + ' (střed ' + fmtB(n.bezpecnostCelk) + '), požadováno ' + fmt(v.pozadovanaBezpecnost));
    P('   Zatížení na mezi pevnosti ≈ ' + fmtB(ob.bezpecnostCelk[0]) + ' až ' + fmtB(ob.bezpecnostCelk[1]) + ' × zadané zatížení (lineární úměra)');
    if (r.citlivost.length) {
      P('   Citlivost (jedna veličina na mezi, ostatní ve středu) – ' + (v.uloha === 'tah' ? 'prodloužení' : 'průhyb') + ':');
      for (const c of r.citlivost) P('     ' + c.nazev + ' [' + iv(c.iv) + ']: ' + fmt(c.w[0]) + ' / ' + fmt(c.w[1]) + ' mm; bezpečnost ' + fmtB(c.bezp[0]) + ' / ' + fmtB(c.bezp[1]));
    }
    P('   Závěr: ' + r.verdikt.text);
    P('');
    P((v.uloha === 'tah' ? '6' : '7') + '. UPOZORNĚNÍ A PŘEDPOKLADY');
    for (const w of r.varovani) P('   – ' + w.text);
    P('   – Lineárně pružný materiál, malé deformace, rovinné řezy zůstávají rovinné, dokonalé spojení oblastí průřezu.');
    P('   – Nezahrnuto: koncentrace napětí (díry, vruby, ostré rohy), místní otlačení pod silou, vzpěr a boulení stěn, creep, únava, teplota, vlhkost, vady tisku.');
    P('   – Střední hodnota = střed intervalů, nikoli statisticky nejpravděpodobnější hodnota.');
    return rad.join('\n');
  }
  function fmtB(x) { return x === Infinity ? '∞' : fmt(x, 3); }

  /* ------------------------------------------------------------------ výchozí vstup a příklady */
  function materialVstup(klic) {
    const m = MATERIALY[klic];
    return { klic, E: m.E.slice(), sigma: m.sigma.slice(), kEZ: m.kEZ.slice(), kSZ: m.kSZ.slice(), kEs: VYCHOZI_SKIN.kEs.slice(), kSs: VYCHOZI_SKIN.kSs.slice(), nu: m.nu, hustota: m.hustota };
  }
  function vychozi() {
    return {
      uloha: 'prosty', L: 100, prurez: { tvar: 'obdelnik', b: 10, h: 10 },
      sily: [{ F: 100, a: 50 }], q: 0, vlastniTiha: false,
      material: materialVstup('PLA'), orientace: 'B',
      tisk: { model: 'tisk', nPerim: 3, stopa: 0.45, nPlne: 4, vrstva: 0.2, vypln: 0.2 },
      vyplnModel: { nHor: 1, nDol: 2, zanedbat: false }, smyk: true, pozadovanaBezpecnost: 2,
    };
  }
  /** Homogenní materiál s pevnými hodnotami (pro ověřovací příklady). */
  function pevnyMaterial(E, sigma, nu) {
    return { klic: 'VLASTNI', E: [E, E], sigma: [sigma, sigma], kEZ: [1, 1], kSZ: [1, 1], kEs: [1, 1], kSs: [1, 1], nu: nu == null ? 0.35 : nu, hustota: 1.2 };
  }

  // Příklady s ručním výpočtem: očekávané hodnoty jsou spočítané nezávisle (viz text 'rucne').
  const PRIKLADY = [
    {
      id: 'p1', nazev: 'Prostý nosník, síla uprostřed',
      vstup: () => Object.assign(vychozi(), { uloha: 'prosty', L: 100, prurez: { tvar: 'obdelnik', b: 10, h: 10 }, sily: [{ F: 100, a: 50 }], material: pevnyMaterial(3000, 50), tisk: { model: 'homogenni' }, smyk: false }),
      rucne: ['I = b·h³/12 = 10·10³/12 = 833,33 mm⁴', 'R_A = R_B = F/2 = 50 N', 'M_max = F·L/4 = 100·100/4 = 2 500 N·mm', 'σ = M·(h/2)/I = 2 500·5/833,33 = 15,0 MPa', 'w = F·L³/(48·E·I) = 100·10⁶/(48·3 000·833,33) = 0,8333 mm'],
      ocekavane: { RA: 50, RB: 50, Mmax: 2500, sigma: 15, w: 100 * 1e6 / (48 * 3000 * 833.3333333) },
    },
    {
      id: 'p2', nazev: 'Konzola, síla na volném konci',
      vstup: () => Object.assign(vychozi(), { uloha: 'konzola', L: 80, prurez: { tvar: 'obdelnik', b: 20, h: 5 }, sily: [{ F: 10, a: 80 }], material: pevnyMaterial(2000, 50), tisk: { model: 'homogenni' }, smyk: false }),
      rucne: ['I = 20·5³/12 = 208,33 mm⁴', 'R_A = F = 10 N, M_A = F·L = 800 N·mm', 'σ = 800·2,5/208,33 = 9,60 MPa', 'w = F·L³/(3·E·I) = 10·512 000/(3·2 000·208,33) = 4,096 mm'],
      ocekavane: { RA: 10, Mmax: -800, sigma: 9.6, w: 4.096 },
    },
    {
      id: 'p3', nazev: 'Prostý nosník, síla mimo střed',
      vstup: () => Object.assign(vychozi(), { uloha: 'prosty', L: 200, prurez: { tvar: 'obdelnik', b: 10, h: 20 }, sily: [{ F: 50, a: 50 }], material: pevnyMaterial(2500, 50), tisk: { model: 'homogenni' }, smyk: false }),
      rucne: ['I = 10·20³/12 = 6 666,7 mm⁴; a = 50 mm, b = 150 mm', 'R_A = F·b/L = 37,5 N; R_B = F·a/L = 12,5 N', 'M_max = F·a·b/L = 1 875 N·mm; σ = 1 875·10/6 666,7 = 2,8125 MPa', 'Síla je blíž levé podpoře (a < b), maximum průhybu leží v delším poli: w_max = F·a·(L² − a²)^(3/2)/(9·√3·L·E·I) = 50·50·37 500^1,5/(9·√3·200·2 500·6 666,7) = 0,34939 mm', 'v místě x = L − √((L² − a²)/3) = 200 − 111,80 = 88,20 mm (pod silou jen w(a) = F·a²·b²/(3·E·I·L) = 0,2813 mm)'],
      ocekavane: { RA: 37.5, RB: 12.5, Mmax: 1875, sigma: 2.8125, w: 50 * 50 * Math.pow(200 * 200 - 50 * 50, 1.5) / (9 * Math.sqrt(3) * 200 * 2500 * (10 * 8000 / 12)), xw: 200 - Math.sqrt((200 * 200 - 50 * 50) / 3) },
    },
    {
      id: 'p4', nazev: 'Prostý nosník, spojité zatížení',
      vstup: () => Object.assign(vychozi(), { uloha: 'prosty', L: 300, prurez: { tvar: 'obdelnik', b: 15, h: 15 }, sily: [], q: 0.5, material: pevnyMaterial(2000, 50), tisk: { model: 'homogenni' }, smyk: false }),
      rucne: ['I = 15⁴/12 = 4 218,75 mm⁴', 'R_A = R_B = q·L/2 = 75 N', 'M_max = q·L²/8 = 0,5·90 000/8 = 5 625 N·mm; σ = 5 625·7,5/4 218,75 = 10,0 MPa', 'w = 5·q·L⁴/(384·E·I) = 5·0,5·8,1·10⁹/(384·2 000·4 218,75) = 6,25 mm'],
      ocekavane: { RA: 75, RB: 75, Mmax: 5625, sigma: 10, w: 6.25 },
    },
    {
      id: 'p5', nazev: 'Tisk nastojato: složený průřez',
      vstup: () => Object.assign(vychozi(), { uloha: 'konzola', L: 50, prurez: { tvar: 'obdelnik', b: 10, h: 10 }, sily: [{ F: 20, a: 50 }], material: pevnyMaterial(3000, 50), orientace: 'C', tisk: { model: 'tisk', nPerim: 2, stopa: 0.5, nPlne: 4, vrstva: 0.2, vypln: 0.2 }, vyplnModel: { nHor: 1, nDol: 1, zanedbat: false }, smyk: false }),
      rucne: ['Perimetry: t = 2·0,5 = 1 mm → rám 10×10 bez jádra 8×8', 'I_rám = (10⁴ − 8⁴)/12 = 492,0 mm⁴; I_jádro = 8⁴/12 = 341,33 mm⁴', 'Výplň 20 %, model E_výpl = ρ·E (n = 1) → EI = 3 000·(492 + 0,2·341,33) = 1 680 800 N·mm²', 'M = F·L = 1 000 N·mm; σ_rám = 1 000·5·3 000/1 680 800 = 8,924 MPa', 'w = F·L³/(3·EI) = 20·125 000/(3·1 680 800) = 0,4958 mm (o 49 % víc než plný průřez)'],
      ocekavane: { RA: 20, Mmax: -1000, sigma: 1000 * 5 * 3000 / 1680800, w: 20 * 125000 / (3 * 1680800), EI: 1680800 },
    },
    {
      id: 'p6', nazev: 'Prostý tah',
      vstup: () => Object.assign(vychozi(), { uloha: 'tah', L: 100, prurez: { tvar: 'obdelnik', b: 10, h: 10 }, sily: [{ F: 1000, a: 0 }], material: pevnyMaterial(3000, 50), tisk: { model: 'homogenni' } }),
      rucne: ['A = 10·10 = 100 mm²', 'σ = F/A = 1 000/100 = 10,0 MPa; bezpečnost 50/10 = 5,0', 'ΔL = F·L/(E·A) = 1 000·100/(3 000·100) = 0,3333 mm'],
      ocekavane: { sigma: 10, w: 1000 * 100 / (3000 * 100) },
    },
  ];

  /** Ověří příklad: vrátí seznam {co, ocekavano, vypocteno, ok}. */
  function overPriklad(p) {
    const r = vypocet(p.vstup());
    const o = p.ocekavane, n = r.nominal, out = [];
    const kontrola = (co, a, b) => out.push({ co, ocekavano: a, vypocteno: b, ok: Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a)) });
    if (o.RA != null) kontrola('R_A [N]', o.RA, r.nos.RA);
    if (o.RB != null) kontrola('R_B [N]', o.RB, r.nos.RB);
    if (o.Mmax != null) kontrola('M_max [N·mm]', o.Mmax, r.nos.Mmax);
    if (o.EI != null) kontrola('EI [N·mm²]', o.EI, n.EI);
    if (o.sigma != null) kontrola('σ_max [MPa]', o.sigma, Math.abs(n.rozhodujici.sigma));
    if (o.w != null) kontrola(p.vstup().uloha === 'tah' ? 'ΔL [mm]' : 'w_max [mm]', o.w, Math.abs(n.wMax));
    if (o.xw != null) kontrola('x(w_max) [mm]', o.xw, n.xw);
    return { r, kontroly: out };
  }

  const API = {
    ZDROJE, MATERIALY, VYCHOZI_SKIN, ORIENTACE, ULOHY, PRIKLADY,
    fmt, geometrie, prurezScenar, nosnik, maxPruhyb, validuj, nejiste, vypocetScenare, vypocet, prubehy, protokol,
    materialVstup, vychozi, pevnyMaterial, overPriklad,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.PevnostTisku = API;
})();

/* ============================================================
   Kolíkovací a kapsové přípravky – výpočetní jádro (bez DOM)
   Režimy: kolik (kolíkový spoj), konfirmat, excentr, kapsa (pocket hole 15°), centr (centrovací měrky kolíků).

   Souřadnice dílů (mm):
   - Díl A (vrtá se do čela / hrany): x ∈ [0, W] podél spoje (x = 0 je referenční konec, kam se opírá doraz
     přípravku), y ∈ [0, DA] od spojované plochy (čela) do dílu, z ∈ [0, tA] přes tloušťku, z = 0 je líc.
   - Díl B: u spoje „hrana“ stejně jako A; u „roh“ / „T“ leží B naplocho, x ∈ [0, W], y ∈ [0, DB] od
     referenčního konce (čela B), z ∈ [0, tB], z = 0 vnější líc, spoj je na vnitřní ploše z = tB.
   - Sestava: rigidní transformace dílů do společného rámu (u „hrana“ je rám A, u „roh“ / „T“ rám B).
     Díra = {p: bod na ploše, n: směr do materiálu, d, hl}. Po složení musí díry A a B ležet na jedné ose
     s opačnými směry – to hlídají testy (zrcadlení protikusu).
   - Kapsa: řez kolmo na spoj; x podél dílu A k čelu (čelo x = 0, materiál x < 0), z přes tloušťku
     (líc z = 0, kapsa na rubu z = tA), šířka y. Vrut míří do protikusu (x > 0) pod úhlem α.
   Typické hodnoty (tabulky vrutů, kolíků, excentrů) jsou orientační a editovatelné.
   ============================================================ */
(function (koren) {
  'use strict';
  const r2 = (x) => Math.round(x * 100) / 100;
  const r1 = (x) => Math.round(x * 10) / 10;
  const RAD = Math.PI / 180;
  const cz = (x, d) => (x == null || !isFinite(x) ? '–' : String(Math.round(x * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d)).replace('.', ',').replace('-', '−'));
  const kopie = (o) => JSON.parse(JSON.stringify(o));

  /* ---------------- typická pravidla (editovatelná) ---------------- */
  const PRAVIDLA = {
    // kolíky
    prumery: [6, 8, 10, 12],
    prumerKoef: 0.45,            // Ø kolíku ≤ 0,45 × menší tloušťky (nejbližší nižší z řady), min. 6
    delkyKoliku: { 6: [25, 30, 35], 8: [30, 35, 40], 10: [40, 50], 12: [50, 60] },
    plochaKoef: 0.65,            // hloubka do plochy ≈ 0,65 × tloušťky protikusu …
    zbytekMin: 5,                // … a pod dnem díry musí zůstat aspoň 5 mm
    celoPodil: 2 / 3,            // podíl délky kolíku v čele (zbytek v ploše)
    vuleDno: 1,                  // prostor pro lepidlo pod koncem kolíku (každá díra)
    roztecMax: 128,              // největší rozteč kolíků
    odsazeniMin: 25,             // nejmenší odsazení krajního kolíku od kraje (a aspoň 2 × Ø)
    stenaMin: 3,                 // nejmenší stěna mezi dírou a lícem
    tauLepidlo: { masiv: 3.0, preklizka: 2.5, mdf: 1.5, dtd: 1.0 },   // MPa – orientační smyková pevnost lepené spáry kolíku
    tauKolik: 8,                 // MPa – orientační střih bukového kolíku
    // kapsové spoje
    kapsaUhel: 15,
    kapsaPilot: 3.5,             // Ø pilotní části stupňovitého vrtáku (typicky)
    kapsaD: 9.5,                 // Ø kapsy (velký stupeň)
    kapsaDelkaPilotu: 25,        // od špičky ke stupni
    kapsaRezerva: 3,             // hrot vrutu nesmí dojít blíž než 3 mm k protější ploše
    kapsaPodHlavou: 6,           // nejmenší délka vrutu v dílu A (od hlavy po čelo)
    kapsaRoztecMax: 150,
    vrutD: 4.2,                  // Ø vrutu (orientačně pro výpočet)
    fAx: 12,                     // N/mm² – orientační výtažná pevnost vrutu (měkké dřevo ~10–15, DTD ~6)
    vruty: [                     // typická délka vrutu podle tloušťky dílu s kapsou (do tl. včetně)
      { doTl: 15, delka: 25 }, { doTl: 19, delka: 32 }, { doTl: 25, delka: 38 }, { doTl: 32, delka: 50 }, { doTl: 38, delka: 63 },
    ],
    // konfirmát a excentr (typické rozměry)
    konfirmatD: 7, konfirmatPilot: 5, konfirmatDelka: 50, konfirmatHlava: 10, konfirmatRezerva: 2,
    excentrD: 15, excentrHloubka: 13, excentrOdHrany: 24, excentrSroub: 8, excentrCepD: 5, excentrCepH: 11, excentrStopka: 8,
  };

  /* ---------------- výchozí projekt ---------------- */
  const REZIMY = {
    kolik: { nazev: 'Kolíkový spoj', ikona: '🪵', popis: 'Kolíkovací přípravek na čelo / hranu (samostředicí nebo s dorazem od líce) a deska na plochu protikusu, zrcadlený protikus, hloubkové kroužky.' },
    kapsa: { nazev: 'Kapsový spoj', ikona: '📐', popis: 'Přípravek na šikmé kapsy (pocket hole) 15°: poloha otvoru podle tloušťky, výstup vrutu ve středu protikusu, délka vrutu, kroužek na stupňovitý vrták.' },
    konfirmat: { nazev: 'Konfirmát', ikona: '🔩', popis: 'Předvrtání čela police Ø 5 a průchozí díra Ø 7 v boku – přípravek z boku do čela a deska na bok.' },
    excentr: { nazev: 'Excentr', ikona: '⚙️', popis: 'Excentrická spojka: otvor Ø 15 v ploše police, šroub do čela a čep do boku – jeden přípravek vede obě díry v polici.' },
    centr: { nazev: 'Centrovací měrky', ikona: '🎯', popis: 'Centrovací čepy kolíků (dowel center) do vyvrtaných děr – přenesou polohu na protikus. STL sada.' },
  };

  function vychoziProjekt(rezim) {
    return {
      rezim: rezim || 'kolik', nazev: '',
      spoj: { typ: 'roh', tA: 18, tB: 18, sirka: 300, poloha: 120, delkaA: 220, delkaB: 260, material: 'masiv', stredeni: 'stred', odLice: 9, zarovnani: 'lic' },
      rozlozeni: { zpusob: 'auto', pocet: 3, roztec: 96, odsazeni: 32, odsazeniKonec: 32 },
      kolik: { prumer: 'auto', delka: 'auto', hloubkaA: 'auto', hloubkaB: 'auto' },
      konfirmat: { delka: 50 },
      excentr: { odHrany: 24, hloubka: 13, cep: 5 },
      kapsa: { typ: 'rovina', vrut: 'auto', dvojity: false, roztecVodítek: 22, pocet: 'auto', sirka: 70, odsazeni: 20 },
      centr: { prumery: [6, 8, 10], kusu: 4, delkaCepu: 8, hrot: 2.5, spendlik: true, vule: 0.05 },
      pripravek: {
        Hv: 14, stena: 4, vyskaLic: 20, doraz: 5, dorazHl: 12, vuleSevreni: 0.3,
        otvor: 'vule', vule: 0.25, pouzdroD: 'auto', presah: 0.05, pouzdroDelka: 'auto',
        stul: 220, oznaceni: true, kapka: true, protikus: 'zrcadlo',
        krouzekV: 10, krouzekStena: 4, sroubek: 3, vodiciDelka: 30, kridlo: 8,
      },
      pravidla: kopie(PRAVIDLA),
      tisk: { papir: 'a4', papirW: 210, papirH: 297, okraj: 8, prekryv: 12, kalibX: 100, kalibY: 100, chlopen: 14 },
    };
  }

  /* ---------------- lineární algebra (rigidní transformace) ---------------- */
  const I3 = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const T = (R, t) => ({ R, t });
  const pouzij = (M, p) => [0, 1, 2].map((i) => M.R[i][0] * p[0] + M.R[i][1] * p[1] + M.R[i][2] * p[2] + M.t[i]);
  const smer = (M, v) => [0, 1, 2].map((i) => M.R[i][0] * v[0] + M.R[i][1] * v[1] + M.R[i][2] * v[2]);
  const transp = (R) => [0, 1, 2].map((i) => [0, 1, 2].map((j) => R[j][i]));
  const inverze = (M) => { const Rt = transp(M.R), t = smer({ R: Rt }, M.t); return T(Rt, t.map((x) => -x)); };
  const det = (R) => R[0][0] * (R[1][1] * R[2][2] - R[1][2] * R[2][1]) - R[0][1] * (R[1][0] * R[2][2] - R[1][2] * R[2][0]) + R[0][2] * (R[1][0] * R[2][1] - R[1][1] * R[2][0]);
  const vzd = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const skal = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const krat = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  /** vzdálenost osy (bod p, směr n) od bodu q */
  function odOsy(p, n, q) { const v = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], c = krat(v, n); return Math.hypot(...c) / Math.hypot(...n); }

  /* ---------------- volby z pravidel ---------------- */
  function prumerKoliku(t, Pr) {
    const k = Pr.prumery.slice().sort((a, b) => a - b);
    let d = k[0];
    for (const x of k) if (x <= Pr.prumerKoef * t + 1e-9) d = x;
    return d;
  }
  function hloubkaDoPlochy(t, Pr) { return Math.max(4, Math.min(Math.round(Pr.plochaKoef * t), t - Pr.zbytekMin)); }
  /** délka kolíku: nejbližší typická k hloubce do plochy / (1 − podíl čela) */
  function delkaKoliku(d, hB, Pr, hrana) {
    const rada = (Pr.delkyKoliku[d] || Pr.delkyKoliku[String(d)] || [d * 4]).slice().sort((a, b) => a - b);
    const cil = hrana ? Math.max(rada[0], 2 * hB) : hB / Math.max(0.2, 1 - Pr.celoPodil);
    let L = rada[0], e = Infinity;
    for (const x of rada) if (Math.abs(x - cil) < e - 1e-9) { e = Math.abs(x - cil); L = x; }
    return L;
  }
  /** typická délka vrutu podle tloušťky dílu s kapsou */
  function delkaVrutu(t, Pr) {
    const tab = (Pr.vruty || []).slice().sort((a, b) => a.doTl - b.doTl);
    for (const r of tab) if (t <= r.doTl + 1e-9) return r.delka;
    return tab.length ? tab[tab.length - 1].delka : 32;
  }

  /** polohy podél spoje */
  function polohy(W, R, d, Pr) {
    const var_ = [];
    const e0 = Math.max(0, +R.odsazeni || 0), e1 = Math.max(0, R.odsazeniKonec == null ? e0 : +R.odsazeniKonec);
    const L = W - e0 - e1;
    let xs = [];
    if (L < 0) { xs = [W / 2]; var_.push(`Spoj ${cz(W)} mm je kratší než součet odsazení – jediný kolík uprostřed.`); }
    else if (R.zpusob === 'roztec') {
      const r = Math.max(d + 3, +R.roztec || 32);
      const n = Math.floor(L / r + 1e-9) + 1;
      for (let i = 0; i < n; i++) xs.push(e0 + i * r);
    } else {
      let n;
      if (R.zpusob === 'pocet') n = Math.max(1, Math.round(+R.pocet || 2));
      else n = L < 1e-9 ? 1 : Math.max(2, Math.ceil(L / Pr.roztecMax - 1e-9) + 1);
      if (n === 1) xs = [L < 0 ? W / 2 : e0 + L / 2];
      else for (let i = 0; i < n; i++) xs.push(e0 + L * i / (n - 1));
    }
    xs = xs.map((x) => r2(x));
    for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] < d + 3) { var_.push(`Rozteč ${cz(xs[i] - xs[i - 1])} mm je menší než Ø + 3 mm – díry se slijí.`); break; }
    const odMin = Math.max(2 * d, Pr.odsazeniMin);
    if (xs.length && (xs[0] < odMin - 1e-9 || W - xs[xs.length - 1] < odMin - 1e-9)) var_.push(`Krajní díra je blíž než ${cz(odMin)} mm (2 × Ø, min. ${cz(Pr.odsazeniMin)}) ke kraji – hrozí vyštípnutí.`);
    const nDop = Math.max(2, Math.ceil(Math.max(0, W - 2 * odMin) / Pr.roztecMax - 1e-9) + 1);
    return { xs, varovani: var_, doporuceno: W < 2 * odMin ? 1 : nDop, odMin };
  }

  /** sestava: rigidní transformace dílů do rámu sestavy */
  function sestava(S, vA, vB) {
    const W = +S.sirka;
    if (S.typ === 'hrana') return { A: T(I3(), [0, 0, 0]), B: T([[-1, 0, 0], [0, -1, 0], [0, 0, 1]], [W, 0, vA - vB]), ram: 'A' };
    const yoff = S.typ === 'T' ? Math.max(0, +S.poloha || 0) : 0;
    return { A: T([[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [W, yoff, +S.tB]), B: T(I3(), [0, 0, 0]), ram: 'B', yoff };
  }

  /** z díry A spočítá požadovanou díru v B (stejná osa po složení, opačný směr) */
  function protidira(q, ses) {
    const pw = pouzij(ses.A, q.p), nw = smer(ses.A, q.n), iB = inverze(ses.B);
    const p = pouzij(iB, pw).map((x) => r2(x)), n = smer(iB, nw).map((x) => -Math.round(x));
    return { p, n };
  }

  /* ---------------- návrh spoje (kolík / konfirmát / excentr) ---------------- */
  function navrhSpoje(P) {
    const S = Object.assign({}, P.spoj), Pr = Object.assign({}, PRAVIDLA, P.pravidla || {}), J = Object.assign({}, vychoziProjekt().pripravek, P.pripravek || {});
    const rez = P.rezim, varovani = [], info = [];
    if (rez !== 'kolik' && S.typ === 'hrana') S.typ = 'roh';
    const tA = Math.max(4, +S.tA || 18), tB = Math.max(4, +S.tB || 18), W = Math.max(10, +S.sirka || 300);
    S.tA = tA; S.tB = tB; S.sirka = W;
    let stredeni = S.stredeni === 'lic' ? 'lic' : 'stred';
    if (rez === 'excentr' && stredeni === 'lic') { stredeni = 'stred'; info.push('Excentr: šroub musí mířit do osy excentru – přípravek se středí na tloušťku.'); }
    const vA = stredeni === 'stred' ? tA / 2 : Math.max(1, +S.odLice || tA / 2);
    let vB = vA;
    if (S.typ === 'hrana') vB = S.zarovnani === 'osa' ? tB / 2 : vA;

    // průměry a hloubky podle prvku
    let dA, dB, hA, hB, prvekInfo = {}, delka = null;
    const hrana = S.typ === 'hrana';
    if (rez === 'kolik') {
      const K = P.kolik || {};
      dA = dB = K.prumer === 'auto' || !K.prumer ? prumerKoliku(Math.min(tA, tB), Pr) : +K.prumer;
      const hBauto = hrana ? null : hloubkaDoPlochy(tB, Pr);
      delka = K.delka === 'auto' || !K.delka ? delkaKoliku(dA, hrana ? 0 : hBauto, Pr, hrana) : +K.delka;
      if (hrana) {
        const pul = delka / 2 + Pr.vuleDno;
        hA = K.hloubkaA === 'auto' || !K.hloubkaA ? pul : +K.hloubkaA;
        hB = K.hloubkaB === 'auto' || !K.hloubkaB ? pul : +K.hloubkaB;
      } else {
        hB = K.hloubkaB === 'auto' || !K.hloubkaB ? hBauto : +K.hloubkaB;
        hA = K.hloubkaA === 'auto' || !K.hloubkaA ? delka - hB + 2 * Pr.vuleDno : +K.hloubkaA;
      }
      if (hA + hB < delka + 0.01) varovani.push(`Součet hloubek ${cz(hA + hB)} mm je menší než délka kolíku ${cz(delka)} mm – spoj se nedovře.`);
      if (dA > 0.5 * Math.min(tA, tB) + 1e-9) varovani.push(`Kolík Ø ${dA} je větší než polovina tloušťky – stěny budou slabé.`);
      prvekInfo = { d: dA, delka, podilCelo: hA / (hA + hB) };
    } else if (rez === 'konfirmat') {
      const K = P.konfirmat || {};
      delka = +K.delka || Pr.konfirmatDelka;
      dA = Pr.konfirmatPilot; dB = Pr.konfirmatD;
      hA = Math.max(10, delka - tB + Pr.konfirmatRezerva);
      hB = tB;     // průchozí
      prvekInfo = { d: Pr.konfirmatD, delka, hlava: Pr.konfirmatHlava };
      if (tA < 15) varovani.push('Konfirmát 7 mm potřebuje čelo tloušťky aspoň 15–16 mm.');
    } else {
      const K = P.excentr || {};
      const odH = Math.max(10, +K.odHrany || Pr.excentrOdHrany), hc = Math.max(5, +K.hloubka || Pr.excentrHloubka);
      dA = Pr.excentrSroub; dB = +K.cep || Pr.excentrCepD;
      hA = odH;    // vrtá se až do osy otvoru excentru
      hB = Pr.excentrCepH;
      prvekInfo = { d: Pr.excentrD, odHrany: odH, hloubka: hc, stopka: Pr.excentrStopka };
      if (hc > tA - 3) varovani.push(`Otvor excentru ${cz(hc)} mm je moc hluboký pro tl. ${cz(tA)} mm (zbytek < 3 mm).`);
      if (Math.abs(hc - tA / 2) > tA * 0.35) info.push('Hloubka otvoru excentru má odpovídat výšce osy šroubu – ověřte podle konkrétního excentru.');
    }
    if (!hrana && hB > tB - (rez === 'konfirmat' ? 0 : Pr.zbytekMin) + 1e-9 && rez !== 'konfirmat') varovani.push(`Hloubka do plochy ${cz(hB)} mm nechává pod dnem méně než ${Pr.zbytekMin} mm (tl. ${cz(tB)}) – hrozí provrtání lícu.`);
    if (vA - dA / 2 < Pr.stenaMin - 1e-9 || tA - vA - dA / 2 < Pr.stenaMin - 1e-9) varovani.push(`Díra Ø ${dA} ve vzdálenosti ${cz(vA)} mm od líce nechává stěnu pod ${Pr.stenaMin} mm (tl. ${cz(tA)}).`);
    if (hrana && (vB - dB / 2 < Pr.stenaMin - 1e-9 || tB - vB - dB / 2 < Pr.stenaMin - 1e-9)) varovani.push(`V protikusu (tl. ${cz(tB)}) leží díra ${cz(vB)} mm od líce – slabá stěna.`);
    if (S.typ === 'T' && (+S.poloha || 0) < 0) varovani.push('Poloha T-spoje musí být kladná.');

    const pol = polohy(W, P.rozlozeni || {}, Math.max(dA, dB), Pr);
    varovani.push(...pol.varovani);
    const ses = sestava(S, vA, vB);

    const diryA = pol.xs.map((x, i) => ({ p: [x, 0, r2(vA)], n: [0, 1, 0], d: dA, hl: r2(hA), typ: 'spoj', i }));
    const diryB = diryA.map((q) => Object.assign(protidira(q, ses), { d: dB, hl: r2(hB), typ: 'spoj', i: q.i, pruchozi: rez === 'konfirmat' }));
    const diryAplocha = [];
    if (rez === 'excentr') for (const q of diryA) diryAplocha.push({ p: [q.p[0], prvekInfo.odHrany, tA], n: [0, 0, -1], d: Pr.excentrD, hl: prvekInfo.hloubka, typ: 'excentr', i: q.i });

    // přípravky
    const pripravky = navrhPripravku({ S, J, rez, diryA, diryB, diryAplocha, vA, vB, tA, tB, W, ses, prvekInfo }, varovani, info);

    // pevnost (orientačně)
    const pevnost = rez === 'kolik' ? pevnostKoliku(dA, hA, hB, diryA.length, S.material, Pr) : null;
    if (pevnost && P.rozlozeni && P.rozlozeni.zpusob !== 'auto' && diryA.length < pol.doporuceno) info.push(`Podle šířky ${cz(W)} mm se doporučuje aspoň ${pol.doporuceno} spojovací prvky (rozteč do ${Pr.roztecMax} mm).`);

    const krouzky = krouzkyNavrhu(rez, { dA, dB, hA, hB, J, prvekInfo, Pr, pripravky });
    const R = {
      rezim: rez, spoj: S, stredeni, vA: r2(vA), vB: r2(vB), dA, dB, hA: r2(hA), hB: r2(hB), delka, prvek: prvekInfo,
      diryA, diryB, diryAplocha, sestava: ses, pripravky, krouzky, pevnost, polohy: pol, varovani, info,
      rozmery: rozmeryDilu(S, ses),
    };
    R.kusovnik = kusovnik(R, P);
    return R;
  }

  function rozmeryDilu(S, ses) {
    const W = S.sirka;
    if (S.typ === 'hrana') return { A: [W, +S.delkaA || 150, S.tA], B: [W, +S.delkaB || 150, S.tB] };
    const DB = Math.max(+S.delkaB || 200, (ses.yoff || 0) + S.tA + 40);
    return { A: [W, +S.delkaA || 200, S.tA], B: [W, DB, S.tB] };
  }

  function pevnostKoliku(d, hA, hB, n, material, Pr) {
    const tau = (Pr.tauLepidlo || {})[material] || 2;
    const h = Math.max(0, Math.min(hA, hB) - Pr.vuleDno);
    const Fl = Math.PI * d * h * tau, Fs = Math.PI * d * d / 4 * Pr.tauKolik;
    const F1 = Math.min(Fl, Fs);
    return { tau, h: r2(h), naKolik: Math.round(F1), lepidlo: Math.round(Fl), strih: Math.round(Fs), celkem: Math.round(F1 * n), kg: Math.round(F1 * n / 9.81), rozhoduje: Fl < Fs ? 'lepená spára' : 'střih kolíku' };
  }

  /* ---------------- otvor přípravku ---------------- */
  /** vrták d → otvor v přípravku {d, pouzdro, delka} */
  function otvorPripravku(d, J) {
    if (J.otvor === 'pouzdro' && d <= 16) {
      const D = J.pouzdroD === 'auto' || !J.pouzdroD ? typickePouzdro(d) : +J.pouzdroD;
      return { d: r2(D - (+J.presah || 0)), pouzdro: { vnitrni: d, vnejsi: D, delka: J.pouzdroDelka === 'auto' || !J.pouzdroDelka ? +J.Hv : +J.pouzdroDelka } };
    }
    return { d: r2(d + (+J.vule || 0)), pouzdro: null };
  }
  /** typický vnější průměr vrtacího pouzdra pro vrták d (orientačně; ověřte u svého pouzdra) */
  function typickePouzdro(d) { return d <= 4 ? 7 : d <= 6 ? 10 : d <= 8 ? 12 : d <= 10 ? 15 : d <= 12 ? 18 : d + 6; }

  /* ---------------- rozdělení dlouhého přípravku ---------------- */
  /**
   * Dělí řadu poloh xs (vzestupně) na části do délky stul. Sousední části sdílejí jednu díru (index):
   * po vyvrtání první části se do sdílené díry zasune kolík a další část se na něj navlékne.
   * Vrací [{x0, x1, xs, index:[x], doraz:bool}], x0/x1 = rozsah těla ve směru x (bez dorazu).
   */
  function deleni(xs, okrajKonec, stul, dorazNaZacatku, sDoraz, rmax) {
    const n = xs.length, out = [];
    if (!n) return out;
    const lo = dorazNaZacatku ? 0 : xs[0] - okrajKonec, hiAll = xs[n - 1] + okrajKonec;
    if (hiAll - lo + sDoraz <= stul || n < 2) return [{ x0: lo, x1: hiAll, xs: xs.slice(), index: [], doraz: true }];
    let i = 0;
    for (let k = 0; k < 400; k++) {
      const a = out.length ? xs[i] - okrajKonec : lo, s0 = out.length ? 0 : sDoraz;
      let j = i;
      while (j + 1 < n && xs[j + 1] + okrajKonec - a + s0 <= stul) j++;
      if (j === i && j < n - 1) j = i + 1;
      const b = xs[j] + okrajKonec;
      out.push({ x0: a, x1: b, xs: xs.slice(i, j + 1), index: out.length ? [xs[i]] : [], doraz: !out.length });
      if (j === n - 1) break;
      i = j;
    }
    return out;
  }

  /* ---------------- přípravky spoje ---------------- */
  /**
   * Popis přípravku (v souřadnicích vrtaného dílu – přípravek přiložený na díl):
   * druh 'hrana': těleso na čele/hraně dílu (y < 0), otvory ve směru +y.
   *    {profil:'U'|'L', t, Hv, stena, hc, s, hd, sevreni, dorazX: 0 | W (kde je koncový doraz), smerX: +1 | −1,
   *     casti:[{x0, x1, otvory:[{x, z, d, otvor}], index, doraz}], kridlo: {y, tl, otvory:[{x, y, d, otvor}]} }
   * druh 'deska': deska na ploše z = plocha, otvory ve směru −z, doraz u čela B (y = 0) a boční doraz u x = 0.
   */
  function navrhPripravku(c, varovani, info) {
    const { S, J, rez, diryA, diryB, diryAplocha, vA, vB, tA, tB, W } = c;
    const out = [];
    const stena = Math.max(2, +J.stena || 4), Hv = Math.max(4, +J.Hv || 14), hc = Math.max(6, +J.vyskaLic || 20), s = Math.max(2, +J.doraz || 5), hd = Math.max(3, +J.dorazHl || 12);
    const stul = Math.max(60, +J.stul || 220);
    const okr = (d) => otvorPripravku(d, J).d / 2 + stena + 4;
    const profil = c.S.stredeni === 'lic' && rez !== 'excentr' ? 'L' : 'U';
    if (Hv < 1.5 * Math.max(c.diryA[0] ? c.diryA[0].d : 8, 6) - 1e-9) varovani.push(`Výška vedení ${cz(Hv)} mm je menší než 1,5 × Ø vrtáku – vrták se v plastu může naklánět; zvětšete ji nebo použijte kovová pouzdra.`);

    function hranovy(id, dil, diry, t, v, dorazX, nazev, kridlo) {
      const xs = diry.map((q) => q.p[0]).slice().sort((a, b) => a - b);
      const d = diry[0] ? diry[0].d : 8, o = otvorPripravku(d, J);
      const smerX = dorazX === 0 ? 1 : -1;
      // dělení v souřadnici od dorazu
      const u = xs.map((x) => (smerX > 0 ? x : dorazX - x)).sort((a, b) => a - b);
      const ok = okr(d) + (kridlo ? 5 : 0);
      const cc = deleni(u, ok, stul, true, s, 0).map((q) => ({
        x0: smerX > 0 ? q.x0 : dorazX - q.x1, x1: smerX > 0 ? q.x1 : dorazX - q.x0, doraz: q.doraz,
        xs: q.xs.map((x) => r2(smerX > 0 ? x : dorazX - x)), index: q.index.map((x) => r2(smerX > 0 ? x : dorazX - x)),
      }));
      for (const q of cc) q.otvory = q.xs.map((x) => ({ x, z: r2(v), d, otvor: o.d, pouzdro: o.pouzdro }));
      if (kridlo) for (const q of cc) q.kridlo = q.xs.map((x) => ({ x, y: kridlo.y, d: kridlo.d, otvor: r2(kridlo.d + (+J.vule || 0)) }));
      const p = {
        id, dil, druh: 'hrana', nazev, profil: kridlo ? 'U' : (dil === 'B' && Math.abs(v - t / 2) > 1e-6 ? 'L' : profil), t, v, Hv, stena, hc, s, hd,
        sevreni: +J.vuleSevreni || 0.3, dorazX, smerX, casti: cc, otvor: o, vrtak: d, hloubka: diry[0] ? diry[0].hl : 0,
        kridlo: kridlo ? { y: kridlo.y, tl: kridlo.tl, d: kridlo.d, hloubka: kridlo.hloubka } : null,
      };
      if (p.profil === 'U' && Math.abs(v - t / 2) > 1e-6) p.profil = 'L';
      if (cc.length > 1) info.push(`${id}: přípravek je delší než tisková plocha ${stul} mm – rozdělen na ${cc.length} díly. Další díl se navlékne na kolík zasunutý do poslední vyvrtané díry (index).`);
      return p;
    }
    function deskovy(id, diry, plocha, nazev) {
      const d = diry[0] ? diry[0].d : 8, o = otvorPripravku(d, J);
      const xs = diry.map((q) => q.p[0]).slice().sort((a, b) => a - b), ys = diry.map((q) => q.p[1]);
      const ok = okr(d);
      const cc = deleni(xs, ok, stul, true, s, 0);
      for (const q of cc) q.otvory = diry.filter((r) => q.xs.some((x) => Math.abs(x - r.p[0]) < 1e-6)).map((r) => ({ x: r.p[0], y: r.p[1], d, otvor: o.d, pouzdro: o.pouzdro, pruchozi: !!r.pruchozi }));
      const yMax = Math.max(...ys) + ok;
      if (yMax > 160) varovani.push(`${id}: díry v ploše jsou ${cz(Math.max(...ys))} mm od čela – přípravek bude dlouhý (ramena k dorazu). U T-spoje daleko od kraje zvažte přenesení polohy centrovacími měrkami.`);
      const yPas = Math.min(...ys) - ok > 30 ? r2(Math.min(...ys) - ok) : 0;
      return { id, dil: 'B', druh: 'deska', nazev, plocha, y1: r2(yMax), yPas, Hv, stena, s, hd, casti: cc, otvor: o, vrtak: d, hloubka: diry[0] ? diry[0].hl : 0, pruchozi: diry.some((q) => q.pruchozi) };
    }

    const kr = rez === 'excentr' && diryAplocha.length ? { y: diryAplocha[0].p[1], d: diryAplocha[0].d, hloubka: diryAplocha[0].hl, tl: Math.max(6, +J.kridlo || 8) } : null;
    const A = hranovy('A', 'A', diryA, tA, vA, 0, rez === 'excentr' ? 'Přípravek A – čelo police + otvor excentru' : 'Přípravek A – do čela', kr);
    out.push(A);
    if (S.typ === 'hrana') {
      // protikus: stejný (souměrné rozložení a středění) nebo zrcadlový s dorazem na opačném konci
      const xsB = diryB.map((q) => q.p[0]).sort((a, b) => a - b), xsA = diryA.map((q) => q.p[0]).sort((a, b) => a - b);
      const soumerne = xsA.length === xsB.length && xsA.every((x, i) => Math.abs(x - xsB[i]) < 1e-6) && Math.abs(vB - vA) < 1e-6;
      const stredeny = Math.abs(vA - tA / 2) < 1e-6 && Math.abs(vB - tB / 2) < 1e-6 && Math.abs(tA - tB) < 1e-6;
      if (soumerne && stredeny && J.protikus !== 'vzdy') {
        info.push('Rozložení je souměrné a přípravek středěný – protikus B se vrtá stejným přípravkem (doraz opřít o referenční konec B).');
        A.tezProB = true;
      } else {
        const B = hranovy('B', 'B', diryB, tB, vB, W, 'Přípravek B – zrcadlový protikus (doraz na druhém konci)');
        B.zrcadlo = true;
        out.push(B);
        if (!soumerne) info.push('Protikus B má díry zrcadlově (x → W − x): použijte zrcadlový přípravek B, nebo přípravek A s dorazem na opačném konci dílu B.');
      }
    } else {
      out.push(deskovy('B', diryB, tB, rez === 'konfirmat' ? 'Přípravek B – deska na bok (průchozí Ø 7)' : 'Přípravek B – deska na plochu'));
    }
    return out;
  }

  /* ---------------- hloubkové kroužky ---------------- */
  /**
   * Kroužek (stavěcí kroužek na vrták) se opře o horní plochu vedení. Vzdálenost = od řezné hrany (břity
   * vrtáku / obvod Forstneru / stupeň stupňovitého vrtáku) ke spodní ploše kroužku = hloubka + délka vedení.
   * Měrka: blok se slepým otvorem této hloubky – vrták se zasune na doraz, kroužek se dosune na horní plochu.
   */
  function krouzkyNavrhu(rez, c) {
    const out = [], J = c.J, Hv = +J.Hv;
    const pridej = (k) => { if (!out.some((q) => q.sedlo === k.sedlo && Math.abs(q.vzdalenost - k.vzdalenost) < 1e-6)) out.push(k); };
    for (const p of c.pripravky) {
      const o = otvorPripravku(p.vrtak, J);
      if (p.druh === 'deska' && p.pruchozi) continue;
      const ved = Hv;
      pridej({ id: 'K' + (out.length + 1), nazev: `${p.id}: vrták Ø ${cz(p.vrtak)} – hloubka ${cz(p.hloubka)}`, vrtak: p.vrtak, sedlo: p.vrtak, vedeni: ved, hloubka: p.hloubka, vzdalenost: r2(p.hloubka + ved), ref: 'břity (bez středicího hrotu)', opora: o.pouzdro ? o.pouzdro.vnitrni : o.d, merka: { d1: r2(p.vrtak + 0.3), h1: r2(p.hloubka + ved), d2: r2(Math.max(2, p.vrtak * 0.4)), h2: 4 } });
      if (p.kridlo) {
        const k = p.kridlo, ok = r2(k.d + (+J.vule || 0));
        pridej({ id: 'K' + (out.length + 1), nazev: `${p.id}: Forstner Ø ${cz(k.d)} – hloubka ${cz(k.hloubka)}`, vrtak: k.d, sedlo: c.prvekInfo.stopka || 8, vedeni: k.tl, hloubka: k.hloubka, vzdalenost: r2(k.hloubka + k.tl), ref: 'obvodový břit Forstneru', opora: ok, merka: { d1: r2(k.d + 0.4), h1: r2(k.hloubka + k.tl), d2: 4, h2: 4 } });
      }
    }
    return out;
  }

  /* ---------------- kusovník ---------------- */
  function kusovnik(R, P) {
    const J = Object.assign({}, vychoziProjekt().pripravek, P.pripravek || {}), out = [];
    const n = R.diryA.length;
    for (const p of R.pripravky) {
      const kusu = p.casti.length;
      out.push({ polozka: `${p.nazev}`, mnozstvi: kusu + ' díl' + (kusu > 1 ? 'y' : ''), pozn: 'tisk PETG (PLA jen na občasné použití), 4 perimetry, výplň 40 %+, vrstva 0,2 mm' });
      if (p.otvor.pouzdro) {
        const pocet = p.casti.reduce((s, c) => s + c.otvory.length, 0);
        out.push({ polozka: `Vrtací pouzdro ocelové Ø ${cz(p.otvor.pouzdro.vnitrni)} / ${cz(p.otvor.pouzdro.vnejsi)} × ${cz(p.otvor.pouzdro.delka)}`, mnozstvi: pocet + ' ks', pozn: `nalisovat do otvoru ${cz(p.otvor.d)} (přesah ${cz(+J.presah, 2)}); rozměr pouzdra ověřte posuvkou` });
      }
    }
    if (R.pripravky.some((p) => p.casti.length > 1)) out.push({ polozka: `Indexový kolík Ø ${cz(R.dA)} (stačí obyčejný kolík nebo stopka vrtáku)`, mnozstvi: '1 ks', pozn: 'pro přesun dílů přípravku' });
    for (const k of R.krouzky) {
      out.push({ polozka: `Hloubkový kroužek ${k.id} na Ø ${cz(k.sedlo)} (tisk) + měrka`, mnozstvi: '1 ks', pozn: `stavěcí šroub M${cz(+J.sroubek || 3)} × 8–10 do plastu, nebo kovový stavěcí kroužek Ø ${cz(k.sedlo)}` });
    }
    out.push({ polozka: 'Truhlářská svěrka / šroubová svěrka', mnozstvi: '1–2 ks', pozn: 'přípravek vždy upnout k dílu, ne držet rukou' });
    if (R.rezim === 'kolik') {
      out.push({ polozka: `Kolík bukový Ø ${R.dA} × ${R.delka} (rýhovaný)`, mnozstvi: n + ' ks na spoj', pozn: 'lepidlo PVAc (D2/D3)' });
      out.push({ polozka: `Vrták do dřeva se středicím hrotem Ø ${R.dA}`, mnozstvi: '1 ks', pozn: '' });
    } else if (R.rezim === 'konfirmat') {
      out.push({ polozka: `Konfirmát ${R.prvek.d} × ${R.delka}`, mnozstvi: n + ' ks na spoj', pozn: 'zahloubení hlavy Ø ' + R.prvek.hlava + ' z vnější strany boku' });
      out.push({ polozka: 'Vrták Ø 5 a Ø 7 (nebo konfirmátový stupňovitý vrták)', mnozstvi: '1 sada', pozn: '' });
    } else if (R.rezim === 'excentr') {
      out.push({ polozka: `Excentr Ø ${R.prvek.d} + šroub/čep`, mnozstvi: n + ' ks na spoj', pozn: `čep do boku Ø ${R.dB}, hl. ${cz(R.hB)} – rozměry ověřte u kování` });
      out.push({ polozka: `Forstnerův vrták Ø ${R.prvek.d}, vrták Ø ${R.dA} a Ø ${R.dB}`, mnozstvi: '1 sada', pozn: '' });
    }
    return out;
  }

  /* ---------------- kapsový spoj ---------------- */
  /**
   * Geometrie kapsy v řezu (x, z). Díl A: čelo x = 0, materiál x < 0, líc z = 0, rub z = tA (kapsa).
   * typ 'rovina': protikus B navazuje v rovině (rám, hrana na hranu), líce lícují, B x > 0, z ∈ [0, tB].
   * typ 'T': čelo A na plochu B, B x ∈ [0, tB].
   * Výstup E = (0, zE): 'rovina' → zE = tB / 2 (střed tloušťky protikusu), 'T' → zE = tA / 2.
   * u = (cos α, −sin α) směr vrutu do B; b = −u (k ústí kapsy); n = (sin α, cos α) kolmo nahoru.
   */
  function navrhKapsy(P) {
    const K = Object.assign({}, vychoziProjekt().kapsa, P.kapsa || {}), Pr = Object.assign({}, PRAVIDLA, P.pravidla || {}), J = Object.assign({}, vychoziProjekt().pripravek, P.pripravek || {});
    const S = P.spoj || {}, varovani = [], info = [];
    const tA = Math.max(8, +S.tA || 18), tB = Math.max(8, +S.tB || 18), typ = K.typ === 'T' ? 'T' : 'rovina';
    const al = Math.max(5, Math.min(30, +Pr.kapsaUhel || 15)), a = Math.sin(al * RAD), c = Math.cos(al * RAD);
    const u = [c, -a], b = [-c, a], nn = [a, c];
    const dp = +Pr.kapsaPilot || 3.5, Dk = +Pr.kapsaD || 9.5, Ls = +Pr.kapsaDelkaPilotu || 25, rez = +Pr.kapsaRezerva || 3;
    let zE = typ === 'rovina' ? tB / 2 : tA / 2;
    if (typ === 'rovina' && zE > tA - dp / 2 - 2) { varovani.push(`Střed protikusu (${cz(zE)} mm) leží moc vysoko pro díl A tl. ${cz(tA)} – výstup posunut.`); zE = tA - dp / 2 - 2; }
    const E = [0, zE];
    const P2 = (s) => [E[0] + s * b[0], E[1] + s * b[1]];      // bod na ose ve vzdálenosti s od E směrem k ústí
    const vstup = (tA - zE) / a;                                 // vzdálenost E → průsečík osy s rubem
    const I = P2(vstup);
    const Lv = K.vrut === 'auto' || !K.vrut ? delkaVrutu(tA, Pr) : +K.vrut;
    // nejdelší průnik do B, aby hrot zůstal rezervu od protější plochy
    const pMax = typ === 'rovina' ? (zE - rez) / a : (tB - rez) / c;
    const R = Dk / 2;
    // nejmenší vzdálenost sedla hlavy od E: kapsa nesmí prorazit líc ani čelo
    const sMinLic = (2 + R * c - zE) / a;           // dno kapsy (spodní okraj disku) aspoň 2 mm nad lícem
    const sMinCelo = (R * a + 1.5) / c;              // přední okraj disku aspoň 1,5 mm za čelem
    const sMin = Math.max(+Pr.kapsaPodHlavou || 6, sMinLic, sMinCelo);
    let sS = Math.max(Lv - pMax, sMin);
    const p = Lv - sS;
    if (sS > vstup - 1) varovani.push(`Vrut ${Lv} mm je pro tl. ${cz(tA)} mm moc dlouhý: hlava by skončila nad rubem. Zvolte kratší vrut.`);
    if (p < 10) varovani.push(`Vrut zasahuje do protikusu jen ${cz(p)} mm – spoj bude slabý. Zvolte delší vrut nebo silnější materiál.`);
    if (Lv - pMax < sMin - 1e-9) info.push(`Vrut ${Lv} mm by v protikusu mohl jít hlouběji – hlava sedí ${cz(sS)} mm od čela, hrot ${cz(typ === 'rovina' ? zE - p * a : tB - p * c)} mm od protější plochy.`);
    const S0 = P2(sS);                                // sedlo hlavy (stupeň vrtáku)
    const hrot = [E[0] + p * u[0], E[1] + p * u[1]];  // hrot vrutu
    const hrotPilotu = [S0[0] + Ls * u[0], S0[1] + Ls * u[1]];
    if (Ls <= sS + 1) varovani.push(`Pilotní část vrtáku (${cz(Ls)} mm) nevyjde z čela – předvrtání do protikusu chybí; zkontrolujte vrták.`);
    // ústí kapsy na rubu
    const prusekRub = (off) => { // přímka S0 + off·n − s·u, průsečík s z = tA (s ≥ 0)
      const z0 = S0[1] + off * nn[1], x0 = S0[0] + off * nn[0];
      if (z0 >= tA) return null;
      const s = (tA - z0) / a; return x0 - s * c;
    };
    const xZad = prusekRub(-R), xPredGen = prusekRub(R);
    let xPred;
    if (xPredGen != null) xPred = xPredGen; else { const t = (tA - S0[1]) / c; xPred = S0[0] + t * a; }
    // vedení přípravku
    const Lg0 = Math.max(10, +J.vodiciDelka || 30);
    const otv = otvorPripravku(Dk, J);
    const Rb = otv.d / 2, Rw = Rb + Math.max(2.5, +J.stena || 4);
    const LgMin = (Rw * c + 2) / a;                   // spodní roh čelní plochy vedení musí být nad rubem
    const Lg = Math.max(Lg0, LgMin);
    if (Lg > Lg0 + 1e-6) info.push(`Vedení prodlouženo na ${cz(Lg)} mm, aby čelní plocha (kolmá na osu) ležela nad rubem.`);
    const G = P2(vstup + Lg);                         // střed horní (čelní) plochy vedení – o ni se opírá kroužek
    const kStupne = vstup + Lg - sS;              // stupeň vrtáku → spodek kroužku
    const kHrotu = kStupne + Ls;
    // rozmístění kapes po šířce dílu
    const Wd = Math.max(10, +K.sirka || 70), o = Math.min(Math.max(Dk, +K.odsazeni || 20), Wd / 2);
    let nK;
    if (K.pocet !== 'auto' && K.pocet) nK = Math.max(1, Math.round(+K.pocet));
    else nK = Wd < 40 ? 1 : Math.max(2, Math.ceil((Wd - 2 * o) / Pr.kapsaRoztecMax - 1e-9) + 1);
    const ys = nK === 1 ? [Wd / 2] : Array.from({ length: nK }, (_, i) => r2(o + (Wd - 2 * o) * i / (nK - 1)));
    for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] < Dk + 3) { varovani.push('Kapsy jsou blíž než Ø kapsy + 3 mm – slijí se.'); break; }
    const dvojity = !!K.dvojity, gv = Math.max(Dk + 6, +K.roztecVodítek || 22);
    // pevnost orientačně: vytažení vrutu z protikusu
    const Fax = Math.round((+Pr.fAx || 12) * (+Pr.vrutD || 4.2) * Math.max(0, p - 3));
    const tipRez = typ === 'rovina' ? hrot[1] : tB - hrot[0];
    const vysl = {
      rezim: 'kapsa', typ, tA, tB, uhel: al, sin: a, cos: c, u, b, n: nn, dp, Dk, Ls, E, I, vstup, Lv, p, sedlo: S0, sS, hrot, hrotPilotu, rezervaHrotu: r2(tipRez),
      usti: { zadni: r2(xZad), predni: r2(xPred), delka: r2(xPred - xZad) }, Lg, G, Rb, Rw, otvor: otv, kroužekOdStupne: kStupne, kroužekOdHrotu: kHrotu,
      ys, sirka: Wd, dvojity, roztecVodítek: gv, Fax, FaxCelkem: Fax * ys.length, varovani, info,
      krouzky: [{ id: 'K1', nazev: `Stupňovitý vrták Ø ${cz(dp)}/${cz(Dk)}`, vrtak: Dk, sedlo: Dk, vedeni: Lg, hloubka: vstup - sS, vzdalenost: kStupne, ref: 'stupeň vrtáku (přechod Ø ' + cz(dp) + ' → ' + cz(Dk) + ')', odHrotu: kHrotu, opora: otv.d, merka: { d1: r2(Dk + 0.3), h1: kStupne, d2: r2(dp + 0.6), h2: r2(Ls + 2) } }],
    };
    vysl.pripravek = pripravekKapsy(vysl, J);
    vysl.kusovnik = kusovnikKapsy(vysl, J);
    return vysl;
  }

  /** profil přípravku na kapsy v řezu (x, z) – polygon CCW, vytahuje se po šířce y */
  function pripravekKapsy(K, J) {
    const s = Math.max(3, +J.doraz || 5), a = K.sin, c = K.cos, tA = K.tA;
    // doraz přes čelo: nesmí zasahovat do pilotního otvoru (k tomu je i vybrání podél osy)
    const hd = Math.max(2, Math.min(+J.dorazHl || 12, tA - K.E[1] - K.dp / 2 - 1, tA - 2));
    const hmin = 5, pad = 18, hp = 8;
    const Ft = [K.G[0] + K.Rw * K.n[0], K.G[1] + K.Rw * K.n[1]], Fb = [K.G[0] - K.Rw * K.n[0], K.G[1] - K.Rw * K.n[1]];
    // horní hrana: rovnoběžka s osou ve vzdálenosti Rw od Ft dopředu, dokud nespadne na tA + hmin
    const zMin = tA + hmin;
    const sQ = (Ft[1] - zMin) / a, Q = [Ft[0] + sQ * c, zMin];
    const body = [];
    const xBack = Math.min(Fb[0], Ft[0]) - pad;
    body.push([xBack, tA], [0, tA], [0, tA - hd], [s, tA - hd]);
    if (Q[0] >= s) { const zq = Ft[1] - (s - Ft[0]) * a / c; body.push([s, zq]); }
    else { body.push([s, zMin], Q); }
    body.push(Ft, Fb);
    const zPad = tA + hp;
    if (Fb[1] > zPad + 0.5) body.push([Fb[0], zPad]);
    body.push([xBack, Math.min(zPad, Fb[1])]);
    // šířka a polohy vedení po šířce
    const kraj = K.Rw + 4, vedeni = K.dvojity ? [kraj, kraj + K.roztecVodítek] : [kraj];
    const sirka = r2(vedeni[vedeni.length - 1] + kraj);
    return { profil: body.map((q) => [r2(q[0]), r2(q[1])]), s, hd: r2(hd), xBack: r2(xBack), sirka, vedeni: vedeni.map(r2), Ft, Fb, delka: r2(s - xBack), vyska: r2(Math.max(...body.map((q) => q[1])) - (tA - hd)) };
  }

  function kusovnikKapsy(K, J) {
    const out = [{ polozka: K.dvojity ? 'Přípravek na kapsy – dvojitý' : 'Přípravek na kapsy – jednoduchý', mnozstvi: '1 ks', pozn: 'tisk PETG na boku (profil na podložce), 4 perimetry, výplň 50 %+' }];
    if (K.otvor.pouzdro) out.push({ polozka: `Vodicí pouzdro Ø ${cz(K.otvor.pouzdro.vnitrni)} / ${cz(K.otvor.pouzdro.vnejsi)}`, mnozstvi: (K.dvojity ? 2 : 1) + ' ks', pozn: `do otvoru ${cz(K.otvor.d)}, délka do ${cz(K.Lg)} mm` });
    out.push({ polozka: `Stupňovitý vrták na kapsy Ø ${cz(K.dp)} / ${cz(K.Dk)}`, mnozstvi: '1 ks', pozn: 'kovový stavěcí kroužek nebo tištěný kroužek K1' });
    out.push({ polozka: `Hloubkový kroužek K1 na Ø ${cz(K.Dk)} (tisk) + měrka`, mnozstvi: '1 ks', pozn: `stavěcí šroub M${cz(+J.sroubek || 3)} × 8–10` });
    out.push({ polozka: `Vrut s plochou hlavou (s podložkou) ${cz(K.Lv)} mm, hrubý závit do měkkého / jemný do tvrdého dřeva`, mnozstvi: K.ys.length + ' ks na spoj', pozn: 'typická délka – upravte v tabulce' });
    out.push({ polozka: 'Svěrka (přípravek k dílu) + rohová svěrka při šroubování', mnozstvi: '2 ks', pozn: '' });
    return out;
  }

  /* ---------------- centrovací měrky ---------------- */
  function navrhCentru(P) {
    const C = Object.assign({}, vychoziProjekt().centr, P.centr || {});
    const prumery = (Array.isArray(C.prumery) ? C.prumery : [8]).map(Number).filter((x) => x >= 3 && x <= 30).sort((a, b) => a - b);
    const kusy = prumery.map((d) => {
      const rc = d / 2 - (+C.vule || 0), Rf = d / 2 + 3, tf = 2.2, hz = Rf - rc;
      return { d, rCep: r2(rc), delkaCepu: Math.max(4, +C.delkaCepu || 8), rLimec: r2(Rf), tlLimec: tf, prechod: r2(hz), hrot: Math.max(1, +C.hrot || 2.5), rHrot: r2(Math.min(2.5, d / 3)), spendlik: !!C.spendlik && d >= 6 };
    });
    return { rezim: 'centr', kusy, kusu: Math.max(1, Math.round(+C.kusu || 4)), varovani: [], info: [], kusovnik: [
      ...kusy.map((k) => ({ polozka: `Centrovací měrka Ø ${k.d} (tisk)`, mnozstvi: Math.max(1, Math.round(+C.kusu || 4)) + ' ks', pozn: k.spendlik ? 'do hrotu zatlačit špendlík / hřebíček Ø 1–1,2 mm' : 'hrot z plastu – jen do měkkého dřeva' })),
      { polozka: 'Tisk', mnozstvi: '', pozn: 'PETG nebo PLA, čep dolů na podložce, 100 % výplň, vrstva 0,12–0,16 mm' },
    ] };
  }

  /* ---------------- hlavní vstup ---------------- */
  function navrh(P) {
    P = P || vychoziProjekt();
    if (P.rezim === 'kapsa') return navrhKapsy(P);
    if (P.rezim === 'centr') return navrhCentru(P);
    return navrhSpoje(P);
  }

  /* ---------------- kontrola sestavy (pro testy i UI) ---------------- */
  /** pro každou dvojici děr A/B: odchylka os po složení (mm) a úhel (°) */
  function kontrolaSestavy(R, diryB) {
    const B = diryB || R.diryB, out = [];
    for (const q of R.diryA) {
      const r = B.find((x) => x.i === q.i);
      if (!r) { out.push({ i: q.i, chyba: Infinity, uhel: 180 }); continue; }
      const pa = pouzij(R.sestava.A, q.p), na = smer(R.sestava.A, q.n), pb = pouzij(R.sestava.B, r.p), nb = smer(R.sestava.B, r.n);
      const uhel = Math.acos(Math.max(-1, Math.min(1, -skal(na, nb)))) / RAD;
      out.push({ i: q.i, chyba: Math.max(vzd(pa, pb), odOsy(pa, na, pb)), uhel });
    }
    return out;
  }
  /** díry, které přípravek vyvrtá do dílu (z popisu přípravku) – v souřadnicích dílu */
  function diryZPripravku(p) {
    const out = [];
    for (const c of p.casti) for (const o of c.otvory) {
      if (p.druh === 'hrana') out.push({ p: [o.x, 0, o.z], n: [0, 1, 0], d: o.d });
      else out.push({ p: [o.x, o.y, p.plocha], n: [0, 0, -1], d: o.d });
    }
    // sdílené indexové díry jsou ve dvou dílech – stejná díra jen jednou
    return out.filter((q, i) => out.findIndex((r) => vzd(r.p, q.p) < 1e-6) === i);
  }

  /* ---------------- papír ---------------- */
  const PAPIRY = { a4: [210, 297], a3: [297, 420], letter: [215.9, 279.4] };
  function rozmerPapiru(T) { if (T.papir === 'vlastni') return [Math.max(80, +T.papirW || 210), Math.max(80, +T.papirH || 297)]; return PAPIRY[T.papir] || PAPIRY.a4; }
  function korekceMeritka(kx, ky) { const f = (v) => (v > 50 && v < 150 ? 100 / v : 1); return { kx: f(+kx || 100), ky: f(+ky || 100) }; }

  const API = {
    PRAVIDLA, REZIMY, vychoziProjekt, navrh, navrhSpoje, navrhKapsy, navrhCentru, polohy, sestava, protidira, deleni,
    prumerKoliku, hloubkaDoPlochy, delkaKoliku, delkaVrutu, otvorPripravku, typickePouzdro, pevnostKoliku, kontrolaSestavy, diryZPripravku,
    pouzij, smer, inverze, det, vzd, odOsy, rozmerPapiru, korekceMeritka, PAPIRY, cz, r2, r1, kopie,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.KP = API;
})(typeof window !== 'undefined' ? window : globalThis);

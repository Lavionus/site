/* Stopy obuvi a krok – jádro bez DOM (test: _test/stopy_obuvi_test.js).
   1) Výška postavy z délky (a šířky) chodidla: publikované regrese s chybou odhadu.
   2) Velikosti obuvi EU / UK / US / Mondopoint ↔ délka chodidla ↔ délka otisku podrážky.
   3) Řada stop: délka kroku a dvojkroku, šířka rozkroku, úhel chodidla, rychlost a kadence (Monte Carlo).
   4) Porovnání podrážek: afinní matice, podobnostní transformace z párů značek.
   Jednotky: délky chodidel v jádře v mm, regrese interně v cm (jak jsou publikované), dráha v m. */
(function () {
  'use strict';

  const RAD = Math.PI / 180;
  const PALEC = 25.4; // mm

  /* ---------- statistika ---------- */
  function rng(seed) { // mulberry32 – opakovatelný Monte Carlo
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function normal(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
  function prumer(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN; }
  function smOdch(a) { if (a.length < 2) return NaN; const m = prumer(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); }
  function kvantil(serazene, q) {
    if (!serazene.length) return NaN;
    const i = (serazene.length - 1) * q, d = Math.floor(i), h = Math.ceil(i);
    return serazene[d] + (serazene[h] - serazene[d]) * (i - d);
  }
  const Z_HLADINY = { 68: 1, 90: 1.6449, 95: 1.96, 99: 2.5758 };
  function zProHladinu(h) { return Z_HLADINY[h] || 1.96; }

  /* ---------- 1) regrese výšky postavy ----------
     FL = délka chodidla (pterion–akropodion), FB = šířka chodidla, obojí v cm; výsledek v cm.
     se = SEE z původní práce; val = ověření na nezávislém vzorku (Petrejčíková et al. 2026, východní Slovensko,
     n = 100 + 100, 18–58 let): bias = průměr (odhad − skutečnost), sd = SD rozdílů [cm]. */
  const PETREJCIKOVA = 'Petrejčíková E. et al. (2026): Effectiveness of equations for the prediction of stature from foot measurements in the Eastern Slovak population. Anthropological Review 89(3): 41–55, doi:10.18778/1898-6773.89.3.03';
  const REGRESE = [
    { id: 'uhrova2015', nazev: 'Uhrová et al. 2015', populace: 'Slovensko, 18–24 let (n = 250)', fb: true,
      zdroj: 'Uhrová P. et al. (2015): Estimation of stature using hand and foot dimensions in Slovak adults. Legal Medicine 17(2): 92–97, doi:10.1016/j.legalmed.2014.10.005',
      pozn: 'Koeficienty převzaty z citace v Petrejčíková 2026; SEE rovnic dle abstraktu v rozmezí ±4,6 až ±6,1 cm. Při ověření nejpřesnější.',
      varianty: [
        { pohlavi: 'm', strana: 'P', a: 84.74, bFL: 3.75, bFB: -0.36, val: { bias: -0.57, sd: 5.57 } },
        { pohlavi: 'm', strana: 'L', a: 87.75, bFL: 3.68, bFB: -0.46, val: { bias: -0.133, sd: 5.28 } },
        { pohlavi: 'z', strana: 'P', a: 66.89, bFL: 3.42, bFB: 1.98, val: { bias: -0.15, sd: 3.9 } },
        { pohlavi: 'z', strana: 'L', a: 68.46, bFL: 3.42, bFB: 1.83, val: { bias: -0.65, sd: 3.85 } }
      ] },
    { id: 'petrejcikova2026', nazev: 'Petrejčíková et al. 2026', populace: 'východní Slovensko, 18–58 let (n = 200)', fb: true,
      zdroj: PETREJCIKOVA, pozn: 'Vlastní rovnice autorů (tab. 4), SEE z téže tabulky. U mužů slabá korelace (r ≈ 0,5).',
      varianty: [
        { pohlavi: 'm', strana: 'P', a: 124.74, bFL: 2.70, bFB: -1.55, se: 5.400 },
        { pohlavi: 'm', strana: 'L', a: 115.10, bFL: 2.86, bFB: -1.03, se: 5.212 },
        { pohlavi: 'z', strana: 'P', a: 80.34, bFL: 3.49, bFB: 0.32, se: 3.791 },
        { pohlavi: 'z', strana: 'L', a: 72.13, bFL: 4.19, bFB: -0.63, se: 3.696 }
      ] },
    { id: 'cyplik2010', nazev: 'Cyplík a Chojak 2010', populace: 'neuvedeno v citujícím zdroji', fb: false,
      zdroj: 'Cyplík a Chojak (2010), citováno podle ' + PETREJCIKOVA,
      pozn: 'Koeficienty z druhotného zdroje; chyba = SD rozdílů při ověření.',
      varianty: [
        { pohlavi: 'm', a: 113.15, bFL: 2.4963, val: { bias: -1.77, sd: 5.37 } },
        { pohlavi: 'z', a: 96.369, bFL: 2.9353, val: { bias: -0.32, sd: 3.83 } }
      ] },
    { id: 'straus2001', nazev: 'Straus 2001', populace: 'ČR (forenzní biomechanika)', fb: false,
      zdroj: 'Straus J. (2001): Aplikace forenzní biomechaniky. Praha: Police History; citováno podle ' + PETREJCIKOVA,
      pozn: 'Při ověření systematicky podhodnocuje o ≈ 4 cm.',
      varianty: [
        { pohlavi: 'm', a: 83.883, bFL: 3.5026, val: { bias: -4.38, sd: 5.43 } },
        { pohlavi: 'z', a: 94.038, bFL: 2.8789, val: { bias: -4.01, sd: 3.84 } }
      ] },
    { id: 'strnadova2014', nazev: 'Strnadová 2014', populace: 'ČR (diplomová práce FTVS UK)', fb: true,
      zdroj: 'Strnadová H. (2014): Vybrané parametry lokomoce a chodidla vzhledem k tělesné výšce jedince. Diplomová práce, FTVS UK Praha; citováno podle ' + PETREJCIKOVA,
      pozn: 'Společná rovnice pro obě pohlaví.',
      varianty: [{ pohlavi: 'obe', a: 34.6879, bFL: 4.00555, bFB: 4.24845, val: { bias: 1.19, sd: 5.84 } }] },
    { id: 'titlbach1971', nazev: 'Titlbach et al. 1971', populace: 'ČSSR', fb: true,
      zdroj: 'Titlbach Z., Titlbachová S., Štěchová D. (1971): Zjištění tělesné výšky osob ze stop nohou. Československá kriminalistika 3: 223–239; též Porada V., Straus J. (2018): Forensic biomechanics, VŠFS Praha',
      pozn: 'Při ověření podhodnocuje o ≈ 5–6 cm (sekulární trend výšky).',
      varianty: [{ pohlavi: 'obe', a: 53, bFL: 3.1, bFB: 4.0, val: { bias: -5.67, sd: 5.68 } }] },
    { id: 'feix1965', nazev: 'Feix 1965 (7 × FL)', populace: 'nespecifikováno', fb: false,
      zdroj: 'Feix G. (1965): Kleines Lexikon für Kriminalisten; citováno podle ' + PETREJCIKOVA,
      pozn: 'Prostý poměr. Při ověření nadhodnocuje o ≈ 2,6 cm.',
      varianty: [{ pohlavi: 'obe', a: 0, bFL: 7, val: { bias: 2.64, sd: 6.53 } }] },
    { id: 'giles1991', nazev: 'Giles a Vallandigham 1991', populace: 'USA, muži', fb: false,
      zdroj: 'Giles E., Vallandigham P. H. (1991): Height estimation from foot and shoeprint length. J Forensic Sci 36(4): 1134–1151',
      pozn: 'Jen mužská rovnice; SEE nebyla ověřena v originále → bez intervalu.',
      varianty: [{ pohlavi: 'm', a: 82.206, bFL: 3.447 }] },
    { id: 'topinard', nazev: 'Topinard (FL / 0,15)', populace: 'obecné pravidlo (19. stol.)', fb: false,
      zdroj: 'Topinard P., pravidlo citované v Giles a Vallandigham (1991)',
      pozn: 'Chodidlo ≈ 15 % výšky; jen hrubý odhad, bez intervalu.',
      varianty: [{ pohlavi: 'obe', a: 0, bFL: 1 / 0.15 }] }
  ];
  /* Hodnoty val u rovnic bez rozlišení strany = průměr pravé a levé nohy z tab. 6–8 Petrejčíkové 2026
     (např. Straus muži: bias (−4,43 −4,33)/2, sd (5,56 + 5,29)/2). */

  /* Délka/šířka chodidla [mm] → odhady výšky [cm] podle všech použitelných rovnic.
     vstup: { fl, fb?, sigmaFl?, sigmaFb?, pohlavi: 'm'|'z'|'?', strana: 'P'|'L'|'?', hladina: 95 } */
  function odhadyVysky(vstup) {
    const FL = vstup.fl / 10, FB = vstup.fb > 0 ? vstup.fb / 10 : null;
    const sFL = (vstup.sigmaFl || 0) / 10, sFB = (vstup.sigmaFb || 0) / 10;
    const z = zProHladinu(vstup.hladina);
    const pohl = vstup.pohlavi === 'm' || vstup.pohlavi === 'z' ? [vstup.pohlavi] : ['m', 'z'];
    const ven = [];
    if (!(FL > 0)) return ven;
    for (const r of REGRESE) {
      for (const p of pohl) {
        let kand = r.varianty.filter(v => v.pohlavi === p || v.pohlavi === 'obe');
        if (!kand.length) continue;
        if (kand[0].pohlavi === 'obe' && p === 'z' && pohl.length === 2) continue; // společnou rovnici jen jednou
        if (kand.some(v => v.strana)) {
          const s = kand.filter(v => v.strana === vstup.strana);
          kand = s.length ? s : kand; // neznámá strana → průměr P a L
        }
        if (r.fb && FB == null) { ven.push({ id: r.id, nazev: r.nazev, pohlavi: kand[0].pohlavi, chybiFb: true, regrese: r }); continue; }
        const hodn = kand.map(v => v.a + v.bFL * FL + (v.bFB || 0) * (FB || 0));
        const S = prumer(hodn);
        const v0 = kand[0];
        const seModel = v0.se != null ? prumer(kand.map(v => v.se)) : v0.val ? prumer(kand.map(v => v.val.sd)) : null;
        const typChyby = v0.se != null ? 'SEE' : v0.val ? 'ověření' : null;
        const bFL = prumer(kand.map(v => v.bFL)), bFB = prumer(kand.map(v => v.bFB || 0));
        const seVstup = Math.hypot(bFL * sFL, bFB * (FB ? sFB : 0));
        const se = seModel == null ? null : Math.hypot(seModel, seVstup);
        ven.push({
          id: r.id, nazev: r.nazev, pohlavi: v0.pohlavi, strana: kand.length === 1 ? (v0.strana || '') : (kand.some(v => v.strana) ? 'P+L' : ''),
          vyska: S, se, seModel, seVstup, typChyby, od: se == null ? null : S - z * se, do: se == null ? null : S + z * se,
          bias: v0.val ? prumer(kand.map(v => v.val.bias)) : null, regrese: r
        });
      }
    }
    return ven;
  }

  /* Titlbach (1978) podle Porada a Straus (2018): výška z rozměrů obuvi vT = 2,6·do + 4,3·so + 55 [cm],
     do = délka boty, so = šířka boty [cm]. Rozptyl autoři uvádějí ±1 cm kolem střední křivky – to je pásmo
     regresní přímky, ne chyba odhadu jednotlivce; proto se zde nepoužívá. */
  function vyskaZBoty(delkaMm, sirkaMm) {
    if (!(delkaMm > 0 && sirkaMm > 0)) return NaN;
    return 2.6 * delkaMm / 10 + 4.3 * sirkaMm / 10 + 55;
  }

  /* Souhrn více odhadů: vážený průměr 1/se² (rovnice nejsou nezávislé → interval se nezužuje,
     bere se nejmenší chyba jednotlivé rovnice) a rozpětí bodových odhadů. */
  function souhrn(odhady, hladina) {
    const s = odhady.filter(o => Number.isFinite(o.vyska) && o.se > 0);
    if (!s.length) return null;
    const w = s.map(o => 1 / o.se ** 2), sw = w.reduce((a, b) => a + b, 0);
    const m = s.reduce((a, o, i) => a + o.vyska * w[i], 0) / sw;
    const se = Math.min(...s.map(o => o.se)), z = zProHladinu(hladina);
    const body = odhady.filter(o => Number.isFinite(o.vyska)).map(o => o.vyska);
    return { vyska: m, se, od: m - z * se, do: m + z * se, min: Math.min(...body), max: Math.max(...body), n: s.length };
  }

  /* ---------- 2) velikosti obuvi ----------
     Podle Wikipedia „Shoe size“ (ISO/TS 19407): kopyto je delší než chodidlo o přídavek;
     EU (pařížský bod 2/3 cm): EU = 1,5 · kopyto[cm], přídavek 2 body = 13,3 mm → EU ≈ 1,5·chodidlo + 2;
     UK dospělí: 3 · kopyto[in] − 25, US muži: − 24, US ženy: − 23, přídavek 2 ječná zrna = 2/3 in = 16,9 mm;
     Mondopoint = délka chodidla v mm (ISO 9407). */
  const VELIKOSTI = {
    eu: { nazev: 'EU', krok: 1 / 1.5 * 10, pridavek: 20 / 1.5 },
    uk: { nazev: 'UK', krok: PALEC / 3, pridavek: 2 * PALEC / 3, posun: 25 },
    usm: { nazev: 'US muži', krok: PALEC / 3, pridavek: 2 * PALEC / 3, posun: 24 },
    usz: { nazev: 'US ženy', krok: PALEC / 3, pridavek: 2 * PALEC / 3, posun: 23 },
    mondo: { nazev: 'Mondopoint', krok: 5, pridavek: 0 }
  };
  function velikostZChodidla(system, chodidloMm, pridavekMm) {
    const v = VELIKOSTI[system]; if (!v || !(chodidloMm > 0)) return NaN;
    const p = pridavekMm == null ? v.pridavek : pridavekMm;
    const kopyto = chodidloMm + p;
    if (system === 'eu') return 1.5 * kopyto / 10;
    if (system === 'mondo') return chodidloMm;
    return 3 * kopyto / PALEC - v.posun;
  }
  function chodidloZVelikosti(system, velikost, pridavekMm) {
    const v = VELIKOSTI[system]; if (!v || !Number.isFinite(velikost)) return NaN;
    const p = pridavekMm == null ? v.pridavek : pridavekMm;
    if (system === 'eu') return velikost / 1.5 * 10 - p;
    if (system === 'mondo') return velikost;
    return (velikost + v.posun) / 3 * PALEC - p;
  }
  function zaokrouhliVelikost(system, x) {
    if (!Number.isFinite(x)) return NaN;
    return system === 'mondo' ? Math.round(x / 5) * 5 : Math.round(x * 2) / 2;
  }
  /* Otisk podrážky je delší než chodidlo o přesah (špička, pata, podešev). Giles a Vallandigham 1991
     odečítali u mužů 1 palec (25,4 mm); skutečný přesah závisí na typu obuvi. */
  const PRESAH_OTISKU = 25.4;
  function chodidloZOtisku(otiskMm, presahMm) { return otiskMm - (presahMm == null ? PRESAH_OTISKU : presahMm); }
  function otiskZChodidla(chodidloMm, presahMm) { return chodidloMm + (presahMm == null ? PRESAH_OTISKU : presahMm); }

  /* ---------- 3) dráha chůze ---------- */
  const G = 9.81;
  /* Délka dolní končetiny z výšky (Walt a Wyndham 1973 podle Porada a Straus 2018): hle = 0,745·hb − 0,250 [m], r = 0,965;
     směrodatná odchylka délky končetiny z výšky 48 mm (tamtéž, obr. 2.7). */
  const SIGMA_KONCETINY = 0.048;
  function delkaKonceny(vyskaM) { return 0.745 * vyskaM - 0.250; }

  /* Rychlost [m/s] z délky kroku l [m] (jeden krok = pata levé → pata pravé) a délky končetiny h [m]. */
  const METODY_RYCHLOSTI = [
    { id: 'alexander', nazev: 'Alexander 1976 (dynamická podobnost)', rozsah: null,
      zdroj: 'Alexander R. McN. (1976): Estimates of speeds of dinosaurs. Nature 261: 129–130',
      v: (l, h) => 0.25 * Math.sqrt(G) * Math.pow(2 * l, 1.67) * Math.pow(h, -1.17) },
    { id: 'ww_chuze', nazev: 'Walt a Wyndham – chůze', rozsah: [0.88, 2.2], chuze: true,
      zdroj: 'Walt W. H., Wyndham C. H. (1973), vztah podle Porada V., Straus J. (2018): Forensic biomechanics, VŠFS Praha, kap. 2.6.2',
      v: (l, h) => 3.23 * l - 3.14 * h + 2.31 },
    { id: 'ww_beh', nazev: 'Walt a Wyndham – běh', rozsah: [2.22, 3.58], beh: true,
      zdroj: 'Walt W. H., Wyndham C. H. (1973), vztah podle Porada V., Straus J. (2018), kap. 2.6.2',
      v: (l, h) => 3.06 * l - 2.21 * h + 1.83 },
    { id: 'cavagna', nazev: 'Cavagna a Margaria 1966', rozsah: [0.83, 2.7], chuze: true,
      zdroj: 'Cavagna G. A., Margaria R. (1966), vztah podle Porada V., Straus J. (2018), kap. 2.6.2',
      v: l => 3.89 * l - 1.41 }
  ];
  /* Relativní dvojkrok λ/h (Alexander 1976; hranice podle Thulborn 1990): < 2 chůze, 2–2,9 přechod (klus), > 2,9 běh. */
  function druhPohybu(relDvojkrok) {
    if (!Number.isFinite(relDvojkrok)) return '';
    return relDvojkrok < 2 ? 'chuze' : relDvojkrok <= 2.9 ? 'prechod' : 'beh';
  }

  /* Monte Carlo: l ~ N(l, sl), výška ~ N(hb, shb), končetina = f(výška) + N(0, 0,048) nebo zadaná ~ N(h, sh). */
  function rychlost(vstup) {
    const { l, sl = 0, n = 4000, seed = 1 } = vstup;
    if (!(l > 0)) return null;
    const maKonc = vstup.koncetina > 0;
    if (!maKonc && !(vstup.vyska > 0)) return null;
    const r = rng(seed);
    const hStred = maKonc ? vstup.koncetina : delkaKonceny(vstup.vyska);
    const vzorky = METODY_RYCHLOSTI.map(() => []), rel = [];
    for (let i = 0; i < n; i++) {
      const li = Math.max(0.05, l + sl * normal(r));
      const hi = maKonc ? Math.max(0.2, vstup.koncetina + (vstup.sigmaKoncetiny || 0) * normal(r))
        : Math.max(0.2, delkaKonceny(vstup.vyska + (vstup.sigmaVysky || 0) * normal(r)) + SIGMA_KONCETINY * normal(r));
      METODY_RYCHLOSTI.forEach((m, j) => vzorky[j].push(m.v(li, hi)));
      rel.push(2 * li / hi);
    }
    const q = a => { const s = a.slice().sort((x, y) => x - y); return { stred: kvantil(s, 0.5), od: kvantil(s, 0.025), do: kvantil(s, 0.975) }; };
    const relQ = q(rel), druh = druhPohybu(2 * l / hStred);
    const metody = METODY_RYCHLOSTI.map((m, j) => {
      const v = q(vzorky[j]), bod = m.v(l, hStred);
      const mimo = m.rozsah ? (bod < m.rozsah[0] || bod > m.rozsah[1]) : false;
      const nevhodna = (m.chuze && druh === 'beh') || (m.beh && druh === 'chuze');
      return { id: m.id, nazev: m.nazev, zdroj: m.zdroj, rozsah: m.rozsah, v: bod, od: v.od, do: v.do, mimoRozsah: mimo, nevhodna,
        kadence: bod > 0 ? bod / l * 60 : NaN };
    });
    return { koncetina: hStred, relDvojkrok: 2 * l / hStred, relOd: relQ.od, relDo: relQ.do, druh, metody };
  }

  /* Geometrie řady stop. stopy = [{ strana: 'L'|'P', pata: [x, y], spicka: [x, y] }] v mm, pořadí podle chůze;
     souřadnice obrázku (y dolů). Definice: krok = vzdálenost pat sousedních stop měřená ve směru chůze,
     dvojkrok = pata → pata téže nohy, šířka rozkroku = kolmá vzdálenost paty od spojnice sousedních pat druhé nohy,
     úhel chodidla = odklon osy pata–špička od směru chůze, kladný = špička ven. */
  function primkaTLS(body) { // proložení přímky (hlavní osa)
    const n = body.length, mx = prumer(body.map(b => b[0])), my = prumer(body.map(b => b[1]));
    let sxx = 0, syy = 0, sxy = 0;
    for (const [x, y] of body) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    let d = [Math.cos(th), Math.sin(th)];
    if (n >= 2) { const p = body[n - 1], q = body[0]; if ((p[0] - q[0]) * d[0] + (p[1] - q[1]) * d[1] < 0) d = [-d[0], -d[1]]; }
    return { bod: [mx, my], smer: d };
  }
  function vzdOdPrimky(p, a, b) { // se znaménkem, kladná vpravo od a→b (y dolů)
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    return L ? ((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / -L : NaN;
  }
  function uhelSmeru(d, f) { return Math.atan2(d[0] * f[1] - d[1] * f[0], d[0] * f[0] + d[1] * f[1]) / RAD; }
  function analyzaDrahy(stopy) {
    const s = stopy.filter(x => x && x.pata);
    if (s.length < 2) return null;
    const pr = primkaTLS(s.map(x => x.pata)), d = pr.smer;
    const kroky = [], dvojkroky = [], sirky = [], uhly = [], delky = [];
    for (let i = 0; i < s.length; i++) {
      const st = s[i];
      if (st.spicka) {
        const f = [st.spicka[0] - st.pata[0], st.spicka[1] - st.pata[1]], L = Math.hypot(f[0], f[1]);
        if (L > 0) {
          delky.push(L);
          const a = uhelSmeru(d, [f[0] / L, f[1] / L]); // kladné = po směru hodinových ručiček = vpravo
          uhly.push({ i, strana: st.strana, uhel: st.strana === 'L' ? -a : a });
        }
      }
      if (i + 1 < s.length) {
        const v = [s[i + 1].pata[0] - st.pata[0], s[i + 1].pata[1] - st.pata[1]];
        kroky.push({ i, delka: v[0] * d[0] + v[1] * d[1], prima: Math.hypot(v[0], v[1]) });
      }
      if (i + 2 < s.length) dvojkroky.push({ i, delka: Math.hypot(s[i + 2].pata[0] - st.pata[0], s[i + 2].pata[1] - st.pata[1]) });
      if (i >= 1 && i + 1 < s.length) sirky.push({ i, sirka: Math.abs(vzdOdPrimky(st.pata, s[i - 1].pata, s[i + 1].pata)) });
    }
    const st = (a, k) => { const h = a.map(x => x[k]); return { prumer: prumer(h), sd: smOdch(h), n: h.length, min: Math.min(...h), max: Math.max(...h) }; };
    return {
      smer: d, kroky, dvojkroky, sirky, uhly,
      krok: st(kroky, 'delka'), dvojkrok: st(dvojkroky, 'delka'), sirka: st(sirky, 'sirka'), uhel: st(uhly, 'uhel'),
      uhelL: st(uhly.filter(u => u.strana === 'L'), 'uhel'), uhelP: st(uhly.filter(u => u.strana === 'P'), 'uhel'),
      delkaStopy: { prumer: prumer(delky), sd: smOdch(delky), n: delky.length }
    };
  }

  /* ---------- měřítko z fotky ---------- */
  function meritko2(p1, p2, mm) { const d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]); return d > 0 && mm > 0 ? mm / d : NaN; }
  function resLin(A, b) { // Gauss s částečnou pivotací
    const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) if (r !== c) { const k = M[r][c] / M[c][c]; for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  /* Homografie ze 4 bodů obrázku na obdélník š × v [mm]: rohy v pořadí levý horní, pravý horní, pravý dolní, levý dolní. */
  function homografie(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const h = resLin(A, b);
    return h ? h.concat([1]) : null;
  }
  function homografieObdelnik(rohy, sirka, vyska) { return homografie(rohy, [[0, 0], [sirka, 0], [sirka, vyska], [0, vyska]]); }
  function aplikujH(H, p) { const w = H[6] * p[0] + H[7] * p[1] + H[8]; return [(H[0] * p[0] + H[1] * p[1] + H[2]) / w, (H[3] * p[0] + H[4] * p[1] + H[5]) / w]; }
  /* převod bodu obrázku [px] na mm podle kalibrace { typ: '2b', mmNaPx } | { typ: '4b', H } */
  function naMm(kal, p) {
    if (!kal || !p) return null;
    if (kal.typ === '4b' && kal.H) return aplikujH(kal.H, p);
    if (kal.mmNaPx > 0) return [p[0] * kal.mmNaPx, p[1] * kal.mmNaPx];
    return null;
  }

  /* ---------- 4) porovnání podrážek: afinní matice [a, b, c, d, e, f] jako canvas setTransform ---------- */
  const M_JEDNOTKA = [1, 0, 0, 1, 0, 0];
  function mNasob(m, n) { // m ∘ n (nejdřív n)
    return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  }
  function mInv(m) {
    const det = m[0] * m[3] - m[1] * m[2]; if (!det) return null;
    return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
  }
  function mBod(m, p) { return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]; }
  function mPosun(x, y) { return [1, 0, 0, 1, x, y]; }
  function mOtoc(stupne) { const c = Math.cos(stupne * RAD), s = Math.sin(stupne * RAD); return [c, s, -s, c, 0, 0]; }
  function mMeritko(sx, sy) { return [sx, 0, 0, sy == null ? sx : sy, 0, 0]; }
  /* Transformace snímku B do souřadnic snímku A: p' = t + s·R(rot)·F·(p − c), F = zrcadlení osy x. */
  function maticeB(par) {
    const c = par.stred || [0, 0];
    return [mPosun(par.tx || 0, par.ty || 0), mOtoc(par.rot || 0), mMeritko(par.s || 1), mMeritko(par.zrcadlo ? -1 : 1, 1), mPosun(-c[0], -c[1])]
      .reduce((a, b) => mNasob(a, b));
  }
  /* Podobnostní transformace (Umeyama 2D) z párů: najde rot, s, tx, ty tak, aby maticeB(par)·B_i ≈ A_i.
     Zrcadlení se nehledá – bere se z par.zrcadlo. Vrací parametry a rezidua [px snímku A]. */
  function zarovnej(paryA, paryB, par) {
    const n = Math.min(paryA.length, paryB.length);
    if (n < 2) return null;
    const c = par.stred || [0, 0], fx = par.zrcadlo ? -1 : 1;
    const Q = paryB.slice(0, n).map(p => [fx * (p[0] - c[0]), p[1] - c[1]]), P = paryA.slice(0, n);
    const mq = [prumer(Q.map(p => p[0])), prumer(Q.map(p => p[1]))], mp = [prumer(P.map(p => p[0])), prumer(P.map(p => p[1]))];
    let sxx = 0, sxy = 0, var2 = 0;
    for (let i = 0; i < n; i++) {
      const qx = Q[i][0] - mq[0], qy = Q[i][1] - mq[1], px = P[i][0] - mp[0], py = P[i][1] - mp[1];
      sxx += qx * px + qy * py; sxy += qx * py - qy * px; var2 += qx * qx + qy * qy;
    }
    if (!var2) return null;
    const rot = Math.atan2(sxy, sxx), s = Math.hypot(sxx, sxy) / var2;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const tx = mp[0] - s * (cr * mq[0] - sr * mq[1]), ty = mp[1] - s * (sr * mq[0] + cr * mq[1]);
    const vysl = Object.assign({}, par, { rot: rot / RAD, s, tx, ty });
    const M = maticeB(vysl);
    const rezidua = P.map((p, i) => { const q = mBod(M, paryB[i]); return Math.hypot(q[0] - p[0], q[1] - p[1]); });
    vysl.rezidua = rezidua;
    vysl.rms = Math.sqrt(prumer(rezidua.map(r => r * r)));
    return vysl;
  }
  /* Značky: [{ c, a?: [x,y], b?: [x,y], pozn }]; klik na snímek X → nejnižší číslo bez bodu X, jinak nová značka. */
  function pridejZnacku(znacky, snimek, bod) {
    const k = snimek === 'B' ? 'b' : 'a';
    let z = znacky.filter(x => !x[k]).sort((p, q) => p.c - q.c)[0];
    if (!z) { z = { c: znacky.reduce((m, x) => Math.max(m, x.c), 0) + 1, pozn: '' }; znacky.push(z); }
    z[k] = bod;
    return z;
  }

  /* ---------- CSV ---------- */
  function csv(radky, oddelovac) {
    const o = oddelovac || ';';
    return radky.map(r => r.map(v => {
      const s = v == null ? '' : String(v);
      return /[";\n,]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(o)).join('\r\n');
  }

  const API = {
    RAD, PALEC, rng, normal, prumer, smOdch, kvantil, zProHladinu,
    REGRESE, odhadyVysky, souhrn, vyskaZBoty,
    VELIKOSTI, velikostZChodidla, chodidloZVelikosti, zaokrouhliVelikost, PRESAH_OTISKU, chodidloZOtisku, otiskZChodidla,
    G, SIGMA_KONCETINY, delkaKonceny, METODY_RYCHLOSTI, druhPohybu, rychlost,
    primkaTLS, vzdOdPrimky, uhelSmeru, analyzaDrahy,
    meritko2, resLin, homografie, homografieObdelnik, aplikujH, naMm,
    M_JEDNOTKA, mNasob, mInv, mBod, mPosun, mOtoc, mMeritko, maticeB, zarovnej, pridejZnacku, csv
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.StopyObuviJadro = API;
})();

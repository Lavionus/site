/* Kalkulačka finanční nezávislosti – jádro bez DOM (test: _test/financni_nezavislost_test.js).
   Vše v reálných korunách (dnešní kupní síla): spoření i výdaje rostou s inflací.
   Projekce, cílová částka podle míry výběru s mostem do státního důchodu, varianty Lean/Fat/Coast/Barista,
   Monte Carlo (deterministický seed), historický backtest na ročních řadách, citlivostní tabulky. */
(function () {
  'use strict';

  const KLIC = 'webapp_financni_nezavislost_vstupy';
  const KLIC_RADA = 'webapp_financni_nezavislost_rada';

  /* Historická řada: [rok, S&P 500 vč. dividend %, 10letý US dluhopis %, inflace USA %].
     Výnosy: A. Damodaran, NYU Stern – Historical Returns on Stocks, Bonds and Bills 1928–2025
     (pages.stern.nyu.edu/~adamodar, aktualizace 5. 1. 2026, staženo 16. 11. 2026).
     Inflace: CPI-U USA (BLS, řada CPIAUCNS z FRED), prosinec/prosinec, staženo 16. 11. 2026.
     Výnosy jsou v USD – kurzové riziko CZK/USD v nich není. */
  const ZDROJ_RADY = 'S&P 500 vč. dividend a 10letý dluhopis USA: A. Damodaran (NYU Stern), Historical Returns 1928–2025, aktualizace 5. 1. 2026; inflace: CPI-U USA prosinec/prosinec (BLS přes FRED, CPIAUCNS). Staženo 16. 11. 2026. Výnosy v USD, bez kurzu CZK.';
  const HIST_RADA = [
      [1928, 43.81, 0.84, -1.16],[1929, -8.3, 4.2, 0.58],[1930, -25.12, 4.54, -6.4],[1931, -43.84, -2.56, -9.32],
      [1932, -8.64, 8.79, -10.27],[1933, 49.98, 1.86, 0.76],[1934, -1.19, 7.96, 1.52],[1935, 46.74, 4.47, 2.99],
      [1936, 31.94, 5.02, 1.45],[1937, -35.34, 1.38, 2.86],[1938, 29.28, 4.21, -2.78],[1939, -1.1, 4.41, 0.0],
      [1940, -10.67, 5.4, 0.71],[1941, -12.77, -2.02, 9.93],[1942, 19.17, 2.29, 9.03],[1943, 25.06, 2.49, 2.96],
      [1944, 19.03, 2.58, 2.3],[1945, 35.82, 3.8, 2.25],[1946, -8.43, 3.13, 18.13],[1947, 5.2, 0.92, 8.84],
      [1948, 5.7, 1.95, 2.99],[1949, 18.3, 4.66, -2.07],[1950, 30.81, 0.43, 5.93],[1951, 23.68, -0.3, 6.0],
      [1952, 18.15, 2.27, 0.75],[1953, -1.21, 4.14, 0.75],[1954, 52.56, 3.29, -0.74],[1955, 32.6, -1.34, 0.37],
      [1956, 7.44, -2.26, 2.99],[1957, -10.46, 6.8, 2.9],[1958, 43.72, -2.1, 1.76],[1959, 12.06, -2.65, 1.73],
      [1960, 0.34, 11.64, 1.36],[1961, 26.64, 2.06, 0.67],[1962, -8.81, 5.69, 1.33],[1963, 22.61, 1.68, 1.64],
      [1964, 16.42, 3.73, 0.97],[1965, 12.4, 0.72, 1.92],[1966, -9.97, 2.91, 3.46],[1967, 23.8, -1.58, 3.04],
      [1968, 10.81, 3.27, 4.72],[1969, -8.24, -5.01, 6.2],[1970, 3.56, 16.75, 5.57],[1971, 14.22, 9.79, 3.27],
      [1972, 18.76, 2.82, 3.41],[1973, -14.31, 3.66, 8.71],[1974, -25.9, 1.99, 12.34],[1975, 37.0, 3.61, 6.94],
      [1976, 23.83, 15.98, 4.86],[1977, -6.98, 1.29, 6.7],[1978, 6.51, -0.78, 9.02],[1979, 18.52, 0.67, 13.29],
      [1980, 31.74, -2.99, 12.52],[1981, -4.7, 8.2, 8.92],[1982, 20.42, 32.81, 3.83],[1983, 22.34, 3.2, 3.79],
      [1984, 6.15, 13.73, 3.95],[1985, 31.24, 25.71, 3.8],[1986, 18.49, 24.28, 1.1],[1987, 5.81, -4.96, 4.43],
      [1988, 16.54, 8.22, 4.42],[1989, 31.48, 17.69, 4.65],[1990, -3.06, 6.24, 6.11],[1991, 30.23, 15.0, 3.06],
      [1992, 7.49, 9.36, 2.9],[1993, 9.97, 14.21, 2.75],[1994, 1.33, -8.04, 2.67],[1995, 37.2, 23.48, 2.54],
      [1996, 22.68, 1.43, 3.32],[1997, 33.1, 9.94, 1.7],[1998, 28.34, 14.92, 1.61],[1999, 20.89, -8.25, 2.68],
      [2000, -9.03, 16.66, 3.39],[2001, -11.85, 5.57, 1.55],[2002, -21.97, 15.12, 2.38],[2003, 28.36, 0.38, 1.88],
      [2004, 10.74, 4.49, 3.26],[2005, 4.83, 2.87, 3.42],[2006, 15.61, 1.96, 2.54],[2007, 5.48, 10.21, 4.08],
      [2008, -36.55, 20.1, 0.09],[2009, 25.94, -11.12, 2.72],[2010, 14.82, 8.46, 1.5],[2011, 2.1, 16.04, 2.96],
      [2012, 15.89, 2.97, 1.74],[2013, 32.15, -9.1, 1.5],[2014, 13.52, 10.75, 0.76],[2015, 1.38, 1.28, 0.73],
      [2016, 11.77, 0.69, 2.07],[2017, 21.61, 2.8, 2.11],[2018, -4.23, -0.02, 1.91],[2019, 31.21, 9.64, 2.29],
      [2020, 18.02, 11.33, 1.36],[2021, 28.47, -4.42, 7.04],[2022, -18.04, -17.83, 6.45],[2023, 26.06, 3.88, 3.35],
      [2024, 24.88, -1.64, 2.89],[2025, 17.78, 7.8, 2.68]
    ];

  const VYCHOZI = {
    vek: 35,            // současný věk
    vekKonec: 95,       // plánovat do věku
    vydaje: 480000,     // roční výdaje (Kč, dnešní ceny)
    majetek: 800000,    // investovaný majetek dnes
    sporeni: 15000,     // měsíční spoření (roste s inflací)
    vynos: 7,           // očekávaný nominální výnos % p. a.
    volatilita: 16,     // směrodatná odchylka ročního výnosu %
    inflace: 2.5,       // %
    mira: 4,            // míra výběru % (pravidlo 4 %)
    dan: 0,             // efektivní daň z kladných výnosů %
    poplatky: 0.3,      // roční náklady fondů %
    duchod: 15000,      // státní důchod měsíčně v dnešních Kč (0 = nepočítat)
    vekDuchodu: 67,
    vekOdchodu: 0,      // plánovaný věk ukončení práce (0 = jakmile dosáhnu FI)
    lean: 70,           // Lean FI: % běžných výdajů
    fat: 150,           // Fat FI: % běžných výdajů
    barista: 15000,     // Barista FI: měsíční příjem z částečné práce
    vekCoast: 0,        // Coast FI: kdy chci mít cíl (0 = věk důchodu)
    podilAkcii: 100     // backtest: podíl akcií, zbytek 10letý dluhopis
  };
  const MEZE = {
    vek: [15, 90], vekKonec: [30, 110], vydaje: [0, 1e9], majetek: [0, 1e10], sporeni: [0, 1e8],
    vynos: [-10, 30], volatilita: [0, 60], inflace: [-5, 30], mira: [0.5, 15], dan: [0, 60], poplatky: [0, 5],
    duchod: [0, 1e7], vekDuchodu: [40, 100], vekOdchodu: [0, 100], lean: [10, 100], fat: [100, 500],
    barista: [0, 1e8], vekCoast: [0, 100], podilAkcii: [0, 100]
  };

  function cislo(x) {
    if (typeof x === 'number') return x;
    const n = parseFloat(String(x == null ? '' : x).replace(/\s| /g, '').replace(',', '.'));
    return isFinite(n) ? n : NaN;
  }
  function normVstupy(v) {
    const o = {};
    for (const k in VYCHOZI) {
      let n = cislo(v && v[k]);
      if (!isFinite(n)) n = VYCHOZI[k];
      o[k] = Math.min(MEZE[k][1], Math.max(MEZE[k][0], n));
    }
    if (o.vekKonec <= o.vek) o.vekKonec = o.vek + 1;
    if (o.vekOdchodu && o.vekOdchodu < o.vek) o.vekOdchodu = o.vek;
    return o;
  }

  /* čistý nominální výnos roku (desetinně): daň jen z kladného výnosu, pak poplatky */
  function cistyNominal(r, dan, poplatky) { return (r > 0 ? r * (1 - dan / 100) : r) - poplatky / 100; }
  function realny(nominal, inflace) { return (1 + nominal) / (1 + inflace) - 1; }
  /* očekávaný reálný čistý výnos z parametrů (desetinně) */
  function realnyVynos(v) { return realny(cistyNominal(v.vynos / 100, v.dan, v.poplatky), v.inflace / 100); }

  const duchodRok = v => v.duchod * 12;
  /* roční potřeba z portfolia ve věku (výdaje − důchod, nikdy záporná) */
  function potreba(v, vek, vydaje) {
    vydaje = vydaje == null ? v.vydaje : vydaje;
    return Math.max(0, vydaje - (vek >= v.vekDuchodu ? duchodRok(v) : 0));
  }
  /* současná hodnota anuity (platba na začátku roku) */
  function anuita(r, n) {
    if (n <= 0) return 0;
    if (Math.abs(r) < 1e-9) return n;
    return (1 - Math.pow(1 + r, -n)) / r * (1 + r);
  }
  /* Cílová částka ve věku `vek`: po důchodu stačí (výdaje − důchod) / míra výběru, do důchodu se
     doplní „most“ = současná hodnota důchodu za roky, které ještě chybí. */
  function cilFI(v, vek, vydaje) {
    vydaje = vydaje == null ? v.vydaje : vydaje;
    const d = Math.min(duchodRok(v), vydaje);
    const zaklad = (vydaje - d) / (v.mira / 100);
    return zaklad + d * anuita(realnyVynos(v), Math.max(0, v.vekDuchodu - vek));
  }

  /* Deterministická projekce v reálných Kč: na konci roku výnos + roční spoření, po odchodu se na
     začátku roku vybere potřeba. Vrací roky, věk FI a věk vyčerpání. */
  function projekce(vstup) {
    const v = normVstupy(vstup), r = realnyVynos(v);
    let M = v.majetek, vekFI = null, vycerpano = null;
    const roky = [];
    for (let vek = v.vek; vek <= v.vekKonec; vek++) {
      if (vekFI === null && M >= cilFI(v, vek)) vekFI = vek;
      const odchod = v.vekOdchodu ? v.vekOdchodu : vekFI;
      const vRente = odchod !== null && vek >= odchod;
      const vyber = vRente ? potreba(v, vek) : 0;
      roky.push({ vek, majetek: M, cil: cilFI(v, vek), vyber, faze: vRente ? 'renta' : 'sporeni' });
      if (vek === v.vekKonec) break;
      if (vRente) {
        M = M - vyber;
        if (M < 0 && vycerpano === null) vycerpano = vek;
        M = Math.max(0, M) * (1 + r);
      } else M = M * (1 + r) + v.sporeni * 12;
    }
    const vekOdchodu = v.vekOdchodu || vekFI;
    const pri = vekOdchodu !== null ? roky.find(x => x.vek === vekOdchodu) : null;
    return {
      v, realnyVynos: r, roky, vekFI, vekOdchodu, vycerpano,
      majetekPriOdchodu: pri ? pri.majetek : null,
      miraPriOdchodu: pri && pri.majetek > 0 ? potreba(v, vekOdchodu) / pri.majetek : null
    };
  }

  /* první věk, kdy majetek (při spoření, bez výběrů) dosáhne cíle podle funkce cil(vek) */
  function vekDosazeni(v, cil) {
    const r = realnyVynos(v);
    let M = v.majetek;
    for (let vek = v.vek; vek <= v.vekKonec; vek++) {
      if (M >= cil(vek)) return vek;
      M = M * (1 + r) + v.sporeni * 12;
    }
    return null;
  }

  /* Varianty: běžná FI, Lean, Fat, Barista (částečný příjem do důchodu), Coast (stačí nechat růst) */
  function varianty(vstup) {
    const v = normVstupy(vstup), r = realnyVynos(v);
    const radek = (id, vydaje, popis) => {
      const vek = vekDosazeni(v, a => cilFI(v, a, vydaje));
      return { id, popis, vydaje, cilDnes: cilFI(v, v.vek, vydaje), vek };
    };
    const out = [
      radek('fi', v.vydaje, 'běžné výdaje'),
      radek('lean', v.vydaje * v.lean / 100, `${v.lean} % výdajů – skromný život`),
      radek('fat', v.vydaje * v.fat / 100, `${v.fat} % výdajů – volnější rozpočet`)
    ];
    // Barista: částečný příjem pokrývá část výdajů až do důchodu → stačí menší portfolio,
    // které ale musí po důchodu (kdy příjem končí) unést plnou potřebu.
    const b = Math.min(v.barista * 12, v.vydaje);
    const baristaCil = vek => {
      const doDuchodu = Math.max(0, v.vekDuchodu - vek);
      const poDuchodu = cilFI(v, v.vekDuchodu) / Math.pow(1 + r, doDuchodu);
      const most = (Math.max(0, v.vydaje - b)) * anuita(r, doDuchodu);
      return doDuchodu > 0 ? poDuchodu + most : cilFI(v, vek);
    };
    out.push({ id: 'barista', popis: `částečná práce za ${Math.round(v.barista)} Kč/měs. do důchodu`, vydaje: v.vydaje - b,
      cilDnes: baristaCil(v.vek), vek: vekDosazeni(v, baristaCil) });
    // Coast: majetek, který bez dalšího spoření doroste do cíle ve věku vekCoast
    const vc = v.vekCoast || v.vekDuchodu;
    const coastCil = vek => vek >= vc ? cilFI(v, vek) : cilFI(v, vc) / Math.pow(1 + r, vc - vek);
    out.push({ id: 'coast', popis: `dál nespořit, cíl ve ${vc} letech`, vydaje: v.vydaje, cilDnes: coastCil(v.vek),
      vek: vekDosazeni(v, coastCil), cilVeVeku: cilFI(v, vc) });
    return out;
  }

  /* ---------- Monte Carlo ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function gauss(rnd) {
    let u = 0;
    while (u === 0) u = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
  }
  /* Lognormální roční výnos se střední hodnotou μ a směrodatnou odchylkou σ (aritmetické). */
  function lognormParam(mu, sigma) {
    const m = 1 + mu, s2 = Math.log(1 + (sigma * sigma) / (m * m));
    return { m: Math.log(m) - s2 / 2, s: Math.sqrt(s2) };
  }
  function kvantil(serazene, p) {
    if (!serazene.length) return 0;
    const i = (serazene.length - 1) * p, d = Math.floor(i), h = Math.ceil(i);
    return serazene[d] + (serazene[h] - serazene[d]) * (i - d);
  }
  /* Simulace od dneška do vekKonec. Odchod = plánovaný věk, jinak deterministický věk FI. */
  function monteCarlo(vstup, opt) {
    opt = opt || {};
    const v = normVstupy(vstup), n = opt.n || 2000, rnd = mulberry32(opt.seed == null ? 12345 : opt.seed);
    const odchod = opt.vekOdchodu || v.vekOdchodu || projekce(v).vekFI;
    const lp = lognormParam(v.vynos / 100, v.volatilita / 100), inf = v.inflace / 100;
    const pocetLet = v.vekKonec - v.vek;
    const sloupce = Array.from({ length: pocetLet + 1 }, () => new Float64Array(n));
    let uspech = 0;
    const vekyVycerpani = [];
    for (let i = 0; i < n; i++) {
      let M = v.majetek, padl = false;
      sloupce[0][i] = M;
      for (let t = 0; t < pocetLet; t++) {
        const vek = v.vek + t;
        const nom = Math.exp(lp.m + lp.s * gauss(rnd)) - 1;
        const r = realny(cistyNominal(nom, v.dan, v.poplatky), inf);
        if (odchod !== null && vek >= odchod) {
          M -= potreba(v, vek);
          if (M < 0) { if (!padl) vekyVycerpani.push(vek); padl = true; M = 0; }
          M *= 1 + r;
        } else M = M * (1 + r) + v.sporeni * 12;
        sloupce[t + 1][i] = M;
      }
      if (!padl) uspech++;
    }
    const pasma = sloupce.map((s, t) => {
      const z = Array.from(s).sort((a, b) => a - b);
      return { vek: v.vek + t, p10: kvantil(z, 0.1), p25: kvantil(z, 0.25), p50: kvantil(z, 0.5), p75: kvantil(z, 0.75), p90: kvantil(z, 0.9) };
    });
    vekyVycerpani.sort((a, b) => a - b);
    return { n, vekOdchodu: odchod, uspesnost: uspech / n, pasma, medianVycerpani: vekyVycerpani.length ? kvantil(vekyVycerpani, 0.5) : null };
  }

  /* ---------- historický backtest ---------- */
  /* Výběrová fáze na každém úplném historickém okně: start = majetek při odchodu (deterministická projekce,
     nebo opt.majetek), každý rok výběr potřeby v reálných Kč, pak reálný výnos portfolia akcie/dluhopisy. */
  function backtest(vstup, rada, opt) {
    opt = opt || {};
    const v = normVstupy(vstup);
    rada = rada || HIST_RADA;
    const p = projekce(v);
    const odchod = opt.vekOdchodu || p.vekOdchodu;
    if (odchod === null || odchod === undefined) return { okna: [], uspesnost: null, delka: 0, duvod: 'nefi' };
    const start = opt.majetek != null ? opt.majetek : p.roky.find(x => x.vek === odchod).majetek;
    const delka = v.vekKonec - odchod;
    const a = (opt.podilAkcii != null ? opt.podilAkcii : v.podilAkcii) / 100;
    const okna = [];
    for (let s = 0; s + delka <= rada.length; s++) {
      let M = start, uspech = true, minimum = start, rokVycerpani = null;
      const cesta = [M];
      for (let k = 0; k < delka; k++) {
        const [rok, akcie, dluh, infl] = rada[s + k];
        M -= potreba(v, odchod + k);
        if (M < 0) { if (uspech) rokVycerpani = rok; uspech = false; M = 0; }
        const nom = a * akcie / 100 + (1 - a) * (dluh == null ? 0 : dluh) / 100;
        M *= 1 + realny(cistyNominal(nom, v.dan, v.poplatky), infl / 100);
        minimum = Math.min(minimum, M);
        cesta.push(M);
      }
      okna.push({ start: rada[s][0], konec: rada[s + Math.max(0, delka - 1)][0], uspech, minimum, konecna: M, rokVycerpani, cesta });
    }
    const ok = okna.filter(o => o.uspech).length;
    const serazene = okna.slice().sort((x, y) => x.konecna - y.konecna);
    return {
      okna, delka, start, vekOdchodu: odchod,
      uspesnost: okna.length ? ok / okna.length : null,
      nejhorsi: serazene[0] || null,
      median: okna.length ? kvantil(serazene.map(o => o.konecna), 0.5) : null,
      duvod: okna.length ? '' : 'kratka'
    };
  }

  /* Nejvyšší míra výběru (po 0,1 %), která v backtestu přežila všechna okna – „SWR“ dané řady. */
  function bezpecnaMira(vstup, rada, delka, podilAkcii) {
    const v = normVstupy(vstup);
    let nej = null;
    for (let m = 1; m <= 10.0001; m += 0.1) {
      const w = Object.assign({}, v, { duchod: 0, vekKonec: v.vek + delka, vekOdchodu: v.vek });
      const bt = backtest(w, rada, { vekOdchodu: v.vek, majetek: v.vydaje / (m / 100), podilAkcii });
      if (bt.uspesnost === 1) nej = Math.round(m * 10) / 10; else break;
    }
    return nej;
  }

  /* ---------- citlivost ---------- */
  /* věk FI podle násobku spoření (řádky) a posunu nominálního výnosu (sloupce) */
  function citlivostFI(vstup, nasobky, posuny) {
    const v = normVstupy(vstup);
    return nasobky.map(k => posuny.map(d => {
      const w = normVstupy(Object.assign({}, v, { sporeni: v.sporeni * k, vynos: v.vynos + d }));
      return vekDosazeni(w, a => cilFI(w, a));
    }));
  }
  /* historická úspěšnost (0–1) podle míry výběru (řádky) a podílu akcií (sloupce); bez důchodu */
  function citlivostBacktest(vstup, rada, miry, podily, delka) {
    const v = normVstupy(vstup);
    const w = Object.assign({}, v, { duchod: 0, vekKonec: v.vek + delka, vekOdchodu: v.vek });
    return miry.map(m => podily.map(a =>
      backtest(w, rada, { vekOdchodu: v.vek, majetek: v.vydaje / (m / 100), podilAkcii: a }).uspesnost));
  }

  /* ---------- vlastní řada z textu: „rok výnos% [dluhopis%] inflace%“ na řádek ---------- */
  function parseRada(text) {
    const out = [], chyby = [];
    String(text || '').split(/\r?\n/).forEach((l, i) => {
      const t = l.trim();
      if (!t || t[0] === '#') return;
      const c = t.split(/[;\t]|\s+/).filter(Boolean).map(x => cislo(x.replace('%', '')));
      if (c.some(x => !isFinite(x)) || (c.length !== 3 && c.length !== 4)) { chyby.push(i + 1); return; }
      out.push(c.length === 3 ? [c[0], c[1], null, c[2]] : c);
    });
    out.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < out.length; i++) if (out[i][0] !== out[i - 1][0] + 1) chyby.push(`rok ${out[i][0]} nenavazuje`);
    return { rada: out, chyby };
  }
  /* geometrický průměr a směrodatná odchylka řady (%), pro porovnání s parametry */
  function statistikaRady(rada, podilAkcii) {
    const a = (podilAkcii == null ? 100 : podilAkcii) / 100;
    const nom = rada.map(r => a * r[1] / 100 + (1 - a) * (r[2] || 0) / 100);
    const re = rada.map((r, i) => realny(nom[i], r[3] / 100));
    const geo = x => Math.pow(x.reduce((s, y) => s * (1 + y), 1), 1 / x.length) - 1;
    const prum = nom.reduce((s, y) => s + y, 0) / nom.length;
    const sd = Math.sqrt(nom.reduce((s, y) => s + (y - prum) ** 2, 0) / (nom.length - 1));
    return { od: rada[0][0], do: rada[rada.length - 1][0], nominal: geo(nom) * 100, realny: geo(re) * 100,
      inflace: geo(rada.map(r => r[3] / 100)) * 100, volatilita: sd * 100 };
  }

  const API = {
    KLIC, KLIC_RADA, VYCHOZI, HIST_RADA, ZDROJ_RADY, normVstupy, cistyNominal, realny, realnyVynos, potreba, anuita, cilFI,
    projekce, vekDosazeni, varianty, mulberry32, lognormParam, kvantil, monteCarlo, backtest, bezpecnaMira,
    citlivostFI, citlivostBacktest, parseRada, statistikaRady
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else window.FinNezJadro = API;
})();

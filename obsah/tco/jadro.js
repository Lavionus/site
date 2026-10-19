/* ============================================================
   tco/jadro.js – výpočetní jádro kalkulátoru celkových nákladů
   vlastnictví (TCO). Čistý modul bez DOM, testovatelný v node.

   KONVENCE (platí pro celé jádro):
   - Časová osa je MĚSÍČNÍ. Měsíc 0 = okamžik pořízení. Běžné náklady
     daného měsíce se platí na jeho konci (měsíc 1 … L).
   - Náklady jsou kladné, příjmy (zůstatková hodnota) záporné.
   - Všechny ceny se zadávají V DNEŠNÍCH CENÁCH. Volitelná inflace je
     přepočte na nominální (běžné) ceny v okamžiku platby. Ceny se mění
     skokem k výročí pořízení (1. rok dnešní ceny, 2. rok ×(1+g) …).
     Energie má vlastní růst ceny, vše ostatní obecnou inflaci.
   - Peněžní toky jsou vždy NOMINÁLNÍ. Diskontují se NOMINÁLNÍ sazbou.
     Zadá-li uživatel reálnou sazbu, převede se Fisherovou rovnicí
     (1+n) = (1+r)(1+π). Ekvivalentní roční náklad (EAC) a nivelizovaný
     náklad na jednotku se počítají reálnou sazbou → vycházejí
     v dnešních cenách, takže jsou srovnatelné mezi variantami.
   - Procenta jsou v datech uložená jako čísla v % (5 = 5 %).
   ============================================================ */
(function () {
  'use strict';

  const VERZE_DAT = 1;

  const VYCHOZI_GLOB = {
    rezim: 'nominalni',        // 'nominalni' | 'diskontovane' – co se zobrazuje
    diskont: 5,                // % p.a.
    diskontTyp: 'nominalni',   // 'nominalni' | 'realna'
    inflace: 0,                // obecná inflace % p.a.
    rustEnergie: 0,            // růst ceny energie % p.a.
    horizontTyp: 'nejdelsi',   // 'nejdelsi' | 'nsn' | 'vlastni'
    horizontLet: 10,
    mena: 'Kč'
  };

  const VYCHOZI_FIN = {
    zapnuto: false,
    akontace: 20, akontaceTyp: 'procenta',  // 'procenta' | 'kc'
    sazba: 6, sazbaTyp: 'urok',             // 'urok' (nominální p.a., měsíčně /12) | 'rpsn' (efektivní p.a. vč. nákladů)
    mesicu: 60,
    poplatek: 0                             // jednorázový poplatek při sjednání (jen u typu 'urok')
  };

  const VYCHOZI_VARIANTA = {
    nazev: 'Varianta',
    cena: 0,                   // pořizovací cena (Kč, dnešní ceny)
    zivotnost: 10,             // let
    pouzitiRocne: 0,           // jednotek použití za rok
    jednotkaPouziti: 'h',
    energieNaPouziti: 0,       // jednotek energie na 1 použití
    energieRocne: 0,           // pevná spotřeba energie za rok (pohotovost, chod)
    jednotkaEnergie: 'kWh',
    cenaEnergie: 0,            // Kč za jednotku energie
    servisRocne: 0,            // Kč/rok
    servisPeriodicky: 0,       // Kč jednou za N let (velký servis, výměna dílu)
    servisPeriodaLet: 0,
    materialNaPouziti: 0,      // Kč na 1 použití (spotřební materiál, pneu, voda…)
    ostatniRocne: 0,           // Kč/rok (pojištění, daně, předplatné)
    zustatek: 0,               // zůstatková hodnota na konci životnosti (Kč, dnešní ceny; záporná = náklad na likvidaci)
    financovani: VYCHOZI_FIN
  };

  const KATEGORIE = ['porizeni', 'splatky', 'energie', 'servis', 'material', 'ostatni', 'zustatek'];
  const NAZVY_KATEGORII = {
    porizeni: 'Pořízení (hotově / akontace)', splatky: 'Splátky a poplatky úvěru', energie: 'Energie',
    servis: 'Servis a opravy', material: 'Spotřební materiál', ostatni: 'Ostatní pevné', zustatek: 'Zůstatková hodnota'
  };

  /* ---------- pomocné ---------- */
  const kopie = o => JSON.parse(JSON.stringify(o));
  const jeCislo = x => typeof x === 'number' && isFinite(x);

  function sloucit(vychozi, data) {
    const v = kopie(vychozi);
    if (!data || typeof data !== 'object') return v;
    for (const k of Object.keys(vychozi)) {
      if (!(k in data)) continue;
      const d = data[k];
      if (vychozi[k] && typeof vychozi[k] === 'object') v[k] = sloucit(vychozi[k], d);
      else if (typeof vychozi[k] === 'number') { const n = typeof d === 'string' ? Number(d.replace(',', '.')) : Number(d); v[k] = isFinite(n) ? n : NaN; }
      else if (typeof vychozi[k] === 'boolean') v[k] = !!d;
      else v[k] = String(d);
    }
    return v;
  }
  const normalizujVariantu = d => sloucit(VYCHOZI_VARIANTA, d);
  const normalizujGlob = d => sloucit(VYCHOZI_GLOB, d);

  /* ---------- finanční matematika ---------- */

  /** Anuitní splátka: jistina P, měsíční sazba i (desetinné číslo), n splátek. */
  function anuita(P, i, n) {
    if (!(n >= 1)) throw new Error('Počet splátek musí být alespoň 1');
    if (Math.abs(i) < 1e-12) return P / n;
    return P * i / (1 - Math.pow(1 + i, -n));
  }

  /** Zůstatek jistiny po k zaplacených splátkách. */
  function zustatekUveru(P, i, splatka, k) {
    if (Math.abs(i) < 1e-12) return Math.max(0, P - splatka * k);
    const q = Math.pow(1 + i, k);
    return Math.max(0, P * q - splatka * (q - 1) / i);
  }

  /** Měsíční sazba z roční: 'urok' = nominální p.a. děleno 12, 'efektivni'/'rpsn' = (1+R)^(1/12)−1. */
  function mesicniSazba(rocniProc, typ) {
    const r = rocniProc / 100;
    return typ === 'urok' ? r / 12 : Math.pow(1 + r, 1 / 12) - 1;
  }

  /** Vnitřní měsíční výnosnost x: prijato = Σ_k=1..n splatka/(1+x)^k. Bisekce. */
  function irrMesicni(prijato, splatka, n) {
    if (!(prijato > 0) || !(splatka > 0)) return NaN;
    const f = x => { let s = 0; for (let k = 1; k <= n; k++) s += splatka / Math.pow(1 + x, k); return s - prijato; };
    let lo = -0.99, hi = 1;
    if (f(lo) < 0 || f(hi) > 0) return NaN;
    for (let it = 0; it < 200; it++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  /** RPSN (roční efektivní) z čisté vyplacené částky a splátek. */
  function rpsn(prijato, splatka, n) {
    const x = irrMesicni(prijato, splatka, n);
    return isFinite(x) ? Math.pow(1 + x, 12) - 1 : NaN;
  }

  /** Fisherova rovnice. */
  const fisherNominalni = (realna, inflace) => (1 + realna) * (1 + inflace) - 1;
  const fisherRealna = (nominalni, inflace) => (1 + nominalni) / (1 + inflace) - 1;

  /** Roční sazby (desetinná čísla) použité k diskontování podle globálních předpokladů. */
  function sazby(g) {
    const pi = g.inflace / 100, d = g.diskont / 100;
    const nominalni = g.diskontTyp === 'realna' ? fisherNominalni(d, pi) : d;
    const realna = fisherRealna(nominalni, pi);
    return { nominalni, realna, inflace: pi };
  }

  /** Diskontní faktor pro měsíc m při roční sazbě r (měsíce složené: (1+r)^(m/12)). */
  const df = (r, m) => Math.pow(1 + r, -m / 12);

  /** NPV měsíční řady toků (index = měsíc). */
  function npv(toky, rRocni) {
    let s = 0;
    for (let m = 0; m < toky.length; m++) if (toky[m]) s += toky[m] * df(rRocni, m);
    return s;
  }

  /** Ekvivalentní roční náklad: anuita roční, splatná na konci roku, po nLet let. */
  function eac(pv, rRocni, nLet) {
    if (!(nLet > 0)) return NaN;
    if (Math.abs(rRocni) < 1e-12) return pv / nLet;
    return pv * rRocni / (1 - Math.pow(1 + rRocni, -nLet));
  }
  /** Ekvivalentní měsíční náklad: měsíční anuita (měsíční sazba odvozená efektivně z roční). */
  function eacMesicni(pv, rRocni, nMesicu) {
    const i = Math.pow(1 + rRocni, 1 / 12) - 1;
    if (!(nMesicu > 0)) return NaN;
    if (Math.abs(i) < 1e-12) return pv / nMesicu;
    return pv * i / (1 - Math.pow(1 + i, -nMesicu));
  }

  function nsd(a, b) { while (b) [a, b] = [b, a % b]; return a; }
  const nsn = (a, b) => a / nsd(a, b) * b;

  const mesicuZivotnosti = v => Math.max(1, Math.round(v.zivotnost * 12));

  /* ---------- validace ---------- */
  function validujVariantu(v) {
    const chyby = [], varovani = [];
    const cis = (k, popis, min, max) => {
      const x = v[k];
      if (!jeCislo(x)) { chyby.push({ pole: k, text: popis + ': zadej číslo' }); return; }
      if (min != null && x < min) chyby.push({ pole: k, text: `${popis}: nejméně ${min}` });
      if (max != null && x > max) chyby.push({ pole: k, text: `${popis}: nejvýše ${max}` });
    };
    cis('cena', 'Pořizovací cena', 0, 1e12);
    cis('zivotnost', 'Životnost', 1 / 12, 100);
    cis('pouzitiRocne', 'Četnost používání', 0, 1e9);
    cis('energieNaPouziti', 'Spotřeba na použití', 0, 1e6);
    cis('energieRocne', 'Pevná spotřeba za rok', 0, 1e9);
    cis('cenaEnergie', 'Cena energie', 0, 1e6);
    cis('servisRocne', 'Servis za rok', 0, 1e12);
    cis('servisPeriodicky', 'Periodický servis', 0, 1e12);
    cis('servisPeriodaLet', 'Perioda servisu', 0, 100);
    cis('materialNaPouziti', 'Materiál na použití', 0, 1e9);
    cis('ostatniRocne', 'Ostatní za rok', 0, 1e12);
    cis('zustatek', 'Zůstatková hodnota', -1e12, 1e12);
    if (jeCislo(v.zustatek) && jeCislo(v.cena) && v.zustatek > v.cena)
      varovani.push({ pole: 'zustatek', text: 'Zůstatková hodnota je vyšší než pořizovací cena – zkontroluj.' });
    if (v.servisPeriodicky > 0 && !(v.servisPeriodaLet > 0))
      varovani.push({ pole: 'servisPeriodaLet', text: 'Periodický servis nemá periodu – nezapočítá se.' });
    if (v.servisPeriodaLet > 0 && v.servisPeriodicky > 0 && jeCislo(v.zivotnost) && v.servisPeriodaLet >= v.zivotnost)
      varovani.push({ pole: 'servisPeriodaLet', text: 'Perioda servisu není kratší než životnost – během životnosti nenastane.' });
    if (['cena', 'servisRocne', 'servisPeriodicky', 'materialNaPouziti', 'ostatniRocne'].every(k => v[k] === 0) && !(v.cenaEnergie > 0 && (v.energieNaPouziti > 0 || v.energieRocne > 0)))
      varovani.push({ pole: 'cena', text: 'Varianta zatím nemá žádné náklady – vyplň cenu a provozní náklady.' });
    const f = v.financovani;
    if (f && f.zapnuto) {
      const fc = (k, popis, min, max) => {
        const x = f[k];
        if (!jeCislo(x)) { chyby.push({ pole: 'fin.' + k, text: popis + ': zadej číslo' }); return; }
        if (x < min) chyby.push({ pole: 'fin.' + k, text: `${popis}: nejméně ${min}` });
        if (x > max) chyby.push({ pole: 'fin.' + k, text: `${popis}: nejvýše ${max}` });
      };
      fc('akontace', 'Akontace', 0, f.akontaceTyp === 'procenta' ? 100 : 1e12);
      fc('sazba', 'Úroková sazba', 0, 100);
      fc('mesicu', 'Počet splátek', 1, 600);
      fc('poplatek', 'Poplatek', 0, 1e12);
      if (jeCislo(f.mesicu) && Math.round(f.mesicu) !== f.mesicu) chyby.push({ pole: 'fin.mesicu', text: 'Počet splátek musí být celé číslo' });
      if (f.akontaceTyp === 'kc' && jeCislo(f.akontace) && jeCislo(v.cena) && f.akontace > v.cena)
        chyby.push({ pole: 'fin.akontace', text: 'Akontace je vyšší než cena' });
      if (jeCislo(f.mesicu) && jeCislo(v.zivotnost) && f.mesicu > mesicuZivotnosti(v))
        varovani.push({ pole: 'fin.mesicu', text: 'Úvěr je delší než životnost – zbytek jistiny se doplatí při vyřazení.' });
    }
    return { chyby, varovani };
  }

  function validujGlob(g) {
    const chyby = [];
    const cis = (k, popis, min, max) => {
      if (!jeCislo(g[k])) chyby.push({ pole: k, text: popis + ': zadej číslo' });
      else if (g[k] < min || g[k] > max) chyby.push({ pole: k, text: `${popis}: rozsah ${min} až ${max}` });
    };
    cis('diskont', 'Diskontní sazba', -50, 100);
    cis('inflace', 'Inflace', -50, 100);
    cis('rustEnergie', 'Růst ceny energie', -50, 100);
    cis('horizontLet', 'Horizont', 1 / 12, 100);
    if (jeCislo(g.diskont) && jeCislo(g.inflace)) {
      const s = sazby(g);
      if (!(s.nominalni > -1) || !(s.realna > -1)) chyby.push({ pole: 'diskont', text: 'Diskontní sazba po přepočtu není smysluplná' });
    }
    return chyby;
  }

  /* ---------- úvěr ---------- */
  function parametryUveru(v, cenaNominalni, poplatekNominalni) {
    const f = v.financovani;
    const akontace = f.akontaceTyp === 'procenta' ? cenaNominalni * f.akontace / 100 : Math.min(f.akontace, cenaNominalni);
    const jistina = Math.max(0, cenaNominalni - akontace);
    const i = mesicniSazba(f.sazba, f.sazbaTyp === 'rpsn' ? 'rpsn' : 'urok');
    const n = Math.round(f.mesicu);
    const splatka = jistina > 0 ? anuita(jistina, i, n) : 0;
    const poplatek = f.sazbaTyp === 'rpsn' ? 0 : poplatekNominalni;
    return { akontace, jistina, i, n, splatka, poplatek };
  }

  /** Splátkový kalendář (pro zobrazení). */
  function splatkovyKalendar(jistina, i, n) {
    const s = anuita(jistina, i, n), r = [];
    let z = jistina;
    for (let k = 1; k <= n; k++) {
      const urok = z * i, umor = s - urok;
      z = Math.max(0, z - umor);
      r.push({ k, splatka: s, urok, umor, zustatek: z });
    }
    return r;
  }

  /* ---------- peněžní toky ---------- */

  /**
   * Měsíční peněžní toky varianty do horizontu H měsíců (H = null → jedna životnost).
   * Po skončení životnosti se zařízení nahradí stejným (pořizovací cena roste s obecnou inflací).
   * Je-li na konci horizontu cyklus rozpracovaný, zařízení se „prodá“ za lineárně odepsanou hodnotu
   * (cena − (cena − zůstatek)·stáří/životnost) a doplatí se zbytek úvěru.
   */
  function toky(vIn, gIn, H) {
    const v = normalizujVariantu(vIn), g = normalizujGlob(gIn);
    const L = mesicuZivotnosti(v);
    if (H == null) H = L;
    H = Math.max(1, Math.round(H));
    const pi = g.inflace / 100, ge = g.rustEnergie / 100;
    const kat = {}; for (const k of KATEGORIE) kat[k] = new Float64Array(H + 1);
    const pouziti = new Float64Array(H + 1);
    const idxBeh = (r, m) => Math.pow(1 + r, Math.floor((m - 1) / 12));
    const idxBod = (r, m) => Math.pow(1 + r, Math.floor(m / 12));
    const pm = v.pouzitiRocne / 12;
    const energieMes = pm * v.energieNaPouziti + v.energieRocne / 12;   // jednotek energie za měsíc
    let uroky = 0, doplatky = 0, splatkyCelkem = 0, poplatky = 0, cykly = 0;
    let uver = null;
    for (let m = 1; m <= H; m++) {
      kat.energie[m] = energieMes * v.cenaEnergie * idxBeh(ge, m);
      kat.servis[m] = v.servisRocne / 12 * idxBeh(pi, m);
      kat.material[m] = pm * v.materialNaPouziti * idxBeh(pi, m);
      kat.ostatni[m] = v.ostatniRocne / 12 * idxBeh(pi, m);
      pouziti[m] = pm;
    }
    for (let s = 0; s < H; s += L) {
      cykly++;
      const konec = Math.min(s + L, H), vek = konec - s;
      const P = v.cena * idxBod(pi, s);
      const f = v.financovani;
      if (f && f.zapnuto && P > 0) {
        const u = parametryUveru(v, P, f.poplatek * idxBod(pi, s));
        if (!uver) uver = Object.assign({}, u, { rpsn: rpsn(u.jistina - u.poplatek, u.splatka, u.n) });
        kat.porizeni[s] += u.akontace;
        kat.splatky[s] += u.poplatek; poplatky += u.poplatek;
        const kMax = Math.min(u.n, vek);
        for (let k = 1; k <= kMax; k++) { kat.splatky[s + k] += u.splatka; splatkyCelkem += u.splatka; }
        let dopl = 0;
        if (u.n > vek) { dopl = zustatekUveru(u.jistina, u.i, u.splatka, vek); kat.splatky[konec] += dopl; doplatky += dopl; }
        uroky += u.splatka * kMax + dopl - u.jistina;
      } else kat.porizeni[s] += P;
      if (v.servisPeriodicky > 0 && v.servisPeriodaLet > 0) {
        const per = Math.round(v.servisPeriodaLet * 12);
        for (let a = per; a < L; a += per) { const m = s + a; if (m < H) kat.servis[m] += v.servisPeriodicky * idxBod(pi, m); }
      }
      const hodnotaDnes = vek >= L ? v.zustatek : v.cena - (v.cena - v.zustatek) * vek / L;
      kat.zustatek[konec] -= hodnotaDnes * idxBod(pi, konec);
    }
    const celkem = new Float64Array(H + 1);
    for (let m = 0; m <= H; m++) for (const k of KATEGORIE) celkem[m] += kat[k][m];
    return { H, L, cykly, kat, celkem, pouziti, uver, uroky, poplatky, doplatky, splatkyCelkem };
  }

  function kumulativ(pole, r) {
    const c = new Float64Array(pole.length); let s = 0;
    for (let m = 0; m < pole.length; m++) { s += r == null ? pole[m] : pole[m] * df(r, m); c[m] = s; }
    return c;
  }
  const soucet = a => { let s = 0; for (const x of a) s += x; return s; };

  /** Vyhodnocení jedné varianty za její vlastní životnost (+ volitelně za společný horizont H). */
  function vyhodnot(vIn, gIn, H) {
    const v = normalizujVariantu(vIn), g = normalizujGlob(gIn);
    const sz = sazby(g);
    const t = toky(v, g, null);
    const L = t.L, roky = L / 12;
    const tco = soucet(t.celkem), pv = npv(t.celkem, sz.nominalni);
    const struktura = {}, strukturaPV = {};
    for (const k of KATEGORIE) { struktura[k] = soucet(t.kat[k]); strukturaPV[k] = npv(t.kat[k], sz.nominalni); }
    const pouzitiCelkem = soucet(t.pouziti);
    let pouzitiPV = 0; for (let m = 1; m <= L; m++) pouzitiPV += t.pouziti[m] * df(sz.realna, m);
    const r = {
      nazev: v.nazev, L, roky, tco, pv,
      rocniPrumer: tco / roky, mesicniPrumer: tco / L,
      eacRocni: eac(pv, sz.realna, roky), eacMesicni: eacMesicni(pv, sz.realna, L),
      pouzitiCelkem, naJednotku: pouzitiCelkem > 0 ? tco / pouzitiCelkem : null,
      nivelizovanyNaJednotku: pouzitiPV > 0 ? pv / pouzitiPV : null,
      struktura, strukturaPV, uver: t.uver, uroky: t.uroky, poplatky: t.poplatky, doplatky: t.doplatky,
      toky: t, sazby: sz
    };
    if (H != null) {
      const th = toky(v, g, H);
      r.horizont = {
        H, cykly: th.cykly, toky: th,
        tco: soucet(th.celkem), pv: npv(th.celkem, sz.nominalni),
        kum: kumulativ(th.celkem, null), kumPV: kumulativ(th.celkem, sz.nominalni)
      };
    }
    return r;
  }

  /** Společný horizont v měsících. */
  function spolecnyHorizont(varianty, g) {
    const L = varianty.map(v => mesicuZivotnosti(normalizujVariantu(v)));
    const max = Math.max(...L);
    if (g.horizontTyp === 'vlastni') return { H: Math.max(1, Math.round(g.horizontLet * 12)), poznamka: '' };
    if (g.horizontTyp === 'nsn') {
      let n = 1; for (const x of L) n = nsn(n, x);
      if (n <= 1200) return { H: n, poznamka: '' };
      return { H: max, poznamka: 'Nejmenší společný násobek životností přesahuje 100 let – použita nejdelší životnost.' };
    }
    return { H: max, poznamka: '' };
  }

  /** Vyhodnotí celý scénář. */
  function vyhodnotScenar(scenar) {
    const g = normalizujGlob(scenar.glob);
    const varianty = (scenar.varianty || []).map(normalizujVariantu);
    if (!varianty.length) return { g, varianty, vysledky: [], H: 0, poznamka: '', body: [] };
    const { H, poznamka } = spolecnyHorizont(varianty, g);
    const vysledky = varianty.map(v => vyhodnot(v, g, H));
    const disk = g.rezim === 'diskontovane';
    const body = [];
    for (let a = 0; a < vysledky.length; a++) for (let b = a + 1; b < vysledky.length; b++) {
      const A = disk ? vysledky[a].horizont.kumPV : vysledky[a].horizont.kum;
      const B = disk ? vysledky[b].horizont.kumPV : vysledky[b].horizont.kum;
      body.push({ a, b, prusecky: bodyZvratu(A, B) });
    }
    return { g, varianty, vysledky, H, poznamka, body, sazby: sazby(g) };
  }

  /**
   * Body zvratu dvou kumulativních řad (index = měsíc). Mezi sousedními měsíci lineární interpolace.
   * Vrací [{mesic (desetinné), levnejsiPred: 'a'|'b'}].
   */
  function bodyZvratu(A, B) {
    const n = Math.min(A.length, B.length), out = [];
    const EPS = 1e-9;
    const zn = x => (Math.abs(x) <= EPS ? 0 : Math.sign(x));
    let posledni = zn(A[0] - B[0]);
    for (let m = 1; m < n; m++) {
      const d0 = A[m - 1] - B[m - 1], d1 = A[m] - B[m];
      const s1 = zn(d1);
      if (s1 !== 0 && posledni !== 0 && s1 !== posledni) {
        const t = zn(d0) === 0 ? m - 1 : (m - 1) + d0 / (d0 - d1);
        out.push({ mesic: t, levnejsiPred: posledni < 0 ? 'a' : 'b' });
      }
      if (s1 !== 0) posledni = s1;
    }
    return out;
  }

  /* ---------- citlivost ---------- */
  const PARAMETRY = {
    cenaEnergie: { nazev: 'Cena energie', typ: 'rel', aplikuj: (vs, g, f) => vs.forEach(v => v.cenaEnergie *= (1 + f)) },
    zivotnost:   { nazev: 'Životnost', typ: 'rel', aplikuj: (vs, g, f) => vs.forEach(v => v.zivotnost = Math.max(1 / 12, v.zivotnost * (1 + f))) },
    cetnost:     { nazev: 'Četnost používání', typ: 'rel', aplikuj: (vs, g, f) => vs.forEach(v => v.pouzitiRocne *= (1 + f)) },
    cena:        { nazev: 'Pořizovací cena', typ: 'rel', aplikuj: (vs, g, f) => vs.forEach(v => v.cena *= (1 + f)) },
    servis:      { nazev: 'Servis a materiál', typ: 'rel', aplikuj: (vs, g, f) => vs.forEach(v => { v.servisRocne *= (1 + f); v.servisPeriodicky *= (1 + f); v.materialNaPouziti *= (1 + f); }) },
    zustatek:    { nazev: 'Zůstatková hodnota', typ: 'rel', aplikuj: (vs, g, f) => vs.forEach(v => v.zustatek *= (1 + f)) },
    rustEnergie: { nazev: 'Růst ceny energie', typ: 'pb', aplikuj: (vs, g, d) => { g.rustEnergie += d; } },
    diskont:     { nazev: 'Diskontní sazba', typ: 'pb', jenDiskont: true, aplikuj: (vs, g, d) => { g.diskont += d; } }
  };

  /**
   * Hodnota metriky pro scénář. metrika: 'rocni' | 'jednotka' | 'horizont'.
   * V nominálním režimu: průměr za rok / náklad na jednotku / součet za horizont.
   * V diskontovaném: EAC (reálně) / nivelizovaný náklad na jednotku / NPV za horizont.
   * idxB != null → rozdíl A − B.
   */
  function metrika(varianty, g, idxA, idxB, typ) {
    const disk = g.rezim === 'diskontovane';
    const H = typ === 'horizont' ? spolecnyHorizont(varianty, g).H : null;
    const m = i => {
      const r = vyhodnot(varianty[i], g, H);
      if (typ === 'rocni') return disk ? r.eacRocni : r.rocniPrumer;
      if (typ === 'jednotka') { const x = disk ? r.nivelizovanyNaJednotku : r.naJednotku; return x == null ? NaN : x; }
      return disk ? r.horizont.pv : r.horizont.tco;
    };
    return idxB == null ? m(idxA) : m(idxA) - m(idxB);
  }

  function upraveny(varianty, g, klic, x) {
    const vs = varianty.map(v => normalizujVariantu(v)), g2 = normalizujGlob(g);
    PARAMETRY[klic].aplikuj(vs, g2, x);
    return { vs, g2 };
  }

  /**
   * Tornádo: pro každý parametr hodnota metriky při −delta a +delta.
   * delta = relativní změna (0,2 = ±20 %), deltaPb = změna sazeb v procentních bodech.
   */
  function citlivost(scenar, { idxA = 0, idxB = null, typ = 'rocni', delta = 0.2, deltaPb = 2, klice = null } = {}) {
    const vars = scenar.varianty.map(normalizujVariantu), g = normalizujGlob(scenar.glob);
    const zaklad = metrika(vars, g, idxA, idxB, typ);
    const out = [];
    for (const k of klice || Object.keys(PARAMETRY)) {
      const p = PARAMETRY[k];
      if (p.jenDiskont && g.rezim !== 'diskontovane') continue;
      const d = p.typ === 'pb' ? deltaPb : delta;
      const lo = upraveny(vars, g, k, -d), hi = upraveny(vars, g, k, d);
      const nizka = metrika(lo.vs, lo.g2, idxA, idxB, typ), vysoka = metrika(hi.vs, hi.g2, idxA, idxB, typ);
      out.push({ klic: k, nazev: p.nazev, typ: p.typ, zmena: d, nizka, vysoka, zaklad, rozpeti: Math.abs(vysoka - nizka) });
    }
    out.sort((a, b) => b.rozpeti - a.rozpeti);
    return { zaklad, polozky: out };
  }

  /** Průběh metriky všech variant při změně parametru od..do (relativně, nebo v p. b.). */
  function prubeh(scenar, klic, od, doH, kroku, typ) {
    const vars = scenar.varianty.map(normalizujVariantu), g = normalizujGlob(scenar.glob);
    const xs = [], ys = vars.map(() => []);
    for (let j = 0; j <= kroku; j++) {
      const x = od + (doH - od) * j / kroku; xs.push(x);
      const u = upraveny(vars, g, klic, x);
      vars.forEach((_, i) => ys[i].push(metrika(u.vs, u.g2, i, null, typ)));
    }
    return { xs, ys };
  }

  /** Hodnota změny parametru, při které se metriky variant A a B vyrovnají (bisekce v intervalu), nebo null. */
  function prahVyrovnani(scenar, klic, idxA, idxB, od, doH, typ) {
    const vars = scenar.varianty.map(normalizujVariantu), g = normalizujGlob(scenar.glob);
    const f = x => { const u = upraveny(vars, g, klic, x); return metrika(u.vs, u.g2, idxA, idxB, typ); };
    let lo = od, hi = doH, flo = f(lo), fhi = f(hi);
    if (!isFinite(flo) || !isFinite(fhi) || Math.sign(flo) === Math.sign(fhi)) return null;
    for (let it = 0; it < 60; it++) {
      const m = (lo + hi) / 2, fm = f(m);
      if (Math.sign(fm) === Math.sign(flo)) { lo = m; flo = fm; } else hi = m;
    }
    return (lo + hi) / 2;
  }

  /* ---------- scénáře, import / export ---------- */
  function novyScenar(nazev) {
    return { verze: VERZE_DAT, nazev: nazev || 'Nový scénář', glob: kopie(VYCHOZI_GLOB),
             varianty: [Object.assign(kopie(VYCHOZI_VARIANTA), { nazev: 'Varianta A' })], poznamka: '' };
  }

  /** Bezpečné načtení scénáře z libovolného JSON objektu. Vyhazuje Error s českou zprávou. */
  function nactiScenar(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Soubor neobsahuje scénář (očekáván objekt JSON).');
    if (obj.verze != null && obj.verze > VERZE_DAT) throw new Error('Scénář pochází z novější verze kalkulátoru (verze ' + obj.verze + ').');
    if (!Array.isArray(obj.varianty) || !obj.varianty.length) throw new Error('Scénář neobsahuje žádné varianty.');
    if (obj.varianty.length > 8) throw new Error('Scénář má víc než 8 variant.');
    const s = {
      verze: VERZE_DAT,
      nazev: String(obj.nazev || 'Načtený scénář').slice(0, 120),
      poznamka: String(obj.poznamka || '').slice(0, 4000),
      glob: normalizujGlob(obj.glob),
      varianty: obj.varianty.map(v => { const n = normalizujVariantu(v); n.nazev = n.nazev.slice(0, 80); return n; })
    };
    for (const k of ['rezim', 'diskontTyp', 'horizontTyp']) {
      const povolene = { rezim: ['nominalni', 'diskontovane'], diskontTyp: ['nominalni', 'realna'], horizontTyp: ['nejdelsi', 'nsn', 'vlastni'] }[k];
      if (!povolene.includes(s.glob[k])) s.glob[k] = VYCHOZI_GLOB[k];
    }
    const chybyG = validujGlob(s.glob);
    const chyby = chybyG.map(c => 'Předpoklady – ' + c.text);
    s.varianty.forEach(v => validujVariantu(v).chyby.forEach(c => chyby.push(v.nazev + ' – ' + c.text)));
    if (chyby.length) throw new Error('Neplatné hodnoty: ' + chyby.slice(0, 5).join('; '));
    return s;
  }

  const csvCislo = x => (x == null || !isFinite(x)) ? '' : (Math.round(x * 100) / 100).toString().replace('.', ',');
  const csvText = t => { t = String(t); return /[;"\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };

  /** CSV (oddělovač středník, desetinná čárka – pro český Excel). */
  function exportCSV(scenar) {
    const R = vyhodnotScenar(scenar), rad = [];
    const g = R.g;
    rad.push(['Scénář', scenar.nazev].map(csvText).join(';'));
    rad.push(['Diskontní sazba nominální % p.a.', csvCislo(R.sazby.nominalni * 100)].join(';'));
    rad.push(['Diskontní sazba reálná % p.a.', csvCislo(R.sazby.realna * 100)].join(';'));
    rad.push(['Obecná inflace % p.a.', csvCislo(g.inflace)].join(';'));
    rad.push(['Růst ceny energie % p.a.', csvCislo(g.rustEnergie)].join(';'));
    rad.push(['Společný horizont (měsíců)', R.H].join(';'));
    rad.push('');
    rad.push(['Varianta', 'Životnost (měsíců)', 'TCO nominálně', 'TCO diskontovaně (NPV)', 'Průměr za rok (nominálně)',
      'Průměr za měsíc (nominálně)', 'EAC roční (reálně)', 'EAC měsíční (reálně)', 'Náklad na jednotku (nominálně)',
      'Nivelizovaný náklad na jednotku (reálně)', 'Horizont nominálně', 'Horizont NPV'].map(csvText).join(';'));
    for (const r of R.vysledky) rad.push([csvText(r.nazev), r.L, csvCislo(r.tco), csvCislo(r.pv), csvCislo(r.rocniPrumer),
      csvCislo(r.mesicniPrumer), csvCislo(r.eacRocni), csvCislo(r.eacMesicni), csvCislo(r.naJednotku), csvCislo(r.nivelizovanyNaJednotku),
      csvCislo(r.horizont.tco), csvCislo(r.horizont.pv)].join(';'));
    rad.push('');
    const hl = ['Měsíc'];
    for (const r of R.vysledky) hl.push(r.nazev + ' – tok nominálně', r.nazev + ' – kumulativně nominálně', r.nazev + ' – kumulativně NPV');
    rad.push(hl.map(csvText).join(';'));
    for (let m = 0; m <= R.H; m++) {
      const row = [m];
      for (const r of R.vysledky) row.push(csvCislo(r.horizont.toky.celkem[m]), csvCislo(r.horizont.kum[m]), csvCislo(r.horizont.kumPV[m]));
      rad.push(row.join(';'));
    }
    return '﻿' + rad.join('\r\n') + '\r\n';
  }

  const API = {
    VERZE_DAT, VYCHOZI_GLOB, VYCHOZI_VARIANTA, VYCHOZI_FIN, KATEGORIE, NAZVY_KATEGORII, PARAMETRY,
    normalizujVariantu, normalizujGlob, validujVariantu, validujGlob,
    anuita, zustatekUveru, mesicniSazba, irrMesicni, rpsn, splatkovyKalendar, parametryUveru,
    fisherNominalni, fisherRealna, sazby, df, npv, eac, eacMesicni, nsn, mesicuZivotnosti,
    toky, kumulativ, vyhodnot, spolecnyHorizont, vyhodnotScenar, bodyZvratu,
    metrika, citlivost, prubeh, prahVyrovnani, novyScenar, nactiScenar, exportCSV
  };
  if (typeof module !== 'undefined') module.exports = API; else window.TCO = API;
})();

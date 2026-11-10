/* OSVČ: paušální daň vs. skutečné výdaje – jádro bez DOM (test: _test/osvc_test.js).
   Roční výpočet daně z příjmů (§ 7 ZDP), sociálního (29,2 % z VZ) a zdravotního pojištění (13,5 % z VZ)
   ve třech variantách – skutečné výdaje, výdajový paušál, paušální daň – a bonus DPP/DPČ.
   Částky jsou orientační, stav k 11/2026; položky s `overit: true` v PARAMETRY nejsou potvrzené z úředního zdroje. */
(function () {
  'use strict';
  const VERZE = 1;
  const KLIC = 'webapp_osvc';

  /* Druhy činnosti pro výdajový paušál (§ 7 odst. 7 ZDP): procento a roční strop výdajů (2 000 000 Kč příjmů).
     `pausalniDan` = jak se příjmy počítají do pásem paušální daně (80/60 → mírnější hranice, 40 → základní, nájem § 9 → režim vylučuje).
     `pojistne` = zda příjmy podléhají SP/ZP (nájem podle § 9 ne). */
  const DRUHY = [
    { id: '80', nazev: 'Zemědělství, řemeslná živnost (80 %)', procento: 80, strop: 1600000, pojistne: true },
    { id: '60', nazev: 'Ostatní živnost (60 %)', procento: 60, strop: 1200000, pojistne: true },
    { id: '40', nazev: 'Svobodná povolání, autorské, jiné podnikání (40 %)', procento: 40, strop: 800000, pojistne: true },
    { id: '30', nazev: 'Nájem – § 9 (30 %)', procento: 30, strop: 600000, pojistne: false }
  ];
  const DRUH = Object.fromEntries(DRUHY.map(d => [d.id, d]));

  /* Parametry po letech. Zdroje: nařízení vlády o průměrné mzdě (2025: 46 557 Kč, 2026: 48 967 Kč, NV 365/2025 Sb.),
     zákon o daních z příjmů, zákon o pojistném na soc. zabezpečení, zákon o veřejném zdravotním pojištění. */
  const PARAMETRY = {
    2025: {
      rok: 2025,
      prumernaMzda: 46557,
      minimalniMzda: 20800,
      sazbaDan: 0.15, sazbaDanVyssi: 0.23, nasobekHranice: 36,     // 23 % nad 36násobek průměrné mzdy = 1 676 052 Kč
      sp: { sazba: 0.292, podilZakladu: 0.55, minHlavni: 0.35, minVedlejsi: 0.11, maxNasobek: 48, rozhodnaCastkaVedlejsi: 111736 },
      zp: { sazba: 0.135, podilZakladu: 0.50, minHlavni: 0.50 },
      slevy: { poplatnik: 30840, manzel: 24840, invalidita12: 2520, invalidita3: 5040, ztpp: 16140, deti: [15204, 22320, 27840] },
      nezdanitelne: { penzijniZivotniMax: 48000, daryMaxPodil: 0.30, daryMin: 1000 },   // dary 30 % – dočasné zvýšení platné pro 2024–2026
      pausalniDan: { mesicne: [8716, 16745, 27139], hraniceZakladni: [1000000, 1500000, 2000000], maxPrijmy: 2000000, ostatniPrijmyMax: 50000 },
      dpp: { limit: 11500, spZam: 0.071, zpZam: 0.045, spFirma: 0.248, zpFirma: 0.09, slevaMesic: 2570 },
      dpc: { limit: 4500, spZam: 0.071, zpZam: 0.045, spFirma: 0.248, zpFirma: 0.09, slevaMesic: 2570 }
    },
    2026: {
      rok: 2026,
      prumernaMzda: 48967,
      minimalniMzda: 22400,
      sazbaDan: 0.15, sazbaDanVyssi: 0.23, nasobekHranice: 36,     // 1 762 812 Kč
      /* minHlavni: původně 40 % (konsolidační balíček), novela 2026 vrátila 35 % – podle zdrojů zpětně od 1. 1. 2026 (⚠ ověřit; některé zdroje uvádějí až od 1. 7.) */
      sp: { sazba: 0.292, podilZakladu: 0.55, minHlavni: 0.35, minVedlejsi: 0.11, maxNasobek: 48, rozhodnaCastkaVedlejsi: 117521, overit: true },
      zp: { sazba: 0.135, podilZakladu: 0.50, minHlavni: 0.50 },
      slevy: { poplatnik: 30840, manzel: 24840, invalidita12: 2520, invalidita3: 5040, ztpp: 16140, deti: [15204, 22320, 27840] },
      nezdanitelne: { penzijniZivotniMax: 48000, daryMaxPodil: 0.30, daryMin: 1000, overit: true },   // ⚠ 30 % na dary má platit naposledy za 2026
      /* 1. pásmo: leden–červen 9 984 Kč, od července 9 162 Kč zpětně za celý rok (přeplatek se započte) – počítáme 9 162 */
      pausalniDan: { mesicne: [9162, 16745, 27139], hraniceZakladni: [1000000, 1500000, 2000000], maxPrijmy: 2000000, ostatniPrijmyMax: 50000, overit: true },
      dpp: { limit: 12000, spZam: 0.071, zpZam: 0.045, spFirma: 0.248, zpFirma: 0.09, slevaMesic: 2570 },
      dpc: { limit: 4500, spZam: 0.071, zpZam: 0.045, spFirma: 0.248, zpFirma: 0.09, slevaMesic: 2570 }
    }
  };
  const ROKY = Object.keys(PARAMETRY).map(Number);

  const kc = v => Math.max(0, Math.round(Number(v) || 0));
  const ceil = v => Math.ceil(v - 1e-9);

  /* ---------- vstupy ---------- */
  function normVstup(v) {
    v = v || {};
    const rok = PARAMETRY[v.rok] ? Number(v.rok) : ROKY[ROKY.length - 1];
    const inv = ['0', '12', '3', 'ztpp'].includes(String(v.invalidita)) ? String(v.invalidita) : '0';
    return {
      rok, prijmy: kc(v.prijmy), vydaje: kc(v.vydaje),
      druh: DRUH[v.druh] ? String(v.druh) : '60',
      vedlejsi: !!v.vedlejsi, platceDph: !!v.platceDph, zamestnani: !!v.zamestnani, ostatniPrijmy: !!v.ostatniPrijmy,
      deti: Math.min(20, kc(v.deti)), manzel: !!v.manzel, invalidita: inv,
      penzijni: kc(v.penzijni), zivotni: kc(v.zivotni), dary: kc(v.dary)
    };
  }

  /* ---------- daň z příjmů ---------- */
  function slevyRocni(P, v) {
    let s = P.slevy.poplatnik;
    if (v.manzel) s += P.slevy.manzel;
    if (v.invalidita === '12') s += P.slevy.invalidita12;
    else if (v.invalidita === '3') s += P.slevy.invalidita3;
    else if (v.invalidita === 'ztpp') s += P.slevy.ztpp;
    return s;
  }
  function zvyhodneniDeti(P, pocet) {
    let z = 0;
    for (let i = 0; i < pocet; i++) z += P.slevy.deti[Math.min(i, 2)];
    return z;
  }
  /* Nezdanitelné části: penzijní + životní společný limit; dary nejméně 1 000 Kč (nebo 2 % ZD), nejvýš 30 % ZD. */
  function nezdanitelne(P, v, zaklad) {
    const pz = Math.min(v.penzijni + v.zivotni, P.nezdanitelne.penzijniZivotniMax);
    const daryOk = v.dary >= Math.min(P.nezdanitelne.daryMin, zaklad * 0.02) && v.dary > 0;
    const dary = daryOk ? Math.min(v.dary, Math.floor(zaklad * P.nezdanitelne.daryMaxPodil)) : 0;
    return { penzijniZivotni: pz, dary, celkem: pz + dary };
  }
  /* Daň ze základu po odečtech: ZD zaokrouhlen na stovky dolů, 15 % do hranice, 23 % nad ní, slevy nejvýš do nuly,
     daňové zvýhodnění na děti může jít do bonusu (jen při příjmech ≥ 6× minimální mzda). */
  function dan(P, v, zakladHruby, bezSlevNaDetiManzela) {
    const nz = nezdanitelne(P, v, zakladHruby);
    const zaklad = Math.max(0, Math.floor((zakladHruby - nz.celkem) / 100) * 100);
    const hranice = P.nasobekHranice * P.prumernaMzda;
    const danPred = ceil(Math.min(zaklad, hranice) * P.sazbaDan + Math.max(0, zaklad - hranice) * P.sazbaDanVyssi);
    const slevy = bezSlevNaDetiManzela ? P.slevy.poplatnik : slevyRocni(P, v);
    const poSlevach = Math.max(0, danPred - slevy);
    const zvyh = bezSlevNaDetiManzela ? 0 : zvyhodneniDeti(P, v.deti);
    const rozdil = poSlevach - zvyh;
    const bonusMozny = v.prijmy >= 6 * P.minimalniMzda;
    const bonus = rozdil < 0 && bonusMozny ? -rozdil : 0;
    return { nezdanitelne: nz, zaklad, hranice, danPred, slevy, zvyhodneni: zvyh, dan: Math.max(0, rozdil), bonus, danCista: Math.max(0, rozdil) - bonus };
  }

  /* ---------- pojistné ---------- */
  function socialni(P, v, zaklad) {
    const d = DRUH[v.druh];
    if (!d.pojistne) return { vz: 0, min: 0, castka: 0, pozn: 'Příjmy z nájmu (§ 9) pojistnému nepodléhají.' };
    const s = P.sp;
    const minMesic = ceil(P.prumernaMzda * (v.vedlejsi ? s.minVedlejsi : s.minHlavni));
    if (v.vedlejsi && zaklad < s.rozhodnaCastkaVedlejsi) {
      return { vz: 0, min: 0, castka: 0, pozn: 'Vedlejší činnost se ziskem pod rozhodnou částkou ' + s.rozhodnaCastkaVedlejsi.toLocaleString('cs-CZ') + ' Kč – sociální pojištění se neplatí.' };
    }
    const max = s.maxNasobek * P.prumernaMzda;
    const vz = Math.min(max, Math.max(minMesic * 12, ceil(zaklad * s.podilZakladu)));
    return { vz, min: minMesic * 12, max, castka: ceil(vz * s.sazba), zalohaMin: ceil(minMesic * s.sazba), pozn: '' };
  }
  function zdravotni(P, v, zaklad) {
    const d = DRUH[v.druh];
    if (!d.pojistne) return { vz: 0, min: 0, castka: 0, pozn: 'Příjmy z nájmu (§ 9) pojistnému nepodléhají – zdravotní pojištění řešíte jako zaměstnanec, OBZP nebo přes stát.' };
    const z = P.zp;
    const minRok = v.vedlejsi ? 0 : P.prumernaMzda * z.minHlavni * 12;
    const vz = Math.max(minRok, zaklad * z.podilZakladu);
    return { vz: ceil(vz), min: ceil(minRok), castka: ceil(vz * z.sazba), zalohaMin: v.vedlejsi ? 0 : ceil(P.prumernaMzda * z.minHlavni * z.sazba), pozn: '' };
  }

  /* ---------- varianty ---------- */
  function sestav(P, v, id, nazev, vydajeDanove, pozn) {
    const zaklad = Math.max(0, v.prijmy - vydajeDanove);
    const d = dan(P, v, zaklad, false);
    const sp = socialni(P, v, zaklad), zp = zdravotni(P, v, zaklad);
    const odvody = d.danCista + sp.castka + zp.castka;
    return {
      id, nazev, mozna: true, pozn: pozn || [],
      vydajeDanove, zaklad, dan: d, sp, zp,
      odvody, poOdvodech: v.prijmy - odvody, cisty: v.prijmy - v.vydaje - odvody,
      efektivni: v.prijmy ? odvody / v.prijmy : 0
    };
  }
  function vypocetSkutecne(vstup) {
    const v = normVstup(vstup), P = PARAMETRY[v.rok];
    return sestav(P, v, 'A', 'Skutečné výdaje', Math.min(v.vydaje, v.prijmy), v.vydaje > v.prijmy ? ['Ztráta – základ daně je nula (ztrátu lze uplatnit v dalších 5 letech).'] : []);
  }
  function vypocetPausalVydaje(vstup) {
    const v = normVstup(vstup), P = PARAMETRY[v.rok], d = DRUH[v.druh];
    const pausal = Math.min(v.prijmy * d.procento / 100, d.strop);
    const pozn = [];
    if (v.prijmy * d.procento / 100 > d.strop) pozn.push('Paušál je omezen stropem ' + d.strop.toLocaleString('cs-CZ') + ' Kč (příjmy nad 2 000 000 Kč).');
    return sestav(P, v, 'B', 'Výdajový paušál ' + d.procento + ' %', pausal, pozn);
  }

  /* Pásmo paušální daně podle příjmů a druhu činnosti (§ 2a odst. 3 ZDP), pro jediný druh příjmů:
     80 % → 1. pásmo až do 2 M; 60 % → 1. pásmo do 1,5 M, 2. pásmo do 2 M; 40 % → 1 M / 1,5 M / 2 M. Vrací 1–3 nebo 0 (nelze). */
  function pasmoPausalniDane(prijmy, druh, rok) {
    const P = PARAMETRY[rok] || PARAMETRY[ROKY[ROKY.length - 1]], d = DRUH[druh];
    if (!d || !d.pojistne || prijmy > P.pausalniDan.maxPrijmy) return 0;
    const h = P.pausalniDan.hraniceZakladni;
    if (d.id === '80') return 1;
    if (d.id === '60') return prijmy <= h[1] ? 1 : 2;
    return prijmy <= h[0] ? 1 : prijmy <= h[1] ? 2 : 3;
  }
  function pausalniDan(vstup) {
    const v = normVstup(vstup), P = PARAMETRY[v.rok];
    const pasmo = pasmoPausalniDane(v.prijmy, v.druh, v.rok);
    const vylucuje = [];
    if (v.platceDph) vylucuje.push('plátce DPH (ani identifikovaná osoba nesmí)');
    if (v.zamestnani) vylucuje.push('souběh se zaměstnáním (kromě dohod zdaněných srážkovou daní)');
    if (v.ostatniPrijmy) vylucuje.push('ostatní příjmy (kapitál, nájem, § 10) nad ' + P.pausalniDan.ostatniPrijmyMax.toLocaleString('cs-CZ') + ' Kč');
    if (!DRUH[v.druh].pojistne) vylucuje.push('příjmy z nájmu (§ 9) nejsou příjmy ze samostatné činnosti');
    if (v.prijmy > P.pausalniDan.maxPrijmy) vylucuje.push('příjmy nad ' + P.pausalniDan.maxPrijmy.toLocaleString('cs-CZ') + ' Kč');
    const mozna = !vylucuje.length && pasmo > 0;
    const mesicne = mozna ? P.pausalniDan.mesicne[pasmo - 1] : 0;
    const odvody = mesicne * 12;
    const neuplatnene = [];
    if (v.deti) neuplatnene.push('daňové zvýhodnění na děti ' + zvyhodneniDeti(P, v.deti).toLocaleString('cs-CZ') + ' Kč');
    if (v.manzel) neuplatnene.push('sleva na manžela/manželku');
    if (v.invalidita !== '0') neuplatnene.push('sleva na invaliditu');
    if (v.penzijni + v.zivotni + v.dary) neuplatnene.push('nezdanitelné části (penzijní, životní, dary)');
    return {
      id: 'C', nazev: 'Paušální daň' + (pasmo ? ' – ' + pasmo + '. pásmo' : ''), mozna, pasmo, mesicne, vylucuje, neuplatnene,
      zaklad: null, odvody, poOdvodech: v.prijmy - odvody, cisty: v.prijmy - v.vydaje - odvody,
      efektivni: v.prijmy ? odvody / v.prijmy : 0,
      pozn: mozna && v.vedlejsi ? ['Při vedlejší činnosti platí stejná paušální záloha; u důchodců a studentů se SP počítá jinak – ověřte.'] : []
    };
  }

  /* Srovnání: nejlepší z možných variant, rozdíly proti ní a doporučení. */
  function srovnani(vstup) {
    const v = normVstup(vstup);
    const varianty = [vypocetSkutecne(v), vypocetPausalVydaje(v), pausalniDan(v)];
    const mozne = varianty.filter(x => x.mozna);
    const nejlepsi = mozne.reduce((a, b) => (b.odvody < a.odvody ? b : a), mozne[0]);
    for (const x of varianty) x.rozdil = x.mozna ? x.odvody - nejlepsi.odvody : null;
    const doporuceni = [];
    doporuceni.push('Nejméně odvedete s variantou „' + nejlepsi.nazev + '“: ' + nejlepsi.odvody.toLocaleString('cs-CZ') + ' Kč ročně.');
    const C = varianty[2];
    if (!C.mozna) doporuceni.push('Paušální daň nelze použít: ' + C.vylucuje.join('; ') + '.');
    else if (C.neuplatnene.length) doporuceni.push('V paušálním režimu nelze uplatnit: ' + C.neuplatnene.join(', ') + ' – srovnání to již zohledňuje (varianty A a B je mají započtené).');
    if (nejlepsi.id === 'C') doporuceni.push('Do paušálního režimu se vstupuje oznámením do 10. ledna daného roku (resp. při zahájení činnosti); v průběhu roku nelze přejít.');
    if (nejlepsi.id !== 'A' && v.vydaje > 0 && varianty[0].rozdil != null && varianty[0].rozdil < 0.05 * nejlepsi.odvody) doporuceni.push('Skutečné výdaje jsou blízko – rozhoduje administrativa (daňová evidence vs. jen evidence příjmů).');
    const rozdilAB = varianty[1].odvody - varianty[0].odvody;
    if (rozdilAB < 0 && varianty[0].mozna) doporuceni.push('Výdajový paušál vychází lépe než skutečné výdaje o ' + (-rozdilAB).toLocaleString('cs-CZ') + ' Kč – nemusíte vést daňovou evidenci.');
    return { vstup: v, parametry: PARAMETRY[v.rok], varianty, nejlepsi: nejlepsi.id, doporuceni };
  }

  /* ---------- DPP / DPČ (měsíčně) ----------
     DPP: pojistné od rozhodné částky včetně (25 % průměrné mzdy zaokr. na 500 dolů), srážková daň 15 % bez prohlášení do rozhodné částky včetně.
     DPČ: pojistné od 4 500 Kč včetně, srážková daň bez prohlášení pod 4 500 Kč. S prohlášením záloha 15 % − sleva 2 570 Kč. */
  function dohoda(typ, odmena, prohlaseni, rok) {
    const P = PARAMETRY[rok] || PARAMETRY[ROKY[ROKY.length - 1]], D = P[typ];
    odmena = kc(odmena);
    const pojistne = odmena >= D.limit;
    const spZam = pojistne ? ceil(odmena * D.spZam) : 0, zpZam = pojistne ? ceil(odmena * D.zpZam) : 0;
    const spFirma = pojistne ? ceil(odmena * D.spFirma) : 0, zpFirma = pojistne ? ceil(odmena * D.zpFirma) : 0;
    const srazkova = !prohlaseni && (typ === 'dpp' ? odmena <= D.limit : odmena < D.limit);
    const zakladDane = Math.ceil(odmena / 100) * 100;   // záloha: základ zaokrouhlený na stovky nahoru
    let danCastka, druhDane;
    if (srazkova) { danCastka = Math.round(odmena * P.sazbaDan); druhDane = 'srážková daň 15 %'; }
    else {
      const zaloha = ceil(zakladDane * P.sazbaDan);
      danCastka = prohlaseni ? Math.max(0, zaloha - D.slevaMesic) : zaloha;
      druhDane = prohlaseni ? 'záloha 15 % po slevě na poplatníka' : 'záloha 15 % (bez slevy – prohlášení nepodepsáno)';
    }
    const cista = odmena - spZam - zpZam - danCastka;
    return { typ, odmena, limit: D.limit, pojistne, srazkova, druhDane, dan: danCastka, spZam, zpZam, spFirma, zpFirma,
      cista, nakladyFirmy: odmena + spFirma + zpFirma, efektivni: odmena ? (odmena - cista) / odmena : 0 };
  }
  const dpp = (odmena, prohlaseni, rok) => dohoda('dpp', odmena, prohlaseni, rok);
  const dpc = (odmena, prohlaseni, rok) => dohoda('dpc', odmena, prohlaseni, rok);

  const API = { VERZE, KLIC, DRUHY, DRUH, PARAMETRY, ROKY, normVstup, dan, socialni, zdravotni, nezdanitelne,
    vypocetSkutecne, vypocetPausalVydaje, pasmoPausalniDane, pausalniDan, srovnani, dpp, dpc };
  if (typeof module !== 'undefined') module.exports = API; else window.OsvcJadro = API;
})();

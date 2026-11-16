/* Kardiovaskulární riziko SCORE2 / SCORE2-OP / SCORE2-Diabetes – jádro bez DOM (test: _test/score2_test.js).

   Zdroje rovnic (koeficienty přepsány přesně, ověřeno na publikovaných příkladech a kartách ESC):
   - SCORE2 working group and ESC Cardiovascular Risk Collaboration. SCORE2 risk prediction algorithms:
     new models to estimate 10-year risk of cardiovascular disease in Europe. Eur Heart J 2021;42:2439–2454,
     doi:10.1093/eurheartj/ehab309 (Supplementary Methods Table 2/4; oprava koeficientů Eur Heart J 2022;43:241).
   - SCORE2-OP working group. SCORE2-OP risk prediction algorithms: estimating incident cardiovascular event
     risk in older persons in four geographical risk regions. Eur Heart J 2021;42:2455–2467, doi:10.1093/eurheartj/ehab312.
   - SCORE2-Diabetes Working Group. SCORE2-Diabetes: 10-year cardiovascular risk estimation in type 2 diabetes
     in Europe. Eur Heart J 2023;44:2544–2556, doi:10.1093/eurheartj/ehad260.
   - 2021 ESC Guidelines on cardiovascular disease prevention in clinical practice. Eur Heart J 2021;42:3227–3337
     (regiony rizika, prahy kategorií, karty Figure 3).

   Výpočet: lineární prediktor → nekalibrované riziko 1 − S0^exp(LP) → rekalibrace na region
   riziko = 1 − exp(−exp(k1 + k2 · ln(−ln(1 − nekalibrované)))). */
(function () {
  'use strict';

  const KLIC = 'webapp_score2_profil';
  const MG_NA_MMOL = 38.67;          // cholesterol: 1 mmol/l = 38,67 mg/dl

  /* Regiony rizika podle ESC 2021 (WHO úmrtnost na KVO standardizovaná na věk a pohlaví). */
  const REGIONY = [
    { id: 'low', nazev: 'Nízké riziko', zeme: 'Belgie, Dánsko, Francie, Izrael, Lucembursko, Nizozemsko, Norsko, Spojené království, Španělsko, Švýcarsko' },
    { id: 'moderate', nazev: 'Střední riziko', zeme: 'Finsko, Irsko, Island, Itálie, Kypr, Malta, Německo, Portugalsko, Rakousko, Řecko, San Marino, Slovinsko, Švédsko' },
    { id: 'high', nazev: 'Vysoké riziko', zeme: 'Albánie, Bosna a Hercegovina, Česko, Estonsko, Chorvatsko, Kazachstán, Maďarsko, Polsko, Slovensko, Turecko' },
    { id: 'veryhigh', nazev: 'Velmi vysoké riziko', zeme: 'Alžírsko, Arménie, Ázerbájdžán, Bělorusko, Bulharsko, Egypt, Gruzie, Kyrgyzstán, Libanon, Libye, Litva, Lotyšsko, Maroko, Moldavsko, Černá Hora, Rumunsko, Rusko, Severní Makedonie, Srbsko, Sýrie, Tunisko, Ukrajina, Uzbekistán' }
  ];
  const REGION_CR = 'high';

  /* SCORE2 (40–69 let): log HR; centrování věk (x−60)/5, STK (x−120)/20, TC x−6, HDL (x−1,3)/0,5.
     Pořadí: věk, kouření, STK, diabetes, TC, HDL, věk×kouř, věk×STK, věk×diab, věk×TC, věk×HDL. */
  const S2 = {
    m: { k: [0.3742, 0.6012, 0.2777, 0.6457, 0.1458, -0.2698, -0.0755, -0.0255, -0.0983, -0.0281, 0.0426], s0: 0.9605 },
    z: { k: [0.4648, 0.7744, 0.3131, 0.8096, 0.1002, -0.2606, -0.1088, -0.0277, -0.1272, -0.0226, 0.0613], s0: 0.9776 }
  };
  /* SCORE2-OP (70+): centrování věk x−73, STK x−150, TC x−6, HDL x−1,4; od LP se odečítá průměr. */
  const OP = {
    m: { k: [0.0634, 0.3524, 0.0094, 0.4245, 0.0850, -0.3564, -0.0247, -0.0005, -0.0174, 0.0073, 0.0091], s0: 0.7576, prumer: 0.0929 },
    z: { k: [0.0789, 0.4921, 0.0102, 0.6010, 0.0605, -0.3040, -0.0255, -0.0004, -0.0107, -0.0009, 0.0154], s0: 0.8082, prumer: 0.2290 }
  };
  /* SCORE2-Diabetes (40–69 let): tytéž proměnné jako SCORE2 + věk při diagnóze (x−50)/5, HbA1c (x−31)/9,34
     mmol/mol, ln eGFR (ln x − 4,5)/0,15. Pořadí dodatků: věkDiag×diab, HbA1c, eGFR, eGFR², HbA1c×věk, eGFR×věk. */
  const S2D = {
    m: { k: [0.5368, 0.4774, 0.1322, 0.6457, 0.1102, -0.1087, -0.0672, -0.0268, -0.0983, -0.0181, 0.0095], d: [-0.0998, 0.0955, -0.0591, 0.0058, -0.0134, 0.0115], s0: 0.9605 },
    z: { k: [0.6624, 0.6139, 0.1421, 0.8096, 0.1127, -0.1568, -0.1122, -0.0167, -0.1272, -0.0200, 0.0186], d: [-0.1180, 0.1173, -0.0640, 0.0062, -0.0196, 0.0169], s0: 0.9776 }
  };
  /* Rekalibrace [k1, k2] podle regionu – SCORE2 (a SCORE2-Diabetes, stejné faktory) a SCORE2-OP. */
  const KAL = {
    low: { m: [-0.5699, 0.7476], z: [-0.7380, 0.7019], om: [-0.34, 1.19], oz: [-0.52, 1.01] },
    moderate: { m: [-0.1565, 0.8009], z: [-0.3143, 0.7701], om: [0.01, 1.25], oz: [-0.10, 1.10] },
    high: { m: [0.3207, 0.9360], z: [0.5710, 0.9369], om: [0.08, 1.15], oz: [0.38, 1.09] },
    veryhigh: { m: [0.5836, 0.8294], z: [0.9412, 0.8329], om: [0.05, 0.70], oz: [0.38, 0.69] }
  };

  const ROZSAH = { vek: [40, 89], stk: [80, 250], tc: [2, 15], hdl: [0.3, 4], hba1c: [20, 150], egfr: [5, 200], vekDiag: [10, 89] };
  /* Rozsah, z něhož pocházela data modelů (mimo něj jde o extrapolaci). */
  const OBVYKLE = { stk: [100, 200], nonhdl: [2, 8], hdl: [0.6, 3] };

  const cislo = v => { const x = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v); return Number.isFinite(x) ? x : NaN; };
  const kalibruj = (u, k) => 1 - Math.exp(-Math.exp(k[0] + k[1] * Math.log(-Math.log(1 - u))));

  /* Normalizace profilu: {vek, pohlavi 'm'|'z', kurak, stk, tc, hdl (mmol/l), region, diabetes, vekDiag, hba1c (mmol/mol), egfr}. */
  function normProfil(p) {
    p = p || {};
    const reg = REGIONY.some(r => r.id === p.region) ? p.region : REGION_CR;
    return {
      vek: cislo(p.vek), pohlavi: p.pohlavi === 'z' ? 'z' : 'm', kurak: !!p.kurak,
      stk: cislo(p.stk), tc: cislo(p.tc), hdl: cislo(p.hdl), region: reg,
      diabetes: !!p.diabetes, vekDiag: cislo(p.vekDiag), hba1c: cislo(p.hba1c), egfr: cislo(p.egfr)
    };
  }

  /* Seznam chyb vstupu (prázdné pole = lze počítat). */
  function chyby(p) {
    const ch = [];
    const mimo = (v, [a, b]) => !(v >= a && v <= b);
    if (mimo(p.vek, ROZSAH.vek)) ch.push('vek');
    if (mimo(p.stk, ROZSAH.stk)) ch.push('stk');
    if (mimo(p.tc, ROZSAH.tc)) ch.push('tc');
    if (mimo(p.hdl, ROZSAH.hdl)) ch.push('hdl');
    if (!ch.includes('tc') && !ch.includes('hdl') && p.hdl >= p.tc) ch.push('hdl_tc');
    if (p.diabetes && p.vek < 70) {
      if (mimo(p.hba1c, ROZSAH.hba1c)) ch.push('hba1c');
      if (mimo(p.egfr, ROZSAH.egfr)) ch.push('egfr');
      if (mimo(p.vekDiag, ROZSAH.vekDiag) || p.vekDiag > p.vek) ch.push('vekDiag');
    }
    return ch;
  }

  /* Upozornění na extrapolaci. */
  function varovani(p) {
    const v = [], nh = p.tc - p.hdl;
    if (p.stk < OBVYKLE.stk[0] || p.stk > OBVYKLE.stk[1]) v.push('stk');
    if (nh < OBVYKLE.nonhdl[0] || nh > OBVYKLE.nonhdl[1]) v.push('nonhdl');
    if (p.hdl < OBVYKLE.hdl[0] || p.hdl > OBVYKLE.hdl[1]) v.push('hdl');
    return v;
  }

  function lpZakladni(k, a, kur, b, dia, t, h) {
    return k[0] * a + k[1] * kur + k[2] * b + k[3] * dia + k[4] * t + k[5] * h +
      k[6] * a * kur + k[7] * a * b + k[8] * a * dia + k[9] * a * t + k[10] * a * h;
  }

  /* SCORE2 (pro diabetika < 70 let SCORE2-Diabetes, pro ≥ 70 let SCORE2-OP s proměnnou diabetes).
     Vrací {model, riziko (0–1), nekalibrovane} nebo null při neplatném vstupu. */
  function vypocet(vstup) {
    const p = normProfil(vstup);
    if (chyby(p).length) return null;
    const kur = p.kurak ? 1 : 0, dia = p.diabetes ? 1 : 0, kal = KAL[p.region];
    let model, u, k;
    if (p.vek >= 70) {
      const c = OP[p.pohlavi];
      const lp = lpZakladni(c.k, p.vek - 73, kur, p.stk - 150, dia, p.tc - 6, p.hdl - 1.4);
      u = 1 - Math.pow(c.s0, Math.exp(lp - c.prumer));
      model = 'SCORE2-OP'; k = kal['o' + p.pohlavi];
    } else {
      const a = (p.vek - 60) / 5, b = (p.stk - 120) / 20, t = p.tc - 6, h = (p.hdl - 1.3) / 0.5;
      if (dia) {
        const c = S2D[p.pohlavi], d = c.d;
        const g = (p.vekDiag - 50) / 5, x = (p.hba1c - 31) / 9.34, e = (Math.log(p.egfr) - 4.5) / 0.15;
        const lp = lpZakladni(c.k, a, kur, b, 1, t, h) + d[0] * g + d[1] * x + d[2] * e + d[3] * e * e + d[4] * x * a + d[5] * e * a;
        u = 1 - Math.pow(c.s0, Math.exp(lp));
        model = 'SCORE2-Diabetes';
      } else {
        const c = S2[p.pohlavi];
        u = 1 - Math.pow(c.s0, Math.exp(lpZakladni(c.k, a, kur, b, 0, t, h)));
        model = 'SCORE2';
      }
      k = kal[p.pohlavi];
    }
    return { model, riziko: kalibruj(u, k), nekalibrovane: u };
  }

  /* Prahy kategorií (% 10letého rizika): ESC 2021 podle věku; SCORE2-Diabetes podle ESC 2023 (diabetes). */
  function prahy(vek, model) {
    if (model === 'SCORE2-Diabetes') return [5, 10, 20];
    if (vek < 50) return [2.5, 7.5];
    if (vek < 70) return [5, 10];
    return [7.5, 15];
  }
  /* Kategorie: 'nizke' (nízké až střední), 'vysoke', 'velmi' (velmi vysoké); u diabetu navíc 'nizke'/'stredni'. */
  function kategorie(vek, procenta, model) {
    const pr = prahy(vek, model);
    if (model === 'SCORE2-Diabetes') return procenta < pr[0] ? 'nizke' : procenta < pr[1] ? 'stredni' : procenta < pr[2] ? 'vysoke' : 'velmi';
    return procenta < pr[0] ? 'nizke' : procenta < pr[1] ? 'vysoke' : 'velmi';
  }

  /* Hlavní výsledek pro UI. */
  function vyhodnot(vstup) {
    const p = normProfil(vstup);
    const ch = chyby(p);
    if (ch.length) return { chyby: ch };
    const r = vypocet(p);
    const procenta = r.riziko * 100;
    return {
      chyby: [], model: r.model, procenta, zaokrouhleno: zaokrouhli(procenta),
      kategorie: kategorie(p.vek, procenta, r.model), prahy: prahy(p.vek, r.model),
      nonhdl: p.tc - p.hdl, varovani: varovani(p), ideal: vypocet(idealni(p)).riziko * 100
    };
  }
  const zaokrouhli = x => x < 1 ? '<1' : x >= 10 ? String(Math.round(x)) : (Math.round(x * 10) / 10).toFixed(1);

  /* Stejný člověk s ideálními rizikovými faktory: nekuřák, STK 120 mmHg, non-HDL 3,0 mmol/l (HDL ponecháno
     aspoň 1,3), u diabetika HbA1c 48 mmol/mol (cíl < 53) a ostatní beze změny. */
  function idealni(p) {
    p = normProfil(p);
    const hdl = Math.max(p.hdl, 1.3);
    const q = Object.assign({}, p, { kurak: false, stk: 120, hdl, tc: hdl + 3.0 });
    if (p.diabetes) q.hba1c = Math.min(p.hba1c, 48);
    return q;
  }

  /* Scénáře „co kdyby“: každý {id, profil}. UI dopočte riziko a rozdíl. */
  function scenare(vstup) {
    const p = normProfil(vstup);
    const s = [];
    const pridej = (id, zmena) => s.push({ id, profil: Object.assign({}, p, zmena) });
    if (p.kurak) pridej('nekourit', { kurak: false });
    if (p.stk > 130) pridej('stk_minus10', { stk: p.stk - 10 });
    if (p.stk > 140) pridej('stk_minus20', { stk: p.stk - 20 });
    if (p.stk > 120) pridej('stk_120', { stk: 120 });
    const nh = p.tc - p.hdl;
    if (nh > 3) pridej('nonhdl_minus1', { tc: p.tc - 1 });
    if (nh > 2.6) pridej('nonhdl_polovina', { tc: p.hdl + Math.max(2.2, nh / 2) });   // statin vysoké intenzity ~ −50 %
    if (p.diabetes && p.vek < 70 && p.hba1c > 53) pridej('hba1c_53', { hba1c: 53 });
    pridej('vse', idealni(p));
    pridej('za10', { vek: Math.min(p.vek + 10, ROZSAH.vek[1]) });
    return s.map(x => ({ id: x.id, profil: x.profil, vysledek: vyhodnot(x.profil) })).filter(x => !x.vysledek.chyby.length);
  }

  /* Karta ve stylu ESC: řádky = věkové pásmo × STK, sloupce = non-HDL; pro dané pohlaví, kouření a region.
     Konstrukce buňky (zjištěno porovnáním s kartami ESC 2021, shoda 99,5 % buněk SCORE2):
     střed věkového pásma (+2,5 roku), střed pásma STK a non-HDL, HDL 1,2 (muži) / 1,4 (ženy) mmol/l, TC = non-HDL + HDL. */
  const KARTA_VEK = [40, 45, 50, 55, 60, 65, 70, 75, 80, 85];
  const KARTA_STK = [100, 120, 140, 160];
  const KARTA_NH = [3, 4, 5, 6];
  const KARTA_HDL = { m: 1.2, z: 1.4 };
  function karta(pohlavi, kurak, region) {
    const hdl = KARTA_HDL[pohlavi === 'z' ? 'z' : 'm'];
    return KARTA_VEK.map(v => ({
      vek: v,
      radky: KARTA_STK.map(s => ({
        stk: s,
        bunky: KARTA_NH.map(n => {
          const r = vypocet({ vek: v + 2.5, pohlavi, kurak, stk: s + 10, tc: n + 0.5 + hdl, hdl, region });
          const pct = r.riziko * 100;
          return { procenta: pct, cislo: Math.round(pct), kategorie: kategorie(v, pct, r.model) };
        })
      }))
    }));
  }
  /* Poloha profilu v kartě (index pásma věku, STK, non-HDL) nebo null mimo kartu. */
  function polohaVKarte(vstup) {
    const p = normProfil(vstup);
    const najdi = (pole, x, krok) => { const i = pole.findIndex(a => x >= a && x < a + krok); return i; };
    const iv = najdi(KARTA_VEK, Math.floor(p.vek), 5), is = najdi(KARTA_STK, p.stk, 20), ih = najdi(KARTA_NH, p.tc - p.hdl, 1);
    return { vek: iv, stk: is, nonhdl: ih };
  }

  /* Převody jednotek. */
  const mmolNaMg = x => x * MG_NA_MMOL;
  const mgNaMmol = x => x / MG_NA_MMOL;
  const hba1cProcNaMmol = x => (x - 2.15) * 10.929;     // DCCT % → IFCC mmol/mol
  const hba1cMmolNaProc = x => x / 10.929 + 2.15;

  const api = {
    KLIC, MG_NA_MMOL, REGIONY, REGION_CR, S2, OP, S2D, KAL, ROZSAH, OBVYKLE,
    KARTA_VEK, KARTA_STK, KARTA_NH, KARTA_HDL,
    normProfil, chyby, varovani, vypocet, prahy, kategorie, vyhodnot, zaokrouhli, idealni, scenare, karta, polohaVKarte,
    mmolNaMg, mgNaMmol, hba1cProcNaMmol, hba1cMmolNaProc
  };
  if (typeof module !== 'undefined') module.exports = api;
  else window.Score2Jadro = api;
})();

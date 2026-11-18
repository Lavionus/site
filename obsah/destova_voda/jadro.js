/* Dešťová voda – jádro bez DOM (test: _test/destova_voda_test.js).
   Odvodnění střech (ČSN 75 6760, ČSN EN 12056-3), akumulační nádrž (ČKAIT TP 1.20, denní simulace),
   vsakování (ČSN 75 9010 podle TP 1.20), retenční nádrž s regulovaným odtokem, úspora v Kč.
   Všechny tabulkové hodnoty mají u sebe zdroj; výpočty jsou orientační a nenahrazují projekt. */
(function (g) {
  'use strict';
  const HD = (typeof module !== 'undefined' && module.exports) ? require('./hd_data.js') : g.DestHD;

  const VERZE = 1;
  const KLIC = 'webapp_destova_voda';
  const SKLONY = [{ id: 'do1', nazev: 'do 1 %' }, { id: '1az5', nazev: '1–5 %' }, { id: 'nad5', nazev: 'nad 5 %' }];
  const SKLON_I = { do1: 0, '1az5': 1, nad5: 2 };

  /* Druhy ploch.
     C   … součinitel odtoku pro dimenzování odvodnění, ČSN 75 6760:2014 tab. 8 (do 1 % / 1–5 % / nad 5 %), podle TZB-info.
     psi … součinitel odtoku pro vsakování a retenci, ČKAIT TP 1.20 tab. 4 (podle ČSN 75 9010).
     psiD … součinitel využití srážkové vody pro nádrž, ČKAIT TP 1.20 tab. 8 (podle DIN 1989-1);
            vegetační střecha: plochá 0,3 / šikmá 0,25 (šikmá = sklon nad 5 %). null = do nádrže se nesvádí. */
  const DRUHY = [
    { id: 'sikma', nazev: 'Střecha – nepropustná krytina (tašky, plech, lepenka)', strecha: true, C: [1, 1, 1], psi: [1, 1, 1], psiD: [0.8, 0.8, 0.8] },
    { id: 'kacirek', nazev: 'Plochá střecha s kačírkem', strecha: true, C: [0.9, 0.9, 0.9], psi: [0.9, 0.9, 0.9], psiD: [0.6, 0.6, 0.6] },
    { id: 'veg100', nazev: 'Vegetační střecha, substrát do 100 mm', strecha: true, C: [0.7, 0.7, 0.8], psi: [0.9, 0.9, 0.9], psiD: [0.3, 0.3, 0.25] },
    { id: 'veg250', nazev: 'Vegetační střecha, substrát 100–250 mm', strecha: true, C: [0.4, 0.4, 0.5], psi: [0.7, 0.7, 0.7], psiD: [0.3, 0.3, 0.25] },
    { id: 'veg300', nazev: 'Vegetační střecha, substrát nad 250 mm', strecha: true, C: [0.3, 0.3, 0.3], psi: [0.7, 0.7, 0.7], psiD: [0.3, 0.3, 0.25] },
    { id: 'asfalt', nazev: 'Asfalt, beton, dlažba se zálivkou spár', strecha: false, C: [0.7, 0.8, 0.9], psi: [0.7, 0.8, 0.9], psiD: null },
    { id: 'dlazba', nazev: 'Dlažba s pískovými spárami', strecha: false, C: [0.5, 0.6, 0.7], psi: [0.5, 0.6, 0.7], psiD: null },
    { id: 'sterk', nazev: 'Upravené štěrkové plochy', strecha: false, C: [0.3, 0.4, 0.5], psi: [0.3, 0.4, 0.5], psiD: null },
    { id: 'tvarnice', nazev: 'Zatravňovací / vsakovací tvárnice', strecha: false, C: [0.2, 0.3, 0.4], psi: [0.2, 0.3, 0.4], psiD: null },
    { id: 'nezast', nazev: 'Neupravené a nezastavěné plochy', strecha: false, C: [0.2, 0.25, 0.3], psi: [0.2, 0.25, 0.3], psiD: null },
    { id: 'sady', nazev: 'Sady, hřiště', strecha: false, C: [0.1, 0.15, 0.2], psi: [0.1, 0.15, 0.2], psiD: null },
    { id: 'travnik', nazev: 'Zatravněné plochy', strecha: false, C: [0.05, 0.1, 0.15], psi: [0.05, 0.1, 0.15], psiD: null }
  ];
  const DRUH = Object.fromEntries(DRUHY.map(d => [d.id, d]));

  /* Součinitel bezpečnosti pro žlaby podle ČSN EN 12056-3 (převzato z článku HIPOS „Zásady odvodnění střech“). */
  const BEZPECNOST = [
    { k: 1, nazev: '1,0 – podokapní, nástřešní a nadřímsové žlaby' },
    { k: 1.5, nazev: '1,5 – přetečení by způsobilo nesnáze (např. nad vstupem)' },
    { k: 2, nazev: '2,0 – mezistřešní/zaatikové žlaby, hrozí vniknutí vody do budovy' },
    { k: 3, nazev: '3,0 – budovy s vysokým stupněm ochrany (nemocnice, muzea)' }
  ];
  const I_CSN = 0.03; // l/(s·m²), ČSN 75 6760:2014 tab. 7 – střechy a plochy ohrožující budovu zaplavením
  const ZLABY = [100, 125, 150, 180, 200, 250];       // vnitřní průměr půlkruhového žlabu [mm]
  const SVODY = [70, 80, 87, 100, 110, 120, 150];     // vnitřní průměr svodu [mm]

  /* ČKAIT TP 1.20 tab. 6 – průměrný roční úhrn srážek podle nadmořské výšky; tab. 7 – rozdělení do měsíců [%]. */
  const UHRN_VYSKA = [[100, 600], [200, 660], [300, 710], [400, 760], [500, 820], [1000, 1120]];
  const PODIL_MESICU = [6.0, 5.6, 5.9, 7.3, 9.8, 11.3, 12.4, 11.3, 8.1, 7.9, 7.5, 6.8];
  const MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
  const DNY_MESICE = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  /* ČKAIT TP 1.20 tab. 5 – potřeba nepitné vody [l/(osoba·den)], úsporná / neúsporná zařízení. */
  const POTREBA = { wc: [24, 45], pracka: [12, 20], zalivkaRok: 60, zalivkaZavlaha: 1.0 };
  const ZALIVKA_MESICE = [3, 4, 5, 6, 7, 8]; // duben–září (tab. 5)

  /* Ceny vodného a stočného 2026 s DPH [Kč/m³], stav k 14. 1. 2026 (skrblik.cz, PVK, OVAK). */
  const CENY = [
    { id: 'praha', nazev: 'Praha (PVK)', vodne: 77.87, stocne: 79.34 },
    { id: 'brno', nazev: 'Brno (BVK)', vodne: 53.55, stocne: 56.63 },
    { id: 'ostrava', nazev: 'Ostrava (OVAK)', vodne: 56.40, stocne: 56.59 },
    { id: 'plzen', nazev: 'Plzeň', vodne: 71.25, stocne: 43.96 },
    { id: 'prumer', nazev: 'Průměr 219 měst ČR', vodne: 68.73, stocne: 62.72 }
  ];
  const CENY_DATUM = '14. 1. 2026';

  /* ---------- pomocné ---------- */
  const cislo = (v, vychozi) => { const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : vychozi; };
  const kladne = (v, vychozi) => { const n = cislo(v, vychozi); return n >= 0 ? n : vychozi; };
  const novyId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const zaokr = (x, n) => { const k = Math.pow(10, n == null ? 2 : n); return Math.round(x * k) / k; };

  /* ---------- projekt ---------- */
  function novaPlocha(o) {
    o = o || {};
    const druh = DRUH[o.druh] ? o.druh : 'sikma';
    return {
      id: o.id || novyId(), nazev: String(o.nazev || 'Plocha').slice(0, 80), A: kladne(o.A, 0), druh,
      sklon: SKLON_I[o.sklon] != null ? o.sklon : (DRUH[druh].strecha && druh === 'sikma' ? 'nad5' : 'do1'),
      nadrz: o.nadrz != null ? !!o.nadrz : !!DRUH[druh].psiD, vsak: o.vsak != null ? !!o.vsak : true,
      svody: Math.max(1, Math.round(kladne(o.svody, 1))), delka: kladne(o.delka, 0)
    };
  }
  function novyProjekt(nazev) {
    return normProjekt({ nazev: nazev || 'Nový projekt', plochy: [{ nazev: 'Střecha – jih', A: 60, druh: 'sikma', sklon: 'nad5', svody: 1, delka: 10 }, { nazev: 'Střecha – sever', A: 60, druh: 'sikma', sklon: 'nad5', svody: 1, delka: 10 }] });
  }
  function normProjekt(p) {
    p = p && typeof p === 'object' ? p : {};
    const st = HD.stanice;
    const o = p.odvodneni || {}, n = p.nadrz || {}, v = p.vsak || {}, r = p.retence || {}, u = p.uspora || {}, l = p.lokalita || {};
    const srazky = p.srazky && Array.isArray(p.srazky.mm) && /^\d{4}-\d{2}-\d{2}$/.test(p.srazky.od || '') ? {
      od: p.srazky.od, mm: p.srazky.mm.map(x => kladne(x, 0)), zdroj: String(p.srazky.zdroj || ''), lat: cislo(p.srazky.lat, null), lon: cislo(p.srazky.lon, null), stazeno: String(p.srazky.stazeno || '')
    } : null;
    return {
      id: p.id || novyId(), nazev: String(p.nazev || 'Projekt').slice(0, 100), zmeneno: p.zmeneno || '', poznamka: String(p.poznamka || '').slice(0, 2000),
      lokalita: { nazev: String(l.nazev || '').slice(0, 120), lat: cislo(l.lat, null), lon: cislo(l.lon, null), vyska: kladne(l.vyska, 300), stanice: Math.min(st.length - 1, Math.max(0, Math.round(cislo(l.stanice, 11)))) },
      plochy: (Array.isArray(p.plochy) ? p.plochy : []).map(novaPlocha),
      odvodneni: { rezim: ['csn', 'stanice', 'vlastni'].includes(o.rezim) ? o.rezim : 'csn', p: o.p === '0.1' ? '0.1' : '0.2', i: kladne(o.i, I_CSN), k: [1, 1.5, 2, 3].includes(cislo(o.k)) ? cislo(o.k) : 1 },
      nadrz: {
        osob: kladne(n.osob, 4), wc: kladne(n.wc, POTREBA.wc[0]), pracka: kladne(n.pracka, 0), zahrada: kladne(n.zahrada, 200), zalivka: kladne(n.zalivka, POTREBA.zalivkaRok),
        jine: kladne(n.jine, 0), eta: Math.min(1, kladne(n.eta, 0.9)), objem: kladne(n.objem, 6), uhrn: n.uhrn != null ? kladne(n.uhrn, 0) : null,
        d1: kladne(n.d1, 21), d2: kladne(n.d2, 3), qz: kladne(n.qz, POTREBA.zalivkaZavlaha)
      },
      vsak: { p: v.p === '0.1' ? '0.1' : '0.2', kv: kladne(v.kv, 1e-5), f: Math.max(2, cislo(v.f, 2)), typ: v.typ === 'povrch' ? 'povrch' : 'podzem', Avsak: v.Avsak != null ? kladne(v.Avsak, 0) : null, m: Math.min(1, Math.max(0.05, cislo(v.m, 0.3))), Qo: kladne(v.Qo, 0), zNadrze: !!v.zNadrze,
        test: { tvar: (v.test || {}).tvar === 'kruh' ? 'kruh' : 'obdelnik', a: kladne((v.test || {}).a, 1), b: kladne((v.test || {}).b, 1), h1: kladne((v.test || {}).h1, 0.5), h2: kladne((v.test || {}).h2, 0.3), t: kladne((v.test || {}).t, 60), steny: (v.test || {}).steny !== false } },
      retence: { umisteni: ['vne', 'vneRiziko', 'uvnitr'].includes(r.umisteni) ? r.umisteni : 'vne', rezim: r.rezim === 'ha' ? 'ha' : 'ls', Qo: kladne(r.Qo, 1), Qha: kladne(r.Qha, 10), Apozemek: kladne(r.Apozemek, 800), zPloch: r.zPloch != null ? !!r.zPloch : true, Ared: kladne(r.Ared, 0) },
      uspora: { cena: CENY.some(c => c.id === u.cena) ? u.cena : (u.cena === 'vlastni' ? 'vlastni' : 'prumer'), vodne: kladne(u.vodne, 68.73), stocne: kladne(u.stocne, 62.72), stocneBudova: u.stocneBudova != null ? !!u.stocneBudova : true, investice: kladne(u.investice, 0), provoz: kladne(u.provoz, 0) },
      srazky
    };
  }
  function prazdna() { const p = novyProjekt('Můj dům'); return { verze: VERZE, aktivni: p.id, projekty: [p] }; }
  function migruj(d) {
    if (!d || !Array.isArray(d.projekty) || !d.projekty.length) return prazdna();
    const projekty = d.projekty.map(normProjekt);
    return { verze: VERZE, aktivni: projekty.some(p => p.id === d.aktivni) ? d.aktivni : projekty[0].id, projekty };
  }

  /* ---------- plochy ---------- */
  const souC = pl => DRUH[pl.druh].C[SKLON_I[pl.sklon]];
  const souPsi = pl => DRUH[pl.druh].psi[SKLON_I[pl.sklon]];
  const souPsiD = pl => DRUH[pl.druh].psiD ? DRUH[pl.druh].psiD[SKLON_I[pl.sklon]] : 0;
  function souhrnPloch(plochy) {
    let A = 0, Ared = 0, Avsak = 0, Anadrz = 0, AnadrzPudorys = 0, Astrech = 0;
    for (const pl of plochy) {
      A += pl.A;
      if (DRUH[pl.druh].strecha) Astrech += pl.A;
      if (pl.vsak) { Ared += pl.A * souPsi(pl); Avsak += pl.A; }
      if (pl.nadrz && DRUH[pl.druh].psiD) { Anadrz += pl.A * souPsiD(pl); AnadrzPudorys += pl.A; }
    }
    return { A, Astrech, Ared, Avsak, Anadrz, AnadrzPudorys };
  }

  /* ---------- odvodnění střech ---------- */
  /* Návrhová intenzita deště [l/(s·m²)]: ČSN 75 6760 (0,03), nebo z 5min návrhového úhrnu stanice (i = h_d / 300 s,
     1 mm = 1 l/m²), nebo vlastní hodnota (ČSN EN 12056-3 čl. 4.2 – statistické údaje lokality). */
  function intenzita(pr) {
    const o = pr.odvodneni;
    if (o.rezim === 'vlastni') return o.i;
    if (o.rezim === 'stanice') return hdRada(pr.lokalita.stanice, o.p)[0] / 300;
    return I_CSN;
  }
  /* ČSN EN 12056-3: půlkruhový žlab Q_N = 2,78·10⁻⁵·A_E^1,25, krátký žlab Q_L = 0,9·Q_N [l/s]; A_E = π·d²/8 [mm²].
     Vliv sklonu žlabu (F_L) se nezapočítává – pro žlab ve sklonu ≥ 0,5 % je to na bezpečné straně. */
  const prurezZlabu = d => Math.PI * d * d / 8;
  const kapacitaZlabu = d => 0.9 * 2.78e-5 * Math.pow(prurezZlabu(d), 1.25);
  /* ČSN EN 12056-3 (Wyly–Eaton): Q_RWP = 2,5·10⁻⁴ · k_b^-0,167 · d_i^2,667 · f^1,667 [l/s]; k_b = 0,25 mm, f = 0,33. */
  const kapacitaSvodu = (d, f, kb) => 2.5e-4 * Math.pow(kb || 0.25, -0.167) * Math.pow(d, 2.667) * Math.pow(f || 0.33, 1.667);
  function navrhOdvodneni(pl, i, k) {
    const C = souC(pl), Q = i * pl.A * C * (k || 1), Qs = Q / pl.svody;
    const zlab = ZLABY.find(d => kapacitaZlabu(d) >= Qs) || null;
    const svod = SVODY.find(d => kapacitaSvodu(d) >= Qs) || null;
    // délka úseku žlabu na jeden svod (svod na konci úseku) vs. šířka žlabu; L/W > 50 = dlouhý žlab
    const Lusek = pl.delka > 0 ? pl.delka / pl.svody : 0;
    const dlouhy = zlab && Lusek > 0 ? Lusek * 1000 / zlab > 50 : false;
    return { C, Q, Qs, zlab, kapZlab: zlab ? kapacitaZlabu(zlab) : null, svod, kapSvod: svod ? kapacitaSvodu(svod) : null, Lusek, dlouhy };
  }

  /* ---------- návrhové úhrny ---------- */
  function hdRada(stanice, p) {
    const s = HD.stanice[stanice] || HD.stanice[0];
    return p === '0.1' ? s.p01 : s.p02;
  }
  /* Objem nádrže / vsakovacího zařízení: V(t) = w·h_d/1000·(A_red + A_vz) − (k_v/f·A_vsak + Q_o/1000)·t·60
     (ČSN 75 9010 podle TP 1.20 vztah 9; regulovaný odtok Q_o podle TP 1.20 vztah 2 a 5). Návrh = největší V přes t = 5…4320 min. */
  function objemNadrze(o) {
    const doby = HD.doby, w = o.w || 1, odtok = (o.kv || 0) / (o.f || 2) * (o.Avsak || 0) + (o.Qo || 0) / 1000; // m³/s
    const rady = doby.map((t, j) => {
      const hd = o.hd[j] * w, prit = hd / 1000 * ((o.Ared || 0) + (o.Avz || 0)), odt = odtok * t * 60;
      return { t, hd, prit, odt, V: prit - odt };
    });
    let max = rady[0];
    for (const r of rady) if (r.V > max.V) max = r;
    const V = Math.max(0, max.V);
    return { rady, V, tKrit: max.t, odtok, Tpr: odtok > 0 ? V / odtok / 3600 : Infinity };
  }
  /* TP 1.20 tab. 1 – vhodnost zeminy podle koeficientu vsaku (informativně). */
  function hodnoceniKv(kv) {
    if (!(kv > 0)) return { tr: 'nevhodna', text: 'koeficient vsaku není zadán' };
    if (kv > 1e-4) return { tr: 'filtr', text: 'velmi propustná – vhodná jen s filtrací ve vsakovacím zařízení' };
    if (kv >= 1e-6) return { tr: 'vhodna', text: 'propustná – vhodná pro vsakování' };
    if (kv >= 1e-8) return { tr: 'nevhodna', text: 'málo propustná – pro samotné vsakování nevhodná (zvažte retenci s regulovaným odtokem)' };
    return { tr: 'nevhodna', text: 'nepropustná – nevhodná pro vsakování' };
  }
  /* Orientační vyhodnocení vsakovací zkoušky z poklesu hladiny v jámě se svislými stěnami:
     k_v ≈ ΔV / (A·Δt), ΔV = A_dno·(h1−h2), A = A_dno (+ smočené stěny při průměrné hladině).
     Darcy při hydraulickém gradientu 1. Nenahrazuje vyhodnocení geologem podle ČSN 75 9010. */
  function kvZeZkousky(t) {
    const Adno = t.tvar === 'kruh' ? Math.PI * t.a * t.a / 4 : t.a * t.b;
    const obvod = t.tvar === 'kruh' ? Math.PI * t.a : 2 * (t.a + t.b);
    const dh = t.h1 - t.h2, sek = t.t * 60;
    if (!(Adno > 0) || !(dh > 0) || !(sek > 0)) return null;
    const A = Adno + (t.steny ? obvod * (t.h1 + t.h2) / 2 : 0);
    return { kv: Adno * dh / (A * sek), Adno, A, dV: Adno * dh };
  }
  function navrhVsaku(pr) {
    const v = pr.vsak, s = souhrnPloch(pr.plochy);
    const kvMale = v.kv <= 1e-6;
    const doporAvsak = [s.Ared * 0.1, s.Ared * 0.2];
    const Avsak = v.Avsak != null && v.Avsak > 0 ? v.Avsak : zaokr(s.Ared * (kvMale ? 0.2 : 0.1), 1);
    const Avz = v.typ === 'povrch' ? Avsak : 0;
    const r = objemNadrze({ Ared: s.Ared, Avz, hd: hdRada(pr.lokalita.stanice, v.p), kv: v.kv, f: v.f, Avsak, Qo: v.Qo });
    const W = r.V / v.m;
    return Object.assign(r, { Ared: s.Ared, Avsak, Avz, W, hloubka: Avsak > 0 ? W / Avsak : 0, kvMale, doporAvsak, malaPlocha: kvMale && Avsak < 0.2 * s.Ared, hodnoceni: hodnoceniKv(v.kv), vyhovuje: r.Tpr <= 72 });
  }
  /* ČSN 75 6760:2014 tab. 9 (podle TZB-info): periodicita a součinitel w pro retenční nádrže. */
  const UMISTENI_RET = {
    vne: { p: '0.2', w: 1, nazev: 'vně budovy, přetečení neohrozí budovu (p = 0,2)' },
    vneRiziko: { p: '0.1', w: 1, nazev: 'vně budovy, přetečení může způsobit škody (p = 0,1)' },
    uvnitr: { p: '0.1', w: 1.72, nazev: 'uvnitř budovy (p = 0,1, w = 1,72)' }
  };
  function navrhRetence(pr) {
    const r = pr.retence, u = UMISTENI_RET[r.umisteni];
    const Ared = r.zPloch ? souhrnPloch(pr.plochy).Ared : r.Ared;
    const Qo = r.rezim === 'ha' ? r.Apozemek * r.Qha / 10000 : r.Qo; // TP 1.20 vztah 13
    const v = objemNadrze({ Ared, hd: hdRada(pr.lokalita.stanice, u.p), Qo, w: u.w });
    return Object.assign(v, { Ared, Qo, p: u.p, w: u.w });
  }

  /* ---------- akumulace ---------- */
  function uhrnZVysky(v) {
    const t = UHRN_VYSKA;
    if (v <= t[0][0]) return t[0][1];
    for (let k = 1; k < t.length; k++) if (v <= t[k][0]) { const [a, ha] = t[k - 1], [b, hb] = t[k]; return ha + (hb - ha) * (v - a) / (b - a); }
    return t[t.length - 1][1];
  }
  /* Denní potřeba [l] v daném měsíci (0–11): budova každý den + zálivka rovnoměrně duben–září (TP 1.20 tab. 5). */
  function dniZalivky() { return ZALIVKA_MESICE.reduce((s, m) => s + DNY_MESICE[m], 0); }
  function potrebaDen(n, mesic) {
    const budova = n.osob * (n.wc + n.pracka) + n.jine * 1000 / 365;
    const zalivka = ZALIVKA_MESICE.includes(mesic) ? n.zalivka * n.zahrada / dniZalivky() : 0;
    return { budova, zalivka, celkem: budova + zalivka };
  }
  function rocniPotreba(n) { // m³/rok (TP 1.20 vztah 15)
    const budova = (n.osob * (n.wc + n.pracka) * 365 + n.jine * 1000) / 1000, zalivka = n.zalivka * n.zahrada / 1000;
    return { budova, zalivka, celkem: budova + zalivka };
  }
  function rocniUhrn(pr) { return pr.nadrz.uhrn != null && pr.nadrz.uhrn > 0 ? pr.nadrz.uhrn : uhrnZVysky(pr.lokalita.vyska); }
  /* Měsíční bilance podle TP 1.20 (vztah 14 a tab. 9): přítok = A·ψd·h·η, bilanční součet; doporučený objem = max součtu. */
  function mesicniBilance(pr, mesicniMm) {
    const n = pr.nadrz, s = souhrnPloch(pr.plochy), hr = rocniUhrn(pr);
    const souc = PODIL_MESICU.reduce((a, b) => a + b, 0); // tabulka dává 99,9 % → normalizace
    const mm = mesicniMm || PODIL_MESICU.map(p => hr * p / souc);
    let soucet = 0, max = 0;
    const rady = mm.map((h, m) => {
      const pritok = s.Anadrz * h * n.eta / 1000, pd = potrebaDen(n, m), potreba = pd.celkem * DNY_MESICE[m] / 1000;
      soucet += pritok - potreba; if (soucet > max) max = soucet;
      return { mesic: m, mm: h, pritok, potreba, rozdil: pritok - potreba, soucet };
    });
    const pritokRok = rady.reduce((a, r) => a + r.pritok, 0), potrebaRok = rady.reduce((a, r) => a + r.potreba, 0);
    return { rady, hr: mm.reduce((a, b) => a + b, 0), pritokRok, potrebaRok, doporuceno: max };
  }
  /* TP 1.20 vztah 17: objem na 2–3 týdny sucha V_a = Q_d·d1 + q_z·A_z·d2 [l]. */
  function objemNaSucho(n) { return (n.osob * (n.wc + n.pracka) + n.jine * 1000 / 365) * n.d1 + n.qz * n.zahrada * n.d2; }

  /* Denní řada srážek → měsíční průměry [mm]. */
  const naDen = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
  function datumZ(od, k) { return new Date((naDen(od) + k) * 86400000); }
  function mesicniPrumery(sr) {
    const souc = new Array(12).fill(0), roky = new Set();
    sr.mm.forEach((x, k) => { const d = datumZ(sr.od, k); souc[d.getUTCMonth()] += x; roky.add(d.getUTCFullYear()); });
    const n = Math.max(1, sr.mm.length / 365.25);
    return { mm: souc.map(x => x / n), roky: roky.size };
  }
  /* Denní simulace nádrže (yield-after-spillage): S += přítok; přetok = max(0, S − V); S = min(S, V); odběr = min(potřeba, S).
     Začíná s prázdnou nádrží. Výsledky v m³ za celé období a průměr za rok. */
  function simuluj(pr, V, sr, sbirej) {
    const n = pr.nadrz, Aeff = souhrnPloch(pr.plochy).Anadrz * n.eta;
    const pd = []; for (let m = 0; m < 12; m++) pd.push(potrebaDen(n, m));
    let S = 0, pritok = 0, pretok = 0, vyuzito = 0, vyuzBudova = 0, potreba = 0, prazdno = 0;
    const hladina = sbirej ? [] : null;
    const start = naDen(sr.od);
    for (let k = 0; k < sr.mm.length; k++) {
      const m = new Date((start + k) * 86400000).getUTCMonth();
      const q = sr.mm[k] * Aeff / 1000, d = pd[m].celkem / 1000;
      S += q; pritok += q;
      if (S > V) { pretok += S - V; S = V; }
      const y = Math.min(d, S); S -= y;
      vyuzito += y; potreba += d; if (d > 0) vyuzBudova += y * pd[m].budova / pd[m].celkem;
      if (y < d - 1e-9) prazdno++;
      if (hladina) hladina.push(S);
    }
    const roky = sr.mm.length / 365.25;
    return {
      V, roky, pritok: pritok / roky, pretok: pretok / roky, vyuzito: vyuzito / roky, vyuzBudova: vyuzBudova / roky, vyuzZalivka: (vyuzito - vyuzBudova) / roky, potreba: potreba / roky,
      kryti: potreba > 0 ? vyuzito / potreba : 0, miraPretoku: pritok > 0 ? pretok / pritok : 0, miraVyuziti: pritok > 0 ? vyuzito / pritok : 0, dnyNedostatek: prazdno / roky, hladina
    };
  }
  function krivkaObjemu(pr, sr, objemy) {
    objemy = objemy || [0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30];
    return objemy.map(V => simuluj(pr, V, sr));
  }
  /* Nejmenší objem, nad kterým už další 1 m³ zvýší krytí potřeby o méně než 1 procentní bod (bod zlomu křivky). */
  function bodZlomu(krivka) {
    for (let k = 1; k < krivka.length; k++) {
      const dV = krivka[k].V - krivka[k - 1].V, dK = (krivka[k].kryti - krivka[k - 1].kryti) * 100;
      if (dV > 0 && dK / dV < 1) return krivka[k - 1].V;
    }
    return krivka[krivka.length - 1].V;
  }
  /* Open-Meteo archiv (ERA5): JSON → řada. */
  function zOpenMeteo(js, lat, lon) {
    const d = js && js.daily;
    if (!d || !Array.isArray(d.time) || !Array.isArray(d.precipitation_sum) || !d.time.length) throw new Error('Neplatná odpověď Open-Meteo');
    return { od: d.time[0], mm: d.precipitation_sum.map(x => kladne(x, 0)), zdroj: 'Open-Meteo Historical Weather API (ERA5), CC BY 4.0', lat, lon, stazeno: new Date().toISOString().slice(0, 10) };
  }
  function obdobiOpenMeteo(dnes, roku) {
    const r = (dnes || new Date()).getFullYear() - 1;
    return { od: (r - (roku || 10) + 1) + '-01-01', do: r + '-12-31' };
  }
  /* CSV s denními srážkami (datum;mm), např. z ČHMÚ. Mezery mezi dny doplní nulou. */
  function zCsv(text) {
    const zaznamy = [];
    for (const radek of String(text).split(/\r?\n/)) {
      const m = radek.match(/(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
      if (!m) continue;
      const iso = m[1] ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : `${m[6]}-${m[5].padStart(2, '0')}-${m[4].padStart(2, '0')}`;
      // za datem oddělovač; je-li jím čárka, desetinná je tečka, jinak se připouští i desetinná čárka
      const zb = radek.slice(m.index + m[0].length), odd = (zb.match(/^\s*([;,\t])/) || [])[1];
      const h = zb.replace(/^\s*[;,\t]?\s*/, '').match(odd === ',' ? /^\d+(\.\d+)?/ : /^\d+([.,]\d+)?/);
      const v = h ? cislo(h[0], NaN) : NaN;
      if (Number.isFinite(v) && v >= 0) zaznamy.push([naDen(iso), v]);
    }
    if (zaznamy.length < 365) throw new Error('V souboru je méně než 365 denních hodnot.');
    zaznamy.sort((a, b) => a[0] - b[0]);
    const od = zaznamy[0][0], mm = new Array(zaznamy[zaznamy.length - 1][0] - od + 1).fill(0);
    for (const [d, v] of zaznamy) mm[d - od] = v;
    return { od: new Date(od * 86400000).toISOString().slice(0, 10), mm, zdroj: 'vlastní CSV', lat: null, lon: null, stazeno: new Date().toISOString().slice(0, 10) };
  }

  /* ---------- úspora ---------- */
  function ceny(pr) {
    const u = pr.uspora, c = CENY.find(x => x.id === u.cena);
    return c ? { vodne: c.vodne, stocne: c.stocne, nazev: c.nazev + ' (' + CENY_DATUM + ')' } : { vodne: u.vodne, stocne: u.stocne, nazev: 'vlastní ceny' };
  }
  /* Zalévání: ušetří vodné i stočné (voda nejde do kanalizace). WC a pračka: ušetří vodné; stočné se podle § 19 odst. 5
     zákona 274/2001 Sb. platí i za dešťovou vodu vypuštěnou do kanalizace (pokud ho vodárna neúčtuje, lze odškrtnout). */
  function uspora(pr, vyuzBudova, vyuzZalivka) {
    const c = ceny(pr), u = pr.uspora;
    const kc = vyuzBudova * (c.vodne + (u.stocneBudova ? 0 : c.stocne)) + vyuzZalivka * (c.vodne + c.stocne);
    const cista = kc - u.provoz;
    return { kc, cista, ceny: c, navratnost: u.investice > 0 && cista > 0 ? u.investice / cista : null };
  }

  /* ---------- formát ---------- */
  function fmt(x, des) {
    if (x == null || !Number.isFinite(x)) return '–';
    return x.toLocaleString('cs-CZ', { minimumFractionDigits: des || 0, maximumFractionDigits: des || 0 });
  }
  function fmtKv(kv) {
    if (!(kv > 0)) return '–';
    const e = Math.floor(Math.log10(kv)), m = kv / Math.pow(10, e);
    return (Math.round(m * 100) / 100).toLocaleString('cs-CZ') + '·10⁻' + String(-e).split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]).join('') + ' m/s';
  }

  const API = {
    VERZE, KLIC, HD, SKLONY, DRUHY, DRUH, BEZPECNOST, I_CSN, ZLABY, SVODY, UHRN_VYSKA, PODIL_MESICU, MESICE, DNY_MESICE, POTREBA, ZALIVKA_MESICE, CENY, CENY_DATUM, UMISTENI_RET,
    cislo, novyId, novaPlocha, novyProjekt, normProjekt, prazdna, migruj,
    souC, souPsi, souPsiD, souhrnPloch, intenzita, prurezZlabu, kapacitaZlabu, kapacitaSvodu, navrhOdvodneni,
    hdRada, objemNadrze, hodnoceniKv, kvZeZkousky, navrhVsaku, navrhRetence,
    uhrnZVysky, potrebaDen, rocniPotreba, rocniUhrn, mesicniBilance, objemNaSucho, mesicniPrumery, simuluj, krivkaObjemu, bodZlomu, zOpenMeteo, obdobiOpenMeteo, zCsv,
    ceny, uspora, fmt, fmtKv, zaokr
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else g.DestJadro = API;
})(this);

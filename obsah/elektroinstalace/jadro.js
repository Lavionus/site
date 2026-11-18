/* Elektroinstalace domu – jádro bez DOM (test: node _test/elektroinstalace_test.js).
   Okruhy po místnostech, dovolené proudy kabelů podle způsobu uložení, koordinace jistič–kabel,
   úbytek napětí, impedance smyčky a samočinné odpojení, selektivita k hlavnímu jističi,
   soudobost, rozdělení na fáze, rozložení rozvodnice v modulech DIN, kusovník, import z Půdorysu.
   Tabulky Iz, součinitelů, příl. G a pásma spouští ověřeny 17. 11. 2026 proti veřejným zdrojům (viz komentáře u tabulek);
   platné vydání norem si vždy ověřte – viz NORMY. */
(function () {
  'use strict';

  const VERZE = 1;
  const KLIC = 'webapp_elektroinstalace';

  /* Normy, na které stránka odkazuje (orientačně, stav k 11/2026 – vždy ověřte platné vydání). */
  const NORMY = [
    ['ČSN 33 2000-4-41 ed. 3', 'Ochrana před úrazem elektrickým proudem (samočinné odpojení, proudové chrániče 30 mA)'],
    ['ČSN 33 2000-4-43 ed. 2', 'Ochrana před nadproudy (podmínky Ib ≤ In ≤ Iz, I2 ≤ 1,45·Iz)'],
    ['ČSN 33 2000-5-52 ed. 2', 'Výběr a stavba – elektrická vedení (dovolené proudy, přepočítací součinitele, úbytek napětí – příl. G)'],
    ['ČSN 33 2000-7-701 ed. 2', 'Prostory s vanou nebo sprchou'],
    ['ČSN 33 2130 ed. 3', 'Vnitřní elektrické rozvody (obvody v bytech a domech)'],
    ['ČSN EN 60898-1', 'Jističe pro domovní instalace (charakteristiky B, C, D)'],
  ];

  const PRUREZY = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50];
  const JISTICE = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63];
  const CHAR = ['B', 'C', 'D'];
  /* Okamžitá (magnetická) spoušť jako násobek In podle ČSN EN 60898-1: B 3–5, C 5–10, D 10–20
     (ověřeno 17. 11. 2026 – BEAMA Guide to LV Circuit-Breakers Standards a výrobci; D výjimečně až 50 In).
     Kontrola samočinného odpojení bere horní mez pásma = vypnutí do 0,1 s, tedy splní i 0,4 s z tab. 41.1
     (TN 230 V, koncové obvody do 63 A se zásuvkou / do 32 A s pevně připojenými spotřebiči). */
  const MAG = { B: [3, 5], C: [5, 10], D: [10, 20] };

  /* Způsoby uložení (ČSN 33 2000-5-52, tab. B.52.1, zkráceně). */
  const ULOZENI = [
    { id: 'A1', nazev: 'A1 – jednožilové vodiče v trubce v tepelně izolační stěně' },
    { id: 'A2', nazev: 'A2 – kabel v trubce v tepelně izolační stěně' },
    { id: 'B1', nazev: 'B1 – jednožilové vodiče v trubce na zdi / ve zdi' },
    { id: 'B2', nazev: 'B2 – kabel v trubce nebo liště na zdi / ve zdi' },
    { id: 'C', nazev: 'C – kabel na zdi nebo přímo ve zdivu pod omítkou' },
    { id: 'E', nazev: 'E – kabel ve volném vzduchu (perforovaný žlab)' },
  ];
  /* Dovolené proudy Iz [A] – měď, izolace PVC 70 °C, okolí 30 °C, podle IEC 60364-5-52:2009
     (převzato do ČSN 33 2000-5-52 ed. 2) tab. B.52.2 a B.52.4 (A1–C) a B.52.10 (E, vícežilový kabel).
     Klíč 2 = dva zatížené vodiče (1f), 3 = tři zatížené vodiče (3f). Pořadí podle PRUREZY.
     Ověřeno 17. 11. 2026 (všech 108 hodnot shodných): Top Cable „Methods of installation and current-carrying
     capacities based on IEC 60364-5-52 Ed.3“ (www.topcable.com/topmatic/data/en.pdf, snímky tabulek normy);
     kontrolně Kabex a. s. „Dimenzování instalačních kabelů … proudová zatížitelnost“ TAB 2 (zjednodušená tabulka
     podle ČSN 33 2000-5-52 ed. 2 – sloupce C a E shodné, ostatní tam sloučené/zaokrouhlené, proto jen orientačně). */
  const IZ = {
    A1: { 2: [14.5, 19.5, 26, 34, 46, 61, 80, 99, 119], 3: [13.5, 18, 24, 31, 42, 56, 73, 89, 108] },
    A2: { 2: [14, 18.5, 25, 32, 43, 57, 75, 92, 110], 3: [13, 17.5, 23, 29, 39, 52, 68, 83, 99] },
    B1: { 2: [17.5, 24, 32, 41, 57, 76, 101, 125, 151], 3: [15.5, 21, 28, 36, 50, 68, 89, 110, 134] },
    B2: { 2: [16.5, 23, 30, 38, 52, 69, 90, 111, 133], 3: [15, 20, 27, 34, 46, 62, 80, 99, 118] },
    C: { 2: [19.5, 27, 36, 46, 63, 85, 112, 138, 168], 3: [17.5, 24, 32, 41, 57, 76, 96, 119, 144] },
    E: { 2: [22, 30, 40, 51, 70, 94, 119, 148, 180], 3: [18.5, 25, 34, 43, 60, 80, 101, 126, 153] },
  };
  /* Součinitel teploty okolí pro PVC (tab. B.52.14) – ověřeno 17. 11. 2026: Top Cable (viz výše) a Kabex TAB 3, shodné. */
  const K_TEPLOTA = { 10: 1.22, 15: 1.17, 20: 1.12, 25: 1.06, 30: 1, 35: 0.94, 40: 0.87, 45: 0.79, 50: 0.71, 55: 0.61, 60: 0.5 };
  /* Součinitel seskupení (tab. B.52.17), index = počet obvodů − 1 (1–20):
     svazek / uložení ve zdi (A, B; řádek 1), jedna vrstva na stěně (C; ř. 2), perforovaný žlab (E; ř. 4).
     Ověřeno 17. 11. 2026 proti Top Cable (snímek tab. B.52.17). Řádek 1 pokračuje 12 → 0,45, 16 → 0,41,
     20 → 0,38 (mezihodnoty 10–11, 13–15, 17–19 bráno bezpečně podle nejbližšího vyššího počtu);
     řádky 2 a 4: nad 9 obvodů se dál nesnižuje. Kabex TAB 4 uvádí zaokrouhlenou starší verzi (6 → 0,55, 16 → 0,4). */
  const K_SESKUPENI = {
    svazek: [1, 0.8, 0.7, 0.65, 0.6, 0.57, 0.54, 0.52, 0.5, 0.45, 0.45, 0.45, 0.41, 0.41, 0.41, 0.41, 0.38, 0.38, 0.38, 0.38],
    stena: [1, 0.85, 0.79, 0.75, 0.73, 0.72, 0.72, 0.71, 0.7],
    zlab: [1, 0.88, 0.82, 0.77, 0.75, 0.73, 0.73, 0.72, 0.72],
  };

  /* Úbytek napětí podle ČSN 33 2000-5-52, příl. G: ρ1 = 1,25 × ρ při 20 °C = 0,0225 Ω·mm²/m (Cu),
     reaktance λ = 0,08 mΩ/m, b = 1 (3f) / 2 (1f), meze tab. G.52.1 3 % světla / 5 % ostatní (veřejná síť nn).
     Ověřeno 17. 11. 2026: ieccalc.com/standards/iec-60364-5-52 (text přílohy G), meze i elektrika.cz
     („Nová norma ČSN 33 2000-5-52 ed. 2“). Příloha G je informativní. */
  const RHO1 = 0.0225;
  const LAMBDA = 0.08e-3;
  /* Napěťové součinitele pro zkratové proudy (IEC 60909-0 tab. 1, nn s tolerancí +10 %: cmax 1,10, cmin 0,95);
     ověřeno 17. 11. 2026 (filipinoengineer.com, mycableengineering.com – opis tab. 1). */
  const C_MIN = 0.95, C_MAX = 1.1;

  /* Druhy okruhů – výchozí hodnoty jsou ODHAD pro dům (ne z normy), upravte podle štítků spotřebičů. */
  const DRUHY = {
    zas: { nazev: 'Zásuvky 230 V', ik: '🔌', f: 1, typ: 'zas', P: 3450, cos: 0.95, ks: 0.1, In: 16, ch: 'B', S: 2.5, vyvody: 6 },
    svet: { nazev: 'Světla', ik: '💡', f: 1, typ: 'svet', P: 400, cos: 0.9, ks: 0.6, In: 10, ch: 'B', S: 1.5, vyvody: 6 },
    varna: { nazev: 'Varná deska / sporák 3f', ik: '🍳', f: 3, typ: 'spot', P: 7400, cos: 1, ks: 0.5, In: 16, ch: 'B', S: 2.5 },
    trouba: { nazev: 'Trouba', ik: '♨️', f: 1, typ: 'spot', P: 3500, cos: 1, ks: 0.3, In: 16, ch: 'B', S: 2.5 },
    mycka: { nazev: 'Myčka', ik: '🍽️', f: 1, typ: 'spot', P: 2200, cos: 1, ks: 0.3, In: 16, ch: 'B', S: 2.5 },
    pracka: { nazev: 'Pračka', ik: '🧺', f: 1, typ: 'spot', P: 2300, cos: 1, ks: 0.3, In: 16, ch: 'B', S: 2.5 },
    susicka: { nazev: 'Sušička', ik: '🌀', f: 1, typ: 'spot', P: 2500, cos: 1, ks: 0.3, In: 16, ch: 'B', S: 2.5 },
    bojler: { nazev: 'Ohřívač vody', ik: '🚿', f: 1, typ: 'spot', P: 2000, cos: 1, ks: 1, In: 16, ch: 'B', S: 2.5 },
    tc: { nazev: 'Tepelné čerpadlo 3f', ik: '🌡️', f: 3, typ: 'spot', P: 6000, cos: 0.9, ks: 0.8, In: 16, ch: 'C', S: 2.5, rada: 'Typ chrániče (F/B) a charakteristiku jističe volte podle návodu výrobce.' },
    wallbox: { nazev: 'Nabíječka EV 11 kW', ik: '🚗', f: 3, typ: 'spot', P: 11000, cos: 1, ks: 1, In: 20, ch: 'B', S: 4, rada: 'Chránič typ B, nebo typ A s detekcí DC 6 mA v nabíječce – podle návodu výrobce.' },
    zas400: { nazev: 'Zásuvka 400 V', ik: '⚡', f: 3, typ: 'zas', P: 6000, cos: 0.9, ks: 0.1, In: 16, ch: 'C', S: 2.5, vyvody: 1 },
    obecny: { nazev: 'Spotřebič 230 V', ik: '🔧', f: 1, typ: 'spot', P: 1000, cos: 1, ks: 0.7, In: 16, ch: 'B', S: 2.5 },
    obecny3: { nazev: 'Spotřebič 400 V', ik: '🏭', f: 3, typ: 'spot', P: 3000, cos: 0.9, ks: 0.7, In: 16, ch: 'C', S: 2.5 },
  };

  /* Šablony místností = obvyklá praxe (ne požadavek normy). */
  const SABLONY = {
    kuchyn: { nazev: 'Kuchyň', okruhy: [['zas', 'Zásuvky linka 1'], ['zas', 'Zásuvky linka 2'], ['varna'], ['trouba'], ['mycka'], ['svet', 'Světla kuchyň']] },
    obyvak: { nazev: 'Obývací pokoj', okruhy: [['zas', 'Zásuvky obývák'], ['svet', 'Světla obývák']] },
    loznice: { nazev: 'Ložnice', okruhy: [['zas', 'Zásuvky ložnice'], ['svet', 'Světla ložnice']] },
    pokoj: { nazev: 'Pokoj', okruhy: [['zas', 'Zásuvky pokoj'], ['svet', 'Světla pokoj']] },
    koupelna: { nazev: 'Koupelna', okruhy: [['zas', 'Zásuvky koupelna'], ['svet', 'Světla koupelna']] },
    chodba: { nazev: 'Chodba', okruhy: [['svet', 'Světla chodba'], ['zas', 'Zásuvky chodba']] },
    technicka: { nazev: 'Technická místnost', okruhy: [['pracka'], ['susicka'], ['bojler'], ['zas', 'Zásuvky technická']] },
    garaz: { nazev: 'Garáž / dílna', okruhy: [['zas', 'Zásuvky garáž'], ['zas400'], ['svet', 'Světla garáž']] },
    venku: { nazev: 'Venkovní', okruhy: [['zas', 'Zásuvky venkovní'], ['svet', 'Světla venkovní']] },
  };

  const MODULY = { mcb1: 1, mcb3: 3, rcd2: 2, rcd4: 4, rcbo: 2, vypinac: 3, spd: 4 };

  /* ---------- pomocné ---------- */
  const cislo = (v, d) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : d; };
  const omez = (v, a, b) => Math.min(b, Math.max(a, v));
  const zaokr = (v, n) => { const k = Math.pow(10, n || 0); return Math.round(v * k) / k; };
  const fc = (v, n) => String(zaokr(v, n)).replace('.', ',');
  let citac = 0;
  function novyId(p) { return (p || 'o') + Date.now().toString(36) + (citac++).toString(36) + Math.random().toString(36).slice(2, 5); }
  const vyber = (v, moznosti, d) => moznosti.includes(v) ? v : d;
  const bezDiakritiky = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  /* ---------- data ---------- */
  function prazdny() {
    return {
      verze: VERZE, nazev: 'Rodinný dům', pozn: '',
      sit: {
        Ze: 0.5, U0: 230, teplota: 30,
        hlIn: 25, hlChar: 'B', privodDelka: 10, privodS: 10, privodUloz: 'C',
        duSvet: 3, duOst: 5, naRadu: 12, rezerva: 20, rezervaKabel: 10,
        vypinac: true, spd: true,
      },
      mistnosti: [], rcd: [], okruhy: [],
    };
  }
  function normSit(s) {
    const d = prazdny().sit; s = s || {};
    return {
      Ze: omez(cislo(s.Ze, d.Ze), 0.01, 10), U0: d.U0, teplota: vyber(+s.teplota, Object.keys(K_TEPLOTA).map(Number), d.teplota),
      hlIn: vyber(+s.hlIn, JISTICE, d.hlIn), hlChar: vyber(s.hlChar, CHAR, d.hlChar),
      privodDelka: omez(cislo(s.privodDelka, d.privodDelka), 0, 500), privodS: vyber(+s.privodS, PRUREZY, d.privodS),
      privodUloz: vyber(s.privodUloz, Object.keys(IZ), d.privodUloz),
      duSvet: omez(cislo(s.duSvet, d.duSvet), 0.5, 10), duOst: omez(cislo(s.duOst, d.duOst), 0.5, 10),
      naRadu: vyber(+s.naRadu, [12, 14, 18], d.naRadu), rezerva: omez(cislo(s.rezerva, d.rezerva), 0, 100),
      rezervaKabel: omez(cislo(s.rezervaKabel, d.rezervaKabel), 0, 100),
      vypinac: s.vypinac !== false, spd: s.spd !== false,
    };
  }
  function normRcd(r) {
    r = r || {};
    return {
      id: String(r.id || novyId('r')), nazev: String(r.nazev || ''),
      In: vyber(+r.In, [25, 40, 63], 40), IdN: vyber(+r.IdN, [10, 30, 100, 300], 30),
      typ: vyber(r.typ, ['AC', 'A', 'F', 'B'], 'A'), poly: vyber(+r.poly, [2, 4], 4),
      faze: vyber(r.faze, ['auto', 'L1', 'L2', 'L3'], 'auto'),
    };
  }
  function novyOkruh(druh, nazev, mistnost) {
    const d = DRUHY[druh] || DRUHY.obecny;
    return normOkruh({ druh: DRUHY[druh] ? druh : 'obecny', nazev: nazev || d.nazev, mistnost: mistnost || '', P: d.P, cos: d.cos, ks: d.ks, In: d.In, ch: d.ch, S: d.S, vyvody: d.vyvody || 0 });
  }
  function normOkruh(o) {
    o = o || {};
    const druh = DRUHY[o.druh] ? o.druh : 'obecny', d = DRUHY[druh];
    return {
      id: String(o.id || novyId('o')), druh,
      nazev: String(o.nazev || d.nazev).slice(0, 80), mistnost: String(o.mistnost || '').slice(0, 60),
      faze: d.f === 3 ? '3f' : vyber(o.faze, ['auto', 'L1', 'L2', 'L3'], 'auto'),
      P: omez(cislo(o.P, d.P), 0, 100000), cos: omez(cislo(o.cos, d.cos), 0.3, 1), ks: omez(cislo(o.ks, d.ks), 0, 1),
      In: vyber(+o.In, JISTICE, d.In), ch: vyber(o.ch, CHAR, d.ch), S: vyber(+o.S, PRUREZY, d.S),
      uloz: vyber(o.uloz, Object.keys(IZ), 'C'), seskup: Math.round(omez(cislo(o.seskup, 1), 1, 20)),
      delka: omez(cislo(o.delka, 15), 0.5, 1000), rcd: String(o.rcd == null ? '' : o.rcd),
      vyvody: Math.round(omez(cislo(o.vyvody, d.vyvody || 0), 0, 99)), pozn: String(o.pozn || '').slice(0, 300),
    };
  }
  function migruj(p) {
    const z = prazdny();
    if (!p || typeof p !== 'object') return z;
    z.nazev = String(p.nazev || z.nazev).slice(0, 120); z.pozn = String(p.pozn || '').slice(0, 2000);
    z.sit = normSit(p.sit);
    z.rcd = (Array.isArray(p.rcd) ? p.rcd : []).map(normRcd);
    const ids = new Set(z.rcd.map(r => r.id));
    z.okruhy = (Array.isArray(p.okruhy) ? p.okruhy : []).map(normOkruh).map(o => (o.rcd && o.rcd !== 'rcbo' && !ids.has(o.rcd)) ? Object.assign(o, { rcd: '' }) : o);
    z.mistnosti = [...new Set((Array.isArray(p.mistnosti) ? p.mistnosti : []).map(String).concat(z.okruhy.map(o => o.mistnost)).filter(Boolean))];
    return z;
  }

  /* ---------- výpočty okruhu ---------- */
  const trojfaz = o => DRUHY[o.druh].f === 3;
  function proud(o, sit) {
    const U0 = (sit && sit.U0) || 230;
    return trojfaz(o) ? o.P / (Math.sqrt(3) * U0 * Math.sqrt(3) * o.cos) : o.P / (U0 * o.cos);
  }
  function kSeskupeni(uloz, n) {
    const rada = uloz === 'C' ? K_SESKUPENI.stena : uloz === 'E' ? K_SESKUPENI.zlab : K_SESKUPENI.svazek;
    return rada[Math.min(Math.max(1, n), rada.length) - 1];
  }
  function izZaklad(uloz, S, zatizene) {
    const i = PRUREZY.indexOf(S);
    return i < 0 ? 0 : IZ[uloz][zatizene][i];
  }
  function iz(o, sit) {
    const z = izZaklad(o.uloz, o.S, trojfaz(o) ? 3 : 2), kT = K_TEPLOTA[sit.teplota] || 1, kS = kSeskupeni(o.uloz, o.seskup);
    return { Iz0: z, kT, kS, Iz: z * kT * kS };
  }
  /* Úbytek napětí v % U0 (příl. G): u = b·(ρ1·L/S·cosφ + λ·L·sinφ)·Ib, b = 2 (1f) / 1 (3f). */
  function ubytek(I, L, S, cos, trif, U0) {
    const b = trif ? 1 : 2, sin = Math.sqrt(Math.max(0, 1 - cos * cos));
    return 100 * b * (RHO1 * L / S * cos + LAMBDA * L * sin) * I / (U0 || 230);
  }
  /* Impedance smyčky L–PE na svorkách rozvaděče: Ze u hlavního jističe + přívod (L a PEN stejného průřezu). */
  const zRozvadec = sit => sit.Ze + 2 * RHO1 * sit.privodDelka / sit.privodS;

  /* Proudy, soudobost a fáze celé instalace. */
  function soudobost(p) {
    const sit = p.sit, faze = rozdelFaze(p);
    let P = 0, Ps = 0;
    for (const o of p.okruhy) { P += o.P; Ps += o.P * o.ks; }
    const Imax = Math.max(faze.I.L1, faze.I.L2, faze.I.L3);
    const hlNavrh = JISTICE.find(j => j >= Imax - 1e-9) || null;
    const izPrivod = izZaklad(sit.privodUloz, sit.privodS, 3) * (K_TEPLOTA[sit.teplota] || 1);
    const duPrivod = ubytek(Math.max(Imax, 0), sit.privodDelka, sit.privodS, 0.95, true, sit.U0);
    const zr = zRozvadec(sit);
    return {
      P, Ps, beta: P ? Ps / P : 0, I: faze.I, Imax, nesymetrie: faze.nesymetrie, faze,
      hlNavrh, izPrivod, duPrivod, zRozvadec: zr, ikMax: C_MAX * sit.U0 / sit.Ze, ikRozvadec: C_MAX * sit.U0 / zr,
    };
  }

  /* Rozdělení 1f okruhů na fáze (nejdřív největší soudobý proud na nejméně zatíženou fázi).
     Chránič 2P (1+N) je na jedné fázi – jeho okruhy jdou na fázi společně. */
  function rozdelFaze(p) {
    const sit = p.sit, I = { L1: 0, L2: 0, L3: 0 }, okruh = {}, rcdFaze = {};
    const rcd2 = {}; p.rcd.forEach(r => { if (r.poly === 2) rcd2[r.id] = r; });
    const jednotky = [];
    for (const o of p.okruhy) {
      const Is = proud(o, sit) * o.ks;
      if (trojfaz(o)) { okruh[o.id] = '3f'; I.L1 += Is; I.L2 += Is; I.L3 += Is; continue; }
      if (rcd2[o.rcd]) {
        let j = jednotky.find(x => x.rcd === o.rcd);
        if (!j) jednotky.push(j = { rcd: o.rcd, ids: [], I: 0, faze: rcd2[o.rcd].faze });
        j.ids.push(o.id); j.I += Is;
      } else jednotky.push({ ids: [o.id], I: Is, faze: o.faze });
    }
    const pevne = jednotky.filter(j => j.faze !== 'auto'), volne = jednotky.filter(j => j.faze === 'auto').sort((a, b) => b.I - a.I);
    for (const j of pevne.concat(volne)) {
      if (j.faze === 'auto') j.faze = ['L1', 'L2', 'L3'].reduce((m, f) => I[f] < I[m] - 1e-9 ? f : m, 'L1');
      I[j.faze] += j.I;
      j.ids.forEach(id => { okruh[id] = j.faze; });
      if (j.rcd) rcdFaze[j.rcd] = j.faze;
    }
    const prum = (I.L1 + I.L2 + I.L3) / 3, max = Math.max(I.L1, I.L2, I.L3);
    return { I, okruh, rcdFaze, nesymetrie: prum > 0 ? 100 * (max - prum) / prum : 0 };
  }

  /* Selektivita jistič okruhu ↔ hlavní jistič (zjednodušeně podle pásem okamžité spouště). */
  function selektivita(sit, o, ikRozvadec) {
    if (sit.hlIn <= o.In) return { u: 'chyba', mez: 0, t: `Hlavní jistič ${sit.hlChar}${sit.hlIn} nemá vyšší jmenovitý proud než jistič okruhu ${o.ch}${o.In} – selektivita není možná.` };
    const mez = MAG[sit.hlChar][0] * sit.hlIn, horni = MAG[o.ch][1] * o.In;
    let t = `Selektivní v oblasti přetížení; při zkratu zjednodušeně do ≈ ${Math.round(mez)} A (dolní mez okamžité spouště hlavního jističe).`;
    if (horni > mez) t += ` Jistič okruhu spolehlivě vypíná okamžitě až od ${Math.round(horni)} A – v pásmu ${Math.round(mez)}–${Math.round(horni)} A může vypnout i hlavní jistič.`;
    if (ikRozvadec <= mez && horni <= mez) return { u: 'ok', mez, t: `Selektivní (zkrat v rozvaděči ≈ ${Math.round(ikRozvadec)} A < ${Math.round(mez)} A).` };
    return { u: 'var', mez, t: t + ` Zkratový proud u rozvaděče ≈ ${Math.round(ikRozvadec)} A → jen částečná selektivita. Přesně podle tabulek selektivity výrobce.` };
  }

  /* Je chránič 30 mA vyžadován (zjednodušeně podle ČSN 33 2000-4-41 ed. 3 a -7-701)?
     Ed. 3 platí od 1. 1. 2018: čl. 411.3.3 zásuvky do 32 A, nový čl. 411.3.4 světelné obvody v samostatné
     domácnosti (TN, TT). Ověřeno 17. 11. 2026: elektroprumysl.cz „Základní změny v ČSN 33 2000-4-41 ed. 3 oproti ed. 2“,
     profiklubelektrotechniku.cz (ČSN 33 2130 ed. 3 změna Z1 – totéž pro byty). */
  function rcdPozadavek(o) {
    const m = bezDiakritiky(o.mistnost + ' ' + o.nazev);
    if (/koupel|sprch/.test(m)) return { u: 'chyba', t: 'Prostor s vanou/sprchou – všechny obvody chránit chráničem ≤ 30 mA (ČSN 33 2000-7-701).' };
    const t = DRUHY[o.druh].typ;
    if (t === 'zas' && o.In <= 32) return { u: 'chyba', t: 'Zásuvky do 32 A – doplňková ochrana chráničem ≤ 30 mA (ČSN 33 2000-4-41 ed. 3, čl. 411.3.3).' };
    if (/venk|zahrad/.test(m)) return { u: 'chyba', t: 'Venkovní obvod – doplňková ochrana chráničem ≤ 30 mA.' };
    if (t === 'svet') return { u: 'chyba', t: 'Světelné obvody v domácnosti – doplňková ochrana chráničem ≤ 30 mA (ČSN 33 2000-4-41 ed. 3, čl. 411.3.4).' };
    return null;
  }

  /* Úplný rozbor jednoho okruhu. */
  function rozbor(p, o, sd) {
    sd = sd || soudobost(p);
    const sit = p.sit, trif = trojfaz(o), d = DRUHY[o.druh];
    const Ib = proud(o, sit), z = iz(o, sit);
    const du = ubytek(Ib, o.delka, o.S, o.cos, trif, sit.U0), duCelk = du + sd.duPrivod;
    const duLimit = d.typ === 'svet' ? sit.duSvet : sit.duOst;
    const Zs = sd.zRozvadec + 2 * RHO1 * o.delka / o.S;
    const IkMin = C_MIN * sit.U0 / Zs, Ia = MAG[o.ch][1] * o.In;
    const rcd = o.rcd === 'rcbo' ? { IdN: 30, poly: 2, typ: 'A', rcbo: true } : p.rcd.find(r => r.id === o.rcd) || null;
    const body = [];
    const pridej = (u, t) => body.push({ u, t });
    if (o.In < Ib - 1e-9) pridej('chyba', `Výpočtový proud Ib = ${fc(Ib, 1)} A je větší než jmenovitý proud jističe ${o.In} A.`);
    if (o.In > z.Iz + 1e-9) pridej('chyba', `Kabel není chráněn proti přetížení: In ${o.In} A > Iz ${fc(z.Iz, 1)} A (podmínka Ib ≤ In ≤ Iz).`);
    else pridej('ok', `Ib ${fc(Ib, 1)} A ≤ In ${o.In} A ≤ Iz ${fc(z.Iz, 1)} A.`);
    if (duCelk > duLimit + 1e-9) pridej('var', `Úbytek napětí ${fc(duCelk, 2)} % překračuje doporučených ${duLimit} % (vč. přívodu ${fc(sd.duPrivod, 2)} %).`);
    else pridej('ok', `Úbytek napětí ${fc(duCelk, 2)} % ≤ ${duLimit} %.`);
    if (IkMin < Ia) {
      if (rcd) pridej('var', `Zkratový proud na konci ≈ ${Math.round(IkMin)} A < ${Math.round(Ia)} A – jistič nevypne okamžitě; samočinné odpojení zajistí chránič, zkrat L–N ale jistič vypne pomaleji. Zvětšete průřez nebo zkraťte vedení.`);
      else pridej('chyba', `Samočinné odpojení nesplněno: Ik ≈ ${Math.round(IkMin)} A < ${Math.round(Ia)} A (${o.ch}${o.In}, Zs = ${fc(Zs, 2)} Ω).`);
    } else pridej('ok', `Samočinné odpojení: Ik ≈ ${Math.round(IkMin)} A ≥ ${Math.round(Ia)} A (Zs = ${fc(Zs, 2)} Ω).`);
    const poz = rcdPozadavek(o);
    if (poz && !rcd) pridej(poz.u, poz.t);
    if (rcd && rcd.IdN > 30 && poz) pridej('chyba', `Chránič ${rcd.IdN} mA – pro doplňkovou ochranu je třeba ≤ 30 mA.`);
    if (rcd && trif && rcd.poly === 2) pridej('chyba', 'Třífázový okruh nelze připojit přes dvoupólový chránič.');
    if (o.S < sMin(o)) pridej('var', `Zásuvkové okruhy se v ČR obvykle vedou průřezem nejméně 2,5 mm² Cu (praxe, ověřte ČSN 33 2130 ed. 3).`);
    if (d.rada) pridej('info', d.rada);
    if (d.typ === 'zas' && !trif && o.vyvody > 10) pridej('var', `${o.vyvody} zásuvek na okruhu – obvykle se dává nejvýše 10 (doporučení, ověřte ČSN 33 2130 ed. 3).`);
    const sel = selektivita(sit, o, sd.ikRozvadec);
    if (sel.u === 'chyba') pridej(sel.u, sel.t);
    const stav = body.some(b => b.u === 'chyba') ? 'chyba' : body.some(b => b.u === 'var') ? 'var' : 'ok';
    return { Ib, ...z, du, duCelk, duLimit, Zs, IkMin, Ia, Lmax: maxDelka(p, o, sd), rcd, sel, body, stav };
  }

  /* Největší délka okruhu podle úbytku napětí a podle samočinného odpojení. */
  function maxDelka(p, o, sd) {
    sd = sd || soudobost(p);
    const sit = p.sit, trif = trojfaz(o), Ib = proud(o, sit);
    const limit = (DRUHY[o.druh].typ === 'svet' ? sit.duSvet : sit.duOst) - sd.duPrivod;
    const naMetr = ubytek(Ib, 1, o.S, o.cos, trif, sit.U0);
    const Ldu = naMetr > 0 ? Math.max(0, limit / naMetr) : Infinity;
    const Ia = MAG[o.ch][1] * o.In;
    const Lzs = Math.max(0, (C_MIN * sit.U0 / Ia - sd.zRozvadec) / (2 * RHO1 / o.S));
    return { Ldu, Lzs, L: Math.min(Ldu, Lzs) };
  }

  /* Obvyklá praxe v ČR (ne tvrdý požadavek tabulek): zásuvkové okruhy nejméně 2,5 mm² Cu. */
  const sMin = o => DRUHY[o.druh].typ === 'zas' ? 2.5 : 1.5;

  /* Nejmenší průřez (a případně vyšší jistič), který splní Ib ≤ In ≤ Iz, úbytek a odpojení. */
  function navrhni(p, o, sd) {
    sd = sd || soudobost(p);
    const Ib = proud(o, p.sit);
    const In = Math.max(o.In, JISTICE.find(j => j >= Ib - 1e-9) || JISTICE[JISTICE.length - 1]);
    for (const S of PRUREZY.filter(x => x >= sMin(o))) {
      const t = Object.assign({}, o, { In, S }), r = rozbor(p, t, sd);
      const ok = In <= r.Iz + 1e-9 && r.duCelk <= r.duLimit + 1e-9 && (r.IkMin >= r.Ia || r.rcd);
      if (ok) return { In, S };
    }
    return null;
  }

  /* Kontroly celé instalace: hlavní jistič, přívod, nesymetrie, zatížení chráničů. */
  function kontrolaSit(p, sd) {
    sd = sd || soudobost(p);
    const sit = p.sit, body = [];
    const pridej = (u, t) => body.push({ u, t });
    if (!p.okruhy.length) return body;
    const maxF = ['L1', 'L2', 'L3'].reduce((m, f) => sd.I[f] > sd.I[m] ? f : m, 'L1');
    if (sd.Imax > sit.hlIn + 1e-9) pridej('var', `Soudobý proud fáze ${maxF} ≈ ${fc(sd.Imax, 1)} A je větší než hlavní jistič ${sit.hlChar}${sit.hlIn} – zvažte ${sd.hlNavrh ? sd.hlNavrh + ' A' : 'jiné řešení'}, nižší soudobost nebo blokování spotřebičů (HDO, odlehčovací relé).`);
    else pridej('ok', `Soudobý proud nejzatíženější fáze ${maxF} ≈ ${fc(sd.Imax, 1)} A ≤ hlavní jistič ${sit.hlIn} A.`);
    if (sd.izPrivod < sit.hlIn) pridej('chyba', `Přívod CYKY 5×${fmtS(sit.privodS)} (${sit.privodUloz}) má Iz ≈ ${fc(sd.izPrivod, 1)} A < hlavní jistič ${sit.hlIn} A.`);
    else pridej('ok', `Přívod 5×${fmtS(sit.privodS)} mm²: Iz ≈ ${fc(sd.izPrivod, 1)} A ≥ ${sit.hlIn} A; úbytek ≈ ${fc(sd.duPrivod, 2)} %.`);
    const maxIn = Math.max(...p.okruhy.map(o => o.In));
    if (maxIn >= sit.hlIn) pridej('chyba', `Jistič okruhu ${maxIn} A není menší než hlavní jistič ${sit.hlIn} A.`);
    if (sd.nesymetrie > 20) pridej('var', `Nesymetrie fází ${fc(sd.nesymetrie, 0)} % (odchylka nejvyšší fáze od průměru) – přeskupte okruhy.`);
    for (const r of p.rcd) {
      const I = { L1: 0, L2: 0, L3: 0 };
      for (const o of p.okruhy.filter(x => x.rcd === r.id)) {
        const Is = proud(o, sit) * o.ks, f = sd.faze.okruh[o.id];
        if (f === '3f') { I.L1 += Is; I.L2 += Is; I.L3 += Is; } else if (I[f] != null) I[f] += Is;
      }
      const m = Math.max(I.L1, I.L2, I.L3), jm = r.nazev || 'chránič';
      if (m > r.In) pridej('chyba', `Chránič „${jm}“ ${r.In} A: soudobý proud ≈ ${fc(m, 1)} A ho přetěžuje.`);
      if (r.In < sit.hlIn) pridej('var', `Chránič „${jm}“ ${r.In} A má menší jmenovitý proud než hlavní jistič ${sit.hlIn} A – ochranu chrániče proti přetížení ověřte podle výrobce.`);
    }
    if (p.okruhy.filter(o => o.rcd && o.rcd !== 'rcbo').length && p.rcd.length === 1) pridej('var', 'Všechny okruhy za jedním chráničem – při poruše vypne celý dům. Rozdělte okruhy alespoň na dva chrániče.');
    return body;
  }

  /* ---------- rozvaděč ---------- */
  function poradi(p) {
    const skup = [];
    for (const r of p.rcd) skup.push({ rcd: r, okruhy: p.okruhy.filter(o => o.rcd === r.id) });
    skup.push({ rcbo: true, okruhy: p.okruhy.filter(o => o.rcd === 'rcbo') });
    skup.push({ bez: true, okruhy: p.okruhy.filter(o => !o.rcd) });
    return skup;
  }
  /* Označení přístrojů (zvyklost: Q hlavní vypínač, FV přepěťová ochrana, FI chránič, F jistič). */
  function oznaceni(p) {
    const m = {}; let f = 0;
    p.rcd.forEach((r, i) => { m[r.id] = 'FI' + (i + 1); });
    for (const s of poradi(p)) for (const o of s.okruhy) m[o.id] = 'F' + (++f);
    return m;
  }
  function rozvadec(p) {
    const ozn = oznaceni(p), sd = soudobost(p), polozky = [];
    const kr = s => s.length > 18 ? s.slice(0, 17) + '…' : s;
    if (p.sit.vypinac) polozky.push({ typ: 'vypinac', ozn: 'Q1', text: 'Hlavní vypínač', par: '3P', mod: MODULY.vypinac });
    if (p.sit.spd) polozky.push({ typ: 'spd', ozn: 'FV1', text: 'Přepěťová ochrana', par: 'T1+T2', mod: MODULY.spd });
    for (const s of poradi(p)) {
      if (s.rcd) polozky.push({ typ: 'rcd', ozn: ozn[s.rcd.id], id: s.rcd.id, text: s.rcd.nazev || 'Chránič', par: `${s.rcd.In} A/${s.rcd.IdN} mA ${s.rcd.typ}`, mod: s.rcd.poly === 4 ? MODULY.rcd4 : MODULY.rcd2, faze: s.rcd.poly === 2 ? sd.faze.rcdFaze[s.rcd.id] || '' : '' });
      for (const o of s.okruhy) polozky.push({
        typ: o.rcd === 'rcbo' ? 'rcbo' : 'mcb', ozn: ozn[o.id], id: o.id, text: kr(o.nazev), par: o.ch + o.In + (o.rcd === 'rcbo' ? '/30mA' : ''),
        mod: o.rcd === 'rcbo' ? MODULY.rcbo : trojfaz(o) ? MODULY.mcb3 : MODULY.mcb1, faze: sd.faze.okruh[o.id] || '',
      });
    }
    const naRadu = p.sit.naRadu, rady = [[]];
    let obsaz = 0;
    for (const x of polozky) {
      if (obsaz + x.mod > naRadu && obsaz > 0) { rady.push([]); obsaz = 0; }
      rady[rady.length - 1].push(x); obsaz += x.mod;
    }
    const moduly = polozky.reduce((s, x) => s + x.mod, 0);
    const potreba = Math.ceil(moduly * (1 + p.sit.rezerva / 100));
    const radNavrh = Math.max(1, Math.ceil(potreba / naRadu), rady.length);
    return { polozky, rady, moduly, potreba, radNavrh, velikost: radNavrh * naRadu };
  }

  /* ---------- kusovník ---------- */
  const fmtS = s => String(s).replace('.', ',');
  function kabel(o) { return `CYKY-J ${trojfaz(o) ? 5 : 3}×${fmtS(o.S)}`; }
  function kusovnik(p) {
    const roz = rozvadec(p), m = new Map();
    const pridej = (sk, nazev, mn, jed) => { const k = sk + '|' + nazev; const x = m.get(k) || { skupina: sk, nazev, mnozstvi: 0, jednotka: jed }; x.mnozstvi += mn; m.set(k, x); };
    pridej('Rozvaděč', `Rozvodnice ${roz.radNavrh}×${p.sit.naRadu} modulů (obsazeno ${roz.moduly}, rezerva ${p.sit.rezerva} %)`, 1, 'ks');
    if (p.sit.vypinac) pridej('Rozvaděč', 'Hlavní vypínač 3P (In ≥ hlavní jistič)', 1, 'ks');
    if (p.sit.spd) pridej('Rozvaděč', 'Přepěťová ochrana typ 1+2 (TN-C-S, 3+1)', 1, 'ks');
    pridej('Rozvaděč', 'Svorkovnice N a PE', 2, 'ks');
    pridej('Rozvaděč', 'Propojovací hřebenová lišta', roz.rady.length, 'ks');
    for (const r of p.rcd) pridej('Přístroje', `Proudový chránič ${r.poly === 4 ? '4P' : '2P'} ${r.In} A / ${r.IdN} mA typ ${r.typ}`, 1, 'ks');
    for (const o of p.okruhy) {
      if (o.rcd === 'rcbo') pridej('Přístroje', `Chránič s nadproudovou ochranou 1P+N ${o.ch}${o.In} / 30 mA typ A`, 1, 'ks');
      else pridej('Přístroje', `Jistič ${trojfaz(o) ? '3P' : '1P'} ${o.ch}${o.In}`, 1, 'ks');
      pridej('Kabely', kabel(o), o.delka * (1 + p.sit.rezervaKabel / 100), 'm');
    }
    pridej('Kabely', `CYKY-J 5×${fmtS(p.sit.privodS)} (přívod rozvaděče)`, p.sit.privodDelka * (1 + p.sit.rezervaKabel / 100), 'm');
    const rad = { 'Rozvaděč': 0, 'Přístroje': 1, 'Kabely': 2 };
    return [...m.values()].map(x => Object.assign(x, { mnozstvi: x.jednotka === 'm' ? Math.ceil(x.mnozstvi) : x.mnozstvi }))
      .sort((a, b) => rad[a.skupina] - rad[b.skupina] || a.nazev.localeCompare(b.nazev, 'cs', { numeric: true }));
  }
  function csvPole(v) { const s = String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function csvKusovnik(p) {
    return '﻿Skupina;Položka;Množství;Jednotka\n' + kusovnik(p).map(x => [x.skupina, x.nazev, String(x.mnozstvi).replace('.', ','), x.jednotka].map(csvPole).join(';')).join('\n') + '\n';
  }
  function csvOkruhy(p) {
    const sd = soudobost(p), ozn = oznaceni(p);
    const hl = 'Označení;Okruh;Místnost;Fáze;P [W];ks;Ib [A];Jistič;Kabel;Uložení;Délka [m];Iz [A];Úbytek [%];Zs [Ω];Chránič;Stav';
    return '﻿' + hl + '\n' + p.okruhy.map(o => {
      const r = rozbor(p, o, sd);
      const ch = r.rcd ? (r.rcd.rcbo ? 'RCBO 30 mA' : ozn[o.rcd]) : '';
      return [ozn[o.id], o.nazev, o.mistnost, sd.faze.okruh[o.id], o.P, o.ks, zaokr(r.Ib, 2), o.ch + o.In, kabel(o), o.uloz, o.delka, zaokr(r.Iz, 1), zaokr(r.duCelk, 2), zaokr(r.Zs, 3), ch, r.stav]
        .map(v => csvPole(typeof v === 'number' ? String(v).replace('.', ',') : v)).join(';');
    }).join('\n') + '\n';
  }

  /* ---------- tvorba ---------- */
  function pridejMistnost(p, sablona, nazev) {
    const s = SABLONY[sablona];
    const jm = String(nazev || (s ? s.nazev : 'Místnost')).trim() || 'Místnost';
    if (!p.mistnosti.includes(jm)) p.mistnosti.push(jm);
    const prejmenuj = n => n && nazev && jm !== s.nazev ? n.replace(/ (kuchyň|obývák|ložnice|pokoj|koupelna|chodba|technická|garáž|venkovní)$/, ' ' + jm) : n;
    const nove = s ? s.okruhy.map(([druh, n]) => novyOkruh(druh, prejmenuj(n), jm)) : [];
    p.okruhy.push(...nove);
    return nove;
  }
  /* Výchozí chrániče: zásuvky a vlhké prostory na 4P 30 mA, spotřebiče na druhý 4P 30 mA. */
  function rozdelChranice(p) {
    if (!p.rcd.length) p.rcd.push(normRcd({ nazev: 'Zásuvky a světla' }), normRcd({ nazev: 'Spotřebiče' }));
    const [a, b] = p.rcd;
    for (const o of p.okruhy) if (!o.rcd) o.rcd = (b && DRUHY[o.druh].typ === 'spot') ? b.id : a.id;
  }
  function priklad() {
    const p = prazdny();
    p.nazev = 'Ukázka – rodinný dům 4+kk';
    p.sit.hlIn = 32;
    ['kuchyn', 'obyvak', 'loznice', 'pokoj', 'koupelna', 'chodba', 'technicka', 'garaz', 'venku'].forEach(s => pridejMistnost(p, s));
    const delky = { 'Kuchyň': 12, 'Obývací pokoj': 16, 'Ložnice': 18, 'Pokoj': 20, 'Koupelna': 10, 'Chodba': 8, 'Technická místnost': 5, 'Garáž / dílna': 22, 'Venkovní': 28 };
    p.okruhy.forEach(o => { o.delka = delky[o.mistnost] || 15; });
    const tc = novyOkruh('tc', null, 'Technická místnost'); tc.delka = 6; p.okruhy.push(tc);
    rozdelChranice(p);
    return migruj(p);
  }

  /* Import z Půdorysu (obsah/pudorys.html, klíč webapp_pudorys): prvky elektro → návrh okruhů.
     Seskupení podle pole „Okruh / označení“, jinak zásuvky po místnostech a světla po patrech. */
  const PRVKY_PUD = { zasuvka: ['zas', 1], zasuvka2: ['zas', 2], zasuvkaIP: ['zas', 1], zasuvka400: ['zas400', 1], svetlo: ['svet', 1], svetloS: ['svet', 1] };
  function zPudorysu(pud) {
    const vysledek = { mistnosti: [], okruhy: [] };
    if (!pud || !Array.isArray(pud.patra)) return vysledek;
    const vicePater = pud.patra.length > 1, skup = new Map();
    pud.patra.forEach((pt, pi) => {
      const rozv = (pt.prvky || []).find(e => e.typ === 'rozvadec');
      const misto = e => {
        let best = null, dm = Infinity;
        for (const m of pt.mistnosti || []) { const d = Math.hypot(m.x - e.x, m.y - e.y); if (d < dm) { dm = d; best = m; } }
        const n = best ? best.nazev : 'Bez místnosti';
        return vicePater ? pt.nazev + ' – ' + n : n;
      };
      for (const e of pt.prvky || []) {
        const map = PRVKY_PUD[e.typ]; if (!map) continue;
        const [druh, n] = map, m = misto(e);
        const klic = e.okruh ? 'L|' + e.okruh : druh === 'zas400' ? '4|' + pi + '|' + e.id : druh === 'svet' ? 'S|' + pi : 'Z|' + m;
        let g = skup.get(klic);
        if (!g) skup.set(klic, g = { okruh: e.okruh || '', patro: pt.nazev, mistnosti: {}, druhy: {}, vyvody: 0, L: 0, odhad: !rozv });
        g.mistnosti[m] = (g.mistnosti[m] || 0) + 1;
        g.druhy[druh] = (g.druhy[druh] || 0) + n;
        g.vyvody += n;
        if (rozv) g.L = Math.max(g.L, (Math.abs(e.x - rozv.x) + Math.abs(e.y - rozv.y)) / 100 + (Math.abs((e.z || 0) - (rozv.z || 0)) + 200) / 100);
      }
    });
    const nej = o => Object.entries(o).sort((a, b) => b[1] - a[1])[0][0];
    for (const g of skup.values()) {
      const druh = g.druhy.zas400 ? 'zas400' : g.druhy.zas ? 'zas' : 'svet', mist = nej(g.mistnosti);
      const nazev = g.okruh ? g.okruh : druh === 'svet' ? 'Světla ' + g.patro : druh === 'zas400' ? 'Zásuvka 400 V – ' + mist : 'Zásuvky ' + mist;
      const o = novyOkruh(druh, nazev, druh === 'svet' && !g.okruh ? g.patro : mist);
      o.vyvody = g.vyvody;
      o.delka = g.odhad ? 15 : Math.max(2, Math.round(g.L * 1.15 + 1));
      o.pozn = 'Z Půdorysu: ' + Object.entries(g.druhy).map(([d, n]) => DRUHY[d].nazev.toLowerCase() + ' ' + n).join(', ') +
        (g.druhy.zas && g.druhy.svet ? ' – okruh míchá zásuvky a světla, zkontrolujte.' : '') + (g.odhad ? ' Délka odhadem (v patře chybí rozvaděč).' : ' Délka odhadem z půdorysu (+15 %).');
      vysledek.okruhy.push(o);
      if (!vysledek.mistnosti.includes(o.mistnost)) vysledek.mistnosti.push(o.mistnost);
    }
    return vysledek;
  }

  const api = {
    VERZE, KLIC, NORMY, PRUREZY, JISTICE, CHAR, MAG, ULOZENI, IZ, K_TEPLOTA, K_SESKUPENI, RHO1, LAMBDA, C_MIN, C_MAX, DRUHY, SABLONY, MODULY,
    novyId, prazdny, normSit, normRcd, normOkruh, novyOkruh, migruj,
    trojfaz, sMin, proud, kSeskupeni, izZaklad, iz, ubytek, zRozvadec, soudobost, rozdelFaze, selektivita, rcdPozadavek, rozbor, kontrolaSit, maxDelka, navrhni,
    poradi, oznaceni, rozvadec, kabel, kusovnik, csvKusovnik, csvOkruhy,
    pridejMistnost, rozdelChranice, priklad, zPudorysu, bezDiakritiky,
  };
  if (typeof module !== 'undefined') module.exports = api;
  else window.ElektroJadro = api;
})();

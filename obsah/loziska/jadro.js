/* Katalog ložisek, O-kroužků a těsnění – jádro bez DOM (test: _test/loziska_test.js).
   Obsah: tabulky hlavních řad valivých ložisek (rozměry podle ISO 15 / ISO 355 / ISO 104, únosnosti orientační),
   dekodér označení, hledání podle rozměrů, trvanlivost L10, doporučená uložení, O-kroužky (AS568 + běžné metrické)
   s návrhem drážky, hřídelová těsnění (gufera DIN 3760), náčrty SVG a sítě STL (rotační tělesa). */
(function () {
  'use strict';

  const VERZE = 1;
  const KLIC = 'webapp_loziska';
  /* Únosnosti C/C0 jsou průměrné katalogové hodnoty běžných výrobců – každý výrobce se liší o ±10–20 %. */
  const PARAMETRY = { stav: '11/2026', poznamka: 'rozměry normované (ISO 15, ISO 355, ISO 104), únosnosti a otáčky orientační' };

  const zaokr = (x, k) => Math.round(x / k) * k;
  const fmt = (x, des = 2) => {
    if (x == null || !isFinite(x)) return '–';
    return (+x.toFixed(des)).toString().replace('.', ',');
  };

  /* ---------- rodiny ložisek ----------
     typ: kulickove | kuzelikove | axialni | valeckove; k = n·dm pro odhad mezních otáček (mazání tukem, otevřené). */
  const RODINY = {
    '160': { typ: 'kulickove', nazev: 'Kuličkové jednořadé, řada 160 (zvlášť lehká, úzká)', k: 550000 },
    '60': { typ: 'kulickove', nazev: 'Kuličkové jednořadé, řada 60 (zvlášť lehká)', k: 550000 },
    '62': { typ: 'kulickove', nazev: 'Kuličkové jednořadé, řada 62 (lehká)', k: 550000 },
    '63': { typ: 'kulickove', nazev: 'Kuličkové jednořadé, řada 63 (střední)', k: 520000 },
    '618': { typ: 'kulickove', nazev: 'Kuličkové jednořadé tenkostěnné, řada 618 (dříve 68xx)', k: 500000 },
    '619': { typ: 'kulickove', nazev: 'Kuličkové jednořadé tenkostěnné, řada 619 (dříve 69xx)', k: 500000 },
    'mini': { typ: 'kulickove', nazev: 'Kuličkové miniaturní metrické (6xx – poslední číslice = d)', k: 550000 },
    'MR': { typ: 'kulickove', nazev: 'Kuličkové miniaturní řady MR (číslo = d a D)', k: 550000 },
    '302': { typ: 'kuzelikove', nazev: 'Kuželíkové jednořadé, řada 302', k: 300000 },
    '303': { typ: 'kuzelikove', nazev: 'Kuželíkové jednořadé, řada 303', k: 280000 },
    '320': { typ: 'kuzelikove', nazev: 'Kuželíkové jednořadé, řada 320 X', k: 320000 },
    '511': { typ: 'axialni', nazev: 'Axiální kuličkové jednosměrné, řada 511', k: 160000 },
    '512': { typ: 'axialni', nazev: 'Axiální kuličkové jednosměrné, řada 512', k: 140000 },
    'NU2': { typ: 'valeckove', nazev: 'Válečkové jednořadé, řada 2', k: 450000 },
    'NU3': { typ: 'valeckove', nazev: 'Válečkové jednořadé, řada 3', k: 420000 }
  };
  const TYPY = {
    kulickove: { nazev: 'kuličkové', p: 3, zatizeni: 'radiální a menší axiální v obou směrech' },
    kuzelikove: { nazev: 'kuželíkové', p: 10 / 3, zatizeni: 'kombinované radiální + axiální v jednom směru; montují se v páru (do O nebo do X), seřizuje se vůle', sirka: 'T (celková šířka)' },
    axialni: { nazev: 'axiální kuličkové', p: 3, zatizeni: 'jen axiální v jednom směru, žádné radiální; d = hřídelový kroužek, D = tělesový kroužek, B = výška H', sirka: 'H (výška)' },
    valeckove: { nazev: 'válečkové', p: 10 / 3, zatizeni: 'velké radiální zatížení, axiální jen podle provedení přírub (NJ, NUP)' }
  };
  const PREDPONY = {
    NU: 'NU – vnější kroužek se dvěma přírubami, vnitřní bez přírub: hřídel se může axiálně posouvat (volné ložisko)',
    NJ: 'NJ – vnitřní kroužek s jednou přírubou: axiálně vede hřídel v jednom směru',
    NUP: 'NUP – vnitřní kroužek s přírubou a volnou přírubovou podložkou: vede hřídel v obou směrech',
    N: 'N – vnější kroužek bez přírub, vnitřní se dvěma: volné ložisko (posuv ve vnějším kroužku)',
    NF: 'NF – vnější kroužek s jednou přírubou: vede v jednom směru'
  };

  /* Data: „označení d D B C[kN] C0[kN] [B krytého]“. Rozměry ISO 15/355/104, únosnosti orientační. */
  const DATA = {
    '60': '6000 10 26 8 4.75 1.96|6001 12 28 8 5.4 2.36|6002 15 32 9 5.85 2.85|6003 17 35 10 6.37 3.25|6004 20 42 12 9.95 5|6005 25 47 12 11.9 6.55|6006 30 55 13 13.8 8.3|6007 35 62 14 16.8 10.2|6008 40 68 15 17.8 11.6|6009 45 75 16 22.1 14.6|6010 50 80 16 22.9 16|6011 55 90 18 29.6 21.2|6012 60 95 18 30.7 23.2|6013 65 100 18 31.9 25|6014 70 110 20 39.7 31|6015 75 115 20 41.6 33.5|6016 80 125 22 49.4 40|6017 85 130 22 52 43|6018 90 140 24 61.8 50|6019 95 145 24 64 54|6020 100 150 24 63.7 54',
    '62': '6200 10 30 9 5.4 2.36|6201 12 32 10 7.28 3.1|6202 15 35 11 8.06 3.75|6203 17 40 12 9.95 4.75|6204 20 47 14 13.5 6.55|6205 25 52 15 14.8 7.8|6206 30 62 16 20.3 11.2|6207 35 72 17 27 15.3|6208 40 80 18 32.5 19|6209 45 85 19 35.1 21.6|6210 50 90 20 37.1 23.2|6211 55 100 21 46.2 29|6212 60 110 22 55.3 36|6213 65 120 23 58.5 40.5|6214 70 125 24 63.7 45|6215 75 130 25 68.9 49|6216 80 140 26 72.8 55|6217 85 150 28 87.1 64|6218 90 160 30 101 73.5|6219 95 170 32 114 81.5|6220 100 180 34 127 93',
    '63': '6300 10 35 11 8.52 3.4|6301 12 37 12 10.1 4.15|6302 15 42 13 11.9 5.4|6303 17 47 14 14.3 6.55|6304 20 52 15 16.8 7.8|6305 25 62 17 23.4 11.6|6306 30 72 19 29.6 16|6307 35 80 21 35.1 19|6308 40 90 23 42.3 24|6309 45 100 25 55.3 31.5|6310 50 110 27 65 38|6311 55 120 29 74.1 45|6312 60 130 31 85.2 52|6313 65 140 33 97.5 60|6314 70 150 35 111 68|6315 75 160 37 119 76.5|6316 80 170 39 130 86.5',
    '160': '16001 12 28 7 5.07 2.36|16002 15 32 8 5.59 2.85|16003 17 35 8 6.05 3.25|16004 20 42 8 6.89 4.05|16005 25 47 8 7.61 4.75|16006 30 55 9 11.2 7.35|16007 35 62 9 12.4 8.15|16008 40 68 9 13.3 9.15|16009 45 75 10 15.6 10.8|16010 50 80 10 16.3 11.4',
    '618': '61800 10 19 5 1.38 0.585|61801 12 21 5 1.43 0.67|61802 15 24 5 1.56 0.8|61803 17 26 5 1.68 0.93|61804 20 32 7 4.03 2.32|61805 25 37 7 4.36 2.6|61806 30 42 7 4.49 2.9|61807 35 47 7 4.75 3.2|61808 40 52 7 4.94 3.45|61809 45 58 7 6.63 4.3|61810 50 65 7 6.76 4.75|61811 55 72 9 9.04 6.4|61812 60 78 10 11.9 8.3|61813 65 85 10 12.4 9.15|61814 70 90 10 12.4 9.65|61815 75 95 10 12.7 10.4|61816 80 100 10 13 10.8',
    '619': '61900 10 22 6 2.7 1.27|61901 12 24 6 2.91 1.46|61902 15 28 7 4.36 2.24|61903 17 30 7 4.62 2.55|61904 20 37 9 6.37 3.65|61905 25 42 9 7.02 4.3|61906 30 47 9 7.28 4.55|61907 35 55 10 9.56 6.8|61908 40 62 12 13.8 10|61909 45 68 12 14 10.8|61910 50 72 12 14.6 11.8|61911 55 80 13 16.5 14|61912 60 85 13 16.5 14.3',
    'mini': '623 3 10 4 0.64 0.22|624 4 13 5 1.3 0.49|625 5 16 5 1.73 0.67|626 6 19 6 2.34 0.95|627 7 22 7 3.45 1.37|628 8 24 8 3.9 1.66|629 9 26 8 4.75 1.96|634 4 16 5 1.73 0.67|635 5 19 6 2.34 0.95|607 7 19 6 2.34 0.95|608 8 22 7 3.45 1.37|609 9 24 7 3.9 1.66|693 3 8 3 0.56 0.18 4|694 4 11 4 0.96 0.35|695 5 13 4 1.08 0.43|696 6 15 5 1.48 0.56|697 7 17 5 1.61 0.71|698 8 19 6 2.24 0.9|699 9 20 6 2.5 1.05|683 3 7 2 0.39 0.13 3|684 4 9 2.5 0.64 0.23 4|685 5 11 3 0.71 0.28 5|686 6 13 3.5 1.08 0.44 5|687 7 14 3.5 1.17 0.51 5|688 8 16 4 1.6 0.71 5|689 9 17 4 1.72 0.82 5',
    'MR': 'MR52 2 5 2 0.17 0.05 2.5|MR63 3 6 2 0.21 0.07 2.5|MR74 4 7 2 0.26 0.1 2.5|MR84 4 8 2 0.39 0.13 3|MR85 5 8 2 0.26 0.1 2.5|MR95 5 9 2.5 0.43 0.17 3|MR105 5 10 3 0.43 0.17 4|MR106 6 10 2.5 0.5 0.2 3|MR115 5 11 4 0.71 0.28|MR117 7 11 2.5 0.39 0.18 3|MR126 6 12 3 0.71 0.28 4|MR128 8 12 2.5 0.55 0.27 3.5|MR137 7 13 3 0.78 0.34 4|MR148 8 14 3.5 0.82 0.39 4',
    '302': '30203 17 40 13.25 22.4 20|30204 20 47 15.25 28.1 26.6|30205 25 52 16.25 32.5 33.5|30206 30 62 17.25 43.6 44|30207 35 72 18.25 54.2 56|30208 40 80 19.75 63 68|30209 45 85 20.75 67.6 76.5|30210 50 90 21.75 75 85|30211 55 100 22.75 90 100|30212 60 110 23.75 103 114',
    '303': '30302 15 42 14.25 22.8 21.6|30303 17 47 15.25 28.1 25|30304 20 52 16.25 33.5 32.5|30305 25 62 18.25 46.8 44|30306 30 72 20.75 59.4 60|30307 35 80 22.75 75.1 76.5|30308 40 90 25.25 90.4 96.5|30309 45 100 27.25 108 120|30310 50 110 29.25 130 140',
    '320': '32004 20 42 15 24.2 27.5|32005 25 47 15 27 32.5|32006 30 55 17 35.8 44|32007 35 62 18 42.9 54|32008 40 68 19 52.8 71|32009 45 75 20 58.3 78|32010 50 80 20 60.5 88',
    '511': '51100 10 24 9 10 14|51101 12 26 9 10.4 15.6|51102 15 28 9 10.6 16.6|51103 17 30 9 11.4 19.6|51104 20 35 10 15.9 25.5|51105 25 42 11 19.9 34.5|51106 30 47 11 20.8 38|51107 35 52 12 22.1 44|51108 40 60 13 27.6 56|51109 45 65 14 28.1 61|51110 50 70 14 29.1 65.5',
    '512': '51200 10 26 11 12.7 16.6|51201 12 28 11 13.3 18.3|51202 15 32 12 16.5 24.5|51203 17 35 12 17.2 27|51204 20 40 14 22.5 37.5|51205 25 47 15 27.6 47.5|51206 30 52 16 25.5 46.5|51207 35 62 18 35.1 67|51208 40 68 19 46.8 98|51209 45 73 20 39 80|51210 50 78 22 49.4 106',
    'NU2': 'NU204 20 47 14 25.1 22|NU205 25 52 15 28.6 27|NU206 30 62 16 44 36.5|NU207 35 72 17 56 48|NU208 40 80 18 62 53|NU209 45 85 19 69.5 64|NU210 50 90 20 73.5 69.5|NU211 55 100 21 96.5 95|NU212 60 110 22 108 102',
    'NU3': 'NU304 20 52 15 35.5 26|NU305 25 62 17 46.5 36.5|NU306 30 72 19 58.5 48|NU307 35 80 21 75 63|NU308 40 90 23 93 78|NU309 45 100 25 112 100|NU310 50 110 27 127 112'
  };
  const LOZISKA = [];
  for (const [rada, s] of Object.entries(DATA)) {
    for (const z of s.split('|')) {
      const [o, d, D, B, C, C0, Bk] = z.split(' ');
      LOZISKA.push({ o, rada, d: +d, D: +D, B: +B, C: +C, C0: +C0, Bk: Bk ? +Bk : null });
    }
  }
  const PODLE_OZN = new Map(LOZISKA.map(l => [l.o, l]));

  /* Odhad mezních otáček z n·dm (mazání tukem; kontaktní těsnění ~60 %). */
  function mezniOtacky(l, kontaktniTesneni) {
    const R = RODINY[l.rada];
    const k = R ? R.k : 500000;
    const n = Math.min(60000, k / ((l.d + l.D) / 2)) * (kontaktniTesneni ? 0.6 : 1);
    return n > 10000 ? zaokr(n, 1000) : zaokr(n, 100);
  }

  /* ---------- přípony ---------- */
  const PRIPONY = [
    // [regex, skupina, kód, popis, strany krytí / kontaktní]
    ['2RS1|2RSH|2RSR|2RSL|2RSN|2RS|LLU|DDU|2RU|EE', 'kryti', 'pryžové kontaktní těsnění na obou stranách (2RS) – chrání proti prachu i vodě, nižší mezní otáčky', 2, true],
    ['2RZ|LLB|2RSZ', 'kryti', 'bezkontaktní (labyrintové) pryžové těsnění na obou stranách – nízké tření', 2, false],
    ['RS1|RSH|RSR|RS|LU|DU', 'kryti', 'pryžové kontaktní těsnění na jedné straně (RS)', 1, true],
    ['RZ|LB', 'kryti', 'bezkontaktní pryžové těsnění na jedné straně', 1, false],
    ['2Z|ZZ', 'kryti', 'kovové krytky na obou stranách (2Z = ZZ) – chrání proti hrubé nečistotě, ne proti vodě; plné otáčky', 2, false],
    ['Z', 'kryti', 'kovová krytka na jedné straně (Z)', 1, false],
    ['NR', 'drazka', 'drážka pro pojistný kroužek na vnějším kroužku včetně kroužku (NR)'],
    ['N', 'drazka', 'drážka pro pojistný kroužek na vnějším kroužku (N)'],
    ['C2', 'vule', 'radiální vůle menší než normální (C2) – přesné uložení, malé teploty'],
    ['CN', 'vule', 'normální radiální vůle (CN – obvykle se neuvádí)'],
    ['C3', 'vule', 'radiální vůle větší než normální (C3) – elektromotory, pevná uložení, vyšší teploty'],
    ['C4', 'vule', 'radiální vůle větší než C3 (C4) – horké provozy, velký přesah'],
    ['C5', 'vule', 'radiální vůle větší než C4 (C5)'],
    ['P0', 'presnost', 'normální třída přesnosti ISO 0 (≈ ABEC 1, obvykle se neuvádí)'],
    ['P6', 'presnost', 'třída přesnosti ISO 6 (≈ ABEC 3)'],
    ['P5', 'presnost', 'třída přesnosti ISO 5 (≈ ABEC 5) – vřetena, přesné stroje'],
    ['P4', 'presnost', 'třída přesnosti ISO 4 (≈ ABEC 7)'],
    ['P2', 'presnost', 'třída přesnosti ISO 2 (≈ ABEC 9)'],
    ['ECP|ECJ|ECM|EC|E', 'provedeni', 'zesílené vnitřní provedení (E/EC) – vyšší únosnost; písmeno za ním = klec (P polyamid, J ocel, M mosaz)'],
    ['TN9|TNH|TN', 'klec', 'klec z polyamidu (TN9) – tichá, max. ~120 °C'],
    ['MA|MB|M', 'klec', 'masivní mosazná klec (M)'],
    ['J2|J', 'klec', 'lisovaná ocelová klec (J)'],
    ['Q', 'provedeni', 'optimalizovaná geometrie styku a povrch (Q)'],
    ['HT|GJN|LT|W64|VT378', 'mazivo', 'zvláštní plnění tukem (vysoké/nízké teploty, potravinářské…) – podle výrobce'],
    ['X', 'provedeni', 'rozměry upravené podle ISO (X)']
  ];
  const RE_PRIPONY = PRIPONY.map(p => [new RegExp('^(?:' + p[0] + ')'), p]);

  function rozeberPripony(text) {
    const vys = { kryti: null, drazka: null, vule: null, presnost: null, klec: null, provedeni: [], mazivo: null, nerozpoznano: '' };
    let s = text;
    while (s.length) {
      const m0 = s.match(/^[\s\-/.]+/);
      if (m0) { s = s.slice(m0[0].length); continue; }
      let shoda = null;
      for (const [re, p] of RE_PRIPONY) {
        const m = s.match(re);
        if (m) { shoda = { kod: m[0], p }; break; }
      }
      if (!shoda) { const m = s.match(/^[^\s\-/.]+/); vys.nerozpoznano += (vys.nerozpoznano ? ' ' : '') + m[0]; s = s.slice(m[0].length); continue; }
      const [, skup, popis, strany, kontaktni] = shoda.p;
      const z = { kod: shoda.kod, popis };
      if (skup === 'kryti') { z.strany = strany; z.kontaktni = kontaktni; vys.kryti = z; }
      else if (skup === 'provedeni') vys.provedeni.push(z);
      else vys[skup] = z;
      s = s.slice(shoda.kod.length);
    }
    return vys;
  }

  /* Kód díry → d: 00=10, 01=12, 02=15, 03=17, 04 a víc = ×5. */
  function dZKodu(kod) {
    const k = +kod;
    return [10, 12, 15, 17][k] != null && k < 4 ? [10, 12, 15, 17][k] : k * 5;
  }
  const RADY_OBECNE = ['618', '619', '160', '302', '303', '320', '322', '511', '512', '513', '60', '62', '63', '64'];

  function normOzn(s) { return String(s || '').toUpperCase().replace(/\s+/g, ' ').trim(); }

  /* Najde základní ložisko: vlastní položky, tabulka (s ustřihováním přebytečných číslic přípony), obecné řady podle kódu díry. */
  function dekoduj(vstup, vlastni) {
    const s = normOzn(vstup);
    const vys = { vstup: s, ok: false, poznamky: [] };
    if (!s) { vys.chyba = 'Zadejte označení, např. 6204-2RS C3.'; return vys; }
    for (const v of vlastni || []) {
      const o = normOzn(v.o);
      if (o && s.startsWith(o)) return doplnDekodovani(vys, Object.assign({ rada: v.rada || 'vlastni', vlastni: true }, v), s.slice(o.length), '');
    }
    const m = s.match(/^(MR|NUP|NU|NJ|NF|N)?\s?(\d+)(.*)$/);
    if (!m) { vys.chyba = 'Označení musí začínat číslem (6204, 608…) nebo předponou MR, NU, NJ, NUP, N.'; return vys; }
    let [, pred, cisla, zbytek] = m;
    pred = pred || '';
    const valeckove = pred && pred !== 'MR';
    for (let k = cisla.length; k >= 3; k--) {
      let klic = cisla.slice(0, k);
      if (!pred && k === 4 && /^6[89]\d\d$/.test(klic)) { vys.poznamky.push(`${klic} je starší označení řady 61${klic.slice(1)}.`); klic = '61' + klic.slice(1); }
      /* ustřihnout smí jen „2“ z přípony 2RS/2Z (62042RS), jinak by 6230 spadlo na 623 */
      if (k < cisla.length && !(cisla.slice(k) === '2' && /^[A-Z]/.test(zbytek))) continue;
      const tab = PODLE_OZN.get((pred === 'MR' ? 'MR' : valeckove ? 'NU' : '') + klic);
      if (tab) return doplnDekodovani(vys, tab, cisla.slice(k) + zbytek, pred);
    }
    if (!pred) {
      for (const r of RADY_OBECNE) {
        if (cisla.startsWith(r) && cisla.length >= r.length + 2) {
          const kod = cisla.slice(r.length, r.length + 2);
          const d = dZKodu(kod);
          const fam = RODINY[r] ? r : null;
          const l = { o: r + kod, rada: fam || r, d, D: null, B: null, C: null, C0: null, obecne: true };
          vys.poznamky.push(`Rozměr ${r}${kod} není v tabulce – z kódu díry plyne jen d = ${d} mm; D, B a únosnost dohledejte v katalogu.`);
          return doplnDekodovani(vys, l, cisla.slice(r.length + 2) + zbytek, '', r);
        }
      }
    }
    vys.chyba = `Označení „${s}“ nepoznávám. Podporované řady: 60, 62, 63, 160, 618/68, 619/69, miniaturní 6xx a MR, kuželíkové 302/303/320, axiální 511/512, válečkové NU/NJ/NUP/N 2xx a 3xx.`;
    return vys;
  }

  function doplnDekodovani(vys, l, priponyText, pred, radaObecna) {
    const pr = rozeberPripony(priponyText);
    const fam = RODINY[l.rada];
    const typ = fam ? fam.typ : (l.typ || (/^3[02]/.test(radaObecna || '') ? 'kuzelikove' : /^51/.test(radaObecna || '') ? 'axialni' : 'kulickove'));
    Object.assign(vys, {
      ok: true, zaklad: (pred && pred !== 'MR' ? pred + l.o.replace(/^NU/, '') : l.o), rada: l.rada, vlastni: !!l.vlastni, obecne: !!l.obecne,
      rodina: fam ? fam.nazev : (l.vlastni ? 'Vlastní položka' : 'Řada ' + (radaObecna || l.rada)),
      typ, typNazev: TYPY[typ].nazev, zatizeni: TYPY[typ].zatizeni, sirkaPopis: TYPY[typ].sirka || 'B (šířka)', p: TYPY[typ].p,
      d: l.d, D: l.D, B: l.B, C: l.C, C0: l.C0, pripony: pr, predpona: pred && pred !== 'MR' ? PREDPONY[pred] : null
    });
    if (pr.kryti && l.Bk) { vys.B = l.Bk; vys.poznamky.push(`Krytá verze je širší: ${fmt(l.Bk)} mm (otevřená ${fmt(l.B)} mm).`); }
    if (l.D) vys.nMez = l.n || mezniOtacky(l, pr.kryti && pr.kryti.kontaktni);
    if (pr.kryti && typ !== 'kulickove') vys.poznamky.push('Krytí se u tohoto typu ložiska běžně nevyrábí – zkontrolujte označení.');
    if (pr.nerozpoznano) vys.poznamky.push(`Nerozpoznaná přípona: ${pr.nerozpoznano} (výrobce může mít vlastní značení).`);
    return vys;
  }

  /* Hledání podle rozměrů: d a D přesně (nebo rozsah), B nejvýš Bmax. */
  function najdiLoziska(f, vlastni) {
    const sez = LOZISKA.concat((vlastni || []).map(v => Object.assign({ rada: 'vlastni', vlastni: true }, v)));
    const shodne = (a, b) => b == null || b === '' || Math.abs(a - b) < 0.01;
    return sez.filter(l => shodne(l.d, f.d) && shodne(l.D, f.D) && (f.Dmax == null || f.Dmax === '' || l.D <= f.Dmax) &&
      (f.Bmax == null || f.Bmax === '' || l.B <= f.Bmax + 1e-9) && (!f.typ || (RODINY[l.rada] ? RODINY[l.rada].typ : l.typ || 'kulickove') === f.typ))
      .map(l => Object.assign({}, l, { typ: RODINY[l.rada] ? RODINY[l.rada].typ : l.typ || 'kulickove', nMez: l.n || mezniOtacky(l, false) }))
      .sort((a, b) => a.d - b.d || a.D - b.D || a.B - b.B);
  }

  /* ---------- trvanlivost ---------- */
  function trvanlivost({ C, P, n, p }) {
    if (!(C > 0) || !(P > 0)) return null;
    const L10 = Math.pow(C / P, p || 3);
    return { L10, Lh: n > 0 ? L10 * 1e6 / (60 * n) : null, CP: C / P };
  }
  function potrebneC({ P, n, Lh, p }) {
    if (!(P > 0) || !(n > 0) || !(Lh > 0)) return null;
    return P * Math.pow(Lh * 60 * n / 1e6, 1 / (p || 3));
  }
  /* Doporučená trvanlivost podle druhu stroje (orientační, katalogy výrobců). */
  const DOPORUCENA_LH = [
    ['Domácí spotřebiče, ruční nářadí, občasný provoz', '300–3 000 h'],
    ['Krátkodobý / přerušovaný provoz (zdvihadla, ruční stroje)', '3 000–8 000 h'],
    ['Stroje 8 h denně, ne plně vytížené (převodovky, elektromotory)', '10 000–25 000 h'],
    ['Stroje 8 h denně, plně vytížené (obráběcí stroje, dopravníky)', '20 000–30 000 h'],
    ['Nepřetržitý provoz 24 h (čerpadla, kompresory, ventilátory)', '40 000–50 000 h'],
    ['Nepřetržitý provoz s vysokou spolehlivostí (vodárny, elektrárny)', '60 000–100 000 h']
  ];

  /* ---------- uložení ---------- */
  function ulozeni({ d, rotuje, zatizeni, typ }) {
    d = +d || 0; rotuje = rotuje || 'hridel'; zatizeni = zatizeni || 'normalni';
    const valec = typ === 'valeckove' || typ === 'kuzelikove';
    let hridel, dira, pozn = [];
    if (typ === 'axialni') {
      return { hridel: 'j6 (k6)', dira: 'H8 (volně, tělesový kroužek se nesmí radiálně opírat)', pozn: ['Axiální ložisko nenese radiální síly – radiálně vede hřídel jiné ložisko.'] };
    }
    if (rotuje === 'hridel') {
      const t = {
        lehke: d <= 18 ? 'h5' : d <= 100 ? 'j6' : 'k6',
        normalni: d <= 18 ? 'j5' : d <= 100 ? (valec ? 'k6' : 'k5') : (valec ? 'm6' : 'm5'),
        tezke: d <= 18 ? 'k5' : d <= 100 ? (valec ? 'n6' : 'm5') : (valec ? 'p6' : 'm6')
      };
      hridel = t[zatizeni];
      dira = 'H7 (volné ložisko se může posouvat), J7 – přesnější radiální vedení';
      pozn.push('Vnitřní kroužek obíhá vůči zatížení → pevné uložení na hřídeli, vnější kroužek v tělese s vůlí/přechodně.');
      if (zatizeni === 'tezke') pozn.push('Při velkém přesahu volte ložisko s vůlí C3.');
    } else {
      hridel = 'g6 (volné) / h6';
      dira = { lehke: 'M7', normalni: 'N7', tezke: 'P7' }[zatizeni];
      pozn.push('Vnější kroužek obíhá vůči zatížení (náboj kola, kladka na čepu) → pevné uložení v tělese, vnitřní kroužek na čepu volně.');
    }
    pozn.push('Pro 3D tisk: díra pro ložisko obvykle D − 0,05 až −0,1 mm (zalisování) nebo D + 0,1 mm (volně), podle tiskárny – vyzkoušejte zkušební kroužek.');
    return { hridel, dira, pozn };
  }

  /* ---------- O-kroužky ---------- */
  const IN = 25.4;
  /* AS568 (ISO 3601-1 palcová řada) – vnitřní průměry ve skocích po 1/16", 1/8", 1/4" podle čísla. */
  function as568() {
    const r = [];
    const pridej = (n, idPalce, cs) => r.push({ k: 'AS568-' + String(n).padStart(3, '0'), d1: Math.round(idPalce * IN * 100) / 100, d2: cs, rada: 'AS568' });
    [0.070, 0.101, 0.114, 0.145, 0.176, 0.208, 0.239].forEach((x, i) => pridej(4 + i, x, 1.78));
    for (let n = 11; n <= 28; n++) pridej(n, 0.301 + (n - 11) * 0.0625, 1.78);
    for (let n = 29; n <= 41; n++) pridej(n, 1.489 + (n - 29) * 0.125, 1.78);
    for (let n = 42; n <= 50; n++) pridej(n, 3.239 + (n - 42) * 0.25, 1.78);
    [0.049, 0.081, 0.112, 0.143, 0.174, 0.206, 0.237].forEach((x, i) => pridej(102 + i, x, 2.62));
    for (let n = 109; n <= 150; n++) pridej(n, 0.299 + (n - 109) * 0.0625, 2.62);
    for (let n = 151; n <= 178; n++) pridej(n, 3.112 + (n - 151) * 0.25, 2.62);
    for (let n = 201; n <= 222; n++) pridej(n, 0.171 + (n - 201) * 0.0625, 3.53);
    for (let n = 223; n <= 258; n++) pridej(n, 1.609 + (n - 223) * 0.125, 3.53);
    for (let n = 309; n <= 324; n++) pridej(n, 0.412 + (n - 309) * 0.0625, 5.33);
    for (let n = 325; n <= 349; n++) pridej(n, 1.475 + (n - 325) * 0.125, 5.33);
    return r;
  }
  /* Běžné metrické rozměry d1 × d2 (sortimenty prodejců; dostupnost se liší). */
  const METR_D1 = [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 32, 34, 35, 36, 38, 40, 42, 44, 45, 46, 48, 50, 52, 55, 56, 58, 60, 62, 63, 65, 68, 70, 72, 75, 78, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 160, 170, 180, 190, 200];
  const METR_D2 = [[1, 2, 20], [1.5, 2, 40], [2, 3, 80], [2.5, 5, 100], [3, 8, 150], [3.5, 10, 200], [4, 15, 200], [5, 25, 200], [6, 40, 200]];
  function metricke() {
    const r = [];
    for (const [d2, od, doo] of METR_D2) for (const d1 of METR_D1) if (d1 >= od && d1 <= doo) r.push({ k: `${fmt(d1)}×${fmt(d2)}`, d1, d2, rada: 'metrické' });
    return r;
  }
  const OKROUZKY = as568().concat(metricke()).map(o => (o.k.startsWith('AS') ? Object.assign(o, { k: o.k + ` (${fmt(o.d1)}×${fmt(o.d2)})` }) : o));

  const MEZE = {
    staticke: { stlaceni: [15, 30], cil: 22 },
    dynamicke: { stlaceni: [10, 20], cil: 15 },
    celni: { stlaceni: [15, 30], cil: 25 },
    vyplneni: [70, 85], vyplneniCil: 77,
    protazeni: [1, 5], protazeniCil: 2.5
  };

  /* Vyhodnocení dané drážky: typ pist (drážka na pístu, těsní v díře Ø prumer), tyc (drážka v tělese, těsní na tyči Ø prumer),
     celni (čelní drážka, vnitřní tlak – prumer = vnější Ø drážky). t = hloubka drážky vč. vůle (stěna–dno), b = šířka. */
  function vyhodnotDrazku({ typ, rezim, prumer, t, b, d1, d2 }) {
    const vys = { typ, rezim, prumer, t, b, d1, d2, varovani: [] };
    let protazeni;
    if (typ === 'pist') { vys.dno = prumer - 2 * t; protazeni = (vys.dno - d1) / d1 * 100; }
    else if (typ === 'tyc') { vys.dno = prumer + 2 * t; protazeni = (prumer - d1) / d1 * 100; }
    else { vys.dno = prumer - 2 * b; vys.obvodStlaceni = ((d1 + 2 * d2) - prumer) / (d1 + 2 * d2) * 100; protazeni = 0; }
    vys.protazeni = protazeni;
    vys.d2ef = protazeni > 0 ? d2 / Math.sqrt(1 + protazeni / 100) : d2;
    vys.stlaceni = (vys.d2ef - t) / vys.d2ef * 100;
    vys.vyplneni = Math.PI * vys.d2ef * vys.d2ef / 4 / (b * t) * 100;
    const ms = typ === 'celni' ? MEZE.celni.stlaceni : MEZE[rezim === 'dynamicke' ? 'dynamicke' : 'staticke'].stlaceni;
    vys.mezeStlaceni = ms;
    const v = vys.varovani;
    if (vys.stlaceni < ms[0]) v.push(`Stlačení ${fmt(vys.stlaceni, 1)} % je pod ${ms[0]} % – hrozí netěsnost (zmenšete hloubku drážky).`);
    if (vys.stlaceni > ms[1]) v.push(`Stlačení ${fmt(vys.stlaceni, 1)} % je nad ${ms[1]} % – kroužek se trvale zdeformuje${rezim === 'dynamicke' ? ', velké tření' : ''} (zvětšete hloubku).`);
    if (vys.vyplneni < MEZE.vyplneni[0]) v.push(`Vyplnění ${fmt(vys.vyplneni, 1)} % je pod ${MEZE.vyplneni[0]} % – kroužek se v drážce posouvá (zužte drážku).`);
    if (vys.vyplneni > MEZE.vyplneni[1]) v.push(`Vyplnění ${fmt(vys.vyplneni, 1)} % je nad ${MEZE.vyplneni[1]} % – málo místa na bobtnání a teplotní roztažnost (rozšiřte drážku).`);
    if (vys.vyplneni > 100) v.push('Kroužek se do drážky vůbec nevejde!');
    if (typ === 'pist') {
      if (protazeni < MEZE.protazeni[0]) v.push(`Protažení ${fmt(protazeni, 1)} % – kroužek ${protazeni < 0 ? 'je na dně drážky volný' : 'drží slabě'}; doporučeno ${MEZE.protazeni[0]}–${MEZE.protazeni[1]} %.`);
      if (protazeni > MEZE.protazeni[1]) v.push(`Protažení ${fmt(protazeni, 1)} % je nad ${MEZE.protazeni[1]} % – průřez se zúží a kroužek rychleji stárne.`);
    } else if (typ === 'tyc') {
      if (protazeni < 0) v.push(`Vnitřní průměr kroužku je větší než tyč (${fmt(protazeni, 1)} %) – kroužek nedosedne, volte menší.`);
      if (protazeni > 3) v.push(`Kroužek je na tyči natažený o ${fmt(protazeni, 1)} % – u tyčového těsnění volte d1 ≈ průměr tyče (0–3 %).`);
    } else {
      if (vys.obvodStlaceni < 0) v.push('Vnější průměr kroužku je menší než vnější Ø drážky – při vnitřním tlaku se kroužek posouvá; volte větší nebo zmenšete drážku.');
      if (vys.obvodStlaceni > 3) v.push(`Kroužek je po obvodu stlačený o ${fmt(vys.obvodStlaceni, 1)} % (doporučeno 0–3 %) – může se zvlnit.`);
    }
    vys.ok = !v.length;
    return vys;
  }

  /* Návrh drážky pro daný kroužek: hloubka z cílového stlačení, šířka z cílového vyplnění. */
  function navrhDrazky({ typ, rezim, prumer, d1, d2 }) {
    let protazeni = 0;
    if (typ === 'tyc') protazeni = (prumer - d1) / d1 * 100;
    const cil = typ === 'celni' ? MEZE.celni.cil : MEZE[rezim === 'dynamicke' ? 'dynamicke' : 'staticke'].cil;
    let t = 0, b = 0;
    /* u pístu závisí protažení na hloubce – dvakrát dopočítat */
    for (let i = 0; i < 3; i++) {
      const d2ef = protazeni > 0 ? d2 / Math.sqrt(1 + protazeni / 100) : d2;
      t = zaokr(d2ef * (1 - cil / 100), 0.05);
      b = zaokr(Math.PI * d2ef * d2ef / 4 / (MEZE.vyplneniCil / 100 * t), 0.05);
      if (typ === 'pist') protazeni = ((prumer - 2 * t) - d1) / d1 * 100;
    }
    return vyhodnotDrazku({ typ, rezim, prumer, t: +t.toFixed(2), b: +b.toFixed(2), d1, d2 });
  }

  /* Najde kroužky pro průměr díry (pist), tyče (tyc) nebo vnější Ø čelní drážky (celni). */
  function najdiOkrouzky({ typ, rezim, prumer, d2, rada, max }) {
    if (!(prumer > 0)) return [];
    const kand = [];
    for (const o of OKROUZKY) {
      if (d2 && Math.abs(o.d2 - d2) > 0.01) continue;
      if (rada && o.rada !== rada) continue;
      if (typ === 'pist' && (o.d1 > prumer || o.d1 + 2 * o.d2 < prumer * 0.9)) continue;
      if (typ === 'tyc' && (o.d1 > prumer * 1.01 || o.d1 < prumer * 0.9)) continue;
      if (typ === 'celni' && Math.abs(o.d1 + 2 * o.d2 - prumer) > prumer * 0.06 + 0.5) continue;
      if (o.d2 > prumer / 3 && typ !== 'celni') continue;
      const n = navrhDrazky({ typ, rezim, prumer, d1: o.d1, d2: o.d2 });
      const odchylka = typ === 'pist' ? Math.abs(n.protazeni - MEZE.protazeniCil) : typ === 'tyc' ? Math.abs(n.protazeni - 1) : Math.abs(n.obvodStlaceni - 1.5);
      kand.push(Object.assign(n, { krouzek: o, skore: (n.ok ? 0 : 10) + odchylka }));
    }
    return kand.sort((a, b) => a.skore - b.skore || b.d2 - a.d2).slice(0, max || 15);
  }

  const MATERIALY = [
    { k: 'NBR', nazev: 'NBR (nitrilkaučuk, Perbunan)', tep: [-30, 100], dobre: 'minerální oleje a tuky, nafta, benzin, hydraulické kapaliny HL/HLP, voda do 80 °C', spatne: 'ozon a UV (venku praská), brzdová kapalina DOT, ketony, silné kyseliny', pozn: 'nejběžnější a nejlevnější; tvrdost 70 ShA, pro vysoké tlaky 90 ShA' },
    { k: 'HNBR', nazev: 'HNBR (hydrogenovaný nitril)', tep: [-30, 150], dobre: 'oleje, chladiva, ozon lépe než NBR, otěr', spatne: 'ketony, aromáty, silné kyseliny', pozn: 'automobilový průmysl, klimatizace' },
    { k: 'FKM', nazev: 'FKM (fluorkaučuk, Viton®)', tep: [-20, 200], dobre: 'oleje i za tepla, paliva, kyseliny, ozon, vakuum', spatne: 'horká voda a pára, ketony, estery, brzdová kapalina, čpavek', pozn: 'drahý; v zimě tvrdne (pod −20 °C netěsní)' },
    { k: 'EPDM', nazev: 'EPDM (ethylen-propylen)', tep: [-45, 150], dobre: 'voda, pára, ozon a povětrnost, brzdová kapalina DOT, alkoholy, louhy', spatne: 'minerální oleje a tuky, paliva – bobtná!', pozn: 'vodovody, topení, venkovní použití' },
    { k: 'VMQ', nazev: 'VMQ (silikon)', tep: [-60, 200], dobre: 'teplo i mráz, potraviny a pitná voda, ozon', spatne: 'otěr a dynamické těsnění, pára, paliva, nízká pevnost', pozn: 'statická těsnění, potravinářství (s atestem)' },
    { k: 'PTFE', nazev: 'PTFE (teflon)', tep: [-200, 260], dobre: 'téměř všechny chemikálie, nízké tření', spatne: 'není pružný – teče za studena; potřebuje dělenou drážku nebo pryžový předpínací kroužek', pozn: 'do běžné uzavřené drážky nenamontujete; použijte obalený kroužek (FEP/PTFE s jádrem FKM/VMQ)' }
  ];

  /* ---------- gufera (DIN 3760 / ISO 6194) ---------- */
  const GUFERA = ('10x22x7 10x26x7 12x22x7 12x24x7 12x28x7 14x24x7 15x24x7 15x26x7 15x30x7 15x32x7 16x28x7 17x28x7 17x30x7 17x32x7 17x35x7 18x30x7 20x30x7 20x32x7 20x35x7 20x40x7 20x42x7 20x47x7 22x32x7 22x35x7 22x40x7 22x47x7 25x35x7 25x40x7 25x42x7 25x47x7 25x52x7 28x40x7 28x47x7 30x40x7 30x42x7 30x47x7 30x52x7 30x62x7 32x45x8 32x47x8 32x52x8 35x47x7 35x50x7 35x52x7 35x62x7 38x52x8 38x55x8 38x62x8 40x52x7 40x55x8 40x62x8 40x72x8 42x55x8 42x62x8 45x60x8 45x62x8 45x65x8 45x72x8 48x62x8 48x72x8 50x65x8 50x68x8 50x72x8 50x80x8 55x70x8 55x72x8 55x80x8 60x75x8 60x80x8 60x85x8 65x85x10 65x90x10 70x90x10 70x100x10 75x95x10 75x100x10 80x100x10 80x110x10 85x110x12 90x110x12 90x120x12 95x120x12 100x120x12 100x125x12 110x130x12 120x150x12')
    .split(' ').map(s => { const [d, D, b] = s.split('x').map(Number); return { k: s.replace(/x/g, '×'), d, D, b }; });
  const GUFERA_TYPY = [
    ['A', 'jeden těsnicí břit s pružinou, plášť pryžový (pryž na vnějším průměru těsní v tělese, odpouští drsnější díru)'],
    ['AS', 'jako A + prachový břit bez pružiny – do prašného prostředí; mezi břity naplnit tukem'],
    ['B / BS', 'kovový vnější plášť – přesnější usazení, ale díra musí mít Ra ≤ 1,6 µm (jinak tmelit)'],
    ['C / CS', 'kovový plášť se zesílením – velké průměry, tuhé usazení']
  ];
  const GUFERA_RADY = [
    'Hřídel: drsnost Ra 0,2–0,8 µm (Rz 1–5 µm), bez spirálových stop po soustružení – zapichovací broušení; tvrdost ≥ 45 HRC (nad 4 m/s ≥ 55 HRC).',
    'Hřídel tolerance h11, díra v tělese H8 (Ra 1,6–6,3 µm pro pryžový plášť).',
    'Náběh na hřídeli 15–25° a zaoblené hrany – břit se při montáži nesmí přetáhnout přes ostrou hranu nebo drážku pera (použijte montážní pouzdro).',
    'Břit natřít tukem; pružina směřuje k těsněnému médiu (oleji). Standardní gufero snese přetlak nejvýš ~0,5 bar.',
    'Šířka zástavbového prostoru = b + 0,3 mm; při výměně posunout místo běhu břitu o 0,5–1 mm (stará stopa).'
  ];
  const GUFERA_MATERIALY = [
    { k: 'NBR', vMax: 12, tep: [-40, 100], pozn: 'oleje, tuky – standard' },
    { k: 'FKM', vMax: 30, tep: [-25, 200], pozn: 'vysoké otáčky a teploty, syntetické oleje' },
    { k: 'ACM', vMax: 15, tep: [-25, 150], pozn: 'motorové a převodové oleje za tepla' },
    { k: 'VMQ', vMax: 20, tep: [-50, 180], pozn: 'mráz i teplo, ne pro otěr a paliva' },
    { k: 'PTFE', vMax: 30, tep: [-80, 200], pozn: 'chemie, chod nasucho, bez pružiny' }
  ];
  function obvodovaRychlost(d, n) { return Math.PI * d * n / 60000; }
  function najdiGufera({ d, D, b }) {
    const ok = (a, x) => x == null || x === '' || Math.abs(a - x) < 0.01;
    return GUFERA.filter(g => ok(g.d, d) && ok(g.D, D) && (b == null || b === '' || g.b <= b)).sort((a, c) => a.d - c.d || a.D - c.D);
  }

  /* ---------- náčrty SVG (barvy přes currentColor; při stažení se nahradí černou) ---------- */
  function sipka(x, y, uhel) {
    const a = 0.35, l = 8;
    const p = [[x, y], [x - l * Math.cos(uhel - a), y - l * Math.sin(uhel - a)], [x - l * Math.cos(uhel + a), y - l * Math.sin(uhel + a)]];
    return `<polygon points="${p.map(q => q.map(v => v.toFixed(1)).join(',')).join(' ')}" fill="currentColor"/>`;
  }
  /* kóta mezi body (x1,y1)–(x2,y2) s textem, vynášecí čáry řeší volající */
  function kota(x1, y1, x2, y2, text, svisle) {
    const u = Math.atan2(y2 - y1, x2 - x1);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const t = svisle ? `<text x="${(mx - 5).toFixed(1)}" y="${my.toFixed(1)}" transform="rotate(-90 ${(mx - 5).toFixed(1)} ${my.toFixed(1)})" text-anchor="middle" font-size="12">${text}</text>`
      : `<text x="${mx.toFixed(1)}" y="${(my - 5).toFixed(1)}" text-anchor="middle" font-size="12">${text}</text>`;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="currentColor" stroke-width="0.8"/>` +
      sipka(x2, y2, u) + sipka(x1, y1, u + Math.PI) + t;
  }
  const VYNAS = (x1, y1, x2, y2) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="currentColor" stroke-width="0.5"/>`;
  const SRAF = id => `<defs><pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" stroke-width="0.7"/></pattern></defs>`;
  const obd = (x, y, w, h, vypln) => `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${vypln}" stroke="currentColor" stroke-width="1.4"/>`;

  /* Řez ložiskem (osa vodorovně, horní a dolní polovina), kóty Ø d, Ø D, B. */
  function svgLozisko(l) {
    if (!l || !l.D) return '';
    const s = 240 / l.D, B = l.B * s, R = l.D / 2 * s, r = l.d / 2 * s;
    const ox = 110, oy = 30 + R, x0 = ox, x1 = ox + B, sirka = x1 + 70, vyska = 2 * R + 70;
    const dm = (R + r) / 2, h = R - r, Dw = h * 0.55;
    const ri = dm - Dw * 0.42, re = dm + Dw * 0.42;
    let g = '';
    for (const zn of [-1, 1]) {
      const y = v => oy + zn * v;
      const rect = (ra, rb, xa, xb) => obd(xa, Math.min(y(ra), y(rb)), xb - xa, Math.abs(rb - ra), 'url(#srafL)');
      if (l.typ === 'axialni') {
        const tl = B * 0.32;
        g += rect(r, dm + Dw * 0.6, x0, x0 + tl);              // hřídelový kroužek
        g += rect(dm - Dw * 0.6, R, x1 - tl, x1);              // tělesový kroužek
        g += `<circle cx="${((x0 + x1) / 2).toFixed(1)}" cy="${y(dm).toFixed(1)}" r="${Math.min((B - 2 * tl) / 2 + 1, Dw / 2).toFixed(1)}" fill="none" stroke="currentColor" stroke-width="1.4"/>`;
      } else {
        g += rect(r, ri, x0, x1) + rect(re, R, x0, x1);
        if (l.typ === 'kulickove') g += `<circle cx="${((x0 + x1) / 2).toFixed(1)}" cy="${y(dm).toFixed(1)}" r="${Math.min(Dw / 2 * 1.15, B / 2 * 0.85).toFixed(1)}" fill="none" stroke="currentColor" stroke-width="1.4"/>`;
        else if (l.typ === 'valeckove') g += obd(x0 + B * 0.18, Math.min(y(ri), y(re)), B * 0.64, re - ri, 'none');
        else {
          const a = 0.12 * zn, cx = (x0 + x1) / 2, cy = y(dm), w = B * 0.6, hh = (re - ri) * 1.05;
          g += `<rect x="${(cx - w / 2).toFixed(1)}" y="${(cy - hh / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}" fill="none" stroke="currentColor" stroke-width="1.4" transform="rotate(${(-a * 180 / Math.PI * 1.5).toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`;
        }
        if (l.kryti) for (const xx of [x0 + 1.5, x1 - 1.5].slice(0, l.kryti.strany === 1 ? 1 : 2)) g += `<line x1="${xx.toFixed(1)}" y1="${y(ri).toFixed(1)}" x2="${xx.toFixed(1)}" y2="${y(re).toFixed(1)}" stroke="currentColor" stroke-width="${l.kryti.kontaktni ? 2.6 : 1.4}"/>`;
      }
    }
    // osa
    g += `<line x1="${(x0 - 25).toFixed(1)}" y1="${oy}" x2="${(x1 + 25).toFixed(1)}" y2="${oy}" stroke="currentColor" stroke-width="0.6" stroke-dasharray="12 3 2 3"/>`;
    // kóty Ø D a Ø d vlevo, B nahoře
    const kD = x0 - 60, kd = x0 - 30;
    g += VYNAS(x0 - 2, oy - R, kD - 6, oy - R) + VYNAS(x0 - 2, oy + R, kD - 6, oy + R);
    g += kota(kD, oy + R, kD, oy - R, 'Ø ' + fmt(l.D) + (l.Dtol ? ' ' + l.Dtol : ''), true);
    g += VYNAS(x0 - 2, oy - r, kd - 6, oy - r) + VYNAS(x0 - 2, oy + r, kd - 6, oy + r);
    g += kota(kd, oy + r, kd, oy - r, 'Ø ' + fmt(l.d) + (l.dtol ? ' ' + l.dtol : ''), true);
    g += VYNAS(x0, oy - R - 2, x0, oy - R - 22) + VYNAS(x1, oy - R - 2, x1, oy - R - 22);
    g += kota(x0, oy - R - 16, x1, oy - R - 16, fmt(l.B), false);
    if (l.nazev) g += `<text x="${(sirka / 2).toFixed(1)}" y="${(vyska - 8).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="600">${l.nazev}</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${Math.min(0, kD - 30).toFixed(0)} 0 ${(sirka - Math.min(0, kD - 30)).toFixed(0)} ${vyska.toFixed(0)}" font-family="sans-serif" fill="currentColor">${SRAF('srafL')}${g}</svg>`;
  }

  /* Řez drážkou O-kroužku: protikus nahoře (u čelní drážky víko), tělo s drážkou dole; kroužek stlačený (elipsa se zachovanou plochou). */
  function svgDrazka(n) {
    if (!n || !(n.t > 0) || !(n.b > 0)) return '';
    const s = 150 / Math.max(n.b * 1.8, n.d2 * 2.2), t = n.t * s, b = n.b * s;
    const x0 = 90, okraj = b * 0.9, y0 = 70, sirkaTela = okraj * 2 + b, vyska = y0 + t + 70;
    const ry = n.t / 2 * s, rx = Math.min(b / 2, n.d2ef * n.d2ef / (2 * n.t) * s / 2);
    let g = '';
    g += obd(x0 - 10, y0 - 40, sirkaTela + 20, 40, 'url(#srafD)');          // protikus
    g += `<path d="M${x0},${y0} h${okraj.toFixed(1)} v${t.toFixed(1)} h${b.toFixed(1)} v${(-t).toFixed(1)} h${okraj.toFixed(1)} v${(t + 35).toFixed(1)} h${(-sirkaTela).toFixed(1)} z" fill="url(#srafD)" stroke="currentColor" stroke-width="1.4"/>`;
    // tlak tlačí kroužek k jedné stěně
    const cx = x0 + okraj + b - rx, cy = y0 + t / 2;
    g += `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="currentColor" fill-opacity="0.35" stroke="currentColor" stroke-width="1.4"/>`;
    // kóty: t vpravo, b dole
    const xk = x0 + sirkaTela + 30;
    g += VYNAS(x0 + okraj + b, y0 + t, xk + 6, y0 + t) + VYNAS(x0 + sirkaTela, y0, xk + 6, y0);
    g += kota(xk, y0 + t, xk, y0, 't ' + fmt(n.t), true);
    const yk = y0 + t + 22;
    g += VYNAS(x0 + okraj, y0 + t, x0 + okraj, yk + 6) + VYNAS(x0 + okraj + b, y0 + t, x0 + okraj + b, yk + 6);
    g += kota(x0 + okraj, yk, x0 + okraj + b, yk, 'b ' + fmt(n.b), false);
    const popis = { pist: ['díra Ø ' + fmt(n.prumer), 'píst, dno drážky Ø ' + fmt(n.dno)], tyc: ['tyč Ø ' + fmt(n.prumer), 'těleso, dno drážky Ø ' + fmt(n.dno)], celni: ['víko / příruba', `drážka Ø ${fmt(n.prumer)} / Ø ${fmt(n.dno)}`] }[n.typ];
    g += `<text x="${(x0 - 14).toFixed(1)}" y="${(y0 - 16).toFixed(1)}" text-anchor="end" font-size="12">${popis[0]}</text>`;
    g += `<text x="${(x0 - 14).toFixed(1)}" y="${(y0 + 26).toFixed(1)}" text-anchor="end" font-size="12">${popis[1]}</text>`;
    g += `<text x="${(x0 + sirkaTela / 2).toFixed(1)}" y="${(vyska - 6).toFixed(1)}" text-anchor="middle" font-size="12">O-kroužek ${fmt(n.d1)} × ${fmt(n.d2)} · stlačení ${fmt(n.stlaceni, 1)} % · vyplnění ${fmt(n.vyplneni, 1)} %</text>`;
    const sirka = xk + 30;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-130 0 ${(sirka + 130).toFixed(0)} ${vyska.toFixed(0)}" font-family="sans-serif" fill="currentColor">${SRAF('srafD')}${g}</svg>`;
  }

  /* ---------- STL: rotační těleso z uzavřeného profilu (r, z), body na ose (r = 0) se slijí ---------- */
  function rotacni(profil, segmentu) {
    const n = segmentu || 96;
    let pl = 0;
    for (let i = 0; i < profil.length; i++) { const a = profil[i], b = profil[(i + 1) % profil.length]; pl += a[0] * b[1] - b[0] * a[1]; }
    const pr = pl > 0 ? profil : profil.slice().reverse();      // proti směru hodin v rovině (r, z)
    const poz = [], idx = [], id = [];
    for (const [r, z] of pr) {
      if (r < 1e-9) { id.push([poz.length / 3]); poz.push(0, 0, z); continue; }
      const rada = [];
      for (let i = 0; i < n; i++) { const u = 2 * Math.PI * i / n; rada.push(poz.length / 3); poz.push(r * Math.cos(u), r * Math.sin(u), z); }
      id.push(rada);
    }
    const v = (k, i) => id[k].length === 1 ? id[k][0] : id[k][i % n];
    for (let k = 0; k < pr.length; k++) {
      const k2 = (k + 1) % pr.length;
      if (id[k].length === 1 && id[k2].length === 1) continue;
      for (let i = 0; i < n; i++) {
        const a = v(k, i), b = v(k, i + 1), c = v(k2, i + 1), d = v(k2, i);
        if (id[k].length > 1) idx.push(a, b, d);
        if (id[k2].length > 1) idx.push(b, c, d);
      }
    }
    return { poz: new Float32Array(poz), idx: new Uint32Array(idx) };
  }
  function kontrolaSite(sit) {
    const { poz, idx } = sit, hrany = new Map();
    let objem = 0, chyb = 0;
    for (let t = 0; t < idx.length; t += 3) {
      const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
      const A = [poz[a * 3], poz[a * 3 + 1], poz[a * 3 + 2]], B = [poz[b * 3], poz[b * 3 + 1], poz[b * 3 + 2]], C = [poz[c * 3], poz[c * 3 + 1], poz[c * 3 + 2]];
      objem += (A[0] * (B[1] * C[2] - B[2] * C[1]) - A[1] * (B[0] * C[2] - B[2] * C[0]) + A[2] * (B[0] * C[1] - B[1] * C[0])) / 6;
      for (const [i, j] of [[a, b], [b, c], [c, a]]) {
        const k = i < j ? i + ',' + j : j + ',' + i, z = hrany.get(k) || { n: 0, s: 0 };
        z.n++; z.s += i < j ? 1 : -1; hrany.set(k, z);
      }
    }
    for (const z of hrany.values()) if (z.n !== 2 || z.s !== 0) chyb++;
    return { vodotesna: chyb === 0 && hrany.size > 0, chybnychHran: chyb, trojuhelniku: idx.length / 3, objem };
  }
  function stlBinarni(sit, nazev) {
    const { poz, idx } = sit, nt = idx.length / 3;
    const buf = new ArrayBuffer(84 + 50 * nt), dv = new DataView(buf);
    const hl = ('Loziska - ' + (nazev || 'dil')).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '-').slice(0, 79);
    for (let i = 0; i < hl.length; i++) dv.setUint8(i, hl.charCodeAt(i));
    dv.setUint32(80, nt, true);
    let o = 84;
    for (let t = 0; t < nt; t++) {
      const v = [0, 1, 2].map(k => { const i = idx[t * 3 + k]; return [poz[i * 3], poz[i * 3 + 1], poz[i * 3 + 2]]; });
      const u = [v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]], w = [v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2]];
      let nx = u[1] * w[2] - u[2] * w[1], ny = u[2] * w[0] - u[0] * w[2], nz = u[0] * w[1] - u[1] * w[0];
      const l = Math.hypot(nx, ny, nz) || 1;
      dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true); o += 12;
      for (const b of v) { dv.setFloat32(o, b[0], true); dv.setFloat32(o + 4, b[1], true); dv.setFloat32(o + 8, b[2], true); o += 12; }
      o += 2;
    }
    return buf;
  }
  /* dutý válec (maketa ložiska nebo pouzdro) */
  function sitPrstenec(dIn, dOut, h, seg) {
    return rotacni([[dIn / 2, 0], [dOut / 2, 0], [dOut / 2, h], [dIn / 2, h]], seg);
  }
  /* pouzdro pro ložisko: díra D + vůle, stěna, osazení (dno s otvorem) */
  function sitPouzdro(l, { vule = 0, stena = 4, dno = 2 } = {}) {
    const rd = (l.D + vule) / 2, ro = rd + stena, rv = Math.max(l.d / 2 + 1, rd - Math.max(1.5, (l.D - l.d) * 0.2));
    return rotacni([[rv, 0], [ro, 0], [ro, dno + l.B], [rd, dno + l.B], [rd, dno], [rv, dno]]);
  }
  /* díl s drážkou O-kroužku: pist = píst (plný válec) s drážkou, tyc = objímka s vnitřní drážkou, celni = kotouč s čelní drážkou */
  function sitDrazka(n, { stena = 4 } = {}) {
    const t = n.t, b = n.b, okraj = Math.max(2, b);
    if (n.typ === 'pist') {
      const R = n.prumer / 2, rg = n.dno / 2, H = 2 * okraj + b;
      return rotacni([[0, 0], [R, 0], [R, okraj], [rg, okraj], [rg, okraj + b], [R, okraj + b], [R, H], [0, H]]);
    }
    if (n.typ === 'tyc') {
      const r = n.prumer / 2, rg = n.dno / 2, ro = rg + stena, H = 2 * okraj + b;
      return rotacni([[r, 0], [ro, 0], [ro, H], [r, H], [r, okraj + b], [rg, okraj + b], [rg, okraj], [r, okraj]]);
    }
    const Ro = n.prumer / 2, Ri = n.dno / 2, R = Ro + stena, H = t + Math.max(3, t);
    return rotacni([[0, 0], [R, 0], [R, H], [Ro, H], [Ro, H - t], [Ri, H - t], [Ri, H], [0, H]]);
  }

  /* ---------- úložiště ---------- */
  function prazdna() { return { verze: VERZE, oblibene: [], vlastni: [] }; }
  function migruj(d) {
    const p = prazdna();
    if (!d || typeof d !== 'object') return p;
    if (Array.isArray(d.oblibene)) p.oblibene = d.oblibene.filter(x => typeof x === 'string').slice(0, 500);
    if (Array.isArray(d.vlastni)) p.vlastni = d.vlastni.filter(v => v && v.o && +v.d > 0 && +v.D > +v.d && +v.B > 0).map(v => ({
      o: String(v.o).slice(0, 40), d: +v.d, D: +v.D, B: +v.B, C: +v.C || null, C0: +v.C0 || null, n: +v.n || null,
      typ: TYPY[v.typ] ? v.typ : 'kulickove', pozn: String(v.pozn || '').slice(0, 300)
    }));
    return p;
  }
  function prepniOblibene(data, klic) {
    const i = data.oblibene.indexOf(klic);
    if (i >= 0) data.oblibene.splice(i, 1); else data.oblibene.push(klic);
    return i < 0;
  }

  const API = {
    VERZE, KLIC, PARAMETRY, RODINY, TYPY, LOZISKA, OKROUZKY, MEZE, MATERIALY, GUFERA, GUFERA_TYPY, GUFERA_RADY, GUFERA_MATERIALY, DOPORUCENA_LH,
    fmt, dekoduj, rozeberPripony, dZKodu, mezniOtacky, najdiLoziska, trvanlivost, potrebneC, ulozeni,
    vyhodnotDrazku, navrhDrazky, najdiOkrouzky, obvodovaRychlost, najdiGufera,
    svgLozisko, svgDrazka, rotacni, kontrolaSite, stlBinarni, sitPrstenec, sitPouzdro, sitDrazka,
    prazdna, migruj, prepniOblibene
  };
  if (typeof module !== 'undefined') module.exports = API; else window.LoziskaJadro = API;
})();

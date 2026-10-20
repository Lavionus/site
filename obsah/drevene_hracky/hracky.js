/* ============================================================
   Dřevěné hračky – generátory „kostky a stavebnice“ a „tahací hračka“ (bez DOM)
   ============================================================ */
(function (koren) {
  'use strict';
  const DH = koren.DH || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const { cz, r1, r2 } = DH;

  /* ============================================================
     1) KOSTKY A STAVEBNICE
     Typy kostek v násobcích modulu M: [délka x, hloubka y, výška z], řezané z hranolu s průřezem (y × z).
     ============================================================ */
  const TYPY_KOSTEK = [
    { k: 'krychle', nazev: 'krychle 1:1:1', r: [1, 1, 1], prurez: [1, 1], delka: 1, zPrirezu: 1 },
    { k: 'kvadr2', nazev: 'kvádr 1:1:2', r: [2, 1, 1], prurez: [1, 1], delka: 2, zPrirezu: 1 },
    { k: 'kvadr4', nazev: 'kvádr 1:1:4', r: [4, 1, 1], prurez: [1, 1], delka: 4, zPrirezu: 1 },
    { k: 'unit', nazev: 'základní kostka 1:2:4 (unit block)', r: [4, 2, 1], prurez: [2, 1], delka: 4, zPrirezu: 1 },
    { k: 'deska', nazev: 'destička ½:1:4', r: [4, 1, 0.5], prurez: [1, 0.5], delka: 4, zPrirezu: 1 },
    { k: 'trojuhelnik', nazev: 'trojboký hranol (½ krychle)', r: [1, 1, 1], prurez: [1, 1], delka: 1, zPrirezu: 2, profil: 'troj' },
    { k: 'strecha', nazev: 'střecha 2:1:1', r: [2, 1, 1], prurez: [1, 1], delka: 2, zPrirezu: 1, profil: 'strecha' },
    { k: 'oblouk', nazev: 'oblouk 2:1:1', r: [2, 1, 1], prurez: [1, 1], delka: 2, zPrirezu: 1, profil: 'oblouk' },
    { k: 'valec', nazev: 'sloupek Ø1 × 2 (soustružený)', r: [1, 1, 2], prurez: [1, 1], delka: 2, zPrirezu: 1, profil: 'valec' },
  ];
  DH.TYPY_KOSTEK = TYPY_KOSTEK;

  /** profil kostky v čelní rovině (x, z) */
  function profilKostky(T, M, rOb) {
    const w = T.r[0] * M, h = T.r[2] * M;
    if (T.profil === 'troj') return { b: [[0, 0], [w, 0], [0, h]] };
    if (T.profil === 'strecha') return { b: [[0, 0], [w, 0], [w / 2, h]] };
    if (T.profil === 'oblouk') {
      const r = Math.min(rOb * M, w / 2 - 3, h - 3), b = [[0, 0]], n = 40;
      b.push([w / 2 - r, 0]);
      for (let i = 1; i < n; i++) { const a = Math.PI - (i / n) * Math.PI; b.push([w / 2 + r * Math.cos(a), r * Math.sin(a)]); }
      b.push([w / 2 + r, 0], [w, 0], [w, h], [0, h]);
      return { b, r };
    }
    return { b: DH.obdelnik(0, 0, w, h) };
  }
  DH.profilKostky = profilKostky;

  /**
   * Řezný plán: kusy (délky) rozdělit do hranolů délky L (first-fit decreasing).
   * kusy: [{nazev, delka, typ}] · L: délka hranolu · prorez: šířka řezu · zarovnani: odřez čela na začátku
   * → [{delka: L, kusy:[{nazev, delka, x0}], zbytek}]
   */
  DH.rezPlan = (kusy, L, prorez, zarovnani) => {
    const serazene = kusy.slice().sort((a, b) => b.delka - a.delka), hranoly = [];
    for (const k of serazene) {
      if (k.delka + zarovnani > L) { hranoly.push({ delka: L, kusy: [{ ...k, x0: zarovnani }], zbytek: L - zarovnani - k.delka, prilisDlouhy: true }); continue; }
      let h = hranoly.find((q) => !q.prilisDlouhy && q.pouzito + prorez + k.delka <= L);
      if (!h) { h = { delka: L, kusy: [], pouzito: zarovnani - prorez, zbytek: 0 }; hranoly.push(h); }
      const x0 = h.pouzito + prorez;
      h.kusy.push({ ...k, x0 }); h.pouzito = x0 + k.delka;
    }
    for (const h of hranoly) { h.zbytek = r1(h.delka - (h.pouzito == null ? h.kusy[0].x0 + h.kusy[0].delka : h.pouzito)); delete h.pouzito; }
    return hranoly;
  };

  DH.GEN.kostky = {
    nazev: 'Kostky a stavebnice', ikona: '🧱', typ: 'hracka',
    popis: 'Sada kostek v násobcích modulu (poměry 1:2:4), oblouky, střechy, sloupky; řezný plán z hranolu, kolíkové spojky.',
    pole: [
      { sk: 'Modul a materiál' },
      { k: 'M', n: 'Modul M (mm)', t: 'n', min: 15, max: 80, krok: 1 },
      { k: 'delkaHranolu', n: 'Délka hranolu (mm)', t: 'n', min: 200, max: 3000, krok: 10 },
      { k: 'prorez', n: 'Prořez pily (mm)', t: 'n', min: 0, max: 6, krok: 0.1 },
      { k: 'zarovnani', n: 'Odřez čela hranolu (mm)', t: 'n', min: 0, max: 50, krok: 1 },
      { k: 'rOblouku', n: 'Poloměr oblouku (× M)', t: 'n', min: 0.2, max: 0.9, krok: 0.05 },
      { sk: 'Počty kusů v sadě' },
      ...TYPY_KOSTEK.map((T) => ({ k: 'n_' + T.k, n: T.nazev, t: 'n', min: 0, max: 200, krok: 1 })),
      { sk: 'Kolíkové spojky' },
      { k: 'spojky', n: 'Díry pro spojovací kolíky (nahoře i dole v ose modulu)', t: 'b' },
      { k: 'cepD', n: 'Ø kolíku (mm)', t: 'n', min: 4, max: 16, krok: 0.5, ukaz: (p) => p.spojky },
      { k: 'cepHl', n: 'Hloubka díry (mm)', t: 'n', min: 5, max: 30, krok: 0.5, ukaz: (p) => p.spojky },
    ],
    vychozi: { M: 30, delkaHranolu: 1000, prorez: 3, zarovnani: 10, rOblouku: 0.5, n_krychle: 8, n_kvadr2: 8, n_kvadr4: 4, n_unit: 0, n_deska: 4, n_trojuhelnik: 4, n_strecha: 2, n_oblouk: 2, n_valec: 2, spojky: false, cepD: 8, cepHl: 12 },
    predvolby: [
      { id: 'zakladni', nazev: 'Základní sada 30 mm (34 kusů)', p: {} },
      { id: 'unit', nazev: 'Unit blocks 35 × 70 × 140 (1:2:4)', p: { M: 35, n_krychle: 4, n_kvadr2: 8, n_kvadr4: 4, n_unit: 12, n_deska: 4, n_trojuhelnik: 4, n_strecha: 2, n_oblouk: 2, n_valec: 4 } },
      { id: 'batole', nazev: 'Pro batole – velké kostky 50 mm', p: { M: 50, n_krychle: 6, n_kvadr2: 4, n_kvadr4: 0, n_deska: 0, n_trojuhelnik: 2, n_strecha: 1, n_oblouk: 1, n_valec: 0 } },
      { id: 'kolikove', nazev: 'Kolíková stavebnice 25 mm (od 3 let)', p: { M: 25, spojky: true, cepD: 8, cepHl: 10, n_krychle: 12, n_kvadr2: 10, n_kvadr4: 6, n_deska: 0, n_trojuhelnik: 4, n_strecha: 0, n_oblouk: 2, n_valec: 0 } },
    ],
    vypocet(p, spol) {
      const M = p.M, N = { typ: 'hracka', dily: [], telesa: [], kusovnik: [], bezpecnost: [], info: [], varovani: [], koty: [], tabulky: [], stl: [], male: [] };
      const ro = DH.hustota(spol.material);
      const kusy = [];
      let celkem = 0, objem = 0, poz = 1;
      // rozložení sady v řadách
      let x = 0, y = 0, radek = 0, poradi = 0;
      const maxX = 14 * M;
      for (const T of TYPY_KOSTEK) {
        const n = Math.round(p['n_' + T.k] || 0);
        if (!n) continue;
        const sx = T.r[0] * M, sy = T.r[1] * M, sz = T.r[2] * M;
        const pr = profilKostky(T, M, p.rOblouku);
        const vol = T.profil === 'valec' ? Math.PI * (M / 2) ** 2 * sz : Math.abs(DH.plocha(pr.b)) * sy;
        celkem += n; objem += vol * n;
        // přířezy do řezného plánu
        const prirezu = Math.ceil(n / T.zPrirezu), delkaPrirezu = T.delka * M + (T.profil === 'valec' ? 15 : 0);
        for (let i = 0; i < prirezu; i++) kusy.push({ nazev: T.nazev, typ: T.k, delka: delkaPrirezu, prurez: T.prurez.join('×') });
        // díl (profil k řezání / šablona)
        const kruhy = [];
        if (T.profil === 'oblouk') kruhy.push({ x: sx / 2, y: 0, r: 1.2, typ: 'stred' });
        const id = 'K' + poz;
        const male = T.profil === 'valec' ? { typ: 'valec', d: M, h: sz } : T.profil ? { typ: 'deska', b: pr.b, tl: sy } : { typ: 'kvadr', a: sx, b: sy, c: sz };
        N.dily.push({ id, nazev: T.nazev, ks: n, tl: sy, mat: spol.material, obrysy: [{ b: T.profil === 'valec' ? DH.obdelnik(0, 0, M, sz) : pr.b, typ: 'rez' }], kruhy, texty: [], male, volny: true, poznamka: T.profil === 'valec' ? 'soustružit z přířezu ' + cz(M) + ' × ' + cz(M) + ' × ' + cz(delkaPrirezu) : T.profil === 'troj' ? 'z krychle úhlopříčným řezem (2 ks)' : '' });
        N.kusovnik.push(DH.polozka(poz++, T.nazev, n, DH.rozmerTxt(sx, sy, sz), (DH.MATERIALY[spol.material] || {}).nazev, `přířez ${cz(delkaPrirezu)} mm z hranolu ${T.prurez.map((q) => cz(q * M)).join(' × ')}${T.zPrirezu > 1 ? `, ${T.zPrirezu} ks z přířezu` : ''}`));
        // 3D
        for (let i = 0; i < n; i++) {
          if (x + sx > maxX) { x = 0; y += radek + M * 0.5; radek = 0; }
          const barva = ['#d9b98a', '#c99a62', '#e6c896', '#b98552'][poradi % 4];
          if (T.profil === 'valec') N.telesa.push({ typ: 'valec', osa: 'z', x: x + M / 2, y: y + M / 2, z: 0, r: M / 2, h: sz, barva, sklad: poradi });
          else if (T.profil) N.telesa.push({ typ: 'extr', rovina: 'xz', b: pr.b, tl: sy, x, y, z: 0, barva, sklad: poradi });
          else N.telesa.push({ typ: 'box', x, y, z: 0, sx, sy, sz, barva, sklad: poradi });
          poradi++;
          x += sx + M * 0.4; radek = Math.max(radek, sy);
        }
      }
      // řezné plány podle průřezů
      const skup = {};
      for (const k of kusy) (skup[k.prurez] = skup[k.prurez] || []).push(k);
      N.rezPlan = [];
      for (const [prurez, ks] of Object.entries(skup)) {
        const [a, b] = prurez.split('×').map(Number);
        const hr = DH.rezPlan(ks, p.delkaHranolu, p.prorez, p.zarovnani);
        const delkaKusu = ks.reduce((s, q) => s + q.delka, 0);
        N.rezPlan.push({ prurez: [a * M, b * M], hranoly: hr, vyuziti: delkaKusu / (hr.length * p.delkaHranolu) });
        N.kusovnik.push(DH.polozka(poz++, `hranol ${cz(a * M)} × ${cz(b * M)} mm`, hr.length, DH.rozmerTxt(a * M, b * M, p.delkaHranolu), (DH.MATERIALY[spol.material] || {}).nazev, `výchozí materiál, využití ${cz(100 * delkaKusu / (hr.length * p.delkaHranolu), 0)} %`));
        if (hr.some((h) => h.prilisDlouhy)) N.varovani.push(`Některý přířez je delší než hranol ${cz(p.delkaHranolu)} mm.`);
      }
      // kolíkové spojky
      if (p.spojky) {
        let diry = 0;
        for (const T of TYPY_KOSTEK) {
          const n = Math.round(p['n_' + T.k] || 0); if (!n || T.profil === 'troj' || T.profil === 'strecha') continue;
          const nx = T.r[0], ny = T.r[1];
          diry += n * nx * ny * (T.profil === 'oblouk' ? 1 : 2);
        }
        const kol = Math.ceil(diry / 2), delka = 2 * p.cepHl - 1;
        N.kusovnik.push(DH.polozka(poz++, 'spojovací kolík (dřevěný, rýhovaný) nebo STL', kol, `Ø ${cz(p.cepD)} × ${cz(delka)}`, 'buk / PETG', `díry Ø ${cz(p.cepD + 0.2)} × ${cz(p.cepHl)} mm v ose každého modulu nahoře i dole (oblouk jen nahoře)`));
        N.male.push({ nazev: 'spojovací kolík', tvar: { typ: 'valec', d: p.cepD, h: delka }, volny: true });
        N.stl.push({ id: 'cep', nazev: `Spojovací kolík Ø ${cz(p.cepD)} × ${cz(delka)}`, d: p.cepD, h: delka });
        // vrtací šablony na plochu (1, 2, 4 moduly)
        for (const n of [1, 2, 4]) {
          if (!TYPY_KOSTEK.some((T) => T.r[0] === n && (p['n_' + T.k] || 0) > 0 && !['troj', 'strecha'].includes(T.profil))) continue;
          const kr = []; for (let i = 0; i < n; i++) kr.push({ x: (i + 0.5) * M, y: M / 2, r: (p.cepD + 0.2) / 2, typ: 'otvor' });
          N.dily.push({ id: 'S' + n, nazev: `vrtací šablona – plocha ${n} × 1 modul`, ks: 1, tl: 0, sablona: true, obrysy: [{ b: DH.obdelnik(0, 0, n * M, M), typ: 'pomocna' }], kruhy: kr, texty: [], poznamka: 'přiložit k hraně kostky, důlčíkem označit středy' });
        }
        const g = DH.mezera(p.cepD + 0.2);
        if (g.u !== 'ok') N.bezpecnost.push({ u: 'pozor', t: `Prázdná díra pro kolík: ${g.t}. U kostek pro mladší děti díry nevrtejte nebo je dělejte ≥ 12 mm.` });
      }
      N.telesa.forEach((t) => { t.sklad = t.sklad || 0; });
      N.hmotnost = objem * 1e-9 * ro;
      N.info.push(`${celkem} kostek, modul ${cz(M)} mm, objem dřeva ${cz(objem / 1e6, 2)} dm³, hmotnost ${cz(N.hmotnost, 2)} kg.`);
      N.info.push(`Poměry: 2 krychle = kvádr 1:1:2, 2 kvádry 1:1:2 = 1:1:4, 2 destičky ½ = výška modulu, 2 trojboké hranoly = krychle. Přesnost délek ±0,2 mm řežte s dorazem (stop block), jinak se věže kroutí.`);
      if (M < 25) N.bezpecnost.push({ u: +spol.vek < 3 ? 'chyba' : 'pozor', t: `Modul ${cz(M)} mm je malý – krychle projde válcem pro malé díly. Pro batolata volte M ≥ 30 mm (lépe 40–50 mm).` });
      N.bezpecnost.push({ u: 'ok', t: 'Kostky brousit do 240, hrany srazit R 1–2 mm. Hmotnost kostky do 1:1:4 je malá – pro batolata ale pozor na pád věže z výšky (měkká podložka).' });
      N.koty.push({ pohled: 'pudorys', txt: 'sada rozložená v řadách' });
      N.animace = { sklad: true };
      return N;
    },
  };

  /* ============================================================
     2) TAHACÍ HRAČKA – autíčko, náklaďák, vláček
     Souřadnice vozidla: x po délce (0 = záď), y napříč, z nahoru (0 = podlaha).
     ============================================================ */
  DH.GEN.tahaci = {
    nazev: 'Tahací hračka', ikona: '🚂', typ: 'hracka',
    popis: 'Autíčko, náklaďák nebo vláček s vagóny: kola, osy nebo kolíky s hlavou, podložky, šňůra; světlá výška a vůle.',
    pole: [
      { sk: 'Vozidlo' },
      { k: 'typ', n: 'Typ', t: 'v', m: [['auto', 'autíčko'], ['nakladak', 'náklaďák s korbou'], ['vlacek', 'vláček (lokomotiva + vagóny)']] },
      { k: 'delka', n: 'Délka podvozku (mm)', t: 'n', min: 60, max: 400, krok: 1 },
      { k: 'sirka', n: 'Šířka podvozku (mm)', t: 'n', min: 25, max: 200, krok: 1 },
      { k: 'vyska', n: 'Výška podvozku (mm)', t: 'n', min: 12, max: 80, krok: 1 },
      { k: 'kabinaL', n: 'Délka kabiny (mm)', t: 'n', min: 20, max: 200, krok: 1 },
      { k: 'kabinaH', n: 'Výška kabiny (mm)', t: 'n', min: 15, max: 150, krok: 1 },
      { k: 'okno', n: 'Ø okna v kabině (mm, 0 = bez)', t: 'n', min: 0, max: 80, krok: 1 },
      { k: 'komin', n: 'Ø komína (mm)', t: 'n', min: 10, max: 60, krok: 1, ukaz: (p) => p.typ === 'vlacek' },
      { k: 'vagony', n: 'Počet vagónů', t: 'n', min: 0, max: 6, krok: 1, ukaz: (p) => p.typ === 'vlacek' },
      { k: 'vagonL', n: 'Délka vagónu (mm)', t: 'n', min: 50, max: 300, krok: 1, ukaz: (p) => p.typ === 'vlacek' },
      { k: 'spojeni', n: 'Spojení vagónů', t: 'v', m: [['kolik', 'kolík do otvoru (dřevo)'], ['ocka', 'šroubovací očko + háček'], ['magnet', 'zapuštěné magnety']], ukaz: (p) => p.typ === 'vlacek' },
      { sk: 'Kola a osy' },
      { k: 'D', n: 'Průměr kola (mm)', t: 'n', min: 15, max: 150, krok: 1 },
      { k: 'tk', n: 'Šířka kola (mm)', t: 'n', min: 5, max: 50, krok: 0.5 },
      { k: 'osa', n: 'Ø osy / kolíku (mm)', t: 'n', min: 3, max: 20, krok: 0.5 },
      { k: 'uchyceni', n: 'Uložení kol', t: 'v', m: [['osa', 'osa skrz podvozek, kola nalepená'], ['kolik', 'kolíky s hlavou, kolo se točí na kolíku']] },
      { k: 'vule', n: 'Vůle otáčení na průměru (mm)', t: 'n', min: 0.2, max: 2, krok: 0.1 },
      { k: 'podlozka', n: 'Mezera kolo–podvozek / podložka (mm)', t: 'n', min: 0, max: 6, krok: 0.5 },
      { k: 'presah', n: 'Osa od konce podvozku (mm)', t: 'n', min: 8, max: 150, krok: 1 },
      { k: 'osaZ', n: 'Výška osy nad spodkem podvozku (mm)', t: 'n', min: 4, max: 60, krok: 0.5 },
      { sk: 'Šňůra' },
      { k: 'snura', n: 'Délka šňůry (mm)', t: 'n', min: 0, max: 1500, krok: 10 },
      { k: 'madlo', n: 'Ø madla na konci šňůry (mm)', t: 'n', min: 0, max: 80, krok: 1 },
    ],
    vychozi: { typ: 'auto', delka: 160, sirka: 60, vyska: 30, kabinaL: 55, kabinaH: 40, okno: 22, komin: 26, vagony: 2, vagonL: 110, spojeni: 'kolik', D: 45, tk: 14, osa: 8, uchyceni: 'osa', vule: 0.8, podlozka: 1.5, presah: 32, osaZ: 12, snura: 600, madlo: 45 },
    predvolby: [
      { id: 'auto', nazev: 'Autíčko 160 mm', p: {} },
      { id: 'nakladak', nazev: 'Náklaďák s korbou', p: { typ: 'nakladak', delka: 220, sirka: 70, kabinaL: 60, kabinaH: 45, D: 50, presah: 38 } },
      { id: 'vlacek', nazev: 'Vláček + 2 vagóny', p: { typ: 'vlacek', delka: 150, sirka: 55, vyska: 25, kabinaL: 45, kabinaH: 45, D: 38, tk: 12, presah: 28, osaZ: 10, okno: 18 } },
      { id: 'batole', nazev: 'Pro batole – velká kola, kolíky', p: { delka: 180, sirka: 75, vyska: 36, D: 60, tk: 18, osa: 10, uchyceni: 'kolik', presah: 40, osaZ: 14, okno: 30, snura: 0, madlo: 0 } },
    ],
    vypocet(p, spol) {
      const N = { typ: 'hracka', dily: [], telesa: [], kusovnik: [], bezpecnost: [], info: [], varovani: [], koty: [], tabulky: [], stl: [], male: [] };
      const R = p.D / 2, svetla = R - p.osaZ, mat = (DH.MATERIALY[spol.material] || {}).nazev, zr = Math.max(0, +spol.zaobleni || 0);
      const zOsy = R, zPodv = svetla;                                   // výška osy nad podlahou, spodek podvozku
      const dOtvoru = p.uchyceni === 'osa' ? p.osa + p.vule : p.osa;    // otvor v podvozku
      const dKola = p.uchyceni === 'osa' ? p.osa : p.osa + p.vule;       // otvor v kole
      const yL = -p.podlozka - p.tk, yP = p.sirka + p.podlozka;          // vnější strany kol
      let poz = 1, poradi = 0, kol = 0;
      if (svetla < 3) N.bezpecnost.push({ u: 'chyba', t: `Světlá výška ${cz(svetla)} mm – podvozek drhne o zem. Zvětšete kola nebo snižte osu (osa ${cz(p.osaZ)} mm nad spodkem, poloměr kola ${cz(R)} mm).` });
      if (p.osaZ - dOtvoru / 2 < 4) N.varovani.push(`Pod otvorem osy zbývá jen ${cz(p.osaZ - dOtvoru / 2)} mm dřeva – praskne. Zvyšte osu nebo podvozek.`);
      if (p.vyska - p.osaZ - dOtvoru / 2 < 4) N.varovani.push(`Nad otvorem osy zbývá jen ${cz(p.vyska - p.osaZ - dOtvoru / 2)} mm dřeva.`);
      if (2 * p.presah > p.delka - p.D * 0.2) N.varovani.push('Osy jsou příliš blízko u sebe – kola se dotýkají nebo je rozvor příliš krátký.');
      if (p.presah < R + 2 && p.typ !== 'vlacek') N.info.push('Kola přesahují konec podvozku (nárazník = kolo).');

      /** jedno vozidlo (podvozek + nástavba + kola) s posunem x0 */
      const vozidlo = (x0, L, druh, idx) => {
        const presah = Math.min(p.presah, L / 2 - 4);
        const osy = [x0 + presah, x0 + L - presah];
        const rr = Math.min(zr * 2, p.vyska / 3);
        // podvozek – boční profil (x, z) se zaoblenými horními rohy a otvory os
        const prof = DH.zaoblenyObd(0, 0, L, p.vyska, [Math.min(2, rr), Math.min(2, rr), rr, rr]);
        const otvory = osy.map((ox) => DH.kruh(ox - x0, p.osaZ, dOtvoru / 2, 32));
        N.telesa.push({ typ: 'extr', rovina: 'xz', b: prof, diry: otvory, tl: p.sirka, x: x0, y: 0, z: zPodv, barva: '#d9b98a', sklad: poradi++ });
        const nastavba = [];
        if (druh === 'auto' || druh === 'nakladak') {
          // kabina vpředu (u auta i vzadu kapota = nižší blok)
          const kL = Math.min(p.kabinaL, L - 10), kx = druh === 'auto' ? x0 + L * 0.42 - kL / 2 : x0 + L - kL - 4;
          const kb = DH.zaoblenyObd(0, 0, kL, p.kabinaH, [0, 0, Math.min(10, kL / 4), Math.min(10, kL / 4)]);
          const okno = p.okno > 0 && p.okno < Math.min(kL, p.kabinaH) - 8 ? [DH.kruh(kL / 2, p.kabinaH * 0.55, p.okno / 2, 40)] : [];
          N.telesa.push({ typ: 'extr', rovina: 'xz', b: kb, diry: okno, tl: p.sirka - 4, x: kx, y: 2, z: zPodv + p.vyska, barva: '#c99a62', sklad: poradi++ });
          nastavba.push({ nazev: 'kabina', b: kb, diry: okno, tl: p.sirka - 4, ks: 1, w: kL, h: p.kabinaH });
          if (okno.length) { const g = DH.mezera(p.okno); if (g.u !== 'ok') N.bezpecnost.push({ u: g.u, t: 'Okno kabiny: ' + g.t }); }
          if (druh === 'nakladak') {
            // korba: dno + 4 stěny tl. 6 mm
            const kx0 = x0 + 4, kx1 = kx - 3, st = 6, kh = Math.max(14, p.kabinaH * 0.45);
            if (kx1 - kx0 > 30) {
              const bx = (a, b, c, d, e, f, barva) => N.telesa.push({ typ: 'box', x: a, y: b, z: c, sx: d, sy: e, sz: f, barva: barva || '#e6c896', sklad: poradi++ });
              bx(kx0, 0, zPodv + p.vyska, kx1 - kx0, st, kh); bx(kx0, p.sirka - st, zPodv + p.vyska, kx1 - kx0, st, kh);
              bx(kx0, st, zPodv + p.vyska, st, p.sirka - 2 * st, kh); bx(kx1 - st, st, zPodv + p.vyska, st, p.sirka - 2 * st, kh);
              N.kusovnik.push(DH.polozka(poz++, 'korba – bočnice', 2, DH.rozmerTxt(kx1 - kx0, kh, st), 'překližka', 'lepit na podvozek'));
              N.kusovnik.push(DH.polozka(poz++, 'korba – čelo', 2, DH.rozmerTxt(p.sirka - 2 * st, kh, st), 'překližka', ''));
            }
          }
          if (druh === 'auto') {
            // kapota vpředu
            const kpx = kx + kL, kpL = x0 + L - kpx - 2;
            if (kpL > 10) { N.telesa.push({ typ: 'box', x: kpx, y: 4, z: zPodv + p.vyska, sx: kpL, sy: p.sirka - 8, sz: p.kabinaH * 0.35, barva: '#e6c896', sklad: poradi++ }); nastavba.push({ nazev: 'kapota', b: DH.zaoblenyObd(0, 0, kpL, p.kabinaH * 0.35, [0, 0, Math.min(6, kpL / 3), 0]), tl: p.sirka - 8, ks: 1, w: kpL, h: p.kabinaH * 0.35 }); }
          }
        } else if (druh === 'lokomotiva') {
          // kabina vzadu, kotel (válec) vpředu, komín
          const kL = Math.min(p.kabinaL, L * 0.45), kb = DH.zaoblenyObd(0, 0, kL, p.kabinaH, [0, 0, 6, 6]);
          const okno = p.okno > 0 && p.okno < Math.min(kL, p.kabinaH) - 8 ? [DH.kruh(kL / 2, p.kabinaH * 0.6, p.okno / 2, 40)] : [];
          N.telesa.push({ typ: 'extr', rovina: 'xz', b: kb, diry: okno, tl: p.sirka, x: x0 + 2, y: 0, z: zPodv + p.vyska, barva: '#c99a62', sklad: poradi++ });
          const kot = Math.min(p.sirka * 0.9, p.kabinaH * 0.8) / 2, kotL = L - kL - 6;
          N.telesa.push({ typ: 'valec', osa: 'x', x: x0 + kL + 2, y: p.sirka / 2, z: zPodv + p.vyska + kot, r: kot, h: kotL, barva: '#e6c896', sklad: poradi++ });
          N.telesa.push({ typ: 'valec', osa: 'z', x: x0 + L - kotL * 0.35, y: p.sirka / 2, z: zPodv + p.vyska + kot * 1.6, r: p.komin / 2, h: p.komin * 1.1, barva: '#b98552', sklad: poradi++ });
          nastavba.push({ nazev: 'kabina lokomotivy', b: kb, diry: okno, tl: p.sirka, ks: 1, w: kL, h: p.kabinaH });
          N.kusovnik.push(DH.polozka(poz++, 'kotel (kulatina / soustružený)', 1, `Ø ${cz(2 * kot)} × ${cz(kotL)}`, mat, 'spodek zabrousit do roviny, přilepit + kolík'));
          N.kusovnik.push(DH.polozka(poz++, 'komín', 1, `Ø ${cz(p.komin)} × ${cz(p.komin * 1.1 + kot * 0.6)}`, mat, 'kolík Ø' + cz(Math.min(10, p.komin / 2)) + ' do kotle'));
          const kominMaly = DH.malyDil({ typ: 'valec', d: p.komin, h: p.komin * 1.1 + kot * 0.6 });
          if (kominMaly.maly) N.male.push({ nazev: 'komín', tvar: { typ: 'valec', d: p.komin, h: p.komin * 1.1 + kot * 0.6 }, volny: false });
        } else if (druh === 'vagon') {
          const st = 6, kh = Math.max(16, p.kabinaH * 0.5);
          const bx = (a, b, c, d, e, f) => N.telesa.push({ typ: 'box', x: a, y: b, z: c, sx: d, sy: e, sz: f, barva: idx % 2 ? '#e6c896' : '#c99a62', sklad: poradi++ });
          bx(x0 + 3, 0, zPodv + p.vyska, L - 6, st, kh); bx(x0 + 3, p.sirka - st, zPodv + p.vyska, L - 6, st, kh);
          bx(x0 + 3, st, zPodv + p.vyska, st, p.sirka - 2 * st, kh); bx(x0 + L - 3 - st, st, zPodv + p.vyska, st, p.sirka - 2 * st, kh);
        }
        // kola a osy
        for (const ox of osy) {
          for (const y of [yL, p.sirka + p.podlozka]) { N.telesa.push({ typ: 'valec', osa: 'y', x: ox, y, z: zOsy, r: R, h: p.tk, barva: '#8a5a32', sklad: poradi++ }); kol++; }
          if (p.uchyceni === 'osa') N.telesa.push({ typ: 'valec', osa: 'y', x: ox, y: yL, z: zOsy, r: p.osa / 2, h: yP + p.tk - yL, barva: '#f1e0bd', sklad: poradi++ });
          else { N.telesa.push({ typ: 'valec', osa: 'y', x: ox, y: yL - 3, z: zOsy, r: p.osa / 2, h: 16 - yL + 3, barva: '#f1e0bd', sklad: poradi++ }); N.telesa.push({ typ: 'valec', osa: 'y', x: ox, y: p.sirka - 16, z: zOsy, r: p.osa / 2, h: yP + p.tk + 3 - (p.sirka - 16), barva: '#f1e0bd', sklad: poradi++ }); }
        }
        return { osy, nastavba, prof, otvory, x0, L };
      };

      const vozy = [];
      if (p.typ === 'vlacek') {
        const mezera = 14;
        let x = 0;
        const n = Math.round(p.vagony);
        for (let i = n; i >= 1; i--) { vozy.push(vozidlo(x, p.vagonL, 'vagon', i)); x += p.vagonL + mezera; }
        vozy.push(vozidlo(x, p.delka, 'lokomotiva', 0));
      } else vozy.push(vozidlo(0, p.delka, p.typ, 0));

      // díly k řezání (boční profily podvozků, nástavby, kola)
      const pod = vozy.map((v) => v.L).filter((x, i, a) => a.indexOf(x) === i);
      for (const L of pod) {
        const v = vozy.find((q) => q.L === L), ks = vozy.filter((q) => q.L === L).length;
        N.dily.push({ id: 'P' + (N.dily.length + 1), nazev: `podvozek ${cz(L)} mm`, ks, tl: p.sirka, mat: spol.material, obrysy: [{ b: v.prof, typ: 'rez' }], kruhy: v.osy.map((ox) => ({ x: ox - v.x0, y: p.osaZ, r: dOtvoru / 2, typ: 'otvor' })), texty: [], poznamka: `otvory Ø ${cz(dOtvoru)} ${p.uchyceni === 'osa' ? 'skrz' : 'hl. 16'} (vrtat ze stojanové vrtačky kolmo)` });
        N.kusovnik.push(DH.polozka(poz++, `podvozek ${cz(L)} mm`, ks, DH.rozmerTxt(L, p.vyska, p.sirka), mat, `otvory os Ø ${cz(dOtvoru)} ve výšce ${cz(p.osaZ)} mm, ${cz(Math.min(p.presah, L / 2 - 4))} mm od konců`));
      }
      for (const v of vozy) for (const n of v.nastavba) {
        N.dily.push({ id: 'N' + (N.dily.length + 1), nazev: n.nazev, ks: 1, tl: n.tl, mat: spol.material, obrysy: [{ b: n.b, typ: 'rez' }].concat((n.diry || []).map((d) => ({ b: d, typ: 'otvor' }))), kruhy: [], texty: [] });
        N.kusovnik.push(DH.polozka(poz++, n.nazev, 1, DH.rozmerTxt(n.w, n.h, n.tl), mat, n.diry && n.diry.length ? `okno Ø ${cz(p.okno)} sukovníkem (Forstner)` : ''));
      }
      if (p.typ === 'vlacek' && p.vagony > 0) N.kusovnik.push(DH.polozka(poz++, 'vagón – bočnice / čela', Math.round(p.vagony), `${cz(p.vagonL - 6)} / ${cz(p.sirka - 12)} × ${cz(Math.max(16, p.kabinaH * 0.5))} × 6`, 'překližka 6 mm', '2 + 2 ks na vagón'));
      // kolo
      const kolo = DH.kruh(R, R, R, 96);
      N.dily.push({ id: 'W', nazev: `kolo Ø ${cz(p.D)}`, ks: kol, tl: p.tk, mat: spol.material, obrysy: [{ b: kolo, typ: 'rez' }], kruhy: [{ x: R, y: R, r: dKola / 2, typ: 'otvor' }, { x: R, y: R, r: R * 0.62, typ: 'gravir' }], texty: [], male: { typ: 'valec', d: p.D, h: p.tk }, volny: false, poznamka: 'vrtat korunkou / Forstnerem z obou stran; hrany zaoblit' });
      N.kusovnik.push(DH.polozka(poz++, 'kolo', kol, `Ø ${cz(p.D)} × ${cz(p.tk)}`, mat + ' / PETG (STL)', `otvor Ø ${cz(dKola)}${p.uchyceni === 'osa' ? ' (lepit na osu)' : ' (otáčí se)'}`));
      N.stl.push({ id: 'kolo', nazev: `Kolo Ø ${cz(p.D)} × ${cz(p.tk)}`, ks: kol });
      const nOs = vozy.reduce((s, v) => s + v.osy.length, 0);
      if (p.uchyceni === 'osa') {
        const Lo = p.sirka + 2 * (p.podlozka + p.tk);
        N.kusovnik.push(DH.polozka(poz++, 'osa – dřevěná kulatina (buk)', nOs, `Ø ${cz(p.osa)} × ${cz(Lo)}`, 'buk', 'zalepit do kol, v podvozku se volně točí'));
        N.male.push({ nazev: 'osa', tvar: { typ: 'valec', d: p.osa, h: Lo }, volny: false });
      } else {
        const Lk = p.tk + p.podlozka + 16 + 0.5;
        N.kusovnik.push(DH.polozka(poz++, 'kolík s hlavou (axle peg)', kol, `Ø ${cz(p.osa)} × ${cz(Lk)}, hlava Ø ${cz(p.osa + 6)} × 3`, 'buk / PETG (STL)', 'zalepit 16 mm do podvozku; kolo se točí na dříku'));
        N.kusovnik.push(DH.polozka(poz++, 'ocelový drát do STL kolíku (výztuž)', kol, `Ø 3 × ${cz(Lk + 2)}`, 'ocel', 'jen u tištěných kolíků – vlepit do středového otvoru'));
        N.male.push({ nazev: 'kolík s hlavou', tvar: { typ: 'valec', d: p.osa + 6, h: Lk + 3 }, volny: false });
        N.stl.push({ id: 'kolik', nazev: `Kolík s hlavou Ø ${cz(p.osa)}`, ks: kol });
      }
      if (p.podlozka > 0) N.stl.push({ id: 'podlozka', nazev: `Podložka ${cz(p.podlozka)} mm`, ks: kol });
      N.male.push({ nazev: 'kolo', tvar: { typ: 'valec', d: p.D, h: p.tk }, volny: false });
      // spojení vagónů
      if (p.typ === 'vlacek' && p.vagony > 0) {
        if (p.spojeni === 'kolik') { N.kusovnik.push(DH.polozka(poz++, 'spojovací kolík + očko z provázku / háček z kolíku', Math.round(p.vagony), 'Ø 10 × 30', 'buk', 'kolík vlepit do zadního čela, do předního vyvrtat otvor Ø 13 (mezera > 12 mm)')); }
        if (p.spojeni === 'ocka') { N.kusovnik.push(DH.polozka(poz++, 'šroubovací očko a háček', Math.round(p.vagony), 'typicky 3 × 20', 'ocel pozink.', 'předvrtat Ø 2, zašroubovat do čela')); N.bezpecnost.push({ u: +spol.vek < 3 ? 'pozor' : 'ok', t: 'Kovová očka a háčky jsou malé díly – musí být zašroubované do plného dřeva (ne do čela kolmo na vlákna u měkkého dřeva) a vydržet tah.' }); }
        if (p.spojeni === 'magnet') { N.kusovnik.push(DH.polozka(poz++, 'magnet neodymový v pouzdře', 2 * Math.round(p.vagony), 'typicky Ø 10 × 3', 'NdFeB', 'zapustit a zalepit epoxidem, překrýt dřevěnou zátkou')); N.bezpecnost.push({ u: +spol.vek < 3 ? 'chyba' : 'pozor', t: 'Magnety: spolknutí dvou silných magnetů je život ohrožující (protržení střeva). EN 71-1 klade zvláštní požadavky na magnety v hračkách – magnet musí být nevyjímatelně zapouzdřený; pro děti do 3 let se nedoporučuje.' }); }
      }
      // šňůra
      if (p.snura > 0) {
        N.kusovnik.push(DH.polozka(poz++, 'šňůra (bavlna / polyester)', 1, `${cz(p.snura)} mm, Ø 3–4`, 'textil', 'otvor Ø 5 v čele, uzel zevnitř zapustit do zahloubení Ø 10'));
        if (p.madlo > 0) N.kusovnik.push(DH.polozka(poz++, 'madlo (dřevěná koule / kolečko)', 1, `Ø ${cz(p.madlo)}`, mat, 'nesmí projít válcem pro malé díly'));
        if (p.madlo > 0) N.male.push({ nazev: 'madlo šňůry', tvar: { typ: 'koule', d: p.madlo }, volny: false });
        const v = +spol.vek;
        if (v < 1.5 && p.snura > 220) N.bezpecnost.push({ u: 'chyba', t: `Šňůra ${cz(p.snura)} mm: u hraček pro děti do 18 měsíců omezuje EN 71-1 délku volných šňůr (řádově 220 mm) – riziko uškrcení. Zkraťte, nebo hračku dejte až starším dětem. Ověřte v platném znění normy.` });
        else N.bezpecnost.push({ u: v < 3 ? 'pozor' : 'ok', t: `Šňůra ${cz(p.snura)} mm: nesmí tvořit smyčku, bez korálků na konci pro nejmenší; tahací hračky pro batolata mívají šňůru s madlem, ne očko. Ověřte limity délky a tloušťky šňůr v EN 71-1.` });
      } else N.info.push('Bez šňůry (hračka na tlačení).');
      // výpočty
      const rozvor = Math.min(p.presah, p.delka / 2 - 4);
      N.info.push(`Světlá výška ${cz(svetla)} mm · rozvor ${cz(p.delka - 2 * rozvor)} mm · rozchod (střed kol) ${cz(p.sirka + 2 * p.podlozka + p.tk)} mm · otvor v podvozku Ø ${cz(dOtvoru)}, v kole Ø ${cz(dKola)}.`);
      N.info.push(`Valivý obvod kola ${cz(Math.PI * p.D, 0)} mm – na jednu otáčku hračka ujede ${cz(Math.PI * p.D / 10, 1)} cm.`);
      if (p.podlozka < 0.8) N.varovani.push('Bez mezery mezi kolem a podvozkem kola drhnou o bok – dejte podložku ≥ 1 mm (nebo náboj na STL kole).');
      const g = DH.mezera(p.podlozka);
      if (g.u === 'chyba') N.bezpecnost.push({ u: 'pozor', t: 'Mezera mezi kolem a podvozkem: ' + g.t });
      N.bezpecnost.push({ u: 'ok', t: 'Kola musí po zalepení vydržet stažení silou (orientačně 90 N podle EN 71-1 pro hračky do 3 let) – lepte PVA D3 a zkoušejte tahem.' });
      N.koty.push({ pohled: 'predni', a: [vozy[vozy.length - 1].osy[0], 0], b: [vozy[vozy.length - 1].osy[0], zOsy], txt: `osa ${cz(zOsy)}`, o: -20 });
      N.koty.push({ pohled: 'predni', a: [vozy[vozy.length - 1].osy[0], 0], b: [vozy[vozy.length - 1].osy[0], zPodv], txt: `světlá ${cz(svetla)}`, o: 10 });
      N.animace = { sklad: true };
      N.parametryStl = { D: p.D, tk: p.tk, otvor: dKola, osa: p.osa, podlozka: p.podlozka, uchyceni: p.uchyceni };
      return N;
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DH;
})(typeof window !== 'undefined' ? window : globalThis);

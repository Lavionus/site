/* Potápění k vraku – jádro bez DOM (test: _test/potapeni_vrak_test.js).
   Fyzika vzduchu (spotřeba podle tlaku), dekomprese (Bühlmann ZH-L16C pro dusík, jeden
   gradient faktor), narkóza, kyslík, proudy, mapa místa s vrakem, tvorové, výbava a deník.
   Souřadnice v metrech: x doprava, y = hloubka (0 = hladina). Buňka mřížky = 1 m.
   Čas v herních sekundách (UI posílá skutečný čas × CAS).
   ZJEDNODUŠENÝ HERNÍ MODEL – nepoužívat k plánování skutečných ponorů. */
(function () {
  'use strict';

  const VERZE = 1;
  const KLIC = 'webapp_potapeni_vrak_hra';
  const CAS = 6;                 // herních sekund za 1 s skutečného času
  const PH2O = 0.0627;           // tlak vodní páry v plicích (bar)
  const VZDUCH = { id: 'vzduch', nazev: 'Vzduch', fO2: 0.21, fN2: 0.79 };
  const EAN32 = { id: 'ean32', nazev: 'Nitrox EAN32', fO2: 0.32, fN2: 0.68 };
  const GF = 0.85;               // gradient faktor (konzervativnost)
  const MAX_VYSTUP = 12;         // m/min – nad tím roste riziko (doporučeno 9–10)
  // Bühlmann ZH-L16C, dusík: [poločas min, a, b]
  const ZHL16C = [[5, 1.1696, 0.5578], [8, 1.0, 0.6514], [12.5, 0.8618, 0.7222], [18.5, 0.7562, 0.7825],
    [27, 0.62, 0.8126], [38.3, 0.5043, 0.8434], [54.3, 0.441, 0.8693], [77, 0.4, 0.891],
    [109, 0.375, 0.9092], [146, 0.35, 0.9222], [187, 0.3295, 0.9319], [239, 0.3065, 0.9403],
    [305, 0.2835, 0.9477], [390, 0.261, 0.9544], [498, 0.248, 0.9602], [635, 0.2327, 0.9653]];

  // ---------- fyzika ----------
  const tlak = h => 1 + Math.max(0, h) / 10;
  const omez = (v, a, b) => Math.max(a, Math.min(b, v));
  function nasyceniPovrch() { return ZHL16C.map(() => (1 - PH2O) * VZDUCH.fN2); }
  /** Haldane: tkáně se za `sek` sekund přiblíží parciálnímu tlaku N2 v hloubce h. */
  function sytit(tk, h, fN2, sek) {
    const pi = (tlak(h) - PH2O) * fN2;
    for (let i = 0; i < tk.length; i++) tk[i] += (pi - tk[i]) * (1 - Math.pow(2, -sek / 60 / ZHL16C[i][0]));
  }
  /** Strop (m): nejmenší hloubka, kam se smí vystoupat. 0 = smí se na hladinu. */
  function strop(tk, gf = GF) {
    let m = 0;
    for (let i = 0; i < tk.length; i++) {
      const a = ZHL16C[i][1], b = ZHL16C[i][2];
      m = Math.max(m, (tk[i] - a * gf) / (gf / b + 1 - gf));
    }
    return Math.max(0, (m - 1) * 10);
  }
  /** Bezdekompresní čas v minutách (0 = už je potřeba deko, 99 = víc než 99). */
  function ndl(tk, h, fN2) {
    if (strop(tk) > 0) return 0;
    const t = tk.slice();
    for (let min = 1; min <= 99; min++) { sytit(t, h, fN2, 60); if (strop(t) > 0) return min - 1; }
    return 99;
  }
  /** Plán výstupu 9 m/min se zastávkami po 3 m. Vrací {zastavky:[{h,min}], tts (min)}. */
  function planVystupu(tk, h, fN2) {
    const t = tk.slice(), RYCH = 9 / 60, zast = [];
    let d = h, cas = 0;
    while (d > 0.01 && cas < 6 * 3600) {
      const s = strop(t), cil = s > 0 ? Math.ceil(s / 3 - 1e-9) * 3 : 0;
      if (d > cil + 0.01) {
        const krok = Math.min(6, (d - cil) / RYCH), nd = d - krok * RYCH;
        sytit(t, (d + nd) / 2, fN2, krok); d = nd; cas += krok;
      } else {
        sytit(t, d, fN2, 60); cas += 60;
        const z = zast.find(z => z.h === cil);
        if (z) z.min++; else zast.push({ h: cil, min: 1 });
      }
    }
    return { zastavky: zast, tts: Math.ceil(cas / 60) };
  }
  /** Dusíková narkóza 0–1: začíná kolem 30 m na vzduch (pN2 ≈ 3,2 bar). */
  const narkoza = (h, fN2) => omez((tlak(h) * fN2 - 3.16) / 2.2, 0, 1);
  const ppO2 = (h, fO2) => tlak(h) * fO2;
  const mod = (fO2, limit = 1.4) => (limit / fO2 - 1) * 10;

  // ---------- náhoda ----------
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- katalogy ----------
  const PREDMETY = {
    zavazi: { nazev: 'Olověné závaží', cena: 10 },
    lahev: { nazev: 'Stará láhev', cena: 25 },
    mince_s: { nazev: 'Stříbrná mince', cena: 40 },
    lucerna: { nazev: 'Lodní lucerna', cena: 80 },
    kompas: { nazev: 'Mosazný kompas', cena: 120 },
    kotva: { nazev: 'Malá kotva', cena: 150, tezky: true },
    porcelan: { nazev: 'Porcelánový talíř', cena: 150 },
    mince_z: { nazev: 'Zlatá mince', cena: 200 },
    hodinky: { nazev: 'Kapesní hodinky', cena: 250 },
    dalekohled: { nazev: 'Mosazný dalekohled', cena: 300 },
    sextant: { nazev: 'Sextant', cena: 400 },
    telegraf: { nazev: 'Strojní telegraf', cena: 600, tezky: true },
    zvon: { nazev: 'Lodní zvon', cena: 900, tezky: true },
    trezor: { nazev: 'Lodní trezor', cena: 1500, tezky: true },
    amfora: { nazev: 'Olejová amfora', cena: 350 },
    pecet: { nazev: 'Pečetidlo kapitána', cena: 600 },
    dublon: { nazev: 'Zlatý dublon', cena: 400 },
    krucifix: { nazev: 'Zlatý krucifix', cena: 1200 },
    astrolab: { nazev: 'Astroláb', cena: 2000 },
    delo: { nazev: 'Bronzové dělo', cena: 2500, tezky: true },
    smaragd: { nazev: 'Smaragd', cena: 3000 },
    truhla: { nazev: 'Truhla San Esteban', cena: 8000, tezky: true, hlavni: true }
  };
  const TVOROVE = {
    ryby: { nazev: 'Hejno ryb', nebezpecny: false, popis: 'Neškodné. Při rychlém přiblížení se rozprchnou.' },
    zelva: { nazev: 'Kareta obrovská', nebezpecny: false, popis: 'Klidná mořská želva. Neškodná.' },
    barakuda: { nazev: 'Barakuda', nebezpecny: false, popis: 'Zubatá a zvědavá. Neútočí, ale znervózní.' },
    zralok: { nazev: 'Žralok útesový', nebezpecny: false, popis: 'Krouží kolem vraku. V blízkosti roste stres a s ním spotřeba vzduchu.' },
    murena: { nazev: 'Muréna', nebezpecny: true, popis: 'Číhá v dírách vraku. Když vystrčí hlavu, nepřibližuj se – kousne.' },
    perutyn: { nazev: 'Perutýn', nebezpecny: true, popis: 'Jedovaté ostny. Bolestivé bodnutí zvýší spotřebu vzduchu.' },
    meduza: { nazev: 'Čtyřhranka', nebezpecny: true, popis: 'Medúza unášená proudem. Žahá při dotyku.' },
    rejnok: { nazev: 'Trnucha', nebezpecny: true, popis: 'Leží v písku. Kdo se ho dotkne u dna, schytá ostnem.' }
  };
  /* předmět: [typ, místnost] – místnost = index sloupce (+ patro*sloupců), 'N' = nadstavba, -1 = venku na písku */
  const MISTA = [
    { id: 'zatoka', nazev: 'Mělká zátoka', vrak: 'rybářská loď Esperanza', seed: 11, sirka: 110, dno: 14, delka: 18, vyska: 5,
      sloupce: 2, zamcene: [], styl: 'drevo', kurz: null, proud: 0.06,
      popis: 'Klidná zátoka u ostrova. Dřevěná rybářská loď v 14 m – ideální na první ponory.',
      predmety: [['mince_s', 0], ['lahev', 0], ['kompas', 1], ['lucerna', 1], ['zavazi', -1], ['mince_s', -1], ['kotva', -1]],
      tvorove: { ryby: 3, zelva: 1, rejnok: 1, perutyn: 1, meduza: 1 } },
    { id: 'parnik', nazev: 'Útes Marisol', vrak: 'nákladní parník Marisol (1923)', seed: 23, sirka: 140, dno: 30, delka: 36, vyska: 9,
      sloupce: 4, zamcene: [3], styl: 'ocel', nadstavba: true, kurz: 'aowd', proud: 0.12,
      popis: 'Ocelový parník ve 30 m. Hluboko na dlouhé prohlídky – hlídej bezdekompresní čas.',
      predmety: [['lahev', 0], ['porcelan', 4], ['hodinky', 1], ['mince_z', 5], ['dalekohled', 'N'], ['sextant', 'N'],
        ['porcelan', 2], ['mince_z', 6], ['telegraf', 'N'], ['zvon', -1], ['mince_z', 7], ['trezor', 7], ['lahev', -1]],
      tvorove: { ryby: 4, barakuda: 2, murena: 2, perutyn: 3, meduza: 3, zralok: 1, zelva: 1 } },
    { id: 'galeona', nazev: 'Modrá hlubina', vrak: 'španělská galeona San Esteban (1715)', seed: 37, sirka: 140, dno: 44, delka: 32, vyska: 10,
      sloupce: 4, zamcene: [3], styl: 'drevo', stezen: true, kurz: 'deep', proud: 0.18,
      popis: 'Galeona ve 44 m na okraji útesu. Narkóza, dekomprese a silné proudy. Někde tu je truhla.',
      predmety: [['dublon', 0], ['amfora', 4], ['pecet', 1], ['dublon', 5], ['krucifix', 6], ['astrolab', 2],
        ['dublon', -1], ['delo', -1], ['smaragd', 7], ['truhla', 7], ['amfora', 1]],
      tvorove: { ryby: 3, murena: 2, perutyn: 2, meduza: 4, zralok: 2, barakuda: 1, rejnok: 1 } }
  ];
  const VYBAVA = {
    lahev: { nazev: 'Láhev', urovne: [{ popis: '12 l / 200 bar', V: 12, P: 200, cena: 0 }, { popis: '15 l / 200 bar', V: 15, P: 200, cena: 400 }, { popis: '15 l / 232 bar', V: 15, P: 232, cena: 1200 }] },
    regulator: { nazev: 'Automatika a dech', urovne: [{ popis: 'Půjčená automatika', sac: 1, cena: 0 }, { popis: 'Vyvážená automatika (−10 % spotřeby)', sac: 0.9, cena: 300 }, { popis: 'Kurz dechové techniky (−20 % spotřeby)', sac: 0.8, cena: 900 }] },
    ploutve: { nazev: 'Ploutve', urovne: [{ popis: 'Gumové ploutve', rychlost: 1, cena: 0 }, { popis: 'Tuhé ploutve (+20 % rychlost)', rychlost: 1.2, cena: 150 }, { popis: 'Karbonové ploutve (+40 %)', rychlost: 1.4, cena: 500 }] },
    svitilna: { nazev: 'Svítilna', urovne: [{ popis: 'Malá svítilna – dosah 5 m, 40 min', dosah: 5, baterie: 40, cena: 0 }, { popis: 'LED svítilna – 8 m, 80 min', dosah: 8, baterie: 80, cena: 200 }, { popis: 'Kanystrová svítilna – 12 m, 150 min', dosah: 12, baterie: 150, cena: 700 }] },
    sitka: { nazev: 'Síťka na nálezy', urovne: [{ popis: '3 předměty', mista: 3, cena: 0 }, { popis: '5 předmětů', mista: 5, cena: 100 }, { popis: '8 předmětů', mista: 8, cena: 400 }] }
  };
  const DOPLNKY = {
    vak: { nazev: 'Zvedací vak', popis: 'Vynese těžký nález k lodi. Spotřebuje se.', cena: 150, max: 3 },
    pacidlo: { nazev: 'Páčidlo', popis: 'Prorazí zával ve dveřích vraku.', cena: 350 },
    sonar: { nazev: 'Ruční sonar', popis: 'Ukazuje směr k nejbližšímu nálezu.', cena: 600 }
  };
  const KURZY = {
    aowd: { nazev: 'Kurz Advanced (do 30 m)', cena: 300, popis: 'Odemkne Útes Marisol.' },
    nitrox: { nazev: 'Kurz Nitrox (EAN32)', cena: 500, popis: 'Méně dusíku = delší bezdekompresní čas. Pozor na hloubku: MOD 33 m.' },
    deep: { nazev: 'Kurz Deep (do 40 m+)', cena: 1500, popis: 'Odemkne Modrou hlubinu.' }
  };

  // ---------- mapa ----------
  const VODA = 0, PISEK = 1, SKALA = 2, TRUP = 3, VNITREK = 4, ZAVAL = 5;
  const pruchozi = c => c === VODA || c === VNITREK;
  const misto = id => MISTA.find(m => m.id === id);

  function generujMapu(id) {
    const M = misto(id), rnd = rng(M.seed);
    const W = M.sirka, D = M.dno, H = D + 16, OSTROV = 6;
    const g = new Uint8Array(W * H);
    const L = M.delka, x0 = Math.round(W * 0.5 - L / 2), yt = D - M.vyska;
    const xp = Math.round(W * 0.3), xe = Math.round(W * 0.86);
    const f1 = rnd() * 6, f2 = rnd() * 6;
    const dno = [];
    for (let x = 0; x < W; x++) {
      let d;
      if (x < OSTROV) d = 0;
      else if (x < xp) { const t = (x - OSTROV) / (xp - OSTROV); d = 2 + (D - 2) * t * t * (3 - 2 * t); }
      else if (x < xe) d = D;
      else d = D + (x - xe) * 1.4;
      if (x >= OSTROV) d += Math.sin(x * 0.35 + f1) * 0.8 + Math.sin(x * 0.11 + f2) * 1.2;
      if (x >= x0 - 3 && x <= x0 + L + 2) d = D;
      dno.push(omez(Math.round(d), 0, H - 2));
    }
    for (let x = 0; x < W; x++) for (let y = dno[x]; y < H; y++) g[y * W + x] = y < dno[x] + 2 ? PISEK : SKALA;
    // skalní výchozy na svahu a plošině (ne u vraku)
    for (let i = 0; i < Math.round(W / 14); i++) {
      const sx = OSTROV + 4 + Math.floor(rnd() * (W - OSTROV - 8)), sw = 2 + Math.floor(rnd() * 3), sh = 1 + Math.floor(rnd() * 3);
      if (sx + sw >= x0 - 5 && sx <= x0 + L + 4) continue;
      for (let x = sx; x < sx + sw && x < W; x++) {
        const h = sh - (x === sx || x === sx + sw - 1 ? 1 : 0);
        for (let k = 1; k <= h; k++) if (dno[x] - k > 1) g[(dno[x] - k) * W + x] = SKALA;
        dno[x] = Math.max(2, dno[x] - h);
      }
    }
    const nastav = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y * W + x] = c; };
    const cti = (x, y) => (x < 0 || x >= W || y >= H) ? SKALA : y < 0 ? VODA : g[y * W + x];
    // trup: dno trupu v sloupci x se u přídě (vpravo) a zádě zvedá
    const hb = x => D - 1 - Math.max(0, 3 - (x0 + L - 1 - x)) - Math.max(0, 1 - (x - x0));
    const vTrupu = (x, y) => x >= x0 && x < x0 + L && y >= yt && y <= hb(x);
    for (let x = x0; x < x0 + L; x++) for (let y = yt; y <= hb(x); y++) {
      const okraj = !vTrupu(x - 1, y) || !vTrupu(x + 1, y) || !vTrupu(x, y - 1) || !vTrupu(x, y + 1);
      nastav(x, y, okraj ? TRUP : VNITREK);
    }
    // přepážky a mezipalubí
    const n = M.sloupce, ym = M.vyska >= 8 ? yt + Math.floor(M.vyska / 2) : null;
    const prepazky = [];
    for (let k = 1; k < n; k++) prepazky.push(x0 + Math.round(k * L / n));
    const sloupce = [];
    for (let k = 0; k < n; k++) sloupce.push({ x1: k ? prepazky[k - 1] + 1 : x0 + 1, x2: k < n - 1 ? prepazky[k] - 1 : x0 + L - 2, zamceno: M.zamcene.includes(k) });
    if (ym !== null) for (let x = x0 + 1; x < x0 + L - 1; x++) nastav(x, ym, TRUP);
    const zavaly = [];
    for (let k = 0; k < prepazky.length; k++) {
      const x = prepazky[k], zaval = sloupce[k + 1].zamceno || sloupce[k].zamceno;
      for (let y = yt + 1; y < hb(x); y++) nastav(x, y, TRUP);
      const patra = ym === null ? [hb(x) - 1] : [ym - 1, hb(x) - 1];
      for (const yd of patra) {
        const bunky = [[x, yd], [x, yd - 1]];
        for (const [bx, by] of bunky) nastav(bx, by, zaval ? ZAVAL : VNITREK);
        if (zaval) zavaly.push({ id: 'z' + zavaly.length, bunky });
      }
    }
    // průlezy v mezipalubí
    if (ym !== null) for (const s of sloupce) { nastav(s.x1 + 1, ym, VNITREK); nastav(s.x1 + 2, ym, VNITREK); }
    // nadstavba (můstek)
    let nadstavba = null;
    if (M.nadstavba) {
      const bx = sloupce[1].x1 + 3, bw = 7, by = yt - 4;
      for (let x = bx; x < bx + bw; x++) for (let y = by; y < yt; y++)
        nastav(x, y, (x === bx || x === bx + bw - 1 || y === by) ? TRUP : VNITREK);
      nastav(bx, yt - 1, VNITREK); nastav(bx, yt - 2, VNITREK);
      nadstavba = { x1: bx + 1, x2: bx + bw - 2, y1: by + 1, y2: yt - 1 };
    }
    // poklopy v palubě (jen nezamčené sloupce)
    for (const s of sloupce) {
      if (s.zamceno) continue;
      for (let x = s.x1 + 1; x < s.x2; x++)
        if (cti(x, yt - 1) === VODA && cti(x + 1, yt - 1) === VODA) { nastav(x, yt, VNITREK); nastav(x + 1, yt, VNITREK); break; }
    }
    // díra v zádi do spodního patra
    if (ym !== null) { nastav(x0, hb(x0) - 1, VNITREK); nastav(x0, hb(x0) - 2, VNITREK); }
    else { nastav(x0, hb(x0) - 1, VNITREK); }
    // místnosti
    const mistnosti = [];
    for (let p = 0; p < (ym === null ? 1 : 2); p++) for (const s of sloupce) {
      const y1 = p === 0 ? yt + 1 : ym + 1, y2 = ym === null || p === 1 ? D - 2 : ym - 1;
      mistnosti.push({ x1: s.x1, x2: s.x2, y1, y2, zamceno: s.zamceno });
    }
    const podlahy = r => {
      const out = [];
      for (let x = r.x1; x <= r.x2; x++) for (let y = r.y1; y <= r.y2; y++)
        if (cti(x, y) === VNITREK && !pruchozi(cti(x, y + 1)) && cti(x, y + 1) !== ZAVAL) out.push([x, y]);
      return out;
    };
    const lodX = x0 + L / 2;
    const mapa = { id, W, H, D, g, dno, ostrov: OSTROV, lodX, proud: M.proud, styl: M.styl, stezen: !!M.stezen,
      vrak: { x0, L, yt, yb: D, ym, prepazky, mistnosti, nadstavba }, zavaly, predmety: [] };
    // předměty
    const obsazeno = new Set();
    M.predmety.forEach(([typ, kde], i) => {
      let x, y;
      if (kde === -1) {
        for (let pokus = 0; pokus < 100; pokus++) {
          const vlevo = rnd() < 0.5;
          x = vlevo ? x0 - 2 - Math.floor(rnd() * 12) : x0 + L + 1 + Math.floor(rnd() * 12);
          if (!obsazeno.has(x) && x > OSTROV + 2 && x < W - 2) break;
        }
        obsazeno.add(x); y = dno[x] - 0.3; x += 0.5;
      } else {
        const r = kde === 'N' ? nadstavba : mistnosti[kde];
        const volne = podlahy(r).filter(([px, py]) => !obsazeno.has(px + ',' + py));
        const [px, py] = volne[Math.floor(rnd() * volne.length)];
        obsazeno.add(px + ',' + py); x = px + 0.5; y = py + 0.7;
      }
      mapa.predmety.push({ id: id + '-' + i, typ, x, y });
    });
    mapa.podlahy = podlahy;
    return mapa;
  }
  function bunka(m, x, y) {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (cx < 0 || cx >= m.W || cy >= m.H) return SKALA;
    if (cy < 0) return cx < m.ostrov ? PISEK : VODA;
    return m.g[cy * m.W + cx];
  }
  /** Mapa se stavem uložené hry: sebrané předměty pryč, prolomené závaly otevřené. */
  function mapaProHru(hra, id) {
    const m = generujMapu(id), st = hra.mista[id] || { sebrane: [], otevreno: [] };
    m.predmety = m.predmety.filter(p => !st.sebrane.includes(p.id));
    for (const z of m.zavaly) if (st.otevreno.includes(z.id)) for (const [x, y] of z.bunky) m.g[y * m.W + x] = VNITREK;
    m.zavaly = m.zavaly.filter(z => !st.otevreno.includes(z.id));
    return m;
  }
  /** Horizontální proud (m/s) v bodě – uvnitř vraku nic, u dna slábne. */
  function proud(m, x, y, t) {
    if (y < 0 || bunka(m, x, y) === VNITREK) return 0;
    const nadDnem = m.dno[omez(Math.floor(x), 0, m.W - 1)] - y;
    const utlum = omez(nadDnem / 3, 0, 1), smer = y < m.D * 0.45 ? 1 : -0.7;
    return m.proud * smer * (0.65 + 0.35 * Math.sin(t * 2 * Math.PI / 900 + y * 0.15)) * utlum;
  }

  // ---------- hra (uložený stav) ----------
  function novaHra() {
    return { verze: VERZE, penize: 0, vybava: { lahev: 0, regulator: 0, ploutve: 0, svitilna: 0, sitka: 0 },
      vaky: 0, pacidlo: false, sonar: false, kurzy: { aowd: false, nitrox: false, deep: false },
      tkane: nasyceniPovrch(), cas: 8 * 60, cisloPonoru: 0, mista: {}, denik: [], sbirka: {}, videno: {}, vyhra: false };
  }
  function migruj(d) {
    const h = novaHra();
    if (!d || typeof d !== 'object') return h;
    if (Number.isFinite(d.penize)) h.penize = Math.max(0, d.penize);
    for (const k in h.vybava) if (Number.isInteger(d.vybava?.[k])) h.vybava[k] = omez(d.vybava[k], 0, VYBAVA[k].urovne.length - 1);
    for (const k in h.kurzy) h.kurzy[k] = !!d.kurzy?.[k];
    h.vaky = omez(d.vaky | 0, 0, DOPLNKY.vak.max); h.pacidlo = !!d.pacidlo; h.sonar = !!d.sonar; h.vyhra = !!d.vyhra;
    if (Array.isArray(d.tkane) && d.tkane.length === 16 && d.tkane.every(Number.isFinite)) h.tkane = d.tkane.slice();
    if (Number.isFinite(d.cas)) h.cas = d.cas;
    if (Number.isInteger(d.cisloPonoru)) h.cisloPonoru = d.cisloPonoru;
    if (d.mista && typeof d.mista === 'object') for (const m of MISTA) if (d.mista[m.id]) h.mista[m.id] = {
      sebrane: Array.isArray(d.mista[m.id].sebrane) ? d.mista[m.id].sebrane.filter(s => typeof s === 'string') : [],
      otevreno: Array.isArray(d.mista[m.id].otevreno) ? d.mista[m.id].otevreno.filter(s => typeof s === 'string') : [] };
    if (Array.isArray(d.denik)) h.denik = d.denik.filter(z => z && typeof z === 'object').slice(-200);
    if (d.sbirka && typeof d.sbirka === 'object') for (const k in d.sbirka) if (PREDMETY[k]) h.sbirka[k] = d.sbirka[k] | 0;
    if (d.videno && typeof d.videno === 'object') for (const k in d.videno) if (TVOROVE[k]) h.videno[k] = true;
    return h;
  }
  const parametry = hra => ({
    V: VYBAVA.lahev.urovne[hra.vybava.lahev].V, P: VYBAVA.lahev.urovne[hra.vybava.lahev].P,
    sac: VYBAVA.regulator.urovne[hra.vybava.regulator].sac, rychlost: VYBAVA.ploutve.urovne[hra.vybava.ploutve].rychlost,
    dosah: VYBAVA.svitilna.urovne[hra.vybava.svitilna].dosah, baterie: VYBAVA.svitilna.urovne[hra.vybava.svitilna].baterie,
    mista: VYBAVA.sitka.urovne[hra.vybava.sitka].mista
  });
  const odemceno = (hra, id) => { const k = misto(id).kurz; return !k || hra.kurzy[k]; };
  /** Nákup: co = 'vybava:lahev' | 'doplnek:vak' | 'kurz:aowd'. */
  function kup(hra, co) {
    const [druh, k] = co.split(':');
    let cena, proved;
    if (druh === 'vybava') {
      const u = hra.vybava[k] + 1, ur = VYBAVA[k]?.urovne[u];
      if (!ur) return { ok: false, zprava: 'Už máš nejlepší.' };
      cena = ur.cena; proved = () => { hra.vybava[k] = u; };
    } else if (druh === 'doplnek') {
      const d = DOPLNKY[k]; if (!d) return { ok: false, zprava: 'Neznámá položka.' };
      if (k === 'vak' ? hra.vaky >= d.max : hra[k]) return { ok: false, zprava: 'Víc už neuneseš.' };
      cena = d.cena; proved = () => { if (k === 'vak') hra.vaky++; else hra[k] = true; };
    } else if (druh === 'kurz') {
      const d = KURZY[k]; if (!d) return { ok: false, zprava: 'Neznámý kurz.' };
      if (hra.kurzy[k]) return { ok: false, zprava: 'Kurz už máš.' };
      if (k === 'deep' && !hra.kurzy.aowd) return { ok: false, zprava: 'Nejdřív kurz Advanced.' };
      cena = d.cena; proved = () => { hra.kurzy[k] = true; };
    } else return { ok: false, zprava: 'Neznámá položka.' };
    if (hra.penize < cena) return { ok: false, zprava: 'Nemáš dost peněz.' };
    hra.penize -= cena; proved();
    return { ok: true, zprava: 'Koupeno.' };
  }
  /** Povrchový interval: tkáně se na hladině odsycují. */
  function cekej(hra, min) { sytit(hra.tkane, 0, VZDUCH.fN2, min * 60); hra.cas += min; }
  const denCas = cas => ({ den: Math.floor(cas / 1440) + 1, hodiny: Math.floor(cas % 1440 / 60), minuty: Math.floor(cas % 60) });

  // ---------- ponor ----------
  function novyPonor(hra, id, plyn) {
    const m = mapaProHru(hra, id), par = parametry(hra), M = misto(id);
    const smes = plyn === 'ean32' && hra.kurzy.nitrox ? EAN32 : VZDUCH;
    const rnd = rng(M.seed * 1000 + hra.cisloPonoru + 1);
    const p = { misto: id, mapa: m, par, smes, fO2: smes.fO2, fN2: smes.fN2,
      x: m.lodX - 1.5, y: 0.2, vx: 0, vy: 0, smer: 1, t: 0, plyn: par.V * par.P, tkane: hra.tkane.slice(),
      maxH: 0, sumH: 0, riziko: 0, rizikoO2: 0, zdravi: 100, stres: 0, bolest: 0, baterie: par.baterie * 60, svetlo: true,
      sitka: [], vaky: hra.vaky, pacidlo: hra.pacidlo, sonar: hra.sonar, stoupajici: [], zajisteno: [], otevreno: [],
      zpravy: [], rychlostVystupu: 0, strop: strop(hra.tkane), bezpZastavka: 0, bezpHotovo: false, profil: [[0, 0]],
      konec: null, nouze: null, pace: null, videno: {}, tvorove: [], zacatek: hra.cas, ponorCislo: hra.cisloPonoru + 1,
      plynStart: par.V * par.P, prekrocenoVystup: 0, prekrocenoStrop: 0 };
    p.tvorove = rozmistiTvory(m, M, rnd);
    return p;
  }
  function volnaVoda(m, rnd, x1, x2, y1, y2) {
    for (let i = 0; i < 300; i++) {
      const x = x1 + rnd() * (x2 - x1), y = y1 + rnd() * (y2 - y1);
      let ok = true;
      for (let dx = -1; dx <= 1 && ok; dx++) for (let dy = -1; dy <= 1 && ok; dy++) if (bunka(m, x + dx, y + dy) !== VODA) ok = false;
      if (ok) return [x, y];
    }
    return null;
  }
  function rozmistiTvory(m, M, rnd) {
    const out = [], v = m.vrak, stred = v.x0 + v.L / 2;
    for (const typ in M.tvorove) for (let i = 0; i < M.tvorove[typ]; i++) {
      let poz = null, extra = {};
      if (typ === 'murena') {
        const kandidati = [];
        v.mistnosti.forEach(r => m.podlahy(r).forEach(([x, y]) => {
          const zleva = !pruchozi(bunka(m, x - 1, y)), zprava = !pruchozi(bunka(m, x + 1, y));
          if ((zleva || zprava) && bunka(m, x - 1, y) !== ZAVAL && bunka(m, x + 1, y) !== ZAVAL) kandidati.push([x, y, zleva ? 1 : -1]);
        }));
        if (!kandidati.length) continue;
        const [x, y, s] = kandidati[Math.floor(rnd() * kandidati.length)];
        poz = [x + 0.5 - s * 0.3, y + 0.6]; extra.smer = s;
      } else if (typ === 'rejnok') {
        for (let k = 0; k < 50 && !poz; k++) {
          const x = Math.floor(m.W * 0.32 + rnd() * m.W * 0.5);
          if (x > v.x0 - 3 && x < v.x0 + v.L + 3) continue;
          if (bunka(m, x + 0.5, m.dno[x] - 0.5) === VODA) poz = [x + 0.5, m.dno[x] - 0.25];
        }
      } else if (typ === 'perutyn') {
        poz = volnaVoda(m, rnd, v.x0 - 6, v.x0 + v.L + 6, v.yt - 3, m.D - 1);
      } else if (typ === 'zralok') {
        poz = [stred, Math.max(4, v.yt - 5 - i * 3)]; extra = { R: v.L / 2 + 6 + i * 3, faze: rnd() * 6.28 };
      } else if (typ === 'meduza') {
        poz = volnaVoda(m, rnd, m.ostrov + 8, m.W - 4, 2, m.D * 0.8);
      } else {
        poz = volnaVoda(m, rnd, m.ostrov + 8, m.W - 4, 3, m.D - 2);
      }
      if (!poz) continue;
      out.push(Object.assign({ typ, x: poz[0], y: poz[1], hx: poz[0], hy: poz[1], vx: 0, vy: 0, faze: rnd() * 6.28, cd: 0, vysun: 0 }, extra));
    }
    return out;
  }
  const R_POT = 0.3;
  function volnoPro(m, x, y) {
    for (const [dx, dy] of [[-R_POT, -R_POT], [R_POT, -R_POT], [-R_POT, R_POT], [R_POT, R_POT]])
      if (!pruchozi(bunka(m, x + dx, y + dy))) return false;
    return true;
  }
  function zprava(p, text, druh = '') { p.zpravy.push({ t: p.t, text, druh }); if (p.zpravy.length > 30) p.zpravy.shift(); }
  function zacniNouzi(p, duvod) {
    if (p.nouze) return;
    p.nouze = duvod;
    zprava(p, duvod === 'vzduch' ? 'Došel vzduch! Nouzový výstup – síťku musíš pustit.' :
      duvod === 'kyslik' ? 'Kyslíková otrava – parťák tě táhne nahoru!' : 'Jsi zraněný – parťák tě táhne nahoru!', 'zle');
  }
  /** Cílová svislá rychlost řízeného výstupu (m/s, záporná = nahoru). */
  function rizenyVystup(p) {
    let cil = p.strop > 0 ? Math.ceil(p.strop / 3 - 1e-9) * 3 : 0;
    if (cil === 0 && p.maxH > 10 && !p.bezpHotovo) cil = 5;
    if (p.y > cil + 0.3) return -0.15;
    if (p.y < cil - 0.3) return 0.08;
    return 0;
  }
  function krok(p, v, dt) {
    while (dt > 1e-9 && !p.konec) { const d = Math.min(dt, 0.25); krokMaly(p, v || {}, d); dt -= d; }
  }
  function krokMaly(p, v, dt) {
    const m = p.mapa;
    p.t += dt;
    let ix = v.dx || 0, iy = v.dy || 0;
    const dl = Math.hypot(ix, iy); if (dl > 1) { ix /= dl; iy /= dl; }
    if (p.nouze) { ix = 0; iy = 0; }
    const rychle = !!v.rychle && !p.nouze;
    const r = 0.35 * p.par.rychlost * (rychle ? 1.7 : 1);
    let tx = ix * r, ty = iy * r * 0.8;
    if (iy < 0 && !rychle) ty = Math.max(ty, -0.25);
    if (p.nouze) ty = -0.3;
    else if (v.rizeny && Math.abs(iy) < 0.05) ty = rizenyVystup(p);
    tx += proud(m, p.x, p.y, p.t);
    const k = Math.min(1, dt * 2.5);
    p.vx += (tx - p.vx) * k; p.vy += (ty - p.vy) * k;
    if (Math.abs(ix) > 0.1) p.smer = ix > 0 ? 1 : -1;
    const yPred = p.y;
    const nx = omez(p.x + p.vx * dt, m.ostrov + 0.5, m.W - 0.5);
    if (volnoPro(m, nx, p.y)) p.x = nx; else p.vx = 0;
    const ny = Math.max(0, p.y + p.vy * dt);
    if (volnoPro(m, p.x, ny)) p.y = ny; else p.vy = 0;
    if (p.y <= 0) p.vy = Math.max(0, p.vy);
    const h = p.y;
    // dýchání
    const usili = Math.min(1, Math.hypot(ix, iy));
    const sac = (12 + 9 * usili + (rychle && usili > 0 ? 12 : 0)) * p.par.sac * (1 + 0.8 * p.stres) * (p.bolest > 0 ? 1.25 : 1);
    p.sacAktualni = sac;
    if (h > 0.6) p.plyn -= sac / 60 * tlak(h) * dt;
    if (p.plyn <= 0) { p.plyn = 0; if (h > 0.6) zacniNouzi(p, 'vzduch'); }
    // tkáně, výstup, strop
    sytit(p.tkane, h, p.fN2, dt);
    const rv = (yPred - h) / dt * 60;
    p.rychlostVystupu += (rv - p.rychlostVystupu) * Math.min(1, dt / 6);
    if (p.rychlostVystupu > MAX_VYSTUP && h > 0.5) { const d = (p.rychlostVystupu - MAX_VYSTUP) / MAX_VYSTUP * dt / 60; p.riziko += d; p.prekrocenoVystup += dt; }
    p.strop = strop(p.tkane);
    if (h < p.strop - 0.5) { p.riziko += (p.strop - h) / 3 * dt / 60; p.prekrocenoStrop += dt; }
    if (p.maxH > 10 && h >= 3 && h <= 6.5 && p.strop < 3) {
      p.bezpZastavka += dt;
      if (p.bezpZastavka >= 180 && !p.bezpHotovo) { p.bezpHotovo = true; zprava(p, 'Bezpečnostní zastávka splněna ✓', 'dobre'); }
    }
    // kyslík
    const po2 = ppO2(h, p.fO2);
    if (po2 > 1.6) { p.rizikoO2 += (po2 - 1.5) * dt / 60; if (p.rizikoO2 >= 1) zacniNouzi(p, 'kyslik'); }
    // statistika
    p.maxH = Math.max(p.maxH, h); p.sumH += h * dt;
    if (p.t - p.profil[p.profil.length - 1][0] >= 15) p.profil.push([Math.round(p.t), Math.round(h * 10) / 10]);
    // světlo, stres
    if (p.svetlo) { p.baterie -= dt; if (p.baterie <= 0) { p.baterie = 0; p.svetlo = false; zprava(p, 'Baterie svítilny je vybitá.', 'zle'); } }
    p.stres = Math.max(0, p.stres - 0.008 * dt); p.bolest = Math.max(0, p.bolest - dt);
    tvorove(p, dt);
    // nálezy na zvedacích vacích
    for (const s of p.stoupajici) s.y -= 0.5 * dt;
    for (const s of p.stoupajici.filter(s => s.y <= 0)) { p.zajisteno.push(s); zprava(p, PREDMETY[s.typ].nazev + ' je u lodi.', 'dobre'); }
    p.stoupajici = p.stoupajici.filter(s => s.y > 0);
    // páčení závalu
    if (p.pace) {
      const z = m.zavaly.find(z => z.id === p.pace.id);
      const [zx, zy] = z.bunky[0];
      if (Math.hypot(zx + 0.5 - p.x, zy - p.y) > 2.2) { p.pace = null; zprava(p, 'Páčení přerušeno.'); }
      else {
        p.pace.zbyva -= dt; p.stres = Math.min(1, p.stres + 0.004 * dt);
        if (p.pace.zbyva <= 0) {
          for (const [x, y] of z.bunky) m.g[y * m.W + x] = VNITREK;
          m.zavaly = m.zavaly.filter(q => q !== z); p.otevreno.push(z.id); p.pace = null;
          zprava(p, 'Zával prolomen – cesta je volná.', 'dobre');
        }
      }
    }
    if (p.nouze && h < 0.3) ukonci(p, p.nouze);
  }
  function zasah(p, tv, dmg, stres, text) {
    if (tv.cd > 0 || p.nouze) return;
    tv.cd = 15; p.zdravi = Math.max(0, p.zdravi - dmg); p.stres = Math.min(1, p.stres + stres);
    if (tv.typ === 'perutyn' || tv.typ === 'rejnok') p.bolest = 600;
    zprava(p, text, 'zle');
    if (p.zdravi <= 0) zacniNouzi(p, 'zraneni');
  }
  function tvorove(p, dt) {
    const m = p.mapa;
    for (const tv of p.tvorove) {
      tv.cd = Math.max(0, tv.cd - dt); tv.faze += dt * 0.1;
      const dx = p.x - tv.x, dy = p.y - tv.y, d = Math.hypot(dx, dy);
      if (d < 7) p.videno[tv.typ] = true;
      let nx = tv.x, ny = tv.y;
      if (tv.typ === 'ryby' || tv.typ === 'zelva' || tv.typ === 'barakuda') {
        const R = tv.typ === 'zelva' ? 10 : tv.typ === 'ryby' ? 6 : 2;
        let cx = tv.hx + Math.cos(tv.faze * (tv.typ === 'zelva' ? 0.3 : 1)) * R - tv.x;
        let cy = tv.hy + Math.sin(tv.faze * 1.3) * Math.min(2, R / 3) - tv.y;
        if (tv.typ === 'ryby' && d < 3) { cx = -dx * 3; cy = -dy * 3; }
        const s = tv.typ === 'ryby' ? (d < 3 ? 0.9 : 0.3) : tv.typ === 'zelva' ? 0.15 : 0.1;
        const l = Math.hypot(cx, cy) || 1;
        tv.vx += (cx / l * s - tv.vx) * Math.min(1, dt); tv.vy += (cy / l * s - tv.vy) * Math.min(1, dt);
        nx += tv.vx * dt; ny += tv.vy * dt;
        if (tv.typ === 'barakuda' && d < 3) p.stres = Math.min(1, p.stres + 0.01 * dt);
      } else if (tv.typ === 'zralok') {
        tv.faze += dt * 0.012;
        nx = tv.hx + Math.cos(tv.faze) * tv.R; ny = tv.hy + Math.sin(tv.faze * 0.7) * 3;
        ny = omez(ny, 2.5, m.dno[omez(Math.floor(nx), 0, m.W - 1)] - 2);
        tv.vx = (nx - tv.x) / dt; tv.vy = (ny - tv.y) / dt;
        if (d < 5) p.stres = Math.min(1, p.stres + 0.03 * dt);
      } else if (tv.typ === 'meduza') {
        nx += proud(m, tv.x, tv.y, p.t) * dt * 0.8; ny += Math.sin(tv.faze * 4) * 0.04 * dt;
        if (d < 0.8) zasah(p, tv, 10, 0.3, 'Žahnutí medúzy! −10 zdraví.');
      } else if (tv.typ === 'perutyn') {
        nx = tv.hx + Math.sin(tv.faze * 2) * 0.6; ny = tv.hy + Math.cos(tv.faze * 1.7) * 0.3;
        if (d < 0.7) zasah(p, tv, 15, 0.4, 'Bodnutí perutýna! Bolest zvýší spotřebu vzduchu.');
      } else if (tv.typ === 'murena') {
        tv.vysun += ((d < 3 ? 1 : 0) - tv.vysun) * Math.min(1, dt * 0.8);
        if (d < 1.1 && tv.vysun > 0.6) zasah(p, tv, 25, 0.6, 'Muréna kousla! −25 zdraví.');
        continue;
      } else if (tv.typ === 'rejnok') {
        if (d < 0.9) zasah(p, tv, 20, 0.5, 'Trnucha tě píchla ostnem! −20 zdraví.');
        continue;
      }
      if (tv.typ === 'zralok' || bunka(m, nx, ny) === VODA) { tv.x = nx; tv.y = Math.max(0.8, ny); }
      else { tv.vx = -tv.vx; tv.vy = -tv.vy; tv.faze += 1; }
    }
  }
  const vzdal = (p, o) => Math.hypot(o.x - p.x, o.y - p.y);
  /** Co by teď udělala interakce (pro popisek tlačítka). */
  function moznost(p) {
    if (p.konec || p.nouze) return null;
    if (p.y < 0.6 && Math.abs(p.x - p.mapa.lodX) < 4) return { druh: 'lod', text: 'Vylézt na loď' };
    const it = p.mapa.predmety.filter(o => vzdal(p, o) < 1.6).sort((a, b) => vzdal(p, a) - vzdal(p, b))[0];
    if (it) return { druh: 'predmet', predmet: it, text: PREDMETY[it.typ].tezky ? 'Připnout zvedací vak' : 'Sebrat' };
    const z = p.mapa.zavaly.find(z => z.bunky.some(([x, y]) => Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) < 1.8));
    if (z) return { druh: 'zaval', zaval: z, text: p.pace ? 'Páčím…' : 'Páčit zával' };
    return null;
  }
  function interakce(p) {
    const mo = moznost(p);
    if (!mo) return null;
    if (mo.druh === 'lod') { ukonci(p, 'lod'); return mo; }
    if (mo.druh === 'predmet') {
      const it = mo.predmet, def = PREDMETY[it.typ];
      if (def.tezky) {
        if (p.vaky <= 0) { zprava(p, def.nazev + ' je moc těžký – potřebuješ zvedací vak.'); return mo; }
        p.vaky--; p.stoupajici.push(it); zprava(p, 'Vak nafouknut – ' + def.nazev + ' stoupá k lodi.', 'dobre');
      } else {
        if (p.sitka.length >= p.par.mista) { zprava(p, 'Síťka je plná.'); return mo; }
        p.sitka.push(it); zprava(p, 'Nález: ' + def.nazev + ' (' + def.cena + ' $)', 'dobre');
      }
      p.mapa.predmety = p.mapa.predmety.filter(o => o !== it);
      return mo;
    }
    if (mo.druh === 'zaval') {
      if (!p.pacidlo) zprava(p, 'Dveře zavalené troskami – bez páčidla neprojdeš.');
      else if (!p.pace) { p.pace = { id: mo.zaval.id, zbyva: 25 }; zprava(p, 'Páčíš zával… zůstaň u něj.'); }
    }
    return mo;
  }
  function ukonci(p, duvod) {
    if (p.konec) return;
    p.konec = { duvod };
  }
  /** Sonar: směr a vzdálenost k nejbližšímu nálezu. */
  function sonar(p) {
    let nej = null;
    for (const o of p.mapa.predmety) { const d = vzdal(p, o); if (!nej || d < nej.d) nej = { d, uhel: Math.atan2(o.y - p.y, o.x - p.x) }; }
    return nej;
  }
  /** Po ponoru: vyhodnotí riziko, zapíše nálezy, peníze, tkáně a deník. Vrací souhrn. */
  function vyhodnot(hra, p) {
    const duvod = p.konec ? p.konec.duvod : 'lod';
    let riziko = p.riziko;
    const zbyvaStrop = strop(p.tkane);
    if (zbyvaStrop > 0) riziko += 1 + zbyvaStrop / 3;
    if (p.bezpHotovo) riziko = Math.max(0, riziko - 0.3);
    const ziskane = (duvod === 'lod' ? p.sitka : []).concat(p.zajisteno);
    const ztracene = duvod === 'lod' ? [] : p.sitka;
    let zisk = 0;
    for (const it of ziskane) { zisk += PREDMETY[it.typ].cena; hra.sbirka[it.typ] = (hra.sbirka[it.typ] || 0) + 1; }
    const st = hra.mista[p.misto] || (hra.mista[p.misto] = { sebrane: [], otevreno: [] });
    for (const it of ziskane) if (!st.sebrane.includes(it.id)) st.sebrane.push(it.id);
    for (const z of p.otevreno) if (!st.otevreno.includes(z)) st.otevreno.push(z);
    const nemoc = riziko >= 3 ? 'tezka' : riziko >= 1 ? 'lehka' : null;
    let poplatek = 0;
    if (nemoc === 'tezka') poplatek += 800;
    if (duvod === 'zraneni' || duvod === 'kyslik') poplatek += 200;
    hra.penize += zisk;
    poplatek = Math.min(poplatek, hra.penize); hra.penize -= poplatek;
    const delka = Math.ceil(p.t / 60);
    hra.tkane = p.tkane.slice(); hra.cas += delka;
    if (nemoc === 'tezka') { hra.cas += 1440; hra.tkane = nasyceniPovrch(); }
    else if (nemoc === 'lehka') cekej(hra, 720);
    hra.cisloPonoru++;
    for (const k in p.videno) hra.videno[k] = true;
    const vyhra = ziskane.some(it => PREDMETY[it.typ].hlavni) && !hra.vyhra;
    if (vyhra) hra.vyhra = true;
    const zaznam = { c: hra.cisloPonoru, misto: p.misto, zacatek: p.zacatek, delka, maxH: Math.round(p.maxH * 10) / 10,
      prumH: Math.round(p.sumH / Math.max(1, p.t) * 10) / 10, plyn: p.smes.id,
      barStart: Math.round(p.plynStart / p.par.V), barKonec: Math.round(p.plyn / p.par.V),
      nalezy: ziskane.map(i => i.typ), ztraceno: ztracene.map(i => i.typ), riziko: Math.round(riziko * 100) / 100,
      nemoc, duvod, bezp: p.bezpHotovo, zisk, poplatek, videno: Object.keys(p.videno), profil: p.profil.concat([[Math.round(p.t), 0]]) };
    hra.denik.push(zaznam);
    if (hra.denik.length > 200) hra.denik.shift();
    return Object.assign({ vyhra }, zaznam);
  }

  const api = { VERZE, KLIC, CAS, VZDUCH, EAN32, GF, MAX_VYSTUP, ZHL16C, PREDMETY, TVOROVE, MISTA, VYBAVA, DOPLNKY, KURZY,
    VODA, PISEK, SKALA, TRUP, VNITREK, ZAVAL, pruchozi,
    tlak, nasyceniPovrch, sytit, strop, ndl, planVystupu, narkoza, ppO2, mod, rng,
    misto, generujMapu, mapaProHru, bunka, proud, novaHra, migruj, parametry, odemceno, kup, cekej, denCas,
    novyPonor, krok, rizenyVystup, moznost, interakce, sonar, vyhodnot, volnoPro };
  if (typeof module !== 'undefined') module.exports = api;
  else window.VrakJadro = api;
})();

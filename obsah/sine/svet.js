/* ============================================================
   Síně pod horou – svet.js: generátor pater hory a rokle.

   Čistá logika bez DOM. Hora má PATER pater (0 = povrch, 1–8
   podzemí po 20 m), každé W × H polí. Index pole:
     i = p × W × H + y × W + x        (y roste k jihu)
   Pole má:
     teren   – M.VOLNO = vytesáno / volná zem, jinak hornina
     zaklad  – hornina, ze které pole je (u volných polí barví podlahu)
     podlaha – druh podlahy volného pole (P.*)
     obj     – objekt (O.*): jedle, krápník, sloup, schody…
     ruda    – rudná žíla v hornině (R.*)
     kap     – množství kapaliny 0–7 (≥ 4 = hluboká), kapTyp K.*
     otes    – 1 = otesané pole (rovné zdi, dlažba)
     oblast  – číslo jeskyně, ruiny… (0 = žádná), popis v sv.oblasti
     zn      – 1 = pole je známé (mlha války)
   ============================================================ */
var SIN = globalThis.SIN = globalThis.SIN || {};

(function (S) {
  'use strict';
  const { Nahoda, smichej, fbm } = S.nahoda;

  const VELIKOSTI = { mala: 64, stredni: 96, velka: 128 };
  const PATER = 9, HLOUBKA_PATRA = 20;

  const M = { VOLNO: 0, HLINA: 1, JIL: 2, VAPENEC: 3, ZULA: 4, CEDIC: 5, HLUBINNY: 6, PODLOZI: 7,
              CIHLA: 8, RUNA: 9, OBSIDIAN: 10, SUT: 11 };
  // barva = odstín horniny pro kreslení (násobí šedou texturu), mini = barva v minimapě
  const MATERIAL = {
    [M.VOLNO]:    { nazev: 'volno', pevne: false },
    [M.HLINA]:    { nazev: 'hlína', pevne: true, tvrdost: 1, barva: [150, 112, 78], mini: '#6e4e33' },
    [M.JIL]:      { nazev: 'jíl', pevne: true, tvrdost: 1, barva: [168, 108, 80], mini: '#8f5539' },
    [M.VAPENEC]:  { nazev: 'vápenec', pevne: true, tvrdost: 2, barva: [196, 186, 160], mini: '#a99e83' },
    [M.ZULA]:     { nazev: 'žula', pevne: true, tvrdost: 4, barva: [172, 156, 152], mini: '#8f7c7a' },
    [M.CEDIC]:    { nazev: 'čedič', pevne: true, tvrdost: 4, barva: [112, 118, 132], mini: '#50565f' },
    [M.HLUBINNY]: { nazev: 'hlubinný kámen', pevne: true, tvrdost: 5, barva: [104, 88, 124], mini: '#3d3249' },
    [M.PODLOZI]:  { nazev: 'kořen hory', pevne: true, tvrdost: Infinity, barva: [44, 40, 50], mini: '#131117' },
    [M.CIHLA]:    { nazev: 'zdivo předků', pevne: true, tvrdost: 3, barva: [176, 162, 140], mini: '#8a7d6b' },
    [M.RUNA]:     { nazev: 'runová zeď', pevne: true, tvrdost: 6, barva: [96, 132, 148], mini: '#3d5d6e' },
    [M.OBSIDIAN]: { nazev: 'obsidián', pevne: true, tvrdost: 6, barva: [58, 46, 74], mini: '#1e1628' },
    [M.SUT]:      { nazev: 'suť', pevne: true, tvrdost: 1, barva: [140, 132, 120], mini: '#7a746a' },
  };
  const prirodni = m => m >= M.HLINA && m <= M.HLUBINNY;

  const P = { SUROVA: 0, TRAVA: 1, CESTA: 2, HLINA: 3, STERK: 4, MECH: 5,
              DLAZBA: 6, SACHOVNICE: 7, PRKNA: 8, KOBEREC: 9, MOZAIKA: 10 };
  const PODLAHA = {
    [P.SUROVA]: { nazev: 'surová skála', mini: null }, [P.TRAVA]: { nazev: 'tráva', mini: '#55703a' },
    [P.CESTA]: { nazev: 'cesta', mini: '#9b8158' }, [P.HLINA]: { nazev: 'hlína', mini: '#6f573b' },
    [P.STERK]: { nazev: 'štěrk', mini: '#8a8475' }, [P.MECH]: { nazev: 'mech', mini: '#3f5a4c' },
    [P.DLAZBA]: { nazev: 'kamenná dlažba', mini: '#9a958c' }, [P.SACHOVNICE]: { nazev: 'šachovnice', mini: '#888' },
    [P.PRKNA]: { nazev: 'prkna', mini: '#8a6038' }, [P.KOBEREC]: { nazev: 'koberec', mini: '#8a2d2d' },
    [P.MOZAIKA]: { nazev: 'mozaika', mini: '#b08a3c' },
  };

  const R = { NIC: 0, UHLI: 1, ZELEZO: 2, MED: 3, STRIBRO: 4, ZLATO: 5, DRAHOKAM: 6, HVEZDNA: 7 };
  // od/do = hloubka v metrech (jako v bočním řezu); patro žíly se losuje podle hloubky
  const RUDA = {
    [R.UHLI]:     { nazev: 'uhlí', od: -12, do: 60, zil: 16, delka: [8, 18], sila: 2, barva: [34, 32, 38], mini: '#1b1b1f' },
    [R.MED]:      { nazev: 'měděná ruda', od: 38, do: 95, zil: 8, delka: [6, 12], sila: 1, barva: [214, 126, 64], mini: '#d0793b' },
    [R.ZELEZO]:   { nazev: 'železná ruda', od: 48, do: 105, zil: 11, delka: [8, 16], sila: 2, barva: [178, 76, 52], mini: '#b0482e' },
    [R.ZLATO]:    { nazev: 'zlato', od: 80, do: 100, zil: 6, delka: [6, 12], sila: 1, barva: [246, 204, 70], mini: '#f2c53d' },
    [R.STRIBRO]:  { nazev: 'stříbro', od: 80, do: 135, zil: 6, delka: [5, 10], sila: 1, barva: [226, 232, 240], mini: '#dfe6ee' },
    [R.DRAHOKAM]: { nazev: 'drahokamy', od: 95, do: 152, zil: 14, delka: [1, 3], sila: 1, barva: [70, 220, 205], mini: '#3fd3c5' },
    [R.HVEZDNA]:  { nazev: 'hvězdná ruda', od: 120, do: 140, zil: 3, delka: [3, 5], sila: 1, barva: [170, 150, 255], mini: '#9f8cff' },
  };
  const HVEZDNE_MIN = 10;

  const O = { NIC: 0, JEDLE: 1, KER: 2, BALVAN: 3, KRAPNIK: 4, HOUBA: 5, KRYSTAL: 6, DESKA: 7, VYHEN: 8,
              BRANA: 9, KOSTI: 10, SLOUP: 11, OLTAR: 12, POKLAD: 13, SCHODY_DOLU: 14, SCHODY_NAHORU: 15,
              MOST: 16, MOST_ROZBITY: 17, JECMEN: 18, PAREZ: 19, DIRA: 20, ZEBRIK: 21, SACHTA: 22 };
  const OBJEKT = {
    [O.JEDLE]: 'jedle', [O.KER]: 'keř', [O.BALVAN]: 'balvan', [O.KRAPNIK]: 'krápník', [O.HOUBA]: 'obří houba',
    [O.KRYSTAL]: 'krystal', [O.DESKA]: 'runová deska', [O.VYHEN]: 'Výheň předků', [O.BRANA]: 'Brána předků',
    [O.KOSTI]: 'kosti', [O.SLOUP]: 'sloup předků', [O.OLTAR]: 'oltář předků', [O.POKLAD]: 'poklad předků',
    [O.SCHODY_DOLU]: 'schodiště dolů', [O.SCHODY_NAHORU]: 'schodiště nahoru', [O.MOST]: 'most',
    [O.MOST_ROZBITY]: 'polorozpadlý most', [O.JECMEN]: 'divoký ječmen', [O.PAREZ]: 'pařez',
    [O.DIRA]: 'díra do patra pod', [O.ZEBRIK]: 'žebřík do díry', [O.SACHTA]: 'šachta s rumpálem',
  };
  const K = { NIC: 0, VODA: 1, MAGMA: 2 };
  const HLUBOKA = 4;            // kap ≥ 4 = neprůchozí hluboká voda

  const TYPY_OBLASTI = {
    rokle: 'rokle', predsin: 'předsíň za Bránou', schody: 'schodiště předků', trziste: 'místo pro tržiště',
    jeskyne: 'jeskyně', krapnikova: 'krápníková jeskyně', houbova: 'houbová jeskyně', jezero: 'podzemní jezero',
    hlubinna: 'hlubinná jeskyně', magma: 'magmatická kapsa', tunel: 'goblinní tunel',
    straznice: 'strážnice předků', sin_predku: 'Síň předků', srdce: 'Srdce hory',
  };

  const PATRA = [
    { nazev: 'Povrch', hloubka: 'rokle a úbočí', hornina: 'vápenec, hlína', R: 0 },
    { nazev: '1. patro', hloubka: '0–20 m', hornina: 'hlína, jíl', R: 2 },
    { nazev: '2. patro', hloubka: '20–40 m', hornina: 'vápenec', R: 3 },
    { nazev: '3. patro', hloubka: '40–60 m', hornina: 'vápenec, žula', R: 4 },
    { nazev: '4. patro', hloubka: '60–80 m', hornina: 'žula', R: 5 },
    { nazev: '5. patro', hloubka: '80–100 m', hornina: 'žula, čedič', R: 5 },
    { nazev: '6. patro', hloubka: '100–120 m', hornina: 'čedič', R: 4 },
    { nazev: '7. patro', hloubka: '120–140 m', hornina: 'čedič, hlubinný kámen', R: 4, varovani: 'hora duní' },
    { nazev: '8. patro', hloubka: '140–160 m', hornina: 'hlubinný kámen', R: 4, varovani: 'pásmo Spáče' },
  ];

  function horninaPatra(p, a, b) {
    switch (p) {
      case 0: return a < 0.4 ? M.HLINA : (b > 0.68 ? M.ZULA : M.VAPENEC);
      case 1: return b > 0.6 ? M.JIL : M.HLINA;
      case 2: return b > 0.7 ? M.JIL : M.VAPENEC;
      case 3: return a < 0.5 ? M.VAPENEC : M.ZULA;
      case 4: return b > 0.7 ? M.CEDIC : M.ZULA;
      case 5: return a < 0.5 ? M.ZULA : M.CEDIC;
      case 6: return b < 0.32 ? M.ZULA : M.CEDIC;
      case 7: return a < 0.5 ? M.CEDIC : M.HLUBINNY;
      default: return M.HLUBINNY;
    }
  }

  // --- jména hor --------------------------------------------------------------------
  const SLAB1 = ['Khaz', 'Dur', 'Bar', 'Gun', 'Thrar', 'Ered', 'Mor', 'Kal', 'Azan', 'Grim', 'Bel', 'Nar', 'Zirak', 'Dol'];
  const SLAB2 = ['dûm', 'heim', 'grund', 'zar', 'bor', 'gûl', 'thuk', 'mar', 'ak', 'rûn'];
  const CESKY = ['Šedý štít', 'Železný roh', 'Kladivový vrch', 'Dračí zub', 'Mlčící hora', 'Stará výheň',
    'Kamenná koruna', 'Studený vrch', 'Zlatá hlava', 'Bouřný štít', 'Vraní hora', 'Hluboký kořen'];

  // --- šablony ruin -----------------------------------------------------------------
  // # zdivo, . dlažba, M mozaika, I sloup, O oltář, D deska, P poklad, K kosti, ' ' = nechat horninu
  const SIN_PREDKU = [
    '      #######      ',
    '    ###..O..###    ',
    '  ###....M....###  ',
    '###.....MMM.....###',
    '#..I...MMMMM...I..#',
    '#......MMMMM......#',
    '#..I....MMM....I..#',
    '#.................#',
    '#..I...........I..#',
    '#.................#',
    '#..I..D.....P..I..#',
    '#.................#',
    '###################',
  ];
  const STRAZNICE = [
    '#########',
    '#.......#',
    '#.I...I.#',
    '#...D...#',
    '#.I..KI.#',
    '#.......#',
    '#########',
  ];

  // ===================================================================================
  function generuj(seed, velikost) {
    seed = seed >>> 0;
    velikost = VELIKOSTI[velikost] ? velikost : 'stredni';
    const W = VELIKOSTI[velikost], H = W, N = W * H, NP = PATER * N;
    const NAS = (W / 96) * (W / 96);
    const rng = Nahoda(smichej(seed, 1, 0));
    const r = rng.dalsi;
    const ix = (p, x, y) => p * N + y * W + x;
    const uvnitr = (x, y) => x >= 1 && y >= 1 && x < W - 1 && y < H - 1;

    const sv = {
      seed, velikost, W, H, P: PATER, N,
      jmeno: rng.sance(0.5) ? rng.vyber(SLAB1) + rng.vyber(SLAB2) : rng.vyber(CESKY),
      teren: new Uint8Array(NP), zaklad: new Uint8Array(NP), podlaha: new Uint8Array(NP),
      obj: new Uint8Array(NP), ruda: new Uint8Array(NP), kap: new Uint8Array(NP), kapTyp: new Uint8Array(NP),
      otes: new Uint8Array(NP), oblast: new Uint16Array(NP), zn: new Uint8Array(NP),
      oblasti: [null], schody: [], brana: null, vstup: null, trziste: null, most: null, srdce: null,
    };
    const rez = new Uint8Array(NP);          // rezervace míst při generování

    // --- 1. horniny všech pater ------------------------------------------------------
    for (let p = 0; p < PATER; p++) {
      const nA = fbm(smichej(seed, p, 11), 3), nB = fbm(smichej(seed, p, 12), 2);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const m = uvnitr(x, y) ? horninaPatra(p, nA(x / 16, y / 16), nB(x / 9, y / 9)) : M.PODLOZI;
        const i = ix(p, x, y);
        sv.teren[i] = sv.zaklad[i] = m;
      }
    }

    const novaOblast = (typ, p, extra) => {
      const o = Object.assign({ id: sv.oblasti.length, typ, p, x0: W, y0: H, x1: -1, y1: -1, pocet: 0 }, extra || {});
      sv.oblasti.push(o);
      return o;
    };
    const vytesej = (p, x, y, o, podlaha, otesat) => {
      const i = ix(p, x, y);
      sv.teren[i] = M.VOLNO; sv.podlaha[i] = podlaha; sv.otes[i] = otesat ? 1 : 0; sv.ruda[i] = R.NIC;
      if (o) {
        if (!sv.oblast[i]) o.pocet++;
        sv.oblast[i] = o.id;
        if (x < o.x0) o.x0 = x; if (y < o.y0) o.y0 = y; if (x > o.x1) o.x1 = x; if (y > o.y1) o.y1 = y;
      }
      return i;
    };
    // zeď: zdivo a runová zeď si v `zaklad` pamatují přírodní horninu za sebou (barva masivu, co zbyde po vybourání)
    const zed = (p, x, y, m) => {
      const i = ix(p, x, y); sv.teren[i] = m; sv.ruda[i] = R.NIC;
      if (m !== M.CIHLA && m !== M.RUNA) sv.zaklad[i] = m;
    };
    const rezervuj = (p, x0, y0, x1, y1) => {
      for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
        for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) rez[ix(p, x, y)] = 1;
    };
    // obložení otesaného prostoru zdivem (pevná sousední pole → m)
    const oblozZdivem = (p, o, m) => {
      for (let y = o.y0 - 1; y <= o.y1 + 1; y++) for (let x = o.x0 - 1; x <= o.x1 + 1; x++) {
        if (!uvnitr(x, y) || sv.teren[ix(p, x, y)] === M.VOLNO) continue;
        let u = false;
        for (let dy = -1; dy <= 1 && !u; dy++) for (let dx = -1; dx <= 1; dx++) {
          const j = ix(p, x + dx, y + dy);
          if (sv.teren[j] === M.VOLNO && sv.oblast[j] === o.id) { u = true; break; }
        }
        if (u) zed(p, x, y, m);
      }
    };

    // --- 2. povrch: rokle ------------------------------------------------------------
    const nS = fbm(smichej(seed, 0, 21), 3), nW = fbm(smichej(seed, 0, 22), 2);
    const nE = fbm(smichej(seed, 0, 23), 3), nL = fbm(smichej(seed, 0, 24), 3);
    const stred = y => W * 0.4 + (nS(0.5, y / 28) - 0.5) * W * 0.45;
    const pulka = y => W * (0.085 + 0.06 * nW(3.3, y / 22));
    const rokle = novaOblast('rokle', 0);
    for (let y = 0; y < H; y++) for (let x = 1; x < W - 1; x++) {
      const d = Math.abs(x + 0.5 - stred(y));
      if (d < 3 || (x >= 2 && x < W - 2 && d < pulka(y) + (nE(x / 5, y / 5) - 0.5) * 6))
        vytesej(0, x, y, rokle, P.TRAVA, false);
    }
    // vzdálenost od útesu v rokli (BFS od skály)
    const dUtes = new Int16Array(N).fill(-1);
    {
      const fronta = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (sv.teren[ix(0, x, y)] !== M.VOLNO) { dUtes[y * W + x] = 0; fronta.push(y * W + x); }
      }
      for (let h = 0; h < fronta.length; h++) {
        const c = fronta[h], cx = c % W, cy = (c / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = cx + dx, y = cy + dy;
          if (x < 0 || y < 0 || x >= W || y >= H || dUtes[y * W + x] >= 0) continue;
          dUtes[y * W + x] = dUtes[c] + 1; fronta.push(y * W + x);
        }
      }
    }
    // tráva, les, louky, balvany u útesů
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = ix(0, x, y);
      if (sv.teren[i] !== M.VOLNO) continue;
      const d = dUtes[y * W + x], les = nL(x / 7, y / 7);
      if (d <= 1) { sv.podlaha[i] = r() < 0.6 ? P.STERK : P.HLINA; if (r() < 0.14) sv.obj[i] = O.BALVAN; continue; }
      if (les > 0.56 && r() < 0.5) sv.obj[i] = O.JEDLE;
      else if (les > 0.5 && r() < 0.08) sv.obj[i] = O.KER;
      else if (les < 0.42 && r() < 0.035) sv.obj[i] = O.JECMEN;
      else if (r() < 0.012) sv.obj[i] = O.BALVAN;
      if (les > 0.6 && r() < 0.3) sv.podlaha[i] = P.HLINA;
    }
    // cesta od jihu na sever
    const cestaX = y => Math.round(stred(y) + (nS(7.1, y / 14) - 0.5) * 4);
    for (let y = 0; y < H; y++) {
      const cx = cestaX(y);
      for (let x = cx - 1; x <= cx; x++) {
        const i = ix(0, x, y);
        if (sv.teren[i] !== M.VOLNO) vytesej(0, x, y, rokle, P.CESTA, false);
        sv.podlaha[i] = P.CESTA; sv.obj[i] = O.NIC;
      }
    }
    // potok: na severu u východního útesu, v soutěsce napříč roklí, na jihu u západního
    const yb = Math.round(H * 0.72);
    const potok = (x, y, kap) => {
      if (!uvnitr(x, y)) return;
      const i = ix(0, x, y);
      if (sv.teren[i] !== M.VOLNO) vytesej(0, x, y, rokle, P.STERK, false);
      sv.kap[i] = kap; sv.kapTyp[i] = K.VODA; sv.obj[i] = O.NIC;
      if (sv.podlaha[i] !== P.CESTA) sv.podlaha[i] = P.STERK;
    };
    const nP = fbm(smichej(seed, 0, 25), 2);
    for (let y = 0; y < H; y++) {
      if (y >= yb && y <= yb + 1) continue;
      const sx = Math.round(stred(y) + (y < yb ? 1 : -1) * pulka(y) * 0.6 + (nP(2, y / 6) - 0.5) * 3);
      potok(sx, y, 2);
      if (nP(5, y / 4) > 0.55) potok(sx + 1, y, 1);
    }
    // soutěska: celá šíře rokle v řádcích yb, yb+1 je hluboká, jen u východního útesu brod
    // brod = dva sloupce u východního útesu, které jsou volné ve všech řádcích kolem soutěsky
    let brodX = W;
    for (let y = yb - 1; y <= yb + 2; y++) {
      let vych = -1;
      for (let x = 1; x < W - 1; x++) if (sv.teren[ix(0, x, y)] === M.VOLNO) vych = x;
      brodX = Math.min(brodX, vych - 1);
    }
    for (let y = yb; y <= yb + 1; y++) for (let x = 1; x < W - 1; x++) {
      if (sv.teren[ix(0, x, y)] === M.VOLNO || (x >= brodX && x <= brodX + 1)) potok(x, y, x >= brodX ? 2 : 7);
    }
    for (let y = yb - 1; y <= yb + 2; y += 3) for (let x = brodX; x <= brodX + 1; x++) {
      const i = ix(0, x, y); if (sv.teren[i] !== M.VOLNO) vytesej(0, x, y, rokle, P.STERK, false);
      if (sv.obj[i] === O.JEDLE) sv.obj[i] = O.NIC;
    }
    {
      const cx = cestaX(yb);
      for (let y = yb; y <= yb + 1; y++) for (let x = cx - 1; x <= cx; x++) sv.obj[ix(0, x, y)] = O.MOST_ROZBITY;
      sv.most = { x: cx - 1, y: yb, w: 2, h: 2, brod: { x: brodX, y: yb } };
      // břehy soutěsky štěrkové
      for (const y of [yb - 1, yb + 2]) for (let x = 1; x < W - 1; x++) {
        const i = ix(0, x, y);
        if (sv.teren[i] === M.VOLNO && sv.podlaha[i] === P.TRAVA) { sv.podlaha[i] = P.STERK; if (sv.obj[i] === O.JEDLE) sv.obj[i] = O.NIC; }
      }
    }

    // --- 3. Brána předků, předsíň a schodiště do 1. patra -------------------------------
    const yg = Math.round(H * 0.36);
    let xg = 0;
    for (const y of [yg - 1, yg]) {
      let x = Math.round(stred(y));
      while (x < W - 2 && sv.teren[ix(0, x, y)] === M.VOLNO) x++;
      xg = Math.max(xg, x);
    }
    xg = Math.min(xg, W - 12);
    const predsin = novaOblast('predsin', 0);
    // průchod branou (2 pole vysoký) – od rokle až do předsíně
    for (const y of [yg - 1, yg]) {
      let x = xg;
      while (x > 1 && sv.teren[ix(0, x - 1, y)] !== M.VOLNO) x--;
      for (; x <= xg + 1; x++) vytesej(0, x, y, predsin, P.DLAZBA, true);
      sv.obj[ix(0, xg, y)] = O.BRANA;
    }
    for (let y = yg - 2; y <= yg + 1; y++) for (let x = xg + 2; x <= xg + 7; x++) vytesej(0, x, y, predsin, P.DLAZBA, true);
    oblozZdivem(0, predsin, M.CIHLA);     // i fasáda kolem Brány; volná pole rokle zůstanou volná
    sv.brana = { p: 0, x: xg, y: yg - 1 };
    sv.vstup = { p: 0, x: xg + 4, y: yg };
    const sx = xg + 7, sy = yg + 1;
    sv.obj[ix(0, sx, sy)] = O.SCHODY_DOLU;
    const podest = novaOblast('schody', 1);
    for (let y = sy - 1; y <= sy + 1; y++) for (let x = sx - 2; x <= sx; x++) vytesej(1, x, y, podest, P.DLAZBA, true);
    oblozZdivem(1, podest, M.CIHLA);
    sv.obj[ix(1, sx, sy)] = O.SCHODY_NAHORU;
    sv.schody.push({ p: 0, x: sx, y: sy, smer: 1 }, { p: 1, x: sx, y: sy, smer: -1 });
    rezervuj(0, xg - 1, yg - 8, xg + 14, yg + 7);
    rezervuj(1, sx - 9, sy - 8, sx + 7, sy + 7);
    rezervuj(0, 0, 0, W - 1, H - 1);      // na povrchu se už nic nevkládá do masivu

    // --- 4. místo pro tržiště: rovná louka u cesty mezi Branou a mostem ------------------
    {
      const yt = Math.round((yg + yb) / 2);
      let nej = null;
      for (let dy = 0; dy < 14 && !nej; dy++) for (const yy of [yt + dy, yt - dy]) {
        const cx = cestaX(yy);
        for (const x0 of [cx + 2, cx - 7, cx + 3, cx - 8]) {
          let ok = true;
          for (let y = yy; y < yy + 5 && ok; y++) for (let x = x0; x < x0 + 5; x++) {
            const i = ix(0, x, y);
            if (!uvnitr(x, y) || sv.teren[i] !== M.VOLNO || sv.kap[i] || sv.podlaha[i] === P.CESTA || dUtes[y * W + x] < 2) { ok = false; break; }
          }
          if (ok) { nej = { x0, y0: yy }; break; }
        }
        if (nej) break;
      }
      if (nej) {
        const o = novaOblast('trziste', 0);
        for (let y = nej.y0; y < nej.y0 + 5; y++) for (let x = nej.x0; x < nej.x0 + 5; x++) {
          const i = ix(0, x, y); sv.obj[i] = O.NIC; sv.podlaha[i] = P.TRAVA;
          o.pocet++; o.x0 = Math.min(o.x0, x); o.y0 = Math.min(o.y0, y); o.x1 = Math.max(o.x1, x); o.y1 = Math.max(o.y1, y);
        }
        sv.trziste = { x: nej.x0, y: nej.y0, w: 5, h: 5, oblast: o.id };
      }
    }

    // --- 5. podzemí: pomocníci -------------------------------------------------------
    function volneMisto(p, x0, y0, x1, y1) {
      if (x0 < 1 || y0 < 1 || x1 > W - 2 || y1 > H - 2) return false;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = ix(p, x, y);
        if (rez[i] || !prirodni(sv.teren[i])) return false;
      }
      return true;
    }
    function najdiMisto(p, w, h, okraj, pokusu) {
      for (let t = 0; t < (pokusu || 300); t++) {
        const x0 = rng.cele(2 + okraj, W - 3 - okraj - w), y0 = rng.cele(2 + okraj, H - 3 - okraj - h);
        if (volneMisto(p, x0 - okraj, y0 - okraj, x0 + w - 1 + okraj, y0 + h - 1 + okraj)) return { x0, y0 };
      }
      return null;
    }
    function stred_(o) { o.sx = (o.x0 + o.x1 + 1) / 2; o.sy = (o.y0 + o.y1 + 1) / 2; return o; }

    function vlozSablonu(p, sablona, typ) {
      const h = sablona.length, w = sablona[0].length;
      const m = najdiMisto(p, w, h, 3, 600);
      if (!m) return null;
      const o = novaOblast(typ, p);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const c = sablona[y][x], X = m.x0 + x, Y = m.y0 + y;
        if (c === ' ') continue;
        if (c === '#') { zed(p, X, Y, M.CIHLA); continue; }
        const i = vytesej(p, X, Y, o, c === 'M' ? P.MOZAIKA : P.DLAZBA, true);
        sv.obj[i] = { I: O.SLOUP, O: O.OLTAR, D: O.DESKA, P: O.POKLAD, K: O.KOSTI }[c] || O.NIC;
      }
      rezervuj(p, m.x0 - 3, m.y0 - 3, m.x0 + w + 2, m.y0 + h + 2);
      return stred_(o);
    }

    // jeskyně buněčným automatem v obdélníku w × h
    function jeskyne(p, w, h, typ, hustota) {
      for (let pokus = 0; pokus < 6; pokus++) {
        const m = najdiMisto(p, w, h, 2);
        if (!m) return null;
        let g = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const ex = (x + 0.5 - w / 2) / (w / 2), ey = (y + 0.5 - h / 2) / (h / 2), e = ex * ex + ey * ey;
          g[y * w + x] = e < 1 && r() < (hustota || 0.5) + (1 - e) * 0.25 ? 1 : 0;
        }
        for (let it = 0; it < 4; it++) {
          const n = new Uint8Array(w * h);
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            let s = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const X = x + dx, Y = y + dy;
              if (X >= 0 && Y >= 0 && X < w && Y < h) s += g[Y * w + X];
            }
            n[y * w + x] = s >= 5 || (g[y * w + x] && s >= 4) ? 1 : 0;
          }
          g = n;
        }
        // jen největší souvislá část (4-sousedství, ať jeskyně drží pohromadě i pro chůzi)
        const kom = new Int32Array(w * h).fill(-1); let nejK = -1, nejV = 0;
        for (let s = 0; s < w * h; s++) {
          if (!g[s] || kom[s] >= 0) continue;
          const f = [s]; kom[s] = s;
          for (let k = 0; k < f.length; k++) {
            const c = f[k], cx = c % w, cy = (c / w) | 0;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const X = cx + dx, Y = cy + dy, j = Y * w + X;
              if (X < 0 || Y < 0 || X >= w || Y >= h || !g[j] || kom[j] >= 0) continue;
              kom[j] = s; f.push(j);
            }
          }
          if (f.length > nejV) { nejV = f.length; nejK = s; }
        }
        if (nejV < w * h * 0.18) continue;
        const o = novaOblast(typ, p);
        for (let s = 0; s < w * h; s++) if (kom[s] === nejK) vytesej(p, m.x0 + s % w, m.y0 + ((s / w) | 0), o, P.SUROVA, false);
        rezervuj(p, m.x0 - 2, m.y0 - 2, m.x0 + w + 1, m.y0 + h + 1);
        return stred_(o);
      }
      return null;
    }
    const bunkyOblasti = o => {
      const v = [];
      for (let y = o.y0; y <= o.y1; y++) for (let x = o.x0; x <= o.x1; x++) {
        const i = ix(o.p, x, y); if (sv.oblast[i] === o.id && sv.teren[i] === M.VOLNO) v.push(i);
      }
      return v;
    };
    // vzdálenost volných polí oblasti od skály (1 = u stěny)
    const odSteny = o => {
      const d = new Map(), f = [];
      for (const i of bunkyOblasti(o)) {
        const x = i % W, y = ((i - o.p * N) / W) | 0;
        let u = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (sv.teren[ix(o.p, x + dx, y + dy)] !== M.VOLNO) u = true;
        if (u) { d.set(i, 1); f.push(i); }
      }
      for (let h = 0; h < f.length; h++) {
        const c = f[h], x = c % W, y = ((c - o.p * N) / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const j = ix(o.p, x + dx, y + dy);
          if (sv.oblast[j] === o.id && sv.teren[j] === M.VOLNO && !d.has(j)) { d.set(j, d.get(c) + 1); f.push(j); }
        }
      }
      return d;
    };

    // --- 6. Srdce hory (8. patro) ----------------------------------------------------
    {
      const RS = 8, m = najdiMisto(8, 2 * RS + 1, 2 * RS + 1, 3, 900) || { x0: (W >> 1) - RS, y0: (H >> 1) - RS };
      const cx = m.x0 + RS, cy = m.y0 + RS;
      const o = novaOblast('srdce', 8);
      for (let dy = -RS; dy <= RS; dy++) for (let dx = -RS; dx <= RS; dx++) {
        const d = Math.hypot(dx, dy);
        if (d <= 6.4) vytesej(8, cx + dx, cy + dy, o, d <= 3.6 ? P.MOZAIKA : P.DLAZBA, true);
        else if (d <= 7.9) zed(8, cx + dx, cy + dy, M.RUNA);
      }
      sv.obj[ix(8, cx, cy)] = O.VYHEN;
      for (const [dx, dy] of [[4, 4], [-4, 4], [4, -4], [-4, -4]]) sv.obj[ix(8, cx + dx, cy + dy)] = O.SLOUP;
      rezervuj(8, cx - RS - 3, cy - RS - 3, cx + RS + 3, cy + RS + 3);
      stred_(o); o.sx = cx + 0.5; o.sy = cy + 0.5; o.mozaika = { x: cx + 0.5, y: cy + 0.5, r: 3.9 };
      sv.srdce = { p: 8, x: cx, y: cy, oblast: o.id };
    }

    // --- 7. goblinní tunel z okraje 8. patra ------------------------------------------
    for (let pokus = 0; pokus < 30; pokus++) {
      const strana = rng.cele(0, 3);
      let x, y, ux, uy;
      const t = rng.cele(10, W - 11);
      if (strana === 0) { x = 1; y = t; ux = 1; uy = 0; } else if (strana === 1) { x = W - 2; y = t; ux = -1; uy = 0; }
      else if (strana === 2) { x = t; y = 1; ux = 0; uy = 1; } else { x = t; y = H - 2; ux = 0; uy = -1; }
      const cesta = [];
      let ok = true, fx = x, fy = y, ang = Math.atan2(uy, ux);
      const delka = Math.round(W * 0.3);
      for (let k = 0; k < delka && ok; k++) {
        const X = Math.round(fx), Y = Math.round(fy);
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const xx = X + dx, yy = Y + dy;
          if (!volneMisto(8, Math.max(1, xx - 2), Math.max(1, yy - 2), Math.min(W - 2, xx + 2), Math.min(H - 2, yy + 2)) && k > 2) ok = false;
          cesta.push([xx, yy]);
        }
        ang += (r() - 0.5) * 0.5;
        const za = Math.atan2(uy, ux);           // drž směr dovnitř
        ang = za + Math.max(-0.7, Math.min(0.7, ang - za));
        fx += Math.cos(ang); fy += Math.sin(ang);
      }
      const kx = Math.round(fx) - 2, ky = Math.round(fy) - 2;
      if (!ok || !volneMisto(8, kx - 2, ky - 2, kx + 6, ky + 5)) continue;
      const o = novaOblast('tunel', 8);
      for (const [xx, yy] of cesta) if (uvnitr(xx, yy)) vytesej(8, xx, yy, o, P.SUROVA, false);
      for (let yy = ky; yy < ky + 4; yy++) for (let xx = kx; xx < kx + 5; xx++) vytesej(8, xx, yy, o, P.HLINA, false);
      sv.obj[ix(8, kx + 1, ky + 1)] = O.KOSTI;
      // ústí tunelu: pole na okraji mapy
      const ex = strana === 0 ? 0 : strana === 1 ? W - 1 : x, ey = strana === 2 ? 0 : strana === 3 ? H - 1 : y;
      for (const [dx, dy] of [[0, 0], [ux ? 0 : 1, ux ? 1 : 0]]) vytesej(8, ex + dx, ey + dy, o, P.SUROVA, false);
      for (const [xx, yy] of cesta) rezervuj(8, xx - 2, yy - 2, xx + 2, yy + 2);
      rezervuj(8, kx - 2, ky - 2, kx + 6, ky + 5);
      stred_(o); o.vstup = { x: ex, y: ey };
      break;
    }

    // --- 8. ruiny, jezero, jeskyně ---------------------------------------------------
    const sinPredku = vlozSablonu(6, SIN_PREDKU, 'sin_predku');
    if (sinPredku) sinPredku.mozaika = { x: sinPredku.x0 + 9.5, y: sinPredku.y0 + 5, r: 2.7 };
    {
      const o = jeskyne(6, Math.round(18 * Math.sqrt(NAS)), Math.round(13 * Math.sqrt(NAS)), 'jezero', 0.6);
      if (o) {
        const d = odSteny(o);
        for (const [i, v] of d) {
          if (v === 1) { sv.podlaha[i] = P.STERK; if (r() < 0.15) sv.obj[i] = O.BALVAN; }
          else { sv.kap[i] = v === 2 ? 3 : 7; sv.kapTyp[i] = K.VODA; if (v >= 3 && r() < 0.025) sv.obj[i] = O.BALVAN; }
        }
      }
    }
    const pocet = n => Math.max(1, Math.round(n * NAS));
    for (let k = 0; k < pocet(2); k++) {
      const o = vlozSablonu(rng.cele(3, 5), STRAZNICE, 'straznice');
      if (o) o.mozaika = null;
    }
    const PLAN = [
      ['jeskyne', 1, 1, 10, 8], ['krapnikova', 2, 2, 14, 10], ['krapnikova', 3, 1, 14, 10],
      ['jeskyne', 3, 2, 12, 9], ['jeskyne', 4, 3, 12, 9], ['jeskyne', 5, 1, 11, 8],
      ['houbova', 6, 2, 14, 11], ['hlubinna', 7, 2, 13, 10], ['hlubinna', 8, 1, 13, 10], ['magma', 8, 3, 9, 7],
    ];
    for (const [typ, p, n, w, h] of PLAN) for (let k = 0; k < pocet(n); k++) {
      const o = jeskyne(p, w + rng.cele(-2, 2), h + rng.cele(-1, 1), typ, typ === 'magma' ? 0.6 : 0.5);
      if (!o) continue;
      const bunky = bunkyOblasti(o);
      for (const i of bunky) {
        if (typ === 'krapnikova') { if (r() < 0.11) sv.obj[i] = O.KRAPNIK; else if (r() < 0.04) sv.kap[i] = 1; }
        else if (typ === 'jeskyne') { if (r() < 0.03) sv.obj[i] = O.BALVAN; else if (r() < 0.015) sv.obj[i] = O.KOSTI; }
        else if (typ === 'houbova') { sv.podlaha[i] = P.MECH; if (r() < 0.14) sv.obj[i] = O.HOUBA; else if (r() < 0.05) sv.kap[i] = 1; }
        else if (typ === 'hlubinna') { if (r() < 0.08) sv.obj[i] = O.KRYSTAL; }
        else if (typ === 'magma') { sv.kap[i] = 7; sv.kapTyp[i] = K.MAGMA; }
        if (sv.kap[i] && !sv.kapTyp[i]) sv.kapTyp[i] = K.VODA;
      }
      if (typ === 'magma') {           // okraj kapsy ztuhl na obsidián
        for (const i of bunky) {
          const x = i % W, y = ((i - o.p * N) / W) | 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const j = ix(o.p, x + dx, y + dy);
            if (prirodni(sv.teren[j])) zed(o.p, x + dx, y + dy, M.OBSIDIAN);
          }
        }
      }
    }

    // --- 9. rudné žíly ---------------------------------------------------------------
    function zila(p, typ) {
      const def = RUDA[typ];
      let x = 0, y = 0, t = 0;
      do { x = rng.cele(2, W - 3); y = rng.cele(2, H - 3); t++; } while (t < 50 && !prirodni(sv.teren[ix(p, x, y)]));
      const delka = rng.cele(def.delka[0], def.delka[1]);
      let ang = r() * Math.PI * 2, fx = x, fy = y, n = 0;
      const poloz = (X, Y) => {
        if (!uvnitr(X, Y)) return;
        const i = ix(p, X, Y);
        if (prirodni(sv.teren[i]) && sv.ruda[i] !== typ) { sv.ruda[i] = typ; n++; }
      };
      for (let k = 0; k < delka; k++) {
        const X = Math.round(fx), Y = Math.round(fy);
        poloz(X, Y);
        if (def.sila > 1 && r() < 0.7) poloz(X + Math.round(-Math.sin(ang)), Y + Math.round(Math.cos(ang)));
        ang += (r() - 0.5) * 0.9; fx += Math.cos(ang); fy += Math.sin(ang);
      }
      return n;
    }
    const patroHloubky = d => Math.max(1, Math.min(8, Math.floor(d / HLOUBKA_PATRA) + 1));
    for (const typ of [R.UHLI, R.MED, R.ZELEZO, R.ZLATO, R.STRIBRO, R.DRAHOKAM, R.HVEZDNA]) {
      const def = RUDA[typ], n = Math.round(def.zil * 1.6 * NAS);
      for (let k = 0; k < n; k++) zila(patroHloubky(def.od + r() * (def.do - def.od)), typ);
    }
    const spocti = (p, typ) => { let n = 0; for (let i = p * N; i < (p + 1) * N; i++) if (sv.ruda[i] === typ) n++; return n; };
    for (let t = 0; t < 20 && spocti(5, R.ZLATO) < 6; t++) zila(5, R.ZLATO);
    for (let t = 0; t < 30 && spocti(7, R.HVEZDNA) < HVEZDNE_MIN; t++) zila(7, R.HVEZDNA);

    // --- 10. viditelnost na začátku: povrch celý, podesta schodiště v 1. patře ---------
    for (let i = 0; i < N; i++) sv.zn[i] = 1;
    for (let y = podest.y0 - 1; y <= podest.y1 + 1; y++) for (let x = podest.x0 - 1; x <= podest.x1 + 1; x++) sv.zn[ix(1, x, y)] = 1;
    return sv;
  }

  function odkrytVse(sv) { sv.zn.fill(1); }

  // popis pole pro rozhraní a testy
  function popisPole(sv, p, x, y) {
    if (x < 0 || y < 0 || x >= sv.W || y >= sv.H) return null;
    const i = p * sv.N + y * sv.W + x;
    if (!sv.zn[i]) return { znamo: false, text: 'neprozkoumaná hora' };
    const v = { znamo: true, volne: sv.teren[i] === M.VOLNO, hornina: MATERIAL[sv.zaklad[i]].nazev };
    const casti = [];
    if (sv.obj[i]) casti.push(OBJEKT[sv.obj[i]]);
    if (sv.kap[i]) casti.push((sv.kapTyp[i] === K.MAGMA ? 'magma' : sv.kap[i] >= HLUBOKA ? 'hluboká voda' : 'mělká voda'));
    if (v.volne) casti.push(PODLAHA[sv.podlaha[i]].nazev + (sv.podlaha[i] === P.SUROVA ? ' (' + v.hornina + ')' : ''));
    else casti.push(MATERIAL[sv.teren[i]].nazev + (sv.ruda[i] ? ' s žilou: ' + RUDA[sv.ruda[i]].nazev : ''));
    const o = sv.oblast[i] && sv.oblasti[sv.oblast[i]];
    if (o && o.typ !== 'rokle') casti.push(TYPY_OBLASTI[o.typ]);
    v.text = casti.join(' · ');
    return v;
  }

  S.svet = { VELIKOSTI, PATER, HLOUBKA_PATRA, HLUBOKA, HVEZDNE_MIN, M, MATERIAL, P, PODLAHA, R, RUDA, O, OBJEKT, K,
             TYPY_OBLASTI, PATRA, prirodni, generuj, odkrytVse, popisPole };
})(SIN);

if (typeof module !== 'undefined') module.exports = SIN;

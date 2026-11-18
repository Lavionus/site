/* Origami – definice tradičních modelů jako posloupnost operací jádra (OrigamiJadro).
   Tradiční modely nemají autora; diagramy kreslí jádro z této geometrie.
   Body: B(x, y) = aktuální poloha bodu papíru (souřadnice papíru 0..1, y dolů), [x, y] = přímo poloha na stole. */
(function () {
  'use strict';
  const J = typeof module !== 'undefined' ? require('./jadro.js') : window.OrigamiJadro;

  /* ---------- pomocníci pro zápis kroků ---------- */
  const B = (x, y, s = 0) => st => J.bod(st, [x, y], s);
  const V = o => Object.assign({ op: 'prehyb', druh: 'udoli' }, o);
  const H = o => Object.assign({ op: 'prehyb', druh: 'hora' }, o);
  const vice = (text, ...ops) => ({ op: 'vice', ops, text });
  const otoc = (text, osa) => ({ op: 'otoc', osa, text: text || 'Otočte papír na druhou stranu.' });
  const pootoc = (uhel, text) => ({ op: 'pootoc', uhel, text });
  const stav = (text, plosky, sipky) => ({ op: 'stav', plosky, text, sipky });
  /** Přímka se směrem u, podle které se bod P zrcadlí na přímku AB. Vrací [bod, bod + u]. */
  function caraSmerem(P, u, A, Bb) {
    u = J.jedn(u);
    const n = J.kolmice(u), BA = J.sub(Bb, A);
    const c = -J.cross(J.sub(J.sub(P, A), J.mulS(n, 2 * J.dot(n, P))), BA) / (2 * J.cross(n, BA));
    const o = J.mulS(n, c);
    return [o, J.add(o, u)];
  }
  const vodorovna = y => [[0, y], [1, y]];
  const svisla = x => [[x, 0], [x, 1]];

  /* ---------- klíčové stavy (sklady, které nejsou jedním přehybem) ---------- */
  const O = [0.5, 0.5], A = [0, 1], Bv = [1, 1], C = [1, 0], D = [0, 0];
  const Ml = [0, 0.5], Mr = [1, 0.5], Mt = [0.5, 0], Mb = [0.5, 1];
  const zrcP = p => [1 - p[0], p[1]];
  /** Upraví plošky: zrcadlo = papír převrácený (druhá barva navrch), zezadu = pohled po otočení. */
  function uprav(plosky, { zrcadlo, zezadu, osaX = 0.5 } = {}) {
    return plosky.map(k => ({
      p: zrcadlo ? k.p.map(zrcP) : k.p,
      c: zezadu ? k.c.map(q => [2 * osaX - q[0], q[1]]) : k.c,
      z: zezadu ? -k.z : k.z
    }));
  }
  /** Vodní bomba (waterbomb base): trojúhelník s vrcholem nahoře (vrchol = střed papíru). */
  function zakladnaBomba(volby) {
    const Ot = [0.5, 0], Ac = [0, 0.5], Bc = [1, 0.5], Mbc = [0.5, 0.5];
    return uprav([
      { p: [O, A, Bv], c: [Ot, Ac, Bc], z: 3 },
      { p: [O, Bv, Mr], c: [Ot, Bc, Mbc], z: 2 },
      { p: [O, Mr, C], c: [Ot, Mbc, Bc], z: 1 },
      { p: [O, C, D], c: [Ot, Bc, Ac], z: 0 },
      { p: [O, Ml, A], c: [Ot, Mbc, Ac], z: 2 },
      { p: [O, D, Ml], c: [Ot, Ac, Mbc], z: 1 }
    ], volby);
  }
  /** Čtvercová základna (preliminary base) s volitelně provedeným okvětním přehybem vpředu/vzadu (= ptačí základna). */
  function zakladnaCtverec(petalPred, petalZad, volby) {
    const T = [0.5, 0.1], s2 = Math.SQRT1_2;
    const L = [T[0] - s2 / 2, T[1] + s2 / 2], R = [T[0] + s2 / 2, T[1] + s2 / 2], Bo = [T[0], T[1] + s2];
    const k = 2 * (1 - s2); // podíl |O-Q| / |O-M|: rýha kosočtverce protne hranu ve vzdálenosti 0,2929 od středu
    const Qf1 = J.lerp(T, L, k), Qf2 = J.lerp(T, R, k), Lc = J.stred(Qf1, Qf2);
    const Ap = [T[0], T[1] - (1 - s2)]; // vrchol okvětního lístku 0,2929 nad T
    const ctvrt = [
      { X: A, M1: Ml, M2: Mb, N1: D, N2: Bv, zn: 1, petal: petalPred },
      { X: C, M1: Mt, M2: Mr, N1: D, N2: Bv, zn: -1, petal: petalZad }
    ];
    const r = [];
    for (const q of ctvrt) {
      const z = d => q.zn * (10 - d);
      if (!q.petal) {
        r.push({ p: [O, q.M1, q.X, q.M2], c: [T, L, Bo, R], z: z(0) });
        r.push({ p: [O, q.M1, q.N1], c: [T, L, Bo], z: z(1) });
        r.push({ p: [O, q.M2, q.N2], c: [T, R, Bo], z: z(1) });
        continue;
      }
      const Q1 = J.lerp(O, q.M1, k), Q2 = J.lerp(O, q.M2, k);
      r.push({ p: [q.X, Q1, Q2], c: [Ap, Qf1, Qf2], z: z(0) });
      r.push({ p: [q.X, q.M1, Q1], c: [Ap, Lc, Qf1], z: z(1) });
      r.push({ p: [q.X, q.M2, Q2], c: [Ap, Lc, Qf2], z: z(1) });
      r.push({ p: [q.N1, q.M1, Q1], c: [Bo, Lc, Qf1], z: z(2) });
      r.push({ p: [q.N2, q.M2, Q2], c: [Bo, Lc, Qf2], z: z(2) });
      r.push({ p: [O, Q1, Q2], c: [T, Qf1, Qf2], z: z(3) });
      r.push({ p: [O, Q1, q.N1], c: [T, Qf1, Bo], z: z(4) });
      r.push({ p: [O, Q2, q.N2], c: [T, Qf2, Bo], z: z(4) });
    }
    return uprav(r, volby);
  }
  const CTV = (() => { // body čtvercové základny na stole (pro zápis kroků jeřábu)
    const T = [0.5, 0.1], s2 = Math.SQRT1_2, k = 2 * (1 - s2);
    const L = [T[0] - s2 / 2, T[1] + s2 / 2], R = [T[0] + s2 / 2, T[1] + s2 / 2], Bo = [T[0], T[1] + s2];
    return { T, L, R, Bo, Q1: J.lerp(T, L, k), Q2: J.lerp(T, R, k), Ap: [T[0], T[1] - (1 - s2)] };
  })();

  /* ---------- modely ---------- */
  const MODELY = [];
  const pridej = m => { MODELY.push(m); return m; };

  /* Pohárek */
  pridej({
    id: 'poharek', nazev: 'Pohárek', emoji: '🥤', obtiznost: 1, papir: 'čtverec 15 × 15 cm a větší',
    popis: 'Klasický skládaný kelímek – opravdu udrží vodu. Ideální první model.',
    listy: [{ rubNahoru: true }], uvod: [pootoc(45)], nahled3d: true,
    kroky: [
      V({ k: [B(1, 1), B(0, 0)], text: 'Barevnou stranou dolů, otočený jako kosočtverec. Přeložte napůl úhlopříčně – dolní roh k hornímu.' }),
      V({ cara: () => caraSmerem([1.2071, 0.5], [0.2929, -0.7071], [-0.2071, 0.5], [0.5, -0.2071]), strana: [1.2071, 0.5],
        text: 'Pravý roh přehněte k levé hraně tak, aby horní hrana přeloženého dílu byla vodorovná.' }),
      V({ cara: () => caraSmerem([-0.2071, 0.5], [-0.2929, -0.7071], [0.5, -0.2071], [1.2071, 0.5]), strana: [-0.2071, 0.5],
        text: 'Totéž s levým rohem – přehněte ho přes k pravé hraně.' }),
      V({ cara: st => vodorovna(J.bod(st, [1, 0])[1]), strana: [0.5, -0.5], vrstvy: 1, bod: st => [0.5, J.bod(st, [1, 0])[1] - 0.05],
        text: 'Horní cíp přední vrstvy sklopte dolů přes přední stranu.' }),
      H({ cara: st => vodorovna(J.bod(st, [0, 1])[1]), strana: [0.5, -0.5], vrstvy: -1, bod: st => [0.5, J.bod(st, [0, 1])[1] - 0.05],
        text: 'Zadní cíp sklopte dozadu (horský přehyb).' })
    ],
    hotovo: 'Hotovo – pohárek rozevřete prsty a můžete pít.'
  });

  /* Vlaštovka – šipka */
  const A4H = Math.SQRT2;
  pridej({
    id: 'vlastovka', nazev: 'Vlaštovka (šipka)', emoji: '✈️', obtiznost: 1, papir: 'A4',
    popis: 'Nejznámější papírové letadlo – rychlá štíhlá šipka.',
    listy: [{ w: 1, h: A4H, rubNahoru: true }], nahled3d: true,
    kroky: [
      V({ cara: svisla(0.5), strana: [1, 0.5], rozlozit: true, text: 'List A4 na výšku. Přeložte napůl podélně a zase rozložte.' }),
      vice('Horní rohy přehněte ke středové rýze.',
        V({ cara: [[0.5, 0], [0, 0.5]], strana: [0, 0] }), V({ cara: [[0.5, 0], [1, 0.5]], strana: [1, 0] })),
      vice('Šikmé hrany přehněte znovu ke středové rýze.',
        V({ cara: [[0.5, 0], [0, 0.5 / Math.tan(Math.PI / 8)]], strana: [0, 0.6] }),
        V({ cara: [[0.5, 0], [1, 0.5 / Math.tan(Math.PI / 8)]], strana: [1, 0.6] })),
      H({ cara: svisla(0.5), strana: [0.1, 1.2], text: 'Přeložte napůl dozadu podél středové rýhy.' }),
      pootoc(-90, 'Pootočte špičkou doleva, hřbetem dolů.'),
      V({ cara: st => { const b = J.ohraniceni(st.facety); return vodorovna(b.y1 - b.h * 0.5); }, strana: st => [0.5, J.ohraniceni(st.facety).y0], vrstvy: 1,
        bod: st => { const b = J.ohraniceni(st.facety); return [b.x1 - b.w * 0.2, b.y1 - b.h * 0.55]; }, text: 'Přední křídlo sklopte dolů rovnoběžně se hřbetem.' }),
      H({ cara: st => { const b = J.ohraniceni(st.facety); return vodorovna(b.y1 - b.h * 0.5); }, strana: st => [0.5, J.ohraniceni(st.facety).y0 - 1], vrstvy: -1,
        bod: st => { const b = J.ohraniceni(st.facety); return [b.x1 - b.w * 0.15, b.y0 + b.h * 0.2]; }, text: 'Zadní křídlo stejně dozadu.' })
    ],
    hotovo: 'Hotovo – křídla rozevřete do mírného „Y“ a hoďte šipku vodorovně.'
  });

  /* Čepice (a základ lodičky) */
  const krokyCepice = [
    V({ k: [[0.5, 0], [0.5, A4H]], text: 'List A4 na výšku (nebo noviny). Přeložte napůl shora dolů – přehyb je nahoře.' }),
    V({ cara: [[0.5, 0.7], [0.5, 1.5]], strana: [0.9, 1], rozlozit: true, text: 'Přeložte napůl doprava a rozložte – vznikne středová rýha.' }),
    vice('Oba horní rohy přehněte dolů ke středové rýze.',
      V({ cara: [[0.5, A4H / 2], [0, A4H / 2 + 0.5]], strana: [0, A4H / 2 + 0.01] }),
      V({ cara: [[0.5, A4H / 2], [1, A4H / 2 + 0.5]], strana: [1, A4H / 2 + 0.01] })),
    V({ cara: vodorovna(A4H / 2 + 0.5), strana: [0.5, A4H], vrstvy: 1, bod: [0.5, A4H - 0.03], text: 'Spodní pruh přední vrstvy ohněte nahoru přes trojúhelníky.' }),
    otoc(),
    V({ cara: vodorovna(A4H / 2 + 0.5), strana: [0.5, A4H], vrstvy: 1, bod: [0.5, A4H - 0.03], text: 'Druhý pruh ohněte nahoru také.' })
  ];
  pridej({
    id: 'cepice', nazev: 'Čepice', emoji: '🎩', obtiznost: 1, papir: 'A4 nebo dvoustrana novin',
    popis: 'Malířská čepice z novin – stačí šest přehybů.',
    listy: [{ w: 1, h: A4H, rubNahoru: false }], nahled3d: true,
    kroky: krokyCepice,
    hotovo: 'Hotovo – čepici rozevřete zespodu. Přečnívající rohy pruhu můžete zahnout dozadu.'
  });

  /* Lodička – pokračuje z čepice */
  const yH = A4H / 2, yP = A4H / 2 + 0.5; // vrchol a spodek čepice
  pridej({
    id: 'lodicka', nazev: 'Lodička', emoji: '⛵', obtiznost: 2, papir: 'A4',
    popis: 'Klasická lodička z čepice – dvakrát se rozevře a zmáčkne.',
    listy: [{ w: 1, h: A4H, rubNahoru: false }], vzor: false,
    kroky: krokyCepice.concat([
      stav('Čepici rozevřete zespodu a stiskněte boky k sobě – zploští se do čtverce.', () => [
        { c: [[0.5, yH - 0.1], [0.9, yP], [0.5, yP + 0.5], [0.1, yP]], z: 0 },
        { c: [[0.1, yP], [0.9, yP], [0.5, yP + 0.5]], z: 1 }
      ], [[[-0.15, yP - 0.1], [0.08, yP - 0.1]], [[1.15, yP - 0.1], [0.92, yP - 0.1]]]),
      V({ k: [[0.5, yP + 0.5], [0.5, yH - 0.1]], vrstvy: 1, bod: [0.5, yP + 0.45], text: 'Spodní roh přední vrstvy ohněte nahoru až ke špičce.' }),
      H({ k: [[0.5, yP + 0.5], [0.5, yH - 0.1]], vrstvy: -1, bod: [0.5, yP + 0.45], text: 'Zadní roh ohněte dozadu nahoru – vznikne trojúhelník.' }),
      stav('Trojúhelník opět rozevřete zespodu a zmáčkněte do menšího čtverce.', () => [
        { c: [[0.5, yH - 0.1], [0.75, yP - 0.05], [0.5, yP + 0.25], [0.25, yP - 0.05]], z: 0 },
        { c: [[0.25, yP - 0.05], [0.75, yP - 0.05], [0.5, yP + 0.25]], z: 1, lic: false }
      ], [[[0.15, yP - 0.05], [0.3, yP - 0.05]], [[0.85, yP - 0.05], [0.7, yP - 0.05]]]),
      stav('Uchopte horní cípy a táhněte je od sebe – uprostřed se vytáhne plachta.', () => [
        { c: [[-0.05, yP - 0.05], [1.05, yP - 0.05], [0.8, yP + 0.25], [0.2, yP + 0.25]], z: 0 },
        { c: [[0.5, yH - 0.1], [0.72, yP - 0.05], [0.28, yP - 0.05]], z: 1, lic: false },
        { c: [[0.5, yH - 0.1], [0.5, yP - 0.05], [0.28, yP - 0.05]], z: 2 }
      ], [[[0.3, yH + 0.3], [0.02, yH + 0.3]], [[0.7, yH + 0.3], [0.98, yH + 0.3]]])
    ]),
    hotovo: 'Hotovo – lodička plave (ne moc dlouho).'
  });

  /* Tulipán */
  const S2 = Math.SQRT1_2, dno = [0.5, 0.5 + S2];
  const cipTulipanu = sm => J.add(dno, [sm * Math.sin(Math.PI / 18), -Math.cos(Math.PI / 18)]);
  pridej({
    id: 'tulipan', nazev: 'Tulipán', emoji: '🌷', obtiznost: 1, papir: 'čtverec 15 × 15 cm',
    popis: 'Jednoduchý květ tulipánu ze čtyř přehybů – i pro malé děti.',
    listy: [{ rubNahoru: true }], uvod: [pootoc(45)], nahled3d: true,
    kroky: [
      V({ k: [B(0, 0), B(1, 1)], text: 'Barevnou stranou dolů jako kosočtverec. Horní roh přehněte k dolnímu – trojúhelník.' }),
      vice('Levý a pravý roh přehněte šikmo nahoru tak, aby cípy přečnívaly přes horní hranu.',
        V({ k: [B(0, 1), cipTulipanu(-1)] }), V({ k: [B(1, 0), cipTulipanu(1)] })),
      H({ k: [dno, [0.5, 1.12]], text: 'Spodní špičku nepatrně zahněte dozadu, aby květ stál rovně.' })
    ],
    hotovo: 'Hotovo – z dalšího čtverce můžete složit stonek a květ na něj nasadit.'
  });

  /* Kočka a liška – společný základ: trojúhelník, rohy ke špičce, cípy zpět nahoru jako uši */
  const hranaL = [0.5 - S2 / 2, 0.5 + S2 / 2], hranaP = [0.5 + S2 / 2, 0.5 + S2 / 2];
  const usi = (yUcho, text) => vice(text,
    V({ cara: [[0.5, yUcho], hranaL], strana: [0.4, 1.1], vrstvy: 1, bod: [0.4, 1.0] }),
    V({ cara: [[0.5, yUcho], hranaP], strana: [0.6, 1.1], vrstvy: 1, bod: [0.6, 1.0] }));
  const zakladHlavy = [
    V({ k: [B(0, 0), B(1, 1)], text: 'Barevnou stranou dolů jako kosočtverec. Horní roh přehněte k dolnímu – trojúhelník.' }),
    vice('Boční rohy přehněte dolů ke spodní špičce – vznikne čtverec.',
      V({ k: [B(0, 1), dno] }), V({ k: [B(1, 0), dno] }))
  ];
  pridej({
    id: 'kocka', nazev: 'Kočičí hlava', emoji: '🐱', obtiznost: 1, papir: 'čtverec 15 × 15 cm',
    popis: 'Kočičí hlavička se špičatýma ušima – stačí domalovat oči a fousky.',
    listy: [{ rubNahoru: true }], uvod: [pootoc(45)], nahled3d: true,
    kroky: zakladHlavy.concat([
      usi(0.6, 'Cípy přehněte zpět nahoru a ven – budou z nich uši.'),
      H({ k: [[0.5, 0.5], [0.5, 0.62]], filtr: q => q[0] > 0.3 && q[0] < 0.7, text: 'Horní roh mezi ušima zahněte dozadu.' }),
      H({ k: [[0.5, 0.5 + S2], [0.5, 1.0]], text: 'Spodní špičku zahněte dozadu – bradička.' }),
      otoc()
    ]),
    hotovo: 'Hotovo – domalujte oči, čumáček a vousky.'
  });

  pridej({
    id: 'liska', nazev: 'Liščí hlava', emoji: '🦊', obtiznost: 1, papir: 'čtverec 15 × 15 cm (oranžový)',
    popis: 'Liščí hlava se špičatým čumákem a ušima do stran.',
    listy: [{ rubNahoru: true }], uvod: [pootoc(45)], nahled3d: true,
    kroky: zakladHlavy.concat([
      usi(0.54, 'Cípy přehněte zpět nahoru a šikmo ven – uši.'),
      otoc()
    ]),
    hotovo: 'Hotovo – domalujte oči a černou špičku čumáku.'
  });

  /* Srdce */
  pridej({
    id: 'srdce', nazev: 'Srdce', emoji: '❤️', obtiznost: 1, papir: 'čtverec 15 × 15 cm (červený)',
    popis: 'Jednoduché srdíčko – na přání, jmenovky i do dopisu.',
    listy: [{ rubNahoru: true }], uvod: [pootoc(45)], nahled3d: true,
    kroky: [
      V({ k: [B(0, 0), [0.5, 0.5]], text: 'Barevnou stranou dolů jako kosočtverec. Horní roh přehněte do středu.' }),
      V({ k: [B(1, 1), [0.5, (0.5 - S2 + 0.5) / 2]], text: 'Dolní roh přehněte nahoru až k horní hraně.' }),
      vice('Pravou a levou spodní část ohněte nahoru podél středové osy.',
        V({ cara: [[0.5, 0.6768], [1.5, -0.3232]], strana: [1.2, 0.5] }),
        V({ cara: [[0.5, 0.6768], [-0.5, -0.3232]], strana: [-0.2, 0.5] })),
      vice('Horní a boční cípy ohněte dozadu – srdce se zakulatí.',
        ...[[0.323, -0.03, 0.24], [0.058, 0.235, 0.24], [0.677, -0.03, 0.76], [0.942, 0.235, 0.76]].map(([x, y, sx]) =>
          H({ k: [[x, y], J.lerp([x, y], [sx, 0.2], 0.4)], filtr: q => J.delka(J.sub(q, [x, y])) < 0.12 })))
    ],
    hotovo: 'Hotovo – srdíčko.'
  });

  /* Krabička masu */
  const mx0 = 0.5 - S2 / 2, mx1 = 0.5 + S2 / 2; // čtverec po přeložení rohů a pootočení
  pridej({
    id: 'masu', nazev: 'Krabička masu', emoji: '📦', obtiznost: 2, papir: 'čtverec 20 × 20 cm a větší (pevnější papír)',
    popis: 'Tradiční japonská krabička bez lepení. Ze dvou o něco různých čtverců složíte krabičku s víkem.',
    listy: [{ rubNahoru: true }],
    kroky: [
      vice('Barevnou stranou dolů. Přeložte obě úhlopříčky a rozložte.',
        V({ cara: [[0, 0], [1, 1]], strana: [1, 0], rozlozit: true }), V({ cara: [[1, 0], [0, 1]], strana: [0, 0], rozlozit: true })),
      vice('Všechny čtyři rohy přehněte do středu (tzv. blintz).',
        V({ k: [[0, 0], O] }), V({ k: [[1, 0], O] }), V({ k: [[1, 1], O] }), V({ k: [[0, 1], O] })),
      pootoc(45, 'Pootočte o 45°, aby byl čtverec rovně.'),
      vice('Horní a dolní hranu přehněte ke středu a rozložte.',
        V({ cara: vodorovna(0.5 - S2 / 4), strana: [0.5, 0], rozlozit: true }), V({ cara: vodorovna(0.5 + S2 / 4), strana: [0.5, 1], rozlozit: true })),
      vice('Levou a pravou hranu přehněte ke středu a rozložte.',
        V({ cara: svisla(0.5 - S2 / 4), strana: [0, 0.5], rozlozit: true }), V({ cara: svisla(0.5 + S2 / 4), strana: [1, 0.5], rozlozit: true })),
      vice('Horní a dolní cíp rozložte zpět ven.',
        V({ cara: vodorovna(mx0), strana: [0.5, 0.5], vrstvy: 1, bod: [0.5, 0.3] }), V({ cara: vodorovna(mx1), strana: [0.5, 0.5], vrstvy: 1, bod: [0.5, 0.7] })),
      stav('Zvedněte levou a pravou stěnu podle rýh, přitlačte rohy dovnitř a horní i dolní cíp přeložte přes stěnu na dno.', () => {
        // izometrický pohled na hotovou krabičku (jen obrázek)
        const iso = (x, y, z) => [0.5 + (x - y) * 0.6, 0.65 + (x + y) * 0.32 - z * 0.75];
        const a = 0.5, h = 0.25;
        return [
          { c: [iso(0, 0, 0), iso(a, 0, 0), iso(a, a, 0), iso(0, a, 0)], z: 0, lic: false },
          { c: [iso(0, 0, 0), iso(a, 0, 0), iso(a, 0, h), iso(0, 0, h)], z: 1, lic: false },
          { c: [iso(0, 0, 0), iso(0, a, 0), iso(0, a, h), iso(0, 0, h)], z: 1, lic: false },
          { c: [iso(a, 0, 0), iso(a, a, 0), iso(a, a, h), iso(a, 0, h)], z: 2, lic: true },
          { c: [iso(0, a, 0), iso(a, a, 0), iso(a, a, h), iso(0, a, h)], z: 2, lic: true }
        ];
      })
    ],
    hotovo: 'Hotovo. Víko složte stejně ze čtverce o 3–5 mm větším.'
  });

  /* Hvězdice – osmicípá hvězda */
  pridej({
    id: 'hvezdice', nazev: 'Hvězdice', emoji: '⭐', obtiznost: 1, papir: 'čtverec 15 × 15 cm',
    popis: 'Osmicípá dvoubarevná hvězdice z jednoho čtverce.',
    listy: [{ rubNahoru: true }], nahled3d: true,
    kroky: [
      vice('Barevnou stranou dolů. Přeložte obě úhlopříčky a rozložte.',
        V({ cara: [[0, 0], [1, 1]], strana: [1, 0], rozlozit: true }), V({ cara: [[1, 0], [0, 1]], strana: [0, 0], rozlozit: true })),
      vice('Všechny čtyři rohy přehněte do středu.',
        V({ k: [[0, 0], O] }), V({ k: [[1, 0], O] }), V({ k: [[1, 1], O] }), V({ k: [[0, 1], O] })),
      vice('Každý cíp ve středu přehněte zpět ven tak, aby špička přečnívala přes hranu.',
        V({ cara: [[0.625, 0], [0, 0.625]], strana: O, vrstvy: 1, bod: [0.4, 0.4] }),
        V({ cara: [[0.375, 0], [1, 0.625]], strana: O, vrstvy: 1, bod: [0.6, 0.4] }),
        V({ cara: [[0.375, 1], [1, 0.375]], strana: O, vrstvy: 1, bod: [0.6, 0.6] }),
        V({ cara: [[0.625, 1], [0, 0.375]], strana: O, vrstvy: 1, bod: [0.4, 0.6] }))
    ],
    hotovo: 'Hotovo – osmicípá hvězdice. Z papíru se vzorem na rubu vypadá nejlépe.'
  });

  /* Motýl */
  pridej({
    id: 'motyl', nazev: 'Motýl', emoji: '🦋', obtiznost: 2, papir: 'čtverec 15 × 15 cm',
    popis: 'Motýl ze základny „vodní bomba“ se zamykacím cípem.',
    listy: [{ rubNahoru: true }],
    kroky: [
      vice('Barevnou stranou dolů. Přeložte obě úhlopříčky a rozložte.',
        V({ cara: [[0, 0], [1, 1]], strana: [1, 0], rozlozit: true }), V({ cara: [[1, 0], [0, 1]], strana: [0, 0], rozlozit: true })),
      H({ cara: vodorovna(0.5), strana: [0.5, 0], rozlozit: true, text: 'Vodorovnou osu přeložte horským přehybem (dozadu) a rozložte.' }),
      stav('Podle rýh složte základnu „vodní bomba“ – boky zatlačte dovnitř a horní polovinu sklopte dolů.',
        () => zakladnaBomba({ zrcadlo: true }), [[[-0.08, 0.5], [0.15, 0.5]], [[1.08, 0.5], [0.85, 0.5]]]),
      vice('Spodní rohy přední vrstvy přehněte nahoru ke špičce.',
        V({ k: [[0, 0.5], [0.5, 0]], vrstvy: 1, bod: [0.06, 0.48] }), V({ k: [[1, 0.5], [0.5, 0]], vrstvy: 1, bod: [0.94, 0.48] })),
      otoc(),
      V({ k: [[0.5, 0], [0.5, 0.62]], text: 'Horní špičku ohněte dolů tak, aby přečnívala asi 1 cm přes spodní hranu.' }),
      V({ k: [[0.5, 0.62], [0.5, 0.38]], vrstvy: 1, bod: [0.5, 0.58], text: 'Přečnívající špičku přehněte přes hranu nahoru – zamkne model.' }),
      H({ cara: svisla(0.5), strana: [0, 0.3], rozlozit: true, text: 'Přeložte napůl dozadu a zase povolte – křídla se zvednou.' })
    ],
    hotovo: 'Hotovo – motýl.'
  });

  /* Vodní bomba */
  pridej({
    id: 'bomba', nazev: 'Vodní bomba', emoji: '🎈', obtiznost: 2, papir: 'čtverec 15 × 15 cm, tenký',
    popis: 'Nafukovací kostka (balónek) – dá se do ní nalít voda.',
    listy: [{ rubNahoru: true }],
    kroky: [
      vice('Přeložte obě úhlopříčky a rozložte.',
        V({ cara: [[0, 0], [1, 1]], strana: [1, 0], rozlozit: true }), V({ cara: [[1, 0], [0, 1]], strana: [0, 0], rozlozit: true })),
      H({ cara: vodorovna(0.5), strana: [0.5, 0], rozlozit: true, text: 'Vodorovnou osu přeložte dozadu a rozložte.' }),
      stav('Složte základnu „vodní bomba“.', () => zakladnaBomba({ zrcadlo: true }), [[[-0.08, 0.5], [0.15, 0.5]], [[1.08, 0.5], [0.85, 0.5]]]),
      vice('Spodní rohy přední vrstvy přehněte ke špičce.',
        V({ k: [[0, 0.5], [0.5, 0]], vrstvy: 1, bod: [0.06, 0.48] }), V({ k: [[1, 0.5], [0.5, 0]], vrstvy: 1, bod: [0.94, 0.48] })),
      vice('Boční rohy přehněte ke svislé ose.',
        V({ cara: svisla(0.375), strana: [0.2, 0.25], vrstvy: 1, bod: [0.29, 0.25] }), V({ cara: svisla(0.625), strana: [0.8, 0.25], vrstvy: 1, bod: [0.71, 0.25] })),
      vice('Horní volné cípy přehněte dolů a zastrčte do kapsiček v trojúhelnících.',
        V({ cara: vodorovna(0.125), strana: [0.45, 0], vrstvy: 1, bod: [0.47, 0.1], filtr: q => q[0] < 0.5 }),
        V({ cara: vodorovna(0.125), strana: [0.55, 0], vrstvy: 1, bod: [0.53, 0.1], filtr: q => q[0] > 0.5 })),
      otoc(),
      vice('Na druhé straně zopakujte: rohy ke špičce, boky k ose, cípy do kapsiček.',
        V({ k: [[0, 0.5], [0.5, 0]], vrstvy: 1, bod: [0.06, 0.48] }), V({ k: [[1, 0.5], [0.5, 0]], vrstvy: 1, bod: [0.94, 0.48] }),
        V({ cara: svisla(0.375), strana: [0.2, 0.25], vrstvy: 1, bod: [0.29, 0.25] }), V({ cara: svisla(0.625), strana: [0.8, 0.25], vrstvy: 1, bod: [0.71, 0.25] }),
        V({ cara: vodorovna(0.125), strana: [0.45, 0], vrstvy: 1, bod: [0.47, 0.1], filtr: q => q[0] < 0.5 }),
        V({ cara: vodorovna(0.125), strana: [0.55, 0], vrstvy: 1, bod: [0.53, 0.1], filtr: q => q[0] > 0.5 })),
      stav('Foukněte do otvoru dole – bomba se nafoukne do kostky.', () => {
        const iso = (x, y, z) => [0.5 + (x - y) * 0.42, 0.42 + (x + y) * 0.22 - z * 0.45];
        const a = 0.55;
        return [
          { c: [iso(0, 0, a), iso(a, 0, a), iso(a, a, a), iso(0, a, a)], z: 2 },
          { c: [iso(a, 0, 0), iso(a, a, 0), iso(a, a, a), iso(a, 0, a)], z: 1 },
          { c: [iso(0, a, 0), iso(a, a, 0), iso(a, a, a), iso(0, a, a)], z: 1 },
          { c: [iso(a * 0.42, a * 0.42, a), iso(a * 0.58, a * 0.42, a), iso(a * 0.58, a * 0.58, a), iso(a * 0.42, a * 0.58, a)], z: 3, lic: false }
        ];
      }, [[[0.5, 1.15], [0.5, 0.85]]])
    ],
    hotovo: 'Hotovo – nafouknutá vodní bomba.'
  });

  /* Skákací žabka */
  const FH = 1.6;
  pridej({
    id: 'zabka', nazev: 'Skákací žabka', emoji: '🐸', obtiznost: 2, papir: 'obdélník 2 : 3 (kartička, tužší papír)',
    popis: 'Žabka, která po zmáčknutí zadečku skáče.',
    listy: [{ w: 1, h: FH, rubNahoru: false }],
    kroky: [
      vice('Na horním čtverci přeložte obě úhlopříčky a rozložte.',
        V({ cara: [[0, 0], [1, 1]], strana: [1, 0], rozlozit: true }), V({ cara: [[1, 0], [0, 1]], strana: [0, 0], rozlozit: true })),
      H({ cara: vodorovna(0.5), strana: [0.5, 0], rozlozit: true, text: 'Vodorovně přes průsečík přeložte dozadu a rozložte.' }),
      stav('Boky zatlačte dovnitř a horní část sklopte dolů – vznikne trojúhelník.', () => [
        { p: [[0, 1], [1, 1], [1, FH], [0, FH]], c: [[0, 1], [1, 1], [1, FH], [0, FH]], z: 0 },
        { p: [O, A, Bv], c: [O, A, Bv], z: 0 },
        { p: [O, Ml, A], c: [O, Mb, A], z: 1 }, { p: [O, Mr, Bv], c: [O, Mb, Bv], z: 1 },
        { p: [O, Ml, D], c: [O, Mb, A], z: 2 }, { p: [O, Mr, C], c: [O, Mb, Bv], z: 2 },
        { p: [O, D, C], c: [O, A, Bv], z: 3 }
      ], [[[-0.1, 0.5], [0.15, 0.5]], [[1.1, 0.5], [0.85, 0.5]]]),
      vice('Spodní rohy trojúhelníku (přední vrstvu) přehněte ke špičce – přední nožky.',
        V({ k: [[0, 1], O], vrstvy: 1, bod: [0.08, 0.97] }), V({ k: [[1, 1], O], vrstvy: 1, bod: [0.92, 0.97] })),
      vice('Boky těla přehněte ke středu (zasuňte je pod trojúhelník).',
        V({ cara: svisla(0.25), strana: [0, 1.3], filtr: q => q[1] > 1 }), V({ cara: svisla(0.75), strana: [1, 1.3], filtr: q => q[1] > 1 })),
      H({ k: [[0.5, FH], [0.5, 1]], filtr: q => q[1] > 1, text: 'Spodní okraj ohněte dozadu nahoru k základně trojúhelníku.' }),
      H({ cara: vodorovna((1 + (1 + FH) / 2) / 2), strana: [0.5, 0.98], vrstvy: -1, bod: [0.5, 1.03], filtr: q => q[1] > 1,
        text: 'Ohnutý díl vzadu přehněte zpět dolů napůl (cik-cak) – vznikne pružina pod žabkou.' })
    ],
    hotovo: 'Hotovo – zmáčkněte žabce zadeček a sklouzněte prstem, žabka skočí.'
  });

  /* Ninja hvězdice (shuriken) */
  pridej({
    id: 'ninja', nazev: 'Ninja hvězdice', emoji: '✴️', obtiznost: 2, papir: '2 čtverce 15 × 15 cm (dvě barvy)',
    popis: 'Vrhací hvězdice shuriken ze dvou zrcadlových modulů.',
    listy: [{ rubNahoru: true }],
    kroky: [
      V({ k: [[1, 0.5], [0, 0.5]], text: 'Přeložte čtverec napůl (pravou polovinu na levou).' }),
      V({ k: [[0, 0.5], [0.5, 0.5]], text: 'Ještě jednou napůl – úzký pruh 1 : 4.' }),
      vice('Horní konec přehněte šikmo doleva, spodní šikmo doprava.',
        V({ k: [[0.5, 0], [0.25, 0.25]] }), V({ k: [[0.25, 1], [0.5, 0.75]] })),
      vice('Oba konce přehněte ještě jednou šikmo – pruh se zalomí do tvaru Z.',
        H({ cara: [[0.25, 0.25], [0.5, 0.5]], strana: [0.45, 0.1] }), H({ cara: [[0.25, 0.5], [0.5, 0.75]], strana: [0.3, 0.9] })),
      stav('Druhý modul složte zrcadlově (šikmé přehyby na opačnou stranu). Moduly položte křížem na sebe a cípy zastrčte do kapes druhého modulu.', st => {
        // hotová hvězdice jen jako obrázek: střední čtverec a čtyři cípy do větrníku, barvy modulů se střídají
        const c = J.ohraniceni(st.facety).st, a = 0.18, x0 = c[0] - a, x1 = c[0] + a, y0 = c[1] - a, y1 = c[1] + a, d = 2 * a;
        return [
          { c: [[x0, y0], [x1, y0], [x1, y0 - d]], z: 1 }, { c: [[x1, y1], [x0, y1], [x0, y1 + d]], z: 1 },
          { c: [[x1, y0], [x1, y1], [x1 + d, y1]], z: 1, s: 1 }, { c: [[x0, y1], [x0, y0], [x0 - d, y0]], z: 1, s: 1 },
          { c: [[x0, y0], [x1, y0], [x1, y1]], z: 2 }, { c: [[x0, y0], [x1, y1], [x0, y1]], z: 2, s: 1 }
        ];
      })
    ],
    hotovo: 'Hotovo – ninja hvězdice.'
  });

  /* Modul Sonobe */
  pridej({
    id: 'sonobe', nazev: 'Modul Sonobe', emoji: '🔷', obtiznost: 2, papir: 'čtverec 7,5 × 7,5 cm (z A4 jich vyjde víc)',
    popis: 'Základní modul modulárního origami – z 6 modulů krychle, z 12 hvězdný osmistěn, z 30 koule.',
    listy: [{ rubNahoru: true }], nahled3d: true,
    kroky: [
      V({ cara: svisla(0.5), strana: [1, 0.5], rozlozit: true, text: 'Barevnou stranou dolů. Přeložte napůl svisle a rozložte.' }),
      vice('Levou a pravou hranu přehněte ke středové rýze.', V({ cara: svisla(0.25), strana: [0, 0.5] }), V({ cara: svisla(0.75), strana: [1, 0.5] })),
      vice('Levý horní a pravý dolní roh přehněte šikmo dovnitř (malé trojúhelníky).',
        V({ k: [[0.25, 0], [0.5, 0.25]], filtr: q => q[1] < 0.5 }), V({ k: [[0.75, 1], [0.5, 0.75]], filtr: q => q[1] > 0.5 })),
      vice('Velké šikmé přehyby: horní levou část přehněte dolů k pravé hraně, dolní pravou nahoru k levé hraně – vznikne kosodélník.',
        V({ cara: [[0.75, 0], [0.25, 0.5]], strana: [0.25, 0] }), V({ cara: [[0.75, 0.5], [0.25, 1]], strana: [0.75, 1] })),
      vice('Oba ostré cípy přehněte k protějším tupým rohům a rozložte – střed tvoří čtverec, cípy jsou zámky.',
        V({ k: [[0.75, 0], [0.25, 0.5]], rozlozit: true }), V({ k: [[0.25, 1], [0.75, 0.5]], rozlozit: true }))
    ],
    hotovo: 'Hotovo – modul. Cípy (zámky) se zasouvají do kapes sousedních modulů.'
  });

  /* Jeřáb */
  const kJ = { zrcadlo: true };
  pridej({
    id: 'jerab', nazev: 'Jeřáb', emoji: '🕊️', obtiznost: 3, papir: 'čtverec 15 × 15 cm, tenký',
    popis: 'Tradiční japonský jeřáb (orizuru) – symbol štěstí. Z ptačí základny.',
    listy: [{ rubNahoru: true }],
    kroky: [
      vice('Barevnou stranou dolů. Přeložte obě úhlopříčky a rozložte.',
        V({ cara: [[0, 0], [1, 1]], strana: [1, 0], rozlozit: true }), V({ cara: [[1, 0], [0, 1]], strana: [0, 0], rozlozit: true })),
      vice('Svislou a vodorovnou osu přeložte dozadu a rozložte.',
        H({ cara: vodorovna(0.5), strana: [0.5, 0], rozlozit: true }), H({ cara: svisla(0.5), strana: [0, 0.5], rozlozit: true })),
      stav('Podle rýh složte čtvercovou základnu – všechny rohy se sejdou dole.', () => zakladnaCtverec(false, false, kJ),
        [[[0.05, 0.05], [0.25, 0.25]], [[0.95, 0.05], [0.75, 0.25]]]),
      vice('Spodní šikmé hrany přední vrstvy přehněte ke středové ose a rozložte.',
        V({ cara: [CTV.Bo, CTV.Q1], strana: CTV.L, vrstvy: 1, bod: J.lerp(CTV.L, CTV.Bo, 0.1), rozlozit: true }),
        V({ cara: [CTV.Bo, CTV.Q2], strana: CTV.R, vrstvy: 1, bod: J.lerp(CTV.R, CTV.Bo, 0.1), rozlozit: true })),
      V({ cara: [CTV.Q1, CTV.Q2], strana: CTV.T, vrstvy: 1, bod: J.lerp(CTV.T, CTV.Bo, 0.1), rozlozit: true, text: 'Horní trojúhelník přehněte dolů a rozložte.' }),
      stav('Okvětní přehyb: spodní roh přední vrstvy zvedněte nahoru, boky se sklopí ke středu podle rýh.', () => zakladnaCtverec(true, false, kJ),
        [[[0.5, 0.75], [0.5, 0.2]]]),
      otoc(),
      stav('Na druhé straně zopakujte kroky 4–6 – vznikne ptačí základna.', () => zakladnaCtverec(true, true, Object.assign({ zezadu: true }, kJ))),
      vice('Spodní hrany přední vrstvy přehněte ke středové ose (zúžit nohy).',
        V({ cara: [CTV.Bo, J.add(CTV.Bo, [-Math.sin(Math.PI / 16), -Math.cos(Math.PI / 16)])], strana: [0, 0.3], vrstvy: 1, bod: [CTV.Q1[0] + 0.03, CTV.Q1[1] + 0.03] }),
        V({ cara: [CTV.Bo, J.add(CTV.Bo, [Math.sin(Math.PI / 16), -Math.cos(Math.PI / 16)])], strana: [1, 0.3], vrstvy: 1, bod: [CTV.Q2[0] - 0.03, CTV.Q2[1] + 0.03] })),
      otoc(),
      vice('Totéž na druhé straně.',
        V({ cara: [CTV.Bo, J.add(CTV.Bo, [-Math.sin(Math.PI / 16), -Math.cos(Math.PI / 16)])], strana: [0, 0.3], vrstvy: 1, bod: [CTV.Q1[0] + 0.03, CTV.Q1[1] + 0.03] }),
        V({ cara: [CTV.Bo, J.add(CTV.Bo, [Math.sin(Math.PI / 16), -Math.cos(Math.PI / 16)])], strana: [1, 0.3], vrstvy: 1, bod: [CTV.Q2[0] - 0.03, CTV.Q2[1] + 0.03] })),
      vice('Obě spodní úzké špičky vnitřním obráceným přehybem vytočte nahoru mezi křídla – krk a ocas.',
        { op: 'prehyb', druh: 'vnitrni', cara: [[0.5, 0.42], [0.3, 0.32]], strana: [0.5, 0.8], papir: p => J.delka(J.sub(p, [1, 0])) < 0.5 },
        { op: 'prehyb', druh: 'vnitrni', cara: [[0.5, 0.42], [0.7, 0.32]], strana: [0.5, 0.8], papir: p => J.delka(J.sub(p, [0, 1])) < 0.5 }),
      { op: 'prehyb', druh: 'vnitrni', cara: st => { const h = J.bod(st, [1, 0]); return [J.add(h, [-0.1, 0.06]), J.add(h, [0.02, 0.1])]; }, strana: st => J.bod(st, [1, 0]), papir: p => J.delka(J.sub(p, [1, 0])) < 0.5,
        text: 'Špičku krku vytočte obráceným přehybem dolů – hlava.' },
      vice('Křídla sklopte dolů – přední k vám, zadní dozadu.',
        V({ cara: [[0, 0.28], [1, 0.28]], strana: [0.5, 0], papir: p => J.delka(J.sub(p, [1, 1])) < 0.48 }),
        H({ cara: [[0, 0.28], [1, 0.28]], strana: [0.5, 0], papir: p => J.delka(J.sub(p, [0, 0])) < 0.48 }))
    ],
    hotovo: 'Hotovo – jeřáb. Křídla roztáhněte a jemně profoukněte zespodu, aby se nafouklo tělo.'
  });

  const api = { MODELY, B, V, H, vice, otoc, pootoc, stav, caraSmerem, zakladnaBomba, zakladnaCtverec, CTV };
  if (typeof module !== 'undefined') module.exports = api;
  else window.OrigamiModely = api;
})();

/* ============================================================
   Ptačí budky a hmyzí hotely – jádro (bez DOM, čisté funkce)
   - DRUHY: doporučené rozměry budek podle druhu (typické hodnoty z ČSO, RSPB, NABU, LPO, ČESON – editovatelné)
   - budka(P): díly jako hranoly ve 3D (mm), dutina, otvory, kusovník, varování
   - rezny(B, P): řezný plán z jednoho prkna (pořadí dílů, prořezy, úkosy)
   - hotel(H): rám hmyzího hotelu + moduly (dřevo s otvory, rákos, cihla, hlína)
   - rozlozDiry(...): rozložení otvorů v dřevěném bloku
   - vDilu / vDutine: bodové testy (pro kontrolu uzavřenosti)
   - rozvrhListu: dělení šablony na listy pro tisk 1:1
   Souřadnice budky: x = šířka (0 = vnitřní líc levého boku), y = hloubka (0 = vnitřní líc přední stěny,
   roste dozadu), z = výška (0 = spodní plocha dna). Díl = hranol: profil `poly` v rovině kolmé na `osa`
   ((y, z) pro osu x, (x, z) pro osu y, (x, y) pro osu z) vytažený v rozsahu [a0, a1] podél osy.
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180;
  const r1 = (x) => Math.round(x * 10) / 10;
  const r2 = (x) => Math.round(x * 100) / 100;
  const cislo = (v, z) => { const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : z; };
  const cz = (x, d) => (x == null || !isFinite(x) ? '–' : String(Math.round(x * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d)).replace('.', ',').replace('-', '−'));

  /* ---------------- zdroje ---------------- */
  const ZDROJE = {
    cso: 'Česká společnost ornitologická (ČSO, birdlife.cz) – materiály k ptačím budkám',
    rspb: 'RSPB (Royal Society for the Protection of Birds) – Nestbox guide',
    nabu: 'NABU (Naturschutzbund Deutschland) – Nistkasten-Bauanleitungen',
    lpo: 'LPO (Ligue pour la Protection des Oiseaux) – Fiches nichoirs',
    ceson: 'ČESON (Česká společnost pro ochranu netopýrů) a Bat Conservation Trust – netopýří budky',
  };

  /* ---------------- druhy ----------------
     W × D = vnitřní půdorys dna (šířka × hloubka), Hf = vnitřní výška u přední stěny (dno → stříška),
     otvor.zSpod = výška spodní hrany otvoru nad dnem (vnitřní), zav = výška zavěšení [m], t = tloušťka prkna,
     prkno = doporučené prkno [šířka, tloušťka, délka]. Hodnoty jsou doporučení; zdroje se liší o několik mm. */
  const DRUHY = {
    konadra: {
      nazev: 'Sýkora koňadra', lat: 'Parus major', ikona: '🐦', typ: 'dutina', W: 120, D: 120, Hf: 200, sklon: 15,
      otvor: { tvar: 'kruh', d: 32, rozsah: [28, 34], stena: 'predni', zSpod: 140 }, zav: [1.5, 4], orient: 'S až V (mimo jih a západ – přehřátí, návětrná strana)',
      t: 20, prkno: [150, 20, 1200], zdroje: ['cso', 'rspb', 'nabu'],
      pozn: 'Nejčastější obyvatel budek. Otvor 32 mm pustí i vrabce polního a brhlíka; 28 mm (RSPB) jen koňadru a menší sýkory.',
    },
    modrinka: {
      nazev: 'Sýkora modřinka', lat: 'Cyanistes caeruleus', ikona: '🐦', typ: 'dutina', W: 110, D: 110, Hf: 190, sklon: 15,
      otvor: { tvar: 'kruh', d: 27, rozsah: [25, 28], stena: 'predni', zSpod: 130 }, zav: [1.5, 4], orient: 'S až V',
      t: 20, prkno: [150, 20, 1100], zdroje: ['cso', 'rspb', 'nabu'],
      pozn: 'Malý otvor 25–28 mm propustí jen modřinku, uhelníčka, parukářku a babku – koňadra a vrabec neprojdou.',
    },
    vrabec: {
      nazev: 'Vrabec domácí', lat: 'Passer domesticus', ikona: '🐤', typ: 'dutina', W: 130, D: 130, Hf: 200, sklon: 15,
      otvor: { tvar: 'kruh', d: 35, rozsah: [32, 35], stena: 'predni', zSpod: 120 }, zav: [2, 5], orient: 'S až V, pod okapem domu',
      t: 20, prkno: [170, 20, 1200], zdroje: ['cso', 'rspb'],
      pozn: 'Vrabci hnízdí v koloniích – vyvěste víc budek vedle sebe (nebo vícekomorovou budku) pod okap.',
    },
    rehek: {
      nazev: 'Rehek domácí (polobudka)', lat: 'Phoenicurus ochruros', ikona: '🪶', typ: 'polobudka', W: 120, D: 120, Hf: 160, sklon: 15,
      otvor: { tvar: 'polo', predniVyska: 70, stena: 'predni' }, zav: [2, 4], orient: 'chráněné místo pod střechou, na trámu; mimo jih',
      t: 20, prkno: [150, 20, 1000], zdroje: ['cso', 'rspb', 'nabu'],
      pozn: 'Polootevřená budka (polodutina): přední stěna jen do výšky ~7 cm. Využije ji i konipas bílý, lejsek šedý, červenka.',
    },
    spacek: {
      nazev: 'Špaček obecný', lat: 'Sturnus vulgaris', ikona: '🐦‍⬛', typ: 'dutina', W: 150, D: 150, Hf: 300, sklon: 15,
      otvor: { tvar: 'kruh', d: 45, rozsah: [45, 50], stena: 'predni', zSpod: 200 }, zav: [3, 6], orient: 'V až JV, volný přílet',
      t: 20, prkno: [200, 20, 1500], zdroje: ['rspb', 'nabu', 'cso'],
      pozn: 'Špačci hnízdí rádi pospolu; budka na kmeni nebo štítu domu, otvor 45 mm (NABU, RSPB), některé zdroje až 50 mm.',
    },
    brhlik: {
      nazev: 'Brhlík lesní', lat: 'Sitta europaea', ikona: '🐦', typ: 'dutina', W: 140, D: 140, Hf: 240, sklon: 15,
      otvor: { tvar: 'kruh', d: 32, rozsah: [32, 35], stena: 'predni', zSpod: 160 }, zav: [2, 6], orient: 'S až V, kmen listnatého stromu',
      t: 20, prkno: [180, 20, 1300], zdroje: ['nabu', 'rspb', 'cso'],
      pozn: 'Brhlík si příliš velký otvor sám zúží hlínou („zedník“) – nevadí ani 35 mm.',
    },
    soupalek: {
      nazev: 'Šoupálek dlouhoprstý', lat: 'Certhia familiaris', ikona: '🐦', typ: 'dutina', W: 110, D: 120, Hf: 220, sklon: 15,
      otvor: { tvar: 'oval', w: 30, h: 50, rozsah: [25, 35], stena: 'bok', zSpod: 110, odZadu: 8 }, zav: [1.5, 3], orient: 'zády ke kmeni, vletový otvor na boku u kmene',
      t: 20, prkno: [150, 20, 1100], zdroje: ['nabu', 'lpo'],
      pozn: 'Šoupálek hnízdí za odchlípnutou kůrou: budka se připevní zády těsně ke kmeni, štěrbina 30 × 50 mm je v boku hned u zadní stěny (u kmene).',
    },
    rorys: {
      nazev: 'Rorýs obecný', lat: 'Apus apus', ikona: '🕊️', typ: 'dutina', W: 300, D: 150, Hf: 110, sklon: 5,
      otvor: { tvar: 'oval', w: 65, h: 32, rozsah: [30, 35], stena: 'predni', zSpod: 15, x: 60 }, zav: [5, 15], orient: 'S, V nebo Z; ne na přímé polední slunce, volný přílet zespodu',
      t: 20, prkno: [220, 20, 1600], zdroje: ['rspb', 'nabu', 'cso'],
      pozn: 'Nízká široká budka pod okap nebo do fasády, min. 5 m nad zemí, přílet volný (rorýsi padají z otvoru do letu). Oválný otvor 65 × 30–35 mm u dna na jednom konci.',
    },
    netopyr: {
      nazev: 'Netopýří budka (štěrbinová)', lat: 'Chiroptera', ikona: '🦇', typ: 'netopyr', W: 250, D: 20, Hf: 350, sklon: 20,
      otvor: { tvar: 'sterbina', stena: 'dno', rozsah: [15, 25] }, zav: [3, 5], orient: 'J, JV nebo JZ (teplo), víc budek různě orientovaných',
      t: 20, prkno: [270, 20, 1400], zdroje: ['ceson'],
      pozn: 'Štěrbina 15–25 mm (vstup zespodu). Zadní deska je prodloužená pod vstup jako přistávací plocha; vnitřní plochy i přistávací plocha musí být drsné (vroubky po 10–15 mm), aby se netopýři udrželi. Čištění není potřeba – trus vypadává štěrbinou.',
    },
    pustik: {
      nazev: 'Puštík obecný (sova)', lat: 'Strix aluco', ikona: '🦉', typ: 'dutina', W: 250, D: 250, Hf: 470, sklon: 15,
      otvor: { tvar: 'kruh', d: 120, rozsah: [110, 130], stena: 'predni', zSpod: 300 }, zav: [4, 8], orient: 'libovolná mimo návětrnou stranu, kmen ve starém lese, parku',
      t: 25, prkno: [300, 25, 2000], zdroje: ['nabu', 'rspb', 'cso'],
      pozn: 'Na dno nasypte 3–5 cm hoblin nebo trouchu (sovy hnízdo nestaví). Budku vyvěste do září–února, puštík hnízdí brzy (březen).',
    },
    syc: {
      nazev: 'Sýc rousný (sova)', lat: 'Aegolius funereus', ikona: '🦉', typ: 'dutina', W: 200, D: 200, Hf: 400, sklon: 15,
      otvor: { tvar: 'kruh', d: 80, rozsah: [75, 85], stena: 'predni', zSpod: 250 }, zav: [4, 8], orient: 'libovolná mimo návětrnou stranu, jehličnatý les',
      t: 25, prkno: [250, 25, 1800], zdroje: ['nabu', 'cso'],
      pozn: 'Horské a podhorské jehličnaté lesy. Na dno vrstvu hoblin. Kalous ušatý budky nevyužívá – hnízdí ve starých hnízdech vran a strak, pomůže mu proutěný košík v koruně.',
    },
  };
  const PORADI_DRUHU = ['konadra', 'modrinka', 'vrabec', 'rehek', 'spacek', 'brhlik', 'soupalek', 'rorys', 'netopyr', 'pustik', 'syc'];

  /* ---------------- výchozí parametry ---------------- */
  const SIRKY_PRKEN = [100, 120, 140, 150, 160, 180, 200, 220, 250, 280, 300, 350, 400, 500];
  /** doporučené prkno pro sestavu (budka nebo hotel): nejmenší běžná šířka, délka zaokrouhlená nahoru na 50 mm */
  function doporucPrkno(sestava, prorez) {
    let minB = 0;
    for (const d of sestava.dily) { const p = d.plocha; if (!p) continue; minB = Math.max(minB, d.id === 'bokL' || d.id === 'bokP' ? p.sirka : Math.min(p.sirka, p.spotreba || p.delka)); }
    const B = SIRKY_PRKEN.find((x) => x >= minB - 1e-6) || Math.ceil(minB / 10) * 10;
    const r = rezny(sestava, { B, L: 1e9, prorez: prorez == null ? 3 : prorez });
    return { B, L: Math.ceil((r.potreba + 30) / 50) * 50, minB: r2(minB), potreba: r.potreba };
  }
  function vychoziBudka(druh) {
    const P = zakladBudky(druh), dop = doporucPrkno(budka(P), P.prorez);
    P.B = dop.B; P.L = dop.L;
    return P;
  }
  function zakladBudky(druh) {
    const S = DRUHY[druh] || DRUHY.konadra, o = S.otvor;
    return {
      druh: DRUHY[druh] ? druh : 'konadra',
      W: S.W, D: S.D, Hf: S.Hf, sklon: S.sklon, t: S.t,
      otvorTvar: o.tvar, otvorD: o.d || 0, otvorW: o.w || 0, otvorH: o.h || 0, otvorZ: o.zSpod || 0, otvorX: o.x != null ? o.x : null,
      otvorStena: o.stena, odZadu: o.odZadu || 8, predniVyska: o.predniVyska || 0, sterbina: S.typ === 'netopyr' ? S.D : 0,
      presahPredni: S.typ === 'netopyr' ? 25 : Math.round(Math.max(30, S.W * 0.25)), presahBok: 0,
      zadDole: S.typ === 'netopyr' ? 100 : S.W >= 250 ? 60 : 40, zadNahore: S.typ === 'netopyr' ? 0 : S.W >= 250 ? 60 : 40,
      cisteni: S.typ === 'netopyr' ? 'zadne' : 'strecha', mezeraBok: 3,
      odvodneni: S.typ !== 'netopyr', vetrani: S.typ !== 'netopyr', vroubky: true,
      B: S.prkno[0], L: S.prkno[2], prorez: 3,
    };
  }

  /* ---------------- geometrie budky ---------------- */
  /**
   * budka(P) → {dily, dutina, otvory (deklarované otvory dutiny), osy, kusovnik, varovani, info}
   * Díl: {id, nazev, ks, osa, a0, a1, poly, diry:[{osa, c:[u,v], tvar, d|w,h, s0, s1}], plocha (rozvinutý tvar pro řez a šablonu),
   *       krokSlozeni, rozlet:[dx,dy,dz], otevrit?:{bod, smer, uhel}}
   */
  function budka(Pin) {
    const P = Object.assign(zakladBudky(Pin && Pin.druh), Pin || {});
    const S = DRUHY[P.druh] || DRUHY.konadra, typ = S.typ;
    const W = Math.max(40, cislo(P.W, 120)), t = Math.max(6, cislo(P.t, 20));
    const D = typ === 'netopyr' ? Math.max(8, cislo(P.sterbina || P.D, 20)) : Math.max(40, cislo(P.D, 120));
    const Hf = Math.max(40, cislo(P.Hf, 200)), alfa = Math.max(0, Math.min(40, cislo(P.sklon, 15))), k = Math.tan(alfa * RAD), tc = t / Math.cos(alfa * RAD);
    const maDno = typ !== 'netopyr', zd = maDno ? t : 0;
    const zr = (y) => zd + Hf + y * k;              // spodní plocha stříšky
    const pp = Math.max(0, cislo(P.presahPredni, 30)), pb = Math.max(0, cislo(P.presahBok, 0));
    const zadDole = Math.max(0, cislo(P.zadDole, 40)), zadNahore = Math.max(0, cislo(P.zadNahore, 40));
    const varovani = [], dily = [], otvory = [];
    const yf = -t - pp;
    const Hb = Hf + D * k;
    const cist = typ === 'netopyr' ? 'zadne' : (P.cisteni || 'strecha');
    const mez = cist === 'bok' ? Math.max(1, Math.min(6, cislo(P.mezeraBok, 3))) : 0;

    // přední stěna
    const polo = typ === 'polobudka';
    const predniV = polo ? Math.max(30, Math.min(Hf - 30, cislo(P.predniVyska, 70))) : null;
    const predni = { id: 'predni', nazev: 'Přední stěna', ks: 1, osa: 'x', a0: -t, a1: W + t, diry: [], krokSlozeni: 4, rozlet: [0, -1, 0] };
    if (polo) predni.poly = [[-t, 0], [0, 0], [0, zd + predniV], [-t, zd + predniV]];
    else predni.poly = [[-t, 0], [0, 0], [0, zr(0)], [-t, zr(-t)]];
    // otvor
    let otv = null;
    if (!polo && typ !== 'netopyr') {
      const tvar = P.otvorTvar === 'oval' ? 'oval' : 'kruh';
      const ow = tvar === 'kruh' ? cislo(P.otvorD, 32) : cislo(P.otvorW, 30), oh = tvar === 'kruh' ? ow : cislo(P.otvorH, 50);
      const zS = zd + Math.max(0, cislo(P.otvorZ, 120));
      if ((P.otvorStena || 'predni') === 'bok') {
        // štěrbina v levém boku u zadní stěny (šoupálek): ow = šířka podél y, oh = výška
        const yc = D - Math.max(0, cislo(P.odZadu, 8)) - ow / 2;
        otv = { stena: 'bok', osa: 'x', c: [yc, zS + oh / 2], tvar, d: tvar === 'kruh' ? ow : null, w: ow, h: oh, s0: -t - 1, s1: 1 };
        if (yc - ow / 2 < 10) varovani.push('Otvor v boku je příliš blízko přední stěny – zmenšete šířku otvoru nebo zvětšete hloubku budky.');
        if (zS + oh > zr(yc - ow / 2) - 10) varovani.push('Otvor v boku zasahuje pod stříšku – snižte výšku otvoru.');
      } else {
        const xc = P.otvorX != null && P.otvorX !== '' && isFinite(+P.otvorX) ? +P.otvorX : W / 2;
        otv = { stena: 'predni', osa: 'y', c: [xc, zS + oh / 2], tvar, d: tvar === 'kruh' ? ow : null, w: ow, h: oh, s0: -t - 1, s1: 1 };
        if (xc - ow / 2 < 8 || xc + ow / 2 > W - 8) varovani.push('Otvor je příliš blízko boku – posuňte ho nebo rozšiřte budku.');
        if (zS + oh > zr(0) - 15) varovani.push(`Horní hrana otvoru je jen ${cz(zr(0) - zS - oh, 0)} mm pod stříškou (doporučeno ≥ 15 mm) – snižte otvor nebo zvyšte budku.`);
        if (typ === 'dutina' && cislo(P.otvorZ, 0) < 100 && S.otvor.zSpod >= 100) varovani.push('Spodní hrana otvoru je méně než 100 mm nade dnem – kuna nebo kočka tlapou dosáhne na mláďata.');
      }
      const rz = S.otvor.rozsah;
      const rozhodny = tvar === 'kruh' ? ow : Math.min(ow, oh);
      if (rz && (rozhodny < rz[0] - 0.01 || rozhodny > rz[1] + 0.01)) varovani.push(`Otvor ${cz(rozhodny, 0)} mm je mimo doporučený rozsah ${rz[0]}–${rz[1]} mm pro ${S.nazev.toLowerCase()}.`);
      otvory.push({ typ: 'vletovy', stena: otv.stena, plocha: tvar === 'kruh' ? Math.PI * ow * ow / 4 : Math.PI * ow * oh / 4, otvor: otv });
      if (otv.stena === 'predni') predni.diry.push(otv);
    }
    if (polo) otvory.push({ typ: 'polobudka', stena: 'predni', plocha: W * (zr(0) - zd - predniV), z0: zd + predniV, z1: zr(0) });
    dily.push(predni);

    // zadní stěna (přesahuje dolů a nahoru kvůli připevnění)
    const zTop = zr(D) + tc + zadNahore;
    const zadni = { id: 'zadni', nazev: 'Zadní stěna', ks: 1, osa: 'x', a0: -t, a1: W + t, poly: [[D, -zadDole], [D + t, -zadDole], [D + t, zTop], [D, zTop]], diry: [], krokSlozeni: 1, rozlet: [0, 1, 0] };
    const montaz = [];
    if (zadDole >= 20) montaz.push(-zadDole / 2);
    if (zadNahore >= 20) montaz.push(zTop - zadNahore / 2);
    for (const z of montaz) zadni.diry.push({ osa: 'y', c: [W / 2, z], tvar: 'kruh', d: 5, s0: D - 1, s1: D + t + 1, ucel: 'montaz' });
    if (!montaz.length) varovani.push('Zadní stěna nepřesahuje budku – připevněte ji přes lištu nebo drátem (nebo zadejte přesah zadní stěny ≥ 20 mm).');
    dily.push(zadni);

    // boky
    const bokPoly = (snizit) => [[0, 0], [D, 0], [D, zr(D) - snizit], [0, zr(0) - snizit]];
    const bokL = { id: 'bokL', nazev: 'Levý bok', ks: 1, osa: 'x', a0: -t, a1: 0, poly: bokPoly(mez), diry: [], krokSlozeni: 2, rozlet: [-1, 0, 0] };
    const bokP = { id: 'bokP', nazev: 'Pravý bok', ks: 1, osa: 'x', a0: W, a1: W + t, poly: bokPoly(0), diry: [], krokSlozeni: 2, rozlet: [1, 0, 0] };
    if (otv && otv.stena === 'bok') bokL.diry.push(otv);
    if (P.vetrani !== false && typ !== 'netopyr' && cist !== 'bok' && D >= 60) {
      // větrací otvory Ø 8 mm v obou bocích nahoře u zadní stěny
      const yv = D - 20, zv = zr(yv) - 15;
      for (const b of [bokL, bokP]) b.diry.push({ osa: 'x', c: [yv, zv], tvar: 'kruh', d: 8, s0: b.a0 - 1, s1: b.a1 + 1, ucel: 'vetrani' });
      otvory.push({ typ: 'vetrani', stena: 'boky', plocha: 2 * Math.PI * 16 });
    }
    if (cist === 'bok') {
      const zp = zr(0) - mez - 20;
      bokL.otevrit = { bod: [-t / 2, 0, zp], smer: [0, 1, 0], uhel: 55, popis: 'levý bok se vyklopí na dvou hřebících (čepech) nahoře' };
      bokL.cep = zp;
      otvory.push({ typ: 'mezera', stena: 'bokL', plocha: D * mez, z0: zr(0) - mez });
    }
    dily.push(bokL, bokP);

    // dno
    if (maDno) {
      const dno = { id: 'dno', nazev: 'Dno', ks: 1, osa: 'z', a0: 0, a1: t, poly: [[0, 0], [W, 0], [W, D], [0, D]], diry: [], krokSlozeni: 0, rozlet: [0, 0, -1] };
      if (P.odvodneni !== false) {
        const m = Math.min(15, W / 5, D / 5);
        for (const [x, y] of [[m, m], [W - m, m], [m, D - m], [W - m, D - m]]) dno.diry.push({ osa: 'z', c: [x, y], tvar: 'kruh', d: 6, s0: -1, s1: t + 1, ucel: 'odvodneni' });
        otvory.push({ typ: 'odvodneni', stena: 'dno', plocha: 4 * Math.PI * 9 });
      }
      dily.push(dno);
    } else {
      otvory.push({ typ: 'sterbina', stena: 'dno', plocha: W * D });
    }

    // stříška: rovnoběžník, oba konce svisle (úkos α), zadním koncem dosedá na zadní stěnu
    const strecha = {
      id: 'strecha', nazev: 'Stříška', ks: 1, osa: 'x', a0: -t - pb, a1: W + t + pb,
      poly: [[D, zr(D)], [yf, zr(yf)], [yf, zr(yf) + tc], [D, zr(D) + tc]], diry: [], krokSlozeni: 5, rozlet: [0, 0, 1],
    };
    if (cist === 'strecha') strecha.otevrit = { bod: [0, D, zr(D) + tc], smer: [1, 0, 0], uhel: -100, popis: 'stříška se odklopí na pantu u zadní stěny' };
    dily.push(strecha);

    // rozvinuté tvary dílů (plocha pro řezný plán a šablonu): u = podél délky prkna, v = napříč
    const ukosy = [];
    for (const d of dily) d.plocha = plochaDilu(d, { W, D, t, k, alfa, zd, zr, yf, tc, pb, zadDole, zTop, polo, predniV, mez });
    if (!polo) ukosy.push({ dil: 'predni', uhel: alfa, popis: 'horní hrana přední stěny – úkos ' + cz(alfa) + '° (vnější líc nižší)' });
    ukosy.push({ dil: 'strecha', uhel: alfa, popis: 'oba konce stříšky – úkos ' + cz(alfa) + '° (rovnoběžné, po osazení svislé)' });

    const dutina = { W, D, zd, Hf, Hb: r2(Hb), k, alfa, t, x0: 0, x1: W, y0: 0, y1: D, zr, objem: W * D * (Hf + D * k / 2) };
    const vnejsi = { sirka: W + 2 * t + 2 * pb, hloubka: D + 2 * t + pp, vyska: zTop + zadDole };
    if (typ !== 'netopyr' && W * D < 90 * 90) varovani.push('Dno menší než 90 × 90 mm je pro snůšku příliš malé (doporučeno min. 100 × 100 mm).');
    if (t < 15) varovani.push('Prkno tenčí než 15 mm špatně izoluje (přehřátí, chlad) – doporučeno 18–25 mm.');
    if (cist === 'zadne' && typ !== 'netopyr') varovani.push('Budka bez možnosti otevření nejde vyčistit – zvolte odklápěcí stříšku nebo bok.');

    return {
      P, druh: S, typ, dily, dutina, otvory, varovani, ukosy, vnejsi, cisteni: cist,
      info: { Hb: r2(Hb), vnejsi, zTop, yf, tc, otv, predniV, zadDole, zadNahore },
      kusovnik: kusovnik({ typ, t, W, D, cist, montaz: montaz.length, dily }),
    };
  }

  /** rozvinutý tvar dílu: {delka (u), sirka (v), obrys [[u,v]], diry [{u,v,tvar,d,w,h,ucel}], popisy, pohled} */
  function plochaDilu(d, g) {
    const { W, D, t, k, alfa, zr, yf, tc, zadDole, zTop } = g;
    if (d.id === 'predni') {
      const vI = g.polo ? g.zd + g.predniV : zr(0), vO = g.polo ? vI : zr(-t);
      const sir = W + 2 * t;
      // u = výška (podél prkna), v = šířka; pohled zvenku: x roste doprava → v = x + t
      return {
        delka: vI, sirka: sir, obrys: [[0, 0], [vI, 0], [vI, sir], [0, sir]], ukos: g.polo ? null : { hrana: 'konec', uhel: alfa, rozdil: r2(vI - vO) },
        diry: d.diry.map((q) => ({ u: q.c[1], v: q.c[0] + t, tvar: q.tvar, d: q.d, w: q.w, h: q.h, ucel: q.ucel || 'vletovy' })),
        rozmer: [sir, vI], popis: g.polo ? 'přední stěna polobudky' : `vnitřní líc ${cz(vI)} mm, vnější líc ${cz(vO)} mm`,
      };
    }
    if (d.id === 'zadni') {
      const vys = zTop + zadDole, sir = W + 2 * t;
      return { delka: vys, sirka: sir, obrys: [[0, 0], [vys, 0], [vys, sir], [0, sir]], diry: d.diry.map((q) => ({ u: q.c[1] + zadDole, v: q.c[0] + t, tvar: 'kruh', d: q.d, ucel: q.ucel })), rozmer: [sir, vys], popis: zadDole > 0 ? `přesah dolů ${cz(zadDole)} mm` : 'zadní stěna' };
    }
    if (d.id === 'bokL' || d.id === 'bokP') {
      const a = d.poly[3][1], b = d.poly[2][1];
      // u = výška, v = hloubka (0 = přední hrana)
      return { delka: b, sirka: D, obrys: [[0, 0], [a, 0], [b, D], [0, D]], lichobeznik: { a, b }, diry: d.diry.map((q) => ({ u: q.c[1], v: q.c[0], tvar: q.tvar, d: q.d, w: q.w, h: q.h, ucel: q.ucel || 'vletovy' })), rozmer: [D, b], popis: `přední hrana ${cz(a)} mm, zadní ${cz(b)} mm` };
    }
    if (d.id === 'dno') return { delka: D, sirka: W, obrys: [[0, 0], [D, 0], [D, W], [0, W]], diry: d.diry.map((q) => ({ u: q.c[1], v: q.c[0], tvar: 'kruh', d: q.d, ucel: q.ucel })), rozmer: [W, D], popis: d.diry.length ? 'odvodňovací otvory Ø 6 mm v rozích' : 'dno' };
    if (d.id === 'strecha') {
      const L = (D - yf) / Math.cos(alfa * RAD), sir = d.a1 - d.a0;
      return { delka: L, sirka: sir, obrys: [[0, 0], [L, 0], [L, sir], [0, sir]], ukos: { hrana: 'oba', uhel: alfa, rozdil: r2(t * k) }, spotreba: L + t * k, diry: [], rozmer: [sir, L], popis: `délka ${cz(L)} mm, oba konce úkos ${cz(alfa)}°` };
    }
    // obecný kvádr (police hotelu apod.)
    return d.plocha || null;
  }

  /* ---------------- kusovník ---------------- */
  function delkaVrutu(t) {
    const cil = t * 2.2, rada = [25, 30, 35, 40, 45, 50, 60, 70];
    return rada.find((x) => x >= cil) || 70;
  }
  function kusovnik(o) {
    const t = o.t, Ø = t > 22 ? 4.5 : t >= 18 ? 4 : 3.5, L = delkaVrutu(t), out = [];
    let n = 0;
    if (o.typ === 'netopyr') n = 4 + 4 + 2; // přední 4 do lišt, zadní 4 do lišt, stříška 2
    else n = 4 /* přední do boků */ + 4 /* zadní do boků */ + 4 /* dno přes boky */ + (o.cist === 'bok' ? -2 : 0);
    out.push({ polozka: `Vrut do dřeva ${cz(Ø)} × ${L} mm, nerez nebo pozink (typický)`, ks: n, pozn: 'předvrtat Ø ' + cz(Ø * 0.6) + ' mm ~10 mm od hrany' });
    if (o.cist === 'strecha') {
      out.push({ polozka: 'Pant plochý 40 × 30 mm (typický) nebo pruh pryže z duše', ks: 1, pozn: 'na stříšku a zadní stěnu, s vruty 3 × 12 mm' });
      out.push({ polozka: 'Vrut 3 × 12 mm (k pantu)', ks: 4, pozn: '' });
      out.push({ polozka: 'Háček s očkem (typický) nebo pojistný vrut', ks: 1, pozn: 'zajistí stříšku proti větru a kuně' });
      out.push({ polozka: 'Vrut stříšky do boku (pevná strana)', ks: 0, pozn: 'stříška se nepřišroubuje – drží pantem a háčkem' });
    } else if (o.cist === 'bok') {
      out.push({ polozka: 'Hřebík pozinkovaný 2,5 × 50 mm (čep otočného boku)', ks: 2, pozn: 'přes přední a zadní stěnu do boku, ve stejné výšce' });
      out.push({ polozka: `Vrut ${cz(Ø)} × ${L} mm (pojistka boku dole)`, ks: 1, pozn: 'vyšroubovat při čištění' });
      out.push({ polozka: `Vrut stříšky ${cz(Ø)} × ${L} mm`, ks: 4, pozn: 'stříška pevně do boků a zadní stěny' });
    } else {
      out.push({ polozka: `Vrut stříšky ${cz(Ø)} × ${L} mm`, ks: 4, pozn: 'stříška pevně' });
    }
    if (o.montaz) out.push({ polozka: 'Vrut / hliníkový hřebík k připevnění (typický)', ks: o.montaz, pozn: 'do živého stromu raději hliníkové hřebíky nebo drátěný úvaz s podložkou (ocel poškodí pilu)' });
    out.push({ polozka: 'Lepidlo na dřevo D3 (venkovní) – volitelně', ks: 1, pozn: 'spoje lepit i šroubovat; uvnitř žádné nátěry' });
    out.push({ polozka: 'Lněný olej / ekologická lazura – jen zvenku (volitelně)', ks: 1, pozn: 'vnitřek nechat neošetřený' });
    return out;
  }

  /* ---------------- bodové testy ---------------- */
  function vPolygonu(p, poly) {
    let uvnitr = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) uvnitr = !uvnitr;
    }
    return uvnitr;
  }
  const rozlozBod = (osa, p) => (osa === 'x' ? [p[0], [p[1], p[2]]] : osa === 'y' ? [p[1], [p[0], p[2]]] : [p[2], [p[0], p[1]]]);
  function vOtvoru(q, p) {
    const [a, uv] = rozlozBod(q.osa, p);
    if (a < q.s0 || a > q.s1) return false;
    const du = uv[0] - q.c[0], dv = uv[1] - q.c[1];
    if (q.tvar === 'oval') return (du * du) / (q.w * q.w / 4) + (dv * dv) / (q.h * q.h / 4) <= 1;
    return du * du + dv * dv <= q.d * q.d / 4;
  }
  /** leží bod p = [x, y, z] v materiálu dílu (ne v jeho otvoru)? */
  function vDilu(d, p) {
    const [a, uv] = rozlozBod(d.osa, p);
    if (a < d.a0 || a > d.a1) return false;
    if (!vPolygonu(uv, d.poly)) return false;
    for (const q of d.diry || []) if (vOtvoru(q, p)) return false;
    return true;
  }
  function vDutine(B, p) {
    const u = B.dutina;
    return p[0] > 0 && p[0] < u.W && p[1] > 0 && p[1] < u.D && p[2] > u.zd && p[2] < u.zr(p[1]);
  }
  /** objem hranolu bez otvorů (mm³) */
  function plochaPoly(poly) { let s = 0; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]); return Math.abs(s) / 2; }
  function objemDilu(d) {
    let v = plochaPoly(d.poly) * (d.a1 - d.a0);
    for (const q of d.diry || []) {
      const h = Math.min(q.s1, d.a1 + 50) - Math.max(q.s0, d.a0 - 50);
      const A = q.tvar === 'oval' ? Math.PI * q.w * q.h / 4 : Math.PI * q.d * q.d / 4;
      if (q.osa === d.osa) v -= A * (d.a1 - d.a0); else v -= A * Math.max(0, Math.min(h, tloustkaKolmo(d, q)));
    }
    return v;
  }
  function tloustkaKolmo(d, q) {
    // tloušťka dílu ve směru osy otvoru (pro hranoly rovnoběžné s osou x je to rozsah polygonu)
    const i = d.osa === 'x' ? (q.osa === 'y' ? 0 : 1) : d.osa === 'y' ? (q.osa === 'x' ? 0 : 1) : (q.osa === 'x' ? 0 : 1);
    const hod = d.poly.map((p) => p[i]); return Math.max(...hod) - Math.min(...hod);
  }

  /* ---------------- řezný plán ----------------
     Díly se kladou za sebe podél prkna (u = délka), napříč prknem (v) smí ležet vedle sebe jen dvojice boků
     (lichoběžníky do sebe – jeden šikmý řez). Každý příčný řez stojí prořez (šířka kotouče). */
  function rezny(B, nast) {
    const n = Object.assign({ B: 150, L: 1200, prorez: 3 }, nast || {});
    const sirkaPrkna = cislo(n.B, 150), delkaPrkna = cislo(n.L, 1200), kerf = Math.max(0, cislo(n.prorez, 3));
    const dily = B.dily, chyby = [], segmenty = [];
    const podle = (id) => dily.find((d) => d.id === id);
    const poradi = ['predni', 'boky', 'zadni', 'dno', 'strecha'];
    const extra = dily.filter((d) => !['predni', 'zadni', 'bokL', 'bokP', 'dno', 'strecha'].includes(d.id));
    const vlozObd = (d, kusu) => {
      const p = d.plocha;
      if (!p) return;
      const spot = (p.spotreba || p.delka) + (p.ukos && p.ukos.uhel > 0 ? kerf : 0); // úkos = řez navíc (začištění konce)
      for (let i = 0; i < (kusu || d.ks || 1); i++) {
        // standardně délka podél prkna; když šířka nevejde, otočit
        let otoceno = false, u = spot, v = p.sirka;
        if (v > sirkaPrkna + 1e-6 && spot <= sirkaPrkna + 1e-6) { otoceno = true; u = p.sirka + (p.ukos ? 0 : 0); v = p.delka; }
        if (v > sirkaPrkna + 1e-6) chyby.push(`${d.nazev} (${cz(p.sirka)} × ${cz(p.delka)} mm) se nevejde na prkno šíře ${cz(sirkaPrkna)} mm.`);
        segmenty.push({ dily: [{ id: d.id, nazev: d.nazev, otoceno, u0: 0, u1: u, v0: 0, v1: Math.min(v, sirkaPrkna), plocha: p }], delka: u, sirka: v, ukos: p.ukos || null, otoceno });
      }
    };
    for (const kl of poradi) {
      if (kl === 'boky') {
        const L = podle('bokL'), P = podle('bokP');
        if (!L || !P) continue;
        const a1 = L.plocha.lichobeznik.a, b1 = L.plocha.lichobeznik.b, a2 = P.plocha.lichobeznik.a, b2 = P.plocha.lichobeznik.b, Dd = L.plocha.sirka;
        if (Dd > sirkaPrkna + 1e-6) chyby.push(`Boky (hloubka ${cz(Dd)} mm) se nevejdou na prkno šíře ${cz(sirkaPrkna)} mm.`);
        // šikmý řez: posun o prořez měřený kolmo na řez → vodorovně kerf / cos θ
        const th = Math.atan2(Math.abs(b1 - a1), Dd), dk = kerf / Math.cos(th);
        const delka = Math.max(a1 + b2, b1 + a2) + dk;
        // levý bok: přední hrana (a1) na v = 0, zadní (b1) na v = D; pravý otočený o 180° do zbytku
        segmenty.push({
          dvojice: true, delka, sirka: Dd, uhelSikmy: r1(th / RAD), dk,
          dily: [
            { id: L.id, nazev: L.nazev, obrys: [[0, 0], [a1, 0], [b1, Dd], [0, Dd]], plocha: L.plocha },
            { id: P.id, nazev: P.nazev + ' (otočený o 180°)', obrys: [[a1 + dk, 0], [delka, 0], [delka, Dd], [b1 + dk, Dd]], plocha: P.plocha, otoceny180: true },
          ],
        });
        continue;
      }
      const d = podle(kl); if (d) vlozObd(d);
    }
    for (const d of extra) vlozObd(d, d.ks);
    // pozice podél prkna
    let u = 0;
    const rezy = [];
    segmenty.forEach((s, i) => {
      s.u0 = u; s.u1 = u + s.delka;
      if (s.dvojice) rezy.push({ u: s.u0 + (s.dily[0].obrys[1][0] + s.dily[0].obrys[2][0]) / 2, typ: 'sikmy', uhel: s.uhelSikmy, popis: `šikmý řez boků (od příčného ${cz(s.uhelSikmy)}°)` });
      u = s.u1;
      if (s.ukos && s.ukos.uhel > 0) rezy.push({ u: s.u1, typ: 'ukos', uhel: s.ukos.uhel, popis: `úkos ${cz(s.ukos.uhel)}° (${s.dily[0].nazev})` });
      else rezy.push({ u: s.u1, typ: 'pricny', uhel: 0, popis: 'příčný řez 90°' });
      if (i < segmenty.length - 1) u += kerf; // prořez za každým dílem
    });
    const soucetDilu = segmenty.reduce((a, s) => a + s.delka, 0), prorezy = Math.max(0, segmenty.length - 1) * kerf;
    const potreba = soucetDilu + prorezy;
    if (potreba > delkaPrkna + 1e-6) chyby.push(`Na díly je potřeba ${cz(potreba, 0)} mm prkna, zadáno ${cz(delkaPrkna, 0)} mm – chybí ${cz(potreba - delkaPrkna, 0)} mm.`);
    const maxSirka = Math.max(...segmenty.map((s) => s.sirka));
    return { segmenty, rezy, soucetDilu, prorezy, potreba, zbytek: delkaPrkna - potreba, delkaPrkna, sirkaPrkna, kerf, maxSirka, chyby, vejde: !chyby.length };
  }
  /** nejmenší délka prkna pro dané díly (pro doporučení) */
  function minimalniPrkno(B, n) { const r = rezny(B, Object.assign({}, n, { L: 1e9 })); return { delka: Math.ceil(r.potreba / 10) * 10 + 20, sirka: Math.ceil(r.maxSirka) }; }

  /* ---------------- hmyzí hotel ---------------- */
  const MODULY = {
    drevo: { nazev: 'Dřevo s otvory', popis: 'tvrdé vyschlé dřevo (buk, jasan, dub), otvory do boku (ne do čela)', barva: '#b0814f' },
    rakos: { nazev: 'Trubičky rákosí / bambusu', popis: 'stonky Ø 3–10 mm, uříznuté za kolénkem (zadní konec uzavřený)', barva: '#d7c27a' },
    cihla: { nazev: 'Děrovaná cihla', popis: 'plná pálená cihla s vyvrtanými otvory Ø 6–8 mm nebo děrovka s otvory ucpanými jílem na konci', barva: '#b4553d' },
    hlina: { nazev: 'Hliněná stěna', popis: 'jíl + písek 1:1 v rámečku, otvory Ø 4–8 mm vypíchnuté špejlí', barva: '#9c7b5a' },
  };
  function vychoziHotel() {
    const H = zakladHotelu(), dop = doporucPrkno(hotel(H), H.prorez);
    H.B = dop.B; H.L = dop.L;
    return H;
  }
  function zakladHotelu() {
    return {
      W: 260, D: 150, Hf: 400, sklon: 15, t: 20, presahPredni: 40, presahBok: 0, zadDole: 0, zadNahore: 0,
      B: 300, L: 2400, prorez: 3, rozestup: 8, okraj: 10,
      patra: [
        { vyska: 110, moduly: [{ typ: 'drevo', sirka: 130, prumery: [3, 4, 5, 6] }, { typ: 'drevo', sirka: 130, prumery: [6, 8, 10] }] },
        { vyska: 120, moduly: [{ typ: 'rakos', sirka: 260, prumery: [4, 6, 8, 10] }] },
        { vyska: 130, moduly: [{ typ: 'cihla', sirka: 120, prumery: [6, 8] }, { typ: 'drevo', sirka: 140, prumery: [4, 5, 6, 8] }] },
      ],
    };
  }
  /** doporučená hloubka otvoru podle průměru (mm) */
  function hloubkaOtvoru(d, maxHl) {
    const h = d <= 4 ? 70 : d <= 6 ? 100 : 130;
    return Math.max(10, Math.min(h, maxHl));
  }
  /**
   * rozlozDiry(w, h, prumery, o) → [{x, y, d, hl}] v bloku w × h (x vpravo, y nahoru)
   * Řady odspodu, průměry se střídají po řadách (největší dole), sousední řady posunuté o půl rozteče.
   * Rozestup = mezera mezi okraji sousedních otvorů ≥ max(o.rozestup, menší z průměrů); okraj bloku ≥ max(o.okraj, d).
   */
  function rozlozDiry(w, h, prumery, o) {
    o = Object.assign({ rozestup: 8, okraj: 10, hloubkaBloku: 150 }, o || {});
    const ds = [...new Set((prumery || []).map((x) => cislo(x, 0)).filter((x) => x >= 1.5 && x <= 14))].sort((a, b) => b - a);
    const out = [];
    if (!ds.length) return out;
    const mez = (a, b) => Math.max(o.rozestup, Math.min(a, b));
    let y = null, predD = null, i = 0, radek = 0;
    for (let bezp = 0; bezp < 400; bezp++) {
      const d = ds[i % ds.length];
      const m = Math.max(o.okraj, d);
      const yN = y == null ? m + d / 2 : y + (predD + d) / 2 + mez(predD, d);
      if (yN + d / 2 + m > h + 1e-9) {
        if (ds.length > 1 && i % ds.length !== ds.length - 1 && y != null) { i++; continue; } // zkusit menší průměr
        break;
      }
      const s = d + mez(d, d), off = radek % 2 ? s / 2 : 0;
      const dostupne = w - 2 * m;
      const kusu = Math.max(0, Math.floor((dostupne - d - off) / s + 1e-9) + 1);
      if (kusu >= 1) {
        const sirkaRady = (kusu - 1) * s + d, x0 = m + (dostupne - sirkaRady - off) / 2 + off + d / 2;
        for (let j = 0; j < kusu; j++) out.push({ x: r2(x0 + j * s), y: r2(yN), d, hl: hloubkaOtvoru(d, o.hloubkaBloku - 10) });
      }
      y = yN; predD = d; i++; radek++;
    }
    return out;
  }
  /** odhad počtu trubiček v ploše w × h při šestiúhelníkovém skladu (hustota 0,9069) */
  function pocetTrubicek(w, h, prumery) {
    const ds = (prumery || [6]).map((x) => cislo(x, 6)).filter((x) => x > 0), dm = ds.reduce((a, b) => a + b, 0) / ds.length + 1.5; // + stěna stonku
    return Math.floor(0.9069 * w * h / (Math.PI * dm * dm / 4) * 0.92);
  }
  function hotel(Hin) {
    const H = Object.assign(zakladHotelu(), Hin || {});
    const W = Math.max(100, cislo(H.W, 300)), t = Math.max(8, cislo(H.t, 20)), D = Math.max(60, cislo(H.D, 150)), Hf = Math.max(100, cislo(H.Hf, 400));
    const alfa = Math.max(0, Math.min(35, cislo(H.sklon, 15))), k = Math.tan(alfa * RAD), tc = t / Math.cos(alfa * RAD);
    const zd = t, zr = (y) => zd + Hf + y * k, pp = Math.max(0, cislo(H.presahPredni, 40)), pb = Math.max(0, cislo(H.presahBok, 0)), yf = -t - pp;
    const varovani = [], dily = [];
    const zTop = zr(D) + tc + Math.max(0, cislo(H.zadNahore, 0)), zadDole = Math.max(0, cislo(H.zadDole, 0));
    const g = { W, D, t, k, alfa, zd, zr, yf, tc, pb, zadDole, zTop, polo: false };
    const zadni = { id: 'zadni', nazev: 'Zadní stěna', ks: 1, osa: 'x', a0: -t, a1: W + t, poly: [[D, -zadDole], [D + t, -zadDole], [D + t, zTop], [D, zTop]], diry: [], krokSlozeni: 1, rozlet: [0, 1, 0] };
    const bokL = { id: 'bokL', nazev: 'Levý bok', ks: 1, osa: 'x', a0: -t, a1: 0, poly: [[0, 0], [D, 0], [D, zr(D)], [0, zr(0)]], diry: [], krokSlozeni: 2, rozlet: [-1, 0, 0] };
    const bokP = Object.assign({}, bokL, { id: 'bokP', nazev: 'Pravý bok', a0: W, a1: W + t, rozlet: [1, 0, 0] });
    const dno = { id: 'dno', nazev: 'Dno', ks: 1, osa: 'z', a0: 0, a1: t, poly: [[0, 0], [W, 0], [W, D], [0, D]], diry: [], krokSlozeni: 0, rozlet: [0, 0, -1] };
    const strecha = { id: 'strecha', nazev: 'Stříška', ks: 1, osa: 'x', a0: -t - pb, a1: W + t + pb, poly: [[D, zr(D)], [yf, zr(yf)], [yf, zr(yf) + tc], [D, zr(D) + tc]], diry: [], krokSlozeni: 5, rozlet: [0, 0, 1] };
    dily.push(zadni, bokL, bokP, dno);
    // police mezi patry
    const patra = (H.patra || []).map((p) => Object.assign({}, p, { vyska: Math.max(30, cislo(p.vyska, 100)) }));
    let z = zd;
    const umisteni = [];
    patra.forEach((p, i) => {
      const posledni = i === patra.length - 1;
      const vys = posledni ? zr(0) - z : p.vyska;
      umisteni.push({ z0: z, z1: z + vys, vyska: vys, patro: p });
      if (!posledni) {
        const pol = { id: 'police' + (i + 1), nazev: `Police ${i + 1}`, ks: 1, osa: 'z', a0: z + vys, a1: z + vys + t, poly: [[0, 0], [W, 0], [W, D], [0, D]], diry: [], krokSlozeni: 3, rozlet: [0, -1.5, 0] };
        pol.plocha = { delka: D, sirka: W, obrys: [[0, 0], [D, 0], [D, W], [0, W]], diry: [], rozmer: [W, D], popis: 'police' };
        dily.push(pol);
        z += vys + t;
      }
    });
    if (umisteni.length && umisteni[umisteni.length - 1].vyska < 40) varovani.push('Horní patro je nižší než 40 mm – snižte výšky pater nebo zvyšte rám.');
    dily.push(strecha);
    for (const d of dily) if (!d.plocha) d.plocha = plochaDilu(d, g);
    // moduly v patrech
    const moduly = [];
    umisteni.forEach((u, ip) => {
      let x = 0;
      const ms = (u.patro.moduly || []);
      const soucet = ms.reduce((a, m) => a + Math.max(20, cislo(m.sirka, 100)), 0);
      if (soucet > W + 0.5) varovani.push(`Patro ${ip + 1}: moduly (${cz(soucet, 0)} mm) jsou širší než vnitřek rámu ${cz(W, 0)} mm.`);
      ms.forEach((m, im) => {
        const sir = Math.min(Math.max(20, cislo(m.sirka, 100)), W - x);
        if (sir <= 0) return;
        const vys = u.vyska - 2, hl = D - 5, typ = MODULY[m.typ] ? m.typ : 'drevo';
        const mod = { patro: ip + 1, poradi: im + 1, typ, x0: x + 1, x1: x + sir - 1, z0: u.z0 + 1, z1: u.z0 + 1 + vys, sirka: sir - 2, vyska: vys, hloubka: hl, prumery: (m.prumery || []).slice() };
        if (typ === 'drevo' || typ === 'cihla' || typ === 'hlina') {
          mod.diry = rozlozDiry(mod.sirka, mod.vyska, mod.prumery.length ? mod.prumery : (typ === 'drevo' ? [4, 6, 8] : [6, 8]), { rozestup: cislo(H.rozestup, 8), okraj: cislo(H.okraj, 10), hloubkaBloku: hl });
        } else if (typ === 'rakos') {
          mod.trubicek = pocetTrubicek(mod.sirka, mod.vyska, mod.prumery.length ? mod.prumery : [6]);
          mod.delkaTrubicek = hl;
        }
        moduly.push(mod);
        x += sir;
      });
      if (x < W - 5) varovani.push(`Patro ${ip + 1}: zbývá ${cz(W - x, 0)} mm volného místa – doplňte modul nebo rozšiřte stávající (mezery vyplňte, aby moduly nevypadly).`);
    });
    const dutina = { W, D, zd, Hf, Hb: r2(Hf + D * k), k, alfa, t, zr };
    // kusovník hotelu
    const Ø = t > 22 ? 4.5 : t >= 18 ? 4 : 3.5, L = delkaVrutu(t);
    const pocetDer = moduly.reduce((a, m) => a + (m.diry ? m.diry.length : 0), 0);
    const kus = [
      { polozka: `Vrut do dřeva ${cz(Ø)} × ${L} mm, nerez/pozink (typický)`, ks: 4 + 4 + 4 + (patra.length - 1) * 4 + 4, pozn: 'rám, police a stříška' },
      { polozka: 'Pletivo (čtvercové oko 15–25 mm) proti sýkorám a strakatým datlům', ks: 1, pozn: `${cz(W + 2 * t, 0)} × ${cz(zr(0), 0)} mm, 2–3 cm před čelem na distančních lištách` },
      { polozka: 'Zadní stěna: prkno nebo voděodolná překližka 6–10 mm', ks: 1, pozn: 'otvory musí být neprůchozí' },
    ];
    for (const m of moduly) {
      if (m.typ === 'drevo') kus.push({ polozka: `Dřevěný blok ${cz(m.sirka, 0)} × ${cz(m.vyska, 0)} × ${cz(m.hloubka, 0)} mm (patro ${m.patro}) – listnaté, vyschlé`, ks: 1, pozn: `${m.diry.length} otvorů Ø ${[...new Set(m.diry.map((q) => q.d))].join(', ')} mm` });
      if (m.typ === 'rakos') kus.push({ polozka: `Trubičky rákosu/bambusu Ø ${m.prumery.join('–')} mm, délka ${cz(m.delkaTrubicek, 0)} mm (patro ${m.patro})`, ks: m.trubicek, pozn: 'zadní konec uzavřený kolénkem nebo ucpaný hlínou/vatou' });
      if (m.typ === 'cihla') kus.push({ polozka: `Plná pálená cihla nebo děrovka (patro ${m.patro}), výřez ${cz(m.sirka, 0)} × ${cz(m.vyska, 0)} mm (typické rozměry cihly se liší)`, ks: 1, pozn: `${m.diry.length} otvorů vyvrtat vrtákem do zdiva` });
      if (m.typ === 'hlina') kus.push({ polozka: `Jíl + písek 1 : 1 (patro ${m.patro})`, ks: 1, pozn: `${m.diry.length} otvorů vypíchnout, nechat vyschnout` });
    }
    return {
      H, dily, dutina, moduly, varovani, umisteni, kusovnik: kus, pocetDer, typ: 'hotel',
      info: { zTop, yf, tc, vnejsi: { sirka: W + 2 * t + 2 * pb, hloubka: D + 2 * t + pp, vyska: zTop + zadDole } },
      vnejsi: { sirka: W + 2 * t + 2 * pb, hloubka: D + 2 * t + pp, vyska: zTop + zadDole },
    };
  }

  /* ---------------- tisk: papíry, kalibrace, dělení na listy ---------------- */
  const PAPIRY = { a4: [210, 297], a3: [297, 420], letter: [215.9, 279.4] };
  const PATA = 16, PRAVY_PAS = 13;
  function rozmerPapiru(n) {
    if (n.papir === 'vlastni') return [Math.max(80, cislo(n.papirW, 210)), Math.max(80, cislo(n.papirH, 297))];
    return PAPIRY[n.papir] || PAPIRY.a4;
  }
  function korekceMeritka(mx, my) {
    const k = (m) => { m = cislo(m, 100); return m > 80 && m < 120 ? 100 / m : 1; };
    return { kx: k(mx), ky: k(my) };
  }
  const mmNaPt = (mm) => mm * 72 / 25.4;
  /**
   * rozvrhListu(obl {x0,y0,x1,y1} mm modelu, pw, ph, n {okraj, prekryv, kalibX, kalibY}) →
   * {W, H, uw, uh, uwM, uhM, nx, ny, g, jeden, listy:[{x0,y0,x1,y1,r,c}], kx, ky}
   */
  function rozvrhListu(obl, pw, ph, n) {
    n = Object.assign({ okraj: 8, prekryv: 15 }, n || {});
    const K = korekceMeritka(n.kalibX, n.kalibY), ok = cislo(n.okraj, 8);
    const sw = obl.x1 - obl.x0, sh = obl.y1 - obl.y0;
    const varianta = (W, H) => {
      const uw = W - 2 * ok - PRAVY_PAS, uh = H - 2 * ok - PATA, uwM = uw / K.kx, uhM = uh / K.ky;
      if (sw <= uwM + 1e-6 && sh <= uhM + 1e-6) return { W, H, uw, uh, uwM, uhM, nx: 1, ny: 1, g: 0, jeden: true };
      const g = Math.min(Math.max(cislo(n.prekryv, 15), 5), uwM * 0.4, uhM * 0.4);
      const nx = sw <= uwM + 1e-6 ? 1 : Math.ceil((sw - g) / (uwM - g) - 1e-9), ny = sh <= uhM + 1e-6 ? 1 : Math.ceil((sh - g) / (uhM - g) - 1e-9);
      return { W, H, uw, uh, uwM, uhM, nx, ny, g, jeden: false };
    };
    const a = varianta(pw, ph), b = varianta(ph, pw);
    const v = b.nx * b.ny < a.nx * a.ny ? b : a;
    const cw = v.nx === 1 ? v.uwM : v.nx * (v.uwM - v.g) + v.g, chh = v.ny === 1 ? v.uhM : v.ny * (v.uhM - v.g) + v.g;
    const ox = v.jeden ? obl.x0 - (cw - sw) / 2 : obl.x0, top = v.jeden ? obl.y1 + (chh - sh) / 2 : obl.y1, listy = []; // více listů: od levého horního rohu (bez prázdných pruhů)
    for (let r = 0; r < v.ny; r++) for (let c = 0; c < v.nx; c++) {
      const x0 = ox + c * (v.uwM - v.g), y1 = top - r * (v.uhM - v.g);
      listy.push({ x0, x1: x0 + v.uwM, y0: y1 - v.uhM, y1, r, c });
    }
    return Object.assign(v, { listy, kx: K.kx, ky: K.ky });
  }

  const API = {
    DRUHY, PORADI_DRUHU, ZDROJE, MODULY, PAPIRY, PATA, PRAVY_PAS,
    vychoziBudka, zakladBudky, doporucPrkno, SIRKY_PRKEN, budka, rezny, minimalniPrkno, kusovnik, delkaVrutu,
    vychoziHotel, zakladHotelu, hotel, rozlozDiry, hloubkaOtvoru, pocetTrubicek,
    vDilu, vDutine, vOtvoru, vPolygonu, objemDilu, plochaPoly,
    rozmerPapiru, korekceMeritka, mmNaPt, rozvrhListu, cislo, cz, r1, r2, RAD,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.PB = API;
})(typeof window !== 'undefined' ? window : globalThis);

/* Samozavlažovací květináče – jádro generátoru (bez DOM a bez three.js, spustitelné v node).
   Druhy: sada (nádoba = zásobník vody + vložka na substrát), kvetinac (obyčejný květináč + podmiska),
   vlozka (samozavlažovací vložka do existujícího obalu), podmiska (jen podmiska podle dna květináče).

   Souřadnice: osa Z = osa květináče, z = 0 je spodek nádoby (stůl). Všechno se tiskne DNEM DOLŮ bez podpor:
   dno vložky je kužel pod povoleným převisem, který se sbíhá do knotové nohy (dutý sloupek se štěrbinami, stojí na podložce),
   límec vložky má spodek kuželový a sedí v kuželovém sražení okraje nádoby, vodorovné díry jsou kapky, okénka mají sedlovou stříšku.
   Plášť = zaoblený pravidelný N-úhelník (N = 0 → kruh) s apotémou a(z); stěna, vůle i límec jsou přesná odsazení (a ± e, roh ± e).
   Úhly prvků: plnění θ0, vodoznak s plovákem θ0 + 90°, přepad θ0 + 180°, průzor θ0 + 270°, nožky θ0 + 45° + k·90° (θ0 = 45° u čtverce = roh).

   postav(w, p) → {dily: [tištěné díly], sestava: [díly v montážní poloze], o, objemy: {substrat, voda} (mm³, ze sítě), cas}. */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const fmt = G.fmt, kopie = G.kopie;
  const rad = s => s * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const mezi = (x, a, b) => Math.min(b, Math.max(a, x));

  const DATUM = '25. 11. 2026';
  const MATERIALY = {
    PETG: { nazev: 'PETG', hustota: 1.27 },
    PLA: { nazev: 'PLA', hustota: 1.24 },
    ASA: { nazev: 'ASA', hustota: 1.07 },
    PP: { nazev: 'PP (polypropylen)', hustota: 0.9 },
    ABS: { nazev: 'ABS', hustota: 1.04 },
  };
  /** Spotřeba vody rostlinou v ml/den – hrubý odhad pro pokojové podmínky; skutečnost se liší podle světla, tepla a velikosti rostliny. */
  const ROSTLINY = {
    sukulent: { nazev: 'sukulent, kaktus', spotreba: 8 },
    pokojova_mala: { nazev: 'pokojová rostlina – malá (Ø 12 cm)', spotreba: 25 },
    pokojova_stredni: { nazev: 'pokojová rostlina – střední (Ø 15 cm)', spotreba: 45 },
    pokojova_velka: { nazev: 'pokojová rostlina – velká (Ø 20 cm)', spotreba: 90 },
    bylinky: { nazev: 'bylinky na slunném parapetu', spotreba: 70 },
    vlastni: { nazev: 'vlastní hodnota', spotreba: 0 },
  };
  const NAZVY = {
    druh: { sada: 'Samozavlažovací sada', kvetinac: 'Květináč + podmiska', vlozka: 'Vložka do obalu', podmiska: 'Jen podmiska' },
    tvar: { kuzel: 'kužel / válec', zaobleny: 'zaoblený', ctverec: 'čtvercový se zaoblenými rohy', mnohouhelnik: 'mnohoúhelník' },
    povrch: { hladky: 'hladký', zebra: 'žebra', zkrut: 'zkroucená žebra', fazety: 'fazety' },
    zadani: { rozmery: 'rozměry', objem: 'objemem substrátu' },
    vzlinani: { noha: 'knotová noha se substrátem', knot: 'otvory na knot / šňůru' },
    ulozeni: { nozky: 'na nožkách', lem: 'zavěšená za límec' },
    plneni: { sachta: 'šachta ve vložce', hrdlo: 'hrdlo z boku nádoby', zadne: 'bez plnicího otvoru' },
    vodoznak: { plovak: 'plovák s tyčkou', pruzor: 'průzor ve stěně', zadny: 'bez vodoznaku' },
  };

  const VYCHOZI = {
    verze: 1, nazev: 'Samozavlažovací květináč', druh: 'sada', diry: 'kapka',
    plast: { tvar: 'kuzel', zadani: 'rozmery', objem: 1.2, prumerH: 150, prumerD: 115, vyska: 140, stena: 2.4, dno: 2.4, stran: 6, roh: 14,
      povrch: 'hladky', zeber: 18, vyskaZebra: 1.6, zkrut: 60, fazet: 10 },
    obal: { prumerH: 140, prumerD: 105, vyska: 130 },
    vlozka: { vule: 1.5, stena: 1.8, vzlinani: 'noha', ulozeni: 'nozky', lem: 5 },
    noha: { prumer: 38, sterbina: 3 },
    knot: { pocet: 2, prumer: 6 },
    zasobnik: { vyska: 40, rezerva: 6 },
    prepad: { zap: true, prumer: 6 },
    plneni: { typ: 'sachta', prumer: 22 },
    vodoznak: { typ: 'plovak', sirka: 10, tloustka: 0.9, plovak: 28, vyskaPlovaku: 16, tycka: 3, vule: 0.2, vypln: 10 },
    drenaz: { pocet: 4, prumer: 8, kanalky: true },
    podmiska: { zap: true, vule: 3, vyska: 18, zebra: true, prumer: 110 },
    tisk: { material: 'PETG', vrstva: 0.2, extruze: 0.45, perimetru: 3, uhel: 45, podlozka: 220 },
    vypocty: { rostlina: 'pokojova_stredni', spotreba: 45, substrat: 0.7, okraj: 12 },
  };
  const MEZE = {
    'plast.objem': [0.05, 30], 'plast.prumerH': [30, 400], 'plast.prumerD': [20, 400], 'plast.vyska': [25, 400], 'plast.stena': [0.8, 6], 'plast.dno': [0.8, 8],
    'plast.stran': [3, 12, 1], 'plast.roh': [1, 80], 'plast.zeber': [4, 72, 1], 'plast.vyskaZebra': [0.4, 5], 'plast.zkrut': [-360, 360], 'plast.fazet': [5, 24, 1],
    'obal.prumerH': [30, 400], 'obal.prumerD': [20, 400], 'obal.vyska': [30, 400],
    'vlozka.vule': [0.3, 6], 'vlozka.stena': [0.8, 4], 'vlozka.lem': [2, 15],
    'noha.prumer': [14, 150], 'noha.sterbina': [1.5, 6], 'knot.pocet': [1, 6, 1], 'knot.prumer': [2, 14],
    'zasobnik.vyska': [8, 200], 'zasobnik.rezerva': [2, 60], 'prepad.prumer': [3, 14], 'plneni.prumer': [10, 45],
    'vodoznak.sirka': [4, 25], 'vodoznak.tloustka': [0.4, 1.6], 'vodoznak.plovak': [12, 50], 'vodoznak.vyskaPlovaku': [6, 40], 'vodoznak.tycka': [3, 8],
    'vodoznak.vule': [0, 0.6], 'vodoznak.vypln': [0, 40],
    'drenaz.pocet': [0, 12, 1], 'drenaz.prumer': [3, 20],
    'podmiska.vule': [0.5, 15], 'podmiska.vyska': [5, 60], 'podmiska.prumer': [20, 400],
    'tisk.vrstva': [0.05, 0.6], 'tisk.extruze': [0.2, 1.2], 'tisk.perimetru': [1, 8, 1], 'tisk.uhel': [30, 60], 'tisk.podlozka': [100, 600],
    'vypocty.spotreba': [1, 2000], 'vypocty.substrat': [0.1, 2], 'vypocty.okraj': [0, 60],
  };
  const VYCTY = {
    druh: Object.keys(NAZVY.druh), diry: ['kapka', 'kruh'],
    'plast.tvar': Object.keys(NAZVY.tvar), 'plast.povrch': Object.keys(NAZVY.povrch), 'plast.zadani': Object.keys(NAZVY.zadani),
    'vlozka.vzlinani': Object.keys(NAZVY.vzlinani), 'vlozka.ulozeni': Object.keys(NAZVY.ulozeni),
    'plneni.typ': Object.keys(NAZVY.plneni), 'vodoznak.typ': Object.keys(NAZVY.vodoznak),
    'tisk.material': Object.keys(MATERIALY), 'vypocty.rostlina': Object.keys(ROSTLINY),
  };

  /** Předvolby: odchylky od výchozího projektu (tisk zůstává uživatelův). */
  const PREDVOLBY = [
    { id: 'pokojova15', skupina: 'Samozavlažovací sada', nazev: 'Pokojová rostlina Ø 15 cm', popis: 'kužel 150/115 × 140, noha, šachta, plovák', p: {} },
    { id: 'pokojova12', skupina: 'Samozavlažovací sada', nazev: 'Pokojová rostlina Ø 12 cm', popis: 'kužel 120/95 × 115, hrdlo z boku, průzor ve stěně',
      p: { nazev: 'Samozavlažovací Ø 12', plast: { prumerH: 120, prumerD: 95, vyska: 115 }, noha: { prumer: 30 }, zasobnik: { vyska: 36 }, plneni: { typ: 'hrdlo', prumer: 16 },
        vodoznak: { typ: 'pruzor' }, vypocty: { rostlina: 'pokojova_mala', spotreba: 25 } } },
    { id: 'pokojova20', skupina: 'Samozavlažovací sada', nazev: 'Pokojová rostlina Ø 20 cm', popis: 'kužel 200/155 × 185, noha, šachta, plovák',
      p: { nazev: 'Samozavlažovací Ø 20', plast: { prumerH: 200, prumerD: 155, vyska: 185, stena: 2.8 }, vlozka: { stena: 2 }, noha: { prumer: 50 }, zasobnik: { vyska: 55 },
        plneni: { prumer: 26 }, vodoznak: { plovak: 34, vyskaPlovaku: 18 }, vypocty: { rostlina: 'pokojova_velka', spotreba: 90 } } },
    { id: 'bylinky', skupina: 'Samozavlažovací sada', nazev: 'Bylinky na parapet', popis: 'čtvercový 110/95 × 110, šachta v rohu, průzor',
      p: { nazev: 'Bylinky na parapet', plast: { tvar: 'ctverec', prumerH: 110, prumerD: 95, vyska: 110, roh: 14 }, noha: { prumer: 28 }, zasobnik: { vyska: 30, rezerva: 5 },
        plneni: { prumer: 16 }, vodoznak: { typ: 'pruzor' }, vypocty: { rostlina: 'bylinky', spotreba: 70 } } },
    { id: 'sukulent', skupina: 'Samozavlažovací sada', nazev: 'Sukulent – šňůrový knot', popis: 'nízký 110/90 × 75, vložka na límci, 2 knoty',
      p: { nazev: 'Sukulent', plast: { prumerH: 110, prumerD: 90, vyska: 75 }, vlozka: { vzlinani: 'knot', ulozeni: 'lem' }, zasobnik: { vyska: 24, rezerva: 6 },
        plneni: { typ: 'zadne' }, vodoznak: { typ: 'pruzor' }, vypocty: { rostlina: 'sukulent', spotreba: 8, okraj: 8 } } },
    { id: 'zkrouceny', skupina: 'Samozavlažovací sada', nazev: 'Zkroucená žebra', popis: 'zaoblený plášť 150/110 se šroubovitými žebry',
      p: { nazev: 'Zkroucený květináč', plast: { tvar: 'zaobleny', prumerH: 150, prumerD: 110, povrch: 'zkrut', zeber: 20, vyskaZebra: 1.8, zkrut: 70 }, vlozka: { ulozeni: 'lem' } } },
    { id: 'kvetinac15', skupina: 'Květináč a podmiska', nazev: 'Květináč Ø 15 cm s podmiskou', popis: 'drenáž 4 + 1 otvor, drážky pod dnem',
      p: { nazev: 'Květináč Ø 15', druh: 'kvetinac', plast: { dno: 3.2 } } },
    { id: 'fazetovy', skupina: 'Květináč a podmiska', nazev: 'Fazetový květináč', popis: 'kužel 140/100 × 125 s 10 fazetami, podmiska',
      p: { nazev: 'Fazetový květináč', druh: 'kvetinac', plast: { prumerH: 140, prumerD: 100, vyska: 125, dno: 3.2, povrch: 'fazety', fazet: 10 } } },
    { id: 'objem2l', skupina: 'Květináč a podmiska', nazev: 'Šestihran na 2 litry substrátu', popis: 'rozměry se dopočítají z objemu',
      p: { nazev: 'Šestihran 2 l', druh: 'kvetinac', plast: { tvar: 'mnohouhelnik', stran: 6, roh: 10, zadani: 'objem', objem: 2, dno: 3.2 } } },
    { id: 'vlozka', skupina: 'Vložka a podmiska', nazev: 'Vložka do obalu Ø 14 cm', popis: 'obal 140/105 × 130 uvnitř, vložka na nožkách',
      p: { nazev: 'Vložka do obalu', druh: 'vlozka', noha: { prumer: 34 }, zasobnik: { vyska: 35 }, plneni: { prumer: 20 } } },
    { id: 'podmiska', skupina: 'Vložka a podmiska', nazev: 'Podmiska pod dno Ø 11 cm', popis: 'kulatá s žebry, vůle 3 mm',
      p: { nazev: 'Podmiska', druh: 'podmiska' } },
  ];

  function normalizuj(v) { return G.normalizuj(v, { VYCHOZI, MEZE, VYCTY }); }
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(G.slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }
  const segmenty = r => mezi(Math.ceil(2 * Math.PI * Math.max(r, 1) / 1.6 / 8) * 8, 48, 192);

  /* ---------------- obrys: zaoblený pravidelný N-úhelník ---------------- */
  /** Body obrysu proti směru hodin. N = 0: kruh o poloměru a z K bodů. Jinak N stran s apotémou a, rohy o poloměru rc
      (K úseků na oblouk rohu, S úseků na rovnou stranu) – počet bodů N·(K + S) nezávisí na rozměrech, obrysy jdou spojit po vrstvách.
      Středy stran leží na úhlech 2πm/N, rohy mezi nimi. Vrací {P: [[x, y]], n: [[nx, ny]], u: [podíl obvodu]}. */
  function obrys(N, a, rc, K, S = 1) {
    const P = [], n = [], u = [];
    if (!N) {
      for (let i = 0; i < K; i++) { const f = 2 * Math.PI * i / K, c = Math.cos(f), s = Math.sin(f); P.push([a * c, a * s]); n.push([c, s]); u.push(i / K); }
      return { P, n, u };
    }
    const h = Math.PI / N, dc = (a - rc) / Math.cos(h), dA = rc * 2 * h / K, dS = 2 * (a - rc) * Math.tan(h) / S, obvod = N * (K * dA + S * dS);
    let s = 0;
    for (let j = 0; j < N; j++) {
      const fj = h + 2 * h * j, cx = dc * Math.cos(fj), cy = dc * Math.sin(fj);
      for (let i = 0; i <= K; i++) {
        const f = fj - h + 2 * h * i / K, c = Math.cos(f), si = Math.sin(f);
        P.push([cx + rc * c, cy + rc * si]); n.push([c, si]); u.push(s / obvod);
        if (i < K) s += dA;
      }
      const A = P[P.length - 1], fn = fj + 2 * h, f1 = fj + h, B = [dc * Math.cos(fn) + rc * Math.cos(f1), dc * Math.sin(fn) + rc * Math.sin(f1)];
      for (let i = 1; i < S; i++) { s += dS; P.push([A[0] + (B[0] - A[0]) * i / S, A[1] + (B[1] - A[1]) * i / S]); n.push([Math.cos(f1), Math.sin(f1)]); u.push(s / obvod); }
      s += dS;
    }
    return { P, n, u };
  }
  /** Vzdálenost obrysu od osy ve směru th. */
  function rho(N, a, rc, th) {
    if (!N) return a;
    const h = Math.PI / N;
    let d = th % (2 * h); if (d < 0) d += 2 * h; if (d > h) d -= 2 * h;   // úhel od nejbližšího středu strany
    d = Math.abs(d);
    if (a * Math.tan(d) <= (a - rc) * Math.tan(h)) return a / Math.cos(d);
    const dc = (a - rc) / Math.cos(h), g = h - d;
    return dc * Math.cos(g) + Math.sqrt(Math.max(0, rc * rc - dc * dc * Math.sin(g) * Math.sin(g)));
  }
  const plochaObrysu = (N, a, rc) => (N ? N * a * a * Math.tan(Math.PI / N) - rc * rc * (N * Math.tan(Math.PI / N) - Math.PI) : Math.PI * a * a);
  const simpson = (f, a, b, n = 60) => {
    if (!(b > a)) return 0;
    const h = (b - a) / n; let s = 0;
    for (let i = 0; i < n; i++) { const x = a + i * h; s += h / 6 * (f(x) + 4 * f(x + h / 2) + f(x + h)); }
    return s;
  };

  /** Profil pláště: apotéma a(z) mezi (R0, z0) a (R1, z1). Kužel = přímka; zaoblený = kruhový oblouk se svislou tečnou nahoře.
      Mimo rozsah z se drží krajní hodnota i sklon (stěna tak má všude stejnou vodorovnou tloušťku). uhel = největší vyklonění ven od svislice (°), ro = poloměr oblouku (0 = přímka). */
  function profil(tvar, R0, R1, z0, z1) {
    const H = z1 - z0, d = R1 - R0, zc = z => mezi(z, z0, z1);
    if (tvar !== 'zaobleny' || d < 1e-6 || d >= H - 1e-6) {
      const k = d / H;
      return { a: z => R0 + k * (zc(z) - z0), da: () => k, uhel: deg(Math.atan(Math.max(0, k))), ro: 0, k };
    }
    const ro = (d * d + H * H) / (2 * d), cx = R1 - ro, odm = z => Math.sqrt(ro * ro - (z1 - zc(z)) ** 2);
    const da = z => (z1 - zc(z)) / odm(z);
    return { a: z => cx + odm(z), da, uhel: deg(Math.atan(da(z0))), ro, k: da(z0) };
  }

  /* ---------------- odvozené rozměry ---------------- */
  /** Jádro odvození pro dané měřítko s (zadání objemem násobí průměry a výšku pláště). */
  function odvozeneS(p, s) {
    const P = p.plast, V = p.vlozka, o = { chyba: '', druh: p.druh, meritko: s };
    const jeSada = p.druh === 'sada', jeVlozka = p.druh === 'vlozka', jeKv = p.druh === 'kvetinac', jePod = p.druh === 'podmiska';
    o.maVlozku = jeSada || jeVlozka; o.maNadobu = jeSada || jeKv;
    o.N = P.tvar === 'ctverec' ? 4 : P.tvar === 'mnohouhelnik' ? P.stran : 0;
    o.kulaty = !o.N;
    o.t0 = o.N === 4 ? 45 : 0;
    const tgU = Math.tan(rad(p.tisk.uhel));
    o.tgU = tgU;
    o.vz = o.kulaty ? { K: 0, S: 1 } : { K: o.N <= 6 ? 12 : 8, S: 1 };
    const chyba = t => { o.chyba = o.chyba || t; };

    /* ---- plášť nádoby / obalu ---- */
    if (!jePod) {
      let pr;
      if (jeVlozka) {
        o.t = 1.6; o.zDno = 1.6; o.H = p.obal.vyska + o.zDno; o.Rd = p.obal.prumerD / 2; o.Rh = p.obal.prumerH / 2;
        pr = profil(P.tvar, o.Rd, o.Rh, o.zDno, o.H);
        o.aIn = pr.a; o.aOut = z => pr.a(z) + o.t * Math.sqrt(1 + pr.da(z) ** 2);
      } else {
        o.t = P.stena; o.zDno = P.dno; o.H = P.vyska * s; o.Rd = P.prumerD / 2 * s; o.Rh = P.prumerH / 2 * s;
        pr = profil(P.tvar, o.Rd, o.Rh, 0, o.H);
        o.aOut = pr.a; o.aIn = z => pr.a(z) - o.t * Math.sqrt(1 + pr.da(z) ** 2);
      }
      o.da = pr.da; o.ro = pr.ro; o.uhelPlaste = pr.uhel;
      o.vicNezOblouk = P.tvar === 'zaobleny' && !pr.ro && o.Rh - o.Rd > 1e-6;
      o.rcOut = z => Math.min(P.roh, 0.9 * o.aOut(z));
      /** Obrys odsazený o e dovnitř od dutiny (e < 0 ven; e = −stěna → vnějšek pláště). */
      o.S = (z, e) => {
        const a = o.aIn(z) - e;
        if (o.kulaty) return { a, rc: a };
        return { a, rc: Math.min(Math.max(0.5, o.rcOut(z) - (o.aOut(z) - o.aIn(z)) - e), 0.92 * a) };
      };
      o.rho = (z, e, th) => { const q = o.S(z, e); return rho(o.N, q.a, q.rc, th); };
      o.stenaV = z => o.aOut(z) - o.aIn(z);
      if (o.Rd > o.Rh + 1e-9) chyba('Plášť se směrem nahoru zužuje – vložka by nešla vsadit a vnitřek by převisal.');
      else if (!(o.aIn(o.zDno) > 8)) chyba('Dno je na tuto stěnu příliš malé.');
      // povrch (jen vlastní nádoba)
      o.povrch = !o.maNadobu || (P.povrch === 'fazety' && !o.kulaty) ? 'hladky' : P.povrch;
      o.dekor = 0; o.dekorDole = 0; o.uhelPovrchu = o.uhelPlaste;
      if (o.povrch === 'zebra' || o.povrch === 'zkrut') {
        o.dekor = o.dekorDole = P.vyskaZebra;
        if (o.povrch === 'zkrut') o.uhelPovrchu = deg(Math.atan(pr.k + P.vyskaZebra * Math.PI * P.zeber * Math.abs(P.zkrut) / 360 / o.H));
      } else if (o.povrch === 'fazety') {
        const n = P.fazet, c = Math.cos(Math.PI / n);
        o.fazVrstev = Math.max(2, Math.round(o.H / (2 * o.aOut(o.H / 2) * Math.tan(Math.PI / n))));
        const dz = o.H / o.fazVrstev;
        o.fazSag = pr.ro ? dz * dz / (8 * pr.ro) : 0;
        o.dekor = (o.Rh + o.fazSag) / c - o.Rh; o.dekorDole = (o.Rd + o.fazSag) / c - o.Rd;
        let m = 0;
        for (let j = 0; j < o.fazVrstev; j++) m = Math.max(m, ((o.aOut((j + 1) * dz) + o.fazSag) / c - o.aOut(j * dz) - o.fazSag) / dz);
        o.uhelPovrchu = deg(Math.atan(m));
      }
      o.sirka = 2 * (o.kulaty ? o.Rh : rho(o.N, o.Rh, o.rcOut(o.H), Math.PI / o.N)) + 2 * o.dekor;
    }

    /* ---- vložka a zásobník ---- */
    if (o.maVlozku && !o.chyba) {
      const tv = V.stena;
      o.tv = tv; o.eOut = V.vule; o.eIn = z => V.vule + tv * Math.sqrt(1 + o.da(z) ** 2);
      o.noha = V.vzlinani === 'noha';
      o.lem = !o.noha || V.ulozeni === 'lem';
      o.nozky = !o.lem;
      o.zK = o.zDno + p.zasobnik.vyska;
      o.zHl = o.zK - p.zasobnik.rezerva;
      o.rk = o.noha ? p.noha.prumer / 2 : 0;
      o.zN = o.noha ? o.zDno + (o.lem ? 2 : 0) : o.zK;
      o.zKi = o.noha ? o.zK + tv * Math.tan(rad(p.tisk.uhel) / 2) : o.zK + tv;
      if (o.lem) {
        // límec: kuželový spodek sedí v kuželovém sražení okraje nádoby (u cizího obalu na jeho vnitřní hraně), přímka r = aIn(H) + c + (z − H)·tg
        const tw = o.stenaV(o.H), aH = o.aIn(o.H), c = jeSada ? Math.max(0, tw - 0.8) : 0;
        const pata = e => { let lo = o.H - 200, hi = o.H; for (let i = 0; i < 48; i++) { const m = (lo + hi) / 2; if (o.aIn(m) - e > aH + c + (m - o.H) * tgU) lo = m; else hi = m; } return hi; };
        o.cLem = c; o.zSraz = pata(0);                      // začátek sražení okraje nádoby
        o.zLemA = pata(V.vule);                             // začátek límce na stěně vložky
        o.rLem = jeSada ? aH + tw : aH + V.lem;             // vnější apotéma límce
        o.zLemB = o.H + (o.rLem - aH - c) / tgU;
        o.zTop = o.zLemB + 1.6;
      } else o.zTop = o.H;
      o.zSub = o.zTop - p.vypocty.okraj;
      /** Spodní plocha dna vložky na poloměru r. */
      o.zKuzel = r => (o.noha ? o.zK + Math.max(0, r - o.rk) / tgU : o.zK);
      /** Výška, ve které kužel dna přechází ve stěnu vložky (ve směru th). */
      o.zLom = th => {
        if (!o.noha) return o.zK;
        let lo = o.zK, hi = o.zK + 2000;
        for (let i = 0; i < 48; i++) { const m = (lo + hi) / 2; if (o.rk + (m - o.zK) * tgU < o.rho(m, o.eOut, th)) lo = m; else hi = m; }
        return lo;
      };
      o.zLomMin = o.zLom(0); o.zLomMax = o.zLom(o.kulaty ? 0 : Math.PI / o.N);
      const aN = o.S(o.zK, o.eOut).a;
      if (o.zHl - o.zDno < 4) chyba('Zásobník je příliš nízký – pod hladinou přepadu nezbývá místo na vodu.');
      else if (o.noha && aN - o.rk < 8) chyba('Knotová noha je skoro stejně široká jako dno vložky.');
      else if (o.zLomMax > o.zSub - 5) chyba('Kuželové dno vložky se nevejde pod úroveň substrátu – zmenšete zásobník, zvětšete průměr nohy nebo výšku.');
      else if (!o.noha && o.zK + tv > o.zSub - 10) chyba('Zásobník zabírá skoro celou výšku – na substrát nezbývá místo.');
      // nožky (žebra pod kuželem, stojí na dně nádoby)
      if (o.nozky) {
        o.tNozky = Math.max(2, 1.2 * tv);
        o.hlNozky = Math.min(mezi(0.3 * (aN - o.rk), 5, 16), aN - o.rk - 3);
        o.uhlyNozek = [0, 1, 2, 3].map(i => rad(o.t0 + 45 + 90 * i));
      }
      // trubky ve vložce (svislé, se stojinou ke stěně)
      o.trubky = [];
      o.plneni = jeVlozka && p.plneni.typ === 'hrdlo' ? 'sachta' : p.plneni.typ;
      if (o.plneni === 'sachta' && !o.chyba) {
        const th = rad(o.t0), rIn = p.plneni.prumer / 2, zl = o.zLom(th), c = o.rho(zl, o.eIn(zl), th) - rIn - 0.3;
        o.trubky.push({ jmeno: 'sachta', th, rIn, c, tw: tv });
      }
      o.vodoznak = jeVlozka && p.vodoznak.typ === 'pruzor' ? 'zadny' : p.vodoznak.typ;
      if (o.vodoznak === 'plovak' && !o.chyba) {
        const W = p.vodoznak, th = rad(o.t0 + 90), rf = W.plovak / 2, ty = W.tycka, rIn = ty * Math.SQRT1_2 + 0.5, zl = o.zLom(th);
        const c = Math.min(o.rho(o.zDno, 0, th) - 1.5 - rf, o.rho(zl, o.eIn(zl), th) - rIn - 0.3);
        const rb = Math.min(rf, ty * 0.75 + 1.6), hk = (rf - rb) / tgU, hc = W.vyskaPlovaku, hF = hc + hk, hs = Math.min(8, hF - 1.5);
        const delka = o.zTop + 3 - (o.zDno + hF - hs);
        // hmotnost plováku: skořepina 2 perimetry + výplň (odhad); tyčka plná
        const mat = MATERIALY[p.tisk.material].hustota / 1000;
        const objem = Math.PI * rf * rf * hc + Math.PI * hk * (rf * rf + rf * rb + rb * rb) / 3;
        const skorepina = Math.min(objem, (Math.PI * rf * rf + 2 * Math.PI * rf * hc + Math.PI * (rf + rb) * Math.hypot(hk, rf - rb) + Math.PI * rb * rb) * 2 * p.tisk.extruze);
        const hmotnost = mat * (skorepina + (objem - skorepina) * W.vypln / 100), hmTycky = mat * ty * ty * delka;
        const ponor = (hmotnost + hmTycky) / 0.001 / (Math.PI * rf * rf);
        o.plovak = { th, rf, ty, rIn, c, rb, hk, hc, hF, hs, delka, hmotnost, hmTycky, ponor, zPlny: Math.max(o.zDno, o.zHl - ponor), zdvih: Math.max(0, o.zHl - ponor - o.zDno) };
        o.trubky.push({ jmeno: 'vodici', th, rIn, c, tw: tv });
      }
      // objemy – odhad integrací (přesné hodnoty měří postav ze sítě)
      const plocha = (z, e) => { const q = o.S(z, e); return plochaObrysu(o.N, q.a, q.rc); };
      const trubky = z0 => o.trubky.reduce((a, t) => a + Math.PI * (t.rIn + t.tw) ** 2 * Math.max(0, o.zSub - Math.max(z0, o.noha ? o.zKi + Math.max(0, t.c - o.rk) / tgU : z0)), 0);
      if (o.noha) {
        const rkI = o.rk - tv;
        o.objemSubstratu = simpson(z => Math.min(plocha(z, o.eIn(z)), Math.PI * (rkI + (z - o.zKi) * tgU) ** 2), o.zKi, o.zSub, 120)
          + Math.PI * rkI * rkI * Math.max(0, o.zKi - o.zN - tv) - trubky(o.zKi);
      } else o.objemSubstratu = simpson(z => plocha(z, o.eIn(z)), o.zK + tv, o.zSub) - trubky(o.zK + tv);
      let voda = simpson(z => plocha(z, 0), o.zDno, o.zHl);
      if (o.noha) voda -= Math.PI * o.rk * o.rk * Math.max(0, o.zHl - o.zN);
      if (o.nozky) voda -= o.uhlyNozek.reduce((a, th) => a + o.tNozky * simpson(z => o.rho(z, o.eOut, th) - (o.rho(o.zN, o.eOut, th) - o.hlNozky), o.zDno, o.zHl, 8), 0);
      o.objemVody = Math.max(0, voda);
      // přepad, průzor, hrdlo (jen vlastní nádoba)
      if (jeSada && p.prepad.zap) { const r = p.prepad.prumer / 2; o.prepad = { th: rad(o.t0 + 180), r, zc: o.zHl + r / Math.cos(Math.PI / 32) }; }
      if (jeSada && o.vodoznak === 'pruzor' && p.vodoznak.tloustka < o.t - 0.3) o.pruzor = { th: rad(o.t0 + 270), w: p.vodoznak.sirka, tl: p.vodoznak.tloustka, z0: o.zDno + 1, z1: o.zHl + 4 };
      if (jeSada && o.plneni === 'hrdlo' && !o.chyba) {
        const th = rad(o.t0), gam = rad(Math.min(45, p.tisk.uhel)), rb = p.plneni.prumer / 2, pul = rb / Math.sin(gam);
        const zS = o.zLom(th) - pul - 1.5, zM = zS + pul + 10;
        o.hrdlo = { th, gam, rb, tw: o.t, zS, zM, r0: o.rho(zS, 0, th), delka: (zM - zS) / Math.cos(gam) + (rb + o.t) * Math.tan(gam) + 2 };
        o.hrdlo.vylozeni = o.hrdlo.r0 + (zM - zS) * Math.tan(gam) + (rb + o.t) / Math.cos(gam);
        if (zS - pul < o.zDno + 0.5) chyba('Plnicí hrdlo se nevejde pod dno vložky – zvyšte zásobník nebo zmenšete průměr hrdla.');
      }
    }
    if (jeKv && !o.chyba) {
      o.zSub = o.H - p.vypocty.okraj;
      o.objemSubstratu = simpson(z => { const q = o.S(z, 0); return plochaObrysu(o.N, q.a, q.rc); }, o.zDno, o.zSub);
      o.objemVody = 0;
      const D = p.drenaz;
      o.rDer = 0.55 * o.aIn(o.zDno);
      o.sKanalku = D.kanalky ? Math.min(Math.max(D.prumer, 6), 2 * (o.zDno - 1.2) * tgU) : 0;   // šířka V drážky: strop pod povoleným převisem, nade dnem zbude ≥ 1,2 mm
      if (o.sKanalku < 2) o.sKanalku = 0;
    }

    /* ---- podmiska ---- */
    if (jePod || (jeKv && p.podmiska.zap && !o.chyba)) {
      const D = p.podmiska, a0 = jePod ? D.prumer / 2 : o.aOut(0) + o.dekorDole;
      const rc0 = o.kulaty ? a0 : jePod ? Math.min(P.roh, 0.9 * a0) : o.rcOut(0) + o.dekorDole;
      const k = Math.tan(rad(mezi((jePod ? 0 : o.uhelPlaste) + 5, 15, 45))), t = P.stena, dno = P.dno, f = Math.sqrt(1 + k * k);
      o.pod = { a0: a0 + D.vule, rc0: rc0 + D.vule, k, t, dno, h: D.vyska, zebra: D.zebra ? 2 : 0 };
      /** Obrys podmisky ve výšce z (od jejího spodku); ven = vnější plocha. */
      o.pod.S = (z, ven) => { const e = k * Math.max(0, z - dno) + (ven ? t * f : 0); return { a: o.pod.a0 + e, rc: o.pod.rc0 + e }; };
      const aT = o.pod.S(dno + D.vyska, true);
      o.pod.sirka = 2 * (o.kulaty ? aT.a : rho(o.N, aT.a, aT.rc, Math.PI / o.N));
      if (jePod) o.sirka = o.pod.sirka;
    }
    return o;
  }
  /** Odvozené rozměry (o.chyba = celá věta, proč model nejde sestavit); při zadání objemem substrátu nejdřív najde měřítko pláště (půlením). */
  function odvozene(p) {
    if (p.plast.zadani !== 'objem' || !['sada', 'kvetinac'].includes(p.druh)) return odvozeneS(p, 1);
    const cil = p.plast.objem * 1e6, f = s => { const o = odvozeneS(p, s); return o.chyba ? -1 : o.objemSubstratu; };
    let lo = 0.15, hi = 6;
    if (!(f(hi) >= cil)) { const o = odvozeneS(p, 1); o.chyba = o.chyba || `Objem ${fmt(p.plast.objem, 2)} l se do tohoto tvaru nevejde ani při šestinásobném zvětšení.`; return o; }
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (f(m) >= cil) hi = m; else lo = m; }
    const o = odvozeneS(p, hi);
    if (o.chyba || Math.abs(o.objemSubstratu - cil) > 0.02 * cil) { o.chyba = o.chyba || `Objem ${fmt(p.plast.objem, 2)} l je na zvolený zásobník, knotovou nohu a stěny příliš malý – zvětšete objem, nebo zmenšete zásobník a nohu.`; }
    return o;
  }

  /* ---------------- kontroly ---------------- */
  function kontroly(p) {
    const H = [], o = odvozene(p), P = p.plast, V = p.vlozka, tk = p.tisk;
    const add = (uroven, text, pole, oprava) => H.push(Object.assign({ uroven, text, pole }, oprava ? { oprava } : {}));
    const zaokr = x => Math.round(x * 100) / 100;
    const jeSada = p.druh === 'sada', jeVlozka = p.druh === 'vlozka', jeKv = p.druh === 'kvetinac', jePod = p.druh === 'podmiska';
    if (o.chyba) {
      const pole = jeVlozka ? ['zasobnik.vyska', 'obal.vyska', 'noha.prumer'] : P.zadani === 'objem' ? ['plast.objem', 'zasobnik.vyska'] : ['zasobnik.vyska', 'plast.vyska', 'plast.prumerD', 'noha.prumer'];
      add('chyba', o.chyba, jePod ? ['podmiska.prumer'] : o.Rd > o.Rh ? [jeVlozka ? 'obal.prumerD' : 'plast.prumerD'] : pole,
        o.Rd > o.Rh ? { text: 'Dno stejné jako okraj', pole: jeVlozka ? 'obal.prumerD' : 'plast.prumerD', hodnota: jeVlozka ? p.obal.prumerH : P.prumerH } : null);
      return H;
    }
    // vodotěsnost a tisk stěn
    const tri = 3 * tk.extruze, dva = 2 * tk.extruze;
    if (jeSada) {
      if (P.stena < tri - 1e-9) add('varovani', `Stěna nádoby ${fmt(P.stena, 2)} mm je tenčí než 3 perimetry (${fmt(tri, 2)} mm) – zásobník vody nemusí být vodotěsný.`, 'plast.stena', { text: `Stěna ${fmt(tri, 2)} mm`, pole: 'plast.stena', hodnota: zaokr(tri) });
      if (P.dno < 5 * tk.vrstva - 1e-9) add('varovani', `Dno nádoby ${fmt(P.dno, 2)} mm je méně než 5 vrstev (${fmt(5 * tk.vrstva, 2)} mm) – voda může prosakovat.`, 'plast.dno', { text: `Dno ${fmt(5 * tk.vrstva, 2)} mm`, pole: 'plast.dno', hodnota: zaokr(5 * tk.vrstva) });
      if (tk.perimetru < 3) add('varovani', `Na vodotěsnou nádobu nastavte ve sliceru aspoň 3 perimetry (teď ${tk.perimetru}) a průtok bez mezer.`, 'tisk.perimetru', { text: '3 perimetry', pole: 'tisk.perimetru', hodnota: 3 });
      add('info', `Vodotěsnost: stěna ${fmt(P.stena, 2)} mm = ${fmt(P.stena / tk.extruze, 1)} perimetru po ${fmt(tk.extruze, 2)} mm; tiskněte nádobu se ${Math.max(3, tk.perimetru)} perimetry, bez švu nad sebou a zkoušku těsnosti udělejte vodou přes noc.`, 'tisk.perimetru');
    } else if (!jeVlozka && P.stena < dva - 1e-9) add('varovani', `Stěna ${fmt(P.stena, 2)} mm je tenčí než 2 perimetry (${fmt(dva, 2)} mm).`, 'plast.stena', { text: `Stěna ${fmt(dva, 2)} mm`, pole: 'plast.stena', hodnota: zaokr(dva) });
    if (o.maVlozku && V.stena < dva - 1e-9) add('varovani', `Stěna vložky ${fmt(V.stena, 2)} mm je tenčí než 2 perimetry (${fmt(dva, 2)} mm).`, 'vlozka.stena', { text: `Stěna ${fmt(dva, 2)} mm`, pole: 'vlozka.stena', hodnota: zaokr(dva) });
    // tvar a povrch
    if (!jePod) {
      const poleR = jeVlozka ? 'obal.prumerH' : 'plast.prumerH';
      if (o.uhelPovrchu > tk.uhel + 1e-6) {
        if (o.povrch === 'zkrut' && o.uhelPlaste <= tk.uhel) add('varovani', `Zkroucená žebra se vyklánějí ${fmt(o.uhelPovrchu, 0)}° od svislice – víc než povolený převis ${fmt(tk.uhel, 0)}°. Zmenšete zkrut, výšku nebo počet žeber.`, ['plast.zkrut', 'plast.vyskaZebra', 'plast.zeber'], { text: 'Poloviční zkrut', pole: 'plast.zkrut', hodnota: Math.round(P.zkrut / 2) });
        else if (o.povrch === 'fazety' && o.uhelPlaste <= tk.uhel) add('varovani', `Fazety se vyklánějí ${fmt(o.uhelPovrchu, 0)}° od svislice – víc než povolený převis ${fmt(tk.uhel, 0)}°. Přidejte fazety po obvodu.`, 'plast.fazet', { text: `${Math.min(24, P.fazet + 4)} fazet`, pole: 'plast.fazet', hodnota: Math.min(24, P.fazet + 4) });
        else add('varovani', `Plášť se u dna rozevírá ${fmt(o.uhelPlaste, 0)}° od svislice – víc než povolený převis ${fmt(tk.uhel, 0)}°. Zmenšete rozdíl průměrů nebo zvětšete výšku.`, [poleR, jeVlozka ? 'obal.vyska' : 'plast.vyska']);
      }
      if (o.vicNezOblouk) add('info', 'Zaoblený plášť: rozdíl poloměrů je větší než výška – oblouk se svislou tečnou nevyjde, použit rovný kužel.', poleR);
      if (o.maNadobu && P.povrch === 'fazety' && !o.kulaty) add('info', 'Fazety jsou jen pro kulatý plášť – použit hladký povrch.', 'plast.povrch');
      if (o.maNadobu && P.zadani === 'objem') add('info', `Zadání objemem: plášť zvětšen ${fmt(o.meritko, 3)}× na Ø ${fmt(2 * o.Rh, 1)} / ${fmt(2 * o.Rd, 1)} × ${fmt(o.H, 1)} mm, substrátu ≈ ${fmt(o.objemSubstratu / 1e6, 2)} l.`, 'plast.objem');
    }
    const sirka = Math.max(o.sirka || 0, o.pod ? o.pod.sirka : 0, o.hrdlo ? o.Rh + o.hrdlo.vylozeni : 0);
    if (sirka > tk.podlozka) add('varovani', `Největší díl je široký ${fmt(sirka, 0)} mm – víc než podložka ${fmt(tk.podlozka, 0)} mm.`, [jePod ? 'podmiska.prumer' : jeVlozka ? 'obal.prumerH' : 'plast.prumerH', 'tisk.podlozka']);
    // vložka, zásobník, vzlínání
    if (o.maVlozku) {
      if (!o.noha && V.ulozeni === 'nozky') add('info', 'Vložka s otvory na knot má rovné dno a nemá nohu, na které by stála – zavěsí se za límec na okraj nádoby.', 'vlozka.ulozeni');
      if (o.noha) {
        const hz = o.zK - 1.5 - (p.noha.sterbina / 2) / o.tgU - (o.zN + o.tv + 1.5);
        if (hz < 2) add('varovani', 'Knotová noha je příliš nízká na štěrbiny – voda se do substrátu nedostane. Zvyšte zásobník.', 'zasobnik.vyska');
        if (p.noha.prumer < 24) add('info', 'Úzká knotová noha (pod 24 mm) se hůř plní substrátem – utlačte ho v ní, jinak vzlínání vynechá.', 'noha.prumer');
        if (o.lem) add('info', 'Vložka zavěšená za límec stojí při tisku jen na knotové noze – ve sliceru přidejte límec (brim).', 'vlozka.ulozeni');
      } else {
        const rW = 0.45 * o.S(o.zK, o.eIn(o.zK)).a, tr = o.trubky.find(t => t.jmeno === 'sachta');
        if (tr && rW + p.knot.prumer / 2 + 2 > tr.c - tr.rIn - tr.tw) add('varovani', 'Otvory na knot zasahují do plnicí šachty – zmenšete průměr šachty nebo knotu.', ['plneni.prumer', 'knot.prumer']);
        add('info', `Knot: ${p.knot.pocet}× šňůra Ø ${fmt(p.knot.prumer - 1, 0)}–${fmt(p.knot.prumer, 0)} mm z nasákavého materiálu (bavlna, akryl), ${fmt(o.zK - o.zDno + 60, 0)} mm dlouhá – konec až na dno zásobníku, druhý konec rozprostřít v substrátu.`, 'knot.prumer');
      }
      for (const t of o.trubky) {
        if (!o.noha || t.c - t.rIn - t.tw >= o.rk + 2) continue;
        if (t.jmeno === 'sachta') add('chyba', 'Plnicí šachta se nevejde mezi stěnu vložky a knotovou nohu.', ['plneni.prumer', 'noha.prumer']);
        else add('varovani', 'Vodicí trubička plováku se nevejde mezi stěnu vložky a knotovou nohu.', ['vodoznak.plovak', 'noha.prumer']);
      }
      if (jeVlozka) {
        if (p.plneni.typ === 'hrdlo') add('info', 'Do cizího obalu nejde udělat boční hrdlo – použita plnicí šachta ve vložce.', 'plneni.typ');
        if (p.vodoznak.typ === 'pruzor') add('info', 'Průzor je ve stěně nádoby – u vložky do cizího obalu není; použijte plovák.', 'vodoznak.typ');
        add('info', `Obal nemá přepad – nalévejte nejvýš ${fmt(o.objemVody / 1000, 0)} ml (hladina ${fmt(o.zHl - o.zDno, 0)} mm nade dnem obalu), aby kořeny nestály ve vodě.`, 'zasobnik.rezerva');
        if (o.lem) add('info', `Límec vložky přesahuje okraj obalu o ${fmt(V.lem, 0)} mm a sedí kuželem na jeho vnitřní hraně.`, 'vlozka.lem');
      } else if (!o.prepad) add('varovani', 'Bez přepadu hrozí přelití – voda vystoupá do substrátu a kořeny uhnijí. Zapněte přepad, nebo hlídejte hladinu vodoznakem.', 'prepad.zap', { text: 'Zapnout přepad', pole: 'prepad.zap', hodnota: true });
      if (jeSada && p.vodoznak.typ === 'pruzor' && !o.pruzor) add('varovani', `Průzor: tenká stěna ${fmt(p.vodoznak.tloustka, 2)} mm musí být aspoň o 0,3 mm tenčí než stěna nádoby (${fmt(o.t, 2)} mm).`, ['vodoznak.tloustka', 'plast.stena']);
      if (o.pruzor) add('info', `Průzor: stěna ${fmt(o.pruzor.tl, 2)} mm prosvítá jen u průhledného nebo světlého filamentu; je to nejslabší místo nádoby – tiskněte pomalu a zkontrolujte těsnost.`, 'vodoznak.tloustka');
      if (o.hrdlo && o.hrdlo.zM > o.H - 2) add('varovani', 'Plnicí hrdlo sahá až k okraji nádoby – snižte zásobník nebo zmenšete průměr hrdla.', ['plneni.prumer', 'zasobnik.vyska']);
      const F = o.plovak;
      if (F) {
        if (F.rf < F.ty * Math.SQRT1_2 + 1.5) add('varovani', 'Plovák je na tuto tyčku příliš úzký – kapsa pro tyčku by prořízla jeho stěnu.', ['vodoznak.plovak', 'vodoznak.tycka']);
        if (F.ponor > F.hc) add('varovani', `Plovák je moc těžký (ponor ${fmt(F.ponor, 1)} mm je víc než jeho výška ${fmt(F.hc, 1)} mm) – potopí se. Snižte výplň, zvětšete průměr nebo výšku.`, ['vodoznak.vypln', 'vodoznak.plovak', 'vodoznak.vyskaPlovaku']);
        if (o.noha && F.c - F.rf < o.rk + 1.5) add('varovani', 'Plovák se nevejde mezi knotovou nohu a stěnu nádoby – zmenšete jeho průměr.', ['vodoznak.plovak', 'noha.prumer']);
        if (o.nozky && F.c * Math.SQRT1_2 - o.tNozky / 2 < F.rf + 1) add('varovani', 'Plovák se nevejde mezi nožky vložky – zmenšete jeho průměr.', 'vodoznak.plovak');
        const narazi = Math.min(o.zKuzel(F.c - F.rf) - F.hc, o.zKuzel(F.c - F.rb) - F.hF) - 0.5;
        if (F.zPlny > narazi) add('varovani', `Plovák narazí do dna vložky ${fmt(F.zPlny - narazi, 1)} mm pod plnou hladinou – zvětšete vzduchovou mezeru nad hladinou nebo snižte plovák.`, ['zasobnik.rezerva', 'vodoznak.vyskaPlovaku']);
        if (F.delka > tk.podlozka) add('varovani', `Tyčka plováku je dlouhá ${fmt(F.delka, 0)} mm – nevejde se na podložku ${fmt(tk.podlozka, 0)} mm.`, 'tisk.podlozka');
        add('info', `Plovák: ponor ≈ ${fmt(F.ponor, 1)} mm při výplni ${fmt(p.vodoznak.vypln, 0)} % a 2 perimetrech (odhad – tak ho i tiskněte). Tyčka při prázdné zásobě vyčnívá 3 mm, při plné ${fmt(3 + F.zdvih, 0)} mm.`, 'vodoznak.vypln');
      }
      if (tk.material === 'PLA') add('info', 'PLA ve stálém styku s vodou a na slunci časem křehne – na zásobník je vhodnější PETG nebo ASA.', 'tisk.material');
    }
    if (jeKv) {
      if (p.drenaz.pocet === 0) add('info', 'Bez drenážních otvorů (kromě středového) voda odtéká pomalu.', 'drenaz.pocet');
      if (p.drenaz.kanalky && !o.sKanalku) add('info', `Drážky pod dnem potřebují dno aspoň ${fmt(1.2 + 1 / o.tgU, 1)} mm – při této tloušťce se vynechají.`, 'plast.dno', { text: 'Dno 3,2 mm', pole: 'plast.dno', hodnota: 3.2 });
      if (o.rDer + p.drenaz.prumer / 2 > o.aIn(o.zDno) - 2) add('varovani', 'Drenážní otvory jsou na toto dno příliš velké.', 'drenaz.prumer');
    }
    if (o.pod && p.podmiska.vyska < 8) add('info', 'Nízká podmiska pojme málo vody – při zálivce snadno přeteče.', 'podmiska.vyska');
    return H;
  }

  /* ---------------- stavba ---------------- */
  /** Manifold → síť pro náhled a export. */
  function sit(k, m0, jmeno, nazev, barva, volby = {}) {
    const m = k(m0.simplify(1e-3));
    const st = m.status();
    if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
    if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
    const kusy = m.decompose().map(k);
    return Object.assign({ jmeno, nazev, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), teles: kusy.filter(x => x.volume() > 1e-3).length, barva, otocit: false, ks: 1 }, volby);
  }
  function posunPoz(P, x, y, z) {
    const out = new Float32Array(P.length);
    for (let i = 0; i < P.length; i += 3) { out[i] = P[i] + x; out[i + 1] = P[i + 1] + y; out[i + 2] = P[i + 2] + z; }
    return out;
  }
  /** Těleso z vrstev stejně dlouhých obrysů [{z, P}] – boky ze čtyřúhelníků, dna vějířem ze středu (obrysy jsou hvězdicové k ose).
      stridave: úhlopříčky střídavě (rovinné trojúhelníkové fazety). */
  function vrstvene(w, vrstvy, stridave) {
    const n = vrstvy[0].P.length, m = vrstvy.length, V = new Float32Array((n * m + 2) * 3), I = [];
    vrstvy.forEach((v, i) => v.P.forEach((q, j) => { const a = 3 * (i * n + j); V[a] = q[0]; V[a + 1] = q[1]; V[a + 2] = v.z; }));
    const c0 = n * m, c1 = c0 + 1;
    V[3 * c0 + 2] = vrstvy[0].z; V[3 * c1 + 2] = vrstvy[m - 1].z;
    for (let i = 0; i < m - 1; i++) for (let j = 0; j < n; j++) {
      const a = i * n + j, b = i * n + (j + 1) % n, c = (i + 1) * n + j, d = (i + 1) * n + (j + 1) % n;
      if (stridave && (i + j) % 2) I.push(a, b, c, b, d, c); else I.push(a, b, d, a, d, c);
    }
    const tt = (m - 1) * n;
    for (let j = 0; j < n; j++) { I.push(c0, (j + 1) % n, j); I.push(c1, tt + j, tt + (j + 1) % n); }
    return new w.Manifold(new w.Mesh({ numProp: 3, vertProperties: V, triVerts: new Uint32Array(I) }));
  }

  function postav(w, p) {
    const t0 = Date.now(), o = odvozene(p);
    if (o.chyba) throw new Error(o.chyba);
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const P = p.plast, tgU = o.tgU;
    const sjed = a => (a.length === 1 ? a[0] : k(M.union(a)));
    const rev = (body, n) => k(k(new CS([body], 'NonZero')).revolve(n));
    const valec = (r, z0, z1, x = 0, y = 0) => k(k(M.cylinder(z1 - z0, r, r, segmenty(r))).translate([x, y, z0]));
    const kvadr = (x0, x1, y0, y1, z0, z1) => k(k(M.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    const otoc = (m, th) => k(m.rotate([0, 0, deg(th)]));
    const VSE = 1500, deska = (z0, z1) => kvadr(-VSE, VSE, -VSE, VSE, z0, z1);
    /** Obrys [x, výška] vytlačený vodorovně od osy (r0…r1) ve směru th, výška 0 obrysu = z. */
    const radialne = (body, r0, r1, th, z) => k(k(k(k(k(new CS([body], 'NonZero')).extrude(r1 - r0)).translate([0, 0, r0])).rotate([90, 0, deg(th) + 90])).translate([0, 0, z]));
    /** Okénko se sedlovou stříškou pod povoleným převisem: šířka s, rovná část výšky h. */
    const okenko = (s, h) => [[-s / 2, 0], [s / 2, 0], [s / 2, h], [0, h + s / 2 / tgU], [-s / 2, h]];
    const Mk = o.kulaty ? segmenty((o.Rh || o.pod.a0) + 5) : 0;
    const body = q => obrys(o.N, q.a, q.rc, o.kulaty ? Mk : o.vz.K, o.vz.S).P;
    const tel = (vrstvy, stridave) => {
      const m = k(vrstvene(w, vrstvy, stridave));
      if (m.status() !== 'NoError') throw new Error('plášť: manifold hlásí ' + m.status());
      return m;
    };
    /** Výšky vrstev mezi z0 a z1: zlomy profilu (dno, okraj) a u oblouku jemné dělení. */
    const vysky = (z0, z1) => {
      const zs = [z0];
      const a = Math.max(z0, o.maNadobu ? 0 : o.zDno), b = Math.min(z1, o.H);
      if (a > z0 + 1e-6) zs.push(a);
      if (o.ro && b > a) { const n = mezi(Math.ceil((b - a) / 4), 6, 48); for (let i = 1; i < n; i++) zs.push(a + (b - a) * i / n); }
      if (b < z1 - 1e-6 && b > zs[zs.length - 1] + 1e-6) zs.push(b);
      zs.push(z1);
      return zs;
    };
    /** Těleso s obrysem odsazeným o e(z) od dutiny, od z0 do z1. */
    const teleso = (z0, z1, e) => tel(vysky(z0, z1).map(z => ({ z, P: body(o.S(z, typeof e === 'function' ? e(z) : e)) })));
    /** Kužel pod povoleným převisem: obrys q ve výšce z0 se do z1 rozšíří přesným odsazením (apotéma i rohy o stejný kus), případně pokračuje svisle do z2. */
    const kuzel = (q, z0, z1, z2) => {
      const d = (z1 - z0) * tgU, P1 = body({ a: q.a + d, rc: q.rc + d });
      return tel([{ z: z0, P: body(q) }, { z: z1, P: P1 }].concat(z2 > z1 ? [{ z: z2, P: P1 }] : []));
    };
    const BARVY = { nadoba: '#3E86D6', vlozka: '#3FA36B', plovak: '#E08A2E', tycka: '#C2544F', podmiska: '#8C6BC8', obal: '#9AA3AD' };
    const dily = [], sestava = [], objemy = { substrat: 0, voda: 0 };
    const pridej = (d, x = 0, y = 0, z = 0) => { dily.push(d); sestava.push(x || y || z ? Object.assign({}, d, { poz: posunPoz(d.poz, x, y, z) }) : d); };

    /** Vnější těleso pláště s povrchem (hladký, žebra, zkroucená žebra, fazety). */
    function plast() {
      const H = o.H, ven = z => -o.stenaV(z);
      if (o.povrch === 'hladky') return teleso(0, H, ven);
      if (o.povrch === 'fazety') {
        const n = P.fazet, c = Math.cos(Math.PI / n), vr = [];
        for (let j = 0; j <= o.fazVrstev; j++) {
          const z = H * j / o.fazVrstev, Rm = o.aOut(z) + o.fazSag, B = [];
          for (let i = 0; i < 2 * n; i++) { const f = Math.PI * i / n, r = (i + j) % 2 ? Rm : Rm / c; B.push([r * Math.cos(f), r * Math.sin(f)]); }
          vr.push({ z, P: B });
        }
        return tel(vr, true);
      }
      const nR = P.zeber, hR = P.vyskaZebra, zk = o.povrch === 'zkrut' ? P.zkrut / 360 : 0;
      const nz = mezi(Math.ceil(H / 2.5), 8, 96), zs = zk ? Array.from({ length: nz + 1 }, (_, i) => H * i / nz) : vysky(0, H);
      // hustota bodů: aspoň 8 na žebro (podle obrysu v polovině výšky)
      const q0 = o.S(H / 2, ven(H / 2));
      let K, S = 1;
      if (o.kulaty) K = nR * Math.max(8, Math.round(Mk / nR));
      else {
        const h = Math.PI / o.N, lA = q0.rc * 2 * h, lS = 2 * (q0.a - q0.rc) * Math.tan(h), krok = o.N * (lA + lS) / (8 * nR);
        K = Math.max(o.vz.K, Math.ceil(lA / krok)); S = Math.max(1, Math.ceil(lS / krok));
      }
      return tel(zs.map(z => {
        const q = o.S(z, ven(z)), ob = obrys(o.N, q.a, q.rc, K, S);
        return { z, P: ob.P.map((b, i) => { const d = hR * 0.5 * (1 - Math.cos(2 * Math.PI * nR * (ob.u[i] - zk * z / H))); return [b[0] + ob.n[i][0] * d, b[1] + ob.n[i][1] * d]; }) };
      }));
    }

    try {
      let dutina = null;   // dutina nádoby / obalu (i pro měření zásoby vody)
      if (!o.maNadobu && p.druh !== 'podmiska') dutina = teleso(o.zDno, o.H + 1, 0);

      /* ---- nádoba sady / květináč ---- */
      if (o.maNadobu) {
        dutina = teleso(o.zDno, o.H + 1, 0);
        let A = plast();
        const odeb = [dutina];
        if (o.hrdlo) {
          const h = o.hrdlo, n = segmenty(h.rb + h.tw);
          const osa = (r, s0, s1) => k(k(k(k(M.cylinder(s1 - s0, r, r, n)).translate([0, 0, s0])).rotate([0, deg(h.gam), deg(h.th)])).translate([h.r0 * Math.cos(h.th), h.r0 * Math.sin(h.th), h.zS]));
          const s0 = -((h.rb + h.tw) / Math.tan(h.gam) + 10);   // čelo trubky celé uvnitř dutiny (odečte se), jinak by jeho spodní cíp převisal z pláště
          A = k(M.union([A, k(osa(h.rb + h.tw, s0, h.delka).intersect(deska(-VSE, h.zM)))]));
          odeb.push(osa(h.rb, s0 - 4, h.delka + 6));
        }
        if (o.lem && o.cLem > 0) odeb.push(kuzel(o.S(o.zSraz, 0), o.zSraz, o.H + 0.02));
        const rVen = 2 * o.Rh + o.dekor + 20;
        if (o.prepad) odeb.push(radialne(G.obrysDiry(o.prepad.r, 32, p.diry !== 'kruh'), 2, rVen, o.prepad.th, o.prepad.zc));
        if (o.pruzor) {
          const u = o.pruzor, hz = u.z1 - u.z0;
          odeb.push(k(radialne(okenko(u.w, hz), 2, rVen, u.th, u.z0).subtract(teleso(u.z0 - 1, u.z1 + u.w / tgU + 2, -u.tl))));
        }
        if (p.druh === 'kvetinac') {
          const D = p.drenaz;
          odeb.push(valec(D.prumer / 2, -1, o.zDno + 1));
          for (let i = 0; i < D.pocet; i++) { const f = 2 * Math.PI * i / D.pocet + rad(o.t0); odeb.push(valec(D.prumer / 2, -1, o.zDno + 1, o.rDer * Math.cos(f), o.rDer * Math.sin(f))); }
          if (o.sKanalku) {
            const s = o.sKanalku, tri = [[-s / 2, -0.02], [s / 2, -0.02], [0, s / 2 / tgU]];
            for (let i = 0; i < Math.max(D.pocet, 3); i++) odeb.push(radialne(tri, 0, rVen, 2 * Math.PI * i / Math.max(D.pocet, 3) + rad(o.t0), 0));
          }
          objemy.substrat = k(dutina.intersect(deska(-VSE, o.zSub))).volume();
        }
        pridej(sit(k, k(A.subtract(sjed(odeb))), p.druh === 'sada' ? 'nadoba' : 'kvetinac', p.druh === 'sada' ? 'Nádoba (zásobník vody)' : 'Květináč', BARVY.nadoba));
      }

      /* ---- vložka ---- */
      if (o.maVlozku) {
        const tv = o.tv, zTop = o.zTop, Rb = 2 * o.Rh + 60;
        const plnyObal = teleso(o.zN, zTop, o.eOut);
        let obalka = plnyObal, dut = teleso(o.noha ? o.zN + tv : o.zK + tv, zTop + 1, o.eIn);
        if (o.noha) {
          const nR = o.kulaty ? Mk : segmenty(o.Rh), rkI = o.rk - tv, vrch = Math.max(zTop, o.zK + Rb / tgU) + 5;
          obalka = k(plnyObal.intersect(rev([[0, o.zN], [o.rk, o.zN], [o.rk, o.zK], [Rb, o.zK + (Rb - o.rk) / tgU], [Rb, vrch], [0, vrch]], nR)));
          dut = k(dut.intersect(rev([[0, o.zN + tv], [rkI, o.zN + tv], [rkI, o.zKi], [Rb, o.zKi + (Rb - rkI) / tgU], [Rb, vrch + 5], [0, vrch + 5]], nR)));
        }
        const plne = [obalka];
        let nozky = null;
        if (o.nozky) {
          nozky = k(sjed(o.uhlyNozek.map(th => otoc(kvadr(o.rho(o.zN, o.eOut, th) - o.hlNozky, Rb, -o.tNozky / 2, o.tNozky / 2, o.zN, o.zLomMax + 1), th))).intersect(plnyObal));
          plne.push(nozky);
        }
        if (o.lem) plne.push(kuzel(o.S(o.zLemA, o.eOut), o.zLemA, o.zLemB, zTop));
        let A = k(sjed(plne).subtract(dut));
        const odeb = [];
        if (o.trubky.length) {
          const tr = k(sjed(o.trubky.map(t => otoc(k(M.union([valec(t.rIn + t.tw, o.zN, zTop, t.c, 0), kvadr(t.c, Rb, -t.tw, t.tw, o.zN, zTop)])), t.th))).intersect(obalka));
          A = k(M.union([A, tr]));
          dut = k(dut.subtract(tr));
          for (const t of o.trubky) odeb.push(valec(t.rIn, o.zKuzel(t.c - t.rIn - t.tw) - 3, zTop + 1, t.c * Math.cos(t.th), t.c * Math.sin(t.th)));
        }
        if (o.noha) {
          const s = p.noha.sterbina, z0 = o.zN + tv + 1.5, hz = o.zK - 1.5 - s / 2 / tgU - z0, n = mezi(Math.floor(2 * Math.PI * o.rk / (s + 5)), 3, 12);
          o.sterbin = hz >= 2 ? n : 0;
          for (let i = 0; i < o.sterbin; i++) odeb.push(radialne(okenko(s, hz), o.rk - tv - 1, o.rk + 1, 2 * Math.PI * (i + 0.25) / n + rad(o.t0), z0));   // čtvrtkrok: rovina řezu (směr plnění–přepad) štěrbinu nikdy neprotne středem
        } else {
          const rW = 0.45 * o.S(o.zK, o.eIn(o.zK)).a;
          for (let i = 0; i < p.knot.pocet; i++) { const f = rad(o.t0 + 135) + 2 * Math.PI * i / p.knot.pocet; odeb.push(valec(p.knot.prumer / 2, o.zK - 1, o.zK + tv + 1, rW * Math.cos(f), rW * Math.sin(f))); }
        }
        if (odeb.length) A = k(A.subtract(sjed(odeb)));
        pridej(sit(k, A, 'vlozka', 'Vložka na substrát', BARVY.vlozka));
        objemy.substrat = k(dut.intersect(deska(-VSE, o.zSub))).volume();
        objemy.voda = k(k(dutina.intersect(deska(o.zDno, o.zHl))).subtract(nozky ? k(M.union([obalka, nozky])) : obalka)).volume();

        if (o.plovak) {
          const F = o.plovak, x = F.c * Math.cos(F.th), y = F.c * Math.sin(F.th), a = F.ty + 2 * p.vodoznak.vule;
          const telo = k(rev([[0, 0], [F.rf, 0], [F.rf, F.hc], ...(F.hk > 1e-6 ? [[F.rb, F.hF]] : []), [0, F.hF]], segmenty(F.rf)).subtract(kvadr(-a / 2, a / 2, -a / 2, a / 2, F.hF - F.hs, F.hF + 1)));
          pridej(sit(k, telo, 'plovak', 'Plovák', BARVY.plovak), x, y, F.zPlny);
          const tyc = kvadr(-F.ty / 2, F.ty / 2, -F.ty / 2, F.ty / 2, 0, F.delka);
          dily.push(sit(k, k(tyc.rotate([0, 90, 0])), 'tycka', 'Tyčka plováku', BARVY.tycka));
          const st = sit(k, tyc, 'tycka', 'Tyčka plováku', BARVY.tycka);
          sestava.push(Object.assign(st, { poz: posunPoz(st.poz, x, y, F.zPlny + F.hF - F.hs) }));
        }
        if (p.druh === 'vlozka') {
          const ob = sit(k, k(teleso(0, o.H, z => -o.stenaV(z)).subtract(dutina)), 'obal', 'Váš obal (jen pro představu)', BARVY.obal);
          sestava.unshift(Object.assign(ob, { kontext: true }));
        }
      }

      /* ---- podmiska ---- */
      if (o.pod) {
        const D = o.pod, zT = D.dno + D.h;
        const ven = tel([0, D.dno, zT].map(z => ({ z, P: body(D.S(z, true)) })));
        const vnitrek = tel([D.dno, zT + 1].map(z => ({ z, P: body(D.S(z, false)) })));
        const nadDnem = tel([D.dno - 0.4, zT + 1].map(z => ({ z, P: body(D.S(z, false)) })));   // žebra zapuštěná 0,4 mm do dna
        let A = k(ven.subtract(vnitrek));
        if (D.zebra) {
          const n = o.N && o.N <= 8 ? o.N : 6, a = D.S(D.dno, false).a;
          A = k(M.union([A, k(sjed(Array.from({ length: n }, (_, i) => otoc(kvadr(0.3 * a, a + 5, -1.2, 1.2, D.dno - 0.4, D.dno + D.zebra), 2 * Math.PI * i / n))).intersect(nadDnem))]));
        }
        pridej(sit(k, A, 'podmiska', 'Podmiska', BARVY.podmiska), 0, 0, -(D.dno + D.zebra));
      }
      return { dily, sestava, o, objemy, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  function kontrolyModelu(p, model) {
    const H = [];
    for (const d of model.dily) {
      if (d.teles > 1) H.push({ uroven: 'chyba', pole: null, text: `${d.nazev}: díl se rozpadl na ${d.teles} tělesa – některá část není spojená.` });
      const r = G.rozborTisku(d, p.tisk.uhel);
      if (r.previs > 5) H.push({ uroven: 'varovani', pole: ['tisk.uhel'], text: `${d.nazev}: převisy nad ${fmt(p.tisk.uhel)}° od svislice ${fmt(r.previs, 0)} mm² – v místě převisu může potřebovat podpory.` });
      if (r.most > 2) H.push({ uroven: 'info', pole: null, text: `${d.nazev}: tiskárna přemostí ${fmt(r.most, 0)} mm² vodorovného stropu.` });
    }
    return H;
  }

  /* ---------------- výpočty ---------------- */
  /** Zásoba vody, výdrž a hmotnosti. model = výsledek postav (přesné objemy ze sítě), bez něj odhad z odvozených rozměrů. */
  function vypocty(p, o, model) {
    const mat = MATERIALY[p.tisk.material];
    const substrat = model ? model.objemy.substrat : o.objemSubstratu || 0, voda = model ? model.objemy.voda : o.objemVody || 0;
    const r = { presne: !!model, substrat, voda, spotreba: p.vypocty.spotreba };
    r.vydrz = voda / 1000 / p.vypocty.spotreba;
    r.podil = substrat > 0 ? voda / substrat : 0;
    r.mTisk = model ? model.dily.reduce((s, d) => s + d.objem * mat.hustota / 1000, 0) : 0;
    r.mSubstrat = substrat / 1e6 * p.vypocty.substrat * 1000;
    r.mVoda = voda / 1000;
    r.mCelkem = r.mTisk + r.mSubstrat + r.mVoda;
    if (o.maVlozku) { r.hladina = o.zHl - o.zDno; r.mezera = o.zK - o.zHl; }
    return r;
  }

  function kusovnik(p, model) {
    const mat = MATERIALY[p.tisk.material], o = model.o, R = [];
    for (const d of model.dily) R.push({ nazev: d.nazev, ks: 1, druh: 'tisk', pozn: `${fmt(d.objem * mat.hustota / 1000, 0)} g ${mat.nazev}`, d });
    if (o.maVlozku && !o.noha) R.push({ nazev: `Knot – nasákavá šňůra Ø ${fmt(p.knot.prumer - 1, 0)}–${fmt(p.knot.prumer, 0)} mm`, ks: p.knot.pocet, druh: 'nakup', pozn: `délka ${fmt(o.zK - o.zDno + 60, 0)} mm` });
    if (model.objemy.substrat > 0) R.push({ nazev: 'Substrát', ks: 1, druh: 'nakup', pozn: `${fmt(model.objemy.substrat / 1e6, 2)} l` });
    return R;
  }

  /* ---------------- projekt ---------------- */
  function popis(p) {
    const o = odvozeneS(p, 1), P = p.plast;
    if (p.druh === 'podmiska') return `${NAZVY.druh.podmiska} · dno Ø ${fmt(p.podmiska.prumer)}`;
    const roz = p.druh === 'vlozka' ? `obal ${fmt(p.obal.prumerH)}/${fmt(p.obal.prumerD)} × ${fmt(p.obal.vyska)}`
      : P.zadani === 'objem' ? `${fmt(P.objem, 2)} l substrátu` : `${fmt(P.prumerH)}/${fmt(P.prumerD)} × ${fmt(P.vyska)}`;
    return `${NAZVY.druh[p.druh]} · ${NAZVY.tvar[P.tvar]} ${roz}${o.maVlozku ? ' · ' + NAZVY.vzlinani[p.vlozka.vzlinani] : ''}`;
  }
  const TYP = 'kvetinace';
  const ulozProjekt = p => G.projektJson(TYP, p, 1);
  const nactiProjekt = text => G.nactiProjektJson(text, TYP, normalizuj, 'Samozavlažovací květináče');

  const API = {
    DATUM, MATERIALY, ROSTLINY, NAZVY, VYCHOZI, MEZE, VYCTY, PREDVOLBY,
    normalizuj, predvolba, odvozene, kontroly, postav, kontrolyModelu, vypocty, kusovnik, popis, ulozProjekt, nactiProjekt,
    obrys, rho, plochaObrysu, profil, kopie, vezmi: G.vezmi, poloz: G.poloz, fmt, segmenty,
  };
  if (uzel) module.exports = API; else window.KVET = API;
})();

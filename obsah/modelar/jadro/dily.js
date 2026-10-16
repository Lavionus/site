/* Modelář 3D – parametrické díly (bez DOM, jde v node i ve workeru).
   Každý díl má skutečné rozměry z parametrů (šroub M8 je opravdu 8 mm):
   uzel nese param, stred a zaklad (obálka v přirozených souřadnicích, z od 0
   nahoru) a rozmer, který jen škáluje – stejně jako skica. Geometrii počítá
   manifold ve workeru (vodotěsná, jde do booleanů). Obálka se počítá
   analyticky, aby fungovaly úchyty, spodek a zarovnání bez čekání.
   Šroubovice (závity, pružina, šikmé ozubení) = příčný řez vytažený se
   zkroucením 360° na jedno stoupání: plocha invariantní vůči šroubovému
   pohybu je zkroucením řezu popsaná přesně.
   Katalog M.DILY[druh] = { nazev, ikona, barva, role, param, parametry,
     obalka(p) → {min, max, kruh?}, manifold(w, p) → Manifold }. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const PI = Math.PI, ST = PI / 180;

  // ------------------------------------------------------------ normy závitů
  const PALEC = 25.4;
  /* velikost → [jmenovitý průměr d (mm), stoupání p (mm), úhel profilu (°), klíč s (mm), výška hlavy k, výška matice m] */
  const ZAVITY = {
    M2: [2, 0.4, 60, 4, 1.4, 1.6], 'M2.5': [2.5, 0.45, 60, 5, 1.7, 2], M3: [3, 0.5, 60, 5.5, 2, 2.4], M4: [4, 0.7, 60, 7, 2.8, 3.2],
    M5: [5, 0.8, 60, 8, 3.5, 4.7], M6: [6, 1, 60, 10, 4, 5.2], M8: [8, 1.25, 60, 13, 5.3, 6.8], M10: [10, 1.5, 60, 16, 6.4, 8.4],
    M12: [12, 1.75, 60, 18, 7.5, 10.8], M14: [14, 2, 60, 21, 8.8, 12.8], M16: [16, 2, 60, 24, 10, 14.8], M20: [20, 2.5, 60, 30, 12.5, 18],
    M24: [24, 3, 60, 36, 15, 21.5],
  };
  const palcovy = (d, tpi, uhel = 60) => { const dm = d * PALEC; return [dm, PALEC / tpi, uhel, Math.round(dm * 1.5 * 10) / 10, Math.round(dm * 0.65 * 10) / 10, Math.round(dm * 0.875 * 10) / 10]; };
  Object.assign(ZAVITY, {
    'UNC #4-40': palcovy(0.112, 40), 'UNC #6-32': palcovy(0.138, 32), 'UNC #8-32': palcovy(0.164, 32), 'UNC #10-24': palcovy(0.19, 24),
    'UNC 1/4-20': palcovy(0.25, 20), 'UNC 5/16-18': palcovy(0.3125, 18), 'UNC 3/8-16': palcovy(0.375, 16), 'UNC 1/2-13': palcovy(0.5, 13),
    'UNF #10-32': palcovy(0.19, 32), 'UNF 1/4-28': palcovy(0.25, 28), 'UNF 5/16-24': palcovy(0.3125, 24), 'UNF 3/8-24': palcovy(0.375, 24),
    'UNF 1/2-20': palcovy(0.5, 20),
    'BSW 1/8': palcovy(0.125, 40, 55), 'BSW 3/16': palcovy(0.1875, 24, 55), 'BSW 1/4': palcovy(0.25, 20, 55), 'BSW 5/16': palcovy(0.3125, 18, 55),
    'BSW 3/8': palcovy(0.375, 16, 55), 'BSW 1/2': palcovy(0.5, 12, 55),
  });
  M.ZAVITY = ZAVITY;
  const VOLBY_ZAVITU = Object.keys(ZAVITY).map(k => [k, k.replace('.', ',')]).concat([['vlastni', 'Vlastní průměr']]);
  /** Hrubé stoupání pro vlastní průměr (podle metrické řady; nad 40 mm jako závity lahví a víček). */
  const stoupaniPro = d => d <= 3 ? 0.5 : d <= 5 ? 0.8 : d <= 8 ? 1.25 : d <= 12 ? 1.75 : d <= 20 ? 2.5 : d <= 40 ? 3 : 4;
  M.stoupaniPro = stoupaniPro;
  /** Údaje závitu (stoupání 0 = podle normy; vlastní průměr: p.prumer, stoupání podle průměru). */
  function zavit(p) {
    if (p.velikost === 'vlastni') {
      const d = M.omez(+p.prumer || 20, 1, 500), r1 = x => Math.round(x * 10) / 10;
      return { d, p: p.stoupani > 0 ? p.stoupani : stoupaniPro(d), uhel: 60, s: r1(1.6 * d), k: r1(0.65 * d), m: r1(0.8 * d) };
    }
    const z = ZAVITY[p.velikost] || ZAVITY.M8;
    return { d: z[0], p: p.stoupani > 0 ? p.stoupani : z[1], uhel: z[2], s: z[3], k: z[4], m: z[5] };
  }
  M.udajeZavitu = zavit;
  /** Vůle závitu omezená vůči průměru (u malého závitu by velká vůle závit zrušila – prázdný nebo rozbitý díl). */
  const vuleZ = (p, z) => Math.min(Math.max(0, p.vule || 0), 0.15 * z.d);

  /** Radiální hloubka závitu: 0,6134 p (metrický a UN 60°), 0,640 p (Whitworth 55°). */
  // u vlastního velkého stoupání by profil prošel osou (záporný poloměr) – nejvýš 80 % poloměru
  const hloubkaZavitu = z => Math.min((z.uhel === 55 ? 0.640 : 0.6134) * z.p, 0.8 * z.d / 2);
  M.hloubkaZavitu = hloubkaZavitu;

  /** Poloměr profilu závitu v osové poloze u (v násobcích stoupání; vrchol kolem u = 0).
      Lichoběžník: ploška vrcholu p/8, ploška dna p/4 (ISO), mezi nimi rovné boky. */
  function profilZavitu(u, rMaj, hloubka) {
    const t = ((u % 1) + 1) % 1;
    const v = t > 0.5 ? 1 - t : t;               // souměrný profil, 0 = střed vrcholu, 0,5 = střed dna
    const vrchol = 1 / 16, dno = 0.5 - 1 / 8;
    if (v <= vrchol) return rMaj;
    if (v >= dno) return rMaj - hloubka;
    return rMaj - hloubka * (v - vrchol) / (dno - vrchol);
  }

  /** Příčný řez závitem: N bodů na otáčku, chodů n (vícechodý závit). */
  function rezZavitu(rMaj, hloubka, uhel, N, chodu = 1) {
    const b = [];
    for (let i = 0; i < N; i++) {
      const t = i / N, a = 2 * PI * t;
      const r = profilZavitu(t * chodu, rMaj, hloubka);
      b.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    return b;
  }

  /** Pomocník: hlídá mezivýsledky a na konci je smaže (kromě vráceného). */
  const MAX_TROJ_DILU = 1.5e6;                    // nad tolik trojúhelníků se jemnost dílu sníží
  // sklady rozpočítaného dílu: při výjimce je manifoldDilu všechny uvolní (jinak by mezivýsledky zůstaly ve WASM)
  let sklady = null;
  function sklad() {
    const vse = [];
    if (sklady) sklady.push(vse);
    const s = x => { vse.push(x); return x; };
    s.konec = vysl => { for (const x of vse) if (x !== vysl) x.delete(); return vysl; };
    return s;
  }

  /** Závitová tyč: z 0..delka, pravý závit, sražené konce (srazit = 'oba' | 'horni' | false). */
  function zavitovaTyc(w, s, rMaj, hloubka, stoupani, delka, uhel, seg, srazit = 'oba') {
    const { CrossSection, Manifold } = w;
    const otacek = delka / stoupani;
    // trojúhelníků ≈ N² · otáčky: dlouhý závit s 256 segmenty by měl 5 milionů (desítky s, GB paměti) – rozpočet 1,5 milionu
    const N = Math.max(24, Math.min(seg, Math.floor(Math.sqrt(MAX_TROJ_DILU / Math.max(otacek, 1e-6)))));
    if (otacek * N * N > 2 * MAX_TROJ_DILU) throw new Error(`závit má ${Math.round(otacek)} otáček – je na výpočet příliš dlouhý nebo jemný (zvětši stoupání nebo zkrať díl)`);
    const rez = s(new CrossSection([rezZavitu(rMaj, hloubka, uhel, N)], 'NonZero'));
    const tyc = s(rez.extrude(delka, Math.ceil(otacek * N / 2), 360 * otacek));
    if (!srazit) return tyc;
    // sražení obou konců: průnik s rotačním tělesem (profil v rovině r–z)
    const c = Math.min(hloubka * 1.2, delka / 3, 0.8 * rMaj), c0 = srazit === 'oba' ? c : 0;
    const prof = s(new CrossSection([[[0, 0], [rMaj + (c0 ? -c0 : 0.01), 0], [rMaj + 0.01, c0 + 0.01], [rMaj + 0.01, delka - c - 0.01], [rMaj - c, delka], [0, delka]]]));
    const obal = s(prof.revolve(N));
    return s(tyc.intersect(obal));
  }

  const sestihran = (CrossSection, s, klic) => {
    const R = klic / Math.cos(PI / 6) / 2, b = [];
    for (let i = 0; i < 6; i++) b.push([R * Math.cos(i * PI / 3), R * Math.sin(i * PI / 3)]);
    return s(new CrossSection([b]));
  };
  /** Sražení šestihranu (matice, hlava): průnik s dvojkužel (30° od plochy). */
  function srazSestihran(w, s, teleso, klic, vyska, seg) {
    const { CrossSection } = w;
    const R = klic / Math.cos(PI / 6) / 2, r0 = klic / 2 * 0.95, c = (R - r0) * Math.tan(30 * ST);
    const prof = s(new CrossSection([[[0, 0], [r0, 0], [R + 0.01, c], [R + 0.01, vyska - c], [r0, vyska], [0, vyska]]]));
    return s(teleso.intersect(s(prof.revolve(seg))));
  }

  // ------------------------------------------------------------ evolventní ozubení
  /** Obrys čelního kola: z zubů, modul m, úhel záběru α, tloušťka zubu na roztečné
      kružnici s (mm), poloměry hlavy ra a paty rf. Bod pro každou část zubu. */
  /** Poloměr hlavy omezený tam, kde se zub zašpičatí (málo zubů nebo vysoká hlava). */
  M.polomerHlavy = function (z, m, alfa, s, ra) {
    const r = m * z / 2, rb = r * Math.cos(alfa), inv = a => Math.tan(a) - a;
    const psi = s / (2 * r) + inv(alfa);
    const pulTloustky = rr => psi - inv(Math.acos(Math.min(1, rb / rr)));   // polovina úhlové tloušťky zubu v poloměru rr
    if (pulTloustky(ra) > 0) return ra;
    let a = Math.max(rb, r * 0.5), b = ra;
    for (let i = 0; i < 50; i++) { const c = (a + b) / 2; if (pulTloustky(c) > 0) a = c; else b = c; }
    return a;
  };

  M.obrysKola = function (z, m, alfa, s, ra, rf, kroku = 8) {
    const r = m * z / 2, rb = r * Math.cos(alfa);
    const inv = a => Math.tan(a) - a;
    ra = M.polomerHlavy(z, m, alfa, s, ra);
    // polovina úhlu zubu na roztečné kružnici + evolventní funkce = úhel osy zubu k počátku evolventy
    const psi = s / (2 * r) + inv(alfa);
    const evolventa = rr => { const t = Math.sqrt(Math.max(0, (rr / rb) ** 2 - 1)); return { x: rb * (Math.cos(t) + t * Math.sin(t)), y: rb * (Math.sin(t) - t * Math.cos(t)) }; };
    const uhelBodu = rr => { const e = evolventa(rr); return Math.atan2(e.y, e.x); };
    const rStart = Math.max(rb, rf);
    const bok = [];                                    // pravý bok zubu od paty k hlavě (úhel měřený od osy zubu)
    if (rf < rb) bok.push([rf, -psi]);
    for (let i = 0; i <= kroku; i++) {
      const rr = rStart + (ra - rStart) * i / kroku;
      bok.push([rr, uhelBodu(rr) - psi]);
    }
    const body = [], krokZubu = 2 * PI / z;
    for (let k = 0; k < z; k++) {
      const osa = k * krokZubu;
      // pravý bok (záporný úhel od osy), hlava, levý bok zpět; mezi zuby oblouk paty
      for (const [rr, a] of bok) body.push([rr * Math.cos(osa + a), rr * Math.sin(osa + a)]);
      const aHlava = bok[bok.length - 1][1];
      for (let i = 1; i < 3; i++) { const a = aHlava + (-2 * aHlava) * i / 3; body.push([ra * Math.cos(osa + a), ra * Math.sin(osa + a)]); }
      for (let i = bok.length - 1; i >= 0; i--) { const [rr, a] = bok[i]; body.push([rr * Math.cos(osa - a), rr * Math.sin(osa - a)]); }
      // pata mezi tímto a dalším zubem
      const a0 = -bok[0][1], a1 = krokZubu + bok[0][1];
      for (let i = 1; i < 4; i++) { const a = a0 + (a1 - a0) * i / 4; body.push([rf * Math.cos(osa + a), rf * Math.sin(osa + a)]); }
    }
    // pravý bok má záporné úhly → obrys jde proti hodinám? Pro jistotu orientovat podle plochy
    let pl = 0;
    for (let i = 0; i < body.length; i++) { const a = body[i], b = body[(i + 1) % body.length]; pl += a[0] * b[1] - b[0] * a[1]; }
    return pl < 0 ? body.reverse() : body;
  };

  // ------------------------------------------------------------ katalog
  const SEG = { klic: 'segmentu', popis: 'Segmenty', min: 16, max: 256, krok: 8, cele: true };
  const VULE = { klic: 'vule', popis: 'Vůle pro tisk', jednotka: 'mm', min: 0, max: 2, krok: 0.05 };
  const ZAVIT = { klic: 'velikost', popis: 'Závit', volby: VOLBY_ZAVITU };
  const PRUMER = { klic: 'prumer', popis: 'Průměr (vlastní závit)', jednotka: 'mm', min: 1, max: 500, krok: 0.5 };
  const STOUP = { klic: 'stoupani', popis: 'Stoupání (0 = norma)', jednotka: 'mm', min: 0, max: 10, krok: 0.05 };
  /** Odvozené pole: počet závitů = délka / stoupání; zápis změní délku (hloubku) na celý počet závitů. */
  const POCET_ZAVITU = { klic: 'pocetZavitu', odvozeny: true, popis: 'Počet závitů', min: 1, max: 5000, krok: 1,
    cti: (r, p) => p.delka / zavit(p).p,
    zapis: (r, p, v) => ({ param: { delka: Math.round(Math.max(1, v) * zavit(p).p * 1e4) / 1e4 } }) };
  const PISMA = [['libsans', 'Liberation Sans Bold'], ['bebas', 'Bebas Neue'], ['anton', 'Anton'], ['archivo', 'Archivo Black'],
    ['russo', 'Russo One'], ['alfaslab', 'Alfa Slab One'], ['bungee', 'Bungee'], ['titan', 'Titan One'], ['righteous', 'Righteous'],
    ['luckiest', 'Luckiest Guy'], ['saira', 'Saira Stencil One'], ['blackops', 'Black Ops One']];
  M.PISMA = PISMA;

  M.DILY = {
    sroub: {
      nazev: 'Šroub', ikona: '🔩', barva: '#9aa4ae', role: 'teleso',
      param: { prumer: 20, velikost: 'M8', stoupani: 0, delka: 20, hlava: 'sestihran', vule: 0.1, segmentu: 64 },
      parametry: [ZAVIT, PRUMER, { klic: 'delka', popis: 'Délka dříku', jednotka: 'mm', min: 1, max: 500, krok: 1 }, POCET_ZAVITU,
        { klic: 'hlava', popis: 'Hlava', volby: [['sestihran', 'Šestihranná'], ['valcova', 'Válcová s imbusem'], ['zapustna', 'Zápustná 90°'], ['zadna', 'Bez hlavy (tyč)']] },
        STOUP, VULE, SEG],
      obalka(p) {
        const z = zavit(p), hl = rozmeryHlavy(p, z);
        const rd = z.d / 2 - vuleZ(p, z) / 2;             // dřík zúžený o vůli
        const R = Math.max(rd, hl.R), Ry = hl.typ === 'sestihran' ? Math.max(rd, z.s / 2) : R;   // šestihran: v Y přes plošky
        return { min: [-R, -Ry, 0], max: [R, Ry, hl.k + p.delka], kruh: hl.typ !== 'sestihran' };
      },
      manifold(w, p) {
        const { CrossSection, Manifold } = w, s = sklad();
        const z = zavit(p), hl = rozmeryHlavy(p, z);
        const rMaj = z.d / 2 - vuleZ(p, z) / 2, hloubka = hloubkaZavitu(z);
        if (hl.typ === 'zadna') return s.konec(zavitovaTyc(w, s, rMaj, hloubka, z.p, p.delka, z.uhel, p.segmentu));
        // dřík zasunutý 0,5 mm do hlavy (jen dotyk ploch by dal dvě oddělená tělesa), sražený jen nahoře
        const zasun = Math.min(0.5, hl.k / 2);
        let tyc = zavitovaTyc(w, s, rMaj, hloubka, z.p, p.delka + zasun, z.uhel, p.segmentu, 'horni');
        tyc = s(tyc.translate([0, 0, hl.k - zasun]));
        let hlava;
        if (hl.typ === 'sestihran') hlava = srazSestihran(w, s, s(sestihran(CrossSection, s, z.s).extrude(hl.k)), z.s, hl.k, p.segmentu);
        else if (hl.typ === 'valcova') {
          hlava = s(Manifold.cylinder(hl.k, hl.R, hl.R, p.segmentu));
          const imbus = s(s(sestihran(CrossSection, s, hl.imbus).extrude(hl.k * 0.6)).translate([0, 0, 0]));
          hlava = s(hlava.subtract(imbus));          // imbus zespodu (hlava leží na desce)
        } else hlava = s(Manifold.cylinder(hl.k, hl.R, z.d / 2, p.segmentu));   // zápustná: široká dole
        return s.konec(s(Manifold.union([hlava, tyc])));
      },
    },
    matice: {
      nazev: 'Matice', ikona: '⬡', barva: '#9aa4ae', role: 'teleso',
      param: { prumer: 20, velikost: 'M8', stoupani: 0, vyska: 0, vule: 0.2, srazeni: true, segmentu: 64 },
      parametry: [ZAVIT, PRUMER, { klic: 'vyska', popis: 'Výška (0 = norma)', jednotka: 'mm', min: 0, max: 200, krok: 0.5 }, STOUP, VULE,
        { klic: 'srazeni', popis: 'Sražený vstup závitu (šroub snáz chytí)', prepinac: true }, SEG],
      obalka(p) {
        const z = zavit(p), R = z.s / Math.cos(PI / 6) / 2, h = p.vyska > 0 ? p.vyska : z.m;
        return { min: [-R, -z.s / 2, 0], max: [R, z.s / 2, h] };
      },
      manifold(w, p) {
        const { CrossSection } = w, s = sklad();
        const z = zavit(p), h = p.vyska > 0 ? p.vyska : z.m;
        const telo = srazSestihran(w, s, s(sestihran(CrossSection, s, z.s).extrude(h)), z.s, h, p.segmentu);
        const otvor = vnitrniZavit(w, s, z, vuleZ(p, z), h, p.segmentu);
        let m = s(telo.subtract(otvor));
        if (p.srazeni) m = srazVstupy(w, s, m, z, vuleZ(p, z), h, p.segmentu, 0.95 * z.s / 2);
        return s.konec(m);
      },
    },
    sadaSroub: {
      // dlaždice v knihovně vloží šroub a matici jako dva samostatné objekty (M.pridejTvar);
      // díl zůstává kvůli projektům, kde už sada jako jeden objekt je
      nazev: 'Šroub + matice (sada)', ikona: '🔩', barva: '#8d99a6', role: 'teleso',
      // celková vůle (radiální mezera mezi závity): šroub se zúží o 40 %, matice rozšíří o 60 %;
      // 0,35 mm sedí pro FDM s tryskou 0,4 mm od M8 výš (menší závity tisk nepřesně vykreslí)
      param: { prumer: 20, velikost: 'M10', stoupani: 0, delka: 25, hlava: 'sestihran', vule: 0.35, segmentu: 64 },
      parametry: [ZAVIT, PRUMER, { klic: 'delka', popis: 'Délka dříku', jednotka: 'mm', min: 1, max: 500, krok: 1 }, POCET_ZAVITU,
        { klic: 'hlava', popis: 'Hlava', volby: [['sestihran', 'Šestihranná'], ['valcova', 'Válcová s imbusem'], ['zapustna', 'Zápustná 90°'], ['zadna', 'Bez hlavy (tyč)']] },
        STOUP, { klic: 'vule', popis: 'Vůle závitu (celková)', jednotka: 'mm', min: 0, max: 1.5, krok: 0.05 }, SEG],
      obalka(p) {
        const r = rozlozeniSady(p), a = M.DILY.sroub.obalka(r.sroub), b = M.DILY.matice.obalka(r.matice);
        return { min: [a.min[0], Math.min(a.min[1], b.min[1]), 0], max: [r.dx + b.max[0], Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])] };
      },
      manifold(w, p) {
        const { Manifold } = w, s = sklad(), r = rozlozeniSady(p);
        const sroub = s(M.DILY.sroub.manifold(w, r.sroub));
        const matice = s(M.DILY.matice.manifold(w, r.matice));
        return s.konec(s(Manifold.union([sroub, s(matice.translate([r.dx, 0, 0]))])));
      },
    },
    sroubovice: {
      nazev: 'Maticová šroubovice', ikona: '🌀', barva: '#8f9cab', role: 'teleso',
      tip: 'Do jiného tělesa: nejdřív do něj vyvrtej díru o vnějším průměru šroubovice a seskup (Ctrl+G), pak k výsledku přidej šroubovici a seskup znovu – v jedné skupině by díra smazala i šroubovici.',
      // trubka s vnitřním závitem: vlož ji do díry jiného tělesa (stejný vnější průměr) a seskup – těleso
      // pak má závit pro šroub. Délka = počet závitů × stoupání.
      param: { prumer: 20, velikost: 'M10', stoupani: 0, delka: 10, stena: 1.6, vule: 0.2, srazeni: true, segmentu: 64 },
      parametry: [ZAVIT, PRUMER, { klic: 'delka', popis: 'Délka', jednotka: 'mm', min: 0.5, max: 500, krok: 0.5 }, POCET_ZAVITU,
        { klic: 'stena', popis: 'Stěna za závitem', jednotka: 'mm', min: 0.4, max: 100, krok: 0.2 },
        { odvozeny: true, popis: 'Vnější průměr', jednotka: 'mm', min: 1, max: 1000, krok: 0.5,
          cti: (r, p) => 2 * (zavit(p).d / 2 + p.vule + p.stena),
          zapis: (r, p, v) => ({ param: { stena: Math.round(Math.max(0.4, v / 2 - zavit(p).d / 2 - p.vule) * 1e4) / 1e4 } }) },
        STOUP, VULE, { klic: 'srazeni', popis: 'Sražený vstup závitu', prepinac: true }, SEG],
      obalka(p) {
        const z = zavit(p), R = z.d / 2 + p.vule + p.stena;
        return { min: [-R, -R, 0], max: [R, R, p.delka], kruh: true };
      },
      manifold(w, p) {
        const { Manifold } = w, s = sklad(), z = zavit(p), R = z.d / 2 + p.vule + p.stena;
        const trubka = s(Manifold.cylinder(p.delka, R, R, p.segmentu));
        const otvor = s(vnitrniZavit(w, s, z, p.vule, p.delka + 1, p.segmentu).translate([0, 0, -0.5]));
        let m = s(trubka.subtract(otvor));
        if (p.srazeni) m = srazVstupy(w, s, m, z, p.vule, p.delka, p.segmentu, 0.95 * R);
        return s.konec(m);
      },
    },
    hakS: {
      nazev: 'Háček S', ikona: '🪝', barva: '#546e7a', role: 'teleso', sada: 'dalsi',
      // naplocho (vrstvy tisku podél drátu – nejpevnější); oblouky s vnitřním průměrem = trubka + vůle,
      // rovný krček tečně na oba oblouky (trubku podepře z boku, nezasahuje do ní)
      param: { prumerHorni: 25, prumerDolni: 20, vule: 0.6, tloustka: 5, sila: 6, rovna: 10, spicka: 60, zahnuti: 0, segmentu: 48 },
      parametry: [
        { klic: 'prumerHorni', popis: 'Trubka nahoře ⌀', jednotka: 'mm', min: 1, max: 500, krok: 1 },
        { klic: 'prumerDolni', popis: 'Trubka dole ⌀', jednotka: 'mm', min: 1, max: 500, krok: 1 },
        { klic: 'vule', popis: 'Vůle k trubce', jednotka: 'mm', min: 0, max: 10, krok: 0.1 },
        { klic: 'tloustka', popis: 'Šířka drátu', jednotka: 'mm', min: 0.5, max: 100, krok: 0.5 },
        { klic: 'sila', popis: 'Síla (výška)', jednotka: 'mm', min: 0.5, max: 100, krok: 0.5 },
        { klic: 'rovna', popis: 'Rovný krček', jednotka: 'mm', min: 0, max: 500, krok: 1 },
        { klic: 'spicka', popis: 'Délka špiček', jednotka: '%', min: 0, max: 200, krok: 10 },
        { klic: 'zahnuti', popis: 'Zahnutí špiček (0 = trubka projde)', jednotka: '°', min: 0, max: 80, krok: 5 }, SEG],
      obalka(p) {
        const o = obrysHakuS(p);
        return { min: [o.min[0], o.min[1], 0], max: [o.max[0], o.max[1], p.sila] };
      },
      manifold(w, p) {
        const s = sklad();
        return s.konec(s(s(new w.CrossSection([obrysHakuS(p).body], 'NonZero')).extrude(p.sila)));
      },
    },
    klip: {
      nazev: 'Klip na trubku', ikona: '🧷', barva: '#2f7fd8', role: 'teleso',
      // kroužek s otvorem nahoře (trubka se do něj zacvakne), volitelně patka se dvěma dírami na šroub
      param: { prumer: 20, vule: 0.3, stena: 2.5, sirka: 10, otevreni: 110, patka: true, delkaPatky: 10, otvor: 4, segmentu: 64 },
      parametry: [
        { klic: 'prumer', popis: 'Trubka ⌀', jednotka: 'mm', min: 2, max: 300, krok: 0.5 },
        { klic: 'vule', popis: 'Vůle k trubce', jednotka: 'mm', min: 0, max: 5, krok: 0.1 },
        { klic: 'stena', popis: 'Stěna', jednotka: 'mm', min: 0.6, max: 30, krok: 0.2 },
        { klic: 'sirka', popis: 'Šířka', jednotka: 'mm', min: 1, max: 200, krok: 1 },
        { klic: 'otevreni', popis: 'Otevření', jednotka: '°', min: 30, max: 150, krok: 5 },
        { klic: 'patka', popis: 'Patka na šrouby', prepinac: true },
        { klic: 'delkaPatky', popis: 'Délka patky', jednotka: 'mm', min: 3, max: 100, krok: 1 },
        { klic: 'otvor', popis: 'Díra na šroub ⌀', jednotka: 'mm', min: 0, max: 20, krok: 0.1 }, SEG],
      obalka(p) {
        const g = geomKlipu(p), X = p.patka ? g.Ro + p.delkaPatky : g.Ro;
        return { min: [-X, -g.Ro, 0], max: [X, g.ymax, p.sirka] };
      },
      manifold(w, p) {
        const { CrossSection, Manifold } = w, s = sklad(), g = geomKlipu(p), n = p.segmentu;
        // vnitřní kružnice opsaná (mnohoúhelník nesmí ubrat vůli ani u velké trubky a hrubé kvality)
        let c = s(s(CrossSection.circle(g.Ro, n)).subtract(s(CrossSection.circle(g.Ri / Math.cos(PI / n), n))));
        const a = g.a, B = 4 * g.Ro;
        c = s(c.subtract(s(new CrossSection([[[0, 0], [B * Math.cos(a), B * Math.sin(a)], [0, B], [-B * Math.cos(a), B * Math.sin(a)]]]))));
        // zaoblené konce oblouku
        for (const z of [1, -1]) c = s(c.add(s(s(CrossSection.circle(p.stena / 2, 24)).translate([z * g.rc * Math.cos(a), g.rc * Math.sin(a)]))));
        if (p.patka) c = s(c.add(s(s(CrossSection.square([2 * (g.Ro + p.delkaPatky), p.stena])).translate([-(g.Ro + p.delkaPatky), -g.Ro]))));
        let m = s(c.extrude(p.sirka));
        // díra jen když se do patky vejde (širší by patku rozpůlila)
        if (p.patka && p.otvor > 0 && p.otvor <= Math.min(p.sirka, p.delkaPatky) - 1) for (const z of [1, -1]) {
          const d = s(s(s(Manifold.cylinder(p.stena + 2, p.otvor / 2, p.otvor / 2, 24)).rotate([-90, 0, 0])).translate([z * (g.Ro + p.delkaPatky / 2), -g.Ro - 1, p.sirka / 2]));
          m = s(m.subtract(d));
        }
        return s.konec(m);
      },
    },
    prichytka: {
      nazev: 'Kabelová příchytka', ikona: '🔌', barva: '#4a4f57', role: 'teleso',
      // oblouk přes kabel ležící na zdi, po stranách patky s dírami na šroub (zahloubené)
      param: { prumer: 6, vule: 0.4, stena: 1.6, sirka: 8, delkaPatky: 6, otvor: 3.5, segmentu: 48 },
      parametry: [
        { klic: 'prumer', popis: 'Kabel ⌀', jednotka: 'mm', min: 1, max: 100, krok: 0.5 },
        { klic: 'vule', popis: 'Vůle ke kabelu', jednotka: 'mm', min: 0, max: 5, krok: 0.1 },
        { klic: 'stena', popis: 'Stěna', jednotka: 'mm', min: 0.6, max: 10, krok: 0.2 },
        { klic: 'sirka', popis: 'Šířka', jednotka: 'mm', min: 2, max: 100, krok: 1 },
        { klic: 'delkaPatky', popis: 'Délka patky', jednotka: 'mm', min: 2, max: 50, krok: 0.5 },
        { klic: 'otvor', popis: 'Díra na šroub ⌀', jednotka: 'mm', min: 0, max: 10, krok: 0.1 }, SEG],
      obalka(p) {
        const ri = (p.prumer + p.vule) / 2, ro = ri + p.stena, X = ro + p.delkaPatky;
        return { min: [-X, 0, 0], max: [X, p.sirka, p.prumer / 2 + ro] };
      },
      manifold(w, p) {
        const { CrossSection, Manifold } = w, s = sklad(), n = p.segmentu;
        const ri = (p.prumer + p.vule) / 2, ro = ri + p.stena, h0 = p.prumer / 2, X = ro + p.delkaPatky;
        const obl = (r, vnitrni) => s(s(s(CrossSection.square([2 * r, h0 + 0.001])).translate([-r, -0.001])).add(s(s(CrossSection.circle(vnitrni ? r / Math.cos(PI / n) : r, n)).translate([0, h0]))));
        let c = s(obl(ro).subtract(obl(ri, true)));
        c = s(c.add(s(s(CrossSection.square([2 * X, p.stena])).translate([-X, 0]))));
        // kanál pro kabel celý (i u kabelu tenčího než 2× stěna, kde by ho jinak patka zaplnila)
        c = s(c.subtract(obl(ri, true)));
        c = s(c.intersect(s(s(CrossSection.square([2 * X + 2, h0 + ro + 1])).translate([-X - 1, 0]))));
        let m = s(s(s(c.extrude(p.sirka)).rotate([90, 0, 0])).translate([0, p.sirka, 0]));
        if (p.otvor > 0 && p.otvor <= Math.min(p.sirka, p.delkaPatky) - 1) for (const z of [1, -1]) {
          const x = z * (ro + p.delkaPatky / 2), hk = Math.min(p.otvor / 2, p.stena * 0.6);   // zahloubení jen do patky
          const d = s(s(Manifold.cylinder(p.stena + 2, p.otvor / 2, p.otvor / 2, 24)).translate([x, p.sirka / 2, -1]));
          const k = s(s(Manifold.cylinder(hk + 0.01, p.otvor / 2, p.otvor / 2 + hk + 0.01, 24)).translate([x, p.sirka / 2, p.stena - hk]));
          m = s(s(m.subtract(d)).subtract(k));
        }
        return s.konec(m);
      },
    },
    drzakZed: {
      nazev: 'Držák na zeď', ikona: '📐', barva: '#8a6d4f', role: 'teleso',
      // úhelník pod poličku: svislá deska ke zdi se zápustnými dírami, vodorovné rameno s dírou, šikmé žebro
      param: { vyska: 60, hloubka: 50, sirka: 20, tloustka: 4, otvor: 4, zebro: true, segmentu: 32 },
      parametry: [
        { klic: 'vyska', popis: 'Výška', jednotka: 'mm', min: 10, max: 500, krok: 1 },
        { klic: 'hloubka', popis: 'Hloubka ramene', jednotka: 'mm', min: 10, max: 500, krok: 1 },
        { klic: 'sirka', popis: 'Šířka', jednotka: 'mm', min: 5, max: 300, krok: 1 },
        { klic: 'tloustka', popis: 'Tloušťka', jednotka: 'mm', min: 1, max: 30, krok: 0.5 },
        { klic: 'otvor', popis: 'Šroub ⌀ (zápustný)', jednotka: 'mm', min: 0, max: 12, krok: 0.5 },
        { klic: 'zebro', popis: 'Šikmé žebro', prepinac: true }, SEG],
      obalka(p) { return { min: [0, 0, 0], max: [p.hloubka, p.sirka, p.vyska] }; },
      manifold(w, p) {
        const { CrossSection, Manifold } = w, s = sklad(), t = Math.min(p.tloustka, p.vyska / 3, p.hloubka / 3);
        const H = p.vyska, D = p.hloubka, zb = H * 0.45;
        let c = s(s(CrossSection.square([t, H])).add(s(s(CrossSection.square([D, t])).translate([0, H - t]))));
        if (p.zebro) {
          // žebro jako pás tloušťky t od zdi (výška zb) ke konci ramene
          const a = [t, zb], b = [D - t * 0.8, H - t], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), nx = -dy / l * t / 2, ny = dx / l * t / 2;
          c = s(c.add(s(new CrossSection([[[a[0] - t, a[1] - nx * 2 - t], [a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny - t * 2]]], 'NonZero'))));
          c = s(c.intersect(s(CrossSection.square([D, H]))));
        }
        let m = s(s(s(c.extrude(p.sirka)).rotate([90, 0, 0])).translate([0, p.sirka, 0]));
        if (p.otvor > 0) {
          const r = p.otvor / 2;
          // díry ve svislé desce (pod žebrem, šroubovák projde) – zápustné na přední straně (x = t)
          for (const z of [H * 0.16, Math.min(zb - p.otvor * 1.5, H * 0.34)]) {
            const d = s(s(s(Manifold.cylinder(t + 2, r, r, p.segmentu)).rotate([0, 90, 0])).translate([-1, p.sirka / 2, z]));
            const k = s(s(s(Manifold.cylinder(r + 0.01, r, 2 * r + 0.01, p.segmentu)).rotate([0, 90, 0])).translate([t - r, p.sirka / 2, z]));
            m = s(s(m.subtract(d)).subtract(k));
          }
          // díra v rameni (pro poličku), zápustná nahoře
          const x = D * 0.72;
          const d = s(s(Manifold.cylinder(t + 2, r, r, p.segmentu)).translate([x, p.sirka / 2, H - t - 1]));
          const k = s(s(Manifold.cylinder(r + 0.01, r, 2 * r + 0.01, p.segmentu)).translate([x, p.sirka / 2, H - r]));
          m = s(s(m.subtract(d)).subtract(k));
        }
        return s.konec(m);
      },
    },
    cepZacvak: {
      nazev: 'Zacvakávací čep', ikona: '📌', barva: '#e5533c', role: 'teleso',
      tip: 'Tiskni hlavou dolů; ozub se při zasouvání stlačí do prořezu a za deskou zacvakne.',
      // hlava, dřík na tloušťku desky a ozub s prořezem – stlačí se, projde dírou a zacvakne za deskou
      param: { prumerDiry: 5, tloustkaDesky: 6, vule: 0.2, hlava: 2, presah: 0.5, segmentu: 48 },
      parametry: [
        { klic: 'prumerDiry', popis: 'Díra ⌀', jednotka: 'mm', min: 2, max: 40, krok: 0.5 },
        { klic: 'tloustkaDesky', popis: 'Tloušťka spojovaných desek', jednotka: 'mm', min: 0.5, max: 100, krok: 0.5 },
        { klic: 'vule', popis: 'Vůle v díře', jednotka: 'mm', min: 0, max: 2, krok: 0.05 },
        { klic: 'hlava', popis: 'Výška hlavy', jednotka: 'mm', min: 0.6, max: 20, krok: 0.2 },
        { klic: 'presah', popis: 'Přesah ozubu (omezí se podle průměru)', jednotka: 'mm', min: 0.1, max: 3, krok: 0.1 }, SEG],
      obalka(p) {
        const g = geomCepu(p);
        return { min: [-g.rh, -g.rh, 0], max: [g.rh, g.rh, g.Z], kruh: true };
      },
      manifold(w, p) {
        const { CrossSection, Manifold } = w, s = sklad(), g = geomCepu(p);
        let m = s(s(new CrossSection([g.prof])).revolve(p.segmentu));
        // prořez ozubu (stlačí se při zasouvání)
        const sl = g.sl;
        m = s(m.subtract(s(s(Manifold.cube([sl, 2 * g.rh + 2, g.Z - g.zs + 1])).translate([-sl / 2, -g.rh - 1, g.zs]))));
        return s.konec(m);
      },
    },
    krabiceSVikem: {
      // dlaždice vloží krabičku a víko jako dva propojené objekty (M.pridejTvar); jako jeden díl jen ze starých projektů
      nazev: 'Krabička s víkem', ikona: '🗃️', barva: '#b07d4f', role: 'teleso', sada: 'dalsi',
      param: { sx: 60, sy: 40, sz: 30, stena: 2, dno: 2, zaobleni: 3, typ: 'nasazovaci', vule: 0.25, segmentu: 32 },
      parametry: [
        { klic: 'sx', popis: 'Délka', jednotka: 'mm', min: 10, max: 500, krok: 1 },
        { klic: 'sy', popis: 'Šířka', jednotka: 'mm', min: 10, max: 500, krok: 1 },
        { klic: 'sz', popis: 'Výška', jednotka: 'mm', min: 5, max: 500, krok: 1 },
        { klic: 'stena', popis: 'Stěna', jednotka: 'mm', min: 0.8, max: 20, krok: 0.2 },
        { klic: 'dno', popis: 'Dno', jednotka: 'mm', min: 0.6, max: 20, krok: 0.2 },
        { klic: 'zaobleni', popis: 'Zaoblení rohů', jednotka: 'mm', min: 0, max: 100, krok: 0.5 },
        { klic: 'typ', popis: 'Víko', volby: [['nasazovaci', 'Nasazovací (lem)'], ['sroubky', 'Na šroubky (sloupky v rozích)']] },
        { klic: 'vule', popis: 'Vůle víka', jednotka: 'mm', min: 0, max: 2, krok: 0.05 }, SEG],
      obalka(p) {
        const r = rozlozeniKrabice(p), a = M.DILY.krabice.obalka(r.krabice), b = M.DILY.vicko.obalka(r.vicko);
        return { min: [a.min[0], a.min[1], 0], max: [r.dx + b.max[0], a.max[1], Math.max(a.max[2], b.max[2])] };
      },
      manifold(w, p) {
        const s = sklad(), r = rozlozeniKrabice(p);
        const a = s(M.DILY.krabice.manifold(w, r.krabice)), b = s(M.DILY.vicko.manifold(w, r.vicko));
        return s.konec(s(w.Manifold.union([a, s(b.translate([r.dx, 0, 0]))])));
      },
    },
    krabice: {
      nazev: 'Krabička', ikona: '🗃️', barva: '#b07d4f', role: 'teleso', skryty: true,
      rozmerKlice: ['sx', 'sy', 'sz'],                   // pole Rozměr v inspektoru mění parametry (ne měřítko)
      param: { sx: 60, sy: 40, sz: 30, stena: 2, dno: 2, zaobleni: 3, sloupky: false, otvor: 2.5, segmentu: 32 },
      parametry: [
        { klic: 'sx', popis: 'Délka', jednotka: 'mm', min: 10, max: 500, krok: 1 },
        { klic: 'sy', popis: 'Šířka', jednotka: 'mm', min: 10, max: 500, krok: 1 },
        { klic: 'sz', popis: 'Výška', jednotka: 'mm', min: 5, max: 500, krok: 1 },
        { klic: 'stena', popis: 'Stěna', jednotka: 'mm', min: 0.8, max: 20, krok: 0.2 },
        { klic: 'dno', popis: 'Dno', jednotka: 'mm', min: 0.6, max: 20, krok: 0.2 },
        { klic: 'zaobleni', popis: 'Zaoblení rohů', jednotka: 'mm', min: 0, max: 100, krok: 0.5 },
        { klic: 'sloupky', popis: 'Sloupky na šroubky v rozích', prepinac: true },
        { klic: 'otvor', popis: 'Díra ve sloupku ⌀ (samořezný)', jednotka: 'mm', min: 1, max: 6, krok: 0.1 }, SEG],
      obalka(p) { return { min: [-p.sx / 2, -p.sy / 2, 0], max: [p.sx / 2, p.sy / 2, p.sz] }; },
      manifold(w, p) {
        const s = sklad(), g = geomKrabice(p);
        let m = s(zaoblenyObdelnikCS(w, s, p.sx, p.sy, g.z, p.segmentu).extrude(p.sz));
        const vnitrek = s(s(zaoblenyObdelnikCS(w, s, p.sx - 2 * g.t, p.sy - 2 * g.t, Math.max(0, g.z - g.t), p.segmentu).extrude(p.sz)).translate([0, 0, g.dno]));
        m = s(m.subtract(vnitrek));
        if (p.sloupky) {
          const ro = SLOUPEK_R;
          for (const [x, y] of g.sloupky) {
            m = s(m.add(s(s(w.Manifold.cylinder(p.sz - g.dno, ro, ro, p.segmentu)).translate([x, y, g.dno]))));
            const h = Math.min(p.sz - g.dno, 3 * p.otvor + 4);
            m = s(m.subtract(s(s(w.Manifold.cylinder(h + 1, p.otvor / 2, p.otvor / 2, 24)).translate([x, y, p.sz - h]))));
          }
          // výstupky sloupků do stěn jsou uvnitř obrysu: obálku nemění
          m = s(m.intersect(s(zaoblenyObdelnikCS(w, s, p.sx, p.sy, g.z, p.segmentu).extrude(p.sz))));
        }
        return s.konec(m);
      },
    },
    vicko: {
      nazev: 'Víko', ikona: '🗃️', barva: '#c8946a', role: 'teleso', skryty: true,
      rozmerKlice: ['sx', 'sy', null],
      // tiskne se vnější plochou dolů: deska z = 0…tloušťka, lem (nasazovací) nahoře zasahuje do krabičky
      param: { sx: 60, sy: 40, stena: 2, zaobleni: 3, tloustka: 2, typ: 'nasazovaci', lem: 4, vule: 0.25, otvor: 3.2, segmentu: 32 },
      parametry: [
        { klic: 'sx', popis: 'Délka (jako krabička)', jednotka: 'mm', min: 10, max: 500, krok: 1 },
        { klic: 'sy', popis: 'Šířka (jako krabička)', jednotka: 'mm', min: 10, max: 500, krok: 1 },
        { klic: 'stena', popis: 'Stěna krabičky', jednotka: 'mm', min: 0.8, max: 20, krok: 0.2 },
        { klic: 'zaobleni', popis: 'Zaoblení rohů', jednotka: 'mm', min: 0, max: 100, krok: 0.5 },
        { klic: 'tloustka', popis: 'Tloušťka víka', jednotka: 'mm', min: 0.6, max: 20, krok: 0.2 },
        { klic: 'typ', popis: 'Upevnění', volby: [['nasazovaci', 'Nasazovací (lem)'], ['sroubky', 'Na šroubky']] },
        { klic: 'lem', popis: 'Hloubka lemu', jednotka: 'mm', min: 1, max: 50, krok: 0.5 },
        { klic: 'vule', popis: 'Vůle lemu', jednotka: 'mm', min: 0, max: 2, krok: 0.05 },
        { klic: 'otvor', popis: 'Díra na šroubek ⌀', jednotka: 'mm', min: 1, max: 8, krok: 0.1 }, SEG],
      obalka(p) {
        return { min: [-p.sx / 2, -p.sy / 2, 0], max: [p.sx / 2, p.sy / 2, p.tloustka + (p.typ === 'sroubky' ? 0 : p.lem)] };
      },
      manifold(w, p) {
        const s = sklad(), g = geomKrabice(p);
        let m = s(zaoblenyObdelnikCS(w, s, p.sx, p.sy, g.z, p.segmentu).extrude(p.tloustka));
        if (p.typ === 'sroubky') {
          const r = p.otvor / 2;
          for (const [x, y] of g.sloupky) {
            m = s(m.subtract(s(s(w.Manifold.cylinder(p.tloustka + 2, r, r, 24)).translate([x, y, -1]))));
            // zápustná hlava na vnější straně (ta leží na desce tiskárny: z = 0)
            const hk = Math.min(r, p.tloustka * 0.6);
            m = s(m.subtract(s(s(w.Manifold.cylinder(hk + 0.01, r + hk + 0.01, r, 24)).translate([x, y, -0.01]))));
          }
        } else {
          // lem: rám uvnitř krabičky (vnitřní obrys krabičky zmenšený o vůli), stěna lemu 1,6 mm
          const ax = p.sx - 2 * g.t - 2 * p.vule, ay = p.sy - 2 * g.t - 2 * p.vule, rz = Math.max(0, g.z - g.t - p.vule), sl = Math.min(1.6, Math.min(ax, ay) / 4);
          const ram = s(zaoblenyObdelnikCS(w, s, ax, ay, rz, p.segmentu).subtract(zaoblenyObdelnikCS(w, s, ax - 2 * sl, ay - 2 * sl, Math.max(0, rz - sl), p.segmentu)));
          m = s(m.add(s(s(ram.extrude(p.lem + 0.01)).translate([0, 0, p.tloustka - 0.01]))));
        }
        return s.konec(m);
      },
    },
    kalibraceVule: {
      nazev: 'Kalibrace vůlí', ikona: '🎯', barva: '#3cae5c', role: 'teleso',
      tip: 'Vytiskni a zkus kolíky vytlačit; číslo pod dírou je vůle v setinách mm (15 = 0,15 mm). Nejmenší, která povolí, ulož v Dílna → Moje vůle pro tisk.',
      // destička s dírami a kolíky tištěnými rovnou v nich (každý s jinou vůlí, hodnota vyrytá v setinách mm):
      // nejmenší vůle, u které se kolík uvolní, je ta pravá pro tvou tiskárnu (Dílna → Moje vůle pro tisk)
      param: { od: 0.1, do: 0.5, krok: 0.1, prumer: 6, tloustka: 4, segmentu: 48 },
      parametry: [
        { klic: 'od', popis: 'Vůle od', jednotka: 'mm', min: 0, max: 2, krok: 0.05 },
        { klic: 'do', popis: 'Vůle do', jednotka: 'mm', min: 0.05, max: 2, krok: 0.05 },
        { klic: 'krok', popis: 'Krok', jednotka: 'mm', min: 0.05, max: 1, krok: 0.05 },
        { klic: 'prumer', popis: 'Kolík ⌀', jednotka: 'mm', min: 2, max: 20, krok: 0.5 },
        { klic: 'tloustka', popis: 'Tloušťka destičky', jednotka: 'mm', min: 1.5, max: 20, krok: 0.5 }, SEG],
      obalka(p) { const g = geomKalibrace(p); return { min: [0, 0, 0], max: [g.X, g.Y, p.tloustka + 2] }; },
      manifold(w, p) {
        const { CrossSection, Manifold } = w, s = sklad(), g = geomKalibrace(p);
        let deska = s(Manifold.cube([g.X, g.Y, p.tloustka]));
        const koliky = [];
        g.vule.forEach((v, i) => {
          const cx = g.okraj + g.roztec * (i + 0.5), cy = g.okraj + g.Dmax / 2;
          const rd = (p.prumer / 2 + v) / Math.cos(PI / p.segmentu);   // opsaný mnohoúhelník: vůle platí i mezi vrcholy
          deska = s(deska.subtract(s(s(Manifold.cylinder(p.tloustka + 2, rd, rd, p.segmentu)).translate([cx, cy, -1]))));
          // kolík se sraženou spodní hranou (sloní noha by ho přilepila ke stěně díry)
          const k = s(s(new CrossSection([[[0, 0], [p.prumer / 2 - 0.4, 0], [p.prumer / 2, 0.4], [p.prumer / 2, p.tloustka + 2], [0, p.tloustka + 2]]])).revolve(p.segmentu));
          koliky.push(s(k.translate([cx, cy, 0])));
          // hodnota v setinách mm vyrytá pod dírou
          const txt = cisliceCS(w, s, String(Math.round(v * 100)), 3.2);
          if (txt) {
            const b = txt.bounds();
            deska = s(deska.subtract(s(s(txt.extrude(0.61)).translate([cx - (b.min[0] + b.max[0]) / 2, g.okraj + g.Dmax + 1.2 - b.min[1], p.tloustka - 0.6]))));
          }
        });
        return s.konec(s(Manifold.union([deska, ...koliky])));
      },
    },
    zavitDira: {
      nazev: 'Díra se závitem', ikona: '🕳️', barva: '#8f99a6', role: 'dira',
      param: { prumer: 20, velikost: 'M8', stoupani: 0, delka: 15, vule: 0.2, segmentu: 64 },
      parametry: [ZAVIT, PRUMER, { klic: 'delka', popis: 'Hloubka', jednotka: 'mm', min: 1, max: 500, krok: 1 }, POCET_ZAVITU, STOUP, VULE, SEG],
      obalka(p) {
        const z = zavit(p), R = z.d / 2 + p.vule;
        return { min: [-R, -R, -0.5], max: [R, R, p.delka + 0.5], kruh: true };
      },
      manifold(w, p) {
        const s = sklad(), z = zavit(p);
        // o 0,5 mm přesah na obou stranách, aby díra čistě prořízla povrch
        return s.konec(s(vnitrniZavit(w, s, z, p.vule, p.delka + 1, p.segmentu).translate([0, 0, -0.5])));
      },
    },
    diraSroub: {
      nazev: 'Díra pro šroub', ikona: '⤓', barva: '#8f99a6', role: 'dira',
      param: { velikost: 'M3', druh: 'zahloubena', delka: 10, vule: 0.2, segmentu: 48 },
      parametry: [{ klic: 'velikost', popis: 'Šroub', volby: VOLBY_ZAVITU.filter(v => v[0][0] === 'M') },
        { klic: 'druh', popis: 'Hlava', volby: [['zahloubena', 'Válcové zahloubení'], ['kuzelova', 'Kuželová 90°'], ['prosta', 'Jen díra'], ['sestihran', 'Šestihran pro matici'],
          ['vlozka', 'Závitová vložka (zatavit)'], ['samorez', 'Samořezný šroub (předvrt)']] },
        { klic: 'delka', popis: 'Hloubka', jednotka: 'mm', min: 1, max: 500, krok: 1 }, VULE, SEG],
      obalka(p) {
        const r = rozmeryDiry(p);
        const R = jenDrik(p) ? r.r : p.druh === 'kuzelova' ? r.R + 0.5 : r.R;   // kužel pokračuje 0,5 mm nad povrch
        const Ry = p.druh === 'sestihran' ? r.klic / 2 : R;
        return { min: [-R, -Ry, -0.5], max: [R, Ry, p.delka + 0.5], kruh: p.druh !== 'sestihran' };
      },
      manifold(w, p) {
        const { Manifold, CrossSection } = w, s = sklad(), r = rozmeryDiry(p);
        // dřík z 0 do hloubky, hlava nahoře (díra se zapouští shora); 0,5 mm přesah
        const drik = s(s(Manifold.cylinder(p.delka + 1, r.r, r.r, p.segmentu)).translate([0, 0, -0.5]));
        if (jenDrik(p)) return s.konec(drik);
        let hlava;
        if (p.druh === 'kuzelova') hlava = s(s(Manifold.cylinder(r.hloubka + 0.5, r.r, r.R + 0.5 * 1, p.segmentu)).translate([0, 0, p.delka - r.hloubka]));
        else if (p.druh === 'sestihran') hlava = s(s(sestihran(CrossSection, s, r.klic).extrude(r.hloubka + 0.5)).translate([0, 0, p.delka - r.hloubka]));
        else hlava = s(s(Manifold.cylinder(r.hloubka + 0.5, r.R, r.R, p.segmentu)).translate([0, 0, p.delka - r.hloubka]));
        return s.konec(s(Manifold.union([drik, hlava])));
      },
    },
    sloupek: {
      nazev: 'Sloupek pro šroub', ikona: '⏺', barva: '#7a8b99', role: 'teleso',
      param: { velikost: 'M3', druh: 'vlozka', prumer: 0, vyska: 10, dno: 0, segmentu: 48 },
      parametry: [{ klic: 'velikost', popis: 'Šroub', volby: VOLBY_ZAVITU.filter(v => v[0][0] === 'M') },
        { klic: 'druh', popis: 'Díra', volby: [['vlozka', 'Pro závitovou vložku'], ['samorez', 'Pro samořezný šroub'], ['prosta', 'Průchozí (šroub s maticí)']] },
        { klic: 'prumer', popis: 'Průměr (0 = auto)', jednotka: 'mm', min: 0, max: 100, krok: 0.5 },
        { klic: 'vyska', popis: 'Výška', jednotka: 'mm', min: 1, max: 300, krok: 1 },
        { klic: 'dno', popis: 'Plné dno', jednotka: 'mm', min: 0, max: 300, krok: 0.5 }, SEG],
      obalka(p) {
        const R = rozmerySloupku(p).R;
        return { min: [-R, -R, 0], max: [R, R, p.vyska], kruh: true };
      },
      manifold(w, p) {
        const { Manifold } = w, s = sklad(), r = rozmerySloupku(p);
        const telo = s(Manifold.cylinder(p.vyska, r.R, r.R, p.segmentu));
        const hloubka = Math.max(0, p.vyska - Math.min(p.dno, p.vyska - 0.5));
        if (hloubka < 0.2) return s.konec(telo);
        const dira = s(s(Manifold.cylinder(hloubka + 0.5, r.r, r.r, p.segmentu)).translate([0, 0, p.vyska - hloubka]));
        return s.konec(s(telo.subtract(dira)));
      },
    },
    kolo: {
      nazev: 'Ozubené kolo', ikona: '⚙️', barva: '#c9a227', role: 'teleso',
      param: { modul: 1.5, zubu: 20, druh: 'celni', vyska: 8, sklon: 20, uhelZaberu: 20, vule: 0.15, dira: 5, venec: 4, segmentu: 64 },
      parametry: [{ klic: 'druh', popis: 'Druh', volby: [['celni', 'Čelní (rovné zuby)'], ['sikme', 'Šikmé'], ['sipove', 'Šípové'], ['vnitrni', 'S vnitřním ozubením']] },
        { klic: 'modul', popis: 'Modul', jednotka: 'mm', min: 0.3, max: 20, krok: 0.25 },
        { klic: 'zubu', popis: 'Počet zubů', min: 6, max: 300, krok: 1, cele: true },
        { klic: 'vyska', popis: 'Šířka kola', jednotka: 'mm', min: 0.5, max: 500, krok: 1 },
        { klic: 'sklon', popis: 'Sklon zubů', jednotka: '°', min: 0, max: 45, krok: 5 },
        { klic: 'uhelZaberu', popis: 'Úhel záběru', jednotka: '°', min: 14.5, max: 30, krok: 0.5 },
        { klic: 'dira', popis: 'Díra (0 = bez)', jednotka: 'mm', min: 0, max: 500, krok: 0.5 },
        { klic: 'venec', popis: 'Věnec vnitřního kola', jednotka: 'mm', min: 1, max: 100, krok: 0.5 }, VULE, SEG],
      obalka(p) {
        const r = p.modul * p.zubu / 2;
        const R = p.druh === 'vnitrni' ? r + 1.25 * p.modul + p.venec
          : M.polomerHlavy(p.zubu, p.modul, p.uhelZaberu * ST, PI * p.modul / 2 - p.vule / 2, r + p.modul);
        return { min: [-R, -R, 0], max: [R, R, p.vyska], kruh: true };
      },
      manifold(w, p) {
        const { CrossSection, Manifold } = w, s = sklad();
        const m = p.modul, z = p.zubu, r = m * z / 2, alfa = p.uhelZaberu * ST;
        const kroku = Math.max(4, Math.round(p.segmentu / 12));
        const vnitrni = p.druh === 'vnitrni';
        // vnitřní kolo: dutina = „vnější kolo“ se zuby místo mezer (hlava a pata prohozené, širší zub o vůli)
        const obrys = vnitrni
          ? M.obrysKola(z, m, alfa, PI * m / 2 + p.vule / 2, r + 1.25 * m, r - m, kroku)
          : M.obrysKola(z, m, alfa, PI * m / 2 - p.vule / 2, r + m, r - 1.25 * m, kroku);
        const rez = s(new CrossSection([obrys]));
        // šikmé zuby: zkroucení h·tan β / r (rad); šípové: dvě poloviny opačně
        const zkr = h => (p.druh === 'celni' || p.druh === 'vnitrni' && !p.sklon) ? 0 : h * Math.tan(p.sklon * ST) / r / ST;
        const del = h => Math.max(1, Math.ceil(Math.abs(zkr(h)) / 2));
        let kolo;
        if (p.druh === 'sipove') {
          const h2 = p.vyska / 2;
          const a = s(rez.extrude(h2, del(h2), zkr(h2)));
          const b = s(s(s(rez.extrude(h2, del(h2), -zkr(h2))).rotate([0, 0, zkr(h2)])).translate([0, 0, h2]));
          kolo = s(Manifold.union([a, b]));
        } else kolo = s(rez.extrude(p.vyska, del(p.vyska), vnitrni ? 0 : zkr(p.vyska)));
        if (vnitrni) {
          const R = r + 1.25 * m + p.venec;
          return s.konec(s(s(Manifold.cylinder(p.vyska, R, R, Math.max(p.segmentu, z * 2))).subtract(kolo)));
        }
        if (p.dira > 0 && p.dira < 2 * (r - 1.25 * m)) kolo = s(kolo.subtract(s(s(Manifold.cylinder(p.vyska + 2, p.dira / 2, p.dira / 2, p.segmentu)).translate([0, 0, -1]))));
        return s.konec(kolo);
      },
    },
    pruzina: {
      nazev: 'Pružina', ikona: '🌀', barva: '#5b8fd9', role: 'teleso',
      param: { prumer: 12, drat: 1.5, stoupani: 4, zavitu: 6, segmentu: 64 },
      parametry: [{ klic: 'prumer', popis: 'Vnější průměr', jednotka: 'mm', min: 2, max: 500, krok: 1 },
        { klic: 'drat', popis: 'Průměr drátu', jednotka: 'mm', min: 0.3, max: 50, krok: 0.1 },
        { klic: 'stoupani', popis: 'Stoupání', jednotka: 'mm', min: 0.3, max: 200, krok: 0.5 },
        { klic: 'zavitu', popis: 'Počet závitů', min: 0.5, max: 200, krok: 0.5 }, SEG],
      obalka(p) {
        // skutečný vnější poloměr: osa drátu Rs (kvůli tloušťce drátu může být větší než průměr/2) + polovina drátu
        const d = rozmeryPruziny(p), R = d.Rs + p.drat / 2;
        return { min: [-R, -R, 0], max: [R, R, d.stoupani * p.zavitu], kruh: true };
      },
      manifold(w, p) {
        const { CrossSection } = w, s = sklad(), d = rozmeryPruziny(p);
        // trojúhelníků ≈ závity · seg² (změřeno) – rozpočet jako u závitů
        const seg = Math.max(24, Math.min(p.segmentu, Math.floor(Math.sqrt(MAX_TROJ_DILU / p.zavitu))));
        const rez = s(new CrossSection([rezPruziny(d.Rs, p.drat / 2, d.stoupani, Math.max(24, seg / 2))]));
        const h = d.stoupani * p.zavitu;
        return s.konec(s(rez.extrude(h, Math.ceil(p.zavitu * seg / 2), 360 * p.zavitu)));
      },
    },
    pant: {
      nazev: 'Pant (tisk vcelku)', ikona: '🚪', barva: '#7a8b99', role: 'teleso',
      param: { delka: 40, sirka: 15, tloustka: 2.5, prumer: 6, clanku: 5, vule: 0.4, segmentu: 48 },
      parametry: [{ klic: 'delka', popis: 'Délka', jednotka: 'mm', min: 5, max: 500, krok: 1 },
        { klic: 'sirka', popis: 'Šířka křídla', jednotka: 'mm', min: 3, max: 300, krok: 1 },
        { klic: 'tloustka', popis: 'Tloušťka křídla', jednotka: 'mm', min: 0.6, max: 50, krok: 0.2 },
        { klic: 'prumer', popis: 'Průměr kloubu', jednotka: 'mm', min: 2, max: 100, krok: 0.5 },
        { klic: 'clanku', popis: 'Počet článků', min: 3, max: 51, krok: 2, cele: true }, VULE, SEG],
      obalka(p) {
        const D = Math.max(p.prumer, p.tloustka);
        return { min: [0, -p.sirka - D / 2, 0], max: [p.delka, p.sirka + D / 2, D] };
      },
      manifold(w, p) {
        const { Manifold } = w, s = sklad();
        // nulová vůle by dala dotýkající se (nerozpojitelné) díly, příliš mnoho článků záporně dlouhé články
        const D = Math.max(p.prumer, p.tloustka), R = D / 2, c = Math.max(p.vule, 0.05);
        let n = p.clanku % 2 ? p.clanku : p.clanku + 1;
        const nMax = Math.max(3, Math.floor((p.delka + c) / (1 + c)));
        if (n > nMax) n = nMax % 2 ? nMax : nMax - 1;
        const delkaClanku = (p.delka - (n - 1) * c) / n, rCep = Math.max(0.6, R * 0.45);
        const valec = (r, x0, dx) => s(s(s(Manifold.cylinder(dx, r, r, p.segmentu)).rotate([0, 90, 0])).translate([x0, 0, R]));
        const clankyA = [], clankyB = [], volnoA = [], volnoB = [];
        for (let k = 0; k < n; k++) {
          const x0 = k * (delkaClanku + c);
          (k % 2 ? clankyB : clankyA).push(valec(R, x0, delkaClanku));
          (k % 2 ? volnoB : volnoA).push(valec(R + c, x0 - c, delkaClanku + 2 * c));
        }
        // křídlo A vlevo (−y), B vpravo (+y), mezi nimi mezera = vůle; každé se vyhne
        // kloubům toho druhého o vůli (jinak by se tělesa dotýkala a nešla od sebe)
        const kridloA = s(s(s(Manifold.cube([p.delka, p.sirka + R - c / 2, p.tloustka])).translate([0, -p.sirka - R, 0])).subtract(s(Manifold.union(volnoB))));
        const kridloB = s(s(s(Manifold.cube([p.delka, p.sirka + R - c / 2, p.tloustka])).translate([0, c / 2, 0])).subtract(s(Manifold.union(volnoA))));
        const cep = valec(rCep, 0, p.delka);
        const A = s(Manifold.union([kridloA, cep, ...clankyA]));
        const otvor = valec(rCep + c, -1, p.delka + 2);
        const B = s(s(Manifold.union([kridloB, ...clankyB])).subtract(otvor));
        return s.konec(s(Manifold.compose([A, B])));
      },
    },
    vroubek: {
      nazev: 'Vroubkovaný úchop', ikona: '🔘', barva: '#d06a3a', role: 'teleso',
      param: { prumer: 20, vyska: 15, zubu: 30, hloubka: 0.8, vzor: 'krizovy', uhel: 30, segmentu: 64 },
      parametry: [{ klic: 'vzor', popis: 'Vzor', volby: [['primy', 'Přímé drážky'], ['sikmy', 'Šikmé'], ['krizovy', 'Křížový (diamant)']] },
        { klic: 'prumer', popis: 'Průměr', jednotka: 'mm', min: 2, max: 500, krok: 1 },
        { klic: 'vyska', popis: 'Výška', jednotka: 'mm', min: 0.5, max: 500, krok: 1 },
        { klic: 'zubu', popis: 'Počet drážek', min: 6, max: 300, krok: 2, cele: true },
        { klic: 'hloubka', popis: 'Hloubka drážky', jednotka: 'mm', min: 0.1, max: 20, krok: 0.1 },
        { klic: 'uhel', popis: 'Úhel drážek', jednotka: '°', min: 5, max: 60, krok: 5 }, SEG],
      obalka(p) { const R = p.prumer / 2; return { min: [-R, -R, 0], max: [R, R, p.vyska], kruh: true }; },
      manifold(w, p) {
        const { CrossSection } = w, s = sklad();
        const R = p.prumer / 2, h = Math.min(p.hloubka, R * 0.5), n = p.zubu, b = [];
        const N = n * 4;
        for (let i = 0; i < N; i++) {                   // trojúhelníkové drážky: vrchol, dno, vrchol…
          const a = 2 * PI * i / N, r = i % 2 ? R - h : R;
          b.push([r * Math.cos(a), r * Math.sin(a)]);
        }
        const rez = s(new CrossSection([b]));
        if (p.vzor === 'primy') return s.konec(s(rez.extrude(p.vyska)));
        // dělení po výšce podle zkroucení, ale v rozpočtu trojúhelníků (tenký vroubek s 300 drážkami by počítal minuty)
        const zk = p.vyska * Math.tan(p.uhel * ST) / R / ST, del = Math.max(2, Math.min(Math.ceil(Math.abs(zk) / 2) + 1, Math.floor(MAX_TROJ_DILU / ((p.vzor === 'krizovy' ? 10 : 4) * N))));
        const a = s(rez.extrude(p.vyska, del, zk));
        if (p.vzor === 'sikmy') return s.konec(a);
        // druhé vytažení o chlup delší a s jiným dělením: vrcholy obou těles se nepotkají (jinak by průnik měl
        // nulové hrany a STL – trojúhelníky bez sdílených vrcholů – by po svaření bylo děravé)
        const e = 0.01, druhe = s(s(rez.extrude(p.vyska + 2 * e, del + 1, -zk * (p.vyska + 2 * e) / p.vyska)).translate([0, 0, -e]));
        return s.konec(s(a.intersect(druhe)));
      },
    },
    plastev: {
      nazev: 'Plástev (mřížka)', ikona: '🐝', barva: '#e0a43a', role: 'teleso',
      param: { sirka: 60, hloubka: 40, tloustka: 2, bunka: 8, stena: 1.2, okraj: 3 },
      parametry: [{ klic: 'sirka', popis: 'Šířka', jednotka: 'mm', min: 5, max: 1000, krok: 1 },
        { klic: 'hloubka', popis: 'Hloubka', jednotka: 'mm', min: 5, max: 1000, krok: 1 },
        { klic: 'tloustka', popis: 'Tloušťka', jednotka: 'mm', min: 0.2, max: 100, krok: 0.2 },
        { klic: 'bunka', popis: 'Velikost buňky', jednotka: 'mm', min: 2, max: 200, krok: 0.5 },
        { klic: 'stena', popis: 'Stěna buněk', jednotka: 'mm', min: 0.3, max: 50, krok: 0.1 },
        { klic: 'okraj', popis: 'Okraj', jednotka: 'mm', min: 0, max: 100, krok: 0.5 }],
      obalka(p) { return { min: [-p.sirka / 2, -p.hloubka / 2, 0], max: [p.sirka / 2, p.hloubka / 2, p.tloustka] }; },
      manifold(w, p) {
        const { CrossSection } = w, s = sklad();
        const W = p.sirka / 2, H = p.hloubka / 2;
        const deska = s(new CrossSection([[[-W, -H], [W, -H], [W, H], [-W, H]]]));
        const a = Math.max(0.1, p.bunka - p.stena);    // otvor (přes ploché strany) – šestiúhelník špičkou nahoru
        const Ro = a / Math.sqrt(3), dx = p.bunka, dy = p.bunka * Math.sqrt(3) / 2;
        // okraj přes celou desku: plná deska bez otvorů
        if (p.okraj * 2 >= Math.min(p.sirka, p.hloubka)) return s.konec(s(deska.extrude(p.tloustka)));
        // desítky tisíc buněk počítá clipper desítky sekund a zablokoval by výpočty
        const bunek = (2 * Math.ceil(W / dx) + 3) * (2 * Math.ceil(H / dy) + 3);
        if (bunek > 15000) throw new Error(`plástev má příliš mnoho buněk (${bunek}) – zvětši velikost buňky nebo zmenši desku`);
        const otvory = [];
        for (let j = -Math.ceil(H / dy) - 1; j <= Math.ceil(H / dy) + 1; j++)
          for (let i = -Math.ceil(W / dx) - 1; i <= Math.ceil(W / dx) + 1; i++) {
            const cx = i * dx + (j % 2 ? dx / 2 : 0), cy = j * dy, h = [];
            for (let k = 0; k < 6; k++) h.push([cx + Ro * Math.cos(PI / 2 + k * PI / 3), cy + Ro * Math.sin(PI / 2 + k * PI / 3)]);
            otvory.push(h);
          }
        const vnitrek = s(new CrossSection([[[-W + p.okraj, -H + p.okraj], [W - p.okraj, -H + p.okraj], [W - p.okraj, H - p.okraj], [-W + p.okraj, H - p.okraj]]]));
        const diry = s(s(new CrossSection(otvory)).intersect(vnitrek));
        return s.konec(s(s(deska.subtract(diry)).extrude(p.tloustka)));
      },
    },
    stitek: {
      nazev: 'Štítek se jménem', ikona: '🏷️', barva: '#3cae5c', role: 'teleso',
      param: { text: 'Jméno', font: 'libsans', velikost: 10, podklad: 2, vyskaTextu: 1, okraj: 3, zaobleni: 2, ocko: 4, cast: 'vse', kontury: [], konturyPro: '' },
      parametry: [{ klic: 'text', popis: 'Text', text: true },
        { klic: 'font', popis: 'Písmo', volby: PISMA },
        { klic: 'velikost', popis: 'Velikost písma', jednotka: 'mm', min: 2, max: 300, krok: 1 },
        { klic: 'podklad', popis: 'Tloušťka podkladu', jednotka: 'mm', min: 0.4, max: 50, krok: 0.2 },
        { klic: 'vyskaTextu', popis: 'Výška písma nad podkladem', jednotka: 'mm', min: 0.2, max: 50, krok: 0.2 },
        { klic: 'okraj', popis: 'Okraj', jednotka: 'mm', min: 0.5, max: 50, krok: 0.5 },
        { klic: 'zaobleni', popis: 'Zaoblení rohů', jednotka: 'mm', min: 0, max: 50, krok: 0.5 },
        { klic: 'ocko', popis: 'Očko na klíče (0 = bez)', jednotka: 'mm', min: 0, max: 30, krok: 0.5 },
        { klic: 'cast', popis: 'Vyrobit', volby: [['vse', 'Celý štítek'], ['podklad', 'Jen podklad (pro 2 barvy)'], ['text', 'Jen písmo (pro 2 barvy)']] }],
      obalka(p) {
        const o = rozmeryStitku(p), text = p.kontury.length > 0;
        if (p.cast === 'text' && text) return { min: [o.tx0, o.ty0, p.podklad], max: [o.tx1, o.ty1, p.podklad + p.vyskaTextu] };
        return { min: [o.x0, o.y0, 0], max: [o.x1, o.y1, p.cast === 'podklad' || !text ? p.podklad : p.podklad + p.vyskaTextu] };
      },
      manifold(w, p) {
        const { CrossSection, Manifold } = w, s = sklad(), o = rozmeryStitku(p);
        // deska jen kolem textu (obálka o.y0..o.y1 zahrnuje i vyšší očko)
        const ry0 = o.ty0 - p.okraj, ry1 = o.ty1 + p.okraj;
        const ramec = M.konturyTvaru({ typ: 'obdelnik', x: (o.zx0 + o.x1) / 2, y: (ry0 + ry1) / 2, w: o.x1 - o.zx0, h: ry1 - ry0, r: p.zaobleni }, 48)[0];
        let zaklad = s(new CrossSection([ramec]));
        if (p.ocko > 0) {
          // očko vlevo: kruh obalující otvor, sjednocený s podkladem, pak otvor
          const cx = o.x0 + p.ocko / 2 + p.okraj, cy = (o.y0 + o.y1) / 2;
          zaklad = s(zaklad.add(s(CrossSection.circle(p.ocko / 2 + p.okraj, 48)).translate([cx, cy])));
          zaklad = s(zaklad.subtract(s(s(CrossSection.circle(p.ocko / 2, 48)).translate([cx, cy]))));
        }
        const podklad = s(zaklad.extrude(p.podklad));
        // písmo zasahuje 0,01 mm do podkladu (spojí se), samotné písmo leží přesně na podkladu
        const text = p.kontury.length ? s(new CrossSection(p.kontury, 'NonZero')) : null;
        if (p.cast === 'podklad' || !text) return s.konec(podklad);
        if (p.cast === 'text') return s.konec(s(s(text.extrude(p.vyskaTextu)).translate([0, 0, p.podklad])));
        const pismo = s(s(text.extrude(p.vyskaTextu + 0.01)).translate([0, 0, p.podklad - 0.01]));
        return s.konec(s(Manifold.union([podklad, pismo])));
      },
    },
  };

  // ovinutý vzor (z SVG): obrysy (x = délka po obvodu, y = výška) ohnuté kolem osy Z na poloměr R;
  // vystouplý leží od R − 0,3 do R + hloubka (zapustí se do válce), vyrytý od R − hloubka do R + 0,3
  M.DILY.obalSvg = {
    nazev: 'Ovinutý vzor', ikona: '🌀', barva: '#e5533c', role: 'teleso', skryty: true,
    param: { kontury: [], polomer: 10, hloubka: 1, rezim: 'vystouply' },
    parametry: [
      { klic: 'rezim', popis: 'Vzor', volby: [['vystouply', 'Vystouplý'], ['vyryty', 'Vyrytý']] },
      { klic: 'hloubka', popis: 'Hloubka / výška', jednotka: 'mm', min: 0.1, max: 50, krok: 0.1 },
      { klic: 'polomer', popis: 'Poloměr válce', jednotka: 'mm', min: 1, max: 1000, krok: 0.5 }],
    obalka(p) {
      const o = rozmeryObalu(p), out = { min: [Infinity, Infinity, o.y0], max: [-Infinity, -Infinity, o.y1] };
      for (let i = 0; i <= 64; i++) {
        const a = o.a0 + (o.a1 - o.a0) * i / 64;
        for (const r of [o.r0, o.r1]) {
          const x = r * Math.cos(a), y = r * Math.sin(a);
          out.min[0] = Math.min(out.min[0], x); out.max[0] = Math.max(out.max[0], x);
          out.min[1] = Math.min(out.min[1], y); out.max[1] = Math.max(out.max[1], y);
        }
      }
      return out;
    },
    manifold(w, p) {
      const { CrossSection } = w, s = sklad(), o = rozmeryObalu(p);
      if (!p.kontury.length) throw new Error('vzor nemá žádné obrysy');
      if (o.a1 - o.a0 > 2 * PI * 0.97) throw new Error('vzor je delší než obvod válce – zmenši jeho šířku');
      const R = p.polomer;
      const rovny = s(s(s(new CrossSection(p.kontury, 'NonZero')).extrude(o.r1 - o.r0)).translate([0, 0, o.r0 - R]));
      // zjemnit, aby ohnutí sledovalo válec, pak ohnout: x → úhel (zachová délku po obvodu), z → poloměr
      const jemny = s(rovny.refineToLength(Math.max(0.2, R * 0.04)));
      return s.konec(s(jemny.warp(v => {
        const a = v[0] / R, r = R + v[2], y = v[1];
        v[0] = r * Math.cos(a); v[1] = r * Math.sin(a); v[2] = y;
      })));
    },
  };

  // ------------------------------------------------------------ pomocné rozměry
  function rozmeryObalu(p) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const k of p.kontury) for (const [x, y] of k) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (!isFinite(x0)) { x0 = -1; x1 = 1; y0 = -1; y1 = 1; }
    // vyrytí hlubší než poloměr by těleso přeložilo přes osu (naruby) – nejvýš 90 % poloměru
    const r0 = p.rezim === 'vyryty' ? p.polomer - Math.min(p.hloubka, 0.9 * p.polomer) : p.polomer - 0.3, r1 = p.rezim === 'vyryty' ? p.polomer + 0.3 : p.polomer + p.hloubka;
    return { a0: x0 / p.polomer, a1: x1 / p.polomer, y0, y1, r0, r1 };
  }
  M.rozmeryObalu = rozmeryObalu;
  function rozmeryHlavy(p, z) {
    if (p.hlava === 'zadna') return { typ: 'zadna', k: 0, R: z.d / 2 - vuleZ(p, z) / 2 };
    // imbus musí zůstat uvnitř hlavy (malý vlastní průměr)
    if (p.hlava === 'valcova') return { typ: 'valcova', k: z.d, R: 0.75 * z.d, imbus: Math.min(Math.max(1.5, Math.round(z.d) / 2), 1.2 * z.d) };
    if (p.hlava === 'zapustna') return { typ: 'zapustna', k: z.d / 2, R: z.d };          // kužel 90°: průměr 2d → d
    return { typ: 'sestihran', k: z.k, R: z.s / Math.cos(PI / 6) / 2 };
  }
  /** Klip na trubku: poloměry, úhel konce oblouku a horní mez obálky. */
  function geomKlipu(p) {
    // otevření nejvýš 150° (širší ústí trubku nesevře)
    const Ri = (p.prumer + p.vule) / 2, Ro = Ri + p.stena, rc = Ri + p.stena / 2, a = (90 - Math.min(p.otevreni, 150) / 2) * ST;
    return { Ri, Ro, rc, a, ymax: rc * Math.sin(a) + p.stena / 2 };
  }
  /** Zacvakávací čep: profil (r, z) pro rotaci, poloměry a výšky. */
  function geomCepu(p) {
    const D = p.prumerDiry, rs = D / 2 - Math.min(p.vule, 0.4 * D / 2), hh = p.hlava, T = p.tloustkaDesky;
    // přesah ozubu jen takový, aby ho prořez dovolil stlačit (prořez nejvýš 0,9 dříku)
    const sl = Math.min(rs * 0.9, 2 * p.presah + 0.6), presah = Math.max(0.05, Math.min(p.presah, (sl - 0.3) / 2));
    const rb = D / 2 + presah, rh = Math.max(D / 2 + Math.max(1.2, D * 0.3), rb), rt = Math.max(0.4, D / 2 * 0.65), bl = Math.max(1.5, D * 0.9), Z = hh + T + bl;
    const prof = [[0, 0], [rh, 0], [rh, hh], [rs, hh], [rs, hh + T + 0.1], [rb, hh + T + 0.25], [rt, Z], [0, Z]];
    return { prof, rh, rs, Z, zs: hh + T * 0.35, sl };
  }
  /** Krabička / víko: zaoblení, stěna, dno a středy sloupků (sloupek poloměru SLOUPEK_R zapuštěný do rohu). */
  const SLOUPEK_R = 3;
  M.geomKrabice = p => geomKrabice(p);
  function geomKrabice(p) {
    const t = Math.min(p.stena, 0.3 * Math.min(p.sx, p.sy)), z = Math.min(p.zaobleni, 0.499 * Math.min(p.sx, p.sy));
    let c = t + SLOUPEK_R * 0.75;                        // střed sloupku od vnějšího kraje
    // velké zaoblení rohu: sloupek po úhlopříčce dovnitř, ať je celý uvnitř zaoblené stěny
    if (z > c) c = Math.max(c, z - (z - t - SLOUPEK_R * 0.75) / Math.SQRT2);
    const sloupky = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => [a * (p.sx / 2 - c), b * (p.sy / 2 - c)]);
    return { t, z, dno: Math.min(p.dno == null ? 2 : p.dno, (p.sz || 10) * 0.8), sloupky };
  }
  /** Zaoblený obdélník se středem v počátku jako CrossSection. */
  function zaoblenyObdelnikCS(w, s, sx, sy, r, seg) {
    const C = w.CrossSection;
    r = Math.min(r, 0.499 * Math.min(sx, sy));
    if (r <= 1e-6) return s(C.square([sx, sy], true));
    return s(s(C.square([sx - 2 * r, sy - 2 * r], true)).offset(r, 'Round', 2, Math.max(16, seg)));
  }
  /** Kalibrační destička: seznam vůlí, rozteč děr a rozměry. */
  function geomKalibrace(p) {
    const a = Math.min(p.od, p.do), b = Math.max(p.od, p.do), k = Math.max(0.05, p.krok);
    const vule = [];
    for (let v = a; v <= b + 1e-9 && vule.length < 12; v += k) vule.push(Math.round(v * 1000) / 1000);
    const Dmax = p.prumer + 2 * vule[vule.length - 1], okraj = 3, roztec = Dmax + 4;
    return { vule, Dmax, okraj, roztec, X: 2 * okraj + roztec * vule.length, Y: 2 * okraj + Dmax + 6 };
  }
  /** Číslice sedmisegmentovým písmem (výška h) jako CrossSection, nebo null. */
  const SEGMENTY = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  function cisliceCS(w, s, text, h) {
    const C = w.CrossSection, sw = h * 0.6, t = h * 0.16, kusy = [];
    const seg = { a: [0, h - t, sw, t], b: [sw - t, h / 2, t, h / 2], c: [sw - t, 0, t, h / 2], d: [0, 0, sw, t], e: [0, 0, t, h / 2], f: [0, h / 2, t, h / 2], g: [0, h / 2 - t / 2, sw, t] };
    [...text].forEach((ch, i) => {
      for (const k of SEGMENTY[ch] || '') { const [x, y, a, b] = seg[k]; kusy.push(s(s(C.square([a, b])).translate([x + i * (sw + t * 1.5), y]))); }
    });
    return kusy.length ? s(C.union(kusy)) : null;
  }
  /** Krabička s víkem: parametry obou dílů a posun víka vedle krabičky. */
  function rozlozeniKrabice(p) {
    const spol = { sx: p.sx, sy: p.sy, stena: p.stena, zaobleni: p.zaobleni, segmentu: p.segmentu };
    const krabice = Object.assign({}, M.DILY.krabice.param, spol, { sz: p.sz, dno: p.dno, sloupky: p.typ === 'sroubky' });
    // lem víka nejvýš do 80 % dutiny (nízká krabička by jinak víko nepustila dosednout)
    const vicko = Object.assign({}, M.DILY.vicko.param, spol, { typ: p.typ, vule: p.vule, lem: Math.round(M.omez(0.8 * (p.sz - p.dno), 1, 4) * 100) / 100 });
    return { krabice, vicko, dx: p.sx + 8 };
  }
  M.rozlozeniKrabice = rozlozeniKrabice;

  /** Obrys háčku S naplocho (XY, mm): střednice z horního oblouku (trubka prumerHorni, otevřený dolů vpravo),
      svislého krčku a dolního oblouku (prumerDolni, otevřený nahoru vlevo), kolem ní pás šířky tloustka. */
  function obrysHakuS(p) {
    const t = p.tloustka, seg = Math.max(8, p.segmentu);
    const rc1 = (p.prumerHorni + p.vule) / 2 + t / 2, rc2 = (p.prumerDolni + p.vule) / 2 + t / 2;
    const th = p.zahnuti * ST, yt = p.rovna, n1 = Math.max(8, Math.ceil(seg / 2 * (PI + th) / PI)), cara = [];
    // horní špička (rovně ve směru oblouku), oblouk od −zahnutí přes vršek k levé straně (x = 0)
    const a1 = -th;
    const P1 = [rc1 + rc1 * Math.cos(a1), yt + rc1 * Math.sin(a1)], d1 = [-Math.sin(a1), Math.cos(a1)];
    // zahnutá špička míří ke krčku: nejvýš tak dlouhá, aby mezi ní a krčkem zůstala aspoň šířka drátu
    const maxL = th > 1e-6 ? Math.max(0, (P1[0] - 1.5 * t) / Math.sin(th)) : Infinity;
    const L1 = Math.min((p.spicka / 100) * (rc1 - t / 2), maxL);
    if (L1 > 1e-6) cara.push([P1[0] - d1[0] * L1, P1[1] - d1[1] * L1]);
    for (let i = 0; i <= n1; i++) { const a = a1 + (PI - a1) * i / n1; cara.push([rc1 + rc1 * Math.cos(a), yt + rc1 * Math.sin(a)]); }
    // dolní oblouk od pravé strany (x = 0) dolů a doleva nahoru až za vodorovnou o zahnutí
    const a2 = -PI - th, n2 = Math.max(8, Math.ceil(seg / 2 * (PI + th) / PI));
    for (let i = p.rovna > 1e-6 ? 0 : 1; i <= n2; i++) { const a = a2 * i / n2; cara.push([-rc2 + rc2 * Math.cos(a), rc2 * Math.sin(a)]); }
    const d2 = [Math.sin(a2), -Math.cos(a2)], P2 = cara[cara.length - 1];
    const maxL2 = th > 1e-6 ? Math.max(0, (-P2[0] - 1.5 * t) / Math.sin(th)) : Infinity;
    const L2 = Math.min((p.spicka / 100) * (rc2 - t / 2), maxL2);
    if (L2 > 1e-6) cara.push([P2[0] + d2[0] * L2, P2[1] + d2[1] * L2]);
    const body = M.pasKolemCary(cara, t);
    let pl = 0;
    for (let i = 0; i < body.length; i++) { const a = body[i], b = body[(i + 1) % body.length]; pl += a[0] * b[1] - b[0] * a[1]; }
    if (pl < 0) body.reverse();
    const min = [Infinity, Infinity], max = [-Infinity, -Infinity];
    for (const b of body) for (let k = 0; k < 2; k++) { min[k] = Math.min(min[k], b[k]); max[k] = Math.max(max[k], b[k]); }
    return { body, min, max, stredy: [[rc1, yt], [-rc2, 0]], vnitrni: [rc1 - t / 2, rc2 - t / 2] };
  }
  M.obrysHakuS = obrysHakuS;

  /** Sražení vstupu vnitřního závitu z obou stran (45° kužel do hloubky závitu): šroub chytí bez hledání. */
  function srazVstupy(w, s, m, z, vule, h, seg, rMax = Infinity) {
    const { Manifold } = w;
    const rn = z.d / 2 + vule, rf = Math.min(rn + 0.25, rMax), rv = Math.max(0.1, rn - hloubkaZavitu(z)), hc = Math.min(rf - rv, h * 0.3);
    const dole = s(s(Manifold.cylinder(hc + 0.02, rf + 0.02, rf - hc, seg)).translate([0, 0, -0.02]));
    const nahore = s(s(Manifold.cylinder(hc + 0.02, rf - hc, rf + 0.02, seg)).translate([0, 0, h - hc]));
    return s(s(m.subtract(dole)).subtract(nahore));
  }
  /** Sada šroub + matice jako dva samostatné uzly (šroub a vedle něj matice se sladěnou vůlí a sraženým
      vstupem). prepis = jako pro novyUzel('sadaSroub'): poloha (střed sady), rotace (rovina), param. */
  M.uzlySadySroubu = function (prepis = {}, dok = { uzly: [] }) {
    const p = Object.assign({}, M.DILY.sadaSroub.param, prepis.param || {});
    const r = rozlozeniSady(p), sada = M.novyUzel('sadaSroub', Object.assign({}, prepis, { param: p }), dok);
    const a = M.DILY.sroub.obalka(r.sroub), b = M.DILY.matice.obalka(r.matice);
    const xs = (a.min[0] + r.dx + b.max[0]) / 2;                    // střed sady v jejích souřadnicích
    const q = M.quatUzlu(sada);
    /** Poloha středu dílu: posun podél osy X sady, spodek na spodku sady. */
    const poloha = (cx, h) => {
      const o = new THREE.Vector3(cx - xs, 0, h / 2 - sada.rozmer[2] / 2).applyQuaternion(q);
      return [sada.poloha[0] + o.x, sada.poloha[1] + o.y, sada.poloha[2] + o.z].map(v => Math.round(v * 1e6) / 1e6);
    };
    const sroub = M.novyUzel('sroub', { param: r.sroub, rotace: sada.rotace.slice(),
      poloha: poloha((a.min[0] + a.max[0]) / 2, a.max[2] - a.min[2]) }, dok);
    const matice = M.novyUzel('matice', { param: r.matice, rotace: sada.rotace.slice(),
      poloha: poloha(r.dx + (b.min[0] + b.max[0]) / 2, b.max[2] - b.min[2]) }, M.pridejUzly(dok, [sroub]));
    const vazba = 'v' + M.noveId();
    return [Object.assign(sroub, { vazba }), Object.assign(matice, { vazba })];
  };

  /** Krabička s víkem jako dva propojené uzly (víko vedle krabičky, vnější plochou dolů). */
  M.uzlyKrabice = function (prepis = {}, dok = { uzly: [] }) {
    const p = Object.assign({}, M.DILY.krabiceSVikem.param, prepis.param || {});
    const r = rozlozeniKrabice(p), sada = M.novyUzel('krabiceSVikem', Object.assign({}, prepis, { param: p }), dok);
    const a = M.DILY.krabice.obalka(r.krabice), b = M.DILY.vicko.obalka(r.vicko);
    const xs = (a.min[0] + r.dx + b.max[0]) / 2, q = M.quatUzlu(sada);
    const poloha = (cx, h) => {
      const o = new THREE.Vector3(cx - xs, 0, h / 2 - sada.rozmer[2] / 2).applyQuaternion(q);
      return [sada.poloha[0] + o.x, sada.poloha[1] + o.y, sada.poloha[2] + o.z].map(v => Math.round(v * 1e6) / 1e6);
    };
    const vazba = 'v' + M.noveId();
    const k = M.novyUzel('krabice', { param: r.krabice, rotace: sada.rotace.slice(), poloha: poloha(0, a.max[2]), vazba }, dok);
    const v = M.novyUzel('vicko', { param: r.vicko, rotace: sada.rotace.slice(), poloha: poloha(r.dx, b.max[2]), vazba }, M.pridejUzly(dok, [k]));
    return [k, v];
  };

  /** Sada šroub + matice: parametry obou dílů a posun matice vedle šroubu (mezera 3 mm, aspoň půl průměru). */
  function rozlozeniSady(p) {
    const v = Math.max(0, p.vule || 0);
    const sroub = { velikost: p.velikost, prumer: p.prumer, stoupani: p.stoupani, delka: p.delka, hlava: p.hlava, vule: 0.8 * v, segmentu: p.segmentu };
    const matice = { velikost: p.velikost, prumer: p.prumer, stoupani: p.stoupani, vyska: 0, vule: 0.6 * v, srazeni: true, segmentu: p.segmentu };
    const a = M.DILY.sroub.obalka(sroub), b = M.DILY.matice.obalka(matice), z = zavit(p);
    return { sroub, matice, dx: a.max[0] + Math.max(3, z.d / 2) - b.min[0] };
  }
  M.rozlozeniSady = rozlozeniSady;
  /** Vnitřní závit (pro odečtení): stejný profil jako šroub, radiálně posunutý o vůli,
      takže šroub se stejnou vůlí má mezeru 1,5 × vůle na průměru i na bocích. */
  function vnitrniZavit(w, s, z, vule, delka, seg) {
    const rMaj = z.d / 2 + vule, hloubka = hloubkaZavitu(z);
    return zavitovaTyc(w, s, rMaj, hloubka, z.p, delka, z.uhel, seg, false);
  }
  // závitové vložky do plastu (heat-set, zatavují se pájkou): průměr díry a délka vložky podle velikosti
  const VLOZKY = { M2: [3.2, 4], 'M2.5': [3.6, 5], M3: [4.0, 5.7], M4: [5.6, 8.1], M5: [6.4, 9.5], M6: [8.0, 12.7], M8: [9.7, 12.7] };
  M.VLOZKY = VLOZKY;
  function rozmeryDiry(p) {
    const z = zavit(p);
    // díra bez hlavy: pro závitovou vložku (průměr podle vložky) nebo pro samořezný šroub (předvrt ~ 0,85 d)
    if (p.druh === 'vlozka') { const v = VLOZKY[p.velikost]; const r = (v ? v[0] : z.d * 1.33) / 2; return { r, R: r, hloubka: 0, vlozka: v ? v[1] : z.d * 1.9 }; }
    if (p.druh === 'samorez') { const r = 0.85 * z.d / 2; return { r, R: r, hloubka: 0 }; }
    const r = z.d / 2 + Math.max(p.vule, 0.1) + 0.1;
    // hlava nejvýš do hloubky díry (jinak by zahloubení prořízlo těleso pod zadanou hloubkou)
    const h = x => p.delka > 0 ? Math.min(x, p.delka) : x;
    if (p.druh === 'kuzelova') { const hl = h(z.d / 2 + p.vule); return { r, R: Math.min(z.d + p.vule, r + hl), hloubka: hl }; }
    if (p.druh === 'sestihran') return { r, R: (z.s + 2 * p.vule) / Math.cos(PI / 6) / 2, klic: z.s + 2 * p.vule, hloubka: h(z.m + 0.2) };
    return { r, R: 0.75 * z.d + p.vule + 0.3, hloubka: h(z.d + 0.4) };
  }
  M.rozmeryDiry = rozmeryDiry;
  /** Sloupek: díra jako u díry pro šroub (průchozí s vůlí), vnější průměr automaticky – stěna aspoň 1,6 mm
      a 2,2× průměr díry. */
  function rozmerySloupku(p) {
    const r = rozmeryDiry({ velikost: p.velikost, druh: p.druh === 'prosta' ? 'prosta' : p.druh, vule: 0.2 }).r;
    const auto = Math.max(r + 1.6, 1.1 * 2 * r);
    return { r, R: Math.max(p.prumer > 0 ? p.prumer / 2 : auto, r + 0.4) };
  }
  M.rozmerySloupku = rozmerySloupku;
  /** Díra bez hlavy (jen válec): prostá, pro vložku, pro samořezný šroub. */
  const jenDrik = p => p.druh === 'prosta' || p.druh === 'vlozka' || p.druh === 'samorez';

  /** Protikolo k ozubenému kolu u: z2 zubů, stejný modul, úhel záběru, šířka a vůle, v osové vzdálenosti
      m·(z1 + z2)/2. Počítá se v rámci kola 1 (osa dílu = počátek), takže zrcadlení i zvětšení kola se přenese samo.
      Směr β kolem osy: první, ve kterém nové kolo nenarazí do jiného tělesa v dokumentu (0°, 90°, 180°…);
      fáze 180° + 180°/z2 + β·z1/z2 (kolo 1 má zub na 0°), šikmé a šípové zuby protikola zrcadlené (opačné
      stoupání). Vrací nový uzel, nebo null (vnitřní ozubení, nerovnoměrně roztažené kolo). */
  M.protikolo = function (u, z2, dok) {
    if (!u || u.druh !== 'kolo' || u.param.druh === 'vnitrni') return null;
    const sk = M.meritkoUzlu(u);
    if (Math.abs(sk[0] - sk[1]) > 1e-6 * Math.max(1, sk[0])) return null;      // eliptické kolo nezabírá
    const p = u.param, n = Math.max(6, Math.min(300, Math.round(z2)));
    const a = p.modul * (p.zubu + n) / 2;
    const vzor = M.novyUzel('kolo', { param: Object.assign({}, p, { zubu: n }), barva: u.barva }, dok);
    const V3 = THREE.Vector3, M4 = THREE.Matrix4;
    const F1 = M.maticeUzlu(u).multiply(new M4().makeTranslation(...u.stred.map(x => -x)));   // rámec osy kola 1
    const zrc = p.druh === 'sikme' || p.druh === 'sipove';
    const ostatni = dok ? dok.uzly.filter(x => x.id !== u.id && !x.skryto).map(x => M.obalkaUzlu(x)) : [];
    let nejlepsi = null;
    for (const beta of [0, 90, 180, 270, 45, 135, 225, 315, 30, 60, 120, 150, 210, 240, 300, 330]) {
      const L = new M4().makeRotationZ(beta * Math.PI / 180)
        .multiply(new M4().makeTranslation(a, 0, 0))
        .multiply(new M4().makeRotationZ((180 + 180 / n + beta * p.zubu / n) * Math.PI / 180))
        .multiply(new M4().makeScale(1, zrc ? -1 : 1, 1));
      const W2 = F1.clone().multiply(L).multiply(new M4().makeTranslation(...vzor.stred));
      const pos = new V3(), q = new THREE.Quaternion(), sc = new V3();
      W2.decompose(pos, q, sc);
      const k2 = M.normalizujUzel(Object.assign({}, vzor, {
        poloha: pos.toArray().map(x => Math.round(x * 1e6) / 1e6), rotace: M.rotaceZQuat(q),
        zrcadlo: [sc.x < 0, sc.y < 0, sc.z < 0], rozmer: vzor.zaklad.map((r, i) => Math.round(r * Math.abs(sc.getComponent(i)) * 1e6) / 1e6),
      }));
      if (!nejlepsi) nejlepsi = k2;
      const o = M.obalkaUzlu(k2);
      if (!ostatni.some(b => [0, 1, 2].every(i => o.min[i] < b.max[i] - 1e-3 && o.max[i] > b.min[i] + 1e-3))) return k2;
    }
    return nejlepsi;
  };
  /** Pružina: poloměr osy drátu a stoupání omezené tak, aby se závity nedotýkaly. */
  function rozmeryPruziny(p) {
    const Rs = Math.max(p.prumer / 2 - p.drat / 2, p.drat * 0.6);
    const sklon = Math.atan(p.stoupani / (2 * PI * Rs));
    const min = p.drat / Math.cos(sklon) * 1.05;
    return { Rs, stoupani: Math.max(p.stoupani, min) };
  }
  M.rozmeryPruziny = rozmeryPruziny;
  /** Řez šroubovou trubkou rovinou z = 0 (přibližně elipsa ohnutá podél kružnice). */
  function rezPruziny(Rs, rd, stoupani, kroku) {
    const sklon = Math.atan(stoupani / (2 * PI * Rs));
    const hv = rd / Math.cos(sklon);                  // svislá poloosa řezu trubky v rovině s osou
    const psiMax = hv * 2 * PI / stoupani;
    const vnejsi = [], vnitrni = [];
    for (let i = 0; i <= kroku; i++) {
      const psi = -psiMax + 2 * psiMax * i / kroku;
      const dz = stoupani * psi / (2 * PI);
      const sirka = rd * Math.sqrt(Math.max(0, 1 - (dz / hv) ** 2));
      vnejsi.push([(Rs + sirka) * Math.cos(psi), (Rs + sirka) * Math.sin(psi)]);
      vnitrni.push([(Rs - sirka) * Math.cos(psi), (Rs - sirka) * Math.sin(psi)]);
    }
    return vnejsi.concat(vnitrni.reverse().slice(1, -1));
  }
  function rozmeryStitku(p) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const k of p.kontury) for (const [x, y] of k) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (!isFinite(x0)) { x0 = -p.velikost; x1 = p.velikost; y0 = -p.velikost / 2; y1 = p.velikost / 2; }
    const zx0 = x0 - p.okraj, zx1 = x1 + p.okraj;
    const levy = p.ocko > 0 ? zx0 - p.ocko - p.okraj : zx0;
    // očko (kruh o poloměru ocko/2 + okraj uprostřed výšky) může být vyšší než text s okrajem
    const cy = (y0 + y1) / 2, ro = p.ocko > 0 ? p.ocko / 2 + p.okraj : 0;
    return { x0: levy, x1: zx1, y0: Math.min(y0 - p.okraj, cy - ro), y1: Math.max(y1 + p.okraj, cy + ro), zx0: p.ocko > 0 ? levy + p.ocko / 2 + p.okraj : zx0,
             tx0: x0, tx1: x1, ty0: y0, ty1: y1 };
  }

  // ------------------------------------------------------------ uzly dílů
  M.jeDil = druh => !!M.DILY[druh];

  /** Opraví parametry dílu podle katalogu (volby, přepínače, text, kontury štítku). */
  M.normalizujParamDilu = function (druh, p) {
    const d = M.DILY[druh], z = {};
    p = p || {};
    for (const [k, v] of Object.entries(d.param)) z[k] = v;
    for (const q of d.parametry) {
      if (q.odvozeny) continue;                       // odvozené pole (počet závitů) nemá vlastní hodnotu
      if (q.volby) { z[q.klic] = q.volby.some(v => v[0] === p[q.klic]) ? p[q.klic] : d.param[q.klic]; continue; }
      if (q.text) { z[q.klic] = typeof p[q.klic] === 'string' ? p[q.klic].slice(0, 200) : d.param[q.klic]; continue; }
      if (q.prepinac) { z[q.klic] = M.prepinac ? M.prepinac(p[q.klic], !!d.param[q.klic]) : typeof p[q.klic] === 'boolean' ? p[q.klic] : !!d.param[q.klic]; continue; }
      let v = typeof p[q.klic] === 'number' && isFinite(p[q.klic]) ? p[q.klic] : d.param[q.klic];
      if (q.cele) v = Math.round(v);
      z[q.klic] = M.omez(v, q.min, q.max);
    }
    if (druh === 'stitek' || druh === 'obalSvg') {
      z.kontury = (Array.isArray(p.kontury) ? p.kontury : []).map(k => (Array.isArray(k) ? k : []).filter(b => Array.isArray(b) && isFinite(b[0]) && isFinite(b[1])).map(b => [M.omez(+b[0], -1e5, 1e5), M.omez(+b[1], -1e5, 1e5)])).filter(k => k.length >= 3);
      z.konturyPro = typeof p.konturyPro === 'string' ? p.konturyPro : '';
    }
    return z;
  };

  /** Střed a velikost dílu (přirozené souřadnice) z analytické obálky. */
  M.rozmeryDilu = function (druh, p) {
    const o = M.DILY[druh].obalka(p), r = x => Math.round(x * 1e6) / 1e6;
    return { stred: [0, 1, 2].map(k => r((o.min[k] + o.max[k]) / 2)), zaklad: [0, 1, 2].map(k => Math.max(0.01, r(o.max[k] - o.min[k]))) };
  };

  /** Body pro obálku dílu (kruhové díly jako kružnice, aby otočený díl měl těsnou obálku). */
  M.bodyObalkyDilu = function (druh, p) {
    const o = M.DILY[druh].obalka(p), out = [];
    if (o.kruh) {
      const R = (o.max[0] - o.min[0]) / 2, cx = (o.max[0] + o.min[0]) / 2, cy = (o.max[1] + o.min[1]) / 2;
      for (let i = 0; i < 32; i++) for (const z of [o.min[2], o.max[2]]) out.push(cx + R * Math.cos(2 * PI * i / 32), cy + R * Math.sin(2 * PI * i / 32), z);
    } else for (let i = 0; i < 8; i++) out.push(i & 1 ? o.max[0] : o.min[0], i & 2 ? o.max[1] : o.min[1], i & 4 ? o.max[2] : o.min[2]);
    return new Float32Array(out);
  };

  /** Manifold dílu v přirozených souřadnicích. */
  M.manifoldDilu = function (w, druh, p) {
    let m;
    sklady = [];
    try { m = M.DILY[druh].manifold(w, p); }
    catch (e) {
      for (const vse of sklady) for (const x of vse) { try { x.delete(); } catch (z) { /* už smazané */ } }
      throw e;
    } finally { sklady = null; }
    if (m.status && m.status() !== 'NoError') { const st = m.status(); m.delete(); throw new Error('díl se nepodařilo spočítat (' + st + ')'); }
    if (m.isEmpty()) { m.delete(); throw new Error('díl je prázdný – zkontroluj rozměry'); }
    return m;
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);

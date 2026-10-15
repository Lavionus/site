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
  const VOLBY_ZAVITU = Object.keys(ZAVITY).map(k => [k, k.replace('.', ',')]);
  /** Údaje závitu (stoupání 0 = podle normy). */
  function zavit(p) {
    const z = ZAVITY[p.velikost] || ZAVITY.M8;
    return { d: z[0], p: p.stoupani > 0 ? p.stoupani : z[1], uhel: z[2], s: z[3], k: z[4], m: z[5] };
  }
  M.udajeZavitu = zavit;

  /** Radiální hloubka závitu: 0,6134 p (metrický a UN 60°), 0,640 p (Whitworth 55°). */
  // u vlastního velkého stoupání by profil prošel osou (záporný poloměr) – nejvýš 80 % poloměru
  const hloubkaZavitu = z => Math.min((z.uhel === 55 ? 0.640 : 0.6134) * z.p, 0.8 * z.d / 2);

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
    const N = Math.max(24, Math.min(Math.max(48, seg), Math.floor(Math.sqrt(MAX_TROJ_DILU / Math.max(otacek, 1e-6)))));
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
  const STOUP = { klic: 'stoupani', popis: 'Stoupání (0 = norma)', jednotka: 'mm', min: 0, max: 10, krok: 0.05 };
  const PISMA = [['libsans', 'Liberation Sans Bold'], ['bebas', 'Bebas Neue'], ['anton', 'Anton'], ['archivo', 'Archivo Black'],
    ['russo', 'Russo One'], ['alfaslab', 'Alfa Slab One'], ['bungee', 'Bungee'], ['titan', 'Titan One'], ['righteous', 'Righteous'],
    ['luckiest', 'Luckiest Guy'], ['saira', 'Saira Stencil One'], ['blackops', 'Black Ops One']];

  M.DILY = {
    sroub: {
      nazev: 'Šroub', ikona: '🔩', barva: '#9aa4ae', role: 'teleso',
      param: { velikost: 'M8', stoupani: 0, delka: 20, hlava: 'sestihran', vule: 0.1, segmentu: 64 },
      parametry: [ZAVIT, { klic: 'delka', popis: 'Délka dříku', jednotka: 'mm', min: 1, max: 500, krok: 1 },
        { klic: 'hlava', popis: 'Hlava', volby: [['sestihran', 'Šestihranná'], ['valcova', 'Válcová s imbusem'], ['zapustna', 'Zápustná 90°'], ['zadna', 'Bez hlavy (tyč)']] },
        STOUP, VULE, SEG],
      obalka(p) {
        const z = zavit(p), hl = rozmeryHlavy(p, z);
        const R = Math.max(z.d / 2, hl.R), Ry = hl.typ === 'sestihran' ? Math.max(z.d / 2, z.s / 2) : R;   // šestihran: v Y přes plošky
        return { min: [-R, -Ry, 0], max: [R, Ry, hl.k + p.delka], kruh: hl.typ !== 'sestihran' };
      },
      manifold(w, p) {
        const { CrossSection, Manifold } = w, s = sklad();
        const z = zavit(p), hl = rozmeryHlavy(p, z);
        const rMaj = z.d / 2 - p.vule / 2, hloubka = hloubkaZavitu(z);
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
      param: { velikost: 'M8', stoupani: 0, vyska: 0, vule: 0.2, segmentu: 64 },
      parametry: [ZAVIT, { klic: 'vyska', popis: 'Výška (0 = norma)', jednotka: 'mm', min: 0, max: 200, krok: 0.5 }, STOUP, VULE, SEG],
      obalka(p) {
        const z = zavit(p), R = z.s / Math.cos(PI / 6) / 2, h = p.vyska > 0 ? p.vyska : z.m;
        return { min: [-R, -z.s / 2, 0], max: [R, z.s / 2, h] };
      },
      manifold(w, p) {
        const { CrossSection } = w, s = sklad();
        const z = zavit(p), h = p.vyska > 0 ? p.vyska : z.m;
        const telo = srazSestihran(w, s, s(sestihran(CrossSection, s, z.s).extrude(h)), z.s, h, p.segmentu);
        const otvor = vnitrniZavit(w, s, z, p.vule, h, p.segmentu);
        return s.konec(s(telo.subtract(otvor)));
      },
    },
    zavitDira: {
      nazev: 'Díra se závitem', ikona: '🕳️', barva: '#8f99a6', role: 'dira',
      param: { velikost: 'M8', stoupani: 0, delka: 15, vule: 0.2, segmentu: 64 },
      parametry: [ZAVIT, { klic: 'delka', popis: 'Hloubka', jednotka: 'mm', min: 1, max: 500, krok: 1 }, STOUP, VULE, SEG],
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
        { klic: 'druh', popis: 'Hlava', volby: [['zahloubena', 'Válcové zahloubení'], ['kuzelova', 'Kuželová 90°'], ['prosta', 'Jen díra'], ['sestihran', 'Šestihran pro matici']] },
        { klic: 'delka', popis: 'Hloubka', jednotka: 'mm', min: 1, max: 500, krok: 1 }, VULE, SEG],
      obalka(p) {
        const r = rozmeryDiry(p);
        const R = p.druh === 'prosta' ? r.r : p.druh === 'kuzelova' ? r.R + 0.5 : r.R;   // kužel pokračuje 0,5 mm nad povrch
        const Ry = p.druh === 'sestihran' ? r.klic / 2 : R;
        return { min: [-R, -Ry, -0.5], max: [R, Ry, p.delka + 0.5], kruh: p.druh !== 'sestihran' };
      },
      manifold(w, p) {
        const { Manifold, CrossSection } = w, s = sklad(), r = rozmeryDiry(p);
        // dřík z 0 do hloubky, hlava nahoře (díra se zapouští shora); 0,5 mm přesah
        const drik = s(s(Manifold.cylinder(p.delka + 1, r.r, r.r, p.segmentu)).translate([0, 0, -0.5]));
        if (p.druh === 'prosta') return s.konec(drik);
        let hlava;
        if (p.druh === 'kuzelova') hlava = s(s(Manifold.cylinder(r.hloubka + 0.5, r.r, r.R + 0.5 * 1, p.segmentu)).translate([0, 0, p.delka - r.hloubka]));
        else if (p.druh === 'sestihran') hlava = s(s(sestihran(CrossSection, s, r.klic).extrude(r.hloubka + 0.5)).translate([0, 0, p.delka - r.hloubka]));
        else hlava = s(s(Manifold.cylinder(r.hloubka + 0.5, r.R, r.R, p.segmentu)).translate([0, 0, p.delka - r.hloubka]));
        return s.konec(s(Manifold.union([drik, hlava])));
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
        const zk = p.vyska * Math.tan(p.uhel * ST) / R / ST, del = Math.max(2, Math.min(Math.ceil(Math.abs(zk) / 2) + 1, Math.floor(MAX_TROJ_DILU / (4 * N))));
        const a = s(rez.extrude(p.vyska, del, zk));
        if (p.vzor === 'sikmy') return s.konec(a);
        return s.konec(s(a.intersect(s(rez.extrude(p.vyska, del, -zk)))));
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
    if (p.hlava === 'zadna') return { typ: 'zadna', k: 0, R: z.d / 2 };
    if (p.hlava === 'valcova') return { typ: 'valcova', k: z.d, R: 0.75 * z.d, imbus: Math.max(1.5, Math.round(z.d) / 2) };
    if (p.hlava === 'zapustna') return { typ: 'zapustna', k: z.d / 2, R: z.d };          // kužel 90°: průměr 2d → d
    return { typ: 'sestihran', k: z.k, R: z.s / Math.cos(PI / 6) / 2 };
  }
  /** Vnitřní závit (pro odečtení): stejný profil jako šroub, radiálně posunutý o vůli,
      takže šroub se stejnou vůlí má mezeru 1,5 × vůle na průměru i na bocích. */
  function vnitrniZavit(w, s, z, vule, delka, seg) {
    const rMaj = z.d / 2 + vule, hloubka = hloubkaZavitu(z);
    return zavitovaTyc(w, s, rMaj, hloubka, z.p, delka, z.uhel, seg, false);
  }
  function rozmeryDiry(p) {
    const z = zavit(p), r = z.d / 2 + Math.max(p.vule, 0.1) + 0.1;
    if (p.druh === 'kuzelova') return { r, R: z.d + p.vule, hloubka: z.d / 2 + p.vule };
    if (p.druh === 'sestihran') return { r, R: (z.s + 2 * p.vule) / Math.cos(PI / 6) / 2, klic: z.s + 2 * p.vule, hloubka: z.m + 0.2 };
    return { r, R: 0.75 * z.d + p.vule + 0.3, hloubka: z.d + 0.4 };
  }
  M.rozmeryDiry = rozmeryDiry;
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
      if (q.volby) { z[q.klic] = q.volby.some(v => v[0] === p[q.klic]) ? p[q.klic] : d.param[q.klic]; continue; }
      if (q.text) { z[q.klic] = typeof p[q.klic] === 'string' ? p[q.klic].slice(0, 200) : d.param[q.klic]; continue; }
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

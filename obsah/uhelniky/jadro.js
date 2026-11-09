/* Úhelníky a odsávání – jádro bez DOM (běží i v node).
   Dva typy dílu:
   – úhelník (vingl) do dřeva: dvě ramena do L, trojúhelníkové výztuhy (z boku, z obou stran, uprostřed),
     otvory pro vruty (zápustné, oválné, více řad),
   – odsávací úhelník za frézu stolní frézky: klínová komora za pravítkem s oknem proti fréze,
     hrdlo pro hadici vysavače a uchy s otvory pro vruty do pravítka.
   Parametry a meze, předvolby, odvozené rozměry (polohy otvorů, hrdlo, dutina), kontroly, kusovník, projekt JSON.
   Obecné funkce tisku (převisy, orientace, odhad hmotnosti) bere ze spojky/jadro.js.
   Geometrii skládá uhelniky/geometrie.js přes manifold-3d. */
(function () {
  'use strict';
  const SP = typeof module !== 'undefined' ? require('../spojky/jadro.js') : window.SPOJKY;
  const { kopie, cislo, fmt, vezmi, poloz, MATERIALY, PROFILY, SROUBY, DELKY_SROUBU } = SP;
  const VERZE_FORMATU = 1;

  /* ---------- tabulky ---------- */
  const TYPY = { uhelnik: 'Úhelník', odsavani: 'Odsávací úhelník' };
  const VYZTUHY = { bok: 'z jedné strany', oba: 'z obou stran', stred: 'uprostřed', zadna: 'bez výztuhy' };
  const ZAPUSTENI = { kuzel: 'zápustná hlava (kužel 90°)', zadne: 'půlkulatá / válcová hlava (dosedne na plochu)' };
  const SMERY_HRDLA = { dozadu: 'vodorovně dozadu (tisk bez podpor)', kolmo: 'kolmo na šikmou stěnu', nahoru: 'svisle nahoru' };
  const SMERY_OVALU = { podel: 'podél ramene / svisle', napric: 'napříč / vodorovně' };
  const USAZENI = { zasun: 'koncovka hadice se zasune do hrdla', nasun: 'hadice se nasune na hrdlo' };
  // vruty do dřeva: průchozí otvor v plastu (vrut se v něm nemá chytat) a typický průměr zápustné hlavy (ISO 7050 / DIN 7505)
  const VRUTY = {
    3: { d: 3, otvor: 3.5, hlava: 6 },
    3.5: { d: 3.5, otvor: 4, hlava: 7 },
    4: { d: 4, otvor: 4.5, hlava: 8 },
    4.5: { d: 4.5, otvor: 5, hlava: 9 },
    5: { d: 5, otvor: 5.5, hlava: 10 },
    6: { d: 6, otvor: 6.6, hlava: 12 },
  };
  const SPOJE = { vrut: 'vrut do dřeva', sroub: 'šroub M (do T-matice / matice)' };
  const SMERY_PROFILU = { podel: 'podél ramene', kolmo: 'kolmo k rameni (napříč úhelníkem)' };
  const PROFILY_V = { zadny: 'žádný – dřevo / deska', 2020: 'hliníkový profil 2020', 3030: 'hliníkový profil 3030', 4040: 'hliníkový profil 4040' };
  // zápustná hlava šroubu ISO 10642 ≈ 2 d, válcová ISO 4762 podle tabulky spojek
  const ZAPUSTNA_M = { M3: 6, M4: 8, M5: 10, M6: 12, M8: 16 };
  const DELKY_VRUTU = [10, 12, 13, 15, 16, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80];

  const VYCHOZI = {
    nazev: 'Úhelník',
    typ: 'uhelnik',
    uhelnik: { delkaA: 60, delkaB: 60, sirka: 30, tloustka: 4, zaobleni: 3, vyztuha: 'bok', tlVyztuhy: 3, velikost: 100, srazSpicky: 2, zaobleniVnitr: 2, srazVnej: 0 },
    otvory: { spoj: 'vrut', vrut: '4', sroub: 'M5', profil: 'zadny', profilA: 'podel', profilB: 'podel', klic: true, pocet: 2, rad: 1, ovalnost: 0, smerOvalu: 'podel', zapust: 'kuzel', podelA: '', podelB: '', napric: '' },
    odsavani: {
      hrdloSmer: 'dozadu', sirka: 80, vyska: 70, hloubka: 80, stena: 2.5, dno: false, priruba: 4, ucho: 18, otvoru: 2,
      oknoSirka: 50, oknoVyska: 35, hadice: 35, usazeni: 'zasun', hrdloDelka: 30, hrdloStena: 2.5, vule: 0.3, kuzel: 1,
    },
    drevo: 18,
    tisk: { material: 'PETG', vypln: 30, previs: 45, most: 25, orientace: 'auto', kusu: 1 },
  };

  // [min, max] – mimo rozsah se hodnota omezí a uživatel dostane hlášení
  const ROZSAHY = {
    'uhelnik.delkaA': [10, 300], 'uhelnik.delkaB': [10, 300], 'uhelnik.sirka': [8, 200], 'uhelnik.tloustka': [1.5, 20],
    'uhelnik.zaobleni': [0, 50], 'uhelnik.tlVyztuhy': [1, 30], 'uhelnik.velikost': [20, 100],
    'uhelnik.srazSpicky': [0, 20], 'uhelnik.zaobleniVnitr': [0, 20], 'uhelnik.srazVnej': [0, 20],
    'otvory.pocet': [0, 8], 'otvory.rad': [1, 4], 'otvory.ovalnost': [0, 40],
    'odsavani.sirka': [30, 300], 'odsavani.vyska': [30, 250], 'odsavani.hloubka': [30, 250], 'odsavani.stena': [1.2, 8],
    'odsavani.priruba': [2, 15], 'odsavani.ucho': [0, 60], 'odsavani.otvoru': [0, 6],
    'odsavani.oknoSirka': [0, 290], 'odsavani.oknoVyska': [0, 240],
    'odsavani.hadice': [15, 160], 'odsavani.hrdloDelka': [5, 120], 'odsavani.hrdloStena': [1.2, 8], 'odsavani.vule': [-0.3, 2], 'odsavani.kuzel': [0, 5],
    drevo: [5, 80],
    'tisk.vypln': [0, 100], 'tisk.previs': [20, 70], 'tisk.most': [0, 100], 'tisk.kusu': [1, 30],
  };

  const PREDVOLBY = [
    { nazev: 'Úhelník 60 × 60 – výztuha z boku', popis: 'jako na náčrtu: 2 vruty 4 mm na rameni, šířka 30 mm',
      p: { typ: 'uhelnik' } },
    { nazev: 'Úhelník 50 × 50 – výztuha uprostřed', popis: 'šířka 40 mm, vruty 4 mm ve dvou sloupcích vedle výztuhy',
      p: { typ: 'uhelnik', uhelnik: { delkaA: 50, delkaB: 50, sirka: 40, tloustka: 4, vyztuha: 'stred', tlVyztuhy: 4 }, otvory: { vrut: '4', pocet: 2, rad: 1 } } },
    { nazev: 'Úhelník 80 × 80 – výztuhy z obou stran', popis: 'tuhý roh, vruty 5 mm, tloušťka 5 mm',
      p: { typ: 'uhelnik', uhelnik: { delkaA: 80, delkaB: 80, sirka: 40, tloustka: 5, vyztuha: 'oba', tlVyztuhy: 4 }, otvory: { vrut: '5', pocet: 2, rad: 1 } } },
    { nazev: 'Nastavitelný úhelník – oválné otvory', popis: 'bez výztuhy, ovály 8 mm na doladění polohy',
      p: { typ: 'uhelnik', uhelnik: { delkaA: 50, delkaB: 50, sirka: 25, tloustka: 4, vyztuha: 'zadna' }, otvory: { vrut: '4', pocet: 1, rad: 1, ovalnost: 8 } } },
    { nazev: 'Nábytkový úhelník 100 × 100', popis: 'výztuha uprostřed, 3 vruty 5 mm na rameni ve 2 sloupcích',
      p: { typ: 'uhelnik', uhelnik: { delkaA: 100, delkaB: 100, sirka: 50, tloustka: 5, vyztuha: 'stred', tlVyztuhy: 5, velikost: 80 }, otvory: { vrut: '5', pocet: 3, rad: 1 } } },
    { nazev: 'Profil 2020 – úhelník 40 × 40', popis: 'šrouby M5 s válcovou hlavou do T-matic, výstupky do drážek',
      p: { typ: 'uhelnik', uhelnik: { delkaA: 40, delkaB: 40, sirka: 20, tloustka: 4, vyztuha: 'bok', tlVyztuhy: 3 },
        otvory: { spoj: 'sroub', sroub: 'M5', profil: '2020', klic: true, zapust: 'zadne', pocet: 2 } } },
    { nazev: 'Profil 3030 – široký úhelník přes 2 drážky', popis: 'šířka 60 mm (3060), výztuha z boku, M6 do T-matic',
      p: { typ: 'uhelnik', uhelnik: { delkaA: 60, delkaB: 60, sirka: 60, tloustka: 5, vyztuha: 'bok', tlVyztuhy: 5 },
        otvory: { spoj: 'sroub', sroub: 'M6', profil: '3030', klic: true, zapust: 'zadne', pocet: 2 } } },
    { nazev: 'Odsávání za frézou – vysavač 35', popis: 'koncovka hadice Ø 35 mm se zasune do hrdla, tisk bez podpor',
      p: { typ: 'odsavani', nazev: 'Odsávání za frézou', otvory: { vrut: '4', zapust: 'kuzel', ovalnost: 0 } } },
    { nazev: 'Odsávání za frézou – hadice Ø 32 navlečená', popis: 'hadice s vnitřním Ø 32 mm se nasune na hrdlo mířící šikmo nahoru',
      p: { typ: 'odsavani', nazev: 'Odsávání za frézou', odsavani: { hadice: 32, usazeni: 'nasun', hrdloDelka: 35, hrdloSmer: 'kolmo' } } },
    { nazev: 'Odsávání – odsávačka Ø 100', popis: 'velká komora 160 × 140 × 150, hrdlo dozadu pro hadici 100 mm',
      p: { typ: 'odsavani', nazev: 'Odsávání za frézou 100', odsavani: { hrdloSmer: 'dozadu', sirka: 160, vyska: 140, hloubka: 150, stena: 3,
        priruba: 5, ucho: 20, otvoru: 3, oknoSirka: 80, oknoVyska: 50, hadice: 100, usazeni: 'zasun', hrdloDelka: 40, hrdloStena: 3 } } },
  ];

  /* ---------- drobnosti ---------- */
  const sl = (o, z) => { for (const k of Object.keys(z)) if (z[k] && typeof z[k] === 'object' && !Array.isArray(z[k]) && o[k] && typeof o[k] === 'object') sl(o[k], z[k]); else o[k] = z[k]; return o; };
  const vyber = (h, tab, vych) => (Object.prototype.hasOwnProperty.call(tab, h) ? h : vych);

  /** Doplní chybějící hodnoty, omezí rozsahy. Vrací {p, hlaseni: [texty o úpravách]}. */
  function normalizuj(vstup) {
    const p = kopie(VYCHOZI), hl = [];
    if (vstup && typeof vstup === 'object') sl(p, kopie(vstup));
    p.typ = vyber(p.typ, TYPY, 'uhelnik');
    p.uhelnik.vyztuha = vyber(p.uhelnik.vyztuha, VYZTUHY, 'bok');
    p.otvory.vrut = vyber(String(p.otvory.vrut), VRUTY, '4');
    p.otvory.spoj = vyber(p.otvory.spoj, SPOJE, 'vrut');
    p.otvory.sroub = vyber(p.otvory.sroub, SROUBY, 'M5');
    p.otvory.profil = vyber(String(p.otvory.profil), PROFILY_V, 'zadny');
    p.otvory.klic = !!p.otvory.klic;
    for (const c of ['profilA', 'profilB']) p.otvory[c] = vyber(p.otvory[c], SMERY_PROFILU, 'podel');
    for (const c of ['podelA', 'podelB', 'napric']) p.otvory[c] = String(p.otvory[c] == null ? '' : p.otvory[c]).slice(0, 200);
    p.otvory.zapust = vyber(p.otvory.zapust, ZAPUSTENI, 'kuzel');
    p.otvory.smerOvalu = vyber(p.otvory.smerOvalu, SMERY_OVALU, 'podel');
    p.odsavani.hrdloSmer = vyber(p.odsavani.hrdloSmer, SMERY_HRDLA, 'dozadu');
    p.odsavani.usazeni = vyber(p.odsavani.usazeni, USAZENI, 'zasun');
    p.odsavani.dno = !!p.odsavani.dno;
    p.tisk.material = vyber(p.tisk.material, MATERIALY, 'PETG');
    p.nazev = String(p.nazev == null ? '' : p.nazev).slice(0, 120);
    p.tisk.orientace = String(p.tisk.orientace || 'auto').slice(0, 20);
    for (const [c, [mn, mx]] of Object.entries(ROZSAHY)) {
      let h = cislo(vezmi(p, c), vezmi(VYCHOZI, c));
      if (h < mn || h > mx) { const o = Math.min(mx, Math.max(mn, h)); hl.push(`${c} ${fmt(h, 2)} → ${fmt(o, 2)}`); h = o; }
      poloz(p, c, h);
    }
    for (const c of ['otvory.pocet', 'otvory.rad', 'odsavani.otvoru', 'tisk.kusu']) poloz(p, c, Math.round(vezmi(p, c)));
    return { p, hlaseni: hl };
  }
  function zPredvolby(i) {
    const v = PREDVOLBY[i], p = normalizuj({}).p;
    sl(p, kopie(v.p));
    if (!v.p.nazev) p.nazev = v.nazev;
    return normalizuj(p).p;
  }

  /** n hodnot rovnoměrně mezi a a b (1 = střed). */
  const rozloz = (n, a, b) => (n <= 0 ? [] : n === 1 ? [(a + b) / 2] : Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1)));
  /** Seznam čísel z textu „12; 30,5 48“ (oddělovač středník nebo mezera, desetinná čárka). null = prázdné → automaticky. */
  function seznam(t) {
    const c = String(t || '').split(/[;\s]+/).filter(Boolean).map(x => cislo(x, NaN)).filter(Number.isFinite);
    return c.length ? c.slice(0, 20) : null;
  }
  /** Rozměry otvoru pro vrut / šroub: ro poloměr díry, rh poloměr hlavy (+ vůle), hz hloubka kuželu. */
  function otvorVrutu(q, tl) {
    const zap = q.zapust === 'kuzel', m = SROUBY[q.sroub];
    const v = q.spoj === 'sroub' ? { d: m.d, otvor: m.otvor, hlava: zap ? ZAPUSTNA_M[q.sroub] : m.hlava, nazev: `šroub ${q.sroub}` }
      : Object.assign({ nazev: `vrut ${fmt(VRUTY[q.vrut].d)}` }, VRUTY[q.vrut]);
    const ro = v.otvor / 2, rh = v.hlava / 2 + 0.25;
    return { v, ro, rh, zap, hz: zap ? Math.min(rh - ro, tl - 0.4) : 0, hzPlna: rh - ro, oval: q.ovalnost, napric: q.smerOvalu === 'napric' && q.ovalnost > 0 };
  }

  /* ---------- odvozené rozměry ---------- */
  function odvozUhelnik(p) {
    const u = p.uhelnik, t = u.tloustka, W = u.sirka, tz = Math.min(u.tlVyztuhy, W);
    const A = Math.max(u.delkaA, t + 1), B = Math.max(u.delkaB, t + 1);
    const r = Math.max(0, Math.min(u.zaobleni, W / 2 - 0.01, A - t - 0.5, B - t - 0.5));
    // výztuhy jako pásy v ose Y; volné pásy mezi nimi nesou otvory
    const pasy = { bok: [[0, tz]], oba: [[0, tz], [W - tz, W]], stred: [[(W - tz) / 2, (W + tz) / 2]], zadna: [] }[u.vyztuha];
    const volne = [];
    let y0 = 0;
    for (const [a, b] of pasy) { if (a - y0 > 0.01) volne.push([y0, a]); y0 = b; }
    if (W - y0 > 0.01) volne.push([y0, W]);
    // přepona výztuhy: na kraji ramene ji zkrátí zaoblení, aby nevyčnívala z obrysu
    const naKraji = u.vyztuha === 'bok' || u.vyztuha === 'oba';
    const ga = Math.max(1, Math.min((A - t) * u.velikost / 100, A - t - (naKraji ? r : 0)));
    const gb = Math.max(1, Math.min((B - t) * u.velikost / 100, B - t - (naKraji ? r : 0)));
    // vnitřní žlábek v rohu, sražení vnější hrany, seříznutí ostrých špiček výztuhy (plošky výšky sp)
    const ri = Math.max(0, Math.min(u.zaobleniVnitr, A - t - 2, B - t - 2));
    const cv = Math.max(0, Math.min(u.srazVnej, t));
    const sp = Math.max(0, Math.min(u.srazSpicky, 0.45 * Math.min(ga, gb)));
    const vyztuhaObrys = [[t + ga - sp * ga / gb, t], [t + ga - sp * ga / gb, t + sp], [t + sp, t + gb - sp * gb / ga], [t, t + gb - sp * gb / ga]];
    const d = otvorVrutu(p.otvory, t);
    // hliníkový profil: otvory v osách drážek (rozteč a), výstupek do drážky
    const pr = p.otvory.profil !== 'zadny' ? PROFILY[p.otvory.profil] : null;
    const klic = pr && p.otvory.klic ? { h: Math.round(Math.max(1, pr.limec - 0.2) * 10) / 10, wk: (pr.drazka - 0.3) / 2 } : null;
    if (klic) klic.c = Math.max(0, Math.min(klic.h, klic.wk - 0.75));
    // sloupce napříč (y): ručně zadané / osy drážek ověří místo pro hlavu u výztuhy, automatické se rozloží ve volných pásech
    const radaY = ys => ys.slice().sort((a, b) => a - b).map(y => {
      const kVyztuze = Math.min(Infinity, ...pasy.map(([a, b]) => (y < a ? a - y : y > b ? y - b : 0)));
      return { y, prostor: 2 * Math.min(kVyztuze, d.rh + 0.5 + Math.max(0, Math.min(y, W - y) - d.ro - 1)) - (d.napric ? d.oval : 0), rucne: true };
    });
    const autoY = () => volne.flatMap(([a, b]) => {
      const m = p.otvory.rad, krok = (b - a) / m;
      return Array.from({ length: m }, (_, i) => ({ y: a + krok * (i + 0.5), prostor: krok - (d.napric ? d.oval : 0) }));
    });
    const rucneY = seznam(p.otvory.napric);
    const drazkyY = pr ? (W >= pr.a - 0.01 ? Array.from({ length: Math.floor(W / pr.a + 0.01) }, (_, i) => pr.a / 2 + i * pr.a) : [W / 2]) : null;
    const n = p.otvory.pocet, ov = d.napric ? 0 : d.oval / 2;
    /** Rameno délky L: polohy podél (x od rohu), sloupce napříč, drážky profilu.
       Profil podél ramene → otvory napříč v osách drážek, podél volně; profil kolmo k rameni (vede napříč úhelníkem)
       → otvory podél v osách drážek a/2 + k·a od rohu (další otvor = další drážka profilu 2040, 2060…), napříč volně. */
    function rameno(L, text, smer) {
      const kolmo = !!pr && smer === 'kolmo', ruc = seznam(text);
      const xs = t + ri + d.rh + 1 + ov, xe = L - Math.max(d.rh, 2 * d.ro) - 1 - ov;
      const min = t + ri + d.rh + 0.3 + ov, max = L - d.ro - 0.8 - ov;
      const drazkyX = kolmo ? Array.from({ length: Math.max(1, n) }, (_, i) => pr.a / 2 + i * pr.a).filter(x => x < L - 0.5) : null;
      let x;
      if (ruc) x = ruc.filter(v => v > 0 && v < L).sort((a, b) => a - b);
      else if (kolmo) x = n ? drazkyX : [];
      else x = xe >= xs ? rozloz(n, xs, xe) : [];
      const sloupce = rucneY ? radaY(rucneY) : pr && !kolmo ? radaY(drazkyY) : autoY();
      return { xs, xe, x, min, max, kolmo, sloupce, rucne: ruc, overit: ruc || (kolmo ? x : null), drazky: kolmo ? drazkyX : drazkyY };
    }
    const ra = rameno(A, p.otvory.podelA, p.otvory.profilA), rb = rameno(B, p.otvory.podelB, p.otvory.profilB);
    return { typ: 'uhelnik', t, W, A, B, r, tz, pasy, volne, ga, gb, ri, cv, sp, vyztuhaObrys, otvor: d, ramenoA: ra, ramenoB: rb,
      profil: pr, klic, pocetOtvoru: ra.x.length * ra.sloupce.length + rb.x.length * rb.sloupce.length };
  }

  function odvozOdsavani(p) {
    const q = p.odsavani, W = q.sirka, H = q.vyska, D = q.hloubka, s = q.stena, tf = Math.max(q.priruba, s);
    const z0 = q.dno ? s : -1, zDno = Math.max(z0, 0);
    // klín v rovině XZ: (0,0) – (D,0) – (0,H); vnitřek = přepona odsazená o stěnu, vpředu příruba, dole dno
    const k = 1 - s * Math.hypot(1 / D, 1 / H);
    const xIn = z => D * (k - z / H), zIn = x => H * (k - x / D);   // vnitřní plocha šikmé stěny
    const xOut = z => D * (1 - z / H), zOut = x => H * (1 - x / D); // vnější plocha
    const xa = xIn(z0), zb = zIn(tf);
    const vnitrek = [[tf, z0], [xa, z0], [tf, zb]];
    const platny = xa > tf + 2 && zb > z0 + 2;
    const vnitrniVyskaVpredu = zb, L = Math.hypot(D, H);
    // hrdlo: osa, bod P na vnější šikmé stěně, začátek a hluboko v komoře (část uvnitř dutiny se odečte), konec e za stěnou
    const Ri = q.usazeni === 'zasun' ? q.hadice / 2 + q.vule : q.hadice / 2 - q.vule - q.hrdloStena;
    const Ro = q.usazeni === 'zasun' ? Ri + q.hrdloStena : q.hadice / 2 - q.vule;
    // kužel: zadaný průměr platí v půli hrdla; zasouvaná koncovka – hrdlo se k ústí rozšiřuje, navlékaná hadice – zužuje
    const dk = Math.tan(q.kuzel * Math.PI / 180) * q.hrdloDelka, zn = q.usazeni === 'zasun' ? 1 : -1;
    const RiZ = Ri - zn * dk / 2, RiK = Ri + zn * dk / 2, RoZ = Ro - zn * dk / 2, RoK = Ro + zn * dk / 2;
    let osa, P, a, e, misto;
    if (q.hrdloSmer === 'dozadu') {
      const zc = (zDno + zb) / 2;
      osa = [1, 0, 0]; P = [xOut(zc), 0, zc];
      a = P[0] - Math.max(tf + 0.5, xIn(zc + RoZ) - 1);
      e = RoZ * D / H + q.hrdloDelka;   // plná délka za místem, kde z šikmé stěny vyleze spodek hrdla
      misto = (zb - zDno) / 2 - 1;
    } else if (q.hrdloSmer === 'nahoru') {
      const xc = (tf + xa) / 2;
      osa = [0, 0, 1]; P = [xc, 0, zOut(xc)];
      a = P[2] - Math.max(zDno + 0.5, zIn(xc + RoZ) - 1);
      e = RoZ * H / D + q.hrdloDelka;
      misto = (xa - tf) / 2 - 1;
    } else {
      const x2 = xOut(zDno), xc = (tf + x2) / 2;
      osa = [H / L, 0, D / L]; P = [xc, 0, zOut(xc)];
      a = s + 1; e = q.hrdloDelka;
      misto = (x2 - tf) / 2 * L / D - s - 1;
    }
    misto = Math.min(misto, W / 2 - s - 0.5);
    const hrdloZ = P.map((x, i) => x - osa[i] * a), hrdloK = P.map((x, i) => x + osa[i] * e);
    // okno do komory: nesmí sahat do bočních stěn ani do stropu
    const oknoS = Math.max(0, Math.min(q.oknoSirka, W - 2 * s - 1));
    const oknoV = Math.max(0, Math.min(q.oknoVyska, vnitrniVyskaVpredu - 1));
    const d = otvorVrutu(p.otvory, tf);
    const yUcha = W / 2 + q.ucho / 2, okraj = Math.max(d.rh, 2 * d.ro) + 1 + (d.napric ? 0 : d.oval / 2);
    const rucne = seznam(p.otvory.podelA);
    const zOtv = q.ucho > 0 ? (rucne ? rucne.filter(z => z > 0 && z < H).sort((a, b) => a - b) : q.otvoru > 0 ? rozloz(q.otvoru, okraj, H - okraj) : []) : [];
    const otvory = [];
    for (const z of zOtv) otvory.push([-yUcha, z], [yUcha, z]);
    return { typ: 'odsavani', W, H, D, s, tf, z0, vnitrek, platny, osa, P, a, e, hrdloZ, hrdloK, misto, Ri, Ro, RiZ, RiK, RoZ, RoK,
      oknoS, oknoV, vnitrniVyskaVpredu, otvor: d, otvory, rucne, okraj, pocetOtvoru: otvory.length, sirkaPriruby: W + 2 * q.ucho };
  }
  const odvozene = p => (p.typ === 'odsavani' ? odvozOdsavani(p) : odvozUhelnik(p));

  /* ---------- kontroly zadání ---------- */
  function kontroly(p, o) {
    const H = [];
    const pridej = (uroven, text, ...pole) => H.push({ uroven, text, pole });
    const d = o.otvor, tl = o.typ === 'uhelnik' ? o.t : o.tf, pol = o.typ === 'uhelnik' ? 'uhelnik.tloustka' : 'odsavani.priruba';
    if (o.pocetOtvoru && d.zap && d.hzPlna > tl - 0.8)
      pridej('varovani', `Zápustná hlava (${d.v.nazev}) potřebuje ${fmt(d.hzPlna + 0.8)} mm materiálu, deska má ${fmt(tl)} mm – hlava bude trochu vyčnívat nebo se kužel protlačí.`, pol, 'otvory.vrut');
    if (o.typ === 'uhelnik') {
      const u = p.uhelnik;
      for (const [r, c, jm] of [[o.ramenoA, 'otvory.podelA', 'A'], [o.ramenoB, 'otvory.podelB', 'B']]) if (r.overit) {
        for (const x of r.overit) {
          if (x < r.min) pridej('chyba', `Otvor ${fmt(x)} mm na rameni ${jm} je blízko rohu – hlava narazí do druhého ramene (nejméně ${fmt(r.min)} mm).`, c);
          else if (x > r.max) pridej('chyba', `Otvor ${fmt(x)} mm na rameni ${jm} je za koncem ramene nebo na jeho okraji (nejvýš ${fmt(r.max)} mm).`, c);
        }
        const s2 = [...r.overit].sort((a, b) => a - b);
        if (s2.some((x, i) => i && x - s2[i - 1] < 2 * d.rh + (d.napric ? 0 : d.oval))) pridej('varovani', `Otvory na rameni ${jm} jsou blízko u sebe – hlavy se překrývají.`, c);
      }
      const sloupce = [...new Map([...o.ramenoA.sloupce, ...o.ramenoB.sloupce].map(c => [c.y, c])).values()];
      for (const s2 of sloupce.filter(s3 => s3.rucne)) {
        if (s2.y < d.ro + 0.8 || s2.y > o.W - d.ro - 0.8) pridej('chyba', `Otvor napříč ${fmt(s2.y)} mm je mimo šířku úhelníku ${fmt(o.W)} mm.`, 'otvory.napric', 'uhelnik.sirka');
        else if (s2.prostor < 2 * d.rh) pridej('chyba', `Otvor napříč ${fmt(s2.y)} mm je moc blízko výztuze – hlava se nevejde.`, 'otvory.napric', 'uhelnik.vyztuha');
      }
      if (o.klic && (u.vyztuha === 'stred' || u.vyztuha === 'oba'))
        pridej('info', 'S výstupky do drážky a výztuhou uprostřed / z obou stran se úhelník bez podpor nevytiskne (naležato visí rameno nad výstupky, na boku výztuha). Bez podpor jde výztuha z jedné strany.', 'uhelnik.vyztuha', 'otvory.klic');
      if (o.profil) {
        if ((!o.ramenoA.kolmo || !o.ramenoB.kolmo) && p.uhelnik.sirka < o.profil.a - 0.01) pridej('varovani', `Úhelník je užší (${fmt(p.uhelnik.sirka)} mm) než profil ${p.otvory.profil} – otvor je uprostřed, ne v ose drážky.`, 'uhelnik.sirka');
        if (p.otvory.spoj === 'vrut') pridej('info', 'Do hliníkového profilu patří šroub M a T-matice, ne vrut.', 'otvory.spoj');
        else if (SROUBY[p.otvory.sroub].d !== SROUBY[o.profil.sroub].d) pridej('info', `Profil ${p.otvory.profil} má běžně šrouby ${o.profil.sroub} – zkontrolujte T-matice.`, 'otvory.sroub');
      }
      if (p.otvory.pocet > 0 && !o.pocetOtvoru && !o.ramenoA.rucne && !o.ramenoB.rucne) pridej('chyba', 'Otvory se na rameno nevejdou – prodlužte rameno nebo zmenšete vrut / ovál.', 'uhelnik.delkaA', 'otvory.pocet');
      if (o.pocetOtvoru && sloupce.some(c => !c.rucne && c.prostor < 2 * d.rh + 1))
        pridej('chyba', `Vedle výztuhy není místo na hlavy vrutů (potřeba ${fmt(2 * d.rh + 1)} mm na sloupec) – rozšiřte úhelník, ubírejte řady nebo ztenčete výztuhu.`, 'uhelnik.sirka', 'otvory.rad');
      if (o.pocetOtvoru) for (const [L, r, c] of [[o.A, o.ramenoA, 'uhelnik.delkaA'], [o.B, o.ramenoB, 'uhelnik.delkaB']]) {
        if (!r.rucne && r.x.length > 1 && (r.x[1] - r.x[0]) < 2 * d.rh + 1 + (d.napric ? 0 : d.oval)) pridej('varovani', `Na rameni ${fmt(L)} mm jsou otvory blízko u sebe – hlavy se překrývají.`, c, 'otvory.pocet');
      }
      if (u.vyztuha !== 'zadna' && u.tlVyztuhy >= u.sirka) pridej('chyba', 'Výztuha je stejně široká jako úhelník – nezbude místo na vruty.', 'uhelnik.tlVyztuhy');
      if (u.vyztuha === 'zadna' && u.tloustka < 4) pridej('info', 'Úhelník bez výztuhy a tenčí než 4 mm se v rohu snadno ohne – přidejte výztuhu nebo tloušťku.', 'uhelnik.vyztuha', 'uhelnik.tloustka');
      if (u.zaobleni > o.r + 0.01) pridej('info', `Zaoblení omezeno na ${fmt(o.r)} mm (polovina šířky / délka ramene).`, 'uhelnik.zaobleni');
    } else {
      const q = p.odsavani;
      if (!o.platny) pridej('chyba', 'Komora je na tloušťku stěn a příruby příliš malá – zvětšete hloubku nebo výšku.', 'odsavani.hloubka', 'odsavani.vyska');
      if (o.platny && Math.max(o.RoZ, o.RoK) > o.misto)
        pridej('chyba', q.hrdloSmer === 'nahoru' ? `Hrdlo Ø ${fmt(2 * o.Ro)} mm se do komory nevejde (nejvýš Ø ${fmt(Math.max(0, 2 * o.misto))} mm) – zvětšete hloubku nebo šířku komory.`
          : `Hrdlo Ø ${fmt(2 * o.Ro)} mm se do komory nevejde (nejvýš Ø ${fmt(Math.max(0, 2 * o.misto))} mm) – zvětšete výšku nebo šířku komory.`,
          q.hrdloSmer === 'nahoru' ? 'odsavani.hloubka' : 'odsavani.vyska', 'odsavani.sirka', 'odsavani.hadice');
      if (Math.min(o.RiZ, o.RiK) < 3) pridej('chyba', 'Hrdlo nemá skoro žádný průchod – na nasouvanou hadici zmenšete stěnu hrdla.', 'odsavani.hrdloStena');
      if (q.oknoSirka > o.oknoS + 0.01 || q.oknoVyska > o.oknoV + 0.01)
        pridej('varovani', `Okno zmenšeno na ${fmt(o.oknoS)} × ${fmt(o.oknoV)} mm, aby neprořízlo stěny komory.`, 'odsavani.oknoSirka', 'odsavani.oknoVyska');
      if (o.oknoS * o.oknoV < 0.6 * Math.PI * o.Ri * o.Ri && o.Ri > 3)
        pridej('varovani', `Okno (${fmt(o.oknoS * o.oknoV / 100, 0)} cm²) je menší než průřez hrdla (${fmt(Math.PI * o.Ri * o.Ri / 100, 0)} cm²) – vysavač bude táhnout slabě.`, 'odsavani.oknoSirka');
      const uchoMin = 2 * o.otvor.rh + 2 + (o.otvor.napric ? o.otvor.oval : 0);
      if (q.otvoru > 0 && q.ucho > 0 && q.ucho < uchoMin) pridej('chyba', `Ucho ${fmt(q.ucho)} mm je úzké pro hlavu vrutu (potřeba ${fmt(uchoMin)} mm).`, 'odsavani.ucho');
      if (q.otvoru > 0 && q.ucho === 0) pridej('info', 'Bez uch nejsou otvory pro vruty – komoru přilepte nebo přichyťte k pravítku jinak.', 'odsavani.ucho');
      if (o.rucne) for (const z of o.rucne) if (z < o.okraj - 0.5 || z > q.vyska - o.okraj + 0.5)
        pridej('chyba', `Otvor ve výšce ${fmt(z)} mm je u okraje ucha (dovoleno ${fmt(o.okraj - 0.5)}–${fmt(q.vyska - o.okraj + 0.5)} mm).`, 'otvory.podelA');
      if (!o.rucne && q.otvoru > 1 && o.otvory.length > 2 && o.otvory[2][1] - o.otvory[0][1] < 2 * o.otvor.rh + 1 + (o.otvor.napric ? 0 : o.otvor.oval)) pridej('varovani', 'Otvory v uchu jsou blízko u sebe – snižte počet.', 'odsavani.otvoru');
    }
    return H;
  }

  /* ---------- kusovník ---------- */
  /** Délka vrutu: co nejdelší z řady, aby neprošel dřevem (rezerva 3 mm). */
  function kusovnik(p, o) {
    const out = [], n = o.pocetOtvoru;
    if (n && p.otvory.spoj === 'sroub') {
      const v = o.otvor.v, tl = o.typ === 'uhelnik' ? o.t : o.tf, pr = o.profil, zap = o.otvor.zap;
      const hlava = zap ? 'se zápustnou hlavou (ISO 10642)' : 's válcovou hlavou (ISO 4762)';
      if (pr) {
        // šroub projde T-maticí (límec + 2,5 mm) a nedosedne na dno drážky
        const L = DELKY_SROUBU.find(x => x >= tl + pr.limec + 2.5 && x <= tl + pr.hloubka) || null;
        out.push({ ks: n, co: `Šroub ${p.otvory.sroub} × ${L || '?'} ${hlava}`, pozn: L ? `sevřeno ${fmt(tl)} mm, do drážky ${fmt(L - tl)} mm` : `délku nelze vybrat: ${fmt(tl + pr.limec + 2.5)}–${fmt(tl + pr.hloubka)} mm`, chyba: !L });
        out.push({ ks: n, co: `T-matice ${p.otvory.sroub} do drážky ${fmt(pr.drazka)} mm (profil ${p.otvory.profil})`, pozn: 'vsuvná nebo otočná (vloží se i do hotového rámu)' });
      } else {
        const L = DELKY_SROUBU.find(x => x >= tl + p.drevo + 0.8 * v.d + 2) || null;
        out.push({ ks: n, co: `Šroub ${p.otvory.sroub} × ${L || '?'} ${hlava}`, pozn: `skrz ${fmt(tl)} + ${fmt(p.drevo)} mm`, chyba: !L });
        out.push({ ks: n, co: `Matice ${p.otvory.sroub} (samojistná) + podložka`, pozn: 'na druhé straně desky' });
      }
    } else if (n) {
      const v = o.otvor.v, tl = o.typ === 'uhelnik' ? o.t : o.tf, zap = o.otvor.zap;
      const max = tl + p.drevo - 3;
      const L = [...DELKY_VRUTU].reverse().find(x => x <= max) || null;
      const zaber = L ? L - tl : 0;
      out.push({ ks: n, co: `Vrut ${fmt(v.d)} × ${L || '?'} ${zap ? 'se zápustnou hlavou' : 's půlkulatou / čočkovou hlavou'}`,
        pozn: L ? `do dřeva ${fmt(zaber)} mm z ${fmt(p.drevo)} mm${zaber < 3 * v.d ? ' – málo, zvažte silnější dřevo / delší vrut' : ''}` : 'dřevo je na vruty příliš tenké', chyba: !L || zaber < 2 * v.d });
      // předvrtání (jádro vrutu): měkké dřevo ≈ 0,6 d, tvrdé ≈ 0,7 d, zaokrouhleno na vrták po 0,5 mm
      const vrtak = k => Math.max(1.5, Math.round(k * v.d * 2) / 2);
      out.push({ ks: null, co: `Vrták Ø ${fmt(vrtak(0.6))} mm (měkké dřevo) / Ø ${fmt(vrtak(0.7))} mm (tvrdé dřevo)`,
        pozn: `předvrtání do hloubky ≈ ${fmt(L ? L - tl : 0)} mm, u kraje desky a v tvrdém dřevě nutné`, vrtak: [vrtak(0.6), vrtak(0.7)] });
    }
    if (o.typ === 'odsavani') out.push({ ks: 1, co: `Hadice vysavače – ${p.odsavani.usazeni === 'zasun' ? `koncovka vnější Ø ${fmt(p.odsavani.hadice)} mm` : `vnitřní Ø ${fmt(p.odsavani.hadice)} mm`}`,
      pozn: (p.odsavani.usazeni === 'zasun' ? `hrdlo uvnitř Ø ${fmt(2 * o.Ri, 2)} mm` : `hrdlo venku Ø ${fmt(2 * o.Ro, 2)} mm`) + (p.odsavani.kuzel > 0 ? ` v půli délky, kužel ${fmt(p.odsavani.kuzel)}°` : '') });
    return out;
  }

  /* ---------- projekt ---------- */
  function ulozProjekt(p) {
    return JSON.stringify({ format: 'webapp_uhelniky', verze: VERZE_FORMATU, ulozeno: new Date().toISOString(), projekt: p }, null, 2);
  }
  function nactiProjekt(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
    if (!o || typeof o !== 'object') throw new Error('Soubor neobsahuje projekt.');
    if (o.format !== 'webapp_uhelniky') throw new Error('Soubor není projekt úhelníku (chybí "format": "webapp_uhelniky").');
    if (!(o.verze >= 1) || o.verze > VERZE_FORMATU) throw new Error(`Nepodporovaná verze projektu ${o.verze}.`);
    return normalizuj(o.projekt);
  }
  function popis(p) {
    if (p.typ === 'odsavani') {
      const q = p.odsavani;
      return `klín ${fmt(q.sirka)} × ${fmt(q.vyska)} × ${fmt(q.hloubka)}, hadice Ø ${fmt(q.hadice)}`;
    }
    const u = p.uhelnik;
    return `${fmt(u.delkaA)} × ${fmt(u.delkaB)} × ${fmt(u.sirka)}, výztuha ${VYZTUHY[u.vyztuha]}, ${otvorVrutu(p.otvory, u.tloustka).v.nazev}${p.otvory.profil !== 'zadny' ? ', profil ' + p.otvory.profil : ''}`;
  }

  /* ---------- tisk ---------- */
  const NA_BOKU = k => k === '-Y' || k === '+Y';
  // na boku jde bez podpor jen úhelník s výztuhou z jedné strany (ta leží na podložce) nebo bez výztuhy
  const boknim = p => p.typ === 'uhelnik' && (p.uhelnik.vyztuha === 'bok' || p.uhelnik.vyztuha === 'zadna');
  const SPODEK = 1;   // mm – převis v prvních vrstvách (oblouk zaobleného rohu u podložky) se vytiskne bez podpor
  /** Převisy ze spojek; plošky bez opory celé do výšky SPODEK nad podložkou se berou jako „na podložce“. */
  function previsy(poz, idx, limit) {
    const pv = SP.previsy(poz, idx, limit);
    let zmin = Infinity;
    for (let i = 2; i < poz.length; i += 3) if (poz[i] < zmin) zmin = poz[i];
    for (let t = 0; t < pv.tridy.length; t++) {
      if (pv.tridy[t] !== 2) continue;
      const a = 3 * idx[3 * t], b = 3 * idx[3 * t + 1], c = 3 * idx[3 * t + 2];
      if (Math.max(poz[a + 2], poz[b + 2], poz[c + 2]) > zmin + SPODEK) continue;
      const ux = poz[b] - poz[a], uy = poz[b + 1] - poz[a + 1], uz = poz[b + 2] - poz[a + 2];
      const vx = poz[c] - poz[a], vy = poz[c + 1] - poz[a + 1], vz = poz[c + 2] - poz[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz), A = l / 2;
      pv.volne -= A;
      if (-nz / l > Math.sin(Math.min(89, limit + 15) * Math.PI / 180)) pv.strme -= A;
      pv.tridy[t] = 3;
    }
    pv.volne = Math.max(0, pv.volne); pv.strme = Math.max(0, pv.strme);
    return pv;
  }
  /** Ohodnocení orientací (vzorec jako ve spojkách, převisy s tolerancí u podložky);
     úhelník má přednost na boku – vrstvy vedou podél ramen i výztuhy, roh se nerozštípne. */
  function rozborTisku(sit, p, o) {
    const lim = p.tisk.previs, vysl = [];
    for (const k of SP.kandidatiOrientace({ typ: p.typ }, {})) {
      const R = SP.rotaceDolu(k.dolu), pv = previsy(SP.tiskovaPoloha(sit, R).poz, sit.idx, lim);
      let skore = pv.volne * 5 + pv.strme * 20 + pv.most * 0.3 + pv.vyska * 0.5 - Math.min(pv.podlozka, 150) * 0.2 + (pv.podlozka < 20 ? 10000 : 0);
      if (boknim(p) && !NA_BOKU(k.klic)) skore += 400;
      const nazev = (p.typ === 'odsavani' ? { '-X': 'přírubou na podložce' } : { '-Y': p.uhelnik.vyztuha === 'bok' ? 'na boku, výztuhou na podložce' : 'na boku', '+Y': 'na boku, obráceně', '-Z': 'naležato, jak je kreslen' })[k.klic];
      if (nazev) k.nazev = nazev;
      vysl.push(Object.assign({}, k, { R, volne: pv.volne, strme: pv.strme, most: pv.most, podlozka: pv.podlozka, vyska: pv.vyska, skore }));
    }
    vysl.sort((a, b) => a.skore - b.skore);
    return { kandidati: vysl, nejlepsi: vysl[0], vybrana: vysl.find(v => v.klic === p.tisk.orientace) || vysl[0] };
  }
  function kontrolyTisku(p, o, rozbor, plocha) {
    const H = SP.kontrolyTisku(p, o, rozbor, plocha);
    if (boknim(p) && !NA_BOKU(rozbor.vybrana.klic))
      H.push({ uroven: 'varovani', text: `V orientaci „${rozbor.vybrana.nazev}“ vedou vrstvy napříč rohem – pod zatížením se úhelník rozštípne mezi vrstvami. Tiskněte ho na boku.`,
        pole: ['tisk.orientace'], oprava: { pole: 'tisk.orientace', hodnota: rozbor.nejlepsi.klic, text: 'tisknout na boku' } });
    else if (p.typ === 'uhelnik' && !boknim(p) && !NA_BOKU(rozbor.vybrana.klic))
      H.push({ uroven: 'info', text: `Výztuha ${VYZTUHY[p.uhelnik.vyztuha]} by na boku visela ve vzduchu, proto se tiskne naležato – vrstvy svislého ramene vedou napříč rohem. Na větší zátěž přidejte obvodové stopy (4–5) nebo zvolte výztuhu z jedné strany a tiskněte na boku.`, pole: ['uhelnik.vyztuha'] });
    return H;
  }

  const API = {
    SPOJE, SMERY_PROFILU, PROFILY_V, PROFILY, SROUBY, seznam, VERZE_FORMATU, TYPY, VYZTUHY, ZAPUSTENI, SMERY_HRDLA, SMERY_OVALU, USAZENI, VRUTY, DELKY_VRUTU, VYCHOZI, ROZSAHY, PREDVOLBY, MATERIALY,
    kopie, cislo, fmt, vezmi, poloz, normalizuj, zPredvolby, rozloz, odvozene, kontroly, kusovnik, ulozProjekt, nactiProjekt, popis,
    rozborTisku, kontrolyTisku, tiskovaPoloha: SP.tiskovaPoloha, previsy,
    potrebujePodpory: SP.potrebujePodpory, odhadTisku: SP.odhadTisku,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.UHELNIKY = API;
})();

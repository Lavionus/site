/* Kliky a knoby ke dveřím – jádro bez DOM (běží i v node).
   Parametry a meze, předvolby, odvozené rozměry (páteř ramene kliky, profil knobu, čtyřhran, stavěcí šroub,
   rozeta / štít s otvorem pro klíč), kontroly zadání a ergonomie, pevnostní odhad podle orientace vrstev,
   kandidáti orientace tisku, kusovník, vrtací šablona, projekt JSON.
   Obecné funkce tisku (otočení, převisy) bere ze spojky/jadro.js, geometrii skládá kliky/geometrie.js.

   Souřadnice „dveřní“: rovina dveří z = 0, osa čtyřhranu = osa z (ven ke člověku), y nahoru,
   rameno kliky míří do +x (klika doprava); hrana dveří se zámkem leží v x = −trn. */
(function () {
  'use strict';
  const SP = typeof module !== 'undefined' ? require('../spojky/jadro.js') : window.SPOJKY;
  const { kopie, cislo, fmt, vezmi, poloz, V, rotaceDolu, tiskovaPoloha, previsy, potrebujePodpory } = SP;
  const VERZE_FORMATU = 1;
  const RAD = Math.PI / 180;

  /* ---------- tabulky ---------- */
  // typické rozměry – před tiskem změřte svůj čtyřhran posuvkou
  const VRETENA = {
    eu8: { nazev: 'EU 8 mm – běžný standard', s: 8 },
    eu7: { nazev: 'EU 7 mm – Francie, starší kování', s: 7 },
    eu9: { nazev: 'EU 9 mm – část severského a protipožárního kování', s: 9 },
    eu10: { nazev: 'EU 10 mm – bezpečnostní a vstupní kování', s: 10 },
    us516: { nazev: 'US 5/16″ = 7,94 mm – zadlabací (mortise)', s: 7.94 },
    us932: { nazev: 'US 9/32″ = 7,14 mm – starší mortise', s: 7.14 },
    us1764: { nazev: 'US 17/64″ = 6,75 mm – historické zámky', s: 6.75 },
    us14: { nazev: 'US 1/4″ = 6,35 mm', s: 6.35 },
    vlastni: { nazev: 'vlastní rozměr', s: null },
  };
  // trn (backset) = vzdálenost osy čtyřhranu od čela zámku
  const TRNY = [40, 45, 50, 55, 60, 65, 70, 80];
  const TRNY_US = [{ nazev: '2 3/8″', mm: 60.3 }, { nazev: '2 3/4″', mm: 69.9 }];
  const DELKY_VRETEN = [70, 80, 90, 100, 110, 120, 130, 140, 160];
  // stavěcí šroub s vnitřním šestihranem (ISO 4026/4029), matice ISO 4032, zalisovací vložky (typické rozměry otvoru)
  const STAVECI = {
    M3: { d: 3, matice: 5.5, mVyska: 2.4, vlozka: 4.0, vDelka: 5.7, predvrt: 2.5, klic: 1.5 },
    M4: { d: 4, matice: 7, mVyska: 3.2, vlozka: 5.6, vDelka: 8.1, predvrt: 3.3, klic: 2 },
    M5: { d: 5, matice: 8, mVyska: 4, vlozka: 6.4, vDelka: 9.5, predvrt: 4.2, klic: 2.5 },
    M6: { d: 6, matice: 10, mVyska: 5, vlozka: 8.0, vDelka: 12.7, predvrt: 5.0, klic: 3 },
    vlastni: null,   // rozměry se odhadnou z průměru (staveciZPrumeru)
  };
  /** Odhad rozměrů matice, vložky a předvrtu pro šroub vlastního průměru (poměry metrické řady). */
  const staveciZPrumeru = d => ({ d, matice: 1.7 * d, mVyska: 0.8 * d, vlozka: 1.35 * d, vDelka: 2 * d, predvrt: 0.82 * d, klic: Math.max(0.7, 0.5 * d) });
  // samořezný vrut do plastu (typ PT / Delta PT): předvrt ≈ 0,8 × d, válcová hlava ≈ 2 × d, výška ≈ 0,7 × d
  const samorezRozmery = st => ({ predvrt: Math.round(st.d * 0.8 * 10) / 10, hlava: 2 * st.d + 0.4, vyskaHlavy: 0.7 * st.d + 0.3 });
  // vrut do dřeva se zápustnou hlavou 90°: v plastu si vyřízne závit, špička se zaryje do čtyřhranu; hlava ≈ 2 × d
  const vrutRozmery = st => { const predvrt = Math.round(st.d * 0.75 * 10) / 10, hlava = 2 * st.d + 0.4; return { predvrt, hlava, zahloubeni: (hlava - predvrt) / 2 }; };
  /** Předvrt a zahloubení hlavy šroubku: automatické hodnoty (vrut / samořez) přepsané zadáním (0 = auto).
     Vrací {predvrt, hlava, hloubka, tvar ('kuzel' | 'valec'), vyskaHlavy, zahloubeni} nebo null. */
  function zahloubeniSroubu(p, st) {
    const s = p.sroub, uch = s.uchyceni;
    if (uch !== 'vrut' && uch !== 'samorez') return null;
    const auto = uch === 'vrut' ? vrutRozmery(st) : samorezRozmery(st);
    const predvrt = s.predvrt > 0 ? s.predvrt : auto.predvrt, hlava = Math.max(predvrt + 0.2, s.hlava > 0 ? s.hlava : auto.hlava);
    const tvar = s.hlavaTvar === 'auto' ? (uch === 'vrut' ? 'kuzel' : 'valec') : s.hlavaTvar;
    const hloubka = s.hlavaHloubka > 0 ? s.hlavaHloubka : tvar === 'kuzel' ? (hlava - predvrt) / 2 + 0.2 : 0.7 * st.d + 0.3;
    return { predvrt, hlava, hloubka, tvar, vyskaHlavy: hloubka, zahloubeni: hloubka };
  }
  /** Délka šroubu z normalizované řady. Šroub s hlavou (dosah = true) musí dosáhnout k hřídeli – nejkratší, který ji
     zajistí; o kolik je delší než `potreba + zaber`, o tolik zůstane hlava nad dnem zahloubení (vyčnívá).
     Stavěcí šroub bez hlavy (dosah = false) – nejdelší, který se celý schová (zapustí se hlouběji). */
  function delkaSroubu(rada, potreba, zaber, dosah = false) {
    if (dosah) {
      const L = rada.find(d => d >= potreba - 0.2) || rada[rada.length - 1];
      return { L, vycniva: Math.max(0, L - potreba - zaber), kratky: L < potreba - 0.2 };
    }
    const vhodne = rada.filter(d => d <= potreba + zaber);
    const L = vhodne.length ? vhodne[vhodne.length - 1] : rada[0];
    return { L, vycniva: Math.max(0, L - potreba - zaber), kratky: false };
  }
  const RADA_VRUTU = [6, 8, 10, 12, 13, 15, 16, 17, 20, 25, 30], RADA_SAMOREZU = [4, 5, 6, 8, 10, 12, 14, 16, 20];
  /** Délka vrutu / samořezu (zahl = zahloubeniSroubu): hlava sedí v zahloubení, dřík jde stěnou k hřídeli. */
  function delkaVrutu(zahl, stena, vrut) {
    // zápustná hlava se do délky šroubu počítá; zahloubení hlubší než kužel hlavu zapustí pod povrch.
    // válcová hlava se do délky nepočítá – dřík začíná na dně zahloubení
    const kuzel = zahl.tvar === 'kuzel' ? (zahl.hlava - zahl.predvrt) / 2 : 0;
    const potreba = zahl.tvar === 'kuzel' ? stena - Math.max(0, zahl.hloubka - kuzel) : stena - zahl.hloubka;
    return delkaSroubu(vrut ? RADA_VRUTU : RADA_SAMOREZU, potreba, vrut ? 1.5 : 1, true);
  }
  /** Prorazí kapsa pro matici (šestihran napříč krčkem) bok kulatého krčku? rS = poloměr krčku u šroubu, kS = vzdálenost stěny otvoru od osy. */
  function kapsaProrazi(rS, kS, stena, st) {
    const sf = st.matice + 0.3, tl = st.mVyska + 0.4, yVen = kS + stena / 2 + tl / 2;
    return Math.sqrt(Math.max(0, rS * rS - yVen * yVen)) < sf / 2 + 0.8;
  }
  const jmenoSroubu = p => (p.sroub.velikost === 'vlastni' ? `Ø ${fmt(p.sroub.prumer)}` : p.sroub.velikost);
  const DELKY_STAVECICH = [3, 4, 5, 6, 8, 10, 12, 16];
  const UCHYCENI = {
    matice: 'matice vložená do kapsy',
    vlozka: 'zalisovací vložka (teplem)',
    zavit: 'závit do plastu (předvrt)',
    samorez: 'samořezný vrut do plastu',
    vrut: 'vrut do dřeva se zápustnou hlavou',
    zadne: 'bez stavěcího šroubu',
  };
  // šrouby rozety / štítu: otvor = průchozí, hlava = průměr zápustné hlavy 90°, predvrt = do dřeva (vrut) nebo skrz dveře
  const SROUBY_ROZETY = {
    vrut35: { nazev: 'vrut 3,5 se zápustnou hlavou', d: 3.5, otvor: 3.9, hlava: 7, predvrt: 2.5, vrut: true },
    vrut4: { nazev: 'vrut 4 se zápustnou hlavou', d: 4, otvor: 4.4, hlava: 8, predvrt: 2.5, vrut: true },
    M4: { nazev: 'M4 zápustný skrz dveře', d: 4, otvor: 4.5, hlava: 8.96, predvrt: 5, vrut: false },
    M5: { nazev: 'M5 zápustný skrz dveře', d: 5, otvor: 5.5, hlava: 11.2, predvrt: 6, vrut: false },
  };
  // otvory pro klíč (s vůlí): BB = obyčejný klíč, PZ = cylindrická vložka (DIN 18252: Ø 17, šířka 10, výška 33), WC = čtyřhran WC
  const KLICE = {
    zadny: { nazev: 'bez otvoru pro klíč' },
    BB: { nazev: 'BB – obyčejný klíč', kruh: 9.6, sirka: 5, dolu: 13 },
    PZ: { nazev: 'PZ – cylindrická vložka', kruh: 17.6, sirka: 10.6, dolu: 24.6 },
    WC: { nazev: 'WC – otočný knoflík', kruh: 10.5, sirka: 0, dolu: 0 },
  };
  const TVARY_KLIKY = {
    rovna: { nazev: 'Rovná', znak: '━', pole: ['zuzeni'] },
    navrat: { nazev: 'Zahnutý konec ke dveřím', znak: '┓', pole: ['zuzeni', 'ohyb', 'navrat'] },
    oblouk: { nazev: 'Prohnutá ke dveřím', znak: '⌒', pole: ['zuzeni', 'prohnuti'] },
    dolu: { nazev: 'Zahnutá dolů', znak: '╮', pole: ['zuzeni', 'prohnuti'] },
    trubka: { nazev: 'U – ohýbaná trubka', znak: '┏', pole: ['zuzeni', 'ohyb', 'krcek'] },
    generator: { nazev: 'Generátor ze semínka', znak: '🎲', pole: ['seminko'] },
    vlastni: { nazev: 'Vlastní – skica', znak: '✏️', pole: ['skica'] },
  };
  // průřez ramene = superelipsa |u/a|^n + |v/b|^n = 1
  const PRUREZY = {
    kruh: { nazev: 'kruh', n: 2 },
    oval: { nazev: 'ovál', n: 2 },
    zaobleny: { nazev: 'zaoblený obdélník', n: 4 },
    plochy: { nazev: 'plochý s ostřejšími hranami', n: 7 },
  };
  const TVARY_KNOBU = {
    koule: { nazev: 'Koule', znak: '●' },
    vejce: { nazev: 'Vejce', znak: '⬮' },
    hrib: { nazev: 'Hřib', znak: '⌓' },
    valec: { nazev: 'Puk (váleček)', znak: '▬' },
    ul: { nazev: 'Úl (beehive)', znak: '☰' },
    hruska: { nazev: 'Hruška', znak: '🍐' },
    cocka: { nazev: 'Čočka', znak: '⬭' },
    zvon: { nazev: 'Zvon', znak: '🔔' },
    miska: { nazev: 'Knoflík s miskou', znak: '◡' },
    soudek: { nazev: 'Soudek s prstenci', znak: '▤' },
    tulipan: { nazev: 'Tulipán', znak: '🌷' },
    pasazni: { nazev: 'Passage (plochá čela)', znak: '◗' },
    konkavni: { nazev: 'Konkávní zvon', znak: '⏄' },
    stupnovity: { nazev: 'Se stupněm', znak: '⛀' },
    disk: { nazev: 'Plochý disk', znak: '⬬' },
    orbit: { nazev: 'Koule s ploškou', znak: '◓' },
    generator: { nazev: 'Generátor ze semínka', znak: '🎲' },
    vlastni: { nazev: 'Vlastní – skica', znak: '✏️' },
  };
  // tvar krčku mezi rozetou / štítem a ramenem (u knobu hlavou); jen přidává materiál, poloměr ≥ krček
  const TVARY_KRCKU = {
    valec: { nazev: 'Válec', znak: '▮' },
    kuzel: { nazev: 'Kužel', znak: '◭' },
    zvon: { nazev: 'Trumpeta', znak: '⏄' },
    prstence: { nazev: 'S prstenci', znak: '☰' },
    stupne: { nazev: 'Stupňovitý', znak: '▙' },
    baluster: { nazev: 'Soudek', znak: '⬮' },
    patka: { nazev: 'Patka s prstencem', znak: '⊥' },
    generator: { nazev: 'Generátor ze semínka', znak: '🎲' },
    vlastni: { nazev: 'Vlastní – skica', znak: '✏️' },
  };
  const HRANY_KRCKU = { 0: 'kulatý', 4: 'čtyřhranný', 6: 'šestihranný', 8: 'osmihranný' };
  const PUDORYSY = {
    kruh: 'kruhový', hrany: 'fasety (mnohoúhelník)', ryhy: 'rýhovaný', vlny: 'vlnky', kvet: 'květ (laloky)', zebra: 'žebra',
    ozubeni: 'ozubení', spirala: 'spirála (šikmé rýhy)', vrubkovani: 'vroubkování (kosočtverce)', oval: 'ovál',
  };
  const PODLOZENI = { rozeta: 'rozeta', stit: 'štít', zadne: 'bez rozety' };
  const TVARY_ROZETY = { kruh: 'kruhová', ctverec: 'hranatá', oval: 'oválná' };
  // orientační pevnosti tištěných dílů při 100 % výplni (MPa): xy = ve vrstvě, z = napříč vrstvami
  const MATERIALY = {
    PETG: { nazev: 'PETG', hustota: 1.27, xy: 45, z: 25, pozn: 'houževnaté, při přetížení se spíš ohne než praskne – dobrá volba na kliky' },
    PLA: { nazev: 'PLA', hustota: 1.24, xy: 50, z: 28, pozn: 'tuhé, ale křehké; na slunci u vchodových dveří měkne (≈ 55 °C) – spíš na zkoušku tvaru' },
    ASA: { nazev: 'ASA', hustota: 1.07, xy: 40, z: 22, pozn: 'odolné UV a teplu – venkovní dveře, branky' },
    ABS: { nazev: 'ABS', hustota: 1.04, xy: 38, z: 20, pozn: 'odolné teplu, dá se vyhladit acetonem, tiskne se v uzavřené tiskárně' },
    PA: { nazev: 'PA (nylon)', hustota: 1.14, xy: 50, z: 28, pozn: 'nejhouževnatější, kluzný – vydrží otlačení čtyřhranu; nasává vlhkost' },
    PC: { nazev: 'PC', hustota: 1.2, xy: 60, z: 35, pozn: 'pevné a teplu odolné, náročný tisk' },
  };
  const KOLIK_DILU = { klika: 'Klika', knob: 'Knob', rozeta: 'Rozeta', rozetaKlic: 'Rozeta klíče', stit: 'Štít' };

  const VYCHOZI = {
    nazev: 'Klika',
    typ: 'klika',
    vreteno: { norma: 'eu8', s: 8, vule: 0.15, hloubka: 0, pouzdro: false, pouzdroStena: 1 },
    sroub: { velikost: 'M4', prumer: 4, uchyceni: 'matice', vyska: 0, predvrt: 0, hlava: 0, hlavaHloubka: 0, hlavaTvar: 'auto' },
    dvere: { tloustka: 40, trn: 55, strana: 'prava', sada: true },
    klika: { tvar: 'rovna', delka: 130, vylozeni: 62, prurez: 'zaobleny', vyska: 20, tloustka: 14, zuzeni: 10, ohyb: 14, navrat: 30, prohnuti: 14, krcek: 20, seminko: 1 },
    knob: { tvar: 'koule', prumer: 56, hlava: 50, vylozeni: 64, krcek: 24, podrez: true, pudorys: 'kruh', pocet: 8, hloubka: 1.5, seminko: 1, stoupani: 90, pomer: 0.8 },
    podlozeni: { druh: 'rozeta', tvar: 'kruh', sirka: 52, vyska: 52, tloustka: 9, zaobleni: 3, sroub: 'vrut35', roztecSr: 38,
      klic: 'BB', roztec: 72, stitSirka: 44, stitVyska: 190 },
    // osazení na konci krčku: užší čep, který zajede do otvoru rozety / štítu; 0 = automaticky
    osazeni: { hloubka: 0, prumer: 0 },
    krcek: { tvar: 'valec', mira: 1, hrany: 0, seminko: 1 },
    tisk: { material: 'PETG', vypln: 100, previs: 45, orientace: 'auto', rozpulit: false },
    pevnost: { sila: 150, moment: 8 },
  };

  const ROZSAHY = {
    'vreteno.s': [4, 14], 'vreteno.vule': [-0.2, 0.8], 'vreteno.hloubka': [0, 80], 'vreteno.pouzdroStena': [0.5, 3],
    'sroub.vyska': [0, 60], 'sroub.prumer': [2, 8],
    'osazeni.hloubka': [0, 20], 'knob.stoupani': [-720, 720], 'knob.pomer': [0.4, 1], 'sroub.predvrt': [0, 10], 'sroub.hlava': [0, 20], 'sroub.hlavaHloubka': [0, 30], 'klika.seminko': [1, 999999], 'krcek.mira': [0, 2.5], 'krcek.seminko': [1, 999999], 'osazeni.prumer': [0, 50], 'knob.seminko': [1, 999999],
    'dvere.tloustka': [20, 100], 'dvere.trn': [25, 120],
    'klika.delka': [50, 220], 'klika.vylozeni': [25, 110], 'klika.vyska': [6, 50], 'klika.tloustka': [6, 40],
    'klika.zuzeni': [-60, 60], 'klika.ohyb': [3, 60], 'klika.navrat': [5, 100], 'klika.prohnuti': [0, 60], 'klika.krcek': [10, 40],
    'knob.prumer': [25, 100], 'knob.hlava': [12, 100], 'knob.vylozeni': [25, 120], 'knob.krcek': [10, 50],
    'knob.pocet': [3, 40], 'knob.hloubka': [0, 6],
    'podlozeni.sirka': [25, 120], 'podlozeni.vyska': [25, 120], 'podlozeni.tloustka': [2, 20], 'podlozeni.zaobleni': [0, 10],
    'podlozeni.roztecSr': [10, 100], 'podlozeni.roztec': [40, 120],
    'podlozeni.stitSirka': [25, 90], 'podlozeni.stitVyska': [60, 320],
    'tisk.vypln': [0, 100], 'tisk.previs': [20, 70],
    'pevnost.sila': [0, 2000], 'pevnost.moment': [0, 60],
  };

  const PREDVOLBY = [
    { nazev: 'Klika rovná na rozetě – EU 8 mm', popis: 'interiérové dveře, kulatá rozeta Ø 52, samostatná rozeta pro obyčejný klíč (rozteč 72)',
      p: { typ: 'klika', vreteno: { norma: 'eu8' }, klika: { tvar: 'rovna', prurez: 'zaobleny', delka: 130, vylozeni: 62, vyska: 20, tloustka: 14, zuzeni: 10, krcek: 20 },
        podlozeni: { druh: 'rozeta', tvar: 'kruh', sirka: 52, vyska: 52, tloustka: 9, klic: 'BB', roztec: 72 } } },
    { nazev: 'Klika se štítem 72 mm – obyčejný klíč', popis: 'klasika českých interiérových dveří: štít 44 × 190, BB, trn 55',
      p: { typ: 'klika', vreteno: { norma: 'eu8' }, dvere: { trn: 55 }, sroub: { velikost: 'M3' }, klika: { tvar: 'rovna', prurez: 'oval', delka: 125, vylozeni: 60, vyska: 18, tloustka: 13, zuzeni: -15, krcek: 19 },
        podlozeni: { druh: 'stit', klic: 'BB', roztec: 72, stitSirka: 44, stitVyska: 190, tloustka: 8, zaobleni: 3 } } },
    { nazev: 'Klika U – trubka Ø 19, štít PZ 90', popis: 'moderní vzhled ohýbané trubky, vstupní dveře s cylindrickou vložkou',
      p: { typ: 'klika', vreteno: { norma: 'eu8' }, dvere: { tloustka: 60, trn: 60 }, sroub: { uchyceni: 'vlozka' }, klika: { tvar: 'trubka', prurez: 'kruh', delka: 135, vylozeni: 64, vyska: 19, tloustka: 19, zuzeni: 0, ohyb: 16, krcek: 24 },
        podlozeni: { druh: 'stit', klic: 'PZ', roztec: 90, stitSirka: 46, stitVyska: 230, tloustka: 9, zaobleni: 3, sroub: 'M4' } } },
    { nazev: 'Klika se zahnutým koncem – bezbariérová', popis: 'konec ramene se vrací ke dveřím, nezachytí oblečení; rozeta + WC',
      p: { typ: 'klika', klika: { tvar: 'navrat', prurez: 'zaobleny', delka: 135, vylozeni: 64, vyska: 22, tloustka: 15, zuzeni: 0, ohyb: 14, navrat: 40, krcek: 21 },
        podlozeni: { druh: 'rozeta', tvar: 'ctverec', sirka: 52, vyska: 52, tloustka: 9, klic: 'WC', roztec: 72 } } },
    { nazev: 'Klika prohnutá ke dveřím – plochá', popis: 'ploché rameno v mírném oblouku, hranatá rozeta, bez klíče',
      p: { typ: 'klika', klika: { tvar: 'oblouk', prurez: 'plochy', delka: 140, vylozeni: 64, vyska: 24, tloustka: 11, zuzeni: -20, prohnuti: 14, krcek: 20 },
        podlozeni: { druh: 'rozeta', tvar: 'ctverec', sirka: 50, vyska: 50, tloustka: 8, klic: 'zadny' } } },
    { nazev: 'Klika zahnutá dolů – ergonomická', popis: 'ovál, konec ramene klesá do dlaně (tiskne se na boku s podporami)',
      p: { typ: 'klika', klika: { tvar: 'dolu', prurez: 'oval', delka: 130, vylozeni: 62, vyska: 21, tloustka: 15, zuzeni: 5, prohnuti: 18, krcek: 21 },
        podlozeni: { druh: 'rozeta', tvar: 'kruh', sirka: 52, vyska: 52, tloustka: 9, klic: 'PZ', roztec: 72 } } },
    { nazev: 'Klika ze semínka 🎲 – ergonomická', popis: 'rameno po křivce do dlaně, konec stočený ke dveřím – tlačítkem 🎲 zkoušejte další',
      p: { typ: 'klika', klika: { tvar: 'generator', seminko: 1, delka: 135, vylozeni: 64, vyska: 20, tloustka: 15, krcek: 21 },
        podlozeni: { druh: 'rozeta', tvar: 'kruh', sirka: 54, vyska: 54, tloustka: 9, klic: 'PZ', roztec: 72 } } },
    { nazev: 'Kovaná klika se svitkem', popis: 'hranatý tepaný průřez, zkroucení 360°, stočený konec – na štítu s klíčem',
      p: { typ: 'klika', nazev: 'Kovaná klika', klika: { tvar: 'generator', seminko: 5, delka: 140, vylozeni: 64, vyska: 20, tloustka: 15, krcek: 21 },
        podlozeni: { druh: 'stit', klic: 'BB', roztec: 72, stitSirka: 46, stitVyska: 200, tloustka: 7, zaobleni: 1.5 } } },
    { nazev: 'US knob koule 2 1/4″ – 5/16″', popis: 'americký kulatý knob na rozetě 2 5/8″ (66,7 mm), trn 2 3/8″',
      p: { typ: 'knob', nazev: 'Knob', vreteno: { norma: 'us516' }, dvere: { tloustka: 44.5, trn: 60.3 }, sroub: { velikost: 'M4' },
        knob: { tvar: 'koule', prumer: 57, hlava: 52, vylozeni: 66, krcek: 26, podrez: true, pudorys: 'kruh' },
        podlozeni: { druh: 'rozeta', tvar: 'kruh', sirka: 66.7, vyska: 66.7, tloustka: 9, klic: 'zadny', sroub: 'vrut35', roztecSr: 48 } } },
    { nazev: 'US beehive knob – starý zámek 9/32″', popis: 'knob „úl“ s prstenci, štít s otvorem pro starý klíč',
      p: { typ: 'knob', nazev: 'Knob úl', vreteno: { norma: 'us932' }, dvere: { tloustka: 35, trn: 60.3 }, sroub: { velikost: 'M3' },
        knob: { tvar: 'ul', prumer: 56, hlava: 40, vylozeni: 70, krcek: 22, podrez: true, pudorys: 'kruh' },
        podlozeni: { druh: 'stit', klic: 'BB', roztec: 70, stitSirka: 50, stitVyska: 170, tloustka: 6, zaobleni: 2.5 } } },
    { nazev: 'Knob vejce – rýhovaný úchop', popis: 'vejčitý knob s 16 rýhami, kulatá rozeta',
      p: { typ: 'knob', nazev: 'Knob vejce', vreteno: { norma: 'eu8' }, knob: { tvar: 'vejce', prumer: 50, hlava: 58, vylozeni: 70, krcek: 22, podrez: true, pudorys: 'ryhy', pocet: 16, hloubka: 1.4 },
        podlozeni: { druh: 'rozeta', tvar: 'kruh', sirka: 54, vyska: 54, tloustka: 8, klic: 'zadny' } } },
    { nazev: 'Knob „krystal“ – 8 faset', popis: 'osmiboká koule jako broušené sklo, hranatá rozeta',
      p: { typ: 'knob', nazev: 'Knob krystal', vreteno: { norma: 'eu8' }, knob: { tvar: 'koule', prumer: 54, hlava: 50, vylozeni: 64, krcek: 22, podrez: true, pudorys: 'hrany', pocet: 8 },
        podlozeni: { druh: 'rozeta', tvar: 'ctverec', sirka: 54, vyska: 54, tloustka: 8, klic: 'zadny' } } },
    { nazev: 'Knob hřib – vchodové dveře', popis: 'široký hřib Ø 64 s podřezem pro tisk bez podpor, štít PZ 92',
      p: { typ: 'knob', nazev: 'Knob hřib', vreteno: { norma: 'eu10' }, dvere: { tloustka: 60, trn: 60 }, sroub: { velikost: 'M5' },
        knob: { tvar: 'hrib', prumer: 64, hlava: 30, vylozeni: 66, krcek: 26, podrez: true, pudorys: 'kruh' },
        podlozeni: { druh: 'stit', klic: 'PZ', roztec: 92, stitSirka: 50, stitVyska: 240, tloustka: 9, sroub: 'M5' } } },
    { nazev: 'Knob ze semínka 🎲', popis: 'tvar hlavy z generátoru – tlačítkem 🎲 zkoušejte další semínka',
      p: { typ: 'knob', nazev: 'Knob 🎲', vreteno: { norma: 'us516' }, dvere: { tloustka: 44.5, trn: 69.9 },
        knob: { tvar: 'generator', seminko: 2026, prumer: 56, hlava: 50, vylozeni: 68, krcek: 24, podrez: true, pudorys: 'kruh' },
        podlozeni: { druh: 'rozeta', tvar: 'kruh', sirka: 64, vyska: 64, tloustka: 8, klic: 'zadny', roztecSr: 46 } } },
    { nazev: 'Knob zvon s osazením do štítu', popis: 'zvonovitý knob, osazení Ø 18 × 5 mm do štítu 6 mm, šroub Ø 3,5 do závitu',
      p: { typ: 'knob', nazev: 'Knob zvon', vreteno: { norma: 'eu8' }, sroub: { velikost: 'vlastni', prumer: 3.5, uchyceni: 'zavit', vyska: 14 },
        knob: { tvar: 'zvon', prumer: 54, hlava: 44, vylozeni: 68, krcek: 23, podrez: true, pudorys: 'kruh' }, osazeni: { hloubka: 5, prumer: 18 },
        podlozeni: { druh: 'stit', klic: 'BB', roztec: 72, stitSirka: 48, stitVyska: 180, tloustka: 6, zaobleni: 2 } } },
    { nazev: 'Knob puk – nábytek a dvířka', popis: 'nízký váleček s fasetami, bez rozety',
      p: { typ: 'knob', nazev: 'Knob puk', vreteno: { norma: 'eu8' }, dvere: { sada: false }, knob: { tvar: 'valec', prumer: 46, hlava: 18, vylozeni: 40, krcek: 20, podrez: true, pudorys: 'hrany', pocet: 12 },
        podlozeni: { druh: 'zadne', klic: 'zadny' } } },
  ];

  /* ---------- drobnosti ---------- */
  const sl = (o, z) => { for (const k of Object.keys(z)) if (z[k] && typeof z[k] === 'object' && !Array.isArray(z[k]) && o[k] && typeof o[k] === 'object') sl(o[k], z[k]); else o[k] = z[k]; return o; };
  const omez = (x, a, b) => Math.max(a, Math.min(b, x));

  /** Doplní chybějící hodnoty, omezí rozsahy. Vrací {p, hlaseni: [texty o úpravách]}. */
  function normalizuj(vstup) {
    const p = kopie(VYCHOZI), hl = [];
    if (vstup && typeof vstup === 'object') sl(p, kopie(vstup));
    if (!['klika', 'knob'].includes(p.typ)) p.typ = 'klika';
    if (!VRETENA[p.vreteno.norma]) p.vreteno.norma = 'vlastni';
    if (VRETENA[p.vreteno.norma].s) p.vreteno.s = VRETENA[p.vreteno.norma].s;
    if (!(p.sroub.velikost in STAVECI)) p.sroub.velikost = 'M4';
    if (!['auto', 'kuzel', 'valec'].includes(p.sroub.hlavaTvar)) p.sroub.hlavaTvar = 'auto';
    if (!UCHYCENI[p.sroub.uchyceni]) p.sroub.uchyceni = 'matice';
    if (!['prava', 'leva'].includes(p.dvere.strana)) p.dvere.strana = 'prava';
    p.dvere.sada = !!p.dvere.sada;
    if (!TVARY_KLIKY[p.klika.tvar]) p.klika.tvar = 'rovna';
    if (!PRUREZY[p.klika.prurez]) p.klika.prurez = 'zaobleny';
    if (!TVARY_KNOBU[p.knob.tvar]) p.knob.tvar = 'koule';
    if (!PUDORYSY[p.knob.pudorys]) p.knob.pudorys = 'kruh';
    p.knob.podrez = !!p.knob.podrez;
    if (!PODLOZENI[p.podlozeni.druh]) p.podlozeni.druh = 'rozeta';
    if (!TVARY_ROZETY[p.podlozeni.tvar]) p.podlozeni.tvar = 'kruh';
    if (!SROUBY_ROZETY[p.podlozeni.sroub]) p.podlozeni.sroub = 'vrut35';
    if (!KLICE[p.podlozeni.klic]) p.podlozeni.klic = 'zadny';
    if (!MATERIALY[p.tisk.material]) p.tisk.material = 'PETG';
    p.tisk.rozpulit = !!p.tisk.rozpulit;
    p.vreteno.pouzdro = !!p.vreteno.pouzdro;
    normalizujVlastni(p);
    if (!TVARY_KRCKU[p.krcek.tvar]) p.krcek.tvar = 'valec';
    p.krcek.hrany = [0, 4, 6, 8].includes(+p.krcek.hrany) ? +p.krcek.hrany : 0;
    p.tisk.orientace = String(p.tisk.orientace || 'auto').slice(0, 20);
    p.nazev = String(p.nazev == null ? '' : p.nazev).slice(0, 120);
    for (const [c, [mn, mx]] of Object.entries(ROZSAHY)) {
      let h = cislo(vezmi(p, c), vezmi(VYCHOZI, c));
      if (h < mn || h > mx) { const o = omez(h, mn, mx); hl.push(`${c} ${fmt(h, 2)} → ${fmt(o, 2)}`); h = o; }
      poloz(p, c, h);
    }
    p.knob.pocet = Math.round(p.knob.pocet); p.knob.seminko = Math.round(p.knob.seminko); p.klika.seminko = Math.round(p.klika.seminko); p.krcek.seminko = Math.round(p.krcek.seminko);
    if (STAVECI[p.sroub.velikost]) p.sroub.prumer = STAVECI[p.sroub.velikost].d;
    delete p.podlozeni.zapusteni;   // nahrazeno osazením krčku (projekty před 11. 11. 2026)
    if (p.klika.prurez === 'kruh') p.klika.tloustka = p.klika.vyska;
    return { p, hlaseni: hl };
  }
  /** Projekt z předvolby i (výchozí hodnoty + hodnoty předvolby). */
  function zPredvolby(i) {
    const v = PREDVOLBY[i], p = normalizuj({}).p;
    sl(p, kopie(v.p));
    if (!v.p.nazev) p.nazev = v.p.typ === 'knob' ? 'Knob' : 'Klika';
    return normalizuj(p).p;
  }

  /* ---------- průřez ramene a páteř ---------- */
  /** Body superelipsy (u = výška, v = tloušťka) proti směru hodinových ručiček, M bodů (násobek 4). */
  function prurezBody(a, b, n, M) {
    const out = [];
    for (let k = 0; k < M; k++) {
      const t = 2 * Math.PI * k / M, c = Math.cos(t), s = Math.sin(t);
      out.push([a * Math.sign(c) * Math.abs(c) ** (2 / n), b * Math.sign(s) * Math.abs(s) ** (2 / n)]);
    }
    return out;
  }
  /** Plocha a moment setrvačnosti ∫u² dA mnohoúhelníku (ohyb svislou silou → u je ve směru síly). */
  function prurezMiry(body) {
    let A = 0, Iu = 0;
    for (let i = 0; i < body.length; i++) {
      const [x0, y0] = body[i], [x1, y1] = body[(i + 1) % body.length], c = x0 * y1 - x1 * y0;
      A += c / 2; Iu += c * (x0 * x0 + x0 * x1 + x1 * x1) / 12;
    }
    return { A: Math.abs(A), Iu: Math.abs(Iu) };
  }

  /** Páteř ramene kliky: vzorky {c (bod), t (tečna), s (měřítko průřezu), l (délka od začátku ramene)}.
     Vrací i délku kopule na konci a body potřebné pro kontroly. */
  function pater(p, z0) {
    if (p.klika.tvar === 'generator') return klikaZeSeminka(p);
    if (p.klika.tvar === 'vlastni') return klikaVlastni(p);
    const q = p.klika, H = q.vylozeni, L = q.delka, sk = 1 - q.zuzeni / 100;
    const vz = [];
    const tE = Math.min(q.vyska, q.tloustka) * sk, e = tE / 2;   // kopule na konci ≈ půlkoule
    const pridejUsecku = (A, B, krok = 3) => {
      const d = V.sub(B, A), l = V.len(d); if (l < 1e-9) return;
      const t = V.mul(d, 1 / l), n = Math.max(1, Math.ceil(l / krok));
      for (let i = vz.length ? 1 : 0; i <= n; i++) vz.push({ c: V.add(A, V.mul(d, i / n)), t });
    };
    // oblouk: bod(φ) = C + r (cos φ · a + sin φ · b), φ od 0 do f
    const pridejOblouk = (C, r, a, b, f) => {
      const n = Math.max(2, Math.ceil(Math.abs(f) / (5 * RAD)));
      for (let i = 1; i <= n; i++) {
        const fi = f * i / n, c = Math.cos(fi), s = Math.sin(fi);
        vz.push({ c: V.add(C, V.add(V.mul(a, r * c), V.mul(b, r * s))), t: V.norm(V.add(V.mul(a, -s), V.mul(b, c))) });
      }
    };
    let zacatekRamene = 0, Rb = 0;
    if (q.tvar === 'rovna') {
      pridejUsecku([0, 0, H], [L - e, 0, H]);
    } else if (q.tvar === 'navrat') {
      const Rr = Math.max(q.ohyb, q.tloustka * sk / 2 + 0.5), xb = L - Rr - q.tloustka * sk / 2;
      pridejUsecku([0, 0, H], [xb, 0, H]);
      pridejOblouk([xb, 0, H - Rr], Rr, [0, 0, 1], [1, 0, 0], Math.PI / 2);
      const zk = H - q.navrat + e;
      if (zk < H - Rr - 0.5) pridejUsecku([xb + Rr, 0, H - Rr], [xb + Rr, 0, zk]);
      Rb = Rr;
    } else if (q.tvar === 'oblouk' || q.tvar === 'dolu') {
      const X = L - e, d = Math.max(0.5, q.prohnuti), Ro = (X * X + d * d) / (2 * d), f = Math.atan2(X, Ro - d);
      const dolu = q.tvar === 'dolu' ? [0, 1, 0] : [0, 0, 1];
      vz.push({ c: [0, 0, H], t: [1, 0, 0] });
      pridejOblouk(V.sub([0, 0, H], V.mul(dolu, Ro)), Ro, dolu, [1, 0, 0], f);
    } else {   // trubka: svislý krček, ohyb, vodorovné rameno
      Rb = Math.max(q.ohyb, q.tloustka / 2 + 0.5);
      pridejUsecku([0, 0, z0], [0, 0, H - Rb]);
      pridejOblouk([Rb, 0, H - Rb], Rb, [-1, 0, 0], [0, 0, 1], Math.PI / 2);
      zacatekRamene = vz.length - 1;
      pridejUsecku([Rb, 0, H], [L - e, 0, H]);
    }
    // délka podél páteře a měřítko (zúžení jen na rameni, ne na svislé části trubky)
    let l = 0;
    vz.forEach((v, i) => { if (i) l += V.len(V.sub(v.c, vz[i - 1].c)); v.l = l; });
    const l0 = vz[zacatekRamene].l, lk = l - l0;
    for (const v of vz) v.s = v.l <= l0 ? 1 : 1 + (sk - 1) * (v.l - l0) / (lk || 1);
    return { vz, e, sk, Rb, zacatekRamene, delka: l };
  }
  /* ---------- klika ze semínka a vlastní klika (skica) ----------
     Obě se staví z jednoho popisu tvaru `par`:
       n (exponent průřezu), konec, body [{u, dz, dy, sh, st}] (u = 0 u krčku … 1 na konci ramene;
       dz = prohnutí ke dveřím (−), dy = pokles (−), sh / st = měřítko výšky / tloušťky průřezu),
       zkrut {od, do, uhel°} | null, kladivko (tepaný povrch), konecMira (velikost konce, 1 = výchozí).
     Generátor popis vylosuje ze semínka, skica ho dostane od uživatele. */
  const STYLY_KLIK = {
    moderni: 'moderní', ergo: 'ergonomická', kovana: 'kovaná', geometricka: 'geometrická', secese: 'secesní',
    baroko: 'barokní', industrialni: 'industriální', minimal: 'minimalistická', vlastni: 'vlastní',
  };
  const KONCE_KLIK = {
    kopule: 'zaoblený konec', kapka: 'kapka na konci', lopatka: 'rozšířená lopatka', koule: 'koule na konci', list: 'list na konci',
    navrat: 'konec stočený ke dveřím', svitek: 'stočený svitek', voluta: 'voluta nahoru',
  };
  const VLASTNI_KLIKA = {
    n: 2.4, konec: 'kapka', konecMira: 1, kladivko: false, zkrut: null,
    body: [{ u: 0, dz: 0, dy: 0, sh: 0.95, st: 1 }, { u: 0.35, dz: -1, dy: -1, sh: 0.95, st: 0.98 }, { u: 0.65, dz: -5, dy: -5, sh: 1.12, st: 1.06 }, { u: 1, dz: -9, dy: -8, sh: 0.95, st: 0.92 }],
  };
  const VLASTNI_KNOB = { body: [{ u: 0.08, r: 0.5 }, { u: 0.3, r: 0.92 }, { u: 0.55, r: 1 }, { u: 0.8, r: 0.85 }, { u: 0.95, r: 0.45 }] };

  /** Hladká křivka (Hermite) bodů [{u, …}] pro klíč k; nulaU0 = nulová směrnice na začátku (plynule od krčku). */
  function interpoluj(body, k, u, nulaU0) {
    const n = body.length;
    if (u <= body[0].u) return body[0][k];
    if (u >= body[n - 1].u) return body[n - 1][k];
    let i = 0; while (i < n - 2 && u > body[i + 1].u) i++;
    const a = body[i], b = body[i + 1], h = b.u - a.u || 1e-9, t = (u - a.u) / h;
    const smer = j => {
      if (j === 0) return nulaU0 ? 0 : (body[1][k] - body[0][k]) / (body[1].u - body[0].u || 1e-9);
      if (j === n - 1) return (body[j][k] - body[j - 1][k]) / (body[j].u - body[j - 1].u || 1e-9);
      return (body[j + 1][k] - body[j - 1][k]) / (body[j + 1].u - body[j - 1].u || 1e-9);
    };
    const m0 = smer(i) * h, m1 = smer(i + 1) * h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * a[k] + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * b[k] + (t3 - t2) * m1;
  }
  /** Popis kliky ze semínka (styl, průřez, křivky, konec). */
  function parametryZeSeminka(p) {
    const q = p.klika, H = q.vylozeni, t2 = q.tloustka / 2;
    const nah = rng(q.seminko * 7 + 3), mezi = (a, b) => a + (b - a) * nah(), vyber = a => a[Math.floor(nah() * a.length)];
    const VAHY = [['moderni', 0.17], ['ergo', 0.17], ['kovana', 0.16], ['geometricka', 0.1], ['secese', 0.12], ['baroko', 0.1], ['industrialni', 0.1], ['minimal', 0.08]];
    let hod = nah(), styl = 'moderni';
    for (const [k, w] of VAHY) { if (hod < w) { styl = k; break; } hod -= w; }
    const n = { moderni: mezi(2, 3), ergo: mezi(2, 2.5), kovana: mezi(5, 10), geometricka: mezi(5, 8), secese: mezi(2, 2.4), baroko: mezi(2, 2.3), industrialni: 2, minimal: mezi(3.5, 5) }[styl];
    const konec = vyber({ moderni: ['kopule', 'kapka', 'lopatka', 'koule'], ergo: ['navrat', 'kopule', 'kapka', 'navrat'], kovana: ['svitek', 'svitek', 'kapka', 'voluta', 'koule'],
      geometricka: ['lopatka', 'kopule'], secese: ['list', 'list', 'lopatka', 'voluta'], baroko: ['voluta', 'koule', 'svitek', 'kapka'],
      industrialni: ['koule', 'koule', 'kopule'], minimal: ['kopule', 'lopatka'] }[styl]);
    // průřez: plynulý přechod od kořene ke konci + jedno vyboulení pod dlaní
    const vyboul = { ergo: mezi(0.1, 0.22), moderni: mezi(0, 0.12), secese: mezi(0.15, 0.3), baroko: mezi(0.1, 0.2), industrialni: 0, minimal: mezi(0, 0.05) }[styl] ?? mezi(0, 0.06);
    const stred = mezi(0.5, 0.68), sirka = mezi(0.18, 0.28), boule = u => Math.exp(-(((u - stred) / sirka) ** 2));
    let shK = [mezi(0.92, 1), mezi(0.85, 1.02)], stK = [mezi(0.94, 1.04), mezi(0.82, 1)];
    if (styl === 'industrialni') { const k = mezi(0.82, 0.95); shK = [k, k]; stK = [k, k]; }
    if (styl === 'minimal') { stK = [mezi(0.65, 0.8), mezi(0.6, 0.75)]; shK = [mezi(1, 1.15), mezi(1, 1.15)]; }
    const sh = u => shK[0] + (shK[1] - shK[0]) * u + vyboul * boule(u);
    const st = u => stK[0] + (stK[1] - stK[0]) * u + vyboul * 0.6 * boule(u);
    // prohnutí ke dveřím a pokles: plynule narůstají od krčku ke konci (žádné vlnění)
    const ampZ = Math.min({ moderni: 12, ergo: 14, kovana: 7, geometricka: 4, secese: 14, baroko: 8, industrialni: 4, minimal: 3 }[styl], Math.max(0, H - t2 - 40));
    const ampY = { moderni: 6, ergo: 16, kovana: 5, geometricka: 0, secese: 12, baroko: 8, industrialni: 3, minimal: 0 }[styl];
    const narust = amp => { const a = [mezi(0, 0.35), mezi(0.3, 0.8), mezi(0.6, 1)].sort((x, y) => x - y).map(x => -x * amp); return [0, a[0], a[1], a[2]]; };
    const z4 = narust(ampZ * mezi(0.2, 1)), y4 = narust(ampY * mezi(0.2, 1));
    const body = [0, 1 / 3, 2 / 3, 1].map((u, i) => ({ u, dz: z4[i], dy: y4[i], sh: sh(u), st: st(u) }));
    // jemnější vzorky průřezu (vyboulení) mezi řídicími body
    const zaklad = body.slice();
    for (const u of [0.5, 0.6, 0.8, 0.9]) body.push({ u, dz: interpoluj(zaklad, 'dz', u, true), dy: interpoluj(zaklad, 'dy', u, true), sh: sh(u), st: st(u) });
    body.sort((a, b) => a.u - b.u);
    const zkrut = (styl === 'kovana' && nah() < 0.65) || (styl === 'baroko' && nah() < 0.25)
      ? { od: mezi(0.25, 0.4), do: mezi(0.55, 0.75), uhel: 90 * Math.floor(mezi(2, styl === 'baroko' ? 3 : 5)) } : null;
    return { styl, n, konec, body, zkrut, kladivko: styl === 'kovana', konecMira: mezi(0.85, 1.15), sem: q.seminko };
  }
  function klikaZeSeminka(p) { return klikaZParametru(p, parametryZeSeminka(p), true); }
  /** Vlastní klika ze skici (tvar „vlastni“). */
  function klikaVlastni(p) { return klikaZParametru(p, Object.assign({ styl: 'vlastni', sem: 1 }, p.klika.vlastni), false); }

  /** Páteř kliky z popisu tvaru. auto = generátor: při kolizi zkrátí svitek, pak zkusí jednodušší konec. */
  function klikaZParametru(p, par, auto) {
    const q = p.klika, H = q.vylozeni, L = q.delka, h2 = q.vyska / 2, t2 = q.tloustka / 2, n0 = par.n;
    const nah = rng(par.sem * 13 + 5), mezi = (a, b) => a + (b - a) * nah();
    const km = par.konecMira || 1;
    const zk = par.zkrut && par.zkrut.uhel ? par.zkrut : null;
    const twAt = u => (zk ? zk.uhel * RAD * Math.max(0, Math.min(1, (u - zk.od) / Math.max(0.01, zk.do - zk.od))) : 0);
    const kladivko = par.kladivko ? { a: mezi(0.01, 0.022), f1: mezi(0, 6.3), f2: mezi(0, 6.3) } : null;
    const B = par.body, f = (k, u) => interpoluj(B, k, u, k === 'dz' || k === 'dy');
    const shKon = f('sh', 1), stKon = f('st', 1);
    let konec = par.konec, uhelSv = (konec === 'voluta' ? 230 : 240) * Math.min(1.15, km) * RAD;
    for (let k = 0; k < 7; k++) {
      const vz = [];
      const tKon = t2 * stKon, hKon = h2 * shKon;
      const rSv = (konec === 'svitek' || konec === 'voluta') ? Math.max(11 * km, ((konec === 'voluta' ? hKon : tKon) * 0.7 + 1.5) / 0.5)
        : konec === 'navrat' ? Math.max(13 * km, tKon * 1.15 + 1.5) : 0;
      const kb = 1 + 0.5 * km;    // koule na konci
      const delkaKonce = { svitek: rSv * 1.1, voluta: rSv * 1.1, navrat: rSv + tKon, koule: 2 * Math.max(hKon, tKon) * kb }[konec] || Math.min(hKon, tKon) * 0.9;
      const Lm = Math.max(40, L - delkaKonce);
      // vzorky po stejné délce oblouku (ne po x) – strmý úsek skici tak nevytáhne dlouhé trojúhelníky a kontrola ohybu ho vidí
      const husto = [], ND = Math.ceil(Lm / 0.4);
      for (let i = 0; i <= ND; i++) { const u = i / ND; husto.push({ u, P: [u * Lm, f('dy', u), H + f('dz', u)] }); }
      let dl = 0; husto.forEach((h, i) => { if (i) dl += V.len(V.sub(h.P, husto[i - 1].P)); h.l = dl; });
      const N = Math.max(8, Math.ceil(dl / 2.5));
      for (let i = 0, j = 0; i <= N; i++) {
        const cil = dl * i / N; while (j < husto.length - 2 && husto[j + 1].l < cil) j++;
        const a = husto[j], b = husto[j + 1], t = (cil - a.l) / ((b.l - a.l) || 1), u = a.u + (b.u - a.u) * t;
        vz.push({ c: [u * Lm, f('dy', u), H + f('dz', u)], sh: Math.max(0.2, f('sh', u)), st: Math.max(0.2, f('st', u)), n: n0, tw: twAt(u), u0: u });
      }
      const posl = () => vz[vz.length - 1], tecna = (a, b) => V.norm(V.sub(b.c, a.c));
      const zona = (u, od) => { const w = Math.max(0, (u - od) / (1 - od)); return w * w * (3 - 2 * w); };
      if (konec === 'svitek' || konec === 'voluta' || konec === 'navrat') {
        const P = posl().c, T = tecna(vz[vz.length - 2], posl());
        const smer = konec === 'voluta' ? [0, 1, 0] : [0, 0, -1];         // voluta se stáčí nahoru, svitek a návrat ke dveřím
        const Nd = V.norm(V.sub(smer, V.mul(T, V.dot(smer, T))));
        const C = V.add(P, V.mul(Nd, rSv)), uhel = konec === 'navrat' ? 105 * RAD : uhelSv;
        const smrsk = konec === 'navrat' ? 1 : 0.58, m = Math.max(8, Math.ceil(uhel / (6 * RAD))), s0 = posl();
        for (let j = 1; j <= m; j++) {
          const fi = uhel * j / m, rr = rSv * (1 - (1 - smrsk) * j / m), sk = konec === 'navrat' ? 1 : 1 - 0.35 * j / m;
          vz.push({ c: V.add(C, V.add(V.mul(Nd, -rr * Math.cos(fi)), V.mul(T, rr * Math.sin(fi)))), sh: s0.sh * sk, st: s0.st * sk, n: n0, tw: s0.tw, u0: 1 });
        }
        if (konec === 'navrat') {
          const a = vz[vz.length - 2], b = posl(), T2 = tecna(a, b);
          for (let j = 1; j <= 3; j++) vz.push({ c: V.add(b.c, V.mul(T2, 7 * km * j / 3)), sh: b.sh, st: b.st, n: n0, tw: b.tw, u0: 1 });
        }
      } else if (konec === 'kapka' || konec === 'lopatka') {
        const kh = 1 + (konec === 'kapka' ? 0.28 : 0.35) * km, kt = konec === 'kapka' ? kh : 1 - 0.32 * Math.min(1.5, km);
        for (const v of vz) { const g = zona(v.u0, 0.75); v.sh *= 1 + (kh - 1) * g; v.st *= 1 + (kt - 1) * g; }
      } else if (konec === 'koule') {
        // krk před koulí se zúží, koule je kulatá (stejná výška i tloušťka)
        for (const v of vz) { const w = Math.max(0, (v.u0 - 0.8) / 0.2); v.sh *= 1 - 0.18 * Math.sin(Math.PI * Math.min(1, w * 1.4)); v.st *= 1 - 0.18 * Math.sin(Math.PI * Math.min(1, w * 1.4)); }
        const s0 = posl(), R = Math.max(hKon, tKon) * kb, T = tecna(vz[vz.length - 2], s0), m = 10;
        for (let j = 1; j <= m; j++) {   // náběh do koule (polokoule k ose)
          const fi = Math.PI / 2 * j / m, sc = Math.sin(fi);
          vz.push({ c: V.add(s0.c, V.mul(T, R * (1 - Math.cos(fi)))), sh: Math.max(s0.sh, R * sc / h2), st: Math.max(s0.st, R * sc / t2), n: 2, tw: s0.tw, u0: 1 });
        }
      } else if (konec === 'list') {
        const kh = 1 + 0.55 * km, kt = 0.62;
        for (const v of vz) {
          const w = Math.max(0, (v.u0 - 0.55) / 0.45);
          const fh = w < 0.7 ? 1 + (kh - 1) * Math.sin(Math.PI / 2 * w / 0.7) : kh - (kh - 0.45) * ((w - 0.7) / 0.3) ** 1.3;
          v.sh *= fh; v.st *= 1 + (kt - 1) * zona(v.u0, 0.55);
        }
      }
      // tečny, rám paralelním přenosem, délka
      let l = 0, u = [0, 1, 0];
      vz.forEach((v, i) => {
        const a = vz[Math.max(0, i - 1)], b = vz[Math.min(vz.length - 1, i + 1)];
        v.t = V.norm(V.sub(b.c, a.c));
        u = V.norm(V.sub(u, V.mul(v.t, V.dot(u, v.t))));
        v.u = u; v.s = Math.min(v.sh, v.st);
        if (i) l += V.len(V.sub(v.c, vz[i - 1].c)); v.l = l;
        if (kladivko) v.kl = kladivko;
      });
      const pv = vz[vz.length - 1], e = Math.min(h2 * pv.sh, t2 * pv.st) * ({ svitek: 0.8, voluta: 0.8, koule: 1 }[konec] || 0.9);
      // kontroly: rameno se nesmí protnout samo se sebou, přeložit v ohybu ani sahat ke dveřím
      const rad = v => Math.max(h2 * v.sh, t2 * v.st);
      let kolize = '';
      for (let i = 0; i < vz.length && !kolize; i += 2) for (let j = i + 4; j < vz.length; j += 2) {
        if (vz[j].l - vz[i].l < 2.2 * (rad(vz[i]) + rad(vz[j]))) continue;
        if (V.len(V.sub(vz[i].c, vz[j].c)) < rad(vz[i]) + rad(vz[j]) + 1) { kolize = 'krizi'; break; }
      }
      for (let i = 1; i + 1 < vz.length && !kolize; i++) {
        const A = vz[i - 1].c, Bb = vz[i].c, C = vz[i + 1].c, a = V.len(V.sub(Bb, C)), b = V.len(V.sub(A, C)), c = V.len(V.sub(A, Bb));
        const plocha2 = V.len(V.cross(V.sub(Bb, A), V.sub(C, A)));
        if (plocha2 < 1e-9) continue;
        const sm = V.norm(V.sub(V.mul(V.add(A, C), 0.5), Bb)), w = V.cross(vz[i].t, vz[i].u);
        const pul = Math.abs(V.dot(sm, vz[i].u)) * h2 * vz[i].sh + Math.abs(V.dot(sm, w)) * t2 * vz[i].st;
        if (a * b * c / (2 * plocha2) < pul + 0.5) kolize = 'ohyb';
      }
      if (!kolize && Math.min(...vz.map(v => v.c[2] - rad(v))) < 6) kolize = 'dvere';
      if (kolize && auto && k < 6) {
        if ((konec === 'svitek' || konec === 'voluta') && uhelSv > 150 * RAD) uhelSv -= 35 * RAD;
        else konec = konec === 'koule' || konec === 'list' ? 'kapka' : 'kopule';
        continue;
      }
      const soumerna = !zk && !kladivko && konec !== 'voluta' && vz.every(v => Math.abs(v.c[1]) < 1e-9);
      return { vz, e, sk: 1, Rb: konec === 'navrat' ? rSv : 0, zacatekRamene: 0, delka: l, soumerna, styl: par.styl, konec, kolize,
        popis: `${STYLY_KLIK[par.styl]} klika – ${KONCE_KLIK[konec]}${zk ? `, zkroucení ${Math.round(zk.uhel)}°` : ''}${kladivko ? ', tepaný povrch' : ''}` };
    }
  }
  /** Popis vlastní kliky z generátoru (pro „Upravit ve skice“). */
  function vlastniZeSeminka(p) {
    const par = parametryZeSeminka(p), pat = klikaZeSeminka(p);
    const r2 = x => Math.round(x * 100) / 100;
    return { n: r2(par.n), konec: pat.konec, konecMira: r2(par.konecMira), kladivko: par.kladivko,
      zkrut: par.zkrut ? { od: r2(par.zkrut.od), do: r2(par.zkrut.do), uhel: par.zkrut.uhel } : null,
      body: par.body.map(b => ({ u: r2(b.u), dz: r2(b.dz), dy: r2(b.dy), sh: r2(b.sh), st: r2(b.st) })) };
  }
  /** Obrys knobu do skici: body (u, r) normované na výšku a průměr hlavy, bez pólů. */
  function vlastniKnobZTvaru(p) {
    const q = Object.assign({}, p.knob), zb = 0, zt = 1;
    const telo = teloKnobu(Object.assign(q, { prumer: 2, vylozeni: 1, hlava: 1 }), zb, zt);
    // rovnoměrně po délce obrysu, 9 bodů mezi póly
    const del = [0]; for (let i = 1; i < telo.length; i++) del.push(del[i - 1] + Math.hypot(telo[i][0] - telo[i - 1][0], telo[i][1] - telo[i - 1][1]));
    const out = [];
    for (let k = 1; k <= 9; k++) {
      const d = del[del.length - 1] * k / 10; let i = del.findIndex(x => x >= d); i = Math.max(1, i);
      const t = (d - del[i - 1]) / (del[i] - del[i - 1] || 1), r = telo[i - 1][0] + (telo[i][0] - telo[i - 1][0]) * t, u = telo[i - 1][1] + (telo[i][1] - telo[i - 1][1]) * t;
      out.push({ u: Math.round(Math.min(0.99, Math.max(0.01, u)) * 1000) / 1000, r: Math.round(Math.min(1, Math.max(0.05, r)) * 1000) / 1000 });
    }
    return { body: out.sort((a, b) => a.u - b.u) };
  }
  /** Úchyty bodu (in, out) v souřadnicích (r, u): hladký = Catmull-Rom, roh = bez úchytů, bezier / uzel = uložené h1 / h2. */
  function uchytyBodu(P, i) {
    const b = P[i], typ = b.typ || 'hladky';
    if (typ === 'pol0') return { in: [0, 0], out: [0.5 * (P[1] ? P[1].r : 0.5), 0] };
    if (typ === 'pol1') return { in: [0.5 * (P[i - 1] ? P[i - 1].r : 0.5), 0], out: [0, 0] };
    if (typ === 'roh') return { in: [0, 0], out: [0, 0] };
    if ((typ === 'bezier' || typ === 'uzel') && b.h1 && b.h2) return { in: [b.h1.dr, b.h1.du], out: [b.h2.dr, b.h2.du] };
    const a = P[Math.max(0, i - 1)], c = P[Math.min(P.length - 1, i + 1)], t = [(c.r - a.r) / 6, (c.u - a.u) / 6];
    return { in: [-t[0], -t[1]], out: t };
  }
  /** Křivka skici (krokově vzorkované kubické Bézierovy úseky) → [[r, u], …]. hlava = přidat póly (r = 0) dole a nahoře. */
  function krivkaProfilu(body, hlava, kroku = 16) {
    const P = hlava ? [{ u: 0, r: 0, typ: 'pol0' }].concat(body, [{ u: 1, r: 0, typ: 'pol1' }]) : body.slice();
    const H = P.map((b, i) => uchytyBodu(P, i)), out = [[P[0].r, P[0].u]];
    for (let i = 0; i + 1 < P.length; i++) {
      const a = [P[i].r, P[i].u], d = [P[i + 1].r, P[i + 1].u];
      const b = [a[0] + H[i].out[0], a[1] + H[i].out[1]], c = [d[0] + H[i + 1].in[0], d[1] + H[i + 1].in[1]];
      for (let k = 1; k <= kroku; k++) {
        const t = k / kroku, m = 1 - t;
        out.push([m * m * m * a[0] + 3 * m * m * t * b[0] + 3 * m * t * t * c[0] + t * t * t * d[0], m * m * m * a[1] + 3 * m * m * t * b[1] + 3 * m * t * t * c[1] + t * t * t * d[1]]);
      }
    }
    return out;
  }
  /** Protíná se lomená čára sama se sebou (kromě sousedních úseků)? */
  function protinaSe(L) {
    const x = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    for (let i = 0; i + 1 < L.length; i++) for (let j = i + 2; j + 1 < L.length; j++) {
      if (i === 0 && j === L.length - 2) continue;
      const a = L[i], b = L[i + 1], c = L[j], d = L[j + 1];
      if (Math.max(a[0], b[0]) < Math.min(c[0], d[0]) || Math.max(c[0], d[0]) < Math.min(a[0], b[0]) || Math.max(a[1], b[1]) < Math.min(c[1], d[1]) || Math.max(c[1], d[1]) < Math.min(a[1], b[1])) continue;
      if (x(a, b, c) * x(a, b, d) < -1e-12 && x(c, d, a) * x(c, d, b) < -1e-12) return true;
    }
    return false;
  }
  /** Body skici (knob, krček): typy hladky / roh / bezier / uzel, úchyty h1 (dovnitř), h2 (ven), meze. */
  function normalizujBodySkici(body, vychozi, meze) {
    const om = (x, a, b, d) => Math.max(a, Math.min(b, cislo(x, d)));
    let B = Array.isArray(body) ? body.filter(b => b && typeof b === 'object').slice(0, 40) : [];
    if (B.length < 2) B = kopie(vychozi);
    return B.map(b => {
      const typ = ['hladky', 'roh', 'bezier', 'uzel'].includes(b.typ) ? b.typ : 'hladky';
      const o = { u: om(b.u, meze.u[0], meze.u[1], 0.5), r: om(b.r, meze.r[0], meze.r[1], 0.5) };
      if (typ !== 'hladky') o.typ = typ;
      if (typ === 'bezier' || typ === 'uzel') for (const h of ['h1', 'h2']) { const v = b[h] || {}; o[h] = { du: om(v.du, -1, 1, 0), dr: om(v.dr, -1.5, 1.5, 0) }; }
      return o;
    });
  }
  const VLASTNI_KRCEK = { body: [{ u: 0, r: 1.25 }, { u: 0.25, r: 1.05 }, { u: 0.6, r: 1 }, { u: 1, r: 1 }] };
  /** Ošetří vlastní kliku / knob z úložiště nebo souboru (meze, pořadí, počet bodů). */
  function normalizujVlastni(p) {
    const omezC = (x, a, b, d) => { const c = cislo(x, d); return Math.max(a, Math.min(b, c)); };
    const k = p.klika.vlastni && typeof p.klika.vlastni === 'object' ? p.klika.vlastni : kopie(VLASTNI_KLIKA);
    let body = Array.isArray(k.body) ? k.body.filter(b => b && typeof b === 'object').slice(0, 40) : [];
    if (body.length < 2) body = kopie(VLASTNI_KLIKA.body);
    body = body.map(b => ({ u: omezC(b.u, 0, 1, 0.5), dz: omezC(b.dz, -45, 25, 0), dy: omezC(b.dy, -45, 45, 0), sh: omezC(b.sh, 0.3, 2.5, 1), st: omezC(b.st, 0.3, 2.5, 1) }))
      .sort((a, b) => a.u - b.u);
    body[0].u = 0; body[body.length - 1].u = 1; body[0].dz = 0; body[0].dy = 0;
    for (let i = 1; i < body.length; i++) if (body[i].u - body[i - 1].u < 0.02) body[i].u = Math.min(1, body[i - 1].u + 0.02);
    body = body.filter((b, i) => i === body.length - 1 || b.u < body[body.length - 1].u - 0.015 || i === 0);
    // zkroucení vždy jako objekt (uhel 0 = bez zkroucení) – formulář na něj váže pole
    const zz = k.zkrut && typeof k.zkrut === 'object' ? k.zkrut : {};
    const zk = { od: omezC(zz.od, 0, 0.95, 0.3), do: 0, uhel: omezC(zz.uhel, 0, 1080, 0) };
    zk.do = Math.max(zk.od + 0.05, omezC(zz.do, 0.05, 1, 0.7));
    p.klika.vlastni = { n: omezC(k.n, 2, 12, 2.4), konec: KONCE_KLIK[k.konec] ? k.konec : 'kapka', konecMira: omezC(k.konecMira, 0.5, 2, 1),
      kladivko: !!k.kladivko, zkrut: zk, body };
    const kn = p.knob.vlastni && typeof p.knob.vlastni === 'object' ? p.knob.vlastni : {};
    p.knob.vlastni = { body: normalizujBodySkici(kn.body, VLASTNI_KNOB.body, { u: [0.005, 0.995], r: [0.02, 1] }) };
    // skica krčku: r = násobek průměru krčku; konec u hlavy (u = 1) navazuje na krček (r = 1)
    if (p.krcek) {
      const kk = p.krcek.vlastni && typeof p.krcek.vlastni === 'object' ? p.krcek.vlastni : {};
      const B = normalizujBodySkici(kk.body, VLASTNI_KRCEK.body, { u: [0, 1], r: [0.4, 3] }).sort((a, b) => a.u - b.u);
      B[0].u = 0; B[B.length - 1].u = 1; B[B.length - 1].r = 1;
      p.krcek.vlastni = { body: B };
    }
  }
  /** Body průřezu ve vzorku páteře (3D): vlastní rám, měřítka, natočení a „kladívkování“; f = zmenšení (kopule). */
  function kruhPateru(v, h2, t2, n, M, f = 1) {
    const { u, v: w } = v.u ? { u: v.u, v: V.cross(v.t, v.u) } : osyPrurezu(v.t);
    const shh = (v.sh ?? v.s) * f, stt = (v.st ?? v.s) * f, c = Math.cos(v.tw || 0), s = Math.sin(v.tw || 0);
    return prurezBody(h2 * shh, t2 * stt, v.n || n, M).map(([a, b], k) => {
      let a2 = a * c - b * s, b2 = a * s + b * c;
      if (v.kl) { const th = 2 * Math.PI * k / M, g = 1 + v.kl.a * Math.sin(4 * th + v.kl.f1 + 0.29 * v.l) * Math.sin(3 * th + v.kl.f2 + 0.17 * v.l); a2 *= g; b2 *= g; }
      return V.add(v.c, V.add(V.mul(u, a2), V.mul(w, b2)));
    });
  }
  /** Osy průřezu ve vzorku páteře: hu = výška (co nejblíž svislé), hv = tloušťka. */
  function osyPrurezu(t) {
    let u = V.sub([0, 1, 0], V.mul(t, t[1]));
    if (V.len(u) < 1e-6) u = V.sub([0, 0, 1], V.mul(t, t[2]));
    u = V.norm(u);
    return { u, v: V.cross(t, u) };
  }

  /* ---------- profil knobu ---------- */
  /** Pseudonáhodný generátor (mulberry32) – stejné semínko = stejný tvar. */
  function rng(seminko) {
    let a = (seminko >>> 0) || 1;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  /** Tvar hlavy ze semínka: funkce poloměru f(u) na výšce u ∈ 0..1 (0 = u krčku, 1 = vrchol), f(0) = f(1) = 0.
     Skládá se z obálky (kde je nejširší, jak tupý je spodek a vršek), plynulého zvlnění obrysu a prstenců. */
  function tvarZeSeminka(seminko) {
    const nah = rng(seminko), mezi = (a, b) => a + (b - a) * nah();
    const m = mezi(0.28, 0.68), pb = mezi(0.3, 0.9), pt = mezi(0.15, 0.62);   // pt > 0,65 = ostrá špička, nepříjemná do dlaně
    const body = Array.from({ length: 5 }, () => mezi(0.72, 1));          // zvlnění obrysu (pas, boule)
    const prstencu = nah() < 0.45 ? 0 : Math.floor(mezi(1, 6)), amp = mezi(0.025, 0.08);
    const pasOd = mezi(0.1, 0.4), pasDo = Math.min(0.95, pasOd + mezi(0.25, 0.55));
    const hladce = (u) => {   // kosinová interpolace řídicích bodů
      const x = u * (body.length - 1), i = Math.min(body.length - 2, Math.floor(x)), t = (1 - Math.cos(Math.PI * (x - i))) / 2;
      return body[i] * (1 - t) + body[i + 1] * t;
    };
    const f = u => {
      const ob = u < m ? Math.sin(Math.PI / 2 * u / m) ** pb : Math.cos(Math.PI / 2 * (u - m) / (1 - m)) ** pt;
      let r = ob * hladce(u);
      if (prstencu && u > pasOd && u < pasDo) r *= 1 - amp * Math.sin(Math.PI * prstencu * (u - pasOd) / (pasDo - pasOd)) ** 2;
      return r;
    };
    return { f, popis: `nejširší ve ${Math.round(m * 100)} % výšky, ${prstencu ? prstencu + ' prstenců' : 'bez prstenců'}` };
  }
  /** Pojmenované tvary popsané funkcí poloměru f(u) (viz tvarZeSeminka). */
  const FUNKCE_KNOBU = {
    hruska: u => (0.38 + 0.62 * u ** 1.4) * Math.sin(Math.PI / 2 * Math.min(1, u / 0.08)) ** 0.5 * (u > 0.7 ? Math.cos(Math.PI / 2 * (u - 0.7) / 0.3) ** 0.45 : 1),
    cocka: u => (1 - Math.abs(2 * u - 1) ** 1.45) ** (1 / 1.45),
    zvon: u => (0.4 + 0.6 * u ** 1.7) * Math.sin(Math.PI / 2 * Math.min(1, u / 0.06)) ** 0.5 * (u > 0.86 ? Math.cos(Math.PI / 2 * (u - 0.86) / 0.14) ** 0.5 : 1),
    soudek: u => Math.sin(Math.PI * u) ** 0.32 * (1 - 0.06 * Math.sin(Math.PI * 5 * u) ** 2),
    // americké standardní tvary dveřních knobů (obecné typy, ne konkrétní výrobky)
    tulipan: u => (0.42 + 0.58 * Math.sin(Math.PI / 2 * Math.min(1, u / 0.78)) ** 1.6) * zaver(u, 0.03, 0.8, 3),
    pasazni: u => (0.78 + 0.22 * Math.min(1, u / 0.75)) * zaver(u, 0.06, 0.86, 5),
    konkavni: u => (0.4 + 0.6 * u ** 2.2) * zaver(u, 0.05, 0.9, 4),
    stupnovity: u => (u < 0.55 ? 0.62 + 0.38 * Math.sin(Math.PI / 2 * Math.min(1, u / 0.35)) : 1 - 0.18 * Math.min(1, (u - 0.55) / 0.04)) * zaver(u, 0.04, 0.8, 2.2),
    disk: u => zaver(u, 0.18, 0.72, 2.6),
    orbit: u => { const v = 0.08 + 0.82 * u; return Math.sqrt(Math.max(0, 1 - (2 * v - 1) ** 2)) * zaver(u, 0.02, 0.96, 8); },   // koule seříznutá ploškou
  };
  /** Uzávěr profilu k pólům: dole za `od` náběh, nahoře od `do` superelipsa s exponentem e (velké e = plochá čelní plocha). */
  function zaver(u, od, ddo, e) {
    const dole = u < od ? Math.sin(Math.PI / 2 * u / od) ** 0.5 : 1;
    const nahore = u > ddo ? Math.max(0, 1 - ((u - ddo) / (1 - ddo)) ** e) ** (1 / e) : 1;
    return dole * nahore;
  }
  /** Body těla hlavy (r, z) od spodního pólu po horní; zb = spodek hlavy, zt = vršek. */
  function teloKnobu(q, zb, zt) {
    const R = q.prumer / 2, Hh = zt - zb, out = [], N = 64;
    if (q.tvar === 'koule' || q.tvar === 'vejce') {
      const a1 = q.tvar === 'vejce' ? 0.58 * Hh : Hh / 2, a2 = Hh - a1, zc = zb + a1;
      for (let i = 0; i <= N; i++) { const f = -Math.PI / 2 + Math.PI * i / N; out.push([R * Math.cos(f), zc + (f < 0 ? a1 : a2) * Math.sin(f)]); }
    } else if (q.tvar === 'hrib') {
      const rr = Math.min(Hh * 0.22, R * 0.3), lem = Math.max(rr, Hh * 0.38), kopule = Hh - lem;
      out.push([0, zb]);
      for (let i = 0; i <= 8; i++) { const f = -Math.PI / 2 + Math.PI / 2 * i / 8; out.push([R - rr + rr * Math.cos(f), zb + rr + rr * Math.sin(f)]); }
      if (lem > rr + 1e-6) out.push([R, zb + lem]);
      for (let i = 1; i <= N; i++) { const f = Math.PI / 2 * i / N; out.push([R * Math.cos(f) ** (2 / 2.4), zb + lem + kopule * Math.sin(f) ** (2 / 2.4)]); }
    } else if (q.tvar === 'valec') {
      const rr = Math.min(Hh / 2, R) * 0.45;
      out.push([0, zb]);
      for (let i = 0; i <= 8; i++) { const f = -Math.PI / 2 + Math.PI / 2 * i / 8; out.push([R - rr + rr * Math.cos(f), zb + rr + rr * Math.sin(f)]); }
      for (let i = 0; i <= 8; i++) { const f = Math.PI / 2 * i / 8; out.push([R - rr + rr * Math.cos(f), zt - rr + rr * Math.sin(f)]); }
      out.push([0, zt]);
    } else if (q.tvar === 'miska') {   // puk s prohloubenou miskou na palec
      const rr = Math.min(Hh / 2, R) * 0.4, dno = Math.min(Hh * 0.35, R * 0.18);
      out.push([0, zb]);
      for (let i = 0; i <= 8; i++) { const f = -Math.PI / 2 + Math.PI / 2 * i / 8; out.push([R - rr + rr * Math.cos(f), zb + rr + rr * Math.sin(f)]); }
      for (let i = 0; i <= 8; i++) { const f = Math.PI / 2 * i / 8; out.push([R - rr + rr * Math.cos(f), zt - rr + rr * Math.sin(f)]); }
      for (let i = 1; i <= 24; i++) { const t = i / 24, r = (R - rr) * (1 - t); out.push([r, zt - dno * (1 - (r / (R - rr)) ** 2) * Math.min(1, t * 4)]); }
      out[out.length - 1] = [0, zt - dno];
    } else if (q.tvar === 'vlastni') {
      // skica: Bézierova křivka přes body, k pólům vodorovně (kulatý / plochý spodek i vršek)
      const K2 = krivkaProfilu((q.vlastni || VLASTNI_KNOB).body, true);
      K2.forEach(([r, u], i) => out.push([i === 0 || i === K2.length - 1 ? 0 : R * Math.max(0.005, Math.min(1, r)), zb + Hh * Math.max(0, Math.min(1, u))]));
    } else if (FUNKCE_KNOBU[q.tvar] || q.tvar === 'generator') {
      const f = q.tvar === 'generator' ? tvarZeSeminka(q.seminko).f : FUNKCE_KNOBU[q.tvar];
      const us = Array.from({ length: 241 }, (_, i) => i / 240), rs = us.map(u => { const v = f(u); return Number.isFinite(v) ? Math.max(0, v) : 0; });   // záporná mocnina na okraji = NaN
      const mx = Math.max(...rs) || 1;
      us.forEach((u, i) => out.push([i === 0 || i === us.length - 1 ? 0 : R * rs[i] / mx, zb + Hh * u]));
    } else {   // úl: kopule s prstenci, široká dole
      out.push([0, zb]);
      for (let i = 0; i <= 96; i++) {
        const u = i / 96, r = R * Math.sqrt(Math.max(0, 1 - u ** 2.3)) * (1 - 0.07 * Math.sin(Math.PI * 4 * u) ** 2);
        out.push([r, zb + Hh * u]);
      }
      out[out.length - 1][0] = 0;
    }
    return out;
  }
  /** Celý profil knobu (r, z) od kraje podstavy po vrchol: krček, případně podřez 45°, hlava. */
  function profilKnobu(q, z0, fK = () => 1, rMax = Infinity, fMin = 1) {
    const R = q.prumer / 2, rn = q.krcek / 2, zt = q.vylozeni, zb = zt - q.hlava;
    const telo = teloKnobu(q, zb, zt);
    let iMax = 0; telo.forEach((b, i) => { if (b[0] > telo[iMax][0] + 1e-9) iMax = i; });
    const fKr = u => Math.max(fMin, Math.min(fK(u), 0.95 * R / rn, rMax / rn));   // rozšířený krček nesmí přerůst hlavu ani desku
    const out = [[rn * fKr(0), z0]];
    let zNapoj, iNapoj;
    const krcekDo = zh => { const M = Math.max(2, Math.ceil((zh - z0) / 0.5)); for (let k = 1; k <= M; k++) out.push([rn * fKr(k / M), z0 + (zh - z0) * k / M]); };
    if (q.podrez) {
      // kužel 45° z krčku tečně k hlavě: r = rn + (z − za); aby zakryl celý spodek hlavy (doplní materiál pod převisy),
      // musí být všude vně těla → za = min(z_i − r_i + rn) přes spodní část hlavy, tečný bod = ten minimální
      let za = Infinity;
      for (let i = 0; i <= iMax; i++) { const v = telo[i][1] - telo[i][0] + rn; if (telo[i][0] >= rn - 1e-9 && v < za - 1e-9) { za = v; iNapoj = i; } }
      // krček širší než hlava: žádný bod hlavy nesahá za krček → napojit na nejširší místo (kontrola to hlásí)
      if (iNapoj === undefined) { iNapoj = iMax; za = telo[iMax][1]; }
      zNapoj = za;
      if (za > z0 + 1e-6) krcekDo(za);
      else out[0] = [rn + (z0 - za), z0];
    } else {
      iNapoj = telo.findIndex(b => b[0] >= rn - 1e-9);
      if (iNapoj < 0) iNapoj = iMax;   // krček širší než hlava – napojí se na nejširší místo (kontrola to hlásí)
      zNapoj = telo[iNapoj][1];
      if (zNapoj > z0 + 1e-6) krcekDo(zNapoj);
    }
    for (let i = iNapoj; i < telo.length; i++) {
      const b = telo[i], pred = out[out.length - 1];
      if (i <= iMax && b[1] < pred[1] - 1e-9) continue;   // nad nejširším místem smí obrys klesat (miska)
      if (Math.abs(b[0] - pred[0]) < 1e-6 && Math.abs(b[1] - pred[1]) < 1e-6) continue;
      out.push([b[0], b[1]]);
    }
    if (out[out.length - 1][0] > 1e-9) out.push([0, zt]);
    return { body: out, R, rn, zt, zb, zNapoj, rMaxZ: telo[iMax][1], podstava: out[0][0] };
  }
  /** Tvar krčku: činitel poloměru f(u) ≥ 1 na výšce u ∈ 0..1 (0 = u rozety, 1 = pod ramenem / hlavou), f(1) = 1. */
  function krcekFunkce(k) {
    const m = k.mira, perla = (c, w, a) => u => a * Math.sqrt(Math.max(0, 1 - ((u - c) / w) ** 2));
    const hladce = (u, a, b) => { const t = Math.max(0, Math.min(1, (u - a) / (b - a))); return t * t * (3 - 2 * t); };
    const sl = fs => u => 1 + fs.reduce((s, g) => s + g(u), 0);
    switch (k.tvar) {
      case 'kuzel': return { f: u => 1 + 0.32 * m * (1 - u), popis: 'kužel' };
      case 'zvon': return { f: u => 1 + 0.7 * m * (1 - u) ** 2.6, popis: 'trumpeta' };
      case 'prstence': return { f: sl([perla(0.22, 0.09, 0.16 * m), perla(0.5, 0.09, 0.16 * m), perla(0.78, 0.09, 0.16 * m)]), popis: '3 prstence' };
      case 'stupne': return { f: u => 1 + 0.3 * m * (1 - hladce(u, 0.26, 0.31)) + 0.15 * m * (1 - hladce(u, 0.56, 0.61)), popis: 'stupně' };
      case 'baluster': return { f: u => 1 + 0.22 * m * Math.sin(Math.PI * u) ** 2, popis: 'soudek' };
      case 'patka': return { f: sl([u => 0.45 * m * Math.exp(-((u / 0.16) ** 2)), perla(0.62, 0.08, 0.14 * m)]), popis: 'patka s prstencem' };
      case 'generator': {
        const nah = rng(k.seminko * 11 + 7), mezi = (a, b) => a + (b - a) * nah();
        const casti = [], popis = [];
        const zaklad = Math.floor(mezi(0, 4));
        if (zaklad === 1) { const a = mezi(0.15, 0.4) * m; casti.push(u => a * (1 - u)); popis.push('kužel'); }
        if (zaklad === 2) { const a = mezi(0.35, 0.8) * m, e = mezi(1.8, 3.5); casti.push(u => a * (1 - u) ** e); popis.push('trumpeta'); }
        if (zaklad === 3) { const a = mezi(0.1, 0.25) * m, c = mezi(0.35, 0.65); casti.push(u => a * Math.sin(Math.PI * u) ** 2 * (1 - Math.abs(u - c))); popis.push('soudek'); }
        const prst = Math.floor(mezi(0, 4));
        for (let i = 0; i < prst; i++) casti.push(perla(mezi(0.15, 0.85), mezi(0.05, 0.11), mezi(0.08, 0.2) * m));
        if (prst) popis.push(`${prst} × prstenec`);
        if (nah() < 0.3) { const a = mezi(0.12, 0.3) * m, c = mezi(0.2, 0.45); casti.push(u => a * (1 - hladce(u, c, c + 0.05))); popis.push('stupeň'); }
        return { f: sl(casti), popis: popis.join(', ') || 'válec' };
      }
      case 'vlastni': {
        // skica krčku: vzorkovaná křivka, f(u) lineárně mezi vzorky (u seřazené)
        const L = krivkaProfilu((k.vlastni || VLASTNI_KRCEK).body, false).slice().sort((a, b) => a[1] - b[1]);
        const f = u => {
          if (u <= L[0][1]) return L[0][0];
          for (let i = 1; i < L.length; i++) if (L[i][1] >= u) { const t = (u - L[i - 1][1]) / ((L[i][1] - L[i - 1][1]) || 1); return L[i - 1][0] + (L[i][0] - L[i - 1][0]) * t; }
          return 1;
        };
        return { f: u => Math.max(0.4, f(u)), popis: 'vlastní skica' };
      }
      default: return { f: () => 1, popis: 'válec' };
    }
  }
  /** Činitel poloměru knobu podle půdorysu (fasety, rýhy); w = 0 u krčku, 1 na plném průměru. */
  function pudorysKnobu(q, theta, w, v = 0.5) {
    if (q.pudorys === 'kruh' || w <= 0) return 1;
    const N = q.pocet, u = 2 * Math.PI / N, h = q.hloubka / (q.prumer / 2), tw = (q.stoupani || 0) * RAD * v;
    const zarez = g => 1 - h * g * w;   // vzory jen ubírají – největší průměr zůstává
    switch (q.pudorys) {
      case 'hrany': { const fi = ((theta % u) + u) % u - u / 2; return 1 + (Math.cos(Math.PI / N) / Math.cos(fi) - 1) * w; }
      case 'vlny': return zarez((1 - Math.cos(N * theta)) / 2);
      case 'kvet': return zarez(1 - Math.abs(Math.cos(N * theta / 2)) ** 0.6);
      case 'zebra': return zarez(1 - Math.max(0, Math.cos(N * theta)) ** 10);
      case 'ozubeni': { const t = (((N * theta / (2 * Math.PI)) % 1) + 1) % 1; return zarez(Math.max(0, Math.min(1, (Math.abs(t - 0.5) - 0.12) / 0.12))); }
      case 'spirala': return zarez(Math.max(0, -Math.cos(N * (theta + tw))) ** 2);
      case 'vrubkovani': return zarez(Math.max(Math.max(0, -Math.cos(N * (theta + tw))) ** 3, Math.max(0, -Math.cos(N * (theta - tw))) ** 3));
      case 'oval': { const pm = q.pomer || 0.8; return 1 + (1 / Math.sqrt(Math.cos(theta) ** 2 + (Math.sin(theta) / pm) ** 2) - 1) * w; }
      default: return zarez(Math.max(0, -Math.cos(N * theta)) ** 2);   // rýhy
    }
  }

  /* ---------- rozety, štít, klíč ---------- */
  /** Obrys otvoru pro klíč se středem v (0, 0) – mnohoúhelník (proti směru hodinových ručiček). */
  function obrysKlice(druh) {
    const k = KLICE[druh];
    if (!k || !k.kruh) return null;
    const r = k.kruh / 2, out = [];
    if (!k.sirka) { for (let i = 0; i < 48; i++) { const f = 2 * Math.PI * i / 48; out.push([r * Math.cos(f), r * Math.sin(f)]); } return out; }
    const w = k.sirka / 2, fz = Math.asin(w / r);   // kde drážka opouští kruh
    // oblouk shora od pravého napojení drážky po levé, pak drážka dolů
    const f0 = -Math.PI / 2 + fz, f1 = 3 * Math.PI / 2 - fz, n = 40;
    for (let i = 0; i <= n; i++) { const f = f0 + (f1 - f0) * i / n; out.push([r * Math.cos(f), r * Math.sin(f)]); }
    const rz = Math.min(w, 2.5);   // zaoblený konec drážky
    for (let i = 0; i <= 8; i++) { const f = Math.PI + Math.PI / 2 * i / 8; out.push([-w + rz + rz * Math.cos(f), -k.dolu + rz + rz * Math.sin(f)]); }
    for (let i = 0; i <= 8; i++) { const f = 3 * Math.PI / 2 + Math.PI / 2 * i / 8; out.push([w - rz + rz * Math.cos(f), -k.dolu + rz + rz * Math.sin(f)]); }
    return out;
  }
  /** Obrys rozety / štítu (konvexní, proti směru hodinových ručiček) se středem cx, cy. */
  function obrysDesky(tvar, w, h, cx = 0, cy = 0) {
    const out = [], N = 96;
    if (tvar === 'kruh' || tvar === 'oval') {
      const a = w / 2, b = tvar === 'kruh' ? w / 2 : h / 2;
      for (let i = 0; i < N; i++) { const f = 2 * Math.PI * i / N; out.push([cx + a * Math.cos(f), cy + b * Math.sin(f)]); }
      return out;
    }
    const rc = Math.min(w, h) * (tvar === 'stit' ? 0.22 : 0.18);
    const rohy = [[w / 2 - rc, h / 2 - rc, 0], [-w / 2 + rc, h / 2 - rc, 90], [-w / 2 + rc, -h / 2 + rc, 180], [w / 2 - rc, -h / 2 + rc, 270]];
    for (const [x, y, f0] of rohy) for (let i = 0; i <= 8; i++) { const f = (f0 + 90 * i / 8) * RAD; out.push([cx + x + rc * Math.cos(f), cy + y + rc * Math.sin(f)]); }
    return out;
  }

  /* ---------- odvozené rozměry ---------- */
  function odvozene(p) {
    const o = { typ: p.typ, chyby: [] };
    const pd = p.podlozeni, maPodl = pd.druh !== 'zadne';
    o.tr = maPodl ? pd.tloustka : 0;
    // nejširší pata krčku: musí se vejít na desku a nezakrýt hlavy šroubů rozety (šroubovák)
    // (odečte se i místo na límec odsazení a okraj desky kolem jeho otvoru)
    o.rPatyMax = !maPodl ? Infinity : pd.druh === 'stit' ? pd.stitSirka / 2 - 7
      : Math.min(Math.min(pd.sirka, pd.tvar === 'kruh' ? pd.sirka : pd.vyska) / 2 - 7, pd.roztecSr / 2 - SROUBY_ROZETY[pd.sroub].hlava / 2 - 2.5);
    // zR = rameno krčku (dosedá na líc rozety / štítu), z0 = spodek osazení (čepu v otvoru rozety)
    o.zR = maPodl ? pd.tloustka : 1;
    o.hlOsazeni = maPodl ? (p.osazeni.hloubka > 0 ? p.osazeni.hloubka : Math.max(0, pd.tloustka - 0.5)) : 0;
    o.z0 = o.zR - o.hlOsazeni;
    // strana otvoru čtyřhranu; s ocelovým pouzdrem (čtyřhranná trubka nasunutá na čtyřhran) je otvor na pouzdro
    o.pouzdro = p.vreteno.pouzdro ? p.vreteno.s + 2 * p.vreteno.pouzdroStena : 0;
    o.dira = (o.pouzdro || p.vreteno.s) + 2 * p.vreteno.vule;
    o.uhlopricka = o.dira * Math.SQRT2;
    const st = p.sroub.velikost === 'vlastni' ? staveciZPrumeru(p.sroub.prumer) : STAVECI[p.sroub.velikost];
    o.staveci = st;

    if (p.typ === 'klika') {
      const q = p.klika;
      o.pat = pater(p, o.zR);
      o.n = q.tvar === 'generator' || q.tvar === 'vlastni' ? o.pat.vz[0].n : PRUREZY[q.prurez].n;
      o.H = q.vylozeni;
      // průřez u kořene ramene (u generátoru má vlastní měřítka)
      const v0 = o.pat.vz[0];
      o.hKoren = q.vyska * (v0.sh ?? 1); o.tKoren = q.tloustka * (v0.st ?? 1);
      if (q.tvar === 'trubka') {
        o.rKrcku = Math.min(q.vyska, q.tloustka) / 2;     // stěna kolem čtyřhranu = trubka
        o.rLimec = q.krcek / 2 > o.rKrcku + 0.4 ? q.krcek / 2 : 0;   // límec u rozety, jen když je širší než trubka
        o.rVnejsi = Math.max(o.rKrcku, o.rLimec);
        o.vrchDiry = q.vylozeni - o.pat.Rb - 1;
        o.vrchLimce = o.rLimec ? o.zR + 4 : 0;
      } else {
        o.rKrcku = q.krcek / 2;
        o.vrchKrcku = q.vylozeni + o.tKoren / 2;
        o.vrchDiry = o.vrchKrcku - 4;
        o.krcekF = krcekFunkce(p.krcek);
        o.hrany = +p.krcek.hrany || 0;
        o.zKrcekDo = Math.max(o.zR + 2, q.vylozeni - o.tKoren / 2 - 0.5);   // tvar krčku jen pod ramenem
        const kryt = o.hrany ? Math.cos(Math.PI / o.hrany) : 1;
        o.rKrckuV = z => Math.max(o.rKrcku, Math.min(o.rPatyMax * kryt, o.rKrcku * (z >= o.zKrcekDo ? 1 : o.krcekF.f(Math.max(0, (z - o.zR) / (o.zKrcekDo - o.zR))))));
        // obrys u paty: u hranatého krčku roh (ploška je na poloměru krčku)
        o.rVnejsi = o.rKrckuV(o.zR) / (o.hrany ? Math.cos(Math.PI / o.hrany) : 1);
        o.rKrckuMax = Math.max(...Array.from({ length: 41 }, (_, i) => o.rKrckuV(o.zR + (o.zKrcekDo - o.zR) * i / 40))) / kryt;
      }
      o.prurez = prurezMiry(prurezBody(o.hKoren / 2, o.tKoren / 2, o.n, 96));
      // nejmenší vzdálenost ramene od dveří v úchopu a nejbližší bod celého ramene (bez krčku)
      const t2 = q.tloustka / 2, h2 = q.vyska / 2;
      let svetlost = Infinity, odDveri = Infinity, xMax = -Infinity, yMin = Infinity;
      const xUchop0 = o.rVnejsi + 15, xUchop1 = q.tvar === 'navrat' ? q.delka - o.pat.Rb - q.tloustka - 5 : q.delka - 25;
      const vUchopu = v => (v.u0 !== undefined ? v.u0 >= 0.2 && v.u0 <= 0.85 && v.c[0] >= xUchop0 : v.c[0] >= xUchop0 && v.c[0] <= xUchop1);
      const zapocti = (v, body) => {
        for (const P of body) {
          if (P[0] > xMax) xMax = P[0];
          if (P[1] < yMin) yMin = P[1];
          if (v.c[0] > o.rVnejsi + 3 && P[2] < odDveri) odDveri = P[2];
          if (vUchopu(v) && P[2] < svetlost) svetlost = P[2];
        }
      };
      for (const v of o.pat.vz) zapocti(v, kruhPateru(v, h2, t2, o.n, 16));
      // kopule na konci (stejně jako v síti) – rozhoduje o dosahu i o tom, jak blízko ke dveřím konec sahá
      const posl = o.pat.vz[o.pat.vz.length - 1];
      for (let j = 1; j <= 8; j++) {
        const f = Math.PI / 2 * j / 8, c = V.add(posl.c, V.mul(posl.t, o.pat.e * Math.sin(f)));
        zapocti({ c: [Infinity, 0, 0] }, kruhPateru(Object.assign({}, posl, { c }), h2, t2, o.n, 16, Math.cos(f)));
      }
      if (!Number.isFinite(svetlost)) svetlost = odDveri;   // krátké rameno: úchop = celé rameno za krčkem
      o.dosah = xMax;
      o.svetlost = svetlost - o.tr;      // místo pro prsty mezi ramenem a rozetou
      o.odDveri = odDveri;               // nejbližší bod ramene od dveří
      o.yMin = Math.min(yMin, -h2);
      o.vrchDilu = q.vylozeni + t2;
    } else {
      const q = p.knob;
      o.krcekF = krcekFunkce(p.krcek);
      o.prof = profilKnobu(q, o.zR, o.krcekF.f, o.rPatyMax);
      o.rKrcku = q.krcek / 2;
      o.rVnejsi = o.prof.podstava;
      // otvor končí 6 mm pod vrcholem, nebo dřív, kde se hlava zužuje (špičatý vršek z generátoru)
      o.vrchDiry = Math.min(q.vylozeni - 6, o.prof.body[o.prof.body.length - 1][1] - 3);   // u misky je vrchol na ose níž
      for (const [r, z] of o.prof.body) if (z > o.zR + 1 && r < o.uhlopricka / 2 + 3) { o.vrchDiry = Math.min(o.vrchDiry, z - 1.5); break; }
      o.svetlost = o.prof.rMaxZ - o.tr;
      o.vrchDilu = q.vylozeni;
    }
    // osazení: užší čep na konci krčku, zajede do otvoru rozety; bez rozety není
    o.rKrckuUPaty = o.rVnejsi;
    // výchozí směrem ven: límec o 2 mm na stranu širší než krček, zapadne do otvoru štítu / rozety a lícuje s ní
    // automaticky nejvýš tak široký, aby nezasáhl do hlav šroubů rozety
    const mistoRozeta = maPodl && pd.druh === 'rozeta' ? pd.roztecSr / 2 - SROUBY_ROZETY[pd.sroub].hlava / 2 - 1.5 - 0.4 : maPodl ? pd.stitSirka / 2 - 3.5 : Infinity;
    o.rOs = maPodl && o.hlOsazeni > 0 ? (p.osazeni.prumer > 0 ? p.osazeni.prumer / 2 : Math.max(o.rVnejsi + 0.8, Math.min(o.rVnejsi + 2, mistoRozeta))) : 0;
    o.osazeniVen = o.rOs > o.rVnejsi + 0.01;
    o.rDiry = o.rOs || o.rVnejsi;   // poloměr otvoru rozety (bez vůle)
    // otvor čtyřhranu: od spodku krčku nahoru (slepý)
    o.zDiry1 = p.vreteno.hloubka > 0 ? Math.min(o.z0 + p.vreteno.hloubka, o.vrchDiry) : o.vrchDiry;
    o.hloubkaDiry = o.zDiry1 - o.z0;
    // stěna kolem rohu čtyřhranu v nejužším místě krčku
    o.stenaKrcku = (p.typ === 'knob' ? Math.min(...o.prof.body.filter(b => b[1] <= o.zDiry1 + 1e-6).map(b => b[0])) : o.rKrcku) - o.uhlopricka / 2;
    o.stenaOsazeni = o.rOs ? o.rOs - o.uhlopricka / 2 : Infinity;
    o.stena = Math.min(o.stenaKrcku, o.stenaOsazeni);
    // stavěcí šroub: osa ve směru −y ve výšce zs nad dveřmi, nad rozetou (aby na něj dosáhl imbus)
    if (p.sroub.uchyceni !== 'zadne') {
      o.zahl = zahloubeniSroubu(p, st);
      o.samorez = p.sroub.uchyceni === 'samorez' ? o.zahl : null;
      o.vrut = p.sroub.uchyceni === 'vrut' ? o.zahl : null;
      const zMin = o.zR + (o.samorez || o.vrut ? (o.samorez || o.vrut).hlava / 2 + 1.5 : st.d / 2 + 2.5);
      o.zs = p.sroub.vyska > 0 ? p.sroub.vyska : zMin + (p.sroub.uchyceni === 'matice' ? 0.5 : 0);
      o.zsMin = zMin;
      // krček ve směru šroubu (−y): u trubky je to výška průřezu, jinak poloměr krčku
      const rProfilu = z => { const b = o.prof.body; for (let i = 1; i < b.length; i++) if (b[i][1] >= z) { const t = (z - b[i - 1][1]) / ((b[i][1] - b[i - 1][1]) || 1); return b[i - 1][0] + (b[i][0] - b[i - 1][0]) * t; } return o.rKrcku; };
      o.rSroub = p.typ === 'klika' ? (p.klika.tvar === 'trubka' ? p.klika.vyska / 2 : o.rKrckuV(o.zs)) : Math.max(o.rKrcku, rProfilu(o.zs));
      o.stenaSroubu = o.rSroub - o.dira / 2;   // radiálně od stěny otvoru k povrchu krčku
      const delka = o.stenaSroubu + 0.5;
      o.delkaStav = delkaSroubu(DELKY_STAVECICH, o.stenaSroubu, 0.5).L;   // bez hlavy – raději kratší (zapustí se), než aby vyčníval
    }
    // podložení: rozeta / štít (+ rozeta klíče)
    if (maPodl) {
      const sr = SROUBY_ROZETY[pd.sroub], dira = o.rDiry + 0.4;
      o.sr = sr; o.vrtaniHlavy = (sr.hlava - sr.otvor) / 2 + 0.3;
      o.desky = [];
      const klic = KLICE[pd.klic].kruh ? { druh: pd.klic, y: -pd.roztec } : null;
      o.klic = klic;
      if (pd.druh === 'rozeta') {
        const h = pd.tvar === 'kruh' ? pd.sirka : pd.vyska;
        o.desky.push({ dil: 'rozeta', obrys: obrysDesky(pd.tvar, pd.sirka, h), w: pd.sirka, h, cy: 0, diraR: dira, otvorKlice: null,
          srouby: [[0, pd.roztecSr / 2], [0, -pd.roztecSr / 2]] });
        if (klic) {
          // rozeta klíče je vystředěná na celý otvor (kruh + drážka), ne na osu klíče
          const k = KLICE[klic.druh], cy = klic.y + (k.dolu ? (k.kruh / 2 - k.dolu) / 2 : 0);
          o.desky.push({ dil: 'rozetaKlic', obrys: obrysDesky(pd.tvar, pd.sirka, h, 0, cy), w: pd.sirka, h, cy, diraR: 0, otvorKlice: klic,
            srouby: [[pd.roztecSr / 2, cy], [-pd.roztecSr / 2, cy]] });
        }
      } else {
        const W = pd.stitSirka, Hs = pd.stitVyska, cy = klic ? -pd.roztec / 2 : 0;
        const m = Math.max(sr.hlava / 2 + 4, W * 0.22);
        o.desky.push({ dil: 'stit', obrys: obrysDesky('stit', W, Hs, 0, cy), w: W, h: Hs, cy, diraR: dira, otvorKlice: klic,
          srouby: [[0, cy + Hs / 2 - m], [0, cy - Hs / 2 + m]] });
      }
    }
    // díly k tisku (jedna strana; sada = dvakrát, klika podruhé zrcadlově)
    const ks = p.dvere.sada ? 2 : 1;
    o.dily = [{ dil: p.typ, ks }];
    for (const d of o.desky || []) o.dily.push({ dil: d.dil, ks });
    // čtyřhran: doporučená délka pro sadu (obě kliky)
    const zaber = Math.min(o.hloubkaDiry, 25);
    o.vreteno = {
      min: p.dvere.tloustka + 2 * (o.z0 + Math.min(15, o.hloubkaDiry)),
      max: p.dvere.tloustka + 2 * o.zDiry1 - 2,
      idealni: p.dvere.tloustka + 2 * (o.z0 + zaber),
    };
    o.vreteno.std = DELKY_VRETEN.find(d => d >= o.vreteno.idealni - 3 && d <= o.vreteno.max) || [...DELKY_VRETEN].reverse().find(d => d >= o.vreteno.min && d <= o.vreteno.max) || null;
    return o;
  }

  /* ---------- kontroly ---------- */
  function kontroly(p, o) {
    const H = [], pridej = (uroven, text, pole = [], oprava) => H.push({ uroven, text, pole: [].concat(pole), oprava });
    const pd = p.podlozeni, st = o.staveci;
    const velikost = jmenoSroubu(p);
    const poleKrcku = p.typ === 'klika' ? (p.klika.tvar === 'trubka' ? 'klika.vyska' : 'klika.krcek') : 'knob.krcek';
    const vOsazeni = o.stenaOsazeni < o.stenaKrcku, poleSteny = vOsazeni ? 'osazeni.prumer' : poleKrcku;
    const potrebaD = Math.ceil(o.uhlopricka + 7);
    if (o.stena < 1.2) pridej('chyba', vOsazeni
      ? `Osazení Ø ${fmt(2 * o.rOs)} mm je na čtyřhran ${fmt(p.vreteno.s, 2)} mm úzké – kolem rohů zbývá jen ${fmt(o.stena)} mm stěny.`
      : `Kolem rohů čtyřhranu zbývá jen ${fmt(o.stena)} mm stěny – krček je na čtyřhran ${fmt(p.vreteno.s, 2)} mm úzký.`, poleSteny,
      vOsazeni ? { pole: 'osazeni.prumer', hodnota: Math.min(potrebaD, Math.floor(2 * o.rVnejsi)), text: `osazení Ø ${Math.min(potrebaD, Math.floor(2 * o.rVnejsi))} mm` }
        : poleKrcku !== 'klika.vyska' ? { pole: poleKrcku, hodnota: potrebaD, text: `krček Ø ${potrebaD} mm` } : undefined);
    else if (o.stena < 2.5) pridej('varovani', `Stěna kolem rohů čtyřhranu ${fmt(o.stena)} mm je tenká – při přetížení se ${vOsazeni ? 'osazení' : 'krček'} rozštípne (doporučeno ≥ 2,5 mm).`, poleSteny);
    // osazení krčku do rozety / štítu
    if (o.rOs) {
      if (Math.abs(o.rVnejsi - o.rOs) < 0.8) pridej('info', 'Odsazení je skoro stejně široké jako krček – schod mezi nimi je úzký.', 'osazeni.prumer');
      if (o.hlOsazeni > pd.tloustka - 0.2) pridej(o.hlOsazeni > pd.tloustka ? 'chyba' : 'varovani', `Osazení (${fmt(o.hlOsazeni)} mm) je hlubší než ${pd.druh === 'stit' ? 'štít' : 'rozeta'} (${fmt(pd.tloustka)} mm) – bude drhnout o dveře (nechte ≈ 0,5 mm vůli).`, 'osazeni.hloubka',
        { pole: 'osazeni.hloubka', hodnota: 0, text: 'hloubka automaticky' });
      if (p.sroub.uchyceni === 'matice' && o.zs) {
        const kraj = o.dira / 2 + o.stenaSroubu / 2 + (st.mVyska + 0.4) / 2;
        if (kraj > o.rOs - 0.6) pridej('info', 'Kapsa pro matici prochází i osazením – je otevřená do strany, ale schovaná v rozetě.', ['osazeni.prumer', 'sroub.uchyceni']);
      }
    }
    if (o.hloubkaDiry < 12) pridej('chyba', `Čtyřhran zasahuje do kliky jen ${fmt(o.hloubkaDiry)} mm – málo na přenos síly (potřeba ≥ 12 mm, doporučeno 20 mm).`,
      p.typ === 'klika' ? ['klika.vylozeni', 'vreteno.hloubka', 'klika.ohyb'] : ['knob.vylozeni', 'vreteno.hloubka']);
    else if (o.hloubkaDiry < 18) pridej('varovani', `Otvor čtyřhranu je hluboký ${fmt(o.hloubkaDiry)} mm – doporučeno ≥ 18 mm, jinak se otvor rychle vytluče.`, 'vreteno.hloubka');
    if (p.vreteno.hloubka > 0 && p.vreteno.hloubka > o.vrchDiry - o.z0 + 0.01)
      pridej('info', `Hloubka otvoru omezena na ${fmt(o.hloubkaDiry)} mm (nad ním musí zůstat stěna).`, 'vreteno.hloubka');
    if (p.vreteno.vule < 0) pridej('varovani', 'Záporná vůle = lisovaný spoj; klika půjde na čtyřhran ztuha a krček může prasknout.', 'vreteno.vule');
    else if (p.vreteno.vule > 0.35) pridej('varovani', `Vůle ${fmt(p.vreteno.vule, 2)} mm na straně je velká – klika bude na čtyřhranu viklat.`, 'vreteno.vule');

    // stavěcí šroub
    if (p.sroub.uchyceni !== 'zadne') {
      if (p.sroub.vyska > 0 && o.zs < o.zsMin - 0.01)
        pridej('chyba', `Stavěcí šroub ve výšce ${fmt(o.zs)} mm je schovaný v rozetě – imbusem na něj nedosáhnete (potřeba ≥ ${fmt(o.zsMin)} mm).`, 'sroub.vyska',
          { pole: 'sroub.vyska', hodnota: 0, text: 'výška automaticky' });
      if (o.zs + st.d / 2 > o.zDiry1 - 1) pridej('chyba', `Stavěcí šroub (výška ${fmt(o.zs)} mm) je nad koncem otvoru čtyřhranu – nedosáhne na něj.`, ['sroub.vyska', 'vreteno.hloubka']);
      if (p.typ === 'klika' && p.klika.tvar === 'trubka' && o.zs + st.d / 2 > p.klika.vylozeni - o.pat.Rb)
        pridej('chyba', 'Stavěcí šroub vychází do ohybu trubky – zvětšete vyložení nebo zmenšete ohyb.', ['klika.vylozeni', 'klika.ohyb']);
      if (p.typ === 'klika' && p.klika.tvar !== 'trubka' && o.zs + st.d / 2 > p.klika.vylozeni - p.klika.tloustka / 2 - 0.5 && o.zs - st.d / 2 < p.klika.vylozeni + p.klika.tloustka / 2)
        pridej('info', 'Stavěcí šroub vychází zespodu krčku v místě ramene – ověřte v náhledu, že k němu dosáhnete.', 'sroub.vyska');
      const w = o.stenaSroubu;
      if (p.sroub.uchyceni === 'matice') {
        const potreba = st.mVyska + 0.4 + 2 * 0.8;
        if (w < potreba) pridej('chyba', `Na kapsu pro matici ${velikost} (${fmt(st.mVyska)} mm) je stěna krčku ${fmt(w)} mm tenká – potřeba ≥ ${fmt(potreba)} mm. Zvolte vložku nebo závit, menší šroub nebo širší krček.`,
          ['sroub.uchyceni', 'sroub.velikost'], { pole: 'sroub.uchyceni', hodnota: 'zavit', text: 'závit do plastu' });
        if (kapsaProrazi(o.rSroub, o.dira / 2, o.stenaSroubu, st)) pridej('chyba', `Kapsa pro matici ${velikost} (šířka ${fmt(st.matice + 0.3)} mm) prorazí bok krčku – zvolte menší šroub, vložku nebo závit, nebo širší krček.`, ['sroub.velikost', 'sroub.uchyceni'],
          { pole: 'sroub.uchyceni', hodnota: 'zavit', text: 'závit do plastu' });
      } else if (p.sroub.uchyceni === 'vlozka') {
        if (w < st.vDelka * 0.6) pridej('chyba', `Zalisovací vložka ${velikost} (délka ${fmt(st.vDelka)} mm) se do stěny ${fmt(w)} mm nevejde.`, ['sroub.uchyceni', 'sroub.velikost']);
        else if (w < st.vDelka) pridej('info', `Vložka je delší než stěna (${fmt(w)} mm) – zkraťte ji nebo kupte krátkou variantu; otvor pro ni je ${fmt(Math.min(st.vDelka, w))} mm.`, 'sroub.uchyceni');
      } else if (p.sroub.uchyceni === 'vrut') {
        const zbyva = w - o.vrut.zahloubeni;
        if (zbyva < 1.5) pridej('chyba', `Vrut ${velikost}: po zahloubení hlavy (${fmt(o.vrut.zahloubeni)} mm) zbývá jen ${fmt(zbyva)} mm stěny – vrut nebude mít v čem držet.`, ['sroub.prumer', 'sroub.velikost']);
        else if (zbyva < 2.5) pridej('varovani', `Vrut ${velikost} má po zahloubení hlavy jen ${fmt(zbyva)} mm stěny na závit – zvolte tenčí vrut nebo širší krček.`, ['sroub.prumer', 'sroub.velikost']);
        pridej('info', `Vrut do dřeva se zápustnou hlavou: předvrt Ø ${fmt(o.vrut.predvrt, 1)} mm, zahloubení 90° pro hlavu Ø ${fmt(o.vrut.hlava, 1)} mm. Vrut si v plastu vyřízne závit a špičkou se zaryje do čtyřhranu – zašroubujte ho, až když je klika na čtyřhranu.`, 'sroub.uchyceni');
      } else if (p.sroub.uchyceni === 'samorez') {
        const zbyva = w - o.samorez.vyskaHlavy;
        if (zbyva < 1.2 * st.d) pridej(zbyva < 0.6 * st.d ? 'chyba' : 'varovani', `Samořezný vrut ${velikost} má po zahloubení hlavy jen ${fmt(zbyva)} mm stěny na závit (doporučeno ≥ ${fmt(1.2 * st.d)} mm) – vytrhne se; zvolte tenčí vrut nebo širší krček.`, ['sroub.velikost', 'sroub.prumer']);
        pridej('info', `Samořezný vrut si závit vyřízne sám: předvrt Ø ${fmt(o.samorez.predvrt, 1)} mm, hlava se schová do zahloubení Ø ${fmt(o.samorez.hlava, 1)} mm. Vrut zašroubujte pomalu, ať se plast nepřehřeje.`, 'sroub.uchyceni');
      } else if (p.sroub.uchyceni === 'zavit' && w < 2 * st.d) pridej('varovani', `Závit do plastu má jen ${fmt(w)} mm (≈ ${fmt(w / st.d, 1)} × průměr) – snadno se strhne; lepší je matice nebo vložka.`, 'sroub.uchyceni');
    } else pridej('info', 'Bez stavěcího šroubu drží klika na čtyřhranu jen třením – čtyřhran musí mít pojistku (závit, pružinu) nebo kliku přilepte.', 'sroub.uchyceni');

    if (p.typ === 'klika') {
      const q = p.klika;
      if (q.tvar === 'trubka') {
        if (q.ohyb < q.tloustka / 2 + 0.5) pridej('chyba', `Poloměr ohybu ${fmt(q.ohyb)} mm je menší než polovina trubky – vnitřek ohybu by se zmačkal.`, 'klika.ohyb',
          { pole: 'klika.ohyb', hodnota: Math.ceil(q.tloustka * 0.8), text: `ohyb ${Math.ceil(q.tloustka * 0.8)} mm` });
        if (q.vylozeni - o.pat.Rb - o.zR < 18) pridej('chyba', `Svislá část trubky je krátká (${fmt(q.vylozeni - o.pat.Rb - o.zR)} mm) – čtyřhran se do ní nevejde. Zvětšete vyložení nebo zmenšete ohyb.`, ['klika.vylozeni', 'klika.ohyb']);
      } else {
        if (q.vyska / 2 > o.rKrcku + 0.5) pridej('info', `Rameno (výška ${fmt(q.vyska)} mm) je vyšší než krček Ø ${fmt(q.krcek)} mm – u kořene přečnívá.`, ['klika.vyska', 'klika.krcek']);
        if (q.vylozeni - q.tloustka / 2 < o.tr + 8) pridej('chyba', 'Rameno leží na rozetě – zvětšete vyložení.', 'klika.vylozeni');
      }
      if (q.tvar === 'navrat') {
        const Rr = Math.max(q.ohyb, q.tloustka / 2 + 0.5);
        if (q.ohyb < q.tloustka * (1 - q.zuzeni / 100) / 2 + 0.5) pridej('info', `Poloměr ohybu ${fmt(q.ohyb)} mm je menší než půl tloušťky konce – použije se ${fmt(Rr)} mm, aby se vnitřek ohybu nepřeložil.`, 'klika.ohyb');
        if (q.delka - Rr - q.tloustka / 2 < o.rVnejsi + 5) pridej('chyba', `Ohyb ${fmt(Rr)} mm je na délku ramene ${fmt(q.delka)} mm velký – zalomení by začínalo v krčku. Zmenšete ohyb nebo prodlužte rameno.`, ['klika.ohyb', 'klika.delka']);
        if (q.navrat < Rr + o.pat.e + 2) pridej('varovani', `Návrat ${fmt(q.navrat)} mm je kratší než ohyb – konec se ke dveřím skoro nestočí.`, 'klika.navrat');
        if (o.odDveri < 3) pridej('chyba', `Zahnutý konec sahá ${o.odDveri < 0 ? 'do dveří' : `${fmt(o.odDveri)} mm ke dveřím`} – bude je škrábat (nechte ≥ 5 mm).`, 'klika.navrat',
          { pole: 'klika.navrat', hodnota: Math.floor(q.vylozeni - 8), text: `návrat ${Math.floor(q.vylozeni - 8)} mm` });
        else if (o.odDveri > 20) pridej('info', `Konec je ${fmt(o.odDveri)} mm ode dveří – pro bezbariérové kování se doporučuje, aby se vracel blíž (≈ 10–13 mm), jinak se může zachytit.`, 'klika.navrat');
      } else if (o.odDveri < 3) pridej('chyba', `Rameno se přiblíží ke dveřím na ${fmt(o.odDveri)} mm – bude je škrábat.`, ['klika.prohnuti', 'klika.vylozeni']);
      if (q.tvar === 'oblouk' && q.prohnuti > q.vylozeni * 0.5) pridej('varovani', 'Velké prohnutí – konec ramene je u dveří a prsty se pod něj nevejdou.', 'klika.prohnuti');
      if (o.svetlost < 25) pridej('chyba', `Mezi ramenem a ${o.tr ? 'rozetou' : 'dveřmi'} je jen ${fmt(o.svetlost)} mm – prsty se nevejdou (potřeba ≥ 25 mm, doporučeno 35 mm).`, 'klika.vylozeni',
        { pole: 'klika.vylozeni', hodnota: Math.ceil(q.vylozeni + 35 - o.svetlost), text: `vyložení ${Math.ceil(q.vylozeni + 35 - o.svetlost)} mm` });
      else if (o.svetlost < 35) pridej('varovani', `Místo na prsty ${fmt(o.svetlost)} mm je těsné (doporučeno ≥ 35 mm, kliky mívají 40–50 mm).`, 'klika.vylozeni');
      if (q.delka < 95) pridej('varovani', `Rameno ${fmt(q.delka)} mm je krátké – hůř se ovládá loktem nebo s plnýma rukama (běžně 110–150 mm).`, 'klika.delka');
      if (q.vyska < 12 || q.tloustka < 9) pridej('varovani', `Průřez ramene ${fmt(q.vyska)} × ${fmt(q.tloustka)} mm je tenký – špatně se drží a je slabý (viz Pevnost).`, ['klika.vyska', 'klika.tloustka']);
      if (o.pat.kolize) pridej('chyba', `${{ krizi: 'Rameno se kříží samo se sebou', ohyb: 'Ohyb ramene je ostřejší než půl průřezu – vnitřek ohybu by se přeložil', dvere: 'Rameno sahá až ke dveřím' }[o.pat.kolize]} – upravte skicu (menší prohnutí, tenčí průřez nebo jiný konec).`, 'klika.tvar');
      if ((q.tvar === 'generator' || q.tvar === 'vlastni') && p.tisk.rozpulit && !o.pat.soumerna) pridej('chyba', 'Tuto kliku ze semínka nelze rozpůlit – není souměrná podle roviny řezu (pokles, zkroucení nebo tepaný povrch).', 'tisk.rozpulit',
        { pole: 'tisk.rozpulit', hodnota: false, text: 'nerozpůlit' });
      if (q.tvar === 'dolu' && p.tisk.rozpulit) pridej('chyba', 'Kliku zahnutou dolů nelze rozpůlit – není souměrná podle roviny řezu.', 'tisk.rozpulit',
        { pole: 'tisk.rozpulit', hodnota: false, text: 'nerozpůlit' });
      if (q.tvar === 'rovna' || q.tvar === 'oblouk' && q.prohnuti < 10) pridej('info', 'Rovný konec se může zachytit o oblečení nebo tašku – pro chodby a bezbariérové dveře zvolte zahnutý konec.', 'klika.tvar');
      // klika vs. zárubeň: rameno míří od hrany, ale vyhnutá dolů nesmí zasáhnout do výšky jiných prvků – kontrola rozety klíče
      if (o.klic && q.tvar === 'dolu' && o.yMin < o.klic.y + KLICE[pd.klic].kruh) pridej('varovani', 'Rameno zahnuté dolů se blíží otvoru pro klíč – klíč bude překážet.', ['klika.prohnuti', 'podlozeni.roztec']);
    } else {
      const q = p.knob, pr = o.prof;
      if (q.hlava > q.vylozeni - o.zR - 2) pridej('chyba', `Hlava (${fmt(q.hlava)} mm) je vyšší než vyložení nad rozetou – knob nemá krček.`, ['knob.hlava', 'knob.vylozeni']);
      if (q.tvar === 'vlastni' && protinaSe(krivkaProfilu(q.vlastni.body, true))) pridej('chyba', 'Obrys skici hlavy se kříží sám se sebou – posuňte body nebo úchyty.', 'knob.tvar');
      if (q.krcek >= q.prumer - 4) pridej('chyba', `Krček Ø ${fmt(q.krcek)} mm je skoro stejně široký jako hlava Ø ${fmt(q.prumer)} mm.`, ['knob.krcek', 'knob.prumer']);
      if (q.podrez && pr.podstava > pr.rn + 0.01) pridej('varovani', `Podřez 45° začíná už u rozety – krček nemá žádnou rovnou část (podstava Ø ${fmt(2 * pr.podstava)} mm). Zvětšete vyložení nebo zmenšete hlavu.`, ['knob.vylozeni', 'knob.hlava']);
      if (o.svetlost < 15) pridej('chyba', `Pod hlavou knobu je jen ${fmt(o.svetlost)} mm – prsty ji nemají jak obejmout (potřeba ≥ 15 mm, doporučeno 20 mm).`, ['knob.vylozeni', 'knob.hlava']);
      else if (o.svetlost < 20) pridej('varovani', `Místo na prsty pod hlavou ${fmt(o.svetlost)} mm je těsné (doporučeno ≥ 20 mm).`, ['knob.vylozeni', 'knob.hlava']);
      if (q.prumer < 38) pridej('varovani', `Knob Ø ${fmt(q.prumer)} mm je malý na dveře – špatně se otáčí (dveřní knoby mívají 50–60 mm).`, 'knob.prumer');
      const zbyva = p.dvere.trn - q.prumer / 2;
      if (zbyva < 15) pridej('chyba', `Trn ${fmt(p.dvere.trn)} mm je na knob Ø ${fmt(q.prumer)} mm krátký – klouby prstů narazí do zárubně (od okraje knobu k hraně dveří jen ${fmt(zbyva)} mm).`, ['dvere.trn', 'knob.prumer']);
      else if (zbyva < 25) pridej('varovani', `Od okraje knobu k hraně dveří je ${fmt(zbyva)} mm – u zárubně s polodrážkou se otřete klouby (doporučeno ≥ 25 mm, nebo delší trn).`, ['dvere.trn', 'knob.prumer']);
      if (q.pudorys === 'ryhy' && q.hloubka > q.prumer * 2 * Math.PI / q.pocet / 4) pridej('varovani', 'Rýhy jsou na svůj počet hluboké – splývají v ostré hřebeny.', ['knob.hloubka', 'knob.pocet']);
      pridej('info', 'Knob se ovládá sevřením a otočením zápěstí – tam, kde je potřeba bezbariérové ovládání (v USA podle ADA), použijte raději kliku.', 'knob.tvar');
      if (p.vreteno.norma.startsWith('us')) pridej('info', 'Americké válcové zámky (cylindrical / tubular) mají knob nasazený na hřídeli výrobce, ne na čtyřhranu – čtyřhran pasuje na zadlabací (mortise) zámky.', 'vreteno.norma');
    }

    // podložení
    if (pd.druh !== 'zadne') {
      const sr = o.sr;
      for (const d of o.desky) {
        const nazev = KOLIK_DILU[d.dil].toLowerCase();
        if (d.diraR) {
          const minRozmer = Math.min(d.w, d.dil === 'stit' ? d.w : d.h);
          if (2 * d.diraR > minRozmer - 8) pridej('chyba', `Otvor pro krček (Ø ${fmt(2 * d.diraR)} mm) je na ${nazev} ${fmt(minRozmer)} mm velký.`, ['podlozeni.sirka', 'podlozeni.stitSirka']);
        }
        for (const [x, y] of d.srouby) {
          if (d.diraR && Math.hypot(x, y) - sr.hlava / 2 < d.diraR + 1.5)
            pridej('chyba', `Hlava šroubu (Ø ${fmt(sr.hlava)}) zasahuje do otvoru pro krček – zvětšete rozteč šroubů.`, 'podlozeni.roztecSr',
              { pole: 'podlozeni.roztecSr', hodnota: Math.ceil(2 * (d.diraR + 2 + sr.hlava / 2)), text: `rozteč ${Math.ceil(2 * (d.diraR + 2 + sr.hlava / 2))} mm` });
          if (!uvnitr(d.obrys, x, y, sr.hlava / 2 + 1.5)) pridej('chyba', d.dil === 'stit' ? `Šroub štítu vychází na okraj – prodlužte štít.` : `Šroub ${nazev} (rozteč ${fmt(pd.roztecSr)} mm) vychází na okraj – zmenšete rozteč nebo zvětšete ${nazev}.`, d.dil === 'stit' ? 'podlozeni.stitVyska' : ['podlozeni.roztecSr', 'podlozeni.sirka']);
          if (d.otvorKlice) {
            const k = KLICE[d.otvorKlice.druh], dx = Math.abs(x), dy = y - d.otvorKlice.y;
            const vKlici = (dx < Math.max(k.sirka / 2, 0) + sr.hlava / 2 + 1 && dy < 0 && dy > -k.dolu - sr.hlava / 2 - 1) || Math.hypot(dx, dy) < k.kruh / 2 + sr.hlava / 2 + 1;
            if (vKlici) pridej('chyba', `Šroub ${nazev} koliduje s otvorem pro klíč – změňte rozteč šroubů nebo výšku štítu.`, d.dil === 'stit' ? ['podlozeni.stitVyska', 'podlozeni.roztec'] : 'podlozeni.roztecSr');
          }
        }
        if (d.otvorKlice) {
          const k = KLICE[d.otvorKlice.druh], ob = obrysKlice(d.otvorKlice.druh).map(([x, y]) => [x, y + d.otvorKlice.y]);
          if (ob.some(([x, y]) => !uvnitr(d.obrys, x, y, 2.5))) pridej('chyba', `Otvor pro klíč (${k.nazev}) se nevejde do ${nazev} – zvětšete ji / prodlužte štít.`, d.dil === 'stit' ? ['podlozeni.stitVyska', 'podlozeni.stitSirka'] : ['podlozeni.sirka', 'podlozeni.vyska']);
        }
        if (d.dil === 'stit' && d.diraR && d.otvorKlice && d.diraR + KLICE[d.otvorKlice.druh].kruh / 2 + 3 > pd.roztec)
          pridej('chyba', `Rozteč ${fmt(pd.roztec)} mm je malá – otvor pro klíč zasahuje do otvoru krčku.`, 'podlozeni.roztec');
      }
      if (pd.druh === 'rozeta' && o.klic) {
        const h = pd.tvar === 'kruh' ? pd.sirka : pd.vyska, dk = o.desky.find(d => d.dil === 'rozetaKlic');
        if (dk && dk.cy + h / 2 > -h / 2 - 2) pridej('chyba', `Rozety (výška ${fmt(h)} mm) se na rozteči ${fmt(pd.roztec)} mm překrývají – zmenšete je nebo zvolte štít.`, ['podlozeni.vyska', 'podlozeni.sirka', 'podlozeni.druh'],
          { pole: 'podlozeni.druh', hodnota: 'stit', text: 'použít štít' });
      }
      if (pd.druh === 'stit' && pd.stitSirka > 2 * p.dvere.trn - 6) pridej('chyba', `Štít ${fmt(pd.stitSirka)} mm je širší než dvojnásobek trnu – přesáhne hranu dveří.`, ['podlozeni.stitSirka', 'dvere.trn']);
      if (pd.druh === 'rozeta' && pd.sirka / 2 > p.dvere.trn - 3) pridej('chyba', `Rozeta přesahuje hranu dveří (trn ${fmt(p.dvere.trn)} mm).`, ['podlozeni.sirka', 'dvere.trn']);
      const zbyle = pd.tloustka - o.vrtaniHlavy;
      if (zbyle < 1.2) pridej('chyba', `Zápustná hlava (${fmt(o.vrtaniHlavy)} mm) se do ${pd.druh === 'stit' ? 'štítu' : 'rozety'} tloušťky ${fmt(pd.tloustka)} mm nevejde.`, ['podlozeni.tloustka', 'podlozeni.sroub']);
      if (pd.zaobleni > pd.tloustka - 1) pridej('info', 'Zaoblení hrany je skoro jako celá tloušťka – okraj bude tenký.', 'podlozeni.zaobleni');
      if (pd.klic === 'PZ' && pd.tloustka > 0) pridej('info', `Cylindrická vložka smí přečnívat nejvýš ≈ 3 mm nad ${pd.druh === 'stit' ? 'štít' : 'rozetu'} – délku vybírejte podle kusovníku.`, 'podlozeni.klic');
    }
    if (o.vreteno.max < o.vreteno.min) pridej('chyba', 'Na tyto dveře nejde zvolit délku čtyřhranu – otvory v klikách jsou mělké.', ['dvere.tloustka', 'vreteno.hloubka']);
    if (p.dvere.trn < 40 && p.typ === 'klika') pridej('info', `Trn ${fmt(p.dvere.trn)} mm je krátký – rozeta se musí vejít mezi osu a hranu dveří.`, 'dvere.trn');
    if (p.tisk.vypln < 60) pridej('varovani', `Výplň ${fmt(p.tisk.vypln, 0)} % je na kliku málo – tiskněte 100 % (nebo ≥ 6 obvodových stěn), jinak se zlomí.`, 'tisk.vypln',
      { pole: 'tisk.vypln', hodnota: 100, text: 'výplň 100 %' });
    if (p.tisk.material === 'PLA') pridej('info', 'PLA je křehké a na slunci měkne – na zkoušku tvaru dobré, na trvalé použití raději PETG, ASA nebo PA.', 'tisk.material');
    return H;
  }
  /** Leží bod uvnitř konvexního mnohoúhelníku aspoň `okraj` od hrany? */
  function uvnitr(ob, x, y, okraj = 0) {
    for (let i = 0; i < ob.length; i++) {
      const [x0, y0] = ob[i], [x1, y1] = ob[(i + 1) % ob.length], dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
      if (l < 1e-12) continue;
      if ((dx * (y - y0) - dy * (x - x0)) / l < okraj) return false;
    }
    return true;
  }

  /* ---------- pevnost ---------- */
  /** Dovolená pevnost podle toho, jak napětí míří vůči vrstvám: c = |cos| úhlu mezi směrem napětí a osou z tisku. */
  function pevnostMaterialu(p, c) {
    const m = MATERIALY[p.tisk.material], f = 0.55 + 0.45 * p.tisk.vypln / 100;
    return (m.xy * (1 - c * c) + m.z * c * c) * f;
  }
  /** Pevnostní odhad. nahoru = osa z tiskové polohy v dveřních souřadnicích (null = neznámá → bere se horší případ). */
  function pevnost(p, o, nahoru) {
    const radky = [];
    const cos = smer => (nahoru ? Math.abs(V.dot(smer, nahoru)) : 1);
    const pridej = (co, napeti, smer, pozn) => {
      const dov = pevnostMaterialu(p, cos(smer)), k = napeti > 0 ? dov / napeti : Infinity;
      radky.push({ co, napeti, dovolene: dov, k, pozn, napric: cos(smer) > 0.5 });
    };
    const d = o.dira;
    if (p.typ === 'klika') {
      const q = p.klika, F = p.pevnost.sila;
      const a = Math.max(o.rVnejsi + 10, o.dosah - 35);            // střed dlaně ≈ 35 mm od konce
      const rameno = a - o.rVnejsi;
      const M = F * rameno, W = o.prurez.Iu / (o.hKoren / 2);
      pridej('Rameno – ohyb u krčku', M / W, [1, 0, 0], `M = ${fmt(M / 1000, 1)} N·m na páce ${fmt(rameno, 0)} mm`);
      // krček: ohyb od síly na vyložení + krut F·a; průřez = kruh (nebo trubka) minus čtyřhran
      const r = o.rKrcku, Ik = Math.PI * r ** 4 / 4 - d ** 4 / 12, J = Math.PI * r ** 4 / 2 - d ** 4 / 6;
      const Mk = F * (q.vylozeni - Math.max(o.tr, o.z0)), T = F * a;
      const sig = Mk * r / Ik, tau = T * r / J;
      pridej('Krček – ohyb a krut', Math.sqrt(sig * sig + 3 * tau * tau), [0, 0, 1], `ohyb ${fmt(sig, 1)} MPa, krut ${fmt(tau, 1)} MPa (T = ${fmt(T / 1000, 1)} N·m)`);
      // otlačení čtyřhranu: T = p s² L / 3 (trojúhelníkový tlak na čtyřech stěnách)
      const Lz = Math.max(0.5, Math.min(o.hloubkaDiry, 30));   // bez otvoru (záporná hloubka) = otlačení na minimu, ne ∞
      pridej('Čtyřhran – otlačení stěn', 3 * T / (d * d * Lz), [0, 0, 1], `plocha ${fmt(Lz)} mm hloubky; když zámek dojede na doraz, celý moment jde do otvoru`);
      return { radky, popis: `síla ${fmt(F, 0)} N ${fmt(a, 0)} mm od osy (≈ ${fmt(F / 9.81, 0)} kg na konci kliky)` };
    }
    const T = p.pevnost.moment * 1000, r = o.rKrcku, J = Math.PI * r ** 4 / 2 - d ** 4 / 6, Lz = Math.max(0.5, Math.min(o.hloubkaDiry, 30));
    pridej('Krček – krut', T * r / J * Math.sqrt(3), [0, 0, 1], `moment ruky ${fmt(p.pevnost.moment, 1)} N·m`);
    pridej('Čtyřhran – otlačení stěn', 3 * T / (d * d * Lz), [0, 0, 1], `plocha ${fmt(Lz)} mm hloubky`);
    return { radky, popis: `moment ruky ${fmt(p.pevnost.moment, 1)} N·m (silný stisk ≈ 5–10 N·m)` };
  }
  const tridaBezpecnosti = k => (k >= 2 ? 'ok' : k >= 1.2 ? 'mez' : 'chyba');

  /* ---------- tisk ---------- */
  /** Kandidáti orientace pro díl. U kliky v dveřních souřadnicích: rovina kliky (xz) na podložce = bokem. */
  function kandidatiOrientace(p, dil) {
    if (dil === 'rozeta' || dil === 'rozetaKlic' || dil === 'stit') return [{ klic: 'zada', nazev: 'zadní stranou dolů', dolu: [0, 0, -1] }];
    if (dil === 'knob') return [
      { klic: '-Z', nazev: 'krčkem dolů', dolu: [0, 0, -1] },
      { klic: '+Z', nazev: 'vrchem dolů', dolu: [0, 0, 1] },
    ];
    if (dil === 'pul+') return [{ klic: 'rez', nazev: 'řezem dolů', dolu: [0, -1, 0] }];
    if (dil === 'pul-') return [{ klic: 'rez', nazev: 'řezem dolů', dolu: [0, 1, 0] }];
    return [
      { klic: 'bok-', nazev: 'na boku (spodní hranou dolů)', dolu: [0, -1, 0] },
      { klic: 'bok+', nazev: 'na boku (horní hranou dolů)', dolu: [0, 1, 0] },
      { klic: 'krcek', nazev: 'krčkem dolů (svisle)', dolu: [0, 0, -1] },
      { klic: 'licem', nazev: 'lícem dolů', dolu: [0, 0, 1] },
      { klic: 'konec', nazev: 'koncem ramene dolů', dolu: [1, 0, 0] },
    ];
  }
  /** Maska trojúhelníků, které tiskárna přemostí, i když pod nimi až k podložce nic není:
     otvor čtyřhranu (strop slepého otvoru, u poloviny stropy kanálku), otvor stavěcího šroubu a kapsa matice. Souřadnice dílu. */
  function maskaMostu(sit, p, o, dil) {
    const P = sit.poz, I = sit.idx, nT = I.length / 3, m = new Uint8Array(nT);
    if (!['klika', 'knob', 'pul+', 'pul-'].includes(dil)) return m;
    const d = o.dira / 2 + 0.05, st = o.staveci, mat = p.sroub.uchyceni === 'matice' && o.zs;
    const sf = st.matice + 0.3, tl = st.mVyska + 0.4, yc = -(o.dira / 2 + (o.stenaSroubu || 0) / 2);
    for (let t = 0; t < nT; t++) {
      const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
      const x = (P[a] + P[b] + P[c]) / 3, y = (P[a + 1] + P[b + 1] + P[c + 1]) / 3, z = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
      if (z < o.zDiry1 + 0.05 && Math.abs(x) < d && Math.abs(y) < d) m[t] = 1;      // stěny a strop otvoru čtyřhranu
      // úzké rameno nad osazením (≤ 3 mm) tiskárna vytiskne jako krátký převis – podpora by v něm nešla vyndat
      else if (o.rOs && !o.osazeniVen && o.rVnejsi - o.rOs <= 3 && Math.abs(z - o.zR) < 0.45 && Math.hypot(x, y) > o.rOs - 0.6 && Math.hypot(x, y) < o.rVnejsi + 0.6) m[t] = 1;
      else if (o.zs && y < 0 && Math.abs(x) < Math.max(st.d / 2, (o.samorez || o.vrut) ? (o.samorez || o.vrut).hlava / 2 : 0) + 0.6 && Math.abs(z - o.zs) < Math.max(st.vlozka / 2, (o.samorez || o.vrut) ? (o.samorez || o.vrut).hlava / 2 : 0) + 0.3) m[t] = 1;   // otvor šroubu (oblouček)
      else if (mat && Math.abs(x) < sf / 2 + 0.2 && Math.abs(y - yc) < tl / 2 + 0.05 && z > o.z0 && z < o.zs + sf / Math.sqrt(3) + 0.05) m[t] = 1;
    }
    return m;
  }
  /** Převisy dílu v poloze R (souřadnice dílu → tisk) s přeřazením přemostitelných míst z „volných“ na mosty. */
  function previsyDilu(sit, R, p, maska) {
    const pol = tiskovaPoloha(sit, R), pv = previsy(pol.poz, sit.idx, p.tisk.previs);
    const P = pol.poz, I = sit.idx, sinS = Math.sin(Math.min(89, p.tisk.previs + 15) * RAD);
    if (maska) for (let t = 0; t < pv.tridy.length; t++) {
      if (!maska[t] || pv.tridy[t] !== 2) continue;
      const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
      const n = V.cross(V.sub([P[b], P[b + 1], P[b + 2]], [P[a], P[a + 1], P[a + 2]]), V.sub([P[c], P[c + 1], P[c + 2]], [P[a], P[a + 1], P[a + 2]]));
      const l = V.len(n), A = l / 2;
      pv.volne -= A; pv.most += A; if (-n[2] / l > sinS) pv.strme -= A;
      pv.tridy[t] = 1;
    }
    pv.volne = Math.max(0, pv.volne); pv.strme = Math.max(0, pv.strme);
    return Object.assign(pv, { poz: pol.poz });
  }
  /** Ohodnotí orientace dílu (převisy + pevnost napříč vrstvami u kliky – ta rozhoduje, podpory jsou u oblé kliky skoro vždy). */
  function rozborDilu(sit, p, o, dil, volba = 'auto') {
    const vysl = [], maska = maskaMostu(sit, p, o, dil);
    for (const k of kandidatiOrientace(p, dil)) {
      const R = rotaceDolu(k.dolu), pv = previsyDilu(sit, R, p, maska);
      const nahoru = [R[6], R[7], R[8]];
      let slabe = 0;
      if (dil === 'klika' || dil === 'knob') for (const r of pevnost(p, o, nahoru).radky) if (r.napric) slabe++;
      const skore = pv.volne * 5 + pv.strme * 20 + pv.most * 0.3 + pv.vyska * 0.3 - Math.min(pv.podlozka, 150) * 0.2 + (pv.podlozka < 20 ? 10000 : 0) + slabe * 1e6;   // pevnost napříč vrstvami rozhoduje před převisy
      vysl.push(Object.assign({}, k, { R, nahoru, volne: pv.volne, strme: pv.strme, most: pv.most, podlozka: pv.podlozka, vyska: pv.vyska, slabe, skore }));
    }
    vysl.sort((a, b) => a.skore - b.skore);
    const vybrana = vysl.find(v => v.klic === volba) || vysl[0];
    return { kandidati: vysl, nejlepsi: vysl[0], vybrana, maska };
  }

  /* ---------- odhady a kusovník ---------- */
  function odhadTisku(objem, plocha, vyska, p) {
    const mat = MATERIALY[p.tisk.material];
    const plast = Math.min(objem, plocha * 1.2), vypln = Math.max(0, objem - plast) * p.tisk.vypln / 100;
    const V3 = plast + vypln, gramy = V3 / 1000 * mat.hustota;
    const metru = V3 / (Math.PI * 0.875 * 0.875) / 1000;
    const minut = (V3 / 7 + vyska / 0.2 * 1.5) / 60 * 1.1;
    return { gramy, metru, minut };
  }
  function kusovnik(p, o) {
    const out = [], ks = p.dvere.sada ? 2 : 1, st = o.staveci, pd = p.podlozeni;
    const velikost = jmenoSroubu(p);
    if (p.dvere.sada) {
      const v = o.vreteno;
      out.push({ ks: 1, co: `Čtyřhran ${fmt(p.vreteno.s, 2)} × ${v.std || Math.round(v.idealni)} mm`, chyba: !v.std && v.max < v.min,
        pozn: v.std ? `pro dveře ${fmt(p.dvere.tloustka)} mm vyhoví ${fmt(Math.ceil(v.min))}–${fmt(Math.floor(v.max))} mm` : `delší zkraťte na ${fmt(Math.round(v.idealni))} mm (rozsah ${fmt(Math.ceil(v.min))}–${fmt(Math.floor(v.max))})` });
    }
    if (o.pouzdro) out.push({ ks, co: `Ocelová čtyřhranná trubka ${fmt(o.pouzdro, 2)} × ${fmt(o.pouzdro, 2)} × ${fmt(p.vreteno.pouzdroStena, 2)} mm, délka ${fmt(Math.floor(o.hloubkaDiry - 1))} mm`,
      pozn: 'nasune se na čtyřhran a vlepí do kliky – rozloží tlak na plast; pro stavěcí šroub do ní provrtejte otvor' });
    if (p.sroub.uchyceni !== 'zadne') {
      if (o.vrut) {
        // délka: stěna krčku + ≈ 1,5 mm do čtyřhranu (špička se zaryje)
        const dv = delkaVrutu(o.vrut, o.stenaSroubu, true), L = dv.L;
        out.push({ ks, co: `Vrut do dřeva ${velikost} × ${L} se zápustnou hlavou`, chyba: dv.vycniva > 0.5,
          pozn: dv.vycniva > 0.5 ? `nejkratší běžný vrut bude vyčnívat o ${fmt(dv.vycniva)} mm – zkraťte ho, nebo prohlubte zahloubení` : `předvrt Ø ${fmt(o.vrut.predvrt, 1)} a zahloubení hlavy jsou v modelu; špička se zaryje do čtyřhranu (stěna ${fmt(o.stenaSroubu)} mm)` });
      } else if (o.samorez) {
        const ds = delkaVrutu(o.samorez, o.stenaSroubu, false), L = ds.L;
        out.push({ ks, co: `Samořezný vrut do plastu ${velikost} × ${L} ${o.samorez.tvar === 'kuzel' ? 'se zápustnou' : 's válcovou'} hlavou (typ PT / Delta PT)`, chyba: ds.vycniva > 0.5,
          pozn: ds.vycniva > 0.5 ? `nejkratší běžný bude vyčnívat o ${fmt(ds.vycniva)} mm – prohlubte zahloubení` : `předvrt Ø ${fmt(o.samorez.predvrt, 1)} a zahloubení hlavy jsou v modelu; zespodu krčku, ${fmt(o.zs)} mm od dveří` });
      } else out.push({ ks, co: `Stavěcí šroub ${velikost} × ${o.delkaStav} s vnitřním šestihranem (ISO 4026 / 4029)`, pozn: `imbus ${fmt(st.klic, 1)} mm; zespodu krčku, ${fmt(o.zs)} mm od dveří` });
      if (p.sroub.uchyceni === 'matice') out.push({ ks, co: `Matice ${velikost} (ISO 4032)`, pozn: 'zasune se do kapsy ze spodní strany krčku' });
      if (p.sroub.uchyceni === 'vlozka') out.push({ ks, co: `Zalisovací vložka ${velikost} (otvor Ø ${fmt(st.vlozka, 1)})`, pozn: 'zatavit páječkou se speciálním hrotem' });
      if (p.sroub.uchyceni === 'zavit') out.push({ ks, co: `Závit ${velikost} vyříznout závitníkem`, pozn: `předvrt Ø ${fmt(st.predvrt, 1)} je v modelu` });
    }
    if (pd.druh !== 'zadne') {
      const sr = o.sr, n = o.desky.reduce((s, d) => s + d.srouby.length, 0) * ks;
      if (sr.vrut) {
        const L = Math.max(16, Math.ceil((pd.tloustka + 16) / 5) * 5);
        out.push({ ks: n, co: `Vrut ${fmt(sr.d, 1)} × ${L} se zápustnou hlavou`, pozn: `do dřeva předvrtat Ø ${fmt(sr.predvrt, 1)} mm (vrtací šablona)` });
      } else {
        // šroub drží obě rozety, jen když je sada; dolů zaokrouhlený, aby nevyčníval z protější rozety
        const L = Math.floor((p.dvere.tloustka + 2 * pd.tloustka - o.vrtaniHlavy - 1) / 5) * 5, kusu = p.dvere.sada ? n / 2 : n;
        out.push({ ks: kusu, co: `Šroub M${fmt(sr.d)} × ${L} zápustný (ISO 10642) skrz dveře`, pozn: `do dveří vrtat Ø ${fmt(sr.predvrt)} mm; protikus: matice v rozetě druhé strany nebo pouzdrová matice` });
        out.push({ ks: kusu, co: `Pouzdrová (spojovací) matice M${fmt(sr.d)}`, pozn: 'do zahloubení na druhé straně' });
      }
      if (pd.klic === 'PZ') {
        const pul = Math.ceil((p.dvere.tloustka / 2 + pd.tloustka) / 5) * 5;
        const presah = pul - (p.dvere.tloustka / 2 + pd.tloustka);
        out.push({ ks: 1, co: `Cylindrická vložka ${pul}/${pul} mm`, chyba: presah > 3,
          pozn: `od osy zámku k líci ${pd.druh === 'stit' ? 'štítu' : 'rozety'} ${fmt(p.dvere.tloustka / 2 + pd.tloustka)} mm; přečnívá ${fmt(presah)} mm${presah > 3 ? ' – víc než doporučené 3 mm (kratší vložka nebývá)' : ''}` });
      }
      if (pd.klic === 'WC') out.push({ ks: 1, co: 'WC sada: otočný knoflík + nouzové odjištění', pozn: 'čtyřhran WC bývá 8 mm (ověřte na zámku)' });
    }
    if (p.typ === 'klika' && p.tisk.rozpulit) {
      out.push({ ks: 3 * ks, co: 'Kolík z filamentu 1,75 mm × 9 mm', pozn: 'srovná poloviny při lepení' });
      out.push({ ks: 1, co: 'Lepidlo: kyanoakrylát (PLA, PETG) nebo dvousložkový epoxid', pozn: 'lepený spoj leží v neutrální rovině ohybu ramene' });
    }
    return out;
  }

  /* ---------- vrtací šablona ---------- */
  /** Data šablony 1:1 v souřadnicích dveří (mm): obrysy desek, středy a průměry otvorů, hrana dveří. */
  function sablona(p, o) {
    const otvory = [{ x: 0, y: 0, d: Math.ceil(o.uhlopricka + 4), popis: `osa čtyřhranu (prostup Ø ${Math.ceil(o.uhlopricka + 4)} mm, má-li ho zámek, nevrtat)` }];
    const obrysy = [];
    for (const d of o.desky || []) {
      obrysy.push(d.obrys);
      for (const [x, y] of d.srouby) otvory.push({ x, y, d: o.sr.predvrt, popis: o.sr.vrut ? `předvrt Ø ${fmt(o.sr.predvrt, 1)}` : `skrz Ø ${fmt(o.sr.predvrt)}` });
    }
    const klic = o.klic && KLICE[o.klic.druh];
    return { otvory, obrysy, klic: klic ? { y: o.klic.y, obrys: obrysKlice(o.klic.druh).map(([x, y]) => [x, y + o.klic.y]), nazev: klic.nazev } : null,
      hrana: -p.dvere.trn, trn: p.dvere.trn, roztec: o.klic ? p.podlozeni.roztec : null };
  }

  /* ---------- projekt ---------- */
  function ulozProjekt(p) {
    return JSON.stringify({ format: 'webapp_kliky', verze: VERZE_FORMATU, ulozeno: new Date().toISOString(), projekt: p }, null, 2);
  }
  function nactiProjekt(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
    if (!o || typeof o !== 'object') throw new Error('Soubor neobsahuje projekt.');
    if (o.format !== 'webapp_kliky') throw new Error('Soubor není projekt kliky (chybí "format": "webapp_kliky").');
    if (!(o.verze >= 1) || o.verze > VERZE_FORMATU) throw new Error(`Nepodporovaná verze projektu ${o.verze}.`);
    return normalizuj(o.projekt);
  }
  function popis(p) {
    const ctyr = `□ ${fmt(p.vreteno.s, 2)}`;
    const pd = p.podlozeni, podl = pd.druh === 'zadne' ? 'bez rozety' : pd.druh === 'stit' ? `štít ${fmt(pd.stitSirka)}×${fmt(pd.stitVyska)}` : `rozeta ${TVARY_ROZETY[pd.tvar]}`;
    const klic = pd.druh !== 'zadne' && pd.klic !== 'zadny' ? ` ${pd.klic} ${fmt(pd.roztec)}` : '';
    if (p.typ === 'klika') return `klika ${TVARY_KLIKY[p.klika.tvar].nazev.toLowerCase()} ${fmt(p.klika.delka)} mm, ${ctyr}, ${podl}${klic}`;
    return `knob ${TVARY_KNOBU[p.knob.tvar].nazev.toLowerCase()} Ø ${fmt(p.knob.prumer)}, ${ctyr}, ${podl}${klic}`;
  }

  const API = {
    VERZE_FORMATU, VRETENA, TRNY, TRNY_US, DELKY_VRETEN, STAVECI, UCHYCENI, SROUBY_ROZETY, KLICE, TVARY_KLIKY, PRUREZY, TVARY_KNOBU, PUDORYSY,
    PODLOZENI, TVARY_ROZETY, MATERIALY, KOLIK_DILU, VYCHOZI, ROZSAHY, PREDVOLBY,
    kopie, cislo, fmt, vezmi, poloz, V, normalizuj, zPredvolby, prurezBody, prurezMiry, pater, osyPrurezu, teloKnobu, profilKnobu, pudorysKnobu,
    vrutRozmery, zahloubeniSroubu, delkaSroubu, delkaVrutu, kapsaProrazi, krivkaProfilu, protinaSe, normalizujBodySkici, TVARY_KRCKU, HRANY_KRCKU, krcekFunkce, tvarZeSeminka, klikaZeSeminka, klikaVlastni, parametryZeSeminka, vlastniZeSeminka, vlastniKnobZTvaru, interpoluj, samorezRozmery, STYLY_KLIK, KONCE_KLIK, kruhPateru, staveciZPrumeru, jmenoSroubu, obrysKlice, obrysDesky, uvnitr, odvozene, kontroly, pevnost, pevnostMaterialu, tridaBezpecnosti, kandidatiOrientace, rozborDilu, maskaMostu, previsyDilu,
    tiskovaPoloha, previsy, potrebujePodpory, odhadTisku, kusovnik, sablona, ulozProjekt, nactiProjekt, popis,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.KLIKY = API;
})();

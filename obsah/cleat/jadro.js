/* French cleat – háčky a úchyty: jádro bez DOM (běží i v node).
   Systém = nástěnná lišta se zkosením (tloušťka T, výška H, úkos α klesá ke zdi). Každý držák má záda se „zámkem“,
   který zapadne za úkos lišty – buď hranatý blok s vodorovným vrškem, nebo pás, který kopíruje úkos (méně plastu).
   Před zády je funkční část:
   – hak:    háky J (i sedlo), dvojitý hák, kolíky, kolébky na tyč; rameno může být výš a podepřené vzpěrou (heavy duty),
   – svorka: klip na tyč (svislou i vodorovnou), V-drážky na zaseknutí hadru a rukavic,
   – police: deska s lemem, vzpěrou a sklonem,
   – stojan: otvory (kruh, šestihran), drážky s hrdlem a náběhem, sada vrtáků na schodech s vyrytými průměry,
   – kapsa:  hranatá krabička (přepážky, šikmé čelo, výřez) nebo kulaté kelímky (i s prstencem místo dna),
   – deska:  montážní deska s otvory a průvlaky na pásky,
   – lista:  samotná tištěná nástěnná lišta s otvory pro vruty a rybinovým spojem dílů.
   Souřadnice: x podél zdi (šířka), y od zdi do místnosti (líc zdi y = 0), z nahoru (spodní hrana lišty z = 0).
   Obecné funkce tisku (převisy, orientace, odhad hmotnosti) bere ze spojky/jadro.js, geometrii skládá cleat/geometrie.js. */
(function () {
  'use strict';
  const SP = typeof module !== 'undefined' ? require('../spojky/jadro.js') : window.SPOJKY;
  const { kopie, cislo, fmt, vezmi, poloz, MATERIALY, SROUBY } = SP;
  const VERZE_FORMATU = 1;
  const RAD = Math.PI / 180, G = 9.81;

  /* ---------- tabulky ---------- */
  const TYPY = {
    hak: { nazev: 'Háky a kolíky', znak: '🪝', popis: 'háky J, heavy duty, dvojitý hák, sedlo na hadici, kolíky, kolébky na tyč' },
    svorka: { nazev: 'Klipy a svorky', znak: '🧷', popis: 'klip na tyč, násadu a trubku, V-drážky na zaseknutí hadru' },
    police: { nazev: 'Police', znak: '▭', popis: 'deska s lemem, vzpěrou a sklonem' },
    stojan: { nazev: 'Stojánek na nářadí', znak: '🪛', popis: 'šroubováky, bity, sada vrtáků s popisky, kleště, hřeben na kabely' },
    kapsa: { nazev: 'Kapsy a kelímky', znak: '🧺', popis: 'krabička s přepážkami, zásobník se šikmým čelem, kelímky a prstence' },
    deska: { nazev: 'Montážní deska', znak: '🔲', popis: 'otvory a průvlaky na pásky – přichytí cokoli' },
    lista: { nazev: 'Lišta a příslušenství', znak: '📏', popis: 'tištěná nástěnná lišta s rybinou, koncovka lišty, distanční podložka' },
    zkouska: { nazev: 'Zkoušky a měrky', znak: '🧪', popis: 'zkušební zámky s různou vůlí, měrka profilu dřevěné lišty' },
  };
  // běžné nástěnné lišty (T × H, úkos)
  const SYSTEMY = {
    pr18: { nazev: 'Překližka / MDF 18 mm, výška 80, 45°', s: { tl: 18, vyska: 80, uhel: 45, vule: 0.5, druh: 'drevo' } },
    pr15: { nazev: 'Překližka / OSB 15 mm, výška 70, 45°', s: { tl: 15, vyska: 70, uhel: 45, vule: 0.5, druh: 'drevo' } },
    pr12: { nazev: 'Překližka 12 mm, výška 60, 45°', s: { tl: 12, vyska: 60, uhel: 45, vule: 0.5, druh: 'drevo' } },
    pr18u30: { nazev: 'Překližka 18 mm, výška 90, úkos 30°', s: { tl: 18, vyska: 90, uhel: 30, vule: 0.5, druh: 'drevo' } },
    tisk12: { nazev: 'Tištěná lišta 12 × 40 mm, 45°', s: { tl: 12, vyska: 40, uhel: 45, vule: 0.3, druh: 'tisk' } },
    tisk8: { nazev: 'Tištěná mini lišta 8 × 30 mm, 45°', s: { tl: 8, vyska: 30, uhel: 45, vule: 0.25, druh: 'tisk' } },
  };
  const DRUHY_LISTY = { drevo: 'dřevo (překližka, MDF, OSB)', tisk: 'tištěná z plastu' };
  const ZAMKY = { plochy: 'hranatý – vodorovný vršek', kopie: 'kopíruje úkos – pás stejné tloušťky', zaves: 'závěs přes lištu – za lištou je mezera (kontralatě)' };
  const TVARY_HAKU = { J: 'hák J / sedlo', dvojity: 'dvojitý hák (dva nad sebou)', kolik: 'kolík šikmo nahoru', kolebka: 'kolébka na tyč', role: 'tyč na roli (ze strany)' };
  const DRUHY_LISTY_DILU = { dil: 'díl lišty na zeď', koncovka: 'koncovka lišty (krytka konce)', podlozka: 'distanční podložka pod lištu / kontralať' };
  const ZKOUSKY = { vule: 'zkušební zámky s různou vůlí', merka: 'měrka profilu lišty' };
  const HRANY = { zkosene: 'zkosené', oble: 'zaoblené' };
  const ODLEHCENI = { zadne: 'bez odlehčení', sestiuhelniky: 'šestiúhelníky', kruhy: 'kruhy' };
  const KOLEJNICE = { rybina: 'rybina (širší nahoře)', T: 'T profil' };
  const TVARY_SVORKY = { klip: 'klip na tyč / násadu / trubku', v: 'V-drážky na zaseknutí hadru' };
  const OSY_KLIPU = { svisle: 'tyč svisle (koště, násada)', vodorovne: 'tyč vodorovně podél zdi' };
  const OPERY = { lista: 'o líc lišty', zed: 'patkou o zeď pod lištou' };
  const VZPERY = { prihradova: 'příhradová (šikmá vzpěra)', plna: 'plná (trojúhelník)', zadna: 'bez vzpěry' };
  const DRUHY_OTVORU = { kruh: 'kulaté otvory', sestihran: 'šestihran (bity ¼″)', drazka: 'drážky zepředu (kleště, kabely, násada)', vrtaky: 'sada vrtáků – schody s popisky' };
  const TVARY_KAPSY = { hranata: 'hranatá krabička', kulata: 'kulaté kelímky' };
  const ZUBY = { hladke: 'hladká', pilove: 'pilové zuby', jemne: 'jemné zuby', zebra: 'žebra', vlny: 'vlnky' };
  const DNA = { plne: 'plné dno', prstenec: 'prstenec (věc prostrčená dnem se opře o lem)', zadne: 'bez dna (průchozí)' };
  const OTVORY_DESKY = {
    zezadu: 'průchozí, zápustná hlava vzadu (šroub do věci před deskou)',
    matice: 'průchozí + kapsa na matici vzadu (šroub M zepředu)',
    zepredu: 'slepé předvrtání pro vrut zepředu',
  };
  const SPOJE_LISTY = { rovny: 'rovné konce (díly k sobě na tupo)', rybina: 'rybinový zámek mezi díly' };
  const SPOJE_DESKY = { vrut: 'vrut', sroub: 'šroub M' };
  // vruty do dřeva / hmoždinky: průchozí otvor v plastu a typický průměr zápustné hlavy (ISO 7050 / DIN 7505)
  const VRUTY = {
    3: { d: 3, otvor: 3.5, hlava: 6, hmozdinka: 5 },
    3.5: { d: 3.5, otvor: 4, hlava: 7, hmozdinka: 6 },
    4: { d: 4, otvor: 4.5, hlava: 8, hmozdinka: 6 },
    4.5: { d: 4.5, otvor: 5, hlava: 9, hmozdinka: 6 },
    5: { d: 5, otvor: 5.5, hlava: 10, hmozdinka: 8 },
    6: { d: 6, otvor: 6.6, hlava: 12, hmozdinka: 10 },
  };
  const DELKY_VRUTU = [12, 16, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100];
  // zápustná hlava šroubu ISO 10642 ≈ 2 d; šestihranná matice ISO 4032 (otvor klíče s, výška m)
  const ZAPUSTNA_M = { M3: 6, M4: 8, M5: 10, M6: 12, M8: 16 };
  const MATICE = { M3: { s: 5.5, m: 2.4 }, M4: { s: 7, m: 3.2 }, M5: { s: 8, m: 4.7 }, M6: { s: 10, m: 5.2 }, M8: { s: 13, m: 6.8 } };
  // orientační pevnost tisknutých plastů v rovině vrstev (MPa), modul pružnosti a mez protažení (klipy); napříč vrstvami ≈ polovina
  const PEVNOST = { PLA: { mez: 50, E: 3500, eps: 0.025 }, PETG: { mez: 45, E: 2000, eps: 0.04 }, ASA: { mez: 40, E: 2000, eps: 0.035 },
    ABS: { mez: 35, E: 2000, eps: 0.035 }, PA: { mez: 55, E: 1600, eps: 0.08 }, PC: { mez: 60, E: 2300, eps: 0.05 } };
  const NAPRIC_VRSTVAMI = 0.5;
  const BEZPECNOST = 3;   // plast pod trvalou zátěží teče (creep) – rezerva 3×

  const VYCHOZI = {
    nazev: 'Hák na French cleat',
    typ: 'hak',
    system: { tl: 18, vyska: 80, uhel: 45, vule: 0.5, mezera: 1, mezeraZa: 25, druh: 'drevo' },
    zada: { sirka: 40, tl: 6, nad: 12, vyska: 70, opera: 'lista', patka: 10, sraz: 0.6, hrany: 'zkosene', spicka: 1.5, zaobleni: 0, rohy: 0, zamek: 'plochy', ocas: 25, pojistka: false,
      odlehceni: 'zadne', velOdlehceni: 10, zub: false, zubSirka: 3, zubHloubka: 2 },
    hak: { tvar: 'J', dosah: 60, vyska: 35, polomer: 10, tl: 9, tlSpicky: 7, uhel: 15, koule: 0, zahnuti: 0, vyskaRamene: 0,
      vzpera: false, delkaVzpery: 60, tlVzpery: 6, dosah2: 35, vyska2: 22, odstup2: 45,
      vDrazka: false, vPocet: 1, vSirka: 9, vSirkaDole: 0.8, vHloubka: 25, vZuby: 'pilove', vOtvor: 0,
      prumerTyce: 25, vuleTyce: 0.6, stena: 4, roh: 6, pocet: 1, sirka: 0 },
    svorka: { tvar: 'klip', osa: 'svisle', prumer: 25, vule: -0.3, stena: 3.5, otevreni: 82, nabeh: 4, odstup: 5, vyska: 25, pocet: 1,
      vPocet: 3, vSirka: 8, vSirkaDole: 0.8, vHloubka: 30, vBlok: 35, vVyska: 40, zuby: 'pilove', vOtvor: 0 },
    police: { hloubka: 100, tl: 5, lem: 8, tlLemu: 3, vzpera: 'prihradova', tlVzpery: 5, delkaVzpery: 80, sklon: 0 },
    stojan: { druh: 'kruh', pocet: 6, prumer: 9, sirkaDrazky: 14, delkaDrazky: 25, hrdlo: 0, nabeh: 0, roztec: 0, hloubka: 45, tl: 8, rady: 1,
      hloubkaOtvoru: 0, sraz: 1, bocnice: true, tlBocnice: 4, vyskaBocnice: 50,
      vrtaky: '1; 1,5; 2; 2,5; 3; 3,5; 4; 4,5; 5; 5,5; 6; 6,5; 7; 8; 9; 10', vuleVrtaku: 0.3, schod: 6, popisky: true, vyskaPisma: 4, hloubkaPisma: 0.6 },
    kapsa: { tvar: 'hranata', hloubka: 45, vyska: 60, stena: 2, dno: 2, dnoTyp: 'plne', lemDna: 5, celo: 100, prepazky: 0, vyrez: 0, odtok: false, pocet: 2, prumer: 30 },
    deska: { otvory: 'zezadu', spoj: 'vrut', sroub: 'M4', vrut: '3.5', sloupcu: 2, rad: 2, okraj: 10, pruvlaky: 0, sirkaPruvlaku: 21, rozpetiPruvlaku: 40,
      kolejnice: 0, kolTvar: 'rybina', kolSirka: 20, kolKrk: 14, kolVyska: 5, kolDelka: 60, kolDoraz: 5, magnety: 0, magPrumer: 10, magVyska: 3, magKryti: 0.8 },
    lista: { druh: 'dil', delka: 200, vrut: '5', roztec: 80, okraj: 25, spoj: 'rybina', vule: 0.2, zarezy: 0, stena: 2, hloubkaKoncovky: 15, velPodlozky: 40, tlPodlozky: 20 },
    zkouska: { druh: 'vule', vule: '0,2; 0,4; 0,6; 0,8; 1', sirka: 10, vyska: 30, tl: 2.4, okraj: 6 },
    zatez: { kg: 2, vylozeni: 40 },
    tisk: { material: 'PETG', vypln: 30, previs: 45, most: 25, orientace: 'auto', kusu: 1 },
  };

  // [min, max] – mimo rozsah se hodnota omezí a uživatel dostane hlášení
  const ROZSAHY = {
    'system.tl': [4, 40], 'system.vyska': [12, 200], 'system.uhel': [30, 60], 'system.vule': [0, 3], 'system.mezera': [0, 5], 'system.mezeraZa': [0, 120],
    'zada.sirka': [8, 400], 'zada.tl': [2, 30], 'zada.nad': [3, 60], 'zada.vyska': [10, 400], 'zada.patka': [3, 40],
    'zada.sraz': [0, 4], 'zada.velOdlehceni': [5, 40], 'zada.zubSirka': [1.5, 10], 'zada.zubHloubka': [0.8, 6], 'zada.spicka': [0, 6], 'zada.zaobleni': [0, 15], 'zada.rohy': [0, 30], 'zada.ocas': [3, 200],
    'hak.dosah': [8, 300], 'hak.vyska': [0, 250], 'hak.polomer': [0, 150], 'hak.tl': [3, 40], 'hak.tlSpicky': [2, 40], 'hak.uhel': [0, 60],
    'hak.koule': [0, 40], 'hak.zahnuti': [0, 90], 'hak.vyskaRamene': [0, 300], 'hak.delkaVzpery': [20, 100], 'hak.tlVzpery': [2, 30],
    'hak.dosah2': [8, 300], 'hak.vyska2': [0, 250], 'hak.odstup2': [5, 300], 'hak.vPocet': [1, 10], 'hak.vSirka': [2, 40], 'hak.vSirkaDole': [0, 40], 'hak.vHloubka': [3, 200], 'hak.vOtvor': [0, 30],
    'hak.prumerTyce': [3, 120], 'hak.vuleTyce': [0, 3], 'hak.stena': [1.5, 20], 'hak.roh': [0, 60], 'hak.pocet': [1, 10], 'hak.sirka': [0, 400],
    'svorka.prumer': [4, 120], 'svorka.vule': [-2, 3], 'svorka.stena': [1.5, 15], 'svorka.otevreni': [40, 100], 'svorka.nabeh': [0, 20],
    'svorka.odstup': [0, 150], 'svorka.vyska': [5, 200], 'svorka.pocet': [1, 10],
    'svorka.vPocet': [1, 20], 'svorka.vSirka': [2, 40], 'svorka.vSirkaDole': [0, 40], 'svorka.vHloubka': [5, 150], 'svorka.vBlok': [8, 200], 'svorka.vVyska': [8, 200], 'svorka.vOtvor': [0, 30],
    'police.hloubka': [15, 300], 'police.tl': [2, 20], 'police.lem': [0, 80], 'police.tlLemu': [1.5, 15], 'police.tlVzpery': [2, 20],
    'police.delkaVzpery': [30, 100], 'police.sklon': [-45, 45],
    'stojan.pocet': [1, 40], 'stojan.prumer': [2, 80], 'stojan.sirkaDrazky': [2, 80], 'stojan.delkaDrazky': [3, 200], 'stojan.hrdlo': [0, 80], 'stojan.nabeh': [0, 20],
    'stojan.roztec': [0, 200], 'stojan.hloubka': [10, 250], 'stojan.tl': [2, 60], 'stojan.rady': [1, 3], 'stojan.hloubkaOtvoru': [0, 60], 'stojan.sraz': [0, 5],
    'stojan.tlBocnice': [1.5, 15], 'stojan.vyskaBocnice': [5, 300], 'stojan.vuleVrtaku': [0, 1.5], 'stojan.schod': [0, 40],
    'stojan.vyskaPisma': [2, 12], 'stojan.hloubkaPisma': [0.2, 2],
    'kapsa.hloubka': [10, 250], 'kapsa.vyska': [10, 300], 'kapsa.stena': [1, 8], 'kapsa.dno': [1, 10], 'kapsa.lemDna': [1, 50], 'kapsa.celo': [20, 100],
    'kapsa.prepazky': [0, 12], 'kapsa.vyrez': [0, 290], 'kapsa.pocet': [1, 10], 'kapsa.prumer': [5, 150],
    'deska.sloupcu': [0, 10], 'deska.rad': [0, 10], 'deska.okraj': [3, 100], 'deska.pruvlaky': [0, 6], 'deska.sirkaPruvlaku': [5, 60], 'deska.rozpetiPruvlaku': [10, 380],
    'deska.kolejnice': [0, 4], 'deska.kolSirka': [6, 80], 'deska.kolKrk': [3, 80], 'deska.kolVyska': [2, 20], 'deska.kolDelka': [15, 300], 'deska.kolDoraz': [0, 20],
    'deska.magnety': [0, 20], 'deska.magPrumer': [3, 40], 'deska.magVyska': [1, 15], 'deska.magKryti': [0.4, 5],
    'lista.delka': [40, 1000], 'lista.roztec': [20, 400], 'lista.okraj': [8, 200], 'lista.vule': [0, 1], 'lista.zarezy': [0, 400],
    'lista.stena': [1, 6], 'lista.hloubkaKoncovky': [4, 60], 'lista.velPodlozky': [15, 150], 'lista.tlPodlozky': [2, 80],
    'zkouska.sirka': [5, 40], 'zkouska.vyska': [15, 120], 'zkouska.tl': [1, 6], 'zkouska.okraj': [3, 30],
    'zatez.kg': [0, 200], 'zatez.vylozeni': [0, 400],
    'tisk.vypln': [0, 100], 'tisk.previs': [20, 70], 'tisk.most': [0, 100], 'tisk.kusu': [1, 30],
  };
  const CELA = ['deska.kolejnice', 'deska.magnety', 'hak.pocet', 'hak.vPocet', 'svorka.pocet', 'svorka.vPocet', 'stojan.pocet', 'stojan.rady', 'kapsa.prepazky', 'kapsa.pocet', 'deska.sloupcu', 'deska.rad', 'deska.pruvlaky', 'tisk.kusu'];

  const PREDVOLBY = [
    { skupina: 'Háky a kolíky', nazev: 'Hák J na nářadí a bundy', popis: 'dosah 60, výška špičky 35, šířka 40 mm',
      p: { typ: 'hak' } },
    { skupina: 'Háky a kolíky', nazev: 'Heavy duty hák', popis: 'rameno 40 mm nad spodkem se vzpěrou, šířka 50, zahnutá špička – prodlužovačky, hadice, kabely',
      p: { typ: 'hak', zada: { sirka: 50, tl: 8, nad: 14, vyska: 110 }, hak: { tvar: 'J', dosah: 110, vyska: 45, polomer: 14, tl: 14, tlSpicky: 10, zahnuti: 30,
        vyskaRamene: 40, vzpera: true, delkaVzpery: 70, tlVzpery: 8 }, zatez: { kg: 8 }, tisk: { vypln: 50 } } },
    { skupina: 'Háky a kolíky', nazev: 'Hák se závěsem přes lištu', popis: 'lišta na kontralatích – zámek obejme lištu a ocasem zapadne za ni; vzpěra a kulička na špičce',
      p: { typ: 'hak', zada: { sirka: 40, tl: 6, nad: 6, vyska: 85, zamek: 'zaves', ocas: 30 }, system: { mezeraZa: 25 },
        hak: { tvar: 'J', dosah: 75, vyska: 40, polomer: 14, tl: 10, tlSpicky: 8, koule: 14, vyskaRamene: 38, vzpera: true, delkaVzpery: 55, tlVzpery: 7 }, zatez: { kg: 5 } } },
    { skupina: 'Háky a kolíky', nazev: 'Hák na ručník s V-drážkou', popis: 'široký hák, ve špičce zubatá V-drážka – roh ručníku nebo hadru se do ní zasekne',
      p: { typ: 'hak', zada: { sirka: 60, vyska: 75 }, hak: { tvar: 'J', dosah: 45, vyska: 50, polomer: 12, tl: 8, tlSpicky: 7, vDrazka: true, vPocet: 1, vSirka: 10, vHloubka: 30, vZuby: 'pilove', vOtvor: 6 }, zatez: { kg: 1 } } },
    { skupina: 'Háky a kolíky', nazev: 'Hák se zahnutou špičkou', popis: 'špička se stáčí zpět ke zdi – taška ani pásek nesklouzne',
      p: { typ: 'hak', hak: { tvar: 'J', dosah: 55, vyska: 35, polomer: 10, zahnuti: 60 } } },
    { skupina: 'Háky a kolíky', nazev: 'Dvojitý hák', popis: 'dlouhý dole a krátký nahoře – bunda a čepice, kabel a nabíječka',
      p: { typ: 'hak', zada: { vyska: 95 }, hak: { tvar: 'dvojity', dosah: 75, vyska: 30, polomer: 10, dosah2: 35, vyska2: 20, odstup2: 50 } } },
    { skupina: 'Háky a kolíky', nazev: 'Sedlo na hadici a kabely', popis: 'široký oblouk R 40 – kabel ani hadice se nezlomí',
      p: { typ: 'hak', zada: { sirka: 50, vyska: 80 }, hak: { tvar: 'J', dosah: 80, vyska: 60, polomer: 40, tl: 10, tlSpicky: 8 }, zatez: { kg: 3 } } },
    { skupina: 'Háky a kolíky', nazev: 'Velký hák na kolo / žebřík', popis: 'dosah 120, tloušťka 15, vzpěra, šířka 45 mm',
      p: { typ: 'hak', zada: { sirka: 45, tl: 8, nad: 14, vyska: 110 }, hak: { tvar: 'J', dosah: 120, vyska: 50, polomer: 15, tl: 15, tlSpicky: 10, vyskaRamene: 35, vzpera: true }, zatez: { kg: 6 }, tisk: { vypln: 50 } } },
    { skupina: 'Háky a kolíky', nazev: 'Kolík s kuličkou', popis: 'šikmo nahoru 15°, délka 60 mm – kladivo, metr, sluchátka',
      p: { typ: 'hak', zada: { sirka: 20 }, hak: { tvar: 'kolik', dosah: 60, uhel: 15, tl: 10, tlSpicky: 8, koule: 14 }, zatez: { kg: 1 } } },
    { skupina: 'Háky a kolíky', nazev: 'Jazýček na sponu', popis: 'svislý jazýček s mezerou 3 mm – nasune se spona metru, svítilny, multimetru',
      p: { typ: 'hak', zada: { sirka: 30, vyska: 75 }, hak: { tvar: 'J', dosah: 7, vyska: 55, polomer: 0, tl: 6, tlSpicky: 4 }, zatez: { kg: 1 } } },
    { skupina: 'Háky a kolíky', nazev: 'Kolébka na tyč Ø 25 (pár)', popis: 'tyč s rolí pásky, papíru, drátu – tiskněte 2 kusy',
      p: { typ: 'hak', zada: { sirka: 25 }, hak: { tvar: 'kolebka', dosah: 70, prumerTyce: 25, tl: 9, stena: 4, roh: 6 }, zatez: { kg: 2 }, tisk: { kusu: 2 } } },
    { skupina: 'Klipy a svorky', nazev: 'Klip na koště a násadu Ø 25', popis: 'svislá tyč se nacvakne zepředu, náběh ji navede',
      p: { typ: 'svorka', zada: { sirka: 40, vyska: 60 }, svorka: { tvar: 'klip', osa: 'svisle', prumer: 25, vyska: 30 }, zatez: { kg: 1.5 } } },
    { skupina: 'Klipy a svorky', nazev: 'Dva klipy na násady Ø 30', popis: 'hrábě, lopata, smeták vedle sebe',
      p: { typ: 'svorka', zada: { sirka: 100, vyska: 60 }, svorka: { tvar: 'klip', osa: 'svisle', prumer: 30, stena: 4, vyska: 30, pocet: 2, odstup: 8 }, zatez: { kg: 2 } } },
    { skupina: 'Klipy a svorky', nazev: 'Klip na vodorovnou tyč Ø 16', popis: 'tyč na ručníky, utěrky nebo role – tiskněte 2 kusy',
      p: { typ: 'svorka', zada: { sirka: 20, vyska: 55 }, svorka: { tvar: 'klip', osa: 'vodorovne', prumer: 16, stena: 3, otevreni: 86, odstup: 25 }, zatez: { kg: 1 }, tisk: { kusu: 2 } } },
    { skupina: 'Klipy a svorky', nazev: 'V-drážky na hadry', popis: 'tři zubaté V-drážky – roh hadru se do nich zasekne',
      p: { typ: 'svorka', zada: { sirka: 90, vyska: 55 }, svorka: { tvar: 'v', vPocet: 3, vSirka: 8, vHloubka: 30, vBlok: 30, vVyska: 40 }, zatez: { kg: 0.5 } } },
    { skupina: 'Klipy a svorky', nazev: 'Svorka na rukavice', popis: 'pět užších V-drážek bez zubů',
      p: { typ: 'svorka', zada: { sirka: 120, vyska: 50 }, svorka: { tvar: 'v', vPocet: 5, vSirka: 6, vHloubka: 25, vBlok: 25, vVyska: 32, zuby: 'hladke', vOtvor: 5 }, zatez: { kg: 0.5 } } },
    { skupina: 'Police a kapsy', nazev: 'Police 150 × 100 s lemem', popis: 'příhradová vzpěra, lem 8 mm',
      p: { typ: 'police', zada: { sirka: 150, vyska: 80 }, police: { hloubka: 100 }, zatez: { kg: 3 } } },
    { skupina: 'Police a kapsy', nazev: 'Polička na spreje a lahve', popis: 'hloubka 80, vysoký lem 18 mm, plná vzpěra',
      p: { typ: 'police', zada: { sirka: 180, vyska: 70 }, police: { hloubka: 80, lem: 18, tlLemu: 3, vzpera: 'plna' }, zatez: { kg: 3 } } },
    { skupina: 'Police a kapsy', nazev: 'Šikmá polička na tablet a návod', popis: 'sklon 15° dozadu, lem 12 mm drží spodní hranu',
      p: { typ: 'police', zada: { sirka: 160, vyska: 70 }, police: { hloubka: 45, lem: 12, sklon: -15, vzpera: 'plna' }, zatez: { kg: 1 } } },
    { skupina: 'Police a kapsy', nazev: 'Kapsa na tužky a fixy', popis: 'hranatá 80 × 40 × 60, jedna přepážka',
      p: { typ: 'kapsa', zada: { sirka: 80, vyska: 70 }, kapsa: { tvar: 'hranata', hloubka: 40, vyska: 60, prepazky: 1 }, zatez: { kg: 0.5 } } },
    { skupina: 'Police a kapsy', nazev: 'Zásobník se šikmým čelem', popis: '100 × 70, čelo na 45 % – drobnosti jdou snadno vybrat',
      p: { typ: 'kapsa', zada: { sirka: 100, vyska: 70 }, kapsa: { tvar: 'hranata', hloubka: 70, vyska: 60, celo: 45, prepazky: 1 }, zatez: { kg: 1.5 } } },
    { skupina: 'Police a kapsy', nazev: 'Krabička na drobnosti s výřezem', popis: '120 × 60 × 50, dvě přepážky, výřez zepředu',
      p: { typ: 'kapsa', zada: { sirka: 120, vyska: 60 }, kapsa: { tvar: 'hranata', hloubka: 60, vyska: 50, prepazky: 2, vyrez: 20, odtok: true }, zatez: { kg: 1 } } },
    { skupina: 'Police a kapsy', nazev: 'Kelímky na spreje Ø 66', popis: 'dva kulaté kelímky na spreje a lahvičky',
      p: { typ: 'kapsa', zada: { sirka: 140, vyska: 70 }, kapsa: { tvar: 'kulata', pocet: 2, prumer: 67, vyska: 60, stena: 2.2, dno: 2 }, zatez: { kg: 1.5 } } },
    { skupina: 'Police a kapsy', nazev: 'Prstence na lahve s lepidlem', popis: 'tři prstence Ø 40 – lahev prostrčená hrdlem dolů se opře o lem',
      p: { typ: 'kapsa', zada: { sirka: 140, vyska: 60 }, kapsa: { tvar: 'kulata', pocet: 3, prumer: 40, vyska: 30, dnoTyp: 'prstenec', lemDna: 8 }, zatez: { kg: 1 } } },
    { skupina: 'Nářadí', nazev: 'Stojánek na 6 šroubováků', popis: 'otvory Ø 9 se zkosením, bočnice',
      p: { typ: 'stojan', zada: { sirka: 120, vyska: 60 }, stojan: { druh: 'kruh', pocet: 6, prumer: 9 }, zatez: { kg: 1.5 } } },
    { skupina: 'Nářadí', nazev: 'Sada vrtáků 1–10 mm s popisky', popis: '16 slepých otvorů na 2 schodech, vyryté průměry',
      p: { typ: 'stojan', zada: { sirka: 130, vyska: 60 }, stojan: { druh: 'vrtaky', rady: 2, tl: 16, schod: 8, hloubkaOtvoru: 14, sraz: 0.6, bocnice: false }, zatez: { kg: 0.5 } } },
    { skupina: 'Nářadí', nazev: 'Sada vrtáků 1–13 mm (3 schody)', popis: '25 vrtáků po 0,5 mm, popisky Ø',
      p: { typ: 'stojan', zada: { sirka: 180, vyska: 70 }, stojan: { druh: 'vrtaky', rady: 3, tl: 16, schod: 8, hloubkaOtvoru: 14, sraz: 0.6, bocnice: false,
        vrtaky: '1; 1,5; 2; 2,5; 3; 3,5; 4; 4,5; 5; 5,5; 6; 6,5; 7; 7,5; 8; 8,5; 9; 9,5; 10; 10,5; 11; 11,5; 12; 12,5; 13' }, zatez: { kg: 1 } } },
    { skupina: 'Nářadí', nazev: 'Držák kleští a nůžek', popis: '5 drážek 14 × 30 mm otevřených zepředu',
      p: { typ: 'stojan', zada: { sirka: 140, vyska: 60 }, stojan: { druh: 'drazka', pocet: 5, sirkaDrazky: 14, delkaDrazky: 30, hloubka: 50, tl: 8, nabeh: 2 }, zatez: { kg: 2 } } },
    { skupina: 'Nářadí', nazev: 'Hřeben na kabely', popis: '8 drážek Ø 7 s užším hrdlem – kabel se zacvakne',
      p: { typ: 'stojan', zada: { sirka: 140, vyska: 50 }, stojan: { druh: 'drazka', pocet: 8, sirkaDrazky: 7, delkaDrazky: 18, hrdlo: 5.5, nabeh: 1.5, hloubka: 28, tl: 6, bocnice: false }, zatez: { kg: 0.5 } } },
    { skupina: 'Nářadí', nazev: 'Vidlice na násadu a aku vrtačku', popis: 'jedna široká drážka 36 mm s náběhem',
      p: { typ: 'stojan', zada: { sirka: 90, vyska: 70 }, stojan: { druh: 'drazka', pocet: 1, sirkaDrazky: 36, delkaDrazky: 45, nabeh: 5, hloubka: 70, tl: 10, tlBocnice: 5, vyskaBocnice: 60 }, zatez: { kg: 3 } } },
    { skupina: 'Nářadí', nazev: 'Blok na bity ¼″ (2 řady)', popis: '2 × 10 slepých šestihranů 6,6 mm hloubky 9',
      p: { typ: 'stojan', zada: { sirka: 110, vyska: 50 }, stojan: { druh: 'sestihran', pocet: 10, prumer: 6.6, rady: 2, hloubka: 30, tl: 12, hloubkaOtvoru: 9, sraz: 0.6, bocnice: false }, zatez: { kg: 0.5 } } },
    { skupina: 'Nářadí', nazev: 'Montážní deska 100 × 100', popis: '4 otvory pro vruty 3,5 se zápustnou hlavou vzadu',
      p: { typ: 'deska', zada: { sirka: 100, tl: 8, vyska: 100 }, zatez: { kg: 2, vylozeni: 40 } } },
    { skupina: 'Nářadí', nazev: 'Deska s průvlaky na suchý zip', popis: 'dva páry průvlaků 21 mm – přichytí aku nářadí, lampu, zdroj',
      p: { typ: 'deska', zada: { sirka: 80, tl: 8, vyska: 110 }, deska: { sloupcu: 0, rad: 0, pruvlaky: 2, sirkaPruvlaku: 21, rozpetiPruvlaku: 50 }, zatez: { kg: 2, vylozeni: 40 } } },
    { skupina: 'Háky a kolíky', nazev: 'Tyč na roli utěrek a fólie', popis: 'rameno z jedné strany, tyč Ø 22 se nasune do role, na konci zarážka',
      p: { typ: 'hak', zada: { sirka: 260, vyska: 70 }, hak: { tvar: 'role', dosah: 70, prumerTyce: 22, tl: 12 }, zatez: { kg: 1 } } },
    { skupina: 'Nářadí', nazev: 'Kolejnička na aku baterie', popis: 'dvě rybinové kolejničky s dorazem – baterie se nasune shora; rozměry přeměřte na své baterii',
      p: { typ: 'deska', zada: { sirka: 150, tl: 6, vyska: 110 }, deska: { sloupcu: 0, rad: 0, kolejnice: 2, kolTvar: 'rybina', kolSirka: 20, kolKrk: 15, kolVyska: 5, kolDelka: 60, kolDoraz: 6 }, zatez: { kg: 2, vylozeni: 45 } } },
    { skupina: 'Nářadí', nazev: 'Magnetická lišta na nože a bity', popis: '6 magnetů Ø 10 × 3 v kapsách zezadu, přední stěna 0,8 mm – magnet drží za lištou',
      p: { typ: 'deska', zada: { sirka: 200, tl: 5, vyska: 60 }, deska: { sloupcu: 0, rad: 0, magnety: 6, magPrumer: 10, magVyska: 3, magKryti: 0.8 }, zatez: { kg: 1, vylozeni: 10 } } },
    { skupina: 'Lišty a systémy', nazev: 'Zarážka na lištu (proti posunu)', popis: 'úzký díl s pojistným vrutem – držáky vedle něj nesjedou do strany',
      p: { typ: 'deska', nazev: 'Zarážka', zada: { sirka: 15, tl: 6, vyska: 55, pojistka: true }, deska: { sloupcu: 0, rad: 0 }, zatez: { kg: 1, vylozeni: 0 } } },
    { skupina: 'Lišty a systémy', nazev: 'Koncovka lišty 18 × 80', popis: 'krytka konce dřevěné lišty – nasune se a zakryje řez',
      p: { typ: 'lista', nazev: 'Koncovka lišty', lista: { druh: 'koncovka', stena: 2, hloubkaKoncovky: 15 } } },
    { skupina: 'Lišty a systémy', nazev: 'Distanční podložka 20 mm', popis: 'pod lištu nebo kontralať – vytvoří mezeru pro závěs přes lištu',
      p: { typ: 'lista', nazev: 'Distanční podložka', lista: { druh: 'podlozka', velPodlozky: 40, tlPodlozky: 20 } } },
    { skupina: 'Zkoušky a měrky', nazev: 'Zkušební zámky 0,2–1 mm', popis: 'pět samostatných vzorků zámku s různou vůlí – vyzkoušejte na své liště, který sedí',
      p: { typ: 'zkouska', nazev: 'Zkouška vůle', zkouska: { druh: 'vule' } } },
    { skupina: 'Zkoušky a měrky', nazev: 'Měrka profilu lišty', popis: 'přiložte na konec dřevěné lišty – hned uvidíte, jestli sedí tloušťka, výška i úkos',
      p: { typ: 'zkouska', nazev: 'Měrka lišty', zkouska: { druh: 'merka' } } },
    { skupina: 'Lišty a systémy', nazev: 'Tištěná lišta 12 × 40, díl 200 mm', popis: 'rybinový zámek, vruty 5 mm po 80 mm',
      p: { typ: 'lista', nazev: 'Lišta French cleat', system: { tl: 12, vyska: 40, uhel: 45, vule: 0.3, druh: 'tisk' }, lista: { delka: 200 } } },
    { skupina: 'Lišty a systémy', nazev: 'Hák pro tištěnou lištu 12 × 40', popis: 'menší záda, zámek kopíruje úkos',
      p: { typ: 'hak', system: { tl: 12, vyska: 40, uhel: 45, vule: 0.3, druh: 'tisk' }, zada: { sirka: 25, tl: 5, nad: 5, vyska: 45, zamek: 'kopie' }, hak: { tvar: 'J', dosah: 40, vyska: 25, polomer: 6, tl: 7, tlSpicky: 6 }, zatez: { kg: 1 } } },
  ];

  /* ---------- drobnosti ---------- */
  const ZAKAZANE = new Set(['__proto__', 'constructor', 'prototype']);
  const sl = (o, z) => { for (const k of Object.keys(z)) if (ZAKAZANE.has(k)) continue; else if (z[k] && typeof z[k] === 'object' && !Array.isArray(z[k]) && o[k] && typeof o[k] === 'object') sl(o[k], z[k]); else if (!(z[k] && typeof z[k] === 'object' && !Array.isArray(z[k]))) o[k] = z[k]; return o; };
  const vyber = (h, tab, vych) => (Object.prototype.hasOwnProperty.call(tab, h) ? h : vych);
  const omez = (x, a, b) => Math.min(b, Math.max(a, x));

  /** Doplní chybějící hodnoty, omezí rozsahy. Vrací {p, hlaseni: [texty o úpravách]}. */
  function normalizuj(vstup) {
    const p = kopie(VYCHOZI), hl = [];
    if (vstup && typeof vstup === 'object') sl(p, kopie(vstup));
    p.typ = vyber(p.typ, TYPY, 'hak');
    p.system.druh = vyber(p.system.druh, DRUHY_LISTY, 'drevo');
    p.zada.opera = vyber(p.zada.opera, OPERY, 'lista');
    p.zada.zamek = vyber(p.zada.zamek, ZAMKY, 'plochy');
    p.zada.pojistka = !!p.zada.pojistka;
    p.hak.tvar = vyber(p.hak.tvar, TVARY_HAKU, 'J');
    p.hak.vzpera = !!p.hak.vzpera;
    p.hak.vDrazka = !!p.hak.vDrazka;
    const zuby = v => (v === true ? 'pilove' : v === false ? 'hladke' : vyber(v, ZUBY, 'pilove'));   // starší projekty: true/false
    p.hak.vZuby = zuby(p.hak.vZuby);
    p.svorka.tvar = vyber(p.svorka.tvar, TVARY_SVORKY, 'klip');
    p.svorka.osa = vyber(p.svorka.osa, OSY_KLIPU, 'svisle');
    p.svorka.zuby = zuby(p.svorka.zuby);
    p.police.vzpera = vyber(p.police.vzpera, VZPERY, 'prihradova');
    p.stojan.druh = vyber(p.stojan.druh, DRUHY_OTVORU, 'kruh');
    p.stojan.bocnice = !!p.stojan.bocnice;
    p.stojan.popisky = !!p.stojan.popisky;
    p.stojan.vrtaky = String(p.stojan.vrtaky == null ? '' : p.stojan.vrtaky).slice(0, 300);
    p.kapsa.tvar = vyber(p.kapsa.tvar, TVARY_KAPSY, 'hranata');
    p.kapsa.dnoTyp = vyber(p.kapsa.dnoTyp, DNA, 'plne');
    p.kapsa.odtok = !!p.kapsa.odtok;
    p.deska.otvory = vyber(p.deska.otvory, OTVORY_DESKY, 'zezadu');
    p.deska.spoj = vyber(p.deska.spoj, SPOJE_DESKY, 'vrut');
    p.deska.sroub = vyber(p.deska.sroub, SROUBY, 'M4');
    p.deska.vrut = vyber(String(p.deska.vrut), VRUTY, '3.5');
    if (p.deska.otvory === 'matice') p.deska.spoj = 'sroub';
    p.lista.vrut = vyber(String(p.lista.vrut), VRUTY, '5');
    p.lista.spoj = vyber(p.lista.spoj, SPOJE_LISTY, 'rybina');
    p.lista.druh = vyber(p.lista.druh, DRUHY_LISTY_DILU, 'dil');
    p.zkouska.druh = vyber(p.zkouska.druh, ZKOUSKY, 'vule');
    p.zkouska.vule = String(p.zkouska.vule == null ? '' : p.zkouska.vule).slice(0, 120);
    p.zada.hrany = vyber(p.zada.hrany, HRANY, 'zkosene');
    p.zada.odlehceni = vyber(p.zada.odlehceni, ODLEHCENI, 'zadne');
    p.zada.zub = !!p.zada.zub;
    p.deska.kolTvar = vyber(p.deska.kolTvar, KOLEJNICE, 'rybina');
    p.tisk.material = vyber(p.tisk.material, MATERIALY, 'PETG');
    p.nazev = String(p.nazev == null ? '' : p.nazev).slice(0, 120);
    p.tisk.orientace = String(p.tisk.orientace || 'auto').slice(0, 20);
    for (const [c, [mn, mx]] of Object.entries(ROZSAHY)) {
      let h = cislo(vezmi(p, c), vezmi(VYCHOZI, c));
      if (h < mn || h > mx) { const o = omez(h, mn, mx); hl.push(`${c} ${fmt(h, 2)} → ${fmt(o, 2)}`); h = o; }
      poloz(p, c, h);
    }
    for (const c of CELA) poloz(p, c, Math.round(vezmi(p, c)));
    return { p, hlaseni: hl };
  }
  function zPredvolby(i) {
    const v = PREDVOLBY[i], p = normalizuj({}).p;
    sl(p, kopie(v.p));
    if (!v.p.nazev) p.nazev = v.nazev;
    return normalizuj(p).p;
  }
  /** Přepíše jen systém lišty předvolbou (držák zůstane). */
  function nastavSystem(p, klic) {
    const s = SYSTEMY[klic];
    if (s) Object.assign(p.system, kopie(s.s));
    return p;
  }
  /** lišta a zkoušky nejsou držáky (nemají zátěž ani funkční část) */
  const jeDrzak = p => p.typ !== 'lista' && p.typ !== 'zkouska';
  const rozloz = (n, a, b) => (n <= 0 ? [] : n === 1 ? [(a + b) / 2] : Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1)));
  /** Seznam čísel z textu „1; 1,5 2“ (středník nebo mezera, desetinná čárka). */
  const seznam = t => String(t || '').split(/[;\s]+/).filter(Boolean).map(x => cislo(x, NaN)).filter(Number.isFinite);

  /** Otvor pro vrut / šroub: ro poloměr díry, rh poloměr zápustné hlavy (+ vůle), hz hloubka kuželu 90°. */
  function otvor(spoj, vrut, sroub, tl) {
    const m = SROUBY[sroub];
    const v = spoj === 'sroub' ? { d: m.d, otvor: m.otvor, hlava: ZAPUSTNA_M[sroub], nazev: `šroub ${sroub}` }
      : Object.assign({ nazev: `vrut ${fmt(VRUTY[vrut].d)}` }, VRUTY[vrut]);
    const ro = v.otvor / 2, rh = v.hlava / 2 + 0.25;
    return { v, ro, rh, hz: Math.max(0, Math.min(rh - ro, tl - 0.6)), hzPlna: rh - ro };
  }

  /* ---------- odvozené rozměry ---------- */
  /** Společný základ: lišta, záda, zámek. */
  function zaklad(p) {
    const s = p.system, z = p.zada;
    const T = s.tl, H = s.vyska, al = s.uhel, sa = Math.sin(al * RAD), ta = Math.tan(al * RAD), ca = Math.cos(al * RAD);
    const c = s.vule, pokles = T * ta;   // o kolik úkos klesne od líce ke zdi
    // závěs přes lištu: lišta je na kontralatích, zeď je o mezeraZa za její zadní plochou a za lištu zapadne ocas
    const zaves = z.zamek === 'zaves', yZed = zaves ? -s.mezeraZa : 0;
    const gw = zaves ? yZed + Math.min(s.mezera, s.mezeraZa) : Math.min(s.mezera, T - 1);   // nejzazší místo dílu u zdi
    const yZ = T + c, b = z.tl, y0 = yZ + b;
    // roh lišty zvětšené o vůli (průsečík líce + c a úkosu + c) leží o rohC nad horní hranou lišty
    const rohC = c * (1 + sa) / ca;
    const kopieUkosu = z.zamek === 'kopie' || zaves;   // pás stejné tloušťky kolem lišty
    const zOcas = H - pokles - z.ocas;                   // spodek ocasu závěsu za lištou
    const zTop = kopieUkosu ? H + rohC + z.nad : H + z.nad;
    // horní hrana zad na líci: u zámku „kopie“ jen po roh lišty, výš už je jen pás zámku
    const zadaTop = kopieUkosu ? H + rohC : zTop;
    const zBot = zTop - z.vyska;
    const zL = y => H - (T - y) * ta + c / ca;            // spodek zámku nad úkosem (lišta + vůle)
    // dolní opěra: o líc lišty (tlačí v rozsahu lišty) nebo patkou o zeď pod lištou
    const patka = z.opera === 'zed' ? Math.min(z.patka, Math.max(0, -c - zBot)) : 0;
    const dole = z.opera === 'zed' ? zBot + patka / 2 : Math.max(zBot, 0);   // kde záda tlačí dole
    const kontakt = { y: T / 2, z: H - pokles / 2 };    // střed úkosu – kudy jde síla zámku
    const hl = kopieUkosu ? z.nad : Math.max(0.5, zTop - (H + c));   // tloušťka zámku nad lištou
    return { T, H, al, ta, ca, c, gw, pokles, yZ, b, y0, zTop, zadaTop, zBot, zL, rohC, kopieUkosu, zaves, yZed, zOcas, hl, spicka: z.spicka, patka, dole, kontakt,
      W: z.sirka, sraz: Math.min(z.sraz, b / 2 - 0.3), r: z.zaobleni };
  }

  /** Hák J: páteř vodorovně od zad, ohyb s vnitřním poloměrem, svisle ke špičce (případně zahnutí zpět ke zdi).
     zA = spodek ramene; dosah = vnější líc ohybu od líce zad. */
  function hakJ(o, dosah, vyska, polomer, zA, t0, t1, zahnuti) {
    const zc0 = zA + t0 / 2, tb = (t0 + t1) / 2;
    const Rmax = Math.max(0, dosah - t1 / 2 - tb / 2 - 0.5);
    const Rin = Math.min(polomer, Rmax), Rs = Rin + tb / 2;
    const xv = o.y0 + dosah - t1 / 2;
    const Cb = [xv - Rs, zc0 + Rs];
    const zTip = zA + Math.max(vyska, t0) - t1 / 2;
    const svisla = zTip > Cb[1] + 0.01;
    const Rz = Math.max(4, t1), fz = svisla ? zahnuti * RAD : 0;
    const horni = (svisla ? zTip + Rz * Math.sin(Math.min(fz, Math.PI / 2)) : Math.max(zTip, zc0)) + t1 / 2;
    return { zA, zc0, Rin, Rs, Rmax, xv, Cb, zTip, svisla, Rz, fz, horni, rovne: Cb[0] - o.y0,
      e: Math.max(t0, dosah - t1 - Rin / 2), vnitrniSirka: dosah - t1, vyskaSpicky: Math.max(vyska, t0) };
  }

  function odvozHak(p, o) {
    const h = p.hak, n = h.pocet, W = o.W;
    // šířka a polohy háků podél zdi
    const w = h.sirka > 0 ? Math.min(h.sirka, W) : (n === 1 ? W : Math.max(6, W / (2 * n - 1)));
    const xs = rozloz(n, w / 2, W - w / 2).map(x => [x - w / 2, x + w / 2]);
    const celou = n === 1 && w >= W - 0.01;
    const t0 = h.tl, t1 = Math.min(h.tlSpicky, t0), zA = o.zBot + h.vyskaRamene;
    const zc0 = zA + t0 / 2;
    const R = { tvar: h.tvar, w, xs, celou, t0, t1, zA, zc0 };
    if (h.tvar === 'J' || h.tvar === 'dvojity') {
      Object.assign(R, hakJ(o, h.dosah, h.vyska, h.polomer, zA, t0, t1, h.zahnuti));
      if (h.koule > t1) R.horni += h.koule / 2 - t1 / 2;
      R.horniHlavni = R.horni;   // vršek špičky hlavního (dolního) háku – od něj se řeže V-drážka
      if (h.tvar === 'dvojity') {
        R.druhy = hakJ(o, h.dosah2, h.vyska2, h.polomer, zA + h.odstup2, t0, t1, h.zahnuti);
        R.horni = Math.max(R.horni, R.druhy.horni + (h.koule > t1 ? h.koule / 2 - t1 / 2 : 0));
      }
    } else if (h.tvar === 'kolik') {
      const b = h.uhel * RAD, L = h.dosah;
      const konec = [o.y0 + L * Math.cos(b), zc0 + L * Math.sin(b)];
      const rk = Math.max(t1, h.koule) / 2;
      Object.assign(R, { uhel: h.uhel, konec, rk, e: L * Math.cos(b), horni: konec[1] + rk });
    } else if (h.tvar === 'role') {
      // tyč na roli: rameno z jedné strany (x 0…ta), na jeho konci vodorovná tyč podél zdi do x = W se zarážkou na konci
      const rr = h.prumerTyce / 2, ta = Math.max(8, t0), yr = o.y0 + h.dosah - rr, zr = zA + rr, kon = 3;
      Object.assign(R, { celou: true, rr, ta, yr, zr, kon, delkaTyce: W - ta, e: h.dosah - rr, horni: zr + rr + kon });
    } else {
      // kolébka: rameno, na konci blok s půlkruhovým lůžkem otevřeným nahoru
      const rr = h.prumerTyce / 2 + h.vuleTyce, st = h.stena;
      const yc = o.y0 + h.dosah - st - rr, zr = zA + st + rr;
      Object.assign(R, { rr, st, yc, zr, roh: h.roh, e: yc - o.y0, horni: zr + h.roh });
    }
    // V-drážka ve špičce (ručník, hadr): zářez shora do svislé části háku, skrz její tloušťku
    if (h.vDrazka && (h.tvar === 'J' || h.tvar === 'dvojity')) {
      const vrch = R.horniHlavni, dno = Math.max(R.zc0 + t0 / 2 + 1.5, R.Cb[1] + 1);   // dno drážky ve svislé části (nad ohybem i ramenem)
      const ro = h.vOtvor / 2;   // kulatý otvor na konci drážky – střed na dně V
      const hd = Math.max(0, Math.min(h.vHloubka, vrch - dno - ro)), usti = Math.min(2, h.vSirka / 3);
      const kraje = R.celou ? [[0, W]] : xs;
      const centra = kraje.flatMap(([a, b]) => Array.from({ length: h.vPocet }, (_, i) => a + (b - a) * (i + 0.5) / h.vPocet));
      R.vDrazka = { zt: vrch, hd, ro, w0: h.vSirka, wd: Math.min(h.vSirkaDole, h.vSirka), usti, n: h.vPocet, xs: centra, roztec: (kraje[0][1] - kraje[0][0]) / h.vPocet,
        y0: Math.max(o.y0 + 0.5, R.xv - t1 / 2 - (R.fz > 0 ? 2 * R.Rz : 0) - 1), y1: R.xv + Math.max(t1, h.koule) / 2 + 1 };
    }
    // vzpěra pod ramenem (heavy duty): od spodku zad k ramenu, uzel v delkaVzpery % vodorovné délky ramene
    if (h.vzpera && h.vyskaRamene >= 8 && h.tvar !== 'role') {
      const ts = h.tlVzpery, delkaRamene = h.tvar === 'kolebka' ? R.yc - o.y0 : h.tvar === 'kolik' ? R.e : Math.max(5, R.rovne + R.Rs * 0.3);
      const a = Math.max(ts, delkaRamene * h.delkaVzpery / 100);
      const zUzel = h.tvar === 'kolik' ? zc0 + a * Math.tan(h.uhel * RAD) : zc0;
      R.vzpera = { ts, a, zUzel, P0: [o.y0 - 0.3, o.zBot + ts / 2], P1: [o.y0 + a - ts / 2, zUzel - t0 / 2 + ts / 2], hv: Math.max(5, zUzel - (o.zBot + ts / 2)) };
    }
    return R;
  }

  function odvozSvorka(p, o) {
    const q = p.svorka;
    if (q.tvar === 'klip') {
      const Ri = (q.prumer + q.vule) / 2, Ro = Ri + q.stena, otv = Math.min(q.otevreni / 100 * q.prumer, 2 * Ri - 0.2);
      const beta = Math.asin(Math.min(0.999, otv / 2 / Ri));   // poloviční úhel otvoru zepředu
      const uc = o.y0 + q.odstup + Ro, wa = Math.min(2 * Ro, Math.max(2 * q.stena + 2, 0.7 * 2 * Ro));
      const svisle = q.osa === 'svisle', n = svisle ? q.pocet : 1;
      const Wpotreba = svisle ? n * 2 * (Ro + q.nabeh) + (n - 1) * 3 : 0;
      const W = svisle ? Math.max(o.W, Wpotreba) : o.W;
      const xs = svisle ? rozloz(n, Ro + q.nabeh, W - Ro - q.nabeh) : [];
      const vc = svisle ? null : o.zBot + Ro;   // vodorovný klip sedí spodkem na spodku zad
      // zacvaknutí: kroužek se musí rozevřít o (Ø − otvor); poměrné protažení vnějších vláken ε ≈ 1,5·s·δ / (π·Rs²)
      const delta = Math.max(0, q.prumer - otv), Rs = Ri + q.stena / 2;
      const eps = 1.5 * q.stena * delta / (Math.PI * Rs * Rs);
      const h = svisle ? q.vyska : W;
      return { tvar: 'klip', svisle, Ri, Ro, otv, beta, uc, wa, n, xs, W, rozsireno: W > o.W + 0.01, vc, eps, delta, h,
        e: uc - o.y0, horni: svisle ? o.zBot + q.vyska : vc + Ro };
    }
    const ro = q.vOtvor / 2, n = q.vPocet, w0 = q.vSirka, Hv = q.vVyska, D = q.vBlok, hd = Math.max(0, Math.min(q.vHloubka, Hv - 3 - ro)), usti = Math.min(2, w0 / 3);
    const roztec = (o.W - 4) / n, xs = Array.from({ length: n }, (_, i) => 2 + roztec * (i + 0.5));
    return { tvar: 'v', n, w0, wd: Math.min(q.vSirkaDole, w0), Hv, D, hd, ro, usti, xs, roztec, zt: o.zBot + Hv, W: o.W, e: D / 2, horni: Math.max(o.zTop, o.zBot + Hv) };
  }

  function odvozPolice(p, o) {
    const q = p.police, D = q.hloubka, zt = o.zadaTop, tp = Math.min(q.tl, zt - o.zBot - 1);
    const kv = q.delkaVzpery / 100, sk = q.sklon * RAD;
    // deska se natočí kolem horní hrany u zad (y0, zt)
    const rot = ([y, z]) => [o.y0 + (y - o.y0) * Math.cos(sk) - (z - zt) * Math.sin(sk), zt + (y - o.y0) * Math.sin(sk) + (z - zt) * Math.cos(sk)];
    const lemTop = rot([o.y0 + D, zt + q.lem]), predek = rot([o.y0 + D, zt]);
    const horni = Math.max(zt, lemTop[1], predek[1], rot([o.y0 + D - q.tlLemu, zt + q.lem])[1]);
    return { D, zt, tp, lem: q.lem, tl: Math.min(q.tlLemu, D / 2), vzpera: q.vzpera, ts: q.tlVzpery, kv, sk, rot, horni,
      hv: zt - tp / 2 - (o.zBot + q.tlVzpery / 2) + kv * D * Math.sin(sk), e: D / 2 * Math.cos(sk) };
  }

  /** Šířka popisku (bez písma odhad ~0,62 výšky na znak). */
  const sirkaPopisku = (t, h) => String(t).length * 0.62 * h + 0.6;

  function odvozStojan(p, o) {
    const q = p.stojan, tg = q.bocnice ? q.tlBocnice : 0, m = 2;
    if (q.druh === 'vrtaky') {
      // sada vrtáků: od nejmenšího, rozdělené do řad = schodů (vpředu nejnižší); popisky před otvory
      const prumery = seznam(q.vrtaky).filter(d => d >= 0.5 && d <= 40).sort((a, b) => a - b);
      const r = Math.max(1, Math.min(q.rady, prumery.length || 1)), hp = q.popisky ? q.vyskaPisma : 0;
      const rady = Array.from({ length: r }, (_, j) => prumery.slice(Math.round(j * prumery.length / r), Math.round((j + 1) * prumery.length / r)));
      // řady od přední hrany ke zdi: přední (nejnižší, nejmenší vrtáky) je nejdál od zdi, každá další je o schod výš a blíž zdi
      const hloubky = rady.map(ds => Math.max(...ds.map(d => d + q.vuleVrtaku), 3) + (hp ? hp + 2.5 : 0) + 2 * m);
      const D = hloubky.reduce((a, b) => a + b, 0);
      const otvory = [], radyInfo = [];
      let yPred = o.y0 + D, potrebaW = 0;
      rady.forEach((ds, j) => {
        const bunky = ds.map(d => Math.max(d + q.vuleVrtaku + 2.4, hp ? sirkaPopisku(fmt(d), hp) + 1.5 : 0));
        const sir = bunky.reduce((s2, c) => s2 + c, 0);
        potrebaW = Math.max(potrebaW, sir + 2 * (tg + m));
        const yZadni = yPred - hloubky[j], zt = o.zBot + q.tl + j * q.schod;
        // člověk před zdí má vlevo +x – od nejmenšího zleva doprava = od největšího x
        let x = (o.W + sir) / 2;
        ds.forEach((d, i) => {
          const dd = d + q.vuleVrtaku;
          // otvor vzadu v řadě, popisek před ním (u přední hrany schodu)
          otvory.push({ x: x - bunky[i] / 2, y: yZadni + m + dd / 2, rada: j, d: dd, jmeno: fmt(d), zt,
            py: yPred - m - hp / 2 - 0.5, h: Math.min(Math.max(1, zt - o.zBot - 1.5), q.hloubkaOtvoru > 0 ? q.hloubkaOtvoru : zt - o.zBot) });
          x -= bunky[i];
        });
        radyInfo.push({ y0: yZadni, y1: yPred, zt, sir });
        yPred = yZadni;
      });
      const ztMax = o.zBot + q.tl + (r - 1) * q.schod;
      const hg = q.bocnice ? Math.min(q.vyskaBocnice, Math.max(o.zadaTop, ztMax) - o.zBot) : 0;
      return { vrtaky: true, D, tp: q.tl, tg, hg, m, otvory, rady: radyInfo, prumery, potrebaW, hp, ztMax, sraz: Math.min(q.sraz, 1.5),
        dx: 0, dy: 0, yr: radyInfo.map(x => x.y0), krok: 0, e: D / 2, horni: Math.max(o.zTop, ztMax, o.zBot + hg) };
    }
    const D = q.hloubka, tp = Math.min(q.tl, o.zadaTop - o.zBot);
    const hg = q.bocnice ? Math.min(q.vyskaBocnice, o.zadaTop - o.zBot) : 0;
    let dx, dy;    // rozměr otvoru podél zdi a od zdi
    if (q.druh === 'kruh') dx = dy = q.prumer;
    else if (q.druh === 'sestihran') { dx = q.prumer / Math.cos(30 * RAD); dy = q.prumer; }   // vrcholy podél zdi
    else { dx = q.sirkaDrazky + 2 * q.nabeh; dy = Math.min(q.delkaDrazky, D - m); }
    const xl = tg + m + dx / 2, xr = o.W - tg - m - dx / 2;
    const rady = q.druh === 'drazka' ? 1 : q.rady;
    const krokAuto = q.pocet > 1 ? (xr - xl) / (q.pocet - 1) : 0;
    const krok = q.roztec > 0 ? q.roztec : krokAuto;
    const sir = krok * (q.pocet - 1), x0 = (o.W - sir) / 2;
    const radaX = Array.from({ length: q.pocet }, (_, i) => x0 + i * krok);
    const otvory = [];
    let yr = [];
    if (q.druh === 'drazka') yr = [o.y0 + D - dy / 2];
    else for (let j = 0; j < rady; j++) yr.push(o.y0 + D * (j + 0.5) / rady);
    yr.forEach((y, j) => {
      // lichá řada posunutá o půl kroku (šachovnice), o jeden otvor méně
      const xs = j % 2 && q.pocet > 1 ? radaX.slice(0, -1).map(x => x + krok / 2) : radaX;
      for (const x of xs) otvory.push({ x, y, rada: j });
    });
    const hloubka = q.hloubkaOtvoru > 0 && q.druh !== 'drazka' ? Math.min(q.hloubkaOtvoru, tp - 0.6) : tp;
    // drážka: hrdlo (užší vstup = zacvaknutí), náběh = rozšíření u přední hrany
    const hrdlo = q.druh === 'drazka' && q.hrdlo > 0 && q.hrdlo < q.sirkaDrazky ? q.hrdlo : 0;
    return { D, tp, tg, hg, dx, dy, m, xl, xr, krok, krokAuto, otvory, yr, hloubka, slepe: hloubka < tp - 0.01, sraz: Math.min(q.sraz, hloubka / 2),
      hrdlo, nabeh: q.druh === 'drazka' ? q.nabeh : 0, e: q.druh === 'drazka' ? D - dy / 2 : D / 2, horni: o.zTop };
  }

  function odvozKapsa(p, o) {
    const q = p.kapsa, s = q.stena, sd = q.dno, Hb = q.vyska, dnoTyp = q.dnoTyp;
    if (q.tvar === 'kulata') {
      const Ri = q.prumer / 2, Ro = Ri + s, n = q.pocet, mezera = 1.5;
      const Wpotreba = n * 2 * Ro + (n - 1) * mezera;
      const W = Math.max(o.W, Wpotreba);
      const xs = rozloz(n, Ro, W - Ro), yc = o.y0 + Ri + 0.8;
      return { tvar: 'kulata', s, sd, Hb, Ri, Ro, xs, yc, W, dnoTyp, lem: Math.min(q.lemDna, Ri - 1), rozsireno: W > o.W + 0.01, D: yc + Ro - o.y0, e: yc - o.y0,
        horni: Math.max(o.zTop, o.zBot + Hb) };
    }
    const D = q.hloubka, k = q.prepazky, wc = (o.W - 2 * s - k * s) / (k + 1);
    const prepazky = Array.from({ length: k }, (_, i) => s + (i + 1) * wc + i * s);   // levý kraj přepážky
    const bunky = Array.from({ length: k + 1 }, (_, i) => s + i * (wc + s) + wc / 2);
    const zCelo = o.zBot + Hb * q.celo / 100;   // výška přední stěny (šikmé čelo)
    const vyrez = Math.min(q.vyrez, zCelo - o.zBot - sd - 2), wv = Math.max(0, Math.min(wc * 0.6, 60));
    return { tvar: 'hranata', s, sd, Hb, D, wc, prepazky, bunky, vyrez, wv, W: o.W, dnoTyp, lem: Math.min(q.lemDna, wc / 2 - 1, (D - s) / 2 - 1), zCelo, sikme: q.celo < 99.9,
      e: D / 2, horni: Math.max(o.zTop, o.zBot + Hb) };
  }

  function odvozDeska(p, o) {
    const q = p.deska, d = otvor(q.spoj, q.vrut, q.sroub, o.b);
    // otvory jen pod spodkem zámku – výš je za deskou zámek a šroubovák zezadu by do něj narazil
    const zamekDole = o.zaves ? o.zOcas : o.zL(o.gw);   // spodek zámku (ocasu) – výš by šroubovák zezadu narazil
    const z0 = o.zBot + o.patka + q.okraj, z1 = zamekDole - q.okraj;   // patka o zeď je za deskou také
    const xs = rozloz(q.sloupcu, q.okraj, o.W - q.okraj), zs = z1 >= z0 ? rozloz(q.rad, z0, z1) : [];
    const otvory = [];
    for (const z of zs) for (const x of xs) otvory.push([x, z]);
    const mat = MATICE[q.sroub];
    const pilot = Math.round(0.8 * d.v.d * 10) / 10;
    // průvlaky: páry svislých štěrbin 3 mm, mezi nimi vzadu drážka 1,8 mm pro pásek
    const ws = q.sirkaPruvlaku, sirS = 3, a = Math.min(q.rozpetiPruvlaku, o.W - 2 * sirS - 4);
    const pz0 = o.zBot + o.patka + ws / 2 + 3, pz1 = zamekDole - ws / 2 - 3;
    const pruvlaky = q.pruvlaky && pz1 >= pz0 ? rozloz(q.pruvlaky, pz0, pz1).map(z => ({ z, x0: o.W / 2 - a / 2, x1: o.W / 2 + a / 2 })) : [];
    // kolejničky na aku baterie: svisle na líci, dole doraz; magnety: kapsy zezadu (magnet drží lišta za deskou)
    const kolejnice = q.kolejnice ? rozloz(q.kolejnice, o.W / (2 * q.kolejnice), o.W - o.W / (2 * q.kolejnice)) : [];
    const kolDelka = Math.min(q.kolDelka, o.zadaTop - o.zBot - q.kolDoraz);
    const rm = q.magPrumer / 2 + 0.15, hm = q.magVyska + 0.2;
    const mz = (Math.max(o.zBot + o.patka, 0) + zamekDole) / 2;   // kapsy proti líci lišty
    const magnety = q.magnety ? rozloz(q.magnety, Math.min(o.W / 2, rm + 3), Math.max(o.W / 2, o.W - rm - 3)).map(x => [x, mz]) : [];
    return { d, otvory, z0, z1, mat, pilot, pruvlaky, ws, sirS, a, drazka: 1.8, e: p.zatez.vylozeni, horni: o.zTop,
      kolejnice, kolDelka, kolZ0: o.zBot + q.kolDoraz, magnety, rm, hm, mz, zamekDole };
  }

  function odvozLista(p, o) {
    const q = p.lista, L = q.delka, d = otvor('vrut', q.vrut, 'M4', o.T);
    const hc = o.H - o.pokles;   // výška lišty u zdi
    // vruty nízko pod úkosem: nad hlavou musí zůstat aspoň 2 mm, otvor nesmí vyjít úkosem
    const zs = Math.max(d.rh + 2, Math.min(hc / 2, hc - d.ro - 3));
    const n = Math.max(1, Math.floor((L - 2 * q.okraj) / q.roztec + 1e-9) + 1);
    const xs = rozloz(n, (L - (n - 1) * q.roztec) / 2, (L + (n - 1) * q.roztec) / 2);
    // rybina: lichoběžník v pohledu zepředu (x, z), roste od kořene 15°
    const zc = hc / 2, a = Math.max(1.5, hc * 0.22), fl = Math.tan(15 * RAD);
    // hlava rybiny i s vůlí musí nechat nad i pod sebou aspoň 1,5 mm materiálu
    const dl = Math.max(0, Math.min(12, L / 6, (hc / 2 - 1.5 - q.vule - a) / fl));
    // zářezy pro zub držáku (proti posunu do strany) – stejný tvar jako zub, zvětšený o vůli
    const nz = q.zarezy > 0 ? Math.floor((L - 10) / q.zarezy) + 1 : 0;
    const zarezy = rozloz(nz, (L - (nz - 1) * q.zarezy) / 2, (L + (nz - 1) * q.zarezy) / 2);
    const druh = q.druh;
    let horni = o.H;
    if (druh === 'koncovka') horni = o.H + q.stena;
    if (druh === 'podlozka') horni = q.velPodlozky;
    return { druh, L, d, zs, xs, hc, rybina: q.spoj === 'rybina', dl, zc, a, fl, vule: q.vule, horni, zarezy,
      zarezBody: zubBody(o, p.zada.zubHloubka, 0.3), zarezW: p.zada.zubSirka + 0.6 };
  }

  function odvozZkouska(p, o) {
    const q = p.zkouska;
    if (q.druh === 'merka') {
      // měrka: deska s výřezem profilu lišty (+0,2), otevřená ke zdi
      return { druh: 'merka', vule: 0.2, okraj: q.okraj, tl: q.tl, horni: o.H + q.okraj, text: `${fmt(o.T)} × ${fmt(o.H)}  ${fmt(o.al)}°` };
    }
    const vule = seznam(q.vule).filter(v => v >= 0 && v <= 3).slice(0, 10);
    const w = q.sirka, mezera = 3;
    // každý vzorek = záda se zámkem (podle nastaveného zámku) s vlastní vůlí, bez funkční části
    const vzorky = vule.map((c, i) => {
      const pi = kopie(p);
      Object.assign(pi, { typ: 'deska' }); pi.system.vule = c; pi.zada.vyska = q.vyska; pi.zada.sirka = w; pi.zada.pojistka = false; pi.zada.zub = false;
      return { c, x0: i * (w + mezera), x1: i * (w + mezera) + w, o: zaklad(normalizuj(pi).p) };
    });
    return { druh: 'vule', vule, vzorky, w, mezera, W: Math.max(w, vzorky.length * (w + mezera) - mezera), horni: Math.max(o.zTop, ...vzorky.map(v => v.o.zTop)) };
  }

  /** Zub pod zámkem proti posunu do strany: hranol z úkosu do lišty (do lišty se uřízne zářez). Body v rovině (y, z). */
  function zubBody(o, d, vule = 0) {
    const sa = Math.sin(o.al * RAD), ca = Math.cos(o.al * RAD), B = y => [y, o.H - (o.T - y) * o.ta];
    const nIn = [sa, -ca], y1 = o.T * 0.3, y2 = o.T * 0.75, ven = o.c + 0.3 + vule;
    const P = (b, k) => [b[0] + nIn[0] * k, b[1] + nIn[1] * k];
    return [P(B(y1 - vule), -ven), P(B(y2 + vule), -ven), P(B(y2 + vule), d + vule), P(B(y1 - vule), d + vule)];
  }

  function odvozene(p) {
    const o = zaklad(p);
    o.typ = p.typ;
    const funkce = { hak: odvozHak, svorka: odvozSvorka, police: odvozPolice, stojan: odvozStojan, kapsa: odvozKapsa, deska: odvozDeska, lista: odvozLista, zkouska: odvozZkouska };
    o[p.typ] = funkce[p.typ](p, o);
    if (o[p.typ].W) o.W = o[p.typ].W;
    o.horni = Math.max(jeDrzak(p) ? o.zTop : 0, o[p.typ].horni);
    o.zub = jeDrzak(p) && p.zada.zub ? { x: o.W / 2, w: p.zada.zubSirka, d: p.zada.zubHloubka, body: zubBody(o, p.zada.zubHloubka) } : null;
    o.rohy = Math.max(0, Math.min(p.zada.rohy, o.W / 2 - 0.5, (o.zadaTop - o.zBot) / 2 - 0.5));
    // pojistný vrut: vodorovně přes záda do líce lišty
    const zp0 = Math.max(o.zBot, 0) + 6, zp1 = o.H - 8;
    o.pojistka = p.zada.pojistka && jeDrzak(p) && zp1 >= zp0 ? { x: Math.min(o.W / 2, o.W - 5), z: (zp0 + zp1) / 2, d: otvor('vrut', '3', 'M4', o.b) } : null;
    return o;
  }

  /** Kolik kusů (háků, svislých klipů) na dílu nese zátěž zatez.kg každý. */
  function kusu(p, o) {
    if (p.typ === 'hak') return p.hak.tvar === 'role' ? 1 : p.hak.pocet;
    if (p.typ === 'svorka' && p.svorka.tvar === 'klip') return o ? o.svorka.n : (p.svorka.osa === 'svisle' ? p.svorka.pocet : 1);
    return 1;
  }
  /* ---------- pevnost (orientační) ---------- */
  /** Odhad sil a napětí: zátěž F (N) v horizontální vzdálenosti e od líce zad.
     Zámek tlačí šikmo na úkos, dole záda opírá o líc lišty / zeď; dvojice sil R·a vyrovná moment F·(y0 + e).
     Průřezy: kořen ramene / desky, vzpěry, záda (ohyb dvojicí sil), kořen zámku nad lištou.
     smerNahoru = osa, která při tisku míří nahoru (napětí podél ní jde napříč vrstvami). */
  function pevnost(p, o, smerNahoru = 'x') {
    const mat = PEVNOST[p.tisk.material], F1 = p.zatez.kg * G;
    const n = kusu(p, o), F = F1 * n;
    const e = !jeDrzak(p) ? 0 : p.typ === 'deska' ? o.deska.e : o[p.typ].e;
    const a = Math.max(5, o.kontakt.z - o.dole);
    const R = F * (o.y0 + e - o.kontakt.y) / a;          // vodorovná síla dole (a stejná nahoře na zámku)
    const N = Math.hypot(F, R);
    const fakt = smer => (smer === smerNahoru ? NAPRIC_VRSTVAMI : 1);
    const prurezy = [];
    const pridej = (klic, nazev, M, Wz, smer, pozn, Nax = 0, A = 1) => {
      const sigma = M / Wz + Nax / A, mez = mat.mez * fakt(smer);
      const x = { klic, nazev, M, sigma, mez, k: sigma > 1e-9 ? mez / sigma : Infinity, smer, napric: fakt(smer) < 1, pozn };
      prurezy.push(x);
      return x;
    };
    /** vzpěra v tlaku + vzpěr (Euler, kloubově) */
    const vzpera = (C, Ls, b, ts, nazev) => {
      const x = pridej('vzpera', nazev, 0, 1, 'y', `tlak ${fmt(C, 0)} N, délka ${fmt(Ls, 0)} mm`, C, b * ts);
      x.vzper = { Pkr: Math.PI ** 2 * mat.E * b * ts ** 3 / 12 / (Ls * Ls), k: 0 };
      x.vzper.k = x.vzper.Pkr / Math.max(1e-9, C);
    };
    if (!jeDrzak(p) || F <= 0) return { F, F1, e, a, R, N, prurezy, nosnost: Infinity, kMin: Infinity, mat };
    if (p.typ === 'hak') {
      const h = o.hak, nazev = h.tvar === 'kolik' ? 'Kořen kolíku' : h.tvar === 'kolebka' ? 'Rameno kolébky' : 'Kořen háku';
      if (h.tvar === 'role') {
        // tyč: konzola z ramene, zátěž (role) uprostřed délky; rameno: ohyb z boku zad
        const d = 2 * h.rr;
        pridej('tyc', 'Kořen tyče', F1 * h.delkaTyce / 2, Math.PI * d ** 3 / 32, 'x', `Ø ${fmt(d)} mm, délka ${fmt(h.delkaTyce)} mm`);
        pridej('ramenoTyce', 'Rameno tyče', F1 * h.e, h.ta * Math.max(h.t0, d) ** 2 / 6, 'y', `${fmt(h.ta)} × ${fmt(Math.max(h.t0, d))} mm`);
      } else if (h.vzpera) {
        // příhradovina: rameno v tahu, vzpěra v tlaku; za uzlem rameno ohýbá zbytek páky
        const v = h.vzpera, T = F1 * h.e / v.hv, Ls = Math.hypot(v.P1[0] - v.P0[0], v.P1[1] - v.P0[1]);
        pridej('rameno', nazev + ' (tah + ohyb za vzpěrou)', F1 * Math.max(0, h.e - v.a), h.w * h.t0 * h.t0 / 6, 'y', `${fmt(h.w)} × ${fmt(h.t0)} mm, vzpěra ${fmt(v.a)} mm od zad`, T, h.w * h.t0);
        vzpera(T * Ls / Math.max(1, v.a), Ls, h.w, v.ts, 'Vzpěra háku (tlak)');
      } else pridej('rameno', nazev, F1 * h.e, h.w * h.t0 * h.t0 / 6, 'y', `${fmt(h.w)} × ${fmt(h.t0)} mm, páka ${fmt(h.e)} mm`);
    } else if (p.typ === 'svorka') {
      const q = o.svorka;
      if (q.tvar === 'klip') {
        const Wz = q.svisle ? q.wa * q.h * q.h / 6 : q.h * q.wa * q.wa / 6;
        pridej('rameno', 'Krček klipu', F1 * q.e, Wz, 'y', q.svisle ? `${fmt(q.wa)} × ${fmt(q.h)} mm` : `${fmt(q.h)} × ${fmt(q.wa)} mm`);
      } else pridej('rameno', 'Blok s drážkami', F * q.e, o.W * q.Hv * q.Hv / 6, 'y', `${fmt(o.W)} × ${fmt(q.Hv)} mm`);
    } else if (p.typ === 'police') {
      const q = o.police, M = F * q.e;
      if (q.vzpera === 'zadna') pridej('rameno', 'Kořen police', M, o.W * q.tp * q.tp / 6, 'y', `deska ${fmt(o.W)} × ${fmt(q.tp)} mm bez vzpěry`);
      else if (q.vzpera === 'plna') { const hh = Math.max(q.tp, q.hv); pridej('rameno', 'Kořen police (plná vzpěra)', M, o.W * hh * hh / 6, 'y', `trojúhelník výšky ${fmt(hh)} mm`); }
      else {
        const Tah = M / Math.max(5, q.hv);
        pridej('rameno', 'Deska police (tah)', 0, 1, 'y', `tah ${fmt(Tah, 0)} N přes ${fmt(o.W)} × ${fmt(q.tp)} mm`, Tah, o.W * q.tp);
        const Ls = Math.hypot(q.kv * q.D, q.hv);
        vzpera(Tah * Ls / Math.max(1, q.kv * q.D), Ls, o.W, q.ts, 'Vzpěra (tlak)');
      }
    } else if (p.typ === 'stojan' || p.typ === 'kapsa') {
      // deska + bočnice (stojan) / dno + boční stěny (kapsa) jako složený průřez u zad
      const st = o.stojan, ka = o.kapsa;
      const casti = st ? [[o.W - 2 * st.tg, st.tp, st.tp / 2]].concat(st.tg ? [[st.tg, st.hg, st.hg / 2], [st.tg, st.hg, st.hg / 2]] : [])
        : ka.tvar === 'kulata' ? [[ka.xs.length * 2 * ka.Ro, ka.sd, ka.sd / 2], ...ka.xs.flatMap(() => [[ka.s, ka.Hb, ka.Hb / 2], [ka.s, ka.Hb, ka.Hb / 2]])]
          : [[o.W - 2 * ka.s, ka.sd, ka.sd / 2], [ka.s, ka.Hb, ka.Hb / 2], [ka.s, ka.Hb, ka.Hb / 2]];
      const A = casti.reduce((s, [b, h]) => s + b * h, 0), zc = casti.reduce((s, [b, h, z]) => s + b * h * z, 0) / A;
      const I = casti.reduce((s, [b, h, z]) => s + b * h ** 3 / 12 + b * h * (z - zc) ** 2, 0);
      const cmax = Math.max(...casti.map(([, h, z]) => Math.max(Math.abs(z + h / 2 - zc), Math.abs(z - h / 2 - zc))));
      pridej('rameno', st ? 'Kořen desky s bočnicemi' : 'Dno a stěny u zad', F * (st ? st.e : ka.e), I / cmax, 'y', st ? `deska ${fmt(st.tp)} mm${st.tg ? `, bočnice ${fmt(st.hg)} mm` : ''}` : `stěny ${fmt(ka.Hb)} mm`);
    }
    // záda: ohyb dvojicí sil (moment zátěže vůči líci zad)
    pridej('zada', 'Záda', F * (e + o.b / 2), o.W * o.b * o.b / 6, 'z', `${fmt(o.W)} × ${fmt(o.b)} mm`);
    // zámek: krátká konzola nad lištou, síla N v polovině úkosu
    const zcZ = o.H + o.c + o.hl / 2, rameno = Math.hypot(o.yZ - o.kontakt.y, zcZ - o.kontakt.z);
    pridej('zamek', 'Zámek nad lištou', N * rameno, o.W * o.hl * o.hl / 6, 'y', `${fmt(o.W)} × ${fmt(o.hl)} mm${o.zaves ? ', závěs přes lištu' : o.kopieUkosu ? ', kopíruje úkos' : ''}`);
    let kMin = Math.min(...prurezy.map(x => x.k));
    for (const x of prurezy) if (x.vzper) kMin = Math.min(kMin, x.vzper.k);
    // nosnost: zátěž, při které nejslabší místo má bezpečnost BEZPECNOST (vše lineární v F)
    const nosnost = Number.isFinite(kMin) ? p.zatez.kg * kMin / BEZPECNOST : Infinity;
    return { F, F1, e, a, R, N, prurezy, kMin, nosnost, mat };
  }

  /* ---------- náhodný držák ---------- */
  /** Pseudonáhoda se semínkem (mulberry32) – stejné semínko = stejný držák. */
  function nahoda(seed) {
    let t = seed >>> 0;
    return () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  }
  const SADY_VRTAKU = ['1; 1,5; 2; 2,5; 3; 3,5; 4; 4,5; 5; 5,5; 6; 6,5; 7; 8; 9; 10', '2,5; 3,3; 4,2; 5; 6,8; 8,5; 10,2', '3; 4; 5; 6; 7; 8; 10', '1; 2; 3; 4; 5; 6; 8'];
  /** Náhodný, ale smysluplný držák, který projde kontrolami. Lišta (system) zůstane z p,
     typ zůstane, když je zadán. Zátěž se nastaví na ~60 % odhadnuté nosnosti. */
  function nahodny(p0, seed, typ) {
    const rnd = nahoda(seed), mezi = (a, b) => a + (b - a) * rnd(), cele = (a, b) => Math.floor(mezi(a, b + 1)), z = (a, b, k = 1) => Math.round(mezi(a, b) / k) * k;
    const vyber = (a, vahy) => { if (!vahy) return a[Math.floor(rnd() * a.length)]; let r = rnd() * vahy.reduce((s, v) => s + v, 0); for (let i = 0; i < a.length; i++) { r -= vahy[i]; if (r < 0) return a[i]; } return a[a.length - 1]; };
    const ano = pst => rnd() < pst;
    for (let pokus = 0; pokus < 80; pokus++) {
      const t = typ || vyber(['hak', 'svorka', 'police', 'stojan', 'kapsa', 'deska', 'lista'], [34, 16, 12, 15, 13, 5, 5]);
      const q = normalizuj({ typ: t, system: kopie(p0.system), tisk: kopie(p0.tisk) }).p;
      q.tisk.orientace = 'auto'; q.tisk.kusu = 1;
      Object.assign(q.zada, { tl: z(5, 8, 0.5), vyska: z(60, 105, 5), zamek: vyber(['plochy', 'kopie', 'zaves'], [5, 3, 2]), sraz: 0.6,
        zaobleni: ano(0.3) ? z(2, 5) : 0, rohy: ano(0.3) ? z(2, 6) : 0, ocas: z(18, 32, 2), opera: ano(0.1) ? 'zed' : 'lista', pojistka: ano(0.1),
        hrany: ano(0.3) ? 'oble' : 'zkosene', odlehceni: ano(0.2) ? vyber(['sestiuhelniky', 'kruhy']) : 'zadne', velOdlehceni: z(8, 14) });
      if (q.zada.hrany === 'oble') q.zada.sraz = z(1, 2, 0.5);
      q.zada.nad = q.zada.zamek === 'plochy' ? z(10, 14) : z(5, 8);
      if (q.zada.zamek === 'zaves') q.system.mezeraZa = Math.max(q.system.mezeraZa, 20);
      if (q.zada.opera === 'zed') q.zada.vyska = z(100, 140, 5);
      if (t === 'hak') {
        const tvar = vyber(['J', 'dvojity', 'kolik', 'kolebka', 'role'], [6, 2, 2, 1.5, 1]), tl = z(8, 14);
        Object.assign(q.hak, { tvar, dosah: z(45, 100, 5), vyska: z(25, 60, 5), polomer: vyber([5, 10, 15, 25, 40]), tl, tlSpicky: Math.max(6, tl - z(0, 4)),
          koule: ano(0.35) ? vyber([12, 14, 16]) : 0, zahnuti: ano(0.3) ? vyber([30, 45, 60]) : 0, uhel: z(10, 30, 5), prumerTyce: vyber([16, 20, 25, 32]),
          dosah2: z(25, 40, 5), vyska2: z(15, 25, 5), odstup2: z(45, 55, 5) });
        q.zada.sirka = tvar === 'role' ? z(120, 260, 10) : z(25, 60, 5);
        if (tvar === 'role') q.hak.dosah = z(55, 80, 5);
        if (tvar === 'dvojity') q.zada.vyska = Math.max(q.zada.vyska, 100);
        if (tvar !== 'role' && ano(0.35)) { Object.assign(q.hak, { vyskaRamene: z(30, 40, 5), vzpera: true, delkaVzpery: z(50, 70, 5), tlVzpery: z(6, 8) }); q.zada.vyska = Math.max(q.zada.vyska, 100); q.zada.sirka = z(40, 60, 5); }
        if ((tvar === 'J' || tvar === 'dvojity') && ano(0.35)) Object.assign(q.hak, { vDrazka: true, zahnuti: 0, koule: 0, vyska: Math.max(q.hak.vyska, 45), vPocet: q.zada.sirka > 50 && ano(0.4) ? 2 : 1,
          vSirka: z(7, 11), vSirkaDole: vyber([0.8, 0.8, 1.5, 3]), vHloubka: z(22, 32, 2), vZuby: vyber(Object.keys(ZUBY)), vOtvor: ano(0.6) ? z(4, 7) : 0 });
      } else if (t === 'svorka') {
        if (ano(0.6)) {
          const svisle = ano(0.65), prumer = vyber([16, 20, 22, 25, 28, 30, 32]);
          Object.assign(q.svorka, { tvar: 'klip', osa: svisle ? 'svisle' : 'vodorovne', prumer, stena: z(3, 4, 0.5), otevreni: z(80, 88), nabeh: ano(0.7) ? z(2, 4) : 0,
            odstup: svisle ? z(4, 10) : z(15, 30, 5), vyska: z(20, 35, 5), pocet: svisle ? cele(1, 3) : 1 });
          q.zada.sirka = svisle ? z(30, 60, 5) : z(18, 25);
          if (!svisle && q.tisk.material === 'PLA') q.svorka.otevreni = 88;
        } else {
          const n = cele(2, 5);
          Object.assign(q.svorka, { tvar: 'v', vPocet: n, vSirka: z(6, 10), vHloubka: z(25, 35, 5), vBlok: z(25, 40, 5), vVyska: z(35, 50, 5), vSirkaDole: vyber([0.8, 0.8, 1.5, 3]), zuby: vyber(Object.keys(ZUBY)), vOtvor: ano(0.5) ? z(4, 6) : 0 });
          q.zada.sirka = n * z(20, 28, 2);
        }
      } else if (t === 'police') {
        Object.assign(q.police, { hloubka: z(50, 130, 10), tl: z(4, 6), lem: vyber([0, 6, 10, 18]), vzpera: vyber(['prihradova', 'plna', 'zadna'], [5, 3, 1]), sklon: vyber([0, 0, 0, -15, 10]) });
        if (q.police.sklon < 0) q.police.lem = Math.max(q.police.lem, 10);
        if (q.police.vzpera === 'zadna') q.police.hloubka = Math.min(q.police.hloubka, 60);
        q.zada.sirka = z(80, 180, 10);
      } else if (t === 'stojan') {
        const druh = vyber(['kruh', 'sestihran', 'drazka', 'vrtaky'], [3, 1, 3, 3]);
        q.stojan.druh = druh;
        if (druh === 'vrtaky') Object.assign(q.stojan, { vrtaky: vyber(SADY_VRTAKU), rady: cele(1, 3), tl: 16, schod: z(6, 10), hloubkaOtvoru: 14, sraz: 0.6, bocnice: ano(0.3), popisky: ano(0.8) });
        else if (druh === 'drazka') {
          const kabel = ano(0.4);
          Object.assign(q.stojan, kabel ? { pocet: cele(5, 9), sirkaDrazky: z(5, 9), delkaDrazky: 18, hrdlo: 0, nabeh: 1.5, hloubka: 28, tl: 6, bocnice: false }
            : { pocet: cele(1, 6), sirkaDrazky: z(10, 36, 2), delkaDrazky: z(25, 45, 5), nabeh: z(0, 5), hloubka: 55, tl: 8, bocnice: ano(0.6) });
          if (kabel) q.stojan.hrdlo = Math.round(q.stojan.sirkaDrazky * 0.75 * 10) / 10;
        } else Object.assign(q.stojan, { pocet: cele(4, 9), prumer: druh === 'sestihran' ? 6.6 : z(6, 12), rady: cele(1, 2), hloubka: z(35, 55, 5), tl: z(8, 12),
          hloubkaOtvoru: druh === 'sestihran' ? 9 : 0, sraz: 0.8, bocnice: ano(0.5) });
        q.zada.sirka = z(100, 180, 10);
      } else if (t === 'kapsa') {
        if (ano(0.6)) Object.assign(q.kapsa, { tvar: 'hranata', hloubka: z(35, 70, 5), vyska: z(40, 70, 5), prepazky: cele(0, 3), celo: ano(0.35) ? z(40, 60, 5) : 100,
          vyrez: ano(0.3) ? z(12, 20) : 0, dnoTyp: vyber(['plne', 'plne', 'prstenec']), lemDna: z(4, 6), odtok: ano(0.3) });
        else { const n = cele(1, 3); Object.assign(q.kapsa, { tvar: 'kulata', pocet: n, prumer: vyber([30, 40, 50, 67]), vyska: z(35, 60, 5), dnoTyp: vyber(['plne', 'plne', 'prstenec']), lemDna: z(5, 8) }); }
        q.zada.sirka = z(70, 140, 10);
      } else if (t === 'deska') {
        const druh = vyber(['otvory', 'kolejnice', 'magnety']);
        q.zada.sirka = z(70, 120, 10); q.zada.vyska = z(90, 130, 10); q.zada.tl = 8; q.zada.pojistka = false;
        if (druh === 'otvory') Object.assign(q.deska, { otvory: vyber(Object.keys(OTVORY_DESKY)), sloupcu: cele(0, 2), rad: cele(1, 2), pruvlaky: ano(0.5) ? cele(1, 2) : 0, sirkaPruvlaku: vyber([13, 21, 26]), rozpetiPruvlaku: z(30, 60, 5) });
        else if (druh === 'kolejnice') { Object.assign(q.deska, { sloupcu: 0, rad: 0, kolejnice: cele(1, 2), kolTvar: vyber(['rybina', 'T']), kolSirka: z(16, 22), kolKrk: z(10, 14), kolVyska: z(4, 6), kolDelka: z(40, 70, 5), kolDoraz: 5 }); q.zada.sirka = z(110, 160, 10); q.zada.tl = 6; }
        else { Object.assign(q.deska, { sloupcu: 0, rad: 0, magnety: cele(3, 8), magPrumer: vyber([8, 10, 12]), magVyska: vyber([2, 3]), magKryti: 0.8 }); q.zada.sirka = z(140, 240, 10); q.zada.tl = 5; q.zada.vyska = z(55, 70, 5); }
      } else Object.assign(q.lista, { delka: z(120, 220, 20), roztec: z(60, 100, 10), spoj: ano(0.7) ? 'rybina' : 'rovny', vrut: vyber(['4', '4.5', '5']) });
      if (q.zada.hrany === 'oble' && !profilovy(q)) { q.zada.hrany = 'zkosene'; q.zada.sraz = 0.6; }   // oblé hrany jen u dílů na boku (nastojato malý převis u zámku)
      let { p } = normalizuj(q);
      const o = odvozene(p);
      if (kontroly(p, o).some(h => h.uroven === 'chyba')) continue;
      if (t !== 'lista') {
        // zátěž ~60 % odhadnuté nosnosti (na boku), zaokrouhlená
        p.zatez.kg = 1;
        const nos = pevnost(p, o, profilovy(p) ? 'x' : 'z').nosnost;   // podle orientace tisku (nastojato = záda napříč vrstvami)
        if (!Number.isFinite(nos) || nos < 0.3) continue;
        p.zatez.kg = Math.max(0.2, Math.floor(nos * 0.6 * (nos < 5 ? 10 : 1)) / (nos < 5 ? 10 : 1));
      }
      p.nazev = `Náhodný – ${TYPY[t].nazev.toLowerCase()} #${(seed >>> 0) % 10000}`;
      return normalizuj(p).p;
    }
    return null;
  }

  /* ---------- kontroly zadání ---------- */
  function kontroly(p, o) {
    const H = [];
    const pridej = (uroven, text, ...pole) => { const x = { uroven, text, pole }; H.push(x); return x; };
    const s = p.system, z = p.zada;
    if (o.H - o.pokles < 5) pridej('chyba', `Lišta ${fmt(o.T)} × ${fmt(o.H)} mm s úkosem ${fmt(o.al)}° nemá u zdi skoro žádnou výšku (${fmt(o.H - o.pokles)} mm) – zvyšte lištu nebo zmenšete úkos.`, 'system.vyska', 'system.uhel');
    if (s.mezera > o.T - 1 && !o.zaves) pridej('info', `Mezera od zdi omezena na ${fmt(o.gw)} mm.`, 'system.mezera');
    if (o.zaves && jeDrzak(p)) {
      const potreba = o.c + z.nad + Math.max(0.5, s.mezera);   // ocas + vůle + mezera od zdi za kontralatěmi
      if (s.mezeraZa < potreba) pridej('chyba', `Za lištou je mezera jen ${fmt(s.mezeraZa)} mm – ocas závěsu (${fmt(z.nad)} mm + vůle) se tam nevejde. Lišta musí být na kontralatích, nebo zvolte jiný zámek.`, 'system.mezeraZa', 'zada.zamek')
        .oprava = { pole: 'zada.zamek', hodnota: 'kopie', text: 'zámek po úkos (bez ocasu)' };
      if (o.zOcas < 2) pridej('chyba', `Ocas ${fmt(z.ocas)} mm sahá pod spodek lišty – držák by obepnul celou lištu a nešel nasadit. Nejvýš ${fmt(Math.floor(o.H - o.pokles - 2))} mm.`, 'zada.ocas')
        .oprava = { pole: 'zada.ocas', hodnota: Math.max(3, Math.floor((o.H - o.pokles) * 0.6)), text: 'zkrátit ocas' };
      if (z.ocas < 8) pridej('info', 'Krátký ocas závěsu drží jen málo – dejte aspoň 15–20 mm.', 'zada.ocas');
      if (z.opera === 'zed') pridej('info', `Patka sahá až ke zdi za kontralatěmi (${fmt(s.mezeraZa)} mm za lištou).`, 'zada.opera');
    }
    if (p.typ === 'zkouska') {
      const q = o.zkouska;
      if (q.druh === 'vule') {
        if (!q.vule.length) pridej('chyba', 'V seznamu vůlí není žádné číslo (0–3 mm).', 'zkouska.vule');
        if (p.zkouska.vyska < p.zada.nad + 15) pridej('varovani', 'Vzorek je nízký – zámek se na liště nemá o co opřít. Dejte výšku aspoň nad + 15 mm.', 'zkouska.vyska');
        pridej('info', 'Vzorky jsou samostatné kusy a tisknou se na boku vedle sebe – každý zkuste nasadit na lištu. Vyberte nejmenší vůli, která jde nasadit a sundat bez síly, a zadejte ji v boxu Lišta a zámek.', 'zkouska.vule');
      } else pridej('info', 'Měrku přiložte na konec lišty: tloušťka, výška i úkos mají sedět bez mezer. Když lišta nejde dovnitř nebo je v ní mezera, upravte rozměry lišty v boxu Lišta a zámek.', 'system.tl');
      return H;
    }
    if (p.typ === 'lista' && p.lista.druh !== 'dil') {
      if (p.lista.druh === 'podlozka' && p.lista.tlPodlozky < 3) pridej('varovani', 'Podložka tenčí než 3 mm se při utahování vrutu rozlomí.', 'lista.tlPodlozky');
      if (p.lista.druh === 'koncovka' && o.H - o.pokles < 8) pridej('varovani', 'Na tak nízkou lištu koncovka málo drží.', 'system.vyska');
      return H;
    }
    if (p.typ === 'lista') {
      const L = o.lista;
      if (L.zarezy.length) pridej('info', `Zářezy pro zub držáků po ${fmt(p.lista.zarezy)} mm – zub držáků nastavte na ${fmt(p.zada.zubSirka)} × ${fmt(p.zada.zubHloubka)} mm (u držáků: Zámek za lištou → Zub proti posunu).`, 'lista.zarezy');
      if (L.zs - L.d.ro < 1.5 || L.zs + L.d.ro > L.hc - 1.5) pridej('chyba', `Vrut ${fmt(L.d.v.d)} mm se do lišty nevejde pod úkos (u zdi je vysoká ${fmt(L.hc)} mm) – zvolte tenčí vrut nebo vyšší lištu.`, 'lista.vrut', 'system.vyska');
      if (L.d.hzPlna > o.T - 1.5) pridej('varovani', `Zápustná hlava vrutu ${fmt(L.d.v.d)} potřebuje ${fmt(L.d.hzPlna + 1.5)} mm, lišta má ${fmt(o.T)} mm.`, 'lista.vrut', 'system.tl');
      if (L.xs.length && (L.xs[0] - L.d.rh < (L.rybina ? L.dl + 2 : 2))) pridej('chyba', 'Krajní vrut je moc blízko konce lišty (rybina nebo okraj) – zvětšete okraj.', 'lista.okraj');
      if (L.xs.length > 1 && L.xs[1] - L.xs[0] < 2 * L.d.rh + 2) pridej('varovani', 'Vruty jsou blízko u sebe.', 'lista.roztec');
      if (s.druh === 'drevo') pridej('info', 'Systém je nastavený na dřevěnou lištu – tištěná lišta bude mít stejný profil. Pro tisk zvolte raději menší lištu (např. 12 × 40).', 'system.druh');
      if (L.L > 250) pridej('info', `Díl ${fmt(L.L)} mm se nemusí vejít na podložku – tiskněte ho úhlopříčně, nebo kratší díly spojte rybinou.`, 'lista.delka');
      if (L.rybina && L.dl < 4) pridej('chyba', `Lišta je u zdi vysoká jen ${fmt(L.hc)} mm – rybina se do ní nevejde.`, 'lista.spoj', 'system.vyska')
        .oprava = { pole: 'lista.spoj', hodnota: 'rovny', text: 'rovné konce' };
      else if (L.rybina && L.a * 2 < 6) pridej('varovani', 'Rybina je na tak nízké liště drobná – spoj nebude pevný.', 'lista.spoj');
      return H;
    }
    // záda a zámek
    if (o.zBot > o.H - 10) pridej('chyba', `Záda sahají jen ${fmt(o.H - o.zBot)} mm pod horní hranu lišty – držák se nemá o co opřít. Prodlužte záda aspoň na ${fmt(o.zTop - o.H + 15)} mm.`, 'zada.vyska')
      .oprava = { pole: 'zada.vyska', hodnota: Math.ceil(o.zTop - o.H + Math.min(o.H, 40)), text: 'prodloužit záda' };
    else if (o.kontakt.z - o.dole < 20) pridej('varovani', `Páka mezi zámkem a dolní opěrou je jen ${fmt(o.kontakt.z - o.dole)} mm – držák se bude pod zátěží kývat a tlačit hodně do lišty. Prodlužte záda.`, 'zada.vyska');
    if (z.opera === 'zed' && o.patka < 3) {
      const potreba = Math.ceil(o.zTop + o.c + z.patka);
      pridej('chyba', `Patka o zeď musí být pod spodní hranou lišty – záda musí být vysoká aspoň ${fmt(potreba)} mm.`, 'zada.vyska', 'zada.opera')
        .oprava = { pole: 'zada.vyska', hodnota: Math.min(400, potreba), text: 'prodloužit záda pod lištu' };
    }
    if (o.hl < 4) pridej('varovani', `Zámek nad lištou je tenký (${fmt(o.hl)} mm) – může se ulomit.`, 'zada.nad');
    if (o.b < 3) pridej('varovani', 'Záda tenčí než 3 mm se pod zátěží prohnou.', 'zada.tl');
    if (o.al < 40) pridej('info', `Úkos ${fmt(o.al)}° drží méně spolehlivě než 45° – zámek z lišty snáz sklouzne ven. Na stojato se zámek s úkosem pod 45° netiskne bez podpor.`, 'system.uhel');
    if (o.c < 0.2 && s.druh === 'drevo') pridej('info', 'Dřevěná lišta nebývá přesná – vůle pod 0,2 mm může být těsná.', 'system.vule');
    if (p.zada.pojistka && !o.pojistka) pridej('varovani', 'Pojistný vrut se do zad nevejde (záda nesahají dost hluboko pod horní hranu lišty).', 'zada.pojistka', 'zada.vyska');
    if (o.zBot < -10 && z.opera === 'lista') pridej('info', `Záda přesahují ${fmt(-o.zBot)} mm pod lištu – při hustě rozmístěných lištách narazí do lišty pod ní.`, 'zada.vyska');
    if (z.rohy > o.rohy + 0.01) pridej('info', `Zaoblení rohů zad omezeno na ${fmt(o.rohy)} mm.`, 'zada.rohy');
    if (o.zub) pridej('info', `Zub pod zámkem: do lišty uřízněte zářez ${fmt(z.zubSirka + 0.6)} mm široký a ${fmt(z.zubHloubka + 0.3)} mm hluboký kolmo do úkosu (pilka, pilník) – držák pak nesjede do strany. Tištěná lišta má volbu Zářezy.`, 'zada.zub');
    if (z.zub && z.zubHloubka > o.T * 0.4) pridej('varovani', 'Zub je hlubší než 40 % tloušťky lišty – zářez lištu oslabí.', 'zada.zubHloubka');
    if (z.odlehceni !== 'zadne' && (p.typ === 'kapsa' || (p.typ === 'svorka' && p.svorka.tvar === 'v'))) pridej('info', 'Odlehčení zad se u kapes a V-drážek nedělá (záda jsou zadní stěnou).', 'zada.odlehceni');
    if (z.hrany === 'oble' && z.sraz < 0.4) pridej('info', 'Zaoblené hrany potřebují poloměr (pole Zkosení / zaoblení) aspoň 0,5 mm.', 'zada.sraz');

    if (p.typ === 'hak') {
      const h = p.hak, k = o.hak;
      if (o.zBot + h.vyskaRamene + h.tl > o.zadaTop) pridej('chyba', `Rameno ve výšce ${fmt(h.vyskaRamene)} mm je nad horní hranou zad – snižte ho nebo prodlužte záda.`, 'hak.vyskaRamene', 'zada.vyska')
        .oprava = { pole: 'zada.vyska', hodnota: Math.ceil(h.vyskaRamene + h.tl + 10 + o.zTop - o.zadaTop), text: 'prodloužit záda' };
      if (h.vzpera && h.vyskaRamene < 8) pridej('info', 'Vzpěra potřebuje místo pod ramenem – nastavte výšku ramene nad spodkem zad (aspoň 15–20 mm).', 'hak.vyskaRamene', 'hak.vzpera')
        .oprava = { pole: 'hak.vyskaRamene', hodnota: Math.min(40, Math.max(20, z.vyska - h.tl - 20)), text: 'zvednout rameno' };
      if (h.tvar === 'J' || h.tvar === 'dvojity') {
        if (h.polomer > k.Rmax + 0.01) pridej('info', `Poloměr ohybu omezen na ${fmt(k.Rin)} mm (dosah ${fmt(h.dosah)} mm nestačí na větší).`, 'hak.polomer', 'hak.dosah');
        if (h.vyska < h.tl) pridej('info', 'Špička je nižší než tloušťka ramene – hák je jen rovná konzola.', 'hak.vyska');
        if (k.vnitrniSirka < 2) pridej('chyba', 'Do háku se nic nevejde – zvětšete dosah.', 'hak.dosah');
        if (h.zahnuti > 0 && !k.svisla) pridej('info', 'Zahnutí špičky se uplatní, jen když je špička výš než ohyb – zvyšte výšku špičky.', 'hak.zahnuti', 'hak.vyska');
        if (h.zahnuti > 0 && k.svisla && k.vnitrniSirka - k.Rz * (1 - Math.cos(k.fz)) < 6) pridej('varovani', 'Zahnutá špička skoro zavírá hák – zmenšete zahnutí nebo prodlužte dosah.', 'hak.zahnuti');
        if (h.tvar === 'dvojity') {
          const d2 = k.druhy;
          if (o.zBot + h.vyskaRamene + h.odstup2 + h.tl > o.zadaTop) pridej('chyba', 'Druhý hák je nad horní hranou zad – zmenšete odstup nebo prodlužte záda.', 'hak.odstup2', 'zada.vyska')
            .oprava = { pole: 'zada.vyska', hodnota: Math.ceil(h.vyskaRamene + h.odstup2 + h.tl + 8 + o.zTop - o.zadaTop), text: 'prodloužit záda' };
          if (h.odstup2 < k.vyskaSpicky + 3 && h.dosah2 > h.dosah - k.t1 - 3) pridej('chyba', 'Druhý hák narazí do špičky prvního – zkraťte ho nebo ho dejte výš.', 'hak.dosah2', 'hak.odstup2');
          if (d2.vnitrniSirka < 2) pridej('chyba', 'Do druhého háku se nic nevejde – zvětšete jeho dosah.', 'hak.dosah2');
        }
      } else if (h.tvar === 'role') {
        if (h.pocet > 1 || h.sirka > 0) pridej('info', 'Tyč na roli je vždy jedna přes celou šířku zad.', 'hak.pocet');
        if (k.delkaTyce < 20) pridej('chyba', 'Tyč je kratší než 20 mm – rozšiřte záda (tyč vede podél zad).', 'zada.sirka');
        if (h.dosah < 2 * k.rr + 8) pridej('chyba', 'Tyč je blíž zádům, než je její průměr – prodlužte dosah.', 'hak.dosah', 'hak.prumerTyce');
      } else if (h.tvar === 'kolik') {
        if (h.koule && h.koule < h.tlSpicky) pridej('info', 'Kulička je menší než konec kolíku – nebude znát.', 'hak.koule');
      } else {
        if (k.yc - k.rr - k.st < o.y0 - o.b + 0.5) pridej('chyba', 'Tyč se nevejde mezi záda a konec ramene – prodlužte dosah.', 'hak.dosah', 'hak.prumerTyce');
        if (k.roh < 1) pridej('info', 'Bez rohů nad středem tyče tyč z kolébky snadno vypadne.', 'hak.roh');
      }
      if (h.vDrazka) {
        if (h.tvar !== 'J' && h.tvar !== 'dvojity') pridej('info', 'V-drážka se dělá jen ve špičce háku J (a dvojitého háku).', 'hak.vDrazka');
        else if (!k.svisla) pridej('chyba', 'V-drážka potřebuje svislou špičku – zvyšte výšku špičky nad ohyb.', 'hak.vyska', 'hak.vDrazka');
        else {
          const v = k.vDrazka;
          if (h.vHloubka > v.hd + 0.01) pridej('info', `Hloubka V-drážky omezena na ${fmt(v.hd)} mm (dno${v.ro ? ' i s otvorem' : ''} musí zůstat ve svislé špičce nad ohybem).`, 'hak.vHloubka', 'hak.vOtvor');
          if (h.vSirkaDole > h.vSirka) pridej('info', 'Šířka dole je větší než nahoře – použita šířka nahoře (rovnoběžné stěny).', 'hak.vSirkaDole');
          if (v.ro && 2 * v.ro <= v.wd + 0.01) pridej('info', 'Otvor na konci je užší než dno drážky – nic nepřidá. Zvětšete ho nebo zužte dno.', 'hak.vOtvor', 'hak.vSirkaDole');
          if (v.ro && 2 * v.ro > v.roztec - 3) pridej('chyba', 'Otvory na konci V-drážek se do šířky háku nevejdou.', 'hak.vOtvor', 'hak.vPocet');
          if (v.w0 + 2 * v.usti + 3 > v.roztec) pridej('chyba', `${h.vPocet} V-drážky po ${fmt(v.w0)} mm se do šířky háku nevejdou.`, 'hak.vPocet', 'hak.vSirka', 'zada.sirka');
          if (v.hd < 2 * v.w0) pridej('info', 'Mělká široká V-drážka ručník moc nesevře – dejte hloubku aspoň 3× šířku.', 'hak.vHloubka', 'hak.vSirka');
        }
      }
      const n = h.pocet;
      if (n * k.w > o.W + 0.01) pridej('chyba', `${n} háky po ${fmt(k.w)} mm se na záda ${fmt(o.W)} mm nevejdou.`, 'hak.pocet', 'hak.sirka', 'zada.sirka');
      else if (n > 1 && (o.W - n * k.w) / (n - 1) < 3) pridej('varovani', 'Háky jsou skoro u sebe – rozšiřte záda nebo zužte háky.', 'hak.sirka', 'zada.sirka');
      if (!k.celou) pridej('info', `${n > 1 ? 'Víc háků' : 'Hák užší než záda'} na jednom díle se na boku bez podpor nevytiskne (rameno by viselo ve vzduchu). Bez podpor: jeden hák přes celou šířku zad a víc kusů.`, 'hak.pocet', 'hak.sirka')
        .oprava = { pole: 'hak.sirka', hodnota: 0, text: 'hák přes celou šířku' };
    } else if (p.typ === 'svorka') {
      const q = o.svorka, P = p.svorka;
      if (q.tvar === 'klip') {
        if (P.otevreni < 60) pridej('chyba', `Otvor ${fmt(q.otv)} mm je na tyč Ø ${fmt(P.prumer)} moc úzký – kroužek praskne dřív, než tyč projde. Dejte 70–90 %.`, 'svorka.otevreni');
        else if (P.otevreni > 96) pridej('varovani', 'Otvor je skoro jako tyč – klip ji nebude držet. Dejte 75–90 %.', 'svorka.otevreni');
        const mez = PEVNOST[p.tisk.material].eps;
        if (q.eps > mez) pridej('varovani', `Při nacvaknutí se kroužek protáhne o ${fmt(q.eps * 100, 1)} % (${p.tisk.material} snese asi ${fmt(mez * 100, 1)} %) – může prasknout. Zvětšete otvor, ztenčete stěnu nebo tiskněte z PETG / PA.`, 'svorka.otevreni', 'svorka.stena', 'tisk.material');
        if (P.vule > 0.5) pridej('info', 'S vůlí nad 0,5 mm tyč v klipu volně visí – klip ji udrží jen otvorem.', 'svorka.vule');
        if (q.rozsireno) pridej('info', `Klipy potřebují šířku ${fmt(q.W)} mm – záda jsou rozšířená.`, 'zada.sirka', 'svorka.pocet');
        if (q.svisle && P.vyska > z.vyska + 1) pridej('info', 'Klip je vyšší než záda – vyčnívá nahoru.', 'svorka.vyska');
        if (!q.svisle && 2 * q.Ro > z.vyska) pridej('info', 'Kroužek je vyšší než záda – vyčnívá nahoru.', 'svorka.prumer', 'zada.vyska');
      } else {
        if (P.vHloubka > q.hd + 0.01) pridej('info', `Hloubka drážky omezena na ${fmt(q.hd)} mm (blok je vysoký ${fmt(q.Hv)} mm).`, 'svorka.vHloubka');
        if (P.vSirkaDole > P.vSirka) pridej('info', 'Šířka dole je větší než nahoře – použita šířka nahoře (rovnoběžné stěny).', 'svorka.vSirkaDole');
        if (q.ro && 2 * q.ro <= q.wd + 0.01) pridej('info', 'Otvor na konci je užší než dno drážky – nic nepřidá. Zvětšete ho nebo zužte dno.', 'svorka.vOtvor', 'svorka.vSirkaDole');
        if (q.ro && 2 * q.ro > q.roztec - 3) pridej('chyba', 'Otvory na konci V-drážek se do šířky nevejdou.', 'svorka.vOtvor', 'svorka.vPocet');
        if (q.w0 + 2 * q.usti + 3 > q.roztec) pridej('chyba', `${q.n} drážky po ${fmt(q.w0)} mm se do šířky ${fmt(o.W)} mm nevejdou.`, 'svorka.vPocet', 'svorka.vSirka', 'zada.sirka');
        if (q.hd / q.w0 < 2) pridej('info', 'Mělká široká drážka hadr moc nesevře – dejte hloubku aspoň 3× šířku.', 'svorka.vHloubka', 'svorka.vSirka');
      }
    } else if (p.typ === 'police') {
      const q = o.police;
      if (q.vzpera !== 'zadna' && q.hv < 15) pridej('varovani', 'Vzpěra je skoro vodorovná (záda jsou nízká) – nic nenese. Prodlužte záda.', 'zada.vyska', 'police.vzpera');
      if (q.D > 60 && q.vzpera === 'zadna') pridej('info', 'Hluboká police bez vzpěry se pod zátěží prohne – přidejte vzpěru.', 'police.vzpera');
      if (p.police.sklon < 0 && q.lem < 3) pridej('info', 'Police skloněná dopředu dolů potřebuje lem, jinak z ní věci sklouznou.', 'police.lem', 'police.sklon');
    } else if (p.typ === 'stojan') {
      const q = o.stojan, P = p.stojan;
      if (q.vrtaky) {
        if (!q.prumery.length) pridej('chyba', 'V seznamu vrtáků není žádný průměr (0,5–40 mm).', 'stojan.vrtaky');
        if (q.potrebaW > o.W + 0.01) pridej('chyba', `Vrtáky se do šířky ${fmt(o.W)} mm nevejdou – potřeba ${fmt(Math.ceil(q.potrebaW))} mm. Rozšiřte záda nebo přidejte schod.`, 'zada.sirka', 'stojan.rady')
          .oprava = { pole: 'zada.sirka', hodnota: Math.min(400, Math.ceil(q.potrebaW)), text: 'rozšířit záda' };
        if (q.otvory.some(t => t.h < t.d * 1.2)) pridej('info', 'V přední řadě jsou otvory mělké (deska je tenká) – vrtáky budou viklat. Zvyšte tloušťku desky.', 'stojan.tl', 'stojan.hloubkaOtvoru');
        if (q.ztMax > o.zTop + 20) pridej('info', 'Zadní schod je vysoko nad zády – zvažte méně řad nebo nižší schod.', 'stojan.schod');
      } else {
        const prekryv = P.pocet > 1 && q.krok - q.dx < q.m - 0.01;
        if (P.pocet * q.dx + (P.pocet - 1) * q.m > o.W - 2 * q.tg - 2 * q.m + 0.01 || prekryv)
          pridej('chyba', `${P.pocet} otvorů po ${fmt(q.dx)} mm se do šířky ${fmt(o.W)} mm nevejde – rozšiřte záda, zmenšete počet nebo rozteč.`, 'stojan.pocet', 'zada.sirka', 'stojan.roztec');
        else if (P.roztec > 0 && (q.otvory.some(t => t.x - q.dx / 2 < q.tg + 1 || t.x + q.dx / 2 > o.W - q.tg - 1)))
          pridej('chyba', 'Otvory s touto roztečí vycházejí mimo desku nebo do bočnic.', 'stojan.roztec');
        if (P.druh !== 'drazka') {
          const r = q.dy / 2, prvni = q.yr[0] - r - o.y0, posl = o.y0 + q.D - (q.yr[q.yr.length - 1] + r);
          if (prvni < 1.5 || posl < 1.5) pridej('chyba', `Otvory se do hloubky desky nevejdou (${fmt(q.D)} mm na ${q.yr.length} ${q.yr.length > 1 ? 'řady' : 'řadu'} po ${fmt(q.dy)} mm).`, 'stojan.hloubka', 'stojan.prumer', 'stojan.rady');
          else if (q.yr.length > 1 && q.yr[1] - q.yr[0] < q.dy + 1) pridej('chyba', 'Řady otvorů se překrývají – prohlubte desku.', 'stojan.hloubka', 'stojan.rady');
        } else {
          if (P.delkaDrazky > q.D - q.m) pridej('info', `Drážka zkrácena na ${fmt(q.dy)} mm, aby nepřeřízla desku.`, 'stojan.delkaDrazky');
          if (P.hrdlo > 0 && !q.hrdlo) pridej('info', 'Hrdlo širší než drážka nic nezužuje.', 'stojan.hrdlo');
          if (q.hrdlo && q.dy < P.sirkaDrazky / 2 + 2.5 + q.nabeh + 1) pridej('info', 'Drážka je krátká – za hrdlem zbude jen málo místa. Prodlužte drážku.', 'stojan.delkaDrazky');
          if (q.hrdlo && q.hrdlo < 0.6 * P.sirkaDrazky) pridej('varovani', 'Hrdlo užší než 60 % drážky – kabel nebo násada půjde zacvaknout jen silou.', 'stojan.hrdlo');
        }
        if (q.slepe && P.hloubkaOtvoru > q.tp - 0.6) pridej('info', `Slepé otvory omezeny na ${fmt(q.hloubka)} mm (deska ${fmt(q.tp)} mm).`, 'stojan.hloubkaOtvoru');
        if (P.tl > o.zadaTop - o.zBot) pridej('chyba', 'Deska je vyšší než záda.', 'stojan.tl', 'zada.vyska');
      }
    } else if (p.typ === 'kapsa') {
      const q = o.kapsa;
      if (q.tvar === 'hranata') {
        if (q.wc < 5) pridej('chyba', 'Přihrádky jsou užší než 5 mm – ubírejte přepážky nebo rozšiřte záda.', 'kapsa.prepazky', 'zada.sirka');
        if (q.D - q.s < 5) pridej('chyba', 'Kapsa je mělká – zvětšete hloubku.', 'kapsa.hloubka');
        if (q.zCelo - o.zBot - q.sd < 5) pridej('chyba', 'Kapsa (přední stěna) je nízká – zvětšete výšku nebo čelo.', 'kapsa.vyska', 'kapsa.celo');
        if (p.kapsa.vyrez > 0 && q.vyrez < p.kapsa.vyrez - 0.01) pridej('info', `Výřez omezen na ${fmt(Math.max(0, q.vyrez))} mm, aby nesahal do dna.`, 'kapsa.vyrez');
        if (q.dnoTyp === 'prstenec' && q.lem < 1.5) pridej('chyba', 'Lem dna je moc úzký – přihrádky jsou malé.', 'kapsa.lemDna');
      } else {
        if (q.rozsireno) pridej('info', `Kelímky potřebují šířku ${fmt(q.W)} mm – záda jsou rozšířená.`, 'zada.sirka', 'kapsa.pocet');
        if (q.dnoTyp === 'prstenec' && p.kapsa.lemDna >= q.Ri - 1) pridej('chyba', 'Lem dna je širší než poloměr kelímku – otvor ve dně by zmizel.', 'kapsa.lemDna');
      }
      if (q.dnoTyp === 'prstenec') pridej('info', 'Prstenec: věc (lahev, sprej, nářadí) se prostrčí dnem a opře o lem.', 'kapsa.dnoTyp');
    } else if (p.typ === 'deska') {
      const q = o.deska, P = p.deska;
      if (P.sloupcu * P.rad > 0 && !q.otvory.length) pridej('chyba', `Otvory se mezi spodek zad a spodek zámku nevejdou (okraj ${fmt(P.okraj)} mm) – prodlužte záda nebo zmenšete okraj.`, 'deska.okraj', 'zada.vyska');
      if (P.otvory === 'zezadu' && q.d.hzPlna > o.b - 1 && q.otvory.length) pridej('varovani', `Zápustná hlava potřebuje ${fmt(q.d.hzPlna + 1)} mm, záda mají ${fmt(o.b)} mm – zesilte záda.`, 'zada.tl');
      if (P.otvory === 'matice' && q.mat.m + 1.5 > o.b && q.otvory.length) pridej('chyba', `Matice ${P.sroub} (${fmt(q.mat.m)} mm) se do zad ${fmt(o.b)} mm nevejde – zesilte záda.`, 'zada.tl', 'deska.sroub');
      if (P.otvory === 'zepredu' && o.b < 2 * q.d.v.d && q.otvory.length) pridej('info', `Vrut ${fmt(q.d.v.d)} mm má v plastu málo závitu – záda by měla mít aspoň ${fmt(2 * q.d.v.d)} mm.`, 'zada.tl');
      const xs = [...new Set(q.otvory.map(t => t[0]))], zs = [...new Set(q.otvory.map(t => t[1]))];
      const r = P.otvory === 'matice' ? q.mat.s / 2 / Math.cos(30 * RAD) + 0.3 : q.d.rh;
      if ((xs.length > 1 && xs[1] - xs[0] < 2 * r + 2) || (zs.length > 1 && zs[1] - zs[0] < 2 * r + 2)) pridej('varovani', 'Otvory jsou blízko u sebe.', 'deska.sloupcu', 'deska.rad');
      if (P.pruvlaky && !q.pruvlaky.length) pridej('chyba', `Průvlaky ${fmt(q.ws)} mm se mezi spodek zad a zámek nevejdou – prodlužte záda.`, 'deska.pruvlaky', 'zada.vyska');
      if (q.pruvlaky.length > 1 && q.pruvlaky[1].z - q.pruvlaky[0].z < q.ws + 3) pridej('chyba', 'Průvlaky se překrývají – ubírejte je nebo prodlužte záda.', 'deska.pruvlaky');
      if (q.pruvlaky.length && q.otvory.some(([x, zz]) => q.pruvlaky.some(t => Math.abs(zz - t.z) < q.ws / 2 + r && (Math.abs(x - t.x0) < r + 3 || Math.abs(x - t.x1) < r + 3 || (x > t.x0 && x < t.x1)))))
        pridej('chyba', 'Otvory zasahují do průvlaků nebo drážky pásku – ubírejte otvory nebo průvlaky, případně změňte okraj.', 'deska.okraj', 'deska.pruvlaky');
      if (q.pruvlaky.length && o.b < 4) pridej('varovani', 'Drážka pro pásek vzadu potřebuje záda aspoň 4 mm.', 'zada.tl');
      if (P.kolejnice) {
        if (P.kolejnice * (P.kolSirka + 6) > o.W) pridej('chyba', `${P.kolejnice} kolejničky po ${fmt(P.kolSirka)} mm se do šířky ${fmt(o.W)} mm nevejdou.`, 'deska.kolejnice', 'zada.sirka');
        if (P.kolTvar === 'rybina' && P.kolKrk >= P.kolSirka) pridej('chyba', 'Rybina musí být nahoře širší než u desky (krček menší než šířka).', 'deska.kolKrk', 'deska.kolSirka');
        if (q.kolDelka < 20) pridej('chyba', 'Kolejnička je kratší než 20 mm – prodlužte záda.', 'zada.vyska', 'deska.kolDelka');
        else if (P.kolDelka > q.kolDelka + 0.01) pridej('info', `Kolejnička zkrácena na ${fmt(q.kolDelka)} mm (výška zad).`, 'deska.kolDelka');
        if (q.otvory.length || q.pruvlaky.length || q.magnety.length) pridej('info', 'Kolejničky jsou na líci desky – zkontrolujte, že otvory ani průvlaky nejsou pod nimi.', 'deska.kolejnice');
        pridej('info', 'Rozměry kolejničky přeměřte na své baterii nebo nářadí a vytiskněte nejdřív krátký kousek – výrobci se liší.', 'deska.kolSirka');
      }
      if (P.magnety) {
        if (q.hm + P.magKryti > o.b + 0.01) pridej('chyba', `Magnet ${fmt(P.magVyska)} mm s přední stěnou ${fmt(P.magKryti)} mm se do zad ${fmt(o.b)} mm nevejde – zesilte záda.`, 'zada.tl', 'deska.magVyska');
        if (q.magnety.length > 1 && q.magnety[1][0] - q.magnety[0][0] < 2 * q.rm + 2) pridej('chyba', 'Magnety se do šířky nevejdou.', 'deska.magnety', 'zada.sirka');
        if (q.mz - q.rm < Math.max(o.zBot, 0) + 1 || q.mz + q.rm > q.zamekDole - 1) pridej('chyba', 'Kapsy na magnety se mezi spodek zad a zámek nevejdou – prodlužte záda.', 'zada.vyska');
        if (q.otvory.some(([x, zz]) => q.magnety.some(([mx, mz2]) => Math.hypot(x - mx, zz - mz2) < q.rm + q.d.rh + 1))) pridej('chyba', 'Otvory zasahují do kapes na magnety.', 'deska.okraj', 'deska.magnety');
        pridej('info', 'Magnety vložte do kapes zezadu (stačí kapka lepidla) – po zavěšení je drží lišta. Přední stěna 0,6–1 mm = silná přídržná síla.', 'deska.magnety');
      }
      if (o.pojistka) {
        const pj = o.pojistka, rp = pj.d.rh + 1;
        const vOtvoru = q.otvory.some(([x, zz]) => Math.hypot(x - pj.x, zz - pj.z) < rp + r);
        const vPruvlaku = q.pruvlaky.some(t => Math.abs(pj.z - t.z) < q.ws / 2 + rp && pj.x > t.x0 - q.sirS - rp && pj.x < t.x1 + q.sirS + rp);
        if (vOtvoru || vPruvlaku) pridej('chyba', `Pojistný vrut (uprostřed, ${fmt(pj.z)} mm nad spodkem lišty) se kříží s ${vOtvoru ? 'otvorem desky' : 'průvlakem pásku'}.`, 'zada.pojistka', 'deska.okraj')
          .oprava = { pole: 'zada.pojistka', hodnota: false, text: 'bez pojistky' };
      }
    }
    if (o.W > 250) pridej('info', `Šířka ${fmt(o.W)} mm je delší než běžná podložka – na boku se tiskne do výšky.`, 'zada.sirka');
    return H;
  }

  /** Hlášení z pevnosti (po výběru orientace tisku). */
  function kontrolyPevnosti(p, pv) {
    const H = [];
    if (!pv.prurezy.length || !(pv.F > 0)) return H;
    const slabe = pv.prurezy.reduce((a, b) => (b.k < a.k ? b : a));
    const kus = kusu(p) > 1 ? ' na každý kus' : '';
    const pole = { rameno: ['hak.tl', 'svorka.stena', 'police.tl', 'stojan.tl', 'kapsa.stena'], vzpera: ['hak.tlVzpery', 'police.tlVzpery'], zada: ['zada.tl'], zamek: ['zada.nad'],
      tyc: ['hak.prumerTyce'], ramenoTyce: ['hak.tl'] }[slabe.klic] || [];
    const pol = pole.filter(c => c.startsWith(p.typ) || c.startsWith('zada')).concat(['zatez.kg']);
    for (const x of pv.prurezy) if (x.vzper && x.vzper.k < BEZPECNOST)
      H.push({ uroven: x.vzper.k < 1.5 ? 'chyba' : 'varovani', text: `Vzpěra se může vybočit (kritická síla ${fmt(x.vzper.Pkr, 0)} N, bezpečnost ${fmt(x.vzper.k, 1)}) – zesilte ji.`, pole: [p.typ === 'hak' ? 'hak.tlVzpery' : 'police.tlVzpery'], akce: 'zesil' });
    if (slabe.k < 1.5) H.push({ uroven: 'chyba', text: `${slabe.nazev}: napětí ${fmt(slabe.sigma, 1)} MPa při mezi ${fmt(slabe.mez, 0)} MPa – na ${fmt(p.zatez.kg, 1)} kg${kus} nestačí (doporučeno do ${fmt(pv.nosnost, 1)} kg).`, pole: pol, akce: 'zesil' });
    else if (slabe.k < BEZPECNOST) H.push({ uroven: 'varovani', text: `${slabe.nazev}: bezpečnost jen ${fmt(slabe.k, 1)}× – krátkodobě vydrží, pod trvalou zátěží se plast pomalu prohýbá. Doporučeno do ${fmt(pv.nosnost, 1)} kg${kus}.`, pole: pol, akce: 'zesil' });
    else H.push({ uroven: 'ok', text: `Pevnost: nejslabší místo „${slabe.nazev.toLowerCase()}“ má bezpečnost ${fmt(slabe.k, 1)}× – ${fmt(p.zatez.kg, 1)} kg${kus} unese s rezervou (odhad do ${fmt(pv.nosnost, 1)} kg).`, pole: ['zatez.kg'] });
    if (pv.prurezy.some(x => x.napric && x.k < 2 * BEZPECNOST)) H.push({ uroven: 'info', text: 'V této orientaci tisku jde napětí v některém místě napříč vrstvami (poloviční pevnost) – na boku je díl pevnější.', pole: ['tisk.orientace'] });
    return H;
  }

  /* ---------- kusovník ---------- */
  function kusovnik(p, o) {
    const out = [], n = p.tisk.kusu;
    if (p.typ === 'zkouska') return out;
    if (p.typ === 'lista' && p.lista.druh === 'podlozka') {
      const d = otvor('vrut', p.lista.vrut, 'M4', p.lista.tlPodlozky);
      out.push({ ks: n, co: `Vrut ${fmt(d.v.d)} o ${fmt(p.lista.tlPodlozky)} mm delší než pro lištu`, pozn: 'vrut lišty projde podložkou do zdi' });
      return out;
    }
    if (p.typ === 'lista' && p.lista.druh === 'koncovka') return out;
    if (p.typ === 'lista') {
      const L = o.lista, v = L.d.v, ks = L.xs.length * n;
      const delka = DELKY_VRUTU.find(x => x >= o.T + 30) || DELKY_VRUTU[DELKY_VRUTU.length - 1];
      out.push({ ks, co: `Vrut ${fmt(v.d)} × ${delka} se zápustnou hlavou`, pozn: `lišta ${fmt(o.T)} mm + aspoň 30 mm v hmoždince; do dřevěné stěny stačí ${fmt(o.T + 25)} mm` });
      out.push({ ks, co: `Hmoždinka Ø ${v.hmozdinka} × ${v.hmozdinka >= 8 ? 40 : 30} mm`, pozn: 'do zdiva (do sádrokartonu kotva na sádrokarton)' });
      out.push({ ks: null, co: `Vrták Ø ${v.hmozdinka} mm do zdi`, pozn: `rozteč vrutů ${fmt(p.lista.roztec)} mm – vrtejte přes díl jako přes šablonu` });
      if (L.rybina && n > 1) out.push({ ks: null, co: 'Díly spojte rybinou shora dolů', pozn: 'zámek drží díly v řadě; lepidlo není nutné' });
      return out;
    }
    if (o.pojistka) out.push({ ks: n, co: `Vrut 3 × ${DELKY_VRUTU.find(x => x >= o.b + 10) || 40} (pojistka)`, pozn: 'zezadu do líce lišty – držák pak nejde nechtěně nadzvednout; předvrtat Ø 2 mm' });
    if (p.typ === 'deska') {
      const q = o.deska, P = p.deska, ks = q.otvory.length * n;
      if (ks) {
        if (P.otvory === 'zezadu') out.push({ ks, co: `${P.spoj === 'sroub' ? `Šroub ${P.sroub} se zápustnou hlavou (ISO 10642)` : `Vrut ${fmt(q.d.v.d)} se zápustnou hlavou`}`, pozn: `zezadu přes desku ${fmt(o.b)} mm do věci před ní${P.spoj === 'sroub' ? ' + matice' : ''}` });
        else if (P.otvory === 'matice') {
          out.push({ ks, co: `Šroub ${P.sroub} (délka = tloušťka věci + ${fmt(o.b)} mm)`, pozn: 'zepředu přes věc do matice v zádech' });
          out.push({ ks, co: `Matice ${P.sroub} (otvor klíče ${fmt(q.mat.s)} mm)`, pozn: 'vtlačit do šestihranné kapsy vzadu, případně zakápnout lepidlem' });
        } else out.push({ ks, co: `Vrut ${fmt(q.d.v.d)} do plastu (samořezný)`, pozn: `předvrtáno Ø ${fmt(q.pilot)} mm do hloubky ${fmt(o.b - 1)} mm` });
      }
      if (q.pruvlaky.length) out.push({ ks: q.pruvlaky.length * n, co: `Pásek se suchým zipem nebo stahovací pásek do ${fmt(q.ws - 1)} mm`, pozn: `průvlaky ${fmt(q.ws)} × 3 mm po ${fmt(q.a)} mm, za deskou drážka ${fmt(q.drazka)} mm` });
    }
    if (p.typ === 'deska' && o.deska.magnety.length) out.push({ ks: o.deska.magnety.length * n, co: `Neodymový magnet Ø ${fmt(p.deska.magPrumer)} × ${fmt(p.deska.magVyska)} mm`, pozn: 'do kapes zezadu, kapka vteřinového lepidla' });
    if (o.zub) out.push({ ks: null, co: `Zářez v liště ${fmt(p.zada.zubSirka + 0.6)} × ${fmt(p.zada.zubHloubka + 0.3)} mm`, pozn: 'kolmo do úkosu v místě držáku – pilka na železo nebo pilník' });
    if (p.typ === 'hak' && p.hak.tvar === 'kolebka') out.push({ ks: Math.max(1, Math.floor(n / 2)), co: `Tyč Ø ${fmt(p.hak.prumerTyce)} mm`, pozn: `lůžko Ø ${fmt(2 * o.hak.rr, 1)} mm (s vůlí); na jednu tyč 2 kolébky` });
    if (p.typ === 'svorka' && p.svorka.tvar === 'klip' && !o.svorka.svisle) out.push({ ks: Math.max(1, Math.floor(n / 2)), co: `Tyč Ø ${fmt(p.svorka.prumer)} mm`, pozn: 'na jednu tyč 2 klipy' });
    if (p.system.druh === 'drevo') {
      const sirPasu = 2 * o.H - o.pokles + 3;
      out.push({ ks: null, co: `Nástěnná lišta: dřevo ${fmt(o.T)} mm, výška ${fmt(o.H)} mm, úkos ${fmt(o.al)}°`,
        pozn: `z pásu ${fmt(sirPasu, 0)} mm jedním šikmým řezem dvě lišty (prořez 3 mm); řezný plán celé stěny je ve stránce Držáky nářadí` });
    }
    return out;
  }

  /* ---------- projekt ---------- */
  function ulozProjekt(p) {
    return JSON.stringify({ format: 'webapp_cleat', verze: VERZE_FORMATU, ulozeno: new Date().toISOString(), projekt: p }, null, 2);
  }
  function nactiProjekt(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
    if (!o || typeof o !== 'object') throw new Error('Soubor neobsahuje projekt.');
    if (o.format !== 'webapp_cleat') throw new Error('Soubor není projekt držáku na French cleat (chybí "format": "webapp_cleat").');
    if (!(o.verze >= 1) || o.verze > VERZE_FORMATU) throw new Error(`Nepodporovaná verze projektu ${o.verze}.`);
    return normalizuj(o.projekt);
  }
  function popis(p) {
    const s = p.system, sys = `lišta ${fmt(s.tl)}×${fmt(s.vyska)} ${fmt(s.uhel)}°`;
    if (p.typ === 'zkouska') return p.zkouska.druh === 'vule' ? `zkušební zámky s vůlí ${seznam(p.zkouska.vule).map(v => fmt(v)).join(' / ')} mm · ${sys}` : `měrka profilu · ${sys}`;
    if (p.typ === 'lista' && p.lista.druh === 'koncovka') return `koncovka lišty · ${sys}`;
    if (p.typ === 'lista' && p.lista.druh === 'podlozka') return `distanční podložka ${fmt(p.lista.velPodlozky)} × ${fmt(p.lista.tlPodlozky)} mm`;
    if (p.typ === 'lista') return `${sys}, díl ${fmt(p.lista.delka)} mm, vrut ${fmt(VRUTY[p.lista.vrut].d)}${p.lista.spoj === 'rybina' ? ', rybina' : ''}`;
    const z = p.zada, w = `šířka ${fmt(z.sirka)}`;
    if (p.typ === 'hak') {
      const h = p.hak, kolik = h.pocet > 1 ? `${h.pocet} × ` : '', hd = h.vzpera ? ', se vzpěrou' : '';
      if (h.tvar === 'J') return `${kolik}hák J dosah ${fmt(h.dosah)}, R ${fmt(h.polomer)}${hd}, ${w} · ${sys}`;
      if (h.tvar === 'dvojity') return `${kolik}dvojitý hák ${fmt(h.dosah)} + ${fmt(h.dosah2)}${hd}, ${w} · ${sys}`;
      if (h.tvar === 'role') return `tyč na roli Ø ${fmt(h.prumerTyce)} × ${fmt(z.sirka)} mm · ${sys}`;
      if (h.tvar === 'kolik') return `${kolik}kolík ${fmt(h.dosah)} mm / ${fmt(h.uhel)}°${hd}, ${w} · ${sys}`;
      return `${kolik}kolébka na tyč Ø ${fmt(h.prumerTyce)}${hd}, ${w} · ${sys}`;
    }
    if (p.typ === 'svorka') {
      const q = p.svorka;
      return q.tvar === 'klip' ? `${q.osa === 'svisle' && q.pocet > 1 ? q.pocet + ' × ' : ''}klip na tyč Ø ${fmt(q.prumer)} (${OSY_KLIPU[q.osa].split(' (')[0]}) · ${sys}`
        : `${q.vPocet} × V-drážka ${fmt(q.vSirka)} mm, ${w} · ${sys}`;
    }
    if (p.typ === 'police') return `police ${fmt(z.sirka)} × ${fmt(p.police.hloubka)}, ${VZPERY[p.police.vzpera]}${p.police.sklon ? `, sklon ${fmt(p.police.sklon)}°` : ''} · ${sys}`;
    if (p.typ === 'stojan') {
      const q = p.stojan;
      if (q.druh === 'vrtaky') { const d = seznam(q.vrtaky); return `sada ${d.length} vrtáků ${d.length ? fmt(Math.min(...d)) + '–' + fmt(Math.max(...d)) : ''} mm, ${w} · ${sys}`; }
      return `${q.pocet}${q.rady > 1 && q.druh !== 'drazka' ? ` × ${q.rady}` : ''} ${q.druh === 'drazka' ? `drážek ${fmt(q.sirkaDrazky)}` : `${q.druh === 'sestihran' ? '⬡' : 'Ø'} ${fmt(q.prumer)}`}, ${w} · ${sys}`;
    }
    if (p.typ === 'kapsa') { const q = p.kapsa; return q.tvar === 'kulata' ? `${q.pocet} × ${q.dnoTyp === 'prstenec' ? 'prstenec' : 'kelímek'} Ø ${fmt(q.prumer)} · ${sys}` : `kapsa ${fmt(z.sirka)} × ${fmt(q.hloubka)} × ${fmt(q.vyska)} · ${sys}`; }
    const dk = p.deska;
    return `deska ${fmt(z.sirka)} × ${fmt(z.vyska)}${dk.sloupcu * dk.rad ? `, ${dk.sloupcu * dk.rad} otvorů` : ''}${dk.pruvlaky ? `, ${dk.pruvlaky} × průvlak` : ''}${dk.kolejnice ? `, ${dk.kolejnice} × kolejnička` : ''}${dk.magnety ? `, ${dk.magnety} magnetů` : ''} · ${sys}`;
  }

  /* ---------- tisk ---------- */
  // profil zboku vytažený do šířky → tisk na boku
  const profilovy = p => p.typ === 'zkouska' || p.typ === 'hak' || p.typ === 'police' || (p.typ === 'deska' && !p.deska.kolejnice) || (p.typ === 'svorka' && p.svorka.tvar === 'klip' && p.svorka.osa === 'vodorovne')
    || (p.typ === 'zkouska' && p.zkouska.druh === 'merka') || (p.typ === 'lista' && p.lista.druh === 'koncovka');
  const NA_BOKU = k => k === '-X' || k === '+X';
  const osaNahoru = klic => (klic && /^[+-][XYZ]$/.test(klic) ? klic[1].toLowerCase() : 'z');
  /** Převisy ze spojek; plošky celé do výšky `spodek` nad podložkou (sražené hrany, oblouky) se berou jako „na podložce“.
     Limit +0,5° – zámek s úkosem přesně 45° nemá padat do převisu kvůli zaokrouhlení. */
  function previsy(poz, idx, limit, spodek = 1) {
    const pv = SP.previsy(poz, idx, limit + 0.5);
    let zmin = Infinity;
    for (let i = 2; i < poz.length; i += 3) if (poz[i] < zmin) zmin = poz[i];
    for (let t = 0; t < pv.tridy.length; t++) {
      if (pv.tridy[t] !== 2) continue;
      const a = 3 * idx[3 * t], b = 3 * idx[3 * t + 1], c = 3 * idx[3 * t + 2];
      if (Math.max(poz[a + 2], poz[b + 2], poz[c + 2]) > zmin + spodek) continue;
      const ux = poz[b] - poz[a], uy = poz[b + 1] - poz[a + 1], uz = poz[b + 2] - poz[a + 2];
      const vx = poz[c] - poz[a], vy = poz[c + 1] - poz[a + 1], vz = poz[c + 2] - poz[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz), A = l / 2;
      pv.volne -= A;
      if (-nz / l > Math.sin(Math.min(89, limit + 15) * RAD)) pv.strme -= A;
      pv.tridy[t] = 3;
    }
    pv.volne = Math.max(0, pv.volne); pv.strme = Math.max(0, pv.strme);
    return pv;
  }
  const spodekTisku = o => Math.max(1, Math.min(3, Math.max(o.sraz || 0, o.rohy || 0)) + 0.1);
  const NAZVY_ORIENTACE = {
    '-X': 'na boku (profil na podložce)', '+X': 'na druhém boku', '-Z': 'nastojato, spodkem na podložce', '+Z': 'vzhůru nohama',
    '-Y': 'zády ke zdi na podložce', '+Y': 'čelem na podložce',
  };
  /** Část sítě s vrcholy v x ∈ [x0, x1] (jeden vzorek zkoušky) – trojúhelníky se nepřeindexují, jen vyberou. */
  function vyrezX(sit, x0, x1) {
    const P = sit.poz, I = sit.idx, uvnitr = i => P[3 * i] >= x0 - 0.01 && P[3 * i] <= x1 + 0.01, idx = [];
    for (let t = 0; t < I.length; t += 3) if (uvnitr(I[t]) && uvnitr(I[t + 1]) && uvnitr(I[t + 2])) idx.push(I[t], I[t + 1], I[t + 2]);
    return { poz: P, idx: new Uint32Array(idx) };
  }
  /** Tisková poloha; samostatné vzorky zkoušky (sit.vzorky = [[x0, x1]…]) se otočí každý zvlášť a položí vedle sebe po 5 mm. */
  function tiskovaPoloha(sit, R) {
    const t = SP.tiskovaPoloha(sit, R);
    if (!sit.vzorky || sit.vzorky.length < 2) return t;
    const P = sit.poz, Q = t.poz, nV = P.length / 3, skup = new Int32Array(nV).fill(-1);
    for (let i = 0; i < nV; i++) skup[i] = sit.vzorky.findIndex(([a, b]) => P[3 * i] >= a - 0.01 && P[3 * i] <= b + 0.01);
    const B = sit.vzorky.map(() => [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    for (let i = 0; i < nV; i++) { const b = B[skup[i]]; if (!b) continue; for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], Q[3 * i + k]); b[k + 3] = Math.max(b[k + 3], Q[3 * i + k]); } }
    let x = 0;
    const posun = B.map(b => { const d = [x - b[0], -(b[1] + b[4]) / 2, -b[2]]; x += b[3] - b[0] + 5; return d; });
    for (let i = 0; i < nV; i++) { const d = posun[skup[i]]; if (d) for (let k = 0; k < 3; k++) Q[3 * i + k] += d[k] - (k === 0 ? (x - 5) / 2 : 0); }
    return t;
  }
  function rozborTisku(sit0, p, o) {
    // samostatné vzorky: orientace se posoudí na jednom (ostatní jsou stejné a v tisku leží vedle sebe)
    const sit = sit0.vzorky && sit0.vzorky.length ? vyrezX(sit0, ...sit0.vzorky[0]) : sit0;
    const lim = p.tisk.previs, vysl = [], spodek = spodekTisku(o), prof = profilovy(p);
    for (const k of SP.kandidatiOrientace({ typ: p.typ }, {})) {
      const R = SP.rotaceDolu(k.dolu), pv = previsy(SP.tiskovaPoloha(sit, R).poz, sit.idx, lim, spodek);
      // mosty: profilové díly je na boku nemají; u kapes a stojánků = strop dutiny / otvorů → nastojato je lepší
      let skore = pv.volne * 5 + pv.strme * 20 + pv.most * (prof ? 0.3 : 3) + pv.vyska * 0.5 - Math.min(pv.podlozka, 150) * 0.2 + (pv.podlozka < 20 ? 10000 : 0);
      // profilové díly na boku: vrstvy vedou podél háku i zámku → nejpevnější
      if (prof && !NA_BOKU(k.klic)) skore += 400;
      vysl.push(Object.assign({}, k, { nazev: NAZVY_ORIENTACE[k.klic] || k.nazev, R, volne: pv.volne, strme: pv.strme, most: pv.most, podlozka: pv.podlozka, vyska: pv.vyska, skore }));
    }
    vysl.sort((a, b) => a.skore - b.skore);
    return { kandidati: vysl, nejlepsi: vysl[0], vybrana: vysl.find(v => v.klic === p.tisk.orientace) || vysl[0] };
  }
  function kontrolyTisku(p, o, rozbor, plocha) {
    const H = SP.kontrolyTisku(p, o, rozbor, plocha);
    if (profilovy(p) && !NA_BOKU(rozbor.vybrana.klic) && NA_BOKU(rozbor.nejlepsi.klic))
      H.push({ uroven: 'varovani', text: `V orientaci „${rozbor.vybrana.nazev}“ vedou vrstvy napříč hákem nebo zámkem – praskne mezi vrstvami. Tiskněte na boku.`,
        pole: ['tisk.orientace'], oprava: { pole: 'tisk.orientace', hodnota: rozbor.nejlepsi.klic, text: 'tisknout na boku' } });
    if (p.typ === 'svorka' && p.svorka.tvar === 'klip' && o.svorka.svisle && !NA_BOKU(rozbor.vybrana.klic))
      H.push({ uroven: 'info', text: 'Svislý klip se tiskne nastojato – kroužek má vrstvy napříč osou tyče, pruží dobře. Na nacvakávání je nejlepší PETG nebo PA.', pole: ['tisk.material'] });
    return H;
  }

  /* ---------- zesílení na zátěž ---------- */
  // co zesílit, když je nejslabší dané místo (cesty k parametrům podle typu)
  const ZESILIT = {
    rameno: { hak: ['hak.tl', 'hak.tlSpicky'], svorka: ['svorka.stena'], police: ['police.tl'], stojan: ['stojan.tl', 'stojan.tlBocnice'], kapsa: ['kapsa.stena', 'kapsa.dno'] },
    vzpera: { hak: ['hak.tlVzpery'], police: ['police.tlVzpery'] },
    zada: { '*': ['zada.tl'] }, zamek: { '*': ['zada.nad'] }, tyc: { hak: ['hak.prumerTyce'] }, ramenoTyce: { hak: ['hak.tl'] },
  };
  /** Zesílí díl tak, aby zadanou zátěž unesl s rezervou BEZPECNOST: opakovaně přidá ~10 % k parametru nejslabšího místa.
     Vrací {p, ok, zmeny: [{cesta, z, na}], kMin}. Kontroly nesmí přibýt chyba; meze ROZSAHY se dodrží. */
  function zesil(p0, osa0) {
    let p = normalizuj(p0).p;
    if (!jeDrzak(p) || !(p.zatez.kg > 0)) return { p, ok: true, zmeny: [], kMin: Infinity };
    const osa = osa0 || (profilovy(p) ? 'x' : 'z'), pred = {};
    const chyby = q => kontroly(q, odvozene(q)).filter(h => h.uroven === 'chyba').length;
    const chyb0 = chyby(p);
    let pv = pevnost(p, odvozene(p), osa);
    for (let i = 0; i < 80 && pv.kMin < BEZPECNOST; i++) {
      const slabe = pv.prurezy.reduce((a, b) => (Math.min(b.k, b.vzper ? b.vzper.k : Infinity) < Math.min(a.k, a.vzper ? a.vzper.k : Infinity) ? b : a));
      const tab = ZESILIT[slabe.klic] || {}, cesty = tab[p.typ] || tab['*'] || [];
      let zmeneno = false;
      for (const c of cesty) {
        const h = vezmi(p, c), [, mx] = ROZSAHY[c] || [0, Infinity];
        if (!(h < mx)) continue;
        const q = kopie(p);
        poloz(q, c, Math.min(mx, Math.round((h + Math.max(0.5, h * 0.1)) * 10) / 10));
        if (c === 'hak.tl' && q.hak.tlSpicky > q.hak.tl) q.hak.tlSpicky = q.hak.tl;
        const nq = normalizuj(q).p;
        if (chyby(nq) > chyb0) continue;
        if (!(c in pred)) pred[c] = h;
        p = nq; zmeneno = true;
      }
      if (!zmeneno) break;
      pv = pevnost(p, odvozene(p), osa);
    }
    return { p, ok: pv.kMin >= BEZPECNOST, kMin: pv.kMin, zmeny: Object.entries(pred).map(([cesta, z]) => ({ cesta, z, na: vezmi(p, cesta) })) };
  }

  /** Oblasti průřezů pro barevnou mapu pevnosti v náhledu: [{min:[x,y,z], max:[x,y,z], k, nazev}] (souřadnice dílu). */
  function mapaPevnosti(p, o, pv) {
    const out = [], W = o.W, kk = x => Math.min(x.k, x.vzper ? x.vzper.k : Infinity);
    const pridej = (klic, min, max) => { const x = pv.prurezy.find(r => r.klic === klic); if (x) out.push({ min, max, k: kk(x), nazev: x.nazev }); };
    pridej('zada', [-1, o.yZ - 0.2, o.zBot - 1], [W + 1, o.y0 + 0.2, o.zadaTop + 1]);
    pridej('zamek', [-1, o.gw - 1, o.H - 1], [W + 1, o.yZ + 0.2, o.zTop + 1]);
    if (p.typ === 'hak') {
      const h = o.hak, d = Math.max(6, Math.min(h.e * 0.4, 25));
      if (h.tvar === 'role') { pridej('tyc', [h.ta, h.yr - h.rr - 1, h.zr - h.rr - 1], [h.ta + 15, h.yr + h.rr + 1, h.zr + h.rr + 1]); pridej('ramenoTyce', [-1, o.y0, h.zA - 1], [h.ta + 1, o.y0 + d, h.zA + Math.max(h.t0, 2 * h.rr) + 1]); }
      else pridej('rameno', [-1, o.y0 - 0.2, h.zA - 1], [W + 1, o.y0 + d, h.zA + h.t0 + 1 + (o.r || 0)]);
      if (h.vzpera && h.tvar !== 'role') pridej('vzpera', [-1, o.y0 - 0.2, o.zBot - 1], [W + 1, h.vzpera.P1[0] + h.vzpera.ts, h.vzpera.P1[1] + h.vzpera.ts]);
    } else if (p.typ === 'police') {
      const q = o.police;
      pridej('rameno', [-1, o.y0 - 0.2, q.zt - q.tp - 1], [W + 1, o.y0 + q.D, q.zt + 1]);
      pridej('vzpera', [-1, o.y0 - 0.2, o.zBot - 1], [W + 1, o.y0 + q.kv * q.D + 1, q.zt - q.tp]);
    } else if (p.typ === 'stojan' || p.typ === 'kapsa') {
      const q = o[p.typ], D = q.D;
      pridej('rameno', [-1, o.y0 - 0.2, o.zBot - 1], [W + 1, o.y0 + Math.min(D, 20), o.zBot + (q.tp || q.sd || 3) + 1]);
    } else if (p.typ === 'svorka') {
      const q = o.svorka;
      if (q.tvar === 'klip') pridej('rameno', [-1, o.y0 - 0.2, o.zBot - 1], [W + 1, q.uc - q.Ri + 0.5, o.zTop + 1]);
      else pridej('rameno', [-1, o.y0 - 0.2, o.zBot - 1], [W + 1, o.y0 + 5, q.zt + 1]);
    }
    return out;
  }

  const API = {
    VERZE_FORMATU, TYPY, ZUBY, HRANY, ODLEHCENI, KOLEJNICE, ZKOUSKY, DRUHY_LISTY_DILU, SYSTEMY, DRUHY_LISTY, ZAMKY, TVARY_HAKU, TVARY_SVORKY, OSY_KLIPU, OPERY, VZPERY, DRUHY_OTVORU, TVARY_KAPSY, DNA, OTVORY_DESKY,
    kusu, SPOJE_LISTY, SPOJE_DESKY, VRUTY, SROUBY, DELKY_VRUTU, MATICE, ZAPUSTNA_M, PEVNOST, BEZPECNOST, MATERIALY, VYCHOZI, ROZSAHY, PREDVOLBY,
    kopie, cislo, fmt, vezmi, poloz, normalizuj, zPredvolby, nahodny, zesil, mapaPevnosti, jeDrzak, zubBody, nastavSystem, rozloz, seznam, otvor, odvozene, kontroly, pevnost, kontrolyPevnosti,
    kusovnik, ulozProjekt, nactiProjekt, popis, rozborTisku, kontrolyTisku, previsy, spodekTisku, osaNahoru, NA_BOKU, profilovy,
    tiskovaPoloha, potrebujePodpory: SP.potrebujePodpory, odhadTisku: SP.odhadTisku,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.CLEAT = API;
})();

/* ============================================================
   odizolovac/jadro.js – parametry, předvolby vodičů a kabelů,
   rozvržení stahováku (čistá geometrie bez DOM, běží i v node).

   Princip všech tří nástrojů: vodič/kabel leží v drážce, pod ní je
   v úzké štěrbině kus ulamovací čepele ostřím nahoru. Ostří vyčnívá
   nad nejnižší bod dna drážky přesně o hloubku řezu c. Vodič se
   zatlačí ke dnu (dno je doraz), ostří se zařízne o c – a ne víc.
   Souřadnice: mm, X napříč drážkami, Y podél vodiče, Z nahoru,
   spodek tělesa z = 0, čelo (vstup vodiče) y = 0.
   ============================================================ */
(function () {
  'use strict';

  const REZIMY = {
    hrebinek: { nazev: 'Hřebínek na vodiče', kratce: 'kruhový řez izolace jednotlivých vodičů',
      popis: 'Drážky pro několik průřezů vedle sebe. Vodič se vloží do drážky až na doraz, zatlačí ke dnu, protočí se o 360° a vytáhne – odříznutá izolace zůstane za čepelí. Doraz odměří délku odizolování.' },
    kulaty: { nazev: 'Odplášťovač kulatého kabelu', kratce: 'kruhový + podélný řez pláště',
      popis: 'Dvě drážky: v levé je příčná čepel (kabel se zatlačí a protočí = kruhový řez pláště), v pravé podélná čepel (kabel se zatlačí a protáhne = podélné rozříznutí). Plášť pak jde stáhnout bez poškození žil.' },
    plochy: { nazev: 'Odplášťovač plochého kabelu', kratce: 'podélný řez pláště',
      popis: 'Obdélníková drážka s podélnou čepelí. Plochý kabel se zatlačí ke dnu a protáhne – plášť se podélně nařízne a jde rozevřít.' },
    sesivacka: { nazev: 'Sešívačka s pružným obloukem', kratce: 'stisk čelistí, řez shora i zespodu',
      popis: 'Dvě ramena spojená vzadu pružným obloukem (tvar „C“), tiskne se vcelku na boku a rozevřená. Vodiče se zasunou zepředu do drážek až na doraz, stiskem se čelisti sevřou (dosednou na sebe = doraz) a čepele se zakousnou do izolace zespodu i shora. Vytažením vodičů se izolace stáhne.' }
  };

  Object.assign(REZIMY, {
    vkleste: { nazev: 'Kleště s V-zářezem', kratce: 'nastavitelné kleště, jeden zářez pro všechny průřezy',
      popis: 'Ramena s pružným obloukem jako u sešívačky. V každé čelisti jsou dvě šikmé čepele za sebou – zepředu tvoří spodní „V“ a horní „Λ“, dohromady kosočtverec, který obejme jádro čtyřmi řezy. Velikost kosočtverce nastavuje dorazový šroub M3; tabulka říká, kolik otáček pro který vodič.' },
    podelny: { nazev: 'Objímka na podélný řez', kratce: 'rozříznutí pláště uprostřed kabelu',
      popis: 'Kleště s pružným obloukem, kabel se vkládá z boku napříč čelistí – nemusí se přerušit (odbočka v krabici). Čepel ve spodní čelisti leží podél kabelu a vyčnívá nad dno drážky o hloubku řezu; čelisti se sevřou a kabel se protáhne.' },
    jemne: { nazev: 'Jemný odizolovač', kratce: 'tenká lanka 0,05–0,5 mm², AWG 30–20',
      popis: 'Kleště s V-zářezem naladěné na tenké vodiče: plošší „V“, malý zbytek izolace na jádře a jemné nastavení šroubem. Pro propojovací lanka v elektronice, kde izolace má jen 0,2–0,4 mm.' },
    merka: { nazev: 'Měrka průřezů a délek', kratce: 'bez čepele – kalibr jader, odměřování délky',
      popis: 'Destička bez čepele: otvory pro určení průřezu holého jádra (drát nebo lanko) s vyrytými čísly, drážky s dorazem pro odměření délky odizolování (konec vodiče na doraz, hrana destičky ukazuje místo řezu) a pravítko.' }
  });
  const KLOUB = ['sesivacka', 'vkleste', 'podelny', 'jemne'];
  const VK = ['vkleste', 'jemne'];
  const SVODICI = ['hrebinek', 'sesivacka', 'vkleste', 'jemne'];

  /* Ulamovací čepele. Rozteč článků a úhel lomových rýh se liší podle výrobce – změřte. */
  const CEPELE = {
    c9: { nazev: '9 mm (80 × 9 × 0,38 mm, 13 článků)', W: 9, t: 0.38, roztec: 5, uhel: 60 },
    c18: { nazev: '18 mm (100 × 18 × 0,5 mm, 7–8 článků)', W: 18, t: 0.5, roztec: 12.5, uhel: 60 },
    c25: { nazev: '25 mm (126 × 25 × 0,7 mm)', W: 25, t: 0.7, roztec: 18, uhel: 60 },
    vlastni: { nazev: 'vlastní rozměry' }
  };

  /* Jednotlivé vodiče: D = průměr přes izolaci (typický, změřte!), t = jmenovitá tloušťka izolace,
     d = průměr jádra. Tloušťky izolace podle EN 50525-2-31 / -2-11, průměry typické. */
  const VODICE = [
    { id: 'k05', nazev: 'H05V-K 0,5 (lanko)', D: 2.3, t: 0.6, d: 0.95 },
    { id: 'k075', nazev: 'H05V-K 0,75 (lanko)', D: 2.5, t: 0.6, d: 1.15 },
    { id: 'k1', nazev: 'H05V-K 1 (lanko)', D: 2.6, t: 0.6, d: 1.3 },
    { id: 'u15', nazev: 'CY / žíla CYKY 1,5 (drát)', D: 2.9, t: 0.7, d: 1.38 },
    { id: 'u25', nazev: 'CY / žíla CYKY 2,5 (drát)', D: 3.5, t: 0.8, d: 1.78 },
    { id: 'u4', nazev: 'CY / žíla CYKY 4 (drát)', D: 4.0, t: 0.8, d: 2.26 },
    { id: 'u6', nazev: 'CY / žíla CYKY 6 (drát)', D: 4.5, t: 0.8, d: 2.76 },
    { id: 'k15', nazev: 'H07V-K / CYA 1,5 (lanko)', D: 3.1, t: 0.7, d: 1.6 },
    { id: 'k25', nazev: 'H07V-K / CYA 2,5 (lanko)', D: 3.8, t: 0.8, d: 2.05 },
    { id: 'k4', nazev: 'H07V-K / CYA 4 (lanko)', D: 4.4, t: 0.8, d: 2.6 },
    { id: 'k6', nazev: 'H07V-K / CYA 6 (lanko)', D: 5.0, t: 0.8, d: 3.2 }
  ];
  const VYCHOZI_VODICE = ['k075', 'u15', 'u25', 'u4', 'u6'];
  /* Tenké vodiče (elektronika): typické hodnoty propojovacích lanek s PVC izolací – výrobci se liší, změřte. */
  const VODICE_JEMNE = [
    { id: 'awg30', nazev: 'AWG 30 (0,05 mm², wrap)', D: 0.6, t: 0.15, d: 0.27 },
    { id: 'awg28', nazev: 'AWG 28 (0,08 mm²)', D: 0.9, t: 0.25, d: 0.38 },
    { id: 'awg26', nazev: 'AWG 26 (0,14 mm²)', D: 1.1, t: 0.3, d: 0.48 },
    { id: 'awg24', nazev: 'AWG 24 (0,2 mm²)', D: 1.3, t: 0.33, d: 0.6 },
    { id: 'awg22', nazev: 'AWG 22 (0,35 mm²)', D: 1.5, t: 0.36, d: 0.76 },
    { id: 'awg20', nazev: 'AWG 20 (0,5 mm²)', D: 1.8, t: 0.4, d: 0.96 },
    { id: 'liyv014', nazev: 'LiYY 0,14 mm²', D: 1.1, t: 0.25, d: 0.5 },
    { id: 'liyv025', nazev: 'LiYY 0,25 mm²', D: 1.3, t: 0.28, d: 0.65 },
    { id: 'liyv05', nazev: 'LiYY 0,5 mm²', D: 1.8, t: 0.35, d: 0.95 }
  ];
  const VYCHOZI_JEMNE = ['awg28', 'awg26', 'awg24', 'awg22', 'awg20'];
  /* Měrka: průměry holých jader. Drát (třída 1) jmenovitě podle průřezu, lanko (třída 5) typický obal svazku. */
  const JADRA = {
    drat: { nazev: 'drát (plné jádro)', d: { '0,5': 0.80, '0,75': 0.98, '1': 1.13, '1,5': 1.38, '2,5': 1.78, '4': 2.26, '6': 2.76, '10': 3.57, '16': 4.52 } },
    lanko: { nazev: 'lanko (typický svazek)', d: { '0,25': 0.65, '0,5': 0.9, '0,75': 1.1, '1': 1.25, '1,5': 1.55, '2,5': 2.0, '4': 2.6, '6': 3.2, '10': 4.2, '16': 5.4 } }
  };

  /* Kulaté kabely: D = vnější průměr, t = jmenovitá tloušťka pláště.
     CYKY podle katalogového listu nkt instal CYKY 450/750 V (průměr informativní),
     CYSY (H05VV-F) – tloušťka pláště podle EN 50525-2-11, průměr typický. */
  const KABELY = [
    { id: 'cyky2x15', nazev: 'CYKY 2×1,5', D: 7.4, t: 1.0 },
    { id: 'cyky3x15', nazev: 'CYKY 3×1,5', D: 7.8, t: 1.0 },
    { id: 'cyky4x15', nazev: 'CYKY 4×1,5', D: 8.5, t: 1.0 },
    { id: 'cyky5x15', nazev: 'CYKY 5×1,5', D: 9.3, t: 1.0 },
    { id: 'cyky2x25', nazev: 'CYKY 2×2,5', D: 8.6, t: 1.0 },
    { id: 'cyky3x25', nazev: 'CYKY 3×2,5', D: 9.1, t: 1.0 },
    { id: 'cyky4x25', nazev: 'CYKY 4×2,5', D: 9.9, t: 1.0 },
    { id: 'cyky5x25', nazev: 'CYKY 5×2,5', D: 11.3, t: 1.2 },
    { id: 'cyky3x4', nazev: 'CYKY 3×4', D: 10.2, t: 1.0 },
    { id: 'cyky3x6', nazev: 'CYKY 3×6', D: 12.5, t: 1.2 },
    { id: 'cysy2x075', nazev: 'CYSY (H05VV-F) 2×0,75', D: 6.4, t: 0.8 },
    { id: 'cysy3x075', nazev: 'CYSY (H05VV-F) 3×0,75', D: 6.8, t: 0.8 },
    { id: 'cysy3x1', nazev: 'CYSY (H05VV-F) 3×1', D: 7.2, t: 0.8 },
    { id: 'cysy3x15', nazev: 'CYSY (H05VV-F) 3×1,5', D: 8.4, t: 0.9 },
    { id: 'cysy3x25', nazev: 'CYSY (H05VV-F) 3×2,5', D: 10.3, t: 1.1 }
  ];
  /* Ploché kabely: S × H = šířka × výška, t = plášť. CYKYLo-J 3×1,5 podle technického listu výrobce. */
  const PLOCHE = [
    { id: 'cykylo3x15', nazev: 'CYKYLo-J 3×1,5', S: 9.55, H: 4.15, t: 0.7 }
  ];

  const VSE = ['hrebinek', 'kulaty', 'plochy', 'sesivacka', 'vkleste', 'podelny', 'jemne'];
  const TRI = ['hrebinek', 'kulaty', 'plochy'];
  const S = ['sesivacka', 'vkleste', 'podelny', 'jemne'];   // nástroje s kloubem
  const ZALOHA = { vkleste: 'sesivacka', jemne: 'sesivacka', podelny: 'kulaty', merka: 'hrebinek' };
  /* Materiály pružného listu: E (MPa) a přetvoření, které výtisk snese opakovaně (orientačně). */
  const MATERIALY = {
    PETG: { nazev: 'PETG (doporučeno)', E: 2100, epsDov: 0.02 },
    PLA: { nazev: 'PLA (křehčí, únava)', E: 3500, epsDov: 0.008 },
    ASA: { nazev: 'ASA / ABS', E: 2000, epsDov: 0.015 },
    PA: { nazev: 'PA (nylon)', E: 1500, epsDov: 0.03 }
  };
  /* skupina: cepel | rez | tvar | tisk ; typ: cislo (výchozí) | vyber */
  const PARAMETRY = [
    { klic: 'cepel', nazev: 'Čepel', typ: 'vyber', skupina: 'cepel', rezimy: VSE, vychozi: { hrebinek: 'c9', kulaty: 'c18', plochy: 'c18', sesivacka: 'c9', podelny: 'c9' },
      moznosti: Object.entries(CEPELE).map(([k, c]) => [k, c.nazev]), vychoziS: 'c9' },
    { klic: 'cepelW', nazev: 'Šířka čepele (ostří → hřbet)', jedn: 'mm', min: 6, max: 30, krok: 0.1, skupina: 'cepel', rezimy: VSE, vychozi: { hrebinek: 9, kulaty: 18, plochy: 18, sesivacka: 9, podelny: 9 },
      napoveda: 'Změřte posuvkou. Na šířce závisí výška ostří nad dnem štěrbiny.' },
    { klic: 'cepelT', nazev: 'Tloušťka čepele', jedn: 'mm', min: 0.2, max: 1.2, krok: 0.01, skupina: 'cepel', rezimy: VSE, vychozi: { hrebinek: 0.38, kulaty: 0.5, plochy: 0.5, sesivacka: 0.38, podelny: 0.38 } },
    { klic: 'roztec', nazev: 'Rozteč lomových rýh (po ostří)', jedn: 'mm', min: 2, max: 40, krok: 0.1, skupina: 'cepel', rezimy: VSE, vychozi: { hrebinek: 5, kulaty: 12.5, plochy: 12.5, sesivacka: 5, podelny: 5 },
      napoveda: 'Vzdálenost dvou sousedních rýh měřená podél ostří.' },
    { klic: 'uhel', nazev: 'Úhel lomových rýh k ostří', jedn: '°', min: 30, max: 90, krok: 1, skupina: 'cepel', rezimy: VSE, vychozi: 60,
      napoveda: 'Ulomený kus je kosodélník – kapsa je o W / tg(úhel) delší než ostří.' },

    { klic: 'podilRezu', nazev: 'Hloubka řezu (podíl tloušťky izolace)', jedn: '%', min: 40, max: 100, krok: 1, skupina: 'rez', rezimy: ['hrebinek', 'kulaty', 'plochy', 'sesivacka', 'podelny'], vychozi: { hrebinek: 85, kulaty: 75, plochy: 75, sesivacka: 80 },
      napoveda: 'Zbytek izolace se při stažení utrhne. Méně = jistější pro jádro, víc = snazší stažení.' },
    { klic: 'korekce', nazev: 'Korekce výšky ostří', jedn: 'mm', min: -1, max: 1, krok: 0.05, skupina: 'rez', rezimy: ['hrebinek', 'kulaty', 'plochy', 'sesivacka', 'podelny'], vychozi: 0,
      napoveda: 'Kladná = ostří výš = hlubší řez. Doladění po zkušebním výtisku (přidá se ke všem drážkám).' },
    { klic: 'delkaOdiz', nazev: 'Délka odizolování (doraz)', jedn: 'mm', min: 0, max: 40, krok: 0.5, skupina: 'rez', rezimy: ['hrebinek', 'sesivacka', 'vkleste', 'jemne'], vychozi: { hrebinek: 11, sesivacka: 11, vkleste: 11, jemne: 6 },
      napoveda: '0 = bez dorazu (průchozí drážky). WAGO 221/2273: 11 mm, svorkovnice a jističe obvykle 8–12 mm.' },

    { klic: 'kabel', nazev: 'Kabel', typ: 'vyber', skupina: 'tvar', rezimy: ['kulaty', 'podelny'], vychozi: 'cyky3x15',
      moznosti: KABELY.map(k => [k.id, k.nazev + ' (⌀ ' + fmt(k.D) + ', plášť ' + fmt(k.t) + ')']).concat([['vlastni', 'vlastní rozměry']]) },
    { klic: 'kabelD', nazev: 'Vnější průměr kabelu', jedn: 'mm', min: 3, max: 30, krok: 0.1, skupina: 'tvar', rezimy: ['kulaty', 'podelny'], vychozi: 7.8,
      napoveda: 'Změřte posuvkou na více místech. Drážka se dělá pro největší průměr – menší kabel se stejně tlustým pláštěm jde taky.' },
    { klic: 'kabelT', nazev: 'Tloušťka pláště', jedn: 'mm', min: 0.3, max: 3, krok: 0.05, skupina: 'tvar', rezimy: ['kulaty', 'podelny'], vychozi: 1.0 },
    { klic: 'plochy', nazev: 'Kabel', typ: 'vyber', skupina: 'tvar', rezimy: ['plochy'], vychozi: 'cykylo3x15',
      moznosti: PLOCHE.map(k => [k.id, k.nazev + ' (' + fmt(k.S) + ' × ' + fmt(k.H) + ', plášť ' + fmt(k.t) + ')']).concat([['vlastni', 'vlastní rozměry']]) },
    { klic: 'plochyS', nazev: 'Šířka kabelu', jedn: 'mm', min: 3, max: 30, krok: 0.05, skupina: 'tvar', rezimy: ['plochy'], vychozi: 9.55 },
    { klic: 'plochyH', nazev: 'Výška kabelu', jedn: 'mm', min: 1.5, max: 12, krok: 0.05, skupina: 'tvar', rezimy: ['plochy'], vychozi: 4.15 },
    { klic: 'plochyT', nazev: 'Tloušťka pláště', jedn: 'mm', min: 0.3, max: 3, krok: 0.05, skupina: 'tvar', rezimy: ['plochy'], vychozi: 0.7 },
    { klic: 'posunRezu', nazev: 'Posun podélného řezu od středu', jedn: 'mm', min: -10, max: 10, krok: 0.1, skupina: 'tvar', rezimy: ['plochy'], vychozi: 0,
      napoveda: 'Plášť plochého kabelu se řeže nad žílou – uprostřed je bezpečné místo.' },
    { klic: 'provedeni', nazev: 'Provedení', typ: 'vyber', skupina: 'tvar', rezimy: ['podelny'], vychozi: 'pravak',
      moznosti: [['pravak', 'pro praváky (objímka se posouvá doprava)'], ['levak', 'pro leváky (zrcadlově)']] },
    { klic: 'sklonCepele', nazev: 'Sklon čepele (špička nahoru)', jedn: '°', min: 5, max: 60, krok: 1, skupina: 'tvar', rezimy: ['podelny'], vychozi: 30,
      napoveda: 'Nad dno drážky vyčnívá jen ostrý roh kusu. Strmější = kratší odkrytá špička, lépe se zapíchne.' },
    { klic: 'delkaPodel', nazev: 'Délka podélného ostří (nejméně)', jedn: 'mm', min: 4, max: 60, krok: 0.5, skupina: 'tvar', rezimy: ['kulaty', 'plochy'], vychozi: 10,
      napoveda: 'Delší ostří = větší síla potřebná k zatlačení kabelu.' },

    { klic: 'tolerance', nazev: 'Tolerance horního řezu', jedn: 'mm', min: 0.02, max: 0.3, krok: 0.01, skupina: 'rez', rezimy: ['sesivacka'], vychozi: 0.08,
      napoveda: 'Horní čepel je mírně šikmá a drážky leží tam, kde mezera mezi ostřími sedí. O kolik smí horní řez vyjít jinak než spodní.' },
    { klic: 'uhelOtevreni', nazev: 'Rozevření (tisková poloha)', jedn: '°', min: 6, max: 30, krok: 0.5, skupina: 'kloub', rezimy: S, vychozi: 14,
      napoveda: 'O kolik je horní rameno vytištěné odklopené. Víc = širší vstup pro vodiče, ale větší ohyb listu.' },
    { klic: 'delkaRamen', nazev: 'Délka ramen', jedn: 'mm', min: 30, max: 200, krok: 1, skupina: 'kloub', rezimy: S, vychozi: 70 },
    { klic: 'tlListu', nazev: 'Tloušťka pružného oblouku', jedn: 'mm', min: 0.6, max: 4, krok: 0.05, skupina: 'kloub', rezimy: S, vychozi: 2,
      napoveda: 'Silnější oblouk = tužší pružina, ale větší přetvoření při stisku.' },
    { klic: 'materialListu', nazev: 'Materiál', typ: 'vyber', skupina: 'kloub', rezimy: S, vychozi: 'PETG',
      moznosti: Object.entries(MATERIALY).map(([k, m]) => [k, m.nazev]) },
    { klic: 'tlRamen', nazev: 'Tloušťka ramen za čelistmi', jedn: 'mm', min: 3, max: 20, krok: 0.5, skupina: 'kloub', rezimy: S, vychozi: 5,
      napoveda: 'Plnou výšku mají jen čelisti (kvůli čepelím). Ramena se dotýkají jen v čelistech – tam je doraz stisku.' },
    { klic: 'vuleDrazky', nazev: 'Vůle drážky (na stranu)', jedn: 'mm', min: 0, max: 1.5, krok: 0.05, skupina: 'tisk', rezimy: ['hrebinek', 'kulaty', 'plochy', 'sesivacka', 'podelny'], vychozi: { hrebinek: 0.2, kulaty: 0.2, plochy: 0.2, sesivacka: 0.1, podelny: 0.2 } },
    { klic: 'vuleStrbiny', nazev: 'Vůle štěrbiny čepele', jedn: 'mm', min: 0, max: 0.6, krok: 0.01, skupina: 'tisk', rezimy: VSE, vychozi: 0.15,
      napoveda: 'Štěrbina = tloušťka čepele + vůle. Čepel má jít zasunout rukou, ale nesmí se viklat.' },
    { klic: 'vuleKapsy', nazev: 'Vůle délky kapsy', jedn: 'mm', min: 0, max: 2, krok: 0.05, skupina: 'tisk', rezimy: VSE, vychozi: 0.4 },
    { klic: 'dno', nazev: 'Tloušťka dna pod čepelí', jedn: 'mm', min: 1.2, max: 6, krok: 0.1, skupina: 'tisk', rezimy: VSE, vychozi: 2.4 },
    { klic: 'stena', nazev: 'Stěna mezi drážkami a na okrajích', jedn: 'mm', min: 1.2, max: 8, krok: 0.1, skupina: 'tisk', rezimy: VSE, vychozi: 2 },
    { klic: 'strecha', nazev: 'Materiál nad ostřím mezi drážkami', jedn: 'mm', min: 0.8, max: 5, krok: 0.1, skupina: 'tisk', rezimy: TRI, vychozi: 1 },
    { klic: 'uhelV', nazev: 'Sklon ostří ve „V“', jedn: '°', min: 10, max: 40, krok: 1, skupina: 'rez', rezimy: VK, vychozi: { vkleste: 30, jemne: 20 },
      napoveda: 'Úhel ostří od vodorovné. Plošší V = menší nejmenší jádro, řezy blíž nahoře a dole.' },
    { klic: 'zbytek', nazev: 'Zbytek izolace na jádře', jedn: 'mm', min: 0, max: 0.4, krok: 0.01, skupina: 'rez', rezimy: VK, vychozi: { vkleste: 0.08, jemne: 0.03 },
      napoveda: 'O kolik je vepsaná kružnice kosočtverce větší než jádro (na poloměru). Izolace se zbytku utrhne.' },
    { klic: 'stoupani', nazev: 'Stoupání dorazového šroubu', jedn: 'mm', min: 0.25, max: 1.5, krok: 0.05, skupina: 'rez', rezimy: VK, vychozi: 0.5,
      napoveda: 'M3 = 0,5 mm, M4 = 0,7 mm. Matice se vloží do šestihranné kapsy zespodu.' },
    { klic: 'sroubD', nazev: 'Průměr šroubu', jedn: 'mm', min: 2, max: 5, krok: 0.1, skupina: 'rez', rezimy: VK, vychozi: 3 },
    { klic: 'maticeS', nazev: 'Matice – rozměr klíče', jedn: 'mm', min: 4, max: 8, krok: 0.1, skupina: 'rez', rezimy: VK, vychozi: 5.5 },
    { klic: 'druhJadra', nazev: 'Jádra', typ: 'vyber', skupina: 'merka', rezimy: ['merka'], vychozi: 'drat',
      moznosti: Object.entries(JADRA).map(([k, j]) => [k, j.nazev]) },
    { klic: 'prurezy', nazev: 'Průřezy (mm², oddělené středníkem)', typ: 'text', skupina: 'merka', rezimy: ['merka'], vychozi: '0,5; 0,75; 1; 1,5; 2,5; 4; 6; 10' },
    { klic: 'delky', nazev: 'Délky odizolování (mm, středník)', typ: 'text', skupina: 'merka', rezimy: ['merka'], vychozi: '6; 8; 10; 11; 12; 14' },
    { klic: 'vuleJadra', nazev: 'Vůle jádra v otvoru', jedn: 'mm', min: 0, max: 0.3, krok: 0.01, skupina: 'merka', rezimy: ['merka'], vychozi: 0.05 },
    { klic: 'korekceOtvoru', nazev: 'Korekce otvorů (tisknou se menší)', jedn: 'mm', min: -0.3, max: 0.6, krok: 0.01, skupina: 'merka', rezimy: ['merka'], vychozi: 0.15,
      napoveda: 'Přičte se k průměru každého otvoru. Ověřte vrtákem nebo kalibrem a dolaďte.' },
    { klic: 'tlDesky', nazev: 'Tloušťka destičky', jedn: 'mm', min: 2, max: 10, krok: 0.1, skupina: 'merka', rezimy: ['merka'], vychozi: 4 },
    { klic: 'sirkaKanalu', nazev: 'Šířka drážky na délku', jedn: 'mm', min: 2, max: 10, krok: 0.1, skupina: 'merka', rezimy: ['merka'], vychozi: 5 },
    { klic: 'hloubkaKanalu', nazev: 'Hloubka drážky na délku', jedn: 'mm', min: 1, max: 8, krok: 0.1, skupina: 'merka', rezimy: ['merka'], vychozi: 2.5 },
    { klic: 'vyskaPisma', nazev: 'Výška číslic', jedn: 'mm', min: 2.5, max: 10, krok: 0.1, skupina: 'merka', rezimy: ['merka'], vychozi: 4 },
    { klic: 'hloubkaPisma', nazev: 'Hloubka rytí', jedn: 'mm', min: 0.2, max: 2, krok: 0.05, skupina: 'merka', rezimy: ['merka'], vychozi: 0.6 },
    { klic: 'pravitko', nazev: 'Délka pravítka (0 = bez)', jedn: 'mm', min: 0, max: 200, krok: 5, skupina: 'merka', rezimy: ['merka'], vychozi: 40 },
    { klic: 'vycnivani', nazev: 'Vodič vyčnívá nad drážku', jedn: '%', min: 0, max: 50, krok: 1, skupina: 'tisk', rezimy: TRI, vychozi: 40,
      napoveda: 'Podíl průměru nad horní plochou – aby šel vodič palcem zatlačit ke dnu.' },
    { klic: 'kolik', nazev: 'Průměr pojistného kolíku', jedn: 'mm', min: 1, max: 4, krok: 0.05, skupina: 'tisk', rezimy: VSE, vychozi: 1.75,
      napoveda: 'Kousek filamentu 1,75 mm zastrčený svisle přes štěrbinu – čepel nevypadne.' },
    { klic: 'pred', nazev: 'Vedení před čepelí', jedn: 'mm', min: 3, max: 30, krok: 0.5, skupina: 'tisk', rezimy: VSE, vychozi: { hrebinek: 6, kulaty: 12, plochy: 10, sesivacka: 6, vkleste: 5, jemne: 4, podelny: 3 } }
  ];
  const PODLE_KLICE = Object.fromEntries(PARAMETRY.map(d => [d.klic, d]));

  function vychozi(rezim) {
    const o = {};
    for (const d of PARAMETRY) {
      if (!d.rezimy.includes(rezim)) continue;
      let v = d.vychozi;
      if (v && typeof v === 'object') { let r = rezim; while (v[r] === undefined && ZALOHA[r]) r = ZALOHA[r]; v = v[r]; }
      o[d.klic] = v;
    }
    if (rezim === 'jemne') o.vodice = VYCHOZI_JEMNE.map(id => { const v = VODICE_JEMNE.find(x => x.id === id); return { nazev: v.nazev, D: v.D, t: v.t, d: v.d }; });
    else if (SVODICI.includes(rezim)) o.vodice = VYCHOZI_VODICE.map(id => { const v = VODICE.find(x => x.id === id); return { nazev: v.nazev, D: v.D, t: v.t, d: v.d }; });
    return o;
  }

  function cislo(x) {
    if (typeof x === 'number') return x;
    if (typeof x !== 'string') return NaN;
    const s = x.trim().replace(/\s/g, '').replace(',', '.').replace('−', '-');
    if (!s || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return parseFloat(s);
  }

  /* Normalizace vstupu: čísla do mezí, výběry z možností, kontrola vazeb.
     Vrací {p, chyby:[{klic,text}], upozorneni:[{klic,text}]}. */
  function normalizuj(rezim, vstup) {
    if (!REZIMY[rezim]) throw new Error('neznámý režim ' + rezim);
    vstup = vstup || {};
    const vy = vychozi(rezim), p = {}, chyby = [], upozorneni = [];
    for (const d of PARAMETRY) {
      if (!d.rezimy.includes(rezim)) continue;
      const v = vstup[d.klic];
      if (d.typ === 'text') { p[d.klic] = typeof v === 'string' ? v.slice(0, 200) : vy[d.klic]; continue; }
      if (d.typ === 'vyber') {
        p[d.klic] = d.moznosti.some(m => m[0] === v) ? v : vy[d.klic];
        continue;
      }
      let x = cislo(v);
      if (v === undefined || v === null || v === '') x = vy[d.klic];
      else if (!Number.isFinite(x)) { upozorneni.push({ klic: d.klic, text: 'Neplatné číslo – použita výchozí hodnota.' }); x = vy[d.klic]; }
      if (x < d.min) { upozorneni.push({ klic: d.klic, text: 'Zvýšeno na nejmenší povolenou hodnotu ' + fmt(d.min) + '.' }); x = d.min; }
      if (x > d.max) { upozorneni.push({ klic: d.klic, text: 'Sníženo na největší povolenou hodnotu ' + fmt(d.max) + '.' }); x = d.max; }
      p[d.klic] = x;
    }
    if (SVODICI.includes(rezim)) {
      const radky = Array.isArray(vstup.vodice) ? vstup.vodice : vy.vodice;
      p.vodice = [];
      radky.slice(0, 16).forEach((r, i) => {
        const D = cislo(r && r.D), t = cislo(r && r.t), d = cislo(r && r.d);
        const nazev = String((r && r.nazev) || ('vodič ' + (i + 1))).slice(0, 60);
        if (!(D >= 0.3 && D <= 12)) { chyby.push({ klic: 'vodic' + i, text: nazev + ': průměr přes izolaci musí být 0,3–12 mm.' }); return; }
        if (!(t >= 0.05 && t < D / 2)) { chyby.push({ klic: 'vodic' + i, text: nazev + ': tloušťka izolace musí být 0,05 mm až polovina průměru.' }); return; }
        const dd = Number.isFinite(d) && d > 0 && d < D ? d : D - 2 * t;
        p.vodice.push({ nazev, D, t, d: dd });
      });
      if (!p.vodice.length && !chyby.length) chyby.push({ klic: 'vodice', text: 'Zadejte aspoň jeden vodič.' });
      if (radky.length > 16) upozorneni.push({ klic: 'vodice', text: 'Nejvýš 16 drážek – zbytek vynechán.' });
    }
    if (rezim === 'kulaty' && p.kabelT >= p.kabelD / 2) chyby.push({ klic: 'kabelT', text: 'Plášť nemůže být tlustší než poloměr kabelu.' });
    if (rezim === 'plochy') {
      if (p.plochyH > p.plochyS) chyby.push({ klic: 'plochyH', text: 'Výška plochého kabelu má být menší než šířka (kabel leží naplocho).' });
      if (p.plochyT >= p.plochyH / 2) chyby.push({ klic: 'plochyT', text: 'Plášť nemůže být tlustší než polovina výšky kabelu.' });
      if (Math.abs(p.posunRezu) > p.plochyS / 2 - p.plochyT - 0.5) chyby.push({ klic: 'posunRezu', text: 'Řez by vyšel mimo plochou část pláště (příliš velký posun).' });
    }
    // hloubky řezů
    for (const r of rezy(rezim, p)) {
      if (r.c <= 0.05) chyby.push({ klic: 'podilRezu', text: r.nazev + ': hloubka řezu vychází ' + fmt(r.c) + ' mm – ostří by nic neřízlo.' });
      else if (r.c >= r.t) chyby.push({ klic: 'korekce', text: r.nazev + ': řez ' + fmt(r.c) + ' mm je hlubší než izolace ' + fmt(r.t) + ' mm – poškodí jádro.' });
      else if (r.c > 0.95 * r.t) upozorneni.push({ klic: 'korekce', text: r.nazev + ': řez ' + fmt(r.c) + ' mm skoro prořízne izolaci ' + fmt(r.t) + ' mm – při tolerancích hrozí naříznutí jádra.' });
    }
    if (rezim === 'merka') {
      const pr = seznamCisel(p.prurezy), dl = seznamCisel(p.delky);
      if (!pr.length && !dl.length) chyby.push({ klic: 'prurezy', text: 'Zadejte aspoň jeden průřez nebo délku.' });
      for (const x of pr) if (!JADRA[p.druhJadra].d[fmt(x)]) chyby.push({ klic: 'prurezy', text: 'Průřez ' + fmt(x) + ' mm² není v tabulce jader (' + Object.keys(JADRA[p.druhJadra].d).join('; ') + ').' });
      for (const x of dl) if (!(x >= 2 && x <= 60)) chyby.push({ klic: 'delky', text: 'Délka ' + fmt(x) + ' mm je mimo 2–60 mm.' });
    }
    if ((KLOUB.includes(rezim) || rezim === 'merka') && !chyby.length) {
      const roz = rozvrhni(rezim, p);
      for (const c of roz.chyby) chyby.push(c);
    }
    if (p.cepelT + p.vuleStrbiny < 0.3) upozorneni.push({ klic: 'vuleStrbiny', text: 'Štěrbina užší než 0,3 mm se tryskou 0,4 mm skoro nevytiskne.' });
    return { p, chyby, upozorneni };
  }

  /* Seznam řezů: {nazev, t (izolace/plášť), c (hloubka řezu), D, druh} */
  function rezy(rezim, p) {
    const k = p.podilRezu / 100, kor = p.korekce || 0;
    if (rezim === 'merka') return [];
    if (VK.includes(rezim)) return (p.vodice || []).map(v => ({ nazev: v.nazev, t: v.t, c: v.t - p.zbytek, D: v.D, druh: 'V' }));
    if (rezim === 'podelny') return [{ nazev: 'plášť – podélný řez', t: p.kabelT, c: p.podilRezu / 100 * p.kabelT + p.korekce, D: p.kabelD, druh: 'podélný' }];
    if (rezim === 'hrebinek' || rezim === 'sesivacka') return (p.vodice || []).map(v => ({ nazev: v.nazev, t: v.t, c: k * v.t + kor, D: v.D, druh: 'kruhový' }));
    if (rezim === 'kulaty') {
      const c = k * p.kabelT + kor;
      return [{ nazev: 'plášť – kruhový řez', t: p.kabelT, c, D: p.kabelD, druh: 'kruhový' }, { nazev: 'plášť – podélný řez', t: p.kabelT, c, D: p.kabelD, druh: 'podélný' }];
    }
    return [{ nazev: 'plášť – podélný řez', t: p.plochyT, c: k * p.plochyT + kor, D: p.plochyH, druh: 'podélný' }];
  }

  const RAD = Math.PI / 180;
  /* Kus čepele: ostří aspoň `potreba` mm, zaokrouhleno na celé články.
     Ulomený kus je kosodélník → kapsa = P + W / tg α + vůle; jistě pokrytý úsek kapsy je [W/tgα + vůle, P]. */
  function kusCepele(p, potreba) {
    const presah = p.cepelW / Math.tan(p.uhel * RAD);
    const clanku = Math.max(1, Math.ceil((potreba + presah + p.vuleKapsy - 1e-9) / p.roztec));
    const P = clanku * p.roztec;
    return { clanku, P, presah, kapsa: P + presah + p.vuleKapsy, kryteOd: presah + p.vuleKapsy, kryteDo: P };
  }

  /* ---------- rozvržení ----------
     Výsledek je čistý popis tělesa:
     zony: kvádry tělesa [{x0,x1,y0,y1,z1}] (z0 = 0)
     drazky: [{profil:'kruh'|'obdelnik', xc, sirka, zDno, y0, y1, vodic}]
     strbiny: [{osa:'X'|'Y', poloha, od, do, z0, z1, tl}] – osa = směr ostří
     koliky: [{x, y, d}]
     cepele: [{osa, poloha, zacatek, P, W, t, presah, zOstri}]
     vodice: pro náhled – válce/kvádry ležící ve drážkách
     souhrn: čísla pro tabulku */
  function rozvrhni(rezim, p) {
    if (rezim === 'sesivacka') return rozvrhniSesivacku(p);
    if (VK.includes(rezim)) return rozvrhniVKleste(p, rezim);
    if (rezim === 'podelny') return rozvrhniPodelny(p);
    if (rezim === 'merka') return rozvrhniMerku(p);
    const W = p.cepelW, tl = p.cepelT + p.vuleStrbiny, z0 = p.dno, zE = z0 + W;   // hřbet leží na dně štěrbiny, ostří ve výšce zE
    const zStrop = zE + 0.25;                                                        // štěrbina je nad ostřím o 0,25 mm vyšší (ostří se nesmí opírat)
    const zMin = zStrop + p.strecha;                                                 // nejnižší horní plocha nad štěrbinou
    const dk = p.kolik + 0.15, okrajK = 1.2;                                         // otvor kolíku, materiál před ním
    const vycn = p.vycnivani / 100;
    const out = { rezim, zE, z0, tl, zony: [], drazky: [], strbiny: [], koliky: [], cepele: [], vodice: [], rezy: rezy(rezim, p), upozorneni: [] };
    const RZ = out.rezy;

    if (rezim === 'hrebinek') {
      const yb = p.pred, L = p.delkaOdiz;
      const yDoraz = L > 0 ? yb + L : null;
      const yKonec = L > 0 ? yDoraz + p.stena : yb + Math.max(6, p.stena + 4);
      // X: kolík u otevřeného konce štěrbiny (x = 0), pak kapsa, v jejím jistě krytém úseku drážky
      const xK = okrajK + dk / 2, xKap = xK + dk / 2 + 0.3;
      const sirky = p.vodice.map(v => v.D + 2 * p.vuleDrazky);
      const potreba = sirky.reduce((s, b) => s + b, 0) + p.stena * (sirky.length - 1) + 2 * 0.6;
      const kus = kusCepele(p, potreba);
      let x = xKap + kus.kryteOd + 0.6;
      const xKonecKapsy = xKap + kus.kapsa, xMax = xKonecKapsy + p.stena;
      const meze = [];
      p.vodice.forEach((v, i) => {
        const b = sirky[i], c = RZ[i].c, zDno = zE - c;
        const zHorni = Math.max(zMin, zDno + (1 - vycn) * v.D);
        if (zDno + (1 - vycn) * v.D < zMin - 1e-9) out.upozorneni.push({ klic: 'vycnivani', text: v.nazev + ': kvůli materiálu nad ostřím vyčnívá vodič jen ' + fmt(zDno + v.D - zMin) + ' mm.' });
        out.drazky.push({ profil: 'kruh', xc: x + b / 2, sirka: b, zDno, y0: -1, y1: yDoraz === null ? yKonec + 1 : yDoraz, vodic: i });
        out.vodice.push({ profil: 'kruh', xc: x + b / 2, zDno, D: v.D, d: v.d, y0: -14, y1: yDoraz === null ? yKonec + 6 : yDoraz, nazev: v.nazev });
        meze.push([x, x + b, zHorni]);
        x += b + p.stena;
      });
      // zóny horní plochy: hranice uprostřed stěn mezi drážkami
      const hrany = [0];
      for (let i = 1; i < meze.length; i++) hrany.push((meze[i - 1][1] + meze[i][0]) / 2);
      hrany.push(xMax);
      const zKraj = zMin;
      meze.forEach((m, i) => out.zony.push({ x0: hrany[i], x1: hrany[i + 1], y0: 0, y1: yKonec, z1: m[2] }));
      // okraj s kolíkem: kolík musí mít nad štěrbinou oporu – zóna aspoň zKraj
      if (out.zony.length) out.zony[0].z1 = Math.max(out.zony[0].z1, zKraj);
      out.strbiny.push({ osa: 'X', poloha: yb, od: -1, do: xKonecKapsy, z0, z1: zStrop, tl });
      out.koliky.push({ x: xK, y: yb, d: dk });
      out.cepele.push({ osa: 'X', poloha: yb, zacatek: xKap, P: kus.P, W, t: p.cepelT, presah: kus.presah, zOstri: zE, kus });
      out.rozmery = { x: xMax, y: yKonec, z: Math.max(...out.zony.map(z => z.z1)) };
      out.souhrn = { kusy: [{ nazev: 'čepel příčná', ...kus }], delkaOdiz: L, yb, yDoraz };
      return out;
    }

    if (rezim === 'kulaty') {
      const D = p.kabelD, b = D + 2 * p.vuleDrazky, c = RZ[0].c, zDno = zE - c;
      const zHorni = Math.max(zMin, zDno + (1 - vycn) * D);
      // levá drážka (příčná čepel, otevřená k x = 0), pravá drážka (podélná čepel, otevřená k zadní stěně)
      const xK = okrajK + dk / 2, xKap = xK + dk / 2 + 0.3;
      const kusX = kusCepele(p, b + 1.2);
      const xA = xKap + kusX.kryteOd + 0.6, xKonecX = xKap + kusX.kapsa;
      const xB = xKonecX + p.stena;
      const xBc = xB + b / 2, xMax = xB + b + p.stena;
      const kusY = kusCepele(p, p.delkaPodel);
      const yS = p.pred, yKonecKapsy = yS + kusY.kapsa, yK = yKonecKapsy + 0.3 + dk / 2, yMax = yK + dk / 2 + okrajK;
      const yb = yMax / 2;                                                       // příčná čepel uprostřed délky
      out.zony.push({ x0: 0, x1: xMax, y0: 0, y1: yMax, z1: zHorni });
      out.drazky.push({ profil: 'kruh', xc: xA + b / 2, sirka: b, zDno, y0: -1, y1: yMax + 1, vodic: 0 });
      out.drazky.push({ profil: 'kruh', xc: xBc, sirka: b, zDno, y0: -1, y1: yMax + 1, vodic: 1 });
      out.vodice.push({ profil: 'kruh', xc: xA + b / 2, zDno, D, d: D - 2 * p.kabelT, y0: -18, y1: yMax + 18, nazev: 'kabel' });
      out.vodice.push({ profil: 'kruh', xc: xBc, zDno, D, d: D - 2 * p.kabelT, y0: -18, y1: yMax + 18, nazev: 'kabel' });
      out.strbiny.push({ osa: 'X', poloha: yb, od: -1, do: xKonecX, z0, z1: zStrop, tl });
      out.koliky.push({ x: xK, y: yb, d: dk });
      out.cepele.push({ osa: 'X', poloha: yb, zacatek: xKap, P: kusX.P, W, t: p.cepelT, presah: kusX.presah, zOstri: zE, kus: kusX });
      out.strbiny.push({ osa: 'Y', poloha: xBc, od: yS, do: yMax + 1, z0, z1: zStrop, tl });
      out.koliky.push({ x: xBc, y: yK, d: dk });
      out.cepele.push({ osa: 'Y', poloha: xBc, zacatek: yS, P: kusY.P, W, t: p.cepelT, presah: kusY.presah, zOstri: zE, kus: kusY, obracene: true });
      out.rozmery = { x: xMax, y: yMax, z: zHorni };
      out.souhrn = { kusy: [{ nazev: 'čepel příčná (kruhový řez)', ...kusX }, { nazev: 'čepel podélná', ...kusY }], yb };
      if (xA < xKap + kusX.kryteOd) out.upozorneni.push({ klic: 'cepel', text: 'Drážka zasahuje mimo jistě krytý úsek ostří.' });
      return out;
    }

    // plochý kabel
    const S = p.plochyS, H = p.plochyH, b = S + 2 * p.vuleDrazky, c = RZ[0].c, zDno = zE - c;
    const zHorni = Math.max(zMin, zDno + (1 - vycn) * H);
    const xA = p.stena, xc = xA + b / 2, xR = xc + p.posunRezu, xMax = xA + b + p.stena;
    const dk2 = dk, kusY = kusCepele(p, p.delkaPodel);
    const yS = p.pred, yKonecKapsy = yS + kusY.kapsa, yK = yKonecKapsy + 0.3 + dk2 / 2, yMax = yK + dk2 / 2 + okrajK;
    out.zony.push({ x0: 0, x1: xMax, y0: 0, y1: yMax, z1: zHorni });
    out.drazky.push({ profil: 'obdelnik', xc, sirka: b, zDno, y0: -1, y1: yMax + 1, vodic: 0 });
    out.vodice.push({ profil: 'obdelnik', xc, zDno, S, H, t: p.plochyT, y0: -18, y1: yMax + 18, nazev: 'kabel' });
    out.strbiny.push({ osa: 'Y', poloha: xR, od: yS, do: yMax + 1, z0, z1: zStrop, tl });
    out.koliky.push({ x: xR, y: yK, d: dk2 });
    out.cepele.push({ osa: 'Y', poloha: xR, zacatek: yS, P: kusY.P, W, t: p.cepelT, presah: kusY.presah, zOstri: zE, kus: kusY, obracene: true });
    out.rozmery = { x: xMax, y: yMax, z: zHorni };
    out.souhrn = { kusy: [{ nazev: 'čepel podélná', ...kusY }] };
    return out;
  }

  /* ---------- sešívačka ----------
     Rozmístění drážek podél šikmého horního ostří. Mezera mezi ostřími potřebná pro vodič i je
     g_i = D_i − 2c_i (spodní řez c_i určuje dno drážky, horní ostří má sahat o c_i pod vrch vodiče).
     Mezera podél šířky je přímka G0 + k·x; drážky (seřazené podle g) se kladou co nejtěsněji tak,
     aby |g_i − mezera(x_i)| ≤ tolerance. Hledá se největší sklon k (= nejkratší čelist). */
  function rozmistiPodelOstri(g, roztec, tol, kMax) {
    const n = g.length;
    const zkus = k => {
      const x = [0];
      for (let i = 1; i < n; i++) {
        let lo = x[i - 1] + roztec[i], hi = Infinity;
        if (k > 0) { lo = Math.max(lo, (g[i] - tol - g[0]) / k); hi = (g[i] + tol - g[0]) / k; }
        else if (Math.abs(g[i] - g[0]) > tol) return null;
        if (lo > hi + 1e-9) return null;
        x.push(lo);
      }
      return x;
    };
    if (n === 1) return { k: 0, x: [0] };
    let a = 0, b = kMax, nej = zkus(0) ? { k: 0, x: zkus(0) } : null;
    if (zkus(b)) return { k: b, x: zkus(b) };
    for (let it = 0; it < 50; it++) {               // největší proveditelné k (proveditelnost klesá s k)
      const m = (a + b) / 2, x = zkus(m);
      if (x) { a = m; nej = { k: m, x }; } else b = m;
    }
    if (!nej) { const k = 1e-3, x = zkus(k); if (x) nej = { k, x }; }
    return nej;
  }

  /* Obrys kusu čepele v rovině čepele [u, z] obecně: ostří od E0 délky P ve směru sklonu,
     hřbet posunutý o přesah podél ostří a o šířku W kolmo (smer +1 = hřbet dole, −1 = hřbet nahoře). */
  function obrysCepeleObecne(c) {
    const f = Math.atan(c.sklon || 0), d = [Math.cos(f), Math.sin(f)];
    const nrm = (c.smer || 1) > 0 ? [Math.sin(f), -Math.cos(f)] : [-Math.sin(f), Math.cos(f)];
    const E0 = [c.zacatek, c.zOstri], E1 = [E0[0] + c.P * d[0], E0[1] + c.P * d[1]];
    const H0 = [E0[0] + c.presah * d[0] + c.W * nrm[0], E0[1] + c.presah * d[1] + c.W * nrm[1]];
    const H1 = [H0[0] + c.P * d[0], H0[1] + c.P * d[1]];
    return [E0, E1, H1, H0];
  }

  /* Model pružného oblouku: pás délky L začíná v B s tečnou ve směru +Y (dozadu) a stáčí se nahoru
     (tvar „C“ za rameny). Ve tiskové poloze je to oblouk kružnice s úhlem Φ0 = π − θ; stisk přidá
     všude stejnou křivost θ/L, takže v sevřené poloze je oblouk půlkruh. Pro stisk φ ∈ ⟨0, θ⟩:
     úhel Φ = Φ0 + φ, poloměr L/Φ, bod v délce s: B + (L/Φ)·(sin a, 1 − cos a), a = Φ·s/L. */
  function bodOblouku(kl, phi, s, o) {
    const Phi = kl.Phi0 + phi, R = kl.L / Phi, a = Phi * s / kl.L, r = R + (o || 0);
    return [kl.B[0] + r * Math.sin(a), kl.B[1] + R - r * Math.cos(a), a];
  }

  function rozvrhniSesivacku(p) {
    const W = p.cepelW, tl = p.cepelT + p.vuleStrbiny, z0 = p.dno, zEL = z0 + W;
    const dk = p.kolik + 0.15, okrajK = 1.2, tol = p.tolerance;
    const out = { rezim: 'sesivacka', zE: zEL, z0, tl, zony: [], drazky: [], strbiny: [], koliky: [], cepele: [], vodice: [], rezy: [], upozorneni: [], chyby: [] };
    const k0 = p.podilRezu / 100, kor = p.korekce || 0;
    // vodiče seřazené podle potřebné mezery mezi ostřími
    const vod = p.vodice.map(v => {
      const c = k0 * v.t + kor, R = v.D / 2 + p.vuleDrazky;
      return { v, c, R, g: v.D - 2 * c };
    }).sort((a, b) => a.g - b.g);
    // Sklon omezit tak, aby ostří zůstala od sebe aspoň G_MIN i na levém konci kusů (šikmé ostří tam klesá):
    // vzdálenost od 1. drážky ke konci kusu ≈ přesah + vůle + W·k + R0 + 1,6 → k·(…) + W·k² ≤ g0 − G_MIN
    const G_MIN = 0.8, pr0 = p.cepelW / Math.tan(p.uhel * RAD), aa = W, bb = pr0 + p.vuleKapsy + vod[0].R + 1.6, cc = vod[0].g - G_MIN;
    const kStrop = cc <= 0 ? 0 : Math.min(0.25, (-bb + Math.sqrt(bb * bb + 4 * aa * cc)) / (2 * aa));
    const roz = rozmistiPodelOstri(vod.map(q => q.g), vod.map((q, i) => i ? vod[i - 1].R + q.R + p.stena : 0), tol, kStrop);
    if (!roz) { out.chyby.push({ klic: 'tolerance', text: 'Drážky nejde rozmístit podél šikmého ostří – zvětšete toleranci horního řezu nebo ubírejte vodiče se stejnou mezerou.' }); return out; }
    const k = roz.k, fi = Math.atan(k), cf = Math.cos(fi), sfi = Math.sin(fi);
    const G0 = vod[0].g;
    // čepele: společný kolík a začátek kapes; přesah kosodélníku u šikmé čepele o W·sin φ víc
    const xK = okrajK + dk / 2, xKap = xK + dk / 2 + 0.3;
    const sirkaZony = roz.x[roz.x.length - 1] + vod[vod.length - 1].R + vod[0].R + 1.2;
    const kusD = kusCepele(p, sirkaZony);
    const kusH = kusCepele(p, sirkaZony / cf + W * Math.tan(fi) + 0.3);
    const kryteOd = Math.max(kusD.kryteOd, kusH.kryteOd * cf + W * sfi);
    const xZ0 = xKap + kryteOd + 0.3, xZ1 = xZ0 + sirkaZony - 0.6;              // úsek, kde je čelist otevřená na ostří
    const x0 = xZ0 + 0.6 + vod[0].R - 0.3;
    const xs = roz.x.map(x => x0 + x);
    const mezera = x => G0 + k * (x - x0);
    const zU = x => zEL + mezera(x);
    const xKonecHp = xKap + (kusH.P + kusH.presah) * cf + W * sfi + p.vuleKapsy;
    const gMin = Math.min(mezera(xKap - 1), mezera(xKonecHp));                    // ostří se nesmí potkat po celé délce kusů
    if (gMin < 0.5 - 1e-9) out.chyby.push({ klic: 'podilRezu', text: 'Ostří by se mezi drážkami skoro dotýkala (mezera ' + fmt(gMin) + ' mm) – zmenšete hloubku řezu.' });
    const zJ = zEL + gMin / 2;                                                    // rovina dosednutí čelistí
    // kapsy
    const kapsaD = kusD.kapsa, xKonecD = xKap + kapsaD;
    const delkaH = (kusH.P + kusH.presah) * cf + W * sfi + p.vuleKapsy;           // průmět šikmého kusu na X
    const xKonecH = xKap + delkaH;
    const Bx = Math.max(xKonecD, xKonecH) + p.stena;
    const strop = x => zU(x) + W / cf;                                            // hřbet horní čepele (opora)
    const zTop = Math.max(strop(0), strop(Bx)) + 0.25 + p.dno;
    // Y: čelo, rovina čepelí, doraz, konec čelistí, ramena, list
    const yb = p.pred, L = p.delkaOdiz;
    const yDoraz = L > 0 ? yb + L : null;
    const yJ = (yDoraz !== null ? yDoraz : yb + 6) + p.stena;
    // drážky (válce přes obě čelisti) a vodiče
    vod.forEach((q, i) => {
      const dno = zEL - q.c, zc = dno + q.R;
      const cH = (dno + q.v.D) - zU(xs[i]);
      out.drazky.push({ profil: 'valec', xc: xs[i], sirka: 2 * q.R, zDno: dno, zStred: zc, y0: -1, y1: yDoraz === null ? yJ + 1 : yDoraz, vodic: i });
      out.vodice.push({ profil: 'kruh', xc: xs[i], zDno: dno, D: q.v.D, d: q.v.d, y0: -16, y1: yDoraz === null ? yJ + 4 : yDoraz, nazev: q.v.nazev });
      out.rezy.push({ nazev: q.v.nazev, t: q.v.t, c: q.c, cH, D: q.v.D, druh: 'shora i zespodu' });
      if (cH <= 0.05) out.chyby.push({ klic: 'tolerance', text: q.v.nazev + ': horní ostří by izolaci nenařízlo.' });
      else if (cH >= q.v.t) out.chyby.push({ klic: 'tolerance', text: q.v.nazev + ': horní řez ' + fmt(cH) + ' mm by prořízl izolaci ' + fmt(q.v.t) + ' mm.' });
      if (zJ <= dno + 0.3 || zJ >= dno + 2 * q.R - 0.3) out.chyby.push({ klic: 'podilRezu', text: q.v.nazev + ': rovina dosednutí čelistí míjí drážku.' });
    });
    // čepele
    const cD = { osa: 'X', poloha: yb, zacatek: xKap, P: kusD.P, W, t: p.cepelT, presah: kusD.presah, zOstri: zEL, kus: kusD, sklon: 0, smer: 1, dil: 'dolni' };
    // horní kus: nejlevější bod kosodélníku na začátku kapsy (hřbet je vlevo nahoře o W·sin φ dřív)
    const eX = xKap + Math.max(0, W * sfi - kusH.presah * cf);
    const cH = { osa: 'X', poloha: yb, zacatek: eX, P: kusH.P, W, t: p.cepelT, presah: kusH.presah, zOstri: zU(eX), kus: kusH, sklon: k, smer: -1, dil: 'horni' };
    out.cepele.push(cD, cH);
    // Štěrbiny jako mnohoúhelníky v rovině XZ (vytažené o tloušťku v Y). Zadní konec kapsy je šikmý
    // podle lomové rýhy kusu: kus se o něj opře a z druhé strany ho drží kolík – nevypadne ani
    // z otevřené čelisti (kus jde zasunout jen jednou stranou).
    const v = Math.min(p.vuleKapsy, 0.15);                                         // vůle u šikmé opory (malá = kus se málo viklá)
    const sikmo = c => { const o = obrysCepeleObecne(c), E1 = [o[1][0] + v, o[1][1]], H1 = [o[2][0] + v, o[2][1]];
      return z => E1[0] + (z - E1[1]) * (H1[0] - E1[0]) / (H1[1] - E1[1]); };
    const sD = sikmo(cD), sH = sikmo(cH);
    const pD = [[-1, z0], [sD(z0), z0], [sD(zEL + 0.1), zEL + 0.1], [-1, zEL + 0.1]];
    const pDz = [[xZ0, z0 + 0.5], [xZ1, z0 + 0.5], [xZ1, zJ + 0.5], [xZ0, zJ + 0.5]];
    const zSp = zJ - 0.5, xc = obrysCepeleObecne(cH)[2][0] + v;                      // horní konec šikmé opory = roh hřbetu
    const pH = [[-1, zSp], [sH(zSp), zSp], [xc, strop(xc)], [-1, strop(-1)]];
    out.strbiny.push({ osa: 'X', poloha: yb, od: -1, do: sD(z0), z0, z1: zEL + 0.1, tl, dil: 'dolni', polygony: [pD, pDz] });
    out.strbiny.push({ osa: 'X', poloha: yb, od: -1, do: xc, z0: zSp, z1: strop(0), tl, dil: 'horni', polygony: [pH] });
    out.koliky.push({ x: xK, y: yb, d: dk, z0: -1, z1: zJ + 0.01, dil: 'dolni' });
    out.koliky.push({ x: xK, y: yb, d: dk, z0: zJ - 0.01, z1: zTop + 1, dil: 'horni' });
    // kontrola pokrytí drážek oběma ostřími (i otočeným kusem)
    const pokr = (xa, xb) => xs.every((x, i) => x - vod[i].R >= xa - 1e-9 && x + vod[i].R <= xb + 1e-9);
    if (!pokr(xKap + kusD.kryteOd, xKap + kusD.P)) out.chyby.push({ klic: 'cepel', text: 'Spodní ostří nepokryje všechny drážky.' });
    if (!pokr(xKap + kusH.kryteOd * cf + W * sfi, xKap + kusH.P * cf)) out.chyby.push({ klic: 'cepel', text: 'Horní ostří nepokryje všechny drážky.' });
    const yRear = ramenaAKloub(p, out, { Bx, zJ, zTop, yJ, yG: (yb + (yDoraz !== null ? yDoraz : yb + 6)) / 2 });
    if (k > 0) out.upozorneni.push({ klic: 'tolerance', text: 'Horní čepel je skloněná o ' + fmt(fi / RAD) + '° (mezery mezi ostřími pro jednotlivé vodiče se liší).' });
    out.souhrn = { kusy: [{ nazev: 'čepel spodní', ...kusD }, { nazev: 'čepel horní (šikmá)', ...kusH }], delkaOdiz: L, yb, yDoraz, k, zJ, zTop, yJ, yRear };
    return out;
  }
  /* ---------- kleště s V-zářezem (a jemný odizolovač) ----------
     Rovina 1 (y = yA): spodní čepel A stoupá doprava, horní D je s ní rovnoběžná o h výš.
     Rovina 2 (y = yB): spodní B stoupá doleva, horní C rovnoběžně nad ní. Zepředu: V + Λ = kosočtverec
     s vrcholy (xc, zv) a (xc, zv + h); vepsaná kružnice má poloměr r = h·cos α / 2.
     Špička spodní čepele přesahuje rovinu dosednutí zJ – protější čelist má v rovině štěrbiny vybrání
     (pod ostřím horní čepele), takže špička zajede do štěrbiny té druhé; ostří v jedné rovině jsou
     rovnoběžná a nepotkají se. V sevřené poloze je kosočtverec nejmenší (h_c), větší vodiče se nastaví
     dorazovým šroubem (h = h_c + mezera).
     Kus čepele je ve štěrbině skloněný; špička (konec u zářezu) se opře o šikmý konec kapsy, kapsa
     pokračuje opačným směrem ven z čelisti (tudy se kus zasune) a tam ho drží kolík. */
  /* Vodorovný kolík (osa Y) za koncem šikmého kusu: na střednici štěrbiny, od koncové hrany kusu
     (úsečka K0–K1) vzdálený o polovinu průměru + 0,25 mm ve směru `ven`. */
  function kolikZaKoncem(K0, K1, ven, dk) {
    const fx = K1[0] - K0[0], fz = K1[1] - K0[1], l = Math.hypot(fx, fz), nf = [-fz / l, fx / l];
    const cosu = Math.abs(ven[0] * nf[0] + ven[1] * nf[1]) || 1e-6, s = (dk / 2 + 0.25) / cosu;
    return [(K0[0] + K1[0]) / 2 + s * ven[0], (K0[1] + K1[1]) / 2 + s * ven[1]];
  }

  function rozvrhniVKleste(p, rezim) {
    const W = p.cepelW, tl = p.cepelT + p.vuleStrbiny, al = p.uhelV * RAD, k = Math.tan(al), ca = Math.cos(al), sa = Math.sin(al);
    const dk = p.kolik + 0.15, okrajK = 1.2, m = 0.15, v = Math.min(p.vuleKapsy, 0.15);
    const out = { rezim, vsechnyCepele: true, zony: [], drazky: [], strbiny: [], koliky: [], cepele: [], vodice: [], rezy: [], upozorneni: [], chyby: [], nastaveni: [] };
    const vod = p.vodice.map(q => ({ v: q, r: q.d / 2 + p.zbytek, R: q.D / 2 })).sort((a, b) => a.r - b.r);
    const rMax = vod[vod.length - 1].r;
    const xDosah = rMax * sa + 0.4;                                                 // jak daleko za vrchol musí ostří sahat
    const hMin = Math.min(...vod.map(q => 2 * q.r / ca));
    const hC = Math.max(0.3, hMin - 0.4);                                           // výška kosočtverce při dosednutí čelistí (šroub na 0)
    // plast kanálu pod/nad ostřím, aby se vešla izolace i při nastavení pro daný vodič
    const pv = Math.max(0.4, ...vod.map(q => q.R / ca + 0.15 - (2 * q.r / ca) / 2));
    // kus čepele A (spodní, rovina 1): špička vpravo za vrcholem, zbytek ostří klesá doleva
    const kus = kusCepele(p, (xDosah + 2) / ca);
    const d = [ca, sa], nD = [sa, -ca];                                              // směr ostří A a normála k hřbetu (dolů)
    // A v souřadnicích s vrcholem v (0, 0): ostří od E0 do E1 = špička
    const E1 = [xDosah, k * xDosah], E0 = [E1[0] - kus.P * ca, E1[1] - kus.P * sa];
    const cA0 = { zacatek: E0[0], zOstri: E0[1], P: kus.P, W, presah: kus.presah, sklon: k, smer: 1 };
    const obrA0 = obrysCepeleObecne(cA0);
    // kapsa A: od šikmého konce u špičky (posunutého o v) daleko proti směru ostří (ven z čelisti)
    const posun = (b, t, a) => [b[0] + t * a[0], b[1] + t * a[1]];
    const Q1 = posun(posun(obrA0[1], v, d), -0.1, nD), Q2 = posun(obrA0[2], v, d);
    const kapsaA0 = [Q1, Q2, posun(Q2, -80, d), posun(Q1, -80, d)];
    // kolík: vodorovný (osa Y) za koncem kusu u E0, na střednici kapsy
    const osa0 = kolikZaKoncem(obrA0[0], obrA0[3], [-d[0], -d[1]], dk);
    // umístění: kolík i kus uvnitř čelisti
    const xc = Math.max(okrajK + dk / 2 - osa0[0], 1 - Math.min(...obrA0.map(b => b[0])), 10);
    const zMinA = Math.min(...obrA0.map(b => b[1]), osa0[1] - dk / 2 - 1);
    const zv = p.dno - zMinA;
    const zJ = zv + hC / 2, zTop = 2 * zJ, Bx = 2 * xc;
    // body: A posunuté o (xc, zv); B = zrcadlo A podle x = xc; D = středová souměrnost A podle (xc, zJ); C = souměrnost B
    const T = b => [b[0] + xc, b[1] + zv];
    const zrc = b => [2 * xc - b[0], b[1]];
    const sou = b => [2 * xc - b[0], 2 * zJ - b[1]];
    const kapA = kapsaA0.map(T), kapB = kapA.map(zrc), kapD = kapA.map(sou), kapC = kapB.map(sou);
    const kolA = T(osa0), kolB = zrc(kolA), kolD = sou(kolA), kolC = sou(kolB);
    const e = tl + 1.2, yb = p.pred + 1, yA = yb - e / 2, yB = yb + e / 2;
    const L = p.delkaOdiz, yDoraz = L > 0 ? yb + L : yb + 6;
    const ms = p.maticeS + 0.25, rSest = ms / Math.sqrt(3), ys = yDoraz + p.stena + rSest + 0.5;
    const yJ = ys + rSest + p.stena;
    // čepele (pro náhled a kontrolu) – kosodélníky v obou rovinách
    const cep = (obr, poloha, dil, sm) => ({ osa: 'X', poloha, W, t: p.cepelT, P: kus.P, presah: kus.presah, kus, dil, smer: sm, obrys: obr });
    const obrA = obrA0.map(T);
    out.cepele.push(cep(obrA, yA, 'dolni', 1), cep(obrA.map(zrc), yB, 'dolni', 1), cep(obrA.map(sou), yA, 'horni', -1), cep(obrA.map(zrc).map(sou), yB, 'horni', -1));
    out.strbiny.push({ osa: 'X', poloha: yA, tl, dil: 'dolni', polygony: [kapA] }, { osa: 'X', poloha: yB, tl, dil: 'dolni', polygony: [kapB] },
      { osa: 'X', poloha: yA, tl, dil: 'horni', polygony: [kapD] }, { osa: 'X', poloha: yB, tl, dil: 'horni', polygony: [kapC] });
    // kolíky zepředu (y od −1) až kousek za svou štěrbinu
    const kolY = (b, yPl, dil) => ({ osa: 'Y', x: b[0], z: b[1], y0: -1, y1: yPl + tl / 2 + 1.2, d: dk, dil });
    out.koliky.push(kolY(kolA, yA, 'dolni'), kolY(kolB, yB, 'dolni'), kolY(kolD, yA, 'horni'), kolY(kolC, yB, 'horni'));
    // dorazový šroub zespodu: otvor + šestihranná kapsa na matici
    out.koliky.push({ x: xc, y: ys, d: p.sroubD + 0.3, z0: -1, z1: zJ + 0.01, dil: 'dolni', sroub: true });
    out.koliky.push({ x: xc, y: ys, d: 2 * rSest, z0: -1, z1: 2.6, dil: 'dolni', sest: true });
    // kanál pro vodič: V ve spodní, Λ v horní čelisti (plast o pv za ostřími)
    const wv = (zJ + 0.6 - (zv - pv)) / k;
    out.drazky.push({ profil: 'prizmaY', dil: 'dolni', y0: -1, y1: yDoraz, polygon: [[xc - wv, zJ + 0.6], [xc, zv - pv], [xc + wv, zJ + 0.6]] });
    out.drazky.push({ profil: 'prizmaY', dil: 'horni', y0: -1, y1: yDoraz, polygon: [[xc - wv, zJ - 0.6], [xc, zv + hC + pv], [xc + wv, zJ - 0.6]] });
    // vybrání pro špičky protějších čepelí (rovina 1: D vlevo do spodní, A vpravo do horní; rovina 2 zrcadlově)
    const Ae = x => zv + k * (x - xc), De = x => zv + hC + k * (x - xc);
    const x1 = xc - 0.5, x2 = xc + xDosah + 2, x3 = xc - xDosah - 2, x4 = xc + 0.5;
    const vybH = [[x1, zJ - 0.6], [x2, zJ - 0.6], [x2, Math.max(De(x2), zJ - 0.5)], [x1, Math.max(De(x1), zJ - 0.5)]];
    const vybD = [[x3, Math.min(Ae(x3), zJ + 0.5)], [x4, Math.min(Ae(x4), zJ + 0.5)], [x4, zJ + 0.6], [x3, zJ + 0.6]];
    out.strbiny[0].polygony.push(vybD); out.strbiny[2].polygony.push(vybH);
    out.strbiny[1].polygony.push(vybD.map(zrc)); out.strbiny[3].polygony.push(vybH.map(zrc));
    if (2 * wv > Bx - 2) out.chyby.push({ klic: 'uhelV', text: 'Kanál pro vodič je širší než čelisti – zvětšete sklon ostří.' });
    const yRear = ramenaAKloub(p, out, { Bx, zJ, zTop, yJ, yG: yb });
    // nastavení: mezera čelistí u čepelí → natočení oblouku → vysunutí šroubu
    const kl = out.kloub;
    const mezera = (phi, y) => bodPoloha(kl, phi, [y, zJ])[1] - zJ;
    const mezMax = mezera(0, yb);
    const najdiPhi = g => { let a = 0, b = kl.th; for (let i = 0; i < 60; i++) { const c = (a + b) / 2; if (mezera(c, yb) > g) a = c; else b = c; } return (a + b) / 2; };
    vod.forEach((q, i) => {
      const h = 2 * q.r / ca, g = h - hC;
      let otacky = null, vysun = null;
      if (g > mezMax - 1) out.chyby.push({ klic: 'uhelOtevreni', text: q.v.nazev + ': kleště se pro něj málo rozevřou – zvětšete rozevření.' });
      else { const phi = najdiPhi(g); vysun = mezera(phi, ys); otacky = vysun / p.stoupani; }
      const c = q.R - q.r;
      out.nastaveni.push({ nazev: q.v.nazev, d: q.v.d, D: q.v.D, t: q.v.t, r: q.r, h, mezera: g, vysun, otacky, c });
      out.rezy.push({ nazev: q.v.nazev, t: q.v.t, c, D: q.v.D, druh: '4 řezy (V)' });
    });
    // vodič k náhledu: první z tabulky, ve středu kosočtverce pro jeho nastavení
    const q0 = vod[0];
    out.vodice.push({ profil: 'kruh', xc, zDno: zv + q0.r / ca - q0.R, D: q0.v.D, d: q0.v.d, y0: -14, y1: yDoraz, nazev: q0.v.nazev });
    out.zE = zv; out.z0 = 0; out.tl = tl;
    const delkaSroubu = Math.ceil((zJ + 1 + Math.max(0, ...out.nastaveni.map(n => n.vysun || 0))) / 2) * 2;
    out.souhrn = { kusy: [{ nazev: 'čepele (4 kusy)', ...kus }], yb, yA, yB, yDoraz, delkaOdiz: L, zJ, zTop, zv, hC, xc, k, al, pv, ys, yJ, yRear,
      sroub: { d: p.sroubD, delka: delkaSroubu, stoupani: p.stoupani }, mezMax,
      rozsah: [Math.max(0, hC * ca - 2 * p.zbytek), 2 * (rMax - p.zbytek)] };
    return out;
  }

  /* ---------- objímka na podélný řez ----------
     Kabel leží napříč čelistí (podél X) ve válcové drážce, která je půl v každé čelisti.
     Kus čepele stojí v rovině y = yg skloněný o β: nejvýš je jeho ostrý roh (úhel lomové rýhy),
     který vyčnívá nad dno drážky právě o hloubku řezu c; ostří od špičky klesá doleva pod dno,
     takže je odkrytá jen špička (asi c / sin β ostří). Kabel se táhne ve směru +X (šipka na horní
     čelisti ukazuje opačně: směr posunu objímky po kabelu) – plášť najíždí na ostří zleva a špička ho podélně rozpárá. Kus se zasouvá zvenku
     špičkou napřed, opře se o šikmý konec kapsy u špičky a z druhé strany ho drží kolík. */
  function rozvrhniPodelny(p) {
    const W = p.cepelW, tl = p.cepelT + p.vuleStrbiny;
    const dk = p.kolik + 0.15, okrajK = 1.2, v = Math.min(p.vuleKapsy, 0.15);
    const out = { rezim: 'podelny', z0: p.dno, tl, zony: [], drazky: [], strbiny: [], koliky: [], cepele: [], vodice: [], rezy: rezy('podelny', p), upozorneni: [], chyby: [] };
    const D = p.kabelD, R = D / 2 + p.vuleDrazky, c = out.rezy[0].c;
    const be = p.sklonCepele * RAD, d = [-Math.cos(be), -Math.sin(be)], nD = [Math.sin(be), -Math.cos(be)];  // ostří od špičky dolů doleva, hřbet pod ním
    const kus = kusCepele(p, 3);
    const posun = (b, t, a) => [b[0] + t * a[0], b[1] + t * a[1]];
    // kus se špičkou v (0, 0): E0 = špička, E1 na konci ostří, H0/H1 hřbet (ostrý roh = E0)
    const E0 = [0, 0], E1 = posun(E0, kus.P, d), H0 = posun(posun(E0, kus.presah, d), W, nD), H1 = posun(H0, kus.P, d);
    const obr0 = [E0, E1, H1, H0];
    // kapsa: od šikmého konce u špičky (o v dál) daleko proti špičce ven z čelisti
    const Q1 = posun(posun(E0, -v, d), -0.1, nD), Q2 = posun(H0, -v, d);
    const kap0 = [Q1, Q2, posun(Q2, 80, d), posun(Q1, 80, d)];
    const kol0 = kolikZaKoncem(E1, H1, d, dk);                                      // vodorovný kolík za koncem kusu
    const xMin = Math.min(...obr0.map(b => b[0]), kol0[0] - dk / 2 - okrajK + 1);
    const xT = Math.max(okrajK + dk / 2 - kol0[0], 1 - xMin, 4);                    // poloha špičky v X
    const zMin = Math.min(...obr0.map(b => b[1]), kol0[1] - dk / 2 - 1);
    const zT = p.dno - zMin;                                                         // výška špičky nad spodní plochou
    const zDno = zT - c, zc = zDno + R, zJ = zc, zTop = zc + R + Math.max(3, p.dno);
    const T = b => [b[0] + xT, b[1] + zT];
    const Bx = xT + Math.max(8, p.stena + 6);
    const yg = p.pred + R, yJ = yg + R + p.stena;
    const obr = obr0.map(T);
    out.zE = zT;
    out.cepele.push({ osa: 'X', poloha: yg, W, t: p.cepelT, P: kus.P, presah: kus.presah, kus, zOstri: zT, xSpicka: xT, sklonCepele: be, smer: 1, dil: 'dolni', obrys: obr });
    out.strbiny.push({ osa: 'X', poloha: yg, tl, dil: 'dolni', polygony: [kap0.map(T)] });
    const kol = T(kol0);
    out.koliky.push({ osa: 'Y', x: kol[0], z: kol[1], y0: -1, y1: yg + tl / 2 + 1.2, d: dk, dil: 'dolni' });
    out.drazky.push({ profil: 'valecX', yc: yg, zStred: zc, sirka: 2 * R, zDno, x0: -1, x1: Bx + 1, xc: Bx / 2 });
    out.vodice.push({ profil: 'kruhX', yc: yg, zDno, D, d: D - 2 * p.kabelT, x0: -18, x1: Bx + 18, xc: Bx / 2, nazev: 'kabel' });
    // šipka směru posunu objímky po kabelu (= opačně než tah kabelu) vyrytá na horní čelisti (sevřená poloha, z = zTop)
    const ay = (p.pred + yJ) / 2 + R * 0.2, aw = Math.min(2.4, (yJ - 2) / 4), ax0 = 2, ax1 = Bx - 2, ah = Math.min(5, (ax1 - ax0) / 3);
    out.drazky.push({ profil: 'rytiZ', dil: 'horni', z0: zTop - 0.6, z1: zTop + 1, polygon: [[ax0, ay - aw / 2], [ax1 - ah, ay - aw / 2], [ax1 - ah, ay - aw * 1.4], [ax1, ay], [ax1 - ah, ay + aw * 1.4], [ax1 - ah, ay + aw / 2], [ax0, ay + aw / 2]].map(([x, y]) => [ax0 + ax1 - x, y]) });
    if (kol[1] + dk / 2 > zDno - 0.6) out.chyby.push({ klic: 'dno', text: 'Kolík by zasahoval do drážky.' });
    const delkaSpicky = c / Math.sin(be);
    if (be < 10 * RAD) out.upozorneni.push({ klic: 'sklonCepele', text: 'Při malém sklonu je odkrytá dlouhá část ostří (' + fmt(delkaSpicky) + ' mm).' });
    ramenaAKloub(p, out, { Bx, zJ, zTop, yJ, yG: yg });
    out.souhrn = { kusy: [{ nazev: 'čepel podélná (šikmo, špička)', ...kus }], zJ, zTop, yg, yJ, delkaSpicky, xT, sklon: be, smerPosunu: -1 };
    if (p.provedeni !== 'levak') zrcadlitX(out, Bx);
    return out;
  }

  /* Zrcadlení rozvržení podle roviny x = Bx/2 (provedení pro praváky / leváky). Obrysy kusů si
     zachovají pořadí rohů (E0 = špička), mění se jen x. */
  function zrcadlitX(out, Bx) {
    const zx = x => Bx - x, zb = b => [zx(b[0]), b[1]];
    for (const c of out.cepele) c.obrys = c.obrys.map(zb);
    for (const s of out.strbiny) s.polygony = s.polygony.map(q => q.map(zb));
    for (const k of out.koliky) k.x = zx(k.x);
    for (const g of out.drazky) { if (g.polygon) g.polygon = g.polygon.map(([x, y]) => [zx(x), y]); if (g.xc !== undefined) g.xc = zx(g.xc); }
    for (const v of out.vodice) v.xc = zx(v.xc);
    out.souhrn.xT = zx(out.souhrn.xT);
    out.souhrn.smerPosunu = -out.souhrn.smerPosunu;
    for (const c of out.cepele) if (c.xSpicka !== undefined) c.xSpicka = zx(c.xSpicka);
  }

  /* ---------- měrka ---------- */
  function seznamCisel(t) {
    return String(t || '').split(/[;\s]+/).map(x => cislo(x)).filter(x => Number.isFinite(x) && x > 0)
      .filter((x, i, a) => a.indexOf(x) === i).slice(0, 14);
  }
  /* Sedmisegmentové číslice z obdélníků (rytí bez písma): [x0, y0, x1, y1] v mm, levý dolní roh textu (x, y). */
  const SEGMENTY = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g' };
  function sirkaTextu(t, H) { let w = 0; for (const ch of t) w += ch === ',' || ch === '.' ? 0.35 * H : 0.75 * H; return Math.max(0, w - 0.2 * H); }
  function textObdelniky(t, x, y, H) {
    const w = 0.55 * H, s = Math.max(0.45, 0.14 * H), h2 = H / 2, out = [];
    const seg = { a: [0, H - s, w, H], b: [w - s, h2, w, H], c: [w - s, 0, w, h2], d: [0, 0, w, s], e: [0, 0, s, h2], f: [0, h2, s, H], g: [0, h2 - s / 2, w, h2 + s / 2] };
    let cx = x;
    for (const ch of t) {
      if (ch === ',' || ch === '.') { out.push([cx + 0.05 * H, y - 0.12 * H, cx + 0.05 * H + s, y + s]); cx += 0.35 * H; continue; }
      for (const sg of (SEGMENTY[ch] || '')) { const r = seg[sg]; out.push([cx + r[0], y + r[1], cx + r[2], y + r[3]]); }
      cx += 0.75 * H;
    }
    return out;
  }
  function rozvrhniMerku(p) {
    const out = { rezim: 'merka', otvory: [], kanaly: [], texty: [], ryhy: [], upozorneni: [], chyby: [], rezy: [], cepele: [], drazky: [], vodice: [], zony: [] };
    const H = p.vyskaPisma, m = 3, tabulka = JADRA[p.druhJadra].d;
    const pr = seznamCisel(p.prurezy).filter(x => tabulka[fmt(x)]).sort((a, b) => a - b), dl = seznamCisel(p.delky).sort((a, b) => a - b);
    // řada drážek na délku (od přední hrany y = 0)
    let x = m;
    const w = p.sirkaKanalu, Lmax = dl.length ? Math.max(...dl) : 0;
    for (const L of dl) {
      const t = fmt(L), sloupec = Math.max(w + 2.4, sirkaTextu(t, H) + 0.6 * H);
      const xc = x + sloupec / 2;
      out.kanaly.push({ xc, w, L, hloubka: p.hloubkaKanalu });
      out.texty.push({ text: t, x: xc - sirkaTextu(t, H) / 2, y: L + 1.5, H });
      x += sloupec;
    }
    const sirkaKanalu = x + m;
    // řada otvorů za drážkami
    const yOtv0 = (dl.length ? Lmax + 1.5 + H + 2.5 : m);
    let dMax = 0; x = m;
    for (const s of pr) {
      const dJ = tabulka[fmt(s)], dO = dJ + p.vuleJadra + p.korekceOtvoru, t = fmt(s);
      const sloupec = Math.max(dO + 2.4, sirkaTextu(t, H) + 0.6 * H), xc = x + sloupec / 2;
      out.otvory.push({ x: xc, prurez: s, dJ, d: dO, text: t });
      dMax = Math.max(dMax, dO);
      x += sloupec;
    }
    const sirkaOtvoru = x + m;
    const yOtv = yOtv0 + dMax / 2;
    for (const o of out.otvory) { o.y = yOtv; out.texty.push({ text: o.text, x: o.x - sirkaTextu(o.text, H) / 2, y: yOtv + dMax / 2 + 1.2, H }); }
    let Y = pr.length ? yOtv + dMax / 2 + 1.2 + H + m : yOtv0 + m - 2.5;
    // pravítko u zadní hrany
    let X = Math.max(sirkaKanalu, sirkaOtvoru, 30);
    if (p.pravitko > 0) {
      X = Math.max(X, p.pravitko + 2 * m);
      const y1 = Y + 6, H2 = Math.min(H, 3.2);
      for (let i = 0; i <= p.pravitko; i++) {
        const delka = i % 10 === 0 ? 4 : i % 5 === 0 ? 3 : 1.8;
        out.ryhy.push([m + i - 0.2, y1 - delka, m + i + 0.2, y1 + 0.01]);
        if (i % 10 === 0) { const t = String(i); out.texty.push({ text: t, x: m + i - sirkaTextu(t, H2) / 2, y: y1 - 4 - 1 - H2, H: H2 }); }
      }
      // čísla pravítka jsou pod ryskami: posunout pravítko tak, aby se vešla
      const posun = H2 + 1.5;
      for (const r of out.ryhy) { r[1] += posun; r[3] += posun; }
      for (const t of out.texty.slice(-Math.floor(p.pravitko / 10) - 1)) t.y += posun;
      Y = y1 + posun + 0.01;
      out.pravitko = { x0: m, delka: p.pravitko, y: Y };
    }
    out.deska = { x: X, y: Y, z: p.tlDesky };
    out.hloubkaPisma = p.hloubkaPisma;
    if (p.hloubkaKanalu > p.tlDesky - 1) out.chyby.push({ klic: 'hloubkaKanalu', text: 'Drážka je hlubší, než dovolí destička (nechte aspoň 1 mm dna).' });
    if (p.hloubkaPisma > p.tlDesky - 1) out.chyby.push({ klic: 'hloubkaPisma', text: 'Rytí je hlubší, než dovolí destička.' });
    // obdélníky rytí
    out.obdelniky = [];
    for (const t of out.texty) for (const r of textObdelniky(t.text, t.x, t.y, t.H)) out.obdelniky.push(r);
    for (const r of out.ryhy) out.obdelniky.push(r);
    for (const r of out.obdelniky) if (r[0] < 0.5 || r[2] > X - 0.5 || r[1] < 0.5 || r[3] > Y - 0.5) { out.upozorneni.push({ klic: 'vyskaPisma', text: 'Některé číslice sahají k okraji destičky.' }); break; }
    out.rozmery = { x: X, y: Y, z: p.tlDesky };
    out.souhrn = { kusy: [] };
    return out;
  }

  /* Společné tělo nástrojů s kloubem: ramena (plná výška jen v čelistech) a pružný oblouk „C“ vzadu.
     Doplní out.zony (čelisti), out.profil, out.kloub, out.rozmery, chyby a upozornění. Vrací yRear. */
  function ramenaAKloub(p, out, o) {
    const { Bx, zJ, zTop, yJ } = o;
    const yRear = Math.max(yJ + 8, p.delkaRamen);
    const th = p.uhelOtevreni * RAD, tf = p.tlListu;
    const hRd = Math.max(tf + 0.5, p.tlRamen), hRh = hRd;                          // tloušťka zadních částí ramen
    // oblouk: dole začíná na konci spodního ramena (lícuje se spodní plochou), nahoře končí na konci horního
    const B = [yRear, tf / 2], Tc = [yRear, zTop - tf / 2];                        // Tc = konec oblouku v sevřené poloze
    const R1 = (Tc[1] - B[1]) / 2, Lf = Math.PI * R1, Phi0 = Math.PI - th, R0 = Lf / Phi0;
    const Tp = [B[0] + R0 * Math.sin(Phi0), B[1] + R0 * (1 - Math.cos(Phi0))];      // konec oblouku ve tiskové poloze
    if (p.tlRamen < tf + 0.5) out.upozorneni.push({ klic: 'tlRamen', text: 'Ramena za čelistmi zesíleny na ' + fmt(hRd) + ' mm (oblouk musí lícovat s ramenem).' });
    if (hRd + hRh > zTop - 1) out.chyby.push({ klic: 'tlRamen', text: 'Ramena za čelistmi jsou tak tlustá, že by se dotýkala – zeslabte je.' });
    if (zJ - 0.5 < 1 || zTop - zJ < 1.5) out.chyby.push({ klic: 'dno', text: 'Čelisti vycházejí příliš tenké.' });
    out.zony.push({ x0: 0, x1: Bx, y0: 0, y1: yJ, z0: 0, z1: zJ, dil: 'dolni' });
    out.zony.push({ x0: 0, x1: Bx, y0: 0, y1: yJ, z0: zJ, z1: zTop, dil: 'horni' });
    out.profil = {
      dolni: [[0, 0], [yRear + 0.3, 0], [yRear + 0.3, Math.min(hRd, zJ - 0.5)], [yJ, Math.min(hRd, zJ - 0.5)], [yJ, zJ], [0, zJ]],
      horni: [[0, zJ], [yJ, zJ], [yJ, Math.max(zTop - hRh, zJ + 0.5)], [yRear + 0.3, Math.max(zTop - hRh, zJ + 0.5)], [yRear + 0.3, zTop], [0, zTop]]
    };
    const mat = MATERIALY[p.materialListu] || MATERIALY.PETG;
    const I = Bx * tf ** 3 / 12, eps = tf * th / (2 * Lf), M = mat.E * I * th / Lf;
    const F = M / Math.max(1, B[0] - o.yG);
    out.kloub = { B, Lf, L: Lf, R0, R1, Phi0, tf, th, Tc, Tp, Bx, eps, epsDov: mat.epsDov, M, F, material: p.materialListu,
      posunY: Tc[0] - Tp[0], posunZ: Tc[1] - Tp[1], otevreniCelo: 0, naBoku: true };
    out.kloub.otevreniCelo = bodTisk(out.kloub, [0, zJ])[1] - zJ;                   // rozevření u čela v tiskové poloze
    if (eps > mat.epsDov) out.upozorneni.push({ klic: 'tlListu', text: 'Pružný oblouk se při stisku přetvoří o ' + fmt(eps * 100) + ' % – pro ' + p.materialListu + ' je bezpečné asi ' + fmt(mat.epsDov * 100) + ' %. Zeslabte ho nebo zmenšete rozevření.' });
    out.rozmery = { x: Bx, y: B[0] + R0 + tf / 2, z: zTop };
    return yRear;
  }
  /* Poloha horního ramena při natočení oblouku φ ∈ ⟨0, θ⟩ (0 = tisková poloha, θ = sevřeno):
     bod ze sevřené polohy (y, z) → p' = konec(φ) + R(φ − θ)(p − Tc). */
  function bodPoloha(kl, phi, b) {
    const tip = bodOblouku(kl, phi, kl.L), a = phi - kl.th, c = Math.cos(a), s = Math.sin(a);
    const dy = b[0] - kl.Tc[0], dz = b[1] - kl.Tc[1];
    return [tip[0] + c * dy - s * dz, tip[1] + s * dy + c * dz];
  }

  /* bod horního ramena ze sevřené polohy (y, z) do tiskové polohy: rotace o −θ kolem Tc a posun do Tp */
  function bodTisk(kl, b) {
    const dy = b[0] - kl.Tc[0], dz = b[1] - kl.Tc[1], c = Math.cos(-kl.th), s = Math.sin(-kl.th);
    return [kl.Tp[0] + c * dy - s * dz, kl.Tp[1] + s * dy + c * dz];
  }

  /* Analytický průřez drážky v rovině čepele: kde leží vodič, kam sahá ostří, co zbývá. */
  function rozborDrazky(roz, i) {
    const g = roz.drazky[i], r = roz.rezy[Math.min(i, roz.rezy.length - 1)];
    const c = roz.zE - g.zDno;
    const o = { c, zbytek: r.t - c, podil: c / r.t, t: r.t };
    if (r.cH !== undefined) { o.cH = r.cH; o.zbytek = r.t - Math.max(c, r.cH); o.podil = Math.max(c, r.cH) / r.t; }
    return o;
  }

  /* ---------- sítě, STL ---------- */
  function sitZMeshe(mesh) {
    const np = mesh.numProp, vp = mesh.vertProperties, n = vp.length / np;
    const poz = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) { poz[i * 3] = vp[i * np]; poz[i * 3 + 1] = vp[i * np + 1]; poz[i * 3 + 2] = vp[i * np + 2]; }
    return { poz, idx: Uint32Array.from(mesh.triVerts) };
  }
  function zkontrolujSit(sit) {
    const { poz, idx } = sit, hrany = new Map();
    let objem = 0, degen = 0, chybnych = 0;
    const nt = idx.length / 3;
    for (let t = 0; t < nt; t++) {
      const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
      if (a === b || b === c || a === c) { degen++; continue; }
      const ax = poz[a * 3], ay = poz[a * 3 + 1], az = poz[a * 3 + 2];
      const bx = poz[b * 3], by = poz[b * 3 + 1], bz = poz[b * 3 + 2];
      const cx = poz[c * 3], cy = poz[c * 3 + 1], cz = poz[c * 3 + 2];
      objem += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
      for (const [i, j] of [[a, b], [b, c], [c, a]]) {
        const k = i < j ? i + ',' + j : j + ',' + i, smer = i < j ? 1 : -1;
        const z = hrany.get(k);
        if (!z) hrany.set(k, { n: 1, s: smer }); else { z.n++; z.s += smer; }
      }
    }
    for (const z of hrany.values()) if (z.n !== 2 || z.s !== 0) chybnych++;
    return { vodotesna: chybnych === 0 && hrany.size > 0, chybnychHran: chybnych, trojuhelniku: nt, degenerovanych: degen, objem };
  }
  function stlBinarni(sit, nazev) {
    const { poz, idx } = sit, nt = idx.length / 3;
    const buf = new ArrayBuffer(84 + 50 * nt), dv = new DataView(buf);
    const hl = ('Odizolovac - ' + (nazev || 'dil')).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '-').slice(0, 79);
    for (let i = 0; i < hl.length; i++) dv.setUint8(i, hl.charCodeAt(i));
    dv.setUint32(80, nt, true);
    let o = 84;
    for (let t = 0; t < nt; t++) {
      const v = [0, 1, 2].map(k => { const i = idx[t * 3 + k]; return [poz[i * 3], poz[i * 3 + 1], poz[i * 3 + 2]]; });
      const ux = v[1][0] - v[0][0], uy = v[1][1] - v[0][1], uz = v[1][2] - v[0][2];
      const wx = v[2][0] - v[0][0], wy = v[2][1] - v[0][1], wz = v[2][2] - v[0][2];
      let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true); o += 12;
      for (const b of v) { dv.setFloat32(o, b[0], true); dv.setFloat32(o + 4, b[1], true); dv.setFloat32(o + 8, b[2], true); o += 12; }
      dv.setUint16(o, 0, true); o += 2;
    }
    return buf;
  }

  function fmt(x, des) {
    if (!Number.isFinite(x)) return x > 0 ? '∞' : '–';
    if (des === undefined) des = Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : 2;
    let s = x.toFixed(des);
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s === '-0') s = '0';
    return s.replace('.', ',').replace('-', '−');
  }

  const api = { KLOUB, VK, SVODICI, VODICE_JEMNE, VYCHOZI_JEMNE, JADRA, seznamCisel, textObdelniky, sirkaTextu, REZIMY, CEPELE, VODICE, VYCHOZI_VODICE, KABELY, PLOCHE, MATERIALY, PARAMETRY, PODLE_KLICE, RAD,
    vychozi, cislo, normalizuj, rezy, kusCepele, rozvrhni, rozborDrazky, rozmistiPodelOstri, obrysCepeleObecne, bodOblouku, bodTisk, bodPoloha, sitZMeshe, zkontrolujSit, stlBinarni, fmt };
  if (typeof module !== 'undefined') module.exports = api; else window.ODIZ = api;
})();

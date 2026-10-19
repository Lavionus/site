/* ============================================================
   plc/priklady.js – vzorové projekty (Ladder programy + vazba na proces).
   Každá funkce vrací nový projekt s čerstvými id.
   ============================================================ */
(function () {
  'use strict';
  const PLC = typeof module !== 'undefined' ? require('./jadro.js') : window.PLC;
  const { B } = PLC;
  const { NO, NC, P, PAR, CIVKA, SET, RESET, TON, TOF, CTU, RES, PRICKA, CMP, MOVE, ADD, MUL, SCALE, LIMIT, PID, CALL, FB } = B;
  const zaklad = (nazev, popis, proces, perioda, symboly, vstupy, pricky) =>
    Object.assign(PLC.novyProjekt(nazev), { popis, proces, perioda, symboly, vstupy: vstupy || {}, pricky });

  const PRIKLADY = [
    {
      id: 'uvod', nazev: 'Úvod: kontakty, samodržení, časovače',
      vytvor: () => zaklad('Úvod do Ladder diagramu',
        'Každá příčka ukazuje jeden základní obrat. Vstupy přepínejte vpravo (nebo klávesami 1–8 pro I0.0–I0.7).',
        'zadny', 100,
        { 'I0.0': 'TL_A', 'I0.1': 'TL_B', 'I0.2': 'START', 'I0.3': 'STOP', 'I0.4': 'PODM_1', 'I0.5': 'PODM_2', 'I0.6': 'TL_PREP', 'I0.7': 'SPINAC',
          'I1.0': 'IMPULZ', 'I1.1': 'NULUJ', 'Q0.0': 'LAMPA_A', 'Q0.1': 'LAMPA_NEG', 'Q0.2': 'MOTOR', 'Q0.3': 'LAMPA_AND',
          'Q0.4': 'LAMPA_PREP', 'Q0.5': 'LAMPA_TON', 'Q0.6': 'LAMPA_TOF', 'Q0.7': 'LAMPA_POCET', 'M1.0': 'HRANA' },
        { 'I0.4': 'prepinac', 'I0.5': 'prepinac', 'I0.7': 'prepinac' },
        [
          PRICKA('Přímé přiřazení: výstup kopíruje vstup', [NO('I0.0')], [CIVKA('Q0.0')]),
          PRICKA('Rozpínací kontakt: lampa svítí, dokud tlačítko NENÍ stisknuté', [NC('I0.1')], [CIVKA('Q0.1')]),
          PRICKA('Samodržení: START sepne motor, kontakt Q0.2 ho podrží, STOP (rozpínací) přeruší', [PAR([NO('I0.2')], [NO('Q0.2')]), NC('I0.3')], [CIVKA('Q0.2')]),
          PRICKA('Logický součin AND: obě podmínky zároveň', [NO('I0.4'), NO('I0.5')], [CIVKA('Q0.3')]),
          PRICKA('Náběžná hrana: jednorázový impulz na jeden cyklus', [P('I0.6')], [CIVKA('M1.0')]),
          PRICKA('Přepínání jedním tlačítkem (impulz × stav = XOR)', [PAR([NO('M1.0'), NC('Q0.4')], [NC('M1.0'), NO('Q0.4')])], [CIVKA('Q0.4')]),
          PRICKA('TON: lampa se rozsvítí 2 s po sepnutí spínače', [NO('I0.7')], [TON('T0', 2000)]),
          PRICKA('', [NO('T0')], [CIVKA('Q0.5')]),
          PRICKA('TOF: lampa zhasne až 2 s po vypnutí spínače', [NO('I0.7')], [TOF('T1', 2000)]),
          PRICKA('', [NO('T1')], [CIVKA('Q0.6')]),
          PRICKA('CTU: po třech impulzech se rozsvítí lampa', [NO('I1.0')], [CTU('C0', 3)]),
          PRICKA('', [NO('C0')], [CIVKA('Q0.7')]),
          PRICKA('Nulování čítače', [NO('I1.1')], [RES('C0')])
        ])
    },
    {
      id: 'dopravnik', nazev: 'Dopravník s počítáním kusů',
      vytvor: () => zaklad('Dopravník – dávka 5 krabic',
        'START rozběhne pás (samodržení), STOP ho zastaví. Podavač posílá krabice v taktu 3,5 s (generátor ze dvou TON). Závora na konci počítá krabice čítačem CTU; po pěti kusech se pás zastaví a rozsvítí se „Dávka hotová“. Tlačítko Nulování počtu dávku vynuluje.',
        'dopravnik', 100,
        { 'I0.0': 'START', 'I0.1': 'STOP', 'I0.2': 'ZAVORA', 'I0.3': 'NULOVANI', 'Q0.0': 'MOTOR', 'Q0.1': 'DAVKA_OK', 'Q0.2': 'PODAVAC', 'T0': 'TAKT', 'T1': 'IMPULZ', 'C0': 'POCET' },
        {},
        [
          PRICKA('Motor pásu: samodržení, STOP a konec dávky ho vypnou', [PAR([NO('I0.0')], [NO('Q0.0')]), NC('I0.1'), NC('C0')], [CIVKA('Q0.0')]),
          PRICKA('Takt podavače: T0 odměří 3 s chodu pásu', [NO('Q0.0'), NC('T1')], [TON('T0', 3000)]),
          PRICKA('Impulz podavače 0,5 s; pak T1 vynuluje T0 a takt začne znovu', [NO('T0')], [TON('T1', 500), CIVKA('Q0.2')]),
          PRICKA('Každá krabice na závoře přičte 1 (počítá se náběžná hrana)', [NO('I0.2')], [CTU('C0', 5)]),
          PRICKA('Dávka hotová', [NO('C0')], [CIVKA('Q0.1')]),
          PRICKA('Nulování počtu', [NO('I0.3')], [RES('C0')])
        ])
    },
    {
      id: 'semafor', nazev: 'Semafor s tlačítkem pro chodce',
      vytvor: () => zaklad('Semafor na přechodu',
        'Stisk tlačítka chodce uloží požadavek (S/R paměť M0.0). Řetězec šesti časovačů TON pak řídí fáze: zelená autům ještě 2 s → oranžová 2 s → mezičas 1 s → zelená chodcům 5 s → vyklizení 2 s → červená s oranžovou 1,5 s. V nočním režimu bliká oranžová (generátor T6/T7).',
        'semafor', 100,
        { 'I0.0': 'TL_CHODEC', 'I0.1': 'NOC', 'Q0.0': 'AUTA_CERV', 'Q0.1': 'AUTA_ORAN', 'Q0.2': 'AUTA_ZEL', 'Q0.3': 'CHOD_CERV', 'Q0.4': 'CHOD_ZEL', 'Q0.5': 'CEKEJTE',
          'M0.0': 'POZADAVEK', 'T0': 'F1_ZELENA', 'T1': 'F2_ORANZ', 'T2': 'F3_MEZICAS', 'T3': 'F4_CHODCI', 'T4': 'F5_VYKLIZ', 'T5': 'F6_CERV_OR', 'T6': 'BLIK_A', 'T7': 'BLIK_B' },
        {},
        [
          PRICKA('Požadavek chodce se uloží (jen ve dne)', [NO('I0.0'), NC('I0.1')], [SET('M0.0')]),
          PRICKA('Noční režim požadavek zruší', [NO('I0.1')], [RESET('M0.0')]),
          PRICKA('Fáze 1: autům svítí zelená ještě 2 s', [NO('M0.0')], [TON('T0', 2000)]),
          PRICKA('Fáze 2: oranžová 2 s', [NO('T0')], [TON('T1', 2000)]),
          PRICKA('Fáze 3: bezpečnostní mezičas 1 s (vše červené)', [NO('T1')], [TON('T2', 1000)]),
          PRICKA('Fáze 4: zelená chodcům 5 s', [NO('T2')], [TON('T3', 5000)]),
          PRICKA('Fáze 5: vyklizení přechodu 2 s', [NO('T3')], [TON('T4', 2000)]),
          PRICKA('Fáze 6: červená s oranžovou 1,5 s', [NO('T4')], [TON('T5', 1500)]),
          PRICKA('Konec cyklu: zrušení požadavku vynuluje celý řetězec', [NO('T5')], [RESET('M0.0')]),
          PRICKA('Auta – zelená', [NC('T0'), NC('I0.1')], [CIVKA('Q0.2')]),
          PRICKA('Auta – oranžová: fáze 2, fáze 6 a blikání v noci', [PAR([NO('T0'), NC('T1')], [NO('T4')], [NO('I0.1'), NO('T6')])], [CIVKA('Q0.1')]),
          PRICKA('Auta – červená od fáze 2 do konce', [NO('T1'), NC('I0.1')], [CIVKA('Q0.0')]),
          PRICKA('Chodci – zelená', [NO('T2'), NC('T3'), NC('I0.1')], [CIVKA('Q0.4')]),
          PRICKA('Chodci – červená (kromě noci)', [NC('Q0.4'), NC('I0.1')], [CIVKA('Q0.3')]),
          PRICKA('Signál ČEKEJTE', [NO('M0.0'), NC('T2')], [CIVKA('Q0.5')]),
          PRICKA('Blikač pro noční režim: T6 odměří 0,5 s tmy…', [NO('I0.1'), NC('T7')], [TON('T6', 500)]),
          PRICKA('…T7 0,5 s svitu, pak T6 vynuluje', [NO('T6')], [TON('T7', 500)])
        ])
    },
    {
      id: 'nadrz', nazev: 'Čerpání jímky (hystereze, TOF, alarm)',
      vytvor: () => zaklad('Čerpací jímka',
        'V režimu AUTO se čerpadlo 1 zapne při dosažení horního plováku a běží, dokud hladina neklesne pod spodní plovák (hystereze samodržením M0.0); časovač TOF ho nechá doběhnout ještě 3 s. Trvá-li havarijní hladina 2 s, přidá se záložní čerpadlo. Havarijní stav se uloží jako alarm (bliká maják), dokud ho obsluha nekvituje.',
        'nadrz', 100,
        { 'I0.0': 'PLOV_MIN', 'I0.1': 'PLOV_MAX', 'I0.2': 'PLOV_HAV', 'I0.3': 'AUTO', 'I0.4': 'RUCNE', 'I0.5': 'KVITACE',
          'Q0.0': 'CERPADLO1', 'Q0.1': 'CERPADLO2', 'Q0.2': 'MAJAK', 'M0.0': 'POZAD_CERP', 'M0.1': 'ALARM', 'T0': 'DOBEH', 'T1': 'ZPOZD_HAV', 'T2': 'BLIK_A', 'T3': 'BLIK_B' },
        {},
        [
          PRICKA('Požadavek čerpání s hysterezí: start na MAX, drží do MIN', [NO('I0.3'), PAR([NO('I0.1')], [NO('M0.0')]), NO('I0.0')], [CIVKA('M0.0')]),
          PRICKA('Doběh čerpadla 3 s po poklesu pod MIN (TOF)', [NO('M0.0')], [TOF('T0', 3000)]),
          PRICKA('Čerpadlo 1: automaticky nebo ručním tlačítkem', [PAR([NO('T0')], [NO('I0.4')])], [CIVKA('Q0.0')]),
          PRICKA('Havarijní hladina musí trvat 2 s (filtr vln)', [NO('I0.2')], [TON('T1', 2000)]),
          PRICKA('Záložní čerpadlo: start po havárii, drží do MIN', [PAR([NO('T1')], [NO('Q0.1')]), NO('I0.0')], [CIVKA('Q0.1')]),
          PRICKA('Paměť alarmu', [NO('I0.2')], [SET('M0.1')]),
          PRICKA('Kvitace alarmu jde jen po poklesu hladiny', [NO('I0.5'), NC('I0.2')], [RESET('M0.1')]),
          PRICKA('Blikač 1 Hz', [NC('T3')], [TON('T2', 500)]),
          PRICKA('', [NO('T2')], [TON('T3', 500)]),
          PRICKA('Maják alarmu bliká', [NO('M0.1'), NO('T2')], [CIVKA('Q0.2')])
        ])
    },
    {
      id: 'motor', nazev: 'Reverzace motoru s blokováním',
      vytvor: () => zaklad('Reverzace motoru',
        'Stykače K1 (vpřed) a K2 (vzad) se navzájem blokují rozpínacími kontakty Q0.1 a Q0.0 – nikdy nesepnou současně. Časovače TOF drží blokování ještě 2 s po vypnutí, než motor doběhne; reverzace za chodu tak není možná. Zkuste blokovací kontakty smazat a stisknout VPŘED i VZAD.',
        'motor', 50,
        { 'I0.0': 'TL_VPRED', 'I0.1': 'TL_VZAD', 'I0.2': 'TL_STOP', 'I0.3': 'TEPL_OCHR', 'Q0.0': 'K1_VPRED', 'Q0.1': 'K2_VZAD', 'Q0.2': 'PORUCHA', 'T0': 'DOBEH_VPRED', 'T1': 'DOBEH_VZAD' },
        {},
        [
          PRICKA('Doběh po chodu vpřed: TOF drží 2 s po vypnutí K1', [NO('Q0.0')], [TOF('T0', 2000)]),
          PRICKA('Doběh po chodu vzad', [NO('Q0.1')], [TOF('T1', 2000)]),
          PRICKA('Chod vpřed: samodržení, STOP, tepelná ochrana, blokování K2 a doběhu vzad', [PAR([NO('I0.0')], [NO('Q0.0')]), NC('I0.2'), NC('I0.3'), NC('Q0.1'), NC('T1')], [CIVKA('Q0.0')]),
          PRICKA('Chod vzad: zrcadlově', [PAR([NO('I0.1')], [NO('Q0.1')]), NC('I0.2'), NC('I0.3'), NC('Q0.0'), NC('T0')], [CIVKA('Q0.1')]),
          PRICKA('Kontrolka poruchy', [NO('I0.3')], [CIVKA('Q0.2')])
        ])
    },
    {
      id: 'analog', nazev: 'Analogová měření a výpočty',
      vytvor: () => zaklad('Analog: škálování, porovnání, aritmetika',
        'Analogový vstup IW0 (posuvník v panelu vstupů, 0–32000 = 4–20 mA) se přepočte na teplotu 0–150 °C. Porovnání CMP hlídá meze, podkročení rozsahu (IW0 < 0) prozradí přerušený vodič. Systémový takt S0.3 (1 s) s náběžnou hranou počítá sekundy a minuty.',
        'zadny', 100,
        { 'IW0': 'TEPLOTA_RAW', 'MD0': 'TEPLOTA_C', 'MD1': 'DVOJNASOBEK', 'MD2': 'OMEZENO', 'MW0': 'SEKUNDY', 'MW1': 'MINUTY', 'QW0': 'ANALOG_VYSTUP',
          'Q0.0': 'VAROVANI_80', 'Q0.1': 'HAVARIE_120', 'Q0.2': 'PORUCHA_CIDLA', 'M0.0': 'IMPULZ_1S' },
        {},
        [
          PRICKA('Přepočet surové hodnoty na °C (S0.0 = vždy 1)', [NO('S0.0')], [SCALE('IW0', 0, 32000, '0.0', '150.0', 'MD0')]),
          PRICKA('Varování nad 80 °C', [CMP('MD0', '>', '80.0')], [CIVKA('Q0.0')]),
          PRICKA('Havárie nad 120 °C', [CMP('MD0', '>', '120.0')], [CIVKA('Q0.1')]),
          PRICKA('Podkročení rozsahu = přerušený vodič (0 mA)', [CMP('IW0', '<', '0')], [CIVKA('Q0.2')]),
          PRICKA('Náběžná hrana taktu 1 s', [P('S0.3')], [CIVKA('M0.0')]),
          PRICKA('Počítání sekund', [NO('M0.0')], [ADD('MW0', 1, 'MW0')]),
          PRICKA('Po 60 s přičti minutu a vynuluj sekundy', [CMP('MW0', '>=', '60')], [ADD('MW1', 1, 'MW1'), MOVE(0, 'MW0')]),
          PRICKA('Aritmetika s REAL a omezení', [NO('S0.0')], [MUL('MD0', '2.0', 'MD1'), LIMIT('0.0', 'MD0', '100.0', 'MD2')]),
          PRICKA('Analogový výstup úměrný teplotě', [NO('S0.0')], [SCALE('MD0', '0.0', '150.0', 0, 32000, 'QW0')])
        ])
    },
    {
      id: 'michani', nazev: 'Míchací nádrž s PID regulací teploty',
      vytvor: () => zaklad('Dávkový ohřev s PID',
        'START spustí dávku: plnění do 80 % → ohřev na žádanou teplotu MD2 (60 °C) regulátorem PID s mícháním → výdrž 20 s → vypuštění pod 3 %. Kroky sekvence jsou bity M0.1–M0.4 (obdoba SFC v Ladderu). Žádanou teplotu i parametry PID lze měnit za běhu (tabulka sledování → Zapsat).',
        'michani', 100,
        { 'I0.0': 'START', 'I0.1': 'STOP', 'I0.2': 'HLAD_MIN', 'IW0': 'HLADINA_RAW', 'IW1': 'TEPLOTA_RAW', 'Q0.0': 'VENTIL_PRITOK', 'Q0.1': 'VENTIL_VYPUST',
          'Q0.2': 'MICHADLO', 'Q0.3': 'HOTOVO', 'Q0.4': 'ALARM', 'QW0': 'TOPENI', 'MD0': 'HLADINA_PROC', 'MD1': 'TEPLOTA_C', 'MD2': 'ZADANA_TEPLOTA', 'MD3': 'VYKON_PROC',
          'M0.1': 'K1_PLNENI', 'M0.2': 'K2_OHREV', 'M0.3': 'K3_VYDRZ', 'M0.4': 'K4_VYPUST', 'M0.5': 'DAVKA_HOTOVA', 'M1.0': 'DAVKA_BEZI', 'T0': 'CAS_VYDRZE' },
        {},
        [
          PRICKA('Hladina v %', [NO('S0.0')], [SCALE('IW0', 0, 32000, '0.0', '100.0', 'MD0')]),
          PRICKA('Teplota v °C', [NO('S0.0')], [SCALE('IW1', 0, 32000, '0.0', '100.0', 'MD1')]),
          PRICKA('Žádaná teplota po studeném startu', [NO('S0.1'), CMP('MD2', '<=', '0.0')], [MOVE('60.0', 'MD2')]),
          PRICKA('START: krok 1 – plnění', [P('I0.0'), NC('M1.0')], [SET('M1.0'), SET('M0.1'), RESET('M0.5')]),
          PRICKA('Plno (80 %) → krok 2 – ohřev', [NO('M0.1'), CMP('MD0', '>=', '80.0')], [RESET('M0.1'), SET('M0.2')]),
          PRICKA('Teplota dosažena (−1 °C) → krok 3 – výdrž', [NO('M0.2'), CMP('MD1', '>=', '59.0')], [RESET('M0.2'), SET('M0.3')]),
          PRICKA('Výdrž 20 s', [NO('M0.3')], [TON('T0', 20000)]),
          PRICKA('Konec výdrže → krok 4 – vypouštění', [NO('T0')], [RESET('M0.3'), SET('M0.4')]),
          PRICKA('Prázdno → dávka hotová', [NO('M0.4'), CMP('MD0', '<=', '3.0')], [RESET('M0.4'), RESET('M1.0'), SET('M0.5')]),
          PRICKA('STOP přeruší dávku', [NO('I0.1')], [RESET('M0.1'), RESET('M0.2'), RESET('M0.3'), RESET('M0.4'), RESET('M1.0')]),
          PRICKA('Ventil přítoku', [NO('M0.1')], [CIVKA('Q0.0')]),
          PRICKA('Ventil vypouštění', [NO('M0.4')], [CIVKA('Q0.1')]),
          PRICKA('Míchadlo při ohřevu a výdrži (jen nad 10 % hladiny)', [PAR([NO('M0.2')], [NO('M0.3')]), NO('I0.2')], [CIVKA('Q0.2')]),
          PRICKA('PID teploty (Kp 8 %/K, Ti 60 s, anti-windup, výstup 0–100 %)', [PAR([NO('M0.2')], [NO('M0.3')]), NO('I0.2')],
            [PID({ pv: 'MD1', sp: 'MD2', out: 'MD3', kp: 8, ti: 60, td: 0, omin: 0, omax: 100 })]),
          PRICKA('Mimo ohřev topení vypnuto', [PAR([NO('M0.1')], [NO('M0.4')], [NC('M1.0')], [NC('I0.2')])], [MOVE('0.0', 'MD3')]),
          PRICKA('Akční veličina na analogový výstup', [NO('S0.0')], [SCALE('MD3', '0.0', '100.0', 0, 32000, 'QW0')]),
          PRICKA('Kontrolka HOTOVO', [NO('M0.5')], [CIVKA('Q0.3')]),
          PRICKA('Alarm: přehřátí nad 90 °C nebo vadné čidlo', [PAR([CMP('MD1', '>', '90.0')], [CMP('IW1', '<', '0')])], [CIVKA('Q0.4')])
        ])
    },
    {
      id: 'hvezda', nazev: 'Rozběh hvězda–trojúhelník',
      vytvor: () => zaklad('Rozběh Y/Δ',
        'START sepne K1 a K2 (hvězda). Po 4 s se hvězda rozpojí, po prodlevě 100 ms (zhasnutí oblouku) sepne K3 (trojúhelník). K2 a K3 se navzájem blokují. Proud z převodníku se přepočte na ampéry; trvá-li nadproud nad 100 A přes 3 s, motor se vypne. Zkuste zkrátit T0 na 0,5 s a sledujte proudovou špičku.',
        'hvezda', 50,
        { 'I0.0': 'START', 'I0.1': 'STOP', 'I0.2': 'TEPL_RELE', 'IW0': 'PROUD_RAW', 'Q0.0': 'K1_SIT', 'Q0.1': 'K2_HVEZDA', 'Q0.2': 'K3_TROJ', 'Q0.3': 'PORUCHA',
          'M0.0': 'CHOD', 'MD0': 'PROUD_A', 'T0': 'CAS_HVEZDA', 'T1': 'PRODLEVA', 'T2': 'NADPROUD' },
        {},
        [
          PRICKA('Chod: samodržení, STOP, tepelné relé, nadproud', [PAR([NO('I0.0')], [NO('M0.0')]), NC('I0.1'), NC('I0.2'), NC('T2')], [CIVKA('M0.0')]),
          PRICKA('K1 – síťový stykač', [NO('M0.0')], [CIVKA('Q0.0')]),
          PRICKA('Doba rozběhu ve hvězdě', [NO('M0.0')], [TON('T0', 4000)]),
          PRICKA('K2 – hvězda (blokování K3)', [NO('M0.0'), NC('T0'), NC('Q0.2')], [CIVKA('Q0.1')]),
          PRICKA('Prodleva přepnutí 100 ms', [NO('T0'), NC('Q0.1')], [TON('T1', 100)]),
          PRICKA('K3 – trojúhelník (blokování K2)', [NO('M0.0'), NO('T1'), NC('Q0.1')], [CIVKA('Q0.2')]),
          PRICKA('Proud v ampérech', [NO('S0.0')], [SCALE('IW0', 0, 32000, '0.0', '200.0', 'MD0')]),
          PRICKA('Nadproudová ochrana: > 100 A déle než 3 s', [CMP('MD0', '>', '100.0')], [TON('T2', 3000)]),
          PRICKA('Kontrolka poruchy', [PAR([NO('I0.2')], [NO('T2')])], [CIVKA('Q0.3')])
        ])
    },
    {
      id: 'vrata', nazev: 'Garážová vrata s bezpečnostní závorou',
      vytvor: () => zaklad('Garážová vrata',
        'Jedno impulzní tlačítko: v klidu otevře (nebo zavře, jsou-li vrata nahoře), za pohybu zastaví. Přerušení světelné závory při zavírání vrata obrátí. Otevřená vrata se po 15 s sama zavřou. Závora je zapojená rozpínacím kontaktem – přerušený vodič se chová jako překážka (bezpečný stav). Maják bliká taktem S0.3.',
        'vrata', 50,
        { 'I0.0': 'TLACITKO', 'I0.1': 'KONC_NAHORE', 'I0.2': 'KONC_DOLE', 'I0.3': 'ZAVORA_VOLNO', 'Q0.0': 'MOTOR_NAHORU', 'Q0.1': 'MOTOR_DOLU', 'Q0.2': 'MAJAK',
          'M0.0': 'POZ_NAHORU', 'M0.1': 'POZ_DOLU', 'M1.0': 'IMPULZ', 'M1.1': 'ZASTAVIT', 'T0': 'AUTO_ZAVRENI' },
        {},
        [
          PRICKA('Impulz tlačítka (jeden cyklus)', [P('I0.0')], [CIVKA('M1.0')]),
          PRICKA('Stisk za pohybu = zastavit (stav pohybu z minulého cyklu)', [NO('M1.0'), PAR([NO('Q0.0')], [NO('Q0.1')])], [CIVKA('M1.1')]),
          PRICKA('Zastavení', [NO('M1.1')], [RESET('M0.0'), RESET('M0.1')]),
          PRICKA('V klidu nahoře → zavřít (jen při volné závoře)', [NO('M1.0'), NC('M1.1'), NO('I0.1'), NO('I0.3')], [SET('M0.1')]),
          PRICKA('V klidu jinde → otevřít', [NO('M1.0'), NC('M1.1'), NC('I0.1')], [SET('M0.0')]),
          PRICKA('Koncové spínače ukončí pohyb', [NO('I0.1')], [RESET('M0.0')]),
          PRICKA('', [NO('I0.2')], [RESET('M0.1')]),
          PRICKA('Překážka při zavírání → reverzace', [NO('M0.1'), NC('I0.3')], [RESET('M0.1'), SET('M0.0')]),
          PRICKA('Automatické zavření po 15 s', [NO('I0.1'), NO('I0.3'), NC('M0.0'), NC('M0.1')], [TON('T0', 15000)]),
          PRICKA('', [NO('T0')], [SET('M0.1')]),
          PRICKA('Motor nahoru (blokování směrů)', [NO('M0.0'), NC('I0.1'), NC('Q0.1')], [CIVKA('Q0.0')]),
          PRICKA('Motor dolů (jen při volné závoře)', [NO('M0.1'), NC('I0.2'), NC('Q0.0'), NO('I0.3')], [CIVKA('Q0.1')]),
          PRICKA('Maják bliká při pohybu', [PAR([NO('Q0.0')], [NO('Q0.1')]), NO('S0.3')], [CIVKA('Q0.2')])
        ])
    },
    {
      id: 'cerpadla_fb', nazev: 'Dvě čerpadla přes funkční blok',
      vytvor: () => {
        const p = zaklad('Jímka s funkčním blokem CERPADLO',
          'Logika jednoho čerpadla (doběh TOF, paměť poruchy, kvitace, počet startů) je ve funkčním bloku CERPADLO. MAIN ho volá dvakrát s instancemi Cerpadlo1 a Cerpadlo2 – každá má vlastní paměť, časovač i čítač. Záložní čerpadlo naskočí při havarijní hladině (analogově z hladinoměru) nebo při poruše prvního. Poruchu vyvoláte přepínačem tepelné ochrany I0.6/I0.7.',
          'nadrz', 100,
          { 'I0.0': 'PLOV_MIN', 'I0.1': 'PLOV_MAX', 'I0.2': 'PLOV_HAV', 'I0.3': 'AUTO', 'I0.5': 'KVITACE', 'I0.6': 'TEPL_1', 'I0.7': 'TEPL_2', 'IW0': 'HLADINA_RAW',
            'Q0.0': 'CERPADLO1', 'Q0.1': 'CERPADLO2', 'Q0.2': 'MAJAK', 'M0.0': 'POZ_1', 'M0.1': 'POZ_2', 'M2.0': 'ALARM_1', 'M2.1': 'ALARM_2',
            'MD0': 'HLADINA_PROC', 'MW10': 'STARTY_1', 'MW11': 'STARTY_2', 'T1': 'ZPOZD_HAV' },
          {},
          [
            PRICKA('Hladina v %', [NO('S0.0')], [SCALE('IW0', 0, 32000, '0.0', '100.0', 'MD0')]),
            PRICKA('Požadavek čerpadla 1: hystereze MAX → MIN', [NO('I0.3'), PAR([NO('I0.1')], [NO('M0.0')]), NO('I0.0')], [CIVKA('M0.0')]),
            PRICKA('Havarijní hladina ≥ 90 % po dobu 2 s', [CMP('MD0', '>=', '90.0')], [TON('T1', 2000)]),
            PRICKA('Požadavek záložního: havárie, nebo porucha čerpadla 1', [PAR([NO('T1')], [NO('M0.1')], [NO('M0.0'), NO('M2.0')]), NO('I0.0')], [CIVKA('M0.1')]),
            PRICKA('Čerpadlo 1', [], [CALL('CERPADLO', 'Cerpadlo1', { Pozadavek: 'M0.0', Porucha: 'I0.6', Kvitace: 'I0.5', Chod: 'Q0.0', Alarm: 'M2.0', Starty: 'MW10' })]),
            PRICKA('Čerpadlo 2', [], [CALL('CERPADLO', 'Cerpadlo2', { Pozadavek: 'M0.1', Porucha: 'I0.7', Kvitace: 'I0.5', Chod: 'Q0.1', Alarm: 'M2.1', Starty: 'MW11' })]),
            PRICKA('Maják: porucha čerpadla nebo havarijní plovák', [PAR([NO('M2.0')], [NO('M2.1')], [NO('I0.2')]), NO('S0.3')], [CIVKA('Q0.2')])
          ]);
        p.fb = [FB('CERPADLO', [['Pozadavek', 'IN', 'BOOL', 'požadavek chodu'], ['Porucha', 'IN', 'BOOL', 'tepelná ochrana'], ['Kvitace', 'IN', 'BOOL', 'potvrzení poruchy'],
          ['Chod', 'OUT', 'BOOL', 'povel stykači'], ['Alarm', 'OUT', 'BOOL', 'uložená porucha'], ['Starty', 'OUT', 'INT', 'počet startů']], [
          PRICKA('Doběh 3 s po zániku požadavku (lokální časovač instance)', [NO('#Pozadavek')], [TOF('#Dobeh', 3000)]),
          PRICKA('Porucha se uloží', [NO('#Porucha')], [SET('#Alarm')]),
          PRICKA('Kvitace jen po odeznění poruchy', [NO('#Kvitace'), NC('#Porucha')], [RESET('#Alarm')]),
          PRICKA('Chod', [NO('#Dobeh'), NC('#Alarm')], [CIVKA('#Chod')]),
          PRICKA('Počet startů (lokální čítač instance)', [NO('#Chod')], [CTU('#Pocet', 32767)]),
          PRICKA('', [NO('S0.0')], [MOVE('#Pocet', '#Starty')])
        ], 'Řízení jednoho čerpadla s doběhem, poruchou a počítadlem startů.')];
        p.remanence.MW = 10; p.remanence.FB = true;   // počty startů přežijí výpadek napájení
        return p;
      }
    },
    {
      id: 'prazdny', nazev: 'Prázdný projekt',
      vytvor: () => PLC.novyProjekt('Můj projekt')
    }
  ];

  if (typeof module !== 'undefined') module.exports = PRIKLADY; else window.PLC_PRIKLADY = PRIKLADY;
})();

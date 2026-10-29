/* ============================================================
   GENERÁTOR KARET – hotové předlohy (šablona + ukázková data)
   Bez obrázků: tvary, emoji a symboly. Každá předloha je funkce,
   která vrací celý projekt (ať se při každém použití dají nová id).
   Vystavené jako window.KARTY_PREDLOHY a module.exports.
   ============================================================ */
(function (koren) {
'use strict';
const K = typeof module !== 'undefined' && module.exports ? require('./jadro.js') : koren.KARTY;
const V = K.novaVrstva;

function projekt(nazev, karta, lic, rub, rubRezim, podminky, sloupce, radky, arch) {
  const p = K.novyProjekt();
  p.nazev = nazev;
  Object.assign(p.karta, karta);
  p.lic = lic; p.rub = rub; p.rubRezim = rubRezim;
  p.podminky = podminky;
  p.data = { sloupce, radky };
  Object.assign(p.arch, arch || {});
  return p;
}
const pravidlo = (sloupec, op, hodnota, vrstva, vlastnost, nastav) => ({ sloupec, op, hodnota, vrstva, vlastnost, nastav });

/* --- 1. Hrací karta (francouzské barvy) --- */
function hraci() {
  const hodnoty = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const symboly = ['♠', '♥', '♦', '♣'];
  const radky = [];
  symboly.forEach(s => hodnoty.forEach(h => radky.push([h, s, '1'])));
  const roh = { pismo: 'serif', tucne: true, barva: '#1a1a1a', zarovnani: 'stred', svisle: 'stred', prizpusobit: true, minVelikost: 6 };
  const lic = { pozadi: '#ffffff', vrstvy: [
    V('ramecek', { id: 'hr_ram', odsazeni: 2, sila: 0.3, barva: '#9a9a9a', zaobleni: 2 }),
    V('text', Object.assign({ id: 'hr_h1', nazev: 'Hodnota vlevo', x: 3, y: 3, w: 10, h: 9, text: '{hodnota}', velikost: 20 }, roh)),
    V('ikona', { id: 'hr_s1', nazev: 'Symbol vlevo', x: 4, y: 12, w: 8, h: 8, text: '{symbol}', barva: '#1a1a1a', pismo: 'serif' }),
    V('ikona', { id: 'hr_stred', nazev: 'Symbol uprostřed', x: 14, y: 24, w: 35, h: 40, text: '{symbol}', barva: '#1a1a1a', pismo: 'serif' }),
    V('text', Object.assign({ id: 'hr_h2', nazev: 'Hodnota vpravo', x: 50, y: 76, w: 10, h: 9, text: '{hodnota}', velikost: 20, otoceni: 180 }, roh)),
    V('ikona', { id: 'hr_s2', nazev: 'Symbol vpravo', x: 51, y: 68, w: 8, h: 8, text: '{symbol}', barva: '#1a1a1a', pismo: 'serif', otoceni: 180 })
  ] };
  const rub = { pozadi: '#7a1c2a', vrstvy: [
    V('ramecek', { id: 'hr_rr', odsazeni: 3, sila: 0.8, barva: '#f1d9a8', zaobleni: 2, dvojity: true }),
    V('tvar', { id: 'hr_rt', nazev: 'Kosočtverec', druh: 'kosoctverec', x: 11.5, y: 19, w: 40, h: 50, vypln: '#9c2a3a', obrys: '#f1d9a8', obrysSila: 0.8 }),
    V('ikona', { id: 'hr_ri', x: 21.5, y: 34, w: 20, h: 20, text: '♠♥♦♣', barva: '#f1d9a8' })
  ] };
  const cervena = '#c0182c';
  const podm = [];
  ['♥', '♦'].forEach(s => {
    podm.push(pravidlo('symbol', '=', s, '*text', 'barva', cervena), pravidlo('symbol', '=', s, '*ikona', 'barva', cervena));
  });
  return projekt('Hrací karty', { format: 'poker', w: 63, h: 88, spadavka: 3, bezpecna: 3, zaobleni: 3 },
    lic, rub, 'spolecny', podm, ['hodnota', 'symbol', 'pocet'], radky);
}

/* --- 2. Flashcard otázka / odpověď --- */
function flashcard() {
  const lic = { pozadi: '#fffdf6', vrstvy: [
    V('tvar', { id: 'fc_pruh', nazev: 'Pruh', x: -3, y: -3, w: 111, h: 14, druh: 'obdelnik', vypln: '#2f6db5', zaobleni: 0 }),
    V('text', { id: 'fc_kat', nazev: 'Kategorie', x: 5, y: 2.5, w: 70, h: 7, text: '{kategorie}', velikost: 11, barva: '#ffffff', tucne: true, zarovnani: 'vlevo' }),
    V('text', { id: 'fc_cis', nazev: 'Číslo', x: 75, y: 2.5, w: 25, h: 7, text: '#{#}', velikost: 10, barva: '#dfe9f7', zarovnani: 'vpravo' }),
    V('text', { id: 'fc_ot', nazev: 'Otázka', x: 7, y: 16, w: 91, h: 50, text: '{otazka}', velikost: 22, minVelikost: 7, tucne: true, barva: '#1d2733' })
  ] };
  const rub = { pozadi: '#eef4fb', vrstvy: [
    V('text', { id: 'fc_ol', nazev: 'Nadpis', x: 7, y: 5, w: 91, h: 7, text: 'Odpověď', velikost: 10, barva: '#2f6db5', tucne: true, zarovnani: 'vlevo' }),
    V('text', { id: 'fc_od', nazev: 'Odpověď', x: 7, y: 14, w: 91, h: 54, text: '{odpoved}', velikost: 18, minVelikost: 6, barva: '#1d2733' })
  ] };
  return projekt('Flashcards', { format: 'vlastni', w: 105, h: 74, spadavka: 3, bezpecna: 4, zaobleni: 3 },
    lic, rub, 'data', [
      pravidlo('kategorie', '=', 'Chemie', 'fc_pruh', 'vypln', '#2e8a57'),
      pravidlo('kategorie', '=', 'Dějepis', 'fc_pruh', 'vypln', '#a5532a')
    ], ['kategorie', 'otazka', 'odpoved'], [
      ['Zeměpis', 'Hlavní město Austrálie?', 'Canberra'],
      ['Chemie', 'Chemická značka železa?', 'Fe (z latinského ferrum)'],
      ['Dějepis', 'Kdy byla bitva na Bílé hoře?', '8. listopadu 1620'],
      ['Zeměpis', 'Nejdelší řeka Evropy?', 'Volha (asi 3 530 km)'],
      ['Chemie', 'Co je to katalyzátor?', 'Látka, která urychlí chemickou reakci a sama se při ní nespotřebuje.']
    ], { otocit: false });
}

/* --- 3. RPG předmět --- */
function rpgPredmet() {
  const lic = { pozadi: '#f4ead2', vrstvy: [
    V('ramecek', { id: 'rp_ram', odsazeni: 2, sila: 1.6, barva: '#6b6b6b', zaobleni: 2.5 }),
    V('tvar', { id: 'rp_hlava', nazev: 'Pás s názvem', x: 4, y: 4, w: 55, h: 10, vypln: '#3b2f22', zaobleni: 1.5 }),
    V('text', { id: 'rp_nazev', nazev: 'Název', x: 6, y: 4.5, w: 51, h: 9, text: '{nazev}', pismo: 'Cinzel Decorative', velikost: 13, barva: '#f4ead2', tucne: true }),
    V('tvar', { id: 'rp_okno', nazev: 'Pole obrázku', x: 6, y: 16, w: 51, h: 30, vypln: '#e3d5b4', obrys: '#8a7650', obrysSila: 0.4, zaobleni: 2 }),
    V('ikona', { id: 'rp_ikona', nazev: 'Emoji', x: 19.5, y: 19, w: 24, h: 24, text: '{ikona|🗡️}' }),
    V('obrazek', { id: 'rp_obr', nazev: 'Obrázek', x: 6, y: 16, w: 51, h: 30, src: '{obrazek}', zaobleni: 2 }),
    V('text', { id: 'rp_typ', nazev: 'Typ a vzácnost', x: 6, y: 47, w: 51, h: 5, text: '{typ} · {vzacnost}', velikost: 8, kurziva: true, barva: '#5a4a32' }),
    V('text', { id: 'rp_popis', nazev: 'Popis', x: 6, y: 53, w: 51, h: 22, text: '{popis}', pismo: 'serif', velikost: 10, minVelikost: 5, barva: '#2b2218', zarovnani: 'vlevo', svisle: 'nahore' }),
    V('text', { id: 'rp_cena', nazev: 'Cena', x: 6, y: 77, w: 25, h: 6, text: '🪙 {cena}', velikost: 9, tucne: true, barva: '#3b2f22', zarovnani: 'vlevo' }),
    V('text', { id: 'rp_vaha', nazev: 'Váha', x: 32, y: 77, w: 25, h: 6, text: '⚖️ {vaha|–}', velikost: 9, barva: '#3b2f22', zarovnani: 'vpravo' })
  ] };
  const rub = { pozadi: '#3b2f22', vrstvy: [
    V('ramecek', { id: 'rp_rr', odsazeni: 3, sila: 1, barva: '#c9a45c', zaobleni: 2.5, dvojity: true }),
    V('ikona', { id: 'rp_ri', x: 16.5, y: 29, w: 30, h: 30, text: '🎒', barva: '#c9a45c' }),
    V('text', { id: 'rp_rt', x: 6, y: 64, w: 51, h: 8, text: 'PŘEDMĚT', pismo: 'Cinzel Decorative', velikost: 12, barva: '#c9a45c', tucne: true })
  ] };
  const podm = [
    pravidlo('vzacnost', '=', 'vzácný', 'rp_ram', 'barva', '#2f6db5'),
    pravidlo('vzacnost', '=', 'epický', 'rp_ram', 'barva', '#7b3fb0'),
    pravidlo('vzacnost', '=', 'legendární', 'rp_ram', 'barva', '#d08a10'),
    pravidlo('vzacnost', '=', 'legendární', 'rp_hlava', 'vypln', '#7a4a00')
  ];
  return projekt('RPG předměty', { format: 'poker', w: 63, h: 88, spadavka: 3, bezpecna: 3, zaobleni: 3 }, lic, rub, 'spolecny', podm,
    ['nazev', 'typ', 'vzacnost', 'ikona', 'obrazek', 'popis', 'cena', 'vaha', 'pocet'], [
      ['Rezavý meč', 'zbraň', 'běžný', '🗡️', '', 'Útok +1. Po třech zásazích se může zlomit (hoď kostkou, 1 = zlomen).', '5', '3 kg', '3'],
      ['Léčivý lektvar', 'lektvar', 'běžný', '🧪', '', 'Vypij a obnov si 2k6 životů. Jednorázové.', '12', '0,5 kg', '4'],
      ['Elfí plášť', 'zbroj', 'vzácný', '🧥', '', 'Ve stínu jsi téměř neviditelný: +3 k plížení.', '60', '1 kg', '1'],
      ['Hůl bouře', 'zbraň', 'epický', '⚡', '', 'Jednou za boj sešle blesk za 3k6 na všechny nepřátele v řadě.', '250', '2 kg', '1'],
      ['Koruna věčného krále', 'artefakt', 'legendární', '👑', '', 'Nositel nemůže zemřít, dokud korunu nosí – ale každé ráno zestárne o rok.', '∞', '1 kg', '1']
    ]);
}

/* --- 4. RPG kouzlo --- */
function rpgKouzlo() {
  const lic = { pozadi: '#1f2340', vrstvy: [
    V('ramecek', { id: 'kz_ram', odsazeni: 2, sila: 1.2, barva: '#8f9bd6', zaobleni: 2.5, dvojity: true }),
    V('tvar', { id: 'kz_mana', nazev: 'Mana', druh: 'elipsa', x: 47, y: 3.5, w: 12, h: 12, vypln: '#2f6db5', obrys: '#dfe6ff', obrysSila: 0.6 }),
    V('text', { id: 'kz_manat', nazev: 'Mana – číslo', x: 47, y: 3.5, w: 12, h: 12, text: '{mana}', velikost: 16, tucne: true, barva: '#ffffff' }),
    V('text', { id: 'kz_nazev', nazev: 'Název', x: 5, y: 4, w: 41, h: 11, text: '{nazev}', pismo: 'MedievalSharp', velikost: 15, barva: '#f2f0ff', zarovnani: 'vlevo' }),
    V('tvar', { id: 'kz_kruh', nazev: 'Kruh', druh: 'elipsa', x: 14, y: 18, w: 35, h: 35, vypln: '#2a3060', obrys: '#8f9bd6', obrysSila: 0.6 }),
    V('ikona', { id: 'kz_ikona', nazev: 'Emoji', x: 20, y: 24, w: 23, h: 23, text: '{ikona|✨}' }),
    V('text', { id: 'kz_skola', nazev: 'Škola', x: 5, y: 55, w: 53, h: 5, text: '{skola} · úroveň {uroven}', velikost: 8, kurziva: true, barva: '#b9c1ea' }),
    V('text', { id: 'kz_popis', nazev: 'Popis', x: 6, y: 61, w: 51, h: 22, text: '{popis}', velikost: 10, minVelikost: 5, barva: '#eceefa', zarovnani: 'vlevo', svisle: 'nahore' })
  ] };
  const rub = { pozadi: '#151832', vrstvy: [
    V('ramecek', { id: 'kz_rr', odsazeni: 3, sila: 0.8, barva: '#8f9bd6', zaobleni: 2.5, dvojity: true }),
    V('tvar', { id: 'kz_rk', druh: 'sestiuhelnik', x: 13.5, y: 26, w: 36, h: 36, vypln: '#2a3060', obrys: '#8f9bd6', obrysSila: 0.8 }),
    V('ikona', { id: 'kz_ri', x: 21.5, y: 34, w: 20, h: 20, text: '🔮' })
  ] };
  const podm = [
    pravidlo('skola', '=', 'oheň', 'kz_ram', 'barva', '#e0703a'), pravidlo('skola', '=', 'oheň', 'kz_mana', 'vypln', '#b8461c'),
    pravidlo('skola', '=', 'příroda', 'kz_ram', 'barva', '#5cbf72'), pravidlo('skola', '=', 'příroda', 'kz_mana', 'vypln', '#2e8a57'),
    pravidlo('skola', '=', 'stín', 'kz_ram', 'barva', '#a678d8'), pravidlo('skola', '=', 'stín', 'kz_mana', 'vypln', '#5c3a8a')
  ];
  return projekt('RPG kouzla', { format: 'poker', w: 63, h: 88, spadavka: 3, bezpecna: 3, zaobleni: 3 }, lic, rub, 'spolecny', podm,
    ['nazev', 'skola', 'uroven', 'mana', 'ikona', 'popis', 'pocet'], [
      ['Ohnivá koule', 'oheň', '3', '4', '🔥', 'Koule ohně vybuchne v okruhu 6 m. Každý v dosahu utrží 3k6 zranění ohněm.', '2'],
      ['Liánové pouto', 'příroda', '1', '2', '🌿', 'Cíl je spoután, dokud neuspěje v hodu na sílu.', '2'],
      ['Ledový štít', 'voda', '2', '3', '❄️', 'Do příštího tahu máš obranu +4 a útočník v boji zblízka zpomalí.', '2'],
      ['Krok stínem', 'stín', '2', '2', '🌑', 'Teleportuj se do libovolného stínu, který vidíš, do vzdálenosti 18 m.', '1']
    ]);
}

/* --- 5. Kvízová karta --- */
function kviz() {
  const moznost = (pism, y) => V('text', { id: 'kv_' + pism, nazev: 'Možnost ' + pism.toUpperCase(), x: 6, y, w: 51, h: 8, text: pism.toUpperCase() + ')  {' + pism + '}', velikost: 10, minVelikost: 5, barva: '#1d2733', zarovnani: 'vlevo', skrytPrazdne: false });
  const lic = { pozadi: '#ffffff', vrstvy: [
    V('tvar', { id: 'kv_pas', nazev: 'Pás kategorie', x: -3, y: -3, w: 69, h: 15, vypln: '#5b3fa0', zaobleni: 0 }),
    V('text', { id: 'kv_kat', nazev: 'Kategorie', x: 5, y: 3, w: 40, h: 7, text: '{kategorie}', velikost: 10, tucne: true, barva: '#ffffff', zarovnani: 'vlevo' }),
    V('text', { id: 'kv_body', nazev: 'Body', x: 44, y: 3, w: 14, h: 7, text: '{body} b.', velikost: 9, barva: '#ffffff', zarovnani: 'vpravo' }),
    V('text', { id: 'kv_ot', nazev: 'Otázka', x: 6, y: 16, w: 51, h: 30, text: '{otazka}', velikost: 14, minVelikost: 6, tucne: true, barva: '#1d2733' }),
    moznost('a', 49), moznost('b', 57.5), moznost('c', 66), moznost('d', 74.5)
  ] };
  const rub = { pozadi: '#f3effa', vrstvy: [
    V('text', { id: 'kv_sl', x: 6, y: 12, w: 51, h: 8, text: 'Správná odpověď', velikost: 10, barva: '#5b3fa0', tucne: true }),
    V('text', { id: 'kv_sp', nazev: 'Správně', x: 6, y: 22, w: 51, h: 22, text: '{spravne}', velikost: 28, tucne: true, barva: '#1d2733' }),
    V('text', { id: 'kv_vys', nazev: 'Vysvětlení', x: 6, y: 47, w: 51, h: 34, text: '{vysvetleni}', velikost: 10, minVelikost: 5, barva: '#3a3550', svisle: 'nahore', skrytPrazdne: true })
  ] };
  const podm = [
    pravidlo('kategorie', '=', 'Věda', 'kv_pas', 'vypln', '#1f7a6a'),
    pravidlo('kategorie', '=', 'Sport', 'kv_pas', 'vypln', '#b0432a'),
    pravidlo('d', 'prazdne', '', 'kv_d', 'skryta', true)
  ];
  return projekt('Kvízové karty', { format: 'poker', w: 63, h: 88, spadavka: 3, bezpecna: 3, zaobleni: 3 }, lic, rub, 'data', podm,
    ['kategorie', 'body', 'otazka', 'a', 'b', 'c', 'd', 'spravne', 'vysvetleni'], [
      ['Věda', '1', 'Která planeta je nejblíž Slunci?', 'Venuše', 'Merkur', 'Mars', 'Země', 'B', 'Merkur obíhá ve střední vzdálenosti asi 58 milionů km.'],
      ['Historie', '2', 'Ve kterém roce byla založena Univerzita Karlova?', '1348', '1415', '1212', '1526', 'A', 'Založil ji Karel IV. 7. dubna 1348.'],
      ['Sport', '1', 'Kolik hráčů má na hřišti fotbalový tým?', '9', '10', '11', '12', 'C', ''],
      ['Věda', '3', 'Co měří jednotka pascal?', 'tlak', 'sílu', 'energii', '', 'A', 'Pascal = newton na metr čtvereční.']
    ]);
}

/* --- 6. Slovíčková kartička --- */
function slovicka() {
  const lic = { pozadi: '#ffffff', vrstvy: [
    V('tvar', { id: 'sl_bok', nazev: 'Boční pruh', x: -3, y: -3, w: 9, h: 61, vypln: '#e0a63f', zaobleni: 0 }),
    V('text', { id: 'sl_druh', nazev: 'Slovní druh', x: 10, y: 4, w: 70, h: 5, text: '{druh}', velikost: 8, kurziva: true, barva: '#777777', zarovnani: 'vlevo' }),
    V('text', { id: 'sl_slovo', nazev: 'Slovo', x: 10, y: 11, w: 70, h: 20, text: '{slovo}', velikost: 26, minVelikost: 8, tucne: true, barva: '#1d2733' }),
    V('text', { id: 'sl_vysl', nazev: 'Výslovnost', x: 10, y: 31, w: 70, h: 7, text: '{vyslovnost}', pismo: 'serif', velikost: 11, barva: '#555555', skrytPrazdne: true }),
    V('text', { id: 'sl_pr', nazev: 'Příklad', x: 10, y: 40, w: 70, h: 11, text: '{priklad}', velikost: 9, kurziva: true, barva: '#333333', skrytPrazdne: true })
  ] };
  const rub = { pozadi: '#fff7e6', vrstvy: [
    V('text', { id: 'sl_pre', nazev: 'Překlad', x: 6, y: 10, w: 73, h: 22, text: '{preklad}', velikost: 24, minVelikost: 8, tucne: true, barva: '#1d2733' }),
    V('text', { id: 'sl_ppr', nazev: 'Příklad – překlad', x: 6, y: 35, w: 73, h: 12, text: '{priklad_preklad}', velikost: 9, kurziva: true, barva: '#555555', skrytPrazdne: true })
  ] };
  const podm = [
    pravidlo('druh', 'obsahuje', 'sloveso', 'sl_bok', 'vypln', '#2f6db5'),
    pravidlo('druh', 'obsahuje', 'přídavné', 'sl_bok', 'vypln', '#2e8a57')
  ];
  return projekt('Slovíčka', { format: 'vizitka', w: 85, h: 55, spadavka: 3, bezpecna: 3, zaobleni: 2 }, lic, rub, 'data', podm,
    ['slovo', 'vyslovnost', 'druh', 'priklad', 'preklad', 'priklad_preklad'], [
      ['serendipity', '/ˌser.ənˈdɪp.ə.ti/', 'podstatné jméno', 'It was pure serendipity.', 'šťastná náhoda', 'Byla to čistá šťastná náhoda.'],
      ['to procrastinate', '/prəˈkræs.tɪ.neɪt/', 'sloveso', 'Stop procrastinating!', 'odkládat, otálet', 'Přestaň to odkládat!'],
      ['reliable', '/rɪˈlaɪ.ə.bəl/', 'přídavné jméno', 'a reliable friend', 'spolehlivý', 'spolehlivý přítel'],
      ['nevertheless', '', 'příslovce', '', 'nicméně', '']
    ]);
}

/* --- 7. Karta úkolu --- */
function ukol() {
  const lic = { pozadi: '#ffffff', vrstvy: [
    V('ramecek', { id: 'uk_ram', odsazeni: 2, sila: 1.4, barva: '#2e8a57', zaobleni: 2.5 }),
    V('ikona', { id: 'uk_ik', nazev: 'Emoji', x: 5, y: 5, w: 13, h: 13, text: '{ikona|✅}' }),
    V('text', { id: 'uk_kat', nazev: 'Kategorie', x: 20, y: 5, w: 38, h: 5, text: '{kategorie}', velikost: 8, barva: '#666666', zarovnani: 'vlevo' }),
    V('text', { id: 'uk_obt', nazev: 'Obtížnost', x: 20, y: 11, w: 38, h: 6, text: '{obtiznost}', velikost: 10, tucne: true, barva: '#2e8a57', zarovnani: 'vlevo' }),
    V('text', { id: 'uk_ukol', nazev: 'Úkol', x: 6, y: 21, w: 51, h: 18, text: '{ukol}', velikost: 16, minVelikost: 7, tucne: true, barva: '#1d2733' }),
    V('text', { id: 'uk_popis', nazev: 'Popis', x: 6, y: 41, w: 51, h: 30, text: '{popis}', velikost: 10, minVelikost: 5, barva: '#333333', svisle: 'nahore', skrytPrazdne: true }),
    V('tvar', { id: 'uk_box', nazev: 'Políčko', x: 6, y: 75, w: 7, h: 7, vypln: '#ffffff', obrys: '#333333', obrysSila: 0.5, zaobleni: 1 }),
    V('text', { id: 'uk_hot', x: 15, y: 75, w: 20, h: 7, text: 'Splněno', velikost: 9, barva: '#555555', zarovnani: 'vlevo' }),
    V('text', { id: 'uk_body', nazev: 'Body', x: 36, y: 74, w: 21, h: 9, text: '{body} b.', velikost: 16, tucne: true, barva: '#1d2733', zarovnani: 'vpravo' })
  ] };
  const rub = { pozadi: '#e9f5ee', vrstvy: [
    V('ramecek', { id: 'uk_rr', odsazeni: 3, sila: 0.8, barva: '#2e8a57', zaobleni: 2.5 }),
    V('ikona', { id: 'uk_ri', x: 19, y: 30, w: 25, h: 25, text: '🎯' })
  ] };
  const podm = [
    pravidlo('obtiznost', '=', 'střední', 'uk_ram', 'barva', '#c08a1e'), pravidlo('obtiznost', '=', 'střední', 'uk_obt', 'barva', '#9a6a00'),
    pravidlo('obtiznost', '=', 'těžká', 'uk_ram', 'barva', '#b1083a'), pravidlo('obtiznost', '=', 'těžká', 'uk_obt', 'barva', '#b1083a')
  ];
  return projekt('Karty úkolů', { format: 'poker', w: 63, h: 88, spadavka: 3, bezpecna: 3, zaobleni: 3 }, lic, rub, 'spolecny', podm,
    ['kategorie', 'ikona', 'ukol', 'popis', 'obtiznost', 'body', 'pocet'], [
      ['Domácnost', '🧹', 'Ukliď si pokoj', 'Všechno na své místo, vysát podlahu.', 'lehká', '5', '2'],
      ['Pohyb', '🚴', 'Projížďka na kole', 'Aspoň 10 km bez zastavení na zmrzlinu.', 'střední', '15', '1'],
      ['Škola', '📚', 'Přečti knihu', 'Celou knihu nad 150 stran a řekni o ní u večeře.', 'těžká', '30', '1'],
      ['Kuchyně', '🍳', 'Uvař večeři', '', 'střední', '20', '1']
    ]);
}

const PREDLOHY = [
  { id: 'hraci', nazev: '🂡 Hrací karty', popis: '52 karet, červené ♥ ♦ podmínkou, společný rub', vytvor: hraci },
  { id: 'flashcard', nazev: '❓ Flashcard otázka / odpověď', popis: 'otázka na líci, odpověď na rubu z dat', vytvor: flashcard },
  { id: 'rpg', nazev: '🗡️ RPG předmět', popis: 'rámeček podle vzácnosti, emoji nebo obrázek, cena a váha', vytvor: rpgPredmet },
  { id: 'kouzlo', nazev: '🔮 RPG kouzlo', popis: 'mana, škola magie mění barvy', vytvor: rpgKouzlo },
  { id: 'kviz', nazev: '🧠 Kvízová karta', popis: 'otázka + A–D, řešení na rubu', vytvor: kviz },
  { id: 'slovicka', nazev: '🔤 Slovíčková kartička', popis: 'slovo, výslovnost, příklad; překlad na rubu', vytvor: slovicka },
  { id: 'ukol', nazev: '✅ Karta úkolu', popis: 'úkol, obtížnost barvou, body, políčko na odškrtnutí', vytvor: ukol }
];

if (typeof module !== 'undefined' && module.exports) module.exports = PREDLOHY;
else koren.KARTY_PREDLOHY = PREDLOHY;
})(typeof window !== 'undefined' ? window : this);

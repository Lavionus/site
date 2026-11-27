// Zasažená zařízení v Rusku a na Ukrajině – ručně sestaveno ze zpráv (každý zásah má zdroj s odkazem).
// Kontrola: node _test/valka_zasahy_test.js · při aktualizaci obnovit „k“, stav zařízení a doplnit nové zásahy.
// Formát: zarizeni[] = { id, strana RU|UA, druh, nazev, vlastnik, misto, gps, vyznam, kapacita, stav, neuplne, zasahy[] }
const ZASAHY = {
"k":"2026-11-26",
"zarizeni":[
{
"id":"tuapse",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinerie Tuapse",
"vlastnik":"Rosněfť",
"misto":"Tuapse, Krasnodarský kraj",
"gps":[
44.105,
39.1
],
"vyznam":"Jediná rafinerie na ruském pobřeží Černého moře, vyrábí hlavně na export (nafta, mazut, vakuový plynový olej) přes vlastní přístavní terminál. Od dubna 2026 stojí.",
"kapacita":{
"hodnota":12.0,
"jednotka":"mil. t ropy/rok",
"popis":"jediná primární jednotka AVT-12",
"historie":[
[
2023,
9.3,
"skutečné zpracování (Reuters, dle The Moscow Times)"
],
[
2024,
1.68,
"jen leden–červenec 2024, po útocích (Reuters)"
]
],
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Экспортно ориентированный Туапсинский НПЗ с единственной установкой первичной переработки нефти АВТ-12 мощностью 12 миллионов тонн в год"
}
},
"stav":{
"k":"2026-11-23",
"provoz":"mimo",
"text":"Rafinerie nezpracovává ropu od série útoků v dubnu a květnu 2026 (zastavena 16. 4. 2026) a podle Reuters a Rand Corp. se do konce listopadu 2026 do provozu nevrátila.",
"zdroj":{
"nazev":"The Moscow Times rus., 23. 11. 2026",
"url":"https://ru.themoscowtimes.com/2026/11/23/odin-iz-poslednih-npz-na-yuge-rossii-ostanovilsya-posle-ataki-bpla-a812548",
"archiv":null,
"citace":"Крупнейший в Южном ФО, Туапсинский НПЗ «Роснефти» приостановил работу еще в мае, и с тех пор так и не вернулся к производству."
}
},
"neuplne":"Nezahrnuty útoky jen na přístav Tuapse (např. námořní drony 24. 9. a 10. 11. 2025) a nejasná hlášení (25. 11. 2025, požár neznámé příčiny 31. 7. 2026). Duben–květen 2026 zasahoval rafinerii i její přístavní terminál – zdroje je ne vždy rozlišují.",
"zasahy":[
{
"d":"2024-01-25",
"prostredek":"drony",
"co":"Požár vakuové jednotky po útoku dronů – jeden z prvních ukrajinských útoků na tak vzdálenou rafinerii. Rafinerie zcela zastavila zpracování.",
"dopad":4,
"obnova":"asi 3 měsíce (obnoveno koncem dubna / začátkem května 2024)",
"obnovaDni":95,
"vypadek":"celá rafinerie (~24 000 t ropy denně)",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 17. 3. 2025",
"url":"https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"archiv":"http://web.archive.org/web/20260521202956/https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"citace":"Туапсинский НПЗ возобновил переработку нефтяного сырья в конце апреля - начале мая после предыдущей атаки БПЛА 25 января 2024 года, вызвавшей пожар на вакуумной установке"
}
},
{
"d":"2024-05-17",
"prostredek":"drony",
"co":"Drony poškodily sekci rektifikace propan-butanové frakce, hlavní kolony nezasaženy; rafinerie se zastavila.",
"dopad":3,
"obnova":"asi 6 týdnů (obnoveno 1. 7. 2024)",
"obnovaDni":45,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 17. 3. 2025",
"url":"https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"archiv":"http://web.archive.org/web/20260521202956/https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"citace":"Завод возобновил переработку 1 июля."
}
},
{
"d":"2024-07-22",
"prostredek":"drony",
"co":"Požár po pádu trosek dronu poškodil infrastrukturu rafinerie, hlavní zařízení nezasaženo.",
"dopad":2,
"obnova":"2 dny",
"obnovaDni":2,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 17. 3. 2025",
"url":"https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"archiv":"http://web.archive.org/web/20260521202956/https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"citace":"По данным источников, основное оборудование НПЗ не пострадало, и завод возобновил переработку через два дня."
}
},
{
"d":"2025-03-14",
"prostredek":"drony",
"co":"Hořela nádrž s benzinem (až 20 tis. t), požár přes 1 000 m² hasili do 17. 3.; o zastavení zpracování zdroje nepíší.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 17. 3. 2025",
"url":"https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"archiv":"http://web.archive.org/web/20260521202956/https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"citace":"Резервуар с нефтепродуктами загорелся на территории Туапсинского НПЗ Роснефти после атаки БПЛА 14 марта 2025 года"
}
},
{
"d":"2025-10-06",
"prostredek":"drony",
"co":"Trosky dronu způsobily požár v budově ostrahy v areálu rafinerie.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 13. 2. 2026",
"url":"https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"archiv":"http://web.archive.org/web/20260614095609/https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"citace":"Возгорание в помещении охраны произошло 6 октября на территории Туапсинского НПЗ после падения обломков БПЛА"
}
},
{
"d":"2025-11-02",
"prostredek":"drony",
"co":"Útok na ropný terminál v přístavu Tuapse; rafinerie musela od 3. 11. zastavit zpracování, protože neměla kam odvážet produkty. Export obnoven po dvou týdnech.",
"dopad":2,
"obnova":"asi 2 týdny",
"obnovaDni":14,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 13. 2. 2026",
"url":"https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"archiv":"http://web.archive.org/web/20260614095609/https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"citace":"Туапсинский НПЗ Роснефти был вынужден приостановить переработку нефти с 3 ноября после произошедшей днем ранее атаки БПЛА на инфраструктуру порта Туапсе"
}
},
{
"d":"2025-12-31",
"prostredek":"drony",
"co":"Poškozeno molo v přístavu a zařízení rafinerie; podle zdrojů Reuters rafinerie nemohla najet dříve než koncem února 2026.",
"dopad":4,
"obnova":"nejméně 2 měsíce (ne dříve než koncem února 2026)",
"obnovaDni":60,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Один из причалов в порту Туапсе и оборудование на Туапсинском НПЗ получили повреждения в результате атаки БПЛА 31 декабря"
}
},
{
"d":"2026-04-16",
"prostredek":"drony",
"co":"Masivní útok na přístav a nádrže rafinerie, požáry v terminálu a nádržích; rafinerie zastavila zpracování. Následovala ekologická katastrofa (únik do moře, „ropný déšť“ ve městě).",
"dopad":4,
"obnova":"dosud neobnoveno (11/2026)",
"obnovaDni":null,
"vypadek":"celá rafinerie (12 mil. t/rok)",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Туапсинский НПЗ Роснефти был вынужден остановить переработку нефти с 16 апреля после атаки БПЛА на порт Туапсе"
}
},
{
"d":"2026-04-28",
"prostredek":"drony",
"co":"Požár přímo na rafinerii, uhašen 30. 4.; podle Ukrajiny 3. ničivý zásah během dvou týdnů.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Пожар возник на принадлежащем Роснефти Туапсинском НПЗ в результате атаки беспилотных летательных аппаратов (БПЛА) 28 апреля, 30 апреля пожар был потушен"
}
}
]
},
{
"id":"afipskij",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinerie Afipskij",
"vlastnik":"Afipskij NPZ (skupina Safmar)",
"misto":"Afipskij, Severskij rajon, Krasnodarský kraj",
"gps":[
44.882,
38.822
],
"vyznam":"Jedna z největších rafinerií na jihu Ruska, vyváží hlavně naftu a polotovary přes černomořské přístavy; spolu s Ilským NPZ nejčastěji zasahovaná rafinerie Kubáně.",
"kapacita":{
"hodnota":6.25,
"jednotka":"mil. t ropy/rok",
"popis":"projektovaná kapacita (dvě primární jednotky AT-22/4 a SPGK)",
"historie":[
[
2020,
4.927,
"skutečné zpracování"
],
[
2022,
7.017,
"skutečné zpracování"
],
[
2024,
7.2,
"skutečné zpracování včetně sloučené rafinerie Krasnodar (Reuters)"
],
[
2025,
3.0,
"jen leden–červen 2025, včetně Krasnodaru (Reuters)"
]
],
"zdroj":{
"nazev":"Wikipedie (rus.): Афипский НПЗ",
"url":"https://ru.wikipedia.org/wiki/Афипский_нефтеперерабатывающий_завод",
"archiv":"http://web.archive.org/web/20261005162027/https://ru.wikipedia.org/wiki/%D0%90%D1%84%D0%B8%D0%BF%D1%81%D0%BA%D0%B8%D0%B9_%D0%BD%D0%B5%D1%84%D1%82%D0%B5%D0%BF%D0%B5%D1%80%D0%B5%D1%80%D0%B0%D0%B1%D0%B0%D1%82%D1%8B%D0%B2%D0%B0%D1%8E%D1%89%D0%B8%D0%B9_%D0%B7%D0%B0%D0%B2%D0%BE%D0%B4",
"citace":"Проектная мощность по переработке нефти составляет 6,25 млн тонн в год, при этом по итогам 2022 года было переработано 7,017 млн тонн"
}
},
"stav":{
"k":"2026-11-23",
"provoz":"castecne",
"text":"Po útoku 6. 11. 2026 podle odhadu Rand Corp. ztratila asi polovinu kapacity; 18. 11. byla podle médií zasažena další zpracovatelská jednotka.",
"zdroj":{
"nazev":"The Moscow Times rus., 23. 11. 2026",
"url":"https://ru.themoscowtimes.com/2026/11/23/odin-iz-poslednih-npz-na-yuge-rossii-ostanovilsya-posle-ataki-bpla-a812548",
"archiv":null,
"citace":"Афипский НПЗ и Ильский НПЗ в Краснодарском крае, атакованные 6 ноября и 23 сентября соответственно, потеряли около половины мощности, согласно оценкам Rand."
}
},
"neuplne":"Pravděpodobně neúplné: podle UNITED24 byl útok 6. 11. 2026 sedmý v roce 2026, dohledal jsem jen šest. Drobné útoky (trosky bez škod, 9. 2. 2024, 22. 11. 2026) vynechány.",
"zasahy":[
{
"d":"2023-05-31",
"prostredek":"drony",
"co":"Požár na rafinerii; gubernátor uvedl, že ho pravděpodobně způsobil dron (téže noci i Ilskij).",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters, 31. 5. 2023 (odkaz z Wikipedie)",
"url":"https://www.reuters.com/world/europe/fire-oil-refinery-russias-krasnodar-likely-caused-by-drone-governor-2023-05-31/",
"archiv":"http://web.archive.org/web/20231029132222/https://www.reuters.com/world/europe/fire-oil-refinery-russias-krasnodar-likely-caused-by-drone-governor-2023-05-31/",
"citace":null
}
},
{
"d":"2023-10-29",
"prostredek":"drony",
"co":"Požár na rafinerii, místní úřady jej potvrdily; ukrajinská média připsala útok SBU.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters, 29. 10. 2023 (odkaz z Wikipedie)",
"url":"https://www.reuters.com/world/europe/fire-afipsky-oil-refinery-russias-krasnodar-local-authorities-2023-10-29/",
"archiv":"http://web.archive.org/web/20231102221649/https://www.reuters.com/world/europe/fire-afipsky-oil-refinery-russias-krasnodar-local-authorities-2023-10-29/",
"citace":null
}
},
{
"d":"2024-06-20",
"prostredek":"drony",
"co":"Ruská média hlásila útok dronů na rafinerii; o škodách se nepsalo.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Ukrinform, 20. 6. 2024 (odkaz z Wikipedie)",
"url":"https://www.ukrinform.net/rubric-ato/3876773-drones-attack-afipsky-oil-refinery-in-russias-krasnodar-region.html",
"archiv":"http://web.archive.org/web/20260509193938/https://www.ukrinform.net/rubric-ato/3876773-drones-attack-afipsky-oil-refinery-in-russias-krasnodar-region.html",
"citace":null
}
},
{
"d":"2025-02-10",
"prostredek":"drony",
"co":"Útok dronů na rafinerii, hlášen požár; rozsah škod neznámý.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Kyiv Post, 10. 2. 2025 (odkaz z Wikipedie)",
"url":"https://www.kyivpost.com/post/46851",
"archiv":"http://web.archive.org/web/20260928070455/https://www.kyivpost.com/post/46851",
"citace":null
}
},
{
"d":"2025-08-07",
"prostredek":"drony",
"co":"Požár po útoku; zastavena jednotka SPGK (9 786 t/den, víc než polovina kapacity).",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"~9 800 t ropy/den",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 13. 2. 2026",
"url":"https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"archiv":"http://web.archive.org/web/20260614095609/https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"citace":"Пожар возник на Афипском НПЗ после атаки БПЛА 7 августа, в результате остановлена переработка нефти на установке совместной переработки газа и газового конденсата (СПГК) мощностью 9.786 тонн в сутки."
}
},
{
"d":"2025-08-28",
"prostredek":"drony",
"co":"Požár po pádu trosek dronu, potvrdil krajský operační štáb.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 13. 2. 2026",
"url":"https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"archiv":"http://web.archive.org/web/20260614095609/https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"citace":"Пожар произошел на Афипском НПЗ 28 августа из-за падения обломков БПЛА"
}
},
{
"d":"2025-09-26",
"prostredek":"drony",
"co":"Požár na primární jednotce 22/4 (8 830 t/den, 47 % kapacity).",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"~8 800 t ropy/den (47 %)",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 13. 2. 2026",
"url":"https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"archiv":"http://web.archive.org/web/20260614095609/https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"citace":"возгорание произошло на установке первичной переработки нефти 22/4 производительностью 8.830 тонн в сутки (47% мощности НПЗ)"
}
},
{
"d":"2025-11-29",
"prostredek":"drony",
"co":"Hlášen zásah rafinerie drony; rozsah škod neznámý.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Kyiv Independent, 29. 11. 2025 (odkaz z Wikipedie)",
"url":"https://kyivindependent.com/ukraine-reportedly-strikes-afipsky-oil-refinery-in-russias-krasnodar-krai/",
"archiv":"http://web.archive.org/web/20260723040006/https://kyivindependent.com/ukraine-reportedly-strikes-afipsky-oil-refinery-in-russias-krasnodar-krai/",
"citace":null
}
},
{
"d":"2026-01-21",
"prostredek":"drony",
"co":"Požár po pádu trosek dronu (operační štáb kraje).",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Пожар произошел на территории Афипского НПЗ 21 января в результате падения обломков БПЛА"
}
},
{
"d":"2026-03-14",
"prostredek":"drony",
"co":"Požár po pádu trosek dronu (operační štáb kraje).",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Пожар возник на Афипском НПЗ 14 марта в результате падения обломков беспилотника"
}
},
{
"d":"2026-06-11",
"prostredek":"drony",
"co":"Požár v areálu po útoku dronů; ukrajinský generální štáb zásah potvrdil.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Пожар произошел 11 июня на территории Афипского НПЗ из-за падения обломков БПЛА"
}
},
{
"d":"2026-07-14",
"prostredek":"drony",
"co":"Požár po útoku dronů, uhašen tentýž den.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"http://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Пожар возник на Афипском НПЗ 14 июля в результате атаки БПЛА, возгорание было ликвидировано в тот же день."
}
},
{
"d":"2026-08-25",
"prostredek":"drony",
"co":"Požár po pádu trosek; na nádraží Afipskij zahynuli dva lidé.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"http://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Пожар возник 25 августа на территории Афипского НПЗ в результате падения обломков БПЛА."
}
},
{
"d":"2026-11-06",
"prostredek":"drony",
"co":"Hořel park nádrží, kouř i nad hlavním areálem (geolokovaná videa); podle Rand Corp. ztratila rafinerie asi polovinu kapacity.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"~ polovina kapacity (odhad Rand)",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times rus., 23. 11. 2026",
"url":"https://ru.themoscowtimes.com/2026/11/23/odin-iz-poslednih-npz-na-yuge-rossii-ostanovilsya-posle-ataki-bpla-a812548",
"archiv":null,
"citace":"Афипский НПЗ и Ильский НПЗ в Краснодарском крае, атакованные 6 ноября и 23 сентября соответственно, потеряли около половины мощности, согласно оценкам Rand."
}
},
{
"d":"2026-11-18",
"prostredek":"drony",
"co":"Úřady hlásily požár dvou průmyslových podniků, média je ztotožnila s rafineriemi Ilskij a Afipskij; v Afipském zasažena zpracovatelská jednotka.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times, 18. 11. 2026 (výsledek hledání)",
"url":"https://www.themoscowtimes.com/2026/11/18/ukrainian-drones-target-krasnodar-region-refineries-a94294",
"archiv":"http://web.archive.org/web/20261118103207/https://www.themoscowtimes.com/2026/11/18/ukrainian-drones-target-krasnodar-region-refineries-a94294",
"citace":null
}
}
]
},
{
"id":"krasnodar",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinerie Krasnodar",
"vlastnik":"Afipskij NPZ (skupina Safmar)",
"misto":"Krasnodar, Krasnodarský kraj",
"gps":[
44.998,
38.966
],
"vyznam":"Nejstarší fungující rafinerie v Rusku (1911), dnes pobočka Afipské rafinerie; vyrábí na export a letecký petrolej.",
"kapacita":{
"hodnota":3.1,
"jednotka":"mil. t ropy/rok",
"popis":"projektovaná kapacita",
"historie":[
[
2020,
1.6,
"skutečné zpracování"
]
],
"zdroj":{
"nazev":"Wikipedie (rus.): Краснодарский НПЗ",
"url":"https://ru.wikipedia.org/wiki/Краснодарский_нефтеперерабатывающий_завод",
"archiv":"http://web.archive.org/web/20251030204940/https://ru.wikipedia.org/wiki/%D0%9A%D1%80%D0%B0%D1%81%D0%BD%D0%BE%D0%B4%D0%B0%D1%80%D1%81%D0%BA%D0%B8%D0%B9_%D0%BD%D0%B5%D1%84%D1%82%D0%B5%D0%BF%D0%B5%D1%80%D0%B5%D1%80%D0%B0%D0%B1%D0%B0%D1%82%D1%8B%D0%B2%D0%B0%D1%8E%D1%89%D0%B8%D0%B9_%D0%B7%D0%B0%D0%B2%D0%BE%D0%B4",
"citace":"Проектная мощность по переработке нефти составляет 3,1 млн тонн в год."
}
},
"stav":{
"k":"2026-11-26",
"provoz":"neznamo",
"text":"Aktuální zprávy o provozu jsem nenašel; zpracování se vykazuje společně s Afipskou rafinerií.",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Краснодарский НПЗ, располагающий двумя первичными установками мощностью 4.570 тонн в сутки и 4.000 тонн в сутки, объединен с Афипским НПЗ."
}
},
"neuplne":"Dohledán jen jeden potvrzený zásah; zprávy často nerozlišují „rafinerii v Krasnodarském kraji“ a rafinerii přímo v Krasnodaru.",
"zasahy":[
{
"d":"2025-08-30",
"prostredek":"drony",
"co":"Požár po pádu trosek dronu (operační štáb kraje); jeden zraněný v sousední Adygeji.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Пожар произошел на Краснодарском НПЗ 30 августа из-за падения обломков БПЛА"
}
}
]
},
{
"id":"ilskij",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinerie Ilskij",
"vlastnik":"KNGK-INPZ (skupina KNGK)",
"misto":"Ilskij, Severskij rajon, Krasnodarský kraj",
"gps":[
44.858,
38.604
],
"vyznam":"Velká exportní rafinerie u Krasnodaru; podle Ukrajiny zásobuje palivem ruská vojska na jižní frontě a na Krymu. Nejčastěji zasahovaná rafinerie jihu Ruska.",
"kapacita":{
"hodnota":6.6,
"jednotka":"mil. t ropy/rok",
"popis":"roční kapacita zpracování",
"historie":[],
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Ильский НПЗ годовой мощностью переработки 6,6 миллиона тонн нефти - экспортно ориентированный"
}
},
"stav":{
"k":"2026-11-23",
"provoz":"castecne",
"text":"Podle Rand Corp. ztratila rafinerie po zářijovém útoku asi polovinu kapacity; 16. a 18. 11. 2026 následovaly další zásahy (podle ukrajinského generálního štábu tří primárních jednotek AT-4, AT-5, AT-6).",
"zdroj":{
"nazev":"The Moscow Times rus., 23. 11. 2026",
"url":"https://ru.themoscowtimes.com/2026/11/23/odin-iz-poslednih-npz-na-yuge-rossii-ostanovilsya-posle-ataki-bpla-a812548",
"archiv":null,
"citace":"Афипский НПЗ и Ильский НПЗ в Краснодарском крае, атакованные 6 ноября и 23 сентября соответственно, потеряли около половины мощности, согласно оценкам Rand."
}
},
"neuplne":"Neúplné: podle Astry (Kyiv Independent, 2. 6. 2026) byla rafinerie do června 2026 zasažena nejméně 16×; ne všechny útoky se podařilo dohledat s datem. Útok z května 2023 (4.–5. 5.) uveden jednou. Datum zářijového útoku 2026 se liší (23. vs. 26. 9.).",
"zasahy":[
{
"d":"2023-05-04",
"prostredek":"drony",
"co":"Podle TASS drony zapálily část rafinerie; další požár nádrží (asi 400 m²) následoval o den později.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters, 4. 5. 2023 (odkaz z Wikipedie)",
"url":"https://www.reuters.com/world/europe/part-south-russia-oil-refinery-catches-fire-after-drone-attack-tass-2023-05-04/",
"archiv":"http://web.archive.org/web/20230725043557/https://www.reuters.com/world/europe/part-south-russia-oil-refinery-catches-fire-after-drone-attack-tass-2023-05-04/",
"citace":null
}
},
{
"d":"2023-05-31",
"prostredek":"drony",
"co":"Dron narazil do areálu rafinerie (téže noci i Afipskij).",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters, 31. 5. 2023 (odkaz z Wikipedie)",
"url":"https://www.reuters.com/world/europe/fire-oil-refinery-russias-krasnodar-likely-caused-by-drone-governor-2023-05-31/",
"archiv":"http://web.archive.org/web/20231029132222/https://www.reuters.com/world/europe/fire-oil-refinery-russias-krasnodar-likely-caused-by-drone-governor-2023-05-31/",
"citace":null
}
},
{
"d":"2024-02-09",
"prostredek":"drony",
"co":"Výbuch a silný požár po útoku dronu.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times rus., 9. 2. 2024 (odkaz z Wikipedie)",
"url":"https://ru.themoscowtimes.com/2024/02/09/ukraina-atakovala-vosmoi-neftezavod-rossii-za-mesyats-a121144",
"archiv":"http://web.archive.org/web/20260607072512/https://ru.themoscowtimes.com/2024/02/09/ukraina-atakovala-vosmoi-neftezavod-rossii-za-mesyats-a121144",
"citace":null
}
},
{
"d":"2024-04-27",
"prostredek":"drony",
"co":"Hromadný útok na Kubáň, požáry v rafineriích Ilskij a Slavjansk.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"CNN, 27. 4. 2024 (odkaz z Wikipedie)",
"url":"https://www.cnn.com/2024/04/27/europe/ukraine-russia-oil-refinery-drone-attack-intl/index.html",
"archiv":"http://web.archive.org/web/20250817125655/https://www.cnn.com/2024/04/27/europe/ukraine-russia-oil-refinery-drone-attack-intl/index.html",
"citace":null
}
},
{
"d":"2024-06-21",
"prostredek":"drony",
"co":"Požár o rozloze asi 50 m² po útoku dronů.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Independent, 21. 6. 2024 (odkaz z Wikipedie)",
"url":"https://kyivindependent.com/russia-claims-several-casualties-after-reporting-mass-drone-attack-on-crimea-krasnodar/",
"archiv":"http://web.archive.org/web/20260520140735/https://kyivindependent.com/russia-claims-several-casualties-after-reporting-mass-drone-attack-on-crimea-krasnodar/",
"citace":null
}
},
{
"d":"2025-07-07",
"prostredek":"drony",
"co":"Trosky dronu dopadly do areálu, bez viditelných škod (HUR tvrdila zásah technologických provozů).",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Обломки БПЛА упали на территории Ильского НПЗ в ночь на 7 июля, видимых повреждений или возгорания зафиксировано не было."
}
},
{
"d":"2025-11-19",
"prostredek":"drony",
"co":"Místní hlásili sérii výbuchů v rafinerii; rozsah škod neznámý.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"NV, 19. 11. 2025 (odkaz z Wikipedie)",
"url":"https://english.nv.ua/amp/series-of-explosions-hits-krasnodar-krai-ilsky-oil-refinery-rumored-struck-50561785.html",
"archiv":"http://web.archive.org/web/20251119061425/https://english.nv.ua/amp/series-of-explosions-hits-krasnodar-krai-ilsky-oil-refinery-rumored-struck-50561785.html",
"citace":null
}
},
{
"d":"2026-02-17",
"prostredek":"drony",
"co":"Požár po útoku dronů (operační štáb kraje), uhašen 18. 2.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Пожар возник на Ильском НПЗ 17 февраля в результате атаки БПЛА, 18 февраля возгорание было полностью ликвидировано"
}
},
{
"d":"2026-02-18",
"prostredek":"drony",
"co":"Druhý požár po útoku během dvou dnů.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"http://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Пожар в результате атаки БПЛА возник на территории Ильского НПЗ 8 августа, 10 июля , 2 июня, 17 февраля и 18 февраля."
}
},
{
"d":"2026-06-02",
"prostredek":"drony",
"co":"Požár po útoku dronů, uhašen tentýž den.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Возгорание произошло на Ильском НПЗ 2 июня в результате атаки БПЛА. Пожар был потушен в тот же день"
}
},
{
"d":"2026-07-10",
"prostredek":"drony",
"co":"Požár po útoku dronů.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"http://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Пожар в результате атаки БПЛА возник на территории Ильского НПЗ 8 августа, 10 июля , 2 июня, 17 февраля и 18 февраля."
}
},
{
"d":"2026-08-08",
"prostredek":"drony",
"co":"Požár po útoku dronů (téže noci i Syzraň).",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"http://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Пожар в результате атаки БПЛА возник на территории Ильского НПЗ 8 августа, 10 июля , 2 июня, 17 февраля и 18 февраля."
}
},
{
"d":"2026-09-26",
"prostredek":"drony",
"co":"Požár po zásazích, gubernátor hlásil mrtvé; podle Rand Corp. rafinerie ztratila asi polovinu kapacity.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"~ polovina kapacity (odhad Rand)",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times rus., 16. 11. 2026",
"url":"https://ru.themoscowtimes.com/2026/11/16/genshtab-vsu-zayavil-o-porazhenii-odnogo-iz-krupneishih-npz-na-yuge-rossii-a211473",
"archiv":null,
"citace":"До этого завод атаковали 26 сентября."
}
},
{
"d":"2026-11-16",
"prostredek":"drony",
"co":"Podle ukrajinského generálního štábu zasaženy tři primární jednotky AT-4, AT-5, AT-6 a komplex výroby benzinu; úřady potvrdily útok a požár v „jednom z podniků“ v Ilském.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"odhad",
"zdroj":{
"nazev":"The Moscow Times rus., 16. 11. 2026",
"url":"https://ru.themoscowtimes.com/2026/11/16/genshtab-vsu-zayavil-o-porazhenii-odnogo-iz-krupneishih-npz-na-yuge-rossii-a211473",
"archiv":null,
"citace":"Утверждается, что в результате атаки были поражены три установки атмосферной перегонки нефти (АТ-4, АТ-5, АТ-6)"
}
},
{
"d":"2026-11-18",
"prostredek":"drony",
"co":"Další noční útok, poškozeny nádrže; úřady hlásily požár dvou průmyslových podniků a čtyři zraněné.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times, 18. 11. 2026 (výsledek hledání)",
"url":"https://www.themoscowtimes.com/2026/11/18/ukrainian-drones-target-krasnodar-region-refineries-a94294",
"archiv":"http://web.archive.org/web/20261118103207/https://www.themoscowtimes.com/2026/11/18/ukrainian-drones-target-krasnodar-region-refineries-a94294",
"citace":null
}
}
]
},
{
"id":"slavjansk",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinerie Slavjansk ECO",
"vlastnik":"Slavjansk ECO (soukromá)",
"misto":"Slavjansk-na-Kubani, Krasnodarský kraj",
"gps":[
45.221,
38.134
],
"vyznam":"Zpracovává asi 9 % ropy v Jižním federálním okruhu a dodává palivo i na okupovaný Krym. Od září 2026 stojí.",
"kapacita":{
"hodnota":5.2,
"jednotka":"mil. t ropy/rok",
"popis":"nominální kapacita; skutečné zpracování v letech 2019–2023 bylo 3,3–4,1 mil. t ročně",
"historie":[],
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Номинальная мощность НПЗ Славянск-ЭКО составляет 5,2 миллиона тонн в год при фактической переработке в 2019-2023 годах 3,3-4,1 миллиона тонн."
}
},
"stav":{
"k":"2026-11-26",
"provoz":"mimo",
"text":"Stojí od zářijového útoku 2026; 26. 11. 2026 byla při opravě znovu zasažena atmosférická destilační jednotka a zničeny sklady tmavých produktů.",
"zdroj":{
"nazev":"The Moscow Times rus., 26. 11. 2026",
"url":"https://ru.themoscowtimes.com/2026/11/26/v-krasnodarskom-krae-ukrainskie-bespilotniki-vnov-porazili-nahodivshiysya-na-a813019",
"archiv":null,
"citace":"Он был остановлен после удара дронов в сентябре 2026 года — пожар тогда тушили пять дней."
}
},
"neuplne":"Útoky ohlášené jen ukrajinskou stranou (např. 30. 11. 2025, 26. 1., 24. 6. a 20. 9. 2026) jsou označené jako tvrzení nebo vynechané.",
"zasahy":[
{
"d":"2024-03-17",
"prostredek":"drony",
"co":"Požár v rafinerii po útoku dronů, jeden mrtvý.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters, 17. 3. 2024 (odkaz z Wikipedie)",
"url":"https://www.reuters.com/world/europe/ukraine-drone-attacks-spark-fire-krasnodar-refinery-russia-says-2024-03-17/",
"archiv":null,
"citace":null
}
},
{
"d":"2024-04-27",
"prostredek":"drony",
"co":"Poškozena jedna z technologických jednotek (destilační kolona), rafinerie částečně přerušila provoz.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 17. 3. 2025",
"url":"https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"archiv":"http://web.archive.org/web/20260521202956/https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"citace":"НПЗ в Славянске 27 апреля прошлого года в результате атаки дронов частично приостанавливал работу."
}
},
{
"d":"2024-05-19",
"prostredek":"drony",
"co":"Na areál dopadlo šest dronů, rafinerie zastavila provoz; obnoven koncem května.",
"dopad":2,
"obnova":"asi 10 dní",
"obnovaDni":10,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 17. 3. 2025",
"url":"https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"archiv":"http://web.archive.org/web/20260521202956/https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"citace":"приостановил работу 19 мая 2024 года после атаки БПЛА"
}
},
{
"d":"2025-08-13",
"prostredek":"drony",
"co":"Trosky dronu dopadly na areál rafinerie.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 13. 2. 2026",
"url":"https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"archiv":"http://web.archive.org/web/20260614095609/https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"citace":"Обломки БПЛА упали 13 августа на территории Славянского НПЗ (Славянск-ЭКО), расположенного в Краснодарском крае."
}
},
{
"d":"2025-12-17",
"prostredek":"drony",
"co":"Požár technologického zařízení a potrubí po pádu trosek dronu.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 13. 2. 2026",
"url":"https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"archiv":"http://web.archive.org/web/20260614095609/https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"citace":"Возгорание технологического оборудования и трубопровода произошло 17 декабря на территории НПЗ в Славянске-на-Кубани"
}
},
{
"d":"2026-06-28",
"prostredek":"drony",
"co":"Požár po pádu trosek dronu (operační štáb kraje).",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Пожар возник на территории НПЗ в Славянске-на-Кубани в результате падения обломков БПЛА 28 июня"
}
},
{
"d":"2026-09-13",
"prostredek":"drony",
"co":"Zásah dronů HUR, zničeny dvě nádrže na ropu (satelitní snímky), požár potvrdila NASA FIRMS. Firma uvádí, že rafinerie se po zářijovém útoku zastavila a požár hasili pět dní.",
"dopad":4,
"obnova":"dosud neobnoveno (11/2026)",
"obnovaDni":null,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times rus., 26. 11. 2026",
"url":"https://ru.themoscowtimes.com/2026/11/26/v-krasnodarskom-krae-ukrainskie-bespilotniki-vnov-porazili-nahodivshiysya-na-a813019",
"archiv":null,
"citace":"Он был остановлен после удара дронов в сентябре 2026 года — пожар тогда тушили пять дней."
}
},
{
"d":"2026-11-26",
"prostredek":"drony",
"co":"Útok na stojící rafinerii: „značně poškozena“ atmosférická destilační jednotka a potrubí, zničeny sklady tmavých produktů, proraženy nádrže s ropou, únik ropy. Potvrdila firma.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá rafinerie (už stála)",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times rus., 26. 11. 2026",
"url":"https://ru.themoscowtimes.com/2026/11/26/v-krasnodarskom-krae-ukrainskie-bespilotniki-vnov-porazili-nahodivshiysya-na-a813019",
"archiv":null,
"citace":"По ее данным, «значительные повреждения» получила установка атмосферной дистилляции нефти и несколько трубопроводов."
}
}
]
},
{
"id":"novosachtinsk",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinerie Novošachtinsk (NZNP)",
"vlastnik":"Novošachtinský závod ropných produktů (soukromý)",
"misto":"Novošachtinsk, Rostovská oblast",
"gps":[
47.835,
39.85
],
"vyznam":"Jediná rafinerie Rostovské oblasti kousek od ukrajinské hranice; vyrábí hlavně polotovary na export a asfalt. Byla první ruskou rafinerií zasaženou dronem (červen 2022).",
"kapacita":{
"hodnota":5.0,
"jednotka":"mil. t ropy/rok",
"popis":"dvě jednotky AVT po 2,5 mil. t",
"historie":[
[
2024,
3.3,
"skutečné zpracování (Reuters); část roku jela na polovinu kvůli ztrátovosti"
]
],
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"http://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Новошахтинский ЗНП переработал в 2024 году 3,3 миллиона тонн нефти."
}
},
"stav":{
"k":"2026-11-23",
"provoz":"mimo",
"text":"Po šestihodinovém útoku asi 80 dronů 23. 11. 2026 rafinerie podle gubernátora přerušila provoz; byla jednou z posledních ještě fungujících rafinerií na jihu Ruska.",
"zdroj":{
"nazev":"The Moscow Times rus., 23. 11. 2026",
"url":"https://ru.themoscowtimes.com/2026/11/23/odin-iz-poslednih-npz-na-yuge-rossii-ostanovilsya-posle-ataki-bpla-a812548",
"archiv":null,
"citace":"Новошахтинский завод нефтепродуктов, атакованный ночью беспилотниками ВСУ, приостановил работу, сообщил в понедельник губернатор Ростовской области Юрий Слюсарь."
}
},
"neuplne":"Neúplné; vynechány neověřené zprávy (12. 4. 2024 sestřelené drony bez škod, 30. 11. 2025, 10. 10. 2026).",
"zasahy":[
{
"d":"2022-06-22",
"prostredek":"drony",
"co":"Dva drony z ukrajinského směru zasáhly rafinerii, vypukl požár (video s útočícím dronem). První známý útok dronu na ruskou rafinerii.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters, 22. 6. 2022 (odkaz z Wikipedie)",
"url":"https://www.reuters.com/world/europe/fire-broke-out-russias-novoshakhtinsk-oil-refinery-2022-06-22/",
"archiv":"http://web.archive.org/web/20250723010901/https://www.reuters.com/world/europe/fire-broke-out-russias-novoshakhtinsk-oil-refinery-2022-06-22/",
"citace":null
}
},
{
"d":"2024-03-13",
"prostredek":"drony",
"co":"Rafinerie se po útoku zastavila, tentýž den znovu najela na 50 % kapacity.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 17. 3. 2025",
"url":"https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"archiv":"http://web.archive.org/web/20260521202956/https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"citace":"В первый раз завод был атакован дронами 13 марта, после чего был вынужден остановиться, но восстановил производство в тот же день с 50% загрузкой от общей мощности."
}
},
{
"d":"2024-06-06",
"prostredek":"drony",
"co":"Poškozena jednotka AVT-2,5-2 (polovina kapacity), z opravy vyšla 28. 7.",
"dopad":3,
"obnova":"asi 7 týdnů",
"obnovaDni":52,
"vypadek":"~7 100 t ropy/den (50 %)",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 17. 3. 2025",
"url":"https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"archiv":"http://web.archive.org/web/20260521202956/https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"citace":"Эта же установка была повреждения после атаки БПЛА 6 июня и вышла из ремонта 28 июля."
}
},
{
"d":"2024-12-19",
"prostredek":"drony a rakety",
"co":"Požár po útoku (Ukrajina uvádí drony a rakety Neptun); jednotka AVT-2,5-2 (50 % kapacity) zůstala v opravě ještě v lednu.",
"dopad":3,
"obnova":"přes měsíc",
"obnovaDni":null,
"vypadek":"~7 100 t ropy/den (50 %)",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 17. 3. 2025",
"url":"https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"archiv":"http://web.archive.org/web/20260521202956/https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"citace":"завод остановил на ремонт поврежденную установку АВТ-2,5-2 (7.140 тонн в сутки, 50% мощности НПЗ), которая в январе остается на простое."
}
},
{
"d":"2025-08-21",
"prostredek":"drony",
"co":"Požár po útoku dronů trval téměř šest dní (uhašen 26. 8.), hasilo přes 400 lidí a dva hasičské vlaky.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 13. 2. 2026",
"url":"https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"archiv":"http://web.archive.org/web/20260614095609/https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"citace":"Пожар начался 21 августа на территории Новошахтинского ЗНП после атаки БПЛА. Возгорание было ликвидировано 26 августа."
}
},
{
"d":"2025-12-25",
"prostredek":"drony a rakety",
"co":"Rafinerie přerušila provoz po poškození zařízení; ukrajinské letectvo uvedlo použití střel Storm Shadow.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 13. 2. 2026",
"url":"https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"archiv":"http://web.archive.org/web/20260614095609/https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"citace":"Новошахтинский завод нефтепродуктов (ЗНП) приостановил работу из-за повреждения оборудования после атаки БПЛА 25 декабря"
}
},
{
"d":"2026-05-31",
"prostredek":"rakety",
"co":"Ukrajinské námořnictvo podle svého prohlášení zasáhlo raketami Neptun dvě destilační jednotky; ruské potvrzení chybí.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Interfax-Ukrajina (odkaz z Wikipedie)",
"url":"https://en.interfax.com.ua/news/general/1173220.html",
"archiv":"http://web.archive.org/web/20260622083858/https://en.interfax.com.ua/news/general/1173220.html",
"citace":null
}
},
{
"d":"2026-08-25",
"prostredek":"drony",
"co":"Rafinerie poškozena při útoku dronů; podle médií přerušila provoz.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"http://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"ЗНП получил повреждения в результате атаки БПЛА 25 августа."
}
},
{
"d":"2026-09-25",
"prostredek":"drony",
"co":"Poškození a přerušení provozu po útoku dronů (sestřeleno ~50 dronů).",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"http://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Новошахтинский ЗНП получил повреждения и приостановил работу в результате атаки БПЛА 25 сентября."
}
},
{
"d":"2026-11-23",
"prostredek":"drony a rakety",
"co":"Kombinovaný útok asi 80 dronů trval přes 6 hodin, rafinerie přerušila provoz (potvrdil gubernátor). Před útokem jela podle Rand asi na 70 % (70 tis. barelů/den).",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"~70 tis. barelů/den",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times rus., 23. 11. 2026",
"url":"https://ru.themoscowtimes.com/2026/11/23/odin-iz-poslednih-npz-na-yuge-rossii-ostanovilsya-posle-ataki-bpla-a812548",
"archiv":null,
"citace":"По его словам, в атаке были задействованы около 80 БПЛА, а сам налет продолжался «более 6 часов»."
}
}
]
},
{
"id":"volgograd",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinerie Volgograd (Lukoil)",
"vlastnik":"Lukoil",
"misto":"Volgograd (Krasnoarmějský obvod), Volgogradská oblast",
"gps":[
48.49,
44.62
],
"vyznam":"Největší rafinerie na jihu Ruska, asi 5 % ruského zpracování ropy a 7 % nafty; od roku 2024 opakovaně zastavována.",
"kapacita":{
"hodnota":14.5,
"jednotka":"mil. t ropy/rok",
"popis":"kapacita po spuštění jednotky ELOU-AVT-1 (2015)",
"historie":[
[
2015,
12.6,
"skutečné zpracování"
],
[
2023,
13.5,
"skutečné zpracování (Interfax/Kommersant, dle výsledků hledání)"
],
[
2024,
13.7,
"skutečné zpracování (Reuters), 5,1 % ruského zpracování"
]
],
"zdroj":{
"nazev":"Wikipedie (rus.): Лукойл-Волгограднефтепереработка",
"url":"https://ru.wikipedia.org/wiki/Лукойл-Волгограднефтепереработка",
"archiv":"http://web.archive.org/web/20251118135446/https://ru.wikipedia.org/wiki/%D0%9B%D1%83%D0%BA%D0%BE%D0%B9%D0%BB-%D0%92%D0%BE%D0%BB%D0%B3%D0%BE%D0%B3%D1%80%D0%B0%D0%B4%D0%BD%D0%B5%D1%84%D1%82%D0%B5%D0%BF%D0%B5%D1%80%D0%B5%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D0%BA%D0%B0",
"citace":"Пуск ЭЛОУ-АВТ-1 повысит эффективность переработки нефти и увеличит мощность Волгоградского НПЗ до 14,5 млн т нефти в год."
}
},
"stav":{
"k":"2026-11-16",
"provoz":"castecne",
"text":"Po útoku 13. 11. 2026 (zahynuli 4 zaměstnanci) ztratila rafinerie podle Rand Corp. zhruba polovinu kapacity; předtím stála celá po útoku 2. 10. 2026.",
"zdroj":{
"nazev":"The Moscow Times rus. (data Rand Corp.), 16. 11. 2026",
"url":"https://ru.themoscowtimes.com/2026/11/16/tri-krupneishih-snabzhayuschih-moskvu-npz-ostanovilis-posle-serii-udarov-ukraini-a211484",
"archiv":"http://web.archive.org/web/20261118012244/https://ru.themoscowtimes.com/2026/11/16/tri-krupneishih-snabzhayuschih-moskvu-npz-ostanovilis-posle-serii-udarov-ukraini-a211484",
"citace":"Новокуйбышевский НПЗ (30 октября) остановил выпуск полностью; Волгоградский НПЗ (13 ноября) и Новоуфимский НПЗ (31 октября) лишились половины мощностей"
}
},
"neuplne":"Útoky ohlášené jen ukrajinskou stranou nebo místními (18. 9., 15. 10., 26. 12. 2025) jsou označeny jako tvrzení. Kanál Exilenova+ počítá útok 13. 11. 2026 jako 13. od začátku války.",
"zasahy":[
{
"d":"2024-02-03",
"prostredek":"drony",
"co":"Požár jednotky AVT-5 (9 100 t/den); po opravě znovu v provozu 21. 2.",
"dopad":2,
"obnova":"asi 18 dní",
"obnovaDni":18,
"vypadek":"~9 100 t ropy/den",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 17. 3. 2025",
"url":"https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"archiv":"http://web.archive.org/web/20260521202956/https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"citace":"После восстановительного ремонта установка АВТ-5 вернулась в эксплуатацию 21 февраля."
}
},
{
"d":"2024-05-12",
"prostredek":"drony",
"co":"Požár zastavil největší primární jednotku AVT-1 (49 % kapacity), znovu spuštěna 16.–17. 5.",
"dopad":2,
"obnova":"asi 5 dní",
"obnovaDni":5,
"vypadek":"~18 600 t ropy/den (49 %)",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 17. 3. 2025",
"url":"https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"archiv":"http://web.archive.org/web/20260521202956/https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"citace":"вернул в работу крупнейшую на заводе установку первичной переработки нефти АВТ-1 производительностью 18.590 тонн в сутки (49% мощности НПЗ), аварийно остановленную 12 мая из-за пожара."
}
},
{
"d":"2025-01-31",
"prostredek":"drony",
"co":"Požár po pádu trosek dronu, rychle uhašen.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 17. 3. 2025",
"url":"https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"archiv":"http://web.archive.org/web/20260521202956/https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"citace":"На НПЗ Лукойла в Волгограде произошел пожар в ночь на 31 января в результате падения обломков БПЛА"
}
},
{
"d":"2025-02-03",
"prostredek":"drony",
"co":"Rafinerie po útoku dronů havarijně zcela zastavena, do 12. 2. částečně obnovena.",
"dopad":2,
"obnova":"asi 9 dní (částečně)",
"obnovaDni":9,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 17. 3. 2025",
"url":"https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"archiv":"http://web.archive.org/web/20260521202956/https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"citace":"полностью аварийно остановленный 3 февраля 2025 года после атаки дронов, частично возобновил переработку нефтяного сырья к 12 февраля"
}
},
{
"d":"2025-08-14",
"prostredek":"drony",
"co":"Útoky 13. a 14. 8. zcela zastavily zpracování ropy; gubernátor potvrdil požár.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 13. 2. 2026",
"url":"https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"archiv":"http://web.archive.org/web/20260614095609/https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"citace":"НПЗ Волгограднефтепереработка 13 и 14 августа подвергся атакам БПЛА, в результате которых переработка нефти была полностью остановлена."
}
},
{
"d":"2025-08-18",
"prostredek":"drony",
"co":"Další požár v areálu po útoku dronů.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 13. 2. 2026",
"url":"https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"archiv":"http://web.archive.org/web/20260614095609/https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"citace":"18 августа произошел пожар на территории Волгоградского НПЗ после атаки БПЛА."
}
},
{
"d":"2025-09-18",
"prostredek":"drony",
"co":"Místní hlásili výbuchy u rafinerie, Ukrajina oznámila zásah.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Ukrajinska pravda, 18. 9. 2025 (odkaz z Wikipedie)",
"url":"https://www.pravda.com.ua/eng/news/2025/09/18/7531370/index.amp",
"archiv":"http://web.archive.org/web/20260623015346/https://www.pravda.com.ua/eng/news/2025/09/18/7531370/index.amp/",
"citace":null
}
},
{
"d":"2025-10-15",
"prostredek":"drony",
"co":"Místní hlásili výbuchy a požáry v rafinerii.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Euromaidan Press, 15. 10. 2025 (odkaz z Wikipedie)",
"url":"https://euromaidanpress.com/2025/10/15/volgograd-oil-refinery-hit-repeatedly-as-ukraine-targets-fuel-supplies-for-russian-military-operations/",
"archiv":"http://web.archive.org/web/20251024120536/https://euromaidanpress.com/2025/10/15/volgograd-oil-refinery-hit-repeatedly-as-ukraine-targets-fuel-supplies-for-russian-military-operations/",
"citace":null
}
},
{
"d":"2025-11-06",
"prostredek":"drony",
"co":"Zastavení zpracování; poškozena primární jednotka AVT-5 (20 %) a jednotka hydrokrakování (11 000 t/den).",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 13. 2. 2026",
"url":"https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"archiv":"http://web.archive.org/web/20260614095609/https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"citace":"Волгоградский НПЗ Лукойла остановил переработку нефти 6 ноября после атаки БПЛА"
}
},
{
"d":"2025-12-26",
"prostredek":"drony",
"co":"Hlášen zásah rafinerie, letiště uzavřeno.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Censor.net, 26. 12. 2025 (odkaz z Wikipedie)",
"url":"https://censor.net/en/videonews/3592428/drones-attacked-volgograd-airport-closed-oil-refinery-may-have-been-hit",
"archiv":null,
"citace":null
}
},
{
"d":"2026-02-11",
"prostredek":"drony",
"co":"Rafinerie se zcela zastavila po požáru; poškozena mj. hlavní jednotka AVT-1 (40 % kapacity).",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 13. 2. 2026",
"url":"https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"archiv":"http://web.archive.org/web/20260614095609/https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"citace":"НПЗ Волгограднефтепереработка Лукойла полностью остановился с 11 февраля из-за пожара"
}
},
{
"d":"2026-05-29",
"prostredek":"drony",
"co":"Zastavení zpracování; poškozeny jednotky AVT-1 (40 %), AVT-6 (32 %) a AVT-5 (19 %) – tedy prakticky všechny primární kapacity.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":"~91 % primární kapacity",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"НПЗ Волгограднефтепереработка Лукойла остановил переработку нефтяного сырья с 29 мая из-за пожара, возникшего в результате атаки БПЛА"
}
},
{
"d":"2026-07-31",
"prostredek":"drony",
"co":"Rafinerie znovu přerušila zpracování po útoku; gubernátor potvrdil požár průmyslového objektu.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"http://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"НПЗ Волгограднефтепереработка прекращал переработку нефтяного сырья после атаки БПЛА 31 июля, 29 мая, 11 февраля."
}
},
{
"d":"2026-10-02",
"prostredek":"drony",
"co":"Podle zdrojů Reuters rafinerie po poškození zařízení zcela zastavila zpracování ropy.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá rafinerie (~280 tis. barelů/den)",
"overeni":"over",
"zdroj":{
"nazev":"Meduza, 6. 10. 2026 (výsledek hledání)",
"url":"https://meduza.io/en/news/2026/10/06/another-russian-refinery-goes-offline-volgograd-plant-shuts-down-completely-after-ukrainian-drone-attack-reuters-reports",
"archiv":"http://web.archive.org/web/20261104135416/https://meduza.io/en/news/2026/10/06/another-russian-refinery-goes-offline-volgograd-plant-shuts-down-completely-after-ukrainian-drone-attack-reuters-reports",
"citace":null
}
},
{
"d":"2026-11-13",
"prostredek":"drony",
"co":"Požár přes 3 500 m², zahynuli 4 zaměstnanci; ukrajinský GŠ hlásí zásah jednotek AVT-1, -3, -5, -6 a hydrorafinace. Podle Rand rafinerie ztratila asi polovinu kapacity; ve městě fronty u pump.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"~ polovina kapacity (odhad Rand)",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times rus. (data Rand Corp.), 16. 11. 2026",
"url":"https://ru.themoscowtimes.com/2026/11/16/tri-krupneishih-snabzhayuschih-moskvu-npz-ostanovilis-posle-serii-udarov-ukraini-a211484",
"archiv":"http://web.archive.org/web/20261118012244/https://ru.themoscowtimes.com/2026/11/16/tri-krupneishih-snabzhayuschih-moskvu-npz-ostanovilis-posle-serii-udarov-ukraini-a211484",
"citace":"Волгоградский НПЗ (13 ноября) и Новоуфимский НПЗ (31 октября) лишились половины мощностей"
}
}
]
},
{
"id":"saratov",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinerie Saratov",
"vlastnik":"Rosněfť",
"misto":"Saratov, Saratovská oblast",
"gps":[
51.451,
45.944
],
"vyznam":"Rafinerie Rosněfti na Volze s jedinou primární jednotkou – každý zásah ji zastaví celou; zásobuje Povolží i armádu (nedaleko základny Engels).",
"kapacita":{
"hodnota":20000,
"jednotka":"t ropy/den",
"popis":"jediná primární jednotka AVT-6 (nominálně, ≈ 7 mil. t/rok)",
"historie":[
[
2024,
5.8,
"skutečné zpracování v mil. t (Reuters), 2,2 % ruského zpracování"
]
],
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"была остановлена установка первичной переработки нефти АВТ-6 номинальной мощностью 20.000 тонн в сутки - единственная на предприятии."
}
},
"stav":{
"k":"2026-11-10",
"provoz":"neznamo",
"text":"Po útoku 7. 11. 2026 satelitní snímky ukazují poškození hlavní jednotky ELOU-AVT-6 a visbreakingu; oficiální údaj o provozu chybí. Předtím stála po útoku 11. 9. 2026.",
"zdroj":{
"nazev":"Militarnyi, 10. 11. 2026 (výsledek hledání)",
"url":"https://militarnyi.com/en/news/ukraine-strike-saratov-oil-refinery-damaged-processing-units-tanks/",
"archiv":"http://web.archive.org/web/20261112162824/https://militarnyi.com/en/news/ukraine-strike-saratov-oil-refinery-damaged-processing-units-tanks/",
"citace":null
}
},
"neuplne":"Meduza 11. 11. 2025 psala o 7. útoku v roce 2025 – část útoků z 2025 je jen ve formě tvrzení. Datum „21. listopadu“ ve verzi factboxu z 8. 7. 2026 je pravděpodobně chyba (pozdější verze uvádí 21. března 2026).",
"zasahy":[
{
"d":"2024-11-08",
"prostredek":"drony",
"co":"Ruští činitelé uvedli, že rafinerie byla při útoku dronů poškozena.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Independent, 8. 11. 2024 (odkaz z Wikipedie)",
"url":"https://kyivindependent.com/russian-authorities-claim-city-of-saratov-targeted-by-drone/",
"archiv":"http://web.archive.org/web/20260509143703/https://kyivindependent.com/russian-authorities-claim-city-of-saratov-targeted-by-drone/",
"citace":null
}
},
{
"d":"2025-02-11",
"prostredek":"drony",
"co":"Požár po útoku; zpracování z bezpečnostních důvodů přerušeno na 1–2 dny, hlavní jednotky nepoškozeny.",
"dopad":2,
"obnova":"1–2 dny",
"obnovaDni":2,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 17. 3. 2025",
"url":"https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"archiv":"http://web.archive.org/web/20260521202956/https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"citace":"завод приостановил переработку нефтяного сырья в целях безопасности на 1-2 дня, при этом основные установки предприятия не пострадали."
}
},
{
"d":"2025-08-10",
"prostredek":"drony",
"co":"Rozsáhlý požár (zachytila NASA FIRMS), jeden mrtvý; úřady potvrdily poškození průmyslového objektu.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"odhad",
"zdroj":{
"nazev":"Reuters, 10. 8. 2025 (odkaz z Wikipedie)",
"url":"https://www.reuters.com/world/ukraine-drone-attack-kills-one-damages-industrial-facility-saratov-russia-says-2025-08-10/",
"archiv":null,
"citace":null
}
},
{
"d":"2025-09-16",
"prostredek":"drony",
"co":"Ukrajinská armáda ohlásila zapálení rafinerie.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Kyiv Independent, 16. 9. 2025 (odkaz z Wikipedie)",
"url":"https://kyivindependent.com/ukrainian-strike-sets-russias-saratov-oil-refinery-ablaze-military-reports/",
"archiv":"http://web.archive.org/web/20260607142551/https://kyivindependent.com/ukrainian-strike-sets-russias-saratov-oil-refinery-ablaze-military-reports/",
"citace":null
}
},
{
"d":"2025-09-20",
"prostredek":"drony",
"co":"Pět až sedm výbuchů, požár v rafinerii (videa místních).",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Militarnyi, 20. 9. 2025 (odkaz z Wikipedie)",
"url":"https://militarnyi.com/en/news/ukrainian-drones-strike-saratov-and-novokuibyshev-refineries-causing-fires-on-territory-of-plants/",
"archiv":"http://web.archive.org/web/20260928203459/https://militarnyi.com/en/news/ukrainian-drones-strike-saratov-and-novokuibyshev-refineries-causing-fires-on-territory-of-plants/",
"citace":null
}
},
{
"d":"2025-10-16",
"prostredek":"drony",
"co":"Místní hlásili výbuchy a požár v rafinerii, zásah potvrdily ukrajinské speciální síly.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"UNN, 16. 10. 2025 (odkaz z Wikipedie)",
"url":"https://unn.ua/en/news/russia-reported-a-night-drone-attack-in-several-regions-engels-and-saratov-with-an-oil-refinery-were-hit-power-outages-occurred",
"archiv":"http://web.archive.org/web/20260430140147/https://unn.ua/en/news/russia-reported-a-night-drone-attack-in-several-regions-engels-and-saratov-with-an-oil-refinery-were-hit-power-outages-occurred",
"citace":null
}
},
{
"d":"2025-11-11",
"prostredek":"drony",
"co":"Rafinerie zastavila zpracování; útok se opakoval 14. 11. Podle zdrojů stála zhruba do konce listopadu.",
"dopad":3,
"obnova":"asi 3 týdny (do konce listopadu)",
"obnovaDni":20,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 13. 2. 2026",
"url":"https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"archiv":"http://web.archive.org/web/20260614095609/https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"citace":"Саратовский НПЗ Роснефти прекратил переработку нефти 11 ноября после атаки БПЛА, которая повторилась 14 ноября"
}
},
{
"d":"2025-11-14",
"prostredek":"drony",
"co":"Opakovaný útok na už stojící rafinerii, požár zachytila NASA FIRMS.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 13. 2. 2026",
"url":"https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"archiv":"http://web.archive.org/web/20260614095609/https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"citace":"По их данным, завод полностью остановлен ориентировочно до конца ноября."
}
},
{
"d":"2025-11-28",
"prostredek":"drony",
"co":"Ukrajinský generální štáb ohlásil zásah, hlášen požár.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Kyiv Independent, 28. 11. 2025 (odkaz z Wikipedie)",
"url":"https://kyivindependent.com/ukraine-strikes-saratov-oil-refinery-airfield-in-russian-occupied-crimea-multiple-other-military-targets-general-staff-says/",
"archiv":"http://web.archive.org/web/20260712185600/https://kyivindependent.com/ukraine-strikes-saratov-oil-refinery-airfield-in-russian-occupied-crimea-multiple-other-military-targets-general-staff-says/",
"citace":null
}
},
{
"d":"2025-12-13",
"prostredek":"drony",
"co":"Výbuchy u rafinerie; gubernátor potvrdil dva mrtvé v Saratově.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"The Moscow Times, 13. 12. 2025 (odkaz z Wikipedie)",
"url":"https://www.themoscowtimes.com/2025/12/13/ukrainian-drones-kill-2-in-saratov-a91433",
"archiv":"http://web.archive.org/web/20260719060421/https://www.themoscowtimes.com/2025/12/13/ukrainian-drones-kill-2-in-saratov-a91433",
"citace":null
}
},
{
"d":"2026-03-21",
"prostredek":"drony",
"co":"Rafinerie zastavila zpracování po útoku dronů.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"http://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"НПЗ прекратил переработку 21 марта после атаки БПЛА."
}
},
{
"d":"2026-05-31",
"prostredek":"drony",
"co":"Zastavena jediná primární jednotka AVT-6 – rafinerie stojí.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá rafinerie (~20 000 t/den)",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Саратовский НПЗ Роснефти прекратил переработку нефти с 31 мая из-за повреждений в результате атаки БПЛА"
}
},
{
"d":"2026-07-08",
"prostredek":"drony",
"co":"Rafinerie znovu zastavena po poškození a požárech.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"http://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"НПЗ останавливал переработку нефти из-за атаки БПЛА 2 августа , 8 июля , 31 мая ."
}
},
{
"d":"2026-08-02",
"prostredek":"drony",
"co":"Další zastavení zpracování po útoku.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"http://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"НПЗ останавливал переработку нефти из-за атаки БПЛА 2 августа , 8 июля , 31 мая ."
}
},
{
"d":"2026-09-11",
"prostredek":"drony",
"co":"Rafinerie zcela zastavila zpracování (téže noci zasažen i sklad Ozon).",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"http://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Саратовский НПЗ полностью прекратил переработку нефтяного сырья с 11 сентября после атаки БПЛА."
}
},
{
"d":"2026-11-07",
"prostredek":"drony",
"co":"Přes 40 výbuchů v Saratově a Engelsu, požáry v areálu; satelitní snímky ukazují zásahy jednotky ELOU-AVT-6, visbreakingu, potrubí a nádrží.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"odhad",
"zdroj":{
"nazev":"Militarnyi, 10. 11. 2026 (výsledek hledání)",
"url":"https://militarnyi.com/en/news/ukraine-strike-saratov-oil-refinery-damaged-processing-units-tanks/",
"archiv":"http://web.archive.org/web/20261112162824/https://militarnyi.com/en/news/ukraine-strike-saratov-oil-refinery-damaged-processing-units-tanks/",
"citace":null
}
}
]
},
{
"id":"syzran",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinerie Syzraň",
"vlastnik":"Rosněfť",
"misto":"Syzraň, Samarská oblast",
"gps":[
53.08,
48.39
],
"vyznam":"Jedna ze tří rafinerií Rosněfti v Samarské oblasti; vyrábí benzin a naftu i pro letiště a jednotky armády. Hlavní jednotka AVT-6 tvoří 70 % kapacity, proto ji útoky opakovaně zastavují.",
"kapacita":{
"hodnota":8.5,
"jednotka":"mil. t ropy/rok",
"popis":"nominální kapacita",
"historie":[
[
2024,
4.3,
"skutečné zpracování (Reuters)"
]
],
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 17. 3. 2025",
"url":"https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"archiv":"http://web.archive.org/web/20260521202956/https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"citace":"Сызранский НПЗ Роснефти мощностью 8,5 миллиона тонн в год был атакован БПЛА 4 марта 2025 года"
}
},
"stav":{
"k":"2026-11-25",
"provoz":"mimo",
"text":"Po zářijovém útoku byla rafinerie mimo provoz zhruba dva měsíce; 25. 11. 2026 ji další útok znovu dočasně zastavil (podle Militarnyi/Euronews).",
"zdroj":{
"nazev":"Militarnyi, 25. 11. 2026 (výsledek hledání)",
"url":"https://militarnyi.com/en/news/ukrainian-drones-strike-syzran-and-kuibyshev-oil-refineries-in-russia-s-samara-region/",
"archiv":null,
"citace":null
}
},
"neuplne":"Útoky z 30. 8. 2025, 28. 12. 2025, 4. 8. a 8. 8. 2026 doložené jen tvrzením nebo médii jsou označeny „tvrz“. Moscow Times 16. 11. 2026 psala, že se rafinerie po září neobnovila – odlišné od zprávy o dvouměsíční opravě.",
"zasahy":[
{
"d":"2024-03-16",
"prostredek":"drony",
"co":"Požár hlavní jednotky AVT-6 (17 110 t/den, 70 % kapacity); gubernátor potvrdil útok.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"~17 100 t ropy/den (70 %)",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 17. 3. 2025",
"url":"https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"archiv":"http://web.archive.org/web/20260521202956/https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"citace":"Горела установка первичной переработки нефти АВТ-6 производительностью 17.110 тонн в сутки (6 миллионов тонн нефти в год, 70% номинальной мощности НПЗ)."
}
},
{
"d":"2025-02-19",
"prostredek":"drony",
"co":"Požár na jednotce AVT-6; opravy ještě probíhaly, když přišel další útok 4. 3.",
"dopad":2,
"obnova":"asi 2 týdny",
"obnovaDni":13,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 17. 3. 2025",
"url":"https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"archiv":"http://web.archive.org/web/20260521202956/https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"citace":"4 марта на АВТ-6 завершались работы по устранению последствий предыдущего налета БПЛА, произошедшего 19 февраля 2025 года, который также привел к возгоранию на АВТ-6."
}
},
{
"d":"2025-03-04",
"prostredek":"drony",
"co":"Opět požár hlavní jednotky AVT-6, těsně před dokončením oprav.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 17. 3. 2025",
"url":"https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"archiv":"http://web.archive.org/web/20260521202956/https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"citace":"Сызранский НПЗ Роснефти мощностью 8,5 миллиона тонн в год был атакован БПЛА 4 марта 2025 года, в результате чего возникло возгорание на первичной установке АВТ-6."
}
},
{
"d":"2025-08-15",
"prostredek":"drony",
"co":"Zastavení zpracování po poškození AVT-6; do té doby rafinerie zpracovávala ~16 000 t ropy denně.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"~16 000 t ropy/den",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 13. 2. 2026",
"url":"https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"archiv":"http://web.archive.org/web/20260614095609/https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"citace":"Сызранский НПЗ Роснефти в результате атаки БПЛА 15 августа остановил переработку нефти из-за повреждения АВТ-6 мощностью 17.100 тонн в сутки."
}
},
{
"d":"2025-11-22",
"prostredek":"drony",
"co":"Ruská strana ohlásila útok dronů na rafinerii.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"RBC-Ukrajina, 22. 11. 2025 (odkaz z Wikipedie)",
"url":"https://newsukraine.rbc.ua/news/russia-reports-drone-strike-on-syzran-oil-1763814237.html",
"archiv":"http://web.archive.org/web/20260614171422/https://newsukraine.rbc.ua/news/russia-reports-drone-strike-on-syzran-oil-1763814237.html",
"citace":null
}
},
{
"d":"2025-12-05",
"prostredek":"drony",
"co":"Zastavení zpracování po poškození technologického zařízení.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 13. 2. 2026",
"url":"https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"archiv":"http://web.archive.org/web/20260614095609/https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"citace":"Сызранский НПЗ Роснефти приостановил переработку нефти из-за повреждения технологического оборудования в результате атаки БПЛА 5 декабря"
}
},
{
"d":"2026-04-18",
"prostredek":"drony",
"co":"Zastavena jednotka AVT-6 (71 % kapacity) – rafinerie přerušila zpracování.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"~17 100 t ropy/den (71 %)",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"на НПЗ остановлена установка первичной переработки нефти АВТ-6 производительностью 17.100 тонн в сутки (71% мощности НПЗ)."
}
},
{
"d":"2026-05-21",
"prostredek":"drony",
"co":"Úplné zastavení po poškození AVT-6; gubernátor potvrdil útok na průmyslové objekty, dva mrtví ve městě.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Сызранский НПЗ Роснефти полностью остановил переработку сырья с 21 мая из-за повреждения установки первичной переработки АВТ-6 в результате атаки БПЛА"
}
},
{
"d":"2026-07-12",
"prostredek":"drony",
"co":"Zastavení zpracování po poškození druhé primární jednotky AVT-5 (29 %).",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"http://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"НПЗ останавливал переработку 12 июля из-за повреждения АВТ-5 мощностью 7.100 тонн в сутки (29%)"
}
},
{
"d":"2026-08-08",
"prostredek":"drony",
"co":"Ukrajinský GŠ ohlásil zásah, hlášen požár (téže noci i Ilskij).",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Kyiv Independent, 8. 8. 2026 (odkaz z Wikipedie)",
"url":"https://kyivindependent.com/russian-oil-refineries-reportedly-struck-by-ukraine-in-samara-oblast-krasnodar-krai/",
"archiv":"http://web.archive.org/web/20260809030100/https://kyivindependent.com/russian-oil-refineries-reportedly-struck-by-ukraine-in-samara-oblast-krasnodar-krai/",
"citace":null
}
},
{
"d":"2026-09-15",
"prostredek":"drony",
"co":"Zastavení po poškození AVT-6 (71 %); podle Militarnyi následovaly zhruba dva měsíce oprav.",
"dopad":4,
"obnova":"asi 2 měsíce",
"obnovaDni":60,
"vypadek":"~17 100 t ropy/den (71 %)",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"http://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Сызранский НПЗ остановил переработку нефти 15 сентября из-за атаки БПЛА. Была повреждена, в частности, первичная установка АВТ-6 производительностью 17.100 тонн в сутки (71% мощности НПЗ)"
}
},
{
"d":"2026-11-25",
"prostredek":"drony",
"co":"Velký požár, rafinerie dočasně zastavila zpracování; gubernátor potvrdil útok, jeden mrtvý.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Militarnyi, 25. 11. 2026 (výsledek hledání)",
"url":"https://militarnyi.com/en/news/ukrainian-drones-strike-syzran-and-kuibyshev-oil-refineries-in-russia-s-samara-region/",
"archiv":null,
"citace":null
}
}
]
},
{
"id":"novokujbysevsk",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinerie Novokujbyševsk",
"vlastnik":"Rosněfť",
"misto":"Novokujbyševsk, Samarská oblast",
"gps":[
53.1,
49.91
],
"vyznam":"Největší ze samarských rafinerií Rosněfti, vyrábí i letecké palivo; od 30. 10. 2026 podle Rand zcela stojí.",
"kapacita":{
"hodnota":23600,
"jednotka":"t ropy/den",
"popis":"dvě primární jednotky AVT-11 (18 900 t/den, 80 %) a AVT-9 (4 700 t/den), ≈ 8,6 mil. t/rok",
"historie":[
[
2024,
5.74,
"skutečné zpracování v mil. t (Reuters)"
]
],
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"на заводе остановлены обе первичные установки - АВТ-11 производительностью 18.900 тонн в сутки (80% мощности НПЗ) и АВТ-9 (4.700 тонн в сутки, 20%)."
}
},
"stav":{
"k":"2026-11-23",
"provoz":"mimo",
"text":"Po útoku 30. 10. 2026 rafinerie podle Rand Corp. zcela zastavila výrobu a 23. 11. stále stála.",
"zdroj":{
"nazev":"The Moscow Times rus., 23. 11. 2026",
"url":"https://ru.themoscowtimes.com/2026/11/23/odin-iz-poslednih-npz-na-yuge-rossii-ostanovilsya-posle-ataki-bpla-a812548",
"archiv":null,
"citace":"Помимо Новошахтинского ЗПН полностью прекратили переработку «Норси» в Нижегородской области, «Янос» в Ярославле и Новокуйбышевский НПЗ «Роснефти»."
}
},
"neuplne":"Řada útoků (2025–2026) je doložena jen ukrajinskými nebo ruskými telegramovými zdroji a je označena „tvrz“. Útok 23. 3. 2024 podle ruské strany odražen – nezahrnut.",
"zasahy":[
{
"d":"2025-03-10",
"prostredek":"drony",
"co":"HUR ohlásila zásah rafinerie.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Ukrinform, 10. 3. 2025 (odkaz z Wikipedie)",
"url":"https://www.ukrinform.net/rubric-ato/3968808-ukrainian-intelligence-strikes-novokuybyshevsk-oil-refinery-source.html",
"archiv":"http://web.archive.org/web/20260722023456/https://www.ukrinform.net/rubric-ato/3968808-ukrainian-intelligence-strikes-novokuybyshevsk-oil-refinery-source.html",
"citace":null
}
},
{
"d":"2025-06-27",
"prostredek":"drony",
"co":"Hlášen útok dronů na rafinerii, omezen letový provoz.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"NV, 27. 6. 2025 (odkaz z Wikipedie)",
"url":"https://english.nv.ua/nation/russian-oil-giant-rosneft-targeted-in-deep-drone-strike-flights-disrupted-50525428.html",
"archiv":"http://web.archive.org/web/20250720165328/https://english.nv.ua/nation/russian-oil-giant-rosneft-targeted-in-deep-drone-strike-flights-disrupted-50525428.html",
"citace":null
}
},
{
"d":"2025-08-02",
"prostredek":"drony",
"co":"Poškozena hlavní (atmosférická) kolona jednotky AVT-11 – rafinerie zastavila zpracování.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"~18 900 t ropy/den (80 %)",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 13. 2. 2026",
"url":"https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"archiv":"http://web.archive.org/web/20260614095609/https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"citace":"Новокуйбышевский НПЗ со 2 августа остановил переработку нефти после атаки БПЛА"
}
},
{
"d":"2025-09-20",
"prostredek":"drony",
"co":"Požár po útoku, vypnuty obě primární jednotky AVT-11 a AVT-9.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 13. 2. 2026",
"url":"https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"archiv":"http://web.archive.org/web/20260614095609/https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"citace":"Новокуйбышевский НПЗ Роснефти остановил с 20 сентября первичную переработку нефти после атаки БПЛА"
}
},
{
"d":"2025-11-27",
"prostredek":"drony",
"co":"Ruská média hlásila nový útok dronů na rafinerii.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Kyiv Post, 27. 11. 2025 (odkaz z Wikipedie)",
"url":"https://www.kyivpost.com/post/65113",
"archiv":"http://web.archive.org/web/20251209134251/https://www.kyivpost.com/post/65113",
"citace":null
}
},
{
"d":"2026-01-02",
"prostredek":"drony",
"co":"Hlášen zásah rafinerie.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Militarnyi, 2. 1. 2026 (odkaz z Wikipedie)",
"url":"https://militarnyi.com/en/news/drones-attack-oil-refinery-in-russia-s-samara-region/",
"archiv":"http://web.archive.org/web/20260721162829/https://militarnyi.com/en/news/drones-attack-oil-refinery-in-russia-s-samara-region/",
"citace":null
}
},
{
"d":"2026-04-18",
"prostredek":"drony",
"co":"Zastavena primární zpracování – obě jednotky AVT-11 a AVT-9.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Новокуйбышевский НПЗ Роснефти 18 апреля остановил первичную переработку нефти после атаки БПЛА"
}
},
{
"d":"2026-08-22",
"prostredek":"drony",
"co":"Hlášen útok a požár na rafinerii.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Kyiv Independent, 22. 8. 2026 (odkaz z Wikipedie)",
"url":"https://kyivindependent.com/major-oil-refinery-logistics-center-set-ablaze-in-reported-ukrainian-attack/",
"archiv":"http://web.archive.org/web/20260926063248/https://kyivindependent.com/major-oil-refinery-logistics-center-set-ablaze-in-reported-ukrainian-attack/",
"citace":null
}
},
{
"d":"2026-10-30",
"prostredek":"drony",
"co":"Obnovení ukrajinských úderů po krátké pauze: rozsáhlé požáry, zasažena mj. hydrorafinace nafty; gubernátor potvrdil útok, dva hasiči zahynuli. Podle Rand se výroba zcela zastavila.",
"dopad":3,
"obnova":"dosud neobnoveno (23. 11. 2026)",
"obnovaDni":null,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times rus. (data Rand Corp.), 16. 11. 2026",
"url":"https://ru.themoscowtimes.com/2026/11/16/tri-krupneishih-snabzhayuschih-moskvu-npz-ostanovilis-posle-serii-udarov-ukraini-a211484",
"archiv":"http://web.archive.org/web/20261118012244/https://ru.themoscowtimes.com/2026/11/16/tri-krupneishih-snabzhayuschih-moskvu-npz-ostanovilis-posle-serii-udarov-ukraini-a211484",
"citace":"Новокуйбышевский НПЗ (30 октября) остановил выпуск полностью"
}
}
]
},
{
"id":"kujbysev",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinerie Kujbyšev (Samara)",
"vlastnik":"Rosněfť",
"misto":"Samara, Samarská oblast",
"gps":[
53.102,
50.054
],
"vyznam":"Rafinerie Rosněfti přímo v Samaře se dvěma primárními jednotkami; vyrábí benzin a naftu pro Povolží.",
"kapacita":{
"hodnota":7.0,
"jednotka":"mil. t ropy/rok",
"popis":"nominální kapacita (jednotky AVT-4 a AVT-5 po ~10 000 t/den)",
"historie":[
[
2024,
4.7,
"skutečné zpracování (Reuters)"
]
],
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Номинальная мощность Куйбышевского НПЗ составляет 7,0 миллиона тонн нефти в год."
}
},
"stav":{
"k":"2026-11-26",
"provoz":"neznamo",
"text":"Po zářijovém útoku 2026 se podle Rand do poloviny listopadu neobnovila; 25. 11. 2026 satelitní snímky ukázaly poškozené primární a reformingové jednotky a požáry v parku nádrží.",
"zdroj":{
"nazev":"The Moscow Times rus. (data Rand Corp.), 16. 11. 2026",
"url":"https://ru.themoscowtimes.com/2026/11/16/tri-krupneishih-snabzhayuschih-moskvu-npz-ostanovilis-posle-serii-udarov-ukraini-a211484",
"archiv":"http://web.archive.org/web/20261118012244/https://ru.themoscowtimes.com/2026/11/16/tri-krupneishih-snabzhayuschih-moskvu-npz-ostanovilis-posle-serii-udarov-ukraini-a211484",
"citace":"После сентябрьских атак не восстановились Куйбышевский и Сызранский НПЗ"
}
},
"neuplne":"Méně častý cíl; možná chybí menší útoky z let 2025–2026.",
"zasahy":[
{
"d":"2023-07-28",
"prostredek":"sabotáž",
"co":"Média hlásila výbuch nálože v rafinerii (sabotáž); podrobnosti nepotvrzeny.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"CNN, 28. 7. 2023 (odkaz z Wikipedie)",
"url":"https://www.cnn.com/2023/07/28/europe/russia-taganrog-missile-strike-samara-intl/index.html",
"archiv":"http://web.archive.org/web/20260917025745/https://www.cnn.com/2023/07/28/europe/russia-taganrog-missile-strike-samara-intl/index.html",
"citace":null
}
},
{
"d":"2024-03-23",
"prostredek":"drony",
"co":"Požár po útoku dronu; rafinerie zastavila primární jednotku, zhruba polovinu výroby (potvrdil gubernátor).",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"~ polovina kapacity",
"overeni":"over",
"zdroj":{
"nazev":"Reuters, 25. 3. 2024 (odkaz z Wikipedie)",
"url":"https://www.reuters.com/world/europe/russias-kuibyshev-oil-refinery-halts-primary-unit-after-drone-attack-sources-2024-03-25/",
"archiv":"http://web.archive.org/web/20241001053908/https://www.reuters.com/world/europe/russias-kuibyshev-oil-refinery-halts-primary-unit-after-drone-attack-sources-2024-03-25/",
"citace":null
}
},
{
"d":"2025-08-28",
"prostredek":"drony",
"co":"Zastavení zpracování; poškozeny obě primární jednotky AVT-4 a AVT-5 a některé sekundární provozy.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá rafinerie (~20 000 t/den)",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 13. 2. 2026",
"url":"https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"archiv":"http://web.archive.org/web/20260614095609/https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"citace":"были повреждены обе установки первичной переработки нефти, которыми располагает НПЗ: АВТ-4 и АВТ-5 производительностью по 10.000 тонн нефти в сутки каждая."
}
},
{
"d":"2026-06-10",
"prostredek":"drony",
"co":"Zastaveno zpracování na obou primárních jednotkách.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Куйбышевский НПЗ Роснефти остановил переработку нефти 10 июня после БПЛА"
}
},
{
"d":"2026-09-22",
"prostredek":"drony",
"co":"Zastavení zpracování, zničeny tři nádrže; rafinerie se podle Rand do poloviny listopadu neobnovila.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"http://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Куйбышевский НПЗ остановил переработку нефти с 22 сентября после атаки БПЛА."
}
},
{
"d":"2026-11-25",
"prostredek":"drony",
"co":"Zásah a požár; satelitní snímky ukazují poškozené jednotky primárního zpracování a reformingu a požáry v parku nádrží; gubernátor potvrdil útok bez jmenování objektů.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"odhad",
"zdroj":{
"nazev":"Militarnyi, 26. 11. 2026 (výsledek hledání)",
"url":"https://militarnyi.com/en/news/ukraine-damage-primary-refining-units-kuibyshev-oil-refinery/",
"archiv":null,
"citace":null
}
}
]
},
{
"id":"astrachan_gpz",
"strana":"RU",
"druh":"plyn",
"nazev":"Plynárenský komplex Astrachaň (Astrachaňský GPZ)",
"vlastnik":"Gazprom",
"misto":"Aksarajskij, Astrachaňská oblast",
"gps":[
46.77,
48.11
],
"vyznam":"Jeden z největších ruských závodů na zpracování plynu a kondenzátu; důležitý dodavatel benzinu a nafty pro jih Ruska a producent síry.",
"kapacita":{
"hodnota":12.0,
"jednotka":"mld. m³ plynu/rok",
"popis":"zpracování plynu; navíc 3 mil. t plynového kondenzátu ročně",
"historie":[
[
2023,
1.648,
"zpracovaný kondenzát v mil. t (Reuters)"
],
[
2024,
1.8,
"zpracovaný stabilní kondenzát v mil. t (Reuters)"
]
],
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"http://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Мощность переработки Астраханского ГПЗ -12 миллиардов кубометров газа и 3 миллиона тонн газового конденсата"
}
},
"stav":{
"k":"2026-09-28",
"provoz":"castecne",
"text":"Po útoku 13. 5. 2026 zastavena výroba motorových paliv (klíčová jednotka na kondenzát, poškozena i část na zpracování sirovodíku); zprávy o obnovení jsem nenašel. Zpracování plynu pravděpodobně pokračuje.",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"http://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Астраханский ГПЗ остановил производство моторного топлива из-за возгорания, возникшего 13 мая после атаки БПЛА."
}
},
"neuplne":"Útok 17. 3. 2025 (gubernátor hlásil zapálené palivové zařízení v oblasti) nebyl jednoznačně přiřazen ke GPZ – nezahrnut.",
"zasahy":[
{
"d":"2025-02-03",
"prostredek":"drony",
"co":"Požár po pádu dronu (potvrdil gubernátor); podle Reuters zastavena výroba motorových paliv na několik měsíců.",
"dopad":4,
"obnova":"několik měsíců (předběžně do září 2025)",
"obnovaDni":210,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 17. 3. 2025",
"url":"https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"archiv":"http://web.archive.org/web/20260521202956/https://ru.themoscowtimes.com/2025/03/17/factbox-avarii-na-rossiyskikh-npz-v-2024-2025gg-a158204",
"citace":"атаке подвергся Астраханский ГПЗ Газпрома, который был вынужден остановить производство моторного на несколько месяцев, предварительно до сентября."
}
},
{
"d":"2025-09-22",
"prostredek":"drony",
"co":"Požár zasáhl kombinovanou jednotku na zpracování kondenzátu U-1.731 (3 mil. t/rok); výroba motorových paliv zastavena až do dubna 2026. Reuters příčinu neuvádí, ukrajinská média hovoří o útoku dronů.",
"dopad":4,
"obnova":"asi 7 měsíců (obnoveno v dubnu 2026)",
"obnovaDni":200,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Reuters factbox (The Moscow Times rus.), 13. 2. 2026",
"url":"https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"archiv":"http://web.archive.org/web/20260614095609/https://ru.themoscowtimes.com/2026/02/13/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a187126",
"citace":"Астраханский ГПЗ Газпрома остановил производство моторного топлива из-за возгорания, возникшего на предприятии 22 сентября"
}
},
{
"d":"2025-12-15",
"prostredek":"drony",
"co":"Ukrajinská armáda ohlásila zásah závodu (v té době stál).",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Kyiv Independent, 15. 12. 2025 (odkaz z Wikipedie)",
"url":"https://kyivindependent.com/ukrainian-forces-strike-russian-gas-processing-plant-military-says/",
"archiv":"http://web.archive.org/web/20260810134957/https://kyivindependent.com/ukrainian-forces-strike-russian-gas-processing-plant-military-says/",
"citace":null
}
},
{
"d":"2026-05-13",
"prostredek":"drony",
"co":"Požár po útoku (gubernátor: trosky dronu); zastavena klíčová jednotka na kondenzát a výroba motorových paliv, zasaženo i zařízení na sirovodík a síru. Opravy podle zdrojů na týdny až měsíce.",
"dopad":3,
"obnova":"týdny až měsíce",
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Ukrinform podle Reuters, 14. 5. 2026 (výsledek hledání)",
"url":"https://www.ukrinform.net/rubric-ato/4123474-gazproms-astrakhan-plant-halts-fuel-output-after-drone-attack-reuters.html",
"archiv":"http://web.archive.org/web/20260616220352/https://www.ukrinform.net/rubric-ato/4123474-gazproms-astrakhan-plant-halts-fuel-output-after-drone-attack-reuters.html",
"citace":null
}
}
]
},
{
"id":"feodosija_sklad",
"strana":"RU",
"druh":"sklad",
"nazev":"Ropný terminál a sklad Feodosija (Krym)",
"vlastnik":null,
"misto":"Feodosija, okupovaný Krym",
"gps":[
45.068,
35.394
],
"vyznam":"Největší sklad paliv na okupovaném Krymu; zásobuje poloostrov i ruské jednotky na jihu Ukrajiny.",
"kapacita":{
"hodnota":null,
"jednotka":null,
"popis":"kapacitu skladu se nepodařilo doložit",
"historie":[],
"zdroj":null
},
"stav":{
"k":"2026-06-07",
"provoz":"neznamo",
"text":"Poslední dohledaný zásah 7. 6. 2026; aktuální stav neznámý.",
"zdroj":null
},
"neuplne":"Neúplné, hlavně starší útoky (2022–2024) a drobné zásahy mohou chybět; řada zásahů 2025–2026 je doložena jen ukrajinským prohlášením.",
"zasahy":[
{
"d":"2024-10-07",
"prostredek":"drony a rakety",
"co":"Velký požár největšího ropného skladu na Krymu, evakuováno přes 1 000 obyvatel; hořelo několik dní.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times, 8. 10. 2024 (odkaz z Wikipedie)",
"url":"https://www.themoscowtimes.com/2024/10/08/over-1k-evacuated-after-ukraine-hits-annexed-crimeas-largest-oil-depot-a86596",
"archiv":"http://web.archive.org/web/20260812051530/https://www.themoscowtimes.com/2024/10/08/over-1k-evacuated-after-ukraine-hits-annexed-crimeas-largest-oil-depot-a86596",
"citace":null
}
},
{
"d":"2025-10-06",
"prostredek":"drony",
"co":"Útok na námořní ropný sklad, požár zachytila NASA FIRMS; ukrajinský GŠ zásah potvrdil.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"RBC-Ukrajina, 6. 10. 2025 (odkaz z Wikipedie)",
"url":"https://newsukraine.rbc.ua/news/ukraine-s-general-staff-confirms-strike-on-1759750148.html",
"archiv":"http://web.archive.org/web/20260808161713/https://newsukraine.rbc.ua/news/ukraine-s-general-staff-confirms-strike-on-1759750148.html",
"citace":null
}
},
{
"d":"2025-10-13",
"prostredek":"drony",
"co":"Šéf okupační správy Krymu potvrdil požár skladu po útoku dronů; podle SBU zasaženo pět nádrží.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Independent, 13. 10. 2025 (odkaz z Wikipedie)",
"url":"https://kyivindependent.com/oil-depot-ablaze-after-drone-attack-in-russian-occupied-crimea/",
"archiv":"http://web.archive.org/web/20260712185234/https://kyivindependent.com/oil-depot-ablaze-after-drone-attack-in-russian-occupied-crimea/",
"citace":null
}
},
{
"d":"2025-11-11",
"prostredek":"drony",
"co":"Ukrajina ohlásila zásah námořního ropného terminálu.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"RBC-Ukrajina, 11. 11. 2025 (odkaz z Wikipedie)",
"url":"https://newsukraine.rbc.ua/news/ukraine-strikes-russia-s-saratov-oil-refinery-1762856766.html",
"archiv":"http://web.archive.org/web/20260415191846/https://newsukraine.rbc.ua/news/ukraine-strikes-russia-s-saratov-oil-refinery-1762856766.html",
"citace":null
}
},
{
"d":"2026-04-08",
"prostredek":"drony",
"co":"Ukrajina ohlásila zásah nádrží ve Feodosiji.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"RBC-Ukrajina, 8. 4. 2026 (odkaz z Wikipedie)",
"url":"https://newsukraine.rbc.ua/news/ukrainian-forces-strike-russian-oil-terminal-1775648264.html",
"archiv":"http://web.archive.org/web/20260724220240/https://newsukraine.rbc.ua/news/ukrainian-forces-strike-russian-oil-terminal-1775648264.html",
"citace":null
}
},
{
"d":"2026-04-23",
"prostredek":"drony",
"co":"Požár ropného skladu po útoku dronů.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"NV, 23. 4. 2026 (odkaz z Wikipedie)",
"url":"https://english.nv.ua/amp/ukrainian-drone-strike-ignites-feodosia-oil-facility-50602398.html",
"archiv":"http://web.archive.org/web/20260430124019/https://english.nv.ua/amp/ukrainian-drone-strike-ignites-feodosia-oil-facility-50602398.html",
"citace":null
}
},
{
"d":"2026-06-07",
"prostredek":"drony",
"co":"Drony ukrajinských speciálních sil zasáhly sklady paliv v Semikolodcích a Feodosiji.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Kyiv Independent, 7. 6. 2026 (odkaz z Wikipedie)",
"url":"https://kyivindependent.com/drone-strike-damages-bridge-linking-occupied-crimea-to-southern-ukraine/",
"archiv":"http://web.archive.org/web/20260801155142/https://kyivindependent.com/drone-strike-damages-bridge-linking-occupied-crimea-to-southern-ukraine/",
"citace":null
}
}
]
},
{
"id":"rjazan",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinerie Rjazaň (Rjazaňská NPK)",
"vlastnik":"Rosněfť",
"misto":"Rjazaň, Rjazaňská oblast",
"gps":[
54.576,
39.744
],
"vyznam":"Jedna z největších ruských rafinerií (asi 5 % zpracování ropy v Rusku), zásobuje benzínem, naftou a leteckým palivem Moskvu a okolí. Spolu s Jaroslavlí patří k nejčastěji zasaženým rafineriím celé kampaně.",
"kapacita":{
"hodnota":17.1,
"jednotka":"mil. t ropy/rok",
"popis":"projektovaná kapacita zpracování ropy; skutečné zpracování 2023 podle Kommersantu (data Reuters), 2024 podle Reuters/The Moscow Times",
"historie":[
[
2023,
12.7,
"skutečné zpracování"
],
[
2024,
13.1,
"skutečné zpracování"
]
],
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters „Аварии на НПЗ…“, 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"https://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Завод переработал в 2024 году 13,1 миллиона тонн нефти, что составило 4,9% от общей нефтепереработки в РФ"
}
},
"stav":{
"k":"2026-11-26",
"provoz":"castecne",
"text":"Po útoku 15. 10. 2026 stojí hlavní primární jednotka AT-6 (asi polovina kapacity), ostatní primární jednotky (AVT-1, AVT-3, AVT-4) podle Reuters běží. Po útoku 5. 11. žádné další zastavení hlášeno nebylo; Reuters 18. 11. řadí Rjazaň mezi rafinerie s narušeným provozem.",
"zdroj":{
"nazev":"IntelliNews – Refinery strikes ledger (aktualizováno 26. 11. 2026)",
"url":"https://docs.google.com/spreadsheets/d/1AHjZvX9Hf-6jdKxcTE8Dw7f6O2_svY0kX54sqKPyU_s",
"archiv":null,
"citace":"Partly operating: AT-6 primary unit halted after 15 Oct strike; AVT-1, AVT-3, AVT-4 running"
}
},
"neuplne":"Seznam pokrývá útoky doložené v přehledech Reuters/The Moscow Times, IntelliNews a na Wikipedii. Útoky, kdy dopadly jen trosky bez škod, mohou chybět; u několika dat (27. 7. 2024, 26. 1. 2025, 20. 11. a 6. 12. 2025, 5. 11. 2026) je zásah doložen jen ukrajinskými nebo monitorovacími zdroji.",
"zasahy":[
{
"d":"2024-03-13",
"prostredek":"drony",
"co":"Čtyři drony zasáhly dvě ze čtyř primárních jednotek: AT-6 (asi 47,5 % kapacity) a AVT-4 (asi 23 %). Gubernátor potvrdil požár a zraněné. Obě jednotky se do provozu vrátily koncem března.",
"dopad":3,
"obnova":"asi 2–3 týdny",
"obnovaDni":18,
"vypadek":"asi 70 % primární kapacity rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters 2024, 21. 5. 2024",
"url":"https://ru.themoscowtimes.com/2024/05/21/factbox-avarii-na-rossiyskikh-npz-v-2024g-a131392",
"archiv":"https://web.archive.org/web/20260716045202/https://ru.themoscowtimes.com/2024/05/21/factbox-avarii-na-rossiyskikh-npz-v-2024g-a131392",
"citace":"13 марта на Рязанской НПК в результате атаки беспилотников были повреждены две установки первичной переработки"
}
},
{
"d":"2024-05-01",
"prostredek":"drony",
"co":"Požár na primární jednotce AVT-3 (17,6 % kapacity). Podle zdroje z odvětví bez podstatného vlivu na chod rafinerie.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters 2024, 21. 5. 2024",
"url":"https://ru.themoscowtimes.com/2024/05/21/factbox-avarii-na-rossiyskikh-npz-v-2024g-a131392",
"archiv":"https://web.archive.org/web/20260716045202/https://ru.themoscowtimes.com/2024/05/21/factbox-avarii-na-rossiyskikh-npz-v-2024g-a131392",
"citace":"пожар на Рязанской НПК не окажет существенного влияния на работу завода"
}
},
{
"d":"2024-07-27",
"prostredek":"drony",
"co":"Hlášen útok dronů na rafinerii při náletu na Rjazaň (současně na letiště Ďagilevo). Rozsah škod nezveřejněn.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"24tv.ua, 27. 7. 2024",
"url":"https://24tv.ua/vibuhi-ryazani-27072024-merezhi-pokazali-moment-obstrilu-mista_n2605828",
"archiv":"https://web.archive.org/web/20261025200447/https://24tv.ua/vibuhi-ryazani-27072024-merezhi-pokazali-moment-obstrilu-mista_n2605828",
"citace":null
}
},
{
"d":"2025-01-24",
"prostredek":"drony",
"co":"Požár po útoku dronů; rafinerie zastavila zpracování a železniční expedici paliv. Částečně obnoveno 11. 2. 2025.",
"dopad":3,
"obnova":"asi 2,5 týdne do částečné obnovy",
"obnovaDni":18,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"FOMAG, přehled Reuters „Аварии на российских НПЗ в 2024-2025гг“",
"url":"https://fomag.ru/news-streem/avarii_na_rossiyskikh_npz_v_2024_2025gg/",
"archiv":"https://web.archive.org/web/20260711181838/https://fomag.ru/news-streem/avarii_na_rossiyskikh_npz_v_2024_2025gg/",
"citace":"Рязанская НПК с 11 февраля частично возобновила переработку нефти и железнодорожные отгрузки светлых нефтепродуктов, остановленные в результате пожара 24 января."
}
},
{
"d":"2025-01-26",
"prostredek":"drony",
"co":"Další útok na rafinerii o dva dny později, hlášen požár.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"The Kyiv Independent, 26. 1. 2025",
"url":"https://kyivindependent.com/russias-ryazan-oil-refinery-in-flames-after-reported-drone-strike/",
"archiv":"https://web.archive.org/web/20260516060346/https://kyivindependent.com/russias-ryazan-oil-refinery-in-flames-after-reported-drone-strike/",
"citace":null
}
},
{
"d":"2025-02-24",
"prostredek":"drony",
"co":"Hořela hlavní primární jednotka AT-6 (přes 8 mil. t/rok, 48 % kapacity), rafinerie zastavila zpracování. Gubernátor potvrdil požár průmyslového objektu.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"asi 48 % kapacity (jednotka AT-6)",
"overeni":"over",
"zdroj":{
"nazev":"FOMAG, přehled Reuters",
"url":"https://fomag.ru/news-streem/avarii_na_rossiyskikh_npz_v_2024_2025gg/",
"archiv":"https://web.archive.org/web/20260711181838/https://fomag.ru/news-streem/avarii_na_rossiyskikh_npz_v_2024_2025gg/",
"citace":"на Рязанской НПК после атаки БПЛА загорелась установка первичной переработки нефти АТ-6 производительностью свыше 8 миллионов тонн в год (23.190 тонн в сутки, 48% мощности НПЗ)"
}
},
{
"d":"2025-08-02",
"prostredek":"drony",
"co":"Odstaveny primární jednotky AVT-3 a AVT-4, rafinerie jela jen na AT-6, tedy asi na polovinu kapacity.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"asi 20 000 t ropy denně (zhruba polovina kapacity)",
"overeni":"over",
"zdroj":{
"nazev":"Hydrocarbon Processing (Reuters), 8/2025",
"url":"https://www.hydrocarbonprocessing.com/news/2025/08/russias-ryazan-oil-refinery-halves-refining-capacity-after-drone-attacks/",
"archiv":"https://web.archive.org/web/20250917213623/https://www.hydrocarbonprocessing.com/news/2025/08/russias-ryazan-oil-refinery-halves-refining-capacity-after-drone-attacks/",
"citace":"two primary oil refining units were stopped following the drone attacks - CDU-3 with a capacity of 8,600 tonnes (t) per day, and CDU-4 with a capacity of 11,400 tpd."
}
},
{
"d":"2025-09-05",
"prostredek":"drony",
"co":"Požár zastavil hlavní jednotku AT-6 (23 200 t/den). Protože AVT-3 a AVT-4 stály už od srpna, rafinerie byla prakticky mimo provoz. Požár zachytily i družice NASA FIRMS.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026 (oddíl 2025)",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Рязанская НПК 5 сентября приостановила переработку нефтяного сырья на основной первичной установке АТ-6 мощностью 23.200 тонн в сутки"
}
},
{
"d":"2025-10-23",
"prostredek":"drony",
"co":"Požár zastavil druhou největší primární jednotku AVT-4. Gubernátor mluvil o pádu trosek dronu.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026 (oddíl 2025)",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Рязанская НПК приостановила с 23 октября переработку нефтяного сырья на второй по мощности первичной установке АВТ-4"
}
},
{
"d":"2025-11-15",
"prostredek":"drony",
"co":"Po požáru rafinerie zcela zastavila zpracování ropy, podruhé během měsíce.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Ukrinform (Reuters), 19. 11. 2025",
"url":"https://www.ukrinform.net/rubric-ato/4060389-ryazan-oil-refinery-suspends-operations-after-drone-attack-reuters.html",
"archiv":"https://web.archive.org/web/20260812174713/https://www.ukrinform.net/rubric-ato/4060389-ryazan-oil-refinery-suspends-operations-after-drone-attack-reuters.html",
"citace":"The Ryazan Oil Refinery of Rosneft, one of the largest in Russia, has suspended oil processing following a Ukrainian drone attack on November 15."
}
},
{
"d":"2025-11-20",
"prostredek":"drony",
"co":"Další útok, místní hlásili výbuchy a požár v areálu. Rozsah škod nezveřejněn.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Militarnyi, 20. 11. 2025",
"url":"https://militarnyi.com/uk/news/u-ryazani-drony-atakuvaly-odyn-iz-najbilshyh-npz-rosiyi/",
"archiv":"https://web.archive.org/web/20260416221632/https://militarnyi.com/uk/news/u-ryazani-drony-atakuvaly-odyn-iz-najbilshyh-npz-rosiyi/",
"citace":null
}
},
{
"d":"2025-12-06",
"prostredek":"drony",
"co":"Podle ukrajinské armády devátý úder na rafinerii v roce 2025, hlášeny zásahy sekundárních jednotek. Ruská strana škody nepotvrdila.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Kyiv Post, 6. 12. 2025",
"url":"https://www.kyivpost.com/post/65720",
"archiv":"https://web.archive.org/web/20251216001932/https://www.kyivpost.com/post/65720",
"citace":"Ukrainian Drones Hit Rosneft’s Ryazan Refinery Again – 9 Strikes This Year"
}
},
{
"d":"2026-05-15",
"prostredek":"drony",
"co":"Velký požár (hořely vakuové jednotky), rafinerie zcela zastavila provoz. Gubernátor potvrdil škody od trosek dronů, v oblasti zahynuli 4 lidé.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (Reuters), 20. 5. 2026",
"url":"https://www.themoscowtimes.com/2026/05/20/drone-strikes-force-central-russian-refineries-to-halt-or-cut-output-reuters-a92805",
"archiv":"https://web.archive.org/web/20261116190453/https://www.themoscowtimes.com/2026/05/20/drone-strikes-force-central-russian-refineries-to-halt-or-cut-output-reuters-a92805",
"citace":"Russia’s Ryazan refinery suspended operations completely on May 15"
}
},
{
"d":"2026-07-29",
"prostredek":"drony",
"co":"Útok na rafinerii (a sklad Wildberries). Podle satelitních snímků vyřazeny dvě ze čtyř primárních jednotek; podle Reuters stála rafinerie 2–3 týdny.",
"dopad":3,
"obnova":"2–3 týdny",
"obnovaDni":17,
"vypadek":"celá rafinerie po dobu odstávky",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (Reuters), 10. 9. 2026",
"url":"https://www.themoscowtimes.com/2026/09/10/rosnefts-ryazan-oil-refinery-shuts-down-after-drone-attack-industry-sources-say-a93678",
"archiv":"https://web.archive.org/web/20260916165438/https://www.themoscowtimes.com/2026/09/10/rosnefts-ryazan-oil-refinery-shuts-down-after-drone-attack-industry-sources-say-a93678",
"citace":"Following the July attack, the facility suspended operations for around two or three weeks, the industry sources said."
}
},
{
"d":"2026-09-06",
"prostredek":"drony",
"co":"Hořela hlavní jednotka CDU-6 (8 mil. t/rok, téměř polovina kapacity) a byla odstavena i CDU-4 (4 mil. t/rok); CDU-3 byla od května v opravě, takže rafinerie stála celá.",
"dopad":3,
"obnova":"až několik týdnů",
"obnovaDni":null,
"vypadek":"asi 12 mil. t/rok kapacity (CDU-6 a CDU-4)",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (Reuters), 10. 9. 2026",
"url":"https://www.themoscowtimes.com/2026/09/10/rosnefts-ryazan-oil-refinery-shuts-down-after-drone-attack-industry-sources-say-a93678",
"archiv":"https://web.archive.org/web/20260916165438/https://www.themoscowtimes.com/2026/09/10/rosnefts-ryazan-oil-refinery-shuts-down-after-drone-attack-industry-sources-say-a93678",
"citace":"The sources said the oil refinery's main unit, CDU-6, as well as another primary unit, CDU-4, were shut down after the attack."
}
},
{
"d":"2026-10-15",
"prostredek":"drony a rakety",
"co":"První úder po třídenní pauze. Gubernátor potvrdil požár v areálu; ruské ministerstvo obrany hlásilo sestřelení čtyř střel Flamingo a 69 dronů. Odstavena hlavní jednotka AT-6, poškozena potrubí, ostatní primární jednotky jely dál.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"asi polovina kapacity (jednotka AT-6)",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), Reuters, 16. 10. 2026",
"url":"https://ru.themoscowtimes.com/2026/10/16/snabzhayuschii-moskvu-npz-rosnefti-ostanovil-ustanovku-pererabotki-nefti-posle-ataki-bpla-a208878",
"archiv":"https://web.archive.org/web/20261024023026/https://ru.themoscowtimes.com/2026/10/16/snabzhayuschii-moskvu-npz-rosnefti-ostanovil-ustanovku-pererabotki-nefti-posle-ataki-bpla-a208878",
"citace":"приостановил переработку нефтяного сырья на одной из первичных установок из-за пожара, возникшего в результате атаки беспилотных летательных аппаратов (БПЛА) 15 октября"
}
},
{
"d":"2026-11-05",
"prostredek":"drony",
"co":"Na oblast útočilo přes 200 dronů. Gubernátor potvrdil požáry nejmenovaných průmyslových objektů v Rjazani; rafinerii jako cíl jmenují monitorovací kanály („nejméně šest zásahů“). Zastavení nehlášeno.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"IntelliNews – Refinery strikes ledger",
"url":"https://docs.google.com/spreadsheets/d/1AHjZvX9Hf-6jdKxcTE8Dw7f6O2_svY0kX54sqKPyU_s",
"archiv":null,
"citace":"governor Malkov confirmed more than 200 drones over the region and fires at unnamed industrial facilities in Ryazan from falling debris"
}
}
]
},
{
"id":"moskva",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Moskevská rafinerie (Kapotnja)",
"vlastnik":"Gazprom Něfť",
"misto":"Moskva, čtvrť Kapotnja",
"gps":[
55.65,
37.81
],
"vyznam":"Hlavní dodavatel benzínu a nafty pro Moskvu a Moskevskou oblast, leží přímo v hlavním městě. Její zastavení v létě 2026 bylo symbolem dosahu ukrajinských dronů.",
"kapacita":{
"hodnota":14,
"jednotka":"mil. t ropy/rok",
"popis":"jmenovitá kapacita zpracování ropy (podle Reuters asi 14 mil. t, jiné zdroje uvádějí kolem 12 mil. t)",
"historie":[
[
2024,
11.6,
"skutečné zpracování"
]
],
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"https://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Номинальная мощность Московского НПЗ составляет около 14 миллионов тонн нефти в год."
}
},
"stav":{
"k":"2026-11-26",
"provoz":"mimo",
"text":"Po úderu 20. 9. 2026 rafinerie zcela zastavila zpracování ropy (hořely obě primární jednotky). O opětovném spuštění nejsou do konce listopadu zprávy.",
"zdroj":{
"nazev":"IntelliNews – Refinery strikes ledger (aktualizováno 26. 11. 2026)",
"url":"https://docs.google.com/spreadsheets/d/1AHjZvX9Hf-6jdKxcTE8Dw7f6O2_svY0kX54sqKPyU_s",
"archiv":null,
"citace":"Crude processing halted after the 20 Sep 2026 strike."
}
},
"neuplne":"Útok 10. 7. 2026 (podle Euromaidan Press požár nádrže v Kapotni) není zahrnut, protože ho nepotvrdil nezávislý zdroj. Satelitní data a Reuters se rozcházejí v tom, zda rafinerie v červenci a srpnu 2026 částečně běžela.",
"zasahy":[
{
"d":"2024-09-01",
"prostredek":"drony",
"co":"Požár po masivním útoku dronů na Moskvu; rafinerie odstavila kombinovanou jednotku Euro+, která zajišťuje asi polovinu primárního zpracování.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"asi polovina kapacity (jednotka Euro+)",
"overeni":"over",
"zdroj":{
"nazev":"FOMAG, přehled Reuters",
"url":"https://fomag.ru/news-streem/avarii_na_rossiyskikh_npz_v_2024_2025gg/",
"archiv":"https://web.archive.org/web/20260711181838/https://fomag.ru/news-streem/avarii_na_rossiyskikh_npz_v_2024_2025gg/",
"citace":"Принадлежащий Газпромнефти Московский НПЗ остановил комбинированную установку переработки нефти (КУПН) Евро+ из-за пожара после атаки беспилотника 1 сентября 2024 года."
}
},
{
"d":"2026-05-17",
"prostredek":"drony",
"co":"Při rekordním útoku na Moskvu rafinerie preventivně zcela zastavila zpracování. Zařízení podle zdrojů poškozeno nebylo; Sobjanin uvedl, že „technologie nebyla narušena“.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá rafinerie (krátkodobě)",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Московский НПЗ полностью остановил переработку 17 мая из-за атаки БПЛА, сообщили источники. По их данным, в результате удара оборудование НПЗ не пострадало"
}
},
{
"d":"2026-06-16",
"prostredek":"drony",
"co":"Poškozena hlavní primární jednotka AVT-6 (21 400 t/den, 53 % kapacity), rafinerie byla nouzově odstavena a úplně zastavila zpracování. Škody potvrdil starosta Sobjanin.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"в результате удара была повреждена установка первичной переработки АВТ-6 производительностью 21.400 тонн в сутки (53% мощности НПЗ)"
}
},
{
"d":"2026-06-18",
"prostredek":"drony a rakety",
"co":"Jeden z největších útoků války (téměř 1000 dronů a střely). Hořely jednotky i nádrže, poškozena kombinovaná jednotka Euro+, nad Moskvou „černý déšť“, 17 zraněných. Podle Reuters rafinerie nejméně půl roku nepoběží.",
"dopad":4,
"obnova":"nejméně 6 měsíců (podle Reuters ne dříve než 2027)",
"obnovaDni":180,
"vypadek":"celá rafinerie (asi 11–12 mil. t ropy ročně)",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"По их данным, завод сможет возобновить работу минимум через полгода."
}
},
{
"d":"2026-09-20",
"prostredek":"drony a rakety",
"co":"„Největší“ útok na Moskvu (podle Zelenského i se střelami Flamingo). Hořely obě primární jednotky, AVT-6 (53 %) i Euro+ (47 %), a rafinerie znovu úplně zastavila zpracování. Opravy podle zdrojů na týdny.",
"dopad":4,
"obnova":"několik týdnů (podle zdrojů Reuters)",
"obnovaDni":null,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"Ukrajinska pravda (Reuters), 21. 9. 2026",
"url":"https://www.pravda.com.ua/eng/news/2026/09/21/8054511/",
"archiv":"https://web.archive.org/web/20261104193654/https://www.pravda.com.ua/eng/news/2026/09/21/8054511/",
"citace":"Reuters reports that the Moscow Oil Refinery has halted crude processing after both distillation units caught fire in a drone attack."
}
}
]
},
{
"id":"jaroslavl",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinerie Jaroslavl (Slavněfť-JANOS)",
"vlastnik":"Slavněfť (Rosněfť a Gazprom Něfť napůl)",
"misto":"Jaroslavl, Jaroslavská oblast",
"gps":[
57.546,
39.789
],
"vyznam":"Největší rafinerie severu evropského Ruska a jedna z pěti největších v zemi; zásobuje palivem Moskvu i sever Ruska. V roce 2026 jedna z nejčastěji napadaných rafinerií.",
"kapacita":{
"hodnota":15,
"jednotka":"mil. t ropy/rok",
"popis":"kapacita zpracování ropy (Wikipedie); skutečné zpracování 2024 podle Reuters",
"historie":[
[
2024,
14.9,
"skutečné zpracování"
]
],
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"https://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"За 2024 год ЯНОС переработал 14,9 миллиона тонн нефтяного сырья"
}
},
"stav":{
"k":"2026-11-26",
"provoz":"mimo",
"text":"Zpracování ropy stojí od úderu 17. 9. 2026 na hlavní jednotku AVT-3; jednotka AVT-4 byla v opravě už od konce srpna. Po útoku 3. 11. (požár, 2 zranění) obnovení provozu hlášeno nebylo.",
"zdroj":{
"nazev":"IntelliNews – Refinery strikes ledger (aktualizováno 26. 11. 2026)",
"url":"https://docs.google.com/spreadsheets/d/1AHjZvX9Hf-6jdKxcTE8Dw7f6O2_svY0kX54sqKPyU_s",
"archiv":null,
"citace":"Crude processing halted after the 17 Sep 2026 strike on AVT-3; AVT-4 already under repair since 28 Aug."
}
},
"neuplne":"Požár 1. 10. 2025 není zahrnut, gubernátor ho označil za technickou poruchu, ne útok dronů. Několik útoků z roku 2026 (14. 12. 2025, 26. 4., 19. 5., 22. 5., 6. 7., 17. 7. 2026) je doloženo jen ukrajinskými zdroji. Seznam proto ukazuje spíš spodní hranici.",
"zasahy":[
{
"d":"2024-01-29",
"prostredek":"drony",
"co":"První pokus o útok na Jaroslavskou oblast: podle gubernátora sestřelen dron u rafinerie, bez škod.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times, 29. 1. 2024",
"url":"https://www.themoscowtimes.com/2024/01/29/drone-strike-targets-oil-refinery-in-central-russias-yaroslavl-region-a83881",
"archiv":"https://web.archive.org/web/20260903010307/https://www.themoscowtimes.com/2024/01/29/drone-strike-targets-oil-refinery-in-central-russias-yaroslavl-region-a83881",
"citace":"The strike attempt marks the first in the Yaroslavl region since Moscow invaded Ukraine nearly two years ago."
}
},
{
"d":"2025-12-12",
"prostredek":"drony",
"co":"Hořela primární jednotka AVT-4 (asi třetina kapacity); rafinerie podle zdrojů zastavila výrobu paliv.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"asi třetina kapacity",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026 (oddíl 2025)",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Установка первичной переработки нефти АВТ-4 загорелась на НПЗ Славнефть-Ярославнефтеоргсинтез (ЯНОС) 12 декабря из-за атаки БПЛА"
}
},
{
"d":"2025-12-14",
"prostredek":"drony",
"co":"Druhý útok během tří dnů podle ukrajinských zpráv.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Militarnyi, 14. 12. 2025",
"url":"https://militarnyi.com/en/news/strike-drones-hit-one-of-russia-s-largest-oil-refineries-for-the-second-time-in-three-days/",
"archiv":null,
"citace":null
}
},
{
"d":"2026-03-28",
"prostredek":"drony",
"co":"Rozsáhlý požár v areálu zachycený družicemi NASA FIRMS. Gubernátor hlásil, že dron zasáhl dům a zabil dítě.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters, 28. 3. 2026",
"url":"https://www.reuters.com/world/ukrainian-drone-attack-russias-yaroslavl-region-kills-child-governor-says-2026-03-28/",
"archiv":"https://web.archive.org/web/20260328083745/https://www.reuters.com/world/ukrainian-drone-attack-russias-yaroslavl-region-kills-child-governor-says-2026-03-28/",
"citace":null
}
},
{
"d":"2026-04-26",
"prostredek":"drony",
"co":"Asi 15 výbuchů a velký požár; podle ukrajinských zdrojů zasažena vakuová jednotka.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Militarnyi, 26. 4. 2026",
"url":"https://militarnyi.com/en/news/drones-hit-one-of-russia-s-largest-oil-refineries-in-yaroslavl/",
"archiv":"https://web.archive.org/web/20260718235837/https://militarnyi.com/en/news/drones-hit-one-of-russia-s-largest-oil-refineries-in-yaroslavl/",
"citace":null
}
},
{
"d":"2026-05-08",
"prostredek":"drony",
"co":"Požár po útoku. JANOS od 8. 5. téměř přestal prodávat benzín na burze a podle Reuters jel asi na čtvrtinu kapacity.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"asi tři čtvrtiny kapacity",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (Reuters), 20. 5. 2026",
"url":"https://www.themoscowtimes.com/2026/05/20/drone-strikes-force-central-russian-refineries-to-halt-or-cut-output-reuters-a92805",
"archiv":"https://web.archive.org/web/20261116190453/https://www.themoscowtimes.com/2026/05/20/drone-strikes-force-central-russian-refineries-to-halt-or-cut-output-reuters-a92805",
"citace":"Yaroslavnefteorgsintez (YANOS), meanwhile, has been operating at around one-quarter of its nominal capacity since last week"
}
},
{
"d":"2026-05-19",
"prostredek":"drony",
"co":"Další požár na rafinerii podle ukrajinských zpráv.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Militarnyi, 19. 5. 2026",
"url":"https://militarnyi.com/en/news/drone-strike-russian-oil-refinery-yaroslavl/",
"archiv":"https://web.archive.org/web/20260706135012/https://militarnyi.com/en/news/drone-strike-russian-oil-refinery-yaroslavl/",
"citace":null
}
},
{
"d":"2026-05-22",
"prostredek":"drony",
"co":"Výbuchy, uzavřená silnice na Moskvu a letiště; zásah potvrdil prezident Zelenskyj.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Kyiv Post, 22. 5. 2026",
"url":"https://www.kyivpost.com/post/76670",
"archiv":"https://web.archive.org/web/20260611151151/https://www.kyivpost.com/post/76670",
"citace":"President Volodymyr Zelensky confirmed that Ukrainian drones hit an oil refinery in Russia’s Yaroslavl region overnight between Thursday and Friday."
}
},
{
"d":"2026-07-06",
"prostredek":"drony",
"co":"Drony SBU podle ukrajinských zdrojů zasáhly rafinerii a přečerpávací stanici u Jaroslavli.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"LIGA.net, 6. 7. 2026",
"url":"https://news.liga.net/en/war/news/russians-report-strikes-on-yaroslavl-and-the-leningrad-region-video",
"archiv":"https://web.archive.org/web/20260928055927/https://news.liga.net/en/war/news/russians-report-strikes-on-yaroslavl-and-the-leningrad-region-video",
"citace":null
}
},
{
"d":"2026-07-17",
"prostredek":"drony",
"co":"Generální štáb ukrajinské armády hlásí zásah rafinerie.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"The Kyiv Independent, 17. 7. 2026",
"url":"https://kyivindependent.com/ukraine-strikes-oil-refinery-in-russias-yaroslavl-oblast-vessels-in-black-azov-seas-among-other-targets-general-staff-says/",
"archiv":"https://web.archive.org/web/20260831232659/https://kyivindependent.com/ukraine-strikes-oil-refinery-in-russias-yaroslavl-oblast-vessels-in-black-azov-seas-among-other-targets-general-staff-says/",
"citace":null
}
},
{
"d":"2026-08-06",
"prostredek":"drony",
"co":"Trosky dronů zasáhly nádrže rafinerie, vznikl požár.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"https://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Пожар возник 6 августа в результате попадания обломков БПЛА в резервуары НПЗ в Ярославской области."
}
},
{
"d":"2026-08-28",
"prostredek":"drony",
"co":"Dva požáry, jeden mrtvý. Rafinerie odstavila dvě ze tří primárních jednotek (mezi nimi AVT-4).",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"asi dvě třetiny primární kapacity",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"https://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"ЯНОС остановил две из трех установок первичной переработки нефти после 28 августа."
}
},
{
"d":"2026-09-17",
"prostredek":"drony",
"co":"Zasažena hlavní primární jednotka AVT-3 (17 140 t/den, 40 % kapacity); rafinerie zcela zastavila zpracování ropy.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"https://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"ЯНОС остановил переработку нефтяного сырья 17 сентября после атаки БПЛА, повреждения получила основная установка АВТ-3 производительностью 17.140 тонн в сутки (40% мощности НПЗ)."
}
},
{
"d":"2026-11-03",
"prostredek":"drony",
"co":"Podle gubernátora odraženo 124 dronů, přesto byli zraněni dva zaměstnanci a poškozena infrastruktura; v rafinerii hořelo (ukrajinské zdroje hlásí tři ohniska).",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Fontanka.ru, 3. 11. 2026",
"url":"https://www.fontanka.ru/2026/11/03/76741484/",
"archiv":"https://web.archive.org/web/20261110033717/https://www.fontanka.ru/2026/11/03/76741484/",
"citace":"Из последствий — пожар на НПЗ в Ярославле"
}
}
]
},
{
"id":"kstovo",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinerie Kstovo (Lukoil-NORSI)",
"vlastnik":"Lukoil",
"misto":"Kstovo u Nižního Novgorodu, Nižněnovgorodská oblast",
"gps":[
56.106,
44.144
],
"vyznam":"Čtvrtá největší ruská rafinerie a druhý největší výrobce benzínu v zemi, největší rafinerie Lukoilu. Zásobuje centrální Rusko včetně Moskvy.",
"kapacita":{
"hodnota":17,
"jednotka":"mil. t ropy/rok",
"popis":"roční kapacita zpracování ropy (Reuters); v roce 2023 zpracovala 15,8 mil. t (Petromarket)",
"historie":[
[
2023,
15.8,
"skutečné zpracování (Petromarket)"
]
],
"zdroj":{
"nazev":"The Moscow Times (Reuters), 20. 5. 2026",
"url":"https://www.themoscowtimes.com/2026/05/20/drone-strikes-force-central-russian-refineries-to-halt-or-cut-output-reuters-a92805",
"archiv":"https://web.archive.org/web/20261116190453/https://www.themoscowtimes.com/2026/05/20/drone-strikes-force-central-russian-refineries-to-halt-or-cut-output-reuters-a92805",
"citace":"Nizhny Novgorodnefteorgsintez (NORSI), with annual capacity of 17 million tons, came under attack on May 20."
}
},
"stav":{
"k":"2026-11-26",
"provoz":"neznamo",
"text":"V září 2026 podle Reuters běžela asi na čtvrtinu kapacity. Po útoku 1. 11. hlásil gubernátor „značné poškození“ průmyslového podniku v Kstovském okrese. Aktuální výkon ani zastavení nebyly zveřejněny.",
"zdroj":{
"nazev":"IntelliNews – Refinery strikes ledger (aktualizováno 26. 11. 2026)",
"url":"https://docs.google.com/spreadsheets/d/1AHjZvX9Hf-6jdKxcTE8Dw7f6O2_svY0kX54sqKPyU_s",
"archiv":null,
"citace":"Partly operating (~25%) per September reports; fire and significant damage reported 1 Nov 2026, status since not known"
}
},
"neuplne":"Útok 29. 1. 2025 zasáhl hlavně sousední petrochemický závod Sibur-Kstovo, dopad na NORSI není jasný. Další hlášené útoky (13. 7., 3. 8. a 4. 11. 2025) nejsou zahrnuty, nebyly nezávisle ověřeny.",
"zasahy":[
{
"d":"2024-03-12",
"prostredek":"drony",
"co":"Požár po útoku dronu; rafinerie odstavila největší primární jednotku AVT-6 (asi polovina kapacity). Lukoil ji znovu spustil koncem června.",
"dopad":3,
"obnova":"asi 3 měsíce",
"obnovaDni":100,
"vypadek":"asi polovina kapacity (AVT-6)",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters 2024, 21. 5. 2024",
"url":"https://ru.themoscowtimes.com/2024/05/21/factbox-avarii-na-rossiyskikh-npz-v-2024g-a131392",
"archiv":"https://web.archive.org/web/20260716045202/https://ru.themoscowtimes.com/2024/05/21/factbox-avarii-na-rossiyskikh-npz-v-2024g-a131392",
"citace":"12 марта Нижегородский НПЗ (НОРСИ) Лукойла остановил крупнейшую первичную установку переработки нефти АВТ-6 после пожара, возникшего в результате атаки БПЛА."
}
},
{
"d":"2025-01-29",
"prostredek":"drony",
"co":"Požár v průmyslové zóně Kstova po útoku dronů (gubernátor). Zasažen byl hlavně petrochemický závod Sibur-Kstovo, který se zastavil do března; Ukrajina hlásila zásah rafinerie.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"odhad",
"zdroj":{
"nazev":"The Kyiv Independent, 29. 1. 2025",
"url":"https://kyivindependent.com/drone-strikes-target-multiple-russian-regions-hit-oil-refinery-in-nizhny-novgorod/",
"archiv":"https://web.archive.org/web/20260512180224/https://kyivindependent.com/drone-strikes-target-multiple-russian-regions-hit-oil-refinery-in-nizhny-novgorod/",
"citace":null
}
},
{
"d":"2025-10-05",
"prostredek":"drony",
"co":"Místní hlásili sérii výbuchů v rafinerii.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Censor.net, 5. 10. 2025",
"url":"https://censor.net/en/videonews/3577904/series-of-explosions-at-the-kstovo-oil-refinery-drone-attack",
"archiv":"https://web.archive.org/web/20251024100413/https://censor.net/en/videonews/3577904/series-of-explosions-at-the-kstovo-oil-refinery-drone-attack",
"citace":null
}
},
{
"d":"2025-10-16",
"prostredek":"drony",
"co":"Požár; podle ukrajinských zdrojů pravděpodobně poškozena hydrogenační jednotka L-24/300 a část provozu zastavena.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Militarnyi, 16. 10. 2025",
"url":"https://militarnyi.com/en/news/drones-attacked-lukoil-nizhegorodnefteorgsintez-facility-shut-down-and-on-fire/",
"archiv":"https://web.archive.org/web/20260420084749/https://militarnyi.com/en/news/drones-attacked-lukoil-nizhegorodnefteorgsintez-facility-shut-down-and-on-fire/",
"citace":"Drones attacked a refinery in Kstovo: the L-24/300 facility was likely damaged."
}
},
{
"d":"2026-04-05",
"prostredek":"drony",
"co":"Rafinerie pozastavila zpracování. Gubernátor potvrdil požár a poškození Novogorkovské teplárny, která rafinerii dodává páru a elektřinu.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"НОРСИ приостановил переработку нефти после атаки БПЛА 5 апреля, сообщили источники."
}
},
{
"d":"2026-05-18",
"prostredek":"drony",
"co":"Generální štáb ukrajinské armády hlásí zásah rafinerie Lukoilu v Kstovu.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"ZN.ua, 18. 5. 2026",
"url":"https://zn.ua/ukr/war/henshtab-pidtverdiv-udari-po-npz-lukojla-v-kstovo-ta-nps-bilja-jaroslavlja.html",
"archiv":"https://web.archive.org/web/20261101145849/https://zn.ua/ukr/war/henshtab-pidtverdiv-udari-po-npz-lukojla-v-kstovo-ta-nps-bilja-jaroslavlja.html",
"citace":null
}
},
{
"d":"2026-05-20",
"prostredek":"drony",
"co":"Odstavena hlavní primární jednotka AVT-6 (25 700 t/den, 53 % kapacity). Gubernátor potvrdil požáry v Kstovském okrese.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"53 % kapacity",
"overeni":"over",
"zdroj":{
"nazev":"Euromaidan Press (Reuters), 22. 5. 2026",
"url":"https://euromaidanpress.com/2026/05/22/russias-4th-largest-oil-refinery-in-kstovo-halts-its-main-crude-unit-after-20-may-attack/",
"archiv":"https://web.archive.org/web/20260524123923/https://euromaidanpress.com/2026/05/22/russias-4th-largest-oil-refinery-in-kstovo-halts-its-main-crude-unit-after-20-may-attack/",
"citace":"The Lukoil-owned plant's CDU-6 unit, accounting for 53% of refinery capacity, processes 25,700 tonnes of crude per day, Reuters says."
}
},
{
"d":"2026-06-24",
"prostredek":"drony",
"co":"Poškozena primární jednotka AVT-5 (12 000 t/den, 25 %), rafinerie zastavila zpracování. Při útoku na oblast zahynuli dva lidé.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"The Kyiv Independent (Reuters), 25. 6. 2026",
"url":"https://kyivindependent.com/russias-4th-largest-oil-refinery-shuts-down-after-ukrainian-drone-strike-reuters-reports/",
"archiv":"https://web.archive.org/web/20260827165625/https://kyivindependent.com/russias-4th-largest-oil-refinery-shuts-down-after-ukrainian-drone-strike-reuters-reports/",
"citace":"The facility went offline on June 24 after a drone strike, two industry sources told Reuters."
}
},
{
"d":"2026-07-02",
"prostredek":"drony",
"co":"Poškozena hlavní jednotka AVT-6 (25 700 t/den, 53 % kapacity), rafinerie znovu zastavila zpracování ropy.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"НПЗ Нижегороднефтеоргсинтез (НОРСИ) Лукойла со 2 июля остановил переработку нефти после атаки БПЛА, сообщили источники. По их данным, повреждена первичная установка АВТ-6"
}
},
{
"d":"2026-08-26",
"prostredek":"drony",
"co":"Velký požár, rafinerie popáté za necelých pět měsíců zastavila zpracování. Všechny velké rafinerie Lukoilu v Rusku tím stály.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"Euromaidan Press, 27. 8. 2026",
"url":"https://euromaidanpress.com/2026/08/27/ukrainian-drones-shut-all-major-lukoil-refineries-russia/",
"archiv":null,
"citace":"NORSI’s fifth drone-related shutdown leaves all major Lukoil refineries in Russia offline"
}
},
{
"d":"2026-11-01",
"prostredek":"drony",
"co":"Masivní útok (přes 100 sestřelených dronů). Gubernátor: průmyslový podnik v Kstovském okrese „značně poškozen“. Podle Astry hořelo kolem primárních jednotek AVT-5, AVT-6 a visbreakingu; úřady vyzvaly řidiče, ať nepanikaří u čerpacích stanic.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Interfax, 1. 11. 2026",
"url":"https://www.interfax.ru/russia/1126365",
"archiv":"https://web.archive.org/web/20261102025553/https://www.interfax.ru/russia/1126365",
"citace":"одно из промышленных предприятий получило значительные повреждения"
}
}
]
},
{
"id":"kirisi",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinerie Kiriši (KINEF)",
"vlastnik":"Surgutněftěgaz",
"misto":"Kiriši, Leningradská oblast",
"gps":[
59.489,
32.077
],
"vyznam":"Druhá největší ruská rafinerie (asi 6–7 % zpracování ropy v zemi), velký vývozce nafty a mazutu přes baltské přístavy.",
"kapacita":{
"hodnota":20,
"jednotka":"mil. t ropy/rok",
"popis":"jmenovitá kapacita; skutečné zpracování 2022 podle Reuters, 2023 podle Energybase, 2024 podle Reuters",
"historie":[
[
2022,
17.0,
"skutečné zpracování"
],
[
2023,
17.7,
"skutečné zpracování"
],
[
2024,
17.5,
"skutečné zpracování"
]
],
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"https://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Номинальная мощность Кинефа составляет 20 миллионов тонн нефти в год, а фактическая переработка в последние годы - около 18 миллионов тонн"
}
},
"stav":{
"k":"2026-11-26",
"provoz":"mimo",
"text":"Podle Reuters rafinerie po úderu 30. 8. 2026 zcela zastavila zpracování; satelitní analýza mluví o vyřazení asi 60 % kapacity. Obnovení hlášeno nebylo. Útok 9. 11. zasáhl ještě odstavený závod (podle ukrajinského GŠ poškozena atmosférická destilace).",
"zdroj":{
"nazev":"IntelliNews – Refinery strikes ledger (aktualizováno 26. 11. 2026)",
"url":"https://docs.google.com/spreadsheets/d/1AHjZvX9Hf-6jdKxcTE8Dw7f6O2_svY0kX54sqKPyU_s",
"archiv":null,
"citace":"Reuters says completely shut after the 30 Aug 2026 strike; a satellite assessment puts ~60% out."
}
},
"neuplne":null,
"zasahy":[
{
"d":"2024-03-13",
"prostredek":"drony",
"co":"Dron sestřelen nad rafinerií, bez škod a bez přerušení provozu.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters 2024, 21. 5. 2024",
"url":"https://ru.themoscowtimes.com/2024/05/21/factbox-avarii-na-rossiyskikh-npz-v-2024g-a131392",
"archiv":"https://web.archive.org/web/20260716045202/https://ru.themoscowtimes.com/2024/05/21/factbox-avarii-na-rossiyskikh-npz-v-2024g-a131392",
"citace":"C начала года были зафиксированы атаки БПЛА, не приведшие к сбоям в работе, на следующие энергетические объекты: Киришский НПЗ Сургутнефтегаза"
}
},
{
"d":"2025-03-08",
"prostredek":"drony",
"co":"Trosky dronu poškodily vnější plášť nádrže; zpracování se nezastavilo.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026 (oddíl 2025)",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Кинеф не останавливал переработку нефти после атаки дронов 8 марта"
}
},
{
"d":"2025-09-14",
"prostredek":"drony",
"co":"Požár (potvrdil gubernátor Drozdenko), primární jednotka AT-6 zastavena zhruba na měsíc.",
"dopad":3,
"obnova":"asi 1 měsíc",
"obnovaDni":30,
"vypadek":"asi 40 % kapacity (jednotka AT-6)",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026 (oddíl 2025)",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Кинеф приостановил примерно на месяц переработку нефти на первичной установке АТ-6 из-за пожара после атаки БПЛА 14 сентября"
}
},
{
"d":"2025-10-04",
"prostredek":"drony",
"co":"Požár v průmyslové zóně (gubernátor); zastavena nejvýkonnější primární jednotka AVT-6, oprava podle Reuters asi měsíc.",
"dopad":3,
"obnova":"asi 1 měsíc",
"obnovaDni":30,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026 (oddíl 2025)",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Кинеф остановил переработку нефти на наиболее мощной первичной установке АВТ-6 из-за пожара, произошедшего в результате атаки БПЛА 4 октября"
}
},
{
"d":"2026-03-26",
"prostredek":"drony",
"co":"Rozsáhlý požár zachycený NASA FIRMS (druhá noc útoků na energetiku Leningradské oblasti); rafinerie zastavila zpracování, mohla se vrátit na omezený výkon.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"НПЗ Киришинефтеоргсинтез (Кинеф) Сургутнефтегаза остановил переработку нефти из-за пожара, произошедшего в результате атаки БПЛА 26 марта"
}
},
{
"d":"2026-05-05",
"prostredek":"drony",
"co":"Poškozeny tři ze čtyř primárních jednotek a několik sekundárních; rafinerie zcela mimo provoz (ještě 20. 5. podle Reuters stála).",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá rafinerie (20 mil. t/rok)",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (Reuters), 6. 5. 2026",
"url":"https://www.themoscowtimes.com/2026/05/06/leningrad-regions-kirishi-oil-refinery-halts-operations-after-drone-strike-reuters-a92696",
"archiv":"https://web.archive.org/web/20260716082140/https://www.themoscowtimes.com/2026/05/06/leningrad-regions-kirishi-oil-refinery-halts-operations-after-drone-strike-reuters-a92696",
"citace":"three of the refinery’s four crude distillation units and several secondary units were damaged in the attack."
}
},
{
"d":"2026-07-09",
"prostredek":"drony",
"co":"Podle zpráv zasažena rafinerie; rozsah škod neznámý.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"NV.ua, 9. 7. 2026",
"url":"https://english.nv.ua/russian-war/drone-attack-reportedly-hits-major-oil-refinery-in-russia-s-leningrad-oblast-50622964.html",
"archiv":"https://web.archive.org/web/20261006232951/https://english.nv.ua/russian-war/drone-attack-reportedly-hits-major-oil-refinery-in-russia-s-leningrad-oblast-50622964.html",
"citace":"Drones reportedly struck the Kirishinefteorgsintez refinery in Russia’s Leningrad Oblast"
}
},
{
"d":"2026-08-30",
"prostredek":"drony",
"co":"Velký požár; podle Reuters rafinerie zcela zastavila zpracování. Satelitní snímky ukazují zásahy primárních jednotek ELOU-AVT-6 a ELOU-AT-1 i sekundárních jednotek, vyřazeno asi 60 % kapacity.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":"podle Reuters celá rafinerie, podle satelitů asi 60 %",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"https://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Кинеф полностью остановил переработку нефти в результате атаки БПЛА 30 августа."
}
},
{
"d":"2026-11-09",
"prostredek":"drony",
"co":"Gubernátor potvrdil zásah průmyslové zóny Kiriši (přes 80 sestřelených dronů), ruské MO uvedlo rafinerii mezi napadenými. Astra ověřila nejméně dva požáry v areálu. Podle ukrajinského GŠ poškozena atmosférická destilace a dvě chladicí jednotky.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Kyiv Independent, 9. 11. 2026",
"url":"https://kyivindependent.com/ukrainian-forces-reportedly-strike-russias-second-largest-oil-refinery-in-overnight-drone-attack/",
"archiv":"https://web.archive.org/web/20261118074821/https://kyivindependent.com/ukrainian-forces-reportedly-strike-russias-second-largest-oil-refinery-in-overnight-drone-attack/",
"citace":"Ukraine strikes Russia's second-largest oil refinery in overnight drone attack, Russian governor says"
}
}
]
},
{
"id":"uchta",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinerie Uchta (Lukoil-Uchtaněftěpererabotka)",
"vlastnik":"Lukoil",
"misto":"Uchta, Republika Komi",
"gps":[
63.572,
53.724
],
"vyznam":"Menší rafinerie na severu Ruska, asi 1,1 % ruského zpracování ropy. Útok v únoru 2026 byl rekordně daleko, asi 1 750 km od Ukrajiny.",
"kapacita":{
"hodnota":4.2,
"jednotka":"mil. t ropy/rok",
"popis":"projektovaná kapacita (IntelliNews, Wikipedie); skutečné zpracování 2025 podle Reuters",
"historie":[
[
2025,
3.0,
"skutečné zpracování (přibližně)"
]
],
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"https://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"НПЗ Ухтанефтепереработка за 2025 год переработал около 3 миллионов тонн нефти - 1,1% от общего объема переработки нефтяного сырья в РФ."
}
},
"stav":{
"k":"2026-11-26",
"provoz":"neznamo",
"text":"Po únorovém požáru a útoku 9. 10. 2026 žádná odstávka hlášena nebyla. Hlava Komi tvrdila, že infrastruktura poškozena není. Rafinerie zřejmě běží, potvrzeno to ale není.",
"zdroj":{
"nazev":"IntelliNews – Refinery strikes ledger (aktualizováno 26. 11. 2026)",
"url":"https://docs.google.com/spreadsheets/d/1AHjZvX9Hf-6jdKxcTE8Dw7f6O2_svY0kX54sqKPyU_s",
"archiv":null,
"citace":"No halt or Lukoil comment reported; status unchanged."
}
},
"neuplne":null,
"zasahy":[
{
"d":"2025-08-10",
"prostredek":"drony",
"co":"Drony poškodily rafinerii Lukoilu; video ukazovalo hořící nádrž.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Barents Observer, 10. 8. 2025",
"url":"https://www.thebarentsobserver.com/security/drones-hit-oil-refinery-in-ukhtanbsp/434840",
"archiv":"https://web.archive.org/web/20260509223314/https://www.thebarentsobserver.com/security/drones-hit-oil-refinery-in-ukhtanbsp/434840",
"citace":"A Lukoil refinery in the Komi Republic is damaged after a drone attack on Sunday."
}
},
{
"d":"2026-02-12",
"prostredek":"drony",
"co":"Hlava Komi potvrdila požár. Podle zdrojů Reuters hořela primární jednotka AVT-1 (asi 6 000 t/den, třetina kapacity).",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":"asi třetina kapacity",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"в результате удара БПЛА загорелась установка первичной переработки нефти АВТ-1 производительностью около 6.000 тонн в сутки - треть мощности НПЗ"
}
},
{
"d":"2026-10-09",
"prostredek":"drony",
"co":"Prezident Zelenskyj potvrdil úder drony An-196, Astra geolokovala kouř z areálu. Hlava Komi popřela poškození infrastruktury.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"NV.ua, 9. 10. 2026",
"url":"https://english.nv.ua/russian-war/zelenskyy-confirms-strikes-on-omsk-ukhta-refineries-and-russian-data-center-50648691.html",
"archiv":"https://web.archive.org/web/20261009144123/https://english.nv.ua/russian-war/zelenskyy-confirms-strikes-on-omsk-ukhta-refineries-and-russian-data-center-50648691.html",
"citace":"Ukraine hit Russian refineries in Omsk and Ukhta with FP-6 and An-196 RS drones and struck another data center, Zelenskyy said"
}
}
]
},
{
"id":"ufa",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinérský komplex Ufa (Bašněfť: Ufaněftěchim, Novoil, UNPZ)",
"vlastnik":"Bašněfť (Rosněfť)",
"misto":"Ufa, Baškortostán",
"gps":[
54.85,
56.1
],
"vyznam":"Tři sousední rafinerie Bašněftě na severu Ufy tvoří jeden z největších rafinérských uzlů v Rusku, asi 1 400 km od Ukrajiny.",
"kapacita":{
"hodnota":23.4,
"jednotka":"mil. t ropy/rok",
"popis":"součet projektovaných kapacit tří závodů (9,5 + 7,3 + 6,6). Zpracování 2024 podle Reuters: Ufaněftěchim 5,8, Ufimský NPZ 3,8, Novo-Ufimský 3,8 mil. t (stejné údaje u dvou závodů mohou být chybou přehledu).",
"historie":[
[
2024,
13.4,
"skutečné zpracování, součet tří závodů"
]
],
"zdroj":{
"nazev":"IntelliNews – Refinery strikes ledger",
"url":"https://docs.google.com/spreadsheets/d/1AHjZvX9Hf-6jdKxcTE8Dw7f6O2_svY0kX54sqKPyU_s",
"archiv":null,
"citace":"23.4 (three plants, 9.5 + 7.3 + 6.6)"
}
},
"stav":{
"k":"2026-11-26",
"provoz":"castecne",
"text":"Odstávka celého komplexu nebyla nikdy hlášena, jednotlivé jednotky jsou opakovaně v opravě. Po útoku 17. 11. 2026 baškirské úřady uvedly, že všechny závody běží normálně.",
"zdroj":{
"nazev":"Interfax, 17. 11. 2026",
"url":"https://www.interfax.ru/russia/1129456",
"archiv":"https://web.archive.org/web/20261117095259/https://www.interfax.ru/russia/1129456",
"citace":"Атакованы заводы в Уфе и Салавате, критических повреждений нет"
}
},
"neuplne":"Tři závody jsou sloučeny v jednom záznamu. U řady útoků z let 2025–2026 není jasné, který závod byl zasažen, a velká část je doložena jen ukrajinskými nebo OSINT zdroji. Hlášené útoky 1. 7., 27. 8. a 21. 9. 2026 nejsou zahrnuty, protože jsou nejasné.",
"zasahy":[
{
"d":"2024-10-31",
"prostredek":"drony",
"co":"Podle hlavy Baškortostánu dron poškodil rafinerii v Ufě (první útok na Ufu).",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Kyiv Independent, 31. 10. 2024",
"url":"https://kyivindependent.com/ukrainian-drone-strikes-russian-oil-refinery-1-500-km-from-ukrainian-border-russian-official-claims/",
"archiv":"https://web.archive.org/web/20261010143247/https://kyivindependent.com/ukrainian-drone-strikes-russian-oil-refinery-1-500-km-from-ukrainian-border-russian-official-claims/",
"citace":null
}
},
{
"d":"2025-03-03",
"prostredek":"drony",
"co":"Požár na Ufimském NPZ zasáhl jednotku hydrogenace nafty, uhašen týž den.",
"dopad":1,
"obnova":"týž den",
"obnovaDni":1,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"FOMAG, přehled Reuters",
"url":"https://fomag.ru/news-streem/avarii_na_rossiyskikh_npz_v_2024_2025gg/",
"archiv":"https://web.archive.org/web/20260711181838/https://fomag.ru/news-streem/avarii_na_rossiyskikh_npz_v_2024_2025gg/",
"citace":"Пожар, произошедший 3 марта на территории Уфимского НПЗ Роснефти, затронул установку гидроочистки дизельного топлива"
}
},
{
"d":"2025-09-13",
"prostredek":"drony",
"co":"Útok na Novo-Ufimský závod (Novoil), požár; podle místních úřadů provoz pokračoval normálně.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times, 14. 9. 2025",
"url":"https://www.themoscowtimes.com/2025/09/14/ukraine-hits-one-of-russias-largest-oil-refining-complexes-a90521",
"archiv":"https://web.archive.org/web/20260806143226/https://www.themoscowtimes.com/2025/09/14/ukraine-hits-one-of-russias-largest-oil-refining-complexes-a90521",
"citace":"The complex lies around 1,400 kilometers from the front line in Ukraine in Russia's republic of Bashkortostan."
}
},
{
"d":"2025-10-11",
"prostredek":"drony",
"co":"Drony SBU podle ukrajinské strany zasáhly závod Bašněfť-UNPZ, výbuch na jednotce zpracování ropy.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Ukrajinska pravda, 11. 10. 2025",
"url":"https://www.pravda.com.ua/news/2025/10/11/8002307/",
"archiv":"https://web.archive.org/web/20260430045113/https://www.pravda.com.ua/news/2025/10/11/8002307/",
"citace":null
}
},
{
"d":"2025-10-15",
"prostredek":"drony",
"co":"Ufaněftěchim: dron poškodil primární jednotku AVT-4 (8 570 t/den), zastavena byla možná i sousední AVT-3 o stejném výkonu.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":"jedna až dvě ze čtyř primárních jednotek závodu",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026 (oddíl 2025)",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"дрон повредил установку АВТ-4 мощностью 8.570 тонн в сутки"
}
},
{
"d":"2026-03-22",
"prostredek":"drony",
"co":"Výbuchy a kouř v průmyslové zóně u rafinerie podle místních.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"UNN, 22. 3. 2026",
"url":"https://unn.ua/en/news/explosions-and-gunshots-were-heard-in-ufa-russia-the-local-oil-refinery-was-under-threat",
"archiv":"https://web.archive.org/web/20261007015402/https://unn.ua/en/news/explosions-and-gunshots-were-heard-in-ufa-russia-the-local-oil-refinery-was-under-threat",
"citace":null
}
},
{
"d":"2026-04-02",
"prostredek":"drony",
"co":"Novoil: požár na primární jednotce AVT-5 (zdroje Reuters, satelitní snímky).",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"https://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Пожар произошел на Ново-Уфимском НПЗ 2 апреля на установке первичной переработки нефти АВТ-5 в результате атаки БПЛА."
}
},
{
"d":"2026-06-25",
"prostredek":"drony",
"co":"Ukrajinské zdroje hlásí zásahy klíčových rafinerií v Ufě (asi 1 400 km od Ukrajiny).",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"UNITED24 Media, 6/2026",
"url":"https://united24media.com/war-in-ukraine/key-ufa-refineries-hit-after-ukrainian-drones-fly-870-miles-into-russia-20154",
"archiv":"https://web.archive.org/web/20260928055412/https://united24media.com/war-in-ukraine/key-ufa-refineries-hit-after-ukrainian-drones-fly-870-miles-into-russia-20154",
"citace":null
}
},
{
"d":"2026-07-08",
"prostredek":"drony",
"co":"Drony Ljutyj zapálily rafinerii, nad rafinérským uzlem stoupal hustý černý dým.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"UNITED24 Media, 8. 7. 2026",
"url":"https://united24media.com/war-in-ukraine/ufa-oil-facility-burns-after-ukrainian-drone-strike-1400-kilometers-inside-russia-20559",
"archiv":"https://web.archive.org/web/20260722104434/https://united24media.com/war-in-ukraine/ufa-oil-facility-burns-after-ukrainian-drone-strike-1400-kilometers-inside-russia-20559",
"citace":null
}
},
{
"d":"2026-08-01",
"prostredek":"drony",
"co":"Ufaněftěchim: Astra geolokovala dva sloupy černého kouře nad rafinerií.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Kyiv Independent, 1. 8. 2026",
"url":"https://kyivindependent.com/fire-reported-at-major-russian-oil-refinery-in-ufa-following-drone-attack/",
"archiv":"https://web.archive.org/web/20260807125613/https://kyivindependent.com/fire-reported-at-major-russian-oil-refinery-in-ufa-following-drone-attack/",
"citace":"Geolocated footage by the independent Russian outlet ASTRA showed two columns of black smoke rising from the refinery."
}
},
{
"d":"2026-08-02",
"prostredek":"drony",
"co":"Druhý závod v Ufě během dvou dnů: zasažen Bašněfť-UNPZ (podle ukrajinských zdrojů).",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Militarnyi, 2. 8. 2026",
"url":"https://militarnyi.com/en/news/ukrainian-defense-forces-hit-bashneft-unpz-second-ufa-oil-refinery-targeted-in-two-days/",
"archiv":"https://web.archive.org/web/20260802165014/https://militarnyi.com/en/news/ukrainian-defense-forces-hit-bashneft-unpz-second-ufa-oil-refinery-targeted-in-two-days/",
"citace":null
}
},
{
"d":"2026-08-05",
"prostredek":"drony",
"co":"Novoil: podle GŠ ukrajinské armády zasažena kombinovaná jednotka a reformování L-35-11/1000.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Militarnyi, 5. 8. 2026",
"url":"https://militarnyi.com/uk/news/drony-urazyly-npz-bashneft-novojl/",
"archiv":"https://web.archive.org/web/20261102152103/https://militarnyi.com/uk/news/drony-urazyly-npz-bashneft-novojl/",
"citace":null
}
},
{
"d":"2026-08-19",
"prostredek":"drony",
"co":"Požár jednotky na rafinerii Bašněfť v Ufě.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"UNITED24 Media, 19. 8. 2026",
"url":"https://united24media.com/war-in-ukraine/russias-massive-235-million-ton-ufa-refining-hub-comes-under-ukrainian-drone-attack-21828",
"archiv":"https://web.archive.org/web/20260821063729/https://united24media.com/war-in-ukraine/russias-massive-235-million-ton-ufa-refining-hub-comes-under-ukrainian-drone-attack-21828",
"citace":null
}
},
{
"d":"2026-09-23",
"prostredek":"drony",
"co":"Požár v oblasti rafinerií hlásili obyvatelé a zachytily ho i družice NASA; úřady nic nepotvrdily.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), 23. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/23/v-raione-npz-v-ufe-i-samare-vspihnuli-pozhari-posle-naleta-dronov-a206724",
"archiv":"https://web.archive.org/web/20261101054350/https://ru.themoscowtimes.com/2026/09/23/v-raione-npz-v-ufe-i-samare-vspihnuli-pozhari-posle-naleta-dronov-a206724",
"citace":"В районе НПЗ в Уфе и Самаре вспыхнули пожары после налета дронов"
}
},
{
"d":"2026-10-31",
"prostredek":"drony",
"co":"Podle Astry hořela jednotka katalytického reformování na Novoilu; Bloomberg cituje osobu obeznámenou se zásahem. Ruské úřady škody nepotvrdily.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Interfax-Ukrajina, 31. 10. 2026",
"url":"https://en.interfax.com.ua/news/general/1229119.html",
"archiv":"https://web.archive.org/web/20261111140315/https://en.interfax.com.ua/news/general/1229119.html",
"citace":"triggering a fire at the Bashneft-Novoil oil refinery, where a catalytic reforming unit is likely burning, the OSINT project ASTRA reported."
}
},
{
"d":"2026-11-17",
"prostredek":"drony",
"co":"Útok na průmyslové zóny Ufy a Salavatu (přes 50 sestřelených dronů). Ukrajinské síly hlásí zásah Ufaněftěchimu; baškirské úřady tvrdí, že závody běží a kritické škody nejsou.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Interfax, 17. 11. 2026",
"url":"https://www.interfax.ru/russia/1129456",
"archiv":"https://web.archive.org/web/20261117095259/https://www.interfax.ru/russia/1129456",
"citace":"Отражена массированная атака БПЛА на промзоны Уфы и Салавата"
}
}
]
},
{
"id":"salavat",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Gazprom Něftěchim Salavat",
"vlastnik":"Gazprom (prodej holdingu Roschim ohlášen 11/2025)",
"misto":"Salavat, Baškortostán",
"gps":[
53.402,
55.895
],
"vyznam":"Jeden z největších ruských petrochemických komplexů: rafinerie plus výroba plastů, čpavku a hnojiv. Zpracovává asi 2,7 % ruské ropy.",
"kapacita":{
"hodnota":10,
"jednotka":"mil. t ropy/rok",
"popis":"projektovaná kapacita (IntelliNews, Wikipedie); skutečné zpracování 2024 podle Reuters",
"historie":[
[
2024,
7.2,
"skutečné zpracování"
]
],
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"https://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"За 2024 год Газпромнефтехим Салават переработал 7,2 миллиона тонн нефтяного сырья (2,7% от общего объема переработки в РФ)"
}
},
"stav":{
"k":"2026-11-26",
"provoz":"neznamo",
"text":"Po srpnovém úderu Reuters hlásil zastavení zpracování a obnovení zprávy nezmínily. Po útocích 8. 10. a 17. 11. ale místní úřady tvrdí, že podniky v průmyslové zóně běží. Skutečný stav je nejasný.",
"zdroj":{
"nazev":"IntelliNews – Refinery strikes ledger (aktualizováno 26. 11. 2026)",
"url":"https://docs.google.com/spreadsheets/d/1AHjZvX9Hf-6jdKxcTE8Dw7f6O2_svY0kX54sqKPyU_s",
"archiv":null,
"citace":"STATUS 'HALTED' (FROM AUGUST) NOT CHANGED, NOT RECONCILED WITH 'OPERATIONAL'."
}
},
"neuplne":null,
"zasahy":[
{
"d":"2024-05-09",
"prostredek":"drony",
"co":"První útok na Baškortostán: dron zasáhl technickou budovu komplexu katalytického krakování, který byl odstaven. Oprava asi 1,5 týdne.",
"dopad":2,
"obnova":"asi 1,5 týdne",
"obnovaDni":10,
"vypadek":"katalytické krakování (asi 600 tis. t benzínu ročně)",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters 2024, 21. 5. 2024",
"url":"https://ru.themoscowtimes.com/2024/05/21/factbox-avarii-na-rossiyskikh-npz-v-2024g-a131392",
"archiv":"https://web.archive.org/web/20260716045202/https://ru.themoscowtimes.com/2024/05/21/factbox-avarii-na-rossiyskikh-npz-v-2024g-a131392",
"citace":"Ожидается, что восстановительный ремонт займет около 1,5 недель."
}
},
{
"d":"2025-09-18",
"prostredek":"drony",
"co":"Útok potvrdil šéf Baškortostánu Chabirov, závod podle něj běží normálně.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026 (oddíl 2025)",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"По словам Хабирова, завод работает в штатном режиме после атак 18 и 24 сентября."
}
},
{
"d":"2025-09-24",
"prostredek":"drony",
"co":"Požár na primární jednotce AVT-6 (zdroje Reuters); podle Chabirova provoz nepřerušen.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026 (oddíl 2025)",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"после атаки дронов возник пожар на установке первичной переработки АВТ-6"
}
},
{
"d":"2026-07-14",
"prostredek":"drony",
"co":"Poškozeny obě primární jednotky CDU-6 (17 140 t/den) a CDU-4 (11 430 t/den); zpracování ropy zastaveno.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"https://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"НПЗ Газпромнефтехим Салават остановил переработку сырья с 14 июля после атаки БПЛА."
}
},
{
"d":"2026-08-13",
"prostredek":"drony",
"co":"Další útok a požáry; rafinerie podle zdrojů znovu stojí a obnovení nebylo hlášeno.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"IntelliNews – Refinery strikes ledger",
"url":"https://docs.google.com/spreadsheets/d/1AHjZvX9Hf-6jdKxcTE8Dw7f6O2_svY0kX54sqKPyU_s",
"archiv":null,
"citace":"Both primary units (CDU-6, CDU-4) damaged 14 Jul 2026 (Reuters); halted after the 13 Aug strike."
}
},
{
"d":"2026-10-08",
"prostredek":"drony",
"co":"Požár v průmyslové zóně; starosta Salavatu mluví o troskách dronu a tvrdí, že „postižený podnik“ dál pracuje. Ukrajinský GŠ hlásí velký požár.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"IntelliNews – Refinery strikes ledger",
"url":"https://docs.google.com/spreadsheets/d/1AHjZvX9Hf-6jdKxcTE8Dw7f6O2_svY0kX54sqKPyU_s",
"archiv":null,
"citace":"Salavat Mayor Marat Zagidullin said falling drone debris started a fire in the city's industrial zone and that 'the affected enterprise' remained operational"
}
},
{
"d":"2026-11-17",
"prostredek":"drony",
"co":"Ukrajinský GŠ hlásí výbuchy a požár; baškirské úřady: přes 50 dronů sestřeleno, závody běží, bez kritických škod.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Interfax, 17. 11. 2026",
"url":"https://www.interfax.ru/russia/1129456",
"archiv":"https://web.archive.org/web/20261117095259/https://www.interfax.ru/russia/1129456",
"citace":"Отражена массированная атака БПЛА на промзоны Уфы и Салавата"
}
}
]
},
{
"id":"orsk",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinerie Orsk (Orskněftěorgsintez)",
"vlastnik":"ForteInvest",
"misto":"Orsk, Orenburská oblast",
"gps":[
51.251,
58.521
],
"vyznam":"Hlavní zdroj paliv pro Orenburskou oblast a sousední regiony Uralu. Po zastavení v srpnu 2026 musel kraj zavést přídělový systém benzínu.",
"kapacita":{
"hodnota":6.6,
"jednotka":"mil. t ropy/rok",
"popis":"projektovaná kapacita (Wikipedie, IntelliNews; Reuters uvádí jmenovitě 5,76 mil. t); skutečné zpracování 2024 podle Reuters",
"historie":[
[
2024,
4.2,
"skutečné zpracování"
]
],
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"https://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"За 2024 год ОрскНОС переработал 4,2 миллиона тонн нефтяного сырья"
}
},
"stav":{
"k":"2026-11-26",
"provoz":"mimo",
"text":"Od úderu 11. 8. 2026 rafinerie stojí. Gubernátor odhadl opravu dovezeného zařízení kvůli sankcím až na půl roku, tedy zhruba do února 2027. O obnovení nejsou zprávy.",
"zdroj":{
"nazev":"The Moscow Times, 13. 8. 2026",
"url":"https://www.themoscowtimes.com/2026/08/13/orsk-refinery-shutters-for-6-months-after-ukrainian-attack-a93489",
"archiv":"https://web.archive.org/web/20260928015848/https://www.themoscowtimes.com/2026/08/13/orsk-refinery-shutters-for-6-months-after-ukrainian-attack-a93489",
"citace":"Orsk Refinery Shutters for 6 Months After Ukrainian Attack"
}
},
"neuplne":null,
"zasahy":[
{
"d":"2025-10-03",
"prostredek":"drony",
"co":"Dron Ljutyj zasáhl rafinerii asi 1 500 km od Ukrajiny (záběry z místa).",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times, 3. 10. 2025",
"url":"https://www.themoscowtimes.com/2025/10/03/ukrainian-drones-hit-major-oil-refinery-chemical-plant-a90706",
"archiv":"https://web.archive.org/web/20260925083107/https://www.themoscowtimes.com/2025/10/03/ukrainian-drones-hit-major-oil-refinery-chemical-plant-a90706",
"citace":"Both facilities are located roughly 1,500 kilometers away from the Ukrainian border."
}
},
{
"d":"2025-11-11",
"prostredek":"drony",
"co":"Ukrajinský GŠ hlásí výbuchy a požár. Podle zdrojů Reuters rafinerie od 10. 11. zhruba na týden úplně zastavila zpracování kvůli „mimořádné situaci“.",
"dopad":2,
"obnova":"asi týden",
"obnovaDni":7,
"vypadek":"celá rafinerie",
"overeni":"odhad",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026 (oddíl 2025)",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"НПЗ Орскнефтеоргсинтез компании Фортеинвест полностью остановил переработку нефтяного сырья 10 ноября ориентировочно на неделю из-за возникшей на заводе нештатной ситуации"
}
},
{
"d":"2026-04-29",
"prostredek":"drony",
"co":"Výbuchy v Orsku, hlášen útok na rafinerii.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"RBC-Ukrajina, 29. 4. 2026",
"url":"https://newsukraine.rbc.ua/news/blasts-shake-russia-s-orsk-and-perm-as-major-1777448645.html",
"archiv":"https://web.archive.org/web/20260725133006/https://newsukraine.rbc.ua/news/blasts-shake-russia-s-orsk-and-perm-as-major-1777448645.html",
"citace":null
}
},
{
"d":"2026-08-11",
"prostredek":"drony",
"co":"Požár, poškozeny primární i sekundární jednotky. Gubernátor: rafinerie zcela odstavena, oprava dovezeného zařízení potrvá kvůli sankcím až šest měsíců. V oblasti zaveden přídělový prodej paliv.",
"dopad":4,
"obnova":"až 6 měsíců",
"obnovaDni":180,
"vypadek":"celá rafinerie (asi 4 mil. t ropy ročně)",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times, 13. 8. 2026",
"url":"https://www.themoscowtimes.com/2026/08/13/orsk-refinery-shutters-for-6-months-after-ukrainian-attack-a93489",
"archiv":"https://web.archive.org/web/20260928015848/https://www.themoscowtimes.com/2026/08/13/orsk-refinery-shutters-for-6-months-after-ukrainian-attack-a93489",
"citace":"The equipment is imported, and given the sanctions, repairs will take up to six months. The refinery has been completely shut down."
}
}
]
},
{
"id":"taneco",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinerie TANECO (Nižněkamsk)",
"vlastnik":"Tatněfť",
"misto":"Nižněkamsk, Tatarstán",
"gps":[
55.571,
51.902
],
"vyznam":"Jedna z nejmodernějších a největších ruských rafinerií (asi 6 % ruského zpracování) a velký výrobce nafty (8,5 mil. t ročně).",
"kapacita":{
"hodnota":17.0,
"jednotka":"mil. t ropy/rok",
"popis":"roční zpracování ropy 2024 (jmenovitá kapacita se uvádí kolem 16–17 mil. t); 2023 podle Tatar-inform",
"historie":[
[
2023,
17.1,
"skutečné zpracování"
],
[
2024,
17.0,
"skutečné zpracování"
]
],
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"https://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"За январь-декабрь 2024 года ТАНЕКО переработал 17,0 миллионов тонн нефти"
}
},
"stav":{
"k":"2026-11-26",
"provoz":"neznamo",
"text":"Po zářijovém zásahu hlavní jednotky ELOU-AVT-7 (podle satelitu) Tatarstán tvrdil, že výroba se nezastavila. Spolehlivé údaje o současném výkonu chybějí.",
"zdroj":{
"nazev":"IntelliNews – Refinery strikes ledger (aktualizováno 26. 11. 2026)",
"url":"https://docs.google.com/spreadsheets/d/1AHjZvX9Hf-6jdKxcTE8Dw7f6O2_svY0kX54sqKPyU_s",
"archiv":null,
"citace":"Unclear / partly operating"
}
},
"neuplne":"IntelliNews uvádí i útok 11. 1. 2025 a ukrajinské zdroje útok 31. 7. 2026; podrobnosti se nepodařilo ověřit, proto nejsou zahrnuty.",
"zasahy":[
{
"d":"2024-04-02",
"prostredek":"drony",
"co":"Dron zasáhl primární jednotku AVT-7 (21 250 t/den, asi polovina kapacity), vznikl požár. Podle regionálního zdroje šlo o nevýznamné škody.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters 2024, 21. 5. 2024",
"url":"https://ru.themoscowtimes.com/2024/05/21/factbox-avarii-na-rossiyskikh-npz-v-2024g-a131392",
"archiv":"https://web.archive.org/web/20260716045202/https://ru.themoscowtimes.com/2024/05/21/factbox-avarii-na-rossiyskikh-npz-v-2024g-a131392",
"citace":"По данным регионального источника, ущерб от атаки - несущественный."
}
},
{
"d":"2026-06-12",
"prostredek":"drony",
"co":"Útok a požáry zastavily obě primární jednotky, AVT-6 (20 000 t/den) i AVT-7 (asi 23 000 t/den); rafinerie úplně přestala zpracovávat ropu.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"НПЗ ТАНЕКО Татнефти полностью остановил переработку нефти с 12 июня после БПЛА"
}
},
{
"d":"2026-07-08",
"prostredek":"drony",
"co":"Hlášen útok na petrochemii v Nižněkamsku, ukrajinské zdroje uvádějí i TANECO.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"The Kyiv Independent, 8. 7. 2026",
"url":"https://kyivindependent.com/ukrainian-drones-reportedly-strike-russias-saratov-oil-refinery/",
"archiv":"https://web.archive.org/web/20260928165044/https://kyivindependent.com/ukrainian-drones-reportedly-strike-russias-saratov-oil-refinery/",
"citace":null
}
},
{
"d":"2026-08-10",
"prostredek":"drony",
"co":"Úder na Nižněkamsk zasáhl rafinerii TANECO; zahynulo 13 lidí, mezi nimi občané Uzbekistánu a Tádžikistánu. Rozsah škod na zařízení nezveřejněn.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"BBC News, 10. 8. 2026",
"url":"https://www.bbc.com/news/articles/cvgjvgv926po",
"archiv":"https://web.archive.org/web/20261026141111/https://www.bbc.com/news/articles/cvgjvgv926po",
"citace":null
}
},
{
"d":"2026-08-20",
"prostredek":"drony",
"co":"Drony FP-1 podle ukrajinských zdrojů zaútočily na rafinerii v Nižněkamsku.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Militarnyi, 20. 8. 2026",
"url":"https://militarnyi.com/en/news/drones-attack-oil-refinery-in-nizhnekamsk/",
"archiv":"https://web.archive.org/web/20260820222745/https://militarnyi.com/en/news/drones-attack-oil-refinery-in-nizhnekamsk/",
"citace":null
}
},
{
"d":"2026-09-13",
"prostredek":"drony",
"co":"Satelitní snímky ukazují zásah hlavní primární jednotky ELOU-AVT-7 (9,2 mil. t/rok, asi 52 % kapacity). Tatarstán tvrdí, že výroba se nezastavila.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"odhad",
"zdroj":{
"nazev":"Euromaidan Press, 18. 9. 2026",
"url":"https://euromaidanpress.com/2026/09/18/one-machine-handles-52-of-a-russian-oil-plant-ukrainian-drones-just-hit-it/",
"archiv":null,
"citace":"Satellite images show Ukrainian FP-1 drones hit the crude unit that handles 52% of Russia's TANECO refinery, 1,200 km from Ukraine."
}
}
]
},
{
"id":"taif_nk",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinerie TAIF-NK (Nižněkamsk)",
"vlastnik":"TAIF (skupina Sibur-RT)",
"misto":"Nižněkamsk, Tatarstán",
"gps":[
55.59,
51.944
],
"vyznam":"Druhá rafinerie v Nižněkamsku vedle TANECO, součást petrochemického uzlu v Tatarstánu.",
"kapacita":{
"hodnota":7.3,
"jednotka":"mil. t ropy/rok",
"popis":"projektovaná kapacita zpracování ropy, k tomu asi 1 mil. t plynového kondenzátu",
"historie":[],
"zdroj":{
"nazev":"Wikipedie (rus.) – ТАИФ-НК",
"url":"https://ru.wikipedia.org/wiki/ТАИФ-НК",
"archiv":"https://web.archive.org/web/20251013025206/https://ru.wikipedia.org/wiki/%D0%A2%D0%90%D0%98%D0%A4-%D0%9D%D0%9A",
"citace":"Проектная мощность по переработке нефти составляет 7,3 млн тонн в год"
}
},
"stav":{
"k":"2026-11-26",
"provoz":"neznamo",
"text":"Po útoku 15. 11. 2026 ukrajinský GŠ hlásí zásah jediné primární jednotky. Ruské úřady potvrdily jen škody v průmyslové zóně, závod nejmenovaly. Zastavení hlášeno nebylo.",
"zdroj":{
"nazev":"IntelliNews – Refinery strikes ledger (aktualizováno 26. 11. 2026)",
"url":"https://docs.google.com/spreadsheets/d/1AHjZvX9Hf-6jdKxcTE8Dw7f6O2_svY0kX54sqKPyU_s",
"archiv":null,
"citace":"Fire; damage being assessed; no halt reported"
}
},
"neuplne":"Oba útoky jsou doloženy hlavně ukrajinskými zdroji. Petrochemický závod Nižněkamskněftěchim, napadený 12. 6., 31. 7. a 15. 11. 2026, je samostatný podnik a zahrnut není.",
"zasahy":[
{
"d":"2026-07-08",
"prostredek":"drony",
"co":"Ukrajinské síly zvláštních operací hlásí zásah rafinerie TAIF-NK.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Ukrajinska pravda, 8. 7. 2026",
"url":"https://www.pravda.com.ua/eng/news/2026/07/08/8042992/",
"archiv":"https://web.archive.org/web/20260928094506/https://www.pravda.com.ua/eng/news/2026/07/08/8042992/",
"citace":null
}
},
{
"d":"2026-11-15",
"prostredek":"drony",
"co":"Dlouhý útok dronů na Nižněkamsk. Podle ukrajinského GŠ zasažena jediná primární jednotka ELOU-AVT-7 a vznikl požár. Starosta potvrdil škody v průmyslové zóně a šest zraněných.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Interfax, 15. 11. 2026",
"url":"https://www.interfax.ru/russia/1129119",
"archiv":"https://web.archive.org/web/20261117120435/https://www.interfax.ru/russia/1129119",
"citace":"в результате утренней атаки беспилотников пострадали шесть человек"
}
}
]
},
{
"id":"perm",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinerie Perm (Lukoil-Permněftěorgsintez)",
"vlastnik":"Lukoil",
"misto":"Perm, Permský kraj",
"gps":[
57.917,
56.128
],
"vyznam":"Sedmá největší ruská rafinerie a velký výrobce nafty (5,3 mil. t ročně), asi 1 500 km od Ukrajiny. Útočit se na ni začalo až v dubnu 2026.",
"kapacita":{
"hodnota":13.1,
"jednotka":"mil. t ropy/rok",
"popis":"projektovaná kapacita (IntelliNews, Wikipedie); skutečné zpracování 2024 podle Reuters",
"historie":[
[
2024,
12.6,
"skutečné zpracování"
]
],
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"https://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"За 2024 год ПермНОС переработал около 12,6 миллиона тонн нефтяного сырья"
}
},
"stav":{
"k":"2026-11-26",
"provoz":"mimo",
"text":"Naposledy hlášené úplné zastavení je z 25. 9. 2026. Zda rafinerie před útokem 23. 11. znovu najela, není potvrzeno. Podle ukrajinského GŠ byly 23. 11. zasaženy primární jednotky AVT-2 a AVT-5.",
"zdroj":{
"nazev":"IntelliNews – Refinery strikes ledger (aktualizováno 26. 11. 2026)",
"url":"https://docs.google.com/spreadsheets/d/1AHjZvX9Hf-6jdKxcTE8Dw7f6O2_svY0kX54sqKPyU_s",
"archiv":null,
"citace":"No Russian official has named the refinery or reported its operating status; whether it had restarted after the September halt is not established."
}
},
"neuplne":"Ukrajinské zdroje hlásí i útoky 8. 5. a 12. 5. 2026; mohou splývat s útokem 7. 5., proto zahrnuty nejsou.",
"zasahy":[
{
"d":"2026-04-30",
"prostredek":"drony",
"co":"První útok na Perm (v noci na 30. 4.): požár na primární jednotce AVT-4, vybuchly nádrže, ve městě vyhlášen chemický poplach.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"https://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Пожар возник 30 апреля на установке первичной переработки нефти АВТ-4 ПНОС в результате атаки БПЛА."
}
},
{
"d":"2026-05-07",
"prostredek":"drony",
"co":"Poškozené jednotky a požáry; rafinerie zcela zastavila zpracování ropy i výrobu paliv. Oprava podle Reuters na několik týdnů.",
"dopad":3,
"obnova":"několik týdnů",
"obnovaDni":null,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"ПермНОС Лукойла полностью остановил переработку нефти и выпуск нефтепродуктов из-за повреждения технологических установок и возгораний, возникших в результате атаки дронов 7 мая"
}
},
{
"d":"2026-07-29",
"prostredek":"drony",
"co":"Požár na primární jednotce AVT-5 (12 930 t/den, 34 % kapacity).",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":"asi třetina kapacity",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"https://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Пожар возник 29 июля на установке АВТ-5 производительностью 12.930 тонн в сутки (34% мощности НПЗ) в результате атаки БПЛА."
}
},
{
"d":"2026-08-21",
"prostredek":"drony",
"co":"Poškozena primární jednotka AVT-4 (14 110 t/den, 38 %), celá rafinerie se zastavila.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"https://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"ПермНОС остановился 21 августа после атаки БПЛА, повреждена установка АВТ-4 производительностью 14.110 тонн в сутки (38% мощности НПЗ)."
}
},
{
"d":"2026-09-07",
"prostredek":"drony",
"co":"Zelenskyj potvrdil úder na tři rafinerie (Rjazaň, Perm, Tatarstán), nad všemi stoupal kouř.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"The Kyiv Independent, 7. 9. 2026",
"url":"https://kyivindependent.com/ukrainian-drone-blitz-hits-3-russian-oil-refineries-zelensky-confirms/",
"archiv":"https://web.archive.org/web/20260908051255/https://kyivindependent.com/ukrainian-drone-blitz-hits-3-russian-oil-refineries-zelensky-confirms/",
"citace":null
}
},
{
"d":"2026-09-25",
"prostredek":"drony",
"co":"Gubernátor potvrdil úder na nejmenovaný průmyslový objekt; podle Reuters rafinerie úplně zastavila zpracování, hořela potrubí mezi jednotkami, nádrže a sekundární jednotky.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), Reuters, 25. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/25/npz-permnos-ostanovil-pererabotku-nefti-posle-ataki-bpla-25-sentyabrya-istochniki-a207058",
"archiv":null,
"citace":"НПЗ ПермНОС остановил переработку нефти после атаки БПЛА 25 сентября--источники"
}
},
{
"d":"2026-11-23",
"prostredek":"drony",
"co":"Ukrajinský GŠ hlásí zásah primárních jednotek AVT-2 a AVT-5 a izomerace (spolu s partyzány Černá jiskra). Gubernátor potvrdil poškozený průmyslový objekt, jednoho mrtvého a dva zraněné.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Militarnyi, 23. 11. 2026",
"url":"https://militarnyi.com/en/news/fires-break-out-at-novoshakhtinsk-and-perm-oil-refineries-after-ukrainian-drone-attacks/",
"archiv":null,
"citace":null
}
}
]
},
{
"id":"tumen",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinerie Ťumeň (Antipinskij NPZ)",
"vlastnik":"Antipinskij NPZ (od 2021 Rusinvest, vlastnictví sporné)",
"misto":"Ťumeň, Ťumeňská oblast",
"gps":[
57.1,
65.759
],
"vyznam":"Největší nezávislá rafinerie na Sibiři (hlavně nafta), přes 2 000 km od Ukrajiny. Útoky na ni ukazují dolet ukrajinských dronů za Ural.",
"kapacita":{
"hodnota":8,
"jednotka":"mil. t ropy/rok",
"popis":"jmenovitá kapacita podle Reuters (jiné zdroje uvádějí až 9 mil. t); ročně zpracuje asi 6 mil. t",
"historie":[],
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"https://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Номинальная мощность Тюменского НПЗ составляет около 8 миллионов тонн. Перерабатывая в год около 6 миллионов тонн нефти"
}
},
"stav":{
"k":"2026-11-26",
"provoz":"neznamo",
"text":"Po úderu 25. 7. 2026 rafinerie zastavila výrobu; zdroje nedokázaly odhadnout délku oprav. O obnovení ani o dalších útocích nejsou zprávy.",
"zdroj":{
"nazev":"IntelliNews – Refinery strikes ledger (aktualizováno 26. 11. 2026)",
"url":"https://docs.google.com/spreadsheets/d/1AHjZvX9Hf-6jdKxcTE8Dw7f6O2_svY0kX54sqKPyU_s",
"archiv":null,
"citace":"Fully halted after the 25 Jul 2026 strike on its diesel hydrotreater and gasoline unit (Reuters). No later status found."
}
},
"neuplne":"Požár hydrogenace nafty 6. 6. 2026 označil gubernátor za technologickou poruchu, proto není zahrnut.",
"zasahy":[
{
"d":"2025-10-06",
"prostredek":"drony",
"co":"Dva drony poškodily destilační kolonu a část vodního hospodářství (chladicí věž). Byl to tehdy asi nejvzdálenější úder (~2 000 km); incident uznaly i ruské úřady.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"RBC-Ukrajina, 7. 10. 2025",
"url":"https://newsukraine.rbc.ua/news/drones-attack-oil-refinery-in-russia-s-tyumen-1759846712.html",
"archiv":"https://web.archive.org/web/20260608022929/https://newsukraine.rbc.ua/news/drones-attack-oil-refinery-in-russia-s-tyumen-1759846712.html",
"citace":"two drones attacked an oil refinery in Russia’s Tyumen region, damaging a distillation column and part of the water supply system"
}
},
{
"d":"2026-06-20",
"prostredek":"drony",
"co":"Zelenskyj oznámil zásah zpracovatelské infrastruktury v Ťumeni; podle Militarnyi zničil dron FP-1 důležitou jednotku.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Ukrajinska pravda, 20. 6. 2026",
"url":"https://www.pravda.com.ua/eng/news/2026/06/20/8040337/",
"archiv":"https://web.archive.org/web/20260814091239/https://www.pravda.com.ua/eng/news/2026/06/20/8040337/",
"citace":"Ukrainian President Volodymyr Zelenskyy has said that Ukrainian drones struck oil refining infrastructure in Russia's Tyumen Oblast, over 2,000 kilometres from the border."
}
},
{
"d":"2026-07-25",
"prostredek":"drony",
"co":"Zasažena hlavní hydrogenace nafty (2,6 mil. t/rok) a jednotka vysokooktanového benzínu; rafinerie zastavila výrobu na neurčito.",
"dopad":4,
"obnova":"nelze odhadnout (podle zdrojů)",
"obnovaDni":null,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (Reuters), 28. 7. 2026",
"url":"https://www.themoscowtimes.com/2026/07/28/tyumen-oil-refinery-halts-production-after-ukrainian-drone-strike-sources-say-a93359",
"archiv":"https://web.archive.org/web/20260729140826/https://www.themoscowtimes.com/2026/07/28/tyumen-oil-refinery-halts-production-after-ukrainian-drone-strike-sources-say-a93359",
"citace":"Industry sources said it is difficult to estimate how long repairs will take."
}
}
]
},
{
"id":"orenburg_gpz",
"strana":"RU",
"druh":"plyn",
"nazev":"Orenburský plynárenský závod (GPZ)",
"vlastnik":"Gazprom (Gazprom pererabotka)",
"misto":"u Orenburgu, Orenburská oblast",
"gps":[
51.87,
54.76
],
"vyznam":"Podle Ruska největší plynochemický komplex světa. Čistí plyn z ruských polí i z kazašského Karačaganaku, s heliovým závodem tvoří jeden celek. Výpadky omezují i těžbu ropy a kondenzátu v Kazachstánu.",
"kapacita":{
"hodnota":37.5,
"jednotka":"mld. m³ plynu/rok",
"popis":"roční kapacita zpracování plynu celého orenburského komplexu",
"historie":[],
"zdroj":{
"nazev":"Meduza (rus.), 24. 6. 2026",
"url":"https://meduza.io/feature/2026/06/24/voyna",
"archiv":"https://web.archive.org/web/20260805153813/https://meduza.io/feature/2026/06/24/voyna",
"citace":null
}
},
"stav":{
"k":"2026-11-26",
"provoz":"neznamo",
"text":"Po útoku 24. 6. 2026 Karačaganak omezil těžbu a do konce června se zčásti zotavil. O dalších útocích nebo současném výkonu závodu po červnu nejsou zprávy.",
"zdroj":{
"nazev":"NV.ua (Reuters), 30. 6. 2026",
"url":"https://english.nv.ua/nation/production-at-massive-oil-field-in-kazakhstan-falls-following-ukrainian-attack-on-russian-refinery-50620447.html",
"archiv":"https://web.archive.org/web/20260907013926/https://english.nv.ua/nation/production-at-massive-oil-field-in-kazakhstan-falls-following-ukrainian-attack-on-russian-refinery-50620447.html",
"citace":null
}
},
"neuplne":"Ukrajinské zdroje hlásí i útoky na heliový závod (srpen 2025), na jednotku 3U-70 (25. 12. 2025) a na plynárenské cíle v oblasti (12. 5. 2026). Ty zde nejsou jako potvrzené.",
"zasahy":[
{
"d":"2025-10-19",
"prostredek":"drony",
"co":"Na závod dopadl dron. Gazprom přiznal mimořádnou situaci a závod přestal přijímat plyn z kazašského Karačaganaku. Příjem obnoven 1. 11. druhou linkou, třetí linka měla najet v polovině prosince.",
"dopad":3,
"obnova":"asi 2 týdny do částečné, 2 měsíce do plné obnovy",
"obnovaDni":55,
"vypadek":"příjem plynu z Karačaganaku",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026 (oddíl 2025)",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Оренбургский ГПЗ Газпрома остановил 19 октября прием газа с казахстанского месторождения Карачаганак после атаки БПЛА"
}
},
{
"d":"2026-06-24",
"prostredek":"drony",
"co":"Masivní útok na Orenburg. Požáry na plynárenském a heliovém závodě (NASA FIRMS), satelitní snímky ukazují poškozené zařízení. Gubernátor potvrdil pád trosek na průmyslový objekt. Karačaganak kvůli tomu snížil těžbu o 26 %.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"těžba na Karačaganaku −26 %",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Карачаганакское месторождение в Казахстане сократило добычу сырья на 26% после атаки беспилотников на Оренбургской ГПЗ в РФ"
}
}
]
},
{
"id":"ust_luga_novatek",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Komplex Novateku v Usť-Luze (zpracování kondenzátu)",
"vlastnik":"Novatek",
"misto":"Usť-Luga, Leningradská oblast",
"gps":[
59.766,
28.478
],
"vyznam":"Baltský závod, který z plynového kondenzátu vyrábí naftu, petrolej a lodní palivo převážně na vývoz. Leží v jednom z hlavních ruských exportních přístavů.",
"kapacita":{
"hodnota":9,
"jednotka":"mil. t kondenzátu/rok",
"popis":"jmenovitá kapacita frakcionace (3 jednotky po 3 mil. t), zpracovává plynový kondenzát, ne ropu",
"historie":[
[
2023,
7.0,
"skutečné zpracování"
],
[
2025,
8.0,
"skutečné zpracování"
]
],
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Комплекс Новатэка по фракционированию и перевалке газоконденсата номинальной мощностью 9 миллионов тонн в год"
}
},
"stav":{
"k":"2026-11-26",
"provoz":"neznamo",
"text":"Po útoku 1. 9. 2026 se komplex podle zdrojů znovu rozjel. Při útoku 11. 11. hořelo v jeho severní výrobní části, zastavení ani obnova ale hlášeny nebyly.",
"zdroj":{
"nazev":"Hellenic Shipping News (Platts), 11/2026",
"url":"https://www.hellenicshippingnews.com/drone-strike-starts-fire-at-russian-baltic-port-of-ust-luga/",
"archiv":"https://web.archive.org/web/20261113091805/https://www.hellenicshippingnews.com/drone-strike-starts-fire-at-russian-baltic-port-of-ust-luga/",
"citace":null
}
},
"neuplne":"Útoky dronů na ropné terminály přístavu Usť-Luga (např. 27.–31. 3. a 7. 4. 2026), které nezasáhly komplex Novateku, zde nejsou.",
"zasahy":[
{
"d":"2024-01-21",
"prostredek":"drony",
"co":"Dva výbuchy a požár po „vnějším působení“; Novatek odstavil dvě frakcionační jednotky komplexu.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"dvě ze tří (tehdy dvou provozních) jednotek",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters 2024, 21. 5. 2024",
"url":"https://ru.themoscowtimes.com/2024/05/21/factbox-avarii-na-rossiyskikh-npz-v-2024g-a131392",
"archiv":"https://web.archive.org/web/20260716045202/https://ru.themoscowtimes.com/2024/05/21/factbox-avarii-na-rossiyskikh-npz-v-2024g-a131392",
"citace":"Пожар на терминале Новатэка в Усть-Луге произошёл 21 января в результате двух взрывов после \"внешнего воздействия\""
}
},
{
"d":"2025-08-24",
"prostredek":"drony",
"co":"Požár poškodil dvě ze tří frakcionačních jednotek (po 3 mil. t), provoz i vývoz se úplně zastavily. Nepoškozená jednotka najela 26. 8., druhá koncem září, plný výkon až začátkem listopadu.",
"dopad":4,
"obnova":"asi 2,5 měsíce do plného výkonu",
"obnovaDni":70,
"vypadek":"až 2/3 kapacity (6 mil. t/rok)",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026 (oddíl 2025)",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"в начале ноября вывел комплекс на полную мощность, завершив ремонт на третьей, наиболее пострадавшей от пожара установке"
}
},
{
"d":"2026-03-25",
"prostredek":"drony",
"co":"Požár na komplexu (potvrdil gubernátor Drozděnko); Novatek pozastavil zpracování kondenzátu i vývoz nafty.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"celý komplex",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Новатэк приостановил переработку стабильного газового конденсата (СГК) и экспорт нафты через балтийский порт Усть-Луга из-за пожара на комплексе, возникшем после атаки БПЛА 25 марта"
}
},
{
"d":"2026-08-14",
"prostredek":"drony",
"co":"Komplex poškozen; podle ukrajinského GŠ zasaženy jednotky frakcionace kondenzátu a hydrokrakování.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"https://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Комплекс Новатэка по фракционированию и перевалке газоконденсата в Усть-Луге получил повреждения 14 августа в результате атаки БПЛА."
}
},
{
"d":"2026-09-01",
"prostredek":"drony",
"co":"Velký požár; ukrajinská rozvědka HUR hlásí zásah klíčových prvků zpracovatelské jednotky. Gubernátor potvrdil požár v přístavu. Komplex se podle zdrojů zastavil a později znovu najel.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"https://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Пожар произошёл 1 сентября в портовой зоне Усть-Луги в результате атаки БПЛА, есть повреждения."
}
},
{
"d":"2026-11-11",
"prostredek":"drony",
"co":"Gubernátor potvrdil požár v přístavu (150 sestřelených dronů). Astra umístila jedno ohnisko do severní výrobní části komplexu Novatek; podle ukrajinského GŠ poškozeno pět nádrží (150 000 m³) a hořel hydrokrak.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"odhad",
"zdroj":{
"nazev":"The Kyiv Independent, 11. 11. 2026",
"url":"https://kyivindependent.com/ukraine-reportedly-strikes-ust-luga-baltic-sea-port-as-drones-attack-regions-across-russia/",
"archiv":"https://web.archive.org/web/20261117005245/https://kyivindependent.com/ukraine-reportedly-strikes-ust-luga-baltic-sea-port-as-drones-attack-regions-across-russia/",
"citace":null
}
}
]
},
{
"id":"omsk",
"strana":"RU",
"druh":"rafinerie",
"nazev":"Rafinerie Omsk",
"vlastnik":"Gazprom Něfť",
"misto":"Omsk, Omská oblast",
"gps":[
55.071,
73.234
],
"vyznam":"Největší rafinerie v Rusku (asi 22 mil. t ropy ročně), 2 500–3 000 km od Ukrajiny. Přidána navíc, protože je od července 2026 zasahována opakovaně.",
"kapacita":{
"hodnota":22,
"jednotka":"mil. t ropy/rok",
"popis":"skutečné zpracování 2024 (projektovaná kapacita se uvádí kolem 21 mil. t)",
"historie":[
[
2024,
22,
"skutečné zpracování"
]
],
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 28. 9. 2026",
"url":"https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"archiv":"https://web.archive.org/web/20261007150518/https://ru.themoscowtimes.com/2026/09/28/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a207149",
"citace":"Омский НПЗ в 2024 году переработал 22 миллиона тонн нефти"
}
},
"stav":{
"k":"2026-11-26",
"provoz":"neznamo",
"text":"Po červencovém zastavení rafinerie koncem července znovu najela. Po útocích 8. 10. a 11. 11. 2026 nebylo hlášeno žádné zastavení; zda útok 11. 11. vůbec rafinerii poškodil, není jasné.",
"zdroj":{
"nazev":"IntelliNews – Refinery strikes ledger (aktualizováno 26. 11. 2026)",
"url":"https://docs.google.com/spreadsheets/d/1AHjZvX9Hf-6jdKxcTE8Dw7f6O2_svY0kX54sqKPyU_s",
"archiv":null,
"citace":"Unclear (restarted late July; later reported stopped)"
}
},
"neuplne":"Požáry z let 2024 (cisterny 25. 4., výbuch na CDU-11 26. 8.) nebyly útoky a nejsou zahrnuty.",
"zasahy":[
{
"d":"2026-07-06",
"prostredek":"drony",
"co":"První úder na Omsk (drony FP-1, asi 2 500 km): hořela a byla poškozena primární jednotka CDU-10 (38 % kapacity), odstavena i CDU-11 (37 %). Rafinerie 6.–7. 7. zastavila zpracování a koncem července najela.",
"dopad":3,
"obnova":"asi 3 týdny (najetí koncem července)",
"obnovaDni":21,
"vypadek":"celá rafinerie po dobu odstávky",
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times (rus.), přehled Reuters, 8. 7. 2026",
"url":"https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"archiv":"https://web.archive.org/web/20261012053548/https://ru.themoscowtimes.com/2026/07/08/factbox-avarii-na-npz-i-drugikh-obektakh-tek-rf-v-2025-2026gg-a200313",
"citace":"Крупнейший в РФ Омский НПЗ, принадлежащий Газпромнефти, остановил переработку 6 июля из-за атаки БПЛА"
}
},
{
"d":"2026-10-08",
"prostredek":"drony",
"co":"Ukrajinský GŠ a Zelenskyj potvrdili druhý úder, Astra hlásila kouř a požár. Gubernátor potvrdil útok dronů na oblast, neřekl ale, co bylo zasaženo.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"The Kyiv Independent, 8. 10. 2026",
"url":"https://kyivindependent.com/drones-reportedly-strike-russias-omsk-oil-refinery-in-siberia/",
"archiv":"https://web.archive.org/web/20261113182631/https://kyivindependent.com/drones-reportedly-strike-russias-omsk-oil-refinery-in-siberia/",
"citace":"Videos and images from local residents, shared by Ukrainian monitoring channels, show explosions, fire, and smoke rising from the area surrounding the oil refinery."
}
},
{
"d":"2026-11-11",
"prostredek":"drony",
"co":"Osmihodinový útok na Omsk, obyvatelé hlásili požár u rafinerie a ukrajinské síly zvláštních operací hlásí třetí zásah. NASA FIRMS ale nové ohnisko v rafinerii nezaznamenala.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"The Kyiv Independent, 11. 11. 2026",
"url":"https://kyivindependent.com/russias-largest-oil-refinery-slammed-by-drones-in-8-hr-attack-2-500-km-from-ukraine/",
"archiv":"https://web.archive.org/web/20261117211226/https://kyivindependent.com/russias-largest-oil-refinery-slammed-by-drones-in-8-hr-attack-2-500-km-from-ukraine/",
"citace":null
}
}
]
},
{
"id":"unecha",
"strana":"RU",
"druh":"precerpavaci",
"nazev":"Přečerpávací stanice Uneča (ropovod Družba)",
"vlastnik":"Transněfť (Transněfť-Družba)",
"misto":"Vysokoje u Uneči, Brjanská oblast",
"gps":[
52.754,
32.919
],
"vyznam":"Největší uzel ropovodu Družba asi 60 km od ukrajinské hranice. Odtud vede jižní větev Družby na Slovensko a do Maďarska a začíná tu i Baltský ropovod BTS-2 do Usť-Lugy.",
"kapacita":{
"hodnota":1.3,
"jednotka":"mil. barelů/den",
"popis":"kapacita celého ropovodu Družba (1,2–1,4 mil. barelů/den), samotné stanice není zveřejněna",
"historie":[],
"zdroj":{
"nazev":"Wikipedie: Druzhba pipeline",
"url":"https://en.wikipedia.org/wiki/Druzhba_pipeline",
"archiv":"https://web.archive.org/web/20261024022845/https://en.wikipedia.org/wiki/Druzhba_pipeline",
"citace":"The Druzhba pipeline currently has a capacity of 1.2 to 1.4 million barrels per day"
}
},
"stav":{
"k":"2026-10-31",
"provoz":"bezi",
"text":"Ropa po Družbě do Maďarska a na Slovensko v říjnu 2026 tekla (CREA). Přímé hlášení o stavu stanice po únoru 2026 jsme nenašli.",
"zdroj":{
"nazev":"CREA, měsíční analýza – říjen 2026",
"url":"https://energyandcleanair.org/october-2026-monthly-analysis-of-russian-fossil-fuel-exports-and-sanctions/",
"archiv":null,
"citace":"all of which was transported through the Druzhba pipeline to Slovakia and Hungary"
}
},
"neuplne":"Chybí zásah z března 2025 (rozvodna Vysokoje) a zásah 6. 8. 2025 – zmínky jsme viděli jen v souhrnech bez ověřitelného zdroje. Výpadek dodávek od 27. 1. do 23. 4. 2026 způsobil ruský útok na uzel Brody na Ukrajině, ne zásah v Rusku.",
"zasahy":[
{
"d":"2025-08-13",
"prostredek":"drony",
"co":"Ukrajinské drony zasáhly stanici, satelitní snímky ukázaly zničené dvě čerpací budovy. Dodávky ropy do Maďarska a na Slovensko se přerušily.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"dodávky do Maďarska a na Slovensko přerušeny na několik dní",
"overeni":"over",
"zdroj":{
"nazev":"Militarnyi – satelitní snímky",
"url":"https://militarnyi.com/en/news/satellite-images-strike-on-unecha-station-wrecks-two-pumping-stations-of-druzhba-oil-pipeline/",
"archiv":"https://web.archive.org/web/20251002160457/https://militarnyi.com/en/news/satellite-images-strike-on-unecha-station-wrecks-two-pumping-stations-of-druzhba-oil-pipeline/",
"citace":"Strike on Unecha Station Wrecks Two Pumping Stations of Druzhba Oil Pipeline"
}
},
{
"d":"2025-08-21",
"prostredek":"drony",
"co":"Třetí srpnový zásah: podle satelitních snímků zničena budova čerpací stanice. Dodávky do Maďarska a na Slovensko zase stály, obnovily se 28. 8.",
"dopad":3,
"obnova":"asi týden (dodávky obnoveny 28. 8. 2025)",
"obnovaDni":7,
"vypadek":"celé dodávky jižní větví Družby (Maďarsko, Slovensko)",
"overeni":"over",
"zdroj":{
"nazev":"Reuters přes Hydrocarbon Processing, 22. 8. 2025",
"url":"https://www.hydrocarbonprocessing.com/news/2025/08/ukrainian-attack-suspends-russian-oil-flows-to-hungary-slovakia/",
"archiv":"https://web.archive.org/web/20251107214519/http://www.hydrocarbonprocessing.com/news/2025/08/ukrainian-attack-suspends-russian-oil-flows-to-hungary-slovakia/",
"citace":"Ukraine's military said late on Thursday it had again struck the Unecha oil pumping station."
}
},
{
"d":"2026-02-23",
"prostredek":"drony",
"co":"Údery na uzly Družby v noci na 23. 2. 2026 – podle OilPrice zasáhly i Uneču. Hlavním cílem bylo Kalejkino v Tatarstánu.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"OilPrice, 23. 2. 2026",
"url":"https://oilprice.com/Latest-Energy-News/World-News/Ukraine-Strikes-Russias-Druzhba-Pipeline-Network.html",
"archiv":"https://web.archive.org/web/20260722172831/https://oilprice.com/Latest-Energy-News/World-News/Ukraine-Strikes-Russias-Druzhba-Pipeline-Network.html",
"citace":"Similar strikes hit the Unecha station in Bryansk and the Nikolskoye station in Tambov"
}
}
]
},
{
"id":"nikolskoje",
"strana":"RU",
"druh":"precerpavaci",
"nazev":"Přečerpávací stanice Nikolskoje (ropovod Družba)",
"vlastnik":"Transněfť (Transněfť-Družba)",
"misto":"Mičurinský okruh, Tambovská oblast",
"gps":[
52.802,
40.369
],
"vyznam":"Stanice na hlavní trase Kujbyšev–Uneča, která žene ropu z Povolží k Družbě a dál do střední Evropy.",
"kapacita":{
"hodnota":null,
"jednotka":"mil. barelů/den",
"popis":"kapacita stanice nezveřejněna",
"historie":[],
"zdroj":null
},
"stav":{
"k":"2026-10-20",
"provoz":"neznamo",
"text":"Po zásahu 20. 10. 2026 hořelo, jestli se čerpání zastavilo, zdroje neuvádějí.",
"zdroj":{
"nazev":"Militarnyi, 20. 10. 2026",
"url":"https://militarnyi.com/en/news/drone-attack-sparks-fire-at-nikolskoe-oil-pumping-station-serving-druzhba-pipeline/",
"archiv":"https://web.archive.org/web/20261026040803/https://militarnyi.com/en/news/drone-attack-sparks-fire-at-nikolskoe-oil-pumping-station-serving-druzhba-pipeline/",
"citace":null
}
},
"neuplne":null,
"zasahy":[
{
"d":"2025-08-18",
"prostredek":"drony",
"co":"Ukrajinský generální štáb ohlásil zásah stanice, satelitní snímek ukázal škody. Družba se podle zpráv celá zastavila, dodávky se obnovily asi po dvou dnech.",
"dopad":2,
"obnova":"asi 2 dny",
"obnovaDni":2,
"vypadek":"dočasné zastavení dodávek Družbou",
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie: Druzhba pipeline",
"url":"https://en.wikipedia.org/wiki/Druzhba_pipeline",
"archiv":"https://web.archive.org/web/20261024022845/https://en.wikipedia.org/wiki/Druzhba_pipeline",
"citace":"This second strike reportedly caused a complete halt of the Druzhba pipeline."
}
},
{
"d":"2026-02-23",
"prostredek":"drony",
"co":"V téže noci jako Kalejkino měla být zasažena i Nikolskoje – potvrzení napadené strany jsme nenašli.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"OilPrice, 23. 2. 2026",
"url":"https://oilprice.com/Latest-Energy-News/World-News/Ukraine-Strikes-Russias-Druzhba-Pipeline-Network.html",
"archiv":"https://web.archive.org/web/20260722172831/https://oilprice.com/Latest-Energy-News/World-News/Ukraine-Strikes-Russias-Druzhba-Pipeline-Network.html",
"citace":"Similar strikes hit the Unecha station in Bryansk and the Nikolskoye station in Tambov"
}
},
{
"d":"2026-10-20",
"prostredek":"drony",
"co":"Po útoku dronů vypukl požár na stanici. Úřady jako cíl stanici nejmenovaly.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Militarnyi, 20. 10. 2026",
"url":"https://militarnyi.com/en/news/drone-attack-sparks-fire-at-nikolskoe-oil-pumping-station-serving-druzhba-pipeline/",
"archiv":"https://web.archive.org/web/20261026040803/https://militarnyi.com/en/news/drone-attack-sparks-fire-at-nikolskoe-oil-pumping-station-serving-druzhba-pipeline/",
"citace":"Drone Attack Sparks Fire at Nikolskoe Oil Pumping Station Serving Druzhba Pipeline"
}
}
]
},
{
"id":"najtopovici_8n",
"strana":"RU",
"druh":"precerpavaci",
"nazev":"Stanice produktovodu 8N (Najtopoviči)",
"vlastnik":"Transněfť (Transněfť-Družba)",
"misto":"Najtopoviči, Unečský rajón, Brjanská oblast",
"gps":[
52.76,
32.653
],
"vyznam":"Čerpá naftu produktovody z běloruských rafinerií (Mozyr, Novopolock) do Ruska. Zadání uvádí název „Lopatino“ – stanice 8N je ve zdrojích v Najtopovičích.",
"kapacita":{
"hodnota":null,
"jednotka":"mil. t/rok",
"popis":"kapacita nezveřejněna",
"historie":[],
"zdroj":null
},
"stav":{
"k":"2025-09-07",
"provoz":"neznamo",
"text":"Ruská strana zásah nepotvrdila, stav neznámý.",
"zdroj":{
"nazev":"Neftegaz.ru",
"url":"https://neftegaz.ru/news/incidental/899140-drony-vsu-atakovali-ilskiy-npz-uchebnyy-tsentr-zaporozhskoy-aes-i-lpsd-nefteprovoda-druzhba/",
"archiv":"https://web.archive.org/web/20251013054408/https://neftegaz.ru/news/incidental/899140-drony-vsu-atakovali-ilskiy-npz-uchebnyy-tsentr-zaporozhskoy-aes-i-lpsd-nefteprovoda-druzhba/",
"citace":null
}
},
"neuplne":"Jen jeden zásah. O stanici „Lopatino“ jsme nic nenašli.",
"zasahy":[
{
"d":"2025-09-07",
"prostredek":"drony",
"co":"Velitel ukrajinských bezpilotních sil Brovdi („Maďar“) ohlásil zásah stanice 8N. Obyvatelé slyšeli výbuchy, oficiální potvrzení není.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"ZN.ua, 7. 9. 2025",
"url":"https://zn.ua/war/drony-udarili-po-stantsii-kotoraja-perekachivaet-toplivo-s-belorusskikh-npz-v-rossiju-madjar.html",
"archiv":"https://web.archive.org/web/20250907054144/https://zn.ua/war/drony-udarili-po-stantsii-kotoraja-perekachivaet-toplivo-s-belorusskikh-npz-v-rossiju-madjar.html",
"citace":"удар пришёлся по линейно-производственной диспетчерской станции \"8-Н\" в селе Найтоповичи"
}
}
]
},
{
"id":"kalejkino",
"strana":"RU",
"druh":"precerpavaci",
"nazev":"Přečerpávací stanice Kalejkino",
"vlastnik":"Transněfť (Transněfť-Prikamje)",
"misto":"Kalejkino u Almetěvsku, Tatarstán",
"gps":[
54.93,
52.187
],
"vyznam":"Jeden z největších uzlů ruských ropovodů asi 1300 km od Ukrajiny: míchá ropu ze Sibiře a Povolží a posílá ji k Samaře, Nižnímu Novgorodu i do Družby.",
"kapacita":{
"hodnota":1.0,
"jednotka":"mil. barelů/den",
"popis":"průtok stanice podle Reuters",
"historie":[],
"zdroj":{
"nazev":"Ukrajinska pravda (Reuters), 24. 2. 2026",
"url":"https://www.pravda.com.ua/eng/news/2026/02/24/8022612/",
"archiv":"https://web.archive.org/web/20260430094728/https://www.pravda.com.ua/eng/news/2026/02/24/8022612/",
"citace":"which has a capacity of about one million barrels a day"
}
},
"stav":{
"k":"2026-11-23",
"provoz":"neznamo",
"text":"Dva zásahy za pět dní v listopadu 2026, oficiálně se o omezení čerpání nemluví.",
"zdroj":{
"nazev":"Kyiv Post",
"url":"https://www.kyivpost.com/post/90874",
"archiv":"https://web.archive.org/web/20261123114304/https://www.kyivpost.com/post/90874",
"citace":null
}
},
"neuplne":null,
"zasahy":[
{
"d":"2026-02-23",
"prostredek":"drony",
"co":"Drony zapálily stanici, místní úřad potvrdil požár v průmyslové zóně. Podle Reuters Transněfť pak omezila příjem ropy do systému asi o 250 tisíc barelů denně.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":"~0,25 mil. barelů/den příjmu ropy",
"overeni":"over",
"zdroj":{
"nazev":"Ukrajinska pravda (Reuters), 24. 2. 2026",
"url":"https://www.pravda.com.ua/eng/news/2026/02/24/8022612/",
"archiv":"https://web.archive.org/web/20260430094728/https://www.pravda.com.ua/eng/news/2026/02/24/8022612/",
"citace":"reduced the amount of crude oil it takes into its system by about 250,000 barrels a day"
}
},
{
"d":"2026-11-19",
"prostredek":"drony",
"co":"Úřady Tatarstánu potvrdily útok na nádrže u Almetěvsku. Podle ukrajinského generálního štábu jedna nádrž hořela a dvě byly poškozeny.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"UNITED24 Media",
"url":"https://united24media.com/war-in-ukraine/1300-kilometers-from-ukraine-a-key-russian-oil-hub-is-burning-again-24526",
"archiv":null,
"citace":"1,300 Kilometers From Ukraine, a Key Russian Oil Hub Is Burning Again"
}
},
{
"d":"2026-11-23",
"prostredek":"drony",
"co":"Druhý zásah za pět dní: podle videí ověřených serverem Astra hořelo přímo na stanici. Úřady se nevyjádřily.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Post, 23. 11. 2026",
"url":"https://www.kyivpost.com/post/90874",
"archiv":"https://web.archive.org/web/20261123114304/https://www.kyivpost.com/post/90874",
"citace":"Ukrainian Drones Set Russian Oil Infrastructure Ablaze in Twin Strikes Deep Inside Russia"
}
}
]
},
{
"id":"tichoreck",
"strana":"RU",
"druh":"precerpavaci",
"nazev":"Ropný uzel Tichoreck (LPDS Tichoreckaja)",
"vlastnik":"Transněfť (Tichoreck-Nafta)",
"misto":"Tichoreck, Krasnodarský kraj",
"gps":[
45.843,
40.18
],
"vyznam":"Jeden z největších ropných uzlů jihu Ruska. Začínají tu ropovody a produktovody do Novorossijsku.",
"kapacita":{
"hodnota":null,
"jednotka":"mil. t/rok",
"popis":"kapacita nezveřejněna",
"historie":[],
"zdroj":null
},
"stav":{
"k":"2026-04-18",
"provoz":"neznamo",
"text":"Po třetím zásahu v dubnu 2026 jsme nenašli další zprávy o stavu.",
"zdroj":{
"nazev":"Militarnyi",
"url":"https://militarnyi.com/en/news/fire-tikhoretsk-oil-depot-drone-attack/",
"archiv":"https://web.archive.org/web/20260514021007/https://militarnyi.com/en/news/fire-tikhoretsk-oil-depot-drone-attack/",
"citace":null
}
},
"neuplne":"Zprávy po dubnu 2026 jsme nenašli.",
"zasahy":[
{
"d":"2026-03-12",
"prostredek":"drony",
"co":"Velký požár v areálu skladu a čerpací stanice. Krajský štáb potvrdil požár na 150 m² a připsal ho troskám dronu.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Euromaidan Press, 12. 3. 2026",
"url":"https://euromaidanpress.com/2026/03/12/drones-struck-tikhoretsk-nafta-oil-facility-krasnodar-krai/",
"archiv":"https://web.archive.org/web/20260313042041/https://euromaidanpress.com/2026/03/12/drones-struck-tikhoretsk-nafta-oil-facility-krasnodar-krai/",
"citace":"Fires tear through one of southern Russia's biggest oil hubs"
}
},
{
"d":"2026-03-15",
"prostredek":"drony",
"co":"Druhý útok za čtyři dny: požár, poškozené vedení vysokého napětí. Satelitní snímky ukázaly dvě zničené nádrže.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Militarnyi",
"url":"https://militarnyi.com/en/news/drones-hit-oil-depot-in-russia-s-tikhoretsk-for-second-time-in-four-days/",
"archiv":"https://web.archive.org/web/20260419112928/https://militarnyi.com/en/news/drones-hit-oil-depot-in-russia-s-tikhoretsk-for-second-time-in-four-days/",
"citace":"Drones Hit Oil Depot in Russia's Tikhoretsk for Second Time in Four Days"
}
},
{
"d":"2026-04-18",
"prostredek":"drony",
"co":"Třetí útok: požár, který hasilo 224 lidí s 56 kusy techniky.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Militarnyi",
"url":"https://militarnyi.com/en/news/fire-tikhoretsk-oil-depot-drone-attack/",
"archiv":"https://web.archive.org/web/20260514021007/https://militarnyi.com/en/news/fire-tikhoretsk-oil-depot-drone-attack/",
"citace":"Fire Breaks Out at Tikhoretsk Oil Depot Following Drone Attack"
}
}
]
},
{
"id":"kropotkinskaja",
"strana":"RU",
"druh":"precerpavaci",
"nazev":"Přečerpávací stanice Kropotkinskaja (ropovod CPC)",
"vlastnik":"Kaspické potrubní konsorcium (CPC)",
"misto":"Kavkazský rajón u Kropotkinu, Krasnodarský kraj",
"gps":[
45.434,
40.575
],
"vyznam":"Největší stanice ropovodu CPC v Rusku. CPC vozí asi 80 % kazachstánského vývozu ropy do Novorossijsku.",
"kapacita":{
"hodnota":1.5,
"jednotka":"mil. barelů/den",
"popis":"průtok celého ropovodu CPC",
"historie":[],
"zdroj":{
"nazev":"The Diplomat, 2/2025",
"url":"https://thediplomat.com/2025/02/ukrainian-drones-hit-kazakhstans-main-oil-export-outlet-in-russia/",
"archiv":"https://web.archive.org/web/20260818092907/https://thediplomat.com/2025/02/ukrainian-drones-hit-kazakhstans-main-oil-export-outlet-in-russia/",
"citace":null
}
},
"stav":{
"k":"2026-09-30",
"provoz":"bezi",
"text":"Ropovod CPC jede, v lednu až srpnu 2026 přepravil o 39 % víc ropy. O samotné stanici novější zprávy nemáme.",
"zdroj":{
"nazev":"Astana Times, 9/2026",
"url":"https://astanatimes.com/2026/09/cpc-oil-loading-operations-resume-after-drone-incident/",
"archiv":"https://web.archive.org/web/20260911142139/https://astanatimes.com/2026/09/cpc-oil-loading-operations-resume-after-drone-incident/",
"citace":null
}
},
"neuplne":"Souřadnice jsou přibližné (město Kropotkin).",
"zasahy":[
{
"d":"2025-02-17",
"prostredek":"drony",
"co":"Sedm dronů s výbušninou zasáhlo stanici, ta vypadla z provozu. Ropa tekla obtokem a průtok CPC klesl o 30–40 %. Ukrajinský generální štáb útok přiznal.",
"dopad":3,
"obnova":"1,5–2 měsíce (odhad Transněfti)",
"obnovaDni":50,
"vypadek":"průtok CPC −30 až 40 %",
"overeni":"over",
"zdroj":{
"nazev":"TASS, 18. 2. 2025",
"url":"https://tass.com/economy/1915353",
"archiv":"https://web.archive.org/web/20250223031816/https://tass.com/economy/1915353",
"citace":"Oil pumping via CPC system down 30-40% after Ukraine's drone attack"
}
}
]
},
{
"id":"kavkazskaja",
"strana":"RU",
"druh":"precerpavaci",
"nazev":"Stanice Kavkazskaja (CPC, překládka z železnice)",
"vlastnik":"Kaspické potrubní konsorcium (CPC)",
"misto":"Kavkazskaja, Krasnodarský kraj",
"gps":[
45.439,
40.67
],
"vyznam":"Přečerpává ropu z železničních cisteren do ropovodu CPC.",
"kapacita":{
"hodnota":6,
"jednotka":"mil. t ropy/rok",
"popis":"roční průtok (až 6 mil. t)",
"historie":[],
"zdroj":{
"nazev":"TASS, 3/2025",
"url":"https://tass.com/emergencies/1930765",
"archiv":"https://web.archive.org/web/20260714220515/https://tass.com/emergencies/1930765",
"citace":"up to 6 million tons of oil pass through"
}
},
"stav":{
"k":"2025-03-24",
"provoz":"zniceno",
"text":"CPC 24. 3. 2025 oznámilo, že stanice není kvůli škodám schopná přepravovat ropu. Novější zprávy jsme nenašli.",
"zdroj":{
"nazev":"Kyiv Independent",
"url":"https://kyivindependent.com/oil-pumping-station-in-krasnodar-krai-shut-down-due-to-damage-caused-by-drones/",
"archiv":"https://web.archive.org/web/20260808154311/https://kyivindependent.com/oil-pumping-station-in-krasnodar-krai-shut-down-due-to-damage-caused-by-drones/",
"citace":null
}
},
"neuplne":null,
"zasahy":[
{
"d":"2025-03-19",
"prostredek":"drony",
"co":"Den po telefonátu Trump–Putin zasáhly tři drony stanici. Hořela nádrž a požár trval asi týden. CPC stanici prohlásilo za nepoužitelnou.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":"až 6 mil. t/rok",
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Independent, 24. 3. 2025",
"url":"https://kyivindependent.com/oil-pumping-station-in-krasnodar-krai-shut-down-due-to-damage-caused-by-drones/",
"archiv":"https://web.archive.org/web/20260808154311/https://kyivindependent.com/oil-pumping-station-in-krasnodar-krai-shut-down-due-to-damage-caused-by-drones/",
"citace":"no longer suitable for oil transportation"
}
}
]
},
{
"id":"krymskaja",
"strana":"RU",
"druh":"precerpavaci",
"nazev":"Přečerpávací stanice Krymskaja",
"vlastnik":"Transněfť (Černomortransněfť)",
"misto":"Krymsk, Krasnodarský kraj",
"gps":[
44.93,
37.988
],
"vyznam":"Uzel ropovodů Tichoreck–Novorossijsk a Krymsk–Gruševaja. Posílá ropu a produkty do přístavu Novorossijsk a rafinerií Ilskij a Afipskij.",
"kapacita":{
"hodnota":null,
"jednotka":"mil. t/rok",
"popis":"kapacita nezveřejněna",
"historie":[],
"zdroj":null
},
"stav":{
"k":"2026-04-11",
"provoz":"neznamo",
"text":"Po dubnových útocích nemáme zprávy o omezení čerpání.",
"zdroj":{
"nazev":"Ukrajinska pravda",
"url":"https://www.pravda.com.ua/eng/news/2026/04/11/8029734/",
"archiv":"https://web.archive.org/web/20260430094701/https://www.pravda.com.ua/eng/news/2026/04/11/8029734/",
"citace":null
}
},
"neuplne":"Souřadnice jsou přibližné (město Krymsk). Útoky z roku 2025 jsme nezjišťovali.",
"zasahy":[
{
"d":"2026-04-09",
"prostredek":"drony",
"co":"Hořela rozvodna 110 kV v areálu stanice. Trosky zabily muže v nedaleké obci. Gubernátor útok potvrdil, stanici nejmenoval, identifikoval ji server Astra.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Militarnyi",
"url":"https://militarnyi.com/en/news/drone-strike-hits-substation-at-krymskaya-oil-pumping-station-in-krasnodar-krai/",
"archiv":"https://web.archive.org/web/20260420191206/https://militarnyi.com/en/news/drone-strike-hits-substation-at-krymskaya-oil-pumping-station-in-krasnodar-krai/",
"citace":"Drone Strike Hits Substation at Krymskaya Oil Pumping Station in Krasnodar Krai"
}
},
{
"d":"2026-04-11",
"prostredek":"drony",
"co":"Druhý útok za týden: místní úřady potvrdily požár ropného skladu v Krymsku, ráno byl uhašen.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Ukrajinska pravda, 11. 4. 2026",
"url":"https://www.pravda.com.ua/eng/news/2026/04/11/8029734/",
"archiv":"https://web.archive.org/web/20260430094701/https://www.pravda.com.ua/eng/news/2026/04/11/8029734/",
"citace":"Drone attack sparks fire at oil depot in Krymsk, Russia"
}
}
]
},
{
"id":"andreapol",
"strana":"RU",
"druh":"precerpavaci",
"nazev":"Přečerpávací stanice Andreapol (BTS-2)",
"vlastnik":"Transněfť",
"misto":"Jerochino u Andreapolu, Tverská oblast",
"gps":[
56.549,
32.185
],
"vyznam":"Klíčová stanice Baltského ropovodu BTS-2, který vede ropu do vývozního přístavu Usť-Luga.",
"kapacita":{
"hodnota":50,
"jednotka":"mil. t ropy/rok",
"popis":"kapacita ropovodu BTS-2 (údaj na Wikipedii označen jako neověřený)",
"historie":[],
"zdroj":{
"nazev":"Wikipedie: Druzhba pipeline",
"url":"https://en.wikipedia.org/wiki/Druzhba_pipeline",
"archiv":"https://web.archive.org/web/20261024022845/https://en.wikipedia.org/wiki/Druzhba_pipeline",
"citace":null
}
},
"stav":{
"k":"2025-02-13",
"provoz":"neznamo",
"text":"Novější zprávy jsme nenašli.",
"zdroj":null
},
"neuplne":"Zprávy po únoru 2025 jsme nenašli.",
"zasahy":[
{
"d":"2025-01-29",
"prostredek":"drony",
"co":"SBU a speciální síly zasáhly filtrační a čerpací část stanice, unikla ropa a začalo hořet. Astra to potvrdila u ruských hasičů. Podle Bloombergu se zastavil tok ropy do Usť-Lugy.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"přerušen přívod ropy do Usť-Lugy (Bloomberg)",
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Independent",
"url":"https://kyivindependent.com/ukrainian-drones-hit-russian-missile-arsenal-oil-pumping-station-in-tver-oblast-sbu-source-claims/",
"archiv":"https://web.archive.org/web/20260813203737/https://kyivindependent.com/ukrainian-drones-hit-russian-missile-arsenal-oil-pumping-station-in-tver-oblast-sbu-source-claims/",
"citace":"Ukrainian drones hit Russian missile arsenal, oil pumping station in Tver Oblast"
}
},
{
"d":"2025-02-13",
"prostredek":"drony",
"co":"Druhý zásah za dva týdny: podle zdroje v SBU požár u rozvodny, stanice přestala čerpat.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Kyiv Independent",
"url":"https://kyivindependent.com/ukrainian-drones-again-hit-oil-pumping-station-in-russias-tver-oblast-sbu-source-claims/",
"archiv":"https://web.archive.org/web/20260508105536/https://kyivindependent.com/ukrainian-drones-again-hit-oil-pumping-station-in-russias-tver-oblast-sbu-source-claims/",
"citace":"Ukrainian drones again hit oil pumping station in Russia's Tver Oblast, SBU source claims"
}
}
]
},
{
"id":"subchankulovo",
"strana":"RU",
"druh":"precerpavaci",
"nazev":"Přečerpávací stanice Subchankulovo",
"vlastnik":"Transněfť",
"misto":"Subchankulovo, Tujmazinský rajón, Baškortostán",
"gps":[
54.558,
53.812
],
"vyznam":"Uzel hlavních ropovodů, který vede ropu ze západní Sibiře a Baškortostánu. Napojují se na něj čtyři ropovody.",
"kapacita":{
"hodnota":90,
"jednotka":"mil. t ropy/rok",
"popis":"roční průtok podle EnergyBase (cituje Astra)",
"historie":[],
"zdroj":{
"nazev":"S Ziņas",
"url":"https://szinas.com/en/politika/drones-hit-transneft-oil-pumping-station-subkhankulovo-bashkortostan/",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2026-11-26",
"provoz":"neznamo",
"text":"Ráno 26. 11. 2026 ještě hořelo. O zastavení čerpání zprávy nejsou.",
"zdroj":{
"nazev":"Euromaidan Press, 26. 11. 2026",
"url":"https://euromaidanpress.com/2026/11/26/ukraine-sets-a-russian-pipeline-hub-alight-and-returns-to-an-explosives-chemistry-plant-attacked-at-least-seven-times-before/",
"archiv":null,
"citace":null
}
},
"neuplne":null,
"zasahy":[
{
"d":"2026-07-23",
"prostredek":"drony",
"co":"Podle serveru Astra drony stanici zasáhly už v červenci. Podrobnosti chybí.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"S Ziņas",
"url":"https://szinas.com/en/politika/drones-hit-transneft-oil-pumping-station-subkhankulovo-bashkortostan/",
"archiv":null,
"citace":null
}
},
{
"d":"2026-11-26",
"prostredek":"drony",
"co":"Požár v průmyslové zóně po pádu dronu potvrdil přednosta rajónu. Podle ukrajinského generálního štábu zničena nádrž.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Euromaidan Press, 26. 11. 2026",
"url":"https://euromaidanpress.com/2026/11/26/ukraine-sets-a-russian-pipeline-hub-alight-and-returns-to-an-explosives-chemistry-plant-attacked-at-least-seven-times-before/",
"archiv":null,
"citace":"no one was killed or injured"
}
}
]
},
{
"id":"primorsk",
"strana":"RU",
"druh":"pristav",
"nazev":"Ropný přístav Primorsk",
"vlastnik":"Transněfť",
"misto":"Primorsk, Leningradská oblast (Finský záliv)",
"gps":[
60.333,
28.717
],
"vyznam":"Největší ruský ropný přístav na západě: nakládá ruskou ropu Urals a naftu, hlavně pro tankery stínové flotily.",
"kapacita":{
"hodnota":1.0,
"jednotka":"mil. barelů/den",
"popis":"nakládka ropy (k tomu ~0,3 mil. barelů/den nafty)",
"historie":[
[
2008,
75.6,
"mil. t překládky celkem"
],
[
2012,
74.8,
"mil. t"
],
[
2015,
59.6,
"mil. t"
],
[
2019,
61.0,
"mil. t"
]
],
"zdroj":{
"nazev":"Reuters přes US News, 12. 9. 2025",
"url":"https://www.usnews.com/news/world/articles/2025-09-12/drones-attack-russias-oil-loading-primorsk-port-for-first-time",
"archiv":null,
"citace":"Ukrainian Drones Disrupt Russia's Key Western Oil Terminal for the First Time"
}
},
"stav":{
"k":"2026-05-03",
"provoz":"neznamo",
"text":"Po zásahu 3. 5. 2026 jsme nenašli zprávu o dalším zastavení ani o obnovení plného provozu.",
"zdroj":{
"nazev":"Wikipedie: Port of Primorsk",
"url":"https://en.wikipedia.org/wiki/Port_of_Primorsk",
"archiv":"https://web.archive.org/web/20260323214559/https://en.wikipedia.org/wiki/Port_of_Primorsk",
"citace":null
}
},
"neuplne":"Historie překládky je z Wikipedie (2008–2019). Zprávy po květnu 2026 jsme nenašli.",
"zasahy":[
{
"d":"2025-09-12",
"prostredek":"drony",
"co":"Poprvé v historii se zastavila nakládka ropy. Hořel tanker a čerpací stanice, zasaženy dva tankery. Gubernátor potvrdil požár.",
"dopad":2,
"obnova":"asi 2 dny",
"obnovaDni":2,
"vypadek":"~1 mil. barelů/den ropy",
"overeni":"over",
"zdroj":{
"nazev":"Reuters přes US News, 12. 9. 2025",
"url":"https://www.usnews.com/news/world/articles/2025-09-12/drones-attack-russias-oil-loading-primorsk-port-for-first-time",
"archiv":null,
"citace":"Ukrainian Drones Disrupt Russia's Key Western Oil Terminal for the First Time"
}
},
{
"d":"2026-03-23",
"prostredek":"drony",
"co":"Hořely nádrže s palivem, gubernátor to potvrdil. Přístav zůstal zavřený.",
"dopad":3,
"obnova":"částečně obnoveno 26. 3.",
"obnovaDni":3,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters přes US News, 23. 3. 2026",
"url":"https://www.usnews.com/news/world/articles/2026-03-23/fuel-reservoir-in-russias-primorsk-port-on-fire-after-drone-attack-governor-says",
"archiv":"https://web.archive.org/web/20260323090427/https://www.usnews.com/news/world/articles/2026-03-23/fuel-reservoir-in-russias-primorsk-port-on-fire-after-drone-attack-governor-says",
"citace":"Russia's Ust-Luga Restarts Oil Exports, Primorsk Remains Shut After Drone Attacks"
}
},
{
"d":"2026-03-25",
"prostredek":"drony",
"co":"Další vlna dronů: Primorsk i Usť-Luga zastavily nakládku. Podle výpočtu Reuters stálo nejméně 40 % ruské vývozní kapacity pro ropu.",
"dopad":3,
"obnova":"částečně 26. 3. 2026",
"obnovaDni":1,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Euromaidan Press (Reuters), 25. 3. 2026",
"url":"https://euromaidanpress.com/2026/03/25/reuters-40-of-russias-oil-exports-offline-mostly-due-to-ukrainian-drone-strikes-worst-disruption-in-russian-history/",
"archiv":"https://web.archive.org/web/20260918100037/https://euromaidanpress.com/2026/03/25/reuters-40-of-russias-oil-exports-offline-mostly-due-to-ukrainian-drone-strikes-worst-disruption-in-russian-history/",
"citace":"40% of Russia's oil exports offline"
}
},
{
"d":"2026-04-05",
"prostredek":"drony",
"co":"Gubernátor nejprve hlásil poškozený ropovod u Primorsku, pak upřesnil, že hořely nádrže s palivem.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times, 5. 4. 2026",
"url":"https://www.themoscowtimes.com/2026/04/05/ukrainian-strike-damages-central-russian-oil-refinery-baltic-port-oil-facility-a92424",
"archiv":"https://web.archive.org/web/20260812100112/https://www.themoscowtimes.com/2026/04/05/ukrainian-strike-damages-central-russian-oil-refinery-baltic-port-oil-facility-a92424",
"citace":"Ukrainian Strike Damages Central Russian Oil Refinery, Baltic Port Oil Facility"
}
},
{
"d":"2026-05-03",
"prostredek":"drony",
"co":"Útok na přístav, tanker a válečné lodě. Gubernátor mluvil jen o rychle uhašeném požáru, Zelenskyj o velkých škodách.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters přes US News, 3. 5. 2026",
"url":"https://www.usnews.com/news/world/articles/2026-05-03/russias-primorsk-port-hit-as-ukraine-launches-wave-of-drone-strikes",
"archiv":"https://web.archive.org/web/20260503090210/https://www.usnews.com/news/world/articles/2026-05-03/russias-primorsk-port-hit-as-ukraine-launches-wave-of-drone-strikes",
"citace":"Ukrainian Drones Hit Russia's Primorsk Port, Oil Tankers and Military Ships"
}
}
]
},
{
"id":"ust_luga",
"strana":"RU",
"druh":"pristav",
"nazev":"Přístav Usť-Luga (ropný terminál a komplex Novatek)",
"vlastnik":"Transněfť (ropa), Novatek (plynový kondenzát)",
"misto":"Usť-Luga, Leningradská oblast",
"gps":[
59.66,
28.277
],
"vyznam":"Druhý největší ruský vývozní přístav na Baltu. Končí tu ropovod BTS-2 a Novatek tu zpracovává plynový kondenzát.",
"kapacita":{
"hodnota":0.7,
"jednotka":"mil. barelů/den",
"popis":"nakládka ropy",
"historie":[
[
2018,
98.7,
"mil. t všech nákladů v přístavu"
]
],
"zdroj":{
"nazev":"bne IntelliNews, 3/2026",
"url":"https://www.intellinews.com/ukraine-hits-russia-s-baltic-oil-export-terminals-again-434145/",
"archiv":"https://web.archive.org/web/20260331151224/https://www.intellinews.com/ukraine-hits-russia-s-baltic-oil-export-terminals-again-434145/",
"citace":null
}
},
"stav":{
"k":"2026-10-31",
"provoz":"bezi",
"text":"V říjnu 2026 nakládka ropy v Usť-Luze vzrostla o 17 % proti září.",
"zdroj":{
"nazev":"CREA, měsíční analýza – říjen 2026",
"url":"https://energyandcleanair.org/october-2026-monthly-analysis-of-russian-fossil-fuel-exports-and-sanctions/",
"archiv":null,
"citace":null
}
},
"neuplne":"Útok 31. 8./1. 9. 2026 (gubernátor podle souhrnů potvrdil škody) jsme nedohledali v primárním zdroji.",
"zasahy":[
{
"d":"2024-01-21",
"prostredek":"drony",
"co":"SBU zasáhla plynový terminál Novateku. Požár se hasil přes den a Novatek přerušil provoz komplexu.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie: Ust-Luga Multimodal Complex",
"url":"https://en.wikipedia.org/wiki/Ust-Luga_Multimodal_Complex",
"archiv":"https://web.archive.org/web/20260203050327/https://en.wikipedia.org/wiki/Ust-Luga_Multimodal_Complex",
"citace":null
}
},
{
"d":"2025-08-24",
"prostredek":"drony",
"co":"Požár na terminálu Novateku, videa ukazovala poškozenou frakcionační kolonu.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie: Ust-Luga Multimodal Complex",
"url":"https://en.wikipedia.org/wiki/Ust-Luga_Multimodal_Complex",
"archiv":"https://web.archive.org/web/20260203050327/https://en.wikipedia.org/wiki/Ust-Luga_Multimodal_Complex",
"citace":null
}
},
{
"d":"2026-03-22",
"prostredek":"drony",
"co":"Usť-Luga i Primorsk zastavily vývoz ropy a paliv. Usť-Luga obnovila nakládku další den po odvolání poplachu.",
"dopad":2,
"obnova":"1 den",
"obnovaDni":1,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters přes US News, 23. 3. 2026",
"url":"https://www.usnews.com/news/world/articles/2026-03-23/fuel-reservoir-in-russias-primorsk-port-on-fire-after-drone-attack-governor-says",
"archiv":"https://web.archive.org/web/20260323090427/https://www.usnews.com/news/world/articles/2026-03-23/fuel-reservoir-in-russias-primorsk-port-on-fire-after-drone-attack-governor-says",
"citace":"Russia's Ust-Luga Restarts Oil Exports"
}
},
{
"d":"2026-03-25",
"prostredek":"drony",
"co":"Mohutný útok: požár nádrží, kouř bylo vidět z Finska. Nakládka ropy stála do 4. 4. 2026, kdy začal nakládat první tanker.",
"dopad":3,
"obnova":"asi 10 dní (částečně)",
"obnovaDni":10,
"vypadek":"~0,7 mil. barelů/den",
"overeni":"over",
"zdroj":{
"nazev":"Reuters/Bloomberg přes US News, 5. 4. 2026",
"url":"https://www.usnews.com/news/world/articles/2026-04-05/russian-baltic-port-resumes-crude-loading-after-attacks-bloomberg-news-reports",
"archiv":"https://web.archive.org/web/20260405214616/https://www.usnews.com/news/world/articles/2026-04-05/russian-baltic-port-resumes-crude-loading-after-attacks-bloomberg-news-reports",
"citace":"Russian Baltic Port Resumes Crude Loading After Attacks"
}
},
{
"d":"2026-03-27",
"prostredek":"drony",
"co":"Další zásah během zastavené nakládky. Ropné firmy varovaly před vyhlášením vyšší moci.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie: Ust-Luga Multimodal Complex",
"url":"https://en.wikipedia.org/wiki/Ust-Luga_Multimodal_Complex",
"archiv":"https://web.archive.org/web/20260203050327/https://en.wikipedia.org/wiki/Ust-Luga_Multimodal_Complex",
"citace":null
}
},
{
"d":"2026-03-29",
"prostredek":"drony",
"co":"Přístav znovu zasažen.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie: Ust-Luga",
"url":"https://en.wikipedia.org/wiki/Ust-Luga",
"archiv":"https://web.archive.org/web/20261012131956/https://en.wikipedia.org/wiki/Ust-Luga",
"citace":null
}
},
{
"d":"2026-03-31",
"prostredek":"drony",
"co":"Podle Reuters pátý zásah Usť-Lugy za deset dní.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie: Ust-Luga",
"url":"https://en.wikipedia.org/wiki/Ust-Luga",
"archiv":"https://web.archive.org/web/20261012131956/https://en.wikipedia.org/wiki/Ust-Luga",
"citace":null
}
},
{
"d":"2026-08-14",
"prostredek":"drony",
"co":"Gubernátor potvrdil požár v přístavu. Podle zdrojů Reuters nakládka ropy pokračovala.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Independent",
"url":"https://kyivindependent.com/ukrainian-drones-damage-russias-ust-luga-port-governor-says/",
"archiv":"https://web.archive.org/web/20261111121301/https://kyivindependent.com/ukrainian-drones-damage-russias-ust-luga-port-governor-says/",
"citace":"Ukraine confirms drone strike on Russia's Ust-Luga port"
}
}
]
},
{
"id":"novorossijsk_seschar",
"strana":"RU",
"druh":"pristav",
"nazev":"Ropný terminál Šeschar (Novorossijsk)",
"vlastnik":"Transněfť",
"misto":"Novorossijsk, Krasnodarský kraj",
"gps":[
44.723,
37.834
],
"vyznam":"Hlavní ruský vývozní terminál pro ropu na Černém moři: Urals, kazachstánská KEBCO a Siberian Light.",
"kapacita":{
"hodnota":0.7,
"jednotka":"mil. barelů/den",
"popis":"běžná nakládka ropy",
"historie":[
[
"2026-06",
0.8,
"nakládka v Novorossijsku"
],
[
"2026-07",
1.0,
"nakládka v Novorossijsku (téměř)"
]
],
"zdroj":{
"nazev":"Meduza (Reuters), 14. 8. 2026",
"url":"https://meduza.io/en/news/2026/08/14/drone-threat-halts-russia-s-main-black-sea-oil-terminal-which-normally-ships-700-000-barrels-a-day",
"archiv":"https://web.archive.org/web/20260815205628/https://meduza.io/en/news/2026/08/14/drone-threat-halts-russia-s-main-black-sea-oil-terminal-which-normally-ships-700-000-barrels-a-day",
"citace":"normally ships 700,000 barrels a day"
}
},
"stav":{
"k":"2026-10-31",
"provoz":"castecne",
"text":"Vývoz ropných produktů z Novorossijsku byl v říjnu 2026 asi o 80 % nižší než před rokem.",
"zdroj":{
"nazev":"CREA, měsíční analýza – říjen 2026",
"url":"https://energyandcleanair.org/october-2026-monthly-analysis-of-russian-fossil-fuel-exports-and-sanctions/",
"archiv":null,
"citace":null
}
},
"neuplne":"Pauza od 21. 7. 2026 (Bloomberg, obava z dronů) a útok 8. 6. 2026 na sklad Gruševaja nejsou jako samostatné zásahy uvedeny.",
"zasahy":[
{
"d":"2025-11-14",
"prostredek":"drony",
"co":"Nejničivější útok do té doby: poškozen sklad ropy a dvě kotviště. Transněfť zastavila přítok ropy, nakládka stála dva dny.",
"dopad":2,
"obnova":"2 dny",
"obnovaDni":2,
"vypadek":"~0,7–0,83 mil. barelů/den (Kpler)",
"overeni":"over",
"zdroj":{
"nazev":"Euromaidan Press (Reuters), 16. 11. 2025",
"url":"https://euromaidanpress.com/2025/11/16/russia-resumes-oil-exports-at-novorossiysk-after-two-day-shutdown-caused-by-ukrainian-air-assault/",
"archiv":"https://web.archive.org/web/20251128192455/https://euromaidanpress.com/2025/11/16/russia-resumes-oil-exports-at-novorossiysk-after-two-day-shutdown-caused-by-ukrainian-air-assault/",
"citace":"Russia resumes oil exports at Novorossiysk after two-day shutdown"
}
},
{
"d":"2025-11-25",
"prostredek":"drony",
"co":"Podle zdrojů Kyiv Post poškozen nakládací terminál Šeschar, protivzdušná obrana a výsadková loď.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Kyiv Post",
"url":"https://www.kyivpost.com/post/64941",
"archiv":"https://web.archive.org/web/20260225083513/https://www.kyivpost.com/post/64941",
"citace":"Ukraine Pummels Novorossiysk Again"
}
},
{
"d":"2026-03-02",
"prostredek":"drony",
"co":"Útok SBU, Astra hlásila požár ropného terminálu. Podle Reuters stála nakládka v Šescharu pět dní.",
"dopad":2,
"obnova":"5 dní",
"obnovaDni":5,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters přes US News, 7. 4. 2026",
"url":"https://www.usnews.com/news/world/articles/2026-04-07/russias-black-seas-sheskharis-terminal-halts-loadings-after-drone-attack-sources-say",
"archiv":"https://web.archive.org/web/20260407135929/https://www.usnews.com/news/world/articles/2026-04-07/russias-black-seas-sheskharis-terminal-halts-loadings-after-drone-attack-sources-say",
"citace":null
}
},
{
"d":"2026-04-06",
"prostredek":"drony",
"co":"Masivní útok s požáry, poškozena kotviště a potrubí k nádržím. Nakládka se zastavila, částečně se obnovila asi po týdnu. Hlavní kotviště 1 a 1A byla 14. 4. stále prázdná.",
"dopad":3,
"obnova":"částečně po ~1 týdnu, plně neznámo",
"obnovaDni":null,
"vypadek":"~0,7 mil. barelů/den",
"overeni":"over",
"zdroj":{
"nazev":"Reuters přes US News, 7. 4. 2026",
"url":"https://www.usnews.com/news/world/articles/2026-04-07/russias-black-seas-sheskharis-terminal-halts-loadings-after-drone-attack-sources-say",
"archiv":"https://web.archive.org/web/20260407135929/https://www.usnews.com/news/world/articles/2026-04-07/russias-black-seas-sheskharis-terminal-halts-loadings-after-drone-attack-sources-say",
"citace":"Russia's Black Sea's Sheskharis Terminal Halts Loadings After Drone Attack"
}
},
{
"d":"2026-08-12",
"prostredek":"drony",
"co":"Po útoku (a pokusu 14. 8.) se zastavila nakládka a terminál nepřijímal ropu, nádrže byly plné. Nakládka v Novorossijsku stála 9 dní po sobě, nejdéle od začátku války.",
"dopad":3,
"obnova":"9 dní",
"obnovaDni":9,
"vypadek":"nakládka ropy −58 % proti červenci",
"overeni":"over",
"zdroj":{
"nazev":"CREA, měsíční analýza – srpen 2026",
"url":"https://energyandcleanair.org/august-2026-monthly-analysis-of-russian-fossil-fuel-exports-and-sanctions/",
"archiv":"https://web.archive.org/web/20261115094241/https://energyandcleanair.org/august-2026-monthly-analysis-of-russian-fossil-fuel-exports-and-sanctions/",
"citace":"ceased for nine consecutive days"
}
}
]
},
{
"id":"cpc_terminal",
"strana":"RU",
"druh":"pristav",
"nazev":"Námořní terminál CPC (Južnaja Ozerejevka)",
"vlastnik":"Kaspické potrubní konsorcium (CPC; Rusko, Kazachstán, Chevron aj.)",
"misto":"Južnaja Ozerejevka u Novorossijsku, Krasnodarský kraj",
"gps":[
44.683,
37.63
],
"vyznam":"Konec ropovodu z Kazachstánu: asi 1 % světových dodávek ropy a 80 % kazachstánského vývozu. Nakládá se tu na tři jednobodová kotviště (bóje) na moři.",
"kapacita":{
"hodnota":1.5,
"jednotka":"mil. barelů/den",
"popis":"průtok ropovodu a terminálu CPC",
"historie":[],
"zdroj":{
"nazev":"The Diplomat, 2/2025",
"url":"https://thediplomat.com/2025/02/ukrainian-drones-hit-kazakhstans-main-oil-export-outlet-in-russia/",
"archiv":"https://web.archive.org/web/20260818092907/https://thediplomat.com/2025/02/ukrainian-drones-hit-kazakhstans-main-oil-export-outlet-in-russia/",
"citace":null
}
},
"stav":{
"k":"2026-09-30",
"provoz":"bezi",
"text":"Po incidentu s dronem 8. 9. 2026 se nakládka na kotvištích SPM-2 a SPM-3 obnovila a běží normálně.",
"zdroj":{
"nazev":"Astana Times, 9/2026",
"url":"https://astanatimes.com/2026/09/cpc-oil-loading-operations-resume-after-drone-incident/",
"archiv":"https://web.archive.org/web/20260911142139/https://astanatimes.com/2026/09/cpc-oil-loading-operations-resume-after-drone-incident/",
"citace":"loading operations have since resumed and are currently operating normally"
}
},
"neuplne":"Útok na tanker u SPM-3 30. 7. (rok nejasný) jsme nezařadili. Datum opravy SPM-2 nebylo zveřejněno.",
"zasahy":[
{
"d":"2025-09-24",
"prostredek":"drony",
"co":"Poškozena městská kancelář CPC v Novorossijsku, zraněni dva zaměstnanci.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Times of Central Asia",
"url":"https://timesca.com/attacks-on-cpc-and-kazakhstan-oil-exports/",
"archiv":"https://web.archive.org/web/20261012070756/https://timesca.com/attacks-on-cpc-and-kazakhstan-oil-exports/",
"citace":null
}
},
{
"d":"2025-11-14",
"prostredek":"drony",
"co":"Při velkém útoku na Novorossijsk terminál CPC dočasně přerušil nakládku, podle Kpleru ji obnovil ještě týž den.",
"dopad":1,
"obnova":"týž den",
"obnovaDni":0,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Kpler",
"url":"https://www.kpler.com/blog/drone-strikes-near-novorossiysk-to-temporarily-halt-700-kbd-in-sheskaris-oil-loadings",
"archiv":"https://web.archive.org/web/20260822175612/https://www.kpler.com/blog/drone-strikes-near-novorossiysk-to-temporarily-halt-700-kbd-in-sheskaris-oil-loadings",
"citace":null
}
},
{
"d":"2025-11-25",
"prostredek":"drony",
"co":"Úlomky poškodily správní budovu terminálu, během útoku se přerušila nakládka na bójích.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"TASS",
"url":"https://tass.com/economy/2048699",
"archiv":"https://web.archive.org/web/20260320103159/https://tass.com/economy/2048699",
"citace":"Building at CPC marine terminal damaged by drone"
}
},
{
"d":"2025-11-29",
"prostredek":"námořní drony",
"co":"Námořní drony těžce poškodily kotviště SPM-2, které podle CPC dál nemůže fungovat. Nakládka se zastavila, tankery odpluly. V lednu 2026 jelo jen SPM-1.",
"dopad":3,
"obnova":"měsíce (SPM-2 v provozu nejpozději v září 2026)",
"obnovaDni":null,
"vypadek":"1 ze 3 kotvišť",
"overeni":"over",
"zdroj":{
"nazev":"Ukrajinska pravda, 29. 11. 2025",
"url":"https://www.pravda.com.ua/eng/news/2025/11/29/8009546/",
"archiv":"https://web.archive.org/web/20260728150035/https://www.pravda.com.ua/eng/news/2025/11/29/8009546/",
"citace":"Further operation of Single Point Mooring 2 is not possible"
}
},
{
"d":"2026-01-13",
"prostredek":"drony",
"co":"Drony zasáhly nejméně tři tankery mířící k terminálu pro kazachstánskou ropu. Kazachstán útok potvrdil.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Caspian News",
"url":"https://caspiannews.com/news-detail/kazakhstan-confirms-drone-strikes-on-tankers-near-cpc-terminal-2026-1-14-0/",
"archiv":null,
"citace":"Kazakhstan Confirms Drone Strikes on Tankers Near CPC Terminal"
}
},
{
"d":"2026-04-06",
"prostredek":"drony",
"co":"Podle ruského ministerstva obrany drony poškodily část kotviště a zapálily čtyři nádrže.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times, 6. 4. 2026",
"url":"https://www.themoscowtimes.com/2026/04/06/ukraine-hits-major-oil-terminal-in-southern-russia-moscow-a92430",
"archiv":"https://web.archive.org/web/20261003181954/https://www.themoscowtimes.com/2026/04/06/ukraine-hits-major-oil-terminal-in-southern-russia-moscow-a92430",
"citace":"Ukraine Hits Major Oil Terminal in Southern Russia"
}
},
{
"d":"2026-07-19",
"prostredek":"drony",
"co":"17.–20. 7. drony zasáhly tři tankery u terminálu, jeden při nakládce na SPM-1. Nakládka se přerušila, Chevron ji 31. 7. hlásil obnovenou na dvou kotvištích.",
"dopad":2,
"obnova":"asi 12 dní",
"obnovaDni":12,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Times of Central Asia",
"url":"https://timesca.com/kazakhstan-condemns-drone-attacks-as-cpc-oil-loadings-halt/",
"archiv":"https://web.archive.org/web/20260722201156/https://timesca.com/kazakhstan-condemns-drone-attacks-as-cpc-oil-loadings-halt/",
"citace":"Kazakhstan Condemns Drone Attacks as CPC Oil Loadings Halt"
}
},
{
"d":"2026-09-08",
"prostredek":"drony",
"co":"Incident s dronem: nakládka na SPM-2 a SPM-3 se dočasně přerušila, pak se obnovila.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Astana Times, 9/2026",
"url":"https://astanatimes.com/2026/09/cpc-oil-loading-operations-resume-after-drone-incident/",
"archiv":"https://web.archive.org/web/20260911142139/https://astanatimes.com/2026/09/cpc-oil-loading-operations-resume-after-drone-incident/",
"citace":"CPC Oil Loading Operations Resume After Drone Incident"
}
}
]
},
{
"id":"tuapse_pristav",
"strana":"RU",
"druh":"pristav",
"nazev":"Ropný terminál a přístav Tuapse",
"vlastnik":"Rosněfť",
"misto":"Tuapse, Krasnodarský kraj",
"gps":[
44.09,
39.082
],
"vyznam":"Před válkou čtvrtý největší ruský přístav pro vývoz ropných produktů, hlavně z rafinerie Tuapse.",
"kapacita":{
"hodnota":9.7,
"jednotka":"mil. t/rok",
"popis":"kapacita terminálu (71 mil. barelů/rok)",
"historie":[
[
2024,
9.1,
"mil. t vývozu přes přístav (o třetinu méně než 2023)"
]
],
"zdroj":{
"nazev":"Wikipedie: Tuapse oil terminal",
"url":"https://en.wikipedia.org/wiki/Tuapse_oil_terminal",
"archiv":"https://web.archive.org/web/20260506223731/https://en.wikipedia.org/wiki/Tuapse_oil_terminal",
"citace":"approximately 71 million barrels per annum"
}
},
"stav":{
"k":"2026-10-31",
"provoz":"mimo",
"text":"Tuapse od srpna 2026 nenaložil vůbec žádné ropné produkty, od května čelí neustálým útokům.",
"zdroj":{
"nazev":"CREA, měsíční analýza – říjen 2026",
"url":"https://energyandcleanair.org/october-2026-monthly-analysis-of-russian-fossil-fuel-exports-and-sanctions/",
"archiv":null,
"citace":"loaded no oil products at all since August"
}
},
"neuplne":"Útok kolem přelomu 2025/2026 (poškozené kotviště, dvoutýdenní pauza) jsme nedokázali přesně datovat.",
"zasahy":[
{
"d":"2025-11-02",
"prostredek":"drony",
"co":"Hořel tanker a nakládací zařízení, vyřazeny čtyři nakládací stojany. Vývoz stál asi dva týdny.",
"dopad":3,
"obnova":"asi 2 týdny",
"obnovaDni":14,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Post",
"url":"https://www.kyivpost.com/post/63708",
"archiv":"https://web.archive.org/web/20251127095341/https://www.kyivpost.com/post/63708",
"citace":"Ukraine's Drones Hit Tuapse Oil Hub, Disrupt Exports to Asia"
}
},
{
"d":"2026-04-16",
"prostredek":"drony",
"co":"Velký požár nádrží a přístavu hořel tři dny, zemřeli nejméně dva lidé. Rafinerie se zastavila, protože nemohla vyvážet, a terminál přestal fungovat.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":"celý vývoz přes Tuapse",
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie: 2026 Tuapse oil terminal disaster",
"url":"https://en.wikipedia.org/wiki/2026_Tuapse_oil_terminal_disaster",
"archiv":"https://web.archive.org/web/20260506223728/https://en.wikipedia.org/wiki/2026_Tuapse_oil_terminal_disaster",
"citace":"forced a complete halt of refinery operations due to the inability to ship products"
}
},
{
"d":"2026-04-20",
"prostredek":"drony",
"co":"Druhá vlna: zasažen sklad nádrží, požáry znovu vzplály. Vyhlášen výjimečný stav.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie: 2026 Tuapse oil terminal disaster",
"url":"https://en.wikipedia.org/wiki/2026_Tuapse_oil_terminal_disaster",
"archiv":"https://web.archive.org/web/20260506223728/https://en.wikipedia.org/wiki/2026_Tuapse_oil_terminal_disaster",
"citace":null
}
},
{
"d":"2026-04-28",
"prostredek":"drony",
"co":"Třetí vlna ještě před uhašením požárů, evakuace obyvatel.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie: 2026 Tuapse oil terminal disaster",
"url":"https://en.wikipedia.org/wiki/2026_Tuapse_oil_terminal_disaster",
"archiv":"https://web.archive.org/web/20260506223728/https://en.wikipedia.org/wiki/2026_Tuapse_oil_terminal_disaster",
"citace":null
}
},
{
"d":"2026-05-02",
"prostredek":"drony",
"co":"Čtvrtá vlna útoků (Guardian, SBU), bez obětí.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie: 2026 Tuapse oil terminal disaster",
"url":"https://en.wikipedia.org/wiki/2026_Tuapse_oil_terminal_disaster",
"archiv":"https://web.archive.org/web/20260506223728/https://en.wikipedia.org/wiki/2026_Tuapse_oil_terminal_disaster",
"citace":null
}
},
{
"d":"2026-05-27",
"prostredek":"drony",
"co":"Další útok v noci na 27. 5. 2026.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie: 2026 Tuapse oil terminal disaster",
"url":"https://en.wikipedia.org/wiki/2026_Tuapse_oil_terminal_disaster",
"archiv":"https://web.archive.org/web/20260506223728/https://en.wikipedia.org/wiki/2026_Tuapse_oil_terminal_disaster",
"citace":null
}
}
]
},
{
"id":"taman",
"strana":"RU",
"druh":"pristav",
"nazev":"Terminál Tamanněftěgaz (přístav Taman)",
"vlastnik":"OTEKO",
"misto":"Volna, Temrjucký rajón, Krasnodarský kraj",
"gps":[
45.127,
36.711
],
"vyznam":"Největší soukromý ropný překladiště na jihu Ruska: ropa, mazut, nafta a zkapalněné plyny.",
"kapacita":{
"hodnota":19.9,
"jednotka":"mil. t/rok",
"popis":"kapacita překládky terminálu",
"historie":[
[
2025,
4.16,
"mil. t ropných produktů vyvezených přístavem Taman"
]
],
"zdroj":{
"nazev":"UNITED24 Media",
"url":"https://united24media.com/war-in-ukraine/russian-oil-export-hub-with-20m-ton-capacity-burns-after-ukrainian-drone-strike-21199",
"archiv":null,
"citace":"Russian Oil Export Hub With 20M-Ton Capacity Burns"
}
},
"stav":{
"k":"2026-07-30",
"provoz":"neznamo",
"text":"Po požáru 30. 7. 2026 jsme nenašli zprávy o rozsahu škod ani o provozu.",
"zdroj":{
"nazev":"Wikipedie: Port of Taman",
"url":"https://en.wikipedia.org/wiki/Port_of_Taman",
"archiv":"https://web.archive.org/web/20251229124331/https://en.wikipedia.org/wiki/Port_of_Taman",
"citace":null
}
},
"neuplne":"Útoky před prosincem 2025 jsme nenašli.",
"zasahy":[
{
"d":"2025-12-22",
"prostredek":"drony",
"co":"Podle ukrajinské rozvědky a generálního štábu zasažena nakládací zařízení, molo pro zkapalněný plyn a dvě lodě, požár přes 1000 m².",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"RBC-Ukrajina",
"url":"https://newsukraine.rbc.ua/news/largest-russian-oil-terminal-in-black-sea-1766409515.html",
"archiv":"https://web.archive.org/web/20260513214949/https://newsukraine.rbc.ua/news/largest-russian-oil-terminal-in-black-sea-1766409515.html",
"citace":"Largest Russian oil terminal in Black Sea region hit by Ukrainian intelligence drones"
}
},
{
"d":"2026-01-21",
"prostredek":"drony",
"co":"Hořely čtyři nádrže s ropnými produkty, poškozena potrubí na molech.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Militarnyi",
"url":"https://militarnyi.com/en/news/drones-strike-oil-and-gas-terminal-at-port-of-taman/",
"archiv":"https://web.archive.org/web/20260730104640/https://militarnyi.com/en/news/drones-strike-oil-and-gas-terminal-at-port-of-taman/",
"citace":"Drones Strike Oil and Gas Terminal at Port of Taman"
}
},
{
"d":"2026-02-15",
"prostredek":"drony",
"co":"Hořela nádrž, sklad a terminály ve Volně, dva lidé zraněni. Reuters hlásil poškození přístavu.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie: Port of Taman",
"url":"https://en.wikipedia.org/wiki/Port_of_Taman",
"archiv":"https://web.archive.org/web/20251229124331/https://en.wikipedia.org/wiki/Port_of_Taman",
"citace":null
}
},
{
"d":"2026-05-13",
"prostredek":"drony",
"co":"Zasažen potrubní most mezi moly 3 a 4 během nakládky tankeru. Místní úřady mluvily o požáru od trosek.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Militarnyi",
"url":"https://militarnyi.com/en/news/sof-strike-bridge-structure-at-taman-oil-terminal-port-cyberboroshno/",
"archiv":"https://web.archive.org/web/20260718232854/https://militarnyi.com/en/news/sof-strike-bridge-structure-at-taman-oil-terminal-port-cyberboroshno/",
"citace":"SOF Strike Bridge Structure at Taman Oil Terminal Port"
}
},
{
"d":"2026-06-13",
"prostredek":"drony",
"co":"Podle SBU zasaženo pět nádrží a dva nakládací stojany.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"NV.ua",
"url":"https://english.nv.ua/nation/sbu-says-ukrainian-forces-hit-tamanneftegaz-terminal-50615980.html",
"archiv":null,
"citace":"SBU says Ukrainian forces hit Tamanneftegaz terminal"
}
},
{
"d":"2026-07-30",
"prostredek":"drony",
"co":"Velký požár, který potvrdily satelitní data NASA FIRMS. Firma OTEKO požár potvrdila a lidi evakuovala předem.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"UNITED24 Media",
"url":"https://united24media.com/war-in-ukraine/russian-oil-export-hub-with-20m-ton-capacity-burns-after-ukrainian-drone-strike-21199",
"archiv":null,
"citace":null
}
}
]
},
{
"id":"alabuga",
"strana":"RU",
"druh":"zbrojovka",
"nazev":"Továrna na drony Alabuga (Jelabuga)",
"vlastnik":"zvláštní ekonomická zóna Alabuga (ruský stát)",
"misto":"Jelabuga, Tatarstán",
"gps":[
55.821,
52.048
],
"vyznam":"Hlavní ruská továrna na útočné drony Šahed/Geraň a klamné drony Gerbera, jimiž Rusko každou noc útočí na ukrajinská města a energetiku. Leží přes 1 000 km od Ukrajiny.",
"kapacita":{
"hodnota":5800,
"jednotka":"dronů/měsíc",
"popis":"odhad výroby všech typů Geraň (asi 3 000 proudových Geraň-4/5 + 2 800 pístových Geraň-2) podle ukrajinské rozvědky, srpen 2026; CSIS v říjnu 2026 odhadl kapacitu na přes 78 000 dronů ročně",
"historie":[
[
2023,
100,
"plán: montáž ze sad z Íránu, kusů/měsíc (Washington Post)"
],
[
2025,
5100,
"jaro 2025: asi 170 Geraní-2 denně (Defence Blog), přepočet ~5 100/měsíc"
],
[
2026,
5800,
"srpen 2026: odhad HUR, všechny typy Geraň"
]
],
"zdroj":{
"nazev":"Institute for Science and International Security – měsíční analýza Šahedů",
"url":"https://isis-online.org/isis-reports/monthly-analysis-of-russian-shahed-136-deployment-against-ukraine-updated",
"archiv":"http://web.archive.org/web/20261117092536/https://isis-online.org/isis-reports/monthly-analysis-of-russian-shahed-136-deployment-against-ukraine-updated",
"citace":"plus about 2,800 piston-engine Geran-2 UAVs per month, or roughly 5,800 in total."
}
},
"stav":{
"k":"2026-11-26",
"provoz":"bezi",
"text":"Továrna běží naplno a dál roste: mezi květnem 2025 a květnem 2026 se rozšířila o 340 ha, do září 2026 vzniklo asi 42 000 m² podzemních prostor a kolem areálu je přes 30 stanovišť protivzdušné obrany. Žádný ukrajinský útok výrobu prokazatelně nepřerušil.",
"zdroj":{
"nazev":"Military Watch Magazine, 21. 9. 2026",
"url":"https://militarywatchmagazine.com/article/russia-large-underground-attack-drone-factory",
"archiv":"http://web.archive.org/web/20261022104419/https://militarywatchmagazine.com/article/russia-large-underground-attack-drone-factory",
"citace":"approximately 42,000 square metres of underground space has already been constructed at the site"
}
},
"neuplne":"Podle Ukrajinské pravdy (5/2026) byly dosud zaznamenány jen tři ukrajinské útoky dronů na Alabugu, dva nedoletěly k cíli. Drobnější útoky na Jelabugu v dubnu a květnu 2025 a tvrzení odbojové skupiny Black Spark o sabotáži (6/2026) nejsou nezávisle potvrzené, proto nejsou v seznamu.",
"zasahy":[
{
"d":"2024-04-02",
"prostredek":"drony",
"co":"První útok na Alabugu – upravené ultralehké letadlo (asi Aeroprakt A-22) zasáhlo areál; poškozena ubytovna studentů-dělníků, zraněno 12 lidí. Tatarský prezident Minnichanov útok potvrdil, vážné škody na výrobě popřel.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"RFE/RL, 2. 4. 2024",
"url":"https://www.rferl.org/a/russia-ukrainian-drone-attack-tartarstan-alabuga-economic-zone/32887624.html",
"archiv":"http://web.archive.org/web/20261002111205/https://www.rferl.org/a/russia-ukrainian-drone-attack-tartarstan-alabuga-economic-zone/32887624.html",
"citace":null
}
},
{
"d":"2025-06-15",
"prostredek":"drony",
"co":"Útok dronů na výrobu Šahedů; podle gubernátora trosky dopadly na vrátnici „automobilového závodu“ – 1 mrtvý a 13 zraněných. Narušení výroby nebylo potvrzeno.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Post, 15. 6. 2025",
"url":"https://www.kyivpost.com/post/54559",
"archiv":"http://web.archive.org/web/20261105203114/https://www.kyivpost.com/post/54559",
"citace":"debris fell on the checkpoint building of the automobile plant in the Yelabuga district"
}
}
]
},
{
"id":"kremnij_el",
"strana":"RU",
"druh":"zbrojovka",
"nazev":"Závod mikroelektroniky Kremnij El",
"vlastnik":"skupina Kremnij El (pod sankcemi)",
"misto":"Brjansk, Brjanská oblast",
"gps":[
53.251,
34.331
],
"vyznam":"Podle EU druhý největší ruský výrobce mikroelektroniky; dodává čipy a součástky do řídicích systémů raket Iskander, protivzdušné obrany a radarů.",
"kapacita":{
"hodnota":null,
"jednotka":null,
"popis":"Výrobní objem není veřejně znám; závod vyrábí mikročipy, výkonové polovodiče a součástky pro řídicí, spojovací a rušicí systémy zbraní.",
"historie":[],
"zdroj":{
"nazev":"Wikipedie – Kremny EL",
"url":"https://en.wikipedia.org/wiki/Kremny_EL",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2026-07-07",
"provoz":"castecne",
"text":"Po zásahu střelami Storm Shadow 10. 3. 2026 výroba podle ukrajinských médií stála ještě v dubnu 2026; Defense Express soudil, že částečná obnova potrvá roky. Generální štáb ohlásil další zásah 7. 7. 2026. Skutečný stav výroby nezávisle ověřen není.",
"zdroj":{
"nazev":"glavnoe.in.ua, 7. 7. 2026",
"url":"https://glavnoe.in.ua/en/news-en/defense-forces-strike-russian-military-industrial-facilities-in-bryansk-region",
"archiv":"http://web.archive.org/web/20260711031005/https://glavnoe.in.ua/en/news-en/defense-forces-strike-russian-military-industrial-facilities-in-bryansk-region",
"citace":null
}
},
"neuplne":"Kyiv Post v lednu 2025 psal o „nejméně třetím“ útoku dronů na závod; data starších útoků z roku 2024 se nepodařilo spolehlivě dohledat.",
"zasahy":[
{
"d":"2024-10",
"prostredek":"drony",
"co":"Útok dronů; podle ukrajinských zdrojů závod poté dočasně přerušil práci.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Rubryka, 28. 4. 2025",
"url":"https://rubryka.com/en/2025/04/28/tspd-u-bryansku-drony-atakuvaly-zavod-kremnij-de-vyroblyayut-detali-do-iskanderiv-ta-ppo/",
"archiv":null,
"citace":"after the attack in October 2024, it even suspended its work"
}
},
{
"d":"2025-01-24",
"prostredek":"drony",
"co":"Drony SBU a sil speciálních operací zaútočily na závod současně s rafinerií Rjazaň; ruské ministerstvo obrany hlásilo 37 sestřelených dronů nad Brjanskou oblastí. Rozsah škod neověřen.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Ukrinform, 24. 1. 2025",
"url":"https://www.ukrinform.net/rubric-ato/3952247-general-staff-confirms-strikes-on-ryazan-refinery-kremniy-el-plant-in-bryansk.html",
"archiv":"http://web.archive.org/web/20260519132754/https://www.ukrinform.net/rubric-ato/3952247-general-staff-confirms-strikes-on-ryazan-refinery-kremniy-el-plant-in-bryansk.html",
"citace":null
}
},
{
"d":"2025-04-28",
"prostredek":"drony",
"co":"Rusko ohlásilo masivní útok dronů na Brjanskou oblast; podle ukrajinského Centra proti dezinformacím cílem byl Kremnij El. Výsledek neznámý.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Rubryka, 28. 4. 2025",
"url":"https://rubryka.com/en/2025/04/28/tspd-u-bryansku-drony-atakuvaly-zavod-kremnij-de-vyroblyayut-detali-do-iskanderiv-ta-ppo/",
"archiv":null,
"citace":null
}
},
{
"d":"2026-03-10",
"prostredek":"rakety",
"co":"Večerní úder britskými střelami Storm Shadow (podle OSINT 5–7 střel) na budovy závodu. Gubernátor Bogomaz potvrdil raketový útok, 6 mrtvých a 37 zraněných a kouř v Sovětském obvodu, kde závod stojí; Moskva si kvůli útoku předvolala britského a francouzského velvyslance. Výroba se podle ukrajinských médií zastavila.",
"dopad":4,
"obnova":"podle Defense Express roky",
"obnovaDni":null,
"vypadek":null,
"overeni":"odhad",
"zdroj":{
"nazev":"France 24, 10. 3. 2026",
"url":"https://www.france24.com/en/europe/20260310-kyiv-says-it-hit-key-russian-military-factory-in-missile-strike",
"archiv":"http://web.archive.org/web/20260928210843/https://www.france24.com/en/europe/20260310-kyiv-says-it-hit-key-russian-military-factory-in-missile-strike",
"citace":null
}
},
{
"d":"2026-07-07",
"prostredek":"drony",
"co":"Generální štáb ohlásil zásah areálu skupiny Kremnij El; rozsah škod se upřesňoval.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"glavnoe.in.ua, 7. 7. 2026",
"url":"https://glavnoe.in.ua/en/news-en/defense-forces-strike-russian-military-industrial-facilities-in-bryansk-region",
"archiv":"http://web.archive.org/web/20260711031005/https://glavnoe.in.ua/en/news-en/defense-forces-strike-russian-military-industrial-facilities-in-bryansk-region",
"citace":null
}
}
]
},
{
"id":"votkinsk",
"strana":"RU",
"druh":"zbrojovka",
"nazev":"Votkinský strojírenský závod",
"vlastnik":"Roskosmos (státní)",
"misto":"Votkinsk, Udmurtsko",
"gps":[
57.05,
53.981
],
"vyznam":"Jediný montážní závod balistických raket Iskander-M, vyrábí také rakety Orešnik, mezikontinentální Jars a ponorkové Bulava. Za války přijal 2 500 lidí a nakoupil čínské CNC stroje.",
"kapacita":{
"hodnota":65,
"jednotka":"raket Iskander-M/měsíc",
"popis":"odhad ukrajinské rozvědky z poloviny 2025: 60–70 Iskanderů-M měsíčně (plus 20–30 Iskanderů-K a 10–15 Kinžálů – ty ale nemusí pocházet jen z Votkinsku); v roce 2024 Rusko vyrobilo asi trojnásobek Iskanderů-M proti roku 2023",
"historie":[],
"zdroj":{
"nazev":"Kyiv Independent – exkluzivně: výroba balistických raket vzrostla o 66 %",
"url":"https://kyivindependent.com/exclusive-russias-ballistic-missile-production-up-at-least-66-over-past-year-according-to-ukrainian-intel-figures/",
"archiv":"http://web.archive.org/web/20261013154143/https://kyivindependent.com/exclusive-russias-ballistic-missile-production-up-at-least-66-over-past-year-according-to-ukrainian-intel-figures/",
"citace":null
}
},
"stav":{
"k":"2026-11-24",
"provoz":"castecne",
"text":"Zasažená dílna č. 22 (galvanovna a lisovna) byla podle satelitních snímků z listopadu 2026 úplně zbourána, zbyla jen srovnaná plocha. Zda úder omezil výrobu raket v celém areálu, není prokázáno – Rusko odpalovalo Iskandery dál i v rekordních počtech.",
"zdroj":{
"nazev":"UNITED24 Media, 24. 11. 2026",
"url":"https://united24media.com/war-in-ukraine/russias-votkinsk-plant-is-missing-an-entire-workshop-after-ukraines-flamingo-missile-strike-24672",
"archiv":null,
"citace":"completely dismantled, leaving a cleared area where the production building previously stood"
}
},
"neuplne":null,
"zasahy":[
{
"d":"2026-02-21",
"prostredek":"rakety",
"co":"V noci z 20. na 21. 2. zasáhly závod ukrajinské střely FP-5 Flamingo (přes 1 300 km od hranice). Generální štáb potvrdil zničení výrobní dílny č. 22; hlava Udmurtska Brečalov přiznal škody a 11 zraněných, cíl nejmenoval.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Independent, 21. 2. 2026",
"url":"https://kyivindependent.com/drone-strikes-russian-ballistic-missile-factory-over-1-300-km-from-ukraines-border/",
"archiv":"http://web.archive.org/web/20260901150251/https://kyivindependent.com/drone-strikes-russian-ballistic-missile-factory-over-1-300-km-from-ukraines-border/",
"citace":"According to operational data, there are damages and casualties."
}
}
]
},
{
"id":"sverdlov_dzerzinsk",
"strana":"RU",
"druh":"zbrojovka",
"nazev":"Závod Ja. M. Sverdlova (výbušniny)",
"vlastnik":"státní podnik (pod sankcemi EU, USA, UK)",
"misto":"Dzeržinsk, Nižněnovgorodská oblast",
"gps":[
56.273,
43.373
],
"vyznam":"Podle ukrajinské rozvědky a Rady EU jediný velký ruský výrobce trhavin RDX (hexogen) a HMX (oktogen) pro dělostřelecké granáty, rakety a letecké pumy.",
"kapacita":{
"hodnota":null,
"jednotka":null,
"popis":"Objem výroby není veřejný; závod je jediným velkým zdrojem RDX a HMX v Rusku.",
"historie":[],
"zdroj":{
"nazev":"The Moscow Times, 7. 10. 2025 (s odkazem na Reuters)",
"url":"https://www.themoscowtimes.com/2025/10/07/ukraine-mounts-second-straight-night-of-mass-drone-strikes-on-russia-a90735",
"archiv":"http://web.archive.org/web/20261101053305/https://www.themoscowtimes.com/2025/10/07/ukraine-mounts-second-straight-night-of-mass-drone-strikes-on-russia-a90735",
"citace":null
}
},
"stav":{
"k":"2026-08-19",
"provoz":"neznamo",
"text":"Závod je opakovaně napadán (naposledy 19. 8. 2026), satelitní snímky po útoku 30. 4. 2026 ukázaly poškození dvou dílen. Ruské úřady nikdy nepřiznaly vážné škody, skutečný vliv na výrobu trhavin není znám.",
"zdroj":{
"nazev":"Ukrajinska pravda, 19. 8. 2026",
"url":"https://www.pravda.com.ua/eng/news/2026/08/19/8049252/",
"archiv":"http://web.archive.org/web/20261116102522/https://www.pravda.com.ua/eng/news/2026/08/19/8049252/",
"citace":null
}
},
"neuplne":"Chybí útok z počátku dubna 2025 (poškozený potrubní most a dvě dílny) a útok na pobočku v Morozovce v dubnu 2026 – nenašel jsem k nim spolehlivý zdroj s datem.",
"zasahy":[
{
"d":"2024-10-20",
"prostredek":"drony",
"co":"Drony SBU, SSO a HUR zaútočily na závod. Gubernátor Nikitin potvrdil útok na průmyslovou zónu Dzeržinsku a 4 lehce zraněné hasiče závodní stanice, cíl nejmenoval.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times, 20. 10. 2024",
"url":"https://www.themoscowtimes.com/2024/10/20/ukraine-drones-target-major-russian-explosive-plant-a86752",
"archiv":"http://web.archive.org/web/20260711024151/https://www.themoscowtimes.com/2024/10/20/ukraine-drones-target-major-russian-explosive-plant-a86752",
"citace":null
}
},
{
"d":"2025-10-06",
"prostredek":"drony",
"co":"Drony zapálily areál závodu, hlášeny výbuchy; gubernátor potvrdil požáry a poškozený majetek, 1 zraněný.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"RBC-Ukrajina, 6. 10. 2025",
"url":"https://newsukraine.rbc.ua/news/drones-hit-explosives-plant-in-russia-s-dzerzhinsk-1759737221.html",
"archiv":"http://web.archive.org/web/20260515080100/https://newsukraine.rbc.ua/news/drones-hit-explosives-plant-in-russia-s-dzerzhinsk-1759737221.html",
"citace":null
}
},
{
"d":"2025-10-07",
"prostredek":"drony",
"co":"Druhá noc za sebou: gubernátor hlásil 30 sestřelených dronů nad průmyslovou zónou, trosky dopadly na areál jednoho podniku bez „významné škody“.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Moscow Times, 7. 10. 2025",
"url":"https://www.themoscowtimes.com/2025/10/07/ukraine-mounts-second-straight-night-of-mass-drone-strikes-on-russia-a90735",
"archiv":"http://web.archive.org/web/20261101053305/https://www.themoscowtimes.com/2025/10/07/ukraine-mounts-second-straight-night-of-mass-drone-strikes-on-russia-a90735",
"citace":"Some debris landed on the premises of one enterprise"
}
},
{
"d":"2026-04-30",
"prostredek":"drony",
"co":"Drony Ljutyj (asi 100 kg výbušniny každý) zasáhly dvě dílny chráněné valy a třemi systémy Pancir; satelitní snímky podle OSINT analytiků potvrdily poškození.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"odhad",
"zdroj":{
"nazev":"UAWire, 6. 5. 2026",
"url":"https://www.uawire.org/satellite-images-confirm-ukrainian-drone-strikes-damage-russia-s-sole-rdx-explosives-plant-in-dzerzhinsk",
"archiv":"http://web.archive.org/web/20260506172959/https://www.uawire.org/satellite-images-confirm-ukrainian-drone-strikes-damage-russia-s-sole-rdx-explosives-plant-in-dzerzhinsk",
"citace":null
}
},
{
"d":"2026-08-19",
"prostredek":"drony",
"co":"Noční útok dronů; velký sloup kouře podle Astry nejspíš z areálu závodu, jeden dron zasáhl obytný dům několik km odtud. Úřady se k zásahu závodu nevyjádřily.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Ukrajinska pravda, 19. 8. 2026",
"url":"https://www.pravda.com.ua/eng/news/2026/08/19/8049252/",
"archiv":"http://web.archive.org/web/20261116102522/https://www.pravda.com.ua/eng/news/2026/08/19/8049252/",
"citace":null
}
}
]
},
{
"id":"engels",
"strana":"RU",
"druh":"letiste",
"nazev":"Letecká základna Engels-2",
"vlastnik":"Ruské letecké a kosmické síly (dálkové letectvo)",
"misto":"Engels, Saratovská oblast",
"gps":[
51.481,
46.211
],
"vyznam":"Hlavní základna ruských strategických bombardérů Tu-95MS a Tu-160, které odpalují střely Ch-101 na Ukrajinu. Leží asi 600 km od fronty.",
"kapacita":{
"hodnota":34,
"jednotka":"letadel",
"popis":"posádka podle údajů z roku 2007: 14 Tu-160 (121. gardový pluk) a 20 Tu-95 (184. pluk); aktuální počty se mění, Rusko letouny po útocích rozptyluje",
"historie":[],
"zdroj":{
"nazev":"Wikipedie – Engels-2",
"url":"https://en.wikipedia.org/wiki/Engels-2",
"archiv":"http://web.archive.org/web/20260103164551/https://en.wikipedia.org/wiki/Engels-2",
"citace":null
}
},
"stav":{
"k":"2026-09-05",
"provoz":"castecne",
"text":"Základna je v provozu, ale v létě 2026 přišla o dva Tu-95MS (podle satelitních snímků nejspíš neopravitelné). Rusko začalo v září 2026 stavět první ze 16 plánovaných krytů pro bombardéry.",
"zdroj":{
"nazev":"Militarnyi, 28. 8. 2026",
"url":"https://militarnyi.com/en/news/satellite-images-damage-tu-95-bomber-engels/",
"archiv":"http://web.archive.org/web/20261017115127/https://militarnyi.com/en/news/satellite-images-damage-tu-95-bomber-engels/",
"citace":"the aircraft is likely beyond repair"
}
},
"neuplne":"Neuvedeny menší a nepotvrzené pokusy (29. 12. 2022, 5. 4. 2024, 11. 2. 2025, 25. 7. 2026) a útoky na samotný ropný sklad Kristall mimo základnu (14. 1. a 7. 6. 2025).",
"zasahy":[
{
"d":"2022-12-05",
"prostredek":"drony",
"co":"První útok na Engels: výbuch poškodil nejméně jeden Tu-95MS, doloženo satelitními snímky. Ruské ministerstvo obrany tvrdilo, že drony sestřelilo v malé výšce.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie – Dyagilevo and Engels air bases attacks",
"url":"https://en.wikipedia.org/wiki/Dyagilevo_and_Engels_air_bases_attacks",
"archiv":"http://web.archive.org/web/20261026220802/https://en.wikipedia.org/wiki/Dyagilevo_and_Engels_air_bases_attacks",
"citace":null
}
},
{
"d":"2022-12-26",
"prostredek":"drony",
"co":"Výbuchy o půlnoci, podle ruských zpráv zahynuli 3 technici. Zničení bombardérů Reuters nepotvrdil.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie – Engels-2",
"url":"https://en.wikipedia.org/wiki/Engels-2",
"archiv":"http://web.archive.org/web/20260103164551/https://en.wikipedia.org/wiki/Engels-2",
"citace":null
}
},
{
"d":"2025-01-08",
"prostredek":"drony",
"co":"Zasažen sklad paliva zásobující základnu, velký požár. Gubernátor Busargin přiznal jen poškození „průmyslového podniku“ troskami.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie – Engels-2",
"url":"https://en.wikipedia.org/wiki/Engels-2",
"archiv":"http://web.archive.org/web/20260103164551/https://en.wikipedia.org/wiki/Engels-2",
"citace":null
}
},
{
"d":"2025-03-20",
"prostredek":"drony",
"co":"Asi 50 dronů mířilo na sklady munice; požár a sekundární výbuchy, satelitní snímky ukázaly několik velkých kráterů. Gubernátor potvrdil poškozené domy, evakuováno ~120 civilistů.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie – Engels-2",
"url":"https://en.wikipedia.org/wiki/Engels-2",
"archiv":"http://web.archive.org/web/20260103164551/https://en.wikipedia.org/wiki/Engels-2",
"citace":null
}
},
{
"d":"2025-11-28",
"prostredek":"drony",
"co":"Ukrajina ohlásila útok dronů na základnu, místní slyšeli výbuchy. Výsledek nepotvrzen.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Wikipedie – Engels-2",
"url":"https://en.wikipedia.org/wiki/Engels-2",
"archiv":"http://web.archive.org/web/20260103164551/https://en.wikipedia.org/wiki/Engels-2",
"citace":null
}
},
{
"d":"2026-07-16",
"prostredek":"drony",
"co":"Drony podobné Šahedům zaútočily na základnu, požár v areálu. Satelitní snímky později ukázaly Tu-95MS se zcela zničenou ocasní částí – bombardér je neopravitelný. Gubernátor přiznal jen útok na Engels.",
"dopad":4,
"obnova":"letoun neopravitelný",
"obnovaDni":null,
"vypadek":"1 Tu-95MS",
"overeni":"over",
"zdroj":{
"nazev":"MigFlug, 2026",
"url":"https://migflug.com/afterburner/engels-2-tu-95-second-bomber-damage-satellite-imagery-2026/",
"archiv":"http://web.archive.org/web/20261011073840/https://migflug.com/afterburner/engels-2-tu-95-second-bomber-damage-satellite-imagery-2026/",
"citace":null
}
},
{
"d":"2026-08-02",
"prostredek":"drony",
"co":"Generální štáb potvrdil zásah základny a následný požár (téže noci rafinerie Saratov). Gubernátor Busargin potvrdil útok na Saratov a Engels a 2 mrtvé.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Rubryka, 2. 8. 2026",
"url":"https://rubryka.com/en/2026/08/02/genshtab-pidtverdyv-urazhennya-aerodromu-engels-ta-shhe-odniyeyi-naftobazy-u-rosiyi/",
"archiv":null,
"citace":null
}
},
{
"d":"2026-08-28",
"prostredek":"drony",
"co":"Jednotka Alfa SBU zasáhla dronem další Tu-95MS; satelitní snímek ukázal utrženou asi třetinu pravého křídla, letoun je podle analytiků nejspíš neopravitelný. Zasaženy také sklady munice a paliva.",
"dopad":4,
"obnova":"letoun nejspíš neopravitelný",
"obnovaDni":null,
"vypadek":"1 Tu-95MS",
"overeni":"over",
"zdroj":{
"nazev":"Militarnyi, 28. 8. 2026",
"url":"https://militarnyi.com/en/news/satellite-images-damage-tu-95-bomber-engels/",
"archiv":"http://web.archive.org/web/20261017115127/https://militarnyi.com/en/news/satellite-images-damage-tu-95-bomber-engels/",
"citace":"the aircraft is likely beyond repair"
}
}
]
},
{
"id":"olenja",
"strana":"RU",
"druh":"letiste",
"nazev":"Letecká základna Olenja",
"vlastnik":"Ruské letecké a kosmické síly (dálkové letectvo)",
"misto":"u Olenegorsku, Murmanská oblast",
"gps":[
68.152,
33.447
],
"vyznam":"Arktická základna strategických bombardérů Tu-95MS a Tu-22M3, odkud startují nálety s křižujícími střelami na Ukrajinu; cíl operace „Pavučina“.",
"kapacita":{
"hodnota":7,
"jednotka":"letadel",
"popis":"stav k 26. 5. 2025 podle AviVector: 2 Tu-95MS, 3 Tu-160, 2 Su-34 (počty se často mění přelety)",
"historie":[],
"zdroj":{
"nazev":"Wikipedie – Operation Spiderweb",
"url":"https://en.wikipedia.org/wiki/Operation_Spiderweb",
"archiv":"http://web.archive.org/web/20261030231236/https://en.wikipedia.org/wiki/Operation_Spiderweb",
"citace":null
}
},
"stav":{
"k":"2026-07-30",
"provoz":"bezi",
"text":"Základna je v plném provozu – 30. 7. 2026 z ní startovalo šest Tu-95MS k náletu na Ukrajinu (den předtím sem Rusko přesunulo osm bombardérů z Dálného východu). Zničené stroje nelze nahradit, Tu-95 se už nevyrábějí.",
"zdroj":{
"nazev":"The Barents Observer, 30. 7. 2026",
"url":"https://www.thebarentsobserver.com/security/bombers-from-kola-peninsulanbspbrought-death-to-ukrainian-towns/454953",
"archiv":"http://web.archive.org/web/20261015210532/https://www.thebarentsobserver.com/security/bombers-from-kola-peninsulanbspbrought-death-to-ukrainian-towns/454953",
"citace":null
}
},
"neuplne":"Menší ukrajinské tvrzení o poškození dvou Tu-22M3 výbuchem 25. 7. 2024 není nezávisle potvrzené, proto chybí.",
"zasahy":[
{
"d":"2025-06-01",
"prostredek":"drony",
"co":"Operace „Pavučina“: malé drony vypuštěné ze střech nákladních aut přímo u základny zapálily letouny. Satelitní snímky potvrdily zničení 4 Tu-95MS a 1 transportního An-12. Ruské ministerstvo obrany přiznalo požáry letadel v Murmanské oblasti.",
"dopad":4,
"obnova":"nenahraditelné – Tu-95 se nevyrábějí",
"obnovaDni":null,
"vypadek":"4 Tu-95MS + 1 An-12",
"overeni":"over",
"zdroj":{
"nazev":"Militarnyi – satelit potvrdil 13 zničených letadel",
"url":"https://militarnyi.com/en/news/operation-spider-s-web-satellite-imagery-confirms-destruction-of-13-aircraft-at-belaya-and-olenya-air-bases/",
"archiv":"http://web.archive.org/web/20260909181925/https://militarnyi.com/en/news/operation-spider-s-web-satellite-imagery-confirms-destruction-of-13-aircraft-at-belaya-and-olenya-air-bases/",
"citace":null
}
}
]
},
{
"id":"belaja",
"strana":"RU",
"druh":"letiste",
"nazev":"Letecká základna Belaja",
"vlastnik":"Ruské letecké a kosmické síly (dálkové letectvo)",
"misto":"u Usolje-Sibirskoje, Irkutská oblast (přes 4 000 km od Ukrajiny)",
"gps":[
52.917,
103.562
],
"vyznam":"Sibiřská základna bombardérů Tu-22M3 a Tu-95MS; při operaci „Pavučina“ nejvzdálenější zasažený cíl.",
"kapacita":{
"hodnota":52,
"jednotka":"strategických letadel",
"popis":"den před útokem podle AviVector: 35 Tu-22M3, 6 Tu-95MS, 7 Tu-160 (+ 30 MiG-31 a 8 pomocných letadel)",
"historie":[],
"zdroj":{
"nazev":"Wikipedie – Operation Spiderweb",
"url":"https://en.wikipedia.org/wiki/Operation_Spiderweb",
"archiv":"http://web.archive.org/web/20261030231236/https://en.wikipedia.org/wiki/Operation_Spiderweb",
"citace":null
}
},
"stav":{
"k":"2026-06-01",
"provoz":"neznamo",
"text":"Základna funguje dál, aktuální počty letadel nejsou známé. Zničené Tu-22M3 a Tu-95MS se nevyrábějí; Financial Times odhadly ztráty celé operace na asi 20 % provozuschopného dálkového letectva.",
"zdroj":{
"nazev":"Wikipedie – Operation Spiderweb",
"url":"https://en.wikipedia.org/wiki/Operation_Spiderweb",
"archiv":"http://web.archive.org/web/20261030231236/https://en.wikipedia.org/wiki/Operation_Spiderweb",
"citace":null
}
},
"neuplne":null,
"zasahy":[
{
"d":"2025-06-01",
"prostredek":"drony",
"co":"Operace „Pavučina“: satelitní snímky (Maxar, SAR) potvrdily zničení 4 Tu-22M3 a 3–4 Tu-95MS, jeden další Tu-95MS poškozen. Ruské ministerstvo obrany přiznalo požáry letadel v Irkutské oblasti.",
"dopad":4,
"obnova":"nenahraditelné – typy se nevyrábějí",
"obnovaDni":null,
"vypadek":"4 Tu-22M3 + 3–4 Tu-95MS",
"overeni":"over",
"zdroj":{
"nazev":"The War Zone – potvrzené ztráty",
"url":"https://www.twz.com/air/firm-evidence-of-russian-aircraft-losses-after-ukrainian-drone-strikes",
"archiv":"http://web.archive.org/web/20261018073340/https://www.twz.com/air/firm-evidence-of-russian-aircraft-losses-after-ukrainian-drone-strikes",
"citace":null
}
}
]
},
{
"id":"saky",
"strana":"RU",
"druh":"letiste",
"nazev":"Letecká základna Saky",
"vlastnik":"námořní letectvo Černomořské flotily",
"misto":"Novofjodorivka u Saků, okupovaný Krym",
"gps":[
45.093,
33.595
],
"vyznam":"Základna 43. samostatného námořního bitevního leteckého pluku (Su-24M, Su-30SM) na Krymu.",
"kapacita":{
"hodnota":null,
"jednotka":null,
"popis":"43. pluk námořního letectva se Su-24M/MR, Su-30SM a Tu-134; přesný počet letadel neznámý",
"historie":[],
"zdroj":{
"nazev":"Wikipedie – Saky (air base)",
"url":"https://en.wikipedia.org/wiki/Saky_(air_base)",
"archiv":"http://web.archive.org/web/20260714134943/https://en.wikipedia.org/wiki/Saky_(air_base)",
"citace":null
}
},
"stav":{
"k":"2026-08-22",
"provoz":"castecne",
"text":"V létě 2026 SBU opakovaně zasáhla hangáry; prezident Zelenskyj 22. 8. 2026 uvedl jako potvrzený výsledek zničení Su-24M a čtyř kusů letištní techniky. Nezávislé satelitní potvrzení ztrát z roku 2026 chybí.",
"zdroj":{
"nazev":"Kyiv Post, 22. 8. 2026",
"url":"https://www.kyivpost.com/post/82893",
"archiv":"http://web.archive.org/web/20260919011106/https://www.kyivpost.com/post/82893",
"citace":null
}
},
"neuplne":"Útoky z let 2023–2025 (21. 9. 2023, Storm Shadow na velitelské stanoviště 6. 1. 2024) a menší výbuchy 12. 6. 2026 jsou jen stručně doložené; v seznamu jsou jen hlavní.",
"zasahy":[
{
"d":"2022-08-09",
"prostredek":"jiné",
"co":"Sérii výbuchů na základně (Ukrajina později přiznala útok) zachytily satelitní snímky: nejméně 7–8 letadel zničeno nebo poškozeno. Podle západního činitele bylo z provozu vyřazeno přes polovinu bojových letounů námořního letectva Černomořské flotily.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":"≥ 7 letadel zničeno",
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie – 2022 Saky air base attack",
"url":"https://en.wikipedia.org/wiki/2022_Saky_air_base_attack",
"archiv":"http://web.archive.org/web/20261010140445/https://en.wikipedia.org/wiki/2022_Saky_air_base_attack",
"citace":null
}
},
{
"d":"2026-06-24",
"prostredek":"drony",
"co":"Jednotka Alfa SBU podle předběžných údajů zasáhla čtyři hangáry s letadly.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Censor.net, 24. 6. 2026",
"url":"https://censor.net/en/news/4009947/strike-on-crimea-on-24-june-saky-airfield-hit",
"archiv":null,
"citace":"four hangars used to store aircraft were hit"
}
},
{
"d":"2026-07-01",
"prostredek":"drony",
"co":"Drony SBU zasáhly hangáry se Su-30 a Su-30SM (pět zásahů); monitorovací skupina Krymský vítr podle satelitu hlásila velký požár u letiště.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Kyiv Post, 3. 7. 2026",
"url":"https://www.kyivpost.com/post/79512",
"archiv":"http://web.archive.org/web/20260719040133/https://www.kyivpost.com/post/79512",
"citace":null
}
},
{
"d":"2026-07-03",
"prostredek":"drony",
"co":"Druhý útok za týden: SBU hlásí zásah sedmi hangárů se Su-30SM, Su-30 a Su-24 a podle předběžných údajů nejméně 7 zničených či poškozených letadel. Rusko se nevyjádřilo.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Kyiv Post, 3. 7. 2026",
"url":"https://www.kyivpost.com/post/79512",
"archiv":"http://web.archive.org/web/20260719040133/https://www.kyivpost.com/post/79512",
"citace":"Russia has not publicly commented on the attack."
}
}
]
},
{
"id":"belbek",
"strana":"RU",
"druh":"letiste",
"nazev":"Letecká základna Belbek",
"vlastnik":"Ruské letecké a kosmické síly",
"misto":"u Sevastopolu, okupovaný Krym",
"gps":[
44.687,
33.567
],
"vyznam":"Hlavní stíhací základna na Krymu (MiG-31, Su-27, Su-30), chrání poloostrov a Krymský most.",
"kapacita":{
"hodnota":null,
"jednotka":null,
"popis":"před útokem 5/2024 stálo na ploše několik Su-27 a MiG-31 (Planet Labs); přesný počet neznámý",
"historie":[],
"zdroj":{
"nazev":"Kyiv Independent, 17. 5. 2024",
"url":"https://kyivindependent.com/belbek-airfield-strike-destroyed-three-russian-planes-satellite-images-suggest/",
"archiv":"http://web.archive.org/web/20260512085451/https://kyivindependent.com/belbek-airfield-strike-destroyed-three-russian-planes-satellite-images-suggest/",
"citace":null
}
},
"stav":{
"k":"2025-12-21",
"provoz":"castecne",
"text":"Základna funguje, ale Ukrajina systematicky ničí její radary a protivzdušnou obranu; v prosinci 2025 SBU hlásila zásahy MiG-31 a dvou Su-27. Novější potvrzené zprávy z roku 2026 jsem nenašel.",
"zdroj":{
"nazev":"Euromaidan Press, 21. 12. 2025",
"url":"https://euromaidanpress.com/2025/12/21/belbek-strikes/",
"archiv":"http://web.archive.org/web/20251228044500/https://euromaidanpress.com/2025/12/21/belbek-strikes/",
"citace":null
}
},
"neuplne":"Starší útoky (2023) a případné útoky v roce 2026 nejsou zahrnuty.",
"zasahy":[
{
"d":"2024-05-15",
"prostredek":"rakety",
"co":"Dvě noci po sobě (15. a 16. 5.) střely ATACMS. Satelitní snímky Maxar ukázaly 2 zničené MiG-31 a 1 Su-27, poškozený MiG-29 (podle pozdějšího rozboru možná maketa) a vyhořelý sklad paliva.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"2 MiG-31 + 1 Su-27 zničeny",
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Independent, 17. 5. 2024",
"url":"https://kyivindependent.com/belbek-airfield-strike-destroyed-three-russian-planes-satellite-images-suggest/",
"archiv":"http://web.archive.org/web/20260512085451/https://kyivindependent.com/belbek-airfield-strike-destroyed-three-russian-planes-satellite-images-suggest/",
"citace":null
}
},
{
"d":"2025-12-18",
"prostredek":"drony",
"co":"Drony SBU podle jejích záběrů zasáhly dva radary Nebo-SVU, radar 92N6 systému S-400, Pancir-S2 a MiG-31 s plnou výzbrojí.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Euromaidan Press, 21. 12. 2025",
"url":"https://euromaidanpress.com/2025/12/21/belbek-strikes/",
"archiv":"http://web.archive.org/web/20251228044500/https://euromaidanpress.com/2025/12/21/belbek-strikes/",
"citace":null
}
},
{
"d":"2025-12-20",
"prostredek":"drony",
"co":"Drony jednotky Alfa SBU zasáhly dva Su-27, z nichž nejméně jeden (připravený ke startu) byl podle SBU zničen.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"UNN, 12/2025",
"url":"https://unn.ua/en/news/sbu-long-range-drones-destroyed-two-russian-su-27s-at-belbek-airfield-in-crimea",
"archiv":"http://web.archive.org/web/20260426142306/https://unn.ua/en/news/sbu-long-range-drones-destroyed-two-russian-su-27s-at-belbek-airfield-in-crimea",
"citace":null
}
}
]
},
{
"id":"marinovka",
"strana":"RU",
"druh":"letiste",
"nazev":"Letecká základna Marinovka",
"vlastnik":"Ruské letecké a kosmické síly",
"misto":"Marinovka, Volgogradská oblast",
"gps":[
48.636,
43.788
],
"vyznam":"Základna 11. smíšeného leteckého pluku; stíhací bombardéry Su-34 odtud shazují kluzáky pumy na ukrajinská města na frontě.",
"kapacita":{
"hodnota":29,
"jednotka":"letadel",
"popis":"satelitní snímek z 19. 8. 2024: asi 15 Su-34 a 14 Su-24",
"historie":[],
"zdroj":{
"nazev":"Wikipedie – Marinovka air base",
"url":"https://en.wikipedia.org/wiki/Marinovka_air_base",
"archiv":"http://web.archive.org/web/20260829045454/https://en.wikipedia.org/wiki/Marinovka_air_base",
"citace":null
}
},
"stav":{
"k":"2026-10-30",
"provoz":"castecne",
"text":"Základna funguje, ale letadla dál parkují venku bez krytů; od června 2025 satelity doložily zničení nejméně 4 Su-34 a poškození 2 dalších.",
"zdroj":{
"nazev":"Ukrajinska pravda, 30. 10. 2026",
"url":"https://www.pravda.com.ua/eng/news/2026/10/30/8060549/",
"archiv":"http://web.archive.org/web/20261101211839/https://www.pravda.com.ua/eng/news/2026/10/30/8060549/",
"citace":null
}
},
"neuplne":null,
"zasahy":[
{
"d":"2024-08-22",
"prostredek":"drony",
"co":"Útok dronů, výbuchy a požár; gubernátor Bočarov tvrdil, že většinu dronů sestřelili a požár způsobily trosky. Ztráty letadel nepotvrzeny.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie – Marinovka air base",
"url":"https://en.wikipedia.org/wiki/Marinovka_air_base",
"archiv":"http://web.archive.org/web/20260829045454/https://en.wikipedia.org/wiki/Marinovka_air_base",
"citace":null
}
},
{
"d":"2025-06-27",
"prostredek":"drony",
"co":"Společná operace SBU a SSO; satelitní snímky z 29. 6. ukázaly 2 zcela zničené a 2 vážně poškozené Su-34. Proruský kanál Fighterbomber ztráty nepřímo přiznal.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"2 Su-34 zničeny, 2 poškozeny",
"overeni":"over",
"zdroj":{
"nazev":"The Insider, 30. 6. 2025",
"url":"https://theins.press/en/news/282632",
"archiv":"http://web.archive.org/web/20260715111348/https://theins.press/en/news/282632",
"citace":"There's no point in commenting on Marinovka."
}
},
{
"d":"2026-10-29",
"prostredek":"rakety",
"co":"Ukrajinské námořnictvo zasáhlo stanoviště střelami Dlouhý Neptun; satelitní snímek AviVector z 30. 10. ukázal trosky 2 Su-34 u hangárů. Rusko ztráty nepřiznalo.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"2 Su-34 zničeny",
"overeni":"over",
"zdroj":{
"nazev":"Ukrajinska pravda, 30. 10. 2026",
"url":"https://www.pravda.com.ua/eng/news/2026/10/30/8060549/",
"archiv":"http://web.archive.org/web/20261101211839/https://www.pravda.com.ua/eng/news/2026/10/30/8060549/",
"citace":null
}
}
]
},
{
"id":"borisoglebsk",
"strana":"RU",
"druh":"letiste",
"nazev":"Letecká základna Borisoglebsk",
"vlastnik":"Ruské letecké a kosmické síly",
"misto":"u Borisoglebsku, Voroněžská oblast",
"gps":[
51.368,
42.176
],
"vyznam":"Základna Su-34 a Su-35 asi 260 km od ukrajinské hranice, sklad kluzákových pum.",
"kapacita":{
"hodnota":null,
"jednotka":null,
"popis":"počet letadel neznámý; den před útokem 10/2026 stálo na otevřené ploše 6 Su-34",
"historie":[],
"zdroj":{
"nazev":"Militarnyi, 10/2026",
"url":"https://militarnyi.com/en/news/four-su-34s-destroyed-borisoglebsk-air-base/",
"archiv":"http://web.archive.org/web/20261028025957/https://militarnyi.com/en/news/four-su-34s-destroyed-borisoglebsk-air-base/",
"citace":null
}
},
"stav":{
"k":"2026-10-17",
"provoz":"castecne",
"text":"Po zásahu 15. 10. 2026 (nejhorší den ruského letectva od „Pavučiny“) základna funguje dál; ruští vojenští blogeři si stěžují, že tu stále nejsou zesílené kryty.",
"zdroj":{
"nazev":"The Moscow Times, 15. 10. 2026",
"url":"https://www.themoscowtimes.com/2026/10/15/ukraine-says-missile-strike-destroyed-6-russian-warplanes-at-voronezh-airfield-a93991",
"archiv":"http://web.archive.org/web/20261019045810/https://www.themoscowtimes.com/2026/10/15/ukraine-says-missile-strike-destroyed-6-russian-warplanes-at-voronezh-airfield-a93991",
"citace":null
}
},
"neuplne":"Útok z července 2025 se nepodařilo blíže doložit.",
"zasahy":[
{
"d":"2024-10-03",
"prostredek":"drony",
"co":"Ukrajinské drony zaútočily na Su-34, Su-35, nádrže s palivem a sklad kluzákových pum; rozsah škod nepotvrzen.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Wikipedie – Borisoglebsk air base",
"url":"https://en.wikipedia.org/wiki/Borisoglebsk_air_base",
"archiv":"http://web.archive.org/web/20261015122207/https://en.wikipedia.org/wiki/Borisoglebsk_air_base",
"citace":null
}
},
{
"d":"2026-10-15",
"prostredek":"rakety",
"co":"Střely Dlouhý Neptun dopadly na stojánku, kde stálo 6 Su-34 téměř křídlo na křídle. Satelitní snímky AviVector: 4 Su-34 zničeny, 2 vážně poškozeny (námořnictvo tvrdí 6 zničených). Gubernátor Gusev zásah letiště nepřiznal.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":"4 Su-34 zničeny, 2 poškozeny",
"overeni":"over",
"zdroj":{
"nazev":"Militarnyi, 10/2026",
"url":"https://militarnyi.com/en/news/four-su-34s-destroyed-borisoglebsk-air-base/",
"archiv":"http://web.archive.org/web/20261028025957/https://militarnyi.com/en/news/four-su-34s-destroyed-borisoglebsk-air-base/",
"citace":null
}
}
]
},
{
"id":"toropec",
"strana":"RU",
"druh":"sklad",
"nazev":"107. arzenál GRAU Toropec",
"vlastnik":"Ministerstvo obrany RF (Hlavní raketově-dělostřelecká správa GRAU)",
"misto":"Toropec, Tverská oblast",
"gps":[
56.5,
31.721
],
"vyznam":"Možná největší muniční sklad evropského Ruska: rakety Iskander a Točka-U, střely S-300, kluzáky pumy i severokorejské rakety KN-23. Zničení bylo podle odhadů nejničivějším úderem války na sklad munice.",
"kapacita":{
"hodnota":30000,
"jednotka":"t munice",
"popis":"odhad estonské vojenské rozvědky, kolik munice při útoku vybuchlo (≈ 750 000 granátů); jižní komplex měl 42 bunkrů po až 240 t",
"historie":[],
"zdroj":{
"nazev":"Wikipedie – Toropets depot explosions",
"url":"https://en.wikipedia.org/wiki/Toropets_depot_explosions",
"archiv":"http://web.archive.org/web/20260904183417/https://en.wikipedia.org/wiki/Toropets_depot_explosions",
"citace":null
}
},
"stav":{
"k":"2024-09-22",
"provoz":"zniceno",
"text":"Podle satelitních snímků zničeno asi 70 % arzenálu, výbuch zanechal kráter široký 82 m. Estonská rozvědka odhadla, že Rusko přišlo o 2–3 měsíce zásob munice. Zprávy o obnově z let 2025–2026 jsem nenašel.",
"zdroj":{
"nazev":"Militarnyi – arzenál v Toropci zničen ze 70 %",
"url":"https://militarnyi.com/en/news/russian-arsenal-in-toropets-destroyed-by-70-per-cent/",
"archiv":"http://web.archive.org/web/20261014123325/https://militarnyi.com/en/news/russian-arsenal-in-toropets-destroyed-by-70-per-cent/",
"citace":null
}
},
"neuplne":null,
"zasahy":[
{
"d":"2024-09-18",
"prostredek":"drony",
"co":"Drony SBU, HUR a SSO způsobily obří výbuch (seismicky 2,5–2,8), požáry na 13 km². Snímky Maxar: většina skladových budov zničena, z 38 kontrolovaných bunkrů 12 zničeno a 7 vážně poškozeno. Gubernátor Ruděnja přiznal požár od „trosek dronu“ a částečnou evakuaci.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":"≈ 30 000 t munice",
"overeni":"over",
"zdroj":{
"nazev":"The War Zone – satelitní snímky skladů",
"url":"https://www.twz.com/news-features/satellite-images-show-massive-devastation-at-russian-ammo-storage-sites-struck-by-ukrainian-drones",
"archiv":"http://web.archive.org/web/20261014085351/https://www.twz.com/news-features/satellite-images-show-massive-devastation-at-russian-ammo-storage-sites-struck-by-ukrainian-drones",
"citace":null
}
},
{
"d":"2024-09-22",
"prostredek":"drony",
"co":"Drony zasáhly druhý muniční sklad jižně od Toropce, velký požár.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Wikipedie – Toropets depot explosions",
"url":"https://en.wikipedia.org/wiki/Toropets_depot_explosions",
"archiv":"http://web.archive.org/web/20260904183417/https://en.wikipedia.org/wiki/Toropets_depot_explosions",
"citace":null
}
}
]
},
{
"id":"tichoreck_arzenal",
"strana":"RU",
"druh":"sklad",
"nazev":"Arzenál GRAU Tichoreck (Kamennyj)",
"vlastnik":"Ministerstvo obrany RF (GRAU)",
"misto":"Kamennyj u Tichorecku, Krasnodarský kraj",
"gps":[
45.865,
40.034
],
"vyznam":"Podle ukrajinské armády jeden ze tří největších muničních skladů Ruska a klíčový uzel zásobování jižní fronty.",
"kapacita":{
"hodnota":2000,
"jednotka":"t munice",
"popis":"odhad ukrajinských činitelů, kolik munice bylo ve skladu (včetně severokorejské); méně spolehlivý údaj",
"historie":[],
"zdroj":{
"nazev":"RTÉ / AFP, 21. 9. 2024",
"url":"https://www.rte.ie/news/world/2024/0921/1471252-ukraine-russia/",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2024-09-25",
"provoz":"neznamo",
"text":"Satelitní snímky po útoku ukázaly rozsáhlé zničení skladu. Novější zprávy o jeho obnově jsem nenašel.",
"zdroj":{
"nazev":"The War Zone – satelitní snímky skladů",
"url":"https://www.twz.com/news-features/satellite-images-show-massive-devastation-at-russian-ammo-storage-sites-struck-by-ukrainian-drones",
"archiv":"http://web.archive.org/web/20261014085351/https://www.twz.com/news-features/satellite-images-show-massive-devastation-at-russian-ammo-storage-sites-struck-by-ukrainian-drones",
"citace":null
}
},
"neuplne":null,
"zasahy":[
{
"d":"2024-09-21",
"prostredek":"drony",
"co":"Tři dny po Toropci: požár od dronů se rozšířil na výbušniny a spustil detonace (zachytily je satelity NASA i seismografy). Gubernátor Kondratěv evakuoval 1 200 lidí a vyhlásil mimořádnou situaci.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"RTÉ / AFP, 21. 9. 2024",
"url":"https://www.rte.ie/news/world/2024/0921/1471252-ukraine-russia/",
"archiv":"http://web.archive.org/web/20240921193832/https://www.rte.ie/news/world/2024/0921/1471252-ukraine-russia/",
"citace":"spread to explosive objects"
}
}
]
},
{
"id":"kotluban",
"strana":"RU",
"druh":"sklad",
"nazev":"Arzenál GRAU Kotluban",
"vlastnik":"Ministerstvo obrany RF (GRAU)",
"misto":"Kotluban, Volgogradská oblast",
"gps":[
48.997,
44.214
],
"vyznam":"Jeden z největších ruských skladů raket, munice a výbušnin; podle ukrajinské strany tu byly i íránské balistické rakety.",
"kapacita":{
"hodnota":null,
"jednotka":null,
"popis":"objem uskladněné munice není veřejně znám",
"historie":[],
"zdroj":{
"nazev":"Interfax-Ukrajina, 12. 2. 2026",
"url":"https://en.interfax.com.ua/news/general/1144041.html",
"archiv":"http://web.archive.org/web/20260809203922/https://en.interfax.com.ua/news/general/1144041.html",
"citace":null
}
},
"stav":{
"k":"2026-02-13",
"provoz":"castecne",
"text":"Po zásahu střelami Flamingo v únoru 2026 satelitní snímky nízkého rozlišení ukázaly rozsáhlé škody, nejméně jeden bunkr o ploše asi 1 200 m² zcela zmizel. Celkový rozsah zničení není znám.",
"zdroj":{
"nazev":"TVP World, 2/2026",
"url":"https://tvpworld.com/91738891/ukraines-new-satellite-images-show-major-damage-at-russian-ammo-depot-after-fp-5-flamingo-strike",
"archiv":"http://web.archive.org/web/20260809103644/https://tvpworld.com/91738891/ukraines-new-satellite-images-show-major-damage-at-russian-ammo-depot-after-fp-5-flamingo-strike",
"citace":null
}
},
"neuplne":null,
"zasahy":[
{
"d":"2024-09-29",
"prostredek":"drony",
"co":"Útok dronů na sklad; místní úřady tvrdily, že drony sestřelily a nic vojenského nebylo poškozeno. Satelit později škody neukázal.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Obozrevatel, 29. 9. 2024",
"url":"https://eng.obozrevatel.com/section-war/news-ammunition-depot-used-for-iranian-balistic-missiles-attacked-in-russia-head-of-center-for-countering-disinformation-29-09-2024.html",
"archiv":"http://web.archive.org/web/20241007151537/https://eng.obozrevatel.com/section-war/news-ammunition-depot-used-for-iranian-balistic-missiles-attacked-in-russia-head-of-center-for-countering-disinformation-29-09-2024.html",
"citace":null
}
},
{
"d":"2026-02-12",
"prostredek":"rakety",
"co":"Šest střel FP-5 Flamingo (asi 4,5 t výbušniny) zasáhlo arzenál, následovaly sekundární detonace. Gubernátor Bočarov přiznal požár „vojenského objektu“ u Kotlubaně a nařídil evakuaci obyvatel; satelit ukázal zničený velký bunkr.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"TVP World, 2/2026",
"url":"https://tvpworld.com/91738891/ukraines-new-satellite-images-show-major-damage-at-russian-ammo-depot-after-fp-5-flamingo-strike",
"archiv":"http://web.archive.org/web/20260809103644/https://tvpworld.com/91738891/ukraines-new-satellite-images-show-major-damage-at-russian-ammo-depot-after-fp-5-flamingo-strike",
"citace":null
}
}
]
},
{
"id":"krymsky_most",
"strana":"RU",
"druh":"most",
"nazev":"Krymský (Kerčský) most",
"vlastnik":"Ruská federace (Rosavtodor / Ruské železnice)",
"misto":"Kerčský průliv mezi Tamaňským poloostrovem a Kerčí",
"gps":[
45.309,
36.506
],
"vyznam":"Jediné pevné spojení okupovaného Krymu s Ruskem (silnice a železnice, 19 km). Slouží k zásobování vojsk na Krymu a jižní frontě i jako symbol anexe.",
"kapacita":{
"hodnota":15000,
"jednotka":"aut/den",
"popis":"průměrný silniční provoz; most má 4 jízdní pruhy a 2 železniční koleje (rekord 36 393 aut za den v srpnu 2020)",
"historie":[],
"zdroj":{
"nazev":"Wikipedie – Crimean Bridge",
"url":"https://en.wikipedia.org/wiki/Crimean_Bridge",
"archiv":"http://web.archive.org/web/20261117011418/https://en.wikipedia.org/wiki/Crimean_Bridge",
"citace":null
}
},
"stav":{
"k":"2026-11-25",
"provoz":"castecne",
"text":"Silniční most je od 17. 11. 2026 nesjízdný – zřítil se oblouk hlavního pole i s vozovkou. Vlaky jezdí jen po jedné ze dvou kolejí, na druhé se opravuje. Ruské ministerstvo dopravy 24. 11. změnilo ilustraci mostu – zobrazuje už jen železniční část. Termín opravy nebyl oznámen; ukrajinské námořnictvo soudí, že ruské firmy na opravu nemají kapacity.",
"zdroj":{
"nazev":"Wikipedie – 2026 Crimean Bridge explosions",
"url":"https://en.wikipedia.org/wiki/2026_Crimean_Bridge_explosions",
"archiv":null,
"citace":null
}
},
"neuplne":"Neuveden pokus o zásah střelami S-200 12. 8. 2023 (podle Ruska sestřeleny, bez škod) a dílčí fáze týdnů trvající operace před 16. 11. 2026.",
"zasahy":[
{
"d":"2022-10-08",
"prostredek":"sabotáž",
"co":"Výbuch nákladního auta s trhavinou (SBU to přiznala v roce 2023): dvě pole silničního mostu se zřítila do moře, na železnici shořelo 7 cisteren vlaku. 5 mrtvých.",
"dopad":4,
"obnova":"silnice plně 23. 2. 2023, železnice 5. 5. 2023",
"obnovaDni":209,
"vypadek":"omezený provoz na měsíce",
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie – 2022 Crimean Bridge explosion",
"url":"https://en.wikipedia.org/wiki/2022_Crimean_Bridge_explosion",
"archiv":"http://web.archive.org/web/20261118011520/https://en.wikipedia.org/wiki/2022_Crimean_Bridge_explosion",
"citace":null
}
},
{
"d":"2023-07-17",
"prostredek":"námořní drony",
"co":"Dva námořní drony Sea Baby (SBU a námořnictvo) poškodily silniční část – nejméně jedno pole se propadlo. Zahynuli 2 lidé v autě.",
"dopad":3,
"obnova":"plně obnoveno 14. 10. 2023",
"obnovaDni":89,
"vypadek":"silnice jen v 1 pruhu",
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie – 2023 Crimean Bridge explosion",
"url":"https://en.wikipedia.org/wiki/2023_Crimean_Bridge_explosion",
"archiv":"http://web.archive.org/web/20261117200318/https://en.wikipedia.org/wiki/2023_Crimean_Bridge_explosion",
"citace":null
}
},
{
"d":"2025-06-03",
"prostredek":"sabotáž",
"co":"SBU odpálila pod vodou nálože (podle ní ekvivalent 1 100 kg TNT) u podpěr mostu, které tam kladla měsíce. Most byl zavřen na několik hodin; vážné poškození nebylo nezávisle potvrzeno.",
"dopad":1,
"obnova":"několik hodin",
"obnovaDni":0,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Wikipedie – 2025 Crimean Bridge explosion",
"url":"https://en.wikipedia.org/wiki/2025_Crimean_Bridge_explosion",
"archiv":"http://web.archive.org/web/20261019213639/https://en.wikipedia.org/wiki/2025_Crimean_Bridge_explosion",
"citace":null
}
},
{
"d":"2026-11-16",
"prostredek":"drony",
"co":"Drony zasáhly most, oblouk silniční části se podle OSINT naklonil až o 15°. Rusko most dočasně uzavřelo, večer silnice jela střídavě jedním směrem.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie – 2026 Crimean Bridge explosions",
"url":"https://en.wikipedia.org/wiki/2026_Crimean_Bridge_explosions",
"archiv":null,
"citace":null
}
},
{
"d":"2026-11-17",
"prostredek":"drony a rakety",
"co":"Kombinovaný úder: raketodrony Paljanycja na silniční most, střely Neptun, Ruta a Flamingo na železniční. Oblouk silničního mostu se zřítil i s hlavním polem; ruské ministerstvo dopravy zastavilo vlaky i auta.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":"silniční provoz zcela přerušen",
"overeni":"over",
"zdroj":{
"nazev":"Al Jazeera, 18. 11. 2026",
"url":"https://www.aljazeera.com/news/2026/11/18/crimea-is-turning-into-an-island-how-ukraine-hit-putins-prized-bridge",
"archiv":null,
"citace":"The roadway is out of action: no vehicle can cross it."
}
},
{
"d":"2026-11-19",
"prostredek":"drony",
"co":"Další útok na železniční most krátce zastavil provoz; Aksjonov oznámil posuzování škod.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":"vlaky jen po 1 koleji",
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie – 2026 Crimean Bridge explosions",
"url":"https://en.wikipedia.org/wiki/2026_Crimean_Bridge_explosions",
"archiv":null,
"citace":null
}
}
]
},
{
"id":"nevinnomyssk_azot",
"strana":"RU",
"druh":"chemie",
"nazev":"Chemický závod Nevinnomysskij Azot",
"vlastnik":"EuroChem",
"misto":"Nevinnomyssk, Stavropolský kraj",
"gps":[
44.658,
41.949
],
"vyznam":"Největší výrobce dusíkatých hnojiv a čpavku na jihu Ruska; dodává kyselinu dusičnou a octovou zbrojovce Sverdlov, která z nich vyrábí trhaviny.",
"kapacita":{
"hodnota":1.0,
"jednotka":"mil. t čpavku/rok",
"popis":"přes 1 mil. t čpavku a 1,4 mil. t dusičnanu amonného ročně",
"historie":[],
"zdroj":{
"nazev":"Militarnyi, 17. 6. 2025",
"url":"https://militarnyi.com/en/news/one-of-russia-s-largest-chemical-plants-shuts-down-after-a-uav-attack/",
"archiv":"http://web.archive.org/web/20260206220220/https://militarnyi.com/en/news/one-of-russia-s-largest-chemical-plants-shuts-down-after-a-uav-attack/",
"citace":null
}
},
"stav":{
"k":"2026-11-26",
"provoz":"neznamo",
"text":"Závod byl napaden nejméně sedmkrát; v noci na 26. 11. 2026 drony zasáhly průmyslovou zónu Nevinnomysska (hlavně sousední elektrárnu GRES 1 551 MW). Gubernátor přiznal škody na „průmyslových a energetických objektech“, které nejmenoval.",
"zdroj":{
"nazev":"Kyiv Post, 26. 11. 2026",
"url":"https://www.kyivpost.com/post/91235",
"archiv":null,
"citace":null
}
},
"neuplne":"Kyiv Post zmiňuje další útoky v lednu a březnu 2026 a 20. 5. (rok nejistý), jejichž přesná data a výsledky jsem nedohledal.",
"zasahy":[
{
"d":"2025-06-14",
"prostredek":"drony",
"co":"Útok 13 dronů poškodil část dílny, střechu jídelny a protidronovou ochranu, vypukl požár, 800 zaměstnanců se ukrylo. Provoz závodu byl dočasně zastaven (podle Astry).",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"odhad",
"zdroj":{
"nazev":"Militarnyi, 17. 6. 2025",
"url":"https://militarnyi.com/en/news/one-of-russia-s-largest-chemical-plants-shuts-down-after-a-uav-attack/",
"archiv":"http://web.archive.org/web/20260206220220/https://militarnyi.com/en/news/one-of-russia-s-largest-chemical-plants-shuts-down-after-a-uav-attack/",
"citace":"temporarily halted following a Ukrainian UAV attack on June 14"
}
},
{
"d":"2025-07-25",
"prostredek":"drony",
"co":"Druhý útok dronů na závod v roce 2025.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Kyiv Post, 4. 12. 2025",
"url":"https://www.kyivpost.com/post/65560",
"archiv":"http://web.archive.org/web/20260516095256/https://www.kyivpost.com/post/65560",
"citace":null
}
},
{
"d":"2025-12-04",
"prostredek":"drony",
"co":"Třetí útok v roce; gubernátor Vladimirov potvrdil útok dronů na „objekty“ v Nevinnomyssku, škody popřel.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Post, 4. 12. 2025",
"url":"https://www.kyivpost.com/post/65560",
"archiv":"http://web.archive.org/web/20260516095256/https://www.kyivpost.com/post/65560",
"citace":"there are no casualties or damage"
}
},
{
"d":"2026-05-16",
"prostredek":"drony",
"co":"Velký průmyslový požár; geolokovaná videa (Astra) umístila ohnisko přímo do areálu závodu, přestože gubernátor tvrdil, že škody nejsou.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Post, 16. 5. 2026",
"url":"https://www.kyivpost.com/post/76258",
"archiv":"http://web.archive.org/web/20260602160550/https://www.kyivpost.com/post/76258",
"citace":null
}
},
{
"d":"2026-11-26",
"prostredek":"drony",
"co":"Masivní útok na průmyslovou zónu; obyvatelé hlásili výbuchy u závodu Azot i u elektrárny. Hlavním cílem byla podle OSINT elektrárna; zásah Azotu nepotvrzen.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Kyiv Post, 26. 11. 2026",
"url":"https://www.kyivpost.com/post/91235",
"archiv":null,
"citace":null
}
}
]
},
{
"id":"novomoskovsk_azot",
"strana":"RU",
"druh":"chemie",
"nazev":"Chemický závod Novomoskovskij Azot (NAK Azot)",
"vlastnik":"EuroChem",
"misto":"Novomoskovsk, Tulská oblast",
"gps":[
54.089,
38.201
],
"vyznam":"Jeden z největších ruských výrobců čpavku, dusičnanu amonného a kyseliny dusičné; podle ukrajinské rozvědky dodal téměř 5 000 t kyseliny dusičné zbrojovce Sverdlov na výrobu trhavin.",
"kapacita":{
"hodnota":1.72,
"jednotka":"mil. t dusičnanu amonného/rok",
"popis":"jmenovitá kapacita podle Platts: 1,72 mil. t dusičnanu amonného a 1,67 mil. t močoviny ročně (údaj Platts o 5,2 mil. t čpavku je zřejmě chybný)",
"historie":[],
"zdroj":{
"nazev":"Chemical Week / Platts, 6/2025",
"url":"https://chemweek.mydigitalpublication.com/articles/eurochem-s-azot-plant-in-russia-shut-down-after-drone-strike",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2026-10-28",
"provoz":"neznamo",
"text":"Po útoku 28. 10. 2026 záběry naznačily zásah jednotky na výrobu čpavku AM-70. Gubernátor Miljajev potvrdil škody v průmyslové zóně a poslal laboratoře kontrolovat ovzduší, závod nejmenoval. Doba odstávky není známa.",
"zdroj":{
"nazev":"UNITED24 Media, 28. 10. 2026",
"url":"https://united24media.com/war-in-ukraine/drones-set-fire-to-one-of-russias-largest-chemical-plants-linked-to-military-explosives-23862",
"archiv":"http://web.archive.org/web/20261028150358/https://united24media.com/war-in-ukraine/drones-set-fire-to-one-of-russias-largest-chemical-plants-linked-to-military-explosives-23862",
"citace":null
}
},
"neuplne":null,
"zasahy":[
{
"d":"2025-05-24",
"prostredek":"drony",
"co":"Noční útok dronů, požár v závodě.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Kyiv Independent (Yahoo), 7. 6. 2025",
"url":"https://www.yahoo.com/news/chemical-plant-russias-tula-oblast-231410905.html",
"archiv":"http://web.archive.org/web/20251231214448/https://www.yahoo.com/news/chemical-plant-russias-tula-oblast-231410905.html",
"citace":null
}
},
{
"d":"2025-06-08",
"prostredek":"drony",
"co":"Druhý zásah: gubernátor Miljajev potvrdil požár v závodě Azot (uhašen) a 2 zraněné. Podle Chemical Week byl závod po útoku odstaven.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Independent (Yahoo), 7. 6. 2025",
"url":"https://www.yahoo.com/news/chemical-plant-russias-tula-oblast-231410905.html",
"archiv":"http://web.archive.org/web/20251231214448/https://www.yahoo.com/news/chemical-plant-russias-tula-oblast-231410905.html",
"citace":"two people were injured, but their lives are not in danger"
}
},
{
"d":"2026-05-26",
"prostredek":"drony",
"co":"Ukrajinské drony zasáhly závod Azot.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Militarnyi, 14. 6. 2026",
"url":"https://militarnyi.com/en/news/drone-strike-sparks-fire-at-azot-chemical-plant-in-novomoskovsk/",
"archiv":null,
"citace":null
}
},
{
"d":"2026-06-14",
"prostredek":"drony",
"co":"Velký požár v areálu; gubernátor potvrdil požár „průmyslového objektu“ v Novomoskovsku, NASA FIRMS zachytila tepelnou anomálii přímo v závodě Azot.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Militarnyi, 14. 6. 2026",
"url":"https://militarnyi.com/en/news/drone-strike-sparks-fire-at-azot-chemical-plant-in-novomoskovsk/",
"archiv":null,
"citace":null
}
},
{
"d":"2026-06-26",
"prostredek":"drony",
"co":"Masivní útok; gubernátor potvrdil poškozené elektrické vedení a „průmyslový objekt“ v Novomoskovsku, OSINT Astra jej určila jako Azot.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"LIGA.net, 26. 6. 2026",
"url":"https://news.liga.net/en/war/news/in-russias-tula-region-drones-attacked-novomoskovsk-the-azot-chemical-plant-is-on-fire-video",
"archiv":null,
"citace":null
}
},
{
"d":"2026-10-28",
"prostredek":"drony",
"co":"Požár v závodě, záběry naznačují zásah jednotky na čpavek AM-70; gubernátor potvrdil škody v průmyslové zóně a kontrolu ovzduší.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"odhad",
"zdroj":{
"nazev":"UNITED24 Media, 28. 10. 2026",
"url":"https://united24media.com/war-in-ukraine/drones-set-fire-to-one-of-russias-largest-chemical-plants-linked-to-military-explosives-23862",
"archiv":"http://web.archive.org/web/20261028150358/https://united24media.com/war-in-ukraine/drones-set-fire-to-one-of-russias-largest-chemical-plants-linked-to-military-explosives-23862",
"citace":null
}
}
]
},
{
"id":"belgorod_luch",
"strana":"RU",
"druh":"elektrarna",
"nazev":"Teplárna Luč (GTU-TEC Luč)",
"vlastnik":"Kvadra",
"misto":"Belgorod, Belgorodská oblast",
"gps":[
50.561,
36.581
],
"vyznam":"Plynová teplárna dodávající elektřinu a teplo části Belgorodu; opakované údery na ni a okolní rozvodny způsobily v zimě 2025/26 rozsáhlé výpadky proudu a topení ve městě u ukrajinské hranice.",
"kapacita":{
"hodnota":60,
"jednotka":"MW",
"popis":"instalovaný elektrický výkon (2 plynové turbíny GE po 30 MW) a 60 Gcal/h tepla",
"historie":[],
"zdroj":{
"nazev":"Kvadra – tisková zpráva o TEC Luč",
"url":"https://www.quadra.ru/en/company-news/hpp-luch-of-quadra-power-generation-s-belgorod-branch-has-generated-over-4-bn-kwh-of-electricity-and/",
"archiv":"http://web.archive.org/web/20221014193543/https://www.quadra.ru/en/company-news/hpp-luch-of-quadra-power-generation-s-belgorod-branch-has-generated-over-4-bn-kwh-of-electricity-and/",
"citace":"The installed electric capacity of HPP \"Luch\" is 60 MW"
}
},
"stav":{
"k":"2026-02-11",
"provoz":"mimo",
"text":"Po úderech 7.–8. 2. 2026 satelit ukázal poškozené obě turbíny a zbořenou strojovnu; gubernátor Gladkov uvedl, že opravy „nepřinesly kýžené výsledky“ a budou dlouhé. Bez tepla zůstalo asi 80 000 obyvatel. Novější zprávu o znovuspuštění jsem nenašel; ukrajinská strana hlásila další zásah 4. 7. 2026.",
"zdroj":{
"nazev":"Kyiv Post, 11. 2. 2026",
"url":"https://www.kyivpost.com/post/69867",
"archiv":"http://web.archive.org/web/20260216193913/https://www.kyivpost.com/post/69867",
"citace":"not given the desired results"
}
},
"neuplne":"Data dvou lednových úderů 2026 a zásahu 4. 7. 2026 nejsou přesně doložena; listopadový úder 2025 je podle zdrojů 5. nebo 10. 11.",
"zasahy":[
{
"d":"2025-09-28",
"prostredek":"rakety",
"co":"Zásah teplárny a městské rozvodny – výpadky v Belgorodu, Starém Oskolu a Šebekinu; proud obnoven až 30. 9.",
"dopad":2,
"obnova":"2 dny",
"obnovaDni":2,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Euromaidan Press, 15. 12. 2025",
"url":"https://euromaidanpress.com/2025/12/15/ukrainian-missiles-hammer-belgorod-power-plant-for-fourth-time-since-september/",
"archiv":null,
"citace":null
}
},
{
"d":"2025-10-05",
"prostredek":"rakety",
"co":"Zasažen jeden z energobloků, požár; přes 40 000 lidí bez proudu.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Euromaidan Press, 15. 12. 2025",
"url":"https://euromaidanpress.com/2025/12/15/ukrainian-missiles-hammer-belgorod-power-plant-for-fourth-time-since-september/",
"archiv":null,
"citace":null
}
},
{
"d":"2025-11-10",
"prostredek":"rakety",
"co":"Teplárna znovu zasažena a podle energetiků opět mimo provoz; Gladkov přiznal škody, svedl je na trosky.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Euromaidan Press, 15. 12. 2025",
"url":"https://euromaidanpress.com/2025/12/15/ukrainian-missiles-hammer-belgorod-power-plant-for-fourth-time-since-september/",
"archiv":null,
"citace":null
}
},
{
"d":"2025-12-15",
"prostredek":"rakety",
"co":"Noční úder, čtvrtý od září; Gladkov potvrdil „vážné škody na inženýrské infrastruktuře“.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Euromaidan Press, 15. 12. 2025",
"url":"https://euromaidanpress.com/2025/12/15/ukrainian-missiles-hammer-belgorod-power-plant-for-fourth-time-since-september/",
"archiv":null,
"citace":"serious damage to engineering infrastructure"
}
},
{
"d":"2026-01",
"prostredek":"rakety",
"co":"Nejméně dva zásahy během ledna; výpadky postihly podle zpráv až 500 000 obyvatel, většina škod opravena do konce měsíce.",
"dopad":3,
"obnova":"asi 2–3 týdny",
"obnovaDni":null,
"vypadek":null,
"overeni":"odhad",
"zdroj":{
"nazev":"Kyiv Post, 11. 2. 2026",
"url":"https://www.kyivpost.com/post/69867",
"archiv":"http://web.archive.org/web/20260216193913/https://www.kyivpost.com/post/69867",
"citace":null
}
},
{
"d":"2026-02-07",
"prostredek":"rakety",
"co":"Kritické údery 7.–8. 2.: satelit ukázal poškozené obě plynové turbíny a zdemolovanou strojovnu. Gladkov označil situaci za „téměř katastrofální“; 80 000 lidí bez tepla, 455 domů odpojeno.",
"dopad":4,
"obnova":"dlouhé opravy, náhradní díly GE nedostupné",
"obnovaDni":null,
"vypadek":"celá teplárna 60 MW",
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Post, 11. 2. 2026",
"url":"https://www.kyivpost.com/post/69867",
"archiv":"http://web.archive.org/web/20260216193913/https://www.kyivpost.com/post/69867",
"citace":"almost catastrophic"
}
}
]
},
{
"id":"satura_gres",
"strana":"RU",
"druh":"elektrarna",
"nazev":"Elektrárna Šatura (Šaturská GRES)",
"vlastnik":"Unipro",
"misto":"Šatura, Moskevská oblast",
"gps":[
55.577,
39.561
],
"vyznam":"Jedna z nejstarších ruských elektráren (1920), dodává elektřinu a teplo části Moskevské oblasti asi 120 km od Moskvy; zásah byl jedním z nejvýznamnějších útoků na elektrárnu hluboko v Rusku.",
"kapacita":{
"hodnota":1500,
"jednotka":"MW",
"popis":"instalovaný výkon; v roce 2022 vyrobila 6 507 GWh (využití 49,5 %)",
"historie":[
[
2022,
6507,
"výroba GWh"
]
],
"zdroj":{
"nazev":"Unipro – výkonnostní ukazatele",
"url":"https://www.unipro.energy/en/production/performance/",
"archiv":"http://web.archive.org/web/20260610191453/https://www.unipro.energy/en/production/performance/",
"citace":null
}
},
"stav":{
"k":"2025-11-24",
"provoz":"bezi",
"text":"Den po útoku gubernátor Vorobjov oznámil, že elektrárna znovu běží a domy se postupně připojují k topení. Další útok na Šaturu do listopadu 2026 jsem nenašel.",
"zdroj":{
"nazev":"Reuters (Yahoo), 24. 11. 2025",
"url":"https://uk.news.yahoo.com/russian-heating-power-plant-back-170127870.html",
"archiv":"http://web.archive.org/web/20251124182624/https://uk.news.yahoo.com/russian-heating-power-plant-back-170127870.html",
"citace":null
}
},
"neuplne":null,
"zasahy":[
{
"d":"2025-11-23",
"prostredek":"drony",
"co":"Drony zasáhly transformátory vyvádějící výkon do sítě (hořely 3), záběry ukázaly i poškozenou strojovnu bloku 80 MW. Gubernátor Vorobjov potvrdil dopad dronů na areál a požár; elektrárna se odstavila a obyvatelé zůstali bez tepla při teplotách kolem nuly.",
"dopad":2,
"obnova":"asi 1 den",
"obnovaDni":1,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Novaja gazeta Jevropa, 23. 11. 2025",
"url":"https://novayagazeta.eu/en/articles/2025/11/23/fires-break-out-at-key-moscow-region-thermal-power-plant-following-ukrainian-drone-strike-en-news",
"archiv":"http://web.archive.org/web/20261101080217/https://novayagazeta.eu/en/articles/2025/11/23/fires-break-out-at-key-moscow-region-thermal-power-plant-following-ukrainian-drone-strike-en-news",
"citace":"Some of the drones were downed by air defense, and some fell on the station's territory"
}
}
]
},
{
"id":"trypilska",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Trypilská tepelná elektrárna",
"vlastnik":"Centrenergo (státní)",
"misto":"Ukrajinka u Trypillja, Kyjevská oblast",
"gps":[
50.135,
30.748
],
"vyznam":"Největší elektrárna Kyjevské oblasti (6 bloků po 300 MW), zásobovala Kyjevskou, Čerkaskou a Žytomyrskou oblast. Jejím zničením v dubnu 2024 přišel státní Centrenergo o veškerou výrobu.",
"kapacita":{
"hodnota":1800,
"jednotka":"MW",
"popis":"instalovaný elektrický výkon (6 × 300 MW)",
"historie":[
[
2021,
1800,
"instalovaný výkon"
],
[
2024,
0,
"po zásahu 11. 4. 2024 zničena, nevyrábí"
],
[
2026,
0,
"k květnu 2026 nepotvrzen návrat žádného bloku do provozu"
]
],
"zdroj":{
"nazev":"Interfax-Ukraine, 11. 4. 2024",
"url":"https://en.interfax.com.ua/news/general/979604.html",
"archiv":"http://web.archive.org/web/20260510114054/https://en.interfax.com.ua/news/general/979604.html",
"citace":null
}
},
"stav":{
"k":"2026-11-09",
"provoz":"mimo",
"text":"Rozpracovaná oprava (stát ji chtěl do roku 2027 opravit a Centrenergo prodat) byla znovu poškozena zásahy 30. 9. a 9. 11. 2026; Centrenergo hlásí „mimořádně vážné“ následky.",
"zdroj":{
"nazev":"Ukrajinska pravda, 9. 11. 2026",
"url":"https://www.pravda.com.ua/eng/news/2026/11/09/8062006/",
"archiv":"http://web.archive.org/web/20261115182931/https://www.pravda.com.ua/eng/news/2026/11/09/8062006/",
"citace":"Even now it is obvious that the consequences of the Russian strikes are extremely serious."
}
},
"neuplne":"Elektrárna byla napadena mnohokrát; podle Global Energy Monitor také v lednu, září a prosinci 2025 (poslanec Nahorňak: 19 dronů v září 2025 zničilo rok oprav), tyto zásahy jsme nezávisle neověřili a nejsou v seznamu.",
"zasahy":[
{
"d":"2024-04-11",
"prostredek":"drony a rakety",
"co":"Kombinovaný útok raketami (vč. Ch-69) a drony zapálil strojovnu; elektrárna byla zcela zničena. Zelenskyj uvedl, že na ni letělo 11 raket a Ukrajině došly protiletadlové střely.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":"1 800 MW (veškerá výroba Centrenergo spolu se Zmijivskou)",
"overeni":"over",
"zdroj":{
"nazev":"Interfax-Ukraine, 11. 4. 2024",
"url":"https://en.interfax.com.ua/news/general/979604.html",
"archiv":"http://web.archive.org/web/20260510114054/https://en.interfax.com.ua/news/general/979604.html",
"citace":"Everything is destroyed"
}
},
{
"d":"2025-11-08",
"prostredek":"drony a rakety",
"co":"Největší útok na elektrárny Centrenergo: opakované zásahy drony a raketami zničily veškerý obnovený výkon; Trypilská i Zmijivská přestaly vyrábět.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":"veškerý obnovený výkon Centrenergo",
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Independent, 8. 11. 2025",
"url":"https://kyivindependent.com/all-ukraines-state-owned-thermal-power-plants-stop-working-after-russias-largest-ever-attack/",
"archiv":"http://web.archive.org/web/20260722232951/https://kyivindependent.com/all-ukraines-state-owned-thermal-power-plants-stop-working-after-russias-largest-ever-attack/",
"citace":"Less than a month has passed since the previous strike."
}
},
{
"d":"2026-09-30",
"prostredek":"drony a rakety",
"co":"Útok poškodil výrobní zařízení během oprav; od konce září Rusko podle Centrenergo útoky zesílilo a nasazuje balistické rakety a proudové drony.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Ukrajinska pravda, 9. 11. 2026",
"url":"https://www.pravda.com.ua/eng/news/2026/11/09/8062006/",
"archiv":"http://web.archive.org/web/20261115182931/https://www.pravda.com.ua/eng/news/2026/11/09/8062006/",
"citace":null
}
},
{
"d":"2026-11-09",
"prostredek":"drony a rakety",
"co":"Další zásah balistickými raketami a proudovými drony; ochranné konstrukce poškození nezabránily, rozsah škod se zjišťuje.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Ukrinform, 9. 11. 2026",
"url":"https://www.ukrinform.net/rubric-economy/4183030-russia-strikes-trypillia-tpp-again.html",
"archiv":"http://web.archive.org/web/20261115182931/https://www.ukrinform.net/rubric-economy/4183030-russia-strikes-trypillia-tpp-again.html",
"citace":null
}
}
]
},
{
"id":"zmijivska",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Zmijivská tepelná elektrárna",
"vlastnik":"Centrenergo (státní)",
"misto":"Slobožanske, Čuhujivský rajón, Charkovská oblast",
"gps":[
49.585,
36.525
],
"vyznam":"Největší elektrárna východní Ukrajiny, klíčová pro Charkov a okolí. Po zničení v březnu 2024 zůstalo bez proudu asi 700 tisíc lidí.",
"kapacita":{
"hodnota":2200,
"jednotka":"MW",
"popis":"instalovaný elektrický výkon (Wikipedie uvádí i 2 400 MW)",
"historie":[
[
2021,
2200,
"instalovaný výkon"
],
[
2024,
0,
"po 22. 3. 2024 zničena"
],
[
2025,
0,
"obnovené bloky znovu vyřazeny 8. 11. 2025"
]
],
"zdroj":{
"nazev":"Wikipedia: List of power stations in Ukraine",
"url":"https://en.wikipedia.org/wiki/List_of_power_stations_in_Ukraine",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2026-10-21",
"provoz":"neznamo",
"text":"Po listopadu 2025 nevyrábí ani obnovená část; v týdnu do 21. 10. 2026 byla znovu napadena drony a raketami. Aktuální stav výroby nezveřejněn.",
"zdroj":{
"nazev":"Gwara Media, 21. 10. 2026",
"url":"https://gwaramedia.com/en/russian-forces-attack-3-thermal-power-stations-in-kharkiv-oblast-in-a-week/",
"archiv":null,
"citace":null
}
},
"neuplne":"Do seznamu nejsou zahrnuty drobnější útoky z let 2022–2026, o nichž chybějí podrobné zprávy.",
"zasahy":[
{
"d":"2022-09",
"prostredek":"rakety",
"co":"Ruské ostřelování poškodilo elektrárnu, zahynuli čtyři zaměstnanci; poškození bylo později opraveno.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedia: Zmiivska thermal power plant",
"url":"https://en.wikipedia.org/wiki/Zmiivska_thermal_power_plant",
"archiv":null,
"citace":"Four civilian workers at the power plant were killed, and electricity and water delivery was affected."
}
},
{
"d":"2024-03-22",
"prostredek":"drony a rakety",
"co":"Při dosud největším útoku na energetiku byly zničeny všechny bloky a poškozeno pomocné zařízení; Centrenergo prohlásilo elektrárnu za zcela zničenou.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá elektrárna (~2,2 GW)",
"overeni":"over",
"zdroj":{
"nazev":"Interfax-Ukraine, 2024",
"url":"https://en.interfax.com.ua/news/general/976986.html",
"archiv":"http://web.archive.org/web/20241214065749/https://en.interfax.com.ua/news/general/976986.html",
"citace":null
}
},
{
"d":"2025-11-08",
"prostredek":"drony a rakety",
"co":"Masivní útok zničil bloky obnovené po roce 2024; elektrárna přestala vyrábět.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"NV, 8. 11. 2025",
"url":"https://english.nv.ua/russian-war/russia-strikes-zmiiv-and-trypilska-power-plants-forcing-full-shutdown-centrenergo-50559133.html",
"archiv":"http://web.archive.org/web/20260110164022/https://english.nv.ua/russian-war/russia-strikes-zmiiv-and-trypilska-power-plants-forcing-full-shutdown-centrenergo-50559133.html",
"citace":null
}
},
{
"d":"2026-10",
"prostredek":"drony a rakety",
"co":"Policie Charkovské oblasti: během týdne do 21. 10. napadena drony a raketami Banderol spolu s charkovskými TEC-3 a TEC-5; rozsah škod neuveden.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"odhad",
"zdroj":{
"nazev":"Gwara Media, 21. 10. 2026",
"url":"https://gwaramedia.com/en/russian-forces-attack-3-thermal-power-stations-in-kharkiv-oblast-in-a-week/",
"archiv":null,
"citace":"Over the past week, Russian forces attacked two Kharkiv thermal power stations"
}
}
]
},
{
"id":"vuhlehirska",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Vuhlehirská tepelná elektrárna",
"vlastnik":"Centrenergo (státní)",
"misto":"Svitlodarsk, Doněcká oblast",
"gps":[
48.464,
38.198
],
"vyznam":"Největší elektrárna Centrenergo; od července 2022 v rukou ruských vojsk, Ukrajině tak chybí 3,6 GW.",
"kapacita":{
"hodnota":3600,
"jednotka":"MW",
"popis":"instalovaný elektrický výkon",
"historie":[
[
2021,
3600,
"instalovaný výkon"
],
[
2022,
0,
"okupována, pro Ukrajinu ztracena"
]
],
"zdroj":{
"nazev":"Wikipedia: Vuhlehirska Power Station",
"url":"https://en.wikipedia.org/wiki/Vuhlehirska_Power_Station",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2026-11-26",
"provoz":"mimo",
"text":"Okupována ruskými vojsky od 26. 7. 2022; pro ukrajinskou soustavu nevyrábí.",
"zdroj":{
"nazev":"Reuters, 27. 7. 2022",
"url":"https://www.reuters.com/world/europe/russia-captures-power-station-redeploys-troops-toward-southern-ukraine-2022-07-27/",
"archiv":"http://web.archive.org/web/20250326140502/https://www.reuters.com/world/europe/russia-captures-power-station-redeploys-troops-toward-southern-ukraine-2022-07-27/",
"citace":null
}
},
"neuplne":null,
"zasahy":[
{
"d":"2022-07-26",
"prostredek":"jiné",
"co":"Ruská a separatistická vojska elektrárnu po bojích obsadila.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":"3 600 MW",
"overeni":"over",
"zdroj":{
"nazev":"Reuters, 27. 7. 2022",
"url":"https://www.reuters.com/world/europe/russia-captures-power-station-redeploys-troops-toward-southern-ukraine-2022-07-27/",
"archiv":"http://web.archive.org/web/20250326140502/https://www.reuters.com/world/europe/russia-captures-power-station-redeploys-troops-toward-southern-ukraine-2022-07-27/",
"citace":null
}
}
]
},
{
"id":"burstyn",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Burštynská tepelná elektrárna",
"vlastnik":"DTEK Zachidenergo (Rinat Achmetov)",
"misto":"Burštyn, Ivanofrankivská oblast",
"gps":[
49.21,
24.667
],
"vyznam":"Největší elektrárna západní Ukrajiny, leží v uzlu vedení propojujících Ukrajinu s evropskou soustavou.",
"kapacita":{
"hodnota":2334,
"jednotka":"MW",
"popis":"instalovaný elektrický výkon",
"historie":[
[
2021,
2334,
"instalovaný výkon"
],
[
2024,
null,
"22. 3. 2024 poškozeny všechny bloky (od 50 % po úplné zničení)"
]
],
"zdroj":{
"nazev":"Wikipedia: Burshtyn TPP",
"url":"https://en.wikipedia.org/wiki/Burshtyn_TPP",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2026-02-07",
"provoz":"neznamo",
"text":"DTEK z bezpečnostních důvodů nezveřejňuje stav jednotlivých elektráren. Poslední potvrzený zásah 7. 2. 2026; elektrárna byla mnohokrát opravena a znovu zasažena.",
"zdroj":{
"nazev":"LB.ua, 7. 2. 2026",
"url":"https://lb.ua/society/2026/02/07/721037_shmigal_rf_atakuvala_burshtinsku.html",
"archiv":"http://web.archive.org/web/20260207085550/https://lb.ua/society/2026/02/07/721037_shmigal_rf_atakuvala_burshtinsku.html",
"citace":null
}
},
"neuplne":"Gubernátorka uvedla v červnu 2024, že elektrárnu Rusko napadlo víc než 12krát; DTEK místa zásahů obvykle nejmenuje, takže řada útoků z let 2024–2026 není v seznamu.",
"zasahy":[
{
"d":"2022-10-10",
"prostredek":"rakety",
"co":"Při masivním raketovém útoku zasáhly čtyři rakety otevřenou rozvodnu elektrárny.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedia: Burshtyn TPP",
"url":"https://en.wikipedia.org/wiki/Burshtyn_TPP",
"archiv":null,
"citace":null
}
},
{
"d":"2024-03-22",
"prostredek":"drony a rakety",
"co":"Rakety a drony poškodily všechny bloky (od více než 50 % po úplné zničení); DTEK přišel o polovinu výroby, obnova 6–24 měsíců.",
"dopad":4,
"obnova":"6–24 měsíců",
"obnovaDni":365,
"vypadek":"DTEK: ztráta 50 % výrobní kapacity (spolu s Ladyžynskou)",
"overeni":"over",
"zdroj":{
"nazev":"Interfax-Ukraine, březen 2024",
"url":"https://en.interfax.com.ua/news/economic/976568.html",
"archiv":"http://web.archive.org/web/20260120061908/https://en.interfax.com.ua/news/economic/976568.html",
"citace":null
}
},
{
"d":"2025-10-30",
"prostredek":"drony a rakety",
"co":"Několikahodinový útok raketami a drony na Burštyn (a Ladyžyn, Dobrotvir); DTEK hlásí vážné poškození zařízení TPP, třetí masivní útok v říjnu.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Interfax-Ukraine, 30. 10. 2025",
"url":"https://en.interfax.com.ua/news/general/1116649.html",
"archiv":"http://web.archive.org/web/20260808020444/https://en.interfax.com.ua/news/general/1116649.html",
"citace":"The TPP equipment was seriously damaged."
}
},
{
"d":"2025-11-19",
"prostredek":"drony a rakety",
"co":"Elektrárna byla hlavním cílem útoku (vč. asi 12 střel Kalibr) a byla vážně poškozena; deficit v soustavě vzrostl na 4,6 GW a zavedly se přísné odstávky.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Hromadske radio, 20. 11. 2025",
"url":"https://hromadske.radio/news/2025/11/20/udar-po-burshtynskiy-tes-pryzviv-do-defitsytu-elektroenerhii-ihnatiev",
"archiv":"http://web.archive.org/web/20260718063450/https://hromadske.radio/news/2025/11/20/udar-po-burshtynskiy-tes-pryzviv-do-defitsytu-elektroenerhii-ihnatiev",
"citace":"Він стверджує, що Бурштинська ТЕС зазнала суттєвих пошкоджень."
}
},
{
"d":"2026-02-07",
"prostredek":"drony a rakety",
"co":"Ministr energetiky Šmyhal potvrdil útok na Burštynskou a Dobrotvirskou TPP spolu s rozvodnami 750 a 330 kV.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"LB.ua, 7. 2. 2026",
"url":"https://lb.ua/society/2026/02/07/721037_shmigal_rf_atakuvala_burshtinsku.html",
"archiv":"http://web.archive.org/web/20260207085550/https://lb.ua/society/2026/02/07/721037_shmigal_rf_atakuvala_burshtinsku.html",
"citace":null
}
}
]
},
{
"id":"ladyzyn",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Ladyžynská tepelná elektrárna",
"vlastnik":"DTEK Zachidenergo",
"misto":"Ladyžyn, Vinnycká oblast",
"gps":[
48.707,
29.22
],
"vyznam":"Uhelná elektrárna (6 × 300 MW) pro střed země a jediný zdroj tepla pro město Ladyžyn.",
"kapacita":{
"hodnota":1800,
"jednotka":"MW",
"popis":"instalovaný elektrický výkon (6 × 300 MW)",
"historie":[
[
2021,
1800,
"instalovaný výkon"
],
[
2024,
null,
"22. 3. 2024 poškozeny všechny bloky; 17. 11. 2024 zastavena"
]
],
"zdroj":{
"nazev":"Wikipedia: List of power stations in Ukraine",
"url":"https://en.wikipedia.org/wiki/List_of_power_stations_in_Ukraine",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2026-11-03",
"provoz":"neznamo",
"text":"3. 11. 2026 byla podle monitorovacích kanálů hlavním cílem salvy střel; DTEK ten den zastavil výrobu ve třech TPP, ale nejmenuje které.",
"zdroj":{
"nazev":"NV, 3. 11. 2026",
"url":"https://nv.ua/ukr/amp/3-listopada-ataka-po-ukrajini-pid-udarom-bula-ladizhinska-tes-harkiv-dnipro-rivne-usi-naslidki-50655677.html",
"archiv":"http://web.archive.org/web/20261104082403/https://nv.ua/ukr/amp/3-listopada-ataka-po-ukrajini-pid-udarom-bula-ladizhinska-tes-harkiv-dnipro-rivne-usi-naslidki-50655677.html",
"citace":null
}
},
"neuplne":"DTEK místa zásahů většinou nejmenuje; seznam obsahuje jen zásahy, které potvrdily úřady nebo místní média.",
"zasahy":[
{
"d":"2022-10",
"prostredek":"drony",
"co":"Útok kamikadze drony na elektrárnu, potvrdil šéf oblastní správy Borzov.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Interfax-Ukraine, říjen 2022",
"url":"https://en.interfax.com.ua/news/general/864755.html",
"archiv":"http://web.archive.org/web/20260508125832/https://en.interfax.com.ua/news/general/864755.html",
"citace":null
}
},
{
"d":"2022-11-23",
"prostredek":"rakety",
"co":"Po raketovém útoku na energetiku se elektrárna zastavila, 18 tisíc obyvatel bylo bez tepla, ve městě vyhlášen mimořádný stav.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"TSN, listopad 2022",
"url":"https://tsn.ua/en/ato/ladyzhyn-thermal-power-plant-is-still-shut-down-18-thousand-local-residents-are-cut-off-from-heat-supply-2213401.html",
"archiv":"http://web.archive.org/web/20250729235451/https://tsn.ua/en/ato/ladyzhyn-thermal-power-plant-is-still-shut-down-18-thousand-local-residents-are-cut-off-from-heat-supply-2213401.html",
"citace":null
}
},
{
"d":"2024-03-22",
"prostredek":"drony a rakety",
"co":"Poškozeny všechny bloky Ladyžynské i Burštynské TPP; DTEK přišel o polovinu výroby.",
"dopad":4,
"obnova":"6–24 měsíců",
"obnovaDni":365,
"vypadek":"téměř 2 GW dostupného výkonu (spolu s Burštynem)",
"overeni":"over",
"zdroj":{
"nazev":"Interfax-Ukraine, březen 2024",
"url":"https://en.interfax.com.ua/news/economic/976568.html",
"archiv":"http://web.archive.org/web/20260120061908/https://en.interfax.com.ua/news/economic/976568.html",
"citace":null
}
},
{
"d":"2024-11-17",
"prostredek":"drony a rakety",
"co":"Po útoku elektrárna přerušila provoz; úplná ztráta napájení stanice nechala bez proudu 430 obcí.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"TSN, 18. 11. 2024",
"url":"https://tsn.ua/en/ato/ladyzhyn-tpp-in-vinnytsia-region-ceased-operations-after-russian-strike-on-november-17-2704761.html",
"archiv":"http://web.archive.org/web/20251206185858/https://tsn.ua/en/ato/ladyzhyn-tpp-in-vinnytsia-region-ceased-operations-after-russian-strike-on-november-17-2704761.html",
"citace":null
}
},
{
"d":"2025-10-30",
"prostredek":"drony a rakety",
"co":"Útok raketami Kinžal a drony; město zůstalo bez tepla a vody, DTEK hlásí vážné poškození zařízení TPP.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Interfax-Ukraine, 30. 10. 2025",
"url":"https://en.interfax.com.ua/news/general/1116649.html",
"archiv":"http://web.archive.org/web/20260808020444/https://en.interfax.com.ua/news/general/1116649.html",
"citace":null
}
},
{
"d":"2026-11-03",
"prostredek":"rakety",
"co":"Velká část salvy střel (podle kanálů i Zirkony) mířila na Ladyžyn; většina Vinnycké oblasti bez proudu. DTEK potvrdil zastavení tří TPP bez jmen.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"odhad",
"zdroj":{
"nazev":"NV, 3. 11. 2026",
"url":"https://nv.ua/ukr/amp/3-listopada-ataka-po-ukrajini-pid-udarom-bula-ladizhinska-tes-harkiv-dnipro-rivne-usi-naslidki-50655677.html",
"archiv":"http://web.archive.org/web/20261104082403/https://nv.ua/ukr/amp/3-listopada-ataka-po-ukrajini-pid-udarom-bula-ladizhinska-tes-harkiv-dnipro-rivne-usi-naslidki-50655677.html",
"citace":null
}
}
]
},
{
"id":"dobrotvir",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Dobrotvirská tepelná elektrárna",
"vlastnik":"DTEK Zachidenergo",
"misto":"Dobrotvir, Lvovská oblast",
"gps":[
50.213,
24.375
],
"vyznam":"Uhelná elektrárna 55 km od Lvova, důležitá pro zásobování Lvovska.",
"kapacita":{
"hodnota":600,
"jednotka":"MW",
"popis":"instalovaný výkon (projektovaný výkon se uvádí i 510 MW)",
"historie":[],
"zdroj":{
"nazev":"Wikipedia: List of power stations in Ukraine",
"url":"https://en.wikipedia.org/wiki/List_of_power_stations_in_Ukraine",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2026-02-07",
"provoz":"neznamo",
"text":"Po útoku 7. 2. 2026 bylo 600 tisíc domácností Lvovska bez proudu; nový stav výroby nezveřejněn.",
"zdroj":{
"nazev":"NV, 7. 2. 2026",
"url":"https://english.nv.ua/nation/attack-on-dobrotvir-thermal-power-plant-600-000-families-left-without-power-in-lviv-oblast-50581850.html",
"archiv":"http://web.archive.org/web/20260207120940/https://english.nv.ua/nation/attack-on-dobrotvir-thermal-power-plant-600-000-families-left-without-power-in-lviv-oblast-50581850.html",
"citace":null
}
},
"neuplne":"Útok z května 2024 (zmiňovaný Global Energy Monitor) jsme nedoložili konkrétní zprávou.",
"zasahy":[
{
"d":"2025-10-30",
"prostredek":"drony a rakety",
"co":"Střely (vč. Kinžalů) a drony způsobily požár a poškození; ve Lvově zavedeny hodinové odstávky.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Interfax-Ukraine, 30. 10. 2025",
"url":"https://en.interfax.com.ua/news/general/1116643.html",
"archiv":"http://web.archive.org/web/20260711110611/https://en.interfax.com.ua/news/general/1116643.html",
"citace":null
}
},
{
"d":"2026-02-07",
"prostredek":"drony a rakety",
"co":"Útok 408 dronů a 39 střel; Dobrotvir bez vody a tepla, přes 600 tisíc domácností Lvovska bez proudu.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"NV, 7. 2. 2026",
"url":"https://english.nv.ua/nation/attack-on-dobrotvir-thermal-power-plant-600-000-families-left-without-power-in-lviv-oblast-50581850.html",
"archiv":"http://web.archive.org/web/20260207120940/https://english.nv.ua/nation/attack-on-dobrotvir-thermal-power-plant-600-000-families-left-without-power-in-lviv-oblast-50581850.html",
"citace":null
}
}
]
},
{
"id":"kryvorizka",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Kryvorizká tepelná elektrárna",
"vlastnik":"DTEK Dniproenergo",
"misto":"Zelenodolsk, Dněpropetrovská oblast",
"gps":[
47.539,
33.662
],
"vyznam":"Jedna z největších uhelných elektráren Ukrajiny, zásobuje průmyslový Kryvbas a Dněpropetrovsko.",
"kapacita":{
"hodnota":2820,
"jednotka":"MW",
"popis":"instalovaný elektrický výkon",
"historie":[],
"zdroj":{
"nazev":"Wikipedia: List of power stations in Ukraine",
"url":"https://en.wikipedia.org/wiki/List_of_power_stations_in_Ukraine",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2026-11-25",
"provoz":"mimo",
"text":"Po útoku 25. 11. 2026 je zařízení vážně poškozeno a elektrárna nevyrábí (třetí masivní útok na TPP DTEK v listopadu).",
"zdroj":{
"nazev":"Informator Kryvyj Rih, 25. 11. 2026",
"url":"https://kr.informator.ua/2026/11/25/vorog-atakuvav-kryvorizhzhya-tes-prypynyla-robotu",
"archiv":null,
"citace":null
}
},
"neuplne":"DTEK elektrárnu ve zprávách často nejmenuje; ruské MO hlásilo další zásahy (např. 20.–21. 11. 2026), ty bez ukrajinského potvrzení nejsou uvedeny.",
"zasahy":[
{
"d":"2022-04-27",
"prostredek":"rakety",
"co":"Zásah transformátoru, požár a značné poškození.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Global Energy Monitor: Kryvorizka power station",
"url":"https://www.gem.wiki/Kryvorizka_power_station",
"archiv":null,
"citace":null
}
},
{
"d":"2026-06-12",
"prostredek":"drony",
"co":"Útok drony Šáhid: zahynul 60letý zaměstnanec, zařízení TPP vážně poškozeno.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Krivbass.city, 13. 6. 2026",
"url":"https://krivbass.city/news/view/e-zagiblij-i-poranenij-rosiyani-vdarili-po-tes-dtek-na-krivorizhzhi",
"archiv":"http://web.archive.org/web/20260714063128/https://krivbass.city/news/view/e-zagiblij-i-poranenij-rosiyani-vdarili-po-tes-dtek-na-krivorizhzhi",
"citace":"Через атаку обладнання ТЕС зазнала значних руйнувань."
}
},
{
"d":"2026-09-08",
"prostredek":"drony a rakety",
"co":"Několik vln útoků; elektrárna zcela přestala vyrábět, zařízení podstatně poškozeno.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"D1.ua, září 2026",
"url":"https://d1.ua/na-kryvorizku-tes-u-zelenodolsku-vorog-zdijsnyv-kilka-hvyl-atak-stantsiya-zupynyla-robotu",
"archiv":null,
"citace":null
}
},
{
"d":"2026-11-25",
"prostredek":"drony a rakety",
"co":"Útok na TPP DTEK v Zelenodolsku: vážné poškození, výroba zastavena.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Informator Kryvyj Rih, 25. 11. 2026",
"url":"https://kr.informator.ua/2026/11/25/vorog-atakuvav-kryvorizhzhya-tes-prypynyla-robotu",
"archiv":null,
"citace":null
}
}
]
},
{
"id":"prydniprovska",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Prydniprovská tepelná elektrárna",
"vlastnik":"DTEK Dniproenergo",
"misto":"Dnipro, Dněpropetrovská oblast",
"gps":[
48.405,
35.114
],
"vyznam":"Elektrárna a zdroj tepla pro milionové město Dnipro.",
"kapacita":{
"hodnota":1765,
"jednotka":"MW",
"popis":"instalovaný elektrický výkon",
"historie":[
[
2025,
null,
"v únoru 2025 jen v režimu výroby tepla"
]
],
"zdroj":{
"nazev":"Wikipedia: List of power stations in Ukraine",
"url":"https://en.wikipedia.org/wiki/List_of_power_stations_in_Ukraine",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2026-02-03",
"provoz":"neznamo",
"text":"Po útoku 3. 2. 2026 vážné poškození zařízení, 10 tisíc odběratelů v Dnipru bez tepla; další stav nezveřejněn.",
"zdroj":{
"nazev":"Suspilne, 3. 2. 2026",
"url":"https://suspilne.media/1230377-rosia-zavdala-najsilnisogo-udaru-po-energetici-u-2026-roci-dtek/",
"archiv":"http://web.archive.org/web/20260204061806/https://suspilne.media/1230377-rosia-zavdala-najsilnisogo-udaru-po-energetici-u-2026-roci-dtek/",
"citace":null
}
},
"neuplne":"Zásahy z let 2022–2023 a 2025 nejsou podrobně doloženy; seznam je neúplný.",
"zasahy":[
{
"d":"2024-02",
"prostredek":"rakety",
"co":"Několik zásahů s kritickým poškozením, obnova na měsíce; v červenci 2024 se o elektrárně psalo jako o zničené.",
"dopad":4,
"obnova":"měsíce",
"obnovaDni":null,
"vypadek":null,
"overeni":"odhad",
"zdroj":{
"nazev":"Global Energy Monitor: Prydniprovska power station",
"url":"https://www.gem.wiki/Prydniprovska_power_station",
"archiv":null,
"citace":null
}
},
{
"d":"2026-02-03",
"prostredek":"drony a rakety",
"co":"Hlavní cíl útoku balistickými raketami a drony na Dnipro; DTEK hlásí výrazné poškození technologického zařízení TPP v režimu vytápění.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Podrobnosti, 3. 2. 2026",
"url":"https://podrobnosti.ua/2511682-dnpro-atakuvali-raketi-ta-shahedi-poshkodzhena-pridnprovska-tes.html",
"archiv":"http://web.archive.org/web/20260225171814/https://podrobnosti.ua/2511682-dnpro-atakuvali-raketi-ta-shahedi-poshkodzhena-pridnprovska-tes.html",
"citace":null
}
}
]
},
{
"id":"zaporizka_tes",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Záporožská tepelná elektrárna",
"vlastnik":"DTEK Dniproenergo",
"misto":"Enerhodar, Záporožská oblast (okupováno)",
"gps":[
47.509,
34.626
],
"vyznam":"Nejvýkonnější tepelná elektrárna Ukrajiny; od března 2022 okupovaná, od května 2022 stojí bez uhlí.",
"kapacita":{
"hodnota":2850,
"jednotka":"MW",
"popis":"instalovaný výkon k 1. 1. 2021",
"historie":[
[
2021,
2850,
"instalovaný výkon"
],
[
2022,
0,
"okupována, od 5. 5. 2022 mimo provoz"
]
],
"zdroj":{
"nazev":"Wikipedia: Zaporizhzhia thermal power station",
"url":"https://en.wikipedia.org/wiki/Zaporizhzhia_thermal_power_station",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2026-11-26",
"provoz":"mimo",
"text":"Okupována ruskými vojsky, pro Ukrajinu nevyrábí.",
"zdroj":{
"nazev":"Babel, 5. 5. 2022",
"url":"https://babel.ua/en/news/78364-due-to-the-lack-of-coal-the-largest-thermal-power-plant-in-ukraine-stopped-in-occupied-enerhodar",
"archiv":"http://web.archive.org/web/20241207150313/https://babel.ua/en/news/78364-due-to-the-lack-of-coal-the-largest-thermal-power-plant-in-ukraine-stopped-in-occupied-enerhodar",
"citace":null
}
},
"neuplne":null,
"zasahy":[
{
"d":"2022-03-04",
"prostredek":"jiné",
"co":"Ruská vojska obsadila Enerhodar i s elektrárnou; 5. 5. 2022 se zastavila pro nedostatek uhlí.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":"2 850 MW",
"overeni":"over",
"zdroj":{
"nazev":"Babel, 5. 5. 2022",
"url":"https://babel.ua/en/news/78364-due-to-the-lack-of-coal-the-largest-thermal-power-plant-in-ukraine-stopped-in-occupied-enerhodar",
"archiv":"http://web.archive.org/web/20241207150313/https://babel.ua/en/news/78364-due-to-the-lack-of-coal-the-largest-thermal-power-plant-in-ukraine-stopped-in-occupied-enerhodar",
"citace":null
}
}
]
},
{
"id":"kurachivska",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Kurachivská tepelná elektrárna",
"vlastnik":"DTEK Schidenergo",
"misto":"Kurachove, Doněcká oblast (okupováno)",
"gps":[
47.995,
37.237
],
"vyznam":"Plynouhelná elektrárna blízko fronty na Donbasu; po opakovaném ostřelování odstavena, rozebrána na náhradní díly a v lednu 2025 dobyta.",
"kapacita":{
"hodnota":1532,
"jednotka":"MW",
"popis":"instalovaný výkon (2015)",
"historie":[
[
2021,
1532,
"instalovaný výkon"
],
[
2023,
0,
"od dubna 2023 po ostřelování odstavena"
]
],
"zdroj":{
"nazev":"Wikipedia: Kurakhove Power Station",
"url":"https://en.wikipedia.org/wiki/Kurakhove_Power_Station",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2025-01-03",
"provoz":"zniceno",
"text":"Zničena ostřelováním, v listopadu 2024 rozebírána pro opravy jiných elektráren, od začátku ledna 2025 pod ruskou kontrolou.",
"zdroj":{
"nazev":"ISW, 3. 1. 2025",
"url":"https://www.understandingwar.org/backgrounder/russian-offensive-campaign-assessment-january-3-2025",
"archiv":"http://web.archive.org/web/20250903203256/https://www.understandingwar.org/backgrounder/russian-offensive-campaign-assessment-january-3-2025",
"citace":null
}
},
"neuplne":"Podle ředitele byla elektrárna jen mezi 5. 12. 2023 a 17. 1. 2024 ostřelována 38krát; jednotlivé útoky nejsou vypsány.",
"zasahy":[
{
"d":"2022-10-17",
"prostredek":"rakety",
"co":"Raketové údery na elektrárnu během vlny útoků na energetiku (pokračovaly 18. 10.).",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Ukrinform, říjen 2022",
"url":"https://www.ukrinform.ua/rubric-ato/3595522-zagarbniki-obstrilali-raketami-kurahivsku-tes.html",
"archiv":null,
"citace":null
}
},
{
"d":"2023-04",
"prostredek":"dělostřelectvo",
"co":"Po ostřelování DTEK elektrárnu zastavil; bloky byly v červnu 2023 vedeny jako konzervované.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Delo.ua, duben 2023",
"url":"https://delo.ua/incidents/okupanti-obstrilyali-kuraxivsku-tes-v-dtek-povidomili-pro-zupinku-stanciyi-414072/",
"archiv":null,
"citace":null
}
},
{
"d":"2024-03",
"prostredek":"jiné",
"co":"Zničení železničního mostu pro dovoz uhlí učinilo elektrárnu zcela nefunkční.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Interfax-Ukraine, březen 2024",
"url":"https://interfax.com.ua/news/economic/976567.html",
"archiv":"http://web.archive.org/web/20260616001914/https://interfax.com.ua/news/economic/976567.html",
"citace":null
}
},
{
"d":"2025-01",
"prostredek":"jiné",
"co":"Ruská vojska elektrárnu dobyla během bitvy o Kurachove.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"ISW, 3. 1. 2025",
"url":"https://www.understandingwar.org/backgrounder/russian-offensive-campaign-assessment-january-3-2025",
"archiv":"http://web.archive.org/web/20250903203256/https://www.understandingwar.org/backgrounder/russian-offensive-campaign-assessment-january-3-2025",
"citace":null
}
}
]
},
{
"id":"kyjev_tec5_tec6",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Kyjevské teplárny TEC-5 a TEC-6",
"vlastnik":"Kyivteploenergo (město Kyjev)",
"misto":"Kyjev (TEC-5 Vydubyči, TEC-6 Troješčyna)",
"gps":[
50.401,
30.563
],
"vyznam":"Dvě největší kyjevské teplárny vyrábějí elektřinu i teplo pro většinu metropole. Jejich vyřazení v zimě 2025/26 nechalo tisíce domů bez topení v mrazech.",
"kapacita":{
"hodnota":1200,
"jednotka":"MW",
"popis":"elektrický výkon TEC-5 (700 MW) + TEC-6 (500 MW); souřadnice jsou TEC-5",
"historie":[],
"zdroj":{
"nazev":"Wikipedia: List of power stations in Ukraine",
"url":"https://en.wikipedia.org/wiki/List_of_power_stations_in_Ukraine",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2026-11-11",
"provoz":"mimo",
"text":"Po útocích (14. 10. 2026 na všechny tři teplárny) TEC-5, TEC-6 i Darnycká nevyrábějí elektřinu; Kyjev je odkázán na dodávky z jiných regionů a zhasl veřejné osvětlení.",
"zdroj":{
"nazev":"Kyiv Post, 11. 11. 2026",
"url":"https://www.kyivpost.com/post/89802",
"archiv":"http://web.archive.org/web/20261117152605/https://www.kyivpost.com/post/89802",
"citace":"have also stopped generating electricity following Russian strikes"
}
},
"neuplne":"Starosta Klyčko v říjnu 2026: na TEC-5 a TEC-6 mířilo 12 střel/dronů v r. 2022, 7 v r. 2023, žádné v r. 2024, 19 v r. 2025 a téměř 50 v r. 2026. Jednotlivě jsou vypsány jen zásahy s velkým dopadem.",
"zasahy":[
{
"d":"2026-01-09",
"prostredek":"drony a rakety",
"co":"Jeden z největších útoků na kyjevskou energetiku: bez topení zůstalo asi 6 000 bytových domů (téměř polovina města), 417 tisíc domácností bez proudu.",
"dopad":3,
"obnova":"asi 1 týden (17. 1. zbývalo 50 domů)",
"obnovaDni":8,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Independent, 9. 1. 2026",
"url":"https://kyivindependent.com/4-injured-russia-mass-attack-kyiv-lviv/",
"archiv":"http://web.archive.org/web/20260804172713/https://kyivindependent.com/4-injured-russia-mass-attack-kyiv-lviv/",
"citace":null
}
},
{
"d":"2026-02-12",
"prostredek":"drony a rakety",
"co":"TEC-6 na Troješčyně se po dalším zásahu opět zastavila; bez topení téměř 2 600 bytových domů.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Ukrajinska pravda, 12. 2. 2026",
"url":"https://www.pravda.com.ua/eng/news/2026/02/12/8020728/",
"archiv":"http://web.archive.org/web/20260430094023/https://www.pravda.com.ua/eng/news/2026/02/12/8020728/",
"citace":"Nearly 2,600 apartment blocks in the city of Kyiv have been left without heating"
}
},
{
"d":"2026-10-14",
"prostredek":"drony a rakety",
"co":"Noční útok na všechny tři kyjevské teplárny (TEC-4, TEC-5, TEC-6) krátce po vyhlášeném „energetickém příměří“.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"UNN, 14. 10. 2026",
"url":"https://unn.ua/en/news/nearly-50-missiles-and-drones-attacked-the-capitals-combined-heat-and-power-plants-klitschko-said-whether-kyiv-will-have-heating",
"archiv":"http://web.archive.org/web/20261015212355/https://unn.ua/en/news/nearly-50-missiles-and-drones-attacked-the-capitals-combined-heat-and-power-plants-klitschko-said-whether-kyiv-will-have-heating",
"citace":"On the night of October 14, the Russians attacked all three of Kyiv's municipal combined heat and power plants."
}
}
]
},
{
"id":"kyjev_darnycka",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Darnycká teplárna (Kyjev TEC-4)",
"vlastnik":"Euro-Reconstruction (soukromá)",
"misto":"Kyjev, Dniprovský rajón (levý břeh)",
"gps":[
50.448,
30.637
],
"vyznam":"Teplárna pro více než 1 000 domů na levém břehu Kyjeva; v únoru 2026 zničena asi z 90 %.",
"kapacita":{
"hodnota":null,
"jednotka":"MW",
"popis":"výkon nezjištěn",
"historie":[],
"zdroj":null
},
"stav":{
"k":"2026-11-11",
"provoz":"mimo",
"text":"Nevyrábí elektřinu; majitel opravuje na vlastní náklady a prošel restrukturalizací dluhů, náhradní kotelny zatím nejsou spuštěny.",
"zdroj":{
"nazev":"Kyiv Post, 11. 11. 2026",
"url":"https://www.kyivpost.com/post/89802",
"archiv":"http://web.archive.org/web/20261117152605/https://www.kyivpost.com/post/89802",
"citace":null
}
},
"neuplne":"Podle firmy přečkala teplárna za čtyři roky války téměř 20 útoků; vypsány jsou jen hlavní.",
"zasahy":[
{
"d":"2026-02-03",
"prostredek":"rakety",
"co":"Pět balistických raket při −25 °C zničilo tepelnou část; strojovna z velké části zničena (asi 90 % stanice). Nejsilnější úder roku na energetiku.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Ukrinform, 3. 2. 2026",
"url":"https://www.ukrinform.net/rubric-other_news/4087424-darnytska-chp-in-kyiv-temporarily-suspends-operations-following-russian-attack.html",
"archiv":"http://web.archive.org/web/20260308095550/https://www.ukrinform.net/rubric-other_news/4087424-darnytska-chp-in-kyiv-temporarily-suspends-operations-following-russian-attack.html",
"citace":null
}
},
{
"d":"2026-10-14",
"prostredek":"drony a rakety",
"co":"Napadena při nočním útoku na všechny tři kyjevské teplárny; rozsah škod neuveden.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"UNN, 14. 10. 2026",
"url":"https://unn.ua/en/news/nearly-50-missiles-and-drones-attacked-the-capitals-combined-heat-and-power-plants-klitschko-said-whether-kyiv-will-have-heating",
"archiv":"http://web.archive.org/web/20261015212355/https://unn.ua/en/news/nearly-50-missiles-and-drones-attacked-the-capitals-combined-heat-and-power-plants-klitschko-said-whether-kyiv-will-have-heating",
"citace":null
}
}
]
},
{
"id":"charkov_tec5",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Charkovská teplárna TEC-5",
"vlastnik":"Naftogaz Ukrajiny",
"misto":"Podvirky u Charkova",
"gps":[
49.971,
36.101
],
"vyznam":"Jedna z největších tepláren Ukrajiny (elektřina i teplo pro Charkov). Po zničení v březnu 2024 se Charkov stal závislým na dodávkách odjinud.",
"kapacita":{
"hodnota":540,
"jednotka":"MW",
"popis":"elektrický výkon (2 × 120 + 1 × 300 MW), tepelný až 1 650 MW",
"historie":[
[
2024,
0,
"po 22. 3. 2024 mimo provoz"
]
],
"zdroj":{
"nazev":"Wikipedia: Kharkiv TEC-5",
"url":"https://en.wikipedia.org/wiki/Kharkiv_TEC-5",
"archiv":"http://web.archive.org/web/20260531071609/https://en.wikipedia.org/wiki/Kharkiv_TEC-5",
"citace":null
}
},
"stav":{
"k":"2026-11-11",
"provoz":"neznamo",
"text":"Gubernátor Synjehubov: útoky poškodily všechny tepelné elektrárny a teplárny oblasti; TEC-5 opakovaně napadána, opravy probíhají ve třech směnách.",
"zdroj":{
"nazev":"Gwara Media, 11. 11. 2026",
"url":"https://gwaramedia.com/en/kharkiv-region-doesnt-have-undamaged-thermal-power-plants-heat-stations/",
"archiv":"http://web.archive.org/web/20261115151830/https://gwaramedia.com/en/kharkiv-region-doesnt-have-undamaged-thermal-power-plants-heat-stations/",
"citace":null
}
},
"neuplne":"Teplárna byla napadena mnohokrát; jednotlivé zásahy v letech 2025–2026 nejsou úplně doloženy.",
"zasahy":[
{
"d":"2022-09-11",
"prostredek":"rakety",
"co":"Střely Kalibr zasáhly teplárnu během charkovské protiofenzivy; výpadky proudu v Charkově, Dnipru, Sumské a Poltavské oblasti.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"The Guardian, 11. 9. 2022",
"url":"https://www.theguardian.com/world/2022/sep/11/zelenskiy-says-next-three-months-critical-as-ukrainian-advance-continues",
"archiv":null,
"citace":null
}
},
{
"d":"2024-03-22",
"prostredek":"rakety",
"co":"Teplárna byla tak těžce poškozena, že ukončila provoz; ředitel odhadl obnovu na víc než rok.",
"dopad":4,
"obnova":"více než 1 rok",
"obnovaDni":365,
"vypadek":"540 MW",
"overeni":"over",
"zdroj":{
"nazev":"Ukrinform, 2024",
"url":"https://www.ukrinform.ua/rubric-regions/3844538-rekonstrukcia-harkivskoi-tec5-trivatime-ne-odin-rik-direktor.html",
"archiv":"http://web.archive.org/web/20261102062420/https://www.ukrinform.ua/rubric-regions/3844538-rekonstrukcia-harkivskoi-tec5-trivatime-ne-odin-rik-direktor.html",
"citace":null
}
},
{
"d":"2026-10",
"prostredek":"drony a rakety",
"co":"Podle ukrajinské vlády zasažena v říjnu 2026, v době Trumpem ohlášeného „energetického příměří“.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Meduza, 12. 10. 2026",
"url":"https://meduza.io/en/news/2026/10/12/zelensky-says-ukrainian-military-received-all-relevant-orders-over-energy-truce-announced-by-trump",
"archiv":"http://web.archive.org/web/20261012180208/https://meduza.io/en/news/2026/10/12/zelensky-says-ukrainian-military-received-all-relevant-orders-over-energy-truce-announced-by-trump",
"citace":null
}
},
{
"d":"2026-10",
"prostredek":"drony a rakety",
"co":"V týdnu do 21. 10. znovu napadena drony a raketami Banderol (spolu s TEC-3 a Zmijivskou TPP).",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"odhad",
"zdroj":{
"nazev":"Gwara Media, 21. 10. 2026",
"url":"https://gwaramedia.com/en/russian-forces-attack-3-thermal-power-stations-in-kharkiv-oblast-in-a-week/",
"archiv":null,
"citace":null
}
}
]
},
{
"id":"charkov_tec3",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Charkovská teplárna TEC-3",
"vlastnik":null,
"misto":"Charkov",
"gps":null,
"vyznam":"Teplárna přímo v Charkově, opakovaně napadaná.",
"kapacita":{
"hodnota":null,
"jednotka":"MW",
"popis":"výkon nezjištěn",
"historie":[],
"zdroj":null
},
"stav":{
"k":"2026-11-11",
"provoz":"neznamo",
"text":"Gubernátor uvádí, že všechny teplárny oblasti jsou poškozené; konkrétní stav TEC-3 nezveřejněn.",
"zdroj":{
"nazev":"Gwara Media, 11. 11. 2026",
"url":"https://gwaramedia.com/en/kharkiv-region-doesnt-have-undamaged-thermal-power-plants-heat-stations/",
"archiv":"http://web.archive.org/web/20261115151830/https://gwaramedia.com/en/kharkiv-region-doesnt-have-undamaged-thermal-power-plants-heat-stations/",
"citace":null
}
},
"neuplne":"Dřívější zásahy (např. únor 2026, kdy jedna velká charkovská teplárna utrpěla těžké škody) nelze bezpečně přiřadit konkrétní teplárně.",
"zasahy":[
{
"d":"2026-10",
"prostredek":"drony a rakety",
"co":"V týdnu do 21. 10. napadena drony a raketami Banderol.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"odhad",
"zdroj":{
"nazev":"Gwara Media, 21. 10. 2026",
"url":"https://gwaramedia.com/en/russian-forces-attack-3-thermal-power-stations-in-kharkiv-oblast-in-a-week/",
"archiv":null,
"citace":null
}
}
]
},
{
"id":"ochtyrka_tec",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Ochtyrská teplárna",
"vlastnik":null,
"misto":"Ochtyrka, Sumská oblast",
"gps":[
50.317,
34.877
],
"vyznam":"Jediný zdroj elektřiny a tepla města; jedna z prvních elektráren zničených v plné válce.",
"kapacita":{
"hodnota":null,
"jednotka":"MW",
"popis":"výkon nezjištěn",
"historie":[],
"zdroj":null
},
"stav":{
"k":"2022-07",
"provoz":"zniceno",
"text":"Zničena leteckými pumami 3. 3. 2022; město mělo ještě v červenci 2022 vážné problémy s dodávkami.",
"zdroj":{
"nazev":"Interfax-Ukraine, 4. 3. 2022",
"url":"https://en.interfax.com.ua/news/general/806835.html",
"archiv":"http://web.archive.org/web/20260517205432/https://en.interfax.com.ua/news/general/806835.html",
"citace":null
}
},
"neuplne":null,
"zasahy":[
{
"d":"2022-03-03",
"prostredek":"letecké pumy",
"co":"Ruské letouny zbombardovaly teplárnu; strojovna zcela zničena, město bez tepla a elektřiny.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Interfax-Ukraine, 4. 3. 2022",
"url":"https://en.interfax.com.ua/news/general/806835.html",
"archiv":"http://web.archive.org/web/20260517205432/https://en.interfax.com.ua/news/general/806835.html",
"citace":"The engine room was completely bombed. There is no heating, no electricity in the city."
}
}
]
},
{
"id":"cernihiv_tec",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Černihivská teplárna",
"vlastnik":"Teplokomunenergo (město Černihiv)",
"misto":"Černihiv",
"gps":[
51.452,
31.266
],
"vyznam":"Vytápí víc než 40 % bytového fondu Černihiva.",
"kapacita":{
"hodnota":220,
"jednotka":"MW",
"popis":"elektrický výkon nejméně 220 MW",
"historie":[],
"zdroj":{
"nazev":"Global Energy Monitor: Chernihiv power station",
"url":"https://www.gem.wiki/Chernihiv_power_station",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2026-04-17",
"provoz":"neznamo",
"text":"Po útoku 17. 4. 2026 dočasně zastavena, město bez teplé vody; novější stav nezjištěn.",
"zdroj":{
"nazev":"Ukrajinska pravda, 17. 4. 2026",
"url":"https://www.pravda.com.ua/eng/news/2026/04/17/8030554/",
"archiv":"http://web.archive.org/web/20260430094719/https://www.pravda.com.ua/eng/news/2026/04/17/8030554/",
"citace":null
}
},
"neuplne":"Na jaře 2022 poškozena dělostřelectvem a nálety, v září 2025 drony; vypsán jen doložený zásah z dubna 2026.",
"zasahy":[
{
"d":"2026-04-17",
"prostredek":"drony",
"co":"Noční útok teplárnu zastavil; bez teplé vody celé město, 6 000 odběratelů bez proudu.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Ukrajinska pravda, 17. 4. 2026",
"url":"https://www.pravda.com.ua/eng/news/2026/04/17/8030554/",
"archiv":"http://web.archive.org/web/20260430094719/https://www.pravda.com.ua/eng/news/2026/04/17/8030554/",
"citace":null
}
}
]
},
{
"id":"dniprohes",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Dněperská vodní elektrárna (DniproHES)",
"vlastnik":"Ukrhydroenergo (státní)",
"misto":"Záporoží",
"gps":[
47.869,
35.087
],
"vyznam":"Největší vodní elektrárna Ukrajiny a hráz, přes kterou vede silnice; klíčová pro regulaci soustavy. Od roku 2024 nevyrábí.",
"kapacita":{
"hodnota":1578.6,
"jednotka":"MW",
"popis":"instalovaný výkon (HES-1 a HES-2)",
"historie":[
[
2021,
1578.6,
"instalovaný výkon"
],
[
2024,
0,
"po březnu–červnu 2024 nevyrábí"
]
],
"zdroj":{
"nazev":"Wikipedia: Dnieper Hydroelectric Station",
"url":"https://en.wikipedia.org/wiki/Dnieper_Hydroelectric_Station",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2025-03-06",
"provoz":"mimo",
"text":"Gubernátor Fedorov: energetická část nefunguje a nelze ji obnovit; Ukrhydroenergo počítá s obnovou nejméně tři roky. Do března 2025 46 zásahů do strojoven.",
"zdroj":{
"nazev":"Ukrinform, 6. 3. 2025",
"url":"https://www.ukrinform.net/rubric-ato/3967739-russia-launches-nearly-50-attacks-on-dniprohes-since-start-of-fullscale-war.html",
"archiv":"http://web.archive.org/web/20260514231302/https://www.ukrinform.net/rubric-ato/3967739-russia-launches-nearly-50-attacks-on-dniprohes-since-start-of-fullscale-war.html",
"citace":"The energy component is non-functional and cannot be restored"
}
},
"neuplne":"Do března 2025 46 zásahů; vypsány jsou jen ty s doloženým velkým dopadem.",
"zasahy":[
{
"d":"2024-03-22",
"prostredek":"rakety",
"co":"Osm raket, dva přímé zásahy HES-2 (kritický stav) a zásah HES-1; hořel trolejbus na hrázi. Ukrhydroenergo ztratilo asi 20 % regulační kapacity, hráz se neprotrhla.",
"dopad":4,
"obnova":"roky",
"obnovaDni":null,
"vypadek":"asi třetina výkonu elektrárny, ~20 % regulačního výkonu Ukrhydroenergo",
"overeni":"over",
"zdroj":{
"nazev":"Ukrajinska pravda, 23. 3. 2024",
"url":"https://www.pravda.com.ua/eng/news/2024/03/23/7447802/",
"archiv":"http://web.archive.org/web/20260505003150/https://www.pravda.com.ua/eng/news/2024/03/23/7447802/",
"citace":null
}
},
{
"d":"2024-04-12",
"prostredek":"drony",
"co":"Drony zapálily hráz, do Dněpru uniklo asi půl tuny ropných látek.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters, 12. 4. 2024",
"url":"https://www.reuters.com/world/europe/ukraine-says-russian-drones-damage-energy-infrastructure-south-2024-04-12/",
"archiv":null,
"citace":null
}
},
{
"d":"2024-06-01",
"prostredek":"rakety",
"co":"Další útok; elektrárna v „kritickém stavu“ a nevyrábí.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Independent, 1. 6. 2024",
"url":"https://kyivindependent.com/governor-ukraines-largest-hydroelectric-power-plant-in-critical-state-following-russian-strike/",
"archiv":"http://web.archive.org/web/20260414235300/https://kyivindependent.com/governor-ukraines-largest-hydroelectric-power-plant-in-critical-state-following-russian-strike/",
"citace":null
}
}
]
},
{
"id":"kachovska_hes",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Kachovská vodní elektrárna",
"vlastnik":"Ukrhydroenergo (státní)",
"misto":"Nova Kachovka, Chersonská oblast",
"gps":[
46.776,
33.372
],
"vyznam":"Hráz s elektrárnou na dolním Dněpru; její zničení v červnu 2023 vyvolalo velké záplavy a vypustilo nádrž, ze které se chladila Záporožská JE.",
"kapacita":{
"hodnota":357,
"jednotka":"MW",
"popis":"instalovaný výkon",
"historie":[
[
2021,
357,
"instalovaný výkon"
],
[
2023,
0,
"zničena"
]
],
"zdroj":{
"nazev":"Wikipedia: Kakhovka Dam",
"url":"https://en.wikipedia.org/wiki/Kakhovka_Dam",
"archiv":"http://web.archive.org/web/20261019212240/https://en.wikipedia.org/wiki/Kakhovka_Dam",
"citace":null
}
},
"stav":{
"k":"2026-11-26",
"provoz":"zniceno",
"text":"Zničena 6. 6. 2023; obnova podle Ukrhydroenergo nejméně pět let a asi 1 mld. USD, nemožná během okupace levého břehu.",
"zdroj":{
"nazev":"Wikipedia: Kakhovka Dam",
"url":"https://en.wikipedia.org/wiki/Kakhovka_Dam",
"archiv":"http://web.archive.org/web/20261019212240/https://en.wikipedia.org/wiki/Kakhovka_Dam",
"citace":null
}
},
"neuplne":null,
"zasahy":[
{
"d":"2022-02-24",
"prostredek":"jiné",
"co":"Ruská vojska elektrárnu obsadila hned první den invaze.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":"357 MW",
"overeni":"over",
"zdroj":{
"nazev":"Wikipedia: Kakhovka Dam",
"url":"https://en.wikipedia.org/wiki/Kakhovka_Dam",
"archiv":"http://web.archive.org/web/20261019212240/https://en.wikipedia.org/wiki/Kakhovka_Dam",
"citace":null
}
},
{
"d":"2022-11-11",
"prostredek":"sabotáž",
"co":"Silný výbuch při ústupu ruských vojsk z Chersonu zničil silniční a železniční část hráze.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"odhad",
"zdroj":{
"nazev":"Wikipedia: Kakhovka Dam",
"url":"https://en.wikipedia.org/wiki/Kakhovka_Dam",
"archiv":"http://web.archive.org/web/20261019212240/https://en.wikipedia.org/wiki/Kakhovka_Dam",
"citace":null
}
},
{
"d":"2023-06-06",
"prostredek":"sabotáž",
"co":"Vnitřní výbuch zničil střední část hráze; přes 50 mrtvých, zaplaveno přes 40 obcí. Rusko odpovědnost popírá, NYT a experti ukazují na nálož ze strany, která hráz ovládala.",
"dopad":4,
"obnova":"nejméně 5 let",
"obnovaDni":1825,
"vypadek":"357 MW (již dříve okupována)",
"overeni":"odhad",
"zdroj":{
"nazev":"Wikipedia: Kakhovka Dam",
"url":"https://en.wikipedia.org/wiki/Kakhovka_Dam",
"archiv":"http://web.archive.org/web/20261019212240/https://en.wikipedia.org/wiki/Kakhovka_Dam",
"citace":"clearly suggests the dam was crippled by an explosion set off by the side that controls it: Russia."
}
}
]
},
{
"id":"kanivska_hes",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Kanivská vodní elektrárna",
"vlastnik":"Ukrhydroenergo (státní)",
"misto":"Kaniv, Čerkaská oblast",
"gps":[
49.767,
31.472
],
"vyznam":"Vodní elektrárna na Dněpru, slouží k vyrovnávání výkonu v soustavě.",
"kapacita":{
"hodnota":444,
"jednotka":"MW",
"popis":"instalovaný výkon",
"historie":[],
"zdroj":{
"nazev":"Wikipedia: List of power stations in Ukraine",
"url":"https://en.wikipedia.org/wiki/List_of_power_stations_in_Ukraine",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2025",
"provoz":"bezi",
"text":"Po útocích v roce 2024 pokračovala v provozu; EIB v roce 2025 půjčila Ukrhydroenergo 120 mil. € mj. na její obnovu.",
"zdroj":{
"nazev":"Wikipedia: List of power stations in Ukraine",
"url":"https://en.wikipedia.org/wiki/List_of_power_stations_in_Ukraine",
"archiv":null,
"citace":null
}
},
"neuplne":"Rozsah škod z 29. 3. 2024 ani případné pozdější zásahy nejsou veřejně popsány.",
"zasahy":[
{
"d":"2024-03-29",
"prostredek":"rakety",
"co":"Zelenskyj: Rusko záměrně mířilo na Kanivskou a Dněsterskou VE, aby zopakovalo katastrofu Kachovky; rozsah škod neuveden.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"RBC-Ukraine, 11. 4. 2024",
"url":"https://newsukraine.rbc.ua/news/attack-on-power-generation-what-is-difference-1712861455.html",
"archiv":"http://web.archive.org/web/20260614101257/https://newsukraine.rbc.ua/news/attack-on-power-generation-what-is-difference-1712861455.html",
"citace":null
}
}
]
},
{
"id":"kremencucka_hes",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Kremenčucká vodní elektrárna",
"vlastnik":"Ukrhydroenergo (státní)",
"misto":"Svitlovodsk, Kirovohradská oblast",
"gps":[
49.078,
33.251
],
"vyznam":"Hráz největší nádrže Dněperské kaskády; v roce 2024 dostala protidronovou ochranu.",
"kapacita":{
"hodnota":624,
"jednotka":"MW",
"popis":"instalovaný výkon (12 × 52 MW)",
"historie":[],
"zdroj":{
"nazev":"Wikipedia: Kremenchuk Hydroelectric Power Plant",
"url":"https://en.wikipedia.org/wiki/Kremenchuk_Hydroelectric_Power_Plant",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2025-11-12",
"provoz":"castecne",
"text":"Po útoku 8. 11. 2025 dozorčí rada Ukrhydroenergo zjišťovala rozsah škod a postup obnovy; novější stav nezveřejněn.",
"zdroj":{
"nazev":"Ukrhydroenergo, listopad 2025",
"url":"https://en.uhe.gov.ua/news/kremenchuk-hpp-ukrhydroenergo-supervisory-board-inspected-facility-after-recent-attack",
"archiv":"http://web.archive.org/web/20260402084918/https://en.uhe.gov.ua/news/kremenchuk-hpp-ukrhydroenergo-supervisory-board-inspected-facility-after-recent-attack",
"citace":null
}
},
"neuplne":"Zásah v listopadu 2024 (zmiňovaný v přehledech) jsme nedoložili samostatnou zprávou.",
"zasahy":[
{
"d":"2022-10-31",
"prostredek":"rakety",
"co":"Při masivním raketovém útoku zaznamenán zásah v areálu elektrárny.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"ZN.ua, 31. 10. 2022",
"url":"https://zn.ua/ukr/ECONOMICS/rf-zavdala-udariv-po-trokh-hes.html",
"archiv":"http://web.archive.org/web/20250214173528/https://zn.ua/ukr/ECONOMICS/rf-zavdala-udariv-po-trokh-hes.html",
"citace":null
}
},
{
"d":"2025-11-08",
"prostredek":"drony a rakety",
"co":"Asi 15 zásahů drony a dva raketami; hořely dva transformátory.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Ukrhydroenergo, listopad 2025",
"url":"https://en.uhe.gov.ua/news/kremenchuk-hpp-ukrhydroenergo-supervisory-board-inspected-facility-after-recent-attack",
"archiv":"http://web.archive.org/web/20260402084918/https://en.uhe.gov.ua/news/kremenchuk-hpp-ukrhydroenergo-supervisory-board-inspected-facility-after-recent-attack",
"citace":null
}
}
]
},
{
"id":"dnesterska_hes",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Dněsterská vodní elektrárna",
"vlastnik":"Ukrhydroenergo (státní)",
"misto":"Novodnistrovsk, Černovická oblast",
"gps":[
48.593,
27.455
],
"vyznam":"Vodní elektrárna na Dněstru u hranic s Moldavskem; z řeky pod ní bere vodu Moldavsko.",
"kapacita":{
"hodnota":702,
"jednotka":"MW",
"popis":"instalovaný výkon (6 × 117 MW), vedle stojí přečerpávací elektrárna 1 296 MW",
"historie":[],
"zdroj":{
"nazev":"Wikipedia: Dniester Hydroelectric Station",
"url":"https://en.wikipedia.org/wiki/Dniester_Hydroelectric_Station",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2026-03-16",
"provoz":"neznamo",
"text":"Po zásahu v březnu 2026 unikl olej do Dněstru a Moldavsko vyhlásilo 15denní ekologický poplach; stav výroby nezveřejněn.",
"zdroj":{
"nazev":"Kyiv Independent, 16. 3. 2026",
"url":"https://kyivindependent.com/russian-strike-on-ukraine-hydropower-plant-spills-oil-into-dniester-river-threatening-moldovas-water-supply/",
"archiv":"http://web.archive.org/web/20260818134303/https://kyivindependent.com/russian-strike-on-ukraine-hydropower-plant-spills-oil-into-dniester-river-threatening-moldovas-water-supply/",
"citace":null
}
},
"neuplne":null,
"zasahy":[
{
"d":"2022-10-31",
"prostredek":"rakety",
"co":"Potvrzený zásah raketou v areálu elektrárny.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"ZN.ua, 31. 10. 2022",
"url":"https://zn.ua/ukr/ECONOMICS/rf-zavdala-udariv-po-trokh-hes.html",
"archiv":"http://web.archive.org/web/20250214173528/https://zn.ua/ukr/ECONOMICS/rf-zavdala-udariv-po-trokh-hes.html",
"citace":null
}
},
{
"d":"2024-03-29",
"prostredek":"rakety",
"co":"Raketový útok na elektrárnu (Zelenskyj: záměrný cíl); rozsah škod neuveden.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"RBC-Ukraine, 11. 4. 2024",
"url":"https://newsukraine.rbc.ua/news/attack-on-power-generation-what-is-difference-1712861455.html",
"archiv":"http://web.archive.org/web/20260614101257/https://newsukraine.rbc.ua/news/attack-on-power-generation-what-is-difference-1712861455.html",
"citace":null
}
},
{
"d":"2026-03",
"prostredek":"rakety",
"co":"Zásah způsobil únik oleje do Dněstru; Moldavsko vyhlásilo ekologický poplach kvůli ohrožení pitné vody.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Independent, 16. 3. 2026",
"url":"https://kyivindependent.com/russian-strike-on-ukraine-hydropower-plant-spills-oil-into-dniester-river-threatening-moldovas-water-supply/",
"archiv":"http://web.archive.org/web/20260818134303/https://kyivindependent.com/russian-strike-on-ukraine-hydropower-plant-spills-oil-into-dniester-river-threatening-moldovas-water-supply/",
"citace":null
}
}
]
},
{
"id":"kyjevska_hes",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Kyjevská vodní elektrárna",
"vlastnik":"Ukrhydroenergo (státní)",
"misto":"Vyšhorod u Kyjeva",
"gps":[
50.588,
30.512
],
"vyznam":"Hráz nad Kyjevem s vodní elektrárnou; zásah by ohrozil hlavní město záplavou, proto je chráněna.",
"kapacita":{
"hodnota":418.8,
"jednotka":"MW",
"popis":"instalovaný výkon",
"historie":[],
"zdroj":{
"nazev":"Wikipedia: Kyiv Hydroelectric Power Plant",
"url":"https://en.wikipedia.org/wiki/Kyiv_Hydroelectric_Power_Plant",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2024-08-26",
"provoz":"bezi",
"text":"Po útoku v srpnu 2024 pokračovala v provozu, hráz nebyla ohrožena.",
"zdroj":{
"nazev":"Wikipedia: List of power stations in Ukraine",
"url":"https://en.wikipedia.org/wiki/List_of_power_stations_in_Ukraine",
"archiv":null,
"citace":null
}
},
"neuplne":null,
"zasahy":[
{
"d":"2024-08-26",
"prostredek":"drony a rakety",
"co":"Při masivním útoku zasažena jedna z hrází a energetické zařízení; nebezpečí protržení nehrozilo.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Independent, 26. 8. 2024",
"url":"https://kyivindependent.com/kyiv-hydroelectric-dam-hit-during-massive-russian-attack-across-ukraine/",
"archiv":"http://web.archive.org/web/20260714195151/https://kyivindependent.com/kyiv-hydroelectric-dam-hit-during-massive-russian-attack-across-ukraine/",
"citace":"The attack hit one of the hydroelectric dams."
}
}
]
},
{
"id":"zaporizka_je",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Záporožská jaderná elektrárna",
"vlastnik":"Energoatom (od března 2022 pod ruskou okupací, Rosatom si ji přivlastnil)",
"misto":"Enerhodar, Záporožská oblast (okupováno)",
"gps":[
47.509,
34.584
],
"vyznam":"Největší jaderná elektrárna Evropy (6 × 1 000 MW). Okupace vzala Ukrajině 6 GW; opakované výpadky vnějšího napájení ohrožují chlazení reaktorů.",
"kapacita":{
"hodnota":6000,
"jednotka":"MW",
"popis":"instalovaný výkon 6 reaktorů",
"historie":[
[
2021,
6000,
"instalovaný výkon"
],
[
2022,
0,
"od 11. 9. 2022 všechny reaktory odstaveny"
]
],
"zdroj":{
"nazev":"IEA: Ukraine's energy system under attack",
"url":"https://www.iea.org/reports/ukraines-energy-security-and-the-coming-winter/ukraines-energy-system-under-attack",
"archiv":"http://web.archive.org/web/20261116102514/https://www.iea.org/reports/ukraines-energy-security-and-the-coming-winter/ukraines-energy-system-under-attack",
"citace":"reduced available Ukrainian power generation capacity by 6 gigawatts (GW)"
}
},
"stav":{
"k":"2026-11-25",
"provoz":"mimo",
"text":"Všech šest reaktorů je odstaveno. 25. 11. 2026 elektrárna po 28. ztratila veškeré vnější napájení a jede na dieselgenerátory; hlavní linka 750 kV je odpojená od března 2026.",
"zdroj":{
"nazev":"h.ua, 25. 11. 2026",
"url":"https://en.h.ua/2026/11/25/zaporizhzhia-nuclear-plant-loses-external-power",
"archiv":"http://web.archive.org/web/20261125214639/https://en.h.ua/2026/11/25/zaporizhzhia-nuclear-plant-loses-external-power",
"citace":null
}
},
"neuplne":"Výpadků vnějšího napájení bylo 28 (17 jen v roce 2026); vypsány jsou ty nejvýznamnější. Údery dronů na budovy reaktorů (7. 4. 2024, 11. 8. 2024 chladicí věž, 30. 5. 2026) MAAE nikomu nepřipsala, obě strany se obviňují – nejsou zahrnuty.",
"zasahy":[
{
"d":"2022-03-04",
"prostredek":"dělostřelectvo",
"co":"Ruská vojska elektrárnu po boji o Enerhodar dobyla; při ostřelování vznikl požár v areálu.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":"6 000 MW pro Ukrajinu ztraceno",
"overeni":"over",
"zdroj":{
"nazev":"Wikipedia: Zaporizhzhia Nuclear Power Plant crisis",
"url":"https://en.wikipedia.org/wiki/Zaporizhzhia_Nuclear_Power_Plant_crisis",
"archiv":"http://web.archive.org/web/20261019071919/https://en.wikipedia.org/wiki/Zaporizhzhia_Nuclear_Power_Plant_crisis",
"citace":null
}
},
{
"d":"2022-08-25",
"prostredek":"dělostřelectvo",
"co":"Požár přerušil poslední linku 750 kV – elektrárna byla poprvé od roku 1985 odpojena od sítě.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedia: Zaporizhzhia Nuclear Power Plant crisis",
"url":"https://en.wikipedia.org/wiki/Zaporizhzhia_Nuclear_Power_Plant_crisis",
"archiv":"http://web.archive.org/web/20261019071919/https://en.wikipedia.org/wiki/Zaporizhzhia_Nuclear_Power_Plant_crisis",
"citace":null
}
},
{
"d":"2022-09-11",
"prostredek":"dělostřelectvo",
"co":"Po opakovaném ostřelování odstaven i šestý, poslední reaktor; elektrárna od té doby nevyrábí.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":"6 000 MW",
"overeni":"over",
"zdroj":{
"nazev":"Wikipedia: Zaporizhzhia Nuclear Power Plant crisis",
"url":"https://en.wikipedia.org/wiki/Zaporizhzhia_Nuclear_Power_Plant_crisis",
"archiv":"http://web.archive.org/web/20261019071919/https://en.wikipedia.org/wiki/Zaporizhzhia_Nuclear_Power_Plant_crisis",
"citace":null
}
},
{
"d":"2023-06-06",
"prostredek":"sabotáž",
"co":"Zničení Kachovské hráze vypustilo nádrž, hlavní zdroj chladicí vody; náhradou byly vyvrtány studny.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"odhad",
"zdroj":{
"nazev":"Wikipedia: Zaporizhzhia Nuclear Power Plant crisis",
"url":"https://en.wikipedia.org/wiki/Zaporizhzhia_Nuclear_Power_Plant_crisis",
"archiv":"http://web.archive.org/web/20261019071919/https://en.wikipedia.org/wiki/Zaporizhzhia_Nuclear_Power_Plant_crisis",
"citace":null
}
},
{
"d":"2025-09-23",
"prostredek":"jiné",
"co":"Desátý a nejdelší úplný výpadek vnějšího napájení: přerušena poslední linka 750 kV, elektrárna měsíc jela na dieselgenerátory; opraveno až díky místnímu příměří zprostředkovanému MAAE.",
"dopad":3,
"obnova":"30 dní",
"obnovaDni":30,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"World Nuclear News, 23. 10. 2025",
"url":"https://world-nuclear-news.org/articles/external-power-restored-to-zaporizhzhia-nuclear-plant-after-30-days",
"archiv":"http://web.archive.org/web/20260420165712/https://www.world-nuclear-news.org/articles/external-power-restored-to-zaporizhzhia-nuclear-plant-after-30-days",
"citace":"After exactly one month without any offsite power"
}
},
{
"d":"2026-04-16",
"prostredek":"jiné",
"co":"Po odpojení hlavní linky 750 kV (od 24. 3. 2026) ztratila elektrárna v jednom týdnu dvakrát veškeré vnější napájení (13. a 14. výpadek).",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"MAAE Update 347, 17. 4. 2026",
"url":"https://www.iaea.org/newscenter/pressreleases/update-347-iaea-director-general-statement-on-situation-in-ukraine",
"archiv":"http://web.archive.org/web/20261001172006/https://www.iaea.org/newscenter/pressreleases/update-347-iaea-director-general-statement-on-situation-in-ukraine",
"citace":"the ZNPP lost all off-site power for the 14th time"
}
},
{
"d":"2026-08-20",
"prostredek":"jiné",
"co":"Odpojena jediná záložní linka 330 kV Ferosplavna-1; elektrárna téměř tři týdny na dieselgenerátorech, MAAE varovala před úplným blackoutem.",
"dopad":3,
"obnova":"asi 3 týdny",
"obnovaDni":19,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Arms Control Association, září 2026",
"url":"https://www.armscontrol.org/act/2026-09/news/outages-rising-zaporizhzhia-power-plant",
"archiv":"http://web.archive.org/web/20260909171114/https://www.armscontrol.org/act/2026-09/news/outages-rising-zaporizhzhia-power-plant",
"citace":null
}
},
{
"d":"2026-11-08",
"prostredek":"jiné",
"co":"27. úplný výpadek vnějšího napájení, obnoveno po 10 hodinách; nafta jen asi na dva týdny provozu dieselů.",
"dopad":2,
"obnova":"10 hodin",
"obnovaDni":1,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Anadolu, 8. 11. 2026",
"url":"https://www.aa.com.tr/en/world/ukraines-zaporizhzhya-nuclear-plant-loses-all-external-power-for-27th-time-un-nuclear-watchdog/4115903",
"archiv":"http://web.archive.org/web/20261110171623/https://www.aa.com.tr/en/world/ukraines-zaporizhzhya-nuclear-plant-loses-all-external-power-for-27th-time-un-nuclear-watchdog/4115903",
"citace":"It is the 27th such event during the conflict"
}
},
{
"d":"2026-11-25",
"prostredek":"dělostřelectvo",
"co":"28. úplný výpadek: odpojena jediná linka Ferosplavna-1, podle ukrajinské strany kvůli ruskému ostřelování pravého břehu; jede na dieselgenerátory.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Post, 25. 11. 2026",
"url":"https://www.kyivpost.com/post/91160",
"archiv":null,
"citace":null
}
}
]
},
{
"id":"cernobyl",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Černobylská jaderná elektrárna (Nový bezpečný kryt)",
"vlastnik":"ChNPP (státní podnik)",
"misto":"Černobylská zóna, Kyjevská oblast",
"gps":[
51.39,
30.099
],
"vyznam":"Elektrárna je od roku 2000 mimo provoz; Nový bezpečný kryt (oblouk za 1,5 mld. €) uzavírá zničený 4. reaktor z roku 1986.",
"kapacita":{
"hodnota":null,
"jednotka":"MW",
"popis":"nevyrábí (vyřazena z provozu 2000; historicky 4 × 1 000 MW)",
"historie":[],
"zdroj":{
"nazev":"Wikipedia: List of power stations in Ukraine",
"url":"https://en.wikipedia.org/wiki/List_of_power_stations_in_Ukraine",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2026-09-16",
"provoz":"castecne",
"text":"Kryt podle MAAE ztratil základní bezpečnostní funkci (těsnost), nosná konstrukce nepoškozena; díra v plášti dočasně zakryta, úplná oprava za asi 500 mil. € se plánuje do roku 2030.",
"zdroj":{
"nazev":"World Nuclear News, 2026",
"url":"https://www.world-nuclear-news.org/articles/assessment-completed-of-chernobyl-shelter-repair-works",
"archiv":"http://web.archive.org/web/20260728212614/https://world-nuclear-news.org/articles/assessment-completed-of-chernobyl-shelter-repair-works",
"citace":null
}
},
"neuplne":"Okupace elektrárny (24. 2. – 31. 3. 2022) a výpadky napájení areálu po útocích na síť (např. říjen 2025) nejsou rozepsány.",
"zasahy":[
{
"d":"2025-02-14",
"prostredek":"drony",
"co":"Dron s výbušnou hlavicí prorazil vnější i vnitřní plášť krytu a založil doutnající požár (hašen do 7. 3.). Radiace se nezvýšila, ale kryt ztratil těsnicí funkci.",
"dopad":4,
"obnova":"do roku 2030",
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"MAAE Update 275, 14. 2. 2025",
"url":"https://www.iaea.org/newscenter/pressreleases/update-275-iaea-director-general-statement-on-situation-in-ukraine",
"archiv":"http://web.archive.org/web/20261116213014/https://www.iaea.org/newscenter/pressreleases/update-275-iaea-director-general-statement-on-situation-in-ukraine",
"citace":null
}
}
]
},
{
"id":"chmelnycka_je",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Chmelnycká jaderná elektrárna",
"vlastnik":"Energoatom (státní)",
"misto":"Netišyn, Chmelnycká oblast",
"gps":[
50.305,
26.645
],
"vyznam":"Jaderné elektrárny dnes dávají většinu ukrajinské elektřiny. Rusko je přímo neostřeluje, ale útočí na rozvodny 750 kV, přes které vyvádějí výkon a dostávají napájení pro chlazení.",
"kapacita":{
"hodnota":2000,
"jednotka":"MW",
"popis":"instalovaný výkon (2 bloky VVER-1000)",
"historie":[],
"zdroj":{
"nazev":"Wikipedia: List of power stations in Ukraine",
"url":"https://en.wikipedia.org/wiki/List_of_power_stations_in_Ukraine",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2026-11-18",
"provoz":"bezi",
"text":"Grossi 18. 11. 2026: bezpečnostní systémy fungují a elektrárna vyrábí; rozvodny napájející Chmelnyckou a Rivenskou JE byly ale za dva týdny napadeny 12krát.",
"zdroj":{
"nazev":"ANS Nuclear Newswire, 19. 11. 2026",
"url":"https://www.ans.org/news/2026-11-19/article-8592/iaea-grossi-give-updates-on-ukraine-iran-north-korea-nuclear-power-growth-projections/",
"archiv":null,
"citace":null
}
},
"neuplne":"MAAE hlásí snížení výkonu po útocích na rozvodny desítkykrát; vypsány jsou hlavní případy.",
"zasahy":[
{
"d":"2024-11-28",
"prostredek":"drony a rakety",
"co":"Po masivním útoku na rozvodny snížilo výkon všech devět provozovaných reaktorů na Ukrajině.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"RBC-Ukraine, 29. 11. 2024",
"url":"https://newsukraine.rbc.ua/news/massive-russian-strike-cuts-power-output-1732847370.html",
"archiv":"http://web.archive.org/web/20260810012646/https://newsukraine.rbc.ua/news/massive-russian-strike-cuts-power-output-1732847370.html",
"citace":null
}
},
{
"d":"2025-11-07",
"prostredek":"drony a rakety",
"co":"Zásah rozvodny kritické pro jadernou bezpečnost odpojil Chmelnyckou i Rivenskou JE od jedné ze dvou linek 750 kV; obě jely asi deset dní se sníženým výkonem.",
"dopad":2,
"obnova":"asi 10 dní",
"obnovaDni":10,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Ukrinform, listopad 2025",
"url":"https://www.ukrinform.net/rubric-ato/4059790-two-ukrainian-nuclear-power-plants-reduce-output-after-russian-attack-iaea.html",
"archiv":null,
"citace":null
}
},
{
"d":"2025-11-19",
"prostredek":"drony a rakety",
"co":"Čtyři z devíti reaktorů (Chmelnycká, Rivenská, Jihoukrajinská) snížily výkon, každá elektrárna ztratila vysokonapěťovou linku.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"RBC-Ukraine, 20. 11. 2025",
"url":"https://newsukraine.rbc.ua/news/three-ukrainian-nuclear-plants-reduce-output-1763642662.html",
"archiv":"http://web.archive.org/web/20260509164537/https://newsukraine.rbc.ua/news/three-ukrainian-nuclear-plants-reduce-output-1763642662.html",
"citace":null
}
},
{
"d":"2025-12",
"prostredek":"drony a rakety",
"co":"Cílené útoky na rozvodny donutily Chmelnyckou a Rivenskou JE snížit výkon (Grossi na síti X).",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"UNN, prosinec 2025",
"url":"https://unn.ua/en/amp/russian-attacks-on-substations-forced-khmelnytskyi-and-rivne-npps-to-reduce-capacity-iaea",
"archiv":"http://web.archive.org/web/20260428010420/https://unn.ua/en/amp/russian-attacks-on-substations-forced-khmelnytskyi-and-rivne-npps-to-reduce-capacity-iaea",
"citace":null
}
},
{
"d":"2026-02",
"prostredek":"drony a rakety",
"co":"Všechny reaktorové bloky Ukrajiny kromě jednoho musely snížit výkon, odpojeno několik vnějších linek; personál v Chmelnycké a Rivenské JE se ukrýval.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"MAAE Update 340 (GlobalSecurity), 12. 2. 2026",
"url":"https://www.globalsecurity.org/wmd/library/news/ukraine/2026/02/ukraine-260212-iaea01.htm",
"archiv":null,
"citace":null
}
},
{
"d":"2026-11-03",
"prostredek":"drony",
"co":"Tři drony mířily na rozvodnu kritickou pro stabilní provoz Chmelnycké JE; ministr Šmyhal informoval MAAE.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Independent, 3. 11. 2026",
"url":"https://kyivindependent.com/russia-unleashes-biggest-mass-attack-on-ukraines-energy-this-year-2/",
"archiv":"http://web.archive.org/web/20261113001436/https://kyivindependent.com/russia-unleashes-biggest-mass-attack-on-ukraines-energy-this-year-2/",
"citace":"Such actions pose a threat not only to Ukraine but also to the nuclear safety of all of Europe."
}
}
]
},
{
"id":"rivenska_je",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Rivenská jaderná elektrárna",
"vlastnik":"Energoatom (státní)",
"misto":"Varaš, Rivenská oblast",
"gps":[
51.325,
25.897
],
"vyznam":"Největší provozovaná jaderná elektrárna pod kontrolou Ukrajiny; ohrožují ji útoky na rozvodny, přes které vyvádí výkon.",
"kapacita":{
"hodnota":2819,
"jednotka":"MW",
"popis":"instalovaný výkon (4 bloky)",
"historie":[],
"zdroj":{
"nazev":"Wikipedia: List of power stations in Ukraine",
"url":"https://en.wikipedia.org/wiki/List_of_power_stations_in_Ukraine",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2026-11-18",
"provoz":"bezi",
"text":"Grossi 18. 11. 2026: bezpečnostní systémy fungují a elektrárna vyrábí (mimo bloky v plánované odstávce).",
"zdroj":{
"nazev":"ANS Nuclear Newswire, 19. 11. 2026",
"url":"https://www.ans.org/news/2026-11-19/article-8592/iaea-grossi-give-updates-on-ukraine-iran-north-korea-nuclear-power-growth-projections/",
"archiv":null,
"citace":null
}
},
"neuplne":"Případy snížení výkonu jsou společné s Chmelnyckou JE; vypsány hlavní.",
"zasahy":[
{
"d":"2024-11-28",
"prostredek":"drony a rakety",
"co":"Po útoku na rozvodny snížilo výkon všech devět provozovaných reaktorů na Ukrajině.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"RBC-Ukraine, 29. 11. 2024",
"url":"https://newsukraine.rbc.ua/news/massive-russian-strike-cuts-power-output-1732847370.html",
"archiv":"http://web.archive.org/web/20260810012646/https://newsukraine.rbc.ua/news/massive-russian-strike-cuts-power-output-1732847370.html",
"citace":null
}
},
{
"d":"2025-11-07",
"prostredek":"drony a rakety",
"co":"Zásah rozvodny kritické pro jadernou bezpečnost: odpojení od jedné ze dvou linek 750 kV, asi deset dní snížený výkon.",
"dopad":2,
"obnova":"asi 10 dní",
"obnovaDni":10,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Ukrinform, listopad 2025",
"url":"https://www.ukrinform.net/rubric-ato/4059790-two-ukrainian-nuclear-power-plants-reduce-output-after-russian-attack-iaea.html",
"archiv":null,
"citace":null
}
},
{
"d":"2025-11-19",
"prostredek":"drony a rakety",
"co":"Ztráta vysokonapěťové linky a další snížení výkonu.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"RBC-Ukraine, 20. 11. 2025",
"url":"https://newsukraine.rbc.ua/news/three-ukrainian-nuclear-plants-reduce-output-1763642662.html",
"archiv":"http://web.archive.org/web/20260509164537/https://newsukraine.rbc.ua/news/three-ukrainian-nuclear-plants-reduce-output-1763642662.html",
"citace":null
}
},
{
"d":"2025-12",
"prostredek":"drony a rakety",
"co":"Útoky na rozvodny si vynutily snížení výkonu.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"UNN, prosinec 2025",
"url":"https://unn.ua/en/amp/russian-attacks-on-substations-forced-khmelnytskyi-and-rivne-npps-to-reduce-capacity-iaea",
"archiv":"http://web.archive.org/web/20260428010420/https://unn.ua/en/amp/russian-attacks-on-substations-forced-khmelnytskyi-and-rivne-npps-to-reduce-capacity-iaea",
"citace":null
}
},
{
"d":"2026-02",
"prostredek":"drony a rakety",
"co":"Snížení výkonu všech bloků kromě jednoho v celé zemi, personál se ukrýval.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"MAAE Update 340 (GlobalSecurity), 12. 2. 2026",
"url":"https://www.globalsecurity.org/wmd/library/news/ukraine/2026/02/ukraine-260212-iaea01.htm",
"archiv":null,
"citace":null
}
}
]
},
{
"id":"jihoukrajinska_je",
"strana":"UA",
"druh":"elektrarna",
"nazev":"Jihoukrajinská jaderná elektrárna",
"vlastnik":"Energoatom (státní)",
"misto":"Južnoukrajinsk, Mykolajivská oblast",
"gps":[
47.812,
31.217
],
"vyznam":"Třetí provozovaná jaderná elektrárna, zásobuje jih Ukrajiny; ohrožují ji útoky na vyvedení výkonu a drony v okolí.",
"kapacita":{
"hodnota":3000,
"jednotka":"MW",
"popis":"instalovaný výkon (3 bloky)",
"historie":[],
"zdroj":{
"nazev":"Wikipedia: List of power stations in Ukraine",
"url":"https://en.wikipedia.org/wiki/List_of_power_stations_in_Ukraine",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2026-11-18",
"provoz":"bezi",
"text":"Grossi 18. 11. 2026: bezpečnostní systémy fungují a elektrárna vyrábí.",
"zdroj":{
"nazev":"ANS Nuclear Newswire, 19. 11. 2026",
"url":"https://www.ans.org/news/2026-11-19/article-8592/iaea-grossi-give-updates-on-ukraine-iran-north-korea-nuclear-power-growth-projections/",
"archiv":null,
"citace":null
}
},
"neuplne":"Vypsány jen hlavní případy snížení výkonu.",
"zasahy":[
{
"d":"2024-11-28",
"prostredek":"drony a rakety",
"co":"Po útoku na rozvodny snížilo výkon všech devět provozovaných reaktorů na Ukrajině.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"RBC-Ukraine, 29. 11. 2024",
"url":"https://newsukraine.rbc.ua/news/massive-russian-strike-cuts-power-output-1732847370.html",
"archiv":"http://web.archive.org/web/20260810012646/https://newsukraine.rbc.ua/news/massive-russian-strike-cuts-power-output-1732847370.html",
"citace":null
}
},
{
"d":"2025-11-19",
"prostredek":"drony a rakety",
"co":"Ztráta vysokonapěťové linky a snížení výkonu.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"RBC-Ukraine, 20. 11. 2025",
"url":"https://newsukraine.rbc.ua/news/three-ukrainian-nuclear-plants-reduce-output-1763642662.html",
"archiv":"http://web.archive.org/web/20260509164537/https://newsukraine.rbc.ua/news/three-ukrainian-nuclear-plants-reduce-output-1763642662.html",
"citace":null
}
},
{
"d":"2026-02",
"prostredek":"drony a rakety",
"co":"Snížení výkonu všech bloků kromě jednoho v celé zemi, odpojeny vnější linky.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"MAAE Update 340 (GlobalSecurity), 12. 2. 2026",
"url":"https://www.globalsecurity.org/wmd/library/news/ukraine/2026/02/ukraine-260212-iaea01.htm",
"archiv":null,
"citace":null
}
}
]
},
{
"id":"ua_plyn_charkov",
"strana":"UA",
"druh":"plyn",
"nazev":"Těžba plynu Naftogaz – Charkovská oblast",
"vlastnik":"Ukrgazvydobuvannja (skupina Naftogaz)",
"misto":"Charkovská oblast (Šebelynka a další ložiska)",
"gps":[
49.458,
36.519
],
"vyznam":"Charkovská oblast je spolu s Poltavskou hlavní oblastí ukrajinské těžby plynu; největší ložisko Šebelynka leží blízko fronty. Domácí plyn kryje většinu spotřeby, každý výpadek se musí nahradit drahým dovozem.",
"kapacita":{
"hodnota":13.9,
"jednotka":"mld. m³ plynu/rok",
"popis":"komerční těžba celé Ukrgazvydobuvannja (Charkovská + Poltavská oblast dohromady) v roce 2024; těžba jen v Charkovské oblasti se samostatně nezveřejňuje",
"historie":[
[
2022,
12.5,
"komerční těžba UGV"
],
[
2023,
13.2,
"komerční těžba UGV"
],
[
2024,
13.9,
"komerční těžba UGV, nejvíc od roku 2014"
]
],
"zdroj":{
"nazev":"Naftogaz, 17. 1. 2025",
"url":"https://www.naftogaz.com/en/news/grupa-naftogaz-zbilshyla-vydobutok-gazu-v-2024-rotsi-do-13-9-kub-m",
"archiv":null,
"citace":"Naftogaz Group increased gas production to 13.9 bcm in 2024"
}
},
"stav":{
"k":"2026-11-26",
"provoz":"castecne",
"text":"Těžba běží s přestávkami: Rusko útočí na charkovská zařízení opakovaně (naposledy potvrzeno 12. a 21. 10. 2026). V listopadu 2026 hlásil Naftogaz v oblasti útoky na plynaře a auta, ne na těžbu. Podle Naftogazu bylo v roce 2026 přes 400 útoků na jeho zařízení, dvakrát víc než v roce 2025.",
"zdroj":{
"nazev":"Naftogaz, 21. 10. 2026",
"url":"https://www.naftogaz.com/en/news/russia-again-attacks-naftogaz-gas-production-facility-in-kharkiv-region",
"archiv":null,
"citace":"The impact of this morning's attack cannot currently be assessed due to the security situation."
}
},
"neuplne":"Naftogaz zveřejňuje zásahy bez názvu ložiska a útoků jsou stovky. Seznam obsahuje hlavní potvrzené zásahy v letech 2025–2026. Chybí útoky z let 2022–2024, zimy 2024/25 a z prosince 2025 až dubna 2026, u kterých jsme nenašli zprávu výslovně o Charkovské oblasti. Velké útoky z 3. 10. 2025, 23. 5. a 27. 6. 2026 zasáhly zároveň Poltavskou oblast a jsou uvedeny u obou zařízení.",
"zasahy":[
{
"d":"2025-10-03",
"prostredek":"drony a rakety",
"co":"Dosud největší útok na těžbu plynu za celou válku: na zařízení v Charkovské a Poltavské oblasti dopadlo 35 raket (většinou balistických) a 60 dronů. Naftogaz uvedl, že část škod je kritická.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"podle zdrojů Bloombergu se zastavilo asi 60 % ukrajinské těžby plynu (Naftogaz číslo nepotvrdil, ale ani nepopřel)",
"overeni":"odhad",
"zdroj":{
"nazev":"Naftogaz, 3. 10. 2025",
"url":"https://www.naftogaz.com/en/news/vorog-zdiysnyv-naybilshu-masovanu-ataku-na-gazovydobuvnu-infrastrukturu-vid-pochatku-viyny",
"archiv":"http://web.archive.org/web/20260723105230/https://www.naftogaz.com/en/news/vorog-zdiysnyv-naybilshu-masovanu-ataku-na-gazovydobuvnu-infrastrukturu-vid-pochatku-viyny",
"citace":"Some of the destruction is critical"
}
},
{
"d":"2026-05-13",
"prostredek":"drony",
"co":"Denní útok dronu poškodil jedno z těžebních zařízení v Charkovské oblasti, současně byl zasažen objekt v Žytomyrské oblasti.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Naftogaz, 13. 5. 2026",
"url":"https://www.naftogaz.com/en/news/rosiyany-atakuvaly-ob-ekty-naftogazu-na-harkivschyni-ta-zhytomyrschyni",
"archiv":null,
"citace":null
}
},
{
"d":"2026-05-23",
"prostredek":"drony a rakety",
"co":"Více než den trvající útok na několik kritických ropných a plynárenských zařízení v Charkovské a Poltavské oblasti; vážné škody na zařízení a velké požáry, personál evakuován.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Naftogaz, 23. 5. 2026",
"url":"https://www.naftogaz.com/en/news/ponad-dobu-pid-udaramy-masovana-ataka-na-obyekty-naftohazu-na-kharkivshchyni-ta-poltavshchyni",
"archiv":"http://web.archive.org/web/20260608052331/https://www.naftogaz.com/en/news/ponad-dobu-pid-udaramy-masovana-ataka-na-obyekty-naftohazu-na-kharkivshchyni-ta-poltavshchyni",
"citace":"The strikes caused serious damage to equipment, while large-scale fires broke out at the sites."
}
},
{
"d":"2026-06-02",
"prostredek":"drony a rakety",
"co":"Noční kombinovaný úder (nejdřív drony, za hodinu rakety) na jedno z klíčových zařízení Naftogazu v Charkovské oblasti. Rozsah škod se zjišťoval, bez obětí.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Naftogaz, 2. 6. 2026",
"url":"https://www.naftogaz.com/en/news/rosiya-zavdala-kombinovanogo-udaru-po-odnomu-z-klyuchovyh-ob-ektiv-naftogazu-na-harkivschyni",
"archiv":"http://web.archive.org/web/20260608051525/https://www.naftogaz.com/en/news/rosiya-zavdala-kombinovanogo-udaru-po-odnomu-z-klyuchovyh-ob-ektiv-naftogazu-na-harkivschyni",
"citace":"The extent of the damage is being assessed."
}
},
{
"d":"2026-06-27",
"prostredek":"drony a rakety",
"co":"Dva dny útoků na těžební zařízení v Poltavské a Charkovské oblasti, nejméně 4 balistické rakety (některé s kazetovou hlavicí) a drony; poničena těžební infrastruktura i autobus se zaměstnanci.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Naftogaz, 27. 6. 2026",
"url":"https://www.naftogaz.com/en/news/rosiya-zdiysnyla-masovani-ataky-na-vyrobnychi-obyekty-naftohazu-na-poltavshchyni-i-kharkivshchyni",
"archiv":"http://web.archive.org/web/20260731143915/https://www.naftogaz.com/en/news/rosiya-zdiysnyla-masovani-ataky-na-vyrobnychi-obyekty-naftohazu-na-poltavshchyni-i-kharkivshchyni",
"citace":null
}
},
{
"d":"2026-07-06",
"prostredek":"drony",
"co":"Opakované údery na jedno těžební zařízení v Charkovské oblasti vyvolaly požár, jeden zaměstnanec zraněn.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Naftogaz, 6. 7. 2026",
"url":"https://www.naftogaz.com/en/news/rosiyany-bezperervno-atakuyut-gazovydobuvnyy-ob-ekt-grupy-naftogaz-na-harkivschyni",
"archiv":null,
"citace":null
}
},
{
"d":"2026-07-17",
"prostredek":"drony",
"co":"Rozsáhlý útok dronů na těžební zařízení v Charkovské oblasti, provoz zastaven. Podle Naftogazu šlo o 250. útok na jeho zařízení od začátku roku.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Naftogaz, 17. 7. 2026",
"url":"https://www.naftogaz.com/en/news/vorog-bezperervno-atakue-gazovydobuvni-ob-ekty-grupy-naftogaz-na-harkivschyni",
"archiv":"http://web.archive.org/web/20260731143905/https://www.naftogaz.com/en/news/vorog-bezperervno-atakue-gazovydobuvni-ob-ekty-grupy-naftogaz-na-harkivschyni",
"citace":"operations at the facility have been suspended."
}
},
{
"d":"2026-07-19",
"prostredek":"drony",
"co":"Zásah jednoho těžebního zařízení a požár; poškozené zařízení muselo být odstaveno, těžba dočasně klesla.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":"dočasná ztráta těžby (rozsah neuveden)",
"overeni":"over",
"zdroj":{
"nazev":"Naftogaz, 21. 7. 2026",
"url":"https://www.naftogaz.com/en/news/russia-attacks-naftogaz-gas-production-facilities-in-kharkiv-region-for-the-third-consecutive-day",
"archiv":"http://web.archive.org/web/20260731143317/https://www.naftogaz.com/en/news/russia-attacks-naftogaz-gas-production-facilities-in-kharkiv-region-for-the-third-consecutive-day",
"citace":"The damaged equipment had to be shut down, resulting in a temporary loss of gas production."
}
},
{
"d":"2026-07-20",
"prostredek":"drony",
"co":"Třetí den po sobě útok na další těžební zařízení v Charkovské oblasti, hlášeny rozsáhlé škody.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Naftogaz, 21. 7. 2026",
"url":"https://www.naftogaz.com/en/news/russia-attacks-naftogaz-gas-production-facilities-in-kharkiv-region-for-the-third-consecutive-day",
"archiv":"http://web.archive.org/web/20260731143317/https://www.naftogaz.com/en/news/russia-attacks-naftogaz-gas-production-facilities-in-kharkiv-region-for-the-third-consecutive-day",
"citace":"Extensive damage has been reported."
}
},
{
"d":"2026-10-12",
"prostredek":"drony",
"co":"Proudový dron zasáhl těžební infrastrukturu v Charkovské oblasti a vyvolal požár; poškozeno kritické zařízení.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Naftogaz, 12. 10. 2026",
"url":"https://www.naftogaz.com/en/news/russia-hits-naftogaz-gas-production-facility-in-kharkiv-region",
"archiv":null,
"citace":"Critical equipment was damaged in the attack."
}
},
{
"d":"2026-10-21",
"prostredek":"drony",
"co":"Dron zasáhl jednu z jednotek těžebního areálu v Charkovské oblasti; dopad nešlo kvůli bezpečnosti posoudit.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Naftogaz, 21. 10. 2026",
"url":"https://www.naftogaz.com/en/news/russia-again-attacks-naftogaz-gas-production-facility-in-kharkiv-region",
"archiv":null,
"citace":"one of the units at the production site"
}
}
]
},
{
"id":"ua_plyn_poltava",
"strana":"UA",
"druh":"plyn",
"nazev":"Těžba plynu Naftogaz – Poltavská oblast",
"vlastnik":"Ukrgazvydobuvannja (skupina Naftogaz); v oblasti těží i soukromé firmy (např. DTEK)",
"misto":"Poltavská oblast",
"gps":[
49.589,
34.551
],
"vyznam":"Poltavská oblast je vedle Charkovské hlavní oblastí těžby plynu na Ukrajině a je dál od fronty, proto na ni Rusko útočí raketami a dlouhými drony. Domácí těžba rozhoduje o tom, kolik plynu musí Ukrajina před zimou dovézt.",
"kapacita":{
"hodnota":19.12,
"jednotka":"mld. m³ plynu/rok",
"popis":"celková těžba plynu na Ukrajině v roce 2024 (všechny firmy a oblasti); samostatné číslo za Poltavskou oblast se nezveřejňuje",
"historie":[
[
2023,
18.7,
"celá Ukrajina"
],
[
2024,
19.12,
"celá Ukrajina"
],
[
2025,
16.97,
"celá Ukrajina, pokles hlavně kvůli útokům"
]
],
"zdroj":{
"nazev":"LIGA.net (ministr energetiky Šmyhal), 4. 4. 2026",
"url":"https://biz.liga.net/en/energy/news/gas-production-in-ukraine-falls-to-multi-year-low-below-17-bcm",
"archiv":null,
"citace":"In 2025, Ukrainian gas production amounted to 16.97 billion cubic meters."
}
},
"stav":{
"k":"2026-11-26",
"provoz":"castecne",
"text":"V listopadu 2026 přišly potvrzené zásahy 14., 18. a 25. 11.; po posledním z nich stojí jedno zařízení po požáru. Podle Ukrajinské pravdy (červen 2026) snižují útoky těžbu průběžně o 15–20 %.",
"zdroj":{
"nazev":"Naftogaz, 25. 11. 2026",
"url":"https://www.naftogaz.com/en/news/rosiyany-atakuvaly-ob-ekt-naftogazu-na-poltavschyni",
"archiv":null,
"citace":"Operations at the facility have been suspended."
}
},
"neuplne":"Naftogaz hlásí zásahy bez názvu ložiska a útoků byly stovky. Chybí útoky v Poltavské oblasti z ledna 2025, z 28. 10. 2025, z 20. 3. a 4.–5. 4. 2026 a řada dalších. Velké útoky z 3. 10. 2025, 23. 5. a 27. 6. 2026 zasáhly zároveň Charkovskou oblast a jsou uvedeny u obou zařízení.",
"zasahy":[
{
"d":"2025-02-11",
"prostredek":"drony a rakety",
"co":"Až 19 střel s plochou dráhou letu, balistických a řízených raket a drony mířily na těžbu plynu v Poltavské oblasti, cílem byly vrty a kompresní stanice. Naftogaz potvrdil poškození, část odběratelů zůstala bez plynu.",
"dopad":3,
"obnova":"v březnu obnovena víc než polovina ztracené těžby",
"obnovaDni":null,
"vypadek":"útoky v zimě 2025 (nejvíc tento z února) připravily Naftogaz téměř o 50 % těžby",
"overeni":"over",
"zdroj":{
"nazev":"Ukrinform, 11. 2. 2025",
"url":"https://www.ukrinform.net/rubric-ato/3958697-russians-fire-19-missiles-at-gas-production-facilities-in-poltava-region-air-force.html",
"archiv":"http://web.archive.org/web/20260310183241/https://www.ukrinform.net/rubric-ato/3958697-russians-fire-19-missiles-at-gas-production-facilities-in-poltava-region-air-force.html",
"citace":null
}
},
{
"d":"2025-10-03",
"prostredek":"drony a rakety",
"co":"Dosud největší útok na těžbu plynu (35 raket, 60 dronů) na Poltavskou a Charkovskou oblast; DTEK musel zastavit svou těžbu v Poltavské oblasti.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"podle zdrojů Bloombergu asi 60 % ukrajinské těžby",
"overeni":"odhad",
"zdroj":{
"nazev":"Kyiv Post (Bloomberg), 9. 10. 2025",
"url":"https://www.kyivpost.com/post/61795",
"archiv":"http://web.archive.org/web/20260301005430/https://www.kyivpost.com/post/61795",
"citace":null
}
},
{
"d":"2026-03-28",
"prostredek":"drony",
"co":"Třetí den po sobě útoky dronů na tři těžební zařízení v Poltavské oblasti; zabit operátor technologických jednotek, zasažené zařízení odstaveno.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Naftogaz, 28. 3. 2026",
"url":"https://www.naftogaz.com/en/news/tretyu-dobu-pospil-tryvayut-ataky-na-ob-ekty-naftogazu-na-poltavschyni-e-zagyblyy",
"archiv":"http://web.archive.org/web/20260413232957/https://www.naftogaz.com/en/news/tretyu-dobu-pospil-tryvayut-ataky-na-ob-ekty-naftogazu-na-poltavschyni-e-zagyblyy",
"citace":"The operation of affected equipment has been suspended and response efforts are ongoing."
}
},
{
"d":"2026-05-23",
"prostredek":"drony a rakety",
"co":"Více než den trvající útok na zařízení v Charkovské a Poltavské oblasti, vážné škody a velké požáry.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Naftogaz, 23. 5. 2026",
"url":"https://www.naftogaz.com/en/news/ponad-dobu-pid-udaramy-masovana-ataka-na-obyekty-naftohazu-na-kharkivshchyni-ta-poltavshchyni",
"archiv":"http://web.archive.org/web/20260608052331/https://www.naftogaz.com/en/news/ponad-dobu-pid-udaramy-masovana-ataka-na-obyekty-naftohazu-na-kharkivshchyni-ta-poltavshchyni",
"citace":"The strikes caused serious damage to equipment, while large-scale fires broke out at the sites."
}
},
{
"d":"2026-06-27",
"prostredek":"drony a rakety",
"co":"Dvoudenní útok (nejméně 4 balistické rakety, část s kazetovou hlavicí, a drony) na těžbu v Poltavské a Charkovské oblasti.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Naftogaz, 27. 6. 2026",
"url":"https://www.naftogaz.com/en/news/rosiya-zdiysnyla-masovani-ataky-na-vyrobnychi-obyekty-naftohazu-na-poltavshchyni-i-kharkivshchyni",
"archiv":"http://web.archive.org/web/20260731143915/https://www.naftogaz.com/en/news/rosiya-zdiysnyla-masovani-ataky-na-vyrobnychi-obyekty-naftohazu-na-poltavshchyni-i-kharkivshchyni",
"citace":null
}
},
{
"d":"2026-07-04",
"prostredek":"drony",
"co":"Drony zasáhly těžební zařízení v Poltavské oblasti, požár, provoz zastaven.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Naftogaz, 4. 7. 2026",
"url":"https://www.naftogaz.com/en/news/rosiyany-vdaryly-dronamy-po-gazovydobuvnomu-aktyvu-naftogazu-na-poltavschyni",
"archiv":"http://web.archive.org/web/20260731143915/https://www.naftogaz.com/en/news/rosiyany-vdaryly-dronamy-po-gazovydobuvnomu-aktyvu-naftogazu-na-poltavschyni",
"citace":"The strike sparked a fire at the site. Operations at the facility have been suspended."
}
},
{
"d":"2026-10-15",
"prostredek":"drony",
"co":"Noční zásah dronem: požár, poškozené technologické zařízení, provoz zastaven.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Naftogaz, 15. 10. 2026",
"url":"https://www.naftogaz.com/en/news/russia-attacks-naftogaz-gas-production-facility-in-poltava-region",
"archiv":null,
"citace":"Process equipment was damaged, and operations at the facility were suspended."
}
},
{
"d":"2026-11-14",
"prostredek":"drony",
"co":"Odpolední útok dronů na zařízení Naftogazu v Poltavské oblasti vyvolal velký požár; bez zraněných.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Naftogaz, 14. 11. 2026",
"url":"https://www.naftogaz.com/en/news/russia-attacks-naftogaz-facility-in-poltava-region",
"archiv":null,
"citace":"sparking a major fire"
}
},
{
"d":"2026-11-18",
"prostredek":"drony",
"co":"Další zásah zařízení Naftogazu v Poltavské oblasti (současně v Dněpropetrovské); škody se zjišťovaly.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Naftogaz, 18. 11. 2026",
"url":"https://www.naftogaz.com/en/news/rosiya-atakuvala-ob-ekt-naftogazu-na-poltavschyni",
"archiv":null,
"citace":"Specialists are assessing the impact of the strike, but the risk of further strikes is complicating their work."
}
},
{
"d":"2026-11-25",
"prostredek":"drony",
"co":"Noční zásah těžebního zařízení dronem, požár a zastavení provozu.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Naftogaz, 25. 11. 2026",
"url":"https://www.naftogaz.com/en/news/rosiyany-atakuvaly-ob-ekt-naftogazu-na-poltavschyni",
"archiv":null,
"citace":"Operations at the facility have been suspended."
}
}
]
},
{
"id":"ua_zasobniky_zapad",
"strana":"UA",
"druh":"plyn",
"nazev":"Podzemní zásobníky plynu na západě (Bilče-Volycja u Stryje)",
"vlastnik":"Ukrtransgaz (skupina Naftogaz)",
"misto":"okolí Stryje, Lvovská oblast",
"gps":[
49.392,
23.944
],
"vyznam":"Zásobník Bilče-Volycko-Uherske je největší v Ukrajině a podle Wikipedie i v Evropě. Ukrajina z podzemních zásobníků čerpá plyn v zimě a nabízí je i evropským obchodníkům; plyn je uložený hluboko pod zemí, zranitelná je povrchová technika.",
"kapacita":{
"hodnota":30.95,
"jednotka":"mld. m³ plynu (objem zásobníků)",
"popis":"12 podzemních zásobníků Ukrtransgazu celkem; samotný Bilče-Volycko-Uherske má 17,05 mld. m³",
"historie":[
[
2026,
16,
"zásoba v zásobnících v říjnu 2026, nejvíc od roku 2020"
]
],
"zdroj":{
"nazev":"Wikipedie – Ukrtransgaz",
"url":"https://en.wikipedia.org/wiki/Ukrtransgaz",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2026-10-16",
"provoz":"bezi",
"text":"Zásobníky fungují. Naftogaz do nich před zimou 2026/27 dostal 16 mld. m³ plynu, nejvíc od roku 2020 (rok předtím pod 14 mld. m³). Útoky na zásobníky a mrazy si podle něj vynutily rekordní dovoz 7,8 mld. m³ v roce 2025 a v 1. čtvrtletí 2026.",
"zdroj":{
"nazev":"Reuters přes Global Banking & Finance, 16. 10. 2026",
"url":"https://www.globalbankingandfinance.com/exclusive-naftogaz-chief-ukraines-gas-reserves-hit-six-year/",
"archiv":"http://web.archive.org/web/20261016121140/https://www.globalbankingandfinance.com/exclusive-naftogaz-chief-ukraines-gas-reserves-hit-six-year/",
"citace":"managed to bring the volume of reserves in underground storage facilities to 16 billion cubic metres"
}
},
"neuplne":"Ukrajinská strana většinou neuvádí, který zásobník byl zasažen. V dubnu 2024 šlo podle Bloombergu už o čtvrtý útok na zásobníky, ale dva z nich se nepodařilo dohledat. Útoky na zásobníky v letech 2025–2026, které Naftogaz zmiňuje souhrnně, nejsou rozepsané. Zásah raketou Orešnik v lednu 2026 je u zásobníku jen tvrzení ruských zdrojů.",
"zasahy":[
{
"d":"2024-03-24",
"prostredek":"rakety",
"co":"Rakety (podle zpráv Kinžal) zasáhly povrchovou infrastrukturu jednoho z podzemních zásobníků na západě. Šéf Naftogazu Černyšov potvrdil poškozenou technologii; dodávky odběratelům nebyly ohroženy.",
"dopad":1,
"obnova":"opravy probíhaly ihned",
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"VOA přes GlobalSecurity, 24. 3. 2024",
"url":"https://www.globalsecurity.org/wmd/library/news/ukraine/2024/03/ukraine-240324-voa01.htm",
"archiv":"http://web.archive.org/web/20240325092402/https://www.globalsecurity.org/wmd/library/news/ukraine/2024/03/ukraine-240324-voa01.htm",
"citace":null
}
},
{
"d":"2024-04-11",
"prostredek":"rakety",
"co":"Masivní útok zasáhl dva podzemní zásobníky. Podle šéfa Ukrtransgazu škody neomezily vtláčení, poškozená technika byla potřeba až pro špičkové čerpání v zimě.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"RBC-Ukraine, 11. 4. 2024",
"url":"https://newsukraine.rbc.ua/news/russian-troops-strike-2-gas-storage-facilities-1712822904.html",
"archiv":"http://web.archive.org/web/20260609154131/https://newsukraine.rbc.ua/news/russian-troops-strike-2-gas-storage-facilities-1712822904.html",
"citace":null
}
},
{
"d":"2025-01-15",
"prostredek":"rakety",
"co":"Rakety Ch-101, Ch-22 a Kalibr mířily na plynárenskou infrastrukturu na západě. Rusko tvrdilo, že zasáhlo zásobník ve Lvovské oblasti; Naftogaz potvrdil útok na plynárenskou infrastrukturu, dodávky plynu se nepřerušily. Škody byly rychle opraveny.",
"dopad":1,
"obnova":"rychle obnoveno",
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Independent přes Yahoo, 15. 1. 2025",
"url":"https://www.yahoo.com/news/russia-claims-struck-lviv-oblast-124543521.html",
"archiv":"http://web.archive.org/web/20250117171131/https://www.yahoo.com/news/russia-claims-struck-lviv-oblast-124543521.html",
"citace":null
}
},
{
"d":"2026-01-08",
"prostredek":"rakety",
"co":"Balistická raketa Orešnik zasáhla „kritický objekt“ ve Lvovské oblasti (potvrzeno ukrajinským letectvem a gubernátorem). Že šlo o plynové ložisko a zásobník u Stryje, tvrdí jen ruské a telegramové zdroje; jiný výklad geolokace mluví o leteckém opravárenském závodě.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Meduza, 9. 1. 2026",
"url":"https://meduza.io/en/news/2026/01/09/russia-hits-gas-field-near-lviv-in-suspected-oreshnik-ballistic-missile-strike",
"archiv":"http://web.archive.org/web/20260514040552/https://meduza.io/en/news/2026/01/09/russia-hits-gas-field-near-lviv-in-suspected-oreshnik-ballistic-missile-strike",
"citace":null
}
}
]
},
{
"id":"ua_kompresor_orlivka",
"strana":"UA",
"druh":"plyn",
"nazev":"Plynárenská stanice Orlivka (Transbalkánský plynovod)",
"vlastnik":"Operátor GTS Ukrajiny (GTSOU)",
"misto":"Orlivka, Izmajilský rajon, Oděská oblast (u rumunské hranice)",
"gps":[
45.317,
28.44
],
"vyznam":"Vstupní bod Transbalkánského koridoru, kudy na Ukrajinu proudí zkapalněný plyn z Řecka (i americký LNG) a první dodávky ázerbájdžánského plynu. Dřív tudy šel ruský plyn do Rumunska, od roku 2025 jen opačným směrem. Ministerstvo energetiky ani zprávy stanici jménem neuvádějí, poloha je přibližná (obec Orlivka).",
"kapacita":{
"hodnota":null,
"jednotka":null,
"popis":"kapacitu jsme nedohledali",
"historie":[],
"zdroj":{
"nazev":"Kyiv Post",
"url":"https://www.kyivpost.com/post/57665",
"archiv":"http://web.archive.org/web/20251006120056/https://www.kyivpost.com/post/57665",
"citace":null
}
},
"stav":{
"k":"2026-11-26",
"provoz":"neznamo",
"text":"Po útoku v srpnu 2025 jsme nenašli zprávy o dalším zásahu ani o současném provozu.",
"zdroj":{
"nazev":"Kyiv Post",
"url":"https://www.kyivpost.com/post/57665",
"archiv":"http://web.archive.org/web/20251006120056/https://www.kyivpost.com/post/57665",
"citace":null
}
},
"neuplne":null,
"zasahy":[
{
"d":"2025-08-06",
"prostredek":"drony",
"co":"Desítky dronů zaútočily na kompresorovou stanici GTSOU u rumunské hranice na trase dovozu LNG a ázerbájdžánského plynu. Gubernátor Kiper potvrdil poškození plynárenské infrastruktury, asi 2 500 domácností bylo bez plynu.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Ukrajinská pravda, 6. 8. 2025",
"url":"https://www.pravda.com.ua/eng/news/2025/08/6/7524981/",
"archiv":"http://web.archive.org/web/20250811114001/https://www.pravda.com.ua/eng/news/2025/08/6/7524981/",
"citace":null
}
}
]
},
{
"id":"ua_kremencuk",
"strana":"UA",
"druh":"rafinerie",
"nazev":"Rafinerie Kremenčuk",
"vlastnik":"Ukrtatnafta (od roku 2022 pod státní správou)",
"misto":"Kremenčuk, Poltavská oblast",
"gps":[
49.172,
33.471
],
"vyznam":"Největší a v podstatě jediná velká rafinerie na Ukrajině. Rusko ji systematicky ničí, takže Ukrajina dováží asi 85 % paliv.",
"kapacita":{
"hodnota":18.62,
"jednotka":"mil. t ropy/rok",
"popis":"projektovaná kapacita (údaj k roku 2008); skutečné zpracování bylo už před válkou mnohem nižší",
"historie":[
[
2012,
3.091,
"skutečné zpracování"
]
],
"zdroj":{
"nazev":"Wikipedie – Kremenchuk Oil Refinery",
"url":"https://en.wikipedia.org/wiki/Kremenchuk_Oil_Refinery",
"archiv":null,
"citace":"18.62 million tonnes per year"
}
},
"stav":{
"k":"2026-10-30",
"provoz":"neznamo",
"text":"Ministr energetiky v březnu 2026 uvedl, že rafinerii od začátku války zasáhlo kolem 60–69 raket a asi 260 dronů. Naposledy ji 30. 10. 2026 podle prezidenta Zelenského zasáhly balistické rakety. Provozní stav se nezveřejňuje.",
"zdroj":{
"nazev":"Ukrinform, 30. 10. 2026",
"url":"https://www.ukrinform.net/rubric-ato/4179903-zelensky-russia-fired-17-ballistic-missiles-overnight-took-no-steps-toward-deescalation-in-energy-sector.html",
"archiv":"http://web.archive.org/web/20261102144851/https://www.ukrinform.net/rubric-ato/4179903-zelensky-russia-fired-17-ballistic-missiles-overnight-took-no-steps-toward-deescalation-in-energy-sector.html",
"citace":"Our oil refining infrastructure was targeted."
}
},
"neuplne":"Podle ministra Šmyhala dopadlo na rafinerii přes 60 raket a asi 260 dronů, zásahů tedy bylo mnohem víc, než uvádíme. Ukrajina o zásazích skoro nic nezveřejňuje. Ruská tvrzení o útocích (např. 19. 8. 2025, podzim 2026) jsme nezahrnuli, protože je Ukrajina nepotvrdila.",
"zasahy":[
{
"d":"2022-04-02",
"prostredek":"rakety",
"co":"Raketový útok rafinerii vyřadil; úřadující gubernátor Lunin oznámil, že je „úplně zničená“.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":"celá rafinerie",
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie – Kremenchuk Oil Refinery",
"url":"https://en.wikipedia.org/wiki/Kremenchuk_Oil_Refinery",
"archiv":null,
"citace":"completely destroyed"
}
},
{
"d":"2022-05",
"prostredek":"rakety",
"co":"Rusko vypálilo na už zničenou rafinerii další čtyři rakety. V červnu 2022 Naftogaz oznámil, že kvůli opakovaným útokům stojí veškeré zpracování ropy na Ukrajině.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie – Kremenchuk Oil Refinery",
"url":"https://en.wikipedia.org/wiki/Kremenchuk_Oil_Refinery",
"archiv":null,
"citace":"All oil refining in Ukraine is now shut down due to massive repeated attacks."
}
},
{
"d":"2023-11-01",
"prostredek":"drony a rakety",
"co":"Další útok na rafinerii, požár byl rychle uhašen.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie – Kremenchuk Oil Refinery",
"url":"https://en.wikipedia.org/wiki/Kremenchuk_Oil_Refinery",
"archiv":null,
"citace":"this time the fire was quickly extinguished"
}
},
{
"d":"2025-06-16",
"prostredek":"drony a rakety",
"co":"Rusko ohlásilo hromadný úder na rafinerii. Gubernátor Kohut potvrdil kombinovaný útok na Kremenčuk bez obětí, o stavu rafinerie nic neřekl.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Bloomberg přes Rigzone, 16. 6. 2025",
"url":"https://www.rigzone.com/news/wire/russia_says_it_struck_kremenchuk_oil_refinery_in_ukraine-16-jun-2025-180849-article/",
"archiv":null,
"citace":"Nobody was injured and Ukraine's air defense shot down majority of the missiles and drones"
}
},
{
"d":"2026-10-30",
"prostredek":"rakety",
"co":"Prezident Zelenskyj potvrdil, že ruské balistické rakety zasáhly ropnou rafinérskou infrastrukturu v Kremenčuku; podle oblastní správy byl podnik zasažen dvakrát.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Ukrinform, 30. 10. 2026",
"url":"https://www.ukrinform.net/rubric-ato/4179903-zelensky-russia-fired-17-ballistic-missiles-overnight-took-no-steps-toward-deescalation-in-energy-sector.html",
"archiv":"http://web.archive.org/web/20261102144851/https://www.ukrinform.net/rubric-ato/4179903-zelensky-russia-fired-17-ballistic-missiles-overnight-took-no-steps-toward-deescalation-in-energy-sector.html",
"citace":"Kremenchuk. Our oil refining infrastructure was targeted."
}
}
]
},
{
"id":"ua_sklad_vasylkiv",
"strana":"UA",
"druh":"sklad",
"nazev":"Ropný sklad KLO u Vasylkova (Krjačky)",
"vlastnik":"KLO (síť čerpacích stanic)",
"misto":"Krjačky u Vasylkova, Kyjevská oblast",
"gps":[
50.211,
30.29
],
"vyznam":"Jediný ropný sklad sítě KLO, téměř plný, u letecké základny Vasylkiv. Ukázka ruských útoků na zásoby paliv z prvních dní války.",
"kapacita":{
"hodnota":null,
"jednotka":null,
"popis":"kapacitu jsme nedohledali",
"historie":[],
"zdroj":{
"nazev":"Ukrinform, 27. 2. 2022",
"url":"https://www.ukrinform.net/rubric-ato/3414345-russian-invasion-update-russia-hits-oil-depot-of-klo-gas-station-network-in-vasylkiv.html",
"archiv":"http://web.archive.org/web/20240614021454/https://www.ukrinform.net/rubric-ato/3414345-russian-invasion-update-russia-hits-oil-depot-of-klo-gas-station-network-in-vasylkiv.html",
"citace":null
}
},
"stav":{
"k":"2022-02-27",
"provoz":"zniceno",
"text":"Firma KLO oznámila, že sklad je zničený. Novější zprávy o jeho obnově jsme nenašli.",
"zdroj":{
"nazev":"Ukrinform, 27. 2. 2022",
"url":"https://www.ukrinform.net/rubric-ato/3414345-russian-invasion-update-russia-hits-oil-depot-of-klo-gas-station-network-in-vasylkiv.html",
"archiv":"http://web.archive.org/web/20240614021454/https://www.ukrinform.net/rubric-ato/3414345-russian-invasion-update-russia-hits-oil-depot-of-klo-gas-station-network-in-vasylkiv.html",
"citace":"The oil depot is destroyed."
}
},
"neuplne":"Rusko na jaře 2022 zničilo desítky ropných skladů po celé Ukrajině (souhrnný seznam jsme nesestavovali); toto je jeden reprezentativní, dobře doložený případ.",
"zasahy":[
{
"d":"2022-02-27",
"prostredek":"rakety",
"co":"Raketa v noci zasáhla sklad paliv u Vasylkova. Požár nešlo kvůli bojům o letiště hasit, sklad shořel.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Ukrinform, 27. 2. 2022",
"url":"https://www.ukrinform.net/rubric-ato/3414345-russian-invasion-update-russia-hits-oil-depot-of-klo-gas-station-network-in-vasylkiv.html",
"archiv":"http://web.archive.org/web/20240614021454/https://www.ukrinform.net/rubric-ato/3414345-russian-invasion-update-russia-hits-oil-depot-of-klo-gas-station-network-in-vasylkiv.html",
"citace":"It was our only oil depot"
}
}
]
},
{
"id":"ua_port_odesa",
"strana":"UA",
"druh":"pristav",
"nazev":"Přístav Oděsa",
"vlastnik":"Úřad námořních přístavů Ukrajiny (USPA) a soukromí operátoři terminálů",
"misto":"Oděsa",
"gps":[
46.497,
30.73
],
"vyznam":"Jeden ze tří přístavů Velké Oděsy, které před letošní eskalací vyvážely asi 90 % ukrajinských zemědělských a hutních produktů. Spolu s Čornomorskem a Pivdennym tvoří ukrajinský námořní koridor po odchodu Ruska z obilné dohody v roce 2023.",
"kapacita":{
"hodnota":18.3,
"jednotka":"mil. t nákladu/rok",
"popis":"skutečná překládka v roce 2024 (podle USPA)",
"historie":[
[
2023,
8.41,
"překládka"
],
[
2024,
18.3,
"překládka"
]
],
"zdroj":{
"nazev":"CFTS (údaje USPA)",
"url":"https://en.cfts.org.ua/news/cargo_handling_volumes_in_ports_of_pivdennyi_chornomorsk_and_odesa_in_2024_announced",
"archiv":"http://web.archive.org/web/20251206092640/https://en.cfts.org.ua/news/cargo_handling_volumes_in_ports_of_pivdennyi_chornomorsk_and_odesa_in_2024_announced",
"citace":null
}
},
"stav":{
"k":"2026-11-26",
"provoz":"castecne",
"text":"Rusko od července 2026 prudce zesílilo útoky na obilné terminály a lodě; vývoz obilí z přístavů u Oděsy se od konce července téměř zastavil, protože se jim lodě vyhýbají a pojištění zdražilo. V sezoně 2026/27 Ukrajina dosud vyvezla 7,6 mil. t obilí oproti 11,5 mil. t před rokem. Přes všechny tři přístavy Velké Oděsy prošlo v roce 2025 73,3 mil. t nákladu, o 28 % méně než v roce 2021.",
"zdroj":{
"nazev":"Reuters přes Internazionale, 26. 11. 2026",
"url":"https://www.internazionale.it/ultime-notizie-reuters/2026/11/26/ukraine-says-russia-hits-two-grain-ships-near-odesa-ports",
"archiv":null,
"citace":"grain shipments from its key Black Sea ports around Odesa have all but stopped since late July"
}
},
"neuplne":"Na přístavy Velké Oděsy útočí Rusko velmi často: podle BlackSeaNews jen v 1. čtvrtletí 2026 nejméně 73krát (včetně energetiky v oblasti), v roce 2025 poškodily útoky 39 civilních lodí. Útoky v přístavu a u něj z let 2023–2026 tu uvádíme jen výběrem.",
"zasahy":[
{
"d":"2023-07-19",
"prostredek":"drony a rakety",
"co":"Hned po odchodu Ruska z obilné dohody útočily rakety Ch-22, Kalibr, Oniks a drony Šáhed na obilné terminály v Oděse a Čornomorsku.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Ukrajinská pravda, 19. 7. 2023",
"url":"https://www.pravda.com.ua/eng/news/2023/07/19/7412037/",
"archiv":"http://web.archive.org/web/20260502203846/https://www.pravda.com.ua/eng/news/2023/07/19/7412037/",
"citace":null
}
},
{
"d":"2024-10-09",
"prostredek":"rakety",
"co":"Balistická raketa zasáhla v přístavu u Oděsy kontejnerovou loď Shui Spirit (Panama) s humanitárním slunečnicovým olejem pro Palestinu; 8 mrtvých. Byl to třetí útok na civilní loď za čtyři dny.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Independent, 10. 10. 2024",
"url":"https://kyivindependent.com/russian-missile-strike-on-odesa-oblast-hit-ship-with-humanitarian-aid-for-palestine-kyiv-says/",
"archiv":"http://web.archive.org/web/20260417120032/https://kyivindependent.com/russian-missile-strike-on-odesa-oblast-hit-ship-with-humanitarian-aid-for-palestine-kyiv-says/",
"citace":null
}
},
{
"d":"2025-12-12",
"prostredek":"drony a rakety",
"co":"Útok drony a balistickými raketami na přístavy Oděsa a Čornomorsk; v Oděse zraněn zaměstnanec soukromé firmy a poškozen nakladač.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Al Jazeera, 13. 12. 2025",
"url":"https://aljazeera.com/news/2025/12/13/russia-damages-turkish-owned-vessels-in-attack-on-ukrainian-ports",
"archiv":"http://web.archive.org/web/20260925191108/https://www.aljazeera.com/news/2025/12/13/russia-damages-turkish-owned-vessels-in-attack-on-ukrainian-ports",
"citace":null
}
},
{
"d":"2026-01-01",
"prostredek":"drony",
"co":"Drony Šáhed poškodily přístavní techniku, vozidla a infrastrukturu.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"BlackSeaNews (souhrn 1. čtvrtletí 2026)",
"url":"https://www.blackseanews.net/en/read/247386",
"archiv":null,
"citace":null
}
},
{
"d":"2026-01-09",
"prostredek":"drony",
"co":"Zasažena nákladní loď LADONNA nakládající u přístavu, jeden člen posádky zahynul.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"BlackSeaNews (souhrn 1. čtvrtletí 2026)",
"url":"https://www.blackseanews.net/en/read/247386",
"archiv":null,
"citace":null
}
},
{
"d":"2026-03-01",
"prostredek":"rakety",
"co":"Balistická raketa poškodila přístavní infrastrukturu a kontejnerovou loď MSC LEVANTE F (Panama, švýcarský vlastník).",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"BlackSeaNews (souhrn 1. čtvrtletí 2026)",
"url":"https://www.blackseanews.net/en/read/247386",
"archiv":null,
"citace":null
}
},
{
"d":"2026-07-20",
"prostredek":"rakety",
"co":"Tři ruské rakety zasáhly loď s kukuřicí u Oděsy, 10 mrtvých. V červenci 2026 začala vlna útoků na přístavy a lodě, která vývoz obilí koridorem zastavila.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":"měsíční kapacita vývozu obilí klesla ze zhruba 6 na 4 mil. t (Ukrajinská agrární rada)",
"overeni":"over",
"zdroj":{
"nazev":"Al Majalla, srpen 2026",
"url":"https://en.majalla.com/node/332665/business-economy/could-black-sea-become-hormuz-food",
"archiv":null,
"citace":"On 20 July, three Russian missiles struck a maize carrier off Odesa, killing 10 people."
}
},
{
"d":"2026-11-26",
"prostredek":"jiné",
"co":"Rusko v noci napadlo u Oděsy dvě zahraniční nákladní lodě s více než 100 000 t obilí (podle premiéra Koreckého); vlajky a rozsah škod nebyly uvedeny.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Reuters přes Internazionale, 26. 11. 2026",
"url":"https://www.internazionale.it/ultime-notizie-reuters/2026/11/26/ukraine-says-russia-hits-two-grain-ships-near-odesa-ports",
"archiv":null,
"citace":"Russia attacked two foreign cargo ships carrying more than 100,000 metric tons of grain overnight"
}
}
]
},
{
"id":"ua_port_pivdennyj",
"strana":"UA",
"druh":"pristav",
"nazev":"Přístav Pivdennyj (Južnyj)",
"vlastnik":"USPA a soukromí operátoři (mj. terminál TIS)",
"misto":"Pivdenne u Oděsy, Oděská oblast",
"gps":[
46.619,
31.027
],
"vyznam":"Nejvytíženější ukrajinský přístav roku 2024 (obilí, ruda), hlubokovodní, s největším soukromým operátorem TIS.",
"kapacita":{
"hodnota":35.55,
"jednotka":"mil. t nákladu/rok",
"popis":"skutečná překládka v roce 2024 (podle USPA)",
"historie":[
[
2023,
10.08,
"překládka"
],
[
2024,
35.55,
"překládka, nejvíc ze všech ukrajinských přístavů"
]
],
"zdroj":{
"nazev":"CFTS (údaje USPA)",
"url":"https://en.cfts.org.ua/news/cargo_handling_volumes_in_ports_of_pivdennyi_chornomorsk_and_odesa_in_2024_announced",
"archiv":"http://web.archive.org/web/20251206092640/https://en.cfts.org.ua/news/cargo_handling_volumes_in_ports_of_pivdennyi_chornomorsk_and_odesa_in_2024_announced",
"citace":null
}
},
"stav":{
"k":"2026-11-26",
"provoz":"castecne",
"text":"Stejně jako ostatní přístavy Velké Oděsy je od konce července 2026 vývoz obilí skoro zastavený; v 1. pololetí 2026 přístav ještě fungoval naplno.",
"zdroj":{
"nazev":"Reuters přes Internazionale, 26. 11. 2026",
"url":"https://www.internazionale.it/ultime-notizie-reuters/2026/11/26/ukraine-says-russia-hits-two-grain-ships-near-odesa-ports",
"archiv":null,
"citace":"grain shipments from its key Black Sea ports around Odesa have all but stopped since late July"
}
},
"neuplne":"Útoky na Pivdennyj před rokem 2026 jsme samostatně nedohledali; zprávy často mluví souhrnně o přístavech Velké Oděsy.",
"zasahy":[
{
"d":"2026-01-07",
"prostredek":"drony a rakety",
"co":"Úder 2 raket Iskander-M a nejméně 15 dronů na Pivdennyj a Čornomorsk: poškozena administrativní budova a infrastruktura, podle USPA mrtví a zranění.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"BlackSeaNews (souhrn 1. čtvrtletí 2026)",
"url":"https://www.blackseanews.net/en/read/247386",
"archiv":null,
"citace":null
}
},
{
"d":"2026-01-28",
"prostredek":"drony",
"co":"Poškozeny logistické prvky, hangáry, lokomotiva a průmyslové budovy.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"BlackSeaNews (souhrn 1. čtvrtletí 2026)",
"url":"https://www.blackseanews.net/en/read/247386",
"archiv":null,
"citace":null
}
},
{
"d":"2026-08-14",
"prostredek":"rakety",
"co":"Raketa poškodila nejméně jeden sklad na terminálu TIS největšího soukromého operátora; lodě se ukrajinským přístavům vyhýbají a vývoz v 1. polovině srpna klesl na 30 % plánu.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":"vývoz obilí v 1. polovině srpna jen 30 % plánu (celá Ukrajina)",
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Independent přes Yahoo, 14. 8. 2026",
"url":"https://www.yahoo.com/news/world/articles/exclusive-russia-strikes-odesa-port-150035726.html",
"archiv":null,
"citace":"damaged at least one warehouse at the TIS terminal"
}
},
{
"d":"2026-08-25",
"prostredek":"drony a rakety",
"co":"Ruské ministerstvo obrany tvrdí, že v Pivdenném zasáhlo čtyři plavidla (nákladní lodě a tanker) a přístavní infrastrukturu; stalo se tak po odmítnutí ukrajinského návrhu na příměří pro obilní lodě.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"Marine Insight",
"url":"https://www.marineinsight.com/russia-says-it-struck-4-vessels-at-black-sea-port-of-pivdennyi-and-one-at-odesa/",
"archiv":null,
"citace":null
}
}
]
},
{
"id":"ua_port_cornomorsk",
"strana":"UA",
"druh":"pristav",
"nazev":"Přístav Čornomorsk",
"vlastnik":"USPA a soukromí operátoři (Kernel, Viterra, CMA CGM aj.)",
"misto":"Čornomorsk, Oděská oblast",
"gps":[
46.324,
30.652
],
"vyznam":"Druhý největší přístav Velké Oděsy, s obilnými terminály i kontejnerovým molem; Kernel tu má hlavní vývozní terminál.",
"kapacita":{
"hodnota":26.04,
"jednotka":"mil. t nákladu/rok",
"popis":"skutečná překládka v roce 2024 (podle USPA)",
"historie":[
[
2023,
11.41,
"překládka"
],
[
2024,
26.04,
"překládka"
]
],
"zdroj":{
"nazev":"CFTS (údaje USPA)",
"url":"https://en.cfts.org.ua/news/cargo_handling_volumes_in_ports_of_pivdennyi_chornomorsk_and_odesa_in_2024_announced",
"archiv":"http://web.archive.org/web/20251206092640/https://en.cfts.org.ua/news/cargo_handling_volumes_in_ports_of_pivdennyi_chornomorsk_and_odesa_in_2024_announced",
"citace":null
}
},
"stav":{
"k":"2026-11-26",
"provoz":"castecne",
"text":"Kernel, největší vývozce obilí, po útocích v červenci 2026 přerušil provoz v Čornomorsku; vývoz obilí přes přístavy Velké Oděsy se od konce července téměř zastavil.",
"zdroj":{
"nazev":"Al Majalla, srpen 2026",
"url":"https://en.majalla.com/node/332665/business-economy/could-black-sea-become-hormuz-food",
"archiv":null,
"citace":"Kernel, the country's largest grain exporter, suspended operations at Chornomorsk."
}
},
"neuplne":"Útoků bylo mnohem víc (podle BlackSeaNews jen v 1. čtvrtletí 2026 asi 9 incidentů přímo v Čornomorsku nebo u něj). Uvádíme výběr těch nejvýznamnějších.",
"zasahy":[
{
"d":"2023-07-19",
"prostredek":"drony a rakety",
"co":"Noční útok na obilné terminály po odchodu Ruska z obilné dohody: zničeno 60 000 t obilí, nejvíc utrpěly terminály Kernelu, Viterry a CMA CGM. Podle úřadů měla plná oprava trvat přes rok.",
"dopad":4,
"obnova":"přes 1 rok (odhad úřadů)",
"obnovaDni":365,
"vypadek":"60 000 t obilí zničeno",
"overeni":"over",
"zdroj":{
"nazev":"Ukrajinská pravda, 19. 7. 2023",
"url":"https://www.pravda.com.ua/eng/news/2023/07/19/7412037/",
"archiv":"http://web.archive.org/web/20260502203846/https://www.pravda.com.ua/eng/news/2023/07/19/7412037/",
"citace":null
}
},
{
"d":"2025-12-12",
"prostredek":"drony a rakety",
"co":"Útok drony a balistickými raketami; v Čornomorsku poškozena loď Cenk T (Panama, turecký vlastník), celkem tři turecké lodě.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Al Jazeera, 13. 12. 2025",
"url":"https://aljazeera.com/news/2025/12/13/russia-damages-turkish-owned-vessels-in-attack-on-ukrainian-ports",
"archiv":"http://web.archive.org/web/20260925191108/https://www.aljazeera.com/news/2025/12/13/russia-damages-turkish-owned-vessels-in-attack-on-ukrainian-ports",
"citace":null
}
},
{
"d":"2026-01-07",
"prostredek":"drony a rakety",
"co":"Požár nádrží s ropnými produkty (společný úder s Pivdennym).",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"BlackSeaNews (souhrn 1. čtvrtletí 2026)",
"url":"https://www.blackseanews.net/en/read/247386",
"archiv":null,
"citace":null
}
},
{
"d":"2026-01-15",
"prostredek":"rakety",
"co":"Iskander-M zasáhl kontejnerové molo, zraněn člen posádky maltské lodi, únik ropných látek.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"BlackSeaNews (souhrn 1. čtvrtletí 2026)",
"url":"https://www.blackseanews.net/en/read/247386",
"archiv":null,
"citace":null
}
},
{
"d":"2026-03-20",
"prostredek":"drony",
"co":"Poškozeny dvě lodě AT-27 a Princess Fayzah při nakládce u mola, dva zranění.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"BlackSeaNews (souhrn 1. čtvrtletí 2026)",
"url":"https://www.blackseanews.net/en/read/247386",
"archiv":null,
"citace":null
}
},
{
"d":"2026-03-28",
"prostredek":"drony",
"co":"Poškozeno molo, obilná galerie a skladovací nádrž.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"BlackSeaNews (souhrn 1. čtvrtletí 2026)",
"url":"https://www.blackseanews.net/en/read/247386",
"archiv":null,
"citace":null
}
},
{
"d":"2026-07",
"prostredek":"drony a rakety",
"co":"Masivní údery na přístavní infrastrukturu v Čornomorsku a Oděse vážně poškodily zařízení holdingu Kernel, který v Čornomorsku přerušil provoz.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Al Majalla, srpen 2026",
"url":"https://en.majalla.com/node/332665/business-economy/could-black-sea-become-hormuz-food",
"archiv":null,
"citace":"Kernel, the country's largest grain exporter, suspended operations at Chornomorsk."
}
},
{
"d":"2026-07-30",
"prostredek":"drony",
"co":"Dron zasáhl tureckou loď ATA-2 (Panama) s kukuřicí po vyplutí z Čornomorsku.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Türkiye Today",
"url":"https://www.turkiyetoday.com/nation/drone-hits-turkish-owned-grain-ship-ata-2-off-chornomorsk-in-black-sea-3224982",
"archiv":null,
"citace":null
}
}
]
},
{
"id":"ua_port_izmajil",
"strana":"UA",
"druh":"pristav",
"nazev":"Přístav Izmajil (Dunaj)",
"vlastnik":"Izmajilský námořní obchodní přístav (státní) a soukromé terminály",
"misto":"Izmajil, Oděská oblast",
"gps":[
45.333,
28.831
],
"vyznam":"Největší ukrajinský dunajský přístav, náhradní vývozní cesta pro obilí přes Rumunsko, když jsou černomořské přístavy blokované nebo pod útoky.",
"kapacita":{
"hodnota":13.45,
"jednotka":"mil. t nákladu/rok",
"popis":"skutečná překládka v roce 2024 (rejstřík USPA); v roce 2023 asi 20,2 mil. t. Všechny dunajské přístavy dohromady: 17,3 mil. t v roce 2024 a jen 8,2–8,9 mil. t v roce 2025",
"historie":[
[
2023,
20.2,
"překládka"
],
[
2024,
13.45,
"překládka"
]
],
"zdroj":{
"nazev":"Logistics Cluster – Ukraine Ports on Danube River",
"url":"https://lca.logcluster.org/214-ukraine-ports-dunabe-river",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2026-11-26",
"provoz":"castecne",
"text":"Přístav pracuje pod téměř nepřetržitými útoky dronů (rejstřík Dunajské komise eviduje desítky zásahů do dubna 2026, Rusko hlásilo další údery v září a říjnu 2026). Překládka dunajských přístavů se v roce 2025 zhruba zpolovila; podle náměstka ministra útoky narušily energetiku a citelně omezily provoz přístavů.",
"zdroj":{
"nazev":"Interfax-Ukrajina (Kuleba), 2026",
"url":"https://en.interfax.com.ua/news/economic/1136420.html",
"archiv":null,
"citace":null
}
},
"neuplne":"Rejstřík Dunajské komise končí 30. 4. 2026; novější zásahy známe jen z ruských tvrzení. Menší zásahy samotného města nejsou uvedeny.",
"zasahy":[
{
"d":"2023-08-02",
"prostredek":"drony",
"co":"První velký útok dronů na přístav: poškozen námořní terminál, obilné sklady, železniční cisterny, jeřáby a zahraniční loď Monica.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Dunajská komise – rejstřík škod (údaje Ukrajiny)",
"url":"https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"archiv":"http://web.archive.org/web/20260606132716/https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"citace":null
}
},
{
"d":"2023-08-23",
"prostredek":"drony",
"co":"Poškozeny sklady, elevátor a obilné sklady několika firem i infrastruktura pobočky USPA.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Dunajská komise – rejstřík škod",
"url":"https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"archiv":"http://web.archive.org/web/20260606132716/https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"citace":null
}
},
{
"d":"2023-09-04",
"prostredek":"drony",
"co":"Útok na Izmajil, Reni a Usť-Dunajsk: poškozeny sklady pobočky USPA a loděnice.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Dunajská komise – rejstřík škod",
"url":"https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"archiv":"http://web.archive.org/web/20260606132716/https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"citace":null
}
},
{
"d":"2023-12-07",
"prostredek":"drony",
"co":"Poškozen sklad, zeď elevátoru a 8 prázdných obilných sil, 1 mrtvý.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Dunajská komise – rejstřík škod",
"url":"https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"archiv":"http://web.archive.org/web/20260606132716/https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"citace":null
}
},
{
"d":"2024-07-24",
"prostredek":"drony",
"co":"Poškozena linka na překládku obilí, dopravníky, nákladní molo a cisterny s palivem.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Dunajská komise – rejstřík škod",
"url":"https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"archiv":"http://web.archive.org/web/20260606132716/https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"citace":null
}
},
{
"d":"2025-07-16",
"prostredek":"drony",
"co":"Požár plynové kompresorové stanice v přístavu a na plynovém člunu, poškozeny dva slovenské remorkéry.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Dunajská komise – rejstřík škod",
"url":"https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"archiv":"http://web.archive.org/web/20260606132716/https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"citace":null
}
},
{
"d":"2025-08-20",
"prostredek":"drony",
"co":"Hořely dvě nádrže po 3 000 m³ ve skladu paliv Triton Service Ukraine.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Dunajská komise – rejstřík škod",
"url":"https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"archiv":"http://web.archive.org/web/20260606132716/https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"citace":null
}
},
{
"d":"2025-11-17",
"prostredek":"drony",
"co":"Dron zasáhl turecký tanker na zkapalněný plyn MT Orinda při vykládce asi 4 400 t LPG, velký požár; Rumunsko evakuovalo dvě vesnice. Zasažena i energetika, 32 499 odběratelů bez proudu.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie – 2025 MT Orinda fire",
"url":"https://en.wikipedia.org/wiki/2025_MT_Orinda_fire",
"archiv":"http://web.archive.org/web/20260116062817/https://en.wikipedia.org/wiki/2025_MT_Orinda_fire",
"citace":"The fire was extinguished by the morning of 18 November."
}
},
{
"d":"2025-12-26",
"prostredek":"drony",
"co":"Hořela budova elevátoru, poškozeny čluny a lodě v přístavu i na rejdě.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Dunajská komise – rejstřík škod",
"url":"https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"archiv":"http://web.archive.org/web/20260606132716/https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"citace":null
}
},
{
"d":"2026-02-27",
"prostredek":"drony",
"co":"Poškozena přístavní infrastruktura, sklady, výrobní provozy a technika, požáry; dva zranění.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Dunajská komise – rejstřík škod",
"url":"https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"archiv":"http://web.archive.org/web/20260606132716/https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"citace":null
}
},
{
"d":"2026-03-26",
"prostredek":"drony",
"co":"Poškozena mola č. 8, 12 a 13, sklad, budova námořní stanice a obilná nakládací plocha.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Dunajská komise – rejstřík škod",
"url":"https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"archiv":"http://web.archive.org/web/20260606132716/https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"citace":null
}
},
{
"d":"2026-04-15",
"prostredek":"drony",
"co":"Série útoků 8.–17. 4. 2026: poškozeny budovy přístavu a dunajské paroplavby, nákladní komplex, sklady a tanker s naftou.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Dunajská komise – rejstřík škod",
"url":"https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"archiv":"http://web.archive.org/web/20260606132716/https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"citace":null
}
},
{
"d":"2026-10-15",
"prostredek":"drony",
"co":"Ruské ministerstvo obrany tvrdí, že zasáhlo infrastrukturu přístavu a dvě nákladní lodě s vojenským nákladem; podrobnosti neuvedlo. Podobná tvrzení zazněla i v září 2026.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"tvrz",
"zdroj":{
"nazev":"TASS",
"url":"https://tass.com/defense/2202275",
"archiv":null,
"citace":null
}
}
]
},
{
"id":"ua_port_reni",
"strana":"UA",
"druh":"pristav",
"nazev":"Přístav Reni (Dunaj)",
"vlastnik":"Renijský námořní obchodní přístav (státní) a soukromé terminály",
"misto":"Reni, Oděská oblast (200 m od Rumunska)",
"gps":[
45.444,
28.286
],
"vyznam":"Dunajský přístav na hranici s Rumunskem. Po odchodu Ruska z obilné dohody v roce 2023 se stal klíčovou náhradní cestou vývozu obilí; trosky dronů opakovaně dopadly na rumunské území.",
"kapacita":{
"hodnota":3.39,
"jednotka":"mil. t nákladu/rok",
"popis":"skutečná překládka v roce 2024 (rejstřík USPA); v roce 2023 asi 10,1 mil. t",
"historie":[
[
2023,
10.1,
"překládka"
],
[
2024,
3.39,
"překládka"
]
],
"zdroj":{
"nazev":"Logistics Cluster – Ukraine Ports on Danube River",
"url":"https://lca.logcluster.org/214-ukraine-ports-dunabe-river",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2026-04-30",
"provoz":"neznamo",
"text":"Po útocích na energetiku byl přístav od 11. 11. do 17. 12. 2025 bez proudu. Do dubna 2026 rejstřík další zásahy přístavu Reni neeviduje; o současném provozu jsme zprávy nenašli.",
"zdroj":{
"nazev":"Dunajská komise – rejstřík škod",
"url":"https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"archiv":"http://web.archive.org/web/20260606132716/https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"citace":null
}
},
"neuplne":"Rejstřík Dunajské komise končí 30. 4. 2026.",
"zasahy":[
{
"d":"2023-07-24",
"prostredek":"drony",
"co":"První ruský útok na ukrajinský dunajský přístav: poškozena věž řízení lodní dopravy, sklady, mostový jeřáb 250 t, obilné a olejové nádrže, únik oleje do vody.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Dunajská komise – rejstřík škod",
"url":"https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"archiv":"http://web.archive.org/web/20260606132716/https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"citace":null
}
},
{
"d":"2023-08-16",
"prostredek":"drony",
"co":"Poškozeny obilné sklady a sila (mj. Reni Elevator), 50 cisternových kontejnerů a přístavní koleje.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Dunajská komise – rejstřík škod",
"url":"https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"archiv":"http://web.archive.org/web/20260606132716/https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"citace":null
}
},
{
"d":"2023-09-03",
"prostredek":"drony",
"co":"Poškozeny nádrže s ropnými produkty, čerpací stanice a cisterny, tři zranění.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Dunajská komise – rejstřík škod",
"url":"https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"archiv":"http://web.archive.org/web/20260606132716/https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"citace":null
}
},
{
"d":"2023-09-13",
"prostredek":"drony",
"co":"Poškozeny dva obilné sklady, nádrž na palivo a vozidla; 11 zraněných, 1 mrtvý (útok zasáhl i Izmajil).",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Dunajská komise – rejstřík škod",
"url":"https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"archiv":"http://web.archive.org/web/20260606132716/https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"citace":null
}
},
{
"d":"2023-12-14",
"prostredek":"drony",
"co":"Zasažen sklad s obilím.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Dunajská komise – rejstřík škod",
"url":"https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"archiv":"http://web.archive.org/web/20260606132716/https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"citace":null
}
},
{
"d":"2024-10-02",
"prostredek":"drony",
"co":"Poškozen obilný sklad, nákladní auta a administrativní budovy.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Dunajská komise – rejstřík škod",
"url":"https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"archiv":"http://web.archive.org/web/20260606132716/https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"citace":null
}
},
{
"d":"2025-02-13",
"prostredek":"drony",
"co":"Poškozen obilný sklad, plnicí rampa na zkapalněný plyn, nádrž a trafostanice.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Dunajská komise – rejstřík škod",
"url":"https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"archiv":"http://web.archive.org/web/20260606132716/https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"citace":null
}
},
{
"d":"2025-11-11",
"prostredek":"drony",
"co":"Útok na energetiku v Reni: přístav zůstal bez proudu, napájení obnoveno až 17. 12. 2025.",
"dopad":3,
"obnova":"36 dní (do 17. 12. 2025)",
"obnovaDni":36,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Dunajská komise – rejstřík škod",
"url":"https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"archiv":"http://web.archive.org/web/20260606132716/https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"citace":null
}
},
{
"d":"2025-12-23",
"prostredek":"drony",
"co":"Poškozeno vedení u rozvodny Reni, hořela loď Anka (Tanzanie), poškozeny sklad a palivové nádrže.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Dunajská komise – rejstřík škod",
"url":"https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"archiv":"http://web.archive.org/web/20260606132716/https://www.danubecommission.org/uploads/doc/Register_of_RU_attacks/Register_of_Damage_Lower_Danube_Region_caused_by_the_Military_Actions_of_the_Russian_Federation_20260519.pdf",
"citace":null
}
}
]
},
{
"id":"ua_rozvodny_ukrenergo",
"strana":"UA",
"druh":"rozvodna",
"nazev":"Klíčové rozvodny Ukrenerga (750/330 kV, souhrnně)",
"vlastnik":"Ukrenergo",
"misto":"celá Ukrajina, zvlášť rozvodny u jaderných elektráren Chmelnyckyj, Rivne a Jižní Ukrajina",
"gps":[
50.302,
26.645
],
"vyznam":"Rozvodny 750 a 330 kV jsou páteří ukrajinské sítě; přes ně jaderné elektrárny dodávají proud a zároveň z nich berou napájení pro bezpečnostní systémy. Když je Rusko zasáhne, musí jaderné bloky snížit výkon. MAAE to opakovaně označuje za ohrožení jaderné bezpečnosti. (Souřadnice: Netišyn u JE Chmelnyckyj, jen orientačně.)",
"kapacita":{
"hodnota":103,
"jednotka":"rozvoden 220–750 kV",
"popis":"počet páteřních rozvoden Ukrenerga na kontrolovaném území (podle webu Ukrenerga, citováno bne IntelliNews); Ukrenergo odhaduje, že poškozeno bylo asi 40 % z nich",
"historie":[],
"zdroj":{
"nazev":"bne IntelliNews – Russia picks off Ukraine's substations",
"url":"https://www.intellinews.com/russia-picks-off-ukraine-s-substations-to-freeze-it-into-submission-480683/",
"archiv":null,
"citace":null
}
},
"stav":{
"k":"2026-11-14",
"provoz":"castecne",
"text":"Síť je podle MAAE kvůli útokům nestabilní; v týdnu do 14. 11. 2026 musely ukrajinské jaderné elektrárny několikrát snížit výkon. 3. 11. 2026 Rusko poslalo tři drony na rozvodnu klíčovou pro JE Chmelnyckyj. Souhrnné úřední číslo zasažených rozvoden 750/330 kV za rok 2026 Ukrajina nezveřejňuje.",
"zdroj":{
"nazev":"MAAE, Update 375 (14. 11. 2026)",
"url":"https://www.iaea.org/newscenter/pressreleases/update-375-iaea-director-general-statement-on-situation-in-ukraine",
"archiv":"http://web.archive.org/web/20261115082047/https://www.iaea.org/newscenter/pressreleases/update-375-iaea-director-general-statement-on-situation-in-ukraine",
"citace":null
}
},
"neuplne":"Ukrajina polohu zasažených rozvoden většinou tají, a souhrnné úřední číslo útoků na rozvodny 750/330 kV jsme nenašli. Uvádíme zásahy potvrzené MAAE nebo ukrajinskou vládou, hlavně ty, které omezily jaderné elektrárny. Zásahy rozvoden v letech 2022–2023 a většina zásahů 2026 chybí.",
"zasahy":[
{
"d":"2024-11-17",
"prostredek":"drony a rakety",
"co":"Masivní útok dál poškodil několik rozvoden, na kterých závisí JE Chmelnyckyj, Rivne a Jižní Ukrajina; elektrárny nebyly zasaženy přímo a neodstavily se.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"MAAE Update 260 přes GlobalSecurity",
"url":"https://www.globalsecurity.org/wmd/library/news/ukraine/2024/11/ukraine-241117-iaea01.htm",
"archiv":null,
"citace":null
}
},
{
"d":"2024-11-28",
"prostredek":"drony a rakety",
"co":"Po útoku snížilo výkon všech devět provozovaných jaderných bloků, jeden blok JE Rivne byl odpojen od sítě.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"RBC-Ukraine, 29. 11. 2024",
"url":"https://newsukraine.rbc.ua/news/massive-russian-strike-cuts-power-output-1732847370.html",
"archiv":"http://web.archive.org/web/20260810012646/https://newsukraine.rbc.ua/news/massive-russian-strike-cuts-power-output-1732847370.html",
"citace":null
}
},
{
"d":"2025-10-30",
"prostredek":"drony a rakety",
"co":"Útoky poškodily rozvodny důležité pro jadernou bezpečnost: JE Jižní Ukrajina a Chmelnyckyj ztratily po jednom vnějším vedení, Rivne dočasně snížila výkon dvou bloků.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Ministerstvo energetiky Ukrajiny (MAAE)",
"url":"https://mev.gov.ua/en/news/russias-shelling-damaged-critical-infrastructure-supporting-ukraines-nuclear-power-plants-iaea",
"archiv":null,
"citace":null
}
},
{
"d":"2025-11-08",
"prostredek":"drony a rakety",
"co":"JE Chmelnyckyj a Rivne odpojeny od jednoho ze dvou vedení 750 kV; tři bloky jely zhruba deset dní se sníženým výkonem.",
"dopad":2,
"obnova":"asi 10 dní",
"obnovaDni":10,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Interfax-Ukrajina (MAAE)",
"url":"https://en.interfax.com.ua/news/general/1121364.html",
"archiv":"http://web.archive.org/web/20260511060124/https://en.interfax.com.ua/news/general/1121364.html",
"citace":null
}
},
{
"d":"2025-11-19",
"prostredek":"drony a rakety",
"co":"JE Chmelnyckyj, Rivne i Jižní Ukrajina ztratily každá jedno vysokonapěťové vedení a dál snížily výkon.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Ukranews (MAAE), listopad 2025",
"url":"https://ukranews.com/en/news/1118216-due-to-shelling-on-november-19-ukrainian-npps-further-reduced-generation-iaea",
"archiv":"http://web.archive.org/web/20251122060009/https://ukranews.com/en/news/1118216-due-to-shelling-on-november-19-ukrainian-npps-further-reduced-generation-iaea",
"citace":null
}
},
{
"d":"2025-12",
"prostredek":"drony a rakety",
"co":"Po cílených útocích na rozvodny musely JE Chmelnyckyj a Rivne snížit výkon (koncem prosince 2025).",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"UNN (MAAE)",
"url":"https://unn.ua/en/amp/russian-attacks-on-substations-forced-khmelnytskyi-and-rivne-npps-to-reduce-capacity-iaea",
"archiv":null,
"citace":null
}
},
{
"d":"2026-02-07",
"prostredek":"drony a rakety",
"co":"Ministr Šmyhal: útok zasáhl rozvodny a vedení 750 a 330 kV, „páteř“ sítě; zasaženy i Burštynská a Dobrotvirská TPP, jaderné bloky snížily výkon.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Ukrajinská pravda, 7. 2. 2026",
"url":"https://www.pravda.com.ua/eng/news/2026/02/07/8019842/",
"archiv":"http://web.archive.org/web/20260430094507/https://www.pravda.com.ua/eng/news/2026/02/07/8019842/",
"citace":"Substations and 750 kV and 330 kV power lines – the backbone of Ukraine's power grid – came under attack."
}
},
{
"d":"2026-10-27",
"prostredek":"drony",
"co":"Útok na rozvodnu Slavutyč (u Černobylu) podle MAAE vyřadil všechna její vedení 330 kV.",
"dopad":2,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"MAAE, Update 373 (30. 10. 2026)",
"url":"https://www.iaea.org/newscenter/pressreleases/update-373-iaea-director-general-statement-on-situation-in-ukraine",
"archiv":"http://web.archive.org/web/20261116144134/https://www.iaea.org/newscenter/pressreleases/update-373-iaea-director-general-statement-on-situation-in-ukraine",
"citace":null
}
},
{
"d":"2026-11-03",
"prostredek":"drony",
"co":"Při jednom z největších útoků na energetiku (289 dronů, 76 raket) Rusko poslalo tři drony na rozvodnu klíčovou pro JE Chmelnyckyj; zda zasáhly, ministr neuvedl. Ukrajina informovala MAAE.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"LIGA.net, 3. 11. 2026",
"url":"https://news.liga.net/en/politics/news/russia-directed-three-drones-at-critical-substation-serving-khmelnytskyi-nuclear-power-plant-shmyhal-says",
"archiv":"http://web.archive.org/web/20261104130721/https://news.liga.net/en/politics/news/russia-directed-three-drones-at-critical-substation-serving-khmelnytskyi-nuclear-power-plant-shmyhal-says",
"citace":null
}
}
]
},
{
"id":"ua_pivdenmas",
"strana":"UA",
"druh":"zbrojovka",
"nazev":"Pivdenmaš (Južmaš), Dnipro",
"vlastnik":"stát (Státní kosmická agentura Ukrajiny)",
"misto":"Dnipro, Dněpropetrovská oblast",
"gps":[
48.438,
34.995
],
"vyznam":"Historický výrobce raket a nosných raket ze sovětské éry (asi 7 000 zaměstnanců v roce 2017). Rusko ho považuje za cíl kvůli výrobě zbraní; v listopadu 2024 na něj poprvé v historii vypálilo raketu středního doletu Orešnik.",
"kapacita":{
"hodnota":null,
"jednotka":null,
"popis":"výrobní kapacita se nezveřejňuje",
"historie":[],
"zdroj":{
"nazev":"Wikipedie – Pivdenmash",
"url":"https://en.wikipedia.org/wiki/Pivdenmash",
"archiv":"http://web.archive.org/web/20261106151235/https://en.wikipedia.org/wiki/Pivdenmash",
"citace":null
}
},
"stav":{
"k":"2026-11-26",
"provoz":"neznamo",
"text":"Stav závodu se nezveřejňuje. Satelitní snímky po úderu Orešnikem v listopadu 2024 neukázaly velké škody.",
"zdroj":{
"nazev":"Kyiv Post, 2024",
"url":"https://www.kyivpost.com/post/42808",
"archiv":"http://web.archive.org/web/20260717223723/https://www.kyivpost.com/post/42808",
"citace":null
}
},
"neuplne":"Útoky na Dnipro jsou častější, ale za roky 2025–2026 jsme nenašli potvrzený zásah právě Pivdenmaše.",
"zasahy":[
{
"d":"2022-07-15",
"prostredek":"rakety",
"co":"Střely Ch-101 zasáhly závod Pivdenmaš a obytnou čtvrť; 4 mrtví, 16 zraněných, poškozen městský vodovod.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie – Missile strike on Dnipro on 15 July 2022",
"url":"https://en.wikipedia.org/wiki/Missile_strike_on_Dnipro_on_15_July_2022",
"archiv":null,
"citace":"Some of the missiles struck the Pivdenmash plant."
}
},
{
"d":"2022-11-15",
"prostredek":"rakety",
"co":"Při celostátním raketovém útoku byl podle premiéra Šmyhala zasažen raketový závod Pivdenmaš.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Wikipedie – Dnipro strikes (2022–present)",
"url":"https://en.wikipedia.org/wiki/Dnipro_strikes_(2022%E2%80%93present)",
"archiv":"http://web.archive.org/web/20261107132121/https://en.wikipedia.org/wiki/Dnipro_strikes_(2022%E2%80%93present)",
"citace":"the PA Pivdenmash missile plant"
}
},
{
"d":"2024-11-21",
"prostredek":"rakety",
"co":"První bojové použití rakety středního doletu Orešnik (bez výbušnin, s inertními hlavicemi). Satelitní snímky ukázaly jen malé škody na střechách závodu a okolních domech, podle Reuters „omezené škody“.",
"dopad":1,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Post, listopad 2024",
"url":"https://www.kyivpost.com/post/42808",
"archiv":"http://web.archive.org/web/20260717223723/https://www.kyivpost.com/post/42808",
"citace":null
}
}
]
},
{
"id":"ua_antonov_hostomel",
"strana":"UA",
"druh":"letiste",
"nazev":"Antonov – letiště Hostomel a závod Svjatošyn",
"vlastnik":"státní podnik Antonov",
"misto":"Hostomel u Kyjeva (letiště); Svjatošyn, Kyjev (sériový závod)",
"gps":[
50.605,
30.191
],
"vyznam":"Letiště a hangáry firmy Antonov, domov největšího letadla světa An-225 Mrija, které Rusové zničili v prvních dnech války. Sériový závod Antonov dnes vyrábí dlouhé úderné drony An-196 Ljutyj, a proto je terčem.",
"kapacita":{
"hodnota":null,
"jednotka":null,
"popis":"nepoužitelné (letiště a výrobní závod)",
"historie":[],
"zdroj":{
"nazev":"Wikipedie – Battle of Antonov Airport",
"url":"https://en.wikipedia.org/wiki/Battle_of_Antonov_Airport",
"archiv":"http://web.archive.org/web/20261114104000/https://en.wikipedia.org/wiki/Battle_of_Antonov_Airport",
"citace":null
}
},
"stav":{
"k":"2026-11-18",
"provoz":"castecne",
"text":"Letiště Hostomel neslouží běžnému provozu, Antonov Airlines létají z Lipska. V hangáru v Hostomelu se opravuje An-124 UR-82009. Na geolokovaném videu z 18. 11. 2026 dopadl dron Geran-4 pár metrů od něj, rozsah škod není známý.",
"zdroj":{
"nazev":"Status-6 (X), 18. 11. 2026",
"url":"https://x.com/Archer83Able/status/2123007622664040538",
"archiv":null,
"citace":null
}
},
"neuplne":"Antonov zásahy nekomentuje; zásahy závodu Svjatošyn kromě dubna 2025 jsme nedohledali.",
"zasahy":[
{
"d":"2022-02-27",
"prostredek":"jiné",
"co":"Během bitvy o letiště Hostomel (24.–25. 2.) bylo v hangáru zničeno letadlo An-225 Mrija; ztrátu oznámil 27. 2. ministr Kuleba. Antonov po osvobození letiště 4. 4. 2022 potvrdil zničení An-225, An-26, An-74, řídicí věže a správní budovy.",
"dopad":4,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"over",
"zdroj":{
"nazev":"Militarnyi (prohlášení Antonova)",
"url":"https://militarnyi.com/en/news/the-antonov-state-enterprise-reported-on-the-planes-that-were-destroyed-in-hostomel/",
"archiv":"http://web.archive.org/web/20260209165331/https://militarnyi.com/en/news/the-antonov-state-enterprise-reported-on-the-planes-that-were-destroyed-in-hostomel/",
"citace":null
}
},
{
"d":"2025-04-12",
"prostredek":"drony",
"co":"Ruské drony v noci zasáhly sériový závod Antonov na letišti Svjatošyn v Kyjevě, zřejmě největší hangár; družice NASA FIRMS zachytily rozsáhlý požár. Osud rozestavěného druhého An-225 za hangárem není potvrzený.",
"dopad":3,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"odhad",
"zdroj":{
"nazev":"Defence Industry Europe, duben 2025",
"url":"https://defence-industry.eu/russian-drone-strike-targets-antonov-airfield-in-kyiv-used-for-long-range-uav-production/",
"archiv":"http://web.archive.org/web/20260711201036/https://defence-industry.eu/russian-drone-strike-targets-antonov-airfield-in-kyiv-used-for-long-range-uav-production/",
"citace":null
}
},
{
"d":"2026-11-18",
"prostredek":"drony",
"co":"Proudový dron Geran-4 dopadl do hangáru v Hostomelu pár metrů od opravovaného An-124 UR-82009 (geolokované video); škody nejsou známé, Antonov se nevyjádřil.",
"dopad":null,
"obnova":null,
"obnovaDni":null,
"vypadek":null,
"overeni":"odhad",
"zdroj":{
"nazev":"Status-6 (X), 18. 11. 2026",
"url":"https://x.com/Archer83Able/status/2123007622664040538",
"archiv":null,
"citace":null
}
}
]
}
],
"souhrny":{
"grafy":[
{
"id":"ruVyrazeno",
"nazev":"Ruská rafinérská kapacita zasažená nebo mimo provoz",
"jednotka":"%",
"barva":"--ru",
"popis":"Odhady Reuters, IEA a FT. Pozor: některé body měří kapacitu, kterou útoky vyřadily, jiné jmenovitou kapacitu zasažených rafinerií — skutečný pokles zpracování bývá menší, protože Rusko část výpadku dohání na jiných závodech.",
"zdrojGrafu":"Reuters, IEA, Financial Times",
"body":[
{
"d":"2024-03-26",
"hodnota":14,
"popis":"mimo provoz po útocích dronů (124 580 t/den = 0,9 mil. barelů/den), výpočet Reuters",
"overeni":"odhad",
"zdroj":{
"nazev":"Reuters přes Hydrocarbon Processing",
"url":"https://www.hydrocarbonprocessing.com/news/2024/03/russian-oil-refining-capacity-idled-by-drones-reaches-14-of-total/",
"archiv":"https://web.archive.org/web/20261017002909/https://hydrocarbonprocessing.com/news/2024/03/russian-oil-refining-capacity-idled-by-drones-reaches-14-of-total/",
"citace":"124,580 metric tons per day, or 900,000 barrels per day"
}
},
{
"d":"2025-08-26",
"hodnota":17,
"popis":"(1,1 mil. barelů/den) narušeno útoky na 10 rafinerií, výpočet Reuters",
"overeni":"odhad",
"zdroj":{
"nazev":"Ukrajinska pravda (Reuters), 26. 8. 2025",
"url":"https://www.pravda.com.ua/eng/news/2025/08/26/7527871/",
"archiv":"https://web.archive.org/web/20260504142902/https://www.pravda.com.ua/eng/news/2025/08/26/7527871/",
"citace":"Ukraine has disrupted 17% of Russia's refining capacity"
}
},
{
"d":"2025-08-28",
"hodnota":17,
"popis":"(1,2 mil. barelů/den) mimo provoz v srpnu 2025 – drony a plánované opravy dohromady, drony asi 48 %; výpočet Reuters",
"overeni":"odhad",
"zdroj":{
"nazev":"Invezz (Reuters)",
"url":"https://invezz.com/news/2025/08/28/russian-oil-refining-capacity-hits-record-low-amid-ukrainian-drone-attacks/",
"archiv":"https://web.archive.org/web/20250828205259/https://invezz.com/news/2025/08/28/russian-oil-refining-capacity-hits-record-low-amid-ukrainian-drone-attacks/",
"citace":null
}
},
{
"d":"2025-11-13",
"hodnota":20,
"popis":"mimo provoz na vrcholu útoků (srpen–říjen 2025), skutečné zpracování ale kleslo jen o 3–6 %; Reuters",
"overeni":"odhad",
"zdroj":{
"nazev":"Kyiv Post (Reuters), 14. 11. 2025",
"url":"https://www.kyivpost.com/post/64235",
"archiv":"https://web.archive.org/web/20260522231358/https://www.kyivpost.com/post/64235",
"citace":"knocked 20% of Russia's refinery capacity offline between August and October"
}
},
{
"d":"2026-05-20",
"hodnota":25,
"popis":"všechny velké rafinerie středního Ruska (238 tis. t/den) zcela zastaveny nebo omezeny; Reuters",
"overeni":"odhad",
"zdroj":{
"nazev":"RBC-Ukrajina (Reuters)",
"url":"https://newsukraine.rbc.ua/news/russia-loses-quarter-of-its-oil-refining-1779297371.html",
"archiv":"https://web.archive.org/web/20260930171944/https://newsukraine.rbc.ua/news/russia-loses-quarter-of-its-oil-refining-1779297371.html",
"citace":"Russia loses quarter of its oil refining capacity due to drone attacks"
}
},
{
"d":"2026-07-04",
"hodnota":20,
"popis":"IEA: víc než 20 % kapacity mimo provoz (podle Wikipedie)",
"overeni":"odhad",
"zdroj":{
"nazev":"Wikipedie: 2025–2026 Russian fuel crisis",
"url":"https://en.wikipedia.org/wiki/2025%E2%80%932026_Russian_fuel_crisis",
"archiv":"https://web.archive.org/web/20261105150900/https://en.wikipedia.org/wiki/2025%E2%80%932026_Russian_fuel_crisis",
"citace":null
}
},
{
"d":"2026-07-09",
"hodnota":40,
"popis":"Financial Times: až 40 % kapacity (přes Ukrajinskou pravdu, podle Wikipedie)",
"overeni":"odhad",
"zdroj":{
"nazev":"Wikipedie: 2025–2026 Russian fuel crisis",
"url":"https://en.wikipedia.org/wiki/2025%E2%80%932026_Russian_fuel_crisis",
"archiv":"https://web.archive.org/web/20261105150900/https://en.wikipedia.org/wiki/2025%E2%80%932026_Russian_fuel_crisis",
"citace":"Ukrainian drones knock out up to 40% of Russia's oil refining capacity"
}
},
{
"d":"2026-11-10",
"hodnota":30,
"popis":"rafinerie s jmenovitou kapacitou ~300 tis. t/den (2,2 mil. barelů/den) zasažené od konce října; skutečný výpadek až 200 tis. t/den; Reuters",
"overeni":"odhad",
"zdroj":{
"nazev":"Ukrajinska pravda (Reuters), 10. 11. 2026",
"url":"https://www.pravda.com.ua/eng/news/2026/11/10/8062172/",
"archiv":"https://web.archive.org/web/20261111043910/https://www.pravda.com.ua/eng/news/2026/11/10/8062172/",
"citace":"Ukrainian strikes have cut Russian oil refining capacity by nearly third"
}
},
{
"d":"2026-11-18",
"hodnota":54,
"popis":"rafinerie s jmenovitou kapacitou ~500 tis. t/den zasažené od konce října (15 z 35 velkých); skutečné zpracování −45 %; Reuters",
"overeni":"odhad",
"zdroj":{
"nazev":"Reuters přes US News, 18. 11. 2026",
"url":"https://www.usnews.com/news/world/articles/2026-11-18/exclusive-drone-attacks-nearly-halve-russias-november-oil-refining-sources-say",
"archiv":null,
"citace":"equivalent to approximately 54% of the country's total primary refining capacity"
}
}
]
},
{
"id":"ruZpracovani",
"nazev":"Kolik ropy ruské rafinerie zpracují",
"jednotka":"mil. barelů/den",
"barva":"--ru",
"popis":"Celé roky podle ruských úřadů a Reuters, od roku 2025 měsíční odhady analytiků (IEA, Kpler, Reuters, Rystad), protože Rusko čísla utajilo. Celková kapacita ruských rafinerií je asi 6,5 mil. barelů denně (IEA).",
"zdrojGrafu":"TASS, Interfax, Reuters, IEA, Kpler, Rystad",
"body":[
{
"d":"2021-07-01",
"hodnota":5.64,
"popis":"celý rok, 280,7 mil. t",
"overeni":"over",
"zdroj":{
"nazev":"TASS",
"url":"https://tass.com/economy/1502981",
"archiv":"https://web.archive.org/web/20260814094000/https://tass.com/economy/1502981",
"citace":"Processing increased by 3.9% up to 280.7 million tonnes"
}
},
{
"d":"2022-07-01",
"hodnota":5.46,
"popis":"celý rok, 272 mil. t",
"overeni":"over",
"zdroj":{
"nazev":"Interfax",
"url":"https://interfax.com/newsroom/top-stories/96197/",
"archiv":"https://web.archive.org/web/20260711114850/https://interfax.com/newsroom/top-stories/96197/",
"citace":"in 2022, the amount of oil refining in Russia decreased by 3% and reached 272 million tonnes"
}
},
{
"d":"2023-07-01",
"hodnota":5.52,
"popis":"celý rok, 275 mil. t",
"overeni":"over",
"zdroj":{
"nazev":"TASS",
"url":"https://tass.com/economy/1742599",
"archiv":"https://web.archive.org/web/20240618214512/https://tass.com/economy/1742599",
"citace":"Primary oil refining in Russia in 2023 increased by 1.1% to 275 mln tons"
}
},
{
"d":"2024-07-01",
"hodnota":5.4,
"popis":"celý rok, 267 mil. t (přepočet Reuters)",
"overeni":"over",
"zdroj":{
"nazev":"Reuters (exkluzivně) přes MarketScreener, 1/2025",
"url":"https://www.marketscreener.com/quote/currency/US-DOLLAR-RUSSIAN-ROUBLE--2370597/news/Exclusive-Russian-fuel-exports-fall-in-2024-as-drone-attacks-bans-add-to-sanctions-pressure-48797813/",
"archiv":"https://web.archive.org/web/20250723204540/https://www.marketscreener.com/quote/currency/US-DOLLAR-RUSSIAN-ROUBLE--2370597/news/Exclusive-Russian-fuel-exports-fall-in-2024-as-drone-attacks-bans-add-to-sanctions-pressure-48797813/",
"citace":"fell to around 267 million metric tons (5.4 million bpd) in 2024"
}
},
{
"d":"2025-07-01",
"hodnota":5.2,
"popis":"leden–říjen 2025, 220 mil. t (přepočet Reuters)",
"overeni":"over",
"zdroj":{
"nazev":"Kyiv Post (Reuters), 14. 11. 2025",
"url":"https://www.kyivpost.com/post/64235",
"archiv":"https://web.archive.org/web/20260522231358/https://www.kyivpost.com/post/64235",
"citace":"From January to October, Russia's oil processing fell to around 220 million metric tons"
}
},
{
"d":"2025-09-15",
"hodnota":5.1,
"popis":"průměr srpen–říjen 2025, o ~0,3 mil. barelů/den méně než před rokem",
"overeni":"odhad",
"zdroj":{
"nazev":"Kyiv Post (Reuters), 14. 11. 2025",
"url":"https://www.kyivpost.com/post/64235",
"archiv":"https://web.archive.org/web/20260522231358/https://www.kyivpost.com/post/64235",
"citace":"Refining output fell to around 5.1 million barrels per day during that period"
}
},
{
"d":"2026-04-15",
"hodnota":4.7,
"popis":"IEA: „v posledních týdnech“, zpráva z 13. 5. 2026",
"overeni":"odhad",
"zdroj":{
"nazev":"IEA Oil Market Report, 13. 5. 2026",
"url":"https://iea.blob.core.windows.net/assets/db7a9af0-7a97-49a5-af56-6732b08d6225/-13MAY2026__OilMarketReport.pdf",
"archiv":"https://web.archive.org/web/20260831144945/https://iea.blob.core.windows.net/assets/db7a9af0-7a97-49a5-af56-6732b08d6225/-13MAY2026__OilMarketReport.pdf",
"citace":"reduced Russian crude runs to around 4.7 mb/d in recent weeks"
}
},
{
"d":"2026-06-15",
"hodnota":3.8,
"popis":"IEA",
"overeni":"odhad",
"zdroj":{
"nazev":"IEA – komentář, 17. 9. 2026",
"url":"https://www.iea.org/commentaries/russian-refining-sector-struggles-amid-intensifying-ukrainian-attacks",
"archiv":"https://web.archive.org/web/20261109091606/https://www.iea.org/commentaries/russian-refining-sector-struggles-amid-intensifying-ukrainian-attacks",
"citace":"Russian refinery throughput fell to 3.8 mb/d"
}
},
{
"d":"2026-07-15",
"hodnota":3.6,
"popis":"EA Analytics přes Bloomberg; Kpler uvádí za část července 3,8",
"overeni":"odhad",
"zdroj":{
"nazev":"The Moscow Times (Bloomberg), 3. 8. 2026",
"url":"https://www.themoscowtimes.com/2026/08/03/russian-oil-refining-falls-to-24-year-low-after-ukrainian-drone-strikes-bloomberg-a93404",
"archiv":"https://web.archive.org/web/20261002111820/https://www.themoscowtimes.com/2026/08/03/russian-oil-refining-falls-to-24-year-low-after-ukrainian-drone-strikes-bloomberg-a93404",
"citace":"Refineries processed an estimated 3.6 million barrels of crude per day last month"
}
},
{
"d":"2026-08-15",
"hodnota":4.0,
"popis":"odhad Kpler, citovaný Razumkovovým centrem",
"overeni":"odhad",
"zdroj":{
"nazev":"Razumkovovo centrum",
"url":"https://razumkov.org.ua/en/articles-interviews/russian-oil-refining-under-attack-from-safety-margin-to-diesel-fragility-and-systemic-crisis",
"archiv":"https://web.archive.org/web/20261105065121/https://razumkov.org.ua/en/articles-interviews/russian-oil-refining-under-attack-from-safety-margin-to-diesel-fragility-and-systemic-crisis",
"citace":null
}
},
{
"d":"2026-10-15",
"hodnota":5.0,
"popis":"konec října 2026, přes 0,7 mil. t denně",
"overeni":"odhad",
"zdroj":{
"nazev":"Reuters přes US News, 18. 11. 2026",
"url":"https://www.usnews.com/news/world/articles/2026-11-18/exclusive-drone-attacks-nearly-halve-russias-november-oil-refining-sources-say",
"archiv":null,
"citace":"processing more than 700,000 metric tons of oil a day in late October"
}
},
{
"d":"2026-11-15",
"hodnota":2.9,
"popis":"polovina listopadu 2026, 0,4 mil. t denně",
"overeni":"odhad",
"zdroj":{
"nazev":"Reuters přes US News, 18. 11. 2026",
"url":"https://www.usnews.com/news/world/articles/2026-11-18/exclusive-drone-attacks-nearly-halve-russias-november-oil-refining-sources-say",
"archiv":null,
"citace":null
}
},
{
"d":"2026-11-15",
"hodnota":2.65,
"popis":"Rystad 25. 11. 2026: 2,6–2,7 mil., nejméně za víc než 20 let",
"overeni":"odhad",
"zdroj":{
"nazev":"NewsBytes (Rystad/Bloomberg)",
"url":"https://www.newsbytesapp.com/news/business/russias-oil-processing-at-26-27m-bpd-after-ukraines-drone-strikes/tldr",
"archiv":null,
"citace":null
}
}
]
},
{
"id":"uaVykon",
"nazev":"Kolik elektřiny dokáže Ukrajina vyrobit",
"jednotka":"GW",
"barva":"--ua",
"popis":"Dostupný výkon ukrajinských elektráren. Pro srovnání: 6 GW ztraceno okupací Záporožské JE; 16 GW ztraceno okupací celkem od 2022 (JE, tepelné elektrárny, teplárny, větrné a solární; stav k 8/2024); 9 GW ztraceno útoky březen–květen 2024 (hlavně tepelné a vodní elektrárny); 8,5 GW ztraceno/vyřazeno útoky od října 2025 (ministr Šmyhal); 9 GW ztraceno (zničeno) v zimě 2025/26, z toho 4 GW do dubna obnoveno. Pro listopad 2026 souhrnné číslo zveřejněno nebylo, v celé zemi platí hodinové odstávky.",
"zdrojGrafu":"Ukrenergo, vláda Ukrajiny, analytici",
"body":[
{
"d":"2021-12-15",
"hodnota":36,
"popis":"využitelný výkon na začátku invaze (instalovaný 56 GW)",
"overeni":"odhad",
"zdroj":{
"nazev":"Kyiv Post (podle KSE), 8. 8. 2024",
"url":"https://www.kyivpost.com/post/37055",
"archiv":"http://web.archive.org/web/20250821125025/https://www.kyivpost.com/post/37055",
"citace":"Prior to February 2022, Ukraine had 56 GW of installed capacity"
}
},
{
"d":"2025-09-15",
"hodnota":17.5,
"popis":"provozuschopný výkon v roce 2025",
"overeni":"odhad",
"zdroj":{
"nazev":"The Ukrainian Review, 7. 5. 2026",
"url":"https://theukrainianreview.info/power-outages-as-the-new-reality-the-state-and-prospects-of-ukraines-energy-system/",
"archiv":"http://web.archive.org/web/20260509053647/https://theukrainianreview.info/power-outages-as-the-new-reality-the-state-and-prospects-of-ukraines-energy-system/",
"citace":"As of 2025, only 17.5 GW remained operational."
}
},
{
"d":"2026-01-15",
"hodnota":11,
"popis":"dostupný výkon v lednu 2026 (po zimních útocích)",
"overeni":"odhad",
"zdroj":{
"nazev":"Kyiv Independent, 4. 4. 2026",
"url":"https://kyivindependent.com/ukraine-has-restored-nearly-half-of-the-power-generation-russia-wiped-out/",
"archiv":"http://web.archive.org/web/20260710081921/https://kyivindependent.com/ukraine-has-restored-nearly-half-of-the-power-generation-russia-wiped-out/",
"citace":"only around 11GW"
}
},
{
"d":"2026-02-15",
"hodnota":12,
"popis":"dostupný výkon v únoru 2026 (analytik Mikhnych; spotřeba v mrazech ~18 GW, deficit 4–6 GW)",
"overeni":"odhad",
"zdroj":{
"nazev":"Kyiv Independent, 18. 2. 2026",
"url":"https://kyivindependent.com/chart-of-the-week-russias-attacks-push-ukraines-energy-system-to-the-brink/",
"archiv":"http://web.archive.org/web/20260617105454/https://kyivindependent.com/chart-of-the-week-russias-attacks-push-ukraines-energy-system-to-the-brink/",
"citace":"Right now, Ukraine can generate approximately 12 gigawatts"
}
},
{
"d":"2026-08-15",
"hodnota":12,
"popis":"výroba po zimních útocích (deficit ~6 GW; přes 80 % výroby zničeno nebo poškozeno)",
"overeni":"odhad",
"zdroj":{
"nazev":"Glavnoe (rozhovor Šmyhala pro POLITICO), 4. 8. 2026",
"url":"https://glavnoe.in.ua/en/news-en/shmyhal-russia-is-preparing-to-target-ukraines-water-supply/amp",
"archiv":"http://web.archive.org/web/20260805141414/https://glavnoe.in.ua/en/news-en/shmyhal-russia-is-preparing-to-target-ukraines-water-supply/amp",
"citace":"After the winter attacks, electricity production fell to about 12 GW, while the power deficit stands at around 6 GW."
}
}
]
}
],
"celkovaKapacitaRU":{
"hodnota":6.5,
"jednotka":"mil. barelů/den",
"zdroj":{
"nazev":"IEA – komentář, 17. 9. 2026",
"url":"https://www.iea.org/commentaries/russian-refining-sector-struggles-amid-intensifying-ukrainian-attacks",
"archiv":"https://web.archive.org/web/20261109091606/https://www.iea.org/commentaries/russian-refining-sector-struggles-amid-intensifying-ukrainian-attacks",
"citace":"With 32 major refineries and roughly 6.5 million barrels per day (mb/d) of installed refining capacity"
},
"poznamka":"Reuters uvádí asi 6,6 mil. barelů/den (Kyiv Post 64235), v listopadu 2026 primární kapacitu asi 930 tis. t/den (US News 18. 11. 2026)."
}
}
};

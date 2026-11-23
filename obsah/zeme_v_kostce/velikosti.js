/* Země v kostce – převod velikostí oblečení a obuvi (orientačně, výrobci se liší – rozhoduje délka chodidla a míry).
   Zdroje: běžné převodní tabulky výrobců (EN 13402, ISO 9407 Mondopoint pro délku chodidla v cm). */
window.ZVK_VELIKOSTI = {
  /* země, kde se běžně používá jiný systém než evropský */
  system: { US: 'US', CA: 'US', GB: 'UK', IE: 'UK', AU: 'UK', NZ: 'UK', JP: 'JP', KR: 'JP' },
  tabulky: [
    { nazev: 'Dámská obuv', hlavicka: ['EU', 'UK', 'US', 'JP (cm)'], radky: [
      ['35', '2½', '5', '22'], ['36', '3½', '6', '23'], ['37', '4', '6½', '23,5'], ['38', '5', '7½', '24'], ['39', '6', '8½', '25'],
      ['40', '6½', '9', '25,5'], ['41', '7½', '10', '26,5'], ['42', '8', '10½', '27']] },
    { nazev: 'Pánská obuv', hlavicka: ['EU', 'UK', 'US', 'JP (cm)'], radky: [
      ['39', '5½', '6½', '24,5'], ['40', '6½', '7', '25'], ['41', '7', '8', '26'], ['42', '8', '9', '26,5'], ['43', '9', '10', '27,5'],
      ['44', '9½', '10½', '28'], ['45', '10½', '11½', '29'], ['46', '11', '12', '29,5'], ['47', '12', '13', '30,5']] },
    { nazev: 'Dámské oblečení', hlavicka: ['Mezinár.', 'EU (CZ/DE)', 'FR/ES', 'IT', 'UK/AU', 'US', 'JP'], radky: [
      ['XS', '34', '36', '40', '6', '2', '5'], ['S', '36', '38', '42', '8', '4', '7'], ['M', '38', '40', '44', '10', '6', '9'],
      ['M/L', '40', '42', '46', '12', '8', '11'], ['L', '42', '44', '48', '14', '10', '13'], ['XL', '44', '46', '50', '16', '12', '15'],
      ['XXL', '46', '48', '52', '18', '14', '17']] },
    { nazev: 'Pánská saka a obleky', hlavicka: ['Mezinár.', 'EU', 'UK/US (palce hrudníku)'], radky: [
      ['XS', '44', '34'], ['S', '46', '36'], ['M', '48', '38'], ['M/L', '50', '40'], ['L', '52', '42'], ['XL', '54', '44'], ['XXL', '56', '46']] },
    { nazev: 'Pánské košile (obvod krku)', hlavicka: ['EU (cm)', 'UK/US (palce)', 'Mezinár.'], radky: [
      ['37', '14½', 'S'], ['38', '15', 'S'], ['39–40', '15½', 'M'], ['41–42', '16–16½', 'L'], ['43–44', '17–17½', 'XL'], ['45–46', '18', 'XXL']] }
  ],
  /* převodník jednotek: [název, jednotka A, jednotka B, A→B, B→A] */
  jednotky: [
    ['Rychlost', 'km/h', 'mph', x => x / 1.609344, x => x * 1.609344],
    ['Vzdálenost', 'km', 'míle', x => x / 1.609344, x => x * 1.609344],
    ['Teplota', '°C', '°F', x => x * 9 / 5 + 32, x => (x - 32) * 5 / 9],
    ['Hmotnost', 'kg', 'lb', x => x / 0.45359237, x => x * 0.45359237],
    ['Objem', 'l', 'US gal', x => x / 3.785411784, x => x * 3.785411784],
    ['Délka', 'cm', 'palce', x => x / 2.54, x => x * 2.54],
    ['Spotřeba', 'l/100 km', 'mpg (US)', x => x > 0 ? 235.214583 / x : 0, x => x > 0 ? 235.214583 / x : 0]
  ]
};

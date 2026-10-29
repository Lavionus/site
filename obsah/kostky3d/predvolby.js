/* Herní kostky a žetony – předvolby (přepíší jen uvedené části projektu). */
(function () {
  'use strict';
  const PREDVOLBY = [
    { nazev: 'Klasická D6 s tečkami', popis: '16 mm, vyrovnané tečky (jednička větší)',
      p: { nazev: 'Kostka D6', rezim: 'kostka', kostka: { typ: 'd6', rozmer: 16, zaobleni: 1.2, kusu: 1, znaceni: 'tecky', vlastni: '' }, tecky: { prumer: 3.2, hloubka: 0.8, roztec: 4.2 }, vyrovnat: true } },
    { nazev: 'D6 s čísly, 5 kusů', popis: '16 mm, číslice Liberation Sans', 
      p: { nazev: 'Kostky D6 čísla', rezim: 'kostka', kostka: { typ: 'd6', rozmer: 16, zaobleni: 1.2, kusu: 5, znaceni: 'cisla', vlastni: '' }, pismo: { id: 'libsans', velikost: 55, hloubka: 0.6, podtrzeni: true }, vyrovnat: true } },
    { nazev: 'D20 na hraní RPG', popis: '22 mm stěna–stěna, podtržená 6 a 9',
      p: { nazev: 'Kostka D20', rezim: 'kostka', kostka: { typ: 'd20', rozmer: 22, zaobleni: 1, kusu: 1, znaceni: 'cisla', vlastni: '' }, pismo: { id: 'libsans', velikost: 50, hloubka: 0.6, podtrzeni: true }, vyrovnat: true } },
    { nazev: 'RPG sada 7 kostek', popis: 'D4, D6, D8, D10, D%, D12, D20 ze standardních poměrů',
      p: { nazev: 'RPG sada', rezim: 'sada', kostka: { rozmer: 16, zaobleni: 0.8, znaceni: 'cisla' }, pismo: { id: 'libsans', velikost: 60, hloubka: 0.6, podtrzeni: true }, vyrovnat: true } },
    { nazev: 'Mince D2 Panna / Orel', popis: 'Ø 25 mm, P a O na čelech',
      p: { nazev: 'Mince', rezim: 'kostka', kostka: { typ: 'd2', rozmer: 25, tloustka: 3, zaobleni: 0.8, kusu: 1, vlastni: 'P\nO' }, pismo: { id: 'libsans', velikost: 55, hloubka: 0.6, podtrzeni: false }, vyrovnat: true } },
    { nazev: 'Herní žetony 1 / 5 / 10', popis: 'Ø 25 mm, vyryté hodnoty, 12 kusů',
      p: { nazev: 'Žetony', rezim: 'zetony', zeton: { tvar: 'kruh', prumer: 25, tloustka: 3.2, zkoseni: 0.6, znaceni: 'vyryte', vyska: 40, hloubka: 0.6, obeStrany: false, hodnoty: '1×6, 5×4, 10×2' } } },
    { nazev: 'Šestiúhelníkové žetony', popis: '20 mm přes plochy, vystouplá čísla 1–6',
      p: { nazev: 'Hex žetony', rezim: 'zetony', zeton: { tvar: 'sestiuhelnik', prumer: 20, tloustka: 3, zkoseni: 0.4, znaceni: 'vystouple', vyska: 45, hloubka: 0.8, obeStrany: false, hodnoty: '1, 2, 3, 4, 5, 6' } } },
    { nazev: 'Člověče, nezlob se', popis: '4 hráči × 4 kuželové figurky',
      p: { nazev: 'Figurky Člověče', rezim: 'figurky', figurka: { typ: 'kuzel', vyska: 24, prumer: 14, hracu: 4, kusu: 4 } } },
    { nazev: 'Panáčci do deskovek', popis: '5 hráčů × 6, ploší, 6 mm',
      p: { nazev: 'Panáčci', rezim: 'figurky', figurka: { typ: 'meeple', vyska: 20, prumer: 20, tloustka: 6, hracu: 5, kusu: 6 } } },
  ];
  if (typeof module !== 'undefined') module.exports = PREDVOLBY; else window.KOSTKY3D_PREDVOLBY = PREDVOLBY;
})();

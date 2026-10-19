/* rozhodovani/sablony.js – ukázkové projekty. Čísla jsou ILUSTRATIVNÍ (orientační, ne aktuální ceny ani měření),
   slouží k vyzkoušení nástroje; před skutečným rozhodnutím je nahraďte vlastními údaji. */
(function () {
  'use strict';
  const SABLONY = [
    {
      id: 'produkt',
      nazev: 'Výběr produktu – pracovní notebook',
      projekt: {
        nazev: 'Pracovní notebook',
        poznamka: 'Ilustrativní hodnoty pěti typových konfigurací (bez značek). Nahraďte údaji z konkrétních nabídek.',
        kriteria: [
          { id: 'cena', nazev: 'Cena', typ: 'min', jednotka: 'Kč', vaha: 80 },
          { id: 'hmot', nazev: 'Hmotnost', typ: 'min', jednotka: 'kg', vaha: 40 },
          { id: 'bat', nazev: 'Výdrž baterie', typ: 'max', jednotka: 'h', vaha: 55 },
          { id: 'vykon', nazev: 'Výkon (benchmark)', typ: 'max', jednotka: 'bodů', vaha: 60 },
          { id: 'disp', nazev: 'Kvalita displeje', typ: 'subj', jednotka: '', vaha: 45 },
          { id: 'klav', nazev: 'Klávesnice a ergonomie', typ: 'subj', jednotka: '', vaha: 35 }
        ],
        alternativy: [
          { nazev: 'Ultrabook 14″', hodnoty: [32990, 1.2, 14, 9800, 8, 7] },
          { nazev: 'Pracovní 15,6″', hodnoty: [24990, 1.8, 9, 11200, 6, 8] },
          { nazev: 'Výkonný 16″', hodnoty: [44990, 2.3, 7, 17500, 9, 7] },
          { nazev: 'Levný 15,6″', hodnoty: [14990, 1.9, 6, 6200, 5, 5] },
          { nazev: 'Konvertibilní 13″', hodnoty: [28990, 1.3, 11, 8100, 7, 6] }
        ]
      }
    },
    {
      id: 'technologie',
      nazev: 'Výběr technologie – informační systém',
      projekt: {
        nazev: 'Informační systém pro firmu',
        poznamka: 'Ilustrativní srovnání způsobů pořízení systému. Náklady za 1. rok v tis. Kč, pokrytí požadavků z analýzy.',
        kriteria: [
          { id: 'poriz', nazev: 'Pořizovací náklady', typ: 'min', jednotka: 'tis. Kč', vaha: 60 },
          { id: 'provoz', nazev: 'Provozní náklady', typ: 'min', jednotka: 'tis. Kč/rok', vaha: 50 },
          { id: 'doba', nazev: 'Doba nasazení', typ: 'min', jednotka: 'týdnů', vaha: 35 },
          { id: 'pokryti', nazev: 'Pokrytí požadavků', typ: 'max', jednotka: '%', vaha: 80 },
          { id: 'bezp', nazev: 'Bezpečnost a soulad', typ: 'subj', jednotka: '', vaha: 55 },
          { id: 'nezav', nazev: 'Nezávislost na dodavateli', typ: 'subj', jednotka: '', vaha: 40 }
        ],
        alternativy: [
          { nazev: 'Vlastní vývoj', hodnoty: [1800, 240, 40, 95, 7, 9] },
          { nazev: 'Krabicové řešení (SaaS)', hodnoty: [150, 420, 6, 75, 8, 3] },
          { nazev: 'Open-source + integrátor', hodnoty: [650, 180, 16, 85, 7, 7] },
          { nazev: 'Low-code platforma', hodnoty: [400, 300, 10, 80, 6, 4] }
        ]
      }
    },
    {
      id: 'cesta',
      nazev: 'Cestovní varianta – Praha → Vídeň',
      projekt: {
        nazev: 'Cesta Praha → Vídeň (1 osoba, jedním směrem)',
        poznamka: 'Orientační hodnoty: doba „od dveří ke dveřím“ včetně cesty na nádraží/letiště, emise CO₂ odhadem na osobu.',
        kriteria: [
          { id: 'cena', nazev: 'Cena', typ: 'min', jednotka: 'Kč', vaha: 60 },
          { id: 'doba', nazev: 'Doba od dveří ke dveřím', typ: 'min', jednotka: 'h', vaha: 55 },
          { id: 'co2', nazev: 'Emise CO₂', typ: 'min', jednotka: 'kg', vaha: 35 },
          { id: 'pohodli', nazev: 'Pohodlí', typ: 'subj', jednotka: '', vaha: 40 },
          { id: 'flex', nazev: 'Flexibilita odjezdu', typ: 'subj', jednotka: '', vaha: 30 },
          { id: 'prace', nazev: 'Možnost pracovat cestou', typ: 'subj', jednotka: '', vaha: 25 },
          { id: 'zavaz', nazev: 'Zavazadla v ceně', typ: 'max', jednotka: 'kg', vaha: 15 }
        ],
        alternativy: [
          { nazev: 'Vlak', hodnoty: [690, 4.6, 9, 8, 6, 9, 40] },
          { nazev: 'Dálkový autobus', hodnoty: [450, 5.0, 12, 5, 6, 5, 20] },
          { nazev: 'Vlastní auto', hodnoty: [1700, 4.0, 58, 6, 10, 1, 100] },
          { nazev: 'Letadlo', hodnoty: [2600, 4.8, 80, 6, 3, 4, 8] },
          { nazev: 'Spolujízda', hodnoty: [500, 4.4, 18, 5, 5, 3, 15] }
        ]
      }
    },
    {
      id: 'auto',
      nazev: 'Koupě auta – rodinný vůz',
      projekt: {
        nazev: 'Rodinné auto (ojeté do 5 let)',
        metoda: 'mavt',
        poznamka: 'Ilustrativní typové vozy bez značek. Spotřeba v l/100 km (u elektromobilu přepočtená cena energie na ekvivalent), náklady na servis odhadem jako rozpětí.',
        kriteria: [
          { id: 'cena', nazev: 'Pořizovací cena', typ: 'min', jednotka: 'tis. Kč', vaha: 80, prahMax: 650 },
          { id: 'provoz', nazev: 'Provozní náklady', typ: 'min', jednotka: 'Kč/km', vaha: 55 },
          { id: 'kufr', nazev: 'Zavazadlový prostor', typ: 'max', jednotka: 'l', vaha: 45,
            funkce: [[300, 0], [550, 1], [700, 1]] },
          { id: 'bezp', nazev: 'Bezpečnost (Euro NCAP)', typ: 'max', jednotka: 'hvězd', vaha: 50, prahMin: 4 },
          { id: 'servis', nazev: 'Servis a spolehlivost', typ: 'subj', jednotka: '', vaha: 40 },
          { id: 'jizda', nazev: 'Jízdní komfort', typ: 'subj', jednotka: '', vaha: 30 }
        ],
        alternativy: [
          { nazev: 'Kombi naftové', hodnoty: [520, 2.4, 610, 5, 7, 7] },
          { nazev: 'SUV hybrid', hodnoty: [690, 2.2, 520, 5, 8, 8] },
          { nazev: 'Hatchback benzín', hodnoty: [380, 2.6, 380, 4, 7, 6] },
          { nazev: 'Elektromobil kompakt', hodnoty: [610, 1.3, 430, 5, 6, 8], intervaly: [null, [0.9, 1.8], null, null, null, null] },
          { nazev: 'MPV benzín', hodnoty: [450, 2.9, 650, 3, 6, 6] }
        ]
      }
    },
    {
      id: 'bydleni',
      nazev: 'Výběr bydlení – pronájem bytu',
      projekt: {
        nazev: 'Pronájem bytu 2+kk / 3+kk',
        metoda: 'mavt',
        poznamka: 'Ilustrativní nabídky. Plocha má hodnotovou funkci s nasycením (nad 75 m² už další metry nepřidávají), dojezd do práce je odhad min–max.',
        kriteria: [
          { id: 'najem', nazev: 'Nájem vč. služeb', typ: 'min', jednotka: 'Kč/měs.', vaha: 80, prahMax: 26000 },
          { id: 'plocha', nazev: 'Užitná plocha', typ: 'max', jednotka: 'm²', vaha: 50, funkce: [[40, 0], [75, 1], [120, 1]] },
          { id: 'dojezd', nazev: 'Dojezd do práce', typ: 'min', jednotka: 'min', vaha: 60 },
          { id: 'okoli', nazev: 'Okolí a občanská vybavenost', typ: 'subj', jednotka: '', vaha: 40 },
          { id: 'stav', nazev: 'Stav bytu', typ: 'subj', jednotka: '', vaha: 35 },
          { id: 'hluk', nazev: 'Klid (hluk)', typ: 'subj', jednotka: '', vaha: 25 }
        ],
        alternativy: [
          { nazev: 'Centrum, 2+kk', hodnoty: [24500, 52, 15, 9, 7, 4], intervaly: [null, null, [10, 20], null, null, null] },
          { nazev: 'Sídliště, 3+kk', hodnoty: [21000, 74, 35, 6, 5, 6], intervaly: [null, null, [30, 45], null, null, null] },
          { nazev: 'Novostavba okraj, 3+kk', hodnoty: [25500, 82, 45, 5, 10, 8], intervaly: [null, null, [35, 60], null, null, null] },
          { nazev: 'Činžák vnitroblok, 2+kk', hodnoty: [22000, 61, 25, 8, 6, 8], intervaly: [null, null, [20, 30], null, null, null] }
        ]
      }
    },
    {
      id: 'dodavatel',
      nazev: 'Výběr dodavatele – zakázka',
      projekt: {
        nazev: 'Dodavatel komponent',
        metoda: 'mavt',
        poznamka: 'Ilustrativní nabídky ve výběrovém řízení. Reference = počet srovnatelných dodávek za 3 roky.',
        kriteria: [
          { id: 'cena', nazev: 'Nabídková cena', typ: 'min', jednotka: 'tis. Kč', vaha: 70 },
          { id: 'dodani', nazev: 'Dodací lhůta', typ: 'min', jednotka: 'dní', vaha: 45, prahMax: 60 },
          { id: 'kvalita', nazev: 'Zmetkovitost', typ: 'min', jednotka: 'ppm', vaha: 55 },
          { id: 'ref', nazev: 'Reference', typ: 'max', jednotka: 'zakázek', vaha: 30, funkce: [[0, 0], [5, 0.8], [15, 1]] },
          { id: 'zaruka', nazev: 'Záruka', typ: 'max', jednotka: 'měs.', vaha: 25 },
          { id: 'komunikace', nazev: 'Komunikace a podpora', typ: 'subj', jednotka: '', vaha: 30 }
        ],
        alternativy: [
          { nazev: 'Dodavatel A (tuzemský)', hodnoty: [1250, 21, 120, 12, 24, 9] },
          { nazev: 'Dodavatel B (EU)', hodnoty: [1080, 35, 250, 8, 24, 7] },
          { nazev: 'Dodavatel C (Asie)', hodnoty: [820, 70, 400, 20, 12, 5] },
          { nazev: 'Dodavatel D (nový)', hodnoty: [990, 28, 180, 2, 36, 8] }
        ]
      }
    },
    {
      id: 'zamestnani',
      nazev: 'Výběr zaměstnání – pracovní nabídky',
      projekt: {
        nazev: 'Porovnání pracovních nabídek',
        metoda: 'mavt',
        poznamka: 'Ilustrativní nabídky. Mzda hrubá měsíčně, dojíždění jednosměrně, home office dny týdně.',
        kriteria: [
          { id: 'mzda', nazev: 'Hrubá mzda', typ: 'max', jednotka: 'Kč', vaha: 75, prahMin: 45000 },
          { id: 'dojizdeni', nazev: 'Dojíždění', typ: 'min', jednotka: 'min', vaha: 45 },
          { id: 'ho', nazev: 'Home office', typ: 'max', jednotka: 'dní/týden', vaha: 35, funkce: [[0, 0], [2, 0.8], [5, 1]] },
          { id: 'rust', nazev: 'Profesní růst', typ: 'subj', jednotka: '', vaha: 55 },
          { id: 'jistota', nazev: 'Stabilita firmy', typ: 'subj', jednotka: '', vaha: 40 },
          { id: 'tym', nazev: 'Tým a kultura', typ: 'subj', jednotka: '', vaha: 45 }
        ],
        alternativy: [
          { nazev: 'Korporace', hodnoty: [68000, 40, 2, 6, 9, 6] },
          { nazev: 'Startup', hodnoty: [62000, 25, 4, 9, 4, 8], intervaly: [[55000, 75000], null, null, null, null, null] },
          { nazev: 'Státní správa', hodnoty: [52000, 20, 1, 5, 10, 6] },
          { nazev: 'Střední firma (současná)', hodnoty: [58000, 15, 1, 5, 7, 7] }
        ]
      }
    }
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = SABLONY;
  else window.RozhodovaniSablony = SABLONY;
})();

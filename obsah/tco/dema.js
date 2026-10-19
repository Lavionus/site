/* ============================================================
   tco/dema.js – demonstrační scénáře kalkulátoru TCO.

   RUČNĚ STÁRNOUCÍ DATA: ceny jsou orientační odhady cenové hladiny
   v ČR (Kč vč. DPH u domácností, bez DPH u firemního zařízení)
   zapsané k datu `datumCen`. Nejsou to nabídky konkrétních prodejců.
   Před rozhodnutím vždy dosaď vlastní ceny a nabídky.
   ============================================================ */
(function () {
  'use strict';
  const FIN_NE = { zapnuto: false, akontace: 20, akontaceTyp: 'procenta', sazba: 6, sazbaTyp: 'urok', mesicu: 60, poplatek: 0 };

  const DEMA = [
    {
      klic: 'auto',
      nazev: '🚗 Automobil: benzín × elektromobil × ojetý diesel',
      datumCen: '2026-10-19',
      zdroj: 'Orientační odhad autora stránky podle cenové hladiny v ČR 2025–2026: ceníky nových vozů nižší střední třídy, ' +
        'inzertní ceny ojetin, průměrné ceny PHM (ČSÚ / CCS), domácí tarif elektřiny vč. distribuce a veřejné nabíjení (srovnávače), ' +
        'pojištění podle běžných nabídek. Elektromobil v ČR nemá povinnou dálniční známku. Hodnoty nejsou ověřené k datu – dosaď vlastní.',
      scenar: {
        verze: 1, nazev: 'Demo – automobil (15 000 km/rok)',
        poznamka: 'Cena elektřiny 6 Kč/kWh je mix ~80 % domácího a ~20 % veřejného nabíjení, spotřeba vč. ztrát nabíjení.',
        glob: { rezim: 'nominalni', diskont: 5, diskontTyp: 'nominalni', inflace: 2.5, rustEnergie: 2, horizontTyp: 'nejdelsi', horizontLet: 10, mena: 'Kč' },
        varianty: [
          { nazev: 'Benzín – nový kompakt', cena: 549000, zivotnost: 10, pouzitiRocne: 15000, jednotkaPouziti: 'km',
            energieNaPouziti: 0.062, energieRocne: 0, jednotkaEnergie: 'l', cenaEnergie: 36.5,
            servisRocne: 8000, servisPeriodicky: 18000, servisPeriodaLet: 4, materialNaPouziti: 0.40,
            ostatniRocne: 18500, zustatek: 150000, financovani: FIN_NE },
          { nazev: 'Elektromobil – nový, na úvěr', cena: 899000, zivotnost: 10, pouzitiRocne: 15000, jednotkaPouziti: 'km',
            energieNaPouziti: 0.175, energieRocne: 0, jednotkaEnergie: 'kWh', cenaEnergie: 6.0,
            servisRocne: 4500, servisPeriodicky: 8000, servisPeriodaLet: 4, materialNaPouziti: 0.45,
            ostatniRocne: 16000, zustatek: 230000,
            financovani: { zapnuto: true, akontace: 30, akontaceTyp: 'procenta', sazba: 6.9, sazbaTyp: 'urok', mesicu: 60, poplatek: 3500 } },
          { nazev: 'Diesel – ojetý (5 let)', cena: 329000, zivotnost: 6, pouzitiRocne: 15000, jednotkaPouziti: 'km',
            energieNaPouziti: 0.055, energieRocne: 0, jednotkaEnergie: 'l', cenaEnergie: 35.5,
            servisRocne: 12000, servisPeriodicky: 35000, servisPeriodaLet: 3, materialNaPouziti: 0.40,
            ostatniRocne: 17500, zustatek: 90000, financovani: FIN_NE }
        ]
      }
    },
    {
      klic: 'pracka',
      nazev: '🧺 Domácí spotřebič: tři pračky',
      datumCen: '2026-10-19',
      zdroj: 'Orientační odhad autora stránky podle cenové hladiny v ČR 2025–2026: ceny praček v e-shopech, spotřeba programu ' +
        'eco 40-60 podle energetických štítků (EU 2019/2014), elektřina 6,2 Kč/kWh vč. distribuce a DPH, vodné + stočné ' +
        '≈ 135 Kč/m³, prací prostředek ≈ 6 Kč/dávku. Hodnoty nejsou ověřené k datu – dosaď vlastní.',
      scenar: {
        verze: 1, nazev: 'Demo – pračka (200 praní/rok)',
        poznamka: 'Materiál na cyklus = voda (litry × 0,135 Kč) + prací prostředek. Levná pračka má započtenou jednu opravu za 4 roky.',
        glob: { rezim: 'diskontovane', diskont: 3, diskontTyp: 'realna', inflace: 2.5, rustEnergie: 2, horizontTyp: 'nejdelsi', horizontLet: 14, mena: 'Kč' },
        varianty: [
          { nazev: 'Levná (energetická třída D)', cena: 8990, zivotnost: 7, pouzitiRocne: 200, jednotkaPouziti: 'praní',
            energieNaPouziti: 0.95, energieRocne: 2, jednotkaEnergie: 'kWh', cenaEnergie: 6.2,
            servisRocne: 0, servisPeriodicky: 2500, servisPeriodaLet: 4, materialNaPouziti: 13.4,
            ostatniRocne: 0, zustatek: 0, financovani: FIN_NE },
          { nazev: 'Střední (třída B)', cena: 12990, zivotnost: 10, pouzitiRocne: 200, jednotkaPouziti: 'praní',
            energieNaPouziti: 0.72, energieRocne: 1.5, jednotkaEnergie: 'kWh', cenaEnergie: 6.2,
            servisRocne: 0, servisPeriodicky: 2500, servisPeriodaLet: 6, materialNaPouziti: 12.5,
            ostatniRocne: 0, zustatek: 0, financovani: FIN_NE },
          { nazev: 'Úsporná (třída A)', cena: 18990, zivotnost: 14, pouzitiRocne: 200, jednotkaPouziti: 'praní',
            energieNaPouziti: 0.55, energieRocne: 1, jednotkaEnergie: 'kWh', cenaEnergie: 6.2,
            servisRocne: 0, servisPeriodicky: 0, servisPeriodaLet: 0, materialNaPouziti: 11.2,
            ostatniRocne: 0, zustatek: 0, financovani: FIN_NE }
        ]
      }
    },
    {
      klic: 'kompresor',
      nazev: '🏭 Technické zařízení: šroubový kompresor 15 kW',
      datumCen: '2026-10-19',
      zdroj: 'Orientační odhad autora stránky (bez DPH): ceníky šroubových kompresorů 15 kW, průměrný příkon podle typického ' +
        'profilu odběru 60–70 % (pevné otáčky vč. chodu naprázdno × frekvenční měnič), cena silové elektřiny pro malý podnik ' +
        '≈ 4,2 Kč/kWh vč. distribuce, servisní intervaly výrobců (olej, filtry, separátor, generálka bloku). Hodnoty nejsou ověřené k datu – dosaď vlastní.',
      scenar: {
        verze: 1, nazev: 'Demo – kompresor (4 000 h/rok)',
        poznamka: 'Firemní pohled: ceny bez DPH, diskontní sazba ≈ náklad kapitálu firmy. Daňové odpisy nejsou zahrnuty.',
        glob: { rezim: 'diskontovane', diskont: 8, diskontTyp: 'nominalni', inflace: 2.5, rustEnergie: 3, horizontTyp: 'nejdelsi', horizontLet: 12, mena: 'Kč' },
        varianty: [
          { nazev: 'Pevné otáčky', cena: 245000, zivotnost: 12, pouzitiRocne: 4000, jednotkaPouziti: 'h',
            energieNaPouziti: 11.0, energieRocne: 0, jednotkaEnergie: 'kWh', cenaEnergie: 4.2,
            servisRocne: 14000, servisPeriodicky: 60000, servisPeriodaLet: 5, materialNaPouziti: 2.5,
            ostatniRocne: 0, zustatek: 15000, financovani: FIN_NE },
          { nazev: 'Frekvenční měnič (VSD)', cena: 345000, zivotnost: 12, pouzitiRocne: 4000, jednotkaPouziti: 'h',
            energieNaPouziti: 8.4, energieRocne: 0, jednotkaEnergie: 'kWh', cenaEnergie: 4.2,
            servisRocne: 16000, servisPeriodicky: 60000, servisPeriodaLet: 5, materialNaPouziti: 2.5,
            ostatniRocne: 0, zustatek: 25000,
            financovani: FIN_NE }
        ]
      }
    }
  ];

  const API = { DEMA };
  if (typeof module !== 'undefined') module.exports = API; else window.TCO_DEMA = API;
})();

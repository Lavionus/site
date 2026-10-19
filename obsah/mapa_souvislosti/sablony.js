/* ============================================================
   mapa_souvislosti/sablony.js – ukázkové mapy.
   Uzel: [název, typ, datum, popis, tagy, odkaz]   Vztah: [od, do, popis, směr]
   Rozmístění se dopočítá při vložení (silově, se stejným seedem).
   ============================================================ */
(function () {
  'use strict';
  const SABLONY = [
    {
      id: 'pocitace',
      nazev: 'Počátky výpočetní techniky',
      popis: 'Lidé, stroje a myšlenky od Babbageova analytického stroje po web.',
      uzly: [
        ['Charles Babbage', 'osoba', '1791', 'Anglický matematik (1791–1871). Navrhl diferenční a později analytický stroj – první koncept programovatelného počítače.', ['matematika']],
        ['Analytický stroj', 'technologie', '1837', 'Mechanický počítač s „mlýnem“ (výpočetní jednotkou) a „skladem“ (pamětí), řízený děrnými štítky. Za Babbageova života nebyl postaven.', ['mechanika']],
        ['Ada Lovelace', 'osoba', '1815', 'Matematička (1815–1852). V poznámkách k překladu článku o analytickém stroji (1843) popsala postup výpočtu Bernoulliho čísel – bývá považován za první program.', ['programování']],
        ['Poznámky k analytickému stroji', 'udalost', '1843', 'Ada Lovelace připojila k překladu Menabreova článku poznámky A–G; poznámka G obsahuje algoritmus.', ['programování']],
        ['Alan Turing', 'osoba', '1912', 'Britský matematik (1912–1954), zakladatel teorie vyčíslitelnosti, za války kryptoanalytik v Bletchley Parku.', ['matematika', 'kryptografie']],
        ['Turingův stroj', 'pojem', '1936', 'Abstraktní model výpočtu z článku „On Computable Numbers“ (1936). Definuje, co je algoritmicky vyčíslitelné.', ['teorie']],
        ['Bletchley Park', 'misto', '1939', 'Sídlo britských luštitelů šifer za druhé světové války.', ['kryptografie']],
        ['Enigma', 'technologie', '', 'Německý šifrovací stroj s rotory. Jeho luštění urychlily elektromechanické stroje Bombe.', ['kryptografie']],
        ['Colossus', 'technologie', '1944', 'Elektronkový stroj pro luštění Lorenzovy šifry, konstruktér Tommy Flowers. Jeden z prvních elektronických číslicových počítačů.', ['elektronky']],
        ['Konrad Zuse', 'osoba', '1910', 'Německý inženýr (1910–1995), sestrojil reléový počítač Z3.', []],
        ['Z3', 'technologie', '1941', 'Reléový programovatelný počítač v binární soustavě s pohyblivou řádovou čárkou, Berlín 1941.', ['relé']],
        ['ENIAC', 'technologie', '1945', 'Elektronkový počítač Pensylvánské univerzity (J. P. Eckert, J. Mauchly), dokončen 1945. Asi 18 000 elektronek.', ['elektronky']],
        ['John von Neumann', 'osoba', '1903', 'Matematik (1903–1957), autor zprávy First Draft of a Report on the EDVAC.', ['matematika']],
        ['Von Neumannova architektura', 'pojem', '1945', 'Program a data ve společné paměti, řadič, aritmeticko-logická jednotka, vstup a výstup.', ['teorie', 'architektura']],
        ['Tranzistor', 'technologie', '1947', 'Polovodičová součástka z Bellových laboratoří (Bardeen, Brattain, Shockley). Nahradila elektronky.', ['polovodiče']],
        ['Bellovy laboratoře', 'organizace', '', 'Výzkumné laboratoře společnosti AT&T.', []],
        ['Integrovaný obvod', 'technologie', '1958', 'Jack Kilby (Texas Instruments, 1958) a Robert Noyce (Fairchild, 1959) – více součástek na jednom čipu.', ['polovodiče']],
        ['Intel 4004', 'technologie', '1971', 'První komerční jednočipový mikroprocesor, 4bitový.', ['mikroprocesor']],
        ['Intel', 'organizace', '1968', 'Výrobce polovodičů, spoluzakladatelé Robert Noyce a Gordon Moore.', []],
        ['Antonín Svoboda', 'osoba', '1907', 'Český konstruktér počítačů (1907–1980), vedl vývoj SAPO a EPOS.', ['Československo']],
        ['SAPO', 'technologie', '1957', 'Samočinný počítač – první československý počítač, reléový, s trojnásobnou redundancí výpočtu.', ['Československo', 'relé']],
        ['Grace Hopper', 'osoba', '1906', 'Americká informatička (1906–1992), autorka kompilátoru A-0 a spoluautorka jazyka COBOL.', ['programování']],
        ['Kompilátor', 'pojem', '1952', 'Program, který překládá zápis ve vyšším jazyce do strojového kódu.', ['programování']],
        ['ARPANET', 'technologie', '1969', 'Počítačová síť s přepojováním paketů, předchůdce internetu.', ['sítě']],
        ['World Wide Web', 'technologie', '1989', 'Hypertextový systém Tima Berners-Leeho, navržený v CERN 1989.', ['sítě']],
        ['CERN', 'organizace', '1954', 'Evropská organizace pro jaderný výzkum, Ženeva.', []]
      ],
      hrany: [
        ['Charles Babbage', 'Analytický stroj', 'navrhl'],
        ['Ada Lovelace', 'Poznámky k analytickému stroji', 'sepsala'],
        ['Poznámky k analytickému stroji', 'Analytický stroj', 'popisují program pro'],
        ['Ada Lovelace', 'Charles Babbage', 'spolupracovala', '--'],
        ['Alan Turing', 'Turingův stroj', 'definoval'],
        ['Alan Turing', 'Bletchley Park', 'pracoval v'],
        ['Bletchley Park', 'Enigma', 'luštil'],
        ['Colossus', 'Bletchley Park', 'nasazen v'],
        ['Konrad Zuse', 'Z3', 'sestrojil'],
        ['John von Neumann', 'Von Neumannova architektura', 'popsal'],
        ['ENIAC', 'Von Neumannova architektura', 'zkušenosti vedly k'],
        ['Turingův stroj', 'Von Neumannova architektura', 'teoretický základ'],
        ['Bellovy laboratoře', 'Tranzistor', 'vyvinuly'],
        ['Tranzistor', 'Integrovaný obvod', 'umožnil'],
        ['Integrovaný obvod', 'Intel 4004', 'umožnil'],
        ['Intel', 'Intel 4004', 'vyrobil'],
        ['Antonín Svoboda', 'SAPO', 'vedl vývoj'],
        ['Z3', 'SAPO', 'stejná technologie relé', '--'],
        ['Grace Hopper', 'Kompilátor', 'vytvořila první'],
        ['Kompilátor', 'Von Neumannova architektura', 'překládá pro'],
        ['ARPANET', 'World Wide Web', 'infrastruktura pro'],
        ['CERN', 'World Wide Web', 'vznikl v'],
        ['Tranzistor', 'ENIAC', 'nahradil elektronky z'],
        ['Colossus', 'ENIAC', 'současník', '--'],
        ['Alan Turing', 'Ada Lovelace', 'polemizoval s její námitkou (1950)'],
        ['Z3', 'ENIAC', 'počítače 40. let', '--'],
        ['Integrovaný obvod', 'ARPANET', 'počítače uzlů sítě postaveny z']
      ]
    },
    {
      id: 'fotosynteza',
      nazev: 'Fotosyntéza a dýchání',
      popis: 'Pojmová mapa: jak rostlina získává a využívá energii.',
      uzly: [
        ['Fotosyntéza', 'pojem', '', '6 CO₂ + 6 H₂O + světlo → C₆H₁₂O₆ + 6 O₂. Probíhá v chloroplastech.', ['biologie']],
        ['Světelná fáze', 'pojem', '', 'Na membránách tylakoidů: fotolýza vody, vzniká ATP, NADPH a kyslík.', []],
        ['Temnostní fáze (Calvinův cyklus)', 'pojem', '', 'Ve stromatu chloroplastu: fixace CO₂ enzymem RuBisCO, spotřeba ATP a NADPH, vzniká cukr.', []],
        ['Chloroplast', 'misto', '', 'Organela rostlinné buňky s vlastní DNA, obsahuje tylakoidy a stroma.', ['buňka']],
        ['Chlorofyl', 'pojem', '', 'Zelené barvivo, pohlcuje hlavně modré a červené světlo.', []],
        ['Světlo', 'zdroj', '', 'Zdroj energie pro světelnou fázi.', []],
        ['Oxid uhličitý', 'pojem', '', 'Vstupuje průduchy listu, fixuje se v Calvinově cyklu.', ['plyn']],
        ['Voda', 'pojem', '', 'Přijímá se kořeny; při fotolýze se štěpí a uvolňuje kyslík.', []],
        ['Kyslík', 'pojem', '', 'Vedlejší produkt fotosyntézy, spotřebovává se při dýchání.', ['plyn']],
        ['Glukóza', 'pojem', '', 'Cukr, zásoba chemické energie; ukládá se jako škrob.', []],
        ['Buněčné dýchání', 'pojem', '', 'C₆H₁₂O₆ + 6 O₂ → 6 CO₂ + 6 H₂O + energie (ATP). Probíhá v mitochondriích.', []],
        ['Mitochondrie', 'misto', '', 'Organela, ve které probíhá Krebsův cyklus a dýchací řetězec.', ['buňka']],
        ['ATP', 'pojem', '', 'Adenosintrifosfát – univerzální přenašeč energie v buňce.', []],
        ['Průduchy', 'misto', '', 'Otvory v pokožce listu pro výměnu plynů a odpar vody.', ['list']],
        ['Jan Ingenhousz', 'osoba', '1779', 'Prokázal, že rostliny na světle uvolňují kyslík (1779).', ['historie']],
        ['Melvin Calvin', 'osoba', '1961', 'Popsal cyklus fixace uhlíku; Nobelova cena za chemii 1961.', ['historie']]
      ],
      hrany: [
        ['Fotosyntéza', 'Světelná fáze', 'má fázi'],
        ['Fotosyntéza', 'Temnostní fáze (Calvinův cyklus)', 'má fázi'],
        ['Fotosyntéza', 'Chloroplast', 'probíhá v'],
        ['Chlorofyl', 'Chloroplast', 'je uložen v'],
        ['Světlo', 'Světelná fáze', 'pohání'],
        ['Chlorofyl', 'Světlo', 'pohlcuje'],
        ['Voda', 'Světelná fáze', 'vstupuje do'],
        ['Světelná fáze', 'Kyslík', 'uvolňuje'],
        ['Světelná fáze', 'ATP', 'vytváří'],
        ['ATP', 'Temnostní fáze (Calvinův cyklus)', 'pohání'],
        ['Oxid uhličitý', 'Temnostní fáze (Calvinův cyklus)', 'vstupuje do'],
        ['Temnostní fáze (Calvinův cyklus)', 'Glukóza', 'vytváří'],
        ['Průduchy', 'Oxid uhličitý', 'propouštějí'],
        ['Glukóza', 'Buněčné dýchání', 'vstupuje do'],
        ['Kyslík', 'Buněčné dýchání', 'vstupuje do'],
        ['Buněčné dýchání', 'Mitochondrie', 'probíhá v'],
        ['Buněčné dýchání', 'ATP', 'vytváří'],
        ['Buněčné dýchání', 'Oxid uhličitý', 'uvolňuje'],
        ['Fotosyntéza', 'Buněčné dýchání', 'opačný děj', '<->'],
        ['Jan Ingenhousz', 'Fotosyntéza', 'objevil roli světla'],
        ['Melvin Calvin', 'Temnostní fáze (Calvinův cyklus)', 'popsal']
      ]
    }
  ];

  function vytvor(J, sablona) {
    const m = J.novaMapa(sablona.nazev);
    m.popis = sablona.popis || '';
    const id = new Map();
    for (const [nazev, typ, datum, popis, tagy, odkaz] of sablona.uzly) {
      const u = J.pridejUzel(m, { nazev, typ, datum, popis, tagy, odkaz });
      id.set(nazev, u.id);
    }
    for (const [a, b, popis, smer] of sablona.hrany) {
      if (!id.has(a) || !id.has(b)) throw new Error('Šablona „' + sablona.id + '“: neznámý uzel ve vztahu ' + a + ' → ' + b);
      J.pridejHranu(m, id.get(a), id.get(b), { popis, smer: smer || '->' });
    }
    return m;
  }

  const API = { SABLONY, vytvor };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else window.MapaSablony = API;
})();

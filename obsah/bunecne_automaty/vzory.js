/* ============================================================
   bunecne_automaty/vzory.js – knihovna klasických vzorů.

   Vzory jsou matematické objekty (konfigurace buněk), nikoli autorská
   díla; RLE zápisy zde jsou přepsány ručně a ověřeny testem
   _test/bunecne_automaty_test.js (perioda, posun, emise kluzáků …).
   Původ (objevitel, rok) podle běžně citovaných pramenů
   (M. Gardner, Scientific American 1970–71; LifeWiki; Wolfram 2002).
   Vzory Wireworld (dioda, hodiny) jsou sestaveny pro tuto laboratoř.
   ============================================================ */
(function () {
'use strict';
const VZORY = [
  // --- Život B3/S23: zátiší
  { id: 'blok', nazev: 'Blok', kat: 'Zátiší', pravidlo: 'B3/S23', rle: '2o$2o!', puvod: 'Nejčastější zátiší, známé od počátků (1970).', popis: 'Čtyři buňky, každá má 3 sousedy – nic se nemění.' },
  { id: 'ul', nazev: 'Úl (beehive)', kat: 'Zátiší', pravidlo: 'B3/S23', rle: 'b2o$o2bo$b2o!', puvod: 'Conwayova skupina, 1970.', popis: 'Druhé nejčastější zátiší.' },
  { id: 'bochnik', nazev: 'Bochník (loaf)', kat: 'Zátiší', pravidlo: 'B3/S23', rle: 'b2o$o2bo$bobo$2bo!', puvod: 'Conwayova skupina, 1970.', popis: 'Sedmibuněčné zátiší.' },
  { id: 'lodka', nazev: 'Loďka (boat)', kat: 'Zátiší', pravidlo: 'B3/S23', rle: '2o$obo$bo!', puvod: 'Conwayova skupina, 1970.', popis: 'Pětibuněčné zátiší.' },
  { id: 'pozirac', nazev: 'Požírač 1 (eater 1)', kat: 'Zátiší', pravidlo: 'B3/S23', rle: '2o$obo$2bo$2b2o!', puvod: 'Popsal R. W. Gosper (MIT), 1971.', popis: 'Zátiší, které „sní“ narážející kluzák a samo se obnoví.' },
  // --- oscilátory
  { id: 'blinkr', nazev: 'Blinkr', kat: 'Oscilátory', pravidlo: 'B3/S23', rle: '3o!', puvod: 'Conway, 1970.', popis: 'Nejmenší oscilátor, perioda 2.', perioda: 2 },
  { id: 'ropucha', nazev: 'Ropucha (toad)', kat: 'Oscilátory', pravidlo: 'B3/S23', rle: 'b3o$3o!', puvod: 'Simon Norton, 1970.', popis: 'Perioda 2.', perioda: 2 },
  { id: 'majak', nazev: 'Maják (beacon)', kat: 'Oscilátory', pravidlo: 'B3/S23', rle: '2o$2o$2b2o$2b2o!', puvod: 'Conway, 1970.', popis: 'Dva bloky, rohové buňky blikají; perioda 2.', perioda: 2 },
  { id: 'pulsar', nazev: 'Pulsar', kat: 'Oscilátory', pravidlo: 'B3/S23', rle: '2b3o3b3o2b2$o4bobo4bo$o4bobo4bo$o4bobo4bo$2b3o3b3o2b2$2b3o3b3o2b$o4bobo4bo$o4bobo4bo$o4bobo4bo2$2b3o3b3o!', puvod: 'Conway, 1970.', popis: 'Nejčastější oscilátor s periodou 3.', perioda: 3 },
  { id: 'osmicka', nazev: 'Osmička (figure eight)', kat: 'Oscilátory', pravidlo: 'B3/S23', rle: '3o$3o$3o$3b3o$3b3o$3b3o!', puvod: 'Simon Norton, 1970.', popis: 'Perioda 8.', perioda: 8 },
  { id: 'pentadekatlon', nazev: 'Pentadekatlon', kat: 'Oscilátory', pravidlo: 'B3/S23', rle: '2bo4bo2b$2ob4ob2o$2bo4bo!', puvod: 'Conway, 1970.', popis: 'Vznikne z řady 10 buněk; perioda 15.', perioda: 15 },
  { id: 'kok', nazev: 'Kokova galaxie', kat: 'Oscilátory', pravidlo: 'B3/S23', rle: '2ob6o$2ob6o$2o$2o5b2o$2o5b2o$2o5b2o$7b2o$6ob2o$6ob2o!', puvod: 'Jan Kok, 1971.', popis: 'Točící se „galaxie“, perioda 8.', perioda: 8 },
  // --- lodě
  { id: 'kluzak', nazev: 'Kluzák (glider)', kat: 'Vesmírné lodě', pravidlo: 'B3/S23', rle: 'bo$2bo$3o!', puvod: 'Richard K. Guy, 1970.', popis: 'Za 4 generace se posune o 1 buňku úhlopříčně (rychlost c/4).', perioda: 4, posun: [1, 1] },
  { id: 'lwss', nazev: 'Lehká loď (LWSS)', kat: 'Vesmírné lodě', pravidlo: 'B3/S23', rle: 'bo2bo$o$o3bo$4o!', puvod: 'Conway, 1970.', popis: 'Pohybuje se vodorovně rychlostí c/2.', perioda: 4, posun: [-2, 0] },
  { id: 'mwss', nazev: 'Střední loď (MWSS)', kat: 'Vesmírné lodě', pravidlo: 'B3/S23', rle: '3bo$bo3bo$o$o4bo$5o!', puvod: 'Conway, 1970.', popis: 'Rychlost c/2.', perioda: 4, posun: [-2, 0] },
  { id: 'hwss', nazev: 'Těžká loď (HWSS)', kat: 'Vesmírné lodě', pravidlo: 'B3/S23', rle: '3b2o$bo4bo$o$o5bo$6o!', puvod: 'Conway, 1970.', popis: 'Rychlost c/2.', perioda: 4, posun: [-2, 0] },
  // --- děla
  { id: 'gosper', nazev: 'Gosperovo kluzákové dělo', kat: 'Děla a růst', pravidlo: 'B3/S23', rle: '24bo$22bobo$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o$2o8bo3bob2o4bobo$10bo5bo7bo$11bo3bo$12b2o!', puvod: 'Bill Gosper (MIT), 1970 – první vzor s neomezeným růstem.', popis: 'Každých 30 generací vystřelí kluzák.', perioda: 30 },
  { id: 'simkin', nazev: 'Simkinovo kluzákové dělo', kat: 'Děla a růst', pravidlo: 'B3/S23', rle: '2o5b2o$2o5b2o2$4b2o$4b2o5$22b2ob2o$21bo5bo$21bo6bo2b2o$21b3o3bo3b2o$26bo4$20b2o$20bo$21b3o$23bo!', puvod: 'Michael Simkin, 2015.', popis: 'Nejmenší známé dělo (36 buněk), perioda 120.', perioda: 120 },
  { id: 'rust5x5', nazev: 'Nekonečný růst 5×5', kat: 'Děla a růst', pravidlo: 'B3/S23', rle: '3obo$o$3b2o$b2obo$obobo!', puvod: 'Paul Callahan, 1997.', popis: 'Vzor v čtverci 5×5, který roste donekonečna (pokládá bloky).' },
  // --- metuzalémy
  { id: 'rpent', nazev: 'R-pentomino', kat: 'Metuzalémy', pravidlo: 'B3/S23', rle: 'b2o$2o$bo!', puvod: 'Conway, 1970.', popis: 'Pět buněk, ustálí se až po 1103 generacích (116 buněk včetně 6 kluzáků).' },
  { id: 'diehard', nazev: 'Diehard', kat: 'Metuzalémy', pravidlo: 'B3/S23', rle: '6bo$2o$bo3b3o!', puvod: 'Klasický metuzalém (Gardner, 1971).', popis: 'Zcela vymře po 130 generacích.' },
  { id: 'zalud', nazev: 'Žalud (acorn)', kat: 'Metuzalémy', pravidlo: 'B3/S23', rle: 'bo$3bo$2o2b3o!', puvod: 'Charles Corderman, 1971.', popis: 'Sedm buněk, ustálí se po 5206 generacích s 633 buňkami.' },
  // --- jiná pravidla
  { id: 'replikator', nazev: 'Replikátor (HighLife)', kat: 'Jiná pravidla', pravidlo: 'B36/S23', rle: '2b3o$bo2bo$o3bo$o2bo$3o!', puvod: 'Nathan Thompson, 1994.', popis: 'Každých 12 generací vytvoří svou kopii.' },
  { id: 'seeds_semeno', nazev: 'Čtveřice semen (Seeds)', kat: 'Jiná pravidla', pravidlo: 'B2/S', rle: '2o$2o!', puvod: 'Pravidlo Seeds: Brian Silverman.', popis: 'Ze čtyř buněk vyroste chaotická exploze.' },
  { id: 'brian_lod', nazev: 'Lodě Brianova mozku', kat: 'Jiná pravidla', pravidlo: 'B2/S/C3', rle: '2A$2B$2A!', puvod: 'Pravidlo Brian\'s Brain: Brian Silverman.', popis: 'Malé útvary se rozbíhají jako lodě.' },
  // --- Wireworld (A = hlava, B = ocas, C = vodič)
  { id: 'ww_hodiny', nazev: 'Hodiny (generátor elektronů)', kat: 'Wireworld', pravidlo: 'WireWorld', rle: '.BAC$C3.C10C$.3C!', puvod: 'Sestaveno pro tuto laboratoř podle pravidel B. Silvermana.', popis: 'Elektron obíhá smyčku a každých 8 generací vyšle puls do vodiče.' },
  { id: 'ww_dioda', nazev: 'Dioda (propustný směr)', kat: 'Wireworld', pravidlo: 'WireWorld', rle: '4.2C$BA3C.4C$4.2C!', puvod: 'Klasická dioda Wireworld.', popis: 'Elektron zleva projde doprava.' },
  { id: 'ww_dioda_zpet', nazev: 'Dioda (závěrný směr)', kat: 'Wireworld', pravidlo: 'WireWorld', rle: '4.2C$5C.4CAB$4.2C!', puvod: 'Klasická dioda Wireworld.', popis: 'Elektron zprava diodou neprojde.' },
  { id: 'ww_diody', nazev: 'Dvoje hodiny a dvě diody', kat: 'Wireworld', pravidlo: 'WireWorld', rle: '.BAC15.2C$C3.16C.14C$.3C15.2C3$.BAC11.2C$C3.15C.15C$.3C11.2C!', puvod: 'Sestaveno pro tuto laboratoř.', popis: 'Nahoře dioda v propustném směru (elektrony projdou), dole táž dioda obráceně (elektrony zaniknou).' },
];
const W = { VZORY };
if (typeof module !== 'undefined' && module.exports) module.exports = W;
else window.BunecneVzory = W;
})();

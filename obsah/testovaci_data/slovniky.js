/* Generátor testovacích dat – slovníky pro syntetické hodnoty.
 *
 * Křestní jména a příjmení jsou nejčastější tvary v Česku (veřejná statistika
 * četnosti jmen, MV ČR). Samostatné jméno ani příjmení není osobní údaj –
 * vznikající kombinace jsou náhodné, tj. SYNTETICKÉ, a neodpovídají žádné
 * konkrétní osobě (shoda se skutečnou osobou by byla čistě náhodná).
 *
 * Ulice a obce jsou ZÁMĚRNĚ SMYŠLENÉ (Vzorová, Testovice, Ukázkov …), aby bylo
 * na první pohled vidět, že nejde o skutečnou adresu.
 */
(function (koren) {
  'use strict';

  const zenska = ['Jana', 'Marie', 'Eva', 'Hana', 'Anna', 'Lenka', 'Kateřina', 'Věra', 'Lucie', 'Alena',
    'Petra', 'Jaroslava', 'Veronika', 'Martina', 'Ludmila', 'Jitka', 'Tereza', 'Helena', 'Michaela', 'Zdeňka',
    'Ivana', 'Monika', 'Eliška', 'Zuzana', 'Markéta', 'Jiřina', 'Barbora', 'Kristýna', 'Marcela', 'Dana',
    'Klára', 'Natálie', 'Adéla', 'Karolína', 'Simona', 'Pavla', 'Andrea', 'Šárka', 'Nikola', 'Iveta',
    'Vlasta', 'Božena', 'Irena', 'Libuše', 'Gabriela', 'Daniela', 'Denisa', 'Renata', 'Olga', 'Blanka'];

  const muzska = ['Jiří', 'Jan', 'Petr', 'Josef', 'Pavel', 'Martin', 'Tomáš', 'Jaroslav', 'Miroslav', 'Zdeněk',
    'Václav', 'Michal', 'František', 'Karel', 'Milan', 'Jakub', 'Lukáš', 'David', 'Vladimír', 'Ladislav',
    'Ondřej', 'Stanislav', 'Roman', 'Marek', 'Radek', 'Daniel', 'Antonín', 'Vojtěch', 'Filip', 'Adam',
    'Matěj', 'Aleš', 'Libor', 'Jaromír', 'Ivan', 'Miloslav', 'Dominik', 'Patrik', 'Vít', 'Oldřich',
    'Rudolf', 'Šimon', 'Štěpán', 'Luboš', 'Bohumil', 'Robert', 'Richard', 'Kamil', 'Viktor', 'Igor'];

  /* [mužský tvar, ženský tvar] – ženské tvary ručně, ne pravidlem (Němec → Němcová). */
  const prijmeni = [
    ['Novák', 'Nováková'], ['Svoboda', 'Svobodová'], ['Novotný', 'Novotná'], ['Dvořák', 'Dvořáková'],
    ['Černý', 'Černá'], ['Procházka', 'Procházková'], ['Kučera', 'Kučerová'], ['Veselý', 'Veselá'],
    ['Horák', 'Horáková'], ['Němec', 'Němcová'], ['Marek', 'Marková'], ['Pokorný', 'Pokorná'],
    ['Pospíšil', 'Pospíšilová'], ['Hájek', 'Hájková'], ['Král', 'Králová'], ['Jelínek', 'Jelínková'],
    ['Růžička', 'Růžičková'], ['Beneš', 'Benešová'], ['Fiala', 'Fialová'], ['Sedláček', 'Sedláčková'],
    ['Doležal', 'Doležalová'], ['Zeman', 'Zemanová'], ['Kolář', 'Kolářová'], ['Navrátil', 'Navrátilová'],
    ['Čermák', 'Čermáková'], ['Vaněk', 'Vaňková'], ['Urban', 'Urbanová'], ['Blažek', 'Blažková'],
    ['Kříž', 'Křížová'], ['Kovář', 'Kovářová'], ['Kratochvíl', 'Kratochvílová'], ['Bartoš', 'Bartošová'],
    ['Vlček', 'Vlčková'], ['Polák', 'Poláková'], ['Musil', 'Musilová'], ['Kopecký', 'Kopecká'],
    ['Šimek', 'Šimková'], ['Konečný', 'Konečná'], ['Malý', 'Malá'], ['Holub', 'Holubová'],
    ['Čech', 'Čechová'], ['Štěpánek', 'Štěpánková'], ['Staněk', 'Staňková'], ['Kadlec', 'Kadlecová'],
    ['Dostál', 'Dostálová'], ['Soukup', 'Soukupová'], ['Šťastný', 'Šťastná'], ['Mareš', 'Marešová'],
    ['Moravec', 'Moravcová'], ['Sýkora', 'Sýkorová'], ['Tichý', 'Tichá'], ['Valenta', 'Valentová'],
    ['Vávra', 'Vávrová'], ['Matoušek', 'Matoušková'], ['Bláha', 'Bláhová'], ['Říha', 'Říhová'],
    ['Ševčík', 'Ševčíková'], ['Bureš', 'Burešová'], ['Hruška', 'Hrušková'], ['Mašek', 'Mašková']];

  /* Smyšlené ulice – názvy jsou záměrně „testovací“. */
  const ulice = ['Vzorová', 'Testovací', 'Ukázková', 'Smyšlená', 'Fiktivní', 'Pokusná', 'Modelová',
    'Náhodná', 'Syntetická', 'Zkušební', 'Generovaná', 'Datová', 'Šablonová', 'Cvičná', 'Simulační',
    'Ladicí', 'Prototypová', 'Maketová', 'Zástupná', 'Demonstrační',
    'U Testovacího mlýna', 'Na Vzorovém kopci', 'Pod Ukázkovou skálou', 'Za Smyšleným rybníkem',
    'Nábřeží Fiktivních dat', 'Náměstí Testovacích dat', 'U Generátoru', 'Na Datové louce',
    'K Šablonám', 'Ve Zkušebně', 'Nad Prototypem', 'Pod Maketou', 'U Zástupné lípy', 'V Simulaci',
    'Třída Syntetických hodnot', 'Alej Náhodných čísel', 'Sady Pokusníků', 'Na Cvičišti dat'];

  /* Smyšlené obce – základ, ke kterému lze přidat Horní/Dolní… */
  const obceZaklad = ['Vzorov', 'Testovice', 'Ukázkov', 'Smyšlenice', 'Fiktivov', 'Pokusín', 'Syntetice',
    'Zkušebnice', 'Datovice', 'Šablonov', 'Cvičnice', 'Simulov', 'Generátorov', 'Prototypice',
    'Maketov', 'Ladičov', 'Zástupnice', 'Náhodín'];
  /* Smyšlené obce s víceslovným názvem (bez předpony). */
  const obceSlozene = ['Testovací Lhota', 'Vzorová Ves', 'Datová Lhota', 'Fiktivní Újezd', 'Ukázkový Dvůr',
    'Smyšlená Hora', 'Nová Syntetice', 'Zkušební Lhotka', 'Generovaný Týnec', 'Ladicí Kostelec'];
  const predponyObci = ['Horní', 'Dolní', 'Zadní', 'Přední'];

  /* Slova pro výplňový text (obecná slova bez osobních údajů). */
  const slova = ['data', 'záznam', 'hodnota', 'systém', 'objednávka', 'doprava', 'kvalita', 'služba',
    'zákazník', 'produkt', 'cena', 'sklad', 'termín', 'změna', 'kontrola', 'výsledek', 'proces', 'plán',
    'dodávka', 'balík', 'faktura', 'smlouva', 'projekt', 'úkol', 'oddělení', 'poznámka', 'zpráva', 'stav',
    'rychlý', 'nový', 'starý', 'velký', 'malý', 'dobrý', 'přesný', 'běžný', 'hlavní', 'další', 'jiný',
    'vhodný', 'pravidelný', 'dočasný', 'otevřený', 'uzavřený', 'zelený', 'modrý', 'tichý', 'pevný',
    'odeslat', 'přijmout', 'ověřit', 'doplnit', 'upravit', 'uložit', 'zkontrolovat', 'připravit',
    'vyřídit', 'zaznamenat', 'potvrdit', 'zrušit', 'navrhnout', 'spočítat', 'porovnat', 'předat',
    'dnes', 'zítra', 'později', 'brzy', 'včas', 'znovu', 'ihned', 'průběžně', 'podle', 'kvůli',
    'před', 'po', 'během', 'mezi', 'pro', 'bez', 'ale', 'také', 'proto', 'jinak', 'zatím', 'vždy'];

  /* Názvy výrobků: přídavné jméno (tvrdé -ý / měkké -í) + podstatné jméno s rodem. */
  const pridavna = ['odolný', 'lehký', 'praktický', 'skládací', 'cestovní', 'kuchyňský', 'zahradní',
    'kancelářský', 'dětský', 'klasický', 'moderní', 'kompaktní', 'ekologický', 'bambusový', 'ocelový',
    'keramický', 'vlněný', 'nerezový', 'dřevěný', 'voděodolný', 'univerzální', 'designový', 'stohovatelný'];
  const podstatna = [['lampa', 'f'], ['stůl', 'm'], ['křeslo', 'n'], ['hrnek', 'm'], ['taška', 'f'],
    ['batoh', 'm'], ['deka', 'f'], ['polštář', 'm'], ['svíčka', 'f'], ['kolo', 'n'], ['stan', 'm'],
    ['láhev', 'f'], ['vařič', 'm'], ['sešit', 'm'], ['pero', 'n'], ['zrcadlo', 'n'], ['konvice', 'f'],
    ['prkénko', 'n'], ['nůž', 'm'], ['miska', 'f'], ['židle', 'f'], ['regál', 'm'], ['koš', 'm'],
    ['ručník', 'm'], ['budík', 'm'], ['květináč', 'm'], ['pánev', 'f'], ['lopatka', 'f']];
  const varianty = ['S', 'M', 'L', 'XL', 'Mini', 'Maxi', 'Plus', 'Pro', 'Duo', 'Eko'];

  /* Telefonní předvolby pro fiktivní US čísla 555-01xx (platí pro libovolnou předvolbu). */
  const usPredvolby = ['202', '212', '305', '312', '415', '503', '617', '702', '808', '907'];

  /* Domény vyhrazené pro dokumentaci a testy (RFC 2606). */
  const domeny = ['example.com', 'example.org', 'example.net'];

  const SL = { zenska, muzska, prijmeni, ulice, obceZaklad, obceSlozene, predponyObci, slova,
    pridavna, podstatna, varianty, usPredvolby, domeny };
  if (typeof module !== 'undefined' && module.exports) module.exports = SL; else koren.TDSlovniky = SL;
})(typeof self !== 'undefined' ? self : this);

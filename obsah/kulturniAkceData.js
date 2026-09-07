/* ============================================================
   kulturniAkceData.js – katalog tradičních kulturních akcí v ČR
   pro stránku obsah/kulturni_akce.html.

   Načítá se klasickým <script>, ne přes fetch – stránka tak funguje
   i offline a service worker si data uloží při prvním otevření.

   Akce se opakují každý rok, proto se neukládá konkrétní rok, ale
   měsíc (`m`), volitelně den (`d`) a slovní popis termínu (`t`).
   Bez `d` se pro řazení použije polovina měsíce. TERMÍNY JSOU
   ORIENTAČNÍ – přesné datum vždy ověřte u pořadatele.

   Pole záznamu:
     n     název akce
     kraj  kód kraje z AKCE_KRAJE ('CR' = koná se po celé republice)
     kat   kód kategorie z AKCE_KATEGORIE
     m     měsíc 1–12
     d     den v měsíci (nepovinné, u pohyblivých termínů chybí)
     t     slovní termín („druhý víkend v září“)
     misto město / místo konání
     p     krátký popis
   ============================================================ */

const AKCE_KRAJE = [
  { id: 'CR',  nazev: 'Celá ČR',           zkratka: 'ČR'  },
  { id: 'PHA', nazev: 'Praha',             zkratka: 'PHA' },
  { id: 'STC', nazev: 'Středočeský',       zkratka: 'STČ' },
  { id: 'JHC', nazev: 'Jihočeský',         zkratka: 'JHČ' },
  { id: 'PLK', nazev: 'Plzeňský',          zkratka: 'PLK' },
  { id: 'KVK', nazev: 'Karlovarský',       zkratka: 'KVK' },
  { id: 'ULK', nazev: 'Ústecký',           zkratka: 'ÚLK' },
  { id: 'LBK', nazev: 'Liberecký',         zkratka: 'LBK' },
  { id: 'HKK', nazev: 'Královéhradecký',   zkratka: 'HKK' },
  { id: 'PAK', nazev: 'Pardubický',        zkratka: 'PAK' },
  { id: 'VYS', nazev: 'Vysočina',          zkratka: 'VYS' },
  { id: 'JHM', nazev: 'Jihomoravský',      zkratka: 'JHM' },
  { id: 'OLK', nazev: 'Olomoucký',         zkratka: 'OLK' },
  { id: 'ZLK', nazev: 'Zlínský',           zkratka: 'ZLK' },
  { id: 'MSK', nazev: 'Moravskoslezský',   zkratka: 'MSK' },
];

const AKCE_KATEGORIE = [
  { id: 'hody',     nazev: 'Hody, poutě a masopust', ikona: '🎪' },
  { id: 'vystava',  nazev: 'Výstavy a veletrhy',     ikona: '🖼️' },
  { id: 'posezeni', nazev: 'Posezení a jarmarky',    ikona: '🍺' },
  { id: 'festival', nazev: 'Hudební festivaly',      ikona: '🎵' },
  { id: 'divadlo',  nazev: 'Divadlo a film',         ikona: '🎭' },
  { id: 'slavnost', nazev: 'Slavnosti a historie',   ikona: '🏰' },
  { id: 'vino',     nazev: 'Vinobraní a pivo',       ikona: '🍷' },
  { id: 'folklor',  nazev: 'Folklor a tradice',      ikona: '💃' },
  { id: 'advent',   nazev: 'Advent a Vánoce',        ikona: '🎄' },
  { id: 'sport',    nazev: 'Sportovní svátky',       ikona: '🏇' },
];

const AKCE_DATA = [
  /* ---------- celá ČR ---------- */
  { n: 'Masopust', kraj: 'CR', kat: 'hody', m: 2, t: 'únor, 40 dní před Velikonocemi', misto: 'obce po celé ČR', p: 'Masopustní průvody v maskách, zabijačky a veselice před postní dobou. Nejznámější jsou vesnické masopusty na Hlinecku zapsané na seznamu UNESCO.' },
  { n: 'Velikonoční trhy a pomlázka', kraj: 'CR', kat: 'hody', m: 4, t: 'pohyblivý svátek, březen–duben', misto: 'náměstí měst a obcí', p: 'Velikonoční jarmarky s kraslicemi, pomlázkami a řemesly, velikonoční koledy a obchůzky.' },
  { n: 'Pálení čarodějnic a stavění máje', kraj: 'CR', kat: 'hody', m: 4, d: 30, t: '30. dubna', misto: 'obce po celé ČR', p: 'Filipojakubská noc – vatry, opékání, stavění májky a posezení do noci.' },
  { n: 'Noc kostelů', kraj: 'CR', kat: 'slavnost', m: 6, t: 'pátek na přelomu května a června', misto: 'kostely po celé ČR', p: 'Noční zpřístupnění kostelů a modliteben s koncerty, prohlídkami věží a komentovanými prohlídkami.' },
  { n: 'Muzejní noc', kraj: 'CR', kat: 'vystava', m: 6, t: 'květen–červen, podle města', misto: 'muzea a galerie', p: 'Festival muzejních nocí – muzea a galerie otevřené do půlnoci, obvykle zdarma.' },
  { n: 'Hradozámecká noc', kraj: 'CR', kat: 'slavnost', m: 8, t: 'konec srpna', misto: 'památky NPÚ', p: 'Noční a kostýmované prohlídky hradů a zámků ve správě Národního památkového ústavu.' },
  { n: 'Dny evropského dědictví (EHD)', kraj: 'CR', kat: 'slavnost', m: 9, t: 'první polovina září', misto: 'památky po celé ČR', p: 'Otevřené památky, které jsou jinak nepřístupné – radnice, kostely, věže, průmyslové stavby.' },
  { n: 'Posvícení a hody', kraj: 'CR', kat: 'hody', m: 9, t: 'srpen–listopad podle patrona kostela', misto: 'obce po celé ČR', p: 'Tradiční obecní slavnost k výročí posvěcení kostela – průvod, muzika, koláče a posezení.' },
  { n: 'Svatomartinské slavnosti a mladé víno', kraj: 'CR', kat: 'vino', m: 11, d: 11, t: '11. listopadu od 11:11', misto: 'restaurace a vinařství', p: 'Otevírání svatomartinského vína, husa se zelím a knedlíkem, průvod svatého Martina na bílém koni.' },
  { n: 'Adventní trhy a rozsvícení stromu', kraj: 'CR', kat: 'advent', m: 12, t: 'od první adventní neděle do Vánoc', misto: 'náměstí měst a obcí', p: 'Vánoční jarmarky s punčem, betlémy, koledami a řemeslnými stánky.' },

  /* ---------- Praha ---------- */
  { n: 'Matějská pouť', kraj: 'PHA', kat: 'hody', m: 2, t: 'od konce února do začátku dubna', misto: 'Výstaviště Holešovice, Praha', p: 'Největší česká pouť s atrakcemi, střelnicemi a perníkovými srdci, tradice od 16. století.' },
  { n: 'Mezi ploty', kraj: 'PHA', kat: 'festival', m: 5, t: 'konec května', misto: 'areál Bohnice, Praha', p: 'Multižánrový hudební a divadelní festival v zahradách psychiatrické nemocnice.' },
  { n: 'Pražské jaro', kraj: 'PHA', kat: 'festival', m: 5, d: 12, t: 'od 12. května do začátku června', misto: 'Rudolfinum, Obecní dům a další sály', p: 'Mezinárodní hudební festival klasické hudby, zahajuje se Smetanovou Mou vlastí.' },
  { n: 'Pražská muzejní noc', kraj: 'PHA', kat: 'vystava', m: 6, t: 'druhá polovina června', misto: 'muzea a galerie v Praze', p: 'Desítky muzeí a galerií otevřených do jedné hodiny v noci, se svozovou dopravou zdarma.' },
  { n: 'Letní shakespearovské slavnosti', kraj: 'PHA', kat: 'divadlo', m: 7, t: 'červenec a srpen', misto: 'Nejvyšší purkrabství Pražského hradu', p: 'Shakespearovské inscenace pod širým nebem na nádvořích Pražského hradu.' },
  { n: 'Prague Pride', kraj: 'PHA', kat: 'slavnost', m: 8, t: 'první polovina srpna', misto: 'Praha', p: 'Týden diskuzí, výstav, divadla a koncertů zakončený průvodem centrem města.' },
  { n: 'Designblok', kraj: 'PHA', kat: 'vystava', m: 10, t: 'první polovina října', misto: 'Praha', p: 'Přehlídka designu a módy – instalace designérů, škol a značek na několika výstavních místech.' },
  { n: 'Signal Festival', kraj: 'PHA', kat: 'slavnost', m: 10, t: 'polovina října', misto: 'centrum Prahy', p: 'Festival světla – světelné instalace a videomapping na fasádách historických budov.' },
  { n: 'Vánoční trhy na Staroměstském náměstí', kraj: 'PHA', kat: 'advent', m: 12, t: 'od konce listopadu do začátku ledna', misto: 'Staroměstské náměstí, Praha', p: 'Nejnavštěvovanější české vánoční trhy s velkým stromem, betlémem a pódiem s koledami.' },

  /* ---------- Středočeský ---------- */
  { n: 'Svatohorská pouť', kraj: 'STC', kat: 'hody', m: 5, t: 'jaro a léto, hlavní pouť v květnu', misto: 'Svatá Hora, Příbram', p: 'Poutní mše a procesí u nejvýznamnějšího mariánského poutního místa v Čechách.' },
  { n: 'Královské stříbření Kutné Hory', kraj: 'STC', kat: 'slavnost', m: 6, t: 'druhá polovina června', misto: 'Kutná Hora', p: 'Historické slavnosti připomínající příjezd Václava IV. – kostýmovaný průvod, trhy a šermíři.' },
  { n: 'Kmochův Kolín', kraj: 'STC', kat: 'festival', m: 6, t: 'druhá polovina června', misto: 'Kolín', p: 'Nejstarší český festival dechových hudeb s průvodem kapel městem.' },
  { n: 'Výstaviště Lysá nad Labem – sezónní veletrhy', kraj: 'STC', kat: 'vystava', m: 3, t: 'několikrát ročně, hlavní na jaře a na podzim', misto: 'Lysá nad Labem', p: 'Zemědělské, chovatelské a zahrádkářské výstavy s doprovodným jarmarkem.' },
  { n: 'Mělnické vinobraní', kraj: 'STC', kat: 'vino', m: 9, t: 'druhý víkend v září', misto: 'Mělník', p: 'Nejstarší české vinobraní – burčák, průvod Karla IV. a koncerty v ulicích města.' },
  { n: 'Karlštejnské vinobraní', kraj: 'STC', kat: 'vino', m: 9, t: 'konec září', misto: 'Karlštejn', p: 'Historický průvod Karla IV. z podhradí na hrad, dobové trhy a ochutnávky vína.' },
  { n: 'Adventní trhy v Kutné Hoře', kraj: 'STC', kat: 'advent', m: 12, t: 'prosinec', misto: 'Palackého náměstí, Kutná Hora', p: 'Vánoční trhy v historickém jádru zapsaném na seznamu UNESCO.' },

  /* ---------- Jihočeský ---------- */
  { n: 'Slavnosti pětilisté růže', kraj: 'JHC', kat: 'slavnost', m: 6, t: 'víkend kolem letního slunovratu', misto: 'Český Krumlov', p: 'Největší renesanční slavnosti v ČR – celé město v kostýmech, průvod, turnaje a ohňostroj.' },
  { n: 'Cool v plotě', kraj: 'JHC', kat: 'festival', m: 6, t: 'druhá polovina června', misto: 'Písek', p: 'Multižánrový festival v areálu bývalých kasáren, hudba a divadlo.' },
  { n: 'Mezinárodní hudební festival Český Krumlov', kraj: 'JHC', kat: 'festival', m: 7, t: 'červenec a srpen', misto: 'Český Krumlov', p: 'Klasika, jazz i opera v zámecké jízdárně, zahradách a otáčivém hledišti.' },
  { n: 'Otáčivé hlediště Český Krumlov', kraj: 'JHC', kat: 'divadlo', m: 7, t: 'letní sezóna červen–září', misto: 'zámecká zahrada, Český Krumlov', p: 'Představení Jihočeského divadla na jedinečné otáčivé scéně v barokní zahradě.' },
  { n: 'Země živitelka', kraj: 'JHC', kat: 'vystava', m: 8, t: 'konec srpna', misto: 'Výstaviště České Budějovice', p: 'Největší zemědělský veletrh v ČR s folklorním programem, jarmarkem a ochutnávkami.' },
  { n: 'Táborská setkání', kraj: 'JHC', kat: 'slavnost', m: 9, t: 'druhý víkend v září', misto: 'Tábor', p: 'Husitské slavnosti – historický průvod, dobová tržnice a bitvy v ulicích starého města.' },

  /* ---------- Plzeňský ---------- */
  { n: 'Slavnosti svobody', kraj: 'PLK', kat: 'slavnost', m: 5, d: 5, t: '5.–8. května', misto: 'Plzeň', p: 'Připomínka osvobození americkou armádou – konvoj historických vozidel, koncerty a pietní akty.' },
  { n: 'Skupova Plzeň', kraj: 'PLK', kat: 'divadlo', m: 6, t: 'červen', misto: 'Plzeň', p: 'Přehlídka loutkového a alternativního divadla pro děti i dospělé.' },
  { n: 'Historický víkend', kraj: 'PLK', kat: 'slavnost', m: 6, t: 'druhá polovina června', misto: 'centrum Plzně', p: 'Dobové trhy, šermířská klání a průvod historickým centrem.' },
  { n: 'Chodské slavnosti', kraj: 'PLK', kat: 'folklor', m: 8, t: 'druhý víkend v srpnu', misto: 'Domažlice', p: 'Největší chodská pouť – kroje, dudácká muzika, folklorní soubory a řemeslný jarmark.' },
  { n: 'Živá ulice', kraj: 'PLK', kat: 'festival', m: 8, t: 'srpen', misto: 'centrum Plzně', p: 'Pouliční festival hudby, divadla a výtvarného umění v ulicích města.' },
  { n: 'Pilsner Fest', kraj: 'PLK', kat: 'vino', m: 10, t: 'začátek října', misto: 'Pivovar Plzeňský Prazdroj', p: 'Pivní slavnost k výročí uvaření první várky ležáku, koncerty přímo v areálu pivovaru.' },

  /* ---------- Karlovarský ---------- */
  { n: 'Zahájení lázeňské sezóny', kraj: 'KVK', kat: 'slavnost', m: 5, t: 'první polovina května', misto: 'Karlovy Vary a Mariánské Lázně', p: 'Svěcení pramenů, průvod v historických kostýmech a koncerty v kolonádách.' },
  { n: 'Zpívající fontána – letní sezóna', kraj: 'KVK', kat: 'slavnost', m: 6, t: 'od května do října', misto: 'Mariánské Lázně', p: 'Pravidelné produkce vodní a hudební fontány u kolonády.' },
  { n: 'Mezinárodní filmový festival Karlovy Vary', kraj: 'KVK', kat: 'divadlo', m: 7, t: 'první polovina července', misto: 'Karlovy Vary', p: 'Nejvýznamnější filmový festival v ČR, projekce po celém městě a doprovodný program.' },
  { n: 'Opera na hradě Loket', kraj: 'KVK', kat: 'divadlo', m: 7, t: 'červenec a srpen', misto: 'hrad Loket', p: 'Operní a koncertní představení v přírodním amfiteátru pod hradem.' },
  { n: 'Valdštejnské slavnosti', kraj: 'KVK', kat: 'slavnost', m: 8, t: 'srpen', misto: 'Cheb', p: 'Historické slavnosti připomínající pobyt a smrt Albrechta z Valdštejna, dobový tábor a trhy.' },
  { n: 'Dvořákův karlovarský podzim', kraj: 'KVK', kat: 'festival', m: 9, t: 'září', misto: 'Karlovy Vary', p: 'Festival klasické hudby v Grandhotelu Pupp a Lázních III.' },

  /* ---------- Ústecký ---------- */
  { n: 'Terezínská tryzna', kraj: 'ULK', kat: 'slavnost', m: 5, t: 'třetí neděle v květnu', misto: 'Národní hřbitov, Terezín', p: 'Pietní vzpomínka na oběti nacistické perzekuce s doprovodným kulturním programem.' },
  { n: 'Dočesná', kraj: 'ULK', kat: 'vino', m: 9, t: 'první víkend v září', misto: 'Žatec', p: 'Chmelařská slavnost – největší pivní festival v regionu, průvod a koncerty na náměstí.' },
  { n: 'Zahrada Čech', kraj: 'ULK', kat: 'vystava', m: 9, t: 'polovina září', misto: 'výstaviště Litoměřice', p: 'Zahradnický a ovocnářský veletrh s prodejní výstavou a řemeslným jarmarkem.' },
  { n: 'Litoměřické vinobraní', kraj: 'ULK', kat: 'vino', m: 9, t: 'konec září', misto: 'Litoměřice', p: 'Vinařské slavnosti v historickém centru, burčák, stánky a hudební scény.' },
  { n: 'Hudební festival Ludwiga van Beethovena', kraj: 'ULK', kat: 'festival', m: 10, t: 'podzim', misto: 'Teplice', p: 'Festival klasické hudby připomínající Beethovenovy pobyty v teplických lázních.' },

  /* ---------- Liberecký ---------- */
  { n: 'Jizerská 50', kraj: 'LBK', kat: 'sport', m: 2, t: 'druhá polovina února', misto: 'Bedřichov, Jizerské hory', p: 'Tradiční dálkový běh na lyžích s doprovodným programem a jarmarkem v cíli.' },
  { n: 'Benátská!', kraj: 'LBK', kat: 'festival', m: 7, t: 'druhá polovina července', misto: 'Liberec', p: 'Vícedenní open air festival české i zahraniční hudby.' },
  { n: 'Staročeské trhy', kraj: 'LBK', kat: 'posezeni', m: 8, t: 'srpen', misto: 'Turnov', p: 'Řemeslný jarmark s ukázkami broušení drahých kamenů, na které je Turnov proslulý.' },
  { n: 'Lípa Musica', kraj: 'LBK', kat: 'festival', m: 9, t: 'od září do října', misto: 'Česká Lípa a okolí', p: 'Podzimní festival klasické hudby v kostelech a zámcích Českolipska a Lužických hor.' },
  { n: 'Vánoční trhy pod libereckou radnicí', kraj: 'LBK', kat: 'advent', m: 12, t: 'prosinec', misto: 'náměstí Dr. E. Beneše, Liberec', p: 'Adventní trhy pod neorenesanční radnicí s kluzištěm a programem pro děti.' },

  /* ---------- Královéhradecký ---------- */
  { n: 'Náchodská Prima sezóna', kraj: 'HKK', kat: 'divadlo', m: 5, t: 'konec května', misto: 'Náchod', p: 'Festival studentské tvorby – divadlo, film, hudba i výtvarné umění.' },
  { n: 'Divadlo evropských regionů', kraj: 'HKK', kat: 'divadlo', m: 6, t: 'druhá polovina června', misto: 'Hradec Králové', p: 'Přehlídka divadel z celé Evropy včetně pouliční části Open Air Program.' },
  { n: 'Za poklady Broumovska', kraj: 'HKK', kat: 'festival', m: 6, t: 'od června do září', misto: 'Broumovsko', p: 'Koncerty a výstavy v barokních kostelech bratří Dientzenhoferů.' },
  { n: 'Rock for People', kraj: 'HKK', kat: 'festival', m: 6, t: 'přelom června a července', misto: 'Park 360, Hradec Králové', p: 'Největší český rockový open air festival se zahraničními headlinery.' },
  { n: 'Trutnoff Open Air Festival', kraj: 'HKK', kat: 'festival', m: 8, t: 'druhá polovina srpna', misto: 'Trutnov', p: 'Festival s undergroundovou tradicí, hudba, divadlo a literatura na Bojišti.' },
  { n: 'Jičín – město pohádky', kraj: 'HKK', kat: 'slavnost', m: 9, t: 'první polovina září', misto: 'Jičín', p: 'Festival pro rodiny s dětmi v duchu Rumcajse – pohádky, průvod a dílny.' },

  /* ---------- Pardubický ---------- */
  { n: 'Smetanova Litomyšl', kraj: 'PAK', kat: 'festival', m: 6, t: 'od poloviny června do začátku července', misto: 'zámek Litomyšl', p: 'Operní a hudební festival na nádvoří renesančního zámku zapsaného v UNESCO.' },
  { n: 'Zlatá přilba', kraj: 'PAK', kat: 'sport', m: 7, t: 'léto', misto: 'Svítkov, Pardubice', p: 'Tradiční plochodrážní závod s doprovodným kulturním programem.' },
  { n: 'Loutkářská Chrudim', kraj: 'PAK', kat: 'divadlo', m: 7, t: 'první polovina července', misto: 'Chrudim', p: 'Nejstarší přehlídka amatérského loutkového divadla, dílny a pouliční produkce.' },
  { n: 'Colour Meeting', kraj: 'PAK', kat: 'festival', m: 7, t: 'druhá polovina července', misto: 'Polička', p: 'Festival world music a divadla v hradbách historického města.' },
  { n: 'Velká pardubická', kraj: 'PAK', kat: 'sport', m: 10, t: 'druhá neděle v říjnu', misto: 'závodiště Pardubice', p: 'Nejnáročnější kontinentální steeplechase, společenská událost s bohatým programem.' },
  { n: 'Muzeum perníku – vánoční program', kraj: 'PAK', kat: 'advent', m: 12, t: 'advent', misto: 'Pardubice-Rábí', p: 'Perníková chaloupka s dílnami zdobení perníků a vánoční výstavou.' },

  /* ---------- Vysočina ---------- */
  { n: 'Masopust na Hlinecku', kraj: 'VYS', kat: 'hody', m: 2, t: 'únor', misto: 'Hlinsko a okolní vesnice', p: 'Masopustní obchůzky zapsané na seznam nehmotného dědictví UNESCO, Betlém Hlinsko.' },
  { n: 'Festival rekordů a kuriozit', kraj: 'VYS', kat: 'slavnost', m: 6, t: 'první polovina června', misto: 'Pelhřimov', p: 'Město rekordů – pokusy o rekordy na náměstí, výstavy kuriozit a průvod.' },
  { n: 'Prázdniny v Telči', kraj: 'VYS', kat: 'festival', m: 7, t: 'od konce července do poloviny srpna', misto: 'Telč', p: 'Folk, world music a divadlo na náměstí a v zámeckých zahradách města v UNESCO.' },
  { n: 'Folkové prázdniny', kraj: 'VYS', kat: 'festival', m: 7, t: 'konec července', misto: 'Náměšť nad Oslavou', p: 'Festival folku a world music s dílnami a koncerty v zámeckém areálu.' },
  { n: 'MFDF Ji.hlava', kraj: 'VYS', kat: 'divadlo', m: 10, t: 'druhá polovina října', misto: 'Jihlava', p: 'Mezinárodní festival dokumentárních filmů, největší svého druhu ve střední Evropě.' },
  { n: 'Podzimní knižní veletrh', kraj: 'VYS', kat: 'vystava', m: 10, t: 'první polovina října', misto: 'Havlíčkův Brod', p: 'Přehlídka nakladatelů s autorskými čteními a besedami.' },

  /* ---------- Jihomoravský ---------- */
  { n: 'Jízda králů', kraj: 'JHM', kat: 'folklor', m: 5, t: 'poslední víkend v květnu', misto: 'Vlčnov', p: 'Slavnost zapsaná v UNESCO – jízda krojovaných jezdců s králem, otevřené vinné sklepy.' },
  { n: 'Ignis Brunensis', kraj: 'JHM', kat: 'slavnost', m: 6, t: 'květen a červen', misto: 'Brno', p: 'Mezinárodní přehlídka ohňostrojů nad brněnskou přehradou a hradbami Špilberku.' },
  { n: 'Mezinárodní folklorní festival Strážnice', kraj: 'JHM', kat: 'folklor', m: 6, t: 'konec června', misto: 'Strážnice', p: 'Nejstarší folklorní festival v ČR – soubory z celého světa v zámeckém parku.' },
  { n: 'Concentus Moraviae', kraj: 'JHM', kat: 'festival', m: 6, t: 'červen', misto: 'města jižní Moravy', p: 'Festival klasické hudby v historických sálech a kostelech třiceti měst regionu.' },
  { n: 'Festival pro židovskou čtvrť', kraj: 'JHM', kat: 'slavnost', m: 7, t: 'druhá polovina července', misto: 'Boskovice', p: 'Hudba, divadlo a film v památkové židovské čtvrti spojené s její obnovou.' },
  { n: 'Krojované hody na Slovácku', kraj: 'JHM', kat: 'hody', m: 8, t: 'srpen–říjen podle obce', misto: 'obce Slovácka', p: 'Hody se stárky, krojovaným průvodem, zavádkou a otevřenými sklepy.' },
  { n: 'Znojemské historické vinobraní', kraj: 'JHM', kat: 'vino', m: 9, t: 'druhý víkend v září', misto: 'Znojmo', p: 'Příjezd Jana Lucemburského, dobová města, burčák a koncerty v celém centru.' },
  { n: 'Pálavské vinobraní', kraj: 'JHM', kat: 'vino', m: 9, t: 'druhý víkend v září', misto: 'Mikulov', p: 'Historický průvod, vinařské stánky a folklor pod Svatým kopečkem.' },
  { n: 'Vánoční trhy na náměstí Svobody', kraj: 'JHM', kat: 'advent', m: 12, t: 'prosinec', misto: 'Brno', p: 'Adventní trhy s betlémem, kluzištěm a programem na několika náměstích současně.' },

  /* ---------- Olomoucký ---------- */
  { n: 'Flora Olomouc – jarní etapa', kraj: 'OLK', kat: 'vystava', m: 4, t: 'druhá polovina dubna', misto: 'Výstaviště Flora, Olomouc', p: 'Mezinárodní květinová a zahradnická výstava se zahradním trhem, dále letní a podzimní etapa.' },
  { n: 'Svátky písní Olomouc', kraj: 'OLK', kat: 'festival', m: 6, t: 'první polovina června', misto: 'Olomouc', p: 'Mezinárodní festival pěveckých sborů s koncerty v kostelech a na náměstích.' },
  { n: 'Wolkerův Prostějov', kraj: 'OLK', kat: 'divadlo', m: 6, t: 'červen', misto: 'Prostějov', p: 'Nejstarší přehlídka uměleckého přednesu a divadel poezie v ČR.' },
  { n: 'Litovelský otvírák', kraj: 'OLK', kat: 'vino', m: 6, t: 'červen', misto: 'Litovel', p: 'Pivní slavnost v areálu pivovaru a v ulicích města s celodenním hudebním programem.' },
  { n: 'Blues Alive', kraj: 'OLK', kat: 'festival', m: 11, t: 'druhá polovina listopadu', misto: 'Šumperk', p: 'Přední evropský bluesový festival se zahraničními hosty.' },
  { n: 'Vánoční trhy na Horním náměstí', kraj: 'OLK', kat: 'advent', m: 12, t: 'prosinec', misto: 'Olomouc', p: 'Adventní trhy u sloupu Nejsvětější Trojice zapsaného v UNESCO.' },

  /* ---------- Zlínský ---------- */
  { n: 'Zlín Film Festival', kraj: 'ZLK', kat: 'divadlo', m: 5, t: 'konec května a začátek června', misto: 'Zlín', p: 'Nejstarší festival filmů pro děti a mládež na světě, projekce a program po celém městě.' },
  { n: 'Zahájení lázeňské sezóny v Luhačovicích', kraj: 'ZLK', kat: 'slavnost', m: 5, t: 'druhá polovina května', misto: 'Luhačovice', p: 'Svěcení pramenů, krojovaný průvod a koncerty v lázeňském areálu.' },
  { n: 'Forfest', kraj: 'ZLK', kat: 'festival', m: 6, t: 'červen', misto: 'Kroměříž', p: 'Festival soudobého umění s duchovním zaměřením v arcibiskupském zámku a kostelech.' },
  { n: 'Dny lidí dobré vůle', kraj: 'ZLK', kat: 'slavnost', m: 7, d: 4, t: '4.–5. července', misto: 'Velehrad', p: 'Cyrilometodějská pouť s koncertem, poutní mší a doprovodným programem pro rodiny.' },
  { n: 'Rožnovské slavnosti', kraj: 'ZLK', kat: 'folklor', m: 7, t: 'první polovina července', misto: 'Valašské muzeum v přírodě, Rožnov pod Radhoštěm', p: 'Folklorní slavnosti ve skanzenu s programem souborů z Valašska i ze zahraničí.' },
  { n: 'Letní filmová škola', kraj: 'ZLK', kat: 'divadlo', m: 7, t: 'konec července a začátek srpna', misto: 'Uherské Hradiště', p: 'Filmová přehlídka s přednáškami, výstavami a koncerty, otevřená veřejnosti.' },
  { n: 'Slovácké slavnosti vína a otevřených památek', kraj: 'ZLK', kat: 'vino', m: 9, t: 'druhý víkend v září', misto: 'Uherské Hradiště', p: 'Tisíce krojovaných v průvodu, vinné sklepy měst a obcí regionu a otevřené památky.' },

  /* ---------- Moravskoslezský ---------- */
  { n: 'Janáčkův máj', kraj: 'MSK', kat: 'festival', m: 5, t: 'od konce května do začátku června', misto: 'Ostrava', p: 'Mezinárodní hudební festival klasické hudby v Domě kultury a dalších sálech.' },
  { n: 'Sweetsen Fest', kraj: 'MSK', kat: 'festival', m: 7, t: 'první polovina července', misto: 'Frýdek-Místek', p: 'Benefiční městský festival s výtěžkem pro místní neziskové organizace.' },
  { n: 'Colours of Ostrava', kraj: 'MSK', kat: 'festival', m: 7, t: 'druhá polovina července', misto: 'Dolní oblast Vítkovice, Ostrava', p: 'Největší multižánrový festival v ČR v industriálním areálu, hudba, divadlo a diskuze.' },
  { n: 'Gorolski Święto', kraj: 'MSK', kat: 'folklor', m: 8, t: 'první polovina srpna', misto: 'Jablunkov', p: 'Slavnost goralské kultury polské menšiny – kroje, kapely a řemesla.' },
  { n: 'Bezručova Opava', kraj: 'MSK', kat: 'slavnost', m: 9, t: 'září', misto: 'Opava', p: 'Kulturní festival s literárním, hudebním a výtvarným programem.' },
  { n: 'Vánoční trhy na Masarykově náměstí', kraj: 'MSK', kat: 'advent', m: 12, t: 'prosinec', misto: 'Ostrava', p: 'Adventní trhy s kluzištěm, betlémem a koncerty v centru města.' },
];

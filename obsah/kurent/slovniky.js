/* Čtení kurentu – pracovní data pro genealogy: slovníky, svátky, záměny a období písma, šablony zápisů, zdroje.
   Bez DOM, v prohlížeči window.KurentSlovniky, v node module.exports.
   Zdroje viz LITERATURA (dole). Hodnoty měr a měn jsou zaokrouhlené; místní míry se lišily. */
(function (koren) {
'use strict';

/* Tematické slovníky: sloupce [latinsky, německy, česky, poznámka] */
const NEMOCI = [
  ['senectus, marasmus senilis', 'Altersschwäche', 'sešlost věkem', 'nejčastější údaj u starých lidí'],
  ['debilitas vitae', 'Lebensschwäche', 'slabost života', 'u novorozenců a nedonošených'],
  ['phthisis, tabes, tuberculosis', 'Lungensucht, Schwindsucht, Auszehrung, Tuberculose', 'souchotiny, úbytě (tuberkulóza)', 'Abzehrung/Auszehrung = obecně chřadnutí'],
  ['convulsiones, eclampsia', 'Fraisen, Gichter', 'psotník, křeče', 'u kojenců; skutečná příčina často neznámá'],
  ['hydrops', 'Wassersucht', 'vodnatelnost (otoky)', 'příznak, obvykle srdce nebo ledviny'],
  ['apoplexia', 'Schlagfluss, Schlag', 'mrtvice', 'Nervenschlag = mozková mrtvice'],
  ['variolae', 'Blattern, Pocken', 'neštovice (pravé)', ''],
  ['morbilli', 'Masern', 'spalničky', ''],
  ['scarlatina', 'Scharlach', 'spála', ''],
  ['diphtheria, angina membranacea', 'Diphtheritis, häutige Bräune', 'záškrt', 'Bräune = zánět hrdla (angína, záškrt)'],
  ['tussis convulsiva', 'Keuchhusten, Stickhusten', 'černý (dávivý) kašel', ''],
  ['dysenteria', 'Ruhr, rothe Ruhr', 'úplavice', ''],
  ['diarrhoea', 'Durchfall, Abweichen', 'průjem', 'Brechdurchfall = zvracení s průjmem'],
  ['cholera', 'Cholera', 'cholera', 'epidemie v Čechách 1831–32, 1836, 1849, 1855, 1866'],
  ['typhus, febris nervosa', 'Typhus, Nervenfieber, Faulfieber', 'tyfus, „nervová“ či „hnilobná“ horečka', ''],
  ['febris', 'Fieber, Hitziges Fieber', 'horečka, zimnice', 'Wechselfieber = střídavá zimnice (malárie)'],
  ['febris puerperalis', 'Kindbettfieber', 'horečka omladnic', 'úmrtí matky po porodu'],
  ['pneumonia', 'Lungenentzündung', 'zápal plic', ''],
  ['catarrhus', 'Katarrh, Darmkatarrh', 'katar (zánět sliznic), střevní katar', ''],
  ['cancer, carcinoma', 'Krebs', 'rakovina', ''],
  ['gangraena', 'Brand', 'sněť, gangréna', ''],
  ['erysipelas', 'Rotlauf', 'růže (kožní infekce)', ''],
  ['dentitio', 'Zahnen', 'prořezávání zubů', 'uváděno u kojenců jako příčina'],
  ['partus', 'Geburt, bei der Geburt', 'porod, při porodu', ''],
  ['submersus', 'ertrunken', 'utonulý', ''],
  ['casu infelici', 'verunglückt', 'zahynul nešťastnou náhodou', ''],
  ['suicidium', 'Selbstmord, erhängt', 'sebevražda, oběšen', 'pohřeb často „in silentio“ / bez obřadů'],
  ['morte subitanea', 'plötzlicher Tod', 'náhlá smrt', ''],
  ['ex vulnere', 'an der Wunde', 'na následky zranění', ''],
  ['sine sacramentis', 'unversehen', 'nezaopatřen (bez svátostí)', 'opak: provisus / versehen']
];
const POVOLANI = [
  ['agricola, colonus, rusticus', 'Bauer, Landwirt', 'sedlák, rolník', 'držitel selské usedlosti'],
  ['semicolonus', 'Halbbauer, Halblehner', 'pololáník', ''],
  ['casarius', 'Chaluppner, Häusler', 'chalupník, domkář', 'Häusler = domkář (dům bez polí)'],
  ['hortulanus', 'Gärtler', 'zahradník', 'drobný rolník s malou výměrou'],
  ['inquilinus, incola', 'Inwohner, Inmann, Insasse', 'podruh, nájemník', 'bez vlastního domu'],
  ['operarius, mercenarius', 'Taglöhner', 'nádeník', ''],
  ['famulus / ancilla', 'Knecht / Magd', 'čeledín / děvečka', ''],
  ['faber ferrarius', 'Schmied, Hufschmied', 'kovář', ''],
  ['faber lignarius', 'Zimmermann', 'tesař', ''],
  ['murarius', 'Maurer', 'zedník', ''],
  ['sartor', 'Schneider', 'krejčí', ''],
  ['sutor', 'Schuhmacher, Schuster', 'švec', ''],
  ['textor', 'Weber, Leinweber', 'tkadlec', ''],
  ['molitor, molinarius', 'Müller', 'mlynář', ''],
  ['pistor', 'Bäcker', 'pekař', ''],
  ['lanio', 'Fleischhauer, Fleischer, Metzger', 'řezník', ''],
  ['braxator', 'Brauer, Bräuer', 'sládek', ''],
  ['caupo', 'Wirth, Gastwirth', 'hostinský', ''],
  ['vietor', 'Binder, Fassbinder', 'bednář', ''],
  ['figulus', 'Töpfer, Hafner', 'hrnčíř', ''],
  ['carpentarius', 'Wagner', 'kolář', ''],
  ['sellarius', 'Sattler', 'sedlář', ''],
  ['coriarius', 'Gerber, Lederer', 'koželuh', ''],
  ['pellio', 'Kürschner', 'kožešník', ''],
  ['serarius', 'Schlosser', 'zámečník', ''],
  ['restio', 'Seiler', 'provazník', ''],
  ['tornator', 'Drechsler', 'soustružník', ''],
  ['vitriarius', 'Glaser', 'sklenář', ''],
  ['tinctor', 'Färber', 'barvíř', ''],
  ['piscator', 'Fischer', 'rybář', ''],
  ['venator', 'Jäger', 'myslivec', ''],
  ['saltuarius', 'Förster, Heger', 'lesník, hajný', ''],
  ['pastor, opilio, pecorarius', 'Hirt, Halter, Schäfer', 'pastýř, ovčák', 'Halter = obecní pastýř'],
  ['auriga', 'Fuhrmann, Kutscher', 'povozník, kočí', ''],
  ['carbonarius', 'Köhler', 'uhlíř', ''],
  ['metallicus, fossor', 'Bergmann, Bergknappe', 'horník', ''],
  ['ludimagister, ludirector', 'Schulmeister, Schullehrer', 'učitel', ''],
  ['aedituus', 'Messner, Kirchendiener', 'kostelník', ''],
  ['organista', 'Organist', 'varhaník', ''],
  ['vespillo, fossor', 'Todtengräber', 'hrobník', ''],
  ['judex', 'Richter, Ortsrichter', 'rychtář', ''],
  ['consul, magister civium', 'Bürgermeister', 'purkmistr, starosta', ''],
  ['praefectus, oeconomus', 'Verwalter, Amtmann', 'správce (panství), amtman', ''],
  ['miles', 'Soldat, Gemeiner', 'voják, prostý voják', 'Invalide = vysloužilec'],
  ['civis', 'Bürger', 'měšťan', ''],
  ['opifex, magister', 'Meister', 'mistr (řemeslník)', 'socius = tovaryš (Geselle), discipulus = učeň (Lehrling)']
];
const VZTAHY = [
  ['filius / filia', 'Sohn / Tochter', 'syn / dcera', 'fil. leg. = manželský syn'],
  ['pater / mater', 'Vater / Mutter', 'otec / matka', ''],
  ['parentes', 'Eltern', 'rodiče', ''],
  ['avus / avia', 'Großvater / Großmutter', 'děd / bába', 'avus paternus = z otcovy strany, maternus = z matčiny'],
  ['proavus / proavia', 'Urgroßvater / Urgroßmutter', 'praděd / prabába', ''],
  ['nepos / neptis', 'Enkel / Enkelin; Neffe / Nichte', 'vnuk / vnučka; synovec / neteř', 'latina oba významy nerozlišuje!'],
  ['frater / soror', 'Bruder / Schwester', 'bratr / sestra', 'frater germanus = vlastní bratr'],
  ['patruus', 'Oheim (Vaterbruder)', 'strýc (otcův bratr)', ''],
  ['avunculus', 'Oheim (Mutterbruder)', 'ujec (matčin bratr)', ''],
  ['amita / matertera', 'Base, Muhme', 'teta (otcova / matčina sestra)', 'Base = i sestřenice'],
  ['consobrinus / consobrina', 'Vetter / Base, Cousine', 'bratranec / sestřenice', ''],
  ['maritus / uxor', 'Ehemann / Ehefrau, Eheweib', 'manžel / manželka', 'conjuges = manželé'],
  ['sponsus / sponsa', 'Bräutigam / Braut', 'ženich / nevěsta', ''],
  ['viduus / vidua', 'Witwer / Witwe', 'vdovec / vdova', 'relicta vidua = pozůstalá vdova (po…)'],
  ['socer / socrus', 'Schwiegervater / Schwiegermutter', 'tchán / tchyně', ''],
  ['gener / nurus', 'Schwiegersohn / Schwiegertochter', 'zeť / snacha', ''],
  ['levir, sororius / glos', 'Schwager / Schwägerin', 'švagr / švagrová', ''],
  ['vitricus / noverca', 'Stiefvater / Stiefmutter', 'otčím / macecha', ''],
  ['privignus / privigna', 'Stiefsohn / Stieftochter', 'pastorek / pastorkyně (nevlastní dítě)', ''],
  ['gemelli', 'Zwillinge', 'dvojčata', ''],
  ['posthumus', 'nachgeboren', 'pohrobek (narozen po otcově smrti)', ''],
  ['spurius, illegitimus', 'unehelich', 'nemanželský', ''],
  ['orphanus', 'Waise', 'sirotek', ''],
  ['tutor / pupillus', 'Vormund / Mündel', 'poručník / poručenec', ''],
  ['patrinus / matrina, levans', 'Pathe / Pathin, Taufpathe', 'kmotr / kmotra', ''],
  ['testis, testes', 'Zeuge, Beistand', 'svědek', 'u sňatku Beistände'],
  ['affinis / consanguineus', 'verschwägert / blutsverwandt', 'sešvagřený / pokrevní příbuzný', 'gradus = stupeň příbuzenství (dispens)']
];
const MIRY = [
  ['délka', 'sáh vídeňský (Wiener Klafter)', '≈ 1,896 m', '= 6 stop'],
  ['délka', 'stopa vídeňská (Schuh, Fuß)', '≈ 31,6 cm', '= 12 palců'],
  ['délka', 'palec (Zoll)', '≈ 2,63 cm', '= 12 čárek'],
  ['délka', 'loket vídeňský (Elle)', '≈ 78 cm', 'pražský (český) loket ≈ 59 cm'],
  ['délka', 'míle rakouská poštovní', '≈ 7,59 km', '= 4000 sáhů'],
  ['plocha', 'čtvereční sáh (Quadratklafter)', '≈ 3,60 m²', ''],
  ['plocha', 'jitro (Joch)', '≈ 0,575 ha', '= 1600 čtverečních sáhů'],
  ['plocha', 'korec (plošný)', '≈ 0,288 ha', 'plocha osetá korcem obilí, ≈ půl jitra'],
  ['objem', 'měřice vídeňská (Metzen)', '≈ 61,5 l', 'sypké látky (obilí)'],
  ['objem', 'korec český (dutý)', '≈ 93,6 l', 'starší česká míra obilí'],
  ['objem', 'vědro (Eimer)', '≈ 56,6 l', '= 40 mázů'],
  ['objem', 'máz (Maß)', '≈ 1,41 l', ''],
  ['hmotnost', 'libra vídeňská (Pfund)', '≈ 0,560 kg', '= 32 lotů'],
  ['hmotnost', 'lot', '≈ 17,5 g', ''],
  ['hmotnost', 'cent (Zentner)', '≈ 56 kg', '= 100 liber'],
  ['počet', 'tucet (Dutzend)', '12 kusů', ''],
  ['počet', 'mandel', '15 kusů', 'snopy, vejce'],
  ['počet', 'kopa (Schock)', '60 kusů', '']
];
const MINCE = [
  ['zlatý (Gulden, florenus)', 'zkratky fl., f., zl.', 'konvenční měna (od 1753): 1 zl = 60 krejcarů'],
  ['krejcar (Kreuzer)', 'kr., xr., x', '1 kr = 4 fenyky (Pfennig, denarius)'],
  ['groš (Groschen)', 'gr.', '= 3 krejcary'],
  ['tolar (Taler, konvenční)', 'Thlr.', '= 2 zlaté konvenční měny'],
  ['vídeňská měna (Wiener Währung, W. W.)', 'od 1811', 'po státním bankrotu: 1 zl konv. m. = 2,5 zl víd. m.'],
  ['rakouská měna (österr. Währung, ö. W.)', 'od 1857/58', '1 zl = 100 (nových) krejcarů; 100 zl konv. m. = 105 zl r. m.'],
  ['koruna (Krone)', 'K, h', 'od 1892: 1 zlatý = 2 koruny, 1 K = 100 haléřů'],
  ['kopa grošů (míšeňských)', 'kop.', 'starší počítání (16.–17. st.): 1 kopa = 60 grošů']
];

/* Jména: [latinsky (varianty /), česky, německy]; latinské tvary v textu bývají v pádech – hledání to zkouší */
const JMENA = [
  // mužská
  ['Adalbertus', 'Vojtěch', 'Adalbert'], ['Aegidius', 'Jiljí', 'Ägidius, Gilg'], ['Ambrosius', 'Ambrož', 'Ambros'],
  ['Andreas', 'Ondřej', 'Andreas'], ['Antonius', 'Antonín', 'Anton'], ['Augustinus', 'Augustin', 'Augustin'],
  ['Balthasar', 'Baltazar', 'Balthasar'], ['Bartholomaeus', 'Bartoloměj', 'Bartholomäus, Bartl'], ['Benedictus', 'Benedikt, Beneš', 'Benedikt'],
  ['Bernardus', 'Bernard', 'Bernhard'], ['Blasius', 'Blažej', 'Blasius'], ['Carolus', 'Karel', 'Karl'],
  ['Casparus/Gaspar', 'Kašpar', 'Kaspar'], ['Christophorus', 'Kryštof', 'Christoph'], ['Daniel', 'Daniel', 'Daniel'],
  ['Dominicus', 'Dominik', 'Dominik'], ['Elias', 'Eliáš', 'Elias'], ['Emericus', 'Imrich', 'Emmerich'],
  ['Fabianus', 'Fabián', 'Fabian'], ['Ferdinandus', 'Ferdinand', 'Ferdinand'], ['Florianus', 'Florián', 'Florian'],
  ['Franciscus', 'František', 'Franz'], ['Gallus', 'Havel', 'Gallus'], ['Georgius', 'Jiří', 'Georg'],
  ['Gregorius', 'Řehoř', 'Gregor'], ['Henricus', 'Jindřich', 'Heinrich'], ['Hieronymus', 'Jeroným', 'Hieronymus'],
  ['Ignatius', 'Ignác', 'Ignaz'], ['Jacobus', 'Jakub', 'Jakob'], ['Joannes/Johannes', 'Jan', 'Johann, Hans'],
  ['Joachimus', 'Jáchym', 'Joachim'], ['Josephus', 'Josef', 'Joseph'], ['Laurentius', 'Vavřinec', 'Lorenz'],
  ['Leonardus', 'Linhart, Leonard', 'Leonhard'], ['Leopoldus', 'Leopold', 'Leopold'], ['Lucas', 'Lukáš', 'Lukas'],
  ['Marcus', 'Marek', 'Markus'], ['Martinus', 'Martin', 'Martin'], ['Matthaeus', 'Matouš', 'Matthäus'],
  ['Matthias', 'Matěj', 'Matthias'], ['Melchior', 'Melichar', 'Melchior'], ['Michael', 'Michal', 'Michael'],
  ['Nicolaus', 'Mikuláš', 'Nikolaus, Nikl'], ['Paulus', 'Pavel', 'Paul'], ['Petrus', 'Petr', 'Peter'],
  ['Philippus', 'Filip', 'Philipp'], ['Procopius', 'Prokop', 'Prokop'], ['Sebastianus', 'Šebestián', 'Sebastian'],
  ['Sigismundus', 'Zikmund', 'Sigmund'], ['Simon', 'Šimon', 'Simon'], ['Stephanus', 'Štěpán', 'Stephan'],
  ['Thomas', 'Tomáš', 'Thomas'], ['Udalricus/Ulricus', 'Oldřich', 'Ulrich'], ['Valentinus', 'Valentin', 'Valentin'],
  ['Wenceslaus/Venceslaus', 'Václav', 'Wenzel, Wenzl'], ['Vitus', 'Vít', 'Veit'], ['Wolfgangus', 'Volfgang', 'Wolfgang'],
  // ženská
  ['Agnes', 'Anežka', 'Agnes'], ['Anna', 'Anna', 'Anna'], ['Apollonia', 'Apolena', 'Apollonia'],
  ['Barbara', 'Barbora', 'Barbara'], ['Catharina', 'Kateřina', 'Katharina'], ['Christina', 'Kristina', 'Christina'],
  ['Clara', 'Klára', 'Klara'], ['Cunegundis', 'Kunhuta', 'Kunigunde'], ['Dorothea', 'Dorota', 'Dorothea'],
  ['Elisabetha', 'Alžběta', 'Elisabeth'], ['Eva', 'Eva', 'Eva'], ['Francisca', 'Františka', 'Franziska'],
  ['Helena', 'Helena, Lena', 'Helena'], ['Joanna/Johanna', 'Johana', 'Johanna'], ['Josepha', 'Josefa', 'Josepha'],
  ['Juliana', 'Juliána', 'Juliana'], ['Ludmilla', 'Ludmila', 'Ludmilla'], ['Magdalena', 'Magdaléna, Mandalena', 'Magdalena'],
  ['Margaretha', 'Markéta', 'Margarethe'], ['Maria', 'Marie', 'Maria'], ['Martha', 'Marta', 'Martha'],
  ['Regina', 'Regína', 'Regina'], ['Rosalia', 'Rozálie', 'Rosalia'], ['Salomena', 'Salomena', 'Salome'],
  ['Sophia', 'Žofie', 'Sophie'], ['Susanna', 'Zuzana', 'Susanna'], ['Theresia', 'Terezie', 'Theresia'],
  ['Ursula', 'Voršila', 'Ursula'], ['Veronica', 'Veronika', 'Veronika'], ['Victoria', 'Viktorie', 'Viktoria']
];

/* Další zkratky (doplňují ZKRATKY v data.js): [zkratka, rozvedení, význam] */
const ZKRATKY2 = [
  ['a.', 'anno', 'roku'], ['d.', 'die', 'dne'], ['eod. / eod. die', 'eodem (die)', 'téhož (dne)'],
  ['ejusd.', 'ejusdem', 'téhož (měsíce, roku)'], ['ib.', 'ibidem', 'tamtéž'], ['No. / Nro.', 'numero', 'číslo (domu)'],
  ['R. D. / Rev. D.', 'Reverendus Dominus', 'důstojný pán (kněz)'], ['Adm. R. D.', 'Admodum Reverendus Dominus', 'velebný pán'],
  ['Dnus / Dns / Dna', 'Dominus / Domina', 'pan / paní'], ['hon.', 'honestus, -a', 'počestný, -á (obvyklé u sedláků, řemeslníků)'],
  ['lab.', 'laboriosus', 'pracovitý (u nádeníků a podruhů)'], ['pud.', 'pudica', 'cudná (o nevěstě)'],
  ['virg.', 'virgo', 'panna, svobodná'], ['juv.', 'juvenis', 'mládenec, svobodný muž'], ['gen. / generos.', 'generosus', 'urozený (šlechtic)'],
  ['nob.', 'nobilis', 'urozený'], ['rel.', 'relicta', 'pozůstalá (vdova po…)'], ['def.', 'defunctus', 'zesnulý'],
  ['cath.', 'catholicus', 'katolík'], ['acath.', 'acatholicus', 'nekatolík'], ['bapt.', 'baptizatus / baptizavit', 'pokřtěn / pokřtil'],
  ['cop.', 'copulavit / copulati', 'oddal / oddáni'], ['sep.', 'sepultus', 'pohřben'], ['ann. / aet.', 'annorum / aetatis', 've věku (let)'],
  ['m. / hebd.', 'mensium / hebdomadarum', 'měsíců / týdnů (věk)'], ['p. p.', 'praemissis praemittendis', 'po předchozích ohláškách (u sňatků)'],
  ['ohl.', 'ohlášky', 'ohlášky (česky)'], ['č. p. / č. d.', 'číslo popisné / číslo domu', ''], ['roz.', 'rozená', 'dívčím jménem'],
  ['man.', 'manželský / manželka', ''], ['nem.', 'nemanželský', ''], ['zaopatř.', 'zaopatřen', 'přijal svátosti umírajících'],
  ['k. k.', 'kaiserlich-königlich', 'c. k. (císařsko-královský)'], ['Hptm. / Lt.', 'Hauptmann / Leutnant', 'setník / poručík'],
  ['ds. / dto.', 'dieses / dito', 'tohoto / totéž'], ['u.', 'und', 'a'], ['v.', 'von / vom', 'od, z'], ['sel.', 'selig', 'zesnulý (nebožtík)']
];

/* Pevné svátky podle římského kalendáře užívaného v českých zemích v 17.–19. st.
   [měsíc, den, česky, latinsky, poznámka, datum v přestupném roce]; místní kalendáře (diecéze, řády) se lišily – viz Grotefend. */
const SVATKY = [
  [1, 1, 'Obřezání Páně, Nový rok', 'Circumcisio Domini'], [1, 6, 'Zjevení Páně (Tři králové)', 'Epiphania Domini'],
  [1, 20, 'sv. Fabián a Šebestián', 'SS. Fabiani et Sebastiani'], [1, 21, 'sv. Anežka', 'S. Agnetis'],
  [1, 25, 'Obrácení sv. Pavla', 'Conversio S. Pauli'], [2, 2, 'Hromnice (Očišťování P. Marie)', 'Purificatio BMV'],
  [2, 3, 'sv. Blažej', 'S. Blasii'], [2, 5, 'sv. Agáta', 'S. Agathae'],
  [2, 24, 'sv. Matěj', 'S. Matthiae ap.', 'v přestupném roce 25. 2.', [2, 25]], [3, 19, 'sv. Josef', 'S. Josephi'],
  [3, 25, 'Zvěstování P. Marie', 'Annuntiatio BMV'], [4, 23, 'sv. Vojtěch', 'S. Adalberti'],
  [4, 24, 'sv. Jiří', 'S. Georgii', 'v Čechách 24. 4. (23. 4. patří sv. Vojtěchu), jinde 23. 4.'], [4, 25, 'sv. Marek', 'S. Marci'],
  [5, 1, 'sv. Filip a Jakub', 'SS. Philippi et Jacobi'], [5, 3, 'Nalezení sv. Kříže', 'Inventio S. Crucis'],
  [5, 4, 'sv. Florián', 'S. Floriani'], [5, 16, 'sv. Jan Nepomucký', 'S. Joannis Nepomuceni'],
  [6, 15, 'sv. Vít', 'S. Viti'], [6, 24, 'Narození sv. Jana Křtitele', 'Nativitas S. Joannis Baptistae'],
  [6, 29, 'sv. Petr a Pavel', 'SS. Petri et Pauli'], [7, 2, 'Navštívení P. Marie', 'Visitatio BMV'],
  [7, 4, 'sv. Prokop', 'S. Procopii'], [7, 22, 'sv. Máří Magdaléna', 'S. Mariae Magdalenae'],
  [7, 25, 'sv. Jakub (Větší)', 'S. Jacobi ap.'], [7, 26, 'sv. Anna', 'S. Annae'],
  [8, 10, 'sv. Vavřinec', 'S. Laurentii'], [8, 15, 'Nanebevzetí P. Marie', 'Assumptio BMV'],
  [8, 24, 'sv. Bartoloměj', 'S. Bartholomaei'], [9, 8, 'Narození P. Marie', 'Nativitas BMV'],
  [9, 14, 'Povýšení sv. Kříže', 'Exaltatio S. Crucis'], [9, 16, 'sv. Ludmila', 'S. Ludmillae'],
  [9, 21, 'sv. Matouš', 'S. Matthaei'], [9, 28, 'sv. Václav', 'S. Wenceslai'],
  [9, 29, 'sv. Michael', 'S. Michaelis'], [10, 16, 'sv. Havel', 'S. Galli'],
  [10, 28, 'sv. Šimon a Juda', 'SS. Simonis et Judae'], [11, 1, 'Všech svatých', 'Omnium Sanctorum'],
  [11, 2, 'Památka zesnulých (Dušičky)', 'Commemoratio omnium fidelium defunctorum'], [11, 11, 'sv. Martin', 'S. Martini'],
  [11, 19, 'sv. Alžběta', 'S. Elisabethae'], [11, 25, 'sv. Kateřina', 'S. Catharinae'],
  [11, 30, 'sv. Ondřej', 'S. Andreae'], [12, 4, 'sv. Barbora', 'S. Barbarae'],
  [12, 6, 'sv. Mikuláš', 'S. Nicolai'], [12, 8, 'Početí P. Marie', 'Conceptio BMV'],
  [12, 13, 'sv. Lucie', 'S. Luciae'], [12, 21, 'sv. Tomáš', 'S. Thomae ap.'],
  [12, 24, 'Štědrý den (vigilie)', 'Vigilia Nativitatis Domini'], [12, 25, 'Boží hod vánoční', 'Nativitas Domini'],
  [12, 26, 'sv. Štěpán', 'S. Stephani'], [12, 27, 'sv. Jan Evangelista', 'S. Joannis Ev.'],
  [12, 28, 'Mláďátka', 'SS. Innocentium']
];

/* Časté záměny při čtení (ověřené obecné poučky, ne tvary jednotlivých písařů) */
const ZAMENY = [
  { cte: 'n', muze: 'e, u, r', proc: 'Kurentové e jsou dvě stříšky jako zmenšené n. Rozhoduje šířka a oblouček nad u – ten písař často jen naznačil čárkou.', tip: 'Zkuste dosadit e i n a vyberte skutečné slovo (Mann × Maen).' },
  { cte: 'u', muze: 'n, ü, nn', proc: 'Oblouček nad u (u-Bogen) odlišuje u od n. Čárka nad n (m) znamená zdvojení, dvě tečky/čárky přehlásku.', tip: 'Oblouček = u; vodorovná čára = zdvojení; dvě značky = přehláska.' },
  { cte: 'f', muze: 'ſ, h', proc: 'ſ = dlouhé s. Všechna tři jdou nad i pod řádek. f má přeškrtnutí, dlouhé ſ ne, h má dole kličku.', tip: 'Dlouhé ſ nikdy nestojí na konci slova; f ano.' },
  { cte: 'B', muze: 'ß, ſs', proc: 'Ostré s (ß) vzniklo spojením dlouhého ſ a z (nebo s); tvarem připomíná latinské B.', tip: 'Velké B uprostřed slova téměř jistě znamená ß/ss (Großvater).' },
  { cte: 'r', muze: 'c, e, n', proc: 'r má malou smyčku vpravo nahoře, c je krátký tah s háčkem, e dvě stříšky.', tip: 'Ve spřežkách ch, ck je c jen náznak – čtěte celou spřežku.' },
  { cte: 'v', muze: 'w, m', proc: 'Liší se počtem špiček před bříškem: v jedna, w dvě; m bříško nemá.', tip: 'Počítejte špičky.' },
  { cte: 'I', muze: 'J', proc: 'V matrikách se I a J často nerozlišují (Johann i Iohann).', tip: 'Řiďte se smyslem slova, ne tvarem.' },
  { cte: 'latinské e', muze: 'kurentové n', proc: 'V jednom zápisu se míchá latinka (jména, latinské výrazy) s kurentem. Latinské e a kurentové e vypadají úplně jinak.', tip: 'Nejdřív určete, jakým písmem je slovo psané – latinka bývá svislejší a oblejší.' },
  { cte: '7ber, 8ber', muze: 'září, říjen', proc: 'Zkratky z latinských číslovek: septem 7 = září, octo 8 = říjen, novem 9 = listopad, decem 10/X = prosinec.', tip: 'Nikdy nepřevádějte 7ber na červenec.' },
  { cte: 'Wenzel, Adalbert', muze: 'Václav, Vojtěch', proc: 'Jména se zapisovala v jazyce zápisu (latinsky, německy, česky) – a příjmení podle sluchu.', tip: 'Viz slovník jmen; zkoušejte varianty příjmení (Novák, Nowak, Nowack).' }
];
/* Období a varianty písma – jen ověřená obecná fakta (viz LITERATURA) */
const OBDOBI = [
  { obdobi: '16.–17. století', pismo: 'starší kurent', rysy: 'Tvary velmi proměnlivé, mnoho kliček a zkratek. Psáno brkem.', pozor: 'Bez paleografické průpravy obtížné; pomáhá srovnání s datovanými texty téhož písaře.' },
  { obdobi: '18. století, do 1784', pismo: 'kurent + latinská kurzíva', rysy: 'Brk, výrazný sklon doprava. Matriky psané volně (většinou latinsky), jména a latinské výrazy latinkou.', pozor: 'Latinské pády jmen (Joannis, Mariae) – slovník jmen je umí převést.' },
  { obdobi: 'od 1784 (josefínské matriky)', pismo: 'kurent v tištěném formuláři', rysy: 'Předtištěné rubriky (záhlaví tištěné, často frakturou), zápisy kurentem; německy, latinsky nebo česky podle fary.', pozor: 'Nejdřív přečtěte záhlaví sloupců – ty řeknou, co v kolonce hledat.' },
  { obdobi: '19. století', pismo: 'pozdní kurent', rysy: 'Pravidelnější písmo, s rozšířením ocelového pera kontrast slabých a silných tahů. České texty postupně přecházejí na latinku, německé zůstávají kurentem.', pozor: 'Rychlopis úředníků: zkrácené koncovky (-ung, -en jako vlnka).' },
  { obdobi: '1915–1941 (Německo)', pismo: 'Sütterlin, Deutsche Volksschrift', rysy: 'Sütterlin (1911, v Prusku od 1915): svislé, oblé písmo, stejnoměrný tah (pero s kulatým hrotem), poměr výšek 1:1:1. Od 1935 jako „Deutsche Volksschrift“ s mírným sklonem.', pozor: 'Stejná abeceda a pravidla (ſ/s, oblouček nad u) jako kurent, jen jiné tvary. Výuka kurentu zakázána od září 1941.' }
];

/* Šablony typických zápisů: kolonky rakouských tištěných matrik (od 1784; znění záhlaví se lišilo podle tiskopisu a doby)
   [záhlaví německy, česky, vzorová hodnota, překlad]. Vzorové zápisy jsou smyšlené. */
const SABLONY = [
  { id: 'krest', nazev: 'Křest (Taufbuch)', kolonky: [
    ['Monat und Tag der Geburt / der Taufe', 'měsíc a den narození / křtu', 'geb. 7ten, get. 8ten März 1843', 'narozen 7., pokřtěn 8. března 1843'],
    ['Haus-Nr.', 'číslo domu', '12', '12'],
    ['Name des Täuflings', 'jméno dítěte', 'Johann', 'Jan'],
    ['Religion: katholisch / akatholisch', 'náboženství', 'katholisch', 'katolické'],
    ['Geschlecht: Knabe / Mädchen', 'pohlaví', 'Knabe', 'chlapec'],
    ['ehelich / unehelich', 'manželské / nemanželské', 'ehelich', 'manželské'],
    ['Vater: Name, Stand, Wohnort', 'otec: jméno, stav, bydliště', 'Wenzel Novak, Bauer in Lhota Nr. 12', 'Václav Novák, sedlák v Lhotě č. 12'],
    ['Mutter: Name, Eltern', 'matka: jméno, její rodiče', 'Anna, Tochter des Joseph Kral, Häusler', 'Anna, dcera Josefa Krále, domkáře'],
    ['Pathen: Name, Stand', 'kmotři', 'Georg Dvořak, Inwohner, u. dessen Ehegattin Maria', 'Jiří Dvořák, podruh, a jeho manželka Marie'],
    ['Hebamme: geprüft / ungeprüft', 'porodní bába: zkoušená / nezkoušená', 'Katharina Svoboda, geprüft', 'Kateřina Svobodová, zkoušená'],
    ['Taufender Priester', 'křtící kněz', 'Franz Hora, Kaplan', 'František Hora, kaplan'],
    ['Anmerkung', 'poznámka', '', 'pozdější přípisy: legitimace, sňatek, úmrtí']
  ], latina: 'Die 8. Martii 1771 baptizatus est a me Francisco Hora, capellano, infans Joannes, filius legitimus Wenceslai Novak, coloni ex Lhota No. 12, et Annae uxoris ejus. Patrini: Georgius Dvořak, inquilinus, et Maria uxor ejus.',
    preklad: 'Dne 8. března 1771 byl mnou, Františkem Horou, kaplanem, pokřtěn Jan, manželský syn Václava Nováka, sedláka z Lhoty č. 12, a Anny, jeho manželky. Kmotři: Jiří Dvořák, podruh, a Marie, jeho manželka.' },
  { id: 'snatek', nazev: 'Sňatek (Trauungsbuch)', kolonky: [
    ['Monat und Tag der Trauung', 'měsíc a den sňatku', '24ten November 1863', '24. listopadu 1863'],
    ['Haus-Nr.', 'číslo domu', '7', '7'],
    ['Bräutigam: Name, Stand, Eltern', 'ženich: jméno, stav, rodiče', 'Joseph Novak, Bauerssohn, ehelicher Sohn des Wenzel Novak u. der Anna geb. Kral', 'Josef Novák, selský syn, manželský syn Václava Nováka a Anny roz. Králové'],
    ['Religion', 'náboženství', 'katholisch', 'katolické'],
    ['Alter', 'věk', '24', '24 let'],
    ['ledig / Witwer', 'svobodný / vdovec', 'ledig', 'svobodný'],
    ['Braut: Name, Eltern', 'nevěsta: jméno, rodiče', 'Theresia, ehel. Tochter des Johann Svoboda, Chaluppner', 'Terezie, manž. dcera Jana Svobody, chalupníka'],
    ['Religion, Alter, ledig / Witwe', 'náboženství, věk, svobodná / vdova', 'kath., 21, ledig', 'katolička, 21 let, svobodná'],
    ['Beistände (Zeugen)', 'svědkové', 'Anton Hora, Bauer; Franz Kral, Häusler', 'Antonín Hora, sedlák; František Král, domkář'],
    ['Copulans (Priester)', 'oddávající kněz', 'Johann Beneš, Pfarrer', 'Jan Beneš, farář'],
    ['Anmerkung', 'poznámka', 'drei Verkündigungen', 'tři ohlášky; dispens, souhlas poručníka…']
  ], latina: 'Die 24. Novembris 1763 praemissis tribus denuntiationibus copulati sunt honestus juvenis Josephus Novak, filius legitimus Wenceslai Novak, coloni ex Lhota, et pudica virgo Theresia, filia legitima Joannis Svoboda, casarii ibidem. Testes: Antonius Hora, colonus, et Franciscus Kral, casarius.',
    preklad: 'Dne 24. listopadu 1763 po třech ohláškách byli oddáni počestný mládenec Josef Novák, manželský syn Václava Nováka, sedláka z Lhoty, a cudná panna Terezie, manželská dcera Jana Svobody, chalupníka tamtéž. Svědkové: Antonín Hora, sedlák, a František Král, chalupník.' },
  { id: 'umrti', nazev: 'Úmrtí (Sterbebuch)', kolonky: [
    ['Monat und Tag des Todes / Begräbnisses', 'měsíc a den úmrtí / pohřbu', 'gest. 3ten, begr. 5ten Jänner 1850', 'zemřel 3., pohřben 5. ledna 1850'],
    ['Haus-Nr.', 'číslo domu', '12', '12'],
    ['Name und Stand des Verstorbenen', 'jméno a stav zemřelého', 'Wenzel Novak, Ausgedinger, Witwer', 'Václav Novák, výměnkář, vdovec'],
    ['Religion', 'náboženství', 'katholisch', 'katolické'],
    ['Geschlecht', 'pohlaví', 'männlich', 'mužské'],
    ['Alter', 'věk', '72 Jahre', '72 let'],
    ['Krankheit und Todesart', 'nemoc a způsob smrti', 'Altersschwäche', 'sešlost věkem'],
    ['versehen / unversehen', 'zaopatřen / nezaopatřen', 'versehen', 'zaopatřen svátostmi'],
    ['Begraben von / Ort', 'pohřbil / místo', 'Franz Hora, Kaplan; Friedhof Lhota', 'František Hora, kaplan; hřbitov v Lhotě'],
    ['Anmerkung', 'poznámka', 'Todtenbeschau', 'ohledání mrtvoly (ohledač)']
  ], latina: 'Die 3. Januarii 1770 obiit Wenceslaus Novak, colonus ex Lhota No. 12, annorum 72, sacramentis provisus, et die 5. ejusdem sepultus est in coemeterio ad S. Martinum.',
    preklad: 'Dne 3. ledna 1770 zemřel Václav Novák, sedlák z Lhoty č. 12, ve věku 72 let, zaopatřen svátostmi, a 5. téhož měsíce byl pohřben na hřbitově u sv. Martina.' }
];

/* Další celé řádky ke cvičení (úroveň 5): [text, překlad, jazyk] */
const RADKY = [
  ['Die Brautleute sind katholisch und ledig', 'Snoubenci jsou katolíci a svobodní', 'de'],
  ['Beistände: Joseph Dvořak, Bauer', 'Svědkové: Josef Dvořák, sedlák', 'de'],
  ['ehelicher Sohn des Wenzel Novak', 'manželský syn Václava Nováka', 'de'],
  ['versehen mit den heiligen Sterbesakramenten', 'zaopatřen svatými svátostmi umírajících', 'de'],
  ['Todesursache: Lungenentzündung', 'Příčina smrti: zápal plic', 'de'],
  ['im 45ten Lebensjahre', 've 45. roce života', 'de'],
  ['Hebamme Anna Hora aus Lhota', 'porodní bába Anna Horová z Lhoty', 'de'],
  ['nach dreimaliger Verkündigung', 'po trojím ohlášení', 'de'],
  ['baptizatus est a me', 'byl mnou pokřtěn', 'la'],
  ['filius legitimus Joannis', 'manželský syn Jana', 'la'],
  ['copulati sunt in facie ecclesiae', 'byli oddáni před tváří církve', 'la'],
  ['sacramentis provisus sepultus est', 'zaopatřen svátostmi byl pohřben', 'la']
];

/* Zdroje a literatura (ověřené tituly; online odkazy ověřeny 17. 11. 2026) */
const LITERATURA = [
  ['Hlaváček, I. – Kašpar, J. – Nový, R.: Vademecum pomocných věd historických', '', 'česká příručka paleografie, chronologie, metrologie'],
  ['Grotefend, H.: Taschenbuch der Zeitrechnung des deutschen Mittelalters und der Neuzeit (online)', 'https://bilder.manuscripta-mediaevalia.de/gaeste/grotefend/grotefend.htm', 'svátky, neděle, datování podle svátků'],
  ['Meeus, J.: Astronomical Algorithms', '', 'výpočet Velikonoc a juliánského dne použitý ve stránce'],
  ['Sütterlinschrift – Wikipedie (de)', 'https://de.wikipedia.org/wiki/S%C3%BCtterlinschrift', 'Sütterlin 1911/1915, Deutsche Volksschrift 1935, zákaz 1941'],
  ['Deutsche Kurrentschrift – Wikipedie (de)', 'https://de.wikipedia.org/wiki/Deutsche_Kurrentschrift', 'vývoj kurentu'],
  ['Kurent – Wikipedie (cs)', 'https://cs.wikipedia.org/wiki/Kurent', ''],
  ['Script Tutorial, Brigham Young University', 'https://script.byu.edu/', 'kurzy čtení německého a latinského písma'],
  ['FamilySearch Wiki – Latin / German / Czech Genealogical Word List', 'https://www.familysearch.org/en/wiki/Latin_Genealogical_Word_List', 'slovníčky matričních výrazů (anglicky)']
];

const DATA = { NEMOCI, POVOLANI, VZTAHY, MIRY, MINCE, JMENA, ZKRATKY2, SVATKY, ZAMENY, OBDOBI, SABLONY, RADKY, LITERATURA };
if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
else koren.KurentSlovniky = DATA;
})(typeof window !== 'undefined' ? window : globalThis);

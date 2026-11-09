/* Svět u stolu – data: Asie bez Blízkého východu. Ověřeno 9. 11. 2026.
   Hinduistická data (tabulka) spočítána astronomicky (Swiss Ephemeris, ajanámša Láhirí, pravidla
   Drik Panchang pro Dillí / Thiruvananthapuram / Káthmándú) a porovnána s drikpanchang.com,
   qppstudio.net, lagna360.com a vládními seznamy svátků; japonská a korejská data ze slunečních
   délek a cyklu 60 dní, ověřena s NAOJ a japonskými/korejskými kalendáři. */
(window.SUS_DATA = window.SUS_DATA || []).push(

/* ===================== JAPONSKO ===================== */
{
  id: 'jp-osechi-zoni',
  zeme: ['JP'],
  misto: '',
  jidlo: 'Oseči (osechi) v krabičkách a polévka zóni s moči',
  emoji: '🍱',
  prilezitost: 'Japonský Nový rok (Šógacu)',
  kdy: { typ: 'pevne', m: 1, d: 1, delka: 3 },
  kultura: 'vychodoasijske',
  proc: 'Oseči se připravuje předem do lakovaných krabiček (džúbako), aby se první dny roku nemuselo vařit. Každý chod je přání: krevety s ohnutými zády = dlouhý život do stáří, černé sóji (kuromame) = píle a zdraví („mame“), jikry sledě (kazunoko) = hodně dětí, kaštanové pyré (kuri kinton) = zlato a bohatství. K snídani se jí polévka zóni s rýžovým koláčkem moči – v oblasti Kantó čirý vývar s hranatým opečeným moči, v Kansai bílé miso s kulatým.',
  recept: {
    nazev: 'Zóni (tokijská verze)',
    porce: 4,
    cas: '40 min',
    suroviny: ['8 kousků moči (kirimoči, asijské obchody)', '1 l dashi (10 g kombu + 15 g sušeného bonita, nebo instantní dashi)', '200 g kuřecích stehenních řízků', '1 mrkev', 'hrst listového špenátu', '2 lžíce sójové omáčky', '1 lžíce mirinu (nebo 1 lžička cukru)', 'sůl', 'kůra z citronu (místo juzu)'],
    postup: [
      'Kombu namočte na 30 minut do studené vody, zahřejte těsně pod var, vyjměte, přidejte bonito, minutu povařte a sceďte.',
      'Kuře nakrájejte na kousky, mrkev na kolečka (ideálně vykrajovátkem na kytičky) a obojí vařte ve vývaru doměkka.',
      'Dochuťte sójovou omáčkou, mirinem a solí.',
      'Moči opékejte na suché pánvi nebo pod grilem, dokud nenafouknou a nezezlátnou.',
      'Špenát krátce spařte a vymačkejte.',
      'Do misek dejte moči, zalijte horkým vývarem s kuřetem a mrkví, přidejte špenát a proužek citronové kůry. Moči jezte opatrně a po malých soustech.'
    ]
  },
  zdroj: 'https://ja.wikipedia.org/wiki/おせち料理'
},
{
  id: 'jp-nanakusa',
  zeme: ['JP'],
  misto: '',
  jidlo: 'Nanakusa-gaju – rýžová kaše se sedmi jarními bylinkami',
  emoji: '🌿',
  prilezitost: 'Džindžicu (svátek sedmi bylin)',
  kdy: { typ: 'pevne', m: 1, d: 7 },
  kultura: 'vychodoasijske',
  proc: 'Sedmého ledna se jí řídká rýžová kaše se sedmi jarními bylinami (seri, nazuna, gógjó, hakobera, hotokenoza, suzuna = vodnice, suzuširo = ředkev). Má přinést zdraví na celý rok a po novoročním hodování ulevit žaludku. Zvyk přišel z Číny, kde je 7. den 1. měsíce „dnem lidí“ (Žen-ž’).',
  recept: {
    nazev: 'Nanakusa-gaju',
    porce: 4,
    cas: '1 h',
    suroviny: ['150 g kulatozrnné rýže', '1,2 l vody', '1 lžička soli', 'směs zelených bylin celkem asi 80 g: řeřicha, petržel, kozlíček (polníček), ptačinec nebo mladý špenát, celerová nať', '1 malá vodnice (tuřín) s natí', 'kousek bílé ředkve (asi 5 cm)'],
    postup: [
      'Rýži propláchněte, zalijte vodou a nechte 30 minut namočenou.',
      'Přiveďte k varu, stáhněte na nejmenší plamen a pod pokličkou vařte 30–40 minut do krémové kaše.',
      'Vodnici a ředkev nakrájejte na tenké plátky, bylinky a nať spařte vroucí osolenou vodou, zchlaďte a nadrobno nasekejte.',
      'Plátky vodnice a ředkve přidejte do kaše posledních 10 minut varu.',
      'Kaši osolte, vmíchejte nasekané bylinky a hned podávejte.'
    ]
  },
  zdroj: 'https://ja.wikipedia.org/wiki/七草がゆ'
},
{
  id: 'jp-kagami-biraki',
  zeme: ['JP'],
  misto: '',
  jidlo: 'Oširuko (sladká polévka z azuki) s rozlámaným kagami moči',
  emoji: '🫘',
  prilezitost: 'Kagami biraki („otevření zrcadla“)',
  kdy: { typ: 'pevne', m: 1, d: 11 },
  kultura: 'vychodoasijske',
  proc: 'Dvoupatrový rýžový koláč kagami moči stojí přes svátky jako obětina bohu nového roku. Jedenáctého ledna (v Kansai 15., v Kjótu 4.) se ztvrdlý koláč rozláme kladívkem – nekrájí se, nůž by připomínal sebevraždu samurajů – a sní se v oširuko nebo zóni. Kdo jí koláč, přijímá sílu boha roku a zdraví.',
  recept: {
    nazev: 'Oširuko',
    porce: 4,
    cas: '2 h (+ namáčení přes noc)',
    suroviny: ['200 g fazolí azuki (zdravá výživa, asijské obchody)', '160 g cukru', 'špetka soli', '8 kousků moči'],
    postup: [
      'Azuki namočte přes noc, slijte, zalijte čerstvou vodou, přiveďte k varu a vodu slijte (zbaví fazole hořkosti).',
      'Znovu zalijte asi 1 l vody a vařte 60–90 minut, až se fazole snadno rozmáčknou mezi prsty.',
      'Přidejte cukr a sůl, vařte dalších 10 minut; podle chuti dolijte vodu na polévkovou hustotu.',
      'Moči opečte na suché pánvi nebo pod grilem, až nafouknou.',
      'Moči vložte do misek a zalijte horkou sladkou polévkou.'
    ]
  },
  zdroj: 'https://ja.wikipedia.org/wiki/鏡開き'
},
{
  id: 'jp-secubun',
  zeme: ['JP'],
  misto: '',
  jidlo: 'Ehómaki (celá nekrájená roláda suši) a pražené sóji',
  emoji: '🍣',
  prilezitost: 'Secubun (předvečer jara)',
  kdy: { typ: 'tabulka', data: { '2025': '02-02', '2026': '02-03', '2027': '02-03', '2028': '02-03', '2029': '02-02', '2030': '02-03', '2031': '02-03', '2032': '02-03', '2033': '02-02', '2034': '02-03', '2035': '02-03', '2036': '02-03' } },
  kultura: 'vychodoasijske',
  proc: 'Den před začátkem jara (Rišun) se házejí pražené sóji ze dveří s pokřikem „Oni wa soto! Fuku wa uči!“ (Démoni ven, štěstí dovnitř) a každý sní tolik bobů, kolik je mu let (často o jeden víc). Ehómaki se jí vcelku, mlčky a čelem ke „šťastné“ světové straně daného roku – nekrájí se, aby se „nepřeřízlo“ štěstí. Zvyk z Ósaky rozšířily po celém Japonsku od konce 80. let obchodní řetězce.',
  recept: {
    nazev: 'Ehómaki (futomaki)',
    porce: 4,
    cas: '1 h',
    suroviny: ['300 g rýže na suši', '50 ml rýžového octa, 1 lžíce cukru, 1 lžička soli', '4 plátky nori', '3 vejce (na tenkou omeletu)', '1 okurka', '150 g krabích tyčinek nebo uzeného lososa', '1 menší mrkev', '4 shiitake (sušené)', '1 lžíce sójové omáčky, 1 lžička cukru'],
    postup: [
      'Rýži uvařte podle návodu, ještě horkou promíchejte s octem, v němž jste rozpustili cukr a sůl, a nechte vychladnout na pokojovou teplotu.',
      'Shiitake namočte, nakrájejte na proužky a poduste 5 minut v trošce vody se sójovou omáčkou a cukrem.',
      'Z vajec usmažte tenkou omeletu a nakrájejte ji na proužky; okurku a mrkev nakrájejte na dlouhé hranolky (mrkev krátce spařte).',
      'Nori položte na bambusovou rohožku, rozprostřete na ně čtvrtinu rýže a nechte nahoře 2 cm volné.',
      'Doprostřed naskládejte sedm náplní (sedm = bohové štěstí) a pevně zarolujte.',
      'Roládu nekrájejte – jezte ji celou, mlčky, čelem ke šťastné straně roku.'
    ]
  },
  zdroj: 'https://ja.wikipedia.org/wiki/恵方巻'
},
{
  id: 'jp-valentyn',
  zeme: ['JP'],
  misto: '',
  jidlo: 'Čokoláda (honmei a giri čoko)',
  emoji: '🍫',
  prilezitost: 'Valentýn',
  kdy: { typ: 'pevne', m: 2, d: 14 },
  kultura: 'novodobe',
  proc: 'V Japonsku na Valentýna dávají čokoládu ženy mužům: „honmei čoko“ milovanému (často domácí), „giri čoko“ z povinnosti kolegům a šéfům. Zvyk vznikl z kampaní cukráren a výrobců čokolády v 50.–70. letech. Muži dárek vracejí o měsíc později na White Day (14. 3.).',
  recept: {
    nazev: 'Domácí čokoládové lanýže (nama čoko)',
    porce: 20,
    cas: '30 min + 3 h chlazení',
    suroviny: ['200 g hořké čokolády (60–70 %)', '100 ml smetany ke šlehání (33 %)', '15 g másla', '2 lžíce kakaa na obalení'],
    postup: [
      'Čokoládu nasekejte nadrobno.',
      'Smetanu ohřejte těsně pod var a zalijte jí čokoládu; minutu nechte stát a pak hladce rozmíchejte.',
      'Vmíchejte máslo, hmotu nalijte do formy vyložené pečicím papírem (asi 12 × 12 cm) a nechte 3 hodiny ztuhnout v lednici.',
      'Nakrájejte na kostky horkým nožem a obalte v kakau.'
    ]
  },
  zdroj: 'https://ja.wikipedia.org/wiki/バレンタインデー'
},
{
  id: 'jp-hinamacuri',
  zeme: ['JP'],
  misto: '',
  jidlo: 'Čirašizuši, hišimoči, hina-arare a polévka ze slávek hamaguri',
  emoji: '🎎',
  prilezitost: 'Hinamacuri (Den dívek)',
  kdy: { typ: 'pevne', m: 3, d: 3 },
  kultura: 'vychodoasijske',
  proc: 'Rodiny s dcerami vystavují panenky císařského dvora a prosí o zdraví a šťastný život dívek. Na stůl patří barevné „rozházené suši“ čirašizuši, kosočtverečný koláč hišimoči a rýžové křupky hina-arare v růžové, bílé a zelené (jaro, sníh, nová tráva). Polévka z mušlí hamaguri připomíná, že k sobě pasují jen dvě poloviny téže lastury – přání věrného manželství.',
  recept: {
    nazev: 'Čirašizuši',
    porce: 4,
    cas: '1 h',
    suroviny: ['300 g rýže na suši', '60 ml rýžového octa, 1,5 lžíce cukru, 1 lžička soli', '200 g vařených loupaných krevet', '100 g uzeného lososa', '2 vejce', '1 mrkev', '100 g zelených lusků nebo hrášku', '1 lžíce lososového kaviáru (nepovinně)', 'nori na proužky'],
    postup: [
      'Uvařenou horkou rýži promíchejte s octem, cukrem a solí a nechte vychladnout.',
      'Mrkev nakrájejte na drobné kostičky a 3 minuty povařte, lusky spařte a nakrájejte šikmo.',
      'Z rozšlehaných vajec usmažte tenkou omeletu a nakrájejte ji na tenké nudličky (kinši tamago).',
      'Do rýže vmíchejte mrkev, rýži rozprostřete do mísy.',
      'Posypte žlutými nudličkami vajec, poklaďte krevetami, lososem a lusky, nahoru dejte kaviár a proužky nori.'
    ]
  },
  zdroj: 'https://ja.wikipedia.org/wiki/雛祭り'
},
{
  id: 'jp-den-deti',
  zeme: ['JP'],
  misto: '',
  jidlo: 'Kašiwa moči (rýžový koláček v dubovém listu) a čimaki',
  emoji: '🎏',
  prilezitost: 'Kodomo no hi (Den dětí, Tango no sekku)',
  kdy: { typ: 'pevne', m: 5, d: 5 },
  kultura: 'vychodoasijske',
  proc: 'Nad domy vlají kapři koinobori a rodiny prosí o zdraví a sílu dětí (původně chlapců). Kašiwa moči je rýžový koláček s fazolovou pastou zabalený do dubového listu: dub neshazuje staré listy, dokud nevyraší nové, a symbolizuje tak nepřerušený rod. V Kansai se častěji jí čimaki, rýžový knedlík zabalený v listech, převzatý z čínského svátku Tuan-wu.',
  recept: {
    nazev: 'Kašiwa moči',
    porce: 8,
    cas: '1 h',
    suroviny: ['200 g hladké rýžové mouky (džóšinko, asijské obchody)', '20 g bramborového škrobu', '1 lžíce cukru', 'asi 180 ml horké vody', '240 g sladké fazolové pasty anko (koupené, nebo z azuki uvařených s cukrem)', '8 dubových nebo banánových listů (nejí se; lze vynechat a použít pečicí papír)'],
    postup: [
      'Mouku, škrob a cukr smíchejte a postupně přilévejte horkou vodu, až vznikne hladké těsto jako ušní lalůček.',
      'Těsto natrhejte na kousky, rozložte do pařáku na vlhkou utěrku a 20 minut napařujte.',
      'Horké těsto přendejte do mísy a palicí nebo vařečkou ho propracujte, až je pružné; navlhčenýma rukama rozdělte na 8 dílů.',
      'Z anko vytvarujte 8 kuliček.',
      'Každý díl těsta rozplácněte do oválu, doprostřed dejte anko a přeložte napůl jako taštičku, okraje přitiskněte.',
      'Koláčky ještě 5 minut napařte a zabalte do listu.'
    ]
  },
  zdroj: 'https://ja.wikipedia.org/wiki/柏餅'
},
{
  id: 'jp-minazuki',
  zeme: ['JP'],
  misto: 'Kjóto',
  jidlo: 'Minazuki – trojúhelníkový koláček z bílého uiró s azuki',
  emoji: '🔺',
  prilezitost: 'Nagoši no harae (očista v polovině roku)',
  kdy: { typ: 'pevne', m: 6, d: 30 },
  kultura: 'vychodoasijske',
  proc: 'Poslední červnový den svatyně pořádají očistu od hříchů prvního pololetí a lidé procházejí velkým kruhem z rákosu. Na císařském dvoře se tehdy jedl led z ledových jam proti letnímu horku; obyčejní lidé si ho nemohli dovolit, a tak jedí koláček ve tvaru ledového úlomku. Červené fazole azuki navrchu mají zahánět zlo.',
  recept: {
    nazev: 'Minazuki',
    porce: 8,
    cas: '1 h 30 min',
    suroviny: ['100 g hladké rýžové mouky', '30 g pšeničné hladké mouky', '20 g bramborového škrobu', '100 g cukru', '300 ml vody', '150 g celých slazených azuki (amanattó nebo vařené azuki s cukrem)'],
    postup: [
      'Formu asi 15 × 15 cm vyložte pečicím papírem.',
      'Obě mouky, škrob a cukr smíchejte s vodou na hladké řídké těsto.',
      'Odlijte asi 100 ml těsta stranou, zbytek nalijte do formy a 20 minut napařujte.',
      'Na ztuhlou vrstvu rozprostřete azuki, přelijte odloženým těstem a napařujte dalších 15 minut.',
      'Nechte vychladnout a nakrájejte na trojúhelníky.'
    ]
  },
  zdroj: 'https://ja.wikipedia.org/wiki/水無月_(和菓子)'
},
{
  id: 'jp-tanabata',
  zeme: ['JP'],
  misto: '',
  jidlo: 'Sómen – tenké studené pšeničné nudle',
  emoji: '🎋',
  prilezitost: 'Tanabata (svátek hvězd)',
  kdy: { typ: 'pevne', m: 7, d: 7 },
  kultura: 'vychodoasijske',
  proc: 'Tanabata slaví jediné roční setkání tkadleny Orihime a pastevce Hikobošiho (hvězdy Vega a Altair) přes Mléčnou dráhu; přání se píšou na papírky a věší na bambus. Tenké bílé nudle sómen připomínají Mléčnou dráhu nebo nitě tkadleny; zvyk navazuje na dvorní obětinu sakubei z doby Heian. Japonský svaz výrobců sušených nudlí vyhlásil 7. 7. Dnem sómen.',
  recept: {
    nazev: 'Hijašisómen (studené sómen s omáčkou)',
    porce: 4,
    cas: '20 min',
    suroviny: ['300 g sómen (asijské obchody; jinak nejtenčí pšeničné nudle)', 'omáčka: 300 ml dashi, 75 ml sójové omáčky, 75 ml mirinu', '2 jarní cibulky', 'kousek čerstvého zázvoru', '1 okurka', 'kostky ledu'],
    postup: [
      'Dashi, sójovou omáčku a mirin krátce povařte a omáčku vychlaďte v lednici.',
      'Sómen vařte podle obalu (obvykle 2 minuty), sceďte a důkladně propláchněte studenou vodou, aby nebyly lepkavé.',
      'Nudle dejte do mísy s ledovou vodou a kostkami ledu.',
      'Cibulku nakrájejte na kolečka, zázvor nastrouhejte, okurku na nudličky (jako hvězdné paprsky lze vykrojit i hvězdičky z mrkve).',
      'Každý si nabírá nudle hůlkami a namáčí je do misky s omáčkou, do níž si přidá cibulku a zázvor.'
    ]
  },
  zdroj: 'https://ja.wikipedia.org/wiki/七夕'
},
{
  id: 'jp-dojo-no-usi',
  zeme: ['JP'],
  misto: '',
  jidlo: 'Unagi – úhoř grilovaný se sladkou omáčkou (kabajaki)',
  emoji: '🍢',
  prilezitost: 'Dojó no uši no hi (letní den buvola)',
  kdy: { typ: 'tabulka', data: { '2025': '07-19', '2026': '07-26', '2027': '07-21', '2028': '07-27', '2029': '07-22', '2030': '07-29', '2031': '07-24', '2032': '07-30', '2033': '07-25', '2034': '07-20', '2035': '07-27', '2036': '07-21' } },
  kultura: 'vychodoasijske',
  proc: 'Letní dojó je 18denní období před začátkem podzimu podle slunce; den buvola (uši) v něm připadá podle 12denního cyklu, někdy dvakrát (tabulka uvádí první). V nejparnějších dnech se jí výživný úhoř, aby dodal síly; podle oblíbené historky zvyk v 18. století vymyslel učenec Hiraga Gennai, aby pomohl prodavači úhořů. Dříve se v tento den jedlo cokoli na „u“ (udon, umeboši, uri).',
  recept: {
    nazev: 'Unadžú / unadon (úhoř na rýži)',
    porce: 2,
    cas: '30 min',
    suroviny: ['1 balení mraženého grilovaného úhoře kabajaki (asijské obchody, asi 200 g) nebo 250 g uzeného úhoře', '300 g vařené japonské rýže', 'omáčka tare: 3 lžíce sójové omáčky, 3 lžíce mirinu, 1 lžíce cukru, 1 lžíce saké (nebo vody)', 'mletý pepř sanšó nebo nastrouhaná citronová kůra'],
    postup: [
      'Sójovou omáčku, mirin, cukr a saké svařte na mírném ohni do mírně hustého sirupu (asi 5 minut).',
      'Úhoře rozmrazte a položte kůží dolů na plech.',
      'Potřete omáčkou a 3–4 minuty grilujte pod rozpáleným grilem, znovu potřete a dopečte, až omáčka zkaramelizuje.',
      'Horkou rýži dejte do misek, pokapejte lžící omáčky a navrch položte úhoře nakrájeného na kusy.',
      'Posypte pepřem sanšó (nebo citronovou kůrou) a podávejte.'
    ]
  },
  zdroj: 'https://ja.wikipedia.org/wiki/土用の丑の日'
},
{
  id: 'jp-cukimi',
  zeme: ['JP'],
  misto: '',
  jidlo: 'Cukimi dango (15 rýžových knedlíčků) a taro',
  emoji: '🎑',
  prilezitost: 'Džúgoja / Cukimi (pozorování měsíce)',
  kdy: { typ: 'cinsky', m: 8, d: 15 },
  kultura: 'vychodoasijske',
  proc: 'Za úplňku 15. dne 8. lunárního měsíce se Japonci dívají na měsíc a na podnos staví pyramidu z patnácti bílých knedlíčků dango spolu s klasy ozdobnice (susuki). Kulaté dango připomínají měsíc a děkují za úrodu; protože se dříve obětovaly hlízy taro, říká se tomuto úplňku také „imo meigecu“ – bramborový měsíc.',
  recept: {
    nazev: 'Cukimi dango',
    porce: 15,
    cas: '30 min',
    suroviny: ['150 g lepkavé rýžové mouky (širatamako / glutinous rice flour)', '15 g cukru', 'asi 130 ml vody', 'k podávání: sójová omáčka s cukrem nebo sladká fazolová pasta'],
    postup: [
      'Mouku s cukrem smíchejte a po lžících přidávejte vodu, až vznikne těsto měkké jako ušní lalůček.',
      'Vyválejte 15 stejných kuliček.',
      'Vařte je ve vroucí vodě; až vyplavou, vařte ještě 2 minuty.',
      'Vyndejte do studené vody, osušte.',
      'Naskládejte do pyramidy 9 + 4 + 1 + 1 a podávejte s fazolovou pastou nebo slanosladkou sójovou omáčkou.'
    ]
  },
  zdroj: 'https://ja.wikipedia.org/wiki/月見'
},
{
  id: 'jp-sici-go-san',
  zeme: ['JP'],
  misto: '',
  jidlo: 'Čitose ame – dlouhé červenobílé bonbony „tisíciletí“',
  emoji: '🍬',
  prilezitost: 'Šiči-go-san (Sedm-pět-tři)',
  kdy: { typ: 'pevne', m: 11, d: 15 },
  kultura: 'vychodoasijske',
  proc: 'Tříleté a sedmileté dívky a pětiletí (místy i tříletí) chlapci jdou v kimonu do svatyně poděkovat za zdraví. Dostávají tenké dlouhé tyčinky čitose ame („bonbon tisíce let“) v sáčku s jeřábem a želvou – délka i natahovaný cukr znamenají dlouhý život. Zvyk vznikl v době Edo v Asakuse.',
  recept: {
    nazev: 'Natahovaný mléčný bonbon (domácí čitose ame)',
    porce: 10,
    cas: '45 min',
    suroviny: ['200 g cukru', '100 g glukózového sirupu (cukrárenské potřeby)', '60 ml vody', '1 lžíce másla', 'kapka červeného potravinářského barviva', 'trochu oleje na ruce a podložku'],
    postup: [
      'Cukr, glukózový sirup a vodu vařte bez míchání na 135 °C (měřte teploměrem).',
      'Stáhněte z ohně, vmíchejte máslo a hmotu vylijte na naolejovanou silikonovou podložku.',
      'Rozdělte na dvě části, do jedné vpravte barvivo.',
      'Jakmile lze hmotu vzít do rukou (pozor, je horká – použijte rukavice), opakovaně ji natahujte a překládejte, až zbělá a zmatní.',
      'Červený a bílý pramen stočte k sobě, vytáhněte do tenkého provazce a nůžkami nastříhejte na dlouhé tyčinky.'
    ]
  },
  zdroj: 'https://ja.wikipedia.org/wiki/千歳飴'
},
{
  id: 'jp-todzi',
  zeme: ['JP'],
  misto: '',
  jidlo: 'Kabočja (dýně) a koupel s citrusy juzu',
  emoji: '🎃',
  prilezitost: 'Tódži (zimní slunovrat)',
  kdy: { typ: 'pevne', m: 12, d: 22 },
  kultura: 'vychodoasijske',
  proc: 'O slunovratu se v Japonsku jí dýně kabočja, která vydrží od léta do zimy a dodá vitaminy v nejtemnějším období; přidávají se i jídla s „n“ v názvu (ninžin, renkon…), protože „n“ zní jako „un“ – štěstí. Večer se koupe s plody juzu proti nachlazení. Datum je slunovrat podle japonského času, podle roku 21. nebo 22. 12.',
  recept: {
    nazev: 'Itokoni – dýně dušená s azuki',
    porce: 4,
    cas: '40 min',
    suroviny: ['500 g dýně Hokkaidó', '150 g vařených slazených azuki (nebo konzervované azuki)', '300 ml dashi nebo vody', '1 lžíce sójové omáčky', '1 lžíce cukru', 'špetka soli'],
    postup: [
      'Dýni zbavte semínek a nakrájejte na kostky 4 cm; slupku nechte.',
      'Kostky dejte do kastrolu kůží dolů a zalijte dashi.',
      'Přidejte cukr a sójovou omáčku, přikryjte a duste 12–15 minut doměkka.',
      'Přidejte azuki a sůl, opatrně promíchejte a prohřejte ještě 5 minut.',
      'Nechte chvíli odpočinout, ať chutě zapustí, a podávejte teplé.'
    ]
  },
  zdroj: 'https://ja.wikipedia.org/wiki/冬至'
},
{
  id: 'jp-kfc-vanoce',
  zeme: ['JP'],
  misto: '',
  jidlo: 'Smažené kuře z KFC a jahodový dort (kurisumasu kéki)',
  emoji: '🍗',
  prilezitost: 'Vánoce',
  kdy: { typ: 'pevne', m: 12, d: 24, delka: 2 },
  kultura: 'novodobe',
  proc: 'Vánoce nejsou v Japonsku náboženský svátek, ale romantický a rodinný večer. Od reklamní kampaně „Kurisumasu ni wa Kentakkí!“ (1974) si miliony rodin objednávají vánoční kyblík kuřete z KFC týdny dopředu. K tomu patří bílý piškotový dort se šlehačkou a jahodami – barvy připomínají sníh a vánoční červenou.',
  recept: {
    nazev: 'Japonský jahodový dort (ičigo šótokéki)',
    porce: 8,
    cas: '1 h 30 min + chlazení',
    suroviny: ['4 vejce', '120 g cukru', '120 g hladké mouky', '30 g másla', '2 lžíce mléka', '400 ml smetany ke šlehání (33 %)', '40 g moučkového cukru', '400 g jahod', 'sirup: 50 ml vody + 2 lžíce cukru'],
    postup: [
      'Troubu předehřejte na 170 °C, dno dortové formy (18 cm) vyložte papírem.',
      'Vejce s cukrem šlehejte nad vodní lázní do vlažna a pak mimo ni 8–10 minut do husté světlé pěny.',
      'Opatrně vmíchejte prosátou mouku, nakonec rozpuštěné máslo s mlékem; pečte asi 30 minut.',
      'Vychladlý piškot rozřízněte na dva pláty a pokapejte sirupem.',
      'Smetanu vyšlehejte s moučkovým cukrem do tuha.',
      'Na spodní plát dejte šlehačku a nakrájené jahody, přikryjte druhým plátem, celý dort potřete šlehačkou a ozdobte celými jahodami.'
    ]
  },
  zdroj: 'https://ja.wikipedia.org/wiki/クリスマス#日本のクリスマス'
},
{
  id: 'jp-tosikosi-soba',
  zeme: ['JP'],
  misto: '',
  jidlo: 'Tošikoši soba – pohankové nudle „přes rok“',
  emoji: '🍜',
  prilezitost: 'Ómisoka (Silvestr)',
  kdy: { typ: 'pevne', m: 12, d: 31 },
  kultura: 'vychodoasijske',
  proc: 'Na poslední večer roku se jí pohankové nudle soba. Dlouhé a tenké přejí dlouhý život, a protože se snadno trhají, „přetrhnou“ starosti a neštěstí starého roku. Mají se dojíst před půlnocí, kdy chrámové zvony odbíjejí 108 úderů.',
  recept: {
    nazev: 'Kake soba',
    porce: 4,
    cas: '30 min',
    suroviny: ['400 g sušených soba nudlí', '1,2 l dashi', '80 ml sójové omáčky', '80 ml mirinu', '2 jarní cibulky', '4 tempura krevety nebo 4 plátky kamaboko (nepovinně)', 'směs sedmi koření šičimi (nebo chilli vločky)'],
    postup: [
      'Dashi přiveďte k varu, přidejte sójovou omáčku a mirin a udržujte horké.',
      'Nudle vařte podle návodu (asi 5 minut), sceďte a propláchněte studenou vodou, aby se smyl škrob.',
      'Nudle krátce prohřejte ve vroucí vodě a rozdělte do misek.',
      'Zalijte horkým vývarem, přidejte krevety nebo kamaboko a nakrájenou cibulku.',
      'Posypte kořením šičimi a snězte do půlnoci.'
    ]
  },
  zdroj: 'https://ja.wikipedia.org/wiki/年越しそば'
},

/* ===================== ČÍNA a čínská diaspora ===================== */
{
  id: 'cn-novy-rok',
  zeme: ['CN', 'TW', 'HK', 'MO', 'SG', 'MY'],
  misto: '',
  jidlo: 'Ťiao-c’ (jiaozi), celá ryba a nien-kao (niangao)',
  emoji: '🥟',
  prilezitost: 'Čínský Nový rok (Svátek jara, Čchun-ťie)',
  kdy: { typ: 'cinsky', m: 1, d: 1 },
  kultura: 'vychodoasijske',
  proc: 'Na předvečer se schází celá rodina k večeři „nového setkání“. Na severu se o půlnoci jedí knedlíčky ťiao-c’ tvarované jako stříbrné pruty jüan-pao – peníze do nového roku; do jednoho se někdy schová mince. Ryba (jü) zní jako „přebytek“ a nedojídá se, aby „každý rok zbylo“; lepkavý koláč nien-kao zní jako „každý rok výš“.',
  recept: {
    nazev: 'Ťiao-c’ s vepřovým a zelím',
    porce: 4,
    cas: '1 h 30 min',
    suroviny: ['těsto: 300 g hladké mouky, 160 ml vody', '300 g mletého vepřového', '300 g čínského (pekingského) zelí', '1 lžička soli + sůl na zelí', '2 jarní cibulky', '1 lžíce nastrouhaného zázvoru', '2 lžíce sójové omáčky', '1 lžíce rýžového vína nebo suchého sherry', '1 lžíce sezamového oleje', 'k namáčení: černý (nebo jablečný) ocet, sójová omáčka, česnek'],
    postup: [
      'Mouku zadělejte s vodou na hladké tuhé těsto a nechte 30 minut odpočinout pod mísou.',
      'Zelí nasekejte nadrobno, osolte, po 10 minutách vymačkejte vodu.',
      'Maso promíchejte se sójovou omáčkou, vínem, zázvorem, solí a postupně vmíchejte 3 lžíce vody; přidejte zelí, cibulku a sezamový olej.',
      'Těsto rozválejte do válečku, nakrájejte na 40 kousků a každý vyválejte na tenké kolečko 8 cm.',
      'Doprostřed dejte lžičku náplně, přeložte a okraj přitiskněte do záhybů ve tvaru půlměsíce.',
      'Vařte ve vroucí vodě; až vyplavou, přilijte hrnek studené vody, znovu povařte a opakujte ještě jednou. Podávejte s octovou omáčkou.'
    ]
  },
  zdroj: 'https://zh.wikipedia.org/wiki/春节'
},
{
  id: 'cn-svatek-luceren',
  zeme: ['CN', 'TW', 'HK', 'MO', 'SG', 'MY'],
  misto: '',
  jidlo: 'Tang-jüan / jüan-siao – sladké rýžové kuličky',
  emoji: '🏮',
  prilezitost: 'Svátek luceren (Jüan-siao)',
  kdy: { typ: 'cinsky', m: 1, d: 15 },
  kultura: 'vychodoasijske',
  proc: 'První úplněk roku uzavírá novoroční svátky – věší se lucerny a luští hádanky. Kulaté kuličky z lepkavé rýže v horkém sirupu znamenají úplnost rodiny a jednotu („tchuan-jüan“ = shledání). Na severu se náplň válí v rýžové mouce (jüan-siao), na jihu se kuličky ručně balí (tang-jüan).',
  recept: {
    nazev: 'Tang-jüan s černým sezamem',
    porce: 4,
    cas: '45 min',
    suroviny: ['200 g lepkavé rýžové mouky', 'asi 180 ml vlažné vody', 'náplň: 80 g černého sezamu, 50 g cukru, 50 g měkkého másla', 'sirup: 1 l vody, 3 plátky zázvoru, 2 lžíce hnědého cukru'],
    postup: [
      'Sezam opražte nasucho a rozemelte v mlýnku; smíchejte s cukrem a máslem, vytvarujte 20 kuliček a zchlaďte je v mrazáku.',
      'Mouku zadělejte s vodou na hladké, nelepivé těsto.',
      'Těsto rozdělte na 20 dílů, rozplácněte, zabalte do každého kuličku náplně a uhlaďte v dlaních.',
      'Vodu se zázvorem a hnědým cukrem přiveďte k varu.',
      'Kuličky vařte, dokud nevyplavou, a pak ještě 2–3 minuty. Podávejte i se sirupem.'
    ]
  },
  zdroj: 'https://zh.wikipedia.org/wiki/汤圆'
},
{
  id: 'cn-cching-ming',
  zeme: ['CN'],
  misto: 'Ťiang-nan (Šanghaj, Če-ťiang, Ťiang-su)',
  jidlo: 'Čching-tchuan (qingtuan) – zelené rýžové knedlíčky',
  emoji: '🟢',
  prilezitost: 'Čching-ming (svátek jasu a čistoty)',
  kdy: { typ: 'pevne', m: 4, d: 5 },
  kultura: 'vychodoasijske',
  proc: 'O Čching-mingu se uklízejí hroby předků a vyráží do přírody. Na jihovýchodě Číny se jedí zelené knedlíčky z lepkavé rýže obarvené šťávou z mladého pelyňku nebo trávy mai-cchao, plněné sladkou fazolovou pastou – chutnají jarem a navazují na starý svátek „studeného jídla“ (Chan-š’). Datum se řídí sluncem: 4. nebo 5. dubna.',
  recept: {
    nazev: 'Čching-tchuan',
    porce: 12,
    cas: '1 h',
    suroviny: ['100 g mladého listového špenátu (místo pelyňku)', '200 g lepkavé rýžové mouky', '50 g hladké rýžové mouky', '20 g cukru', '1 lžíce oleje', '240 g sladké pasty z červených fazolí (anko)'],
    postup: [
      'Špenát rozmixujte se 150 ml vody a šťávu přeceďte.',
      'Obě mouky a cukr smíchejte, přidejte olej a postupně horkou zelenou šťávu, až vznikne hladké měkké těsto.',
      'Rozdělte na 12 dílů, každý rozplácněte, naplňte lžící pasty a uzavřete do kuličky.',
      'Kuličky položte na papír do pařáku a napařujte 12–15 minut.',
      'Ještě teplé potřete tence olejem, aby se leskly a nelepily.'
    ]
  },
  zdroj: 'https://zh.wikipedia.org/wiki/青团'
},
{
  id: 'cn-tuan-wu',
  zeme: ['CN', 'TW', 'HK', 'MO', 'SG', 'MY'],
  misto: '',
  jidlo: 'Cung-c’ (zongzi) – lepkavá rýže v bambusových listech',
  emoji: '🐉',
  prilezitost: 'Svátek dračích lodí (Tuan-wu)',
  kdy: { typ: 'cinsky', m: 5, d: 5 },
  kultura: 'vychodoasijske',
  proc: 'Podle legendy se básník Čchü Jüan (3. stol. př. n. l.) utopil v řece Mi-luo na protest proti zkáze svého státu; lidé veslovali na lodích, aby ho hledali, a házeli do vody rýži, aby ryby nežraly jeho tělo. Proto se závodí s dračími loďmi a jedí se pyramidky z rýže zabalené v listech – na severu sladké s datlemi, na jihu slané s vepřovým a vaječným žloutkem.',
  recept: {
    nazev: 'Slané cung-c’ s vepřovým',
    porce: 10,
    cas: '4 h (+ namáčení přes noc)',
    suroviny: ['500 g lepkavé rýže', '20 sušených bambusových listů (asijské obchody)', '400 g vepřového bůčku', '3 lžíce sójové omáčky', '1 lžíce rýžového vína', '1 lžička cukru', '1/2 lžičky prášku pěti koření', '10 kaštanů nebo hrst arašídů', 'provázek'],
    postup: [
      'Rýži přes noc namočte; bůček nakrájejte na 10 kusů a naložte do sójové omáčky, vína, cukru a koření.',
      'Bambusové listy namočte a 5 minut povařte, aby změkly.',
      'Rýži sceďte, osolte a promíchejte s 2 lžícemi sójové omáčky.',
      'Dva listy přeložené přes sebe stočte do kornoutu, dejte lžíci rýže, kousek masa a kaštan, překryjte rýží.',
      'Přehněte list přes otvor, vytvarujte čtyřstěn a pevně převažte provázkem.',
      'Vařte zcela ponořené ve vodě 3 hodiny, podle potřeby dolévejte vroucí vodu.'
    ]
  },
  zdroj: 'https://zh.wikipedia.org/wiki/粽子'
},
{
  id: 'cn-stred-podzimu',
  zeme: ['CN', 'HK', 'MO', 'SG', 'MY'],
  misto: '',
  jidlo: 'Jüe-ping – měsíční koláčky',
  emoji: '🥮',
  prilezitost: 'Svátek středu podzimu (Čung-čchiou)',
  kdy: { typ: 'cinsky', m: 8, d: 15 },
  kultura: 'vychodoasijske',
  proc: 'Za nejjasnějšího úplňku roku se rodina sejde, dívá se na měsíc a krájí kulaté koláčky – kruh znamená celistvost a shledání (tchuan-jüan). Kantonské koláčky mají náplň z lotosové pasty, často se slaným kachním žloutkem jako měsícem. Pojí se s nimi legenda o bohyni Čchang-e, která odletěla na Měsíc.',
  recept: {
    nazev: 'Sněhové měsíční koláčky (ping-pchi jüe-ping)',
    porce: 8,
    cas: '1 h + chlazení',
    suroviny: ['těsto: 50 g lepkavé rýžové mouky, 40 g hladké rýžové mouky, 20 g kukuřičného škrobu, 50 g moučkového cukru, 200 ml mléka, 20 g oleje', '2 lžíce lepkavé rýžové mouky na podsypání (opražené)', 'náplň: 320 g sladké pasty z červených fazolí nebo lotosové pasty', 'formička na měsíční koláčky 50 g (nebo malá formička na bábovičky)'],
    postup: [
      'Mouky, škrob, cukr, mléko a olej rozmíchejte na hladké těsto.',
      'Napařujte v misce 20–25 minut, až těsto zprůsvitní; propracujte vařečkou a nechte vychladnout.',
      'Mouku na podsypání opražte nasucho do slonovinové barvy.',
      'Náplň rozdělte na 8 kuliček po 40 g, těsto na 8 dílů po 25 g.',
      'Těsto rozplácněte, zabalte do něj náplň, obalte v opražené mouce a vytlačte ve formě.',
      'Koláčky aspoň 2 hodiny chlaďte – jedí se studené.'
    ]
  },
  zdroj: 'https://zh.wikipedia.org/wiki/月饼'
},
{
  id: 'cn-cchung-jang',
  zeme: ['CN', 'TW', 'HK'],
  misto: '',
  jidlo: 'Čchung-jang kao (vrstvený koláč) a chryzantémové víno',
  emoji: '🌼',
  prilezitost: 'Svátek dvojí devítky (Čchung-jang)',
  kdy: { typ: 'cinsky', m: 9, d: 9 },
  kultura: 'vychodoasijske',
  proc: 'Devátý den devátého měsíce je dvojnásobně „jangový“ den; tradičně se vystupuje na kopce, nosí se větvičky kdoulovce a pije chryzantémové víno pro dlouhý život. Koláč „kao“ zní stejně jako „vysoký“ – kdo nemohl na horu, snědl koláč a „vystoupil výš“. Dnes je to také Den seniorů.',
  recept: {
    nazev: 'Čchung-jang kao',
    porce: 8,
    cas: '1 h',
    suroviny: ['200 g lepkavé rýžové mouky', '100 g hladké rýžové mouky', '80 g hnědého cukru', 'asi 220 ml vody', '8 sušených datlí jujuba nebo běžných datlí', '2 lžíce rozinek', '1 lžíce sezamu', 'olej na formu'],
    postup: [
      'Mouky smíchejte, cukr rozpusťte ve vodě a postupně vmíchejte do mouky na hustou drobivou směs.',
      'Formu 18 cm vymažte olejem a nasypte do ní polovinu směsi (nemačkejte).',
      'Poklaďte polovinou nakrájených datlí a rozinek, pak nasypte zbytek směsi.',
      'Napařujte 30–35 minut.',
      'Navrch rozložte zbylé ovoce a sezam, nechte zchladnout a nakrájejte na kosočtverce.'
    ]
  },
  zdroj: 'https://zh.wikipedia.org/wiki/重阳节'
},
{
  id: 'cn-la-pa',
  zeme: ['CN'],
  misto: '',
  jidlo: 'La-pa čou (laba zhou) – kaše z osmi druhů zrn a plodů',
  emoji: '🥣',
  prilezitost: 'Svátek La-pa (8. den 12. měsíce)',
  kdy: { typ: 'cinsky', m: 12, d: 8 },
  kultura: 'vychodoasijske',
  proc: 'Podle buddhistické tradice v tento den dosáhl Buddha osvícení poté, co ho pasačka posilnila mléčnou rýžovou kaší. Kláštery od pradávna rozdávají kaši ze směsi obilí, luštěnin, ořechů a sušeného ovoce; v domácnostech se vaří pro požehnání a hojnost. Svátkem La-pa podle přísloví „začíná Nový rok“.',
  recept: {
    nazev: 'La-pa čou',
    porce: 6,
    cas: '2 h (+ namáčení přes noc)',
    suroviny: ['50 g lepkavé rýže', '50 g kulatozrnné rýže', '40 g jáhel', '40 g fazolí azuki', '40 g zelených fazolí mungo', '40 g arašídů', '8 datlí (ideálně jujuba)', '30 g rozinek nebo sušených plodů kustovnice (goji)', '2 l vody', '60–80 g hnědého cukru'],
    postup: [
      'Azuki, mungo a arašídy namočte přes noc.',
      'Luštěniny s arašídy zalijte vodou a vařte 40 minut.',
      'Přidejte propláchnuté obě rýže a jáhly a vařte na mírném ohni dalších 50 minut, často míchejte.',
      'Přidejte datle a rozinky (goji) a vařte 10 minut.',
      'Osladíte hnědým cukrem podle chuti a podávejte horké.'
    ]
  },
  zdroj: 'https://zh.wikipedia.org/wiki/腊八粥'
},
{
  id: 'cn-tung-c',
  zeme: ['CN', 'TW', 'HK', 'MO', 'SG', 'MY'],
  misto: '',
  jidlo: 'Ťiao-c’ (sever) a tang-jüan (jih)',
  emoji: '🥟',
  prilezitost: 'Tung-č’ (zimní slunovrat)',
  kdy: { typ: 'slunecni', clen: 'Winter Solstice' },
  kultura: 'vychodoasijske',
  proc: 'Slunovrat byl v Číně odedávna velkým svátkem („Tung-č’ je větší než Nový rok“, říká se na jihu). Na severu se jedí knedlíčky ťiao-c’: podle legendy lékař Čang Čung-ťing rozdával chudým v zimě vývar s knedlíčky tvaru uší, aby jim neomrzly uši. Na jihu se jedí sladké kuličky tang-jüan, po nichž je člověk „o rok starší“. Datum se řídí slunovratem, podle roku 21. nebo 22. 12.',
  recept: {
    nazev: 'Ťiao-c’ s jehněčím a mrkví',
    porce: 4,
    cas: '1 h 30 min',
    suroviny: ['těsto: 300 g hladké mouky, 160 ml vody', '350 g mletého jehněčího', '2 mrkve', '1 lžíce nastrouhaného zázvoru', '2 jarní cibulky', '2 lžíce sójové omáčky', '1/2 lžičky mletého sečuánského pepře nebo černého pepře', '1 lžička soli', '1 lžíce sezamového oleje'],
    postup: [
      'Zadělejte těsto z mouky a vody a nechte 30 minut odpočinout.',
      'Mrkev najemno nastrouhejte, cibulku nasekejte.',
      'Maso promíchejte se sójovou omáčkou, zázvorem, pepřem a solí, vmíchejte 3 lžíce vody, mrkev, cibulku a sezamový olej.',
      'Z těsta vyválejte tenká kolečka 8 cm, naplňte lžičkou náplně a sepněte do půlměsíců.',
      'Vařte ve vroucí vodě, dokud nevyplavou, a ještě 3 minuty. Podávejte s octem a česnekem.'
    ]
  },
  zdroj: 'https://zh.wikipedia.org/wiki/冬至'
},

/* ===================== TCHAJ-WAN ===================== */
{
  id: 'tw-wej-ja',
  zeme: ['TW'],
  misto: '',
  jidlo: 'Kua-pao (gua bao, „tygr kousá prase“) a žun-ping',
  emoji: '🥙',
  prilezitost: 'Wej-ja (poslední firemní hostina roku)',
  kdy: { typ: 'cinsky', m: 12, d: 16 },
  kultura: 'vychodoasijske',
  proc: 'Obchodníci na Tchaj-wanu a ve Fu-ťienu uctívají boha země Tchu-ti-kunga každý 2. a 16. den měsíce; poslední obětina roku (16. den 12. měsíce) je „wej-ja“ a firmy na ni zvou zaměstnance na hostinu. Jí se kua-pao – nadýchaná bulka s dušeným bůčkem, která vypadá jako tygr s prasetem v tlamě, nebo jako peněženka plná peněz. Dnes se firemní večírky konají kdykoli před Novým rokem.',
  recept: {
    nazev: 'Kua-pao s dušeným bůčkem',
    porce: 8,
    cas: '3 h',
    suroviny: ['bulky: 300 g hladké mouky, 1 lžička sušeného droždí, 1 lžíce cukru, 160 ml vlažného mléka, 1 lžíce oleje', '600 g vepřového bůčku bez kosti', '4 lžíce sójové omáčky', '2 lžíce rýžového vína', '1 lžíce hnědého cukru', '2 badyány, 3 plátky zázvoru', '150 g kysaného zelí nebo nakládané hořčičné zeleniny', '3 lžíce drcených pražených arašídů smíchaných s 1 lžící cukru', 'čerstvý koriandr'],
    postup: [
      'Bůček nakrájejte na plátky 1 cm, opečte, přidejte sójovou omáčku, víno, cukr, badyán, zázvor a vodu, aby byl ponořený, a duste 1,5 hodiny doměkka.',
      'Z mouky, droždí, cukru, mléka a oleje vypracujte hladké těsto a nechte hodinu kynout.',
      'Těsto rozdělte na 8 dílů, každý vyválejte do oválu, potřete olejem a přeložte napůl přes kousek pečicího papíru.',
      'Nechte 20 minut dokynout a napařujte 12 minut.',
      'Kysané zelí krátce osmahněte.',
      'Do rozevřené bulky vložte plátek masa, zelí, posypte sladkými arašídy a koriandrem.'
    ]
  },
  zdroj: 'https://zh.wikipedia.org/wiki/尾牙'
},
{
  id: 'tw-stred-podzimu-gril',
  zeme: ['TW'],
  misto: '',
  jidlo: 'Grilování venku, měsíční koláčky a pomelo',
  emoji: '🍖',
  prilezitost: 'Svátek středu podzimu (Čung-čchiou)',
  kdy: { typ: 'cinsky', m: 8, d: 15 },
  kultura: 'novodobe',
  proc: 'Na Tchaj-wanu se o svátku středu podzimu griluje – na chodnících, balkonech i u řek. Zvyk zesílil v 80. letech, kdy výrobci sójové omáčky Wan Ja Shan a Kimlan soupeřili v televizních reklamách na grilovací omáčku („Jedna rodina griluje, deset tisíc rodin voní“). Ke grilu patří měsíční koláčky a pomelo, jehož slupku si děti nasazují jako klobouček.',
  recept: {
    nazev: 'Tchajwanské grilované kuře a vepřové s grilovací omáčkou',
    porce: 4,
    cas: '1 h (+ 2 h marinování)',
    suroviny: ['500 g kuřecích stehenních řízků', '400 g vepřové krkovice na plátky', 'omáčka: 4 lžíce sójové omáčky, 2 lžíce ústřicové omáčky, 2 lžíce medu, 1 lžíce rýžového vína, 3 stroužky česneku, 1/2 lžičky prášku pěti koření', '4 klasy kukuřice', '8 shiitake nebo žampionů', 'toastový chléb a jarní cibulka (na „sendvič z grilu“)'],
    postup: [
      'Ingredience omáčky smíchejte s prolisovaným česnekem.',
      'Polovinou omáčky potřete maso a nechte 2 hodiny marinovat.',
      'Maso grilujte nad žhavým uhlím a během grilování ho opakovaně potírejte zbylou omáčkou.',
      'Grilujte i kukuřici a houby, také potřené omáčkou.',
      'Plátek masa s cibulkou zabalte do opečeného toastu – tak se jí na tchajwanských chodnících.'
    ]
  },
  zdroj: 'https://www.taipeitimes.com/News/lang/archives/2018/09/25/2003701075'
},

/* ===================== SINGAPUR, MALAJSIE, INDONÉSIE ===================== */
{
  id: 'sg-ju-seng',
  zeme: ['SG', 'MY'],
  misto: '',
  jidlo: 'Ju-šeng (yusheng, lo hei) – salát se syrovou rybou, který se „vyhazuje“',
  emoji: '🥗',
  prilezitost: 'Žen-ž’ – „den lidí“, 7. den čínského Nového roku',
  kdy: { typ: 'cinsky', m: 1, d: 7 },
  kultura: 'vychodoasijske',
  proc: 'Rybáři v kantonské oblasti jedli syrovou rybu na Žen-ž’, „narozeniny všech lidí“. Dnešní barevnou verzi s mrkví, ředkví a křupkami dali dohromady čtyři singapurští kuchaři v roce 1964. Všichni u stolu salát hůlkami vyhazují co nejvýš a volají „lo hei!“ s přáním hojnosti – čím výš, tím víc štěstí; ryba (jü) zní jako „přebytek“. Salát se servíruje během celých novoročních svátků, tradičně hlavně 7. den.',
  recept: {
    nazev: 'Ju-šeng',
    porce: 6,
    cas: '45 min',
    suroviny: ['200 g čerstvého lososa v kvalitě na suši', '2 mrkve', '1 bílá ředkev (asi 300 g)', '1 okurka', '1 pomelo nebo 2 grapefruity', '2 lžíce nakládaného zázvoru', '3 lžíce drcených pražených arašídů', '1 lžíce sezamu', 'hrst smažených křupek (krevetové chipsy nebo wonton plátky)', 'omáčka: 4 lžíce švestkové omáčky, 1 lžíce medu, 1 lžíce limetkové šťávy, 1 lžíce sezamového oleje', 'prášek pěti koření a mletý pepř'],
    postup: [
      'Mrkev, ředkev a okurku nakrájejte na velmi tenké nudličky, ředkev a okurku lehce vymačkejte.',
      'Pomelo oloupejte a dužinu rozeberte na drobné kousky; lososa nakrájejte na tenké plátky.',
      'Na velký talíř naskládejte zeleninu do barevných kupek, doprostřed dejte lososa.',
      'U stolu postupně (s přáním ke každé přísadě) přidejte limetku, pepř a koření, olej, omáčku, arašídy se sezamem a křupky.',
      'Všichni najednou salát hůlkami vyhazujte vysoko a volejte „lo hei!“, pak jezte.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Yusheng'
},
{
  id: 'id-cap-go-meh',
  zeme: ['ID'],
  misto: 'Jáva (čínští Peranakani)',
  jidlo: 'Lontong Cap Go Meh – rýžové válečky s opor ayam a přílohami',
  emoji: '🍛',
  prilezitost: 'Cap Go Meh (15. den čínského Nového roku)',
  kdy: { typ: 'cinsky', m: 1, d: 15 },
  kultura: 'vychodoasijske',
  proc: 'Javánští Peranakani – potomci čínských přistěhovalců a místních žen – nahradili na Svátek luceren čínské rýžové kuličky javánským lontongem a podávají ho s kuřetem v kokosovém mléce, kořeněnými játry, vejci a zeleninou. Jídlo je symbolem splynutí dvou kultur; podlouhlý lontong má znamenat dlouhý život. Na Sumatře či Borneu tento zvyk neznají.',
  recept: {
    nazev: 'Opor ayam s lontongem',
    porce: 4,
    cas: '1 h 30 min',
    suroviny: ['2 sáčky rýže ve varných sáčcích (náhrada lontongu)', '1 kg kuřecích stehen', '400 ml kokosového mléka', '300 ml vody', 'pasta: 6 šalotek, 4 stroužky česneku, 4 para ořechy nebo kešu (místo kemiri), 1 lžička koriandru, 1 lžička kurkumy, 2 cm zázvoru', '2 stébla citronové trávy', '3 kaffir listy (nebo kůra z limetky)', '2 bobkové listy', '1 lžička cukru, sůl', '4 vejce natvrdo', 'smažená šalotka na posypání'],
    postup: [
      'Rýži ve varných sáčcích vařte 1 hodinu ve velkém množství vody, aby se zrna slisovala do pevného válce; vychladlé nakrájejte na plátky – to je domácí lontong.',
      'Ingredience pasty rozmixujte a orestujte na oleji do vůně.',
      'Přidejte naklepnutou citronovou trávu, kaffir a bobkové listy a kuře a obalte ho v pastě.',
      'Zalijte vodou a kokosovým mlékem, osolte, přidejte cukr a duste 40 minut doměkka.',
      'Posledních 10 minut přidejte oloupaná vejce.',
      'Podávejte plátky lontongu přelité oporem, posypané smaženou šalotkou.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Lontong_cap_go_meh'
},
{
  id: 'id-den-nezavislosti',
  zeme: ['ID'],
  misto: '',
  jidlo: 'Krupuk (kerupuk) – soutěž v jedení krupuků na provázku',
  emoji: '🍘',
  prilezitost: 'Den nezávislosti (Tujuh Belas Agustus)',
  kdy: { typ: 'pevne', m: 8, d: 17 },
  kultura: 'statni',
  proc: 'Na výročí vyhlášení nezávislosti (1945) se v každé vesnici a ulici pořádají soutěže „lomba“ – nejoblíbenější je jedení krupuků zavěšených na provázku s rukama za zády. Zvyk se traduje od 50. let a připomíná těžké časy koloniální a válečné, kdy byl krupuk často jedinou přílohou k rýži.',
  recept: {
    nazev: 'Domácí krevetové krupuky',
    porce: 6,
    cas: '20 min',
    suroviny: ['200 g sušených syrových krevetových krupuků (krupuk udang, asijské obchody)', '1 l oleje na smažení'],
    postup: [
      'Olej rozehřejte v hlubokém hrnci nebo pánvi wok na 180 °C.',
      'Smažte po několika plátcích; během pár sekund nafouknou na trojnásobek.',
      'Jakmile přestanou růst (ještě než zhnědnou), vyndejte je sítkem.',
      'Nechte okapat na papírové utěrce.',
      'Na soutěž je provlékněte provázkem a zavěste do výšky úst; jinak podávejte k rýži a nasi goreng.'
    ]
  },
  zdroj: 'https://id.wikipedia.org/wiki/Lomba_makan_kerupuk'
},

/* ===================== VIETNAM ===================== */
{
  id: 'vn-tet',
  zeme: ['VN'],
  misto: '',
  jidlo: 'Bánh chưng (sever) a bánh tét (jih) – rýžové koláče v listech',
  emoji: '🟩',
  prilezitost: 'Tết Nguyên Đán (vietnamský Nový rok)',
  kdy: { typ: 'cinsky', m: 1, d: 1, delka: 3 },
  kultura: 'vychodoasijske',
  proc: 'Podle legendy princ Lang Liêu obětoval králi Hùngovi čtvercový koláč z lepkavé rýže, fazolí mungo a vepřového jako symbol země (a kulatý bánh dày jako nebe) a stal se dědicem trůnu. Bánh chưng se vaří celou noc ve velkém hrnci, rodina u ohně bdí a vzpomíná na předky. Na jihu se balí do válce jako bánh tét.',
  recept: {
    nazev: 'Bánh chưng',
    porce: 8,
    cas: '8 h (+ namáčení přes noc)',
    suroviny: ['800 g lepkavé rýže', '300 g loupaných žlutých fazolí mungo', '400 g vepřového bůčku', '1 lžička mletého pepře', '2 šalotky', 'sůl, 1 lžíce rybí omáčky', 'banánové listy (asijské obchody; nebo pečicí papír a alobal)', 'provázek, čtvercová forma 15 cm'],
    postup: [
      'Rýži a mungo zvlášť namočte přes noc; rýži osolte, mungo uvařte doměkka a rozmačkejte se šalotkou a pepřem.',
      'Bůček nakrájejte na plátky a naložte do soli, pepře a rybí omáčky.',
      'Listy omyjte, krátce spařte a vyložte jimi formu křížem přes sebe.',
      'Vrstvěte: rýže, mungo, maso, mungo, rýže; listy přeložte jako balíček a pevně převažte.',
      'Vařte zcela ponořené ve vodě 6–8 hodin, dolévejte vroucí vodu.',
      'Vychladlé vylisujte pod závažím a krájejte na čtverce provázkem.'
    ]
  },
  zdroj: 'https://vi.wikipedia.org/wiki/Bánh_chưng'
},
{
  id: 'vn-han-thuc',
  zeme: ['VN'],
  misto: '',
  jidlo: 'Bánh trôi a bánh chay – plovoucí rýžové kuličky',
  emoji: '⚪',
  prilezitost: 'Tết Hàn thực („svátek studeného jídla“)',
  kdy: { typ: 'cinsky', m: 3, d: 3 },
  kultura: 'vychodoasijske',
  proc: 'Svátek převzatý z Číny připomíná věrného Ťie C’-tchuia; ve Vietnamu se ale nevaří studené jídlo – místo toho se předkům obětují a jedí kuličky z lepkavé rýže s hnědým cukrem (bánh trôi) a kuličky s fazolemi mungo ve sladké polévce (bánh chay). Kuličky po uvaření vyplavou, odtud název „plovoucí koláčky“. Zvyk je doložený už v 18. století.',
  recept: {
    nazev: 'Bánh trôi nước',
    porce: 4,
    cas: '40 min',
    suroviny: ['200 g lepkavé rýžové mouky', 'asi 170 ml vlažné vody', '60 g hnědého třtinového cukru (nebo palmového cukru) v kostičkách', '1 lžíce praženého sezamu'],
    postup: [
      'Mouku zadělejte s vodou na hladké, nelepivé těsto.',
      'Rozdělte na 20 kousků, každý rozplácněte a zabalte do něj kostičku cukru.',
      'Kuličky uhlaďte v dlaních.',
      'Vařte ve vroucí vodě; až vyplavou, vařte ještě 2 minuty.',
      'Vyndejte do studené vody, sceďte, naskládejte na talíř a posypte sezamem.'
    ]
  },
  zdroj: 'https://vi.wikipedia.org/wiki/Tết_Hàn_thực'
},
{
  id: 'vn-doan-ngo',
  zeme: ['VN'],
  misto: '',
  jidlo: 'Cơm rượu nếp (kvašená lepkavá rýže) a letní ovoce',
  emoji: '🍒',
  prilezitost: 'Tết Đoan Ngọ („svátek hubení hmyzu“)',
  kdy: { typ: 'cinsky', m: 5, d: 5 },
  kultura: 'vychodoasijske',
  proc: 'Ve Vietnamu se pátý den pátého měsíce jmenuje „Tết diệt sâu bọ“ – den hubení červů a škůdců. Ráno se nalačno sní miska kvašené lepkavé rýže, která má „opít“ červy v těle, a pak kyselé ovoce (liči, švestky), které je „zabije“. Zvyk souvisí s obdobím nemocí na začátku léta.',
  recept: {
    nazev: 'Cơm rượu nếp',
    porce: 6,
    cas: '40 min + 2–3 dny kvašení',
    suroviny: ['500 g lepkavé rýže', '1 kulička rýžového kvasu (men rượu, vietnamské obchody)', '1 lžíce rýžové mouky'],
    postup: [
      'Rýži přes noc namočte, pak ji 30–40 minut napařujte do měkka.',
      'Rozprostřete ji na tác a nechte vychladnout na vlažnou teplotu.',
      'Kvas rozdrťte na prášek a smíchejte s rýžovou moukou.',
      'Rýži po hrstech obalujte v prášku a skládejte do čisté sklenice.',
      'Přikryjte a nechte 2–3 dny v teple (25–30 °C), až pustí sladkou šťávu a zavoní alkoholem; pak uložte do lednice.',
      'Jezte ráno 5. dne 5. lunárního měsíce, po ní kyselé ovoce.'
    ]
  },
  zdroj: 'https://vi.wikipedia.org/wiki/Tết_Đoan_ngọ'
},

/* ===================== KOREA ===================== */
{
  id: 'kr-seollal',
  zeme: ['KR'],
  misto: '',
  jidlo: 'Tteokguk – polévka s plátky rýžového koláče',
  emoji: '🍲',
  prilezitost: 'Seollal (korejský lunární Nový rok)',
  kdy: { typ: 'cinsky', m: 1, d: 1 },
  kultura: 'vychodoasijske',
  proc: 'Na Nový rok se ráno po obřadu za předky jí čirá polévka s plátky bílého rýžového koláče garaetteok. Bílá barva znamená čistý začátek, šikmo krájená kolečka připomínají staré mince – přání bohatství. Podle tradice je člověk teprve po misce tteokguku o rok starší.',
  recept: {
    nazev: 'Tteokguk',
    porce: 4,
    cas: '1 h',
    suroviny: ['500 g plátků rýžového koláče (tteok na tteokguk, asijské obchody)', '200 g hovězího plecka', '1,5 l vody', '2 stroužky česneku', '1 lžíce korejské (nebo běžné) sójové omáčky', '2 vejce', '2 jarní cibulky', 'plátek nori', 'sůl, pepř, sezamový olej'],
    postup: [
      'Tteok namočte na 20 minut do studené vody.',
      'Maso nakrájejte na tenké nudličky, orestujte na sezamovém oleji s česnekem, zalijte vodou a 30 minut vařte.',
      'Vývar dochuťte sójovou omáčkou a solí.',
      'Z vajec usmažte zvlášť žloutkovou a bílkovou tenkou omeletu a nakrájejte na proužky.',
      'Tteok sceďte, vložte do vývaru a vařte, dokud nevyplave a nezměkne (asi 5 minut).',
      'Podávejte posypané vaječnými proužky, cibulkou, nadrobeným nori a pepřem.'
    ]
  },
  zdroj: 'https://ko.wikipedia.org/wiki/떡국'
},
{
  id: 'kr-daeboreum',
  zeme: ['KR'],
  misto: '',
  jidlo: 'Ogokbap (rýže z pěti zrn), bureom (louskání ořechů) a sušená zelenina namul',
  emoji: '🌰',
  prilezitost: 'Jeongwol Daeboreum (první úplněk roku)',
  kdy: { typ: 'cinsky', m: 1, d: 15 },
  kultura: 'vychodoasijske',
  proc: 'Při prvním úplňku se jí rýže uvařená z pěti druhů obilí a luštěnin pro dobrou úrodu a k ní devět druhů sušené zeleniny schované od podzimu. Ráno se zuby louskají ořechy (bureom) – praskání má zahnat zlé duchy a chránit před vředy. Pije se i „víno na zbystření uší“ (gwibalgisul), aby člověk slyšel celý rok jen dobré zprávy.',
  recept: {
    nazev: 'Ogokbap',
    porce: 4,
    cas: '1 h 10 min (+ namáčení přes noc)',
    suroviny: ['150 g lepkavé rýže', '100 g kulatozrnné rýže', '50 g jáhel', '50 g fazolí azuki', '50 g černých fazolí nebo černé sóji', '1 lžička soli', 'asi 400 ml vody'],
    postup: [
      'Azuki a černé fazole namočte přes noc, rýže a jáhly propláchněte a namočte na hodinu.',
      'Azuki povařte 15 minut (vodu slijte jen po prvním varu), černé fazole vařte 20 minut.',
      'Všechno smíchejte v hrnci, osolte, zalijte vodou asi 1 cm nad povrch.',
      'Přiveďte k varu, stáhněte na minimum a pod pokličkou vařte 25 minut, pak 10 minut nechte dojít.',
      'Podávejte s osmaženou sušenou zeleninou namul a misku ořechů (vlašské, arašídy) na louskání.'
    ]
  },
  zdroj: 'https://ko.wikipedia.org/wiki/정월_대보름'
},
{
  id: 'kr-black-day',
  zeme: ['KR'],
  misto: '',
  jidlo: 'Jjajangmyeon – nudle s černou omáčkou z fermentovaných bobů',
  emoji: '🖤',
  prilezitost: 'Black Day (den nezadaných)',
  kdy: { typ: 'pevne', m: 4, d: 14 },
  kultura: 'novodobe',
  proc: 'V Koreji dávají na Valentýna (14. 2.) dárky ženy mužům, na White Day (14. 3.) muži ženám. Ti, kdo nic nedostali, se 14. dubna oblékají do černé a společně jedí nudle s černou omáčkou – z trucu i z legrace. Vznikl tak další den v řadě „čtrnáctek“.',
  recept: {
    nazev: 'Jjajangmyeon',
    porce: 4,
    cas: '40 min',
    suroviny: ['500 g čerstvých pšeničných nudlí (udon nebo jjajang nudle)', '4 lžíce korejské černé fazolové pasty chunjang (asijské obchody)', '300 g vepřového bůčku nebo krkovice', '1 velká cibule', '1 cuketa', '1 brambora', '2 lžíce cukru', '500 ml vody', '2 lžíce bramborového škrobu', '1 okurka na ozdobu', 'olej'],
    postup: [
      'Chunjang osmahněte 3 minuty na 3 lžících oleje a odložte.',
      'Maso nakrájejte na kostičky a opečte, přidejte na kostičky nakrájenou cibuli, bramboru a cuketu a smažte 5 minut.',
      'Vmíchejte osmaženou pastu a cukr, zalijte vodou a vařte 10 minut, až brambory změknou.',
      'Škrob rozmíchejte ve 4 lžících vody a omáčku jím zahustěte.',
      'Uvařené nudle rozdělte do misek, přelijte omáčkou a ozdobte okurkovými nudličkami.'
    ]
  },
  zdroj: 'https://ko.wikipedia.org/wiki/블랙데이'
},
{
  id: 'kr-bongnal',
  zeme: ['KR'],
  misto: '',
  jidlo: 'Samgyetang – kuře plněné rýží s ženšenem',
  emoji: '🐔',
  prilezitost: 'Chobok – první „psí den“ léta (Boknal)',
  kdy: { typ: 'tabulka', data: { '2025': '07-20', '2026': '07-15', '2027': '07-20', '2028': '07-14', '2029': '07-19', '2030': '07-14', '2031': '07-19', '2032': '07-13', '2033': '07-18', '2034': '07-13', '2035': '07-18', '2036': '07-12' } },
  kultura: 'vychodoasijske',
  proc: 'Tři nejparnější dny léta (chobok, jungbok, malbok) se počítají od slunovratu podle cyklu desíti dní – chobok je třetí den „gyeong“ po slunovratu. Podle zásady „horké proti horku“ se jí horká polévka z celého kuřátka plněného lepkavou rýží, ženšenem, česnekem a jujubou, která má vrátit síly ztracené pocením. Před restauracemi se ten den stojí fronty.',
  recept: {
    nazev: 'Samgyetang',
    porce: 2,
    cas: '1 h 30 min',
    suroviny: ['2 kuřátka (kohoutci asi 500 g)', '100 g lepkavé rýže namočené na 1 hodinu', '2 kořínky ženšenu (sušený z čajoven či lékáren, lze vynechat)', '6 stroužků česneku', '4 sušené jujuby (čínské datle)', '1 kousek zázvoru', '2 l vody', 'sůl, pepř, jarní cibulka'],
    postup: [
      'Kuřátka omyjte a odstraňte tuk z otvoru.',
      'Do každého vložte polovinu rýže, ženšen, 2 stroužky česneku a 2 jujuby; otvor sepněte párátkem nebo překřižte nohy přes zářez v kůži.',
      'Uložte do hrnce, přidejte zbylý česnek a zázvor a zalijte vodou.',
      'Vařte 1 hodinu na mírném ohni, sbírejte pěnu.',
      'Podávejte celé v misce s vývarem; sůl, pepř a nakrájenou cibulku si každý přidá podle chuti.'
    ]
  },
  zdroj: 'https://ko.wikipedia.org/wiki/삼복'
},
{
  id: 'kr-chuseok',
  zeme: ['KR'],
  misto: '',
  jidlo: 'Songpyeon – rýžové koláčky tvaru půlměsíce',
  emoji: '🌗',
  prilezitost: 'Chuseok (korejské díkůvzdání)',
  kdy: { typ: 'cinsky', m: 8, d: 15 },
  kultura: 'vychodoasijske',
  proc: 'O Chuseoku se rodiny sjíždějí k hrobům předků a děkují za úrodu. Večer před svátkem se společně modelují songpyeon z rýžové mouky z nové sklizně, plněné sezamem s medem, kaštany či fazolemi, a napařují se na jehličí, které jim dává vůni. Tvar půlměsíce slibuje růst a naplnění; kdo udělá hezký songpyeon, bude mít podle pořekadla hezké dítě.',
  recept: {
    nazev: 'Songpyeon',
    porce: 30,
    cas: '1 h 30 min',
    suroviny: ['300 g hladké rýžové mouky', 'asi 220 ml horké vody', '1/2 lžičky soli', 'barvení (nepovinně): 1 lžička prášku matcha nebo šťáva z červené řepy', 'náplň: 4 lžíce praženého sezamu, 2 lžíce medu, 2 lžíce cukru', 'hrst čistého borovicového jehličí (nebo pečicí papír)', 'sezamový olej'],
    postup: [
      'Mouku se solí zadělejte horkou vodou na hladké těsto; část můžete obarvit.',
      'Sezam nahrubo rozdrťte a smíchejte s medem a cukrem.',
      'Z těsta tvořte kuličky velikosti vlašského ořechu, vymačkejte v nich důlek, dejte lžičku náplně a uzavřete do tvaru půlměsíce.',
      'Do pařáku dejte vrstvu jehličí, na něj koláčky, aby se nedotýkaly.',
      'Napařujte 20 minut, krátce opláchněte studenou vodou a potřete sezamovým olejem.'
    ]
  },
  zdroj: 'https://ko.wikipedia.org/wiki/송편'
},
{
  id: 'kr-pepero',
  zeme: ['KR'],
  misto: '',
  jidlo: 'Pepero – tyčinky máčené v čokoládě',
  emoji: '🥢',
  prilezitost: 'Pepero Day',
  kdy: { typ: 'pevne', m: 11, d: 11 },
  kultura: 'novodobe',
  proc: 'Datum 11. 11. vypadá jako čtyři tenké tyčinky. Den údajně začal v 90. letech mezi studentkami, které si přály být štíhlé jako tyčinka, a výrobce Lotte ho pak proměnil v obří obchodní svátek. Tyčinky se dávají přátelům, spolužákům i partnerům.',
  recept: {
    nazev: 'Domácí čokoládové tyčinky',
    porce: 30,
    cas: '1 h',
    suroviny: ['150 g hladké mouky', '40 g másla', '30 g cukru', '1 vejce', 'špetka soli', '150 g mléčné nebo hořké čokolády', 'posyp: drcené mandle, barevný cukr'],
    postup: [
      'Z mouky, změklého másla, cukru, vejce a soli zpracujte hladké těsto a 30 minut chlaďte.',
      'Rozválejte na plát 3 mm a nakrájejte proužky 5 mm × 15 cm (nebo válejte tenké válečky).',
      'Pečte na 170 °C asi 12–15 minut dozlatova a nechte vychladnout.',
      'Čokoládu rozpusťte ve vodní lázni a tyčinky do ní namáčejte do dvou třetin.',
      'Posypte mandlemi nebo cukrem a nechte ztuhnout na pečicím papíře.'
    ]
  },
  zdroj: 'https://ko.wikipedia.org/wiki/빼빼로_데이'
},
{
  id: 'kr-dongji',
  zeme: ['KR'],
  misto: '',
  jidlo: 'Dongji patjuk – kaše z červených fazolí s rýžovými kuličkami',
  emoji: '🫘',
  prilezitost: 'Dongji (zimní slunovrat)',
  kdy: { typ: 'pevne', m: 12, d: 22 },
  kultura: 'vychodoasijske',
  proc: 'O nejdelší noci se vaří hustá kaše z fazolí azuki – červená barva odhání zlé duchy a nemoci; dříve se jí kropily i vrata a zdi domu. Do kaše se dávají kuličky z lepkavé rýže „ptačí vejce“ (saealsim) a podle zvyku jich každý sní tolik, kolik je mu let. Datum se řídí slunovratem, podle roku 21. nebo 22. 12.',
  recept: {
    nazev: 'Patjuk se saealsim',
    porce: 4,
    cas: '2 h',
    suroviny: ['250 g fazolí azuki', '2 l vody', '100 g lepkavé rýžové mouky', 'asi 80 ml horké vody', '50 g kulatozrnné rýže (namočené)', '1 lžička soli', 'cukr podle chuti (nepovinně)'],
    postup: [
      'Azuki propláchněte, přiveďte k varu, vodu slijte a zalijte 2 l čerstvé vody.',
      'Vařte asi 1,5 hodiny, až se fazole rozpadají; rozmixujte a přeceďte, slupky odstraňte.',
      'Do fazolového pyré přidejte namočenou rýži a vařte za stálého míchání 20 minut.',
      'Z lepkavé mouky a horké vody uhněťte těsto a vyválejte kuličky velikosti kuličky hroznu.',
      'Kuličky vařte v kaši, dokud nevyplavou, a osolte (případně osladíte).'
    ]
  },
  zdroj: 'https://ko.wikipedia.org/wiki/동지'
},

/* ===================== FILIPÍNY ===================== */
{
  id: 'ph-simbang-gabi',
  zeme: ['PH'],
  misto: '',
  jidlo: 'Bibingka a puto bumbong po ranní mši',
  emoji: '⛪',
  prilezitost: 'Simbang Gabi (devět mší před Vánoci)',
  kdy: { typ: 'pevne', m: 12, d: 16, delka: 9 },
  kultura: 'krestanske',
  proc: 'Od 16. do 24. prosince chodí Filipínci na mši za úsvitu; zvyk vznikl za španělské nadvlády, aby se rolníci stihli pomodlit před prací na poli. Kdo vydrží všech devět mší, tomu se podle víry splní přání. Před kostelem se pak prodává teplá bibingka (rýžový koláč pečený mezi uhlíky v banánovém listu) a fialové puto bumbong z bambusových trubiček, k tomu zázvorový čaj salabat.',
  recept: {
    nazev: 'Bibingka',
    porce: 6,
    cas: '45 min',
    suroviny: ['200 g hladké rýžové mouky', '100 g cukru', '2 lžičky prášku do pečiva', '1/4 lžičky soli', '300 ml kokosového mléka', '3 vejce', '50 g rozpuštěného másla', 'banánové listy (nebo pečicí papír)', 'navrch: plátky slaného vejce nebo sýra (eidam), strouhaný kokos, máslo, cukr'],
    postup: [
      'Troubu předehřejte na 200 °C, mělké formičky (12 cm) vyložte spařenými banánovými listy.',
      'Rýžovou mouku, cukr, prášek do pečiva a sůl smíchejte.',
      'Přidejte kokosové mléko, vejce a polovinu másla a rozmíchejte hladké těsto.',
      'Rozlijte do formiček a pečte 15 minut.',
      'Navrch dejte plátky sýra či slaného vejce a pečte ještě 5–10 minut, až je povrch zlatý (můžete dopéct pod grilem).',
      'Horkou bibingku potřete máslem, posypte cukrem a kokosem.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Simbang_Gabi'
},
{
  id: 'ph-noche-buena',
  zeme: ['PH'],
  misto: '',
  jidlo: 'Jamón (vánoční šunka), sýr queso de bola, lechón a sladké špagety',
  emoji: '🍖',
  prilezitost: 'Noche Buena (Štědrá noc)',
  kdy: { typ: 'pevne', m: 12, d: 24 },
  kultura: 'krestanske',
  proc: 'Po půlnoční mši (Misa de Gallo) se rodiny sejdou k velké hostině Noche Buena. Na stole nesmí chybět glazovaná šunka jamón a kulatý červený sýr queso de bola (eidam) – oba zvyky přinesla španělská nadvláda; dále selátko lechón, sladké filipínské špagety s párky a ovocný salát.',
  recept: {
    nazev: 'Filipínská vánoční šunka s ananasovou glazurou',
    porce: 8,
    cas: '2 h',
    suroviny: ['1,5 kg uzené vařené kýty (šunka v celku)', '500 ml ananasové šťávy', '150 g hnědého cukru', '2 lžíce medu', '1 lžíce hořčice', '6 hřebíčků', '1 malá plechovka ananasových kroužků'],
    postup: [
      'Šunku vložte do hrnce, zalijte ananasovou šťávou a vodou, aby byla ponořená, a 45 minut zvolna vařte.',
      'Šunku vyndejte, z kůže nebo tuku vyřízněte mřížku a do průsečíků zapíchněte hřebíček.',
      '300 ml výpeku ze šťávy svařte s cukrem, medem a hořčicí na hustý sirup (asi 15 minut).',
      'Šunku dejte do pekáče, obložte ananasovými kroužky a potřete glazurou.',
      'Pečte na 190 °C 30–40 minut a každých 10 minut znovu potírejte.',
      'Podávejte nakrájenou s kostkami eidamu.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Noche_Buena'
},
{
  id: 'ph-silvestr',
  zeme: ['PH'],
  misto: '',
  jidlo: '12 kulatých plodů a ovocný salát',
  emoji: '🍇',
  prilezitost: 'Silvestr (Media Noche)',
  kdy: { typ: 'pevne', m: 12, d: 31 },
  kultura: 'lidove',
  proc: 'Na silvestrovský stůl patří dvanáct druhů kulatého ovoce – jeden za každý měsíc; kulaté plody připomínají mince a mají přinést peníze. Ze stejného důvodu se nosí šaty s puntíky, o půlnoci se do kapes sypou drobné a děti vyskakují do výšky, aby povyrostly. Zvyk souvisí s čínskou symbolikou kulatého tvaru i se španělskými 12 hrozny.',
  recept: {
    nazev: 'Filipínský ovocný salát s kondenzovaným mlékem',
    porce: 8,
    cas: '20 min + 2 h chlazení',
    suroviny: ['1 plechovka ovocného koktejlu (850 g), scezená', '1 plechovka liči nebo rambutanu, scezená', '200 g hroznového vína', '2 jablka', '1 plechovka slazeného kondenzovaného mléka (397 g)', '250 ml smetany ke šlehání (nebo 200 g zakysané smetany)', 'kostičky sýra (eidam) – nepovinně, jak se na Filipínách dělá'],
    postup: [
      'Ovoce sceďte, jablka nakrájejte na kostičky, hrozny rozpulte.',
      'Smetanu smíchejte s kondenzovaným mlékem.',
      'Vmíchejte ovoce (a sýr).',
      'Salát nechte aspoň 2 hodiny vychladit v lednici.',
      'Vedle salátu vystavte na stůl dvanáct druhů kulatého ovoce celých.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/New_Year%27s_Eve#Philippines'
},

/* ===================== THAJSKO, MYANMAR ===================== */
{
  id: 'th-songkran',
  zeme: ['TH'],
  misto: '',
  jidlo: 'Khao chae – rýže v chladné vodě provoněné jasmínem',
  emoji: '🌼',
  prilezitost: 'Songkran (thajský Nový rok)',
  kdy: { typ: 'pevne', m: 4, d: 13, delka: 3 },
  kultura: 'lidove',
  proc: 'Thajský Nový rok připadá na nejteplejší období roku a slaví se poléváním vodou – očistou do nového roku. Tradičním songkranovým jídlem je khao chae: rýže v ledové vodě provoněné květy jasmínu, podávaná s drobnými slanosladkými přílohami. Pochází od Monů, kteří ji o Novém roce obětovali mnichům, a do Thajska se dostala přes královský dvůr.',
  recept: {
    nazev: 'Khao chae (zjednodušené)',
    porce: 4,
    cas: '1 h + chlazení přes noc',
    suroviny: ['300 g jasmínové rýže', '1,5 l vody', 'na „jasmínovou vodu“: 2 lžíce sušených jasmínových květů (čaj) nebo 1 lžička růžové vody', 'kostky ledu', 'přílohy: 4 šalotky, 200 g mletého vepřového, 1 lžíce rybí omáčky, 1 lžíce palmového cukru, 2 vejce, 1 zelená paprika (místo chilli prik yuak), 4 lžíce smažené šalotky'],
    postup: [
      'Jasmínové květy zalijte 1,5 l převařené vody, nechte přes noc v lednici a vodu přeceďte.',
      'Rýži uvařte trochu tužší, propláchněte studenou vodou a v sítku ji opatrně prolijte, aby se zbavila škrobu.',
      'Maso opečte s nasekanou šalotkou, rybí omáčkou a cukrem do sladkoslaného „vepřového flosu“.',
      'Papriku rozpulte, naplňte trochou masa, obalte ve rozšlehaném vejci a opečte.',
      'Rýži dejte do misek, zalijte ledovou jasmínovou vodou s ledem a podávejte s přílohami zvlášť – sousto přílohy, lžíce rýže.'
    ]
  },
  zdroj: 'https://th.wikipedia.org/wiki/ข้าวแช่'
},
{
  id: 'th-tesakan-kin-je',
  zeme: ['TH'],
  misto: 'Phuket, Bangkok, čínské čtvrti',
  jidlo: 'Jídla „je“ (jay) – přísně veganská, bez česneku a cibule',
  emoji: '🟨',
  prilezitost: 'Vegetariánský festival (svátek Devíti císařů)',
  kdy: { typ: 'cinsky', m: 9, d: 1, delka: 9 },
  kultura: 'vychodoasijske',
  proc: 'Prvních devět dní 9. lunárního měsíce drží thajští Číňané taoistický půst: nejedí maso, ryby, vejce, mléko ani alkohol a vyhýbají se i „pěti pálivým“ zeleninám (česnek, cibule, šalotka, pažitka, pórek). Stánky, které jídlo „je“ prodávají, vyvěšují žluté vlajky s červeným písmem. Na Phuketu festival provázejí průvody s rituálním propichováním tváří.',
  recept: {
    nazev: 'Restované tofu se zeleninou (pad pak je)',
    porce: 4,
    cas: '25 min',
    suroviny: ['400 g pevného tofu', '1 brokolice', '150 g hrachových lusků', '1 mrkev', '150 g shiitake nebo hlívy', '3 lžíce sójové omáčky', '1 lžíce houbové „ústřicové“ omáčky (veganská) nebo tmavé sójové', '1 lžička cukru', '2 cm zázvoru', 'olej', 'rýže jako příloha'],
    postup: [
      'Tofu nakrájejte na kostky, osušte a opečte na oleji dozlatova; vyndejte.',
      'Na oleji osmahněte nastrouhaný zázvor (bez česneku a cibule – pravidlo „je“).',
      'Přidejte mrkev a brokolici, po 2 minutách houby a lusky a krátce restujte na prudkém ohni.',
      'Vmíchejte omáčky, cukr, 3 lžíce vody a tofu, promíchejte a hned podávejte s rýží.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Nine_Emperor_Gods_Festival'
},
{
  id: 'mm-thingyan',
  zeme: ['MM'],
  misto: '',
  jidlo: 'Mont lone yay paw – rýžové kuličky s palmovým cukrem',
  emoji: '💦',
  prilezitost: 'Thingyan (barmský Nový rok, vodní festival)',
  kdy: { typ: 'pevne', m: 4, d: 13, delka: 4 },
  kultura: 'lidove',
  proc: 'Během čtyř dnů Thingyanu se lidé polévají vodou, aby smyli hříchy starého roku, a sousedé společně na ulici vaří kuličky z lepkavé rýže s kouskem palmového cukru, které rozdávají kolemjdoucím (zvyk satuditha). Kuličky při vaření vyplavou – odtud název „plovoucí koláčky“. Žertéři do některých schovávají pálivou papričku. Přesné dny se podle barmského kalendáře mohou o den posunout.',
  recept: {
    nazev: 'Mont lone yay paw',
    porce: 4,
    cas: '40 min',
    suroviny: ['200 g lepkavé rýžové mouky', 'asi 170 ml vody', '80 g palmového cukru (jaggery) nebo tmavého třtinového cukru v kostičkách', '80 g strouhaného kokosu', 'špetka soli'],
    postup: [
      'Mouku se solí zadělejte vodou na hladké nelepivé těsto.',
      'Vytvořte 20 kuliček, do každé zabalte kostičku cukru a uhlaďte.',
      'Vařte v hojné vroucí vodě; až kuličky vyplavou, vařte ještě 1–2 minuty.',
      'Vyndejte sítkem a obalte v kokosu smíchaném se špetkou soli.',
      'Jezte opatrně – cukr uvnitř je tekutý a horký.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Mont_lone_yay_baw'
},

/* ===================== INDIE ===================== */
{
  id: 'in-pongal',
  zeme: ['IN', 'LK'],
  misto: 'Tamilnádu, Tamilové na Srí Lance',
  jidlo: 'Sakkarai pongal – rýže s mlékem a třtinovým cukrem jaggery',
  emoji: '🍚',
  prilezitost: 'Thai Pongal (tamilské díkůvzdání za úrodu)',
  kdy: { typ: 'tabulka', data: { '2025': '01-14', '2026': '01-15', '2027': '01-15', '2028': '01-15', '2029': '01-14', '2030': '01-15', '2031': '01-15', '2032': '01-15', '2033': '01-14', '2034': '01-15', '2035': '01-15', '2036': '01-15' } },
  kultura: 'hinduisticke',
  proc: 'První den tamilského měsíce Thai se na dvorku v novém hliněném hrnci vaří nová rýže v mléce s jaggery. Když mléko překypí, všichni volají „Pongalo pongal!“ – přetékání znamená hojnost v novém roce. Pokrm se nejprve obětuje Slunci (Surjovi) a pak sní; následuje Mattu Pongal na počest dobytka.',
  recept: {
    nazev: 'Sakkarai pongal',
    porce: 4,
    cas: '45 min',
    suroviny: ['150 g rýže (ideálně krátkozrnná nebo basmati)', '40 g loupaných žlutých fazolí mungo (moong dal)', '750 ml vody + 250 ml mléka', '200 g jaggery (indické obchody) nebo muscovado', '4 lžíce přepuštěného másla (ghí)', '15 kešu ořechů', '2 lžíce rozinek', '4 lusky kardamomu', 'špetka muškátového oříšku'],
    postup: [
      'Mungo nasucho opražte do vůně, smíchejte s rýží a propláchněte.',
      'Vařte ve vodě s mlékem doměkka a do krémova (asi 25 minut), rozmačkejte vařečkou.',
      'Jaggery rozpusťte ve 100 ml vody, přeceďte a vlijte do rýže; vařte 5 minut za stálého míchání.',
      'Na ghí osmahněte kešu a rozinky.',
      'Vmíchejte je i se zbylým ghí, drcený kardamom a muškátový oříšek. Podávejte teplé.'
    ]
  },
  zdroj: 'https://ta.wikipedia.org/wiki/தைப்பொங்கல்'
},
{
  id: 'in-makar-sankranti',
  zeme: ['IN'],
  misto: 'Maháráštra, Gudžarát, Karnátaka (tilgul); sever Indie (khičrí)',
  jidlo: 'Tilgul – kuličky ze sezamu a jaggery',
  emoji: '🪁',
  prilezitost: 'Makar Sankrántí (vstup Slunce do Kozoroha)',
  kdy: { typ: 'tabulka', data: { '2025': '01-14', '2026': '01-14', '2027': '01-15', '2028': '01-15', '2029': '01-14', '2030': '01-14', '2031': '01-15', '2032': '01-15', '2033': '01-14', '2034': '01-14', '2035': '01-15', '2036': '01-15' } },
  kultura: 'hinduisticke',
  proc: 'Den, kdy Slunce vstupuje do znamení Kozoroha a dny se prodlužují, je jedním z mála hinduistických svátků podle slunce. V Maháráštře se rozdávají sladké sezamové kuličky se slovy „Tilgul ghjá, goḍ goḍ bolá“ – „vezmi si tilgul a mluv sladce“; sezam zahřívá v zimě a sladkost usmiřuje spory. Na severu se jí khičrí z rýže a čočky, v Gudžarátu se pouštějí draci.',
  recept: {
    nazev: 'Til laddu (tilgul)',
    porce: 20,
    cas: '30 min',
    suroviny: ['200 g loupaného sezamu', '200 g jaggery (nebo muscovado)', '2 lžíce arašídů (opražených, nahrubo drcených)', '2 lžíce strouhaného kokosu', '1 lžíce ghí', '3 lusky kardamomu (rozdrcené)'],
    postup: [
      'Sezam opražte nasucho za stálého míchání do světle zlatova a nechte vychladnout.',
      'V pánvi rozpusťte ghí a jaggery a vařte, dokud kapka v studené vodě neztuhne do měkké kuličky (asi 5 minut).',
      'Stáhněte z ohně a rychle vmíchejte sezam, arašídy, kokos a kardamom.',
      'Navlhčenýma nebo vymaštěnýma rukama tvarujte z ještě teplé hmoty malé kuličky.',
      'Nechte ztuhnout a rozdávejte s přáním, ať spolu mluvíte sladce.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Makar_Sankranti'
},
{
  id: 'in-holi',
  zeme: ['IN', 'NP'],
  misto: 'hlavně sever Indie',
  jidlo: 'Gudžija (smažené taštičky s khoa) a nápoj thandai',
  emoji: '🎨',
  prilezitost: 'Holí (svátek barev)',
  kdy: { typ: 'tabulka', data: { '2025': '03-14', '2026': '03-04', '2027': '03-22', '2028': '03-11', '2029': '03-01', '2030': '03-20', '2031': '03-09', '2032': '03-27', '2033': '03-16', '2034': '03-05', '2035': '03-24', '2036': '03-12' } },
  kultura: 'hinduisticke',
  proc: 'Večer před Holí se pálí hranice Holika na připomínku vítězství dobra nad zlem; druhý den (Dhulandí) se lidé bez rozdílu kast a věku zasypávají barevným práškem a polévají vodou. Domácnosti dny dopředu smaží gudžiji – půlměsíce z těsta plněné sušeným mlékem khoa, kokosem a ořechy – a podávají chladivé mandlové thandai s kořením. Tabulka uvádí den barev.',
  recept: {
    nazev: 'Gudžija',
    porce: 20,
    cas: '1 h 30 min',
    suroviny: ['těsto: 250 g hladké mouky, 50 g ghí, asi 100 ml vody', 'náplň: 200 g khoa (nebo 250 g plnotučného sušeného mléka opraženého s 3 lžícemi ghí a 80 ml mléka)', '80 g moučkového cukru', '3 lžíce strouhaného kokosu', '3 lžíce sekaných mandlí a pistácií', '1 lžíce rozinek', '1/2 lžičky drceného kardamomu', 'olej nebo ghí na smažení'],
    postup: [
      'Mouku promněte s ghí, zadělejte vodou na tuhé hladké těsto a nechte 30 minut odpočinout.',
      'Khoa (nebo směs ze sušeného mléka) opražte na pánvi do světle zlatova a nechte vychladnout.',
      'Vmíchejte cukr, kokos, ořechy, rozinky a kardamom.',
      'Těsto rozválejte na kolečka 10 cm, doprostřed dejte lžíci náplně, přeložte a okraj zatočte nebo ořízněte vroubkovaným kolečkem.',
      'Smažte na středně horkém oleji pomalu do zlatova (asi 6 minut) a nechte okapat.'
    ]
  },
  zdroj: 'https://hi.wikipedia.org/wiki/होली'
},
{
  id: 'in-ugadi',
  zeme: ['IN'],
  misto: 'Karnátaka, Ándhrapradéš, Telangána; v Maháráštře jako Gudi Padva',
  jidlo: 'Ugadi pačadi – „chuť šesti chutí“',
  emoji: '🥭',
  prilezitost: 'Ugádí / Gudi Padva (Nový rok podle lunárního kalendáře)',
  kdy: { typ: 'tabulka', data: { '2025': '03-30', '2026': '03-19', '2027': '04-07', '2028': '03-27', '2029': '04-14', '2030': '04-03', '2031': '03-24', '2032': '04-11', '2033': '03-31', '2034': '03-21', '2035': '04-09', '2036': '03-28' } },
  kultura: 'hinduisticke',
  proc: 'Nový rok v jižní Indii začíná lžící pačadi, v níž se mísí šest chutí jako zkušenosti příštího roku: jaggery (radost), květy nímu (hořkost a smutek), tamarind (znechucení), nezralé mango (překvapení), chilli či pepř (hněv) a sůl (strach). V Maháráštře se vyvěšuje vlajka gudi a jí se placky puran poli.',
  recept: {
    nazev: 'Ugadi pačadi',
    porce: 6,
    cas: '15 min',
    suroviny: ['1 lžíce tamarindové pasty (nebo šťáva z 1 limetky)', '200 ml vody', '60 g jaggery (nebo muscovado)', '1/2 nezralého zeleného manga (nebo kyselého jablka)', '1 lžička sušených květů nímu (indické obchody; jinak trochu nastrouhané grepové kůry pro hořkost)', 'špetka soli', 'špetka mletého černého pepře nebo chilli', '1 malý banán (nepovinně)'],
    postup: [
      'Tamarind rozmíchejte ve vodě a přeceďte.',
      'Rozpusťte v něm nastrouhaný jaggery.',
      'Mango oloupejte a nakrájejte na drobné kostičky, banán na kolečka.',
      'Vmíchejte květy nímu (nebo grepovou kůru), sůl a pepř.',
      'Podávejte po lžičkách hned ráno, před jakýmkoli jiným jídlem.'
    ]
  },
  zdroj: 'https://te.wikipedia.org/wiki/ఉగాది'
},
{
  id: 'in-onam',
  zeme: ['IN'],
  misto: 'Kérala',
  jidlo: 'Onam sadja – hostina až 26 jídel na banánovém listu',
  emoji: '🍌',
  prilezitost: 'Ónam (Thiruvónam)',
  kdy: { typ: 'tabulka', data: { '2025': '09-05', '2026': '08-26', '2027': '09-12', '2028': '09-01', '2029': '08-22', '2030': '09-09', '2031': '08-30', '2032': '09-16', '2033': '09-07', '2034': '08-28', '2035': '09-14', '2036': '09-03' } },
  kultura: 'hinduisticke',
  proc: 'Kéralský svátek sklizně vítá na návštěvu legendárního dobrého krále Mahábaliho, za jehož vlády byli všichni rovni a nikdo nehladověl. Vrcholem je den Thiruvónam s vegetariánskou hostinou sadja: rýže, sambar, avijal, olan, thoran, papadam, nakládané ovoce, banánové chipsy a na závěr několik sladkých pajasamů, vše v předepsaném pořadí na banánovém listu. Den se určuje podle souhvězdí Šravana v měsíci Čingam (v letech se dvěma Thiruvónamy v měsíci se slaví druhý).',
  recept: {
    nazev: 'Pal pajasam (rýžový pudink s mlékem)',
    porce: 6,
    cas: '1 h 15 min',
    suroviny: ['60 g krátkozrnné rýže (nebo rýže na mléčnou rýži)', '1,5 l plnotučného mléka', '150 g cukru', '2 lžíce ghí', '15 kešu ořechů', '1 lžíce rozinek', '4 lusky kardamomu'],
    postup: [
      'Rýži propláchněte a namočte na 20 minut.',
      'Mléko přiveďte k varu v hrnci se silným dnem a vsypte rýži.',
      'Vařte na mírném ohni za častého míchání asi 50 minut, až mléko zhoustne, zrůžoví a rýže se rozvaří.',
      'Přidejte cukr a vařte dalších 10 minut.',
      'Na ghí osmahněte kešu a rozinky, vmíchejte je s drceným kardamomem a podávejte teplé jako poslední chod sadji.'
    ]
  },
  zdroj: 'https://ml.wikipedia.org/wiki/ഓണം'
},
{
  id: 'in-ganes-caturthi',
  zeme: ['IN'],
  misto: 'Maháráštra, Goa, Karnátaka',
  jidlo: 'Modak – parené knedlíčky s kokosem a jaggery',
  emoji: '🐘',
  prilezitost: 'Ganéš čaturthí',
  kdy: { typ: 'tabulka', data: { '2025': '08-27', '2026': '09-14', '2027': '09-04', '2028': '08-23', '2029': '09-11', '2030': '09-01', '2031': '09-20', '2032': '09-08', '2033': '08-28', '2034': '09-16', '2035': '09-05', '2036': '08-24' } },
  kultura: 'hinduisticke',
  proc: 'Desetidenní svátek narozenin sloního boha Ganéši začíná instalací jeho sochy doma i ve veřejných pandalech a končí jejím ponořením do vody. Modak je Ganéšova nejoblíbenější sladkost – rodiny mu obětují 21 kousků. Nejcenější jsou „ukadiče modak“ z rýžového těsta s kokosem a jaggery, tvarované do kapky se záhyby.',
  recept: {
    nazev: 'Ukadiče modak',
    porce: 21,
    cas: '1 h 15 min',
    suroviny: ['náplň: 200 g čerstvě strouhaného kokosu (nebo 150 g sušeného + 4 lžíce mléka)', '150 g jaggery', '1/2 lžičky drceného kardamomu', 'těsto: 200 g hladké rýžové mouky', '250 ml vody', '1 lžíce ghí', 'špetka soli'],
    postup: [
      'Kokos s jaggery vařte na pánvi za stálého míchání 8–10 minut, až se jaggery rozpustí a směs zhoustne; vmíchejte kardamom a nechte vychladnout.',
      'Vodu s ghí a solí přiveďte k varu, vsypte rýžovou mouku, vypněte oheň, zamíchejte a 5 minut nechte pod pokličkou.',
      'Horké těsto vymaštěnýma rukama propracujte do hladka.',
      'Z kuličky těsta vytvořte misku, prsty po obvodu udělejte záhyby, doprostřed dejte náplň a záhyby stáhněte do špičky.',
      'Napařujte na vymaštěném sítku nebo banánovém listu 12–15 minut a podávejte s kapkou ghí.'
    ]
  },
  zdroj: 'https://mr.wikipedia.org/wiki/गणेश_चतुर्थी'
},
{
  id: 'in-diwali',
  zeme: ['IN', 'NP'],
  misto: '',
  jidlo: 'Mithai – sladkosti (laddu, barfi, kadžu katli)',
  emoji: '🪔',
  prilezitost: 'Díválí (den Lakšmí púdži)',
  kdy: { typ: 'tabulka', data: { '2025': '10-20', '2026': '11-08', '2027': '10-29', '2028': '10-17', '2029': '11-05', '2030': '10-26', '2031': '11-14', '2032': '11-02', '2033': '10-22', '2034': '11-10', '2035': '10-30', '2036': '10-18' } },
  kultura: 'hinduisticke',
  proc: 'Svátek světel slaví návrat Rámy do Ajódhji a vítězství světla nad temnotou. Hlavní večer, kdy se za novoluní uctívá bohyně bohatství Lakšmí, se domy rozzáří lampičkami dijá a rodiny a přátelé si vyměňují krabice sladkostí mithai. Sladkost má zajistit „sladký“ a hojný rok; doma se nejčastěji připravují laddu z cizrnové mouky. Datum je podle výpočtu pro Dillí.',
  recept: {
    nazev: 'Besan laddu',
    porce: 16,
    cas: '45 min',
    suroviny: ['250 g cizrnové mouky (besan)', '150 g ghí', '180 g moučkového cukru', '1/2 lžičky drceného kardamomu', '2 lžíce sekaných pistácií nebo mandlí'],
    postup: [
      'Ghí rozpusťte v pánvi se silným dnem a vsypte cizrnovou mouku.',
      'Za stálého míchání ji na mírném ohni pražte 20–25 minut, až zezlátne a voní po oříšcích.',
      'Nechte vychladnout do vlažna (cukr se nesmí rozpustit).',
      'Vmíchejte cukr, kardamom a ořechy.',
      'Tvarujte kuličky velikosti vlašského ořechu a nechte ztuhnout.'
    ]
  },
  zdroj: 'https://hi.wikipedia.org/wiki/दीपावली'
},
{
  id: 'in-chhath',
  zeme: ['IN', 'NP'],
  misto: 'Bihár, východ Uttarpradéše, nepálský Teraj',
  jidlo: 'Thekua – smažené sušenky z celozrnné mouky a jaggery',
  emoji: '🌅',
  prilezitost: 'Čhath púdžá (večerní oběť Slunci)',
  kdy: { typ: 'tabulka', data: { '2025': '10-27', '2026': '11-15', '2027': '11-04', '2028': '10-23', '2029': '11-11', '2030': '11-01', '2031': '11-20', '2032': '11-09', '2033': '10-29', '2034': '11-17', '2035': '11-06', '2036': '10-25' } },
  kultura: 'hinduisticke',
  proc: 'Čtyřdenní svátek uctívá Slunce a bohyni Čhathí maijá. Ženy drží přísný půst bez vody, ve třetím dni stojí po pás v řece a obětují zapadajícímu slunci (tabulka uvádí tento den) a ráno vycházejícímu. V bambusových košících nesou ovoce a thekua – sušenky z celozrnné mouky, jaggery a ghí, které se připravují s rituální čistotou.',
  recept: {
    nazev: 'Thekua',
    porce: 20,
    cas: '1 h',
    suroviny: ['300 g celozrnné pšeničné mouky', '150 g jaggery (nebo muscovado)', '120 ml vody', '4 lžíce ghí', '2 lžíce strouhaného kokosu', '1/2 lžičky drceného kardamomu', '1 lžíce fenyklových semínek', 'olej nebo ghí na smažení'],
    postup: [
      'Jaggery rozpusťte ve vodě a nechte vychladnout.',
      'Mouku promněte s ghí, kokosem, kardamomem a fenyklem.',
      'Postupně přidávejte jaggerovou vodu a zpracujte tuhé těsto.',
      'Tvarujte placičky 6 cm a otiskněte do nich vzor (formička, vidlička nebo dno sklenice s výstupky).',
      'Smažte na středně horkém oleji pomalu dohnědavě do křupava.'
    ]
  },
  zdroj: 'https://hi.wikipedia.org/wiki/छठ_पूजा'
},

/* ===================== BANGLADÉŠ, NEPÁL, SRÍ LANKA ===================== */
{
  id: 'bd-pohela-boishakh',
  zeme: ['BD'],
  misto: '',
  jidlo: 'Panta bhat (kvašená rýže) s ilišem, chilli a cibulí',
  emoji: '🐟',
  prilezitost: 'Pohela Boišakh (bengálský Nový rok)',
  kdy: { typ: 'pevne', m: 4, d: 14 },
  kultura: 'lidove',
  proc: 'První den bengálského roku se v Dháce slaví průvodem Mangal Šobhajatra (UNESCO) a snídaní z „panta bhat“ – rýže namočené přes noc ve vodě, jídla venkovských chudých – se smaženou rybou iliš (hilsa), zelenými chilli a cibulí. Zvyk vznikl teprve v 80. letech mezi městskou inteligencí; protože v dubnu hrozí výlov mladých ryb, vláda nabádá jíst jinou rybu. Na venkově zůstávají hlavní trhy, draci a sladkosti.',
  recept: {
    nazev: 'Panta bhat se smaženou rybou',
    porce: 4,
    cas: '30 min + namáčení přes noc',
    suroviny: ['300 g rýže', '4 filety makrely nebo sledě (iliš je v ČR jen mražený v indických obchodech)', '1 lžička kurkumy', '1/2 lžičky chilli', 'sůl', 'hořčičný olej (nebo slunečnicový) na smažení', '1 červená cibule', '4 zelené chilli papričky', '2 vařené brambory (na pyré alu bhorta)', '1 lžíce hořčičného oleje do bhorty'],
    postup: [
      'Uvařenou vychladlou rýži zalijte v hliněné nebo skleněné nádobě studenou vodou, aby byla ponořená, a nechte přes noc při pokojové teplotě.',
      'Ráno rybu natřete kurkumou, chilli a solí a smažte na oleji z obou stran do křupava.',
      'Brambory rozmačkejte s nasekanou cibulí, chilli, solí a lžící hořčičného oleje (alu bhorta).',
      'Rýži podávejte v miskách i s částí nakyslé vody, osolenou.',
      'Ke každé misce dejte rybu, bhortu, syrovou cibuli a zelené chilli na zakousnutí.'
    ]
  },
  zdroj: 'https://bn.wikipedia.org/wiki/পান্তা_ভাত'
},
{
  id: 'np-dasain',
  zeme: ['NP'],
  misto: '',
  jidlo: 'Khasi ko masu – kozí maso na kari, k tomu beaten rice (čiura)',
  emoji: '🐐',
  prilezitost: 'Dašain – Vidžaja dašamí (den tiky)',
  kdy: { typ: 'tabulka', data: { '2025': '10-02', '2026': '10-21', '2027': '10-10', '2028': '09-28', '2029': '10-16', '2030': '10-06', '2031': '10-25', '2032': '10-14', '2033': '10-04', '2034': '10-23', '2035': '10-12', '2036': '09-29' } },
  kultura: 'hinduisticke',
  proc: 'Největší nepálský svátek slaví vítězství bohyně Durgy nad démonem. V den Vidžaja dašamí dostávají mladší od starších na čelo tiku z rýže, jogurtu a červeného prášku a za ucho zelené klíčky jamara. Bohyni se obětují kozy a buvoli a jejich maso se pak jí jako požehnání (prasád) na rodinných hostinách. Data podle nepálského kalendáře (tithi při východu slunce v Káthmándú).',
  recept: {
    nazev: 'Khasi ko masu (kozí nebo jehněčí kari)',
    porce: 6,
    cas: '2 h',
    suroviny: ['1,2 kg kozího nebo jehněčího masa s kostí (plec)', '3 cibule', '4 stroužky česneku', '4 cm zázvoru', '2 rajčata', '1 lžička kurkumy', '1 lžíce mletého kmínu', '1 lžíce mletého koriandru', '1 lžička garam masaly', '2 bobkové listy, 1 skořice, 4 hřebíčky', '1 lžička chilli', '4 lžíce hořčičného oleje', 'sůl, čerstvý koriandr'],
    postup: [
      'Maso nakrájejte na kusy a naložte s kurkumou, solí a polovinou česneku se zázvorem (pasta) na 30 minut.',
      'Na rozpáleném oleji krátce osmahněte celé koření, přidejte nadrobno nakrájenou cibuli a smažte do zlatohněda (15 minut).',
      'Přidejte zbytek česneku a zázvoru, mleté koření a chilli, po minutě rajčata a smažte do rozpadnutí.',
      'Vložte maso a na prudším ohni opékejte 10 minut, až se zatáhne.',
      'Podlijte vodou, přikryjte a duste 1–1,5 hodiny doměkka.',
      'Dochuťte garam masalou a koriandrem; podávejte s rýží nebo s čiurou (sušenou plochou rýží).'
    ]
  },
  zdroj: 'https://ne.wikipedia.org/wiki/दशैँ'
},
{
  id: 'lk-avurudu',
  zeme: ['LK'],
  misto: '',
  jidlo: 'Kiribath (rýže v kokosovém mléce), kavum a kokis',
  emoji: '🥥',
  prilezitost: 'Sinhálský a tamilský Nový rok (Aluth Avurudda)',
  kdy: { typ: 'pevne', m: 4, d: 13, delka: 2 },
  kultura: 'lidove',
  proc: 'Nový rok začíná, když Slunce vstoupí do znamení Berana; přesné okamžiky všech obřadů určují astrologové (nekath). V „neutrálním období“ před novým rokem se nejí ani nepracuje; v šťastnou chvíli se zapálí ohniště, v novém hrnci se nechá překypět mléko a uvaří kiribath. Ten se nakrájí na kosočtverce a sní se jako první jídlo roku, spolu s banány a sladkostmi kavum a kokis připravenými předem.',
  recept: {
    nazev: 'Kiribath',
    porce: 6,
    cas: '40 min',
    suroviny: ['300 g kulatozrnné rýže (ideálně červená nebo bílá „samba“, jinak rýže na rizoto)', '600 ml vody', '400 ml kokosového mléka', '1 lžička soli', 'k podávání: lunu miris (cibule, chilli, limetka, sůl rozdrcené v hmoždíři) nebo jaggery'],
    postup: [
      'Rýži propláchněte a vařte ve vodě 15–20 minut, až je měkká a voda se vstřebá.',
      'Vlijte kokosové mléko se solí a za stálého míchání vařte dalších 10 minut, až rýže zhoustne a je krémová.',
      'Horkou rýži vyklopte na plochý talíř (tradičně vyložený banánovým listem) a uhlaďte do placky 3 cm.',
      'Mírně vychladlou nakrájejte na kosočtverce.',
      'Podávejte se štiplavou cibulovou pastou lunu miris nebo se sladkým jaggery.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Sinhalese_New_Year'
},

/* ===================== ÍRÁN, AFGHÁNISTÁN ===================== */
{
  id: 'ir-cahar-sanbe-suri',
  zeme: ['IR'],
  misto: '',
  jidlo: 'Adžil-e moškel-gošá – směs ořechů a sušeného ovoce „řešitelka potíží“',
  emoji: '🔥',
  prilezitost: 'Čahár-šanbe-surí (ohňová noc před poslední středou roku)',
  kdy: { typ: 'vrozsahu', m: 3, od: 14, wd: 2 },
  kultura: 'persko',
  proc: 'V úterý večer před poslední středou starého roku se v ulicích skáče přes ohně se slovy „Mé žluté (nemoc) tobě, tvé rudé (síla) mně“. Zvyk je starší než islám a souvisí s uctíváním ohně a duchů předků. Jí se adžil – směs sedmi druhů pražených ořechů, semínek a sušeného ovoce, která má „rozvázat“ potíže; zbytek se rozdává sousedům.',
  recept: {
    nazev: 'Adžil (pražená směs)',
    porce: 8,
    cas: '20 min',
    suroviny: ['100 g pistácií ve skořápce', '100 g mandlí', '100 g lískových ořechů', '100 g pražené cizrny (leblebi, turecké obchody)', '80 g dýňových semínek', '100 g rozinek', '100 g sušených fíků nebo meruněk', 'šťáva z 1 citronu, 1/2 lžičky soli, špetka šafránu rozpuštěná v 1 lžíci horké vody'],
    postup: [
      'Smíchejte citronovou šťávu, sůl a šafránovou vodu.',
      'Mandle, lískové ořechy a dýňová semínka v ní obalte.',
      'Pražte na suché pánvi nebo na plechu při 160 °C asi 10 minut, až se tekutina odpaří a ořechy zavoní.',
      'Nechte vychladnout a smíchejte s pistáciemi, cizrnou, rozinkami a nakrájenými fíky.',
      'Rozdělte do misek a část rozdejte sousedům – tak se „řeší potíže“.'
    ]
  },
  zdroj: 'https://fa.wikipedia.org/wiki/چهارشنبه‌سوری'
},
{
  id: 'ir-nouruz',
  zeme: ['IR'],
  misto: '',
  jidlo: 'Sabzi polo ba mahi – bylinková rýže s rybou',
  emoji: '🌱',
  prilezitost: 'Nourúz (perský Nový rok)',
  kdy: { typ: 'pevne', m: 3, d: 21 },
  kultura: 'persko',
  proc: 'Nový rok začíná přesně v okamžiku jarní rovnodennosti, proto může připadnout na 20. nebo 21. března. Na stole stojí haft-sín – sedm věcí na „s“ (klíčky, sladký pudink samanu, jablko, česnek, ocet…). Na večeři (předvečer nebo první den) se jí rýže s hromadou zelených bylinek, které znamenají jaro a obnovu, a ryba jako symbol života a hojnosti.',
  recept: {
    nazev: 'Sabzi polo ba mahi',
    porce: 4,
    cas: '1 h 30 min',
    suroviny: ['400 g basmati rýže', 'po velkém svazku: petržel, koriandr, kopr, pažitka (celkem asi 300 g), 2 lžíce sušeného pískavice (nepovinně)', '4 stroužky česneku', '80 g másla', 'špetka šafránu', '4 filety bílé ryby (candát, štikozubec, pstruh)', '1 lžička kurkumy', 'mouka, sůl, pepř, olej', 'citron nebo hořký pomeranč'],
    postup: [
      'Rýži propláchněte a namočte na hodinu v osolené vodě; bylinky a česnek nasekejte nadrobno.',
      'Rýži vařte 6 minut v hojné osolené vodě, sceďte a propláchněte vlažnou vodou.',
      'Na dno hrnce dejte 3 lžíce oleje a tenkou vrstvu rýže; pak vrstvěte rýži s bylinkami do kupky.',
      'Do kupky vypíchněte vařečkou otvory, přidejte kousky másla a šafrán rozpuštěný v 2 lžících vody; hrnec přikryjte utěrkou a pokličkou a na mírném ohni duste 45 minut (vznikne křupavá kůrka tahdig).',
      'Rybu osolte, opepřete, natřete kurkumou, obalte v mouce a osmahněte dozlatova.',
      'Podávejte rýži s rybou, kůrkou tahdig a citronem.'
    ]
  },
  zdroj: 'https://fa.wikipedia.org/wiki/سبزی_پلو_با_ماهی'
},
{
  id: 'ir-sizdah-bedar',
  zeme: ['IR'],
  misto: '',
  jidlo: 'Kahu sekandžabín (hlávkový salát v octovo-medovém sirupu) a áš-e rešte',
  emoji: '🥬',
  prilezitost: 'Sizdah bedar („ven třináctého“)',
  kdy: { typ: 'pevne', m: 4, d: 2 },
  kultura: 'persko',
  proc: 'Třináctý den nového roku (13. farvardín) je považován za nešťastný, a tak ho rodiny tráví venku na pikniku – „vyhánějí“ neštěstí z domova. Klíčky z novoročního stolu se hodí do tekoucí vody a svobodné dívky zavazují stébla trávy s přáním svatby. Na piknik patří listy hlávkového salátu namáčené v sirupu sekandžabín a polévka áš-e rešte s nudlemi. Den je 2. dubna, v letech, kdy Nourúz připadne na 20. 3., už 1. dubna.',
  recept: {
    nazev: 'Kahu sekandžabín',
    porce: 6,
    cas: '40 min',
    suroviny: ['300 g cukru (nebo 200 g cukru + 100 g medu)', '250 ml vody', '120 ml bílého vinného octa', 'velký svazek čerstvé máty', '2 hlávky římského salátu', '1 okurka (do nápoje, nepovinně)'],
    postup: [
      'Cukr s vodou přiveďte k varu, až se rozpustí.',
      'Přilijte ocet a vařte na mírném ohni 20–25 minut, až sirup zhoustne.',
      'Stáhněte z ohně, vložte svazek máty a nechte vychladnout; mátu vyjměte.',
      'Salát rozdělte na listy, omyjte a osušte.',
      'Listy namáčejte do sirupu a jezte; zbytek sirupu zřeďte ledovou vodou s nastrouhanou okurkou na osvěžující nápoj.'
    ]
  },
  zdroj: 'https://fa.wikipedia.org/wiki/سیزده‌بدر'
},
{
  id: 'ir-jalda',
  zeme: ['IR', 'AF', 'TJ'],
  misto: '',
  jidlo: 'Granátová jablka, meloun a adžil',
  emoji: '🍉',
  prilezitost: 'Šab-e Jalda (nejdelší noc roku)',
  kdy: { typ: 'pevne', m: 12, d: 21 },
  kultura: 'persko',
  proc: 'Rodina bdí přes nejdelší noc roku u starších, čte se z Háfeze a věští se z jeho veršů. Rudá granátová jablka a meloun připomínají úsvit a vítězství světla; meloun schovaný od léta má podle víry chránit před zimními nemocemi. Jalda (UNESCO 2022) připadá na noc slunovratu, tedy obvykle 20.–21. 12., v některých letech o den později (30. azar podle íránského kalendáře).',
  recept: {
    nazev: 'Anár dane ba golpar (granátové jablko se solí a angelikou)',
    porce: 4,
    cas: '15 min',
    suroviny: ['3 granátová jablka', '1/2 lžičky soli', '1 lžička mletého golparu (perská angelika, perské obchody; jinak špetka mletého kmínu a sušené máty)', '1/4 melounu', '200 g adžilu (směs ořechů a sušeného ovoce)'],
    postup: [
      'Granátová jablka rozkrojte a nad miskou vyklepejte zrníčka vařečkou.',
      'Zrníčka posypte solí a golparem a promíchejte.',
      'Meloun nakrájejte na trojúhelníky.',
      'Vše dejte na stůl spolu s adžilem, čajem a sladkostmi a nechte vydržet do půlnoci.'
    ]
  },
  zdroj: 'https://fa.wikipedia.org/wiki/شب_یلدا'
},
{
  id: 'af-nauruz',
  zeme: ['AF'],
  misto: '',
  jidlo: 'Haft mewa („sedm plodů“) a samanak',
  emoji: '🍑',
  prilezitost: 'Nauruz (afghánský Nový rok)',
  kdy: { typ: 'pevne', m: 3, d: 21 },
  kultura: 'persko',
  proc: 'Afghánci den či dva před Novým rokem namáčejí sedm druhů sušeného ovoce a ořechů – rozinky, oleandr (sendžid), meruňky, pistácie, mandle, vlašské ořechy – a ráno je podávají v jejich sladké šťávě hostům. Sedmička nosí štěstí, sendžid symbolizuje lásku. Ženy přes noc vaří za zpěvu sladký samanak z naklíčené pšenice. Tálibán svátek v roce 2022 zrušil jako oficiální, rodiny ho však slaví doma. Datum se může o den posunout podle rovnodennosti.',
  recept: {
    nazev: 'Haft mewa',
    porce: 8,
    cas: '15 min + 2 dny namáčení',
    suroviny: ['100 g zelených (světlých) rozinek', '100 g tmavých rozinek', '100 g sušených meruněk', '50 g sušeného oleandru sendžid (perské/afghánské obchody; lze nahradit sušenými třešněmi nebo brusinkami)', '50 g mandlí', '50 g vlašských ořechů', '50 g pistácií', '1,5 l vody'],
    postup: [
      'Rozinky, meruňky a sendžid propláchněte a zalijte vodou ve velké míse.',
      'Nechte 1–2 dny v lednici, až voda zesládne a ovoce nabobtná.',
      'Mandle a ořechy namočte zvlášť do horké vody na pár hodin; mandle oloupejte.',
      'Ořechy a pistácie přidejte k ovoci až den před podáváním.',
      'Podávejte vychlazené v miskách i se šťávou ráno na Nový rok.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Nowruz_in_Afghanistan'
},

/* ===================== STŘEDNÍ ASIE, MONGOLSKO ===================== */
{
  id: 'uz-sumalak',
  zeme: ['UZ', 'TJ', 'KG'],
  misto: '',
  jidlo: 'Sumalak (sumanak) – sladká kaše z naklíčené pšenice vařená celou noc',
  emoji: '🌾',
  prilezitost: 'Navruz',
  kdy: { typ: 'pevne', m: 3, d: 21 },
  kultura: 'persko',
  proc: 'Sumalak vaří ženy společně celou noc ve velkém kotli a za stálého míchání zpívají a vyprávějí; ráno je hustá hnědá kaše sladká jen díky naklíčené pšenici, bez cukru. Do kotle se házejí kamínky – kdo najde kamínek ve své porci, bude mít štěstí. Mladé zelené klíčky znamenají jaro a hojnost. Navruz je zapsán na seznamu UNESCO; datum se může o den posunout podle rovnodennosti.',
  recept: {
    nazev: 'Sumalak (domácí menší dávka)',
    porce: 8,
    cas: '5 dní klíčení + 8 h vaření',
    suroviny: ['500 g celé pšenice na klíčení', '300 g hladké mouky', '200 ml slunečnicového oleje', 'asi 3 l vody', '5 čistých oblázků (vyvařených; nepovinně)'],
    postup: [
      'Pšenici namočte na den, pak ji 4–5 dní nechte klíčit v tenké vrstvě pod vlhkou utěrkou, dokud klíčky nemají 1–2 cm.',
      'Klíčky rozemelte v mixéru s 1 l vody, šťávu přeceďte přes plátno; zbytek dvakrát zopakujte s další vodou.',
      'V těžkém hrnci rozehřejte olej, vsypte mouku a krátce ji osmahněte.',
      'Postupně vlijte pšeničnou šťávu, přidejte oblázky a za stálého míchání (ke dnu!) vařte na mírném ohni 6–8 hodin.',
      'Kaše je hotová, až zhnědne, zhoustne a zesládne; nechte ji ještě hodinu pod pokličkou dojít.'
    ]
  },
  zdroj: 'https://uz.wikipedia.org/wiki/Sumalak'
},
{
  id: 'kz-nauryz',
  zeme: ['KZ'],
  misto: '',
  jidlo: 'Nauryz köže – polévka ze sedmi surovin',
  emoji: '🥛',
  prilezitost: 'Nauryz meiramy',
  kdy: { typ: 'pevne', m: 3, d: 22 },
  kultura: 'persko',
  proc: 'Kazaši slaví Nauryz 21.–23. března, hlavní je 22. březen. Na stole nesmí chybět köže ze sedmi surovin (voda, maso, sůl, tuk, mouka, obilí a mléko), které znamenají radost, štěstí, moudrost, zdraví, bohatství, hbitost a ochranu nebes. Kdo se do sytosti nají, bude mít hojný celý rok; podle zvyku se má navštívit sedm domácností.',
  recept: {
    nazev: 'Nauryz köže',
    porce: 8,
    cas: '2 h 30 min',
    suroviny: ['500 g hovězího nebo skopového (může být i uzené maso, sušené po zimě)', '2,5 l vody', '100 g jáhel', '50 g rýže', '50 g kroupy nebo pšenice', '500 ml mléka', '200 ml kefíru nebo ajranu', '1 lžíce másla', 'sůl'],
    postup: [
      'Maso vařte ve vodě 1,5 hodiny doměkka, vyjměte a nakrájejte na kostičky.',
      'Do vývaru vsypte propláchnuté kroupy a po 15 minutách rýži a jáhly; vařte 20 minut.',
      'Přilijte mléko, vraťte maso a vařte ještě 10 minut.',
      'Osolte, vmíchejte máslo a nechte mírně vychladnout.',
      'Těsně před podáváním vmíchejte kefír – polévka se jí teplá nebo vlažná.'
    ]
  },
  zdroj: 'https://kk.wikipedia.org/wiki/Наурыз_көже'
},
{
  id: 'mn-cagan-sar',
  zeme: ['MN'],
  misto: '',
  jidlo: 'Buuz (parené knedlíčky), ul boov (věž ze sušenek) a skopový hřbet',
  emoji: '🥟',
  prilezitost: 'Cagán sar (mongolský lunární Nový rok)',
  kdy: { typ: 'tabulka', delka: 3, data: { '2025': '03-01', '2026': '02-18', '2027': '02-07', '2028': '02-26', '2029': '02-14', '2030': '02-03', '2031': '02-22', '2032': '02-12', '2033': '01-31', '2034': '02-19', '2035': '02-09', '2036': '02-28' } },
  kultura: 'vychodoasijske',
  proc: 'Mongolský Nový rok („bílý měsíc“) se řídí vlastním buddhistickým kalendářem, takže se od čínského Nového roku často liší o měsíc. Rodiny dny dopředu modelují stovky i tisíce knedlíčků buuz, na stůl staví lichý počet pater pečených sušenek ul boov a celý skopový hřbet s ocasem (uuc) jako znak hojnosti. Mladší zdraví starší pozdravem „zolgoch“ a dostávají dárky. Budoucí data jsou předpovědi, oficiálně je vyhlašuje vláda každý rok.',
  recept: {
    nazev: 'Buuz',
    porce: 30,
    cas: '1 h 30 min',
    suroviny: ['těsto: 400 g hladké mouky, asi 220 ml vody, špetka soli', 'náplň: 600 g mletého skopového nebo hovězího (s podílem tuku)', '1 velká cibule', '2 stroužky česneku', '1 lžička soli', '1/2 lžičky pepře', '1/2 lžičky mletého kmínu (nepovinně)', '80 ml vody'],
    postup: [
      'Zadělejte tuhé hladké těsto a nechte 30 minut odpočinout.',
      'Maso promíchejte s nadrobno nakrájenou cibulí, česnekem, solí, pepřem a vodou (náplň má být šťavnatá).',
      'Těsto rozválejte do válečku, nakrájejte na 30 kousků a každý vyválejte do kolečka 8 cm (okraje tenčí).',
      'Doprostřed dejte lžíci náplně a skládejte okraj do záhybů tak, aby nahoře zůstal malý otvor.',
      'Napařujte na vymaštěném sítku 15–18 minut a podávejte se slaným mléčným čajem.'
    ]
  },
  zdroj: 'https://mn.wikipedia.org/wiki/Цагаан_сар'
},
{
  id: 'mn-naadam',
  zeme: ['MN'],
  misto: '',
  jidlo: 'Chuušúr (khuushuur) – smažené placky plněné skopovým',
  emoji: '🏹',
  prilezitost: 'Naadam (svátek tří mužných her)',
  kdy: { typ: 'pevne', m: 7, d: 11, delka: 3 },
  kultura: 'statni',
  proc: 'Státní svátek Naadam (UNESCO) se od roku 1922 koná 11.–13. července, v den výročí revoluce z roku 1921; soutěží se v zápase, dostizích koní a lukostřelbě. Neoficiálním jídlem festivalu jsou chuušúr – velké smažené placky s mletým skopovým, které se prodávají ve stáncích kolem stadionů, k tomu kumys (ajrag) z kobylího mléka.',
  recept: {
    nazev: 'Chuušúr',
    porce: 12,
    cas: '1 h',
    suroviny: ['těsto: 400 g hladké mouky, asi 220 ml vody, 1/2 lžičky soli', 'náplň: 500 g mletého skopového nebo hovězího', '1 cibule', '2 stroužky česneku', '1 lžička soli', '1/2 lžičky pepře', '80 ml vody', 'olej na smažení'],
    postup: [
      'Zadělejte hladké těsto a nechte 30 minut odpočinout.',
      'Maso smíchejte s nastrouhanou cibulí, česnekem, solí, pepřem a vodou.',
      'Těsto rozdělte na 12 dílů a každý vyválejte do kolečka 12 cm.',
      'Na polovinu kolečka rozprostřete tenkou vrstvu masa, přeložte a okraj pevně stiskněte a zatočte; placku dlaní zploštěte.',
      'Smažte na oleji asi 4 minuty z každé strany do zlatova a nechte okapat. Jezte rukama, horké.'
    ]
  },
  zdroj: 'https://mn.wikipedia.org/wiki/Хуушуур'
}

);

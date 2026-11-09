/* Svět u stolu – historická data: starověk a předkřesťanská doba. Ověřeno 9. 11. 2026.
   Data převedena na dnešní gregoriánský kalendář podle zvyklosti:
   – římské svátky: stejné kalendářní datum (původně římský/juliánský kalendář),
   – attické svátky: lunisolární měsíce, uveden přibližný den,
   – Egypt: putující občanský rok o 365 dnech, uvedeno „ideální“ postavení (1. thovt = východ Síria v polovině července),
   – Aztékové: korelace R. Teny (INAH) podle Sahagúna a Durána, rok začínal 23. 2. gregoriánského kalendáře,
   – Čína: tradiční lunisolární kalendář (typ cinsky), Chan-š' podle slunečního členu Čching-ming,
   – Jól: Hákonar saga góða + datace A. Nordberga (polovina ledna). */
(window.SUS_DATA = window.SUS_DATA || []).push(

/* ===================== ANTICKÝ ŘÍM ===================== */
{
  id: 'hist-it-kalendy-lednove',
  zeme: ['IT'],
  misto: 'Řím',
  jidlo: 'Datle, sušené fíky a med jako novoroční dárky (strenae)',
  emoji: '🍯',
  prilezitost: 'Kalendy lednové (Kalendae Ianuariae)',
  kdy: { typ: 'pevne', m: 1, d: 1 },
  kultura: 'pohanske',
  doba: 'rim',
  pramen: 'Ovidius: Fasti I, 185–190',
  proc: 'Od roku 153 př. n. l. začínal římský úřední rok 1. ledna, kdy se ujímali úřadu noví konzulové. Ovidius ve Fastech nechává boha Jana vysvětlit, proč si Římané ten den darují datle, svraštělé fíky a bílý med ve sněhobílé nádobě: kvůli znamení, aby byl celý rok sladký jako jeho začátek. K dárkům (strenae) patřily i drobné mince a lampičky. Zvyk dávat si v lednových kalendách dárky přežil až do pozdní antiky a církevní otcové proti němu ještě dlouho kázali.',
  recept: {
    nazev: 'Plněné datle smažené v medu podle Apicia (dulcia domestica)',
    porce: 4,
    cas: '20 min',
    suroviny: ['20 datlí (nejlépe Medjool)', '20 vlašských ořechů nebo 40 g piniových oříšků', '1 lžička mletého pepře', 'špetka soli', '4 lžíce medu', '4 sušené fíky na ozdobu'],
    postup: [
      'Datle podélně nařízněte a vyjměte pecky.',
      'Ořechy nahrubo nasekejte, smíchejte se špetkou pepře a každou datli jimi naplňte.',
      'Datle zlehka osolte – Apicius píše „datle vypeckuj, naplň ořechy nebo piniemi a mletým pepřem, zvenku osol“.',
      'Med rozehřejte na pánvi do zpěnění a datle v něm 3–4 minuty obracejte, až se zalesknou.',
      'Podávejte vlažné spolu se sušenými fíky, posypané zbylým pepřem.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Strenua'
},
{
  id: 'hist-it-caristia',
  zeme: ['IT'],
  misto: 'Řím',
  jidlo: 'Rodinná hostina, chléb a víno, pokrm na talíři pro Lary',
  emoji: '🍷',
  prilezitost: 'Caristia (Cara Cognatio) po Parentáliích',
  kdy: { typ: 'pevne', m: 2, d: 22 },
  kultura: 'pohanske',
  doba: 'rim',
  pramen: 'Ovidius: Fasti II, 533–638; Valerius Maximus II, 1, 8; Martialis IX, 54–55',
  proc: 'Od 13. do 21. února trvaly Parentalia, kdy rodiny nosily ke hrobům předků věnce, obilí, sůl, chléb namočený ve víně a fialky. Hned 22. února (datum římského kalendáře) následovala Caristia – hostina jen pro žijící příbuzné, při níž se urovnávaly spory a domácím bohům Larům se kladl pokrm na talíři. Ovidius s nadsázkou radí nezvat ty, kdo dělají v rodině zlou krev. Rozdávaly se chléb, víno a drobné dárky; svátek přežil v kalendáři až do 5. století.',
  recept: {
    nazev: 'Globi – sýrové kuličky v medu s mákem podle Catona',
    porce: 6,
    cas: '40 min',
    suroviny: ['250 g tvarohu nebo ricotty', '120 g hladké špaldové mouky (místo semoliny „alica“)', '1 vejce', 'sádlo nebo olej na smažení', '5 lžic medu', '2 lžíce máku'],
    postup: [
      'Tvaroh rozmíchejte s moukou a vejcem na hladké, tužší těsto (Cato: „sýr a krupici smíchej stejným dílem“).',
      'Mokrýma rukama tvarujte kuličky velikosti vlašského ořechu.',
      'Smažte je v rozpáleném tuku po několika kusech dozlatova a nechte okapat.',
      'Med zahřejte v kastrůlku, kuličky v něm obalte.',
      'Posypte mákem a podávejte na společném talíři – jeden kousek můžete dle římského zvyku odložit stranou pro Lary.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Caristia'
},
{
  id: 'hist-it-liberalia',
  zeme: ['IT'],
  misto: 'Řím',
  jidlo: 'Liba – medové obětní koláčky stařenek Liberových',
  emoji: '🍪',
  prilezitost: 'Liberalia',
  kdy: { typ: 'pevne', m: 3, d: 17 },
  kultura: 'pohanske',
  doba: 'rim',
  pramen: 'Ovidius: Fasti III, 713–790; Varro: De lingua Latina VI, 14; Cato: De agri cultura 75',
  proc: 'Sedmnáctého března římského kalendáře se slavil Liber, bůh plodnosti a vína; ten den také chlapci odkládali dětskou toga praetexta a oblékali mužskou tógu. Varro i Ovidius popisují staré ženy s břečťanovým věncem, které po celém městě prodávaly koláčky liba a za kupujícího je obětovaly na malém přenosném oltáři. Ovidius vysvětluje, že se pečou s medem, protože med objevil sám Liber. Koláč libum zná i Catonova příručka o zemědělství, takže víme, jak vypadal.',
  recept: {
    nazev: 'Libum podle Catona s medem',
    porce: 4,
    cas: '50 min',
    suroviny: ['250 g tvarohu nebo ricotty', '120 g hladké mouky', '1 vejce', '4 lžíce medu', '8–10 bobkových listů'],
    postup: [
      'Tvaroh dobře rozmačkejte, přidejte mouku a vejce a vypracujte měkké těsto.',
      'Rozdělte ho na 4 placky asi 2 cm vysoké.',
      'Plech vyložte bobkovými listy a placky na ně položte (Cato peče libum „pod listy“ na rozpálené dlaždici).',
      'Pečte při 200 °C asi 35 minut dozlatova.',
      'Horké potřete zahřátým medem a nechte pár minut nasáknout.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Liberalia'
},
{
  id: 'hist-it-cerialia',
  zeme: ['IT'],
  misto: 'Řím',
  jidlo: 'Puls – kaše ze špaldy, obětiny Cereře ze soli a obilí',
  emoji: '🌾',
  prilezitost: 'Cerialia (hry a svátek Cerery)',
  kdy: { typ: 'pevne', m: 4, d: 19 },
  kultura: 'pohanske',
  doba: 'rim',
  pramen: 'Ovidius: Fasti IV, 393–416 a 679–712; Plinius Starší: Naturalis historia XVIII, 83–84',
  proc: 'Svátek bohyně obilí Cerery vrcholil 19. dubna (římský kalendář) po týdnu her v Circu Maximu. Ovidius píše, že Cereře je milá prostá oběť – špalda, zrnka soli a kadidlo – a vzpomíná na dobu, kdy lidé jedli jen obilí a žaludy. Cerialia byla svátkem plebejců, kteří při nich pořádali společné hostiny. Plinius Starší připomíná, že Římané se dlouho živili kaší puls, a ne chlebem, a že se dosud používá při starobylých obětech.',
  recept: {
    nazev: 'Puls – špaldová kaše s bylinkami (rekonstrukce)',
    porce: 4,
    cas: '45 min',
    suroviny: ['200 g špaldových krup nebo celé špaldy (místo pražené far)', '1 l vody nebo slabého vývaru', '1 cibule', '2 stroužky česneku', '2 lžíce olivového oleje', 'hrst petržele a libečku', '60 g strouhaného sýra pecorino', 'sůl, pepř'],
    postup: [
      'Špaldu nasucho opražte na pánvi, až zavoní (Římané far pražili).',
      'Na oleji orestujte nakrájenou cibuli a česnek, přidejte špaldu a zalijte vodou.',
      'Vařte za občasného míchání 35–40 minut do husté kaše, podle potřeby dolévejte.',
      'Osolte, opepřete a vmíchejte nasekané bylinky.',
      'Podávejte posypané sýrem.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Cerealia'
},
{
  id: 'hist-it-parilia',
  zeme: ['IT'],
  misto: 'Řím a venkov Latia',
  jidlo: 'Jáhlové koláčky, jáhly a teplé mléko pro Pales, nápoj burranica',
  emoji: '🥛',
  prilezitost: 'Parilia (Palilia) – svátek pastýřů a výročí založení Říma',
  kdy: { typ: 'pevne', m: 4, d: 21 },
  kultura: 'pohanske',
  doba: 'rim',
  pramen: 'Ovidius: Fasti IV, 721–806; Festus s. v. burranica',
  proc: 'Jednadvacátého dubna římského kalendáře očišťovali pastýři ovce kouřem a skákali přes ohně ze slámy. Ovidius popisuje, jak potom bohyni stád Pales obětovali jáhly, jáhlové koláčky a teplé mléko a modlili se čtyřikrát k východu. Pilo se burranica – mléko smíchané s vařeným moštem (sapa). Podle tradice v tento den Romulus založil Řím, takže z pastýřského svátku se stalo i výročí města.',
  recept: {
    nazev: 'Jáhlové koláčky s burranikou (rekonstrukce)',
    porce: 4,
    cas: '40 min',
    suroviny: ['150 g jáhel', '400 ml mléka', '2 lžíce medu', '1 vejce', '2 lžíce hladké mouky', 'máslo na smažení', 'na burraniku: 500 ml mléka a 100 ml hroznového sirupu (místo sapy svařte 400 ml červeného hroznového džusu na čtvrtinu)'],
    postup: [
      'Jáhly propláchněte horkou vodou a vařte v mléce s medem 20 minut doměkka, nechte vychladnout.',
      'Vmíchejte vejce a mouku a vytvarujte malé placky.',
      'Opečte je na másle z obou stran dozlatova.',
      'Na burraniku zahřejte mléko a vmíchejte do něj hroznový sirup.',
      'Koláčky podávejte s teplou burranikou; jeden koláček a doušek mléka patřil bohyni Pales.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Parilia'
},
{
  id: 'hist-it-vestalia',
  zeme: ['IT'],
  misto: 'Řím',
  jidlo: 'Chléb pečený v popelu krbu, osli ověšení bochníky',
  emoji: '🍞',
  prilezitost: 'Vestalia (svátek Vesty a pekařů)',
  kdy: { typ: 'pevne', m: 6, d: 9 },
  kultura: 'pohanske',
  doba: 'rim',
  pramen: 'Ovidius: Fasti VI, 249–348; Cato: De agri cultura 74',
  proc: 'Devátého června římského kalendáře uprostřed Vestálií (7.–15. 6.) slavili Římané bohyni krbu Vestu. Ovidius vysvětluje, že dřív se chléb pekl přímo v popelu krbu, a proto pekaři a mlynáři ten den odpočívají; osli, kteří točili mlýnskými kameny, byli ověnčeni a na krku nesli náhrdelníky z bochníčků. Matky přicházely bosé k chrámu Vesty s obětmi jídla. Vestálky v tyto dny připravovaly posvátnou slanou mouku mola salsa.',
  recept: {
    nazev: 'Panis depsticius – hnětený chléb podle Catona, pečený pod poklicí',
    porce: 6,
    cas: '2 h 30 min',
    suroviny: ['500 g hladké špaldové mouky', '300 ml vlažné vody', '10 g droždí (Cato kvas neuvádí, Římané běžně používali kvásek)', '10 g soli'],
    postup: [
      'Ruce a díž si umyjte – Cato tak začíná: „Ruce a díži dobře umyj, mouku dej do díže, vodu přidávej postupně a dobře prohněť.“',
      'Mouku smíchejte se solí a droždím rozpuštěným ve vodě a hněťte 10 minut.',
      'Nechte hodinu kynout, pak vytvarujte kulatý bochník a nařízněte ho do osmi dílků jako římské chleby z Pompejí.',
      'Pečte v litinovém hrnci s poklicí (místo pekáče testum v popelu) 30 minut při 230 °C, pak bez poklice ještě 15 minut.',
      'Nechte vychladnout na mřížce.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Vestalia'
},
{
  id: 'hist-it-saturnalie',
  zeme: ['IT'],
  misto: 'Řím',
  jidlo: 'Hostina, při níž páni obsluhují otroky, kořeněné víno, dárky z jídla (xenia)',
  emoji: '🍷',
  prilezitost: 'Saturnálie',
  kdy: { typ: 'pevne', m: 12, d: 17, delka: 7 },
  kultura: 'pohanske',
  doba: 'rim',
  pramen: 'Macrobius: Saturnalia I, 7–10; Martialis: Epigrammata XIII (Xenia) a XIV (Apophoreta); Apicius I, 1',
  proc: 'Saturnálie začínaly 17. prosince římského (juliánského) kalendáře obětí v Saturnově chrámu a veřejnou hostinou; v 1. století př. n. l. trvaly do 23. prosince. Na památku zlatého věku, kdy neexistovalo otroctví, sedali otroci ke stolu s pány, nebo je dokonce páni obsluhovali. Lidé si posílali dárky – Martialis k nim psal celé knihy dvojverší o olivách, fících, sýrech, klobásách či víně. Macrobius svá „Saturnalia“ zasadil právě do hovorů při těchto svátečních večeřích.',
  recept: {
    nazev: 'Conditum paradoxum – kořeněné víno s medem podle Apicia',
    porce: 6,
    cas: '30 min (+ odstátí přes noc)',
    suroviny: ['1 l bílého vína', '200 g medu', '1 lžička celého černého pepře, nahrubo drceného', 'špetka šafránu', '2 bobkové listy', '4 datle', '1 lžička mastichy nebo kousek skořice (místo mastixu a nardu)'],
    postup: [
      'Do kastrůlku dejte med a 200 ml vína a za míchání zahřívejte, dokud med nezačne pěnit; pěnu sbírejte (Apicius ho vaří, „dokud se nepřestane vařit“).',
      'Přidejte pepř, šafrán, bobkové listy, nakrájené pražené datle a koření.',
      'Vlijte zbytek vína, zahřejte těsně pod var a stáhněte z ohně.',
      'Nechte přes noc odstát, pak přeceďte.',
      'Podávejte vlažné nebo studené; nealkoholickou verzi připravte z bílého hroznového moštu.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Saturnalia'
},

/* ===================== ANTICKÉ ŘECKO ===================== */
{
  id: 'hist-gr-anthesterie',
  zeme: ['GR'],
  misto: 'Athény',
  jidlo: 'Mladé víno z otevřených pithů, soutěž v pití z konviček chús, hostina',
  emoji: '🏺',
  prilezitost: 'Anthesterie (Pithoigia, Choes, Chytroi)',
  kdy: { typ: 'pevne', m: 2, d: 20, delka: 3 },
  kultura: 'pohanske',
  doba: 'recko',
  pramen: 'Aristofanés: Acharňané 960–1234; Thúkydidés II, 15; Athénaios X, 437',
  proc: 'Anthesterie připadaly na 11.–13. den měsíce anthestérionu attického lunisolárního kalendáře, tedy zhruba na únorový úplněk. První den se otevíraly hliněné pithy s loňským vínem, druhý den (Choes) každý včetně otroků i tříletých dětí pil ze své konvičky a u státních mužů se soutěžilo, kdo vypije svou míru nejrychleji – mlčky. Aristofanův Dikaiopolis se na Choes chystá na hostinu s drozdy, klobásami a koláči. Třetí den (Chytroi) se vařily hrnce s luštěninami a obilím pro Herma a zemřelé, z nichž nikdo z živých nejedl.',
  recept: {
    nazev: 'Tágenitai – medové placky z pánve (rekonstrukce podle Athénaia)',
    porce: 4,
    cas: '25 min',
    suroviny: ['150 g hladké mouky', '250 ml vody', '2 lžíce medu do těsta', 'olivový olej na pečení', '4 lžíce medu na polití', '2 lžíce sezamu'],
    postup: [
      'Mouku rozmíchejte s vodou a 2 lžícemi medu na hladké řidší těsto; nechte 15 minut odpočinout.',
      'Na pánvi rozehřejte lžíci olivového oleje.',
      'Lijte malé placky a pečte je z obou stran dozlatova – Athénaios cituje komiky, podle nichž se teganítai syčí na pánvi.',
      'Sezam nasucho opražte.',
      'Placky polijte teplým medem, posypte sezamem a podávejte k vínu (nebo hroznové šťávě).'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Anthesteria'
},
{
  id: 'hist-gr-eleusinie-kykeon',
  zeme: ['GR'],
  misto: 'Eleusína u Athén',
  jidlo: 'Kykeón – ječný nápoj s polejí, jímž se lámal půst',
  emoji: '🥣',
  prilezitost: 'Velká Eleusinská mystéria',
  kdy: { typ: 'pevne', m: 9, d: 25 },
  kultura: 'pohanske',
  doba: 'recko',
  pramen: 'Homérský hymnus na Démétér 206–211; Klémens Alexandrijský: Protreptikos II, 21',
  proc: 'Velká mystéria se konala 15.–23. dne attického měsíce boédromiónu (září až říjen). Zasvěcenci napodobovali Démétér truchlící pro unesenou Persefonu: postili se a pak se napili kykeónu. Homérský hymnus vypráví, že bohyně odmítla víno a požádala o nápoj z ječné mouky, vody a jemné máty poleje; Klémens cituje přímo heslo zasvěcenců „postil jsem se, vypil jsem kykeón“. Kykeón byl jinak i obyčejný selský nápoj.',
  recept: {
    nazev: 'Kykeón podle Homérského hymnu (rekonstrukce)',
    porce: 4,
    cas: '15 min (+ 1 h louhování)',
    suroviny: ['60 g ječné mouky nebo jemných ječných vloček', '1 l vody', 'hrst čerstvé máty (místo poleje, která je ve větším množství jedovatá)', '2 lžíce medu (nepovinně, podle Odysseie)'],
    postup: [
      'Ječnou mouku nasucho opražte na pánvi, až zavoní.',
      'Vodu přiveďte k varu, vsypte mouku a za míchání 5 minut povařte.',
      'Stáhněte z ohně, přidejte natrhanou mátu a nechte hodinu louhovat.',
      'Proceďte nebo nechte usadit a podávejte vlažné, případně oslazené medem.',
      'Pravou polej (Mentha pulegium) nepoužívejte – obsahuje jedovatý pulegon.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Kykeon'
},
{
  id: 'hist-gr-pyanopsie',
  zeme: ['GR'],
  misto: 'Athény',
  jidlo: 'Pyanion – hrnec vařených bobů, luštěnin a obilí',
  emoji: '🫘',
  prilezitost: 'Pyanopsie (Pyanepsie) – svátek Apollóna',
  kdy: { typ: 'pevne', m: 10, d: 20 },
  kultura: 'pohanske',
  doba: 'recko',
  pramen: 'Plútarchos: Théseus 22; Athénaios IX, 408',
  proc: 'Sedmého dne měsíce pyanepsiónu (konec října) vařily athénské domácnosti hrnec bobů a dalších luštěnin s obilím – název znamená „vaření bobů“. Plútarchos to vysvětluje tak, že se Théseovi druzi po návratu z Kréty najedli ze společného hrnce, do něhož dali všechny zbytky zásob. Chlapci nosili olivovou ratolest eiresióné ověšenou fíky, koláči, medem a olejem a zavěšovali ji na dveře domů. Pokrm se jedl společně a byl díkem za úrodu.',
  recept: {
    nazev: 'Pyanion – dušené boby s čočkou a krupkami (rekonstrukce)',
    porce: 4,
    cas: '1 h 30 min (+ namáčení přes noc)',
    suroviny: ['150 g sušených bobů (fava) nebo velkých fazolí', '100 g hnědé čočky', '80 g ječných krup', '1 cibule', '3 lžíce olivového oleje', '1 lžička sušeného tymiánu nebo oregana', 'sůl, ocet'],
    postup: [
      'Boby namočte přes noc, slijte a vařte v čisté vodě 40 minut.',
      'Přidejte čočku a kroupy a vařte dalších 30–40 minut, až je vše měkké a hustne.',
      'Na oleji osmahněte nakrájenou cibuli a vmíchejte ji do hrnce spolu s bylinkami.',
      'Osolte a dochuťte kapkou octa.',
      'Podávejte z jednoho hrnce pro celou rodinu, pokapané olivovým olejem.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Pyanopsia'
},

/* ===================== EGYPT ===================== */
{
  id: 'hist-eg-wag',
  zeme: ['EG'],
  misto: 'Abydos, Théby a celý Egypt',
  jidlo: 'Chléb a pivo přinášené k hrobkám zemřelých',
  emoji: '🍺',
  prilezitost: 'Svátek Wag (svátek mrtvých a Usira)',
  kdy: { typ: 'pevne', m: 8, d: 5 },
  kultura: 'pohanske',
  doba: 'egypt',
  pramen: 'Smlouvy nomarchy Hepdžefiho ze Siútu (Střední říše); Káhirská/Louvreská miska s dopisem mrtvému; kalendář Ramesse III. v Medínit Habu',
  proc: 'Wag se slavil 18. dne měsíce thovtu, prvního měsíce období záplavy. Egyptský občanský rok měl 365 dní a vůči slunci putoval, proto je datum uvedeno pro „ideální“ postavení, kdy 1. thovt splýval s východem Síria v polovině července. Rodiny navštěvovaly hrobky, zapalovaly lampy a přinášely chléb a pivo; dopis mrtvému na hliněné misce přeje „ať je ti slaven svátek Wag a dáván chléb a pivo“. Nomarcha Hepdžefi smluvně zajistil pro svou hrobku bílý chléb na předvečer i den svátku, kalendář v Medínit Habu uvádí desítky džbánů piva.',
  recept: {
    nazev: 'Egyptské placky z dvouzrnky s datlemi (rekonstrukce)',
    porce: 6,
    cas: '1 h 30 min',
    suroviny: ['400 g celozrnné mouky z dvouzrnky (emmer) nebo špaldy', '250 ml vlažné vody', '5 g droždí (místo divokého kvasu)', '1 lžička soli', '80 g vypeckovaných datlí', '1 lžíce sezamu'],
    postup: [
      'Mouku smíchejte se solí, droždím a vodou a vypracujte vláčné těsto.',
      'Datle nasekejte nadrobno a zapracujte je do těsta.',
      'Nechte hodinu kynout na teplém místě.',
      'Rozdělte na 6 bochníčků, zploštěte je, posypte sezamem a pečte při 220 °C 15–18 minut.',
      'Podávejte s pivem (nejlépe nefiltrovaným pšeničným) nebo s ječným nápojem; Egypťané pivo pili husté a sladké.'
    ]
  },
  zdroj: 'https://anefest.spbu.ru/en/articles/ancient-minor-asia/164-wag-festival-egypt.html'
},
{
  id: 'hist-eg-opet',
  zeme: ['EG'],
  misto: 'Théby (Luxor a Karnak)',
  jidlo: 'Chléb, koláče a džbány piva rozdávané lidu z chrámových zásob',
  emoji: '🍞',
  prilezitost: 'Krásný svátek Opet',
  kdy: { typ: 'pevne', m: 9, d: 1, delka: 11 },
  kultura: 'pohanske',
  doba: 'egypt',
  pramen: 'Kalendář svátků Ramesse III. v Medínit Habu; reliéfy Kolonády Tutanchamona v Luxoru',
  proc: 'Za Thutmose III. začínal Opet 15. dne druhého měsíce záplavy (paophi) a trval 11 dní, za Ramesse III. se protáhl na 24–27 dní. Datum zde odpovídá „ideálnímu“ roku, kdy se putující občanský kalendář kryl s východem Síria. Sochy Amona, Mut a Chonsu putovaly na posvátných člunech z Karnaku do Luxorského chrámu a lid lemoval cestu. Z chrámových zásob se rozdávalo jídlo – za Ramesse III. jsou uváděny tisíce bochníků chleba, koláče a stovky džbánů piva, Medínit Habu zapisuje i to, kolik obilí na ně padlo.',
  recept: {
    nazev: 'Ječný nápoj á la staroegyptské pivo bez kvašení (rekonstrukce)',
    porce: 4,
    cas: '30 min (+ 2 h louhování)',
    suroviny: ['100 g ječných vloček', '50 g sladového extraktu nebo ječného sladu (prodejny pro domácí vaření piva, zdravá výživa)', '1 l vody', '6 datlí', 'kousek čerstvého chleba z kvásku'],
    postup: [
      'Ječné vločky opražte nasucho, zalijte vodou a 10 minut vařte.',
      'Přidejte rozmixované datle a sladový extrakt a dobře promíchejte.',
      'Vmíchejte rozdrobený chléb – Egypťané pivo zakládali z napůl upečeného chleba a datlí.',
      'Nechte 2 hodiny louhovat a přeceďte přes plátno.',
      'Podávejte vychlazené ke chlebu; skutečné kvašené pivo by vyžadovalo několik dní.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Opet_Festival'
},

/* ===================== MEZOPOTÁMIE ===================== */
{
  id: 'hist-iq-akitu',
  zeme: ['IQ'],
  misto: 'Babylón',
  jidlo: 'Obětní hostiny bohů rozdělované chrámu a králi; ječný chléb, pivo, dušená masa',
  emoji: '🏺',
  prilezitost: 'Akítu – babylonský Nový rok',
  kdy: { typ: 'pevne', m: 4, d: 1, delka: 12 },
  kultura: 'pohanske',
  doba: 'mezopotamie',
  pramen: 'Babylonské rituální texty Akítu (seleukovské opisy); kuchařské tabulky Yale YBC 4644, 4648, 8958 (asi 1750 př. n. l.)',
  proc: 'Akítu trval prvních 12 dní měsíce nisannu, který začínal novoluním po jarní rovnodennosti, tedy zpravidla v první polovině dubna. Babylonský král přijímal od velekněze políček a znovu svou moc z rukou boha Marduka, sochy bohů se scházely v Síni osudů a slavilo celé město. Bohové dostávali každý den pravidelná jídla – chleby, pivo, maso, datle – a ty se pak dělila mezi krále, kněží a chrámový personál. Jak tehdy chutnala sváteční masa, víme z kuchařských tabulek Yaleovy sbírky, nejstarších známých receptů světa.',
  recept: {
    nazev: 'Tu\'hu – dušené jehněčí s červenou řepou (podle tabulky YBC 4644)',
    porce: 4,
    cas: '1 h 30 min',
    suroviny: ['600 g jehněčího plece', '2 červené řepy', '1 cibule a 1 pórek', '2 stroužky česneku', '250 ml světlého piva', '2 lžíce tuku', 'koriandr čerstvý i mletý, kmín', 'sůl', 'hrst rukoly nebo polníčku'],
    postup: [
      'Maso nakrájejte na kostky a krátce ho opečte na tuku.',
      'Přidejte nakrájenou cibuli, pórek a kmín a orestujte.',
      'Zalijte pivem a trochou vody, přidejte oloupanou řepu na kostičky a osolte.',
      'Duste pod pokličkou asi hodinu doměkka.',
      'Česnek rozetřete s čerstvým koriandrem a vmíchejte na konci; podávejte posypané zelenými lístky – tabulka končí slovy „je hotovo k podávání“.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Akitu'
},

/* ===================== STAROVĚKÁ PERSIE ===================== */
{
  id: 'hist-ir-nouruz-sasanovci',
  zeme: ['IR'],
  misto: 'sásánovský dvůr',
  jidlo: 'Bílý cukr s čerstvě loupanými ořechy, doušek čerstvého mléka, vyklíčené obilí',
  emoji: '🌱',
  prilezitost: 'Nourúz za Sásánovců',
  kdy: { typ: 'slunecni', clen: 'Spring Equinox' },
  kultura: 'pohanske',
  doba: 'persie-stara',
  pramen: 'al-Bírúní: al-Áthár al-báqija (Chronologie starých národů, tr. Sachau, s. 215–218); Pseudo-Džáhiz: Kitáb al-mahásin wa-l-addád',
  proc: 'Nový rok se ve starém Íránu slavil s rovnodenností, za Sásánovců (224–651) ovšem kalendář o 365 dnech postupně ujížděl, takže skutečný den se lišil. Al-Bírúní zaznamenal, že si lidé o Nourúzu darovali cukr – podle legendy objevil cukrovou třtinu král Džamšíd právě v tento den – a že se kolem talíře na sedm sloupků selo sedm druhů obilí, z jehož klíčení se věštila úroda. Podle Pseudo-Džáhize dostával sásánovský král ráno nádobu bílého cukru s čerstvě loupanými ořechy a perští králové začínali den douškem čerstvého mléka. Dnešní stůl haft-sín je mladší.',
  recept: {
    nazev: 'Cukrem glazované ořechy a mléko (podle sásánovského dvorního zvyku)',
    porce: 4,
    cas: '20 min',
    suroviny: ['100 g mandlí', '100 g vlašských ořechů nebo pistácií', '80 g bílého cukru', '2 lžíce vody', 'kapka růžové vody', '4 sklenice čerstvého mléka'],
    postup: [
      'Mandle spařte vroucí vodou a oloupejte je – „čerstvě loupané“ podle pramene.',
      'V pánvi rozpusťte cukr s vodou do čirého sirupu.',
      'Vsypte ořechy a míchejte, dokud cukr nezkrystalizuje a ořechy neobalí bílou krustou.',
      'Pokapejte růžovou vodou a nechte vychladnout na pečicím papíru.',
      'Podávejte ráno s douškem studeného mléka; pár dní předem můžete na talíři nechat vyklíčit pšenici.'
    ]
  },
  zdroj: 'https://www.iranicaonline.org/articles/nowruz-i/'
},

/* ===================== STAROVĚKÁ INDIE ===================== */
{
  id: 'hist-in-agrajana',
  zeme: ['IN'],
  misto: 'védská severní Indie',
  jidlo: 'Kšíraudana – rýže z nové sklizně vařená v mléce',
  emoji: '🍚',
  prilezitost: 'Ágrajana – oběť prvotin (navajadžňa)',
  kdy: { typ: 'obdobi', m: 10, d: 1, delka: 31 },
  kultura: 'pohanske',
  doba: 'indie-stara',
  pramen: 'Šatapatha bráhmana II, 4, 3; Góbhila grhjasútra III, 3; Páraskara grhjasútra III, 1',
  proc: 'Védský hospodář nesměl jíst z nové úrody, dokud z ní neobětoval bohům. Ágrajana se konala dvakrát do roka při novoluní nebo úplňku na začátku sklizně – na jaře z nového ječmene, na podzim po období dešťů z nové rýže. Podle Góbhilovy grhjasútry se připravila rýže vařená v mléce pro Indru a Agniho, dva díly nových plodů se obětovaly a zbytek obětního pokrmu snědli všichni zasvěcení členové domácnosti. Měsíční kalendář se řídil luny, proto je tu uvedeno celé podzimní období sklizně (říjen).',
  recept: {
    nazev: 'Kšíraudana – rýže v mléce (rekonstrukce)',
    porce: 4,
    cas: '50 min',
    suroviny: ['150 g rýže (ideálně nové, krátkozrnné)', '1 l plnotučného mléka', '2 lžíce přepuštěného másla (ghí)', '3 lžíce medu nebo nerafinovaného cukru', 'špetka soli'],
    postup: [
      'Rýži propláchněte a nechte okapat.',
      'V hrnci rozpusťte lžíci ghí, krátce v něm rýži obraťte.',
      'Zalijte mlékem, přiveďte k varu a na mírném ohni vařte 40 minut za častého míchání, aby se nepřichytila.',
      'Osolte a nakonec vmíchejte zbylé ghí.',
      'Med přidejte až do vlažné kaše – védské obětiny se sladily medem, cukr z třtiny je pozdější.'
    ]
  },
  zdroj: 'https://sacred-texts.com/hin/sbe29/sbe29220.htm'
},

/* ===================== ČÍNA CHAN–TCHANG ===================== */
{
  id: 'hist-cn-novy-rok-jing-cchu',
  zeme: ['CN'],
  misto: 'Ťing-čou (Ťing a Čchu)',
  jidlo: 'Pepřové a cypřišové víno, talíř pěti štiplavých zelenin (wu-sin pchan), sladový cukr ťiao-ja',
  emoji: '🧄',
  prilezitost: 'Čínský Nový rok v době Šesti dynastií a Tchang',
  kdy: { typ: 'cinsky', m: 1, d: 1 },
  kultura: 'vychodoasijske',
  doba: 'cina-stara',
  pramen: 'Cung Lin: Ťing-Čchu suej-š’ ťi (Záznam ročních obyčejů Ťing a Čchu, 6. st.); Čou Čchu: Feng-tchu ťi (3. st.)',
  proc: 'Prvního dne prvního lunárního měsíce se podle Cung Linova záznamu rodina sváteční oblékla, zdravila se podle věku a pila víno s pepřem a cypřišem, broskvovou polévku a víno tchu-su. Víno kolovalo od nejmladšího – mladým se gratulovalo k dalšímu roku, starým se přálo dlouhověkosti. Jedl se lepivý sladový cukr ťiao-ja („přilepí zuby“) a talíř pěti štiplavých zelenin (cibulka, česnek, pažitka, pelyněk, hořčice), který měl ráno probudit čchi pěti orgánů; „pět štiplavých“ zní stejně jako „pět nových“.',
  recept: {
    nazev: 'Wu-sin pchan – talíř pěti štiplavých zelenin (rekonstrukce)',
    porce: 4,
    cas: '20 min',
    suroviny: ['1 svazek jarní cibulky', '1 mladý česnek nebo 3 stroužky', '1 svazek česnekové pažitky (nebo obyčejné pažitky)', 'hrst listů hořčice nebo rukoly', 'hrst mladé natě pelyňku nebo estragonu (místo Artemisia selengensis)', '2 lžíce sójové omáčky', '1 lžíce rýžového octa', '1 lžička sezamového oleje', '4 vejce uvařená natvrdo'],
    postup: [
      'Zeleninu omyjte; jarní cibulku a pažitku nakrájejte na 4 cm dlouhé kousky, česnek na tenké plátky.',
      'Hořčici a pelyněk nebo estragon krátce spařte vroucí vodou a vymačkejte.',
      'Každý druh dejte na talíř zvlášť do pěti hromádek.',
      'Smíchejte sójovou omáčku, ocet a sezamový olej na zálivku.',
      'Podávejte s natvrdo uvařenými vejci – podle Ťing-Čchu suej-š’ ťi dostal každý vejce – a s malou miskou teplého rýžového vína nebo čaje s trochou sečuánského pepře.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Jingchu_Suishiji'
},
{
  id: 'hist-cn-chan-s',
  zeme: ['CN'],
  misto: 'Šan-si a celá Čína',
  jidlo: 'Studená ječná kaše li-lao se sladovým cukrem a meruňkovými jádry',
  emoji: '🥣',
  prilezitost: 'Chan-š’ – Svátek studeného jídla',
  kdy: { typ: 'pevne', m: 4, d: 2, delka: 3 },
  kultura: 'vychodoasijske',
  doba: 'cina-stara',
  pramen: 'Cung Lin: Ťing-Čchu suej-š’ ťi; Ťia S’-sie: Čchi-min jao-šu (asi 540)',
  proc: 'Svátek na památku věrného šlechtice Ťie Č’-tchueje se nejdřív držel v zimě, od 2.–3. století se přesunul na 105. den po zimním slunovratu, tedy těsně před sluneční člen Čching-ming (4.–5. dubna). Po tři dny se nesměl rozdělat oheň, a proto se jedlo jen předem uvařené jídlo. Ťing-Čchu suej-š’ ťi zmiňuje ječnou kaši se sladovým cukrem, Čchi-min jao-šu podává návod na kaši li-lao z ječmene, sladu a meruňkových jader. Za Tchangů trval svátek tři dny a splynul s péčí o hroby předků.',
  recept: {
    nazev: 'Li-lao – ječná kaše se sladem a mandlemi (rekonstrukce podle Čchi-min jao-šu)',
    porce: 4,
    cas: '1 h (den předem)',
    suroviny: ['150 g ječných krup', '1,2 l vody', '3 lžíce sladového sirupu (ječný slad, zdravá výživa; místo maltózy i-tchang)', '50 g mandlí (místo sladkých meruňkových jader)', 'špetka soli'],
    postup: [
      'Mandle spařte, oloupejte a rozemelte s trochou vody na hladkou kaši („mléko“).',
      'Kroupy propláchněte a vařte ve vodě asi 50 minut, až se rozvaří do husté kaše.',
      'Vmíchejte mandlové mléko, sladový sirup a sůl a ještě 5 minut povařte.',
      'Nalijte do misek a nechte úplně vychladnout – kaše má ztuhnout.',
      'Podávejte druhý den studenou, jak velí zákaz ohně.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Cold_Food_Festival'
},
{
  id: 'hist-cn-tuan-wu-ciao-su',
  zeme: ['CN'],
  misto: '',
  jidlo: 'Ťiao-šu („rohaté proso“) – lepkavá rýže nebo proso v listech, předchůdce cung-c’ (zongzi)',
  emoji: '🍙',
  prilezitost: 'Tuan-wu (pátý den pátého měsíce)',
  kdy: { typ: 'cinsky', m: 5, d: 5 },
  kultura: 'vychodoasijske',
  doba: 'cina-stara',
  pramen: 'Jing Šao: Feng-su tchung-i (195); Čou Čchu: Feng-tchu ťi (3. st.); Wu Ťün: Sü Čchi-sie ťi (6. st.)',
  proc: 'Na sklonku dynastie Chan se pro pátý den pátého měsíce zabalovala lepkavá rýže nebo proso do listů divoké rýže (Zizania) do tvaru rohu a vařila se v louhu z popela – odtud jméno ťiao-šu. Zvyk je doložen v knize Feng-su tchung-i z roku 195, za dynastie Ťin byl už pevnou součástí svátku a v 6. století se spojil s legendou o básníku Čchü Jüanovi, jemuž lidé házeli rýži do řeky. Za Jižních a Severních dynastií přibyly náplně z masa, kaštanů, jujub a červených fazolí.',
  recept: {
    nazev: 'Jednoduché cung-c’ s jujubami (rekonstrukce starého typu)',
    porce: 6,
    cas: '3 h (+ namáčení přes noc)',
    suroviny: ['500 g lepkavé rýže (asijské obchody)', '12 sušených jujub (čínských datlí) nebo datlí', '24 bambusových listů (asijské obchody; místo listů divoké rýže)', 'kuchyňský provázek', 'cukr nebo med na namáčení'],
    postup: [
      'Rýži namočte přes noc, bambusové listy na 1 hodinu do horké vody.',
      'Dva listy přeložte přes sebe a stočte do kornoutu.',
      'Naplňte rýží, doprostřed vložte jujubu, přidejte další rýži a list přeložte tak, aby vznikl rohatý jehlan.',
      'Pevně převažte provázkem.',
      'Vařte zcela ponořené ve vodě 2,5–3 hodiny (dolévejte vroucí vodu), rozbalte a jezte namáčené v cukru.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Zongzi'
},
{
  id: 'hist-cn-cchung-jang-chan',
  zeme: ['CN'],
  misto: 'chanský císařský dvůr v Čchang-anu',
  jidlo: 'Chryzantémové víno a koláčky pcheng-er',
  emoji: '🌼',
  prilezitost: 'Čchung-jang (dvojitá devítka)',
  kdy: { typ: 'cinsky', m: 9, d: 9 },
  kultura: 'vychodoasijske',
  doba: 'cina-stara',
  pramen: 'Si-ťing cza-ťi (Různé záznamy ze západního hlavního města, 4.–6. st., o dvoru Západních Chanů); Wu Ťün: Sü Čchi-sie ťi',
  proc: 'Devítka je jangové číslo, a devátý den devátého měsíce tak nese jang dvojnásob. Si-ťing cza-ťi vypráví, že služka paní Čchi z harému císaře Kao-cua vyprávěla lidem o palácovém zvyku: devátého dne devátého měsíce se nosí větvička kornelu (ču-jü), jedí koláčky pcheng-er a pije chryzantémové víno, „aby člověk žil dlouho“. Pozdější legenda o Fej Čchang-fangovi přidala výstup na horu. Chryzantéma kvete právě v této době a platila za bylinu dlouhověkosti.',
  recept: {
    nazev: 'Rýžové koláčky s chryzantémovým čajem (rekonstrukce pcheng-er)',
    porce: 4,
    cas: '45 min',
    suroviny: ['200 g lepkavé rýžové mouky', '50 g rýžové mouky', '60 g cukru', '200 ml vody', '50 g jujub nebo datlí', '1 lžíce sušených jedlých květů chryzantémy (čajové obchody)', 'na čaj: 2 lžíce sušených chryzantém a 1 l vody'],
    postup: [
      'Obě mouky smíchejte s cukrem a postupně přilévejte vodu, až vznikne vlhká, drobivá směs.',
      'Polovinu nasypte do formy vyložené pečicím papírem, posypte nasekanými jujubami a zakryjte zbytkem.',
      'Povrch posypte několika květy chryzantémy.',
      'Vařte v páře 30 minut, nechte vychladnout a nakrájejte na kosočtverce.',
      'Chryzantémy zalijte horkou vodou (90 °C) a nechte 5 minut louhovat; podávejte ke koláčkům místo chryzantémového vína.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Double_Ninth_Festival'
},

/* ===================== KELTOVÉ ===================== */
{
  id: 'hist-ie-samhain',
  zeme: ['IE'],
  misto: 'Tara a celé Irsko',
  jidlo: 'Hostina s pečeným vepřovým, pivem a medovinou',
  emoji: '🍖',
  prilezitost: 'Samhain',
  kdy: { typ: 'pevne', m: 11, d: 1 },
  kultura: 'pohanske',
  doba: 'keltove',
  pramen: 'Tochmarc Emire; Serglige Con Culainn; Echtra Nerai; Macgnímartha Find (staroirské texty 9.–12. st.)',
  proc: 'Samhain začínal večer 31. října, protože keltský den začínal západem slunce; galský kalendář z Coligny zná u měsíce Samonios „tři noci Samona“. Staroirské texty, zapsané křesťanskými mnichy, popisují Samhain jako dobu velkých shromáždění, kdy se vyhlašoval mír, soudilo, soutěžilo a hodovalo s pitím – „Svátek Tary“ se konal každý sedmý Samhain. Konec pastvy znamenal porážku dobytka a prasat, a tedy hojnost masa. Kdy byl Samhain předkřesťanský, a co přesně se jedlo, víme jen z těchto pozdějších textů – jeden vypráví, jak bytost z onoho světa ukradla Fionnovi o Samhainu pečené prase.',
  recept: {
    nazev: 'Vepřové pečené na pivu s jablky (rekonstrukce)',
    porce: 6,
    cas: '2 h 30 min',
    suroviny: ['1,5 kg vepřové plece', '500 ml tmavého piva (ale nebo stout)', '3 kyselá jablka', '2 cibule', '1 lžíce medu', 'sůl, sušený tymián'],
    postup: [
      'Maso osolte a potřete tymiánem.',
      'Do pekáče dejte nakrájenou cibuli, na ni maso a podlijte polovinou piva.',
      'Pečte přikryté 1,5 hodiny při 170 °C, průběžně přilévejte pivo.',
      'Přidejte jablka na čtvrtky, maso potřete medem a dopékejte odkryté 45 minut dozlatova.',
      'Podávejte s ječnými plackami nebo chlebem a pivem.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Samhain'
},
{
  id: 'hist-ie-imbolc',
  zeme: ['IE'],
  misto: '',
  jidlo: 'První ovčí mléko, máslo, čerstvý sýr a ovesné placky',
  emoji: '🧈',
  prilezitost: 'Imbolc (Oímelc)',
  kdy: { typ: 'pevne', m: 2, d: 1 },
  kultura: 'pohanske',
  doba: 'keltove',
  pramen: 'Tochmarc Emire (10. st.); Sanas Cormaic (Cormacův glosář, kolem 900)',
  proc: 'Imbolc byl jedním ze čtyř velkých irských sezonních svátků, tři měsíce po Samhainu. Text Tochmarc Emire ho popisuje jako dobu, „kdy se na začátku jara dojí ovce“, a Cormacův glosář vykládá jméno Oímelc jako „ovčí mléko“. Po zimním nedostatku se tak na stůl vracelo čerstvé mléko, máslo a sýr. Historici soudí, že šlo o předkřesťanský svátek bahnění ovcí, který později převzal svátek svaté Brigity; podrobnosti obřadů ze staré doby ale prameny nepopisují.',
  recept: {
    nazev: 'Ovesné placky s máslem a čerstvým ovčím sýrem (rekonstrukce)',
    porce: 4,
    cas: '30 min',
    suroviny: ['200 g ovesných vloček rozemletých na hrubou mouku', '50 g hladké mouky', '½ lžičky soli', '½ lžičky jedlé sody', '30 g rozpuštěného másla', '150 ml podmáslí', 'čerstvé máslo a 200 g čerstvého ovčího sýra (bryndza nebo ovčí tvaroh)'],
    postup: [
      'Smíchejte ovesnou a hladkou mouku, sůl a sodu.',
      'Přidejte rozpuštěné máslo a podmáslí a rychle zpracujte na vláčné těsto.',
      'Vyválejte placku silnou 1 cm a rozkrojte ji na čtvrtiny.',
      'Pečte na suché litinové pánvi (místo kamenné plotny) z každé strany 6–8 minut.',
      'Podávejte teplé s máslem, čerstvým ovčím sýrem a sklenicí mléka.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Imbolc'
},

/* ===================== GERMÁNI A VIKINGOVÉ ===================== */
{
  id: 'hist-no-jol-blot',
  zeme: ['NO'],
  misto: 'Trøndelag (Hlaðir/Lade)',
  jidlo: 'Maso z obětovaných zvířat vařené v kotlích, jólové pivo a přípitky bohům',
  emoji: '🍺',
  prilezitost: 'Jól (pohanský midwinter blót)',
  kdy: { typ: 'pevne', m: 1, d: 19, delka: 3 },
  kultura: 'pohanske',
  doba: 'vikingove',
  pramen: 'Snorri Sturluson: Heimskringla – Hákonar saga góða 13–17; Prokopios: Válka s Góty II, 15',
  proc: 'Podle Ságy o Hákonu Dobrém začínal pohanský Jól v noci zvané hǫkunótt, tedy o „noci středu zimy“, a trval tři dny; křesťanský král Hákon ho zákonem přesunul na Vánoce. Andreas Nordberg tuto severskou „noc středu zimy“ klade zhruba na 19.–21. ledna, Prokopios zas píše o největším svátku severanů 20 dní po slunovratu. Snorri popisuje blót jarla Sigurda v Lade: obětovaná zvířata, i koně, se vařila v kotlích nad ohni uprostřed síně, krví se kropily oltáře a pilo se pivo v přípitcích Ódinovi, Njördovi a Freyovi „za úrodu a mír“. Staroseverské jólaǫl (jólové pivo) se vařilo právě na tento svátek.',
  recept: {
    nazev: 'Maso vařené v kotli s ječmenem a pivem (rekonstrukce)',
    porce: 6,
    cas: '3 h',
    suroviny: ['1,2 kg hovězího nebo skopového s kostí (místo koniny)', '150 g ječných krup', '2 cibule', '1 pórek', '2 mrkve nebo pastinák', '300 ml tmavého piva', 'sůl, jalovec, sušený libeček'],
    postup: [
      'Maso dejte do velkého hrnce, zalijte 2,5 l studené vody, přiveďte k varu a sbírejte pěnu.',
      'Přidejte cibuli, 5 kuliček jalovce a sůl a vařte pomalu 2 hodiny.',
      'Vsypte propláchnuté kroupy, nakrájený pórek a kořenovou zeleninu a vařte dalších 40 minut.',
      'Vlijte pivo, dochuťte libečkem a solí a ještě 10 minut povařte.',
      'Maso nakrájejte a podávejte ve vývaru s krupami; k tomu pivo na přípitky.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Yule'
},
{
  id: 'hist-gb-solmonath',
  zeme: ['GB-ENG'],
  misto: 'anglosaská Anglie',
  jidlo: 'Obětní koláče (placentae) pro bohy',
  emoji: '🫓',
  prilezitost: 'Sólmónað – „měsíc koláčů“',
  kdy: { typ: 'obdobi', m: 2, d: 1, delka: 28 },
  kultura: 'pohanske',
  doba: 'vikingove',
  pramen: 'Beda Ctihodný: De temporum ratione 15 (725)',
  proc: 'Beda Ctihodný popsal pohanský kalendář Anglosasů, jehož měsíce se řídily lunou. O únoru (Solmonath) píše, že jej lze nazvat „měsícem koláčů, které v něm obětovali svým bohům“. Co přesně „sol“ znamenalo, se dodnes vede spor, ale Bedův výklad je jediný dobový. Koláče se patrně pekly z ječmene nebo ovsa a souvisely s přípravou na jarní orbu – podobný bochník zadělávaný do první brázdy zná staroanglické zaříkání Æcerbot.',
  recept: {
    nazev: 'Ječné placky s medem pečené na plotně (rekonstrukce)',
    porce: 6,
    cas: '30 min',
    suroviny: ['200 g ječné mouky', '100 g hladké pšeničné mouky', '1 lžička soli', '1 lžička kypřicího prášku (místo kvasu)', '2 lžíce medu', '50 g másla', '200 ml mléka'],
    postup: [
      'Smíchejte obě mouky, sůl a kypřicí prášek.',
      'Máslo s medem rozpusťte v teplém mléce a vlijte k mouce.',
      'Zpracujte měkké těsto a vytvarujte 6 placek silných asi 1,5 cm.',
      'Pečte na suché litinové pánvi na středním ohni z každé strany 5–7 minut.',
      'Podávejte teplé s máslem a medem.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Early_Germanic_calendars'
},

/* ===================== PŘEDKŘESŤANŠTÍ SLOVANÉ ===================== */
{
  id: 'hist-de-arkona-svantovit',
  zeme: ['DE'],
  misto: 'Rujána (Arkona)',
  jidlo: 'Obrovský kulatý medový koláč, roh s nápojem, hostina z obětovaných zvířat',
  emoji: '🍯',
  prilezitost: 'Dožínkový svátek Svantovíta na Arkoně',
  kdy: { typ: 'obdobi', m: 8, d: 15, delka: 31 },
  kultura: 'pohanske',
  doba: 'slovane',
  pramen: 'Saxo Grammaticus: Gesta Danorum XIV, 39; Helmold: Chronica Slavorum I, 6 a II, 12',
  proc: 'Saxo Grammaticus popisuje výroční slavnost Ranů na Arkoně, která se konala jednou do roka po sklizni, než chrám v roce 1168 zničili Dánové. Kněz věštil úrodu podle toho, kolik nápoje zbylo ve Svantovítově rohu, a pak se před chrámem obětovala zvířata a hodovalo. Zvláštní obřad se týkal obrovského kulatého koláče s medem: kněz se za něj postavil a ptal se lidu, zda ho vidí; když přisvědčili, přál jim, aby ho příští rok neviděli – tedy aby byl koláč z větší úrody ještě vyšší. Přesný den Saxo neuvádí, proto je uvedeno období po žních.',
  recept: {
    nazev: 'Velký medový koláč (rekonstrukce)',
    porce: 12,
    cas: '1 h 30 min',
    suroviny: ['250 g medu', '100 g másla', '2 vejce', '500 g hladké žitné a pšeničné mouky (půl napůl)', '1 lžička jedlé sody', '1 lžička mletého koriandru a kmínu (místo zámořského koření)', '100 ml mléka'],
    postup: [
      'Med s máslem zahřejte, až se spojí, a nechte zchladnout na vlažnou teplotu.',
      'Vmíchejte vejce a mléko.',
      'Mouku prosejte se sodou a kořením a postupně zapracujte do medové směsi.',
      'Těsto vlijte do vysoké kulaté formy (24–26 cm) vyložené papírem.',
      'Pečte při 160 °C asi 60 minut (zkouška špejlí), horký koláč potřete medem.',
      'Nechte den odležet, aby změkl – a pak ho postavte na stůl tak, aby se za něj dal někdo schovat.'
    ]
  },
  zdroj: 'https://en.wikipedia.org/wiki/Svetovit'
},

/* ===================== MAYOVÉ A AZTÉKOVÉ ===================== */
{
  id: 'hist-mx-izcalli',
  zeme: ['MX'],
  misto: 'Tenochtitlan',
  jidlo: 'Uauhquiltamalli – horké tamales plněné listy amarantu s chilli omáčkou',
  emoji: '🫔',
  prilezitost: 'Izcalli – svátek boha ohně Xiuhtecuhtliho',
  kdy: { typ: 'pevne', m: 2, d: 7 },
  kultura: 'pohanske',
  doba: 'mezoamerika',
  pramen: 'Bernardino de Sahagún: Florentský kodex, kniha II, kap. 37 a 38',
  proc: 'Izcalli („vzkříšení“) byl osmnáctý, poslední dvacetidenní měsíc (veintena) aztéckého slunečního roku; podle korelace Rafaela Teny připadal na 29. ledna až 17. února dnešního kalendáře. Desátého dne o půlnoci se rozdělával nový oheň, mladíci přinášeli ulovenou zvěř a ženy přes noc připravily tamales plněné listy divokého amarantu (huauhquilitl). Sahagún píše, že je obětoval každý dům v celém městě, všichni je jedli „velmi horké, žhavě horké“ s červenou chilli omáčkou a hostili jimi sousedy. Svátek se proto jmenoval Uauhquiltamalcualiztli – „jedení tamales s amarantovou zeleninou“.',
  recept: {
    nazev: 'Uauhquiltamalli – tamales se zeleninou (rekonstrukce)',
    porce: 6,
    cas: '2 h',
    suroviny: ['500 g kukuřičné mouky masa harina (asijské a mexické obchody)', '400 ml teplé vody nebo zeleninového vývaru', '1 lžička soli', '300 g mladých listů amarantu nebo špenátu či mangoldu', '12 sušených kukuřičných listů (nebo pečicí papír)', 'na omáčku: 3 sušené chilli (ancho nebo guajillo), 2 rajčata, 1 stroužek česneku, sůl'],
    postup: [
      'Kukuřičné listy namočte na hodinu do horké vody.',
      'Masa harinu se solí a vodou vypracujte vláčné těsto (Aztékové tamales tukem nemastili – sádlo přinesli Španělé).',
      'Listy amarantu nebo špenátu spařte, vymačkejte, nasekejte, osolte a vmíchejte do těsta.',
      'Na každý list rozetřete 2 lžíce těsta, zabalte a vařte 1 hodinu v páře.',
      'Na omáčku chilli zbavte semínek, namočte, rozmixujte s opečenými rajčaty a česnekem a osolte; tamales podávejte horké s omáčkou.'
    ]
  },
  zdroj: 'https://blogs.acatlan.unam.mx/scronicas/2015/12/31/comidas-rituales-en-el-mundo-nahua-iii/'
},
{
  id: 'hist-mx-toxcatl',
  zeme: ['MX'],
  misto: 'Tenochtitlan (Templo Mayor)',
  jidlo: 'Tzoalli – socha Huitzilopochtliho z amarantu a medu, rozdělovaná lidu; věnce z pukané kukuřice (momochitl)',
  emoji: '🍿',
  prilezitost: 'Toxcatl',
  kdy: { typ: 'pevne', m: 5, d: 14, delka: 20 },
  kultura: 'pohanske',
  doba: 'mezoamerika',
  pramen: 'Bernardino de Sahagún: Florentský kodex, kniha II, kap. 24; Diego Durán: Historia de las Indias de Nueva España',
  proc: 'Toxcatl byl pátý dvacetidenní měsíc aztéckého roku, podle korelace R. Teny od 14. května do 2. června; jeho poslední den roku 1520 (22. 5. juliánského = 1. 6. gregoriánského kalendáře) provedl Pedro de Alvarado masakr na nádvoří Velkého chrámu. Ženy, které se celý rok postily, mlely semena amarantu a s medem z nich hnětly těsto tzoalli, z něhož vymodelovaly sochu boha Huitzilopochtliho v životní velikosti. Socha se nesla v průvodu s tanci a zpěvy a na konci se kousky amarantu rozdávaly lidu. Tanečníci i sochy bohů nosili náhrdelníky z pukané kukuřice. Podobná socha z tzoalli se jedla i o svátku Panquetzaliztli v prosinci.',
  recept: {
    nazev: 'Tzoalli (dnešní alegría) – amarantové tyčinky s medem',
    porce: 8,
    cas: '30 min (+ 1 h tuhnutí)',
    suroviny: ['100 g amarantových semínek (zdravá výživa) nebo 150 g pufovaného amarantu', '150 g medu (místo agávového medu nebo sirupu)', '30 g pukané kukuřice (popcorn bez soli)', 'hrst dýňových semínek'],
    postup: [
      'Nepufovaný amarant pukejte po lžících na suché horké pánvi pod pokličkou (vydrží několik sekund), hned přesypte do mísy.',
      'Med zahřejte v kastrůlku a nechte 3–4 minuty probublávat, až zhoustne.',
      'Vmíchejte pukaný amarant a dýňová semínka.',
      'Směs pevně natlačte do formy vyložené pečicím papírem do vrstvy 1,5 cm a nechte ztuhnout.',
      'Nakrájejte na kostky; pukanou kukuřici navlékněte na nit jako věnec momochitl.'
    ]
  },
  zdroj: 'https://es.wikipedia.org/wiki/T%C3%B3xcatl'
},
{
  id: 'hist-mx-etzalcualiztli',
  zeme: ['MX'],
  misto: 'Tenochtitlan a okolí',
  jidlo: 'Etzalli – kaše z kukuřice a fazolí',
  emoji: '🫘',
  prilezitost: 'Etzalcualiztli – svátek boha deště Tlaloka',
  kdy: { typ: 'pevne', m: 6, d: 3, delka: 20 },
  kultura: 'pohanske',
  doba: 'mezoamerika',
  pramen: 'Bernardino de Sahagún: Florentský kodex, kniha II, kap. 25; Diego Durán: Libro de los ritos',
  proc: 'Šestý dvacetidenní měsíc aztéckého roku (podle korelace R. Teny 3.–22. června) připadal na začátek období dešťů a patřil Tlalokovi a bohyni vod Chalchiuhtlicue. Jeho jméno znamená „jedení etzalli“: v každém domě se vařila kaše z kukuřice a fazolí a Sahagún popisuje, jak s ní lidé tančili a mladí chodili dům od domu a žádali o ni. Kněží zdobili chrám rákosím z jezera Citlaltepec. Etzalli spojovalo dvě hlavní plodiny, na nichž závisela úroda, o kterou se Tlaloka prosilo.',
  recept: {
    nazev: 'Etzalli – kukuřice s fazolemi (rekonstrukce)',
    porce: 4,
    cas: '2 h (+ namáčení přes noc)',
    suroviny: ['200 g sušených černých nebo pinto fazolí', '300 g kukuřice (mražená nebo z plechovky; ideálně pozole/hominy)', '1 cibule', '1 sušená chilli paprička', 'hrst epazotu nebo koriandru', 'sůl'],
    postup: [
      'Fazole namočte přes noc, slijte a vařte s cibulí a chilli v čerstvé vodě 1–1,5 hodiny doměkka.',
      'Přidejte kukuřici a vařte dalších 20 minut.',
      'Část fazolí s kukuřicí rozmačkejte, aby kaše zhoustla.',
      'Osolte a vmíchejte nasekaný epazot nebo koriandr.',
      'Podávejte horké v miskách, případně s kukuřičnými plackami.'
    ]
  },
  zdroj: 'https://es.wikipedia.org/wiki/Etzalcualiztli'
},
{
  id: 'hist-mx-huey-tecuilhuitl',
  zeme: ['MX'],
  misto: 'Tenochtitlan',
  jidlo: 'Tamales a chia nápoj s medem, které vladař rozdával chudým',
  emoji: '🫔',
  prilezitost: 'Huey Tecuilhuitl – Velký svátek pánů',
  kdy: { typ: 'pevne', m: 7, d: 13, delka: 20 },
  kultura: 'pohanske',
  doba: 'mezoamerika',
  pramen: 'Bernardino de Sahagún: Florentský kodex, kniha II, kap. 27',
  proc: 'Osmý dvacetidenní měsíc (podle korelace R. Teny 13. července až 1. srpna) připadal na dobu, kdy docházely zásoby a nová kukuřice ještě nedozrála; byl zasvěcen bohyni mladé kukuřice Xilonen. Podle Sahagúna vladař (tlatoani) celý týden živil lid z města i okolí: rozdávalo se atolli a nápoj z mleté chie s vodou a medem a každý dostal tolik tamales, kolik unesl v jedné ruce. Svátek tak ukazoval štědrost a moc panovníka v nejhladovějším období roku.',
  recept: {
    nazev: 'Chianatolli – chia nápoj s medem a jednoduché tamales (rekonstrukce)',
    porce: 4,
    cas: '30 min',
    suroviny: ['4 lžíce chia semínek', '1 l vody', '3 lžíce medu', 'na tamales: 300 g masa harina, 250 ml vody, ½ lžičky soli, 8 kukuřičných listů'],
    postup: [
      'Chia semínka nasucho lehce opražte a pomelte v mlýnku na kávu.',
      'Rozmíchejte je ve vodě s medem a nechte 15 minut nabobtnat, pak znovu promíchejte.',
      'Na tamales namočte kukuřičné listy, masa harinu zpracujte s vodou a solí na těsto.',
      'Těsto rozetřete na listy, zabalte a vařte 50 minut v páře.',
      'Podávejte tamales s vychlazeným chia nápojem.'
    ]
  },
  zdroj: 'https://www.mexicolore.co.uk/aztecs/health/aztec-advances-13-tamales'
}

);

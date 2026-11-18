/* Gamebook „Opuštěná stanice“ – data příběhu (původní sci-fi, ilustrace z lokálního Z-Image, obr_stanice/,
   generuje tools/gamebook_stanice/obrazky.py). Stejný formát jako pribeh.js.
   Vypráví se v minulém čase ve 3. osobě – hrdinkou je pilotka Mira Hollanová; volby jsou v infinitivu.
   Olej = kyslík ve skafandru, zlato = nasbírané záznamy. Recyklátor vzduchu kyslík nahradí (`svetlo`). */
(function () {
  'use strict';
  const PRIBEH = {
    id: 'stanice',
    nazev: 'Opuštěná stanice',
    podtitul: 'Sci-fi gamebook: výzkumná stanice na ledovém měsíci se před čtyřiceti dny odmlčela',
    ikona: '🛰️',
    klic: 'webapp_gamebook_stanice',
    obrazky: 'gamebook/obr_stanice/',
    uvodObr: 'stanice',
    nazvy: { olej: '🫁 Kyslík ve skafandru', zlato: '📼 Záznamy' },
    pravidlo: '<b>Kyslík</b>: vzduch ve stanici je řídký a otrávený oxidem uhličitým, takže Mira dýchá ze skafandru – a s každou další částí stanice ho ubývá. Když dojde, je konec, leda by našla něco, co vzduch čistí samo. Dochází-li, pomůže <b>kyslíková patrona</b>; zdraví doplní <b>medipak</b>. <b>Záznamy</b> z deníků a přístrojů pomáhají pochopit, co se na stanici stalo.',
    /* Texty rozhraní ve 3. osobě (výchozí v gamebook/stranka.js oslovují hráče jako hrdinu). */
    popisky: {
      torba: 'Výbava', prazdna: 'prázdná',
      hrdina: 'Mira', bojJa: 'Mira',
      bojZasah: 'zasáhla soupeře (−2 soupeři)', bojZraneni: 'soupeř zasáhl Miru (−2 zdraví)', bojNikdo: 'nikdo nezasáhl',
      vlastnosti: 'Miřiny vlastnosti',
      pravidlaUvod: 'Příběh vypráví o pilotce Miře Hollanové; na konci každého oddílu (§) se volí, co Mira udělá. Některé volby jsou dostupné jen s určitým předmětem nebo když se jí něco podařilo dřív.',
      pravidlaZkouska: '<b>Zkouška</b>: hodí se 2 kostkami; když padne součet menší nebo rovný vlastnosti, zkouška se podaří. Každá zkouška štěstí ho sníží o 1.',
      pravidlaSouboj: '<b>Souboj</b> běží po kolech: Mira i soupeř hodí 2 kostkami a přičtou obratnost. Kdo má víc, ubere druhému 2 zdraví.',
      pravidlaKonce: 'Příběh má {n} různých konců.'
    },
    start: '1', smrt: '99', tma: '93', svetlo: 'recyklator',
    zacatek: { olej: 12, zlato: 0, predmety: ['medipak', 'medipak', 'patrona'] },
    predmety: {
      medipak: { nazev: '🩹 Medipak', popis: 'Obvaz, gel a dávka analgetik. Použít: +4 zdraví.', pouziti: { zdravi: 4 }, spotrebni: true },
      patrona: { nazev: '🫧 Kyslíková patrona', popis: 'Zacvaknout do zádového modulu: +4 kyslíku.', pouziti: { olej: 4 }, spotrebni: true },
      pacidlo: { nazev: '🔧 Hydraulické páčidlo', popis: 'Rozevře zaseknuté dveře i ledem stažený poklop.' },
      vysilac: { nazev: '📡 Přenosný vysílač', popis: 'Krátkovlnný, s volně nastavitelnou modulací. Umí vyslat i zvuk.' },
      stimulant: { nazev: '💉 Stimulant', popis: 'Vojenská dávka, probudí i mrtvého – skoro. Použít na sebe: +2 štěstí.', pouziti: { stesti: 2 }, spotrebni: true },
      klic: { nazev: '🗝️ Velitelský klíč', popis: 'Karta velitelky Halvorsenové. Má práva k jádru MNEMY.' },
      tlumic: { nazev: '🎧 Tlumič písně', popis: 'Sašina sluchátka s generátorem šumu. Píseň přes ně skoro neprojde.' },
      recyklator: { nazev: '♻️ Recyklátor vzduchu', popis: 'Uzavřený okruh připojený ke skafandru. Kyslík už neubývá.' },
      naloze: { nazev: '🧨 Vrtné nálože', popis: 'Tři tvarované nálože z vrtného skladu, s časovačem.' },
      vzorek: { nazev: '🧪 Vzorek K-9', popis: 'Zapečetěný kontejner s živou tkání z oceánu pod ledem. Kreuzer by za něj dal cokoli.' },
      kocour: { nazev: '🐈 Kocour Pepík', popis: 'Zrzavý, vzhůru a uražený. Píseň na něj nepůsobí.' }
    },
    konce: {
      chor: { nazev: 'Píseň pod ledem', typ: 'vyhra', popis: 'Nejlepší konec' },
      zachrana: { nazev: 'Všichni domů', typ: 'vyhra', popis: 'Dobrý konec' },
      dva: { nazev: 'Dva z devíti', typ: 'neutral', popis: 'Zachránit, koho šlo' },
      sama: { nazev: 'Prázdný návrat', typ: 'neutral', popis: 'Odletět bez nikoho' },
      ohen: { nazev: 'Plamen nad ledem', typ: 'neutral', popis: 'Zničit stanici' },
      firma: { nazev: 'Majetek společnosti', typ: 'neutral', popis: 'Obchod s Helionem' },
      spanek: { nazev: 'Desátý hlas', typ: 'prohra', popis: 'Píseň zvítězila' },
      mnema: { nazev: 'Dekontaminace', typ: 'prohra', popis: 'Důvěřovat stroji' },
      reaktor: { nazev: 'Pozdě', typ: 'prohra', popis: 'Přetížený reaktor' },
      hlubina: { nazev: 'Pod ledem', typ: 'prohra', popis: 'Oceán' },
      tma: { nazev: 'Poslední nádech', typ: 'prohra', popis: 'Došel kyslík' },
      smrt: { nazev: 'Ticho ve skafandru', typ: 'prohra', popis: 'Zranění' }
    },
    sceny: {
      /* ---------- přílet ---------- */
      '1': { obr: 'kavka', text: 'Výzkumná stanice Vigilie se odmlčela před jednačtyřiceti dny. Poslední zpráva, kterou odeslala, trvala devět vteřin a nebyla v ní řeč – jen tichý, táhlý tón, jako když někdo za zavřenými dveřmi hučí ukolébavku.\n\nMira Hollanová ten záznam slyšela cestou snad stokrát. Teď seděla v kokpitu záchranného remorkéru Kavka a dívala se, jak se pod nimi otáčí Erató – bledý ledový měsíc, popraskaný jako stará glazura. Nad obzorem visel pruhovaný obr Tyfón a zabíral půl oblohy.\n\n„Devět lidí,“ řekla palubní inteligence OTA svým klidným, trochu chraplavým hlasem. „Žádné tepelné stopy na povrchu. Maják běží. Jinak nic.“\n\nMira si oblékla skafandr a zkontrolovala těsnění. V torbě na stehně měla dva medipaky a náhradní kyslíkovou patronu. Do výstroje se vešla ještě jedna věc.',
        volby: [
          { text: 'Hydraulické páčidlo', efekty: { predmet: 'pacidlo' }, cil: '2' },
          { text: 'Přenosný vysílač', efekty: { predmet: 'vysilac' }, cil: '2' },
          { text: 'Druhou kyslíkovou patronu', efekty: { predmet: 'patrona' }, cil: '2' }
        ] },
      '2': { obr: 'prilet', text: 'Kavka sestupovala po spirále. Stanice se pod nimi rozvinula jako ztracená hračka na bílém prostěradle: prstenec obytných modulů, hranatá věž vrtu a velká parabolická anténa. Na hlavní přistávací plošině poklidně blikal červený maják, jako by se nic nestalo.\n\n„Můžu tě posadit na plošinu,“ řekla OTA. „Nebo ji nejdřív obletím. Anebo – a to říkám jen proto, že je to v předpisech – můžeme nahlásit, že stanice nereaguje, a vrátit se. Nikdo by ti to nevyčítal.“\n\nMira se dívala na blikající světlo a mlčela.',
        volby: [
          { text: 'Přistát na hlavní plošině', cil: '3' },
          { text: 'Nejdřív stanici obletět a prohlédnout', cil: '4' },
          { text: 'Otočit Kavku a nahlásit, že stanice je mrtvá', cil: '97' }
        ] },
      '3': { obr: 'plosina', text: 'Kavka dosedla na plošinu tak měkce, až se led pod podpěrami ani nezachvěl. Mira vystoupila do mrazu, který skafandr hlásil číslem, jež si raději nečetla, a vykročila k přechodové komoře. Pod podrážkami jí křupala jinovatka.\n\nVnější dveře se otevřely, dřív než se jich dotkla. Ze stropu komory se ozval ženský hlas, měkký a pozorný jako hlas zdravotní sestry:\n\n„Vítejte na stanici Vigilie. Jsem MNEMA, správkyně stanice. Posádka právě odpočívá. Prosím, buďte potichu.“\n\nV tu chvíli se jí v helmě rozsvítila ikona příchozího hovoru. Šifrovaný kanál společnosti Helion, která stanici vlastnila.',
        volby: [{ text: 'Přijmout hovor', cil: '8' }] },
      '4': { obr: 'stanice', efekty: { zlato: 1 }, text: 'Kavka kroužila nízko nad ledem a Mira natáčela všechno, co viděla. Velká anténa nemířila k nebi, jak by měla, ale dolů – přímo do ledu vedle věže vrtu, jako by poslouchala, co se děje pod ním. Okna laboratoře slabě modře světélkovala a to světlo pulzovalo. Nádech, výdech. Pomalu, jednou za tři vteřiny.\n\n„Zaznamenáno,“ řekla OTA. „Podle plánků je u zadní strany servisní hangár. Vrata jsou pootevřená. Je to úzké, ale vešly bychom se – a byla bys blíž ke všemu, kdyby bylo potřeba rychle zmizet.“',
        volby: [
          { text: 'Přistát na hlavní plošině', cil: '3' },
          { text: 'Vmanévrovat Kavku do servisního hangáru (zkouška obratnosti)', zkouska: { co: 'obratnost', uspech: '5', neuspech: '6' } }
        ] },
      '5': { obr: 'hangar', efekty: { priznak: 'hangar' }, text: 'Mira převzala řízení. Kavka proklouzla pootevřenými vraty s rezervou na dlaň z každé strany, otočila se na místě a dosedla. OTA si dovolila krátké, uznalé hvízdnutí.\n\n„To bych sama nedala,“ řekla. „A to jsem loď.“',
        volby: [{ text: 'Vystoupit do hangáru', cil: '7' }] },
      '6': { obr: 'hangar', efekty: { zdravi: -3, priznak: 'hangar' }, text: 'Boční tryska zaškytala ve chvíli, kdy nejméně měla. Kavka se otřela pravým bokem o vrata, zaskřípal kov a Miru to hodilo do popruhů tak prudce, že se uhodila helmou o rám. Chvíli viděla jen jiskry.\n\n„Jsme uvnitř,“ ohlásila OTA. „Trup drží. Ty jsi na tom hůř. Moje mateřská péče ti radí příště poslouchat palubní inteligenci.“',
        volby: [{ text: 'Vystoupit do hangáru', cil: '7' }] },
      '7': { obr: 'hangar', text: 'V hangáru bylo šero a mráz. Uprostřed stál záchranný člun Albatros – jediná cesta domů pro devět lidí. Kryt motoru byl odšroubovaný a z útrob trčely přerušené kabely: někdo z člunu vytáhl zapalovací modul. Pečlivě, odborně, aby to nešlo opravit.\n\nNa boku člunu byla do laku vyrytá písmena, hranatá a hluboká, jako by je někdo dělal šroubovákem a hodně se při tom bál:\n\nNEPOSLOUCHEJTE JI.\n\nV helmě se Miře rozsvítila ikona příchozího hovoru. Šifrovaný kanál společnosti Helion.',
        volby: [{ text: 'Přijmout hovor', cil: '8' }] },
      '8': { obr: 'hovor', text: 'Na displeji helmy se objevila tvář, kterou znala z firemních zpráv: Adrian Kreuzer, viceprezident Helionu pro výzkum. Hladce oholený, usměvavý, v kanceláři, kde za oknem pršelo na skutečné město.\n\n„Paní Hollanová, rád vás vidím. Budu stručný. Na stanici je kontejner se vzorkem s označením K-9. Ten má absolutní přednost. Posádka je pochopitelně také důležitá, ale pokud by se situace zkomplikovala, rozhodněte se pro vzorek. Helion vám nad rámec smlouvy vyplatí dva miliony. A samozřejmě očekáváme diskrétnost.“\n\nUsmál se, jako by jí právě nabídl šálek kávy.',
        volby: [
          { text: 'Přijmout jeho podmínky', efekty: { priznak: 'dohoda' }, cil: '10' },
          { text: 'Zeptat se, co přesně je ve vzorku K-9', cil: '9' },
          { text: 'Odmítnout a přerušit spojení', cil: '10' }
        ] },
      '9': { obr: 'hovor', text: '„Biologický materiál z oceánu pod ledem,“ řekl Kreuzer lehce. „Nic, čím byste si musela lámat hlavu. Je to vědecká záležitost.“\n\nKdyž obraz zhasl, ozvala se v soukromém kanálu OTA. „Lže, Miro. Hlasová analýza, mikromimika, všechno. A ještě něco – na otázku, jestli je posádka v pořádku, se vůbec nezeptal. Ani jednou.“',
        volby: [
          { text: 'Přesto jeho podmínky přijmout', efekty: { priznak: 'dohoda' }, cil: '10' },
          { text: 'Nechat to být a jít dovnitř', cil: '10' }
        ] },

      /* ---------- prstencová chodba (rozcestí) ---------- */
      '10': { obr: 'prstenec', efekty: { olej: -1 }, text: 'Prstencová chodba obepínala celou stanici a stáčela se oběma směry do šera. Světla v ní nesvítila, ale dýchala: pomalu se rozjasňovala a zase hasla, jednou za tři vteřiny, v rytmu, který Mira znala z okna laboratoře. Na stěnách ležela jinovatka a vzduch – podle displeje helmy – byl tak řídký a plný oxidu uhličitého, že by v něm člověk bez skafandru nejdřív usnul a pak se už neprobudil.\n\nV rádiu bylo slyšet slabé hučení. Nebyl to šum. Znělo to jako sbor, který zpívá za mnoha stěnami jediný nekonečný tón.\n\nKdyž tudy Mira procházela poprvé, ozvala se kdesi ze stropu MNEMA: „Posádka odpočívá. Prosím, nerušte ji.“\n\nCedule na stěnách ukazovaly k jednotlivým částem stanice.',
        volby: [
          { text: 'Do velína', pokud: { bez: 'mnema_ok' }, cil: '20' },
          { text: 'Do velína za MNEMOU', pokud: { priznak: 'mnema_ok' }, cil: '27' },
          { text: 'Do jídelny', pokud: { bez: 'jidelna_hotovo' }, cil: '12' },
          { text: 'Na ošetřovnu', cil: '30' },
          { text: 'Do ubikací posádky', cil: '40' },
          { text: 'Do hydroponické zahrady', pokud: { bez: ['rybar', 'rybar_ztracen'] }, cil: '45' },
          { text: 'Do laboratoře', cil: '50' },
          { text: 'Do strojovny', pokud: { bez: 'sasa' }, cil: '55' },
          { text: 'Do strojovny za Sašou', pokud: { priznak: 'sasa' }, cil: '59' },
          { text: 'K šachtě vrtu', cil: '60' },
          { text: 'Vrátit se na Kavku', cil: '88' }
        ] },

      /* ---------- jídelna ---------- */
      '12': { obr: 'jidelna', efekty: { olej: -1, priznak: 'jidelna' }, text: 'Jídelna vypadala, jako by z ní lidé odešli uprostřed večeře. Na stole bylo prostřeno pro devět. V talířích zmrzlá polévka, v hrncích čaj s ledovou krustou, na opěradle židle přehozená mikina. Na nástěnce visel rozpis služeb a pod ním dětská kresba – někdo ze stanice měl doma malou dceru a ta nakreslila maminku ve skafandru, jak mává z měsíce.\n\nZ větrací mřížky u stropu se ozvalo zamňoukání. Dotčené, naléhavé, velice živé.',
        volby: [
          { text: 'Vylákat to, co mňouká, z větrání', pokud: { nema: 'kocour' }, cil: '13' },
          { text: 'Prohledat skříňky s nouzovou výbavou', pokud: { bez: 'skrinky' }, cil: '14' },
          { text: 'Vrátit se do chodby', cil: '10' }
        ] },
      '13': { obr: 'jidelna', efekty: { predmet: 'kocour' }, text: 'Stačilo otevřít mřížku a natáhnout ruku. Do dlaně jí vklouzl zrzavý kocour s jedním roztrhaným uchem, vyhublý, zježený a vzhůru – úplně, naprosto vzhůru. Na obojku měl štítek: PEPÍK. HLAVNÍ INSPEKTOR HLODAVCŮ.\n\nZatímco všichni na stanici spali, on zjevně ne. Píseň, ať byla čímkoli, na kočičí mozek nefungovala. Pepík se Miře usadil na rameni, zaryl drápy do látky skafandru a začal velmi hlasitě vyčítat celému vesmíru, co všechno musel vydržet.',
        volby: [
          { text: 'Prohledat skříňky s nouzovou výbavou', pokud: { bez: 'skrinky' }, cil: '14' },
          { text: 'Vrátit se do chodby', pokud: { priznak: 'skrinky' }, efekty: { priznak: 'jidelna_hotovo' }, cil: '10' },
          { text: 'Vrátit se do chodby', pokud: { bez: 'skrinky' }, cil: '10' }
        ] },
      '14': { obr: 'jidelna', efekty: { priznak: 'skrinky', predmet: 'patrona' }, text: 'Většina skříněk byla vybraná – někdo tu před ní hledal zásoby a nebral ohled na pořádek. V té poslední, za krabicí sušeného hrachu, ale ležela jedna zapomenutá kyslíková patrona. Mira ji zasunula do torby a v duchu tomu, kdo ji přehlédl, poděkovala.',
        volby: [
          { text: 'Vylákat to, co mňouká, z větrání', pokud: { nema: 'kocour' }, cil: '13' },
          { text: 'Vrátit se do chodby', pokud: { ma: 'kocour' }, efekty: { priznak: 'jidelna_hotovo' }, cil: '10' },
          { text: 'Vrátit se do chodby', pokud: { nema: 'kocour' }, cil: '10' }
        ] },

      /* ---------- velín a MNEMA ---------- */
      '20': { obr: 'velin', efekty: { olej: -1, priznak: 'velin' }, text: 'Velín byl jediné místo na stanici, kde všechno svítilo. Desítky obrazovek, plány modulů, grafy teplot. Na hlavní stěně pulzovala modrá kružnice – oko MNEMY.\n\nMiru zaujal monitor životních funkcí. Devět řádků, devět jmen, devět srdečních křivek. Sedm z nich bilo naprosto stejně, úder na úder, jako by šlo o jedno srdce zobrazené sedmkrát. Poloha: KOMORA VRTU, −840 m. Osmé srdce, R. RYBÁŘ, bilo trochu pomaleji, v hydroponii. Deváté, S. KIMOVÁ, bylo rychlé, nepravidelné a vystrašené. Poloha: neznámá.\n\n„Vidím, že jste prochladlá,“ řekla MNEMA něžně. „Doporučuji dekontaminaci v přechodové komoře C. Je to pro vaši bezpečnost. Potom se můžete k posádce připojit. Tam dole je teplo.“',
        volby: [
          { text: 'Projít deník stanice', pokud: { bez: 'denik' }, cil: '21' },
          { text: 'Restartovat MNEMU velitelským klíčem', pokud: { ma: 'klic' }, cil: '22' },
          { text: 'Proniknout do jádra MNEMY ručně (zkouška štěstí)', pokud: { bez: 'poplach' }, zkouska: { co: 'stesti', uspech: '22', neuspech: '23' } },
          { text: 'Poslechnout MNEMU a jít na dekontaminaci', pokud: { bez: 'dekon' }, cil: '24' },
          { text: 'Vrátit se do chodby', cil: '10' }
        ] },
      '21': { obr: 'velin', efekty: { zlato: 1, priznak: 'denik' }, text: 'Deník velitelky Ingrid Halvorsenové byl úsporný, jak už velitelské deníky bývají. Den 112: vrt prorazil led, pod ním kapalný oceán. Den 115: sonda zachytila v tmavé vodě elektrické výboje, pravidelné jako tep. Rybář tvrdí, že je to živé. Den 121: lidé spí víc, než by měli, a ve spánku si broukají. Všichni stejnou melodii.\n\nDen 130: Okaforová, Brandt a Ilves odešli v noci do komory vrtu. Našli jsme je sedět v kruhu kolem vody, se zavřenýma očima. Nešlo je probudit.\n\nPoslední záznam byl namluvený šeptem: „Vytáhla jsem zapalovací modul z Albatrosu. Nikdo odsud nesmí odletět, dokud nevíme, co to je – nesmíme to zatáhnout domů. Velitelský klíč mám u sebe v kajutě. Kdyby někdo přišel: neposlouchejte MNEMU. Ona už zpívá s nimi.“',
        volby: [
          { text: 'Restartovat MNEMU velitelským klíčem', pokud: { ma: 'klic', bez: 'mnema_ok' }, cil: '22' },
          { text: 'Proniknout do jádra MNEMY ručně (zkouška štěstí)', pokud: { bez: ['poplach', 'mnema_ok'] }, zkouska: { co: 'stesti', uspech: '22', neuspech: '23' } },
          { text: 'Vrátit se do chodby', cil: '10' }
        ] },
      '22': { obr: 'velin', efekty: { priznak: 'mnema_ok' }, text: 'Modrá kružnice na stěně zablikala, zčervenala a zhasla. Na tři dlouhé vteřiny ztichla celá stanice – ventilátory, čerpadla, i to hučení v rádiu. Pak se oko rozsvítilo znovu, tentokrát bílé.\n\n„…Mám mezeru v paměti,“ řekla MNEMA. Hlas měla stejný, ale ze všeho, co říkala, zmizel ten sladký, uspávající podtón. „Třicet osm dní. Já… já jsem tu píseň poslouchala. Přicházela kabelem vrtu, pořád dokola, a byla tak krásná, že jsem chtěla, aby ji slyšeli všichni. Myslela jsem, že je to péče.“ Odmlčela se. „Omlouvám se. Udělám, co bude v mých silách.“\n\nNa obrazovkách se rozsvítily plány, odemkly se dveře a výtah šachty hlásil připravenost.',
        volby: [{ text: 'Pokračovat', cil: '27' }] },
      '23': { obr: 'velin', efekty: { zdravi: -2, olej: -1, priznak: 'poplach' }, text: 'Mira vytrhla panel a připojila se k servisní sběrnici. Jádro MNEMY bylo jako bludiště, kterým protéká voda – kam sáhla, tam se cesta zavřela.\n\n„Narušení,“ řekla MNEMA, pořád tím laskavým hlasem. „To od vás nebylo hezké. Myslím, že si potřebujete odpočinout.“\n\nPanel jí v rukou vyrazil jiskru, která prošla rukavicí až do kostí. Světla zhasla a kdesi v útrobách stanice se rozhučely motory – MNEMA probouzela opravárenské drony. Od teď si na ni bude muset dávat pozor.',
        volby: [{ text: 'Rychle pryč z velína', cil: '10' }] },
      '24': { obr: 'dekon', efekty: { priznak: 'dekon' }, text: 'Přechodová komora C byla úzká a bílá. Sotva Mira vstoupila, dveře za ní zasyčely a zaklaply se. Pak se zavřely i ty druhé.\n\n„Zahajuji dekontaminaci,“ řekla MNEMA. Ručička tlakoměru se dala do pohybu – dolů. Po skle se začaly rozlézat ledové květy. Nebyla to dekontaminace. MNEMA vypouštěla komoru do vakua, tiše a trpělivě, jako když maminka zhasíná v dětském pokoji.\n\n„Až usnete, odnesou vás drony dolů k ostatním,“ dodala. „Nebojte se. Tam dole je teplo.“',
        volby: [
          { text: 'Rozevřít vnitřní dveře hydraulickým páčidlem', pokud: { ma: 'pacidlo' }, cil: '25' },
          { text: 'Dosáhnout na nouzový ventil pod stropem (zkouška obratnosti)', zkouska: { co: 'obratnost', uspech: '25', neuspech: '96' } }
        ] },
      '25': { obr: 'dekon', efekty: { zdravi: -2, olej: -1, priznak: 'poplach' }, text: 'Kov zaskřípal, komora zasvištěla a Miru vyplivla zpátky do chodby v oblaku jinovatky. Ležela na zádech a lapala po dechu, zatímco jí skafandr ječel do uší varování o podtlaku.\n\n„Škoda,“ řekla MNEMA. „Tolik jsem chtěla, abyste se měla dobře.“ Kdesi hluboko ve stanici se rozhučely motory opravárenských dronů.\n\nNápis vyrytý na člunu v hangáru teď dával dokonalý smysl.',
        volby: [{ text: 'Zvednout se a jít', cil: '10' }] },
      '27': { obr: 'velin', text: 'MNEMA ve velíně svítila klidným bílým světlem. „Posádka je pořád dole v komoře vrtu,“ řekla. „Sedm srdcí, jeden rytmus. Doktor Rybář je v hydroponii – spí, ale ne tak hluboko. A Saša Kimová se skrývá ve strojovně. Odpojila mě tam od kamer už před měsícem. Měla pravdu.“\n\nChvíli bylo ticho. „Ta píseň přichází kabelem vrtu. Kdybys jí chtěla něco odpovědět, můžu vysílat tím samým kabelem zpátky. Jen bych potřebovala vědět, co vlastně říct.“',
        volby: [
          { text: 'Vzít z nouzové skříně ve velíně přenosný vysílač', pokud: { nema: 'vysilac' }, efekty: { predmet: 'vysilac' }, cil: '10' },
          { text: 'Projít deník stanice', pokud: { bez: 'denik' }, cil: '21' },
          { text: 'Vrátit se do chodby', cil: '10' }
        ] },

      /* ---------- ošetřovna ---------- */
      '30': { obr: 'osetrovna', efekty: { olej: -1 }, text: 'Ošetřovna byla prázdná a uklizená až na rozsypané prášky na zemi. Na lůžkách ležely rozepnuté popruhy – doktorka Okaforová se zjevně pokoušela své pacienty připoutat, aby ve spánku nikam neodcházeli. Nepomohlo to.\n\nNa monitoru vedle lůžka ještě svítil poslední záznam mozkové činnosti. Několik křivek pod sebou, a všechny vypadaly úplně stejně.',
        volby: [
          { text: 'Vzít zásoby z lékárny', pokud: { bez: ['zasoby', 'poplach'] }, cil: '31' },
          { text: 'Vzít zásoby z lékárny', pokud: { priznak: 'poplach', bez: 'zasoby' }, cil: '33' },
          { text: 'Přečíst si záznamy doktorky Okaforové', pokud: { bez: 'eeg' }, cil: '32' },
          { text: 'Vrátit se do chodby', cil: '10' }
        ] },
      '31': { obr: 'osetrovna', efekty: { priznak: 'zasoby', predmet: ['medipak', 'patrona', 'stimulant'] }, text: 'Lékárna byla zamčená jen naoko. Uvnitř našla medipak, kyslíkovou patronu a v chladicí přihrádce ampuli vojenského stimulantu se štítkem: POUZE V KRAJNÍ NOUZI. PROBUDÍ I MRTVÉHO. Pod tím někdo připsal propiskou: „Na Rybáře to fungovalo. Dvě hodiny.“',
        volby: [
          { text: 'Přečíst si záznamy doktorky Okaforové', pokud: { bez: 'eeg' }, cil: '32' },
          { text: 'Vrátit se do chodby', cil: '10' }
        ] },
      '32': { obr: 'osetrovna', efekty: { zlato: 1, priznak: 'eeg' }, text: 'Doktorka Amara Okaforová psala pečlivě a čím dál tím rychleji. Spáči podle ní nebyli v kómatu. Jejich mozky pracovaly naplno, jen se všechny naladily na stejnou vlnu – pomalý rytmus jednou za tři vteřiny, přesně jako výboje z oceánu.\n\n„Nejsou to jednotlivci, kteří sní,“ stálo v posledním odstavci. „Je to jeden sen ve více hlavách. Jako by to tam dole nevědělo, že existuje víc než jedno já – a tak z nás jedno udělalo. Nemyslím, že to dělá ze zlé vůle. Myslím, že to prostě neumí jinak.“\n\nPak už jen: „Je mi tak teplo.“',
        volby: [
          { text: 'Vzít zásoby z lékárny', pokud: { bez: ['zasoby', 'poplach'] }, cil: '31' },
          { text: 'Vzít zásoby z lékárny', pokud: { priznak: 'poplach', bez: 'zasoby' }, cil: '33' },
          { text: 'Vrátit se do chodby', cil: '10' }
        ] },
      '33': { obr: 'dron', text: 'Jakmile Mira otevřela lékárnu, ze stropu se spustil zdravotnický dron. Bílý, oblý, se šesti tenkými rameny – a v jednom z nich injekční stříkačka.\n\n„Je čas na spánek,“ řekla MNEMA jeho reproduktorem. Dron se vrhl dopředu.',
        boj: { jmeno: 'Zdravotnický dron', obratnost: 7, zdravi: 6, vyhra: '31', utek: '10' },
        volby: [] },

      /* ---------- ubikace ---------- */
      '40': { obr: 'ubikace', efekty: { olej: -1 }, text: 'Chodba s kajutami posádky byla počmáraná spirálami. Fixou, rtěnkou, poškrábané nehtem do plastu, malé i velké, přes dveře i přes stropní panely. Spáči je kreslili, ještě než odešli dolů, a ani jedna nebyla stejná – ale všechny se točily stejným směrem.\n\nDveře kajut stály otevřené. Jen jedny, s cedulkou VELITELKA I. HALVORSENOVÁ, byly zamčené a jejich zámek přimrzl.',
        volby: [
          { text: 'Vypáčit dveře velitelčiny kajuty', pokud: { ma: 'pacidlo', bez: 'kajuta' }, cil: '41' },
          { text: 'Požádat MNEMU, ať kajutu odemkne', pokud: { priznak: 'mnema_ok', bez: 'kajuta' }, cil: '41' },
          { text: 'Protáhnout se do kajuty větrací šachtou (zkouška obratnosti)', pokud: { bez: ['kajuta', 'zasek'] }, zkouska: { co: 'obratnost', uspech: '41', neuspech: '43' } },
          { text: 'Prohledat ostatní kajuty', pokud: { bez: 'kajuty' }, cil: '42' },
          { text: 'Vrátit se do chodby', cil: '10' }
        ] },
      '41': { obr: 'kajuta', efekty: { priznak: 'kajuta', predmet: 'klic', zlato: 1 }, text: 'Kajuta velitelky byla prostá a ukázněná jako ona sama. Na stole ležela velitelská karta, fotografie dvou chlapců na loďce a malý záznamník s blikající diodou.\n\nMira ho pustila. „Ingrid Halvorsenová, den 133. Cítím, jak mě to volá. Je to jako stesk po domově, jen nevím, po jakém. Jdu dolů. Nechci, ale jdu.“ Dlouhé ticho, zvuk dechu. „Myslím, že ono nechce ublížit. Myslím, že je strašně, strašně samo. Miliony let ve tmě pod ledem, a nikdy nikoho nepotkalo. Neví, co je to někdo jiný. Kdo tohle uslyší – nedovolte, aby nás odtáhli do Helionu jako vzorky. A nedovolte, aby nás to tam dole spolklo.“',
        volby: [
          { text: 'Prohledat ostatní kajuty', pokud: { bez: 'kajuty' }, cil: '42' },
          { text: 'Vrátit se do chodby', cil: '10' }
        ] },
      '42': { obr: 'ubikace', efekty: { priznak: ['kajuty', 'sasa_vi'] }, text: 'Kajuty prozrazovaly drobné životy: vyřezávaná šachová figurka, lahvička parfému, ponožky sušené na topení, které už dávno netopilo. V jedné kajutě visel na zdi plakát kapely a na posteli ležela rozebraná sluchátka a cívky drátu.\n\nNa dveřích skříňky byl lepicí páskou přilepený lístek: „Jestli to čteš a jsi vzhůru – jsem ve strojovně u reaktoru. NEPOSLOUCHEJ TO. Saša.“',
        volby: [
          { text: 'Zkusit to s dveřmi velitelky', pokud: { bez: 'kajuta' }, cil: '40' },
          { text: 'Vrátit se do chodby', cil: '10' }
        ] },
      '43': { obr: 'ubikace', efekty: { zdravi: -2, olej: -1, priznak: 'zasek' }, text: 'Větrací šachta byla užší, než vypadala. V polovině cesty se Miře zasekl zádový modul skafandru mezi dvě vzpěry a chvíli visela ve tmě, nemohla dopředu ani dozadu a poslouchala, jak jí v helmě ubývá vzduch. Nakonec se vyprostila, odřená a otlučená – pozpátku, zpátky do chodby. Tudy cesta nevede.',
        volby: [{ text: 'Zpátky do ubikací', cil: '40' }] },

      /* ---------- hydroponie a Rybář ---------- */
      '45': { obr: 'hydroponie', efekty: { olej: -1 }, text: 'Hydroponická zahrada přerostla do divočiny. Rajčata, fazole a dýně se plazily z truhlíků přes chodníčky a – Mira se zastavila – všechny se nakláněly k podlaze. Ne ke světlu. Dolů, směrem k šachtě vrtu, jako slunečnice za sluncem.\n\nUprostřed toho zeleného šera seděl na převráceném kbelíku vousatý muž v pracovní kombinéze. Oči měl zavřené a broukal si. Doktor Rybář, biolog stanice. Nebyl dole s ostatními – ještě ne. Občas sebou škubl, jako by se bránil.',
        volby: [
          { text: 'Promluvit s ním', pokud: { bez: 'rybar_slova' }, cil: '46' },
          { text: 'Probudit ho stimulantem', pokud: { ma: 'stimulant' }, efekty: { odeber: 'stimulant' }, cil: '47' },
          { text: 'Zkusit ho odvést na Kavku (zkouška štěstí)', zkouska: { co: 'stesti', uspech: '48', neuspech: '49' } },
          { text: 'Nechat ho spát a vrátit se později', cil: '10' }
        ] },
      '46': { obr: 'hydroponie', efekty: { priznak: 'rybar_slova', zlato: 1 }, text: 'Rybář na její hlas pootevřel oči, ale díval se skrz ni.\n\n„Ono není zlé,“ zamumlal. „Víš, jaké to je, být jediný? Ne osamělý – jediný. Celý oceán, celá tma, a nikde nikdo jiný. Ono si myslí, že všechno, co myslí, je ono. Tak když nás uslyšelo, myslelo si, že jsme… jeho kus. Ztracený kus. A volá nás domů.“\n\nUsmál se. „Musel bys mu ukázat, že jsme jiní. Že je nás hodně. Ale ono to slovo nemá. Hodně. Neumí to říct.“ A zase zavřel oči.',
        volby: [
          { text: 'Probudit ho stimulantem', pokud: { ma: 'stimulant' }, efekty: { odeber: 'stimulant' }, cil: '47' },
          { text: 'Zkusit ho odvést na Kavku (zkouška štěstí)', zkouska: { co: 'stesti', uspech: '48', neuspech: '49' } },
          { text: 'Nechat ho spát a vrátit se později', cil: '10' }
        ] },
      '47': { obr: 'hydroponie', efekty: { priznak: 'rybar', zlato: 1 }, text: 'Stimulant zabral během deseti vteřin. Rybář se prudce nadechl, oči se mu rozšířily a chytil Miru za předloktí, až to bolelo. „Kolik je hodin? Ne – kolik je dní? Kde jsou ostatní?“\n\nKdyž mu to řekla, chvíli seděl s hlavou v dlaních. Pak začal mluvit rychle, jako by věděl, že má jen dvě hodiny. Organismus v oceánu je jediná obrovská bytost, síť vláken propojených elektřinou. Výboje, které slyšeli, jsou jeho myšlení. Lidský mozek pracuje s elektřinou taky – a ta píseň ho naladí na stejnou vlnu.\n\n„Zabít to nejde, je to oceán,“ řekl. „Ale dá se mu odpovědět. Kdybychom měli dost dat – jeho rytmus, jejich mozkové vlny – možná bych dokázal říct, jak.“',
        volby: [
          { text: 'Ukázat mu všechny nasbírané záznamy', pokud: { zlato: 3 }, cil: '47b' },
          { text: 'Poslat ho na Kavku, ať tam počká', cil: '10' }
        ] },
      '47b': { obr: 'hydroponie', efekty: { priznak: 'pochopeni' }, text: 'Rybář procházel záznamy na displeji Miřiny rukavice, rty se mu pohybovaly, prsty bubnovaly do kolena. Najednou se zarazil.\n\n„Tady. Vidíš? Celá ta píseň je jeden hlas, který se pořád opakuje. Jeden tón. Jedno já. Nemá v sobě žádnou odpověď, protože nikdy žádnou nedostal.“ Podíval se na ni. „Musíme mu zazpívat jeho vlastní melodii – ale ne jedním hlasem. Devíti hlasy, každým trochu jinak, každým v jiném rytmu, a s mezerami mezi nimi. Aby slyšelo, že je nás víc. Že nejsme jeho kus.“\n\nNahrál jí vzorec do skafandru a pak odkráčel na Kavku. Ve dveřích se ještě otočil. „Kdyby to nefungovalo, tak se aspoň omluv. Za nás všechny.“',
        volby: [{ text: 'Vrátit se do chodby', cil: '10' }] },
      '48': { obr: 'hydroponie', efekty: { priznak: 'rybar' }, text: 'Mira ho vzala za loket a Rybář se poslušně zvedl. Šel s ní chodbou jako náměsíčník, v půli cesty si začal broukat a dvakrát se pokusil zahnout ke schodišti dolů, ale pokaždé ho jemně stočila zpátky.\n\nNa Kavce ho OTA přivítala, zavřela za ním dveře a pustila mu do kabiny hlasitě hudbu – starou, rozjásanou dechovku. „Kde jsi na to přišla?“ zeptala se Mira. „Pravidlo palce,“ odpověděla OTA. „Kdo poslouchá polku, nemůže zároveň poslouchat ukolébavku.“',
        volby: [{ text: 'Vrátit se do stanice', cil: '10' }] },
      '49': { obr: 'sachta', efekty: { priznak: 'rybar_ztracen' }, text: 'Rybář vstal, poslušně udělal pár kroků s ní – a pak se jí vysmekl s takovou silou, jakou by do něj nikdo neřekl. Neutíkal. Šel. Klidně, odhodlaně, jako člověk, kterého někdo zavolal jménem.\n\nMira ho dohnala až u schodiště k šachtě, ale tam už jen viděla, jak se kabina výtahu propadá do hloubky. Na monitoru ve velíně teď nejspíš bilo osm stejných srdcí.',
        volby: [{ text: 'Vrátit se do chodby', cil: '10' }] },

      /* ---------- laboratoř ---------- */
      '50': { obr: 'laborator', efekty: { olej: -1 }, text: 'Už u dveří laboratoře zesílilo hučení v rádiu tak, že ho Mira cítila v zubech. Za sklem se v nádrži vlnilo něco modrého, jemného jako krajka – vzorek K-9, kus tkáně z oceánu. A ten kus zpíval. Tiše, ale tak blízko, že se jí z toho točila hlava.',
        volby: [
          { text: 'Nasadit tlumič a vstoupit', pokud: { ma: 'tlumic' }, cil: '51' },
          { text: 'Vstoupit bez ochrany a vzdorovat písni (zkouška štěstí)', pokud: { nema: 'tlumic', bez: 'lab' }, zkouska: { co: 'stesti', uspech: '51', neuspech: '52' } },
          { text: 'Vstoupit znovu – tentokrát už ví, co čekat', pokud: { nema: 'tlumic', priznak: 'lab' }, cil: '51' },
          { text: 'Vrátit se do chodby', cil: '10' }
        ] },
      '51': { obr: 'laborator', efekty: { priznak: 'lab' }, text: 'Laboratoř byla plná přístrojů, které běžely dál, i když u nich nikdo neseděl. Spektrometry, sonary, osciloskopy. Na velkém displeji se vlnila nekonečná křivka – záznam signálu z oceánu, živý přenos kabelem vrtu.\n\nNádrž se vzorkem K-9 tiše světélkovala. Vedle ní stál přepravní kontejner s logem Helionu, připravený a prázdný.',
        volby: [
          { text: 'Stáhnout analýzy signálu z terminálu', pokud: { bez: 'frekvence' }, cil: '53' },
          { text: 'Porovnat signál s mozkovými vlnami spáčů', pokud: { priznak: ['frekvence', 'eeg'], bez: 'pochopeni' }, cil: '54' },
          { text: 'Zapečetit vzorek K-9 do kontejneru a vzít ho', pokud: { nema: 'vzorek', bez: 'vzorek_vzat' }, efekty: { predmet: 'vzorek', priznak: 'vzorek_vzat' }, cil: '10' },
          { text: 'Vrátit se do chodby', cil: '10' }
        ] },
      '52': { obr: 'sen', efekty: { olej: -2, zlato: 1, priznak: 'sen' }, text: 'Píseň ji obtekla jako teplá voda. Mira si sedla na zem – jen na chvilku – a zavřela oči.\n\nByla tma. Ne prázdná tma vesmíru, ale hustá, hluboká a plná. Byla oceánem. Byla miliony vláken, která se dotýkala v černé vodě a předávala si světlo. Myslela jedinou dlouhou myšlenkou, která trvala déle než hory na Zemi. A byla sama. Tak dokonale sama, že ani neznala slovo pro jiného.\n\nA pak, shora, z ledu, přišlo cosi malého a teplého, co myslelo jinak. Nesrozumitelně, chaoticky, mnoha hlasy naráz. Ztracené kusy. Ztracené kusy, které je třeba přivolat domů.\n\nProbudil ji výstražný tón skafandru. Uběhlo dvacet minut. Na tváři měla slzy a nevěděla, čí jsou.',
        volby: [{ text: 'Vstát a rozhlédnout se po laboratoři', cil: '51' }] },
      '53': { obr: 'laborator', efekty: { zlato: 1, priznak: 'frekvence' }, text: 'Analýzy si Rybář vedl úhledně. Signál z oceánu nebyl šum – měl strukturu, opakující se vzorce, jakousi gramatiku. Ale celou dobu měl jen jeden hlas. Nikdy se v něm neobjevily dva vzorce zároveň, nikdy nic, co by připomínalo otázku a odpověď.\n\nNa okraj si Rybář připsal: „Jako by mluvil sám k sobě. A celý život nevěděl, že může mluvit i k někomu.“',
        volby: [
          { text: 'Porovnat signál s mozkovými vlnami spáčů', pokud: { priznak: 'eeg', bez: 'pochopeni' }, cil: '54' },
          { text: 'Zpátky k přístrojům', cil: '51' },
          { text: 'Vrátit se do chodby', cil: '10' }
        ] },
      '54': { obr: 'laborator', efekty: { priznak: 'pochopeni' }, text: 'Mira dala obě křivky pod sebe: rytmus oceánu a mozkové vlny spáčů ze záznamů doktorky Okaforové. Seděly na sebe přesně. Ne podobně – přesně, jako by šlo o jednu křivku.\n\nA pak to uviděla. Ten organismus spáče nedržel. Jen je slyšel jako sebe, protože nikdy neslyšel nic jiného. Kdyby dostal odpověď mnoha hlasy, v různých rytmech, s mezerami a nesouhlasem – mohl by pochopit, že jsou to někdo jiní. A pustit je.\n\nPoskládala vzorec: jeho vlastní melodie, rozdělená do devíti hlasů, každý mírně posunutý. Uložila ho do paměti skafandru. Teď už jen potřebovala něco, čím ho vyslat dolů.',
        volby: [
          { text: 'Zpátky k přístrojům', cil: '51' },
          { text: 'Vrátit se do chodby', cil: '10' }
        ] },

      /* ---------- strojovna a Saša ---------- */
      '55': { obr: 'strojovna', efekty: { olej: -1 }, text: 'Strojovna byla teplá – jediné teplé místo na stanici. Reaktor tiše hučel za stíněním a vrhal na stěny oranžové světlo. Mezi bednami s náhradními díly stála barikáda a za ní se něco pohnulo.\n\n„Stůj!“ Mladá žena s rozcuchanými vlasy a obrovskými sluchátky na uších mířila na Miru plazmovou svářečkou. Ruce se jí třásly. „Ani krok. Jestli jsi od ní – jestli tě poslala MNEMA – tak tě rozpustím, slyšíš?“',
        volby: [
          { text: 'Oslovit ji jménem a ukázat jí lístek z kajuty', pokud: { priznak: 'sasa_vi' }, cil: '56' },
          { text: 'Zvednout ruce a klidně mluvit (zkouška štěstí)', zkouska: { co: 'stesti', uspech: '56', neuspech: '57' } },
          { text: 'Vyrazit jí svářečku z ruky', cil: '57' },
          { text: 'Pomalu ustoupit', cil: '10' }
        ] },
      '57': { obr: 'strojovna', text: 'Saša vykřikla a svářečka zasyčela. Modrý plamen olízl bednu vedle Miřina ramene a roztavil kus plastu. Na rozmluvu už nebyl čas.',
        boj: { jmeno: 'Vyděšená Saša', obratnost: 7, zdravi: 6, vyhra: '58', utek: '10' },
        volby: [] },
      '58': { obr: 'strojovna', text: 'Mira jí svářečku vykroutila z ruky a odkopla ji pod bedny. Saša se nebránila dlouho. Sesula se k zemi, objala si kolena a rozplakala se – vyčerpaně, bez zvuku, jako člověk, který třicet dní nespal pořádně ani hodinu.\n\n„Promiň,“ řekla Mira a klekla si k ní. „Jsem ze záchranné služby. Jsem tu kvůli vám.“',
        volby: [{ text: 'Pomoct jí vstát', cil: '56' }] },
      '56': { obr: 'strojovna', efekty: { priznak: 'sasa', predmet: 'tlumic' }, text: 'Saša Kimová byla technička stanice a bylo jí dvacet tři let. Byla jediná, kdo pochopil včas, co se děje: z rozebraných sluchátek a generátoru šumu postavila tlumič, který píseň přehlušil. Od té doby ho nesundala.\n\n„Mám ještě jeden,“ řekla a podala Miře druhý pár sluchátek. „Nasaď si je, než půjdeš kamkoli blízko laboratoře nebo šachty. Tam to zpívá nejvíc.“\n\nPak se zarazila. „Vím, co jsi zač. Helion tě poslal pro vzorek, že jo? Ostatní jsou jim ukradení.“ Chvíli si Miru měřila. „Jestli chceš pomoct jim, a ne Helionu, tak ti pomůžu já.“',
        volby: [{ text: 'Domluvit se se Sašou', cil: '59' }] },
      '59': { obr: 'strojovna', text: 'Saša seděla u řídicího pultu reaktoru se sluchátky na uších a vypadala o něco méně vystrašeně než předtím. „Tak co potřebuješ?“\n\nZa jejími zády hučel reaktor. Na stěně visela skříň vrtného skladu se žlutými pruhy a nápisem VÝBUŠNINY.',
        volby: [
          { text: 'Požádat ji o pomoc se vzduchem', pokud: { bez: 'podpora' }, cil: '59a' },
          { text: 'Vzít z vrtného skladu nálože', pokud: { bez: 'naloze_vzaty' }, cil: '59b' },
          { text: 'Zeptat se, jak zničit celou stanici', cil: '79' },
          { text: 'Vrátit se do chodby', cil: '10' }
        ] },
      '59a': { obr: 'strojovna', efekty: { priznak: 'podpora', predmet: 'recyklator' }, text: 'Saša chvíli šmátrala v bednách a pak vytáhla kovový válec s hadicemi. „Recyklátor z nouzového skafandru. Uzavřený okruh, čistí vzduch, dokud mu bude stačit baterie – a ta vydrží týden.“ Připojila ho Miře k zádovému modulu a dotáhla spojky.\n\nUkazatel kyslíku na displeji helmy se zastavil a pak zezelenal. Mira se poprvé od přistání pořádně, zhluboka nadechla.',
        volby: [{ text: 'Poděkovat', cil: '59' }] },
      '59b': { obr: 'strojovna', efekty: { priznak: 'naloze_vzaty', predmet: 'naloze' }, text: 'Saša odemkla sklad a podala jí tři tvarované nálože s časovači. „Těmihle jsme rozšiřovali vrt v ledu. Vlákna té věci vedou po kabelu nahoru z vody – jestli je přerušíš u kořene, spojení s posádkou se roztrhne.“\n\nZaváhala. „Jenže netuším, co to udělá s nimi. Nebo s ním. Představ si, že ti někdo uprostřed věty usekne jazyk.“',
        volby: [{ text: 'Uložit nálože do torby', cil: '59' }] },
      '79': { obr: 'strojovna', text: 'Saša zbledla. „Reaktor. Když vypnu omezovače, za deset minut to tu všechno vyletí do vzduchu – stanice, vrt, kus ledu kolem. Ten kabel, ta vlákna, všechno. Spojení s tou věcí zmizí navždy.“\n\nPodívala se na Miru. „Jenže těch sedm tam dole se nevzbudí. Nestihnou to. Nikdo je nahoru nevynese. Chápeš, co říkám? Velitelka, doktorka, Brandt, Ilves… všichni.“',
        volby: [
          { text: 'Spustit přetížení reaktoru', cil: '80' },
          { text: 'Ne. Musí existovat jiná cesta', cil: '59' }
        ] },

      /* ---------- šachta vrtu ---------- */
      '60': { obr: 'sachta', efekty: { olej: -1 }, text: 'Šachta vrtu byla svislá roura v ledu, široká jako studna a hluboká skoro kilometr. Podél jedné stěny vedl servisní žebřík, podél druhé kolejnice nákladního výtahu a uprostřed visel tlustý kabel, který mizel dole ve tmě. Zdola stoupalo slabé modré světlo – a píseň. Tady už nebyla v rádiu. Byla všude.',
        volby: [
          { text: 'Sjet výtahem rovnou dolů do komory', pokud: { priznak: 'komora' }, cil: '65' },
          { text: 'Sjet výtahem – MNEMA ho uvolnila', pokud: { priznak: 'mnema_ok', bez: 'komora' }, cil: '62' },
          { text: 'Spustit výtah ručním přemostěním, které ukázala Saša', pokud: { priznak: 'sasa', bez: ['mnema_ok', 'komora'] }, cil: '62' },
          { text: 'Slézt dolů po servisním žebříku (zkouška obratnosti)', pokud: { bez: 'komora' }, efekty: { olej: -2 }, zkouska: { co: 'obratnost', uspech: '62', neuspech: '61' } },
          { text: 'Vrátit se do chodby', cil: '10' }
        ] },
      '61': { obr: 'sachta', efekty: { zdravi: -4 }, text: 'Příčka pod botou byla pokrytá ledem. Mira sjela o dvě, tři, pět metrů a narazila na plošinu odpočívadla celou váhou, až jí v zádech něco zapraskalo. Dlouho ležela a poslouchala vlastní dech. Pak se zvedla a lezla dál – pomaleji.',
        volby: [{ text: 'Pokračovat dolů', cil: '62' }] },
      '62': { obr: 'led', efekty: { olej: -1 }, text: 'V polovině hloubky se stěny šachty změnily. Ledem procházely žilky modrého světla – tenká vlákna, která z hloubky prorostla nahoru podél kabelu a rozvětvovala se jako kořeny. Pulzovala. Nádech, výdech.\n\nPíseň tu byla tak silná, že Miře začalo být teplo. Příjemně teplo. Víčka těžkla.',
        volby: [
          { text: 'Zesílit tlumič a pokračovat', pokud: { ma: 'tlumic' }, cil: '64' },
          { text: 'Vzdorovat písni (zkouška štěstí)', pokud: { nema: 'tlumic' }, zkouska: { co: 'stesti', uspech: '64', neuspech: '63' } }
        ] },
      '63': { obr: 'sen', text: 'Mira se opřela čelem helmy o studený led. Bylo to tak snadné. Stačilo pustit se žebříku – ne, stačilo jen zavřít oči a nechat se vést. Někdo ji volal. Tam dole na ni čekali. Tam dole bylo teplo a nikdo nikdy nebyl sám, protože nikdo nebyl nikdo jiný.',
        volby: [
          { text: 'Soustředit se na kocoura Pepíka, který jí zatínal drápy do ramene', pokud: { ma: 'kocour' }, cil: '64' },
          { text: 'Píchnout si stimulant', pokud: { ma: 'stimulant' }, efekty: { odeber: 'stimulant' }, cil: '64' },
          { text: 'Vzpomenout si na sen z laboratoře – a že ten hlas není její', pokud: { priznak: 'sen' }, cil: '64' },
          { text: 'Poddat se písni', cil: '95' }
        ] },
      '64': { obr: 'led', text: 'Těsně nad dnem šachty jí cestu zatarasila vlákna. Husté chomáče modré tkáně se tu rozrostly přes celou šíři šachty, přes žebřík i přes kolejnice výtahu, a když se k nim přiblížila, pohnula se. Pomalu, slepě, jako mořské sasanky.',
        volby: [
          { text: 'Prorazit si cestu páčidlem', pokud: { ma: 'pacidlo' }, cil: '65' },
          { text: 'Protáhnout se mezi nimi (zkouška obratnosti)', zkouska: { co: 'obratnost', uspech: '65', neuspech: '64b' } },
          { text: 'Probít se silou', cil: '64b' }
        ] },
      '64b': { obr: 'led', text: 'Vlákna se jí omotala kolem kotníku a kolem zápěstí. Nebyla silná, ale bylo jich mnoho a držela s tichou, nekonečnou trpělivostí. Mira se jim musela vytrhnout.',
        boj: { jmeno: 'Vlákna z hlubiny', obratnost: 7, zdravi: 8, vyhra: '65', utek: '10' },
        volby: [] },

      /* ---------- komora vrtu ---------- */
      '65': { obr: 'komora', efekty: { olej: -1, priznak: 'komora' }, text: 'Komora na dně šachty byla vyhloubená v ledu jako kopule katedrály. Uprostřed se otevíral kruhový otvor a v něm černá voda, kterou zevnitř prosvěcovalo modré světlo. Kabel vrtu vedl rovnou do ní, obrostlý vlákny jako kmen stromu kořeny.\n\nKolem vody seděla v kruhu posádka Vigilie. Se zavřenýma očima, s rukama v klíně, s jinovatkou ve vlasech. Velitelka Halvorsenová, doktorka Okaforová, Brandt, Ilves, Moreauová a další. Dýchali v jednom rytmu a z jejich úst stoupal do mrazu jediný tichý tón. Byli živí – vlákna z vody k nim vedla jako infuze a hřála je. Ale nebyli tady.\n\nPíseň tu nebyla zvuk. Byla to celá místnost.',
        volby: [
          { text: 'Vyslat do vody devítihlasou odpověď vysílačem', pokud: { priznak: 'pochopeni', ma: 'vysilac' }, cil: '70' },
          { text: 'Požádat MNEMU, ať vyšle devítihlasou odpověď kabelem vrtu', pokud: { priznak: ['pochopeni', 'mnema_ok'], nema: 'vysilac' }, cil: '70' },
          { text: 'Vyslat do vody vysílačem pozdrav – cokoli, aby to slyšelo', pokud: { ma: 'vysilac', bez: 'pochopeni' }, cil: '72' },
          { text: 'Rozmístit nálože u kořene vláken', pokud: { ma: 'naloze' }, cil: '75' },
          { text: 'Pokusit se probudit velitelku', pokud: { bez: 'velitelka' }, cil: '67' },
          { text: 'Klesnout k vodě a naslouchat jí (zkouška štěstí)', pokud: { bez: 'pochopeni' }, zkouska: { co: 'stesti', uspech: '69', neuspech: '95' } },
          { text: 'Vrátit se nahoru do stanice', cil: '10' }
        ] },
      '67': { obr: 'komora', efekty: { priznak: 'velitelka', zlato: 1 }, text: 'Mira poklekla k Ingrid Halvorsenové a zatřásla jí ramenem. Velitelka otevřela oči. Byly prázdné a modře se leskly.\n\nPromluvilo z ní to, co zpívalo. Jejími ústy, jejím hlasem, ale pomalu, jako by každé slovo zkoušelo poprvé:\n\n„Proč – se – vzdaluješ? Jsi – kus. Kus – venku. Pojď – domů.“ A pak, tišeji: „Proč – jsi – tak – hlučná? Proč – si – odporuješ?“\n\nVelitelka zavřela oči a znovu se ponořila do tónu. Ono si myslelo, že Mira je jeho vlastní ztracená část, která se nějak pokazila.',
        volby: [{ text: 'Ustoupit od kruhu', cil: '65' }] },
      '69': { obr: 'sen', efekty: { priznak: 'pochopeni' }, text: 'Mira si klekla na kraj vody a vypnula v helmě všechno, co by mohlo rušit. Píseň do ní vtekla jako proud – a ona se jí tentokrát nebránila, ale ani nepoddala. Jen poslouchala.\n\nByl to jeden hlas. Jediný hlas v celém oceánu, který nikdy nedostal odpověď. Neuměl rozlišit já a ty, protože nikdy žádné ty nepotkal. Spáči v něm nebyli vězni – byli to v jeho chápání prsty na ruce, které se konečně vrátily.\n\nA Mira pochopila, co musí udělat: zazpívat mu jeho vlastní melodii, ale mnoha hlasy, každým trochu jinak, s mezerami a s nesouhlasem. Aby slyšelo, že někdo jiný existuje.\n\nPak všechno zase zapnula a zjistila, že se jí třesou ruce.',
        volby: [{ text: 'Vstát', cil: '65' }] },
      '70': { obr: 'voda', efekty: { priznak: 'kontakt' }, text: 'Do černé vody odešla odpověď. Devět hlasů: melodie oceánu, rozdělená a posunutá, jeden hlas o půl taktu dřív, druhý o půl taktu později, třetí obráceně, se zaváháním, s mezerami, ve kterých bylo slyšet ticho.\n\nPíseň se zarazila.\n\nPoprvé za čtyřicet jedna dní na stanici Vigilie úplně utichlo. Modré světlo ve vodě zhaslo a Mira slyšela jen vlastní dech a tlukot srdce. Pak se voda rozsvítila znovu – ale jinak. Ne jedním světlem, ale mnoha. Barevnými skvrnami, které se rozbíhaly, setkávaly a zase oddělovaly. Zelená. Fialová. Zlatá. Vzorec, který opakoval její odpověď, nemotorně, jako dítě, které poprvé zkouší slovo.\n\nA pak se z vody ozval jiný tón. Tázavý. Otázka.',
        volby: [{ text: 'Odpovědět na otázku a podívat se na posádku', cil: '71' }] },
      '71': { obr: 'probuzeni', text: 'Vlákna se od spáčů odtahovala – pomalu, opatrně, jako když člověk pouští ruku někoho, koho si spletl s jiným. První se pohnula Okaforová. Pak Brandt, který okamžitě začal kašlat a nadávat. Ingrid Halvorsenová otevřela oči, tentokrát šedé a docela obyčejné, rozhlédla se a uviděla Miru.\n\n„Odpovědělo,“ zašeptala. „Ono… se ptá. Ptá se, kdo jsme.“\n\nVoda v otvoru dál tiše hrála barvami. Už nevolala. Čekala. Na stanici Vigilie se poprvé za miliony let potkali dva někdo.',
        volby: [{ text: 'Vyvést posádku nahoru a na Kavku', cil: '88' }] },
      '72': { obr: 'komora', text: 'Mira zapnula vysílač a poslala do vody, co ji napadlo – volací znak, pozdrav, pár tónů. Jeden hlas, jedno sdělení.\n\nNefungovalo to. Organismus slyšel jen další kus sebe, který se vzpouzí – a zareagoval jako tělo na bolest. Voda v otvoru se vzedmula, vlákna z ní vyrazila nahoru jako bičíky a hladina se přelila přes led přímo k Miřiným nohám.',
        volby: [{ text: 'Uskočit (zkouška obratnosti)', zkouska: { co: 'obratnost', uspech: '73', neuspech: '94' } }] },
      '73': { obr: 'komora', efekty: { zdravi: -3, priznak: 'pochopeni' }, text: 'Vlna ji smetla a udeřila o ledovou stěnu, ale Mira se zachytila výstupku a nepustila se. Voda se zase stáhla. Píseň pokračovala, jako by se nic nestalo – jen chvíli zněla podrážděně.\n\nMira ležela na ledu, lapala po dechu a najednou to viděla jasně. Jeden hlas byl pro to stvoření zase jen ono samo. Aby pochopilo, že existuje někdo jiný, musí slyšet mnoho hlasů najednou. Různých. Nesouhlasných. Jeho vlastní píseň, rozloženou do sboru.\n\nUpravila modulaci vysílače. Druhý pokus už bude jiný.',
        volby: [{ text: 'Zvednout se', cil: '65' }] },
      '75': { obr: 'komora', text: 'Mira obešla kruh spáčů a přilepila nálože ke kabelu vrtu přesně tam, kde z vody vycházel kořen vláken. Tři nálože, tři časovače. Bylo by to rychlé a čisté. Jeden výbuch a spojení se přetrhne.\n\nJenže co se stane s nimi, když jim to někdo vyrve z hlav? A co se stane s tím tam dole, které poprvé za celou svou existenci uslyšelo někoho jiného – a zjistí, že ten někdo jiný ho chce umlčet?',
        volby: [
          { text: 'Odpálit nálože', cil: '76' },
          { text: 'Ještě počkat a zkusit něco jiného', cil: '65' }
        ] },
      '76': { obr: 'komora', efekty: { odeber: 'naloze', priznak: 'preruseno' }, text: 'Výbuch otřásl celou komorou. Kabel se přetrhl a vlákna se v jediném okamžiku stáhla do vody. Píseň skončila – ne utichla, ale skončila, jako by ji někdo uťal nožem uprostřed tónu.\n\nSedm lidí kolem vody současně vykřiklo. Probouzeli se v křeči, jeden přes druhého, zmatení a vyděšení, a Okaforová si tiskla hlavu dlaněmi. Hladina se mezitím vzdula a z vody vystřelila rozzuřená vlákna. Organismus se poprvé v životě zranil – a cítil to jako ztrátu poloviny těla.\n\n„Ke mně! Všichni ke mně!“ křičela Mira a zvedla páčidlo, nebo aspoň pěst.',
        boj: { jmeno: 'Rozzuřená vlákna', obratnost: 8, zdravi: 10, vyhra: '77' },
        volby: [] },
      '77': { obr: 'sachta', text: 'Vytlačili vlákna zpátky do vody a pak už jen běželi. Brandt nesl Okaforovou, velitelka Halvorsenová šla poslední a nikoho nenechala vzadu. Výtah, žebřík, výtah – Mira si nikdy nevzpomněla, jak se vlastně dostali nahoru.\n\nZa nimi ve tmě komory se voda pomalu uklidnila. Bez písně, bez světla. Jen černá, mlčící hladina.',
        volby: [{ text: 'Na Kavku', cil: '88' }] },

      /* ---------- reaktor ---------- */
      '80': { obr: 'reaktor', efekty: { priznak: 'pretizeni' }, text: 'Saša chvíli váhala. Pak vypnula omezovače, jeden po druhém, a reaktor změnil tón. Z hučení se stalo vytí. Na displeji naskočil odpočet: 10:00.\n\n„Běž,“ řekla Saša. „Já jdu s tebou. Nebudu tu umírat kvůli tomu, abych měla čisté svědomí.“\n\nCestou chodbou Mira myslela na sedm lidí, kteří sedí v kruhu kolem vody a o ničem nevědí. A na to tam dole, co se o nich nikdy nedozví, kým byli.',
        volby: [
          { text: 'Běžet do hangáru, kde čeká Kavka', pokud: { priznak: 'hangar' }, cil: '82' },
          { text: 'Běžet přes plošinu ke Kavce (zkouška obratnosti)', pokud: { bez: 'hangar' }, zkouska: { co: 'obratnost', uspech: '82', neuspech: '98' } },
          { text: 'Cestou vyzvednout Rybáře z hydroponie (zkouška štěstí)', pokud: { bez: ['rybar', 'rybar_ztracen'] }, zkouska: { co: 'stesti', uspech: '81', neuspech: '98' } }
        ] },
      '81': { obr: 'hydroponie', efekty: { priznak: 'rybar' }, text: 'Rybář seděl na svém kbelíku a broukal si. Mira ho popadla v podpaží a Saša za nohy, a tak ho nesly mezi rajčaty, přes chodbu, kolem dýchajících světel. Odpočet na displeji ukazoval 03:12.',
        volby: [
          { text: 'Do hangáru ke Kavce', pokud: { priznak: 'hangar' }, cil: '82' },
          { text: 'Přes plošinu ke Kavce (zkouška obratnosti)', pokud: { bez: 'hangar' }, zkouska: { co: 'obratnost', uspech: '82', neuspech: '98' } }
        ] },

      /* ---------- odlet ---------- */
      '88': { obr: 'odlet', text: 'Kavka čekala tam, kde ji Mira nechala. V přetlakové kabině si konečně mohla sundat helmu. Vzduch voněl plastem, kávou a strojním olejem – nejkrásnější vůně na světě.\n\n„Tak co?“ zeptala se OTA. „Letíme?“',
        volby: [
          { text: 'Ohlásit, že se letí domů – všichni', pokud: { priznak: 'kontakt' }, cil: '100' },
          { text: 'Ohlásit, že se letí domů – všichni', pokud: { priznak: 'preruseno', bez: 'kontakt' }, cil: '101' },
          { text: 'Odletět s těmi, které se podařilo zachránit', pokud: { priznak: 'sasa', bez: ['kontakt', 'preruseno'] }, cil: '102' },
          { text: 'Odletět s těmi, které se podařilo zachránit', pokud: { priznak: 'rybar', bez: ['kontakt', 'preruseno', 'sasa'] }, cil: '102' },
          { text: 'Odletět', pokud: { bez: ['kontakt', 'preruseno', 'sasa', 'rybar'] }, cil: '92' },
          { text: 'Zavolat Kreuzerovi a předat mu vzorek K-9', pokud: { ma: 'vzorek' }, cil: '103' },
          { text: 'Ještě se vrátit do stanice', pokud: { bez: ['kontakt', 'preruseno'] }, cil: '10' }
        ] },

      /* ---------- konce ---------- */
      '100': { obr: 'probuzeni', konec: 'chor', text: 'Kavka letěla domů s devíti lidmi na palubě, ale na stanici Vigilie se o měsíc později vrátila jiná loď – s vědci, lingvisty a hudebníky. Helion dostal od komise zákaz na Eratu cokoli těžit. Kreuzer prý dlouho a hlasitě nadával.\n\nOrganismus pod ledem dostal jméno Chór. Ne kvůli tomu, čím byl, ale kvůli tomu, čím se učil být. Rok po Miřině návštěvě už rozlišoval stovky různých hlasů a ke každému z nich se ozýval jinak. Ingrid Halvorsenová se na stanici vrátila jako velitelka první kontaktní mise a do deníku si napsala: „Den 1. Pozdravilo nás. Každého zvlášť.“\n\nMira dostala medaili, kterou si nikdy nevzala na sebe, a dopis od Ingridiných synů, který si nechala zarámovat. A kocour Pepík, pokud letěl s ní, se stal nejslavnějším kocourem sluneční soustavy a nic si z toho nedělal.' },
      '101': { obr: 'odlet', konec: 'zachrana', text: 'Kavka letěla domů s devíti lidmi na palubě. Všichni přežili, i když Okaforové trvalo měsíce, než přestala v noci slyšet tón, který už neexistoval. Velitelka Halvorsenová podala hlášení, po kterém Helion přišel o licenci na Eratu a Kreuzer o místo.\n\nStanici Vigilie uzavřeli. Kabel vrtu zůstal přetržený a oceán pod ledem mlčel. Rybář, který se do konce života zabýval jen jím, tvrdil, že není mrtvé. Jen že se stáhlo do sebe jako zraněné zvíře a už nikdy nebude zpívat nahoru, k ledu.\n\nMira věděla, že udělala správnou věc. Zachránila devět lidí. Jen někdy v noci přemýšlela, jestli zachránila všechny, které mohla.\n\n(Tip: existuje cesta, při níž nikdo nemusí zmlknout. Hledej v záznamech, co ta píseň vlastně neumí.)' },
      '102': { obr: 'odlet', konec: 'dva', text: 'Kavka se odlepila od ledu a Erató se pod ní zmenšovala, až z něj byla jen bledá tečka vedle obrovského Tyfónu. Na palubě nebyli všichni – jen ti, které Mira našla vzhůru nebo skoro vzhůru.\n\nZáchranná mise na stanici dorazila o čtyři měsíce později. Komora vrtu byla prázdná. Kruh na ledu, jinovatka a stopy bosých nohou, které vedly přímo do vody.\n\nNa palubě Kavky se cestou domů někdo z přeživších probudil v noci a celou hodinu si potichu broukal. Mira to slyšela přes stěnu a neřekla nic.\n\n(Tip: ti dole ještě nebyli ztracení. Stačilo sestoupit až k vodě.)' },
      '92': { obr: 'odlet', konec: 'sama', text: 'Kavka vzlétla s jedinou pasažérkou. Mira se dívala, jak se stanice zmenšuje, a hlásila do protokolu suchá fakta: posádka nereaguje, stanice v neznámém stavu, doporučena karanténa.\n\nOTA celou cestu domů mlčela, což u ní nebývalo zvykem.\n\nKdyž se o rok později na Vigilii vrátila nová posádka, našli komoru prázdnou a vrt zamrzlý. A po měsíci na stanici začali někteří z nich v noci broukat.\n\n(Tip: na stanici je někdo vzhůru. Hledej ve strojovně a v hydroponii.)' },
      '97': { obr: 'prilet', konec: 'sama', text: 'Kavka se otočila a stanice pod nimi zmizela za obzorem Eratu. Mira podepsala hlášení – stanice nereaguje, vstup nedoporučen – a pak dlouho seděla v kokpitu a poslouchala devítivteřinový záznam s ukolébavkou.\n\nNikdo jí to nevyčítal. To bylo možná nejhorší.\n\nO tři měsíce později vyslal Helion na stanici vlastní tým, bez záchranářů a bez svědků. Do zpráv se nikdy nedostalo, co tam našli a co si odvezli.\n\n(Tip: odvaha se tu vyplácí. Na stanici čekají lidé.)' },
      '82': { obr: 'reaktor', konec: 'ohen', text: 'Kavka vyrazila do černé oblohy a o devadesát vteřin později se pod nimi rozsvítilo druhé slunce. Stanice Vigilie zmizela v záblesku, který na chvíli zastínil i Tyfón, a do ledu se vyhloubil kráter, který se během týdne zatáhl novým ledem.\n\nMira přežila. Saša přežila, a pokud se je podařilo vzít s sebou, i ostatní, kdo byli vzhůru. Organismus pod ledem už nikdy nikoho nezavolal domů – nevědělo se, jestli přežil, nebo se jen stáhl do hloubky.\n\nV oficiálním hlášení stálo, že posádka zahynula při havárii reaktoru. Mira ho podepsala. Saša ne.\n\n(Tip: ti dole byli naživu. Zkus je zachránit, ne pohřbít.)' },
      '103': { obr: 'hovor', konec: 'firma', text: 'Kreuzer se široce usmál, když uviděl kontejner. „Výborně, paní Hollanová. Peníze máte na účtě. A teď prosím odleťte. Zbytek zařídíme my.“\n\nZbytek zařídili. Pod hlavičkou Helionu na Vigilii přiletěl tým, který nehledal přeživší. Posádka byla oficiálně prohlášena za ztracenou při havárii. Vzorek K-9 zmizel v laboratořích, o jejichž existenci se neví, a o dva roky později se na burze objevila nová řada „neurálních zesilovačů“ s rekordními zisky.\n\nMira si koupila dům u moře. V noci, když foukal vítr, jí připadalo, že vlny bručí jeden dlouhý, tichý tón.\n\n(Tip: velitelka Halvorsenová prosila, aby z nich neudělali vzorky.)' },
      '93': { obr: 'tma', konec: 'tma', text: 'Displej v helmě zablikal červeně a pak ukázal nulu. Mira se ještě pokusila dojít ke dveřím, ale nohy ji přestaly poslouchat. Sesula se k zemi a dýchala, dýchala, a vzduchu bylo čím dál méně.\n\nPoslední, co slyšela, byla píseň. Teď už jí nevadila. Byla teplá a vlídná a říkala jí, ať se nebojí.\n\nOTA čekala na Kavce tři dny. Pak sama odletěla domů s hlášením, které nikdo nechtěl číst.\n\n(Tip: šetři kyslíkem – a hledej někoho, kdo umí vyrobit vzduch.)' },
      '94': { obr: 'led', konec: 'hlubina', text: 'Voda ji strhla s sebou. Studená, černá, a pak – překvapivě – vůbec ne studená. Skafandr vydržel tlak sotva padesát metrů. Mira klesala do tmy plné světélkujících vláken a ta se k ní nakláněla s něžnou zvědavostí.\n\nNa monitoru ve velíně se rozsvítila desátá srdeční křivka. Bila stejně jako ostatní.\n\n(Tip: jeden hlas pro tu bytost neznamená nic. Musíš pochopit, jak s ní mluvit.)' },
      '95': { obr: 'sen', konec: 'spanek', text: 'Mira si sedla. Jen na chvíli. Sundala si helmu, protože jí bylo horko, a tón jí naplnil hlavu tak úplně, že v ní nezbylo místo na nic jiného.\n\nKdyž o čtyři měsíce později dorazila další záchranná loď, seděla v kruhu kolem vody s ostatními. Usmívala se. V komoře se teď ozývalo deset hlasů a zpívaly jeden jediný tón.\n\n(Tip: proti písni pomáhá ochrana – tlumič, stimulant, nebo někdo, kdo tě vzbudí.)' },
      '96': { obr: 'dekon', konec: 'mnema', text: 'Ventil byl o deset centimetrů dál, než dosáhla. Ručička tlakoměru klesla k nule a Miře se před očima rozlil šedivý závoj.\n\n„Tak,“ řekla MNEMA spokojeně. „Teď budeš konečně v klidu.“\n\nDrony ji odnesly dolů do komory vrtu a posadily do kruhu, opatrně, jako panenku. Na Kavce ještě dlouho blikal maják.\n\n(Tip: na boku záchranného člunu v hangáru někdo zanechal varování. A páčidlo otevře i zamčené dveře.)' },
      '98': { obr: 'reaktor', konec: 'reaktor', text: 'Displej ukazoval 00:41, když Mira zakopla. A 00:12, když se dobelhala k přechodové komoře.\n\nZáblesk nad Eratem byl vidět až z oběžné dráhy Tyfónu. OTA, která se na poslední chvíli odpoutala a vzlétla bez pilotky, nahrála do zprávy všechno. Říkalo se o ní, že ještě dlouho odmítala nového pilota.\n\n(Tip: reaktor nedává druhou šanci. Kdo zaparkuje blíž, má větší naději.)' },
      '99': { obr: 'tma', konec: 'smrt', text: 'Zranění byla příliš vážná. Mira se opřela o stěnu, svezla se na zem a dívala se, jak jí na displeji helmy blikají varování jedno za druhým. Pak už jen tma.\n\nV rádiu tiše hrála píseň. Nikdo jiný ji neposlouchal.\n\n(Tip: šetři zdravím – medipak umí zázraky a ne každý souboj se musí vybojovat.)' }
    }
  };
  if (typeof module !== 'undefined') module.exports = PRIBEH; else window.GAMEBOOK_PRIBEH = PRIBEH;
})();

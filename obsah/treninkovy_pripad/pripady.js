/* Tréninkové případy – data spisů pro cvičení „najdi rozpor“.
   Všechny osoby, místa, firmy, čísla a události jsou SMYŠLENÉ. S modelovým
   případem 17/2026 (vysetrovani/pripad.js) nesdílí nic, aby se cvičení neprozradilo.

   Zápis:
   - výrok v textu: [id, text, druh?, svg?] – druh 'o' = ověřené zjištění, 't' = tvrzení osoby;
     bez druhu platí výchozí podle typu dokumentu (výpověď a oznámení = tvrzení, ostatní = ověřené)
   - řádek tabulky: [id, [buňky], druh?]
   - rozpor: pary = dvojice ID výroků, které si odporují (stačí najít jednu)
   - zdanlive = dvojice, které vypadají jako rozpor, ale mají vysvětlení (menší penalizace)
   - zaver: otázky; dukazy = výroky, které odpověď podporují; klamne = výroky, o které se opřít je chyba
   Konzistenci hlídá node _test/treninkovy_pripad_test.js. */
(function (koren) {
  'use strict';

  const PRIPADY = [];

  /* ===================================================================
     1) LEHKÝ – Zelené kolo od knihovny
     =================================================================== */
  PRIPADY.push({
    id: 'kolo',
    nazev: 'Zelené kolo od knihovny',
    obtiznost: 1,
    rok: 2026,
    limitMin: 15,
    znacka: 'KRPT-3108/TČ-2026 (cvičný)',
    uvod: 'V sobotu 7. 11. 2026 odpoledne zmizelo v Habrovicích zelené horské kolo zamčené před městskou knihovnou. Podezřelý Patrik Holub tvrdí, že byl celou dobu u kamaráda. Projdi spis, najdi výroky a údaje, které si odporují, a rozhodni, co se stalo.',
    osoby: [
      ['Eva Šimková', '21 let, poškozená, studentka'],
      ['Patrik Holub', '19 let, podezřelý, Lipová 3, Habrovice'],
      ['Ondřej Kalina', '20 let, kamarád podezřelého, Polní 12, Habrovice'],
      ['Jiří Malý', '71 let, svědek, Školní 7 (naproti knihovně)']
    ],
    dokumenty: [
      {
        id: 'k-ozn', typ: 'oznameni', nazev: 'Oznámení krádeže', datum: '7. 11. 2026 15:52',
        hlava: [['Přijato', 'telefonicky, linka 158'], ['Přijal', 'nstrm. Lucie Kubátová (smyšlená)'], ['Oznamovatel', 'Eva Šimková']],
        text: [[
          ['ko1', 'Oznamovatelka Eva Šimková uvedla, že své zelené horské kolo zn. Rival 29 zamkla ve 14:10 lankovým zámkem ke stojanu před městskou knihovnou, Školní 4, Habrovice.'],
          ['ko2', 'V 15:40 se z knihovny vrátila a kolo ve stojanu nebylo; na zemi ležel přeštípnutý zámek.'],
          ['ko3', 'Hodnotu kola uvádí 18 500 Kč, na rámu je samolepka s kreslenou sovou.'],
          ['ko4', 'Nikoho podezřelého neviděla, celou dobu byla ve studovně v 1. patře.']
        ]]
      },
      {
        id: 'k-ohl', typ: 'ohledani', nazev: 'Protokol o ohledání místa', datum: '7. 11. 2026 16:10–16:40',
        hlava: [['Místo', 'stojan na kola před knihovnou, Školní 4, Habrovice'], ['Provedl', 'prap. Martin Vlček (smyšlený)'], ['Podmínky', 'denní světlo, sucho']],
        text: [[
          ['kp1', 'U stojanu leží ocelový lankový zámek s přeštípnutým lankem; střih je čistý a šikmý, jaký zanechávají pákové štípací kleště.'],
          ['kp2', 'Nad vchodem knihovny je kamera, která snímá stojan; záznam vydala vedoucí knihovny.'],
          ['kp3', 'Hodiny záznamového zařízení kamery jdou proti přesnému času o 2 minuty napřed (porovnáno v 16:30 s časem mobilní sítě).']
        ], [
          ['kp4', 'Ve stojanu zůstala tři další kola s neporušenými zámky.']
        ]]
      },
      {
        id: 'k-sto', typ: 'stopy', nazev: 'Seznam zajištěných stop', datum: '8. 11. 2026',
        tabulka: {
          sloupce: ['Č.', 'Stopa', 'Stav'],
          radky: [
            ['ks1', ['S1', 'lankový zámek s přeštípnutým lankem', 'zajištěn, k mechanoskopickému porovnání']],
            ['ks2', ['S2', 'záznam kamery knihovny (USB)', 'zajištěn, přehrán']],
            ['ks3', ['S3', 'pákové štípací kleště 45 cm (z batohu P. Holuba)', 'zaslány k porovnání se střihem lanka, výsledek zatím není']],
            ['ks4', ['S4', 'červená větrovka s kapucí (z batohu P. Holuba)', 'barva a tvar kapuce odpovídají postavě na kameře; obličej na záznamu rozpoznat nelze']],
            ['ks5', ['S5', 'účtenka Bistro Na Rampě (z peněženky P. Holuba)', 'zajištěna']]
          ]
        }
      },
      {
        id: 'k-foto', typ: 'foto', nazev: 'Fotodokumentace', datum: '7. 11. 2026',
        text: [[
          ['kf1', 'Foto 1: přeštípnuté lanko zámku vedle stojanu, u něj měřítko 10 cm.', 'o', 'zamek'],
          ['kf2', 'Foto 2: prázdné místo ve stojanu; sousední kolo má neporušený zámek.', 'o', 'stojan'],
          ['kf3', 'Foto 3: štípací kleště z batohu, na ostří čelistí lesklé stopy kovu.', 'o', 'kleste']
        ]]
      },
      {
        id: 'k-kam', typ: 'kamera', nazev: 'Záznam kamery knihovny', datum: '7. 11. 2026',
        hlava: [['Zdroj', 'kamera nad vchodem knihovny, Školní 4'], ['Pozor', 'čas je čas záznamového zařízení']],
        tabulka: {
          sloupce: ['Čas na záznamu', 'Co je vidět'], cas: 0,
          radky: [
            ['kk1', ['14:31:50', 'Ke stojanu přichází muž v červené větrovce s kapucí přes hlavu, na zádech tmavý batoh.']],
            ['kk2', ['14:32:30', 'Muž se sklání u zeleného kola, v rukou drží delší předmět.']],
            ['kk3', ['14:33:05', 'Muž odjíždí na zeleném kole vlevo, směrem k Nádražní ulici.']],
            ['kk4', ['14:58:12', 'Ke vchodu přichází žena s kočárkem, u stojanu se nezastaví.']]
          ]
        },
        pozn: [['kk5', 'Obličej muže není na záznamu rozpoznatelný.']]
      },
      {
        id: 'k-maly', typ: 'vypoved', nazev: 'Výpověď svědka – Jiří Malý', datum: '8. 11. 2026 9:00',
        hlava: [['Vyslýchaný', 'Jiří Malý, 71 let, Školní 7, Habrovice'], ['Postavení', 'svědek']],
        text: [[
          ['km1', 'Bydlím ve Školní 7, z okna vidím přímo na knihovnu.'],
          ['km2', 'Kolem půl třetí, možná o pár minut dřív, jsem viděl mladého kluka v červené bundě s kapucí, jak se sklání u stojanu.'],
          ['km3', 'Pak sedl na kolo, tmavé, asi zelené, a jel dolů k nádraží.'],
          ['km4', 'Do obličeje jsem mu neviděl, poznat bych ho nedokázal.'],
          ['km5', 'Myslím, že měl na zádech batoh.']
        ]]
      },
      {
        id: 'k-kal', typ: 'vypoved', nazev: 'Výpověď svědka – Ondřej Kalina', datum: '8. 11. 2026 10:30',
        hlava: [['Vyslýchaný', 'Ondřej Kalina, 20 let, Polní 12, Habrovice'], ['Postavení', 'svědek']],
        text: [[
          ['kl1', 'Patrik je můj kamarád, v sobotu jsme spolu hráli hry u mě doma v Polní 12.'],
          ['kl2', 'Přišel až po třetí, tak v pět minut po třetí.'],
          ['kl3', 'Ještě předtím mi volal, jestli jsem doma.'],
          ['kl4', 'Kolo neměl, přišel pěšky.'],
          ['kl5', 'Kolem šesté šel ven před dům, prý si zakouřit, a tam ho zastavila policie.']
        ]]
      },
      {
        id: 'k-hol', typ: 'vypoved', nazev: 'Výpověď podezřelého – Patrik Holub', datum: '8. 11. 2026 13:00',
        hlava: [['Vyslýchaný', 'Patrik Holub, 19 let, Lipová 3, Habrovice'], ['Postavení', 'podezřelý, poučen o právech']],
        text: [[
          ['kh1', 'V sobotu jsem byl od půl druhé u Ondry Kaliny v Polní 12 a do čtyř jsem odtamtud nevytáhl paty.'],
          ['kh2', 'Ondrovi jsem ten den nevolal, proč bych mu volal, když jsem seděl u něj.'],
          ['kh3', 'Červenou bundu nemám, nosím jen tuhle černou.']
        ], [
          ['kh4', 'U nádraží jsem v sobotu vůbec nebyl.'],
          ['kh5', 'Kleště mám od táty, opravoval jsem s nimi plot.'],
          ['kh6', 'Telefon jsem nikomu nepůjčoval, mám ho pořád u sebe.']
        ]]
      },
      {
        id: 'k-zad', typ: 'zaznam', nazev: 'Úřední záznam o kontrole osoby', datum: '7. 11. 2026 18:20',
        hlava: [['Místo', 'před domem Polní 12, Habrovice'], ['Sepsal', 'prap. Martin Vlček (smyšlený)']],
        text: [[
          ['kz1', 'Podle popisu z kamerového záznamu hlídka v 18:20 kontrolovala Patrika Holuba před domem Polní 12.'],
          ['kz2', 'Holub měl na sobě černou bundu; v jeho batohu byla složená červená větrovka s kapucí a pákové štípací kleště délky 45 cm.'],
          ['kz3', 'V peněžence měl platební kartu končící čísly 4417 a účtenku z Bistra Na Rampě.'],
          ['kz4', 'Kolo u Holuba ani v okolí domu nalezeno nebylo.'],
          ['kz5', 'Holub hlídce řekl, že kleště má od táty na opravu plotu.', 't']
        ]]
      },
      {
        id: 'k-hov', typ: 'hovory', nazev: 'Výpis hovorů – číslo P. Holuba', datum: '7. 11. 2026',
        hlava: [['Číslo', '+420 700 555 214 (podle smlouvy uživatel Patrik Holub)'], ['Zdroj', 'výpis operátora na žádost policie']],
        tabulka: {
          sloupce: ['Čas', 'Směr', 'Protistrana', 'Délka', 'Buňka'], cas: 0,
          radky: [
            ['kv1', ['13:12', 'příchozí SMS', '+420 700 555 390 (matka)', '–', 'Habrovice-střed']],
            ['kv2', ['14:47', 'odchozí hovor', '+420 700 555 018 (O. Kalina)', '38 s', 'Habrovice-nádraží']],
            ['kv3', ['16:05', 'příchozí hovor', '+420 700 555 390 (matka)', '1 min 12 s', 'Habrovice-sever']]
          ]
        }
      },
      {
        id: 'k-pol', typ: 'poloha', nazev: 'Polohová data telefonu P. Holuba', datum: '7. 11. 2026',
        hlava: [['Zdroj', 'export polohové historie z telefonu, vydán dobrovolně 8. 11.']],
        tabulka: {
          sloupce: ['Čas', 'Místo', 'Přesnost'], cas: 0,
          radky: [
            ['kg1', ['13:28', 'Habrovice, Lipová 3 (bydliště)', '±20 m']],
            ['kg2', ['14:24', 'Habrovice, Školní 6 (30 m od knihovny)', '±25 m']],
            ['kg3', ['14:29', 'Habrovice, Školní 4 (před knihovnou)', '±15 m']],
            ['kg4', ['14:38', 'Habrovice, Nádražní 2 (Bistro Na Rampě)', '±20 m']],
            ['kg5', ['14:52', 'Habrovice, Nádražní 11', '±30 m']],
            ['kg6', ['15:06', 'Habrovice, Polní 12', '±15 m']],
            ['kg7', ['18:15', 'Habrovice, Polní 12', '±15 m']]
          ]
        },
        pozn: [['kg8', 'Přesnost je poloměr kruhu, ve kterém telefon s vysokou pravděpodobností byl.']]
      },
      {
        id: 'k-uct', typ: 'uctenka', nazev: 'Účtenka – Bistro Na Rampě', datum: '7. 11. 2026',
        text: [[
          ['ku1', 'Bistro Na Rampě, Nádražní 2, Habrovice.'],
          ['ku2', 'Datum a čas: 7. 11. 2026 14:41:17.'],
          ['ku3', 'Energetický nápoj 0,5 l 39 Kč, bageta 69 Kč, celkem 108 Kč.'],
          ['ku4', 'Placeno kartou ****4417.']
        ]]
      }
    ],
    rozpory: [
      {
        id: 'kR1', nazev: 'Alibi „u Kaliny od půl druhé“ × poloha telefonu',
        pary: [['kh1', 'kg2'], ['kh1', 'kg3'], ['kh1', 'kg4'], ['kh1', 'kg5'], ['kh1', 'ku2'], ['kh1', 'kv2']],
        napoveda: 'Kde byl podle dat Holubův telefon mezi půl druhou a třetí?',
        vysvetleni: 'Holub tvrdí, že byl od 13:30 nepřetržitě v Polní 12. Jeho telefon je ale ve 14:24 a 14:29 u knihovny a ve 14:38 až 14:52 u nádraží, kde se ve 14:41 platí jeho kartou a ve 14:47 z telefonu volá přes buňku Habrovice-nádraží; v Polní 12 je až v 15:06. Sám přitom uvedl, že telefon nikomu nepůjčoval (ve své výpovědi), takže poloha telefonu tu dobře vypovídá i o něm.'
      },
      {
        id: 'kR2', nazev: 'Holub × Kalina: kdy přišel',
        pary: [['kh1', 'kl2']],
        napoveda: 'Shodují se dva kamarádi v tom, kdy se v sobotu sešli?',
        vysvetleni: 'Kalina je Holubův kamarád, a přesto sám uvádí, že Holub přišel až v 15:05. Tím vyvrací tvrzení „od půl druhé“. Jeho údaj navíc nezávisle potvrzuje poloha telefonu (15:06 Polní 12).'
      },
      {
        id: 'kR3', nazev: '„Nevolal jsem mu“ × výpis hovorů',
        pary: [['kh2', 'kv2'], ['kh2', 'kl3']],
        napoveda: 'Proč by někdo volal kamarádovi, se kterým zrovna sedí v jednom pokoji?',
        vysvetleni: 'Výpis operátora ukazuje odchozí hovor na Kalinu ve 14:47 (38 s) a Kalina hovor potvrzuje. Holub tvrdí, že mu nevolal. Hovor navíc prošel buňkou Habrovice-nádraží – ve shodě s polohou telefonu u Nádražní ulice, ne v Polní 12.'
      },
      {
        id: 'kR4', nazev: '„Červenou bundu nemám“ × obsah batohu',
        pary: [['kh3', 'kz2'], ['kh3', 'ks4']],
        napoveda: 'Co hlídka našla v batohu při kontrole?',
        vysvetleni: 'Holub popírá, že by měl červenou bundu, ale v jeho batohu byla červená větrovka s kapucí, která barvou i tvarem odpovídá postavě na kameře. Lež o věci, kterou lze snadno ověřit, je sama o sobě důležitá informace.'
      },
      {
        id: 'kR5', nazev: '„U nádraží jsem nebyl“ × účtenka a poloha',
        pary: [['kh4', 'ku2'], ['kh4', 'ku1'], ['kh4', 'kg4'], ['kh4', 'kg5'], ['kh4', 'kv2'], ['kh4', 'kz3']],
        napoveda: 'Podívej se, kde a kdy se platilo kartou, kterou měl Holub v peněžence.',
        vysvetleni: 'Účtenka z Bistra Na Rampě (Nádražní 2) je ze 14:41 a zaplacena kartou ****4417, kterou měl Holub v peněžence. Telefon je ve 14:38 právě u bistra a hovor ve 14:47 jde přes buňku u nádraží. Tři nezávislé zdroje se shodují, Holubovo tvrzení stojí proti nim.'
      }
    ],
    zdanlive: [
      { pary: [['kk1', 'km2'], ['kk2', 'km2'], ['kk3', 'km2']], vysvetleni: 'Není to rozpor. Hodiny kamery jdou o 2 minuty napřed (protokol o ohledání), skutečný čas je tedy 14:29:50–14:31:05. Svědek říká „kolem půl třetí, možná o pár minut dřív“ – odhad času člověkem je přibližný a s kamerou se shoduje.' },
      { pary: [['kk3', 'kg3'], ['kk1', 'kg2'], ['kk2', 'kg3']], vysvetleni: 'Není to rozpor. Po opravě o 2 minuty (protokol o ohledání) je odjezd na kameře ve 14:31:05 a telefon je ve 14:29 před knihovnou – údaje do sebe zapadají.' },
      { pary: [['km3', 'ko1']], vysvetleni: 'Není to rozpor. Svědek z okna popisuje kolo jako „tmavé, asi zelené“; barvy na dálku a v pohybu člověk vnímá nepřesně. Výpověď je s oznámením slučitelná.' },
      { pary: [['kh1', 'kg1']], vysvetleni: 'Sám o sobě to rozpor není: telefon je doma ve 13:28 a „od půl druhé“ je jen přibližný údaj – dvě minuty nic nerozhodnou. Alibi vyvracejí až údaje mezi 14:24 a 14:52.' },
      { pary: [['kl4', 'kk3']], vysvetleni: 'Není to rozpor. Pachatel mohl kolo před příchodem ke Kalinovi někde schovat nebo předat – kolo dosud nalezeno nebylo (úřední záznam o kontrole).' }
    ],
    zaver: [
      {
        id: 'kdo', otazka: 'Kdo kolo s největší pravděpodobností odcizil?',
        moznosti: [['a', 'Patrik Holub'], ['b', 'Ondřej Kalina'], ['c', 'Neznámý pachatel, Holub je nevinný'], ['d', 'Jiří Malý']],
        spravne: 'a', dukazy: ['kg3', 'kg2', 'kz2', 'ks4', 'ku2', 'ku4', 'kz3', 'kk1', 'kv2'],
        klamne: [],
        vysvetleni: 'Na Holuba ukazuje několik nezávislých zdrojů: poloha telefonu u knihovny ve chvíli krádeže, červená větrovka a kleště v batohu, účtenka u nádraží, kam pachatel odjel. Jeho výpověď se v pěti bodech rozchází s ověřenými údaji.'
      },
      {
        id: 'kdy', otazka: 'Kdy ke krádeži došlo (skutečný čas)?',
        moznosti: [['a', 'mezi 13:30 a 14:00'], ['b', 'přibližně 14:30–14:31'], ['c', 'přibližně 14:32–14:33, jak ukazuje kamera'], ['d', 'mezi 15:00 a 15:40']],
        spravne: 'b', dukazy: ['kk2', 'kk3', 'kp3', 'km2', 'kg3'],
        klamne: [],
        vysvetleni: 'Kamera ukazuje 14:32:30–14:33:05, ale její hodiny jdou o 2 minuty napřed (protokol o ohledání). Skutečný čas je tedy asi 14:30:30–14:31:05, což sedí se svědkem i s polohou telefonu ve 14:29.'
      },
      {
        id: 'jak', otazka: 'Jak pachatel postupoval?',
        moznosti: [['a', 'Přeštípl lankový zámek pákovými kleštěmi a odjel na kole k nádraží'], ['b', 'Odemkl zámek klíčem, který si opatřil'], ['c', 'Kolo i se zámkem naložil do auta'], ['d', 'Kolo si půjčil se souhlasem majitelky']],
        spravne: 'a', dukazy: ['kp1', 'kf1', 'kk2', 'kk3', 'kz2', 'kf3'],
        klamne: [],
        vysvetleni: 'Čistý šikmý střih lanka odpovídá pákovým kleštím, kamera ukazuje sklonění s delším předmětem a odjezd na kole směrem k Nádražní ulici.'
      },
      {
        id: 'slabe', otazka: 'Co je na tomto případu nejslabší místo?',
        moznosti: [
          ['a', 'Pachatele nikdo nepoznal a obličej na kameře není vidět – totožnost stojí na nepřímých stopách (poloha, větrovka, účtenka) a výsledek porovnání kleští zatím chybí.'],
          ['b', 'Výpis hovorů sám dokazuje, že Holub kolo ukradl.'],
          ['c', 'Kamera má posunutý čas, takže je jako důkaz nepoužitelná.'],
          ['d', 'Kalina je kamarád, takže jeho výpověď nemá žádnou cenu.']
        ],
        spravne: 'a', dukazy: ['kk5', 'km4', 'ks3', 'kz4'],
        klamne: [],
        vysvetleni: 'Posunutý čas kamery jde opravit, když je posun změřený. Výpis hovorů ukazuje jen hovor a buňku, ne krádež. Slabinou je chybějící přímá identifikace: obličej nevidět, svědek nepozná, kolo se nenašlo a mechanoskopie kleští ještě není hotová.'
      }
    ],
    pouceni: [
      'Poloha telefonu je silná stopa, ale jen tehdy, když víme, že telefon měl u sebe právě on – proto je důležité, že to Holub sám potvrdil.',
      'Čas na kameře vždy porovnej s přesným časem. Dvě minuty posunu tu nic nemění, jinde mohou rozhodnout.',
      'Výpověď kamaráda proti tvrzení podezřelého má velkou váhu, protože mluví „proti zájmu“ blízké osoby.',
      'Svědek, který přizná, že by pachatele nepoznal, je poctivý – nechtěj po něm víc, než viděl.'
    ]
  });

  /* ===================================================================
     2) STŘEDNÍ – Chata Pod Skalkou
     =================================================================== */
  PRIPADY.push({
    id: 'chata',
    nazev: 'Vloupání do chaty Pod Skalkou',
    obtiznost: 2,
    rok: 2026,
    limitMin: 25,
    znacka: 'KRPT-4471/TČ-2026 (cvičný)',
    uvod: 'V noci ze soboty 31. 10. na neděli 1. 11. 2026 se někdo vloupal do chaty č. 14 v chatové osadě Pod Skalkou u Lomničky. Podezření padlo na Marka Duška, který na chatě v létě opravoval střechu. Jeho kamarád Radek Hron mu dává alibi. Pozor: časová razítka nemusí být všechna přesná.',
    osoby: [
      ['Vladimír Sedláček', '58 let, majitel chaty č. 14'],
      ['Marek Dušek', '34 let, podezřelý, v červenci opravoval na chatě střechu'],
      ['Radek Hron', '36 let, zedník, Zahradní 9, Lomnička, bílá dodávka'],
      ['Alena Pokorná', '63 let, svědkyně, chata č. 9'],
      ['Bohumil Říha', 'myslivec, správce fotopasti na lesní cestě']
    ],
    dokumenty: [
      {
        id: 'c-ozn', typ: 'oznameni', nazev: 'Oznámení vloupání', datum: '1. 11. 2026 9:41',
        hlava: [['Přijato', 'telefonicky, linka 158'], ['Oznamovatel', 'Vladimír Sedláček']],
        text: [[
          ['co1', 'Oznamovatel Vladimír Sedláček uvedl, že v neděli 1. 11. 2026 v 9:15 přijel na svou chatu č. 14 v osadě Pod Skalkou u Lomničky a zjistil, že zadní okno je vypáčené.'],
          ['co2', 'Z chaty chybí motorová pila, elektrocentrála Volta 2200 s výrobním číslem 22-118473, dva rybářské pruty a dvě lahve whisky.'],
          ['co3', 'Naposledy byl na chatě v neděli 25. 10., kdy vše zamkl.'],
          ['co4', 'O tom, kde má elektrocentrálu, věděla jen rodina a Marek Dušek, který mu v červenci opravoval střechu.']
        ]]
      },
      {
        id: 'c-hli', typ: 'zaznam', nazev: 'Úřední záznam hlídky', datum: '1. 11. 2026 10:20',
        hlava: [['Sepsal', 'pprap. Jan Mareš (smyšlený)']],
        text: [[
          ['ch1', 'Hlídka přijela k chatě č. 14 v 10:05.'],
          ['ch2', 'Okno v zadní stěně chaty je vypáčené, na rámu je otisk plochého nástroje šířky 22 mm.'],
          ['ch3', 'Pod oknem jsou v blátě zřetelné šlápoty obuvi s podrážkou se vzorem rybí kosti.'],
          ['ch4', 'Na příjezdové cestě u závory jsou otisky pneumatik širšího vozidla, které zde otáčelo.'],
          ['ch5', 'Chatařka Alena Pokorná z chaty č. 9 hlídce sdělila, že v noci slyšela auto.', 't']
        ]]
      },
      {
        id: 'c-ohl', typ: 'ohledani', nazev: 'Protokol o ohledání místa', datum: '1. 11. 2026 10:30–12:10',
        hlava: [['Místo', 'chata č. 14, osada Pod Skalkou'], ['Provedl', 'technik npor. Eva Krejčí (smyšlená)']],
        text: [[
          ['cp1', 'Podle záznamu meteostanice osady pršelo v sobotu od 19:10 do 23:30, potom bylo sucho.'],
          ['cp2', 'Šlápoty pod oknem mají ostré hrany a nejsou rozmyté deštěm; vznikly tedy nejspíš až po 23:30.'],
          ['cp3', 'Délka otisku podrážky je 29 cm, což odpovídá obuvi velikosti 43 až 44.']
        ], [
          ['cp4', 'Uvnitř je převrácená skříňka v předsíni, ostatní místnosti jsou bez zjevné manipulace.'],
          ['cp5', 'U okna leží nedopalek cigarety, zajištěn pro analýzu DNA.']
        ]]
      },
      {
        id: 'c-sto', typ: 'stopy', nazev: 'Seznam zajištěných stop', datum: '1. 11. 2026',
        tabulka: {
          sloupce: ['Č.', 'Stopa', 'Stav'],
          radky: [
            ['cs1', ['S1', 'otisk nástroje šířky 22 mm na rámu okna', 'fotografie a silikonový odlitek']],
            ['cs2', ['S2', 'šlápoty se vzorem rybí kosti, délka 29 cm', 'sádrový odlitek']],
            ['cs3', ['S3', 'otisky pneumatik u závory', 'fotografie; rozchod kol odpovídá dodávce']],
            ['cs4', ['S4', 'nedopalek cigarety', 'DNA – výsledek zatím není k dispozici']],
            ['cs5', ['S5', 'záznam fotopasti z lesní cesty', 'vydal myslivec Bohumil Říha']]
          ]
        }
      },
      {
        id: 'c-foto', typ: 'foto', nazev: 'Fotodokumentace', datum: '1. 11. 2026',
        text: [[
          ['cf1', 'Foto 1: vypáčené zadní okno, na rámu otlačená hrana nástroje.', 'o', 'okno'],
          ['cf2', 'Foto 2: šlápota v blátě s měřítkem, vzor rybí kosti, délka 29 cm.', 'o', 'slapota'],
          ['cf3', 'Foto 3: otisk pneumatiky u závory, dezén s příčnými drážkami.', 'o', 'pneu']
        ]]
      },
      {
        id: 'c-fp', typ: 'kamera', nazev: 'Záznam fotopasti na lesní cestě', datum: '31. 10.–1. 11. 2026',
        hlava: [['Zdroj', 'fotopast myslivce B. Říhy, lesní cesta 1 km pod osadou (jediná příjezdová cesta)'], ['Pozor', 'čas je čas fotopasti']],
        tabulka: {
          sloupce: ['Čas na snímku', 'Co je vidět'], cas: 0,
          radky: [
            ['cf_1', ['31. 10. 21:14', 'Srna přechází cestu.']],
            ['cf_2', ['1. 11. 01:47', 'Bílá dodávka jede směrem k osadě; registrační značka nečitelná, na boku tmavý nápis, čitelné jsou části „…ON – ZEDN…“.']],
            ['cf_3', ['1. 11. 01:58', 'Tatáž bílá dodávka jede od osady směrem k Lomničce; v kabině je vidět jen řidič.']],
            ['cf_4', ['1. 11. 02:58', 'Bílá dodávka s nápisem „…ON – ZEDN…“ jede znovu k osadě.']],
            ['cf_5', ['1. 11. 03:13', 'Bílá dodávka jede od osady k Lomničce; v kabině jsou dvě osoby.']],
            ['cf_6', ['1. 11. 10:09', 'Tmavé osobní auto jede k osadě.']],
            ['cf_7', ['1. 11. 11:04', 'Policejní vůz jede k osadě.']]
          ]
        },
        pozn: [['cf_8', 'Myslivec Říha uvedl, že hodiny fotopasti nastavuje ručně a na zimní čas je po 25. 10. ještě nepřestavil.', 't']]
      },
      {
        id: 'c-pok', typ: 'vypoved', nazev: 'Výpověď svědkyně – Alena Pokorná', datum: '1. 11. 2026 11:00',
        hlava: [['Vyslýchaná', 'Alena Pokorná, 63 let, chata č. 9'], ['Postavení', 'svědkyně']],
        text: [[
          ['ca1', 'Na chatě č. 9 jsem byla celý víkend sama se psem.'],
          ['ca2', 'Kolem jedné v noci mě vzbudil pes, slyšela jsem motor většího auta a viděla světla dole u závory; auto pak odjelo.'],
          ['ca3', 'Později, nevím přesně kdy, přijelo znovu a za chvíli odjelo; ven jsem se bála jít.'],
          ['ca4', 'Pana Duška znám od vidění, dělal panu Sedláčkovi v létě střechu.']
        ]]
      },
      {
        id: 'c-dus', typ: 'vypoved', nazev: 'Výpověď podezřelého – Marek Dušek', datum: '2. 11. 2026 9:00',
        hlava: [['Vyslýchaný', 'Marek Dušek, 34 let'], ['Postavení', 'podezřelý, poučen o právech']],
        text: [[
          ['cd1', 'V sobotu jsem přišel kolem osmé večer k Radku Hronovi do Zahradní 9 v Lomničce, dívali jsme se na hokej a pak jsem u něj přespal.'],
          ['cd2', 'Celou noc jsem byl u Radka, ven jsme nevyšli.'],
          ['cd3', 'Telefon jsem měl celou noc u Radka v kuchyni na nabíječce.']
        ], [
          ['cd4', 'K chatě pana Sedláčka jsem nejel od července, kdy jsem tam dělal střechu.'],
          ['cd5', 'Nosím boty velikosti 42.'],
          ['cd6', 'Ráno jsem od Radka odešel asi v devět domů.']
        ]]
      },
      {
        id: 'c-hro', typ: 'vypoved', nazev: 'Výpověď svědka – Radek Hron', datum: '2. 11. 2026 11:00',
        hlava: [['Vyslýchaný', 'Radek Hron, 36 let, Zahradní 9, Lomnička'], ['Postavení', 'svědek, poučen o právu odepřít výpověď']],
        text: [[
          ['cr1', 'Marek přišel v sobotu kolem osmé, koukali jsme na hokej a kolem půlnoci jsme šli spát.'],
          ['cr2', 'Celou noc byl u mě, nikam neodešel.'],
          ['cr3', 'Dodávka stála celou noc před domem, já jsem nikam nejel.'],
          ['cr4', 'Dělám zedníka, na dodávce mám nápis HRON – ZEDNICKÉ PRÁCE.']
        ], [
          ['cr5', 'Marek nosí čtyřicet trojky, minulý měsíc jsem mu kupoval pracovní boty.'],
          ['cr6', 'V garáži mám jen svoje nářadí, žádnou cizí centrálu tam nemám.']
        ]]
      },
      {
        id: 'c-hov', typ: 'hovory', nazev: 'Výpis hovorů – číslo M. Duška', datum: '31. 10.–1. 11. 2026',
        hlava: [['Číslo', '+420 700 555 731 (uživatel Marek Dušek)'], ['Zdroj', 'výpis operátora']],
        tabulka: {
          sloupce: ['Čas', 'Směr', 'Protistrana', 'Délka', 'Buňka'], cas: 0,
          radky: [
            ['cv1', ['31. 10. 19:52', 'odchozí hovor', '+420 700 555 842 (R. Hron)', '44 s', 'Lomnička-střed']],
            ['cv2', ['1. 11. 01:49', 'odchozí hovor', '+420 700 555 842 (R. Hron)', '21 s', 'Skalka-les']],
            ['cv3', ['1. 11. 09:12', 'odchozí hovor', '+420 700 555 390', '1 min 05 s', 'Lomnička-střed']]
          ]
        },
        pozn: [['cv4', 'Buňka Skalka-les pokrývá lesní cesty a chatovou osadu Pod Skalkou, Zahradní ulici v Lomničce nepokrývá.']]
      },
      {
        id: 'c-pol', typ: 'poloha', nazev: 'Polohová data telefonu M. Duška', datum: '31. 10.–1. 11. 2026',
        hlava: [['Zdroj', 'extrakce z telefonu zajištěného 2. 11.']],
        tabulka: {
          sloupce: ['Čas', 'Místo', 'Přesnost'], cas: 0,
          radky: [
            ['cg1', ['31. 10. 20:04', 'Lomnička, Zahradní 9', '±20 m']],
            ['cg2', ['31. 10. 23:41', 'Lomnička, Zahradní 9', '±20 m']],
            ['cg3', ['1. 11. 00:52', 'osada Pod Skalkou, u chaty č. 14', '±30 m']],
            ['cg4', ['1. 11. 01:35', 'osada Pod Skalkou, u chaty č. 14', '±25 m']],
            ['cg5', ['1. 11. 02:09', 'lesní cesta pod osadou', '±60 m']],
            ['cg6', ['1. 11. 02:24', 'Lomnička, Zahradní 9', '±20 m']]
          ]
        }
      },
      {
        id: 'c-uct', typ: 'uctenka', nazev: 'Účtenka – čerpací stanice U Rybníka', datum: '31. 10. 2026',
        text: [[
          ['cu1', 'Čerpací stanice U Rybníka, Lomnička.'],
          ['cu2', 'Datum a čas: 31. 10. 2026 23:58.'],
          ['cu3', 'Nafta 40,12 l × 35,20 Kč, celkem 1 412,22 Kč, placeno kartou ****8830.'],
          ['cu4', 'Podle sdělení banky je karta ****8830 vydána na jméno Radek Hron.']
        ]]
      },
      {
        id: 'c-proh', typ: 'zaznam', nazev: 'Úřední záznam o prohlídce garáže a dodávky', datum: '3. 11. 2026 8:00–9:30',
        hlava: [['Místo', 'garáž domu Zahradní 9, Lomnička, a dodávka R. Hrona'], ['Přítomen', 'Radek Hron']],
        text: [[
          ['cz1', 'V garáži nalezena elektrocentrála Volta 2200 s výrobním číslem 22-118473.'],
          ['cz2', 'V ložném prostoru dodávky nalezeno páčidlo s plochým břitem šířky 22 mm a zbytky bláta.'],
          ['cz3', 'V předsíni domu stála pracovní obuv velikosti 43 se vzorem podrážky rybí kost; Dušek na místě uvedl, že boty jsou jeho.'],
          ['cz4', 'Při předběžném porovnání se sádrovým odlitkem S2 se shoduje vzor i velikost podrážky.'],
          ['cz5', 'Motorová pila, pruty ani whisky nalezeny nebyly.']
        ]]
      }
    ],
    rozpory: [
      {
        id: 'cR1', nazev: 'Duškovo alibi × poloha a hovor jeho telefonu',
        pary: [['cd2', 'cg3'], ['cd2', 'cg4'], ['cd2', 'cg5'], ['cd2', 'cv2'], ['cd3', 'cg3'], ['cd3', 'cg4'], ['cd3', 'cg5'], ['cd3', 'cv2'], ['cd1', 'cg3'], ['cd1', 'cg4']],
        napoveda: 'Kde byl Duškův telefon mezi půlnocí a druhou hodinou?',
        vysvetleni: 'Dušek tvrdí, že byl celou noc u Hrona a telefon nechal na nabíječce. Telefon je ale v 00:52 a 01:35 u chaty č. 14, ve 02:09 na lesní cestě a v 01:49 z něj odešel hovor přes buňku Skalka-les. Telefon „na nabíječce“ by sám do lesa neodjel a nevolal.'
      },
      {
        id: 'cR2', nazev: 'Hronovo alibi pro Duška × data',
        pary: [['cr2', 'cg3'], ['cr2', 'cg4'], ['cr2', 'cg5'], ['cr2', 'cv2']],
        napoveda: 'Hron Duškovi kryje záda. Odpovídá jeho tvrzení technickým datům?',
        vysvetleni: 'Hron potvrzuje, že Dušek byl celou noc u něj. Data Duškova telefonu i hovor z buňky Skalka-les v 01:49 to vyvracejí. Alibi od blízkého kamaráda je tvrzení, ne ověřený fakt – a tady je v rozporu s nezávislými daty.'
      },
      {
        id: 'cR3', nazev: '„Nikam jsem nejel“ × tankování a fotopast',
        pary: [['cr3', 'cu2'], ['cr3', 'cu4'], ['cr3', 'cu3'], ['cr3', 'cf_2'], ['cr3', 'cf_3'], ['cr3', 'cf_4'], ['cr3', 'cf_5']],
        napoveda: 'Kdo a kdy platil v sobotu v noci za naftu?',
        vysvetleni: 'Hron tvrdí, že dodávka stála celou noc a on nikam nejel. Ve 23:58 ale tankuje jeho kartou 40 l nafty a fotopast na jediné příjezdové cestě zachytila bílou dodávku s nápisem „…ON – ZEDN…“, který odpovídá jeho reklamě „HRON – ZEDNICKÉ PRÁCE“.'
      },
      {
        id: 'cR4', nazev: 'Velikost bot: Dušek × Hron × prohlídka',
        pary: [['cd5', 'cr5'], ['cd5', 'cz3']],
        napoveda: 'Shodnou se Dušek a Hron i na tak obyčejné věci, jako je číslo bot?',
        vysvetleni: 'Dušek uvádí velikost 42, šlápoty u chaty odpovídají 43–44. Jeho kamarád ale řekne, že Dušek nosí 43, a při prohlídce se našla Duškova obuv velikosti 43 se shodným vzorem. Drobná lež, která má podezřelého „vzdálit“ od stopy.'
      },
      {
        id: 'cR5', nazev: '„U chaty jsem nebyl od července“ × stopy a poloha',
        pary: [['cd4', 'cz4'], ['cd4', 'cg3'], ['cd4', 'cg4']],
        napoveda: 'Co prozradila prohlídka o botách a co poloha telefonu o noci?',
        vysvetleni: 'Dušek popírá, že by u chaty od července byl. Jeho telefon tam ale v noci byl dvakrát a jeho boty se vzorem i velikostí shodují se šlápotami, které podle protokolu vznikly až po 23:30 (protokol o ohledání) – nemohly tedy zůstat z léta.'
      },
      {
        id: 'cR6', nazev: '„Žádnou cizí centrálu nemám“ × nález v garáži',
        pary: [['cr6', 'cz1']],
        napoveda: 'Porovnej výrobní čísla.',
        vysvetleni: 'Hron popírá, že má v garáži cizí centrálu, ale právě tam se našla elektrocentrála s výrobním číslem 22-118473, které Sedláček uvedl v oznámení (oznámení). Výrobní číslo je jednoznačný identifikátor.'
      }
    ],
    zdanlive: [
      { pary: [['cf_2', 'cg3'], ['cf_2', 'ca2'], ['cf_5', 'cg6'], ['cf_5', 'cg5'], ['cf_3', 'cg3'], ['cf_4', 'cv2'], ['cf_4', 'cg4']], vysvetleni: 'Není to rozpor. Fotopast jde o hodinu napřed – myslivec ji nepřestavil na zimní čas. Ověřit se to dá kalibrací: Sedláček přijel v 9:15, fotopast ho má v 10:09; hlídka přijela v 10:05, fotopast ji má v 11:04. Skutečné časy dodávky jsou tedy 00:47, 00:58, 01:58 a 02:13 a sedí s polohou telefonu i s hovorem v 01:49.' },
      { pary: [['cf_6', 'co1'], ['cf_7', 'ch1']], vysvetleni: 'Není to rozpor, ale klíč k případu: rozdíl přesně jedné hodiny ukazuje, že fotopast nemá přestavený zimní čas. Tyto dva snímky slouží jako kalibrace hodin fotopasti.' },
      { pary: [['cr1', 'cu2']], vysvetleni: 'Sám o sobě to rozpor není: kdo ve 23:58 natankuje, může jít „kolem půlnoci“ spát. Skutečný rozpor vzniká až s tvrzením, že Hron nikam nejel (jeho výpověď).' },
      { pary: [['ca3', 'cf_4']], vysvetleni: 'Není to rozpor. Svědkyně čas druhého příjezdu nezná („nevím přesně kdy“), takže jí žádný údaj neodporuje.' }
    ],
    zaver: [
      {
        id: 'kdo', otazka: 'Kdo se na činu podílel?',
        moznosti: [['a', 'Marek Dušek sám'], ['b', 'Radek Hron sám'], ['c', 'Dušek vnikl do chaty, Hron ho dodávkou přivezl a odvezl s věcmi a pak mu dal falešné alibi'], ['d', 'Neznámý pachatel, oba jsou nevinní']],
        spravne: 'c', dukazy: ['cg3', 'cg4', 'cv2', 'cz1', 'cz2', 'cz4', 'cu4', 'cf_2', 'cf_5'],
        klamne: [],
        vysvetleni: 'Duškův telefon je u chaty, jeho boty odpovídají šlápotám. Hronova dodávka (tankování, fotopast, páčidlo 22 mm v ložném prostoru) jezdí v noci dvakrát k osadě a centrála ze chaty je v Hronově garáži. Hron Duškovi kryje alibi, které data vyvracejí.'
      },
      {
        id: 'kdy', otazka: 'Kdy k vloupání došlo (skutečný čas)?',
        moznosti: [['a', '31. 10. mezi 19:10 a 23:30, během deště'], ['b', '1. 11. přibližně mezi 0:50 a 2:15'], ['c', '1. 11. přibližně mezi 1:45 a 3:15, jak ukazuje fotopast'], ['d', '1. 11. ráno před příjezdem majitele v 9:15']],
        spravne: 'b', dukazy: ['cg3', 'cg4', 'cg5', 'cp2', 'cf_8', 'cf_6', 'cf_7', 'ca2', 'cv2'],
        klamne: [],
        vysvetleni: 'Šlápoty vznikly po skončení deště (protokol o ohledání). Telefon je u chaty od 00:52 do 01:35, v 01:49 volá Hronovi, ve 02:09 je na cestě. Fotopast jde o hodinu napřed (kalibrace podle majitele a hlídky), skutečné časy dodávky jsou 00:47–02:13.'
      },
      {
        id: 'jak', otazka: 'Jak pachatelé postupovali?',
        moznosti: [['a', 'Vypáčili zadní okno plochým páčidlem 22 mm a věci odvezli dodávkou'], ['b', 'Dušek odemkl dveře klíčem, který si nechal od léta'], ['c', 'Rozbili okno kamenem a věci odnesli pěšky'], ['d', 'Majitel krádež nafingoval kvůli pojistce']],
        spravne: 'a', dukazy: ['ch2', 'cs1', 'cz2', 'cf1', 'cs3', 'ch4'],
        klamne: [],
        vysvetleni: 'Otisk nástroje na rámu má šířku 22 mm, stejně jako páčidlo z Hronovy dodávky. U závory otáčelo širší vozidlo s rozchodem dodávky.'
      },
      {
        id: 'slabe', otazka: 'Co je na tomto případu nejslabší místo?',
        moznosti: [
          ['a', 'Fotopast nečte registrační značku a svědkyně auto nepoznala – přítomnost Hronovy dodávky stojí na části nápisu a nepřímých stopách; DNA z nedopalku zatím chybí a pila s pruty se nenašly.'],
          ['b', 'Hovor trval jen 21 sekund, takže výpis hovorů je bezcenný.'],
          ['c', 'Fotopast ukazuje vloupání až po 1:45, takže Dušek musí být nevinný.'],
          ['d', 'Hron je svědek, a jeho výpověď proto nelze zpochybnit.']
        ],
        spravne: 'a', dukazy: ['cf_2', 'cs4', 'cz5', 'ca3'],
        klamne: [],
        vysvetleni: 'Časy fotopasti jdou opravit kalibrací. Slabinou je identifikace dodávky jen podle části nápisu, chybějící výsledek DNA a nenalezená část věcí – u soudu by se obhajoba ptala právě na to.'
      }
    ],
    pouceni: [
      'Každé časové razítko má svůj zdroj a svou chybu. Než z času vyvodíš závěr, najdi kalibraci – tady ji poskytly snímky majitele a hlídky.',
      'Alibi od blízké osoby je tvrzení. Váhu má teprve tehdy, když ho potvrdí nezávislý zdroj – tady ho nezávislé zdroje vyvracejí.',
      'Malé lži (číslo bot) jsou cenné: ukazují, že podezřelý ví, které stopy jsou pro něj nebezpečné.',
      'Fyzikální okolnosti (déšť do 23:30, nerozmyté šlápoty) umí zúžit čas činu bez jakékoli techniky.'
    ]
  });

  /* ===================================================================
     3) TĚŽKÝ – Prázdný trezor ve stavebninách
     =================================================================== */
  PRIPADY.push({
    id: 'trezor',
    nazev: 'Prázdný trezor ve stavebninách',
    obtiznost: 3,
    rok: 2026,
    limitMin: 35,
    znacka: 'KRPT-5023/TČ-2026 (cvičný)',
    uvod: 'V pondělí 16. 11. 2026 našel jednatel firmy Stavebniny Javorník s.r.o. v Bělovicích otevřený prázdný trezor. Chybí prý páteční tržba 186 400 Kč. U trezoru ležela rukavice skladníka. Na úterý byla ohlášená kontrola pokladny. Pozor: ne každá stopa je taková, jak vypadá.',
    osoby: [
      ['Jaroslav Bureš', '52 let, jednatel firmy'],
      ['Ivana Machalová', '44 let, účetní a pokladní, Lipová 22, Bělovice'],
      ['Libor Štěpánek', '29 let, skladník, Polní 5, Bělovice'],
      ['Josef Kratochvíl', '61 let, hostinský, hospoda U Splavu']
    ],
    dokumenty: [
      {
        id: 't-ozn', typ: 'oznameni', nazev: 'Oznámení jednatele', datum: '16. 11. 2026 7:20',
        hlava: [['Přijato', 'osobně na obvodním oddělení Bělovice'], ['Oznamovatel', 'Jaroslav Bureš, jednatel Stavebniny Javorník s.r.o. (smyšlená firma)']],
        text: [[
          ['to1', 'Jednatel Jaroslav Bureš uvedl, že v pondělí 16. 11. v 7:05 našel v kanceláři otevřený trezor bez známek násilí.'],
          ['to2', 'Podle účetní Ivany Machalové v něm měla být páteční tržba 186 400 Kč, trezor je prázdný.'],
          ['to3', 'Kód trezoru zná jen on a Machalová; kód měnil 2. 11.'],
          ['to4', 'Zadní vchod ze dvora se otevírá čipovými kartami; náhradní karta č. 11 je uložená v zásuvce stolu účetní, on sám žádnou náhradní kartu nemá.']
        ], [
          ['to5', 'Na úterý 17. 11. je ohlášená kontrola pokladny externí auditorkou.'],
          ['to6', 'V pátek ve 14:00 odjel s manželkou na hory do Rokytné, vrátil se v neděli kolem 18:00.']
        ]]
      },
      {
        id: 't-hli', typ: 'zaznam', nazev: 'Úřední záznam hlídky', datum: '16. 11. 2026 8:10',
        hlava: [['Sepsal', 'prap. Petr Sýkora (smyšlený)']],
        text: [[
          ['th1', 'Trezor v kanceláři je otevřený, zámek ani dvířka nejsou poškozené.'],
          ['th2', 'Na podlaze asi 40 cm před trezorem leží pravá pracovní rukavice, na manžetě je fixou napsáno ŠTĚPÁNEK.'],
          ['th3', 'Účetní Machalová na místě uvedla, že rukavice patří skladníkovi Štěpánkovi, který se poslední dobou vyptával na trezor.', 't'],
          ['th4', 'Nalezená rukavice svědčí o tom, že pachatelem je skladník Libor Štěpánek.', 't'],
          ['th5', 'Budova nemá zabezpečovací systém, jen čipový zámek zadních dveří.']
        ]]
      },
      {
        id: 't-ohl', typ: 'ohledani', nazev: 'Protokol o ohledání', datum: '16. 11. 2026 9:00–11:30',
        hlava: [['Místo', 'kancelář, chodba a šatna, Stavebniny Javorník, Bělovice'], ['Provedl', 'technik nprap. Ilona Vávrová (smyšlená)']],
        text: [[
          ['tp1', 'Trezor má elektronický zámek s pamětí událostí; paměť vyčetl servisní technik (viz výpis).'],
          ['tp2', 'Šatna zaměstnanců je přístupná z chodby bez klíče, regál s přihrádkami se nezamyká.'],
          ['tp3', 'V přihrádce označené ŠTĚPÁNEK leží levá pracovní rukavice stejného typu a velikosti jako pravá rukavice u trezoru.']
        ], [
          ['tp4', 'Zásuvka stolu účetní je nezamčená, náhradní karta č. 11 v ní leží.'],
          ['tp5', 'Na trezoru ani na zásuvce nejsou použitelné otisky prstů, povrchy jsou setřené.']
        ]]
      },
      {
        id: 't-sto', typ: 'stopy', nazev: 'Seznam zajištěných stop', datum: '16. 11. 2026',
        tabulka: {
          sloupce: ['Č.', 'Stopa', 'Stav'],
          radky: [
            ['ts1', ['S1', 'pravá pracovní rukavice „ŠTĚPÁNEK“ (u trezoru)', 'zajištěna, DNA – výsledek zatím není']],
            ['ts2', ['S2', 'levá pracovní rukavice (šatna, přihrádka Štěpánek)', 'zajištěna k porovnání']],
            ['ts3', ['S3', 'výpis paměti zámku trezoru', 'vyčten servisním technikem, otisk SHA-256 zaznamenán']],
            ['ts4', ['S4', 'výpis přístupového systému zadních dveří', 'vyčten správcem systému']],
            ['ts5', ['S5', 'záznam městské kamery, křižovatka Mlýnská × Husova', 'vydán městskou policií']],
            ['ts6', ['S6', 'pokladní kniha 10–11/2026 a výpis z účtu firmy', 'zajištěny']]
          ]
        }
      },
      {
        id: 't-foto', typ: 'foto', nazev: 'Fotodokumentace', datum: '16. 11. 2026',
        text: [[
          ['tf1', 'Foto 1: otevřený trezor, dvířka bez stop po páčení, displej zámku zhasnutý.', 'o', 'trezor'],
          ['tf2', 'Foto 2: pravá rukavice na podlaze před trezorem, nápis na manžetě.', 'o', 'rukavice'],
          ['tf3', 'Foto 3: regál v šatně, v přihrádce ŠTĚPÁNEK jen levá rukavice.', 'o', 'regal']
        ]]
      },
      {
        id: 't-trez', typ: 'data', nazev: 'Výpis paměti zámku trezoru', datum: '13.–16. 11. 2026',
        hlava: [['Vyčetl', 'servisní technik výrobce zámku, 16. 11. 10:20']],
        tabulka: {
          sloupce: ['Datum a čas', 'Událost'], cas: 0,
          radky: [
            ['tt1', ['13. 11. 07:58', 'otevřeno platným kódem']],
            ['tt2', ['13. 11. 08:03', 'zavřeno']],
            ['tt3', ['13. 11. 11:02', 'otevřeno platným kódem']],
            ['tt4', ['13. 11. 11:05', 'zavřeno']],
            ['tt5', ['13. 11. 21:16', 'otevřeno platným kódem']]
          ]
        },
        pozn: [
          ['tt6', 'Mezi 11:05 a 21:16 dne 13. 11. zámek nezaznamenal žádnou událost; po 21:16 už nebyl zavřen.'],
          ['tt7', 'Zámek nerozlišuje, kdo kód zadal; zaznamenává jen platný či neplatný kód.'],
          ['tt8', 'Hodiny zámku se při vyčtení lišily od přesného času o 40 s.']
        ]
      },
      {
        id: 't-dve', typ: 'data', nazev: 'Výpis přístupového systému zadních dveří', datum: '13.–16. 11. 2026',
        hlava: [['Vyčetl', 'správce systému, 16. 11. 10:45'], ['Poznámka', 'systém zapisuje každé otevření dveří kartou zvenku i zevnitř']],
        tabulka: {
          sloupce: ['Datum a čas', 'Karta', 'Držitel podle evidence'], cas: 0,
          radky: [
            ['td1', ['13. 11. 06:52', 'č. 03', 'I. Machalová']],
            ['td2', ['13. 11. 06:55', 'č. 07', 'L. Štěpánek']],
            ['td3', ['13. 11. 15:31', 'č. 07', 'L. Štěpánek']],
            ['td4', ['13. 11. 16:57', 'č. 03', 'I. Machalová']],
            ['td5', ['13. 11. 21:12', 'č. 11', 'náhradní karta (bez držitele)']],
            ['td6', ['13. 11. 21:24', 'č. 11', 'náhradní karta (bez držitele)']],
            ['td7', ['16. 11. 07:02', 'č. 01', 'J. Bureš']]
          ]
        }
      },
      {
        id: 't-kam', typ: 'kamera', nazev: 'Záznam městské kamery', datum: '13. 11. 2026',
        hlava: [['Zdroj', 'kamera městské policie, křižovatka Mlýnská × Husova, 350 m od stavebnin'], ['Čas', 'synchronizovaný se sítí']],
        tabulka: {
          sloupce: ['Čas', 'Co je vidět'], cas: 0,
          radky: [
            ['tk1', ['21:05:12', 'Červený hatchback jede Mlýnskou ulicí směrem ke stavebninám; registrační značka částečně čitelná: 5B4 31..']],
            ['tk2', ['21:29:40', 'Červený hatchback, značka 5B4 31.., jede opačným směrem.']]
          ]
        },
        pozn: [
          ['tk3', 'Řidiče nelze rozpoznat; ve tmě a dešti je čitelná jen část registrační značky.'],
          ['tk4', 'Lustrace v registru vozidel: ze 14 vozidel se značkou začínající 5B4 31 je červený hatchback jediný – 5B4 3127, provozovatelka Ivana Machalová.']
        ]
      },
      {
        id: 't-mach', typ: 'vypoved', nazev: 'Výpověď svědkyně – Ivana Machalová', datum: '16. 11. 2026 13:00',
        hlava: [['Vyslýchaná', 'Ivana Machalová, 44 let, Lipová 22, Bělovice'], ['Postavení', 'svědkyně']],
        text: [[
          ['tm1', 'V pátek jsem kvůli nemoci dcery nestihla do banky, a tak jsem tržbu 186 400 Kč v 16:40 uložila do trezoru.'],
          ['tm2', 'Z práce jsem odešla v 16:55 a celý večer jsem byla doma v Lipové 22, nikam jsem nejela.'],
          ['tm3', 'Rukavice jsou Libora Štěpánka, nosí je pořád za pasem, i domů.']
        ], [
          ['tm4', 'Náhradní karta je uložená u pana Bureše.'],
          ['tm5', 'Libor se mě minulý týden ptal, kolik tržby v trezoru přes víkend bývá.'],
          ['tm6', 'Pokladní knihu vedu pečlivě a všechny tržby odvádím do banky v plné výši.']
        ]]
      },
      {
        id: 't-step', typ: 'vypoved', nazev: 'Výpověď podezřelého – Libor Štěpánek', datum: '16. 11. 2026 15:00',
        hlava: [['Vyslýchaný', 'Libor Štěpánek, 29 let, Polní 5, Bělovice'], ['Postavení', 'podezřelý, poučen o právech']],
        text: [[
          ['tl1', 'V pátek jsem odešel z práce v půl čtvrté, rukavice jsem jako vždycky nechal v šatně v přihrádce.'],
          ['tl2', 'Večer jsem byl od půl osmé do jedenácti v hospodě U Splavu, hráli jsme mariáš.'],
          ['tl3', 'Kód od trezoru neznám a na tržby jsem se paní Machalové nikdy neptal.'],
          ['tl4', 'Mám kartu č. 07 a nikomu ji nepůjčuju.']
        ]]
      },
      {
        id: 't-krat', typ: 'vypoved', nazev: 'Výpověď svědka – Josef Kratochvíl', datum: '17. 11. 2026 10:00',
        hlava: [['Vyslýchaný', 'Josef Kratochvíl, 61 let, hostinský, hospoda U Splavu'], ['Postavení', 'svědek']],
        text: [[
          ['tj1', 'Libor Štěpánek přišel v pátek chvíli po půl osmé a hrál mariáš u stolu u okna.'],
          ['tj2', 'Odešel kolem jedenácté, předtím zaplatil kartou.'],
          ['tj3', 'Celý večer jsem ho měl na očích, ven nechodil, jen na záchod.']
        ]]
      },
      {
        id: 't-hov', typ: 'hovory', nazev: 'Výpis hovorů – číslo I. Machalové', datum: '13. 11. 2026',
        hlava: [['Číslo', '+420 700 555 466 (uživatelka Ivana Machalová)'], ['Zdroj', 'výpis operátora']],
        tabulka: {
          sloupce: ['Čas', 'Směr', 'Protistrana', 'Délka', 'Buňka'], cas: 0,
          radky: [
            ['tc1', ['18:02', 'odchozí hovor', '+420 700 555 610 (sestra)', '4 min 10 s', 'Bělovice-jih']],
            ['tc2', ['21:07', 'příchozí hovor', '+420 700 555 610 (sestra)', 'nepřijat', 'Bělovice-jih']],
            ['tc3', ['21:41', 'odchozí hovor', '+420 700 555 610 (sestra)', '2 min 35 s', 'Bělovice-jih']]
          ]
        },
        pozn: [['tc4', 'Buňka Bělovice-jih pokrývá Lipovou ulici; areál stavebnin leží v dosahu buňky Bělovice-nádraží.']]
      },
      {
        id: 't-pol', typ: 'poloha', nazev: 'Polohová data telefonů', datum: '13. 11. 2026',
        hlava: [['Zdroj', 'export z telefonů I. Machalové a L. Štěpánka, vydány dobrovolně']],
        tabulka: {
          sloupce: ['Čas', 'Telefon', 'Místo', 'Přesnost'], cas: 0,
          radky: [
            ['tg1', ['17:12', 'Machalová', 'Bělovice, Lipová 22 (byt)', '±15 m']],
            ['tg2', ['19:28', 'Štěpánek', 'Bělovice, hospoda U Splavu', '±20 m']],
            ['tg3', ['21:10', 'Štěpánek', 'Bělovice, hospoda U Splavu', '±20 m']],
            ['tg4', ['21:15', 'Machalová', 'Bělovice, Lipová 22 (byt)', '±15 m']],
            ['tg5', ['21:40', 'Štěpánek', 'Bělovice, hospoda U Splavu', '±25 m']],
            ['tg6', ['23:00', 'Machalová', 'Bělovice, Lipová 22 (byt)', '±15 m']],
            ['tg7', ['23:04', 'Štěpánek', 'Bělovice, Polní 5 (byt)', '±20 m']]
          ]
        },
        pozn: [['tg8', 'Hospoda U Splavu je od stavebnin vzdálená 2,1 km, byt v Lipové 22 asi 4 km.']]
      },
      {
        id: 't-dokl', typ: 'uctenka', nazev: 'Účtenky a doklady', datum: '13. 11. 2026',
        text: [[
          ['tu1', 'Hospoda U Splavu, Bělovice: 13. 11. 2026 22:47, 4× pivo, 2× topinka, celkem 312 Kč, placeno kartou ****2261.'],
          ['tu2', 'Podle sdělení banky je karta ****2261 vydána na jméno Libor Štěpánek.']
        ], [
          ['tu3', 'Hotel Horská louka, Rokytná: ubytování 13.–15. 11. 2026 pro 2 osoby, příjezd 13. 11. v 17:45, odjezd 15. 11. v 15:10, host Jaroslav Bureš.'],
          ['tu4', 'Rokytná je od Bělovic vzdálená asi 180 km.']
        ]]
      },
      {
        id: 't-kniha', typ: 'ucetni', nazev: 'Pokladní kniha a výpis z účtu (výňatek)', datum: '10–11/2026',
        hlava: [['Pokladní kniha', 'zápisy vede a podepisuje I. Machalová'], ['Výpis z účtu', 'vydala banka; vklady hotovosti provádí pokladní na přepážce']],
        tabulka: {
          sloupce: ['Datum', 'Doklad', 'Částka'],
          radky: [
            ['tb1', ['2. 10.', 'pokladní kniha – odvod tržby do banky', '98 400 Kč']],
            ['tb2', ['2. 10.', 'výpis z účtu – vklad hotovosti', '98 400 Kč']],
            ['tb3', ['23. 10.', 'pokladní kniha – odvod tržby do banky', '142 300 Kč']],
            ['tb4', ['23. 10.', 'výpis z účtu – vklad hotovosti', '92 300 Kč']],
            ['tb5', ['30. 10.', 'pokladní kniha – odvod tržby do banky', '117 900 Kč']],
            ['tb6', ['30. 10.', 'výpis z účtu – vklad hotovosti', '117 900 Kč']],
            ['tb7', ['6. 11.', 'pokladní kniha – odvod tržby do banky', '155 800 Kč']],
            ['tb8', ['6. 11.', 'výpis z účtu – vklad hotovosti', '105 800 Kč']],
            ['tb9', ['13. 11.', 'pokladní kniha – odvod neproveden, tržba uložena do trezoru', '186 400 Kč']]
          ]
        }
      }
    ],
    rozpory: [
      {
        id: 'tR1', nazev: '„V 16:40 jsem uložila tržbu do trezoru“ × paměť zámku',
        pary: [['tm1', 'tt6'], ['tm1', 'tt4'], ['tm1', 'tt5'], ['tb9', 'tt6']],
        napoveda: 'Kdy byl trezor v pátek otevřen? Sedí to s tím, co říká pokladní?',
        vysvetleni: 'Machalová tvrdí, že v 16:40 uložila tržbu do trezoru. Zámek ale mezi 11:05 a 21:16 nezaznamenal žádné otevření. Trezor se tedy v době „uložení“ vůbec neotevřel – peníze do něj odpoledne nikdo nedal. Odchylka hodin zámku 40 s na tom nic nemění.'
      },
      {
        id: 'tR2', nazev: '„Celý večer doma“ × městská kamera',
        pary: [['tm2', 'tk1'], ['tm2', 'tk2'], ['tm2', 'tk4']],
        napoveda: 'Jaké auto projelo v pátek večer kolem stavebnin a čí může být?',
        vysvetleni: 'Machalová tvrdí, že večer nikam nejela. Ve 21:05 a 21:29 ale kolem stavebnin projíždí červený hatchback se značkou 5B4 31.., a lustrace ukazuje, že takový je jediný – její. Časy přesně obklopují vstup náhradní kartou (21:12–21:24) a otevření trezoru (21:16).'
      },
      {
        id: 'tR3', nazev: '„Rukavice nosí za pasem“ × levá rukavice v šatně',
        pary: [['tm3', 'tp3'], ['tm3', 'tl1'], ['tm3', 'ts2']],
        napoveda: 'Kde je druhá rukavice z páru?',
        vysvetleni: 'Machalová navádí, že Štěpánek nosí rukavice stále u sebe. Levá rukavice z téhož páru ale leží v jeho přihrádce v nezamčené šatně, kam má přístup kdokoli. Pravá rukavice se k trezoru mohla dostat ze šatny – nemusel ji tam donést on.'
      },
      {
        id: 'tR4', nazev: 'Kde je náhradní karta: Machalová × Bureš × ohledání',
        pary: [['tm4', 'to4'], ['tm4', 'tp4']],
        napoveda: 'Kdo podle koho opatruje náhradní kartu č. 11?',
        vysvetleni: 'Machalová tvrdí, že náhradní karta je u jednatele. Jednatel i ohledání ukazují, že leží v nezamčené zásuvce jejího stolu. Právě touto kartou se ve 21:12 a 21:24 vcházelo a vycházelo zadními dveřmi.'
      },
      {
        id: 'tR5', nazev: 'Pokladní kniha × bankovní výpis',
        pary: [['tb3', 'tb4'], ['tb7', 'tb8'], ['tm6', 'tb4'], ['tm6', 'tb8']],
        napoveda: 'Porovnej odvody tržeb v pokladní knize s vklady na účtu, řádek po řádku.',
        vysvetleni: 'Podle pokladní knihy odvedla pokladní 23. 10. do banky 142 300 Kč a 6. 11. 155 800 Kč, na účet ale přišlo 92 300 a 105 800 Kč. Rozdíl 100 000 Kč chybí ještě před pátkem – a na úterý byla ohlášená kontrola pokladny (oznámení jednatele). To je motiv i jádro zpronevěry.'
      },
      {
        id: 'tR6', nazev: 'Závěr hlídky „pachatelem je Štěpánek“ × jeho poloha',
        pary: [['th4', 'tg3'], ['th4', 'tg5'], ['th4', 'tj3'], ['th4', 'td5'], ['th4', 'tj1']],
        napoveda: 'Mohl být Štěpánek v pátek mezi 21:12 a 21:24 ve stavebninách?',
        vysvetleni: 'Hlídka hned podle rukavice uzavřela, že pachatelem je Štěpánek – typické tunelové vidění. Jeho telefon je ve 21:10 i 21:40 v hospodě 2,1 km daleko, hostinský ho má celý večer na očích a do budovy se nevcházelo jeho kartou č. 07, ale náhradní kartou č. 11.'
      },
      {
        id: 'tR7', nazev: '„Vyptával se na tržby“ × „nikdy jsem se neptal“',
        pary: [['tm5', 'tl3'], ['th3', 'tl3']],
        napoveda: 'Dvě osoby říkají o jednom rozhovoru opak. Kdo z nich má důvod lhát?',
        vysvetleni: 'Tvrzení proti tvrzení: Machalová říká, že se Štěpánek vyptával na tržby, on to popírá. Samo o sobě to nerozhodne, ale v souvislosti s ostatními rozpory je vidět, že Machalová soustavně směruje podezření na Štěpánka.'
      }
    ],
    zdanlive: [
      { pary: [['tg4', 'tk1'], ['tg4', 'tk2'], ['tg1', 'tk1'], ['tg6', 'tk2']], vysvetleni: 'Na první pohled rozpor, ve skutečnosti obě data mohou platit: data ukazují polohu TELEFONU, ne osoby. Kdo si chystá alibi, nechá telefon doma. Rozporem je až tvrzení Machalové „nikam jsem nejela“ (její výpověď) proti kameře.' },
      { pary: [['tm2', 'tc2'], ['tm2', 'tc3']], vysvetleni: 'Sám o sobě to rozpor není – nepřijatý hovor může mít mnoho důvodů. Zapadá ale do obrazu: telefon byl celý večer doma (buňka Bělovice-jih), ve 21:07 ho nikdo nebral a zpětné volání přišlo ve 21:41, až po návratu auta z městské kamery (21:29).' },
      { pary: [['tj1', 'tg2']], vysvetleni: 'Není to rozpor. Hostinský odhaduje „chvíli po půl osmé“, telefon je u hospody v 19:28 – pár minut je běžná nepřesnost lidského odhadu.' },
      { pary: [['tm2', 'td4']], vysvetleni: 'Není to rozpor. „Odešla jsem v 16:55“ je odhad člověka, systém má 16:57 – dvě minuty jsou běžná nepřesnost.' },
      { pary: [['tt8', 'tt5'], ['tt5', 'td5']], vysvetleni: 'Není to rozpor. Odchylka hodin zámku 40 s je malá a pořadí událostí zůstává: vstup kartou 21:12, otevření trezoru 21:16, odchod 21:24.' },
      { pary: [['tj2', 'tu1'], ['tl2', 'tu1']], vysvetleni: 'Není to rozpor. Placeno ve 22:47, odchod „kolem jedenácté“ – to k sobě sedí.' },
      { pary: [['to3', 'tt5'], ['to6', 'tt5']], vysvetleni: 'Kód zná i jednatel, ale v době otevření trezoru (21:16) byl podle hotelového dokladu 180 km daleko (příjezd 17:45). Není to rozpor, jen důvod jednatele jako pachatele vyloučit – ideálně ještě ověřit u hotelu nezávisle.' }
    ],
    zaver: [
      {
        id: 'kdo', otazka: 'Kdo za ztrátou peněz stojí?',
        moznosti: [['a', 'Ivana Machalová – zpronevěru zakryla zinscenovanou krádeží'], ['b', 'Libor Štěpánek'], ['c', 'Jaroslav Bureš'], ['d', 'Štěpánek a Machalová společně'], ['e', 'Neznámý pachatel, který zjistil kód']],
        spravne: 'a', dukazy: ['tt6', 'tk1', 'tk2', 'tk4', 'td5', 'tb4', 'tb8', 'tp4', 'tp3'],
        klamne: ['th2', 'th4', 'ts1', 'tf2', 'th3'],
        vysvetleni: 'Na Machalovou ukazuje souhrn nezávislých zdrojů: v době „uložení“ se trezor neotevřel, její auto projíždí kolem v době vstupu náhradní kartou z jejího stolu, chybějící vklady v bance a ohlášená kontrola. Rukavice ani tvrzení hlídky nejsou důkazem proti Štěpánkovi.'
      },
      {
        id: 'kdy', otazka: 'Kdy byl trezor otevřen a „krádež“ připravena?',
        moznosti: [['a', 'v pátek mezi 16:40 a 16:55'], ['b', 'v pátek mezi 21:12 a 21:24'], ['c', 'o víkendu, kdy byla firma zavřená'], ['d', 'v pondělí ráno před 7:05']],
        spravne: 'b', dukazy: ['td5', 'td6', 'tt5', 'tk1', 'tk2'],
        klamne: ['tm1'],
        vysvetleni: 'Náhradní karta otevřela dveře ve 21:12 a 21:24, trezor se otevřel ve 21:16 a nikdy nezavřel. Kamera vidí auto ve 21:05 a 21:29 – časy do sebe zapadají.'
      },
      {
        id: 'jak', otazka: 'Co se s penězi pravděpodobně stalo?',
        moznosti: [
          ['a', 'V trezoru nebyly; peníze ubývaly při odvodech do banky a v pátek večer byla krádež zinscenována náhradní kartou, kódem a podstrčenou rukavicí.'],
          ['b', 'Štěpánek okoukal kód a v noci peníze vybral.'],
          ['c', 'Trezor byl otevřen násilím a peníze odneseny.'],
          ['d', 'Jednatel si peníze vzal před odjezdem na hory.']
        ],
        spravne: 'a', dukazy: ['tt6', 'tb4', 'tb8', 'to5', 'td5', 'tp4', 'th1'],
        klamne: ['th4'],
        vysvetleni: 'Trezor se po 11:05 do 21:16 neotevřel, takže páteční tržba se do něj nedostala. V bance chybí 100 000 Kč z dřívějších odvodů a v úterý měla přijít kontrola. „Krádež“ měla vysvětlit chybějící hotovost.'
      },
      {
        id: 'nastrcena', otazka: 'Která „usvědčující“ stopa je nastrčená?',
        moznosti: [['a', 'Pravá rukavice se jménem ŠTĚPÁNEK u trezoru'], ['b', 'Výpis paměti zámku trezoru'], ['c', 'Záznam městské kamery'], ['d', 'Pokladní kniha']],
        spravne: 'a', dukazy: ['tp3', 'tp2', 'tg3', 'tg5', 'tj3', 'td5', 'tl1'],
        klamne: [],
        vysvetleni: 'Druhá rukavice z páru leží v nezamčené šatně, kam může kdokoli. Štěpánek byl v době činu prokazatelně v hospodě a nevcházelo se jeho kartou. Rukavice je navíc „příliš výmluvná“ – podepsaná stopa přímo před trezorem, zatímco jinde jsou povrchy pečlivě setřené (protokol o ohledání).'
      },
      {
        id: 'slabe', otazka: 'Co je na tomto případu nejslabší místo?',
        moznosti: [
          ['a', 'U trezoru Machalovou nikdo neviděl a kamera nečte celou značku ani řidiče – závěr stojí na souhrnu nepřímých důkazů; je třeba ověřit, kdo další měl přístup k náhradní kartě a kódu, a počkat na DNA z rukavice.'],
          ['b', 'Výpis zámku je nespolehlivý kvůli odchylce hodin 40 s.'],
          ['c', 'Štěpánkovo alibi stojí na hostinském, takže rukavice ho usvědčuje.'],
          ['d', 'Pokladní kniha sama dokazuje krádež z trezoru.']
        ],
        spravne: 'a', dukazy: ['tk3', 'tt7', 'ts1', 'tp4'],
        klamne: [],
        vysvetleni: 'Odchylka 40 s je zanedbatelná. Slabinou je, že žádný jednotlivý důkaz Machalovou přímo neukazuje u trezoru: zámek nerozlišuje uživatele, náhradní karta ležela v nezamčené zásuvce a kamera vidí jen auto.'
      }
    ],
    pouceni: [
      'Stopa, která „sama ukazuje na pachatele“ (podepsaná rukavice, doklad na stole), si zaslouží zvláštní nedůvěru. Ptej se, kdo ji tam mohl dát a proč jinde nic není.',
      'První hypotéza hlídky („pachatelem je Štěpánek“) je jen hypotéza. Když se k ní začnou hledat jen potvrzující důkazy, vzniká tunelové vidění.',
      'Konfirmační zkreslení: Machalová nabídla vysvětlení dřív, než se kdo zeptal. Ochotně podané vodítko ověřuj stejně přísně jako cokoli jiného.',
      'Poloha telefonu není poloha člověka. Telefon nechaný doma je nejlevnější falešné alibi.',
      'Technické záznamy (zámek, karty, banka) jsou nezávislé na tom, co kdo říká – a v tomto případě se shodují proti výpovědi pokladní.'
    ]
  });

  koren.TP_PRIPADY = PRIPADY;
  if (typeof module !== 'undefined' && module.exports) module.exports = PRIPADY;
})(typeof window !== 'undefined' ? window : globalThis);

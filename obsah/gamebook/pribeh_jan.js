/* Gamebook „Svatojánská noc“ – data příběhu (vlastní text podle motivů českých pověstí, ilustrace z Codexu, obr_jan/).
   Stejný formát jako pribeh.js. Olej = svíčka v lucerně; kapradí květ svítí sám (`svetlo`).
   Text je ve 2. osobě přítomného času – hrdina nemá určený rod (hlídat příčestí a „sám/sama“). */
(function () {
  'use strict';
  const PRIBEH = {
    id: 'jan',
    nazev: 'Svatojánská noc',
    podtitul: 'Gamebook podle českých pověstí z podhůří Krkonoš',
    ikona: '🌿',
    klic: 'webapp_hra_gamebook_jan',
    obrazky: 'gamebook/obr_jan/',
    uvodObr: 'kapradi',
    nazvy: { olej: '🕯️ Svíčka v lucerně', zlato: '🪙 Krejcary' },
    pravidlo: '<b>Lucerna</b>: v lese svíčka ubývá. Když dohoří, bludičky tě odvedou do bažin – leda by ti svítilo něco, co nepotřebuje svíčku. <b>Zdraví</b> doplní babiččina buchta z torby.',
    start: '1', smrt: '99', tma: '95', svetlo: 'kvet',
    zacatek: { olej: 10, zlato: 3, predmety: ['buchta', 'buchta'] },
    predmety: {
      buchta: { nazev: '🥮 Babiččina buchta', popis: 'S povidly. Sníst: +4 zdraví.', pouziti: { zdravi: 4 }, spotrebni: true },
      svice: { nazev: '🕯️ Náhradní svíčka', popis: 'Od uhlíře. Vyměnit v lucerně: +4 světla.', pouziti: { olej: 4 }, spotrebni: true },
      sul: { nazev: '🧂 Uzlíček soli', popis: 'Sůl z požehnaného chleba. Zlé síly ji nesnesou.' },
      tabak: { nazev: '🍂 Dědečkův tabák', popis: 'Voňavý knaster v měchýřku.' },
      hrebinek: { nazev: '🪮 Babiččin hřebínek', popis: 'Starý, kostěný. Babička říká, že kdo ho hodí za sebe, tomu za zády vyroste les.' },
      kohout: { nazev: '🐓 Kohout Kokrhel', popis: 'Pod paží. Trochu se cuká.' },
      hul: { nazev: '🪵 Krakonošova hůl', popis: 'Suk z kosodřeviny. Když s ní udeříš o zem, hory odpovědí.' },
      kvet: { nazev: '🌸 Kapradí květ', popis: 'Svítí sám od sebe. Kdo ho má, rozumí řeči zvířat a vidí poklady.' },
      smlouva: { nazev: '📜 Čertova smlouva', popis: 'Podepsaná. Slibuje, co tě ráno doma první přivítá.' }
    },
    konce: {
      kvet: { nazev: 'Květ pro celý život', typ: 'vyhra', popis: 'Nejlepší konec' },
      anicka: { nazev: 'Anička je doma', typ: 'vyhra', popis: 'Dobrý konec' },
      zbabely: { nazev: 'Čekání do rána', typ: 'neutral', popis: 'Zůstat doma' },
      listi: { nazev: 'Zlato jako listí', typ: 'neutral', popis: 'Chamtivost' },
      kamen: { nazev: 'Kamenný poutník', typ: 'prohra', popis: 'Poklad se zavřel' },
      jezinky: { nazev: 'U kolovratu navěky', typ: 'prohra', popis: 'Jezinky vyhrály' },
      vodnik: { nazev: 'Dušička v hrnku', typ: 'prohra', popis: 'Vodníkova sbírka' },
      cert: { nazev: 'Co tě první přivítá', typ: 'prohra', popis: 'Čertova smlouva' },
      tma: { nazev: 'Za bludičkami', typ: 'prohra', popis: 'Dohořela svíčka' },
      smrt: { nazev: 'Les si vzal svůj díl', typ: 'prohra', popis: 'Zranění' }
    },
    sceny: {
      /* ---------- doma ---------- */
      '1': { obr: 'chaloupka', text: 'Je svatojánský večer. Na kopci nad vsí hoří ohně, lidé zpívají a mladí přeskakují plameny. Ty sedíš doma u kamen, protože babička stůně – a sedmiletá Anička, tvoje sestřička, šla odpoledne k lesu na jahody.\n\nAž teď si všimneš, že se nevrátila. Babička se zvedne z lavice a zbledne. Od lesa se nese zpěv – tenký, sladký, jako když se ve větru chvějí struny.\n\n„Jezinky,“ zašeptá babička. „O svatojánské noci mají největší moc. Kdo jim do kuropění neuteče, zůstane u nich v jeskyni navždycky a přede jim len, dokud nezestárne.“ Zapálí ti svíčku v lucerně a do torby ti dá dvě buchty. „Jdi. A vezmi si ještě něco. Co ti srdce poradí.“',
        volby: [
          { text: 'Uzlíček soli z požehnaného chleba', efekty: { predmet: 'sul' }, cil: '2' },
          { text: 'Dědečkův tabák v měchýřku', efekty: { predmet: 'tabak' }, cil: '2' },
          { text: 'Babiččin kostěný hřebínek', efekty: { predmet: 'hrebinek' }, cil: '2' }
        ] },
      '2': { obr: 'chaloupka', text: 'Před chalupou je teplá letní tma. Z kurníku se ozve rozespalé zakdákání – to se kohout Kokrhel ošívá na hřadu. Na kopci plápolají ohně a k lesu vede pěšina mezi obilím.\n\n„U ohňů bude starý pastýř Vavřinec,“ volá za tebou babička z okna. „Ten ví o lese víc než pan farář.“',
        volby: [
          { text: 'Vzít z kurníku kohouta', pokud: { nema: 'kohout' }, cil: '3' },
          { text: 'Zajít k ohňům za pastýřem Vavřincem', pokud: { bez: 'rada' }, cil: '4' },
          { text: 'Vyrazit rovnou k lesu', cil: '10' },
          { text: 'Zůstat doma – v noci do lesa nikdo rozumný nechodí', cil: '97' }
        ] },
      '3': { obr: 'kohout', efekty: { predmet: 'kohout' }, text: 'Kokrhel se nejdřív brání a klove, ale pak se ti uvelebí pod paží a jen nespokojeně pobrukuje. Babička vždycky říkala, že kohoutí zpěv zažene každé noční strašidlo. Kdo ví, k čemu bude.',
        volby: [
          { text: 'Zajít k ohňům za pastýřem Vavřincem', pokud: { bez: 'rada' }, cil: '4' },
          { text: 'Vyrazit k lesu', cil: '10' }
        ] },
      '4': { obr: 'ohne', efekty: { olej: -1, priznak: 'rada' }, text: 'Na kopci je veselo. Starý Vavřinec sedí stranou na kameni, kouří a dívá se do plamenů. Když vyslechne, co se stalo, dlouho mlčí.\n\n„Jezinky bydlí pod Čertovou skálou, za bažinou. Na cestu ti povím tři věci. Když na tebe v lese někdo zavolá hej, neodpovídej. Když v bažině uvidíš světýlka, obrať kabát naruby, to bludičky zmate. A kdybys na hřebeni potkal velikého pána s holí, říkej mu pane Krakonoši – a nikdy, nikdy ne Rýbrcoule.“\n\nPoklepe dýmkou o kámen. „A u zbořené kaple dnes o půlnoci kvete kapradí. Kdo ten květ utrhne a neohlédne se, tomu se otevřou poklady a bude rozumět řeči zvířat.“',
        volby: [
          { text: 'Přeskočit svatojánský oheň pro štěstí (zkouška obratnosti)', zkouska: { co: 'obratnost', uspech: '5', neuspech: '6' } },
          { text: 'Poděkovat a jít k lesu', cil: '10' }
        ] },
      '5': { obr: 'ohne', efekty: { priznak: 'ohen' }, text: 'Rozběhneš se a přeletíš plameny tak vysoko, že lidé kolem zatleskají. Vavřinec se usměje. „Kdo přeskočí svatojánský oheň, toho celý rok neuspí žádné kouzlo. To se ti bude hodit.“',
        volby: [{ text: 'K lesu', cil: '10' }] },
      '6': { obr: 'ohne', efekty: { zdravi: -2 }, text: 'Zakopneš o polínko a plameny ti olíznou nohy. Lidé se smějí, Vavřinec ti podá džbán vody. „Nic to. Oheň ti dnes nepomůže, ale ani neublíží víc, než už ublížil.“',
        volby: [{ text: 'K lesu', cil: '10' }] },
      '97': { obr: 'chaloupka', konec: 'zbabely', text: 'Zůstaneš doma a s babičkou se modlíte u kamen. Zpěv od lesa sílí a slábne, až nad ránem utichne.\n\nZa kuropění najdou Aničku sousedé – spí na mezi u lesa, živá a zdravá. Jen se od té doby už nikdy nesměje, a když v létě zafouká vítr od lesa, sedne si k oknu a poslouchá, jako by na ni někdo volal.\n\n(Tip: odvaha se o svatojánské noci vyplácí.)' },

      /* ---------- kraj lesa ---------- */
      '10': { obr: 'les', efekty: { olej: -1 }, text: 'Stojíš na kraji lesa. Smrky jsou černé a vysoké, mezi kmeny prosvítá měsíc. Zpěv jezinek se nese odněkud z hloubi, ale ozvěna ho rozhazuje do všech stran.\n\nVlevo dole se blyští mlýnský rybník. Rovně se táhne bažina, nad kterou se vznáší mlha. Vpravo vede uhlířská cesta do hlubokého lesa. Na poli za tebou stojí u křižovatky boží muka. A nad lesem se v měsíčním světle rýsuje hřeben hor.',
        volby: [
          { text: 'K mlýnskému rybníku', pokud: { bez: 'rybnik' }, cil: '20' },
          { text: 'Přes bažinu', cil: '30' },
          { text: 'Uhlířskou cestou do lesa', cil: '40' },
          { text: 'Ke křižovatce s božími muky', pokud: { bez: 'krizovatka' }, cil: '50' },
          { text: 'Nahoru na hřeben', pokud: { bez: 'hreben' }, cil: '60' }
        ] },

      /* ---------- vodník ---------- */
      '20': { obr: 'rybnik', efekty: { olej: -1, priznak: 'rybnik' }, text: 'Mlýn spí, kolo stojí. Na vrbě nad rybníkem sedí malý zelený mužíček v kabátku, z jehož šosu kape voda, a cumlá prázdnou dýmku. Vodník.\n\n„Ale, ale,“ zakvákne. „Kdopak to chodí v noci kolem mého rybníka? Vypadáš jako někdo, kdo hledá. Já vím všecko, co se kolem vody šustne. Ale zadarmo nic.“',
        volby: [
          { text: 'Nabídnout mu dědečkův tabák', pokud: { ma: 'tabak' }, efekty: { odeber: 'tabak' }, cil: '21' },
          { text: 'Zahrát si s ním v karty o to, co ví (zkouška štěstí)', zkouska: { co: 'stesti', uspech: '22', neuspech: '23' } },
          { text: 'Slušně ho poprosit', cil: '24' },
          { text: 'Raději odejít', cil: '10' }
        ] },
      '21': { obr: 'rybnik', efekty: { priznak: 'vodnik_pritel' }, text: 'Vodník tabák očichá, nacpe dýmku a blaženě zavře oči. „Knaster! Takový jsem neměl od dob, co tu mlel starý Pecháček.“\n\nPak se nakloní. „Tvoje sestřička šla kolem s třemi babami. Slepé jsou, ale cestu znají. Vedly ji k Čertově skále, za bažinu. A kapradí kvete u zbořené kaple, to ti povím ještě navrch.“\n\nVyfoukne kroužek dýmu. „Nepůjdeš ke mně na hrnek čaje? Venku je zima a ty máš ještě dlouhou cestu.“',
        volby: [
          { text: 'Přijmout pozvání pod hladinu', cil: '25' },
          { text: 'Poděkovat a jít dál', cil: '26' }
        ] },
      '22': { obr: 'rybnik', efekty: { zlato: 3, priznak: 'vodnik_pritel' }, text: 'Vodník hraje mazaně, ale ty máš štěstí. Po třetí hře hodí karty do vody a uraženě si odfrkne. „Inu, slovo je slovo.“\n\nVyplatí ti tři krejcary a povídá: „Tvoje sestra šla s třemi slepými babami k Čertově skále za bažinou. A kapradí kvete u zbořené kaple.“ Pak se podrbe za uchem. „Hraješ dobře. Zajdeš ke mně na hrnek čaje?“',
        volby: [
          { text: 'Přijmout pozvání pod hladinu', cil: '25' },
          { text: 'Poděkovat a jít dál', cil: '26' }
        ] },
      '23': { obr: 'rybnik', text: 'Vodník vyhraje jednou, podruhé, potřetí. Pak se zle usměje a sklouzne z vrby. „Prohráno, prohráno. Kdo hraje s vodníkem, sází dušičku. Pojď, mám pro tebe hezký hrnek.“\n\nStudená mokrá ruka tě chytí za zápěstí a táhne k vodě.',
        boj: { jmeno: 'Vodník', obratnost: 10, zdravi: 10, vyhra: '27', prohra: '96', utek: '10' },
        volby: [] },
      '27': { obr: 'rybnik', text: 'Vytrhneš se mu a vodník žbluňkne do rybníka. Za chvíli vystrčí hlavu a vzteká se: „Jen běž! Jen běž za tou svou sestrou k Čertově skále! Jezinky si tě uspí stejně jako ji!“\n\nA zmizí pod hladinou. Aspoň už víš, kam jít.',
        volby: [{ text: 'Jít dál podél potoka', cil: '26' }] },
      '24': { obr: 'rybnik', text: 'Vodník tě vyslechne a pokrčí rameny. „Prosba, prosba. Ta mi dýmku nenacpe. Kdyby se u tebe našlo trochu tabáku, to by byla jiná řeč. Nebo si zahrajme v karty – vyhraješ, povím ti všecko.“',
        volby: [
          { text: 'Zahrát si v karty (zkouška štěstí)', zkouska: { co: 'stesti', uspech: '22', neuspech: '23' } },
          { text: 'Odejít', cil: '26' }
        ] },
      '25': { obr: 'hrnky', text: 'Vodník tě chytí za ruku, a když vkročíš do vody, ani nezmokneš. Dýchá se tu jako na podzim v mlze. Jeho světnice pod hladinou je zelená a tichá, ryby proplouvají oknem.\n\nPo stěnách jsou police plné hrnků obrácených dnem vzhůru. Z některých vystupují drobné bublinky a zvoní jako skleničky. „Moje sbírka,“ řekne pyšně vodník. „Dušičky utopenců. Počkej, uvařím čaj.“ A odšourá se do kuchyně.',
        volby: [
          { text: 'Zvednout poklici z hrnku, který nejvíc zvoní', cil: '28' },
          { text: 'Na nic nesahat a slušně počkat', cil: '29' }
        ] },
      '28': { obr: 'hrnky', efekty: { priznak: ['dusicka', 'nit'] }, text: 'Pod poklicí to zasvítí a ven vyletí malá bublinka světla. Na okamžik se v ní zjeví tvář kluka s pihami. „Děkuju!“ šeptne. „Utopil jsem se před sto lety, když jsem chytal raky.\n\nAž přijdeš k jezinkám, nedívej se na ně, dívej se na kolovraty. Uspávají přadenou nití – kdo ji přetrhne, toho kouzlo nechytne.“\n\nA bublinka vyletí ke hladině. Vodník se vrátí s čajem a nic nepozná. Jen ti připadá, že jedna police teď zvoní o trochu tišeji.',
        volby: [{ text: 'Vypít čaj a rozloučit se', cil: '29' }] },
      '29': { obr: 'hrnky', efekty: { zdravi: 3 }, text: 'Čaj je z vodních bylin, hořký a hřejivý. Cítíš, jak se ti vrací síla. Vodník tě vyprovodí ke břehu a zamává ti mokrým šosem.\n\n„A kdyby se ti někdy dostal do ruky tabák, víš, kde bydlím!“',
        volby: [{ text: 'Jít dál podél potoka', cil: '26' }] },
      '26': { obr: 'les', text: 'Potok bublá mezi kořeny olší. Kousek dál se rozdvojuje pěšina: jedna vede do mlhy nad bažinou, druhá do hlubokého lesa na uhlířskou cestu.',
        volby: [
          { text: 'Do bažiny', cil: '30' },
          { text: 'Na uhlířskou cestu', cil: '40' }
        ] },

      /* ---------- bažina ---------- */
      '30': { obr: 'bazina', efekty: { olej: -1 }, text: 'Bažina páchne tlejícím listím. Přes černou vodu vede stezka z prken, napůl shnilých. A nad vodou tančí modrá světýlka – bludičky. Kroužkují kolem tvé lucerny a svíčka se chvěje, jako by ji něco chtělo sfouknout.\n\nJedno světýlko je jasnější než ostatní. Kyne ti. Pojď, tudy je to blíž.',
        volby: [
          { text: 'Obrátit kabát naruby, jak radil Vavřinec', pokud: { priznak: 'rada' }, cil: '31' },
          { text: 'Posvítit si kapradím květem', pokud: { ma: 'kvet' }, cil: '31' },
          { text: 'Jít za nejjasnějším světýlkem', cil: '32' },
          { text: 'Jít po prknech a nedívat se do stran (zkouška obratnosti)', zkouska: { co: 'obratnost', uspech: '31', neuspech: '33' } }
        ] },
      '31': { obr: 'bazina', text: 'Bludičky zmateně poletují kolem a pak se rozprchnou nad vodu. Projdeš bažinou po prknech, krok za krokem, až pod nohama ucítíš pevnou zem.\n\nNa druhé straně se rozbíhají dvě pěšiny. Jedna stoupá k černé hmotě Čertovy skály. Druhá vede k ruinám malé kaple, kolem které roste husté kapradí.',
        volby: [
          { text: 'Ke kapradí u zbořené kaple', cil: '70' },
          { text: 'K Čertově skále', cil: '80' }
        ] },
      '32': { obr: 'tma', efekty: { olej: -2 }, text: 'Světýlko tě vede dál a dál. Prkna končí, jdeš po trsech trávy, po kořenech, po něčem, co se houpe. Když se ohlédneš, nevidíš cestu zpátky. Svíčka v lucerně skomírá.\n\nBludička se zastaví nad černou vodou a zachichotá se.',
        volby: [
          { text: 'Zastavit se, pomodlit a hledat cestu (zkouška štěstí)', zkouska: { co: 'stesti', uspech: '31', neuspech: '33' } }
        ] },
      '33': { obr: 'bazina', efekty: { zdravi: -3, olej: -1 }, text: 'Noha ti sklouzne a zapadneš do bahna až po pás. Bažina tě táhne dolů, studená a lačná. Chytíš se kořene a vytáhneš se ven, celé tělo od bahna, zuby ti cvakají. Lucerna je mokrá a svíčka prská.\n\nAle prkna stezky jsou kousek před tebou.',
        volby: [{ text: 'Dál po prknech', cil: '31' }] },

      /* ---------- les, hejkal, studánka, uhlíř ---------- */
      '40': { obr: 'les', efekty: { olej: -1 }, text: 'Uhlířská cesta vede hlubokým smrkovým lesem. Je tu takové ticho, že slyšíš vlastní srdce. Pak se za tebou ozve hlas:\n\n„Hej! Heeej!“\n\nZní to jako člověk, který se ztratil. Nebo jako někdo, kdo si na člověka jen hraje.',
        volby: [
          { text: 'Odpovědět „Hej!“', cil: '41' },
          { text: 'Mlčet a jít dál', cil: '42' }
        ] },
      '41': { obr: 'hejkal', text: 'Sotva odpovíš, zapraská to v houští a z temnoty se vyřítí chlupatá, mechem obrostlá postava s očima jako žhavé uhlíky. Hejkal! Skočí ti na záda a tíží jako pytel kamení. „Nes mě! Nes mě až do rána!“',
        volby: [
          { text: 'Hodit mu přes rameno hrst soli', pokud: { ma: 'sul' }, cil: '43' },
          { text: 'Shodit ho a bránit se', boj: { jmeno: 'Hejkal', obratnost: 8, zdravi: 10, vyhra: '43', prohra: '99' } }
        ] },
      '43': { obr: 'hejkal', efekty: { zlato: 2 }, text: 'Hejkal zaskučí, pustí se a odběhne do houští, až praští suché větve. Na zemi po něm zůstane pár krejcarů – kdo ví, komu je kdy vzal.\n\nTeď už víš, proč se v lese neodpovídá.',
        volby: [{ text: 'Jít dál', cil: '42' }] },
      '42': { obr: 'les', text: 'Cesta se klikatí mezi kmeny. Odněkud zprava zurčí voda – v mechu je studánka. Dál vpředu je cítit kouř: tam bude uhlířský milíř. A po pravé ruce prosvítá mezi stromy mýtina plná kapradí.',
        volby: [
          { text: 'Ke studánce', pokud: { bez: 'studanka' }, cil: '44' },
          { text: 'Za kouřem k uhlíři', pokud: { bez: 'uhlir' }, cil: '45' },
          { text: 'Na mýtinu s kapradím', cil: '70' }
        ] },
      '44': { obr: 'studanka', efekty: { priznak: 'studanka' }, text: 'U studánky sedí bledá dívka v bílých šatech a češe si dlouhé vlasy. Lesní panna. Kolem ní se kapradí sklání, jako by se klanělo.\n\n„Kdo pije z mé studánky, něco mi dá,“ řekne tiše. „Taková je smlouva lesa.“',
        volby: [
          { text: 'Dát jí babiččinu buchtu', pokud: { ma: 'buchta' }, efekty: { odeber: 'buchta' }, cil: '46' },
          { text: 'Dát jí tři krejcary', pokud: { zlato: 3 }, efekty: { zlato: -3 }, cil: '46' },
          { text: 'Uklonit se a jít dál bez napití', cil: '42' }
        ] },
      '46': { obr: 'studanka', efekty: { zdravi: 8, priznak: 'nit' }, text: 'Lesní panna se usměje a pokyne. Voda ze studánky je ledová a sladká a každý doušek ti vrací sílu, jako po dlouhém spánku.\n\n„Jdeš k jezinkám,“ řekne panna, aniž by se ptala. „Jsou slepé, ale slyší i pavouka v koutě. Jejich moc je v niti na kolovratech. Přetrhni nit a uspávání skončí.“',
        volby: [{ text: 'Poděkovat a jít', cil: '42' }] },
      '45': { obr: 'uhlir', efekty: { predmet: 'svice', zdravi: 3, priznak: ['uhlir', 'hon_rada'] }, text: 'Na mýtině doutná milíř a u ohně sedí starý uhlíř Bartoloměj. Nalije ti misku polévky a vyslechne tě.\n\n„Čertova skála? Odsud rovně na sever, pořád do kopce. Ale dnes v noci tam nechoď po hřebeni – jede divoký hon. Když uslyšíš na nebi psy, lehni si tváří k zemi a nedívej se nahoru, ať se děje cokoli.“\n\nPodá ti svíčku. „Ta tvoje už je skoro dole. Tuhle si schovej.“',
        volby: [
          { text: 'K Čertově skále na sever', cil: '47' },
          { text: 'Zpátky na cestu k mýtině s kapradím', cil: '42' }
        ] },
      '47': { obr: 'divoky_hon', text: 'V půli kopce se zvedne vítr. Smrky se ohýbají, mraky letí po nebi – a v nich štěkot psů, ržání koní, troubení lesních rohů. Nad korunami stromů se žene průvod bledých jezdců. Divoký hon.\n\nJeden z jezdců se otočí v sedle a hledí dolů. Přímo na tebe.',
        volby: [
          { text: 'Lehnout si tváří k zemi, jak radil uhlíř', pokud: { priznak: 'hon_rada' }, cil: '48' },
          { text: 'Schovat se pod padlý kmen (zkouška štěstí)', zkouska: { co: 'stesti', uspech: '48', neuspech: '49' } },
          { text: 'Dívat se nahoru', cil: '49' }
        ] },
      '48': { obr: 'les', text: 'Ležíš v mechu, tvář přitisknutou k zemi, a nad tebou to hučí a duní. Něco ti zavlaje nad hlavou, studené jako led. Pak je ticho.\n\nKdyž se zvedneš, les je klidný. Před tebou se mezi stromy tyčí Čertova skála.',
        volby: [{ text: 'K jeskyni pod skálou', cil: '80' }] },
      '49': { obr: 'divoky_hon', efekty: { zdravi: -3, olej: -1 }, text: 'Pohled jezdce tě přikove na místo. Vichr tě zvedne, točí tebou, nese tě nad stromy a pak upustí do maliní. Než se vyhrabeš, máš poškrábané ruce, bolí tě celé tělo a svíčka je o kus menší.\n\nAle aspoň tě hon zanesl blíž. Čertova skála je kousek odtud.',
        volby: [{ text: 'K jeskyni pod skálou', cil: '80' }] },

      /* ---------- křižovatka ---------- */
      '50': { obr: 'krizovatka', efekty: { olej: -1, priznak: 'krizovatka' }, text: 'U božích muk na křižovatce stojí pán v zeleném mysliveckém kabátě a s péřem za kloboukem. Usmívá se, jako by na tebe čekal. Odněkud je cítit síra.\n\n„Dobrý večer,“ smekne. „Hledáš kapradí květ, nemýlím-li se? A sestřičku? Já vím, kde je obojí. Ba co víc – květ ti dám do ruky, hned teď. Stačí maličkost.“\n\nZ kapsy vytáhne svitek a brk.',
        volby: [
          { text: 'Zeptat se, co za to chce', cil: '53' },
          { text: 'Pokřižovat se a odmítnout', cil: '52' }
        ] },
      '53': { obr: 'krizovatka', text: '„Skoro nic,“ řekne pán v zeleném a ocas mu pod kabátem netrpělivě švihne. „Jen to, co tě zítra ráno doma první přivítá. Nic víc, nic míň. Podepíšeš krví – stačí kapička.“\n\nV duchu vidíš, jak ti ráno naproti vybíhá babička. Nebo Anička.',
        volby: [
          { text: 'Podepsat', cil: '51' },
          { text: 'Pokřižovat se a odmítnout', cil: '52' }
        ] },
      '51': { obr: 'kapradi', efekty: { predmet: ['smlouva', 'kvet'] }, text: 'Píchneš se do palce a připíšeš kapku krve. Pán v zeleném svitek zaroluje a luskne prsty.\n\nV dlani ti rozkvete květ – bílý, zářivý, teplý jako sluníčko. Když zvedneš hlavu, křižovatka je pryč. Stojíš na mýtině u zbořené kaple a kolem tebe šeptá kapradí. Slyšíš všechno: sova na větvi si stěžuje na myši, ježek pod listím chrápe.\n\nZ dálky se ještě nese smích: „Do rána, do rána!“',
        volby: [{ text: 'Rozhlédnout se po mýtině', cil: '74' }] },
      '52': { obr: 'krizovatka', efekty: { stesti: 2 }, text: 'Uděláš kříž a pán v zeleném se zašklebí, jako by kousl do citronu. „Škoda. Velká škoda.“ Zmizí v obláčku žlutého dýmu a zůstane po něm jen pach síry a vypálený otisk kopyta v prachu.\n\nCítíš se lehčí, jako by ti z ramen spadl kámen.',
        volby: [{ text: 'Zpátky ke kraji lesa', cil: '10' }] },

      /* ---------- hřeben a Krakonoš ---------- */
      '60': { obr: 'krakonos', efekty: { olej: -2, priznak: 'hreben' }, text: 'Cesta na hřeben je dlouhá a strmá. Nahoře fouká a mezi kosodřevinou se valí mlha. Najednou se z ní vynoří obrovská postava v plášti, s vousem až po pás a s holí vysokou jako strom.\n\n„Kdo se toulá po mých horách o svatojánské noci?“ zahřmí hlas, až se kameny zachvějí.',
        volby: [
          { text: '„Pane Krakonoši, prosím vás o pomoc.“', cil: '61' },
          { text: '„Vy jste ten Rýbrcoul, že jo?“', cil: '62' },
          { text: 'Utéct zpátky dolů', cil: '10' }
        ] },
      '61': { obr: 'krakonos', text: 'Krakonoš se zamračí, ale pak se mu ve vousech mihne úsměv. „Slušnost. To se dneska nevidí.“ Vyslechne tě a pokývá hlavou.\n\n„Pomůžu, ale hory nedávají nic zadarmo. Řekni mi: co je rychlejší než vítr?“',
        volby: [
          { text: '„Myšlenka.“', cil: '63' },
          { text: '„Blesk.“', cil: '64' },
          { text: '„Kůň divokého honu.“', cil: '64' }
        ] },
      '63': { obr: 'krakonos', efekty: { predmet: 'hul' }, text: '„Myšlenka,“ zabručí Krakonoš spokojeně. „Ta doletí k sestřičce dřív, než ty dojdeš. Tak ať doletí i s tebou.“\n\nUlomí z kosodřeviny suk a podá ti ho. „Až budeš v nouzi, udeř s ní o zem. Hory odpovědí.“\n\nPak natáhne ruku a ukáže dolů do údolí. Mlha se před tebou rozestoupí jako opona a uvidíš pěšinu, která vede přímo k Čertově skále.',
        volby: [{ text: 'Sejít po pěšině k Čertově skále', cil: '80' }] },
      '64': { obr: 'krakonos', efekty: { olej: -1 }, text: '„Hloupé,“ zavrtí hlavou Krakonoš. „Ale poctivé.“ Mávne holí a mlha se rozestoupí. „Tamhle je Čertova skála. Pospěš si.“\n\nPěšina je dlouhá a kamenitá a svíčka v lucerně mezitím pěkně ubude.',
        volby: [{ text: 'Sejít k Čertově skále', cil: '80' }] },
      '62': { obr: 'bourka', efekty: { zdravi: -4, olej: -2 }, text: 'Krakonošova tvář zčerná jako mrak. „RÝBRCOUL?!“\n\nNebe se roztrhne bleskem. Vichřice tě srazí na zem, déšť bičuje, kosodřevina sténá. Celou věčnost se držíš kamene a čekáš, až bouře přejde. Když konečně ustane, nemáš na sobě suchou nitku a obr je pryč. Svíčka v lucerně jen tak tak hoří.\n\nPomalu, po čtyřech, slézáš dolů.',
        volby: [{ text: 'Zpátky ke kraji lesa', cil: '10' }] },

      /* ---------- kapradí a kaple ---------- */
      '70': { obr: 'kapradi', efekty: { olej: -1 }, text: 'Mýtina u zbořené kaple je plná kapradí po pás. Je skoro půlnoc. Uprostřed, na nejvyšším trsu, se pomalu otevírá pupen a z něj prosvítá světlo, jako by v něm hořela svíčka.\n\nA les kolem se probouzí. Za zády slyšíš šepot, kroky, zavolání tvého jména – babiččiným hlasem, Aniččiným hlasem. Kdo se ohlédne, tomu květ zhasne.',
        volby: [
          { text: 'Obsypat se kruhem soli a v klidu čekat', pokud: { ma: 'sul', nema: 'kvet', bez: 'kvet_zkouska' }, cil: '71' },
          { text: 'Zavřít oči, čekat a neohlédnout se (zkouška štěstí)', pokud: { nema: 'kvet', bez: 'kvet_zkouska' }, efekty: { priznak: 'kvet_zkouska' }, zkouska: { co: 'stesti', uspech: '71', neuspech: '73' } },
          { text: 'Natáhnout ruku a utrhnout pupen, jen co se otevře (zkouška obratnosti)', pokud: { nema: 'kvet', bez: 'kvet_zkouska' }, efekty: { priznak: 'kvet_zkouska' }, zkouska: { co: 'obratnost', uspech: '71', neuspech: '73' } },
          { text: 'Jít dál po mýtině', pokud: { priznak: 'kvet_zkouska' }, cil: '74' },
          { text: 'Jít dál po mýtině', pokud: { ma: 'kvet', bez: 'kvet_zkouska' }, cil: '74' }
        ] },
      '71': { obr: 'kapradi', efekty: { predmet: 'kvet', priznak: 'kvet_zkouska' }, text: 'Hlasy za zády křičí, prosí, pláčou. Ty se neohlédneš. A pak – přesně o půlnoci – se květ rozevře a ty ho máš v dlani. Je teplý a svítí tak jasně, že vidíš každou žilku na listech kapradí.\n\nSvět se změní. Slyšíš, jak si stromy šeptají o dešti, jak brouk pod kůrou počítá léta. Na větvi nad tebou si odkašle sova.',
        volby: [{ text: 'Rozhlédnout se po mýtině', cil: '74' }] },
      '73': { obr: 'kapradi', efekty: { zdravi: -2 }, text: '„Ohlédni se!“ vykřikne za tebou Aniččin hlas tak zoufale, že to nevydržíš. Otočíš se – a za tebou nic není. Jen tma.\n\nKdyž se podíváš zpátky na kapradí, pupen je zavřený a zhaslý. Do hlavy ti vjede ostrá bolest, jako by tě někdo udeřil. Letos už nevykvete.',
        volby: [{ text: 'Jít dál po mýtině', cil: '74' }] },
      '74': { obr: 'sova', text: 'Mýtina je tichá. U zbořené kaple roste starý buk a na něm sedí velká sova. Za kaplí se zvedá skalní stěna a k Čertově skále odtud vede vyšlapaná pěšina.',
        volby: [
          { text: 'Promluvit se sovou', pokud: { ma: 'kvet', bez: 'sova' }, cil: '75' },
          { text: 'Jít za zlatavou září ve skalní stěně', pokud: { ma: 'kvet', bez: 'poklad' }, cil: '76' },
          { text: 'Vejít do zbořené kaple', pokud: { bez: 'kaple' }, cil: '72' },
          { text: 'Pěšinou k Čertově skále', cil: '80' }
        ] },
      '75': { obr: 'sova', efekty: { priznak: ['sova', 'nit'] }, text: '„Konečně někdo, kdo rozumí,“ zahouká sova. „Celé noci tu sedím a nikdo se mě na nic nezeptá.\n\nJezinky? Ty slepé babizny? Uspávají zpěvem a nití na kolovratu. Přetrhni nit a zpěv ti nic neudělá. A kohoutí zpěv nesnesou vůbec – myslí si, že přišlo kuropění, a schovají se do skály.“\n\nSova si načechrá peří. „Mimochodem, poklad ve skále se otevírá jen jednou za rok. Ale kdo v něm zůstane do odbití hodiny, ten tam zůstane navždycky.“',
        volby: [{ text: 'Poděkovat sově', cil: '74' }] },
      '76': { obr: 'poklad', efekty: { priznak: 'poklad' }, text: 'Skalní stěna se v záři kapradí rozestoupí jako dveře. Uvnitř se třpytí zlato – dukáty, poháry, korunky, řetězy. Zlato leží v hromadách, až oči přecházejí.\n\nZ údolí se ozve zvon. Začíná odbíjet půlnoc. Do posledního úderu se skála zase zavře.',
        volby: [
          { text: 'Nabrat hrst dukátů a rychle ven', efekty: { zlato: 10 }, cil: '77' },
          { text: 'Zapomenout na sestru a nabírat, dokud to jde (zkouška štěstí)', zkouska: { co: 'stesti', uspech: '94', neuspech: '93' } },
          { text: 'Nechat poklad pokladem a odejít', cil: '74' }
        ] },
      '77': { obr: 'poklad', text: 'Vyskočíš ven s plnou hrstí právě ve chvíli, kdy zvon odbíjí podvanácté. Skála se za tebou s hlubokým zaduněním zavře. Dukáty v kapse těžknou a cinkají.',
        volby: [{ text: 'Zpátky na mýtinu', cil: '74' }] },
      '72': { obr: 'kostel', efekty: { olej: -1, priznak: 'kaple' }, text: 'Ve zbořené kapli prosvítá měsíc prázdným oknem. U kamenného kříže klečí průsvitná postava v kutně – duch poustevníka, který tu kdysi žil. Otočí se k tobě a usměje se.\n\n„Dlouho tu nikdo nebyl. Pojď blíž, dítě. Vidím, že tě čeká těžká noc.“',
        volby: [
          { text: 'Ukázat mu čertovu smlouvu', pokud: { ma: 'smlouva' }, cil: '79' },
          { text: 'Poprosit o požehnání', cil: '78' }
        ] },
      '79': { obr: 'kostel', efekty: { odeber: 'smlouva' }, text: 'Poustevník vezme svitek do průsvitných prstů a zavrtí hlavou. „Ach, ten zelený myslivec. Pořád stejné kousky.“\n\nPodrží smlouvu nad svíčkou. Pergamen zasyčí, zkroutí se a shoří modrým plamenem. Z dálky, odněkud z polí, se ozve vztekle zaječení.\n\n„A teď jdi. Květ si nech – ten už je tvůj.“',
        volby: [{ text: 'Poděkovat a jít', cil: '74' }] },
      '78': { obr: 'kostel', efekty: { zdravi: 6, stesti: 2 }, text: 'Poustevník zvedne ruku a pokřižuje tě. Cítíš, jak ti tělem proteče teplo, únava se rozplyne a odřeniny přestanou pálit.\n\n„Ať tě Pánbůh provází. A pamatuj – jezinky jsou slepé, ale ne hluché.“',
        volby: [{ text: 'Poděkovat a jít', cil: '74' }] },

      /* ---------- Čertova skála ---------- */
      '80': { obr: 'jeskyne', efekty: { olej: -1 }, text: 'Pod Čertovou skálou zeje jeskyně. Uvnitř tlumeně svítí oheň a vrčí kolovraty – tři najednou, v jednom rytmu. A zpěv. Tenký, sladký, ospalý. Víčka ti těžknou už tady venku, nohy se ti podlamují.\n\nNěkde uvnitř je Anička.',
        volby: [
          { text: 'Vejít dovnitř – svatojánský oheň tě chrání', pokud: { priznak: 'ohen' }, cil: '81' },
          { text: 'Zacpat si uši voskem ze svíčky a vejít', efekty: { olej: -1 }, cil: '81' },
          { text: 'Přemoci ospalost a vejít (zkouška štěstí)', zkouska: { co: 'stesti', uspech: '81', neuspech: '89' } }
        ] },
      '81': { obr: 'jezinky', text: 'V jeskyni u ohně sedí tři staré ženy se zavřenýma očima a předou. Kolovraty vrčí, nit běží mezi prsty tenká jako pavučina a stříbřitě se leskne. V koutě na slámě spí Anička, s úsměvem, jako by se jí zdálo něco krásného.\n\nNejstarší jezinka zvedne hlavu a nasaje vzduch. „Cítím člověka,“ zachraptí. „Teplého, živého. Pojď blíž, pojď. Sedni si k nám a odpočiň si.“',
        volby: [
          { text: 'Pozvednout kapradí květ', pokud: { ma: 'kvet' }, cil: '85' },
          { text: 'Pustit kohouta, ať zakokrhá', pokud: { ma: 'kohout' }, cil: '86' },
          { text: 'Udeřit Krakonošovou holí o skálu', pokud: { ma: 'hul' }, cil: '84' },
          { text: 'Přetrhnout stříbrnou nit na kolovratech (zkouška obratnosti)', pokud: { priznak: 'nit' }, zkouska: { co: 'obratnost', uspech: '85', neuspech: '87' } },
          { text: 'Potichu se připlížit k Aničce a odnést ji (zkouška štěstí)', zkouska: { co: 'stesti', uspech: '88', neuspech: '87' } },
          { text: 'Vrhnout se na jezinky', cil: '87' }
        ] },
      '84': { obr: 'jezinky', text: 'Udeříš holí o kamennou podlahu. Hora odpoví – zaduní to, jako by se pohnulo celé pohoří. Ze stropu se sypou kamínky, kolovraty se převrhnou a nitě se zamotají.\n\nJezinky vřískají a tápou po zemi. „Krakonoš! To je Krakonošova hůl!“ Zalezou do nejhlubší pukliny ve skále a ani nedutají.',
        volby: [{ text: 'Vzít Aničku do náruče', cil: '88' }] },
      '85': { obr: 'jezinky', text: 'Stříbrná nit praskne – nebo možná shoří ve světle, to nepoznáš. Zpěv se zlomí uprostřed tónu. Jezinky se chytnou za hlavy a jejich slepé oči se poprvé po staletích otevřou dokořán.\n\n„Světlo! Světlo!“ Couvají ke stěně, svíjejí se a pak se rozplynou jako dým nad ohněm. Zůstanou po nich jen tři prázdné kolovraty, které se pomalu zastavují.',
        volby: [{ text: 'Vzít Aničku do náruče', cil: '88' }] },
      '86': { obr: 'jezinky', text: 'Pustíš Kokrhela na zem. Kohout se načechrá, vyskočí na kolovrat, roztáhne křídla a zakokrhá tak hlasitě, že se jeskyně otřese.\n\n„Kuropění!“ vyjeknou jezinky. „Už je kuropění!“ Kolovraty se převrhnou, nitě se roztrhají a tři staré ženy se vrhnou do pukliny ve skále. Puklina se za nimi zavře.\n\nKokrhel spokojeně seskočí a nechá se zase vzít pod paži.',
        volby: [{ text: 'Vzít Aničku do náruče', cil: '88' }] },
      '87': { obr: 'jezinky', text: 'Jezinky se zvednou od kolovratů všechny tři najednou. Pohybují se mnohem rychleji, než by slepé stařeny měly. Dlouhé kostnaté prsty se natahují, zpěv sílí a víčka ti těžknou.\n\nMusíš bojovat, dokud ještě můžeš.',
        boj: { jmeno: 'Tři jezinky', obratnost: 9, zdravi: 12, vyhra: '88', prohra: '89' },
        volby: [] },
      '88': { obr: 'utek', efekty: { olej: -1 }, text: 'Anička se ti v náruči zavrtí a zamumlá ze spaní: „Už je ráno?“ Ještě ne. Utíkáš ven z jeskyně, dolů z kopce, a za zády slyšíš, jak se les probouzí. Kořeny se plazí po zemi, větve se natahují, zpěv se vrací – tišší, ale pořád blízko. Jezinky se nevzdávají tak snadno.',
        volby: [
          { text: 'Hodit za sebe babiččin hřebínek', pokud: { ma: 'hrebinek' }, efekty: { odeber: 'hrebinek' }, cil: '83' },
          { text: 'Udeřit holí o zem, ať hory zastaví les', pokud: { ma: 'hul' }, cil: '90' },
          { text: 'Utíkat, co nohy stačí (zkouška obratnosti)', zkouska: { co: 'obratnost', uspech: '90', neuspech: '91' } }
        ] },
      '83': { obr: 'utek', text: 'Hřebínek dopadne na pěšinu – a ze země vyrazí stromy. Jeden, deset, sto, hustý les tak neprostupný, že by jím neprolezla ani myš. Zpěv za ním utichne.\n\nBabička to věděla. Babičky to vždycky vědí.',
        volby: [{ text: 'Domů', cil: '90' }] },
      '91': { obr: 'utek', efekty: { zdravi: -3 }, text: 'Kořen ti podrazí nohy a ty upadneš i s Aničkou. Chytíš ji, aby se neuhodila, a odnese to tvoje koleno. Větve tě šlehají přes obličej. Zvedneš se a utíkáš dál – pořád dál, dokud les za vámi neřídne a zpěv neutichne.',
        volby: [{ text: 'Domů', cil: '90' }] },
      '89': { obr: 'jezinky', konec: 'jezinky', text: 'Zpěv tě obejme jako teplá peřina. Sedneš si k ohni – jen na chvilku, jen si odpočinout. Někdo ti do rukou vloží vřeteno.\n\nKdyž se na podzim dívá babička z okna k lesu, zdá se jí, že slyší vrčení kolovratů. Čtyř. Nebo pěti.\n\n(Proti zpěvu jezinek je třeba ochrana – oheň, vosk, nebo chytrá rada.)' },

      /* ---------- domů ---------- */
      '90': { obr: 'usvit', text: 'Nad horami bledne nebe, když vycházíš z lesa. Ves pod tebou ještě spí, jen na kopci doutnají svatojánské ohně. Anička se ti probudí v náruči a rozhlíží se kolem velkýma očima.\n\nU vrátek chalupy stojí babička. A kousek od ní, opřený o plot, pán v zeleném kabátě s péřem za kloboukem.',
        volby: [
          { text: 'Jít domů', pokud: { nema: 'smlouva' }, cil: '92' },
          { text: 'Pustit napřed kohouta Kokrhela', pokud: { ma: ['smlouva', 'kohout'] }, cil: '87k' },
          { text: 'Jít domů – smlouva je smlouva', pokud: { ma: 'smlouva' }, cil: '98' }
        ] },
      '92': { obr: 'usvit', text: 'Pán v zeleném si tě změří, odplivne si a zmizí ve žlutém dýmu – tady už nemá co pohledávat. Babička se rozběhne a obejme vás oba tak pevně, až ti to vyrazí dech.',
        volby: [
          { text: 'Ukázat babičce kapradí květ', pokud: { ma: 'kvet' }, cil: '100' },
          { text: 'Jít dovnitř', pokud: { nema: 'kvet' }, cil: '101' }
        ] },
      '87k': { obr: 'kohout', text: 'Pustíš Kokrhela na zem. Kohout uvidí domov, natřese peří a jako první proběhne vrátky – a pán v zeleném ho chytí do náruče dřív, než se vzpamatuje.\n\n„Kohout?!“ zařve čert. Kokrhel se mu zavrtí v rukou, natáhne krk a zakokrhá mu přímo do ucha. Kuropění!\n\nČert pustí kohouta, chytí se za hlavu a s ječením se propadne do země. Zůstane po něm jen díra v trávníku a pach síry. Smlouva ti v torbě zčerná a rozpadne se na popel.',
        efekty: { odeber: 'smlouva' },
        volby: [
          { text: 'Ukázat babičce kapradí květ', pokud: { ma: 'kvet' }, cil: '100' },
          { text: 'Jít dovnitř', pokud: { nema: 'kvet' }, cil: '101' }
        ] },

      /* ---------- konce ---------- */
      '100': { obr: 'usvit', konec: 'kvet', text: 'Babička se dívá na zářící květ a dlouho nemůže promluvit. „Tak přece,“ zašeptá nakonec. „Tvůj praděda ho hledal celý život.“\n\nKapradí květ položíte do truhly s výbavou. Od té doby se vaší chalupě daří: krávy dojí, jabloně rodí, a když se na podzim ztratí ovce, stačí se zeptat vrabců na plotě. Anička vyroste a směje se nejhlasitěji z celé vsi.\n\nA každou svatojánskou noc necháváte na prahu buchtu – pro sovu, pro lesní pannu a pro vodníka trochu tabáku. Les na vás nezapomíná. Vy na něj také ne.' },
      '101': { obr: 'usvit', konec: 'anicka', text: 'Babička uvaří kafe z cikorky a Anička usne u kamen dřív, než ho dopije. Probudí se až k polednímu a na jezinky si nevzpomíná – jen na zvláštní sen o třech stařenkách a o tom, jak ji někdo nesl lesem.\n\nTy si pamatuješ všechno. A když někdy v lese uslyšíš „hej“, jen se usměješ a jdeš dál.\n\n(Tip: kapradí květ kvete u zbořené kaple – kdo ho přinese domů, tomu se daří celý život.)' },
      '93': { obr: 'kamen', konec: 'kamen', text: 'Nabíráš a nabíráš, kapsy, torbu, čepici. Zvon odbije podvanácté a ty ještě pořád držíš v ruce zlatý pohár. Skála se s duněním zavře.\n\nRáno na mýtině u kaple stojí nový kámen, porostlý mechem, ve tvaru člověka s nataženou rukou. Lidé chodí kolem a říkají, že je to výstraha. Anička se z lesa nevrátila.\n\n(Poklad se otevírá jen do odbití půlnoci – a sestra je důležitější.)' },
      '94': { obr: 'listi', konec: 'listi', text: 'Vyskočíš ze skály s plnou torbou v poslední vteřině. Utíkáš domů, na Aničku už ani nepomyslíš – takové bohatství!\n\nRáno otevřeš torbu. Je plná suchého listí. Jen na dně leží jediný dukát, jako by se ti les vysmíval.\n\nAničku najdou sousedé až za týden, zesláblou a mlčenlivou. Babička se s tebou dlouho nebaví.\n\n(Z pokladu se smí vzít jen hrst na památku – nebo nic.)' },
      '95': { obr: 'tma', konec: 'tma', text: 'Svíčka v lucerně zaprská a zhasne. Tma je najednou úplná – a pak se kolem tebe rozsvítí modrá světýlka. Bludičky. Tančí, kynou, ukazují cestu. Pojď, tudy, tudy domů.\n\nJdeš za nimi, protože nic jiného nevidíš. Voda je ti po kolena, po pás…\n\nO svatojánské noci se v bažinách pod Čertovou skálou objevuje jedno světýlko navíc.\n\n(Šetři svíčkou – a hledej, co svítí samo.)' },
      '96': { obr: 'hrnky', konec: 'vodnik', text: 'Vodník je silnější, než vypadá. Voda se nad tebou zavře, studená a zelená, a pak je ticho.\n\nNa polici ve vodníkově světnici přibude nový hrnek. Zvoní tence, jako skleněná zvonečka. Vodník ho každý večer otře rukávem a říká: „To byla hra. To byla dobrá hra.“\n\n(S vodníkem se nehraje bez tabáku v kapse.)' },
      '98': { obr: 'krizovatka', konec: 'cert', text: 'Vkročíš do vrátek a Anička se ti vytrhne z náruče a běží k babičce. Pán v zeleném se usměje a zvedne prst.\n\n„To ne,“ řekneš a postavíš se mezi ně. „Ber si mě.“\n\nČert pokrčí rameny. „Proč ne. Jedna dušička jako druhá.“ Chytí tě za ruku a země se otevře.\n\nAnička vyroste a každou svatojánskou noc nosí na křižovatku k božím mukám kytici kapradí.\n\n(S čertem se smlouvy nepodepisují – a když už, chce to chytrost. Třeba kohouta.)' },
      '99': { obr: 'tma', konec: 'smrt', text: 'Rány jsou příliš vážné. Klesneš do mechu mezi kořeny a lucerna ti vypadne z ruky. Les se nad tebou zavře jako voda.\n\nRáno tě najdou dřevaři, živého jen tak tak, ale Aničku už nenajde nikdo.\n\n(Šetři zdravím: babiččina buchta umí zázraky – a ne každý boj se musí bojovat.)' }
    }
  };
  if (typeof module !== 'undefined') module.exports = PRIBEH; else window.GAMEBOOK_PRIBEH = PRIBEH;
})();

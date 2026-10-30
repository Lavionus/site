/* Gamebook „Stín nad Zlatou uličkou“ – data příběhu (vlastní text, ilustrace z Codexu, obr_praha/).
   Stejný formát jako pribeh.js. Místo oleje v kahanu ubývají hodiny do úsvitu (vlastnost `olej`
   s jiným popiskem); když dojdou, nastane konec `95` – úsvit přišel dřív než ty.
   Text je ve 2. osobě přítomného času – hrdina nemá určený rod (hlídat příčestí a „sám/sama“). */
(function () {
  'use strict';
  const PRIBEH = {
    id: 'praha',
    nazev: 'Stín nad Zlatou uličkou',
    podtitul: 'Gamebook z rudolfínské Prahy, léta Páně 1609',
    ikona: '⚗️',
    klic: 'webapp_hra_gamebook_praha',
    obrazky: 'gamebook/obr_praha/',
    uvodObr: 'ulicka',
    nazvy: { olej: '⏳ Hodiny do úsvitu', zlato: '🪙 Tolary' },
    pravidlo: '<b>Čas</b>: každá cesta nočním městem stojí hodinu, delší i dvě. Když hodiny dojdou, nastane úsvit – a s ním císařská audience. Všechno nestihneš, vybírej. <b>Zdraví</b> doplní mistrův lék z torby.',
    start: '1', smrt: '99', tma: '95',
    zacatek: { olej: 12, zlato: 4, predmety: ['lek'] },
    predmety: {
      lek: { nazev: '🧪 Mistrův lék', popis: 'Hořký bylinný elixír. Vypít: +4 zdraví.', pouziti: { zdravi: 4 }, spotrebni: true },
      sifra: { nazev: '📜 Ohořelý lístek', popis: 'Mistrovým písmem, ale samé podivné znaky.' },
      kamen: { nazev: '🪨 Prubířský kámen', popis: 'Černá destička a lahvička lučavky. Pravé zlato na ní nezmizí.' },
      fiolka: { nazev: '🫙 Homunkulus Fiolka', popis: 'Človíček v baňce. Ví mnoho a mluví ještě víc.' },
      kocour: { nazev: '🐈‍⬛ Kocour Merkur', popis: 'Mistrův kocour. Chodí, kudy chce – teď s tebou.' },
      byliny: { nazev: '🌿 Uspávací byliny', popis: 'Od kořenářky Doroty. Stačí hrst do vína nebo do masa.' },
      kniha: { nazev: '📕 Mistrův deník', popis: 'Zápisky o Sebaldově „zlatě“ – i s nákresy.' },
      pecet: { nazev: '🔏 Komořího pečeť', popis: 'Glejt s voskovou pečetí. Otevírá dveře na Hradě.' },
      klic_dum: { nazev: '🗝️ Klíč od zadních dveří', popis: 'Od domu U Černého slunce.' },
      klicek: { nazev: '🔑 Klíček od orloje', popis: 'Drobný, mosazný, s vyrytou lebkou.' },
      slitek: { nazev: '🧈 Rozříznutý slitek', popis: 'Navrch zlato, uvnitř šedé olovo.' }
    },
    konce: {
      triumf: { nazev: 'Pravda před císařem', typ: 'vyhra', popis: 'Nejlepší konec' },
      dukaz: { nazev: 'Podvodník v okovech', typ: 'vyhra', popis: 'Dobrý konec' },
      mistr: { nazev: 'Cesta za Prahu', typ: 'neutral', popis: 'Mistr volný, pravda ne' },
      ticho: { nazev: 'Mlčení', typ: 'neutral', popis: 'Bez slova' },
      zlato: { nazev: 'Falešné bohatství', typ: 'neutral', popis: 'Chamtivost' },
      pomluva: { nazev: 'Slovo proti slovu', typ: 'prohra', popis: 'Obvinění bez důkazu' },
      vezeni: { nazev: 'Za mřížemi', typ: 'prohra', popis: 'Chycen stráží' },
      usvit: { nazev: 'Úsvit přišel dřív', typ: 'prohra', popis: 'Došel čas' },
      smrt: { nazev: 'Noc si vzala svůj díl', typ: 'prohra', popis: 'Zranění' }
    },
    sceny: {
      /* ---------- dílna ve Zlaté uličce ---------- */
      '1': { obr: 'dilna', text: 'Do dílny ve Zlaté uličce se vracíš za soumraku z trhu – a dveře jsou vyražené. Křivule leží rozbité na zemi, knihy rozházené, truhla vypáčená. Athanor v rohu ještě žhne, ale mistr Ondřej Kolár, u kterého se třetím rokem učíš, tu není.\n\nVíš, co to znamená. Císař Rudolf dal dvěma alchymistům lhůtu: zítra za úsvitu mají ve Vladislavském sále předvést zlato. Mistr Sebald z Augšpurku se chvástá, že ho má celou truhlu. Mistr Ondřej chtěl císaři říct pravdu – že z olova zlato udělat neumí nikdo a Sebaldovo zlato je podvod. Když ráno nepřijde, prohlásí ho za podvodníka a uprchlíka.\n\nDo úsvitu zbývá dvanáct hodin. Na stole pod rozlitým inkoustem něco bělá, z police na tebe hledí baňka s homunkulem a na okně sedí mistrův černý kocour.',
        volby: [
          { text: 'Prohledat stůl a truhlu', cil: '2' },
          { text: 'Promluvit na baňku s homunkulem', cil: '3' },
          { text: 'Zavolat na kocoura Merkura', cil: '6' },
          { text: 'Nezdržovat se a vyběhnout ven', cil: '8' }
        ] },
      '2': { obr: 'dilna', efekty: { predmet: ['sifra', 'kamen'], priznak: 'stul' }, text: 'Pod rozlitým inkoustem leží napůl ohořelý lístek. Je to mistrova ruka, ale písmena dávají jen nesmysly – mistr rád psal šifrou, kterou tě ještě nenaučil. Někdo ho zřejmě hodil do ohně a lístek vypadl.\n\nV truhle, mezi rozsypanými mincemi, které lupiči z nějakého důvodu nechali ležet, najdeš ještě černou prubířskou destičku a lahvičku lučavky. „Zlato se pozná po tom, co vydrží,“ říkával mistr. Na prubířském kameni pravé zlato nezmizí ani pod lučavkou, mosaz a olovo ano.',
        volby: [{ text: 'Zastrčit oboje do torby', cil: '7' }] },
      '3': { obr: 'fiolka', text: 'V baňce na polici se pohne človíček velký jako palec. Mistr ho pěstoval sedm let v koňském hnoji a vínu a nikdy ti nedovolil s ním mluvit. Teď si tě homunkulus prohlíží velkýma vodnatýma očima.\n\n„Odvlekli ho,“ zakníká. „Sebaldovi lidé. Já viděl všecko, ale nikomu nic neřeknu – leda tomu, kdo má v hlavě víc než piliny. Hádej: Co to je, čím víc z toho bereš, tím je to větší?“',
        volby: [
          { text: '„Jáma.“', cil: '4' },
          { text: '„Zlato v císařské pokladnici.“', cil: '5' },
          { text: '„Dluh.“', cil: '5' }
        ] },
      '4': { obr: 'fiolka', efekty: { predmet: 'fiolka', priznak: 'hadanka' }, text: '„Jáma! Konečně někdo s rozumem,“ zatleská homunkulus drobnýma ručkama. „Jmenuju se Fiolka. Vezmi mě s sebou, učni – v baňce se nedá nic dělat a ve tmě svítím, když se rozčílím. A čtu, co jiní nepřečtou.“\n\nZtiší hlas: „Byli tři. Mistr se bránil, než ho praštili palicí. Odnesli ho v pytli dolů Starými zámeckými schody. A jeden z nich říkal, že pan Sebald bude spokojený.“',
        volby: [{ text: 'Opatrně zastrčit baňku do torby', cil: '7' }] },
      '5': { obr: 'fiolka', efekty: { priznak: 'hadanka' }, text: 'Homunkulus se otočí zády a dupne nožkou o sklo. „Piliny. Samé piliny. Mistr by se styděl.“\n\nUž ani nepípne. Jen když odcházíš od police, zaslechneš za sebou zamumlání: „…dolů po schodech, v pytli…“',
        volby: [{ text: 'Vrátit se k prohledávání dílny', cil: '7' }] },
      '6': { obr: 'kocka', efekty: { predmet: 'kocour', priznak: 'kocka' }, text: 'Merkur na tebe chvíli hledí zelenýma očima, jako by zvažoval, jestli si to zasloužíš. Pak seskočí z okna a otře se ti o nohy.\n\nMistr o něm říkal, že zná všechny střechy Hradčan i Malé Strany a že se ještě nikdy neztratil. Když vyjdeš ze dveří, kocour půjde s tebou.',
        volby: [{ text: 'Rozhlédnout se po dílně ještě jednou', cil: '7' }] },
      '7': { obr: 'dilna', text: 'Stojíš uprostřed zpustošené dílny. Athanor pomalu dohasíná a z věže svatého Víta odbíjí hodina.',
        volby: [
          { text: 'Prohledat stůl a truhlu', pokud: { bez: 'stul' }, cil: '2' },
          { text: 'Promluvit na baňku s homunkulem', pokud: { bez: 'hadanka' }, cil: '3' },
          { text: 'Zavolat na kocoura Merkura', pokud: { bez: 'kocka' }, cil: '6' },
          { text: 'Požádat Fiolku, ať přečte ohořelý lístek', pokud: { ma: ['fiolka', 'sifra'], bez: 'rozlusteno' }, cil: '63' },
          { text: 'Vyjít do Zlaté uličky', cil: '8' }
        ] },
      '63': { obr: 'fiolka', efekty: { priznak: ['rozlusteno', 'vi_dum'], olej: -1 }, text: 'Fiolka si lístek nechá přiložit k baňce a dlouho nehnutě kouká. Trvá to celou hodinu a ty přešlapuješ u dveří.\n\n„Mistrova zrcadlová šifra, nic těžkého,“ řekne nakonec. „Píše se tu: Kdyby mě odvlekli, hledejte ve sklepích pod domem U Černého slunce na Starém Městě. Ze sklepů vede starý průchod k orloji. Klíček má hodinář Matouš. Dvířka jsou pod Smrtí.“\n\n„Pod Smrtí,“ zopakuje homunkulus spokojeně. „To bude ten kostlivec na orloji.“',
        volby: [{ text: 'Vyjít do Zlaté uličky', cil: '8' }] },

      /* ---------- Zlatá ulička a sousedka ---------- */
      '8': { obr: 'ulicka', efekty: { olej: -1 }, text: 'Zlatá ulička spí. Drobné domky přilepené k hradební zdi mají zavřené okenice, jen u kořenářky Doroty se svítí. Nad střechami se tyčí černá silueta katedrály.\n\nNa dláždění vidíš stopy něčeho taženého – vedou k bráně do Hradu i dolů ke schodům.',
        volby: [
          { text: 'Zaklepat u kořenářky Doroty', pokud: { bez: 'dorota' }, cil: '9' },
          { text: 'Jít do nitra Hradu', cil: '10' },
          { text: 'Sejít Starými zámeckými schody na Malou Stranu', cil: '20' }
        ] },
      '9': { obr: 'ulicka', efekty: { priznak: 'dorota' }, text: 'Dorota otevře v noční košili a se svíčkou v ruce. Když slyší, co se stalo, prásknou jí rty.\n\n„Viděla jsem je. Tři chlapi, jeden zrzavý jak liška, a pytel nesli dolů ke schodům. A víš, kdo tu odpoledne obcházel? Sám pan komoří Ostrovský. Ten s Sebaldem chodí jak dva prsty jedné ruky.“\n\nPodá ti uzlíček sušených bylin. „Uspávací. Hrst do vína nebo do masa a i medvěd chrápe. Vezmi si je – dáš mi tolar, až budeš mít. Nebo hned, jestli ti to svědomí nedá.“',
        volby: [
          { text: 'Zaplatit tolar a poděkovat', pokud: { zlato: 1 }, efekty: { zlato: -1, predmet: 'byliny' }, cil: '8' },
          { text: 'Vzít byliny na dluh a slíbit, že se vrátíš', efekty: { predmet: 'byliny', priznak: 'dluh_dorota' }, cil: '8' }
        ] },

      /* ---------- Pražský hrad ---------- */
      '10': { obr: 'brana', efekty: { olej: -1 }, text: 'Brána do hradního nádvoří je v noci zavřená. Pod klenbou stojí dva strážní s halapartnami a lucernou a nudí se. Na sudu vedle nich stojí džbán vína.\n\n„Kam tak pozdě?“ zívne starší z nich. „Bez glejtu sem v noci nesmí ani myš.“',
        volby: [
          { text: 'Ukázat komořího pečeť', pokud: { ma: 'pecet' }, cil: '12' },
          { text: 'Nabídnout jim dva tolary „na zdraví“', pokud: { zlato: 2 }, efekty: { zlato: -2 }, cil: '12' },
          { text: 'Nenápadně jim nasypat byliny do džbánu', pokud: { ma: 'byliny' }, efekty: { odeber: 'byliny' }, cil: '62' },
          { text: 'Proklouznout podél zdi, až se otočí (zkouška obratnosti)', zkouska: { co: 'obratnost', uspech: '12', neuspech: '11' } },
          { text: 'Vrátit se do Zlaté uličky', cil: '8' }
        ] },
      '62': { obr: 'brana', text: 'Zeptáš se strážných na cestu k Daliborce a zatímco starší ukazuje halapartnou do tmy, hrst bylin zmizí ve džbánu. Za chvíli se oba napijí, za další chvíli si sednou na zem a za třetí už chrápou opřeni o sebe jako dva pytle mouky.\n\nProkradeš se branou.',
        volby: [{ text: 'Na nádvoří', cil: '12' }] },
      '11': { obr: 'brana', text: 'Podrážka ti klouzne po vlhkém dláždění. „Stůj!“ Mladší strážný tě chytí za límec a táhne pod lucernu.\n\n„Zloděj? Nebo vyzvědač?“ Halapartnu odhodí, sáhne po tesáku a rozkročí se.',
        boj: { jmeno: 'Hradní strážný', obratnost: 8, zdravi: 8, vyhra: '12', prohra: '97', utek: '8' },
        volby: [] },
      '12': { obr: 'daliborka', text: 'Hradní nádvoří tone v měsíčním světle. Katedrála je ještě v lešení, z Daliborky svítí jediné zamřížované okno a kdesi u Prašného mostu řve císařův lev.\n\nNa Hradě je Kunstkomora, kde císař schraňuje divy celého světa – a podle řečí i věci zabavené „podezřelým“. Za Prašným mostem je Královská zahrada s Belvederem. A Vladislavský sál, kde bude za úsvitu audience.',
        volby: [
          { text: 'Do Kunstkomory', pokud: { nema: 'kniha' }, cil: '13' },
          { text: 'Přes Prašný most k Lvímu dvoru a do zahrady', pokud: { bez: 'lev' }, cil: '16' },
          { text: 'Do Královské zahrady', pokud: { priznak: 'lev' }, cil: '17' },
          { text: 'Sejít Starými zámeckými schody na Malou Stranu', cil: '20' },
          { text: 'Počkat u Vladislavského sálu na úsvit', cil: '61' }
        ] },
      '13': { obr: 'kunstkomora', efekty: { olej: -1 }, text: 'Dveře Kunstkomory jsou zamčené na tři zámky. Ale o patro výš je pootevřené okénko – snad aby se větralo, aby vycpanému krokodýlovi neplesnivěla kůže.\n\nZeď je hrubá, s rýhami mezi kameny. Pod okénkem běží úzká římsa.',
        volby: [
          { text: 'Poslat nahoru Merkura', pokud: { ma: 'kocour' }, cil: '64' },
          { text: 'Vyšplhat k okénku (zkouška obratnosti)', zkouska: { co: 'obratnost', uspech: '14', neuspech: '65' } },
          { text: 'Vzdát to a vrátit se na nádvoří', cil: '12' }
        ] },
      '64': { obr: 'kocka', text: 'Merkur vyběhne po zdi jako by to byla rovná zem, proklouzne okénkem a uvnitř to zachrastí. Pak cvakne západka a dveře do bočního schodiště se se zaskřípáním pootevřou. Kocour sedí na prahu a olizuje si tlapku, jako by se nic nestalo.',
        volby: [{ text: 'Vejít dovnitř', cil: '14' }] },
      '65': { obr: 'kunstkomora', efekty: { zdravi: -3 }, text: 'V půli zdi se ti pod prsty vylomí kámen. Spadneš zády na dláždění a chvíli nemůžeš popadnout dech. Z dálky se ozve: „Kdo je tam?“\n\nZvedneš se a s bolavými zády zkoušíš znovu – tentokrát pomaleji. Podruhé to vyjde.',
        volby: [{ text: 'Proklouznout okénkem dovnitř', cil: '14' }] },
      '14': { obr: 'kunstkomora', efekty: { predmet: ['kniha', 'pecet'] }, text: 'Kunstkomora je jako sen. Ze stropu visí krokodýl, na policích leží mušle, globusy, kosti draků, roh jednorožce a hodiny, které tikají každé jinak. V koutě stojí mechanický rytíř v plné zbroji s klíčem v zádech.\n\nNa stole u okna leží svázaný balík s cedulkou: „Zabaveno u alchymisty Kolára. Doklad jeho čarodějnictví. Ostrovský.“ Je v něm mistrův deník! Listuješ – na posledních stranách jsou nákresy Sebaldových slitků, rozříznutých napůl, a pod nimi mistrovou rukou: Olovo, jen navrch zlato.\n\nVedle leží prázdný glejt s komořího pečetí, připravený k podpisu. Bereš obojí.',
        volby: [
          { text: 'Natáhnout mechanického rytíře klíčem v zádech', cil: '15' },
          { text: 'Rychle pryč, zpátky na nádvoří', cil: '12' }
        ] },
      '15': { obr: 'kunstkomora', text: 'Klíč zavrže, uvnitř rytíře se roztočí ozubená kola – a rytíř zvedne meč. Oči v hledí se rozsvítí odrazem tvé svíčky. Krok, druhý, cvak, cvak. Hračka pro císaře, která neví, že se hraje.',
        boj: { jmeno: 'Mechanický rytíř', obratnost: 9, zdravi: 8, vyhra: '66', utek: '12' },
        volby: [] },
      '66': { obr: 'kunstkomora', efekty: { zlato: 5 }, text: 'Poslední rána zasáhne pero v rytířově hrudi. Rytíř se zastaví uprostřed kroku, něco v něm cinkne a z hledí se vysype hrst stříbrných tolarů – kdosi si sem zřejmě schovával úspory.\n\nTo bylo hloupé a hlučné. Rychle pryč.',
        volby: [{ text: 'Zpátky na nádvoří', cil: '12' }] },
      '16': { obr: 'lvi_dvur', efekty: { olej: -1, priznak: 'lev' }, text: 'Za Prašným mostem je Lví dvůr. V příkopu pod tebou přechází sem a tam velký lev a jeho oči svítí do tmy. Cesta do zahrady vede po úzké lávce nad příkopem – prkna jsou mokrá a zábradlí chybí.\n\nLev se zastaví přímo pod lávkou a zvedne hlavu.',
        volby: [
          { text: 'Hodit lvovi hrst uspávacích bylin v kusu masa ze stráže', pokud: { ma: 'byliny' }, efekty: { odeber: 'byliny' }, cil: '17' },
          { text: 'Přejít lávku co nejrychleji (zkouška obratnosti)', zkouska: { co: 'obratnost', uspech: '17', neuspech: '67' } },
          { text: 'Vrátit se na nádvoří', cil: '12' }
        ] },
      '67': { obr: 'lvi_dvur', text: 'Prkno pod tebou ujede a ty sjedeš do příkopu. Dopadneš do slámy a písku – a lev už je tady. Jeho dech je horký a páchne syrovým masem.',
        boj: { jmeno: 'Císařův lev', obratnost: 10, zdravi: 12, vyhra: '68', utek: '17' },
        volby: [] },
      '68': { obr: 'lvi_dvur', text: 'Lev zavrčí, olízne si rozseknutou tlapu a odplíží se do své jeskyně. Ještě nikdy nikoho neviděl, kdo by se nedal sníst. Vyškrábeš se po dřevěném žebříku ošetřovatele nahoru a ruce se ti třesou.',
        volby: [{ text: 'Do Královské zahrady', cil: '17' }] },
      '17': { obr: 'zahrada', text: 'Královská zahrada voní zimostrázem. U Zpívající fontány šplouchá voda a v jejím zvonění se dá schovat i šepot. U fontány stojí dvě postavy v pláštích. Jednu poznáš podle špičatého vousu – mistr Sebald. Druhá má na prsou řetěz komořího.',
        volby: [
          { text: 'Připlížit se za živý plot a poslouchat (zkouška obratnosti)', pokud: { bez: 'odposlech' }, zkouska: { co: 'obratnost', uspech: '18', neuspech: '69' } },
          { text: 'Jít dál k Belvederu, kde se svítí', pokud: { bez: 'belveder' }, cil: '19' },
          { text: 'Vrátit se na nádvoří', cil: '12' }
        ] },
      '18': { obr: 'zahrada', efekty: { priznak: ['odposlech', 'vi_dum', 'heslo'] }, text: 'Krčíš se za plotem tak blízko, že slyšíš i Sebaldovo pomlaskávání.\n\n„…Kolár je ve sklepě U Černého slunce a ráno tam zůstane,“ říká Sebald. „Mlčí jak ryba, ale to nevadí. Má truhla je plná a císař uvidí zlato, jaké ještě neviděl.“\n\n„A když se Kolár dostane ven?“ ptá se komoří.\n\n„Odkud? Vrátný Bartoš pustí jen toho, kdo řekne Sol niger. Černé slunce, pane komoří – to je moje znamení.“ Oba se zasmějí a odcházejí ke Hradu.',
        volby: [
          { text: 'Jít k Belvederu, kde se svítí', pokud: { bez: 'belveder' }, cil: '19' },
          { text: 'Vrátit se na nádvoří', cil: '12' }
        ] },
      '69': { obr: 'zahrada', efekty: { priznak: 'odposlech' }, text: 'Pod nohou ti praskne větev. „Kdo je tam?“ Komoří tasí kord a Sebald hvízdne na prsty. Z tmy se vyloupne ramenatý pacholek.\n\nUtíkáš mezi živými ploty, větve tě šlehají do tváře. Pacholek je těsně za tebou.',
        boj: { jmeno: 'Sebaldův pacholek', obratnost: 7, zdravi: 8, vyhra: '17', prohra: '97', utek: '12' },
        volby: [] },
      '19': { obr: 'belveder', efekty: { olej: -1, priznak: 'belveder' }, text: 'Na terase Belvederu stojí velká mosazná armilární sféra a u ní hubený muž s unavenýma, krátkozrakýma očima. Císařský matematik. Píše do sešitu, mumlá si čísla a vypadá, že tě vůbec nevnímá.\n\n„Mars,“ řekne, aniž by zvedl hlavu. „Neběhá v kruhu, víte? V elipse. Nikdo mi to nevěří.“',
        volby: [
          { text: 'Ukázat mu mistrův ohořelý lístek', pokud: { ma: 'sifra', bez: 'rozlusteno' }, cil: '70' },
          { text: 'Zeptat se ho na Sebaldovo zlato', cil: '71' }
        ] },
      '70': { obr: 'belveder', efekty: { priznak: ['rozlusteno', 'vi_dum'] }, text: 'Matematik lístek přidrží proti lucerně a poprvé se usměje. „Zrcadlová šifra. Ondřej Kolár? Toho znám, chytrý člověk.“\n\nNahlas přečte: „Kdyby mě odvlekli, hledejte ve sklepích pod domem U Černého slunce na Starém Městě. Ze sklepů vede starý průchod k orloji. Klíček má hodinář Matouš. Dvířka jsou pod Smrtí.“\n\nVrátí ti lístek. „Pospěšte si. Hvězdy říkají, že ráno bude jasné.“',
        volby: [{ text: 'Zeptat se ještě na Sebaldovo zlato', cil: '71' }] },
      '71': { obr: 'belveder', efekty: { priznak: 'archimedes' }, text: '„Sebaldovo zlato?“ Matematik se zamyslí. „Viděl jsem jeden ten slitek. Byl krásný. A podezřele lehký.“\n\nVezme ze stolu sklenici vody. „Zlato je těžší než olovo – skoro dvakrát. Ponořte slitek do vody a změřte, kolik vody vytlačí. Pak ho zvažte. Z toho poznáte, z čeho je, a nemusíte ho ani řezat. Archimédés to věděl už před osmnácti sty lety. Králi Hierónovi tak odhalil zlatníka, který mu do koruny přimíchal stříbro.“\n\nZnovu se skloní nad sešit. „Kdyby se u audience nabízela možnost – navrhněte to.“',
        volby: [
          { text: 'Poděkovat a vrátit se do zahrady', cil: '17' },
          { text: 'Pospíchat zpátky na nádvoří', cil: '12' }
        ] },

      /* ---------- Malá Strana a řeka ---------- */
      '20': { obr: 'straze', efekty: { olej: -1 }, text: 'Staré zámecké schody tě vyvedou do křivolakých uliček Malé Strany. Z hospody U Zlatého raka se line světlo a zpěv. Dál k řece klapou mlýnská kola a za nimi se v mlze rýsuje Kamenný most.\n\nKolem projde noční hlídka s halapartnami. Přitiskneš se ke zdi a počkáš, až zmizí za rohem.',
        volby: [
          { text: 'Zajít do hospody U Zlatého raka', pokud: { bez: 'hospoda' }, cil: '21' },
          { text: 'Jít přes Kamenný most', cil: '30' },
          { text: 'Dojít k mlýnům a zkusit se dostat přes řeku lodí', cil: '25' },
          { text: 'Vystoupat zpátky na Hrad', pokud: { bez: 'hrad_byl' }, efekty: { priznak: 'hrad_byl' }, cil: '10' }
        ] },
      '21': { obr: 'hospoda', efekty: { olej: -1, priznak: 'hospoda' }, text: 'V hospodě je dusno od kouře a piva. U stolu v rohu sedí rozcuchaný chlapík v livreji s vyšitým černým sluncem – Sebaldův znak! – a prohrává v kostky poslední krejcary. Hostinský ti šeptem prozradí, že je to Kuba, Sebaldův sluha, a že se tu opíjí od večera.\n\n„Hraju o všecko!“ huláká Kuba. „Kdo si troufne?“',
        volby: [
          { text: 'Vsadit dva tolary a hrát s ním (zkouška štěstí)', pokud: { zlato: 2 }, efekty: { zlato: -2 }, zkouska: { co: 'stesti', uspech: '22', neuspech: '23' } },
          { text: 'Koupit mu pivo a vyptávat se', pokud: { zlato: 1 }, efekty: { zlato: -1 }, cil: '72' },
          { text: 'Chytit ho pod krkem a vytřást z něj pravdu', cil: '24' },
          { text: 'Nechat ho být a odejít', cil: '20' }
        ] },
      '22': { obr: 'hospoda', efekty: { zlato: 5, predmet: 'klic_dum', priznak: 'vi_dum' }, text: 'Kostky ti padají jako zaklínané. Kuba prohraje své krejcary, pak nůž, nakonec v zoufalství hodí na stůl velký klíč.\n\n„Od zadních dveří! U Černého slunce, za Týnem. Stejně je to prokletý dům, pán tam ve sklepě drží nějakého starého blázna a mně se to nelíbí.“ Shrábneš výhru i klíč a Kuba se rozpláče do korbele.',
        volby: [{ text: 'Vyjít z hospody', cil: '20' }] },
      '23': { obr: 'hospoda', text: 'Kuba hází šestky, ty jedničky. Shrábne tvé tolary a vysměje se ti do očí. Než stačíš něco říct, je u dveří a mizí ve tmě.\n\nAspoň že hostinský je sdílnější: „Kuba slouží u pana Sebalda, v domě U Černého slunce za Týnem. Ale co tam dělají v noci, to nevím a vědět nechci.“',
        efekty: { priznak: 'vi_dum' },
        volby: [{ text: 'Vyjít z hospody', cil: '20' }] },
      '72': { obr: 'hospoda', efekty: { priznak: 'vi_dum' }, text: 'Po druhém pivu se Kuba rozpovídá. „Můj pán je zlatník, víš? Ne alchymista, zlatník. Pozlacuje olovo, aby to vypadalo jako zlato. A ve sklepě U Černého slunce drží chudáka mistra, co to prokoukl.“\n\nPo třetím pivu usne s hlavou na stole. Klíč, který mu visí u pasu, je přivázaný pevně – bez rvačky ho nedostaneš.',
        volby: [
          { text: 'Zkusit klíč odvázat (zkouška štěstí)', zkouska: { co: 'stesti', uspech: '73', neuspech: '24' } },
          { text: 'Odejít', cil: '20' }
        ] },
      '73': { obr: 'hospoda', efekty: { predmet: 'klic_dum' }, text: 'Uzel povolí na první zatáhnutí. Kuba si jen zamlaská ze spaní. Klíč je velký a těžký – podle všeho od zadních dveří jeho pánova domu.',
        volby: [{ text: 'Vyjít z hospody', cil: '20' }] },
      '24': { obr: 'hospoda', text: 'Kuba je opilý, ale ne tolik, aby se nebránil. Převrhne stůl, kostky se rozkutálejí a v ruce se mu objeví nůž. Hosté udělají kolem vás kruh a hostinský naříká nad rozbitými korbely.',
        boj: { jmeno: 'Kuba, Sebaldův sluha', obratnost: 6, zdravi: 8, vyhra: '26', utek: '20' },
        volby: [] },
      '26': { obr: 'hospoda', efekty: { predmet: 'klic_dum', priznak: 'vi_dum' }, text: 'Kuba leží na zemi a drží se za nos. „Dobře, dobře! Pán drží ve sklepě U Černého slunce nějakého mistra. Za Týnem, dům s černým sluncem nad vraty. Tady máš klíč od zadních dveří, jen mě nech!“',
        volby: [{ text: 'Vzít klíč a jít', cil: '20' }] },
      '25': { obr: 'reka', efekty: { olej: -1 }, text: 'U mlýnů je řeka černá a rychlá. Velká kola klapou ve tmě. U břehu je přivázaná loďka a ve dveřích mlýna stojí mlynář s lucernou a podezíravě si tě měří.\n\n„Přes vodu? V noci? To bude stát tolar. A neptám se proč.“',
        volby: [
          { text: 'Zaplatit tolar a nechat se převézt', pokud: { zlato: 1 }, efekty: { zlato: -1 }, cil: '28' },
          { text: 'Počkat, až odejde, a odvázat loďku (zkouška obratnosti)', zkouska: { co: 'obratnost', uspech: '28', neuspech: '27' } },
          { text: 'Vrátit se a jít přes most', cil: '30' }
        ] },
      '27': { obr: 'reka', efekty: { zdravi: -3, olej: -1 }, text: 'Loďka se pod tebou zhoupne a ty letíš do ledové Vltavy. Proud tě strhne pod mlýnské kolo – jen tak tak se chytíš kůlu. Než se vyškrábeš na břeh, je ti zima až do kostí a drahocenný čas je pryč.\n\nMlynář se na tebe dívá ode dveří a kroutí hlavou. „Tolar, říkal jsem.“',
        volby: [
          { text: 'Zaplatit mu tolar', pokud: { zlato: 1 }, efekty: { zlato: -1 }, cil: '28' },
          { text: 'Jít mokrý přes most', cil: '30' }
        ] },
      '28': { obr: 'reka', text: 'Loďka tiše klouže po černé vodě. Mlha je tak hustá, že most vidíš jen jako tmavý stín nad hlavou. Na druhém břehu tě vysadí pod Klementinem. Mostní věž i se všemi jejími strážemi zůstala stranou.',
        volby: [{ text: 'Vystoupit na Starém Městě', cil: '35' }] },

      /* ---------- Kamenný most ---------- */
      '30': { obr: 'most', efekty: { olej: -1 }, text: 'Kamenný most je dlouhý a prázdný, jen uprostřed stojí dřevěný kříž a pod ním hoří lampička. Mlha stoupá z řeky a tlumí kroky.\n\nU kříže se z mlhy vynoří postava. Zrzavé vlasy, zlomený nos, obušek v ruce. Jeden z těch, kdo odnesli mistra! „Ale, učedníček,“ zašklebí se. „Pan Sebald povídal, že přijdeš. Otoč se a jdi spát – nebo tě do Vltavy hodím já.“',
        volby: [
          { text: 'Postavit se mu', cil: '31' },
          { text: 'Nabídnout mu tři tolary, ať se dívá jinam', pokud: { zlato: 3 }, efekty: { zlato: -3 }, cil: '33' },
          { text: 'Pustit na něj Merkura a proběhnout', pokud: { ma: 'kocour' }, cil: '74' },
          { text: 'Otočit se a jít raději k mlýnům', cil: '25' }
        ] },
      '31': { obr: 'most', text: 'Zrzek se rozmáchne obuškem. Na mokrých kamenech mostu je každý krok risk.',
        boj: { jmeno: 'Zrzavý Ruprecht', obratnost: 8, zdravi: 10, vyhra: '32', prohra: '99', utek: '20' },
        volby: [] },
      '32': { obr: 'most', efekty: { zlato: 2 }, text: 'Ruprecht zavrávorá a obušek mu vypadne z ruky. Než se vzpamatuje, utíká zpátky k Malé Straně. Z jeho měšce, který mu při tom vypadl, se vykutálí dva tolary.',
        volby: [{ text: 'K mostní věži', cil: '33' }] },
      '74': { obr: 'most', text: 'Merkur se s prskáním vrhne Ruprechtovi pod nohy. Zrzek klopýtne, zakleje, rozmáchne se obuškem po kocourovi a mine. Ty mezitím proběhneš kolem. Za chvíli tě kocour dohoní s naježeným ocasem a pyšně vztyčenou hlavou.',
        volby: [{ text: 'K mostní věži', cil: '33' }] },
      '33': { obr: 'most', text: 'Staroměstská mostecká věž je na noc zavřená. Ve strážnici za mřížovím svítí a celník podřimuje nad knihou. Mýtné na noc je tolar, a to jen pro ty, kdo mají dobrý důvod.',
        volby: [
          { text: 'Ukázat komořího pečeť', pokud: { ma: 'pecet' }, cil: '35' },
          { text: 'Zaplatit tolar a vymyslet si dobrý důvod', pokud: { zlato: 1 }, efekty: { zlato: -1 }, cil: '35' },
          { text: 'Přelézt boční zídku k řece (zkouška obratnosti)', zkouska: { co: 'obratnost', uspech: '35', neuspech: '34' } }
        ] },
      '34': { obr: 'straze', text: 'Ze zídky se ti sesype kámen a dopadne s rachotem na dláždění. Celník vyběhne ze strážnice s lucernou a na píšťalku přivolá hlídku. „Pašerák! Chyťte ho!“\n\nNa nábřeží ti cestu zastoupí ponocný s halapartnou.',
        boj: { jmeno: 'Ponocný', obratnost: 7, zdravi: 8, vyhra: '35', prohra: '97' },
        volby: [] },

      /* ---------- Staré Město ---------- */
      '35': { obr: 'orloj', efekty: { olej: -1 }, text: 'Staroměstské náměstí je liduprázdné. Na radniční věži svítí ciferník orloje a apoštolové za okénky spí. Za náměstím se v mlze tyčí věže Týnského chrámu – a někde za nimi je dům U Černého slunce.\n\nKousek odtud, v Klementinu, svítí okno knihovny. Jezuité tam bdí nad knihami i v noci.',
        volby: [
          { text: 'Zajít do knihovny v Klementinu', pokud: { bez: 'klementinum' }, cil: '36' },
          { text: 'Prohlédnout si orloj', cil: '40' },
          { text: 'Najít dům U Černého slunce za Týnem', pokud: { priznak: 'vi_dum' }, cil: '50' },
          { text: 'Ptát se po domě s černým sluncem u ponocného', pokud: { bez: 'vi_dum' }, cil: '37' },
          { text: 'Spěchat na Hrad k audienci', cil: '60' }
        ] },
      '36': { obr: 'klementinum', efekty: { olej: -1, priznak: 'klementinum' }, text: 'Starý páter Bohuslav tě pustí dovnitř, jen co vyslovíš mistrovo jméno. „Ondřej Kolár? Půjčoval si u nás Archiméda a vracel ho včas. Vzácný člověk.“\n\nKnihovna voní pergamenem a voskem. Páter vyslechne tvůj příběh a zamračí se. „Sebald z Augšpurku… V Augšpurku ho vyhnali za falšování mincí. Mám to tu černé na bílém, v kronice.“',
        volby: [
          { text: 'Ukázat mu mistrův lístek', pokud: { ma: 'sifra', bez: 'rozlusteno' }, cil: '75' },
          { text: 'Zeptat se, kde Sebald bydlí', pokud: { bez: 'vi_dum' }, cil: '76' },
          { text: 'Poděkovat a jít', cil: '35' }
        ] },
      '75': { obr: 'klementinum', efekty: { priznak: ['rozlusteno', 'vi_dum'] }, text: 'Páter nasadí brýle a přidrží lístek u zrcátka na stole. „Zrcadlové písmo. Mladý Ondřej se nezmění.“\n\nPomalu čte: „Kdyby mě odvlekli, hledejte ve sklepích pod domem U Černého slunce na Starém Městě. Ze sklepů vede starý průchod k orloji. Klíček má hodinář Matouš. Dvířka jsou pod Smrtí.“\n\nPokřižuje se. „Pod Smrtí. Myslí kostlivce na orloji. Bůh s tebou.“',
        volby: [{ text: 'Poděkovat a jít', cil: '35' }] },
      '76': { obr: 'klementinum', efekty: { priznak: 'vi_dum' }, text: '„Sebald? Koupil dům U Černého slunce za Týnským chrámem. Nad vraty má vytesané černé slunce, prý alchymistické znamení. V noci se mu tam z komína valí kouř, jako by tavil celou horu.“',
        volby: [
          { text: 'Ukázat mu ještě mistrův lístek', pokud: { ma: 'sifra', bez: 'rozlusteno' }, cil: '75' },
          { text: 'Poděkovat a jít', cil: '35' }
        ] },
      '37': { obr: 'straze', text: 'Ponocný si tě změří od hlavy k patě. „Černé slunce? Za Týnem, druhý dům od rohu. Ale co tam chceš v tuhle hodinu?“ Pak přimhouří oči. „Nehledá tě náhodou pan komoří? Říkal, že po městě pobíhá někdo, kdo se vloupal na Hrad.“\n\nSáhne po píšťalce.',
        volby: [
          { text: 'Utéct mezi domy (zkouška obratnosti)', zkouska: { co: 'obratnost', uspech: '77', neuspech: '38' } },
          { text: 'Uplatit ho dvěma tolary', pokud: { zlato: 2 }, efekty: { zlato: -2, priznak: 'vi_dum' }, cil: '35' }
        ] },
      '77': { obr: 'strecha', efekty: { priznak: 'vi_dum' }, text: 'Ponocný píská, ale ty už mizíš v průchodu, přes dvorek a po bednách na střechu kůlny. Za chvíli je ticho. Víš, kde dům je – za Týnem, druhý od rohu.',
        volby: [{ text: 'Zpátky na náměstí', cil: '35' }] },
      '38': { obr: 'straze', text: 'Zakopneš o obrubník. Ponocný tě chytí za kabát a na píšťalku přiběhnou další dva. „Tak tohle je ten zloděj,“ řekne jeden. „Pan komoří bude rád.“',
        boj: { jmeno: 'Noční hlídka', obratnost: 8, zdravi: 10, vyhra: '77', prohra: '97' },
        volby: [] },

      /* ---------- orloj a podzemí ---------- */
      '40': { obr: 'orloj', efekty: { olej: -1 }, text: 'Pod orlojem je ticho. Kostlivec – Smrt – stojí vedle ciferníku s přesýpacími hodinami v ruce a čeká, až bude moci zazvonit. U paty věže jsou malé dveře a za nimi se svítí. Odtud se chodí k hodinovému stroji.',
        volby: [
          { text: 'Zaklepat na dveře hodináře', pokud: { bez: 'hodinar' }, cil: '41' },
          { text: 'Hledat dvířka „pod Smrtí“', pokud: { priznak: 'rozlusteno' }, cil: '43' },
          { text: 'Vrátit se na náměstí', cil: '35' }
        ] },
      '41': { obr: 'hodinar', efekty: { priznak: 'hodinar' }, text: 'Otevře ti stařík s brýlemi na nose a olejničkou v ruce. Hodinář Matouš. Za ním se točí obrovská kola orlojového stroje, cvakají a vrčí.\n\n„Učeň Ondřeje Kolára? Ale ne. Ondřej mi před týdnem říkal, že kdyby se mu něco stalo…“ Zarazí se a změří si tě. „Jak ti mám věřit? Zrovna teď mi zlobí kolo měsíčního ukazatele. Jestli ho do rána nespravím, bude orloj ukazovat úplněk na nov.“',
        volby: [
          { text: 'Pomoct mu se zaseknutým kolem (zkouška obratnosti)', zkouska: { co: 'obratnost', uspech: '42', neuspech: '78' } },
          { text: 'Ukázat mu mistrův lístek', pokud: { ma: 'sifra' }, cil: '79' },
          { text: 'Poděkovat a jít', cil: '40' }
        ] },
      '42': { obr: 'hodinar', efekty: { predmet: 'klicek', priznak: 'rozlusteno' }, text: 'Strčíš ruku mezi kola – jeden špatný pohyb a přijdeš o prsty – a vyndáš zapadlý hřebík. Kolo se s cvaknutím roztočí.\n\nMatouš se usměje. „Šikovné ruce. Ondřej si vybírá dobře.“ Sundá ze skoby drobný mosazný klíček s vyrytou lebkou. „Pod Smrtí, pod kamenem s lebkou, jsou dvířka. Starý průchod do sklepů Starého Města. Ondřej mi řekl, ať ho dám tomu, kdo přijde v nouzi. Dávej pozor, pod zemí je bludiště.“',
        volby: [{ text: 'Ven, pod Smrt', cil: '43' }] },
      '78': { obr: 'hodinar', efekty: { zdravi: -2 }, text: 'Kolo se pohne dřív, než čekáš, a skřípne ti prsty. Syknutím vyrazíš dech a Matouš rychle zarazí stroj.\n\n„Opatrně! Ten stroj už jednoho hodináře o oči připravil, víš?“ Prohlédne ti ruku. „Nic zlomeného. Hm. Kdo se pro cizí orloj nechá skřípnout, asi není špatný člověk.“',
        volby: [{ text: 'Zkusit to znovu, tentokrát pomaleji', cil: '42' }] },
      '79': { obr: 'hodinar', efekty: { predmet: 'klicek', priznak: 'rozlusteno' }, text: 'Matouš si lístek prohlédne a pokývá hlavou. „Ondřejovo zrcadlové písmo. To je on.“ Sundá ze skoby drobný mosazný klíček s vyrytou lebkou.\n\n„Pod Smrtí, pod kamenem s lebkou, jsou dvířka. Starý průchod do sklepů Starého Města – vede až pod dům U Černého slunce. Dávej pozor, pod zemí je bludiště.“',
        volby: [{ text: 'Ven, pod Smrt', cil: '43' }] },
      '43': { obr: 'orloj', text: 'Přímo pod kostlivcem, v soklu věže, je kámen s vytesanou lebkou. Nahmatáš skulinku. Dvířka jsou malá, sotva pro dítě, a zamčená na mosazný zámek.',
        volby: [
          { text: 'Odemknout klíčkem od orloje', pokud: { ma: 'klicek' }, cil: '44' },
          { text: 'Zajít pro klíček k hodináři', pokud: { nema: 'klicek', bez: 'hodinar' }, cil: '41' },
          { text: 'Vylomit zámek (zkouška obratnosti)', pokud: { nema: 'klicek' }, zkouska: { co: 'obratnost', uspech: '44', neuspech: '80' } },
          { text: 'Vzdát to a jít na náměstí', cil: '35' }
        ] },
      '80': { obr: 'straze', efekty: { zdravi: -2 }, text: 'Zámek nepovolí, jen nůž ti sklouzne a rozřízne dlaň. A nahoře na náměstí se ozve: „Co se tam pod orlojem kutí?“ Stáhneš se do stínu.',
        volby: [{ text: 'Vrátit se na náměstí', cil: '35' }] },
      '44': { obr: 'sklepy', efekty: { olej: -1, priznak: 'pruchod' }, text: 'Za dvířky vedou schody do tmy. Sklepy Starého Města jsou starší než samo město – kdysi to byla přízemí domů, než se ulice kvůli povodním navršily. Klenby jsou nízké, stěny vlhké, a chodby se větví jako kořeny.\n\nNa první křižovatce stojíš a nevíš kudy.',
        volby: [
          { text: 'Vyndat Fiolku – ať svítí a radí', pokud: { ma: 'fiolka' }, cil: '45' },
          { text: 'Poslat napřed Merkura', pokud: { ma: 'kocour' }, cil: '81' },
          { text: 'Jít po hmatu a čichu (zkouška štěstí)', zkouska: { co: 'stesti', uspech: '46', neuspech: '82' } }
        ] },
      '45': { obr: 'fiolka', text: 'Fiolka se v baňce rozčílí – „Tma! Plíseň! Krysy!“ – a rozzáří se jako bledá lucerna. „Vlevo. Vlevo, říkám! Cítím síru a olovo. Tam se taví.“\n\nJdeš za jeho světlem a za chvíli opravdu ucítíš pach roztaveného kovu.',
        volby: [{ text: 'Dál za pachem', cil: '46' }] },
      '81': { obr: 'kocka', text: 'Merkur zvedne ocas jako prapor a vyrazí bez váhání doleva. Zastavuje se na každém rohu a čeká, až ho dojdeš. Jako by tudy chodil každou noc – a kdo ví, třeba chodí.',
        volby: [{ text: 'Za kocourem', cil: '46' }] },
      '82': { obr: 'tma', efekty: { olej: -2, zdravi: -2 }, text: 'Chodby se točí v kruhu. Dvakrát se vrátíš ke stejnému sloupu, jednou zakopneš o krysí hnízdo a narazíš si koleno. Když konečně ucítíš pach síry a roztaveného kovu, máš pocit, že uběhla celá věčnost. Uběhly dvě hodiny.',
        volby: [{ text: 'Za pachem', cil: '46' }] },
      '46': { obr: 'sklepy', text: 'Chodba končí okovanými dveřmi. Škvírou prosvítá světlo a slyšíš za nimi chrastění řetězu a starý, unavený hlas, který si mumlá latinské verše. Ten hlas znáš – mistr Ondřej!\n\nDveře nejsou zamčené, jen zastrčené závorou z druhé strany. Nožem ji nadzvedneš.',
        volby: [{ text: 'Vejít do cely', cil: '55' }] },

      /* ---------- dům U Černého slunce ---------- */
      '50': { obr: 'straze', efekty: { olej: -1 }, text: 'Dům U Černého slunce stojí ve stínu Týnského chrámu. Nad vraty je vytesané černé slunce s paprsky jako pavoučí nohy. Z komína se valí kouř a okna v přízemí rudě žhnou.\n\nU vrat stojí vrátný – obr s kyjem – a u jeho nohou dřímá velký pes.',
        volby: [
          { text: 'Říct vrátnému heslo „Sol niger“', pokud: { priznak: 'heslo' }, cil: '83' },
          { text: 'Obejít dům k zadním dveřím a odemknout Kubovým klíčem', pokud: { ma: 'klic_dum' }, cil: '55' },
          { text: 'Hodit psovi uspávací byliny a proplížit se dvorem', pokud: { ma: 'byliny' }, efekty: { odeber: 'byliny' }, cil: '52' },
          { text: 'Vylézt po okapu na střechu a dovnitř vikýřem (zkouška obratnosti)', zkouska: { co: 'obratnost', uspech: '52', neuspech: '84' } },
          { text: 'Vyzvat vrátného k souboji', cil: '51' },
          { text: 'Vrátit se na náměstí', cil: '35' }
        ] },
      '83': { obr: 'straze', text: '„Sol niger,“ zašeptáš. Vrátný zabručí, prohlédne si tě – asi tě má za nového Sebaldova poslíčka – a odsune závoru. „Pán ještě není doma. Nic nešahej.“',
        volby: [{ text: 'Vejít do domu', cil: '52' }] },
      '84': { obr: 'strecha', efekty: { zdravi: -3 }, text: 'Okap povolí a ty spadneš do kupy hnoje na dvoře. Pes se probudí a rozštěká se, vrátný se otočí. „Kdo je tam?“',
        volby: [
          { text: 'Postavit se vrátnému', cil: '51' },
          { text: 'Utéct zpátky na náměstí', cil: '35' }
        ] },
      '51': { obr: 'straze', text: 'Vrátný Bartoš se usměje, jako by na tohle čekal celou noc, a potěžká kyj.',
        boj: { jmeno: 'Vrátný Bartoš', obratnost: 7, zdravi: 10, vyhra: '52', prohra: '99', utek: '35' },
        volby: [] },
      '52': { obr: 'sebald', efekty: { priznak: 'laborator' }, text: 'Sebaldova laboratoř je proti mistrově dílně jako palác proti chalupě. Sametové závěsy, stříbrné křivule – a na stole hromada zlatých slitků, které se lesknou v záři pece. V kotlíku na ohni bublá roztavené olovo a vedle leží štětce a lístkové zlato.\n\nVezmeš jeden slitek a zaryješ do něj nůž. Pod tenkou zlatou kůrou je šedé olovo. Tady je to – celý podvod!\n\nZe sklepa pod podlahou se ozve zachrastění řetězu.',
        volby: [
          { text: 'Vzít rozříznutý slitek jako důkaz', pokud: { nema: 'slitek' }, efekty: { predmet: 'slitek' }, cil: '54' },
          { text: 'Sejít do sklepa za tím zvukem', pokud: { bez: 'mistr' }, cil: '55' },
          { text: 'Nacpat si torbu slitky a zmizet – mistr se nějak zachrání', cil: '53' }
        ] },
      '54': { obr: 'sebald', text: 'Zrovna když schováváš slitek do torby, bouchnou domovní dveře. Na schodech se ozve Sebaldův hlas: „Bartoši! Proč je otevřeno?“\n\nSchovat se za závěs, nebo sejít rychle do sklepa?',
        volby: [
          { text: 'Schovat se za sametový závěs (zkouška štěstí)', zkouska: { co: 'stesti', uspech: '85', neuspech: '57' } },
          { text: 'Seběhnout do sklepa k mistrovi', pokud: { bez: 'mistr' }, cil: '55' },
          { text: 'S mistrem se postavit Sebaldovi', pokud: { priznak: 'mistr' }, cil: '57' }
        ] },
      '85': { obr: 'sebald', text: 'Sebald vejde do laboratoře, přepočítá slitky a spokojeně si pobrukuje. Chybějícího si nevšimne. Pak odejde nahoru do ložnice a ty vydechneš.',
        volby: [
          { text: 'Sejít do sklepa k mistrovi', pokud: { bez: 'mistr' }, cil: '55' },
          { text: 'Utéct z domu s mistrem', pokud: { priznak: 'mistr' }, cil: '58' }
        ] },
      '53': { obr: 'zlato', efekty: { olej: -1 }, text: 'Torba je tak těžká, že se ti zařezává do ramene. Proklouzneš ven a spěcháš tmou pryč z města – s takovým bohatstvím už nikdy nebudeš muset nikomu sloužit.',
        volby: [{ text: 'Pryč z Prahy', cil: '93z' }] },
      '55': { obr: 'vezen', text: 'Ve sklepě páchne plíseň a síra. Na slámě, přikovaný řetězem ke zdi, sedí mistr Ondřej. Má rozbité čelo a oči zarudlé únavou, ale když tě uvidí, rozzáří se.\n\n„Ty?! Věděl jsem, že něco v té tvé hlavě je.“ Zachrastí řetězem. „Zámek je pevný. Klíč nosí Sebald u pasu.“',
        volby: [
          { text: 'Rozleptat zámek lučavkou z prubířské sady', pokud: { ma: 'kamen', bez: 'mistr' }, cil: '56' },
          { text: 'Zkusit Kubův klíč – co kdyby pasoval i sem', pokud: { ma: 'klic_dum', bez: 'mistr' }, zkouska: { co: 'stesti', uspech: '56', neuspech: '86' } },
          { text: 'Otevřít zámek hřebíkem (zkouška obratnosti)', pokud: { bez: 'mistr' }, zkouska: { co: 'obratnost', uspech: '56', neuspech: '86' } }
        ] },
      '86': { obr: 'vezen', text: 'Zámek drží. A nahoře se otevřou dveře. Těžké kroky na schodech, zasvítí lucerna – a ve dveřích sklepa stojí mistr Sebald s kordem v ruce.\n\n„Ale, ale. Učeň,“ usměje se pod špičatým vousem. „Tím líp. Ráno budou na Hradě vyprávět, že Kolár utekl i s pomocníkem.“',
        volby: [{ text: 'Bránit se', cil: '57' }] },
      '57': { obr: 'sebald', text: 'Sebald umí s kordem lépe, než by člověk čekal od zlatníka. Ale jeho sametový kabát je těžký a ty nemáš co ztratit.',
        boj: { jmeno: 'Mistr Sebald', obratnost: 9, zdravi: 10, vyhra: '87', prohra: '99' },
        volby: [] },
      '87': { obr: 'vezen', efekty: { priznak: 'mistr' }, text: 'Sebald klopýtne o kotlík s olovem a padne na záda. Kord mu odletí do kouta. Než se vzpamatuje, máš jeho klíče, mistr je volný – a Sebald místo něj sedí přikovaný ke zdi a nadává německy.\n\n„Ať si tu počká na císařovu stráž,“ řekne mistr Ondřej a mne si zápěstí. „A teď rychle. Úsvit nečeká.“',
        volby: [
          { text: 'Vzít z laboratoře rozříznutý slitek', pokud: { nema: 'slitek' }, efekty: { predmet: 'slitek' }, cil: '58' },
          { text: 'Rovnou ven', cil: '58' }
        ] },
      '56': { obr: 'vezen', efekty: { priznak: 'mistr' }, text: 'Zámek povolí a řetěz spadne na slámu. Mistr se postaví, zavrávorá a opře se o tvé rameno.\n\n„Teď rychle. Sebald se brzy vrátí, a jestli nás tu najde…“ Zastaví se. „Nahoře v laboratoři jsou jeho slitky. Kdybys jeden přinesl k audienci – rozříznutý – nemusel by nikdo nic dokazovat slovy.“',
        volby: [
          { text: 'Vyběhnout nahoru do laboratoře pro slitek', pokud: { nema: 'slitek', bez: 'laborator' }, cil: '52' },
          { text: 'Ven z domu', cil: '58' }
        ] },
      '58': { obr: 'strecha', efekty: { olej: -1 }, text: 'Dole se otevřou dveře a ozve se hlas: „Bartoši! Pacholci! Vězeň utíká!“ Dům se probudí, štěká pes, dupou nohy.\n\nMistr je zesláblý. Musíte zmizet – a rychle.',
        volby: [
          { text: 'Zpátky podzemním průchodem k orloji', pokud: { priznak: 'pruchod' }, cil: '60' },
          { text: 'Za Merkurem po střechách', pokud: { ma: 'kocour' }, cil: '88' },
          { text: 'Po střechách – bez průvodce (zkouška obratnosti)', zkouska: { co: 'obratnost', uspech: '60', neuspech: '59' } },
          { text: 'Probít se dveřmi ven', cil: '89' }
        ] },
      '88': { obr: 'kocka', text: 'Merkur skočí z okna na nejbližší střechu a čeká. Pak vede – po hřebeni, přes okap, po prkně přehozeném mezi komíny, dolů po vinné révě. Mistr za tebou funí, ale jde. Za chvíli jste dva domy daleko a křik za vámi utichá.',
        volby: [{ text: 'Dolů do uličky', cil: '60' }] },
      '59': { obr: 'strecha', efekty: { zdravi: -4 }, text: 'Taška se ti pod nohou utrhne a sjedeš po střeše. Na poslední chvíli se zachytíš okapu, ale ruka a bok tě pálí jako oheň. Mistr tě vytáhne zpátky a vlečete se dál.',
        volby: [{ text: 'Pokračovat', cil: '60' }] },
      '89': { obr: 'straze', text: 'Ve vratech stojí Sebaldovi pacholci s pochodněmi. Mistr se opře o zeď, ty tasíš nůž.',
        boj: { jmeno: 'Sebaldovi pacholci', obratnost: 8, zdravi: 12, vyhra: '60', prohra: '97' },
        volby: [] },

      /* ---------- k audienci ---------- */
      '60': { obr: 'most', efekty: { olej: -2 }, text: 'Běžíš přes Kamenný most, Malou Stranou nahoru, schody po dvou. Na východě už bledne nebe a z kostelních věží se ozývá první klekání. Cesta na Hrad je dlouhá a do kopce.',
        volby: [{ text: 'K Vladislavskému sálu', cil: '61' }] },
      '61': { obr: 'brana', text: 'Před Vladislavským sálem se už shromažďují dvořané v sametu a krajkách. U dveří stojí komořího biřic s halapartnou a pouští jen ty, kdo jsou na seznamu. „Ty ne,“ zastoupí ti cestu. „Učni a sluhové počkají venku.“',
        volby: [
          { text: 'Ukázat komořího pečeť', pokud: { ma: 'pecet' }, cil: '90' },
          { text: 'Proklouznout mezi dvořany (zkouška štěstí)', zkouska: { co: 'stesti', uspech: '90', neuspech: '91' } },
          { text: 'Odstrčit ho a prodrat se dovnitř', cil: '91' }
        ] },
      '91': { obr: 'brana', text: 'Biřic tě chytí za rameno a zvedne halapartnu. „Tak ty se budeš cpát k císaři? Já tě naučím!“',
        boj: { jmeno: 'Komořího biřic', obratnost: 8, zdravi: 10, vyhra: '90', prohra: '97' },
        volby: [] },
      '90': { obr: 'audience', text: 'Vladislavský sál je obrovský. Klenba se nad tebou klene jako kamenné větve a ranní slunce prosvítá okny. Na konci sálu sedí na trůnu císař Rudolf – drobný, unavený muž s melancholickýma očima.\n\nPřed trůnem stojí komoří Ostrovský a vedle něj otevřená truhla mistra Sebalda. Na stole se lesknou zlaté slitky. „Hle, Veličenstvo,“ hlaholí komoří. „Zlato z olova. A alchymista Kolár? Utekl jako každý podvodník.“\n\nTeď, nebo nikdy.',
        volby: [
          { text: 'Mistr Ondřej předstoupí a ty položíš na stůl rozříznutý slitek', pokud: { priznak: 'mistr', ma: 'slitek' }, cil: '92' },
          { text: 'Mistr Ondřej předstoupí a ty podáš císaři jeho deník', pokud: { priznak: 'mistr', ma: 'kniha' }, cil: '92' },
          { text: 'Mistr Ondřej navrhne zkoušku ponořením do vody, jak radil matematik', pokud: { priznak: ['mistr', 'archimedes'] }, cil: '92' },
          { text: 'Mistr Ondřej vyzve komořího ke zkoušce na prubířském kameni (zkouška štěstí)', pokud: { priznak: 'mistr', ma: 'kamen' }, zkouska: { co: 'stesti', uspech: '92', neuspech: '94' } },
          { text: 'Nechat mistra Ondřeje mluvit – pravda se obhájí sama', pokud: { priznak: 'mistr' }, cil: '94' },
          { text: 'Předstoupit a položit na stůl rozříznutý slitek', pokud: { bez: 'mistr', ma: 'slitek' }, cil: '93a' },
          { text: 'Předstoupit a podat císaři mistrův deník', pokud: { bez: 'mistr', ma: 'kniha' }, cil: '93a' },
          { text: 'Navrhnout zkoušku ponořením do vody, jak radil matematik', pokud: { bez: 'mistr', priznak: 'archimedes' }, cil: '93a' },
          { text: 'Vyzvat komořího ke zkoušce na prubířském kameni (zkouška štěstí)', pokud: { bez: 'mistr', ma: 'kamen' }, zkouska: { co: 'stesti', uspech: '93a', neuspech: '96' } },
          { text: 'Obvinit Sebalda bez důkazů', pokud: { bez: 'mistr' }, cil: '96' },
          { text: 'Mlčet a vytratit se', pokud: { bez: 'mistr' }, cil: '98' }
        ] },
      '93a': { obr: 'audience', text: 'V sále to zašumí. Císař se nakloní kupředu a dvorní zlatník dostane rozkaz: rozříznout, zvážit, ponořit, zkusit lučavkou. Netrvá to dlouho. Pod zlatou kůrou je olovo – ve všech slitcích.\n\nKomoří zbledne. „Já… mě taky oklamal, Veličenstvo!“\n\nCísař dlouho mlčí. Pak se tiše zeptá: „A kde je alchymista Kolár?“',
        volby: [{ text: 'Říct, co víš', cil: '97a' }] },
      '97a': { obr: 'audience', text: 'Řekneš všechno – o vypáčené dílně, o pytli na schodech, o domu U Černého slunce. Císař kývne na hejtmana stráže a ten odchází s dvanácti muži.',
        volby: [{ text: 'Čekat', cil: '93' }] },

      /* ---------- konce ---------- */
      '92': { obr: 'usvit', konec: 'triumf', text: 'V sále zavládne ticho. Pak dvorní zlatník dostane rozkaz zkoušku provést – a pod zlatou kůrou Sebaldových slitků se ukáže šedé olovo. Jeden po druhém.\n\nKomoří Ostrovský se pokusí vytratit, ale u dveří ho zastaví stráž. Sebalda zatknou ještě dopoledne v jeho domě za Týnem.\n\nCísař si zavolá mistra Ondřeje k trůnu. „Řekl jste mi pravdu, i když jsem chtěl slyšet lež. To dnes dělá málokdo.“ Mistr dostane místo dvorního lékárníka a ty – plat tovaryše.\n\nKdyž večer sejdete na Kamenný most, Praha pod vámi zlátne v západu slunce. Tohle zlato je aspoň pravé.' },
      '93': { obr: 'usvit', konec: 'dukaz', text: 'Hejtman se vrátí před polednem. Mistra Ondřeje přivedou bledého, ale živého; Sebalda v okovech. Komoří Ostrovský ztratí řetěz i úřad.\n\nCísař mistrovi poděkuje a pošle mu měšec tolarů na opravu dílny. Ale ty víš, že pomoc přišla pozdě – mistr ve sklepě strávil noc, kterou mu už nikdo nevrátí, a horečka ho drží v posteli celý týden.\n\nAle pravda zvítězila. A to se v Praze nestává každý den.\n\n(Tip: zkus mistra osvobodit ještě v noci.)' },
      '94': { obr: 'utek', konec: 'mistr', text: 'Mistr Ondřej mluví klidně a moudře – o tom, že žádný alchymista na světě nedokáže proměnit olovo ve zlato, a že kdo tvrdí opak, lže. Císař poslouchá. A pak se zamračí.\n\n„Sebald mi přinesl zlato. Vy mi přinášíte slova.“ Komoří se usmívá.\n\nMistra nezavřou – císař je spravedlivý – ale do poledne musíte opustit Prahu. Odjíždíte na voze za ranního slunce. Mistr se ohlíží na věže Hradu a říká: „Za rok Sebald zmizí i s císařovými penězi. Uvidíš.“\n\n(Tip: se slitkem, deníkem nebo radou matematika by slova nebyla potřeba.)' },
      '95': { obr: 'audience', konec: 'usvit', text: 'Z věží se rozezní zvony. Úsvit. Někde daleko, ve Vladislavském sále, právě mistr Sebald otevírá truhlu se zlatem a komoří Ostrovský oznamuje, že alchymista Kolár je uprchlý podvodník.\n\nNestihlo se to. Mistra Ondřeje prohlásí za uprchlého podvodníka a do týdne musí z Prahy zmizet – zlomený, bez dílny a bez jména.\n\n(Hlídej si hodiny – všechno se do jedné noci nevejde.)' },
      '96': { obr: 'kobka', konec: 'pomluva', text: '„Lže!“ vykřikneš. „Sebald je podvodník!“\n\nV sále to zašumí a pak se všichni rozesmějí. „A důkaz?“ zeptá se komoří sladce. Nemáš žádný. Jen slova učně, kterého nikdo nezná, proti zlatu, které se leskne na stole.\n\nStráž tě vyvede a hodí do Daliborky za urážku dvora. Pustí tě až po Vánocích.\n\n(Tip: na audienci je třeba důkaz – nebo mistr.)' },
      '97': { obr: 'kobka', konec: 'vezeni', text: 'Probudíš se na studené podlaze kobky. Těžké dveře, okované železem. Klíče visí na skobě na chodbě, tak blízko, a přece nedosažitelně.\n\nZ vyprávění žalářníka se dozvíš, jak audience dopadla: Sebald předvedl zlato, komoří Ostrovský nechal mistra Ondřeje odsoudit jako podvodníka. A tebe jako jeho pomocníka.\n\n(Souboje jsou riskantní – často existuje i jiná cesta.)' },
      '98': { obr: 'utek', konec: 'ticho', text: 'Mlčíš. Císař dostane zlato, komoří pochvalu a Sebald zlatý řetěz. O mistru Ondřejovi se už nemluví.\n\nTýden nato ho najdou bloudit po Starém Městě, vyhladovělého, bez paměti na to, co se stalo. Odvedeš ho domů do Zlaté uličky a staráš se o něj, jak umíš.\n\nZa rok Sebald i s císařovými penězi zmizí. Někdy přemýšlíš, co by se stalo, kdyby tehdy zaznělo tvoje slovo…' },
      '93z': { obr: 'zlato', konec: 'zlato', text: 'Za Prahou, v hostinci u brodu, vysypeš kořist na stůl. Hospodský se nakloní, vezme jeden slitek, zaryje nehtem – a rozesměje se. Pod zlatou kůrou je šedé olovo.\n\nZa celou torbu ti dá tři groše, na pivo a postel. Ráno jdeš dál, jen s prázdnou torbou a s pocitem, který z tebe už nikdy nesmyje žádný déšť.\n\n(Tip: mistr ti ve sklepě pod laboratoří chyběl víc než zlato.)' },
      '99': { obr: 'tma', konec: 'smrt', text: 'Rány jsou příliš vážné. Klesneš na studené dláždění a svět kolem tebe potemní. Někde daleko odbíjí orloj hodinu, a pak další. Úsvitu už se nedočkáš.\n\n(Šetři zdravím: mistrův lék v torbě umí zázraky – a ne každý souboj se musí vybojovat.)' }
    }
  };
  if (typeof module !== 'undefined') module.exports = PRIBEH; else window.GAMEBOOK_PRIBEH = PRIBEH;
})();

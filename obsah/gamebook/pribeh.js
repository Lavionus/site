/* Gamebook „Hlubina pod Černou horou“ – data příběhu (vlastní text, ilustrace z lokálního Z-Image).
   Sekce: text (odstavce oddělené prázdným řádkem), obr, efekty (jen při 1. návštěvě),
   volby [{text, cil | zkouska{co,uspech,neuspech} | boj, pokud, efekty}], boj (souboj hned při vstupu), konec.
   Text je ve 2. osobě přítomného času – hrdina nemá určený rod. */
(function () {
  'use strict';
  const PRIBEH = {
    id: 'cerna_hora',
    nazev: 'Hlubina pod Černou horou',
    podtitul: 'Gamebook z hornického kraje, léta Páně 1546', ikona: '⛏️',
    klic: 'webapp_hra_gamebook',
    start: '1', smrt: '99', tma: '95', svetlo: 'kamen',
    zacatek: { olej: 10, zlato: 3, predmety: ['chleb'] },
    predmety: {
      chleb: { nazev: '🍞 Krajíc chleba', popis: 'Sníst: +4 zdraví.', pouziti: { zdravi: 4 }, spotrebni: true },
      lano: { nazev: '🪢 Konopné lano', popis: 'Dvacet sáhů pevného lana.' },
      krumpac: { nazev: '⛏️ Otcův krumpáč', popis: 'Těžký, ale spolehlivý.' },
      krida: { nazev: '🖍️ Křída', popis: 'Na značení cesty.' },
      klic: { nazev: '🗝️ Rezavý klíč', popis: 'Velký, kovaný, s vyraženým kladívkem.' },
      olej: { nazev: '🫙 Lahvička oleje', popis: 'Dolít do kahanu: +4 světla.', pouziti: { olej: 4 }, spotrebni: true },
      kamen: { nazev: '💎 Svítící kámen', popis: 'Dar permoníka. Dokud ho máš, nezůstaneš ve tmě.' },
      stribro: { nazev: '🪨 Kus ryzího stříbra', popis: 'Těžký a lesklý – tím by se splatily dluhy.' }
    },
    konce: {
      stribro: { nazev: 'Stříbro i otec', typ: 'vyhra', popis: 'Nejlepší konec' },
      otec: { nazev: 'Otec je zachráněn', typ: 'vyhra', popis: 'Dobrý konec' },
      zbabely: { nazev: 'Návrat s prázdnou', typ: 'neutral', popis: 'Bezpečí, ale za jakou cenu' },
      smrt: { nazev: 'Hlubina si vzala svůj díl', typ: 'prohra', popis: 'Zranění' },
      tma: { nazev: 'Věčná tma', typ: 'prohra', popis: 'Došel olej' },
      lupici: { nazev: 'Lupičská pomsta', typ: 'prohra', popis: 'Prohra v souboji' }
    },
    sceny: {
      '1': { obr: 'vesnice', text: 'Nad Horní Stříbrnou se stmívá. Otec, havíř Matěj, odešel před dvěma dny do opuštěného dolu Panny Marie pod Černou horou – prý tam kdysi zahlédl zapomenutou stříbrnou žílu. Úředník z města chce do svátku Všech svatých zaplatit dluh, jinak vám vezme chalupu.\n\nOtec se nevrátil. Matka pláče u kamen a sousedé jen kroutí hlavou: do Panny Marie nikdo nechodí, tam straší permoník.\n\nZapálíš kahan, do torby dáš krajíc chleba a v kůlně se rozhlížíš. Unést můžeš ještě jednu těžší věc.',
        volby: [
          { text: 'Vzít konopné lano', efekty: { predmet: 'lano' }, cil: '2' },
          { text: 'Vzít otcův krumpáč', efekty: { predmet: 'krumpac' }, cil: '2' }
        ] },
      '2': { obr: 'vesnice', text: 'Cesta k dolu vede kolem krčmy U Havířky. Ze dveří se line světlo a smích. Sedává tam starý Šimon, který v Panně Marii fáral ještě jako chlapec, než důl zavřeli.\n\nNoc je ale krátká a otec možná leží někde raněný.',
        volby: [
          { text: 'Zastavit se v krčmě u starého Šimona', cil: '3' },
          { text: 'Neztrácet čas a jít rovnou k dolu', cil: '5' }
        ] },
      '3': { obr: 'vesnice', efekty: { predmet: 'krida', priznak: 'rada' }, text: 'Šimon tě vyslechne a dlouho mlčí. Pak ti podá kus křídy.\n\n„Značkuj si cestu, dole se člověk snadno ztratí. A kdyby se ti zjevil permoník, chovej se zdvořile. Má rád chleba a chytré odpovědi, ale posměch neodpouští. Na rozcestí drž se chodby s vytesanými kladívky – to je stará havířská cesta.“\n\nPak ztiší hlas: „A dej pozor. Odpoledne se tu po dole vyptávali dva cizí chlapi. Neměli dobré oči.“',
        volby: [{ text: 'Poděkovat a vyrazit k dolu', cil: '5' }] },
      '5': { obr: 'vstup', text: 'Vstup do dolu je zatlučený shnilými prkny. Nad ním se v měsíčním světle tyčí polorozpadlá těžní věž. Mezi prkny je úzká škvíra a z ní vane studený, vlhký dech hory.\n\nNa blátě před vchodem vidíš čerstvé otisky bot.',
        volby: [
          { text: 'Protáhnout se škvírou (zkouška obratnosti)', zkouska: { co: 'obratnost', uspech: '6', neuspech: '7' } },
          { text: 'Vyrazit prkna krumpáčem', pokud: { ma: 'krumpac' }, efekty: { priznak: 'hluk' }, cil: '6' },
          { text: 'Dostat strach a vrátit se domů', cil: '90' }
        ] },
      '7': { obr: 'vstup', efekty: { zdravi: -2 }, text: 'Škvíra je užší, než vypadala. Zasekneš se, a když se konečně protlačíš, odřeš si rameno o rezavý hřeb až do krve. Zatneš zuby a jdeš dál.',
        volby: [{ text: 'Pokračovat do štoly', cil: '6' }] },
      '6': { obr: 'stola', efekty: { olej: -1 }, text: 'Štola je nízká, výdřeva vrže a ze stropu kape. Kahan vrhá roztřesené světlo na skálu ohlazenou staletími. V prachu na zemi se rozbíhají dvoje stopy.\n\nJedny jsou čerstvé – dva páry těžkých bot, míří do boční chodby. Druhé jsou starší a menší, s otiskem havířských krpců. Takové nosí otec. Vedou rovně do hloubi hory.',
        volby: [
          { text: 'Jít po stopách těžkých bot', cil: '10' },
          { text: 'Jít po otcových stopách', cil: '8' }
        ] },
      '8': { obr: 'rozcesti', efekty: { olej: -1 }, text: 'Stojíš na podzemním rozcestí. Chodby se tu rozbíhají do tří stran a na trámu visí zčernalý rozcestník bez nápisů – jen vyřezávané znaky.\n\nNad levou chodbou jsou vytesaná zkřížená kladívka. Z prostřední se ozývá šumění vody. Z pravé táhne ledový průvan. Otcovy stopy se tu na kamenité podlaze ztrácejí.',
        volby: [
          { text: 'Levou chodbou s kladívky', cil: '12' },
          { text: 'Prostřední chodbou za zvukem vody', cil: '14' },
          { text: 'Pravou chodbou, odkud táhne', cil: '16' },
          { text: 'Vrátit se po stopách bot', pokud: { bez: 'tabor' }, cil: '10' }
        ] },
      '10': { obr: 'lupici', efekty: { priznak: 'tabor' }, text: 'Boční chodba ústí do sluje, kde dohořívá ohníček. U něj chrápou dva zarostlí chlapi. Vedle nich leží pytle, lucerna, láhev kořalky a – srdce se ti rozbuší – otcova kožená brašna.\n\nJeden z nich má za opaskem velký rezavý klíč.',
        volby: [
          { text: 'Potichu se připlížit a vzít brašnu a klíč (zkouška štěstí)', zkouska: { co: 'stesti', uspech: '11', neuspech: '18' } },
          { text: 'Zaútočit na spáče', cil: '18' },
          { text: 'Tiše couvnout zpět na rozcestí', cil: '8' }
        ] },
      '11': { obr: 'lupici', efekty: { predmet: ['klic', 'olej', 'chleb'], priznak: 'mapa' }, text: 'Našlapuješ jako kočka. Opatrně vytáhneš klíč zpoza opasku, sebereš brašnu a k tomu lahvičku oleje a krajíc chleba, které leží u ohně. Lupič zamlaská ze spaní, ale neprobudí se.\n\nZpátky ve štole otevřeš brašnu. Je v ní otcova ručně kreslená mapa dolu. U podzemního jezera je zakreslená suchá skalní římsa a za ní vrata se znakem kladívka – stejným, jaký je vyražený na klíči.',
        volby: [{ text: 'Vrátit se na rozcestí', cil: '8' }] },
      '18': { obr: 'lupici', text: 'Pod nohou ti křupne kamínek. Jeden z lupičů vyskočí, popadne obušek a vrhne se na tebe. „Ty jsi Matějovo štěně, co? Tak teď uvidíš!“',
        boj: { jmeno: 'Lupič Hrubeš', obratnost: 7, zdravi: 8, vyhra: '19', prohra: '99', utek: '8' } },
      '19': { obr: 'lupici', efekty: { predmet: ['klic', 'olej'], priznak: ['mapa', 'porazen'] }, text: 'Hrubeš klopýtne, upustí obušek a s kletbou prchá do tmy. Jeho druh mezitím zmizel – zbabělec. U ohně zůstal rezavý klíč, lahvička oleje a otcova brašna s ručně kreslenou mapou dolu.\n\nNa mapě je u podzemního jezera zakreslená suchá skalní římsa a za ní vrata se znakem kladívka – stejným, jaký je vyražený na klíči.',
        volby: [{ text: 'Vrátit se na rozcestí', cil: '8' }] },
      '12': { obr: 'permonik', efekty: { olej: -1 }, text: 'Chodba s kladívky je suchá a překvapivě dobře vytesaná. Po chvíli se plamen v kahanu zachvěje, jako by na něj někdo dýchl.\n\nNa balvanu před tebou sedí malý vousatý mužíček se špičatou čepicí, sotva po kolena. V ruce drží maličkou lucerničku a krumpáček. Prohlíží si tě očima jako dva uhlíky.\n\n„Ale, ale,“ zabručí. „Další návštěva. Dneska je tu nějak rušno.“',
        volby: [
          { text: 'Uctivě pozdravit: „Zdař Bůh, pane permoníku.“', cil: '20' },
          { text: 'Nabídnout mu krajíc chleba', pokud: { ma: 'chleb' }, cil: '21' },
          { text: 'Vysmát se mu: „Ty jsi ten strašák, co se ho bojí celá ves?“', cil: '22' },
          { text: 'Nevšímat si ho a jít dál', cil: '23' }
        ] },
      '20': { obr: 'permonik', text: 'Permoník se pousměje do vousů. „Zdař Bůh. Aspoň někdo tu ještě zná mrav. Ale zdvořilost je laciná. Uhodneš, co ti povím?\n\nČím víc z ní bereš, tím je větší. Co je to?“',
        volby: [
          { text: '„Díra.“', cil: '24' },
          { text: '„Stříbrná žíla.“', cil: '25' },
          { text: '„Tma.“', cil: '25' }
        ] },
      '21': { obr: 'permonik', efekty: { odeber: 'chleb' }, text: 'Permoník si chleba vezme oběma ručkama, přičichne a rozzáří se. „Pecen z Horní Stříbrné! Ten jsem neměl sto let.“ Spořádá ho na tři kousnutí a otře si vousy.\n\n„Dobré srdce se pozná podle toho, co dá, když samo nemá nazbyt.“',
        volby: [{ text: 'Počkat, co řekne dál', cil: '24' }] },
      '24': { obr: 'permonik', efekty: { predmet: 'kamen', priznak: 'permonik' }, text: 'Permoník sáhne do kapsy a podá ti kamínek, který svítí tlumeným modrým světlem. „Dokud ho máš, tma tě nespolkne.\n\nTvého tátu hledáš, viď? Je za starými vraty, tam, kde spí voda. Ti dva hrubiáni ho tam zavřeli, když nechtěl prozradit, kde je žíla. Řekni vratům mé jméno – Havíř Ruprecht – a otevřou se ti.“\n\nPak ukáže na úzkou puklinu ve skále. „Tudy je to k jezeru nejkratší.“',
        volby: [
          { text: 'Protáhnout se permoníkovou zkratkou', cil: '30' },
          { text: 'Poděkovat a jít dál chodbou', cil: '28' }
        ] },
      '25': { obr: 'permonik', efekty: { olej: -2 }, text: 'Permoník se zachechtá. „Vedle jak ta jedle! Je to díra, ty hlavo.“ Lusknutím prstů ti z kahanu vycucne kus plamene a zmizí ve skále.\n\nSvětlo je teď slabší a v chodbě je zase ticho.',
        volby: [{ text: 'Pokračovat chodbou', cil: '23' }] },
      '22': { obr: 'permonik', efekty: { zdravi: -3, olej: -2 }, text: 'Permoníkovi zrudne nos. „Strašák?!“ Dupne a celá chodba se otřese. Ze stropu se sesype kamení a jeden kus tě udeří do hlavy. Plamen v kahanu zakolísá a zmenší se.\n\nKdyž se prach usadí, permoník je pryč – a chodba vypadá jinak. Kudy se sem vlastně přichází? A kudy vede cesta dál?',
        volby: [{ text: 'Hledat cestu ven z bludiště', cil: '26' }] },
      '23': { obr: 'stola', text: 'Chodba se chvíli stáčí a klesá. Výdřeva je tu nová, otesaná sekerou – otec tudy musel jít. Pak se stěny náhle rozestoupí.',
        volby: [{ text: 'Pokračovat', cil: '28' }] },
      '26': { obr: 'stola', text: 'Chodby se kříží a vracejí, jako by se hora přesýpala. Po chvíli poznáš, že jdeš kolem stejného trámu potřetí.',
        volby: [
          { text: 'Značit každou odbočku křídou', pokud: { ma: 'krida' }, cil: '28' },
          { text: 'Bloudit a doufat (zkouška štěstí)', zkouska: { co: 'stesti', uspech: '28', neuspech: '29' } }
        ] },
      '29': { obr: 'tma', efekty: { olej: -3, zdravi: -2 }, text: 'Bloudíš celé hodiny. Kahan skomírá, nohy ti otékají a jednou zakopneš do díry plné vody. Když už ztrácíš naději, ucítíš na tváři průvan a jdeš za ním.',
        volby: [{ text: 'Jít za průvanem', cil: '28' }] },
      '28': { obr: 'sachta', text: 'Stojíš na okraji svislé šachty. Dolů vede starý dřevěný žebřík, některé příčle chybějí a jiné jsou zelené plísní. Zezdola zní ozvěna kapající vody – tam někde je jezero.',
        volby: [
          { text: 'Slézt po žebříku (zkouška obratnosti)', zkouska: { co: 'obratnost', uspech: '30', neuspech: '31' } },
          { text: 'Uvázat lano k trámu a spustit se po něm', pokud: { ma: 'lano' }, cil: '30' },
          { text: 'Vrátit se na rozcestí', cil: '8' }
        ] },
      '31': { obr: 'sachta', efekty: { zdravi: -4 }, text: 'V polovině cesty se příčel ulomí. Padáš, narážíš do stěn a dopadneš tvrdě na hromadu hlušiny. Chvíli jen ležíš a lapáš po dechu. Kahan naštěstí vydržel.',
        volby: [{ text: 'Vyškrábat se na nohy', cil: '30' }] },
      '14': { obr: 'stola', efekty: { olej: -1 }, text: 'Prostřední chodba se svažuje a voda ti brzy sahá po kotníky, pak po kolena. Je ledová. Šumění sílí – někde vpředu je velká voda.',
        volby: [
          { text: 'Brodit se dál', efekty: { zdravi: -1 }, cil: '30' },
          { text: 'Vrátit se na rozcestí', cil: '8' }
        ] },
      '16': { obr: 'zaval', efekty: { olej: -1 }, text: 'Pravá chodba končí závalem. Trámy jsou zlámané jako sirky a mezi kameny zbyla jen úzká mezera. Průvan jde skrz – za závalem je volný prostor.',
        volby: [
          { text: 'Prokopat se krumpáčem', pokud: { ma: 'krumpac' }, cil: '32' },
          { text: 'Protáhnout se mezerou (zkouška štěstí)', zkouska: { co: 'stesti', uspech: '32', neuspech: '33' } },
          { text: 'Vrátit se na rozcestí', cil: '8' }
        ] },
      '33': { obr: 'zaval', efekty: { zdravi: -3 }, text: 'Když se soukáš mezerou, kámen nad tebou se pohne a sjede ti po zádech. Bolest je ostrá, ale protáhneš se.',
        volby: [{ text: 'Pokračovat', cil: '32' }] },
      '32': { obr: 'zila', text: 'Za závalem se otevře malá sluj a ty zatajíš dech. Stěnou se táhne široká žíla ryzího stříbra, třpytí se v plameni kahanu jako hvězdy. To je ta otcova žíla!\n\nZ druhé strany sluje vede chodba dolů, odkud zní šplouchání vody.',
        volby: [
          { text: 'Vylámat krumpáčem kus stříbra', pokud: { ma: 'krumpac' }, efekty: { predmet: 'stribro', priznak: 'hluk', olej: -1 }, cil: '34' },
          { text: 'Nechat stříbro být a jít za vodou', cil: '30' }
        ] },
      '34': { obr: 'zila', text: 'Rány krumpáče se rozléhají horou jako zvon. Po chvíli držíš v dlaních kus ryzího stříbra velký jako pěst. Někde daleko za tebou se ozve hlas a dupot – někdo tě slyšel.',
        volby: [{ text: 'Rychle dolů k vodě', cil: '30' }] },
      '30': { obr: 'jezero', efekty: { olej: -1 }, text: 'Ocitáš se na břehu podzemního jezera. Černá hladina se ztrácí ve tmě a ze stropu visí krápníky. U břehu je přivázaná stará loďka. Na druhém konci jezera tušíš skalní stěnu – tam musí být vrata.',
        volby: [
          { text: 'Přeplout ve staré loďce (zkouška štěstí)', zkouska: { co: 'stesti', uspech: '40', neuspech: '37' } },
          { text: 'Plavat podél břehu (zkouška obratnosti)', zkouska: { co: 'obratnost', uspech: '40', neuspech: '37' } },
          { text: 'Najít podle otcovy mapy suchou římsu', pokud: { priznak: 'mapa' }, cil: '40' }
        ] },
      '37': { obr: 'jezero', efekty: { zdravi: -3, olej: -2 }, text: 'Uprostřed jezera se ti voda zavře nad hlavou – loďka prohnilá, nebo noha ztratila oporu. Ledová voda ti vyrazí dech a kahan namočíš. Když se konečně vyškrábeš na druhý břeh, třeseš se zimou.',
        volby: [{ text: 'Jít k vratům', cil: '40' }] },
      '40': { obr: 'vrata', text: 'Ve skále jsou zasazená prastará dubová vrata s železným kováním. Do dřeva jsou vyřezané znaky a uprostřed kladívko. Zpoza vrat prosvítá slabé modré světlo.\n\nA pak uslyšíš slabý hlas: „Je tam někdo? Pomoc…“ Je to otec!',
        volby: [
          { text: 'Odemknout rezavým klíčem', pokud: { ma: 'klic' }, cil: '44' },
          { text: 'Vyslovit permoníkovo jméno', pokud: { priznak: 'permonik' }, cil: '44' },
          { text: 'Vypáčit vrata krumpáčem', pokud: { ma: 'krumpac' }, efekty: { priznak: 'zaplava' }, cil: '42' },
          { text: 'Bušit do vrat a volat na otce', cil: '41' }
        ] },
      '41': { obr: 'vrata', text: '„Jsi to ty?“ ozve se otec. „Bože, dítě… Vrata jsou zamčená, klíč mají ti lotři. Ale poslouchej: nad vraty vlevo je stará větrací chodba. Je úzká, ale projdeš.“\n\nPodíváš se nahoru. Ve skále je opravdu tmavý otvor, dva sáhy nad zemí.',
        volby: [{ text: 'Vyšplhat do větrací chodby (zkouška obratnosti)', zkouska: { co: 'obratnost', uspech: '44', neuspech: '43' } }] },
      '43': { obr: 'vrata', efekty: { zdravi: -3 }, text: 'Dvakrát sklouzneš a odřeš si dlaně do krve. Napotřetí se zachytíš, vytáhneš se a lezeš úzkou chodbou po loktech, až se z druhé strany spustíš dolů.',
        volby: [{ text: 'K otci', cil: '44' }] },
      '42': { obr: 'voda', text: 'Zabereš krumpáčem. Vrata zasténají, kování povolí – a s ním i skála kolem. Zpod prahu vytryskne voda z jezera. Vrata se rozletí a ty vpadneš dovnitř spolu s ledovým proudem.',
        volby: [{ text: 'Rychle k otci', cil: '44' }] },
      '44': { obr: 'otec', efekty: { priznak: 'otec' }, text: 'Otec sedí opřený o stěnu, noha zavázaná kusem košile, vedle něj rozbitý kahan. Když tě uvidí, rozpláče se.\n\n„Ti dva mě tu zavřeli, když jsem jim nechtěl ukázat žílu. Říkali, že se vrátí, až budu povolnější.“ Snaží se vstát, ale noha ho neunese. „Je tu stará cesta nahoru, kudy vozili rudu. Vede přímo k východu. Ale sám to nezvládnu.“',
        volby: [
          { text: 'Dát otci krajíc chleba', pokud: { ma: 'chleb' }, efekty: { odeber: 'chleb', priznak: 'posilnen' }, cil: '46' },
          { text: 'Pomoct otci na nohy', cil: '46' }
        ] },
      '46': { obr: 'stola', text: 'Otec se ti opírá o rameno a pomalu stoupáte starou vozovou cestou. Každý krok ho bolí, ale nestěžuje si.',
        volby: [
          { text: 'Utíkat před stoupající vodou (zkouška obratnosti)', pokud: { priznak: 'zaplava' }, zkouska: { co: 'obratnost', uspech: '48', neuspech: '47' } },
          { text: 'Stoupat dál k východu', pokud: { bez: 'zaplava' }, cil: '48' }
        ] },
      '47': { obr: 'voda', efekty: { zdravi: -4 }, text: 'Voda vás dožene a smete. Táhneš otce za límec, narážíte do trámů a polykáte ledovou vodu. Nakonec se zachytíš výdřevy a oba se vytáhnete do vyšší chodby, kam už voda nedosáhne.',
        volby: [{ text: 'Pokračovat k východu', cil: '48' }] },
      '48': { obr: 'lupici', text: 'Už cítíš čerstvý noční vzduch, když se z boční chodby vynoří postavy s lucernou a zastoupí vám cestu.\n\n„Ale, ale,“ ušklíbne se zarostlý chlap s obuškem. „Vy jste nám ale dali práce. Tak, havíři – kde je stříbro?“',
        volby: [
          { text: 'Hodit jim kus stříbra a nechat je jít', pokud: { ma: 'stribro' }, efekty: { odeber: 'stribro' }, cil: '52' },
          { text: 'Zavolat do tmy: „Havíři Ruprechte, pomoz!“', pokud: { priznak: 'permonik' }, cil: '53' },
          { text: 'Postavit se oběma lupičům', pokud: { bez: 'porazen' }, cil: '49' },
          { text: 'Postavit se Kubovi – Hrubeš už dostal své', pokud: { priznak: 'porazen' }, cil: '51' }
        ] },
      '49': { obr: 'lupici', text: 'Opřeš otce o stěnu a postavíš se lupičům. Jsou dva, ale chodba je úzká a mohou na tebe jen jeden po druhém.',
        boj: { jmeno: 'Lupiči Hrubeš a Kuba', obratnost: 8, zdravi: 12, vyhra: '50', prohra: '98' } },
      '51': { obr: 'lupici', text: 'Hrubeš se drží vzadu a kulhá – ještě si pamatuje vaše první setkání. Proti tobě vyrazí jen jeho druh Kuba s nožem.',
        boj: { jmeno: 'Lupič Kuba', obratnost: 7, zdravi: 8, vyhra: '50', prohra: '98' } },
      '52': { obr: 'lupici', text: 'Stříbro zazvoní o kameny. Lupiči se po něm vrhnou, popadnou ho a zmizí ve tmě. Otec si povzdechne: „Nevadí. Hlavně že jsme živí. Žíla tam zůstala a do rána je u nás v kanceláři horní úředník – ten už si s nimi poradí.“',
        volby: [{ text: 'Vyjít ven', cil: '61' }] },
      '53': { obr: 'permonik', text: 'Chvíli je ticho. Pak se celá hora zachvěje a z tmy se ozve hromový smích. Lupičům zhasne lucerna a nad jejich hlavami se rozzáří tisíc modrých očí.\n\nS řevem utíkají do hloubi dolu a jejich křik se ztrácí v dálce. Na kameni se na okamžik objeví malá postava se špičatou čepicí, mrkne na tebe a zmizí.',
        volby: [{ text: 'Vyjít ven', cil: '50' }] },
      '50': { obr: 'stola', text: 'Cesta je volná. Před vámi světlá skvrna – východ z dolu.',
        volby: [
          { text: 'Vyjít ven se stříbrem v torbě', pokud: { ma: 'stribro' }, cil: '60' },
          { text: 'Vyjít ven', pokud: { nema: 'stribro' }, cil: '61' }
        ] },
      '60': { obr: 'svitani', konec: 'stribro', text: 'Vycházíte z dolu za svítání. Nad Černou horou vychází slunce a dole ve vsi už kouří komíny. Matka vám běží naproti.\n\nKus ryzího stříbra stačí na zaplacení dluhu i na novou střechu. A když otec nahlásí novou žílu na horním úřadě, celá Horní Stříbrná se dozví, že Panna Marie ještě nevydala všechny své poklady.\n\nNa prahu chalupy pak každý večer necháváte krajíc chleba. Ráno vždycky zmizí.' },
      '61': { obr: 'svitani', konec: 'otec', text: 'Vycházíte z dolu za svítání. Otec kulhá, ale je živý, a matka vám běží naproti se slzami v očích.\n\nDluh je pořád nezaplacený, ale otec ví, kde je žíla – a s pomocí sousedů ji jednou vytěží. Hlavní je, že jste zase všichni spolu.\n\n(Tip: zkus to znovu – stříbrná žíla se dá najít a odnést.)' },
      '90': { obr: 'vesnice', konec: 'zbabely', text: 'Otočíš se a utíkáš zpátky dolů do vsi. Celou noc nespíš a posloucháš, jak matka pláče.\n\nRáno se do dolu vydají sousedé. Otce najdou živého, ale sotva dýchá – lupiči ho drželi zavřeného a žílu už vybrali. Chalupa připadne úředníkovi.\n\nNěkdy přemýšlíš, co by se stalo, kdyby…' },
      '95': { obr: 'tma', konec: 'tma', text: 'Plamen v kahanu se naposledy zachvěje a zhasne. Tma je tak hustá, že ji skoro cítíš na kůži. Tápeš podél stěny, ale chodby se větví a vracejí.\n\nKdyž tě po třech dnech najdou havíři z vedlejší vsi, zbývá z tebe jen zesláblý stín. Otce už nenajde nikdo.\n\n(Šetři olejem – a zkus si získat přízeň toho, kdo vidí i ve tmě.)' },
      '98': { obr: 'lupici', konec: 'lupici', text: 'Obušek tě zasáhne do spánku a svět se rozplyne. Probudíš se se svázanýma rukama vedle otce za starými vraty. Lupiči odnesli všechno, co našli, a vás tam nechali.\n\nTrvá to dva dny, než vás najdou havíři z vedlejší vsi. Přežijete, ale žíla je vybraná a lupiči dávno za horami.' },
      '99': { obr: 'tma', konec: 'smrt', text: 'Zranění jsou příliš vážná. Klesneš na studenou skálu a kahan ti vypadne z ruky. Hora je stará a trpělivá – a dnes si vzala svůj díl.\n\n(Šetři zdravím: krajíc chleba v torbě umí zázraky.)' }
    }
  };
  if (typeof module !== 'undefined') module.exports = PRIBEH; else window.GAMEBOOK_PRIBEH = PRIBEH;
})();

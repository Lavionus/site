/* ============================================================
   DATABANKA PANTOMIMY
   Samostatný .js soubor (ne JSON): načítá se přes <script src>,
   takže funguje i přes file:// bez lokálního serveru a bez fetch.
   Formát: PANTOMIMA_DB[jazyk][kategorie][obtížnost] = pole slov.
   Obtížnost: 1 = lehká, 2 = střední, 3 = těžká.
   Přidání slova = připsat řetězec do příslušného pole.
   ============================================================ */
const PANTOMIMA_DB = {
cs: {
"Zvířata": {
 1: ["Slon","Žirafa","Kočka","Pes","Had","Opice","Kráva","Kůň","Králík","Ryba",
     "Pták","Žába","Motýl","Včela","Lev","Tygr","Medvěd","Myš","Slepice","Kohout",
     "Prase","Ovce","Kachna","Netopýr","Klokan","Tučňák","Pavouk","Želva","Krokodýl","Sova",
     "Hroch","Nosorožec","Zebra","Labuť","Holub","Vrána","Beruška","Žížala","Housenka","Kapr"],
 2: ["Veverka","Ježek","Datel","Čáp","Plameňák","Chobotnice","Žralok","Delfín","Velbloud","Gorila",
     "Lenochod","Mravenec","Komár","Moucha","Hlemýžď","Krtek","Liška","Vlk","Jelen","Orel",
     "Papoušek","Páv","Osel","Koza","Bobr","Vydra","Mrož","Tuleň","Rak","Ještěrka",
     "Gepard","Rys","Los","Sob","Lama","Pštros","Úhoř","Vážka","Cvrček","Kobylka",
     "Štír","Krocan"],
 3: ["Chameleon","Medúza","Mlok","Svišť","Pásovec","Mravenečník","Ptakopysk","Škeble","Světluška","Kudlanka",
     "Rejnok","Mořský koník","Jezevec","Rosomák","Surikata","Emu","Axolotl",
     "Tapír","Kapybara","Lemur","Kolibřík","Albatros","Piraňa","Leguán","Hyena"]
},
"Povolání": {
 1: ["Kuchař","Hasič","Policista","Lékař","Učitel","Zubař","Kadeřník","Malíř","Zpěvák","Řidič",
     "Fotograf","Zahradník","Rybář","Pekař","Číšník","Uklízečka","Zedník","Pošťák","Prodavač","Farmář",
     "Voják","Zdravotní sestra","Automechanik","Taxikář","Herec","Tanečnice","Zmrzlinář"],
 2: ["Pilot","Kominík","Chirurg","Dirigent","Soudce","Kněz","Veterinář","Elektrikář","Instalatér","Truhlář",
     "Švadlena","Řezník","Barman","Horník","Dřevorubec","Popelář","Astronaut","Potápěč","Krotitel lvů","Žokej",
     "Moderátor","Sochař","Masér","Optik","Průvodčí","Hlídač","Kaskadér","Klaun","Kouzelník",
     "Plavčík","Rozhodčí","Trenér","Recepční","Letuška","Strojvedoucí","Jeřábník","Bagrista","Pokrývač","Hodinář",
     "Zámečník","Ošetřovatel v zoo","Turistický průvodce","Kovář","Modelka"],
 3: ["Archeolog","Účetní","Programátor","Právník","Psycholog","Meteorolog","Včelař","Restaurátor","Notář","Tlumočník",
     "Lékárník","Geolog","Architekt","Novinář","Špion","Detektiv","Hrobník","Porodní asistentka","Krupiér","Sommeliér",
     "Exekutor","Kartářka","Šaman","Alchymista","Kartograf","Astronom","Chemik","Loutkář","Varhaník","Pyrotechnik",
     "Ladič klavírů"]
},
"Činnosti": {
 1: ["Spaní","Běhání","Jídlo","Pití","Čtení","Psaní","Mytí rukou","Čištění zubů","Česání","Telefonování",
     "Řízení auta","Tancování","Zpívání","Vaření","Žehlení","Zametání","Malování pokoje","Fotografování","Rybaření","Skákání přes švihadlo",
     "Jízda na kole","Lezení po žebříku","Otevírání dárku","Sekání trávy","Plavání",
     "Sprchování","Oblékání","Zavazování tkaniček","Zívání","Utírání nádobí","Zalévání květin","Kreslení","Smrkání","Protahování se"],
 2: ["Stopování","Balení kufru","Věšení prádla","Sázení stromu","Dojení krávy","Střílení z luku","Žonglování","Sekání dřeva","Stavění stanu","Hraní na kytaru",
     "Hraní na klavír","Hraní na bicí","Dirigování","Holení","Líčení se","Pletení svetru","Šití","Loupání cibule","Grilování","Míchání koktejlu",
     "Venčení psa","Krmení miminka","Přebalování","Mytí oken","Tapetování","Vysávání","Nakupování","Sáňkování",
     "Malování vajíček","Zdobení stromečku","Stavění sněhuláka","Pouštění draka","Foukání bublin","Skládání puzzle","Hraní karet","Výměna žárovky",
     "Výměna pneumatiky","Vrtání do zdi","Zatloukání hřebíku","Lakování nehtů","Sbírání hub","Trhání jablek"],
 3: ["Meditace","Náměsíčnost","Ochutnávání vína","Hypnotizování","Výběr z bankomatu","Parkování couváním","Zaklínání hada","Chůze po laně","Břišní tanec","Stepování",
     "Moonwalk","Origami","Sprejování graffiti","Sochání","Kování podkovy","Dabování filmu","Kázání","Uspávání dítěte",
     "Břichomluvectví","Čtení z ruky","Věštění z koule","Psaní na stroji","Vysílání morseovky","Tetování","Stříhání ovcí","Pletení copánků",
     "Chytání motýlů","Rozdělávání ohně"]
},
"Sporty": {
 1: ["Fotbal","Hokej","Tenis","Basketbal","Volejbal","Box","Lyžování","Bruslení","Golf","Šipky",
     "Bowling","Ping-pong","Cyklistika","Plavání (závodní)",
     "Sprint","Skok do dálky","Šplh","Přetahování lanem"],
 2: ["Judo","Šerm","Lukostřelba","Veslování","Horolezectví","Krasobruslení","Skok o tyči","Skok do výšky","Hod oštěpem","Hod kladivem",
     "Vzpírání","Gymnastika","Jóga","Surfování","Jachting","Baseball","Kriket","Rugby","Curling","Biatlon",
     "Vodní pólo","Badminton","Squash","Skoky do vody","Snowboarding","Skateboarding",
     "Florbal","Házená","Maraton","Kolečkové brusle","Sportovní střelba","Motokros","Závody formule","Aerobik","Balet","Rychlá chůze",
     "Překážkový běh","Vrh koulí","Hod diskem"],
 3: ["Sumo","Pétanque","Kanoistika","Šachy","Parkour","Trojskok","Synchronizované plavání","Skoky na lyžích","Rychlobruslení","Pozemní hokej",
     "Lakros","Bungee jumping","Paragliding","Orientační běh","Moderní gymnastika","Skoky na trampolíně",
     "Kitesurfing","Vodní lyžování","Drezura koní","Šnorchlování","Řecko-římský zápas","Taekwondo","Boby","Skeleton"]
},
"Předměty": {
 1: ["Deštník","Kartáček na zuby","Nůžky","Kladivo","Telefon","Brýle","Kniha","Klíč","Hodinky","Židle",
     "Lžíce","Nůž","Vidlička","Hrnec","Polštář","Zrcadlo","Míč","Balónek","Svíčka","Kytara",
     "Tužka","Hřeben","Ručník","Mýdlo","Peněženka","Lampa","Postel","Koště","Rukavice","Čepice","Šála"],
 2: ["Vysavač","Mikrovlnka","Fén","Šroubovák","Pila","Sekera","Lopata","Hrábě","Konev","Dalekohled",
     "Mikroskop","Kompas","Fotoaparát","Sluchátka","Klavír","Buben","Trumpeta","Housle","Stan","Spacák",
     "Baterka","Zapalovač","Vývrtka","Otvírák na konzervy","Struhadlo","Váleček na těsto","Šlehač","Teploměr","Injekce","Berle",
     "Mikrofon","Píšťalka","Zvon","Flétna","Saxofon","Trakař","Kosa","Vidle","Prak","Meč",
     "Štít","Helma","Koloběžka","Kleště","Pinzeta","Lupa"],
 3: ["Periskop","Kyvadlo","Metronom","Semafor","Maják","Katapult","Padák","Bumerang","Harfa","Dudy",
     "Akordeon","Kolovrat","Přesýpací hodiny","Rentgen","Detektor kovů","Hromosvod","Trezor","Past na myši",
     "Gramofon","Globus","Kaleidoskop","Hasicí přístroj","Defibrilátor","Stetoskop","Čínské hůlky","Houpací křeslo"]
},
"Emoce a stavy": {
 1: ["Radost","Smutek","Vztek","Strach","Únava","Nuda","Překvapení","Pláč","Smích","Hlad",
     "Žízeň","Zima (mrznutí)","Horko","Bolest zubů","Zamilovanost",
     "Ospalost","Lechtání","Svědění","Bolest hlavy","Bolest břicha","Rýma","Kašel","Horečka"],
 2: ["Žárlivost","Stud","Nervozita","Zklamání","Pýcha","Znechucení","Zvědavost","Netrpělivost","Úleva","Vyčerpání",
     "Nadšení","Tréma","Závrať","Škytavka","Kýchání","Alergie","Nespavost","Mořská nemoc",
     "Opilost","Zmatenost","Stres","Panika","Nevolnost","Křeč v noze"],
 3: ["Nostalgie","Závist","Rozpaky","Melancholie","Euforie","Paranoia","Déjà vu","Klaustrofobie","Pocit viny","Soucit",
     "Vděčnost","Zamyšlenost","Roztržitost","Podezíravost",
     "Sarkasmus","Nerozhodnost","Zoufalství","Optimismus","Pesimismus","Lhostejnost","Osamělost","Dojetí","Amnézie"]
},
"Pohádky a film": {
 1: ["Popelka","Červená Karkulka","Sněhurka","Vodník","Čert","Anděl","Drak","Princezna","Král","Rytíř",
     "Čarodějnice","Duch","Upír","Pirát","Superman","Spiderman","Batman","Mikuláš",
     "Obr","Víla","Loupežník","Mumie","Kostlivec","Zombie"],
 2: ["Harry Potter","Shrek","Tarzan","Robin Hood","Peter Pan","Pinocchio","Sněhová královna","Zlatovláska","Rumcajs","Krteček",
     "Ferda Mravenec","Maxipes Fík","Zorro","James Bond","King Kong","Godzilla","Yoda","Darth Vader","Mimoň","Elsa (Ledové království)",
     "Mořská panna","Sherlock Holmes",
     "Vlkodlak","Herkules","Aladin","Kocour v botách","Baron Prášil","Hurvínek","Pat a Mat","Bob a Bobek",
     "Rákosníček","Večerníček","Asterix","Obelix"],
 3: ["Golem","Frankenstein","Dracula","Gandalf","Glum","Hobit","Terminátor","Rocky","Indiana Jones","Jack Sparrow",
     "Forrest Gump","Mary Poppins","Střihoruký Edward","Čaroděj ze země Oz","E.T.","Neo (Matrix)","Willy Wonka","Švejk",
     "Kapitán Hák","Don Quijote","Tři mušketýři","Robinson Crusoe","Gulliver","Charlie Chaplin","Mr. Bean","Rambo","Vinnetou"]
},
"Jídlo a vaření": {
 1: ["Špagety","Zmrzlina","Banán","Jablko","Citron","Popcorn","Pizza","Polévka","Lízátko","Žvýkačka",
     "Rohlík","Chléb","Hranolky","Dort","Čokoláda","Bonbón","Med","Mléko","Čaj","Jogurt"],
 2: ["Palačinky","Hamburger","Sushi","Grilované kuře","Vejce naměkko","Kukuřice na klasu","Meloun","Kokos","Ananas","Chilli paprička",
     "Česnek","Cibule","Šlehačka","Fondue","Hot dog","Mléčný koktejl","Taco","Kebab",
     "Smažený sýr","Bramborák","Trdelník","Řízek","Špenát","Kyselá okurka","Pivo"],
 3: ["Kaviár","Ústřice","Šampaňské","Espresso","Croissant","Tatarák","Šneci","Cukrová vata","Žebírka","Tortilla",
     "Pálivá křidélka","Opékání marshmallow",
     "Humr","Artyčok","Flambování","Zavařování marmelády","Granátové jablko"]
},
"Doprava a stroje": {
 1: ["Auto","Autobus","Vlak","Letadlo","Loď","Jízdní kolo","Motorka","Traktor","Vrtulník","Raketa",
     "Tank","Ponorka"],
 2: ["Tramvaj","Trolejbus","Metro","Horkovzdušný balón","Lanovka","Výtah","Eskalátor","Jeřáb","Bagr","Kombajn",
     "Parní lokomotiva","Plachetnice","Sanitka","Vor","Segway","Invalidní vozík"],
 3: ["Vznášedlo","Rogalo","Vzducholoď","Ledoborec","Rolba","Rikša","Gondola","Trabant"]
},
"Příroda a svět": {
 1: ["Slunce","Déšť","Sníh","Vítr","Bouřka","Duha","Hora","Moře","Řeka","Strom",
     "Květina","Měsíc","Hvězda","Oheň"],
 2: ["Sopka","Zemětřesení","Tornádo","Vodopád","Poušť","Ledovec","Jeskyně","Ostrov","Mlha","Krupobití",
     "Povodeň","Západ slunce"],
 3: ["Zatmění slunce","Polární záře","Gejzír","Lavina","Tsunami","Meteorit","Černá díra","Příliv a odliv","Fata morgána"]
}
},
en: {
"Animals": {
 1: ["Elephant","Giraffe","Cat","Dog","Snake","Monkey","Cow","Horse","Rabbit","Fish",
     "Bird","Frog","Butterfly","Bee","Lion","Tiger","Bear","Mouse","Hen","Rooster",
     "Pig","Sheep","Duck","Bat","Kangaroo","Penguin","Spider","Turtle","Crocodile","Owl",
     "Hippo","Rhino","Zebra","Swan","Pigeon","Crow","Ladybug","Earthworm","Caterpillar","Goldfish"],
 2: ["Squirrel","Hedgehog","Woodpecker","Stork","Flamingo","Octopus","Shark","Dolphin","Camel","Gorilla",
     "Sloth","Ant","Mosquito","Fly","Snail","Mole","Fox","Wolf","Deer","Eagle",
     "Parrot","Peacock","Donkey","Goat","Beaver","Otter","Walrus","Seal","Crab","Lizard",
     "Cheetah","Lynx","Moose","Reindeer","Llama","Ostrich","Eel","Dragonfly","Cricket (insect)","Grasshopper",
     "Scorpion","Turkey"],
 3: ["Chameleon","Jellyfish","Salamander","Groundhog","Armadillo","Anteater","Platypus","Clam","Firefly","Praying mantis",
     "Stingray","Seahorse","Badger","Wolverine","Meerkat","Emu","Axolotl",
     "Tapir","Capybara","Lemur","Hummingbird","Albatross","Piranha","Iguana","Hyena"]
},
"Professions": {
 1: ["Chef","Firefighter","Police officer","Doctor","Teacher","Dentist","Hairdresser","Painter","Singer","Driver",
     "Photographer","Gardener","Fisherman","Baker","Waiter","Cleaner","Bricklayer","Postman","Shop assistant","Farmer",
     "Soldier","Nurse","Car mechanic","Taxi driver","Actor","Dancer","Ice cream vendor"],
 2: ["Pilot","Chimney sweep","Surgeon","Orchestra conductor","Judge","Priest","Vet","Electrician","Plumber","Carpenter",
     "Tailor","Butcher","Bartender","Miner","Lumberjack","Garbage collector","Astronaut","Diver","Lion tamer","Jockey",
     "TV host","Sculptor","Masseur","Optician","Train conductor","Security guard","Stuntman","Clown","Magician",
     "Lifeguard","Referee","Coach","Receptionist","Flight attendant","Train driver","Crane operator","Excavator operator","Roofer","Watchmaker",
     "Locksmith","Zookeeper","Tour guide","Blacksmith","Model"],
 3: ["Archaeologist","Accountant","Programmer","Lawyer","Psychologist","Weather forecaster","Beekeeper","Art restorer","Notary","Interpreter",
     "Pharmacist","Geologist","Architect","Journalist","Spy","Detective","Gravedigger","Midwife","Croupier","Sommelier",
     "Debt collector","Fortune teller","Shaman","Alchemist","Cartographer","Astronomer","Chemist","Puppeteer","Organist","Pyrotechnician",
     "Piano tuner"]
},
"Activities": {
 1: ["Sleeping","Running","Eating","Drinking","Reading","Writing","Washing hands","Brushing teeth","Combing hair","Making a phone call",
     "Driving a car","Dancing","Singing","Cooking","Ironing","Sweeping","Painting a room","Taking a photo","Fishing","Jumping rope",
     "Riding a bike","Climbing a ladder","Opening a present","Mowing the lawn","Swimming",
     "Taking a shower","Getting dressed","Tying shoelaces","Yawning","Drying dishes","Watering flowers","Drawing","Blowing your nose","Stretching"],
 2: ["Hitchhiking","Packing a suitcase","Hanging laundry","Planting a tree","Milking a cow","Shooting an arrow","Juggling","Chopping wood","Pitching a tent","Playing guitar",
     "Playing piano","Playing drums","Conducting an orchestra","Shaving","Putting on makeup","Knitting","Sewing","Peeling onions","Barbecuing","Mixing a cocktail",
     "Walking the dog","Feeding a baby","Changing a diaper","Washing windows","Wallpapering","Vacuuming","Shopping","Sledding",
     "Painting Easter eggs","Decorating a Christmas tree","Building a snowman","Flying a kite","Blowing bubbles","Doing a puzzle","Playing cards","Changing a light bulb",
     "Changing a tire","Drilling a wall","Hammering a nail","Painting nails","Picking mushrooms","Picking apples"],
 3: ["Meditation","Sleepwalking","Wine tasting","Hypnotizing","Using an ATM","Parallel parking","Snake charming","Tightrope walking","Belly dancing","Tap dancing",
     "Moonwalk","Origami","Spraying graffiti","Sculpting","Shoeing a horse","Dubbing a movie","Preaching","Putting a baby to sleep",
     "Ventriloquism","Palm reading","Crystal ball gazing","Typing on a typewriter","Sending Morse code","Tattooing","Shearing sheep","Braiding hair",
     "Catching butterflies","Starting a campfire"]
},
"Sports": {
 1: ["Football","Ice hockey","Tennis","Basketball","Volleyball","Boxing","Skiing","Ice skating","Golf","Darts",
     "Bowling","Table tennis","Cycling","Competitive swimming",
     "Sprint","Long jump","Rope climbing","Tug of war"],
 2: ["Judo","Fencing","Archery","Rowing","Rock climbing","Figure skating","Pole vault","High jump","Javelin throw","Hammer throw",
     "Weightlifting","Gymnastics","Yoga","Surfing","Sailing","Baseball","Cricket","Rugby","Curling","Biathlon",
     "Water polo","Badminton","Squash","Springboard diving","Snowboarding","Skateboarding",
     "Floorball","Handball","Marathon","Roller skating","Sport shooting","Motocross","Formula racing","Aerobics","Ballet","Race walking",
     "Hurdles","Shot put","Discus throw"],
 3: ["Sumo","Pétanque","Canoeing","Chess","Parkour","Triple jump","Synchronized swimming","Ski jumping","Speed skating","Field hockey",
     "Lacrosse","Bungee jumping","Paragliding","Orienteering","Rhythmic gymnastics","Trampolining",
     "Kitesurfing","Water skiing","Horse dressage","Snorkeling","Greco-Roman wrestling","Taekwondo","Bobsleigh","Skeleton (sled)"]
},
"Objects": {
 1: ["Umbrella","Toothbrush","Scissors","Hammer","Phone","Glasses","Book","Key","Watch","Chair",
     "Spoon","Knife","Fork","Pot","Pillow","Mirror","Ball","Balloon","Candle","Guitar",
     "Pencil","Comb","Towel","Soap","Wallet","Lamp","Bed","Broom","Gloves","Hat","Scarf"],
 2: ["Vacuum cleaner","Microwave","Hair dryer","Screwdriver","Saw","Axe","Shovel","Rake","Watering can","Binoculars",
     "Microscope","Compass","Camera","Headphones","Piano","Drum","Trumpet","Violin","Tent","Sleeping bag",
     "Flashlight","Lighter","Corkscrew","Can opener","Grater","Rolling pin","Whisk","Thermometer","Syringe","Crutches",
     "Microphone","Whistle","Bell","Flute","Saxophone","Wheelbarrow","Scythe","Pitchfork","Slingshot","Sword",
     "Shield","Helmet","Kick scooter","Pliers","Tweezers","Magnifying glass"],
 3: ["Periscope","Pendulum","Metronome","Traffic light","Lighthouse","Catapult","Parachute","Boomerang","Harp","Bagpipes",
     "Accordion","Spinning wheel","Hourglass","X-ray machine","Metal detector","Lightning rod","Safe","Mousetrap",
     "Gramophone","Globe","Kaleidoscope","Fire extinguisher","Defibrillator","Stethoscope","Chopsticks","Rocking chair"]
},
"Emotions & states": {
 1: ["Joy","Sadness","Anger","Fear","Tiredness","Boredom","Surprise","Crying","Laughing","Hunger",
     "Thirst","Freezing","Feeling hot","Toothache","Being in love",
     "Sleepiness","Being tickled","Itching","Headache","Stomachache","Runny nose","Coughing","Fever"],
 2: ["Jealousy","Shame","Nervousness","Disappointment","Pride","Disgust","Curiosity","Impatience","Relief","Exhaustion",
     "Excitement","Stage fright","Dizziness","Hiccups","Sneezing","Allergy","Insomnia","Seasickness",
     "Drunkenness","Confusion","Stress","Panic","Nausea","Leg cramp"],
 3: ["Nostalgia","Envy","Embarrassment","Melancholy","Euphoria","Paranoia","Déjà vu","Claustrophobia","Guilt","Compassion",
     "Gratitude","Deep in thought","Absent-mindedness","Suspicion",
     "Sarcasm","Indecision","Despair","Optimism","Pessimism","Indifference","Loneliness","Being moved to tears","Amnesia"]
},
"Movies & fairy tales": {
 1: ["Cinderella","Little Red Riding Hood","Snow White","Devil","Angel","Dragon","Princess","King","Knight","Witch",
     "Ghost","Vampire","Pirate","Superman","Spiderman","Batman","Santa Claus",
     "Giant","Fairy","Bandit","Mummy","Skeleton","Zombie"],
 2: ["Harry Potter","Shrek","Tarzan","Robin Hood","Peter Pan","Pinocchio","The Snow Queen","Goldilocks","Zorro","James Bond",
     "King Kong","Godzilla","Yoda","Darth Vader","Minion","Elsa (Frozen)","Mermaid","Aladdin","Hercules","Sherlock Holmes",
     "Werewolf","Puss in Boots","Baron Munchausen","Asterix","Obelix","Popeye","Winnie the Pooh","Mickey Mouse",
     "Donald Duck","Tom and Jerry","SpongeBob","Scooby-Doo"],
 3: ["Golem","Frankenstein","Dracula","Gandalf","Gollum","Hobbit","Terminator","Rocky","Indiana Jones","Jack Sparrow",
     "Forrest Gump","Mary Poppins","Edward Scissorhands","Wizard of Oz","E.T.","Neo (Matrix)","Willy Wonka","Hulk",
     "Captain Hook","Don Quixote","The Three Musketeers","Robinson Crusoe","Gulliver","Charlie Chaplin","Mr. Bean","Rambo","King Arthur"]
},
"Food & cooking": {
 1: ["Spaghetti","Ice cream","Banana","Apple","Lemon","Popcorn","Pizza","Soup","Lollipop","Chewing gum",
     "Bread","French fries","Cake","Chocolate","Candy","Honey","Milk","Tea","Yogurt","Donut"],
 2: ["Pancakes","Hamburger","Sushi","Roast chicken","Soft-boiled egg","Corn on the cob","Watermelon","Coconut","Pineapple","Chili pepper",
     "Garlic","Onion","Whipped cream","Fondue","Hot dog","Milkshake","Taco","Kebab",
     "Grilled cheese sandwich","Schnitzel","Spinach","Pickle","Beer","Burrito","Pretzel"],
 3: ["Caviar","Oysters","Champagne","Espresso","Croissant","Steak tartare","Snails","Cotton candy","Ribs","Tortilla",
     "Hot wings","Roasting marshmallows",
     "Lobster","Artichoke","Flambéing","Making jam","Pomegranate"]
},
"Vehicles & machines": {
 1: ["Car","Bus","Train","Airplane","Ship","Bicycle","Motorcycle","Tractor","Helicopter","Rocket",
     "Tank","Submarine"],
 2: ["Tram","Trolleybus","Subway","Hot air balloon","Cable car","Elevator","Escalator","Crane","Excavator","Combine harvester",
     "Steam locomotive","Sailboat","Ambulance","Raft","Segway","Wheelchair"],
 3: ["Hovercraft","Hang glider","Airship","Icebreaker","Snow groomer","Rickshaw","Gondola","Golf cart"]
},
"Nature & world": {
 1: ["Sun","Rain","Snow","Wind","Thunderstorm","Rainbow","Mountain","Sea","River","Tree",
     "Flower","Moon","Star","Fire"],
 2: ["Volcano","Earthquake","Tornado","Waterfall","Desert","Glacier","Cave","Island","Fog","Hailstorm",
     "Flood","Sunset"],
 3: ["Solar eclipse","Northern lights","Geyser","Avalanche","Tsunami","Meteorite","Black hole","Tide","Mirage"]
}
}
};

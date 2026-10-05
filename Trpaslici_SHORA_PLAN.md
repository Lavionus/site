# Plán: 🏰 Síně pod horou – trpaslíci s pohledem shora (od 5. 10. 2026)

Podrobný popis hry je v `Trpaslici_SHORA_POPIS.md`. Tento soubor sleduje práci po etapách.
„pokračuj“ znamená: vzít první neodškrtnutou etapu a dotáhnout ji celou (implementace, testy v node,
headless ověření, záznam výsledků níže).

## Výchozí rozhodnutí k otevřeným otázkám (kap. 23 popisu)

Rozhodl jsem je sám, aby šlo začít. Uživatel je může změnit.

1. **Grafika:** zatím cesta **A**, tedy vše procedurálně v kódu. Terén se kreslí po pixelech do bloků v mezipaměti,
   předměty cestami Canvasu. Sprity z obrázků (B) se dají doplnit v etapě 10 bez zásahu do terénu.
2. **Samostatná hra** vedle Srdce hory: `obsah/sine.html` + `obsah/sine/*.js`, jmenný prostor `SIN`.
   Logika se ze Srdce hory **kopíruje** a upravuje, nesdílí se, aby změny v jedné hře nerozbily druhou.
3. **Patra:** 8 podzemních po 20 m, jak je navrženo.
4. **Figurky:** mírně šikmo (vidět vousy). Rozhodne se v etapě 2.
5. **Tržiště:** prodané zboží zmizí ze skladu hned. Fyzické nošení je až případné rozšíření v etapě 6.

## Etapy

- [x] **1. Generátor pater a rokle, malovaný terén, kamera, přepínač pater** (5. 10. 2026)
- [x] **2. Trpaslíci, tesání, cesty 8 směry, schodiště, šachta, díry** (5. 10. 2026)
- [x] **3. Stavby, sklady, dílny (převzaté recepty), orientace staveb, ukládání** (5. 10. 2026)
- [x] **4. Místnosti, kvalita, potřeby, jídlo, světlo se stíny** (5. 10. 2026)
- [x] **5. Kov, zakázky, nástroje, priority, nouze** (5. 10. 2026)
- [x] **6. Období, karavana a tržiště, migranti, události** (5. 10. 2026)
- [x] **7. Stabilita podle opor, voda a magma mezi patry** (5. 10. 2026)
- [x] **8. Tvorové, boj, střelba, obrana, nájezdy** (5. 10. 2026)
- [x] **9. Příběh, Spáč, finále, epilog, volný režim** (5. 10. 2026)
- [x] **10. Malované sprity a ilustrace, částice, zvuk** (5. 10. 2026)
- [x] **11. Bot, vyvážení, „Co dál?“, nápověda, offline (sw.js, katalog apps.js)** (5. 10. 2026)

## Testy

- `node _test/sine_test.js [počet]` – generátor na mnoha seedech (VEL=mala|stredni|velka).
- `node _test/sine_sim.js [fuzz her] [tahů]` – scénáře simulace, determinismus, fuzz s invarianty (SEED=, VEL=, JEN=regex).
- `python3 _test/sine_snimek.py` – headless kontrola stránky a snímky `_test/sine_*.png`
  (porty env TEST_PORT/DRIVER_PORT, výchozí 8197/9617).

## Záznamy z etap

### Etapa 1 (5. 10. 2026)

Soubory: `obsah/sine.html`, `obsah/sine/nahoda.js` (kopie ze Srdce hory), `svet.js` (generátor), `kresba.js`
(malovaný terén, předměty, minimapa), `ui.js` (kamera, patra, minimapa, popis pole). Hra zatím není
v katalogu `apps.js` ani v `sw.js` – přidá se v etapě 11, až bude hratelná.

- **Generátor:** 9 pater, horniny šumem podle tabulky z popisu, rokle s cestou, potokem, soutěskou
  s polorozpadlým mostem a brodem u východního útesu, Brána předků s předsíní 6 × 4 a schodištěm
  do 1. patra, místo pro tržiště. Podzemí: jeskyně buněčným automatem (obyčejné, krápníkové, houbové,
  hlubinné, magmatické s obsidiánem), jezero s hloubkou podle vzdálenosti od břehu, strážnice,
  Síň předků se sloupořadím a kruhovou mozaikou, Srdce hory z runové zdi, goblinní tunel z okraje 8. patra.
  Rudy se losují do pater podle hloubky (zlato zaručeně v 5., hvězdná ruda ≥ 10 polí v 7., nic v 8.).
  Zdivo si v `zaklad` pamatuje přírodní horninu za sebou.
- **Kresba:** bloky 8 × 8 polí v mezipaměti, LOD 16/32/64/128 px na pole. Okraje jeskyní jsou rozvlněné
  vzdálenostní pole (chamfer), útesy jsou vrstvené pruhy osvětlené od SZ, na podlahu padá vržený stín,
  otesané zdi jsou z kvádrů a runová zeď Srdce je oblá. Druhy podlah a hornin se prolínají přes šumový
  posun (jinak by byly vidět čtverce polí). Masiv a prázdnota mají dlaždici 8 × 8 polí, mech na masivu
  vzniká ze světového šumu.
- **Testy:** `node _test/sine_test.js 300` (všechny tři velikosti bez chyb, generování ~21 ms),
  `python3 _test/sine_snimek.py` 13/13 (DPI 1 i 2, úzký displej). Stavba bloků při zoomu 1 je ~150 ms
  na obrazovku, v animaci se rozkládá do snímků (rozpočet 12 ms). Překreslení z mezipaměti trvá < 1 ms.
- **Pasti:** periodický šum musí mít celočíselnou periodu (frek × dlaždice), jinak vzniknou švy
  na hranicích dlaždic. Šum pro pixel se smí číst jen uvnitř vzorkovací mřížky bloku, jinak se okraj
  roztáhne do pruhů. Na malé hoře (64 × 64) chybí asi u 15 % seedů místo pro tržiště – řešit v etapě 6.
- **Na příště:** světlo a tma podzemí (etapa 4), figurky (etapa 2), slabý obrys patra nad aktuálním
  zatím kreslí jen schodiště.

### Úprava stylu podle předlohy (5. 10. 2026)

Uživatel dodal malovanou předlohu (uložená mimo git jako `_test/sine_predloha.png`, slouží jen jako stylová
reference). Podle ní je surová podlaha z nepravidelných tmavých kamenů (periodický Voronoi), útesy mají
proudnice souběžné s okrajem, tmavou linku u podlahy a rýhy mezi hřbety. Podzemí je tmavší a teplejší,
dlažba tmavší a otesané síně mají čtvercové pilíře v rozích a po čtyřech polích, přisazené ke stěně.
Světlo (teplá místa, tma kolem) přijde v etapě 4. Teprve pak bude dojem jako v předloze.

### Etapa 2 (5. 10. 2026)

Nové soubory: `obsah/sine/cesty.js`, `prace.js`, `hra.js`, `postavy.js`. `ui.js` dostal smyčku simulace a nástroje.

- **Cesty:** chůze 8 směry bez řezání rohů (rovně 4, šikmo 6, mělká voda a keř +2). Spoje mezi patry jsou
  schodiště 12, žebřík 10 a šachta 7 tahů. Hledání je Dijkstra s předčasným koncem, takže výběr práce
  i cesta k ní je jedno prohledání. Souvislé oblasti chůze (komponenty) se přepočítají líně po změně průchodnosti.
- **Práce:** značky kopat / schody / díra / otesat / kácet, ⭐ přednost a zrušit. Plány žebříku a šachty
  do díry potřebují donést 1 dřevo. Z značek se staví jednotky práce se stojišti. Schodiště má dvě části
  (horní a dolní pole), každá jde tesat ze svého patra nebo z té druhé, je-li už volná. Díra pod sebou
  vytesá malou prostoru, věci i trpaslík propadnou (−30 zdraví). Otesání udělá z podlahy dlažbu
  a z okolní skály zdivo (ruda ve stěně se vytěží). Pokácená jedle dá 3 dřeva a pařez za 4 dny doroste.
  Výnosy a doba tesání jsou jako v Srdci hory (železný krumpáč až v etapě 5).
- **Trpaslíci:** 7 se stupni prací podle profese (horník kopat, kameník otesávat, tesař kácet a stavět,
  nošení všichni). Hledají práci každých 15–21 tahů a mají rychlé odmítnutí, když v jejich oblasti nic
  volného není. Zorné pole má 8 polí (paprsky). Proražení do jeskyně ji odhalí celou a zapíše objev do deníku.
- **Uvíznutí a záchrana:** kdo nemá spojení se základnou (předsíní), uvízl. Hra mu naplánuje schodiště
  o patro výš (dolní pole smí být i skála vedle něj) a chodbu ke klanu nejkratší cestou skálou (0-1 BFS).
  Záchranné značky mají nejvyšší přednost.
- **Rozhraní:** lišta nástrojů (K L H O C P X B, Esc). Tažením s nástrojem se označuje, bez nástroje nebo
  pravým tlačítkem se posouvá. Rychlosti ⏸ 1× 2× 4× (mezerník, 1/2/3), datum, panel Klan (klik vybere
  trpaslíka a skočí na něj), Deník (klik skočí na místo), počty trpaslíků v přepínači pater, trpaslíci
  v minimapě. Schodiště ze 7. do 8. patra se potvrzuje. Figurky jsou malované shora (tunika v barvě
  profese, čepice či přilba, vousy, kývající se krumpáč), věci na zemi mají malé malované ikony.
- **Testy:** `node _test/sine_sim.js` 43/43 (chodba, schodiště, díra a záchrana čekající i pracující oběti,
  žebřík, šachta, kácení s dorůstáním, otesání, jeskyně, determinismus, fuzz 3 × 20 000 tahů s invarianty).
  Výkon: průměr ~60 µs na tah, p99 ~1 ms. Špičky dělá přepočet komponent po vykopání (~1,5 ms).
  `python3 _test/sine_snimek.py` 18/18 (nástroje, označení tažením, simulace 2500 tahů za ~200 ms v prohlížeči,
  klan, rychlosti).
- **Na příště:** ukládání hry (etapa 3 – teď se po načtení stránky začíná znovu), sklady a nošení věcí,
  inkrementální komponenty, pokud by přepočet vadil ve velké hoře.

### Etapa 3 (5. 10. 2026)

Nové soubory: `obsah/sine/stavby.js` (stavby, recepty, zóny, zakázky) a `ulozeni.js` (uložení a obnova).

- **Stavby:** 30 typů v šesti skupinách palety. Chodby a patra: žebřík, šachta (vyžaduje tesařskou dílnu),
  lávka, kamenný a dřevěný sloup, louč (jen u stěny), svícen, zeď, dveře. Podlahy: dlažba, šachovnice,
  prkna, koberec, mozaika. Dále kuchyně, pivovar, nábytek (postel 1 × 2, stůl, židle, lavice 2 × 1, socha,
  truhla a sud jako malé sklady na 8 věcí), dílny (tesařská, kamenická, brusírna, tkalcovna) a kovy (milíř,
  tavírna, kovárna, magmatická výheň do 3 polí od magmatu). Studna, pumpa, obrana a stánky přijdou se
  svými etapami.
- **Plány:** materiál se donáší skutečnými věcmi ze země i ze skladu. Jednotky donášky jsou „sloty“ podle
  chybějících kusů, takže se nenosí víc, než je třeba. Blokující stavba odsune trpaslíky i věci ze svých polí.
  Zbourání vrátí materiál i zásobu dílny. Plán, jehož místo přestane vyhovovat, se zruší.
- **Orientace:** klávesa R (nebo ⟳ v paletě). Dílna má přední stranu: z předních polí se pracuje,
  na vstupní pole se nosí materiál (zásoba je na něm vidět), na výstupní padá výrobek.
- **Dílny a recepty:** převzaté ze Srdce hory a doplněné podle popisu (dlažba 2 pole, prkna 2 pole,
  lavice, truhla, sud, svícen, kuše, šípy (20), mozaika 2 pole, koberec, plátno, pečená ryba).
  Zakázky jsou „+1 / +5“ a trvalé „udržuj N“ (∞ přidá +5), mají pořadí ↑ a dají se zrušit ✖.
  Kuchyně a pivovar si samy nastaví „udržuj 20“. Dílnu obsluhuje přednostně její profese, jiní až když
  nemají nic jiného (stupeň 3). Kovy, nástroje a opotřebení jsou připravené v receptech, ale jejich
  účinky přijdou v etapě 5.
- **Sklady:** zóna se kreslí tažením (nástroj 📦 Z), pojme 4 věci na pole, má filtr podle 7 skupin a ⭐
  přednost. Nošení vybírá nejbližší sklad s místem (přednostní má náskok 300) a místo si rezervuje.
  Výchozí sklad je předsíň a počáteční zásoby jsou rozložené po 4 na pole. Nástroj Zrušit maže
  i zóny v obdélníku.
- **Účetnictví věcí:** platí `věci + uloženo v plánech a dílnách = vytvořeno − spotřebováno`.
  Simulační test to hlídá po každém tahu (i ve fuzzu se zbouráním, rušením plánů a zón).
- **Ukládání:** RLE pole hory + JSON stavu, ~50 kB. Ukládá se do `webapp_hra_sine_save` každý herní den,
  při skrytí stránky a tlačítkem 💾. Export ⬇️ a import 📂 souborem. Po načtení stránky se pokračuje
  v uložené hře (`?seed=` nebo `?nova=1` začne novou). Test ověřuje, že každý klíč stavu se ukládá nebo je
  vědomě přechodný a že hraná i načtená kopie dají po dalších 4000 tazích (i uprostřed rozdělané výroby)
  bit po bitu stejný uložený stav. Podmínka: před uložením se přestaví jednotky práce, protože přestavba
  vybírá aktivní zakázky dílen.
- **Rozhraní:** paleta staveb (ceny, zašedlé, když materiál chybí), náhled pod kurzorem (zelený/červený,
  u dílen přední pole). Panel vybrané dílny (recepty, fronta), plánu (materiál), stavby (zbourat) a skladu
  (filtr, přednost, zrušit). Přehled zásob, ukazatel výroby nad dílnou.
- **Kresba:** dílny a nábytek jsou malované cestami Canvasu a vypalují se do bloků terénu (háček
  `stavby` v kresba.js): ponk s pilou, ohniště s hrncem, káď a sudy, výheň a kovadlina, brusný kotouč,
  stav s nitěmi, postel s červenou pokrývkou jako na předloze, louč a svícen se září, dveře podle zdí.
- **Testy:** `node _test/sine_sim.js` 67/67 (sklad, dílna a zakázky, postel, trvalá zakázka, zbourání,
  dlažba → šachovnice, šachta po dílně, uložení a obnova, fuzz se stavbami a zakázkami),
  `python3 _test/sine_snimek.py` 23/23 (paleta, plán klikem, dílna z panelu, sklad tažením, obnova po načtení
  stránky).
- **Na příště:** 2 pracoviště v dílně ze Srdce hory zatím nejsou (dílna má jednoho řemeslníka). Sprity
  dílen jsou zatím jednoduché a zpřesní se v etapě 10.

### Etapa 4 (5. 10. 2026)

Nové soubory: `obsah/sine/mistnosti.js`, `svetlo.js` a `potreby.js`.

- **Místnosti:** souvislá volná pole (4-sousedství) mezi skálou, zdmi a dveřmi. Dveře a Brána předků
  jsou hranice. Nad 400 polí, na okraji mapy nebo venku v rokli jde o otevřený prostor. Kvalita 0–15
  podle tabulky z popisu (uzavřená +2, otesané zdi ≥ 60 % +2, převažující podlaha +1 až +3, sochy,
  kamenný nábytek, osvětlení ±, stísněnost −2) se slovy ubohá … legendární. Kamenný nábytek se pozná
  podle materiálu výrobku (`vec.mat` → plán → stavba).
- **Světlo:** rekurzivní stínování po oktantech pro louč (7), svícen (6) a ohně dílen (4, síla 0,8).
  Magma (2) a denní světlo do hory (4 pole branou a otvory, dírami o patro níž) se rozlévají.
  Sloupy, stromy, houby, krápníky a dveře vrhají stín. Den má 24 hodin (noc 0,15).
  Ve hře je tma podzemí (vrstva 1 px na pole, vyhlazená), teplá záře ohňů (aditivně), modrá noc venku
  a lampička kolem každého trpaslíka pod zemí a v noci. Čas je vidět v liště (hh:mm).
- **Potřeby:** hodnoty ze Srdce hory (úbytky, prahy, nasycení, hlad a žízeň ubírají zdraví, hojení,
  vzpomínky s návykem, nálada 45 + rozpis, rychlost práce 0,6–1,4× podle nálady). Pohled shora mění místa:
  - jídlo se nese ke stolu v jídelně do 400 tahů cesty (vzpomínka podle kvality místnosti), jinak se jí
    na zemi −3, syrové −5;
  - pije se pivo, a je-li voda podstatně blíž, voda z potoka nebo jezera −6;
  - spí se v posteli (vlastní pokoj má přednost) s vzpomínkou podle kvality ložnice. Hluk (neuzavřená
    místnost nebo dílna do 3 polí) zpomalí spánek ×0,8 a dá −2. Na zemi −6;
  - zranění pod 60 se léčí na ošetřovně 3× rychleji;
  - vlastní pokoj (uzavřená ložnice s jedinou postelí, přidělí se sám podle id) +3, jinak „každý má svou
    postel“ +2; práce ve tmě −6;
  - kritický hlad přeruší práci.
  Záchvaty vzteku a odchody přijdou s událostmi (etapa 6).
- **Farmy:** zóny pole ječmene (louka v rokli, 2 snopy, ~2 dny) a houbárna (surová podlaha pod zemí,
  1 houba, ~2,5 dne, u vody rychleji). Setí a sklizeň dělá přednostně farmář, sklízí se do zásoby
  5 na trpaslíka (aspoň 12). Divoký ječmen na louce se stane rostoucím polem. Roční období přijdou v etapě 6.
- **Zóny:** sklad, ložnice, jídelna, ošetřovna, pole a houbárna (paleta po Z). Klepnutím do uzavřené
  místnosti se vyplní celá. Panel zóny ukazuje kvalitu s rozpisem, u farmy úrodu a zásobu.
  Panel trpaslíka má pruhy jídla, pití, spánku a zdraví a rozpis nálady. Klan ukazuje emoji nálady.
- **Testy:** `node _test/sine_sim.js` 80/80. Nově: místnost se slije bez dveří a uzavře se dveřmi
  (6 × 5 = 30 polí), kvalita před a po otesání a louči, sloup vrhá stín, rozumná kolonie (ložnice
  s postelemi, jídelna se stolem, louče) má náladu 59 proti 33 bez pohodlí, farmy sklidí ječmen
  i houby do 5 dnů, bez jídla první smrt hlady po ~11,7 dne. Uložení a obnova pokračují bit po bitu
  stejně i s potřebami. `python3 _test/sine_snimek.py` 28/28 (louč rozsvítí místnost, paleta zón,
  vyplnění místnosti, panel potřeb, noc).
- **Výkon:** průměr tahu je dál nízký. p99 stoupl na ~2 ms, protože po změně terénu se přepočítá
  světlo (zdroje + denní světlo celého povrchu) a místnosti. Kdyby to vadilo, oddělit denní světlo
  povrchu (mění se jen při změně patra 0) a místnosti přepočítávat jen v dotčeném patře.

### Etapa 5 (5. 10. 2026)

- **Dvě pracoviště v dílně** (doplněno z etapy 3): `dilna.mista[0..1]` mají každé vlastní aktivní zakázku,
  zásobu a příchozí materiál. Druhé místo nebere zakázku nad její počet (u „udržuj N“ započítá rozpracované)
  ani materiál, na který už čeká první. Pracuje se z vlastního předního pole (první vlevo, druhé vpravo).
  Panel dílny ukazuje obě pracoviště i kdo na nich dělá.
- **Kovy:** milíř (2 dřeva → 2 uhlí), tavírna (ruda + uhlí → prut), kovárna (krumpáč, sekera a kladivo
  železné, měděný krumpáč a kladivo, svícen, kuše, šípy, válečná sekera, železná a měděná zbroj, kovaná
  socha), magmatická výheň (bez uhlí). Výrobek nese kov (`vmat`) – podle něj nástroj zrychluje.
- **Nástroje:** krumpáč (tesání, schody, díry; železo 1,6×, měď 1,35×), sekera (kácení 2,0×/1,6×), kladivo
  (stavění, výroba, otesávání 1,4×/1,25×). Opotřebení je železo 1,5, měď 2,5 za použití (měděný vydrží 40
  použití) a zlomený nástroj zmizí s hlášením. Tvrdá skála (tvrdost ≥ 4) bez železného krumpáče ×1,8.
  Trpaslík si sám dojde pro nástroj své profese (horník krumpáč, tesař a farmář sekeru, ostatní kladivo).
  Železný má přednost a starý nechá ležet. Na začátku jsou 2 staré měděné krumpáče. Držený nástroj se
  počítá do účetnictví věcí (uloženo) a po smrti vypadne.
- **Dovednosti:** kopání 0–20 (6 + 2 × stupeň vytesaných polí na další stupeň), stavění, kácení,
  polní práce, řemeslo a otesávání 0–10 (4 + 2 × stupeň úkolů). Každý stupeň zrychlí práci o 5 %,
  počáteční stupně podle profese. Zlepšení po pěti stupních se zapíše do deníku.
- **Stupně prací:** 0 vypnuto, 1 hlavní, 2 běžná, 3 když není co jiného. Klepnutím se přepínají v panelu
  trpaslíka i v tabulce „⚒️ práce“ celého klanu. Vypnutá práce se hned pustí.
- **🎯 Vyhrazené pracoviště:** trpaslík přiřazený k typu dílny dělá jen tam (ostatní práce vypnuté, po
  zrušení se vrátí). K dílně s vyhrazeným pracovníkem nesmí nikdo jiný. Jiná profese než dílny je jinak
  stupeň 3. Zaskočení řemeslníka po 100 tazích čekání (ZASKOK ze Srdce hory) převzato není: stupeň 3
  stačí, a zaskočení by záviselo na okamžiku přestavby jednotek práce (pozor na determinismus po načtení).
- **Nouze hlad:** jídla méně než 3 dny spotřeby (vypne se nad 6 dnů, hystereze) → kuchyně a donáška do ní
  mají přednost a kuchyni obslouží kdokoli. Chybí-li i suroviny nebo kuchyně, má přednost sklizeň.
  Hlášení jde do deníku a do štítku mapy (🚨 hlad). Nouze „strop“ a „voda“ přijdou s etapou 7.
- **Testy:** `node _test/sine_sim.js` 91/91: horníci si vezmou měděné krumpáče, výměna za železný, žula
  24 vs. 68 tahů, měděný se zlomí po 40 použitích, řetězec milíř → tavírna → kovárna → železný krumpáč,
  dva tesaři na jedné dílně naráz, vyhrazené pracoviště (stoly jen farmář) a návrat stupňů, nouze hlad
  zapne a kuchyně ji ukončí. `python3 _test/sine_snimek.py` 31/31.

### Etapa 6 (5. 10. 2026)

Nové soubory: `obsah/sine/obdobi.js` a `udalosti.js` (převzato ze Srdce hory, místa podle mapy).

- **Období:** 4 × 12 dní. Pole roste podle období (léto 1,3×, podzim 0,7×, zima 0). Na začátku zimy mráz
  spálí úrodu na polích. Pařezy v zimě nedorůstají, jí se 1,2× víc, venku v rokli se mrzne (−3).
  **Potok v zimě zamrzne a chodí se po ledu, i přes soutěsku pod mostem.** Pití z ledu −9.
  Kreslení: na podzim zrezavělá tráva, v zimě sníh v rokli i na masivu, led s prasklinami, zasněžené jedle.
  Změna období zneplatní kresbu povrchu. Přepnutí platí i po skoku v čase nebo po načtení
  (`sv.obdobi` se srovná s aktuálním obdobím).
- **Sláva:** objevy, hloubka (nejhlubší patro × 20 m), vytesaná pole, dílny, sochy, cennosti ve skladech
  a nově +1 za každou nádhernou místnost (kvalita ≥ 12). Milníky 120/200/250/330/500/650 jsou převzaté
  (čestná stráž přijde jako migranti se zbraní, jejich účinek v boji až v etapě 8). Sláva je v liště ⭐
  s dalším milníkem v popisku.
- **Karavana a tržiště:** přijede 8. den jara a 6. den podzimu po cestě roklí z jižního okraje (tři vozy
  jedou po cestě, příjezd i odjezd ~220 tahů), zastaví na tržišti (bez něj u Brány) a zůstane 2 dny.
  Nabídka a ceny jsou převzaté (výkup podle slávy, hromadný výkup od 10 kusů). Nová stavba ⛺ stánek
  (3 dřeva + plátno, jen venku v rokli) – každý (nejvýš 4) přidá jeden druh zboží a +5 % výkupu.
  Prodané zboží zmizí ze skladu hned (spotřeba v účetnictví), koupené se složí na tržišti a odnese do skladu.
  Obchodní okno 🐫 má tlačítka +/− (Shift po 5) a bilanci.
- **Migranti:** na začátku jara, léta a podzimu podle slávy (1 + sláva/60, nejvýš 4), jen do volných
  postelí v ložnicích + 1. Chybějící profese mají přednost. Přicházejí z jižního konce rokle a mají
  přátele. Bez místa přijdou hosté s darem.
- **Události:** poutník (a návrat: dar nebo goblinní zvěd), nemoc (leží v posteli), spor, krystalová dutina
  (skutečné riziko závalu), pivní slavnost, dar ze Železných hor, zbloudilý, hosté, migranti (s výběrem
  osob). Okno události hru pozastaví a po volbě vrátí rychlost. Hlas hlubin přijde s příběhem v etapě 9.
- **Záchvaty a odchody:** zlost ≥ 1200 → záchvat (400 tahů nepracuje a toulá se), druhý v témže období
  znamená odchod z hory se smutkem klanu. Přátelství (zakladatelé po dvojicích, příchozí mezi sebou
  a s jedním starousedlíkem): smrt bolí celý klan (souhrnně −12 … −24) a přítele víc (−16 … −28).
- **Tábořiště:** nová zóna v rokli. Kdo nemá postel, spí pod stanem (−2 místo −6 na zemi, stan je vidět).
- **Oprava z fuzzu:** krok na pole, které mezitím zastavěla stavba, se zruší (trpaslík zůstane a cestu přehodnotí).
- **Past:** třída záznamu deníku `udalost` kolidovala se stylem okna události (závoj přes celou stránku) –
  okno se proto styluje přes `#udalost`.
- **Testy:** `node _test/sine_sim.js` 118/118 (zima, led a soutěska, mráz na poli, jaro; karavana 8. den,
  stánek, obchod, odmítnutí nevýhodného obchodu, odjezd; migranti z jižního okraje; všech 19 kombinací
  událostí a voleb; návrat poutníka; záchvat, odchod a smutek; tábořiště; uložení s čekající událostí
  a karavanou; fuzz s náhodnými volbami a obchody). `python3 _test/sine_snimek.py` 34/34 (okno
  události, obchodní okno, zima).

### Etapa 7 (5. 10. 2026)

Nový soubor: `obsah/sine/priroda.js`.

- **Stabilita:** každé pole, které vytesali trpaslíci (`hra.vykopane`, ukládá se), musí mít oporu do R polí
  (Čebyševova vzdálenost, dvouprůchodový chamfer). Opora je skála, zeď, suť a sloup. R podle horniny:
  hlína a jíl 2, vápenec 3, čedič a hlubinný kámen 4, žula a obsidián 5. Přírodní jeskyně drží vždy.
  Nepodepřená pole se seskupí (8-sousedství), praskají s hlášením a odpočtem 600 tahů a pak se zasypou
  sutí: stavby zaniknou (materiál propadne), plány se zruší, zasypaní ztratí 35 zdraví a vysypou se
  vedle, schodiště se přeruší. Přepočet probíhá líně po změně terénu (každých 50 tahů). Na mapě jsou
  praskliny a odpočet, při tažení nástrojem Kopat náhled nepodepřených polí a „⚠️ potřebuje sloupy /
  ✅ strop vydrží“. **Sloup do pole označeného ke kopání se vytesá rovnou ze skály** (bez kamene).
  Nouze „strop“ dá stavbě sloupů přednost.
- **Kapaliny:** kap 0–7 (≥ 4 hluboká), automat jen na aktivních polích (`hra.kapAktivni`, ukládá se
  seřazené; za běhu množina). Těleso (souvislá kapalina, 4-sousedství) nejdřív padá dírou, žebříkem,
  šachtou i schodištěm o patro níž, jinak vyrovnává hladinu: jednotka z nejvyššího pole na nejnižší
  pole tělesa nebo okraje, dokud je rozdíl ≥ 2. Do odtoku (díra) teče i při rozdílu 1, takže voda vyteče
  celá. Množství vody se zachovává (test). Přírodní jezero drží ve své pánvi (na suchý břeh jeskyně
  nevteče, do vytesaných chodeb ano). Dveře a zdi nepustí. Voda na povrchu (potok) je nehybná,
  jinak by se rozlila po rovné rokli. Voda uhasí louč.
- **Magma:** teče pomaleji (krok 12 tahů místo 4), pálí věci, stavby (lávka, žebřík, šachta zmizí)
  a trpaslíky. Setkání s vodou = obsidián (hlášení „Syčí pára“).
- **Prameny:** při tesání vápence ve 2.–3. patře s pravděpodobností 1,5 % vytryskne pramen
  (16 jednotek, jedna za 40 tahů).
- **Utonutí:** trpaslík v hluboké vodě ztrácí 0,4 zdraví za 2 tahy a plave ke břehu. Kdo stojí v hluboké
  vodě, smí z ní vyjít.
- **Pumpa** (3 dřeva) odčerpává vodu do 3 polí, práce „pumpovat“ (nošení), v nouzi „voda“ přednostně.
  **Studna** (4 kameny + dřevo) stojí u vody nebo nad vodou v patře pod. Čistá voda −2, nezamrzá,
  a má přednost, není-li o 80 tahů dál než jiná voda.
- **Testy:** `node _test/sine_sim.js` 134/134: síň 7 × 7 v hlíně praská a za 600 tahů se zřítí (suť,
  zranění, věci vedle, pak strop drží), sloup uprostřed síň udrží, náhled kopání, sloup ze skály,
  rozlití v místnosti a propadnutí dírou do 2. patra se zachováním množství vody, uložení uprostřed toku,
  pramen 16 jednotek, pumpa, obsidián, magma pálí dřevo a trpaslíka, utonutí a plavání, studna.
  Fuzz digguje náhodné obdélníky, takže v něm vznikají i závaly. `python3 _test/sine_snimek.py` 37/37
  (praskání, náhled kopání, voda, zával).
- **Pasti v testech:** pomocná místnost „vytesaná hned“ se teď počítá jako přírodní (jinak by se testům
  jiných etap zřítila). Invariant „stojí na průchozím poli“ musí povolit plavání v hluboké vodě.

### Etapa 8 (5. 10. 2026)

Nový soubor: `obsah/sine/hrozby.js` (pravidla a čísla převzatá ze Srdce hory, pohyb a střelba shora).

- **Tvorové:** netopýr (přelétá díry a vodu), obří pavouk (přeleze díry, lup hedvábí), goblin
  (vyrazí dveře na 8 ran, krade), goblinní lukostřelec (střílí do 5 polí, potřebuje volný výhled),
  horský troll (130 ♥, dveře i spuštěnou mříž vyrazí na 3 rány, **nevejde se do chodby široké 1 pole**)
  a Spáč (pro etapu 9). Spí v jeskyních. Prokopnutí do jeskyně je probudí (netopýři v krápníkových,
  pavouci v jeskyních a hlubinách, goblini v tunelu).
- **Boj:** úder do sousedního pole jednou za 10 tahů. Síla = zbraň (válečná sekera 14, sekera 8,
  krumpáč 6, měď ×0,8) × (1 + 0,1 × dovednost boje) × náhoda. Zbroj ubere 40 % zranění (měděná 25 %).
  Civilista beze zbraně před trollem a raněný strážce (pod 35 ♥) ustoupí. Lup z padlých 60 %.
  Šípy se kreslí v letu.
- **Nájezdy:** první 36. den (hrstka vyhladovělých goblinů), pak každých 18–26 dní, s rostoucím neklidem
  hory dřív. Den předem hlídka varuje. Síla roste s velikostí klanu, slávou, hloubkou a pořadím nájezdu;
  trollové až proti obrněným strážcům. Od 6. nájezdu jeden ze čtyř typů: útok, loupež (jdou po
  cennostech ve skladech a utečou s nimi), obléhání (2 dny čekají v rokli a pak zaútočí) a podkop
  (prokopou se z hlubin k nejhlubším trpaslíkům). Přicházejí po cestě roklí od jihu přes brod či
  most (v zimě po ledu), nebo odkrytým goblinním tunelem v 8. patře. Když se ke klanu nedostanou, vzdají to.
- **Strážci:** stupeň práce „⚔️ hlídat“ (profese strážce ho má zapnutý). Strážce si ze skladu vezme
  zbraň (válečnou sekeru nebo kuši) a zbroj. Známé nepřátele loví (cestu plánuje po kusech, cíl
  se hýbe). Bez nepřátel cvičí před zbrojnicí (dovednost boje 0–10). S kuší střílí do 6 polí,
  ze strážní věže do 8 polí, a na věži ho netvoři nezraní.
- **Obrana (skupina staveb Obrana):** dveře, padací mříž (spouští se a vytahuje ve výběru; spuštěná
  nepustí nikoho, troll ji vyrazí), past (25 ♥, napíná se 30 s), strážní věž, zbrojnice a oprava
  rozpadlého mostu přes soutěsku.
- **Poplach** (🔔 na liště): civilisté utečou do nejbližší uzavřené místnosti s dveřmi a čekají tam.
  Pustí je jen kritická potřeba. Když úkryt není, pracují dál.
- **Rozhraní:** v panelu Klan je přehled nepřátel (klik = skok na tvora) a předpověď nájezdu. Panel
  trpaslíka ukazuje zbraň a zbroj. Tvora lze vybrat a jeho panel ukazuje zdraví a co dělá.
- **Oprava:** změny terénu a staveb se promítnou do mapy i za pauzy. Dřív se vyzvedávaly jen po tazích
  simulace, takže spuštění mříže nebo zbourání za pauzy nebylo vidět.
- **Testy:** `node _test/sine_sim.js` 153/153 bez fuzzu, s fuzzem 3 × 30 000 tahů v pořádku. Fuzz
  stavěl mříže, pasti, věže a zbrojnice, přepínal hlídání a poplach a posílal nájezdy. Scénáře:
  jeskyně probudí tvory; pohyb netopýra a pavouka přes díru; strážce zabije goblina; zbroj snižuje
  zranění; varování a první nájezd roklí; předpověď; mříž proti goblinovi; troll v úzké chodbě;
  goblin vyrazí dveře; výhled; lukostřelec na 5 polí; kuše z věže; poplach do místnosti s dveřmi; past;
  uložení uprostřed boje. Invariant počítá i věci, které nese tvor, a zbraně a zbroj v rukou.
  `python3 _test/sine_snimek.py` 41/41 (snímky `sine_boj.png` a `sine_boj2.png`).
- **Pasti:** tvora zazděného stavbou nebo zasypaného je třeba vysypat vedle. Fuzz musí přestat
  zadávat pokyny, když klan vymře.

### Etapa 9 (5. 10. 2026)

Nový soubor: `obsah/sine/pribeh.js` (podle `trpaslici/pribeh.js`, přizpůsobený patrům).

- **Runové desky:** práce „📜 číst“ (stupeň řemesla, s předností) u desky v objevené strážnici (3.–5. patro)
  nebo v Síni předků (6. patro). První deska odemkne runovou kovárnu, druhá artefakty. Objevení Srdce
  přidá poslední úlomek. Za každou desku je sláva +10.
- **Vodítko 🧭** popisuje patro a směr od schodiště předků („Druhá deska leží v Síni předků v 6. patře,
  asi 40 polí na jih od schodiště předků.“). Objeví se v deníku po každé desce i Klíči a trvale
  v panelu Příběh (kliknutím skočí na místo). S Klíčem ukazuje k Srdci a Výhni.
- **Poklad předků** v Síni předků: práce „vynést“ (nošení) přinese 3 zlata, 3 drahokamy, stříbrný prut
  a šperk, sláva +15.
- **Runová kovárna** (2 zlaté pruty, dokud není deska, nejde stavět). Artefakty: 🔨 kladivo
  (2 hvězdné pruty + železný), 🏮 lampa (+ broušený drahokam), 📯 roh (+ pohár) a 🗝️ Klíč
  (3 hvězdné pruty + šperk, až po 2 ze 3 artefaktů). Každý artefakt jde ukovat jen jednou, za každý
  je sláva +25. Hvězdný prut se taví z hvězdné rudy (tavírna s uhlím, magmatická výheň bez něj).
  Kladivo zrychlí stavbu a výrobu 1,3×, lampa dá podzemí světlo aspoň 0,4, roh zvedne útok 1,3×.
  Panel Příběh ukazuje kusovník Klíče.
- **Spáč:** v 7. patře hora duní (varování nejvýš jednou za 3 dny). Tesání v 8. patře bez Klíče
  (UI se nejdřív zeptá) nebo objevení Srdce bez Klíče Spáče probudí předčasně: neklid hory +0,3.
  Spáč má 520 ♥ a úder 22 a je široký (chodbou širokou 1 pole neprojde). Odolnost = útok ozbrojených
  strážců / 40; shora na něj dosáhne až 8 strážců, proto je přísnější než v Srdci hory. Strážci se
  nejdřív shromáždí 3–6 polí od něj a útočí aspoň ve třech.
- **Finále:** trpaslík vezme Klíč, donese ho k Výhni a zažíhá 600 tahů. Při zažíhání se probudí Spáč
  a z puklin Srdce vylezou dvě vlny pavouků (1 + ozbrojení/3, nejvýš 4); jdou po tom, kdo zažíhá.
  Nájezdy během zažíhání počkají. Když trpaslíka vyruší, Klíč položí a další pokračuje. Na mapě je
  plamen s kruhem postupu. Vítězství dá slávu +60.
- **Konec hry:** okno s epilogem a statistikami. Po vítězství lze „Hrát dál ve volném režimu“, kde jde
  Spáče vyzvat jako bosse (sláva +40). Prohra nastane, když nežije žádný trpaslík. Na liště je volba
  **Hra: příběh / volná** (volná je bez příběhu; desky a poklady zůstávají).
- **Ostatní:** chyběla věc goblinní čepel (kořist goblinů). Přidal jsem ji: dá se prodat nebo v kovárně
  přetavit 2 čepele + uhlí na železný prut. Klíč se neprodává a goblini ho nekradou.
- **Testy:** `node _test/sine_sim.js` 182/182 a fuzz 3 × 30 000 tahů. Nové scénáře: zamčená runová kovárna;
  vodítko s patrem; přečtení desky ve strážnici; vodítko na Síň předků; druhá deska a poklad;
  kladivo, zákaz Klíče po jednom artefaktu, Klíč po dvou; varování a předčasné probuzení; finále
  (vítězství, 2 vlny, epilog, hrát dál, uložení uprostřed zažíhání); prohra; volný režim a výzva Spáče.
  `python3 _test/sine_snimek.py` 45/45 (snímky `sine_finale.png`, `sine_konec.png`).
- **Vyvážení Spáče:** s dělitelem 25 zabil všech 7 trpaslíků, se 45 padl bez ztrát. Při 40 vyhraje pět
  obrněných strážců s dovedností 6 s 0–2 padlými (4 seedy). Celkové vyvážení doladí bot v etapě 11.

### Etapa 10 (5. 10. 2026)

Nové soubory: `obsah/sine/zvuk.js`, `castice.js` a `ilustrace.js`. Grafika zůstává procedurální
(výchozí rozhodnutí A). Sprity postav, tvorů a staveb vznikaly průběžně v etapách 2–9.

- **Zvuk** (Web Audio, vše syntetizované, základ ze Srdce hory, 26 zvuků): údery krumpáče podle
  tvrdosti horniny (ruda a runa zazvoní), dokopání, sekera a pád stromu, kladivo, dokončená stavba,
  kovadlina v kovárnách, dílny, praskání stropu, zával, kapky, syčení magmatu, roh nájezdu, boj
  (se zbraní cinkne), šíp, zásah, vyrážení dveří, netopýři, řev Spáče, smrt, objev, zvonek karavany,
  varování, tón runové desky a fanfára. Logika zvuky jen zařadí do fronty (`prace.zvuk`, neukládá se)
  a rozhraní je každý snímek přehraje.
  - **Ozvěna podle velikosti prostoru:** zpožďovací smyčka, delší a hlasitější ve velké síni či jeskyni
    (log₂ počtu polí). Malá světnice skoro nezní, venku ozvěna není.
  - **Jiná patra:** zvuk z patra nad nebo pod pohledem je ztlumený a zastřený, vzdálenější patra
    neslyšet. Zvuk mimo záběr se neozve. Panoráma podle polohy v obraze.
  - **Prostředí:** vítr v rokli (v zimě silnější), šum potoka podle podílu vody v záběru (v zimě
    zamrzne), hlasy a cinkání tržiště, když je karavana a pohled u tržiště. V podzemí kapky s ozvěnou,
    když je v záběru voda.
  - **Hudba:** dron a pentatonika, s hloubkou patra níž a tmavěji. Na liště jsou tlačítka 🔊 a 🎵
    (nastavení se pamatuje). Zvuk se probudí prvním klepnutím (pravidla prohlížečů).
- **Částice** (jen v rozhraní, max. 900): prach a odštěpky při tesání (jiskry z rudy), oblak při
  dokopání, třísky dřeva, jiskry kovadliny a boje, krev při zásahu, prach závalu, kapky, pára a uhlíky
  při syčení magmatu. Pracující pece kouří a jiskří (runová kovárna fialově). Výheň při zažíhání
  sílí jiskrami a po zažehnutí dál žhne. Ve 2. vrstvě (nad tmou) svítí jiskry a uhlíky; prach a kouř
  jsou ve tmě nevidět. V zimě na povrchu padá sníh.
- **Ilustrace:** procedurálně malované výjevy v okně události a konce hry (hory ve vrstvách, Brána
  s teplým světlem, siluety): hora, karavana, poutník, nájezd s pochodněmi, migranti s lucernou,
  nemoc, slavnost s lampiony, krystalová dutina, Spáč, vítězství (žár v Bráně) a prohra.
- **Rozvržení:** poplach je jen ikona 🔔 (s popiskem), aby se lišta s 🔊 🎵 vešla na jeden řádek.
  Okno konce má statistiky ve dvou sloupcích a posuvník, když se nevejde.
- **Testy:** `python3 _test/sine_snimek.py` 49/49. Všech 26 zvuků vykreslených offline je slyšet
  a nepřebudí; ozvěna síně prodlouží dozvuk; zvukové události vytvoří částice; všech 11 ilustrací má
  kresbu. Snímky `sine_udalost.png` a `sine_konec.png`.

### Etapa 11 (5. 10. 2026)

Nové soubory: `_test/sine_bot.js` a `_test/sw_sine_check.js`. Hra je v katalogu `apps.js` a v offline sadě `sw.js`.

- **Bot „rozumný správce“** (`node _test/sine_bot.js [her] [let] [--diag]`, `VEL=`, `REZIM=volny`, `LADIT=1`)
  hraje jen z toho, co vidí hráč (známá pole, vodítko 🧭, panely):
  - Síně v 1. patře u podesty (dílny 15 × 4, ložnice a jídelna 10 × 3, houbárna, sklad) napojené
    chodbou s dveřmi. Opory hlídá přes `priroda.nepodeprena` a sloupy tesá ze skály.
  - Dílny podle potřeby, zakázky (jídlo a pivo podle velikosti klanu, uhlí, pruty, zbraně a zbroj pro
    strážce, šperk, pohár, broušený drahokam, artefakty, Klíč), pole ječmene v rokli, kácení.
  - Schodiště do hloubky (nejvýš 7. patro; do 8. jen s Klíčem), průzkumné štoly, těžba rud, které klan
    vidí a potřebuje. Pumpy u vody; zatopenou podestu opustí a schodiště zkusí jinde.
  - Strážci: třetina klanu. Poplach při viděném nájezdu. Obchod s karavanou (přebytky za jídlo, pivo,
    dřevo a železo). Do Srdce jde až s Klíčem a aspoň 5 strážci se zbraní i zbrojí.
  - Měří: konec, dny, padlé podle tvora, patro, nájezdy, desky, artefakty, Spáče, obchody, velikost
    uložené hry, µs na tah (medián, p99).
- **Výsledek (8 her, střední hora, příběh, nejvýš 6 let): 6 vítězství, 0 proher,** 2 hry skončily na limitu
  se živým Spáčem a přeživším klanem. Medián 191 dní do konce, 12 padlých, nejvíc 33 trpaslíků,
  sláva ~417, uložená hra ~160 kB. Výhry za 143–258 dní, tedy 3.–6. období 2. roku. Malá hora: 1 z 2 her
  vítězství. Volný režim: 2 hry po 3 letech bez chyb.
- **Chyby hry, které bot našel:**
  - **Nosič se zacyklil:** `volnaMista` počítala jako volné místo ve skladu i ložnice, pole a houbárny,
    takže vznikala práce „odnést“, kterou nešlo dokončit. Nosič ji bral znovu a znovu (stála přímo pod
    ním, takže vždy vyhrála) a klan přestal tesat. Oprava: počítají se jen zóny sklad. Věc, pro kterou
    se nenajde dosažitelný sklad, se den nenabízí. Test „nošení bez místa ve skladu“.
  - **Hvězdná ruda:** krátké žíly v 7. patře se naslepo skoro nedaly najít. Po druhé desce proto
    vodítko 🧭 ukazuje nejbližší hvězdnou žílu (patro a směr), dokud klan nemá ocel na Klíč.
  - **Finále posílalo civilisty na smrt:** když zažíhající padl, Klíč zvedl další a šel ke Spáčovi.
    Nyní, dokud Spáč žije, vyrazí nový zažíhající jen pod ochranou aspoň 3 zdravých ozbrojených
    strážců u Spáče.
  - **Strážci se nesešli:** shromaždiště u Spáče se přidávalo jen bez jiných cílů a čekající strážce
    odešel za prací. Shromaždiště je teď cílem vždy a strážce na něm čeká.
  - **Spáč:** zmírněn na 480 ♥ a odolnost = útok / 45 (jako v Srdci hory). Se 40 a 520 ♥ končilo
    finále pravidelně smrtí klanu.
- **Výkon:** profil ukázal, že ~47 % času spotřebuje přestavování jednotek práce (smyčky přes celou mapu
  všech pater při každé změně) a ~40 % hledání práce a skladu, které hledalo 900 tahů za prvním nálezem.
  Opravy beze změny chování (fuzz dává totožná čísla, uložení a načtení pokračují stejně):
  - mezipaměť seřazených seznamů označených polí (`prace.znacky`, verze `oznZmena`) a polí zón
    (`stavby.zonaBunky`, verze `zonZmena`);
  - přesné ořezání Dijkstry: `cesty.hledej(…, limit, posun)` skončí, jakmile žádný cíl nemůže vyjít
    levněji (posun = 900 − největší sleva za přednost a záchranu; u skladu 300, není-li sklad s předností).
  Výsledek: p99 tahu z 3,5–5,5 ms na 1,6–2,8 ms. Nejhorší hra má medián 196 místo 535 µs.
- **„Co dál?“** (`pribeh.coDal`, v panelu Příběh): 17 kroků příběhu od první síně po zažehnutí Výhně,
  s vodítkem 🧭 a kusovníkem Klíče u příslušných kroků. Volný režim má 9 základních kroků, 6 cílů
  a pak nekonečný cíl slávy.
- **Nápověda ❔** (lišta): ovládání a klávesy, hora (patra, opory podle horniny, voda, místnosti), klan
  (potřeby, karavana, nájezdy, poplach) a příběh. Při první hře se otevře sama.
- **Offline:** `sw.js` má seznam `SINE` (stránka a 21 skriptů), stáhne se na pozadí při prvním otevření
  hry (stránka si o to řekne zprávou „dotahni“), cache `webapp-v284`. Kontrola `node _test/sw_sine_check.js`
  (položky existují, každý soubor hry je v seznamu, vše, co stránka načítá, je v sadě nebo v jádru).
  Seznam Srdce hory zůstal netknutý (`sw_trpaslici_check.js` prochází).
- **Katalog:** `apps.js`, položka „🏰 Síně pod horou“ hned za Srdcem hory.
- **Testy na konci:** `node _test/sine_test.js` (300 hor) OK, `node _test/sine_sim.js 3 30000` 184/184,
  `python3 _test/sine_snimek.py` 50/50 (nově „Co dál?“ a nápověda, snímek `sine_napoveda.png`), obě
  kontroly sw. Nic se nenahrálo (upload a push dělá uživatel).
- **Zbývá na příště:** 2 z 8 her bota skončily patem se Spáčem (strážci nedosáhnou na skupinu 3 u něj, např.
  když vede do Srdce jen úzká chodba); na malé hoře bot někdy finále nezačne. Jídla bývá málo.


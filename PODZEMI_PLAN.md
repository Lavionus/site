# Plán: 🗡️ Nekonečné podzemí (od 25. 9. 2026)

Procedurální dungeon crawler z první osoby v duchu Dungeon Mastera, hratelný po večerech.
Stav se odškrtává průběžně; „pokračuj" = vzít první neodškrtnutou etapu a dotáhnout ji celou
(implementace → testy v node → headless ověření → záznam výsledků níže).

## Rozhodnutí (schválena 25. 9. 2026)

- **Soubory:** `obsah/podzemi.html` (stránka, vykreslování, ovládání) + `obsah/podzemi_logika.js`
  (čistá logika bez DOM – generátor, pravidla, loot; exportuje `PodzemiLogika`, v node přes `module.exports`).
  Hlavička jako ostatní hry (`common.css`, `theme.js`, `podpis.js`, `rekord.js`).
- **Tahový čas** – krok, otočka, útok = tah; potvory jednají po hráči.
- **Zvuk:** Web Audio, vše syntetizované v `obsah/podzemi_zvuk.js` (bez nahrávek), výchozí **zapnuto**,
  vypínač `webapp_hra_podzemi_zvuk`. Každý nový herní děj má dostat svůj zvuk.
- **Průběžné ukládání** rozehrané výpravy do localStorage (`webapp_hra_podzemi_vyprava`) po každém tahu;
  při smrti se smaže (permadeath, žádné vracení).
- **Zobrazení: pixel art** (přání uživatele 25. 9. 2026) – raycaster do plátna 256×192, zvětšení
  `image-rendering: pixelated`; textury 32×32 generované kódem z omezené palety biomu, světlo po 10 stupních
  s Bayerovým ditheringem, svítící pixely (plamen) se nestíní. Potvory a předměty budou pixelové sprity
  ořezávané podle `zbuf` (hloubka sloupců už se plní). Žádné cizí obrázky. Minimapa i velká mapa taky v pixelech.
- **Seedovaná náhoda** (mulberry32): seed výpravy + číslo patra → reprodukovatelné patro.
- **Ovládání:** klávesnice (šipky / WASD, Q/E otočení, mezerník útok), tlačítka na obrazovce, dotyk; od 320 px.
- **Rekord:** `rekord.js`, klíč `webapp_hra_podzemi_patro`; síň slávy `webapp_hra_podzemi_sin`.

## Etapy

- [x] **1. Generátor pater** (25. 9. 2026)
  - mřížka 20×20 (s hloubkou roste až na 32×32), 5–9 místností, propojení minimální kostrou
    + 1–3 smyčky navíc, dveře na přechodech místnost/chodba
  - schody dolů co nejdál od startu (BFS), start na schodech nahoru
  - test v node na 1000 seedech: souvislost, dosažitelnost schodů, nepřekrývání místností,
    podíl místností na ploše (ne čistý labyrint), determinismus seedu
  - ladicí pohled shora (ASCII/canvas)
- [x] **2. Pohled z první osoby + pohyb** (25. 9. 2026) → první „procházecí" verze
  - renderer stěn, dveří, podlahy, stropu, šero podle vzdálenosti, pochodeň
  - vpřed / vzad / úkroky / otočení, krátká animace kroku
  - automapa (malá v rohu, velká po rozkliknutí), jen prozkoumaná pole
  - schody → další patro, číslo patra v liště, průběžné ukládání pozice
- [x] **3. Postava, potvory, souboj** → MVP (25. 9. 2026)
  - ❤️ zdraví, ⚔️ síla, 🛡️ obrana, ✨ magie, úrovně ze zkušeností
  - bestiář 1–10 (krysy, hadi, pavouci, goblini, kostlivci); AI: bloudění, pronásledování (BFS), útěk
  - útok klikem na zbraň na pole před sebou; rychlost zbraně = počet tahů (sekera 2)
  - dýka 2–5, meč 4–9, sekera 6–13; plovoucí čísla, záblesk, deník událostí
  - smrt: epitaf se statistikami a generovanou příčinou smrti; rekord nejhlubšího patra
- [x] **4. Loot a inventář** (25. 9. 2026)
  - 16 políček + sloty zbraň | štít | helma | brnění | boty | amulet | 2× prsten
  - úroveň předmětu podle hloubky, vzácnosti (běžný → legendární, barvy), řady zbraní
    (Rezavý meč → Železný → Trpasličí čepel → Ohnivý meč → Čepel hlubin), náhodné vlastnosti
  - porovnání s nasazeným, zahodit / sníst / vypít; truhly, zlato
  - 🍖 hlad (ubývá s kroky, hlady se ztrácí zdraví), lektvary (včetně neznámých)
  - luk: střelba přes více polí v přímce, šípy
- [x] **5. Místnosti s účelem, pasti, tajemství** (25. 9. 2026)
  - hrobka, skladiště, knihovna, kobka, svatyně, doupě příšery, pokladnice (klíč jinde v patře)
  - tajné dveře (prasklina ve zdi, otevření ohmatáním), počítané tajné místnosti
  - pasti: jáma (pád o patro), šipky, tlaková deska
- [x] **6. Prostředí, bossové, magie** (25. 9. 2026)
  - 1–10 kamenné kobky · 11–20 zatopené jeskyně 🌊 · 21–30 trpasličí doly ⛏️ · 31–40 krypta 💀
    · 41–50 lávové podzemí 🌋 · 51+ podivno; každé s paletou, texturou a bestiářem
  - boss každé 10. patro v aréně, schody se otevřou po jeho porážce
  - svitky a hůlky (ohnivá koule, léčení, teleport, odhalení mapy), síla podle ✨
- [x] **7. Dotažení** (25. 9. 2026)
  - síň slávy (posledních 10 výprav), celkové statistiky
  - další zvuky (souboje, potvory, kořist) – základ je hotový už od etapy 2, viz záznamy
  - vyvážení simulací: bot v node odehraje tisíce výprav, cíl průměr smrti 8.–15. patro
  - `apps.js` (skupina `hry`), zvednout `webapp-vN` v `sw.js`

## Ověření po každé etapě

1. Logika v node (`_test/podzemi_test.js`): generátor na mnoha seedech, později simulace bota.
2. Headless Chromium úsporně (jeden prohlížeč s limity, postupně): obě témata, iframe 360 px, **DPI 2**.
3. Snímek pohledu a mapy jako důkaz běhu.
4. `upload.sh` nespouštět – nahrává uživatel ručně.

## Záznamy z etap

(doplňuje se po dokončení každé etapy – naměřená čísla, vědomé kompromisy)

### Etapy 1 + 2 (25. 9. 2026)

- `node _test/podzemi_test.js 1000` – 5000 pater (hloubky 1, 6, 15, 30, 60): vše souvislé, schody
  dosažitelné, dveře vždy se zárubní, žádná „tlustá" chodba 2×2, determinismus seedu. Průměr 6 místností,
  místnosti tvoří 68 % průchozí plochy, cesta ke schodům průměrně 31 kroků (min. 9), 12,9 dveří/patro (60 % zavřených).
  Procházka 40 × 3000 náhodných akcí: hráč nikdy ve zdi, serializace ↔ obnova beze změny.
- `python3 _test/podzemi_snimek.py` (chromedriver, DPI 2, `?seed=42`) – 12/12: plátno odpovídá DPI, minimapa
  čtvercová s hráčem uprostřed, dveře se prvním krokem otevřou, sestup do 2. patra, po reloadu pokračuje
  na stejném místě, rekord `webapp_hra_podzemi_patro`, náraz do zdi nestojí tah, iframe 360 px bez posuvu, konzole bez chyb.
- Test našel: chodby slité do bloků 2×2 (Dijkstra nehlídal souběh s existující chodbou ani výchozí pole) – řeší zákaz
  v hledání cesty + pojistka, která takové patro zahodí; minimapa kreslená do plátna 300×150 (hlídala se jen šířka).
- Ladění: `?seed=N` = pevná výprava, `?ladeni` = celá mapa odkrytá.
- Vědomé kompromisy: malovací algoritmus řadí pole podle vzdálenosti (u mřížky stačí); schody nahoru jsou jen dekorace
  (roguelike – cesta zpět není); na patře 20×20 generátor opakuje v průměru ~3,5× (místnosti se nevejdou), trvá to ms.
- Hra je už v katalogu (sekce Akční & arkády), `sw.js` → v128.
- Dotykové ovládání (na přání uživatele): virtuální kříž 3×2 přímo v pohledu, v dolním rohu, přepínač
  **vpravo → vlevo → skryté** (`webapp_hra_podzemi_ovladani`). Podržením se opakuje pohyb, otočky ne.
  Nahradil mřížku tlačítek pod pohledem i ťukání do pohledu. Zprávy se přesunuly nahoru vlevo, aby se s křížem nepřekrývaly.
  Headless test 19/19 (poloha vpravo/vlevo, volba přežije reload, skrytí, stisk = 1 tah, po puštění se pohyb zastaví).
- **Přechod na pixel art:** vektorové mnohoúhelníky nahradil raycaster (DDA po mřížce, podlaha/strop po řádcích).
  Dveře jsou průhledná vrstva v rovině středu pole, kreslí se od nejvzdálenějších, křídlo vyjíždí do stropu.
  Textury: 2 varianty cihel, dlažba, strop s trámy, dveře s kováním, šachta schodů se zeleným svitem, zával,
  díra ve stropě, louč ve 3 snímcích. Palety pro všech 6 biomů jsou připravené. Test 20/20 (nově: plátno 256×192
  s ostrým zvětšením a poměrem 4:3, dveře před otevřením opravdu zavřené – test k nim dřív došel skrz ně).
- **Světlo z loučí** (přání uživatele): zdrojem světla jsou louče na zdech (8 % stěn), ne hráč. Intenzita slábne
  s 3D vzdáleností od plamene (výška −0,22), takže nejsvětleji je na zdi pod loučí a na podlaze u ní. Světlo nejde
  skrz zdi ani zavřené dveře: pro každé pole se předpočítá seznam loučí, které na něj vidí (`vidi` po mřížce, dosah 6),
  po otevření dveří se přepočítá. Každá louč plápolá zvlášť. Hráč má jen slabé světlo bez mihotání (0,55),
  aby tmavé chodby nebyly úplně černé. Test 21/21 (nově: kolem louče je obraz o 25 % světlejší než na okrajích).
- **Zvuky (Web Audio)** na přání uživatele: kroky (dopad + drť, každý jiný), šoupnutí při otočce, náraz do zdi,
  skřípot dveří (trhaný kov + hučení mechanismu + žuchnutí), sestup po schodech (kroky do ozvěny) a náhodné zvuky
  z hlubin každých 15–40 s z náhodné strany: šepot (šum přes formanty samohlásek po slabikách, sykavky), vzdálené
  prasknutí, pád s dopadem a sypajícím se kamením. Dozvuk kamenné chodby z generované impulsní odezvy, kompresor.
  Zvuk se odemkne prvním stiskem/dotykem (pravidla prohlížečů). Test vyrobí každý zvuk v OfflineAudioContext:
  špičky 0,19–0,56, žádné NaN ani přebuzení; 31/31. **Poslech ověřuje uživatel** – test hlídá jen úrovně.

### Etapa 3 (25. 9. 2026)

- **Logika** (`podzemi_logika.js`): hrdina s náhodným jménem (12 jmen, rod pro skloňování), ❤️ 30, ⚔️ 3, 🛡️ 1, ✨ 1,
  úrovně (práh `15·ú^1,5`, +5 zdraví, +1 síla, obrana každou 2., magie každou 3. úroveň), hojení 1 život / 7 tahů.
  Zbraně dýka 2–5, meč 4–9 (start), sekera 6–13 za 2 tahy (tabulka `ZBRANE`, najít půjdou v etapě 4).
  Bestiář: krysa 1–6, had 1–7, obří pavouk 2–9 (1,4 akce/tah), goblin 4–14 (otvírá dveře, prchá), kostlivec 6+
  (pomalý 0,65, tvrdý); síla roste s patrem nad `od`. Počet potvor `3 + 0,7·patro` (max 14), mimo startovní místnost.
  AI: spánek (probudí je hráč na 2 pole nebo hluk souboje), bloudění, pronásledování po BFS poli (dvě pole – s dveřmi
  a bez), útěk pod prahem zdraví, zahnaná do kouta se brání. Náhoda je ve stavu výpravy (`rng`) – výprava jde zopakovat.
  Otočka tah nestojí, pohyb/dveře/čekání 1 tah, útok podle rychlosti zbraně. Uložení verze 2 (verze 1 se načte bez potvor).
- **Stránka:** pixelové sprity potvor 16×16 (svítící oči), ořez podle `zbuf`, animace kroku, výpadu, bílého záblesku
  při zásahu a zhroucení při smrti; meč v ruce se při útoku máchne; plovoucí čísla (pixelové písmo), rudý záblesk
  při zranění, zlatý při nové úrovni; panel ❤️/zkušenosti/⚔️🛡️✨, deník posledních 5 událostí; tlačítka ⚔️ útok a ⏳
  počkat v pohledu (naproti kříži); klávesy mezerník/F = útok, Z/tečka = počkat; potvory na minimapě jen když je vidíš.
  Smrt: epitaf (jméno, patro, zabití, tajné místnosti, poklad, úroveň, tahy, příčina smrti ze šablon potvory),
  uložená výprava se smaže, rekord se zapíše.
- **Zvuky navíc:** máchnutí, zásah, zranění (úder + zachrčení), smrt potvory, nová úroveň (arpeggio), smrt (umíráček),
  hlasy potvor při prvním všimnutí (krysa pískot, had syčení, pavouk cvakání, goblin chrochtání, kostlivec chrastění)
  ve stereu podle polohy; dveře otevřené potvorou zní z jejich směru.
- **Testy:** `node _test/podzemi_boj.js 500` – invarianty (potvora nikdy ve zdi, v zavřených dveřích, na hráči ani
  na jiné potvoře), uložení uprostřed boje beze změny, útok zabije potvoru a přidá zkušenosti, potvora v cestě blokuje
  bez ztráty tahu, probuzený goblin dojde k čekajícímu hráči (40/40). **Bot** (jde ke schodům, bije sousedy, při
  < 50 % zdraví odpočívá): smrt v průměru v 7. patře (10 % do 5., 90 % do 9., max 12), úroveň 3; zabijáci kostlivec
  39 %, goblin 28 %, pavouk 27 %. Headless 49/49 (goblin je vidět, údery ubírají, deník, ukazatel zdraví, smrt →
  epitaf a smazané uložení, nová výprava; navigační část běží s `?bezpotvor`).
- Vědomé kompromisy: bez kořisti a lektvarů je hloubka ~7 cílená pro MVP – cíl 8.–15. se ladí s etapou 4 a 7;
  bot hraje hůř než člověk (neutíká do chodeb, nevyhýbá se skupinám).

### Etapa 4 (25. 9. 2026)

- **Předměty** (`ZAKLADY` v logice): meče Rezavý → Železný → Trpasličí čepel → Ohnivý meč (oheň +3) → Čepel hlubin,
  dýky (+přesnost), sekery (útok 2 tahy), luky (dostřel 4–7, spotřebují šíp), štíty, helmy, brnění, boty, amulet,
  prsten; jídlo (chléb 35 %, maso 50 %, jablko 15 %), šípy (sčítají se), lektvary. Úroveň předmětu = patro (+0–2 v
  truhle), základy se vybírají s důrazem na „nejnovější" pro úroveň. Pět vzácností (běžná → legendární, barva rámečku),
  každý stupeň = +12 % poškození a jedna náhodná vlastnost (síla, obrana, magie, zdraví, přesnost, oheň); jméno podle
  nejsilnější („Železný meč síly"). `skorePredmetu` = jedno číslo pro ▲/▼ a pro bota.
- **Výbava a batoh:** 8 slotů (zbraň, štít, helma, brnění, boty, amulet, 2 prsteny; prsten jde do volného, jinak
  nahradí slabší), batoh 16 míst. Nasazení / sundání / jídlo / pití / položení stojí tah. Hodnoty hráče se počítají
  z výbavy (`odvozene`) – základní statistiky mění jen úrovně a lektvary. Start: Rezavý meč, Prošívanice, 2× chléb,
  2× lektvar léčení.
- **Hlad:** sytost −0,1 % za tah (plný žaludek ≈ 1000 tahů); pod 30 % a 10 % upozornění, na nule se nehojíš a každých
  5 tahů ztrácíš život – smrt hladem má vlastní epitaf.
- **Lektvary:** 8 druhů (léčení, velké léčení, síla, odolnost, zkušenost, sytost, osvícení = celá mapa, jed); barvy se
  každou výpravu zamíchají, druh se pozná napitím („Kalný lektvar" → „Lektvar síly"). Léčivý zná hrdina od začátku.
- **Truhly** (1–4 na patro, u zdí místností): otevřou se vejitím, dají 1–3 věci + zlato; co se nevejde, zůstane na zemi.
  **Kořist** po potvorách (40 % zlato, 22 % předmět, jinak občas jídlo) a pár drobností volně na zemi; sebere se
  šlápnutím. Potvory truhly obcházejí.
- **Stránka:** pixelové ikony předmětů 16×16 (lektvar v barvě své tekutiny), sprity truhly (zavřená/otevřená), pytle
  a hromádky zlata; zbraň v ruce podle nasazené; okno batohu (klávesa I, tlačítko 🎒) se srovnáním s nasazenou věcí
  po řádcích ▲/▼ a „celkově lepší/horší"; panel ukazuje 🍖 sytost, 💰 zlato, 🏹 šípy; truhly a kořist na mapě.
- **Zvuky:** truhla (vrznutí + žuchnutí), cinkání mincí, šustnutí, kovové nasazení, křupání jídla, bublání pití,
  třpyt účinku, luk (tětiva + svist), kručení v břiše.
- **Vyvážení** (`OBTIZNOST` v logice, ladicí skript prošel sadu nastavení): s kořistí hráč sílil rychleji než potvory
  (hpRust 0,1 → 95 % botů až do 40. patra). Zvoleno hpRust 0,35 / útokRust 0,8 / přesnostRust 0,02: bot umírá
  v průměru ve **12,2. patře** (medián 10, 10 % do 7., 90 % do 21.), úroveň 6,8, 127 tahů/patro, sní 2,9 jídla,
  vypije 5,4 léčivého lektvaru, nasadí 11,5 lepších věcí. Bot se naučil jíst, pít, obléct lepší, otvírat truhly
  (blízkost podle délky cesty – vzdušná vzdálenost ho nechala přeskakovat mezi cíli až do smrti hladem).
- **Testy:** boj 400 výprav bez porušení invariant; headless 66/66 (truhla dá zlato i věci, batoh 8+16 slotů,
  ▲ u lepší věci, detail se srovnáním, nasazení stojí tah, lektvar léčí, Escape zavře, luk střílí na 2 pole a bere šípy).
- Kompromisy: od 15. patra chodí jen kostlivci (nový bestiář přijde v etapě 6); bot lukem nestřílí; magie zatím nemá
  účinek (etapa 6 – svitky a hůlky).

### Etapa 5 (25. 9. 2026)

- **Tajné místnosti** (generátor, 55 % pater): kus skály 2–4 × 2–4 odděleného zdí, vstup jen dlaždicí `TAJNE`
  (zeď s klikatou prasklinou). Odhalí ji ohmatání (klávesa X / ťuknutí do pohledu, stojí tah), čekání-prohledávání
  (35 %) nebo náraz (40 %). Uvnitř truhla +3 úrovně a často zlato; počítá se do epitafu. Dlaždice přibyla až na
  konec generátoru, takže dosavadní patra ze stejného seedu zůstala stejná.
- **Místnosti s účelem** (58 % místností mimo startovní): hrobka (od 3.; rakve, spící had / od 6. kostlivec,
  truhla +1), skladiště (sudy, bedny, jídlo, šípy/lektvar), knihovna (police, 1–2 knihy – odhalí neznámý lektvar,
  jinak zkušenosti), kobka (klece, krysy / od 5. goblini, věc po vězni), svatyně (oltář: 65 % + 2 %·magie
  požehnání – uzdravení, síla, obrana, magie, sytost; jinak kletba – popálení, strážce, hlad), doupě (kosti,
  2–3 potvory, truhla +2), pokladnice (od 3.; 2 truhly +3, zlato; všechny dveře zamčené, klíč leží jinde – zamknout se
  smí jen místnost, bez které zůstane dostupné všechno ostatní i schody). Při vstupu zpráva s popisem.
- **Překážky** (rakev, sud, bedna, police, oltář, klec; kosti jen na zemi) blokují pohyb, střelbu i potvory;
  po položení každé se ověřuje `souvisle` – nesmí odříznout žádné pole. Truhly prošly stejnou kontrolou.
- **Pasti** (1 + patro/3, max 6; ne ve startovní místnosti ani pokladnici): jáma (propad o patro níž + zranění,
  odhalená jáma první krok jen varuje, druhý = skok dolů), šipky (uhnout jde s obranou), tlaková deska (gong
  – celé patro jde po tobě, nebo kámen ze stropu). Všímavost: po každém kroku 15 % + 3 %·úroveň na pasti vedle,
  čekání prohledá okruh 2 pole s 50 %. Odhalenou past (kromě jámy) překročíš na 70 % + 3 %·úroveň. Potvory pasti
  znají a chodí po nich bez spuštění (dřív se jim vyhýbaly a past v úzké chodbě je úplně zastavila).
- **Stránka:** textury tajné zdi a tří pastí, 9 nových spritů (rakev, sud, bedna, police s barevnými hřbety,
  oltář se svíčkou a zářícím drahokamem / vyhaslý, klec s průhlednými mřížemi, kosti, klíč na zemi), ikony knihy
  a klíče; na mapě zamčené dveře červeně, odhalené pasti, překážky a oltář.
- **Zvuky:** skřípění tajných dveří, cvaknutí odhalené pasti, pád jámou, šipka, gong, padající kámen, požehnání
  (durový chór), kletba (disonance), klíč v zámku, otáčení stránek.
- **Chyby, které testy našly:** truhla se mohla položit na věc ze zařízení místnosti (věc pak nešla sebrat) – bot
  se u ní zacyklil; potvora mohla vlézt do tajných dveří (kořist pak ležela „ve zdi"); výchozí kontrola volného pole
  pro potvory neznala novou dlaždici. Nový invariant v `podzemi_boj.js`: nic se nepřekrývá, nic není ve zdi,
  překážky nic neodřízly.
- **Testy:** generátor 5000 pater (do tajné místnosti se nedá dojít jinak než tajnými dveřmi, právě jedny);
  jednotkové: pokladnice zamčená, klíč v patře, bez klíče „zamčeno", s klíčem odemčeno a po načtení zůstane;
  jáma varuje a shodí; ohmatání odhalí tajné dveře (i po načtení) a vede do tajné místnosti; oltář jen jednou;
  kniha odhalí lektvar. Bot: průměr smrti **11,4. patro** (medián 10, 90 % do 18.), bez porušení invariant.
  Headless 81/81 (ťuknutí do zdi, šipková past, oltář, sud blokuje, kniha z batohu, zvuky bez přebuzení).

### Etapa 6 (25. 9. 2026)

- **Prostředí** (`STYLY` ve stránce): každé má vlastní generátor zdi / podlahy / stropu a barvu světla –
  kobky (cihly, dlažba, trámy; teplé), zatopené jeskyně (skála ze šumu, mokrá podlaha s loužemi; chladné),
  trpasličí doly (skála s dřevěnou výztuží, koleje s pražci), krypta (kvádry, vytesaná lebka, náhrobní desky
  s křížem, klenba), lávové podzemí (čedič se žhnoucími prasklinami na zdi i podlaze – svítí i ve tmě; rudé světlo),
  podivno (pruhy, šachovnice; fialové). Tajná zeď se dělá z aktuální zdi prostředí. Sprity se přestínují
  barvou světla prostředí.
- **Bestiář** (od/do se překrývají, staré druhy mizí: kostlivec do 16.): ork, utopenec, obří žabák (rychlý),
  temný mág (kouzlí na 5 polí, drží si odstup), kamenný golem (pomalý, obrněný), démon (rychlý), přízrak
  (vysává život – léčí se polovinou zranění), kostlivý rytíř, ohnivák (ohnivé koule), pekelný pes (1,6 akce/tah),
  Bezejmenné (51+, většinou spí). Základní síla navazuje na křivku kostlivce v dané hloubce.
- **Bossové** v místnosti se schody každé 10. patro: Krysí král (povolává krysy), Utopený kapitán (ledový proud
  + utopenci), Kovář golemů (golemové), Lich (mrazivé kouzlo, drží odstup, kostlivý rytíři), Ohnivý démon (pekelný
  oheň, ohniváci), od 60. Srdce hlubin (Bezejmenní) – za 60. patrem se opakuje a sílí (+50 % zdraví / cyklus).
  Aréna patří jen bossovi, probudí se na 6 polí, ohlásí se při vstupu, schody drží **bariéra** (sprite nad šachtou).
  Po jeho smrti zmizí jeho sluhové a padne kořist (2 věci +4 úrovně aspoň epické, magie, hodně zlata).
- **Magie:** svitky (ohnivá koule, léčení, přemístění, jasnozření = mapa + pasti) a hůlky s 3–6 náboji (oheň,
  blesky, hojení). Síla = základ podle patra × (1 + 0,15·magie). Ohnivá koule zasáhne první potvoru v přímce
  a polovinou její sousedy, blesk všechny v přímce. Kouzlo směrem se sesílá z batohu a batoh se zavře, aby byl
  vidět efekt (letící koule s výbuchem, klikatý blesk, zelený / bílý záblesk).
- **Zvuky:** ohnivá koule, blesk, léčení, přemístění, kouzlo potvory, povolání posil, řev bosse, fanfára po jeho
  pádu, bzučení bariéry; zvuky prostředí na pozadí: kapky (jeskyně, častěji), krumpáče (doly), zvon (krypta),
  bublání a dunění lávy, podivné tóny. Chyba nalezená měřením: oscilátor spuštěný dřív než obálka krátce zazní
  naplno (léčení přebuzovalo na 1,13).
- **Chyba nalezená botem:** kontrola průchodnosti počítala se schody jako s průchozím polem – police mohly
  obestavět arénu tak, že se k bossovi dalo dojít jen přes schody (které hlídá bariéra). Schody jsou teď v kontrole
  překážka, jen k nim musí jít dojít.
- **Testy:** jednotkové (Krysí král v 10. patře u schodů, bariéra, povolání krys, po smrti bosse zmizí sluhové
  a zůstane kořist; ohnivá koule, jasnozření, přemístění, vybitá hůlka zmizí). Bot (umí kouzlit a jde po bossovi):
  průměr smrti **11,2. patro**, medián 10, 90 % do 17.; Krysího krále porazí ~78 % těch, kdo k němu dojdou,
  Utopeného kapitána ~60 %. Headless 104/104 (snímky všech prostředí s jejich potvorou, boss s bariérou,
  ohnivá koule a výbuch). Nový parametr `?seed=N&patro=M` pro ladění hloubky.

### Etapa 7 (25. 9. 2026)

- **Síň slávy** (tlačítko 🏆, i z epitafu): záložky Nejhlubší (10 nejlepších podle patra, pak zlata), Poslední
  (10 posledních) a Celkem (výprav, nejhlubší patro, zabité nestvůry, zlato, tajné místnosti, poražení bossové,
  tahy, nejčastější zabiják). Klíče `webapp_hra_podzemi_sin` a `webapp_hra_podzemi_statistiky`. Epitaf ukáže pořadí
  výpravy („Tvá 3. nejhlubší výprava z 7", „🏆 Nový rekord!") a počet poražených strážců (`s.bossu` v logice).
  Ladicí výprava `?patro=` se do rekordu ani síně slávy nezapisuje (dřív test „vytvořil" rekord 52. patra).
- **Návod** „Jak hrát" ve sbalitelném `<details>` místo dlouhého odstavce.
- **Kroky podle povrchu:** čvachtání v jeskyních, tlumený dopad v dolech, syknutí na lávě.
- **Výkon:** snímek v lávovém patře s potvorami a loučemi se vykreslí za 2 ms (headless, DPI 2) – na telefonu
  zbývá rezerva; mimo animace se překresluje ~15× za sekundu.
- **Konečné vyvážení** (`OBTIZNOST` beze změny od etapy 4): rozumně hrající bot (1000 výprav) umírá v průměru
  v **11,2. patře** (medián 10, 10 % do 6., 90 % do 17., max 32), Krysího krále porazí 78 % těch, kdo k němu
  dojdou, Utopeného kapitána 66 %. **Slabý bot** (`SLABY=1`: nekouzlí, nesbírá, nezkouší lektvary) umírá
  v průměru v 5,5. patře a k prvnímu bossovi nedojde – kořist a magie mají smysl. Cíl plánu (8.–15.) splněn.
- **Testy:** generátor 5000 pater, boj 1000 výprav bez porušení invariant, headless 112/112 (síň slávy z epitafu,
  celkové statistiky, výkon, kroky po povrchu, batoh a síň slávy na 360 px bez posuvu).

## Rozšíření (schváleno 25. 9. 2026)

Stejný postup jako u etap 1–7: implementace → testy v node (generátor, boj + bot) → headless → záznam níže.
Po každé etapě bot znovu změří obtížnost (cíl: rozumný hráč průměrně 8.–15. patro).

- [x] **8. Pohodlí na mobilu** (25. 9. 2026)
  - rychlá lišta: 3 sloty v pohledu (lektvar / svitek / hůlka / jídlo), přiřazení z batohu, použití jedním ťuknutím
    nebo klávesami 1–3; výchozí naplnění (léčivý lektvar, jídlo)
  - automatická chůze: ťuknutí na prozkoumané pole ve velké mapě → hrdina tam dojde po známých polích,
    zastaví se, když uvidí potvoru, objeví past nebo se něco stane; zrušení libovolnou akcí
  - nastavení: hlasitost efektů a prostředí zvlášť, rychlost animací, režim bez blikání
- [x] **9. Obchodník a prokletí** (25. 9. 2026)
  - obchodník (místnost každé 3.–5. patro): nabídka podle hloubky, výkup za 1/5 ceny, hodnota předmětů
  - prokleté předměty (nejdou sundat, skrytá nevýhoda), sejmutí kletby oltářem nebo svitkem
  - identifikace svitků jako u lektvarů
- [x] **10. Schopnosti a postavení v souboji** (25. 9. 2026)
  - každou 3. úroveň volba 1 ze 3 schopností
  - útok zezadu / na nic netušící potvoru = dvojnásobné poškození; krytí štítem (tah bez útoku, −70 % zranění)
- [x] **11. Denní výprava a úspěchy** (25. 9. 2026)
  - denní výprava se seedem z data, vlastní žebříček; úspěchy napříč výpravami; odemykatelní hrdinové
- [x] **12. Světlo a hádanky** (25. 9. 2026)
  - dohořívající pochodeň, sebratelné louče, mágové zhasínají; páky, mříže, teleporty, jednosměrné dveře

### Etapa 8 (25. 9. 2026)

- **Rychlá lišta** (3 sloty v pohledu vedle tlačítek boje, na straně odvrácené od kříže; klávesy 1–3): slot drží
  *druh* věci (léčivý lektvar, jídlo, konkrétní svitek/hůlka), takže se po spotřebování sám doplní dalším kusem;
  ukazuje počet (u hůlek náboje). Výchozí: léčivý lektvar, jídlo, prázdný. Přiřazení v detailu věci v batohu
  („Do rychlé lišty: 1 2 3"). Ukládá se s výpravou (`rychla`).
- **Automatická chůze:** ťuknutí na prozkoumané pole velké mapy → `najdiCestu` (BFS jen po známých průchozích
  polích, mimo odhalené pasti, překážky, potvory, zamčené dveře bez klíče a schody – ty jen jako cíl). Chodí
  po krocích s animací, dveře cestou otevírá. Zastaví se, když uvidí potvoru, spustí/odhalí past, je zraněn,
  najde tajné dveře, dostane hlad, otevře truhlu nebo sejde o patro; zruší ji jakákoli akce hráče nebo Escape.
  Důvod zastavení se zaznamenává (`duvodZastaveni` – pomohl najít chybu v testu, který šel „na nejvzdálenější
  pole" = schody).
- **Nastavení** (⚙️): hlasitost efektů a prostředí zvlášť (dva kanály Web Audio se společným dozvukem),
  rychlost animací (normální / rychlé / vypnuté), režim bez blikání (místo záblesků přes celý obraz tenký rámeček,
  klidné světlo loučí, blesk bez mihotání). `webapp_hra_podzemi_nastaveni`.
- **Testy:** node – 142 náhodných cest ověřeno (jen známá pole, bez pastí a překážek, spojitá, končí v cíli);
  headless 121/121 – lišta ukazuje počty, klávesa 1 vypije, přiřazení svitku a seslání ťuknutím, chůze dojde
  do cíle i se zastaví u potvory, nastavení se uloží, na 360 px se tlačítka nepřekrývají (vpravo i vlevo).

### Etapa 9 (25. 9. 2026)

- **Obchodník** (~31 % pater od 2., ne v patře s bossem, nejpozději každé 5. patro – pojistka): místnost bez potvor,
  pixelový obchodník s lucernou (na mapě zlatý), krok do něj otevře obchod. Nabídka: 2× léčivý lektvar, lektvar,
  2× jídlo, magie, zbraň, ochrana, ochrana/šperk (vše aspoň neobvyklé, nikdy prokleté), šípy, od 3. patra svitek sejmutí
  kletby. Ceny (`cenaPredmetu`) podle skóre a vzácnosti; **neznámé lektvary a svitky mají jednotnou cenu 50** (jinak by
  cena prozradila druh). Výkup za pětinu, prodané věci obchodník vystaví. Sejmutí kletby za 40 × patro. Hádanka
  (40 %, 8 českých hádanek, jedna odpověď) → sleva 25 %. Obchodování tah nestojí. Rychlé ▲ „lepší než tvoje".
- **Prokletí** (8 % + 0,3 %·úroveň, max 20 % výbavy; láká o stupeň vyšší kvalitou): slabost (síla −2), zranitelnost
  (obrana −2), hlad (2× rychleji). Pozná se až nasazením (☠ v názvu), pak nejde sundat ani vyměnit. Sejme ji obchodník,
  svitek sejmutí kletby nebo požehnání u oltáře. Kořist bosse a zboží nikdy prokleté nejsou.
- **Neznámé svitky:** každá výprava má vlastní nápisy („Svitek ‚KRI RUN'"), přečtením se svitek pozná; knihy odhalují
  lektvary i svitky.
- **Chyby nalezené testy/botem:** (1) bot donekonečna přehazoval prsteny – srovnával s prokletým, který nejde vyměnit;
  stejnou chybu mělo ▲ v batohu → srovnává se jen s vyměnitelným prstenem. (2) Obchodník vzniklý pojistkou by po
  načtení zmizel – ukládá se stav „kdy byl naposled obchod" platný při vstupu do patra (`obchodPred`). (3) Smrt pastí,
  jedem či u oltáře nepřepočítala viditelnost (odhalil test uložení).
- **Vyvážení:** bot nakupuje léčivé lektvary a platí sejmutí kletby → průměr smrti **12,6. patro** (medián 13, 90 % do 18.).
- **Testy:** boj – obchod na 31 % pater, nikdy s potvorou ani prokletým zbožím, nákup bez peněz neprojde, nákup/prodej
  nestojí tah, hádanka, uložení obchodu i obchodníka (i vzniklého pojistkou); kletba se odhalí, nejde sundat ani vyměnit,
  svitek ji sejme; neznámý svitek ukazuje nápis a přečtením se pozná. Headless 128/128.

### Etapa 10 (25. 9. 2026)

- **Schopnosti** (`SCHOPNOSTI`, 12 druhů): každou 3. úroveň nabídka 3 náhodných ještě nezískaných; okno s kartami
  (ikona, název, popis), dokud se nevybere, hra čeká (i po načtení). Bojovník (+25 % na blízko), Lukostřelec
  (+2 dostřel, šíp se v 50 % neztratí), Zloděj (útok ze zálohy ×3, pasti do 2 polí vždy), Mág (+2 magie, svitek
  v 25 % zůstane), Tuhý kořen (+15 zdraví), Hbitý (20 % útoků mine), Houževnatý (hojení každé 4 tahy místo 7),
  Skromný (poloviční hlad), Smlouvač (−20 % u obchodníka, výkup ×2), Štítonoš (štít +1 obrana, krytí 90 %),
  Zaklínač (ohnivá koule a blesk +35 %), Šťastlivec (+50 % zlata, truhly +2 úrovně). Seznam je v hlavičce batohu.
- **Útok ze zálohy:** spící nebo bloudící potvora, nebo potvora otočená zády (potvory si nově pamatují směr –
  `smer` po pohybu a útoku) dostane ×2 (Zloděj ×3); ne boss. Nad nic netušícími potvorami je pixelové **Z**
  (spí) nebo **?** (bloudí) – je vidět, kdy se připlížit.
- **Krytí štítem** (🛡️ v pohledu jen se štítem, klávesa C): tah bez útoku, zranění z blízka −70 % (Štítonoš −90 %),
  z dálky −50 %; platí na jedno kolo potvor.
- **Testy:** schopnost se nabídne na 3. úrovni (3 kusy), mimo nabídku zvolit nejde, Tuhý kořen +15; útok ze zálohy
  4,0 → 8,0 průměrného zranění; krytí 7,2 → 2,2 zranění za kolo. Headless 133/133 (okno volby, tlačítko krytí jen se
  štítem, klávesa C, útok na bloudící krysu ze zálohy, na 360 px se nic nepřekrývá ani se třemi tlačítky boje).
- **Vyvážení:** bot volí schopnosti podle priority a v nouzi se kryje → průměr smrti **14,2. patro** (medián 14,
  90 % do 23.). Na horní hraně pásma 8.–15. – bot hraje lépe než průměrný člověk, obtížnost zůstává.

### Etapa 11 (25. 9. 2026)

- **Hrdinové** (`TRIDY`): Rytíř (výchozí), Zloděj (24 zdraví, dýka, krátký luk, šípy, kožené boty, schopnost Zloděj;
  odemkne úspěch Hledač), Mág (22 zdraví, magie 4, dýka, hůlka ohně, známé svitky léčení a ohně, schopnost Mág;
  odemkne Mokré nohy = 11. patro), Barbar (40 zdraví, síla 5, sekera, bez brnění a lektvarů, schopnost Bojovník;
  odemkne Královrah). Okno volby s kartami, zamčené ukazují podmínku. Bot se všemi čtyřmi: průměr 13,0–14,8. patra.
- **Denní výprava** (📅): seed z místního data (`seedDne`, FNV-1a), pro všechny stejné podzemí; povolání volitelné;
  v panelu 📅, v síni slávy záložka Denní (nejlepší patro dne, počet pokusů, posledních 30 dní).
- **Úspěchy** (19): první krev, hloubky prostředí (5, 11, 21, 31, 41, 51), veterán (10. úroveň), 3 tajné místnosti,
  pokladnice, 1000 zlatých, legendární věc, 10 útoků ze zálohy, 500 utracených zlatých, Krysí král bez lektvaru,
  prokletá věc, hádanka, denní výprava do 5. patra. Kontrola po každé akci, oznámení, záložka Úspěchy s daty.
  Počítadla výpravy (`stat`: zálohy, utraceno, vypito) se ukládají. Ladicí výpravy se nezapočítávají.
- **Testy:** headless 139/139 – bez úspěchů jen rytíř, po Královrahovi barbar (sekera, 40 zdraví, bez lektvarů),
  denní výprava dvakrát stejná, První krev se zapíše, záložky Denní a Úspěchy.

### Etapa 12 (25. 9. 2026)

- **Pochodeň** (`hrac.pochoden`, 800 na startu, max 1000): ubývá 1 za tah, světlo hrdiny s ní slábne (pod 100 kmitá),
  bez ní svítí jen matně (0,1), průzkum dosáhne 2 pole místo 5 a přesnost −15 %. Doplní ji předmět Pochodeň (+500;
  nová kořist „světlo", jedna náhradní na startu) nebo **louč ze zdi** – ohmatání stěny s loučí (+350); sebraná louč
  přestane svítit i na mapě světla (`sebraneLouce`, ukládá se). Temný mág a Lich při zásahu kouzlem v 35 % pochodeň
  přidusí (−150). Ukazatel 🔥 v panelu. Hash louče se přesunul do logiky (`jeLouc`), stránka ho přebírá.
- **Páka a mříž** (od 3. patra, 17 % pater): místnost s truhlou (+2) a zlatem zavřená mříží (dveře v `mrize`, mříží
  je vidět – vlastní průhledná textura, nenastavuje hloubku), páka na zdi jinde v patře (textura nahoře/dole,
  na mapě červená tečka), ohmatáním se zatáhne a mříže se otevřou. Potvory ani automatická chůze mříží neprojdou.
- **Teleportní kruhy** (od 4. patra, 25 %): dvojice svítících runových kruhů v různých místnostech (≥ 8 polí),
  šlápnutí přenese na druhý; automatická chůze je nepoužívá, na mapě fialové.
- **Chyby nalezené botem/invariantem:** (1) pád jámou mohl skončit v místnosti za zavřenou mříží, odkud nevede cesta
  ven – vyloučeno (i pro svitek přemístění), nový invariant „hráč uvízl za mříží"; (2) **kontrola průchodnosti brala
  zamčené dveře jako průchozí** – sudy a bedny tak mohly zatarasit jedinou volnou cestu a ke schodům pak vedla jen
  zamčená pokladnice (hráč by uvízl, bot umíral hladem). `souvisle` teď ověřuje obojí: celé patro po odemčení
  i dostupnost všeho mimo zamčené místnosti se zámky; pokladnice se zamyká před rozmístěním překážek a zámek
  i mříž se použijí jen tehdy, když kontrola projde; páka jen na poli dostupném se zavřenou mříží.
- **Vyvážení** (1000 výprav): průměr smrti **13,2. patro** (medián 12, 90 % do 20.), slabý bot 5,8.
- **Testy:** pochodeň ubývá a doplní se, bez ní menší dohled, louč ze zdi jde sebrat jednou a zůstane sebraná po
  načtení, mříží nejde projít ale je vidět, k páce se dá dojít, páka otevře mříž i po načtení, teleport přenese.
  Headless 146/146 (pohled skrz mříž, páka nahoře/dole, zvednutí mříže ťuknutím, teleport, tma a ukazatel 🔥).

### Celá obrazovka (25. 9. 2026)

- Tlačítko **⛶ Celá obrazovka** ve spodní liště: Fullscreen API na celý dokument (i v rozcestníku – iframe má
  `allowfullscreen`), kde chybí (iPhone), aspoň rozvržení přes celé okno. Třída `body.cela`; Esc / opuštění
  fullscreenu režim vypne, tlačítko se přepíše na **↩️ Zmenšit**.
- Pohled vyplní zbylé místo, plátno drží 4 : 3 přes `object-fit: contain` – dotykový kříž a boj leží v černých
  pruzích a scénu nezakrývají. Na výšku: HUD nahoře, deník (poslední 2 řádky) a tlačítka dole; na šířku: pohled
  vlevo, panel s HUD, deníkem a tlačítky vpravo; do 520 px výšky se panel zhustí (skryje rekord a biom).
- `body.cela{padding:0 !important}` – podpis.js dává tělu inline spodní odsazení, výšku `100dvh` už zmenšuje sám.
- **Test:** `python3 _test/podzemi_cela.py` – okna 1280×720, 1000×560, 560×1000 a rámy 360×740, 740×360, 390×660:
  všech 31 ovládacích prvků (tlačítka, HUD, deník, minimapa) leží celé v okně, stránka neroluje; 8/8.
  Původní `podzemi_snimek.py` 148/148.

### Tišší pohyb (25. 9. 2026)

- Otočka je bez zvuku (syntéza `otocka` odstraněna), kroky hrají na 40 % původní hlasitosti
  (špička 0,17–0,24 místo 0,35–0,49). Headless 147/147.

### Strach přejde, pochodeň z batohu (25. 9. 2026)

- Potvora na útěku si vylosuje 4–9 tahů strachu (`strachDo`), pak se vzchopí (událost `vzchopila`, hlas potvory,
  zápis do deníku) a jde znovu do boje; podruhé už neuteče (`vzchopila`). Obě pole jsou v `POLE_POTVORY` na konci,
  starší uložení se dopočítají (`strachDo == null` – po JSON je z `undefined` v poli `null`).
- **Chyba:** pochodeň v batohu neměla tlačítko – logika `pouzij` ji zapálit uměla, UI ne. Teď: popis v detailu
  („doplníš světlo o 50 %, teď X %"), tlačítko **Zapálit**, přiřazení do rychlé lišty; plnou pochodeň odmítne
  (`plnaPochoden`, tah se nespotřebuje).
- **Testy:** `node _test/podzemi_strach.js` (200 seedů: útěk 4–9 tahů, znovu neuteče, přežije uložení; pochodeň),
  `python3 _test/podzemi_pochoden.py` (tlačítko, rychlá lišta, plná pochodeň) 5/5, `podzemi_snimek.py` 147/147,
  bot 300 výprav: smrt průměrně 13,3. patro.

### Slot pro luk, přehození zbraní, větší batoh (25. 9. 2026)

- **Luk má vlastní slot** `luk` (v `SLOTY` hned za `zbran`, `slotPro` pozná luk podle `dosah`). V ruce je jen jedno
  z nich – `hrac.drzi` ('zbran' | 'luk'); `vRuce(s)` / `drziLuk(s)`. Bonusy (síla…) dává jen zbraň v ruce, kletby
  platí z obou. Nasazená zbraň či luk jde rovnou do ruky. Zloděj začíná s lukem na zádech.
- **Přehození** akcí `prehod`: klávesa **R** nebo tlačítko ⇄🏹/⇄⚔️ v pohledu (vedle štítu, jen když máš luk);
  nestojí tah (`konecTahu` umí jen celé tahy), podržení neopakuje. Vlastní zvuk `prehozeni` (švih + tětiva / čepel).
- **Větší batoh** u obchodníka, po stupních: Kožená brašna +4 (150 💰), Cestovní vak +8 (400), Trpasličí krosna +12
  (900) – `BATOHY`, `hrac.batohStupen`, `kapacita(s)` místo `MAX_BATOH`; sleva z hádanky i Smlouvač platí.
- Starší uložení: luk ve slotu zbraně se přesune do slotu Luk (a zůstane v ruce). Nákupy u obchodníka se teď
  ukládají hned (dřív až po dalším tahu).
- **Testy:** `node _test/podzemi_luk.js` 20/20, `python3 _test/podzemi_luk_ui.py` 11/11 (i 4 tlačítka boje na
  360 px bez překryvu), `podzemi_snimek.py` 148/148, bot 300 výprav: průměr 13,3. patro (bot batohy nekupuje).

### Šípy jdou sebrat, ukazatele nad potvorami, chytřejší bot (29. 9. 2026)

- **Šípy:** vystřelený šíp zůstane s šancí `NAVRAT_SIPU` = 50 % ležet – pod zasaženou potvorou (kde stála při
  zásahu), nebo na posledním volném poli letu (nikdy ve zdi). Šíp ušetřený Lukostřelcem se nekopíruje.
  `polozNaZem` skládá šípy na hromádku; sebrání šlápnutím jako u ostatních věcí.
- **Ukazatele nad potvorami (pixel art ve scéně):** pruh zdraví u zraněných (u bosse vždy; šířka podle velikosti
  spritu; rudý > 50 %, oranžový pod, žlutý = utíká), nový znak **!** = utíká (vedle Z / ?). Potvoře schované
  za bližší potvorou se značky nekreslí (v chodbě se jinak slévaly).
- **Bot `CHYTRY=1`:** nosí nejvýš 4 jídla, u obchodníka prodá horší výbavu a kupuje větší batoh (`BEZBATOHU=1`
  bez batohu). Výchozí bot beze změny, na něj je vyladěná `OBTIZNOST`.
- **Zjištění k obtížnosti (300 výprav, do 40. patra):** výchozí bot si ucpe batoh jídlem (v průměru ~10 kusů –
  jídlo se neskládá), takže nemá kam dát lektvary. Rozumný bot: bez většího batohu 97/300 přežije do 40. patra
  (výchozí 8/300), s batohem 168/300. „Průměr smrti" navíc přeživší nepočítá, takže obtížnost podhodnocuje.
  Menší stupně batohu (+3/+6/+9) ani vyšší ceny výsledek skoro nezměnily – rozhoduje, jestli batoh přeteče.
  **Návrh (neprovedeno, čeká na rozhodnutí):** přeladit `OBTIZNOST` na `CHYTRY=1`, nebo jídlo skládat na
  hromádky jako šípy.
- **Testy:** `node _test/podzemi_luk.js` 24/24 (i šípy na zemi), `python3 _test/podzemi_ukazatele.py` 5/5,
  `podzemi_snimek.py` 148/148, `podzemi_cela/pochoden/luk_ui` beze změny, výchozí bot 13,3. patro, 8 přeživších.

### Bot ve hře, dotykové rozvržení (29. 9. 2026)

- **Bot je modul `obsah/podzemi_bot.js`** (`PodzemiBot.vytvor(L).rozhodni(s, stat, volby)`), sdílený testem
  vyvážení i hrou – jeden bot. Volby `chytry`, `slaby`, `bezBatohu`, `akce` (kudy pouštět nákupy u obchodníka).
  Výchozí bot v testu dává stejná čísla jako dřív (13,3. patro, 8/300).
- **🤖 Sledovat bota** (spodní lišta): bot (chytrý, náhodné povolání) hraje **ukázkovou výpravu**. Tvoje uložená
  výprava zůstane v úložišti, `uloz()` během ukázky nic nezapisuje, `bezZaznamu` hlídá rekord, síň slávy,
  denní výpravu i úspěchy; smrt bota nemaže uložení ani neukazuje epitaf. Po konci (⏹, Esc, smrt bota) se
  tvoje výprava obnoví. Proužek v pohledu: povolání, patro, tempo 1× / 2× / 4× (zkracuje i animace), ⏹.
  Za bota se nehraje (klávesy pohybu i tlačítka jsou vypnuté), batoh a mapu jde otevřít – bot mezitím počká.
  Pojistka: 40 kroků bez tahu → bot počká.
- **Dotykové rozvržení** (`body.dotyk`; Nastavení → Rozvržení: automaticky / dotykové / klasické, automaticky
  = `pointer: coarse`). Tatáž tlačítka se jen přestěhují z pohledu do `#panel`. Nic se neroluje (100dvh).
  - Na výšku: HUD kompaktně, obraz bez tlačítek, deník (zbytek výšky), panel: horní řádek rychlá lišta +
    ⏳ 🛡️ ⇄, spodní řádek velký útok (88 px) pod levým palcem a kříž pod pravým; lišta 🎒 Batoh · 🗺️ Mapa · ⋯ Další
    (ostatní volby v rozbalovacím panelu 2×N, zavře se volbou nebo ťuknutím mimo).
  - Na šířku jako gamepad: obraz uprostřed (`--pw` nechá stranám ≥ ~150 px), vlevo HUD, rychlá lišta, akce
    a útok, vpravo ikonové menu, deník a kříž.
  - „Tlačítka: vlevo" zrcadlí panel pro leváky, „skrytá" schová kříž. Celá obrazovka v dotykovém režimu jen
    skryje lištu prohlížeče (rozvržení `body.cela` platí jen pro klasické).
  - Past: `.boj` má v základním CSS `position:absolute` – v mřížce pak nezvětší řádek a přeteče do sousedů.
- **Testy:** `python3 _test/podzemi_bot_ui.py` 7/7 (hraje, nic neukládá, vrátí výpravu i po smrti bota),
  `python3 _test/podzemi_dotyk.py` 17/17 (10 velikostí telefon/tablet na výšku i šířku, leváci: vše na displeji,
  ≥ 44 px, bez překryvu, nic přes obraz, 4 : 3, bez rolování, ⋯ Další), ostatní sady beze změny.

### Záloha a varianty grafiky (29. 9. 2026)

- **Záloha** stavu před grafikou: `podzemi_kopie_2026-09-29/` v kořeni webu (hra, logika, bot, zvuk, plán,
  testy, `ZALOHA.txt` s postupem obnovy). „kopie" v názvu → `.gitignore` ji vynechá; leží ve stejné hloubce jako
  `obsah/`, takže běží (`/podzemi_kopie_2026-09-29/podzemi.html`). Sdílí s hrou localStorage.
- **Šest stylů grafiky** (`nast.grafika`, Nastavení → Grafika, klávesa **G**, tlačítko 🎨 ve spodní liště /
  v ⋯ Další): Pixel art (původní), EGA – 16 barev (Bayer 4×4, mírné oteplení), Game Boy (4 zelené odstíny),
  Rytina na pergamenu (inkoust / sépie / papír), Fosforový monitor (zelená + řádkování), Drátěný model.
  Barevné styly = `prebarvi()` nad hotovým snímkem na konci `kresliScenu` (i efekty a nápisy) a nad minimapou
  i velkou mapou; výsledky přes LUT (EGA 32k položek).
- **Drátěný model:** raycaster si vede `idb` (pole × 8 + druh plochy: podlaha, strop, 4 strany stěny, dveře) a
  `svb` (světlo v pixelu). Hrana = změna `idb` vpravo/dole → obrysy zdí, dveří, mříží i mřížka podlahy a stropu;
  jas čáry ze světla loučí (ne z textury – spáry na okraji dlaždic jsou tmavé a čáry by zmizely). Sprity se
  kreslí přes drát a přebarví se zeleně.
  Past: `BAYER` už v kódu byla (stínování textur) – druhá deklarace by shodila celý skript.
- Výkon (headless, snímek): pixel 2,1 ms, EGA 3,1, Game Boy 4,3, rytina 4,3, fosfor 3,3, drát 3,9.
- **Testy:** `python3 _test/podzemi_grafika.py` 16/16 (paleta každého stylu v obraze i minimapě, výkon,
  G, Nastavení), ostatní sady beze změny (`podzemi_dotyk` 17/17 – ⋯ Další na šířku ve 3 sloupcích).

### Záloha a varianty grafiky (29. 9. 2026)

- **Záloha** předchozí verze (v178: bot, dotykové rozvržení…) ve složce `podzemi_kopie_2026-09-29/` v kořeni webu
  (hra, logika, bot, zvuk, plán, testy, `ZALOHA.txt` s postupem obnovy). Git ji ignoruje (`*kopie*`), jde spustit
  přes lokální server – složka je ve stejné hloubce jako `obsah/`, takže sdílené `../common.css` atd. fungují.
- **Šest stylů grafiky** (Nastavení → Grafika, klávesa **G**, tlačítko **🎨** ve spodní liště / „⋯ Další"):
  Pixel art (výchozí), EGA – 16 barev (Bayerův rastr, mírně oteplené), Game Boy (4 odstíny), Rytina na
  pergamenu (inkoust / sépie / papír), Fosforový monitor (zelený s řádkováním), Drátěný model.
  - Barevné styly = přebarvení hotového snímku `prebarvi()` na konci `kresliScenu` (i efekty, čísla, nápisy);
    stejně se přebarví minimapa i velká mapa.
  - Drátěný model: raycaster si vede buffer ploch `idb` (pole × 8 + druh: podlaha, strop, 4 strany stěny, dveře)
    a světla `svb`; hrana = změna plochy vpravo/dole → obrysy zdí, dveří, mříží i mřížka podlahy a stropu.
    Jas čar je ze světla, ne z textury (spáry na okraji dlaždic jsou tmavé – mřížka pak mizela). Sprity se
    kreslí přes model a dobarví se do zelena.
  - Past: `BAYER` už v kódu byl (stínování textur) – nová matice je `RASTR`.
- **Testy:** `python3 _test/podzemi_grafika.py` 16/16 (paleta každého stylu v obraze i minimapě, snímek 2–6 ms,
  G i výběr v Nastavení), všechny ostatní sady beze změny (148/148, dotyk 17/17…).

### Etapa A – hromádky, potulné potvory, nové vyladění (29. 9. 2026)

- **Hromádky:** jídlo (podle druhu), lektvary (podle lektvaru), svitky, pochodně a ruda se skládají, nejvýš
  `MAX_HROMADKA` = 9 kusů na místo (bez limitu by se do jednoho místa vešlo 30 léčivých lektvarů). Spotřeba
  i prodej po kusu (`odeberKus`), zahození celé hromádky, na zemi se skládají také. `srovnejHromadky` běží po
  každé akci (`akce` = `akceBezUklidu` + úklid) i po načtení → uložení je vždy ve stejném tvaru a starší
  uložení se sama sloučí. UI: počet na políčku, součet v rychlé liště, „Prodat 1 z N".
- **Potulné potvory:** `SANCE_POTULNE` = 1/110 za tah, daleko (≥ 8 polí) a mimo dohled, jen do limitu patra,
  ne v obchodě/kovárně/pokladnici/za mříží/u bosse; hráč slyší jen vzdálené kroky.
- **Zjištění:** s hromádkami rozumný bot unese všechny nalezené lektvary → 66 % výprav došlo do 40. patra.
  Ani drahota lektvarů v hloubce (`DRAHOTA_LEKTVARU` 6 %/patro, ponechána – zlato má dole cenu), ani potulné
  potvory to nezměnily; rozhoduje síla potvor. **`OBTIZNOST` → hpRust 0,55 · utokRust 1,3 · presnostRust 0,02**
  (dřív 0,35 · 0,8 · 0,02). Kalibruje se teď na rozumného bota (výchozí v testu, `HLOUPY=1` = starý).
- Test: `node _test/podzemi_hromadky.js` 16/16; `podzemi_boj.js` vypisuje i medián všech výprav (přeživší = 40).

### Etapa B – kovárna (29. 9. 2026)

- **Kovář** (`mistrKovar`, vlastní sprite: zrzavý vous, zástěra, kovadlina se žhavým železem) v **kovárně**
  od 3. patra, ~15 % pater (ne u bosse). Umisťuje se až po všem ostatním s vlastní náhodou (`seed ^ 0x60A7F0`),
  takže starší uložení se po načtení postaví stejně (patro se generuje znovu ze seedu!).
- Kování: zbraně a luky +1 poškození, štít/helma/brnění/boty +1 obrana za stupeň, nejvýš **+5** (`p.kovani`,
  název „Meč +3"). Platba zlatem `70·(k+1)²·(1+0,08·patro)` (Smlouvač −20 %), nebo **železnou rudou**
  `2·(k+1)` kusů. Ruda (`surovina`, skládá se) v náhodné kořisti (~6 %), cena 15. Kování nestojí tah.
- Okno kovárny (na sobě / v batohu, cena ve zlatě i rudě, „mistrovsky ukováno"), zvuk `kovani` (dva zvonivé
  údery), značka na mapě. Bot (rozumný) kuje jednou za patro s rezervou 150 zlatých.
- Vyvážení: s původní cenou (50·(k+1)^1,7, ruda k+1) přežilo 15,7 %; po zdražení **10,3 %**, průměrná smrt
  11,2. patro, bot ukove ~4,5 stupně na výpravu.
- Testy: `node _test/podzemi_kovar.js` 14/14, `python3 _test/podzemi_kovar_ui.py` 6/6 (pozor: `?bezpotvor`
  maže i dekorace – tedy i kováře).

### Etapa C – taktika potvor (29. 9. 2026)

- **Goblin lučištník** (5.–16. patro): `strelec` + `drzOdstup` – drží se na dostřel a střílí šípy (vlastní text,
  zvuk luku, světlá střela). **Goblin šaman** (7.–22.): `leci` – každé 3 tahy vyléčí nejzraněnějšího spojence na
  dohled do 5 polí (35 % zdraví; zelené „+N" a třpyt `leceniPotvory`), drží odstup. Oba mají vlastní sprite.
- **Burcování smečky** (`smecka`: goblin, lučištník, šaman, ork): kdo tě zahlédne nebo se probudí, vzbudí druhy
  do 5 polí (událost `burcuje`, výkřik). Krysy a další samotáři ne.
- **Útěk ke skupině:** vyděšená potvora běží k nejbližšímu spojenci (ne blíž k hráči); u něj strach přejde hned.
- Bot: střelce a léčitele na dohled (do 6 polí) pronásleduje – jinak stál pod palbou.
- Vyvážení: taktiky zpřísnily patra 5–22 (bez úprav 0 % přeživších) → lučištník 0,5 / 2–6, `OBTIZNOST`
  **0,45 · 1,1 · 0,02**: medián všech výprav 10. patro, průměrná smrt 11,4., do 40. patra 4,7 %.
- Test: `node _test/podzemi_taktika.js` 10/10 (aréna 13×9 místo náhodných místností – ty bývají 3×3 až 6×5).

### Etapa D – úkoly v patře (29. 9. 2026)

- ~40 % pater od 2. (ne u bosse) dostane úkol (`zadejUkol`, vlastní náhoda `seed ^ 0x0B0C0B`, až na konci
  generování): **náčelník** (jedna ze 3 nejsilnějších potvor mimo start: 2× zdraví, +2 útok, 2× zkušenosti,
  zlatá korunka `^` nad hlavou), **ztracený deník** (předmět `ukol` na zemi v místnosti; šlápnutím splněno,
  do batohu se nedostane), **lov** (vyhub 3–6 potvor v patře, počítají se i potulné).
- Odměna: zlato (12–20 × patro + 20) a předmět o 2 úrovně lepší (bez kletby, vzácnost ≥ 1). Stav úkolu
  `s.ukol` a příznak `nacelnik` u potvory se ukládají; starší uložení = bez úkolu.
- UI: štítek 📜 v HUD, oznámení po sestupu i pádu jámou, zpráva o postupu, fanfára `ukol`.
- Vyvážení: medián 12. patro, do 40. patra 4 %. Testy: `node _test/podzemi_ukoly.js` 7/7,
  `python3 _test/podzemi_ukoly_ui.py` 3/3.

### Etapa E – klíčové předměty (29. 9. 2026)

- **Krumpáč** (6 použití): prokope zeď před hráčem (ne okraj mapy, ne páku; tajnou zeď odhalí), 5 tahů,
  hluk do 7 polí. Prokopaná pole `s.prokopano` se ukládají a po načtení (patro se generuje znovu) se vrátí.
- **Lano** (skládá se): nouzový sestup o patro bez zranění (ne u živého bosse; UI se ptá na potvrzení).
- **Lucerna** (stačí nést): pochodeň dohořívá 3× pomaleji, dohled 6 místo 5, silnější světlo, lepší šance
  všimnout si pastí a tajných dveří v chůzi (dosah 2).
- Zdroje: náhodná kořist (~3 %, lvl lano 2 / krumpáč 3 / lucerna 4), každý obchodník nabízí jeden nástroj
  (bez dalšího volání náhody generátoru – staré uložené hry sedí). Bot se lanem zachrání při nízkém zdraví.
- Vyvážení: medián 10. patro, do 40. patra 7,3 %. Testy: `node _test/podzemi_nastroje.js` 12/12,
  `python3 _test/podzemi_nastroje_ui.py` 4/4. Pozor: porty testů jiných projektů v `_test/` se kryjí
  (8187 = i `rybar_snimky.py`) – `podzemi_bot_ui.py` teď na 8287/9707.

### Etapa F – bot na denní výpravě (29. 9. 2026)

- `botDenni(datum, třída)` odehraje stejnou denní mapu se stejným povoláním (rozumný bot) po dávkách 1500 akcí
  (hra se nezasekne), nejvýš do 40. patra; výsledek v `webapp_hra_podzemi_denni_bot` (datum|třída, posledních 40).
  Spouští se na pozadí 2 s po startu denní výpravy. Epitaf: „🤖 Bot se stejným povoláním dnes došel do X. patra
  – porazil jsi ho o N pater / byl o N lepší"; síň slávy – Denní: „· 🤖 bot: X. patro".
- Test `python3 _test/podzemi_denni_bot.py` 5/5 – bot v prohlížeči dojde přesně tam co v node (deterministický).

### Etapa G – ladění stylů grafiky (29. 9. 2026)

- Barvy podle prostředí (`LADENI_PROSTREDI`): fosfor – kobky zelený, jeskyně modrozelený, doly a láva jantarový,
  krypta fialový, Podivno tyrkysový; Game Boy a rytina mají pro každé prostředí vlastní 4 / 3 odstíny.
- Fosforový monitor a drátěný model: soudkovité zakřivení obrazovky + ztmavené rohy (předpočítaná mapa
  `crtMapa`/`crtVinet`) a **dosvit luminoforu** (`dosvit`, útlum 0,72 za snímek – při pohybu stopy dohasínají).
  Při přepnutí stylu se dosvit vynuluje. Snímek stále do ~6 ms.
- Test `podzemi_grafika.py` 18/18 (i barvy fosforu v kobkách, jeskyních a lávě).

### Etapa H – hudba (29. 9. 2026)

- Generativní hudba v `podzemi_zvuk.js` na vlastním kanálu (`bus.hudba`, Nastavení → Hlasitost hudby, výchozí
  25 %, 0 = vypnuto): tichý bordun (kořen + kvinta) a řídká melodie – náhodná procházka po stupnici prostředí
  (kobky D dórská, jeskyně A pentatonika, doly E frygická, krypta C harmonická moll s „varhanami", láva
  F frygická dominantní, Podivno celotónová), basový tón každý takt. Boj (potvora tě honí do 7 polí):
  tempo až +90 %, melodie o oktávu výš, buben a činel; napětí náběh/doznění plynule (`bojCil`).
- Plánovač s předstihem (`setInterval` 200 ms, okno 0,6 s), v neaktivní záložce stojí. Poslech ověřuje uživatel.
- Test `python3 _test/podzemi_hudba.py` 15/15 (offline `zmerHudbu`: 6 prostředí × klid/boj, bez NaN,
  špička 0,3–0,72 při plné hlasitosti kanálu, v boji ~2× víc dob).

### Styl Dungeon Master (1987) (29. 9. 2026)

- Sedmý styl grafiky `dm`: vlastní textury (paleta a vzory „prostředí" `DM` – šedomodré kamenné bloky, šedé
  desky, skoro černý strop; stejné v celém podzemí jako v originále), **tma skokově po celých polích** (`TMA_DM`,
  bez barevného světla loučí), ploché stupně bez Bayerova rastru, 16 barev v duchu Atari ST (`DM16`, výběr
  nejbližší barvy i podle odstínu – jinak goblin zhnědl; tmavá zelená místo tmavé modré).
- **Pohyb po celých polích bez animace** (`tempoAnim` = 0), ostatní styly plynulé.
- Rozhraní: kamenný vystouplý rám pohledu, hranatá šedá tlačítka se šipkami, zpráva žlutě na černém
  (`body[data-grafika=dm]`).
- Test `podzemi_grafika.py` 22/22 (≤ 16 barev, rám, okamžitá otočka v DM a plynulá v ostatních).

### Styl a rozvržení „Temná fantasy" podle předlohy (29. 9. 2026)

- Osmý styl grafiky `temna`: textury prostředí `TEMNA` – velké kvádry s nasvícenou horní/levou hranou,
  mramorováním a variantou s vytesaným sloupem (`kvadry`), nepravidelné kamenné desky z buněk se spárami
  a prasklinami (`slaby`), klenutý strop s žebry (`zebra`); chladná břidlicová paleta, teplé louče.
  Úprava snímku `temnaUprava`: záře kolem světel (jasné body do mapy 1/4, rozmazat, přičíst), kontrastní
  křivka (střední tóny dolů), chladné stíny, ztmavené okraje. Snímek ~6 ms.
- Rudý **banner se jménem potvory** před tebou (do 5 polí; náčelník zlatě), počítá se při vykreslení.
- **Rozvržení** (`body.temnaUI`, jen styl temna, ne dotykový displej, okno ≥ 1000 px): vlevo inventář po
  kategoriích (Zbraně, Zbroj, Šperky, Lektvary, Jídlo, Ostatní; klik = detail v batohu) a minimapa na
  pergamenu (`naPergamen`: pozadí průhledné, zdi hnědým inkoustem, barevné značky zůstanou); uprostřed
  pohled v kamenném rámu, deník, lišta; vpravo portrét hrdiny (programově 20×20 podle povolání: rytíř
  helma a vous, zloděj kápě a šátek, mág klobouk a vousy, barbar hříva a jizva), zdraví a zkušenosti,
  výbava v ruce, rychlá lišta, akce a kamenný kříž. Přepíná se i při změně velikosti okna.
- Testy: `podzemi_grafika.py` 24/24 (i banner), `python3 _test/podzemi_temna_ui.py` 8/8 (kategorie, panely
  bez překryvu, bez rolování, portrét, klik do inventáře, vypnutí při 900 px a jiném stylu).

### Temná fantasy ve vysokém rozlišení, „malovaný" pixel art (29. 9. 2026)

- `nastavDetail(hd)`: Temná fantasy kreslí **512×384** (K = 2), ostatní styly 256×192. RW/RH/TS jsou
  proměnné; buffery (`obraz`, `buf`, `idb`, `svb`, `zbuf`) a předpočty (CRT, vineta, dosvit) se založí znovu.
  Pixelové prvky (nápisy, zbraň v ruce, pruhy a značky nad potvorami, čísla) se násobí `K`.
- Textury 64×64: zdi, zeď se sloupem, tajná zeď, podlaha a strop malované nativně (`malovaneTextury`) –
  rampy s posunem odstínu (stíny do modrofialova, světla do okrové), zkosené kvádry, stopy dláta, otlučené
  rohy, mech ve spárách, kanelovaný sloup, desky s nasvícenou hranou, klenba se žebry. Ostatní textury
  (dveře, schody, pasti, louče, páka, mříž) a **sprity potvor** zvětšuje **Scale2x (EPX)** – zaoblí šikminy;
  sprity navíc dostínuje (hrana na světle, spodek ve stínu). Zbraň v ruce také Scale2x.
- Výkon: bez úprav 25 ms/snímek → kontrastní křivka tabulkou a světlo jednou za 2 px (podlaha) / 2 řádky
  (stěny) → **14 ms**. Test `podzemi_grafika.py` 26/26 (HD mez 20 ms, rozlišení 512×384 vs. 256×192).

## Další náměty

- záznam výpravy a přehrání (hra je deterministická podle seedu – stačí uložit tahy) – uživatel zatím nechtěl

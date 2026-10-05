# 🏰 Síně pod horou: popis hry s pohledem shora

*Návrh nové hry, verze 5. 10. 2026. Vychází z popisu bočního řezu „Srdce hory“ (`Trpaslici_POPIS.md`).
Pravidla, která zůstávají stejná, jsou zde jen shrnutá. Podrobně je popsáno to, co se kvůli pohledu
shora mění. Kódová jména souborů a jmenného prostoru jsou návrh.*

Síně pod horou jsou budovatelská strategie **s pohledem shora** v malovaném stylu fantasy map.
Klan trpaslíků přichází roklí k opuštěné hoře předků. Tesá síně, chodby a dílny do skály po
**patrech** směrem dolů, zakládá tržiště v rokli, přežívá zimy, obchoduje s karavanami a brání se
goblinům a tvorům z hlubin. Cíl kampaně zůstává: v nejhlubším patře najít **Srdce hory**, ukovat
Klíč z hvězdné oceli a zažehnout **Výheň předků**, aniž by se předčasně probudil **Pradávný spáč**.

Řízení je stejné jako v bočním řezu. Je nepřímé: hráč označuje, co vytesat, kde postavit stavbu nebo
zónu, zadává zakázky a nastavuje priority prací. Trpaslíci si práci berou sami.

---

## Obsah

1. [Hlavní rozhodnutí](#1-hlavní-rozhodnutí)
2. [Co se mění oproti bočnímu řezu](#2-co-se-mění-oproti-bočnímu-řezu)
3. [Grafika podle předlohy](#3-grafika-podle-předlohy)
4. [Svět: rokle, hora a patra](#4-svět-rokle-hora-a-patra)
5. [Začátek hry](#5-začátek-hry)
6. [Pohyb, cesty a spojení pater](#6-pohyb-cesty-a-spojení-pater)
7. [Tesání, chodby, kácení](#7-tesání-chodby-kácení)
8. [Místnosti: uzavřené prostory](#8-místnosti-uzavřené-prostory)
9. [Stavby](#9-stavby)
10. [Dílny a výroba](#10-dílny-a-výroba)
11. [Zóny, sklady a nošení](#11-zóny-sklady-a-nošení)
12. [Jídlo, pití, farmy](#12-jídlo-pití-farmy)
13. [Potřeby, zdraví a nálada](#13-potřeby-zdraví-a-nálada)
14. [Příroda hory: stabilita, voda, magma, světlo](#14-příroda-hory-stabilita-voda-magma-světlo)
15. [Sláva, karavana, tržiště, migranti, události](#15-sláva-karavana-tržiště-migranti-události)
16. [Tvorové, boj a obrana](#16-tvorové-boj-a-obrana)
17. [Nájezdy](#17-nájezdy)
18. [Příběh, Spáč a finále](#18-příběh-spáč-a-finále)
19. [Rozhraní a ovládání](#19-rozhraní-a-ovládání)
20. [Zvuk](#20-zvuk)
21. [Technické řešení](#21-technické-řešení)
22. [Postup vývoje po etapách](#22-postup-vývoje-po-etapách)
23. [Otevřené otázky](#23-otevřené-otázky)

---

## 1. Hlavní rozhodnutí

| | |
|---|---|
| Pohled | **shora (ortogonálně)**, jedno patro na obrazovce, ostatní patra se přepínají |
| Hloubka | **patra**: povrch (rokle a úbočí) + 8 podzemních pater po 20 m, celkem 160 m jako v bočním řezu |
| Mapa patra | malá 64 × 64, střední 96 × 96, velká 128 × 128 polí; na všech patrech stejná |
| Gravitace | žádná v patře; svislý pohyb jen schodištěm, šachtou s rumpálem nebo pádem do díry |
| Grafika | **malovaný styl bojových map** (viz [3](#3-grafika-podle-předlohy)) místo pixel artu: měkké světlo svící, kamenné dlaždice, skalní útesy se stínem, tmavá prázdnota kolem |
| Čas | reálný s pauzou, ⏸ / 1× / 2× / 4×, 10 tahů za sekundu, den 600 tahů, rok 48 dní |
| Režimy | kampaň a volný režim, stejně jako v bočním řezu |
| Klan | 7 trpaslíků na začátku, nejvýš 40 |
| Determinismus | hora i simulace ze seedu; logika bez DOM testovatelná v node |

**Proč patra, a ne jedna velká plocha:**
- Hloubka je v původní hře hlavní osa hry: vrstvy hornin, rudy, neklid hory, pásmo Spáče. Patra ji zachovají srozumitelně („železo je ve 3. patře“).
- Jedno patro se vejde na obrazovku v přiblížení předlohy, takže malovaná grafika zůstane čitelná.
- Výkon: 9 pater × 96 × 96 = 83 tisíc polí, simulace běží naplno jen v patrech, kde jsou trpaslíci nebo tvorové.

---

## 2. Co se mění oproti bočnímu řezu

| oblast | boční řez | pohled shora |
|---|---|---|
| hloubka | řádky mapy (1 pole = 1 m) | patra po 20 m; vrstva horniny je vlastnost patra s místními odchylkami |
| pohyb v rovině | chůze po podlaze, schody, přeskoky | volná chůze 8 směry, A* bez gravitace |
| svislý pohyb | schodiště, žebřík, výtah v šachtě | **schodiště mezi patry** (vytesané), **šachta s rumpálem** (výtah), **díra** (pád o patro) |
| pády | seskok až 3 pole, zranění od 4 | pád jen dírou o patro: −30 zdraví, utonutí ve vodě níž možné |
| kopání | do stran, nahoru, dolů | jen v rovině do sousedního pole; dolů jen schodištěm nebo šachtou |
| místnost | obdélníková zóna | **uzavřený prostor** ohraničený stěnami a dveřmi (zjišťuje se automaticky) |
| stabilita stropu | rozpětí v řádku pod stropem | **vzdálenost od opory**: každé pole síně musí být do R polí od stěny nebo sloupu |
| podpěra | trám pod strop | **sloup** (kamenný, dřevěný) uprostřed síně |
| voda | padá a vyrovnává hladiny v řezu | rozlévá se v rovině, protéká dírami a schodišti do nižšího patra |
| světlo | louče, zdi stíní | louče, svícny, ohně; **stínování přes zorné pole** v rovině |
| viditelnost | sousedé vykopaného | mlha války na každém patře; co trpaslík jednou viděl, zůstane zakreslené |
| povrch | údolí vlevo od hory | **rokle** s cestou, potokem, mostem a lesem; brána do hory v jejím boku |
| obchod | vůz před bránou | **tržiště** v rokli se stany a stánky (jako na předloze vlevo dole) |
| grafika | pixel art 16/32 px | malovaná mapa 64 px na pole (viz níže) |

Beze změny zůstávají (jen s jinými místy na mapě):
- profese, dovednosti, stupně priority, 🎯 pracoviště, nouzové priority,
- recepty, nástroje, opotřebení,
- potřeby, vzpomínky, nálada, přepych, přátelé, záchvaty a odchody,
- sláva a milníky, karavana a ceny, migranti, události s volbou,
- tvorové, zbraně a zbroj, výcvik, poplach, druhy nájezdů,
- runové desky, artefakty, Klíč, kusovník, finále se Spáčem a vlnami pavouků,
- „Co dál?“, volný režim a jeho cíle, rekordy, ukládání a offline.

---

## 3. Grafika podle předlohy

Předloha je malovaná bojová mapa ve stylu stolních fantasy her. Obrázek slouží jen jako **stylová
reference**: hra ho nekopíruje ani nepoužívá, vše se kreslí v kódu nebo z vlastních podkladů.

### Co z předlohy přebíráme

| prvek předlohy | ve hře |
|---|---|
| černomodrá prázdnota s jemným šumem a hvězdičkami kolem skály | **nevykopaná a neprozkoumaná hora**; vykopané prostory „září“ z temnoty |
| skalní okraje jeskyní: vrstvené hřbety, světlá horní hrana, tmavý stín dovnitř | **okraj tesaného prostoru**: nepravidelná linie stěny, 3–4 tónové pruhy, vržený stín na podlahu |
| šedé dlaždice a kvádry v pravoúhlých síních, kamenné zdi s rohovými pilíři | **otesané místnosti**: otesáním se z jeskyně stane síň s dlažbou a zdí |
| šachovnicová podlaha, dřevěná prkna, koberce, kruhová mozaika | **podlahy** jako stavba (dlažba, šachovnice, prkna, koberec, mozaika); zvyšují kvalitu místnosti |
| hrubá kamenitá podlaha jeskyní s kamínky a prachem | **surová podlaha** vytesaných chodeb |
| postele s červenými pokrývkami, stoly, lavice, sudy, bedny, police, truhly | **nábytek a věci** jako samostatné malované sprity |
| oltář s mozaikou a schody do apsidy | **Síň předků** a **Srdce hory** (ruiny ve stejném stylu) |
| rokle s cestou, trávou, stromy, balvany a útesy | **povrch** |
| dřevěný most se strážními věžemi přes rokli | **brána a most** jako stavba obrany (mříž, věže pro lukostřelce) |
| stany a barevné slunečníky | **tržiště karavany** a stanový tábor migrantů |
| podzemní jezírko s mólem a balvany | **podzemní jezero**, studna, rybaření (nové) |
| teplé body světla (svíce, lucerny) s měkkou září, okolí tmavé | **světlo**: louče, svícny, ohně dílen; tma mimo dosah |
| žebříky a dřevěné lávky přes trhliny | **lávka** přes díru nebo vodu (nová stavba) |

### Technika kreslení
- **Měřítko:** pole 64 × 64 px při přiblížení 1:1 (jako mřížka bojové mapy, mřížka se ale nekreslí, jen při stavění). Zoom 0,25–2.
- **Vrstvy kreslení (zdola):**
  1. prázdnota: tmavý gradient se šumem a hvězdičkami (předkreslená textura),
  2. podlaha: textura podle druhu (surová skála, dlažba, prkna…) s variantami podle seedu pole, prolnutá na hranách,
  3. stín stěn na podlaze: rozmazaná maska okraje (ambient occlusion),
  4. stěny: okraj prostoru jako **vektorová obrysová křivka** (marching squares + zašumění) vykreslená v několika posunutých tazích (tmavý základ, střední skála, světlá hrana) – tak vzniknou vrstvené útesy z předlohy; u otesaných místností rovná zeď z kvádrů s pilíři v rozích,
  5. objekty a nábytek: malované sprity s vlastním vrženým stínem,
  6. trpaslíci a tvorové: malované figurky shora/šikmo (hlava, vousy, ramena, nástroj), 8 směrů nebo otáčení sprite,
  7. světlo: multiplikativní vrstva tmy s aditivní teplou září zdrojů,
  8. částice: prach, jiskry, kouř, kapky,
  9. značky práce, náhledy staveb, výběr.
- **Předkreslení po blocích:** statické vrstvy 1–4 se kreslí do bloků 16 × 16 polí a překreslí se jen při změně tvaru prostoru. Za snímek se kreslí jen pohyblivé věci a světlo (cíl: snímek do 6 ms při střední hoře).
- **Zdroje obrázků:** dvě cesty, rozhodne uživatel (viz [23](#23-otevřené-otázky)):
  - A) vše procedurálně v kódu (textury šumem, nábytek kreslený cestami Canvasu s gradienty) – žádné soubory navíc, styl jednodušší,
  - B) atlas malovaných spritů (vlastní nebo generované obrázky, jako u ilustrací v Srdci hory) pro nábytek, figurky a dílny; terén dál procedurálně.
- **Denní doba a roční období:** povrch se v noci zbarví do modra, v zimě sníh na rokli, zamrzlý potok, holé stromy.
- **Tma podzemí** zůstává hlavním výrazovým prostředkem: osvětlená síň s teplou září uprostřed temné hory, přesně jako v předloze.

---

## 4. Svět: rokle, hora a patra

### Patra
Každé patro má stejný půdorys mapy (např. 96 × 96). Patro 0 je povrch, patra 1–8 podzemí.

| patro | hloubka | převládající hornina | tvrdost | dosah opory R | co tam je |
|---|---|---|---|---|---|
| 0 povrch | – | hlína, skalní útesy | – | – | rokle, cesta, potok, most, les, louky, místo pro tržiště, Brána předků ve skalní stěně |
| 1 | 0–20 m | hlína, jíl | 1 | 2 | snadné tesání, jíl, mělké uhlí |
| 2 | 20–40 m | vápenec | 2 | 3 | uhlí, krápníkové jeskyně, prameny |
| 3 | 40–60 m | vápenec / žula | 2–4 | 3–5 | uhlí, první železo a měď |
| 4 | 60–80 m | žula | 4 | 5 | železo, měď, jeskyně s pavouky, strážnice |
| 5 | 80–100 m | žula / čedič | 4 | 4–5 | zlato (zaručená žíla), stříbro |
| 6 | 100–120 m | čedič | 4 | 4 | drahokamy, houbové jeskyně, podzemní jezero, **Síň předků** |
| 7 | 120–140 m | čedič / hlubinný kámen | 4–5 | 4 | hvězdná ruda (zaručeno ≥ 10 kusů), hlubinné jeskyně; **od 130 m hora duní** |
| 8 | 140–160 m | hlubinný kámen | 5 | 4 | magma, goblinní tunel, **Srdce hory**; celé patro je **pásmo Spáče** |

- Hornina se v patře mění plynule šumem, takže i v jednom patře jsou ostrovy jiné horniny a rudné žíly jako klikaté pruhy.
- **Pásmo Spáče:** tesání v patře 8 bez Klíče Spáče probudí (dříve hranice 138 m). Patro 7 je „pásmo duní“ s varováním. Schodiště z 7. do 8. patra chce potvrzení.
- Rudy, jeskyně, ruiny a zaručené žíly zůstávají s počty z bočního řezu; patro se vybírá podle hloubkového rozsahu rudy.

### Povrch (patro 0)
- **Rokle** prochází mapou od jižního okraje k severu. Uprostřed je prašná cesta, kolem tráva, keře, jedle, balvany a skalní útesy.
- **Potok** teče roklí. Přes rokli vede **most**, na začátku hry polorozpadlý; opravit ho jde jako stavbu.
- **Brána předků** je ve skalní stěně rokle. Předsíň za ní leží **v úrovni povrchu uvnitř skály** (patro 0 má kolem rokle i skalní masiv hory). Z předsíně vede schodiště dolů do 1. patra.
- Na povrchu je tedy dvojí terén: otevřená rokle (les, pole, tržiště, cesta pro karavany a nájezdníky) a skalní masiv, do kterého jde tesat i v patře 0 (první místnosti těsně za branou, jako na předloze).
- Nájezdníci i karavany přicházejí po cestě z okraje mapy.

### Zvláštní místa (umístění v patrech)
| místo | patro | podoba |
|---|---|---|
| krápníkové jeskyně | 2–3 | nepravidelné jeskyně s krápníky (sloupky) |
| obyčejné jeskyně | 3–4 | pavouci, netopýři |
| strážnice | 3–5 | malá ruina 9 × 7 s deskou |
| houbové jeskyně | 6 | obří houby, vlhko |
| podzemní jezero | 6 | voda s balvany, molo jde postavit |
| Síň předků | 6 | ruina 19 × 13 se sloupořadím, oltářem s mozaikou, deskou a pokladem |
| hlubinné jeskyně | 7–8 | krystaly, pavouci |
| magmatické kapsy | 8 | magma, obsidián na okraji |
| goblinní tunel | 8 (vede z okraje mapy) | 2 pole široký tunel |
| Srdce hory | 8 | kruhová síň z runové zdi s Výhní předků uprostřed (apsida a mozaika jako na předloze) |

---

## 5. Začátek hry

- 7 trpaslíků (2 horníci, kameník, tesař, kovář, sládek, farmář) stojí na cestě v rokli před Branou předků.
- Zásoby: 6 polen, 30 jídel, 30 piv, 2 měděné krumpáče (zhruba na 5 dní).
- Výchozí sklad: předsíň za branou (vytesaná síň 6 × 4 se zdivem předků).
- Hra začíná v pauze, pohled na bránu.

---

## 6. Pohyb, cesty a spojení pater

### Pohyb v patře
- Trpaslík chodí **8 směry** po volných polích. Šikmo jen tehdy, když obě sousední rovné cesty nejsou stěna (neprochází rohem).
- Doby: rovně 4 tahy, šikmo 6 (≈ 4 × √2), s nákladem +1, hustá vegetace, mělká voda a suť +2.
- Hledání cest: A* s heuristikou oktilové vzdálenosti, mezipaměť oblastí (souvislé komponenty patra), zneplatnění jen v okolí změny.

### Spojení pater
| spojení | stavba | doba přechodu | poznámka |
|---|---|---|---|
| **schodiště** | vytesá se do skály (nástroj ⛰️ schody) na pole, kde v patře pod ním je pevná skála | 12 tahů na patro | horní pole „dolů“, dolní pole „nahoru“; zadarmo, jen tesání |
| **šachta s rumpálem** (výtah) | 1 🪵 na patro, po tesařské dílně | 3 + 4 tahy na patro | rychlá doprava materiálu do hloubky; tvorové jí nejezdí |
| **díra** | vznikne vytesáním podlahy (nástroj kopat do hloubky) nebo zřícením | pád o patro | jen dolů; −30 zdraví; věci padají také |
| **žebřík do díry** | 1 🪵 | 10 tahů na patro | nouzové spojení, záchrana uvízlých |

- Hledání cest mezi patry pracuje nad grafem „patro → spojovací pole“ (předpočítané vzdálenosti mezi spoji v patře), takže cesta přes 5 pater nestojí 5 plných A*.
- Kdo spadne dírou a nemá cestu nahoru, **uvízl** (stejné záchranné mechanismy jako v bočním řezu: hra naplánuje schodiště nebo žebřík).

### Voda a brod
- Mělký potok jde brodit (+2 tahy). Hluboká voda (jezero) je neprůchozí, pokud tam není lávka nebo molo.

---

## 7. Tesání, chodby, kácení

- **⛏️ Kopat:** tažením obdélníku nebo štětcem (volný tvar) se označí pole k vytesání. Trpaslík tesá **sousední pole** (8 směrů, šikmo jen bez rohu).
- **Doba tesání:** stejný vzorec jako v bočním řezu (14 × tvrdost, ruda ×1,3, tvrdá skála bez železného krumpáče ×1,8, dovednost, nálada, krumpáč).
- **Co padá:** stejné pravděpodobnosti (kámen 35 %, zdivo 60 %, ruda vždy, jíl 50 %, hlína nic).
- **⛰️ Schody:** označí pole pro schodiště do nižšího patra. Trpaslík vytesá horní i dolní pole. V nižším patře pak vznikne malá prostora 1 pole.
- **🕳️ Díra:** označí podlahu k proražení do nižšího patra (pro šachtu s rumpálem, odvodnění, pasti). Potvrzuje se.
- **🧱 Otesat:** surová jeskyně → **otesaná síň**: rovné zdi z kvádrů, podlaha z kamenné dlažby. Ruda ve stěně se vytěží. Hlína stojí 1 kámen. Tesá přednostně kameník. Otesání mění grafiku z „jeskyně“ na „síň“ (jako levá a pravá strana předlohy).
- **⭐ Přednost, ✖️ Zrušit:** beze změny.
- **🪓 Kácet:** jedle (3 polena, pařez doroste za 4 dny), obří houby (2 houby + 2 polena), trvalá značka.

---

## 8. Místnosti: uzavřené prostory

Pohled shora umožní to, co boční řez nedovolil: **skutečné místnosti**.

- **Místnost** je souvislá oblast podlahy ohraničená stěnami, dveřmi, mříží nebo okrajem otesané síně. Hra ji najde sama (vyplňování od pole, dveře jsou hranice), nejvýš 400 polí.
- **Účel místnosti** určí hráč zónou (ložnice, jídelna, ošetřovna…) a nábytek. Zóna může ležet i v neuzavřeném prostoru, ale uzavřená místnost má bonusy:

| vlastnost | vliv |
|---|---|
| uzavřená (dveře) | kvalita +2, teplo v zimě (žádné „mrzne“), méně hluku (spánek nerušený provozem) |
| otesaná (≥ 60 % zdí) | kvalita +2 |
| podlaha (dlažba / prkna / koberec / mozaika) | kvalita +1 / +1 / +2 / +3 |
| sochy (až 2) | +2 za kus |
| kamenný nábytek | +2 |
| osvětlení (průměr ≥ 0,5) | +1, pod 0,2 „ponurá“ −2 |
| velikost na osobu | ložnice ≥ 4 pole na postel, jídelna ≥ 3 pole na židli; méně = „stísněná“ −2 |

- **Kvalita místnosti** (0–15) se ukazuje v detailu zóny jako slovní stupeň: ubohá, prostá, slušná, pěkná, nádherná, legendární. Vzpomínky po jídle a spánku se řídí kvalitou stejně jako v bočním řezu.
- **Osobní ložnice** (nové): místnost s jednou postelí se dá přidělit trpaslíkovi. Vlastní pokoj +3 nálady (místo společného „každý má svou postel“).

---

## 9. Stavby

Stavby se plánují, materiál se donese, pak se postaví. Náhled stavby pod myší se otáčí klávesou **R** (dílny 2 × 2 nebo 3 × 2 polí mají orientaci).

| skupina | stavba | cena | rozměr | poznámka (změna proti bočnímu řezu) |
|---|---|---|---|---|
| **Chodby a patra** | ⛰️ schodiště | zadarmo (tesání) | 1 | spojuje patra |
| | 🛗 šachta s rumpálem | 1 🪵 / patro | 1 | výtah mezi patry |
| | 🪜 žebřík do díry | 1 🪵 | 1 | |
| | 🌉 lávka / molo | 2 🪵 | 1 | přes díru, vodu nebo magma (magma ji spálí) |
| | 🏛️ sloup | 2 🪨 (dřevěný 2 🪵) | 1 | **nahrazuje podpěru**: opora stropu v síni |
| | 🔥 louč / 🕯️ svícen | 1 🪵 / 1 železný prut | 1 (na stěnu / na zem) | světlo 7 / 6 polí; svícen nezhasne vodou ani průvanem |
| | ⛲ pumpa | 3 🪵 | 1 | odčerpá vodu do 3 polí |
| | 🧱 zeď | 1 🪨 | 1 | dělí prostory, tvoří místnosti |
| | 🟫 podlaha (dlažba, prkna, šachovnice, koberec, mozaika) | 1 🪨 / 1 🪵 / 1 🪨 / 1 hedvábí / 1 drahokam za 2 pole | 1 | kvalita místnosti |
| **Jídlo a pití** | 🍲 kuchyně | 2 🪵 | 2 × 2 | svítí |
| | 🍺 pivovar | 3 🪵 | 2 × 2 | |
| | 🪣 studna | 4 🪨 + 1 🪵 | 1 | na vodě nebo nad vodou v nižším patře |
| | 🎣 molo k rybaření | 2 🪵 | 1 × 2 | nové: ryby z jezera (jídlo), 1 ryba za 200 tahů |
| **Nábytek** | 🛏️ postel, 🍽️ stůl, 🪑 židle / lavice, 🗿 socha, 📦 truhla, 🛢️ sud | z dílen | 1–2 | truhla a sud = malý sklad 8 věcí uvnitř místnosti |
| **Dílny** | 🪚 tesařská, 🪨 kamenická, 💎 brusírna | jako dříve | 2 × 2 | |
| **Kovy a oheň** | ♨️ milíř, 🔥 tavírna, ⚒️ kovárna, 🌋 magmatická výheň, ✴️ runová kovárna | jako dříve | 2 × 2 (runová 3 × 3) | |
| **Obrana** | 🚪 dveře | 1 🪵 | 1 | uzavírají místnosti; goblin vyrazí na 8 ran, troll na 3 |
| | 🚧 padací mříž | 2 železné pruty | 1 | zavřená nepustí nikoho |
| | 🪤 past | 2 🪨 + 1 železný prut | 1 | 25 ♥, napne se za 300 tahů |
| | 🏹 střílna / strážní věž | 4 🪨 + 2 🪵 | 2 × 2 | nové: strážce z ní střílí kuší přes zeď (dosah 6) |
| | 🛡️ zbrojnice | 2 🪨 + 2 🪵 | 2 × 2 | výcvik |
| | 🌉 most s věžemi | 8 🪵 + 4 🪨 | přes rokli | oprava mostu na povrchu; brána mostu = mříž |
| **Tržiště** | ⛺ stánek | 3 🪵 + 1 hedvábí | 2 × 2 | nové: každý stánek přidá karavaně 1 druh zboží a +5 % výkupu |

---

## 10. Dílny a výroba

- Recepty, doby, trvalé zakázky „udržuj 20“ u kuchyně a pivovaru, 2 pracoviště v dílně, pořadí zakázek, příběhové zakázky a kusovník Klíče: **beze změny** (viz `Trpaslici_POPIS.md`, kap. 9).
- Nové recepty kvůli pohledu shora:

| dílna | recept | doba |
|---|---|---|
| 🪨 kamenická | kámen → dlažba (2 pole), kámen → sloup | 30 / 60 |
| 🪚 tesařská | dřevo → lavice, truhla, sud, prkna (2 pole) | 50 / 50 / 50 / 30 |
| ⚒️ kovárna | železný prut + uhlí → svícen, kuše; prut + 4 dřeva → šípy (20) | 60 / 100 / 60 |
| 💎 brusírna | drahokam → mozaika (2 pole) | 120 |
| 🧵 tkalcovna (nová, 2 🪵) | 2 hedvábí → koberec; hedvábí → stanové plátno | 80 / 60 |

- Dílna má **vstupní a výstupní stranu** (orientace). Materiál se pokládá na vstupní pole, hotový výrobek na výstupní. Na mapě je tak vidět, co se v dílně děje.

---

## 11. Zóny, sklady a nošení

- Zóny se kreslí obdélníkem nebo štětcem, nově i **„vyplnit místnost“** (klik do uzavřené místnosti).

| zóna | kde | poznámka |
|---|---|---|
| 📦 sklad | kdekoli volné | 4 věci na pole, filtr, ⭐ přednostní; truhly a sudy v místnosti jako malé sklady |
| 🛏️ ložnice | v hoře | postele; společná nebo osobní |
| 🍽️ jídelna | v hoře | stoly, židle, lavice |
| 🌾 pole ječmene | povrch, louka v rokli | 2 snopy z pole |
| 🍄 houbárna | v hoře na surové podlaze | 1 houba, u vody rychleji |
| 🌲 lesní školka | povrch / v hoře | jedle / obří houby |
| 🩹 ošetřovna | v hoře | hojení 3× |
| ⛺ tábořiště (nové) | povrch | migranti a hosté tu přespí, než dostanou postel |

- Nošení a pořadí cílů: beze změny. Mezi patry se nosí po schodech nebo šachtou; šachta má přednost pro náklad (rumpál unese 4 věci najednou).

---

## 12. Jídlo, pití, farmy

Beze změny proti bočnímu řezu (hodnoty jídla, piva, vody, ledu, růst polí a houbáren, cíle zásob, bilance, předpověď zimy). Nově:
- **Rybaření** z mola na podzemním jezeře nebo v potoce (ryba = jídlo bez kuchyně +40, s kuchyní 2 porce; v zimě jen pod zemí).
- **Studna** jde postavit i nad vodou v nižším patře (vrtaná studna přes patro).

---

## 13. Potřeby, zdraví a nálada

Úbytky potřeb, prahy, léčení, vzpomínky, návyk, přepych, přátelé, záchvaty vzteku a odchody: beze změny. Změny:
- **Kvalita místností** podle [8](#8-místnosti-uzavřené-prostory) nahrazuje počítání otesaného pozadí.
- **Vlastní pokoj** +3 nálady.
- **„Mrzne“** platí na povrchu v zimě a v neuzavřených prostorách 1. patra, které sousedí s povrchem.
- **Hluk:** spánek v místnosti, kterou prochází frekventovaná cesta nebo vedle dílny bez dveří, je pomalejší (×0,8) a dá vzpomínku „rušili ho při spánku“ −2.
- **Pád dírou** −30 zdraví.

---

## 14. Příroda hory: stabilita, voda, magma, světlo

### Stabilita (pohled shora)
- Každé vytesané pole podlahy musí mít **oporu do R polí** (podle horniny stropu, tabulka v [4](#4-svět-rokle-hora-a-patra)). Oporou je stěna, sloup nebo nevytesaná skála.
- Přírodní jeskyně drží vždy.
- Síň, jejíž střed je dál než R od opory, **praská** (prach, varování s místem a odpočtem) a po **600 tazích** se zřítí: pole bez opory se zasypou sutí, zasypaní ztratí 35 zdraví, stavby zaniknou. Část suti propadne dírami do nižšího patra.
- Nástroj kopat ukazuje během tažení kruhy dosahu opory a „⚠️ potřebuje sloupy“ / „✅ strop vydrží“. Sloupy jde naplánovat do pole označeného k vytesání.
- Sloupořadí v síních (jako ve Síni předků na předloze) je tedy herní nutnost i ozdoba.

### Voda
- Buněčný automat v rovině: jednotka vody teče k nejnižšímu sousednímu poli podle hloubky vody a vyrovnává hladinu v tělese.
- **Svisle:** voda padá dírou, šachtou i schodištěm do nižšího patra. Zatopit se tak dá celé spodní patro.
- Dveře a zdi vodu nepustí. Pramen (vápenec, 1,5 %), pumpa, studna, led na povrchu v zimě: beze změny.
- Trpaslík ve vodě hlubší než 1 plave, ztrácí zdraví a může se utopit.

### Magma
- Pomalejší automat ve stejném duchu. Spálí věci, dřevo a trpaslíky, s vodou ztuhne na obsidián.

### Světlo
- Zdroje: louč 7 polí, svícen 6, ohně dílen 4, hořící Výheň 12, denní světlo na povrchu (v hoře proniká branou a dírami do 4 polí).
- **Zorné pole:** světlo se šíří paprsky (shadowcasting po oktantech), takže sloupy a rohy vrhají stíny. Výsledek se rozmaže pro měkký vzhled.
- Nálada „pracuje ve tmě“ pod 0,2 zůstává. Lampa předků dá celé hoře aspoň 0,4.

### Viditelnost
- Mlha války po patrech: trpaslík vidí do 8 polí po zorném poli. Viděné zůstává zakreslené (šedě, bez tvorů).
- Vytesáním do jeskyně se odhalí celá jeskyně a probudí její tvory (beze změny).

---

## 15. Sláva, karavana, tržiště, migranti, události

- **Sláva a milníky** 120 / 200 / 250 / 330 / 500 / 650: beze změny; do slávy navíc počítá kvalita místností (+1 za každou „nádhernou“).
- **Karavana** přijíždí po cestě roklí 8. den jara a 6. den podzimu a zůstane 2 dny. Vozy zastaví na **tržišti**:
  - bez stánků zastaví u brány,
  - každý ⛺ stánek přidá jeden druh zboží navíc a +5 % výkupu (nejvýš 4 stánky),
  - zboží se skládá na tržiště; prodávané se z něj odnáší (nebo hned zmizí ze skladu jako dříve – viz otázky).
- **Okno obchodu** a ceny beze změny.
- **Migranti** přicházejí po cestě a utáboří se na tábořišti, dokud nepřijmeš. Počet podle slávy a volných postelí jako dříve.
- **Události** beze změny, ilustrace v novém malovaném stylu.

---

## 16. Tvorové, boj a obrana

- Tvorové a jejich hodnoty (netopýr, pavouk, goblin, lukostřelec, troll, Spáč): beze změny. Pohyb shora:
  - netopýr létá nad dírami a vodou,
  - pavouk leze i přes díry (po stropě), chodí přes vodu po síti,
  - goblin a troll chodí; troll se nevejde do chodby široké 1 pole (nové – úzké chodby jsou obrana).
- **Boj:** úder do sousedního pole (8 směrů) jednou za 10 tahů; vzorce útoku, zbraní, zbroje a výcviku beze změny.
- **Střelba (nové):** lukostřelci a strážci s kuší střílí na **zorné pole** do 6 polí (lukostřelec gobliní 3 → 5). Sloupy, stěny a zavřené dveře kryjí. Šíp je vidět.
- **Strážci, civilisté, úkryt, poplach:** beze změny, jen úkryt hledá **uzavřenou místnost s dveřmi**, pokud existuje.
- **Obrana:** dveře, mříž, past, zbrojnice; nově střílna/věž a most s věžemi. Úzké chodby a pasti v nich jsou hlavní obranná taktika.

---

## 17. Nájezdy

- Načasování (první 36. den, pak 18–26 dní), síla, lákadlo slávy, lukostřelci, trollové, druhy (útok, loupež, obléhání, podkop), varování den předem a předpověď: **beze změny**.
- **Odkud:** po cestě roklí od okraje mapy (přes most, pokud stojí), z odkrytého goblinního tunelu v 8. patře, nebo podkopem v nejhlubším obydleném patře.
- **Obléhání** se odehrává v rokli: tlupa táboří na cestě a lukostřelci střílí na vše v dosahu.
- **Opravený most s mříží** zastaví útok v rokli (goblini musí obejít útesy, troll most rozbíjí).

---

## 18. Příběh, Spáč a finále

- Runové desky (strážnice, Síň předků), úlomky příběhu, runová kovárna, hvězdná ocel, artefakty, volba dvojice, Klíč po 2 ze 3 artefaktů, kusovník a vodítko 🧭: **beze změny**. Vodítko ukazuje i patro („Ruiny předků leží v 6. patře, na západ od …“).
- **Spáč:** varování v 7. patře („hora duní“), předčasné probuzení tesáním v 8. patře bez Klíče nebo objevením Srdce bez Klíče, neklid +0,3.
- **Finále:** zažíhání 1 den, dvě vlny pavouků z puklin Srdce, odolnost Spáče podle útoku strážců, nájezd počká; vítězství a prohra jako dříve. Srdce je kruhová síň: obrana se staví do prstence kolem Výhně, vchody jsou úzké.

---

## 19. Rozhraní a ovládání

Rozvržení jako v Srdci hory: horní lišta se zásobami a časem, mapa s minimapou, pravý panel se záložkami 🧭 Přehled · 🔍 Výběr · 🧔 Klan · 📦 Sklad · 📜 Deník · 🔥 Příběh · ❓ Pomoc. Změny:

- **Přepínač pater** vedle mapy: svislý pruh s patry 0–8, u každého ikony (⚔️ nepřátelé, 🧔 počet trpaslíků, ⚠️ problém), klik přepne patro.
- **Pohled o patro výš** se kreslí jako slabý obrys (kde jsou schody a díry), aby šlo plánovat napojení.
- **Minimapa** ukazuje aktuální patro, malé náhledy ostatních pater pod ní.
- Oznámení a 📍 skok na místo přepnou i patro.

| akce | myš / dotyk | klávesa |
|---|---|---|
| posun | tažení, pravé tlačítko, dva prsty | šipky, WASD |
| zoom | kolečko, štípnutí | `+` `-` |
| patro výš / níž | přepínač pater | PgUp / PgDn, `<` `>` |
| otočit stavbu | | R |
| kopat / schody / díra | tažení / štětec | K / L / H |
| přednost / kácet / otesat | tažení | P / C / O |
| stavět / zóny / zrušit | paleta | B / Z / X |
| pauza, rychlosti | | mezerník, 1 / 2 / 3 |
| skok na bránu | 🏠 | Home |

Menu: režim, velikost hory, seed a hora dne, soubory, rekordy, grafika (kvalita: plná / úsporná bez stínů a částic), efekty, zvuk.

---

## 20. Zvuk

Syntetizované zvuky a hudba jako v Srdci hory. Nově: ozvěna podle velikosti místnosti (velká síň zní dutě), zvuky z jiných pater ztlumené, šum potoka a větru v rokli, tržiště (hlasy jako šum, cinkání).

---

## 21. Technické řešení

- **Soubory:** `obsah/sine.html` + `obsah/sine/*.js`, jmenný prostor `globalThis.SIN` (obyčejné skripty, funguje přes `file://`).
- **Převzetí kódu ze Srdce hory:** logiku bez prostoru jde přenést téměř beze změny (`potreby.js`, `obdobi.js`, `udalosti.js`, `pribeh.js`, recepty ze `stavby.js`, části `hrozby.js`, `ulozeni.js`, výběr práce a priority z `hra.js`). Nově se píše prostorová část:

| soubor | obsah |
|---|---|
| `svet.js` | generátor pater, rokle, rud, jeskyní, ruin (index pole = patro × W × H + y × W + x) |
| `cesty.js` | A* v patře, graf spojů mezi patry, oblasti a mezipaměť |
| `mistnosti.js` | hledání uzavřených místností, kvalita |
| `stabilita.js` | vzdálenostní pole k oporám (BFS od stěn a sloupů), praskání |
| `kapaliny.js` | voda a magma v rovině i mezi patry |
| `svetlo.js` | shadowcasting, denní světlo, zorné pole |
| `kresba/*.js` | malovaný terén (obrysy marching squares, textury, stíny), sprity, světlo, částice |

- **Výkon:** simulace naplno jen v aktivních patrech; kapaliny a stabilita usínají; kreslení po blocích 16 × 16 do mezipaměti, pohyblivé vrstvy zvlášť. Cíl: ≤ 900 µs na tah v pozdní hře, snímek ≤ 6 ms.
- **Testy:** stejná sada jako u Srdce hory (generátor na 1000 seedech, scénáře + fuzz s invarianty a porovnáním po uložení, bot „rozumný správce“, headless UI test v DPI 1 i 2, výkon).

---

## 22. Postup vývoje po etapách

| # | etapa | ověření |
|---|---|---|
| 1 | generátor pater a rokle, kreslení terénu v malovaném stylu (prázdnota, obrysy útesů, podlahy, stíny), kamera a přepínač pater | node: podíly hornin, dosažitelnost Srdce, jeskyně uzavřené; snímek porovnaný s předlohou |
| 2 | trpaslíci, tesání, cesty 8 směry, schodiště, šachta, díry | scénáře pohybu mezi patry, uvíznutí a záchrana |
| 3 | stavby, sklady, dílny (převzaté recepty), orientace staveb | materiál se neztrácí, uložení a obnova |
| 4 | místnosti, kvalita, potřeby, jídlo, světlo se stíny | nálada v „rozumné“ kolonii, místnosti se najdou správně |
| 5 | kov, zakázky, nástroje, priority, nouze (převzato) | totéž co v Srdci hory |
| 6 | období, karavana a tržiště, migranti, události | |
| 7 | stabilita podle opor, voda a magma mezi patry | závaly, zatopení spodního patra, obsidián |
| 8 | tvorové, boj, střelba, obrana, nájezdy | souboje, obléhání v rokli |
| 9 | příběh, Spáč, finále, epilog, volný režim | scénáře příběhu |
| 10 | malované sprity a ilustrace, částice, zvuk | sprite test, výkon kreslení |
| 11 | bot, vyvážení, „Co dál?“, nápověda, offline | bot 24 her |

---

## 23. Otevřené otázky

1. **Zdroj grafiky:** vše procedurálně v kódu (A), nebo atlas malovaných spritů z obrázků (B) – a pokud B, odkud obrázky (vlastní kresba, generované)?
2. **Název hry:** „Síně pod horou“ je pracovní. Nová samostatná hra vedle Srdce hory, nebo druhý režim zobrazení Srdce hory?
3. **Počet pater:** 8 podzemních po 20 m (návrh), nebo víc tenčích pater (např. 16 po 10 m) pro jemnější hloubku?
4. **Figurky:** čistě shora (jako žetony na bojové mapě), nebo mírně šikmo (vidět obličej a vousy)?
5. **Tržiště:** má se prodávané zboží fyzicky nosit na tržiště, nebo zmizet ze skladu hned jako dosud?
